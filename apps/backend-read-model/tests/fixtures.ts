import { Pool } from 'pg';
import {
  ids,
  seedB3,
  truncateB3,
} from '../../backend-schema/tests/fixtures.js';

export { ids };

export const B5_RUNTIME_LOGIN = 'taptime_b5_read_model_test_login';
export const B5_RUNTIME_ROLES = [
  'taptime_administrator',
  'taptime_employee',
  'taptime_identity_resolver',
] as const;

export const b5Ids = {
  inactiveCustomerA: '20000000-0000-4000-8000-000000000010',
  tenantBOnlyTag: '30000000-0000-4000-8000-000000000010',
  tenantBSimilarTag: '30000000-0000-4000-8000-000000000011',
  inactiveTagA: '30000000-0000-4000-8000-000000000012',
  inactiveAssignmentA: '40000000-0000-4000-8000-000000000010',
} as const;

export const subjects = {
  administratorA: 'admin-a',
  employeeA: 'employee-a',
  employeeA2: 'employee-a2',
  administratorB: 'admin-b',
  employeeB: 'employee-b',
  unknown: 'unknown-b5-subject',
} as const;

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function ensureSyntheticB5RuntimeLogin(
  installerPool: Pool,
  password: string,
): Promise<void> {
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${B5_RUNTIME_LOGIN}'
      ) THEN
        CREATE ROLE ${B5_RUNTIME_LOGIN}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${B5_RUNTIME_LOGIN} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD ${quoteLiteral(password)};
    REVOKE taptime_employee, taptime_administrator, taptime_server_lifecycle,
      taptime_identity_resolver FROM ${B5_RUNTIME_LOGIN};
    GRANT taptime_identity_resolver, taptime_employee, taptime_administrator
      TO ${B5_RUNTIME_LOGIN};
  `);
}

export function b5RuntimeConnectionString(
  installerConnectionString: string,
  password: string,
): string {
  const url = new URL(installerConnectionString);
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('B5 security tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = B5_RUNTIME_LOGIN;
  url.password = password;
  return url.toString();
}

export async function resetAndSeedB5(installerPool: Pool, issuer: string): Promise<void> {
  await truncateB3(installerPool);
  await seedB3(installerPool);
  await installerPool.query(
    `UPDATE taptime_server.identity_bindings SET issuer = $1`,
    [issuer],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.customers
       (id, organization_id, active, activated_at, deactivated_at)
     VALUES ($1, $2, false, '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z')`,
    [b5Ids.inactiveCustomerA, ids.organizationA],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.nfc_tags (id, organization_id, payload_value) VALUES
       ($1, $4, 'tenant-b-only-payload'),
       ($2, $4, 'shared-synthetic-payload-near'),
       ($3, $5, 'inactive-assignment-payload')`,
    [
      b5Ids.tenantBOnlyTag,
      b5Ids.tenantBSimilarTag,
      b5Ids.inactiveTagA,
      ids.organizationB,
      ids.organizationA,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.nfc_assignments
       (id, organization_id, nfc_tag_id, target_type, target_customer_id,
        active, valid_from, valid_to)
     VALUES ($1, $2, $3, 'customer', $4, false,
       '2026-07-01T00:00:00Z', '2026-07-02T00:00:00Z')`,
    [
      b5Ids.inactiveAssignmentA,
      ids.organizationA,
      b5Ids.inactiveTagA,
      ids.customerA,
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
