import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeSqliteOfflineConnection } from '../support/NodeSqliteOfflineConnection';
import { describe, expect, it, vi } from 'vitest';
import { TimeEntryId } from '@taptime/core';
import { AuthenticatedHttpRequestExecutor } from '../../src/transport/AuthenticatedHttpRequestExecutor';
import { AuthenticatedHttpRequestExecutor as PreT068aExecutor } from '../support/PreT068aAuthenticatedHttpRequestExecutor';
import type { AuthenticatedRequestCapability } from '../../src/auth/contracts';
import { OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS, OFFLINE_QUEUE_MAXIMUM_EVENTS } from '@taptime/offline-sync-contract';
import type {
  OfflineCaptureLeasePage,
  OfflineCaptureLeasePageV3,
  OfflineLifecycleEventCommand,
  OfflineReconciliationResultV2,
  OfflineReconciliationRecordV2,
} from '@taptime/offline-sync-contract';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostPort,
} from '../../src/transport/AuthenticatedHttpRequestExecutor';
import type {
  LifecycleEventApiPort,
  LifecycleEventResult,
} from '../../src/transport/contracts';
import type {
  LifecycleEvidenceOutbox,
  PendingLifecycleEvidence,
  StoredLifecycleEvidence,
} from '../../src/scan/LifecycleEvidenceOutbox';
import {
  OfflineCaptureDatabase,
  OFFLINE_SCHEMA_V4,
} from '../../src/offline/OfflineCaptureDatabase';
import { OfflineCaptureLeaseClient } from '../../src/offline/OfflineCaptureLeaseClient';
import {
  OfflineLifecycleClient,
  type OfflineLifecycleApiPort,
} from '../../src/offline/OfflineLifecycleClient';
import { LegacyLifecycleEvidenceImporter } from '../../src/offline/LegacyLifecycleEvidenceImporter';
import {
  mobileManifestDigest,
  mobileManifestDigestV3,
} from '../../src/offline/MobileLookupHmac';
import {
  OfflineSyncScheduler,
  OFFLINE_ARCHIVE_POLL_MILLISECONDS,
  retryDelay,
} from '../../src/offline/OfflineSyncScheduler';

const ids = {
  command: '10000000-0000-4000-8000-000000000001',
  organization: '20000000-0000-4000-8000-000000000001',
  membership: '30000000-0000-4000-8000-000000000001',
  lease: '40000000-0000-4000-8000-000000000001',
  installation: '50000000-0000-4000-8000-000000000001',
  identity: '60000000-0000-4000-8000-000000000001',
  user: '70000000-0000-4000-8000-000000000001',
  item1: '80000000-0000-4000-8000-000000000001',
  item2: '80000000-0000-4000-8000-000000000002',
  assignment1: '90000000-0000-4000-8000-000000000001',
  assignment2: '90000000-0000-4000-8000-000000000002',
  tag1: 'a0000000-0000-4000-8000-000000000001',
  tag2: 'a0000000-0000-4000-8000-000000000002',
  customer1: 'b0000000-0000-4000-8000-000000000001',
  customer2: 'b0000000-0000-4000-8000-000000000002',
  event: 'c0000000-0000-4000-8000-000000000001',
  receipt: 'd0000000-0000-4000-8000-000000000001',
  timeEntry: 'e0000000-0000-4000-8000-000000000001',
} as const;

const installationBinding = 'B'.repeat(43);
const lookupKey = 'K'.repeat(43);

describe('Mobile complete offline clients', () => {
  it.each([
    ['current, valid member', AuthenticatedHttpRequestExecutor, 403],
    ['before T068a, valid member', PreT068aExecutor, 403],
    ['current, hidden historical denial', AuthenticatedHttpRequestExecutor, 503],
    ['before T068a, hidden historical denial', PreT068aExecutor, 503],
  ] as const)(
    'T068a retains every SQLite row during pause and completes transmission/archive cleanup after resume (%s)', async (_version, Executor, pauseStatus) => {
      const h = await archiveHarness();
      let paused = false;
      const serverIngest = h.ingest.getMockImplementation()!;
      const serverReconcile = h.reconcile.getMockImplementation()!;
      const authentication: AuthenticatedRequestCapability = {
        executeAuthenticatedRequest: async attempt => attempt(() => 'synthetic'),
      };
      const executor = new Executor(authentication, async (url, init) => {
        if (paused) return Response.json({ error: { code: pauseStatus === 403 ? 'organization_paused' : 'service_unavailable' } }, { status: pauseStatus });
        const body = JSON.parse(init.body);
        return Response.json(url.includes('/reconcile') ? await serverReconcile(body.workEventIds) : await serverIngest(body));
      });
      const client = new OfflineLifecycleClient(new URL('https://api.example/'), executor);
      h.ingest.mockImplementation(command => client.ingest(command));
      h.reconcile.mockImplementation(eventIds => client.reconcile(eventIds));
      try {
        await h.append(1); await h.append(2);
        await h.scheduler.trigger('event_append');
        expect(await h.rows()).toEqual([1, 2].map(n => ({ work_event_id: eventId(n), queue_state: 'confirmed_awaiting_archive' })));
        await h.append(3);
        const before = await h.rows();
        const evidence = () => h.connection.getAllAsync('SELECT work_event_id, receipt_id, command_json FROM offline_event_queue ORDER BY device_sequence');
        const beforeEvidence = await evidence();
        paused = true;
        await h.scheduler.trigger('event_append');
        await h.poll();
        await h.scheduler.trigger('network_hint');
        expect((await h.rows()).map(row => row.work_event_id)).toEqual(before.map(row => row.work_event_id));
        expect(await evidence()).toEqual(beforeEvidence);
        expect(h.records.has(eventId(3))).toBe(false);
        paused = false;
        await h.poll();
        await h.scheduler.trigger('session_restored');
        expect([...h.records.keys()].sort()).toEqual([1, 2, 3].map(eventId));
        expect(await h.rows()).toHaveLength(3);
        for (const [id, record] of h.records) h.records.set(id, { ...record, archiveStatus: 'offsite_archived' });
        for (let remaining = before.length + 1; (await h.rows()).length > 0 && remaining > 0; remaining -= 1) await h.poll();
        expect(await h.rows()).toEqual([]);
      } finally { await h.close(); }
    });
  it('assembles strict immutable lease pages and verifies the total manifest before returning',
    async () => {
      const complete = leasePageV3();
      const first = { ...complete, items: complete.items.slice(0, 1), nextCursor: 'next' };
      const second = { ...complete, items: complete.items.slice(1), nextCursor: null };
      const request = new FakeRequest(async (endpoint) => response(200, {
        status: 'ready',
        idempotentRetry: false,
        page: endpoint.pathname.endsWith('/page') ? second : first,
      }));
      const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), request);

      await expect(client.issueCompleteV3({
        commandId: ids.command,
        installationBinding,
        lookupKey,
      })).resolves.toEqual({
        status: 'ready',
        idempotentRetry: false,
        page: complete,
      });
      expect(request.calls).toHaveLength(2);
      expect(request.calls[1]!.options).toEqual({ maximumResponseBytes: 65_536 });
    });

  it('fails a lease generation closed on duplicate cross-page lookup data', async () => {
    const complete = leasePageV3();
    const first = complete.items[0]!;
    if (first.itemType !== 'nfc_assignment') throw new Error('Expected NFC item');
    const duplicate = { ...first, itemId: complete.items[1]!.itemId };
    const request = new FakeRequest(async (endpoint) => response(200, {
      status: 'ready',
      idempotentRetry: false,
      page: endpoint.pathname.endsWith('/page')
        ? { ...complete, items: [duplicate], nextCursor: null }
        : { ...complete, items: complete.items.slice(0, 1), nextCursor: 'next' },
    }));
    const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), request);

    await expect(client.issueCompleteV3({
      commandId: ids.command,
      installationBinding,
      lookupKey,
    })).resolves.toEqual({ status: 'incomplete_or_oversize' });
  });

  it('assembles a strict v3 mixed NFC/manual lease and uses only additive routes', async () => {
    const complete = leasePageV3();
    const first = { ...complete, items: complete.items.slice(0, 1), nextCursor: 'next-v2' };
    const second = { ...complete, items: complete.items.slice(1), nextCursor: null };
    const request = new FakeRequest(async (endpoint) => response(200, {
      status: 'ready',
      idempotentRetry: false,
      page: endpoint.pathname.endsWith('/page') ? second : first,
    }));
    const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), request);
    await expect(client.issueCompleteV3({
      commandId: ids.command,
      installationBinding,
      lookupKey,
    })).resolves.toEqual({
      status: 'ready',
      idempotentRetry: false,
      page: complete,
    });
    expect(request.calls.map(({ endpoint }) => endpoint.pathname)).toEqual([
      '/v3/offline-capture-leases',
      '/v3/offline-capture-leases/page',
    ]);
  });

  it('fails a lease generation closed on a non-adjacent pagination cursor cycle', async () => {
    const complete = leasePageV3();
    let pageRequest = 0;
    const request = new FakeRequest(async (endpoint) => {
      if (!endpoint.pathname.endsWith('/page')) {
        return response(200, {
          status: 'ready',
          idempotentRetry: false,
          page: { ...complete, items: [], nextCursor: 'cursor-a' },
        });
      }
      pageRequest += 1;
      return response(200, {
        status: 'ready',
        idempotentRetry: true,
        page: {
          ...complete,
          items: [],
          nextCursor: pageRequest === 1 ? 'cursor-b' : 'cursor-a',
        },
      });
    });
    const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), request);

    await expect(client.issueCompleteV3({
      commandId: ids.command,
      installationBinding,
      lookupKey,
    })).resolves.toEqual({ status: 'incomplete_or_oversize' });
    expect(request.calls).toHaveLength(3);
  });

  it('accepts only exact durable offline IDs and exact matching bounded Retry-After', async () => {
    const command = offlineCommand();
    const request = new FakeRequest(async () => response(202, {
      status: 'pending',
      reason: 'lock_retry',
      retryAfterSeconds: 17,
    }, 17));
    const client = new OfflineLifecycleClient(new URL('https://api.example/'), request);
    await expect(client.ingest(command)).resolves.toEqual({
      status: 'pending',
      reason: 'lock_retry',
      retryAfterSeconds: 17,
    });

    request.handler = async () => response(200, {
      status: 'synchronized',
      archiveStatus: 'offsite_archived',
      idempotentRetry: false,
      workEventId: ids.event,
      receiptId: ids.receipt,
      deviceSequence: 2,
      decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
    });
    await expect(client.ingest(command)).resolves.toEqual({ status: 'unavailable' });
  });

  it.each(['archive_pending', 'offsite_archived'] as const)(
    'requires the exact decision/review field sets with %s', async (archiveStatus) => {
      const identity = { workEventId: ids.event, receiptId: ids.receipt, deviceSequence: 1 };
      const decisions = [
        { status: 'synchronized', decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry } },
        { status: 'review_pending', reason: 'capture_time_out_of_bounds' },
      ];
      for (const result of decisions) {
        const body = { ...identity, ...result, archiveStatus, idempotentRetry: false };
        const request = new FakeRequest(async () => response(result.status === 'synchronized' ? 200 : 202, body));
        const client = new OfflineLifecycleClient(new URL('https://api.example/'), request);
        await expect(client.ingest(offlineCommand())).resolves.toEqual(body);
        request.handler = async () => response(result.status === 'synchronized' ? 200 : 202, { ...body, unexpected: true });
        await expect(client.ingest(offlineCommand())).resolves.toEqual({ status: 'unavailable' });
        request.handler = async () => response(200, {
          status: 'ready', records: [{ ...identity, archiveStatus, result }],
        });
        await expect(client.reconcile([ids.event])).resolves.toEqual({
          status: 'ready', records: [{ ...identity, archiveStatus, result }],
        });
        request.handler = async () => response(200, {
          status: 'ready', records: [{ ...identity, archiveStatus, result: { ...result, unexpected: true } }],
        });
        await expect(client.reconcile([ids.event])).resolves.toEqual({ status: 'unavailable' });
      }
    });

  it('parses a tenant-scoped exact-ID reconciliation without accepting extras', async () => {
    const request = new FakeRequest(async () => response(200, {
      status: 'ready',
      records: [{
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
        archiveStatus: 'offsite_archived',
        result: {
          status: 'synchronized',
          decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
        },
      }],
    }));
    const client = new OfflineLifecycleClient(new URL('https://api.example/'), request);
    await expect(client.reconcile([ids.event])).resolves.toMatchObject({
      status: 'ready',
      records: [{ workEventId: ids.event, deviceSequence: 1 }],
    });
    await expect(client.reconcile([ids.event, ids.event]))
      .resolves.toEqual({ status: 'unavailable' });
  });

  it('accepts only an exact echoed high-water review-state clear proof', async () => {
    const request = new FakeRequest(async () => response(200, {
      status: 'clear',
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
      confirmedThroughSequence: 4,
    }));
    const client = new OfflineLifecycleClient(new URL('https://api.example/'), request);
    await expect(client.readReviewState({
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
    })).resolves.toEqual({
      status: 'clear',
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
      confirmedThroughSequence: 4,
    });
    request.handler = async () => response(200, {
      status: 'clear',
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
      confirmedThroughSequence: -1,
    });
    await expect(client.readReviewState({
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
    })).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('Mobile FIFO scheduler and legacy migration', () => {
  it('re-arms the persisted retry deadline after a second early trigger with real SQLite',
    async () => {
      let now = 10_000;
      const connection = new NodeSqliteOfflineConnection();
      const database = new OfflineCaptureDatabase(
        async () => connection,
        new Uint8Array(32).fill(1),
      );
      await expect(database.initialize()).resolves.toEqual({ status: 'ready' });
      await expect(database.bindOwner({
        organizationId: ids.organization,
        userId: ids.user,
        membershipId: ids.membership,
        installationBindingDigest: '0'.repeat(64),
      })).resolves.toEqual({ status: 'ready' });
      await expect(database.activateLease({
        page: leasePage(),
        activationBootMarker: 'retry-proof-boot',
        activationMonotonicMilliseconds: now,
      })).resolves.toEqual({ status: 'ready' });
      const { deviceSequence: _deviceSequence, ...draft } = offlineCommand();
      await expect(database.appendEvent(draft)).resolves.toMatchObject({ status: 'ready' });

      const ingest = vi.fn(async () => ({ status: 'unavailable' as const }));
      const timer = new ControlledSchedulerTimer(() => now);
      const scheduler = new OfflineSyncScheduler(
        database,
        {
          ingest,
          async reconcile() { return { status: 'ready', records: [] }; },
          async readReviewState() { return { status: 'unavailable' }; },
        },
        { async ingest() { return { status: 'transient_failure' }; } },
        { async rejectOfflineCapture() {} },
        () => now,
        () => 0.5,
        timer,
      );

      await expect(scheduler.trigger('runtime_start')).resolves.toEqual({
        status: 'retry_wait',
        queueCount: 1,
      });
      const retryAt = timer.onlyDeadline();
      now += Math.floor((retryAt - now) / 2);

      await expect(scheduler.trigger('network_hint')).resolves.toEqual({
        status: 'retry_wait',
        queueCount: 1,
      });
      expect(timer.onlyDeadline()).toBe(retryAt);
      expect(ingest).toHaveBeenCalledTimes(1);

      now = retryAt;
      timer.fireDue();
      await vi.waitFor(() => expect(ingest).toHaveBeenCalledTimes(2));
      scheduler.stop();
      await database.close();
    });

  it('sends the second event and returns its own decision while the first remains unarchived in real SQLite', async () => {
    const connection = new NodeSqliteOfflineConnection();
    const database = new OfflineCaptureDatabase(async () => connection, new Uint8Array(32).fill(8));
    await database.initialize();
    await database.bindOwner({ organizationId: ids.organization, userId: ids.user,
      membershipId: ids.membership, installationBindingDigest: '8'.repeat(64) });
    await database.activateLease({ page: leasePage(), activationBootMarker: 'boot-1', activationMonotonicMilliseconds: 100 });
    const { deviceSequence: _sequence, ...first } = offlineCommand();
    const second = { ...first,
      workEvent: { ...first.workEvent, id: 'c0000000-0000-4000-8000-000000000002' },
      receipt: { ...first.receipt, id: 'd0000000-0000-4000-8000-000000000002' } };
    await database.appendEvent(first);
    await database.appendEvent(second);
    const ingest = vi.fn<OfflineLifecycleApiPort['ingest']>(async (command) => ({
      status: 'synchronized', archiveStatus: 'archive_pending', idempotentRetry: false,
      workEventId: command.workEvent.id, receiptId: command.receipt.id,
      deviceSequence: command.deviceSequence,
      decision: { status: command.deviceSequence === 1 ? 'time_entry_started' : 'time_entry_stopped',
        timeEntryId: ids.timeEntry },
    }));
    const scheduler = schedulerFor(database, { ingest,
      async reconcile() { return { status: 'ready', records: [] }; },
      async readReviewState() { return { status: 'unavailable' }; } });
    try {
      const state = await scheduler.trigger('event_append');
      expect(ingest.mock.calls.map(([command]) => command.workEvent.id))
        .toEqual([first.workEvent.id, second.workEvent.id]);
      expect(state).toMatchObject({ status: 'server_decision', queueCount: 0,
        workEventId: second.workEvent.id,
        decision: { status: 'time_entry_stopped', timeEntryId: ids.timeEntry } });
      expect(await connection.getAllAsync('SELECT work_event_id, queue_state FROM offline_event_queue ORDER BY device_sequence'))
        .toEqual([first, second].map((event) => ({ work_event_id: event.workEvent.id,
          queue_state: 'confirmed_awaiting_archive' })));
      await expect(database.queueCount()).resolves.toBe(0);
    } finally { scheduler.stop(); await database.close(); }
  });

  it('keeps a server-committed event in real SQLite while its archive is still pending',
    async () => {
      const now = 20_000;
      const connection = new NodeSqliteOfflineConnection();
      const database = new OfflineCaptureDatabase(
        async () => connection,
        new Uint8Array(32).fill(2),
      );
      await expect(database.initialize()).resolves.toEqual({ status: 'ready' });
      await expect(database.bindOwner({
        organizationId: ids.organization,
        userId: ids.user,
        membershipId: ids.membership,
        installationBindingDigest: '1'.repeat(64),
      })).resolves.toEqual({ status: 'ready' });
      await expect(database.activateLease({
        page: leasePage(),
        activationBootMarker: 'archive-proof-boot',
        activationMonotonicMilliseconds: now,
      })).resolves.toEqual({ status: 'ready' });
      const { deviceSequence: _deviceSequence, ...draft } = offlineCommand();
      await expect(database.appendEvent(draft)).resolves.toMatchObject({ status: 'ready' });

      const ingest = vi.fn(async () => ({
        status: 'synchronized' as const,
        archiveStatus: 'archive_pending' as const,
        decision: { status: 'time_entry_started' as const, timeEntryId: ids.timeEntry },
        idempotentRetry: false,
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
      }));
      const timer = new ControlledSchedulerTimer(() => now);
      const scheduler = new OfflineSyncScheduler(
        database,
        {
          ingest,
          async reconcile() { return { status: 'ready', records: [] }; },
          async readReviewState() { return { status: 'unavailable' }; },
        },
        { async ingest() { return { status: 'transient_failure' }; } },
        { async rejectOfflineCapture() {} },
        () => now,
        () => 0.5,
        timer,
      );

      await expect(scheduler.trigger('network_hint')).resolves.toEqual({
        status: 'server_decision',
        workEventId: ids.event,
        decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
        queueCount: 0,
      });
      expect(ingest).toHaveBeenCalledOnce();
      await expect(database.readAwaitingArchive(0, 25)).resolves.toEqual([
        { workEventId: ids.event, receiptId: ids.receipt, deviceSequence: 1 },
      ]);
      await expect(database.queueCount()).resolves.toBe(0);
      await expect(database.readNextRetryAt()).resolves.toBeNull();

      scheduler.stop();
      await database.close();
    });

  it.each(['synchronized', 'review_pending'] as const)(
    'retains a recovered %s in real SQLite until archival proof', async (status) => {
      let now = 20_000;
      const database = new OfflineCaptureDatabase(async () => new NodeSqliteOfflineConnection(), new Uint8Array(32).fill(5));
      await database.initialize();
      await database.bindOwner({ organizationId: ids.organization, userId: ids.user,
        membershipId: ids.membership, installationBindingDigest: '5'.repeat(64) });
      await database.activateLease({ page: leasePage(), activationBootMarker: 'boot-1', activationMonotonicMilliseconds: now });
      const { deviceSequence: _sequence, ...draft } = offlineCommand();
      await database.appendEvent(draft);
      let archiveStatus: 'archive_pending' | 'offsite_archived' = 'archive_pending';
      const result = status === 'synchronized'
        ? { status, decision: { status: 'time_entry_stopped' as const, timeEntryId: ids.timeEntry } }
        : { status, reason: 'capture_time_out_of_bounds' as const };
      const ingest = vi.fn(async () => ({ status: 'unavailable' as const }));
      const scheduler = new OfflineSyncScheduler(database, {
        ingest,
        async reconcile() { return { status: 'ready', records: [{ workEventId: ids.event,
          receiptId: ids.receipt, deviceSequence: 1, archiveStatus, result }] }; },
        async readReviewState() { return { status: 'unavailable' }; },
      }, { async ingest() { return { status: 'unavailable' }; } },
      { async rejectOfflineCapture() {} }, () => now, () => 0.5,
      { schedule() { return 1; }, cancel() {} });
      try {
        expect(await scheduler.trigger('runtime_start')).toMatchObject({
          status: status === 'synchronized' ? 'server_decision' : 'review_pending',
          queueCount: 0, workEventId: ids.event,
        });
        await expect(database.queueCount()).resolves.toBe(0);
        await expect(database.readAwaitingArchive(0, 25)).resolves.toHaveLength(1);
        now += OFFLINE_ARCHIVE_POLL_MILLISECONDS;
        await scheduler.reconcileArchives();
        await expect(database.readAwaitingArchive(0, 25)).resolves.toHaveLength(1);
        now += OFFLINE_ARCHIVE_POLL_MILLISECONDS;
        archiveStatus = 'offsite_archived';
        await scheduler.reconcileArchives();
        await expect(database.readAwaitingArchive(0, 25)).resolves.toHaveLength(0);
        await expect(database.queueCount()).resolves.toBe(0);
        expect(ingest).not.toHaveBeenCalled();
      } finally { scheduler.stop(); await database.close(); }
    });

  it('polls independently and deletes only the exact archived row, leaving unconfirmed and pending-archive evidence intact', async () => {
    const h = await archiveHarness();
    try {
      await h.append(1); await h.append(2);
      await h.scheduler.trigger('event_append');
      await h.append(3); // Not yet sent: even an unsolicited archive record cannot acknowledge it.
      const before = h.scheduler.getState();
      h.reconcile.mockClear();
      await h.scheduler.reconcileArchives();
      expect(h.reconcile).not.toHaveBeenCalled(); // Own cadence, no tap-driven polling.
      await h.poll();
      expect(await h.rows()).toHaveLength(3);
      h.records.set(eventId(2), { ...h.records.get(eventId(2))!, archiveStatus: 'offsite_archived' });
      await h.poll();
      expect(await h.rows()).toEqual([
        { work_event_id: eventId(1), queue_state: 'confirmed_awaiting_archive' },
        { work_event_id: eventId(3), queue_state: 'pending' },
      ]);
      expect(h.scheduler.getState()).toBe(before); // No second decision or feedback from cleanup.
      await expect(h.database.queueCount()).resolves.toBe(1);
    } finally { await h.close(); }
  });

  it.each(['receipt', 'sequence', 'unrequested', 'duplicate', 'unavailable', 'authority_rejected'] as const)(
    'retains all rows on an archive reply with %s', async (fault) => {
      const h = await archiveHarness();
      try {
        await h.append(1); await h.append(2);
        await h.scheduler.trigger('event_append');
        const first = { ...h.records.get(eventId(1))!, archiveStatus: 'offsite_archived' as const };
        const wrong = { ...h.records.get(eventId(2))!, archiveStatus: 'offsite_archived' as const };
        if (fault === 'receipt') wrong.receiptId = ids.receipt;
        if (fault === 'sequence') wrong.deviceSequence = 1;
        if (fault === 'unrequested') wrong.workEventId = eventId(3);
        h.reconcile.mockResolvedValueOnce(fault === 'unavailable' || fault === 'authority_rejected'
          ? { status: fault }
          : { status: 'ready', records: fault === 'duplicate' ? [first, first] : [first, wrong] });
        await h.poll();
        expect(await h.rows()).toHaveLength(2);
        await expect(h.database.acknowledgeArchived(h.records.get(eventId(1))!))
          .rejects.toThrow('archival proof');
      } finally { await h.close(); }
    });

  it('does not let a hung archive request block the next capture or its decision and ignores a response after stop', async () => {
    const h = await archiveHarness();
    let release!: (result: Awaited<ReturnType<OfflineLifecycleApiPort['reconcile']>>) => void;
    const gate = new Promise<Awaited<ReturnType<OfflineLifecycleApiPort['reconcile']>>>((resolve) => { release = resolve; });
    try {
      await h.append(1); await h.scheduler.trigger('event_append');
      h.reconcile.mockImplementationOnce(() => gate);
      const polling = h.poll();
      await vi.waitFor(() => expect(h.reconcile).toHaveBeenCalledTimes(2));
      await h.append(2);
      expect(await h.scheduler.trigger('event_append')).toMatchObject({ status: 'server_decision',
        workEventId: eventId(2), decision: { status: 'time_entry_stopped' }, queueCount: 0 });
      h.scheduler.stop();
      release({ status: 'ready', records: [{ ...h.records.get(eventId(1))!, archiveStatus: 'offsite_archived' }] });
      await polling;
      expect(await h.rows()).toHaveLength(2);
    } finally { release({ status: 'unavailable' }); await h.close(); }
  });

  it('rearms an archive wakeup that fires before its deadline instead of abandoning the retained rows', async () => {
    const h = await archiveHarness();
    try {
      await h.append(1); await h.scheduler.trigger('event_append');
      h.records.set(eventId(1), { ...h.records.get(eventId(1))!, archiveStatus: 'offsite_archived' });
      h.reconcile.mockClear();
      // setTimeout may expire while wall time has moved backwards.
      h.timer.fireEarly();
      expect(h.timer.onlyDeadline()).toBeGreaterThan(20_000);
      expect(h.reconcile).not.toHaveBeenCalled();
      await h.poll();
      expect(await h.rows()).toHaveLength(0);
    } finally { await h.close(); }
  });

  it('rotates bounded archive batches even while earlier rows remain unarchived', async () => {
    const h = await archiveHarness();
    try {
      const last = OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS + 1;
      for (let sequence = 1; sequence <= last; sequence++) await h.append(sequence);
      await h.scheduler.trigger('event_append');
      h.records.set(eventId(last), { ...h.records.get(eventId(last))!, archiveStatus: 'offsite_archived' });
      h.reconcile.mockClear();
      await h.poll(); await h.poll();
      expect(h.reconcile.mock.calls.map(([ids]) => ids.length)).toEqual([OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS, 1]);
      expect(await h.rows()).toHaveLength(last - 1);
      expect((await h.rows()).some((row) => row.work_event_id === eventId(last))).toBe(false);
    } finally { await h.close(); }
  });

  it('counts retained confirmations against storage capacity, not against pending transmission', async () => {
    const h = await archiveHarness();
    try {
      for (let sequence = 1; sequence <= OFFLINE_QUEUE_MAXIMUM_EVENTS; sequence++) await h.append(sequence);
      await h.scheduler.trigger('event_append');
      await expect(h.database.queueCount()).resolves.toBe(0);
      await expect(h.database.appendEvent(eventDraft(OFFLINE_QUEUE_MAXIMUM_EVENTS + 1)))
        .resolves.toEqual({ status: 'full' });
      expect(await h.rows()).toHaveLength(OFFLINE_QUEUE_MAXIMUM_EVENTS);
    } finally { await h.close(); }
  });

  it('resumes archive retention after reopening actual SQLite and keeps the review marker until its separate proof', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'taptime-t052-queue-'));
    const filename = join(directory, 'offline.db');
    let h = await archiveHarness(filename, 'review_pending');
    try {
      await h.append(1); await h.scheduler.trigger('event_append');
      const record = h.records.get(eventId(1))!;
      await h.close();
      h = await archiveHarness(filename);
      await expect(h.database.queueCount()).resolves.toBe(0);
      await expect(h.database.readReviewPendingSequence()).resolves.toBe(1);
      expect(await h.rows()).toHaveLength(1);
      await expect(h.database.bindOwner({ organizationId: ids.organization, userId: ids.user,
        membershipId: ids.membership, installationBindingDigest: '8'.repeat(64) }))
        .resolves.toEqual({ status: 'ready' });
      h.records.set(eventId(1), { ...record, archiveStatus: 'offsite_archived' });
      await h.poll();
      expect(await h.rows()).toHaveLength(0);
      await expect(h.database.readReviewPendingSequence()).resolves.toBe(1);
      expect(h.ingest).not.toHaveBeenCalled();
    } finally { await h.close(); await rm(directory, { recursive: true, force: true }); }
  });

  it('migrates populated schema v4 in real SQLite without changing evidence, its owner or the next device sequence', async () => {
    const connection = new NodeSqliteOfflineConnection();
    const page = leasePage();
    const command = offlineCommand();
    await connection.execAsync(OFFLINE_SCHEMA_V4 + 'PRAGMA user_version = 4;');
    await connection.runAsync(`INSERT INTO offline_owner VALUES (1, ?, ?, ?, ?, ?, ?, 1, NULL, 0)`,
      [ids.organization, ids.user, ids.membership, '8'.repeat(64), ids.installation, ids.identity]);
    await connection.runAsync(`INSERT INTO offline_lease_generations VALUES
      (?, ?, ?, ?, ?, ?, 1, 'employee', ?, ?, ?, ?, ?, ?, 'boot-1', 100, 1, 1, 'active')`,
      [ids.lease, ids.installation, ids.identity, ids.organization, ids.user, ids.membership,
        page.issuedAt, page.expiresAt, page.configurationRevision, page.itemCount, page.serializedBytes, page.manifestDigest]);
    const item = page.items[0]!;
    await connection.runAsync(`INSERT INTO offline_lease_items VALUES
      (?, ?, 'nfc_assignment', 'work', ?, ?, ?, 'customer', ?, ?, NULL, NULL)`,
      [ids.lease, ids.item1, item.lookup, ids.assignment1, ids.tag1, ids.customer1, item.displayName]);
    const evidence = JSON.stringify(command);
    await connection.runAsync(`INSERT INTO offline_event_queue VALUES (?, ?, ?, ?, ?, ?, ?, 'in_flight', 2, 30000)`,
      [1, ids.event, ids.receipt, ids.lease, ids.item1, evidence, new TextEncoder().encode(evidence).length]);
    const database = new OfflineCaptureDatabase(async () => connection, new Uint8Array(32).fill(8));
    try {
      await expect(database.initialize()).resolves.toEqual({ status: 'ready' });
      expect(await connection.getFirstAsync('PRAGMA user_version')).toEqual({ user_version: 6 });
      expect(await database.claimHead(100)).toMatchObject({ command, attemptCount: 2 });
      await database.confirmHead({ workEventId: ids.event, receiptId: ids.receipt, deviceSequence: 1 }, 'synchronized');
      expect(await connection.getFirstAsync('SELECT command_json FROM offline_event_queue')).toEqual({ command_json: evidence });
      await expect(connection.runAsync('UPDATE offline_event_queue SET command_json = ?', ['{}']))
        .rejects.toThrow('immutable');
      await expect(database.appendEvent(eventDraft(2))).resolves.toMatchObject({ status: 'ready', command: { deviceSequence: 2 } });
      expect(await connection.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
      await expect(database.bindOwner({ organizationId: ids.organization, userId: ids.user,
        membershipId: ids.membership, installationBindingDigest: '9'.repeat(64) }))
        .resolves.toEqual({ status: 'protected', reason: 'identity_mismatch' });
    } finally { await database.close(); }
  });

  it('keeps legacy evidence until the unchanged v1 acknowledgement becomes durable',
    async () => {
    let now = 25_000;
    const evidence = legacyEvidence();
    const connection = new NodeSqliteOfflineConnection();
    const database = new OfflineCaptureDatabase(
      async () => connection,
      new Uint8Array(32).fill(3),
    );
    await expect(database.initialize()).resolves.toEqual({ status: 'ready' });
    await expect(database.bindOwner({
      organizationId: ids.organization,
      userId: ids.user,
      membershipId: ids.membership,
      installationBindingDigest: '2'.repeat(64),
    })).resolves.toEqual({ status: 'ready' });
    await expect(database.importLegacyReplayable(evidence.submission))
      .resolves.toEqual({ status: 'ready' });

    const legacyIngest = vi.fn<() => Promise<LifecycleEventResult>>()
      .mockResolvedValueOnce({ status: 'unavailable' })
      .mockResolvedValueOnce({
        status: 'synchronized',
        idempotentRetry: true,
        decision: { status: 'time_entry_started', timeEntryId: TimeEntryId(ids.timeEntry) },
        workEventId: evidence.submission.command.workEvent.id,
        receiptId: evidence.submission.command.receipt.id,
        serverTimeEntryId: TimeEntryId(ids.timeEntry),
      });
    const timer = new ControlledSchedulerTimer(() => now);
    const scheduler = new OfflineSyncScheduler(
      database,
      {
        async ingest() { return { status: 'unavailable' }; },
        async reconcile() { return { status: 'ready', records: [] }; },
        async readReviewState() { return { status: 'unavailable' }; },
      },
      { ingest: legacyIngest },
      { async rejectOfflineCapture() {} },
      () => now,
      () => 0.5,
      timer,
    );

    await expect(scheduler.trigger('network_hint')).resolves.toEqual({
      status: 'retry_wait',
      queueCount: 1,
    });
    const retryAt = timer.onlyDeadline();
    await expect(database.queueCount()).resolves.toBe(1);
    await expect(database.verifyLegacyReplayable(evidence.submission)).resolves.toBe(true);

    now += Math.floor((retryAt - now) / 2);
    await expect(scheduler.trigger('foreground')).resolves.toEqual({
      status: 'retry_wait',
      queueCount: 1,
    });
    expect(legacyIngest).toHaveBeenCalledOnce();
    expect(timer.onlyDeadline()).toBe(retryAt);

    now = retryAt;
    timer.fireDue();
    await vi.waitFor(() => expect(legacyIngest).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => expect(await database.queueCount()).toBe(0));

    scheduler.stop();
    await database.close();
  });

  it('clears only the exact encrypted marker covered by an authenticated server high-water proof',
    async () => {
      const clearReviewPendingSequence = vi.fn(async () => true);
      const database = fakeDatabase({
        queueCount: vi.fn(async () => 0),
        readReviewPendingSequence: vi.fn(async () => 3),
        readActiveCaptureContext: vi.fn(async () => ({
          membershipId: ids.membership,
          installationId: ids.installation,
        })),
        clearReviewPendingSequence,
      });
      const offline: OfflineLifecycleApiPort = {
        async ingest() { return { status: 'unavailable' }; },
        async reconcile() { return { status: 'ready', records: [] }; },
        async readReviewState() {
          return {
            status: 'clear',
            expectedMembershipId: ids.membership,
            installationId: ids.installation,
            confirmedThroughSequence: 3,
          };
        },
      };
      await expect(schedulerFor(database, offline).trigger('session_restored'))
        .resolves.toEqual({ status: 'idle', queueCount: 0 });
      expect(clearReviewPendingSequence).toHaveBeenCalledWith(3, 3);
    });

  it('recovers a lost response through reconciliation and never resubmits the event', async () => {
    const command = offlineCommand();
    const database = fakeDatabase({
      queueCount: vi.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0),
      claimLegacyHead: vi.fn(async () => null),
      claimHead: vi.fn(async () => ({
        state: 'in_flight',
        attemptCount: 0,
        nextAttemptAt: null,
        command,
      })),
      acknowledgeHead: vi.fn(async () => undefined),
    });
    const ingest = vi.fn();
    const offline: OfflineLifecycleApiPort = {
      ingest,
      async reconcile(): Promise<OfflineReconciliationResultV2> {
        return {
          status: 'ready',
          records: [{
            workEventId: ids.event,
            receiptId: ids.receipt,
            deviceSequence: 1,
            archiveStatus: 'offsite_archived',
            result: {
              status: 'synchronized',
              decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
            },
          }],
        };
      },
      async readReviewState() { return { status: 'unavailable' }; },
    };
    const scheduler = schedulerFor(database, offline);

    await expect(scheduler.trigger('runtime_start')).resolves.toEqual({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
    });
    expect(ingest).not.toHaveBeenCalled();
    expect(database.acknowledgeHead).toHaveBeenCalledWith({
      workEventId: ids.event,
      receiptId: ids.receipt,
      deviceSequence: 1,
    }, 'synchronized');
  });

  it('persists a review result before deletion and never downgrades it on an empty later trigger',
    async () => {
      const command = offlineCommand();
      let reviewPendingSequence: number | null = null;
      const database = fakeDatabase({
        queueCount: vi.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
        claimLegacyHead: vi.fn(async () => null),
        claimHead: vi.fn(async () => ({
          state: 'in_flight',
          attemptCount: 0,
          nextAttemptAt: null,
          command,
        })),
        acknowledgeHead: vi.fn(async (
          identity: { readonly deviceSequence: number },
          status: 'synchronized' | 'review_pending',
        ) => {
          if (status === 'review_pending') {
            reviewPendingSequence ??= identity.deviceSequence;
          }
        }),
        readReviewPendingSequence: vi.fn(async () => reviewPendingSequence),
      });
      const offline: OfflineLifecycleApiPort = {
        async reconcile() { return { status: 'ready', records: [] }; },
        async readReviewState() { return { status: 'unavailable' }; },
        async ingest() {
          return {
            status: 'review_pending',
            archiveStatus: 'offsite_archived',
            idempotentRetry: false,
            reason: 'historical_configuration_not_valid',
            workEventId: ids.event,
            receiptId: ids.receipt,
            deviceSequence: 1,
          };
        },
      };
      const scheduler = schedulerFor(database, offline);

      await expect(scheduler.trigger('network_hint')).resolves.toEqual({
        status: 'review_pending',
        queueCount: 0,
        workEventId: ids.event,
      });
      expect(database.acknowledgeHead).toHaveBeenCalledWith({
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
      }, 'review_pending');
      await expect(scheduler.trigger('session_restored')).resolves.toEqual({
        status: 'review_pending',
        queueCount: 0,
      });
      expect(database.claimHead).toHaveBeenCalledTimes(1);
    });

  it('coalesces overlapping triggers into one flight and retains the exact FIFO head', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const command = offlineCommand();
    const database = fakeDatabase({
      queueCount: vi.fn(async () => 1),
      claimLegacyHead: vi.fn(async () => null),
      claimHead: vi.fn(async () => ({
        state: 'in_flight',
        attemptCount: 0,
        nextAttemptAt: null,
        command,
      })),
      retainHeadForRetry: vi.fn(async () => undefined),
    });
    const offline: OfflineLifecycleApiPort = {
      async ingest() { return { status: 'unavailable' }; },
      async readReviewState() { return { status: 'unavailable' }; },
      async reconcile() {
        await gate;
        return { status: 'ready', records: [] };
      },
    };
    const timer = { schedule: vi.fn(() => 1), cancel: vi.fn() };
    const scheduler = schedulerFor(database, offline, timer);
    const first = scheduler.trigger('foreground');
    const second = scheduler.trigger('network_hint');
    expect(second).toBe(first);
    release();
    await first;
    expect(database.claimHead).toHaveBeenCalledTimes(1);
    expect(database.retainHeadForRetry).toHaveBeenCalledWith(
      {
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
      },
      1,
      10_000,
    );
  });

  it('uses full jitter with the accepted cap and exact Retry-After precedence', () => {
    expect(retryDelay(0, undefined, () => 0)).toBe(0);
    expect(retryDelay(0, undefined, () => 0.5)).toBe(1_000);
    expect(retryDelay(30, undefined, () => 0.999999)).toBeLessThanOrEqual(300_000);
    expect(retryDelay(4, 17, () => 0)).toBe(17_000);
  });

  it('imports and reads back exact v2 evidence before clearing the legacy key', async () => {
    const evidence = legacyEvidence();
    const clear = vi.fn(async () => undefined);
    const outbox: LifecycleEvidenceOutbox = {
      async read() { return evidence; },
      async write() {},
      clear,
    };
    const database = fakeDatabase({
      importLegacyReplayable: vi.fn(async () => ({ status: 'ready' })),
      verifyLegacyReplayable: vi.fn(async () => true),
      hasProtectedLegacy: vi.fn(async () => false),
    });
    const importer = new LegacyLifecycleEvidenceImporter(
      outbox,
      database,
      () => new Date('2026-07-18T12:00:00.000Z'),
    );

    await expect(importer.importOnce()).resolves.toEqual({ status: 'ready' });
    expect(database.verifyLegacyReplayable).toHaveBeenCalledWith(evidence.submission);
    expect(clear).toHaveBeenCalledWith(evidence);
  });

  it('retains the original legacy key and blocks capture when exact clear is ambiguous', async () => {
    const evidence = legacyEvidence();
    const outbox: LifecycleEvidenceOutbox = {
      async read() { return evidence; },
      async write() {},
      async clear() { throw new Error('synthetic clear interruption'); },
    };
    const database = fakeDatabase({
      importLegacyReplayable: vi.fn(async () => ({ status: 'ready' })),
      verifyLegacyReplayable: vi.fn(async () => true),
      hasProtectedLegacy: vi.fn(async () => false),
    });
    await expect(new LegacyLifecycleEvidenceImporter(outbox, database).importOnce())
      .resolves.toEqual({ status: 'protected', reason: 'legacy_clear_ambiguous' });
  });
});

class FakeRequest implements AuthenticatedJsonPostPort {
  calls: Array<{ endpoint: URL; body: string; options: unknown }> = [];

  constructor(
    public handler: (
      endpoint: URL,
      body: string,
    ) => Promise<AuthenticatedHttpResult>,
  ) {}

  async post(endpoint: URL, body: string, options?: unknown): Promise<AuthenticatedHttpResult> {
    this.calls.push({ endpoint, body, options });
    return this.handler(endpoint, body);
  }
}

function response(
  statusCode: number,
  body: unknown,
  retryAfterSeconds?: number,
): AuthenticatedHttpResult {
  return {
    status: 'response',
    statusCode,
    contentType: 'application/json',
    body: JSON.stringify(body),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
}

function leasePage(): OfflineCaptureLeasePage {
  const items = [
    {
      itemId: ids.item1,
      lookup: '1'.repeat(64),
      assignmentId: ids.assignment1,
      nfcTagId: ids.tag1,
      targetType: 'customer' as const,
      targetId: ids.customer1,
      displayName: 'Kunde Eins',
    },
    {
      itemId: ids.item2,
      lookup: '2'.repeat(64),
      assignmentId: ids.assignment2,
      nfcTagId: ids.tag2,
      targetType: 'customer' as const,
      targetId: ids.customer2,
      displayName: 'Kunde Zwei',
    },
  ];
  return Object.freeze({
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identity,
    userId: ids.user,
    organizationId: ids.organization,
    membershipId: ids.membership,
    membershipRowVersion: 1,
    role: 'employee',
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    configurationRevision: '3'.repeat(64),
    itemCount: items.length,
    serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
    manifestDigest: mobileManifestDigest(items),
    items: Object.freeze(items),
    nextCursor: null,
  });
}

function leasePageV3(): OfflineCaptureLeasePageV3 {
  const items = [
    {
      itemType: 'nfc_assignment' as const,
      subjectType: 'work' as const,
      itemId: ids.item1,
      lookup: '1'.repeat(64),
      assignmentId: ids.assignment1,
      nfcTagId: ids.tag1,
      targetType: 'customer' as const,
      targetId: ids.customer1,
      displayName: 'Kunde Eins',
      assignmentRowVersion: 1,
      targetRowVersion: 1,
    },
    {
      itemType: 'manual_target' as const,
      subjectType: 'work' as const,
      itemId: ids.item2,
      targetType: 'project' as const,
      targetId: ids.customer2,
      displayName: 'Projekt Zwei',
      targetRowVersion: 2,
    },
  ];
  return Object.freeze({
    leaseSchemaVersion: 3,
    manifestVersion: 3,
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identity,
    userId: ids.user,
    organizationId: ids.organization,
    membershipId: ids.membership,
    membershipRowVersion: 1,
    role: 'employee',
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    configurationRevision: '3'.repeat(64),
    itemCount: items.length,
    serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
    manifestDigest: mobileManifestDigestV3(items),
    items: Object.freeze(items),
    nextCursor: null,
  });
}

function offlineCommand(): OfflineLifecycleEventCommand {
  return {
    organizationId: ids.organization,
    expectedMembershipId: ids.membership,
    leaseId: ids.lease,
    leaseItemId: ids.item1,
    installationBinding,
    deviceSequence: 1,
    provenanceVersion: 1,
    clock: {
      bootMarker: 'boot-1',
      monotonicAnchorMilliseconds: 100,
      monotonicDeltaMilliseconds: 200,
      wallClockAnchor: '2026-07-18T10:00:00.000Z',
      clockProofStatus: 'verified_same_boot',
      clockProofVersion: 1,
    },
    workEvent: {
      id: ids.event,
      assignmentId: ids.assignment1,
      nfcTagId: ids.tag1,
      target: { targetType: 'customer', targetId: ids.customer1 },
      occurredAt: '2026-07-18T10:00:00.200Z',
    },
    receipt: { id: ids.receipt, attemptNumber: 1 },
  };
}

function fakeDatabase(
  overrides: Record<string, unknown>,
): OfflineCaptureDatabase & Record<string, ReturnType<typeof vi.fn>> {
  return {
    readReviewPendingSequence: vi.fn(async () => null),
    readNextRetryAt: vi.fn(async () => null),
    ...overrides,
  } as unknown as OfflineCaptureDatabase & Record<string, ReturnType<typeof vi.fn>>;
}

function schedulerFor(
  database: OfflineCaptureDatabase,
  offline: OfflineLifecycleApiPort,
  timer = { schedule: vi.fn(() => 1), cancel: vi.fn() },
): OfflineSyncScheduler {
  const legacy: LifecycleEventApiPort = {
    async ingest(): Promise<LifecycleEventResult> {
      return { status: 'transient_failure' };
    },
  };
  return new OfflineSyncScheduler(
    database,
    offline,
    legacy,
    { async rejectOfflineCapture() {} },
    () => 10_000,
    () => 0,
    timer,
  );
}

function legacyEvidence(): PendingLifecycleEvidence {
  return {
    kind: 'replayable',
    binding: {
      organizationId: ids.organization as PendingLifecycleEvidence['binding']['organizationId'],
      userId: ids.user as PendingLifecycleEvidence['binding']['userId'],
      membershipId: ids.membership as PendingLifecycleEvidence['binding']['membershipId'],
    },
    submission: {
      mode: 'canonical',
      expectedMembershipId: ids.membership as PendingLifecycleEvidence['submission']['expectedMembershipId'],
      command: offlineCommandToLegacy(),
    },
  };
}

function offlineCommandToLegacy(): PendingLifecycleEvidence['submission']['command'] {
  const command = offlineCommand();
  return {
    organizationId: command.organizationId as PendingLifecycleEvidence['submission']['command']['organizationId'],
    workEvent: command.workEvent as PendingLifecycleEvidence['submission']['command']['workEvent'],
    receipt: command.receipt,
  };
}

class ControlledSchedulerTimer {
  private nextHandle = 1;
  private readonly scheduled = new Map<
    number,
    { readonly callback: () => void; readonly deadline: number }
  >();

  constructor(private readonly now: () => number) {}

  schedule(callback: () => void, delayMilliseconds: number): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.scheduled.set(handle, {
      callback,
      deadline: this.now() + delayMilliseconds,
    });
    return handle;
  }

  cancel(handle: unknown): void {
    if (typeof handle === 'number') this.scheduled.delete(handle);
  }

  onlyDeadline(): number {
    const deadlines = [...this.scheduled.values()].map(({ deadline }) => deadline);
    if (deadlines.length !== 1) {
      throw new Error(`Expected one scheduled retry, received ${deadlines.length}`);
    }
    return deadlines[0]!;
  }

  fireEarly(): void {
    const first = [...this.scheduled.entries()][0]!;
    this.scheduled.delete(first[0]);
    first[1].callback();
  }

  fireDue(): void {
    const due = [...this.scheduled.entries()]
      .filter(([, scheduled]) => scheduled.deadline <= this.now());
    for (const [handle, scheduled] of due) {
      this.scheduled.delete(handle);
      scheduled.callback();
    }
  }
}

function eventId(sequence: number): string {
  return `c0000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

function eventDraft(sequence: number) {
  const { deviceSequence: _sequence, ...draft } = offlineCommand();
  return { ...draft, workEvent: { ...draft.workEvent, id: eventId(sequence) },
    receipt: { ...draft.receipt, id: `d0000000-0000-4000-8000-${String(sequence).padStart(12, '0')}` } };
}

async function archiveHarness(filename?: string, status: 'synchronized' | 'review_pending' = 'synchronized') {
  const connection = new NodeSqliteOfflineConnection(filename);
  const database = new OfflineCaptureDatabase(async () => connection, new Uint8Array(32).fill(8));
  expect(await database.initialize()).toEqual({ status: 'ready' });
  expect(await database.bindOwner({ organizationId: ids.organization, userId: ids.user,
    membershipId: ids.membership, installationBindingDigest: '8'.repeat(64) })).toEqual({ status: 'ready' });
  expect(await database.activateLease({ page: leasePage(), activationBootMarker: 'boot-1', activationMonotonicMilliseconds: 100 }))
    .toEqual({ status: 'ready' });
  let now = 20_000;
  const records = new Map<string, OfflineReconciliationRecordV2>();
  const reconcile = vi.fn<OfflineLifecycleApiPort['reconcile']>(async (ids) => ({ status: 'ready',
    records: ids.flatMap((id) => records.has(id) ? [records.get(id)!] : []) }));
  const ingest = vi.fn<OfflineLifecycleApiPort['ingest']>(async (command) => {
    const identity = { workEventId: command.workEvent.id, receiptId: command.receipt.id, deviceSequence: command.deviceSequence };
    const result: OfflineReconciliationRecordV2['result'] = status === 'review_pending'
      ? { status, reason: 'capture_time_out_of_bounds' }
      : { status, decision: { status: command.deviceSequence === 1 ? 'time_entry_started' : 'time_entry_stopped', timeEntryId: ids.timeEntry } };
    records.set(identity.workEventId, { ...identity, archiveStatus: 'archive_pending', result });
    return { ...identity, ...result, archiveStatus: 'archive_pending', idempotentRetry: false };
  });
  const timer = new ControlledSchedulerTimer(() => now);
  const scheduler = new OfflineSyncScheduler(database, { ingest, reconcile,
    async readReviewState() { return { status: 'unavailable' }; } },
    { async ingest() { return { status: 'unavailable' }; } }, { async rejectOfflineCapture() {} },
    () => now, () => 0.5, timer);
  scheduler.start();
  return { database, scheduler, connection, records, reconcile, ingest, timer,
    async append(sequence: number) {
      expect(await database.appendEvent(eventDraft(sequence))).toMatchObject({ status: 'ready' });
    },
    rows: () => connection.getAllAsync<{ work_event_id: string; queue_state: string }>(
      'SELECT work_event_id, queue_state FROM offline_event_queue ORDER BY device_sequence'),
    async poll() { now += OFFLINE_ARCHIVE_POLL_MILLISECONDS; timer.fireDue(); await scheduler.reconcileArchives(); },
    async close() { scheduler.stop(); await database.close(); },
  };
}

it('T-069 negotiates and parses the administration reason through offline ingestion and reconciliation',async()=>{
  const decision={status:'escalation_required',reason:'administration_stopped'};
  const request=new FakeRequest(async endpoint=>response(200,endpoint.pathname.includes('reconcile')
    ? {status:'ready',records:[{workEventId:ids.event,receiptId:ids.receipt,deviceSequence:1,archiveStatus:'offsite_archived',result:{status:'synchronized',decision}}]}
    : {status:'synchronized',idempotentRetry:false,workEventId:ids.event,receiptId:ids.receipt,deviceSequence:1,archiveStatus:'offsite_archived',decision}));
  const client=new OfflineLifecycleClient(new URL('https://api.example/'),request);
  expect(await client.ingest(offlineCommand())).toMatchObject({status:'synchronized',decision});
  expect(await client.reconcile([ids.event])).toMatchObject({status:'ready',records:[{result:{decision}}]});
  expect(request.calls.every(c=>(c.options as {includeTimeDetails?:boolean}).includeTimeDetails)).toBe(true);
});
