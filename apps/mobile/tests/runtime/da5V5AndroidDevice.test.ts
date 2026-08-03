import { spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_ANDROID_ARTIFACT,
  DA5_V5_ANDROID_PACKAGE,
} from '../../scripts/da5V5AndroidArtifact.mjs';
import {
  DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES,
  assertDa5V5PackageMappingZero,
  classifyDa5V5AndroidInstallError,
  cleanupDa5V5AndroidState,
  Da5V5AndroidCommandExitError,
  Da5V5AndroidCommandTimeoutError,
  Da5V5AndroidPreinstallPreflight,
  Da5V5UsbSerialBinding,
  installDa5V5AndroidFromPackageZero,
  parseDa5V5ReverseMappings,
  requireSingleDa5V5UsbDevice,
  SystemDa5V5AndroidAdbRunner,
  type Da5V5AndroidAdbRunner,
} from '../../scripts/da5V5AndroidDevice.mjs';
import {
  DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES,
  type Da5V5ValidationInstallStreamOutcome,
  type Da5V5ValidationInstallStreamRunner,
} from '../../scripts/da5V5ValidationInstallStream.mjs';

const deviceBinding = Object.freeze({
  androidBuild: 'synthetic/vendor/device:15/BUILD/1:user/release-keys',
  deviceModel: 'Synthetic Galaxy',
});
const googleTalkBackPackage = 'com.google.android.marvin.talkback' as const;
const samsungTalkBackPackage = 'com.samsung.android.accessibility.talkback' as const;

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
    })).rejects.toMatchObject({
      category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.artifactReverify,
      message: 'DA5 V5 Android install failed',
    });
    expect(adb.commands).toEqual([]);
  });

  it('installs the exact external APK without -r from a strict package/mapping zero state',
    async () => {
      const adb = new FakeAdb();
      const verifyArtifact = vi.fn();
      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        installStreamRunner: adb.installStreamRunner,
        profile: 'da5-v5',
        runner: adb,
        reverifyArtifact: vi.fn(() => verifiedSource()),
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
      expect(adb.commands).toContainEqual(installCreateCommand(adb.serial));
      expect(adb.commands).toContainEqual(installWriteCommand(adb.serial));
      expect(adb.commands).toContainEqual(installCommitCommand(adb.serial));
      expect(adb.commands.flat()).not.toContain('-r');
      expect(adb.commands.flat()).not.toContain('install');
      expect(adb.commands.flat()).toContain('-R');
      expect(adb.installInputObserved).toBe(true);
      expect(adb.commands).toContainEqual([
        '-s',
        adb.serial,
        'shell',
        '-T',
        'cat',
        '--',
        '/data/app/synthetic/base.apk',
      ]);
      assertNoBroadDeviceMutation(adb);
    });

  it.each([
    [
      'child transport',
      Object.freeze({
        category:
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.childTransportMismatch,
        childTerminal: false,
        status: 'mismatch' as const,
        stdoutTerminal: false,
      }),
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
    ],
    [
      'stdin pipe',
      Object.freeze({
        category:
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.stdinPipeAbortMismatch,
        childTerminal: true,
        status: 'mismatch' as const,
        stdoutTerminal: true,
      }),
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.stdinPipe,
    ],
    [
      'timeout',
      Object.freeze({
        category:
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.childTimeoutMismatch,
        childTerminal: true,
        status: 'mismatch' as const,
        stdoutTerminal: true,
      }),
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.timeout,
    ],
    [
      'child exit',
      Object.freeze({
        category:
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.childExitMismatch,
        childTerminal: true,
        status: 'mismatch' as const,
        stdoutTerminal: true,
      }),
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childExit,
    ],
  ] as const)('classifies %s and abandons the pending session once', async (
    _scenario,
    outcome,
    category,
  ) => {
    const adb = new FakeAdb();
    adb.installStreamOutcome = outcome;

    await expect(install(adb)).rejects.toMatchObject({
      category,
      message: 'DA5 V5 Android install failed',
    });

    expect(adb.commands.filter((command) => (
      command.includes('install-abandon')
    ))).toHaveLength(1);
    expect(adb.installSessionPending).toBe(false);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
    await expect(cleanup(adb)).resolves.toEqual({ status: 'match' });
    expect(adb.commands.filter((command) => (
      command.includes('install-abandon')
    ))).toHaveLength(1);
  });

  it.each([
    [
      'partial pipe with a success-looking receipt',
      Object.freeze({
        status: 'match' as const,
        stdinTerminal: 'partial_then_pipe_closed' as const,
        stdout: `Success: streamed ${DA5_V5_ANDROID_ARTIFACT.apk.bytes} bytes\n`,
      }),
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.stdinPipe,
    ],
    [
      'wrong byte receipt',
      Object.freeze({
        status: 'match' as const,
        stdinTerminal: 'finished' as const,
        stdout: `Success: streamed ${DA5_V5_ANDROID_ARTIFACT.apk.bytes - 1} bytes\n`,
      }),
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.packageManagerReceipt,
    ],
    [
      'multiline receipt',
      Object.freeze({
        status: 'match' as const,
        stdinTerminal: 'finished' as const,
        stdout: `Success: streamed ${DA5_V5_ANDROID_ARTIFACT.apk.bytes} bytes\nprivate detail\n`,
      }),
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.packageManagerReceipt,
    ],
  ] as const)('rejects %s and abandons before commit', async (
    _scenario,
    outcome,
    category,
  ) => {
    const adb = new FakeAdb();
    adb.installStreamOutcome = outcome;

    await expect(install(adb)).rejects.toMatchObject({ category });

    const mutations = adb.commands.filter((command) => (
      command.some((argument) => argument.startsWith('install-'))
    )).map((command) => command.find((argument) => argument.startsWith('install-')));
    expect(mutations).toEqual(['install-create', 'install-write', 'install-abandon']);
  });

  it('maps unknown failures to one fixed disclosure-safe category', () => {
    const rawDetail = 'private stderr path serial package-manager detail';
    const category = classifyDa5V5AndroidInstallError(new Error(rawDetail));

    expect(category).toBe(
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
    );
    expect(category).not.toContain(rawDetail);
  });

  it.each([
    ['timeout', 'post-create reattestation', 2, 'timeout'],
    ['child exit', 'post-create reattestation', 2, 'child_exit'],
    ['timeout', 'post-write reattestation', 3, 'timeout'],
    ['child exit', 'post-write reattestation', 3, 'child_exit'],
    ['timeout', 'installed provenance', 4, 'timeout'],
    ['child exit', 'installed provenance', 4, 'child_exit'],
  ] as const)(
    'classifies typed %s at %s without exposing raw detail',
    async (failureKind, _boundary, targetDeviceCheck, expectedCategory) => {
      const adb = new FakeAdb();
      const rawDetail = `private ${failureKind} command detail`;
      const typedFailure = failureKind === 'timeout'
        ? new Da5V5AndroidCommandTimeoutError()
        : new Da5V5AndroidCommandExitError();
      Object.assign(typedFailure, { rawDetail });
      let deviceChecks = 0;
      adb.errorOnce = (arguments_) => {
        if (arguments_.join(' ') !== 'devices -l') return null;
        deviceChecks += 1;
        return deviceChecks === targetDeviceCheck ? typedFailure : null;
      };

      let failure: unknown;
      try {
        await install(adb);
      } catch (error) {
        failure = error;
      }

      expect(failure).toMatchObject({
        category: expectedCategory,
        message: 'DA5 V5 Android install failed',
      });
      expect(String(failure)).not.toContain(rawDetail);
      expect(JSON.stringify(failure)).not.toContain(rawDetail);
      expect(adb.packageInstalled).toBe(false);
      expect(adb.mappings).toEqual(new Map());
    },
  );

  it.each([
    [
      'nonzero exit',
      "process.stderr.write('private digest exit detail'); process.exit(23)",
      '23',
    ],
    [
      'signal exit',
      [
        "process.stderr.write('private digest signal detail')",
        "process.kill(process.pid, 'SIGTERM')",
      ].join(';'),
      'SIGTERM',
    ],
  ] as const)(
    'classifies an actual installed-provenance binary digest %s as child_exit',
    async (_scenario, childSource, terminalDetail) => {
      const adb = new FakeAdb();
      adb.binaryDigestRunner = new SystemDa5V5AndroidAdbRunner({
        adbPath: process.execPath,
        environment: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
        spawn: spawnNodeScript(childSource),
      });

      let failure: unknown;
      try {
        await install(adb);
      } catch (error) {
        failure = error;
      }

      expect(failure).toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childExit,
        message: 'DA5 V5 Android install failed',
      });
      expect(String(failure)).not.toContain('private digest');
      expect(String(failure)).not.toContain(terminalDetail);
      expect(JSON.stringify(failure)).not.toContain('private digest');
      expect(JSON.stringify(failure)).not.toContain(terminalDetail);
      expect(adb.commands).toContainEqual([
        '-s', adb.serial, 'shell', '-T', 'cat', '--', adb.expectedDigestPath,
      ]);
      expect(adb.packageInstalled).toBe(false);
      expect(adb.mappings).toEqual(new Map());
    },
  );

  it('fails closed before ADB mutation for a custom runner without a bound stream runner',
    async () => {
      const adb = new FakeAdb();
      const reverifyArtifact = vi.fn();

      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        profile: 'da5-v5',
        runner: adb,
        reverifyArtifact,
        serialBinding: boundSerial(adb),
        verifyArtifact: vi.fn(),
      })).rejects.toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
        message: 'DA5 V5 Android install failed',
      });

      expect(adb.commands).toEqual([]);
      expect(reverifyArtifact).not.toHaveBeenCalled();
      expect(adb.packageInstalled).toBe(false);
      expect(adb.mappings).toEqual(new Map());
    });

  it('classifies a malformed commit receipt and abandons before installed provenance',
    async () => {
      const adb = new FakeAdb();
      adb.installCommitReceipt = 'Success\nprivate detail\n';

      await expect(install(adb)).rejects.toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.packageManagerReceipt,
      });

      expect(adb.commands.filter((command) => command.includes('install-abandon')))
        .toHaveLength(1);
      expect(adb.commands.some((command) => command.includes('cat'))).toBe(false);
      expect(adb.packageInstalled).toBe(false);
    });

  it('reports cleanup when a mandatory abandon cannot be proven', async () => {
    const adb = new FakeAdb();
    adb.installAbandonReceipt = 'Failure [private detail]\n';
    adb.installStreamOutcome = Object.freeze({
      category:
        DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.childExitMismatch,
      childTerminal: true,
      status: 'mismatch',
      stdoutTerminal: true,
    });

    await expect(install(adb)).rejects.toMatchObject({
      category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.cleanup,
    });
    expect(adb.commands.filter((command) => command.includes('install-abandon')))
      .toHaveLength(1);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
  });

  it('installs only the sealed snapshot after an adversarial late host-path swap', async () => {
    const adb = new FakeAdb();
    let hostPathSha256 = DA5_V5_ANDROID_ARTIFACT.apk.sha256;
    const reverifyArtifact = vi.fn(() => verifiedSource(() => {
      hostPathSha256 = 'f'.repeat(64);
    }));

    await expect(installDa5V5AndroidFromPackageZero({
      deviceBinding,
      installStreamRunner: adb.installStreamRunner,
      profile: 'da5-v5',
      runner: adb,
      reverifyArtifact,
      serialBinding: boundSerial(adb),
      verifyArtifact: vi.fn(),
    })).resolves.toEqual({
      packageName: DA5_V5_ANDROID_PACKAGE,
      status: 'match',
    });

    expect(hostPathSha256).toBe('f'.repeat(64));
    expect(adb.installInputObserved).toBe(true);
    expect(adb.installedSha256).toBe(DA5_V5_ANDROID_ARTIFACT.apk.sha256);
    expect(adb.commands.flat()).not.toContain(DA5_V5_ANDROID_ARTIFACT.apk.path);
  });

  it('classifies the pre-session artifact reverify boundary and rolls back mappings',
    async () => {
      const adb = new FakeAdb();
      const rawDetail = 'private artifact path and digest detail';

      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        installStreamRunner: adb.installStreamRunner,
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => {
          throw new Error(rawDetail);
        }),
        runner: adb,
        serialBinding: boundSerial(adb),
        verifyArtifact: vi.fn(),
        ...virtualTiming(adb),
      })).rejects.toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.artifactReverify,
        message: 'DA5 V5 Android install failed',
      });

      expect(adb.commands.some((command) => command.includes('install-create')))
        .toBe(false);
      expect(adb.mappings).toEqual(new Map());
      expect(JSON.stringify(adb.commands)).not.toContain(rawDetail);
    });

  it('rolls back when the installed base APK is not byte-identical to the verified snapshot',
    async () => {
      const adb = new FakeAdb();
      adb.installedSha256 = 'f'.repeat(64);

      await expect(install(adb)).rejects.toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.installedProvenance,
      });

      expect(adb.packageInstalled).toBe(false);
      expect(adb.mappings).toEqual(new Map());
      expect(adb.commands).toContainEqual([
        '-s',
        adb.serial,
        'shell',
        '-T',
        'cat',
        '--',
        '/data/app/synthetic/base.apk',
      ]);
    });

  it('rejects an installed APK path that switches around the binary digest read', async () => {
    const adb = new FakeAdb();
    const pathBeforeDigest = '/data/app/synthetic-before/base.apk';
    const pathAfterDigest = '/data/app/synthetic-after/base.apk';
    adb.expectedDigestPath = pathBeforeDigest;
    adb.packagePathOutputs = [
      `package:${pathBeforeDigest}\n`,
      `package:${pathBeforeDigest}\n`,
      `package:${pathAfterDigest}\n`,
    ];

    await expect(install(adb)).rejects.toThrow(/install failed/);

    expect(adb.commands).toContainEqual([
      '-s',
      adb.serial,
      'shell',
      '-T',
      'cat',
      '--',
      pathBeforeDigest,
    ]);
    expect(adb.commands).not.toContainEqual([
      '-s',
      adb.serial,
      'shell',
      '-T',
      'cat',
      '--',
      pathAfterDigest,
    ]);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
  });

  it.each([
    ['missing package prefix', '/data/app/synthetic/base.apk\n'],
    ['relative traversal', 'package:/data/app/../synthetic/base.apk\n'],
    ['encoded traversal', 'package:/data/app/%2e%2e/synthetic/base.apk\n'],
    ['non-base APK', 'package:/data/app/synthetic/split_config.apk\n'],
    [
      'multiple package paths',
      'package:/data/app/synthetic-a/base.apk\npackage:/data/app/synthetic-b/base.apk\n',
    ],
  ])('rejects real cmd-package-path parser output with %s', async (_name, output) => {
    const adb = new FakeAdb();
    adb.packageInstalled = true;
    adb.packagePathOutputs = [output];
    const serial = await requireSingleDa5V5UsbDevice(adb);

    await expect(assertDa5V5PackageMappingZero(adb, serial)).rejects.toThrow();

    expect(adb.commands.flat().join(' ')).not.toMatch(
      /\b(?:install|uninstall|reverse tcp:|--remove)\b/u,
    );
  });

  it('treats exact Android-15 Owner-User-0 absence as zero without querying package path',
    async () => {
      const adb = new FakeAdb();
      adb.processes = ['com.android.systemui'];
      const serial = await requireSingleDa5V5UsbDevice(adb);

      await expect(assertDa5V5PackageMappingZero(adb, serial)).resolves.toEqual({
        status: 'match',
      });

      expect(adb.commands).toContainEqual([
        '-s', serial, 'shell', 'cmd', 'package', 'list', 'packages',
        '-a', '-u', '--user', '0', DA5_V5_ANDROID_PACKAGE,
      ]);
      expect(adb.commands.some((command) => (
        command.includes('path') && command.includes(DA5_V5_ANDROID_PACKAGE)
      ))).toBe(false);
    });

  it('queries the strict Owner-User-0 base path only after exact package presence', async () => {
    const adb = new FakeAdb();
    adb.packageInstalled = true;
    const serial = await requireSingleDa5V5UsbDevice(adb);

    await expect(assertDa5V5PackageMappingZero(adb, serial)).rejects.toThrow(/zero state/);

    expect(adb.commands).toContainEqual([
      '-s', serial, 'shell', 'cmd', 'package', 'path',
      '--user', '0', DA5_V5_ANDROID_PACKAGE,
    ]);
  });

  it.each([
    ['foreign', 'package:com.example.foreign\n'],
    [
      'multiple',
      `package:${DA5_V5_ANDROID_PACKAGE}\npackage:com.example.foreign\n`,
    ],
    ['malformed', `package:${DA5_V5_ANDROID_PACKAGE} versionCode:1\n`],
    ['padded', ` package:${DA5_V5_ANDROID_PACKAGE}\n`],
  ])('fails closed for %s package registration without querying path', async (
    _scenario,
    registrationOutput,
  ) => {
    const adb = new FakeAdb();
    adb.packageRegistrationOutputs = [registrationOutput];
    const serial = await requireSingleDa5V5UsbDevice(adb);

    await expect(assertDa5V5PackageMappingZero(adb, serial)).rejects.toThrow();

    expect(adb.commands.some((command) => (
      command.includes('path') && command.includes(DA5_V5_ANDROID_PACKAGE)
    ))).toBe(false);
  });

  it.each([
    ['main', DA5_V5_ANDROID_PACKAGE],
    ['secondary', `${DA5_V5_ANDROID_PACKAGE}:secondary`],
  ])('fails closed for an exact Product %s process in package-null state', async (
    _processKind,
    processName,
  ) => {
    const adb = new FakeAdb();
    adb.processes = [processName];
    const serial = await requireSingleDa5V5UsbDevice(adb);

    await expect(assertDa5V5PackageMappingZero(adb, serial)).rejects.toThrow(/zero state/);
  });

  it.each([
    ['header', `${DA5_V5_ANDROID_PACKAGE}\n`],
    ['padded row', `NAME\n ${DA5_V5_ANDROID_PACKAGE}\n`],
    ['extra empty row', `NAME\n${DA5_V5_ANDROID_PACKAGE}\n\n`],
  ])('fails closed for malformed process output with %s', async (_scenario, output) => {
    const adb = new FakeAdb();
    adb.processOutputs = [output];
    const serial = await requireSingleDa5V5UsbDevice(adb);

    await expect(assertDa5V5PackageMappingZero(adb, serial)).rejects.toThrow();
  });

  it.each(['registration', 'path', 'process', 'reverse'] as const)(
    'fails closed for %s transport failure without mutation',
    async (failure) => {
      const adb = new FakeAdb();
      adb.packageInstalled = failure === 'path';
      adb.failOnce = (arguments_) => {
        const command = arguments_.slice(2).join(' ');
        if (failure === 'registration') {
          return command === (
            `shell cmd package list packages -a -u --user 0 ${DA5_V5_ANDROID_PACKAGE}`
          );
        }
        if (failure === 'path') {
          return command === (
            `shell cmd package path --user 0 ${DA5_V5_ANDROID_PACKAGE}`
          );
        }
        if (failure === 'process') {
          return command === 'shell ps -A -w -o NAME:4';
        }
        return command === 'reverse --list';
      };
      const serial = await requireSingleDa5V5UsbDevice(adb);

      await expect(assertDa5V5PackageMappingZero(adb, serial)).rejects.toThrow();

      expect(adb.commands.flat().join(' ')).not.toMatch(
        /\b(?:install|uninstall|reverse tcp:|--remove)\b/u,
      );
    },
  );

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
        return isInstallCommand(arguments_);
      }
      if (command === (
        `shell cmd package path --user 0 ${DA5_V5_ANDROID_PACKAGE}`
      )) {
        packageChecks += 1;
        return packageChecks === 3;
      }
      return false;
    };

    await expect(install(adb)).rejects.toThrow('DA5 V5 Android install failed');
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
    expect(adb.elapsedMilliseconds).toBeGreaterThanOrEqual(15_000);
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
          talkBackPackage: googleTalkBackPackage,
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
        talkBackPackage: googleTalkBackPackage,
        talkBackVersion: '15.1.0',
      },
    );
    await expect(preflight.run()).resolves.toEqual({ status: 'mismatch' });
    expect(adb.commands.flat()).not.toContain('install');
  });

  it('serializes every ADB observation so a constrained server is never queried concurrently',
    async () => {
      const adb = new FakeAdb();
      let active = 0;
      let maximumActive = 0;
      const runner: Da5V5AndroidAdbRunner = {
        async run(arguments_, options) {
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          await Promise.resolve();
          try {
            return await adb.run(arguments_, options);
          } finally {
            active -= 1;
          }
        },
      };
      const preflight = new Da5V5AndroidPreinstallPreflight(
        runner,
        new Da5V5UsbSerialBinding(),
        {
          ...deviceBinding,
          androidApi: '35',
          androidRelease: '15',
          fontScale: '2.0',
          talkBackPackage: googleTalkBackPackage,
          talkBackVersion: '15.1.0',
        },
      );

      await expect(preflight.run()).resolves.toEqual({ status: 'match' });
      expect(maximumActive).toBe(1);
    });

  it.each([googleTalkBackPackage, samsungTalkBackPackage])(
    'binds the exact active allowlisted provider package %s and version',
    async (talkBackPackage) => {
      const adb = new FakeAdb();
      adb.talkBackPackage = talkBackPackage;
      adb.enabledAccessibilityServices = `${talkBackPackage}/.TalkBackService`;
      const preflight = new Da5V5AndroidPreinstallPreflight(
        adb,
        new Da5V5UsbSerialBinding(),
        {
          ...deviceBinding,
          androidApi: '35',
          androidRelease: '15',
          fontScale: '2.0',
          talkBackPackage,
          talkBackVersion: adb.talkBackVersion,
        },
      );

      await expect(preflight.run()).resolves.toEqual({ status: 'match' });
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
  ])('fails closed for %s accessibility-provider state', async (
    _scenario,
    accessibilityEnabled,
    enabledAccessibilityServices,
  ) => {
    const adb = new FakeAdb();
    adb.accessibilityEnabled = accessibilityEnabled;
    adb.enabledAccessibilityServices = enabledAccessibilityServices;
    const preflight = new Da5V5AndroidPreinstallPreflight(
      adb,
      new Da5V5UsbSerialBinding(),
      {
        ...deviceBinding,
        androidApi: '35',
        androidRelease: '15',
        fontScale: '2.0',
        talkBackPackage: googleTalkBackPackage,
        talkBackVersion: adb.talkBackVersion,
      },
    );

    await expect(preflight.run()).resolves.toEqual({ status: 'mismatch' });
    expect(preflight.state()).toBe('failed');
  });

  it('fails closed when the active package or its version differs from the binding', async () => {
    const packageMismatch = new FakeAdb();
    packageMismatch.talkBackPackage = samsungTalkBackPackage;
    packageMismatch.enabledAccessibilityServices = (
      `${samsungTalkBackPackage}/.TalkBackService`
    );
    const wrongPackage = new Da5V5AndroidPreinstallPreflight(
      packageMismatch,
      new Da5V5UsbSerialBinding(),
      {
        ...deviceBinding,
        androidApi: '35',
        androidRelease: '15',
        fontScale: '2.0',
        talkBackPackage: googleTalkBackPackage,
        talkBackVersion: packageMismatch.talkBackVersion,
      },
    );
    await expect(wrongPackage.run()).resolves.toEqual({ status: 'mismatch' });

    const versionMismatch = new FakeAdb();
    const wrongVersion = new Da5V5AndroidPreinstallPreflight(
      versionMismatch,
      new Da5V5UsbSerialBinding(),
      {
        ...deviceBinding,
        androidApi: '35',
        androidRelease: '15',
        fontScale: '2.0',
        talkBackPackage: googleTalkBackPackage,
        talkBackVersion: 'different-version',
      },
    );
    await expect(wrongVersion.run()).resolves.toEqual({ status: 'mismatch' });
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

  it('uninstalls exact package state and proves secondary-process cleanup jointly', async () => {
    const adb = new FakeAdb();
    adb.packageInstalled = true;
    adb.processes = [`${DA5_V5_ANDROID_PACKAGE}:secondary`];
    adb.mappings.set('tcp:54321', 'tcp:54321');
    adb.mappings.set('tcp:3000', 'tcp:3000');

    await expect(cleanup(adb)).resolves.toEqual({ status: 'match' });

    expect(adb.packageInstalled).toBe(false);
    expect(adb.processes).toEqual([]);
    expect(adb.mappings).toEqual(new Map());
    expect(adb.commands).toContainEqual([
      '-s', adb.serial, 'shell', 'ps', '-A', '-w', '-o', 'NAME:4',
    ]);
  });

  it('fails cleanup closed for a secondary process without Owner-User-0 registration',
    async () => {
      const adb = new FakeAdb();
      adb.processes = [`${DA5_V5_ANDROID_PACKAGE}:secondary`];

      await expect(cleanup(adb)).resolves.toEqual({ status: 'mismatch' });

      expect(adb.processes).toEqual([`${DA5_V5_ANDROID_PACKAGE}:secondary`]);
      expect(adb.commands.flat()).not.toContain('uninstall');
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
      isInstallCommand(arguments_)
    );
    await expect(install(adb)).rejects.toThrow(/install failed/);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
    const installCommand = adb.commandOptions.find(({ arguments_ }) => (
      isInstallCommand(arguments_)
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
        installStreamRunner: adb.installStreamRunner,
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => verifiedSource()),
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
        isInstallCommand(arguments_)
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

  it('uses the long null window for a reverse mapping visible after an aborted mutation',
    async () => {
      const adb = new FakeAdb();
      adb.mappings.set('tcp:54321', 'tcp:54321');
      adb.mappings.set('tcp:3000', 'tcp:3000');
      adb.lateOwnedMappingVisibilityAtMilliseconds = [5_000];

      await expect(cleanupDa5V5AndroidState({
        deviceBinding,
        profile: 'da5-v5',
        reverseState: 'uncertain',
        runner: adb,
        serialBinding: boundSerial(adb),
        ...virtualTiming(adb),
      })).resolves.toEqual({ status: 'match' });

      expect(adb.elapsedMilliseconds).toBeGreaterThanOrEqual(20_000);
      expect(adb.commands.filter((command) => (
        command.slice(2).join(' ') === 'reverse --remove tcp:3000'
      ))).toHaveLength(2);
      expect(adb.mappings).toEqual(new Map());
    });

  it('fails closed within 60 seconds when late install residue prevents a 15-second null window',
    async () => {
    const adb = new FakeAdb();
    adb.failOnce = (arguments_) => (
      isInstallCommand(arguments_)
    );
    adb.latePackageVisibilityAtMilliseconds = [5_000, 19_000, 33_000, 47_000];

    await expect(install(adb)).rejects.toMatchObject({
      category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.cleanup,
      message: 'DA5 V5 Android install failed',
    });

    expect(adb.elapsedMilliseconds).toBe(60_000);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.commands.filter((command) => (
      command.slice(2).join(' ') === `uninstall ${DA5_V5_ANDROID_PACKAGE}`
    ))).toHaveLength(4);
    expect(adb.mappings).toEqual(new Map());
  });
});

class FakeAdb implements Da5V5AndroidAdbRunner {
  accessibilityEnabled = '1';
  abortInstall: AbortController | null = null;
  binaryDigestRunner: Da5V5AndroidAdbRunner | null = null;
  readonly androidBuild = deviceBinding.androidBuild;
  commands: string[][] = [];
  readonly deviceModel = deviceBinding.deviceModel;
  devices = [{
    details: 'usb:synthetic product:synthetic model:synthetic transport_id:1',
    serial: 'synthetic-device',
    state: 'device',
  }];
  enabledAccessibilityServices = `${googleTalkBackPackage}/.TalkBackService`;
  errorOnce: ((arguments_: readonly string[]) => Error | null) | null = null;
  failOnce: ((arguments_: readonly string[]) => boolean) | null = null;
  elapsedMilliseconds = 0;
  lateOwnedMappingVisibilityAtMilliseconds: number[] = [];
  latePackageVisibilityAtMilliseconds: number[] = [];
  mappings = new Map<string, string>();
  listeners = '';
  packageInstalled = false;
  installAbandonReceipt = 'Success\n';
  installCommitReceipt = 'Success\n';
  installCreateReceipt = 'Success: created install session [42]\n';
  installInputObserved = false;
  installSessionPending = false;
  installStreamOutcome: Da5V5ValidationInstallStreamOutcome | null = null;
  readonly installStreamRunner = new FakeInstallStreamRunner(this);
  installedSha256 = DA5_V5_ANDROID_ARTIFACT.apk.sha256;
  expectedDigestPath = '/data/app/synthetic/base.apk';
  packageRegistrationOutputs: string[] = [];
  packagePathChecks = 0;
  packagePathOutputs: string[] = [];
  processes: string[] = [];
  processOutputs: string[] = [];
  rawReverseLines: string[] = [];
  serial = 'synthetic-device';
  talkBackPackage: typeof googleTalkBackPackage | typeof samsungTalkBackPackage = (
    googleTalkBackPackage
  );
  talkBackVersion = '15.1.0';
  commandOptions: Array<{
    arguments_: readonly string[];
    maximumBytes?: number;
    signal?: AbortSignal;
    stdinBytes?: Buffer;
    timeoutMilliseconds?: number;
  }> = [];

  async run(
    arguments_: readonly string[],
    options: {
      signal?: AbortSignal;
      stdinBytes?: Buffer;
      timeoutMilliseconds?: number;
    } = {},
  ): Promise<string> {
    this.commands.push([...arguments_]);
    this.commandOptions.push({ arguments_: [...arguments_], ...options });
    if (options.signal?.aborted === true) {
      throw new Error('fake adb aborted');
    }
    const injectedError = this.errorOnce?.(arguments_);
    if (injectedError !== null && injectedError !== undefined) {
      this.errorOnce = null;
      throw injectedError;
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
    if (text === 'shell settings get secure accessibility_enabled') {
      return `${this.accessibilityEnabled}\n`;
    }
    if (text === 'shell settings get secure enabled_accessibility_services') {
      return `${this.enabledAccessibilityServices}\n`;
    }
    if (text === `shell dumpsys package ${this.talkBackPackage}`) {
      return `Packages:\n  versionName=${this.talkBackVersion}\n`;
    }
    if (text === 'shell ss -ltnH') return this.listeners;
    if (text === (
      `shell cmd package list packages -a -u --user 0 ${DA5_V5_ANDROID_PACKAGE}`
    )) {
      const output = this.packageRegistrationOutputs.shift();
      if (output !== undefined) {
        return output;
      }
      const lateVisibility = this.latePackageVisibilityAtMilliseconds[0];
      if (lateVisibility !== undefined && this.elapsedMilliseconds >= lateVisibility) {
        this.packageInstalled = true;
        this.latePackageVisibilityAtMilliseconds.shift();
      }
      return this.packageInstalled ? `package:${DA5_V5_ANDROID_PACKAGE}\n` : '';
    }
    if (text === 'shell ps -A -w -o NAME:4') {
      const output = this.processOutputs.shift();
      if (output !== undefined) {
        return output;
      }
      return ['NAME', ...this.processes, ''].join('\n');
    }
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
    if (text === (
      `shell cmd package path --user 0 ${DA5_V5_ANDROID_PACKAGE}`
    )) {
      this.packagePathChecks += 1;
      const output = this.packagePathOutputs.shift();
      if (output !== undefined) {
        return output;
      }
      return this.packageInstalled ? 'package:/data/app/synthetic/base.apk\n' : '';
    }
    if (arguments_.join(' ') === installCreateCommand(this.serial).join(' ')) {
      this.installSessionPending = this.installCreateReceipt.startsWith(
        'Success: created install session',
      );
      return this.installCreateReceipt;
    }
    if (arguments_.join(' ') === installCommitCommand(this.serial).join(' ')) {
      if (this.installCommitReceipt === 'Success\n') {
        this.installSessionPending = false;
        this.packageInstalled = true;
      }
      return this.installCommitReceipt;
    }
    if (text === 'shell -T -x cmd package install-abandon 42') {
      if (this.installAbandonReceipt === 'Success\n') {
        this.installSessionPending = false;
      }
      return this.installAbandonReceipt;
    }
    if (text === `uninstall ${DA5_V5_ANDROID_PACKAGE}`) {
      this.packageInstalled = false;
      this.processes = [];
      return 'Success\n';
    }
    throw new Error(`unexpected fake adb command: ${text}`);
  }

  async runBinaryDigest(
    arguments_: readonly string[],
    options: {
      maximumBytes: number;
      signal?: AbortSignal;
      timeoutMilliseconds?: number;
    },
  ): Promise<Readonly<{ bytes: number; sha256: string }>> {
    this.commands.push([...arguments_]);
    this.commandOptions.push({ arguments_: [...arguments_], ...options });
    if (options.signal?.aborted === true) {
      throw new Error('fake adb aborted');
    }
    if (arguments_.join(' ') !== (
      `-s ${this.serial} shell -T cat -- ${this.expectedDigestPath}`
    )) {
      throw new Error('unexpected fake binary adb command');
    }
    if (this.binaryDigestRunner?.runBinaryDigest !== undefined) {
      return this.binaryDigestRunner.runBinaryDigest(arguments_, options);
    }
    return Object.freeze({
      bytes: DA5_V5_ANDROID_ARTIFACT.apk.bytes,
      sha256: this.installedSha256,
    });
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

function spawnNodeScript(source: string): typeof spawn {
  return ((
    _command: string,
    _arguments: readonly string[],
    options: object,
  ) => spawn(process.execPath, ['-e', source], options)
  ) as unknown as typeof spawn;
}

class FakeInstallStreamRunner implements Da5V5ValidationInstallStreamRunner {
  constructor(private readonly adb: FakeAdb) {}

  async write(
    arguments_: readonly string[],
    options: Readonly<{
      signal?: AbortSignal;
      stdinBytes: Buffer;
      timeoutMilliseconds: number;
    }>,
  ): Promise<Da5V5ValidationInstallStreamOutcome> {
    this.adb.commands.push([...arguments_]);
    this.adb.commandOptions.push({ arguments_: [...arguments_], ...options });
    if (arguments_.join(' ') !== installWriteCommand(this.adb.serial).join(' ')) {
      throw new Error('unexpected fake install-write command');
    }
    if (options.stdinBytes.toString('utf8') !== 'verified-apk-snapshot') {
      throw new Error('fake adb received an unverified install stream');
    }
    this.adb.installInputObserved = true;
    if (this.adb.abortInstall !== null) {
      this.adb.abortInstall.abort();
      return Object.freeze({
        category:
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.childTransportMismatch,
        childTerminal: true,
        status: 'mismatch',
        stdoutTerminal: true,
        terminalCause: 'signal_abort',
      });
    }
    return this.adb.installStreamOutcome ?? Object.freeze({
      status: 'match',
      stdinTerminal: 'finished',
      stdout: `Success: streamed ${DA5_V5_ANDROID_ARTIFACT.apk.bytes} bytes\n`,
    });
  }
}

function install(adb: FakeAdb) {
  return installDa5V5AndroidFromPackageZero({
    deviceBinding,
    installStreamRunner: adb.installStreamRunner,
    profile: 'da5-v5',
    runner: adb,
    reverifyArtifact: vi.fn(() => verifiedSource()),
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

function verifiedSource(onUse: () => void = () => undefined) {
  let destroyed = false;
  let used = false;
  return {
    destroy: vi.fn(() => {
      destroyed = true;
    }),
    status: 'match' as const,
    async use<T>(operation: (snapshot: Buffer) => Promise<T> | T): Promise<T> {
      if (destroyed || used) {
        throw new Error('fake verified source unavailable');
      }
      used = true;
      try {
        onUse();
        return await operation(Buffer.from('verified-apk-snapshot', 'utf8'));
      } finally {
        destroyed = true;
      }
    },
  };
}

function installCreateCommand(serial: string): string[] {
  return [
    '-s', serial, 'shell', '-T', '-x', 'cmd', 'package',
    'install-create', '-R', '--user', '0', '--pkg', DA5_V5_ANDROID_PACKAGE,
    '-S', String(DA5_V5_ANDROID_ARTIFACT.apk.bytes),
  ];
}

function installWriteCommand(serial: string): string[] {
  return [
    '-s', serial, 'shell', '-T', '-x', 'cmd', 'package',
    'install-write', '-S', String(DA5_V5_ANDROID_ARTIFACT.apk.bytes),
    '42', 'base.apk', '-',
  ];
}

function installCommitCommand(serial: string): string[] {
  return [
    '-s', serial, 'shell', '-T', '-x', 'cmd', 'package',
    'install-commit', '42',
  ];
}

function isInstallCommand(arguments_: readonly string[]): boolean {
  return arguments_.join(' ') === installCreateCommand(arguments_[1] ?? '').join(' ');
}
