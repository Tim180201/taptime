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
  it('applies exactly eight sorted versioned migrations through the authorized C3E1 addition', async () => {
    const rows = await installerPool.query<{ version: string; checksum: string }>(
      `SELECT version, checksum FROM ${B3_MIGRATION_TABLE} ORDER BY version`,
    );

    expect(rows.rows.map((row) => row.version)).toEqual(['001', '002', '003', '004', '005', '006', '007', '008']);
    expect(rows.rows.every((row) => /^[0-9a-f]{64}$/.test(row.checksum))).toBe(true);
  });

  it('reruns safely without applying any migration twice', async () => {
    await expect(migrate(installerPool)).resolves.toEqual({
      applied: [],
      alreadyApplied: ['001', '002', '003', '004', '005', '006', '007', '008'],
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

  it('contains exactly the seventeen approved logical server tables', async () => {
    const result = await installerPool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [B3_SCHEMA],
    );
    expect(result.rows.map((row) => row.table_name)).toEqual([
      'admin_setup_command_receipts',
      'audit_events',
      'bootstrap_receipts',
      'canonical_decisions',
      'customers',
      'employee_enrollment_redemption_receipts',
      'employee_invitation_command_receipts',
      'employee_membership_invitations',
      'identity_bindings',
      'memberships',
      'nfc_assignments',
      'nfc_tags',
      'organizations',
      'sync_receipts',
      'time_entries',
      'users',
      'work_events',
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
    expect(result.rows[0]?.count).toBe('17');
  });
});

describe('B3 least-privilege roles and request context', () => {
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

  it('lets an Administrator create, update and delete configuration only in the own Organization', async () => {
    const id = '20000000-0000-4000-8000-000000000099';
    const inserted = await adminQuery(
      adminAContext,
      `INSERT INTO ${B3_SCHEMA}.customers
        (id, organization_id, display_name, active)
       VALUES ($1, $2, 'Synthetic Administrator Customer', true)`,
      [id, ids.organizationA],
    );
    const updated = await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.customers
       SET active = false, deactivated_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [id],
    );
    const deleted = await adminQuery(adminAContext, `DELETE FROM ${B3_SCHEMA}.customers WHERE id = $1`, [id]);
    expect([inserted.rowCount, updated.rowCount, deleted.rowCount]).toEqual([1, 1, 1]);
  });

  it('blocks Administrator SELECT/UPDATE/DELETE against another Organization without disclosure', async () => {
    const selected = await adminQuery(adminAContext, `SELECT id FROM ${B3_SCHEMA}.customers WHERE id = $1`, [ids.customerB]);
    const guessedUser = await adminQuery(adminAContext, `SELECT id FROM ${B3_SCHEMA}.users WHERE id = $1`, [ids.employeeB]);
    const updated = await adminQuery(adminAContext, `UPDATE ${B3_SCHEMA}.customers SET row_version = 2 WHERE id = $1`, [ids.customerB]);
    const deleted = await adminQuery(adminAContext, `DELETE FROM ${B3_SCHEMA}.customers WHERE id = $1`, [ids.customerB]);
    expect([selected.rowCount, guessedUser.rowCount, updated.rowCount, deleted.rowCount]).toEqual([0, 0, 0, 0]);
  });

  it('rejects an Administrator cross-tenant INSERT through RLS', async () => {
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
  it('denies every historical or ownership-column mutation through column grants', async () => {
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

  it('requires exact row_version advancement for allowed updates', async () => {
    expect(
      await postgresErrorCode(
        adminQuery(
          adminAContext,
          `UPDATE ${B3_SCHEMA}.memberships SET role = 'administrator' WHERE user_id = $1`,
          [ids.employeeA],
        ),
      ),
    ).toBe('23514');
    const updated = await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.memberships
       SET role = 'administrator', row_version = row_version + 1 WHERE user_id = $1`,
      [ids.employeeA],
    );
    expect(updated.rowCount).toBe(1);
  });

  it('allows a one-way Membership revocation but rejects un-revoke', async () => {
    const revoked = await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1 WHERE user_id = $1`,
      [ids.employeeA],
    );
    expect(revoked.rowCount).toBe(1);
    expect(
      await postgresErrorCode(
        adminQuery(
          adminAContext,
          `UPDATE ${B3_SCHEMA}.memberships
           SET revoked_at = NULL, row_version = row_version + 1 WHERE user_id = $1`,
          [ids.employeeA],
        ),
      ),
    ).toBe('23514');
  });

  it('allows one-way Customer deactivation but rejects reactivation', async () => {
    await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.customers
       SET active = false, deactivated_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [ids.customerA],
    );
    expect(
      await postgresErrorCode(
        adminQuery(
          adminAContext,
          `UPDATE ${B3_SCHEMA}.customers
           SET active = true, deactivated_at = NULL, row_version = row_version + 1 WHERE id = $1`,
          [ids.customerA],
        ),
      ),
    ).toBe('23514');
  });

  it('allows one-way Assignment deactivation but rejects reactivation', async () => {
    await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.nfc_assignments
       SET active = false, valid_to = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [ids.assignmentA],
    );
    expect(
      await postgresErrorCode(
        adminQuery(
          adminAContext,
          `UPDATE ${B3_SCHEMA}.nfc_assignments
           SET active = true, valid_to = NULL, row_version = row_version + 1 WHERE id = $1`,
          [ids.assignmentA],
        ),
      ),
    ).toBe('23514');
  });
});

describe('B3 atomic administrative audit evidence', () => {
  it('audits every allowlisted administrative operation in the same transaction', async () => {
    const userId = '10000000-0000-4000-8000-000000000080';
    const membershipId = '12000000-0000-4000-8000-000000000080';
    const deletedCustomerId = '20000000-0000-4000-8000-000000000080';
    const deactivatedCustomerId = '20000000-0000-4000-8000-000000000081';
    const deletedTagId = '30000000-0000-4000-8000-000000000080';
    const assignmentTagId = '30000000-0000-4000-8000-000000000081';
    const assignmentId = '40000000-0000-4000-8000-000000000080';
    await installerPool.query(`INSERT INTO ${B3_SCHEMA}.users (id) VALUES ($1)`, [userId]);
    await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.organizations SET name = 'Synthetic A audited', row_version = row_version + 1 WHERE id = $1`,
      [ids.organizationA],
    );
    await adminQuery(
      adminAContext,
      `INSERT INTO ${B3_SCHEMA}.memberships
        (id, organization_id, user_id, role, created_by_user_id)
       VALUES ($1, $2, $3, 'employee', $4)`,
      [membershipId, ids.organizationA, userId, ids.adminA],
    );
    await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.memberships
       SET role = 'administrator', row_version = row_version + 1 WHERE id = $1`,
      [membershipId],
    );
    await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1 WHERE id = $1`,
      [membershipId],
    );
    await adminQuery(
      adminAContext,
      `INSERT INTO ${B3_SCHEMA}.customers (id, organization_id, display_name, active)
       VALUES ($1, $2, 'Synthetic Deleted Customer', true)`,
      [deletedCustomerId, ids.organizationA],
    );
    await adminQuery(adminAContext, `DELETE FROM ${B3_SCHEMA}.customers WHERE id = $1`, [deletedCustomerId]);
    await adminQuery(
      adminAContext,
      `INSERT INTO ${B3_SCHEMA}.customers (id, organization_id, display_name, active)
       VALUES ($1, $2, 'Synthetic Deactivated Customer', true)`,
      [deactivatedCustomerId, ids.organizationA],
    );
    await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.customers
       SET active = false, deactivated_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [deactivatedCustomerId],
    );
    await adminQuery(
      adminAContext,
      `INSERT INTO ${B3_SCHEMA}.nfc_tags (id, organization_id, display_name, payload_value)
       VALUES ($1, $2, 'Synthetic Deleted Tag', 'do-not-audit-full-nfc-payload')`,
      [deletedTagId, ids.organizationA],
    );
    await adminQuery(adminAContext, `DELETE FROM ${B3_SCHEMA}.nfc_tags WHERE id = $1`, [deletedTagId]);
    await adminQuery(
      adminAContext,
      `INSERT INTO ${B3_SCHEMA}.nfc_tags (id, organization_id, display_name, payload_value)
       VALUES ($1, $2, 'Synthetic Assignment Tag', 'assignment-only-synthetic-payload')`,
      [assignmentTagId, ids.organizationA],
    );
    await adminQuery(
      adminAContext,
      `INSERT INTO ${B3_SCHEMA}.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
       VALUES ($1, $2, $3, 'customer', $4, true)`,
      [assignmentId, ids.organizationA, assignmentTagId, ids.customerA],
    );
    await adminQuery(
      adminAContext,
      `UPDATE ${B3_SCHEMA}.nfc_assignments
       SET active = false, valid_to = transaction_timestamp(), row_version = row_version + 1 WHERE id = $1`,
      [assignmentId],
    );

    const audit = await installerPool.query<{ event_type: string; count: string }>(`
      SELECT event_type, count(*)::text AS count
      FROM ${B3_SCHEMA}.audit_events
      WHERE actor_user_id = $1 AND event_type <> 'LifecycleEvaluated'
      GROUP BY event_type
      ORDER BY event_type
    `, [ids.adminA]);
    expect(audit.rows).toEqual([
      { event_type: 'CustomerCreated', count: '2' },
      { event_type: 'CustomerDeactivated', count: '1' },
      { event_type: 'CustomerDeleted', count: '1' },
      { event_type: 'MembershipGranted', count: '1' },
      { event_type: 'MembershipRevoked', count: '1' },
      { event_type: 'MembershipRoleChanged', count: '1' },
      { event_type: 'NfcAssignmentDeactivated', count: '1' },
      { event_type: 'NfcTagAssigned', count: '1' },
      { event_type: 'NfcTagDeleted', count: '1' },
      { event_type: 'NfcTagRegistered', count: '2' },
      { event_type: 'OrganizationUpdated', count: '1' },
    ]);
  });

  it('stores only allowlisted administrative audit payload fields', async () => {
    const tagId = '30000000-0000-4000-8000-000000000082';
    await adminQuery(
      adminAContext,
      `INSERT INTO ${B3_SCHEMA}.nfc_tags (id, organization_id, display_name, payload_value)
       VALUES ($1, $2, 'Synthetic Audit Tag', 'credential-like-value-must-not-be-audited')`,
      [tagId, ids.organizationA],
    );
    const audit = await installerPool.query<{ payload: Record<string, unknown>; serialized: string }>(
      `SELECT payload, payload::text AS serialized
       FROM ${B3_SCHEMA}.audit_events WHERE entity_id = $1 AND event_type = 'NfcTagRegistered'`,
      [tagId],
    );
    expect(audit.rows[0]?.payload).toEqual({});
    expect(audit.rows[0]?.serialized).not.toContain('credential-like-value');
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

  it('rolls back administrative data and its AuditEvent atomically', async () => {
    const before = await installerPool.query<{ name: string; audit_count: string }>(`
      SELECT name,
        (SELECT count(*) FROM ${B3_SCHEMA}.audit_events WHERE actor_user_id = $2) AS audit_count
      FROM ${B3_SCHEMA}.organizations WHERE id = $1
    `, [ids.organizationA, ids.adminA]);
    await expect(
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
          throw new Error('synthetic administrative rollback');
        },
      ),
    ).rejects.toThrow('synthetic administrative rollback');
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
