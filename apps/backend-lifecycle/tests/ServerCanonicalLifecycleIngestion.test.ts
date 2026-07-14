import { createServer, type Server } from 'node:http';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JWK,
} from 'jose';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CustomerId,
  MembershipId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import {
  AccessTokenVerificationInfrastructureError,
  SupabaseJwtAccessTokenVerifier,
} from '@taptime/backend-identity';
import {
  B3_CONTENT_HASH_ALGORITHM,
  B3_CONTENT_HASH_VERSION,
  B3_MIGRATION_TABLE,
  B3_SCHEMA,
  canonicalWorkEventContent,
  loadMigrations,
  migrate,
  workEventContentHash,
} from '@taptime/backend-schema';
import {
  B6_IDENTITY_RESOLVER_ROLE,
  B6_LIFECYCLE_ROLE,
  B6_RUNTIME_LOGIN,
  InjectedB6Failure,
  ServerCanonicalLifecycleIngestionCoordinator,
  type B6WriteStage,
  type LifecycleIngestionCommand,
} from '../src/index.js';
import {
  B6_RUNTIME_ROLES,
  ensureSyntheticB6RuntimeLogin,
  ids,
  lifecycleCounts,
  postgresErrorCode,
  resetAndSeedB6,
  runtimeConnectionString,
} from './fixtures.js';

const installerConnectionString = process.env.B6_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b6';
const runtimePassword = process.env.B6_RUNTIME_PASSWORD ?? 'b6-local-synthetic-only';
const installerPool = new Pool({ connectionString: installerConnectionString, max: 8 });
const runtimePool = new Pool({
  connectionString: runtimeConnectionString(installerConnectionString, runtimePassword),
  max: 8,
});

const keyId = 'b6-local-rs256';
const sessionId = '90000000-0000-4000-8000-000000000601';
let signingKey: CryptoKey;
let otherSigningKey: CryptoKey;
let jwksServer: Server;
let issuer: string;
let verifier: SupabaseJwtAccessTokenVerifier;
let coordinator: ServerCanonicalLifecycleIngestionCoordinator;

interface TokenOptions {
  readonly subject?: string;
  readonly issuer?: string;
  readonly key?: CryptoKey;
  readonly expiresAt?: number;
  readonly claims?: Readonly<Record<string, unknown>>;
}

async function accessToken(options: TokenOptions = {}): Promise<string> {
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
    .setSubject(options.subject ?? ids.subjectA)
    .setIssuedAt(now)
    .setExpirationTime(options.expiresAt ?? now + 300)
    .sign(options.key ?? signingKey);
}

function uuid(prefix: '5' | '6', number: number): string {
  return `${prefix}0000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
}

async function command(options: {
  readonly eventNumber?: number;
  readonly receiptNumber?: number;
  readonly attemptNumber?: number;
  readonly subject?: string;
  readonly requestedOrganizationId?: string;
  readonly assignmentId?: string;
  readonly tagId?: string;
  readonly customerId?: string;
  readonly occurredAt?: string;
  readonly clientTimeEntryId?: string;
  readonly claims?: Readonly<Record<string, unknown>>;
  readonly token?: string;
} = {}): Promise<LifecycleIngestionCommand> {
  return {
    accessToken: options.token ?? await accessToken({
      subject: options.subject,
      claims: options.claims,
    }),
    requestedOrganizationId: OrganizationId(
      options.requestedOrganizationId ?? ids.organizationA,
    ),
    workEvent: {
      id: WorkEventId(uuid('5', options.eventNumber ?? 1)),
      assignmentId: NfcAssignmentId(options.assignmentId ?? ids.assignmentA),
      nfcTagId: NfcTagId(options.tagId ?? ids.tagA),
      target: customerAssignmentTarget(CustomerId(options.customerId ?? ids.customerA)),
      occurredAt: createTimestamp(options.occurredAt ?? '2026-07-13T08:00:00.000Z'),
    },
    receipt: {
      id: uuid('6', options.receiptNumber ?? options.eventNumber ?? 1),
      attemptNumber: options.attemptNumber ?? 1,
      ...(options.clientTimeEntryId === undefined
        ? {}
        : { clientTimeEntryId: TimeEntryId(options.clientTimeEntryId) }),
    },
  };
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
    throw new Error('Synthetic B6 JWKS server did not expose a TCP address');
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
    throw new Error('Unavailable synthetic B6 JWKS server did not expose a TCP address');
  }
  return { server, origin: new URL(`http://127.0.0.1:${address.port}`) };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function remainsPending(operation: Promise<unknown>): Promise<boolean> {
  return Promise.race([
    operation.then(() => false, () => false),
    new Promise<true>((resolve) => setTimeout(() => resolve(true), 75)),
  ]);
}

async function pooledConnectionState() {
  const result = await runtimePool.query<{
    current_user: string;
    current_role: string;
    organization_context: string;
    user_context: string;
    membership_context: string;
    membership_role_context: string;
    correlation_context: string;
  }>(
    `SELECT current_user, current_role,
       COALESCE(NULLIF(current_setting('app.organization_id', true), ''), '<unset>')
         AS organization_context,
       COALESCE(NULLIF(current_setting('app.user_id', true), ''), '<unset>') AS user_context,
       COALESCE(NULLIF(current_setting('app.membership_id', true), ''), '<unset>')
         AS membership_context,
       COALESCE(NULLIF(current_setting('app.membership_role', true), ''), '<unset>')
         AS membership_role_context,
       COALESCE(NULLIF(current_setting('app.correlation_id', true), ''), '<unset>')
         AS correlation_context`,
  );
  return result.rows[0];
}

function expectCleanConnection(
  state: Awaited<ReturnType<typeof pooledConnectionState>>,
): void {
  expect(state).toEqual({
    current_user: B6_RUNTIME_LOGIN,
    current_role: B6_RUNTIME_LOGIN,
    organization_context: '<unset>',
    user_context: '<unset>',
    membership_context: '<unset>',
    membership_role_context: '<unset>',
    correlation_context: '<unset>',
  });
}

beforeAll(async () => {
  const primaryKeyPair = await generateKeyPair('RS256');
  const secondaryKeyPair = await generateKeyPair('RS256');
  signingKey = primaryKeyPair.privateKey;
  otherSigningKey = secondaryKeyPair.privateKey;
  const jwksInfrastructure = await startJwksServer(await exportJWK(primaryKeyPair.publicKey));
  jwksServer = jwksInfrastructure.server;
  issuer = new URL('/synthetic-b6/auth/v1', jwksInfrastructure.origin).href;

  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(installerPool);
  await ensureSyntheticB6RuntimeLogin(installerPool, runtimePassword);

  verifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer,
    jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
    allowedAlgorithms: ['RS256'],
  });
  coordinator = new ServerCanonicalLifecycleIngestionCoordinator(runtimePool, verifier);
}, 30_000);

beforeEach(async () => {
  await resetAndSeedB6(installerPool, issuer);
});

afterAll(async () => {
  await runtimePool.end();
  await installerPool.end();
  await closeServer(jwksServer);
});

describe('B6 migration and least-privilege runtime boundary', () => {
  it('applies exactly migrations 001 through 005 and reruns the immutable ledger', async () => {
    expect((await loadMigrations()).map(({ version }) => version)).toEqual([
      '001', '002', '003', '004', '005',
    ]);
    const ledger = await installerPool.query<{ version: string }>(
      `SELECT version FROM ${B3_MIGRATION_TABLE} ORDER BY version`,
    );
    expect(ledger.rows.map(({ version }) => version)).toEqual([
      '001', '002', '003', '004', '005',
    ]);
    await expect(migrate(installerPool)).resolves.toEqual({
      applied: [],
      alreadyApplied: ['001', '002', '003', '004', '005'],
    });
  });

  it('uses a non-owner NOINHERIT runtime login with exactly resolver and lifecycle parents', async () => {
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
      owned: string;
    }>(
      `SELECT runtime.rolname, runtime.rolsuper, runtime.rolinherit, runtime.rolcreaterole,
              runtime.rolcreatedb, runtime.rolcanlogin, runtime.rolreplication,
              runtime.rolbypassrls,
              ARRAY(
                SELECT parent.rolname::text
                FROM pg_catalog.pg_auth_members AS membership
                JOIN pg_catalog.pg_roles AS parent ON parent.oid = membership.roleid
                WHERE membership.member = runtime.oid
                ORDER BY parent.rolname
              )::text[] AS parent_roles,
              (SELECT count(*)::text
               FROM pg_catalog.pg_class AS relation
               JOIN pg_catalog.pg_namespace AS namespace
                 ON namespace.oid = relation.relnamespace
               WHERE relation.relowner = runtime.oid AND namespace.nspname = $2) AS owned
       FROM pg_catalog.pg_roles AS runtime
       WHERE runtime.rolname = $1`,
      [B6_RUNTIME_LOGIN, B3_SCHEMA],
    );
    expect(role.rows).toEqual([{
      rolname: B6_RUNTIME_LOGIN,
      rolsuper: false,
      rolinherit: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolcanlogin: true,
      rolreplication: false,
      rolbypassrls: false,
      parent_roles: [...B6_RUNTIME_ROLES],
      owned: '0',
    }]);
  });

  it('keeps the locking resolver fixed-path, execute-only and unavailable to PUBLIC', async () => {
    const result = await installerPool.query<{
      security_definer: boolean;
      volatility: string;
      configuration: string[] | null;
      public_execute: boolean;
      resolver_execute: boolean;
      table_grants: string;
    }>(
      `SELECT procedure.prosecdef AS security_definer,
              procedure.provolatile AS volatility,
              procedure.proconfig AS configuration,
              has_function_privilege('public', procedure.oid, 'EXECUTE') AS public_execute,
              has_function_privilege($1, procedure.oid, 'EXECUTE') AS resolver_execute,
              (SELECT count(*)::text FROM information_schema.role_table_grants
               WHERE grantee = $1) AS table_grants
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = $2 AND procedure.proname = 'lock_request_actor'`,
      [B6_IDENTITY_RESOLVER_ROLE, B3_SCHEMA],
    );
    expect(result.rows).toEqual([{
      security_definer: true,
      volatility: 'v',
      configuration: ['search_path=pg_catalog, taptime_server, pg_temp'],
      public_execute: false,
      resolver_execute: true,
      table_grants: '0',
    }]);
  });

  it('keeps the configuration lock helper fixed-path and executable only by lifecycle', async () => {
    const result = await installerPool.query<{
      security_definer: boolean;
      configuration: string[] | null;
      public_execute: boolean;
      lifecycle_execute: boolean;
      resolver_execute: boolean;
    }>(
      `SELECT procedure.prosecdef AS security_definer,
              procedure.proconfig AS configuration,
              has_function_privilege('public', procedure.oid, 'EXECUTE') AS public_execute,
              has_function_privilege($1, procedure.oid, 'EXECUTE') AS lifecycle_execute,
              has_function_privilege($2, procedure.oid, 'EXECUTE') AS resolver_execute
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
       WHERE namespace.nspname = $3 AND procedure.proname = 'lock_lifecycle_configuration'`,
      [B6_LIFECYCLE_ROLE, B6_IDENTITY_RESOLVER_ROLE, B3_SCHEMA],
    );
    expect(result.rows).toEqual([{
      security_definer: true,
      configuration: ['search_path=pg_catalog, taptime_server, pg_temp'],
      public_execute: false,
      lifecycle_execute: true,
      resolver_execute: false,
    }]);
  });

  it.each(['work_events', 'time_entries', 'canonical_decisions', 'sync_receipts', 'audit_events'])(
    'cannot read %s before selecting an application role',
    async (table) => {
      expect(await postgresErrorCode(runtimePool.query(
        `SELECT * FROM ${B3_SCHEMA}.${table} LIMIT 1`,
      ))).toBe('42501');
    },
  );

  it('cannot access tables after RESET ROLE or select Employee/Administrator authority', async () => {
    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${B6_LIFECYCLE_ROLE}`);
      await client.query('RESET ROLE');
      expect(await postgresErrorCode(client.query(
        `SELECT * FROM ${B3_SCHEMA}.work_events LIMIT 1`,
      ))).toBe('42501');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(await postgresErrorCode(runtimePool.query('SET ROLE taptime_employee'))).toBe('42501');
    expect(await postgresErrorCode(runtimePool.query('SET ROLE taptime_administrator'))).toBe('42501');
  });

  it('cannot create schema, alter policy ownership or bypass the fixed role graph', async () => {
    expect(await postgresErrorCode(runtimePool.query(
      'CREATE SCHEMA taptime_b6_forbidden',
    ))).toBe('42501');
    expect(await postgresErrorCode(runtimePool.query(
      `ALTER TABLE ${B3_SCHEMA}.work_events DISABLE ROW LEVEL SECURITY`,
    ))).toBe('42501');
    expect(await postgresErrorCode(runtimePool.query(
      `GRANT taptime_administrator TO ${B6_RUNTIME_LOGIN}`,
    ))).toBe('42501');
  });

  it.each(['customers', 'nfc_tags', 'nfc_assignments'])(
    'adds no direct lifecycle mutation grant for locked configuration table %s',
    async (table) => {
      const client = await runtimePool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL ROLE ${B6_LIFECYCLE_ROLE}`);
        await client.query(
          `SELECT set_config('app.organization_id', $1, true),
                  set_config('app.user_id', $2, true)`,
          [ids.organizationA, ids.userA],
        );
        const updateCode = await postgresErrorCode(client.query(
          `UPDATE ${B3_SCHEMA}.${table} SET id = id WHERE organization_id = $1`,
          [ids.organizationA],
        ));
        expect(updateCode).toBe('42501');
      } finally {
        await client.query('ROLLBACK').catch(() => undefined);
        client.release();
      }
    },
  );
});

describe('server-canonical Core decisions and exact relational mappings', () => {
  it('persists a genuine Core Start with exact WorkEvent, Decision, Receipt and Audit mapping', async () => {
    const input = await command({
      eventNumber: 10,
      receiptNumber: 10,
      clientTimeEntryId: uuid('6', 999),
    });
    const result = await coordinator.ingest(input);
    expect(result).toEqual({
      status: 'synchronized',
      idempotentRetry: false,
      decision: { status: 'time_entry_started', timeEntryId: expect.any(String) },
      workEventId: input.workEvent.id,
      receiptId: input.receipt.id,
      serverTimeEntryId: expect.any(String),
    });
    if (result.status !== 'synchronized') {
      throw new Error('Expected synchronized Start');
    }

    const persisted = await installerPool.query(
      `SELECT event.organization_id, event.triggered_by_user_id, event.assignment_id,
              event.nfc_tag_id, event.target_customer_id, event.occurred_at, event.received_at,
              event.content_hash, event.content_hash_algorithm, event.content_hash_version,
              entry.status, entry.started_at, entry.start_work_event_id,
              decision.decision_type, decision.time_entry_id, decision.decision_payload,
              receipt.status AS receipt_status, receipt.server_decision_work_event_id,
              receipt.client_time_entry_id, receipt.server_time_entry_id,
              audit.event_type, audit.payload AS audit_payload
       FROM ${B3_SCHEMA}.work_events AS event
       JOIN ${B3_SCHEMA}.time_entries AS entry ON entry.start_work_event_id = event.id
       JOIN ${B3_SCHEMA}.canonical_decisions AS decision ON decision.work_event_id = event.id
       JOIN ${B3_SCHEMA}.sync_receipts AS receipt ON receipt.work_event_id = event.id
       JOIN ${B3_SCHEMA}.audit_events AS audit ON audit.work_event_id = event.id
       WHERE event.id = $1`,
      [input.workEvent.id],
    );
    expect(persisted.rows[0]).toMatchObject({
      organization_id: ids.organizationA,
      triggered_by_user_id: ids.userA,
      assignment_id: ids.assignmentA,
      nfc_tag_id: ids.tagA,
      target_customer_id: ids.customerA,
      content_hash_algorithm: B3_CONTENT_HASH_ALGORITHM,
      content_hash_version: B3_CONTENT_HASH_VERSION,
      status: 'started',
      start_work_event_id: input.workEvent.id,
      decision_type: 'time_entry_started',
      time_entry_id: result.serverTimeEntryId,
      decision_payload: { status: 'time_entry_started' },
      receipt_status: 'synchronized',
      server_decision_work_event_id: input.workEvent.id,
      client_time_entry_id: input.receipt.clientTimeEntryId,
      server_time_entry_id: result.serverTimeEntryId,
      event_type: 'LifecycleEvaluated',
      audit_payload: { status: 'time_entry_started' },
    });
    expect(persisted.rows[0]?.occurred_at).toEqual(persisted.rows[0]?.started_at);
    expect(persisted.rows[0]?.received_at).not.toEqual(persisted.rows[0]?.occurred_at);
  });

  it('persists a genuine Core Stop and the exact reciprocal Stop WorkEvent mapping', async () => {
    const start = await command({ eventNumber: 20, receiptNumber: 20 });
    const started = await coordinator.ingest(start);
    const stop = await command({
      eventNumber: 21,
      receiptNumber: 21,
      occurredAt: '2026-07-13T08:00:05.000Z',
    });
    const stopped = await coordinator.ingest(stop);
    expect(stopped).toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_stopped' },
      serverTimeEntryId: started.status === 'synchronized' ? started.serverTimeEntryId : null,
    });
    const row = await installerPool.query(
      `SELECT entry.status, entry.start_work_event_id, entry.stop_work_event_id,
              entry.started_at, entry.stopped_at, entry.row_version,
              decision.decision_type, decision.time_entry_id,
              receipt.server_time_entry_id
       FROM ${B3_SCHEMA}.time_entries AS entry
       JOIN ${B3_SCHEMA}.canonical_decisions AS decision
         ON decision.work_event_id = entry.stop_work_event_id
       JOIN ${B3_SCHEMA}.sync_receipts AS receipt
         ON receipt.work_event_id = entry.stop_work_event_id`,
    );
    expect(row.rows[0]).toMatchObject({
      status: 'stopped',
      start_work_event_id: start.workEvent.id,
      stop_work_event_id: stop.workEvent.id,
      row_version: '2',
      decision_type: 'time_entry_stopped',
      time_entry_id: stopped.status === 'synchronized' ? stopped.serverTimeEntryId : null,
      server_time_entry_id: stopped.status === 'synchronized' ? stopped.serverTimeEntryId : null,
    });
    expect(row.rows[0]?.stopped_at.toISOString()).toBe('2026-07-13T08:00:05.000Z');
  });

  it('persists Duplicate without TimeEntry mutation or invented Receipt mapping', async () => {
    const start = await command({ eventNumber: 30, receiptNumber: 30 });
    const started = await coordinator.ingest(start);
    const duplicate = await command({
      eventNumber: 31,
      receiptNumber: 31,
      occurredAt: '2026-07-13T08:00:04.999Z',
    });
    const result = await coordinator.ingest(duplicate);
    expect(result).toEqual({
      status: 'synchronized',
      idempotentRetry: false,
      decision: {
        status: 'duplicate_scan_ignored',
        previousWorkEventId: start.workEvent.id,
      },
      workEventId: duplicate.workEvent.id,
      receiptId: duplicate.receipt.id,
      serverTimeEntryId: null,
    });
    const rows = await installerPool.query(
      `SELECT decision.previous_work_event_id, decision.time_entry_id,
              receipt.server_time_entry_id, entry.status
       FROM ${B3_SCHEMA}.canonical_decisions AS decision
       JOIN ${B3_SCHEMA}.sync_receipts AS receipt
         ON receipt.work_event_id = decision.work_event_id
       CROSS JOIN ${B3_SCHEMA}.time_entries AS entry
       WHERE decision.work_event_id = $1`,
      [duplicate.workEvent.id],
    );
    expect(rows.rows).toEqual([expect.objectContaining({
      previous_work_event_id: start.workEvent.id,
      time_entry_id: null,
      server_time_entry_id: null,
      status: 'started',
    })]);
    expect(started).toMatchObject({ status: 'synchronized' });
  });

  it('persists Other-Target rejection with the exact active TimeEntry and no mutation', async () => {
    const start = await coordinator.ingest(await command({ eventNumber: 40, receiptNumber: 40 }));
    const rejectedCommand = await command({
      eventNumber: 41,
      receiptNumber: 41,
      assignmentId: ids.otherAssignmentA,
      tagId: ids.otherTagA,
      customerId: ids.otherCustomerA,
      occurredAt: '2026-07-13T08:00:10.000Z',
    });
    const rejected = await coordinator.ingest(rejectedCommand);
    expect(rejected).toEqual({
      status: 'synchronized',
      idempotentRetry: false,
      decision: {
        status: 'active_entry_for_other_target_rejected',
        activeTimeEntryId: start.status === 'synchronized' ? start.serverTimeEntryId : null,
      },
      workEventId: rejectedCommand.workEvent.id,
      receiptId: rejectedCommand.receipt.id,
      serverTimeEntryId: start.status === 'synchronized' ? start.serverTimeEntryId : null,
    });
    const row = await installerPool.query(
      `SELECT entry.status, entry.target_customer_id, decision.active_time_entry_id,
              receipt.server_time_entry_id
       FROM ${B3_SCHEMA}.time_entries AS entry
       JOIN ${B3_SCHEMA}.canonical_decisions AS decision
         ON decision.active_time_entry_id = entry.id
       JOIN ${B3_SCHEMA}.sync_receipts AS receipt
         ON receipt.work_event_id = decision.work_event_id
       WHERE decision.work_event_id = $1`,
      [rejectedCommand.workEvent.id],
    );
    expect(row.rows).toEqual([expect.objectContaining({
      status: 'started',
      target_customer_id: ids.customerA,
      active_time_entry_id: start.status === 'synchronized' ? start.serverTimeEntryId : null,
      server_time_entry_id: start.status === 'synchronized' ? start.serverTimeEntryId : null,
    })]);
  });

  it('persists Escalation with the exact Core reason and no TimeEntry mutation', async () => {
    await coordinator.ingest(await command({
      eventNumber: 50,
      receiptNumber: 50,
      occurredAt: '2026-07-13T08:00:05.000Z',
    }));
    const escalationCommand = await command({
      eventNumber: 51,
      receiptNumber: 51,
      occurredAt: '2026-07-13T08:00:04.999Z',
    });
    const result = await coordinator.ingest(escalationCommand);
    expect(result).toEqual({
      status: 'synchronized',
      idempotentRetry: false,
      decision: {
        status: 'escalation_required',
        reason: 'work_event_precedes_active_time_entry',
      },
      workEventId: escalationCommand.workEvent.id,
      receiptId: escalationCommand.receipt.id,
      serverTimeEntryId: null,
    });
    const rows = await installerPool.query(
      `SELECT decision.reason, decision.time_entry_id, receipt.server_time_entry_id,
              audit.payload
       FROM ${B3_SCHEMA}.canonical_decisions AS decision
       JOIN ${B3_SCHEMA}.sync_receipts AS receipt
         ON receipt.work_event_id = decision.work_event_id
       JOIN ${B3_SCHEMA}.audit_events AS audit
         ON audit.work_event_id = decision.work_event_id
       WHERE decision.work_event_id = $1`,
      [escalationCommand.workEvent.id],
    );
    expect(rows.rows).toEqual([expect.objectContaining({
      reason: 'work_event_precedes_active_time_entry',
      time_entry_id: null,
      server_time_entry_id: null,
      payload: {
        status: 'escalation_required',
        reason: 'work_event_precedes_active_time_entry',
      },
    })]);
  });

  it('preserves ordered Start then Stop then Start as three separate commits', async () => {
    const first = await coordinator.ingest(await command({ eventNumber: 60, receiptNumber: 60 }));
    const second = await coordinator.ingest(await command({
      eventNumber: 61,
      receiptNumber: 61,
      occurredAt: '2026-07-13T08:00:05.000Z',
    }));
    const third = await coordinator.ingest(await command({
      eventNumber: 62,
      receiptNumber: 62,
      occurredAt: '2026-07-13T08:00:10.000Z',
    }));
    expect([first, second, third].map((result) =>
      result.status === 'synchronized' ? result.decision.status : result.status,
    )).toEqual(['time_entry_started', 'time_entry_stopped', 'time_entry_started']);
    const state = await installerPool.query<{ status: string; count: string }>(
      `SELECT status, count(*)::text AS count
       FROM ${B3_SCHEMA}.time_entries GROUP BY status ORDER BY status`,
    );
    expect(state.rows).toEqual([
      { status: 'started', count: '1' },
      { status: 'stopped', count: '1' },
    ]);
  });
});

describe('idempotency, canonical hash and append-only retries', () => {
  it('returns an identical retry without re-running Core or mutating TimeEntry', async () => {
    const input = await command({ eventNumber: 70, receiptNumber: 70 });
    let evaluations = 0;
    const first = await coordinator.ingest(input, undefined, {
      beforeEngineEvaluation: async () => { evaluations += 1; },
    });
    const retry = await coordinator.ingest(input, undefined, {
      beforeEngineEvaluation: async () => { evaluations += 1; },
    });
    expect(retry).toEqual({ ...first, idempotentRetry: true });
    expect(evaluations).toBe(1);
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 1,
      time_entries: 1,
      canonical_decisions: 1,
      sync_receipts: 1,
      audit_events: 1,
    });
  });

  it('allows a new attempt to append at most one exact Receipt without a new Decision or Audit', async () => {
    const original = await command({ eventNumber: 80, receiptNumber: 80 });
    const first = await coordinator.ingest(original);
    const nextAttempt: LifecycleIngestionCommand = {
      ...original,
      receipt: { id: uuid('6', 81), attemptNumber: 2 },
    };
    const second = await coordinator.ingest(nextAttempt);
    const repeated = await coordinator.ingest(nextAttempt);
    expect(second).toEqual({ ...first, idempotentRetry: true, receiptId: nextAttempt.receipt.id });
    expect(repeated).toEqual(second);
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 1,
      time_entries: 1,
      canonical_decisions: 1,
      sync_receipts: 2,
      audit_events: 1,
    });
  });

  it.each([
    ['same Receipt ID with a different attempt', { id: uuid('6', 90), attemptNumber: 2 }],
    ['same attempt with a different Receipt ID', { id: uuid('6', 91), attemptNumber: 1 }],
  ])('rejects %s as a disclosure-safe receipt conflict', async (_label, retryReceipt) => {
    const original = await command({ eventNumber: 90, receiptNumber: 90 });
    await coordinator.ingest(original);
    const result = await coordinator.ingest({ ...original, receipt: retryReceipt });
    expect(result).toEqual({ status: 'conflict', reason: 'receipt_metadata_conflict' });
    expect((await lifecycleCounts(installerPool)).sync_receipts).toBe(1);
  });

  it('rejects same WorkEvent ID with different canonical content and preserves every original row', async () => {
    const original = await command({ eventNumber: 100, receiptNumber: 100 });
    await coordinator.ingest(original);
    const before = await installerPool.query(
      `SELECT event.content_hash, entry.*, decision.*, receipt.*, audit.*
       FROM ${B3_SCHEMA}.work_events AS event
       JOIN ${B3_SCHEMA}.time_entries AS entry ON entry.start_work_event_id = event.id
       JOIN ${B3_SCHEMA}.canonical_decisions AS decision ON decision.work_event_id = event.id
       JOIN ${B3_SCHEMA}.sync_receipts AS receipt ON receipt.work_event_id = event.id
       JOIN ${B3_SCHEMA}.audit_events AS audit ON audit.work_event_id = event.id`,
    );
    const conflict = await coordinator.ingest({
      ...original,
      workEvent: {
        ...original.workEvent,
        occurredAt: createTimestamp('2026-07-13T08:00:01.000Z'),
      },
      receipt: { id: uuid('6', 101), attemptNumber: 2 },
    });
    expect(conflict).toEqual({ status: 'conflict', reason: 'work_event_content_conflict' });
    const after = await installerPool.query(
      `SELECT event.content_hash, entry.*, decision.*, receipt.*, audit.*
       FROM ${B3_SCHEMA}.work_events AS event
       JOIN ${B3_SCHEMA}.time_entries AS entry ON entry.start_work_event_id = event.id
       JOIN ${B3_SCHEMA}.canonical_decisions AS decision ON decision.work_event_id = event.id
       JOIN ${B3_SCHEMA}.sync_receipts AS receipt ON receipt.work_event_id = event.id
       JOIN ${B3_SCHEMA}.audit_events AS audit ON audit.work_event_id = event.id`,
    );
    expect(after.rows).toEqual(before.rows);
  });

  it('uses the unchanged B1/B3 canonical hash v1 golden vector', () => {
    const fields = {
      id: '50000000-0000-4000-8000-000000000001',
      organizationId: '00000000-0000-4000-8000-000000000001',
      assignmentId: '40000000-0000-4000-8000-000000000001',
      nfcTagId: '30000000-0000-4000-8000-000000000001',
      targetType: 'customer',
      targetId: '20000000-0000-4000-8000-000000000001',
      triggeredBy: '10000000-0000-4000-8000-000000000002',
      occurredAt: '2026-07-13T10:00:00+02:00',
    };
    expect(canonicalWorkEventContent(fields)).toBe(
      '["50000000-0000-4000-8000-000000000001",' +
      '"00000000-0000-4000-8000-000000000001",' +
      '"40000000-0000-4000-8000-000000000001",' +
      '"30000000-0000-4000-8000-000000000001",' +
      '"customer","20000000-0000-4000-8000-000000000001",' +
      '"10000000-0000-4000-8000-000000000002","2026-07-13T08:00:00.000Z"]',
    );
    expect(workEventContentHash(fields)).toBe(
      '4107ef70b8a57aff9dfa05cebaa04ddc77efa76ebf7088cb55b884c376e02048',
    );
  });
});

describe('atomic rollback and transaction-scoped serialization', () => {
  it.each<B6WriteStage>([
    'work_event',
    'time_entry',
    'canonical_decision',
    'sync_receipt',
    'audit_event',
  ])('rolls back completely after injected failure at %s', async (stage) => {
    const input = await command({ eventNumber: 110, receiptNumber: 110 });
    await expect(coordinator.ingest(input, undefined, { failAfter: stage })).rejects.toEqual(
      expect.objectContaining({ name: 'InjectedB6Failure', stage }),
    );
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 0,
      time_entries: 0,
      canonical_decisions: 0,
      sync_receipts: 0,
      audit_events: 0,
    });
  });

  it('preserves an active TimeEntry when a Stop transaction fails after its mutation', async () => {
    const start = await coordinator.ingest(await command({ eventNumber: 120, receiptNumber: 120 }));
    const stop = await command({
      eventNumber: 121,
      receiptNumber: 121,
      occurredAt: '2026-07-13T08:00:05.000Z',
    });
    await expect(coordinator.ingest(stop, undefined, { failAfter: 'time_entry' })).rejects.toBeInstanceOf(
      InjectedB6Failure,
    );
    const state = await installerPool.query(
      `SELECT id, status, stop_work_event_id, stopped_at, row_version
       FROM ${B3_SCHEMA}.time_entries`,
    );
    expect(state.rows).toEqual([{
      id: start.status === 'synchronized' ? start.serverTimeEntryId : null,
      status: 'started',
      stop_work_event_id: null,
      stopped_at: null,
      row_version: '1',
    }]);
    expect((await lifecycleCounts(installerPool)).work_events).toBe(1);
  });

  it('serializes concurrent scans for one User and never creates a second active TimeEntry', async () => {
    const locked = deferred();
    const release = deferred();
    const firstCommand = await command({ eventNumber: 130, receiptNumber: 130 });
    const secondCommand = await command({
      eventNumber: 131,
      receiptNumber: 131,
      occurredAt: '2026-07-13T08:00:05.000Z',
    });
    const first = coordinator.ingest(firstCommand, undefined, {
      afterAuthorityLocked: async () => {
        locked.resolve();
        await release.promise;
      },
    });
    await locked.promise;
    const second = coordinator.ingest(secondCommand);
    expect(await remainsPending(second)).toBe(true);
    release.resolve();
    const results = await Promise.all([first, second]);
    expect(results.map((result) =>
      result.status === 'synchronized' ? result.decision.status : result.status,
    )).toEqual(['time_entry_started', 'time_entry_stopped']);
    expect((await installerPool.query(
      `SELECT count(*)::text AS count FROM ${B3_SCHEMA}.time_entries WHERE status = 'started'`,
    )).rows[0]?.count).toBe('0');
  });

  it('keeps different Users independent on the same AssignmentTarget', async () => {
    const [userA, userA2] = await Promise.all([
      coordinator.ingest(await command({ eventNumber: 140, receiptNumber: 140 })),
      coordinator.ingest(await command({
        eventNumber: 141,
        receiptNumber: 141,
        subject: ids.subjectA2,
      })),
    ]);
    expect([userA, userA2].map((result) =>
      result.status === 'synchronized' ? result.decision.status : result.status,
    )).toEqual(['time_entry_started', 'time_entry_started']);
    const rows = await installerPool.query(
      `SELECT user_id, status FROM ${B3_SCHEMA}.time_entries ORDER BY user_id`,
    );
    expect(rows.rows).toEqual([
      { user_id: ids.userA, status: 'started' },
      { user_id: ids.userA2, status: 'started' },
    ]);
  });

  it('releases the advisory lock after rollback so the same command can succeed', async () => {
    const input = await command({ eventNumber: 150, receiptNumber: 150 });
    await expect(coordinator.ingest(input, undefined, { failAfter: 'work_event' })).rejects.toBeInstanceOf(
      InjectedB6Failure,
    );
    await expect(coordinator.ingest(input)).resolves.toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_started' },
    });
  });
});

describe('authority, tenant, User and configuration isolation', () => {
  it('rejects a requested Organization mismatch without lifecycle writes', async () => {
    const result = await coordinator.ingest(await command({
      eventNumber: 160,
      receiptNumber: 160,
      requestedOrganizationId: ids.organizationB,
    }));
    expect(result).toEqual({ status: 'rejected', reason: 'requested_organization_mismatch' });
    expect((await lifecycleCounts(installerPool)).work_events).toBe(0);
  });

  it('propagates JWKS infrastructure failure without writing lifecycle evidence', async () => {
    const unavailable = await startUnavailableJwksServer();
    const unavailableIssuer = new URL('/unavailable-b6/auth/v1', unavailable.origin).href;
    const unavailableVerifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
      issuer: unavailableIssuer,
      jwksUrl: new URL(`${unavailableIssuer}/.well-known/jwks.json`),
      allowedAlgorithms: ['RS256'],
    });
    const unavailableCoordinator = new ServerCanonicalLifecycleIngestionCoordinator(
      runtimePool,
      unavailableVerifier,
    );
    const before = await lifecycleCounts(installerPool);
    try {
      await expect(unavailableCoordinator.ingest(await command({
        eventNumber: 163,
        receiptNumber: 163,
        token: await accessToken({ issuer: unavailableIssuer }),
      }))).rejects.toBeInstanceOf(AccessTokenVerificationInfrastructureError);
      expect(await lifecycleCounts(installerPool)).toEqual(before);
    } finally {
      await closeServer(unavailable.server);
    }
  });

  it('ignores forged User, Organization, role, Decision and TimeEntry token claims', async () => {
    const input = await command({
      eventNumber: 161,
      receiptNumber: 161,
      claims: {
        app_metadata: {
          user_id: ids.userB,
          organization_id: ids.organizationB,
          role: 'administrator',
        },
        decision_type: 'time_entry_stopped',
        reason: 'forged',
        server_time_entry_id: uuid('6', 777),
      },
    });
    const result = await coordinator.ingest(input);
    expect(result).toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_started' },
    });
    const row = await installerPool.query(
      `SELECT organization_id, triggered_by_user_id FROM ${B3_SCHEMA}.work_events`,
    );
    expect(row.rows).toEqual([{
      organization_id: ids.organizationA,
      triggered_by_user_id: ids.userA,
    }]);
  });

  it('ignores runtime-injected command fields outside the closed B6 evidence contract', async () => {
    const authorized = await command({ eventNumber: 161, receiptNumber: 161 });
    const injected = Object.assign({}, authorized, {
      organizationId: ids.organizationB,
      triggeredBy: ids.userB,
      membershipRole: 'administrator',
      databaseRole: 'taptime_administrator',
      decisionType: 'time_entry_stopped',
      reason: 'forged',
      serverTimeEntryId: uuid('6', 778),
    });
    const result = await coordinator.ingest(injected);
    expect(result).toMatchObject({
      status: 'synchronized',
      decision: { status: 'time_entry_started' },
    });
    const row = await installerPool.query(
      `SELECT organization_id, triggered_by_user_id FROM ${B3_SCHEMA}.work_events`,
    );
    expect(row.rows).toEqual([{
      organization_id: ids.organizationA,
      triggered_by_user_id: ids.userA,
    }]);
  });

  it.each([
    ['invalid signature', async () => accessToken({ key: otherSigningKey }), 'access_token_rejected'],
    ['expired token', async () => accessToken({ expiresAt: 1 }), 'access_token_rejected'],
    ['unknown SQL-shaped subject', async () => accessToken({ subject: "unknown' OR 1=1 --" }),
      'identity_or_membership_unavailable'],
    ['unknown identity', async () => accessToken({ subject: ids.unknownSubject }),
      'identity_or_membership_unavailable'],
    ['revoked binding', async () => accessToken({ subject: ids.revokedBindingSubject }),
      'identity_or_membership_unavailable'],
    ['revoked Membership', async () => accessToken({ subject: ids.revokedMembershipSubject }),
      'identity_or_membership_unavailable'],
  ])('returns a generic typed rejection for %s', async (_label, tokenFactory, reason) => {
    const input = await command({
      eventNumber: 162,
      receiptNumber: 162,
      token: await tokenFactory(),
    });
    const result = await coordinator.ingest(input);
    expect(result).toMatchObject({ status: 'rejected', reason });
    expect((await lifecycleCounts(installerPool)).work_events).toBe(0);
  });

  it('does not reveal or use a Tenant B Assignment/Tag/Customer', async () => {
    const result = await coordinator.ingest(await command({
      eventNumber: 170,
      receiptNumber: 170,
      assignmentId: ids.assignmentB,
      tagId: ids.tagB,
      customerId: ids.customerB,
    }));
    expect(result).toEqual({
      status: 'deferred',
      evidenceStored: false,
      reason: 'configuration_unavailable_or_inactive',
    });
    expect((await lifecycleCounts(installerPool)).work_events).toBe(0);
  });

  it('does not reveal an existing foreign WorkEvent ID across tenants', async () => {
    const foreign = await command({
      eventNumber: 171,
      receiptNumber: 171,
      subject: ids.subjectB,
      requestedOrganizationId: ids.organizationB,
      assignmentId: ids.assignmentB,
      tagId: ids.tagB,
      customerId: ids.customerB,
    });
    await coordinator.ingest(foreign);
    const guessed = await command({ eventNumber: 171, receiptNumber: 172 });
    const result = await coordinator.ingest(guessed);
    expect(result).toEqual({ status: 'conflict', reason: 'work_event_content_conflict' });
    const count = await installerPool.query(
      `SELECT count(*)::text AS count FROM ${B3_SCHEMA}.work_events`,
    );
    expect(count.rows[0]?.count).toBe('1');
  });

  it('does not reveal an existing same-Organization WorkEvent owned by another User', async () => {
    await coordinator.ingest(await command({
      eventNumber: 173,
      receiptNumber: 173,
      subject: ids.subjectA2,
    }));
    const result = await coordinator.ingest(await command({
      eventNumber: 173,
      receiptNumber: 174,
    }));
    expect(result).toEqual({ status: 'conflict', reason: 'work_event_content_conflict' });
    expect((await lifecycleCounts(installerPool)).work_events).toBe(1);
  });

  it.each([
    ['Tag mismatch', { tagId: ids.otherTagA }],
    ['target mismatch', { customerId: ids.otherCustomerA }],
    ['foreign target', { customerId: ids.customerB }],
  ])('defers %s without rewriting client evidence or persisting false evidence', async (_label, mismatch) => {
    const result = await coordinator.ingest(await command({
      eventNumber: 180,
      receiptNumber: 180,
      ...mismatch,
    }));
    expect(result).toEqual({
      status: 'deferred',
      evidenceStored: false,
      reason: 'configuration_unavailable_or_inactive',
    });
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 0,
      time_entries: 0,
      canonical_decisions: 0,
      sync_receipts: 0,
      audit_events: 0,
    });
  });

  it('rejects invalid UUID and attempt metadata before any database write', async () => {
    const invalid = await command({ eventNumber: 181, receiptNumber: 181 });
    await expect(coordinator.ingest({
      ...invalid,
      receipt: { ...invalid.receipt, id: "x'); DROP SCHEMA taptime_server; --" },
    })).rejects.toThrow('Lifecycle identifiers must be UUIDs');
    await expect(coordinator.ingest({
      ...invalid,
      receipt: { ...invalid.receipt, attemptNumber: 0 },
    })).rejects.toThrow('positive safe integer');
    expect((await lifecycleCounts(installerPool)).work_events).toBe(0);
  });
});

describe('E2A Membership-bound defer-only lifecycle evidence', () => {
  it('atomically persists exact durable evidence without running Core or mutating TimeEntry',
    async () => {
      const input = await command({
        eventNumber: 182,
        receiptNumber: 182,
        clientTimeEntryId: uuid('6', 982),
      });
      let engineEvaluations = 0;
      const writes: B6WriteStage[] = [];
      const result = await coordinator.ingestDeferred(
        input,
        MembershipId(ids.membershipA),
        {
          beforeEngineEvaluation: async () => { engineEvaluations += 1; },
          afterWrite: async (stage) => { writes.push(stage); },
        },
      );

      expect(result).toEqual({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: false,
        workEventId: input.workEvent.id,
        receiptId: input.receipt.id,
      });
      expect(engineEvaluations).toBe(0);
      expect(writes).toEqual(['work_event', 'sync_receipt', 'audit_event']);
      expect(await lifecycleCounts(installerPool)).toEqual({
        work_events: 1,
        time_entries: 0,
        canonical_decisions: 0,
        sync_receipts: 1,
        audit_events: 1,
      });

      const persisted = await installerPool.query(
        `SELECT receipt.id, receipt.status, receipt.attempt_number,
                receipt.server_decision_work_event_id, receipt.client_time_entry_id,
                receipt.server_time_entry_id, audit.event_type, audit.payload
         FROM ${B3_SCHEMA}.sync_receipts AS receipt
         JOIN ${B3_SCHEMA}.audit_events AS audit
           ON audit.organization_id = receipt.organization_id
          AND audit.work_event_user_id = receipt.user_id
          AND audit.work_event_id = receipt.work_event_id
         WHERE receipt.work_event_id = $1`,
        [input.workEvent.id],
      );
      expect(persisted.rows).toEqual([{
        id: input.receipt.id,
        status: 'received',
        attempt_number: 1,
        server_decision_work_event_id: null,
        client_time_entry_id: input.receipt.clientTimeEntryId,
        server_time_entry_id: null,
        event_type: 'LifecycleDeferred',
        payload: { reason: 'cached_context_requires_review' },
      }]);
    });

  it('returns an exact idempotent durable acknowledgement without duplicate evidence', async () => {
    const input = await command({ eventNumber: 183, receiptNumber: 183 });
    const first = await coordinator.ingestDeferred(input, MembershipId(ids.membershipA));
    const retry = await coordinator.ingestDeferred(input, MembershipId(ids.membershipA));

    expect(retry).toEqual({ ...first, idempotentRetry: true });
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 1,
      time_entries: 0,
      canonical_decisions: 0,
      sync_receipts: 1,
      audit_events: 1,
    });
  });

  it('replays an exact durable acknowledgement after configuration deactivation', async () => {
    const input = await command({ eventNumber: 198, receiptNumber: 198 });
    const first = await coordinator.ingestDeferred(input, MembershipId(ids.membershipA));
    await installerPool.query(
      `UPDATE ${B3_SCHEMA}.nfc_assignments
       SET active = false, valid_to = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [ids.assignmentA],
    );

    await expect(coordinator.ingestDeferred(
      input,
      MembershipId(ids.membershipA),
    )).resolves.toEqual({ ...first, idempotentRetry: true });
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 1,
      time_entries: 0,
      canonical_decisions: 0,
      sync_receipts: 1,
      audit_events: 1,
    });
  });

  it('rejects the same attempt with another Receipt ID as an exact receipt conflict', async () => {
    const input = await command({ eventNumber: 184, receiptNumber: 184 });
    await coordinator.ingestDeferred(input, MembershipId(ids.membershipA));
    await expect(coordinator.ingestDeferred(
      { ...input, receipt: { id: uuid('6', 185), attemptNumber: 1 } },
      MembershipId(ids.membershipA),
    )).resolves.toEqual({ status: 'conflict', reason: 'receipt_metadata_conflict' });
    expect((await lifecycleCounts(installerPool)).sync_receipts).toBe(1);
  });

  it('rejects any defer-only attempt other than the fixed first attempt before persistence',
    async () => {
      const input = await command({ eventNumber: 185, receiptNumber: 185, attemptNumber: 2 });
      await expect(coordinator.ingestDeferred(
        input,
        MembershipId(ids.membershipA),
      )).rejects.toThrow('attemptNumber must be exactly 1');
      expect((await lifecycleCounts(installerPool)).work_events).toBe(0);
    });

  it('rejects changed content without altering the durable deferred evidence', async () => {
    const deferredInput = await command({ eventNumber: 186, receiptNumber: 186 });
    await coordinator.ingestDeferred(deferredInput, MembershipId(ids.membershipA));
    const changed = {
      ...deferredInput,
      workEvent: {
        ...deferredInput.workEvent,
        occurredAt: createTimestamp('2026-07-13T08:00:01.000Z'),
      },
      receipt: { id: uuid('6', 187), attemptNumber: 1 },
    };
    await expect(coordinator.ingestDeferred(
      changed,
      MembershipId(ids.membershipA),
    )).resolves.toEqual({ status: 'conflict', reason: 'work_event_content_conflict' });
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 1,
      time_entries: 0,
      canonical_decisions: 0,
      sync_receipts: 1,
      audit_events: 1,
    });
  });

  it('rejects an already-canonical WorkEvent without downgrading its Decision', async () => {
    const canonicalInput = await command({ eventNumber: 188, receiptNumber: 188 });
    await coordinator.ingest(canonicalInput);
    await expect(coordinator.ingestDeferred(
      canonicalInput,
      MembershipId(ids.membershipA),
    )).resolves.toEqual({ status: 'conflict', reason: 'receipt_metadata_conflict' });
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 1,
      time_entries: 1,
      canonical_decisions: 1,
      sync_receipts: 1,
      audit_events: 1,
    });
  });

  it('keeps a defer-only WorkEvent deferred when later submitted to the canonical path', async () => {
    const input = await command({ eventNumber: 189, receiptNumber: 189 });
    await coordinator.ingestDeferred(input, MembershipId(ids.membershipA));
    let engineEvaluations = 0;
    await expect(coordinator.ingest(input, MembershipId(ids.membershipA), {
      beforeEngineEvaluation: async () => { engineEvaluations += 1; },
    })).resolves.toEqual({
      status: 'deferred',
      evidenceStored: true,
      idempotentRetry: true,
      workEventId: input.workEvent.id,
      receiptId: input.receipt.id,
    });
    expect(engineEvaluations).toBe(0);
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 1,
      time_entries: 0,
      canonical_decisions: 0,
      sync_receipts: 1,
      audit_events: 1,
    });
  });

  it.each([
    [ids.inactiveAssignmentA, ids.inactiveTagA, ids.customerA],
    [ids.inactiveCustomerAssignmentA, ids.inactiveCustomerTagA, ids.inactiveCustomerA],
  ])('returns non-durable evidence for inactive current configuration',
    async (assignmentId, tagId, customerId) => {
      const input = await command({
        eventNumber: 193,
        receiptNumber: 193,
        assignmentId,
        tagId,
        customerId,
      });
      await expect(coordinator.ingestDeferred(
        input,
        MembershipId(ids.membershipA),
      )).resolves.toEqual({
        status: 'deferred',
        evidenceStored: false,
        reason: 'configuration_unavailable_or_inactive',
      });
      expect(await lifecycleCounts(installerPool)).toEqual({
        work_events: 0,
        time_entries: 0,
        canonical_decisions: 0,
        sync_receipts: 0,
        audit_events: 0,
      });
    });

  it.each([
    ['missing Assignment', { assignmentId: uuid('5', 999) }],
    ['mismatched Tag', { tagId: ids.otherTagA }],
    ['mismatched target', { customerId: ids.otherCustomerA }],
    ['foreign tenant mapping', {
      assignmentId: ids.assignmentB,
      tagId: ids.tagB,
      customerId: ids.customerB,
    }],
  ])('keeps defer-only %s non-durable with zero lifecycle writes', async (_label, mismatch) => {
    const input = await command({
      eventNumber: 199,
      receiptNumber: 199,
      ...mismatch,
    });
    await expect(coordinator.ingestDeferred(
      input,
      MembershipId(ids.membershipA),
    )).resolves.toEqual({
      status: 'deferred',
      evidenceStored: false,
      reason: 'configuration_unavailable_or_inactive',
    });
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 0,
      time_entries: 0,
      canonical_decisions: 0,
      sync_receipts: 0,
      audit_events: 0,
    });
  });

  it('uses active current configuration without inventing an event-time freshness policy', async () => {
    const input = await command({
      eventNumber: 194,
      receiptNumber: 194,
      assignmentId: ids.temporalAssignmentA,
      tagId: ids.temporalAssignmentTagA,
      customerId: ids.temporalAssignmentCustomerA,
      occurredAt: '2026-07-02T00:00:00.000Z',
    });
    await expect(coordinator.ingestDeferred(
      input,
      MembershipId(ids.membershipA),
    )).resolves.toEqual({
      status: 'deferred',
      evidenceStored: true,
      idempotentRetry: false,
      workEventId: input.workEvent.id,
      receiptId: input.receipt.id,
    });
    expect((await lifecycleCounts(installerPool)).canonical_decisions).toBe(0);
  });

  it('fails a missing, malformed, mismatched or replacement Membership closed', async () => {
    const input = await command({ eventNumber: 195, receiptNumber: 195 });
    await expect(coordinator.ingestDeferred(
      input,
      undefined as unknown as ReturnType<typeof MembershipId>,
    )).rejects.toThrow('requires an expected Membership ID');
    await expect(coordinator.ingestDeferred(
      input,
      MembershipId('not-a-uuid'),
    )).rejects.toThrow('Expected Membership ID must be a UUID');
    await expect(coordinator.ingestDeferred(
      input,
      MembershipId(ids.membershipA2),
    )).resolves.toEqual({ status: 'rejected', reason: 'identity_or_membership_unavailable' });

    await installerPool.query(
      `DELETE FROM ${B3_SCHEMA}.memberships WHERE id = $1`,
      [ids.membershipA],
    );
    await installerPool.query(
      `INSERT INTO ${B3_SCHEMA}.memberships
         (id, organization_id, user_id, role, created_at, revoked_at)
       VALUES ($1, $2, $3, 'employee', transaction_timestamp(), NULL)`,
      [uuid('6', 995), ids.organizationA, ids.userA],
    );
    await expect(coordinator.ingestDeferred(
      input,
      MembershipId(ids.membershipA),
    )).resolves.toEqual({ status: 'rejected', reason: 'identity_or_membership_unavailable' });
    expect((await lifecycleCounts(installerPool)).work_events).toBe(0);
  });

  it('lets the canonical path optionally narrow authority to the exact locked Membership',
    async () => {
      const rejectedInput = await command({ eventNumber: 196, receiptNumber: 196 });
      await expect(coordinator.ingest(
        rejectedInput,
        MembershipId(ids.membershipA2),
      )).resolves.toEqual({ status: 'rejected', reason: 'identity_or_membership_unavailable' });
      expect((await lifecycleCounts(installerPool)).work_events).toBe(0);

      await expect(coordinator.ingest(
        rejectedInput,
        MembershipId(ids.membershipA),
      )).resolves.toMatchObject({ status: 'synchronized' });
    });

  it.each<B6WriteStage>([
    'work_event',
    'sync_receipt',
    'audit_event',
  ])('rolls back all defer-only evidence after an injected %s failure', async (stage) => {
    const input = await command({ eventNumber: 197, receiptNumber: 197 });
    await expect(coordinator.ingestDeferred(
      input,
      MembershipId(ids.membershipA),
      { failAfter: stage },
    )).rejects.toEqual(expect.objectContaining({ name: 'InjectedB6Failure', stage }));
    expect(await lifecycleCounts(installerPool)).toEqual({
      work_events: 0,
      time_entries: 0,
      canonical_decisions: 0,
      sync_receipts: 0,
      audit_events: 0,
    });
  });
});

describe('deferred configuration and mutable-row race safety', () => {
  it.each([
    [ids.inactiveAssignmentA, ids.inactiveTagA, ids.customerA],
    [ids.inactiveCustomerAssignmentA, ids.inactiveCustomerTagA, ids.inactiveCustomerA],
  ])('stores WorkEvent, received Receipt and LifecycleDeferred Audit for inactive current configuration',
    async (assignmentId, tagId, customerId) => {
      const result = await coordinator.ingest(await command({
        eventNumber: 190,
        receiptNumber: 190,
        assignmentId,
        tagId,
        customerId,
      }));
      expect(result).toEqual({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: false,
        workEventId: uuid('5', 190),
        receiptId: uuid('6', 190),
      });
      expect(await lifecycleCounts(installerPool)).toEqual({
        work_events: 1,
        time_entries: 0,
        canonical_decisions: 0,
        sync_receipts: 1,
        audit_events: 1,
      });
      const audit = await installerPool.query(
        `SELECT audit.event_type, audit.payload, receipt.status AS receipt_status,
                receipt.server_decision_work_event_id, receipt.server_time_entry_id
         FROM ${B3_SCHEMA}.audit_events AS audit
         JOIN ${B3_SCHEMA}.sync_receipts AS receipt
           ON receipt.work_event_id = audit.work_event_id`,
      );
      expect(audit.rows).toEqual([{
        event_type: 'LifecycleDeferred',
        payload: { reason: 'current_configuration_inactive' },
        receipt_status: 'received',
        server_decision_work_event_id: null,
        server_time_entry_id: null,
      }]);
    });

  it.each([
    [
      'Assignment valid_from',
      ids.temporalAssignmentA,
      ids.temporalAssignmentTagA,
      ids.temporalAssignmentCustomerA,
    ],
    [
      'Tag created_at',
      ids.temporalTagAssignmentA,
      ids.temporalTagA,
      ids.temporalTagCustomerA,
    ],
    [
      'Customer activated_at',
      ids.temporalCustomerAssignmentA,
      ids.temporalCustomerTagA,
      ids.temporalCustomerA,
    ],
  ])('defers an active snapshot when occurredAt predates %s',
    async (_boundary, assignmentId, tagId, customerId) => {
      const result = await coordinator.ingest(await command({
        eventNumber: 191,
        receiptNumber: 191,
        assignmentId,
        tagId,
        customerId,
        occurredAt: '2026-07-02T00:00:00.000Z',
      }));
      expect(result).toEqual({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: false,
        workEventId: uuid('5', 191),
        receiptId: uuid('6', 191),
      });
      expect(await lifecycleCounts(installerPool)).toEqual({
        work_events: 1,
        time_entries: 0,
        canonical_decisions: 0,
        sync_receipts: 1,
        audit_events: 1,
      });
      const audit = await installerPool.query(
        `SELECT event_type, payload FROM ${B3_SCHEMA}.audit_events`,
      );
      expect(audit.rows).toEqual([{
        event_type: 'LifecycleDeferred',
        payload: { reason: 'configuration_not_valid_at_event_time' },
      }]);
    });

  it('keeps temporally invalid evidence deferred on retry without historical reinterpretation',
    async () => {
      const input = await command({
        eventNumber: 192,
        receiptNumber: 192,
        assignmentId: ids.temporalAssignmentA,
        tagId: ids.temporalAssignmentTagA,
        customerId: ids.temporalAssignmentCustomerA,
        occurredAt: '2026-07-02T00:00:00.000Z',
      });
      let evaluations = 0;
      const controls = {
        beforeEngineEvaluation: async () => { evaluations += 1; },
      };

      await expect(coordinator.ingest(input, undefined, controls)).resolves.toEqual({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: false,
        workEventId: input.workEvent.id,
        receiptId: input.receipt.id,
      });
      await expect(coordinator.ingest(input, undefined, controls)).resolves.toEqual({
        status: 'deferred',
        evidenceStored: true,
        idempotentRetry: true,
        workEventId: input.workEvent.id,
        receiptId: input.receipt.id,
      });
      expect(evaluations).toBe(0);
      expect(await lifecycleCounts(installerPool)).toEqual({
        work_events: 1,
        time_entries: 0,
        canonical_decisions: 0,
        sync_receipts: 1,
        audit_events: 1,
      });
    });

  it('holds the Membership lock through commit so concurrent revocation cannot race mutation', async () => {
    const locked = deferred();
    const release = deferred();
    const ingestion = coordinator.ingest(await command({ eventNumber: 200, receiptNumber: 200 }), undefined, {
      afterAuthorityLocked: async () => { locked.resolve(); await release.promise; },
    });
    await locked.promise;
    const revocation = installerPool.query(
      `UPDATE ${B3_SCHEMA}.memberships
       SET revoked_at = transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1`,
      [ids.membershipA],
    );
    expect(await remainsPending(revocation)).toBe(true);
    release.resolve();
    await expect(ingestion).resolves.toMatchObject({ status: 'synchronized' });
    await expect(revocation).resolves.toMatchObject({ rowCount: 1 });
  });

  it('holds the IdentityBinding lock through commit so concurrent revocation cannot race mutation', async () => {
    const locked = deferred();
    const release = deferred();
    const ingestion = coordinator.ingest(await command({ eventNumber: 201, receiptNumber: 201 }), undefined, {
      afterAuthorityLocked: async () => { locked.resolve(); await release.promise; },
    });
    await locked.promise;
    const revocation = installerPool.query(
      `UPDATE ${B3_SCHEMA}.identity_bindings
       SET revoked_at = transaction_timestamp()
       WHERE user_id = $1`,
      [ids.userA],
    );
    expect(await remainsPending(revocation)).toBe(true);
    release.resolve();
    await expect(ingestion).resolves.toMatchObject({ status: 'synchronized' });
    await expect(revocation).resolves.toMatchObject({ rowCount: 1 });
  });

  it.each([
    [
      'Assignment deactivation',
      () => installerPool.query(
        `UPDATE ${B3_SCHEMA}.nfc_assignments
         SET active = false, valid_to = transaction_timestamp(), row_version = row_version + 1
         WHERE id = $1`,
        [ids.assignmentA],
      ),
      'fulfilled',
    ],
    [
      'Customer deactivation',
      () => installerPool.query(
        `UPDATE ${B3_SCHEMA}.customers
         SET active = false, deactivated_at = transaction_timestamp(), row_version = row_version + 1
         WHERE id = $1`,
        [ids.customerA],
      ),
      'fulfilled',
    ],
    [
      'Tag deletion',
      () => installerPool.query(
        `DELETE FROM ${B3_SCHEMA}.nfc_tags WHERE id = $1`,
        [ids.tagA],
      ),
      'rejected',
    ],
  ] as const)('holds the configuration lock against concurrent %s',
    async (_label, mutate, expectedMutationStatus) => {
      const input = await command({ eventNumber: 202, receiptNumber: 202 });
      await expect(coordinator.ingest(input)).resolves.toMatchObject({ status: 'synchronized' });
      const locked = deferred();
      const release = deferred();
      const ingestion = coordinator.ingest(
        input,
        undefined,
        { afterConfigurationLocked: async () => { locked.resolve(); await release.promise; } },
      );
      await locked.promise;
      const mutation = mutate();
      expect(await remainsPending(mutation)).toBe(true);
      release.resolve();
      await expect(ingestion).resolves.toMatchObject({ status: 'synchronized' });
      expect((await Promise.allSettled([mutation]))[0]?.status).toBe(expectedMutationStatus);
    });
});

describe('pool cleanup, unnamed execution and error truth', () => {
  it('cleans fixed roles and every transaction-local context after commit', async () => {
    await coordinator.ingest(await command({ eventNumber: 210, receiptNumber: 210 }));
    expectCleanConnection(await pooledConnectionState());
  });

  it('cleans fixed roles and every transaction-local context after rollback', async () => {
    await expect(coordinator.ingest(
      await command({ eventNumber: 211, receiptNumber: 211 }),
      undefined,
      { failAfter: 'canonical_decision' },
    )).rejects.toBeInstanceOf(InjectedB6Failure);
    expectCleanConnection(await pooledConnectionState());
  });

  it('keeps the pool clean after verifier and authority rejections', async () => {
    await coordinator.ingest(await command({
      eventNumber: 212,
      receiptNumber: 212,
      token: await accessToken({ key: otherSigningKey }),
    }));
    await coordinator.ingest(await command({
      eventNumber: 213,
      receiptNumber: 213,
      subject: ids.unknownSubject,
    }));
    expectCleanConnection(await pooledConnectionState());
  });

  it('uses no named/prepared statement in the transaction-pool-compatible path', async () => {
    await coordinator.ingest(await command({ eventNumber: 214, receiptNumber: 214 }));
    const prepared = await runtimePool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM pg_catalog.pg_prepared_statements',
    );
    expect(prepared.rows[0]?.count).toBe('0');
  });

  it('throws PostgreSQL infrastructure failures instead of converting them to authorization', async () => {
    const brokenPool = new Pool({
      connectionString: 'postgresql://taptime_b6_lifecycle_test_login:synthetic@127.0.0.1:1/taptime_b6',
      connectionTimeoutMillis: 250,
      max: 1,
    });
    const brokenCoordinator = new ServerCanonicalLifecycleIngestionCoordinator(brokenPool, verifier);
    await expect(brokenCoordinator.ingest(await command({
      eventNumber: 215,
      receiptNumber: 215,
    }))).rejects.toThrow();
    await brokenPool.end();
  });
});
