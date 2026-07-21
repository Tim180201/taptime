import {
  OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS,
  OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES,
  OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS,
  OFFLINE_LOCAL_SCHEMA_VERSION,
  OFFLINE_QUEUE_MAXIMUM_EVENT_BYTES,
  OFFLINE_QUEUE_MAXIMUM_EVENTS,
  OFFLINE_QUEUE_MAXIMUM_TOTAL_BYTES,
  isCanonicalOfflineUuid,
  isOfflineBase64Url32Bytes,
  isOfflineIsoTimestamp,
  isPositiveSafeInteger,
  type OfflineCaptureLeaseItem,
  type OfflineCaptureLeasePage,
  type OfflineLifecycleEventCommand,
  type OfflineLocalStoreResult,
  type OfflineProtectedReason,
  type OfflineQueueState,
} from '@taptime/offline-sync-contract';
import type { LifecycleEventSubmission } from '../transport/contracts';
import { bytesToLowercaseHex } from './encoding';
import { mobileManifestDigest } from './MobileLookupHmac';

export type OfflineSqlValue = string | number | null | Uint8Array;
export type OfflineSqlParams =
  | readonly OfflineSqlValue[]
  | Readonly<Record<string, OfflineSqlValue>>;

export interface OfflineDatabaseConnection {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: OfflineSqlParams): Promise<{ readonly changes: number }>;
  getFirstAsync<Row>(source: string, params?: OfflineSqlParams): Promise<Row | null>;
  getAllAsync<Row>(source: string, params?: OfflineSqlParams): Promise<Row[]>;
  withExclusiveTransactionAsync(
    task: (transaction: OfflineDatabaseConnection) => Promise<void>,
  ): Promise<void>;
  closeAsync(): Promise<void>;
}

export type OfflineDatabaseOpen = (
  databaseName: string,
) => Promise<OfflineDatabaseConnection>;

export interface OfflineDatabaseOwner {
  readonly organizationId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly installationBindingDigest: string;
}

export interface OfflineLeaseActivation {
  readonly page: OfflineCaptureLeasePage;
  readonly activationBootMarker: string;
  readonly activationMonotonicMilliseconds: number;
}

export type OfflineLifecycleEventDraft = Omit<OfflineLifecycleEventCommand, 'deviceSequence'>;

export interface OfflineQueueHead {
  readonly state: OfflineQueueState;
  readonly attemptCount: number;
  readonly nextAttemptAt: number | null;
  readonly command: OfflineLifecycleEventCommand;
}

export interface ActiveOfflineLeaseItem {
  readonly leaseId: string;
  readonly leaseItemId: string;
  readonly assignmentId: string;
  readonly nfcTagId: string;
  readonly targetType: 'customer';
  readonly targetId: string;
  readonly displayName: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly activationBootMarker: string;
  readonly activationMonotonicMilliseconds: number;
}

export interface ActiveOfflineCaptureContext {
  readonly organizationId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly role: 'administrator' | 'employee';
  readonly leaseId: string;
  readonly installationId: string;
  readonly identityBindingId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly activationBootMarker: string;
  readonly activationMonotonicMilliseconds: number;
}

export interface LegacyOfflineQueueHead {
  readonly state: OfflineQueueState;
  readonly attemptCount: number;
  readonly nextAttemptAt: number | null;
  readonly submission: LifecycleEventSubmission;
}

interface UserVersionRow {
  readonly user_version: number;
}

interface IntegrityRow {
  readonly integrity_check: string;
}

interface OwnerRow {
  readonly organization_id: string;
  readonly user_id: string;
  readonly membership_id: string;
  readonly installation_binding_digest: string;
  readonly installation_id: string | null;
  readonly identity_binding_id: string | null;
  readonly next_device_sequence: number;
  readonly review_pending_sequence: number | null;
  readonly capture_invalidated: number;
}

interface QueueSummaryRow {
  readonly event_count: number;
  readonly total_bytes: number;
}

interface QueueRow {
  readonly queue_state: OfflineQueueState;
  readonly attempt_count: number;
  readonly next_attempt_at: number | null;
  readonly command_json: string;
}

interface LeaseLookupRow {
  readonly lease_id: string;
  readonly item_id: string;
  readonly assignment_id: string;
  readonly nfc_tag_id: string;
  readonly target_type: 'customer';
  readonly target_id: string;
  readonly display_name: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly activation_boot_marker: string;
  readonly activation_monotonic_milliseconds: number;
}

interface ActiveLeaseContextRow {
  readonly organization_id: string;
  readonly user_id: string;
  readonly membership_id: string;
  readonly membership_role: 'administrator' | 'employee';
  readonly lease_id: string;
  readonly installation_id: string;
  readonly identity_binding_id: string;
  readonly issued_at: string;
  readonly expires_at: string;
  readonly activation_boot_marker: string;
  readonly activation_monotonic_milliseconds: number;
}

interface LeaseGenerationRow {
  readonly lease_id: string;
  readonly installation_id: string;
  readonly identity_binding_id: string;
  readonly organization_id: string;
  readonly user_id: string;
  readonly membership_id: string;
  readonly membership_row_version: number;
  readonly membership_role: 'administrator' | 'employee';
  readonly issued_at: string;
  readonly expires_at: string;
  readonly configuration_revision: string;
  readonly item_count: number;
  readonly serialized_bytes: number;
  readonly manifest_digest: string;
  readonly generation_state: 'assembling' | 'active' | 'retired';
}

interface LegacyQueueRow {
  readonly queue_state: OfflineQueueState;
  readonly attempt_count: number;
  readonly next_attempt_at: number | null;
  readonly submission_json: string;
}

interface ExistingLegacyRow {
  readonly work_event_id: string;
  readonly receipt_id: string;
  readonly submission_json: string;
}

interface QuarantineRow {
  readonly quarantine_id: string;
  readonly reason: string;
  readonly evidence_json: string;
}

const DATABASE_NAME = 'taptime-offline-v1.db';
const lowercaseSha256Pattern = /^[0-9a-f]{64}$/;

export class OfflineCaptureDatabase {
  private connection: OfflineDatabaseConnection | null = null;
  private protectedReason: OfflineProtectedReason | null = null;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly openDatabase: OfflineDatabaseOpen,
    private readonly databaseKey: Uint8Array,
  ) {}

  initialize(): Promise<OfflineLocalStoreResult> {
    return this.serialized(async () => {
      if (this.connection !== null) return { status: 'ready' };
      if (this.databaseKey.length !== 32) {
        return this.protect('wrong_key');
      }
      let database: OfflineDatabaseConnection;
      try {
        database = await this.openDatabase(DATABASE_NAME);
        const keyHex = bytesToLowercaseHex(this.databaseKey);
        if (!lowercaseSha256Pattern.test(keyHex)) return this.protect('wrong_key');
        await database.execAsync(`PRAGMA key = "x'${keyHex}'"`);
        if (!await cipherAndDatabaseIntegrityPass(database)) {
          await database.closeAsync().catch(() => undefined);
          return this.protect('cipher_integrity_failed');
        }
        const version = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
        if (
          version === null
          || !Number.isSafeInteger(version.user_version)
          || version.user_version < 0
        ) {
          await database.closeAsync().catch(() => undefined);
          return this.protect('corrupt_row');
        }
        if (version.user_version > OFFLINE_LOCAL_SCHEMA_VERSION) {
          await database.closeAsync().catch(() => undefined);
          return this.protect('unknown_schema');
        }
        if (version.user_version === 0) {
          try {
            await database.withExclusiveTransactionAsync(async (transaction) => {
              await transaction.execAsync(OFFLINE_SCHEMA_V2);
              await transaction.execAsync(`PRAGMA user_version = ${OFFLINE_LOCAL_SCHEMA_VERSION}`);
            });
          } catch {
            await database.closeAsync().catch(() => undefined);
            return { status: 'migration_failed' };
          }
        } else if (version.user_version === 1) {
          try {
            await database.withExclusiveTransactionAsync(async (transaction) => {
              await transaction.execAsync(OFFLINE_SCHEMA_V1_TO_V2);
              await transaction.execAsync(`PRAGMA user_version = ${OFFLINE_LOCAL_SCHEMA_VERSION}`);
            });
          } catch {
            await database.closeAsync().catch(() => undefined);
            return { status: 'migration_failed' };
          }
        }
        await database.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
        await database.withExclusiveTransactionAsync(async (transaction) => {
          await transaction.runAsync(
            `UPDATE offline_event_queue
             SET queue_state = 'pending'
             WHERE queue_state = 'in_flight'`,
            [],
          );
          await transaction.runAsync(
            `UPDATE offline_legacy_queue
             SET queue_state = 'pending'
             WHERE queue_state = 'in_flight'`,
            [],
          );
        });
        this.connection = database;
        const validation = await this.validateDatabaseState();
        if (validation.status !== 'ready') {
          await database.closeAsync().catch(() => undefined);
          this.connection = null;
          return validation;
        }
        return { status: 'ready' };
      } catch {
        return this.protect('wrong_key');
      }
    });
  }

  bindOwner(owner: OfflineDatabaseOwner): Promise<OfflineLocalStoreResult> {
    return this.serialized(async () => {
      const database = this.requireReady();
      if (!validOwner(owner)) return this.protect('corrupt_row');
      let result: OfflineLocalStoreResult = { status: 'ready' };
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const existing = await transaction.getFirstAsync<OwnerRow>(
          'SELECT * FROM offline_owner WHERE singleton_id = 1',
        );
        if (existing === null) {
          await transaction.runAsync(
            `INSERT INTO offline_owner (
               singleton_id, organization_id, user_id, membership_id,
               installation_binding_digest, installation_id, identity_binding_id,
               next_device_sequence, review_pending_sequence, capture_invalidated
             ) VALUES (1, ?, ?, ?, ?, NULL, NULL, 0, NULL, 0)`,
            [
              owner.organizationId,
              owner.userId,
              owner.membershipId,
              owner.installationBindingDigest,
            ],
          );
          return;
        }
        if (!sameOwner(existing, owner)) {
          result = this.protect('identity_mismatch');
        }
      });
      return result;
    });
  }

  activateLease(activation: OfflineLeaseActivation): Promise<OfflineLocalStoreResult> {
    return this.serialized(async () => {
      const database = this.requireReady();
      const { page } = activation;
      if (!validLeaseActivation(activation)) return this.protect('corrupt_row');
      if (
        page.items.length > OFFLINE_LEASE_ACTIVATION_MAXIMUM_ITEMS
        || page.serializedBytes > OFFLINE_LEASE_ACTIVATION_MAXIMUM_BYTES
        || page.items.length !== page.itemCount
        || page.nextCursor !== null
        || utf8ByteLength(JSON.stringify(page.items)) !== page.serializedBytes
        || !manifestMatches(page.items, page.manifestDigest)
      ) {
        return { status: 'full' };
      }
      let result: OfflineLocalStoreResult = { status: 'ready' };
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const owner = await transaction.getFirstAsync<OwnerRow>(
          'SELECT * FROM offline_owner WHERE singleton_id = 1',
        );
        if (
          owner === null
          || owner.organization_id !== page.organizationId
          || owner.user_id !== page.userId
          || owner.membership_id !== page.membershipId
          || (
            owner.installation_id !== null
            && owner.installation_id !== page.installationId
          )
          || (
            owner.identity_binding_id !== null
            && owner.identity_binding_id !== page.identityBindingId
          )
        ) {
          result = this.protect('identity_mismatch');
          return;
        }
        const existing = await transaction.getFirstAsync<LeaseGenerationRow>(
          `SELECT lease_id, installation_id, identity_binding_id, organization_id, user_id,
                  membership_id, membership_row_version, membership_role, issued_at, expires_at,
                  configuration_revision, item_count, serialized_bytes, manifest_digest,
                  generation_state
           FROM offline_lease_generations
           WHERE lease_id = ?`,
          [page.leaseId],
        );
        if (existing !== null) {
          if (
            existing.generation_state === 'active'
            && sameLeaseGeneration(existing, page)
          ) {
            result = { status: 'ready' };
            return;
          }
          result = this.protect('corrupt_row');
          return;
        }
        await transaction.runAsync(
          `UPDATE offline_owner
           SET installation_id = ?, identity_binding_id = ?, capture_invalidated = 0
           WHERE singleton_id = 1`,
          [page.installationId, page.identityBindingId],
        );
        await transaction.runAsync(
          `INSERT INTO offline_lease_generations (
             lease_id, installation_id, identity_binding_id, organization_id, user_id,
             membership_id, membership_row_version, membership_role, issued_at, expires_at,
             configuration_revision, item_count, serialized_bytes, manifest_digest,
             activation_boot_marker, activation_monotonic_milliseconds, generation_state
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assembling')`,
          [
            page.leaseId,
            page.installationId,
            page.identityBindingId,
            page.organizationId,
            page.userId,
            page.membershipId,
            page.membershipRowVersion,
            page.role,
            page.issuedAt,
            page.expiresAt,
            page.configurationRevision,
            page.itemCount,
            page.serializedBytes,
            page.manifestDigest,
            activation.activationBootMarker,
            activation.activationMonotonicMilliseconds,
          ],
        );
        for (const item of page.items) {
          await transaction.runAsync(
            `INSERT INTO offline_lease_items (
               lease_id, item_id, lookup_value, assignment_id, nfc_tag_id,
               target_type, target_id, display_name
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              page.leaseId,
              item.itemId,
              item.lookup,
              item.assignmentId,
              item.nfcTagId,
              item.targetType,
              item.targetId,
              item.displayName,
            ],
          );
        }
        const assembled = await transaction.getFirstAsync<{
          readonly item_count: number;
        }>(
          `SELECT count(*) AS item_count
           FROM offline_lease_items
           WHERE lease_id = ?`,
          [page.leaseId],
        );
        if (assembled?.item_count !== page.itemCount) {
          throw new Error('Offline lease generation is incomplete');
        }
        await transaction.runAsync(
          `UPDATE offline_lease_generations
           SET generation_state = 'retired'
           WHERE generation_state = 'active'`,
          [],
        );
        const activated = await transaction.runAsync(
          `UPDATE offline_lease_generations
           SET generation_state = 'active'
           WHERE lease_id = ? AND generation_state = 'assembling'`,
          [page.leaseId],
        );
        if (activated.changes !== 1) throw new Error('Offline lease activation failed');
      });
      return result;
    });
  }

  readActiveCaptureContext(): Promise<ActiveOfflineCaptureContext | null> {
    return this.serialized(async () => {
      const row = await this.requireReady().getFirstAsync<ActiveLeaseContextRow>(
        `SELECT owner.organization_id, owner.user_id, owner.membership_id,
                generation.membership_role, generation.lease_id, generation.installation_id,
                generation.identity_binding_id, generation.issued_at, generation.expires_at,
                generation.activation_boot_marker,
                generation.activation_monotonic_milliseconds
         FROM offline_owner AS owner
         JOIN offline_lease_generations AS generation
           ON generation.organization_id = owner.organization_id
          AND generation.user_id = owner.user_id
          AND generation.membership_id = owner.membership_id
         WHERE owner.singleton_id = 1
           AND owner.capture_invalidated = 0
           AND generation.generation_state = 'active'`,
      );
      if (row === null) return null;
      const context: ActiveOfflineCaptureContext = {
        organizationId: row.organization_id,
        userId: row.user_id,
        membershipId: row.membership_id,
        role: row.membership_role,
        leaseId: row.lease_id,
        installationId: row.installation_id,
        identityBindingId: row.identity_binding_id,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        activationBootMarker: row.activation_boot_marker,
        activationMonotonicMilliseconds: row.activation_monotonic_milliseconds,
      };
      return validActiveCaptureContext(context) ? Object.freeze(context) : null;
    });
  }

  lookupActiveItem(lookup: string): Promise<ActiveOfflineLeaseItem | null> {
    return this.serialized(async () => {
      const database = this.requireReady();
      if (!lowercaseSha256Pattern.test(lookup)) return null;
      const row = await database.getFirstAsync<LeaseLookupRow>(
        `SELECT generation.lease_id, item.item_id, item.assignment_id, item.nfc_tag_id,
                item.target_type, item.target_id, item.display_name, generation.issued_at,
                generation.expires_at, generation.activation_boot_marker,
                generation.activation_monotonic_milliseconds
         FROM offline_lease_generations AS generation
         JOIN offline_lease_items AS item ON item.lease_id = generation.lease_id
         JOIN offline_owner AS owner ON owner.singleton_id = 1
         WHERE generation.generation_state = 'active'
           AND owner.capture_invalidated = 0
           AND item.lookup_value = ?`,
        [lookup],
      );
      return row === null ? null : Object.freeze({
        leaseId: row.lease_id,
        leaseItemId: row.item_id,
        assignmentId: row.assignment_id,
        nfcTagId: row.nfc_tag_id,
        targetType: row.target_type,
        targetId: row.target_id,
        displayName: row.display_name,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        activationBootMarker: row.activation_boot_marker,
        activationMonotonicMilliseconds: row.activation_monotonic_milliseconds,
      });
    });
  }

  appendEvent(draft: OfflineLifecycleEventDraft): Promise<
    | { readonly status: 'ready'; readonly command: OfflineLifecycleEventCommand }
    | OfflineLocalStoreResult
  > {
    return this.serialized(async () => {
      const database = this.requireReady();
      let output:
        | { readonly status: 'ready'; readonly command: OfflineLifecycleEventCommand }
        | OfflineLocalStoreResult = { status: 'unavailable' };
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const summary = await transaction.getFirstAsync<QueueSummaryRow>(
          `SELECT (
             (SELECT count(*) FROM offline_event_queue)
             + (SELECT count(*) FROM offline_legacy_queue)
             + (SELECT count(*) FROM offline_protected_quarantine)
           ) AS event_count,
           (
             COALESCE((SELECT sum(serialized_bytes) FROM offline_event_queue), 0)
             + COALESCE((SELECT sum(serialized_bytes) FROM offline_legacy_queue), 0)
             + COALESCE((
               SELECT sum(length(CAST(evidence_json AS BLOB)))
               FROM offline_protected_quarantine
             ), 0)
           ) AS total_bytes`,
        );
        if (
          summary === null
          || summary.event_count >= OFFLINE_QUEUE_MAXIMUM_EVENTS
        ) {
          output = { status: 'full' };
          return;
        }
        const owner = await transaction.getFirstAsync<OwnerRow>(
          'SELECT * FROM offline_owner WHERE singleton_id = 1',
        );
        if (
          owner === null
          || owner.capture_invalidated !== 0
          || owner.organization_id !== draft.organizationId
          || owner.membership_id !== draft.expectedMembershipId
          || owner.installation_id === null
        ) {
          output = this.protect('identity_mismatch');
          return;
        }
        const leaseBinding = await transaction.getFirstAsync<{ readonly item_id: string }>(
          `SELECT item.item_id
           FROM offline_lease_generations AS generation
           JOIN offline_lease_items AS item
             ON item.lease_id = generation.lease_id
           WHERE generation.generation_state = 'active'
             AND generation.lease_id = ?
             AND generation.organization_id = ?
             AND generation.membership_id = ?
             AND generation.installation_id = ?
             AND item.item_id = ?
             AND item.assignment_id = ?
             AND item.nfc_tag_id = ?
             AND item.target_type = ?
             AND item.target_id = ?`,
          [
            draft.leaseId,
            draft.organizationId,
            draft.expectedMembershipId,
            owner.installation_id,
            draft.leaseItemId,
            draft.workEvent.assignmentId,
            draft.workEvent.nfcTagId,
            draft.workEvent.target.targetType,
            draft.workEvent.target.targetId,
          ],
        );
        if (leaseBinding?.item_id !== draft.leaseItemId) {
          output = this.protect('identity_mismatch');
          return;
        }
        const sequence = owner.next_device_sequence + 1;
        if (!Number.isSafeInteger(sequence) || sequence < 1) {
          output = this.protect('impossible_sequence');
          return;
        }
        const command = freezeOfflineCommand({ ...draft, deviceSequence: sequence });
        if (!validOfflineCommand(command)) {
          output = this.protect('corrupt_row');
          return;
        }
        const serialized = JSON.stringify(command);
        const serializedBytes = new TextEncoder().encode(serialized).length;
        if (
          serializedBytes > OFFLINE_QUEUE_MAXIMUM_EVENT_BYTES
          || summary.total_bytes + serializedBytes > OFFLINE_QUEUE_MAXIMUM_TOTAL_BYTES
        ) {
          output = { status: 'full' };
          return;
        }
        const inserted = await transaction.runAsync(
          `INSERT INTO offline_event_queue (
             device_sequence, work_event_id, receipt_id, lease_id, lease_item_id,
             command_json, serialized_bytes, queue_state, attempt_count, next_attempt_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL)`,
          [
            sequence,
            command.workEvent.id,
            command.receipt.id,
            command.leaseId,
            command.leaseItemId,
            serialized,
            serializedBytes,
          ],
        );
        const advanced = await transaction.runAsync(
          `UPDATE offline_owner
           SET next_device_sequence = ?
           WHERE singleton_id = 1 AND next_device_sequence = ?`,
          [sequence, sequence - 1],
        );
        if (inserted.changes !== 1 || advanced.changes !== 1) {
          throw new Error('Offline queue sequence allocation failed');
        }
        output = { status: 'ready', command };
      });
      return output;
    });
  }

  importLegacyReplayable(
    submission: LifecycleEventSubmission,
  ): Promise<OfflineLocalStoreResult> {
    return this.serialized(async () => {
      const database = this.requireReady();
      if (!validLegacySubmission(submission)) return this.protect('corrupt_row');
      const serialized = JSON.stringify(submission);
      const serializedBytes = utf8ByteLength(serialized);
      if (serializedBytes > OFFLINE_QUEUE_MAXIMUM_EVENT_BYTES) {
        return { status: 'full' };
      }
      let result: OfflineLocalStoreResult = { status: 'ready' };
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const existing = await transaction.getFirstAsync<ExistingLegacyRow>(
          `SELECT work_event_id, receipt_id, submission_json
           FROM offline_legacy_queue
           WHERE work_event_id = ? OR receipt_id = ?`,
          [submission.command.workEvent.id, submission.command.receipt.id],
        );
        if (existing !== null) {
          if (
            existing.work_event_id !== submission.command.workEvent.id
            || existing.receipt_id !== submission.command.receipt.id
            || existing.submission_json !== serialized
          ) {
            result = this.protect('corrupt_row');
          }
          return;
        }
        const summary = await transaction.getFirstAsync<{
          readonly event_count: number;
          readonly total_bytes: number;
        }>(
          `SELECT (
             (SELECT count(*) FROM offline_event_queue)
             + (SELECT count(*) FROM offline_legacy_queue)
           ) AS event_count,
           (
             COALESCE((SELECT sum(serialized_bytes) FROM offline_event_queue), 0)
             + COALESCE((SELECT sum(serialized_bytes) FROM offline_legacy_queue), 0)
           ) AS total_bytes`,
        );
        if (
          summary === null
          || summary.event_count >= OFFLINE_QUEUE_MAXIMUM_EVENTS
          || summary.total_bytes + serializedBytes > OFFLINE_QUEUE_MAXIMUM_TOTAL_BYTES
        ) {
          result = { status: 'full' };
          return;
        }
        const inserted = await transaction.runAsync(
          `INSERT INTO offline_legacy_queue (
             work_event_id, receipt_id, submission_json, serialized_bytes,
             queue_state, attempt_count, next_attempt_at
           ) VALUES (?, ?, ?, ?, 'pending', 0, NULL)`,
          [
            submission.command.workEvent.id,
            submission.command.receipt.id,
            serialized,
            serializedBytes,
          ],
        );
        if (inserted.changes !== 1) throw new Error('Legacy evidence import failed');
      });
      return result;
    });
  }

  verifyLegacyReplayable(submission: LifecycleEventSubmission): Promise<boolean> {
    return this.serialized(async () => {
      if (!validLegacySubmission(submission)) return false;
      const existing = await this.requireReady().getFirstAsync<ExistingLegacyRow>(
        `SELECT work_event_id, receipt_id, submission_json
         FROM offline_legacy_queue
         WHERE work_event_id = ? AND receipt_id = ?`,
        [submission.command.workEvent.id, submission.command.receipt.id],
      );
      return existing !== null
        && existing.submission_json === JSON.stringify(submission);
    });
  }

  importProtectedLegacy(
    quarantineId: string,
    evidenceJson: string,
    createdAt: string,
  ): Promise<OfflineLocalStoreResult> {
    return this.serialized(async () => {
      const database = this.requireReady();
      if (
        !isCanonicalOfflineUuid(quarantineId)
        || !isOfflineIsoTimestamp(createdAt)
        || utf8ByteLength(evidenceJson) < 1
        || utf8ByteLength(evidenceJson) > OFFLINE_QUEUE_MAXIMUM_EVENT_BYTES
      ) return this.protect('corrupt_row');
      let result: OfflineLocalStoreResult = { status: 'ready' };
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const existing = await transaction.getFirstAsync<QuarantineRow>(
          `SELECT quarantine_id, reason, evidence_json
           FROM offline_protected_quarantine
           WHERE quarantine_id = ?`,
          [quarantineId],
        );
        if (existing !== null) {
          if (
            existing.reason !== 'legacy_membership_unknown'
            || existing.evidence_json !== evidenceJson
          ) result = this.protect('corrupt_row');
          return;
        }
        const inserted = await transaction.runAsync(
          `INSERT INTO offline_protected_quarantine (
             quarantine_id, reason, evidence_json, created_at
           ) VALUES (?, 'legacy_membership_unknown', ?, ?)`,
          [quarantineId, evidenceJson, createdAt],
        );
        if (inserted.changes !== 1) throw new Error('Protected legacy import failed');
      });
      return result;
    });
  }

  verifyProtectedLegacy(quarantineId: string, evidenceJson: string): Promise<boolean> {
    return this.serialized(async () => {
      const existing = await this.requireReady().getFirstAsync<QuarantineRow>(
        `SELECT quarantine_id, reason, evidence_json
         FROM offline_protected_quarantine
         WHERE quarantine_id = ?`,
        [quarantineId],
      );
      return existing !== null
        && existing.reason === 'legacy_membership_unknown'
        && existing.evidence_json === evidenceJson;
    });
  }

  hasProtectedLegacy(): Promise<boolean> {
    return this.serialized(async () => {
      const row = await this.requireReady().getFirstAsync<{ readonly count: number }>(
        'SELECT count(*) AS count FROM offline_protected_quarantine',
      );
      if (row === null || !Number.isSafeInteger(row.count) || row.count < 0) {
        throw new Error('Protected legacy count is invalid');
      }
      return row.count > 0;
    });
  }

  claimLegacyHead(nowMilliseconds: number): Promise<LegacyOfflineQueueHead | null> {
    return this.serialized(async () => {
      const database = this.requireReady();
      if (!Number.isSafeInteger(nowMilliseconds) || nowMilliseconds < 0) {
        throw new TypeError('Invalid legacy scheduler time');
      }
      let head: LegacyOfflineQueueHead | null = null;
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const row = await transaction.getFirstAsync<LegacyQueueRow>(
          `SELECT queue_state, attempt_count, next_attempt_at, submission_json
           FROM offline_legacy_queue
           ORDER BY legacy_order
           LIMIT 1`,
        );
        if (
          row === null
          || row.queue_state === 'protected_review_predecessor'
          || (
            row.queue_state === 'retry_wait'
            && row.next_attempt_at !== null
            && row.next_attempt_at > nowMilliseconds
          )
        ) return;
        const submission = parseLegacySubmission(row.submission_json);
        if (submission === null) {
          this.protectedReason = 'corrupt_row';
          return;
        }
        const claimed = await transaction.runAsync(
          `UPDATE offline_legacy_queue
           SET queue_state = 'in_flight'
           WHERE work_event_id = ?
             AND legacy_order = (
               SELECT min(legacy_order) FROM offline_legacy_queue
             )
             AND queue_state IN ('pending', 'retry_wait', 'in_flight')`,
          [submission.command.workEvent.id],
        );
        if (claimed.changes !== 1) return;
        head = Object.freeze({
          state: 'in_flight',
          attemptCount: row.attempt_count,
          nextAttemptAt: row.next_attempt_at,
          submission,
        });
      });
      if (this.protectedReason !== null) throw new Error('Legacy queue is protected');
      return head;
    });
  }

  retainLegacyHeadForRetry(
    identity: { readonly workEventId: string; readonly receiptId: string },
    attemptCount: number,
    nextAttemptAt: number,
  ): Promise<void> {
    return this.serialized(async () => {
      if (
        !isPositiveSafeInteger(attemptCount)
        || !Number.isSafeInteger(nextAttemptAt)
        || nextAttemptAt < 0
      ) throw new TypeError('Invalid legacy retry metadata');
      const updated = await this.requireReady().runAsync(
        `UPDATE offline_legacy_queue
         SET queue_state = 'retry_wait', attempt_count = ?, next_attempt_at = ?
         WHERE work_event_id = ? AND receipt_id = ?
           AND legacy_order = (
             SELECT min(legacy_order) FROM offline_legacy_queue
           )`,
        [attemptCount, nextAttemptAt, identity.workEventId, identity.receiptId],
      );
      if (updated.changes !== 1) throw new Error('Legacy retry identity mismatch');
    });
  }

  protectLegacyHead(
    identity: { readonly workEventId: string; readonly receiptId: string },
  ): Promise<void> {
    return this.serialized(async () => {
      const updated = await this.requireReady().runAsync(
        `UPDATE offline_legacy_queue
         SET queue_state = 'protected_review_predecessor', next_attempt_at = NULL
         WHERE work_event_id = ? AND receipt_id = ?
           AND legacy_order = (
             SELECT min(legacy_order) FROM offline_legacy_queue
           )`,
        [identity.workEventId, identity.receiptId],
      );
      if (updated.changes !== 1) throw new Error('Legacy protection identity mismatch');
    });
  }

  acknowledgeLegacyHead(
    identity: { readonly workEventId: string; readonly receiptId: string },
  ): Promise<void> {
    return this.serialized(async () => {
      const deleted = await this.requireReady().runAsync(
        `DELETE FROM offline_legacy_queue
         WHERE work_event_id = ? AND receipt_id = ?
           AND legacy_order = (
             SELECT min(legacy_order) FROM offline_legacy_queue
           )`,
        [identity.workEventId, identity.receiptId],
      );
      if (deleted.changes !== 1) throw new Error('Legacy acknowledgement identity mismatch');
    });
  }

  claimHead(nowMilliseconds: number): Promise<OfflineQueueHead | null> {
    return this.serialized(async () => {
      const database = this.requireReady();
      if (!Number.isSafeInteger(nowMilliseconds) || nowMilliseconds < 0) {
        throw new TypeError('Invalid offline scheduler time');
      }
      let head: OfflineQueueHead | null = null;
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const row = await transaction.getFirstAsync<QueueRow>(
          `SELECT queue_state, attempt_count, next_attempt_at, command_json
           FROM offline_event_queue
           ORDER BY device_sequence
           LIMIT 1`,
        );
        if (
          row === null
          || row.queue_state === 'protected_review_predecessor'
          || (
            row.queue_state === 'retry_wait'
            && row.next_attempt_at !== null
            && row.next_attempt_at > nowMilliseconds
          )
        ) {
          return;
        }
        const command = parseOfflineCommand(row.command_json);
        if (command === null) {
          this.protectedReason = 'corrupt_row';
          return;
        }
        const claimed = await transaction.runAsync(
          `UPDATE offline_event_queue
           SET queue_state = 'in_flight'
           WHERE device_sequence = ?
             AND queue_state IN ('pending', 'retry_wait', 'in_flight')`,
          [command.deviceSequence],
        );
        if (claimed.changes !== 1) return;
        head = Object.freeze({
          state: 'in_flight',
          attemptCount: row.attempt_count,
          nextAttemptAt: row.next_attempt_at,
          command,
        });
      });
      if (this.protectedReason !== null) throw new Error('Offline queue is protected');
      return head;
    });
  }

  retainHeadForRetry(
    identity: Pick<OfflineLifecycleEventCommand, 'deviceSequence'> & {
      readonly workEventId: string;
      readonly receiptId: string;
    },
    attemptCount: number,
    nextAttemptAt: number,
  ): Promise<void> {
    return this.serialized(async () => {
      const database = this.requireReady();
      if (
        !isPositiveSafeInteger(attemptCount)
        || !Number.isSafeInteger(nextAttemptAt)
        || nextAttemptAt < 0
      ) {
        throw new TypeError('Invalid offline retry metadata');
      }
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const updated = await transaction.runAsync(
          `UPDATE offline_event_queue
           SET queue_state = 'retry_wait', attempt_count = ?, next_attempt_at = ?
           WHERE device_sequence = ? AND work_event_id = ? AND receipt_id = ?
             AND device_sequence = (
               SELECT min(device_sequence) FROM offline_event_queue
             )`,
          [
            attemptCount,
            nextAttemptAt,
            identity.deviceSequence,
            identity.workEventId,
            identity.receiptId,
          ],
        );
        if (updated.changes !== 1) throw new Error('Offline retry identity mismatch');
      });
    });
  }

  releaseHead(
    identity: {
      readonly deviceSequence: number;
      readonly workEventId: string;
      readonly receiptId: string;
    },
  ): Promise<void> {
    return this.serialized(async () => {
      const updated = await this.requireReady().runAsync(
        `UPDATE offline_event_queue
         SET queue_state = 'pending', next_attempt_at = NULL
         WHERE device_sequence = ? AND work_event_id = ? AND receipt_id = ?
           AND queue_state = 'in_flight'
           AND device_sequence = (
             SELECT min(device_sequence) FROM offline_event_queue
           )`,
        [identity.deviceSequence, identity.workEventId, identity.receiptId],
      );
      if (updated.changes !== 1) throw new Error('Offline release identity mismatch');
    });
  }

  protectHeadForReview(
    identity: {
      readonly deviceSequence: number;
      readonly workEventId: string;
      readonly receiptId: string;
    },
  ): Promise<void> {
    return this.serialized(async () => {
      const updated = await this.requireReady().runAsync(
        `UPDATE offline_event_queue
         SET queue_state = 'protected_review_predecessor', next_attempt_at = NULL
         WHERE device_sequence = ? AND work_event_id = ? AND receipt_id = ?
           AND device_sequence = (
             SELECT min(device_sequence) FROM offline_event_queue
           )`,
        [identity.deviceSequence, identity.workEventId, identity.receiptId],
      );
      if (updated.changes !== 1) throw new Error('Offline review identity mismatch');
    });
  }

  acknowledgeHead(
    identity: {
      readonly deviceSequence: number;
      readonly workEventId: string;
      readonly receiptId: string;
    },
    durableStatus: 'synchronized' | 'review_pending' = 'synchronized',
  ): Promise<void> {
    return this.serialized(async () => {
      const database = this.requireReady();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        if (durableStatus === 'review_pending') {
          const marked = await transaction.runAsync(
            `UPDATE offline_owner
             SET review_pending_sequence = COALESCE(review_pending_sequence, ?)
             WHERE singleton_id = 1
               AND (
                 review_pending_sequence IS NULL
                 OR review_pending_sequence <= ?
               )`,
            [identity.deviceSequence, identity.deviceSequence],
          );
          if (marked.changes !== 1) {
            throw new Error('Offline review acknowledgement sequence mismatch');
          }
        }
        const deleted = await transaction.runAsync(
          `DELETE FROM offline_event_queue
           WHERE device_sequence = ? AND work_event_id = ? AND receipt_id = ?
             AND device_sequence = (
               SELECT min(device_sequence) FROM offline_event_queue
             )`,
          [identity.deviceSequence, identity.workEventId, identity.receiptId],
        );
        if (deleted.changes !== 1) {
          throw new Error('Offline durable acknowledgement identity mismatch');
        }
      });
    });
  }

  readReviewPendingSequence(): Promise<number | null> {
    return this.serialized(async () => {
      const row = await this.requireReady().getFirstAsync<{
        readonly review_pending_sequence: number | null;
      }>(
        `SELECT review_pending_sequence
         FROM offline_owner
         WHERE singleton_id = 1`,
      );
      if (row === null || row.review_pending_sequence === null) return null;
      if (
        !Number.isSafeInteger(row.review_pending_sequence)
        || row.review_pending_sequence <= 0
      ) {
        throw new Error('Offline review acknowledgement sequence is invalid');
      }
      return row.review_pending_sequence;
    });
  }

  clearReviewPendingSequence(
    expectedSequence: number,
    confirmedThroughSequence: number,
  ): Promise<boolean> {
    if (
      !Number.isSafeInteger(expectedSequence)
      || expectedSequence <= 0
      || !Number.isSafeInteger(confirmedThroughSequence)
      || confirmedThroughSequence < expectedSequence
    ) return Promise.resolve(false);
    return this.serialized(async () => {
      const updated = await this.requireReady().runAsync(
        `UPDATE offline_owner
         SET review_pending_sequence = NULL
         WHERE singleton_id = 1
           AND review_pending_sequence = ?
           AND review_pending_sequence <= ?`,
        [expectedSequence, confirmedThroughSequence],
      );
      return updated.changes === 1;
    });
  }

  queueCount(): Promise<number> {
    return this.serialized(async () => {
      const row = await this.requireReady().getFirstAsync<{ readonly count: number }>(
        `SELECT (
           (SELECT count(*) FROM offline_event_queue)
           + (SELECT count(*) FROM offline_legacy_queue)
           + (SELECT count(*) FROM offline_protected_quarantine)
         ) AS count`,
      );
      if (row === null || !Number.isSafeInteger(row.count) || row.count < 0) {
        throw new Error('Offline queue count is invalid');
      }
      return row.count;
    });
  }

  invalidateCapture(): Promise<void> {
    return this.serialized(async () => {
      const database = this.requireReady();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync(
          'UPDATE offline_owner SET capture_invalidated = 1 WHERE singleton_id = 1',
          [],
        );
        await transaction.runAsync(
          `UPDATE offline_lease_generations
           SET generation_state = 'retired'
           WHERE generation_state = 'active'`,
          [],
        );
      });
    });
  }

  close(): Promise<void> {
    return this.serialized(async () => {
      const database = this.connection;
      this.connection = null;
      if (database !== null) await database.closeAsync();
    });
  }

  private async validateDatabaseState(): Promise<OfflineLocalStoreResult> {
    const database = this.requireReady();
    const owner = await database.getFirstAsync<OwnerRow>(
      'SELECT * FROM offline_owner WHERE singleton_id = 1',
    );
    if (
      owner !== null
      && (
        !validOwner({
          organizationId: owner.organization_id,
          userId: owner.user_id,
          membershipId: owner.membership_id,
          installationBindingDigest: owner.installation_binding_digest,
        })
        || !Number.isSafeInteger(owner.next_device_sequence)
        || owner.next_device_sequence < 0
        || (
          owner.review_pending_sequence !== null
          && (
            !Number.isSafeInteger(owner.review_pending_sequence)
            || owner.review_pending_sequence <= 0
            || owner.review_pending_sequence > owner.next_device_sequence
          )
        )
      )
    ) {
      return this.protect('corrupt_row');
    }
    const sequences = await database.getAllAsync<{ readonly device_sequence: number }>(
      'SELECT device_sequence FROM offline_event_queue ORDER BY device_sequence',
    );
    let previous = 0;
    for (const row of sequences) {
      if (
        !Number.isSafeInteger(row.device_sequence)
        || row.device_sequence <= previous
        || (owner !== null && row.device_sequence > owner.next_device_sequence)
      ) {
        return this.protect('impossible_sequence');
      }
      previous = row.device_sequence;
    }
    const legacyRows = await database.getAllAsync<{ readonly submission_json: string }>(
      'SELECT submission_json FROM offline_legacy_queue ORDER BY legacy_order',
    );
    if (legacyRows.some((row) => parseLegacySubmission(row.submission_json) === null)) {
      return this.protect('corrupt_row');
    }
    const quarantineRows = await database.getAllAsync<QuarantineRow>(
      'SELECT quarantine_id, reason, evidence_json FROM offline_protected_quarantine',
    );
    if (quarantineRows.some((row) => (
      !isCanonicalOfflineUuid(row.quarantine_id)
      || row.reason !== 'legacy_membership_unknown'
      || utf8ByteLength(row.evidence_json) < 1
      || utf8ByteLength(row.evidence_json) > OFFLINE_QUEUE_MAXIMUM_EVENT_BYTES
    ))) {
      return this.protect('corrupt_row');
    }
    return { status: 'ready' };
  }

  private requireReady(): OfflineDatabaseConnection {
    if (this.protectedReason !== null || this.connection === null) {
      throw new Error('Offline capture database is not available');
    }
    return this.connection;
  }

  private protect(reason: OfflineProtectedReason): OfflineLocalStoreResult {
    this.protectedReason = reason;
    return { status: 'protected', reason };
  }

  private serialized<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.operationTail.then(operation);
    this.operationTail = result.then(() => undefined, () => undefined);
    return result;
  }
}

async function cipherAndDatabaseIntegrityPass(
  database: OfflineDatabaseConnection,
): Promise<boolean> {
  const cipherRows = await database.getAllAsync<Record<string, unknown>>(
    'PRAGMA cipher_integrity_check',
  );
  if (
    cipherRows.some((row) => {
      const values = Object.values(row);
      return values.length !== 1 || values[0] !== 'ok';
    })
  ) {
    return false;
  }
  const integrity = await database.getFirstAsync<IntegrityRow>('PRAGMA integrity_check');
  return integrity?.integrity_check === 'ok';
}

function validOwner(owner: OfflineDatabaseOwner): boolean {
  return isCanonicalOfflineUuid(owner.organizationId)
    && isCanonicalOfflineUuid(owner.userId)
    && isCanonicalOfflineUuid(owner.membershipId)
    && lowercaseSha256Pattern.test(owner.installationBindingDigest);
}

function sameOwner(row: OwnerRow, owner: OfflineDatabaseOwner): boolean {
  return row.organization_id === owner.organizationId
    && row.user_id === owner.userId
    && row.membership_id === owner.membershipId
    && row.installation_binding_digest === owner.installationBindingDigest;
}

function validLeaseActivation(activation: OfflineLeaseActivation): boolean {
  const { page } = activation;
  const issuedAt = Date.parse(page.issuedAt);
  const expiresAt = Date.parse(page.expiresAt);
  const ids = [
    page.leaseId,
    page.installationId,
    page.identityBindingId,
    page.userId,
    page.organizationId,
    page.membershipId,
  ];
  return ids.every(isCanonicalOfflineUuid)
    && isPositiveSafeInteger(page.membershipRowVersion)
    && (page.role === 'administrator' || page.role === 'employee')
    && isOfflineIsoTimestamp(page.issuedAt)
    && isOfflineIsoTimestamp(page.expiresAt)
    && expiresAt - issuedAt === OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS
    && lowercaseSha256Pattern.test(page.configurationRevision)
    && lowercaseSha256Pattern.test(page.manifestDigest)
    && Number.isSafeInteger(page.itemCount)
    && page.itemCount >= 0
    && Number.isSafeInteger(page.serializedBytes)
    && page.serializedBytes >= 0
    && validBootMarker(activation.activationBootMarker)
    && Number.isSafeInteger(activation.activationMonotonicMilliseconds)
    && activation.activationMonotonicMilliseconds >= 0
    && page.items.every(validLeaseItem);
}

function sameLeaseGeneration(
  existing: LeaseGenerationRow,
  page: OfflineCaptureLeasePage,
): boolean {
  return existing.lease_id === page.leaseId
    && existing.installation_id === page.installationId
    && existing.identity_binding_id === page.identityBindingId
    && existing.organization_id === page.organizationId
    && existing.user_id === page.userId
    && existing.membership_id === page.membershipId
    && existing.membership_row_version === page.membershipRowVersion
    && existing.membership_role === page.role
    && existing.issued_at === page.issuedAt
    && existing.expires_at === page.expiresAt
    && existing.configuration_revision === page.configurationRevision
    && existing.item_count === page.itemCount
    && existing.serialized_bytes === page.serializedBytes
    && existing.manifest_digest === page.manifestDigest;
}

function validActiveCaptureContext(context: ActiveOfflineCaptureContext): boolean {
  return [
    context.organizationId,
    context.userId,
    context.membershipId,
    context.leaseId,
    context.installationId,
    context.identityBindingId,
  ].every(isCanonicalOfflineUuid)
    && (context.role === 'administrator' || context.role === 'employee')
    && isOfflineIsoTimestamp(context.issuedAt)
    && isOfflineIsoTimestamp(context.expiresAt)
    && Date.parse(context.expiresAt) - Date.parse(context.issuedAt)
      === OFFLINE_CAPTURE_LEASE_LIFETIME_MILLISECONDS
    && validBootMarker(context.activationBootMarker)
    && isNonNegativeSafeInteger(context.activationMonotonicMilliseconds);
}

function validLeaseItem(item: OfflineCaptureLeaseItem): boolean {
  return isCanonicalOfflineUuid(item.itemId)
    && lowercaseSha256Pattern.test(item.lookup)
    && isCanonicalOfflineUuid(item.assignmentId)
    && isCanonicalOfflineUuid(item.nfcTagId)
    && item.targetType === 'customer'
    && isCanonicalOfflineUuid(item.targetId)
    && typeof item.displayName === 'string'
    && item.displayName.length > 0;
}

function validBootMarker(value: string): boolean {
  return value.length > 0 && new TextEncoder().encode(value).length <= 256;
}

function manifestMatches(
  items: readonly OfflineCaptureLeaseItem[],
  expectedDigest: string,
): boolean {
  try {
    return mobileManifestDigest(items) === expectedDigest;
  } catch {
    return false;
  }
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function validLegacySubmission(value: unknown): value is LifecycleEventSubmission {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ['command', 'expectedMembershipId', 'mode'])
    || (value.mode !== 'canonical' && value.mode !== 'defer_only')
    || !isCanonicalOfflineUuid(value.expectedMembershipId)
    || !isRecord(value.command)
    || !hasExactKeys(value.command, ['organizationId', 'receipt', 'workEvent'])
    || !isCanonicalOfflineUuid(value.command.organizationId)
    || !isRecord(value.command.workEvent)
    || !hasExactKeys(value.command.workEvent, [
      'assignmentId',
      'id',
      'nfcTagId',
      'occurredAt',
      'target',
    ])
    || ![
      value.command.workEvent.id,
      value.command.workEvent.assignmentId,
      value.command.workEvent.nfcTagId,
    ].every(isCanonicalOfflineUuid)
    || !isOfflineIsoTimestamp(value.command.workEvent.occurredAt)
    || !isRecord(value.command.workEvent.target)
    || !hasExactKeys(value.command.workEvent.target, ['targetId', 'targetType'])
    || value.command.workEvent.target.targetType !== 'customer'
    || !isCanonicalOfflineUuid(value.command.workEvent.target.targetId)
    || !isRecord(value.command.receipt)
    || !hasExactKeys(value.command.receipt, ['attemptNumber', 'id'])
    || value.command.receipt.attemptNumber !== 1
    || !isCanonicalOfflineUuid(value.command.receipt.id)
  ) return false;
  return true;
}

function parseLegacySubmission(serialized: string): LifecycleEventSubmission | null {
  try {
    const value = JSON.parse(serialized) as unknown;
    return validLegacySubmission(value)
      ? Object.freeze(value)
      : null;
  } catch {
    return null;
  }
}

function freezeOfflineCommand(
  command: OfflineLifecycleEventCommand,
): OfflineLifecycleEventCommand {
  return Object.freeze({
    ...command,
    clock: Object.freeze({ ...command.clock }),
    workEvent: Object.freeze({
      ...command.workEvent,
      target: Object.freeze({ ...command.workEvent.target }),
    }),
    receipt: Object.freeze({ ...command.receipt }),
  });
}

function parseOfflineCommand(serialized: string): OfflineLifecycleEventCommand | null {
  try {
    const value = JSON.parse(serialized) as unknown;
    if (!validOfflineCommand(value)) return null;
    return freezeOfflineCommand(value);
  } catch {
    return null;
  }
}

function validOfflineCommand(value: unknown): value is OfflineLifecycleEventCommand {
  if (!isRecord(value) || !hasExactKeys(value, [
    'clock',
    'deviceSequence',
    'expectedMembershipId',
    'installationBinding',
    'leaseId',
    'leaseItemId',
    'organizationId',
    'provenanceVersion',
    'receipt',
    'workEvent',
  ])) return false;
  if (
    ![
      value.organizationId,
      value.expectedMembershipId,
      value.leaseId,
      value.leaseItemId,
    ].every(isCanonicalOfflineUuid)
    || !isOfflineBase64Url32Bytes(value.installationBinding)
    || !isPositiveSafeInteger(value.deviceSequence)
    || value.provenanceVersion !== 1
    || !isRecord(value.clock)
    || !hasExactKeys(value.clock, [
      'bootMarker',
      'clockProofStatus',
      'clockProofVersion',
      'monotonicAnchorMilliseconds',
      'monotonicDeltaMilliseconds',
      'wallClockAnchor',
    ])
    || typeof value.clock.bootMarker !== 'string'
    || !validBootMarker(value.clock.bootMarker)
    || (
      value.clock.clockProofStatus !== 'verified_same_boot'
      && value.clock.clockProofStatus !== 'review_only'
    )
    || value.clock.clockProofVersion !== 1
    || !isNonNegativeSafeInteger(value.clock.monotonicAnchorMilliseconds)
    || !isNonNegativeSafeInteger(value.clock.monotonicDeltaMilliseconds)
    || !isOfflineIsoTimestamp(value.clock.wallClockAnchor)
    || !isRecord(value.workEvent)
    || !hasExactKeys(value.workEvent, [
      'assignmentId',
      'id',
      'nfcTagId',
      'occurredAt',
      'target',
    ])
    || ![
      value.workEvent.id,
      value.workEvent.assignmentId,
      value.workEvent.nfcTagId,
    ].every(isCanonicalOfflineUuid)
    || !isOfflineIsoTimestamp(value.workEvent.occurredAt)
    || !isRecord(value.workEvent.target)
    || !hasExactKeys(value.workEvent.target, ['targetId', 'targetType'])
    || value.workEvent.target.targetType !== 'customer'
    || !isCanonicalOfflineUuid(value.workEvent.target.targetId)
    || !isRecord(value.receipt)
    || !hasExactKeys(value.receipt, ['attemptNumber', 'id'])
    || value.receipt.attemptNumber !== 1
    || !isCanonicalOfflineUuid(value.receipt.id)
  ) {
    return false;
  }
  return true;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

const OFFLINE_SCHEMA_V2 = `
CREATE TABLE offline_owner (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  installation_binding_digest TEXT NOT NULL CHECK (length(installation_binding_digest) = 64),
  installation_id TEXT,
  identity_binding_id TEXT,
  next_device_sequence INTEGER NOT NULL DEFAULT 0 CHECK (next_device_sequence >= 0),
  review_pending_sequence INTEGER CHECK (
    review_pending_sequence IS NULL
    OR (
      review_pending_sequence > 0
      AND review_pending_sequence <= next_device_sequence
    )
  ),
  capture_invalidated INTEGER NOT NULL DEFAULT 0 CHECK (capture_invalidated IN (0, 1))
) STRICT;

CREATE TABLE offline_lease_generations (
  lease_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  identity_binding_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  membership_row_version INTEGER NOT NULL CHECK (membership_row_version > 0),
  membership_role TEXT NOT NULL CHECK (membership_role IN ('administrator', 'employee')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  configuration_revision TEXT NOT NULL CHECK (length(configuration_revision) = 64),
  item_count INTEGER NOT NULL CHECK (item_count BETWEEN 0 AND 4096),
  serialized_bytes INTEGER NOT NULL CHECK (serialized_bytes BETWEEN 0 AND 4194304),
  manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
  activation_boot_marker TEXT NOT NULL CHECK (length(activation_boot_marker) BETWEEN 1 AND 256),
  activation_monotonic_milliseconds INTEGER NOT NULL CHECK (activation_monotonic_milliseconds >= 0),
  generation_state TEXT NOT NULL CHECK (generation_state IN ('assembling', 'active', 'retired'))
) STRICT;

CREATE UNIQUE INDEX one_active_offline_lease
  ON offline_lease_generations (generation_state)
  WHERE generation_state = 'active';

CREATE TABLE offline_lease_items (
  lease_id TEXT NOT NULL REFERENCES offline_lease_generations (lease_id),
  item_id TEXT NOT NULL,
  lookup_value TEXT NOT NULL CHECK (length(lookup_value) = 64),
  assignment_id TEXT NOT NULL,
  nfc_tag_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type = 'customer'),
  target_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  PRIMARY KEY (lease_id, item_id),
  UNIQUE (lease_id, lookup_value)
) STRICT;

CREATE TABLE offline_event_queue (
  device_sequence INTEGER PRIMARY KEY CHECK (device_sequence > 0),
  work_event_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL UNIQUE,
  lease_id TEXT NOT NULL,
  lease_item_id TEXT NOT NULL,
  command_json TEXT NOT NULL,
  serialized_bytes INTEGER NOT NULL CHECK (serialized_bytes BETWEEN 1 AND 4096),
  queue_state TEXT NOT NULL CHECK (
    queue_state IN ('pending', 'in_flight', 'retry_wait', 'protected_review_predecessor')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER,
  FOREIGN KEY (lease_id, lease_item_id)
    REFERENCES offline_lease_items (lease_id, item_id)
) STRICT;

CREATE TABLE offline_legacy_queue (
  legacy_order INTEGER PRIMARY KEY AUTOINCREMENT,
  work_event_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL UNIQUE,
  submission_json TEXT NOT NULL,
  serialized_bytes INTEGER NOT NULL CHECK (serialized_bytes BETWEEN 1 AND 4096),
  queue_state TEXT NOT NULL CHECK (
    queue_state IN ('pending', 'in_flight', 'retry_wait', 'protected_review_predecessor')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at INTEGER
) STRICT;

CREATE TABLE offline_scheduler_metadata (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  last_trigger TEXT,
  last_attempt_at INTEGER
) STRICT;

CREATE TABLE offline_protected_quarantine (
  quarantine_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE TRIGGER offline_lease_item_update_rejected
BEFORE UPDATE ON offline_lease_items
BEGIN
  SELECT RAISE(ABORT, 'offline lease items are immutable');
END;

CREATE TRIGGER offline_lease_item_delete_rejected
BEFORE DELETE ON offline_lease_items
BEGIN
  SELECT RAISE(ABORT, 'offline lease items are immutable');
END;

CREATE TRIGGER offline_lease_generation_immutable_fields
BEFORE UPDATE ON offline_lease_generations
WHEN NEW.lease_id <> OLD.lease_id
  OR NEW.installation_id <> OLD.installation_id
  OR NEW.identity_binding_id <> OLD.identity_binding_id
  OR NEW.organization_id <> OLD.organization_id
  OR NEW.user_id <> OLD.user_id
  OR NEW.membership_id <> OLD.membership_id
  OR NEW.membership_row_version <> OLD.membership_row_version
  OR NEW.membership_role <> OLD.membership_role
  OR NEW.issued_at <> OLD.issued_at
  OR NEW.expires_at <> OLD.expires_at
  OR NEW.configuration_revision <> OLD.configuration_revision
  OR NEW.item_count <> OLD.item_count
  OR NEW.serialized_bytes <> OLD.serialized_bytes
  OR NEW.manifest_digest <> OLD.manifest_digest
  OR NEW.activation_boot_marker <> OLD.activation_boot_marker
  OR NEW.activation_monotonic_milliseconds <> OLD.activation_monotonic_milliseconds
BEGIN
  SELECT RAISE(ABORT, 'offline lease generation is immutable');
END;

CREATE TRIGGER offline_queue_immutable_fields
BEFORE UPDATE ON offline_event_queue
WHEN NEW.device_sequence <> OLD.device_sequence
  OR NEW.work_event_id <> OLD.work_event_id
  OR NEW.receipt_id <> OLD.receipt_id
  OR NEW.lease_id <> OLD.lease_id
  OR NEW.lease_item_id <> OLD.lease_item_id
  OR NEW.command_json <> OLD.command_json
  OR NEW.serialized_bytes <> OLD.serialized_bytes
BEGIN
  SELECT RAISE(ABORT, 'offline queue evidence is immutable');
END;

CREATE TRIGGER offline_legacy_queue_immutable_fields
BEFORE UPDATE ON offline_legacy_queue
WHEN NEW.legacy_order <> OLD.legacy_order
  OR NEW.work_event_id <> OLD.work_event_id
  OR NEW.receipt_id <> OLD.receipt_id
  OR NEW.submission_json <> OLD.submission_json
  OR NEW.serialized_bytes <> OLD.serialized_bytes
BEGIN
  SELECT RAISE(ABORT, 'legacy queue evidence is immutable');
END;

CREATE TRIGGER offline_protected_quarantine_update_rejected
BEFORE UPDATE ON offline_protected_quarantine
BEGIN
  SELECT RAISE(ABORT, 'protected evidence is immutable');
END;

CREATE TRIGGER offline_protected_quarantine_delete_rejected
BEFORE DELETE ON offline_protected_quarantine
BEGIN
  SELECT RAISE(ABORT, 'protected evidence cannot be deleted automatically');
END;
`;

const OFFLINE_SCHEMA_V1_TO_V2 = `
ALTER TABLE offline_owner
ADD COLUMN review_pending_sequence INTEGER CHECK (
  review_pending_sequence IS NULL
  OR (
    review_pending_sequence > 0
    AND review_pending_sequence <= next_device_sequence
  )
);
`;
