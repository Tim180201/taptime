import type { LifecycleEventCommand } from '../transport/contracts';
import type { PendingLifecycleBinding } from './contracts';

export interface PendingLifecycleEvidence {
  readonly binding: PendingLifecycleBinding;
  readonly command: LifecycleEventCommand;
}

/**
 * Durable single-record outbox for the product scan path.
 *
 * The current product interaction deliberately blocks a second scan while lifecycle evidence is
 * unresolved. The port therefore models exactly one immutable record rather than pretending that
 * the product already supports a multi-event offline queue.
 */
export interface LifecycleEvidenceOutbox {
  read(): Promise<PendingLifecycleEvidence | null>;
  write(evidence: PendingLifecycleEvidence): Promise<void>;
  clear(evidence: PendingLifecycleEvidence): Promise<void>;
}
