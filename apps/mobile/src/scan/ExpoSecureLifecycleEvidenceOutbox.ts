import * as SecureStore from 'expo-secure-store';
import {
  CustomerId,
  MembershipId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  UserId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
} from '@taptime/core';
import type { LifecycleEventCommand } from '../transport/contracts';
import {
  hasExactKeys,
  isIso8601Timestamp,
  isObject,
  isUuid,
  parseJsonObject,
  utf8ByteLength,
} from '../transport/strictJson';
import type {
  LifecycleEvidenceOutbox,
  PendingLifecycleEvidence,
  ProtectedLegacyLifecycleEvidence,
  StoredLifecycleEvidence,
} from './LifecycleEvidenceOutbox';

export const LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY = 'taptime.lifecycle-evidence-outbox.v1';

const MAXIMUM_SERIALIZED_EVIDENCE_BYTES = 2_048;
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  // iOS Keychain accessibility. Android ignores this field and instead uses its Keystore-backed
  // encrypted SharedPreferences implementation supplied by expo-secure-store.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
let nativeOutboxOperationTail: Promise<void> = Promise.resolve();

export class ExpoSecureLifecycleEvidenceOutbox implements LifecycleEvidenceOutbox {
  read(): Promise<StoredLifecycleEvidence | null> {
    return runSerializedNativeOutboxOperation(async () => {
      await assertSecureStoreAvailable();
      const serialized = await SecureStore.getItemAsync(
        LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
        secureStoreOptions,
      );
      if (serialized === null) {
        return null;
      }
      if (utf8ByteLength(serialized) > MAXIMUM_SERIALIZED_EVIDENCE_BYTES) {
        throw new Error('Stored lifecycle evidence exceeds the permitted size');
      }
      const evidence = parseStoredEvidence(serialized);
      if (evidence === null) {
        throw new Error('Stored lifecycle evidence is invalid');
      }
      return evidence;
    });
  }

  write(evidence: PendingLifecycleEvidence): Promise<void> {
    return runSerializedNativeOutboxOperation(async () => {
      await assertSecureStoreAvailable();
      const existing = await SecureStore.getItemAsync(
        LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
        secureStoreOptions,
      );
      if (existing !== null) {
        throw new Error('Lifecycle evidence outbox is already occupied');
      }
      const serialized = serializeEvidence(evidence);
      if (utf8ByteLength(serialized) > MAXIMUM_SERIALIZED_EVIDENCE_BYTES) {
        throw new Error('Lifecycle evidence exceeds the permitted size');
      }
      // Reparse before persistence so an invalid infrastructure caller can never poison recovery.
      if (parseStoredEvidence(serialized) === null) {
        throw new TypeError('Lifecycle evidence is invalid');
      }
      await SecureStore.setItemAsync(
        LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
        serialized,
        secureStoreOptions,
      );
    });
  }

  clear(evidence: PendingLifecycleEvidence): Promise<void> {
    return runSerializedNativeOutboxOperation(async () => {
      await assertSecureStoreAvailable();
      const existing = await SecureStore.getItemAsync(
        LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
        secureStoreOptions,
      );
      if (existing === null) {
        return;
      }
      const parsed = parseStoredEvidence(existing);
      if (
        parsed === null
        || parsed.kind !== 'replayable'
        || serializeEvidence(parsed) !== serializeEvidence(evidence)
      ) {
        throw new Error('Lifecycle evidence outbox contains a different record');
      }
      await SecureStore.deleteItemAsync(
        LIFECYCLE_EVIDENCE_OUTBOX_STORAGE_KEY,
        secureStoreOptions,
      );
    });
  }
}

/** Serializes composite native operations across all adapter instances in this JavaScript runtime. */
function runSerializedNativeOutboxOperation<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  const result = nativeOutboxOperationTail.then(operation);
  nativeOutboxOperationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function serializeEvidence(evidence: PendingLifecycleEvidence): string {
  return JSON.stringify({
    version: 2,
    binding: evidence.binding,
    submission: evidence.submission,
  });
}

async function assertSecureStoreAvailable(): Promise<void> {
  if (!await SecureStore.isAvailableAsync()) {
    throw new Error('Secure lifecycle evidence storage is unavailable');
  }
}

function parseStoredEvidence(serialized: string): StoredLifecycleEvidence | null {
  const root = parseJsonObject(serialized);
  if (root === null || !hasExactKeys(root, ['version', 'binding', root.version === 1
    ? 'command'
    : 'submission'])) {
    return null;
  }
  if (root.version === 1) {
    return parseProtectedVersionOneEvidence(root);
  }
  if (root.version !== 2) {
    return null;
  }
  if (
    !isObject(root.binding)
    || !hasExactKeys(root.binding, ['membershipId', 'organizationId', 'userId'])
    || !isUuid(root.binding.membershipId)
    || !isUuid(root.binding.organizationId)
    || !isUuid(root.binding.userId)
    || !isObject(root.submission)
    || !hasExactKeys(root.submission, ['command', 'expectedMembershipId', 'mode'])
    || (root.submission.mode !== 'canonical' && root.submission.mode !== 'defer_only')
    || !isUuid(root.submission.expectedMembershipId)
    || root.submission.expectedMembershipId !== root.binding.membershipId
  ) {
    return null;
  }
  const command = parseCommand(root.submission.command);
  if (command === null || command.organizationId !== root.binding.organizationId) {
    return null;
  }
  return Object.freeze({
    kind: 'replayable' as const,
    binding: Object.freeze({
      membershipId: MembershipId(root.binding.membershipId),
      organizationId: OrganizationId(root.binding.organizationId),
      userId: UserId(root.binding.userId),
    }),
    submission: Object.freeze({
      mode: root.submission.mode,
      expectedMembershipId: MembershipId(root.submission.expectedMembershipId),
      command,
    }),
  });
}

function parseProtectedVersionOneEvidence(
  root: Record<string, unknown>,
): ProtectedLegacyLifecycleEvidence | null {
  if (
    !isObject(root.binding)
    || !hasExactKeys(root.binding, ['organizationId', 'userId'])
    || !isUuid(root.binding.organizationId)
    || !isUuid(root.binding.userId)
  ) {
    return null;
  }
  const command = parseCommand(root.command);
  if (command === null || command.organizationId !== root.binding.organizationId) {
    return null;
  }
  return Object.freeze({
    kind: 'protected_v1' as const,
    binding: Object.freeze({
      organizationId: OrganizationId(root.binding.organizationId),
      userId: UserId(root.binding.userId),
    }),
    command,
  });
}

function parseCommand(value: unknown): LifecycleEventCommand | null {
  if (
    !isObject(value)
    || !hasExactKeys(value, ['organizationId', 'receipt', 'workEvent'])
    || !isUuid(value.organizationId)
    || !isObject(value.workEvent)
    || !hasExactKeys(value.workEvent, [
      'assignmentId',
      'id',
      'nfcTagId',
      'occurredAt',
      'target',
    ])
    || !isUuid(value.workEvent.id)
    || !isUuid(value.workEvent.assignmentId)
    || !isUuid(value.workEvent.nfcTagId)
    || !isIso8601Timestamp(value.workEvent.occurredAt)
    || !isObject(value.workEvent.target)
    || !hasExactKeys(value.workEvent.target, ['targetId', 'targetType'])
    || value.workEvent.target.targetType !== 'customer'
    || !isUuid(value.workEvent.target.targetId)
    || !isObject(value.receipt)
    || !hasAllowedReceiptKeys(value.receipt)
    || !isUuid(value.receipt.id)
    || value.receipt.attemptNumber !== 1
    || (
      value.receipt.clientTimeEntryId !== undefined
      && !isUuid(value.receipt.clientTimeEntryId)
    )
  ) {
    return null;
  }
  return Object.freeze({
    organizationId: OrganizationId(value.organizationId),
    workEvent: Object.freeze({
      id: WorkEventId(value.workEvent.id),
      assignmentId: NfcAssignmentId(value.workEvent.assignmentId),
      nfcTagId: NfcTagId(value.workEvent.nfcTagId),
      target: Object.freeze(customerAssignmentTarget(CustomerId(value.workEvent.target.targetId))),
      occurredAt: createTimestamp(value.workEvent.occurredAt),
    }),
    receipt: Object.freeze({
      id: value.receipt.id,
      attemptNumber: 1,
      ...(value.receipt.clientTimeEntryId === undefined
        ? {}
        : { clientTimeEntryId: TimeEntryId(value.receipt.clientTimeEntryId) }),
    }),
  });
}

function hasAllowedReceiptKeys(value: Record<string, unknown>): boolean {
  return hasExactKeys(value, ['attemptNumber', 'id'])
    || hasExactKeys(value, ['attemptNumber', 'clientTimeEntryId', 'id']);
}
