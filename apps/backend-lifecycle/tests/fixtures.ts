import { Pool } from 'pg';
import { B6_RUNTIME_LOGIN } from '../src/index.js';

export const ids = {
  organizationA: '00000000-0000-4000-8000-000000000601',
  organizationB: '00000000-0000-4000-8000-000000000602',
  userA: '10000000-0000-4000-8000-000000000601',
  userA2: '10000000-0000-4000-8000-000000000602',
  userB: '10000000-0000-4000-8000-000000000603',
  revokedBindingUser: '10000000-0000-4000-8000-000000000604',
  revokedMembershipUser: '10000000-0000-4000-8000-000000000605',
  membershipA: '12000000-0000-4000-8000-000000000601',
  membershipA2: '12000000-0000-4000-8000-000000000602',
  membershipB: '12000000-0000-4000-8000-000000000603',
  revokedBindingMembership: '12000000-0000-4000-8000-000000000604',
  revokedMembership: '12000000-0000-4000-8000-000000000605',
  customerA: '20000000-0000-4000-8000-000000000601',
  otherCustomerA: '20000000-0000-4000-8000-000000000602',
  inactiveCustomerA: '20000000-0000-4000-8000-000000000603',
  customerB: '20000000-0000-4000-8000-000000000604',
  temporalAssignmentCustomerA: '20000000-0000-4000-8000-000000000606',
  temporalTagCustomerA: '20000000-0000-4000-8000-000000000607',
  temporalCustomerA: '20000000-0000-4000-8000-000000000608',
  tagA: '30000000-0000-4000-8000-000000000601',
  otherTagA: '30000000-0000-4000-8000-000000000602',
  inactiveTagA: '30000000-0000-4000-8000-000000000603',
  inactiveCustomerTagA: '30000000-0000-4000-8000-000000000604',
  tagB: '30000000-0000-4000-8000-000000000605',
  temporalAssignmentTagA: '30000000-0000-4000-8000-000000000606',
  temporalTagA: '30000000-0000-4000-8000-000000000607',
  temporalCustomerTagA: '30000000-0000-4000-8000-000000000608',
  assignmentA: '40000000-0000-4000-8000-000000000601',
  otherAssignmentA: '40000000-0000-4000-8000-000000000602',
  inactiveAssignmentA: '40000000-0000-4000-8000-000000000603',
  inactiveCustomerAssignmentA: '40000000-0000-4000-8000-000000000604',
  assignmentB: '40000000-0000-4000-8000-000000000605',
  temporalAssignmentA: '40000000-0000-4000-8000-000000000606',
  temporalTagAssignmentA: '40000000-0000-4000-8000-000000000607',
  temporalCustomerAssignmentA: '40000000-0000-4000-8000-000000000608',
  subjectA: '80000000-0000-4000-8000-000000000601',
  subjectA2: '80000000-0000-4000-8000-000000000602',
  subjectB: '80000000-0000-4000-8000-000000000603',
  revokedBindingSubject: '80000000-0000-4000-8000-000000000604',
  revokedMembershipSubject: '80000000-0000-4000-8000-000000000605',
  unknownSubject: '80000000-0000-4000-8000-000000000699',
} as const;

export const B6_RUNTIME_ROLES = [
  'taptime_identity_resolver',
  'taptime_server_lifecycle',
] as const;

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function ensureSyntheticB6RuntimeLogin(
  installerPool: Pool,
  password: string,
): Promise<void> {
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${B6_RUNTIME_LOGIN}'
      ) THEN
        CREATE ROLE ${B6_RUNTIME_LOGIN}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${B6_RUNTIME_LOGIN} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD ${quoteLiteral(password)};
    REVOKE taptime_employee, taptime_administrator, taptime_server_lifecycle,
      taptime_identity_resolver FROM ${B6_RUNTIME_LOGIN};
    GRANT taptime_identity_resolver, taptime_server_lifecycle TO ${B6_RUNTIME_LOGIN};
  `);
}

export function runtimeConnectionString(
  installerConnectionString: string,
  password: string,
): string {
  const url = new URL(installerConnectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('B6 security tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = B6_RUNTIME_LOGIN;
  url.password = password;
  return url.toString();
}

export async function resetAndSeedB6(installerPool: Pool, issuer: string): Promise<void> {
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
      ids.userA,
      ids.userA2,
      ids.userB,
      ids.revokedBindingUser,
      ids.revokedMembershipUser,
    ]],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.organizations (id, name) VALUES
       ($1, 'Synthetic B6 A'), ($2, 'Synthetic B6 B')`,
    [ids.organizationA, ids.organizationB],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.memberships
       (id, organization_id, user_id, role, created_at, revoked_at) VALUES
       ($1, $6, $8, 'employee', '2026-07-01T00:00:00Z', NULL),
       ($2, $6, $9, 'employee', '2026-07-01T00:00:00Z', NULL),
       ($3, $7, $10, 'employee', '2026-07-01T00:00:00Z', NULL),
       ($4, $6, $11, 'employee', '2026-07-01T00:00:00Z', NULL),
       ($5, $6, $12, 'employee', '2026-07-01T00:00:00Z', '2026-07-10T00:00:00Z')`,
    [
      ids.membershipA,
      ids.membershipA2,
      ids.membershipB,
      ids.revokedBindingMembership,
      ids.revokedMembership,
      ids.organizationA,
      ids.organizationB,
      ids.userA,
      ids.userA2,
      ids.userB,
      ids.revokedBindingUser,
      ids.revokedMembershipUser,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.identity_bindings
       (id, user_id, issuer, subject, created_at, revoked_at) VALUES
       ('11000000-0000-4000-8000-000000000601', $1, $6, $7, '2026-07-01T00:00:00Z', NULL),
       ('11000000-0000-4000-8000-000000000602', $2, $6, $8, '2026-07-01T00:00:00Z', NULL),
       ('11000000-0000-4000-8000-000000000603', $3, $6, $9, '2026-07-01T00:00:00Z', NULL),
       ('11000000-0000-4000-8000-000000000604', $4, $6, $10, '2026-07-01T00:00:00Z',
         '2026-07-10T00:00:00Z'),
       ('11000000-0000-4000-8000-000000000605', $5, $6, $11, '2026-07-01T00:00:00Z', NULL)`,
    [
      ids.userA,
      ids.userA2,
      ids.userB,
      ids.revokedBindingUser,
      ids.revokedMembershipUser,
      issuer,
      ids.subjectA,
      ids.subjectA2,
      ids.subjectB,
      ids.revokedBindingSubject,
      ids.revokedMembershipSubject,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.customers
       (id, organization_id, display_name, active, activated_at, deactivated_at) VALUES
       ($1, $5, 'Lifecycle Customer A', true, '2026-07-01T00:00:00Z', NULL),
       ($2, $5, 'Lifecycle Customer A Other', true, '2026-07-01T00:00:00Z', NULL),
       ($3, $5, 'Lifecycle Customer A Inactive', false, '2026-07-01T00:00:00Z',
        '2026-07-02T00:00:00Z'),
       ($4, $6, 'Lifecycle Customer B', true, '2026-07-01T00:00:00Z', NULL)`,
    [
      ids.customerA,
      ids.otherCustomerA,
      ids.inactiveCustomerA,
      ids.customerB,
      ids.organizationA,
      ids.organizationB,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.customers
       (id, organization_id, display_name, active, activated_at, deactivated_at) VALUES
       ($1, $4, 'Lifecycle Temporal Assignment Customer', true,
        '2026-07-01T00:00:00Z', NULL),
       ($2, $4, 'Lifecycle Temporal Tag Customer', true,
        '2026-07-01T00:00:00Z', NULL),
       ($3, $4, 'Lifecycle Temporal Customer', true,
        '2026-07-03T00:00:00Z', NULL)`,
    [
      ids.temporalAssignmentCustomerA,
      ids.temporalTagCustomerA,
      ids.temporalCustomerA,
      ids.organizationA,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.nfc_tags
       (id, organization_id, display_name, payload_value, created_at) VALUES
       ($1, $6, 'Lifecycle Tag A', 'b6-a', '2026-07-01T00:00:00Z'),
       ($2, $6, 'Lifecycle Tag A Other', 'b6-a-other', '2026-07-01T00:00:00Z'),
       ($3, $6, 'Lifecycle Tag A Inactive', 'b6-a-inactive', '2026-07-01T00:00:00Z'),
       ($4, $6, 'Lifecycle Tag A Inactive Customer', 'b6-a-inactive-customer',
        '2026-07-01T00:00:00Z'),
       ($5, $7, 'Lifecycle Tag B', 'b6-b', '2026-07-01T00:00:00Z')`,
    [
      ids.tagA,
      ids.otherTagA,
      ids.inactiveTagA,
      ids.inactiveCustomerTagA,
      ids.tagB,
      ids.organizationA,
      ids.organizationB,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.nfc_tags
       (id, organization_id, display_name, payload_value, created_at) VALUES
       ($1, $4, 'Lifecycle Temporal Assignment Tag', 'b6-temporal-assignment',
        '2026-07-01T00:00:00Z'),
       ($2, $4, 'Lifecycle Temporal Tag', 'b6-temporal-tag',
        '2026-07-03T00:00:00Z'),
       ($3, $4, 'Lifecycle Temporal Customer Tag', 'b6-temporal-customer',
        '2026-07-01T00:00:00Z')`,
    [
      ids.temporalAssignmentTagA,
      ids.temporalTagA,
      ids.temporalCustomerTagA,
      ids.organizationA,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.nfc_assignments
       (id, organization_id, nfc_tag_id, target_type, target_customer_id,
        active, valid_from, valid_to) VALUES
       ($1, $6, $8, 'customer', $13, true, '2026-07-01T00:00:00Z', NULL),
       ($2, $6, $9, 'customer', $14, true, '2026-07-01T00:00:00Z', NULL),
       ($3, $6, $10, 'customer', $13, false, '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z'),
       ($4, $6, $11, 'customer', $15, true, '2026-07-01T00:00:00Z', NULL),
       ($5, $7, $12, 'customer', $16, true, '2026-07-01T00:00:00Z', NULL)`,
    [
      ids.assignmentA,
      ids.otherAssignmentA,
      ids.inactiveAssignmentA,
      ids.inactiveCustomerAssignmentA,
      ids.assignmentB,
      ids.organizationA,
      ids.organizationB,
      ids.tagA,
      ids.otherTagA,
      ids.inactiveTagA,
      ids.inactiveCustomerTagA,
      ids.tagB,
      ids.customerA,
      ids.otherCustomerA,
      ids.inactiveCustomerA,
      ids.customerB,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.nfc_assignments
       (id, organization_id, nfc_tag_id, target_type, target_customer_id,
        active, valid_from, valid_to) VALUES
       ($1, $10, $4, 'customer', $7, true, '2026-07-03T00:00:00Z', NULL),
       ($2, $10, $5, 'customer', $8, true, '2026-07-01T00:00:00Z', NULL),
       ($3, $10, $6, 'customer', $9, true, '2026-07-01T00:00:00Z', NULL)`,
    [
      ids.temporalAssignmentA,
      ids.temporalTagAssignmentA,
      ids.temporalCustomerAssignmentA,
      ids.temporalAssignmentTagA,
      ids.temporalTagA,
      ids.temporalCustomerTagA,
      ids.temporalAssignmentCustomerA,
      ids.temporalTagCustomerA,
      ids.temporalCustomerA,
      ids.organizationA,
    ],
  );
}

export async function lifecycleCounts(installerPool: Pool): Promise<Record<string, number>> {
  const result = await installerPool.query<Record<string, string>>(`
    SELECT
      (SELECT count(*) FROM taptime_server.work_events) AS work_events,
      (SELECT count(*) FROM taptime_server.time_entries) AS time_entries,
      (SELECT count(*) FROM taptime_server.canonical_decisions) AS canonical_decisions,
      (SELECT count(*) FROM taptime_server.sync_receipts) AS sync_receipts,
      (SELECT count(*) FROM taptime_server.audit_events) AS audit_events
  `);
  return Object.fromEntries(
    Object.entries(result.rows[0] ?? {}).map(([key, value]) => [key, Number(value)]),
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
