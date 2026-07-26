import { spawnSync } from 'node:child_process';
import {
  chmod,
  mkdtemp,
  mkdir,
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

  it('binds final PostgreSQL readiness before system identity and cleans partial launch state',
    async () => {
      const workflow = await readFile(new URL(
        '../../../.github/workflows/ci.yml',
        import.meta.url,
      ), 'utf8');
      const startIndex = workflow.indexOf(
        '- name: Start exact-owned loopback-only PostgreSQL 17',
      );
      const cleanupIndex = workflow.indexOf(
        '- name: Stop exact-owned synthetic PostgreSQL',
      );
      const start = workflow.slice(
        startIndex,
        workflow.indexOf('- name: Set up Node.js', startIndex),
      );
      const cleanup = workflow.slice(cleanupIndex);
      const dockerRun = start.indexOf('docker run --detach');
      const launchRecord = start.indexOf(
        '> "${owner_root}/launch.json.candidate"',
      );
      const boundedReadiness = start.indexOf(
        'timeout --signal=KILL 30s bash -c',
      );
      const finalPidOne = start.indexOf(
        'docker exec "${cid}" cat /proc/1/comm',
      );
      const ready = start.indexOf(
        'docker exec "${cid}" pg_isready',
      );
      const systemIdentifier = start.indexOf(
        "SELECT system_identifier FROM pg_catalog.pg_control_system()",
      );
      expect([
        dockerRun,
        launchRecord,
        boundedReadiness,
        finalPidOne,
        ready,
        systemIdentifier,
      ].every((index) => index >= 0)).toBe(true);
      expect([
        dockerRun,
        launchRecord,
        boundedReadiness,
        finalPidOne,
        ready,
        systemIdentifier,
      ]).toEqual([
        dockerRun,
        launchRecord,
        boundedReadiness,
        finalPidOne,
        ready,
        systemIdentifier,
      ].sort((left, right) => left - right));
      expect(start).toContain('test "${pid_one_comm}" = "postgres"');
      expect(start).toContain(
        "'. + {innerSystemIdentifier: $innerSystemIdentifier}'",
      );
      expect(start).toContain(
        "jq -Sc 'del(.innerSystemIdentifier)'",
      );

      const launchRequired = cleanup.indexOf(
        'test -f "${owner_root}/launch.json"',
      );
      const optionalOwner = cleanup.indexOf(
        'if test -f "${owner_root}/owner.json"; then',
      );
      const launchValidation = cleanup.indexOf(
        "' \"${owner_root}/launch.json\" >/dev/null",
      );
      const liveInspections = [...cleanup.matchAll(
        /docker inspect "\$\{cid\}" --format '\{\{json \.\}\}'/gu,
      )].map(({ index }) => index);
      const exactRemovals = [...cleanup.matchAll(
        /docker rm --force "\$\{cid\}"/gu,
      )].map(({ index }) => index);
      expect([
        launchRequired,
        optionalOwner,
        launchValidation,
        ...liveInspections,
        ...exactRemovals,
      ].every((index) => index >= 0)).toBe(true);
      expect(liveInspections).toHaveLength(2);
      expect(exactRemovals).toHaveLength(2);
      expect(launchRequired).toBeLessThan(liveInspections[0] as number);
      expect(liveInspections[0]).toBeLessThan(exactRemovals[0] as number);
      expect(exactRemovals[0]).toBeLessThan(launchValidation);
      expect(launchValidation).toBeLessThan(optionalOwner);
      expect(optionalOwner).toBeLessThan(liveInspections[1] as number);
      expect(liveInspections[1]).toBeLessThan(exactRemovals[1] as number);
      expect(cleanup).toContain(
        "jq -Sc 'del(.innerSystemIdentifier)'",
      );
      expect(cleanup).toContain(
        'image_id="$(jq -r \'.imageId\' "${owner_root}/launch.json")"',
      );
      expect(cleanup).toContain(
        'test "$(jq -r \'.State.Status\' <<<"${inspect}")" = "exited"',
      );
      expect(cleanup).toContain(
        'test "$(jq -r \'.State.Pid\' <<<"${inspect}")" = "0"',
      );
      expect(cleanup).toContain(
        'test "${status}" = "created" || test "${status}" = "exited"',
      );
    });

  it('removes only an exactly bound pre-launch container and rejects poisoned provenance',
    async () => {
      const workflow = await readFile(new URL(
        '../../../.github/workflows/ci.yml',
        import.meta.url,
      ), 'utf8');
      const stepStart = workflow.indexOf(
        '- name: Stop exact-owned synthetic PostgreSQL',
      );
      const runStart = workflow.indexOf('        run: |\n', stepStart)
        + '        run: |\n'.length;
      const nextStep = workflow.indexOf('\n      - name:', runStart);
      const cleanup = workflow
        .slice(runStart, nextStep < 0 ? workflow.length : nextStep)
        .replace(/^ {10}/gmu, '');
      expect(stepStart).toBeGreaterThanOrEqual(0);
      expect(runStart).toBeGreaterThan(stepStart);

      const exactNonce = 'd'.repeat(64);
      const scenarios = [
        {
          bindingNonce: exactNonce,
          cidFile: 'valid',
          containerStatus: 'created',
          expectedRemoval: true,
          expectedSuccess: true,
          labelNonce: exactNonce,
          name: 'created exact container',
          residue: false,
        },
        {
          bindingNonce: exactNonce,
          cidFile: 'valid',
          containerStatus: 'running',
          expectedRemoval: true,
          expectedSuccess: true,
          labelNonce: exactNonce,
          name: 'running exact container',
          residue: false,
        },
        {
          bindingNonce: 'invalid',
          cidFile: 'valid',
          containerStatus: 'running',
          expectedRemoval: false,
          expectedSuccess: false,
          labelNonce: exactNonce,
          name: 'poisoned binding',
          residue: false,
        },
        {
          bindingNonce: exactNonce,
          cidFile: 'valid',
          containerStatus: 'running',
          expectedRemoval: false,
          expectedSuccess: false,
          labelNonce: 'e'.repeat(64),
          name: 'poisoned label',
          residue: false,
        },
        {
          bindingNonce: exactNonce,
          cidFile: 'valid',
          containerStatus: 'absent',
          expectedRemoval: false,
          expectedSuccess: true,
          labelNonce: exactNonce,
          name: 'inspect absent without residue',
          residue: false,
        },
        {
          bindingNonce: exactNonce,
          cidFile: 'valid',
          containerStatus: 'absent',
          expectedRemoval: false,
          expectedSuccess: false,
          labelNonce: exactNonce,
          name: 'inspect absent with residue',
          residue: true,
        },
        {
          bindingNonce: exactNonce,
          cidFile: 'missing',
          containerStatus: 'absent',
          expectedRemoval: false,
          expectedSuccess: true,
          labelNonce: exactNonce,
          name: 'missing cid without residue',
          residue: false,
        },
        {
          bindingNonce: exactNonce,
          cidFile: 'invalid',
          containerStatus: 'absent',
          expectedRemoval: false,
          expectedSuccess: false,
          labelNonce: exactNonce,
          name: 'invalid cid with residue',
          residue: true,
        },
      ] as const;

      for (const scenario of scenarios) {
        const root = await realpath(await mkdtemp(
          join(tmpdir(), 'taptime-da5-ci-prelaunch-'),
        ));
        temporaryRoots.push(root);
        const runnerTemp = join(root, 'runner');
        const ownerRoot = join(runnerTemp, 'taptime-da5-v5-postgres');
        const fakeBin = join(root, 'bin');
        await mkdir(ownerRoot, { recursive: true, mode: 0o700 });
        await mkdir(fakeBin, { mode: 0o700 });
        const cid = 'a'.repeat(64);
        const imageId = `sha256:${'b'.repeat(64)}`;
        const imageDigest = `postgres@sha256:${'c'.repeat(64)}`;
        const removalPath = join(root, 'removed');
        const dockerLogPath = join(root, 'docker.log');
        const dockerStatePath = join(root, 'docker.state');
        const inspectPath = join(root, 'inspect.json');
        if (scenario.cidFile !== 'missing') {
          await writeFile(
            join(ownerRoot, 'cid'),
            scenario.cidFile === 'valid' ? `${cid}\n` : 'invalid\n',
            { mode: 0o600 },
          );
        }
        if (scenario.cidFile === 'valid') {
          await writeFile(
            join(ownerRoot, 'binding'),
            `${scenario.bindingNonce}\n${imageDigest}\n`,
            { mode: 0o600 },
          );
        }
        await writeFile(
          dockerStatePath,
          `${scenario.containerStatus}\n`,
          { mode: 0o600 },
        );
        const running = scenario.containerStatus === 'running';
        await writeFile(inspectPath, JSON.stringify({
          Config: {
            Image: imageDigest,
            Labels: {
              'com.taptime.repository': 'taptime',
              'com.taptime.run-id': '30220289648',
              'com.taptime.run-attempt': '1',
              'com.taptime.job': 'synthetic-android-e2e',
              'com.taptime.nonce': scenario.labelNonce,
            },
          },
          HostConfig: { RestartPolicy: { Name: 'no' } },
          Id: cid,
          Image: imageId,
          State: {
            Dead: false,
            Paused: false,
            Pid: running ? 4_321 : 0,
            Restarting: false,
            Running: running,
            StartedAt: running
              ? '2026-07-26T21:00:00.000000000Z'
              : '0001-01-01T00:00:00Z',
            Status: scenario.containerStatus,
          },
        }), { mode: 0o600 });
        const dockerPath = join(fakeBin, 'docker');
        await writeFile(dockerPath, [
          '#!/bin/bash',
          'set -euo pipefail',
          'printf \'%s\\n\' "$*" >> "${FAKE_DOCKER_LOG}"',
          'case "$1" in',
          '  inspect)',
          '    state="$(tr -d \'\\n\' < "${FAKE_DOCKER_STATE}")"',
          '    if test "${state}" = "removed"; then',
          '      test "$#" -eq 2',
          '      test "$2" = "${FAKE_CID}"',
          '      exit 1',
          '    fi',
          '    test "$#" -eq 4',
          '    test "$2" = "${FAKE_CID}"',
          '    test "$3" = "--format"',
          '    test "$4" = "{{json .}}"',
          '    test "${state}" != "absent" || exit 1',
          '    cat "${FAKE_DOCKER_INSPECT}"',
          '    ;;',
          '  image)',
          '    test "$#" -eq 5',
          '    test "$2" = "inspect"',
          '    test "$4" = "--format"',
          '    if test "$3" = "${FAKE_IMAGE_DIGEST}"; then',
          '      test "$5" = "{{.Id}}"',
          '      printf \'%s\\n\' "${FAKE_IMAGE_ID}"',
          '    elif test "$3" = "${FAKE_IMAGE_ID}"; then',
          '      test "$5" = "{{range .RepoDigests}}{{println .}}{{end}}"',
          '      printf \'%s\\n\' "${FAKE_IMAGE_DIGEST}"',
          '    else',
          '      exit 1',
          '    fi',
          '    ;;',
          '  rm)',
          '    test "$#" -eq 3',
          '    test "$2" = "--force"',
          '    test "$3" = "${FAKE_CID}"',
          '    test "$(tr -d \'\\n\' < "${FAKE_DOCKER_STATE}")" != "absent"',
          '    printf \'%s\\n\' "$3" > "${FAKE_DOCKER_REMOVAL}"',
          '    printf \'removed\\n\' > "${FAKE_DOCKER_STATE}"',
          '    printf \'%s\\n\' "$3"',
          '    ;;',
          '  ps)',
          '    test "$2" = "--all"',
          '    test "$3" = "--quiet"',
          '    test "$4" = "--filter"',
          '    test "$5" = "label=com.taptime.repository=taptime"',
          '    test "$6" = "--filter"',
          '    test "$7" = "label=com.taptime.run-id=30220289648"',
          '    test "$8" = "--filter"',
          '    test "$9" = "label=com.taptime.run-attempt=1"',
          '    test "${10}" = "--filter"',
          '    test "${11}" = "label=com.taptime.job=synthetic-android-e2e"',
          '    if test "${FAKE_EXPECT_NONCE_FILTER}" = "true"; then',
          '      test "$#" -eq 13',
          '      test "${12}" = "--filter"',
          '      test "${13}" = "label=com.taptime.nonce=${FAKE_NONCE}"',
          '    else',
          '      test "$#" -eq 11',
          '    fi',
          '    if test "${FAKE_RESIDUE}" = "true"; then',
          '      printf \'%s\\n\' "${FAKE_CID}"',
          '    fi',
          '    ;;',
          '  *) exit 2 ;;',
          'esac',
          '',
        ].join('\n'), { mode: 0o700 });
        await chmod(dockerPath, 0o700);
        const result = spawnSync('/bin/bash', ['-c', cleanup], {
          cwd: '/',
          encoding: 'utf8',
          env: {
            ...process.env,
            FAKE_CID: cid,
            FAKE_DOCKER_INSPECT: inspectPath,
            FAKE_DOCKER_LOG: dockerLogPath,
            FAKE_DOCKER_REMOVAL: removalPath,
            FAKE_DOCKER_STATE: dockerStatePath,
            FAKE_EXPECT_NONCE_FILTER:
              scenario.cidFile === 'valid' ? 'true' : 'false',
            FAKE_IMAGE_DIGEST: imageDigest,
            FAKE_IMAGE_ID: imageId,
            FAKE_NONCE: exactNonce,
            FAKE_RESIDUE: scenario.residue ? 'true' : 'false',
            GITHUB_RUN_ATTEMPT: '1',
            GITHUB_RUN_ID: '30220289648',
            PATH: `${fakeBin}:${process.env.PATH ?? '/usr/bin:/bin'}`,
            RUNNER_TEMP: runnerTemp,
          },
          shell: false,
          timeout: 5_000,
        });
        const dockerLog = await readFile(dockerLogPath, 'utf8')
          .catch(() => '');
        if (scenario.expectedSuccess) {
          expect(result.status, scenario.name).toBe(0);
        } else {
          expect(result.status, scenario.name).not.toBe(0);
        }
        if (scenario.expectedRemoval) {
          expect((await readFile(removalPath, 'utf8')).trim()).toBe(cid);
          expect(dockerLog).toContain(`rm --force ${cid}`);
          expect(dockerLog).toContain(`inspect ${cid}`);
          expect(dockerLog).toContain(
            `image inspect ${imageDigest} --format {{.Id}}`,
          );
          expect(dockerLog).toContain(
            `image inspect ${imageId} --format `
              + '{{range .RepoDigests}}{{println .}}{{end}}',
          );
          expect(dockerLog).toContain(
            `label=com.taptime.nonce=${exactNonce}`,
          );
        } else {
          await expect(readFile(removalPath, 'utf8')).rejects.toThrow();
          expect(dockerLog).not.toContain('rm --force');
        }
      }
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
