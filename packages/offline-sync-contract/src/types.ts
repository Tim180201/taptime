export type OfflineMembershipRole = 'administrator' | 'employee';
export type OfflineTargetType = 'customer';

export interface OfflineCaptureLeaseItem {
  readonly itemId: string;
  readonly lookup: string;
  readonly assignmentId: string;
  readonly nfcTagId: string;
  readonly targetType: OfflineTargetType;
  readonly targetId: string;
  readonly displayName: string;
}

export interface OfflineCaptureLeaseHeader {
  readonly leaseId: string;
  readonly installationId: string;
  readonly identityBindingId: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly membershipRowVersion: number;
  readonly role: OfflineMembershipRole;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly configurationRevision: string;
  readonly itemCount: number;
  readonly serializedBytes: number;
  readonly manifestDigest: string;
}

export interface OfflineCaptureLeasePage extends OfflineCaptureLeaseHeader {
  readonly items: readonly OfflineCaptureLeaseItem[];
  readonly nextCursor: string | null;
}

export interface OfflineCaptureLeaseIssueCommand {
  readonly commandId: string;
  readonly installationBinding: string;
  readonly lookupKey: string;
}

export interface OfflineCaptureLeasePageCommand {
  readonly leaseId: string;
  readonly cursor: string;
  readonly limit: number;
}

export type OfflineCaptureLeaseResult =
  | { readonly status: 'ready'; readonly page: OfflineCaptureLeasePage; readonly idempotentRetry: boolean }
  | { readonly status: 'incomplete_or_oversize' }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'unavailable' };

export type OfflineLocalStoreResult =
  | { readonly status: 'ready' }
  | { readonly status: 'full' }
  | { readonly status: 'protected'; readonly reason: OfflineProtectedReason }
  | { readonly status: 'migration_failed' }
  | { readonly status: 'unavailable' };

export type OfflineProtectedReason =
  | 'cipher_integrity_failed'
  | 'corrupt_row'
  | 'identity_mismatch'
  | 'impossible_sequence'
  | 'legacy_clear_ambiguous'
  | 'missing_key'
  | 'review_predecessor'
  | 'unknown_schema'
  | 'wrong_key';

export type OfflineQueueState =
  | 'pending'
  | 'in_flight'
  | 'retry_wait'
  | 'protected_review_predecessor';

export interface OfflineLifecycleWorkEvent {
  readonly id: string;
  readonly assignmentId: string;
  readonly nfcTagId: string;
  readonly target: {
    readonly targetType: OfflineTargetType;
    readonly targetId: string;
  };
  readonly occurredAt: string;
}

export interface OfflineLifecycleReceipt {
  readonly id: string;
  readonly attemptNumber: number;
}

export interface OfflineClockProof {
  readonly bootMarker: string;
  readonly monotonicAnchorMilliseconds: number;
  readonly monotonicDeltaMilliseconds: number;
  readonly wallClockAnchor: string;
  readonly clockProofStatus: 'verified_same_boot' | 'review_only';
  readonly clockProofVersion: 1;
}

export interface OfflineLifecycleEventCommand {
  readonly organizationId: string;
  readonly expectedMembershipId: string;
  readonly leaseId: string;
  readonly leaseItemId: string;
  readonly installationBinding: string;
  readonly deviceSequence: number;
  readonly provenanceVersion: 1;
  readonly clock: OfflineClockProof;
  readonly workEvent: OfflineLifecycleWorkEvent;
  readonly receipt: OfflineLifecycleReceipt;
}

export type OfflineReviewReason =
  | 'identity_or_membership_not_current'
  | 'capture_time_out_of_bounds'
  | 'automatic_window_elapsed'
  | 'historical_configuration_not_valid'
  | 'predecessor_requires_review';

export type OfflinePendingReason =
  | 'sequence_gap'
  | 'lock_retry'
  | 'temporarily_unavailable';

export type OfflineConflictReason =
  | 'event_content_conflict'
  | 'sequence_content_conflict'
  | 'lease_binding_conflict'
  | 'receipt_metadata_conflict';

export type OfflineCanonicalDecision =
  | { readonly status: 'time_entry_started' | 'time_entry_stopped'; readonly timeEntryId: string }
  | { readonly status: 'duplicate_scan_ignored'; readonly previousWorkEventId: string }
  | { readonly status: 'active_entry_for_other_target_rejected'; readonly activeTimeEntryId: string }
  | { readonly status: 'escalation_required'; readonly reason: string };

export interface OfflineDurableResultIdentity {
  readonly workEventId: string;
  readonly receiptId: string;
  readonly deviceSequence: number;
}

export type OfflineLifecycleEventResult =
  | (OfflineDurableResultIdentity & {
      readonly status: 'synchronized';
      readonly idempotentRetry: boolean;
      readonly decision: OfflineCanonicalDecision;
    })
  | (OfflineDurableResultIdentity & {
      readonly status: 'review_pending';
      readonly idempotentRetry: boolean;
      readonly reason: OfflineReviewReason;
    })
  | {
      readonly status: 'pending';
      readonly reason: OfflinePendingReason;
      readonly retryAfterSeconds?: number;
    }
  | { readonly status: 'conflict'; readonly reason: OfflineConflictReason }
  | { readonly status: 'authority_rejected' };

export interface OfflineReconciliationCommand {
  readonly workEventIds: readonly string[];
}

export interface OfflineReconciliationRecord extends OfflineDurableResultIdentity {
  readonly result:
    | {
        readonly status: 'synchronized';
        readonly decision: OfflineCanonicalDecision;
      }
    | {
        readonly status: 'review_pending';
        readonly reason: OfflineReviewReason;
      };
}

export type OfflineReconciliationResult =
  | { readonly status: 'ready'; readonly records: readonly OfflineReconciliationRecord[] }
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'unavailable' };

export type OfflineUiState =
  | { readonly status: 'offline_ready'; readonly queueCount: number }
  | { readonly status: 'saved_locally'; readonly queueCount: number }
  | { readonly status: 'synchronizing'; readonly queueCount: number }
  | { readonly status: 'server_review_pending'; readonly queueCount: number }
  | { readonly status: 'server_decision'; readonly decision: OfflineCanonicalDecision; readonly queueCount: number }
  | { readonly status: 'protected'; readonly queueCount: number };
