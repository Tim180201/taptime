import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  B3_ADMIN_ROLE,
  B3_CONTENT_HASH_ALGORITHM,
  B3_CONTENT_HASH_VERSION,
  B3_EMPLOYEE_ROLE,
  B3_LIFECYCLE_ROLE,
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  MigrationChecksumMismatchError,
  applyMigrationSet,
  canonicalWorkEventContent,
  loadMigrations,
  migrate,
  query,
  workEventContentHash,
  withRequestTransaction,
  type B3RequestContext,
  type B3RuntimeRole,
  type Migration,
} from '../src/index.js';
import {
  B3_SYNTHETIC_LOGIN_NAMES,
  ensureSyntheticLogins,
  ids,
  postgresErrorCode,
  runtimeConnectionString,
  seedB3,
  truncateB3,
} from './fixtures.js';
import { closePoolAndDropTestDatabase } from './support/postgresTestDatabaseCleanup.mjs';

const installerConnectionString = process.env.B3_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const runtimePassword = process.env.B3_RUNTIME_PASSWORD ?? 'b3-local-synthetic-only';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 4 });
const employeePool = new Pool({
  connectionString: runtimeConnectionString(installerConnectionString, 'employee', runtimePassword),
  max: 1,
});
const administratorPool = new Pool({
  connectionString: runtimeConnectionString(installerConnectionString, 'administrator', runtimePassword),
  max: 1,
});
const lifecyclePool = new Pool({
  connectionString: runtimeConnectionString(installerConnectionString, 'lifecycle', runtimePassword),
  max: 1,
});

const employeeAContext = { organizationId: ids.organizationA, userId: ids.employeeA };
const employeeA2Context = { organizationId: ids.organizationA, userId: ids.employeeA2 };
const employeeBContext = { organizationId: ids.organizationB, userId: ids.employeeB };
const adminAContext = { organizationId: ids.organizationA, userId: ids.adminA };
const adminBContext = { organizationId: ids.organizationB, userId: ids.adminB };
const adminAMembershipId = '12000000-0000-4000-8000-000000000001';

type B3CapabilityRole =
  | 'taptime_admin_setup'
  | 'taptime_admin_setup_data_function_owner'
  | 'taptime_assignment_reassigner'
  | 'taptime_employee_enrollment_redeemer'
  | 'taptime_employee_invitation_creator'
  | 'taptime_employee_redemption_data_function_owner';

interface B3CapabilityContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly membershipRole: 'administrator';
  readonly correlationId: string;
}

function adminACapabilityContext(correlationId: string): B3CapabilityContext {
  return {
    organizationId: ids.organizationA,
    userId: ids.adminA,
    membershipId: adminAMembershipId,
    membershipRole: 'administrator',
    correlationId,
  };
}

async function setCapabilityContext(
  client: PoolClient,
  role: B3CapabilityRole,
  context: B3CapabilityContext,
): Promise<void> {
  await client.query(
    `SELECT
       set_config('app.organization_id', $1, true),
       set_config('app.user_id', $2, true),
       set_config('app.membership_id', $3, true),
       set_config('app.membership_role', $4, true),
       set_config('app.correlation_id', $5, true)`,
    [
      context.organizationId,
      context.userId,
      context.membershipId,
      context.membershipRole,
      context.correlationId,
    ],
  );
  await client.query(`SET LOCAL ROLE ${role}`);
}

async function withCapabilityTransaction<Value>(
  role: B3CapabilityRole,
  context: B3CapabilityContext,
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await setCapabilityContext(client, role, context);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function withCapabilityProbeTransaction<Value>(
  role: B3CapabilityRole,
  context: B3CapabilityContext,
  operation: (client: PoolClient) => Promise<Value>,
  temporaryGrants: readonly string[] = [],
): Promise<Value> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    for (const statement of temporaryGrants) {
      await client.query(statement);
    }
    await setCapabilityContext(client, role, context);
    const result = await operation(client);
    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function postgresErrorDetails(operation: Promise<unknown>): Promise<{
  readonly code: string | undefined;
  readonly message: string;
} | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return {
      code: error instanceof Error && 'code' in error ? String(error.code) : undefined,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function dropProbeRole(roleName: string): Promise<void> {
  if (!/^taptime_[a-z0-9_]+$/.test(roleName)) throw new Error('Unsafe probe role name');
  const memberships = await installerPool.query<{ parent_name: string }>(`
    SELECT parent.rolname AS parent_name
    FROM pg_catalog.pg_auth_members AS edge
    JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
    JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
    WHERE member.rolname = $1
  `, [roleName]);
  for (const membership of memberships.rows) {
    if (!/^[a-z0-9_]+$/.test(membership.parent_name)) {
      throw new Error('Unsafe parent role name');
    }
    await installerPool.query(`REVOKE ${membership.parent_name} FROM ${roleName}`);
  }
  await installerPool.query(`DROP ROLE IF EXISTS ${roleName}`);
}

async function rejectedAtSavepoint(
  client: PoolClient,
  statement: string,
  values: readonly unknown[] = [],
): Promise<{ readonly code: string | undefined; readonly message: string } | undefined> {
  await client.query('SAVEPOINT b3_expected_rejection');
  const error = await postgresErrorDetails(client.query(statement, [...values]));
  await client.query('ROLLBACK TO SAVEPOINT b3_expected_rejection');
  await client.query('RELEASE SAVEPOINT b3_expected_rejection');
  return error;
}

const otherTarget = {
  customerId: '20000000-0000-4000-8000-000000000098',
  tagId: '30000000-0000-4000-8000-000000000098',
  assignmentId: '40000000-0000-4000-8000-000000000098',
} as const;

async function runtimeQuery<Row extends Record<string, unknown>>(
  pool: Pool,
  role: B3RuntimeRole,
  context: B3RequestContext,
  text: string,
  values: readonly unknown[] = [],
) {
  return withRequestTransaction(pool, role, context, (client) => query<Row>(client, text, values));
}

function employeeQuery<Row extends Record<string, unknown>>(
  context: B3RequestContext,
  text: string,
  values: readonly unknown[] = [],
) {
  return runtimeQuery<Row>(employeePool, B3_EMPLOYEE_ROLE, context, text, values);
}

function adminQuery<Row extends Record<string, unknown>>(
  context: B3RequestContext,
  text: string,
  values: readonly unknown[] = [],
) {
  return runtimeQuery<Row>(administratorPool, B3_ADMIN_ROLE, context, text, values);
}

function lifecycleQuery<Row extends Record<string, unknown>>(
  context: B3RequestContext,
  text: string,
  values: readonly unknown[] = [],
) {
  return runtimeQuery<Row>(lifecyclePool, B3_LIFECYCLE_ROLE, context, text, values);
}

async function revokeMembership(userId: string): Promise<void> {
  await installerPool.query(
    `UPDATE ${B3_SCHEMA}.memberships
     SET revoked_at = '2026-07-13T10:00:00Z', row_version = row_version + 1
     WHERE user_id = $1`,
    [userId],
  );
}

async function insertLifecycleWorkEvent(
  eventId: string,
  context: B3RequestContext = employeeAContext,
  target: { assignmentId: string; tagId: string; customerId: string } = {
    assignmentId: ids.assignmentA,
    tagId: ids.tagA,
    customerId: ids.customerA,
  },
  occurredAt = '2026-07-13T10:00:00Z',
): Promise<void> {
  await lifecycleQuery(
    context,
    `INSERT INTO ${B3_SCHEMA}.work_events
      (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
       triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm, content_hash_version)
     VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7,
       repeat('c', 64), 'sha256', 1)`,
    [
      eventId,
      context.organizationId,
      target.assignmentId,
      target.tagId,
      target.customerId,
      context.userId,
      occurredAt,
    ],
  );
}

async function seedOtherTarget(): Promise<void> {
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.customers
      (id, organization_id, display_name, active, activated_at)
     VALUES ($1, $2, 'Synthetic Other Target', true, '2026-07-01T00:00:00Z')`,
    [otherTarget.customerId, ids.organizationA],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.nfc_tags (id, organization_id, display_name, payload_value)
     VALUES ($1, $2, 'Synthetic Other Tag', 'synthetic-other-target')`,
    [otherTarget.tagId, ids.organizationA],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.nfc_assignments
      (id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from)
     VALUES ($1, $2, $3, 'customer', $4, true, '2026-07-01T00:00:00Z')`,
    [otherTarget.assignmentId, ids.organizationA, otherTarget.tagId, otherTarget.customerId],
  );
}

type CanonicalDecisionType =
  | 'time_entry_started'
  | 'time_entry_stopped'
  | 'duplicate_scan_ignored'
  | 'active_entry_for_other_target_rejected'
  | 'escalation_required';

async function insertManualBreakWorkEvent(
  client: PoolClient,
  eventId: string,
  occurredAt: string,
): Promise<void> {
  await query(client, `INSERT INTO ${B3_SCHEMA}.work_events
    (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
     triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
     content_hash_version, trigger_type, subject_type)
   VALUES ($1, $2, NULL, NULL, NULL, NULL, $3, $4,
     repeat('d', 64), 'sha256', 3, 'manual', 'break')`, [
    eventId,
    ids.organizationA,
    ids.employeeA,
    occurredAt,
  ]);
}

async function persistManualBreak(input: {
  intervalId: string;
  startEventId: string;
  stopEventId: string;
  startedAt: string;
  stoppedAt: string;
}): Promise<void> {
  await withRequestTransaction(
    lifecyclePool,
    B3_LIFECYCLE_ROLE,
    employeeAContext,
    async (client) => {
      await insertManualBreakWorkEvent(client, input.startEventId, input.startedAt);
      await query(client, `INSERT INTO ${B3_SCHEMA}.break_intervals
        (id, organization_id, user_id, time_entry_id, status, start_work_event_id,
         started_at, started_via)
       VALUES ($1, $2, $3, $4, 'started', $5, $6, 'manual')`, [
        input.intervalId,
        ids.organizationA,
        ids.employeeA,
        ids.timeEntryA,
        input.startEventId,
        input.startedAt,
      ]);
      await query(client, `INSERT INTO ${B3_SCHEMA}.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         subject_type, decision_type, time_entry_id, break_interval_id,
         engine_version, decision_payload)
       VALUES ($1, $2, $3, NULL, NULL, 'break', 'break_started', $4, $5,
         'core-test', '{"status":"break_started"}')`, [
        input.startEventId,
        ids.organizationA,
        ids.employeeA,
        ids.timeEntryA,
        input.intervalId,
      ]);
    },
  );
  await withRequestTransaction(
    lifecyclePool,
    B3_LIFECYCLE_ROLE,
    employeeAContext,
    async (client) => {
      await insertManualBreakWorkEvent(client, input.stopEventId, input.stoppedAt);
      await query(client, `UPDATE ${B3_SCHEMA}.break_intervals
        SET status = 'stopped', stop_work_event_id = $1, stopped_at = $2,
          stopped_via = 'manual', row_version = row_version + 1
        WHERE id = $3`, [input.stopEventId, input.stoppedAt, input.intervalId]);
      await query(client, `INSERT INTO ${B3_SCHEMA}.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         subject_type, decision_type, time_entry_id, break_interval_id,
         engine_version, decision_payload)
       VALUES ($1, $2, $3, NULL, NULL, 'break', 'break_stopped', $4, $5,
         'core-test', '{"status":"break_stopped"}')`, [
        input.stopEventId,
        ids.organizationA,
        ids.employeeA,
        ids.timeEntryA,
        input.intervalId,
      ]);
    },
  );
}

async function insertLifecycleDecision(input: {
  eventId: string;
  decisionType: CanonicalDecisionType;
  reason?: string | null;
  timeEntryId?: string | null;
  activeTimeEntryId?: string | null;
  previousWorkEventId?: string | null;
  context?: B3RequestContext;
  targetCustomerId?: string;
  client?: PoolClient;
}): Promise<void> {
  const context = input.context ?? employeeAContext;
  const statement = `INSERT INTO ${B3_SCHEMA}.canonical_decisions
      (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
       decision_type, reason, time_entry_id, active_time_entry_id, previous_work_event_id,
       engine_version, decision_payload)
     VALUES ($1, $2, $3, 'customer', $4, $5, $6, $7, $8, $9, 'core-test', '{}')`;
  const values = [
    input.eventId,
    context.organizationId,
    context.userId,
    input.targetCustomerId ?? ids.customerA,
    input.decisionType,
    input.reason ?? null,
    input.timeEntryId ?? null,
    input.activeTimeEntryId ?? null,
    input.previousWorkEventId ?? null,
  ];
  if (input.client !== undefined) {
    await query(input.client, statement, values);
    return;
  }
  await lifecycleQuery(context, statement, values);
}

async function persistStartedTimeEntry(input: {
  eventId: string;
  timeEntryId: string;
  context?: B3RequestContext;
  targetCustomerId?: string;
  startedAt?: string;
}): Promise<void> {
  const context = input.context ?? employeeAContext;
  const targetCustomerId = input.targetCustomerId ?? ids.customerA;
  await withRequestTransaction(lifecyclePool, B3_LIFECYCLE_ROLE, context, async (client) => {
    await query(
      client,
      `INSERT INTO ${B3_SCHEMA}.time_entries
        (id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at)
       VALUES ($1, $2, $3, 'customer', $4, 'started', $5, $6)`,
      [
        input.timeEntryId,
        context.organizationId,
        context.userId,
        targetCustomerId,
        input.eventId,
        input.startedAt ?? '2026-07-13T10:00:00Z',
      ],
    );
    await insertLifecycleDecision({
      eventId: input.eventId,
      decisionType: 'time_entry_started',
      timeEntryId: input.timeEntryId,
      context,
      targetCustomerId,
      client,
    });
  });
}

async function persistStoppedTimeEntry(input: {
  eventId: string;
  timeEntryId: string;
  context?: B3RequestContext;
  targetCustomerId?: string;
  stoppedAt?: string;
}): Promise<void> {
  const context = input.context ?? employeeAContext;
  const targetCustomerId = input.targetCustomerId ?? ids.customerA;
  await withRequestTransaction(lifecyclePool, B3_LIFECYCLE_ROLE, context, async (client) => {
    await query(
      client,
      `UPDATE ${B3_SCHEMA}.time_entries
       SET status = 'stopped', stop_work_event_id = $1,
         stopped_at = $3, row_version = row_version + 1
       WHERE id = $2`,
      [input.eventId, input.timeEntryId, input.stoppedAt ?? '2026-07-13T10:00:00Z'],
    );
    await insertLifecycleDecision({
      eventId: input.eventId,
      decisionType: 'time_entry_stopped',
      timeEntryId: input.timeEntryId,
      context,
      targetCustomerId,
      client,
    });
  });
}

async function insertLifecycleReceipt(input: {
  id: string;
  eventId: string;
  attemptNumber: number;
  status: 'received' | 'synchronized' | 'retryable_failure' | 'conflict';
  decisionWorkEventId?: string | null;
  serverTimeEntryId?: string | null;
  conflictCode?: string | null;
  context?: B3RequestContext;
  targetCustomerId?: string;
}): Promise<void> {
  const context = input.context ?? employeeAContext;
  await lifecycleQuery(
    context,
    `INSERT INTO ${B3_SCHEMA}.sync_receipts
      (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
       attempt_number, status, server_decision_work_event_id, server_time_entry_id, conflict_code)
     VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, $8, $9, $10)`,
    [
      input.id,
      input.eventId,
      context.organizationId,
      context.userId,
      input.targetCustomerId ?? ids.customerA,
      input.attemptNumber,
      input.status,
      input.decisionWorkEventId ?? null,
      input.serverTimeEntryId ?? null,
      input.conflictCode ?? null,
    ],
  );
}

beforeAll(async () => {
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(installerPool);
  await ensureSyntheticLogins(installerPool, runtimePassword);
});

beforeEach(async () => {
  await truncateB3(installerPool);
  await seedB3(installerPool);
});

afterAll(async () => {
  await Promise.all([employeePool.end(), administratorPool.end(), lifecyclePool.end()]);
  await installerPool.end();
});

describe('B3 deterministic migration system', () => {
  it('applies exactly seventeen sorted versioned migrations', async () => {
    const rows = await installerPool.query<{ version: string; checksum: string }>(
      `SELECT version, checksum FROM ${B3_MIGRATION_TABLE} ORDER BY version`,
    );

    expect(rows.rows.map((row) => row.version)).toEqual([
      '001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017',
    ]);
    expect(rows.rows.every((row) => /^[0-9a-f]{64}$/.test(row.checksum))).toBe(true);
  });

  it('reruns safely without applying any migration twice', async () => {
    await expect(migrate(installerPool)).resolves.toEqual({
      applied: [],
      alreadyApplied: [
        '001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015', '016', '017',
      ],
    });
  });

  it('removes resolver-role contamination and restores each B3 login to exactly its target role', async () => {
    await installerPool.query(
      `GRANT taptime_identity_resolver TO ${B3_SYNTHETIC_LOGIN_NAMES.employee}`,
    );
    await ensureSyntheticLogins(installerPool, runtimePassword);

    const memberships = await installerPool.query<{
      login_name: string;
      parent_roles: string[];
    }>(
      `SELECT
         member.rolname AS login_name,
         ARRAY(
           SELECT parent.rolname::text
           FROM pg_catalog.pg_auth_members AS membership
           JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
           WHERE membership.member = member.oid
           ORDER BY parent.rolname
         )::text[] AS parent_roles
       FROM pg_catalog.pg_roles AS member
       WHERE member.rolname = ANY($1::text[])
       ORDER BY member.rolname`,
      [Object.values(B3_SYNTHETIC_LOGIN_NAMES)],
    );

    expect(memberships.rows).toEqual([
      {
        login_name: B3_SYNTHETIC_LOGIN_NAMES.administrator,
        parent_roles: ['taptime_administrator'],
      },
      {
        login_name: B3_SYNTHETIC_LOGIN_NAMES.employee,
        parent_roles: ['taptime_employee'],
      },
      {
        login_name: B3_SYNTHETIC_LOGIN_NAMES.lifecycle,
        parent_roles: ['taptime_server_lifecycle'],
      },
    ]);
  });

  it('rejects checksum drift for an already applied version', async () => {
    const existing = (await loadMigrations())[0]!;
    const changed: Migration = {
      ...existing,
      sql: `${existing.sql}\nSELECT 1;`,
      checksum: createHash('sha256').update(`${existing.sql}\nSELECT 1;`, 'utf8').digest('hex'),
    };

    await expect(applyMigrationSet(installerPool, [changed])).rejects.toBeInstanceOf(
      MigrationChecksumMismatchError,
    );
  });

  it('rolls back a failed migration without its table or ledger row', async () => {
    const sql = `CREATE TABLE ${B3_SCHEMA}.must_rollback (id integer); SELECT missing_b3_function();`;
    const failed: Migration = {
      version: '900',
      name: 'rollback_proof',
      sql,
      checksum: createHash('sha256').update(sql, 'utf8').digest('hex'),
    };

    await expect(applyMigrationSet(installerPool, [failed])).rejects.toThrow();
    const result = await installerPool.query<{ table_exists: boolean; ledger_count: string }>(`
      SELECT
        to_regclass('${B3_SCHEMA}.must_rollback') IS NOT NULL AS table_exists,
        (SELECT count(*) FROM ${B3_MIGRATION_TABLE} WHERE version = '900') AS ledger_count
    `);
    expect(result.rows[0]).toEqual({ table_exists: false, ledger_count: '0' });
  });

  it('upgrades an exact 001–011 database with migration 012 and reruns its ledger cleanly', async () => {
    const database = 'taptime_da3_upgrade_check';
    await installerPool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await installerPool.query(`CREATE DATABASE ${database}`);
    const url = new URL(installerConnectionString);
    url.pathname = `/${database}`;
    const upgradePool = new Pool({ connectionString: url.toString(), max: 2 });
    try {
      const migrations = await loadMigrations();
      await expect(applyMigrationSet(upgradePool, migrations.slice(0, 11))).resolves.toEqual({
        applied: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011'],
        alreadyApplied: [],
      });
      expect((await upgradePool.query<{ relation: string | null }>(
        `SELECT to_regclass('taptime_server.time_record_revisions')::text AS relation`,
      )).rows[0]!.relation).toBeNull();
      await expect(applyMigrationSet(upgradePool, migrations.slice(11, 12))).resolves.toEqual({
        applied: ['012'], alreadyApplied: [],
      });
      await expect(applyMigrationSet(upgradePool, migrations.slice(11, 12))).resolves.toEqual({
        applied: [], alreadyApplied: ['012'],
      });
    } finally {
      await closePoolAndDropTestDatabase({
        targetPool: upgradePool,
        installerPool,
        databaseName: database,
      });
    }
  }, 30_000);

  it('upgrades an exact 001–013 database with migration 014 and removes Administrator DML', async () => {
    const database = 'taptime_014_upgrade_check';
    await installerPool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await installerPool.query(`CREATE DATABASE ${database}`);
    const url = new URL(installerConnectionString);
    url.pathname = `/${database}`;
    const upgradePool = new Pool({ connectionString: url.toString(), max: 2 });
    const administratorDmlCount = async () => upgradePool.query<{ count: string }>(`
      SELECT count(*)
      FROM (
        VALUES
          ('taptime_server.organizations'::regclass),
          ('taptime_server.memberships'::regclass),
          ('taptime_server.customers'::regclass),
          ('taptime_server.nfc_tags'::regclass),
          ('taptime_server.nfc_assignments'::regclass)
      ) AS target(relation_oid)
      CROSS JOIN (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) AS privilege(privilege_name)
      WHERE CASE privilege.privilege_name
        WHEN 'INSERT' THEN
          has_table_privilege('taptime_administrator', target.relation_oid, 'INSERT')
          OR has_any_column_privilege('taptime_administrator', target.relation_oid, 'INSERT')
        WHEN 'UPDATE' THEN
          has_table_privilege('taptime_administrator', target.relation_oid, 'UPDATE')
          OR has_any_column_privilege('taptime_administrator', target.relation_oid, 'UPDATE')
        WHEN 'DELETE' THEN
          has_table_privilege('taptime_administrator', target.relation_oid, 'DELETE')
        ELSE true
      END
    `);
    try {
      const migrations = await loadMigrations();
      const migration014 = migrations[13]!;
      await expect(applyMigrationSet(upgradePool, migrations.slice(0, 13))).resolves.toEqual({
        applied: [
          '001', '002', '003', '004', '005', '006', '007',
          '008', '009', '010', '011', '012', '013',
        ],
        alreadyApplied: [],
      });
      expect(Number((await administratorDmlCount()).rows[0]?.count)).toBeGreaterThan(0);

      await expect(applyMigrationSet(upgradePool, migrations.slice(13, 14))).resolves.toEqual({
        applied: ['014'], alreadyApplied: [],
      });
      expect((await administratorDmlCount()).rows[0]?.count).toBe('0');
      await expect(upgradePool.query(migration014.sql)).resolves.toBeDefined();
      expect((await administratorDmlCount()).rows[0]?.count).toBe('0');
      await expect(applyMigrationSet(upgradePool, migrations.slice(13, 14))).resolves.toEqual({
        applied: [], alreadyApplied: ['014'],
      });

      await upgradePool.query(
        'GRANT INSERT ON taptime_server.organizations TO taptime_administrator',
      );
      await expect(upgradePool.query(migration014.sql)).rejects.toMatchObject({ code: '42501' });
    } finally {
      await closePoolAndDropTestDatabase({
        targetPool: upgradePool,
        installerPool,
        databaseName: database,
      });
    }
  }, 30_000);

  it('rejects pre-existing DA3 role ACL contamination atomically before creating DA3 objects', async () => {
    const database = 'taptime_da3_dirty_check';
    await installerPool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await installerPool.query(`CREATE DATABASE ${database}`);
    const url = new URL(installerConnectionString);
    url.pathname = `/${database}`;
    const dirtyPool = new Pool({ connectionString: url.toString(), max: 2 });
    try {
      const migrations = await loadMigrations();
      await applyMigrationSet(dirtyPool, migrations.slice(0, 11));
      await dirtyPool.query('CREATE SCHEMA dirty_da3');
      await dirtyPool.query('GRANT USAGE ON SCHEMA dirty_da3 TO taptime_time_review_reader');
      await expect(applyMigrationSet(dirtyPool, migrations.slice(11)))
        .rejects.toMatchObject({ code: '42501' });
      const state = await dirtyPool.query<{ ledger: number; relation: string | null }>(`
        SELECT
          (SELECT count(*)::integer FROM ${B3_MIGRATION_TABLE} WHERE version = '012') AS ledger,
          to_regclass('taptime_server.time_record_revisions')::text AS relation
      `);
      expect(state.rows[0]).toEqual({ ledger: 0, relation: null });
    } finally {
      await closePoolAndDropTestDatabase({
        targetPool: dirtyPool,
        installerPool,
        databaseName: database,
      });
    }
  }, 30_000);

  it('upgrades existing invitation and enrollment logins inside migration 016', async () => {
    const database = 'taptime_016_upgrade_check';
    const probe = 'taptime_016_upgrade_probe';
    await dropProbeRole(probe);
    await installerPool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await installerPool.query(`CREATE DATABASE ${database}`);
    const url = new URL(installerConnectionString);
    url.pathname = `/${database}`;
    const upgradePool = new Pool({ connectionString: url.toString(), max: 2 });
    try {
      const migrations = await loadMigrations();
      await applyMigrationSet(upgradePool, migrations.slice(0, 15));
      await installerPool.query(`CREATE ROLE ${probe} LOGIN NOINHERIT`);
      await installerPool.query(
        `GRANT taptime_employee_invitation_creator,
               taptime_employee_enrollment_redeemer TO ${probe}`,
      );
      const client = await upgradePool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migrations[15]!.sql);
        const roles = await client.query<{ role_name: string }>(`
          SELECT parent.rolname AS role_name
          FROM pg_catalog.pg_auth_members AS edge
          JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
          JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
          WHERE member.rolname = '${probe}'
          ORDER BY parent.rolname
        `);
        expect(roles.rows.map((row) => row.role_name)).toEqual([
          'taptime_membership_enrollment_redeemer',
          'taptime_membership_manager',
          'taptime_password_reset_auditor',
        ]);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } finally {
      await closePoolAndDropTestDatabase({
        targetPool: upgradePool,
        installerPool,
        databaseName: database,
      });
      await dropProbeRole(probe);
    }
  }, 30_000);

  it('rejects pre-existing T-009 role ACL contamination atomically', async () => {
    const database = 'taptime_016_dirty_check';
    await installerPool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await installerPool.query(`CREATE DATABASE ${database}`);
    const url = new URL(installerConnectionString);
    url.pathname = `/${database}`;
    const dirtyPool = new Pool({ connectionString: url.toString(), max: 2 });
    try {
      const migrations = await loadMigrations();
      await applyMigrationSet(dirtyPool, migrations.slice(0, 15));
      await dirtyPool.query('CREATE SCHEMA dirty_t009');
      await dirtyPool.query('GRANT USAGE ON SCHEMA dirty_t009 TO taptime_membership_manager');
      const client = await dirtyPool.connect();
      try {
        await client.query('BEGIN');
        await expect(client.query(migrations[15]!.sql)).rejects.toMatchObject({ code: '42501' });
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
      const state = await dirtyPool.query<{ relation: string | null }>(`
        SELECT to_regclass('taptime_server.membership_management_command_receipts')::text
          AS relation
      `);
      expect(state.rows[0]).toEqual({ relation: null });
    } finally {
      await closePoolAndDropTestDatabase({
        targetPool: dirtyPool,
        installerPool,
        databaseName: database,
      });
    }
  }, 30_000);

  it('contains exactly the thirty-two approved tables and two effective-record views', async () => {
    const result = await installerPool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [B3_SCHEMA],
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'admin_break_tag_command_receipts',
      'admin_setup_command_receipts',
      'audit_events',
      'bootstrap_receipts',
      'break_intervals',
      'canonical_decisions',
      'customers',
      'effective_time_records_v1',
      'effective_time_records_v2',
      'employee_enrollment_redemption_receipts',
      'employee_invitation_command_receipts',
      'employee_membership_invitations',
      'identity_bindings',
      'membership_management_command_receipts',
      'memberships',
      'nfc_assignments',
      'nfc_tags',
      'offline_capture_lease_items',
      'offline_capture_lease_receipts',
      'offline_capture_leases',
      'offline_event_reconciliations',
      'offline_installations',
      'offline_review_adjudications',
      'offline_sync_cursors',
      'organizations',
      'project_command_receipts',
      'projects',
      'sync_receipts',
      'time_entries',
      'time_record_revisions',
      'time_review_command_receipts',
      'users',
      'work_events',
      'work_targets',
    ]);
  });

  it('enables and forces RLS on every logical table', async () => {
    const result = await installerPool.query<{ count: string }>(`
      SELECT count(*)
      FROM pg_class AS relation
      JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = '${B3_SCHEMA}'
        AND relation.relkind = 'r'
        AND relation.relrowsecurity
        AND relation.relforcerowsecurity
    `);
    expect(result.rows[0]?.count).toBe('32');
  });
});

describe('B3 least-privilege roles and request context', () => {
  it('pins the T-009 role graph, function ownership and capability ACLs', async () => {
    const roleNames = [
      'taptime_membership_enrollment_redeemer',
      'taptime_membership_manager',
      'taptime_membership_management_function_owner',
      'taptime_membership_redemption_function_owner',
      'taptime_password_reset_auditor',
      'taptime_people_audit_function_owner',
    ];
    const roles = await installerPool.query<{
      rolname: string; rolcanlogin: boolean; rolsuper: boolean; rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>(`
      SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolbypassrls
      FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname
    `, [roleNames]);
    expect(roles.rows).toEqual([
      { rolname: 'taptime_membership_enrollment_redeemer', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: false },
      { rolname: 'taptime_membership_management_function_owner', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: true },
      { rolname: 'taptime_membership_manager', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: false },
      { rolname: 'taptime_membership_redemption_function_owner', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: true },
      { rolname: 'taptime_password_reset_auditor', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: false },
      { rolname: 'taptime_people_audit_function_owner', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: true },
    ]);

    const graph = await installerPool.query<{ child: string; parent: string }>(`
      SELECT member.rolname AS child, parent.rolname AS parent
      FROM pg_catalog.pg_auth_members AS edge
      JOIN pg_catalog.pg_roles AS member ON member.oid = edge.member
      JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
      WHERE member.rolname = ANY($1::text[])
    `, [roleNames]);
    expect(graph.rows).toEqual([]);

    const directTablePrivileges = await installerPool.query<{ count: string }>(`
      SELECT count(*)
      FROM unnest(ARRAY[
        'taptime_membership_manager',
        'taptime_membership_enrollment_redeemer',
        'taptime_password_reset_auditor'
      ]) AS capability(role_name)
      CROSS JOIN pg_catalog.pg_class AS relation
      JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = '${B3_SCHEMA}' AND relation.relkind IN ('r', 'p', 'v', 'm')
        AND (
          has_table_privilege(capability.role_name, relation.oid,
            'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege(capability.role_name, relation.oid,
            'SELECT,INSERT,UPDATE,REFERENCES')
        )
    `);
    expect(directTablePrivileges.rows[0]?.count).toBe('0');

    const functionPrivileges = await installerPool.query<{
      role_name: string; signature: string;
    }>(`
      SELECT role_name, signature
      FROM unnest(ARRAY[
        'taptime_membership_manager',
        'taptime_membership_enrollment_redeemer',
        'taptime_password_reset_auditor'
      ]) AS capability(role_name)
      CROSS JOIN unnest(ARRAY[
        'taptime_server.create_membership_invitation_v2(uuid,uuid,text,text,bytea)',
        'taptime_server.read_managed_memberships_v1(uuid,integer)',
        'taptime_server.manage_membership_v1(uuid,uuid,bigint,text,text)',
        'taptime_server.redeem_membership_invitation_v2(uuid,bytea,text,text,uuid,uuid,uuid)',
        'taptime_server.record_password_reset_completed_v1()'
      ]) AS entry(signature)
      WHERE has_function_privilege(role_name, signature, 'EXECUTE')
      ORDER BY role_name, signature
    `);
    expect(functionPrivileges.rows).toEqual([
      {
        role_name: 'taptime_membership_enrollment_redeemer',
        signature: 'taptime_server.redeem_membership_invitation_v2(uuid,bytea,text,text,uuid,uuid,uuid)',
      },
      {
        role_name: 'taptime_membership_manager',
        signature: 'taptime_server.create_membership_invitation_v2(uuid,uuid,text,text,bytea)',
      },
      {
        role_name: 'taptime_membership_manager',
        signature: 'taptime_server.manage_membership_v1(uuid,uuid,bigint,text,text)',
      },
      {
        role_name: 'taptime_membership_manager',
        signature: 'taptime_server.read_managed_memberships_v1(uuid,integer)',
      },
      {
        role_name: 'taptime_password_reset_auditor',
        signature: 'taptime_server.record_password_reset_completed_v1()',
      },
    ]);
  });

  it('keeps DA3 application roles non-login/non-bypass and isolates BYPASSRLS to function owners', async () => {
    const roles = await installerPool.query<{
      rolname: string; rolcanlogin: boolean; rolsuper: boolean;
      rolcreaterole: boolean; rolbypassrls: boolean;
    }>(`SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolbypassrls
        FROM pg_catalog.pg_roles
        WHERE rolname IN (
          'taptime_time_review_reader', 'taptime_time_review_writer',
          'taptime_time_review_read_function_owner',
          'taptime_time_review_write_function_owner'
        ) ORDER BY rolname`);
    expect(roles.rows).toEqual([
      { rolname: 'taptime_time_review_read_function_owner', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: true },
      { rolname: 'taptime_time_review_reader', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: false },
      { rolname: 'taptime_time_review_write_function_owner', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: true },
      { rolname: 'taptime_time_review_writer', rolcanlogin: false,
        rolsuper: false, rolcreaterole: false, rolbypassrls: false },
    ]);
  });
  it('keeps application roles NOLOGIN, non-owner, non-superuser and without BYPASSRLS', async () => {
    const result = await installerPool.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>(`
      SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
      FROM pg_roles
      WHERE rolname IN ('${B3_EMPLOYEE_ROLE}', '${B3_ADMIN_ROLE}', '${B3_LIFECYCLE_ROLE}')
      ORDER BY rolname
    `);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((row) => !row.rolcanlogin && !row.rolsuper && !row.rolcreatedb
      && !row.rolcreaterole && !row.rolbypassrls)).toBe(true);
  });

  it('gives every synthetic login exactly its intended Application Role', async () => {
    const result = await installerPool.query<{ login: string; roles: string[] }>(`
      SELECT login.rolname AS login, json_agg(granted.rolname ORDER BY granted.rolname) AS roles
      FROM pg_auth_members AS membership
      JOIN pg_roles AS login ON login.oid = membership.member
      JOIN pg_roles AS granted ON granted.oid = membership.roleid
      WHERE login.rolname IN (
        'taptime_b3_employee_test_login',
        'taptime_b3_administrator_test_login',
        'taptime_b3_lifecycle_test_login'
      )
      GROUP BY login.rolname
      ORDER BY login.rolname
    `);
    expect(result.rows).toEqual([
      { login: 'taptime_b3_administrator_test_login', roles: [B3_ADMIN_ROLE] },
      { login: 'taptime_b3_employee_test_login', roles: [B3_EMPLOYEE_ROLE] },
      { login: 'taptime_b3_lifecycle_test_login', roles: [B3_LIFECYCLE_ROLE] },
    ]);
  });

  it('rejects local socket URLs for runtime security pools', () => {
    expect(() => runtimeConnectionString('postgresql:///taptime_b3', 'employee', runtimePassword)).toThrow(
      'explicit host',
    );
  });

  it('executes every Runtime query with the expected session_user and effective role', async () => {
    const results = await Promise.all([
      employeeQuery<{ session_user: string; current_user: string }>(
        employeeAContext,
        'SELECT session_user, current_user',
      ),
      adminQuery<{ session_user: string; current_user: string }>(
        adminAContext,
        'SELECT session_user, current_user',
      ),
      lifecycleQuery<{ session_user: string; current_user: string }>(
        employeeAContext,
        'SELECT session_user, current_user',
      ),
    ]);
    expect(results.map((result) => result.rows[0])).toEqual([
      { session_user: 'taptime_b3_employee_test_login', current_user: B3_EMPLOYEE_ROLE },
      { session_user: 'taptime_b3_administrator_test_login', current_user: B3_ADMIN_ROLE },
      { session_user: 'taptime_b3_lifecycle_test_login', current_user: B3_LIFECYCLE_ROLE },
    ]);
  });

  it('prevents an Employee login from escalating to Administrator', async () => {
    const client = await employeePool.connect();
    try {
      await client.query('BEGIN');
      expect(await postgresErrorCode(client.query(`SET LOCAL ROLE ${B3_ADMIN_ROLE}`))).toBe('42501');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('provides no direct table access after RESET ROLE', async () => {
    const client = await employeePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${B3_EMPLOYEE_ROLE}`);
      await client.query('RESET ROLE');
      expect(await postgresErrorCode(client.query(`SELECT * FROM ${B3_SCHEMA}.organizations`))).toBe('42501');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('returns no tenant rows when request context is missing', async () => {
    const result = await employeeQuery({}, `SELECT id FROM ${B3_SCHEMA}.organizations`);
    expect(result.rows).toEqual([]);
  });

  it('rejects malformed UUID request context rather than widening access', async () => {
    expect(
      await postgresErrorCode(
        employeeQuery(
          { organizationId: 'not-a-uuid', userId: ids.employeeA },
          `SELECT id FROM ${B3_SCHEMA}.organizations`,
        ),
      ),
    ).toBe('22P02');
  });

  it('clears transaction-local context and role after commit and connection reuse', async () => {
    await employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.organizations`);
    const result = await employeePool.query<{ clean: boolean }>(`
      SELECT
        NULLIF(current_setting('app.organization_id', true), '') IS NULL
        AND NULLIF(current_setting('app.user_id', true), '') IS NULL
        AND NULLIF(current_setting('app.correlation_id', true), '') IS NULL
        AND current_user = 'taptime_b3_employee_test_login' AS clean
    `);
    expect(result.rows[0]?.clean).toBe(true);
  });

  it('clears transaction-local context and role after rollback and connection reuse', async () => {
    await expect(
      withRequestTransaction(employeePool, B3_EMPLOYEE_ROLE, employeeAContext, async () => {
        throw new Error('synthetic rollback');
      }),
    ).rejects.toThrow('synthetic rollback');
    const result = await employeePool.query<{ clean: boolean }>(`
      SELECT
        NULLIF(current_setting('app.organization_id', true), '') IS NULL
        AND NULLIF(current_setting('app.user_id', true), '') IS NULL
        AND NULLIF(current_setting('app.correlation_id', true), '') IS NULL
        AND current_user = 'taptime_b3_employee_test_login' AS clean
    `);
    expect(result.rows[0]?.clean).toBe(true);
  });

  it('does not grant runtime roles schema, role or policy administration', async () => {
    expect(
      await postgresErrorCode(
        adminQuery(adminAContext, `CREATE TABLE ${B3_SCHEMA}.forbidden_runtime_ddl (id integer)`),
      ),
    ).toBe('42501');
  });

  it('keeps the administrative audit SECURITY DEFINER function fixed-path and trigger-only', async () => {
    const result = await installerPool.query<{
      security_definer: boolean;
      configuration: string[];
      administrator_can_execute: boolean;
    }>(`
      SELECT procedure.prosecdef AS security_definer,
        array_to_json(procedure.proconfig) AS configuration,
        has_function_privilege(
          '${B3_ADMIN_ROLE}',
          '${B3_SCHEMA}.append_administrative_audit_event()',
          'EXECUTE'
        ) AS administrator_can_execute
      FROM pg_proc AS procedure
      JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = '${B3_SCHEMA}'
        AND procedure.proname = 'append_administrative_audit_event'
    `);
    expect(result.rows[0]).toEqual({
      security_definer: true,
      configuration: ['search_path=pg_catalog, taptime_server'],
      administrator_can_execute: false,
    });
  });

  it('keeps the Decision validator invoker-scoped and unavailable as a direct Runtime function', async () => {
    const result = await installerPool.query<{
      security_definer: boolean;
      lifecycle_can_execute: boolean;
    }>(`
      SELECT procedure.prosecdef AS security_definer,
        has_function_privilege(
          '${B3_LIFECYCLE_ROLE}',
          '${B3_SCHEMA}.validate_canonical_decision_result()',
          'EXECUTE'
        ) AS lifecycle_can_execute
      FROM pg_proc AS procedure
      JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = '${B3_SCHEMA}'
        AND procedure.proname = 'validate_canonical_decision_result'
    `);
    expect(result.rows[0]).toEqual({
      security_definer: false,
      lifecycle_can_execute: false,
    });
  });
});

describe('B3 Employee and Administrator RLS matrix', () => {
  it('lets an Employee read only minimal active configuration and own authorization/lifecycle state', async () => {
    const counts = await Promise.all([
      employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.organizations`),
      employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.memberships`),
      employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.customers`),
      employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.nfc_tags`),
      employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.nfc_assignments`),
      employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.time_entries`),
      employeeQuery(employeeAContext, `SELECT work_event_id FROM ${B3_SCHEMA}.sync_receipts`),
    ]);
    expect(counts.map((result) => result.rowCount)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('hides another Employee in the same Organization', async () => {
    const timeEntries = await employeeQuery<{ id: string }>(
      employeeAContext,
      `SELECT id FROM ${B3_SCHEMA}.time_entries ORDER BY id`,
    );
    const receipts = await employeeQuery<{ work_event_id: string }>(
      employeeAContext,
      `SELECT work_event_id FROM ${B3_SCHEMA}.sync_receipts`,
    );
    expect(timeEntries.rows).toEqual([{ id: ids.timeEntryA }]);
    expect(receipts.rows).toEqual([{ work_event_id: ids.eventA }]);
  });

  it('hides all cross-tenant rows and guessed identifiers from an Employee', async () => {
    const result = await employeeQuery(
      employeeAContext,
      `SELECT id FROM ${B3_SCHEMA}.time_entries WHERE id IN ($1, $2)`,
      [ids.timeEntryA2, ids.timeEntryB],
    );
    expect(result.rows).toEqual([]);
  });

  it('denies Employee administration writes', async () => {
    expect(
      await postgresErrorCode(
        employeeQuery(employeeAContext, `UPDATE ${B3_SCHEMA}.customers SET row_version = 2 WHERE id = $1`, [ids.customerA]),
      ),
    ).toBe('42501');
  });

  it('denies Employee reads and direct mutation of authoritative WorkEvents', async () => {
    expect(
      await postgresErrorCode(employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.work_events`)),
    ).toBe('42501');
    expect(
      await postgresErrorCode(
        employeeQuery(employeeAContext, `INSERT INTO ${B3_SCHEMA}.work_events (id) VALUES ($1)`, [ids.eventA]),
      ),
    ).toBe('42501');
  });

  it('lets an Administrator read Organization-wide evidence including multiple Users', async () => {
    const results = await Promise.all([
      adminQuery(adminAContext, `SELECT id FROM ${B3_SCHEMA}.work_events`),
      adminQuery(adminAContext, `SELECT id FROM ${B3_SCHEMA}.time_entries`),
      adminQuery(adminAContext, `SELECT work_event_id FROM ${B3_SCHEMA}.canonical_decisions`),
      adminQuery(adminAContext, `SELECT id FROM ${B3_SCHEMA}.audit_events`),
    ]);
    expect(results.map((result) => result.rowCount)).toEqual([2, 2, 2, 1]);
  });

  it.each([
    ['INSERT', `INSERT INTO ${B3_SCHEMA}.customers
      (id, organization_id, active, display_name)
      SELECT '20000000-0000-4000-8000-000000000099', '${ids.organizationA}',
        true, 'Forbidden Administrator Insert'
      WHERE false`],
    ['UPDATE', `UPDATE ${B3_SCHEMA}.organizations SET name = name WHERE false`],
    ['DELETE', `DELETE FROM ${B3_SCHEMA}.customers WHERE false`],
  ])('denies obsolete Administrator %s privileges', async (_operation, statement) => {
    expect(await postgresErrorCode(adminQuery(adminAContext, statement))).toBe('42501');
  });

  it('blocks Administrator SELECT/UPDATE/DELETE against another Organization without disclosure', async () => {
    const selected = await adminQuery(adminAContext, `SELECT id FROM ${B3_SCHEMA}.customers WHERE id = $1`, [ids.customerB]);
    const guessedUser = await adminQuery(adminAContext, `SELECT id FROM ${B3_SCHEMA}.users WHERE id = $1`, [ids.employeeB]);
    expect([selected.rowCount, guessedUser.rowCount]).toEqual([0, 0]);
    expect(await postgresErrorCode(
      adminQuery(adminAContext, `UPDATE ${B3_SCHEMA}.customers SET row_version = 2 WHERE id = $1`, [ids.customerB]),
    )).toBe('42501');
    expect(await postgresErrorCode(
      adminQuery(adminAContext, `DELETE FROM ${B3_SCHEMA}.customers WHERE id = $1`, [ids.customerB]),
    )).toBe('42501');
  });

  it('rejects an Administrator cross-tenant INSERT after write revocation', async () => {
    expect(
      await postgresErrorCode(
        adminQuery(
          adminAContext,
          `INSERT INTO ${B3_SCHEMA}.customers
            (id, organization_id, display_name, active, activated_at) VALUES
            ('20000000-0000-4000-8000-000000000099', $1,
             'Synthetic Cross Tenant Customer', true, transaction_timestamp())`,
          [ids.organizationB],
        ),
      ),
    ).toBe('42501');
  });

  it('denies Administrator direct authoritative lifecycle mutation', async () => {
    expect(
      await postgresErrorCode(
        adminQuery(adminAContext, `UPDATE ${B3_SCHEMA}.time_entries SET row_version = 2 WHERE id = $1`, [ids.timeEntryA]),
      ),
    ).toBe('42501');
  });
});

describe('B3 lifecycle role, immutability and User isolation', () => {
  it('lets Lifecycle read only the contextual User and tenant configuration required for future B6', async () => {
    const ownEntries = await lifecycleQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.time_entries`);
    const otherEntries = await lifecycleQuery(employeeA2Context, `SELECT id FROM ${B3_SCHEMA}.time_entries`);
    const tenantAssignments = await lifecycleQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.nfc_assignments`);
    expect(ownEntries.rows).toEqual([{ id: ids.timeEntryA }]);
    expect(otherEntries.rows).toEqual([{ id: ids.timeEntryA2 }]);
    expect(tenantAssignments.rowCount).toBe(1);
  });

  it('rejects Lifecycle cross-tenant INSERT through RLS', async () => {
    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.audit_events
            (id, organization_id, actor_user_id, event_type, entity_type, entity_id,
             occurred_at, correlation_id, payload)
           VALUES ('70000000-0000-4000-8000-000000000099', $1, $2, 'Forbidden', 'WorkEvent', $3,
             transaction_timestamp(), 'forbidden', '{}')`,
          [ids.organizationB, ids.employeeA, ids.eventA],
        ),
      ),
    ).toBe('42501');
  });

  it('rejects a TimeEntry using another User start WorkEvent with 23503', async () => {
    expect(
      await postgresErrorCode(
        lifecycleQuery(
          adminAContext,
          `INSERT INTO ${B3_SCHEMA}.time_entries
            (id, organization_id, user_id, target_type, target_customer_id, status,
             start_work_event_id, started_at)
           VALUES ('60000000-0000-4000-8000-000000000099', $1, $2, 'customer', $3,
             'started', $4, '2026-07-13T08:00:00Z')`,
          [ids.organizationA, ids.adminA, ids.customerA, ids.eventA2],
        ),
      ),
    ).toBe('23503');
  });

  it('rejects stopping a TimeEntry with another User WorkEvent as 23503 and preserves active state', async () => {
    const code = await postgresErrorCode(
      lifecycleQuery(
        employeeAContext,
        `UPDATE ${B3_SCHEMA}.time_entries
         SET status = 'stopped', stop_work_event_id = $1, stopped_at = '2026-07-13T09:00:00Z', row_version = 2
         WHERE id = $2`,
        [ids.eventA2, ids.timeEntryA],
      ),
    );
    const persisted = await installerPool.query<{ status: string; stop_work_event_id: string | null }>(
      `SELECT status, stop_work_event_id FROM ${B3_SCHEMA}.time_entries WHERE id = $1`,
      [ids.timeEntryA],
    );
    expect(code).toBe('23503');
    expect(persisted.rows[0]).toEqual({ status: 'started', stop_work_event_id: null });
  });

  it('rejects Decision, Receipt and Audit references to another same-Organization User as 23503', async () => {
    const otherUserEventId = '50000000-0000-4000-8000-000000000098';
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm, content_hash_version)
       SELECT $1, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, repeat('b', 64), 'sha256', 1
       FROM ${B3_SCHEMA}.work_events WHERE id = $2`,
      [otherUserEventId, ids.eventA2],
    );
    const decisionCode = await postgresErrorCode(
      lifecycleQuery(
        employeeAContext,
        `INSERT INTO ${B3_SCHEMA}.canonical_decisions
          (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
           decision_type, time_entry_id, engine_version, decision_payload)
         VALUES ($1, $2, $3, 'customer', $4, 'time_entry_started', $5, 'core-test', '{}')`,
        [otherUserEventId, ids.organizationA, ids.employeeA, ids.customerA, ids.timeEntryA],
      ),
    );
    const receiptCode = await postgresErrorCode(
      lifecycleQuery(
        employeeAContext,
        `INSERT INTO ${B3_SCHEMA}.sync_receipts
          (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
           attempt_number, status)
         VALUES ('65000000-0000-4000-8000-000000000098', $1, $2, $3, 'customer', $4, 1, 'received')`,
        [otherUserEventId, ids.organizationA, ids.employeeA, ids.customerA],
      ),
    );
    const auditCode = await postgresErrorCode(
      lifecycleQuery(
        employeeAContext,
        `INSERT INTO ${B3_SCHEMA}.audit_events
          (id, organization_id, actor_user_id, work_event_user_id, work_event_id,
           event_type, entity_type, entity_id, occurred_at, correlation_id, payload)
         VALUES ('70000000-0000-4000-8000-000000000099', $1, $2, $2, $3,
           'ForbiddenReference', 'WorkEvent', $3, transaction_timestamp(), 'cross-user', '{}')`,
        [ids.organizationA, ids.employeeA, otherUserEventId],
      ),
    );
    expect([decisionCode, receiptCode, auditCode]).toEqual(['23503', '23503', '23503']);
  });

  it('rejects Decision and Receipt references to another User TimeEntry as 23503', async () => {
    const eventId = '50000000-0000-4000-8000-000000000099';
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.work_events
        (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm, content_hash_version)
       SELECT $1, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
         $2, occurred_at, repeat('a', 64), 'sha256', 1
       FROM ${B3_SCHEMA}.work_events WHERE id = $3`,
      [eventId, ids.employeeA, ids.eventA],
    );
    const decisionCode = await postgresErrorCode(
      lifecycleQuery(
        employeeAContext,
        `INSERT INTO ${B3_SCHEMA}.canonical_decisions
          (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
           decision_type, time_entry_id, engine_version, decision_payload)
         VALUES ($1, $2, $3, 'customer', $4, 'time_entry_started', $5, 'core-test', '{}')`,
        [eventId, ids.organizationA, ids.employeeA, ids.customerA, ids.timeEntryA2],
      ),
    );
    const receiptCode = await postgresErrorCode(
      lifecycleQuery(
        employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.sync_receipts
            (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
             attempt_number, status, server_decision_work_event_id, server_time_entry_id)
           VALUES ('65000000-0000-4000-8000-000000000099', $1, $2, $3,
             'customer', $4, 1, 'synchronized', $1, $5)`,
        [eventId, ids.organizationA, ids.employeeA, ids.customerA, ids.timeEntryA2],
      ),
    );
    expect([decisionCode, receiptCode]).toEqual(['23503', '23503']);
  });

  it('denies UPDATE and DELETE for every immutable evidence table and preserves rows', async () => {
    const operations = [
      ['work_events', 'received_at = received_at'],
      ['canonical_decisions', 'engine_version = engine_version'],
      ['sync_receipts', 'attempt_number = attempt_number'],
      ['audit_events', 'event_type = event_type'],
    ] as const;
    for (const [table, assignment] of operations) {
      expect(
        await postgresErrorCode(lifecycleQuery(employeeAContext, `UPDATE ${B3_SCHEMA}.${table} SET ${assignment}`)),
      ).toBe('42501');
      expect(
        await postgresErrorCode(lifecycleQuery(employeeAContext, `DELETE FROM ${B3_SCHEMA}.${table}`)),
      ).toBe('42501');
    }
    const counts = await installerPool.query<{ table_name: string; count: string }>(`
      SELECT 'work_events' AS table_name, count(*)::text AS count FROM ${B3_SCHEMA}.work_events
      UNION ALL SELECT 'canonical_decisions', count(*)::text FROM ${B3_SCHEMA}.canonical_decisions
      UNION ALL SELECT 'sync_receipts', count(*)::text FROM ${B3_SCHEMA}.sync_receipts
      UNION ALL SELECT 'audit_events', count(*)::text FROM ${B3_SCHEMA}.audit_events
      ORDER BY table_name
    `);
    expect(counts.rows).toEqual([
      { table_name: 'audit_events', count: '2' },
      { table_name: 'canonical_decisions', count: '3' },
      { table_name: 'sync_receipts', count: '3' },
      { table_name: 'work_events', count: '3' },
    ]);
  });

  it('also denies immutable mutation to Administrator', async () => {
    expect(
      await postgresErrorCode(adminQuery(adminAContext, `UPDATE ${B3_SCHEMA}.work_events SET received_at = received_at`)),
    ).toBe('42501');
    expect(
      await postgresErrorCode(adminQuery(adminAContext, `DELETE FROM ${B3_SCHEMA}.audit_events`)),
    ).toBe('42501');
  });
});

describe('B3 revoked-Membership lifecycle boundary', () => {
  it('preserves WorkEvent evidence received after Membership revocation', async () => {
    const eventId = '50000000-0000-4000-8000-000000000091';
    await revokeMembership(ids.employeeA);

    await expect(insertLifecycleWorkEvent(eventId)).resolves.toBeUndefined();

    const evidence = await installerPool.query<{ id: string }>(
      `SELECT id FROM ${B3_SCHEMA}.work_events WHERE id = $1`,
      [eventId],
    );
    expect(evidence.rows).toEqual([{ id: eventId }]);
  });

  it('rejects TimeEntry INSERT after Membership revocation', async () => {
    const eventId = '50000000-0000-4000-8000-000000000092';
    await revokeMembership(ids.employeeA);
    await insertLifecycleWorkEvent(eventId);

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.time_entries
            (id, organization_id, user_id, target_type, target_customer_id, status,
             start_work_event_id, started_at, stop_work_event_id, stopped_at)
           VALUES ('60000000-0000-4000-8000-000000000092', $1, $2, 'customer', $3,
             'stopped', $4, '2026-07-13T10:00:00Z', $4, '2026-07-13T10:00:01Z')`,
          [ids.organizationA, ids.employeeA, ids.customerA, eventId],
        ),
      ),
    ).toBe('42501');
  });

  it('cannot stop an existing TimeEntry after Membership revocation', async () => {
    const eventId = '50000000-0000-4000-8000-000000000093';
    await revokeMembership(ids.employeeA);
    await insertLifecycleWorkEvent(eventId);

    const update = await lifecycleQuery(
      employeeAContext,
      `UPDATE ${B3_SCHEMA}.time_entries
       SET status = 'stopped', stop_work_event_id = $1,
         stopped_at = '2026-07-13T10:00:01Z', row_version = row_version + 1
       WHERE id = $2`,
      [eventId, ids.timeEntryA],
    );
    const persisted = await installerPool.query<{ status: string; stop_work_event_id: string | null }>(
      `SELECT status, stop_work_event_id FROM ${B3_SCHEMA}.time_entries WHERE id = $1`,
      [ids.timeEntryA],
    );
    expect(update.rowCount).toBe(0);
    expect(persisted.rows[0]).toEqual({ status: 'started', stop_work_event_id: null });
  });

  it('rejects a CanonicalDecision linked to a TimeEntry after Membership revocation', async () => {
    const eventId = '50000000-0000-4000-8000-000000000094';
    await revokeMembership(ids.employeeA);
    await insertLifecycleWorkEvent(eventId);

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.canonical_decisions
            (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
             decision_type, time_entry_id, engine_version, decision_payload)
           VALUES ($1, $2, $3, 'customer', $4, 'time_entry_stopped', $5, 'core-test', '{}')`,
          [eventId, ids.organizationA, ids.employeeA, ids.customerA, ids.timeEntryA],
        ),
      ),
    ).toBe('42501');
    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.canonical_decisions
            (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
             decision_type, previous_work_event_id, engine_version, decision_payload)
           VALUES ($1, $2, $3, 'customer', $4, 'duplicate_scan_ignored', $5, 'core-test', '{}')`,
          [eventId, ids.organizationA, ids.employeeA, ids.customerA, ids.eventA],
        ),
      ),
    ).toBe('42501');
  });

  it('records deferred WorkEvent/Audit evidence without inventing a Core Decision or Receipt status', async () => {
    const eventId = '50000000-0000-4000-8000-000000000095';
    await revokeMembership(ids.employeeA);
    await insertLifecycleWorkEvent(eventId);
    await lifecycleQuery(
      employeeAContext,
      `INSERT INTO ${B3_SCHEMA}.audit_events
        (id, organization_id, actor_user_id, work_event_user_id, work_event_id,
         event_type, entity_type, entity_id, occurred_at, correlation_id, payload)
       VALUES ('70000000-0000-4000-8000-000000000095', $1, $2, $2, $3,
         'LifecycleDeferred', 'WorkEvent', $3, transaction_timestamp(), 'revoked-deferred', '{}')`,
      [ids.organizationA, ids.employeeA, eventId],
    );

    const result = await installerPool.query<{
      decision_count: string;
      receipt_count: string;
      audit_count: string;
      time_entry_status: string;
    }>(`
      SELECT
        (SELECT count(*) FROM ${B3_SCHEMA}.canonical_decisions WHERE work_event_id = $1) AS decision_count,
        (SELECT count(*) FROM ${B3_SCHEMA}.sync_receipts WHERE work_event_id = $1) AS receipt_count,
        (SELECT count(*) FROM ${B3_SCHEMA}.audit_events WHERE work_event_id = $1) AS audit_count,
        (SELECT status FROM ${B3_SCHEMA}.time_entries WHERE id = $2) AS time_entry_status
    `, [eventId, ids.timeEntryA]);
    expect(result.rows[0]).toEqual({
      decision_count: '0',
      receipt_count: '0',
      audit_count: '1',
      time_entry_status: 'started',
    });
  });

  it.each(['received', 'retryable_failure'] as const)(
    'rejects a no-Decision %s Receipt after Membership revocation',
    async (status) => {
      const eventId = '50000000-0000-4000-8000-000000000097';
      await revokeMembership(ids.employeeA);
      await insertLifecycleWorkEvent(eventId);

      expect(
        await postgresErrorCode(
          lifecycleQuery(
            employeeAContext,
            `INSERT INTO ${B3_SCHEMA}.sync_receipts
              (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
               attempt_number, status)
             VALUES ('65000000-0000-4000-8000-000000000097', $1, $2, $3,
               'customer', $4, 1, $5)`,
            [eventId, ids.organizationA, ids.employeeA, ids.customerA, status],
          ),
        ),
      ).toBe('42501');
    },
  );
});

describe('B3 AssignmentTarget-qualified lifecycle integrity', () => {
  it('rejects a TimeEntry whose start WorkEvent belongs to another target with 23503', async () => {
    const eventId = '50000000-0000-4000-8000-000000000096';
    await seedOtherTarget();
    await insertLifecycleWorkEvent(eventId, adminAContext, {
      assignmentId: otherTarget.assignmentId,
      tagId: otherTarget.tagId,
      customerId: otherTarget.customerId,
    });

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          adminAContext,
          `INSERT INTO ${B3_SCHEMA}.time_entries
            (id, organization_id, user_id, target_type, target_customer_id, status,
             start_work_event_id, started_at)
           VALUES ('60000000-0000-4000-8000-000000000096', $1, $2, 'customer', $3,
             'started', $4, '2026-07-13T10:00:00Z')`,
          [ids.organizationA, ids.adminA, ids.customerA, eventId],
        ),
      ),
    ).toBe('23503');
  });

  it('rejects stopping a TimeEntry with another-target WorkEvent and preserves it', async () => {
    const eventId = '50000000-0000-4000-8000-000000000097';
    await seedOtherTarget();
    await insertLifecycleWorkEvent(eventId, employeeAContext, {
      assignmentId: otherTarget.assignmentId,
      tagId: otherTarget.tagId,
      customerId: otherTarget.customerId,
    });

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `UPDATE ${B3_SCHEMA}.time_entries
           SET status = 'stopped', stop_work_event_id = $1,
             stopped_at = '2026-07-13T10:00:01Z', row_version = row_version + 1
           WHERE id = $2`,
          [eventId, ids.timeEntryA],
        ),
      ),
    ).toBe('23503');
    const persisted = await installerPool.query<{ status: string; stop_work_event_id: string | null }>(
      `SELECT status, stop_work_event_id FROM ${B3_SCHEMA}.time_entries WHERE id = $1`,
      [ids.timeEntryA],
    );
    expect(persisted.rows[0]).toEqual({ status: 'started', stop_work_event_id: null });
  });

  it('rejects a Decision linked to a TimeEntry of another target with 23503', async () => {
    const eventId = '50000000-0000-4000-8000-000000000098';
    await seedOtherTarget();
    await insertLifecycleWorkEvent(eventId, employeeAContext, {
      assignmentId: otherTarget.assignmentId,
      tagId: otherTarget.tagId,
      customerId: otherTarget.customerId,
    });

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.canonical_decisions
            (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
             decision_type, time_entry_id, engine_version, decision_payload)
           VALUES ($1, $2, $3, 'customer', $4, 'time_entry_stopped', $5, 'core-test', '{}')`,
          [eventId, ids.organizationA, ids.employeeA, otherTarget.customerId, ids.timeEntryA],
        ),
      ),
    ).toBe('23503');
  });

  it('rejects a Receipt linked to a TimeEntry outside its Decision target with 23503', async () => {
    const eventId = '50000000-0000-4000-8000-000000000099';
    await seedOtherTarget();
    await insertLifecycleWorkEvent(eventId, employeeAContext, {
      assignmentId: otherTarget.assignmentId,
      tagId: otherTarget.tagId,
      customerId: otherTarget.customerId,
    });
    await lifecycleQuery(
      employeeAContext,
      `INSERT INTO ${B3_SCHEMA}.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         decision_type, reason, engine_version, decision_payload)
       VALUES ($1, $2, $3, 'customer', $4, 'escalation_required',
         'previous_work_event_target_mismatch', 'core-test', '{}')`,
      [eventId, ids.organizationA, ids.employeeA, otherTarget.customerId],
    );

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.sync_receipts
            (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
             attempt_number, status, server_decision_work_event_id, server_time_entry_id)
           VALUES ('65000000-0000-4000-8000-000000000099', $1, $2, $3,
             'customer', $4, 1, 'synchronized', $1, $5)`,
          [eventId, ids.organizationA, ids.employeeA, otherTarget.customerId, ids.timeEntryA],
        ),
      ),
    ).toBe('23503');
  });

  it('rejects a same-target Receipt TimeEntry that is not the Decision TimeEntry with 23503', async () => {
    const unrelatedTimeEntryId = '60000000-0000-4000-8000-000000000089';
    const baselineStopEventId = '50000000-0000-4000-8000-000000000086';
    const unrelatedStartEventId = '50000000-0000-4000-8000-000000000087';
    const unrelatedStopEventId = '50000000-0000-4000-8000-000000000088';
    await insertLifecycleWorkEvent(baselineStopEventId);
    await persistStoppedTimeEntry({ eventId: baselineStopEventId, timeEntryId: ids.timeEntryA });
    await insertLifecycleWorkEvent(unrelatedStartEventId);
    await persistStartedTimeEntry({ eventId: unrelatedStartEventId, timeEntryId: unrelatedTimeEntryId });
    await insertLifecycleWorkEvent(unrelatedStopEventId);
    await persistStoppedTimeEntry({ eventId: unrelatedStopEventId, timeEntryId: unrelatedTimeEntryId });
    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.sync_receipts
            (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
             attempt_number, status, server_decision_work_event_id, server_time_entry_id)
           VALUES ('65000000-0000-4000-8000-000000000089', $1, $2, $3,
             'customer', $4, 2, 'synchronized', $1, $5)`,
          [ids.eventA, ids.organizationA, ids.employeeA, ids.customerA, unrelatedTimeEntryId],
        ),
      ),
    ).toBe('23503');
  });
});

describe('B3 truthful CanonicalDecision result mapping', () => {
  it('rejects a started TimeEntry without its same-transaction Start Decision', async () => {
    const eventId = '50000000-0000-4000-8000-000000000043';
    await insertLifecycleWorkEvent(eventId, adminAContext);

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          adminAContext,
          `INSERT INTO ${B3_SCHEMA}.time_entries
            (id, organization_id, user_id, target_type, target_customer_id, status,
             start_work_event_id, started_at)
           VALUES ('60000000-0000-4000-8000-000000000043', $1, $2, 'customer', $3,
             'started', $4, '2026-07-13T10:00:00Z')`,
          [ids.organizationA, ids.adminA, ids.customerA, eventId],
        ),
      ),
    ).toBe('23503');
  });

  it('rejects a directly inserted stopped TimeEntry even with matching Decisions in one transaction', async () => {
    const startEventId = '50000000-0000-4000-8000-000000000041';
    const stopEventId = '50000000-0000-4000-8000-000000000042';
    const timeEntryId = '60000000-0000-4000-8000-000000000041';
    await insertLifecycleWorkEvent(startEventId);
    await insertLifecycleWorkEvent(stopEventId);

    expect(
      await postgresErrorCode(
        withRequestTransaction(lifecyclePool, B3_LIFECYCLE_ROLE, employeeAContext, async (client) => {
          await query(
            client,
            `INSERT INTO ${B3_SCHEMA}.time_entries
              (id, organization_id, user_id, target_type, target_customer_id, status,
               start_work_event_id, started_at, stop_work_event_id, stopped_at)
             VALUES ($1, $2, $3, 'customer', $4, 'stopped', $5,
               '2026-07-13T10:00:00Z', $6, '2026-07-13T10:01:00Z')`,
            [timeEntryId, ids.organizationA, ids.employeeA, ids.customerA, startEventId, stopEventId],
          );
          await insertLifecycleDecision({
            eventId: startEventId,
            decisionType: 'time_entry_started',
            timeEntryId,
            client,
          });
          await insertLifecycleDecision({
            eventId: stopEventId,
            decisionType: 'time_entry_stopped',
            timeEntryId,
            client,
          });
        }),
      ),
    ).toBe('23514');
  });

  it('rejects reusing a Start WorkEvent for another TimeEntry', async () => {
    const stopEventId = '50000000-0000-4000-8000-000000000044';
    await insertLifecycleWorkEvent(stopEventId);
    await persistStoppedTimeEntry({ eventId: stopEventId, timeEntryId: ids.timeEntryA });

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.time_entries
            (id, organization_id, user_id, target_type, target_customer_id, status,
             start_work_event_id, started_at)
           VALUES ('60000000-0000-4000-8000-000000000044', $1, $2, 'customer', $3,
             'started', $4, '2026-07-13T10:02:00Z')`,
          [ids.organizationA, ids.employeeA, ids.customerA, ids.eventA],
        ),
      ),
    ).toBe('23503');
  });

  it('rejects reusing a Stop WorkEvent for another TimeEntry and preserves its active state', async () => {
    const sharedStopEventId = '50000000-0000-4000-8000-000000000045';
    const nextStartEventId = '50000000-0000-4000-8000-000000000046';
    const nextTimeEntryId = '60000000-0000-4000-8000-000000000046';
    await insertLifecycleWorkEvent(sharedStopEventId);
    await persistStoppedTimeEntry({ eventId: sharedStopEventId, timeEntryId: ids.timeEntryA });
    await insertLifecycleWorkEvent(nextStartEventId);
    await persistStartedTimeEntry({ eventId: nextStartEventId, timeEntryId: nextTimeEntryId });

    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `UPDATE ${B3_SCHEMA}.time_entries
           SET status = 'stopped', stop_work_event_id = $1,
             stopped_at = '2026-07-13T10:03:00Z', row_version = row_version + 1
           WHERE id = $2`,
          [sharedStopEventId, nextTimeEntryId],
        ),
      ),
    ).toBe('23503');
    const persisted = await installerPool.query<{ status: string; stop_work_event_id: string | null }>(
      `SELECT status, stop_work_event_id FROM ${B3_SCHEMA}.time_entries WHERE id = $1`,
      [nextTimeEntryId],
    );
    expect(persisted.rows[0]).toEqual({ status: 'started', stop_work_event_id: null });
  });

  it('rejects a stopped Decision while the referenced TimeEntry remains active', async () => {
    const eventId = '50000000-0000-4000-8000-000000000061';
    await insertLifecycleWorkEvent(eventId);

    expect(
      await postgresErrorCode(
        insertLifecycleDecision({
          eventId,
          decisionType: 'time_entry_stopped',
          timeEntryId: ids.timeEntryA,
        }),
      ),
    ).toBe('23514');
  });

  it('rejects a stopped Decision when another WorkEvent actually stopped the TimeEntry', async () => {
    const decisionEventId = '50000000-0000-4000-8000-000000000060';
    const actualStopEventId = '50000000-0000-4000-8000-000000000059';
    await insertLifecycleWorkEvent(decisionEventId);
    await insertLifecycleWorkEvent(actualStopEventId);
    await persistStoppedTimeEntry({ eventId: actualStopEventId, timeEntryId: ids.timeEntryA });

    expect(
      await postgresErrorCode(
        insertLifecycleDecision({
          eventId: decisionEventId,
          decisionType: 'time_entry_stopped',
          timeEntryId: ids.timeEntryA,
        }),
      ),
    ).toBe('23514');
  });

  it('rejects a started Decision for a TimeEntry started by another WorkEvent', async () => {
    const eventId = '50000000-0000-4000-8000-000000000062';
    await insertLifecycleWorkEvent(eventId);

    expect(
      await postgresErrorCode(
        insertLifecycleDecision({
          eventId,
          decisionType: 'time_entry_started',
          timeEntryId: ids.timeEntryA,
        }),
      ),
    ).toBe('23514');
  });

  it('rejects a started Decision when the referenced TimeEntry is already stopped', async () => {
    const stopEventId = '50000000-0000-4000-8000-000000000056';
    const candidateStartEventId = '50000000-0000-4000-8000-000000000058';
    await insertLifecycleWorkEvent(stopEventId);
    await insertLifecycleWorkEvent(candidateStartEventId);
    await persistStoppedTimeEntry({ eventId: stopEventId, timeEntryId: ids.timeEntryA });

    expect(
      await postgresErrorCode(
        insertLifecycleDecision({
          eventId: candidateStartEventId,
          decisionType: 'time_entry_started',
          timeEntryId: ids.timeEntryA,
        }),
      ),
    ).toBe('23514');
  });

  it('rejects another User TimeEntry even when it has the same target', async () => {
    const eventId = '50000000-0000-4000-8000-000000000063';
    await insertLifecycleWorkEvent(eventId);

    expect(
      await postgresErrorCode(
        insertLifecycleDecision({
          eventId,
          decisionType: 'time_entry_started',
          timeEntryId: ids.timeEntryA2,
        }),
      ),
    ).toBe('23503');
  });

  it('stores an other-target rejection with the actual active TimeEntry and can receipt it exactly', async () => {
    const eventId = '50000000-0000-4000-8000-000000000064';
    const receiptId = '65000000-0000-4000-8000-000000000064';
    await seedOtherTarget();
    await insertLifecycleWorkEvent(eventId, employeeAContext, {
      assignmentId: otherTarget.assignmentId,
      tagId: otherTarget.tagId,
      customerId: otherTarget.customerId,
    });
    await insertLifecycleDecision({
      eventId,
      decisionType: 'active_entry_for_other_target_rejected',
      activeTimeEntryId: ids.timeEntryA,
      targetCustomerId: otherTarget.customerId,
    });
    await insertLifecycleReceipt({
      id: receiptId,
      eventId,
      attemptNumber: 1,
      status: 'synchronized',
      decisionWorkEventId: eventId,
      serverTimeEntryId: ids.timeEntryA,
      targetCustomerId: otherTarget.customerId,
    });

    const result = await installerPool.query<{
      decision_type: string;
      time_entry_id: string;
      entry_status: string;
      decision_target: string;
      entry_target: string;
      receipt_time_entry_id: string;
    }>(`
      SELECT decision.decision_type, decision.active_time_entry_id AS time_entry_id,
        entry.status AS entry_status,
        decision.target_customer_id AS decision_target,
        entry.target_customer_id AS entry_target,
        receipt.server_time_entry_id AS receipt_time_entry_id
      FROM ${B3_SCHEMA}.canonical_decisions AS decision
      JOIN ${B3_SCHEMA}.time_entries AS entry ON entry.id = decision.active_time_entry_id
      JOIN ${B3_SCHEMA}.sync_receipts AS receipt
        ON receipt.server_decision_work_event_id = decision.work_event_id
      WHERE decision.work_event_id = $1
    `, [eventId]);
    expect(result.rows[0]).toEqual({
      decision_type: 'active_entry_for_other_target_rejected',
      time_entry_id: ids.timeEntryA,
      entry_status: 'started',
      decision_target: otherTarget.customerId,
      entry_target: ids.customerA,
      receipt_time_entry_id: ids.timeEntryA,
    });
  });

  it('rejects an other-target rejection when the referenced TimeEntry is already stopped', async () => {
    const stopEventId = '50000000-0000-4000-8000-000000000049';
    const rejectedEventId = '50000000-0000-4000-8000-000000000050';
    await insertLifecycleWorkEvent(stopEventId);
    await persistStoppedTimeEntry({ eventId: stopEventId, timeEntryId: ids.timeEntryA });
    await seedOtherTarget();
    await insertLifecycleWorkEvent(rejectedEventId, employeeAContext, {
      assignmentId: otherTarget.assignmentId,
      tagId: otherTarget.tagId,
      customerId: otherTarget.customerId,
    });

    expect(
      await postgresErrorCode(
        insertLifecycleDecision({
          eventId: rejectedEventId,
          decisionType: 'active_entry_for_other_target_rejected',
          activeTimeEntryId: ids.timeEntryA,
          targetCustomerId: otherTarget.customerId,
        }),
      ),
    ).toBe('23514');
  });

  it('rejects an other-target rejection linked to another User TimeEntry', async () => {
    const eventId = '50000000-0000-4000-8000-000000000048';
    await seedOtherTarget();
    await insertLifecycleWorkEvent(eventId, employeeAContext, {
      assignmentId: otherTarget.assignmentId,
      tagId: otherTarget.tagId,
      customerId: otherTarget.customerId,
    });

    expect(
      await postgresErrorCode(
        insertLifecycleDecision({
          eventId,
          decisionType: 'active_entry_for_other_target_rejected',
          activeTimeEntryId: ids.timeEntryA2,
          targetCustomerId: otherTarget.customerId,
        }),
      ),
    ).toBe('23503');
  });

  it.each([
    {
      label: 'time_entry_started without TimeEntry',
      decisionType: 'time_entry_started',
    },
    {
      label: 'time_entry_stopped without TimeEntry',
      decisionType: 'time_entry_stopped',
    },
    {
      label: 'duplicate_scan_ignored without Previous-WorkEvent',
      decisionType: 'duplicate_scan_ignored',
    },
    {
      label: 'duplicate_scan_ignored with a Reason',
      decisionType: 'duplicate_scan_ignored',
      reason: 'previous_work_event_target_mismatch',
      previousWorkEventId: ids.eventA,
    },
    {
      label: 'duplicate_scan_ignored referring to the current WorkEvent',
      decisionType: 'duplicate_scan_ignored',
      previousWorkEventId: 'current',
    },
    {
      label: 'active_entry_for_other_target_rejected without TimeEntry',
      decisionType: 'active_entry_for_other_target_rejected',
    },
    {
      label: 'active_entry_for_other_target_rejected with a same-target TimeEntry',
      decisionType: 'active_entry_for_other_target_rejected',
      activeTimeEntryId: ids.timeEntryA,
    },
    {
      label: 'escalation_required with a blank Reason',
      decisionType: 'escalation_required',
      reason: '   ',
    },
    {
      label: 'escalation_required with a non-Core Reason',
      decisionType: 'escalation_required',
      reason: 'membership_revoked_deferred',
    },
    {
      label: 'escalation_required with a TimeEntry relation',
      decisionType: 'escalation_required',
      reason: 'work_event_precedes_active_time_entry',
      timeEntryId: ids.timeEntryA,
    },
  ] satisfies ReadonlyArray<{
    label: string;
    decisionType: CanonicalDecisionType;
    reason?: string;
    timeEntryId?: string;
    activeTimeEntryId?: string;
    previousWorkEventId?: string;
  }>)('rejects invalid $label shape', async (testCase) => {
    const eventId = '50000000-0000-4000-8000-000000000065';
    await insertLifecycleWorkEvent(eventId);

    expect(
      await postgresErrorCode(
        insertLifecycleDecision({
          eventId,
          decisionType: testCase.decisionType,
          reason: testCase.reason,
          timeEntryId: testCase.timeEntryId,
          activeTimeEntryId: testCase.activeTimeEntryId,
          previousWorkEventId: testCase.previousWorkEventId === 'current'
            ? eventId
            : testCase.previousWorkEventId,
        }),
      ),
    ).toBe('23514');
  });

  it.each([
    'active_time_entry_organization_mismatch',
    'active_time_entry_user_mismatch',
    'previous_work_event_organization_mismatch',
    'previous_work_event_user_mismatch',
    'previous_work_event_target_mismatch',
    'work_event_precedes_active_time_entry',
    'work_event_precedes_previous_accepted_work_event',
  ] as const)('accepts the Core escalation Reason %s', async (reason) => {
    const eventId = '50000000-0000-4000-8000-000000000057';
    await insertLifecycleWorkEvent(eventId);
    await expect(
      insertLifecycleDecision({
        eventId,
        decisionType: 'escalation_required',
        reason,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects a start timestamp that differs from its WorkEvent and rolls back both result rows', async () => {
    const eventId = '50000000-0000-4000-8000-000000000101';
    const timeEntryId = '60000000-0000-4000-8000-000000000101';
    await insertLifecycleWorkEvent(eventId, adminAContext);

    expect(
      await postgresErrorCode(
        persistStartedTimeEntry({
          eventId,
          timeEntryId,
          context: adminAContext,
          startedAt: '1990-01-01T00:00:00Z',
        }),
      ),
    ).toBe('23514');

    const persisted = await installerPool.query<{
      time_entry_count: string;
      decision_count: string;
    }>(`
      SELECT
        (SELECT count(*) FROM ${B3_SCHEMA}.time_entries WHERE id = $1) AS time_entry_count,
        (SELECT count(*) FROM ${B3_SCHEMA}.canonical_decisions WHERE work_event_id = $2)
          AS decision_count
    `, [timeEntryId, eventId]);
    expect(persisted.rows[0]).toEqual({ time_entry_count: '0', decision_count: '0' });
  });

  it('rejects a stop timestamp that differs from its WorkEvent and preserves the active TimeEntry', async () => {
    const eventId = '50000000-0000-4000-8000-000000000102';
    await insertLifecycleWorkEvent(eventId);
    const before = await installerPool.query<{
      status: string;
      start_work_event_id: string;
      started_at: Date;
      stop_work_event_id: string | null;
      stopped_at: Date | null;
      row_version: string;
    }>(`
      SELECT status, start_work_event_id, started_at, stop_work_event_id, stopped_at, row_version
      FROM ${B3_SCHEMA}.time_entries
      WHERE id = $1
    `, [ids.timeEntryA]);

    expect(
      await postgresErrorCode(
        persistStoppedTimeEntry({
          eventId,
          timeEntryId: ids.timeEntryA,
          stoppedAt: '2099-01-01T00:00:00Z',
        }),
      ),
    ).toBe('23514');

    const after = await installerPool.query<{
      status: string;
      start_work_event_id: string;
      started_at: Date;
      stop_work_event_id: string | null;
      stopped_at: Date | null;
      row_version: string;
    }>(`
      SELECT status, start_work_event_id, started_at, stop_work_event_id, stopped_at, row_version
      FROM ${B3_SCHEMA}.time_entries
      WHERE id = $1
    `, [ids.timeEntryA]);
    const decisionCount = await installerPool.query<{ count: string }>(
      `SELECT count(*) FROM ${B3_SCHEMA}.canonical_decisions WHERE work_event_id = $1`,
      [eventId],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(after.rows[0]?.status).toBe('started');
    expect(decisionCount.rows[0]?.count).toBe('0');
  });

  it('treats equivalent timezone representations as the same start and stop instants', async () => {
    const startEventId = '50000000-0000-4000-8000-000000000103';
    const stopEventId = '50000000-0000-4000-8000-000000000104';
    const timeEntryId = '60000000-0000-4000-8000-000000000103';
    const target = {
      assignmentId: ids.assignmentA,
      tagId: ids.tagA,
      customerId: ids.customerA,
    };
    await insertLifecycleWorkEvent(
      startEventId,
      adminAContext,
      target,
      '2026-07-13T12:00:00+02:00',
    );
    await persistStartedTimeEntry({
      eventId: startEventId,
      timeEntryId,
      context: adminAContext,
      startedAt: '2026-07-13T05:00:00-05:00',
    });
    await insertLifecycleWorkEvent(
      stopEventId,
      adminAContext,
      target,
      '2026-07-13T13:00:00+02:00',
    );
    await persistStoppedTimeEntry({
      eventId: stopEventId,
      timeEntryId,
      context: adminAContext,
      stoppedAt: '2026-07-13T07:00:00-04:00',
    });

    const result = await installerPool.query<{
      start_timestamps_match: boolean;
      stop_timestamps_match: boolean;
    }>(`
      SELECT entry.started_at = start_event.occurred_at AS start_timestamps_match,
        entry.stopped_at = stop_event.occurred_at AS stop_timestamps_match
      FROM ${B3_SCHEMA}.time_entries AS entry
      JOIN ${B3_SCHEMA}.work_events AS start_event ON start_event.id = entry.start_work_event_id
      JOIN ${B3_SCHEMA}.work_events AS stop_event ON stop_event.id = entry.stop_work_event_id
      WHERE entry.id = $1
    `, [timeEntryId]);
    expect(result.rows[0]).toEqual({
      start_timestamps_match: true,
      stop_timestamps_match: true,
    });
  });

  it('accepts a truthful start Decision and synchronized Receipt', async () => {
    const eventId = '50000000-0000-4000-8000-000000000066';
    const timeEntryId = '60000000-0000-4000-8000-000000000066';
    await insertLifecycleWorkEvent(eventId, adminAContext);
    await persistStartedTimeEntry({ eventId, timeEntryId, context: adminAContext });
    await insertLifecycleReceipt({
      id: '65000000-0000-4000-8000-000000000066',
      eventId,
      attemptNumber: 1,
      status: 'synchronized',
      decisionWorkEventId: eventId,
      serverTimeEntryId: timeEntryId,
      context: adminAContext,
    });

    const result = await installerPool.query<{
      decision_type: string;
      status: string;
      timestamps_match: boolean;
    }>(`
      SELECT decision.decision_type, entry.status,
        entry.started_at = event.occurred_at AS timestamps_match
      FROM ${B3_SCHEMA}.canonical_decisions AS decision
      JOIN ${B3_SCHEMA}.time_entries AS entry ON entry.id = decision.time_entry_id
      JOIN ${B3_SCHEMA}.work_events AS event ON event.id = decision.work_event_id
      WHERE decision.work_event_id = $1
    `, [eventId]);
    expect(result.rows[0]).toEqual({
      decision_type: 'time_entry_started',
      status: 'started',
      timestamps_match: true,
    });
  });

  it('accepts a truthful stop Decision and synchronized Receipt', async () => {
    const eventId = '50000000-0000-4000-8000-000000000067';
    await insertLifecycleWorkEvent(eventId);
    await persistStoppedTimeEntry({ eventId, timeEntryId: ids.timeEntryA });
    await insertLifecycleReceipt({
      id: '65000000-0000-4000-8000-000000000067',
      eventId,
      attemptNumber: 1,
      status: 'synchronized',
      decisionWorkEventId: eventId,
      serverTimeEntryId: ids.timeEntryA,
    });

    const result = await installerPool.query<{
      decision_type: string;
      status: string;
      stop_work_event_id: string;
      timestamps_match: boolean;
    }>(`
      SELECT decision.decision_type, entry.status, entry.stop_work_event_id,
        entry.stopped_at = event.occurred_at AS timestamps_match
      FROM ${B3_SCHEMA}.canonical_decisions AS decision
      JOIN ${B3_SCHEMA}.time_entries AS entry ON entry.id = decision.time_entry_id
      JOIN ${B3_SCHEMA}.work_events AS event ON event.id = decision.work_event_id
      WHERE decision.work_event_id = $1
    `, [eventId]);
    expect(result.rows[0]).toEqual({
      decision_type: 'time_entry_stopped',
      status: 'stopped',
      stop_work_event_id: eventId,
      timestamps_match: true,
    });
  });

  it('accepts truthful duplicate and escalation Decisions without invented relationships', async () => {
    const duplicateEventId = '50000000-0000-4000-8000-000000000068';
    const escalationEventId = '50000000-0000-4000-8000-000000000069';
    await insertLifecycleWorkEvent(duplicateEventId);
    await insertLifecycleWorkEvent(escalationEventId);
    await insertLifecycleDecision({
      eventId: duplicateEventId,
      decisionType: 'duplicate_scan_ignored',
      previousWorkEventId: ids.eventA,
    });
    await insertLifecycleDecision({
      eventId: escalationEventId,
      decisionType: 'escalation_required',
      reason: 'previous_work_event_target_mismatch',
    });
    await insertLifecycleReceipt({
      id: '65000000-0000-4000-8000-000000000068',
      eventId: duplicateEventId,
      attemptNumber: 1,
      status: 'synchronized',
      decisionWorkEventId: duplicateEventId,
    });
    await insertLifecycleReceipt({
      id: '65000000-0000-4000-8000-000000000069',
      eventId: escalationEventId,
      attemptNumber: 1,
      status: 'synchronized',
      decisionWorkEventId: escalationEventId,
    });

    const result = await installerPool.query<{
      decision_type: string;
      reason: string | null;
      time_entry_id: string | null;
      previous_work_event_id: string | null;
    }>(`
      SELECT decision_type, reason, time_entry_id, previous_work_event_id
      FROM ${B3_SCHEMA}.canonical_decisions
      WHERE work_event_id IN ($1, $2)
      ORDER BY decision_type
    `, [duplicateEventId, escalationEventId]);
    expect(result.rows).toEqual([
      {
        decision_type: 'duplicate_scan_ignored',
        reason: null,
        time_entry_id: null,
        previous_work_event_id: ids.eventA,
      },
      {
        decision_type: 'escalation_required',
        reason: 'previous_work_event_target_mismatch',
        time_entry_id: null,
        previous_work_event_id: null,
      },
    ]);
  });
});

describe('B3 truthful SyncReceipt result mapping', () => {
  it('rejects synchronized without a CanonicalDecision', async () => {
    const eventId = '50000000-0000-4000-8000-000000000051';
    await insertLifecycleWorkEvent(eventId);
    expect(
      await postgresErrorCode(
        insertLifecycleReceipt({
          id: '65000000-0000-4000-8000-000000000051',
          eventId,
          attemptNumber: 1,
          status: 'synchronized',
        }),
      ),
    ).toBe('23514');
  });

  it('rejects a Server-TimeEntry without a Server-Decision', async () => {
    expect(
      await postgresErrorCode(
        insertLifecycleReceipt({
          id: '65000000-0000-4000-8000-000000000052',
          eventId: ids.eventA,
          attemptNumber: 2,
          status: 'conflict',
          serverTimeEntryId: ids.timeEntryA,
          conflictCode: 'synthetic_conflict',
        }),
      ),
    ).toBe('23514');
  });

  it.each([null, '   '])('rejects conflict with non-meaningful conflict_code %s', async (conflictCode) => {
    const eventId = '50000000-0000-4000-8000-000000000053';
    await insertLifecycleWorkEvent(eventId);
    expect(
      await postgresErrorCode(
        insertLifecycleReceipt({
          id: '65000000-0000-4000-8000-000000000053',
          eventId,
          attemptNumber: 1,
          status: 'conflict',
          conflictCode,
        }),
      ),
    ).toBe('23514');
  });

  it.each([
    { status: 'received', decisionWorkEventId: ids.eventA, conflictCode: null },
    { status: 'retryable_failure', decisionWorkEventId: ids.eventA, conflictCode: null },
    { status: 'synchronized', decisionWorkEventId: ids.eventA, conflictCode: 'not_allowed' },
  ] as const)('rejects invalid $status mapping combination', async (testCase) => {
    expect(
      await postgresErrorCode(
        insertLifecycleReceipt({
          id: '65000000-0000-4000-8000-000000000054',
          eventId: ids.eventA,
          attemptNumber: 2,
          status: testCase.status,
          decisionWorkEventId: testCase.decisionWorkEventId,
          conflictCode: testCase.conflictCode,
        }),
      ),
    ).toBe('23514');
  });

  it('accepts a conflict attempt with a nonempty code and no invented server mapping', async () => {
    const eventId = '50000000-0000-4000-8000-000000000055';
    await insertLifecycleWorkEvent(eventId);
    await insertLifecycleReceipt({
      id: '65000000-0000-4000-8000-000000000055',
      eventId,
      attemptNumber: 1,
      status: 'conflict',
      conflictCode: 'work_event_content_mismatch',
    });

    const result = await installerPool.query<{
      status: string;
      conflict_code: string;
      server_decision_work_event_id: string | null;
      server_time_entry_id: string | null;
    }>(`
      SELECT status, conflict_code, server_decision_work_event_id, server_time_entry_id
      FROM ${B3_SCHEMA}.sync_receipts WHERE id = $1
    `, ['65000000-0000-4000-8000-000000000055']);
    expect(result.rows[0]).toEqual({
      status: 'conflict',
      conflict_code: 'work_event_content_mismatch',
      server_decision_work_event_id: null,
      server_time_entry_id: null,
    });
  });
});

describe('B3 Organization-qualified administrative actors', () => {
  it('rejects a Membership creator from another Organization with 23503', async () => {
    const userId = '10000000-0000-4000-8000-000000000090';
    await installerPool.query(`INSERT INTO ${B3_SCHEMA}.users (id) VALUES ($1)`, [userId]);
    expect(
      await postgresErrorCode(
        installerPool.query(
          `INSERT INTO ${B3_SCHEMA}.memberships
            (id, organization_id, user_id, role, created_by_user_id)
           VALUES ('12000000-0000-4000-8000-000000000090', $1, $2, 'employee', $3)`,
          [ids.organizationA, userId, ids.adminB],
        ),
      ),
    ).toBe('23503');
  });

  it('rejects an AuditEvent actor from another Organization with 23503', async () => {
    expect(
      await postgresErrorCode(
        installerPool.query(
          `INSERT INTO ${B3_SCHEMA}.audit_events
            (id, organization_id, actor_user_id, event_type, entity_type, entity_id,
             occurred_at, correlation_id, payload)
           VALUES ('70000000-0000-4000-8000-000000000090', $1, $2,
             'ForbiddenActor', 'Organization', $1, transaction_timestamp(), 'cross-tenant-actor', '{}')`,
          [ids.organizationA, ids.adminB],
        ),
      ),
    ).toBe('23503');
  });
});

describe('B3 controlled Administrator mutation surface', () => {
  it('denies every historical or ownership-column mutation after write revocation', async () => {
    const forbidden = [
      ['organizations', 'id = id'],
      ['organizations', 'created_at = created_at'],
      ['memberships', 'id = id'],
      ['memberships', 'organization_id = organization_id'],
      ['memberships', 'user_id = user_id'],
      ['memberships', 'created_at = created_at'],
      ['memberships', 'created_by_user_id = created_by_user_id'],
      ['customers', 'id = id'],
      ['customers', 'organization_id = organization_id'],
      ['customers', 'activated_at = activated_at'],
      ['customers', 'created_at = created_at'],
      ['customers', 'updated_at = updated_at'],
      ['nfc_tags', 'id = id'],
      ['nfc_tags', 'organization_id = organization_id'],
      ['nfc_tags', 'payload_value = payload_value'],
      ['nfc_tags', 'created_at = created_at'],
      ['nfc_assignments', 'id = id'],
      ['nfc_assignments', 'organization_id = organization_id'],
      ['nfc_assignments', 'nfc_tag_id = nfc_tag_id'],
      ['nfc_assignments', 'target_type = target_type'],
      ['nfc_assignments', 'target_customer_id = target_customer_id'],
      ['nfc_assignments', 'valid_from = valid_from'],
      ['nfc_assignments', 'created_at = created_at'],
      ['nfc_assignments', 'updated_at = updated_at'],
    ] as const;
    for (const [table, assignment] of forbidden) {
      expect(
        await postgresErrorCode(adminQuery(adminAContext, `UPDATE ${B3_SCHEMA}.${table} SET ${assignment}`)),
        `${table}.${assignment}`,
      ).toBe('42501');
    }
  });

  it.each([
    ['Organization rename', `UPDATE ${B3_SCHEMA}.organizations
      SET name = 'Forbidden Administrator Rename', row_version = row_version + 1
      WHERE id = '${ids.organizationA}'`],
    ['Membership role change', `UPDATE ${B3_SCHEMA}.memberships
      SET role = 'administrator', row_version = row_version + 1
      WHERE user_id = '${ids.employeeA}'`],
    ['Membership revocation', `UPDATE ${B3_SCHEMA}.memberships
      SET revoked_at = transaction_timestamp(), row_version = row_version + 1
      WHERE user_id = '${ids.employeeA}'`],
    ['Customer deactivation', `UPDATE ${B3_SCHEMA}.customers
      SET active = false, deactivated_at = transaction_timestamp(), row_version = row_version + 1
      WHERE id = '${ids.customerA}'`],
    ['NFC assignment deactivation', `UPDATE ${B3_SCHEMA}.nfc_assignments
      SET active = false, valid_to = transaction_timestamp(), row_version = row_version + 1
      WHERE id = '${ids.assignmentA}'`],
  ])('denies the former Administrator %s path', async (_operation, statement) => {
    expect(await postgresErrorCode(adminQuery(adminAContext, statement))).toBe('42501');
  });
});

describe('B3 production administrative capability boundaries', () => {
  it('lets taptime_admin_setup create allowlisted configuration in its own tenant', async () => {
    const correlationId = '80000000-0000-4000-8000-000000000070';
    const customerId = '20000000-0000-4000-8000-000000000070';
    const tagId = '30000000-0000-4000-8000-000000000070';
    const assignmentId = '40000000-0000-4000-8000-000000000070';

    await withCapabilityTransaction(
      'taptime_admin_setup',
      adminACapabilityContext(correlationId),
      async (client) => {
        await client.query(
          `INSERT INTO ${B3_SCHEMA}.customers (id, organization_id, display_name, active)
           VALUES ($1, $2, 'Capability Customer', true)`,
          [customerId, ids.organizationA],
        );
        await client.query(
          `SELECT inserted_nfc_tag_id
           FROM ${B3_SCHEMA}.insert_admin_setup_nfc_tag_v1($1, $2, $3, $4)`,
          [tagId, ids.organizationA, 'Capability Tag', 'nfc:uid:v1:7001'],
        );
        await client.query(
          `INSERT INTO ${B3_SCHEMA}.nfc_assignments
            (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
           VALUES ($1, $2, $3, 'customer', $4, true)`,
          [assignmentId, ids.organizationA, tagId, customerId],
        );
      },
    );

    const state = await installerPool.query<{ customers: number; tags: number; assignments: number }>(`
      SELECT
        (SELECT count(*)::integer FROM ${B3_SCHEMA}.customers WHERE id = $1) AS customers,
        (SELECT count(*)::integer FROM ${B3_SCHEMA}.nfc_tags WHERE id = $2) AS tags,
        (SELECT count(*)::integer FROM ${B3_SCHEMA}.nfc_assignments WHERE id = $3) AS assignments
    `, [customerId, tagId, assignmentId]);
    expect(state.rows[0]).toEqual({ customers: 1, tags: 1, assignments: 1 });
  });

  it('rejects taptime_admin_setup cross-tenant Customer INSERT through RLS despite complete INSERT column rights', async () => {
    const privilege = await installerPool.query<{
      has_table_insert: boolean;
      has_all_insert_columns: boolean;
    }>(`
      SELECT
        has_table_privilege(
          'taptime_admin_setup', '${B3_SCHEMA}.customers', 'INSERT'
        ) AS has_table_insert,
        bool_and(has_column_privilege(
          'taptime_admin_setup', '${B3_SCHEMA}.customers', column_name, 'INSERT'
        )) AS has_all_insert_columns
      FROM unnest(ARRAY['id', 'organization_id', 'display_name', 'active']) AS allowed(column_name)
    `);
    expect(privilege.rows[0]).toEqual({
      has_table_insert: false,
      has_all_insert_columns: true,
    });

    const error = await postgresErrorDetails(withCapabilityTransaction(
      'taptime_admin_setup',
      adminACapabilityContext('80000000-0000-4000-8000-000000000071'),
      (client) => client.query(
        `INSERT INTO ${B3_SCHEMA}.customers (id, organization_id, display_name, active)
         VALUES ('20000000-0000-4000-8000-000000000071', $1,
           'Cross Tenant Capability Customer', true)`,
        [ids.organizationB],
      ),
    ));
    expect(error?.code).toBe('42501');
    expect(error?.message).toMatch(/row-level security/i);
  });

  it('keeps Organization history read-only to the production setup capability', async () => {
    const privileges = await installerPool.query<{
      can_select_name: boolean;
      can_update_any_column: boolean;
    }>(`
      SELECT
        has_column_privilege(
          'taptime_admin_setup', '${B3_SCHEMA}.organizations', 'name', 'SELECT'
        ) AS can_select_name,
        has_any_column_privilege(
          'taptime_admin_setup', '${B3_SCHEMA}.organizations', 'UPDATE'
        ) AS can_update_any_column
    `);
    expect(privileges.rows[0]).toEqual({
      can_select_name: true,
      can_update_any_column: false,
    });

    for (const assignment of [
      "name = 'Forbidden Capability Rename'",
      "created_at = '2026-07-01T00:00:00Z'",
      'row_version = 2',
    ]) {
      const error = await postgresErrorDetails(withCapabilityTransaction(
        'taptime_admin_setup',
        adminACapabilityContext('80000000-0000-4000-8000-000000000072'),
        (client) => client.query(
          `UPDATE ${B3_SCHEMA}.organizations SET ${assignment} WHERE id = $1`,
          [ids.organizationA],
        ),
      ));
      expect(error?.code, assignment).toBe('42501');
      expect(error?.message, assignment).toMatch(/permission denied/i);
    }
  });

  it('protects Membership ownership and history through redemption-owner UPDATE column grants', async () => {
    const forbiddenColumns = [
      'id', 'organization_id', 'user_id', 'role', 'created_at', 'revoked_at',
      'created_by_user_id',
    ];
    const privileges = await installerPool.query<{ column_name: string; granted: boolean }>(`
      SELECT column_name,
        has_column_privilege(
          'taptime_employee_redemption_data_function_owner',
          '${B3_SCHEMA}.memberships', column_name, 'UPDATE'
        ) AS granted
      FROM unnest($1::text[]) AS forbidden(column_name)
      UNION ALL
      SELECT 'row_version', has_column_privilege(
        'taptime_employee_redemption_data_function_owner',
        '${B3_SCHEMA}.memberships', 'row_version', 'UPDATE'
      )
    `, [forbiddenColumns]);
    expect(privileges.rows.find(({ column_name }) => column_name === 'row_version')?.granted).toBe(true);
    expect(
      privileges.rows
        .filter(({ column_name }) => column_name !== 'row_version')
        .every(({ granted }) => !granted),
    ).toBe(true);

    const assignments = [
      `id = '12000000-0000-4000-8000-000000000002'`,
      `organization_id = '${ids.organizationA}'`,
      `user_id = '${ids.employeeA}'`,
      "role = 'employee'",
      "created_at = '2026-07-01T00:00:00Z'",
      'revoked_at = NULL',
      `created_by_user_id = '${ids.adminA}'`,
    ];
    for (const assignment of assignments) {
      const error = await postgresErrorDetails(withCapabilityTransaction(
        'taptime_employee_redemption_data_function_owner',
        adminACapabilityContext('80000000-0000-4000-8000-000000000073'),
        (client) => client.query(
          `UPDATE ${B3_SCHEMA}.memberships SET ${assignment}
           WHERE id = '12000000-0000-4000-8000-000000000002'`,
        ),
      ));
      expect(error?.code, assignment).toBe('42501');
      expect(error?.message, assignment).toMatch(/permission denied/i);
    }
  });

  it('protects Customer ownership and history through setup-owner UPDATE column grants', async () => {
    const forbiddenColumns = [
      'id', 'organization_id', 'display_name', 'activated_at', 'deactivated_at',
      'created_at', 'updated_at', 'row_version',
    ];
    const privileges = await installerPool.query<{ column_name: string; granted: boolean }>(`
      SELECT column_name,
        has_column_privilege(
          'taptime_admin_setup_data_function_owner',
          '${B3_SCHEMA}.customers', column_name, 'UPDATE'
        ) AS granted
      FROM unnest($1::text[]) AS forbidden(column_name)
      UNION ALL
      SELECT 'active', has_column_privilege(
        'taptime_admin_setup_data_function_owner',
        '${B3_SCHEMA}.customers', 'active', 'UPDATE'
      )
    `, [forbiddenColumns]);
    expect(privileges.rows.find(({ column_name }) => column_name === 'active')?.granted).toBe(true);
    expect(
      privileges.rows
        .filter(({ column_name }) => column_name !== 'active')
        .every(({ granted }) => !granted),
    ).toBe(true);

    const assignments = [
      `id = '${ids.customerA}'`,
      `organization_id = '${ids.organizationA}'`,
      "display_name = 'Forbidden Customer Rename'",
      "activated_at = '2026-07-01T00:00:00Z'",
      'deactivated_at = NULL',
      "created_at = '2026-07-01T00:00:00Z'",
      "updated_at = '2026-07-01T00:00:00Z'",
      'row_version = 2',
    ];
    for (const assignment of assignments) {
      const error = await postgresErrorDetails(withCapabilityTransaction(
        'taptime_admin_setup_data_function_owner',
        adminACapabilityContext('80000000-0000-4000-8000-000000000074'),
        (client) => client.query(
          `UPDATE ${B3_SCHEMA}.customers SET ${assignment} WHERE id = $1`,
          [ids.customerA],
        ),
      ));
      expect(error?.code, assignment).toBe('42501');
      expect(error?.message, assignment).toMatch(/permission denied/i);
    }
  });

  it('protects NFC Tag creation history through setup-owner INSERT column grants', async () => {
    const privileges = await installerPool.query<{
      allowed_columns: boolean;
      created_at: boolean;
    }>(`
      SELECT
        bool_and(has_column_privilege(
          'taptime_admin_setup_data_function_owner', '${B3_SCHEMA}.nfc_tags',
          column_name, 'INSERT'
        )) AS allowed_columns,
        has_column_privilege(
          'taptime_admin_setup_data_function_owner', '${B3_SCHEMA}.nfc_tags',
          'created_at', 'INSERT'
        ) AS created_at
      FROM unnest(ARRAY['id', 'organization_id', 'display_name', 'payload_value'])
        AS allowed(column_name)
    `);
    expect(privileges.rows[0]).toEqual({ allowed_columns: true, created_at: false });

    const error = await postgresErrorDetails(withCapabilityTransaction(
      'taptime_admin_setup_data_function_owner',
      adminACapabilityContext('80000000-0000-4000-8000-000000000075'),
      (client) => client.query(
        `INSERT INTO ${B3_SCHEMA}.nfc_tags
          (id, organization_id, display_name, payload_value, created_at)
         VALUES ('30000000-0000-4000-8000-000000000075', $1,
           'Forbidden Historical Tag', 'nfc:uid:v1:7501', transaction_timestamp())`,
        [ids.organizationA],
      ),
    ));
    expect(error?.code).toBe('42501');
    expect(error?.message).toMatch(/permission denied/i);
  });

  it('protects Assignment ownership and history through reassigner UPDATE column grants', async () => {
    const forbiddenColumns = [
      'id', 'organization_id', 'nfc_tag_id', 'target_type', 'target_customer_id',
      'valid_from', 'created_at',
    ];
    const privileges = await installerPool.query<{ column_name: string; granted: boolean }>(`
      SELECT column_name,
        has_column_privilege(
          'taptime_assignment_reassigner', '${B3_SCHEMA}.nfc_assignments',
          column_name, 'UPDATE'
        ) AS granted
      FROM unnest($1::text[]) AS forbidden(column_name)
      UNION ALL
      SELECT 'active', has_column_privilege(
        'taptime_assignment_reassigner', '${B3_SCHEMA}.nfc_assignments',
        'active', 'UPDATE'
      )
    `, [forbiddenColumns]);
    expect(privileges.rows.find(({ column_name }) => column_name === 'active')?.granted).toBe(true);
    expect(
      privileges.rows
        .filter(({ column_name }) => column_name !== 'active')
        .every(({ granted }) => !granted),
    ).toBe(true);

    const assignments = [
      `id = '${ids.assignmentA}'`,
      `organization_id = '${ids.organizationA}'`,
      `nfc_tag_id = '${ids.tagA}'`,
      "target_type = 'customer'",
      `target_customer_id = '${ids.customerA}'`,
      "valid_from = '2026-07-01T00:00:00Z'",
      "created_at = '2026-07-01T00:00:00Z'",
    ];
    for (const assignment of assignments) {
      const error = await postgresErrorDetails(withCapabilityTransaction(
        'taptime_assignment_reassigner',
        adminACapabilityContext('80000000-0000-4000-8000-000000000076'),
        (client) => client.query(
          `UPDATE ${B3_SCHEMA}.nfc_assignments SET ${assignment} WHERE id = $1`,
          [ids.assignmentA],
        ),
      ));
      expect(error?.code, assignment).toBe('42501');
      expect(error?.message, assignment).toMatch(/permission denied/i);
    }
  });

  it('requires exact row_version advancement for an allowed production reassignment update', async () => {
    const result = await withCapabilityProbeTransaction(
      'taptime_assignment_reassigner',
      adminACapabilityContext('80000000-0000-4000-8000-000000000077'),
      async (client) => {
        const rejected = await rejectedAtSavepoint(
          client,
          `UPDATE ${B3_SCHEMA}.nfc_assignments
           SET active = false, valid_to = transaction_timestamp()
           WHERE id = $1`,
          [ids.assignmentA],
        );
        const allowed = await client.query<{ row_version: string }>(
          `UPDATE ${B3_SCHEMA}.nfc_assignments
           SET active = false, valid_to = transaction_timestamp(),
             row_version = row_version + 1
           WHERE id = $1
           RETURNING row_version`,
          [ids.assignmentA],
        );
        return { rejected, rowVersion: allowed.rows[0]?.row_version };
      },
    );
    expect(result.rejected?.code).toBe('23514');
    expect(result.rowVersion).toBe('2');
  });

  it('requires exact Membership row_version advancement through the production redemption data role', async () => {
    const membershipId = '12000000-0000-4000-8000-000000000002';
    const result = await withCapabilityProbeTransaction(
      'taptime_employee_redemption_data_function_owner',
      adminACapabilityContext('80000000-0000-4000-8000-000000000087'),
      async (client) => {
        const rejected = await rejectedAtSavepoint(
          client,
          `UPDATE ${B3_SCHEMA}.memberships
           SET row_version = row_version
           WHERE id = $1`,
          [membershipId],
        );
        const allowed = await client.query<{ row_version: string }>(
          `UPDATE ${B3_SCHEMA}.memberships
           SET row_version = row_version + 1
           WHERE id = $1
           RETURNING row_version`,
          [membershipId],
        );
        return { rejected, rowVersion: allowed.rows[0]?.row_version };
      },
    );
    expect(result.rejected?.code).toBe('23514');
    expect(result.rowVersion).toBe('2');
  });

  it('allows one-way Membership revocation through the production redemption data role but rejects un-revoke', async () => {
    const membershipId = '12000000-0000-4000-8000-000000000002';
    const result = await withCapabilityProbeTransaction(
      'taptime_employee_redemption_data_function_owner',
      adminACapabilityContext('80000000-0000-4000-8000-000000000078'),
      async (client) => {
        const revoked = await client.query<{ revoked: boolean; row_version: string }>(
          `UPDATE ${B3_SCHEMA}.memberships
           SET revoked_at = transaction_timestamp(), row_version = row_version + 1
           WHERE id = $1
           RETURNING revoked_at IS NOT NULL AS revoked, row_version`,
          [membershipId],
        );
        const rejected = await rejectedAtSavepoint(
          client,
          `UPDATE ${B3_SCHEMA}.memberships
           SET revoked_at = NULL, row_version = row_version + 1
           WHERE id = $1`,
          [membershipId],
        );
        return { rejected, revoked: revoked.rows[0] };
      },
      [
        `GRANT UPDATE (revoked_at) ON ${B3_SCHEMA}.memberships
         TO taptime_employee_redemption_data_function_owner`,
      ],
    );
    expect(result.revoked).toEqual({ revoked: true, row_version: '2' });
    expect(result.rejected?.code).toBe('23514');
  });

  it('allows one-way Customer deactivation through the production setup data role but rejects reactivation', async () => {
    const result = await withCapabilityProbeTransaction(
      'taptime_admin_setup_data_function_owner',
      adminACapabilityContext('80000000-0000-4000-8000-000000000079'),
      async (client) => {
        const deactivated = await client.query<{ active: boolean }>(
          `UPDATE ${B3_SCHEMA}.customers
           SET active = false, deactivated_at = transaction_timestamp(),
             row_version = 2
           WHERE id = $1
           RETURNING active`,
          [ids.customerA],
        );
        const rejected = await rejectedAtSavepoint(
          client,
          `UPDATE ${B3_SCHEMA}.customers
           SET active = true, deactivated_at = NULL, row_version = 3
           WHERE id = $1`,
          [ids.customerA],
        );
        return { deactivated: deactivated.rows[0], rejected };
      },
      [
        `GRANT UPDATE (deactivated_at, row_version) ON ${B3_SCHEMA}.customers
         TO taptime_admin_setup_data_function_owner`,
      ],
    );
    expect(result.deactivated).toEqual({ active: false });
    expect(result.rejected?.code).toBe('23514');
  });

  it('allows one-way Assignment deactivation through taptime_assignment_reassigner but rejects reactivation', async () => {
    const result = await withCapabilityProbeTransaction(
      'taptime_assignment_reassigner',
      adminACapabilityContext('80000000-0000-4000-8000-000000000080'),
      async (client) => {
        const deactivated = await client.query<{ active: boolean; row_version: string }>(
          `UPDATE ${B3_SCHEMA}.nfc_assignments
           SET active = false, valid_to = transaction_timestamp(),
             row_version = row_version + 1
           WHERE id = $1
           RETURNING active, row_version`,
          [ids.assignmentA],
        );
        const rejected = await rejectedAtSavepoint(
          client,
          `UPDATE ${B3_SCHEMA}.nfc_assignments
           SET active = true, valid_to = NULL, row_version = row_version + 1
           WHERE id = $1`,
          [ids.assignmentA],
        );
        return { deactivated: deactivated.rows[0], rejected };
      },
    );
    expect(result.deactivated).toEqual({ active: false, row_version: '2' });
    expect(result.rejected?.code).toBe('23514');
  });
});

describe('B3 atomic production-capability audit evidence', () => {
  it('writes setup data and all three AuditEvents in the same transaction', async () => {
    const correlationId = '80000000-0000-4000-8000-000000000081';
    const customerId = '20000000-0000-4000-8000-000000000081';
    const tagId = '30000000-0000-4000-8000-000000000081';
    const assignmentId = '40000000-0000-4000-8000-000000000081';
    await withCapabilityTransaction(
      'taptime_admin_setup',
      adminACapabilityContext(correlationId),
      async (client) => {
        await client.query(
          `INSERT INTO ${B3_SCHEMA}.customers (id, organization_id, display_name, active)
           VALUES ($1, $2, 'Atomic Setup Customer', true)`,
          [customerId, ids.organizationA],
        );
        await client.query(
          `SELECT inserted_nfc_tag_id
           FROM ${B3_SCHEMA}.insert_admin_setup_nfc_tag_v1($1, $2, $3, $4)`,
          [tagId, ids.organizationA, 'Atomic Setup Tag', 'nfc:uid:v1:8101'],
        );
        await client.query(
          `INSERT INTO ${B3_SCHEMA}.nfc_assignments
            (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
           VALUES ($1, $2, $3, 'customer', $4, true)`,
          [assignmentId, ids.organizationA, tagId, customerId],
        );
      },
    );

    const transactionRows = await installerPool.query<{
      record_kind: string;
      transaction_id: string;
    }>(`
      SELECT 'customer' AS record_kind, xmin::text AS transaction_id
      FROM ${B3_SCHEMA}.customers WHERE id = $1
      UNION ALL
      SELECT 'tag', xmin::text FROM ${B3_SCHEMA}.nfc_tags WHERE id = $2
      UNION ALL
      SELECT 'assignment', xmin::text FROM ${B3_SCHEMA}.nfc_assignments WHERE id = $3
      UNION ALL
      SELECT 'audit:' || event_type, xmin::text FROM ${B3_SCHEMA}.audit_events
      WHERE correlation_id = $4
    `, [customerId, tagId, assignmentId, correlationId]);
    expect(transactionRows.rows).toHaveLength(6);
    expect(new Set(transactionRows.rows.map(({ transaction_id }) => transaction_id)).size).toBe(1);
    expect(
      transactionRows.rows
        .map(({ record_kind }) => record_kind)
        .filter((recordKind) => recordKind.startsWith('audit:'))
        .sort(),
    ).toEqual([
      'audit:CustomerCreated',
      'audit:NfcTagAssigned',
      'audit:NfcTagRegistered',
    ]);
  });

  it('writes an Employee invitation and its AuditEvent in the same creator transaction', async () => {
    const commandId = '80000000-0000-4000-8000-000000000082';
    const invitationId = '82000000-0000-4000-8000-000000000082';
    const tokenDigest = createHash('sha256').update('b3-invitation-audit-82').digest();
    const created = await withCapabilityTransaction(
      'taptime_employee_invitation_creator',
      adminACapabilityContext(commandId),
      (client) => client.query<{ result_status: string }>(
        `SELECT result_status
         FROM ${B3_SCHEMA}.create_employee_membership_invitation_v1($1, $2, $3, $4)`,
        [commandId, invitationId, 'Capability Employee', tokenDigest],
      ),
    );
    expect(created.rows[0]?.result_status).toBe('succeeded');

    const transactionRows = await installerPool.query<{ transaction_id: string }>(`
      SELECT xmin::text AS transaction_id
      FROM ${B3_SCHEMA}.employee_membership_invitations WHERE id = $1
      UNION ALL
      SELECT xmin::text FROM ${B3_SCHEMA}.audit_events
      WHERE correlation_id = $2 AND event_type = 'EmployeeMembershipInvitationCreated'
    `, [invitationId, commandId]);
    expect(transactionRows.rows).toHaveLength(2);
    expect(new Set(transactionRows.rows.map(({ transaction_id }) => transaction_id)).size).toBe(1);
  });

  it('writes enrollment data and MembershipGranted in the same redeemer transaction', async () => {
    const invitationCommandId = '80000000-0000-4000-8000-000000000083';
    const invitationId = '82000000-0000-4000-8000-000000000083';
    const redemptionCommandId = '83000000-0000-4000-8000-000000000083';
    const userId = '10000000-0000-4000-8000-000000000083';
    const identityBindingId = '11000000-0000-4000-8000-000000000083';
    const membershipId = '12000000-0000-4000-8000-000000000083';
    const tokenDigest = createHash('sha256').update('b3-enrollment-audit-83').digest();
    const invitation = await withCapabilityTransaction(
      'taptime_employee_invitation_creator',
      adminACapabilityContext(invitationCommandId),
      (client) => client.query<{ result_status: string }>(
        `SELECT result_status
         FROM ${B3_SCHEMA}.create_employee_membership_invitation_v1($1, $2, $3, $4)`,
        [invitationCommandId, invitationId, 'Enrolled Capability User', tokenDigest],
      ),
    );
    expect(invitation.rows[0]?.result_status).toBe('succeeded');

    const redemption = await withCapabilityTransaction(
      'taptime_employee_enrollment_redeemer',
      adminACapabilityContext(redemptionCommandId),
      (client) => client.query<{ result_status: string }>(
        `SELECT result_status
         FROM ${B3_SCHEMA}.redeem_employee_membership_invitation_v1(
           $1, $2, $3, $4, $5, $6, $7
         )`,
        [
          redemptionCommandId,
          tokenDigest,
          'https://synthetic.invalid/auth',
          'b3-capability-audit-user',
          userId,
          identityBindingId,
          membershipId,
        ],
      ),
    );
    expect(redemption.rows[0]?.result_status).toBe('succeeded');

    const transactionRows = await installerPool.query<{ transaction_id: string }>(`
      SELECT xmin::text AS transaction_id FROM ${B3_SCHEMA}.users WHERE id = $1
      UNION ALL
      SELECT xmin::text FROM ${B3_SCHEMA}.identity_bindings WHERE id = $2
      UNION ALL
      SELECT xmin::text FROM ${B3_SCHEMA}.memberships WHERE id = $3
      UNION ALL
      SELECT xmin::text FROM ${B3_SCHEMA}.employee_membership_invitations WHERE id = $4
      UNION ALL
      SELECT xmin::text FROM ${B3_SCHEMA}.employee_enrollment_redemption_receipts
      WHERE command_id = $5
      UNION ALL
      SELECT xmin::text FROM ${B3_SCHEMA}.audit_events
      WHERE correlation_id = $5::text AND event_type = 'MembershipGranted'
    `, [userId, identityBindingId, membershipId, invitationId, redemptionCommandId]);
    expect(transactionRows.rows).toHaveLength(6);
    expect(new Set(transactionRows.rows.map(({ transaction_id }) => transaction_id)).size).toBe(1);

    const audit = await installerPool.query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM ${B3_SCHEMA}.audit_events
       WHERE correlation_id = $1 AND event_type = 'MembershipGranted'`,
      [redemptionCommandId],
    );
    expect(audit.rows[0]?.payload).toEqual({ role: 'employee' });
  });

  it('writes both sides of a reassignment and both AuditEvents in the same transaction', async () => {
    const correlationId = '80000000-0000-4000-8000-000000000084';
    const replacementId = '40000000-0000-4000-8000-000000000084';
    const result = await withCapabilityTransaction(
      'taptime_assignment_reassigner',
      adminACapabilityContext(correlationId),
      async (client) => {
        const effective = await client.query<{ effective_at: Date }>(
          'SELECT transaction_timestamp() AS effective_at',
        );
        const effectiveAt = effective.rows[0]!.effective_at;
        const deactivated = await client.query<{ row_version: string }>(
          `UPDATE ${B3_SCHEMA}.nfc_assignments
           SET active = false, valid_to = $2, row_version = row_version + 1
           WHERE id = $1
           RETURNING row_version`,
          [ids.assignmentA, effectiveAt],
        );
        await client.query(
          `INSERT INTO ${B3_SCHEMA}.nfc_assignments
            (id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from)
           VALUES ($1, $2, $3, 'customer', $4, true, $5)`,
          [replacementId, ids.organizationA, ids.tagA, ids.customerA, effectiveAt],
        );
        return deactivated.rows[0]?.row_version;
      },
    );
    expect(result).toBe('2');

    const transactionRows = await installerPool.query<{ transaction_id: string }>(`
      SELECT xmin::text AS transaction_id FROM ${B3_SCHEMA}.nfc_assignments
      WHERE id IN ($1, $2)
      UNION ALL
      SELECT xmin::text FROM ${B3_SCHEMA}.audit_events WHERE correlation_id = $3
    `, [ids.assignmentA, replacementId, correlationId]);
    expect(transactionRows.rows).toHaveLength(4);
    expect(new Set(transactionRows.rows.map(({ transaction_id }) => transaction_id)).size).toBe(1);

    const audit = await installerPool.query<{
      event_type: string;
      payload: Record<string, unknown>;
    }>(`
      SELECT event_type, payload FROM ${B3_SCHEMA}.audit_events
      WHERE correlation_id = $1 ORDER BY event_type
    `, [correlationId]);
    expect(audit.rows).toEqual([
      { event_type: 'NfcAssignmentDeactivated', payload: { active: false, rowVersion: 2 } },
      { event_type: 'NfcTagAssigned', payload: {} },
    ]);
  });

  it('stores only allowlisted fields and no raw NFC credential in setup audit payloads', async () => {
    const correlationId = '80000000-0000-4000-8000-000000000085';
    const tagId = '30000000-0000-4000-8000-000000000085';
    const rawPayload = 'nfc:uid:v1:85AABBCC';
    await withCapabilityTransaction(
      'taptime_admin_setup',
      adminACapabilityContext(correlationId),
      (client) => client.query(
        `SELECT inserted_nfc_tag_id
         FROM ${B3_SCHEMA}.insert_admin_setup_nfc_tag_v1($1, $2, $3, $4)`,
        [tagId, ids.organizationA, 'Payload Safe Tag', rawPayload],
      ),
    );

    const audit = await installerPool.query<{
      payload: Record<string, unknown>;
      serialized: string;
    }>(`
      SELECT payload, payload::text AS serialized FROM ${B3_SCHEMA}.audit_events
      WHERE correlation_id = $1 AND entity_id = $2 AND event_type = 'NfcTagRegistered'
    `, [correlationId, tagId]);
    expect(audit.rows[0]?.payload).toEqual({});
    expect(audit.rows[0]?.serialized).not.toContain(rawPayload);
  });

  it('rolls back setup data and its AuditEvent atomically', async () => {
    const correlationId = '80000000-0000-4000-8000-000000000086';
    const customerId = '20000000-0000-4000-8000-000000000086';
    await expect(withCapabilityTransaction(
      'taptime_admin_setup',
      adminACapabilityContext(correlationId),
      async (client) => {
        await client.query(
          `INSERT INTO ${B3_SCHEMA}.customers (id, organization_id, display_name, active)
           VALUES ($1, $2, 'Rolled Back Capability Customer', true)`,
          [customerId, ids.organizationA],
        );
        throw new Error('synthetic production-capability rollback');
      },
    )).rejects.toThrow('synthetic production-capability rollback');

    const state = await installerPool.query<{ data_count: string; audit_count: string }>(`
      SELECT
        (SELECT count(*) FROM ${B3_SCHEMA}.customers WHERE id = $1) AS data_count,
        (SELECT count(*) FROM ${B3_SCHEMA}.audit_events WHERE correlation_id = $2) AS audit_count
    `, [customerId, correlationId]);
    expect(state.rows[0]).toEqual({ data_count: '0', audit_count: '0' });
  });
});

describe('B3 atomic administrative audit evidence', () => {
  it('creates no audit row for rejected own-tenant Administrator DML', async () => {
    const before = await installerPool.query<{ count: string }>(
      `SELECT count(*) FROM ${B3_SCHEMA}.audit_events`,
    );
    expect(
      await postgresErrorCode(
        adminQuery(
          adminAContext,
          `INSERT INTO ${B3_SCHEMA}.nfc_tags (id, organization_id, display_name, payload_value)
           VALUES ('30000000-0000-4000-8000-000000000082', $1,
             'Rejected Administrator Tag', 'rejected-administrator-tag')`,
          [ids.organizationA],
        ),
      ),
    ).toBe('42501');
    const after = await installerPool.query<{ count: string }>(
      `SELECT count(*) FROM ${B3_SCHEMA}.audit_events`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });

  it('creates no audit row for a rejected cross-tenant administrative mutation', async () => {
    const before = await installerPool.query<{ count: string }>(
      `SELECT count(*) FROM ${B3_SCHEMA}.audit_events`,
    );
    expect(
      await postgresErrorCode(
        adminQuery(
          adminAContext,
          `INSERT INTO ${B3_SCHEMA}.customers (id, organization_id, display_name, active)
           VALUES ('20000000-0000-4000-8000-000000000083', $1,
             'Synthetic Rejected Customer', true)`,
          [ids.organizationB],
        ),
      ),
    ).toBe('42501');
    const after = await installerPool.query<{ count: string }>(
      `SELECT count(*) FROM ${B3_SCHEMA}.audit_events`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  });

  it('preserves administrative data and audit evidence when obsolete DML is denied', async () => {
    const before = await installerPool.query<{ name: string; audit_count: string }>(`
      SELECT name,
        (SELECT count(*) FROM ${B3_SCHEMA}.audit_events WHERE actor_user_id = $2) AS audit_count
      FROM ${B3_SCHEMA}.organizations WHERE id = $1
    `, [ids.organizationA, ids.adminA]);
    expect(await postgresErrorCode(
      withRequestTransaction(
        administratorPool,
        B3_ADMIN_ROLE,
        { ...adminAContext, correlationId: 'admin-rollback-proof' },
        async (client) => {
          await query(
            client,
            `UPDATE ${B3_SCHEMA}.organizations
             SET name = 'Must Roll Back', row_version = row_version + 1 WHERE id = $1`,
            [ids.organizationA],
          );
        },
      ),
    )).toBe('42501');
    const after = await installerPool.query<{ name: string; audit_count: string }>(`
      SELECT name,
        (SELECT count(*) FROM ${B3_SCHEMA}.audit_events WHERE actor_user_id = $2) AS audit_count
      FROM ${B3_SCHEMA}.organizations WHERE id = $1
    `, [ids.organizationA, ids.adminA]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});

describe('B3 append-only SyncReceipt attempt evidence', () => {
  const eventId = '50000000-0000-4000-8000-000000000070';

  async function seedAttemptEvent(): Promise<void> {
    await insertLifecycleWorkEvent(eventId);
    await lifecycleQuery(
      employeeAContext,
      `INSERT INTO ${B3_SCHEMA}.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         decision_type, reason, engine_version, decision_payload)
       VALUES ($1, $2, $3, 'customer', $4, 'escalation_required',
         'previous_work_event_target_mismatch', 'core-test', '{}')`,
      [eventId, ids.organizationA, ids.employeeA, ids.customerA],
    );
  }

  it('appends a first, retryable, further and terminal attempt in unique order', async () => {
    await seedAttemptEvent();
    await lifecycleQuery(
      employeeAContext,
      `INSERT INTO ${B3_SCHEMA}.sync_receipts
        (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
         attempt_number, attempted_at, status, server_decision_work_event_id) VALUES
        ('65000000-0000-4000-8000-000000000071', $1, $2, $3, 'customer', $4, 1,
          '2026-07-13T10:00:01Z', 'received', NULL),
        ('65000000-0000-4000-8000-000000000072', $1, $2, $3, 'customer', $4, 2,
          '2026-07-13T10:00:02Z', 'retryable_failure', NULL),
        ('65000000-0000-4000-8000-000000000073', $1, $2, $3, 'customer', $4, 3,
          '2026-07-13T10:00:03Z', 'received', NULL),
        ('65000000-0000-4000-8000-000000000074', $1, $2, $3, 'customer', $4, 4,
          '2026-07-13T10:00:04Z', 'synchronized', $1)`,
      [eventId, ids.organizationA, ids.employeeA, ids.customerA],
    );
    const attempts = await installerPool.query<{ attempt_number: number; status: string }>(
      `SELECT attempt_number, status FROM ${B3_SCHEMA}.sync_receipts
       WHERE work_event_id = $1 ORDER BY attempt_number`,
      [eventId],
    );
    expect(attempts.rows).toEqual([
      { attempt_number: 1, status: 'received' },
      { attempt_number: 2, status: 'retryable_failure' },
      { attempt_number: 3, status: 'received' },
      { attempt_number: 4, status: 'synchronized' },
    ]);
  });

  it('rejects a duplicate attempt number for the same WorkEvent with 23505', async () => {
    await seedAttemptEvent();
    await lifecycleQuery(
      employeeAContext,
      `INSERT INTO ${B3_SCHEMA}.sync_receipts
        (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
         attempt_number, status)
       VALUES ('65000000-0000-4000-8000-000000000075', $1, $2, $3, 'customer', $4, 1, 'received')`,
      [eventId, ids.organizationA, ids.employeeA, ids.customerA],
    );
    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `INSERT INTO ${B3_SCHEMA}.sync_receipts
            (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
             attempt_number, status)
           VALUES ('65000000-0000-4000-8000-000000000076', $1, $2, $3, 'customer', $4, 1, 'retryable_failure')`,
          [eventId, ids.organizationA, ids.employeeA, ids.customerA],
        ),
      ),
    ).toBe('23505');
  });

  it('rejects Cross-User and Cross-Tenant attempts without disclosure', async () => {
    const crossUser = await postgresErrorCode(
      lifecycleQuery(
        employeeAContext,
        `INSERT INTO ${B3_SCHEMA}.sync_receipts
          (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
           attempt_number, status)
         VALUES ('65000000-0000-4000-8000-000000000077', $1, $2, $3, 'customer', $4, 2, 'received')`,
        [ids.eventA2, ids.organizationA, ids.employeeA, ids.customerA],
      ),
    );
    const crossTenant = await postgresErrorCode(
      lifecycleQuery(
        employeeAContext,
        `INSERT INTO ${B3_SCHEMA}.sync_receipts
          (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
           attempt_number, status)
         VALUES ('65000000-0000-4000-8000-000000000078', $1, $2, $3, 'customer', $4, 2, 'received')`,
        [ids.eventB, ids.organizationB, ids.employeeA, ids.customerB],
      ),
    );
    expect(crossUser).toBe('23503');
    expect(crossTenant).toBe('42501');
  });

  it('lets the owning Employee and tenant Administrator read every attempt', async () => {
    await seedAttemptEvent();
    await lifecycleQuery(
      employeeAContext,
      `INSERT INTO ${B3_SCHEMA}.sync_receipts
        (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
         attempt_number, status) VALUES
        ('65000000-0000-4000-8000-000000000079', $1, $2, $3, 'customer', $4, 1, 'received'),
        ('65000000-0000-4000-8000-000000000080', $1, $2, $3, 'customer', $4, 2, 'retryable_failure')`,
      [eventId, ids.organizationA, ids.employeeA, ids.customerA],
    );
    const [employee, administrator] = await Promise.all([
      employeeQuery(employeeAContext, `SELECT id FROM ${B3_SCHEMA}.sync_receipts WHERE work_event_id = $1`, [eventId]),
      adminQuery(adminAContext, `SELECT id FROM ${B3_SCHEMA}.sync_receipts WHERE work_event_id = $1`, [eventId]),
    ]);
    expect([employee.rowCount, administrator.rowCount]).toEqual([2, 2]);
  });

  it('keeps every earlier Receipt immutable', async () => {
    expect(
      await postgresErrorCode(
        lifecycleQuery(
          employeeAContext,
          `UPDATE ${B3_SCHEMA}.sync_receipts SET status = 'synchronized' WHERE id = $1`,
          [ids.receiptA],
        ),
      ),
    ).toBe('42501');
    expect(
      await postgresErrorCode(
        lifecycleQuery(employeeAContext, `DELETE FROM ${B3_SCHEMA}.sync_receipts WHERE id = $1`, [ids.receiptA]),
      ),
    ).toBe('42501');
    const preserved = await installerPool.query<{ status: string; attempt_number: number }>(
      `SELECT status, attempt_number FROM ${B3_SCHEMA}.sync_receipts WHERE id = $1`,
      [ids.receiptA],
    );
    expect(preserved.rows[0]).toEqual({ status: 'synchronized', attempt_number: 1 });
  });
});

describe('T-012 BreakInterval integrity, duration and tenant isolation', () => {
  it('rejects a BreakInterval that has no matching canonical Engine Decision', async () => {
    const eventId = '50000000-0000-4000-8000-000000000089';
    const intervalId = '68000000-0000-4000-8000-000000000089';
    const code = await postgresErrorCode(withRequestTransaction(
      lifecyclePool,
      B3_LIFECYCLE_ROLE,
      employeeAContext,
      async (client) => {
        await insertManualBreakWorkEvent(client, eventId, '2026-07-13T08:30:00Z');
        await query(client, `INSERT INTO ${B3_SCHEMA}.break_intervals
          (id, organization_id, user_id, time_entry_id, status, start_work_event_id,
           started_at, started_via)
         VALUES ($1, $2, $3, $4, 'started', $5, '2026-07-13T08:30:00Z', 'manual')`, [
          intervalId,
          ids.organizationA,
          ids.employeeA,
          ids.timeEntryA,
          eventId,
        ]);
      },
    ));
    const persisted = await installerPool.query(`
      SELECT id FROM ${B3_SCHEMA}.break_intervals WHERE id = $1
    `, [intervalId]);
    expect(code).toBe('23503');
    expect(persisted.rows).toEqual([]);
  });

  it('subtracts multiple persisted intervals and retains manual boundary provenance', async () => {
    await persistManualBreak({
      intervalId: '68000000-0000-4000-8000-000000000081',
      startEventId: '50000000-0000-4000-8000-000000000081',
      stopEventId: '50000000-0000-4000-8000-000000000082',
      startedAt: '2026-07-13T08:30:00Z',
      stoppedAt: '2026-07-13T08:45:00Z',
    });
    await persistManualBreak({
      intervalId: '68000000-0000-4000-8000-000000000083',
      startEventId: '50000000-0000-4000-8000-000000000083',
      stopEventId: '50000000-0000-4000-8000-000000000084',
      startedAt: '2026-07-13T09:00:00Z',
      stoppedAt: '2026-07-13T09:20:00Z',
    });
    const stopEventId = '50000000-0000-4000-8000-000000000085';
    await insertLifecycleWorkEvent(stopEventId, employeeAContext, undefined, '2026-07-13T10:00:00Z');
    await persistStoppedTimeEntry({
      eventId: stopEventId,
      timeEntryId: ids.timeEntryA,
      stoppedAt: '2026-07-13T10:00:00Z',
    });

    const duration = await employeeQuery<{ seconds: string }>(employeeAContext, `
      SELECT ${B3_SCHEMA}.effective_work_duration_seconds_v1($1)::text AS seconds
    `, [ids.timeEntryA]);
    const intervals = await installerPool.query<{
      started_via: string;
      stopped_via: string;
      seconds: string;
    }>(`
      SELECT started_via, stopped_via,
        extract(epoch FROM (stopped_at - started_at))::bigint::text AS seconds
      FROM ${B3_SCHEMA}.break_intervals
      WHERE time_entry_id = $1 ORDER BY started_at
    `, [ids.timeEntryA]);
    expect(duration.rows).toEqual([{ seconds: '5100' }]);
    expect(intervals.rows).toEqual([
      { started_via: 'manual', stopped_via: 'manual', seconds: '900' },
      { started_via: 'manual', stopped_via: 'manual', seconds: '1200' },
    ]);
  });

  it('keeps a foreign Organization administrator blind to BreakIntervals', async () => {
    await persistManualBreak({
      intervalId: '68000000-0000-4000-8000-000000000086',
      startEventId: '50000000-0000-4000-8000-000000000086',
      stopEventId: '50000000-0000-4000-8000-000000000087',
      startedAt: '2026-07-13T08:30:00Z',
      stoppedAt: '2026-07-13T08:45:00Z',
    });
    const ownTenant = await adminQuery(adminAContext, `
      SELECT id FROM ${B3_SCHEMA}.break_intervals
    `);
    const foreignTenant = await adminQuery(adminBContext, `
      SELECT id FROM ${B3_SCHEMA}.break_intervals
    `);
    expect(ownTenant.rowCount).toBe(1);
    expect(foreignTenant.rows).toEqual([]);
  });

  it('stores interval boundaries and provenance, never a mutable minute sum', async () => {
    const columns = await installerPool.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'break_intervals'
      ORDER BY ordinal_position
    `, [B3_SCHEMA]);
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      'id', 'organization_id', 'user_id', 'time_entry_id', 'status',
      'start_work_event_id', 'started_at', 'started_via', 'stop_work_event_id',
      'stopped_at', 'stopped_via', 'row_version',
    ]);
  });
});

describe('B3 structural constraints and idempotency primitives', () => {
  it('fixes canonical WorkEvent v1 field order, UTC milliseconds, UTF-8 and SHA-256 with a test vector', () => {
    const fields = {
      id: ids.eventA,
      organizationId: ids.organizationA,
      assignmentId: ids.assignmentA,
      nfcTagId: ids.tagA,
      targetType: 'customer',
      targetId: ids.customerA,
      triggeredBy: ids.employeeA,
      occurredAt: '2026-07-13T10:00:00+02:00',
    };
    expect(B3_CONTENT_HASH_VERSION).toBe(1);
    expect(B3_CONTENT_HASH_ALGORITHM).toBe('sha256');
    expect(canonicalWorkEventContent(fields)).toBe(
      `["${ids.eventA}","${ids.organizationA}","${ids.assignmentA}","${ids.tagA}",`+
      `"customer","${ids.customerA}","${ids.employeeA}","2026-07-13T08:00:00.000Z"]`,
    );
    expect(workEventContentHash(fields)).toBe('4107ef70b8a57aff9dfa05cebaa04ddc77efa76ebf7088cb55b884c376e02048');
  });

  it('restricts Membership roles to administrator and employee', async () => {
    const newUserId = '10000000-0000-4000-8000-000000000099';
    await installerPool.query(`INSERT INTO ${B3_SCHEMA}.users (id) VALUES ($1)`, [newUserId]);
    expect(
      await postgresErrorCode(
        installerPool.query(
          `INSERT INTO ${B3_SCHEMA}.memberships
            (id, organization_id, user_id, role) VALUES
            ('12000000-0000-4000-8000-000000000099', $1, $2, 'owner')`,
          [ids.organizationA, newUserId],
        ),
      ),
    ).toBe('23514');
  });

  it('allows only one active Membership per User across Organizations', async () => {
    expect(
      await postgresErrorCode(
        installerPool.query(
          `INSERT INTO ${B3_SCHEMA}.memberships
            (id, organization_id, user_id, role) VALUES
            ('12000000-0000-4000-8000-000000000099', $1, $2, 'employee')`,
          [ids.organizationB, ids.employeeA],
        ),
      ),
    ).toBe('23505');
  });

  it('enforces Organization-scoped NFC payload uniqueness while allowing tenant independence', async () => {
    const count = await installerPool.query<{ count: string }>(
      `SELECT count(*) FROM ${B3_SCHEMA}.nfc_tags WHERE payload_value = 'shared-synthetic-payload'`,
    );
    expect(count.rows[0]?.count).toBe('2');
    expect(
      await postgresErrorCode(
        installerPool.query(
          `INSERT INTO ${B3_SCHEMA}.nfc_tags
            (id, organization_id, display_name, payload_value)
           VALUES ('30000000-0000-4000-8000-000000000099', $1,
             'Synthetic Duplicate Tag', 'shared-synthetic-payload')`,
          [ids.organizationA],
        ),
      ),
    ).toBe('23505');
  });

  it('rejects cross-Organization foreign keys as 23503', async () => {
    expect(
      await postgresErrorCode(
        installerPool.query(
          `INSERT INTO ${B3_SCHEMA}.nfc_assignments
            (id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from)
           VALUES ('40000000-0000-4000-8000-000000000099', $1, $2, 'customer', $3, true, transaction_timestamp())`,
          [ids.organizationA, ids.tagB, ids.customerA],
        ),
      ),
    ).toBe('23503');
  });

  it('enforces exactly one active TimeEntry per Organization and User', async () => {
    expect(
      await postgresErrorCode(
        installerPool.query(
          `INSERT INTO ${B3_SCHEMA}.time_entries
            (id, organization_id, user_id, target_type, target_customer_id, status,
             start_work_event_id, started_at)
           VALUES ('60000000-0000-4000-8000-000000000099', $1, $2, 'customer', $3,
             'started', $4, '2026-07-13T08:00:00Z')`,
          [ids.organizationA, ids.employeeA, ids.customerA, ids.eventA],
        ),
      ),
    ).toBe('23505');
  });

  it('rejects inconsistent Started/Stopped TimeEntry states', async () => {
    expect(
      await postgresErrorCode(
        installerPool.query(
          `UPDATE ${B3_SCHEMA}.time_entries
           SET stopped_at = '2026-07-13T09:00:00Z'
           WHERE id = $1`,
          [ids.timeEntryA],
        ),
      ),
    ).toBe('23514');
  });

  it('rejects a stoppedAt before startedAt', async () => {
    const stopEventId = '50000000-0000-4000-8000-000000000072';
    await insertLifecycleWorkEvent(stopEventId);
    expect(
      await postgresErrorCode(
        installerPool.query(
          `UPDATE ${B3_SCHEMA}.time_entries
           SET status = 'stopped', stop_work_event_id = $1,
             started_at = '2026-07-13T09:00:00Z', stopped_at = '2026-07-13T08:00:00Z', row_version = 2
           WHERE id = $2`,
          [stopEventId, ids.timeEntryA],
        ),
      ),
    ).toBe('23514');
  });

  it('rejects using the same WorkEvent as both TimeEntry start and stop', async () => {
    expect(
      await postgresErrorCode(
        installerPool.query(
          `UPDATE ${B3_SCHEMA}.time_entries
           SET status = 'stopped', stop_work_event_id = start_work_event_id,
             stopped_at = '2026-07-13T09:00:00Z', row_version = 2
           WHERE id = $1`,
          [ids.timeEntryA],
        ),
      ),
    ).toBe('23514');
  });

  it('allows only a versioned started-to-stopped TimeEntry update and prevents reopening', async () => {
    const stopEventId = '50000000-0000-4000-8000-000000000071';
    await insertLifecycleWorkEvent(stopEventId);
    await persistStoppedTimeEntry({ eventId: stopEventId, timeEntryId: ids.timeEntryA });
    expect(
      await postgresErrorCode(
        installerPool.query(
          `UPDATE ${B3_SCHEMA}.time_entries
           SET status = 'started', stop_work_event_id = NULL, stopped_at = NULL, row_version = 3
           WHERE id = $1`,
          [ids.timeEntryA],
        ),
      ),
    ).toBe('23514');
  });

  it('stores occurred_at and received_at as separate facts without an invented offline threshold', async () => {
    const result = await installerPool.query<{ occurred_at: Date; received_at: Date }>(
      `SELECT occurred_at, received_at FROM ${B3_SCHEMA}.work_events WHERE id = $1`,
      [ids.eventA],
    );
    expect(result.rows[0]?.occurred_at.toISOString()).toBe('2026-07-13T08:00:00.000Z');
    expect(result.rows[0]?.received_at.toISOString()).toBe('2026-07-13T08:01:00.000Z');
  });

  it('enforces SHA-256 hash algorithm and canonicalization version 1', async () => {
    expect(
      await postgresErrorCode(
        installerPool.query(
          `UPDATE ${B3_SCHEMA}.work_events SET content_hash_version = 2 WHERE id = $1`,
          [ids.eventA],
        ),
      ),
    ).toBe('23514');
  });

  it('treats an identical WorkEvent retry as no duplicate row', async () => {
    const retried = await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.work_events
       SELECT * FROM ${B3_SCHEMA}.work_events WHERE id = $1
       ON CONFLICT (id) DO NOTHING`,
      [ids.eventA],
    );
    const count = await installerPool.query<{ count: string }>(
      `SELECT count(*) FROM ${B3_SCHEMA}.work_events WHERE id = $1`,
      [ids.eventA],
    );
    expect(retried.rowCount).toBe(0);
    expect(count.rows[0]?.count).toBe('1');
  });

  it('detects same WorkEvent ID with different content hash as a conflict and preserves evidence', async () => {
    const existing = await installerPool.query<{ content_hash: string }>(
      `SELECT content_hash FROM ${B3_SCHEMA}.work_events WHERE id = $1`,
      [ids.eventA],
    );
    const conflictingHash = 'f'.repeat(64);
    expect(existing.rows[0]?.content_hash).not.toBe(conflictingHash);
    expect(
      await postgresErrorCode(
        installerPool.query(
          `INSERT INTO ${B3_SCHEMA}.work_events
           SELECT id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
             triggered_by_user_id, occurred_at, received_at, $2, content_hash_algorithm, content_hash_version
           FROM ${B3_SCHEMA}.work_events WHERE id = $1`,
          [ids.eventA, conflictingHash],
        ),
      ),
    ).toBe('23505');
    const preserved = await installerPool.query<{ content_hash: string }>(
      `SELECT content_hash FROM ${B3_SCHEMA}.work_events WHERE id = $1`,
      [ids.eventA],
    );
    expect(preserved.rows[0]?.content_hash).toBe(existing.rows[0]?.content_hash);
  });

  it('requires an Engine version and explicit WorkEvent/Decision/Receipt/server-TimeEntry mapping', async () => {
    expect(
      await postgresErrorCode(
        installerPool.query(
          `UPDATE ${B3_SCHEMA}.canonical_decisions SET engine_version = NULL WHERE work_event_id = $1`,
          [ids.eventA],
        ),
      ),
    ).toBe('23502');
    const mapping = await installerPool.query<{
      work_event_id: string;
      decision_work_event_id: string;
      server_time_entry_id: string;
    }>(`
      SELECT receipt.work_event_id,
        receipt.server_decision_work_event_id AS decision_work_event_id,
        receipt.server_time_entry_id
      FROM ${B3_SCHEMA}.sync_receipts AS receipt
      JOIN ${B3_SCHEMA}.canonical_decisions AS decision
        ON decision.work_event_id = receipt.server_decision_work_event_id
      JOIN ${B3_SCHEMA}.time_entries AS entry ON entry.id = receipt.server_time_entry_id
      WHERE receipt.work_event_id = $1
    `, [ids.eventA]);
    expect(mapping.rows[0]).toEqual({
      work_event_id: ids.eventA,
      decision_work_event_id: ids.eventA,
      server_time_entry_id: ids.timeEntryA,
    });
  });

  it('stores validity boundaries but no independently mutable duration', async () => {
    const columns = await installerPool.query<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = '${B3_SCHEMA}'
        AND (
          (table_name = 'memberships' AND column_name IN ('created_at', 'revoked_at'))
          OR (table_name = 'nfc_assignments' AND column_name IN ('valid_from', 'valid_to'))
          OR column_name = 'duration'
        )
      ORDER BY table_name, column_name
    `);
    expect(columns.rows).toEqual([
      { table_name: 'memberships', column_name: 'created_at' },
      { table_name: 'memberships', column_name: 'revoked_at' },
      { table_name: 'nfc_assignments', column_name: 'valid_from' },
      { table_name: 'nfc_assignments', column_name: 'valid_to' },
    ]);
  });
});
