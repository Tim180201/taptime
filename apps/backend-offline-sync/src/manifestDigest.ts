import { createHash } from 'node:crypto';
import {
  encodeOfflineLeaseManifest,
  type OfflineCaptureLeaseItem,
} from '@taptime/offline-sync-contract';

export function offlineManifestDigest(items: readonly OfflineCaptureLeaseItem[]): string {
  return createHash('sha256').update(encodeOfflineLeaseManifest(items)).digest('hex');
}
