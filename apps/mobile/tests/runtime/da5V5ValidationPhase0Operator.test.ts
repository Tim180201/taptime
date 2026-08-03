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

import {
  Da5V5AndroidCommandAbortError,
  Da5V5AndroidCommandTimeoutError,
  Da5V5UsbSerialBinding,
} from '../../scripts/da5V5AndroidDevice.mjs';
import {
  DA5_V5_VALIDATION_INSTALL_STREAM_TERMINAL_CAUSES,
} from '../../scripts/da5V5ValidationInstallStream.mjs';
import {
  runDa5V5ValidationPhase0Operator,
} from '../../scripts/da5V5ValidationPhase0Operator.mjs';
import {
  DA5_V5_VALIDATION_PHASE0_ACTIVITY,
  DA5_V5_VALIDATION_PHASE0_ARTIFACT,
  DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES,
  DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES,
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
import type {
  Da5V5ValidationToolIdentity,
} from '../../scripts/da5V5ValidationRuntimeContract.mjs';

const packageName = 'com.tim180201.mobile.validation';
const validPath =
  `/data/app/~~Qm~4g_Jx+=/${packageName}-A1~b_2+=/base.apk`;
const replacementPath =
  `/data/app/~~replacement/${packageName}-replacement/base.apk`;
const model = 'BOUND-MODEL';
const build = 'BOUND-BUILD';
const androidSdkAuthority = Object.freeze({
  androidHome: '/synthetic/android-sdk',
  androidSdkRoot: '/synthetic/android-sdk',
});
const toolSha256 = 'e'.repeat(64);
const verifiedTools = Object.freeze({
  aapt: toolIdentity(
    '/synthetic/android-sdk/build-tools/35.0.0/aapt',
    11,
  ),
  adb: toolIdentity('/synthetic/android-sdk/platform-tools/adb', 12),
  apksigner: toolIdentity(
    '/synthetic/android-sdk/build-tools/35.0.0/apksigner',
    13,
  ),
  hermesc: toolIdentity(
    '/synthetic/repository/node_modules/hermesc',
    14,
  ),
  unzip: toolIdentity(
    '/usr/bin/unzip',
    1_152_921_500_312_573_001n,
  ),
});
const verifiedReadiness = () => Object.freeze({
  artifactSourceCommit:
    DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceCommit,
  artifactSourceTree:
    DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceTree,
  executionCommit: '0'.repeat(40),
  executionTree: '1'.repeat(40),
  status: 'match' as const,
  tools: verifiedTools,
});
const handledSignalNames = [
  'SIGHUP',
  'SIGINT',
  'SIGQUIT',
  'SIGTERM',
] as const;
type DiagnosticCategory =
  (typeof DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES)[
    keyof typeof DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
  ];
type InstallStreamMismatchCategory =
  (typeof DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES)[
    | 'adbChildTransportMismatch'
    | 'adbChildTimeoutMismatch'
    | 'adbChildExitMismatch'
    | 'adbStdinPipeAbortMismatch'
  ];
type AbortBoundary =
  | 'install-create'
  | 'post-create-reattest'
  | 'install-write'
  | 'post-write-reattest'
  | 'install-commit'
  | 'installed-provenance';
type TypedTimeoutBoundary =
  | 'reattestation'
  | 'installed-provenance'
  | 'prelaunch'
  | 'activity-start'
  | 'postlaunch';
const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('DA5 V5 Validation Phase-0 CLI signals', () => {
  it('renders only the closed optional diagnostic category', async () => {
    const processTarget = new EventEmitter();
    const input = new PassThrough();
    const output = new PassThrough();
    let disclosed = '';
    output.on('data', (chunk: Buffer) => {
      disclosed += chunk.toString('utf8');
    });
    const done = Promise.resolve({ status: 'mismatch' as const });
    const session = {
      done,
      end: vi.fn(() => done),
      fail: vi.fn(() => done),
      signal: vi.fn(() => done),
      start: vi.fn(async () => ({ status: 'match' as const })),
      submit: vi.fn(async () => undefined),
    };

    await expect(runDa5V5ValidationPhase0Operator({
      arguments_: [],
      createSession(options: {
        receipt(
          stage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ): void;
        tools: typeof verifiedTools;
      }) {
        expect(options.tools).toEqual(verifiedTools);
        options.receipt(
          'installation',
          'mismatch',
          'adb_child_transport_mismatch',
        );
        options.receipt('install_launch', 'mismatch');
        return session;
      },
      environment: {},
      input,
      output,
      processTarget,
      verifyReadiness: verifiedReadiness,
    })).resolves.toEqual({ status: 'mismatch' });

    expect(disclosed).toBe(
      'da5_v5_validation_phase0 stage=installation'
      + ' status=mismatch category=adb_child_transport_mismatch\n'
      + 'da5_v5_validation_phase0 stage=install_launch'
      + ' status=mismatch\n',
    );
    expect(disclosed).not.toContain('SECRET');
    input.destroy();
    output.destroy();
  });

  it.each(handledSignalNames)(
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
        verifyReadiness: verifiedReadiness,
      });

      for (const handledSignal of handledSignalNames) {
        expect(processTarget.listenerCount(handledSignal)).toBe(1);
      }
      processTarget.emit(signalName);
      processTarget.emit(signalName);
      expect(signal).toHaveBeenCalledTimes(1);
      expect(processTarget.listenerCount(signalName)).toBe(1);

      resolveDone({ status: 'mismatch' });
      await expect(running).resolves.toEqual({ status: 'mismatch' });
      for (const handledSignal of handledSignalNames) {
        expect(processTarget.listenerCount(handledSignal)).toBe(0);
      }
      expect(processTarget.listenerCount('uncaughtException')).toBe(0);
      expect(processTarget.listenerCount('unhandledRejection')).toBe(0);
      input.destroy();
      output.destroy();
    },
  );

  it('routes different catchable signals through one persistent termination flight', async () => {
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
      verifyReadiness: verifiedReadiness,
    });

    for (const handledSignal of handledSignalNames) {
      processTarget.emit(handledSignal);
    }
    expect(signal).toHaveBeenCalledTimes(1);
    for (const handledSignal of handledSignalNames) {
      expect(processTarget.listenerCount(handledSignal)).toBe(1);
    }

    resolveDone({ status: 'mismatch' });
    await expect(running).resolves.toEqual({ status: 'mismatch' });
    for (const handledSignal of handledSignalNames) {
      expect(processTarget.listenerCount(handledSignal)).toBe(0);
    }
    input.destroy();
    output.destroy();
  });

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
        verifyReadiness: verifiedReadiness,
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

  it('fails readiness before creating a session or enabling any ADB path', async () => {
    const processTarget = new EventEmitter();
    const input = new PassThrough();
    const output = new PassThrough();
    const createSession = vi.fn();
    let disclosed = '';
    output.on('data', (chunk: Buffer) => {
      disclosed += chunk.toString('utf8');
    });

    await expect(runDa5V5ValidationPhase0Operator({
      arguments_: [],
      createSession,
      environment: {},
      input,
      output,
      processTarget,
      verifyReadiness() {
        throw new Error('SECRET_DIGEST_OR_PATH');
      },
    })).resolves.toEqual({ status: 'mismatch' });

    expect(createSession).not.toHaveBeenCalled();
    expect(disclosed).toBe(
      'da5_v5_validation_phase0 stage=readiness status=mismatch\n',
    );
    expect(disclosed).not.toContain('SECRET_DIGEST_OR_PATH');
    for (const handledSignal of handledSignalNames) {
      expect(processTarget.listenerCount(handledSignal)).toBe(0);
    }
    input.destroy();
    output.destroy();
  });

  it.each([
    'artifactSourceCommit',
    'artifactSourceTree',
  ] as const)('rejects artifact-source drift in %s before creating a session', async (
    field,
  ) => {
    const processTarget = new EventEmitter();
    const input = new PassThrough();
    const output = new PassThrough();
    const createSession = vi.fn();
    let disclosed = '';
    output.on('data', (chunk: Buffer) => {
      disclosed += chunk.toString('utf8');
    });

    await expect(runDa5V5ValidationPhase0Operator({
      arguments_: [],
      createSession,
      environment: {},
      input,
      output,
      processTarget,
      verifyReadiness() {
        return {
          ...verifiedReadiness(),
          [field]: '0'.repeat(40),
        };
      },
    })).resolves.toEqual({ status: 'mismatch' });

    expect(createSession).not.toHaveBeenCalled();
    expect(disclosed).toBe(
      'da5_v5_validation_phase0 stage=readiness status=mismatch\n',
    );
    input.destroy();
    output.destroy();
  });
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
  it('hard-binds the Validation candidate identity', () => {
    expect(DA5_V5_VALIDATION_PHASE0_ARTIFACT).toEqual({
      apk: {
        bytes: 65_634_553,
        mode: 0o444,
        path:
          '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-83635335aa4f-9908d76ea97a1ae9/app-release-9908d76ea97a1ae9.apk',
        sha256:
          '9908d76ea97a1ae95ad4a08b24f626d72e8cfc6ddb20d3d1629fa822686c9d29',
      },
      manifest: {
        bytes: 6_855,
        mode: 0o444,
        path:
          '/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-83635335aa4f-9908d76ea97a1ae9/manifest-83635335aa4f.json',
        sha256:
          'ab6a02980058259ae719bc597cfa4e7ba25ef0da28d2de4f0ee039884f373298',
      },
      sourceClosureJsonSha256:
        'a50ec386e87217eb9a02fede94fd37a97fefb0734fa5a9791b7ff142a9c44c2f',
      sourceClosureRecords: 33,
      sourceCommit: '83635335aa4f547dc8994243c604dacf9797f593',
      sourceTree: '40b7655a94e607b8afe19f90f42a95f42ee6d582',
    });
  });

  it('binds the operator verifier to the exact 33-record source closure', () => {
    expect(() =>
      verifyAndSealDa5V5ValidationPhase0Artifact({
        androidSdkAuthority,
        inspectionTools: verifiedTools,
        profile: DA5_V5_VALIDATION_PHASE0_PROFILE,
        verifyArtifact(verification: unknown) {
          const binding = verification as {
            androidSdkAuthority: typeof androidSdkAuthority & {
              path: string;
            };
            expectedSourceClosure: readonly {
              path: string;
              sha256: string;
            }[];
            expectedSourceCommit: string;
            expectedSourceTree: string;
            inspectionTools: typeof verifiedTools;
          };
          expect(binding.androidSdkAuthority).toEqual({
            ...androidSdkAuthority,
            path: '/synthetic/android-sdk',
          });
          expect(binding.expectedSourceClosure).toHaveLength(
            DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceClosureRecords,
          );
          expect(new Set(
            binding.expectedSourceClosure.map((record) => record.path),
          ).size).toBe(
            DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceClosureRecords,
          );
          expect(createHash('sha256')
            .update(JSON.stringify(binding.expectedSourceClosure))
            .digest('hex')).toBe(
            DA5_V5_VALIDATION_PHASE0_ARTIFACT.sourceClosureJsonSha256,
          );
          expect(binding.expectedSourceClosure[0]).toEqual({
            path: 'apps/mobile/app.config.js',
            sha256:
              '1ca63463e07b0c7c7111a653f1549bdad1011219300db771e740537d9908811b',
          });
          expect(binding.expectedSourceClosure).toContainEqual({
            path:
              'apps/mobile/scripts/da5V5ValidationNoHardwareReadiness.mjs',
            sha256:
              'edf552f3d1882701122c3d9a10f53b200efd880d98007e30ac5e7440081f1c37',
          });
          expect(binding.expectedSourceClosure).toContainEqual({
            path:
              'apps/mobile/scripts/da5V5ValidationRuntimeContract.mjs',
            sha256:
              'fc8166981d7faec272f65a0238f577ef8b62092d2f1a07b24ef417ef85ace148',
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
          expect(binding.inspectionTools).toEqual(verifiedTools);
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
  it('binds the complete install-launch diagnostic allowlists', () => {
    expect(
      Object.values(DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES),
    ).toEqual([
      'installation',
      'installed_provenance',
      'prelaunch',
      'activity_start',
      'postlaunch',
    ]);
    expect(
      Object.values(DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES),
    ).toEqual([
      'adb_child_exit_mismatch',
      'adb_child_timeout_mismatch',
      'adb_child_transport_mismatch',
      'adb_stdin_pipe_abort_mismatch',
      'operator_abort_mismatch',
      'operation_mismatch',
      'package_manager_artifact_rejection',
      'package_manager_command_contract_mismatch',
      'package_manager_installed_state_conflict',
      'package_manager_policy_restriction',
      'package_manager_receipt_mismatch',
      'package_manager_storage_rejection',
      'verification_mismatch',
    ]);
    expect(
      Object.isFrozen(
        DA5_V5_VALIDATION_PHASE0_INSTALL_LAUNCH_STAGES,
      ),
    ).toBe(true);
    expect(
      Object.isFrozen(DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES),
    ).toBe(true);
  });

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
    ['right-padded process header', 'NAME \n'],
    ['left-padded process header', ' NAME\n'],
    ['right-padded process row', 'NAME\ninit \n'],
    ['left-padded process row', 'NAME\n init\n'],
    ['additional process column', 'NAME PID\n'],
  ])('rejects %s before mutation', async (_label, processOutput) => {
    const runner = new FakeRunner();
    runner.processOutput = processOutput;
    const device = createDevice(runner);
    await expect(device.preflight()).rejects.toThrow();
    expect(runner.mutations).toHaveLength(0);
  });

  it('accepts realistic unpadded Android-15 Toybox NAME:4 output without truncation', async () => {
    const runner = new FakeRunner();
    runner.processOutput = [
      'NAME',
      'init',
      'com.android.systemui',
      'com.google.android.gms.persistent',
      'com.samsung.android.accessibility.talkback:remote_service',
      '',
    ].join('\n');
    const device = createDevice(runner);

    await expect(device.preflight()).resolves.toEqual({
      status: 'match',
    });
    expect(runner.calls.some((call) =>
      call.arguments_.join(' ') === [
        '-s', runner.serial, 'shell', 'ps', '-A', '-w', '-o', 'NAME:4',
      ].join(' '))).toBe(true);
  });

  it.each([
    ['package residue', { packagePath: validPath }],
    ['main process', { processes: [packageName] }],
    ['long secondary process', {
      processes: [
        `${packageName}:accessibility_remote_service`,
      ],
    }],
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

  it('creates, writes and commits one bound session before launching exact MainActivity', async () => {
    const runner = new FakeRunner();
    const snapshot = fakeSnapshot();
    const device = createDevice(runner, { snapshot });
    await device.preflight();
    await expect(device.installAndLaunch()).resolves.toEqual({
      status: 'match',
    });
    const create = runner.calls.find((call) =>
      call.arguments_.includes('install-create'));
    const write = runner.calls.find((call) =>
      call.arguments_.includes('install-write'));
    const commit = runner.calls.find((call) =>
      call.arguments_.includes('install-commit'));
    expect(create?.arguments_).toEqual([
      '-s',
      runner.serial,
      'shell',
      '-T',
      '-x',
      'cmd',
      'package',
      'install-create',
      '-R',
      '--user',
      '0',
      '--pkg',
      packageName,
      '-S',
      String(DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes),
    ]);
    expect(write?.arguments_).toEqual([
      '-s',
      runner.serial,
      'shell',
      '-T',
      '-x',
      'cmd',
      'package',
      'install-write',
      '-S',
      String(DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes),
      '42',
      'base.apk',
      '-',
    ]);
    expect(commit?.arguments_).toEqual([
      '-s',
      runner.serial,
      'shell',
      '-T',
      '-x',
      'cmd',
      'package',
      'install-commit',
      '42',
    ]);
    expect(create?.arguments_).toContain('-R');
    expect(write?.arguments_.join(' ')).not.toContain(
      DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.path,
    );
    expect(runner.abandonCount).toBe(0);
    expect(runner.calls.some((call) =>
      call.arguments_.join(' ') === [
        '-s', runner.serial, 'shell', 'am', 'start', '-W',
        '--user', '0', '-n',
        DA5_V5_VALIDATION_PHASE0_ACTIVITY,
      ].join(' '))).toBe(true);
    expect(snapshot.state()).toBe('destroyed');
  });

  it.each([
    [
      'exact allowlisted create failure',
      'Failure [INSTALL_FAILED_USER_RESTRICTED: SECRET_CREATE_DETAIL]',
      'package_manager_policy_restriction',
      'match',
    ],
    [
      'non-canonical create session',
      'Success: created install session [042]',
      'package_manager_receipt_mismatch',
      'mismatch',
    ],
    [
      'duplicate create receipt',
      'Success: created install session [42]\n'
        + 'Success: created install session [43]',
      'package_manager_receipt_mismatch',
      'mismatch',
    ],
  ])(
    'fails closed for %s without disclosing or guessing a session',
    async (_label, output, expectedCategory, cleanupStatus) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.createResult = output;
      const session = createSession(runner, {
        receipt(
          stage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ) {
          receipts.push(`${stage}:${status}:${category ?? 'none'}`);
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      expect(runner.createCount).toBe(1);
      expect(runner.commitCount).toBe(0);
      expect(runner.abandonCount).toBe(0);
      expect(receipts.filter((receipt) =>
        !receipt.endsWith(':none'))).toEqual([
        `installation:mismatch:${expectedCategory}`,
      ]);
      expect(receipts).toContain(`cleanup:${cleanupStatus}:none`);
      expect(receipts.join('\n')).not.toContain('SECRET_');
      expect(receipts.join('\n')).not.toContain('[42]');
      expect(receipts.join('\n')).not.toContain('[43]');
      expect(receipts.join('\n')).not.toContain(runner.serial);
    },
  );

  it('requires the exact device-confirmed install-write byte receipt', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    runner.installResult =
      `Success: streamed ${
        DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes - 1
      } bytes`;
    const session = createSession(runner, {
      receipt(
        stage: string,
        status: 'match' | 'mismatch',
        category?: DiagnosticCategory,
      ) {
        receipts.push(`${stage}:${status}:${category ?? 'none'}`);
      },
    });

    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({
      status: 'mismatch',
    });

    expect(runner.commitCount).toBe(0);
    expect(runner.abandonCount).toBe(1);
    expect(receipts.filter((receipt) =>
      !receipt.endsWith(':none'))).toEqual([
      'installation:mismatch:package_manager_receipt_mismatch',
    ]);
  });

  it.each([
    [
      'allowlisted Failure',
      'Failure [INSTALL_FAILED_INVALID_APK: SECRET_PARTIAL_DETAIL]',
      'package_manager_artifact_rejection',
    ],
    [
      'contradictory Success',
      `Success: streamed ${
        DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes
      } bytes`,
      'adb_stdin_pipe_abort_mismatch',
    ],
    ['empty response', '', 'adb_stdin_pipe_abort_mismatch'],
    [
      'malformed Failure',
      'Failure [INSTALL_FAILED_INVALID_APK: SECRET_MALFORMED',
      'adb_stdin_pipe_abort_mismatch',
    ],
    [
      'multiline response',
      'Failure [INSTALL_FAILED_INVALID_APK]\nSECRET_SECOND_LINE',
      'adb_stdin_pipe_abort_mismatch',
    ],
  ])(
    'classifies a partial install-write pipe with %s fail-closed',
    async (_label, output, expectedCategory) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.installPipePartial = true;
      runner.installResult = output;
      const session = createSession(runner, {
        receipt(
          stage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ) {
          receipts.push(`${stage}:${status}:${category ?? 'none'}`);
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      expect(runner.commitCount).toBe(0);
      expect(runner.abandonCount).toBe(1);
      expect(receipts.filter((receipt) =>
        !receipt.endsWith(':none'))).toEqual([
        `installation:mismatch:${expectedCategory}`,
      ]);
      expect(receipts.join('\n')).not.toContain('SECRET_');
      expect(receipts.join('\n')).not.toContain('[42]');
    },
  );

  it.each([
    ['timeout', 'adb_child_timeout_mismatch'],
    ['nonzero exit', 'adb_child_exit_mismatch'],
  ] as const)(
    'abandons once after an install-write %s',
    async (_label, expectedCategory) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.installMismatchCategory = expectedCategory;
      const session = createSession(runner, {
        receipt(
          stage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ) {
          receipts.push(`${stage}:${status}:${category ?? 'none'}`);
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      expect(runner.commitCount).toBe(0);
      expect(runner.abandonCount).toBe(1);
      expect(receipts.filter((receipt) =>
        !receipt.endsWith(':none'))).toEqual([
        `installation:mismatch:${expectedCategory}`,
      ]);
    },
  );

  it.each([
    [
      'allowlisted failure',
      'Failure [INSTALL_FAILED_USER_RESTRICTED: SECRET_COMMIT_DETAIL]',
      false,
      'package_manager_policy_restriction',
    ],
    [
      'near-success ambiguity',
      'Success ',
      false,
      'package_manager_receipt_mismatch',
    ],
    [
      'multiline ambiguity',
      'Success\nSECRET_COMMIT_SECOND_LINE',
      false,
      'package_manager_receipt_mismatch',
    ],
    [
      'transport failure',
      'Success',
      true,
      'adb_child_transport_mismatch',
    ],
  ])(
    'abandons once after commit %s',
    async (_label, output, rejectCommit, expectedCategory) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.commitResult = output;
      runner.commitReject = rejectCommit;
      const session = createSession(runner, {
        receipt(
          stage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ) {
          receipts.push(`${stage}:${status}:${category ?? 'none'}`);
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      expect(runner.commitCount).toBe(1);
      expect(runner.abandonCount).toBe(1);
      expect(receipts.filter((receipt) =>
        !receipt.endsWith(':none'))).toEqual([
        `installation:mismatch:${expectedCategory}`,
      ]);
      expect(receipts.join('\n')).not.toContain('SECRET_');
      expect(receipts.join('\n')).not.toContain('[42]');
    },
  );

  it.each([
    ['non-success receipt', false],
    ['transport failure', true],
  ])(
    'refuses cleanup match when session abandonment has %s',
    async (_label, rejectAbandon) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.installResult =
        'Failure [INSTALL_FAILED_INVALID_APK: SECRET_WRITE_DETAIL]';
      runner.abandonResult =
        'Failure [INSTALL_FAILED_SESSION_INVALID: SECRET_ABANDON_DETAIL]';
      runner.abandonReject = rejectAbandon;
      const session = createSession(runner, {
        receipt(
          stage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ) {
          receipts.push(`${stage}:${status}:${category ?? 'none'}`);
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      expect(runner.abandonCount).toBe(1);
      expect(receipts).toContain('cleanup:mismatch:none');
      expect(receipts.join('\n')).not.toContain('SECRET_');
      expect(receipts.join('\n')).not.toContain('[42]');
      const abandonIndex = runner.calls.findIndex((call) =>
        call.arguments_.includes('install-abandon'));
      expect(abandonIndex).toBeGreaterThan(-1);
      expect(runner.calls.slice(abandonIndex + 1).some((call) =>
        call.arguments_.includes('ps')
        || call.arguments_.includes('reverse')
        || (
          call.arguments_.includes('package')
          && call.arguments_.includes('-a')
        ))).toBe(true);
      expect(runner.forceStopCount).toBe(0);
      expect(runner.uninstallCount).toBe(0);
    },
  );

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

  it('classifies a pre-install device re-attestation mismatch as verification-only', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(
        receiptStage: string,
        status: 'match' | 'mismatch',
        receiptCategory?: DiagnosticCategory,
      ) {
        receipts.push(
          `${receiptStage}:${status}:${receiptCategory ?? 'none'}`,
        );
      },
    });

    await session.start();
    runner.userListOutput =
      'Users:\n\tUserInfo{0:Owner:c13} running\n'
      + '\tUserInfo{10:SECRET_PREINSTALL_PROFILE:30} running\n';
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({
      status: 'mismatch',
    });

    expect(runner.mutations).toHaveLength(0);
    expect(runner.calls.some((call) =>
      call.arguments_.some((argument) =>
        argument.startsWith('install-')))).toBe(false);
    expect(receipts.filter((receipt) =>
      !receipt.endsWith(':none'))).toEqual([
      'installation:mismatch:verification_mismatch',
    ]);
    const diagnosticIndex = receipts.indexOf(
      'installation:mismatch:verification_mismatch',
    );
    expect(receipts.slice(diagnosticIndex, diagnosticIndex + 2))
      .toEqual([
        'installation:mismatch:verification_mismatch',
        'install_launch:mismatch:none',
      ]);
    expect(receipts.at(-1)).toBe('failed:mismatch:none');
    expect(receipts.join('\n')).not.toContain(
      'SECRET_PREINSTALL_PROFILE',
    );
  });

  it.each([
    [
      'install-create',
      'SECRET_POST_CREATE_PROFILE',
      (runner: FakeRunner, output: string) => {
        runner.userListOutputAfterCreate = output;
      },
      ['install-create', 'install-abandon'],
      ['install-write', 'install-commit'],
    ],
    [
      'install-write',
      'SECRET_POST_WRITE_PROFILE',
      (runner: FakeRunner, output: string) => {
        runner.userListOutputAfterWrite = output;
      },
      ['install-create', 'install-write', 'install-abandon'],
      ['install-commit'],
    ],
  ] as const)(
    'keeps post-%s re-attestation drift verification-only and abandons once',
    async (
      _boundary,
      secret,
      armDrift,
      expectedMutations,
      forbiddenCommands,
    ) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      armDrift(
        runner,
        'Users:\n\tUserInfo{0:Owner:c13} running\n'
          + `\tUserInfo{10:${secret}:30} running\n`,
      );
      const session = createSession(runner, {
        receipt(
          receiptStage: string,
          status: 'match' | 'mismatch',
          receiptCategory?: DiagnosticCategory,
        ) {
          receipts.push(
            `${receiptStage}:${status}:${receiptCategory ?? 'none'}`,
          );
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      expect(runner.mutations).toEqual(expectedMutations);
      expect(runner.abandonCount).toBe(1);
      expect(runner.forceStopCount).toBe(0);
      expect(runner.uninstallCount).toBe(0);
      for (const command of forbiddenCommands) {
        expect(runner.calls.some((call) =>
          call.arguments_.includes(command))).toBe(false);
      }
      expect(receipts).toEqual([
        'artifact:match:none',
        'preflight:match:none',
        'installation:mismatch:verification_mismatch',
        'install_launch:mismatch:none',
        'cleanup:match:none',
        'failed:mismatch:none',
      ]);
      expect(receipts.join('\n')).not.toContain(secret);
      expect(receipts.join('\n')).not.toContain(runner.serial);
      expect(receipts.join('\n')).not.toContain('[42]');
    },
  );

  it.each([
    [
      'ADB/child transport',
      'installation',
      'adb_child_transport_mismatch',
      (runner: FakeRunner) => {
        runner.installReject = true;
      },
    ],
    [
      'PackageManager receipt',
      'installation',
      'package_manager_receipt_mismatch',
      (runner: FakeRunner) => {
        runner.installResult =
          'Failure [SECRET_PACKAGE_MANAGER_OUTPUT /secret/install]';
      },
    ],
    [
      'installed provenance',
      'installed_provenance',
      'verification_mismatch',
      (runner: FakeRunner) => {
        runner.canonicalPath = '/data/app/SECRET_PROVENANCE/base.apk';
      },
    ],
    [
      'prelaunch',
      'prelaunch',
      'verification_mismatch',
      (runner: FakeRunner) => {
        runner.reverseAfterDigest =
          'SECRET-DEVICE tcp:1234 localabstract:SECRET_PRELAUNCH\n';
      },
    ],
    [
      'explicit Activity start',
      'activity_start',
      'operation_mismatch',
      (runner: FakeRunner) => {
        runner.launchStatus = 'SECRET_ACTIVITY_START_OUTPUT';
      },
    ],
    [
      'postlaunch',
      'postlaunch',
      'verification_mismatch',
      (runner: FakeRunner) => {
        runner.launchedProcesses = [
          packageName,
          `${packageName}:SECRET_POSTLAUNCH_PROCESS`,
        ];
      },
    ],
  ])(
    'emits exactly one closed %s diagnostic before the aggregate failure',
    async (_label, stage, category, configure) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      configure(runner);
      const session = createSession(runner, {
        receipt(
          receiptStage: string,
          status: 'match' | 'mismatch',
          receiptCategory?: DiagnosticCategory,
        ) {
          receipts.push(
            `${receiptStage}:${status}:${receiptCategory ?? 'none'}`,
          );
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      const diagnosticReceipts = receipts.filter((receipt) =>
        !receipt.endsWith(':none'));
      expect(diagnosticReceipts).toEqual([
        `${stage}:mismatch:${category}`,
      ]);
      const diagnosticIndex = receipts.indexOf(
        `${stage}:mismatch:${category}`,
      );
      expect(receipts.slice(diagnosticIndex, diagnosticIndex + 2))
        .toEqual([
          `${stage}:mismatch:${category}`,
          'install_launch:mismatch:none',
        ]);
      expect(receipts.at(-1)).toBe('failed:mismatch:none');
      expect(receipts.join('\n')).not.toContain('SECRET_');
      expect(receipts.join('\n')).not.toContain('/secret/');
      expect(receipts.join('\n')).not.toContain(runner.serial);
      expect(receipts.filter((receipt) =>
        Object.values(
          DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES,
        ).some((category) =>
          receipt.endsWith(`:mismatch:${category}`))))
        .toHaveLength(1);
    },
  );

  it('keeps a remote PackageManager rejection out of the ADB child-transport category', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    runner.installResult =
      'Failure [SECRET_REMOTE_PACKAGE_MANAGER_OUTPUT /secret/install]';
    const session = createSession(runner, {
      receipt(
        receiptStage: string,
        status: 'match' | 'mismatch',
        receiptCategory?: DiagnosticCategory,
      ) {
        receipts.push(
          `${receiptStage}:${status}:${receiptCategory ?? 'none'}`,
        );
      },
    });

    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({
      status: 'mismatch',
    });

    const installWrite = runner.calls.find((call) =>
      call.arguments_.includes('install-write'));
    expect(installWrite?.arguments_.slice(2, 6)).toEqual([
      'shell',
      '-T',
      '-x',
      'cmd',
    ]);
    expect(receipts.filter((receipt) =>
      !receipt.endsWith(':none'))).toEqual([
      'installation:mismatch:package_manager_receipt_mismatch',
    ]);
    expect(receipts.join('\n')).not.toContain('SECRET_');
    expect(receipts.join('\n')).not.toContain('/secret/');
    expect(receipts.join('\n')).not.toContain(runner.serial);
  });

  it('routes a terminal PackageManager Failure after an all-bytes-submitted pipe close through the strict parser', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    runner.installPipeClosedAfterAllBytes = true;
    runner.installResult =
      'Failure [INSTALL_FAILED_INVALID_APK: SECRET_PM_DETAIL]';
    const session = createSession(runner, {
      receipt(
        receiptStage: string,
        status: 'match' | 'mismatch',
        receiptCategory?: DiagnosticCategory,
      ) {
        receipts.push(
          `${receiptStage}:${status}:${receiptCategory ?? 'none'}`,
        );
      },
    });

    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({
      status: 'mismatch',
    });

    expect(receipts.filter((receipt) =>
      !receipt.endsWith(':none'))).toEqual([
      'installation:mismatch:package_manager_artifact_rejection',
    ]);
    expect(receipts.join('\n')).not.toContain('SECRET_PM_DETAIL');
  });

  it('requires installed-artifact provenance after an exact Success despite an all-bytes-submitted pipe close', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    runner.installPipeClosedAfterAllBytes = true;
    runner.canonicalPath = '/data/app/SECRET_DRIFT/base.apk';
    const session = createSession(runner, {
      receipt(
        receiptStage: string,
        status: 'match' | 'mismatch',
        receiptCategory?: DiagnosticCategory,
      ) {
        receipts.push(
          `${receiptStage}:${status}:${receiptCategory ?? 'none'}`,
        );
      },
    });

    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({
      status: 'mismatch',
    });

    expect(receipts.filter((receipt) =>
      !receipt.endsWith(':none'))).toEqual([
      'installed_provenance:mismatch:verification_mismatch',
    ]);
    expect(receipts.join('\n')).not.toContain('SECRET_DRIFT');
  });

  it.each([
    [
      'policy/user restriction',
      'Failure [INSTALL_FAILED_USER_RESTRICTED: SECRET_POLICY_DETAIL]',
      'package_manager_policy_restriction',
    ],
    [
      'artifact/parse/signature rejection',
      'Failure [INSTALL_PARSE_FAILED_BAD_MANIFEST: SECRET_ARTIFACT_DETAIL /secret/artifact]',
      'package_manager_artifact_rejection',
    ],
    [
      'installed-state/version/signature conflict',
      'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: SECRET_CONFLICT_DETAIL]',
      'package_manager_installed_state_conflict',
    ],
    [
      'storage rejection',
      'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE: SECRET_STORAGE_DETAIL]',
      'package_manager_storage_rejection',
    ],
    [
      'command contract/usage',
      'Error: must either specify a package size or an APK file',
      'package_manager_command_contract_mismatch',
    ],
  ])(
    'maps a bound PackageManager %s to only its safe category',
    async (_label, output, expectedCategory) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.installResult = output;
      const session = createSession(runner, {
        receipt(
          receiptStage: string,
          status: 'match' | 'mismatch',
          receiptCategory?: DiagnosticCategory,
        ) {
          receipts.push(
            `${receiptStage}:${status}:${receiptCategory ?? 'none'}`,
          );
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      expect(receipts.filter((receipt) =>
        !receipt.endsWith(':none'))).toEqual([
        `installation:mismatch:${expectedCategory}`,
      ]);
      expect(receipts.join('\n')).not.toContain(output);
      expect(receipts.join('\n')).not.toContain('INSTALL_');
      expect(receipts.join('\n')).not.toContain('SECRET_');
      expect(receipts.join('\n')).not.toContain('/secret/');
      expect(receipts.join('\n')).not.toContain(runner.serial);
    },
  );

  it.each([
    [
      'unknown code',
      'Failure [INSTALL_FAILED_FUTURE_SECRET: SECRET_UNKNOWN /secret/future]',
    ],
    [
      'unknown parse code',
      'Failure [INSTALL_PARSE_FAILED_FUTURE_SECRET: SECRET_UNKNOWN_PARSE]',
    ],
    [
      'malformed receipt',
      'Failure [INSTALL_FAILED_INVALID_APK: SECRET_MALFORMED',
    ],
    [
      'multiline receipt',
      'Failure [INSTALL_FAILED_INVALID_APK]\nSECRET_SECOND_LINE',
    ],
    ['near-success receipt', 'Success '],
  ])(
    'keeps a %s fail-closed in the generic PackageManager category',
    async (_label, output) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.installResult = output;
      const session = createSession(runner, {
        receipt(
          receiptStage: string,
          status: 'match' | 'mismatch',
          receiptCategory?: DiagnosticCategory,
        ) {
          receipts.push(
            `${receiptStage}:${status}:${receiptCategory ?? 'none'}`,
          );
        },
      });

      await session.start();
      await session.submit('install-launch');
      await expect(session.done).resolves.toEqual({
        status: 'mismatch',
      });

      expect(receipts.filter((receipt) =>
        !receipt.endsWith(':none'))).toEqual([
        'installation:mismatch:package_manager_receipt_mismatch',
      ]);
      expect(receipts.join('\n')).not.toContain(output);
      expect(receipts.join('\n')).not.toContain('INSTALL_');
      expect(receipts.join('\n')).not.toContain('SECRET_');
      expect(receipts.join('\n')).not.toContain('/secret/');
      expect(receipts.join('\n')).not.toContain(runner.serial);
    },
  );

  it('proves and removes exact package residue when install failed before provenance was proved', async () => {
    const runner = new FakeRunner();
    runner.installResult = 'Failure [blocked]';
    runner.installFailureLeavesPackage = true;
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.packagePath).toBeNull();
    expect(runner.forceStopCount).toBe(1);
    expect(runner.uninstallCount).toBe(1);
  });

  it('uses -R and preserves a package that races package-zero to install', async () => {
    const runner = new FakeRunner();
    runner.installRaceLeavesForeignPackage = true;
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    const installCreate = runner.calls.find((call) =>
      call.arguments_.includes('install-create'));
    expect(installCreate?.arguments_).toContain('-R');
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

  it('converges a late exact package outcome after a timed-out install', async () => {
    const runner = new FakeRunner();
    runner.installReject = true;
    runner.latePackageAfterCleanupReads = 2;
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.uninstallCount).toBe(1);
    expect(runner.packagePath).toBeNull();
    expect(runner.forceStopCount).toBe(1);
  });

  it('preserves owned residue after an ambiguous cleanup observation', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);
    await session.start();
    await session.submit('install-launch');
    await session.submit('human-pass');
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
      await session.submit('human-pass');
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
    await session.submit('human-pass');
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
    await session.submit('human-pass');
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
    await session.submit('human-pass');
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
    await session.submit('human-pass');
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
    await session.submit('human-pass');
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
    await session.submit('human-pass');
    await session.submit('cleanup');
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.uninstallCount).toBeGreaterThan(1);
    expect(runner.waitCount).toBeGreaterThan(1);
    expect(runner.packagePath).toBe(validPath);
  });

  it.each([
    ['wrong first command', 'cleanup'],
    ['early Human PASS', 'human-pass'],
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

  it('accepts abort before start as a terminal fail-closed cleanup request', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner);

    await expect(session.submit('abort')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(session.state()).toBe('failed');
    expect(runner.calls).toHaveLength(0);
  });

  it('rejects cleanup from waiting even when device cleanup itself matches', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
    });
    await session.start();
    await session.submit('install-launch');

    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(receipts).not.toContain('human_pass:match');
    expect(receipts).not.toContain('complete:match');
    expect(receipts.filter((receipt) =>
      receipt === 'failed:mismatch')).toEqual(['failed:mismatch']);
  });

  it('accepts Human PASS exactly once and fails closed on a duplicate', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
    });
    await session.start();
    await session.submit('install-launch');
    await expect(session.submit('human-pass')).resolves.toEqual({
      status: 'match',
    });
    expect(session.state()).toBe('human_passed');

    await expect(session.submit('human-pass')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(receipts.filter((receipt) =>
      receipt === 'human_pass:match')).toEqual(['human_pass:match']);
    expect(receipts).not.toContain('complete:match');
    expect(receipts.filter((receipt) =>
      receipt === 'failed:mismatch')).toEqual(['failed:mismatch']);
  });

  it.each(['EOF', ...handledSignalNames])(
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

  it.each(['ready', 'waiting', 'human_passed'] as const)(
    'accepts abort as fail-closed cleanup in %s state',
    async (state) => {
      const runner = new FakeRunner();
      const session = createSession(runner);
      await session.start();
      if (state !== 'ready') {
        await session.submit('install-launch');
      }
      if (state === 'human_passed') {
        await session.submit('human-pass');
      }
      expect(session.state()).toBe(state);

      await expect(session.submit('abort')).resolves.toEqual({
        status: 'mismatch',
      });
      expect(runner.cleanupFlights).toBe(1);
      expect(runner.packagePath).toBeNull();
    },
  );

  it('aborts an active install by command and waits before one cleanup flight', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    runner.installWaitsForAbort = true;
    const session = createSession(runner, {
      receipt(
        stage: string,
        status: 'match' | 'mismatch',
        category?: DiagnosticCategory,
      ) {
        receipts.push(`${stage}:${status}:${category ?? 'none'}`);
      },
    });
    await session.start();
    const active = session.submit('install-launch');
    await runner.installStarted;
    void session.submit('abort');
    await active;
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.installSettled).toBe(true);
    expect(runner.abandonCount).toBe(1);
    expect(runner.cleanupFlights).toBe(1);
    expect(receipts).toContain(
      'installation:mismatch:operator_abort_mismatch',
    );
  });

  it.each([
    ['install-create', 'installation', 0],
    ['post-create-reattest', 'installation', 1],
    ['install-write', 'installation', 1],
    ['post-write-reattest', 'installation', 1],
    ['install-commit', 'installation', 1],
    ['installed-provenance', 'installed_provenance', 0],
  ] as const)(
    'classifies an accepted abort during %s from its winning cause',
    async (boundary, stage, expectedAbandonCount) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.abortBoundary = boundary;
      const session = createSession(runner, {
        receipt(
          receiptStage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ) {
          receipts.push(
            `${receiptStage}:${status}:${category ?? 'none'}`,
          );
        },
      });
      await session.start();

      const active = session.submit('install-launch');
      await runner.abortBoundaryStarted;
      const finishing = session.submit('abort');
      await active;
      await expect(finishing).resolves.toEqual({ status: 'mismatch' });
      await expect(session.done).resolves.toEqual({ status: 'mismatch' });

      expect(receipts.filter((receipt) =>
        receipt === `${stage}:mismatch:operator_abort_mismatch`,
      )).toHaveLength(1);
      expect(runner.abandonCount).toBe(expectedAbandonCount);
      expect(runner.cleanupFlights).toBe(1);
      expect(JSON.stringify(receipts)).not.toMatch(
        /SECRET-SERIAL|\\[42\\]|SECRET .* DETAIL/u,
      );
    },
  );

  it.each([
    {
      configure(runner: FakeRunner) {
        runner.createReject = true;
      },
      expected:
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
          .adbChildTransportMismatch,
      name: 'transport',
    },
    {
      configure(runner: FakeRunner) {
        runner.installMismatchCategory =
          DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
            .adbChildTimeoutMismatch;
      },
      expected:
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
          .adbChildTimeoutMismatch,
      name: 'timeout',
    },
    {
      configure(runner: FakeRunner) {
        runner.userListOutputAfterCreate =
          'Users:\n\tUserInfo{10:Foreign:c13} running\n';
      },
      expected:
        DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
          .verificationMismatch,
      name: 'verification',
    },
  ])(
    'does not relabel a winning $name failure from a visible abort flag',
    async ({ configure, expected }) => {
      const runner = new FakeRunner();
      configure(runner);
      const device = createDevice(runner);
      await device.preflight();

      const error = await device.installAndLaunch({
        operatorAbortRequested: () => true,
      }).catch((caught: unknown) => caught);

      expect(error).toMatchObject({
        category: expected,
        stage: 'installation',
      });
      await device.cleanup();
    },
  );

  it.each([
    ['install-create', 'createTimeout', 0],
    ['install-commit', 'commitTimeout', 1],
  ] as const)(
    'maps a typed %s child timeout to the fixed timeout receipt',
    async (_boundary, property, expectedAbandonCount) => {
      const runner = new FakeRunner();
      runner[property] = true;
      const device = createDevice(runner);
      await device.preflight();

      await expect(device.installAndLaunch()).rejects.toMatchObject({
        category: 'adb_child_timeout_mismatch',
        stage: 'installation',
      });
      await device.cleanup();
      expect(runner.abandonCount).toBe(expectedAbandonCount);
    },
  );

  it.each([
    ['reattestation', 'installation', 1, 0],
    ['installed-provenance', 'installed_provenance', 0, 1],
    ['prelaunch', 'prelaunch', 0, 1],
    ['activity-start', 'activity_start', 0, 1],
    ['postlaunch', 'postlaunch', 0, 1],
  ] as const)(
    'maps a winning typed timeout at %s independently of ambient category',
    async (
      timeoutBoundary,
      stage,
      expectedAbandonCount,
      expectedUninstallCount,
    ) => {
      const runner = new FakeRunner();
      runner.timeoutBoundary = timeoutBoundary;
      const device = createDevice(runner);
      await device.preflight();

      await expect(device.installAndLaunch()).rejects.toMatchObject({
        category: 'adb_child_timeout_mismatch',
        stage,
      });
      await device.cleanup();
      expect(runner.abandonCount).toBe(expectedAbandonCount);
      expect(runner.uninstallCount).toBe(expectedUninstallCount);
    },
  );

  it.each([
    {
      expectedAbandonCount: 0,
      expectedMutations: [] as string[],
      nowValues: [0, 238_000],
      phase: 'install-create',
    },
    {
      expectedAbandonCount: 1,
      expectedMutations: ['install-create', 'install-write'],
      nowValues: [0, 0, 0, 238_000],
      phase: 'install-commit',
    },
  ])(
    'maps local aggregate deadline exhaustion before $phase to timeout',
    async ({
      expectedAbandonCount,
      expectedMutations,
      nowValues,
    }) => {
      const runner = new FakeRunner();
      let nowIndex = 0;
      const device = createDevice(runner, {
        now() {
          const value = nowValues[nowIndex];
          nowIndex += 1;
          return value ?? runner.clock;
        },
      });
      await device.preflight();

      await expect(device.installAndLaunch()).rejects.toMatchObject({
        category: 'adb_child_timeout_mismatch',
        stage: 'installation',
      });
      expect(runner.mutations).toEqual(expectedMutations);
      await device.cleanup();
      expect(runner.abandonCount).toBe(expectedAbandonCount);
    },
  );

  it.each(['', '   ', 'unexpected'])(
    'classifies active-install local input %j as operator termination',
    async (command) => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.installWaitsForAbort = true;
      const session = createSession(runner, {
        receipt(
          stage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ) {
          receipts.push(`${stage}:${status}:${category ?? 'none'}`);
        },
      });
      await session.start();
      const active = session.submit('install-launch');
      await runner.installStarted;
      const finishing = session.submit(command);
      await active;
      await expect(finishing).resolves.toEqual({ status: 'mismatch' });
      await expect(session.done).resolves.toEqual({ status: 'mismatch' });
      expect(receipts.filter((receipt) =>
        receipt ===
          'installation:mismatch:operator_abort_mismatch',
      )).toHaveLength(1);
      expect(receipts).not.toContain(
        'installation:mismatch:adb_child_transport_mismatch',
      );
      expect(runner.cleanupFlights).toBe(1);
    },
  );

  it('classifies active-install EOF as local operator termination',
    async () => {
      const runner = new FakeRunner();
      const receipts: string[] = [];
      runner.installWaitsForAbort = true;
      const session = createSession(runner, {
        receipt(
          stage: string,
          status: 'match' | 'mismatch',
          category?: DiagnosticCategory,
        ) {
          receipts.push(`${stage}:${status}:${category ?? 'none'}`);
        },
      });
      await session.start();
      const active = session.submit('install-launch');
      await runner.installStarted;
      const finishing = session.end();
      await active;
      await expect(finishing).resolves.toEqual({ status: 'mismatch' });
      expect(receipts.filter((receipt) =>
        receipt ===
          'installation:mismatch:operator_abort_mismatch',
      )).toHaveLength(1);
      expect(receipts).not.toContain(
        'installation:mismatch:adb_child_transport_mismatch',
      );
      expect(runner.cleanupFlights).toBe(1);
    });

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
    const receipts: string[] = [];
    runner.installWaitsForAbort = true;
    const session = createSession(runner, {
      receipt(
        stage: string,
        status: 'match' | 'mismatch',
        category?: DiagnosticCategory,
      ) {
        receipts.push(`${stage}:${status}:${category ?? 'none'}`);
      },
    });
    await session.start();
    const active = session.submit('install-launch');
    await runner.installStarted;
    void session.signal();
    void session.signal();
    await active;
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.installSettled).toBe(true);
    expect(runner.abandonCount).toBe(1);
    expect(runner.cleanupFlights).toBe(1);
    expect(receipts).toContain(
      'installation:mismatch:operator_abort_mismatch',
    );
    const abandonIndex = runner.calls.findIndex((call) =>
      call.arguments_.includes('install-abandon'));
    const firstCleanupObservation = runner.calls.findIndex(
      (call, index) => (
        index > abandonIndex
        && (
          call.arguments_.includes('ps')
          || call.arguments_.includes('reverse')
          || (
            call.arguments_.includes('package')
            && call.arguments_.includes('-a')
          )
        )
      ),
    );
    expect(abandonIndex).toBeGreaterThan(-1);
    expect(firstCleanupObservation).toBeGreaterThan(abandonIndex);
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

  it('aborts an active preflight by command and proves two complete zero observations', async () => {
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
    void session.submit('abort');
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

  it('completes only after the Human-PASS handshake and cleanup', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
    });
    await session.start();
    await session.submit('install-launch');
    await expect(session.submit('human-pass')).resolves.toEqual({
      status: 'match',
    });
    await session.submit('cleanup');
    await expect(session.done).resolves.toEqual({ status: 'match' });
    expect(runner.finalZeroObservationsAfterCleanup).toBeGreaterThanOrEqual(2);
    expect(runner.cleanupFlights).toBe(1);
    expect(receipts).toContain('waiting:match');
    expect(receipts.slice(-3)).toEqual([
      'human_pass:match',
      'cleanup:match',
      'complete:match',
    ]);
    expect(receipts).not.toContain('failed:mismatch');
    expect(receipts.join('\n')).not.toContain(runner.serial);
    expect(receipts.join('\n')).not.toContain(model);
    expect(receipts.join('\n')).not.toContain(build);
    expect(receipts.join('\n')).not.toContain(validPath);
    expect(receipts.join('\n')).not.toContain('[42]');
    const install = runner.calls.find((call) =>
      call.arguments_.includes('install-create'));
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

  it('reattests canonical Phase-0 identities above MAX_SAFE_INTEGER', async () => {
    const largeDev = 9_007_199_254_740_993n;
    const largeIno = 1_152_921_500_312_573_001n;
    const tools = Object.freeze({
      ...verifiedTools,
      adb: Object.freeze({
        ...verifiedTools.adb,
        dev: largeDev.toString(10),
        ino: largeIno.toString(10),
      }),
    });
    const toolIdentityDependencies =
      createToolIdentityDependencies(tools);
    const adbLstatCalls = () => vi.mocked(
      toolIdentityDependencies.lstat,
    ).mock.calls.filter(([path]) => path === tools.adb.path).length;
    const runner = new FakeRunner();
    const session = createSession(runner, {
      toolIdentityDependencies,
      tools,
    });

    await session.start();
    expect(adbLstatCalls()).toBe(4);
    await session.submit('install-launch');
    await session.submit('human-pass');
    await session.submit('cleanup');

    await expect(session.done).resolves.toEqual({ status: 'match' });
    expect(adbLstatCalls()).toBe(6);
  });

  it('fails completion after equal-size in-place ADB digest drift', async () => {
    const runner = new FakeRunner();
    const toolIdentityDependencies = createToolIdentityDependencies(
      verifiedTools,
      () => runner.finalZeroObservationsAfterCleanup >= 2
        ? 'f'.repeat(64)
        : toolSha256,
    );
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
      toolIdentityDependencies,
    });

    await session.start();
    await session.submit('install-launch');
    await expect(session.submit('human-pass')).resolves.toEqual({
      status: 'match',
    });
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });

    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(runner.cleanupFlights).toBe(1);
    expect(receipts.slice(-2)).toEqual([
      'cleanup:mismatch',
      'failed:mismatch',
    ]);
    expect(receipts).not.toContain('complete:match');
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
        await session.submit('human-pass');
        await session.submit('cleanup');
      }

      await expect(session.done).resolves.toEqual({ status: 'mismatch' });
      expect(session.state()).toBe('failed');
    },
  );

  it('emits only terminal failure when the cleanup receipt exhausts the deadline', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
        if (stage === 'cleanup') {
          runner.clock += 30_000;
        }
      },
    });
    await session.start();
    await session.submit('install-launch');
    await session.submit('human-pass');
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'mismatch',
    });
    await expect(session.done).resolves.toEqual({ status: 'mismatch' });
    expect(session.state()).toBe('failed');
    expect(receipts.filter((receipt) =>
      receipt === 'complete:match'
      || receipt === 'failed:mismatch')).toEqual(['failed:mismatch']);
  });

  it('treats complete:match as the terminal commitment point', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
        if (stage === 'complete') {
          runner.clock += 30_000;
        }
      },
    });
    await session.start();
    await session.submit('install-launch');
    await session.submit('human-pass');
    await expect(session.submit('cleanup')).resolves.toEqual({
      status: 'match',
    });
    expect(session.state()).toBe('complete');
    expect(receipts.filter((receipt) =>
      receipt === 'complete:match'
      || receipt === 'failed:mismatch')).toEqual(['complete:match']);
  });

  it('does not let later input revalue an accepted terminal cleanup command', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
    });
    await session.start();
    await session.submit('install-launch');
    await session.submit('human-pass');
    const cleanup = session.submit('cleanup');
    const laterInput = session.submit('human-pass');
    const laterBlank = session.submit('');
    const laterEof = session.end();

    await expect(cleanup).resolves.toEqual({ status: 'match' });
    await expect(laterInput).resolves.toEqual({ status: 'match' });
    await expect(laterBlank).resolves.toEqual({ status: 'match' });
    await expect(laterEof).resolves.toEqual({ status: 'match' });
    expect(receipts.filter((receipt) =>
      receipt === 'complete:match'
      || receipt === 'failed:mismatch')).toEqual(['complete:match']);
  });

  it('rejects input after terminal success without a contradictory receipt', async () => {
    const runner = new FakeRunner();
    const receipts: string[] = [];
    const session = createSession(runner, {
      receipt(stage: string, status: 'match' | 'mismatch') {
        receipts.push(`${stage}:${status}`);
      },
    });
    await session.start();
    await session.submit('install-launch');
    await session.submit('human-pass');
    await session.submit('cleanup');
    await expect(session.done).resolves.toEqual({ status: 'match' });

    await expect(session.submit('human-pass')).resolves.toEqual({
      status: 'mismatch',
    });
    expect(receipts.filter((receipt) =>
      receipt === 'complete:match'
      || receipt === 'failed:mismatch')).toEqual(['complete:match']);
  });

  it('settles fail-closed when an unexpected cleanup wait rejects', async () => {
    const runner = new FakeRunner();
    const session = createSession(runner, {
      wait: async () => {
        throw new Error('cleanup wait unavailable');
      },
    });

    await session.start();
    await session.submit('install-launch');
    await session.submit('human-pass');
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
    await session.submit('human-pass');
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
    androidSdkAuthority,
    deviceModel: model,
    installStreamRunner: runner,
    now: () => runner.clock,
    profile: DA5_V5_VALIDATION_PHASE0_PROFILE,
    runner,
    sealArtifact: () => fakeSnapshot(),
    serialBinding: new Da5V5UsbSerialBinding(),
    toolIdentityDependencies: createToolIdentityDependencies(),
    tools: verifiedTools,
    wait: async (milliseconds) => {
      runner.clock += milliseconds;
      runner.onWait();
    },
    ...changes,
  });
}

function toolIdentity(path: string, ino: bigint | number) {
  return Object.freeze({
    bytes: 100,
    dev: '1',
    ino: String(ino),
    mode: 0o755,
    path,
    sha256: toolSha256,
  });
}

function createToolIdentityDependencies(
  tools: Readonly<Record<
    string,
    Readonly<Da5V5ValidationToolIdentity>
  >> = verifiedTools,
  sha256: (path: string) => string = () => toolSha256,
) {
  const identities = new Map(
    Object.values(tools).map((identity) => [
      identity.path,
      identity,
    ]),
  );
  return Object.freeze({
    lstat: vi.fn((path: string) => {
      const identity = identities.get(path);
      if (identity === undefined) {
        throw new Error('unexpected synthetic tool');
      }
      return {
        dev: BigInt(identity.dev),
        ino: BigInt(identity.ino),
        mode: 0o100000 | identity.mode,
        size: identity.bytes,
        isFile: () => true,
        isSymbolicLink: () => false,
      };
    }),
    realpath: (path: string) => path,
    sha256: vi.fn(sha256),
  });
}

function createDevice(
  runner: FakeRunner,
  changes: Record<string, unknown> = {},
) {
  return new Da5V5ValidationPhase0Device({
    androidBuild: build,
    deviceModel: model,
    installStreamRunner: runner,
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
  userListOutputAfterCreate?: string;
  userListOutputAfterWrite?: string;
  mainUser = '0';
  currentUser = '0';
  headlessSystemUserMode = 'false';
  processes: string[] = [];
  cleanupPackageOutputs: string[] = [];
  cleanupProcessOutputs: string[] = [];
  processOutput?: string;
  reverseOutput = '';
  reverseAfterLaunch?: string;
  reverseAfterDigest?: string;
  canonicalPath?: string;
  statSize = DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes;
  statMode = '81a4';
  statSequence?: string[];
  pathSequence?: string[];
  digestBytes = DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes;
  digestSha256 = DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.sha256;
  createResult = 'Success: created install session [42]';
  createReject = false;
  createTimeout = false;
  installResult =
    `Success: streamed ${DA5_V5_VALIDATION_PHASE0_ARTIFACT.apk.bytes} bytes`;
  installFailureLeavesPackage = false;
  installRaceLeavesForeignPackage = false;
  installReject = false;
  installMismatchCategory?: InstallStreamMismatchCategory;
  installNeverSettles = false;
  installPipePartial = false;
  installPipeClosedAfterAllBytes = false;
  installWaitsForAbort = false;
  abortBoundary?: AbortBoundary;
  timeoutBoundary?: TypedTimeoutBoundary;
  installSettled = false;
  commitResult = 'Success';
  commitReject = false;
  commitTimeout = false;
  abandonResult = 'Success';
  abandonReject = false;
  abandonCount = 0;
  commitCount = 0;
  createCount = 0;
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
  private nextUserListOutput?: string;
  clock = 0;
  runDurationMilliseconds = 0;
  private resolveInstallStarted!: () => void;
  private resolveAbortBoundaryStarted!: () => void;
  private abortBoundaryConsumed = false;
  private timeoutBoundaryConsumed = false;
  readonly abortBoundaryStarted = new Promise<void>((resolvePromise) => {
    this.resolveAbortBoundaryStarted = resolvePromise;
  });
  private resolvePreflightStarted!: () => void;
  readonly installStarted = new Promise<void>((resolvePromise) => {
    this.resolveInstallStarted = resolvePromise;
  });
  readonly preflightStarted = new Promise<void>((resolvePromise) => {
    this.resolvePreflightStarted = resolvePromise;
  });
  preflightWaitsForAbort = false;
  preflightSettled = false;

  async write(
    arguments_: readonly string[],
    options: {
      signal?: AbortSignal;
      stdinBytes: Buffer;
      timeoutMilliseconds: number;
    },
  ) {
    try {
      if (this.installMismatchCategory !== undefined) {
        return {
          category: this.installMismatchCategory,
          childTerminal: true,
          status: 'mismatch' as const,
          stdoutTerminal: true,
        };
      }
      return {
        status: 'match' as const,
        stdinTerminal: this.installPipePartial
          ? 'partial_then_pipe_closed' as const
          : this.installPipeClosedAfterAllBytes
            ? 'all_bytes_submitted_then_pipe_closed' as const
            : 'finished' as const,
        stdout: await this.run(arguments_, options),
      };
    } catch (error) {
      return {
        category:
          DA5_V5_VALIDATION_PHASE0_ERROR_CATEGORIES
            .adbChildTransportMismatch,
        childTerminal: false,
        status: 'mismatch' as const,
        stdoutTerminal: false,
        ...(error instanceof Da5V5AndroidCommandAbortError
          ? {
              terminalCause:
                DA5_V5_VALIDATION_INSTALL_STREAM_TERMINAL_CAUSES
                  .signalAbort,
            }
          : {}),
      };
    }
  }

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
    const command = arguments_.join(' ');
    if (arguments_[0] === 'devices') {
      if (
        this.createCount > 0
        && !this.mutations.includes('install-write')
      ) {
        this.throwTypedTimeoutAt('reattestation');
        await this.waitForAbortBoundary(
          'post-create-reattest',
          options.signal,
        );
      } else if (
        this.mutations.includes('install-write')
        && this.commitCount === 0
      ) {
        await this.waitForAbortBoundary(
          'post-write-reattest',
          options.signal,
        );
      }
      return [
        'List of devices attached',
        ...this.devices.map((device) =>
          `${device.serial}\t${device.state} ${device.transport}`),
        '',
      ].join('\n');
    }
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
      const output = this.nextUserListOutput ?? this.userListOutput;
      this.nextUserListOutput = undefined;
      return output;
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
    if (command.endsWith('shell ps -A -w -o NAME:4')) {
      if (this.processes.length > 0) {
        this.throwTypedTimeoutAt('postlaunch');
      }
      if (this.cleanupProcessOutputs.length > 0) {
        return this.cleanupProcessOutputs.shift() ?? '';
      }
      return this.processOutput
        ?? ['NAME', ...this.processes, ''].join('\n');
    }
    if (command.endsWith('reverse --list')) {
      if (this.packagePath !== null && this.processes.length === 0) {
        this.throwTypedTimeoutAt('prelaunch');
      }
      return this.reverseOutput;
    }
    if (command.includes('cmd package install-create')) {
      this.mutations.push('install-create');
      this.createCount += 1;
      await this.waitForAbortBoundary(
        'install-create',
        options.signal,
      );
      if (this.createReject) {
        throw new Error('SECRET CREATE TRANSPORT DETAIL');
      }
      if (this.createTimeout) {
        throw new Da5V5AndroidCommandTimeoutError();
      }
      this.nextUserListOutput = this.userListOutputAfterCreate;
      return `${this.createResult}\n`;
    }
    if (command.includes('cmd package install-write')) {
      this.mutations.push('install-write');
      this.resolveInstallStarted();
      if (this.abortBoundary === 'install-write') {
        await this.waitForAbortBoundary(
          'install-write',
          options.signal,
        );
      } else if (this.installNeverSettles) {
        await new Promise<void>(() => {});
      }
      if (this.installWaitsForAbort) {
        await new Promise<void>((_resolvePromise, rejectPromise) => {
          options.signal?.addEventListener('abort', () => {
            this.installSettled = true;
            rejectPromise(new Da5V5AndroidCommandAbortError());
          }, { once: true });
        });
      }
      if (this.installReject) {
        this.installSettled = true;
        this.cleanupPackageReads = 0;
        this.lateOutcomeArmed = true;
        throw new Error('timeout');
      }
      this.installSettled = true;
      if (this.installFailureLeavesPackage) {
        this.packagePath = validPath;
      }
      this.nextUserListOutput = this.userListOutputAfterWrite;
      return `${this.installResult}\n`;
    }
    if (command.includes('cmd package install-commit')) {
      this.mutations.push('install-commit');
      this.commitCount += 1;
      await this.waitForAbortBoundary(
        'install-commit',
        options.signal,
      );
      if (this.commitReject) {
        throw new Error('SECRET COMMIT TRANSPORT DETAIL');
      }
      if (this.commitTimeout) {
        throw new Da5V5AndroidCommandTimeoutError();
      }
      if (this.installRaceLeavesForeignPackage) {
        this.packagePath = replacementPath;
        this.versionCode = '2';
        return 'Failure [INSTALL_FAILED_ALREADY_EXISTS]\n';
      }
      if (this.commitResult === 'Success') {
        this.packagePath = validPath;
      }
      return `${this.commitResult}\n`;
    }
    if (command.includes('cmd package install-abandon')) {
      this.mutations.push('install-abandon');
      this.abandonCount += 1;
      if (this.abandonReject) {
        throw new Error('SECRET ABANDON TRANSPORT DETAIL');
      }
      return `${this.abandonResult}\n`;
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
      this.throwTypedTimeoutAt('activity-start');
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
    options: {
      maximumBytes: number;
      signal?: AbortSignal;
    },
  ) {
    this.binaryCalls.push({
      arguments_: [...arguments_],
      maximumBytes: options.maximumBytes,
    });
    this.throwTypedTimeoutAt('installed-provenance');
    await this.waitForAbortBoundary(
      'installed-provenance',
      options.signal,
    );
    if (this.reverseAfterDigest !== undefined) {
      this.reverseOutput = this.reverseAfterDigest;
    }
    return {
      bytes: this.digestBytes,
      sha256: this.digestSha256,
    };
  }

  private async waitForAbortBoundary(
    boundary: AbortBoundary,
    signal?: AbortSignal,
  ): Promise<void> {
    if (
      this.abortBoundary !== boundary
      || this.abortBoundaryConsumed
    ) {
      return;
    }
    this.abortBoundaryConsumed = true;
    this.resolveAbortBoundaryStarted();
    if (signal?.aborted === true) {
      throw new Da5V5AndroidCommandAbortError();
    }
    await new Promise<void>((_resolvePromise, rejectPromise) => {
      signal?.addEventListener('abort', () => {
        rejectPromise(new Da5V5AndroidCommandAbortError());
      }, { once: true });
    });
  }

  private throwTypedTimeoutAt(boundary: TypedTimeoutBoundary): void {
    if (
      this.timeoutBoundary === boundary
      && !this.timeoutBoundaryConsumed
    ) {
      this.timeoutBoundaryConsumed = true;
      throw new Da5V5AndroidCommandTimeoutError();
    }
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
