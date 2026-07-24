import { createHash } from 'node:crypto';
import {
  encodeOfflineLeaseManifest,
  encodeOfflineLeaseManifestV2,
  type OfflineCaptureLeaseItem,
  type OfflineCaptureLeaseItemV2,
} from '@taptime/offline-sync-contract';

export function offlineManifestDigest(items: readonly OfflineCaptureLeaseItem[]): string {
  return createHash('sha256').update(encodeOfflineLeaseManifest(items)).digest('hex');
}

export function offlineManifestDigestV2(items: readonly OfflineCaptureLeaseItemV2[]): string {
  return createHash('sha256').update(encodeOfflineLeaseManifestV2(items)).digest('hex');
}
