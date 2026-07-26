import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import {
  constants,
  chmod,
  link,
  mkdtemp,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { PassThrough, type Readable, type Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DA5_V5_ADMIN_GROUP_ANCHOR,
  assertDa5V5UnixSocketPathBound,
  bindDa5V5PostgresBinaryChain,
  captureDa5V5ProcessIdentityForTest,
  classifyDa5V5PostgresStartupFailure,
  classifyDa5V5PostgresStartupFailureForTest,
  disclosureSafeDa5V5PostgresLifecycleError,
  da5V5RetainedStartupCleanupCountForTest,
  da5V5RetainedStartupProcessesForTest,
  rejectOperationalEnvironment,
  revalidateDa5V5ProcessIdentityForTest,
  retryDa5V5RetainedStartupCleanupsForTest,
  runDa5V5AllPathCleanupForTest,
  runDa5V5HandleOpenSisterFailureForTest,
  runDa5V5ReattestationBoundCleanupForTest,
  startDa5V5FullyAttestedTestPostgresOwner,
  validateDa5V5TemporaryBase,
  verifyDa5V5TrustedAdminGroupSnapshot,
  type Da5V5TrustedAdminGroupSnapshot,
} from '../src/Da5V5PostgresRuntimeGuard.js';
import {
  closeDa5V5PostgresCapability,
  createDa5V5TestPostgresCapability,
  da5V5PostgresCapabilityState,
  type Da5V5PostgresCapability,
} from '../src/Da5V5PostgresCapability.js';
import { buildDa5V5TemporaryTestGuard } from '../src/Da5V5RuntimeGuardArtifact.js';

let suiteRoot = '';
let binaryPath = '';
let cleanupBinary = async (): Promise<void> => undefined;

beforeAll(async () => {
  suiteRoot = await mkdtemp(join(tmpdir(), 'taptime-da5-runtime-guard-'));
  const artifact = await buildDa5V5TemporaryTestGuard({
    sourcePath: new URL('../native/da5_v5_runtime_guard.c', import.meta.url).pathname,
    temporaryRoot: suiteRoot,
  });
  binaryPath = artifact.binaryPath;
  cleanupBinary = artifact.cleanup;
});

afterAll(async () => {
  await cleanupBinary();
  await rm(suiteRoot, { force: true, recursive: true });
});

describe('DA5 V5 native Runtime Guard private protocol', () => {
  it('binds initdb to the UTF8 encoding required by the migration contract',
    async () => {
      const source = await readFile(new URL(
        '../native/da5_v5_runtime_guard.c',
        import.meta.url,
      ), 'utf8');
      const spawnStart = source.indexOf('static int spawn_initdb(');
      const spawnEnd = source.indexOf(
        'static int supervise_initdb(',
        spawnStart,
      );
      const spawnInitdb = source.slice(spawnStart, spawnEnd);
      expect(spawnStart).toBeGreaterThanOrEqual(0);
      expect(spawnEnd).toBeGreaterThan(spawnStart);
      expect(spawnInitdb).toContain('(char *)"--encoding=UTF8"');
      expect(spawnInitdb).not.toContain('--encoding=SQL_ASCII');
    });

  it('runs the bounded no-replace and non-reaping PROBE_ONLY contract', async () => {
    const fixture = await spawnProbeGuard();
    try {
      const hello = await readFrame(fixture.events);
      const fields = hello.split('|');
      expect(fields.slice(0, 2)).toEqual(['HELLO', '1']);
      expect(fields[2]).toBe(String(fixture.child.pid));
      expect(fields[2]).toBe(fields[3]);
      expect(fields[2]).toBe(fields[4]);
      expect(fields[5]).toMatch(/^[a-f0-9]{32}$/u);
      expect(fields[6]).toBe('test');

      writeFrame(fixture.control, manifestFrame(fields[5] as string));
      await expect(readFrame(fixture.events)).resolves.toBe('ACK');
      await expect(readFrame(fixture.events)).resolves.toBe('PROBE_OK');
      const [code, signal] = fixture.child.exitCode !== null
        || fixture.child.signalCode !== null
        ? [fixture.child.exitCode, fixture.child.signalCode]
        : await once(fixture.child, 'exit') as [
            number | null,
            NodeJS.Signals | null,
          ];
      expect({ code, signal }).toEqual({ code: 0, signal: null });
      await expect(readdirNames(fixture.stagingPath)).resolves.toEqual([
        fixture.rootName,
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it.each([
    ['before', 'test-crash-before-probe', 90],
    ['after', 'test-crash-after-probe', 91],
  ] as const)(
    'preserves the probe namespace on a forced exit %s the probe',
    async (_label, crashMarker, expectedExit) => {
      const fixture = await spawnProbeGuard();
      try {
        const hello = await readFrame(fixture.events);
        writeFrame(
          fixture.control,
          manifestFrame(hello.split('|')[5] as string, crashMarker),
        );
        await expect(readFrame(fixture.events)).resolves.toBe('ACK');
        await expect(readFrame(fixture.events)).resolves.toBe(
          `TEST_FORCED_EXIT|${expectedExit - 90}`,
        );
        await expect(readFrame(fixture.events)).rejects.toThrow(
          'event pipe closed',
        );
        const [code, signal] = fixture.child.exitCode !== null
          || fixture.child.signalCode !== null
          ? [fixture.child.exitCode, fixture.child.signalCode]
          : await once(fixture.child, 'exit') as [
              number | null,
              NodeJS.Signals | null,
            ];
        expect({ code, signal }).toEqual({
          code: expectedExit,
          signal: null,
        });
        await expect(readdirNames(fixture.stagingPath)).resolves.toEqual([
          fixture.rootName,
        ]);
      } finally {
        await fixture.cleanup();
      }
    },
  );

  it.each([0, 1, 3] as const)(
    'closes every captured handle when sister open %i fails',
    async (failureIndex) => {
      const paths = await Promise.all([
        '/bin/sh',
        '/bin/ls',
        '/usr/bin/true',
        '/usr/bin/false',
      ].map(async (path) => realpath(path)));
      let caught: unknown;
      try {
        await runDa5V5HandleOpenSisterFailureForTest({
          failureIndex,
          paths,
        });
      } catch (error: unknown) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).cause).toEqual(
        new Error(`synthetic-handle-open-failure-${failureIndex}`),
      );
    },
  );

  it('rejects a closed raw pipe observed before expected termination', async () => {
    const earlyReset = new PassThrough();
    const earlyObserver = observeRawFixtureStreams([
      { direction: 'readable', stream: earlyReset },
    ]);
    const emitted = once(earlyReset, 'error');
    earlyReset.destroy(Object.assign(new Error('early reset'), {
      code: 'ECONNRESET',
    }));
    await emitted;
    earlyObserver.markExpectedTermination();
    await expect(
      earlyObserver.settleAfterExpectedTermination(),
    ).rejects.toThrow('unexpected raw fixture stream failure');
    expect(earlyReset.listenerCount('error')).toBe(0);
  });

  it('tolerates a closed raw pipe only after expected termination', async () => {
    const expectedReset = new PassThrough();
    const expectedObserver = observeRawFixtureStreams([
      { direction: 'readable', stream: expectedReset },
    ]);
    expectedObserver.markExpectedTermination();
    expectedReset.destroy(Object.assign(new Error('expected reset'), {
      code: 'ECONNRESET',
    }));
    await expect(
      expectedObserver.settleAfterExpectedTermination(),
    ).resolves.toBeUndefined();
    expect(expectedReset.listenerCount('error')).toBe(0);
  });

  it('observes a late closed-pipe error after finish until definitive close', async () => {
    const lateReset = new PassThrough({ autoDestroy: false });
    const lateObserver = observeRawFixtureStreams([
      { direction: 'writable', stream: lateReset },
    ]);
    lateObserver.markExpectedTermination();
    lateReset.end();
    await once(lateReset, 'finish');
    await Promise.resolve();
    expect(lateReset.closed).toBe(false);
    expect(lateReset.listenerCount('error')).toBeGreaterThan(0);
    lateReset.emit('error', Object.assign(new Error('late reset'), {
      code: 'ECONNRESET',
    }));
    lateReset.destroy();
    await expect(
      lateObserver.settleAfterExpectedTermination(),
    ).resolves.toBeUndefined();
    expect(lateReset.closed).toBe(true);
    expect(lateReset.listenerCount('error')).toBe(0);
  });

  it('rejects an unexpected raw pipe failure after expected termination', async () => {
    const unexpectedFailure = new PassThrough();
    const unexpectedObserver = observeRawFixtureStreams([
      { direction: 'readable', stream: unexpectedFailure },
    ]);
    unexpectedObserver.markExpectedTermination();
    unexpectedFailure.destroy(Object.assign(new Error('unexpected failure'), {
      code: 'EIO',
    }));
    await expect(
      unexpectedObserver.settleAfterExpectedTermination(),
    ).rejects.toThrow('unexpected raw fixture stream failure');
    expect(unexpectedFailure.listenerCount('error')).toBe(0);
  });

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)(
    'does not convert an external %s into a protocol command',
    async (signal) => {
      const fixture = await spawnProbeGuard();
      try {
        const hello = await readFrame(fixture.events);
        const fields = hello.split('|');
        process.kill(-(fixture.child.pid as number), signal);
        await new Promise((resolve) => setTimeout(resolve, 25));
        expect(fixture.child.exitCode).toBeNull();
        expect(fixture.child.signalCode).toBeNull();
        writeFrame(fixture.control, manifestFrame(fields[5] as string));
        await expect(readFrame(fixture.events)).resolves.toBe('ACK');
        await expect(readFrame(fixture.events)).resolves.toBe('PROBE_OK');
        const [code, deliveredSignal] = await once(fixture.child, 'exit') as [
          number | null,
          NodeJS.Signals | null,
        ];
        expect({ code, signal: deliveredSignal }).toEqual({
          code: 0,
          signal: null,
        });
      } finally {
        await fixture.cleanup();
      }
    },
  );

  it('rejects a wrong lifecycle nonce before any namespace mutation', async () => {
    const fixture = await spawnProbeGuard();
    try {
      await readFrame(fixture.events);
      writeFrame(fixture.control, manifestFrame('0'.repeat(32)));
      const [code, signal] = await once(fixture.child, 'exit') as [
        number | null,
        NodeJS.Signals | null,
      ];
      expect(code).not.toBe(0);
      expect(signal).toBeNull();
      await expect(readdirNames(fixture.stagingPath)).resolves.toEqual([
        fixture.rootName,
      ]);
    } finally {
      await fixture.cleanup();
    }
  });

  it('fails boundedly on control EOF and never accepts terminal stdio', async () => {
    const fixture = await spawnProbeGuard();
    try {
      await readFrame(fixture.events);
      fixture.control.end();
      const exit = Promise.race([
        once(fixture.child, 'exit'),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error('Runtime Guard EOF did not terminate')), 6_000);
        }),
      ]);
      const [code, signal] = await exit as [number | null, NodeJS.Signals | null];
      expect(code).not.toBe(0);
      expect(signal).toBeNull();
    } finally {
      await fixture.cleanup();
    }
  });

  it('rejects oversized and malformed private frames', async () => {
    const fixture = await spawnProbeGuard();
    try {
      await readFrame(fixture.events);
      const header = Buffer.alloc(4);
      header.writeUInt32BE(4_097);
      fixture.control.write(header);
      const [code] = await once(fixture.child, 'exit') as [number | null];
      expect(code).not.toBe(0);
    } finally {
      await fixture.cleanup();
    }
  });

  it('spawns a direct child safely from a pthread-active Guard and cleans it', async () => {
    const source = await readFile(
      new URL('../native/da5_v5_runtime_guard.c', import.meta.url),
      'utf8',
    );
    const postgresSpawn = source.slice(
      source.indexOf('static pid_t spawn_postgres('),
      source.indexOf('static int wait_postgres_stop('),
    );
    expect(postgresSpawn).toContain('posix_spawn(&child');
    expect(postgresSpawn).not.toContain('fork()');

    const fixture = await spawnEarlyExitGuard();
    try {
      const hello = await readFrame(fixture.events);
      const nonce = hello.split('|')[5] as string;
      fixture.secret.end(Buffer.from('synthetic-test-secret'));
      writeFrame(fixture.control, fixture.manifest(nonce));
      await expect(readFrame(fixture.events)).resolves.toBe('ACK');
      await expect(readFrame(fixture.events)).resolves.toMatch(
        /^MOUNT_BINDING\|[a-f0-9]{64}\|(?:[a-f0-9]{2})+$/u,
      );
      await expect(readFrame(fixture.events)).resolves.toBe('INITDB_OK');
      writeFrame(fixture.control, `CONFIG_READY|${fixture.capability}`);
      await expect(readFrame(fixture.events)).resolves.toMatch(
        /^POSTGRES_SPAWNED\|[1-9][0-9]*$/u,
      );
      const heartbeat = setInterval(() => {
        writeFrame(fixture.control, `HEARTBEAT|${fixture.capability}`);
      }, 25);
      heartbeat.unref();
      try {
        await expect(readFrame(fixture.events)).resolves.toBe(
          'POSTGRES_EXITED_EARLY',
        );
      } finally {
        clearInterval(heartbeat);
      }
      writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
      await expect(readFrame(fixture.events)).resolves.toBe('POSTGRES_REAPED');
      await expect(readFrame(fixture.events)).resolves.toBe('CLEANUP_OK');
      const [code, signal] = await once(fixture.child, 'exit') as [
        number | null,
        NodeJS.Signals | null,
      ];
      expect({ code, signal }).toEqual({ code: 0, signal: null });
      await expect(readdir(fixture.stagingPath)).resolves.toEqual([]);

      const classifiedLog = join(fixture.stagingPath, 'classified.log');
      await writeFile(
        classifiedLog,
        'FATAL: Unix-domain socket path is too long\n',
        { flag: 'wx', mode: 0o600 },
      );
      await expect(classifyDa5V5PostgresStartupFailure(classifiedLog))
        .resolves.toMatchObject({ category: 'socket-path-too-long' });
    } finally {
      await fixture.cleanup();
    }
  });

  it('gives the postgres child only the fixed trusted C locale environment', async () => {
    const probePath = join(
      suiteRoot,
      `locale-probe-${randomBytes(8).toString('hex')}.js`,
    );
    await writeFile(
      probePath,
      `#!${process.execPath}
const expected = {
  HOME: '/var/empty',
  LC_ALL: 'C',
  PATH: '/usr/bin:/bin',
  TZ: 'UTC',
};
const keys = Object.keys(process.env).sort();
const allowed = new Set([...Object.keys(expected), '__CF_USER_TEXT_ENCODING']);
const poison = ['LANG', 'LANGUAGE', 'LC_TIME', 'PGPASSWORD'];
const passed = Object.entries(expected)
  .every(([key, value]) => process.env[key] === value)
  && keys.every((key) => allowed.has(key))
  && poison.every((key) => process.env[key] === undefined);
process.stdout.write(passed ? 'DA5_ENV_OK\\n' : 'DA5_ENV_MISMATCH\\n');
process.exit(passed ? 0 : 42);
`,
      { flag: 'wx', mode: 0o555 },
    );
    const fixture = await spawnEarlyExitGuard({
      parentEnvironment: {
        LANG: 'poisoned',
        LANGUAGE: 'poisoned',
        LC_ALL: 'poisoned',
        LC_TIME: 'poisoned',
        PGPASSWORD: 'poisoned',
      },
      postgresBinary: probePath,
    });
    let primaryFailure: unknown;
    let stopFastSent = false;
    let terminalEventsRead = false;
    let guardExitObserved = false;
    try {
      const hello = await readFrame(fixture.events);
      const nonce = hello.split('|')[5] as string;
      fixture.secret.end(Buffer.from('synthetic-test-secret'));
      writeFrame(fixture.control, fixture.manifest(nonce));
      await expect(readFrame(fixture.events)).resolves.toBe('ACK');
      await expect(readFrame(fixture.events)).resolves.toMatch(
        /^MOUNT_BINDING\|[a-f0-9]{64}\|(?:[a-f0-9]{2})+$/u,
      );
      await expect(readFrame(fixture.events)).resolves.toBe('INITDB_OK');
      writeFrame(fixture.control, `CONFIG_READY|${fixture.capability}`);
      await expect(readFrame(fixture.events)).resolves.toMatch(
        /^POSTGRES_SPAWNED\|[1-9][0-9]*$/u,
      );
      const heartbeat = setInterval(() => {
        writeFrame(fixture.control, `HEARTBEAT|${fixture.capability}`);
      }, 25);
      heartbeat.unref();
      try {
        await expect(readFrame(fixture.events)).resolves.toBe(
          'POSTGRES_EXITED_EARLY',
        );
      } finally {
        clearInterval(heartbeat);
      }
      await expect(readFile(fixture.logPath, 'utf8')).resolves.toBe(
        'DA5_ENV_OK\n',
      );
      writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
      stopFastSent = true;
      await expect(readFrame(fixture.events)).resolves.toBe('POSTGRES_REAPED');
      await expect(readFrame(fixture.events)).resolves.toBe('CLEANUP_OK');
      terminalEventsRead = true;
      const [code, signal] = fixture.child.exitCode !== null
        || fixture.child.signalCode !== null
        ? [fixture.child.exitCode, fixture.child.signalCode]
        : await once(fixture.child, 'exit') as [
            number | null,
            NodeJS.Signals | null,
          ];
      guardExitObserved = true;
      expect({ code, signal }).toEqual({ code: 0, signal: null });
      await expect(readdir(fixture.stagingPath)).resolves.toEqual([]);
    } catch (error: unknown) {
      primaryFailure = error;
    } finally {
      try {
        if (!stopFastSent) {
          writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
          stopFastSent = true;
        }
        if (!terminalEventsRead) {
          const reaped = await readFrame(fixture.events);
          const cleaned = await readFrame(fixture.events);
          if (reaped !== 'POSTGRES_REAPED' || cleaned !== 'CLEANUP_OK') {
            throw new Error('Runtime Guard terminal cleanup events mismatch');
          }
          terminalEventsRead = true;
        }
        if (!guardExitObserved) {
          const [code, signal] = fixture.child.exitCode !== null
            || fixture.child.signalCode !== null
            ? [fixture.child.exitCode, fixture.child.signalCode]
            : await once(fixture.child, 'exit') as [
                number | null,
                NodeJS.Signals | null,
              ];
          guardExitObserved = true;
          if (code !== 0 || signal !== null) {
            throw new Error('Runtime Guard terminal exit mismatch');
          }
        }
      } catch (cleanupError: unknown) {
        primaryFailure ??= cleanupError;
      }
      try {
        await fixture.cleanup();
      } catch (cleanupError: unknown) {
        primaryFailure ??= cleanupError;
      }
    }
    if (primaryFailure !== undefined) {
      throw primaryFailure;
    }
  });

  it.each([
    [
      'rename',
      async (rootPath: string) => rename(
        join(rootPath, 'socket'),
        join(rootPath, 'renamed-after-inventory'),
      ),
    ],
    [
      'unlink',
      async (rootPath: string) => rmdir(join(rootPath, 'socket')),
    ],
    [
      'new nested entry',
      async (rootPath: string) => writeFile(
        join(rootPath, 'socket', 'added-after-final-stat'),
        'synthetic',
        { flag: 'wx', mode: 0o600 },
      ),
    ],
  ] as const)(
    'preserves the tombstone on deterministic %s non-convergence',
    async (_label, mutate) => {
      const fixture = await spawnEarlyExitGuard();
      let primaryFailure: unknown;
      try {
        await advanceEarlyExitGuard(fixture);
        writeFrame(
          fixture.control,
          `TEST_PAUSE_CLEANUP|${fixture.capability}`,
        );
        await expect(readFrame(fixture.events)).resolves.toBe(
          'TEST_CLEANUP_PAUSE_ARMED',
        );
        writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
        await expect(readFrame(fixture.events)).resolves.toBe(
          'POSTGRES_REAPED',
        );
        await expect(readFrame(fixture.events)).resolves.toBe(
          'TEST_CLEANUP_PAUSED',
        );
        await mutate(fixture.tombstonePath);
        writeFrame(
          fixture.control,
          `TEST_CONTINUE_CLEANUP|${fixture.capability}`,
        );
        await expect(readFrame(fixture.events)).resolves.toMatch(
          /^CLEANUP_PRESERVED\|/u,
        );
        const [code, signal] = fixture.child.exitCode !== null
          || fixture.child.signalCode !== null
          ? [fixture.child.exitCode, fixture.child.signalCode]
          : await once(fixture.child, 'exit') as [
              number | null,
              NodeJS.Signals | null,
            ];
        expect({ code, signal }).toEqual({ code: 89, signal: null });
      } catch (error: unknown) {
        primaryFailure = error;
      } finally {
        try {
          await fixture.cleanup();
        } catch (cleanupError: unknown) {
          primaryFailure ??= cleanupError;
        }
      }
      if (primaryFailure !== undefined) {
        throw primaryFailure;
      }
    },
  );

  it.runIf(process.platform === 'darwin')(
    'stops after deleting one sacrificial empty-directory substitute and preserves every remaining target',
    async () => {
      const fixture = await spawnEarlyExitGuard();
      const retainedSocket = join(
        fixture.tombstonePath,
        'socket-retained-after-final-stat',
      );
      let primaryFailure: unknown;
      try {
        await advanceEarlyExitGuard(fixture);
        writeFrame(
          fixture.control,
          `TEST_PAUSE_CLEANUP|${fixture.capability}`,
        );
        await expect(readFrame(fixture.events)).resolves.toBe(
          'TEST_CLEANUP_PAUSE_ARMED',
        );
        writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
        await expect(readFrame(fixture.events)).resolves.toBe(
          'POSTGRES_REAPED',
        );
        await expect(readFrame(fixture.events)).resolves.toBe(
          'TEST_CLEANUP_PAUSED',
        );

        await rename(
          join(fixture.tombstonePath, 'socket'),
          retainedSocket,
        );
        await mkdir(join(fixture.tombstonePath, 'socket'), {
          mode: 0o700,
        });
        writeFrame(
          fixture.control,
          `TEST_CONTINUE_CLEANUP|${fixture.capability}`,
        );

        await expect(readFrame(fixture.events)).resolves.toMatch(
          /^CLEANUP_PRESERVED\|/u,
        );
        const [code, signal] = fixture.child.exitCode !== null
          || fixture.child.signalCode !== null
          ? [fixture.child.exitCode, fixture.child.signalCode]
          : await once(fixture.child, 'exit') as [
              number | null,
              NodeJS.Signals | null,
            ];
        expect({ code, signal }).toEqual({ code: 89, signal: null });
        await expect(stat(retainedSocket)).resolves.toMatchObject({
          mode: expect.any(Number),
        });
        await expect(readdirNames(fixture.tombstonePath)).resolves.toEqual(
          expect.arrayContaining([
            'data',
            'fake-initdb',
            'postgres.log',
            'socket-retained-after-final-stat',
          ]),
        );
      } catch (error: unknown) {
        primaryFailure = error;
      } finally {
        try {
          await fixture.cleanup();
        } catch (cleanupError: unknown) {
          primaryFailure ??= cleanupError;
        }
      }
      if (primaryFailure !== undefined) {
        throw primaryFailure;
      }
    },
  );

  it('preserves a hard-linked cleanup target instead of deleting aliases',
    async () => {
      const fixture = await spawnEarlyExitGuard();
      let primaryFailure: unknown;
      try {
        await advanceEarlyExitGuard(fixture);
        await link(
          fixture.logPath,
          join(fixture.rootPath, 'postgres-hardlink.log'),
        );
        writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
        await expect(readFrame(fixture.events)).resolves.toBe(
          'POSTGRES_REAPED',
        );
        await expect(readFrame(fixture.events)).resolves.toMatch(
          /^CLEANUP_PRESERVED\|/u,
        );
        const [code, signal] = await once(fixture.child, 'exit') as [
          number | null,
          NodeJS.Signals | null,
        ];
        expect({ code, signal }).toEqual({ code: 89, signal: null });
      } catch (error: unknown) {
        primaryFailure = error;
      } finally {
        try {
          await fixture.cleanup();
        } catch (cleanupError: unknown) {
          primaryFailure ??= cleanupError;
        }
      }
      if (primaryFailure !== undefined) {
        throw primaryFailure;
      }
    });

  it('preserves the complete tombstone on a per-directory mount-tuple mismatch',
    async () => {
      const fixture = await spawnEarlyExitGuard();
      let primaryFailure: unknown;
      try {
        await advanceEarlyExitGuard(fixture);
        writeFrame(
          fixture.control,
          `TEST_MISMATCH_MOUNT_CLEANUP|${fixture.capability}`,
        );
        await expect(readFrame(fixture.events)).resolves.toBe(
          'TEST_CLEANUP_MOUNT_MISMATCH_ARMED',
        );
        writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
        await expect(readFrame(fixture.events)).resolves.toBe(
          'POSTGRES_REAPED',
        );
        await expect(readFrame(fixture.events)).resolves.toMatch(
          /^CLEANUP_PRESERVED\|/u,
        );
        const [code, signal] = await once(fixture.child, 'exit') as [
          number | null,
          NodeJS.Signals | null,
        ];
        expect({ code, signal }).toEqual({ code: 89, signal: null });
        await expect(readdirNames(fixture.tombstonePath)).resolves.toEqual(
          expect.arrayContaining([
            'data',
            'fake-initdb',
            'postgres.log',
            'socket',
          ]),
        );
      } catch (error: unknown) {
        primaryFailure = error;
      } finally {
        try {
          await fixture.cleanup();
        } catch (cleanupError: unknown) {
          primaryFailure ??= cleanupError;
        }
      }
      if (primaryFailure !== undefined) {
        throw primaryFailure;
      }
    });

  it.each([
    ['before rename', 'TEST_CRASH_BEFORE_RENAME', 1, 92],
    ['after rename', 'TEST_CRASH_AFTER_RENAME', 2, 93],
    ['after inventory', 'TEST_CRASH_AFTER_INVENTORY', 3, 94],
    [
      'after final validation',
      'TEST_CRASH_AFTER_FINAL_VALIDATION',
      4,
      95,
    ],
    ['after one unlink', 'TEST_CRASH_AFTER_ONE_UNLINK', 5, 96],
  ] as const)(
    'reports no false cleanup success after a forced exit %s',
    async (label, command, armedIndex, expectedExit) => {
      const fixture = await spawnEarlyExitGuard();
      let primaryFailure: unknown;
      try {
        await advanceEarlyExitGuard(fixture);
        writeFrame(
          fixture.control,
          `${command}|${fixture.capability}`,
        );
        await expect(readFrame(fixture.events)).resolves.toBe(
          `TEST_CLEANUP_CRASH_ARMED|${armedIndex}`,
        );
        writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
        await expect(readFrame(fixture.events)).resolves.toBe(
          'POSTGRES_REAPED',
        );
        await expect(readFrame(fixture.events)).resolves.toBe(
          `TEST_FORCED_EXIT|${armedIndex + 1}`,
        );
        await expect(readFrame(fixture.events)).rejects.toThrow(
          'event pipe closed',
        );
        const [code, signal] = await once(fixture.child, 'exit') as [
          number | null,
          NodeJS.Signals | null,
        ];
        expect({ code, signal }).toEqual({
          code: expectedExit,
          signal: null,
        });
        if (label === 'before rename') {
          await expect(stat(fixture.rootPath)).resolves.toMatchObject({
            mode: expect.any(Number),
          });
          await expect(stat(fixture.tombstonePath)).rejects.toThrow();
        } else {
          await expect(stat(fixture.rootPath)).rejects.toThrow();
          const retainedNames = await readdirNames(fixture.tombstonePath);
          expect(retainedNames).toEqual(
            label === 'after one unlink'
              ? ['data', 'fake-initdb', 'postgres.log']
              : ['data', 'fake-initdb', 'postgres.log', 'socket'],
          );
        }
      } catch (error: unknown) {
        primaryFailure = error;
      } finally {
        try {
          await fixture.cleanup();
        } catch (cleanupError: unknown) {
          primaryFailure ??= cleanupError;
        }
      }
      if (primaryFailure !== undefined) {
        throw primaryFailure;
      }
    },
  );

  it.runIf(process.platform === 'darwin')(
    'preserves the tombstone for extended and inherited ACL entries',
    async () => {
      for (const [relativePath, acl] of [
        ['fake-initdb', 'everyone allow read'],
        [
          'data',
          'everyone allow read,readattr,file_inherit,directory_inherit',
        ],
      ] as const) {
        const fixture = await spawnEarlyExitGuard();
        let primaryFailure: unknown;
        try {
          await advanceEarlyExitGuard(fixture);
          const result = spawn('/bin/chmod', [
            '+a',
            acl,
            join(fixture.rootPath, relativePath),
          ], {
            env: {},
            shell: false,
            stdio: 'ignore',
          });
          const [code, signal] = await once(result, 'exit') as [
            number | null,
            NodeJS.Signals | null,
          ];
          expect({ code, signal }).toEqual({ code: 0, signal: null });
          writeFrame(fixture.control, `STOP_FAST|${fixture.capability}`);
          await expect(readFrame(fixture.events)).resolves.toBe(
            'POSTGRES_REAPED',
          );
          await expect(readFrame(fixture.events)).resolves.toMatch(
            /^CLEANUP_PRESERVED\|/u,
          );
          const [guardCode, guardSignal] =
            fixture.child.exitCode !== null
            || fixture.child.signalCode !== null
              ? [fixture.child.exitCode, fixture.child.signalCode]
              : await once(
                  fixture.child,
                  'exit',
                ) as [number | null, NodeJS.Signals | null];
          expect({ code: guardCode, signal: guardSignal }).toEqual({
            code: 89,
            signal: null,
          });
          await expect(stat(fixture.tombstonePath)).resolves.toMatchObject({
            mode: expect.any(Number),
          });
        } catch (error: unknown) {
          primaryFailure = error;
        } finally {
          try {
            await fixture.cleanup();
          } catch (cleanupError: unknown) {
            primaryFailure ??= cleanupError;
          }
        }
        if (primaryFailure !== undefined) {
          throw primaryFailure;
        }
      }
    },
  );
});

describe('DA5 V5 trusted macOS admin snapshot and PostgreSQL chain', () => {
  it.runIf(process.platform === 'darwin')(
    'accepts only exact local sticky-root or private same-EUID temporary bases',
    async () => {
      await expect(validateDa5V5TemporaryBase('/private/tmp')).resolves.toBeUndefined();
      await expect(validateDa5V5TemporaryBase(suiteRoot)).resolves.toBeUndefined();

      const unsafeBase = join(suiteRoot, 'non-sticky-world-writable');
      await mkdir(unsafeBase, { mode: 0o700 });
      await chmod(unsafeBase, 0o777);
      await expect(validateDa5V5TemporaryBase(unsafeBase)).rejects.toThrow(
        'temporary base is not private',
      );
    },
  );

  it('rejects a structurally forged snapshot before PostgreSQL discovery', async () => {
    const forged = {
      ...DA5_V5_ADMIN_GROUP_ANCHOR,
    } as unknown as Da5V5TrustedAdminGroupSnapshot;

    await expect(bindDa5V5PostgresBinaryChain({
      pgConfigPath: '/path/that/must/not/be-opened',
      snapshot: forged,
    })).rejects.toThrow('trusted admin-group snapshot mismatch');
  });

  it.runIf(process.platform === 'darwin')(
    'matches the exact current admin-group anchors without exposing identities',
    async () => {
      const snapshot = await verifyDa5V5TrustedAdminGroupSnapshot();

      expect(snapshot).toMatchObject(DA5_V5_ADMIN_GROUP_ANCHOR);
      expect(snapshot.directMembers).toBe(2);
      expect(snapshot.nestedGroups).toBe(0);
      expect(Object.keys(snapshot)).not.toContain('gid');
      expect(Object.keys(snapshot)).not.toContain('groupGuid');
      expect(Object.keys(snapshot)).not.toContain('memberPairs');
      expect(() => JSON.stringify(snapshot)).toThrow(
        'trusted admin-group snapshot is private',
      );
    },
  );

  it.runIf(process.platform === 'darwin')(
    'binds and revalidates the exact PostgreSQL 17.10 binary chain',
    async () => {
      const snapshot = await verifyDa5V5TrustedAdminGroupSnapshot();
      const chain = await bindDa5V5PostgresBinaryChain({
        pgConfigPath: '/opt/homebrew/opt/postgresql@17/bin/pg_config',
        snapshot,
      });
      try {
        expect(chain.bindir).toBe(
          '/opt/homebrew/Cellar/postgresql@17/17.10/bin',
        );
        expect(chain.pgConfig).toBe(`${chain.bindir}/pg_config`);
        expect(chain.initdb).toBe(`${chain.bindir}/initdb`);
        expect(chain.postgres).toBe(`${chain.bindir}/postgres`);
        expect(chain.chainDigest).toMatch(/^[a-f0-9]{64}$/u);
        await expect(chain.revalidate(snapshot)).resolves.toBeUndefined();
      } finally {
        await chain.close();
      }
    },
  );
});

describe('DA5 V5 closed environment and real transient PostgreSQL owner', () => {
  it.runIf(process.platform === 'darwin')(
    'rejects every real captured process identity field through the production revalidator',
    async () => {
      const child = spawn('/bin/sleep', ['20'], {
        cwd: '/',
        detached: true,
        env: {},
        shell: false,
        stdio: 'ignore',
      });
      await once(child, 'spawn');
      const pid = child.pid as number;
      const executableDigest = createHash('sha256')
        .update(await readFile('/bin/sleep'))
        .digest('hex');
      const capture = {
        authoritativeSessionId: pid,
        executableDigest,
        executablePath: '/bin/sleep',
        expectedParentPid: process.pid,
        expectedProcessGroup: pid,
        pid,
      };
      try {
        const expected = await captureDa5V5ProcessIdentityForTest(capture);
        const mutations = [
          ['pid', { pid: String(pid + 1) }],
          ['ppid', { parentPid: String(process.pid + 1) }],
          ['pgid', { pgid: String(pid + 1) }],
          ['authoritative-sid', { sessionId: String(pid + 1) }],
          ['start-time', { start: `${expected.start} changed` }],
          ['executable-path', { executablePath: '/usr/bin/false' }],
          ['executable-digest', { executableDigest: '0'.repeat(64) }],
        ] as const;
        for (const [label, mutation] of mutations) {
          await expect(revalidateDa5V5ProcessIdentityForTest({
            capture,
            expected,
            mutateCaptured: (captured) => Object.freeze({
              ...captured,
              ...mutation,
            }),
          }), label).rejects.toThrow(/process identity changed/);
        }
      } finally {
        child.kill('SIGTERM');
        await once(child, 'exit');
      }
    },
  );

  it.each([
    ['first', [0, 3], 0],
    ['middle', [2, 4], 2],
    ['last', [4], 4],
  ] as const)(
    'attempts every cleanup stage and retains the %s injected failure',
    async (_label, failureIndexes, firstFailureIndex) => {
      const attempted: number[] = [];
      const completed: number[] = [];
      const failures = new Map<number, Error>(failureIndexes.map((index) => [
        index,
        new Error(`synthetic-cleanup-failure-${index}`),
      ]));
      let caught: unknown;
      try {
        await runDa5V5AllPathCleanupForTest(
          Array.from({ length: 5 }, (_, index) => async () => {
            attempted.push(index);
            const failure = failures.get(index);
            if (failure !== undefined) {
              throw failure;
            }
            completed.push(index);
          }),
        );
      } catch (error: unknown) {
        caught = error;
      }
      expect(attempted).toEqual([0, 1, 2, 3, 4]);
      expect(completed).toEqual(
        [0, 1, 2, 3, 4].filter((index) => !failures.has(index)),
      );
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).cause).toBe(failures.get(firstFailureIndex));
    },
  );

  it.each([
    'artifact',
    'lifecycle',
    'destructive',
  ] as const)(
    'never sends STOP after failed %s reattestation and still closes all safe paths',
    async (stage) => {
      const firstFailure = new Error(`synthetic-${stage}-reattest-failure`);
      const safeActions: string[] = [];
      let destructiveCalls = 0;
      let stopCalls = 0;
      let caught: unknown;
      try {
        await runDa5V5ReattestationBoundCleanupForTest({
          destructiveActions: [
            () => {
              destructiveCalls += 1;
            },
          ],
          reattest: async () => {
            throw firstFailure;
          },
          safeActions: [
            () => {
              safeActions.push('control');
            },
            () => {
              safeActions.push('secret');
              throw new Error('synthetic sister close failure');
            },
            () => {
              safeActions.push('event');
            },
            () => {
              safeActions.push('wait');
            },
          ],
          sendStop: async () => {
            stopCalls += 1;
          },
        });
      } catch (error: unknown) {
        caught = error;
      }
      expect(stopCalls).toBe(0);
      expect(destructiveCalls).toBe(0);
      expect(safeActions).toEqual(['control', 'secret', 'event', 'wait']);
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).cause).toBe(firstFailure);
    },
  );

  it('uses scalar attestations and ordered credential-safe failure cleanup', async () => {
    const source = await readFile(
      new URL('../src/Da5V5PostgresRuntimeGuard.ts', import.meta.url),
      'utf8',
    );
    const untouched = source.slice(
      source.indexOf('async function attestUntouchedCluster('),
      source.indexOf('async function attestEmptyDa5Database('),
    );
    const empty = source.slice(
      source.indexOf('async function attestEmptyDa5Database('),
      source.indexOf('async function assertPortAbsent('),
    );
    expect(untouched).toContain('pg_catalog.string_agg');
    expect(untouched).not.toContain('ARRAY(');
    expect(empty).toContain('pg_catalog.string_agg');
    expect(empty).not.toContain('ARRAY(');
    expect(empty).toContain("row.user_schemas !== ''");

    const owner = source.slice(
      source.indexOf('async function startDa5V5IsolatedPostgresOwner('),
      source.indexOf('export function disclosureSafeDa5V5PostgresLifecycleError('),
    );
    const failureCleanup = owner.slice(owner.lastIndexOf('} catch (error: unknown) {'));
    const cleanupReattestation = failureCleanup.indexOf('cleanupReattest ??');
    const stopFast = failureCleanup.indexOf(
      "failedGuard.sendAuthenticated('STOP_FAST')",
    );
    const heartbeatClose = failureCleanup.indexOf(
      'clearInterval(failedHeartbeat)',
    );
    const bootstrapClose = failureCleanup.indexOf(
      'closePool(failedBootstrapPool)',
    );
    const installerClose = failureCleanup.indexOf(
      'closePool(failedInstallerPool)',
    );
    const controlClose = failureCleanup.indexOf(
      'failedGuard.closeControlPipe()',
    );
    const secretClose = failureCleanup.indexOf(
      'failedGuard.closeSecretPipe()',
    );
    const reaped = failureCleanup.indexOf(
      "failedGuard.expect('POSTGRES_REAPED'",
    );
    const cleaned = failureCleanup.indexOf(
      "failedGuard.expect('CLEANUP_OK'",
    );
    const exited = failureCleanup.indexOf('failedGuard.waitForExit()');
    const eventClose = failureCleanup.indexOf(
      'failedGuard.closeEventPipe()',
    );
    const cleanupOrder = [
      cleanupReattestation,
      stopFast,
      heartbeatClose,
      bootstrapClose,
      installerClose,
      controlClose,
      secretClose,
      reaped,
      cleaned,
      exited,
      eventClose,
    ];
    expect(cleanupOrder.every((index) => index >= 0)).toBe(true);
    expect(cleanupOrder).toEqual(
      [...cleanupOrder].sort((left, right) => left - right),
    );
    expect(failureCleanup).toContain('for (const binding of lifecycleFiles)');
    expect(failureCleanup).toContain(
      'async () => chain.close()',
    );
    expect(failureCleanup).toContain(
      'async () => rmdir(failedStagingPath)',
    );
    expect(failureCleanup).toContain('retainedStartupCleanups.add(retained)');
    expect(failureCleanup).toContain('await retained.retry()');
    expect(failureCleanup).not.toContain('throw error');
    const probe = owner.indexOf('await runProbeGuard({');
    const persistent = owner.indexOf('guard = await RuntimeGuardClient.launch({');
    const revalidations = [...owner.matchAll(
      /await options\.revalidateGuardArtifact\?\.\(\);/gu,
    )].map(({ index }) => index);
    expect(revalidations).toHaveLength(6);
    expect(revalidations[0]).toBeLessThan(probe);
    expect(revalidations[1]).toBeGreaterThan(probe);
    expect(revalidations[1]).toBeLessThan(persistent);
    expect(revalidations.slice(2).every(
      (index) => index > persistent,
    )).toBe(true);

    const sentinel = `sentinel-${randomBytes(32).toString('hex')}`;
    const unsafe = Object.assign(new Error(`database failure ${sentinel}`), {
      client: { password: sentinel },
      pool: { connectionString: sentinel },
    });
    const safe = disclosureSafeDa5V5PostgresLifecycleError(
      unsafe,
      'untouched',
    );
    const rendered = [
      safe.name,
      safe.message,
      safe.stack ?? '',
      JSON.stringify(safe, Object.getOwnPropertyNames(safe)),
    ].join('\n');
    if (rendered.includes(sentinel)) {
      throw new Error('sentinel credential leaked into disclosure-safe error');
    }
    expect(Object.hasOwn(safe, 'cause')).toBe(false);
    expect(Object.hasOwn(safe, 'client')).toBe(false);
    expect(Object.hasOwn(safe, 'pool')).toBe(false);
    expect(safe.message).toMatch(
      /^DA5 V5 isolated PostgreSQL lifecycle failed \(untouched;runtime-error;none;none;[a-f0-9]{64}\)$/u,
    );
  });

  it('pins owned PostgreSQL 17 role grants and membership options', async () => {
    const source = await readFile(
      new URL('../src/Da5V5PostgresRuntimeGuard.ts', import.meta.url),
      'utf8',
    );
    const normalization = source.slice(
      source.indexOf('async function normalizeOwnedRuntimeLogin('),
      source.indexOf('async function attestDa5V5OwnerLifecycle('),
    );
    const attestation = source.slice(
      source.indexOf('async function attestDa5V5OwnerLifecycle('),
      source.indexOf('function runtimePostgresUrl('),
    );
    expect(normalization).toContain(
      'WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;',
    );
    expect(normalization).not.toMatch(
      /GRANT \$\{roles\.join\(', '\)\} TO \$\{login\};/u,
    );
    expect(attestation).toContain('`${parent}:false:false:true`');
    expect(attestation).not.toContain('`${parent}:false:true:true`');
  });

  it.each([
    'CC',
    'CFLAGS',
    'CPPFLAGS',
    'LDFLAGS',
    'CPATH',
    'C_INCLUDE_PATH',
    'CPLUS_INCLUDE_PATH',
    'OBJC_INCLUDE_PATH',
    'LIBRARY_PATH',
    'SDKROOT',
    'DEVELOPER_DIR',
    'DYLD_INSERT_LIBRARIES',
    'LD_PRELOAD',
    'PGPASSWORD',
    'PQGSSENC',
    'LC_ALL',
    'LANG',
    'LANGUAGE',
    'TAPTIME_SYNTHETIC_E2E_DATABASE_URL',
  ])('rejects inherited runtime variable %s', (name) => {
    expect(() => rejectOperationalEnvironment({ [name]: 'poisoned' }))
      .toThrow('inherited runtime/database environment is rejected');
  });

  it('allows only unrelated inherited variables at the owner boundary', () => {
    expect(() => rejectOperationalEnvironment({
      HOME: '/private/unused',
      PATH: '/usr/bin:/bin',
      TAPTIME_SYNTHETIC_E2E_PASSWORD: 'application-secret',
      TZ: 'UTC',
    })).not.toThrow();
  });

  it('fails before PostgreSQL spawn when the private socket exceeds 103 bytes', () => {
    const socketFile = '.s.PGSQL.55435';
    const directoryAtTotalLength = (length: number): string => (
      `/${'a'.repeat(length - socketFile.length - 2)}`
    );
    const accepted = directoryAtTotalLength(103);
    const rejected = directoryAtTotalLength(104);
    expect(Buffer.byteLength(join(accepted, socketFile))).toBe(103);
    expect(Buffer.byteLength(join(rejected, socketFile))).toBe(104);
    expect(() => assertDa5V5UnixSocketPathBound(accepted)).not.toThrow();
    expect(() => assertDa5V5UnixSocketPathBound(rejected)).toThrow(
      'private PostgreSQL socket path is too long',
    );
  });

  it('classifies startup failures without disclosing raw log content', async () => {
    const cases = [
      ['lock-file-path-too-long', 'FATAL: lock file is too long'],
      ['socket-path-too-long', 'FATAL: Unix-domain socket path is too long'],
      ['address-unavailable', 'FATAL: could not bind: Address already in use'],
      ['path-unavailable', 'FATAL: Not a directory'],
      ['permission-or-ownership', 'FATAL: data directory has invalid permissions'],
      ['configuration-rejected', 'FATAL: unrecognized configuration parameter'],
      ['data-directory-incompatible', 'FATAL: database files are incompatible'],
      ['resource-unavailable', 'FATAL: could not create shared memory segment'],
      ['loader-unavailable', 'dyld: Library not loaded: synthetic'],
      ['authentication-rejected', 'FATAL: password authentication failed'],
      ['fatal-or-panic', '2026-07-26 UTC FATAL: synthetic fallback'],
      ['unclassified', 'synthetic message without a classified marker'],
    ] as const;

    for (const [category, contents] of cases) {
      const path = join(suiteRoot, `classifier-${category}.log`);
      await writeFile(path, `${contents}\n`, { flag: 'wx', mode: 0o600 });
      const diagnostic =
        await classifyDa5V5PostgresStartupFailure(path);
      expect(diagnostic).toEqual({
        category,
        fingerprint: createHash('sha256')
          .update(`${contents}\n`)
          .digest('hex'),
      });
      expect(JSON.stringify(diagnostic)).not.toContain(contents);
      expect(diagnostic.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    }
  });

  it('normalizes the test-only startup line without identity leakage', async () => {
    const rawSecret = 'UltraSyntheticSecretValue';
    const rawIdentifier = 'deadbeefcafebabe0123456789abcdef';
    const path = join(suiteRoot, 'classifier-normalization.log');
    await writeFile(
      path,
      '2026-07-26 09:15:44 [12345] FATAL: could not open '
      + '"/private/tmp/SensitiveSegment/postgresql.conf" '
      + 'relative/path/file.dat PID=12345 UID=501 GID=20 port=55435 '
      + `identifier=${rawIdentifier} password=${rawSecret} token='RawToken'\n`,
      { flag: 'wx', mode: 0o600 },
    );

    const diagnostic =
      await classifyDa5V5PostgresStartupFailureForTest(path);

    expect(diagnostic.category).toBe('fatal-or-panic');
    expect(diagnostic.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(diagnostic.normalizedTemplate).not.toMatch(/[\\/'"`«»0-9]/u);
    expect(diagnostic.normalizedTemplate).not.toContain('private');
    expect(diagnostic.normalizedTemplate).not.toContain('SensitiveSegment');
    expect(diagnostic.normalizedTemplate).not.toContain('postgresql.conf');
    expect(diagnostic.normalizedTemplate).not.toContain('relative');
    expect(diagnostic.normalizedTemplate).not.toContain('file.dat');
    expect(diagnostic.normalizedTemplate).not.toContain(rawSecret);
    expect(diagnostic.normalizedTemplate).not.toContain(rawIdentifier);
    expect(diagnostic.normalizedTemplate).not.toContain('RawToken');
  });

  it.runIf(process.platform === 'darwin')(
    'preflights B1 import, environment mapping and setup inside one task-owned PostgreSQL 17.10 root',
    async () => {
      const runtimeBase = await mkdtemp('/private/tmp/t5-');
      const removedEnvironment = removeRejectedEnvironment();
      let owner: Awaited<
        ReturnType<typeof startDa5V5FullyAttestedTestPostgresOwner>
      > | null = null;
      let runtimePool: Pool | null = null;
      let primaryFailure: unknown;
      try {
        const b1 = await import('../../backend-b1-spike/src/index.js');
        owner = await startDa5V5FullyAttestedTestPostgresOwner({
          guardBinaryPath: binaryPath,
          pgConfigPath: '/opt/homebrew/opt/postgresql@17/bin/pg_config',
          temporaryBase: runtimeBase,
        });
        expect(owner.lifecycleRecord.guardProcessRecord).toMatchObject({
          sessionAuthority: 'guard-hello-getsid',
          sessionId: expect.stringMatching(/^[1-9][0-9]*$/u),
          sessionObservation: expect.stringMatching(/^(?:0|[1-9][0-9]*)$/u),
        });
        expect(owner.lifecycleRecord.postgresProcessRecord).toMatchObject({
          sessionAuthority: 'guard-hello-getsid',
          sessionId: owner.lifecycleRecord.guardProcessRecord?.sessionId,
        });
        expect(owner.lifecycleRecord.mountIdentityRecord).toMatchObject({
          canonicalSha256: owner.lifecycleRecord.mountIdentity,
          platform: 'darwin',
        });
        expect(createHash('sha256').update(
          owner.lifecycleRecord.mountIdentityRecord?.canonicalRecord ?? '',
        ).digest('hex')).toBe(owner.lifecycleRecord.mountIdentity);
        const syntheticRuntimePassword = randomBytes(32).toString('base64url');
        const installerUrl = new URL(
          'postgresql://127.0.0.1:55435/taptime_synthetic_android_e2e',
        );
        installerUrl.username = 'taptime_da5_v5_installer';
        installerUrl.password = 'preflight-not-used-for-connection';
        const runtimeUrl = new URL(installerUrl);
        runtimeUrl.username = b1.B1_RUNTIME_ROLE;
        runtimeUrl.password = syntheticRuntimePassword;
        const environment = {
          B1_DATABASE_URL: installerUrl.toString(),
          B1_RUNTIME_DATABASE_URL: runtimeUrl.toString(),
          B1_RUNTIME_PASSWORD: syntheticRuntimePassword,
        };
        expect(b1.installerConnectionTarget(environment)).toMatchObject({
          connectionString: installerUrl.toString(),
          mode: 'direct',
        });
        expect(b1.directRuntimeConnectionTarget(environment)).toMatchObject({
          connectionString: runtimeUrl.toString(),
          mode: 'direct',
        });
        expect(b1.runtimePassword(environment)).toBe(
          syntheticRuntimePassword,
        );
        await owner.withInstaller(async (installer) => {
          const client = await installer.connect();
          const listener = (): void => undefined;
          try {
            expect(Object.keys(client).sort()).toEqual([
              'off',
              'on',
              'query',
              'release',
              'toJSON',
              'toString',
            ]);
            expect(client.on('error', listener)).toBeUndefined();
            expect(client.off('error', listener)).toBeUndefined();
          } finally {
            client.release();
          }
          await b1.installB1Schema(
            installer as unknown as Pool,
            syntheticRuntimePassword,
          );
        });
        runtimePool = new Pool({
          connectionString: runtimeUrl.toString(),
          connectionTimeoutMillis: 5_000,
          max: 1,
          query_timeout: 5_000,
          statement_timeout: 5_000,
        });
        const identity = await runtimePool.query<{
          current_database: string;
          current_user: string;
          server_version_num: string;
        }>(`
          SELECT
            current_database(),
            current_user,
            current_setting('server_version_num') AS server_version_num
        `);
        expect(identity.rows).toEqual([{
          current_database: 'taptime_synthetic_android_e2e',
          current_user: b1.B1_RUNTIME_ROLE,
          server_version_num: '170010',
        }]);
      } catch (error: unknown) {
        primaryFailure = error;
      } finally {
        try {
          await runtimePool?.end();
        } catch (error: unknown) {
          primaryFailure ??= error;
        }
        try {
          await owner?.closeOwner();
        } catch (error: unknown) {
          primaryFailure ??= error;
        }
        restoreEnvironment(removedEnvironment);
        try {
          await expect(readdir(runtimeBase)).resolves.toEqual([]);
        } catch (error: unknown) {
          primaryFailure ??= error;
        }
        await rm(runtimeBase, { force: true, recursive: true });
      }
      if (primaryFailure !== undefined) {
        throw primaryFailure;
      }
    },
    60_000,
  );

  it.runIf(process.platform === 'darwin')(
    'retains live Guard/PostgreSQL ownership across a failed close reattestation and cleans only after a fresh retry',
    async () => {
      const runtimeBase = await mkdtemp('/private/tmp/t5-');
      const removedEnvironment = removeRejectedEnvironment();
      let artifactTrusted = true;
      let owner: Awaited<
        ReturnType<typeof startDa5V5FullyAttestedTestPostgresOwner>
      > | null = null;
      try {
        owner = await startDa5V5FullyAttestedTestPostgresOwner({
          guardBinaryPath: binaryPath,
          pgConfigPath: '/opt/homebrew/opt/postgresql@17/bin/pg_config',
          temporaryBase: runtimeBase,
          testOnlyRevalidateGuardArtifact: async () => {
            if (!artifactTrusted) {
              throw new Error('synthetic close reattestation mismatch');
            }
          },
        });
        const guardRecord = owner.lifecycleRecord.guardProcessRecord;
        const postgresRecord = owner.lifecycleRecord.postgresProcessRecord;
        if (guardRecord === null || postgresRecord === null) {
          throw new Error('DA5 V5 real process records are unavailable');
        }
        artifactTrusted = false;
        await expect(owner.closeOwner()).rejects.toThrow(
          /live ownership was retained/,
        );
        const retainedRootEntries = await readdir(runtimeBase);
        expect(retainedRootEntries).not.toEqual([]);
        await new Promise((resolve) => setTimeout(resolve, 5_500));
        await expect(revalidateDa5V5ProcessIdentityForTest({
          capture: {
            authoritativeSessionId: Number(guardRecord.sessionId),
            executableDigest: guardRecord.executableDigest,
            executablePath: guardRecord.executablePath,
            expectedParentPid: Number(guardRecord.parentPid),
            expectedProcessGroup: Number(guardRecord.pgid),
            pid: Number(guardRecord.pid),
          },
          expected: guardRecord,
        })).resolves.toBeUndefined();
        await expect(revalidateDa5V5ProcessIdentityForTest({
          capture: {
            authoritativeSessionId: Number(postgresRecord.sessionId),
            executableDigest: postgresRecord.executableDigest,
            executablePath: postgresRecord.executablePath,
            expectedParentPid: Number(postgresRecord.parentPid),
            expectedProcessGroup: Number(postgresRecord.pgid),
            pid: Number(postgresRecord.pid),
          },
          expected: postgresRecord,
        })).resolves.toBeUndefined();
        expect(await readdir(runtimeBase)).toEqual(retainedRootEntries);

        artifactTrusted = true;
        await expect(owner.closeOwner()).resolves.toBeUndefined();
        await expect(readdir(runtimeBase)).resolves.toEqual([]);
      } finally {
        artifactTrusted = true;
        await owner?.closeOwner().catch(() => undefined);
        restoreEnvironment(removedEnvironment);
        await rm(runtimeBase, { force: true, recursive: true });
      }
    },
    30_000,
  );

  it.runIf(process.platform === 'darwin')(
    'retains referenced startup ownership after cleanup reattestation fails without EOF or lease expiry',
    async () => {
      const runtimeBase = await mkdtemp('/private/tmp/t5-');
      const removedEnvironment = removeRejectedEnvironment();
      let artifactTrusted = true;
      try {
        await expect(startDa5V5FullyAttestedTestPostgresOwner({
          guardBinaryPath: binaryPath,
          pgConfigPath: '/opt/homebrew/opt/postgresql@17/bin/pg_config',
          temporaryBase: runtimeBase,
          testOnlyRevalidateGuardArtifact: async () => {
            if (!artifactTrusted) {
              throw new Error('synthetic startup cleanup mismatch');
            }
          },
          testOnlyStartupFailureAfterOwnership: () => {
            artifactTrusted = false;
            throw new Error('synthetic startup failure after ownership');
          },
        })).rejects.toThrow(/cleanup-incomplete/);
        expect(da5V5RetainedStartupCleanupCountForTest()).toBe(1);
        const [retained] = da5V5RetainedStartupProcessesForTest();
        if (
          retained?.guardPid === null
          || retained?.guardPid === undefined
          || retained.postgresPid === null
        ) {
          throw new Error('DA5 V5 retained process ownership is unavailable');
        }
        const guardDigest = createHash('sha256')
          .update(await readFile(binaryPath))
          .digest('hex');
        const postgresPath =
          '/opt/homebrew/Cellar/postgresql@17/17.10/bin/postgres';
        const postgresDigest = createHash('sha256')
          .update(await readFile(postgresPath))
          .digest('hex');
        const guardRecord = await captureDa5V5ProcessIdentityForTest({
          authoritativeSessionId: retained.guardPid,
          executableDigest: guardDigest,
          executablePath: binaryPath,
          expectedParentPid: process.pid,
          expectedProcessGroup: retained.guardPid,
          pid: retained.guardPid,
        });
        const postgresRecord = await captureDa5V5ProcessIdentityForTest({
          authoritativeSessionId: retained.guardPid,
          executableDigest: postgresDigest,
          executablePath: postgresPath,
          expectedParentPid: retained.guardPid,
          expectedProcessGroup: retained.guardPid,
          pid: retained.postgresPid,
        });
        const retainedRootEntries = await readdir(runtimeBase);
        expect(retainedRootEntries).not.toEqual([]);
        await new Promise((resolve) => setTimeout(resolve, 5_500));
        await expect(revalidateDa5V5ProcessIdentityForTest({
          capture: {
            authoritativeSessionId: retained.guardPid,
            executableDigest: guardDigest,
            executablePath: binaryPath,
            expectedParentPid: process.pid,
            expectedProcessGroup: retained.guardPid,
            pid: retained.guardPid,
          },
          expected: guardRecord,
        })).resolves.toBeUndefined();
        await expect(revalidateDa5V5ProcessIdentityForTest({
          capture: {
            authoritativeSessionId: retained.guardPid,
            executableDigest: postgresDigest,
            executablePath: postgresPath,
            expectedParentPid: retained.guardPid,
            expectedProcessGroup: retained.guardPid,
            pid: retained.postgresPid,
          },
          expected: postgresRecord,
        })).resolves.toBeUndefined();
        expect(await readdir(runtimeBase)).toEqual(retainedRootEntries);

        artifactTrusted = true;
        await expect(retryDa5V5RetainedStartupCleanupsForTest())
          .resolves.toBeUndefined();
        expect(da5V5RetainedStartupCleanupCountForTest()).toBe(0);
        await expect(readdir(runtimeBase)).resolves.toEqual([]);
      } finally {
        artifactTrusted = true;
        await retryDa5V5RetainedStartupCleanupsForTest().catch(() => undefined);
        restoreEnvironment(removedEnvironment);
        await rm(runtimeBase, { force: true, recursive: true });
      }
    },
    30_000,
  );

  it.runIf(process.platform === 'darwin')(
    'blocks startup cleanup after an early directory mismatch until exact incremental reattestation succeeds',
    async () => {
      const runtimeBase = await mkdtemp('/private/tmp/t5-');
      const removedEnvironment = removeRejectedEnvironment();
      let directoryPath = '';
      let displacedDirectoryPath = '';
      let directoryDisplaced = false;
      let postgresLogPath = '';
      const restoreDirectoryPath = async (): Promise<void> => {
        if (!directoryDisplaced) {
          return;
        }
        const replacementEntries = await readdir(directoryPath);
        for (const entry of replacementEntries) {
          if (
            entry !== '.s.PGSQL.55435'
            && entry !== '.s.PGSQL.55435.lock'
          ) {
            throw new Error(
              'DA5 V5 replacement socket directory was not isolated',
            );
          }
          await rm(join(directoryPath, entry), { force: true });
        }
        await rmdir(directoryPath);
        await rename(displacedDirectoryPath, directoryPath);
        directoryDisplaced = false;
      };
      try {
        await expect(startDa5V5FullyAttestedTestPostgresOwner({
          guardBinaryPath: binaryPath,
          pgConfigPath: '/opt/homebrew/opt/postgresql@17/bin/pg_config',
          temporaryBase: runtimeBase,
          testOnlyStartupFailureAfterDirectoryBindings: async (context) => {
            directoryPath = context.directoryPath;
            postgresLogPath = context.logPath;
            displacedDirectoryPath = `${directoryPath}.displaced-test`;
            await rename(directoryPath, displacedDirectoryPath);
            directoryDisplaced = true;
            await mkdir(directoryPath, { mode: 0o700 });
            throw new Error('synthetic failure during early startup');
          },
        })).rejects.toThrow(/cleanup-incomplete/);
        expect(da5V5RetainedStartupCleanupCountForTest()).toBe(1);
        const [retained] = da5V5RetainedStartupProcessesForTest();
        if (
          retained?.guardPid === null
          || retained?.guardPid === undefined
          || retained.postgresPid === null
        ) {
          throw new Error('DA5 V5 retained process ownership is unavailable');
        }
        expect(() => process.kill(retained.guardPid as number, 0))
          .not.toThrow();
        expect(() => process.kill(retained.postgresPid as number, 0))
          .not.toThrow();
        const retainedRootEntries = await readdir(runtimeBase);
        expect(retainedRootEntries).not.toEqual([]);

        await expect(startDa5V5FullyAttestedTestPostgresOwner({
          guardBinaryPath: binaryPath,
          pgConfigPath: '/opt/homebrew/opt/postgresql@17/bin/pg_config',
          temporaryBase: runtimeBase,
        })).rejects.toThrow(/startup cleanup authority was revoked/);
        expect(da5V5RetainedStartupCleanupCountForTest()).toBe(1);
        expect(da5V5RetainedStartupProcessesForTest()).toEqual([retained]);

        await new Promise((resolve) => setTimeout(resolve, 5_500));
        expect(() => process.kill(retained.guardPid as number, 0))
          .not.toThrow();
        expect(() => process.kill(retained.postgresPid as number, 0))
          .not.toThrow();
        expect(da5V5RetainedStartupProcessesForTest()).toEqual([retained]);
        expect(await readdir(runtimeBase)).toEqual(retainedRootEntries);
        expect(await readFile(postgresLogPath, 'utf8')).not.toMatch(
          /received fast shutdown request|database system is shut down/u,
        );

        if (!directoryDisplaced || directoryPath === '') {
          throw new Error('DA5 V5 lifecycle mismatch fixture is unavailable');
        }
        await restoreDirectoryPath();
        await expect(retryDa5V5RetainedStartupCleanupsForTest())
          .resolves.toBeUndefined();
        expect(da5V5RetainedStartupCleanupCountForTest()).toBe(0);
        await expect(readdir(runtimeBase)).resolves.toEqual([]);
      } finally {
        await restoreDirectoryPath().catch(() => undefined);
        await retryDa5V5RetainedStartupCleanupsForTest().catch(() => undefined);
        restoreEnvironment(removedEnvironment);
        await rm(runtimeBase, { force: true, recursive: true });
      }
    },
    30_000,
  );

  it.runIf(process.platform === 'darwin')(
    'starts, attests and exactly removes one real PostgreSQL 17.10 lifecycle',
    async () => {
      const runtimeBase = await mkdtemp('/private/tmp/t5-');
      const removedEnvironment = removeRejectedEnvironment();
      let capability: Da5V5PostgresCapability | null = null;
      try {
        capability = await createDa5V5TestPostgresCapability({
          guardBinaryPath: binaryPath,
          pgConfigPath: '/opt/homebrew/opt/postgresql@17/bin/pg_config',
          temporaryBase: runtimeBase,
        });
        expect(da5V5PostgresCapabilityState(capability)).toEqual({
          claimed: false,
          cleanupIncomplete: false,
          closed: false,
          source: 'isolated-runtime-guard',
        });
        await closeDa5V5PostgresCapability(capability);
        expect(da5V5PostgresCapabilityState(capability).closed).toBe(true);
        await expect(readdir(runtimeBase)).resolves.toEqual([]);
      } finally {
        restoreEnvironment(removedEnvironment);
        if (
          capability !== null
          && !da5V5PostgresCapabilityState(capability).closed
        ) {
          await closeDa5V5PostgresCapability(capability).catch(() => undefined);
        }
        await rm(runtimeBase, { force: true, recursive: true });
      }
    },
    60_000,
  );
});

interface RawFixtureStreamObserver {
  markExpectedTermination(): void;
  settleAfterExpectedTermination(): Promise<void>;
}

function observeRawFixtureStreams(
  observations: readonly Readonly<{
    readonly direction: 'readable' | 'writable';
    readonly stream: Readable | Writable;
  }>[],
): RawFixtureStreamObserver {
  let expectedTerminationMarked = false;
  const errors: Array<Readonly<{
    readonly afterExpectedTermination: boolean;
    readonly error: Error;
  }>> = [];
  const observed = new Set<unknown>();
  const recordError = (error: unknown): void => {
    if (observed.has(error)) {
      return;
    }
    observed.add(error);
    errors.push(Object.freeze({
      afterExpectedTermination: expectedTerminationMarked,
      error: error instanceof Error
        ? error
        : new Error('unknown raw fixture stream failure'),
    }));
  };
  const settlements = observations.map(async ({ direction, stream }) => {
    const onError = (error: Error): void => {
      recordError(error);
    };
    stream.on('error', onError);
    const closed = new Promise<void>((resolve) => {
      const onClose = (): void => {
        stream.off('close', onClose);
        resolve();
      };
      stream.on('close', onClose);
      if (stream.closed) {
        onClose();
      }
    });
    try {
      try {
        await finished(stream, {
          cleanup: true,
          readable: direction === 'readable',
          writable: direction === 'writable',
        });
      } catch (error: unknown) {
        recordError(error);
      }
      await closed;
    } finally {
      stream.off('error', onError);
    }
  });
  return Object.freeze({
    markExpectedTermination(): void {
      expectedTerminationMarked = true;
    },
    async settleAfterExpectedTermination(): Promise<void> {
      await Promise.all(settlements);
      const unexpected = errors.find((observation) => {
        const code = (observation.error as NodeJS.ErrnoException).code;
        return !observation.afterExpectedTermination
          || (code !== 'ECONNRESET' && code !== 'EPIPE');
      });
      if (unexpected !== undefined) {
        throw new Error('unexpected raw fixture stream failure', {
          cause: unexpected.error,
        });
      }
    },
  });
}

async function spawnProbeGuard(): Promise<Readonly<{
  readonly child: ChildProcess;
  readonly cleanup: () => Promise<void>;
  readonly control: NodeJS.WritableStream;
  readonly events: NodeJS.ReadableStream;
  readonly rootName: string;
  readonly stagingPath: string;
}>> {
  const stagingPath = await mkdtemp(join(suiteRoot, 'probe-'));
  const rootName = `root-${randomBytes(8).toString('hex')}`;
  const rootPath = join(stagingPath, rootName);
  await mkdir(rootPath, { mode: 0o700 });
  const rootHandle = await open(rootPath, constants.O_RDONLY);
  const stagingHandle = await open(stagingPath, constants.O_RDONLY);
  const child = spawn(binaryPath, [], {
    cwd: '/',
    detached: true,
    env: {},
    shell: false,
    stdio: [
      'ignore',
      'ignore',
      'ignore',
      'pipe',
      'pipe',
      'pipe',
      rootHandle.fd,
      stagingHandle.fd,
    ],
  });
  const stdio = child.stdio as unknown as readonly (
    | Readable
    | Writable
    | null
    | undefined
  )[];
  const control = stdio[3] as Writable | null | undefined;
  const events = stdio[4] as Readable | null | undefined;
  const secret = stdio[5] as Writable | null | undefined;
  if (control === null || control === undefined
      || events === null || events === undefined
      || secret === null || secret === undefined) {
    throw new Error('Runtime Guard private pipes are unavailable');
  }
  const streamObserver = observeRawFixtureStreams([
    { direction: 'writable', stream: control },
    { direction: 'readable', stream: events },
    { direction: 'writable', stream: secret },
  ]);
  let cleaned = false;
  return Object.freeze({
    child,
    control,
    events,
    rootName,
    stagingPath,
    async cleanup(): Promise<void> {
      if (cleaned) {
        return;
      }
      cleaned = true;
      control.end();
      secret.end();
      await Promise.all([
        rootHandle.close(),
        stagingHandle.close(),
      ]);
      if (child.exitCode === null && child.signalCode === null) {
        throw new Error('Runtime Guard test left a live process');
      }
      streamObserver.markExpectedTermination();
      let streamFailure: unknown;
      try {
        await streamObserver.settleAfterExpectedTermination();
      } catch (error: unknown) {
        streamFailure = error;
      }
      await rm(stagingPath, { force: true, recursive: true });
      if (streamFailure !== undefined) {
        throw streamFailure;
      }
    },
  });
}

async function spawnEarlyExitGuard(options?: Readonly<{
  readonly parentEnvironment?: NodeJS.ProcessEnv;
  readonly postgresBinary?: string;
}>): Promise<Readonly<{
  readonly capability: string;
  readonly child: ChildProcess;
  readonly cleanup: () => Promise<void>;
  readonly control: NodeJS.WritableStream;
  readonly events: NodeJS.ReadableStream;
  readonly logPath: string;
  readonly manifest: (nonce: string) => string;
  readonly rootPath: string;
  readonly secret: NodeJS.WritableStream;
  readonly stagingPath: string;
  readonly tombstonePath: string;
}>> {
  const stagingPath = await mkdtemp(join(suiteRoot, 'early-exit-'));
  const rootName = `root-${randomBytes(8).toString('hex')}`;
  const tombstoneName = `removed-${randomBytes(8).toString('hex')}`;
  const rootPath = join(stagingPath, rootName);
  const socketPath = join(rootPath, 'socket');
  const logPath = join(rootPath, 'postgres.log');
  const dataPath = join(rootPath, 'data');
  const fakeInitdbPath = join(rootPath, 'fake-initdb');
  await mkdir(rootPath, { mode: 0o700 });
  await mkdir(socketPath, { mode: 0o700 });
  await writeFile(
    fakeInitdbPath,
    [
      '#!/bin/sh',
      'if [ "$1" != "-D" ] || [ -z "$2" ]; then',
      '  exit 64',
      'fi',
      '/bin/mkdir "$2" || exit 65',
      '/usr/bin/touch "$2/postgresql.conf" || exit 66',
      '/usr/bin/touch "$2/pg_hba.conf" || exit 67',
      '/usr/bin/touch "$2/postgresql.auto.conf" || exit 68',
      'exit 0',
      '',
    ].join('\n'),
    { flag: 'wx', mode: 0o500 },
  );
  const rootHandle = await open(rootPath, constants.O_RDONLY);
  const stagingHandle = await open(stagingPath, constants.O_RDONLY);
  const pgConfigHandle = await open('/usr/bin/true', constants.O_RDONLY);
  const initdbHandle = await open(fakeInitdbPath, constants.O_RDONLY);
  const postgresHandle = await open(
    options?.postgresBinary ?? '/usr/bin/true',
    constants.O_RDONLY,
  );
  const child = spawn(binaryPath, [], {
    cwd: '/',
    detached: true,
    env: options?.parentEnvironment ?? {},
    shell: false,
    stdio: [
      'ignore',
      'ignore',
      'ignore',
      'pipe',
      'pipe',
      'pipe',
      rootHandle.fd,
      stagingHandle.fd,
      stagingHandle.fd,
      pgConfigHandle.fd,
      initdbHandle.fd,
      postgresHandle.fd,
    ],
  });
  const stdio = child.stdio as unknown as readonly (
    | Readable
    | Writable
    | null
    | undefined
  )[];
  const control = stdio[3] as Writable | null | undefined;
  const events = stdio[4] as Readable | null | undefined;
  const secret = stdio[5] as Writable | null | undefined;
  if (
    control === null || control === undefined
    || events === null || events === undefined
    || secret === null || secret === undefined
  ) {
    throw new Error('Runtime Guard private pipes are unavailable');
  }
  const streamObserver = observeRawFixtureStreams([
    { direction: 'writable', stream: control },
    { direction: 'readable', stream: events },
    { direction: 'writable', stream: secret },
  ]);
  const capability = randomBytes(32).toString('hex');
  let cleaned = false;
  return Object.freeze({
    capability,
    child,
    control,
    events,
    logPath,
    secret,
    stagingPath,
    tombstonePath: join(stagingPath, tombstoneName),
    manifest(nonce: string): string {
      return startManifestFrame({
        artifactDigest: 'a'.repeat(64),
        capability,
        chainDigest: 'b'.repeat(64),
        dataPath,
        hba: [
          'local all all reject',
          'host all all 127.0.0.1/32 scram-sha-256',
          'host all all ::1/128 reject',
          '',
        ].join('\n'),
        initdbPath: fakeInitdbPath,
        logPath,
        mode: 'START',
        nonce,
        postgresPath: options?.postgresBinary ?? '/usr/bin/true',
        rootName,
        socketPath,
        tombstoneName,
        configuration: [
          "listen_addresses = '127.0.0.1'",
          'port = 55435',
          `unix_socket_directories = '${socketPath}'`,
          "password_encryption = 'scram-sha-256'",
          'ssl = off',
          'max_connections = 20',
          'shared_buffers = 32MB',
          'fsync = on',
          'synchronous_commit = on',
          'full_page_writes = on',
          '',
        ].join('\n'),
      });
    },
    rootPath,
    async cleanup(): Promise<void> {
      if (cleaned) {
        return;
      }
      cleaned = true;
      control.end();
      secret.end();
      await Promise.all([
        rootHandle.close(),
        stagingHandle.close(),
        pgConfigHandle.close(),
        initdbHandle.close(),
        postgresHandle.close(),
      ]);
      if (child.exitCode === null && child.signalCode === null) {
        throw new Error('Runtime Guard test left a live process');
      }
      streamObserver.markExpectedTermination();
      let streamFailure: unknown;
      try {
        await streamObserver.settleAfterExpectedTermination();
      } catch (error: unknown) {
        streamFailure = error;
      }
      await rm(stagingPath, { force: true, recursive: true });
      if (streamFailure !== undefined) {
        throw streamFailure;
      }
    },
  });
}

async function advanceEarlyExitGuard(
  fixture: Awaited<ReturnType<typeof spawnEarlyExitGuard>>,
): Promise<void> {
  const hello = await readFrame(fixture.events);
  const nonce = hello.split('|')[5] as string;
  fixture.secret.end(Buffer.from('synthetic-test-secret'));
  writeFrame(fixture.control, fixture.manifest(nonce));
  await expect(readFrame(fixture.events)).resolves.toBe('ACK');
  await expect(readFrame(fixture.events)).resolves.toMatch(
    /^MOUNT_BINDING\|[a-f0-9]{64}\|(?:[a-f0-9]{2})+$/u,
  );
  await expect(readFrame(fixture.events)).resolves.toBe('INITDB_OK');
  writeFrame(fixture.control, `CONFIG_READY|${fixture.capability}`);
  await expect(readFrame(fixture.events)).resolves.toMatch(
    /^POSTGRES_SPAWNED\|[1-9][0-9]*$/u,
  );
  const heartbeat = setInterval(() => {
    writeFrame(fixture.control, `HEARTBEAT|${fixture.capability}`);
  }, 25);
  heartbeat.unref();
  try {
    await expect(readFrame(fixture.events)).resolves.toBe(
      'POSTGRES_EXITED_EARLY',
    );
  } finally {
    clearInterval(heartbeat);
  }
}

function manifestFrame(
  nonce: string,
  rootName = 'root-unused',
): string {
  const capability = randomBytes(32).toString('hex');
  return startManifestFrame({
    artifactDigest: 'a'.repeat(64),
    capability,
    chainDigest: 'b'.repeat(64),
    configuration: 'probe-configuration',
    dataPath: '/private/unused/data',
    hba: 'probe-hba',
    initdbPath: '/private/unused/initdb',
    logPath: '/private/unused/log',
    mode: 'PROBE_ONLY',
    nonce,
    postgresPath: '/private/unused/postgres',
    rootName,
    socketPath: '/private/unused/socket',
    tombstoneName: 'tombstone-unused',
  });
}

function startManifestFrame(options: Readonly<{
  readonly artifactDigest: string;
  readonly capability: string;
  readonly chainDigest: string;
  readonly configuration: string;
  readonly dataPath: string;
  readonly hba: string;
  readonly initdbPath: string;
  readonly logPath: string;
  readonly mode: 'PROBE_ONLY' | 'START';
  readonly nonce: string;
  readonly postgresPath: string;
  readonly rootName: string;
  readonly socketPath: string;
  readonly tombstoneName: string;
}>): string {
  const lifecycleGeneration = 'c'.repeat(32);
  const configurationDigest = createHash('sha256')
    .update(`${options.configuration}\0${options.hba}\0\0`)
    .digest('hex');
  const boundFields = [
    lifecycleGeneration,
    options.artifactDigest,
    options.chainDigest,
    configurationDigest,
    options.mode,
    hex(options.rootName),
    hex(options.tombstoneName),
    hex(options.initdbPath),
    hex(options.postgresPath),
    hex(options.dataPath),
    hex(options.socketPath),
    hex(options.logPath),
    hex(options.configuration),
    hex(options.hba),
  ];
  const manifestDigest = createHash('sha256')
    .update(`${boundFields.join('\0')}\0`)
    .digest('hex');
  return [
    'START_MANIFEST',
    options.nonce,
    options.capability,
    lifecycleGeneration,
    manifestDigest,
    ...boundFields.slice(1),
  ].join('|');
}

function writeFrame(stream: NodeJS.WritableStream, payload: string): void {
  const bytes = Buffer.from(payload);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(bytes.byteLength);
  stream.write(Buffer.concat([header, bytes]));
}

const frameBuffers = new WeakMap<object, Buffer>();

async function readFrame(stream: NodeJS.ReadableStream): Promise<string> {
  const readable = stream as NodeJS.ReadableStream & {
    readonly readableEnded?: boolean;
    read(): Buffer | null;
  };
  let buffered = frameBuffers.get(stream as object) ?? Buffer.alloc(0);
  for (;;) {
    if (buffered.byteLength >= 4) {
      const length = buffered.readUInt32BE();
      if (buffered.byteLength >= length + 4) {
        const payload = buffered.subarray(4, length + 4).toString('utf8');
        frameBuffers.set(stream as object, buffered.subarray(length + 4));
        return payload;
      }
    }
    const chunk = readable.read();
    if (chunk !== null) {
      buffered = Buffer.concat([buffered, Buffer.from(chunk)]);
      continue;
    }
    if (readable.readableEnded === true) {
      throw new Error('Runtime Guard event pipe closed before a complete frame');
    }
    await new Promise<void>((resolveReadable, rejectReadable) => {
      const cleanup = (): void => {
        readable.off('readable', handleReadable);
        readable.off('end', handleEnd);
        readable.off('error', handleError);
      };
      const handleReadable = (): void => {
        cleanup();
        resolveReadable();
      };
      const handleEnd = (): void => {
        cleanup();
        rejectReadable(
          new Error('Runtime Guard event pipe closed before a complete frame'),
        );
      };
      const handleError = (error: Error): void => {
        cleanup();
        rejectReadable(error);
      };
      readable.once('readable', handleReadable);
      readable.once('end', handleEnd);
      readable.once('error', handleError);
    });
  }
}

async function readdirNames(path: string): Promise<readonly string[]> {
  const { readdir } = await import('node:fs/promises');
  return (await readdir(path)).sort();
}

function hex(value: string): string {
  return Buffer.from(value).toString('hex');
}

function removeRejectedEnvironment(): Readonly<Record<string, string>> {
  const removed: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) {
      continue;
    }
    try {
      rejectOperationalEnvironment({ [name]: value });
    } catch {
      removed[name] = value;
      delete process.env[name];
    }
  }
  return Object.freeze(removed);
}

function restoreEnvironment(environment: Readonly<Record<string, string>>): void {
  for (const [name, value] of Object.entries(environment)) {
    process.env[name] = value;
  }
}
