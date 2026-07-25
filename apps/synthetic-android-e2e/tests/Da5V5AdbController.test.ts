import { describe, expect, it } from 'vitest';
import {
  Da5V5ApiOfflineController,
  Da5V5DeviceCheckpointController,
  Da5V5UsbDeviceLock,
  type Da5V5AdbCommandRunner,
} from '../src/index.js';

describe('DA5 V5 controlled API-offline ownership', () => {
  it('owns only the API mapping for exactly two cycles', async () => {
    const adb = directAdb();
    const controller = offlineController(adb);

    for (const [index, phase] of (['ordinary', 'protected'] as const).entries()) {
      expect(await controller.enterOffline(phase)).toBe('match');
      expect(adb.mappings).toEqual(new Map([
        ['tcp:54321', 'tcp:54321'],
      ]));
      expect(controller.getState()).toEqual({
        completedCycles: index,
        state: `offline-${phase}`,
      });
      expect(await controller.restoreDirect(phase)).toBe('match');
    }

    expect(controller.complete()).toBe('match');
    expect(await controller.close()).toBe('match');
    expect(controller.getState()).toEqual({ completedCycles: 2, state: 'closed' });
    expect(adb.mappings.get('tcp:54321')).toBe('tcp:54321');
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
    expect(adb.commands.some((command) => command.includes('--remove-all'))).toBe(false);
    expect(JSON.stringify(controller.getState())).not.toContain(adb.serial);
  });

  it('rejects repeated, out-of-order and third-cycle operations with a permanent latch',
    async () => {
    const outOfOrder = offlineController(directAdb());
    expect(await outOfOrder.restoreDirect('ordinary')).toBe('mismatch');
    expect(await outOfOrder.enterOffline('ordinary')).toBe('mismatch');
    expect(outOfOrder.getState().state).toBe('failed');

    const third = offlineController(directAdb());
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
      expect(await controller.enterOffline('ordinary')).toBe('mismatch');
      expect(adb.mappings).toEqual(before);
      expect(controller.getState().state).toBe('failed');
    }

    const unexpected = directAdb();
    unexpected.mappings.set('tcp:3000', 'tcp:3999');
    const controller = offlineController(unexpected);
    expect(await controller.enterOffline('ordinary')).toBe('mismatch');
    expect(unexpected.mappings.get('tcp:3000')).toBe('tcp:3999');

    const extra = directAdb();
    extra.mappings.set('tcp:9911', 'tcp:9922');
    const extraController = offlineController(extra);
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

    expect(await controller.enterOffline('ordinary')).toBe('mismatch');
    expect(adb.mappings.has('tcp:3000')).toBe(false);
    expect(await controller.close()).toBe('match');
    expect(controller.getState()).toEqual({ completedCycles: 0, state: 'closed' });
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
    expect(adb.mappings.get('tcp:54321')).toBe('tcp:54321');
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

    expect(await controller.enterOffline('ordinary')).toBe('mismatch');
    expect(abort.signal.aborted).toBe(true);
    expect(adb.mappings.has('tcp:3000')).toBe(false);
    expect(await controller.close()).toBe('match');
    expect(adb.mappings.get('tcp:3000')).toBe('tcp:3000');
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
