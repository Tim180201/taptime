import { describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_ANDROID_ARTIFACT,
  DA5_V5_ANDROID_PACKAGE,
} from '../../scripts/da5V5AndroidArtifact.mjs';
import {
  assertDa5V5PackageMappingZero,
  cleanupDa5V5AndroidState,
  Da5V5AndroidPreinstallPreflight,
  Da5V5UsbSerialBinding,
  installDa5V5AndroidFromPackageZero,
  parseDa5V5ReverseMappings,
  requireSingleDa5V5UsbDevice,
  type Da5V5AndroidAdbRunner,
} from '../../scripts/da5V5AndroidDevice.mjs';

const deviceBinding = Object.freeze({
  androidBuild: 'synthetic/vendor/device:15/BUILD/1:user/release-keys',
  deviceModel: 'Synthetic Galaxy',
});

describe('DA5 V5 package-zero Android install', () => {
  it('checks the exact profile and immutable artifact before the first ADB call', async () => {
    for (const profile of [undefined, 'default', 'da4-v5']) {
      const adb = new FakeAdb();
      const verifyArtifact = vi.fn();
      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        profile,
        runner: adb,
        reverifyArtifact: vi.fn(),
        serialBinding: boundSerial(adb),
        verifyArtifact,
      })).rejects.toThrow(/exact explicit profile/);
      expect(verifyArtifact).not.toHaveBeenCalled();
      expect(adb.commands).toEqual([]);
    }

    const adb = new FakeAdb();
    const verifyArtifact = vi.fn(() => {
      throw new Error('immutable mismatch');
    });
    await expect(installDa5V5AndroidFromPackageZero({
      deviceBinding,
      profile: 'da5-v5',
      runner: adb,
      serialBinding: boundSerial(adb),
      verifyArtifact,
    })).rejects.toThrow('immutable mismatch');
    expect(adb.commands).toEqual([]);
  });

  it('installs the exact external APK without -r from a strict package/mapping zero state',
    async () => {
      const adb = new FakeAdb();
      const verifyArtifact = vi.fn();
      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        profile: 'da5-v5',
        runner: adb,
        reverifyArtifact: vi.fn(),
        serialBinding: boundSerial(adb),
        verifyArtifact,
      })).resolves.toEqual({
        packageName: DA5_V5_ANDROID_PACKAGE,
        status: 'match',
      });

      expect(verifyArtifact).toHaveBeenCalledTimes(1);
      expect(adb.packageInstalled).toBe(true);
      expect(adb.mappings).toEqual(new Map([
        ['tcp:54321', 'tcp:54321'],
        ['tcp:3000', 'tcp:3000'],
      ]));
      expect(adb.commands).toContainEqual([
        '-s',
        adb.serial,
        'install',
        DA5_V5_ANDROID_ARTIFACT.apk.path,
      ]);
      expect(adb.commands.flat()).not.toContain('-r');
      assertNoBroadDeviceMutation(adb);
    });

  it('rejects absent, multiple, unauthorized, network and emulator transports', async () => {
    for (const devices of [
      [] as FakeAdb['devices'],
      [
        { details: 'usb:a', serial: 'one', state: 'device' },
        { details: 'usb:b', serial: 'two', state: 'device' },
      ],
      [{ details: 'usb:a', serial: 'one', state: 'unauthorized' }],
      [{ details: 'product:a', serial: '192.0.2.1:5555', state: 'device' }],
      [{ details: 'usb:a', serial: 'emulator-5554', state: 'device' }],
    ]) {
      const adb = new FakeAdb();
      adb.devices = devices;
      await expect(install(adb)).rejects.toThrow('DA5 V5 Android install failed');
      expect(adb.packageInstalled).toBe(false);
      expect(adb.mappings.size).toBe(0);
    }
  });

  it('rejects a retained package or any retained mapping before mutation', async () => {
    const retainedPackage = new FakeAdb();
    retainedPackage.packageInstalled = true;
    await expect(install(retainedPackage)).rejects.toThrow('DA5 V5 Android install failed');
    expect(retainedPackage.commands.flat()).not.toContain('install');
    expect(retainedPackage.packageInstalled).toBe(true);

    const retainedMapping = new FakeAdb();
    retainedMapping.mappings.set('tcp:9999', 'tcp:9998');
    await expect(install(retainedMapping)).rejects.toThrow('DA5 V5 Android install failed');
    expect(retainedMapping.mappings.get('tcp:9999')).toBe('tcp:9998');
    expect(retainedMapping.commands.flat()).not.toContain('install');

    const malformedMapping = new FakeAdb();
    malformedMapping.rawReverseLines = ['synthetic-device localabstract:unexpected tcp:3000'];
    await expect(install(malformedMapping)).rejects.toThrow('DA5 V5 Android install failed');
    expect(malformedMapping.commands.flat()).not.toContain('install');
    expect(malformedMapping.mappings.size).toBe(0);
  });

  it.each([
    'first-mapping',
    'second-mapping',
    'install',
    'post-install-check',
  ] as const)('rolls back exact owned state after %s failure', async (failure) => {
    const adb = new FakeAdb();
    let packageChecks = 0;
    adb.failOnce = (arguments_) => {
      const command = arguments_.slice(2).join(' ');
      if (failure === 'first-mapping') {
        return command === 'reverse tcp:54321 tcp:54321';
      }
      if (failure === 'second-mapping') {
        return command === 'reverse tcp:3000 tcp:3000';
      }
      if (failure === 'install') {
        return command === `install ${DA5_V5_ANDROID_ARTIFACT.apk.path}`;
      }
      if (command === `shell pm path ${DA5_V5_ANDROID_PACKAGE}`) {
        packageChecks += 1;
        return packageChecks === 3;
      }
      return false;
    };

    await expect(install(adb)).rejects.toThrow('DA5 V5 Android install failed');
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
    assertNoBroadDeviceMutation(adb);
  });
});

describe('DA5 V5 read-only device preinstall preflight', () => {
  it('single-use binds exact OS/API/build/accessibility and proves owned residue zero',
    async () => {
      const adb = new FakeAdb();
      const preflight = new Da5V5AndroidPreinstallPreflight(
        adb,
        new Da5V5UsbSerialBinding(),
        {
          ...deviceBinding,
          androidApi: '35',
          androidRelease: '15',
          fontScale: '2.0',
          talkBackVersion: '15.1.0',
        },
      );
      await expect(preflight.run()).resolves.toEqual({ status: 'match' });
      expect(preflight.state()).toBe('matched');
      await expect(preflight.run()).resolves.toEqual({ status: 'mismatch' });
      expect(preflight.state()).toBe('failed');
      expect(adb.commands.flat().join(' ')).not.toMatch(
        /\b(?:install|uninstall|reverse tcp:|--remove)\b/u,
      );
    });

  it('fails closed for listener residue before any installation mutation', async () => {
    const adb = new FakeAdb();
    adb.listeners = 'LISTEN 0 50 127.0.0.1:3000 0.0.0.0:*\n';
    const preflight = new Da5V5AndroidPreinstallPreflight(
      adb,
      new Da5V5UsbSerialBinding(),
      {
        ...deviceBinding,
        androidApi: '35',
        androidRelease: '15',
        fontScale: '2.0',
        talkBackVersion: '15.1.0',
      },
    );
    await expect(preflight.run()).resolves.toEqual({ status: 'mismatch' });
    expect(adb.commands.flat()).not.toContain('install');
  });
});

describe('DA5 V5 scoped Android cleanup', () => {
  it('cleans full, partial and already-null states idempotently', async () => {
    for (const state of ['full', 'partial-auth', 'partial-api', 'package-only', 'null'] as const) {
      const adb = new FakeAdb();
      if (state === 'full' || state === 'partial-auth') {
        adb.mappings.set('tcp:54321', 'tcp:54321');
      }
      if (state === 'full' || state === 'partial-api') {
        adb.mappings.set('tcp:3000', 'tcp:3000');
      }
      adb.packageInstalled = state === 'full' || state === 'package-only';

      await expect(cleanup(adb)).resolves.toEqual({ status: 'match' });
      await expect(cleanup(adb)).resolves.toEqual({ status: 'match' });
      expect(adb.packageInstalled).toBe(false);
      expect(adb.mappings).toEqual(new Map());
      assertNoBroadDeviceMutation(adb);
    }
  });

  it('preserves unrelated mappings and fails closed without overwriting an owned-port mismatch',
    async () => {
      const unrelated = new FakeAdb();
      unrelated.packageInstalled = true;
      unrelated.mappings.set('tcp:9999', 'tcp:9998');
      unrelated.mappings.set('tcp:54321', 'tcp:54321');
      await expect(cleanup(unrelated)).resolves.toEqual({ status: 'match' });
      expect(unrelated.mappings).toEqual(new Map([['tcp:9999', 'tcp:9998']]));
      expect(unrelated.packageInstalled).toBe(false);

      const mismatch = new FakeAdb();
      mismatch.packageInstalled = true;
      mismatch.mappings.set('tcp:54321', 'tcp:3999');
      mismatch.mappings.set('tcp:3000', 'tcp:3000');
      await expect(cleanup(mismatch)).resolves.toEqual({ status: 'mismatch' });
      expect(mismatch.mappings.get('tcp:54321')).toBe('tcp:3999');
      expect(mismatch.mappings.has('tcp:3000')).toBe(false);
      expect(mismatch.packageInstalled).toBe(false);
      assertNoBroadDeviceMutation(mismatch);
    });

  it('coalesces concurrent cleanup and never exposes the internally retained serial', async () => {
    const adb = new FakeAdb();
    adb.packageInstalled = true;
    adb.mappings.set('tcp:54321', 'tcp:54321');
    adb.mappings.set('tcp:3000', 'tcp:3000');
    const first = cleanup(adb);
    const second = cleanup(adb);
    expect(first).toBe(second);
    await expect(first).resolves.toEqual({ status: 'match' });
    expect(adb.commands.filter((command) => command.includes('uninstall'))).toHaveLength(1);
    expect(JSON.stringify(await first)).not.toContain(adb.serial);
  });

  it('fails closed instead of coalescing an uncertain-install cleanup into a weaker flight',
    async () => {
      const adb = new FakeAdb();
      const serialBinding = boundSerial(adb);
      const ordinary = cleanupDa5V5AndroidState({
        deviceBinding,
        profile: 'da5-v5',
        runner: adb,
        serialBinding,
        wait: async () => undefined,
      });
      const uncertain = cleanupDa5V5AndroidState({
        deviceBinding,
        installationState: 'uncertain',
        profile: 'da5-v5',
        runner: adb,
        serialBinding,
        ...virtualTiming(adb),
      });

      await expect(ordinary).resolves.toEqual({ status: 'match' });
      await expect(uncertain).resolves.toEqual({ status: 'mismatch' });
    });

  it('parses last-two-column reverse output and requires a true zero state', async () => {
    expect(parseDa5V5ReverseMappings(
      'serial tcp:54321 tcp:54321\nserial tcp:3000 tcp:3000\n',
      'serial',
    )).toEqual([
      { device: 'tcp:54321', host: 'tcp:54321' },
      { device: 'tcp:3000', host: 'tcp:3000' },
    ]);
    for (const value of [
      'malformed\n',
      'serial localabstract:unexpected tcp:3000\n',
      'different-serial tcp:54321 tcp:54321\n',
      'serial tcp:0 tcp:3000\n',
      'serial tcp:65536 tcp:3000\n',
    ]) {
      expect(() => parseDa5V5ReverseMappings(value, 'serial')).toThrow(
        /malformed or unexpected/,
      );
    }
    const adb = new FakeAdb();
    const serial = await requireSingleDa5V5UsbDevice(adb);
    await expect(assertDa5V5PackageMappingZero(adb, serial)).resolves.toEqual({
      status: 'match',
    });
    adb.mappings.set('tcp:9999', 'tcp:9998');
    await expect(assertDa5V5PackageMappingZero(adb, serial)).rejects.toThrow(/zero state/);
  });

  it('never mutates an identical replacement serial during rollback or cleanup', async () => {
    const adb = new FakeAdb();
    const serialBinding = new Da5V5UsbSerialBinding();
    expect(serialBinding.bind(adb.serial)).toBe('match');
    adb.packageInstalled = true;
    adb.mappings.set('tcp:54321', 'tcp:54321');
    adb.replaceDevice('replacement-device');

    await expect(cleanupDa5V5AndroidState({
      deviceBinding,
      profile: 'da5-v5',
      runner: adb,
      serialBinding,
      wait: async () => undefined,
    })).resolves.toEqual({ status: 'mismatch' });

    expect(adb.commands.filter((command) => (
      command[0] === '-s' && command[1] === 'replacement-device'
    )).map((command) => command.slice(2).join(' '))).not.toContain(
      `uninstall ${DA5_V5_ANDROID_PACKAGE}`,
    );
    expect(adb.packageInstalled).toBe(true);
    expect(adb.mappings.get('tcp:54321')).toBe('tcp:54321');
  });

  it('refuses retained serial use after a continuity mismatch has latched', () => {
    const serialBinding = new Da5V5UsbSerialBinding();
    expect(serialBinding.bind('original-device')).toBe('match');
    expect(serialBinding.bind('replacement-device')).toBe('mismatch');
    const operation = vi.fn();

    expect(() => serialBinding.useRetained(operation)).toThrow(
      /USB device is unbound/,
    );
    expect(operation).not.toHaveBeenCalled();
  });

  it('uses operation-specific install timeout and rolls back after abort', async () => {
    const adb = new FakeAdb();
    adb.failOnce = (arguments_) => (
      arguments_.slice(2).join(' ') === `install ${DA5_V5_ANDROID_ARTIFACT.apk.path}`
    );
    await expect(install(adb)).rejects.toThrow(/install failed/);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
    const installCommand = adb.commandOptions.find(({ arguments_ }) => (
      arguments_.slice(2).join(' ') === `install ${DA5_V5_ANDROID_ARTIFACT.apk.path}`
    ));
    expect(installCommand?.timeoutMilliseconds).toBeGreaterThan(10_000);
  });

  it('runs scoped cleanup after a signal aborts an already-started install mutation',
    async () => {
      const adb = new FakeAdb();
      const abort = new AbortController();
      adb.abortInstall = abort;
      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(),
        runner: adb,
        serialBinding: boundSerial(adb),
        signal: abort.signal,
        verifyArtifact: vi.fn(),
        ...virtualTiming(adb),
      })).rejects.toThrow(/install failed/);
      expect(abort.signal.aborted).toBe(true);
      expect(adb.mappings).toEqual(new Map());
      expect(adb.packageInstalled).toBe(false);
    });

  it('restarts a 15-second null window for residue appearing five seconds after install failure',
    async () => {
      const adb = new FakeAdb();
      adb.failOnce = (arguments_) => (
        arguments_.slice(2).join(' ') === `install ${DA5_V5_ANDROID_ARTIFACT.apk.path}`
      );
      adb.lateOwnedMappingVisibilityAtMilliseconds = [5_000];
      adb.latePackageVisibilityAtMilliseconds = [5_000];

      await expect(install(adb)).rejects.toThrow(/install failed/);

      expect(adb.elapsedMilliseconds).toBeGreaterThanOrEqual(20_000);
      expect(adb.packageInstalled).toBe(false);
      expect(adb.commands.filter((command) => (
        command.slice(2).join(' ') === `uninstall ${DA5_V5_ANDROID_PACKAGE}`
      ))).toHaveLength(1);
      expect(adb.commands.filter((command) => (
        command.slice(2).join(' ') === 'reverse --remove tcp:3000'
      ))).toHaveLength(2);
      expect(adb.mappings).toEqual(new Map());
    });

  it('fails closed within 60 seconds when late install residue prevents a 15-second null window',
    async () => {
    const adb = new FakeAdb();
    adb.failOnce = (arguments_) => (
      arguments_.slice(2).join(' ') === `install ${DA5_V5_ANDROID_ARTIFACT.apk.path}`
    );
    adb.latePackageVisibilityAtMilliseconds = [5_000, 19_000, 33_000, 47_000];

    await expect(install(adb)).rejects.toThrow(/install rollback failed/);

    expect(adb.elapsedMilliseconds).toBe(60_000);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.commands.filter((command) => (
      command.slice(2).join(' ') === `uninstall ${DA5_V5_ANDROID_PACKAGE}`
    ))).toHaveLength(4);
    expect(adb.mappings).toEqual(new Map());
  });
});

class FakeAdb implements Da5V5AndroidAdbRunner {
  abortInstall: AbortController | null = null;
  readonly androidBuild = deviceBinding.androidBuild;
  commands: string[][] = [];
  readonly deviceModel = deviceBinding.deviceModel;
  devices = [{
    details: 'usb:synthetic product:synthetic model:synthetic transport_id:1',
    serial: 'synthetic-device',
    state: 'device',
  }];
  failOnce: ((arguments_: readonly string[]) => boolean) | null = null;
  elapsedMilliseconds = 0;
  lateOwnedMappingVisibilityAtMilliseconds: number[] = [];
  latePackageVisibilityAtMilliseconds: number[] = [];
  mappings = new Map<string, string>();
  listeners = '';
  packageInstalled = false;
  packagePathChecks = 0;
  rawReverseLines: string[] = [];
  serial = 'synthetic-device';
  commandOptions: Array<{
    arguments_: readonly string[];
    signal?: AbortSignal;
    timeoutMilliseconds?: number;
  }> = [];

  async run(
    arguments_: readonly string[],
    options: { signal?: AbortSignal; timeoutMilliseconds?: number } = {},
  ): Promise<string> {
    this.commands.push([...arguments_]);
    this.commandOptions.push({ arguments_: [...arguments_], ...options });
    if (options.signal?.aborted === true) {
      throw new Error('fake adb aborted');
    }
    if (this.failOnce?.(arguments_) === true) {
      this.failOnce = null;
      throw new Error('fake adb failure');
    }
    if (arguments_.join(' ') === 'devices -l') {
      return [
        'List of devices attached',
        ...this.devices.map((device) => (
          `${device.serial}\t${device.state}${device.details.length === 0
            ? ''
            : ` ${device.details}`}`
        )),
        '',
      ].join('\n');
    }
    const serial = arguments_[1];
    if (arguments_[0] !== '-s' || serial !== this.serial) {
      throw new Error('unexpected fake device');
    }
    const command = arguments_.slice(2);
    const text = command.join(' ');
    if (text === 'shell getprop ro.product.model') return `${this.deviceModel}\n`;
    if (text === 'shell getprop ro.build.fingerprint') return `${this.androidBuild}\n`;
    if (text === 'shell getprop ro.build.version.release') return '15\n';
    if (text === 'shell getprop ro.build.version.sdk') return '35\n';
    if (text === 'shell settings get system font_scale') return '2.0\n';
    if (text === 'shell dumpsys package com.google.android.marvin.talkback') {
      return 'Packages:\n  versionName=15.1.0\n';
    }
    if (text === 'shell ss -ltnH') return this.listeners;
    if (text === 'reverse --list') {
      const lateVisibility = this.lateOwnedMappingVisibilityAtMilliseconds[0];
      if (lateVisibility !== undefined && this.elapsedMilliseconds >= lateVisibility) {
        this.mappings.set('tcp:3000', 'tcp:3000');
        this.lateOwnedMappingVisibilityAtMilliseconds.shift();
      }
      return [
        ...[...this.mappings].map(([device, host]) => (
          `${this.serial} ${device} ${host}`
        )),
        ...this.rawReverseLines,
      ].join('\n');
    }
    if (command[0] === 'reverse' && command[1] === '--remove') {
      this.mappings.delete(command[2] as string);
      return '';
    }
    if (command[0] === 'reverse' && command.length === 3) {
      this.mappings.set(command[1] as string, command[2] as string);
      return '';
    }
    if (text === `shell pm path ${DA5_V5_ANDROID_PACKAGE}`) {
      this.packagePathChecks += 1;
      const lateVisibility = this.latePackageVisibilityAtMilliseconds[0];
      if (lateVisibility !== undefined && this.elapsedMilliseconds >= lateVisibility) {
        this.packageInstalled = true;
        this.latePackageVisibilityAtMilliseconds.shift();
      }
      return this.packageInstalled ? 'package:/data/app/synthetic/base.apk\n' : '';
    }
    if (text === `install ${DA5_V5_ANDROID_ARTIFACT.apk.path}`) {
      if (this.abortInstall !== null) {
        this.abortInstall.abort();
        throw new Error('fake adb aborted during install');
      }
      this.packageInstalled = true;
      return 'Success\n';
    }
    if (text === `uninstall ${DA5_V5_ANDROID_PACKAGE}`) {
      this.packageInstalled = false;
      return 'Success\n';
    }
    throw new Error(`unexpected fake adb command: ${text}`);
  }

  replaceDevice(serial: string): void {
    this.serial = serial;
    this.devices = [{
      details: 'usb:replacement product:synthetic model:synthetic transport_id:2',
      serial,
      state: 'device',
    }];
  }
}

function install(adb: FakeAdb) {
  return installDa5V5AndroidFromPackageZero({
    deviceBinding,
    profile: 'da5-v5',
    runner: adb,
    reverifyArtifact: vi.fn(),
    serialBinding: boundSerial(adb),
    verifyArtifact: vi.fn(),
    ...virtualTiming(adb),
  });
}

function cleanup(adb: FakeAdb) {
  const serialBinding = boundSerial(adb);
  return cleanupDa5V5AndroidState({
    deviceBinding,
    profile: 'da5-v5',
    runner: adb,
    serialBinding,
    wait: async () => undefined,
  });
}

function boundSerial(adb: FakeAdb): Da5V5UsbSerialBinding {
  const serialBinding = new Da5V5UsbSerialBinding();
  expect(serialBinding.bind(adb.serial)).toBe('match');
  return serialBinding;
}

function virtualTiming(adb: FakeAdb): {
  readonly now: () => number;
  readonly wait: (milliseconds: number) => Promise<void>;
} {
  return {
    now: () => adb.elapsedMilliseconds,
    wait: async (milliseconds) => {
      adb.elapsedMilliseconds += milliseconds;
    },
  };
}

function assertNoBroadDeviceMutation(adb: FakeAdb): void {
  const commands = adb.commands.map((command) => command.join(' ')).join('\n');
  expect(commands).not.toMatch(/--remove-all|pm clear|factory|reset|backup|restore/);
  expect(commands).not.toMatch(/uninstall\s+(?!com\.tim180201\.mobile\.synthetic)/);
}
