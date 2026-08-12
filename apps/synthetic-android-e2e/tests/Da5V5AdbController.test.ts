import { describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_ANDROID_CLEANUP_SUBSTAGES,
  DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES,
  Da5V5AndroidInstallError,
} from '../../mobile/scripts/da5V5AndroidDevice.mjs';
import {
  Da5V5ApiOfflineController,
  Da5V5DeviceCheckpointController,
  Da5V5EmployeeInstallationTransition,
  Da5V5UsbDeviceLock,
  SystemDa5V5AdbCommandRunner,
  da5V5AndroidInstallFailureReceipt,
  type Da5V5AdbCommandRunner,
} from '../src/index.js';

const googleTalkBackPackage = 'com.google.android.marvin.talkback' as const;
const samsungTalkBackPackage = 'com.samsung.android.accessibility.talkback' as const;

describe('DA5 V5 Employee installation transition', () => {
  it('renders a typed replacement-install cleanup mismatch as one closed receipt', () => {
    const error = new Da5V5AndroidInstallError(
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.timeout,
      {
        status: 'mismatch',
        substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.packageUninstall,
      },
    );

    expect(da5V5AndroidInstallFailureReceipt(error)).toBe(
      'da5_v5_android_install=mismatch category=timeout cleanup_status=mismatch cleanup_substage=package_uninstall\n',
    );
  });

  it('runs the exact Human/pre/close/cleanup/install/post sequence once', async () => {
    const transition = new Da5V5EmployeeInstallationTransition();
    const calls: string[] = [];
    const aggregate = Object.freeze({ auditEvents: 2, workEvents: 0 });
    let preAggregate: typeof aggregate | null = null;

    await expect(transition.confirm('pass', {
      precheck: async () => {
        calls.push(`pre:${transition.getState().state}`);
        preAggregate = aggregate;
        return 'match';
      },
      closeOldOffline: async () => {
        calls.push(`offline:${transition.getState().state}`);
        return 'match';
      },
      cleanupOldInstallation: async () => {
        calls.push(`cleanup:${transition.getState().state}`);
        return 'match';
      },
      installReplacement: async () => {
        calls.push(`install:${transition.getState().state}`);
        return 'match';
      },
      postcheck: async () => {
        calls.push(`post:${transition.getState().state}`);
        return preAggregate === aggregate ? 'match' : 'mismatch';
      },
    })).resolves.toBe('match');

    expect(calls).toEqual([
      'pre:human-confirmed',
      'offline:prechecked',
      'cleanup:old-offline-closed',
      'install:old-installation-cleaned',
      'post:replacement-installed',
    ]);
    expect(transition.getState()).toEqual({ state: 'matched' });
    expect(transition.matched()).toBe(true);
  });

  it.each([
    'precheck',
    'closeOldOffline',
    'cleanupOldInstallation',
    'installReplacement',
    'postcheck',
  ] as const)('fails at %s without starting any following mutation', async (failingStage) => {
    const transition = new Da5V5EmployeeInstallationTransition();
    const calls: string[] = [];
    const stages = [
      'precheck',
      'closeOldOffline',
      'cleanupOldInstallation',
      'installReplacement',
      'postcheck',
    ] as const;
    const operation = (stage: (typeof stages)[number]) => async () => {
      calls.push(stage);
      return stage === failingStage ? 'mismatch' as const : 'match' as const;
    };

    await expect(transition.confirm('pass', {
      precheck: operation('precheck'),
      closeOldOffline: operation('closeOldOffline'),
      cleanupOldInstallation: operation('cleanupOldInstallation'),
      installReplacement: operation('installReplacement'),
      postcheck: operation('postcheck'),
    })).resolves.toBe('mismatch');

    expect(calls).toEqual(stages.slice(0, stages.indexOf(failingStage) + 1));
    expect(transition.getState()).toEqual({ state: 'failed' });
    expect(transition.matched()).toBe(false);
  });

  it('absorbs thrown stages and blocks every continuation or repeat', async () => {
    const transition = new Da5V5EmployeeInstallationTransition();
    const calls: string[] = [];
    const operations = employeeTransitionOperations(calls);
    operations.cleanupOldInstallation = async () => {
      calls.push('cleanupOldInstallation');
      throw new Error('private cleanup detail');
    };

    await expect(transition.confirm('pass', operations)).resolves.toBe('mismatch');
    await expect(transition.confirm('pass', employeeTransitionOperations(calls)))
      .resolves.toBe('mismatch');
    expect(calls).toEqual([
      'precheck',
      'closeOldOffline',
      'cleanupOldInstallation',
    ]);
    expect(transition.getState()).toEqual({ state: 'failed' });
  });

  it.each(['fail', 'ambiguous'] as const)(
    'rejects Human %s before precheck or mutation',
    async (verdict) => {
      const calls: string[] = [];
      const transition = new Da5V5EmployeeInstallationTransition();
      await expect(transition.confirm(verdict, employeeTransitionOperations(calls)))
        .resolves.toBe('mismatch');
      expect(calls).toEqual([]);
      expect(transition.getState()).toEqual({ state: 'failed' });
    },
  );

  it('keeps operational close strict when a previously required mapping is absent', async () => {
    const adb = directAdb();
    const controller = offlineController(adb);
    expect(controller.arm()).toBe('match');
    adb.mappings.delete('tcp:3000');
    const commandStart = adb.commands.length;

    await expect(controller.close()).resolves.toBe('mismatch');

    expect(controller.getState().state).toBe('failed');
    expect(adb.mappings).toEqual(new Map([['tcp:54321', 'tcp:54321']]));
    expect(adb.commands.slice(commandStart).some((command) => (
      command.slice(2).join(' ') === 'reverse tcp:3000 tcp:3000'
    ))).toBe(false);
  });

  it('turns an early precondition mismatch and a late duplicate into terminal failure',
    async () => {
      const early = new Da5V5EmployeeInstallationTransition();
      const earlyCalls: string[] = [];
      const earlyOperations = employeeTransitionOperations(earlyCalls);
      earlyOperations.precheck = async () => {
        earlyCalls.push('precheck');
        return 'mismatch';
      };
      await expect(early.confirm('pass', earlyOperations)).resolves.toBe('mismatch');
      expect(earlyCalls).toEqual(['precheck']);
      expect(early.getState()).toEqual({ state: 'failed' });

      const late = new Da5V5EmployeeInstallationTransition();
      await expect(late.confirm('pass', employeeTransitionOperations([])))
        .resolves.toBe('match');
      const repeatedCalls: string[] = [];
      await expect(late.confirm('pass', employeeTransitionOperations(repeatedCalls)))
        .resolves.toBe('mismatch');
      expect(repeatedCalls).toEqual([]);
      expect(late.getState()).toEqual({ state: 'failed' });
    });

  it('rejects a concurrent confirmation and stops the in-flight path before close', async () => {
    const transition = new Da5V5EmployeeInstallationTransition();
    const calls: string[] = [];
    let releasePrecheck!: () => void;
    const precheckReleased = new Promise<void>((resolve) => {
      releasePrecheck = resolve;
    });
    const operations = employeeTransitionOperations(calls);
    operations.precheck = async () => {
      calls.push('precheck');
      await precheckReleased;
      return 'match';
    };

    const first = transition.confirm('pass', operations);
    await Promise.resolve();
    await expect(transition.confirm('pass', employeeTransitionOperations(calls)))
      .resolves.toBe('mismatch');
    releasePrecheck();
    await expect(first).resolves.toBe('mismatch');
    expect(calls).toEqual(['precheck']);
    expect(transition.getState()).toEqual({ state: 'failed' });
  });
});

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
    expect(adb.commands.filter((command) => (
      command.slice(2).join(' ') === 'reverse --list'
    )).every((command) => (
      command[0] === '-s' && command[1] === adb.serial
    ))).toBe(true);
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

  it('fails closed before mutation for foreign transport, malformed columns/endpoints, or duplicates',
    async () => {
    for (const unexpectedLine of [
      'malformed',
      'UsbFfs tcp:9911 tcp:9922 extra-column',
      'UsbFfs localabstract:unexpected tcp:3000',
      'UsbFfs tcp:0 tcp:9922',
      'UsbFfs tcp:65536 tcp:9922',
      'synthetic-device tcp:9911 tcp:9922',
      'usbffs tcp:9911 tcp:9922',
      'replacement-device tcp:9911 tcp:9922',
      'UsbFfs tcp:54321 tcp:54321',
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
    const device = checkpointController(adb, {}, {}, lock);
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

  it.each([
    ['both absent', []],
    ['only auth present', [['tcp:54321', 'tcp:54321']]],
    ['only API present', [['tcp:3000', 'tcp:3000']]],
  ] as const)(
    'settles terminal cleanup with %s without recreating or removing a mapping',
    async (_scenario, entries) => {
      const adb = directAdb();
      const controller = offlineController(adb);
      expect(controller.arm()).toBe('match');
      adb.mappings = new Map(entries);
      const commandStart = adb.commands.length;

      await expect(controller.settleForTerminalCleanup()).resolves.toBe('match');
      await expect(controller.settleForTerminalCleanup()).resolves.toBe('match');

      expect(controller.getState()).toEqual({ completedCycles: 0, state: 'closed' });
      expect(controller.cleanupProofState()).toBe('known');
      expect(adb.mappings).toEqual(new Map(entries));
      expect(adb.commands.slice(commandStart).some((command) => (
        command.slice(2, 3)[0] === 'reverse'
        && command.slice(2).join(' ') !== 'reverse --list'
      ))).toBe(false);
    },
  );

  it.each([
    ['foreign mapping', [['tcp:9911', 'tcp:9922']], []],
    ['wrong host', [['tcp:54321', 'tcp:3999']], []],
    ['duplicate', [['tcp:54321', 'tcp:54321']], ['UsbFfs tcp:54321 tcp:54321']],
    ['malformed', [], ['malformed']],
  ] as const)(
    'fails terminal cleanup closed for %s without mutating mappings',
    async (_scenario, entries, rawReverseLines) => {
      const adb = directAdb();
      const controller = offlineController(adb);
      expect(controller.arm()).toBe('match');
      adb.mappings = new Map(entries);
      adb.rawReverseLines = [...rawReverseLines];
      const before = new Map(adb.mappings);
      const commandStart = adb.commands.length;

      await expect(controller.settleForTerminalCleanup()).resolves.toBe('mismatch');

      expect(controller.getState().state).toBe('failed');
      expect(controller.cleanupProofState()).toBe('uncertain');
      expect(adb.mappings).toEqual(before);
      expect(adb.commands.slice(commandStart).some((command) => (
        command.slice(2, 3)[0] === 'reverse'
        && command.slice(2).join(' ') !== 'reverse --list'
      ))).toBe(false);
    },
  );

  it('preserves uncertain proof and never recreates API mapping during terminal settlement',
    async () => {
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
      expect(controller.cleanupProofState()).toBe('uncertain');
      const commandStart = adb.commands.length;

      await expect(controller.settleForTerminalCleanup()).resolves.toBe('match');

      expect(controller.cleanupProofState()).toBe('uncertain');
      expect(adb.mappings).toEqual(new Map([['tcp:54321', 'tcp:54321']]));
      expect(adb.commands.slice(commandStart).some((command) => (
        command.slice(2).join(' ') === 'reverse tcp:3000 tcp:3000'
      ))).toBe(false);
    });

  it('rejects a device swap during terminal settlement without mapping mutation', async () => {
    const adb = directAdb();
    const controller = offlineController(adb);
    expect(controller.arm()).toBe('match');
    adb.serial = 'replacement-device';
    adb.devices = [{
      details: 'usb:replacement product:synthetic model:synthetic transport_id:2',
      serial: adb.serial,
      state: 'device',
    }];
    const before = new Map(adb.mappings);
    const commandStart = adb.commands.length;

    await expect(controller.settleForTerminalCleanup()).resolves.toBe('mismatch');

    expect(adb.mappings).toEqual(before);
    expect(adb.commands.slice(commandStart).some((command) => (
      command.includes('--remove')
    ))).toBe(false);
  });

  it('fails terminal settlement on reverse-list read failure without mutation', async () => {
    const adb = directAdb();
    const controller = offlineController(adb);
    expect(controller.arm()).toBe('match');
    adb.failOnce = (arguments_) => (
      arguments_.join(' ') === `-s ${adb.serial} reverse --list`
    );
    const before = new Map(adb.mappings);
    const commandStart = adb.commands.length;

    await expect(controller.settleForTerminalCleanup()).resolves.toBe('mismatch');

    expect(controller.cleanupProofState()).toBe('uncertain');
    expect(adb.mappings).toEqual(before);
    expect(adb.commands.slice(commandStart).some((command) => (
      command.includes('--remove')
    ))).toBe(false);
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

describe('DA5 V5 standard functional profile and final accessibility block', () => {
  it('runs functional lifecycle at standard, then accessibility, then proves restoration', () => {
    const adb = directAdb();
    const controller = checkpointController(adb);

    expect(completeFunctionalDeviceFlow(controller)).toBe('match');
    expect(controller.getState()).toBe('protected-relaunch-complete');
    expect(controller.prepareAccessibilityProfileChange()).toBe('match');
    expect(controller.getState()).toBe('accessibility-restore-required');
    enableAccessibilityProfile(adb);
    expect(controller.verifyAccessibilityBinding()).toBe('match');
    expect(controller.getState()).toBe('accessibility-confirmed');
    restoreStandardProfile(adb);
    expect(controller.verifyStandardProfileRestored()).toBe('match');
    expect(controller.getState()).toBe('standard-restored');
    expect(JSON.stringify(controller.getState())).not.toContain(adb.serial);

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

  it('rejects accessibility verification before the protected functional terminal', () => {
    const adb = directAdb();
    const controller = checkpointController(adb);
    expect(controller.prepareColdDispatch()).toBe('match');
    enableAccessibilityProfile(adb);
    expect(controller.verifyAccessibilityBinding()).toBe('mismatch');
    expect(controller.getState()).toBe('failed');
  });

  it('arms restoration before profile change and closes a pre-check cancel only after proof',
    () => {
      const adb = directAdb();
      const controller = checkpointController(adb);
      expect(completeFunctionalDeviceFlow(controller)).toBe('match');
      const mutationsBeforePreparation = adb.commands.filter(
        (command) => command.slice(2, 4).join(' ') === 'shell am',
      ).length;

      expect(controller.prepareAccessibilityProfileChange()).toBe('match');
      expect(controller.getState()).toBe('accessibility-restore-required');
      expect(adb.commands.filter(
        (command) => command.slice(2, 4).join(' ') === 'shell am',
      )).toHaveLength(mutationsBeforePreparation);
      enableAccessibilityProfile(adb);
      restoreStandardProfile(adb);
      expect(controller.verifyStandardProfileRestored()).toBe('match');
      expect(controller.getState()).toBe('standard-restored');
      expect(controller.verifyAccessibilityBinding()).toBe('mismatch');
    });

  it('keeps a preparation-time standard-profile mismatch restore-required', () => {
    const adb = directAdb();
    const controller = checkpointController(adb);
    expect(completeFunctionalDeviceFlow(controller)).toBe('match');
    adb.fontScale = '2.0';

    expect(controller.prepareAccessibilityProfileChange()).toBe('mismatch');
    expect(controller.getState()).toBe('accessibility-restore-required');
    restoreStandardProfile(adb);
    expect(controller.verifyStandardProfileRestored()).toBe('match');
    expect(controller.getState()).toBe('standard-restored');
  });

  it.each([googleTalkBackPackage, samsungTalkBackPackage])(
    'matches the final exact active allowlisted provider package %s and version',
    (talkBackPackage) => {
      const adb = directAdb();
      adb.talkBackPackage = talkBackPackage;
      const controller = checkpointController(adb, { talkBackPackage });
      expect(completeFunctionalDeviceFlow(controller)).toBe('match');
      expect(controller.prepareAccessibilityProfileChange()).toBe('match');
      enableAccessibilityProfile(adb);
      expect(controller.verifyAccessibilityBinding()).toBe('match');
      expect(adb.commands).toContainEqual([
        '-s', adb.serial, 'shell', 'dumpsys', 'package', talkBackPackage,
      ]);
    },
  );

  it.each([
    ['none', '1', 'null'],
    ['deactivated', '0', `${googleTalkBackPackage}/.TalkBackService`],
    ['both', '1', `${googleTalkBackPackage}/.TalkBackService:${samsungTalkBackPackage}/.TalkBackService`],
    ['unexpected', '1', 'com.example.accessibility/.ForeignService'],
  ])('fails closed for %s final accessibility-provider state', (
    _scenario,
    accessibilityEnabled,
    enabledAccessibilityServices,
  ) => {
    const adb = directAdb();
    const controller = checkpointController(adb);
    expect(completeFunctionalDeviceFlow(controller)).toBe('match');
    expect(controller.prepareAccessibilityProfileChange()).toBe('match');
    adb.fontScale = '2.0';
    adb.accessibilityEnabled = accessibilityEnabled;
    adb.enabledAccessibilityServices = enabledAccessibilityServices;
    expect(controller.verifyAccessibilityBinding()).toBe('mismatch');
    expect(controller.getState()).toBe('accessibility-restore-required');
    restoreStandardProfile(adb);
    expect(controller.verifyStandardProfileRestored()).toBe('match');
    expect(controller.getState()).toBe('standard-restored');
  });

  it('fails closed for provider/version drift and incomplete standard restoration', () => {
    const packageAdb = directAdb();
    const packageMismatch = checkpointController(packageAdb, {
      talkBackPackage: googleTalkBackPackage,
    });
    expect(completeFunctionalDeviceFlow(packageMismatch)).toBe('match');
    expect(packageMismatch.prepareAccessibilityProfileChange()).toBe('match');
    packageAdb.talkBackPackage = samsungTalkBackPackage;
    enableAccessibilityProfile(packageAdb);
    expect(packageMismatch.verifyAccessibilityBinding()).toBe('mismatch');

    const versionAdb = directAdb();
    const versionMismatch = checkpointController(versionAdb, {
      talkBackVersion: 'different-version',
    });
    expect(completeFunctionalDeviceFlow(versionMismatch)).toBe('match');
    expect(versionMismatch.prepareAccessibilityProfileChange()).toBe('match');
    enableAccessibilityProfile(versionAdb);
    expect(versionMismatch.verifyAccessibilityBinding()).toBe('mismatch');

    const restoreAdb = directAdb();
    const restoreMismatch = checkpointController(restoreAdb);
    expect(completeFunctionalDeviceFlow(restoreMismatch)).toBe('match');
    expect(restoreMismatch.prepareAccessibilityProfileChange()).toBe('match');
    enableAccessibilityProfile(restoreAdb);
    expect(restoreMismatch.verifyAccessibilityBinding()).toBe('match');
    restoreAdb.fontScale = '1.0';
    expect(restoreMismatch.verifyStandardProfileRestored()).toBe('mismatch');
    expect(restoreMismatch.getState()).toBe('accessibility-restore-required');
    restoreStandardProfile(restoreAdb);
    expect(restoreMismatch.verifyStandardProfileRestored()).toBe('match');
  });

  it('latches mismatched standard, Human and process bindings before later mutation', () => {
    const adb = directAdb();
    const mismatch = checkpointController(adb, {}, { androidBuild: 'different-build' });
    expect(mismatch.prepareColdDispatch()).toBe('mismatch');
    expect(mismatch.armCancellation()).toBe('mismatch');
    expect(adb.commands.flat().join(' ')).not.toContain(
      'shell am kill com.tim180201.mobile.synthetic',
    );

    const ambiguousAdb = directAdb();
    const ambiguous = checkpointController(ambiguousAdb);
    expect(ambiguous.prepareColdDispatch()).toBe('match');
    expect(ambiguous.prepareOrdinaryPendingRelaunch()).toBe('match');
    expect(ambiguous.armCancellation()).toBe('match');
    const killsBeforeConfirmation = ambiguousAdb.commands.filter(
      (command) => command.slice(2).join(' ') === (
        'shell am kill com.tim180201.mobile.synthetic'
      ),
    ).length;
    expect(ambiguous.confirmCancelledUi('ambiguous')).toBe('mismatch');
    expect(ambiguousAdb.commands.filter(
      (command) => command.slice(2).join(' ') === (
        'shell am kill com.tim180201.mobile.synthetic'
      ),
    )).toHaveLength(killsBeforeConfirmation);

    const processAdb = directAdb();
    processAdb.extraProcessNames = ['com.tim180201.mobile.synthetic:secondary'];
    const processMismatch = checkpointController(processAdb);
    expect(processMismatch.prepareColdDispatch()).toBe('mismatch');
  });
});

function employeeTransitionOperations(calls: string[]) {
  const operation = (stage: string) => async (): Promise<'match' | 'mismatch'> => {
    calls.push(stage);
    return 'match';
  };
  return {
    precheck: operation('precheck'),
    closeOldOffline: operation('closeOldOffline'),
    cleanupOldInstallation: operation('cleanupOldInstallation'),
    installReplacement: operation('installReplacement'),
    postcheck: operation('postcheck'),
  };
}

function checkpointController(
  adb: FakeAdb,
  accessibilityOverrides: Readonly<{
    talkBackPackage?: typeof googleTalkBackPackage | typeof samsungTalkBackPackage;
    talkBackVersion?: string;
  }> = {},
  standardOverrides: Readonly<{ androidBuild?: string }> = {},
  lock = new Da5V5UsbDeviceLock(),
): Da5V5DeviceCheckpointController {
  return new Da5V5DeviceCheckpointController(
    adb,
    {
      androidBuild: standardOverrides.androidBuild ?? adb.androidBuild,
      deviceModel: adb.deviceModel,
      fontScale: '1.0',
    },
    {
      androidBuild: adb.androidBuild,
      deviceModel: adb.deviceModel,
      fontScale: '2.0',
      talkBackPackage: accessibilityOverrides.talkBackPackage ?? adb.talkBackPackage,
      talkBackVersion: accessibilityOverrides.talkBackVersion ?? adb.talkBackVersion,
    },
    lock,
  );
}

function completeFunctionalDeviceFlow(
  controller: Da5V5DeviceCheckpointController,
): 'match' | 'mismatch' {
  const results = [
    controller.prepareColdDispatch(),
    controller.prepareOrdinaryPendingRelaunch(),
    controller.armCancellation(),
    controller.confirmCancelledUi('pass'),
    controller.killBackgroundProcess(),
    controller.confirmColdReady('pass'),
    controller.prepareProtectedColdRelaunch(),
    controller.confirmProtectedStateRetained('pass'),
  ];
  return results.every((result) => result === 'match') ? 'match' : 'mismatch';
}

function enableAccessibilityProfile(adb: FakeAdb): void {
  adb.fontScale = '2.0';
  adb.accessibilityEnabled = '1';
  adb.enabledAccessibilityServices = `${adb.talkBackPackage}/.TalkBackService`;
}

function restoreStandardProfile(adb: FakeAdb): void {
  adb.fontScale = '1.0';
  adb.accessibilityEnabled = '0';
  adb.enabledAccessibilityServices = 'null';
}

class FakeAdb implements Da5V5AdbCommandRunner {
  accessibilityEnabled = '0';
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
  enabledAccessibilityServices = 'null';
  extraProcessNames: string[] = [];
  failOnce: ((arguments_: readonly string[]) => boolean) | null = null;
  fontScale = '1.0';
  mappings = new Map<string, string>();
  packageInstalled = true;
  processRunning = true;
  rawReverseLines: string[] = [];
  reverseTransport = 'UsbFfs';
  serial = 'synthetic-device';
  talkBackPackage: typeof googleTalkBackPackage | typeof samsungTalkBackPackage = (
    googleTalkBackPackage
  );
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
          `${this.reverseTransport} ${device} ${host}`
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
      return `${this.fontScale}\n`;
    }
    if (command.join(' ') === 'shell settings get secure accessibility_enabled') {
      return `${this.accessibilityEnabled}\n`;
    }
    if (command.join(' ') === 'shell settings get secure enabled_accessibility_services') {
      return `${this.enabledAccessibilityServices}\n`;
    }
    if (command.join(' ') === `shell dumpsys package ${this.talkBackPackage}`) {
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
