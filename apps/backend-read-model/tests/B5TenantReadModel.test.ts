import { createServer, type Server } from 'node:http';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from 'jose';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CustomerId,
  NfcTagId,
  OrganizationId,
  UserId,
  createNfcPayload,
  type NfcPayload,
} from '@taptime/core';
import {
  AccessTokenVerificationInfrastructureError,
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import {
  TenantReadSessionCoordinator,
  type TenantReadRepositories,
} from '../src/index.js';
import {
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  loadMigrations,
  migrate,
} from '../../backend-schema/src/index.js';
import {
  B5_RUNTIME_LOGIN,
  B5_RUNTIME_ROLES,
  b5Ids,
  b5RuntimeConnectionString,
  ensureSyntheticB5RuntimeLogin,
  ids,
  postgresErrorCode,
  resetAndSeedB5,
  subjects,
} from './fixtures.js';

const installerConnectionString = process.env.B5_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b5';
const runtimePassword = process.env.B5_RUNTIME_PASSWORD ?? 'b5-local-synthetic-only';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 4 });
const runtimePool = new Pool({
  connectionString: b5RuntimeConnectionString(installerConnectionString, runtimePassword),
  max: 1,
});

const keyId = 'b5-local-rs256';
const sessionId = '90000000-0000-4000-8000-000000000501';
let signingKey: CryptoKey;
let jwksServer: Server;
let issuer: string;
let verifier: SupabaseJwtAccessTokenVerifier;
let coordinator: TenantReadSessionCoordinator;

interface AccessTokenOptions {
  readonly subject?: string;
  readonly issuer?: string;
  readonly claims?: Readonly<Record<string, unknown>>;
}

async function accessToken(options: AccessTokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({
    aal: 'aal1',
    email: 'synthetic@example.invalid',
    is_anonymous: false,
    phone: '',
    role: 'authenticated',
    session_id: sessionId,
    ...options.claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: keyId, typ: 'JWT' })
    .setIssuer(options.issuer ?? issuer)
    .setAudience('authenticated')
    .setSubject(options.subject ?? subjects.employeeA)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(signingKey);
}

async function runAs<Value>(
  subject: string,
  operation: (repositories: TenantReadRepositories) => Promise<Value>,
  options: {
    readonly requestedOrganizationId?: string;
    readonly claims?: Readonly<Record<string, unknown>>;
  } = {},
) {
  return coordinator.run(
    {
      accessToken: await accessToken({ subject, claims: options.claims }),
      requestedOrganizationId: OrganizationId(
        options.requestedOrganizationId ?? ids.organizationA,
      ),
    },
    operation,
  );
}

async function startJwksServer(jwk: JWK): Promise<{ server: Server; origin: URL }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [{ ...jwk, alg: 'RS256', kid: keyId, use: 'sig' }] }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Synthetic B5 JWKS server did not expose a TCP address');
  }
  return { server, origin: new URL(`http://127.0.0.1:${address.port}`) };
}

async function startUnavailableJwksServer(): Promise<{ server: Server; origin: URL }> {
  const server = createServer((_request, response) => {
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end('{}');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Unavailable synthetic B5 JWKS server did not expose a TCP address');
  }
  return { server, origin: new URL(`http://127.0.0.1:${address.port}`) };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

async function pooledConnectionState() {
  const result = await runtimePool.query<{
    current_user: string;
    session_user: string;
    current_role: string;
    user_context: string;
    organization_context: string;
    membership_context: string;
    membership_role_context: string;
  }>(
    `SELECT
       current_user,
       session_user,
       current_role,
       COALESCE(NULLIF(current_setting('app.user_id', true), ''), '<unset>') AS user_context,
       COALESCE(NULLIF(current_setting('app.organization_id', true), ''), '<unset>')
         AS organization_context,
       COALESCE(NULLIF(current_setting('app.membership_id', true), ''), '<unset>')
         AS membership_context,
       COALESCE(NULLIF(current_setting('app.membership_role', true), ''), '<unset>')
         AS membership_role_context`,
  );
  return result.rows[0];
}

function expectCleanPooledConnection(state: Awaited<ReturnType<typeof pooledConnectionState>>) {
  expect(state).toEqual({
    current_user: B5_RUNTIME_LOGIN,
    session_user: B5_RUNTIME_LOGIN,
    current_role: B5_RUNTIME_LOGIN,
    user_context: '<unset>',
    organization_context: '<unset>',
    membership_context: '<unset>',
    membership_role_context: '<unset>',
  });
}

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256');
  signingKey = keyPair.privateKey;
  const jwksInfrastructure = await startJwksServer(await exportJWK(keyPair.publicKey));
  jwksServer = jwksInfrastructure.server;
  issuer = new URL('/synthetic-b5/auth/v1', jwksInfrastructure.origin).href;

  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(installerPool);
  await ensureSyntheticB5RuntimeLogin(installerPool, runtimePassword);

  verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer,
    jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
    allowedAlgorithms: ['RS256'],
  });
  coordinator = new TenantReadSessionCoordinator(runtimePool, verifier);
}, 30_000);

beforeEach(async () => {
  await resetAndSeedB5(installerPool, issuer);
});

afterAll(async () => {
  await runtimePool.end();
  await installerPool.end();
  await closeServer(jwksServer);
});

describe('B5 versioned-schema and least-privilege runtime boundary', () => {
  it('uses the current migrations 001 through 007 without a B5-owned migration', async () => {
    const migrations = await loadMigrations();
    expect(migrations.map(({ version }) => version)).toEqual(['001', '002', '003', '004', '005', '006', '007']);

    const ledger = await installerPool.query<{ version: string }>(
      `SELECT version FROM ${B3_MIGRATION_TABLE} ORDER BY version`,
    );
    expect(ledger.rows.map(({ version }) => version)).toEqual(['001', '002', '003', '004', '005', '006', '007']);
    expect(await migrate(installerPool)).toEqual({
      applied: [],
      alreadyApplied: ['001', '002', '003', '004', '005', '006', '007'],
    });
  });

  it('uses a non-owner NOINHERIT runtime login with exactly three fixed parent roles', async () => {
    const role = await installerPool.query<{
      rolname: string;
      rolsuper: boolean;
      rolinherit: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolcanlogin: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      parent_roles: string[];
    }>(
      `SELECT
         runtime.rolname,
         runtime.rolsuper,
         runtime.rolinherit,
         runtime.rolcreaterole,
         runtime.rolcreatedb,
         runtime.rolcanlogin,
         runtime.rolreplication,
         runtime.rolbypassrls,
         ARRAY(
           SELECT parent.rolname::text
           FROM pg_catalog.pg_auth_members AS membership
           JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
           WHERE membership.member = runtime.oid
           ORDER BY parent.rolname
         )::text[] AS parent_roles
       FROM pg_catalog.pg_roles AS runtime
       WHERE runtime.rolname = $1`,
      [B5_RUNTIME_LOGIN],
    );
    expect(role.rows).toEqual([{
      rolname: B5_RUNTIME_LOGIN,
      rolsuper: false,
      rolinherit: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolcanlogin: true,
      rolreplication: false,
      rolbypassrls: false,
      parent_roles: [...B5_RUNTIME_ROLES],
    }]);

    const ownership = await installerPool.query<{ owned: string }>(
      `SELECT count(*)::text AS owned
       FROM pg_catalog.pg_class AS relation
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       JOIN pg_catalog.pg_roles AS owner_role ON owner_role.oid = relation.relowner
       WHERE namespace.nspname = $1 AND owner_role.rolname = $2`,
      [B3_SCHEMA, B5_RUNTIME_LOGIN],
    );
    expect(ownership.rows[0]?.owned).toBe('0');
  });

  it.each([
    'users',
    'identity_bindings',
    'organizations',
    'memberships',
    'customers',
    'nfc_tags',
    'nfc_assignments',
    'work_events',
    'time_entries',
    'canonical_decisions',
    'sync_receipts',
    'audit_events',
  ])('cannot read %s before selecting an application role', async (table) => {
    expect(await postgresErrorCode(runtimePool.query(
      `SELECT * FROM ${B3_SCHEMA}.${table} LIMIT 1`,
    ))).toBe('42501');
  });

  it('cannot access tables after RESET ROLE', async () => {
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE taptime_employee');
      await client.query('RESET ROLE');
      expect(await postgresErrorCode(client.query(
        `SELECT * FROM ${B3_SCHEMA}.organizations LIMIT 1`,
      ))).toBe('42501');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('cannot select the lifecycle role or perform DDL', async () => {
    expect(await postgresErrorCode(runtimePool.query(
      'SET ROLE taptime_server_lifecycle',
    ))).toBe('42501');
    expect(await postgresErrorCode(runtimePool.query(
      'CREATE SCHEMA taptime_b5_forbidden',
    ))).toBe('42501');
    expect(await postgresErrorCode(runtimePool.query(
      `ALTER TABLE ${B3_SCHEMA}.organizations DISABLE ROW LEVEL SECURITY`,
    ))).toBe('42501');
  });
});

describe('tenant-scoped read-only repository adapters', () => {
  it('maps the Employee Organization, own active Membership, Customer, Tag and Assignment', async () => {
    const result = await runAs(subjects.employeeA, async (repositories) => ({
      organization: await repositories.organization.findById(OrganizationId(ids.organizationA)),
      membership: await repositories.membership.findByUserId(UserId(ids.employeeA)),
      customer: await repositories.customer.findById(CustomerId(ids.customerA)),
      tag: await repositories.nfcTag.findByPayload(
        createNfcPayload('shared-synthetic-payload'),
      ),
      assignment: await repositories.nfcAssignment.findActiveByTagId(NfcTagId(ids.tagA)),
    }));

    expect(result).toEqual({
      status: 'accepted',
      value: {
        organization: { id: ids.organizationA, name: 'Synthetic A' },
        membership: {
          id: '12000000-0000-4000-8000-000000000002',
          organizationId: ids.organizationA,
          userId: ids.employeeA,
          role: 'employee',
        },
        customer: {
          id: ids.customerA,
          organizationId: ids.organizationA,
          displayName: 'Synthetic Customer A',
          active: true,
        },
        tag: {
          id: ids.tagA,
          organizationId: ids.organizationA,
          displayName: 'Synthetic Tag A',
          payload: 'shared-synthetic-payload',
        },
        assignment: {
          id: ids.assignmentA,
          organizationId: ids.organizationA,
          nfcTagId: ids.tagA,
          target: { targetType: 'customer', targetId: ids.customerA },
          active: true,
        },
      },
    });
  });

  it('lets an Administrator read current Organization configuration and active Memberships', async () => {
    const result = await runAs(subjects.administratorA, async (repositories) => ({
      organization: await repositories.organization.findById(OrganizationId(ids.organizationA)),
      ownMembership: await repositories.membership.findByUserId(UserId(ids.adminA)),
      employeeMembership: await repositories.membership.findByUserId(UserId(ids.employeeA)),
      inactiveCustomer: await repositories.customer.findById(
        CustomerId(b5Ids.inactiveCustomerA),
      ),
      inactiveAssignment: await repositories.nfcAssignment.findActiveByTagId(
        NfcTagId(b5Ids.inactiveTagA),
      ),
    }));

    expect(result).toMatchObject({
      status: 'accepted',
      value: {
        organization: { id: ids.organizationA, name: 'Synthetic A' },
        ownMembership: { userId: ids.adminA, role: 'administrator' },
        employeeMembership: { userId: ids.employeeA, role: 'employee' },
        inactiveCustomer: {
          id: b5Ids.inactiveCustomerA,
          organizationId: ids.organizationA,
          active: false,
        },
        inactiveAssignment: null,
      },
    });
  });

  it('does not let an Employee read another Membership in the same Organization', async () => {
    expect(await runAs(subjects.employeeA, (repositories) =>
      repositories.membership.findByUserId(UserId(ids.employeeA2))
    )).toEqual({ status: 'accepted', value: null });
  });

  it('returns null for guessed Tenant B Organization, User, Customer, payload and Tag identifiers', async () => {
    const result = await runAs(subjects.employeeA, async (repositories) => ({
      organization: await repositories.organization.findById(OrganizationId(ids.organizationB)),
      membership: await repositories.membership.findByUserId(UserId(ids.employeeB)),
      customer: await repositories.customer.findById(CustomerId(ids.customerB)),
      tag: await repositories.nfcTag.findByPayload(createNfcPayload('tenant-b-only-payload')),
      assignment: await repositories.nfcAssignment.findActiveByTagId(NfcTagId(ids.tagB)),
    }));
    expect(result).toEqual({
      status: 'accepted',
      value: {
        organization: null,
        membership: null,
        customer: null,
        tag: null,
        assignment: null,
      },
    });
  });

  it('resolves an equal cross-tenant payload only to the current Organization row', async () => {
    const result = await runAs(subjects.employeeA, (repositories) =>
      repositories.nfcTag.findByPayload(createNfcPayload('shared-synthetic-payload'))
    );
    expect(result).toEqual({
      status: 'accepted',
      value: {
        id: ids.tagA,
        organizationId: ids.organizationA,
        displayName: 'Synthetic Tag A',
        payload: 'shared-synthetic-payload',
      },
    });
  });

  it('does not cross the tenant boundary for a similar Tenant B payload', async () => {
    expect(await runAs(subjects.employeeA, (repositories) =>
      repositories.nfcTag.findByPayload(createNfcPayload('shared-synthetic-payload-near'))
    )).toEqual({ status: 'accepted', value: null });
  });

  it('treats SQL-injection-shaped NFC payload input only as a parameter value', async () => {
    const payload = createNfcPayload("shared-synthetic-payload' OR true; DROP TABLE taptime_server.nfc_tags; --");
    expect(await runAs(subjects.employeeA, (repositories) =>
      repositories.nfcTag.findByPayload(payload)
    )).toEqual({ status: 'accepted', value: null });

    const count = await installerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${B3_SCHEMA}.nfc_tags`,
    );
    expect(Number(count.rows[0]?.count)).toBeGreaterThan(0);
  });

  it('exposes exactly five frozen read-only surfaces and no raw or write capability', async () => {
    const result = await runAs(subjects.employeeA, async (repositories) => {
      expect(Object.isFrozen(repositories)).toBe(true);
      expect(Object.keys(repositories).sort()).toEqual([
        'customer',
        'membership',
        'nfcAssignment',
        'nfcTag',
        'organization',
      ]);
      const expectedMethods = {
        organization: ['findById'],
        membership: ['findByUserId'],
        customer: ['findById'],
        nfcTag: ['findByPayload'],
        nfcAssignment: ['findActiveByTagId'],
      } as const;
      for (const [name, methods] of Object.entries(expectedMethods)) {
        const repository = repositories[name as keyof TenantReadRepositories];
        expect(Object.isFrozen(repository)).toBe(true);
        expect(Object.keys(repository)).toEqual(methods);
        for (const forbidden of ['save', 'register', 'update', 'delete', 'list', 'query', 'pool', 'client', 'role']) {
          expect(forbidden in repository).toBe(false);
        }
      }
      expect('query' in repositories).toBe(false);
      expect('client' in repositories).toBe(false);
      expect('actor' in repositories).toBe(false);
      expect('role' in repositories).toBe(false);
      return 'surface-verified';
    });
    expect(result).toEqual({ status: 'accepted', value: 'surface-verified' });
  });
});

describe('authoritative token, Membership, Organization and role binding', () => {
  it('rejects a requested foreign Organization before the callback can read', async () => {
    let callbackCalled = false;
    const result = await runAs(
      subjects.employeeA,
      async () => {
        callbackCalled = true;
        return 'must-not-run';
      },
      { requestedOrganizationId: ids.organizationB },
    );
    expect(result).toEqual({ status: 'rejected', reason: 'requested_organization_mismatch' });
    expect(callbackCalled).toBe(false);
  });

  it('ignores forged User, Organization, tenant and Administrator claims', async () => {
    const result = await runAs(
      subjects.employeeA,
      async (repositories) => ({
        own: await repositories.membership.findByUserId(UserId(ids.employeeA)),
        otherEmployee: await repositories.membership.findByUserId(UserId(ids.employeeA2)),
        tenantB: await repositories.customer.findById(CustomerId(ids.customerB)),
      }),
      {
        claims: {
          user_id: ids.adminA,
          organization_id: ids.organizationB,
          tenant_id: ids.organizationB,
          membership_role: 'administrator',
          app_metadata: {
            user_id: ids.adminA,
            organization_id: ids.organizationB,
            role: 'administrator',
          },
        },
      },
    );
    expect(result).toMatchObject({
      status: 'accepted',
      value: {
        own: { userId: ids.employeeA, organizationId: ids.organizationA, role: 'employee' },
        otherEmployee: null,
        tenantB: null,
      },
    });
  });

  it('uses the current database Administrator role despite a stale Employee token claim', async () => {
    const result = await runAs(
      subjects.administratorA,
      (repositories) => repositories.membership.findByUserId(UserId(ids.employeeA)),
      { claims: { membership_role: 'employee' } },
    );
    expect(result).toMatchObject({
      status: 'accepted',
      value: { userId: ids.employeeA, role: 'employee' },
    });
  });

  it('returns a typed access-token rejection without entering the callback', async () => {
    let callbackCalled = false;
    const result = await coordinator.run(
      {
        accessToken: 'not-a-jwt',
        requestedOrganizationId: OrganizationId(ids.organizationA),
      },
      async () => {
        callbackCalled = true;
        return 'must-not-run';
      },
    );
    expect(result).toEqual({
      status: 'rejected',
      reason: 'access_token_rejected',
      tokenReason: 'malformed_token',
    });
    expect(callbackCalled).toBe(false);
  });

  it('propagates JWKS infrastructure failure without entering the tenant callback', async () => {
    const unavailable = await startUnavailableJwksServer();
    const unavailableIssuer = new URL('/unavailable-b5/auth/v1', unavailable.origin).href;
    const unavailableVerifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer: unavailableIssuer,
      jwksUrl: new URL(`${unavailableIssuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    });
    const unavailableCoordinator = new TenantReadSessionCoordinator(
      runtimePool,
      unavailableVerifier,
    );
    let callbackCalled = false;
    try {
      await expect(unavailableCoordinator.run(
        {
          accessToken: await accessToken({ issuer: unavailableIssuer }),
          requestedOrganizationId: OrganizationId(ids.organizationA),
        },
        async () => {
          callbackCalled = true;
          return 'must-not-run';
        },
      )).rejects.toBeInstanceOf(AccessTokenVerificationInfrastructureError);
      expect(callbackCalled).toBe(false);
    } finally {
      await closeServer(unavailable.server);
    }
  });

  it('returns one generic rejection for an unknown IdentityBinding', async () => {
    let callbackCalled = false;
    const result = await runAs(subjects.unknown, async () => {
      callbackCalled = true;
      return 'must-not-run';
    });
    expect(result).toEqual({
      status: 'rejected',
      reason: 'identity_or_membership_unavailable',
    });
    expect(callbackCalled).toBe(false);
  });

  it('returns the same generic rejection for a revoked IdentityBinding', async () => {
    await installerPool.query(
      `UPDATE ${B3_SCHEMA}.identity_bindings
       SET revoked_at = transaction_timestamp()
       WHERE issuer = $1 AND subject = $2`,
      [issuer, subjects.employeeA],
    );
    expect(await runAs(subjects.employeeA, async () => 'must-not-run')).toEqual({
      status: 'rejected',
      reason: 'identity_or_membership_unavailable',
    });
  });

  it('returns the same generic rejection for a revoked Membership', async () => {
    await installerPool.query(
      `UPDATE ${B3_SCHEMA}.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1
       WHERE user_id = $1`,
      [ids.employeeA],
    );
    expect(await runAs(subjects.employeeA, async () => 'must-not-run')).toEqual({
      status: 'rejected',
      reason: 'identity_or_membership_unavailable',
    });
  });

  it('denies Administrator-only reads after a concurrent Membership downgrade', async () => {
    const entered = deferred();
    const resume = deferred();
    const resultPromise = runAs(subjects.administratorA, async (repositories) => {
      entered.resolve();
      await resume.promise;
      return repositories.membership.findByUserId(UserId(ids.employeeA));
    });

    await entered.promise;
    try {
      await installerPool.query(
        `UPDATE ${B3_SCHEMA}.memberships
         SET role = 'employee', row_version = row_version + 1
         WHERE user_id = $1`,
        [ids.adminA],
      );
    } finally {
      resume.resolve();
    }
    expect(await resultPromise).toEqual({ status: 'accepted', value: null });
  });

  it('denies configuration reads after a concurrent Membership revocation', async () => {
    const entered = deferred();
    const resume = deferred();
    const resultPromise = runAs(subjects.employeeA, async (repositories) => {
      entered.resolve();
      await resume.promise;
      return repositories.customer.findById(CustomerId(ids.customerA));
    });

    await entered.promise;
    try {
      await installerPool.query(
        `UPDATE ${B3_SCHEMA}.memberships
         SET revoked_at = transaction_timestamp(), row_version = row_version + 1
         WHERE user_id = $1`,
        [ids.employeeA],
      );
    } finally {
      resume.resolve();
    }
    expect(await resultPromise).toEqual({ status: 'accepted', value: null });
  });
});

describe('transaction cleanup, error truth and read-only lifecycle boundary', () => {
  it('cleans ROLE and all actor GUCs after a successful commit', async () => {
    expect((await runAs(subjects.employeeA, (repositories) =>
      repositories.organization.findById(OrganizationId(ids.organizationA))
    )).status).toBe('accepted');
    expectCleanPooledConnection(await pooledConnectionState());
  });

  it('keeps the pooled connection clean after token rejection', async () => {
    await coordinator.run(
      { accessToken: 'malformed', requestedOrganizationId: OrganizationId(ids.organizationA) },
      async () => 'must-not-run',
    );
    expectCleanPooledConnection(await pooledConnectionState());
  });

  it('cleans ROLE and all actor GUCs after a database authorization rejection', async () => {
    await runAs(subjects.unknown, async () => 'must-not-run');
    expectCleanPooledConnection(await pooledConnectionState());
  });

  it('rolls back callback errors, rethrows them and cleans the pooled connection', async () => {
    await expect(runAs(subjects.employeeA, async () => {
      throw new Error('synthetic B5 callback failure');
    })).rejects.toThrow('synthetic B5 callback failure');
    expectCleanPooledConnection(await pooledConnectionState());
  });

  it('expires escaped repository capabilities after commit', async () => {
    let escapedRepositories: TenantReadRepositories | undefined;
    expect(await runAs(subjects.employeeA, async (repositories) => {
      escapedRepositories = repositories;
      return 'completed';
    })).toEqual({ status: 'accepted', value: 'completed' });

    await expect(escapedRepositories!.organization.findById(
      OrganizationId(ids.organizationA),
    )).rejects.toThrow('Tenant read repositories are no longer active');
    expectCleanPooledConnection(await pooledConnectionState());
  });

  it('expires escaped repository capabilities after callback rollback', async () => {
    let escapedRepositories: TenantReadRepositories | undefined;
    await expect(runAs(subjects.employeeA, async (repositories) => {
      escapedRepositories = repositories;
      throw new Error('synthetic B5 capability rollback');
    })).rejects.toThrow('synthetic B5 capability rollback');

    await expect(escapedRepositories!.customer.findById(
      CustomerId(ids.customerA),
    )).rejects.toThrow('Tenant read repositories are no longer active');
    expectCleanPooledConnection(await pooledConnectionState());
  });

  it('throws a PostgreSQL infrastructure failure instead of converting it to authorization', async () => {
    const unreachablePool = new Pool({
      connectionString: 'postgresql://synthetic:synthetic@127.0.0.1:1/taptime_b5',
      connectionTimeoutMillis: 250,
      max: 1,
    });
    const unreachableCoordinator = new TenantReadSessionCoordinator(unreachablePool, verifier);
    try {
      await expect(unreachableCoordinator.run(
        {
          accessToken: await accessToken(),
          requestedOrganizationId: OrganizationId(ids.organizationA),
        },
        async () => 'must-not-run',
      )).rejects.toThrow();
    } finally {
      await unreachablePool.end();
    }
  });

  it('does not write WorkEvents, Decisions, TimeEntries, Receipts or AuditEvents', async () => {
    const counts = async () => {
      const result = await installerPool.query<{
        work_events: string;
        canonical_decisions: string;
        time_entries: string;
        sync_receipts: string;
        audit_events: string;
      }>(
        `SELECT
           (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events) AS work_events,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.canonical_decisions) AS canonical_decisions,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries) AS time_entries,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.sync_receipts) AS sync_receipts,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events) AS audit_events`,
      );
      return result.rows[0];
    };
    const before = await counts();
    await runAs(subjects.employeeA, async (repositories) => {
      await repositories.organization.findById(OrganizationId(ids.organizationA));
      await repositories.membership.findByUserId(UserId(ids.employeeA));
      await repositories.customer.findById(CustomerId(ids.customerA));
      await repositories.nfcTag.findByPayload(createNfcPayload('shared-synthetic-payload'));
      await repositories.nfcAssignment.findActiveByTagId(NfcTagId(ids.tagA));
    });
    expect(await counts()).toEqual(before);
  });
});

// Compile-time guard: the NFC reader accepts the existing Core value object, not an untyped string.
const _nfcPayloadContract: NfcPayload = createNfcPayload('compile-time-b5-contract');
void _nfcPayloadContract;
