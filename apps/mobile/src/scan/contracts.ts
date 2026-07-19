import type { MembershipId, OrganizationId, UserId } from '@taptime/core';
import type { InternalAuthenticatedSessionSnapshot } from '../auth/contracts';

export type ProductScanSessionSnapshot = InternalAuthenticatedSessionSnapshot;

/** Private runtime authority; it is never included in the React-facing session capability. */
export interface ProductScanSessionContextReader {
  capture(): ProductScanSessionSnapshot | null;
  isCurrent(snapshot: ProductScanSessionSnapshot): boolean;
  subscribe(listener: () => void): () => void;
}

export type ProductScanOutcome =
  | { readonly status: 'unreadable' }
  | { readonly status: 'timed_out' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'nfc_unavailable' }
  | { readonly status: 'tag_not_assigned' }
  | { readonly status: 'scan_context_unavailable' }
  | { readonly status: 'time_entry_started' }
  | { readonly status: 'time_entry_stopped' }
  | { readonly status: 'duplicate_scan_ignored' }
  | { readonly status: 'active_entry_for_other_target_rejected' }
  | { readonly status: 'escalation_required' }
  | { readonly status: 'server_review_pending' }
  | { readonly status: 'session_rejected' }
  | { readonly status: 'queue_full' };

export type ProductScanState =
  | { readonly status: 'inactive' }
  | { readonly status: 'checking' }
  | { readonly status: 'not_supported' }
  | { readonly status: 'disabled' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'ready'; readonly outcome: ProductScanOutcome | null }
  | {
      readonly status: 'offline_ready';
      readonly queueCount: number;
      readonly outcome: ProductScanOutcome | null;
    }
  | { readonly status: 'saved_locally'; readonly queueCount: number }
  | { readonly status: 'synchronizing'; readonly queueCount: number }
  | { readonly status: 'server_review_pending'; readonly queueCount: number }
  | {
      readonly status: 'server_decision';
      readonly outcome: ProductScanOutcome;
      readonly queueCount: number;
    }
  | { readonly status: 'scanning' }
  | { readonly status: 'submitting'; readonly phase: 'scan_context' | 'lifecycle' }
  | { readonly status: 'retry_pending' }
  /** Durable evidence cannot be loaded or updated safely; new scans are fail-closed. */
  | { readonly status: 'secure_storage_unavailable' }
  /** Pending evidence cannot be replayed under the current exact Membership context. */
  | {
      readonly status: 'protected_pending';
      readonly reason:
        | 'identity_mismatch'
        | 'legacy_membership_unknown'
        | 'local_evidence_protected';
    };

export interface ProductScanCapability {
  getState(): ProductScanState;
  subscribe(listener: () => void): () => void;
  scan(): Promise<void>;
  cancel(): Promise<void>;
  retry(): Promise<void>;
}

export interface PendingLifecycleBinding {
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly membershipId: MembershipId;
}

export type SecureUuidGenerator = () => string;
