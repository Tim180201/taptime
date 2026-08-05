import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Da5V5UsbSerialBinding,
  type Da5V5AndroidAdbRunner,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';
import {
  Da5V5MemoryOnlyPasswordBinding,
  Da5V5MobileCredentialTransfer,
  Da5V5WebCredentialTransfer,
  da5V5SyntheticCredentialBuffer,
  type Da5V5SecretProcessRunner,
} from '../src/index.js';

const credentialText = 'a'.repeat(64);
const deviceBinding = Object.freeze({
  androidBuild: 'synthetic/vendor/device:15/BUILD/1:user/release-keys',
  deviceModel: 'Synthetic Galaxy',
  fontScale: '1.0' as const,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DA5 V5 coupled credential transfer', () => {
  it('closes a pristine transfer idempotently without invoking a platform process', async () => {
    const processes = new FakeSecretProcesses();
    const web = new Da5V5WebCredentialTransfer(processes, vi.fn());
    const candidate = da5V5SyntheticCredentialBuffer(credentialText);

    const firstClose = web.close();
    const secondClose = web.close();

    expect(secondClose).toBe(firstClose);
    await expect(firstClose).resolves.toBeUndefined();
    expect(web.state()).toBe('closed');
    expect(processes.commands).toHaveLength(0);
    await expect(web.inject(candidate)).resolves.toBe('mismatch');
    expect(web.state()).toBe('closed');
    expect(processes.commands).toHaveLength(0);
    candidate.fill(0);
  });

  it('accepts only exact 64-lowercase-hex ASCII and compares its digest timing-safely', () => {
    const credential = da5V5SyntheticCredentialBuffer(credentialText);
    const binding = new Da5V5MemoryOnlyPasswordBinding(credential);
    const same = Buffer.from(credential);
    const different = Buffer.from(`b${credentialText.slice(1)}`, 'ascii');
    expect(binding.compare(same)).toBe('match');
    expect(binding.compare(different)).toBe('mismatch');
    expect(() => da5V5SyntheticCredentialBuffer('not-hex')).toThrow(/64-lowercase-hex ASCII/);
    expect(() => da5V5SyntheticCredentialBuffer('A'.repeat(64))).toThrow(
      /64-lowercase-hex ASCII/,
    );
    binding.destroy();
    expect(binding.compare(same)).toBe('mismatch');
    credential.fill(0);
    same.fill(0);
    different.fill(0);
  });

  it('passes the matched Buffer instance only through pbcopy stdin and proves zero on confirm',
    async () => {
      const processes = new FakeSecretProcesses();
      const watchdogFailure = vi.fn();
      const web = new Da5V5WebCredentialTransfer(processes, watchdogFailure);
      const candidate = da5V5SyntheticCredentialBuffer(credentialText);

      await expect(web.inject(candidate)).resolves.toBe('match');
      expect(web.state()).toBe('paste-pending');
      expect(processes.writes).toHaveLength(2);
      expect(processes.writes[0]).toMatchObject({ command: 'pbcopy', arguments_: [] });
      expect(processes.writes[0]?.input.length).toBe(0);
      expect(processes.writes[1]?.input).toBe(candidate);
      expect(JSON.stringify(processes.commands)).not.toContain(credentialText);

      await expect(web.confirmPaste()).resolves.toBe('match');
      expect(web.state()).toBe('idle');
      expect(processes.writes.at(-1)?.input.length).toBe(0);
      expect(processes.counts.at(-1)).toEqual({ arguments_: [], command: 'pbpaste' });
      expect(watchdogFailure).not.toHaveBeenCalled();
      const commandsBeforeClose = processes.commands.length;
      const firstClose = web.close();
      const secondClose = web.close();
      expect(secondClose).toBe(firstClose);
      await firstClose;
      expect(processes.commands).toHaveLength(commandsBeforeClose);
      expect(web.state()).toBe('closed');
      candidate.fill(0);
    });

  it('clears and proves zero when close owns a paste-pending clipboard', async () => {
    const processes = new FakeSecretProcesses();
    const web = new Da5V5WebCredentialTransfer(processes, vi.fn());
    const candidate = da5V5SyntheticCredentialBuffer(credentialText);

    await expect(web.inject(candidate)).resolves.toBe('match');
    expect(web.state()).toBe('paste-pending');
    await expect(web.close()).resolves.toBeUndefined();

    expect(web.state()).toBe('closed');
    expect(processes.writes).toHaveLength(3);
    expect(processes.writes.at(-1)?.input.length).toBe(0);
    expect(processes.counts).toHaveLength(2);
    candidate.fill(0);
  });

  it('retains cleanup duty after write failure and retries it exactly once on close', async () => {
    const processes = new FakeSecretProcesses();
    processes.writeOutcomes.push('pass', 'fail', 'fail', 'pass');
    const web = new Da5V5WebCredentialTransfer(processes, vi.fn());
    const candidate = da5V5SyntheticCredentialBuffer(credentialText);

    await expect(web.inject(candidate)).resolves.toBe('mismatch');
    expect(web.state()).toBe('failed');
    expect(processes.writes).toHaveLength(3);
    expect(processes.counts).toHaveLength(1);

    const close = web.close();
    await expect(close).resolves.toBeUndefined();
    expect(web.state()).toBe('failed');
    expect(processes.writes).toHaveLength(4);
    expect(processes.writes.at(-1)?.input.length).toBe(0);
    expect(processes.counts).toHaveLength(2);
    await expect(web.close()).resolves.toBeUndefined();
    expect(processes.writes).toHaveLength(4);
    candidate.fill(0);
  });

  it('fails close closed when no clipboard-zero proof can be established', async () => {
    const processes = new FakeSecretProcesses();
    processes.countOutcomes.push(1, 1, 1);
    const web = new Da5V5WebCredentialTransfer(processes, vi.fn());
    const candidate = da5V5SyntheticCredentialBuffer(credentialText);

    await expect(web.inject(candidate)).resolves.toBe('mismatch');
    expect(processes.writes.every(({ input }) => input.length === 0)).toBe(true);
    const close = web.close();
    await expect(close).rejects.toThrow('DA5 V5 credential cleanup failed');
    expect(web.state()).toBe('failed');
    expect(processes.counts).toHaveLength(3);

    const commandCount = processes.commands.length;
    await expect(web.close()).rejects.toThrow('DA5 V5 credential cleanup failed');
    expect(processes.commands).toHaveLength(commandCount);
    candidate.fill(0);
  });

  it('stops an active inject before its non-empty write when close begins', async () => {
    const processes = new FakeSecretProcesses();
    let releaseInitialClear!: () => void;
    processes.deferNextEmptyWrite = new Promise<void>((resolvePromise) => {
      releaseInitialClear = resolvePromise;
    });
    const web = new Da5V5WebCredentialTransfer(processes, vi.fn());
    const candidate = da5V5SyntheticCredentialBuffer(credentialText);
    const lateCandidate = da5V5SyntheticCredentialBuffer(`b${credentialText.slice(1)}`);

    const inject = web.inject(candidate);
    const close = web.close();
    await expect(web.inject(lateCandidate)).resolves.toBe('mismatch');
    releaseInitialClear();

    await expect(inject).resolves.toBe('mismatch');
    await expect(close).resolves.toBeUndefined();
    expect(web.state()).toBe('failed');
    expect(processes.writes.filter(({ input }) => input.length > 0)).toHaveLength(0);
    expect(processes.writes.at(-1)?.input.length).toBe(0);
    const commandCount = processes.commands.length;
    await expect(web.close()).resolves.toBeUndefined();
    await expect(web.inject(lateCandidate)).resolves.toBe('mismatch');
    expect(web.state()).toBe('failed');
    expect(processes.commands).toHaveLength(commandCount);
    candidate.fill(0);
    lateCandidate.fill(0);
  });

  it('stops before clipboard or device injection on digest mismatch', async () => {
    const processes = new FakeSecretProcesses();
    const web = new Da5V5WebCredentialTransfer(processes, vi.fn());
    const expected = da5V5SyntheticCredentialBuffer(credentialText);
    const candidate = da5V5SyntheticCredentialBuffer(`b${credentialText.slice(1)}`);
    const binding = new Da5V5MemoryOnlyPasswordBinding(expected);

    const result = binding.compare(candidate) === 'match'
      ? await web.inject(candidate)
      : 'mismatch';

    expect(result).toBe('mismatch');
    expect(processes.writes).toHaveLength(0);
    binding.destroy();
    expected.fill(0);
    candidate.fill(0);
  });

  it('clears on watchdog expiry and reports only a generic failure callback', async () => {
    vi.useFakeTimers();
    const processes = new FakeSecretProcesses();
    const watchdogFailure = vi.fn();
    const web = new Da5V5WebCredentialTransfer(processes, watchdogFailure);
    const candidate = da5V5SyntheticCredentialBuffer(credentialText);
    await web.inject(candidate);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(web.state()).toBe('failed');
    expect(processes.writes.at(-1)?.input.length).toBe(0);
    expect(watchdogFailure).toHaveBeenCalledTimes(1);
    candidate.fill(0);
  });

  it('waits for an already-started watchdog expiry before close and retains failure',
    async () => {
      const processes = new FakeSecretProcesses();
      const watchdogFailure = vi.fn();
      const callbacks: Array<() => void> = [];
      const schedule = ((callback: () => void) => {
        callbacks.push(callback);
        return 1;
      }) as unknown as typeof setTimeout;
      const web = new Da5V5WebCredentialTransfer(
        processes,
        watchdogFailure,
        schedule,
        vi.fn() as unknown as typeof clearTimeout,
      );
      const candidate = da5V5SyntheticCredentialBuffer(credentialText);
      await web.inject(candidate);
      let releaseExpiry!: () => void;
      processes.deferNextEmptyWrite = new Promise<void>((resolvePromise) => {
        releaseExpiry = resolvePromise;
      });

      callbacks[0]?.();
      const close = web.close();
      let closeSettled = false;
      void close.then(() => {
        closeSettled = true;
      });
      await Promise.resolve();

      expect(web.state()).toBe('busy');
      expect(closeSettled).toBe(false);
      expect(watchdogFailure).not.toHaveBeenCalled();

      releaseExpiry();
      await close;

      expect(closeSettled).toBe(true);
      expect(web.state()).toBe('failed');
      expect(watchdogFailure).toHaveBeenCalledTimes(1);
      expect(processes.writes.at(-1)?.input.length).toBe(0);
      expect(processes.counts.at(-1)).toEqual({ arguments_: [], command: 'pbpaste' });
      callbacks[0]?.();
      await Promise.resolve();
      expect(watchdogFailure).toHaveBeenCalledTimes(1);
      candidate.fill(0);
    });

  it('requires EMPTY_ACTIVE, fixed non-PTY stdin and visible Human confirmation for every phase',
    async () => {
      const adb = new CredentialAdb();
      const serialBinding = new Da5V5UsbSerialBinding();
      expect(serialBinding.bind(adb.serial)).toBe('match');
      const mobile = new Da5V5MobileCredentialTransfer(
        adb,
        serialBinding,
        deviceBinding,
      );
      const candidate = da5V5SyntheticCredentialBuffer(credentialText);

      await expect(mobile.inject('enrollment', candidate)).resolves.toBe('mismatch');
      expect(adb.injectionInputs).toHaveLength(0);

      const fresh = new Da5V5MobileCredentialTransfer(adb, serialBinding, deviceBinding);
      for (const phase of ['administrator', 'enrollment', 'employee'] as const) {
        expect(fresh.confirmEmptyActiveField(phase)).toBe('match');
        await expect(fresh.inject(phase, candidate)).resolves.toBe('match');
        expect(fresh.state()).toEqual({ phase, state: 'injection-pending' });
        expect(fresh.confirmVisibleField(phase, 'visible')).toBe('match');
        expect(fresh.state()).toEqual({ phase: null, state: 'idle' });
      }

      expect(adb.injectionInputs).toHaveLength(3);
      expect(adb.injectionRequireEmptyOutput).toEqual([true, true, true]);
      expect(adb.injectionSnapshots).toEqual([
        Buffer.from(`${credentialText}\n`, 'ascii'),
        Buffer.from(`${credentialText}\n`, 'ascii'),
        Buffer.from(`${credentialText}\n`, 'ascii'),
      ]);
      expect(adb.injectionInputs.every((input) => input.every((byte) => byte === 0))).toBe(true);
      expect(adb.injectionCommands[0]?.slice(0, 6)).toEqual([
        '-s', adb.serial, 'shell', '-T', 'sh', '-c',
      ]);
      const scriptArgument = adb.injectionCommands[0]?.[6];
      expect(scriptArgument?.startsWith("'IFS= read -r v || exit 40;")).toBe(true);
      expect(scriptArgument).toContain('[ "${#v}" -eq 64 ]');
      expect(scriptArgument).toContain('*[!0-9a-f]*');
      expect(scriptArgument).toContain('input text "$v" >/dev/null 2>&1;');
      expect(scriptArgument).toContain('exit "$input_status"');
      expect(JSON.stringify(adb.commands)).not.toContain(credentialText);
      candidate.fill(0);
    });

  it('uses the same empty-field and no-output transfer under the exact Gate-E profile',
    async () => {
      const adb = new CredentialAdb();
      adb.fontScale = '2.0';
      adb.accessibilityEnabled = '1';
      adb.enabledAccessibilityServices = `${adb.talkBackPackage}/.TalkBackService`;
      const serialBinding = new Da5V5UsbSerialBinding();
      expect(serialBinding.bind(adb.serial)).toBe('match');
      const mobile = new Da5V5MobileCredentialTransfer(adb, serialBinding, {
        androidBuild: deviceBinding.androidBuild,
        deviceModel: deviceBinding.deviceModel,
        fontScale: '2.0',
        talkBackPackage: adb.talkBackPackage,
        talkBackVersion: adb.talkBackVersion,
      });
      const candidate = da5V5SyntheticCredentialBuffer(credentialText);

      expect(mobile.confirmEmptyActiveField('administrator')).toBe('match');
      await expect(mobile.inject('administrator', candidate)).resolves.toBe('match');
      expect(mobile.confirmVisibleField('administrator', 'visible')).toBe('match');
      expect(adb.injectionRequireEmptyOutput).toEqual([true]);
      expect(adb.commands).toContainEqual([
        '-s', adb.serial, 'shell', 'dumpsys', 'package', adb.talkBackPackage,
      ]);

      const versionDrift = new CredentialAdb();
      versionDrift.fontScale = '2.0';
      versionDrift.accessibilityEnabled = '1';
      versionDrift.enabledAccessibilityServices = (
        `${versionDrift.talkBackPackage}/.TalkBackService`
      );
      const driftBinding = new Da5V5UsbSerialBinding();
      expect(driftBinding.bind(versionDrift.serial)).toBe('match');
      const rejected = new Da5V5MobileCredentialTransfer(versionDrift, driftBinding, {
        androidBuild: deviceBinding.androidBuild,
        deviceModel: deviceBinding.deviceModel,
        fontScale: '2.0',
        talkBackPackage: versionDrift.talkBackPackage,
        talkBackVersion: 'different-version',
      });
      expect(rejected.confirmEmptyActiveField('employee')).toBe('match');
      await expect(rejected.inject('employee', candidate)).resolves.toBe('mismatch');
      expect(versionDrift.injectionInputs).toHaveLength(0);
      candidate.fill(0);
    });

  it('executes the fixed device-side parser fail-closed for format, extra input and input exit',
    async () => {
      const adb = new CredentialAdb();
      const serialBinding = new Da5V5UsbSerialBinding();
      expect(serialBinding.bind(adb.serial)).toBe('match');
      const mobile = new Da5V5MobileCredentialTransfer(adb, serialBinding, deviceBinding);
      const candidate = da5V5SyntheticCredentialBuffer(credentialText);
      expect(mobile.confirmEmptyActiveField('administrator')).toBe('match');
      await expect(mobile.inject('administrator', candidate)).resolves.toBe('match');
      const quoted = adb.injectionCommands[0]?.[6];
      expect(quoted).toBeDefined();
      const script = quoted?.slice(1, -1) ?? '';

      expect(runMobileInputScript(script, `${credentialText}\n`, 0)).toBe(0);
      expect(runMobileInputScript(script, `${'A'.repeat(64)}\n`, 0)).toBe(41);
      expect(runMobileInputScript(script, `${'a'.repeat(63)}\n`, 0)).toBe(41);
      expect(runMobileInputScript(script, `${credentialText}\nextra\n`, 0)).toBe(42);
      expect(runMobileInputScript(script, `${credentialText}\n`, 7)).toBe(7);
      candidate.fill(0);
    });

  it('latches failed on wrong phase, non-visible confirmation, invalid format or ADB output',
    async () => {
      const makeTransfer = (adb = new CredentialAdb()) => {
        const serialBinding = new Da5V5UsbSerialBinding();
        expect(serialBinding.bind(adb.serial)).toBe('match');
        return { adb, mobile: new Da5V5MobileCredentialTransfer(adb, serialBinding, deviceBinding) };
      };
      const candidate = da5V5SyntheticCredentialBuffer(credentialText);

      const wrongPhase = makeTransfer();
      expect(wrongPhase.mobile.confirmEmptyActiveField('enrollment')).toBe('match');
      await expect(wrongPhase.mobile.inject('employee', candidate)).resolves.toBe('mismatch');
      expect(wrongPhase.mobile.state()).toEqual({ phase: null, state: 'failed' });

      const notVisible = makeTransfer();
      expect(notVisible.mobile.confirmEmptyActiveField('employee')).toBe('match');
      await expect(notVisible.mobile.inject('employee', candidate)).resolves.toBe('match');
      expect(notVisible.mobile.confirmVisibleField('employee', 'empty')).toBe('mismatch');
      expect(notVisible.mobile.confirmEmptyActiveField('employee')).toBe('mismatch');

      const invalid = makeTransfer();
      expect(invalid.mobile.confirmEmptyActiveField('administrator')).toBe('match');
      await expect(invalid.mobile.inject(
        'administrator',
        Buffer.from('A'.repeat(64), 'ascii'),
      )).resolves.toBe('mismatch');
      expect(invalid.adb.injectionInputs).toHaveLength(0);

      const output = makeTransfer();
      output.adb.injectionOutput = '\n';
      expect(output.mobile.confirmEmptyActiveField('administrator')).toBe('match');
      await expect(output.mobile.inject('administrator', candidate)).resolves.toBe('mismatch');
      expect(output.mobile.state()).toEqual({ phase: null, state: 'failed' });
      expect(output.adb.injectionInputs[0]?.every((byte) => byte === 0)).toBe(true);

      const profile = makeTransfer();
      profile.adb.fontScale = '2.0';
      expect(profile.mobile.confirmEmptyActiveField('administrator')).toBe('match');
      await expect(profile.mobile.inject('administrator', candidate)).resolves.toBe('mismatch');
      expect(profile.adb.injectionInputs).toHaveLength(0);
      candidate.fill(0);
    });

  it('stops before injection when an identical-model/build replacement serial appears',
    async () => {
      const adb = new CredentialAdb();
      const serialBinding = new Da5V5UsbSerialBinding();
      expect(serialBinding.bind(adb.serial)).toBe('match');
      const mobile = new Da5V5MobileCredentialTransfer(
        adb,
        serialBinding,
        deviceBinding,
      );
      expect(mobile.confirmEmptyActiveField('employee')).toBe('match');
      adb.serial = 'replacement-device';
      const candidate = da5V5SyntheticCredentialBuffer(credentialText);

      await expect(mobile.inject('employee', candidate)).resolves.toBe('mismatch');
      expect(adb.injectionInputs).toHaveLength(0);
      candidate.fill(0);
    });

  it('contains no fixed synthetic email in the clipboard or mobile transfer helper', async () => {
    const source = await readFile(
      new URL('../src/Da5V5CredentialTransfer.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/@example|@taptime|SYNTHETIC_.*EMAIL/u);
  });
});

class FakeSecretProcesses implements Da5V5SecretProcessRunner {
  commands: Array<{ arguments_: readonly string[]; command: string }> = [];
  counts: Array<{ arguments_: readonly string[]; command: string }> = [];
  deferNextEmptyWrite: Promise<void> | null = null;
  outputBytes = 0;
  countOutcomes: Array<number | 'fail'> = [];
  writeOutcomes: Array<'fail' | 'pass'> = [];
  writes: Array<{ arguments_: readonly string[]; command: string; input: Buffer }> = [];

  async countOutput(command: string, arguments_: readonly string[]): Promise<number> {
    const invocation = { arguments_: [...arguments_], command };
    this.commands.push(invocation);
    this.counts.push(invocation);
    const outcome = this.countOutcomes.shift();
    if (outcome === 'fail') throw new Error('synthetic count failure');
    return outcome ?? this.outputBytes;
  }

  async write(command: string, arguments_: readonly string[], input: Buffer): Promise<void> {
    this.commands.push({ arguments_: [...arguments_], command });
    this.writes.push({ arguments_: [...arguments_], command, input });
    if (this.writeOutcomes.shift() === 'fail') {
      throw new Error('synthetic write failure');
    }
    if (input.length === 0 && this.deferNextEmptyWrite !== null) {
      const deferredWrite = this.deferNextEmptyWrite;
      this.deferNextEmptyWrite = null;
      await deferredWrite;
    }
  }
}

class CredentialAdb implements Da5V5AndroidAdbRunner {
  accessibilityEnabled = '0';
  commands: string[][] = [];
  enabledAccessibilityServices = 'null';
  injectionCommands: string[][] = [];
  injectionInputs: Buffer[] = [];
  injectionRequireEmptyOutput: boolean[] = [];
  injectionSnapshots: Buffer[] = [];
  injectionOutput = '';
  fontScale = '1.0';
  serial = 'synthetic-device';
  talkBackPackage = 'com.google.android.marvin.talkback' as const;
  talkBackVersion = '15.1.0';

  async run(
    arguments_: readonly string[],
    options: Readonly<{ requireEmptyOutput?: true; stdinBytes?: Buffer }> = {},
  ): Promise<string> {
    this.commands.push([...arguments_]);
    if (arguments_.join(' ') === 'devices -l') {
      return `List of devices attached\n${this.serial}\tdevice usb:synthetic\n`;
    }
    if (arguments_[0] !== '-s' || arguments_[1] !== this.serial) {
      throw new Error('unexpected fake device');
    }
    const command = arguments_.slice(2).join(' ');
    if (command === 'shell getprop ro.product.model') return `${deviceBinding.deviceModel}\n`;
    if (command === 'shell getprop ro.build.fingerprint') {
      return `${deviceBinding.androidBuild}\n`;
    }
    if (command === 'shell settings get system font_scale') return `${this.fontScale}\n`;
    if (command === 'shell settings get secure accessibility_enabled') {
      return `${this.accessibilityEnabled}\n`;
    }
    if (command === 'shell settings get secure enabled_accessibility_services') {
      return `${this.enabledAccessibilityServices}\n`;
    }
    if (command === `shell dumpsys package ${this.talkBackPackage}`) {
      return `  versionName=${this.talkBackVersion}\n`;
    }
    if (command === 'reverse --list') {
      return [
        'UsbFfs tcp:54321 tcp:54321',
        'UsbFfs tcp:3000 tcp:3000',
        '',
      ].join('\n');
    }
    if (
      command === 'shell cmd package list packages -a -u --user 0 '
        + 'com.tim180201.mobile.synthetic'
    ) {
      return 'package:com.tim180201.mobile.synthetic\n';
    }
    if (
      command === 'shell cmd package path --user 0 '
        + 'com.tim180201.mobile.synthetic'
    ) {
      return 'package:/data/app/synthetic/base.apk\n';
    }
    if (command === 'shell ps -A -w -o NAME:4') {
      return 'NAME\ncom.tim180201.mobile.synthetic\n';
    }
    if (command.startsWith("shell -T sh -c 'IFS= read -r v || exit 40;")) {
      if (options.stdinBytes === undefined) {
        throw new Error('missing synthetic stdin');
      }
      this.injectionCommands.push([...arguments_]);
      this.injectionInputs.push(options.stdinBytes);
      this.injectionRequireEmptyOutput.push(options.requireEmptyOutput === true);
      this.injectionSnapshots.push(Buffer.from(options.stdinBytes));
      return this.injectionOutput;
    }
    throw new Error(`unexpected command: ${command}`);
  }
}

function runMobileInputScript(script: string, input: string, inputStatus: number): number {
  const result = spawnSync(
    '/bin/sh',
    ['-c', `input() { return "\${INPUT_STATUS}"; }; ${script}`],
    {
      encoding: 'utf8',
      env: { INPUT_STATUS: String(inputStatus), PATH: '/usr/bin:/bin' },
      input,
    },
  );
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
  return result.status ?? -1;
}
