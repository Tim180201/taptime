import { spawn } from 'node:child_process';
import {
  withDa5V5VerifiedInstalledDevice,
  type Da5V5AndroidAdbRunner,
  type Da5V5AndroidDeviceBinding,
  type Da5V5UsbSerialBinding,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';

const childTimeoutMilliseconds = 15_000;
const clipboardWatchdogMilliseconds = 30_000;
const mobileInputScript = 'IFS= read -r v; input text "$v"; unset v';

export type Da5V5CredentialPhase = 'administrator' | 'employee' | 'enrollment';

export interface Da5V5SecretProcessRunner {
  countOutput(
    command: string,
    arguments_: readonly string[],
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<number>;
  write(
    command: string,
    arguments_: readonly string[],
    input: Buffer,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<void>;
}

export class SystemDa5V5SecretProcessRunner implements Da5V5SecretProcessRunner {
  countOutput(
    command: string,
    arguments_: readonly string[],
    options: Readonly<{ signal?: AbortSignal }> = {},
  ): Promise<number> {
    return runSecretProcess(command, arguments_, undefined, true, options.signal);
  }

  write(
    command: string,
    arguments_: readonly string[],
    input: Buffer,
    options: Readonly<{ signal?: AbortSignal }> = {},
  ): Promise<void> {
    return runSecretProcess(command, arguments_, input, false, options.signal)
      .then(() => undefined);
  }
}

export class Da5V5WebCredentialTransfer {
  private activeOperation: Promise<unknown> | null = null;
  private clipboardRequiresZeroProof = false;
  private closeOperation: Promise<void> | null = null;
  private closing = false;
  private stateValue: 'busy' | 'closed' | 'failed' | 'idle' | 'paste-pending' = 'idle';
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private watchdogFailureReported = false;

  constructor(
    private readonly processes: Da5V5SecretProcessRunner,
    private readonly onWatchdogFailure: () => void,
    private readonly schedule: typeof setTimeout = setTimeout,
    private readonly cancel: typeof clearTimeout = clearTimeout,
  ) {}

  inject(candidate: Buffer, signal?: AbortSignal): Promise<'match' | 'mismatch'> {
    if (this.closing || this.stateValue === 'closed') {
      return Promise.resolve('mismatch');
    }
    if (this.stateValue !== 'idle') {
      return Promise.resolve(this.fail());
    }
    this.stateValue = 'busy';
    return this.track(this.performInject(candidate, signal));
  }

  private async performInject(
    candidate: Buffer,
    signal?: AbortSignal,
  ): Promise<'match' | 'mismatch'> {
    try {
      await this.clearAndProveZero(signal);
      if (this.closing) {
        return this.fail();
      }
      await this.writeClipboard(candidate, signal);
      this.stateValue = 'paste-pending';
      this.watchdog = this.schedule(() => {
        this.beginExpiry();
      }, clipboardWatchdogMilliseconds);
      return 'match';
    } catch {
      await this.clearAndProveZero().catch(() => undefined);
      return this.fail();
    }
  }

  confirmPaste(signal?: AbortSignal): Promise<'match' | 'mismatch'> {
    if (this.closing || this.stateValue === 'closed') {
      return Promise.resolve('mismatch');
    }
    if (this.stateValue !== 'paste-pending') {
      return Promise.resolve(this.fail());
    }
    this.clearWatchdog();
    this.stateValue = 'busy';
    return this.track(this.performConfirmPaste(signal));
  }

  private async performConfirmPaste(signal?: AbortSignal): Promise<'match' | 'mismatch'> {
    try {
      await this.clearAndProveZero(signal);
      this.stateValue = 'idle';
      return 'match';
    } catch {
      await this.clearAndProveZero().catch(() => undefined);
      return this.fail();
    }
  }

  close(): Promise<void> {
    if (this.closeOperation !== null) {
      return this.closeOperation;
    }
    if (this.stateValue === 'closed') {
      this.closeOperation = Promise.resolve();
      return this.closeOperation;
    }
    this.closing = true;
    this.clearWatchdog();
    if (this.activeOperation === null && !this.clipboardRequiresZeroProof) {
      if (this.stateValue !== 'failed') {
        this.stateValue = 'closed';
      }
      this.closeOperation = Promise.resolve();
      return this.closeOperation;
    }
    this.closeOperation = this.performClose();
    return this.closeOperation;
  }

  private async performClose(): Promise<void> {
    this.clearWatchdog();
    await this.activeOperation;
    this.clearWatchdog();
    const retainFailedState = this.stateValue === 'failed';
    try {
      if (this.clipboardRequiresZeroProof) {
        await this.clearAndProveZero();
      }
      if (!retainFailedState) {
        this.stateValue = 'closed';
      }
    } catch {
      this.stateValue = 'failed';
      throw new Error('DA5 V5 credential cleanup failed');
    }
  }

  state(): 'busy' | 'closed' | 'failed' | 'idle' | 'paste-pending' {
    return this.stateValue;
  }

  private async clearAndProveZero(signal?: AbortSignal): Promise<void> {
    const empty = Buffer.alloc(0);
    await this.writeClipboard(empty, signal);
    if (await this.processes.countOutput('pbpaste', [], { signal }) !== 0) {
      throw new Error('DA5 V5 clipboard zero state mismatch');
    }
    this.clipboardRequiresZeroProof = false;
  }

  private async writeClipboard(input: Buffer, signal?: AbortSignal): Promise<void> {
    this.clipboardRequiresZeroProof = true;
    await this.processes.write('pbcopy', [], input, { signal });
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) {
      this.cancel(this.watchdog);
      this.watchdog = null;
    }
  }

  private beginExpiry(): void {
    this.watchdog = null;
    if (
      this.closing
      || this.stateValue !== 'paste-pending'
      || this.activeOperation !== null
    ) {
      return;
    }
    this.stateValue = 'busy';
    void this.track(this.performExpiry());
  }

  private async performExpiry(): Promise<void> {
    try {
      await this.clearAndProveZero();
    } catch {
      // The generic failure callback is the only observable watchdog result.
    }
    this.stateValue = 'failed';
    if (!this.watchdogFailureReported) {
      this.watchdogFailureReported = true;
      try {
        this.onWatchdogFailure();
      } catch {
        // Callback failures cannot bypass the mandatory clipboard-zero cleanup.
      }
    }
  }

  private fail(): 'mismatch' {
    this.clearWatchdog();
    this.stateValue = 'failed';
    return 'mismatch';
  }

  private track<T>(operation: Promise<T>): Promise<T> {
    this.activeOperation = operation;
    return operation.finally(() => {
      if (this.activeOperation === operation) {
        this.activeOperation = null;
      }
    });
  }
}

export class Da5V5MobileCredentialTransfer {
  private readyPhase: 'employee' | 'enrollment' | null = null;

  constructor(
    private readonly processes: Da5V5SecretProcessRunner,
    private readonly adb: Da5V5AndroidAdbRunner,
    private readonly serialBinding: Da5V5UsbSerialBinding,
    private readonly deviceBinding: Da5V5AndroidDeviceBinding,
  ) {}

  confirmEmptyActiveField(
    phase: 'employee' | 'enrollment',
  ): 'match' | 'mismatch' {
    if (this.readyPhase !== null) {
      this.readyPhase = null;
      return 'mismatch';
    }
    this.readyPhase = phase;
    return 'match';
  }

  async inject(
    phase: 'employee' | 'enrollment',
    candidate: Buffer,
    signal?: AbortSignal,
  ): Promise<'match' | 'mismatch'> {
    if (this.readyPhase !== phase) {
      this.readyPhase = null;
      return 'mismatch';
    }
    this.readyPhase = null;
    try {
      await withDa5V5VerifiedInstalledDevice({
        deviceBinding: this.deviceBinding,
        runner: this.adb,
        serialBinding: this.serialBinding,
        signal,
      }, (serial) => this.processes.write(
        'adb',
        ['-s', serial, 'shell', 'sh', '-c', mobileInputScript],
        candidate,
        { signal },
      ));
      return 'match';
    } catch {
      return 'mismatch';
    }
  }
}

function runSecretProcess(
  command: string,
  arguments_: readonly string[],
  input: Buffer | undefined,
  countOutput: boolean,
  signal?: AbortSignal,
): Promise<number> {
  return new Promise((resolvePromise, rejectPromise) => {
    if (signal?.aborted === true) {
      rejectPromise(new Error('DA5 V5 secret process aborted'));
      return;
    }
    const child = spawn(command, [...arguments_], {
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
      stdio: [input === undefined ? 'ignore' : 'pipe', countOutput ? 'pipe' : 'ignore', 'ignore'],
    });
    let bytes = 0;
    let settled = false;
    let terminationError: Error | undefined;
    let forceKillTimeout: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      terminate(new Error('DA5 V5 secret process timed out'));
    }, childTimeoutMilliseconds);
    const abort = () => {
      terminate(new Error('DA5 V5 secret process aborted'));
    };
    const terminate = (error: Error): void => {
      if (settled || terminationError !== undefined) return;
      terminationError = error;
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => {
        child.kill('SIGKILL');
      }, 1_000);
    };
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimeout);
      signal?.removeEventListener('abort', abort);
      if (error === undefined) {
        resolvePromise(bytes);
      } else {
        rejectPromise(error);
      }
    };
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout?.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      chunk.fill(0);
      if (bytes > 1_024) {
        terminate(new Error('DA5 V5 secret process output exceeded its bound'));
      }
    });
    child.once('error', () => {
      finish(new Error('DA5 V5 secret process failed'));
    });
    child.once('close', (code) => {
      finish(terminationError ?? (
        code === 0 ? undefined : new Error('DA5 V5 secret process failed')
      ));
    });
    if (input !== undefined) {
      child.stdin?.end(input);
    }
  });
}
