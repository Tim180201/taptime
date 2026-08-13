import type {
  OfflineLifecycleEventCommand,
  OfflineLifecycleEventCommandV2,
} from '@taptime/offline-sync-contract';
import type {
  OfflineDatabaseConnection,
  OfflineSqlParams,
  OfflineSqlValue,
} from '../../src/offline/OfflineCaptureDatabase';
import type {
  OfflineSecureStorePort,
} from '../../src/offline/OfflineInstallationIdentityStore';

export function memorySecureStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const port: OfflineSecureStorePort = {
    isAvailableAsync: async () => true,
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => {
      values.set(key, value);
    },
    deleteItemAsync: async (key) => {
      values.delete(key);
    },
  };
  return { port, values };
}

export interface MemoryOwner {
  organization_id: string;
  user_id: string;
  membership_id: string;
  installation_binding_digest: string;
  installation_id: string | null;
  identity_binding_id: string | null;
  next_device_sequence: number;
  review_pending_sequence: number | null;
  capture_invalidated: number;
}

interface MemoryLease {
  leaseId: string;
  installationId: string;
  identityBindingId: string;
  organizationId: string;
  userId: string;
  membershipId: string;
  role: 'administrator' | 'employee';
  state: 'assembling' | 'active' | 'retired';
  issuedAt: string;
  expiresAt: string;
  boot: string;
  monotonic: number;
}

interface MemoryItem {
  leaseId: string;
  itemId: string;
  itemType: 'nfc_assignment' | 'manual_target';
  lookup: string | null;
  assignmentId: string | null;
  tagId: string | null;
  targetType: 'customer' | 'project' | 'general_work';
  targetId: string;
  displayName: string;
}

interface MemoryQueue {
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2;
  state: 'pending' | 'in_flight' | 'retry_wait' | 'protected_review_predecessor';
  attemptCount: number;
  nextAttemptAt: number | null;
  bytes: number;
}

export class MemoryOfflineDatabase implements OfflineDatabaseConnection {
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
        review_pending_sequence: null,
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
        installationId: String(values[1]),
        identityBindingId: String(values[2]),
        organizationId: String(values[3]),
        userId: String(values[4]),
        membershipId: String(values[5]),
        role: String(values[7]) as MemoryLease['role'],
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
        itemType: String(values[2]) as MemoryItem['itemType'],
        lookup: values[3] === null ? null : String(values[3]),
        assignmentId: values[4] === null ? null : String(values[4]),
        tagId: values[5] === null ? null : String(values[5]),
        targetType: String(values[6]) as MemoryItem['targetType'],
        targetId: String(values[7]),
        displayName: String(values[8]),
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
      const command = JSON.parse(String(values[5])) as
        OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2;
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
    if (source.includes('SET review_pending_sequence = COALESCE')) {
      if (
        this.owner === null
        || (
          this.owner.review_pending_sequence !== null
          && this.owner.review_pending_sequence > Number(values[1])
        )
      ) return { changes: 0 };
      this.owner.review_pending_sequence ??= Number(values[0]);
      return { changes: 1 };
    }
    if (source.includes('SET review_pending_sequence = NULL')) {
      if (
        this.owner === null
        || this.owner.review_pending_sequence !== Number(values[0])
        || this.owner.review_pending_sequence > Number(values[1])
      ) return { changes: 0 };
      this.owner.review_pending_sequence = null;
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
    if (
      source.includes('FROM offline_owner AS owner')
      && source.includes("generation.generation_state = 'active'")
    ) {
      const owner = this.owner;
      const lease = this.leases.find((candidate) => candidate.state === 'active');
      if (
        owner === null
        || owner.capture_invalidated !== 0
        || lease === undefined
        || lease.organizationId !== owner.organization_id
        || lease.userId !== owner.user_id
        || lease.membershipId !== owner.membership_id
      ) return null;
      return {
        organization_id: owner.organization_id,
        user_id: owner.user_id,
        membership_id: owner.membership_id,
        membership_role: lease.role,
        lease_id: lease.leaseId,
        installation_id: lease.installationId,
        identity_binding_id: lease.identityBindingId,
        issued_at: lease.issuedAt,
        expires_at: lease.expiresAt,
        activation_boot_marker: lease.boot,
        activation_monotonic_milliseconds: lease.monotonic,
      } as Row;
    }
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
        && candidate.assignmentId === values[8]
        && candidate.tagId === values[9]
        && candidate.targetId === values[6]
      ));
      const lease = this.leases.find((candidate) => (
        candidate.leaseId === values[0] && candidate.state === 'active'
      ));
      return item !== undefined && lease !== undefined
        ? { item_id: item.itemId } as Row
        : null;
    }
    if (
      source.includes('FROM offline_lease_generations AS generation')
      && source.includes("item.item_type = 'manual_target'")
    ) {
      const item = this.items.find((candidate) => (
        candidate.itemType === 'manual_target'
        && candidate.targetType === values[0]
        && candidate.targetId === values[1]
      ));
      const lease = item === undefined
        ? undefined
        : this.leases.find((candidate) => (
            candidate.leaseId === item.leaseId && candidate.state === 'active'
          ));
      return item === undefined || lease === undefined
        ? null
        : {
            lease_id: lease.leaseId,
            item_id: item.itemId,
            target_type: item.targetType,
            target_id: item.targetId,
            display_name: item.displayName,
            issued_at: lease.issuedAt,
            expires_at: lease.expiresAt,
            activation_boot_marker: lease.boot,
            activation_monotonic_milliseconds: lease.monotonic,
          } as Row;
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
        target_type: item.targetType,
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

  async getAllAsync<Row>(
    source: string,
    params: OfflineSqlParams = [],
  ): Promise<Row[]> {
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
    if (
      source.includes('FROM offline_lease_generations AS generation')
      && source.includes("item.item_type = 'manual_target'")
      && source.includes('ORDER BY item.target_type')
    ) {
      const leaseId = String(asArray(params)[0]);
      const active = this.leases.some((lease) => (
        lease.leaseId === leaseId && lease.state === 'active'
      ));
      if (!active || this.owner?.capture_invalidated !== 0) return [];
      return this.items
        .filter((item) => item.leaseId === leaseId && item.itemType === 'manual_target')
        .map((item) => {
          const lease = this.leases.find((candidate) => candidate.leaseId === item.leaseId)!;
          return {
            lease_id: item.leaseId,
            item_id: item.itemId,
            target_type: item.targetType,
            target_id: item.targetId,
            display_name: item.displayName,
            issued_at: lease.issuedAt,
            expires_at: lease.expiresAt,
            activation_boot_marker: lease.boot,
            activation_monotonic_milliseconds: lease.monotonic,
          };
        }) as Row[];
    }
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

function asArray(params: OfflineSqlParams): readonly OfflineSqlValue[] {
  if (Array.isArray(params)) return params;
  return Object.values(params);
}
