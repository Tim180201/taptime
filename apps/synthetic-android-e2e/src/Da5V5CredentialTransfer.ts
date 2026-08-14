import { spawn } from 'node:child_process';
import {
  requireDa5V5AccessibilityDisabled,
  requireDa5V5ActiveTalkBackProvider,
  withDa5V5VerifiedInstalledDevice,
  type Da5V5AndroidAdbRunner,
  type Da5V5AndroidDeviceBinding,
  type Da5V5TalkBackPackage,
  type Da5V5UsbSerialBinding,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';

const childTimeoutMilliseconds = 15_000;
const clipboardWatchdogMilliseconds = 30_000;
const mobileInputScript = [
  'IFS= read -r v || exit 40;',
  '[ "${#v}" -eq 64 ] || { unset v; exit 41; };',
  'case "$v" in *[!0-9a-f]*) unset v; exit 41;; esac;',
  'IFS= read -r extra;',
  'extra_status=$?;',
  'if [ "$extra_status" -eq 0 ] || [ -n "$extra" ]; then',
  'unset v extra extra_status;',
  'exit 42;',
  'fi;',
  'input text "$v" >/dev/null 2>&1;',
  'input_status=$?;',
  'unset v extra extra_status;',
  'exit "$input_status"',
].join(' ');
const quotedMobileInputScript = `'${mobileInputScript}'`;

export type Da5V5CredentialPhase = 'administrator' | 'employee' | 'enrollment';
export type Da5V5CredentialResult = 'ambiguous' | 'fail' | 'pass';

export interface Da5V5StandardCredentialBinding extends Da5V5AndroidDeviceBinding {
  readonly fontScale: '1.0';
}

export interface Da5V5AccessibilityCredentialBinding extends Da5V5AndroidDeviceBinding {
  readonly fontScale: '2.0';
  readonly talkBackPackage: Da5V5TalkBackPackage;
  readonly talkBackVersion: string;
}

export type Da5V5MobileCredentialBinding =
  | Da5V5AccessibilityCredentialBinding
  | Da5V5StandardCredentialBinding;

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
  private phase: Da5V5CredentialPhase | null = null;
  private stateValue: 'failed' | 'field-ready' | 'idle' | 'injecting' | 'injection-pending' = (
    'idle'
  );

  constructor(
    private readonly adb: Da5V5AndroidAdbRunner,
    private readonly serialBinding: Da5V5UsbSerialBinding,
    private readonly deviceBinding: Da5V5MobileCredentialBinding,
  ) {}

  confirmEmptyActiveField(
    phase: Da5V5CredentialPhase,
  ): 'match' | 'mismatch' {
    if (this.stateValue !== 'idle' || this.phase !== null) {
      return this.fail();
    }
    this.phase = phase;
    this.stateValue = 'field-ready';
    return 'match';
  }

  async inject(
    phase: Da5V5CredentialPhase,
    candidate: Buffer,
    signal?: AbortSignal,
  ): Promise<'match' | 'mismatch'> {
    if (
      this.stateValue !== 'field-ready'
      || this.phase !== phase
      || !isDa5V5SyntheticCredential(candidate)
    ) {
      return this.fail();
    }
    this.stateValue = 'injecting';
    const framedCandidate = Buffer.alloc(candidate.length + 1);
    candidate.copy(framedCandidate);
    framedCandidate[candidate.length] = 0x0a;
    try {
      const output = await withDa5V5VerifiedInstalledDevice({
        deviceBinding: this.deviceBinding,
        runner: this.adb,
        serialBinding: this.serialBinding,
        signal,
      }, async (serial) => {
        const fontScale = exactSingleLine(await this.adb.run(
          ['-s', serial, 'shell', 'settings', 'get', 'system', 'font_scale'],
          { signal },
        ));
        const accessibilityEnabled = await this.adb.run(
          ['-s', serial, 'shell', 'settings', 'get', 'secure', 'accessibility_enabled'],
          { signal },
        );
        const enabledAccessibilityServices = await this.adb.run(
          [
            '-s', serial, 'shell', 'settings', 'get', 'secure',
            'enabled_accessibility_services',
          ],
          { signal },
        );
        if (fontScale !== this.deviceBinding.fontScale) {
          throw new Error('DA5 V5 credential profile mismatch');
        }
        if (this.deviceBinding.fontScale === '1.0') {
          requireDa5V5AccessibilityDisabled(
            accessibilityEnabled,
            enabledAccessibilityServices,
          );
        } else {
          const talkBackPackage = requireDa5V5ActiveTalkBackProvider(
            accessibilityEnabled,
            enabledAccessibilityServices,
            this.deviceBinding.talkBackPackage,
          );
          const talkBack = await this.adb.run(
            ['-s', serial, 'shell', 'dumpsys', 'package', talkBackPackage],
            { signal },
          );
          if (readTalkBackVersion(talkBack) !== this.deviceBinding.talkBackVersion) {
            throw new Error('DA5 V5 credential accessibility profile mismatch');
          }
        }
        return this.adb.run(
          ['-s', serial, 'shell', '-T', 'sh', '-c', quotedMobileInputScript],
          { requireEmptyOutput: true, signal, stdinBytes: framedCandidate },
        );
      });
      if (output !== '') {
        return this.fail();
      }
      this.stateValue = 'injection-pending';
      return 'match';
    } catch {
      return this.fail();
    } finally {
      framedCandidate.fill(0);
    }
  }

  confirmResult(
    phase: Da5V5CredentialPhase,
    result: Da5V5CredentialResult,
  ): 'match' | 'mismatch' {
    if (
      this.stateValue !== 'injection-pending'
      || this.phase !== phase
      || result !== 'pass'
    ) {
      return this.fail();
    }
    this.phase = null;
    this.stateValue = 'idle';
    return 'match';
  }

  state(): Readonly<{
    phase: Da5V5CredentialPhase | null;
    state: 'failed' | 'field-ready' | 'idle' | 'injecting' | 'injection-pending';
  }> {
    return Object.freeze({ phase: this.phase, state: this.stateValue });
  }

  private fail(): 'mismatch' {
    this.phase = null;
    this.stateValue = 'failed';
    return 'mismatch';
  }
}

function readTalkBackVersion(value: string): string {
  const matches = [...value.matchAll(/^\s*versionName=(\S+)\s*$/gmu)];
  if (matches.length !== 1 || matches[0]?.[1] === undefined) {
    throw new Error('DA5 V5 TalkBack binding is unavailable');
  }
  return matches[0][1];
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

function isDa5V5SyntheticCredential(value: Buffer): boolean {
  if (value.length !== 64) return false;
  return value.every((byte) => (
    (byte >= 0x30 && byte <= 0x39)
    || (byte >= 0x61 && byte <= 0x66)
  ));
}

function exactSingleLine(value: string): string {
  const lines = value.split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  if (
    lines.length !== 1
    || lines[0] === undefined
    || lines[0].length === 0
    || lines[0].trim() !== lines[0]
  ) {
    throw new Error('DA5 V5 credential device output mismatch');
  }
  return lines[0];
}
