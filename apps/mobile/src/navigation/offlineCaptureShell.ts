import type { MobileSessionState } from '../auth/contracts';
import type { ProductScanState } from '../scan/contracts';

export function canPresentOfflineCaptureShell(
  session: MobileSessionState,
  scan: ProductScanState,
): boolean {
  if (session.status !== 'context_unavailable') return false;
  return scan.status === 'offline_ready'
    || scan.status === 'saved_locally'
    || scan.status === 'scanning'
    || scan.status === 'synchronizing'
    || scan.status === 'server_review_pending'
    || scan.status === 'server_decision';
}
