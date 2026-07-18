import { randomBytes } from 'node:crypto';
import type { AccessTokenVerifier, AccessTokenVerificationResult } from '@taptime/backend-identity';
import { CustomerId, MembershipId } from '@taptime/core';
import { Pool, type PoolClient } from 'pg';

export const C3C_ISSUER = 'https://synthetic.invalid/auth';
export const C3C_RUNTIME_LOGIN = 'taptime_c3c_admin_setup_test_login';
export const C3E1_INVITATION_RUNTIME_LOGIN = 'taptime_c3e1_invitation_test_login';
export const C3E1_ENROLLMENT_RUNTIME_LOGIN = 'taptime_c3e1_enrollment_test_login';
export const C3E2_REASSIGNMENT_RUNTIME_LOGIN = 'taptime_c3e2_reassignment_test_login';

export const ids = {
  organizationA: '00000000-0000-4000-8000-000000000001',
  organizationB: '00000000-0000-4000-8000-000000000002',
  adminA: '10000000-0000-4000-8000-000000000001',
  adminA2: '10000000-0000-4000-8000-000000000002',
  employeeA: '10000000-0000-4000-8000-000000000003',
  adminB: '10000000-0000-4000-8000-000000000004',
  orphan: '10000000-0000-4000-8000-000000000005',
  bindingAdminA: '11000000-0000-4000-8000-000000000001',
  bindingAdminA2: '11000000-0000-4000-8000-000000000002',
  bindingEmployeeA: '11000000-0000-4000-8000-000000000003',
  bindingAdminB: '11000000-0000-4000-8000-000000000004',
  bindingOrphan: '11000000-0000-4000-8000-000000000005',
  membershipAdminA: '12000000-0000-4000-8000-000000000001',
  membershipAdminA2: '12000000-0000-4000-8000-000000000002',
  membershipEmployeeA: '12000000-0000-4000-8000-000000000003',
  membershipAdminB: '12000000-0000-4000-8000-000000000004',
  customerA: '20000000-0000-4000-8000-000000000001',
  inactiveCustomerA: '20000000-0000-4000-8000-000000000002',
  customerB: '20000000-0000-4000-8000-000000000003',
  targetCustomerA: '20000000-0000-4000-8000-000000000004',
  lowerCustomerA: '20000000-0000-4000-8000-000000000000',
  adversarialCustomerA: '20000000-0000-4000-8000-000000000090',
  tagAssignedA: '30000000-0000-4000-8000-000000000001',
  tagUnassignedA: '30000000-0000-4000-8000-000000000002',
  adversarialTagA: '30000000-0000-4000-8000-000000000090',
  adversarialDivergentTagA: '30000000-0000-4000-8000-000000000091',
  assignmentA: '40000000-0000-4000-8000-000000000001',
  adversarialAssignmentA: '40000000-0000-4000-8000-000000000090',
  adversarialDivergentAssignmentA: '40000000-0000-4000-8000-000000000091',
} as const;

export const membershipIds = {
  adminA: MembershipId(ids.membershipAdminA),
  adminA2: MembershipId(ids.membershipAdminA2),
  employeeA: MembershipId(ids.membershipEmployeeA),
  adminB: MembershipId(ids.membershipAdminB),
} as const;

export const customerIds = {
  customerA: CustomerId(ids.customerA),
  inactiveCustomerA: CustomerId(ids.inactiveCustomerA),
  customerB: CustomerId(ids.customerB),
  targetCustomerA: CustomerId(ids.targetCustomerA),
} as const;

export const fixtureTokens = {
  adminA: 'fixture-token-admin-a',
  adminA2: 'fixture-token-admin-a2',
  employeeA: 'fixture-token-employee-a',
  adminB: 'fixture-token-admin-b',
  orphan: 'fixture-token-orphan',
  rejected: 'fixture-token-rejected',
  prospectiveA: 'fixture-token-prospective-a',
  prospectiveB: 'fixture-token-prospective-b',
} as const;

const tokenSubjects: Readonly<Record<string, string>> = Object.freeze({
  [fixtureTokens.adminA]: 'admin-a',
  [fixtureTokens.adminA2]: 'admin-a2',
  [fixtureTokens.employeeA]: 'employee-a',
  [fixtureTokens.adminB]: 'admin-b',
  [fixtureTokens.orphan]: 'orphan',
  [fixtureTokens.prospectiveA]: 'prospective-a',
  [fixtureTokens.prospectiveB]: 'prospective-b',
});

export const fixtureAccessTokenVerifier: AccessTokenVerifier = Object.freeze({
  async verify(accessToken: string): Promise<AccessTokenVerificationResult> {
    if (accessToken === fixtureTokens.rejected) {
      return { status: 'rejected', reason: 'invalid_signature' };
    }
    const subject = tokenSubjects[accessToken];
    if (subject === undefined) {
      return { status: 'rejected', reason: 'malformed_token' };
    }
    return {
      status: 'verified',
      identity: { issuer: C3C_ISSUER, subject },
    };
  },
});

export function syntheticPassword(): string {
  return randomBytes(32).toString('base64url');
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function ensureC3CRuntimeLogin(
  installerPool: Pool,
  password: string,
): Promise<void> {
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${C3C_RUNTIME_LOGIN}'
      ) THEN
        CREATE ROLE ${C3C_RUNTIME_LOGIN}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${C3C_RUNTIME_LOGIN} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD ${quoteLiteral(password)};
    REVOKE
      taptime_employee,
      taptime_administrator,
      taptime_server_lifecycle,
      taptime_identity_resolver,
      taptime_admin_setup
    FROM ${C3C_RUNTIME_LOGIN};
    GRANT taptime_identity_resolver TO ${C3C_RUNTIME_LOGIN}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
    GRANT taptime_admin_setup TO ${C3C_RUNTIME_LOGIN}
      WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
  `);
  await installerPool.query(`
    GRANT CONNECT ON DATABASE ${quoteIdentifier(await currentDatabase(installerPool))}
      TO ${C3C_RUNTIME_LOGIN}
  `);
}

export async function removeC3CRuntimeLogin(installerPool: Pool): Promise<void> {
  const database = await currentDatabase(installerPool);
  await installerPool.query(`
    REVOKE CONNECT ON DATABASE ${quoteIdentifier(database)} FROM ${C3C_RUNTIME_LOGIN};
    DROP OWNED BY ${C3C_RUNTIME_LOGIN};
    REVOKE taptime_identity_resolver, taptime_admin_setup FROM ${C3C_RUNTIME_LOGIN};
    DROP ROLE IF EXISTS ${C3C_RUNTIME_LOGIN};
  `);
}

export async function ensureC3E1RuntimeLogins(
  installerPool: Pool,
  invitationPassword: string,
  enrollmentPassword: string,
): Promise<void> {
  await ensureRuntimeLogin(
    installerPool,
    C3E1_INVITATION_RUNTIME_LOGIN,
    invitationPassword,
    ['taptime_identity_resolver', 'taptime_employee_invitation_creator'],
  );
  await ensureRuntimeLogin(
    installerPool,
    C3E1_ENROLLMENT_RUNTIME_LOGIN,
    enrollmentPassword,
    ['taptime_employee_enrollment_redeemer'],
  );
}

export async function removeC3E1RuntimeLogins(installerPool: Pool): Promise<void> {
  const database = await currentDatabase(installerPool);
  for (const login of [C3E1_INVITATION_RUNTIME_LOGIN, C3E1_ENROLLMENT_RUNTIME_LOGIN]) {
    await installerPool.query(`
      REVOKE CONNECT ON DATABASE ${quoteIdentifier(database)} FROM ${login};
      DROP OWNED BY ${login};
      REVOKE
        taptime_identity_resolver,
        taptime_employee_invitation_creator,
        taptime_employee_enrollment_redeemer
      FROM ${login};
      DROP ROLE IF EXISTS ${login};
    `);
  }
}

export async function ensureC3E2RuntimeLogin(
  installerPool: Pool,
  password: string,
): Promise<void> {
  await ensureRuntimeLogin(
    installerPool,
    C3E2_REASSIGNMENT_RUNTIME_LOGIN,
    password,
    ['taptime_identity_resolver', 'taptime_assignment_reassigner'],
  );
}

export async function removeC3E2RuntimeLogin(installerPool: Pool): Promise<void> {
  const database = await currentDatabase(installerPool);
  await installerPool.query(`
    REVOKE CONNECT ON DATABASE ${quoteIdentifier(database)}
      FROM ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
    DROP OWNED BY ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
    REVOKE taptime_identity_resolver, taptime_assignment_reassigner
      FROM ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
    DROP ROLE IF EXISTS ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
  `);
}

export function c3e1RuntimeConnectionString(
  baseConnectionString: string,
  login: typeof C3E1_INVITATION_RUNTIME_LOGIN | typeof C3E1_ENROLLMENT_RUNTIME_LOGIN,
  password: string,
): string {
  const url = new URL(baseConnectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('C3E1 tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = login;
  url.password = password;
  return url.toString();
}

export function runtimeConnectionString(
  baseConnectionString: string,
  password: string,
): string {
  const url = new URL(baseConnectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('C3C tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = C3C_RUNTIME_LOGIN;
  url.password = password;
  return url.toString();
}

export function c3e2RuntimeConnectionString(
  baseConnectionString: string,
  password: string,
): string {
  const url = new URL(baseConnectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('C3E2 tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = C3E2_REASSIGNMENT_RUNTIME_LOGIN;
  url.password = password;
  return url.toString();
}

export async function truncateC3C(installerPool: Pool): Promise<void> {
  await installerPool.query(`
    TRUNCATE TABLE
      taptime_server.admin_setup_command_receipts,
      taptime_server.bootstrap_receipts,
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

export async function seedC3C(installerPool: Pool): Promise<void> {
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO taptime_server.users (id)
       SELECT unnest($1::uuid[])`,
      [[ids.adminA, ids.adminA2, ids.employeeA, ids.adminB, ids.orphan]],
    );
    await client.query(
      `INSERT INTO taptime_server.identity_bindings
        (id, user_id, issuer, subject) VALUES
        ($1, $6, $11, 'admin-a'),
        ($2, $7, $11, 'admin-a2'),
        ($3, $8, $11, 'employee-a'),
        ($4, $9, $11, 'admin-b'),
        ($5, $10, $11, 'orphan')`,
      [
        ids.bindingAdminA,
        ids.bindingAdminA2,
        ids.bindingEmployeeA,
        ids.bindingAdminB,
        ids.bindingOrphan,
        ids.adminA,
        ids.adminA2,
        ids.employeeA,
        ids.adminB,
        ids.orphan,
        C3C_ISSUER,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.organizations (id, name) VALUES
        ($1, 'Synthetic Organization A'),
        ($2, 'Synthetic Organization B')`,
      [ids.organizationA, ids.organizationB],
    );
    await client.query(
      `INSERT INTO taptime_server.memberships
        (id, organization_id, user_id, role, created_at, created_by_user_id) VALUES
        ($1, $5, $7, 'administrator', '2026-07-01T00:00:00Z', $7),
        ($2, $5, $8, 'administrator', '2026-07-01T00:00:00Z', $7),
        ($3, $5, $9, 'employee', '2026-07-01T00:00:00Z', $7),
        ($4, $6, $10, 'administrator', '2026-07-01T00:00:00Z', $10)`,
      [
        ids.membershipAdminA,
        ids.membershipAdminA2,
        ids.membershipEmployeeA,
        ids.membershipAdminB,
        ids.organizationA,
        ids.organizationB,
        ids.adminA,
        ids.adminA2,
        ids.employeeA,
        ids.adminB,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.customers
        (id, organization_id, display_name, active, activated_at, deactivated_at) VALUES
        ($1, $4, 'Active Customer A', true, '2026-07-01T00:00:00Z', NULL),
        ($2, $4, 'Inactive Customer A', false, '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z'),
        ($3, $5, 'Active Customer B', true, '2026-07-01T00:00:00Z', NULL)`,
      [
        ids.customerA,
        ids.inactiveCustomerA,
        ids.customerB,
        ids.organizationA,
        ids.organizationB,
      ],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_tags
        (id, organization_id, display_name, payload_value) VALUES
        ($1, $3, 'Assigned Tag A', 'nfc:uid:v1:AA'),
        ($2, $3, 'Unassigned Tag A', 'nfc:uid:v1:BB')`,
      [ids.tagAssignedA, ids.tagUnassignedA, ids.organizationA],
    );
    await client.query(
      `INSERT INTO taptime_server.nfc_assignments
        (id, organization_id, nfc_tag_id, target_type, target_customer_id, active)
       VALUES ($1, $2, $3, 'customer', $4, true)`,
      [ids.assignmentA, ids.organizationA, ids.tagAssignedA, ids.customerA],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withAdminSetupContext<Value>(
  runtimePool: Pool,
  actor: 'adminA' | 'adminA2' | 'adminB',
  operation: (client: PoolClient) => Promise<Value>,
): Promise<Value> {
  const actorData = actor === 'adminA'
    ? {
        userId: ids.adminA,
        organizationId: ids.organizationA,
        membershipId: ids.membershipAdminA,
      }
    : actor === 'adminA2'
      ? {
          userId: ids.adminA2,
          organizationId: ids.organizationA,
          membershipId: ids.membershipAdminA2,
        }
      : {
          userId: ids.adminB,
          organizationId: ids.organizationB,
          membershipId: ids.membershipAdminB,
        };
  const client = await runtimePool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT
         set_config('app.user_id', $1, true),
         set_config('app.organization_id', $2, true),
         set_config('app.membership_id', $3, true),
         set_config('app.membership_role', 'administrator', true),
         set_config('app.correlation_id', $4, true)`,
      [
        actorData.userId,
        actorData.organizationId,
        actorData.membershipId,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ],
    );
    await client.query('SET LOCAL ROLE taptime_admin_setup');
    const value = await operation(client);
    await client.query('ROLLBACK');
    return value;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function postgresErrorCode(operation: Promise<unknown>): Promise<string | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : undefined;
  }
}

async function currentDatabase(pool: Pool): Promise<string> {
  const result = await pool.query<{ current_database: string }>('SELECT current_database()');
  return result.rows[0]!.current_database;
}

async function ensureRuntimeLogin(
  installerPool: Pool,
  login: string,
  password: string,
  roles: readonly string[],
): Promise<void> {
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = ${quoteLiteral(login)}) THEN
        EXECUTE pg_catalog.format(
          'CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
          ${quoteLiteral(login)}
        );
      END IF;
    END
    $login$;
    ALTER ROLE ${quoteIdentifier(login)} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOREPLICATION NOBYPASSRLS PASSWORD ${quoteLiteral(password)};
    REVOKE
      taptime_employee,
      taptime_administrator,
      taptime_server_lifecycle,
      taptime_identity_resolver,
      taptime_admin_setup,
      taptime_employee_invitation_creator,
      taptime_employee_enrollment_redeemer
      ,taptime_assignment_reassigner
    FROM ${quoteIdentifier(login)};
    ${roles.map((role) => `GRANT ${role} TO ${quoteIdentifier(login)} WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;`).join('\n')}
  `);
  await installerPool.query(`
    GRANT CONNECT ON DATABASE ${quoteIdentifier(await currentDatabase(installerPool))}
      TO ${quoteIdentifier(login)}
  `);
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
