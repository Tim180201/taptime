import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createNfcPayload } from '@taptime/core';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SupabaseEmailPasswordAuthAdapter } from '../../mobile/src/auth/SupabaseEmailPasswordAuthAdapter.js';
import {
  SYNTHETIC_ADMIN_AUTH_EMAIL,
  SYNTHETIC_AUTH_EMAIL,
  SYNTHETIC_DATABASE_NAME,
  SYNTHETIC_PUBLISHABLE_KEY,
  createSyntheticAndroidE2eEnvironment,
  fingerprint,
  parentRoles,
  runtimeLogins,
  syntheticIds,
  validateSyntheticInstallerDatabaseUrl,
  type SyntheticAndroidE2eEnvironment,
  type SyntheticEnvironmentSafeEvent,
} from '../src/index.js';

vi.mock('react-native-url-polyfill/auto', () => ({}));

const installerDatabaseUrl = process.env.TAPTIME_SYNTHETIC_E2E_DATABASE_URL;
const syntheticPassword = 'Synthetic-E2E-Password-Only!';

describe('synthetic E2E safety guards', () => {
  it('accepts only the exact dedicated database on numeric loopback', () => {
    expect(validateSyntheticInstallerDatabaseUrl(
      `postgresql://installer:test@127.0.0.1:5432/${SYNTHETIC_DATABASE_NAME}`,
    ).hostname).toBe('127.0.0.1');
    expect(() => validateSyntheticInstallerDatabaseUrl(
      `postgresql://installer:test@db.example/${SYNTHETIC_DATABASE_NAME}`,
    )).toThrow(/numeric-loopback/);
    expect(() => validateSyntheticInstallerDatabaseUrl(
      'postgresql://installer:test@127.0.0.1:5432/postgres',
    )).toThrow(/numeric-loopback/);
    expect(() => validateSyntheticInstallerDatabaseUrl(
      `postgresql://installer:test@localhost:5432/${SYNTHETIC_DATABASE_NAME}`,
    )).toThrow(/numeric-loopback/);
  });

  it('keeps Mobile lifecycle authority out of the client orchestration source', async () => {
    const orchestratorSource = await readFile(fileURLToPath(new URL(
      '../../mobile/src/scan/ProductScanOrchestrator.ts',
      import.meta.url,
    )), 'utf8');
    expect(orchestratorSource).not.toMatch(/BusinessEngine|activeTimeEntry|five.?second/i);
    expect(orchestratorSource).not.toMatch(/decision\s*=\s*['"](?:start|stop)/i);
  });
});

const describeWithPostgres = installerDatabaseUrl === undefined ? describe.skip : describe;

describeWithPostgres('synthetic Android product-to-server E2E', () => {
  let environment: SyntheticAndroidE2eEnvironment;
  let installerPool: Pool;
  const safeEvents: SyntheticEnvironmentSafeEvent[] = [];

  beforeAll(async () => {
    installerPool = new Pool({ connectionString: installerDatabaseUrl });
    environment = await createSyntheticAndroidE2eEnvironment({
      installerDatabaseUrl: installerDatabaseUrl as string,
      password: syntheticPassword,
      authPort: 0,
      apiPort: 0,
      onSafeEvent: (event) => safeEvents.push(event),
    });
    currentEnvironmentUrl = environment.apiBaseUrl;
  });

  afterAll(async () => {
    if (environment === undefined) {
      await installerPool?.end();
      currentEnvironmentUrl = '';
      return;
    }
    await environment?.close();
    const cleanup = await installerPool.query<{
      runtime_logins: string;
      schema_exists: boolean;
    }>(
      `SELECT
         count(*) FILTER (WHERE rolname = ANY($1::text[]))::text AS runtime_logins,
         to_regnamespace('taptime_server') IS NOT NULL AS schema_exists
       FROM pg_catalog.pg_roles`,
      [Object.values(runtimeLogins)],
    );
    expect(cleanup.rows).toEqual([{ runtime_logins: '0', schema_exists: false }]);
    await installerPool?.end();
    currentEnvironmentUrl = '';
  });

  it('uses exact least-privilege role graphs without inherited direct table access', async () => {
    await expect(parentRoles(installerPool, runtimeLogins.session)).resolves.toEqual([
      'taptime_identity_resolver',
    ]);
    await expect(parentRoles(installerPool, runtimeLogins.readModel)).resolves.toEqual([
      'taptime_administrator',
      'taptime_employee',
      'taptime_identity_resolver',
    ]);
    await expect(parentRoles(installerPool, runtimeLogins.lifecycle)).resolves.toEqual([
      'taptime_identity_resolver',
      'taptime_server_lifecycle',
    ]);
    await expect(parentRoles(installerPool, runtimeLogins.administration)).resolves.toEqual([
      'taptime_admin_setup',
      'taptime_identity_resolver',
    ]);
    await expect(parentRoles(installerPool, runtimeLogins.provisioner)).resolves.toEqual([
      'taptime_administrator',
    ]);

    const roles = await installerPool.query<{
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolinherit: boolean;
      rolname: string;
      rolsuper: boolean;
      direct_select: boolean;
    }>(
      `SELECT rolname, rolsuper, rolcreaterole, rolinherit, rolbypassrls,
              has_table_privilege(rolname, 'taptime_server.nfc_tags', 'SELECT') AS direct_select
       FROM pg_catalog.pg_roles
       WHERE rolname = ANY($1::text[])
       ORDER BY rolname`,
      [Object.values(runtimeLogins)],
    );
    expect(roles.rows).toHaveLength(5);
    expect(roles.rows.every((role) => (
      !role.rolsuper
      && !role.rolcreaterole
      && !role.rolinherit
      && !role.rolbypassrls
      && !role.direct_select
    ))).toBe(true);
  });

  it('authenticates through the real Mobile adapter and rotates a signed local session', async () => {
    const provider = mobileAuthAdapter(environment);
    await expect(provider.signInWithPassword(
      SYNTHETIC_AUTH_EMAIL,
      'not-the-synthetic-password',
    )).resolves.toEqual({ status: 'invalid_credentials' });

    const signIn = await provider.signInWithPassword(SYNTHETIC_AUTH_EMAIL, syntheticPassword);
    expect(signIn.status).toBe('authenticated');
    if (signIn.status !== 'authenticated') {
      throw new Error('Synthetic sign-in unexpectedly failed');
    }
    expect(signIn.tokens.accessToken.split('.')).toHaveLength(3);
    const sessionResponse = await fetch(`${environment.apiBaseUrl}/v1/session`, {
      headers: { authorization: `Bearer ${signIn.tokens.accessToken}` },
    });
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual({
      userId: syntheticIds.user,
      membershipId: syntheticIds.membership,
      organizationId: syntheticIds.organization,
      role: 'employee',
    });

    const refresh = await provider.refreshSession(signIn.tokens.refreshToken);
    expect(refresh.status).toBe('refreshed');
    if (refresh.status !== 'refreshed') {
      throw new Error('Synthetic refresh unexpectedly failed');
    }
    expect(refresh.tokens.accessToken).not.toBe(signIn.tokens.accessToken);
    expect(refresh.tokens.refreshToken).not.toBe(signIn.tokens.refreshToken);
  });

  it('resolves separate Employee and Administrator identities and denies Employee setup access',
    async () => {
      const provider = mobileAuthAdapter(environment);
      const employee = await provider.signInWithPassword(SYNTHETIC_AUTH_EMAIL, syntheticPassword);
      if (employee.status !== 'authenticated') {
        throw new Error('Synthetic Employee sign-in unexpectedly failed');
      }
      const employeeProjection = await postAdministration(
        employee.tokens.accessToken,
        '/v1/administration/setup-projection',
        { expectedMembershipId: syntheticIds.membership, cursor: null, limit: 20 },
      );
      expect(employeeProjection.status).toBe(403);

      const administrator = await provider.signInWithPassword(
        SYNTHETIC_ADMIN_AUTH_EMAIL,
        syntheticPassword,
      );
      if (administrator.status !== 'authenticated') {
        throw new Error('Synthetic Administrator sign-in unexpectedly failed');
      }
      const refreshedAdministrator = await provider.refreshSession(
        administrator.tokens.refreshToken,
      );
      expect(refreshedAdministrator.status).toBe('refreshed');
      if (refreshedAdministrator.status !== 'refreshed') {
        throw new Error('Synthetic Administrator refresh unexpectedly failed');
      }
      const sessionResponse = await fetch(`${environment.apiBaseUrl}/v1/session`, {
        headers: { authorization: `Bearer ${refreshedAdministrator.tokens.accessToken}` },
      });
      expect(sessionResponse.status).toBe(200);
      await expect(sessionResponse.json()).resolves.toEqual({
        userId: syntheticIds.administratorUser,
        membershipId: syntheticIds.administratorMembership,
        organizationId: syntheticIds.organization,
        role: 'administrator',
      });
      const projectionResponse = await postAdministration(
        refreshedAdministrator.tokens.accessToken,
        '/v1/administration/setup-projection',
        { expectedMembershipId: syntheticIds.administratorMembership, cursor: null, limit: 20 },
      );
      expect(projectionResponse.status).toBe(200);
      await expect(projectionResponse.json()).resolves.toMatchObject({
        status: 'succeeded',
        organization: { id: syntheticIds.organization, name: 'Synthetic Android E2E' },
        customers: [{ id: syntheticIds.customer, displayName: 'Synthetic Android Customer' }],
        nfcTags: [],
        nextCursor: null,
      });
    });

  it('allows browser Auth CORS only for the exact loopback Admin Web origin', async () => {
    const allowed = await fetch(`${environment.authBaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'apikey,content-type,x-client-info,x-supabase-api-version',
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
    expect(allowed.headers.get('access-control-allow-headers')).toBe(
      'apikey, authorization, content-type, x-client-info, x-supabase-api-version',
    );
    expect(allowed.headers.get('access-control-allow-credentials')).toBeNull();

    const signedIn = await fetch(
      `${environment.authBaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          origin: 'http://127.0.0.1:5173',
          apikey: SYNTHETIC_PUBLISHABLE_KEY,
          'content-type': 'application/json',
          'x-supabase-api-version': '2024-01-01',
        },
        body: JSON.stringify({
          email: SYNTHETIC_ADMIN_AUTH_EMAIL,
          password: syntheticPassword,
        }),
      },
    );
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
    expect(signedIn.headers.get('access-control-allow-credentials')).toBeNull();
    await expect(signedIn.json()).resolves.toMatchObject({
      token_type: 'bearer',
      user: { email: SYNTHETIC_ADMIN_AUTH_EMAIL },
    });

    const rejected = await fetch(`${environment.authBaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('proves unassigned B, fingerprint-bound A provisioning, Start, and Stop through C2/B6/Core',
    async () => {
      const provider = mobileAuthAdapter(environment);
      const signIn = await provider.signInWithPassword(SYNTHETIC_AUTH_EMAIL, syntheticPassword);
      if (signIn.status !== 'authenticated') {
        throw new Error('Synthetic sign-in unexpectedly failed');
      }
      const token = signIn.tokens.accessToken;
      const tagA = createNfcPayload('nfc:uid:v1:04A1B2C3');
      const tagB = createNfcPayload('nfc:uid:v1:04D4E5F6');

      expect((await resolveScanContext(token, tagB)).status).toBe(404);
      expect(await environment.evidenceCounts()).toMatchObject({
        nfcTags: 0,
        nfcAssignments: 0,
        workEvents: 0,
      });

      environment.armTagA(fingerprint(tagA));
      expect(environment.provisioningState()).toBe('armed');
      expect((await resolveScanContext(token, tagB)).status).toBe(404);
      expect(environment.provisioningState()).toBe('armed');

      const provisioningCapture = await resolveScanContext(token, tagA);
      expect(provisioningCapture.status).toBe(404);
      expect(environment.provisioningState()).toBe('disarmed');
      expect(await environment.evidenceCounts()).toEqual({
        adminSetupReceipts: 0,
        auditEvents: 2,
        canonicalDecisions: 0,
        customers: 1,
        nfcAssignments: 1,
        nfcTags: 1,
        stoppedTimeEntries: 0,
        syncReceipts: 0,
        timeEntries: 0,
        workEvents: 0,
      });
      const provisioningAudit = await installerPool.query<{
        actor_user_id: string;
        event_type: string;
      }>(
        `SELECT actor_user_id, event_type
         FROM taptime_server.audit_events
         ORDER BY event_type`,
      );
      expect(provisioningAudit.rows).toEqual([
        { actor_user_id: syntheticIds.administratorUser, event_type: 'NfcTagAssigned' },
        { actor_user_id: syntheticIds.administratorUser, event_type: 'NfcTagRegistered' },
      ]);
      const tagBRows = await installerPool.query<{ count: string }>(
        `SELECT count(*)::text AS count
         FROM taptime_server.nfc_tags
         WHERE payload_value = $1`,
        [tagB],
      );
      expect(tagBRows.rows).toEqual([{ count: '0' }]);

      const contextResponse = await resolveScanContext(token, tagA);
      expect(contextResponse.status).toBe(200);
      const context = await contextResponse.json() as {
        assignmentId: string;
        nfcTagId: string;
        target: { targetType: 'customer'; targetId: string };
      };
      expect(context).toEqual({
        assignmentId: syntheticIds.assignmentA,
        nfcTagId: syntheticIds.tagA,
        target: { targetType: 'customer', targetId: syntheticIds.customer },
      });

      const startedAt = new Date(Date.now() + 1_000);
      const start = lifecycleBody(context, startedAt, 1);
      const startResponse = await postLifecycle(token, start);
      expect(startResponse.status).toBe(200);
      const started = await startResponse.json() as Record<string, unknown>;
      expect(started).toMatchObject({
        status: 'synchronized',
        idempotentRetry: false,
        decision: { status: 'time_entry_started' },
        workEventId: start.workEvent.id,
        receiptId: start.receipt.id,
      });

      const stop = lifecycleBody(context, new Date(startedAt.getTime() + 6_000), 2);
      const stopResponse = await postLifecycle(token, stop);
      expect(stopResponse.status).toBe(200);
      const stopped = await stopResponse.json() as Record<string, unknown>;
      expect(stopped).toMatchObject({
        status: 'synchronized',
        idempotentRetry: false,
        decision: { status: 'time_entry_stopped' },
        workEventId: stop.workEvent.id,
        receiptId: stop.receipt.id,
        serverTimeEntryId: started.serverTimeEntryId,
      });

      expect(await environment.evidenceCounts()).toEqual({
        adminSetupReceipts: 0,
        auditEvents: 4,
        canonicalDecisions: 2,
        customers: 1,
        nfcAssignments: 1,
        nfcTags: 1,
        stoppedTimeEntries: 1,
        syncReceipts: 2,
        timeEntries: 1,
        workEvents: 2,
      });
      const trace = await installerPool.query<{
        decisions: string;
        receipts: string;
        status: string;
        start_matches: boolean;
        started_at: Date;
        stop_matches: boolean;
        stopped_at: Date;
      }>(
        `SELECT entry.status,
                entry.start_work_event_id = $2::uuid AS start_matches,
                entry.stop_work_event_id = $1::uuid AS stop_matches,
                entry.started_at,
                entry.stopped_at,
                (SELECT count(*)::text FROM taptime_server.canonical_decisions) AS decisions,
                (SELECT count(*)::text FROM taptime_server.sync_receipts) AS receipts
         FROM taptime_server.time_entries AS entry`,
        [stop.workEvent.id, start.workEvent.id],
      );
      expect(trace.rows).toEqual([{
        status: 'stopped',
        start_matches: true,
        stop_matches: true,
        started_at: startedAt,
        stopped_at: new Date(stop.workEvent.occurredAt),
        decisions: '2',
        receipts: '2',
      }]);

      expect(safeEvents).toEqual([
        'assignment_armed',
        'assignment_fingerprint_mismatch',
        'tag_a_assigned',
      ]);
      const diagnostics = JSON.stringify(safeEvents);
      expect(diagnostics).not.toContain(tagA);
      expect(diagnostics).not.toContain(tagB);
      expect(diagnostics).not.toContain(token);
    });

  it('stores defer-only evidence with no canonical Decision or TimeEntry mutation', async () => {
    const provider = mobileAuthAdapter(environment);
    const signIn = await provider.signInWithPassword(SYNTHETIC_AUTH_EMAIL, syntheticPassword);
    if (signIn.status !== 'authenticated') {
      throw new Error('Synthetic sign-in unexpectedly failed');
    }
    const tagA = createNfcPayload('nfc:uid:v1:04A1B2C3');
    let contextResponse = await resolveScanContext(signIn.tokens.accessToken, tagA);
    if (contextResponse.status === 404) {
      environment.armTagA(fingerprint(tagA));
      expect((await resolveScanContext(signIn.tokens.accessToken, tagA)).status).toBe(404);
      contextResponse = await resolveScanContext(signIn.tokens.accessToken, tagA);
    }
    expect(contextResponse.status).toBe(200);
    const context = await contextResponse.json() as {
      assignmentId: string;
      nfcTagId: string;
      target: { targetType: 'customer'; targetId: string };
    };
    const before = await environment.evidenceCounts();
    const evidence = lifecycleBody(context, new Date(Date.now() + 10_000), 3);

    const response = await postDeferredLifecycle(signIn.tokens.accessToken, evidence);
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      status: 'deferred',
      evidenceStored: true,
      idempotentRetry: false,
      workEventId: evidence.workEvent.id,
      receiptId: evidence.receipt.id,
    });
    const retry = await postDeferredLifecycle(signIn.tokens.accessToken, evidence);
    expect(retry.status).toBe(202);
    await expect(retry.json()).resolves.toMatchObject({
      status: 'deferred',
      evidenceStored: true,
      idempotentRetry: true,
    });

    expect(await environment.evidenceCounts()).toEqual({
      adminSetupReceipts: before.adminSetupReceipts,
      auditEvents: before.auditEvents + 1,
      canonicalDecisions: before.canonicalDecisions,
      customers: before.customers,
      nfcAssignments: before.nfcAssignments,
      nfcTags: before.nfcTags,
      stoppedTimeEntries: before.stoppedTimeEntries,
      syncReceipts: before.syncReceipts + 1,
      timeEntries: before.timeEntries,
      workEvents: before.workEvents + 1,
    });
    const stored = await installerPool.query<{
      decision_count: string;
      receipt_status: string;
      time_entry_count: string;
    }>(
      `SELECT receipt.status AS receipt_status,
              (SELECT count(*)::text FROM taptime_server.canonical_decisions
               WHERE work_event_id = $1::uuid) AS decision_count,
              (SELECT count(*)::text FROM taptime_server.time_entries
               WHERE start_work_event_id = $1::uuid OR stop_work_event_id = $1::uuid)
                AS time_entry_count
       FROM taptime_server.sync_receipts AS receipt
       WHERE receipt.work_event_id = $1::uuid`,
      [evidence.workEvent.id],
    );
    expect(stored.rows).toEqual([{
      receipt_status: 'received',
      decision_count: '0',
      time_entry_count: '0',
    }]);
  });

  it('runs real C3C Customer creation and atomic Tag provisioning with disclosure-safe results',
    async () => {
      const provider = mobileAuthAdapter(environment);
      const signIn = await provider.signInWithPassword(
        SYNTHETIC_ADMIN_AUTH_EMAIL,
        syntheticPassword,
      );
      if (signIn.status !== 'authenticated') {
        throw new Error('Synthetic Administrator sign-in unexpectedly failed');
      }
      const token = signIn.tokens.accessToken;
      const before = await environment.evidenceCounts();
      const createResponse = await postAdministration(
        token,
        '/v1/administration/customers',
        {
          expectedMembershipId: syntheticIds.administratorMembership,
          commandId: '70000000-0000-4000-8000-000000000001',
          displayName: 'C3D Physical Gate Customer',
        },
      );
      expect(createResponse.status).toBe(200);
      const created = await createResponse.json() as {
        customer: { id: string; displayName: string; active: boolean };
        idempotentRetry: boolean;
        status: string;
      };
      expect(created).toMatchObject({
        status: 'succeeded',
        idempotentRetry: false,
        customer: { displayName: 'C3D Physical Gate Customer', active: true },
      });

      const payload = createNfcPayload('nfc:uid:v1:04C3D701');
      const provisionResponse = await postAdministration(
        token,
        '/v1/administration/nfc-tags/provision',
        {
          expectedMembershipId: syntheticIds.administratorMembership,
          commandId: '70000000-0000-4000-8000-000000000002',
          customerId: created.customer.id,
          displayName: 'C3D Physical Gate Tag',
          canonicalPayload: payload,
        },
      );
      expect(provisionResponse.status).toBe(200);
      const provisionedText = await provisionResponse.text();
      expect(provisionedText).not.toContain(payload);
      const provisioned = JSON.parse(provisionedText) as Record<string, unknown>;
      expect(provisioned).toMatchObject({
        status: 'succeeded',
        idempotentRetry: false,
        nfcTag: {
          displayName: 'C3D Physical Gate Tag',
          assignmentState: 'assigned',
          targetCustomerId: created.customer.id,
        },
      });

      const projectionResponse = await postAdministration(
        token,
        '/v1/administration/setup-projection',
        { expectedMembershipId: syntheticIds.administratorMembership, cursor: null, limit: 20 },
      );
      expect(projectionResponse.status).toBe(200);
      const projectionText = await projectionResponse.text();
      expect(projectionText).not.toContain(payload);
      expect(JSON.parse(projectionText)).toMatchObject({
        status: 'succeeded',
        customers: expect.arrayContaining([
          expect.objectContaining({ id: created.customer.id, displayName: 'C3D Physical Gate Customer' }),
        ]),
        nfcTags: expect.arrayContaining([
          expect.objectContaining({
            displayName: 'C3D Physical Gate Tag',
            assignmentState: 'assigned',
            targetCustomerId: created.customer.id,
          }),
        ]),
      });

      expect(await environment.evidenceCounts()).toEqual({
        adminSetupReceipts: before.adminSetupReceipts + 2,
        auditEvents: before.auditEvents + 3,
        canonicalDecisions: before.canonicalDecisions,
        customers: before.customers + 1,
        nfcAssignments: before.nfcAssignments + 1,
        nfcTags: before.nfcTags + 1,
        stoppedTimeEntries: before.stoppedTimeEntries,
        syncReceipts: before.syncReceipts,
        timeEntries: before.timeEntries,
        workEvents: before.workEvents,
      });
      expect(JSON.stringify(safeEvents)).not.toContain(payload);
      expect(safeEvents).not.toContain('api_administration_unavailable');
    });
});

function mobileAuthAdapter(environment: SyntheticAndroidE2eEnvironment) {
  const client = createClient(environment.authBaseUrl, SYNTHETIC_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return new SupabaseEmailPasswordAuthAdapter(client.auth);
}

function resolveScanContext(accessToken: string, payload: string): Promise<Response> {
  return fetch(`${environmentUrl()}/v1/scan-context/resolve`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ organizationId: syntheticIds.organization, payload }),
  });
}

let currentEnvironmentUrl = '';

function environmentUrl(): string {
  if (currentEnvironmentUrl.length === 0) {
    throw new Error('Synthetic E2E API URL is unavailable');
  }
  return currentEnvironmentUrl;
}

function lifecycleBody(
  context: {
    assignmentId: string;
    nfcTagId: string;
    target: { targetType: 'customer'; targetId: string };
  },
  occurredAt: Date,
  sequence: number,
) {
  return {
    organizationId: syntheticIds.organization,
    workEvent: {
      id: uuid('5', sequence),
      assignmentId: context.assignmentId,
      nfcTagId: context.nfcTagId,
      target: context.target,
      occurredAt: occurredAt.toISOString(),
    },
    receipt: { id: uuid('6', sequence), attemptNumber: 1 },
  };
}

function postLifecycle(accessToken: string, body: unknown): Promise<Response> {
  return fetch(`${environmentUrl()}/v1/lifecycle-events`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function postDeferredLifecycle(accessToken: string, body: unknown): Promise<Response> {
  return fetch(`${environmentUrl()}/v1/lifecycle-events/deferred`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-taptime-expected-membership-id': syntheticIds.membership,
    },
    body: JSON.stringify(body),
  });
}

function postAdministration(
  accessToken: string,
  path: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${environmentUrl()}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function uuid(prefix: '5' | '6', sequence: number): string {
  return `${prefix}0000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`;
}
