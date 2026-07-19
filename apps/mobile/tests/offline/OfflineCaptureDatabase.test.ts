import type {
  OfflineCaptureLeasePage,
  OfflineLifecycleEventCommand,
} from '@taptime/offline-sync-contract';
import { describe, expect, it } from 'vitest';
import {
  OfflineCaptureDatabase,
  type OfflineDatabaseConnection,
  type OfflineSqlParams,
  type OfflineSqlValue,
} from '../../src/offline/OfflineCaptureDatabase';
import { mobileManifestDigest } from '../../src/offline/MobileLookupHmac';

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
      expect(native.userVersion).toBe(1);
      expect(native.exclusiveTransactions).toBeGreaterThanOrEqual(2);
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
      })).rejects.toThrow('identity mismatch');
      await expect(store.queueCount()).resolves.toBe(2);

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
      });
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

interface MemoryOwner {
  organization_id: string;
  user_id: string;
  membership_id: string;
  installation_binding_digest: string;
  installation_id: string | null;
  identity_binding_id: string | null;
  next_device_sequence: number;
  capture_invalidated: number;
}

interface MemoryLease {
  leaseId: string;
  state: 'assembling' | 'active' | 'retired';
  issuedAt: string;
  expiresAt: string;
  boot: string;
  monotonic: number;
}

interface MemoryItem {
  leaseId: string;
  itemId: string;
  lookup: string;
  assignmentId: string;
  tagId: string;
  targetId: string;
  displayName: string;
}

interface MemoryQueue {
  command: OfflineLifecycleEventCommand;
  state: 'pending' | 'in_flight' | 'retry_wait' | 'protected_review_predecessor';
  attemptCount: number;
  nextAttemptAt: number | null;
  bytes: number;
}

class MemoryOfflineDatabase implements OfflineDatabaseConnection {
  userVersion = 0;
  cipherRows: Record<string, unknown>[] = [];
  integrity = 'ok';
  owner: MemoryOwner | null = null;
  leases: MemoryLease[] = [];
  items: MemoryItem[] = [];
  queue: MemoryQueue[] = [];
  syntheticQueueCount: number | null = null;
  execLog: string[] = [];
  exclusiveTransactions = 0;
  closed = false;

  async execAsync(source: string): Promise<void> {
    this.execLog.push(source);
    const version = /PRAGMA user_version = (\d+)/.exec(source);
    if (version !== null) this.userVersion = Number(version[1]);
  }

  async runAsync(source: string, params: OfflineSqlParams) {
    const values = asArray(params);
    if (source.includes("SET queue_state = 'pending'")) {
      let changes = 0;
      for (const row of this.queue) {
        if (row.state === 'in_flight') {
          row.state = 'pending';
          changes += 1;
        }
      }
      return { changes };
    }
    if (source.includes('INSERT INTO offline_owner')) {
      this.owner = {
        organization_id: String(values[0]),
        user_id: String(values[1]),
        membership_id: String(values[2]),
        installation_binding_digest: String(values[3]),
        installation_id: null,
        identity_binding_id: null,
        next_device_sequence: 0,
        capture_invalidated: 0,
      };
      return { changes: 1 };
    }
    if (source.includes('SET installation_id = ?')) {
      if (this.owner === null) return { changes: 0 };
      this.owner.installation_id = String(values[0]);
      this.owner.identity_binding_id = String(values[1]);
      this.owner.capture_invalidated = 0;
      return { changes: 1 };
    }
    if (source.includes('INSERT INTO offline_lease_generations')) {
      this.leases.push({
        leaseId: String(values[0]),
        issuedAt: String(values[8]),
        expiresAt: String(values[9]),
        boot: String(values[14]),
        monotonic: Number(values[15]),
        state: 'assembling',
      });
      return { changes: 1 };
    }
    if (source.includes('INSERT INTO offline_lease_items')) {
      this.items.push({
        leaseId: String(values[0]),
        itemId: String(values[1]),
        lookup: String(values[2]),
        assignmentId: String(values[3]),
        tagId: String(values[4]),
        targetId: String(values[6]),
        displayName: String(values[7]),
      });
      return { changes: 1 };
    }
    if (source.includes("SET generation_state = 'retired'")) {
      let changes = 0;
      for (const lease of this.leases) {
        if (lease.state === 'active') {
          lease.state = 'retired';
          changes += 1;
        }
      }
      return { changes };
    }
    if (source.includes("SET generation_state = 'active'")) {
      const lease = this.leases.find((candidate) => (
        candidate.leaseId === values[0] && candidate.state === 'assembling'
      ));
      if (lease === undefined) return { changes: 0 };
      lease.state = 'active';
      return { changes: 1 };
    }
    if (source.includes('INSERT INTO offline_event_queue')) {
      const command = JSON.parse(String(values[5])) as OfflineLifecycleEventCommand;
      this.queue.push({
        command,
        bytes: Number(values[6]),
        state: 'pending',
        attemptCount: 0,
        nextAttemptAt: null,
      });
      return { changes: 1 };
    }
    if (source.includes('SET next_device_sequence = ?')) {
      if (
        this.owner === null
        || this.owner.next_device_sequence !== Number(values[1])
      ) return { changes: 0 };
      this.owner.next_device_sequence = Number(values[0]);
      return { changes: 1 };
    }
    if (source.includes("SET queue_state = 'in_flight'")) {
      const row = this.queue.find(({ command }) => command.deviceSequence === Number(values[0]));
      if (row === undefined) return { changes: 0 };
      row.state = 'in_flight';
      return { changes: 1 };
    }
    if (source.includes("SET queue_state = 'retry_wait'")) {
      const row = this.exactHead(values[2], values[3], values[4]);
      if (row === null) return { changes: 0 };
      row.state = 'retry_wait';
      row.attemptCount = Number(values[0]);
      row.nextAttemptAt = Number(values[1]);
      return { changes: 1 };
    }
    if (source.includes('DELETE FROM offline_event_queue')) {
      const row = this.exactHead(values[0], values[1], values[2]);
      if (row === null) return { changes: 0 };
      this.queue.splice(this.queue.indexOf(row), 1);
      return { changes: 1 };
    }
    if (source.includes('capture_invalidated = 1')) {
      if (this.owner === null) return { changes: 0 };
      this.owner.capture_invalidated = 1;
      return { changes: 1 };
    }
    throw new Error(`Unsupported synthetic run SQL: ${source}`);
  }

  async getFirstAsync<Row>(source: string, params: OfflineSqlParams = []): Promise<Row | null> {
    const values = asArray(params);
    if (source === 'PRAGMA user_version') return { user_version: this.userVersion } as Row;
    if (source === 'PRAGMA integrity_check') return { integrity_check: this.integrity } as Row;
    if (source.includes('FROM offline_owner')) return this.owner as Row | null;
    if (source.includes('count(*) AS item_count')) {
      return {
        item_count: this.items.filter((item) => item.leaseId === values[0]).length,
      } as Row;
    }
    if (
      source.includes('FROM offline_lease_generations')
      && source.includes('WHERE lease_id = ?')
      && !source.includes(' AS generation')
    ) return null;
    if (
      source.includes('AS event_count')
      || source.includes('COALESCE(sum(serialized_bytes)')
    ) {
      return {
        event_count: this.syntheticQueueCount ?? this.queue.length,
        total_bytes: this.queue.reduce((sum, row) => sum + row.bytes, 0),
      } as Row;
    }
    if (
      source.includes('FROM offline_lease_generations AS generation')
      && source.includes('item.assignment_id = ?')
    ) {
      const item = this.items.find((candidate) => (
        candidate.leaseId === values[0]
        && candidate.itemId === values[4]
        && candidate.assignmentId === values[5]
        && candidate.tagId === values[6]
        && candidate.targetId === values[8]
      ));
      const lease = this.leases.find((candidate) => (
        candidate.leaseId === values[0] && candidate.state === 'active'
      ));
      return item !== undefined && lease !== undefined
        ? { item_id: item.itemId } as Row
        : null;
    }
    if (source.includes('FROM offline_lease_generations AS generation')) {
      const item = this.items.find((candidate) => candidate.lookup === values[0]);
      const lease = item === undefined
        ? undefined
        : this.leases.find((candidate) => (
            candidate.leaseId === item.leaseId && candidate.state === 'active'
          ));
      if (this.owner?.capture_invalidated !== 0 || item === undefined || lease === undefined) {
        return null;
      }
      return {
        lease_id: lease.leaseId,
        item_id: item.itemId,
        assignment_id: item.assignmentId,
        nfc_tag_id: item.tagId,
        target_type: 'customer',
        target_id: item.targetId,
        display_name: item.displayName,
        issued_at: lease.issuedAt,
        expires_at: lease.expiresAt,
        activation_boot_marker: lease.boot,
        activation_monotonic_milliseconds: lease.monotonic,
      } as Row;
    }
    if (
      source.includes('count(*) AS count')
      || source.includes(') AS count')
    ) return { count: this.queue.length } as Row;
    if (source.includes('FROM offline_event_queue')) {
      const head = this.sortedQueue()[0];
      return head === undefined ? null : {
        queue_state: head.state,
        attempt_count: head.attemptCount,
        next_attempt_at: head.nextAttemptAt,
        command_json: JSON.stringify(head.command),
      } as Row;
    }
    throw new Error(`Unsupported synthetic first SQL: ${source}`);
  }

  async getAllAsync<Row>(source: string): Promise<Row[]> {
    if (source === 'PRAGMA cipher_integrity_check') return this.cipherRows as Row[];
    if (source.includes('SELECT device_sequence FROM offline_event_queue')) {
      return this.sortedQueue().map(({ command }) => ({
        device_sequence: command.deviceSequence,
      })) as Row[];
    }
    if (
      source.includes('SELECT submission_json FROM offline_legacy_queue')
      || source.includes('FROM offline_protected_quarantine')
    ) return [];
    throw new Error(`Unsupported synthetic all SQL: ${source}`);
  }

  async withExclusiveTransactionAsync(
    task: (transaction: OfflineDatabaseConnection) => Promise<void>,
  ): Promise<void> {
    this.exclusiveTransactions += 1;
    const snapshot = structuredClone({
      owner: this.owner,
      leases: this.leases,
      items: this.items,
      queue: this.queue,
      userVersion: this.userVersion,
    });
    try {
      await task(this);
    } catch (error) {
      this.owner = snapshot.owner;
      this.leases = snapshot.leases;
      this.items = snapshot.items;
      this.queue = snapshot.queue;
      this.userVersion = snapshot.userVersion;
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    this.closed = true;
  }

  private sortedQueue(): MemoryQueue[] {
    return [...this.queue].sort(
      (left, right) => left.command.deviceSequence - right.command.deviceSequence,
    );
  }

  private exactHead(
    sequence: OfflineSqlValue | undefined,
    workEventId: OfflineSqlValue | undefined,
    receiptId: OfflineSqlValue | undefined,
  ): MemoryQueue | null {
    const head = this.sortedQueue()[0];
    return head !== undefined
      && head.command.deviceSequence === Number(sequence)
      && head.command.workEvent.id === workEventId
      && head.command.receipt.id === receiptId
      ? head
      : null;
  }
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
    capture_invalidated: 0,
  };
}

function asArray(params: OfflineSqlParams): readonly OfflineSqlValue[] {
  if (Array.isArray(params)) return params;
  return Object.values(params);
}
