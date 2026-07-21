import { createServer, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { Pool } from 'pg';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '../../backend-schema/src/index.js';

export const C2_SESSION_RUNTIME_LOGIN = 'taptime_c2_session_runtime';
export const C3E2_REASSIGNMENT_RUNTIME_LOGIN = 'taptime_c3e2_reassignment_runtime';
export const C3E2_REASSIGNMENT_RUNTIME_PASSWORD = 'c3e2-reassignment-local-synthetic-only';

export const c1Ids = {
  organizationA: '00000000-0000-4000-8000-000000000201',
  organizationB: '00000000-0000-4000-8000-000000000202',
  employeeA: '10000000-0000-4000-8000-000000000201',
  administratorA: '10000000-0000-4000-8000-000000000202',
  employeeB: '10000000-0000-4000-8000-000000000203',
  revokedBindingUser: '10000000-0000-4000-8000-000000000204',
  missingMembershipUser: '10000000-0000-4000-8000-000000000205',
  revokedMembershipUser: '10000000-0000-4000-8000-000000000206',
  employeeAMembership: '12000000-0000-4000-8000-000000000201',
  administratorAMembership: '12000000-0000-4000-8000-000000000202',
  employeeBMembership: '12000000-0000-4000-8000-000000000203',
  revokedBindingMembership: '12000000-0000-4000-8000-000000000204',
  revokedMembership: '12000000-0000-4000-8000-000000000206',
  sharedSubject: '80000000-0000-4000-8000-000000000201',
  administratorSubject: '80000000-0000-4000-8000-000000000202',
  revokedBindingSubject: '80000000-0000-4000-8000-000000000204',
  missingMembershipSubject: '80000000-0000-4000-8000-000000000205',
  revokedMembershipSubject: '80000000-0000-4000-8000-000000000206',
  unknownSubject: '80000000-0000-4000-8000-000000000299',
} as const;

export interface SyntheticJwksInfrastructure {
  readonly server: Server;
  readonly issuerA: string;
  readonly issuerB: string;
  readonly signingKey: CryptoKey;
  readonly otherSigningKey: CryptoKey;
  readonly keyId: string;
}

export interface AccessTokenOptions {
  readonly issuer?: string;
  readonly subject?: string | null;
  readonly audience?: string;
  readonly expiresAt?: number;
  readonly notBefore?: number;
  readonly key?: CryptoKey;
  readonly claims?: Readonly<Record<string, unknown>>;
}

export async function resetMigrateAndPrepareLogin(
  installerPool: Pool,
  runtimePassword: string,
): Promise<void> {
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  const result = await migrate(installerPool);
  if (result.applied.join(',') !== '001,002,003,004,005,006,007,008,009,010,011') {
    throw new Error('C1 requires a clean migration set 001 through 011');
  }
  await ensureExactRuntimeLogin(installerPool, runtimePassword);
  await ensureExactReassignmentRuntimeLogin(installerPool);
}

async function ensureExactReassignmentRuntimeLogin(installerPool: Pool): Promise<void> {
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles
        WHERE rolname = '${C3E2_REASSIGNMENT_RUNTIME_LOGIN}'
      ) THEN
        CREATE ROLE ${C3E2_REASSIGNMENT_RUNTIME_LOGIN}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${C3E2_REASSIGNMENT_RUNTIME_LOGIN}
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD '${C3E2_REASSIGNMENT_RUNTIME_PASSWORD}';
    ALTER ROLE ${C3E2_REASSIGNMENT_RUNTIME_LOGIN} RESET ALL;
    REVOKE ALL PRIVILEGES ON SCHEMA ${B3_SCHEMA} FROM ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${B3_SCHEMA}
      FROM ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${B3_SCHEMA}
      FROM ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${B3_SCHEMA}
      FROM ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
    GRANT taptime_identity_resolver, taptime_assignment_reassigner
      TO ${C3E2_REASSIGNMENT_RUNTIME_LOGIN};
  `);
}

export async function ensureExactRuntimeLogin(
  installerPool: Pool,
  runtimePassword: string,
): Promise<void> {
  const passwordLiteral = `'${runtimePassword.replaceAll("'", "''")}'`;
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${C2_SESSION_RUNTIME_LOGIN}') THEN
        CREATE ROLE ${C2_SESSION_RUNTIME_LOGIN}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${C2_SESSION_RUNTIME_LOGIN}
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD ${passwordLiteral};
    ALTER ROLE ${C2_SESSION_RUNTIME_LOGIN} RESET ALL;

    DO $parents$
    DECLARE parent_name text;
    BEGIN
      FOR parent_name IN
        SELECT parent.rolname
        FROM pg_catalog.pg_auth_members membership
        JOIN pg_catalog.pg_roles member ON member.oid = membership.member
        JOIN pg_catalog.pg_roles parent ON parent.oid = membership.roleid
        WHERE member.rolname = '${C2_SESSION_RUNTIME_LOGIN}'
      LOOP
        EXECUTE format('REVOKE %I FROM ${C2_SESSION_RUNTIME_LOGIN}', parent_name);
      END LOOP;
    END
    $parents$;

    REVOKE ALL PRIVILEGES ON SCHEMA ${B3_SCHEMA} FROM ${C2_SESSION_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${B3_SCHEMA} FROM ${C2_SESSION_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${B3_SCHEMA} FROM ${C2_SESSION_RUNTIME_LOGIN};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${B3_SCHEMA} FROM ${C2_SESSION_RUNTIME_LOGIN};
    GRANT taptime_identity_resolver TO ${C2_SESSION_RUNTIME_LOGIN};
  `);
}

export function runtimeConnectionString(installerConnectionString: string, password: string): string {
  const url = new URL(installerConnectionString);
  url.username = C2_SESSION_RUNTIME_LOGIN;
  url.password = password;
  return url.href;
}

export async function resetAndSeedC1(
  installerPool: Pool,
  issuers: { readonly issuerA: string; readonly issuerB: string },
): Promise<void> {
  await installerPool.query(`
    TRUNCATE TABLE
      ${B3_SCHEMA}.audit_events,
      ${B3_SCHEMA}.sync_receipts,
      ${B3_SCHEMA}.canonical_decisions,
      ${B3_SCHEMA}.time_entries,
      ${B3_SCHEMA}.work_events,
      ${B3_SCHEMA}.nfc_assignments,
      ${B3_SCHEMA}.nfc_tags,
      ${B3_SCHEMA}.customers,
      ${B3_SCHEMA}.identity_bindings,
      ${B3_SCHEMA}.memberships,
      ${B3_SCHEMA}.organizations,
      ${B3_SCHEMA}.users
    CASCADE
  `);
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.users (id) SELECT unnest($1::uuid[])`,
    [[
      c1Ids.employeeA,
      c1Ids.administratorA,
      c1Ids.employeeB,
      c1Ids.revokedBindingUser,
      c1Ids.missingMembershipUser,
      c1Ids.revokedMembershipUser,
    ]],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.organizations (id, name) VALUES
      ($1, 'Synthetic C1 A'), ($2, 'Synthetic C1 B')`,
    [c1Ids.organizationA, c1Ids.organizationB],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.memberships
      (id, organization_id, user_id, role, created_at, revoked_at) VALUES
      ($1, $6, $8, 'employee', '2026-07-01T00:00:00Z', NULL),
      ($2, $6, $9, 'administrator', '2026-07-01T00:00:00Z', NULL),
      ($3, $7, $10, 'employee', '2026-07-01T00:00:00Z', NULL),
      ($4, $6, $11, 'employee', '2026-07-01T00:00:00Z', NULL),
      ($5, $6, $12, 'employee', '2026-07-01T00:00:00Z', '2026-07-10T00:00:00Z')`,
    [
      c1Ids.employeeAMembership,
      c1Ids.administratorAMembership,
      c1Ids.employeeBMembership,
      c1Ids.revokedBindingMembership,
      c1Ids.revokedMembership,
      c1Ids.organizationA,
      c1Ids.organizationB,
      c1Ids.employeeA,
      c1Ids.administratorA,
      c1Ids.employeeB,
      c1Ids.revokedBindingUser,
      c1Ids.revokedMembershipUser,
    ],
  );
  await installerPool.query(
    `INSERT INTO ${B3_SCHEMA}.identity_bindings
      (id, user_id, issuer, subject, created_at, revoked_at) VALUES
      ('11000000-0000-4000-8000-000000000201', $1, $7, $9, '2026-07-01T00:00:00Z', NULL),
      ('11000000-0000-4000-8000-000000000202', $2, $7, $10, '2026-07-01T00:00:00Z', NULL),
      ('11000000-0000-4000-8000-000000000203', $3, $8, $9, '2026-07-01T00:00:00Z', NULL),
      ('11000000-0000-4000-8000-000000000204', $4, $7, $11, '2026-07-01T00:00:00Z',
        '2026-07-10T00:00:00Z'),
      ('11000000-0000-4000-8000-000000000205', $5, $7, $12, '2026-07-01T00:00:00Z', NULL),
      ('11000000-0000-4000-8000-000000000206', $6, $7, $13, '2026-07-01T00:00:00Z', NULL)`,
    [
      c1Ids.employeeA,
      c1Ids.administratorA,
      c1Ids.employeeB,
      c1Ids.revokedBindingUser,
      c1Ids.missingMembershipUser,
      c1Ids.revokedMembershipUser,
      issuers.issuerA,
      issuers.issuerB,
      c1Ids.sharedSubject,
      c1Ids.administratorSubject,
      c1Ids.revokedBindingSubject,
      c1Ids.missingMembershipSubject,
      c1Ids.revokedMembershipSubject,
    ],
  );
}

export async function startSyntheticJwks(): Promise<SyntheticJwksInfrastructure> {
  const primary = await generateKeyPair('RS256');
  const secondary = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(primary.publicKey);
  const keyId = 'c1-local-rs256';
  let issuerA = '';
  let issuerB = '';
  const server = createServer((request, response) => {
    if (
      request.url !== new URL(`${issuerA}/.well-known/jwks.json`).pathname
      && request.url !== new URL(`${issuerB}/.well-known/jwks.json`).pathname
    ) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end('{}');
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({
      keys: [{ ...publicJwk, alg: 'RS256', kid: keyId, use: 'sig' } satisfies JWK],
    }));
  });
  await listen(server);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Synthetic JWKS server did not expose a TCP address');
  }
  const origin = `http://127.0.0.1:${address.port}`;
  issuerA = `${origin}/synthetic-a/auth/v1`;
  issuerB = `${origin}/synthetic-b/auth/v1`;
  return {
    server,
    issuerA,
    issuerB,
    signingKey: primary.privateKey,
    otherSigningKey: secondary.privateKey,
    keyId,
  };
}

export async function accessToken(
  infrastructure: SyntheticJwksInfrastructure,
  options: AccessTokenOptions = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  let token = new SignJWT({
    aal: 'aal1',
    email: 'synthetic-c1@example.invalid',
    is_anonymous: false,
    phone: '',
    role: 'authenticated',
    session_id: '90000000-0000-4000-8000-000000000201',
    ...options.claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: infrastructure.keyId, typ: 'JWT' })
    .setIssuer(options.issuer ?? infrastructure.issuerA)
    .setAudience(options.audience ?? 'authenticated')
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 300);
  if (options.subject !== null) {
    token = token.setSubject(options.subject ?? c1Ids.sharedSubject);
  }
  if (options.notBefore !== undefined) {
    token = token.setNotBefore(options.notBefore);
  }
  return token.sign(options.key ?? infrastructure.signingKey);
}

export async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
}

export async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

export async function postgresErrorCode(operation: Promise<unknown>): Promise<string | undefined> {
  try {
    await operation;
    return undefined;
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : undefined;
  }
}
