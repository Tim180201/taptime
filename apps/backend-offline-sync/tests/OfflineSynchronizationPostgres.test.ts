import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { SupabaseJwtAccessTokenVerifier } from '@taptime/backend-identity';
import {
  ManualLifecycleIngestionCoordinator,
  ServerCanonicalLifecycleIngestionCoordinator,
  type LifecycleArchiveDurabilityPort,
  type LifecycleIngestionCommand,
} from '@taptime/backend-lifecycle';
import { AdminWriteSessionCoordinator, EmployeeMembershipEnrollmentCoordinator } from '@taptime/backend-administration';
import { ProjectAdministrationCoordinator } from '@taptime/backend-mobile-work';
import { TimeReviewCoordinator, TimeSupplementCoordinator } from '@taptime/backend-time-review';
import { B3_MIGRATION_TABLE, B3_SCHEMA, migrate } from '@taptime/backend-schema';
import {
  GeneralWorkTargetId,
  ProjectId,
  generalWorkTarget,
  projectWorkTarget,
  MembershipId,
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
  PostgresOfflineArchiveDurability,
  type OfflineArchiveDurabilityPort,
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
const archivedLifecycleDurability: LifecycleArchiveDurabilityPort = {
  async requireOffsiteArchive() {
    return { requiredWalFile: '000000010000000000000000', offsiteArchived: true };
  },
};
const verifier: AccessTokenVerifier = {
  async verify(accessToken) {
    return accessToken === 'valid' || accessToken.startsWith('t091:')
      ? { status: 'verified', identity: { issuer, subject: accessToken.startsWith('t091:') ? accessToken : subject } }
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
    'taptime_mobile_target_reader',
    'taptime_time_review_writer',
    'taptime_time_review_reader',
    'taptime_admin_setup',
    'taptime_project_administrator',
    'taptime_membership_manager',
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
  eventCoordinator = new OfflineLifecycleIngestionCoordinator(
    eventPool,
    verifier,
    undefined,
    undefined,
    immediatelyArchivedDurability(),
  );
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
    archivedLifecycleDurability,
  );
});

beforeEach(async () => {
  await installerPool.query(`
    TRUNCATE TABLE
      taptime_server.offsite_wal_archive_watermarks,
      taptime_server.offsite_base_backup_receipts,
      taptime_server.offsite_wal_archive_receipts,
      taptime_server.lifecycle_event_archive_requirements,
      taptime_server.offline_event_archive_requirements,
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

describe('T-095b sequence skip', () => {
  function skip(command: OfflineLifecycleEventCommand) {
    return { organizationId: command.organizationId, expectedMembershipId: command.expectedMembershipId,
      installationBinding: command.installationBinding, leaseId: command.leaseId, leaseItemId: command.leaseItemId,
      deviceSequence: command.deviceSequence, workEventId: command.workEvent.id, receiptId: command.receipt.id,
      occurredAt: command.workEvent.occurredAt, reason: 'event_content_conflict', evidenceSha256: 'a'.repeat(64) };
  }
  it('records the gap once, books only the successor, and rejects altered or accepted evidence', async () => {
    const lease = await issueLease();
    const first = eventCommand(lease, lease.items[0]!.itemId, ids.event1, ids.receipt1, 1, lease.issuedAt);
    const report = skip(first);
    expect(await eventCoordinator.skip({ accessToken:'valid', command:report })).toMatchObject({status:'reported',idempotentRetry:false});
    expect(await eventCoordinator.skip({ accessToken:'valid', command:report })).toMatchObject({status:'reported',idempotentRetry:true});
    expect(await eventCoordinator.skip({ accessToken:'valid', command:{...report,reason:'http_400'} })).toMatchObject({status:'conflict'});
    expect(await eventCoordinator.skip({ accessToken:'valid', command:{...report,deviceSequence:3} })).toMatchObject({status:'conflict'});
    expect((await installerPool.query('SELECT count(*)::int AS n FROM taptime_server.work_events')).rows[0].n).toBe(0);
    expect((await installerPool.query('SELECT count(*)::int AS n FROM taptime_server.time_entries')).rows[0].n).toBe(0);
    const next = eventCommand(lease, lease.items[0]!.itemId, ids.event2, ids.receipt2, 2, new Date(Date.parse(lease.issuedAt)+1000).toISOString());
    expect(await eventCoordinator.ingest({accessToken:'valid',command:next})).toMatchObject({status:'synchronized'});
    expect(await eventCoordinator.skip({accessToken:'valid',command:skip(next)})).toMatchObject({status:'conflict'});
    expect((await installerPool.query('SELECT count(*)::int AS n FROM taptime_server.work_events')).rows[0].n).toBe(1);
  });
  it('T-095b review v3 respects the current location and closes with an immutable note without time', async () => {
    await seedT091();
    const person=t091People[0]!;
    const lease=await t091Lease(person);
    const item=lease.items.find(i=>i.subjectType==='work' && i.itemType==='manual_target')!;
    const base=eventCommandV3(lease,item,randomUUID(),randomUUID(),1,lease.issuedAt);
    const c={...base,expectedMembershipId:person.membership,installationBinding:Buffer.from(person.user.replaceAll('-','').padEnd(64,'0'),'hex').toString('base64url')};
    const report={organizationId:c.organizationId,expectedMembershipId:c.expectedMembershipId,installationBinding:c.installationBinding,
      leaseId:c.leaseId,leaseItemId:c.leaseItemId,deviceSequence:c.deviceSequence,workEventId:c.workEvent.id,receiptId:c.receipt.id,
      occurredAt:c.workEvent.occurredAt,reason:'http_400',evidenceSha256:'b'.repeat(64)};
    expect(await eventCoordinator.skip({accessToken:`t091:${person.user}`,command:report})).toMatchObject({status:'reported'});
    const review=new TimeReviewCoordinator(canonicalPool,canonicalPool,verifier);
    for(const [index,visible] of [[1,true],[3,false],[4,true],[0,false]] as const) {
      const actor=t091People[index]!;
      const page=await review.queryReviewItemsV3({accessToken:`t091:${actor.user}`,request:{expectedMembershipId:actor.membership,limit:100,cursor:null}});
      if(index===0) expect(page.status).toBe('authority_rejected');
      else expect(page).toMatchObject({status:'ready',value:{items:visible ? [expect.objectContaining({source:'offline_skip',reviewItemId:c.workEvent.id,reviewReason:'http_400'})] : []}});
    }
    // Both public read capabilities remain empty: a skip is evidence, never working time.
    const projections=await installerPool.connect();
    try {
      await projections.query('BEGIN');await projections.query('SET LOCAL ROLE taptime_mobile_own_time_reader');
      await projections.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','employee',true)`,[ids.organization,person.user,person.membership]);
      expect((await projections.query('SELECT * FROM taptime_server.read_mobile_own_time_v2($1,$2,$3,NULL,NULL,NULL,NULL,20)',[ids.organization,person.user,person.membership])).rows).toEqual([]);
      await projections.query('ROLLBACK');
      const admin=t091People[4]!;
      await projections.query('BEGIN');await projections.query('SET LOCAL ROLE taptime_time_exporter');
      await projections.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)`,[ids.organization,admin.user,admin.membership]);
      expect((await projections.query(`SELECT * FROM taptime_server.read_effective_time_entry_export_v3($1,$2::timestamptz-interval '1 hour',$2::timestamptz+interval '1 hour',20)`,[ids.organization,report.occurredAt])).rows).toEqual([]);
    } finally {await projections.query('ROLLBACK');projections.release();}
    const manager=t091People[1]!;
    expect(await review.queryReviewItemsV2({accessToken:`t091:${manager.user}`,request:{expectedMembershipId:manager.membership,limit:100,cursor:null}})).toMatchObject({status:'ready',value:{items:[]}});
    const close={accessToken:`t091:${manager.user}`,request:{expectedMembershipId:manager.membership,commandId:randomUUID(),reviewItemIds:[c.workEvent.id],resolution:{type:'no_time_record_change' as const},reason:'Kein Zeitverlust; Beleg geprüft'}};
    expect(await review.adjudicateReviewItems(close)).toMatchObject({status:'committed',value:{timeRecordId:null,idempotentRetry:false}});
    expect(await review.adjudicateReviewItems(close)).toMatchObject({status:'committed',value:{idempotentRetry:true}});
    expect(await review.adjudicateReviewItems({...close,request:{...close.request,reason:'Geändert'}})).toMatchObject({status:'command_id_conflict'});
    expect(await review.queryReviewItemsV3({accessToken:`t091:${manager.user}`,request:{expectedMembershipId:manager.membership,limit:100,cursor:null}})).toMatchObject({status:'ready',value:{items:[]}});
    expect((await installerPool.query('SELECT count(*)::int n FROM taptime_server.effective_time_records_v2')).rows[0].n).toBe(0);
    await expect(installerPool.query('UPDATE taptime_server.offline_skipped_sequences SET reason=$1',['http_422'])).rejects.toThrow('append-only');
    await expect(installerPool.query('DELETE FROM taptime_server.offline_skip_resolutions')).rejects.toThrow('append-only');
  });
  it('rejects foreign installation, membership and authentication', async () => {
    const lease = await issueLease();
    const report = skip(eventCommand(lease, lease.items[0]!.itemId, ids.event1, ids.receipt1, 1, lease.issuedAt));
    expect(await eventCoordinator.skip({accessToken:'invalid',command:report})).toMatchObject({status:'authority_rejected'});
    expect(await eventCoordinator.skip({accessToken:'valid',command:{...report,expectedMembershipId:randomUUID()}})).toMatchObject({status:'authority_rejected'});
    expect(await eventCoordinator.skip({accessToken:'valid',command:{...report,installationBinding:Buffer.alloc(32,99).toString('base64url')}})).toMatchObject({status:'conflict'});
  });
});

describe('complete offline PostgreSQL boundary', () => {
  it.each(['fresh', 'employee_promotion'] as const)(
    'T-080 issues, ingests and reconciles standortleitung without server changes (%s)', async kind => {
      const prior = kind === 'employee_promotion' ? await issueLeaseV3() : null;
      const records = [];
      if (prior) {
        const item = prior.items.find(item => item.itemType === 'nfc_assignment' && item.subjectType === 'work')!;
        const result = await eventCoordinator.ingest({ accessToken: 'valid', command: eventCommandV3(
          prior, item, ids.event1, ids.receipt1, 1, new Date(Date.parse(prior.issuedAt) + 1_000).toISOString()) });
        expect(result.status).toBe('synchronized');
        if (result.status !== 'synchronized') throw new Error('Expected employee decision');
        records.push({ workEventId: result.workEventId, receiptId: result.receiptId,
          deviceSequence: result.deviceSequence, archiveStatus: result.archiveStatus,
          result: { status: result.status, decision: result.decision } });
      }
      await installerPool.query(`UPDATE taptime_server.memberships
        SET role = 'standortleitung', row_version = row_version + 1 WHERE id = $1`, [ids.membership]);
      const lease = await issueLeaseV3(randomUUID());
      expect(lease.role).toBe('standortleitung');
      if (prior) {
        expect(lease.installationId).toBe(prior.installationId);
        expect(lease.leaseId).not.toBe(prior.leaseId);
        expect(lease.membershipRowVersion).toBe(prior.membershipRowVersion + 1);
      }
      const item = lease.items.find(item => item.itemType === 'nfc_assignment' && item.subjectType === 'work')!;
      const result = await eventCoordinator.ingest({ accessToken: 'valid', command: eventCommandV3(
        lease, item, ids.event2, ids.receipt2, prior ? 2 : 1,
        new Date(Date.parse(lease.issuedAt) + 60_000).toISOString()) });
      expect(result).toMatchObject({ status: 'synchronized',
        decision: { status: prior ? 'time_entry_stopped' : 'time_entry_started' } });
      if (result.status !== 'synchronized') throw new Error('Expected Standortleitung decision');
      records.push({ workEventId: result.workEventId, receiptId: result.receiptId,
        deviceSequence: result.deviceSequence, archiveStatus: result.archiveStatus,
        result: { status: result.status, decision: result.decision } });
      await expect(reconciliationCoordinator.reconcileV2({ accessToken: 'valid',
        command: { workEventIds: records.map(record => record.workEventId) } }))
        .resolves.toEqual({ status: 'ready', records });
    });

  it('repairs the archive requirement after interruption between event commit and durability',
    async () => {
      const interruptedDurability: OfflineArchiveDurabilityPort = {
        async requireOffsiteArchive() {
          throw new Error('synthetic interruption after event commit');
        },
      };
      const interruptedCoordinator = new OfflineLifecycleIngestionCoordinator(
        eventPool,
        verifier,
        undefined,
        undefined,
        interruptedDurability,
      );
      const lease = await issueLease();
      const command = eventCommand(
        lease,
        lease.items[0]!.itemId,
        ids.event1,
        ids.receipt1,
        1,
        new Date(Date.parse(lease.issuedAt) + 1_000).toISOString(),
      );

      await expect(interruptedCoordinator.ingest({ accessToken: 'valid', command }))
        .rejects.toThrow('synthetic interruption after event commit');
      const interruptedState = await installerPool.query<{
        readonly event_count: string;
        readonly reconciliation_count: string;
        readonly requirement_count: string;
      }>(`
        SELECT
          (SELECT count(*) FROM taptime_server.work_events
            WHERE organization_id = $1::uuid AND id = $2::uuid) AS event_count,
          (SELECT count(*) FROM taptime_server.offline_event_reconciliations
            WHERE organization_id = $1::uuid
              AND work_event_id = $2::uuid) AS reconciliation_count,
          (SELECT count(*) FROM taptime_server.offline_event_archive_requirements
            WHERE organization_id = $1::uuid
              AND work_event_id = $2::uuid) AS requirement_count
      `, [ids.organization, ids.event1]);
      expect(interruptedState.rows).toEqual([{
        event_count: '1',
        reconciliation_count: '1',
        requirement_count: '0',
      }]);

      const repairingCoordinator = new OfflineLifecycleIngestionCoordinator(
        eventPool,
        verifier,
        undefined,
        undefined,
        new PostgresOfflineArchiveDurability(),
      );
      await expect(repairingCoordinator.ingest({ accessToken: 'valid', command }))
        .resolves.toMatchObject({
          status: 'synchronized',
          archiveStatus: 'archive_pending',
          idempotentRetry: true,
          workEventId: ids.event1,
        });
      const repaired = await installerPool.query<{ readonly requirement_count: string }>(
        `SELECT count(*) AS requirement_count
         FROM taptime_server.offline_event_archive_requirements
         WHERE organization_id = $1::uuid AND work_event_id = $2::uuid`,
        [ids.organization, ids.event1],
      );
      expect(repaired.rows).toEqual([{ requirement_count: '1' }]);
    });

  it('holds a single pooled connection until post-commit durability has finished', async () => {
    const durabilityEntered = deferred();
    const releaseDurability = deferred();
    const serializedPool = new Pool({
      connectionString: runtimeConnectionString(eventLogin),
      application_name: `${eventApplicationName}-serialized`,
      max: 1,
    });
    const coordinator = new OfflineLifecycleIngestionCoordinator(
      serializedPool,
      verifier,
      undefined,
      undefined,
      {
        async requireOffsiteArchive() {
          durabilityEntered.resolve();
          await releaseDurability.promise;
          return {
            requiredWalFile: '000000010000000000000000',
            offsiteArchived: true,
          };
        },
      },
    );
    try {
      const lease = await issueLease();
      const command = eventCommand(
        lease,
        lease.items[0]!.itemId,
        ids.event1,
        ids.receipt1,
        1,
        new Date(Date.parse(lease.issuedAt) + 1_000).toISOString(),
      );
      const ingestion = coordinator.ingest({ accessToken: 'valid', command });
      await durabilityEntered.promise;

      let probeCompleted = false;
      const probe = serializedPool.query('SELECT 1').then(() => {
        probeCompleted = true;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(probeCompleted).toBe(false);

      releaseDurability.resolve();
      await expect(ingestion).resolves.toMatchObject({ status: 'synchronized' });
      await probe;
      expect(probeCompleted).toBe(true);
    } finally {
      releaseDurability.resolve();
      await serializedPool.end();
    }
  });

  it('withholds acknowledgement until the exact committed WAL file is offsite archived',
    async () => {
      const coordinator = new OfflineLifecycleIngestionCoordinator(eventPool, verifier);
      const lease = await issueLease();
      const command = eventCommand(
        lease,
        lease.items[0]!.itemId,
        ids.event1,
        ids.receipt1,
        1,
        new Date(Date.parse(lease.issuedAt) + 1_000).toISOString(),
      );

      await expect(coordinator.ingest({ accessToken: 'valid', command }))
        .resolves.toEqual({
          status: 'synchronized',
          archiveStatus: 'archive_pending',
          decision: { status: 'time_entry_started', timeEntryId: expect.any(String) },
          idempotentRetry: false,
          workEventId: ids.event1,
          receiptId: ids.receipt1,
          deviceSequence: 1,
        });
      await expect(reconciliationCoordinator.reconcile({
        accessToken: 'valid',
        command: { workEventIds: [ids.event1] },
      })).resolves.toEqual({ status: 'ready', records: [] });
      await expect(reconciliationCoordinator.reconcileV2({
        accessToken: 'valid',
        command: { workEventIds: [ids.event1] },
      })).resolves.toMatchObject({
        status: 'ready',
        records: [{
          workEventId: ids.event1,
          archiveStatus: 'archive_pending',
          result: { status: 'synchronized', decision: { status: 'time_entry_started' } },
        }],
      });

      const legacyClient = await eventPool.connect();
      try {
        await legacyClient.query('BEGIN');
        await legacyClient.query('SET LOCAL ROLE taptime_offline_event_ingestor');
        await expect(legacyClient.query(
          `SELECT * FROM taptime_server.lock_offline_historical_actor_v1(
             $1, $2, $3::uuid
           )`,
          [issuer, subject, ids.membership],
        )).rejects.toMatchObject({ code: '42501' });
        await legacyClient.query('ROLLBACK');
      } finally {
        legacyClient.release();
      }

      const requirement = await installerPool.query<{
        required_wal_file: string;
      }>(
        `SELECT required_wal_file
         FROM taptime_server.offline_event_archive_requirements
         WHERE organization_id = $1::uuid AND work_event_id = $2::uuid`,
        [ids.organization, ids.event1],
      );
      const walFile = requirement.rows[0]?.required_wal_file;
      if (walFile === undefined) throw new Error('Archive requirement was not persisted');

      const segmentSize = await installerPool.query<{ bytes: string }>(
        `SELECT pg_catalog.pg_size_bytes(
           pg_catalog.current_setting('wal_segment_size')
         )::text AS bytes`,
      );
      const precedingWalFile = previousWalFile(
        walFile,
        BigInt(segmentSize.rows[0]?.bytes ?? '0'),
      );
      const gapEvidence = await syntheticArchiveEvidence(walFile, precedingWalFile);
      const archiverClient = await installerPool.connect();
      try {
        await archiverClient.query('BEGIN');
        await archiverClient.query('SET LOCAL ROLE taptime_wal_archiver');
        await archiverClient.query(
          `SELECT taptime_server.record_offsite_base_backup_v1(
             $1, $2::pg_lsn, $3
           )`,
          [gapEvidence.baseArchive, gapEvidence.baseStartLsn, precedingWalFile],
        );
        await archiverClient.query(
          `SELECT taptime_server.record_offsite_wal_archive_v1($1, $2, $3)`,
          [walFile, gapEvidence.walArchive, '1'.repeat(64)],
        );
        await expect(archiverClient.query(
          `SELECT taptime_server.advance_offsite_wal_archive_watermark_v1($1, $2)`,
          [gapEvidence.baseArchive, walFile],
        )).rejects.toMatchObject({ code: '42501' });
        await archiverClient.query('ROLLBACK');
      } finally {
        archiverClient.release();
      }
      await expect(coordinator.ingest({ accessToken: 'valid', command }))
        .resolves.toMatchObject({
          status: 'synchronized',
          archiveStatus: 'archive_pending',
          idempotentRetry: true,
          workEventId: ids.event1,
        });

      await recordSyntheticArchiveReceipt(walFile);

      await expect(coordinator.ingest({ accessToken: 'valid', command }))
        .resolves.toMatchObject({
          status: 'synchronized',
          archiveStatus: 'offsite_archived',
          idempotentRetry: true,
          workEventId: ids.event1,
        });
      await expect(reconciliationCoordinator.reconcileV2({
        accessToken: 'valid',
        command: { workEventIds: [ids.event1] },
      })).resolves.toMatchObject({
        status: 'ready',
        records: [{
          workEventId: ids.event1,
          archiveStatus: 'offsite_archived',
          result: { status: 'synchronized' },
        }],
      });
    });

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

  it('reconciles the exact pause decision union before and after archival', async () => {
    const lease = await issueLeaseV3();
    const work = lease.items.find((item) => item.itemType === 'nfc_assignment' && item.subjectType === 'work')!;
    const pause = lease.items.find((item) => item.itemType === 'manual_break')!;
    const coordinator = new OfflineLifecycleIngestionCoordinator(eventPool, verifier);
    const records = [];
    const expectedStatuses = ['break_without_active_time_entry_rejected', 'time_entry_started',
      'break_started', 'work_trigger_during_break_rejected', 'break_stopped'];
    for (const [index, item] of [pause, work, pause, work, pause].entries()) {
      const command = eventCommandV3(lease, item, randomUUID(), randomUUID(), index + 1,
        new Date(Date.parse(lease.issuedAt) + (index + 1) * 60_000).toISOString());
      const result = await coordinator.ingest({ accessToken: 'valid', command });
      expect(result).toMatchObject({ status: 'synchronized', archiveStatus: 'archive_pending',
        decision: { status: expectedStatuses[index] } });
      if (result.status !== 'synchronized') throw new Error('Expected decision');
      records.push({ workEventId: result.workEventId, receiptId: result.receiptId,
        deviceSequence: result.deviceSequence, result: { status: 'synchronized', decision: result.decision } });
    }
    const command = { workEventIds: records.map((record) => record.workEventId) };
    await expect(reconciliationCoordinator.reconcileV2({ accessToken: 'valid', command })).resolves.toEqual({
      status: 'ready', records: records.map((record) => ({ ...record, archiveStatus: 'archive_pending' })),
    });
    const requirements = await installerPool.query<{ required_wal_file: string }>(
      'SELECT DISTINCT required_wal_file FROM taptime_server.offline_event_archive_requirements');
    for (const row of requirements.rows) await recordSyntheticArchiveReceipt(row.required_wal_file);
    await expect(reconciliationCoordinator.reconcileV2({ accessToken: 'valid', command })).resolves.toEqual({
      status: 'ready', records: records.map((record) => ({ ...record, archiveStatus: 'offsite_archived' })),
    });
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

async function issueLeaseV3(commandId: string = ids.leaseCommandV3): Promise<OfflineCaptureLeasePageV3> {
  const result = await leaseCoordinator.issueV3({
    accessToken: 'valid',
    command: {
      commandId,
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

function previousWalFile(walFile: string, segmentBytes: bigint): string {
  if (!/^[0-9A-F]{24}$/u.test(walFile) || segmentBytes <= 0n) {
    throw new Error('Cannot derive preceding WAL segment');
  }
  const timeline = walFile.slice(0, 8);
  let log = BigInt(`0x${walFile.slice(8, 16)}`);
  let segment = BigInt(`0x${walFile.slice(16)}`);
  const segmentsPerLog = (2n ** 32n) / segmentBytes;
  if (segment === 0n) {
    if (log === 0n) throw new Error('Synthetic WAL segment has no predecessor');
    log -= 1n;
    segment = segmentsPerLog - 1n;
  } else {
    segment -= 1n;
  }
  const hex = (value: bigint) => value.toString(16).toUpperCase().padStart(8, '0');
  return `${timeline}${hex(log)}${hex(segment)}`;
}

function immediatelyArchivedDurability(): OfflineArchiveDurabilityPort {
  const durability = new PostgresOfflineArchiveDurability();
  return {
    async requireOffsiteArchive(client, actor, identity) {
      const requirement = await durability.requireOffsiteArchive(client, actor, identity);
      await recordSyntheticArchiveReceipt(requirement.requiredWalFile);
      return { ...requirement, offsiteArchived: true };
    },
  };
}

let syntheticBaseSequence = 0;

async function syntheticArchiveEvidence(
  walFile: string,
  baseStartWalFile?: string,
): Promise<{
  readonly baseArchive: string;
  readonly baseStartLsn: string;
  readonly walArchive: string;
  readonly archiveIdentifier: string;
}> {
  const cluster = await installerPool.query<{
    readonly archive_identifier: string;
    readonly segment_bytes: string;
  }>(`
    SELECT pg_catalog.lpad(pg_catalog.to_hex(control.system_identifier), 16, '0')
             AS archive_identifier,
           pg_catalog.pg_size_bytes(
             pg_catalog.current_setting('wal_segment_size')
           )::text AS segment_bytes
    FROM pg_catalog.pg_control_system() AS control
  `);
  const archiveIdentifier = cluster.rows[0]?.archive_identifier;
  const segmentBytes = BigInt(cluster.rows[0]?.segment_bytes ?? '0');
  const startWalFile = baseStartWalFile ?? previousWalFile(walFile, segmentBytes);
  if (archiveIdentifier === undefined || !/^[0-9a-f]{16}$/u.test(archiveIdentifier)) {
    throw new Error('Synthetic archive has no PostgreSQL cluster identifier');
  }
  syntheticBaseSequence += 1;
  return {
    baseArchive:
      `base-${archiveIdentifier}-20990101T${String(syntheticBaseSequence).padStart(6, '0')}Z`,
    baseStartLsn: walFileStartLsn(startWalFile, segmentBytes),
    walArchive: `wal-${archiveIdentifier}-${walFile}`,
    archiveIdentifier,
  };
}

function walFileStartLsn(walFile: string, segmentBytes: bigint): string {
  if (!/^[0-9A-F]{24}$/u.test(walFile) || segmentBytes <= 0n) {
    throw new Error('Cannot derive WAL segment start LSN');
  }
  const log = BigInt(`0x${walFile.slice(8, 16)}`);
  const segment = BigInt(`0x${walFile.slice(16)}`);
  const offset = segment * segmentBytes;
  return `${log.toString(16).toUpperCase()}/${offset.toString(16).toUpperCase()}`;
}

async function recordSyntheticArchiveReceipt(walFile: string): Promise<void> {
  const segmentSize = await installerPool.query<{ bytes: string }>(`
    SELECT pg_catalog.pg_size_bytes(
      pg_catalog.current_setting('wal_segment_size')
    )::text AS bytes
  `);
  const precedingWalFile = previousWalFile(
    walFile,
    BigInt(segmentSize.rows[0]?.bytes ?? '0'),
  );
  const evidence = await syntheticArchiveEvidence(walFile, precedingWalFile);
  const client = await installerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE taptime_wal_archiver');
    await client.query(
      `SELECT taptime_server.record_offsite_base_backup_v1(
         $1, $2::pg_lsn, $3
       )`,
      [evidence.baseArchive, evidence.baseStartLsn, precedingWalFile],
    );
    await client.query(
      `SELECT taptime_server.record_offsite_wal_archive_v1($1, $2, $3)`,
      [precedingWalFile,
        `wal-${evidence.archiveIdentifier}-${precedingWalFile}`, '0'.repeat(64)],
    );
    await client.query(
      `SELECT taptime_server.advance_offsite_wal_archive_watermark_v1($1, $2)`,
      [evidence.baseArchive, precedingWalFile],
    );
    await client.query(
      `SELECT taptime_server.record_offsite_wal_archive_v1($1, $2, $3)`,
      [walFile, evidence.walArchive, '1'.repeat(64)],
    );
    await client.query(
      `SELECT taptime_server.advance_offsite_wal_archive_watermark_v1($1, $2)`,
      [evidence.baseArchive, walFile],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

it('T-069 reviews a late offline trigger and lets the following trigger start anew',async()=>{
  const {AdministrationStopCoordinator}=await import('@taptime/backend-time-review');
  const adminUser=randomUUID(),adminMember=randomUUID(),adminSubject='t069-administrator';
  await installerPool.query('INSERT INTO taptime_server.users(id) VALUES($1)',[adminUser]);
  await installerPool.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,'administrator','Admin')",[adminMember,ids.organization,adminUser]);
  await installerPool.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES($1,$2,$3,$4)',[randomUUID(),adminUser,issuer,adminSubject]);
  const login='taptime_t069_admin_test_login';
  await ensureLogin(login,['taptime_identity_resolver','taptime_time_review_writer']);
  const adminPool=new Pool({connectionString:runtimeConnectionString(login)});
  const adminVerifier:AccessTokenVerifier={async verify(){return {status:'verified',identity:{issuer,subject:adminSubject}};}};
  try {
    const lease=await issueLease(),item=lease.items[0]!;
    const start=await eventCoordinator.ingest({accessToken:'valid',command:eventCommand(lease,item.itemId,ids.event1,ids.receipt1,1,lease.issuedAt)});
    expect(start).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
    if(start.status!=='synchronized'||start.decision.status!=='time_entry_started') throw new Error('Expected started time');
    const end=(await installerPool.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
    expect(await new AdministrationStopCoordinator(adminPool,adminVerifier).execute('admin',{
      expectedMembershipId:adminMember,targetMembershipId:ids.membership,timeRecordId:start.decision.timeEntryId,expectedRowVersion:1,
      commandId:randomUUID(),stoppedAt:end,reason:'Stopp vergessen',
    })).toMatchObject({status:'committed'});
    const action=(await installerPool.query('SELECT action_at FROM taptime_server.administration_stop_commands')).rows[0].action_at;
    const lateAt=new Date(Date.parse(lease.issuedAt)+1).toISOString();
    expect(Date.parse(lateAt)).toBeLessThan(+action);
    const late=eventCommand(lease,item.itemId,ids.event2,ids.receipt2,2,lateAt);
    const expected={status:'synchronized',decision:{status:'escalation_required',reason:'administration_stopped'}};
    expect(await eventCoordinator.ingest({accessToken:'valid',command:late})).toMatchObject(expected);
    expect(await eventCoordinator.ingest({accessToken:'valid',command:late})).toMatchObject({...expected,idempotentRetry:true});
    expect((await installerPool.query('SELECT status FROM taptime_server.time_entries')).rows).toEqual([{status:'stopped'}]);
    expect((await installerPool.query('SELECT result_status,review_reason,decision_work_event_id FROM taptime_server.offline_event_reconciliations WHERE work_event_id=$1',[ids.event2])).rows)
      .toEqual([{result_status:'review_pending',review_reason:'business_engine_escalation',decision_work_event_id:ids.event2}]);
    expect(await reconciliationCoordinator.reconcile({accessToken:'valid',command:{workEventIds:[ids.event2]}})).toMatchObject({status:'ready',records:[{result:expected}]});
    const c=await installerPool.connect();
    try {
      await c.query('BEGIN');await c.query('SET LOCAL ROLE taptime_time_review_reader');
      await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)`,[ids.organization,adminUser,adminMember]);
      expect((await c.query('SELECT review_reason FROM taptime_server.read_time_review_items_v1($1,$2,$3,NULL,NULL,20)',[ids.organization,adminUser,adminMember])).rows).toEqual([{review_reason:'administration_stopped'}]);
      await c.query('ROLLBACK');
    } finally {await c.query('ROLLBACK');c.release();}
    const after=new Date(+action+6000).toISOString();
    expect(await eventCoordinator.ingest({accessToken:'valid',command:eventCommand(lease,item.itemId,ids.event3,ids.receipt3,3,after)}))
      .toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
    expect((await installerPool.query('SELECT status FROM taptime_server.time_entries ORDER BY started_at')).rows).toEqual([{status:'stopped'},{status:'started'}]);
  } finally {await adminPool.end();}
});


// T-091: the pilot's normal setup, through the actual v4 ingestion and role boundaries.
const t091Locations = [randomUUID(), randomUUID()];
const t091People = ['employee', 'standortleitung', 'employee', 'standortleitung', 'administrator']
  .map((role, index) => ({ user: randomUUID(), membership: randomUUID(), role,
    location: t091Locations[index < 2 || index === 4 ? 0 : 1]! }));
let t091General: string;
let t091Targets: { targetType: 'customer' | 'project'; targetId: string; location: string }[];
function t091Target(type: 'customer' | 'project' | 'general_work', id: string) {
  return type==='customer'?customerAssignmentTarget(CustomerId(id)):
    type==='project'?projectWorkTarget(ProjectId(id)):generalWorkTarget(GeneralWorkTargetId(id));
}
async function seedT091(bindGeneral = false): Promise<void> {
  await installerPool.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name)
    SELECT id::uuid,$1,'Matrix '||ordinality FROM unnest($2::text[]) WITH ORDINALITY AS l(id,ordinality)`,
    [ids.organization,t091Locations]);
  // The pre-existing synthetic employee belongs to A as well.
  await installerPool.query(`INSERT INTO taptime_server.membership_home_location_assignments
    (id,organization_id,membership_id,location_id) VALUES($1,$2,$3,$4)`,
    [randomUUID(),ids.organization,ids.membership,t091Locations[0]]);
  for (const person of t091People) {
    await installerPool.query('INSERT INTO taptime_server.users(id) VALUES($1)',[person.user]);
    await installerPool.query(`INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject)
      VALUES($1,$2,$3,$4)`,[randomUUID(),person.user,issuer,`t091:${person.user}`]);
    await installerPool.query(`INSERT INTO taptime_server.memberships
      (id,organization_id,user_id,role,created_by_user_id,display_name)
      VALUES($1,$2,$3,$4,$3,$4)`,[person.membership,ids.organization,person.user,person.role]);
    await installerPool.query(`INSERT INTO taptime_server.membership_home_location_assignments
      (id,organization_id,membership_id,location_id) VALUES($1,$2,$3,$4)`,
      [randomUUID(),ids.organization,person.membership,person.location]);
    if (person.role==='standortleitung') await installerPool.query(`INSERT INTO
      taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
      VALUES($1,$2,$3,$4)`,[randomUUID(),ids.organization,person.membership,person.location]);
  }
  t091Targets=[];
  for (const location of t091Locations) for (const targetType of ['customer','project'] as const) {
    const targetId=randomUUID();
    await installerPool.query(`INSERT INTO taptime_server.${targetType==='customer'?'customers':'projects'}
      (id,organization_id,display_name,active) VALUES($1,$2,$3,true)`,[targetId,ids.organization,`${targetType} ${location}`]);
    t091Targets.push({targetType,targetId,location});
  }
  t091Targets.push({targetType:'customer',targetId:ids.customer,location:t091Locations[0]!});
  for (const target of t091Targets) await installerPool.query(`INSERT INTO
    taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    VALUES($1,$2,$3,$4,$5)`,[randomUUID(),ids.organization,target.targetType,target.targetId,target.location]);
  const pauseTag=randomUUID();
  await installerPool.query(`INSERT INTO taptime_server.nfc_tags(id,organization_id,display_name,payload_value)
    VALUES($1,$2,'Pause','nfc:uid:v1:04AABBEE')`,[pauseTag,ids.organization]);
  await installerPool.query(`INSERT INTO taptime_server.nfc_assignments
    (id,organization_id,nfc_tag_id,assignment_type,target_type,target_customer_id,active,valid_from)
    VALUES($1,$2,$3,'break',NULL,NULL,true,'2026-07-18T00:00:00Z')`,[randomUUID(),ids.organization,pauseTag]);
  t091General=(await installerPool.query(`SELECT target_id FROM taptime_server.work_targets
    WHERE organization_id=$1 AND target_type='general_work'`,[ids.organization])).rows[0].target_id;
  if (bindGeneral) await installerPool.query(`INSERT INTO taptime_server.work_target_location_assignments
    (id,organization_id,target_type,target_id,location_id) VALUES($1,$2,'general_work',$3,$4)`,
    [randomUUID(),ids.organization,t091General,t091Locations[1]]);
  await installerPool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[ids.organization]);
}
async function t091Lease(person: typeof t091People[number]) {
  const result=await leaseCoordinator.issueV3({accessToken:`t091:${person.user}`,command:{
    commandId:randomUUID(),installationBinding:Buffer.from(person.user.replaceAll('-','').padEnd(64,'0'),'hex').toString('base64url'),lookupKey}});
  if(result.status!=='ready') throw new Error(`T091 lease ${result.status}`);
  return result.page;
}
async function t091Event(lease: OfflineCaptureLeasePageV3, person: typeof t091People[number],
  item: OfflineCaptureLeasePageV3['items'][number], sequence: number) {
  const command=eventCommandV3(lease,item,randomUUID(),randomUUID(),sequence,
    new Date(Date.parse(lease.issuedAt)+sequence*10_000).toISOString());
  const actual={...command,expectedMembershipId:person.membership,installationBinding:Buffer.from(person.user.replaceAll('-','').padEnd(64,'0'),'hex').toString('base64url')};
  const result=await eventCoordinator.ingest({accessToken:`t091:${person.user}`,command:actual});
  const stored=(await installerPool.query(`SELECT accepted_work_location_id FROM taptime_server.work_events
    WHERE id=$1`,[command.workEvent.id])).rows[0];
  return {result,stored,command:actual};
}
describe('T-091 Standortmodus',()=>{
  it('completeness excludes unbound General Work',async()=>{
    await seedT091();
    expect((await installerPool.query('SELECT taptime_server.location_setup_is_complete_v1($1) AS complete',
      [ids.organization])).rows[0].complete).toBe(true);
  });
  it('leases for every role match their online targets, include general and breaks, exclude foreign targets and tags',async()=>{
    await seedT091(true);
    for(const person of t091People){
      const lease=await t091Lease(person);
      const targets=lease.items.filter(i=>i.itemType==='manual_target').map(i=>i.targetId).sort();
      expect(targets).toEqual([...t091Targets.filter(t=>t.location===person.location).map(t=>t.targetId),t091General].sort());
      expect(lease.items.some(i=>i.itemType==='manual_break')).toBe(true);
      expect(lease.items.some(i=>i.itemType==='nfc_assignment'&&i.subjectType==='break')).toBe(true);
      expect(lease.items.some(i=>i.itemType==='nfc_assignment'&&i.subjectType==='work'&&i.targetId===ids.customer)).toBe(person.location===t091Locations[0]);
      const client=await canonicalPool.connect();
      try{
        await client.query('BEGIN');
        await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
          set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
          [ids.organization,person.user,person.membership,person.role]);
        await client.query('SET LOCAL ROLE taptime_mobile_target_reader');
        const online=await client.query(`SELECT * FROM taptime_server.read_mobile_work_targets_v1($1,$2,$3,NULL,NULL,NULL,51)`,
          [ids.organization,person.user,person.membership]);
        expect(online.rows.map(t=>t.target_id).sort()).toEqual(targets);
        await client.query('ROLLBACK');
      }finally{client.release();}
    }
  });
  it.each(['customer','project','general_work'] as const)('v4 start, pause, resume and stop for %s retain accepted location',async(targetType)=>{
    await seedT091(true);
    const person=t091People[0]!;const lease=await t091Lease(person);
    const item=lease.items.find(i=>i.itemType==='manual_target'&&i.targetType===targetType)!;
    const pause=lease.items.find(i=>i.itemType==='manual_break')!;
    for(const [index,selected,status] of [[1,item,'time_entry_started'],[2,pause,'break_started'],
      [3,pause,'break_stopped'],[4,item,'time_entry_stopped']] as const){
      const {result,stored}=await t091Event(lease,person,selected,index);
      expect(result).toMatchObject({status:'synchronized',decision:{status}});
      expect(stored.accepted_work_location_id).toBe(person.location);
    }
  });
  it('v4 pause without active time is a durable rejection and the next FIFO item proceeds',async()=>{
    await seedT091(true);const person=t091People[0]!;const lease=await t091Lease(person);
    const first=await t091Event(lease,person,lease.items.find(i=>i.itemType==='manual_break')!,1);
    expect(first.result).toMatchObject({status:'synchronized',decision:{status:'break_without_active_time_entry_rejected'}});
    expect(first.stored.accepted_work_location_id).toBeNull();
    const next=await t091Event(lease,person,lease.items.find(i=>i.itemType==='manual_target')!,2);
    expect(next.result).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
  });
  it('v4 legacy foreign tag becomes a durable review case, exact retry works and FIFO advances',async()=>{
    await seedT091(true);const person=t091People[2]!;
    await installerPool.query('UPDATE taptime_server.organizations SET locations_enabled=false,row_version=row_version+1 WHERE id=$1',[ids.organization]);
    const lease=await t091Lease(person);
    await installerPool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[ids.organization]);
    const item=lease.items.find(i=>i.itemType==='nfc_assignment'&&i.subjectType==='work'&&i.targetId===ids.customer)!;
    const first=await t091Event(lease,person,item,1);
    expect(first.result).toMatchObject({status:'synchronized',decision:{status:'escalation_required',reason:'work_location_unavailable'}});
    expect(first.stored.accepted_work_location_id).toBeNull();
    expect(await eventCoordinator.ingest({accessToken:`t091:${person.user}`,command:first.command})).toMatchObject({idempotentRetry:true});
    expect((await t091Event(lease,person,lease.items.find(i=>i.itemType==='manual_break')!,2)).stored).toBeDefined();
  });
  it('v4 revoked and rebound target becomes a review case',async()=>{
    await seedT091(true);const person=t091People[0]!;const lease=await t091Lease(person);
    const item=lease.items.find((i):i is Extract<typeof i,{itemType:'manual_target'}>=>i.itemType==='manual_target'&&i.targetType==='customer')!;
    const rebind=await installerPool.connect();
    try {await rebind.query('BEGIN');
      await rebind.query(`UPDATE taptime_server.work_target_location_assignments SET revoked_at=clock_timestamp()
        WHERE organization_id=$1 AND target_id=$2`,[ids.organization,item.targetId]);
      await rebind.query(`INSERT INTO taptime_server.work_target_location_assignments
        (id,organization_id,target_type,target_id,location_id) VALUES($1,$2,'customer',$3,$4)`,
        [randomUUID(),ids.organization,item.targetId,t091Locations[1]]);
      await rebind.query('COMMIT');
    }finally{rebind.release();}
    const rejected=await t091Event(lease,person,item,1);
    expect(rejected.result).toMatchObject({status:'synchronized',decision:{status:'escalation_required',reason:'work_location_unavailable'}});
    expect(rejected.stored.accepted_work_location_id).toBeNull();
  });
  it.each(['employee','standortleitung','administrator'])('General Work backfill by %s needs no binding',async(role)=>{
    await seedT091();const person=t091People.find(p=>p.role===role)!;
    const coordinator=new TimeSupplementCoordinator(canonicalPool,verifier);
    const start=new Date(Date.now()-3_600_000).toISOString(),stop=new Date(Date.now()-1_800_000).toISOString();
    expect(await coordinator.execute(`t091:${person.user}`,'backfill',{
      expectedMembershipId:person.membership,commandId:randomUUID(),
      targetMembershipId:role==='employee'?person.membership:t091People[0]!.membership,
      targetType:'general_work',targetId:t091General,startedAt:start,stoppedAt:stop,reason:'Matrix',comment:null
    })).toMatchObject({status:'committed'});
  });

  it.each(['customer','project','general_work'] as const)('online manual %s starts, pauses, resumes and stops with stored location',async(targetType)=>{
    await seedT091(true);const person=t091People[0]!;
    const coordinator=new ManualLifecycleIngestionCoordinator(canonicalPool,verifier,archivedLifecycleDurability);
    const targetId=targetType==='general_work'?t091General:t091Targets.find(t=>t.targetType===targetType&&t.location===person.location)!.targetId;
    // Manual capture uses the server clock; wait past the engine duplicate window for repeated subjects.
    for(const [index,subject,status] of [[0,'work','time_entry_started'],[1,'break','break_started'],
      [2,'break','break_stopped'],[3,'work','time_entry_stopped']] as const){
      if(index===2 || index===3) await new Promise(resolve=>setTimeout(resolve,5100));
      const base={accessToken:`t091:${person.user}`,expectedMembershipId:MembershipId(person.membership),
        receipt:{id:randomUUID(),attemptNumber:1 as const}};
      const id=randomUUID();
      const result=subject==='work'
        ? await coordinator.ingestManual({...base,workEvent:{id:WorkEventId(id),target:t091Target(targetType,targetId)}})
        : await coordinator.ingestManualBreak({...base,workEvent:{id:WorkEventId(id),subject:{type:'break'}}});
      expect(result).toMatchObject({status:'synchronized',decision:{status}});
      expect((await installerPool.query('SELECT accepted_work_location_id FROM taptime_server.work_events WHERE id=$1',[id])).rows[0].accepted_work_location_id).toBe(person.location);
    }
  },15000);
  it('online foreign target and pause without running time are durable visible decisions',async()=>{
    await seedT091();const person=t091People[0]!;
    const coordinator=new ManualLifecycleIngestionCoordinator(canonicalPool,verifier,archivedLifecycleDurability);
    const base={accessToken:`t091:${person.user}`,expectedMembershipId:MembershipId(person.membership),
      receipt:{id:randomUUID(),attemptNumber:1 as const}};
    expect(await coordinator.ingestManualBreak({...base,workEvent:{id:WorkEventId(randomUUID()),subject:{type:'break'}}}))
      .toMatchObject({status:'synchronized',decision:{status:'break_without_active_time_entry_rejected'}});
    const foreign=t091Targets.find(t=>t.location!==person.location)!;
    expect(await coordinator.ingestManual({...base,receipt:{id:randomUUID(),attemptNumber:1},
      workEvent:{id:WorkEventId(randomUUID()),target:t091Target(foreign.targetType,foreign.targetId)}}))
      .toMatchObject({status:'synchronized',decision:{status:'escalation_required',reason:'work_location_unavailable'}});
  });
  it('offline historical foreign target is recorded as the specific location review reason',async()=>{
    await seedT091(true);const person=t091People[2]!;
    await installerPool.query('UPDATE taptime_server.organizations SET locations_enabled=false,row_version=row_version+1 WHERE id=$1',[ids.organization]);
    const lease=await t091Lease(person);
    await installerPool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[ids.organization]);
    const item=lease.items.find(i=>i.itemType==='nfc_assignment'&&i.subjectType==='work'&&i.targetId===ids.customer)!;
    const first=eventCommandV3(lease,item,randomUUID(),randomUUID(),1,lease.issuedAt);
    const command={...first,expectedMembershipId:person.membership,
      installationBinding:Buffer.from(person.user.replaceAll('-','').padEnd(64,'0'),'hex').toString('base64url'),
      clock:{...first.clock,clockProofStatus:'review_only' as const}};
    expect(await eventCoordinator.ingest({accessToken:`t091:${person.user}`,command}))
      .toMatchObject({status:'synchronized',decision:{status:'escalation_required',reason:'work_location_unavailable'}});
    const manager=t091People[3]!;
    const review=new TimeReviewCoordinator(canonicalPool,canonicalPool,verifier);
    const page=await review.queryReviewItemsV2({accessToken:`t091:${manager.user}`,
      request:{expectedMembershipId:manager.membership,limit:100,cursor:null}});
    expect(page).toMatchObject({status:'ready',value:{items:expect.arrayContaining([
      expect.objectContaining({reviewItemId:first.workEvent.id,reviewReason:'work_location_unavailable'})])}});
  });
  it('customer and project creation in the same five-person enabled setup is atomic and replayable',async()=>{
    await seedT091();const admin=t091People[4]!,manager=t091People[1]!;
    const customer=new AdminWriteSessionCoordinator(canonicalPool,verifier);
    const command={accessToken:`t091:${manager.user}`,expectedMembershipId:MembershipId(manager.membership),
      commandId:randomUUID(),displayName:'Matrix new customer',locationId:manager.location};
    const result=await customer.createCustomer(command);
    expect(result).toMatchObject({status:'succeeded'});
    expect(await customer.createCustomer(command)).toMatchObject({status:'succeeded',idempotentRetry:true});
    const project=new ProjectAdministrationCoordinator(canonicalPool,verifier);
    const projectId=randomUUID(),projectCommand={accessToken:`t091:${admin.user}`,request:{
      expectedMembershipId:admin.membership,commandId:randomUUID(),projectId,displayName:'Matrix new project',locationId:t091Locations[1]}};
    expect(await project.createProject(projectCommand)).toMatchObject({status:'succeeded'});
    expect(await project.createProject(projectCommand)).toMatchObject({status:'succeeded',idempotentRetry:true});
    expect((await installerPool.query(`SELECT location_id FROM taptime_server.work_target_location_assignments
      WHERE target_id=$1 AND revoked_at IS NULL`,[projectId])).rows).toEqual([{location_id:t091Locations[1]}]);
    expect((await installerPool.query('SELECT taptime_server.location_setup_is_complete_v1($1) AS complete',[ids.organization])).rows[0].complete).toBe(true);
  });
  it('additional work grants extend the lease but never management authority',async()=>{
    await seedT091();const person=t091People[0]!;
    await installerPool.query(`INSERT INTO taptime_server.membership_work_location_grants
      (id,organization_id,membership_id,location_id) VALUES($1,$2,$3,$4)`,
      [randomUUID(),ids.organization,person.membership,t091Locations[1]]);
    const lease=await t091Lease(person);
    expect(lease.items.filter(i=>i.itemType==='manual_target').map(i=>i.targetId).sort())
      .toEqual([...t091Targets.map(t=>t.targetId),t091General].sort());
    const target=lease.items.find(i=>i.itemType==='manual_target'&&i.targetType==='project'&&
      i.targetId===t091Targets.find(t=>t.targetType==='project'&&t.location!==person.location)!.targetId)!;
    expect((await t091Event(lease,person,target,1)).stored.accepted_work_location_id).toBe(t091Locations[1]);
  });
  it('stop and pause retain the running location after the binding moves to another site',async()=>{
    await seedT091();const person=t091People[0]!;const lease=await t091Lease(person);
    const item=lease.items.find((i):i is Extract<typeof i,{itemType:'manual_target'}>=>i.itemType==='manual_target'&&i.targetType==='customer')!;
    expect((await t091Event(lease,person,item,1)).result).toMatchObject({decision:{status:'time_entry_started'}});
    const c=await installerPool.connect();
    try{await c.query('BEGIN');
      await c.query(`UPDATE taptime_server.work_target_location_assignments SET revoked_at=clock_timestamp()
        WHERE organization_id=$1 AND target_id=$2`,[ids.organization,item.targetId]);
      await c.query(`INSERT INTO taptime_server.work_target_location_assignments
        (id,organization_id,target_type,target_id,location_id) VALUES($1,$2,'customer',$3,$4)`,
        [randomUUID(),ids.organization,item.targetId,t091Locations[1]]);
      await c.query('COMMIT');
    }finally{c.release();}
    const pause=lease.items.find(i=>i.itemType==='nfc_assignment'&&i.subjectType==='break')!;
    for(const [sequence,selected,status] of [[2,pause,'break_started'],[3,pause,'break_stopped'],[4,item,'time_entry_stopped']] as const){
      const event=await t091Event(lease,person,selected,sequence);
      expect(event.result).toMatchObject({decision:{status}});
      expect(event.stored.accepted_work_location_id).toBe(person.location);
    }
  });
  it('unresolvable legacy binding is preserved as NULL evidence and gets a review decision',async()=>{
    await seedT091();const person=t091People[0]!;const lease=await t091Lease(person);
    const item=lease.items.find((i):i is Extract<typeof i,{itemType:'manual_target'}>=>i.itemType==='manual_target'&&i.targetType==='customer')!;
    // Explicit synthetic corruption: normal administration cannot violate completeness.
    await installerPool.query('ALTER TABLE taptime_server.work_target_location_assignments DISABLE TRIGGER work_target_locations_enabled_location_setup');
    try{await installerPool.query(`UPDATE taptime_server.work_target_location_assignments SET revoked_at=clock_timestamp()
      WHERE organization_id=$1 AND target_id=$2`,[ids.organization,item.targetId]);}
    finally{await installerPool.query('ALTER TABLE taptime_server.work_target_location_assignments ENABLE TRIGGER work_target_locations_enabled_location_setup');}
    const event=await t091Event(lease,person,item,1);
    expect(event.result).toMatchObject({decision:{status:'escalation_required',reason:'work_location_unavailable'}});
    expect(event.stored.accepted_work_location_id).toBeNull();
  });
  it('General Work with no home retains a legitimate NULL without a location escalation',async()=>{
    await seedT091();const person=t091People[0]!;const lease=await t091Lease(person);
    await installerPool.query('ALTER TABLE taptime_server.membership_home_location_assignments DISABLE TRIGGER membership_home_locations_enabled_location_setup');
    try{await installerPool.query(`UPDATE taptime_server.membership_home_location_assignments SET revoked_at=clock_timestamp()
      WHERE organization_id=$1 AND membership_id=$2`,[ids.organization,person.membership]);}
    finally{await installerPool.query('ALTER TABLE taptime_server.membership_home_location_assignments ENABLE TRIGGER membership_home_locations_enabled_location_setup');}
    const item=lease.items.find(i=>i.itemType==='manual_target'&&i.targetType==='general_work')!;
    const event=await t091Event(lease,person,item,1);
    expect(event.result).toMatchObject({decision:{status:'time_entry_started'}});
    expect(event.stored.accepted_work_location_id).toBeNull();
  });

  it.each(['canonical','historical','deferred'] as const)('foreign online NFC in %s path preserves evidence and the precise review reason',async(mode)=>{
    await seedT091();const person=t091People[2]!;
    const coordinator=new ServerCanonicalLifecycleIngestionCoordinator(canonicalPool,verifier as SupabaseJwtAccessTokenVerifier,archivedLifecycleDurability);
    const command:LifecycleIngestionCommand={accessToken:`t091:${person.user}`,requestedOrganizationId:OrganizationId(ids.organization),
      workEvent:{id:WorkEventId(randomUUID()),assignmentId:NfcAssignmentId(ids.assignment),nfcTagId:NfcTagId(ids.tag),
        target:customerAssignmentTarget(CustomerId(ids.customer)),occurredAt:createTimestamp(new Date(Date.now()-(mode==='historical'?90_000_000:0)).toISOString())},
      receipt:{id:randomUUID(),attemptNumber:1}};
    const result=mode==='deferred'?await coordinator.ingestDeferred(command,MembershipId(person.membership)):await coordinator.ingest(command);
    expect(result).toMatchObject(mode==='deferred'?{status:'deferred',evidenceStored:true}:
      {status:'synchronized',decision:{status:'escalation_required',reason:'work_location_unavailable'}});
    expect((await installerPool.query('SELECT accepted_work_location_id FROM taptime_server.work_events WHERE id=$1',[command.workEvent.id])).rows[0].accepted_work_location_id).toBeNull();
    expect((await installerPool.query('SELECT reason FROM taptime_server.canonical_decisions WHERE work_event_id=$1',[command.workEvent.id])).rows[0].reason).toBe('work_location_unavailable');
    expect(mode==='deferred'?await coordinator.ingestDeferred(command,MembershipId(person.membership)):await coordinator.ingest(command)).toMatchObject({idempotentRetry:true});
  });
  it('legacy lease v1 and v2 issuance applies the same person scope as v3',async()=>{
    await seedT091();
    for(const person of t091People){
      const captureBinding=Buffer.from(person.user.replaceAll('-','').padEnd(64,'0'),'hex').toString('base64url');
      const v1=await leaseCoordinator.issue({accessToken:`t091:${person.user}`,command:{commandId:randomUUID(),installationBinding:captureBinding,lookupKey}});
      expect(v1).toMatchObject({status:'ready'});
      if(v1.status==='ready') expect(v1.page.items.map(i=>i.targetId)).toEqual(person.location===t091Locations[0]?[ids.customer]:[]);
      const v2=await leaseCoordinator.issueV2({accessToken:`t091:${person.user}`,command:{commandId:randomUUID(),installationBinding:captureBinding,lookupKey}});
      expect(v2).toMatchObject({status:'ready'});
      if(v2.status==='ready') expect(v2.page.items.filter(i=>i.itemType==='manual_target').map(i=>i.targetId).sort())
        .toEqual([...t091Targets.filter(t=>t.location===person.location).map(t=>t.targetId),t091General].sort());
    }
  });

});

it('T-092: offline stop after revocation is review evidence and never a second stop',async()=>{
  await seedT091();
  const person=t091People[0]!, admin=t091People[4]!, lease=await t091Lease(person);
  const item=lease.items.find(i=>i.itemType==='manual_target'&&i.targetType==='customer')!;
  // Capture before departure, using a valid lease, but upload the second tap after departure.
  const first=eventCommandV3(lease,item,randomUUID(),randomUUID(),1,lease.issuedAt);
  const binding=Buffer.from(person.user.replaceAll('-','').padEnd(64,'0'),'hex').toString('base64url');
  const start=await eventCoordinator.ingest({accessToken:`t091:${person.user}`,command:{...first,expectedMembershipId:person.membership,installationBinding:binding}});
  expect(start).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
  const coordinator=new EmployeeMembershipEnrollmentCoordinator(canonicalPool,canonicalPool,verifier);
  expect(await coordinator.revokeMembership({accessToken:`t091:${admin.user}`,expectedMembershipId:MembershipId(admin.membership),
    commandId:randomUUID(),targetMembershipId:MembershipId(person.membership),expectedRowVersion:1})).toMatchObject({status:'succeeded'});
  const before=(await installerPool.query('SELECT id,status,stopped_at,stop_work_event_id,stopped_via FROM taptime_server.time_entries WHERE user_id=$1',[person.user])).rows;
  expect(before).toEqual([expect.objectContaining({status:'stopped',stopped_via:'administration'})]);
  const second=eventCommandV3(lease,item,randomUUID(),randomUUID(),2,new Date().toISOString());
  const command={...second,expectedMembershipId:person.membership,installationBinding:binding};
  const result=await eventCoordinator.ingest({accessToken:`t091:${person.user}`,command});
  expect(result).toMatchObject({status:'review_pending',reason:'identity_or_membership_not_current'});
  expect((await installerPool.query('SELECT id,status,stopped_at,stop_work_event_id,stopped_via FROM taptime_server.time_entries WHERE user_id=$1',[person.user])).rows).toEqual(before);
  expect(await eventCoordinator.ingest({accessToken:`t091:${person.user}`,command})).toMatchObject({status:'review_pending'});
});

it.each(['nfc_assignment','manual_target'] as const)('T100: pre-delete %s capture reconciles, post-delete capture becomes a customer-deleted review',async kind=>{
 const location=randomUUID();
 await installerPool.query("INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$2,'Nord')",[location,ids.organization]);
 await installerPool.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES($1,$2,$3,$4)',[randomUUID(),ids.organization,ids.membership,location]);
 await installerPool.query('INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) SELECT gen_random_uuid(),organization_id,target_type,target_id,$2 FROM taptime_server.work_targets WHERE organization_id=$1 AND active',[ids.organization,location]);
 await installerPool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[ids.organization]);
 const lease=await issueLeaseV3();
 const item=lease.items.find(i=>i.itemType===kind&&i.subjectType==='work'&&i.targetType==='customer')!;
 expect(item).toBeDefined();
 const before=new Date(Date.parse(lease.issuedAt)+100).toISOString(),deleted=new Date(Date.parse(lease.issuedAt)+200).toISOString();
 await installerPool.query('UPDATE taptime_server.nfc_assignments SET active=false,valid_to=$2,row_version=row_version+1 WHERE id=$1',[ids.assignment,deleted]);
 await installerPool.query('UPDATE taptime_server.customers SET active=false,deactivated_at=$2,row_version=row_version+1 WHERE id=$1',[ids.customer,deleted]);
 const first=eventCommandV3(lease,item,ids.event1,ids.receipt1,1,before);
 expect(await eventCoordinator.ingest({accessToken:'valid',command:first})).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
 const second=eventCommandV3(lease,item,ids.event2,ids.receipt2,2,deleted);
 expect(await eventCoordinator.ingest({accessToken:'valid',command:second})).toMatchObject({status:'review_pending',reason:'customer_deleted'});
 expect((await installerPool.query('SELECT review_reason FROM taptime_server.offline_event_reconciliations WHERE work_event_id=$1',[ids.event2])).rows).toEqual([{review_reason:'customer_deleted'}]);
 expect(await eventCoordinator.ingest({accessToken:'valid',command:second})).toMatchObject({status:'review_pending',reason:'customer_deleted'});
 expect(await reconciliationCoordinator.reconcileV2({accessToken:'valid',command:{workEventIds:[ids.event2]}})).toMatchObject({status:'ready',records:[{result:{status:'review_pending',reason:'customer_deleted'}}]});
 expect((await installerPool.query('SELECT status FROM taptime_server.time_entries')).rows).toEqual([{status:'started'}]);
 const fresh=await issueLeaseV3(randomUUID());
 expect(fresh.items.some(i=>i.subjectType==='work'&&i.targetType==='customer'&&i.targetId===ids.customer)).toBe(false);
});
it('T100: renaming does not invalidate a captured customer event',async()=>{
 const lease=await issueLeaseV3();
 const item=lease.items.find(i=>i.itemType==='manual_target'&&i.subjectType==='work'&&i.targetType==='customer')!;
 await installerPool.query("UPDATE taptime_server.customers SET display_name='Umbenannt',row_version=row_version+1 WHERE id=$1",[ids.customer]);
 const command=eventCommandV3(lease,item,ids.event1,ids.receipt1,1,new Date(Date.parse(lease.issuedAt)+100).toISOString());
 expect(await eventCoordinator.ingest({accessToken:'valid',command})).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
});
