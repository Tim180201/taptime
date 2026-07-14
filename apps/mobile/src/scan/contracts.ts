import type { OrganizationId, UserId } from '@taptime/core';
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
  | { readonly status: 'deferred' }
  | { readonly status: 'conflict' }
  | { readonly status: 'session_rejected' };

export type ProductScanState =
  | { readonly status: 'inactive' }
  | { readonly status: 'checking' }
  | { readonly status: 'not_supported' }
  | { readonly status: 'disabled' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'ready'; readonly outcome: ProductScanOutcome | null }
  | { readonly status: 'scanning' }
  | { readonly status: 'submitting'; readonly phase: 'scan_context' | 'lifecycle' }
  | { readonly status: 'retry_pending' }
  /** Pending evidence exists, but belongs to another authenticated identity. */
  | { readonly status: 'protected_pending' };

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
}

export type SecureUuidGenerator = () => string;
