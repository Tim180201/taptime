import { NodeSqliteOfflineConnection } from '../support/NodeSqliteOfflineConnection';
import { OfflineLifecycleClient } from '../../src/offline/OfflineLifecycleClient';
import { mobileLookupHmac, mobileManifestDigestV3 } from '../../src/offline/MobileLookupHmac';
import { describe, expect, it, vi } from 'vitest';
import {
  createCanonicalNfcUidPayload,
  createTimestamp,
  type NfcScanCaptureResult,
} from '@taptime/core';
import type {
  InternalOfflineRestorationSnapshot,
  MobileSessionState,
  ProductSessionContext,
} from '../../src/auth/contracts';
import type { NfcCaptureLifecyclePort } from '../../src/nfc/RnNfcScanAdapter';
import type { ProductScanSessionSnapshot, ProductScanState } from '../../src/scan/contracts';
import type { LifecycleEvidenceOutbox } from '../../src/scan/LifecycleEvidenceOutbox';
import { ScanFeedbackCoordinator } from '../../src/feedback/ScanFeedbackCoordinator';
import { AndroidMonotonicClock } from '../../src/offline/AndroidMonotonicClock';
import {
  OfflineCaptureCoordinator,
  type OfflineCaptureSessionReader,
} from '../../src/offline/OfflineCaptureCoordinator';
import { OfflineCaptureDatabase } from '../../src/offline/OfflineCaptureDatabase';
import type { OfflineCaptureLeaseApiPort } from '../../src/offline/OfflineCaptureLeaseClient';
import { OfflineInstallationIdentityStore } from '../../src/offline/OfflineInstallationIdentityStore';
import {
  OfflineSyncScheduler,
  OFFLINE_ARCHIVE_POLL_MILLISECONDS,
  type OfflineSyncSchedulerState,
} from '../../src/offline/OfflineSyncScheduler';
import { encodeBase64Url } from '../../src/offline/encoding';
import { MemoryOfflineDatabase } from '../support/MemoryOfflinePlatform';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  organization: '20000000-0000-4000-8000-000000000001',
  membership: '30000000-0000-4000-8000-000000000001',
  command: '40000000-0000-4000-8000-000000000001',
  event: '50000000-0000-4000-8000-000000000001',
  receipt: '60000000-0000-4000-8000-000000000001',
  lease: '70000000-0000-4000-8000-000000000001',
  installation: '80000000-0000-4000-8000-000000000001',
  identity: '90000000-0000-4000-8000-000000000001',
  item: 'a0000000-0000-4000-8000-000000000001',
  assignment: 'b0000000-0000-4000-8000-000000000001',
  tag: 'c0000000-0000-4000-8000-000000000001',
  customer: 'd0000000-0000-4000-8000-000000000001',
} as const;

const session: ProductSessionContext = {
  userId: ids.user,
  organizationId: ids.organization,
  membershipId: ids.membership,
  role: 'employee',
};
const snapshot: ProductScanSessionSnapshot = { generation: 1, session };
const binding = encodeBase64Url(new Uint8Array(32).fill(6));

describe('OfflineCaptureCoordinator', () => {
  it.each([
    ['time_entry_started', 'work_started'], ['time_entry_stopped', 'work_stopped'],
    ['break_started', 'break_changed'], ['break_stopped', 'break_changed'],
  ] as const)('shows and feels %s while retaining the event in real SQLite until archived', async (decisionStatus, feedbackKind) => {
    const database = new OfflineCaptureDatabase(
      async () => new NodeSqliteOfflineConnection(), new Uint8Array(32).fill(8),
    );
    let now = 20_000;
    let archiveStatus = 'archive_pending';
    let received: { workEventId: string; receiptId: string; deviceSequence: number } | null = null;
    const decision = { status: decisionStatus, timeEntryId: ids.event,
      ...(decisionStatus.startsWith('break_') ? { breakIntervalId: ids.receipt } : {}) };
    let scheduler!: OfflineSyncScheduler;
    const client = new OfflineLifecycleClient(new URL('https://api.example/'), {
      async post(endpoint, requestBody) {
        const command = JSON.parse(requestBody);
        const reconciliation = endpoint.pathname.endsWith('/reconcile');
        if (!reconciliation) received = { workEventId: command.workEvent.id,
          receiptId: command.receipt.id, deviceSequence: command.deviceSequence };
        const body = reconciliation
          ? { status: 'ready', records: received !== null && command.workEventIds.includes(received.workEventId)
              ? [{ ...received, archiveStatus, result: { status: 'synchronized', decision } }] : [] }
          : { status: 'synchronized', archiveStatus, idempotentRetry: false, ...received, decision };
        return { status: 'response', statusCode: 200, contentType: 'application/json',
          body: JSON.stringify(body) };
      },
    });
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'captured',
        payload: createCanonicalNfcUidPayload('04AABBCC'),
        capturedAt: createTimestamp('2026-07-18T10:00:00.000Z') }; } },
      nfcLifecycle(), sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(), () => database, leaseClient(true),
      new AndroidMonotonicClock({ async sample() {
        return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100,
          wallClockMilliseconds: Date.parse('2026-07-18T10:00:00.000Z') };
      } }),
      (db, authority) => {
        scheduler = new OfflineSyncScheduler(db, client,
          { async ingest() { return { status: 'unavailable' }; } }, authority,
          () => now, () => 0.5,
          { schedule() { return 1; }, cancel() {} });
        return scheduler;
      },
      emptyOutbox(), sequentialUuid([ids.command, ids.event, ids.receipt, ids.assignment, ids.tag]),
      { bind() {} }, () => new Date('2026-07-18T10:00:00.000Z'),
    );
    const feedback = { perform: vi.fn(async () => undefined) };
    const scanFeedback = new ScanFeedbackCoordinator(coordinator, feedback);
    try {
      await coordinator.start();
      await vi.waitFor(() => expect(coordinator.getState().status).toBe('ready'));
      scanFeedback.start();
      await coordinator.scan();
      await scheduler.trigger('network_hint');
      // D-051 protects the row; D-052 gives the hand the actual engine decision now.
      await expect(database.queueCount()).resolves.toBe(0);
      await expect(database.readAwaitingArchive(0, 25)).resolves.toHaveLength(1);
      expect(coordinator.getState()).toMatchObject({
        status: 'server_decision', queueCount: 0,
        outcome: { status: decisionStatus },
      });
      expect(feedback.perform).toHaveBeenCalledExactlyOnceWith(feedbackKind);
      now += OFFLINE_ARCHIVE_POLL_MILLISECONDS;
      archiveStatus = 'offsite_archived';
      await scheduler.reconcileArchives();
      await expect(database.readAwaitingArchive(0, 25)).resolves.toHaveLength(0);
      await expect(database.queueCount()).resolves.toBe(0);
      // Archival completion does not produce a second impulse.
      expect(feedback.perform).toHaveBeenCalledTimes(1);
      archiveStatus = 'archive_pending';
      const manual = await coordinator.captureManual({ targetType: 'customer', targetId: ids.customer });
      expect(manual).toEqual({ status: 'saved', workEventId: ids.assignment });
      await scheduler.trigger('manual');
      expect(coordinator.readManualAcknowledgement(ids.assignment)).toEqual({
        status: 'server_decision', outcome: decisionStatus,
      });
      await expect(database.queueCount()).resolves.toBe(0);
    } finally {
      scanFeedback.stop();
      await coordinator.stop();
    }
  });

  it('emits work-start feedback for the real successful online state sequence', async () => {
    const harness = await feedbackProductionHarness();

    await harness.coordinator.scan();
    harness.setQueueCount(0);
    harness.scheduler.publish({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: { status: 'time_entry_started', timeEntryId: ids.event },
    });

    expect(harness.states).toEqual(['scanning', 'synchronizing', 'server_decision']);
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
    expect(harness.feedback.perform).toHaveBeenCalledWith('work_started');
  });

  it('waits for this tap’s decision and haptic while a preceding event is confirmed', async () => {
    const h = await feedbackProductionHarness();
    await h.coordinator.scan();
    h.scheduler.publish({ status: 'server_decision', queueCount: 1,
      workEventId: ids.assignment,
      decision: { status: 'time_entry_started', timeEntryId: ids.event } });
    expect(h.feedback.perform).not.toHaveBeenCalled();
    expect(h.coordinator.getState().status).toBe('synchronizing');
    h.setQueueCount(0);
    h.scheduler.publish({ status: 'server_decision', queueCount: 0,
      workEventId: ids.event,
      decision: { status: 'time_entry_stopped', timeEntryId: ids.event } });
    expect(h.feedback.perform).toHaveBeenCalledExactlyOnceWith('work_stopped');
    expect(h.coordinator.getState()).toMatchObject({ status: 'server_decision',
      outcome: { status: 'time_entry_stopped' } });
    await h.coordinator.stop();
  });

  it('emits pending feedback for the real online review state sequence', async () => {
    const harness = await feedbackProductionHarness();

    await harness.coordinator.scan();
    harness.setQueueCount(0);
    harness.scheduler.publish({
      status: 'review_pending',
      queueCount: 0,
      workEventId: ids.event,
    });

    expect(harness.states).toEqual(['scanning', 'synchronizing', 'server_review_pending']);
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
    expect(harness.feedback.perform).toHaveBeenCalledWith('pending_confirmation');
  });

  it('emits the same pending pattern for real online escalation and review states', async () => {
    const escalation = await feedbackProductionHarness();

    await escalation.coordinator.scan();
    escalation.setQueueCount(0);
    escalation.scheduler.publish({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: {
        status: 'escalation_required',
        reason: 'business_engine_could_not_decide',
      },
    });

    const review = await feedbackProductionHarness();
    await review.coordinator.scan();
    review.setQueueCount(0);
    review.scheduler.publish({
      status: 'review_pending',
      queueCount: 0,
      workEventId: ids.event,
    });

    expect(escalation.states).toEqual(['scanning', 'synchronizing', 'server_decision']);
    expect(escalation.feedback.perform).toHaveBeenCalledTimes(1);
    expect(escalation.feedback.perform).toHaveBeenCalledWith('pending_confirmation');
    expect(review.feedback.perform.mock.calls).toEqual(escalation.feedback.perform.mock.calls);
  });

  it('emits pending once for the real no-network sequence and stays silent later', async () => {
    const harness = await feedbackProductionHarness();

    await harness.coordinator.scan();
    harness.scheduler.publish({ status: 'retry_wait', queueCount: 1 });
    expect(harness.states).toEqual(['scanning', 'synchronizing', 'saved_locally']);
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
    expect(harness.feedback.perform).toHaveBeenCalledWith('pending_confirmation');

    harness.scheduler.publish({ status: 'synchronizing', queueCount: 1 });
    harness.setQueueCount(0);
    harness.scheduler.publish({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: { status: 'time_entry_started', timeEntryId: ids.event },
    });
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
  });

  it('emits failure for the real queue-full state sequence without storing the scan', async () => {
    const harness = await feedbackProductionHarness('full');

    await harness.coordinator.scan();

    expect(harness.states).toEqual(['scanning', 'ready']);
    expect(harness.coordinator.getState()).toEqual({
      status: 'ready',
      outcome: { status: 'queue_full' },
    });
    expect(harness.feedback.perform).toHaveBeenCalledTimes(1);
    expect(harness.feedback.perform).toHaveBeenCalledWith('failed');
  });

  it('persists a changed-boot scan as review-only before triggering synchronization', async () => {
    const order: string[] = [];
    const appendEvent = vi.fn(async (draft) => {
      order.push('append');
      return { status: 'ready', command: { ...draft, deviceSequence: 1 } };
    });
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValue(1),
      lookupActiveItem: vi.fn(async () => ({
        itemType: 'nfc_assignment' as const,
        leaseId: ids.lease,
        leaseItemId: ids.item,
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
        targetType: 'customer',
        targetId: ids.customer,
        displayName: 'Kunde',
        issuedAt: '2026-07-18T10:00:00.000Z',
        expiresAt: '2026-07-18T22:00:00.000Z',
        activationBootMarker: 'boot-1',
        activationMonotonicMilliseconds: 100,
      })),
      readActiveCaptureContext: vi.fn(async () => activeContext()),
      appendEvent,
      invalidateCapture: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    });
    const scheduler = schedulerFake(order);
    const monotonicSamples = [
      { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 },
      { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 200 },
      { bootMarker: 'boot-2', elapsedRealtimeMilliseconds: 50 },
    ];
    const coordinator = new OfflineCaptureCoordinator(
      {
        async scan(): Promise<NfcScanCaptureResult> {
          return {
            status: 'captured',
            payload: createCanonicalNfcUidPayload('04AABBCC'),
            capturedAt: createTimestamp('2026-07-18T10:05:00.000Z'),
          };
        },
      },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() { return monotonicSamples.shift()!; },
      }),
      () => scheduler,
      emptyOutbox(),
      sequentialUuid([ids.command, ids.event, ids.receipt]),
    );

    await coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'ready', outcome: null });
    const ingressAuthority = await coordinator.captureNativeNfcIngressAuthority({
      bootMarker: 'boot-1',
      intentOrigin: 'activity_delivery_intent',
      processStartElapsedRealtimeMilliseconds: 0,
      elapsedRealtimeMilliseconds: 201,
    });
    expect(ingressAuthority).not.toBeNull();
    expect(coordinator.isNativeNfcIngressAuthorityCurrent(ingressAuthority!)).toBe(true);
    await coordinator.scan();
    const draft = appendEvent.mock.calls[0]![0];
    expect(draft.clock).toMatchObject({
      bootMarker: 'boot-2',
      monotonicDeltaMilliseconds: 0,
      clockProofStatus: 'review_only',
    });
    expect(draft.workEvent).toMatchObject({
      id: ids.event,
      trigger: {
        type: 'nfc',
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
      },
    });
    expect(draft.provenanceVersion).toBe(3);
    expect(order.indexOf('append')).toBeLessThan(order.lastIndexOf('trigger'));
    expect(coordinator.getState()).toEqual({ status: 'synchronizing', queueCount: 1 });
    await coordinator.onExplicitLogout();
    expect(coordinator.isNativeNfcIngressAuthorityCurrent(ingressAuthority!)).toBe(false);
    await expect(coordinator.captureNativeNfcIngressAuthority({
      bootMarker: 'boot-1',
      intentOrigin: 'activity_delivery_intent',
      processStartElapsedRealtimeMilliseconds: 0,
      elapsedRealtimeMilliseconds: 201,
    })).resolves.toBeNull();
  });

  it('keeps a durable review warning dominant across authenticated lease restoration', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn(async () => 0),
      readReviewPendingSequence: vi.fn(async () => 12),
      close: vi.fn(async () => undefined),
    });
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 };
        },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([ids.command]),
    );

    await coordinator.start();

    expect(coordinator.getState()).toEqual({
      status: 'server_review_pending',
      queueCount: 0,
    });
  });

  it('keeps a rejected server decision visible across later idle scheduler hints', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    });
    const scheduler = controllableScheduler();
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 };
        },
      }),
      () => scheduler.scheduler,
      emptyOutbox(),
      sequentialUuid([ids.command]),
    );

    await coordinator.start();
    scheduler.publish({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: {
        status: 'active_entry_for_other_target_rejected',
        activeTimeEntryId: ids.event,
      },
    });
    expect(coordinator.getState()).toEqual({
      status: 'server_decision',
      queueCount: 0,
      outcome: { status: 'active_entry_for_other_target_rejected' },
    });

    scheduler.publish({ status: 'idle', queueCount: 0 });
    await vi.waitFor(() => {
      expect(coordinator.getState()).toEqual({
        status: 'ready',
        outcome: { status: 'active_entry_for_other_target_rejected' },
      });
    });
  });

  it('restores a persisted queue as visibly saved after an app or device restart', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn(async () => 1),
      close: vi.fn(async () => undefined),
    });
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 };
        },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([ids.command]),
    );

    await coordinator.start();

    expect(coordinator.getState()).toEqual({ status: 'saved_locally', queueCount: 1 });
  });

  it('opens cold-start capture only for a typed transient context failure and same-boot lease',
    async () => {
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        readActiveCaptureContext: vi.fn(async () => activeContext()),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const issueCompleteV3 = vi.fn();
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader({ status: 'context_unavailable' }, null, true),
        identityStore(),
        () => database,
        { issueCompleteV3 },
        new AndroidMonotonicClock({
          async sample() {
            return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([]),
        { bind() {} },
        () => new Date('2026-07-18T10:10:00.000Z'),
      );

      await coordinator.start();
      expect(coordinator.getState()).toEqual({
        status: 'offline_ready',
        queueCount: 0,
        outcome: null,
      });
      const ingressAuthority = await coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 0,
        elapsedRealtimeMilliseconds: 600_101,
      });
      expect(ingressAuthority).not.toBeNull();
      expect(coordinator.isNativeNfcIngressAuthorityCurrent(ingressAuthority!)).toBe(true);
      expect(issueCompleteV3).not.toHaveBeenCalled();
    });

  it('accepts the process-start Intent under the authority created by that runtime start',
    async () => {
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        bindOwner: vi.fn(async () => ({ status: 'ready' })),
        activateLease: vi.fn(async () => ({ status: 'ready' })),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader({ status: 'authenticated', session }, snapshot),
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            return {
              bootMarker: 'boot-1',
              processStartElapsedRealtimeMilliseconds: 10,
              elapsedRealtimeMilliseconds: 100,
            };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([ids.command]),
      );

      await coordinator.start();
      coordinator.bindNativeNfcIngressRuntimeStart();

      // A just-created process has no older local authority; runtime startup binds this generation.
      const authority = await coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'process_start_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 50,
      });
      expect(authority).not.toBeNull();
      expect(coordinator.isNativeNfcIngressAuthorityCurrent(authority!)).toBe(true);
    });

  it('rejects foreign identity/Membership, previous boot, process mismatch, and old non-start delivery because later authority must not adopt them',
    async () => {
      let sessionState: MobileSessionState = { status: 'authenticated', session };
      let authenticatedSnapshot: ProductScanSessionSnapshot | null = snapshot;
      const sessionSubscription: { listener?: () => void } = {};
      let cancelCount = 0;
      const delayedCancel = deferred<void>();
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        bindOwner: vi.fn(async () => ({ status: 'ready' })),
        activateLease: vi.fn(async () => ({ status: 'ready' })),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        {
          async checkCapability() { return 'ready'; },
          async cancelCapture() {
            cancelCount += 1;
            if (cancelCount === 2) await delayedCancel.promise;
          },
          async stop() {},
        },
        {
          getState: () => sessionState,
          isOfflineCaptureRestorationAllowed: () => false,
          captureOfflineRestorationSnapshot: () => null,
          isOfflineRestorationSnapshotCurrent: () => false,
          capture: () => authenticatedSnapshot,
          isCurrent: (candidate) => candidate === authenticatedSnapshot,
          subscribe: (listener) => {
            sessionSubscription.listener = listener;
            return () => undefined;
          },
          retryContext: vi.fn(async () => undefined),
        },
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            return {
              bootMarker: 'boot-1',
              processStartElapsedRealtimeMilliseconds: 10,
              elapsedRealtimeMilliseconds: 100,
            };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([ids.command]),
      );
      await coordinator.start();
      coordinator.bindNativeNfcIngressRuntimeStart();
      expect(coordinator.getState()).toEqual({ status: 'ready', outcome: null });

      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-2',
        intentOrigin: 'process_start_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 50,
      })).resolves.toBeNull();
      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'process_start_intent',
        processStartElapsedRealtimeMilliseconds: 9,
        elapsedRealtimeMilliseconds: 50,
      })).resolves.toBeNull();
      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 50,
      })).resolves.toBeNull();
      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 100,
      })).resolves.toBeNull();
      const normalAuthority = await coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 101,
      });
      expect(normalAuthority).not.toBeNull();

      const foreignSession = {
        ...session,
        userId: '10000000-0000-4000-8000-000000000002',
        membershipId: '30000000-0000-4000-8000-000000000002',
      } as const;
      sessionState = { status: 'authenticated', session: foreignSession };
      authenticatedSnapshot = { generation: 2, session: foreignSession };
      expect(sessionSubscription.listener).toBeDefined();
      sessionSubscription.listener!();
      const authorityPromise = coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'process_start_intent',
        processStartElapsedRealtimeMilliseconds: 10,
        elapsedRealtimeMilliseconds: 50,
      });
      let settled = false;
      void authorityPromise.then(() => { settled = true; });
      await Promise.resolve();
      expect(settled).toBe(false);

      delayedCancel.resolve();
      const authority = await authorityPromise;
      expect(authority).toBeNull();
    });

  it.each([
    [{ status: 'context_unavailable' }, null],
    [{ status: 'context_unavailable' }, activeContext()],
    [
      { status: 'runtime_unavailable', reason: 'authentication_unavailable' },
      activeContext(),
    ],
    [
      { status: 'runtime_unavailable', reason: 'storage_unavailable' },
      activeContext(),
    ],
  ] satisfies Array<[MobileSessionState, ReturnType<typeof activeContext> | null]>)(
    'keeps cold-start capture closed for session $status without an eligible local context',
    async (sessionState, localContext) => {
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        readActiveCaptureContext: vi.fn(async () => localContext),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader(sessionState, null),
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([]),
        { bind() {} },
        () => new Date('2026-07-18T10:10:00.000Z'),
      );

      await coordinator.start();
      expect(coordinator.getState()).toEqual({ status: 'inactive' });
      await expect(coordinator.captureNativeNfcIngressAuthority({
        bootMarker: 'boot-1',
        intentOrigin: 'activity_delivery_intent',
        processStartElapsedRealtimeMilliseconds: 0,
        elapsedRealtimeMilliseconds: 600_100,
      })).resolves.toBeNull();
    },
  );

  it('retries a suspended session before scheduling work on a network hint', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      readActiveCaptureContext: vi.fn(async () => activeContext()),
      queueCount: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    });
    const scheduler = schedulerFake([]);
    const trigger = vi.mocked(scheduler.trigger);
    const retryComplete = deferred<void>();
    const retryContext = vi.fn(() => retryComplete.promise);
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      {
        ...sessionReader({ status: 'context_unavailable' }, null, true),
        retryContext,
      },
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
        },
      }),
      () => scheduler,
      emptyOutbox(),
      sequentialUuid([]),
      { bind() {} },
      () => new Date('2026-07-18T10:10:00.000Z'),
    );
    await coordinator.start();
    trigger.mockClear();

    coordinator.triggerNetworkHint();
    expect(retryContext).toHaveBeenCalledTimes(1);
    expect(trigger).not.toHaveBeenCalled();
    retryComplete.resolve();

    await vi.waitFor(() => expect(trigger).toHaveBeenCalledWith('network_hint'));
  });

  it('reads only the exact still-valid offline manual-target lease projection', async () => {
    const context = activeContext();
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      readActiveCaptureContext: vi.fn(async () => context),
      listActiveManualTargets: vi.fn(async () => [{
        targetType: 'project',
        targetId: ids.customer,
        displayName: 'Projekt',
      }]),
      queueCount: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    });
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'context_unavailable' }, null, true),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
        },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([]),
      { bind() {} },
      () => new Date('2026-07-18T10:10:00.000Z'),
    );
    await coordinator.start();

    await expect(coordinator.readOfflineManualTargets()).resolves.toEqual({
      status: 'ready',
      targets: [{
        targetType: 'project',
        targetId: ids.customer,
        displayName: 'Projekt',
      }],
    });
    expect(database.listActiveManualTargets).toHaveBeenCalledWith(ids.lease);
  });

  it.each(['stale_clock', 'mismatched_lease'] as const)(
    'fails the offline manual-target projection closed for %s',
    async (scenario) => {
      let sampleCount = 0;
      let contextCount = 0;
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        readActiveCaptureContext: vi.fn(async () => {
          contextCount += 1;
          return scenario === 'mismatched_lease' && contextCount > 1
            ? { ...activeContext(), leaseId: '70000000-0000-4000-8000-000000000099' }
            : activeContext();
        }),
        listActiveManualTargets: vi.fn(async () => []),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader({ status: 'context_unavailable' }, null, true),
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            sampleCount += 1;
            return {
              bootMarker: scenario === 'stale_clock' && sampleCount > 1 ? 'boot-2' : 'boot-1',
              elapsedRealtimeMilliseconds: 600_100,
            };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([]),
        { bind() {} },
        () => new Date('2026-07-18T10:10:00.000Z'),
      );
      await coordinator.start();
      await expect(coordinator.readOfflineManualTargets()).resolves.toEqual({
        status: 'protected',
      });
      expect(database.listActiveManualTargets).not.toHaveBeenCalled();
    },
  );

  it('invalidates capture and removes only the active lookup key on explicit logout', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      queueCount: vi.fn(async () => 0),
      invalidateCapture: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    });
    const removeActiveLookupKey = vi.fn(async () => undefined);
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'unauthenticated', reason: 'not_signed_in' }, null),
      identityStore(removeActiveLookupKey),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() { return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 }; },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([]),
    );
    await coordinator.start();
    await coordinator.onExplicitLogout();
    expect(database.invalidateCapture).toHaveBeenCalledTimes(1);
    expect(removeActiveLookupKey).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toEqual({ status: 'inactive' });
  });

  it.each([
    ['secure_identity', 'P01', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
    ['database_initialization', 'P02', {
      status: 'secure_storage_unavailable',
    }],
    ['database_integrity', 'P03', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
    ['database_migration', 'P04', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
    ['legacy_import', 'P05', {
      status: 'protected_pending',
      reason: 'legacy_membership_unknown',
    }],
    ['owner_binding', 'P06', {
      status: 'protected_pending',
      reason: 'identity_mismatch',
    }],
    ['lease_completeness', 'P07', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
    ['lease_activation', 'P08', {
      status: 'unavailable',
    }],
    ['scheduler_durable', 'P09', {
      status: 'protected_pending',
      reason: 'local_evidence_protected',
    }],
  ] as const)('classifies the exact %s pre-scan origin opaquely', async (
    origin,
    protection,
    state,
  ) => {
    const coordinator = protectedOriginCoordinator(origin);

    await coordinator.start();

    expect(coordinator.getState()).toEqual(state);
    expect(coordinator.getState().protection).toEqual([protection]);
  });

  it('logs the P04 class with only the sanitized SQLite code and message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const native = new MemoryOfflineDatabase();
      const execute = native.execAsync.bind(native);
      native.execAsync = async (source) => {
        if (source.includes('CREATE TABLE offline_owner')) {
          throw Object.assign(new Error(
            "Call to function 'NativeDatabase.execAsync' has been rejected.\n"
            + '→ Caused by: near "generation_state": syntax error',
          ), { code: 'ERR_INTERNAL_SQLITE_ERROR' });
        }
        await execute(source);
      };
      const database = new OfflineCaptureDatabase(
        async () => native,
        new Uint8Array(32).fill(8),
      );
      const coordinator = protectedOriginCoordinator('database_migration', database);

      await coordinator.start();

      expect(consoleError).toHaveBeenCalledTimes(1);
      const [serialized] = consoleError.mock.calls[0]!;
      expect(JSON.parse(String(serialized))).toEqual({
        protectionClass: 'P04',
        sqliteErrorCode: 'ERR_INTERNAL_SQLITE_ERROR',
        message: 'near "generation_state": syntax error',
      });
      expect(coordinator.getState().protection).toEqual(['P04']);
    } finally {
      consoleError.mockRestore();
    }
  });
});

function protectedOriginCoordinator(
  origin:
    | 'secure_identity'
    | 'database_initialization'
    | 'database_integrity'
    | 'database_migration'
    | 'legacy_import'
    | 'owner_binding'
    | 'lease_completeness'
    | 'lease_activation'
    | 'scheduler_durable',
  databaseOverride?: OfflineCaptureDatabase,
): OfflineCaptureCoordinator {
  const initialized = origin === 'database_integrity'
    ? { status: 'protected' as const, reason: 'cipher_integrity_failed' as const }
    : origin === 'database_migration'
      ? { status: 'migration_failed' as const }
      : { status: 'ready' as const };
  const database = databaseOverride ?? databaseFake({
    initialize: vi.fn(async () => initialized),
    hasProtectedLegacy: vi.fn(async () => origin === 'legacy_import'),
    bindOwner: vi.fn(async () => origin === 'owner_binding'
      ? { status: 'protected' as const, reason: 'identity_mismatch' as const }
      : { status: 'ready' as const }),
    activateLease: vi.fn(async () => origin === 'lease_activation'
      ? { status: 'protected' as const, reason: 'corrupt_row' as const }
      : { status: 'ready' as const }),
    readActiveCaptureContext: vi.fn(async () => null),
    queueCount: vi.fn(async () => 0),
    close: vi.fn(async () => undefined),
  });
  const protectedIdentity = {
    async loadOrCreate() {
      return { status: 'protected' as const, reason: 'missing_key' as const };
    },
    async removeActiveLookupKey() {},
  } as unknown as OfflineInstallationIdentityStore;
  const completeLease = leaseClient();
  const lease = origin === 'lease_completeness'
    ? {
        ...completeLease,
        async issueCompleteV3() {
          return { status: 'incomplete_or_oversize' as const };
        },
      }
    : completeLease;
  return new OfflineCaptureCoordinator(
    { async scan() { return { status: 'cancelled' }; } },
    nfcLifecycle(),
    sessionReader({ status: 'authenticated', session }, snapshot),
    origin === 'secure_identity' ? protectedIdentity : identityStore(),
    () => {
      if (origin === 'database_initialization') {
        throw new Error('closed database initialization failure');
      }
      return database;
    },
    lease,
    new AndroidMonotonicClock({
      async sample() {
        return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 };
      },
    }),
    () => {
      if (origin === 'scheduler_durable') {
        throw new Error('closed scheduler durable failure');
      }
      return schedulerFake([]);
    },
    emptyOutbox(),
    sequentialUuid([ids.command]),
  );
}

async function feedbackProductionHarness(appendStatus: 'ready' | 'full' = 'ready') {
  let queueCount = 0;
  const database = databaseFake({
    initialize: vi.fn(async () => ({ status: 'ready' })),
    hasProtectedLegacy: vi.fn(async () => false),
    bindOwner: vi.fn(async () => ({ status: 'ready' })),
    activateLease: vi.fn(async () => ({ status: 'ready' })),
    queueCount: vi.fn(async () => queueCount),
    lookupActiveItem: vi.fn(async () => ({
      itemType: 'nfc_assignment' as const,
      leaseId: ids.lease,
      leaseItemId: ids.item,
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      targetType: 'customer',
      targetId: ids.customer,
      displayName: 'Kunde',
      issuedAt: '2026-07-18T10:00:00.000Z',
      expiresAt: '2026-07-18T22:00:00.000Z',
      activationBootMarker: 'boot-1',
      activationMonotonicMilliseconds: 100,
    })),
    readActiveCaptureContext: vi.fn(async () => activeContext()),
    appendEvent: vi.fn(async (draft) => {
      if (appendStatus === 'full') return { status: 'full' as const };
      queueCount = 1;
      return {
        status: 'ready' as const,
        command: { ...draft, deviceSequence: 1 },
      };
    }),
    invalidateCapture: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  });
  const scheduler = controllableScheduler();
  let monotonicMilliseconds = 100;
  const coordinator = new OfflineCaptureCoordinator(
    {
      async scan(): Promise<NfcScanCaptureResult> {
        return {
          status: 'captured',
          payload: createCanonicalNfcUidPayload('04AABBCC'),
          capturedAt: createTimestamp('2026-07-18T10:05:00.000Z'),
        };
      },
    },
    nfcLifecycle(),
    sessionReader({ status: 'authenticated', session }, snapshot),
    identityStore(),
    () => database,
    leaseClient(),
    new AndroidMonotonicClock({
      async sample() {
        monotonicMilliseconds += 100;
        return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: monotonicMilliseconds };
      },
    }),
    () => scheduler.scheduler,
    emptyOutbox(),
    sequentialUuid([ids.command, ids.event, ids.receipt]),
  );
  const states: ProductScanState['status'][] = [];
  const feedback = { perform: vi.fn(async () => undefined) };
  const scanFeedback = new ScanFeedbackCoordinator(coordinator, feedback);
  await coordinator.start();
  coordinator.subscribe(() => states.push(coordinator.getState().status));
  scanFeedback.start();
  return {
    coordinator,
    scheduler,
    feedback,
    states,
    setQueueCount(value: number) { queueCount = value; },
  };
}

function databaseFake(
  methods: Record<string, ReturnType<typeof vi.fn>>,
): OfflineCaptureDatabase & Record<string, ReturnType<typeof vi.fn>> {
  return {
    readReviewPendingSequence: vi.fn(async () => null),
    ...methods,
  } as unknown as OfflineCaptureDatabase
    & Record<string, ReturnType<typeof vi.fn>>;
}

function schedulerFake(order: string[]): OfflineSyncScheduler {
  const listeners = new Set<() => void>();
  const scheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getState: vi.fn(() => ({ status: 'idle', queueCount: 0 })),
    trigger: vi.fn(async () => {
      order.push('trigger');
      return { status: 'idle', queueCount: 0 };
    }),
  };
  return scheduler as unknown as OfflineSyncScheduler;
}

function controllableScheduler(): {
  readonly scheduler: OfflineSyncScheduler;
  readonly publish: (state: OfflineSyncSchedulerState) => void;
} {
  const listeners = new Set<() => void>();
  let state: OfflineSyncSchedulerState = { status: 'idle', queueCount: 0 };
  const scheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getState: vi.fn(() => state),
    trigger: vi.fn(async () => state),
  } as unknown as OfflineSyncScheduler;
  return {
    scheduler,
    publish(next) {
      state = Object.freeze(next);
      for (const listener of listeners) listener();
    },
  };
}

function identityStore(removeActiveLookupKey = vi.fn(async () => undefined)) {
  return {
    async loadOrCreate() {
      return {
        status: 'ready',
        secrets: {
          installationBinding: binding,
          lookupKey: new Uint8Array(32).fill(7),
          databaseKey: new Uint8Array(32).fill(8),
        },
      };
    },
    removeActiveLookupKey,
  } as unknown as OfflineInstallationIdentityStore;
}

function leaseClient(withManual = false): OfflineCaptureLeaseApiPort {
  const issueCompleteV3 = async () => {
    const items = [{
      itemType: 'nfc_assignment' as const,
      subjectType: 'work' as const,
      itemId: ids.item,
      lookup: mobileLookupHmac(new Uint8Array(32).fill(7), 'nfc:uid:v1:04AABBCC'),
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      targetType: 'customer' as const,
      targetId: ids.customer,
      displayName: 'Kunde',
      assignmentRowVersion: 1,
      targetRowVersion: 1,
    }, ...(withManual ? [{
      itemId: 'a0000000-0000-4000-8000-000000000002', itemType: 'manual_target' as const,
      subjectType: 'work' as const, targetType: 'customer' as const, targetId: ids.customer,
      displayName: 'Kunde', targetRowVersion: 1,
    }] : [])];
    return {
      status: 'ready' as const,
      idempotentRetry: false,
      page: {
        leaseSchemaVersion: 3 as const,
        manifestVersion: 3 as const,
        leaseId: ids.lease,
        installationId: ids.installation,
        identityBindingId: ids.identity,
        userId: ids.user,
        organizationId: ids.organization,
        membershipId: ids.membership,
        membershipRowVersion: 1,
        role: 'employee' as const,
        issuedAt: '2026-07-18T10:00:00.000Z',
        expiresAt: '2026-07-18T22:00:00.000Z',
        configurationRevision: '2'.repeat(64),
        itemCount: items.length,
        serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
        manifestDigest: mobileManifestDigestV3(items),
        items,
        nextCursor: null,
      },
    };
  };
  return { issueCompleteV3 };
}

function sessionReader(
  state: MobileSessionState,
  authenticatedSnapshot: ProductScanSessionSnapshot | null,
  offlineCaptureRestorationAllowed = false,
): OfflineCaptureSessionReader {
  const offlineSnapshot: InternalOfflineRestorationSnapshot | null =
    state.status === 'context_unavailable' && offlineCaptureRestorationAllowed
      ? {
          generation: 1,
          restorationRevision: 1,
          source: 'provider_suspended',
        }
      : null;
  return {
    getState: () => state,
    isOfflineCaptureRestorationAllowed: () => offlineCaptureRestorationAllowed,
    captureOfflineRestorationSnapshot: () => offlineSnapshot,
    isOfflineRestorationSnapshotCurrent: (candidate) => candidate === offlineSnapshot,
    capture: () => authenticatedSnapshot,
    isCurrent: (candidate) => candidate === authenticatedSnapshot,
    subscribe: () => () => undefined,
    retryContext: vi.fn(async () => undefined),
  };
}

function nfcLifecycle(): NfcCaptureLifecyclePort {
  return {
    async checkCapability() { return 'ready'; },
    async cancelCapture() {},
    async stop() {},
  };
}

function emptyOutbox(): LifecycleEvidenceOutbox {
  return {
    async read() { return null; },
    async write() {},
    async clear() {},
  };
}

function sequentialUuid(values: readonly string[]): () => string {
  let index = 0;
  return () => values[index++] ?? 'ffffffff-ffff-4fff-8fff-ffffffffffff';
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function activeContext() {
  return {
    organizationId: ids.organization,
    userId: ids.user,
    membershipId: ids.membership,
    role: 'employee' as const,
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identity,
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    activationBootMarker: 'boot-1',
    activationMonotonicMilliseconds: 100,
  };
}
