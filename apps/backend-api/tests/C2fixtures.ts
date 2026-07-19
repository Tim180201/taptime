import { Pool } from 'pg';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '../../backend-schema/src/index.js';
import {
  ids,
  resetAndSeedB6,
} from '../../backend-lifecycle/tests/fixtures.js';

export { ids };

export const C2_SESSION_RUNTIME_LOGIN = 'taptime_c2_session_runtime';
export const C2_READ_MODEL_RUNTIME_LOGIN = 'taptime_c2_read_model_runtime';
export const C2_LIFECYCLE_RUNTIME_LOGIN = 'taptime_c2_lifecycle_runtime';
export const C2_ADMINISTRATION_RUNTIME_LOGIN = 'taptime_c2_administration_runtime';
export const C3E2_REASSIGNMENT_RUNTIME_LOGIN = 'taptime_c3e2_reassignment_runtime';
export const OFFLINE_LEASE_RUNTIME_LOGIN = 'taptime_offline_lease_runtime';
export const OFFLINE_EVENT_RUNTIME_LOGIN = 'taptime_offline_event_runtime';
export const OFFLINE_RECONCILIATION_RUNTIME_LOGIN = 'taptime_offline_reconciliation_runtime';

export const C2_RUNTIME_ROLE_GRAPH = Object.freeze({
  [C2_SESSION_RUNTIME_LOGIN]: ['taptime_identity_resolver'],
  [C2_READ_MODEL_RUNTIME_LOGIN]: [
    'taptime_administrator',
    'taptime_employee',
    'taptime_identity_resolver',
  ],
  [C2_LIFECYCLE_RUNTIME_LOGIN]: [
    'taptime_identity_resolver',
    'taptime_server_lifecycle',
  ],
  [C2_ADMINISTRATION_RUNTIME_LOGIN]: [
    'taptime_admin_setup',
    'taptime_identity_resolver',
  ],
  [C3E2_REASSIGNMENT_RUNTIME_LOGIN]: [
    'taptime_assignment_reassigner',
    'taptime_identity_resolver',
  ],
  [OFFLINE_LEASE_RUNTIME_LOGIN]: [
    'taptime_identity_resolver',
    'taptime_offline_lease_issuer',
  ],
  [OFFLINE_EVENT_RUNTIME_LOGIN]: [
    'taptime_identity_resolver',
    'taptime_offline_event_ingestor',
  ],
  [OFFLINE_RECONCILIATION_RUNTIME_LOGIN]: [
    'taptime_identity_resolver',
    'taptime_offline_reconciliation_reader',
  ],
} as const);

export async function resetMigrateAndPrepareC2(
  installerPool: Pool,
  passwords: {
    readonly session: string;
    readonly readModel: string;
    readonly lifecycle: string;
    readonly administration: string;
    readonly reassignment: string;
    readonly offlineLease: string;
    readonly offlineEvent: string;
    readonly offlineReconciliation: string;
  },
): Promise<void> {
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  const result = await migrate(installerPool);
  if (result.applied.join(',') !== '001,002,003,004,005,006,007,008,009,010') {
    throw new Error('C2 requires a clean migration set 001 through 010');
  }

  await normalizeRuntimeLogin(
    installerPool,
    C2_SESSION_RUNTIME_LOGIN,
    passwords.session,
    C2_RUNTIME_ROLE_GRAPH[C2_SESSION_RUNTIME_LOGIN],
  );
  await normalizeRuntimeLogin(
    installerPool,
    C2_READ_MODEL_RUNTIME_LOGIN,
    passwords.readModel,
    C2_RUNTIME_ROLE_GRAPH[C2_READ_MODEL_RUNTIME_LOGIN],
  );
  await normalizeRuntimeLogin(
    installerPool,
    C2_LIFECYCLE_RUNTIME_LOGIN,
    passwords.lifecycle,
    C2_RUNTIME_ROLE_GRAPH[C2_LIFECYCLE_RUNTIME_LOGIN],
  );
  await normalizeRuntimeLogin(
    installerPool,
    C2_ADMINISTRATION_RUNTIME_LOGIN,
    passwords.administration,
    C2_RUNTIME_ROLE_GRAPH[C2_ADMINISTRATION_RUNTIME_LOGIN],
  );
  await normalizeRuntimeLogin(
    installerPool,
    C3E2_REASSIGNMENT_RUNTIME_LOGIN,
    passwords.reassignment,
    C2_RUNTIME_ROLE_GRAPH[C3E2_REASSIGNMENT_RUNTIME_LOGIN],
  );
  await normalizeRuntimeLogin(
    installerPool,
    OFFLINE_LEASE_RUNTIME_LOGIN,
    passwords.offlineLease,
    C2_RUNTIME_ROLE_GRAPH[OFFLINE_LEASE_RUNTIME_LOGIN],
  );
  await normalizeRuntimeLogin(
    installerPool,
    OFFLINE_EVENT_RUNTIME_LOGIN,
    passwords.offlineEvent,
    C2_RUNTIME_ROLE_GRAPH[OFFLINE_EVENT_RUNTIME_LOGIN],
  );
  await normalizeRuntimeLogin(
    installerPool,
    OFFLINE_RECONCILIATION_RUNTIME_LOGIN,
    passwords.offlineReconciliation,
    C2_RUNTIME_ROLE_GRAPH[OFFLINE_RECONCILIATION_RUNTIME_LOGIN],
  );
}

export async function resetAndSeedC2(installerPool: Pool, issuer: string): Promise<void> {
  await resetAndSeedB6(installerPool, issuer);
  await installerPool.query(
    `UPDATE taptime_server.memberships
     SET role = 'administrator', row_version = row_version + 1
     WHERE id = $1`,
    [ids.membershipA2],
  );
}

export function runtimeConnectionString(
  installerConnectionString: string,
  username: string,
  password: string,
): string {
  const url = new URL(installerConnectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname.length === 0) {
    throw new Error('C2 tests require a TCP PostgreSQL URL with an explicit host');
  }
  url.username = username;
  url.password = password;
  return url.href;
}

export async function parentRoles(pool: Pool, memberName: string): Promise<string[]> {
  const result = await pool.query<{ role_name: string }>(
    `SELECT parent.rolname AS role_name
     FROM pg_catalog.pg_auth_members AS membership
     JOIN pg_catalog.pg_roles AS member ON member.oid = membership.member
     JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
     WHERE member.rolname = $1
     ORDER BY parent.rolname`,
    [memberName],
  );
  return result.rows.map(({ role_name }) => role_name);
}

export async function postgresErrorCode(operation: Promise<unknown>): Promise<string | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : undefined;
  }
}

async function normalizeRuntimeLogin(
  installerPool: Pool,
  login: keyof typeof C2_RUNTIME_ROLE_GRAPH,
  password: string,
  roles: readonly string[],
): Promise<void> {
  const passwordLiteral = quoteLiteral(password);
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${login}') THEN
        CREATE ROLE ${login}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${login} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD ${passwordLiteral};
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

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
