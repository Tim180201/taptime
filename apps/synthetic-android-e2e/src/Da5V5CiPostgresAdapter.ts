import { createHash } from 'node:crypto';
import { constants, readFileSync } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Pool } from 'pg';
import { B3_MIGRATION_TABLE, B3_SCHEMA } from '@taptime/backend-schema';
import { da5V5RuntimeLogins, runtimeLogins } from './constants.js';
import type {
  Da5V5PostgresAttestationStage,
  Da5V5PostgresOperations,
  Da5V5PostgresOwnerBackend,
  Da5V5RuntimePoolRequest,
} from './Da5V5PostgresCapability.js';
import {
  assertDa5V5FocusedTestProcess,
} from './Da5V5PostgresCapability.js';

const ownerLabelKeys = Object.freeze([
  'com.taptime.repository',
  'com.taptime.run-id',
  'com.taptime.run-attempt',
  'com.taptime.job',
  'com.taptime.nonce',
] as const);

const ciRuntimeRoleGraph: Readonly<Record<string, readonly string[]>> =
Object.freeze({
  [runtimeLogins.session]: ['taptime_identity_resolver'],
  [runtimeLogins.readModel]: [
    'taptime_administrator',
    'taptime_employee',
    'taptime_identity_resolver',
  ],
  [runtimeLogins.lifecycle]: [
    'taptime_identity_resolver',
    'taptime_server_lifecycle',
  ],
  [runtimeLogins.administration]: [
    'taptime_admin_setup',
    'taptime_identity_resolver',
  ],
  [runtimeLogins.employeeInvitation]: [
    'taptime_employee_invitation_creator',
    'taptime_identity_resolver',
  ],
  [runtimeLogins.employeeEnrollment]: ['taptime_employee_enrollment_redeemer'],
  [runtimeLogins.reassignment]: [
    'taptime_assignment_reassigner',
    'taptime_identity_resolver',
  ],
  [runtimeLogins.offlineLease]: ['taptime_offline_lease_issuer'],
  [runtimeLogins.offlineEvent]: ['taptime_offline_event_ingestor'],
  [runtimeLogins.offlineReconciliation]: [
    'taptime_offline_reconciliation_reader',
  ],
  [runtimeLogins.timeEntryExport]: [
    'taptime_identity_resolver',
    'taptime_time_exporter',
  ],
  [runtimeLogins.timeReviewRead]: [
    'taptime_identity_resolver',
    'taptime_time_review_reader',
  ],
  [runtimeLogins.timeReviewWrite]: [
    'taptime_identity_resolver',
    'taptime_time_review_writer',
  ],
  [da5V5RuntimeLogins.manualLifecycle]: [
    'taptime_identity_resolver',
    'taptime_server_lifecycle',
  ],
  [da5V5RuntimeLogins.mobileOwnTime]: [
    'taptime_identity_resolver',
    'taptime_mobile_own_time_reader',
  ],
  [da5V5RuntimeLogins.mobileTarget]: [
    'taptime_identity_resolver',
    'taptime_mobile_target_reader',
  ],
  [da5V5RuntimeLogins.projectAdministration]: [
    'taptime_identity_resolver',
    'taptime_project_administrator',
  ],
});

const ciMigrationRoles = Object.freeze([
  'taptime_admin_setup',
  'taptime_admin_setup_data_function_owner',
  'taptime_admin_setup_function_owner',
  'taptime_administrator',
  'taptime_assignment_reassigner',
  'taptime_assignment_reassignment_function_owner',
  'taptime_bootstrap_executor',
  'taptime_bootstrap_function_owner',
  'taptime_employee',
  'taptime_employee_enrollment_redeemer',
  'taptime_employee_invitation_creator',
  'taptime_employee_invitation_data_function_owner',
  'taptime_employee_invitation_function_owner',
  'taptime_employee_redemption_data_function_owner',
  'taptime_employee_redemption_function_owner',
  'taptime_identity_resolver',
  'taptime_mobile_own_time_reader',
  'taptime_mobile_read_function_owner',
  'taptime_mobile_target_reader',
  'taptime_offline_event_function_owner',
  'taptime_offline_event_ingestor',
  'taptime_offline_lease_function_owner',
  'taptime_offline_lease_issuer',
  'taptime_offline_reconciliation_function_owner',
  'taptime_offline_reconciliation_reader',
  'taptime_project_administrator',
  'taptime_server_lifecycle',
  'taptime_time_export_function_owner',
  'taptime_time_exporter',
  'taptime_time_review_read_function_owner',
  'taptime_time_review_reader',
  'taptime_time_review_write_function_owner',
  'taptime_time_review_writer',
  'taptime_work_target_function_owner',
] as const);

export interface Da5V5CiOwnerRecord {
  readonly containerId: string;
  readonly hostInitPid: number;
  readonly hostProcessStart: string;
  readonly imageId: string;
  readonly imageRepositoryDigest: string;
  readonly innerSystemIdentifier: string;
  readonly labels: Readonly<Record<(typeof ownerLabelKeys)[number], string>>;
  readonly startedAt: string;
}

export interface Da5V5DockerReadRunner {
  readHostProcessStart(pid: number): Readonly<{
    readonly status: number;
    readonly stderr: string;
    readonly stdout: string;
  }>;
  run(args: readonly string[]): Readonly<{
    readonly status: number;
    readonly stderr: string;
    readonly stdout: string;
  }>;
}

export class SystemDa5V5DockerReadRunner implements Da5V5DockerReadRunner {
  readHostProcessStart(pid: number): Readonly<{
    readonly status: number;
    readonly stderr: string;
    readonly stdout: string;
  }> {
    try {
      return Object.freeze({
        status: 0,
        stderr: '',
        stdout: readFileSync(`/proc/${pid}/stat`, 'utf8'),
      });
    } catch {
      return Object.freeze({ status: -1, stderr: 'unavailable', stdout: '' });
    }
  }

  run(args: readonly string[]): Readonly<{
    readonly status: number;
    readonly stderr: string;
    readonly stdout: string;
  }> {
    const result = spawnSync('/usr/bin/env', ['docker', ...args], {
      cwd: '/',
      encoding: 'utf8',
      env: Object.freeze({
        PATH: '/usr/local/bin:/usr/bin:/bin',
      }),
      maxBuffer: 65_536,
      shell: false,
      timeout: 5_000,
      windowsHide: true,
    });
    return Object.freeze({
      status: result.status ?? -1,
      stderr: result.stderr,
      stdout: result.stdout,
    });
  }
}

export async function startDa5V5FullyAttestedCiPostgresOwner(options: {
  readonly databaseUrl: string;
  readonly ownerRecordPath: string;
  readonly runner?: Da5V5DockerReadRunner;
}): Promise<Da5V5PostgresOwnerBackend> {
  assertDa5V5FocusedTestProcess();
  if (!options.ownerRecordPath.startsWith('/')) {
    throw new Error('DA5 V5 CI owner record path must be absolute');
  }
  const record = validateDa5V5CiOwnerRecord(JSON.parse(
    await readExactOwnerRecord(options.ownerRecordPath),
  ));
  const runner = options.runner ?? new SystemDa5V5DockerReadRunner();
  reattestContainerOwner(record, runner);
  parseCiUrl(options.databaseUrl);

  const pool = new Pool({
    connectionString: options.databaseUrl,
    connectionTimeoutMillis: 5_000,
    max: 2,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  });
  try {
    const attestation = await pool.query<{
      address: string;
      database: string;
      port: number;
      role: string;
      server_version_num: string;
      system_identifier: string;
    }>(`
      SELECT
        pg_catalog.host(pg_catalog.inet_server_addr()) AS address,
        pg_catalog.current_database() AS database,
        pg_catalog.inet_server_port() AS port,
        CURRENT_USER AS role,
        pg_catalog.current_setting('server_version_num') AS server_version_num,
        system_identifier::text
      FROM pg_catalog.pg_control_system()
    `);
    const row = attestation.rows[0];
    if (
      row === undefined
      || row.address !== '127.0.0.1'
      || row.database !== 'taptime_synthetic_android_e2e'
      || row.port !== 5_432
      || row.role !== 'postgres'
      || row.server_version_num !== '170010'
      || row.system_identifier !== record.innerSystemIdentifier
    ) {
      throw new Error('DA5 V5 CI inner/outer PostgreSQL attestation mismatch');
    }
    reattestContainerOwner(record, runner);
    const ownedRuntimePools = new Set<Pool>();
    const installerOperations = createCiPostgresOperationFacade(pool);
    let ownerState: 'active' | 'cleanup-incomplete' | 'closed' = 'active';
    const ownerAttestation = Object.freeze({
      database: 'taptime_synthetic_android_e2e' as const,
      host: '127.0.0.1' as const,
      port: 5_432 as const,
      role: 'postgres' as const,
      serverVersionNumber: 170_010 as const,
      systemIdentifier: row.system_identifier,
    });
    const lifecycleBindings = {
      artifactDigest: createHash('sha256')
        .update(`${record.imageId}\n${record.imageRepositoryDigest}\n`)
        .digest('hex'),
      binaryChainDigest: ownerRecordDigest(record),
      binaryChainManifest: Object.freeze([
        Object.freeze({
          containerId: record.containerId,
          imageId: record.imageId,
          imageRepositoryDigest: record.imageRepositoryDigest,
        }),
      ]),
      capabilityDigest: createHash('sha256')
        .update(`ci-capability\n${record.labels['com.taptime.nonce']}\n`)
        .digest('hex'),
      catalogDigest: createHash('sha256')
        .update(JSON.stringify(ownerAttestation))
        .digest('hex'),
      configurationDigest: createHash('sha256')
        .update(options.databaseUrl)
        .digest('hex'),
      dataDirectoryIdentity: ownerRecordDigest(record),
      directoryIdentity: ownerRecordDigest(record),
      guardExecutableDigest: createHash('sha256')
        .update(`${record.imageId}\n${record.hostInitPid}\n`)
        .digest('hex'),
      logDescriptorDigest: ownerRecordDigest(record),
      mountIdentity: ownerRecordDigest(record),
      ownerProcess: createHash('sha256')
        .update(`${record.hostInitPid}\n${record.hostProcessStart}\n`)
        .digest('hex'),
      postmasterDigest: createHash('sha256')
        .update(`${record.innerSystemIdentifier}\n${record.startedAt}\n`)
        .digest('hex'),
      processIdentity: createHash('sha256')
        .update(`${record.containerId}\n${record.startedAt}\n`)
        .digest('hex'),
      provisionalDigest: ownerRecordDigest(record),
      rootIdentity: ownerRecordDigest(record),
      socketIdentity: createHash('sha256')
        .update('127.0.0.1:5432')
        .digest('hex'),
      trustedGroupDigest: ownerRecordDigest(record),
      version: 'DA5-V5-LIFECYCLE-V1' as const,
    };
    const lifecycleRecord = Object.freeze({
      ...lifecycleBindings,
      finalDigest: createHash('sha256')
        .update(JSON.stringify(lifecycleBindings))
        .digest('hex'),
    });
    const reattest = async (
      stage: Da5V5PostgresAttestationStage,
    ): Promise<void> => {
      if (ownerState !== 'active') {
        throw new Error('DA5 V5 CI PostgreSQL owner is closed');
      }
      reattestContainerOwner(record, runner);
      await attestCiDatabase(pool, ownerAttestation, stage);
    };
    return Object.freeze({
      attestation: ownerAttestation,
      lifecycleRecord,
      async closeOwner(): Promise<void> {
        if (ownerState !== 'active') {
          throw new Error('DA5 V5 CI PostgreSQL owner is closed');
        }
        try {
          await Promise.all([...ownedRuntimePools].map(async (runtimePool) => {
            await runtimePool.end().catch((error: unknown) => {
              if (
                !(error instanceof Error)
                || !/Called end on pool more than once/u.test(error.message)
              ) {
                throw error;
              }
            });
          }));
          ownedRuntimePools.clear();
          await pool.end();
          ownerState = 'closed';
        } catch {
          ownerState = 'cleanup-incomplete';
          throw new Error('DA5 V5 CI PostgreSQL cleanup failed');
        }
      },
      ownerDigest: ownerRecordDigest(record),
      async provisionRuntimePool(
        request: Da5V5RuntimePoolRequest,
      ): Promise<Da5V5PostgresOperations> {
        const roles = validateCiRuntimePoolRequest(request);
        const password = createHash('sha256')
          .update(`${record.labels['com.taptime.nonce']}\n${request.login}\n`)
          .digest('base64url');
        await normalizeCiRuntimeLogin(pool, request.login, password, roles);
        const url = new URL(options.databaseUrl);
        url.username = request.login;
        url.password = password;
        const runtimePool = new Pool({
          connectionString: url.toString(),
          connectionTimeoutMillis: 5_000,
          max: request.max,
          query_timeout: 5_000,
          statement_timeout: 5_000,
        });
        ownedRuntimePools.add(runtimePool);
        return createCiPostgresOperationFacade(runtimePool);
      },
      reattest,
      source: 'ci-test-adapter' as const,
      async withInstaller<T>(
        action: (installerPool: Da5V5PostgresOperations) => Promise<T>,
      ): Promise<T> {
        if (ownerState !== 'active') {
          throw new Error('DA5 V5 CI PostgreSQL owner is closed');
        }
        return action(installerOperations);
      },
    });
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }
}

function createCiPostgresOperationFacade(
  pool: Pool,
): Da5V5PostgresOperations {
  return Object.freeze({
    async connect() {
      const client = await pool.connect();
      return Object.freeze({
        query: client.query.bind(client),
        release: client.release.bind(client),
        toJSON(): never {
          throw new Error('DA5 V5 CI PostgreSQL client operations are not serializable');
        },
        toString(): never {
          throw new Error('DA5 V5 CI PostgreSQL client operations are not stringifiable');
        },
      });
    },
    end: () => pool.end(),
    query: pool.query.bind(pool),
    toJSON(): never {
      throw new Error('DA5 V5 CI PostgreSQL operations are not serializable');
    },
    toString(): never {
      throw new Error('DA5 V5 CI PostgreSQL operations are not stringifiable');
    },
  });
}

async function readExactOwnerRecord(path: string): Promise<string> {
  if (await realpath(path) !== path) {
    throw new Error('DA5 V5 CI owner record path must be canonical');
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (
      !before.isFile()
      || (before.mode & 0o777) !== 0o600
      || before.size <= 0
      || before.size > 16_384
      || (
        process.geteuid !== undefined
        && before.uid !== process.geteuid()
      )
    ) {
      throw new Error('DA5 V5 CI owner record boundary is invalid');
    }
    const contents = await handle.readFile({ encoding: 'utf8' });
    const after = await handle.stat();
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
    ) {
      throw new Error('DA5 V5 CI owner record identity changed');
    }
    return contents;
  } finally {
    await handle.close();
  }
}

export function validateDa5V5CiOwnerRecord(value: unknown): Da5V5CiOwnerRecord {
  if (!isRecord(value)) {
    throw new Error('DA5 V5 CI owner record is invalid');
  }
  const labels = value.labels;
  if (!isRecord(labels)) {
    throw new Error('DA5 V5 CI owner labels are invalid');
  }
  if (
    Object.keys(value).sort().join(',')
      !== [
        'containerId',
        'hostInitPid',
        'hostProcessStart',
        'imageId',
        'imageRepositoryDigest',
        'innerSystemIdentifier',
        'labels',
        'startedAt',
      ].sort().join(',')
  ) {
    throw new Error('DA5 V5 CI owner record binding is invalid');
  }
  for (const label of ownerLabelKeys) {
    if (typeof labels[label] !== 'string' || labels[label].length === 0) {
      throw new Error('DA5 V5 CI owner labels are incomplete');
    }
  }
  if (
    Object.keys(labels).length !== ownerLabelKeys.length
    || labels['com.taptime.repository'] !== 'taptime'
    || !/^[1-9][0-9]*$/u.test(labels['com.taptime.run-id'] as string)
    || !/^[1-9][0-9]*$/u.test(labels['com.taptime.run-attempt'] as string)
    || labels['com.taptime.job'] !== 'synthetic-android-e2e'
    || !/^[a-f0-9]{64}$/u.test(labels['com.taptime.nonce'] as string)
  ) {
    throw new Error('DA5 V5 CI owner labels are invalid');
  }
  if (
    typeof value.containerId !== 'string'
    || !/^[a-f0-9]{64}$/u.test(value.containerId)
    || typeof value.hostInitPid !== 'number'
    || !Number.isSafeInteger(value.hostInitPid)
    || value.hostInitPid <= 1
    || typeof value.hostProcessStart !== 'string'
    || value.hostProcessStart.length < 20
    || value.hostProcessStart.length > 4_096
    || /[\r\n\u0000]/u.test(value.hostProcessStart)
    || typeof value.imageId !== 'string'
    || !/^sha256:[a-f0-9]{64}$/u.test(value.imageId)
    || typeof value.imageRepositoryDigest !== 'string'
    || !/^postgres@sha256:[a-f0-9]{64}$/u.test(value.imageRepositoryDigest)
    || typeof value.innerSystemIdentifier !== 'string'
    || !/^[1-9][0-9]{9,}$/u.test(value.innerSystemIdentifier)
    || typeof value.startedAt !== 'string'
    || !Number.isFinite(Date.parse(value.startedAt))
  ) {
    throw new Error('DA5 V5 CI owner record binding is invalid');
  }
  return Object.freeze({
    containerId: value.containerId,
    hostInitPid: value.hostInitPid,
    hostProcessStart: value.hostProcessStart,
    imageId: value.imageId,
    imageRepositoryDigest: value.imageRepositoryDigest,
    innerSystemIdentifier: value.innerSystemIdentifier,
    labels: Object.freeze(Object.fromEntries(
      ownerLabelKeys.map((key) => [key, labels[key] as string]),
    )) as Da5V5CiOwnerRecord['labels'],
    startedAt: value.startedAt,
  });
}

export function ownerRecordDigest(record: Da5V5CiOwnerRecord): string {
  const safeRecord = {
    containerId: record.containerId,
    hostInitPid: record.hostInitPid,
    hostProcessStart: record.hostProcessStart,
    imageId: record.imageId,
    imageRepositoryDigest: record.imageRepositoryDigest,
    innerSystemIdentifier: record.innerSystemIdentifier,
    labels: record.labels,
    startedAt: record.startedAt,
  };
  return createHash('sha256').update(
    `DA5-V5-CI-OWNER-V1\n${JSON.stringify(safeRecord)}\n`,
  ).digest('hex');
}

function reattestContainerOwner(
  record: Da5V5CiOwnerRecord,
  runner: Da5V5DockerReadRunner,
): void {
  const inspection = runner.run([
    'inspect',
    '--type',
    'container',
    record.containerId,
    '--format',
    '{{json .}}',
  ]);
  if (inspection.status !== 0 || inspection.stderr.trim().length > 0) {
    throw new Error('DA5 V5 CI container owner re-attestation failed');
  }
  let value: unknown;
  try {
    value = JSON.parse(inspection.stdout);
  } catch {
    throw new Error('DA5 V5 CI container owner inspection is invalid');
  }
  if (!isRecord(value)) {
    throw new Error('DA5 V5 CI container owner inspection is invalid');
  }
  const state = value.State;
  const config = value.Config;
  if (!isRecord(state) || !isRecord(config) || !isRecord(config.Labels)) {
    throw new Error('DA5 V5 CI container owner inspection is incomplete');
  }
  const labels = config.Labels;
  const exactLabels = ownerLabelKeys.every(
    (label) => labels[label] === record.labels[label],
  ) && Object.keys(labels).length === ownerLabelKeys.length;
  if (
    value.Id !== record.containerId
    || value.Image !== record.imageId
    || config.Image !== record.imageRepositoryDigest
    || state.StartedAt !== record.startedAt
    || state.Pid !== record.hostInitPid
    || state.Running !== true
    || !exactLabels
  ) {
    throw new Error('DA5 V5 CI container owner identity mismatch');
  }
  const imageInspection = runner.run([
    'image',
    'inspect',
    record.imageId,
    '--format',
    '{{json .}}',
  ]);
  let imageValue: unknown;
  try {
    imageValue = JSON.parse(imageInspection.stdout);
  } catch {
    throw new Error('DA5 V5 CI image owner inspection is invalid');
  }
  if (
    imageInspection.status !== 0
    || imageInspection.stderr.trim().length > 0
    || !isRecord(imageValue)
    || imageValue.Id !== record.imageId
    || !Array.isArray(imageValue.RepoDigests)
    || !imageValue.RepoDigests.includes(record.imageRepositoryDigest)
  ) {
    throw new Error('DA5 V5 CI image owner identity mismatch');
  }
  const startIdentity = runner.readHostProcessStart(record.hostInitPid);
  if (
    startIdentity.status !== 0
    || startIdentity.stderr.trim().length > 0
    || startIdentity.stdout.trim() !== record.hostProcessStart
  ) {
    throw new Error('DA5 V5 CI container process-start identity mismatch');
  }
}

function validateCiRuntimePoolRequest(
  request: Da5V5RuntimePoolRequest,
): readonly string[] {
  const exactRoles = ciRuntimeRoleGraph[request.login];
  if (
    exactRoles === undefined
    || !Number.isSafeInteger(request.max)
    || request.max < 1
    || request.max > 4
    || request.roles.length !== exactRoles.length
    || [...request.roles].sort().join('\n')
      !== [...exactRoles].sort().join('\n')
  ) {
    throw new Error('DA5 V5 CI runtime-pool authority mismatch');
  }
  return exactRoles;
}

async function normalizeCiRuntimeLogin(
  pool: Pool,
  login: string,
  password: string,
  roles: readonly string[],
): Promise<void> {
  if (
    ciRuntimeRoleGraph[login] === undefined
    || !/^[A-Za-z0-9_-]{32,}$/u.test(password)
  ) {
    throw new Error('DA5 V5 CI runtime-login authority mismatch');
  }
  await pool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${login}'
      ) THEN
        CREATE ROLE ${login}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
          NOREPLICATION NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${login} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD ${quoteCiLiteral(password)};
    ALTER ROLE ${login} RESET ALL;
    DO $parents$
    DECLARE parent_name text;
    BEGIN
      FOR parent_name IN
        SELECT parent.rolname
        FROM pg_catalog.pg_auth_members AS membership
        JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
        JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
        WHERE member.rolname = '${login}'
      LOOP
        EXECUTE format('REVOKE %I FROM ${login}', parent_name);
      END LOOP;
    END
    $parents$;
    REVOKE ALL PRIVILEGES ON SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${B3_SCHEMA} FROM ${login};
    GRANT ${roles.join(', ')} TO ${login};
  `);
}

async function attestCiDatabase(
  pool: Pool,
  expected: Da5V5PostgresOwnerBackend['attestation'],
  stage: Da5V5PostgresAttestationStage,
): Promise<void> {
  const identity = await pool.query<{
    address: string;
    database: string;
    port: number;
    role: string;
    server_version_num: string;
    system_identifier: string;
  }>(`
    SELECT
      pg_catalog.host(pg_catalog.inet_server_addr()) AS address,
      pg_catalog.current_database() AS database,
      pg_catalog.inet_server_port() AS port,
      CURRENT_USER AS role,
      pg_catalog.current_setting('server_version_num') AS server_version_num,
      system_identifier::text
    FROM pg_catalog.pg_control_system()
  `);
  const row = identity.rows[0];
  if (
    row === undefined
    || row.address !== expected.host
    || row.database !== expected.database
    || row.port !== expected.port
    || row.role !== expected.role
    || row.server_version_num !== String(expected.serverVersionNumber)
    || row.system_identifier !== expected.systemIdentifier
  ) {
    throw new Error('DA5 V5 CI database identity mismatch');
  }
  if (stage === 'before-migrations') {
    const empty = await pool.query<{
      migration_tables: string;
      user_schemas: string;
    }>(`
      SELECT
        count(*) FILTER (
          WHERE namespace.nspname = 'public'
            AND class.relname = '${B3_MIGRATION_TABLE}'
        )::text AS migration_tables,
        count(*) FILTER (
          WHERE namespace.nspname NOT LIKE 'pg_%'
            AND namespace.nspname NOT IN ('information_schema', 'public')
        )::text AS user_schemas
      FROM pg_catalog.pg_namespace AS namespace
      LEFT JOIN pg_catalog.pg_class AS class
        ON class.relnamespace = namespace.oid
    `);
    if (
      empty.rows[0]?.migration_tables !== '0'
      || empty.rows[0]?.user_schemas !== '0'
    ) {
      throw new Error('DA5 V5 CI empty-database allowlist mismatch');
    }
    return;
  }
  const ledger = await pool.query<{
    migration_count: string;
    migration_list: string;
    schema_owner: string;
  }>(`
    SELECT
      (SELECT count(*)::text FROM ${B3_MIGRATION_TABLE}) AS migration_count,
      (
        SELECT pg_catalog.string_agg(version, ',' ORDER BY version)
        FROM ${B3_MIGRATION_TABLE}
      ) AS migration_list,
      (
        SELECT owner.rolname
        FROM pg_catalog.pg_namespace AS namespace
        JOIN pg_catalog.pg_roles AS owner ON owner.oid = namespace.nspowner
        WHERE namespace.nspname = '${B3_SCHEMA}'
      ) AS schema_owner
  `);
  if (
    ledger.rows[0]?.migration_count !== '13'
    || ledger.rows[0]?.migration_list
      !== '001,002,003,004,005,006,007,008,009,010,011,012,013'
    || ledger.rows[0]?.schema_owner !== 'postgres'
  ) {
    throw new Error('DA5 V5 CI migration-ledger mismatch');
  }
  if (
    stage === 'after-role-provisioning'
    || stage === 'before-product-listeners'
    || stage === 'before-cleanup'
  ) {
    const expectedRoles = [
      'postgres',
      ...ciMigrationRoles,
      ...Object.keys(ciRuntimeRoleGraph),
    ].sort();
    const roles = await pool.query<{ roles: string }>(`
      SELECT COALESCE(
        pg_catalog.string_agg(rolname, ',' ORDER BY rolname),
        ''
      ) AS roles
      FROM pg_catalog.pg_roles
      WHERE rolname !~ '^pg_'
    `);
    if (roles.rows[0]?.roles !== expectedRoles.join(',')) {
      throw new Error('DA5 V5 CI role allowlist mismatch');
    }
    const runtimeRoles = await pool.query<{
      memberships: string;
      role: string;
      safe_flags: boolean;
      settings: string;
    }>(`
      SELECT
        role.rolname AS role,
        role.rolcanlogin
          AND NOT role.rolinherit
          AND NOT role.rolsuper
          AND NOT role.rolcreatedb
          AND NOT role.rolcreaterole
          AND NOT role.rolreplication
          AND NOT role.rolbypassrls AS safe_flags,
        COALESCE((
          SELECT pg_catalog.string_agg(
            parent.rolname || ':' || membership.admin_option::text || ':'
              || membership.inherit_option::text || ':'
              || membership.set_option::text,
            ',' ORDER BY parent.rolname
          )
          FROM pg_catalog.pg_auth_members AS membership
          JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
          WHERE membership.member = role.oid
        ), '') AS memberships,
        COALESCE((
          SELECT pg_catalog.string_agg(setting, ',' ORDER BY setting)
          FROM pg_catalog.unnest(role.rolconfig) AS setting
        ), '') AS settings
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = ANY($1::text[])
      ORDER BY role.rolname
    `, [Object.keys(ciRuntimeRoleGraph)]);
    if (runtimeRoles.rows.length !== Object.keys(ciRuntimeRoleGraph).length) {
      throw new Error('DA5 V5 CI runtime-role cardinality mismatch');
    }
    for (const runtimeRole of runtimeRoles.rows) {
      const expectedMemberships = ciRuntimeRoleGraph[runtimeRole.role]
        ?.map((parent) => `${parent}:false:true:true`)
        .sort()
        .join(',');
      if (
        !runtimeRole.safe_flags
        || runtimeRole.settings !== ''
        || runtimeRole.memberships !== expectedMemberships
      ) {
        throw new Error('DA5 V5 CI runtime-role boundary mismatch');
      }
    }
    const directGrants = await pool.query<{ direct_grants: string }>(`
      SELECT (
        (SELECT count(*) FROM information_schema.role_table_grants
          WHERE grantee = ANY($1::text[]))
        + (SELECT count(*) FROM information_schema.role_routine_grants
          WHERE grantee = ANY($1::text[]))
        + (SELECT count(*) FROM information_schema.role_usage_grants
          WHERE grantee = ANY($1::text[]))
      )::text AS direct_grants
    `, [Object.keys(ciRuntimeRoleGraph)]);
    if (directGrants.rows[0]?.direct_grants !== '0') {
      throw new Error('DA5 V5 CI direct-grant boundary mismatch');
    }
  }
  if (stage === 'before-product-listeners') {
    const sessions = await pool.query<{ application_sessions: string }>(`
      SELECT count(*)::text AS application_sessions
      FROM pg_catalog.pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_catalog.pg_backend_pid()
        AND backend_type = 'client backend'
    `);
    if (sessions.rows[0]?.application_sessions !== '0') {
      throw new Error('DA5 V5 CI pre-listener session mismatch');
    }
  }
}

function quoteCiLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function parseCiUrl(value: unknown): URL {
  if (typeof value !== 'string') {
    throw new Error('DA5 V5 CI database URL is invalid');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DA5 V5 CI database URL is invalid');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1'
    || url.port !== '5432'
    || decodeURIComponent(url.pathname) !== '/taptime_synthetic_android_e2e'
    || url.username !== 'postgres'
    || url.password.length < 24
    || url.search.length > 0
    || url.hash.length > 0
  ) {
    throw new Error('DA5 V5 CI database URL binding is invalid');
  }
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
