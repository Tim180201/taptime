export type Da4V5OperatorFailureEvent =
  | 'synthetic_password_binding=mismatch'
  | 'da4_v5_timezone_binding=mismatch'
  | 'da4_v5_write_checkpoint=mismatch'
  | 'da4_v5_interrupted'
  | 'operator_command_failed'
  | 'operator_command_rejected';

export type Da4V5OperatorCommandOutcome =
  | Readonly<{ readonly state: 'continue' }>
  | Readonly<{ readonly event: Da4V5OperatorFailureEvent; readonly state: 'fail' }>
  | Readonly<{ readonly state: 'stop' }>;

export class Da4V5OperatorLifecycle {
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

  async submit(command: () => Promise<Da4V5OperatorCommandOutcome>): Promise<void> {
    if (this.state === 'running') {
      await this.fail('operator_command_rejected');
      return;
    }
    if (this.state !== 'active') {
      return;
    }
    this.state = 'running';
    let outcome: Da4V5OperatorCommandOutcome;
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
      return;
    }
    if (outcome.state === 'fail') {
      await this.fail(outcome.event);
      return;
    }
    await this.finish(true);
  }

  async fail(event: Da4V5OperatorFailureEvent): Promise<void> {
    this.latchFailure(event);
    await this.finish(false);
  }

  async stop(reportStopped: boolean = true): Promise<void> {
    await this.finish(reportStopped);
  }

  private latchFailure(event: Da4V5OperatorFailureEvent): void {
    if (this.failureLatched) {
      return;
    }
    this.failureLatched = true;
    this.reportStoppedAfterCleanup = false;
    this.report(event);
    this.markFailed();
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
          this.report('da4_v5_stopped');
        }
      } catch {
        this.state = 'stopped';
        this.markFailed();
        this.report('da4_v5_cleanup_failed');
      }
    })();
    await this.cleanupPromise;
  }
}

export class Da4V5StartupInterrupted extends Error {
  constructor() {
    super('DA4 V5 startup interrupted');
    this.name = 'Da4V5StartupInterrupted';
  }
}

export class Da4V5SignalController {
  private completion: Promise<void> = Promise.resolve();
  private interrupted = false;
  private lifecycle: Da4V5OperatorLifecycle | null = null;

  constructor(
    private readonly report: (event: string) => void,
    private readonly markFailed: () => void,
  ) {}

  bind(lifecycle: Da4V5OperatorLifecycle): void {
    if (this.interrupted || this.lifecycle !== null) {
      throw new Da4V5StartupInterrupted();
    }
    this.lifecycle = lifecycle;
  }

  checkpoint(): void {
    if (this.interrupted) {
      throw new Da4V5StartupInterrupted();
    }
  }

  handleSignal(): Promise<void> {
    if (this.interrupted) {
      return this.completion;
    }
    this.interrupted = true;
    const lifecycle = this.lifecycle;
    if (lifecycle === null) {
      this.report('da4_v5_interrupted');
      this.markFailed();
    } else {
      this.completion = lifecycle.fail('da4_v5_interrupted');
    }
    return this.completion;
  }

  isInterrupted(): boolean {
    return this.interrupted;
  }
}

export class Da4V5InputOwnership {
  private commandInput: Interface | null = null;
  private secretInput: Interface | null = null;

  command(): Interface | null {
    return this.commandInput;
  }

  attachCommand(input: Interface): void {
    if (this.commandInput !== null || this.secretInput !== null) {
      throw new Error('DA4 V5 input already has an owner');
    }
    this.commandInput = input;
  }

  detachCommandForSecret(): Interface {
    const input = this.commandInput;
    if (input === null || this.secretInput !== null) {
      throw new Error('DA4 V5 command input is unavailable');
    }
    this.commandInput = null;
    input.removeAllListeners();
    input.close();
    return input;
  }

  attachSecret(input: Interface): void {
    if (this.commandInput !== null || this.secretInput !== null) {
      throw new Error('DA4 V5 input already has an owner');
    }
    this.secretInput = input;
  }

  releaseSecret(input: Interface): void {
    if (this.secretInput !== input) {
      throw new Error('DA4 V5 secret input ownership mismatch');
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
      : this.secretInput !== null
        ? 'secret'
        : 'none';
  }
}
import type { Interface } from 'node:readline';
