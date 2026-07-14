import type { OrganizationId, UserId } from '@taptime/core';
import type {
  LifecycleEventCommand,
  LifecycleEventSubmission,
} from '../transport/contracts';
import type { PendingLifecycleBinding } from './contracts';

export interface PendingLifecycleEvidence {
  readonly kind: 'replayable';
  readonly binding: PendingLifecycleBinding;
  readonly submission: LifecycleEventSubmission;
}

/** E1 v1 evidence has no Membership provenance and therefore can never be replayed implicitly. */
export interface ProtectedLegacyLifecycleEvidence {
  readonly kind: 'protected_v1';
  readonly binding: {
    readonly organizationId: OrganizationId;
    readonly userId: UserId;
  };
  readonly command: LifecycleEventCommand;
}

export type StoredLifecycleEvidence = PendingLifecycleEvidence | ProtectedLegacyLifecycleEvidence;

/**
 * Durable single-record outbox for the product scan path.
 *
 * The current product interaction deliberately blocks a second scan while lifecycle evidence is
 * unresolved. The port therefore models exactly one immutable record rather than pretending that
 * the product already supports a multi-event offline queue.
 */
export interface LifecycleEvidenceOutbox {
  read(): Promise<StoredLifecycleEvidence | null>;
  write(evidence: PendingLifecycleEvidence): Promise<void>;
  clear(evidence: PendingLifecycleEvidence): Promise<void>;
}
