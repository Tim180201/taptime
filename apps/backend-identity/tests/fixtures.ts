import { Pool } from 'pg';

export const b4Ids = {
  organizationA: '00000000-0000-4000-8000-000000000101',
  organizationB: '00000000-0000-4000-8000-000000000102',
  employeeA: '10000000-0000-4000-8000-000000000101',
  administratorA: '10000000-0000-4000-8000-000000000102',
  employeeB: '10000000-0000-4000-8000-000000000103',
  revokedBindingUser: '10000000-0000-4000-8000-000000000104',
  missingMembershipUser: '10000000-0000-4000-8000-000000000105',
  revokedMembershipUser: '10000000-0000-4000-8000-000000000106',
  employeeAMembership: '12000000-0000-4000-8000-000000000101',
  administratorAMembership: '12000000-0000-4000-8000-000000000102',
  employeeBMembership: '12000000-0000-4000-8000-000000000103',
  revokedBindingMembership: '12000000-0000-4000-8000-000000000104',
  revokedMembership: '12000000-0000-4000-8000-000000000106',
  sharedSubject: '80000000-0000-4000-8000-000000000101',
  administratorASubject: '80000000-0000-4000-8000-000000000102',
  revokedBindingSubject: '80000000-0000-4000-8000-000000000104',
  missingMembershipSubject: '80000000-0000-4000-8000-000000000105',
  revokedMembershipSubject: '80000000-0000-4000-8000-000000000106',
  unknownSubject: '80000000-0000-4000-8000-000000000199',
} as const;

export const B4_RESOLVER_TEST_LOGIN = 'taptime_b4_identity_resolver_test_login';
export const B4_RESOLVER_PARENT_CONTAMINATION_ROLE =
  'taptime_b4_resolver_parent_contamination';

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function ensureSyntheticResolverLogin(
  installerPool: Pool,
  password: string,
): Promise<void> {
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${B4_RESOLVER_TEST_LOGIN}') THEN
        CREATE ROLE ${B4_RESOLVER_TEST_LOGIN}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${B4_RESOLVER_TEST_LOGIN}
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD ${quoteLiteral(password)};
    REVOKE taptime_employee, taptime_administrator, taptime_server_lifecycle,
      taptime_identity_resolver FROM ${B4_RESOLVER_TEST_LOGIN};
    GRANT taptime_identity_resolver TO ${B4_RESOLVER_TEST_LOGIN};
  `);
}

export async function contaminateExistingResolverRole(installerPool: Pool): Promise<void> {
  await installerPool.query(`
    DO $roles$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'taptime_identity_resolver'
      ) THEN
        CREATE ROLE taptime_identity_resolver NOLOGIN;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles
        WHERE rolname = '${B4_RESOLVER_PARENT_CONTAMINATION_ROLE}'
      ) THEN
        CREATE ROLE ${B4_RESOLVER_PARENT_CONTAMINATION_ROLE} NOLOGIN;
      END IF;
    END
    $roles$;
    ALTER ROLE taptime_identity_resolver WITH
      LOGIN INHERIT SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS;
    GRANT ${B4_RESOLVER_PARENT_CONTAMINATION_ROLE} TO taptime_identity_resolver;
  `);
}

export function b4RuntimeConnectionString(
  installerConnectionString: string,
  password: string,
): string {
  const url = new URL(installerConnectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('B4 runtime security tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = B4_RESOLVER_TEST_LOGIN;
  url.password = password;
  return url.toString();
}

export async function resetAndSeedB4(
  installerPool: Pool,
  issuers: { readonly issuerA: string; readonly issuerB: string },
): Promise<void> {
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
      taptime_server.identity_bindings,
      taptime_server.memberships,
      taptime_server.organizations,
      taptime_server.users
    CASCADE
  `);

  await installerPool.query(
    `INSERT INTO taptime_server.users (id) SELECT unnest($1::uuid[])`,
    [[
      b4Ids.employeeA,
      b4Ids.administratorA,
      b4Ids.employeeB,
      b4Ids.revokedBindingUser,
      b4Ids.missingMembershipUser,
      b4Ids.revokedMembershipUser,
    ]],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.organizations (id, name) VALUES
      ($1, 'Synthetic B4 A'),
      ($2, 'Synthetic B4 B')`,
    [b4Ids.organizationA, b4Ids.organizationB],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.memberships
      (id, organization_id, user_id, role, created_at, revoked_at) VALUES
      ($1, $6, $8, 'employee', '2026-07-01T00:00:00Z', NULL),
      ($2, $6, $9, 'administrator', '2026-07-01T00:00:00Z', NULL),
      ($3, $7, $10, 'employee', '2026-07-01T00:00:00Z', NULL),
      ($4, $6, $11, 'employee', '2026-07-01T00:00:00Z', NULL),
      ($5, $6, $12, 'employee', '2026-07-01T00:00:00Z', '2026-07-10T00:00:00Z')`,
    [
      b4Ids.employeeAMembership,
      b4Ids.administratorAMembership,
      b4Ids.employeeBMembership,
      b4Ids.revokedBindingMembership,
      b4Ids.revokedMembership,
      b4Ids.organizationA,
      b4Ids.organizationB,
      b4Ids.employeeA,
      b4Ids.administratorA,
      b4Ids.employeeB,
      b4Ids.revokedBindingUser,
      b4Ids.revokedMembershipUser,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.identity_bindings
      (id, user_id, issuer, subject, created_at, revoked_at) VALUES
      ('11000000-0000-4000-8000-000000000101', $1, $7, $9, '2026-07-01T00:00:00Z', NULL),
      ('11000000-0000-4000-8000-000000000102', $2, $7, $10, '2026-07-01T00:00:00Z', NULL),
      ('11000000-0000-4000-8000-000000000103', $3, $8, $9, '2026-07-01T00:00:00Z', NULL),
      ('11000000-0000-4000-8000-000000000104', $4, $7, $11, '2026-07-01T00:00:00Z',
        '2026-07-10T00:00:00Z'),
      ('11000000-0000-4000-8000-000000000105', $5, $7, $12, '2026-07-01T00:00:00Z', NULL),
      ('11000000-0000-4000-8000-000000000106', $6, $7, $13, '2026-07-01T00:00:00Z', NULL)`,
    [
      b4Ids.employeeA,
      b4Ids.administratorA,
      b4Ids.employeeB,
      b4Ids.revokedBindingUser,
      b4Ids.missingMembershipUser,
      b4Ids.revokedMembershipUser,
      issuers.issuerA,
      issuers.issuerB,
      b4Ids.sharedSubject,
      b4Ids.administratorASubject,
      b4Ids.revokedBindingSubject,
      b4Ids.missingMembershipSubject,
      b4Ids.revokedMembershipSubject,
    ],
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
