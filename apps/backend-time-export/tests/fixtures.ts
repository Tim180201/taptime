import { Pool, type PoolClient } from 'pg';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '@taptime/backend-schema';
import type { AccessTokenVerifier, AccessTokenVerificationResult } from '@taptime/backend-identity';

export const DA2_ISSUER = 'https://synthetic.invalid/auth';
export const DA2_RUNTIME_LOGIN = 'taptime_da2_export_runtime';

export const ids = Object.freeze({
  organizationA: '00000000-0000-4000-8000-000000000101',
  organizationB: '00000000-0000-4000-8000-000000000102',
  adminA: '10000000-0000-4000-8000-000000000101',
  employeeA: '10000000-0000-4000-8000-000000000102',
  employeeA2: '10000000-0000-4000-8000-000000000103',
  adminB: '10000000-0000-4000-8000-000000000104',
  employeeB: '10000000-0000-4000-8000-000000000105',
  membershipAdminA: '12000000-0000-4000-8000-000000000101',
  membershipEmployeeA: '12000000-0000-4000-8000-000000000102',
  membershipEmployeeA2: '12000000-0000-4000-8000-000000000103',
  membershipAdminB: '12000000-0000-4000-8000-000000000104',
  membershipEmployeeB: '12000000-0000-4000-8000-000000000105',
  customerA: '20000000-0000-4000-8000-000000000101',
  customerB: '20000000-0000-4000-8000-000000000102',
  tagA: '30000000-0000-4000-8000-000000000101',
  tagB: '30000000-0000-4000-8000-000000000102',
  assignmentA: '40000000-0000-4000-8000-000000000101',
  assignmentB: '40000000-0000-4000-8000-000000000102',
  stoppedStartEventA: '50000000-0000-4000-8000-000000000101',
  stoppedStopEventA: '50000000-0000-4000-8000-000000000102',
  activeStartEventA: '50000000-0000-4000-8000-000000000103',
  activeStartEventB: '50000000-0000-4000-8000-000000000104',
  stoppedEntryA: '60000000-0000-4000-8000-000000000101',
  activeEntryA: '60000000-0000-4000-8000-000000000102',
  activeEntryB: '60000000-0000-4000-8000-000000000103',
});

export const tokens = Object.freeze({
  adminA: 'token-admin-a',
  employeeA: 'token-employee-a',
  adminB: 'token-admin-b',
  rejected: 'token-rejected',
});

const tokenSubjects: Readonly<Record<string, string>> = Object.freeze({
  [tokens.adminA]: 'admin-a',
  [tokens.employeeA]: 'employee-a',
  [tokens.adminB]: 'admin-b',
});

export const verifier: AccessTokenVerifier = Object.freeze({
  async verify(accessToken: string): Promise<AccessTokenVerificationResult> {
    const subject = tokenSubjects[accessToken];
    return subject === undefined
      ? { status: 'rejected', reason: 'invalid_signature' }
      : { status: 'verified', identity: { issuer: DA2_ISSUER, subject } };
  },
});

export async function resetMigrateAndPrepare(
  installerPool: Pool,
  runtimePassword: string,
): Promise<void> {
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  const result = await migrate(installerPool);
  if (result.applied.join(',') !== '001,002,003,004,005,006,007,008,009,010,011,012,013') {
    throw new Error('DA2 requires a clean migration set 001 through 013');
  }
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${DA2_RUNTIME_LOGIN}'
      ) THEN
        CREATE ROLE ${DA2_RUNTIME_LOGIN}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${DA2_RUNTIME_LOGIN} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD ${quoteLiteral(runtimePassword)};
    ALTER ROLE ${DA2_RUNTIME_LOGIN} RESET ALL;
    DO $parents$
    DECLARE parent_name text;
    BEGIN
      FOR parent_name IN
        SELECT parent.rolname
        FROM pg_catalog.pg_auth_members AS membership
        JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
        JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
        WHERE member.rolname = '${DA2_RUNTIME_LOGIN}'
      LOOP
        EXECUTE pg_catalog.format('REVOKE %I FROM ${DA2_RUNTIME_LOGIN}', parent_name);
      END LOOP;
    END
    $parents$;
    REVOKE ALL PRIVILEGES ON SCHEMA ${B3_SCHEMA} FROM ${DA2_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${B3_SCHEMA}
      FROM ${DA2_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${B3_SCHEMA}
      FROM ${DA2_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${B3_SCHEMA}
      FROM ${DA2_RUNTIME_LOGIN};
    GRANT taptime_identity_resolver TO ${DA2_RUNTIME_LOGIN}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
    GRANT taptime_time_exporter TO ${DA2_RUNTIME_LOGIN}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
  `);
}

export async function seedDa2(installerPool: Pool, longNames = false): Promise<void> {
  const longName = '🕒'.repeat(120);
  const organizationAName = longNames ? longName : 'TapTim.e Nord';
  const employeeAName = longNames ? longName : 'Jörg Export';
  const customerAName = longNames ? longName : '=Kunde; "Nord"';
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO taptime_server.users (id) SELECT unnest($1::uuid[])`,
      [[ids.adminA, ids.employeeA, ids.employeeA2, ids.adminB, ids.employeeB]],
    );
    await client.query(
      `INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject) VALUES
        ('11000000-0000-4000-8000-000000000101', $1, $6, 'admin-a'),
        ('11000000-0000-4000-8000-000000000102', $2, $6, 'employee-a'),
        ('11000000-0000-4000-8000-000000000103', $3, $6, 'employee-a2'),
        ('11000000-0000-4000-8000-000000000104', $4, $6, 'admin-b'),
        ('11000000-0000-4000-8000-000000000105', $5, $6, 'employee-b')`,
      [ids.adminA, ids.employeeA, ids.employeeA2, ids.adminB, ids.employeeB, DA2_ISSUER],
    );
    await client.query(
      `INSERT INTO taptime_server.organizations (id, name) VALUES
        ($1, $3), ($2, 'TapTim.e Süd')`,
      [ids.organizationA, ids.organizationB, organizationAName],
    );
    await client.query(
      `INSERT INTO taptime_server.memberships
        (id, organization_id, user_id, role, created_by_user_id, display_name) VALUES
        ($1, $6, $8, 'administrator', $8, 'Admin A'),
        ($2, $6, $9, 'employee', $8, $13),
        ($3, $6, $10, 'employee', $8, 'Employee A2'),
        ($4, $7, $11, 'administrator', $11, 'Admin B'),
        ($5, $7, $12, 'employee', $11, 'Employee B')`,
      [
        ids.membershipAdminA,
        ids.membershipEmployeeA,
        ids.membershipEmployeeA2,
        ids.membershipAdminB,
        ids.membershipEmployeeB,
        ids.organizationA,
        ids.organizationB,
        ids.adminA,
        ids.employeeA,
        ids.employeeA2,
        ids.adminB,
        ids.employeeB,
        employeeAName,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.customers
        (id, organization_id, display_name, active, activated_at) VALUES
        ($1, $3, $5, true, '2026-07-01T00:00:00Z'),
        ($2, $4, 'Customer B', true, '2026-07-01T00:00:00Z')`,
      [ids.customerA, ids.customerB, ids.organizationA, ids.organizationB, customerAName],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_tags
        (id, organization_id, display_name, payload_value) VALUES
        ($1, $3, 'Tag A', 'nfc:uid:v1:01'),
        ($2, $4, 'Tag B', 'nfc:uid:v1:02')`,
      [ids.tagA, ids.tagB, ids.organizationA, ids.organizationB],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from)
       VALUES
        ($1, $3, $5, 'customer', $7, true, '2026-07-01T00:00:00Z'),
        ($2, $4, $6, 'customer', $8, true, '2026-07-01T00:00:00Z')`,
      [
        ids.assignmentA,
        ids.assignmentB,
        ids.organizationA,
        ids.organizationB,
        ids.tagA,
        ids.tagB,
        ids.customerA,
        ids.customerB,
      ],
    );
    await insertWorkEvent(
      client,
      ids.stoppedStartEventA,
      ids.organizationA,
      ids.assignmentA,
      ids.tagA,
      ids.customerA,
      ids.employeeA,
      '2026-07-21T08:00:00.123456Z',
    );
    await insertWorkEvent(
      client,
      ids.activeStartEventA,
      ids.organizationA,
      ids.assignmentA,
      ids.tagA,
      ids.customerA,
      ids.employeeA2,
      '2026-07-21T10:00:00.000000Z',
    );
    await insertWorkEvent(
      client,
      ids.activeStartEventB,
      ids.organizationB,
      ids.assignmentB,
      ids.tagB,
      ids.customerB,
      ids.employeeB,
      '2026-07-21T10:00:00.000000Z',
    );
    await client.query(
      `INSERT INTO taptime_server.time_entries
        (id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at) VALUES
        ($1, $4, $6, 'customer', $9, 'started', $11, '2026-07-21T08:00:00.123456Z'),
        ($2, $4, $7, 'customer', $9, 'started', $12, '2026-07-21T10:00:00.000000Z'),
        ($3, $5, $8, 'customer', $10, 'started', $13, '2026-07-21T10:00:00.000000Z')`,
      [
        ids.stoppedEntryA,
        ids.activeEntryA,
        ids.activeEntryB,
        ids.organizationA,
        ids.organizationB,
        ids.employeeA,
        ids.employeeA2,
        ids.employeeB,
        ids.customerA,
        ids.customerB,
        ids.stoppedStartEventA,
        ids.activeStartEventA,
        ids.activeStartEventB,
      ],
    );
    await insertStartDecision(
      client,
      ids.stoppedStartEventA,
      ids.organizationA,
      ids.employeeA,
      ids.customerA,
      ids.stoppedEntryA,
    );
    await insertStartDecision(
      client,
      ids.activeStartEventA,
      ids.organizationA,
      ids.employeeA2,
      ids.customerA,
      ids.activeEntryA,
    );
    await insertStartDecision(
      client,
      ids.activeStartEventB,
      ids.organizationB,
      ids.employeeB,
      ids.customerB,
      ids.activeEntryB,
    );
    await client.query('COMMIT');

    await client.query('BEGIN');
    await insertWorkEvent(
      client,
      ids.stoppedStopEventA,
      ids.organizationA,
      ids.assignmentA,
      ids.tagA,
      ids.customerA,
      ids.employeeA,
      '2026-07-21T09:02:03.123457Z',
    );
    await client.query(
      `UPDATE taptime_server.time_entries
       SET status = 'stopped', stop_work_event_id = $1,
         stopped_at = '2026-07-21T09:02:03.123457Z', row_version = row_version + 1
       WHERE id = $2`,
      [ids.stoppedStopEventA, ids.stoppedEntryA],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         decision_type, time_entry_id, engine_version, decision_payload)
       VALUES ($1, $2, $3, 'customer', $4, 'time_entry_stopped', $5, 'da2-test', '{}')`,
      [
        ids.stoppedStopEventA,
        ids.organizationA,
        ids.employeeA,
        ids.customerA,
        ids.stoppedEntryA,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function insertBulkStoppedEntries(
  installerPool: Pool,
  count: number,
): Promise<void> {
  await installerPool.query(`
    ALTER TABLE taptime_server.canonical_decisions
      DISABLE TRIGGER canonical_decisions_result_consistency
  `);
  try {
    await installerPool.query(`
    INSERT INTO taptime_server.work_events
      (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
       triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
       content_hash_version)
    SELECT
      ('51000001-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      '${ids.organizationA}'::uuid, '${ids.assignmentA}'::uuid, '${ids.tagA}'::uuid, 'customer',
      '${ids.customerA}'::uuid, '${ids.employeeA}'::uuid,
      '2026-07-22T00:00:00Z'::timestamptz + series.value * interval '1 second',
      pg_catalog.repeat('a', 64), 'sha256', 1
    FROM pg_catalog.generate_series(1, ${count}) AS series(value)
    UNION ALL
    SELECT
      ('51000002-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      '${ids.organizationA}'::uuid, '${ids.assignmentA}'::uuid, '${ids.tagA}'::uuid, 'customer',
      '${ids.customerA}'::uuid, '${ids.employeeA}'::uuid,
      '2026-07-22T00:30:00Z'::timestamptz + series.value * interval '1 second',
      pg_catalog.repeat('b', 64), 'sha256', 1
    FROM pg_catalog.generate_series(1, ${count}) AS series(value);

    INSERT INTO taptime_server.time_entries
      (id, organization_id, user_id, target_type, target_customer_id, status,
       start_work_event_id, started_at, stop_work_event_id, stopped_at)
    SELECT
      ('61000000-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      '${ids.organizationA}'::uuid, '${ids.employeeA}'::uuid, 'customer',
      '${ids.customerA}'::uuid, 'stopped',
      ('51000001-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      '2026-07-22T00:00:00Z'::timestamptz + series.value * interval '1 second',
      ('51000002-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      '2026-07-22T00:30:00Z'::timestamptz + series.value * interval '1 second'
    FROM pg_catalog.generate_series(1, ${count}) AS series(value);

    INSERT INTO taptime_server.canonical_decisions
      (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
       decision_type, time_entry_id, engine_version, decision_payload)
    SELECT
      ('51000001-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      '${ids.organizationA}'::uuid, '${ids.employeeA}'::uuid, 'customer',
      '${ids.customerA}'::uuid,
      'time_entry_started',
      ('61000000-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      'da2-limit-test', '{}'::jsonb
    FROM pg_catalog.generate_series(1, ${count}) AS series(value)
    UNION ALL
    SELECT
      ('51000002-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      '${ids.organizationA}'::uuid, '${ids.employeeA}'::uuid, 'customer',
      '${ids.customerA}'::uuid,
      'time_entry_stopped',
      ('61000000-0000-4000-8000-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
      'da2-limit-test', '{}'::jsonb
    FROM pg_catalog.generate_series(1, ${count}) AS series(value);
    `);
  } finally {
    await installerPool.query(`
      ALTER TABLE taptime_server.canonical_decisions
        ENABLE TRIGGER canonical_decisions_result_consistency
    `);
  }
}

export function runtimeConnectionString(
  installerConnectionString: string,
  runtimePassword: string,
): string {
  const url = new URL(installerConnectionString);
  url.username = DA2_RUNTIME_LOGIN;
  url.password = runtimePassword;
  return url.href;
}

async function insertWorkEvent(
  client: PoolClient,
  id: string,
  organizationId: string,
  assignmentId: string,
  tagId: string,
  customerId: string,
  userId: string,
  occurredAt: string,
): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.work_events
      (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
       triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
       content_hash_version)
     VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, $8, 'sha256', 1)`,
    [id, organizationId, assignmentId, tagId, customerId, userId, occurredAt, 'c'.repeat(64)],
  );
}

async function insertStartDecision(
  client: PoolClient,
  eventId: string,
  organizationId: string,
  userId: string,
  customerId: string,
  timeEntryId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.canonical_decisions
      (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
       decision_type, time_entry_id, engine_version, decision_payload)
     VALUES ($1, $2, $3, 'customer', $4, 'time_entry_started', $5, 'da2-test', '{}')`,
    [eventId, organizationId, userId, customerId, timeEntryId],
  );
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
