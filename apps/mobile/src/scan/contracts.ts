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
  | { readonly status: 'break_started' }
  | { readonly status: 'break_stopped' }
  | { readonly status: 'duplicate_scan_ignored' }
  | { readonly status: 'active_entry_for_other_target_rejected' }
  | { readonly status: 'break_without_active_time_entry_rejected' }
  | { readonly status: 'work_trigger_during_break_rejected' }
  | { readonly status: 'escalation_required' }
  | { readonly status: 'server_review_pending' }
  | { readonly status: 'session_rejected' }
  | { readonly status: 'queue_full' };

export const PRODUCT_SCAN_PROTECTION_CLASS = Object.freeze({
  secureIdentity: 'P01',
  databaseInitialization: 'P02',
  databaseIntegrity: 'P03',
  databaseMigration: 'P04',
  legacyImport: 'P05',
  ownerBinding: 'P06',
  leaseCompleteness: 'P07',
  leaseActivation: 'P08',
  schedulerDurableState: 'P09',
} as const);

export type ProductScanProtectionClass =
  (typeof PRODUCT_SCAN_PROTECTION_CLASS)[keyof typeof PRODUCT_SCAN_PROTECTION_CLASS];

/**
 * One closed pre-scan protection origin. The tuple makes the production writer prove that it
 * resolved exactly one class; Synthetic readers still validate the runtime shape fail-closed.
 */
export type ProductScanProtectionClassification = readonly [ProductScanProtectionClass];

type ProductScanStateValue =
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

export type ProductScanState = ProductScanStateValue & {
  readonly protection?: ProductScanProtectionClassification;
};

const SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX =
  'com.tim180201.mobile.synthetic:id/scan-status-';

const SYNTHETIC_SCAN_STATUS_TEST_IDS: Readonly<Record<
  ProductScanProtectionClass,
  string
>> = Object.freeze({
  P01: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p01`,
  P02: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p02`,
  P03: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p03`,
  P04: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p04`,
  P05: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p05`,
  P06: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p06`,
  P07: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p07`,
  P08: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p08`,
  P09: `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}p09`,
});

const productScanProtectionClasses = new Set<ProductScanProtectionClass>(
  Object.values(PRODUCT_SCAN_PROTECTION_CLASS),
);

export function scanStatusTestId(
  state: ProductScanState,
  runtimeVariant: string | undefined,
): string {
  if (runtimeVariant !== 'synthetic-e2e') return 'scan-status';
  const protection = state.protection as readonly unknown[] | undefined;
  if (protection !== undefined) {
    if (
      protection.length !== 1
      || !productScanProtectionClasses.has(protection[0] as ProductScanProtectionClass)
    ) return `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}other`;
    return SYNTHETIC_SCAN_STATUS_TEST_IDS[protection[0] as ProductScanProtectionClass];
  }
  if (state.status === 'ready' && state.outcome === null) {
    return `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}ready`;
  }
  if (state.status === 'unavailable' || state.status === 'secure_storage_unavailable') {
    return `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}unavailable`;
  }
  return `${SYNTHETIC_SCAN_STATUS_RESOURCE_PREFIX}other`;
}

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
