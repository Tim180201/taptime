import { createServer, request as httpRequest, type IncomingHttpHeaders, type Server } from 'node:http';
import { generateSecret, SignJWT } from 'jose';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  B4_IDENTITY_RESOLVER_ROLE,
  PostgresIdentityMembershipResolver,
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import { B3_MIGRATION_TABLE, B3_SCHEMA, loadMigrations, migrate } from '@taptime/backend-schema';
import { B4SessionAuthorityResolver } from '../src/B4SessionAuthorityResolver.js';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import { createBackendApiRuntime, type BackendApiRuntime } from '../src/runtime.js';
import type { SessionApiDiagnostic, SessionAuthorityResolver } from '../src/types.js';
import {
  C2_SESSION_RUNTIME_LOGIN,
  accessToken,
  c1Ids,
  closeServer,
  listen,
  postgresErrorCode,
  resetAndSeedC1,
  resetMigrateAndPrepareLogin,
  runtimeConnectionString,
  startSyntheticJwks,
  type SyntheticJwksInfrastructure,
} from './fixtures.js';

const installerConnectionString = process.env.C2_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c2';
const runtimePassword = process.env.C2_SESSION_RUNTIME_PASSWORD ?? 'c2-session-local-synthetic-only';
const configuredRuntimeConnectionString = process.env.C2_SESSION_DATABASE_URL
  ?? runtimeConnectionString(installerConnectionString, runtimePassword);
const configuredReadModelConnectionString = process.env.C2_READ_MODEL_DATABASE_URL
  ?? connectionStringFor(
    installerConnectionString,
    'taptime_c2_read_model_runtime',
    process.env.C2_READ_MODEL_RUNTIME_PASSWORD ?? 'c2-read-local-synthetic-only',
  );
const configuredLifecycleConnectionString = process.env.C2_LIFECYCLE_DATABASE_URL
  ?? connectionStringFor(
    installerConnectionString,
    'taptime_c2_lifecycle_runtime',
    process.env.C2_LIFECYCLE_RUNTIME_PASSWORD ?? 'c2-lifecycle-local-synthetic-only',
  );
const configuredAdministrationConnectionString = process.env.C2_ADMINISTRATION_DATABASE_URL
  ?? connectionStringFor(
    installerConnectionString,
    'taptime_c2_administration_runtime',
    process.env.C2_ADMINISTRATION_RUNTIME_PASSWORD ?? 'c2-administration-local-synthetic-only',
  );
const configuredEmployeeInvitationConnectionString = connectionStringFor(
  installerConnectionString,
  'taptime_c3e1_invitation_runtime',
  'c3e1-invitation-local-synthetic-only',
);
const configuredEmployeeEnrollmentConnectionString = connectionStringFor(
  installerConnectionString,
  'taptime_c3e1_enrollment_runtime',
  'c3e1-enrollment-local-synthetic-only',
);
const configuredReassignmentConnectionString = connectionStringFor(
  installerConnectionString,
  'taptime_c3e2_reassignment_runtime',
  'c3e2-reassignment-local-synthetic-only',
);
const installerPool = new Pool({ connectionString: installerConnectionString, max: 4 });
const resolverPool = new Pool({ connectionString: configuredRuntimeConnectionString, max: 1 });

interface HttpResult {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly text: string;
}

let jwks: SyntheticJwksInfrastructure;
let runtime: BackendApiRuntime;
let apiOrigin: string;
let verifier: SupabaseJwtAccessTokenVerifier;
let resolver: PostgresIdentityMembershipResolver;
const diagnostics: SessionApiDiagnostic[] = [];

beforeAll(async () => {
  const runtimeUrl = new URL(configuredRuntimeConnectionString);
  if (decodeURIComponent(runtimeUrl.username) !== C2_SESSION_RUNTIME_LOGIN) {
    throw new Error(
      `C2_SESSION_DATABASE_URL must use the synthetic ${C2_SESSION_RUNTIME_LOGIN} login`,
    );
  }
  jwks = await startSyntheticJwks();
  await resetMigrateAndPrepareLogin(installerPool, runtimePassword);
  await resetAndSeedC1(installerPool, jwks);
  verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer: jwks.issuerA,
    jwksUrl: new URL(`${jwks.issuerA}/.well-known/jwks.json`),
    allowedAlgorithms: ['RS256'],
  });
  resolver = new PostgresIdentityMembershipResolver(resolverPool);
  runtime = createBackendApiRuntime({
    sessionDatabaseUrl: configuredRuntimeConnectionString,
    readModelDatabaseUrl: configuredReadModelConnectionString,
    lifecycleDatabaseUrl: configuredLifecycleConnectionString,
    administrationDatabaseUrl: configuredAdministrationConnectionString,
    employeeInvitationDatabaseUrl: configuredEmployeeInvitationConnectionString,
    employeeEnrollmentDatabaseUrl: configuredEmployeeEnrollmentConnectionString,
    reassignmentDatabaseUrl: configuredReassignmentConnectionString,
    supabaseIssuer: jwks.issuerA,
  }, {
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  await listen(runtime.server);
  apiOrigin = serverOrigin(runtime.server);
}, 30_000);

beforeEach(async () => {
  diagnostics.length = 0;
  await resetAndSeedC1(installerPool, jwks);
});

afterAll(async () => {
  await runtime?.close();
  await resolverPool.end();
  await installerPool.end();
  await closeServer(jwks?.server);
});

describe('versioned C1 foundation', () => {
  it('uses exactly migrations 001 through 009 and reruns the ledger cleanly', async () => {
    const migrations = await loadMigrations();
    expect(migrations.map(({ version }) => version)).toEqual(['001', '002', '003', '004', '005', '006', '007', '008', '009']);
    const ledger = await installerPool.query<{ version: string; checksum: string }>(
      `SELECT version, checksum FROM ${B3_MIGRATION_TABLE} ORDER BY version`,
    );
    expect(ledger.rows.map(({ version }) => version)).toEqual(['001', '002', '003', '004', '005', '006', '007', '008', '009']);
    expect(ledger.rows.every(({ checksum }) => /^[0-9a-f]{64}$/.test(checksum))).toBe(true);
    await expect(migrate(installerPool)).resolves.toEqual({
      applied: [], alreadyApplied: ['001', '002', '003', '004', '005', '006', '007', '008', '009'],
    });
  });
});

describe('server-authoritative GET /v1/session', () => {
  it('returns exactly the active employee session from PostgreSQL provenance', async () => {
    const response = await sessionRequest(await accessToken(jwks));
    expectSuccess(response, {
      userId: c1Ids.employeeA,
      membershipId: c1Ids.employeeAMembership,
      organizationId: c1Ids.organizationA,
      role: 'employee',
    });
  });

  it('returns the current database administrator role rather than token role claims', async () => {
    const response = await sessionRequest(await accessToken(jwks, {
      subject: c1Ids.administratorSubject,
      claims: { role: 'authenticated', membership_role: 'employee' },
    }));
    expectSuccess(response, {
      userId: c1Ids.administratorA,
      membershipId: c1Ids.administratorAMembership,
      organizationId: c1Ids.organizationA,
      role: 'administrator',
    });
  });

  it('ignores forged User, Membership, Organization, tenant and role claims', async () => {
    const token = await accessToken(jwks, { claims: {
      user_id: c1Ids.employeeB,
      membership_id: c1Ids.employeeBMembership,
      organization_id: c1Ids.organizationB,
      tenant_id: c1Ids.organizationB,
      membership_role: 'administrator',
      app_metadata: {
        user_id: c1Ids.employeeB,
        organization_id: c1Ids.organizationB,
        role: 'administrator',
      },
    } });
    const response = await sessionRequest(token);
    expectSuccess(response, {
      userId: c1Ids.employeeA,
      membershipId: c1Ids.employeeAMembership,
      organizationId: c1Ids.organizationA,
      role: 'employee',
    });
  });

  it('keeps an identical subject under another issuer as a separate rejected identity', async () => {
    const response = await sessionRequest(await accessToken(jwks, { issuer: jwks.issuerB }));
    expectGenericError(response, 401, 'unauthorized');
    expect(response.text).not.toContain(c1Ids.employeeB);
    expect(response.text).not.toContain(c1Ids.organizationB);
  });

  it('resolves the same subject under the separately configured issuer only to Tenant B', async () => {
    const issuerBVerifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer: jwks.issuerB,
      jwksUrl: new URL(`${jwks.issuerB}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    });
    const authority = new B4SessionAuthorityResolver(issuerBVerifier, resolver);
    await expect(authority.resolve(await accessToken(jwks, { issuer: jwks.issuerB }))).resolves.toEqual({
      status: 'resolved',
      session: {
        userId: c1Ids.employeeB,
        membershipId: c1Ids.employeeBMembership,
        organizationId: c1Ids.organizationB,
        role: 'employee',
      },
    });
  });

  it.each([
    ['unknown IdentityBinding', c1Ids.unknownSubject],
    ['revoked IdentityBinding', c1Ids.revokedBindingSubject],
    ['missing Membership', c1Ids.missingMembershipSubject],
    ['revoked Membership', c1Ids.revokedMembershipSubject],
  ])('maps %s to the same disclosure-safe rejection', async (_case, subject) => {
    const response = await sessionRequest(await accessToken(jwks, { subject }));
    expectGenericError(response, 401, 'unauthorized');
    expect(response.text).not.toContain(subject);
  });

  it('ends authority immediately after Membership revocation', async () => {
    expect((await sessionRequest(await accessToken(jwks))).status).toBe(200);
    await installerPool.query(
      `UPDATE ${B3_SCHEMA}.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [c1Ids.employeeAMembership],
    );
    expectGenericError(await sessionRequest(await accessToken(jwks)), 401, 'unauthorized');
  });

  it('maps invalid, expired, wrong-audience, wrong-issuer, future and forged tokens identically', async () => {
    const now = Math.floor(Date.now() / 1_000);
    const tokens = [
      'abc.def.ghi',
      await accessToken(jwks, { expiresAt: now - 1 }),
      await accessToken(jwks, { audience: 'anon' }),
      await accessToken(jwks, { issuer: jwks.issuerB }),
      await accessToken(jwks, { notBefore: now + 300 }),
      await accessToken(jwks, { key: jwks.otherSigningKey }),
    ];
    const responses = await Promise.all(tokens.map(sessionRequest));
    for (const response of responses) {
      expectGenericError(response, 401, 'unauthorized');
      expect(response.text).not.toContain('issuer');
      expect(response.text).not.toContain('signature');
      expect(response.text).not.toContain('token');
    }
  });

  it('rejects symmetric algorithm confusion with the generic authority response', async () => {
    const secret = await generateSecret('HS256');
    const token = await new SignJWT({
      role: 'authenticated', is_anonymous: false, session_id: 'synthetic',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(jwks.issuerA)
      .setAudience('authenticated')
      .setSubject(c1Ids.sharedSubject)
      .setExpirationTime('5m')
      .sign(secret);
    expectGenericError(await sessionRequest(token), 401, 'unauthorized');
  });

  it('performs no table writes for accepted or rejected session resolution', async () => {
    const before = await tableCounts();
    await sessionRequest(await accessToken(jwks));
    await sessionRequest(await accessToken(jwks, { subject: c1Ids.unknownSubject }));
    expect(await tableCounts()).toEqual(before);
  });
});

describe('strict HTTP transport boundary', () => {
  it.each([
    ['POST'], ['PUT'], ['PATCH'], ['DELETE'], ['OPTIONS'],
  ])('rejects method %s and advertises only GET', async (method) => {
    const response = await rawRequest(apiOrigin, { method, path: '/v1/session' });
    expectGenericError(response, 405, 'method_not_allowed');
    expect(response.headers.allow).toBe('GET');
  });

  it.each(['/v1/session/', '/v1/session?organization=forged', '/V1/session', '/v1/sessions'])
    ('rejects non-exact route %s', async (path) => {
      expectGenericError(await rawRequest(apiOrigin, { method: 'GET', path }), 404, 'not_found');
    });

  it.each([
    ['missing', undefined],
    ['Basic', 'Basic YTpi'],
    ['empty Bearer', 'Bearer '],
    ['whitespace', 'Bearer abc.def.ghi trailing'],
    ['comma-combined', 'Bearer abc.def.ghi, Bearer abc.def.ghi'],
    ['malformed compact JWT', 'Bearer only-two.parts'],
  ])('rejects a %s authorization header before authority resolution', async (_case, authorization) => {
    const headers = authorization === undefined ? undefined : { authorization };
    expectGenericError(await rawRequest(apiOrigin, { method: 'GET', path: '/v1/session', headers }), 401, 'unauthorized');
  });

  it('rejects duplicate Authorization fields', async () => {
    const token = await accessToken(jwks);
    const response = await rawRequest(apiOrigin, {
      method: 'GET',
      path: '/v1/session',
      rawHeaders: ['Authorization', `Bearer ${token}`, 'Authorization', `Bearer ${token}`],
    });
    expectGenericError(response, 401, 'unauthorized');
  });

  it('rejects an authorization field over its explicit bound', async () => {
    const oversized = `Bearer ${'a'.repeat(4_100)}.b.c`;
    expectGenericError(await rawRequest(apiOrigin, {
      method: 'GET', path: '/v1/session', headers: { authorization: oversized },
    }), 401, 'unauthorized');
  });

  it('rejects declared and chunked GET request bodies', async () => {
    const token = await accessToken(jwks);
    const declared = await rawRequest(apiOrigin, {
      method: 'GET',
      path: '/v1/session',
      headers: { authorization: `Bearer ${token}`, 'content-length': '2' },
      body: '{}',
    });
    expectGenericError(declared, 400, 'invalid_request');

    const chunked = await rawRequest(apiOrigin, {
      method: 'GET',
      path: '/v1/session',
      headers: { authorization: `Bearer ${token}`, 'transfer-encoding': 'chunked' },
      body: '{}',
    });
    expectGenericError(chunked, 400, 'invalid_request');
  });

  it('rejects aggregate request headers above the server byte boundary', async () => {
    const response = await rawRequest(apiOrigin, {
      method: 'GET',
      path: '/v1/session',
      headers: { 'x-synthetic-oversized': 'x'.repeat(9_000) },
    });
    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(JSON.parse(response.text)).toEqual({ error: { code: 'invalid_request' } });
  });

  it('never invokes authority for invalid route, method, body, or Bearer input', async () => {
    const resolve = vi.fn<SessionAuthorityResolver['resolve']>(async () => ({ status: 'rejected' }));
    const authority: SessionAuthorityResolver = { resolve };
    const server = createSessionRegressionServer(authority);
    await listen(server);
    const origin = serverOrigin(server);
    try {
      await rawRequest(origin, { method: 'POST', path: '/v1/session' });
      await rawRequest(origin, { method: 'GET', path: '/v1/session?x=1' });
      await rawRequest(origin, { method: 'GET', path: '/v1/session' });
      await rawRequest(origin, {
        method: 'GET', path: '/v1/session', headers: { 'content-length': '2' }, body: '{}',
      });
      expect(resolve).not.toHaveBeenCalled();
    } finally {
      await closeServer(server);
    }
  });

  it('sets disclosure-safe JSON, no-store, nosniff and a server request ID', async () => {
    const response = await sessionRequest(await accessToken(jwks));
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe('generic infrastructure handling', () => {
  it('maps unavailable local JWKS infrastructure to a generic 503', async () => {
    const unavailableJwks = createServer((_request, response) => {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end('{}');
    });
    await listen(unavailableJwks);
    const address = unavailableJwks.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Port reservation failed');
    }
    const issuer = `http://127.0.0.1:${address.port}/unavailable/auth/v1`;
    const unavailableVerifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer,
      jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    });
    const authority = new B4SessionAuthorityResolver(unavailableVerifier, resolver);
    const server = createSessionRegressionServer(authority);
    await listen(server);
    try {
      const token = await accessToken(jwks, { issuer });
      await expect(unavailableVerifier.verify(token)).rejects.toThrow(
        'Access-token verification infrastructure is unavailable',
      );
      expectGenericError(await rawRequest(serverOrigin(server), {
        method: 'GET', path: '/v1/session', headers: { authorization: `Bearer ${token}` },
      }), 503, 'service_unavailable');
    } finally {
      await closeServer(server);
      await closeServer(unavailableJwks);
    }
  });

  it('maps PostgreSQL failure to the same generic 503 and emits only safe diagnostics', async () => {
    const safeDiagnostics: SessionApiDiagnostic[] = [];
    const failingAuthority = new B4SessionAuthorityResolver(verifier, {
      resolve: async () => { throw new Error('postgresql://user:secret@database.internal'); },
    });
    const server = createSessionRegressionServer(failingAuthority, {
      onDiagnostic: (diagnostic) => safeDiagnostics.push(diagnostic),
    });
    await listen(server);
    const token = await accessToken(jwks);
    try {
      const response = await rawRequest(serverOrigin(server), {
        method: 'GET', path: '/v1/session', headers: { authorization: `Bearer ${token}` },
      });
      expectGenericError(response, 503, 'service_unavailable');
      expect(safeDiagnostics).toHaveLength(1);
      expect(safeDiagnostics[0]).toEqual({
        code: 'session_resolution_failed',
        correlationId: response.headers['x-request-id'],
      });
      const serialized = JSON.stringify({ response: response.text, diagnostics: safeDiagnostics });
      expect(serialized).not.toContain(token);
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('database.internal');
    } finally {
      await closeServer(server);
    }
  });

  it('still returns generic 503 when the optional diagnostic sink itself throws', async () => {
    const server = createSessionRegressionServer({
      resolve: async () => { throw new Error('internal'); },
    }, {
      onDiagnostic: () => { throw new Error('diagnostic failure'); },
    });
    await listen(server);
    try {
      expectGenericError(await rawRequest(serverOrigin(server), {
        method: 'GET', path: '/v1/session', headers: { authorization: 'Bearer abc.def.ghi' },
      }), 503, 'service_unavailable');
    } finally {
      await closeServer(server);
    }
  });

  it('bounds a stalled authority call and returns the same generic 503', async () => {
    const neverSettles = new Promise<never>(() => undefined);
    const server = createSessionRegressionServer({
      resolve: () => neverSettles,
    }, {
      authorityTimeoutMilliseconds: 10,
    });
    await listen(server);
    try {
      expectGenericError(await rawRequest(serverOrigin(server), {
        method: 'GET', path: '/v1/session', headers: { authorization: 'Bearer abc.def.ghi' },
      }), 503, 'service_unavailable');
    } finally {
      await closeServer(server);
    }
  });

  it('does not write tokens, provider details, or passwords to console output', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const token = await accessToken(jwks);
    try {
      await sessionRequest(token);
      await sessionRequest('abc.def.ghi');
      const output = JSON.stringify([...log.mock.calls, ...error.mock.calls]);
      expect(output).not.toContain(token);
      expect(output).not.toContain('Authorization');
      expect(output).not.toContain(runtimePassword);
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
});

describe('least-privilege identity resolver runtime', () => {
  it('is a non-owner, NOINHERIT, non-superuser login with exactly the resolver parent role', async () => {
    const attributes = await installerPool.query<{
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>(
      `SELECT rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
       FROM pg_catalog.pg_roles WHERE rolname = $1`,
      [C2_SESSION_RUNTIME_LOGIN],
    );
    expect(attributes.rows[0]).toEqual({
      rolcanlogin: true,
      rolinherit: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolbypassrls: false,
    });
    expect(await parentRoles(C2_SESSION_RUNTIME_LOGIN)).toEqual([B4_IDENTITY_RESOLVER_ROLE]);
    expect(await parentRoles(B4_IDENTITY_RESOLVER_ROLE)).toEqual([]);
    const ownership = await installerPool.query<{ count: string }>(
      `SELECT count(*)::text
       FROM pg_catalog.pg_class object
       JOIN pg_catalog.pg_namespace namespace ON namespace.oid = object.relnamespace
       JOIN pg_catalog.pg_roles owner ON owner.oid = object.relowner
       WHERE namespace.nspname = $1 AND owner.rolname = $2`,
      [B3_SCHEMA, C2_SESSION_RUNTIME_LOGIN],
    );
    expect(ownership.rows[0]?.count).toBe('0');
  });

  it('has no direct access after RESET ROLE and cannot perform DDL or select another role', async () => {
    const pool = new Pool({ connectionString: configuredRuntimeConnectionString, max: 1 });
    try {
      expect(await postgresErrorCode(pool.query(`SELECT * FROM ${B3_SCHEMA}.organizations`)))
        .toBe('42501');
      expect(await postgresErrorCode(pool.query(
        `SELECT * FROM ${B3_SCHEMA}.resolve_request_actor($1, $2)`,
        [jwks.issuerA, c1Ids.sharedSubject],
      ))).toBe('42501');
      expect(await postgresErrorCode(pool.query(`CREATE TABLE ${B3_SCHEMA}.c1_forbidden (id int)`)))
        .toBe('42501');
      expect(await postgresErrorCode(pool.query('SET ROLE taptime_employee'))).toBe('42501');
      expect(await postgresErrorCode(pool.query(
        `ALTER ROLE ${C2_SESSION_RUNTIME_LOGIN} SUPERUSER`,
      )))
        .toBe('42501');
    } finally {
      await pool.end();
    }
  });

  it('cleans role and transaction-local context on a reused max-one connection', async () => {
    await expect(resolver.resolve({ issuer: jwks.issuerA, subject: c1Ids.sharedSubject }))
      .resolves.toMatchObject({ status: 'resolved' });
    await expect(resolver.resolve({ issuer: jwks.issuerA, subject: c1Ids.unknownSubject }))
      .resolves.toEqual({ status: 'not_resolved' });
    const state = await resolverPool.query<{
      current_user: string;
      session_user: string;
      current_role: string;
      organization_context: string | null;
      user_context: string | null;
      membership_context: string | null;
    }>(
      `SELECT current_user, session_user, current_role,
        current_setting('app.organization_id', true) AS organization_context,
        current_setting('app.user_id', true) AS user_context,
        current_setting('app.membership_id', true) AS membership_context`,
    );
    expect(state.rows[0]).toEqual({
      current_user: C2_SESSION_RUNTIME_LOGIN,
      session_user: C2_SESSION_RUNTIME_LOGIN,
      current_role: C2_SESSION_RUNTIME_LOGIN,
      organization_context: null,
      user_context: null,
      membership_context: null,
    });
  });
});

async function sessionRequest(token: string): Promise<HttpResult> {
  return rawRequest(apiOrigin, {
    method: 'GET',
    path: '/v1/session',
    headers: { authorization: `Bearer ${token}` },
  });
}

async function rawRequest(
  origin: string,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly rawHeaders?: readonly string[];
    readonly body?: string;
  },
): Promise<HttpResult> {
  const url = new URL(options.path, origin);
  return new Promise<HttpResult>((resolve, reject) => {
    const request = httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: options.method,
      headers: (options.rawHeaders === undefined
        ? options.headers
        : ['Host', url.host, ...options.rawHeaders]) as string[] | Record<string, string> | undefined,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        text: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.once('error', reject);
    if (options.body !== undefined) {
      request.write(options.body);
    }
    request.end();
  });
}

function expectSuccess(response: HttpResult, expected: Readonly<Record<string, string>>): void {
  expect(response.status).toBe(200);
  expect(JSON.parse(response.text)).toEqual(expected);
  expect(Object.keys(JSON.parse(response.text)).sort()).toEqual([
    'membershipId', 'organizationId', 'role', 'userId',
  ]);
  expect(response.headers['cache-control']).toBe('no-store');
}

function expectGenericError(response: HttpResult, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(JSON.parse(response.text)).toEqual({ error: { code } });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
}

function serverOrigin(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test HTTP server has no TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
}

async function tableCounts(): Promise<Record<string, number>> {
  const tables = [
    'organizations', 'users', 'memberships', 'identity_bindings', 'customers', 'nfc_tags',
    'nfc_assignments', 'work_events', 'canonical_decisions', 'time_entries', 'sync_receipts',
    'audit_events',
  ];
  const entries = await Promise.all(tables.map(async (table) => {
    const result = await installerPool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM ${B3_SCHEMA}.${table}`,
    );
    return [table, result.rows[0]?.count ?? -1] as const;
  }));
  return Object.fromEntries(entries);
}

async function parentRoles(memberName: string): Promise<string[]> {
  const result = await installerPool.query<{ role_name: string }>(
    `SELECT parent.rolname AS role_name
     FROM pg_catalog.pg_auth_members membership
     JOIN pg_catalog.pg_roles member ON member.oid = membership.member
     JOIN pg_catalog.pg_roles parent ON parent.oid = membership.roleid
     WHERE member.rolname = $1
     ORDER BY parent.rolname`,
    [memberName],
  );
  return result.rows.map(({ role_name }) => role_name);
}

function connectionStringFor(
  installerUrl: string,
  username: string,
  password: string,
): string {
  const url = new URL(installerUrl);
  url.username = username;
  url.password = password;
  return url.href;
}

function createSessionRegressionServer(
  authority: SessionAuthorityResolver,
  options: {
    readonly onDiagnostic?: (diagnostic: SessionApiDiagnostic) => void;
    readonly authorityTimeoutMilliseconds?: number;
  } = {},
): Server {
  return createBackendHttpServer({
    sessionAuthority: authority,
    scanContextResolver: {
      async resolve() {
        return { status: 'not_resolved' };
      },
    },
    lifecycleIngestor: {
      async ingest() {
        return {
          status: 'deferred',
          evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive',
        };
      },
    },
    deferredLifecycleIngestor: {
      async ingestDeferred() {
        return {
          status: 'deferred',
          evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive',
        };
      },
    },
    administration: {
      async createCustomer() {
        return { status: 'unauthorized' };
      },
      async provisionNfcTag() {
        return { status: 'unauthorized' };
      },
      async readSetupProjection() {
        return { status: 'unauthorized' };
      },
    },
    employeeEnrollment: unavailableEmployeeEnrollment(),
    tagReassignment: {
      async reassignNfcTag() {
        return { status: 'unauthorized' };
      },
    },
  }, {
    onDiagnostic: options.onDiagnostic,
    operationTimeoutMilliseconds: options.authorityTimeoutMilliseconds,
  });
}

function unavailableEmployeeEnrollment() {
  return {
    async createInvitation() {
      return { status: 'unauthorized' as const };
    },
    async redeemInvitation() {
      return { status: 'unauthorized' as const };
    },
    async readEmployeeMembershipsProjection() {
      return { status: 'unauthorized' as const };
    },
  };
}
