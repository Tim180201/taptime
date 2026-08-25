import { createServer, type Server } from 'node:http';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { SupabaseJwtAccessTokenVerifier } from '@taptime/backend-identity';
import {
  ServerCanonicalLifecycleIngestionCoordinator,
  type LifecycleIngestionCommand,
} from '@taptime/backend-lifecycle';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '@taptime/backend-schema';
import {
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import type {
  OfflineCaptureLeasePage,
  OfflineCaptureLeasePageV2,
  OfflineCaptureLeasePageV3,
  OfflineLifecycleEventCommand,
  OfflineLifecycleEventCommandV2,
  OfflineLifecycleEventCommandV3,
} from '@taptime/offline-sync-contract';
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
  OfflineCaptureLeaseCoordinator,
  OfflineEventReconciliationCoordinator,
  OfflineLifecycleIngestionCoordinator,
  offlineLookupHmac,
} from '../src/index.js';

const installerConnectionString = process.env.OFFLINE_SYNC_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_offline_sync';
const runtimePassword = 'offline-synthetic';
const leaseLogin = 'taptime_offline_lease_test_login';
const eventLogin = 'taptime_offline_event_test_login';
const reconciliationLogin = 'taptime_offline_reconciliation_test_login';
const canonicalLogin = 'taptime_offline_canonical_test_login';
const eventApplicationName = 'taptime-offline-event-test';
const canonicalKeyId = 'offline-cross-route-rs256';
const canonicalSessionId = '90000000-0000-4000-8000-000000000011';

const ids = {
  user: '10000000-0000-4000-8000-000000000011',
  binding: '11000000-0000-4000-8000-000000000011',
  organization: '00000000-0000-4000-8000-000000000011',
  membership: '12000000-0000-4000-8000-000000000011',
  customer: '20000000-0000-4000-8000-000000000011',
  tag: '30000000-0000-4000-8000-000000000011',
  assignment: '40000000-0000-4000-8000-000000000011',
  leaseCommand: '81000000-0000-4000-8000-000000000011',
  event1: '50000000-0000-4000-8000-000000000011',
  receipt1: '65000000-0000-4000-8000-000000000011',
  event2: '50000000-0000-4000-8000-000000000012',
  receipt2: '65000000-0000-4000-8000-000000000012',
  event3: '50000000-0000-4000-8000-000000000013',
  receipt3: '65000000-0000-4000-8000-000000000013',
  event4: '50000000-0000-4000-8000-000000000014',
  receipt4: '65000000-0000-4000-8000-000000000014',
  project: '20000000-0000-4000-8000-000000000012',
  leaseCommandV2: '81000000-0000-4000-8000-000000000012',
  leaseCommandV3: '81000000-0000-4000-8000-000000000013',
} as const;

let issuer: string;
const subject = 'offline-employee';
const canonicalPayload = 'nfc:uid:v1:04AABBCC';
const installationBinding = Buffer.alloc(32, 0x11).toString('base64url');
const lookupKey = Buffer.alloc(32, 0x22).toString('base64url');
const verifier: AccessTokenVerifier = {
  async verify(accessToken) {
    return accessToken === 'valid'
      ? { status: 'verified', identity: { issuer, subject } }
      : { status: 'rejected', reason: 'invalid_signature' };
  },
};

const installerPool = new Pool({ connectionString: installerConnectionString, max: 3 });
let leasePool: Pool;
let eventPool: Pool;
let reconciliationPool: Pool;
let canonicalPool: Pool;
let leaseCoordinator: OfflineCaptureLeaseCoordinator;
let eventCoordinator: OfflineLifecycleIngestionCoordinator;
let reconciliationCoordinator: OfflineEventReconciliationCoordinator;
let canonicalCoordinator: ServerCanonicalLifecycleIngestionCoordinator;
let canonicalSigningKey: CryptoKey;
let canonicalJwksServer: Server;

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256');
  canonicalSigningKey = keyPair.privateKey;
  const jwksInfrastructure = await startJwksServer(await exportJWK(keyPair.publicKey));
  canonicalJwksServer = jwksInfrastructure.server;
  issuer = new URL('/offline-cross-route/auth/v1', jwksInfrastructure.origin).href;

  await installerPool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await installerPool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(installerPool);
  await ensureLogin(leaseLogin, ['taptime_offline_lease_issuer']);
  await ensureLogin(eventLogin, ['taptime_offline_event_ingestor']);
  await ensureLogin(reconciliationLogin, ['taptime_offline_reconciliation_reader']);
  await ensureLogin(canonicalLogin, [
    'taptime_identity_resolver',
    'taptime_server_lifecycle',
  ]);
  leasePool = new Pool({
    connectionString: runtimeConnectionString(leaseLogin),
    max: 2,
  });
  eventPool = new Pool({
    connectionString: runtimeConnectionString(eventLogin),
    application_name: eventApplicationName,
    max: 2,
  });
  reconciliationPool = new Pool({
    connectionString: runtimeConnectionString(reconciliationLogin),
    max: 2,
  });
  canonicalPool = new Pool({
    connectionString: runtimeConnectionString(canonicalLogin),
    application_name: 'taptime-offline-canonical-test',
    max: 2,
  });
  leaseCoordinator = new OfflineCaptureLeaseCoordinator(leasePool, verifier);
  eventCoordinator = new OfflineLifecycleIngestionCoordinator(eventPool, verifier);
  reconciliationCoordinator = new OfflineEventReconciliationCoordinator(
    reconciliationPool,
    verifier,
  );
  const canonicalVerifier = SupabaseJwtAccessTokenVerifier.fromRemoteJwks({
    issuer,
    jwksUrl: new URL(`${issuer}/.well-known/jwks.json`),
    allowedAlgorithms: ['RS256'],
  });
  canonicalCoordinator = new ServerCanonicalLifecycleIngestionCoordinator(
    canonicalPool,
    canonicalVerifier,
  );
});

beforeEach(async () => {
  await installerPool.query(`
    TRUNCATE TABLE
      taptime_server.offline_event_reconciliations,
      taptime_server.offline_sync_cursors,
      taptime_server.offline_capture_lease_receipts,
      taptime_server.offline_capture_lease_items,
      taptime_server.offline_capture_leases,
      taptime_server.offline_installations,
      taptime_server.audit_events,
      taptime_server.sync_receipts,
      taptime_server.canonical_decisions,
      taptime_server.time_entries,
      taptime_server.work_events,
      taptime_server.nfc_assignments,
      taptime_server.nfc_tags,
      taptime_server.customers,
      taptime_server.memberships,
      taptime_server.identity_bindings,
      taptime_server.organizations,
      taptime_server.users
    CASCADE
  `);
  await installerPool.query(
    `INSERT INTO taptime_server.users (id) VALUES ($1::uuid)`,
    [ids.user],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.identity_bindings (id, user_id, issuer, subject)
     VALUES ($1::uuid, $2::uuid, $3, $4)`,
    [ids.binding, ids.user, issuer, subject],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.organizations (id, name)
     VALUES ($1::uuid, 'Offline Synthetic')`,
    [ids.organization],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.memberships (
       id, organization_id, user_id, role, created_at, created_by_user_id, display_name
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, 'employee', '2026-07-18T00:00:00Z',
       $3::uuid, 'Offline Employee'
     )`,
    [ids.membership, ids.organization, ids.user],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.customers (
       id, organization_id, display_name, active, activated_at
     ) VALUES (
       $1::uuid, $2::uuid, 'Offline Customer', true, '2026-07-18T00:00:00Z'
     )`,
    [ids.customer, ids.organization],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.nfc_tags (
       id, organization_id, display_name, payload_value
     ) VALUES ($1::uuid, $2::uuid, 'Offline Tag', $3)`,
    [ids.tag, ids.organization, canonicalPayload],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.nfc_assignments (
       id, organization_id, nfc_tag_id, target_type, target_customer_id,
       active, valid_from
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, 'customer', $4::uuid, true,
       '2026-07-18T00:00:00Z'
     )`,
    [ids.assignment, ids.organization, ids.tag, ids.customer],
  );
});

afterAll(async () => {
  await Promise.all([
    leasePool?.end(),
    eventPool?.end(),
    reconciliationPool?.end(),
    canonicalPool?.end(),
  ]);
  await closeServer(canonicalJwksServer);
  await installerPool.end();
});

describe('complete offline PostgreSQL boundary', () => {
  it('issues an exact immutable lease and returns the same lease on an exact command retry', async () => {
    const first = await issueLease();
    expect(first.itemCount).toBe(1);
    expect(first.items).toEqual([
      expect.objectContaining({
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
        targetId: ids.customer,
        displayName: 'Offline Customer',
        lookup: offlineLookupHmac(Buffer.from(lookupKey, 'base64url'), canonicalPayload),
      }),
    ]);

    const retry = await leaseCoordinator.issue({
      accessToken: 'valid',
      command: {
        commandId: ids.leaseCommand,
        installationBinding,
        lookupKey,
      },
    });
    expect(retry).toMatchObject({
      status: 'ready',
      idempotentRetry: true,
      page: { leaseId: first.leaseId },
    });

    const conflict = await leaseCoordinator.issue({
      accessToken: 'valid',
      command: {
        commandId: ids.leaseCommand,
        installationBinding,
        lookupKey: Buffer.alloc(32, 0x23).toString('base64url'),
      },
    });
    expect(conflict).toEqual({ status: 'unavailable' });

    const keyCounts = await installerPool.query<{
      installations: string;
      leases: string;
      items: string;
      receipts: string;
    }>(`
      SELECT
        (SELECT count(*) FROM taptime_server.offline_installations) AS installations,
        (SELECT count(*) FROM taptime_server.offline_capture_leases) AS leases,
        (SELECT count(*) FROM taptime_server.offline_capture_lease_items) AS items,
        (SELECT count(*) FROM taptime_server.offline_capture_lease_receipts) AS receipts
    `);
    expect(keyCounts.rows[0]).toEqual({
      installations: '1',
      leases: '1',
      items: '1',
      receipts: '1',
    });
    const forbidden = await installerPool.query<{ raw_key_count: string }>(`
      SELECT count(*) AS raw_key_count
      FROM information_schema.columns
      WHERE table_schema = 'taptime_server'
        AND table_name LIKE 'offline_%'
        AND column_name IN ('lookup_key', 'installation_binding', 'raw_uid', 'access_token')
    `);
    expect(forbidden.rows[0]?.raw_key_count).toBe('0');
  });

  it('persists first, evaluates through Core, retries exactly and reconciles by exact ID', async () => {
    const lease = await issueLease();
    const item = lease.items[0]!;
    const occurredAt = new Date(Date.parse(lease.issuedAt) + 1_000).toISOString();
    const event = eventCommand(lease, item.itemId, ids.event1, ids.receipt1, 1, occurredAt);
    const first = await eventCoordinator.ingest({ accessToken: 'valid', command: event });
    expect(first).toMatchObject({
      status: 'synchronized',
      idempotentRetry: false,
      workEventId: ids.event1,
      receiptId: ids.receipt1,
      deviceSequence: 1,
      decision: { status: 'time_entry_started' },
    });

    const retry = await eventCoordinator.ingest({ accessToken: 'valid', command: event });
    expect(retry).toMatchObject({
      status: 'synchronized',
      idempotentRetry: true,
      workEventId: ids.event1,
      receiptId: ids.receipt1,
      deviceSequence: 1,
    });

    const gap = eventCommand(
      lease,
      item.itemId,
      ids.event2,
      ids.receipt2,
      3,
      new Date(Date.parse(occurredAt) + 6_000).toISOString(),
    );
    await expect(eventCoordinator.ingest({ accessToken: 'valid', command: gap }))
      .resolves.toEqual({ status: 'pending', reason: 'sequence_gap' });

    const reconciliation = await reconciliationCoordinator.reconcile({
      accessToken: 'valid',
      command: { workEventIds: [ids.event1] },
    });
    expect(reconciliation).toMatchObject({
      status: 'ready',
      records: [{
        workEventId: ids.event1,
        receiptId: ids.receipt1,
        deviceSequence: 1,
        result: { status: 'synchronized', decision: { status: 'time_entry_started' } },
      }],
    });
    await expect(reconciliationCoordinator.readReviewState({
      accessToken: 'valid',
      request: {
        expectedMembershipId: ids.membership,
        installationId: lease.installationId,
      },
    })).resolves.toEqual({
      status: 'ready',
      value: {
        status: 'clear', expectedMembershipId: ids.membership,
        installationId: lease.installationId, confirmedThroughSequence: 1,
      },
    });
    await expect(reconciliationCoordinator.readReviewState({
      accessToken: 'valid',
      request: {
        expectedMembershipId: ids.membership,
        installationId: '99000000-0000-4000-8000-000000000099',
      },
    })).resolves.toEqual({ status: 'authority_rejected' });

    const counts = await installerPool.query<{
      events: string;
      receipts: string;
      decisions: string;
      entries: string;
      reconciliations: string;
    }>(`
      SELECT
        (SELECT count(*) FROM taptime_server.work_events) AS events,
        (SELECT count(*) FROM taptime_server.sync_receipts) AS receipts,
        (SELECT count(*) FROM taptime_server.canonical_decisions) AS decisions,
        (SELECT count(*) FROM taptime_server.time_entries) AS entries,
        (SELECT count(*) FROM taptime_server.offline_event_reconciliations) AS reconciliations
    `);
    expect(counts.rows[0]).toEqual({
      events: '1',
      receipts: '1',
      decisions: '1',
      entries: '1',
      reconciliations: '1',
    });
  });

  it('routes an Engine escalation to review without blocking the next device event', async () => {
    const lease = await issueLease();
    const item = lease.items[0]!;
    const startedAt = new Date(Date.parse(lease.issuedAt) + 5_000).toISOString();
    const escalationAt = new Date(Date.parse(startedAt) - 1).toISOString();
    const stoppedAt = new Date(Date.parse(startedAt) + 5_000).toISOString();

    await expect(eventCoordinator.ingest({
      accessToken: 'valid',
      command: eventCommand(lease, item.itemId, ids.event1, ids.receipt1, 1, startedAt),
    })).resolves.toMatchObject({
      status: 'synchronized', decision: { status: 'time_entry_started' },
    });

    const escalation = eventCommand(
      lease, item.itemId, ids.event2, ids.receipt2, 2, escalationAt,
    );
    await expect(eventCoordinator.ingest({ accessToken: 'valid', command: escalation }))
      .resolves.toMatchObject({
        status: 'synchronized',
        decision: {
          status: 'escalation_required',
          reason: 'work_event_precedes_active_time_entry',
        },
      });
    await expect(eventCoordinator.ingest({ accessToken: 'valid', command: escalation }))
      .resolves.toMatchObject({
        status: 'synchronized', idempotentRetry: true,
        decision: { status: 'escalation_required' },
      });

    await expect(eventCoordinator.ingest({
      accessToken: 'valid',
      command: eventCommand(lease, item.itemId, ids.event3, ids.receipt3, 3, stoppedAt),
    })).resolves.toMatchObject({
      status: 'synchronized', decision: { status: 'time_entry_stopped' },
    });

    await expect(reconciliationCoordinator.reconcile({
      accessToken: 'valid', command: { workEventIds: [ids.event2] },
    })).resolves.toMatchObject({
      status: 'ready',
      records: [{
        workEventId: ids.event2,
        result: { status: 'synchronized', decision: { status: 'escalation_required' } },
      }],
    });
    await expect(reconciliationCoordinator.readReviewState({
      accessToken: 'valid',
      request: {
        expectedMembershipId: ids.membership,
        installationId: lease.installationId,
      },
    })).resolves.toEqual({
      status: 'ready',
      value: {
        status: 'clear', expectedMembershipId: ids.membership,
        installationId: lease.installationId, confirmedThroughSequence: 3,
      },
    });

    const truth = await installerPool.query<{
      readonly result_status: string;
      readonly review_reason: string;
      readonly decision_work_event_id: string;
      readonly review_predecessor_sequence: string | null;
      readonly last_durable_sequence: string;
      readonly entry_count: string;
      readonly entry_status: string;
      readonly escalation_time_entry_id: string | null;
    }>(
      `SELECT reconciliation.result_status, reconciliation.review_reason,
              reconciliation.decision_work_event_id,
              cursor.review_predecessor_sequence, cursor.last_durable_sequence,
              (SELECT count(*) FROM taptime_server.time_entries) AS entry_count,
              entry.status AS entry_status,
              decision.time_entry_id AS escalation_time_entry_id
       FROM taptime_server.offline_event_reconciliations AS reconciliation
       JOIN taptime_server.offline_sync_cursors AS cursor
         ON cursor.organization_id = reconciliation.organization_id
        AND cursor.installation_id = reconciliation.installation_id
       JOIN taptime_server.canonical_decisions AS decision
         ON decision.organization_id = reconciliation.organization_id
        AND decision.work_event_id = reconciliation.work_event_id
       JOIN taptime_server.time_entries AS entry
         ON entry.organization_id = reconciliation.organization_id
        AND entry.user_id = reconciliation.user_id
       WHERE reconciliation.work_event_id = $1::uuid`,
      [ids.event2],
    );
    expect(truth.rows).toEqual([{
      result_status: 'review_pending',
      review_reason: 'business_engine_escalation',
      decision_work_event_id: ids.event2,
      review_predecessor_sequence: null,
      last_durable_sequence: '3',
      entry_count: '1',
      entry_status: 'stopped',
      escalation_time_entry_id: null,
    }]);

    const reviewAdminUserId = '10000000-0000-4000-8000-000000000019';
    const reviewAdminMembershipId = '12000000-0000-4000-8000-000000000019';
    await installerPool.query(
      `INSERT INTO taptime_server.users (id) VALUES ($1::uuid)`,
      [reviewAdminUserId],
    );
    await installerPool.query(
      `INSERT INTO taptime_server.memberships (
         id, organization_id, user_id, role, created_by_user_id, display_name
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'administrator', $4::uuid, 'Review Admin')`,
      [reviewAdminMembershipId, ids.organization, reviewAdminUserId, ids.user],
    );
    const reviewClient = await installerPool.connect();
    try {
      await reviewClient.query('BEGIN');
      await reviewClient.query('SET LOCAL ROLE taptime_time_review_reader');
      await reviewClient.query(
        `SELECT set_config('app.organization_id', $1, true),
                set_config('app.user_id', $2, true),
                set_config('app.membership_id', $3, true),
                set_config('app.membership_role', 'administrator', true)`,
        [ids.organization, reviewAdminUserId, reviewAdminMembershipId],
      );
      const projected = await reviewClient.query<{
        review_item_id: string;
        review_reason: string;
      }>(
        `SELECT review_item_id, review_reason
         FROM taptime_server.read_time_review_items_v1(
           $1::uuid, $2::uuid, $3::uuid, NULL, NULL, 100
         )`,
        [ids.organization, reviewAdminUserId, reviewAdminMembershipId],
      );
      expect(projected.rows).toContainEqual({
        review_item_id: ids.event2,
        review_reason: 'work_event_precedes_active_time_entry',
      });
      await reviewClient.query('ROLLBACK');

      await reviewClient.query('BEGIN');
      await reviewClient.query('SET LOCAL ROLE taptime_time_review_writer');
      await reviewClient.query(
        `SELECT set_config('app.organization_id', $1, true),
                set_config('app.user_id', $2, true),
                set_config('app.membership_id', $3, true),
                set_config('app.membership_role', 'administrator', true)`,
        [ids.organization, reviewAdminUserId, reviewAdminMembershipId],
      );
      const adjudicated = await reviewClient.query<{ result_status: string }>(
        `SELECT result_status
         FROM taptime_server.adjudicate_time_review_items_v1(
           $1::uuid, $2::uuid, $3::uuid,
           '80000000-0000-4000-8000-000000000019'::uuid,
           repeat('b', 64), ARRAY[$4::uuid], 'no_time_record_change',
           NULL, NULL, NULL, NULL, NULL,
           'Offline-Eskalation ohne Arbeitszeitänderung geprüft.'
         )`,
        [ids.organization, reviewAdminUserId, reviewAdminMembershipId, ids.event2],
      );
      expect(adjudicated.rows).toEqual([{ result_status: 'committed' }]);
      await reviewClient.query('COMMIT');

      await reviewClient.query('BEGIN');
      await reviewClient.query('SET LOCAL ROLE taptime_time_review_reader');
      await reviewClient.query(
        `SELECT set_config('app.organization_id', $1, true),
                set_config('app.user_id', $2, true),
                set_config('app.membership_id', $3, true),
                set_config('app.membership_role', 'administrator', true)`,
        [ids.organization, reviewAdminUserId, reviewAdminMembershipId],
      );
      const after = await reviewClient.query<{ review_item_id: string }>(
        `SELECT review_item_id
         FROM taptime_server.read_time_review_items_v1(
           $1::uuid, $2::uuid, $3::uuid, NULL, NULL, 100
         )`,
        [ids.organization, reviewAdminUserId, reviewAdminMembershipId],
      );
      expect(after.rows.map((row) => row.review_item_id)).not.toContain(ids.event2);
      await reviewClient.query('ROLLBACK');
    } finally {
      reviewClient.release();
    }
  });

  it('ingests a lease-v2 manual Project command through the same FIFO provenance boundary', async () => {
    await installerPool.query(
      `INSERT INTO taptime_server.projects (
         id, organization_id, display_name, active
       ) VALUES ($1::uuid, $2::uuid, 'Offline Project', true)`,
      [ids.project, ids.organization],
    );
    const lease = await issueLeaseV2();
    const item = lease.items.find((candidate) => (
      candidate.itemType === 'manual_target'
      && candidate.targetType === 'project'
      && candidate.targetId === ids.project
    ));
    expect(item).toBeDefined();
    if (item === undefined) return;
    const occurredAt = new Date(Date.parse(lease.issuedAt) + 1_000).toISOString();
    const command: OfflineLifecycleEventCommandV2 = {
      organizationId: ids.organization,
      expectedMembershipId: ids.membership,
      leaseId: lease.leaseId,
      leaseItemId: item.itemId,
      installationBinding,
      deviceSequence: 1,
      provenanceVersion: 2,
      clock: {
        bootMarker: 'synthetic-boot-v2',
        monotonicAnchorMilliseconds: 10_000,
        monotonicDeltaMilliseconds: 1_000,
        wallClockAnchor: lease.issuedAt,
        clockProofStatus: 'verified_same_boot',
        clockProofVersion: 1,
      },
      workEvent: {
        id: ids.event1,
        target: { targetType: 'project', targetId: ids.project },
        occurredAt,
        trigger: { type: 'manual' },
      },
      receipt: { id: ids.receipt1, attemptNumber: 1 },
    };
    await expect(eventCoordinator.ingest({ accessToken: 'valid', command }))
      .resolves.toMatchObject({
        status: 'synchronized',
        decision: { status: 'time_entry_started' },
      });
    const truth = await installerPool.query<{
      readonly target_type: string;
      readonly trigger_type: string;
      readonly content_hash_version: number;
      readonly started_via: string;
      readonly provenance_version: number;
    }>(
      `SELECT event.target_type, event.trigger_type, event.content_hash_version,
              entry.started_via, reconciliation.provenance_version
       FROM taptime_server.work_events AS event
       JOIN taptime_server.time_entries AS entry
         ON entry.organization_id = event.organization_id
        AND entry.start_work_event_id = event.id
       JOIN taptime_server.offline_event_reconciliations AS reconciliation
         ON reconciliation.organization_id = event.organization_id
        AND reconciliation.work_event_id = event.id`,
    );
    expect(truth.rows).toEqual([{
      target_type: 'project',
      trigger_type: 'manual',
      content_hash_version: 2,
      started_via: 'manual',
      provenance_version: 2,
    }]);
  });

  it('synchronizes offline pause start and stop completely in device-sequence order', async () => {
    const lease = await issueLeaseV3();
    const workItem = lease.items.find((item) => (
      item.itemType === 'nfc_assignment' && item.subjectType === 'work'
    ));
    const breakItem = lease.items.find((item) => item.itemType === 'manual_break');
    expect(workItem).toBeDefined();
    expect(breakItem).toBeDefined();
    if (workItem === undefined || breakItem === undefined) return;
    const startedAt = new Date(Date.parse(lease.issuedAt) + 1_000).toISOString();
    const breakStartedAt = new Date(Date.parse(lease.issuedAt) + 601_000).toISOString();
    const breakStoppedAt = new Date(Date.parse(lease.issuedAt) + 1_201_000).toISOString();

    const start = await eventCoordinator.ingest({
      accessToken: 'valid',
      command: eventCommandV3(lease, workItem, ids.event1, ids.receipt1, 1, startedAt),
    });
    const pauseStart = await eventCoordinator.ingest({
      accessToken: 'valid',
      command: eventCommandV3(lease, breakItem, ids.event2, ids.receipt2, 2, breakStartedAt),
    });
    const pauseStop = await eventCoordinator.ingest({
      accessToken: 'valid',
      command: eventCommandV3(lease, breakItem, ids.event3, ids.receipt3, 3, breakStoppedAt),
    });
    expect(start).toMatchObject({
      status: 'synchronized', deviceSequence: 1,
      decision: { status: 'time_entry_started' },
    });
    expect(pauseStart).toMatchObject({
      status: 'synchronized', deviceSequence: 2,
      decision: { status: 'break_started' },
    });
    expect(pauseStop).toMatchObject({
      status: 'synchronized', deviceSequence: 3,
      decision: { status: 'break_stopped' },
    });

    const truth = await installerPool.query<{
      device_sequence: string;
      decision_type: string;
      subject_type: string;
      interval_status: string | null;
      started_via: string | null;
      stopped_via: string | null;
      entry_status: string;
    }>(`
      SELECT reconciliation.device_sequence::text, decision.decision_type,
        event.subject_type, interval.status AS interval_status,
        interval.started_via, interval.stopped_via, entry.status AS entry_status
      FROM taptime_server.offline_event_reconciliations AS reconciliation
      JOIN taptime_server.work_events AS event
        ON event.id = reconciliation.work_event_id
      JOIN taptime_server.canonical_decisions AS decision
        ON decision.work_event_id = event.id
      LEFT JOIN taptime_server.break_intervals AS interval
        ON interval.id = decision.break_interval_id
      LEFT JOIN taptime_server.time_entries AS entry
        ON entry.id = decision.time_entry_id
      ORDER BY reconciliation.device_sequence
    `);
    expect(truth.rows).toEqual([
      {
        device_sequence: '1', decision_type: 'time_entry_started', subject_type: 'work',
        interval_status: null, started_via: null, stopped_via: null, entry_status: 'started',
      },
      {
        device_sequence: '2', decision_type: 'break_started', subject_type: 'break',
        interval_status: 'stopped', started_via: 'manual', stopped_via: 'manual',
        entry_status: 'started',
      },
      {
        device_sequence: '3', decision_type: 'break_stopped', subject_type: 'break',
        interval_status: 'stopped', started_via: 'manual', stopped_via: 'manual',
        entry_status: 'started',
      },
    ]);
  });

  it('serializes canonical and offline ingestion for the same Organization and User',
    async () => {
      const lease = await issueLease();
      const item = lease.items[0]!;
      const occurredAt = new Date(Date.parse(lease.issuedAt) + 1_000).toISOString();
      const canonicalLocked = deferred();
      const releaseCanonical = deferred();
      const canonical = canonicalCoordinator.ingest(
        await canonicalCommand(occurredAt),
        undefined,
        {
          afterAuthorityLocked: async () => {
            canonicalLocked.resolve();
            await releaseCanonical.promise;
          },
        },
      );
      await canonicalLocked.promise;

      const offline = eventCoordinator.ingest({
        accessToken: 'valid',
        command: eventCommand(
          lease,
          item.itemId,
          ids.event1,
          ids.receipt1,
          1,
          occurredAt,
        ),
      });
      try {
        await waitForAdvisoryLockWait(eventApplicationName);
        const committed = await installerPool.query<{ work_events: string }>(
          `SELECT count(*)::text AS work_events
           FROM taptime_server.work_events
           WHERE organization_id = $1::uuid`,
          [ids.organization],
        );
        expect(committed.rows[0]?.work_events).toBe('0');
      } finally {
        releaseCanonical.resolve();
      }

      const [canonicalResult, offlineResult] = await Promise.all([canonical, offline]);
      expect(canonicalResult).toMatchObject({
        status: 'synchronized',
        decision: { status: 'time_entry_started' },
      });
      expect(offlineResult).toMatchObject({
        status: 'synchronized',
        decision: { status: 'duplicate_scan_ignored' },
      });
    });

  it('returns closed conflicts for reused event, sequence and Receipt identities', async () => {
    const lease = await issueLease();
    const item = lease.items[0]!;
    const occurredAt = new Date(Date.parse(lease.issuedAt) + 1_000).toISOString();
    const first = eventCommand(
      lease,
      item.itemId,
      ids.event1,
      ids.receipt1,
      1,
      occurredAt,
    );
    await expect(eventCoordinator.ingest({ accessToken: 'valid', command: first }))
      .resolves.toMatchObject({ status: 'synchronized' });

    const receiptCollision = eventCommand(
      lease,
      item.itemId,
      ids.event2,
      ids.receipt1,
      2,
      new Date(Date.parse(occurredAt) + 6_000).toISOString(),
    );
    await expect(eventCoordinator.ingest({
      accessToken: 'valid',
      command: receiptCollision,
    })).resolves.toEqual({
      status: 'conflict',
      reason: 'receipt_metadata_conflict',
    });

    const sequenceCollision = eventCommand(
      lease,
      item.itemId,
      ids.event2,
      ids.receipt2,
      1,
      new Date(Date.parse(occurredAt) + 6_000).toISOString(),
    );
    await expect(eventCoordinator.ingest({
      accessToken: 'valid',
      command: sequenceCollision,
    })).resolves.toEqual({
      status: 'conflict',
      reason: 'sequence_content_conflict',
    });

    const eventCollision = {
      ...first,
      clock: {
        ...first.clock,
        monotonicDeltaMilliseconds: first.clock.monotonicDeltaMilliseconds + 1,
      },
    };
    await expect(eventCoordinator.ingest({
      accessToken: 'valid',
      command: eventCollision,
    })).resolves.toEqual({
      status: 'conflict',
      reason: 'event_content_conflict',
    });

    const counts = await installerPool.query<{
      events: string;
      receipts: string;
      reconciliations: string;
    }>(`
      SELECT
        (SELECT count(*) FROM taptime_server.work_events) AS events,
        (SELECT count(*) FROM taptime_server.sync_receipts) AS receipts,
        (SELECT count(*) FROM taptime_server.offline_event_reconciliations)
          AS reconciliations
    `);
    expect(counts.rows[0]).toEqual({
      events: '1',
      receipts: '1',
      reconciliations: '1',
    });
  });

  it('evaluates configuration that was valid at capture before later deactivation', async () => {
    const lease = await issueLease();
    const occurredAt = new Date(Date.parse(lease.issuedAt) + 1_000).toISOString();
    const deactivatedAt = new Date(Date.parse(occurredAt) + 1_000).toISOString();
    await installerPool.query(
      `UPDATE taptime_server.nfc_assignments
       SET active = false, valid_to = $2::timestamptz,
           updated_at = $2::timestamptz, row_version = row_version + 1
       WHERE id = $1::uuid`,
      [ids.assignment, deactivatedAt],
    );
    await installerPool.query(
      `UPDATE taptime_server.customers
       SET active = false, deactivated_at = $2::timestamptz,
           updated_at = $2::timestamptz, row_version = row_version + 1
       WHERE id = $1::uuid`,
      [ids.customer, deactivatedAt],
    );

    const command = eventCommand(
      lease,
      lease.items[0]!.itemId,
      ids.event1,
      ids.receipt1,
      1,
      occurredAt,
    );
    await expect(eventCoordinator.ingest({ accessToken: 'valid', command }))
      .resolves.toMatchObject({
        status: 'synchronized',
        decision: { status: 'time_entry_started' },
      });
  });

  it('stores four revoked-membership events without loss and reviews every sequence', async () => {
    const lease = await issueLease();
    const item = lease.items[0]!;
    await installerPool.query(
      `UPDATE taptime_server.memberships
       SET revoked_at = pg_catalog.transaction_timestamp(), row_version = row_version + 1
       WHERE id = $1::uuid`,
      [ids.membership],
    );
    const firstReview = eventCommand(
      lease,
      item.itemId,
      ids.event1,
      ids.receipt1,
      1,
      new Date(Date.parse(lease.issuedAt) + 1_000).toISOString(),
    );
    await expect(eventCoordinator.ingest({
      accessToken: 'valid',
      command: firstReview,
    })).resolves.toMatchObject({
      status: 'review_pending',
      reason: 'identity_or_membership_not_current',
      workEventId: ids.event1,
      deviceSequence: 1,
    });

    const followingEvents = [
      { eventId: ids.event2, receiptId: ids.receipt2, sequence: 2 },
      { eventId: ids.event3, receiptId: ids.receipt3, sequence: 3 },
      { eventId: ids.event4, receiptId: ids.receipt4, sequence: 4 },
    ] as const;
    for (const following of followingEvents) {
      const blocked = eventCommand(
        lease,
        item.itemId,
        following.eventId,
        following.receiptId,
        following.sequence,
        new Date(Date.parse(lease.issuedAt) + following.sequence * 7_000).toISOString(),
      );
      await expect(eventCoordinator.ingest({
        accessToken: 'valid',
        command: blocked,
      })).resolves.toMatchObject({
        status: 'review_pending',
        reason: 'predecessor_requires_review',
        workEventId: following.eventId,
        deviceSequence: following.sequence,
      });
    }

    const counts = await installerPool.query<{
      events: string;
      receipts: string;
      decisions: string;
      entries: string;
      reconciliations: string;
    }>(`
      SELECT
        (SELECT count(*) FROM taptime_server.work_events) AS events,
        (SELECT count(*) FROM taptime_server.sync_receipts) AS receipts,
        (SELECT count(*) FROM taptime_server.canonical_decisions) AS decisions,
        (SELECT count(*) FROM taptime_server.time_entries) AS entries,
        (SELECT count(*) FROM taptime_server.offline_event_reconciliations) AS reconciliations
    `);
    expect(counts.rows[0]).toEqual({
      events: '4',
      receipts: '4',
      decisions: '0',
      entries: '0',
      reconciliations: '4',
    });
  });

  it('carries an unresolved review predecessor across a second installation stream', async () => {
    const firstLease = await issueLease();
    const firstCommand = eventCommand(
      firstLease,
      firstLease.items[0]!.itemId,
      ids.event1,
      ids.receipt1,
      1,
      firstLease.issuedAt,
    );
    await expect(eventCoordinator.ingest({
      accessToken: 'valid',
      command: {
        ...firstCommand,
        clock: {
          ...firstCommand.clock,
          bootMarker: 'synthetic-boot-after-reboot',
          clockProofStatus: 'review_only',
        },
      },
    })).resolves.toMatchObject({
      status: 'review_pending',
      reason: 'capture_time_out_of_bounds',
    });

    const secondBinding = Buffer.alloc(32, 0x33).toString('base64url');
    const secondLeaseResult = await leaseCoordinator.issue({
      accessToken: 'valid',
      command: {
        commandId: '81000000-0000-4000-8000-000000000012',
        installationBinding: secondBinding,
        lookupKey: Buffer.alloc(32, 0x44).toString('base64url'),
      },
    });
    if (secondLeaseResult.status !== 'ready') {
      throw new Error(`Second lease issue failed with ${secondLeaseResult.status}`);
    }
    const secondLease = secondLeaseResult.page;
    const secondOccurredAt = new Date(Date.parse(secondLease.issuedAt) + 1_000).toISOString();
    const secondCommand = {
      ...eventCommand(
        secondLease,
        secondLease.items[0]!.itemId,
        ids.event2,
        ids.receipt2,
        1,
        secondOccurredAt,
      ),
      installationBinding: secondBinding,
    };
    await expect(eventCoordinator.ingest({
      accessToken: 'valid',
      command: secondCommand,
    })).resolves.toMatchObject({
      status: 'review_pending',
      reason: 'predecessor_requires_review',
      workEventId: ids.event2,
      deviceSequence: 1,
    });
  });

  it('persists changed-boot clock evidence as review-only with zero lifecycle mutation',
    async () => {
      const lease = await issueLease();
      const command = eventCommand(
        lease,
        lease.items[0]!.itemId,
        ids.event1,
        ids.receipt1,
        1,
        lease.issuedAt,
      );
      const result = await eventCoordinator.ingest({
        accessToken: 'valid',
        command: {
          ...command,
          clock: {
            ...command.clock,
            bootMarker: 'synthetic-boot-after-reboot',
            monotonicDeltaMilliseconds: 0,
            clockProofStatus: 'review_only',
          },
        },
      });
      expect(result).toMatchObject({
        status: 'review_pending',
        reason: 'capture_time_out_of_bounds',
        workEventId: ids.event1,
        receiptId: ids.receipt1,
        deviceSequence: 1,
      });
      await expect(reconciliationCoordinator.readReviewState({
        accessToken: 'valid',
        request: {
          expectedMembershipId: ids.membership,
          installationId: lease.installationId,
        },
      })).resolves.toEqual({
        status: 'ready',
        value: {
          status: 'review_pending', expectedMembershipId: ids.membership,
          installationId: lease.installationId, earliestUnresolvedSequence: 1,
        },
      });
      const durable = await installerPool.query<{
        readonly clock_proof_status: string;
        readonly decisions: string;
        readonly time_entries: string;
      }>(
        `SELECT reconciliation.clock_proof_status,
                (SELECT count(*) FROM taptime_server.canonical_decisions) AS decisions,
                (SELECT count(*) FROM taptime_server.time_entries) AS time_entries
         FROM taptime_server.offline_event_reconciliations AS reconciliation
         WHERE reconciliation.organization_id = $1::uuid
           AND reconciliation.work_event_id = $2::uuid`,
        [ids.organization, ids.event1],
      );
      expect(durable.rows).toEqual([{
        clock_proof_status: 'review_only',
        decisions: '0',
        time_entries: '0',
      }]);
    });

  it('keeps all three executor roles isolated and unable to pivot into siblings', async () => {
    const result = await installerPool.query<{
      role_name: string;
      can_login: boolean;
      inherits: boolean;
      bypasses_rls: boolean;
      parents: string[];
    }>(`
      SELECT role.rolname AS role_name, role.rolcanlogin AS can_login,
             role.rolinherit AS inherits, role.rolbypassrls AS bypasses_rls,
             ARRAY(
               SELECT parent.rolname::text
               FROM pg_catalog.pg_auth_members AS edge
               JOIN pg_catalog.pg_roles AS parent ON parent.oid = edge.roleid
               WHERE edge.member = role.oid
               ORDER BY parent.rolname
             )::text[] AS parents
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname IN (
        'taptime_offline_lease_issuer',
        'taptime_offline_event_ingestor',
        'taptime_offline_reconciliation_reader'
      )
      ORDER BY role.rolname
    `);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.every((row) => (
      !row.can_login && !row.inherits && !row.bypasses_rls && row.parents.length === 0
    ))).toBe(true);
  });
});

async function issueLease(): Promise<OfflineCaptureLeasePage> {
  const result = await leaseCoordinator.issue({
    accessToken: 'valid',
    command: {
      commandId: ids.leaseCommand,
      installationBinding,
      lookupKey,
    },
  });
  if (result.status !== 'ready') {
    throw new Error(`Lease issue failed with ${result.status}`);
  }
  return result.page;
}

async function issueLeaseV2(): Promise<OfflineCaptureLeasePageV2> {
  const result = await leaseCoordinator.issueV2({
    accessToken: 'valid',
    command: {
      commandId: ids.leaseCommandV2,
      installationBinding,
      lookupKey,
    },
  });
  if (result.status !== 'ready') throw new Error(`Lease v2 issue failed with ${result.status}`);
  return result.page;
}

async function issueLeaseV3(): Promise<OfflineCaptureLeasePageV3> {
  const result = await leaseCoordinator.issueV3({
    accessToken: 'valid',
    command: {
      commandId: ids.leaseCommandV3,
      installationBinding,
      lookupKey,
    },
  });
  if (result.status !== 'ready') throw new Error(`Lease v3 issue failed with ${result.status}`);
  return result.page;
}

function eventCommandV3(
  lease: OfflineCaptureLeasePageV3,
  item: OfflineCaptureLeasePageV3['items'][number],
  eventId: string,
  receiptId: string,
  deviceSequence: number,
  occurredAt: string,
): OfflineLifecycleEventCommandV3 {
  const base = {
    organizationId: ids.organization,
    expectedMembershipId: ids.membership,
    leaseId: lease.leaseId,
    leaseItemId: item.itemId,
    installationBinding,
    deviceSequence,
    provenanceVersion: 3 as const,
    clock: {
      bootMarker: 'synthetic-boot-v3',
      monotonicAnchorMilliseconds: 10_000,
      monotonicDeltaMilliseconds: Date.parse(occurredAt) - Date.parse(lease.issuedAt),
      wallClockAnchor: lease.issuedAt,
      clockProofStatus: 'verified_same_boot' as const,
      clockProofVersion: 1 as const,
    },
    receipt: { id: receiptId, attemptNumber: 1 as const },
  };
  if (item.subjectType === 'break') {
    return {
      ...base,
      workEvent: {
        id: eventId,
        occurredAt,
        subject: { type: 'break' },
        trigger: item.itemType === 'nfc_assignment'
          ? { type: 'nfc', assignmentId: item.assignmentId, nfcTagId: item.nfcTagId }
          : { type: 'manual' },
      },
    };
  }
  return {
    ...base,
    workEvent: {
      id: eventId,
      occurredAt,
      subject: { type: 'work' },
      target: { targetType: item.targetType, targetId: item.targetId },
      trigger: item.itemType === 'nfc_assignment'
        ? { type: 'nfc', assignmentId: item.assignmentId, nfcTagId: item.nfcTagId }
        : { type: 'manual' },
    },
  };
}

function eventCommand(
  lease: OfflineCaptureLeasePage,
  itemId: string,
  eventId: string,
  receiptId: string,
  deviceSequence: number,
  occurredAt: string,
): OfflineLifecycleEventCommand {
  return {
    organizationId: ids.organization,
    expectedMembershipId: ids.membership,
    leaseId: lease.leaseId,
    leaseItemId: itemId,
    installationBinding,
    deviceSequence,
    provenanceVersion: 1,
    clock: {
      bootMarker: 'synthetic-boot-1',
      monotonicAnchorMilliseconds: 10_000,
      monotonicDeltaMilliseconds: Date.parse(occurredAt) - Date.parse(lease.issuedAt),
      wallClockAnchor: lease.issuedAt,
      clockProofStatus: 'verified_same_boot',
      clockProofVersion: 1,
    },
    workEvent: {
      id: eventId,
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      target: { targetType: 'customer', targetId: ids.customer },
      occurredAt,
    },
    receipt: { id: receiptId, attemptNumber: 1 },
  };
}

async function canonicalCommand(occurredAt: string): Promise<LifecycleIngestionCommand> {
  return {
    accessToken: await canonicalAccessToken(),
    requestedOrganizationId: OrganizationId(ids.organization),
    workEvent: {
      id: WorkEventId(ids.event3),
      assignmentId: NfcAssignmentId(ids.assignment),
      nfcTagId: NfcTagId(ids.tag),
      target: customerAssignmentTarget(CustomerId(ids.customer)),
      occurredAt: createTimestamp(occurredAt),
    },
    receipt: { id: ids.receipt3, attemptNumber: 1 },
  };
}

async function canonicalAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({
    aal: 'aal1',
    email: 'offline-cross-route@example.invalid',
    is_anonymous: false,
    phone: '',
    role: 'authenticated',
    session_id: canonicalSessionId,
  })
    .setProtectedHeader({ alg: 'RS256', kid: canonicalKeyId, typ: 'JWT' })
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setSubject(subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(canonicalSigningKey);
}

async function startJwksServer(
  jwk: JWK,
): Promise<{ readonly server: Server; readonly origin: URL }> {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      keys: [{ ...jwk, alg: 'RS256', kid: canonicalKeyId, use: 'sig' }],
    }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Offline cross-route JWKS server did not expose a TCP address');
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

async function waitForAdvisoryLockWait(applicationName: string): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const activity = await installerPool.query<{
      readonly wait_event_type: string | null;
      readonly query: string;
    }>(
      `SELECT wait_event_type, query
       FROM pg_catalog.pg_stat_activity
       WHERE application_name = $1
         AND state = 'active'`,
      [applicationName],
    );
    if (activity.rows.some((row) => (
      row.wait_event_type === 'Lock'
      && row.query.includes('pg_advisory_xact_lock')
    ))) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Offline ingestion did not wait on the shared advisory lock');
}

async function ensureLogin(login: string, roles: readonly string[]): Promise<void> {
  if (roles.length === 0) {
    throw new Error('Synthetic runtime login requires at least one role');
  }
  await installerPool.query(`
    DO $login$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${login}') THEN
        CREATE ROLE ${login}
          LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      END IF;
    END
    $login$;
    ALTER ROLE ${login} WITH
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      PASSWORD '${runtimePassword}';
    REVOKE taptime_offline_lease_issuer, taptime_offline_event_ingestor,
      taptime_offline_reconciliation_reader, taptime_identity_resolver,
      taptime_server_lifecycle FROM ${login};
    GRANT ${roles.join(', ')} TO ${login};
  `);
}

function runtimeConnectionString(login: string): string {
  const url = new URL(installerConnectionString);
  url.username = login;
  url.password = runtimePassword;
  return url.href;
}
