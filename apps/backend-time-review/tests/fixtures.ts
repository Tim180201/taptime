import { Pool, type PoolClient } from 'pg';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '@taptime/backend-schema';
import type { AccessTokenVerifier, AccessTokenVerificationResult } from '@taptime/backend-identity';

export const DA3_ISSUER = 'https://synthetic.invalid/auth';
export const DA3_READ_LOGIN = 'taptime_da3_read_runtime';
export const DA3_WRITE_LOGIN = 'taptime_da3_write_runtime';

export const ids = Object.freeze({
  organizationA: '00000000-0000-4000-8000-000000000301',
  organizationB: '00000000-0000-4000-8000-000000000302',
  adminA: '10000000-0000-4000-8000-000000000301',
  employeeA: '10000000-0000-4000-8000-000000000302',
  adminB: '10000000-0000-4000-8000-000000000303',
  membershipAdminA: '12000000-0000-4000-8000-000000000301',
  membershipEmployeeA: '12000000-0000-4000-8000-000000000302',
  membershipAdminB: '12000000-0000-4000-8000-000000000303',
  customerA: '20000000-0000-4000-8000-000000000301',
  customerB: '20000000-0000-4000-8000-000000000302',
  tagA: '30000000-0000-4000-8000-000000000301',
  tagB: '30000000-0000-4000-8000-000000000302',
  assignmentA: '40000000-0000-4000-8000-000000000301',
  assignmentB: '40000000-0000-4000-8000-000000000302',
  stoppedStartEventA: '50000000-0000-4000-8000-000000000301',
  stoppedStopEventA: '50000000-0000-4000-8000-000000000302',
  activeStartEventA: '50000000-0000-4000-8000-000000000303',
  legacyReviewEventA: '50000000-0000-4000-8000-000000000304',
  stoppedEntryA: '60000000-0000-4000-8000-000000000301',
  activeEntryA: '60000000-0000-4000-8000-000000000302',
  correctionCommand: '80000000-0000-4000-8000-000000000301',
  adjudicationCommand: '80000000-0000-4000-8000-000000000302',
});

export const tokens = Object.freeze({
  adminA: 'token-admin-a',
  employeeA: 'token-employee-a',
  adminB: 'token-admin-b',
  rejected: 'token-rejected',
});

const subjects: Readonly<Record<string, string>> = Object.freeze({
  [tokens.adminA]: 'admin-a',
  [tokens.employeeA]: 'employee-a',
  [tokens.adminB]: 'admin-b',
});

export const verifier: AccessTokenVerifier = Object.freeze({
  async verify(accessToken: string): Promise<AccessTokenVerificationResult> {
    const subject = subjects[accessToken];
    return subject === undefined
      ? { status: 'rejected', reason: 'invalid_signature' }
      : { status: 'verified', identity: { issuer: DA3_ISSUER, subject } };
  },
});

export async function resetMigratePrepareAndSeed(
  installerPool: Pool,
  runtimePassword: string,
): Promise<void> {
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  const migrated = await migrate(installerPool);
  if (migrated.applied.join(',') !== '001,002,003,004,005,006,007,008,009,010,011,012,013') {
    throw new Error('DA3 requires a clean migration set 001 through 013');
  }
  await prepareLogin(installerPool, DA3_READ_LOGIN, runtimePassword, 'taptime_time_review_reader');
  await prepareLogin(installerPool, DA3_WRITE_LOGIN, runtimePassword, 'taptime_time_review_writer');
  await seed(installerPool);
}

export function runtimeConnectionString(
  installerConnectionString: string,
  login: string,
  password: string,
): string {
  const url = new URL(installerConnectionString);
  url.username = login;
  url.password = password;
  return url.href;
}

async function prepareLogin(
  installerPool: Pool,
  login: string,
  password: string,
  capability: string,
): Promise<void> {
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${login}') THEN
        CREATE ROLE ${login}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${login} WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD ${quoteLiteral(password)};
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
        EXECUTE pg_catalog.format('REVOKE %I FROM ${login}', parent_name);
      END LOOP;
    END
    $parents$;
    REVOKE ALL PRIVILEGES ON SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${B3_SCHEMA} FROM ${login};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${B3_SCHEMA} FROM ${login};
    GRANT taptime_identity_resolver TO ${login}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
    GRANT ${capability} TO ${login}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
  `);
}

async function seed(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO taptime_server.users (id) SELECT unnest($1::uuid[])`,
      [[ids.adminA, ids.employeeA, ids.adminB]],
    );
    await client.query(
      `INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject) VALUES
        ('11000000-0000-4000-8000-000000000301', $1, $4, 'admin-a'),
        ('11000000-0000-4000-8000-000000000302', $2, $4, 'employee-a'),
        ('11000000-0000-4000-8000-000000000303', $3, $4, 'admin-b')`,
      [ids.adminA, ids.employeeA, ids.adminB, DA3_ISSUER],
    );
    await client.query(
      `INSERT INTO taptime_server.organizations (id, name) VALUES
        ($1, 'TapTim.e A'), ($2, 'TapTim.e B')`,
      [ids.organizationA, ids.organizationB],
    );
    await client.query(
      `INSERT INTO taptime_server.memberships
        (id, organization_id, user_id, role, created_by_user_id, display_name) VALUES
        ($1, $4, $6, 'administrator', $6, 'Admin A'),
        ($2, $4, $7, 'employee', $6, 'Employee A'),
        ($3, $5, $8, 'administrator', $8, 'Admin B')`,
      [
        ids.membershipAdminA, ids.membershipEmployeeA, ids.membershipAdminB,
        ids.organizationA, ids.organizationB, ids.adminA, ids.employeeA, ids.adminB,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.customers
        (id, organization_id, display_name, active, activated_at) VALUES
        ($1, $3, 'Customer A', true, '2026-07-01T00:00:00Z'),
        ($2, $4, 'Customer B', true, '2026-07-01T00:00:00Z')`,
      [ids.customerA, ids.customerB, ids.organizationA, ids.organizationB],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_tags
        (id, organization_id, display_name, payload_value) VALUES
        ($1, $3, 'Tag A', 'da3-a'), ($2, $4, 'Tag B', 'da3-b')`,
      [ids.tagA, ids.tagB, ids.organizationA, ids.organizationB],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active, valid_from)
       VALUES
        ($1, $3, $5, 'customer', $7, true, '2026-07-01T00:00:00Z'),
        ($2, $4, $6, 'customer', $8, true, '2026-07-01T00:00:00Z')`,
      [
        ids.assignmentA, ids.assignmentB, ids.organizationA, ids.organizationB,
        ids.tagA, ids.tagB, ids.customerA, ids.customerB,
      ],
    );
    await insertEvent(client, ids.stoppedStartEventA, '2026-07-20T08:00:00Z');
    await insertEvent(client, ids.stoppedStopEventA, '2026-07-20T16:00:00Z');
    await insertEvent(client, ids.activeStartEventA, '2026-07-21T08:00:00Z');
    await insertEvent(client, ids.legacyReviewEventA, '2026-07-21T12:00:00Z');
    await client.query(
      `INSERT INTO taptime_server.time_entries
        (id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at, stop_work_event_id, stopped_at, row_version)
       VALUES
        ($1, $2, $3, 'customer', $4, 'started', $5, '2026-07-20T08:00:00Z',
         NULL, NULL, 1)`,
      [
        ids.stoppedEntryA, ids.organizationA, ids.employeeA,
        ids.customerA, ids.stoppedStartEventA,
      ],
    );
    await insertDecision(client, ids.stoppedStartEventA, 'time_entry_started', ids.stoppedEntryA);
    await client.query(
      `INSERT INTO taptime_server.audit_events
        (id, organization_id, actor_user_id, work_event_user_id, work_event_id,
         event_type, entity_type, entity_id, occurred_at, correlation_id, payload)
       VALUES
        ('70000000-0000-4000-8000-000000000301', $1, $2, $2, $3,
         'LifecycleDeferred', 'WorkEvent', $3, transaction_timestamp(),
         'da3-legacy-review', '{"reason":"cached_context_requires_review"}')`,
      [ids.organizationA, ids.employeeA, ids.legacyReviewEventA],
    );
    await client.query('COMMIT');

    await client.query('BEGIN');
    await client.query(
      `UPDATE taptime_server.time_entries
       SET status = 'stopped', stop_work_event_id = $1,
           stopped_at = '2026-07-20T16:00:00Z', row_version = row_version + 1
       WHERE id = $2`,
      [ids.stoppedStopEventA, ids.stoppedEntryA],
    );
    await insertDecision(client, ids.stoppedStopEventA, 'time_entry_stopped', ids.stoppedEntryA);
    await client.query('COMMIT');

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO taptime_server.time_entries
        (id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at)
       VALUES ($1, $2, $3, 'customer', $4, 'started', $5, '2026-07-21T08:00:00Z')`,
      [ids.activeEntryA, ids.organizationA, ids.employeeA, ids.customerA, ids.activeStartEventA],
    );
    await insertDecision(client, ids.activeStartEventA, 'time_entry_started', ids.activeEntryA);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function insertEvent(client: PoolClient, id: string, occurredAt: string): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.work_events
      (id, organization_id, assignment_id, nfc_tag_id, target_type,
       target_customer_id, triggered_by_user_id, occurred_at, content_hash,
       content_hash_algorithm, content_hash_version)
     VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, repeat('a', 64), 'sha256', 1)`,
    [
      id, ids.organizationA, ids.assignmentA, ids.tagA, ids.customerA,
      ids.employeeA, occurredAt,
    ],
  );
}

async function insertDecision(
  client: PoolClient,
  eventId: string,
  decisionType: 'time_entry_started' | 'time_entry_stopped',
  entryId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.canonical_decisions
      (work_event_id, organization_id, actor_user_id, target_type,
       target_customer_id, decision_type, time_entry_id, engine_version, decision_payload)
     VALUES ($1, $2, $3, 'customer', $4, $5, $6, 'da3-test', '{}')`,
    [eventId, ids.organizationA, ids.employeeA, ids.customerA, decisionType, entryId],
  );
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
