import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type Server,
} from 'node:http';
import { SupabaseJwtAccessTokenVerifier } from '@taptime/backend-identity';
import {
  InjectedB6Failure,
  ServerCanonicalLifecycleIngestionCoordinator,
} from '@taptime/backend-lifecycle';
import { TenantReadSessionCoordinator } from '@taptime/backend-read-model';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { B3_SCHEMA, loadMigrations, migrate } from '@taptime/backend-schema';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import { createBackendApiRuntime, type BackendApiRuntime } from '../src/runtime.js';
import type {
  BackendApiDependencies,
  BackendApiDiagnostic,
  DeferredLifecycleIngestor,
  LifecycleIngestor,
  ScanContextResolver,
  SessionAuthorityResolver,
} from '../src/types.js';
import {
  accessToken,
  closeServer,
  listen,
  startSyntheticJwks,
  type SyntheticJwksInfrastructure,
} from './fixtures.js';
import {
  C2_LIFECYCLE_RUNTIME_LOGIN,
  C2_READ_MODEL_RUNTIME_LOGIN,
  C2_RUNTIME_ROLE_GRAPH,
  C2_SESSION_RUNTIME_LOGIN,
  ids,
  parentRoles,
  postgresErrorCode,
  resetAndSeedC2,
  resetMigrateAndPrepareC2,
  runtimeConnectionString,
} from './C2fixtures.js';

const installerConnectionString = process.env.C2_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c2';
const passwords = {
  session: process.env.C2_SESSION_RUNTIME_PASSWORD ?? 'c2-session-local-synthetic-only',
  readModel: process.env.C2_READ_MODEL_RUNTIME_PASSWORD ?? 'c2-read-local-synthetic-only',
  lifecycle: process.env.C2_LIFECYCLE_RUNTIME_PASSWORD ?? 'c2-lifecycle-local-synthetic-only',
} as const;
const connectionStrings = {
  session: process.env.C2_SESSION_DATABASE_URL ?? runtimeConnectionString(
    installerConnectionString,
    C2_SESSION_RUNTIME_LOGIN,
    passwords.session,
  ),
  readModel: process.env.C2_READ_MODEL_DATABASE_URL ?? runtimeConnectionString(
    installerConnectionString,
    C2_READ_MODEL_RUNTIME_LOGIN,
    passwords.readModel,
  ),
  lifecycle: process.env.C2_LIFECYCLE_DATABASE_URL ?? runtimeConnectionString(
    installerConnectionString,
    C2_LIFECYCLE_RUNTIME_LOGIN,
    passwords.lifecycle,
  ),
} as const;

const installerPool = new Pool({ connectionString: installerConnectionString, max: 8 });
const diagnostics: BackendApiDiagnostic[] = [];
let jwks: SyntheticJwksInfrastructure;
let runtime: BackendApiRuntime;
let apiOrigin: string;

interface HttpResult {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  readonly text: string;
}

beforeAll(async () => {
  expectRuntimeUsername(connectionStrings.session, C2_SESSION_RUNTIME_LOGIN);
  expectRuntimeUsername(connectionStrings.readModel, C2_READ_MODEL_RUNTIME_LOGIN);
  expectRuntimeUsername(connectionStrings.lifecycle, C2_LIFECYCLE_RUNTIME_LOGIN);
  jwks = await startSyntheticJwks();
  await resetMigrateAndPrepareC2(installerPool, passwords);
  await resetAndSeedC2(installerPool, jwks.issuerA);
  runtime = createBackendApiRuntime({
    sessionDatabaseUrl: connectionStrings.session,
    readModelDatabaseUrl: connectionStrings.readModel,
    lifecycleDatabaseUrl: connectionStrings.lifecycle,
    supabaseIssuer: jwks.issuerA,
  }, {
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  await listen(runtime.server);
  apiOrigin = serverOrigin(runtime.server);
}, 30_000);

beforeEach(async () => {
  diagnostics.length = 0;
  await resetAndSeedC2(installerPool, jwks.issuerA);
});

afterAll(async () => {
  await runtime?.close();
  await installerPool.end();
  await closeServer(jwks?.server);
});

describe('C2 package, runtime composition, and least privilege', () => {
  it('uses exactly migrations 001 through 005 and reruns the ledger cleanly', async () => {
    expect((await loadMigrations()).map(({ version }) => version)).toEqual([
      '001', '002', '003', '004', '005',
    ]);
    await expect(migrate(installerPool)).resolves.toEqual({
      applied: [],
      alreadyApplied: ['001', '002', '003', '004', '005'],
    });
  });

  it('normalizes three distinct non-owner runtime logins with exact parent roles', async () => {
    for (const [login, roles] of Object.entries(C2_RUNTIME_ROLE_GRAPH)) {
      expect(await parentRoles(installerPool, login)).toEqual([...roles]);
      const result = await installerPool.query<{
        rolcanlogin: boolean;
        rolinherit: boolean;
        rolsuper: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolreplication: boolean;
        rolbypassrls: boolean;
        owned: string;
      }>(
        `SELECT runtime.rolcanlogin, runtime.rolinherit, runtime.rolsuper,
                runtime.rolcreatedb, runtime.rolcreaterole, runtime.rolreplication,
                runtime.rolbypassrls,
                (SELECT count(*)::text
                 FROM pg_catalog.pg_class AS relation
                 JOIN pg_catalog.pg_namespace AS namespace
                   ON namespace.oid = relation.relnamespace
                 WHERE namespace.nspname = $2 AND relation.relowner = runtime.oid) AS owned
         FROM pg_catalog.pg_roles AS runtime
         WHERE runtime.rolname = $1`,
        [login, B3_SCHEMA],
      );
      expect(result.rows).toEqual([{
        rolcanlogin: true,
        rolinherit: false,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolreplication: false,
        rolbypassrls: false,
        owned: '0',
      }]);
    }
  });

  it.each([
    ['session', connectionStrings.session],
    ['read model', connectionStrings.readModel],
    ['lifecycle', connectionStrings.lifecycle],
  ])('%s login has no direct table access and cannot perform DDL', async (_name, url) => {
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
      expect(await postgresErrorCode(pool.query(
        `SELECT * FROM ${B3_SCHEMA}.organizations LIMIT 1`,
      ))).toBe('42501');
      expect(await postgresErrorCode(pool.query(
        `CREATE TABLE ${B3_SCHEMA}.c2_forbidden (id int)`,
      ))).toBe('42501');
    } finally {
      await pool.end();
    }
  });

  it('prevents every runtime login from selecting another capability role', async () => {
    const attempts = [
      [connectionStrings.session, ['taptime_employee', 'taptime_server_lifecycle']],
      [connectionStrings.readModel, ['taptime_server_lifecycle']],
      [connectionStrings.lifecycle, ['taptime_employee', 'taptime_administrator']],
    ] as const;
    for (const [url, roles] of attempts) {
      const pool = new Pool({ connectionString: url, max: 1 });
      try {
        for (const role of roles) {
          expect(await postgresErrorCode(pool.query(`SET ROLE ${role}`))).toBe('42501');
        }
      } finally {
        await pool.end();
      }
    }
  });

  it.each([
    ['not absolute', 'not-a-url'],
    ['non PostgreSQL', 'https://runtime.example.invalid/database'],
    ['missing host', 'postgresql:///database'],
    ['missing login', 'postgresql://127.0.0.1/database'],
  ])('rejects a %s runtime database URL before startup', (_label, invalidUrl) => {
    expect(() => createBackendApiRuntime({
      sessionDatabaseUrl: invalidUrl,
      readModelDatabaseUrl: connectionStrings.readModel,
      lifecycleDatabaseUrl: connectionStrings.lifecycle,
      supabaseIssuer: 'https://synthetic.supabase.co/auth/v1',
    })).toThrow(/database URL|runtime login/);
  });

  it('rejects duplicate configured database usernames including encoded aliases', () => {
    const encodedAlias = connectionStrings.session.replace(
      `//${C2_SESSION_RUNTIME_LOGIN}:`,
      `//%74${C2_SESSION_RUNTIME_LOGIN.slice(1)}:`,
    );
    expect(() => createBackendApiRuntime({
      sessionDatabaseUrl: connectionStrings.session,
      readModelDatabaseUrl: encodedAlias,
      lifecycleDatabaseUrl: connectionStrings.lifecycle,
      supabaseIssuer: 'https://synthetic.supabase.co/auth/v1',
    })).toThrow('Backend API database runtime login names must be distinct');
  });

  it.each([
    ['runtime-login override', `user=${C2_SESSION_RUNTIME_LOGIN}`],
    ['database-host override', 'host=attacker.example.invalid'],
    ['deadline override', 'statement_timeout=0'],
    ['startup role option', 'options=-c%20role%3Dtaptime_server_lifecycle'],
  ])('rejects a PostgreSQL URL %s before creating any pool', (_label, query) => {
    const overridden = new URL(connectionStrings.readModel);
    overridden.search = query;
    expect(() => createBackendApiRuntime({
      sessionDatabaseUrl: connectionStrings.session,
      readModelDatabaseUrl: overridden.href,
      lifecycleDatabaseUrl: connectionStrings.lifecycle,
      supabaseIssuer: 'https://synthetic.supabase.co/auth/v1',
    })).toThrow('Backend API database URL contains an unsupported connection parameter');
  });

  it('cleans the C2 read-model role and transaction-local actor context after commit and rollback',
    async () => {
      const pool = new Pool({ connectionString: connectionStrings.readModel, max: 1 });
      const coordinator = new TenantReadSessionCoordinator(pool, createC2Verifier());
      const command = {
        accessToken: await token(ids.subjectA),
        requestedOrganizationId: OrganizationId(ids.organizationA),
      };
      try {
        await expect(coordinator.run(
          command,
          (repositories) => repositories.customer.findById(CustomerId(ids.customerA)),
        )).resolves.toMatchObject({ status: 'accepted' });
        await expectCleanPooledConnection(pool, C2_READ_MODEL_RUNTIME_LOGIN);

        await expect(coordinator.run(command, async () => {
          throw new Error('synthetic C2 read rollback');
        })).rejects.toThrow('synthetic C2 read rollback');
        await expectCleanPooledConnection(pool, C2_READ_MODEL_RUNTIME_LOGIN);
      } finally {
        await pool.end();
      }
    });

  it('cleans the C2 lifecycle role and every transaction-local context after rollback and commit',
    async () => {
      const pool = new Pool({ connectionString: connectionStrings.lifecycle, max: 1 });
      const coordinator = new ServerCanonicalLifecycleIngestionCoordinator(
        pool,
        createC2Verifier(),
      );
      const command = {
        accessToken: await token(ids.subjectA),
        requestedOrganizationId: OrganizationId(ids.organizationA),
        workEvent: {
          id: WorkEventId(uuid('5', 901)),
          assignmentId: NfcAssignmentId(ids.assignmentA),
          nfcTagId: NfcTagId(ids.tagA),
          target: customerAssignmentTarget(CustomerId(ids.customerA)),
          occurredAt: createTimestamp('2026-07-13T08:00:00.000Z'),
        },
        receipt: { id: uuid('6', 901), attemptNumber: 1 },
      };
      try {
        await expect(coordinator.ingest(command, undefined, { failAfter: 'work_event' }))
          .rejects.toBeInstanceOf(InjectedB6Failure);
        await expectCleanPooledConnection(pool, C2_LIFECYCLE_RUNTIME_LOGIN);

        await expect(coordinator.ingest(command)).resolves.toMatchObject({
          status: 'synchronized',
          idempotentRetry: false,
        });
        await expectCleanPooledConnection(pool, C2_LIFECYCLE_RUNTIME_LOGIN);
      } finally {
        await pool.end();
      }
    });
});

describe('exact routes, HTTP hardening, and disclosure-safe errors', () => {
  it('preserves the exact C1 employee session response on the product server', async () => {
    const response = await getSession(await token(ids.subjectA));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.text)).toEqual({
      userId: ids.userA,
      membershipId: ids.membershipA,
      organizationId: ids.organizationA,
      role: 'employee',
    });
    expectSafeHeaders(response);
  });

  it.each([
    ['POST', '/v1/session', 405, 'GET'],
    ['GET', '/v1/scan-context/resolve', 405, 'POST'],
    ['GET', '/v1/lifecycle-events', 405, 'POST'],
    ['GET', '/v1/lifecycle-events/deferred', 405, 'POST'],
    ['GET', '/v1/session/', 404, undefined],
    ['GET', '/v1/session?x=1', 404, undefined],
    ['POST', '/v1/scan-context/resolve/', 404, undefined],
    ['POST', '/v1/lifecycle-event', 404, undefined],
    ['POST', '/v1/lifecycle-events/deferred/', 404, undefined],
    ['GET', '/v1/anything-else', 404, undefined],
  ])('rejects non-contract request %s %s', async (method, path, status, allow) => {
    const response = await rawRequest(apiOrigin, { method, path });
    expect(response.status).toBe(status);
    expect(JSON.parse(response.text)).toEqual({
      error: { code: status === 405 ? 'method_not_allowed' : 'not_found' },
    });
    expect(response.headers.allow).toBe(allow);
  });

  it.each([
    ['missing', undefined],
    ['malformed', 'Basic abc.def.ghi'],
    ['whitespace', 'Bearer abc.def.ghi trailing'],
    ['non JWT', 'Bearer opaque'],
  ])('rejects %s authorization identically', async (_label, authorization) => {
    const response = await rawRequest(apiOrigin, {
      method: 'POST',
      path: '/v1/scan-context/resolve',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: JSON.stringify(scanBody('b6-a')),
    });
    expectGenericError(response, 401, 'unauthorized');
  });

  it('rejects duplicate Authorization fields before invoking a capability', async () => {
    const validToken = await token(ids.subjectA);
    const response = await rawRequest(apiOrigin, {
      method: 'POST',
      path: '/v1/scan-context/resolve',
      rawHeaders: [
        'Authorization', `Bearer ${validToken}`,
        'Authorization', `Bearer ${validToken}`,
        'Content-Type', 'application/json',
        'Content-Length', String(Buffer.byteLength(JSON.stringify(scanBody('b6-a')))),
      ],
      body: JSON.stringify(scanBody('b6-a')),
    });
    expectGenericError(response, 401, 'unauthorized');
  });

  it.each([
    ['missing content type', {}, 400],
    ['content type parameter', { 'content-type': 'application/json; charset=utf-8' }, 400],
    ['non JSON', { 'content-type': 'text/plain' }, 400],
    ['content encoding', { 'content-type': 'application/json', 'content-encoding': 'gzip' }, 400],
    ['cookie', { 'content-type': 'application/json', cookie: 'session=forbidden' }, 400],
  ])('rejects %s', async (_label, headers, status) => {
    const response = await rawRequest(apiOrigin, {
      method: 'POST',
      path: '/v1/scan-context/resolve',
      headers: {
        authorization: `Bearer ${await token(ids.subjectA)}`,
        ...headers,
      },
      body: JSON.stringify(scanBody('b6-a')),
    });
    expectGenericError(response, status, 'invalid_request');
  });

  it.each([
    ['malformed JSON', '{'],
    ['array JSON', '[]'],
    ['scalar JSON', 'true'],
    ['empty body', ''],
  ])('rejects %s without a capability call', async (_label, body) => {
    expectGenericError(await postRaw('/v1/scan-context/resolve', await token(ids.subjectA), body),
      400, 'invalid_request');
  });

  it('rejects a declared body above 16 KiB without reading it', async () => {
    const response = await rawRequest(apiOrigin, {
      method: 'POST',
      path: '/v1/scan-context/resolve',
      headers: {
        authorization: `Bearer ${await token(ids.subjectA)}`,
        'content-type': 'application/json',
        'content-length': String(16 * 1_024 + 1),
      },
    });
    expectGenericError(response, 400, 'invalid_request');
  });

  it('accepts a bounded chunked JSON request', async () => {
    const body = JSON.stringify(scanBody('b6-a'));
    const response = await rawRequest(apiOrigin, {
      method: 'POST',
      path: '/v1/scan-context/resolve',
      headers: {
        authorization: `Bearer ${await token(ids.subjectA)}`,
        'content-type': 'application/json',
      },
      body,
    });
    expect(response.status).toBe(200);
  });

  it('does not invoke a capability for an aborted chunked body', async () => {
    let calls = 0;
    const server = createBackendHttpServer(testDependencies({
      scanContextResolver: {
        async resolve() {
          calls += 1;
          return { status: 'not_resolved' };
        },
      },
    }));
    await listen(server);
    try {
      const origin = new URL(serverOrigin(server));
      const request = httpRequest({
        hostname: origin.hostname,
        port: origin.port,
        path: '/v1/scan-context/resolve',
        method: 'POST',
        headers: {
          authorization: 'Bearer abc.def.ghi',
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
        },
      });
      request.on('error', () => undefined);
      request.write('{"organizationId":');
      request.destroy();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(calls).toBe(0);
    } finally {
      await closeServer(server);
    }
  });

  it.each(['scan_context', 'lifecycle'] as const)(
    'maps a thrown %s infrastructure failure to 503 with only fixed diagnostics',
    async (capability) => {
      const safeDiagnostics: BackendApiDiagnostic[] = [];
      const secret = `secret-${capability}`;
      const server = createBackendHttpServer(testDependencies(
        capability === 'scan_context'
          ? { scanContextResolver: throwingScanResolver(secret) }
          : { lifecycleIngestor: throwingLifecycleIngestor(secret) },
      ), { onDiagnostic: (diagnostic) => safeDiagnostics.push(diagnostic) });
      await listen(server);
      try {
        const path = capability === 'scan_context'
          ? '/v1/scan-context/resolve'
          : '/v1/lifecycle-events';
        const body = capability === 'scan_context'
          ? scanBody('opaque-secret-payload')
          : lifecycleBody({ event: 900, receipt: 900 });
        const response = await postJson(serverOrigin(server), path, 'abc.def.ghi', body);
        expectGenericError(response, 503, 'service_unavailable');
        const serialized = JSON.stringify({ response, safeDiagnostics });
        expect(serialized).not.toContain(secret);
        expect(safeDiagnostics).toEqual([{
          code: capability === 'scan_context'
            ? 'scan_context_resolution_failed'
            : 'lifecycle_ingestion_failed',
          correlationId: response.headers['x-request-id'],
        }]);
      } finally {
        await closeServer(server);
      }
    },
  );

  it('bounds a stalled C2 capability and preserves generic diagnostics', async () => {
    const server = createBackendHttpServer(testDependencies({
      scanContextResolver: { resolve: async () => new Promise(() => undefined) },
    }), { operationTimeoutMilliseconds: 20 });
    await listen(server);
    try {
      expectGenericError(await postJson(
        serverOrigin(server),
        '/v1/scan-context/resolve',
        'abc.def.ghi',
        scanBody('b6-a'),
      ), 503, 'service_unavailable');
    } finally {
      await closeServer(server);
    }
  });
});

describe('B5-backed scan-context route', () => {
  it('returns exactly the authorized Assignment, Tag, and target projection', async () => {
    const response = await postProduct(
      '/v1/scan-context/resolve',
      await token(ids.subjectA),
      scanBody('b6-a'),
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(response.text)).toEqual({
      assignmentId: ids.assignmentA,
      nfcTagId: ids.tagA,
      target: { targetType: 'customer', targetId: ids.customerA },
    });
    expect(Object.keys(JSON.parse(response.text)).sort()).toEqual([
      'assignmentId', 'nfcTagId', 'target',
    ]);
    expect(response.text).not.toContain('Synthetic');
    expectSafeHeaders(response);
  });

  it('treats payload as opaque and case-sensitive without normalization', async () => {
    expectGenericError(await postProduct(
      '/v1/scan-context/resolve',
      await token(ids.subjectA),
      scanBody('B6-A'),
    ), 404, 'not_found');
    expectGenericError(await postProduct(
      '/v1/scan-context/resolve',
      await token(ids.subjectA),
      scanBody(' b6-a '),
    ), 404, 'not_found');
  });

  it.each([
    ['unknown', 'not-present'],
    ['inactive Assignment', 'b6-a-inactive'],
    ['inactive Customer', 'b6-a-inactive-customer'],
    ['foreign tenant', 'b6-b'],
  ])('collapses %s context to the same generic 404', async (_label, payload) => {
    expectGenericError(await postProduct(
      '/v1/scan-context/resolve',
      await token(ids.subjectA),
      scanBody(payload),
    ), 404, 'not_found');
  });

  it('enforces the 1,024-byte UTF-8 payload boundary', async () => {
    expectGenericError(await postProduct(
      '/v1/scan-context/resolve',
      await token(ids.subjectA),
      scanBody('ä'.repeat(512)),
    ), 404, 'not_found');
    expectGenericError(await postProduct(
      '/v1/scan-context/resolve',
      await token(ids.subjectA),
      scanBody('ä'.repeat(513)),
    ), 400, 'invalid_request');
  });

  it.each([
    ['top-level extra', { ...scanBody('b6-a'), role: 'administrator' }],
    ['missing payload', { organizationId: ids.organizationA }],
    ['array', [scanBody('b6-a')]],
    ['empty payload', scanBody('')],
    ['blank payload', scanBody('   ')],
  ])('rejects %s scan shape before B5', async (_label, body) => {
    expectGenericError(await postProduct(
      '/v1/scan-context/resolve',
      await token(ids.subjectA),
      body,
    ), 400, 'invalid_request');
  });

  it.each([
    ['requested Organization mismatch', ids.subjectA, ids.organizationB],
    ['unknown identity', ids.unknownSubject, ids.organizationA],
    ['revoked binding', ids.revokedBindingSubject, ids.organizationA],
    ['revoked Membership', ids.revokedMembershipSubject, ids.organizationA],
  ])('maps %s to generic 401', async (_label, subject, organizationId) => {
    expectGenericError(await postProduct(
      '/v1/scan-context/resolve',
      await token(subject),
      scanBody('b6-a', organizationId),
    ), 401, 'unauthorized');
  });
});

describe('B6-backed server-canonical lifecycle route', () => {
  it('maps a genuine Core Start to exact synchronized HTTP output', async () => {
    const body = lifecycleBody({ event: 1, receipt: 1 });
    const response = await postLifecycle(body);
    expect(response.status).toBe(200);
    expect(JSON.parse(response.text)).toEqual({
      status: 'synchronized',
      idempotentRetry: false,
      decision: { status: 'time_entry_started', timeEntryId: expect.any(String) },
      workEventId: body.workEvent.id,
      receiptId: body.receipt.id,
      serverTimeEntryId: expect.any(String),
    });
  });

  it('maps genuine Stop, Duplicate, Other-Target, and Escalation decisions without transport rules',
    async () => {
      const start = lifecycleBody({ event: 10, receipt: 10 });
      const started = JSON.parse((await postLifecycle(start)).text);

      const stop = lifecycleBody({
        event: 11,
        receipt: 11,
        occurredAt: '2026-07-13T08:00:05.000Z',
      });
      expect(JSON.parse((await postLifecycle(stop)).text)).toMatchObject({
        status: 'synchronized',
        decision: { status: 'time_entry_stopped', timeEntryId: started.serverTimeEntryId },
        serverTimeEntryId: started.serverTimeEntryId,
      });

      await resetAndSeedC2(installerPool, jwks.issuerA);
      const duplicateStart = lifecycleBody({ event: 12, receipt: 12 });
      await postLifecycle(duplicateStart);

      const duplicate = lifecycleBody({
        event: 13,
        receipt: 13,
        occurredAt: '2026-07-13T08:00:04.999Z',
      });
      expect(JSON.parse((await postLifecycle(duplicate)).text)).toMatchObject({
        status: 'synchronized',
        decision: {
          status: 'duplicate_scan_ignored',
          previousWorkEventId: duplicateStart.workEvent.id,
        },
        serverTimeEntryId: null,
      });

      await resetAndSeedC2(installerPool, jwks.issuerA);
      const otherTargetStart = JSON.parse((await postLifecycle(lifecycleBody({
        event: 14,
        receipt: 14,
      }))).text);
      const otherTarget = lifecycleBody({
        event: 15,
        receipt: 15,
        assignmentId: ids.otherAssignmentA,
        nfcTagId: ids.otherTagA,
        targetId: ids.otherCustomerA,
        occurredAt: '2026-07-13T08:00:10.000Z',
      });
      expect(JSON.parse((await postLifecycle(otherTarget)).text)).toMatchObject({
        status: 'synchronized',
        decision: {
          status: 'active_entry_for_other_target_rejected',
          activeTimeEntryId: otherTargetStart.serverTimeEntryId,
        },
        serverTimeEntryId: otherTargetStart.serverTimeEntryId,
      });

      await resetAndSeedC2(installerPool, jwks.issuerA);
      await postLifecycle(lifecycleBody({
        event: 16,
        receipt: 16,
        occurredAt: '2026-07-13T08:00:05.000Z',
      }));
      const escalation = lifecycleBody({
        event: 17,
        receipt: 17,
        occurredAt: '2026-07-13T08:00:04.999Z',
      });
      expect(JSON.parse((await postLifecycle(escalation)).text)).toMatchObject({
        status: 'synchronized',
        decision: {
          status: 'escalation_required',
          reason: 'work_event_precedes_active_time_entry',
        },
        serverTimeEntryId: null,
      });
    });

  it('maps deferred current configuration to 202 without inventing a Decision', async () => {
    const body = lifecycleBody({
      event: 20,
      receipt: 20,
      assignmentId: ids.inactiveAssignmentA,
      nfcTagId: ids.inactiveTagA,
      targetId: ids.customerA,
    });
    const response = await postLifecycle(body);
    expect(response.status).toBe(202);
    expect(JSON.parse(response.text)).toEqual({
      status: 'deferred',
      evidenceStored: true,
      idempotentRetry: false,
      workEventId: body.workEvent.id,
      receiptId: body.receipt.id,
    });
  });

  it('preserves identical retry idempotency and receipt metadata conflict mapping', async () => {
    const body = lifecycleBody({ event: 30, receipt: 30 });
    expect((await postLifecycle(body)).status).toBe(200);
    const retry = await postLifecycle(body);
    expect(retry.status).toBe(200);
    expect(JSON.parse(retry.text)).toMatchObject({
      status: 'synchronized',
      idempotentRetry: true,
      workEventId: body.workEvent.id,
      receiptId: body.receipt.id,
    });

    const receiptConflict = structuredClone(body);
    receiptConflict.receipt.id = uuid('6', 31);
    const conflict = await postLifecycle(receiptConflict);
    expect(conflict.status).toBe(409);
    expect(JSON.parse(conflict.text)).toEqual({
      status: 'conflict',
      reason: 'receipt_metadata_conflict',
    });
  });

  it('commits one canonical path after a lost response and makes the identical retry idempotent',
    async () => {
      const pool = new Pool({ connectionString: connectionStrings.lifecycle, max: 1 });
      const coordinator = new ServerCanonicalLifecycleIngestionCoordinator(
        pool,
        createC2Verifier(),
      );
      const writeReached = deferred<void>();
      const continueWrite = deferred<void>();
      const firstIngestionCompleted = deferred<void>();
      let firstIngestion = true;
      const server = createBackendHttpServer(testDependencies({
        lifecycleIngestor: {
          async ingest(command) {
            if (!firstIngestion) {
              return coordinator.ingest(command);
            }
            firstIngestion = false;
            try {
              return await coordinator.ingest(command, undefined, {
                async afterWrite(stage) {
                  if (stage === 'work_event') {
                    writeReached.resolve();
                    await continueWrite.promise;
                  }
                },
              });
            } finally {
              firstIngestionCompleted.resolve();
            }
          },
        },
      }));
      await listen(server);
      const origin = serverOrigin(server);
      const body = lifecycleBody({ event: 35, receipt: 35 });
      const serializedBody = JSON.stringify(body);
      const accessToken = await token(ids.subjectA);
      try {
        const url = new URL('/v1/lifecycle-events', origin);
        const request = httpRequest({
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(serializedBody)),
          },
        }, (response) => response.resume());
        request.on('error', () => undefined);
        const connectionClosed = new Promise<void>((resolve) => request.once('close', resolve));
        request.end(serializedBody);

        await writeReached.promise;
        request.destroy();
        await connectionClosed;
        continueWrite.resolve();
        await firstIngestionCompleted.promise;

        const retry = await postJson(origin, '/v1/lifecycle-events', accessToken, body);
        expect(retry.status).toBe(200);
        expect(JSON.parse(retry.text)).toMatchObject({
          status: 'synchronized',
          idempotentRetry: true,
          decision: { status: 'time_entry_started' },
          workEventId: body.workEvent.id,
          receiptId: body.receipt.id,
        });
        const counts = await installerPool.query<{
          audit_events: string;
          decisions: string;
          receipts: string;
          time_entries: string;
          work_events: string;
        }>(
          `SELECT
             (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events) AS work_events,
             (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries) AS time_entries,
             (SELECT count(*)::text FROM ${B3_SCHEMA}.canonical_decisions) AS decisions,
             (SELECT count(*)::text FROM ${B3_SCHEMA}.sync_receipts) AS receipts,
             (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events) AS audit_events`,
        );
        expect(counts.rows).toEqual([{
          work_events: '1',
          time_entries: '1',
          decisions: '1',
          receipts: '1',
          audit_events: '1',
        }]);
      } finally {
        continueWrite.resolve();
        await closeServer(server);
        await pool.end();
      }
    });

  it('maps same WorkEvent ID with different content to fixed conflict', async () => {
    const body = lifecycleBody({ event: 40, receipt: 40 });
    expect((await postLifecycle(body)).status).toBe(200);
    const changed = structuredClone(body);
    changed.workEvent.occurredAt = '2026-07-13T08:00:10.000Z';
    changed.receipt.id = uuid('6', 41);
    const response = await postLifecycle(changed);
    expect(response.status).toBe(409);
    expect(JSON.parse(response.text)).toEqual({
      status: 'conflict',
      reason: 'work_event_content_conflict',
    });
  });

  it('accepts only the existing optional clientTimeEntryId evidence', async () => {
    const body = lifecycleBody({ event: 50, receipt: 50 });
    body.receipt.clientTimeEntryId = uuid('6', 950);
    const response = await postLifecycle(body);
    expect(response.status).toBe(200);
    const receipt = await installerPool.query<{ client_time_entry_id: string }>(
      `SELECT client_time_entry_id
       FROM ${B3_SCHEMA}.sync_receipts
       WHERE id = $1::uuid`,
      [body.receipt.id],
    );
    expect(receipt.rows).toEqual([{ client_time_entry_id: body.receipt.clientTimeEntryId }]);
  });

  it.each([
    ['client Decision', (body: LifecycleBody) => Object.assign(body, { decision: 'start' })],
    ['client role', (body: LifecycleBody) => Object.assign(body, { role: 'administrator' })],
    ['triggeredBy', (body: LifecycleBody) => Object.assign(body.workEvent, { triggeredBy: ids.userA })],
    ['client status', (body: LifecycleBody) => Object.assign(body.workEvent, { status: 'started' })],
    ['target authority', (body: LifecycleBody) => Object.assign(body.workEvent.target, { organizationId: ids.organizationA })],
    ['server Decision', (body: LifecycleBody) => Object.assign(body.receipt, { serverDecision: 'forged' })],
    ['server TimeEntry', (body: LifecycleBody) => Object.assign(body.receipt, { serverTimeEntryId: uuid('6', 999) })],
  ])('rejects %s fields before B6 and leaves no WorkEvent', async (_label, mutate) => {
    const body = lifecycleBody({ event: 60, receipt: 60 });
    mutate(body);
    expectGenericError(await postLifecycle(body), 400, 'invalid_request');
    const count = await installerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${B3_SCHEMA}.work_events`,
    );
    expect(count.rows[0]?.count).toBe('0');
  });

  it.each([
    ['invalid Organization', (body: LifecycleBody) => { body.organizationId = 'invalid'; }],
    ['invalid WorkEvent', (body: LifecycleBody) => { body.workEvent.id = 'invalid'; }],
    ['invalid timestamp', (body: LifecycleBody) => { body.workEvent.occurredAt = 'today'; }],
    ['invalid calendar date', (body: LifecycleBody) => {
      body.workEvent.occurredAt = '2026-02-30T08:00:00.000Z';
    }],
    ['zero attempt', (body: LifecycleBody) => { body.receipt.attemptNumber = 0; }],
    ['fractional attempt', (body: LifecycleBody) => { body.receipt.attemptNumber = 1.5; }],
    ['non-customer target', (body: LifecycleBody) => { body.workEvent.target.targetType = 'project'; }],
  ])('rejects %s transport evidence before B6', async (_label, mutate) => {
    const body = lifecycleBody({ event: 70, receipt: 70 });
    mutate(body);
    expectGenericError(await postLifecycle(body), 400, 'invalid_request');
  });

  it('maps current authority rejection to 401 without lifecycle evidence', async () => {
    const body = lifecycleBody({ event: 80, receipt: 80, organizationId: ids.organizationB });
    expectGenericError(await postProduct(
      '/v1/lifecycle-events',
      await token(ids.subjectA),
      body,
    ), 401, 'unauthorized');
    const count = await installerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${B3_SCHEMA}.work_events`,
    );
    expect(count.rows[0]?.count).toBe('0');
  });
});

describe('E2A defer-only lifecycle route', () => {
  it('stores exact durable evidence without a Decision or TimeEntry and retries idempotently',
    async () => {
      const body = lifecycleBody({ event: 101, receipt: 101 });
      const first = await postDeferredLifecycle(body);
      expect(first.status).toBe(202);
      expect(JSON.parse(first.text)).toEqual({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: false,
        workEventId: body.workEvent.id,
        receiptId: body.receipt.id,
      });

      const retry = await postDeferredLifecycle(body);
      expect(retry.status).toBe(202);
      expect(JSON.parse(retry.text)).toEqual({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: true,
        workEventId: body.workEvent.id,
        receiptId: body.receipt.id,
      });

      const persisted = await installerPool.query<{
        audit_events: string;
        decisions: string;
        receipt_id: string;
        receipt_status: string;
        server_decision_work_event_id: string | null;
        server_time_entry_id: string | null;
        time_entries: string;
        work_events: string;
      }>(
        `SELECT
           (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events) AS work_events,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.time_entries) AS time_entries,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.canonical_decisions) AS decisions,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events) AS audit_events,
           receipt.id::text AS receipt_id,
           receipt.status AS receipt_status,
           receipt.server_decision_work_event_id::text,
           receipt.server_time_entry_id::text
         FROM ${B3_SCHEMA}.sync_receipts AS receipt
         WHERE receipt.id = $1::uuid`,
        [body.receipt.id],
      );
      expect(persisted.rows).toEqual([{
        work_events: '1',
        time_entries: '0',
        decisions: '0',
        audit_events: '1',
        receipt_id: body.receipt.id,
        receipt_status: 'received',
        server_decision_work_event_id: null,
        server_time_entry_id: null,
      }]);
    });

  it('returns truthful non-durable deferral for inactive current configuration with zero writes',
    async () => {
      const body = lifecycleBody({
        event: 102,
        receipt: 102,
        assignmentId: ids.inactiveAssignmentA,
        nfcTagId: ids.inactiveTagA,
        targetId: ids.customerA,
      });
      const response = await postDeferredLifecycle(body);
      expect(response.status).toBe(202);
      expect(JSON.parse(response.text)).toEqual({
        status: 'deferred',
        evidenceStored: false,
        reason: 'configuration_unavailable_or_inactive',
      });
      const counts = await installerPool.query<{ audit_events: string; work_events: string }>(
        `SELECT
           (SELECT count(*)::text FROM ${B3_SCHEMA}.work_events) AS work_events,
           (SELECT count(*)::text FROM ${B3_SCHEMA}.audit_events) AS audit_events`,
      );
      expect(counts.rows).toEqual([{ work_events: '0', audit_events: '0' }]);
    });

  it('fails a Membership mismatch closed and writes no evidence', async () => {
    const body = lifecycleBody({ event: 103, receipt: 103 });
    expectGenericError(await postDeferredLifecycle(body, ids.membershipA2), 401, 'unauthorized');
    const count = await installerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${B3_SCHEMA}.work_events`,
    );
    expect(count.rows[0]?.count).toBe('0');
  });

  it('never exposes a canonical Decision through the defer-only route', async () => {
    const body = lifecycleBody({ event: 104, receipt: 104 });
    expect((await postLifecycle(body)).status).toBe(200);
    const response = await postDeferredLifecycle(body);
    expect(response.status).toBe(409);
    expect(JSON.parse(response.text)).toEqual({
      status: 'conflict',
      reason: 'receipt_metadata_conflict',
    });
  });

  it('keeps the JSON command closed and rejects a client-selected policy field', async () => {
    const body = Object.assign(lifecycleBody({ event: 105, receipt: 105 }), {
      mode: 'canonical',
    });
    expectGenericError(await postDeferredLifecycle(body), 400, 'invalid_request');
  });

  it('accepts only the fixed first deferred-evidence attempt', async () => {
    const body = lifecycleBody({ event: 110, receipt: 110 });
    body.receipt.attemptNumber = 2;
    expectGenericError(await postDeferredLifecycle(body), 400, 'invalid_request');
  });

  it('requires exactly one valid expected-Membership header before invoking the capability',
    async () => {
      let calls = 0;
      const canonicalMembershipId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
      const server = createBackendHttpServer(testDependencies({
        deferredLifecycleIngestor: {
          async ingestDeferred(_command, expectedMembershipId) {
            calls += 1;
            expect(expectedMembershipId).toBe(canonicalMembershipId);
            return {
              status: 'deferred',
              evidenceStored: false,
              reason: 'configuration_unavailable_or_inactive',
            };
          },
        },
      }));
      await listen(server);
      const origin = serverOrigin(server);
      const body = JSON.stringify(lifecycleBody({ event: 106, receipt: 106 }));
      try {
        expectGenericError(await postRaw(
          '/v1/lifecycle-events/deferred',
          'abc.def.ghi',
          body,
          origin,
        ), 400, 'invalid_request');
        expectGenericError(await rawRequest(origin, {
          method: 'POST',
          path: '/v1/lifecycle-events/deferred',
          headers: {
            authorization: 'Bearer abc.def.ghi',
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(body)),
            'x-taptime-expected-membership-id': 'invalid',
          },
          body,
        }), 400, 'invalid_request');
        expectGenericError(await rawRequest(origin, {
          method: 'POST',
          path: '/v1/lifecycle-events/deferred',
          rawHeaders: [
            'Authorization', 'Bearer abc.def.ghi',
            'Content-Type', 'application/json',
            'Content-Length', String(Buffer.byteLength(body)),
            'X-TapTime-Expected-Membership-Id', ids.membershipA,
            'X-TapTime-Expected-Membership-Id', ids.membershipA,
          ],
          body,
        }), 400, 'invalid_request');
        expect(calls).toBe(0);

        const accepted = await rawRequest(origin, {
          method: 'POST',
          path: '/v1/lifecycle-events/deferred',
          headers: {
            authorization: 'Bearer abc.def.ghi',
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(body)),
            'x-taptime-expected-membership-id': canonicalMembershipId.toUpperCase(),
          },
          body,
        });
        expect(accepted.status).toBe(202);
        expect(calls).toBe(1);
      } finally {
        await closeServer(server);
      }
    });

  it('accepts the expected-Membership header optionally on canonical ingestion', async () => {
    const received: Array<string | undefined> = [];
    const server = createBackendHttpServer(testDependencies({
      lifecycleIngestor: {
        async ingest(_command, expectedMembershipId) {
          received.push(expectedMembershipId);
          return {
            status: 'deferred',
            evidenceStored: false,
            reason: 'configuration_unavailable_or_inactive',
          };
        },
      },
    }));
    await listen(server);
    const origin = serverOrigin(server);
    const body = lifecycleBody({ event: 107, receipt: 107 });
    const serialized = JSON.stringify(body);
    try {
      expect((await postJson(origin, '/v1/lifecycle-events', 'abc.def.ghi', body)).status).toBe(202);
      expect((await postCanonicalWithMembership(origin, body, ids.membershipA)).status).toBe(202);
      expect(received).toEqual([undefined, ids.membershipA]);

      expectGenericError(await rawRequest(origin, {
        method: 'POST',
        path: '/v1/lifecycle-events',
        headers: {
          authorization: 'Bearer abc.def.ghi',
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(serialized)),
          'x-taptime-expected-membership-id': 'invalid',
        },
        body: serialized,
      }), 400, 'invalid_request');
      expectGenericError(await rawRequest(origin, {
        method: 'POST',
        path: '/v1/lifecycle-events',
        rawHeaders: [
          'Authorization', 'Bearer abc.def.ghi',
          'Content-Type', 'application/json',
          'Content-Length', String(Buffer.byteLength(serialized)),
          'X-TapTime-Expected-Membership-Id', ids.membershipA,
          'X-TapTime-Expected-Membership-Id', ids.membershipA,
        ],
        body: serialized,
      }), 400, 'invalid_request');
      expect(received).toEqual([undefined, ids.membershipA]);
    } finally {
      await closeServer(server);
    }
  });

  it('fails an optional canonical expected-Membership mismatch closed', async () => {
    const body = lifecycleBody({ event: 108, receipt: 108 });
    const serialized = JSON.stringify(body);
    const response = await rawRequest(apiOrigin, {
      method: 'POST',
      path: '/v1/lifecycle-events',
      headers: {
        authorization: `Bearer ${await token(ids.subjectA)}`,
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(serialized)),
        'x-taptime-expected-membership-id': ids.membershipA2,
      },
      body: serialized,
    });
    expectGenericError(response, 401, 'unauthorized');
    const count = await installerPool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${B3_SCHEMA}.work_events`,
    );
    expect(count.rows[0]?.count).toBe('0');
  });

  it('maps deferred-ingestion failure to generic 503 and a fixed diagnostic', async () => {
    const safeDiagnostics: BackendApiDiagnostic[] = [];
    const server = createBackendHttpServer(testDependencies({
      deferredLifecycleIngestor: {
        async ingestDeferred() {
          throw new Error('sensitive-deferred-failure');
        },
      },
    }), { onDiagnostic: (diagnostic) => safeDiagnostics.push(diagnostic) });
    await listen(server);
    const origin = serverOrigin(server);
    const body = JSON.stringify(lifecycleBody({ event: 109, receipt: 109 }));
    try {
      const response = await rawRequest(origin, {
        method: 'POST',
        path: '/v1/lifecycle-events/deferred',
        headers: {
          authorization: 'Bearer abc.def.ghi',
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(body)),
          'x-taptime-expected-membership-id': ids.membershipA,
        },
        body,
      });
      expectGenericError(response, 503, 'service_unavailable');
      expect(safeDiagnostics).toEqual([{
        code: 'lifecycle_ingestion_failed',
        correlationId: response.headers['x-request-id'],
      }]);
      expect(JSON.stringify({ response, safeDiagnostics }))
        .not.toContain('sensitive-deferred-failure');
    } finally {
      await closeServer(server);
    }
  });
});

interface LifecycleBody {
  organizationId: string;
  workEvent: {
    id: string;
    assignmentId: string;
    nfcTagId: string;
    target: { targetType: string; targetId: string };
    occurredAt: string;
  };
  receipt: {
    id: string;
    attemptNumber: number;
    clientTimeEntryId?: string;
  };
}

function lifecycleBody(options: {
  readonly event: number;
  readonly receipt: number;
  readonly organizationId?: string;
  readonly assignmentId?: string;
  readonly nfcTagId?: string;
  readonly targetId?: string;
  readonly occurredAt?: string;
}): LifecycleBody {
  return {
    organizationId: options.organizationId ?? ids.organizationA,
    workEvent: {
      id: uuid('5', options.event),
      assignmentId: options.assignmentId ?? ids.assignmentA,
      nfcTagId: options.nfcTagId ?? ids.tagA,
      target: { targetType: 'customer', targetId: options.targetId ?? ids.customerA },
      occurredAt: options.occurredAt ?? '2026-07-13T08:00:00.000Z',
    },
    receipt: { id: uuid('6', options.receipt), attemptNumber: 1 },
  };
}

function scanBody(payload: string, organizationId: string = ids.organizationA) {
  return { organizationId, payload };
}

function uuid(prefix: '5' | '6', number: number): string {
  return `${prefix}0000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
}

async function token(subject: string): Promise<string> {
  return accessToken(jwks, { issuer: jwks.issuerA, subject });
}

async function getSession(value: string): Promise<HttpResult> {
  return rawRequest(apiOrigin, {
    method: 'GET',
    path: '/v1/session',
    headers: { authorization: `Bearer ${value}` },
  });
}

async function postLifecycle(body: LifecycleBody): Promise<HttpResult> {
  return postProduct('/v1/lifecycle-events', await token(ids.subjectA), body);
}

async function postDeferredLifecycle(
  body: LifecycleBody,
  expectedMembershipId: string = ids.membershipA,
): Promise<HttpResult> {
  const serialized = JSON.stringify(body);
  return rawRequest(apiOrigin, {
    method: 'POST',
    path: '/v1/lifecycle-events/deferred',
    headers: {
      authorization: `Bearer ${await token(ids.subjectA)}`,
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(serialized)),
      'x-taptime-expected-membership-id': expectedMembershipId,
    },
    body: serialized,
  });
}

async function postCanonicalWithMembership(
  origin: string,
  body: LifecycleBody,
  expectedMembershipId: string,
): Promise<HttpResult> {
  const serialized = JSON.stringify(body);
  return rawRequest(origin, {
    method: 'POST',
    path: '/v1/lifecycle-events',
    headers: {
      authorization: 'Bearer abc.def.ghi',
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(serialized)),
      'x-taptime-expected-membership-id': expectedMembershipId,
    },
    body: serialized,
  });
}

async function postProduct(path: string, value: string, body: unknown): Promise<HttpResult> {
  return postJson(apiOrigin, path, value, body);
}

async function postJson(
  origin: string,
  path: string,
  value: string,
  body: unknown,
): Promise<HttpResult> {
  return postRaw(path, value, JSON.stringify(body), origin);
}

async function postRaw(
  path: string,
  value: string,
  body: string,
  origin: string = apiOrigin,
): Promise<HttpResult> {
  return rawRequest(origin, {
    method: 'POST',
    path,
    headers: {
      authorization: `Bearer ${value}`,
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
    },
    body,
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

function expectGenericError(response: HttpResult, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(JSON.parse(response.text)).toEqual({ error: { code } });
  expectSafeHeaders(response);
}

function expectSafeHeaders(response: HttpResult): void {
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
  expect(response.headers['x-content-type-options']).toBe('nosniff');
  expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.headers['set-cookie']).toBeUndefined();
}

function serverOrigin(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Test HTTP server has no TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
}

function expectRuntimeUsername(connectionString: string, expected: string): void {
  const url = new URL(connectionString);
  if (decodeURIComponent(url.username) !== expected) {
    throw new Error(`C2 runtime URL must use ${expected}`);
  }
}

function createC2Verifier(): SupabaseJwtAccessTokenVerifier {
  return SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer: jwks.issuerA,
    jwksUrl: new URL(`${jwks.issuerA}/.well-known/jwks.json`),
    allowedAlgorithms: ['RS256'],
  });
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  const promise = new Promise<Value>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}

async function expectCleanPooledConnection(pool: Pool, expectedLogin: string): Promise<void> {
  const result = await pool.query<{
    readonly current_role: string;
    readonly current_user: string;
    readonly organization_context: string;
    readonly user_context: string;
    readonly membership_context: string;
    readonly membership_role_context: string;
    readonly correlation_context: string;
  }>(
    `SELECT current_user, current_role,
       COALESCE(NULLIF(current_setting('app.organization_id', true), ''), '<unset>')
         AS organization_context,
       COALESCE(NULLIF(current_setting('app.user_id', true), ''), '<unset>')
         AS user_context,
       COALESCE(NULLIF(current_setting('app.membership_id', true), ''), '<unset>')
         AS membership_context,
       COALESCE(NULLIF(current_setting('app.membership_role', true), ''), '<unset>')
         AS membership_role_context,
       COALESCE(NULLIF(current_setting('app.correlation_id', true), ''), '<unset>')
         AS correlation_context`,
  );
  expect(result.rows).toEqual([{
    current_user: expectedLogin,
    current_role: expectedLogin,
    organization_context: '<unset>',
    user_context: '<unset>',
    membership_context: '<unset>',
    membership_role_context: '<unset>',
    correlation_context: '<unset>',
  }]);
}

function testDependencies(
  overrides: Partial<BackendApiDependencies> = {},
): BackendApiDependencies {
  const sessionAuthority: SessionAuthorityResolver = {
    async resolve() {
      return { status: 'rejected' };
    },
  };
  const scanContextResolver: ScanContextResolver = {
    async resolve() {
      return { status: 'not_resolved' };
    },
  };
  const lifecycleIngestor: LifecycleIngestor = {
    async ingest() {
      return {
        status: 'deferred',
        evidenceStored: false,
        reason: 'configuration_unavailable_or_inactive',
      };
    },
  };
  const deferredLifecycleIngestor: DeferredLifecycleIngestor = {
    async ingestDeferred() {
      return {
        status: 'deferred',
        evidenceStored: false,
        reason: 'configuration_unavailable_or_inactive',
      };
    },
  };
  return {
    sessionAuthority,
    scanContextResolver,
    lifecycleIngestor,
    deferredLifecycleIngestor,
    ...overrides,
  };
}

function throwingScanResolver(secret: string): ScanContextResolver {
  return { resolve: async () => { throw new Error(secret); } };
}

function throwingLifecycleIngestor(secret: string): LifecycleIngestor {
  return { ingest: async () => { throw new Error(secret); } };
}
