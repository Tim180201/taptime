import type {
  OfflineCaptureLeasePage,
  OfflineCaptureLeasePageV2,
  OfflineCaptureLeasePageV3,
  OfflineLifecycleEventCommand,
  OfflineLifecycleEventCommandV2,
} from '@taptime/offline-sync-contract';
import { describe, expect, it } from 'vitest';
import {
  OfflineCaptureDatabase,
} from '../../src/offline/OfflineCaptureDatabase';
import {
  mobileManifestDigest,
  mobileManifestDigestV2,
  mobileManifestDigestV3,
} from '../../src/offline/MobileLookupHmac';
import {
  MemoryOfflineDatabase,
  type MemoryOwner,
} from '../support/MemoryOfflinePlatform';

const ids = {
  organization: '00000000-0000-4000-8000-000000000001',
  user: '10000000-0000-4000-8000-000000000001',
  membership: '20000000-0000-4000-8000-000000000001',
  identityBinding: '30000000-0000-4000-8000-000000000001',
  installation: '40000000-0000-4000-8000-000000000001',
  lease: '50000000-0000-4000-8000-000000000001',
  item: '60000000-0000-4000-8000-000000000001',
  assignment: '70000000-0000-4000-8000-000000000001',
  tag: '80000000-0000-4000-8000-000000000001',
  customer: '90000000-0000-4000-8000-000000000001',
  event1: 'a0000000-0000-4000-8000-000000000001',
  receipt1: 'b0000000-0000-4000-8000-000000000001',
  event2: 'a0000000-0000-4000-8000-000000000002',
  receipt2: 'b0000000-0000-4000-8000-000000000002',
} as const;

const installationBinding = new Uint8Array(32).fill(1);
const installationBindingEncoded =
  'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE';
const bindingDigest = '1'.repeat(64);

describe('OfflineCaptureDatabase state machine', () => {
  it('applies SQLCipher key first, verifies integrity, migrates exclusively, and restores in-flight',
    async () => {
      const native = new MemoryOfflineDatabase();
      const store = new OfflineCaptureDatabase(async () => native, installationBinding);
      await expect(store.initialize()).resolves.toEqual({ status: 'ready' });
      expect(native.execLog[0]).toMatch(/^PRAGMA key = "x'[0-9a-f]{64}'"$/);
      expect(native.execLog.some((sql) => sql.includes('CREATE TABLE offline_owner'))).toBe(true);
      expect(native.userVersion).toBe(4);
      expect(native.exclusiveTransactions).toBeGreaterThanOrEqual(2);
    });

  it('migrates schema v1 exclusively and preserves its owner while adding durable review state',
    async () => {
      const native = new MemoryOfflineDatabase();
      native.userVersion = 1;
      native.owner = memoryOwner();
      const store = new OfflineCaptureDatabase(async () => native, installationBinding);

      await expect(store.initialize()).resolves.toEqual({ status: 'ready' });
      expect(native.execLog.some((sql) => (
        sql.includes('ADD COLUMN review_pending_sequence')
      ))).toBe(true);
      expect(native.userVersion).toBe(4);
      await expect(store.readReviewPendingSequence()).resolves.toBeNull();
      expect(native.owner).toMatchObject(memoryOwner());
    });

  it('fails protected before schema access when cipher integrity is not exact', async () => {
    const native = new MemoryOfflineDatabase();
    native.cipherRows = [{ cipher_integrity_check: 'page 7 failed' }];
    const store = new OfflineCaptureDatabase(async () => native, installationBinding);
    await expect(store.initialize()).resolves.toEqual({
      status: 'protected',
      reason: 'cipher_integrity_failed',
    });
    expect(native.execLog.some((sql) => sql.includes('CREATE TABLE'))).toBe(false);
    expect(native.closed).toBe(true);
  });

  it('binds one exact owner and protects the database from cross-identity reuse', async () => {
    const { store } = await readyStore();
    await expect(store.bindOwner(owner())).resolves.toEqual({ status: 'ready' });
    await expect(store.bindOwner({
      ...owner(),
      userId: '10000000-0000-4000-8000-000000000002',
    })).resolves.toEqual({ status: 'protected', reason: 'identity_mismatch' });
  });

  it('activates a complete manifest atomically and preserves it on a tampered replacement',
    async () => {
      const { store } = await readyStore();
      await store.bindOwner(owner());
      const page = leasePage();
      await expect(store.activateLease({
        page,
        activationBootMarker: 'boot-1',
        activationMonotonicMilliseconds: 10_000,
      })).resolves.toEqual({ status: 'ready' });
      await expect(store.lookupActiveItem(page.items[0]!.lookup)).resolves.toMatchObject({
        leaseId: ids.lease,
        leaseItemId: ids.item,
        targetId: ids.customer,
        activationBootMarker: 'boot-1',
      });

      await expect(store.activateLease({
        page: { ...page, leaseId: '50000000-0000-4000-8000-000000000002',
          manifestDigest: '0'.repeat(64) },
        activationBootMarker: 'boot-1',
        activationMonotonicMilliseconds: 11_000,
      })).resolves.toEqual({ status: 'full' });
      await expect(store.lookupActiveItem(page.items[0]!.lookup)).resolves.toMatchObject({
        leaseId: ids.lease,
      });
    });

  it('allocates immutable FIFO sequences and clears only an exact durable head acknowledgement',
    async () => {
      const { store } = await readyStore();
      await store.bindOwner(owner());
      await store.activateLease({
        page: leasePage(),
        activationBootMarker: 'boot-1',
        activationMonotonicMilliseconds: 10_000,
      });
      const first = await store.appendEvent(eventDraft(ids.event1, ids.receipt1));
      const second = await store.appendEvent(eventDraft(ids.event2, ids.receipt2));
      expect(first).toMatchObject({ status: 'ready', command: { deviceSequence: 1 } });
      expect(second).toMatchObject({ status: 'ready', command: { deviceSequence: 2 } });
      await expect(store.queueCount()).resolves.toBe(2);

      const head = await store.claimHead(20_000);
      expect(head?.command.workEvent.id).toBe(ids.event1);
      await expect(store.acknowledgeHead({
        deviceSequence: 1,
        workEventId: ids.event1,
        receiptId: ids.receipt2,
      }, 'review_pending')).rejects.toThrow('identity mismatch');
      await expect(store.queueCount()).resolves.toBe(2);
      await expect(store.readReviewPendingSequence()).resolves.toBeNull();

      await store.retainHeadForRetry({
        deviceSequence: 1,
        workEventId: ids.event1,
        receiptId: ids.receipt1,
      }, 1, 30_000);
      await expect(store.claimHead(29_999)).resolves.toBeNull();
      expect((await store.claimHead(30_000))?.command.workEvent.id).toBe(ids.event1);
      await store.acknowledgeHead({
        deviceSequence: 1,
        workEventId: ids.event1,
        receiptId: ids.receipt1,
      }, 'review_pending');
      await expect(store.readReviewPendingSequence()).resolves.toBe(1);
      await expect(store.clearReviewPendingSequence(1, 0)).resolves.toBe(false);
      await expect(store.readReviewPendingSequence()).resolves.toBe(1);
      await expect(store.clearReviewPendingSequence(2, 2)).resolves.toBe(false);
      await expect(store.clearReviewPendingSequence(1, 1)).resolves.toBe(true);
      await expect(store.readReviewPendingSequence()).resolves.toBeNull();
      expect((await store.claimHead(30_001))?.command.deviceSequence).toBe(2);
    });

  it('resets an interrupted in-flight row on restart without changing its evidence', async () => {
    const native = new MemoryOfflineDatabase();
    native.userVersion = 1;
    native.owner = memoryOwner();
    const command = { ...eventDraft(ids.event1, ids.receipt1), deviceSequence: 1 };
    native.queue.push({
      command,
      state: 'in_flight',
      attemptCount: 3,
      nextAttemptAt: null,
      bytes: JSON.stringify(command).length,
    });
    native.owner.next_device_sequence = 1;
    const store = new OfflineCaptureDatabase(async () => native, installationBinding);
    await expect(store.initialize()).resolves.toEqual({ status: 'ready' });
    const head = await store.claimHead(10);
    expect(head).toMatchObject({
      state: 'in_flight',
      attemptCount: 3,
      command: { workEvent: { id: ids.event1 }, deviceSequence: 1 },
    });
  });

  it('activates schema-v3 manual targets and appends immutable provenance-v2 FIFO evidence',
    async () => {
      const { store } = await readyStore();
      await store.bindOwner(owner());
      const page = leasePageV2();
      await expect(store.activateLease({
        page,
        activationBootMarker: 'boot-1',
        activationMonotonicMilliseconds: 10_000,
      })).resolves.toEqual({ status: 'ready' });
      await expect(store.lookupActiveManualTarget('project', ids.customer))
        .resolves.toMatchObject({
          itemType: 'manual_target',
          leaseId: ids.lease,
          targetType: 'project',
          targetId: ids.customer,
        });
      await expect(store.listActiveManualTargets(ids.lease)).resolves.toEqual([{
        targetType: 'project',
        targetId: ids.customer,
        displayName: 'Projekt',
      }]);
      const appended = await store.appendEvent({
        organizationId: ids.organization,
        expectedMembershipId: ids.membership,
        leaseId: ids.lease,
        leaseItemId: ids.item,
        installationBinding: installationBindingEncoded,
        provenanceVersion: 2,
        clock: {
          bootMarker: 'boot-1',
          monotonicAnchorMilliseconds: 10_000,
          monotonicDeltaMilliseconds: 1_000,
          wallClockAnchor: page.issuedAt,
          clockProofStatus: 'verified_same_boot',
          clockProofVersion: 1,
        },
        workEvent: {
          id: ids.event1,
          target: { targetType: 'project', targetId: ids.customer },
          occurredAt: '2026-07-18T10:00:01.000Z',
          trigger: { type: 'manual' },
        },
        receipt: { id: ids.receipt1, attemptNumber: 1 },
      });
      expect(appended).toMatchObject({
        status: 'ready',
        command: {
          deviceSequence: 1,
          provenanceVersion: 2,
          workEvent: { trigger: { type: 'manual' } },
        },
      });
    });

  it('fails full at the exact queue count boundary without advancing sequence', async () => {
    const { store, native } = await readyStore();
    await store.bindOwner(owner());
    await store.activateLease({
      page: leasePage(),
      activationBootMarker: 'boot-1',
      activationMonotonicMilliseconds: 10_000,
    });
    native.syntheticQueueCount = 256;
    await expect(store.appendEvent(eventDraft(ids.event1, ids.receipt1)))
      .resolves.toEqual({ status: 'full' });
    expect(native.owner?.next_device_sequence).toBe(0);
  });

  it('queues two undirected offline pause triggers immutably in capture order', async () => {
    const { store } = await readyStore();
    await store.bindOwner(owner());
    const page = leasePageV3();
    await expect(store.activateLease({
      page,
      activationBootMarker: 'boot-1',
      activationMonotonicMilliseconds: 10_000,
    })).resolves.toEqual({ status: 'ready' });
    await expect(store.lookupActiveManualBreak()).resolves.toMatchObject({
      itemType: 'manual_break', subjectType: 'break', leaseItemId: ids.item,
    });
    const first = await store.appendEvent(breakEventDraft(page, ids.event1, ids.receipt1, 1_000));
    const second = await store.appendEvent(breakEventDraft(page, ids.event2, ids.receipt2, 2_000));
    expect(first).toMatchObject({
      status: 'ready',
      command: {
        deviceSequence: 1,
        provenanceVersion: 3,
        workEvent: { subject: { type: 'break' }, trigger: { type: 'manual' } },
      },
    });
    expect(second).toMatchObject({
      status: 'ready',
      command: {
        deviceSequence: 2,
        provenanceVersion: 3,
        workEvent: { subject: { type: 'break' }, trigger: { type: 'manual' } },
      },
    });
    expect((await store.claimHead(20_000))?.command.workEvent.id).toBe(ids.event1);
    await store.acknowledgeHead({
      deviceSequence: 1, workEventId: ids.event1, receiptId: ids.receipt1,
    }, 'synchronized');
    expect((await store.claimHead(20_001))?.command.workEvent.id).toBe(ids.event2);
  });
});

function owner() {
  return {
    organizationId: ids.organization,
    userId: ids.user,
    membershipId: ids.membership,
    installationBindingDigest: bindingDigest,
  };
}

function leasePage(): OfflineCaptureLeasePage {
  const items = [{
    itemId: ids.item,
    lookup: '2'.repeat(64),
    assignmentId: ids.assignment,
    nfcTagId: ids.tag,
    targetType: 'customer' as const,
    targetId: ids.customer,
    displayName: 'Kunde',
  }];
  return {
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identityBinding,
    userId: ids.user,
    organizationId: ids.organization,
    membershipId: ids.membership,
    membershipRowVersion: 1,
    role: 'employee',
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    configurationRevision: '3'.repeat(64),
    itemCount: 1,
    serializedBytes: JSON.stringify(items).length,
    manifestDigest: mobileManifestDigest(items),
    items,
    nextCursor: null,
  };
}

function leasePageV2(): OfflineCaptureLeasePageV2 {
  const items = [{
    itemType: 'manual_target' as const,
    itemId: ids.item,
    targetType: 'project' as const,
    targetId: ids.customer,
    displayName: 'Projekt',
    targetRowVersion: 1,
  }];
  return {
    leaseSchemaVersion: 2,
    manifestVersion: 2,
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identityBinding,
    userId: ids.user,
    organizationId: ids.organization,
    membershipId: ids.membership,
    membershipRowVersion: 1,
    role: 'employee',
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    configurationRevision: '3'.repeat(64),
    itemCount: 1,
    serializedBytes: JSON.stringify(items).length,
    manifestDigest: mobileManifestDigestV2(items),
    items,
    nextCursor: null,
  };
}

function leasePageV3(): OfflineCaptureLeasePageV3 {
  const items = [{
    itemType: 'manual_break' as const,
    subjectType: 'break' as const,
    itemId: ids.item,
    displayName: 'Pause' as const,
  }];
  return {
    leaseSchemaVersion: 3,
    manifestVersion: 3,
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identityBinding,
    userId: ids.user,
    organizationId: ids.organization,
    membershipId: ids.membership,
    membershipRowVersion: 1,
    role: 'employee',
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    configurationRevision: '3'.repeat(64),
    itemCount: 1,
    serializedBytes: JSON.stringify(items).length,
    manifestDigest: mobileManifestDigestV3(items),
    items,
    nextCursor: null,
  };
}

function breakEventDraft(
  page: OfflineCaptureLeasePageV3,
  eventId: string,
  receiptId: string,
  delta: number,
) {
  return {
    organizationId: ids.organization,
    expectedMembershipId: ids.membership,
    leaseId: ids.lease,
    leaseItemId: ids.item,
    installationBinding: installationBindingEncoded,
    provenanceVersion: 3 as const,
    clock: {
      bootMarker: 'boot-1',
      monotonicAnchorMilliseconds: 10_000,
      monotonicDeltaMilliseconds: delta,
      wallClockAnchor: page.issuedAt,
      clockProofStatus: 'verified_same_boot' as const,
      clockProofVersion: 1 as const,
    },
    workEvent: {
      id: eventId,
      subject: { type: 'break' as const },
      occurredAt: new Date(Date.parse(page.issuedAt) + delta).toISOString(),
      trigger: { type: 'manual' as const },
    },
    receipt: { id: receiptId, attemptNumber: 1 as const },
  };
}

function eventDraft(
  workEventId: string,
  receiptId: string,
): Omit<OfflineLifecycleEventCommand, 'deviceSequence'> {
  return {
    organizationId: ids.organization,
    expectedMembershipId: ids.membership,
    leaseId: ids.lease,
    leaseItemId: ids.item,
    installationBinding: installationBindingEncoded,
    provenanceVersion: 1,
    clock: {
      bootMarker: 'boot-1',
      monotonicAnchorMilliseconds: 10_000,
      monotonicDeltaMilliseconds: 1_000,
      wallClockAnchor: '2026-07-18T10:00:00.000Z',
      clockProofStatus: 'verified_same_boot',
      clockProofVersion: 1,
    },
    workEvent: {
      id: workEventId,
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      target: { targetType: 'customer', targetId: ids.customer },
      occurredAt: '2026-07-18T10:00:01.000Z',
    },
    receipt: { id: receiptId, attemptNumber: 1 },
  };
}

async function readyStore() {
  const native = new MemoryOfflineDatabase();
  const store = new OfflineCaptureDatabase(async () => native, installationBinding);
  await store.initialize();
  return { store, native };
}

function memoryOwner(): MemoryOwner {
  return {
    organization_id: ids.organization,
    user_id: ids.user,
    membership_id: ids.membership,
    installation_binding_digest: bindingDigest,
    installation_id: ids.installation,
    identity_binding_id: ids.identityBinding,
    next_device_sequence: 0,
    review_pending_sequence: null,
    capture_invalidated: 0,
  };
}
