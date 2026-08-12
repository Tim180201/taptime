import { spawn } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import {
  DA5_V5_ANDROID_ARTIFACT,
  DA5_V5_ANDROID_PACKAGE,
} from '../../scripts/da5V5AndroidArtifact.mjs';
import {
  DA5_V5_ANDROID_CLEANUP_SUBSTAGES,
  DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES,
  assertDa5V5PackageMappingZero,
  classifyDa5V5AndroidInstallCleanup,
  classifyDa5V5AndroidInstallError,
  clearDa5V5AndroidPackageForEmployeePreparation,
  cleanupDa5V5AndroidState,
  Da5V5AndroidCommandAbortError,
  Da5V5AndroidCommandExitError,
  Da5V5AndroidCommandTimeoutError,
  Da5V5AndroidCommandTransientError,
  Da5V5AndroidInstallTransaction,
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
        reverifyArtifact: vi.fn(),
        verifyArtifact,
        ...productInstallBindings(adb),
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
      verifyArtifact,
      ...productInstallBindings(adb),
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
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => verifiedSource()),
        verifyArtifact,
        ...productInstallBindings(adb),
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
      expect(adb.commands.filter((command) => (
        command.slice(2).join(' ') === 'reverse --list'
      )).every((command) => (
        command[0] === '-s' && command[1] === adb.serial
      ))).toBe(true);
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
      'signal abort',
      Object.freeze({
        category:
          DA5_V5_VALIDATION_INSTALL_STREAM_ERROR_CATEGORIES.childTransportMismatch,
        childTerminal: true,
        status: 'mismatch' as const,
        stdoutTerminal: true,
        terminalCause: 'signal_abort' as const,
      }),
      DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.signalAbort,
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
      cleanupStatus: 'match',
      cleanupSubstage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
      message: 'DA5 V5 Android install failed',
    });

    expect(adb.commands.filter((command) => (
      command.includes('install-abandon')
    ))).toHaveLength(1);
    expect(adb.installSessionPending).toBe(false);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
    await expect(cleanup(adb)).resolves.toMatchObject({ status: 'match' });
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

  it('exposes only closed cleanup evidence without retaining raw failure detail', () => {
    const rawDetail = 'private cleanup stderr serial and device path';
    const error = new Error(rawDetail);

    expect(classifyDa5V5AndroidInstallCleanup(error)).toEqual({
      status: 'not_required',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.notRequired,
    });
    expect(JSON.stringify(classifyDa5V5AndroidInstallCleanup(error)))
      .not.toContain(rawDetail);
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

  it('enforces the credential-only empty-output contract on real stdin children', async () => {
    const credential = `${'a'.repeat(64)}\n`;
    const exactInputPrefix = [
      'const chunks = [];',
      'process.stdin.on("data", (chunk) => chunks.push(chunk));',
      'process.stdin.on("end", () => {',
      `if (Buffer.concat(chunks).toString("ascii") !== ${JSON.stringify(credential)}) {`,
      'process.exit(91);',
      '}',
    ].join('');
    const exactInputScript = (terminal: string): string => (
      `${exactInputPrefix}${terminal}});`
    );
    const run = (
      source: string,
      options: Readonly<{ signal?: AbortSignal; timeoutMilliseconds?: number }> = {},
      requireEmptyOutput = true,
    ) => new SystemDa5V5AndroidAdbRunner({
      adbPath: process.execPath,
      environment: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
      spawn: spawnNodeScript(source),
    }).run(['shell', '-T', 'sh', '-c', 'credential-input'], {
      ...(requireEmptyOutput ? { requireEmptyOutput: true as const } : {}),
      signal: options.signal,
      stdinBytes: Buffer.from(credential, 'ascii'),
      timeoutMilliseconds: options.timeoutMilliseconds ?? 5_000,
    });

    await expect(run(exactInputScript('process.exit(0);'))).resolves.toBe('');

    for (const [stream, terminal] of [
      ['stderr', 'process.stderr.write("private stderr detail"); process.exit(0);'],
      ['stdout', 'process.stdout.write("private stdout detail"); process.exit(0);'],
    ] as const) {
      const failure = await run(exactInputScript(terminal)).catch(
        (error: unknown) => error,
      );
      expect(failure).toMatchObject({
        message: 'DA5 V5 Android device output mismatch',
      });
      expect(String(failure)).not.toContain(`private ${stream} detail`);
      expect(JSON.stringify(failure)).not.toContain(`private ${stream} detail`);
    }

    await expect(run(exactInputScript('process.exit(23);'))).rejects.toBeInstanceOf(
      Da5V5AndroidCommandExitError,
    );
    await expect(run(
      exactInputScript('setInterval(() => undefined, 1_000);'),
      { timeoutMilliseconds: 250 },
    )).rejects.toBeInstanceOf(Da5V5AndroidCommandTimeoutError);

    const abortController = new AbortController();
    const aborted = run(
      exactInputScript('setInterval(() => undefined, 1_000);'),
      { signal: abortController.signal },
    );
    abortController.abort();
    await expect(aborted).rejects.toBeInstanceOf(Da5V5AndroidCommandAbortError);

    await expect(run(
      exactInputScript('process.stderr.write("allowed diagnostic"); process.exit(0);'),
      {},
      false,
    )).resolves.toBe('');
  });

  it('enforces the package-clear empty-stderr receipt policy on real children', async () => {
    const run = (source: string) => new SystemDa5V5AndroidAdbRunner({
      adbPath: process.execPath,
      environment: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
      spawn: spawnNodeScript(source),
    }).run(['shell', 'pm', 'clear'], {
      requireEmptyStderr: true,
      timeoutMilliseconds: 5_000,
    });

    await expect(run('process.stdout.write("Success\\n")')).resolves.toBe('Success\n');
    const failure = await run(
      'process.stdout.write("Success\\n"); process.stderr.write("private detail")',
    ).catch((error: unknown) => error);
    expect(failure).toMatchObject({
      message: 'DA5 V5 Android device output mismatch',
    });
    expect(String(failure)).not.toContain('private detail');
    expect(JSON.stringify(failure)).not.toContain('private detail');
  });

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
        transaction: undefined as unknown as Da5V5AndroidInstallTransaction,
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

  it.each(['control', 'stream'] as const)(
    'fails closed before mutation on %s-runner identity drift',
    async (drift) => {
      const adb = new FakeAdb();
      const replacement = new FakeAdb();
      const serialBinding = boundSerial(adb);
      const transaction = productTransaction(adb, serialBinding);

      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        installStreamRunner: drift === 'stream'
          ? replacement.installStreamRunner
          : adb.installStreamRunner,
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => verifiedSource()),
        runner: drift === 'control' ? replacement : adb,
        serialBinding,
        transaction,
        verifyArtifact: vi.fn(),
      })).rejects.toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
        cleanupStatus: 'not_required',
        cleanupSubstage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.notRequired,
      });

      expect(adb.commands).toEqual([]);
      expect(replacement.commands).toEqual([]);
    },
  );

  it('rejects a parallel install transaction on the same control runner', async () => {
    const adb = new FakeAdb();
    const first = install(adb);
    const secondSerialBinding = boundSerial(adb);
    const secondTransaction = productTransaction(adb, secondSerialBinding);

    await expect(installDa5V5AndroidFromPackageZero({
      deviceBinding,
      installStreamRunner: adb.installStreamRunner,
      profile: 'da5-v5',
      reverifyArtifact: vi.fn(() => verifiedSource()),
      runner: adb,
      serialBinding: secondSerialBinding,
      transaction: secondTransaction,
      verifyArtifact: vi.fn(),
      ...virtualTiming(adb),
    })).rejects.toMatchObject({
      category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
      cleanupStatus: 'not_required',
    });
    await expect(first).resolves.toMatchObject({ status: 'match' });
    expect(adb.commands.filter((command) => command.includes('install-create')))
      .toHaveLength(1);
  });

  it('releases a runner for a second transaction only after exact successful cleanup',
    async () => {
      const adb = new FakeAdb();
      const firstSerialBinding = boundSerial(adb);
      const firstTransaction = productTransaction(adb, firstSerialBinding);
      const installWith = (
        serialBinding: Da5V5UsbSerialBinding,
        transaction: Da5V5AndroidInstallTransaction,
      ) => installDa5V5AndroidFromPackageZero({
        deviceBinding,
        installStreamRunner: adb.installStreamRunner,
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => verifiedSource()),
        runner: adb,
        serialBinding,
        transaction,
        verifyArtifact: vi.fn(),
        ...virtualTiming(adb),
      });

      await expect(installWith(firstSerialBinding, firstTransaction))
        .resolves.toMatchObject({ status: 'match' });

      const blockedSerialBinding = boundSerial(adb);
      const blockedTransaction = productTransaction(adb, blockedSerialBinding);
      await expect(installWith(blockedSerialBinding, blockedTransaction))
        .rejects.toMatchObject({
          category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
          cleanupStatus: 'not_required',
        });
      expect(adb.commands.filter((command) => command.includes('install-create')))
        .toHaveLength(1);

      await expect(cleanupDa5V5AndroidState({
        deviceBinding,
        profile: 'da5-v5',
        runner: adb,
        serialBinding: firstSerialBinding,
        transaction: firstTransaction,
        ...virtualTiming(adb),
      })).resolves.toEqual({
        status: 'match',
        substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
      });

      const replacementSerialBinding = boundSerial(adb);
      const replacementTransaction = productTransaction(adb, replacementSerialBinding);
      await expect(installWith(replacementSerialBinding, replacementTransaction))
        .resolves.toMatchObject({ status: 'match' });
      expect(adb.commands.filter((command) => command.includes('install-create')))
        .toHaveLength(2);
      await expect(cleanupDa5V5AndroidState({
        deviceBinding,
        profile: 'da5-v5',
        runner: adb,
        serialBinding: replacementSerialBinding,
        transaction: replacementTransaction,
        ...virtualTiming(adb),
      })).resolves.toMatchObject({ status: 'match' });
      assertNoBroadDeviceMutation(adb);
    });

  it('retains runner ownership after cleanup mismatch and rejects a replacement transaction',
    async () => {
      const adb = new FakeAdb();
      const firstSerialBinding = boundSerial(adb);
      const firstTransaction = productTransaction(adb, firstSerialBinding);
      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        installStreamRunner: adb.installStreamRunner,
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => verifiedSource()),
        runner: adb,
        serialBinding: firstSerialBinding,
        transaction: firstTransaction,
        verifyArtifact: vi.fn(),
        ...virtualTiming(adb),
      })).resolves.toMatchObject({ status: 'match' });

      adb.uninstallReceipt = 'Failure [DELETE_FAILED_INTERNAL_ERROR]\n';
      await expect(cleanupDa5V5AndroidState({
        deviceBinding,
        profile: 'da5-v5',
        runner: adb,
        serialBinding: firstSerialBinding,
        transaction: firstTransaction,
        ...virtualTiming(adb),
      })).resolves.toEqual({
        status: 'mismatch',
        substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.packageUninstall,
      });

      const replacementSerialBinding = boundSerial(adb);
      const replacementTransaction = productTransaction(adb, replacementSerialBinding);
      await expect(installDa5V5AndroidFromPackageZero({
        deviceBinding,
        installStreamRunner: adb.installStreamRunner,
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => verifiedSource()),
        runner: adb,
        serialBinding: replacementSerialBinding,
        transaction: replacementTransaction,
        verifyArtifact: vi.fn(),
        ...virtualTiming(adb),
      })).rejects.toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
        cleanupStatus: 'not_required',
      });
      expect(adb.commands.filter((command) => command.includes('install-create')))
        .toHaveLength(1);
      assertNoBroadDeviceMutation(adb);
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
      category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childExit,
      cleanupStatus: 'mismatch',
      cleanupSubstage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.installAbandon,
    });
    expect(adb.commands.filter((command) => command.includes('install-abandon')))
      .toHaveLength(1);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
    await expect(cleanup(adb)).resolves.toMatchObject({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.installAbandon,
    });
    expect(adb.commands.filter((command) => command.includes('install-abandon')))
      .toHaveLength(1);
  });

  it('installs only the sealed snapshot after an adversarial late host-path swap', async () => {
    const adb = new FakeAdb();
    let hostPathSha256 = DA5_V5_ANDROID_ARTIFACT.apk.sha256;
    const reverifyArtifact = vi.fn(() => verifiedSource(() => {
      hostPathSha256 = 'f'.repeat(64);
    }));

    await expect(installDa5V5AndroidFromPackageZero({
      deviceBinding,
      profile: 'da5-v5',
      reverifyArtifact,
      verifyArtifact: vi.fn(),
      ...productInstallBindings(adb),
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
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => {
          throw new Error(rawDetail);
        }),
        verifyArtifact: vi.fn(),
        ...productInstallBindings(adb),
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
    malformedMapping.rawReverseLines = ['UsbFfs localabstract:unexpected tcp:3000'];
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
    if (failure === 'post-install-check') {
      expect(adb.elapsedMilliseconds).toBe(250);
    } else {
      expect(adb.elapsedMilliseconds).toBeGreaterThanOrEqual(15_000);
    }
    assertNoBroadDeviceMutation(adb);
  });
});

describe('DA5 V5 exact Employee package clear', () => {
  it('clears exactly the bound synthetic package once and reattests the full installed proof',
    async () => {
      const adb = new FakeAdb();
      await install(adb);
      adb.processes = [DA5_V5_ANDROID_PACKAGE];
      const verifyArtifact = vi.fn(() => Object.freeze({
        packageName: DA5_V5_ANDROID_PACKAGE,
        status: 'match' as const,
      }));

      await expect(clearEmployeePackage(adb, verifyArtifact)).resolves.toEqual({
        packageName: DA5_V5_ANDROID_PACKAGE,
        status: 'match',
      });

      expect(packageClearCommands(adb)).toEqual([
        packageClearCommand(adb.serial),
      ]);
      expect(adb.processes).toEqual([]);
      expect(adb.packageInstalled).toBe(true);
      expect(adb.mappings).toEqual(new Map([
        ['tcp:54321', 'tcp:54321'],
        ['tcp:3000', 'tcp:3000'],
      ]));
      expect(verifyArtifact).toHaveBeenCalledTimes(1);
      expect(verifyArtifact).toHaveBeenCalledWith({ profile: 'da5-v5' });
      expect(adb.commands).toContainEqual([
        '-s', adb.serial, 'shell', '-T', 'cat', '--', adb.expectedDigestPath,
      ]);
      const digestIndex = adb.commands.findLastIndex((command) => (
        command.join(' ') === (
          `-s ${adb.serial} shell -T cat -- ${adb.expectedDigestPath}`
        )
      ));
      const postDigestCommands = adb.commands.slice(digestIndex + 1)
        .map((command) => command.join(' '));
      expect(postDigestCommands).toContain('devices -l');
      expect(postDigestCommands).toContain(`-s ${adb.serial} reverse --list`);
      expect(postDigestCommands.filter((command) => (
        command === [
          '-s', adb.serial, 'shell', 'cmd', 'package', 'path', '--user', '0',
          DA5_V5_ANDROID_PACKAGE,
        ].join(' ')
      ))).toHaveLength(2);
      expect(postDigestCommands.at(-1)).toBe(
        `-s ${adb.serial} shell ps -A -w -o NAME:4`,
      );
      const commands = adb.commands.map((command) => command.join(' ')).join('\n');
      expect(commands).not.toContain('--remove-all');
      expect(commands).not.toContain('pm clear --user 0 com.example');
      expect(commands.match(/shell pm clear/g)).toHaveLength(1);
    });

  it.each([
    ['missing line ending', 'Success'],
    ['unexpected line ending', 'Success\r\n'],
    ['multiline', 'Success\nprivate detail\n'],
    ['wrong receipt', 'Failure [clear failed]\n'],
  ])('rejects a %s receipt without retry or resume', async (_scenario, receipt) => {
    const adb = new FakeAdb();
    await install(adb);
    adb.packageClearReceipt = receipt;

    await expect(clearEmployeePackage(adb)).rejects.toThrow(
      /package-clear receipt mismatch/,
    );
    await expect(clearEmployeePackage(adb)).rejects.toThrow(
      /package-clear binding is unavailable/,
    );

    expect(packageClearCommands(adb)).toHaveLength(1);
    expect(adb.packageInstalled).toBe(true);
  });

  it('fails closed on timeout and blocks a second clear attempt', async () => {
    const adb = new FakeAdb();
    await install(adb);
    adb.errorOnce = (arguments_) => (
      arguments_.join(' ') === packageClearCommand(adb.serial).join(' ')
        ? new Da5V5AndroidCommandTimeoutError()
        : null
    );

    await expect(clearEmployeePackage(adb)).rejects.toBeInstanceOf(
      Da5V5AndroidCommandTimeoutError,
    );
    await expect(clearEmployeePackage(adb)).rejects.toThrow(
      /package-clear binding is unavailable/,
    );

    expect(packageClearCommands(adb)).toHaveLength(1);
  });

  it('fails closed when the exact device drifts after the clear receipt', async () => {
    const adb = new FakeAdb();
    await install(adb);
    adb.afterPackageClear = () => adb.replaceDevice('replacement-device');

    await expect(clearEmployeePackage(adb)).rejects.toThrow(
      /device continuity mismatch/,
    );

    expect(packageClearCommands(adb)).toHaveLength(1);
  });

  it.each([
    ['package', (adb: FakeAdb) => { adb.packageInstalled = false; }],
    ['process', (adb: FakeAdb) => { adb.processes = [DA5_V5_ANDROID_PACKAGE]; }],
    ['reverse mapping', (adb: FakeAdb) => { adb.mappings.delete('tcp:3000'); }],
    ['installed bytes', (adb: FakeAdb) => { adb.installedSha256 = 'f'.repeat(64); }],
  ] as const)('fails the post-clear %s reattestation without another clear', async (
    _scenario,
    drift,
  ) => {
    const adb = new FakeAdb();
    await install(adb);
    adb.afterPackageClear = () => drift(adb);

    await expect(clearEmployeePackage(adb)).rejects.toThrow();

    expect(packageClearCommands(adb)).toHaveLength(1);
  });

  it.each([
    ['Product process', (adb: FakeAdb) => {
      adb.processes = [DA5_V5_ANDROID_PACKAGE];
    }],
    ['owned reverse mapping', (adb: FakeAdb) => {
      adb.mappings.delete('tcp:3000');
    }],
    ['bound device', (adb: FakeAdb) => {
      adb.replaceDevice('replacement-device');
    }],
  ] as const)('fails closed when the %s drifts during the final APK digest', async (
    _scenario,
    drift,
  ) => {
    const adb = new FakeAdb();
    await install(adb);
    adb.afterBinaryDigest = () => drift(adb);

    await expect(clearEmployeePackage(adb)).rejects.toThrow();
    await expect(clearEmployeePackage(adb)).rejects.toThrow(
      /package-clear binding is unavailable/,
    );

    expect(packageClearCommands(adb)).toHaveLength(1);
  });

  it('fails closed when post-clear APK provenance or signer verification is unavailable',
    async () => {
      const adb = new FakeAdb();
      await install(adb);
      const verifyArtifact = vi.fn(() => {
        throw new Error('private signer detail');
      });

      await expect(clearEmployeePackage(adb, verifyArtifact)).rejects.toThrow(
        'private signer detail',
      );

      expect(verifyArtifact).toHaveBeenCalledTimes(1);
      expect(packageClearCommands(adb)).toHaveLength(1);
    });

  it('serializes concurrent calls at the transaction boundary before a second mutation',
    async () => {
      const adb = new FakeAdb();
      await install(adb);

      const first = clearEmployeePackage(adb);
      const second = clearEmployeePackage(adb);
      await expect(second).rejects.toThrow(/package-clear binding is unavailable/);
      await expect(first).resolves.toMatchObject({ status: 'match' });

      expect(packageClearCommands(adb)).toHaveLength(1);
    });
});

describe('DA5 V5 read-only device preinstall preflight', () => {
  const standardBinding = Object.freeze({
    ...deviceBinding,
    androidApi: '35',
    androidRelease: '15',
    fontScale: '1.0' as const,
  });

  it('single-use binds OS/API/build and the disabled standard accessibility state',
    async () => {
      const adb = new FakeAdb();
      const preflight = new Da5V5AndroidPreinstallPreflight(
        adb,
        new Da5V5UsbSerialBinding(),
        standardBinding,
      );
      await expect(preflight.run()).resolves.toEqual({ status: 'match' });
      expect(preflight.state()).toBe('matched');
      await expect(preflight.run()).resolves.toEqual({ status: 'mismatch' });
      expect(preflight.state()).toBe('failed');
      expect(adb.commands.flat().join(' ')).not.toMatch(
        /\b(?:install|uninstall|reverse tcp:|--remove)\b/u,
      );
      expect(adb.commands.flat().join(' ')).not.toContain('dumpsys package');
    });

  it('fails closed for listener residue before any installation mutation', async () => {
    const adb = new FakeAdb();
    adb.listeners = 'LISTEN 0 50 127.0.0.1:3000 0.0.0.0:*\n';
    const preflight = new Da5V5AndroidPreinstallPreflight(
      adb,
      new Da5V5UsbSerialBinding(),
      standardBinding,
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
        standardBinding,
      );

      await expect(preflight.run()).resolves.toEqual({ status: 'match' });
      expect(maximumActive).toBe(1);
    });

  it.each(['', 'null'])(
    'accepts the exact disabled service-list representation %j',
    async (enabledAccessibilityServices) => {
      const adb = new FakeAdb();
      adb.enabledAccessibilityServices = enabledAccessibilityServices;
      const preflight = new Da5V5AndroidPreinstallPreflight(
        adb,
        new Da5V5UsbSerialBinding(),
        standardBinding,
      );

      await expect(preflight.run()).resolves.toEqual({ status: 'match' });
      expect(adb.commands.flat().join(' ')).not.toContain('dumpsys package');
    },
  );

  it.each([
    ['active TalkBack', '1', `${googleTalkBackPackage}/.TalkBackService`],
    ['disabled with stale service', '0', `${googleTalkBackPackage}/.TalkBackService`],
    ['enabled without service', '1', 'null'],
    ['malformed enabled flag', 'true', 'null'],
    ['foreign service', '0', 'com.example.accessibility/.ForeignService'],
  ])('fails closed for %s standard accessibility state', async (
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
      standardBinding,
    );

    await expect(preflight.run()).resolves.toEqual({ status: 'mismatch' });
    expect(preflight.state()).toBe('failed');
  });

  it('fails closed when the font scale is not the exact standard value', async () => {
    const adb = new FakeAdb();
    adb.fontScale = '2.0';
    const preflight = new Da5V5AndroidPreinstallPreflight(
      adb,
      new Da5V5UsbSerialBinding(),
      standardBinding,
    );
    await expect(preflight.run()).resolves.toEqual({ status: 'mismatch' });
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
      acquireProductResources(adb, {
        ...(adb.packageInstalled ? { package: 'owned' as const } : {}),
        mappings: {
          ...(adb.mappings.has('tcp:54321')
            ? { 'tcp:54321': 'owned' as const }
            : {}),
          ...(adb.mappings.has('tcp:3000')
            ? { 'tcp:3000': 'owned' as const }
            : {}),
        },
      });

      await expect(cleanup(adb)).resolves.toMatchObject({ status: 'match' });
      await expect(cleanup(adb)).resolves.toMatchObject({ status: 'match' });
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
    acquireProductResources(adb);

    await expect(cleanup(adb)).resolves.toMatchObject({ status: 'match' });

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

      await expect(cleanup(adb)).resolves.toMatchObject({ status: 'mismatch' });

      expect(adb.processes).toEqual([`${DA5_V5_ANDROID_PACKAGE}:secondary`]);
      expect(adb.commands.flat()).not.toContain('uninstall');
    });

  it('observes but never removes pre-existing Product-shaped state without resource acquisition',
    async () => {
      const adb = new FakeAdb();
      adb.packageInstalled = true;
      adb.mappings.set('tcp:54321', 'tcp:54321');
      adb.mappings.set('tcp:3000', 'tcp:3000');
      productBinding(adb);

      await expect(cleanup(adb)).resolves.toEqual({
        status: 'mismatch',
        substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseRemoveAuth,
      });

      expect(adb.packageInstalled).toBe(true);
      expect(adb.mappings).toEqual(new Map([
        ['tcp:54321', 'tcp:54321'],
        ['tcp:3000', 'tcp:3000'],
      ]));
      expect(adb.commands.flat()).not.toContain('uninstall');
      expect(adb.commands.flat()).not.toContain('--remove');
    });

  it('preserves unrelated mappings and fails closed without overwriting an owned-port mismatch',
    async () => {
      const unrelated = new FakeAdb();
      unrelated.packageInstalled = true;
      unrelated.mappings.set('tcp:9999', 'tcp:9998');
      unrelated.mappings.set('tcp:54321', 'tcp:54321');
      acquireProductResources(unrelated, {
        mappings: { 'tcp:54321': 'owned' },
        package: 'owned',
      });
      await expect(cleanup(unrelated)).resolves.toMatchObject({ status: 'match' });
      expect(unrelated.mappings).toEqual(new Map([['tcp:9999', 'tcp:9998']]));
      expect(unrelated.packageInstalled).toBe(false);

      const mismatch = new FakeAdb();
      mismatch.packageInstalled = true;
      mismatch.mappings.set('tcp:54321', 'tcp:3999');
      mismatch.mappings.set('tcp:3000', 'tcp:3000');
      acquireProductResources(mismatch);
      await expect(cleanup(mismatch)).resolves.toMatchObject({ status: 'mismatch' });
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
    acquireProductResources(adb);
    const first = cleanup(adb);
    const second = cleanup(adb);
    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ status: 'match' });
    expect(adb.commands.filter((command) => command.includes('uninstall'))).toHaveLength(1);
    expect(JSON.stringify(await first)).not.toContain(adb.serial);
  });

  it('retains one successful package-removal flight across inner and outer cleanup', async () => {
    const adb = cleanupFixture();

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'match',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
    });
    await expect(cleanup(adb)).resolves.toEqual({
      status: 'match',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
    });

    expect(adb.commands.filter((command) => (
      command.slice(2).join(' ') === `uninstall ${DA5_V5_ANDROID_PACKAGE}`
    ))).toHaveLength(1);
  });

  it('retains one failed package-removal flight across inner and outer cleanup', async () => {
    const adb = cleanupFixture();
    adb.uninstallReceipt = 'Failure [DELETE_FAILED_INTERNAL_ERROR]\n';

    const expected = {
      status: 'mismatch' as const,
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.packageUninstall,
    };
    await expect(cleanup(adb)).resolves.toEqual(expected);
    await expect(cleanup(adb)).resolves.toEqual(expected);

    expect(adb.packageInstalled).toBe(true);
    expect(adb.commands.filter((command) => (
      command.slice(2).join(' ') === `uninstall ${DA5_V5_ANDROID_PACKAGE}`
    ))).toHaveLength(1);
  });

  it('never uninstalls again when package residue reappears during final-zero observation',
    async () => {
      const adb = new FakeAdb();
      adb.packageInstalled = true;
      adb.latePackageVisibilityAtMilliseconds = [5_000];
      acquireProductResources(adb, { package: 'uncertain' });

      await expect(cleanupDa5V5AndroidState({
        deviceBinding,
        installationState: 'uncertain',
        profile: 'da5-v5',
        ...productCleanupBindings(adb),
        ...virtualTiming(adb),
      })).resolves.toEqual({
        status: 'mismatch',
        substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.installAbandon,
      });

      expect(adb.elapsedMilliseconds).toBe(5_000);
      expect(adb.packageInstalled).toBe(true);
      expect(adb.commands.filter((command) => (
        command.slice(2).join(' ') === `uninstall ${DA5_V5_ANDROID_PACKAGE}`
      ))).toHaveLength(1);
    });

  it('retries one transient device reattestation failure without broad mutation', async () => {
    const adb = cleanupFixture();
    adb.failCounts.set('devices -l', 1);

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'match',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
    });

    expect(initialCleanupReattestationCount(adb)).toBe(2);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
    assertNoBroadDeviceMutation(adb);
  });

  it.each([
    ['abort', new Da5V5AndroidCommandAbortError()],
    ['permanent exit', new Da5V5AndroidCommandExitError()],
    ['untyped failure', new Error('permanent fake failure')],
  ])('does not retry a %s during device reattestation', async (_scenario, error) => {
    const adb = cleanupFixture();
    adb.errorOnce = (arguments_) => (
      arguments_.join(' ') === 'devices -l' ? error : null
    );

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.deviceReattest,
    });

    expect(adb.commands.filter((command) => command.join(' ') === 'devices -l'))
      .toHaveLength(1);
    expect(adb.commands.flat()).not.toContain('uninstall');
    expect(adb.commands.flat()).not.toContain('--remove');
  });

  it('retries one transient reverse-list failure and completes exact cleanup', async () => {
    const adb = cleanupFixture();
    const listCommand = `-s ${adb.serial} reverse --list`;
    adb.failCounts.set(listCommand, 1);

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'match',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
    });

    expect(initialCleanupReverseListCount(adb, listCommand)).toBe(2);
    expect(adb.packageInstalled).toBe(false);
    expect(adb.mappings).toEqual(new Map());
  });

  it('retries one typed timeout during reverse-list observation', async () => {
    const adb = cleanupFixture();
    const listCommand = `-s ${adb.serial} reverse --list`;
    adb.errorOnce = (arguments_) => (
      arguments_.join(' ') === listCommand
        ? new Da5V5AndroidCommandTimeoutError()
        : null
    );

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'match',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
    });
    expect(initialCleanupReverseListCount(adb, listCommand)).toBe(2);
  });

  it.each([
    ['abort', new Da5V5AndroidCommandAbortError()],
    ['permanent exit', new Da5V5AndroidCommandExitError()],
  ])('does not retry a %s during reverse-list observation', async (_scenario, error) => {
    const adb = cleanupFixture();
    const listCommand = `-s ${adb.serial} reverse --list`;
    adb.errorOnce = (arguments_) => (
      arguments_.join(' ') === listCommand ? error : null
    );

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseList,
    });
    expect(initialCleanupReverseListCount(adb, listCommand)).toBe(1);
    expect(adb.packageInstalled).toBe(false);
  });

  it('does not retry malformed reverse-list output', async () => {
    const adb = cleanupFixture();
    const listCommand = `-s ${adb.serial} reverse --list`;
    adb.rawReverseLines = ['malformed'];

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseList,
    });
    expect(initialCleanupReverseListCount(adb, listCommand)).toBe(1);
    expect(adb.packageInstalled).toBe(false);
  });

  it('retries both exact reverse removals independently', async () => {
    const adb = cleanupFixture();
    for (const device of ['tcp:54321', 'tcp:3000']) {
      adb.failCounts.set(`-s ${adb.serial} reverse --remove ${device}`, 1);
    }

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'match',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
    });

    for (const device of ['tcp:54321', 'tcp:3000']) {
      expect(adb.commands.filter((command) => (
        command.join(' ') === `-s ${adb.serial} reverse --remove ${device}`
      ))).toHaveLength(2);
    }
    expect(adb.mappings).toEqual(new Map());
  });

  it.each([
    ['abort', new Da5V5AndroidCommandAbortError()],
    ['permanent exit', new Da5V5AndroidCommandExitError()],
  ])('does not retry a %s during exact reverse removal', async (_scenario, error) => {
    const adb = cleanupFixture();
    const removeCommand = `-s ${adb.serial} reverse --remove tcp:54321`;
    adb.errorOnce = (arguments_) => (
      arguments_.join(' ') === removeCommand ? error : null
    );

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseRemoveAuth,
    });
    expect(adb.commands.filter((command) => command.join(' ') === removeCommand))
      .toHaveLength(1);
    expect(adb.mappings).toEqual(new Map([['tcp:54321', 'tcp:54321']]));
    expect(adb.packageInstalled).toBe(false);
  });

  it('records partial progress when one exact reverse removal remains unavailable', async () => {
    const adb = cleanupFixture();
    const failedRemoval = `-s ${adb.serial} reverse --remove tcp:54321`;
    adb.failCounts.set(failedRemoval, 2);

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseRemoveAuth,
    });

    expect(adb.commands.filter((command) => command.join(' ') === failedRemoval))
      .toHaveLength(2);
    expect(adb.mappings).toEqual(new Map([['tcp:54321', 'tcp:54321']]));
    expect(adb.packageInstalled).toBe(false);
  });

  it('continues package cleanup after the bounded reverse-list retries are exhausted',
    async () => {
      const adb = cleanupFixture();
      adb.failCounts.set(`-s ${adb.serial} reverse --list`, 2);

      await expect(cleanup(adb)).resolves.toEqual({
        status: 'mismatch',
        substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseList,
      });

      expect(adb.packageInstalled).toBe(false);
      expect(adb.mappings).toEqual(new Map([
        ['tcp:54321', 'tcp:54321'],
        ['tcp:3000', 'tcp:3000'],
      ]));
    });

  it('fails closed instead of coalescing an uncertain-install cleanup into a weaker flight',
    async () => {
      const adb = new FakeAdb();
      const serialBinding = boundSerial(adb);
      const transaction = productTransaction(adb, serialBinding);
      const ordinary = cleanupDa5V5AndroidState({
        deviceBinding,
        profile: 'da5-v5',
        runner: adb,
        serialBinding,
        transaction,
        ...virtualTiming(adb),
      });
      await expect(ordinary).resolves.toMatchObject({ status: 'match' });
      const commandCount = adb.commands.length;
      const uncertain = cleanupDa5V5AndroidState({
        deviceBinding,
        installationState: 'uncertain',
        profile: 'da5-v5',
        runner: adb,
        serialBinding,
        transaction,
        ...virtualTiming(adb),
      });
      await expect(uncertain).resolves.toEqual({
        status: 'mismatch',
        substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.uncertaintyEscalation,
      });
      expect(adb.commands).toHaveLength(commandCount);
    });

  it('accepts only exact UsbFfs reverse transport and requires a true zero state', async () => {
    expect(parseDa5V5ReverseMappings(
      'UsbFfs tcp:54321 tcp:54321\nUsbFfs tcp:3000 tcp:3000\n',
      'bound-serial',
    )).toEqual([
      { device: 'tcp:54321', host: 'tcp:54321' },
      { device: 'tcp:3000', host: 'tcp:3000' },
    ]);
    for (const value of [
      'malformed\n',
      'UsbFfs tcp:54321 tcp:54321 extra-column\n',
      'UsbFfs localabstract:unexpected tcp:3000\n',
      'bound-serial tcp:54321 tcp:54321\n',
      'usbffs tcp:54321 tcp:54321\n',
      'UsbFfs tcp:0 tcp:3000\n',
      'UsbFfs tcp:65536 tcp:3000\n',
      'UsbFfs tcp:54321 tcp:54321\nUsbFfs tcp:54321 tcp:3000\n',
    ]) {
      expect(() => parseDa5V5ReverseMappings(value, 'bound-serial')).toThrow(
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
    const transaction = productTransaction(adb, serialBinding);
    adb.packageInstalled = true;
    adb.mappings.set('tcp:54321', 'tcp:54321');
    transaction.markZeroPreconditionProven();
    transaction.markReverseMutationStarted('tcp:54321');
    transaction.markReverseMutationProven('tcp:54321');
    transaction.markSessionCreateStarted();
    transaction.markSessionCommitted();
    adb.replaceDevice('replacement-device');

    await expect(cleanupDa5V5AndroidState({
      deviceBinding,
      profile: 'da5-v5',
      runner: adb,
      serialBinding,
      transaction,
      wait: async () => undefined,
    })).resolves.toEqual({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.deviceReattest,
    });

    expect(adb.commands.filter((command) => (
      command[0] === '-s' && command[1] === 'replacement-device'
    )).map((command) => command.slice(2).join(' '))).not.toContain(
      `uninstall ${DA5_V5_ANDROID_PACKAGE}`,
    );
    expect(adb.packageInstalled).toBe(true);
    expect(adb.mappings.get('tcp:54321')).toBe('tcp:54321');
  });

  it('never mutates an ambiguous device set during cleanup', async () => {
    const adb = cleanupFixture();
    adb.devices.push({
      details: 'usb:second product:synthetic model:synthetic transport_id:2',
      serial: 'second-device',
      state: 'device',
    });

    await expect(cleanup(adb)).resolves.toEqual({
      status: 'mismatch',
      substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.deviceReattest,
    });

    expect(adb.packageInstalled).toBe(true);
    expect(adb.mappings).toEqual(new Map([
      ['tcp:54321', 'tcp:54321'],
      ['tcp:3000', 'tcp:3000'],
    ]));
    expect(adb.commands.flat()).not.toContain('uninstall');
    expect(adb.commands.flat()).not.toContain('--remove');
    expect(adb.commands.filter((command) => command.join(' ') === 'devices -l'))
      .toHaveLength(1);
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
        profile: 'da5-v5',
        reverifyArtifact: vi.fn(() => verifiedSource()),
        signal: abort.signal,
        verifyArtifact: vi.fn(),
        ...productInstallBindings(adb),
        ...virtualTiming(adb),
      })).rejects.toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.signalAbort,
        cleanupStatus: 'match',
        cleanupSubstage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.complete,
      });
      expect(abort.signal.aborted).toBe(true);
      expect(adb.mappings).toEqual(new Map());
      expect(adb.packageInstalled).toBe(false);
    });

  it('observes late package residue without another uninstall in the uncertain final proof',
    async () => {
      const adb = new FakeAdb();
      adb.failOnce = (arguments_) => (
        isInstallCommand(arguments_)
      );
      adb.lateOwnedMappingVisibilityAtMilliseconds = [5_000];
      adb.latePackageVisibilityAtMilliseconds = [5_000];

      await expect(install(adb)).rejects.toMatchObject({
        category: DA5_V5_ANDROID_INSTALL_FAILURE_CATEGORIES.childStartTransport,
        cleanupStatus: 'mismatch',
        cleanupSubstage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.installAbandon,
      });

      expect(adb.elapsedMilliseconds).toBe(5_000);
      expect(adb.packageInstalled).toBe(true);
      expect(adb.commands.filter((command) => (
        command.slice(2).join(' ') === `uninstall ${DA5_V5_ANDROID_PACKAGE}`
      ))).toHaveLength(0);
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
      acquireProductResources(adb, {
        mappings: {
          'tcp:3000': 'owned',
          'tcp:54321': 'owned',
        },
      });

      await expect(cleanupDa5V5AndroidState({
        deviceBinding,
        profile: 'da5-v5',
        reverseState: 'uncertain',
        ...productCleanupBindings(adb),
        ...virtualTiming(adb),
      })).resolves.toMatchObject({ status: 'match' });

      expect(adb.elapsedMilliseconds).toBeGreaterThanOrEqual(20_000);
      expect(adb.commands.filter((command) => (
        command.slice(2).join(' ') === 'reverse --remove tcp:3000'
      ))).toHaveLength(2);
      expect(adb.mappings).toEqual(new Map());
    });

  it('never lets reattestation, retry waits, or reverse-list reads exceed one 60-second deadline',
    async () => {
      const adb = new FakeAdb();
      acquireProductResources(adb, {
        mappings: { 'tcp:54321': 'uncertain' },
      });
      adb.commandDurations.set('devices -l', 14_000);
      adb.commandDurations.set(
        `-s ${adb.serial} shell getprop ro.product.model`,
        14_000,
      );
      adb.commandDurations.set(
        `-s ${adb.serial} shell getprop ro.build.fingerprint`,
        14_000,
      );
      adb.commandDurations.set(`-s ${adb.serial} reverse --list`, 20_000);

      await expect(cleanupDa5V5AndroidState({
        deviceBinding,
        profile: 'da5-v5',
        reverseState: 'uncertain',
        ...productCleanupBindings(adb),
        ...virtualTiming(adb),
      })).resolves.toEqual({
        status: 'mismatch',
        substage: DA5_V5_ANDROID_CLEANUP_SUBSTAGES.reverseList,
      });

      expect(adb.elapsedMilliseconds).toBe(60_000);
      expect(adb.commands.filter((command) => (
        command.join(' ') === `-s ${adb.serial} reverse --list`
      ))).toHaveLength(2);
      for (const observation of adb.commandOptions) {
        expect(observation.timeoutMilliseconds).toBeGreaterThan(0);
        expect(observation.timeoutMilliseconds).toBeLessThanOrEqual(
          60_000 - observation.startedAtMilliseconds,
        );
      }
    });
});

class FakeAdb implements Da5V5AndroidAdbRunner {
  accessibilityEnabled = '0';
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
  enabledAccessibilityServices = 'null';
  fontScale = '1.0';
  commandDurations = new Map<string, number>();
  errorOnce: ((arguments_: readonly string[]) => Error | null) | null = null;
  failCounts = new Map<string, number>();
  failOnce: ((arguments_: readonly string[]) => boolean) | null = null;
  elapsedMilliseconds = 0;
  lateOwnedMappingVisibilityAtMilliseconds: number[] = [];
  latePackageVisibilityAtMilliseconds: number[] = [];
  mappings = new Map<string, string>();
  listeners = '';
  packageInstalled = false;
  packageClearReceipt = 'Success\n';
  afterPackageClear: (() => void) | null = null;
  afterBinaryDigest: (() => void) | null = null;
  installAbandonReceipt = 'Success\n';
  installCommitReceipt = 'Success\n';
  installCreateReceipt = 'Success: created install session [42]\n';
  installInputObserved = false;
  installSessionPending = false;
  uninstallReceipt = 'Success\n';
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
  reverseTransport = 'UsbFfs';
  serial = 'synthetic-device';
  talkBackPackage: typeof googleTalkBackPackage | typeof samsungTalkBackPackage = (
    googleTalkBackPackage
  );
  talkBackVersion = '15.1.0';
  commandOptions: Array<{
    arguments_: readonly string[];
    maximumBytes?: number;
    signal?: AbortSignal;
    startedAtMilliseconds: number;
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
    const failureKey = arguments_.join(' ');
    const startedAtMilliseconds = this.elapsedMilliseconds;
    this.commands.push([...arguments_]);
    this.commandOptions.push({
      arguments_: [...arguments_],
      startedAtMilliseconds,
      ...options,
    });
    if (options.signal?.aborted === true) {
      throw new Da5V5AndroidCommandAbortError();
    }
    const commandDuration = this.commandDurations.get(failureKey) ?? 0;
    if (
      options.timeoutMilliseconds !== undefined
      && commandDuration > options.timeoutMilliseconds
    ) {
      this.elapsedMilliseconds += options.timeoutMilliseconds;
      throw new Da5V5AndroidCommandTimeoutError();
    }
    this.elapsedMilliseconds += commandDuration;
    const injectedError = this.errorOnce?.(arguments_);
    if (injectedError !== null && injectedError !== undefined) {
      this.errorOnce = null;
      throw injectedError;
    }
    const remainingFailures = this.failCounts.get(failureKey) ?? 0;
    if (remainingFailures > 0) {
      this.failCounts.set(failureKey, remainingFailures - 1);
      throw new Da5V5AndroidCommandTransientError();
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
    if (text === 'shell settings get system font_scale') return `${this.fontScale}\n`;
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
      if (this.uninstallReceipt === 'Success\n') {
        this.packageInstalled = false;
        this.processes = [];
      }
      return this.uninstallReceipt;
    }
    if (arguments_.join(' ') === packageClearCommand(this.serial).join(' ')) {
      if (this.packageClearReceipt === 'Success\n') {
        this.processes = [];
      }
      this.afterPackageClear?.();
      return this.packageClearReceipt;
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
    this.commandOptions.push({
      arguments_: [...arguments_],
      startedAtMilliseconds: this.elapsedMilliseconds,
      ...options,
    });
    if (options.signal?.aborted === true) {
      throw new Error('fake adb aborted');
    }
    if (arguments_.join(' ') !== (
      `-s ${this.serial} shell -T cat -- ${this.expectedDigestPath}`
    )) {
      throw new Error('unexpected fake binary adb command');
    }
    const result = this.binaryDigestRunner?.runBinaryDigest !== undefined
      ? await this.binaryDigestRunner.runBinaryDigest(arguments_, options)
      : Object.freeze({
          bytes: DA5_V5_ANDROID_ARTIFACT.apk.bytes,
          sha256: this.installedSha256,
        });
    this.afterBinaryDigest?.();
    return result;
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
    this.adb.commandOptions.push({
      arguments_: [...arguments_],
      startedAtMilliseconds: this.adb.elapsedMilliseconds,
      ...options,
    });
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
    profile: 'da5-v5',
    reverifyArtifact: vi.fn(() => verifiedSource()),
    verifyArtifact: vi.fn(),
    ...productInstallBindings(adb),
    ...virtualTiming(adb),
  });
}

function clearEmployeePackage(
  adb: FakeAdb,
  verifyArtifact = vi.fn(() => Object.freeze({
    packageName: DA5_V5_ANDROID_PACKAGE,
    status: 'match' as const,
  })),
) {
  return clearDa5V5AndroidPackageForEmployeePreparation({
    deviceBinding,
    profile: 'da5-v5',
    runner: adb,
    verifyArtifact,
    ...productBinding(adb),
  });
}

function cleanup(adb: FakeAdb) {
  return cleanupDa5V5AndroidState({
    deviceBinding,
    profile: 'da5-v5',
    ...productCleanupBindings(adb),
    wait: async () => undefined,
  });
}

function cleanupFixture(): FakeAdb {
  const adb = new FakeAdb();
  adb.packageInstalled = true;
  adb.mappings.set('tcp:54321', 'tcp:54321');
  adb.mappings.set('tcp:3000', 'tcp:3000');
  acquireProductResources(adb);
  return adb;
}

type ProductCleanupResourceOptions = Readonly<{
  mappings?: Readonly<Partial<Record<'tcp:3000' | 'tcp:54321', 'owned' | 'uncertain'>>>;
  package?: 'owned' | 'uncertain';
}>;

function acquireProductResources(
  adb: FakeAdb,
  options: ProductCleanupResourceOptions = Object.freeze({
    mappings: Object.freeze({
      'tcp:3000': 'owned',
      'tcp:54321': 'owned',
    }),
    package: 'owned',
  }),
): ProductTransactionBinding {
  const binding = productBinding(adb);
  binding.transaction.markZeroPreconditionProven();
  for (const device of ['tcp:54321', 'tcp:3000'] as const) {
    const state = options.mappings?.[device];
    if (state === undefined) continue;
    binding.transaction.markReverseMutationStarted(device);
    if (state === 'owned') {
      binding.transaction.markReverseMutationProven(device);
    }
  }
  if (options.package !== undefined) {
    binding.transaction.markSessionCreateStarted();
    if (options.package === 'owned') {
      binding.transaction.markSessionCommitted();
    }
  }
  return binding;
}

type ProductTransactionBinding = Readonly<{
  serialBinding: Da5V5UsbSerialBinding;
  transaction: Da5V5AndroidInstallTransaction;
}>;

const productTransactions = new WeakMap<FakeAdb, ProductTransactionBinding>();

function productTransaction(
  adb: FakeAdb,
  serialBinding: Da5V5UsbSerialBinding = boundSerial(adb),
  installStreamRunner: Da5V5ValidationInstallStreamRunner = adb.installStreamRunner,
): Da5V5AndroidInstallTransaction {
  return new Da5V5AndroidInstallTransaction({
    deviceBinding,
    installStreamRunner,
    runner: adb,
    serialBinding,
  });
}

function productBinding(adb: FakeAdb): ProductTransactionBinding {
  const current = productTransactions.get(adb);
  if (current !== undefined) return current;
  const serialBinding = boundSerial(adb);
  const transaction = productTransaction(adb, serialBinding);
  const binding = Object.freeze({ serialBinding, transaction });
  productTransactions.set(adb, binding);
  return binding;
}

function productInstallBindings(adb: FakeAdb) {
  return {
    installStreamRunner: adb.installStreamRunner,
    runner: adb,
    ...productBinding(adb),
  };
}

function productCleanupBindings(adb: FakeAdb) {
  return {
    runner: adb,
    ...productBinding(adb),
  };
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

function initialCleanupReverseListCount(adb: FakeAdb, listCommand: string): number {
  const packageObservation = adb.commands.findIndex((command) => (
    command.slice(2).join(' ') === (
      `shell cmd package list packages -a -u --user 0 ${DA5_V5_ANDROID_PACKAGE}`
    )
  ));
  const initialStage = adb.commands.slice(
    0,
    packageObservation === -1 ? adb.commands.length : packageObservation,
  );
  return initialStage.filter((command) => command.join(' ') === listCommand).length;
}

function initialCleanupReattestationCount(adb: FakeAdb): number {
  const reverseObservation = adb.commands.findIndex((command) => (
    command.slice(2).join(' ') === 'reverse --list'
  ));
  const initialStage = adb.commands.slice(
    0,
    reverseObservation === -1 ? adb.commands.length : reverseObservation,
  );
  return initialStage.filter((command) => command.join(' ') === 'devices -l').length;
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

function packageClearCommand(serial: string): string[] {
  return [
    '-s', serial, 'shell', 'pm', 'clear', '--user', '0',
    DA5_V5_ANDROID_PACKAGE,
  ];
}

function packageClearCommands(adb: FakeAdb): string[][] {
  return adb.commands.filter((command) => command.includes('clear'));
}

function isInstallCommand(arguments_: readonly string[]): boolean {
  return arguments_.join(' ') === installCreateCommand(arguments_[1] ?? '').join(' ');
}
