import { describe, expect, it, vi } from 'vitest';
import {
  Da5V5ApiOfflineController,
  Da5V5DeviceCheckpointController,
  Da5V5UsbDeviceLock,
  SystemDa5V5AdbCommandRunner,
  type Da5V5AdbCommandRunner,
} from '../src/index.js';

describe('DA5 V5 synchronous ADB child-process boundary', () => {
  it('uses the same minimal environment and explicit loopback routing as mutations', () => {
    let observedArguments: readonly string[] = [];
    let observedEnvironment: Readonly<Record<string, string | undefined>> = {};
    let spawnCount = 0;
    const spawnCommand = (
      _command: string,
      arguments_: readonly string[],
      options: { readonly env?: Readonly<Record<string, string | undefined>> },
    ) => {
      spawnCount += 1;
      observedArguments = arguments_;
      observedEnvironment = options.env ?? {};
      return {
        error: undefined,
        status: 0,
        stdout: 'List of devices attached\n',
      };
    };
    const runner = new SystemDa5V5AdbCommandRunner({
      environment: {
        AWS_SECRET_ACCESS_KEY: 'must-not-cross',
        DATABASE_URL: 'postgresql://secret',
        HOME: '/private/home',
        PATH: '/safe/bin',
        TAPTIME_SYNTHETIC_E2E_PASSWORD: 'must-not-cross',
      },
      spawnSync: spawnCommand as never,
    });

    expect(runner.run(['devices', '-l'])).toBe('List of devices attached\n');
    expect(spawnCount).toBe(1);
    expect(observedArguments).toEqual([
      '-H',
      '127.0.0.1',
      '-P',
      '5037',
      'devices',
      '-l',
    ]);
    expect(observedEnvironment).toEqual({
      ADB_SERVER_SOCKET: 'tcp:127.0.0.1:5037',
      PATH: '/safe/bin',
    });
  });

  it.each([
    'ADB_SERVER_SOCKET',
    'ADB_VENDOR_KEYS',
    'ADB_MDNS_AUTO_CONNECT',
    'ANDROID_ADB_SERVER_ADDRESS',
    'ANDROID_ADB_SERVER_PORT',
    'ANDROID_SERIAL',
  ])('rejects hostile %s routing input before synchronous spawn', (name) => {
    let spawnCount = 0;
    const spawnCommand = () => {
      spawnCount += 1;
      return {
        error: undefined,
        status: 0,
        stdout: '',
      };
    };
    const runner = new SystemDa5V5AdbCommandRunner({
      environment: {
        [name]: 'hostile',
        PATH: '/safe/bin',
      },
      spawnSync: spawnCommand as never,
    });

    expect(() => runner.run(['devices', '-l'])).toThrow(
      /routing environment override is forbidden/,
    );
    expect(spawnCount).toBe(0);
  });
});

describe('DA5 V5 controlled API-offline ownership', () => {
  it('owns only the API mapping for exactly two cycles', async () => {
    const adb = directAdb();
    const controller = offlineController(adb);
    expect(controller.arm()).toBe('match');
    expect(controller.cleanupProofState()).toBe('known');

    for (const [index, phase] of (['ordinary', 'protected'] as const).entries()) {
      expect(await controller.enterOffline(phase)).toBe('match');
      expect(controller.cleanupProofState()).toBe('known');
      expect(adb.mappings).toEqual(new Map([
        ['tcp:54321', 'tcp:54321'],
      ]));
      expect(controller.getState()).toEqual({
        completedCycles: index,
        state: `offline-${phase}`,
      });
      expect(await controller.restoreDirect(phase)).toBe('match');
      expect(controller.cleanupProofState()).toBe('known');
    }

    expect(controller.complete()).toBe('match');
    expect(await controller.close()).toBe('match');
    expect(controller.getState()).toEqual({ completedCycles: 2, state: 'closed' });
    expect(controller.cleanupProofState()).toBe('known');
    expect(adb.mappings.get('tcp:54321')).toBe('tcp:54321');
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
    expect(adb.commands.some((command) => command.includes('--remove-all'))).toBe(false);
    expect(JSON.stringify(controller.getState())).not.toContain(adb.serial);
  });

  it('rejects repeated, out-of-order and third-cycle operations with a permanent latch',
    async () => {
    const outOfOrder = offlineController(directAdb());
    expect(outOfOrder.arm()).toBe('match');
    expect(await outOfOrder.restoreDirect('ordinary')).toBe('mismatch');
    expect(await outOfOrder.enterOffline('ordinary')).toBe('mismatch');
    expect(outOfOrder.getState().state).toBe('failed');

    const third = offlineController(directAdb());
    expect(third.arm()).toBe('match');
    expect(await third.enterOffline('ordinary')).toBe('match');
    expect(await third.restoreDirect('ordinary')).toBe('match');
    expect(await third.enterOffline('protected')).toBe('match');
    expect(await third.restoreDirect('protected')).toBe('match');
    expect(await third.enterOffline('protected')).toBe('mismatch');
    expect(third.getState().state).toBe('failed');
  });

  it('fails closed for unauthorized transports and unexpected owned mappings', async () => {
    for (const devices of [
      [] as FakeAdb['devices'],
      [
        { details: 'usb:a', serial: 'one', state: 'device' },
        { details: 'usb:b', serial: 'two', state: 'device' },
      ],
      [{ details: 'usb:a', serial: 'one', state: 'unauthorized' }],
      [{ details: 'product:a', serial: '192.0.2.5:5555', state: 'device' }],
      [{ details: 'usb:a', serial: 'emulator-5554', state: 'device' }],
    ]) {
      const adb = directAdb();
      adb.devices = devices;
      const before = new Map(adb.mappings);
      const controller = offlineController(adb);
      expect(controller.arm()).toBe('mismatch');
      expect(await controller.enterOffline('ordinary')).toBe('mismatch');
      expect(adb.mappings).toEqual(before);
      expect(controller.getState().state).toBe('failed');
    }

    const unexpected = directAdb();
    unexpected.mappings.set('tcp:3000', 'tcp:3999');
    const controller = offlineController(unexpected);
    expect(controller.arm()).toBe('mismatch');
    expect(await controller.enterOffline('ordinary')).toBe('mismatch');
    expect(unexpected.mappings.get('tcp:3000')).toBe('tcp:3999');

    const extra = directAdb();
    extra.mappings.set('tcp:9911', 'tcp:9922');
    const extraController = offlineController(extra);
    expect(extraController.arm()).toBe('mismatch');
    expect(await extraController.enterOffline('ordinary')).toBe('mismatch');
    expect(extra.mappings.get('tcp:9911')).toBe('tcp:9922');
    expect(extra.commands.some((command) => command.includes('--remove'))).toBe(false);
  });

  it('fails closed before mutation for malformed, non-TCP, or foreign-serial mappings',
    async () => {
    for (const unexpectedLine of [
      'malformed',
      'synthetic-device localabstract:unexpected tcp:3000',
      'replacement-device tcp:9911 tcp:9922',
    ]) {
      const adb = directAdb();
      adb.rawReverseLines = [unexpectedLine];
      const before = new Map(adb.mappings);
      const controller = offlineController(adb);
      expect(controller.arm()).toBe('mismatch');
      expect(await controller.enterOffline('ordinary')).toBe('mismatch');
      expect(adb.mappings).toEqual(before);
      expect(adb.commands.some((command) => command.includes('--remove'))).toBe(false);
    }
  });

  it('rejects an otherwise identical USB-device swap across controller boundaries', async () => {
    const adb = directAdb();
    const lock = new Da5V5UsbDeviceLock();
    const device = new Da5V5DeviceCheckpointController(adb, {
      androidBuild: adb.androidBuild,
      deviceModel: adb.deviceModel,
      fontScale: '2.0',
      talkBackVersion: adb.talkBackVersion,
    }, lock);
    const offline = new Da5V5ApiOfflineController(adb, {
      androidBuild: adb.androidBuild,
      deviceModel: adb.deviceModel,
    }, lock);
    expect(device.prepareColdDispatch()).toBe('match');
    expect(offline.arm()).toBe('match');
    adb.serial = 'replacement-device';
    adb.devices = [{
      details: 'usb:replacement product:synthetic model:synthetic transport_id:2',
      serial: adb.serial,
      state: 'device',
    }];
    const mappingsBefore = new Map(adb.mappings);
    expect(await offline.enterOffline('ordinary')).toBe('mismatch');
    expect(adb.mappings).toEqual(mappingsBefore);
    expect(lock.state()).toBe('failed');
  });

  it('restores the exact direct API mapping during cleanup after a post-remove failure',
    async () => {
    const adb = directAdb();
    adb.failOnce = (arguments_) => (
      arguments_.join(' ') === `-s ${adb.serial} reverse --list`
      && !adb.mappings.has('tcp:3000')
    );
    const controller = offlineController(adb);
    expect(controller.arm()).toBe('match');

    expect(await controller.enterOffline('ordinary')).toBe('mismatch');
    expect(adb.mappings.has('tcp:3000')).toBe(false);
    expect(await controller.close()).toBe('match');
    expect(controller.getState()).toEqual({ completedCycles: 0, state: 'closed' });
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
    expect(adb.mappings.get('tcp:54321')).toBe('tcp:54321');
    expect(controller.cleanupProofState()).toBe('uncertain');
    expect(adb.commands.some((command) => command.includes('--remove-all'))).toBe(false);
  });

  it('restores scoped API mapping after a signal aborts the reverse mutation', async () => {
    const adb = directAdb();
    const abort = new AbortController();
    adb.abortMutation = abort;
    const controller = new Da5V5ApiOfflineController(
      adb,
      {
        androidBuild: adb.androidBuild,
        deviceModel: adb.deviceModel,
      },
      new Da5V5UsbDeviceLock(),
      abort.signal,
    );

    expect(controller.arm()).toBe('match');
    expect(await controller.enterOffline('ordinary')).toBe('mismatch');
    expect(abort.signal.aborted).toBe(true);
    expect(controller.cleanupProofState()).toBe('uncertain');
    expect(adb.mappings.has('tcp:3000')).toBe(false);
    expect(await controller.close()).toBe('match');
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
    expect(controller.cleanupProofState()).toBe('uncertain');
  });

  it('keeps an aborted restore/add uncertain after compensation when its effect can appear late',
    async () => {
      const adb = directAdb();
      const abort = new AbortController();
      const controller = new Da5V5ApiOfflineController(
        adb,
        {
          androidBuild: adb.androidBuild,
          deviceModel: adb.deviceModel,
        },
        new Da5V5UsbDeviceLock(),
        abort.signal,
      );
      expect(controller.arm()).toBe('match');
      expect(await controller.enterOffline('ordinary')).toBe('match');
      expect(controller.cleanupProofState()).toBe('known');

      adb.delayNextApiReverseAdd = true;
      adb.abortMutation = abort;
      expect(await controller.restoreDirect('ordinary')).toBe('mismatch');
      expect(abort.signal.aborted).toBe(true);
      expect(adb.mappings.has('tcp:3000')).toBe(false);
      expect(controller.cleanupProofState()).toBe('uncertain');

      expect(await controller.close()).toBe('match');
      expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
      expect(controller.cleanupProofState()).toBe('uncertain');

      adb.run(['-s', adb.serial, 'reverse', '--remove', 'tcp:3000']);
      expect(adb.mappings.has('tcp:3000')).toBe(false);
      adb.releaseDelayedApiReverseAdd();
      expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
  });

  it('closes unarmed without assuming package or reverse mappings exist', async () => {
    const adb = new FakeAdb();
    adb.packageInstalled = false;
    const controller = offlineController(adb);
    const commandsBeforeClose = adb.commands.length;

    expect(controller.getState()).toEqual({ completedCycles: 0, state: 'unarmed' });
    expect(await controller.close()).toBe('match');
    expect(controller.getState()).toEqual({ completedCycles: 0, state: 'closed' });
    expect(adb.commands).toHaveLength(commandsBeforeClose);
  });

  it('arms only after the exact installed package and both mappings are proven', async () => {
    const missingPackage = directAdb();
    missingPackage.packageInstalled = false;
    const packageController = offlineController(missingPackage);
    expect(packageController.arm()).toBe('mismatch');
    const packageCommands = missingPackage.commands.length;
    expect(await packageController.close()).toBe('match');
    expect(missingPackage.commands).toHaveLength(packageCommands);

    const missingMapping = directAdb();
    missingMapping.mappings.delete('tcp:3000');
    const mappingController = offlineController(missingMapping);
    expect(mappingController.arm()).toBe('mismatch');
    const mappingCommands = missingMapping.commands.length;
    expect(await mappingController.close()).toBe('match');
    expect(missingMapping.commands).toHaveLength(mappingCommands);
  });
});

describe('DA5 V5 device-bound cancellation and accessibility checks', () => {
  it('matches exact build, TalkBack and 200-percent font scale without exposing a serial', () => {
    const adb = directAdb();
    const controller = new Da5V5DeviceCheckpointController(adb, {
      androidBuild: adb.androidBuild,
      deviceModel: adb.deviceModel,
      fontScale: '2.0',
      talkBackVersion: adb.talkBackVersion,
    });

    expect(controller.prepareColdDispatch()).toBe('match');
    expect(controller.verifyAccessibilityBinding()).toBe('match');
    expect(controller.getState()).toBe('accessibility-confirmed');
    expect(JSON.stringify(controller.getState())).not.toContain(adb.serial);
  });

  it('uses only am kill after confirmed Scan-abgebrochen UI and proves process absence', () => {
    const adb = directAdb();
    const controller = new Da5V5DeviceCheckpointController(adb, {
      androidBuild: adb.androidBuild,
      deviceModel: adb.deviceModel,
      fontScale: '2.0',
      talkBackVersion: adb.talkBackVersion,
    });

    expect(controller.prepareColdDispatch()).toBe('match');
    expect(controller.verifyAccessibilityBinding()).toBe('match');
    expect(controller.prepareOrdinaryPendingRelaunch()).toBe('match');
    expect(controller.armCancellation()).toBe('match');
    expect(controller.confirmCancelledUi('pass')).toBe('match');
    expect(controller.killBackgroundProcess()).toBe('match');
    expect(controller.confirmColdReady('pass')).toBe('match');
    expect(controller.getState()).toBe('cancellation-complete');
    expect(adb.commands).toContainEqual([
      '-s',
      adb.serial,
      'shell',
      'am',
      'kill',
      'com.tim180201.mobile.synthetic',
    ]);
    expect(adb.commands.flat().join(' ')).not.toMatch(/force-stop|pm clear|pidof/);
  });

  it('latches mismatched Human and device bindings before the kill command', () => {
    const adb = directAdb();
    const mismatch = new Da5V5DeviceCheckpointController(adb, {
      androidBuild: 'different-build',
      deviceModel: adb.deviceModel,
      fontScale: '2.0',
      talkBackVersion: adb.talkBackVersion,
    });
    expect(mismatch.prepareColdDispatch()).toBe('mismatch');
    expect(mismatch.verifyAccessibilityBinding()).toBe('mismatch');
    expect(mismatch.armCancellation()).toBe('mismatch');
    expect(adb.commands.flat().join(' ')).not.toContain(
      'shell am kill com.tim180201.mobile.synthetic',
    );

    const ambiguous = new Da5V5DeviceCheckpointController(adb, {
      androidBuild: adb.androidBuild,
      deviceModel: adb.deviceModel,
      fontScale: '2.0',
      talkBackVersion: adb.talkBackVersion,
    });
    expect(ambiguous.prepareColdDispatch()).toBe('match');
    expect(ambiguous.verifyAccessibilityBinding()).toBe('match');
    expect(ambiguous.prepareOrdinaryPendingRelaunch()).toBe('match');
    expect(ambiguous.armCancellation()).toBe('match');
    const killsBeforeAmbiguousConfirmation = adb.commands.filter(
      (command) => command.slice(2).join(' ') === (
        'shell am kill com.tim180201.mobile.synthetic'
      ),
    ).length;
    expect(ambiguous.confirmCancelledUi('ambiguous')).toBe('mismatch');
    expect(adb.commands.filter(
      (command) => command.slice(2).join(' ') === (
        'shell am kill com.tim180201.mobile.synthetic'
      ),
    )).toHaveLength(killsBeforeAmbiguousConfirmation);
  });

  it('treats package secondary processes as still running after a lifecycle kill', () => {
    const adb = directAdb();
    adb.extraProcessNames = ['com.tim180201.mobile.synthetic:secondary'];
    const controller = new Da5V5DeviceCheckpointController(adb, {
      androidBuild: adb.androidBuild,
      deviceModel: adb.deviceModel,
      fontScale: '2.0',
      talkBackVersion: adb.talkBackVersion,
    });

    expect(controller.prepareColdDispatch()).toBe('mismatch');
    expect(controller.getState()).toBe('failed');
  });

  it('uses am kill for cold/ordinary/cancellation and force-stop only for terminal relaunch',
    () => {
      const adb = directAdb();
      const controller = new Da5V5DeviceCheckpointController(adb, {
        androidBuild: adb.androidBuild,
        deviceModel: adb.deviceModel,
        fontScale: '2.0',
        talkBackVersion: adb.talkBackVersion,
      });
      expect(controller.prepareColdDispatch()).toBe('match');
      expect(controller.verifyAccessibilityBinding()).toBe('match');
      expect(controller.prepareOrdinaryPendingRelaunch()).toBe('match');
      expect(controller.armCancellation()).toBe('match');
      expect(controller.confirmCancelledUi('pass')).toBe('match');
      expect(controller.killBackgroundProcess()).toBe('match');
      expect(controller.confirmColdReady('pass')).toBe('match');
      expect(controller.prepareProtectedColdRelaunch()).toBe('match');
      expect(controller.confirmProtectedStateRetained('pass')).toBe('match');

      const lifecycleCommands = adb.commands
        .filter((command) => command.slice(2, 4).join(' ') === 'shell am')
        .map((command) => command.slice(2).join(' '));
      expect(lifecycleCommands).toEqual([
        'shell am kill com.tim180201.mobile.synthetic',
        'shell am kill com.tim180201.mobile.synthetic',
        'shell am kill com.tim180201.mobile.synthetic',
        'shell am force-stop com.tim180201.mobile.synthetic',
      ]);
      expect(adb.commands.flat().join(' ')).not.toMatch(/pm clear|pidof/);
    });
});

class FakeAdb implements Da5V5AdbCommandRunner {
  abortMutation: AbortController | null = null;
  androidBuild = 'synthetic/vendor/device:15/BUILD/1:user/release-keys';
  commands: string[][] = [];
  delayNextApiReverseAdd = false;
  delayedApiReverseAdd = false;
  deviceModel = 'Synthetic Galaxy';
  devices = [{
    details: 'usb:synthetic product:synthetic model:synthetic transport_id:1',
    serial: 'synthetic-device',
    state: 'device',
  }];
  extraProcessNames: string[] = [];
  failOnce: ((arguments_: readonly string[]) => boolean) | null = null;
  mappings = new Map<string, string>();
  packageInstalled = true;
  processRunning = true;
  rawReverseLines: string[] = [];
  serial = 'synthetic-device';
  talkBackVersion = '15.1.0';

  run(arguments_: readonly string[]): string {
    this.commands.push([...arguments_]);
    if (this.failOnce?.(arguments_) === true) {
      this.failOnce = null;
      throw new Error('fake adb failure');
    }
    if (arguments_.join(' ') === 'devices -l') {
      return [
        'List of devices attached',
        ...this.devices.map((device) => (
          `${device.serial}\t${device.state}${device.details === '' ? '' : ` ${device.details}`}`
        )),
        '',
      ].join('\n');
    }
    const serial = arguments_[1];
    if (arguments_[0] !== '-s' || serial !== this.serial) {
      throw new Error('unexpected fake device');
    }
    const command = arguments_.slice(2);
    if (command.join(' ') === 'reverse --list') {
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
      if (command[1] === 'tcp:3000' && this.delayNextApiReverseAdd) {
        this.delayNextApiReverseAdd = false;
        this.delayedApiReverseAdd = true;
        return '';
      }
      this.mappings.set(command[1] as string, command[2] as string);
      return '';
    }
    if (command.join(' ') === 'shell getprop ro.product.model') {
      return `${this.deviceModel}\n`;
    }
    if (command.join(' ') === 'shell getprop ro.build.fingerprint') {
      return `${this.androidBuild}\n`;
    }
    if (command.join(' ') === 'shell settings get system font_scale') {
      return '2.0\n';
    }
    if (command.join(' ') === 'shell dumpsys package com.google.android.marvin.talkback') {
      return `Packages:\n  versionName=${this.talkBackVersion}\n`;
    }
    if (command.join(' ') === 'shell pm path com.tim180201.mobile.synthetic') {
      return this.packageInstalled
        ? 'package:/data/app/synthetic/base.apk\n'
        : '';
    }
    if (
      command.join(' ') === 'shell am kill com.tim180201.mobile.synthetic'
      || command.join(' ') === 'shell am force-stop com.tim180201.mobile.synthetic'
    ) {
      this.processRunning = false;
      return '';
    }
    if (command.join(' ') === 'shell ps -A -o NAME') {
      const processNames = [
        'NAME',
        'init',
        ...(this.processRunning ? ['com.tim180201.mobile.synthetic'] : []),
        ...this.extraProcessNames,
      ];
      return `${processNames.join('\n')}\n`;
    }
    throw new Error(`unexpected fake adb command: ${command.join(' ')}`);
  }

  async runMutation(arguments_: readonly string[], signal?: AbortSignal): Promise<string> {
    if (signal?.aborted === true) {
      throw new Error('fake adb mutation aborted');
    }
    const result = this.run(arguments_);
    if (this.abortMutation !== null) {
      this.abortMutation.abort();
      this.abortMutation = null;
      throw new Error('fake adb mutation aborted');
    }
    return result;
  }

  releaseDelayedApiReverseAdd(): void {
    if (!this.delayedApiReverseAdd) {
      throw new Error('fake delayed API reverse add is unavailable');
    }
    this.delayedApiReverseAdd = false;
    this.mappings.set('tcp:3000', 'tcp:3000');
  }
}

function directAdb(): FakeAdb {
  const adb = new FakeAdb();
  adb.mappings.set('tcp:54321', 'tcp:54321');
  adb.mappings.set('tcp:3000', 'tcp:3000');
  return adb;
}

function offlineController(adb: FakeAdb): Da5V5ApiOfflineController {
  return new Da5V5ApiOfflineController(adb, {
    androidBuild: adb.androidBuild,
    deviceModel: adb.deviceModel,
  });
}
