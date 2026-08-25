import { createHash } from 'node:crypto';
import {
  encodeOfflineLeaseManifest,
  encodeOfflineLeaseManifestV2,
  encodeOfflineLeaseManifestV3,
  type OfflineCaptureLeaseItem,
  type OfflineCaptureLeaseItemV2,
  type OfflineCaptureLeaseItemV3,
} from '@taptime/offline-sync-contract';

export function offlineManifestDigest(items: readonly OfflineCaptureLeaseItem[]): string {
  return createHash('sha256').update(encodeOfflineLeaseManifest(items)).digest('hex');
}

export function offlineManifestDigestV2(items: readonly OfflineCaptureLeaseItemV2[]): string {
  return createHash('sha256').update(encodeOfflineLeaseManifestV2(items)).digest('hex');
}

export function offlineManifestDigestV3(items: readonly OfflineCaptureLeaseItemV3[]): string {
  return createHash('sha256').update(encodeOfflineLeaseManifestV3(items)).digest('hex');
}
