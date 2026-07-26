import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const databaseUrl =
  'postgresql://postgres:synthetic-password-that-is-long@127.0.0.1:5432/taptime_synthetic_android_e2e';
const poolEnd = vi.fn(async () => undefined);
const poolQuery = vi.fn(async (statement: string) => {
  if (statement.includes('migration_tables')) {
    return { rows: [{ migration_tables: '0', user_schemas: '0' }] };
  }
  return {
    rows: [{
      address: '127.0.0.1',
      database: 'taptime_synthetic_android_e2e',
      port: 5_432,
      role: 'postgres',
      server_version_num: '170010',
      system_identifier: '7561094784090731591',
    }],
  };
});

vi.mock('pg', () => ({
  Pool: class {
    end = poolEnd;
    query = poolQuery;
  },
}));

import {
  ownerRecordDigest,
  parseDa5V5LinuxProcessStartTicks,
  validateDa5V5CiOwnerRecord,
  type Da5V5CiOwnerRecord,
  type Da5V5DockerReadRunner,
} from '../src/Da5V5CiPostgresAdapter.js';
import {
  closeDa5V5PostgresCapability,
  createDa5V5CiPostgresCapability,
  da5V5PostgresCapabilityState,
} from '../src/Da5V5PostgresCapability.js';

const record = Object.freeze({
  containerId: 'a'.repeat(64),
  hostInitPid: 4_321,
  hostProcessStartTicks: '4194560',
  imageId: `sha256:${'b'.repeat(64)}`,
  imageRepositoryDigest: `postgres@sha256:${'c'.repeat(64)}`,
  innerSystemIdentifier: '7561094784090731591',
  labels: Object.freeze({
    'com.taptime.repository': 'taptime',
    'com.taptime.run-id': '30188196782',
    'com.taptime.run-attempt': '1',
    'com.taptime.job': 'synthetic-android-e2e',
    'com.taptime.nonce': 'd'.repeat(64),
  }),
  startedAt: '2026-07-26T08:00:00.000000000Z',
}) satisfies Da5V5CiOwnerRecord;

const temporaryRoots: string[] = [];

afterEach(async () => {
  poolEnd.mockClear();
  poolQuery.mockClear();
  await Promise.all(temporaryRoots.splice(0).map(async (root) => {
    await rm(root, { force: true, recursive: true });
  }));
});

describe('DA5 V5 exact CI PostgreSQL owner adapter', () => {
  it('validates an exact secret-free record and binds its complete safe digest', () => {
    expect(validateDa5V5CiOwnerRecord(record)).toEqual(record);
    expect(ownerRecordDigest(record)).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(record)).not.toContain('postgresql://');
    expect(() => validateDa5V5CiOwnerRecord({
      ...record,
      databaseUrl,
    })).toThrow(/record binding is invalid|record is invalid/u);
    expect(() => validateDa5V5CiOwnerRecord({
      ...record,
      hostProcessStart: linuxProcessStat(),
    })).toThrow(/record binding is invalid/u);
  });

  it('parses only immutable field 22 despite spaces and parentheses in comm', () => {
    expect(parseDa5V5LinuxProcessStartTicks(
      linuxProcessStat('4194560', 'postgres worker (tenant 1)'),
      record.hostInitPid,
    )).toBe('4194560');
    expect(parseDa5V5LinuxProcessStartTicks(
      linuxProcessStat('4194560', 'postgres worker', {
        flags: '999999',
        residentPages: '4242',
        userTicks: '12345',
      }),
      record.hostInitPid,
    )).toBe('4194560');
  });

  it.each([
    ['wrong pid', linuxProcessStat('4194560'), record.hostInitPid + 1],
    ['empty comm', linuxProcessStat('4194560', ''), record.hostInitPid],
    ['missing fields', `${record.hostInitPid} (postgres) S 1 2`, record.hostInitPid],
    ['zero start ticks', linuxProcessStat('0'), record.hostInitPid],
    ['embedded newline', `${linuxProcessStat()}\ntrailing`, record.hostInitPid],
  ])('fails closed for malformed Linux process stat: %s', (
    _label,
    processStat,
    expectedPid,
  ) => {
    expect(() => parseDa5V5LinuxProcessStartTicks(
      processStat,
      expectedPid,
    )).toThrow(/process stat is invalid/u);
  });

  it('locks workflow owner extraction and cleanup quoting to the exact schema', async () => {
    const workflow = await readFile(new URL(
      '../../../.github/workflows/ci.yml',
      import.meta.url,
    ), 'utf8');
    expect(workflow).not.toContain('hostProcessStart:');
    expect(workflow).not.toContain('hostProcessStart"');
    expect(workflow).not.toContain('.Config.Labels[\\"');
    expect(workflow).toContain('hostProcessStartTicks: $hostProcessStartTicks');
    expect(workflow).toContain('stat_tail="${stat_record##*) }"');
    expect(workflow).toContain('stat_fields[19]');
    expect(workflow).toContain('.Config.Labels["com.taptime.repository"]');
  });

  it('pins PostgreSQL 17 role grants and membership attestation options', async () => {
    const source = await readFile(new URL(
      '../src/Da5V5CiPostgresAdapter.ts',
      import.meta.url,
    ), 'utf8');
    const normalization = source.slice(
      source.indexOf('async function normalizeCiRuntimeLogin('),
      source.indexOf('async function attestCiDatabase('),
    );
    const attestation = source.slice(
      source.indexOf('async function attestCiDatabase('),
      source.indexOf('function quoteCiLiteral('),
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
    ['CID', { containerId: 'short' }],
    ['image', { imageId: `sha256:${'z'.repeat(64)}` }],
    ['digest', { imageRepositoryDigest: 'postgres:17.10-alpine' }],
    ['pid', { hostInitPid: 1 }],
    ['system identifier', { innerSystemIdentifier: '0' }],
    ['labels', { labels: { ...record.labels, 'com.taptime.nonce': '' } }],
  ])('rejects a wrong %s binding', (_label, delta) => {
    expect(() => validateDa5V5CiOwnerRecord({
      ...record,
      ...delta,
    })).toThrow();
  });

  it.each([
    ['URL host',
      'postgresql://postgres:synthetic-password-that-is-long@localhost:5432/taptime_synthetic_android_e2e'],
    ['URL port',
      'postgresql://postgres:synthetic-password-that-is-long@127.0.0.1:55435/taptime_synthetic_android_e2e'],
    ['URL role',
      'postgresql://installer:synthetic-password-that-is-long@127.0.0.1:5432/taptime_synthetic_android_e2e'],
    ['URL database',
      'postgresql://postgres:synthetic-password-that-is-long@127.0.0.1:5432/postgres'],
  ])('rejects a wrong separately supplied %s', async (_label, invalidUrl) => {
    const ownerRecordPath = await writeOwnerRecord();
    await expect(createDa5V5CiPostgresCapability({
      databaseUrl: invalidUrl,
      ownerRecordPath,
      runner: exactRunner(),
    })).rejects.toThrow(/URL binding is invalid/);
  });

  it('re-attests exact CID, image bindings, labels, process start and database identity', async () => {
    const ownerRecordPath = await writeOwnerRecord();
    const runner = exactRunner();

    const capability = await createDa5V5CiPostgresCapability({
      databaseUrl,
      ownerRecordPath,
      runner,
    });
    expect(da5V5PostgresCapabilityState(capability)).toEqual({
      claimed: false,
      cleanupIncomplete: false,
      closed: false,
      source: 'ci-test-adapter',
    });
    expect(runner.run).toHaveBeenCalledTimes(4);
    expect(runner.readHostProcessStat).toHaveBeenCalledTimes(2);

    await closeDa5V5PostgresCapability(capability);
    expect(poolQuery).toHaveBeenCalledWith(expect.stringContaining(
      'migration_tables',
    ));
    expect(runner.run).toHaveBeenCalledTimes(6);
    expect(runner.readHostProcessStat).toHaveBeenCalledTimes(3);
    expect(poolEnd).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['container id', { Id: 'e'.repeat(64) }],
    ['image id', { Image: `sha256:${'e'.repeat(64)}` }],
    ['repository digest', {
      Config: { Image: `postgres@sha256:${'e'.repeat(64)}`, Labels: record.labels },
    }],
    ['startedAt', {
      State: { Pid: record.hostInitPid, Running: true, StartedAt: 'wrong' },
    }],
    ['host pid', {
      State: { Pid: 7_777, Running: true, StartedAt: record.startedAt },
    }],
    ['running state', {
      State: { Pid: record.hostInitPid, Running: false, StartedAt: record.startedAt },
    }],
    ['owner label', {
      Config: {
        Image: record.imageRepositoryDigest,
        Labels: { ...record.labels, 'com.taptime.nonce': 'wrong' },
      },
    }],
  ])('fails closed for a wrong %s re-attestation', async (_label, delta) => {
    const ownerRecordPath = await writeOwnerRecord();
    await expect(createDa5V5CiPostgresCapability({
      databaseUrl,
      ownerRecordPath,
      runner: exactRunner(delta),
    })).rejects.toThrow(/identity mismatch/);
  });

  it('fails closed for process-start and inner/outer database drift', async () => {
    const ownerRecordPath = await writeOwnerRecord();
    await expect(createDa5V5CiPostgresCapability({
      databaseUrl,
      ownerRecordPath,
      runner: exactRunner({}, linuxProcessStat('4194561')),
    })).rejects.toThrow(/process-start identity mismatch/);

    poolQuery.mockResolvedValueOnce({
      rows: [{
        address: '127.0.0.1',
        database: 'taptime_synthetic_android_e2e',
        port: 5_432,
        role: 'postgres',
        server_version_num: '170010',
        system_identifier: '7561094784090731592',
      }],
    });
    await expect(createDa5V5CiPostgresCapability({
      databaseUrl,
      ownerRecordPath,
      runner: exactRunner(),
    })).rejects.toThrow(/inner\/outer PostgreSQL attestation mismatch/);
  });
});

async function writeOwnerRecord(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'taptime-da5-ci-owner-')));
  temporaryRoots.push(root);
  const ownerRecordPath = join(root, 'owner.json');
  await writeFile(ownerRecordPath, JSON.stringify(record), { mode: 0o600 });
  return ownerRecordPath;
}

function exactRunner(
  delta: Record<string, unknown> = {},
  processStat: string = linuxProcessStat(),
): Da5V5DockerReadRunner & {
  readonly readHostProcessStat: ReturnType<typeof vi.fn>;
  readonly run: ReturnType<typeof vi.fn>;
} {
  const inspection = {
    Config: {
      Image: record.imageRepositoryDigest,
      Labels: record.labels,
    },
    Id: record.containerId,
    Image: record.imageId,
    State: {
      Pid: record.hostInitPid,
      Running: true,
      StartedAt: record.startedAt,
    },
    ...delta,
  };
  const run = vi.fn((args: readonly string[]) => {
    const isContainerInspect = args[0] === 'inspect';
    return Object.freeze({
      status: 0,
      stderr: '',
      stdout: isContainerInspect
        ? JSON.stringify(inspection)
        : JSON.stringify({
            Id: record.imageId,
            RepoDigests: [record.imageRepositoryDigest],
          }),
    });
  });
  const readHostProcessStat = vi.fn(() => Object.freeze({
    status: 0,
    stderr: '',
    stdout: `${processStat}\n`,
  }));
  return { readHostProcessStat, run };
}

function linuxProcessStat(
  startTicks: string = record.hostProcessStartTicks,
  comm: string = 'postgres',
  mutable: Readonly<{
    readonly flags?: string;
    readonly residentPages?: string;
    readonly userTicks?: string;
  }> = {},
): string {
  const fields = [
    'S',
    '1',
    '1',
    '1',
    '0',
    '-1',
    mutable.flags ?? '4194560',
    '10',
    '0',
    '1',
    '0',
    mutable.userTicks ?? '20',
    '10',
    '0',
    '0',
    '20',
    '0',
    '1',
    '0',
    startTicks,
    '100000',
    mutable.residentPages ?? '512',
  ];
  return `${record.hostInitPid} (${comm}) ${fields.join(' ')}`;
}
