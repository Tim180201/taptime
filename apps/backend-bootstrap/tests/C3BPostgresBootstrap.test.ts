import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWK,
} from 'jose';
import { Client, Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import {
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  applyMigrationSet,
  loadMigrations,
  migrate,
} from '@taptime/backend-schema';
import { bootstrapRequestDigestV1 } from '../src/digest.js';
import { OrganizationBootstrapCoordinator } from '../src/OrganizationBootstrapCoordinator.js';
import { PostgresBootstrapCapability } from '../src/PostgresBootstrapCapability.js';
import type { BootstrapOrganizationResult, VerifiedBootstrapRequest } from '../src/types.js';

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

const installerDatabaseUrl = process.env.C3B_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3b';
const operatorA = 'taptime_bootstrap_operator_aaaaaaaaaaaa';
const operatorB = 'taptime_bootstrap_operator_bbbbbbbbbbbb';
const operatorPasswords = {
  [operatorA]: randomBytes(32).toString('base64url'),
  [operatorB]: randomBytes(32).toString('base64url'),
};
const requestA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const requestB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const seededUser = '10000000-0000-4000-8000-000000000090';
const seededBinding = '11000000-0000-4000-8000-000000000090';

let installerPool: Pool;
let jwks: Awaited<ReturnType<typeof createJwksServer>>;
let verifier: SupabaseJwtAccessTokenVerifier;

beforeAll(async () => {
  installerPool = new Pool({ connectionString: installerDatabaseUrl, max: 4 });
  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  const migration = await migrate(installerPool);
  expect(migration.applied).toEqual(['001', '002', '003', '004', '005', '006', '007', '008', '009', '010']);
  jwks = await createJwksServer();
  verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer: jwks.issuer,
    jwksUrl: new URL(`${jwks.issuer}/.well-known/jwks.json`),
    allowedAlgorithms: ['ES256'],
  });
  await normalizeOperators();
}, 30_000);

beforeEach(async () => {
  await removeFailureTrigger();
  await truncateBootstrapState();
  await normalizeOperators();
});

afterAll(async () => {
  await removeFailureTrigger();
  for (const operator of [operatorA, operatorB]) {
    await installerPool.query(`DROP OWNED BY ${operator}`);
    await installerPool.query(`REVOKE taptime_bootstrap_executor FROM ${operator}`);
    await installerPool.query(`DROP ROLE IF EXISTS ${operator}`);
  }
  await installerPool.end();
  await new Promise<void>((resolve, reject) => jwks.server.close((error) => error ? reject(error) : resolve()));
});

describe('migration 006 and role graph', () => {
  it('records exactly migrations 001 through 010 and reruns the immutable ledger', async () => {
    expect((await loadMigrations()).map(({ version }) => version)).toEqual([
      '001', '002', '003', '004', '005', '006', '007', '008', '009', '010',
    ]);
    await expect(migrate(installerPool)).resolves.toEqual({
      applied: [], alreadyApplied: ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010'],
    });
  });

  it('pins PostgreSQL 17, UTF8, and Unicode 15.1 for taptime-name-v1', async () => {
    const result = await installerPool.query<{
      major: string;
      encoding: string;
      unicode: string;
    }>(`
      SELECT
        substring(current_setting('server_version_num') FROM 1 FOR 2) AS major,
        current_setting('server_encoding') AS encoding,
        unicode_version() AS unicode
    `);
    expect(result.rows[0]).toEqual({ major: '17', encoding: 'UTF8', unicode: '15.1' });
  });

  it('adds one FORCE-RLS receipt table without any normal-runtime read or write capability', async () => {
    const result = await installerPool.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(`
      SELECT relation.relrowsecurity, relation.relforcerowsecurity
      FROM pg_class AS relation
      WHERE relation.oid = '${B3_SCHEMA}.bootstrap_receipts'::regclass
    `);
    expect(result.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
    const privileges = await installerPool.query(`
      SELECT role_name,
        has_table_privilege(role_name, '${B3_SCHEMA}.bootstrap_receipts', 'SELECT') AS can_select,
        has_table_privilege(role_name, '${B3_SCHEMA}.bootstrap_receipts', 'INSERT') AS can_insert,
        has_table_privilege(role_name, '${B3_SCHEMA}.bootstrap_receipts', 'UPDATE') AS can_update,
        has_table_privilege(role_name, '${B3_SCHEMA}.bootstrap_receipts', 'DELETE') AS can_delete,
        has_table_privilege(role_name, '${B3_SCHEMA}.bootstrap_receipts', 'TRUNCATE') AS can_truncate
      FROM unnest(ARRAY[
        'taptime_employee', 'taptime_administrator', 'taptime_server_lifecycle',
        'taptime_identity_resolver'
      ]) AS role_name
      ORDER BY role_name
    `);
    expect(privileges.rows).toEqual([
      'taptime_administrator', 'taptime_employee', 'taptime_identity_resolver',
      'taptime_server_lifecycle',
    ].map((role_name) => ({
      role_name, can_select: false, can_insert: false, can_update: false,
      can_delete: false, can_truncate: false,
    })));
  });

  it('keeps the receipt schema free of token, issuer, subject, email, and organization name', async () => {
    const columns = await installerPool.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = '${B3_SCHEMA}' AND table_name = 'bootstrap_receipts'
      ORDER BY ordinal_position
    `);
    expect(columns.rows.map(({ column_name }) => column_name)).toEqual([
      'request_id', 'request_hash_version', 'request_hash', 'operator_principal', 'user_id',
      'identity_binding_id', 'organization_id', 'membership_id', 'created_at',
    ]);
  });

  it('normalizes executor and function-owner attributes exactly', async () => {
    const roles = await installerPool.query(`
      SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole,
        rolreplication, rolbypassrls
      FROM pg_roles
      WHERE rolname IN ('taptime_bootstrap_executor', 'taptime_bootstrap_function_owner')
      ORDER BY rolname
    `);
    expect(roles.rows).toEqual([
      {
        rolname: 'taptime_bootstrap_executor', rolcanlogin: false, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false,
        rolbypassrls: false,
      },
      {
        rolname: 'taptime_bootstrap_function_owner', rolcanlogin: false, rolinherit: false,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false,
        rolbypassrls: true,
      },
    ]);
  });

  it('gives executor schema USAGE and exactly one function capability but zero table grants', async () => {
    const result = await installerPool.query<{
      schema_usage: boolean;
      capability_execute: boolean;
      table_grants: string;
    }>(`
      SELECT
        has_schema_privilege('taptime_bootstrap_executor', '${B3_SCHEMA}', 'USAGE') AS schema_usage,
        has_function_privilege(
          'taptime_bootstrap_executor',
          '${B3_SCHEMA}.bootstrap_first_organization(uuid,text,text,text)',
          'EXECUTE'
        ) AS capability_execute,
        (SELECT count(*) FROM information_schema.role_table_grants
          WHERE grantee = 'taptime_bootstrap_executor')::text AS table_grants
    `);
    expect(result.rows[0]).toEqual({ schema_usage: true, capability_execute: true, table_grants: '0' });
  });

  it('gives the owner SELECT and INSERT only on the exact six bootstrap tables', async () => {
    const grants = await installerPool.query<{ table_name: string; privilege_type: string }>(`
      SELECT table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee = 'taptime_bootstrap_function_owner'
      ORDER BY table_name, privilege_type
    `);
    expect(grants.rows).toEqual([
      ['audit_events', 'INSERT'], ['audit_events', 'SELECT'],
      ['bootstrap_receipts', 'INSERT'], ['bootstrap_receipts', 'SELECT'],
      ['identity_bindings', 'INSERT'], ['identity_bindings', 'SELECT'],
      ['memberships', 'INSERT'], ['memberships', 'SELECT'],
      ['organizations', 'INSERT'], ['organizations', 'SELECT'],
      ['users', 'INSERT'], ['users', 'SELECT'],
    ].map(([table_name, privilege_type]) => ({ table_name, privilege_type })));
  });

  it('gives the owner exactly the external name-normalization capability required by Organization constraints', async () => {
    const grants = await installerPool.query<{
      function_name: string;
      privilege_type: string;
      is_grantable: boolean;
    }>(`
      SELECT capability.oid::regprocedure::text AS function_name,
        privilege.privilege_type,
        privilege.is_grantable
      FROM pg_proc AS capability
      JOIN pg_namespace AS namespace ON namespace.oid = capability.pronamespace
      CROSS JOIN LATERAL aclexplode(capability.proacl) AS privilege
      JOIN pg_roles AS grantee ON grantee.oid = privilege.grantee
      WHERE namespace.nspname = '${B3_SCHEMA}'
        AND grantee.rolname = 'taptime_bootstrap_function_owner'
        AND capability.proowner <> grantee.oid
      ORDER BY function_name, privilege_type
    `);
    expect(grants.rows).toEqual([
      {
        function_name: `${B3_SCHEMA}.normalize_membership_display_name_v1(text)`,
        privilege_type: 'EXECUTE',
        is_grantable: false,
      },
      {
        function_name: `${B3_SCHEMA}.normalize_taptime_name_v1(text,text)`,
        privilege_type: 'EXECUTE',
        is_grantable: false,
      },
    ]);
  });

  it('makes the function owner own exactly one schema function and no table', async () => {
    const result = await installerPool.query<{ owned_functions: string; owned_relations: string }>(`
      SELECT
        (SELECT count(*) FROM pg_proc AS capability
          JOIN pg_roles AS owner ON owner.oid = capability.proowner
          JOIN pg_namespace AS namespace ON namespace.oid = capability.pronamespace
          WHERE owner.rolname = 'taptime_bootstrap_function_owner'
            AND namespace.nspname = '${B3_SCHEMA}')::text AS owned_functions,
        (SELECT count(*) FROM pg_class AS relation
          JOIN pg_roles AS owner ON owner.oid = relation.relowner
          WHERE owner.rolname = 'taptime_bootstrap_function_owner')::text AS owned_relations
    `);
    expect(result.rows[0]).toEqual({ owned_functions: '1', owned_relations: '0' });
  });

  it('proves the complete bootstrap-role dependency, membership, operator ACL, and database graph', async () => {
    const dependencies = await installerPool.query(`
      SELECT role.rolname, dependency.classid::regclass::text AS object_class,
        dependency.deptype, count(*)::text AS dependency_count
      FROM pg_shdepend AS dependency
      JOIN pg_roles AS role ON role.oid = dependency.refobjid
      WHERE dependency.refclassid = 'pg_authid'::regclass
        AND role.rolname IN (
          'taptime_bootstrap_executor', 'taptime_bootstrap_function_owner', $1, $2
        )
        AND dependency.dbid IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
      GROUP BY role.rolname, dependency.classid, dependency.deptype
      ORDER BY role.rolname, object_class, dependency.deptype
    `, [operatorA, operatorB]);
    expect(dependencies.rows).toEqual([
      { rolname: 'taptime_bootstrap_executor', object_class: 'pg_namespace', deptype: 'a', dependency_count: '1' },
      { rolname: 'taptime_bootstrap_executor', object_class: 'pg_proc', deptype: 'a', dependency_count: '1' },
      { rolname: 'taptime_bootstrap_function_owner', object_class: 'pg_class', deptype: 'a', dependency_count: '6' },
      { rolname: 'taptime_bootstrap_function_owner', object_class: 'pg_namespace', deptype: 'a', dependency_count: '1' },
      { rolname: 'taptime_bootstrap_function_owner', object_class: 'pg_proc', deptype: 'a', dependency_count: '2' },
      { rolname: 'taptime_bootstrap_function_owner', object_class: 'pg_proc', deptype: 'o', dependency_count: '1' },
      { rolname: operatorA, object_class: 'pg_database', deptype: 'a', dependency_count: '1' },
      { rolname: operatorB, object_class: 'pg_database', deptype: 'a', dependency_count: '1' },
    ]);

    const edges = await installerPool.query(`
      SELECT parent.rolname AS parent, member.rolname AS member,
        edge.inherit_option, edge.set_option, edge.admin_option
      FROM pg_auth_members AS edge
      JOIN pg_roles AS parent ON parent.oid = edge.roleid
      JOIN pg_roles AS member ON member.oid = edge.member
      WHERE parent.rolname IN ('taptime_bootstrap_executor', 'taptime_bootstrap_function_owner')
        OR member.rolname IN ('taptime_bootstrap_executor', 'taptime_bootstrap_function_owner', $1, $2)
      ORDER BY parent, member
    `, [operatorA, operatorB]);
    expect(edges.rows).toEqual([
      {
        parent: 'taptime_bootstrap_executor', member: operatorA,
        inherit_option: false, set_option: true, admin_option: false,
      },
      {
        parent: 'taptime_bootstrap_executor', member: operatorB,
        inherit_option: false, set_option: true, admin_option: false,
      },
    ]);

    const databasePrivileges = await installerPool.query(`
      SELECT role_name,
        has_database_privilege(role_name, current_database(), 'CONNECT') AS can_connect,
        has_database_privilege(role_name, current_database(), 'CREATE') AS can_create,
        has_database_privilege(role_name, current_database(), 'TEMPORARY') AS can_temp
      FROM unnest(ARRAY[$1, $2]) AS role_name ORDER BY role_name
    `, [operatorA, operatorB]);
    expect(databasePrivileges.rows).toEqual([operatorA, operatorB].map((role_name) => ({
      role_name, can_connect: true, can_create: false, can_temp: false,
    })));
  });

  it('fixes the SECURITY DEFINER search path to pg_catalog and revokes PUBLIC execution', async () => {
    const result = await installerPool.query<{
      prosecdef: boolean;
      proconfig: string[];
      public_execute: boolean;
    }>(`
      SELECT capability.prosecdef, capability.proconfig,
        EXISTS (
          SELECT 1 FROM aclexplode(capability.proacl) AS privilege
          WHERE privilege.grantee = 0 AND privilege.privilege_type = 'EXECUTE'
        ) AS public_execute
      FROM pg_proc AS capability
      WHERE capability.oid = '${B3_SCHEMA}.bootstrap_first_organization(uuid,text,text,text)'::regprocedure
    `);
    expect(result.rows[0]).toEqual({ prosecdef: true, proconfig: ['search_path=pg_catalog'], public_execute: false });
  });

  it('denies the named NOINHERIT operator before explicit role assumption', async () => {
    const client = await operatorClient(operatorA);
    try {
      await expect(client.query(
        `SELECT * FROM ${B3_SCHEMA}.bootstrap_first_organization($1, $2, $3, $4)`,
        [requestA, 'TapTim.e', jwks.issuer, 'subject-a'],
      )).rejects.toMatchObject({ code: '42501' });
    } finally {
      await client.end();
    }
  });

  it('denies owner assumption and denies the capability again after RESET ROLE', async () => {
    const client = await operatorClient(operatorA);
    try {
      await expect(client.query('SET ROLE taptime_bootstrap_function_owner')).rejects.toMatchObject({ code: '42501' });
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE taptime_bootstrap_executor');
      await client.query('RESET ROLE');
      await expect(client.query(
        `SELECT * FROM ${B3_SCHEMA}.bootstrap_first_organization($1, $2, $3, $4)`,
        [requestA, 'TapTim.e', jwks.issuer, 'subject-a'],
      )).rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK');
    } finally {
      await client.end();
    }
  });

  it.each(['taptime_employee', 'taptime_administrator', 'taptime_server_lifecycle', 'taptime_identity_resolver'])(
    'does not let ordinary role %s assume executor or owner',
    async (role) => {
      const memberships = await installerPool.query<{ count: string }>(`
        SELECT count(*)::text
        FROM pg_auth_members AS edge
        JOIN pg_roles AS member ON member.oid = edge.member
        JOIN pg_roles AS parent ON parent.oid = edge.roleid
        WHERE member.rolname = $1
          AND parent.rolname IN ('taptime_bootstrap_executor', 'taptime_bootstrap_function_owner')
      `, [role]);
      expect(memberships.rows[0]?.count).toBe('0');
    },
  );

  it('rejects an already-open operator session after credential expiry', async () => {
    const client = await operatorClient(operatorA);
    try {
      await installerPool.query(`ALTER ROLE ${operatorA} VALID UNTIL '2000-01-01T00:00:00Z'`);
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE taptime_bootstrap_executor');
      const result = await client.query(`
        SELECT * FROM ${B3_SCHEMA}.bootstrap_first_organization($1, $2, $3, $4)
      `, [requestA, 'TapTim.e', jwks.issuer, 'subject-a']);
      expect(result.rows[0]?.result_status).toBe('operator_not_authorized');
      await client.query('COMMIT');
    } finally {
      await client.end();
    }
  });

  it.each([
    ['an extra parent role', async () => installerPool.query(
      `GRANT taptime_employee TO ${operatorA} WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`,
    )],
    ['an inheritable executor edge', async () => {
      await installerPool.query(`REVOKE taptime_bootstrap_executor FROM ${operatorA}`);
      await installerPool.query(
        `GRANT taptime_bootstrap_executor TO ${operatorA} WITH INHERIT TRUE, SET TRUE, ADMIN FALSE`,
      );
    }],
    ['a credential lifetime beyond 24 hours', async () => installerPool.query(
      `ALTER ROLE ${operatorA} VALID UNTIL '2099-01-01T00:00:00Z'`,
    )],
  ] as const)('rejects operator role drift: %s', async (_label, arrange) => {
    await arrange();
    const result = await directCapability(operatorA, {
      requestId: requestA,
      canonicalOrganizationName: 'TapTim.e',
      identity: { issuer: jwks.issuer, subject: 'subject-a' },
    });
    expect(result).toEqual({ status: 'rejected', reason: 'operator_not_authorized' });
  });

  it.each([
    [
      'a direct table ACL',
      `GRANT SELECT ON ${B3_SCHEMA}.users TO ${operatorA}`,
      `REVOKE SELECT ON ${B3_SCHEMA}.users FROM ${operatorA}`,
    ],
    [
      'database TEMPORARY',
      `GRANT TEMPORARY ON DATABASE ${new URL(installerDatabaseUrl).pathname.slice(1)} TO ${operatorA}`,
      `REVOKE TEMPORARY ON DATABASE ${new URL(installerDatabaseUrl).pathname.slice(1)} FROM ${operatorA}`,
    ],
  ])('rejects operator direct-authority drift: %s', async (_label, arrange, cleanup) => {
    await installerPool.query(arrange);
    try {
      const result = await directCapability(operatorA, {
        requestId: requestA,
        canonicalOrganizationName: 'TapTim.e',
        identity: { issuer: jwks.issuer, subject: 'subject-a' },
      });
      expect(result).toEqual({ status: 'rejected', reason: 'operator_not_authorized' });
    } finally {
      await installerPool.query(cleanup);
    }
  });

  it.each([
    'shared_bootstrap_operator',
    'taptime_bootstrap_operator_aaaaaaaaaaaä',
  ])('rejects directly connected shared, malformed, or non-ASCII principal %s at the database authority', async (principal) => {
    const quotedPrincipal = quoteIdentifier(principal);
    const password = randomBytes(32).toString('base64url');
    const database = new URL(installerDatabaseUrl).pathname.slice(1);
    await installerPool.query(`
      DROP ROLE IF EXISTS ${quotedPrincipal};
      CREATE ROLE ${quotedPrincipal} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
        NOREPLICATION NOBYPASSRLS PASSWORD '${password}' VALID UNTIL '${new Date(Date.now() + 3_600_000).toISOString()}';
      GRANT taptime_bootstrap_executor TO ${quotedPrincipal} WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
      GRANT CONNECT ON DATABASE ${database} TO ${quotedPrincipal};
    `);
    const url = new URL(installerDatabaseUrl);
    const client = new Client({
      host: url.hostname,
      port: Number(url.port || '5432'),
      database,
      user: principal,
      password,
      ssl: false,
    });
    try {
      await client.connect();
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE taptime_bootstrap_executor');
      const result = await client.query(`
        SELECT * FROM ${B3_SCHEMA}.bootstrap_first_organization($1, $2, $3, $4)
      `, [requestA, 'TapTim.e', jwks.issuer, 'subject-a']);
      expect(result.rows[0]?.result_status).toBe('operator_not_authorized');
      await client.query('COMMIT');
      expect(await bootstrapState()).toEqual({
        users: '0', bindings: '0', organizations: '0', memberships: '0', receipts: '0', audits: '0',
      });
    } finally {
      await client.end().catch(() => undefined);
      await installerPool.query(`REVOKE taptime_bootstrap_executor FROM ${quotedPrincipal}`);
      await installerPool.query(`REVOKE CONNECT ON DATABASE ${database} FROM ${quotedPrincipal}`);
      await installerPool.query(`DROP ROLE IF EXISTS ${quotedPrincipal}`);
    }
  });

  it.each([
    ['direct schema ACL', 'GRANT USAGE ON SCHEMA dirty_bootstrap TO taptime_bootstrap_executor'],
    ['schema ownership', 'ALTER SCHEMA dirty_bootstrap OWNER TO taptime_bootstrap_executor'],
  ])('fails migration 006 for a dirty pre-existing bootstrap role: %s', async (_label, contaminate) => {
    const database = `taptime_c3b_dirty_${contaminate.startsWith('GRANT') ? 'acl' : 'owner'}`;
    await installerPool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await installerPool.query(`CREATE DATABASE ${database}`);
    const url = new URL(installerDatabaseUrl);
    url.pathname = `/${database}`;
    const pool = new Pool({ connectionString: url.href, max: 2 });
    try {
      const migrations = await loadMigrations();
      await applyMigrationSet(pool, migrations.slice(0, 5));
      await pool.query('CREATE SCHEMA dirty_bootstrap');
      await pool.query(contaminate);
      await expect(applyMigrationSet(pool, migrations.slice(5))).rejects.toMatchObject({ code: '42501' });
    } finally {
      await pool.end();
      await installerPool.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    }
  });
});

describe('verified first Organization and Administrator bootstrap', () => {
  it('uses the genuine issuer-bound B4 verifier and creates one complete initial tenant', async () => {
    const result = await bootstrap(operatorA, requestA, '  Cafe\u0301 GmbH  ', 'subject-a');
    expect(result).toMatchObject({ status: 'succeeded', idempotentRetry: false });
    const state = await bootstrapState();
    expect(state).toEqual({ users: '1', bindings: '1', organizations: '1', memberships: '1', receipts: '1', audits: '3' });
    const domain = await installerPool.query(`
      SELECT organization.name, membership.role, membership.created_by_user_id, membership.revoked_at
      FROM ${B3_SCHEMA}.organizations AS organization
      JOIN ${B3_SCHEMA}.memberships AS membership ON membership.organization_id = organization.id
    `);
    expect(domain.rows[0]).toEqual({
      name: 'Café GmbH', role: 'administrator', created_by_user_id: null, revoked_at: null,
    });
  });

  it('writes exactly three operator-attributed, actor-null, request-correlated audits', async () => {
    await bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a');
    const audits = await installerPool.query(`
      SELECT event_type, entity_type, actor_user_id, operator_principal, correlation_id, payload
      FROM ${B3_SCHEMA}.audit_events ORDER BY recorded_at, event_type
    `);
    expect(audits.rows).toEqual([
      {
        event_type: 'FirstAdministratorMembershipGranted', entity_type: 'Membership', actor_user_id: null,
        operator_principal: operatorA, correlation_id: requestA, payload: { role: 'administrator' },
      },
      {
        event_type: 'IdentityBindingEstablished', entity_type: 'IdentityBinding', actor_user_id: null,
        operator_principal: operatorA, correlation_id: requestA, payload: {},
      },
      {
        event_type: 'OrganizationBootstrapped', entity_type: 'Organization', actor_user_id: null,
        operator_principal: operatorA, correlation_id: requestA, payload: {},
      },
    ]);
  });

  it('stores the exact Node/SQL canonical digest golden contract', async () => {
    await bootstrap(operatorA, requestA, 'TapTim.e GmbH', 'subject-a');
    const receipt = await installerPool.query<{ digest: string; request_hash_version: number }>(`
      SELECT encode(request_hash, 'hex') AS digest, request_hash_version
      FROM ${B3_SCHEMA}.bootstrap_receipts WHERE request_id = $1
    `, [requestA]);
    expect(receipt.rows[0]).toEqual({
      digest: bootstrapRequestDigestV1('TapTim.e GmbH', jwks.issuer, 'subject-a'),
      request_hash_version: 1,
    });
  });

  it('returns the exact original IDs on same-operator replay and appends nothing', async () => {
    const first = await bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a');
    const replay = await bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a');
    expect(replay).toEqual({ ...first, idempotentRetry: true });
    expect(await bootstrapState()).toEqual({
      users: '1', bindings: '1', organizations: '1', memberships: '1', receipts: '1', audits: '3',
    });
  });

  it('treats normalization-equivalent same-operator content as exact replay', async () => {
    const first = await bootstrap(operatorA, requestA, 'Café', 'subject-a');
    const replay = await bootstrap(operatorA, requestA, 'Cafe\u0301', 'subject-a');
    expect(replay).toEqual({ ...first, idempotentRetry: true });
  });

  it('returns an ID-free conflict for the same operator and different canonical content', async () => {
    await bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a');
    expect(await bootstrap(operatorA, requestA, 'Other GmbH', 'subject-a')).toEqual({
      status: 'rejected', reason: 'request_id_conflict',
    });
    expect(await bootstrapState()).toEqual({
      users: '1', bindings: '1', organizations: '1', memberships: '1', receipts: '1', audits: '3',
    });
  });

  it.each([
    ['same content', 'TapTim.e', 'subject-a'],
    ['different content and identity', 'Attacker Name', 'different-subject'],
  ])('rejects cross-operator replay before content disclosure: %s', async (_label, name, subject) => {
    await bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a');
    const result = await bootstrap(operatorB, requestA, name, subject);
    expect(result).toEqual({ status: 'rejected', reason: 'operator_replay_forbidden' });
    expect(JSON.stringify(result)).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/);
    const rejected = await installerPool.query(`
      SELECT organization_id IS NOT NULL AS organization_bound, actor_user_id,
        operator_principal, event_type, entity_type, entity_id, correlation_id, payload
      FROM ${B3_SCHEMA}.audit_events WHERE event_type = 'BootstrapReplayRejected'
    `);
    expect(rejected.rows).toEqual([{
      organization_bound: true,
      actor_user_id: null,
      operator_principal: operatorB,
      event_type: 'BootstrapReplayRejected',
      entity_type: 'BootstrapRequest',
      entity_id: requestA,
      correlation_id: requestA,
      payload: { reason: 'operator_mismatch' },
    }]);
  });

  it('reuses one active IdentityBinding only when its User has no Membership', async () => {
    await seedIdentity({ revoked: false, membership: 'none' });
    const result = await bootstrap(operatorA, requestA, 'TapTim.e', 'seeded-subject');
    expect(result).toMatchObject({
      status: 'succeeded', userId: seededUser, identityBindingId: seededBinding,
    });
    const events = await installerPool.query<{ event_type: string }>(`
      SELECT event_type FROM ${B3_SCHEMA}.audit_events WHERE entity_type = 'IdentityBinding'
    `);
    expect(events.rows).toEqual([{ event_type: 'IdentityBindingReused' }]);
    expect((await bootstrapState()).bindings).toBe('1');
  });

  it.each([
    ['a revoked binding', { revoked: true, membership: 'none' as const }],
    ['an active Membership', { revoked: false, membership: 'active' as const }],
    ['a historical Membership', { revoked: false, membership: 'revoked' as const }],
  ])('fails closed for %s', async (_label, state) => {
    await seedIdentity(state);
    expect(await bootstrap(operatorA, requestA, 'TapTim.e', 'seeded-subject')).toEqual({
      status: 'rejected', reason: 'identity_unavailable',
    });
    expect((await bootstrapState()).receipts).toBe('0');
    expect((await bootstrapState()).audits).toBe('0');
  });

  it.each([
    ['empty-after-trim', '   '],
    ['control', 'A\u0001B'],
    ['private-use', `A${String.fromCodePoint(0xe000)}B`],
    ['unassigned-15.1', `A${String.fromCodePoint(0x0897)}B`],
    ['scalar-overflow', 'a'.repeat(121)],
  ])('database authority independently rejects invalid name: %s', async (_label, name) => {
    const result = await directCapability(operatorA, {
      requestId: requestA,
      canonicalOrganizationName: name,
      identity: { issuer: jwks.issuer, subject: 'subject-a' },
    });
    expect(result).toEqual({ status: 'rejected', reason: 'invalid_request' });
    expect(await bootstrapState()).toEqual({
      users: '0', bindings: '0', organizations: '0', memberships: '0', receipts: '0', audits: '0',
    });
  });

  it.each([
    ['nil UUID', '00000000-0000-0000-0000-000000000000'],
    ['non-RFC version', 'aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa'],
    ['non-RFC variant', 'aaaaaaaa-aaaa-4aaa-0aaa-aaaaaaaaaaaa'],
  ])('database authority independently rejects malformed request identity: %s', async (_label, requestId) => {
    const result = await directCapability(operatorA, {
      requestId,
      canonicalOrganizationName: 'TapTim.e',
      identity: { issuer: jwks.issuer, subject: 'subject-a' },
    });
    expect(result).toEqual({ status: 'rejected', reason: 'invalid_request' });
    expect((await bootstrapState()).receipts).toBe('0');
  });

  it('does not persist access token, issuer, subject, email, or organization name in receipt/audit', async () => {
    const subject = 'subject-sentinel-private';
    const token = await jwks.accessToken(subject, 'email-sentinel@example.invalid');
    await bootstrap(operatorA, requestA, 'Name Sentinel Private', subject, token);
    const evidence = await installerPool.query<{ receipts: string; audits: string }>(`
      SELECT
        (SELECT jsonb_agg(receipt)::text FROM ${B3_SCHEMA}.bootstrap_receipts AS receipt) AS receipts,
        (SELECT jsonb_agg(audit)::text FROM ${B3_SCHEMA}.audit_events AS audit) AS audits
    `);
    const serialized = JSON.stringify(evidence.rows[0]);
    for (const sentinel of [token, jwks.issuer, subject, 'email-sentinel@example.invalid', 'Name Sentinel Private']) {
      expect(serialized).not.toContain(sentinel);
    }
  });
});

describe('bootstrap concurrency and rollback', () => {
  it('serializes two exact same-request attempts into one success and one replay', async () => {
    const token = await jwks.accessToken('subject-a');
    const results = await Promise.all([
      bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a', token),
      bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a', token),
    ]);
    expect(results.map((result) => result.status)).toEqual(['succeeded', 'succeeded']);
    expect(results.map((result) => result.status === 'succeeded' && result.idempotentRetry).sort()).toEqual([false, true]);
    expect(await bootstrapState()).toEqual({
      users: '1', bindings: '1', organizations: '1', memberships: '1', receipts: '1', audits: '3',
    });
  });

  it('serializes distinct requests for the same identity and permits exactly one tenant', async () => {
    const token = await jwks.accessToken('subject-a');
    const results = await Promise.all([
      bootstrap(operatorA, requestA, 'TapTim.e A', 'subject-a', token),
      bootstrap(operatorA, requestB, 'TapTim.e B', 'subject-a', token),
    ]);
    expect(results.map((result) => result.status === 'succeeded' ? 'succeeded' : result.reason).sort()).toEqual([
      'identity_unavailable', 'succeeded',
    ]);
    expect((await bootstrapState()).organizations).toBe('1');
  });

  it('serializes two active bindings for the same User and returns one deterministic identity rejection', async () => {
    await installerPool.query(`INSERT INTO ${B3_SCHEMA}.users (id) VALUES ($1)`, [seededUser]);
    await installerPool.query(`
      INSERT INTO ${B3_SCHEMA}.identity_bindings (id, user_id, issuer, subject)
      VALUES
        ($2, $1, $3, 'same-user-subject-a'),
        ('11000000-0000-4000-8000-000000000091', $1, $3, 'same-user-subject-b')
    `, [seededUser, seededBinding, jwks.issuer]);
    const results = await Promise.all([
      bootstrap(operatorA, requestA, 'TapTim.e A', 'same-user-subject-a'),
      bootstrap(operatorB, requestB, 'TapTim.e B', 'same-user-subject-b'),
    ]);
    expect(results.map((result) => result.status === 'succeeded' ? 'succeeded' : result.reason).sort()).toEqual([
      'identity_unavailable', 'succeeded',
    ]);
    expect((await bootstrapState()).organizations).toBe('1');
  });

  it('serializes two operators on one request without disclosing the winning result', async () => {
    const token = await jwks.accessToken('subject-a');
    const results = await Promise.all([
      bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a', token),
      bootstrap(operatorB, requestA, 'TapTim.e', 'subject-a', token),
    ]);
    expect(results.filter((result) => result.status === 'succeeded')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([
      { status: 'rejected', reason: 'operator_replay_forbidden' },
    ]);
    expect((await bootstrapState()).audits).toBe('4');
  });

  it.each([
    ['users', ''],
    ['identity_bindings', ''],
    ['organizations', ''],
    ['memberships', ''],
    ['audit_events', 'IdentityBindingEstablished'],
    ['audit_events', 'OrganizationBootstrapped'],
    ['audit_events', 'FirstAdministratorMembershipGranted'],
    ['bootstrap_receipts', ''],
  ])('rolls back every write when a test-only trigger fails after %s %s', async (table, eventType) => {
    await installFailureTrigger(table, eventType);
    expect(await bootstrap(operatorA, requestA, 'TapTim.e', 'subject-a')).toEqual({
      status: 'unavailable', reason: 'service_unavailable',
    });
    await removeFailureTrigger(table);
    expect(await bootstrapState()).toEqual({
      users: '0', bindings: '0', organizations: '0', memberships: '0', receipts: '0', audits: '0',
    });
  });
});

async function bootstrap(
  operator: keyof typeof operatorPasswords,
  requestId: string,
  name: string,
  subject: string,
  token?: string,
): Promise<BootstrapOrganizationResult> {
  const capability = capabilityFor(operator);
  return new OrganizationBootstrapCoordinator(verifier, capability).bootstrap({
    requestId,
    organizationDisplayName: name,
    accessToken: token ?? await jwks.accessToken(subject),
  });
}

function capabilityFor(operator: keyof typeof operatorPasswords): PostgresBootstrapCapability {
  const url = new URL(installerDatabaseUrl);
  return new PostgresBootstrapCapability({
    target: {
      mode: 'loopback-test',
      host: url.hostname,
      port: Number(url.port || '5432'),
      database: url.pathname.slice(1),
      ssl: false,
    },
    operatorPrincipal: operator,
    passwordProvider: async () => operatorPasswords[operator],
  });
}

function directCapability(
  operator: keyof typeof operatorPasswords,
  request: VerifiedBootstrapRequest,
): Promise<BootstrapOrganizationResult> {
  return capabilityFor(operator).execute(request);
}

async function operatorClient(operator: keyof typeof operatorPasswords): Promise<Client> {
  const url = new URL(installerDatabaseUrl);
  const client = new Client({
    host: url.hostname,
    port: Number(url.port || '5432'),
    database: url.pathname.slice(1),
    user: operator,
    password: operatorPasswords[operator],
    ssl: false,
  });
  await client.connect();
  return client;
}

async function normalizeOperators(): Promise<void> {
  const expiry = new Date(Date.now() + 60 * 60 * 1_000).toISOString();
  for (const operator of [operatorA, operatorB] as const) {
    await installerPool.query(`
      DO $operator$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${operator}') THEN
          CREATE ROLE ${operator} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOREPLICATION NOBYPASSRLS;
        END IF;
      END
      $operator$;
      ALTER ROLE ${operator} WITH LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
        NOREPLICATION NOBYPASSRLS PASSWORD '${operatorPasswords[operator]}' VALID UNTIL '${expiry}';
      REVOKE taptime_employee, taptime_administrator, taptime_server_lifecycle,
        taptime_identity_resolver, taptime_bootstrap_executor FROM ${operator};
      REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${B3_SCHEMA} FROM ${operator};
      REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${B3_SCHEMA} FROM ${operator};
      REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${B3_SCHEMA} FROM ${operator};
      REVOKE ALL PRIVILEGES ON SCHEMA ${B3_SCHEMA} FROM ${operator};
      REVOKE CREATE, TEMPORARY ON DATABASE ${new URL(installerDatabaseUrl).pathname.slice(1)} FROM ${operator};
      GRANT taptime_bootstrap_executor TO ${operator} WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
      GRANT CONNECT ON DATABASE ${new URL(installerDatabaseUrl).pathname.slice(1)} TO ${operator};
    `);
  }
}

async function truncateBootstrapState(): Promise<void> {
  await installerPool.query(`
    TRUNCATE TABLE
      ${B3_SCHEMA}.bootstrap_receipts,
      ${B3_SCHEMA}.audit_events,
      ${B3_SCHEMA}.sync_receipts,
      ${B3_SCHEMA}.canonical_decisions,
      ${B3_SCHEMA}.time_entries,
      ${B3_SCHEMA}.work_events,
      ${B3_SCHEMA}.nfc_assignments,
      ${B3_SCHEMA}.nfc_tags,
      ${B3_SCHEMA}.customers,
      ${B3_SCHEMA}.memberships,
      ${B3_SCHEMA}.identity_bindings,
      ${B3_SCHEMA}.organizations,
      ${B3_SCHEMA}.users
    CASCADE
  `);
}

async function bootstrapState() {
  const result = await installerPool.query(`
    SELECT
      (SELECT count(*)::text FROM ${B3_SCHEMA}.users) AS users,
      (SELECT count(*)::text FROM ${B3_SCHEMA}.identity_bindings) AS bindings,
      (SELECT count(*)::text FROM ${B3_SCHEMA}.organizations) AS organizations,
      (SELECT count(*)::text FROM ${B3_SCHEMA}.memberships) AS memberships,
      (SELECT count(*)::text FROM ${B3_SCHEMA}.bootstrap_receipts) AS receipts,
      (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events) AS audits
  `);
  return result.rows[0] as {
    users: string; bindings: string; organizations: string;
    memberships: string; receipts: string; audits: string;
  };
}

async function seedIdentity(configuration: {
  readonly revoked: boolean;
  readonly membership: 'none' | 'active' | 'revoked';
}): Promise<void> {
  await installerPool.query(`INSERT INTO ${B3_SCHEMA}.users (id) VALUES ($1)`, [seededUser]);
  await installerPool.query(`
    INSERT INTO ${B3_SCHEMA}.identity_bindings
      (id, user_id, issuer, subject, created_at, revoked_at)
    VALUES ($2, $1, $3, 'seeded-subject', '2026-01-01T00:00:00Z', $4)
  `, [
    seededUser,
    seededBinding,
    jwks.issuer,
    configuration.revoked ? '2026-02-01T00:00:00Z' : null,
  ]);
  if (configuration.membership !== 'none') {
    await installerPool.query(`
      INSERT INTO ${B3_SCHEMA}.organizations (id, name)
      VALUES ('20000000-0000-4000-8000-000000000090', 'Existing')
    `);
    await installerPool.query(`
      INSERT INTO ${B3_SCHEMA}.memberships
        (id, organization_id, user_id, role, created_at, revoked_at, created_by_user_id)
      VALUES (
        '21000000-0000-4000-8000-000000000090',
        '20000000-0000-4000-8000-000000000090',
        $1,
        'employee',
        '2026-01-01T00:00:00Z',
        $2,
        NULL
      )
    `, [seededUser, configuration.membership === 'revoked' ? '2026-02-01T00:00:00Z' : null]);
  }
}

async function installFailureTrigger(table: string, eventType: string): Promise<void> {
  await installerPool.query(`
    CREATE OR REPLACE FUNCTION public.c3b_test_fail_after_insert()
    RETURNS trigger LANGUAGE plpgsql AS $failure$
    BEGIN
      IF TG_ARGV[0] = '' OR pg_catalog.to_jsonb(NEW)->>'event_type' = TG_ARGV[0] THEN
        RAISE EXCEPTION 'synthetic C3B rollback failure';
      END IF;
      RETURN NEW;
    END
    $failure$;
    CREATE TRIGGER c3b_test_fail_after_insert
      AFTER INSERT ON ${B3_SCHEMA}.${table}
      FOR EACH ROW EXECUTE FUNCTION public.c3b_test_fail_after_insert('${eventType}');
  `);
}

async function removeFailureTrigger(table?: string): Promise<void> {
  const tables = table === undefined
    ? ['users', 'identity_bindings', 'organizations', 'memberships', 'audit_events', 'bootstrap_receipts']
    : [table];
  for (const current of tables) {
    await installerPool?.query(`DROP TRIGGER IF EXISTS c3b_test_fail_after_insert ON ${B3_SCHEMA}.${current}`);
  }
  await installerPool?.query('DROP FUNCTION IF EXISTS public.c3b_test_fail_after_insert()');
}

async function createJwksServer() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const publicJwk = await exportJWK(publicKey);
  const kid = 'c3b-es256';
  const jwk: JWK = { ...publicJwk, kid, alg: 'ES256', use: 'sig' };
  const server = createServer((request, response) => {
    if (request.url?.endsWith('/.well-known/jwks.json')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const issuer = `http://127.0.0.1:${port}/auth/v1`;
  return {
    server,
    issuer,
    accessToken: (subject: string, email = 'admin@example.invalid') => accessToken(
      privateKey, kid, issuer, subject, email,
    ),
  };
}

async function accessToken(
  privateKey: SigningKey,
  kid: string,
  issuer: string,
  subject: string,
  email: string,
): Promise<string> {
  return new SignJWT({
    role: 'authenticated',
    aal: 'aal1',
    email,
    phone: '',
    is_anonymous: false,
    session_id: '90000000-0000-4000-8000-000000000001',
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid })
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
