import { Pool, type PoolClient } from 'pg';

export const ids = {
  organizationA: '00000000-0000-4000-8000-000000000001',
  organizationB: '00000000-0000-4000-8000-000000000002',
  adminA: '10000000-0000-4000-8000-000000000001',
  employeeA: '10000000-0000-4000-8000-000000000002',
  employeeA2: '10000000-0000-4000-8000-000000000003',
  adminB: '10000000-0000-4000-8000-000000000004',
  employeeB: '10000000-0000-4000-8000-000000000005',
  customerA: '20000000-0000-4000-8000-000000000001',
  customerB: '20000000-0000-4000-8000-000000000002',
  tagA: '30000000-0000-4000-8000-000000000001',
  tagB: '30000000-0000-4000-8000-000000000002',
  assignmentA: '40000000-0000-4000-8000-000000000001',
  assignmentB: '40000000-0000-4000-8000-000000000002',
  eventA: '50000000-0000-4000-8000-000000000001',
  eventA2: '50000000-0000-4000-8000-000000000002',
  eventB: '50000000-0000-4000-8000-000000000003',
  timeEntryA: '60000000-0000-4000-8000-000000000001',
  timeEntryA2: '60000000-0000-4000-8000-000000000002',
  timeEntryB: '60000000-0000-4000-8000-000000000003',
  receiptA: '65000000-0000-4000-8000-000000000001',
  receiptA2: '65000000-0000-4000-8000-000000000002',
  receiptB: '65000000-0000-4000-8000-000000000003',
  auditA: '70000000-0000-4000-8000-000000000001',
  auditB: '70000000-0000-4000-8000-000000000002',
} as const;

export const B3_SYNTHETIC_LOGIN_NAMES = {
  employee: 'taptime_b3_employee_test_login',
  administrator: 'taptime_b3_administrator_test_login',
  lifecycle: 'taptime_b3_lifecycle_test_login',
} as const;

export const B3_APPLICATION_ROLES = [
  'taptime_employee',
  'taptime_administrator',
  'taptime_server_lifecycle',
  'taptime_identity_resolver',
] as const;

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function ensureSyntheticLogins(installerPool: Pool, password: string): Promise<void> {
  for (const [kind, login] of Object.entries(B3_SYNTHETIC_LOGIN_NAMES)) {
    const role = kind === 'employee'
      ? 'taptime_employee'
      : kind === 'administrator'
        ? 'taptime_administrator'
        : 'taptime_server_lifecycle';
    await installerPool.query(`
      DO $login$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(login)}) THEN
          EXECUTE 'CREATE ROLE ${login} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS';
        END IF;
      END
      $login$;
      ALTER ROLE ${login} WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
        NOREPLICATION NOBYPASSRLS
        PASSWORD ${quoteLiteral(password)};
      REVOKE taptime_employee, taptime_administrator, taptime_server_lifecycle,
        taptime_identity_resolver FROM ${login};
      GRANT ${role} TO ${login};
    `);
  }
}

export function runtimeConnectionString(
  baseConnectionString: string,
  kind: keyof typeof B3_SYNTHETIC_LOGIN_NAMES,
  password: string,
): string {
  const url = new URL(baseConnectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('B3 runtime security tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = B3_SYNTHETIC_LOGIN_NAMES[kind];
  url.password = password;
  return url.toString();
}

export async function truncateB3(installerPool: Pool): Promise<void> {
  await installerPool.query(`
    TRUNCATE TABLE
      taptime_server.audit_events,
      taptime_server.sync_receipts,
      taptime_server.canonical_decisions,
      taptime_server.time_entries,
      taptime_server.work_events,
      taptime_server.nfc_assignments,
      taptime_server.nfc_tags,
      taptime_server.customers,
      taptime_server.memberships,
      taptime_server.identity_bindings,
      taptime_server.organizations,
      taptime_server.users
    CASCADE
  `);
}

export async function seedB3(installerPool: Pool): Promise<void> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO taptime_server.users (id) SELECT unnest($1::uuid[])`,
      [[ids.adminA, ids.employeeA, ids.employeeA2, ids.adminB, ids.employeeB]],
    );
    await client.query(
      `INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject) VALUES
        ('11000000-0000-4000-8000-000000000001', $1, 'https://synthetic.invalid/auth', 'admin-a'),
        ('11000000-0000-4000-8000-000000000002', $2, 'https://synthetic.invalid/auth', 'employee-a'),
        ('11000000-0000-4000-8000-000000000003', $3, 'https://synthetic.invalid/auth', 'employee-a2'),
        ('11000000-0000-4000-8000-000000000004', $4, 'https://synthetic.invalid/auth', 'admin-b'),
        ('11000000-0000-4000-8000-000000000005', $5, 'https://synthetic.invalid/auth', 'employee-b')`,
      [ids.adminA, ids.employeeA, ids.employeeA2, ids.adminB, ids.employeeB],
    );
    await client.query(
      `INSERT INTO taptime_server.organizations (id, name) VALUES ($1, 'Synthetic A'), ($2, 'Synthetic B')`,
      [ids.organizationA, ids.organizationB],
    );
    await client.query(
      `INSERT INTO taptime_server.memberships
        (id, organization_id, user_id, role, created_at, created_by_user_id) VALUES
        ('12000000-0000-4000-8000-000000000001', $1, $3, 'administrator', '2026-07-01T00:00:00Z', $3),
        ('12000000-0000-4000-8000-000000000002', $1, $4, 'employee', '2026-07-01T00:00:00Z', $3),
        ('12000000-0000-4000-8000-000000000003', $1, $5, 'employee', '2026-07-01T00:00:00Z', $3),
        ('12000000-0000-4000-8000-000000000004', $2, $6, 'administrator', '2026-07-01T00:00:00Z', $6),
        ('12000000-0000-4000-8000-000000000005', $2, $7, 'employee', '2026-07-01T00:00:00Z', $6)`,
      [ids.organizationA, ids.organizationB, ids.adminA, ids.employeeA, ids.employeeA2, ids.adminB, ids.employeeB],
    );
    await client.query(
      `INSERT INTO taptime_server.customers
        (id, organization_id, active, activated_at) VALUES
        ($1, $3, true, '2026-07-01T00:00:00Z'), ($2, $4, true, '2026-07-01T00:00:00Z')`,
      [ids.customerA, ids.customerB, ids.organizationA, ids.organizationB],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_tags (id, organization_id, payload_value) VALUES
        ($1, $3, 'shared-synthetic-payload'), ($2, $4, 'shared-synthetic-payload')`,
      [ids.tagA, ids.tagB, ids.organizationA, ids.organizationB],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from) VALUES
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
    await insertWorkEvent(client, ids.eventA, ids.organizationA, ids.assignmentA, ids.tagA, ids.customerA, ids.employeeA);
    await insertWorkEvent(client, ids.eventA2, ids.organizationA, ids.assignmentA, ids.tagA, ids.customerA, ids.employeeA2);
    await insertWorkEvent(client, ids.eventB, ids.organizationB, ids.assignmentB, ids.tagB, ids.customerB, ids.employeeB);
    await client.query(
      `INSERT INTO taptime_server.time_entries
        (id, organization_id, user_id, target_type, target_customer_id, status, start_work_event_id, started_at) VALUES
        ($1, $4, $6, 'customer', $9, 'started', $11, '2026-07-13T08:00:00Z'),
        ($2, $4, $7, 'customer', $9, 'started', $12, '2026-07-13T08:00:00Z'),
        ($3, $5, $8, 'customer', $10, 'started', $13, '2026-07-13T08:00:00Z')`,
      [
        ids.timeEntryA,
        ids.timeEntryA2,
        ids.timeEntryB,
        ids.organizationA,
        ids.organizationB,
        ids.employeeA,
        ids.employeeA2,
        ids.employeeB,
        ids.customerA,
        ids.customerB,
        ids.eventA,
        ids.eventA2,
        ids.eventB,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.canonical_decisions
        (work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
         decision_type, time_entry_id, engine_version, decision_payload) VALUES
        ($1, $4, $6, 'customer', $12, 'time_entry_started', $9, 'core-0.1.0', '{"status":"time_entry_started"}'),
        ($2, $4, $7, 'customer', $12, 'time_entry_started', $10, 'core-0.1.0', '{"status":"time_entry_started"}'),
        ($3, $5, $8, 'customer', $13, 'time_entry_started', $11, 'core-0.1.0', '{"status":"time_entry_started"}')`,
      [
        ids.eventA,
        ids.eventA2,
        ids.eventB,
        ids.organizationA,
        ids.organizationB,
        ids.employeeA,
        ids.employeeA2,
        ids.employeeB,
        ids.timeEntryA,
        ids.timeEntryA2,
        ids.timeEntryB,
        ids.customerA,
        ids.customerB,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.sync_receipts
        (id, work_event_id, organization_id, user_id, target_type, target_customer_id,
         attempt_number, attempted_at, status, server_decision_work_event_id,
         client_time_entry_id, server_time_entry_id) VALUES
        ($12, $1, $4, $6, 'customer', $15, 1, '2026-07-13T08:01:00Z', 'synchronized', $1,
         '61000000-0000-4000-8000-000000000001', $9),
        ($13, $2, $4, $7, 'customer', $15, 1, '2026-07-13T08:01:00Z', 'synchronized', $2,
         '61000000-0000-4000-8000-000000000002', $10),
        ($14, $3, $5, $8, 'customer', $16, 1, '2026-07-13T08:01:00Z', 'synchronized', $3,
         '61000000-0000-4000-8000-000000000003', $11)`,
      [
        ids.eventA,
        ids.eventA2,
        ids.eventB,
        ids.organizationA,
        ids.organizationB,
        ids.employeeA,
        ids.employeeA2,
        ids.employeeB,
        ids.timeEntryA,
        ids.timeEntryA2,
        ids.timeEntryB,
        ids.receiptA,
        ids.receiptA2,
        ids.receiptB,
        ids.customerA,
        ids.customerB,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.audit_events
        (id, organization_id, actor_user_id, work_event_user_id, work_event_id, event_type,
         entity_type, entity_id, occurred_at, correlation_id, payload) VALUES
        ($1, $3, $5, $5, $7, 'LifecycleEvaluated', 'WorkEvent', $7, '2026-07-13T08:01:00Z', 'synthetic-a', '{}'),
        ($2, $4, $6, $6, $8, 'LifecycleEvaluated', 'WorkEvent', $8, '2026-07-13T08:01:00Z', 'synthetic-b', '{}')`,
      [ids.auditA, ids.auditB, ids.organizationA, ids.organizationB, ids.employeeA, ids.employeeB, ids.eventA, ids.eventB],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertWorkEvent(
  client: PoolClient,
  id: string,
  organizationId: string,
  assignmentId: string,
  tagId: string,
  customerId: string,
  userId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.work_events
      (id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
       triggered_by_user_id, occurred_at, received_at, content_hash, content_hash_algorithm, content_hash_version)
     VALUES ($1, $2, $3, $4, 'customer', $5, $6, '2026-07-13T08:00:00Z',
       '2026-07-13T08:01:00Z', $7, 'sha256', 1)`,
    [id, organizationId, assignmentId, tagId, customerId, userId, id.replaceAll('-', '').padEnd(64, 'a').slice(0, 64)],
  );
}

export async function postgresErrorCode(operation: Promise<unknown>): Promise<string | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : undefined;
  }
}
