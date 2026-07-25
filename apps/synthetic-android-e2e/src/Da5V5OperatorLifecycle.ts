import type { Interface } from 'node:readline';

export type Da5V5OperatorFailureEvent =
  | 'da5_v5_checkpoint=mismatch'
  | 'da5_v5_credential_binding=mismatch'
  | 'da5_v5_device_checkpoint=mismatch'
  | 'da5_v5_dedupe_window=mismatch'
  | 'da5_v5_fixture=mismatch'
  | 'da5_v5_interrupted'
  | 'da5_v5_offline_control=mismatch'
  | 'operator_command_failed'
  | 'operator_command_rejected';

export type Da5V5OperatorCommandOutcome =
  | Readonly<{ readonly state: 'continue' }>
  | Readonly<{ readonly event: Da5V5OperatorFailureEvent; readonly state: 'fail' }>
  | Readonly<{ readonly state: 'stop' }>;

export class Da5V5OperatorLifecycle {
  private cleanupPromise: Promise<void> | null = null;
  private failureLatched = false;
  private reportStoppedAfterCleanup = false;
  private state: 'active' | 'running' | 'stopping' | 'stopped' = 'active';

  constructor(
    private readonly cleanup: () => Promise<void>,
    private readonly report: (event: string) => void,
    private readonly markFailed: () => void,
  ) {}

  isActive(): boolean {
    return this.state === 'active';
  }

  async submit(command: () => Promise<Da5V5OperatorCommandOutcome>): Promise<void> {
    if (this.state === 'running') {
      await this.fail('operator_command_rejected');
      return;
    }
    if (this.state !== 'active') {
      return;
    }
    this.state = 'running';
    let outcome: Da5V5OperatorCommandOutcome;
    try {
      outcome = await command();
    } catch {
      if (this.state !== 'running') {
        await this.cleanupPromise;
        return;
      }
      await this.fail('operator_command_failed');
      return;
    }
    if (this.state !== 'running') {
      await this.cleanupPromise;
      return;
    }
    if (outcome.state === 'continue') {
      this.state = 'active';
    } else if (outcome.state === 'fail') {
      await this.fail(outcome.event);
    } else {
      await this.finish(true);
    }
  }

  async fail(event: Da5V5OperatorFailureEvent): Promise<void> {
    if (!this.failureLatched) {
      this.failureLatched = true;
      this.reportStoppedAfterCleanup = false;
      this.report(event);
      this.markFailed();
    }
    await this.finish(false);
  }

  async stop(reportStopped: boolean = true): Promise<void> {
    await this.finish(reportStopped);
  }

  private async finish(reportStopped: boolean): Promise<void> {
    if (reportStopped && !this.failureLatched) {
      this.reportStoppedAfterCleanup = true;
    }
    if (this.cleanupPromise !== null) {
      await this.cleanupPromise;
      return;
    }
    this.state = 'stopping';
    this.cleanupPromise = (async () => {
      try {
        await this.cleanup();
        this.state = 'stopped';
        if (this.reportStoppedAfterCleanup && !this.failureLatched) {
          this.report('da5_v5_stopped');
        }
      } catch {
        this.state = 'stopped';
        this.markFailed();
        this.report('da5_v5_cleanup_failed');
      }
    })();
    await this.cleanupPromise;
  }
}

export class Da5V5StartupInterrupted extends Error {
  constructor() {
    super('DA5 V5 startup interrupted');
    this.name = 'Da5V5StartupInterrupted';
  }
}

export class Da5V5SignalController {
  private completion: Promise<void> = Promise.resolve();
  private interrupted = false;
  private lifecycle: Da5V5OperatorLifecycle | null = null;

  constructor(
    private readonly report: (event: string) => void,
    private readonly markFailed: () => void,
  ) {}

  bind(lifecycle: Da5V5OperatorLifecycle): void {
    if (this.interrupted || this.lifecycle !== null) {
      throw new Da5V5StartupInterrupted();
    }
    this.lifecycle = lifecycle;
  }

  checkpoint(): void {
    if (this.interrupted) {
      throw new Da5V5StartupInterrupted();
    }
  }

  handleSignal(): Promise<void> {
    if (this.interrupted) {
      return this.completion;
    }
    this.interrupted = true;
    const lifecycle = this.lifecycle;
    if (lifecycle === null) {
      this.report('da5_v5_interrupted');
      this.markFailed();
    } else {
      this.completion = lifecycle.fail('da5_v5_interrupted');
    }
    return this.completion;
  }

  isInterrupted(): boolean {
    return this.interrupted;
  }
}

export class Da5V5InputOwnership {
  private commandInput: Interface | null = null;
  private secretInput: Interface | null = null;

  command(): Interface | null {
    return this.commandInput;
  }

  attachCommand(input: Interface): void {
    if (this.commandInput !== null || this.secretInput !== null) {
      throw new Error('DA5 V5 input already has an owner');
    }
    this.commandInput = input;
  }

  detachCommandForSecret(): void {
    const input = this.commandInput;
    if (input === null || this.secretInput !== null) {
      throw new Error('DA5 V5 command input is unavailable');
    }
    this.commandInput = null;
    input.removeAllListeners();
    input.close();
  }

  attachSecret(input: Interface): void {
    if (this.commandInput !== null || this.secretInput !== null) {
      throw new Error('DA5 V5 input already has an owner');
    }
    this.secretInput = input;
  }

  releaseSecret(input: Interface): void {
    if (this.secretInput !== input) {
      throw new Error('DA5 V5 secret input ownership mismatch');
    }
    this.secretInput = null;
    input.close();
  }

  closeAll(): void {
    this.commandInput?.removeAllListeners();
    this.commandInput?.close();
    this.commandInput = null;
    this.secretInput?.close();
    this.secretInput = null;
  }

  mode(): 'command' | 'none' | 'secret' {
    return this.commandInput !== null
      ? 'command'
      : this.secretInput !== null ? 'secret' : 'none';
  }
}
