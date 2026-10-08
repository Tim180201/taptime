import type { MobileSessionState } from '../auth/contracts';
import type { ProductScanState } from '../scan/contracts';

export const OFFLINE_PRODUCT_DESTINATIONS = Object.freeze([
  'capture',
] as const);

export function canPresentOfflineCaptureShell(
  session: MobileSessionState,
  scan: ProductScanState,
): boolean {
  if (session.status !== 'context_unavailable' || session.organizationPaused || session.updateRequired) return false;
  return scan.status === 'offline_ready'
    || scan.status === 'saved_locally'
    || scan.status === 'scanning'
    || scan.status === 'synchronizing'
    || scan.status === 'server_review_pending'
    || scan.status === 'server_decision';
}

/** P01 includes integrity failures; only an explicit native read/write cause is retryable. */
export function isRecoverableIdentityProtection(scan: ProductScanState): boolean {
  return scan.identityRecovery === 'secure_store' && scan.protection?.[0] === 'P01'
    && (scan.status === 'secure_storage_unavailable'
      || scan.status === 'protected_pending' && scan.reason === 'local_evidence_protected');
}
