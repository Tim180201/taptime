import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  chmodSync,
  closeSync,
  constants as fileConstants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { Da5V5UsbSerialBinding } from '../../scripts/da5V5AndroidDevice.mjs';
import {
  runDa5V5ValidationPhase0Operator,
} from '../../scripts/da5V5ValidationPhase0Operator.mjs';
import {
  DA5_V5_VALIDATION_PHASE0_ACTIVITY,
  DA5_V5_VALIDATION_PHASE0_ARTIFACT,
  DA5_V5_VALIDATION_PHASE0_PROFILE,
  Da5V5ValidationPhase0Device,
  createDa5V5ValidationPhase0Session,
  parseDa5V5ValidationAndroidUserTopology,
  parseDa5V5ValidationInstalledBaseApkPath,
  parseDa5V5ValidationInstalledStat,
  sealDa5V5ValidationInstallSnapshot,
  verifyAndSealDa5V5ValidationPhase0Artifact,
  verifyDa5V5ValidationInstalledArtifact,
} from '../../scripts/da5V5ValidationPhase0OperatorCore.mjs';

const packageName = 'com.tim180201.mobile.validation';
const validPath =
  `/data/app/~~Qm~4g_Jx+=/${packageName}-A1~b_2+=/base.apk`;
const replacementPath =
  `/data/app/~~replacement/${packageName}-replacement/base.apk`;
const model = 'BOUND-MODEL';
const build = 'BOUND-BUILD';
const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('DA5 V5 Validation Phase-0 CLI signals', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)(
    'keeps %s handled and idempotent through a deterministic double signal',
    async (signalName) => {
      const processTarget = new EventEmitter();
      const input = new PassThrough();
      const output = new PassThrough();
      let resolveDone!: (
        result: Readonly<{ status: 'match' | 'mismatch' }>,
      ) => void;
      const done = new Promise<Readonly<{
        status: 'match' | 'mismatch';
      }>>((resolvePromise) => {
        resolveDone = resolvePromise;
      });
      const signal = vi.fn(() => done);
      const session = {
        done,
        end: vi.fn(() => done),
        fail: vi.fn(() => done),
        signal,
        start: vi.fn(async () => ({ status: 'match' as const })),
        submit: vi.fn(async () => undefined),
      };

      const running = runDa5V5ValidationPhase0Operator({
        arguments_: [],
        createSession: () => session,
        environment: {},
        input,
        output,
        processTarget,
      });

      expect(processTarget.listenerCount('SIGINT')).toBe(1);
      expect(processTarget.listenerCount('SIGTERM')).toBe(1);
      processTarget.emit(signalName);
      processTarget.emit(signalName);
      expect(signal).toHaveBeenCalledTimes(1);
      expect(processTarget.listenerCount(signalName)).toBe(1);

      resolveDone({ status: 'mismatch' });
      await expect(running).resolves.toEqual({ status: 'mismatch' });
      expect(processTarget.listenerCount('SIGINT')).toBe(0);
      expect(processTarget.listenerCount('SIGTERM')).toBe(0);
      expect(processTarget.listenerCount('uncaughtException')).toBe(0);
      expect(processTarget.listenerCount('unhandledRejection')).toBe(0);
      input.destroy();
      output.destroy();
    },
  );

  it.each(['uncaughtException', 'unhandledRejection'] as const)(
    'keeps %s handled, idempotent and disclosure-safe through a double fatal event',
    async (eventName) => {
      const processTarget = new EventEmitter();
      const input = new PassThrough();
      const output = new PassThrough();
      let disclosed = '';
      output.on('data', (chunk: Buffer) => {
        disclosed += chunk.toString('utf8');
      });
      let resolveDone!: (
        result: Readonly<{ status: 'match' | 'mismatch' }>,
      ) => void;
      const done = new Promise<Readonly<{
        status: 'match' | 'mismatch';
      }>>((resolvePromise) => {
        resolveDone = resolvePromise;
      });
      const fail = vi.fn(() => done);
      const session = {
        done,
        end: vi.fn(() => done),
        fail,
        signal: vi.fn(() => done),
        start: vi.fn(async () => ({ status: 'match' as const })),
        submit: vi.fn(async () => undefined),
      };

      const running = runDa5V5ValidationPhase0Operator({
        arguments_: [],
        createSession: () => session,
        environment: {},
        input,
        output,
        processTarget,
      });

      expect(processTarget.listenerCount(eventName)).toBe(1);
      const secret = new Error('SECRET_FATAL_PAYLOAD');
      processTarget.emit(eventName, secret);
      processTarget.emit(eventName, secret);
      expect(fail).toHaveBeenCalledTimes(1);
      expect(processTarget.listenerCount(eventName)).toBe(1);
      expect(disclosed).not.toContain('SECRET_FATAL_PAYLOAD');

      resolveDone({ status: 'mismatch' });
      await expect(running).resolves.toEqual({ status: 'mismatch' });
      expect(processTarget.listenerCount('uncaughtException')).toBe(0);
      expect(processTarget.listenerCount('unhandledRejection')).toBe(0);
      expect(disclosed).not.toContain('SECRET_FATAL_PAYLOAD');
      input.destroy();
      output.destroy();
    },
  );
});

describe('DA5 V5 Validation Phase-0 installed artifact path', () => {
  it('accepts only the exact running Owner user-0 topology', () => {
    expect(
      parseDa5V5ValidationAndroidUserTopology(
        'Users:\n\tUserInfo{0:Owner:c13} running\n',
      ),
    ).toEqual({
      currentUser: '0',
      mainUser: '0',
      ownerUser: '0',
    });
    for (const value of [
      'Users:\n\tUserInfo{0:Owner:c13} running\n'
        + '\tUserInfo{10:Work profile:30} running\n',
      'Users:\n\tUserInfo{10:Secondary:c13} running\n',
      'Users:\n\tUserInfo{0:Owner:c13}\n',
      'Users:\n',
    ]) {
      expect(() =>
        parseDa5V5ValidationAndroidUserTopology(value),
      ).toThrow();
    }
  });

  it('accepts the canonical Android 15 package path with legitimate ~~ and ~', () => {
    expect(
      parseDa5V5ValidationInstalledBaseApkPath(`package:${validPath}\n`),
    ).toBe(validPath);
  });

  it('accepts a canonical package-specific path without the optional parent', () => {
    const path =
      `/data/app/${packageName}-A~1._+=-/base.apk`;
    expect(
      parseDa5V5ValidationInstalledBaseApkPath(`package:${path}\r\n`),
    ).toBe(path);
  });

  it.each([
    ['empty optional parent', `/data/app/~~/${packageName}-a/base.apk`],
    ['relative traversal', `/data/app/../${packageName}-a/base.apk`],
    ['dot segment', `/data/app/./${packageName}-a/base.apk`],
    ['encoded traversal', `/data/app/%2e%2e/${packageName}-a/base.apk`],
    ['whitespace', `/data/app/~~a b/${packageName}-a/base.apk`],
    ['metacharacter', `/data/app/~~a;id/${packageName}-a/base.apk`],
    ['foreign package', '/data/app/~~abc/com.example.foreign-a/base.apk'],
    ['empty package suffix', `/data/app/~~abc/${packageName}-/base.apk`],
    ['split APK', `/data/app/~~abc/${packageName}-a/split_config.apk`],
    ['extra segment', `/data/app/one/two/${packageName}-a/base.apk`],
  ])('rejects %s', (_label, path) => {
    expect(() =>
      parseDa5V5ValidationInstalledBaseApkPath(`package:${path}\n`),
    ).toThrow();
  });

  it.each([
    `package:${validPath}\npackage:${validPath}\n`,
    `package:${validPath}\n\n`,
    `package:${validPath} extra\n`,
    `package:${validPath}\0\n`,
    validPath,
  ])('rejects multiple, split, controlled or unprefixed output', (value) => {
    expect(() =>
      parseDa5V5ValidationInstalledBaseApkPath(value),
    ).toThrow();
  });

  it('accepts only a stable regular non-writable installed stat', () => {
    expect(
      parseDa5V5ValidationInstalledStat(
        `123:456:${DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes}:81a4\n`,
      ),
    ).toEqual({
      device: '123',
      inode: '456',
      mode: '81a4',
      size: DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes,
    });
    expect(() =>
      parseDa5V5ValidationInstalledStat('1:2:3:41ed\n'),
    ).toThrow();
    expect(() =>
      parseDa5V5ValidationInstalledStat('1:2:3:81b6\n'),
    ).toThrow();
  });
});

describe('DA5 V5 Validation stable-FD install snapshot', () => {
  it('binds the operator verifier to the exact 32-record source closure', () => {
    expect(() =>
      verifyAndSealDa5V5ValidationPhase0Artifact({
        profile: DA5_V5_VALIDATION_PHASE0_PROFILE,
        verifyArtifact(verification: unknown) {
          const binding = verification as {
            expectedSourceClosure: readonly {
              path: string;
              sha256: string;
            }[];
            expectedSourceCommit: string;
            expectedSourceTree: string;
          };
          expect(binding.expectedSourceClosure).toHaveLength(32);
          expect(new Set(
            binding.expectedSourceClosure.map((record) => record.path),
          ).size).toBe(32);
          expect(binding.expectedSourceClosure[0]).toEqual({
            path: 'apps/mobile/app.config.js',
            sha256:
              '1ca63463e07b0c7c7111a653f1549bdad1011219300db771e740537d9908811b',
          });
          expect(binding.expectedSourceClosure.at(-1)).toEqual({
            path: 'package.json',
            sha256:
              '34b577bee93440e296b2d61d8b47265224324a3e75e9f3053aaa7d337ebcd57a',
          });
          expect(binding.expectedSourceCommit).toBe(
            DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceCommit,
          );
          expect(binding.expectedSourceTree).toBe(
            DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceTree,
          );
          throw new Error('source closure observed before snapshot');
        },
      }),
    ).toThrow('source closure observed before snapshot');
  });

  it('reads once through O_NOFOLLOW and zeroizes the single-use snapshot', async () => {
    const fixture = createHostFixture(Buffer.from('exact-apk'));
    const snapshot = sealDa5V5ValidationInstallSnapshot(fixture.binding);
    let exposed: Buffer | undefined;

    await expect(snapshot.use((bytes) => {
      exposed = bytes;
      return bytes.toString('utf8');
    })).resolves.toBe('exact-apk');

    expect(exposed).toBeDefined();
    expect(exposed?.every((byte) => byte === 0)).toBe(true);
    expect(snapshot.state()).toBe('destroyed');
    await expect(snapshot.use(() => undefined)).rejects.toThrow();
  });

  it('rejects a symlink before reading it', () => {
    const fixture = createHostFixture(Buffer.from('exact-apk'));
    const link = join(fixture.directory, 'linked.apk');
    symlinkSync(fixture.path, link);

    expect(() =>
      sealDa5V5ValidationInstallSnapshot({
        ...fixture.binding,
        path: link,
      }),
    ).toThrow();
  });

  it.each([
    ['size', Buffer.from('wrong-size'), 0o444, hash(Buffer.from('wrong-size!'))],
    ['mode', Buffer.from('exact-apk'), 0o644, hash(Buffer.from('exact-apk'))],
    ['hash', Buffer.from('exact-apk'), 0o444, '0'.repeat(64)],
  ])('rejects a %s mismatch', (_label, bytes, mode, sha256) => {
    const fixture = createHostFixture(bytes, mode);
    expect(() =>
      sealDa5V5ValidationInstallSnapshot({
        ...fixture.binding,
        bytes: _label === 'size' ? bytes.length + 1 : bytes.length,
        mode: _label === 'mode' ? 0o444 : mode,
        sha256,
      }),
    ).toThrow();
  });

  it('rejects a late pathname swap while retaining the opened FD', () => {
    const fixture = createHostFixture(Buffer.from('exact-apk'));
    const replacement = join(fixture.directory, 'replacement.apk');
    writeFileSync(replacement, Buffer.from('exact-apk'));
    chmodSync(replacement, 0o444);
    let fstatCalls = 0;

    expect(() =>
      sealDa5V5ValidationInstallSnapshot(
        fixture.binding,
        {
          ...stableFiles(),
          fstat(fileDescriptor) {
            const stat = fstatSync(fileDescriptor);
            fstatCalls += 1;
            if (fstatCalls === 2) renameSync(replacement, fixture.path);
            return stat;
          },
        },
      ),
    ).toThrow();
  });

  it.each([
    ['short', (bytes: Buffer) => bytes.subarray(0, bytes.length - 1)],
    ['long', (bytes: Buffer) => Buffer.concat([bytes, Buffer.of(1)])],
  ])('rejects a %s bounded FD snapshot and zeroizes it', (_label, change) => {
    const fixture = createHostFixture(Buffer.from('exact-apk'));
    let returned: Buffer | undefined;
    expect(() =>
      sealDa5V5ValidationInstallSnapshot(
        fixture.binding,
        {
          ...stableFiles(),
          readFileDescriptor() {
            returned = change(Buffer.from('exact-apk'));
            return returned;
          },
        },
      ),
    ).toThrow();
    expect(returned?.every((byte) => byte === 0)).toBe(true);
  });

  it('zeroizes on consumer failure', async () => {
    const fixture = createHostFixture(Buffer.from('exact-apk'));
    const snapshot = sealDa5V5ValidationInstallSnapshot(fixture.binding);
    let exposed: Buffer | undefined;
    await expect(snapshot.use((bytes) => {
      exposed = bytes;
      throw new Error('consumer secret');
    })).rejects.toThrow('consumer secret');
    expect(exposed?.every((byte) => byte === 0)).toBe(true);
  });
});

describe('DA5 V5 Validation installed byte proof', () => {
  it('accepts exact canonical path/stat/raw bytes and revalidation', async () => {
    const runner = new FakeRunner();
    runner.packagePath = validPath;
    await expect(
      verifyDa5V5ValidationInstalledArtifact({
        runner,
        serial: runner.serial,
      }),
    ).resolves.toMatchObject({
      canonicalPath: validPath,
      path: validPath,
      sha256: DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.sha256,
      status: 'match',
      versionCode: '1',
    });
    expect(runner.binaryCalls).toHaveLength(1);
    expect(runner.binaryCalls[0]?.arguments_).toEqual([
      '-s', runner.serial, 'shell', '-T', 'cat', '--', validPath,
    ]);
    expect(runner.binaryCalls[0]?.maximumBytes).toBe(
      DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes,
    );
  });

  it.each([
    ['short bytes', { digestBytes: 1 }],
    ['long bytes', {
      digestBytes: DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes + 1,
    }],
    ['hash', { digestSha256: '0'.repeat(64) }],
    ['canonical', { canonicalPath: `${validPath}.swap` }],
    ['stat size', { statSize: 7 }],
    ['stat mode', { statMode: '81b6' }],
    ['path drift', {
      pathSequence: [
        validPath,
        `/data/app/~~other/${packageName}-other/base.apk`,
      ],
    }],
    ['stat drift', { statSequence: ['1:2', '1:3'] }],
  ])('rejects %s mismatch', async (_label, changes) => {
    const runner = new FakeRunner();
    runner.packagePath = validPath;
    Object.assign(runner, changes);
    await expect(
      verifyDa5V5ValidationInstalledArtifact({
        runner,
        serial: runner.serial,
      }),
    ).rejects.toThrow();
  });
});

describe('DA5 V5 Validation device and protocol boundary', () => {
  it('verifies the artifact before the first possible ADB spawn', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner, {
      sealArtifact() {
        throw new Error('artifact mismatch');
      },
    });

    await session.start();
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.calls).toHaveLength(0);
  });

  it.each([
    ['zero USB', []],
    ['two USB', [
      { serial: 'ONE', state: 'device', transport: 'usb:1' },
      { serial: 'TWO', state: 'device', transport: 'usb:2' },
    ]],
    ['network', [
      { serial: '192.0.2.1:5555', state: 'device', transport: 'product:x' },
    ]],
    ['emulator', [
      { serial: 'emulator-5554', state: 'device', transport: 'usb:1' },
    ]],
    ['replacement', [
      { serial: 'REPLACEMENT', state: 'device', transport: 'usb:1' },
    ]],
  ])('fails closed for %s device state', async (_label, devices) => {
    const runner = new FakeRunner();
    if (_label === 'replacement') {
      const device = createDevice(runner);
      await device.preflight();
      runner.devices = devices;
      await expect(device.installAndLaunch()).rejects.toThrow();
      await expect(device.cleanup()).resolves.toEqual({ status: 'mismatch' });
      expect(runner.mutations).toHaveLength(0);
      return;
    }
    runner.devices = devices;
    const device = createDevice(runner);
    await expect(device.preflight()).rejects.toThrow();
    expect(runner.mutations).toHaveLength(0);
  });

  it.each([
    ['empty process output', ''],
    ['headerless process output', `${packageName}\n`],
    ['malformed process header', 'PID\n'],
  ])('rejects %s before mutation', async (_label, processOutput) => {
    const runner = new FakeRunner();
    runner.processOutput = processOutput;
    const device = createDevice(runner);
    await expect(device.preflight()).rejects.toThrow();
    expect(runner.mutations).toHaveLength(0);
  });

  it.each([
    ['package residue', { packagePath: validPath }],
    ['main process', { processes: [packageName] }],
    ['secondary process', { processes: [`${packageName}:worker`] }],
    ['reverse residue', {
      reverseOutput: 'SECRET-SERIAL tcp:3000 tcp:3000\n',
    }],
  ])('rejects preinstall %s without mutation', async (_label, changes) => {
    const runner = new FakeRunner();
    Object.assign(runner, changes);
    const device = createDevice(runner);
    await expect(device.preflight()).rejects.toThrow();
    expect(runner.mutations).toHaveLength(0);
  });

  it.each([
    [
      'work profile',
      {
        userListOutput:
          'Users:\n\tUserInfo{0:Owner:c13} running\n'
          + '\tUserInfo{10:Work profile:30} running\n',
      },
    ],
    ['secondary current user', { currentUser: '10' }],
    ['secondary main user', { mainUser: '10' }],
    ['headless system-user mode', { headlessSystemUserMode: 'true' }],
    ['malformed topology', { userListOutput: 'Users:\nmalformed\n' }],
  ])('rejects %s before mutation', async (_label, changes) => {
    const runner = new FakeRunner();
    Object.assign(runner, changes);
    const device = createDevice(runner);
    await expect(device.preflight()).rejects.toThrow();
    expect(runner.mutations).toHaveLength(0);
  });

  it('rejects a work profile created between preflight and install', async () => {
    const runner = new FakeRunner();
    const device = createDevice(runner);
    await device.preflight();
    runner.userListOutput =
      'Users:\n\tUserInfo{0:Owner:c13} running\n'
      + '\tUserInfo{10:Work profile:30} running\n';
    await expect(device.installAndLaunch()).rejects.toThrow();
    expect(runner.mutations).toHaveLength(0);
  });

  it('installs only the snapshot via package-manager stdin and launches exact MainActivity', async () => {
    const runner = new FakeRunner();
    const snapshot = fakeSnapshot();
    const device = createDevice(runner, { snapshot });
    await device.preflight();
    await expect(device.installAndLaunch()).resolves.toEqual({
      status: 'match',
    });
    const install = runner.calls.find((call) =>
      call.arguments_.includes('install'));
    expect(install?.arguments_).toEqual([
      '-s',
      runner.serial,
      'shell',
      '-T',
      'cmd',
      'package',
      'install',
      '-R',
      '--user',
      '0',
      '--pkg',
      packageName,
      '-S',
      String(DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes),
      '-',
    ]);
    expect(install?.arguments_).toContain('-R');
    expect(install?.arguments_.join(' ')).not.toContain(
      DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.path,
    );
    expect(runner.calls.some((call) =>
      call.arguments_.join(' ') === [
        '-s', runner.serial, 'shell', 'am', 'start', '-W',
        '--user', '0', '-n',
        DA5_V5_VALIDATION_PHASE0_ACTIVITY,
      ].join(' '))).toBe(true);
    expect(snapshot.state()).toBe('destroyed');
  });

  it.each([
    ['launch status', { launchStatus: 'error' }],
    ['launch activity', { launchActivity: `${packageName}/.Other` }],
    ['missing process', { omitLaunchedProcess: true }],
    ['secondary process', { launchedProcesses: [
      packageName,
      `${packageName}:worker`,
    ] }],
    ['postlaunch reverse', {
      reverseAfterLaunch: 'SECRET-SERIAL tcp:1 tcp:1\n',
    }],
  ])('automatically cleans up after %s', async (_label, changes) => {
    const runner = new FakeRunner();
    Object.assign(runner, changes);
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.packagePath).toBeNull();
    expect(runner.processes).toEqual([]);
    expect(runner.uninstallCount).toBe(1);
  });

  it('preserves package residue when install failed before provenance was proved', async () => {
    const runner = new FakeRunner();
    runner.installResult = 'Failure [blocked]';
    runner.installFailureLeavesPackage = true;
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.packagePath).toBe(validPath);
    expect(runner.forceStopCount).toBe(0);
    expect(runner.uninstallCount).toBe(0);
  });

  it('uses -R and preserves a package that races package-zero to install', async () => {
    const runner = new FakeRunner();
    runner.installRaceLeavesForeignPackage = true;
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    const install = runner.calls.find((call) =>
      call.arguments_.includes('install'));
    expect(install?.arguments_).toContain('-R');
    expect(runner.packagePath).toBe(replacementPath);
    expect(runner.versionCode).toBe('2');
    expect(runner.forceStopCount).toBe(0);
    expect(runner.uninstallCount).toBe(0);
  });

  it('rejects and preserves a replacement that races the launch receipt', async () => {
    const runner = new FakeRunner();
    runner.packagePathAfterLaunch = replacementPath;
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.packagePath).toBe(replacementPath);
    expect(runner.forceStopCount).toBe(0);
    expect(runner.uninstallCount).toBe(0);
  });

  it('preserves a late package outcome after a timed-out install', async () => {
    const runner = new FakeRunner();
    runner.installReject = true;
    runner.latePackageAfterCleanupReads = 2;
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.uninstallCount).toBe(0);
    expect(runner.packagePath).toBe(validPath);
    expect(runner.forceStopCount).toBe(0);
  });

  it('preserves owned residue after an ambiguous cleanup observation', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    runner.cleanupObservationFailures = 1;
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(runner.cleanupObservationFailures).toBe(0);
    expect(runner.packagePath).toBe(validPath);
    expect(runner.forceStopCount).toBe(0);
    expect(runner.uninstallCount).toBe(0);
    expect(runner.calls.some((call) =>
      call.arguments_.includes('--remove')
      || call.arguments_.includes('--remove-all'))).toBe(false);
  });

  it.each([
    ['malformed package path', 'malformed-package-output\n', 'package'],
    [
      'multiple package paths',
      `package:${validPath}\npackage:${validPath}\n`,
      'package',
    ],
    [
      'foreign package path',
      'package:/data/app/~~foreign/com.example.foreign-a/base.apk\n',
      'package',
    ],
    ['malformed process header', 'PID\n', 'process'],
    ['headerless process output', `${packageName}\n`, 'process'],
  ])(
    'preserves residue after mutated %s becomes ambiguous',
    async (_label, output, observation) => {
      const runner = new FakeRunner();
      const session = createSession(runner);
      await session.start();
      await session.submit('install-launch');
      if (observation === 'package') {
        runner.processes = [];
        runner.cleanupPackageOutputs = [output];
      } else {
        runner.packagePath = null;
        runner.cleanupProcessOutputs = [output];
      }

      await expect(session.submit('cleanup')).resolves.toEqual({
        status: 'mismatch',
      });
      expect(runner.forceStopCount).toBe(0);
      expect(runner.uninstallCount).toBe(0);
      expect(runner.calls.some((call) =>
        call.arguments_.includes('--remove')
        || call.arguments_.includes('--remove-all'))).toBe(false);
    },
  );

  it('retries a transient uninstall failure to two final zero proofs', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    runner.uninstallResults = ['Failure [transient]', 'Success'];
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'match',
    });
    expect(runner.uninstallCount).toBe(2);
    expect(runner.forceStopCount).toBe(2);
    expect(runner.finalZeroObservationsAfterCleanup).toBeGreaterThanOrEqual(2);
    expect(runner.calls.some((call) =>
      call.arguments_.includes('--remove')
      || call.arguments_.includes('--remove-all'))).toBe(false);
  });

  it('preserves a replacement token observed before force-stop', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    runner.packagePath = replacementPath;
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(runner.forceStopCount).toBe(0);
    expect(runner.uninstallCount).toBe(0);
    expect(runner.packagePath).toBe(replacementPath);
  });

  it('preserves a replacement token observed after force-stop', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    runner.packagePathAfterForceStop = replacementPath;
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(runner.forceStopCount).toBe(1);
    expect(runner.uninstallCount).toBe(0);
    expect(runner.packagePath).toBe(replacementPath);
  });

  it('preserves a versionCode replacement observed after force-stop', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    runner.versionCodeAfterForceStop = '2';
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(runner.forceStopCount).toBe(1);
    expect(runner.uninstallCount).toBe(0);
    expect(runner.versionCode).toBe('2');
  });

  it('keeps permanent indeterminate observation cleanup scoped, bounded and explicit', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    runner.cleanupObservationAlwaysFails = true;
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(runner.forceStopCount).toBe(0);
    expect(runner.uninstallCount).toBe(0);
    expect(runner.packagePath).toBe(validPath);
    expect(runner.calls.some((call) =>
      call.arguments_.includes('--remove')
      || call.arguments_.includes('--remove-all'))).toBe(false);
  });

  it('keeps permanent uninstall failure bounded and explicit', async () => {
    const runner = new FakeRunner();
    runner.uninstallResult = 'Failure';
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await session.submit('cleanup');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.uninstallCount).toBeGreaterThan(1);
    expect(runner.waitCount).toBeGreaterThan(1);
    expect(runner.packagePath).toBe(validPath);
  });

  it.each([
    ['wrong first command', 'cleanup'],
    ['unknown command', 'retry'],
    ['duplicate install', 'install-launch'],
  ])('fails closed on %s', async (_label, command) => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    if (_label === 'duplicate install') {
      await session.submit('install-launch');
    }
    await session.submit(command);
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.cleanupFlights).toBe(1);
  });

  it.each(['EOF', 'SIGINT', 'SIGTERM'])(
    'fails closed and cleans exactly once on %s while waiting',
    async (termination) => {
      const runner = new FakeRunner();
      const session = createSession(runner);
      await session.start();
      await session.submit('install-launch');
      if (termination === 'EOF') {
        void session.end();
      } else {
        void session.signal();
      }
      await expect(session.done).resolves.toEqual({ status: 'mismatch' });
      expect(runner.cleanupFlights).toBe(1);
      expect(runner.uninstallCount).toBe(1);
    },
  );

  it('cleans disclosure-safely when signaled before mutation', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    const beforeCleanup = runner.finalZeroObservations;
    void session.signal();
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.mutations).toHaveLength(0);
    expect(
      runner.finalZeroObservations - beforeCleanup,
    ).toBeGreaterThanOrEqual(2);
  });

  it('aborts an active install on signal, waits for settlement, then cleans exactly once', async () => {
    const runner = new FakeRunner();
    runner.installWaitsForAbort = true;
    const session = createSession(runner);
    await session.start();
    const active = session.submit('install-launch');
    await runner.installStarted;
    void session.signal();
    await active;
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.installSettled).toBe(true);
    expect(runner.cleanupFlights).toBe(1);
  });

  it('settles at the first finish deadline when an active child never settles', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const runner = new FakeRunner();
      runner.installNeverSettles = true;
      const session = createSession(runner, {
        now: () => Date.now(),
      });
      await session.start();
      void session.submit('install-launch');
      await runner.installStarted;
      const finishing = session.signal();
      await vi.advanceTimersByTimeAsync(270_000);
      await expect(finishing).resolves.toEqual({ status: 'mismatch' });
      await expect(session.done).resolves.toEqual({ status: 'mismatch' });
      expect(session.state()).toBe('failed');
      expect(runner.forceStopCount).toBe(0);
      expect(runner.uninstallCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('caps every cleanup ADB call and refuses a match at the deadline', async () => {
    const runner = new FakeRunner();
    const device = createDevice(runner);
    await device.preflight();
    const cleanupCallStart = runner.calls.length;
    const deadline = runner.clock + 30_000;
    runner.runDurationMilliseconds = 1_000;
    await expect(device.cleanup({ deadline })).resolves.toEqual({
      status: 'mismatch',
    });
    const cleanupCalls = runner.calls.slice(cleanupCallStart);
    expect(cleanupCalls.length).toBeGreaterThan(0);
    for (const call of cleanupCalls) {
      expect(call.timeoutMilliseconds).toBeGreaterThan(0);
      expect(call.timeoutMilliseconds).toBeLessThanOrEqual(
        deadline - call.clockAtStart,
      );
    }
    expect(runner.mutations).toHaveLength(0);
  });

  it('aborts an active preflight and proves two complete zero observations', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    runner.preflightWaitsForAbort = true;
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
    });
    const starting = session.start();
    await runner.preflightStarted;
    const cleanupCallStart = runner.calls.length;
    void session.signal();
    await starting;
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.preflightSettled).toBe(true);
    expect(runner.mutations).toHaveLength(0);
    const cleanupCalls = runner.calls.slice(cleanupCallStart);
    expect(cleanupCalls.filter((call) =>
      call.arguments_.includes('package')
      && call.arguments_.includes('-a'))).toHaveLength(3);
    expect(cleanupCalls.filter((call) =>
      call.arguments_.includes('ps'))).toHaveLength(3);
    expect(cleanupCalls.filter((call) =>
      call.arguments_.includes('reverse')
      && call.arguments_.includes('--list'))).toHaveLength(3);
    expect(receipts).toContain('cleanup:match');
  });

  it('observes preflight residue without force-stop or uninstall', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    runner.preflightWaitsForAbort = true;
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
    });
    const starting = session.start();
    await runner.preflightStarted;
    runner.packagePath = validPath;
    const cleanupCallStart = runner.calls.length;
    void session.signal();
    await starting;
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.preflightSettled).toBe(true);
    expect(runner.forceStopCount).toBe(0);
    expect(runner.uninstallCount).toBe(0);
    expect(runner.mutations).toHaveLength(0);
    const cleanupCalls = runner.calls.slice(cleanupCallStart);
    expect(cleanupCalls.some((call) =>
      call.arguments_.includes('package')
      && call.arguments_.includes('-a'))).toBe(true);
    expect(receipts).toContain('cleanup:mismatch');
  });

  it('preserves process-only residue without owned package provenance', async () => {
    const runner = new FakeRunner();
    runner.preflightWaitsForAbort = true;
    const session = createSession(runner);
    const starting = session.start();
    await runner.preflightStarted;
    runner.processes = [packageName];
    void session.signal();
    await starting;
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.packagePath).toBeNull();
    expect(runner.processes).toEqual([packageName]);
    expect(runner.forceStopCount).toBe(0);
    expect(runner.uninstallCount).toBe(0);
  });

  it.each([
    ['malformed package path', 'malformed-package-output\n', 'package'],
    [
      'multiple package paths',
      `package:${validPath}\npackage:${validPath}\n`,
      'package',
    ],
    [
      'foreign package path',
      'package:/data/app/~~foreign/com.example.foreign-a/base.apk\n',
      'package',
    ],
    ['malformed process header', 'PID\n', 'process'],
    ['headerless process output', `${packageName}\n`, 'process'],
  ])(
    'rejects pre-mutation %s without force-stop or uninstall',
    async (_label, output, observation) => {
      const runner = new FakeRunner();
      runner.preflightWaitsForAbort = true;
      const session = createSession(runner);
      const starting = session.start();
      await runner.preflightStarted;
      if (observation === 'package') {
        runner.cleanupPackageOutputs = [output];
      } else {
        runner.cleanupProcessOutputs = [output];
      }
      const cleanupCallStart = runner.calls.length;
      void session.signal();
      await starting;
      await expect(session.done).resolves.toEqual({ status: 'mismatch' });
      expect(runner.forceStopCount).toBe(0);
      expect(runner.uninstallCount).toBe(0);
      expect(runner.mutations).toHaveLength(0);
      const cleanupCalls = runner.calls.slice(cleanupCallStart);
      expect(cleanupCalls.some((call) =>
        call.arguments_.includes('package')
        && call.arguments_.includes('-a'))).toBe(true);
      expect(cleanupCalls.some((call) =>
        call.arguments_.includes('ps'))).toBe(true);
      expect(cleanupCalls.some((call) =>
        call.arguments_.includes('reverse')
        && call.arguments_.includes('--list'))).toBe(true);
    },
  );

  it('completes only install-launch then cleanup and proves two final zero observations', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
    });
    await session.start();
    await session.submit('install-launch');
    await session.submit('cleanup');
    await expect(session.done).resolves.toEqual({ status: 'match' });
    expect(runner.finalZeroObservationsAfterCleanup).toBeGreaterThanOrEqual(2);
    expect(runner.cleanupFlights).toBe(1);
    expect(receipts).toContain('waiting:match');
    expect(receipts).toContain('complete:match');
    expect(receipts.join('\n')).not.toContain(runner.serial);
    expect(receipts.join('\n')).not.toContain(model);
    expect(receipts.join('\n')).not.toContain(build);
    expect(receipts.join('\n')).not.toContain(validPath);
    const install = runner.calls.find((call) =>
      call.arguments_.includes('install'));
    const launch = runner.calls.find((call) =>
      call.arguments_.includes('start'));
    const forceStop = runner.calls.find((call) =>
      call.arguments_.includes('force-stop'));
    const uninstall = runner.calls.find((call) =>
      call.arguments_.includes('uninstall'));
    expect(install?.arguments_).toContain('-R');
    for (const call of [install, launch, forceStop, uninstall]) {
      const userIndex = call?.arguments_.indexOf('--user') ?? -1;
      expect(userIndex).toBeGreaterThan(-1);
      expect(call?.arguments_[userIndex + 1]).toBe('0');
    }
    expect(uninstall?.arguments_).toContain('--versionCode');
    expect(uninstall?.arguments_).toContain('1');
    expect(runner.calls.some((call) =>
      call.arguments_[2] === 'uninstall')).toBe(false);
  });

  it.each(['artifact', 'cleanup', 'complete'])(
    'settles fail-closed when the %s receipt throws',
    async (failingStage) => {
      const runner = new FakeRunner();
      const session = createSession(runner, {
        receipt(stage: string) {
          if (stage === failingStage) {
            throw new Error('receipt unavailable');
          }
        },
      });

      if (failingStage === 'artifact') {
        await session.start();
        expect(runner.calls).toHaveLength(0);
      } else {
        await session.start();
        await session.submit('install-launch');
        await session.submit('cleanup');
      }

      await expect(session.done).resolves.toEqual({ status: 'mismatch' });
      expect(session.state()).toBe('failed');
    },
  );

  it.each(['cleanup', 'complete'] as const)(
    'never returns match when the %s receipt reaches the finish deadline',
    async (deadlineStage) => {
      const runner = new FakeRunner();
      const session = createSession(runner, {
        receipt(stage: string) {
          if (stage === deadlineStage) {
            runner.clock += 30_000;
          }
        },
      });
      await session.start();
      await session.submit('install-launch');
      await expect(session.submit('cleanup')).resolves.toEqual({
        status: 'mismatch',
      });
      await expect(session.done).resolves.toEqual({ status: 'mismatch' });
      expect(session.state()).toBe('failed');
    },
  );

  it('settles fail-closed when an unexpected cleanup wait rejects', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner, {
      wait: async () => {
        throw new Error('cleanup wait unavailable');
      },
    });

    await session.start();
    await session.submit('install-launch');
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.uninstallCount).toBe(1);
    expect(session.state()).toBe('failed');
  });

  it('never mutates a reverse mapping and rejects final reverse residue', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    const reverseResidue = 'SECRET-SERIAL tcp:7777 tcp:7777\n';
    runner.reverseOutput = reverseResidue;
    await session.submit('cleanup');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.uninstallCount).toBe(1);
    expect(runner.reverseOutput).toBe(reverseResidue);
    expect(runner.calls.some((call) =>
      call.arguments_.includes('--remove')
      || call.arguments_.includes('--remove-all'))).toBe(false);
  });
});

function createSession(
  runner: FakeRunner,
  changes: Record<string, unknown> = {},
) {
  return createDa5V5ValidationPhase0Session({
    androidBuild: build,
    deviceModel: model,
    now: () => runner.clock,
    profile: DA5_V5_VALIDATION_PHASE0_PROFILE,
    runner,
    sealArtifact: () => fakeSnapshot(),
    serialBinding: new Da5V5UsbSerialBinding(),
    wait: async (milliseconds) => {
      runner.clock += milliseconds;
      runner.onWait();
    },
    ...changes,
  });
}

function createDevice(
  runner: FakeRunner,
  changes: Record<string, unknown> = {},
) {
  return new Da5V5ValidationPhase0Device({
    androidBuild: build,
    deviceModel: model,
    now: () => runner.clock,
    runner,
    serialBinding: new Da5V5UsbSerialBinding(),
    snapshot: fakeSnapshot(),
    wait: async (milliseconds) => {
      runner.clock += milliseconds;
      runner.onWait();
    },
    ...changes,
  });
}

function fakeSnapshot() {
  const bytes = Buffer.from('snapshot');
  let destroyed = false;
  let used = false;
  return {
    destroy() {
      if (!destroyed) {
        destroyed = true;
        bytes.fill(0);
      }
    },
    state() {
      return destroyed ? 'destroyed' as const : used ? 'used' as const : 'ready' as const;
    },
    status: 'match' as const,
    async use<T>(operation: (snapshot: Buffer) => T | Promise<T>) {
      if (destroyed || used) throw new Error('snapshot unavailable');
      used = true;
      try {
        return await operation(bytes);
      } finally {
        destroyed = true;
        bytes.fill(0);
      }
    },
  };
}

class FakeRunner {
  readonly calls: Array<{
    arguments_: string[];
    clockAtStart: number;
    stdinBytes?: Buffer;
    timeoutMilliseconds?: number;
  }> = [];
  readonly binaryCalls: Array<{
    arguments_: string[];
    maximumBytes: number;
  }> = [];
  readonly mutations: string[] = [];
  serial = 'SECRET-SERIAL';
  devices = [
    { serial: this.serial, state: 'device', transport: 'usb:1' },
  ];
  packagePath: string | null = null;
  versionCode = '1';
  userListOutput = 'Users:\n\tUserInfo{0:Owner:c13} running\n';
  mainUser = '0';
  currentUser = '0';
  headlessSystemUserMode = 'false';
  processes: string[] = [];
  cleanupPackageOutputs: string[] = [];
  cleanupProcessOutputs: string[] = [];
  processOutput?: string;
  reverseOutput = '';
  reverseAfterLaunch?: string;
  canonicalPath?: string;
  statSize = DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes;
  statMode = '81a4';
  statSequence?: string[];
  pathSequence?: string[];
  digestBytes = DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes;
  digestSha256 = DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.sha256;
  installResult = 'Success';
  installFailureLeavesPackage = false;
  installRaceLeavesForeignPackage = false;
  installReject = false;
  installNeverSettles = false;
  installWaitsForAbort = false;
  installSettled = false;
  launchStatus = 'ok';
  launchActivity = DA5_V5_VALIDATION_PHASE0_ACTIVITY;
  omitLaunchedProcess = false;
  launchedProcesses?: string[];
  packagePathAfterLaunch?: string;
  uninstallResult = 'Success';
  uninstallResults?: string[];
  uninstallCount = 0;
  forceStopCount = 0;
  packagePathAfterForceStop?: string;
  versionCodeAfterForceStop?: string;
  cleanupObservationFailures = 0;
  cleanupObservationAlwaysFails = false;
  cleanupFlights = 0;
  waitCount = 0;
  finalZeroObservations = 0;
  finalZeroObservationsAfterCleanup = 0;
  latePackageAfterCleanupReads = 0;
  cleanupPackageReads = 0;
  lateOutcomeArmed = false;
  private installedProofPathReads = 0;
  private statReads = 0;
  private cleanupStarted = false;
  clock = 0;
  runDurationMilliseconds = 0;
  private resolveInstallStarted!: () => void;
  private resolvePreflightStarted!: () => void;
  readonly installStarted = new Promise<void>((resolvePromise) => {
    this.resolveInstallStarted = resolvePromise;
  });
  readonly preflightStarted = new Promise<void>((resolvePromise) => {
    this.resolvePreflightStarted = resolvePromise;
  });
  preflightWaitsForAbort = false;
  preflightSettled = false;

  async run(
    arguments_: readonly string[],
    options: {
      signal?: AbortSignal;
      stdinBytes?: Buffer;
      timeoutMilliseconds?: number;
    } = {},
  ): Promise<string> {
    this.calls.push({
      arguments_: [...arguments_],
      clockAtStart: this.clock,
      ...(options.stdinBytes === undefined
        ? {}
        : { stdinBytes: options.stdinBytes }),
      ...(options.timeoutMilliseconds === undefined
        ? {}
        : { timeoutMilliseconds: options.timeoutMilliseconds }),
    });
    this.clock += this.runDurationMilliseconds;
    if (arguments_[0] === 'devices') {
      return [
        'List of devices attached',
        ...this.devices.map((device) =>
          `${device.serial}\t${device.state} ${device.transport}`),
        '',
      ].join('\n');
    }
    const command = arguments_.join(' ');
    if (command.endsWith('shell getprop ro.product.model')) {
      if (this.preflightWaitsForAbort && !this.preflightSettled) {
        this.resolvePreflightStarted();
        await new Promise<void>((_resolvePromise, rejectPromise) => {
          options.signal?.addEventListener('abort', () => {
            this.preflightSettled = true;
            rejectPromise(new Error('aborted'));
          }, { once: true });
        });
      }
      return `${model}\n`;
    }
    if (command.endsWith('shell getprop ro.build.fingerprint')) {
      return `${build}\n`;
    }
    if (command.endsWith('shell cmd user list --all')) {
      return this.userListOutput;
    }
    if (command.endsWith('shell cmd user get-main-user')) {
      return `${this.mainUser}\n`;
    }
    if (
      command.endsWith(
        'shell cmd user is-headless-system-user-mode',
      )
    ) {
      return `${this.headlessSystemUserMode}\n`;
    }
    if (command.endsWith('shell am get-current-user')) {
      return `${this.currentUser}\n`;
    }
    if (
      command.includes(
        `shell cmd package list packages -a -u --user 0 ${packageName}`,
      )
    ) {
      if (
        this.cleanupObservationAlwaysFails
        || this.cleanupObservationFailures > 0
      ) {
        this.cleanupObservationFailures = Math.max(
          0,
          this.cleanupObservationFailures - 1,
        );
        throw new Error('transient cleanup observation failure');
      }
      if (this.cleanupPackageOutputs.length > 0) {
        return this.cleanupPackageOutputs.shift() ?? '';
      }
      if (
        this.packagePath === null
        && this.lateOutcomeArmed
        && this.latePackageAfterCleanupReads > 0
      ) {
        this.cleanupPackageReads += 1;
        if (this.cleanupPackageReads >= this.latePackageAfterCleanupReads) {
          this.packagePath = validPath;
          this.processes = [packageName];
        }
      }
      if (this.packagePath === null) {
        this.finalZeroObservations += 1;
        if (this.cleanupStarted) {
          this.finalZeroObservationsAfterCleanup += 1;
        }
        return '';
      }
      return `package:${packageName}\n`;
    }
    if (
      command.includes(
        `shell cmd package list packages --show-versioncode --user 0 ${packageName}`,
      )
    ) {
      return this.packagePath === null
        ? ''
        : `package:${packageName} versionCode:${this.versionCode}\n`;
    }
    if (
      command.includes(
        `shell cmd package path --user 0 ${packageName}`,
      )
    ) {
      const pathRead = this.installedProofPathReads;
      this.installedProofPathReads += 1;
      if (this.pathSequence !== undefined) {
        const index = Math.min(
          pathRead,
          this.pathSequence.length - 1,
        );
        return `package:${this.pathSequence[index]}\n`;
      }
      return `package:${this.packagePath}\n`;
    }
    if (command.endsWith('shell ps -A -o NAME')) {
      if (this.cleanupProcessOutputs.length > 0) {
        return this.cleanupProcessOutputs.shift() ?? '';
      }
      return this.processOutput
        ?? ['NAME', ...this.processes, ''].join('\n');
    }
    if (command.endsWith('reverse --list')) {
      return this.reverseOutput;
    }
    if (command.includes('cmd package install')) {
      this.mutations.push('install');
      this.resolveInstallStarted();
      if (this.installNeverSettles) {
        await new Promise<void>(() => {});
      }
      if (this.installWaitsForAbort) {
        await new Promise<void>((_resolvePromise, rejectPromise) => {
          options.signal?.addEventListener('abort', () => {
            this.installSettled = true;
            rejectPromise(new Error('aborted'));
          }, { once: true });
        });
      }
      if (this.installReject) {
        this.installSettled = true;
        this.cleanupPackageReads = 0;
        this.lateOutcomeArmed = true;
        throw new Error('timeout');
      }
      if (this.installRaceLeavesForeignPackage) {
        this.installSettled = true;
        this.packagePath = replacementPath;
        this.versionCode = '2';
        return 'Failure [INSTALL_FAILED_ALREADY_EXISTS]\n';
      }
      this.installSettled = true;
      if (
        this.installResult === 'Success'
        || this.installFailureLeavesPackage
      ) {
        this.packagePath = validPath;
      }
      return `${this.installResult}\n`;
    }
    if (command.includes('shell readlink -f --')) {
      return `${this.canonicalPath ?? this.packagePath}\n`;
    }
    if (command.includes('shell stat -c')) {
      const identity = this.statSequence?.[
        Math.min(this.statReads, this.statSequence.length - 1)
      ] ?? '1:2';
      this.statReads += 1;
      return `${identity}:${this.statSize}:${this.statMode}\n`;
    }
    if (
      command.includes(
        `shell am start -W --user 0 -n ${DA5_V5_VALIDATION_PHASE0_ACTIVITY}`,
      )
    ) {
      this.mutations.push('launch');
      if (!this.omitLaunchedProcess) {
        this.processes = this.launchedProcesses ?? [packageName];
      }
      if (this.reverseAfterLaunch !== undefined) {
        this.reverseOutput = this.reverseAfterLaunch;
      }
      if (this.packagePathAfterLaunch !== undefined) {
        this.packagePath = this.packagePathAfterLaunch;
      }
      return [
        `Status: ${this.launchStatus}`,
        `Activity: ${this.launchActivity}`,
        'Complete',
        '',
      ].join('\n');
    }
    if (
      command.includes(
        `shell am force-stop --user 0 ${packageName}`,
      )
    ) {
      this.mutations.push('force-stop');
      this.cleanupStarted = true;
      this.forceStopCount += 1;
      this.processes = [];
      if (this.packagePathAfterForceStop !== undefined) {
        this.packagePath = this.packagePathAfterForceStop;
      }
      if (this.versionCodeAfterForceStop !== undefined) {
        this.versionCode = this.versionCodeAfterForceStop;
      }
      return '';
    }
    if (
      command.endsWith(
        `shell cmd package uninstall --user 0 --versionCode 1 ${packageName}`,
      )
    ) {
      this.mutations.push('uninstall');
      this.cleanupStarted = true;
      this.uninstallCount += 1;
      const uninstallResult =
        this.uninstallResults?.shift() ?? this.uninstallResult;
      if (uninstallResult === 'Success') {
        this.packagePath = null;
        this.versionCode = '1';
        this.processes = [];
        this.latePackageAfterCleanupReads = 0;
      }
      return `${uninstallResult}\n`;
    }
    throw new Error(`unexpected fake command: ${command}`);
  }

  async runBinaryDigest(
    arguments_: readonly string[],
    options: { maximumBytes: number },
  ) {
    this.binaryCalls.push({
      arguments_: [...arguments_],
      maximumBytes: options.maximumBytes,
    });
    return {
      bytes: this.digestBytes,
      sha256: this.digestSha256,
    };
  }

  onWait() {
    this.cleanupFlights = Math.max(this.cleanupFlights, 1);
    this.waitCount += 1;
  }
}

function createHostFixture(bytes: Buffer, mode = 0o444) {
  const directory = realpathSync(
    mkdtempSync(join(tmpdir(), 'da5-validation-phase0-')),
  );
  temporaryDirectories.push(directory);
  const path = join(directory, 'artifact.apk');
  writeFileSync(path, bytes);
  chmodSync(path, mode);
  return {
    binding: {
      bytes: bytes.length,
      mode,
      path,
      sha256: hash(bytes),
    },
    directory,
    path,
  };
}

function hash(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stableFiles() {
  return {
    close: closeSync,
    fstat: fstatSync,
    lstat: lstatSync,
    openReadOnly(path: string) {
      return openSync(
        path,
        fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
      );
    },
    readFileDescriptor(fileDescriptor: number, expectedBytes: number) {
      const snapshot = Buffer.allocUnsafe(expectedBytes);
      let offset = 0;
      while (offset < expectedBytes) {
        const count = readSync(
          fileDescriptor,
          snapshot,
          offset,
          expectedBytes - offset,
          offset,
        );
        if (count === 0) break;
        offset += count;
      }
      return snapshot.subarray(0, offset);
    },
    realpath: realpathSync,
  };
}
