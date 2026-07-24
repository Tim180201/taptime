import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import {
  OFFLINE_LOOKUP_KEY_BYTES,
  encodeOfflineLeaseManifest,
  encodeOfflineLeaseManifestV2,
  type OfflineCaptureLeaseItem,
  type OfflineCaptureLeaseItemV2,
} from '@taptime/offline-sync-contract';

export function mobileLookupHmac(key: Uint8Array, canonicalPayload: string): string {
  if (key.length !== OFFLINE_LOOKUP_KEY_BYTES || canonicalPayload.length === 0) {
    throw new TypeError('Invalid Mobile offline lookup input');
  }
  return mobileHmacSha256Hex(key, canonicalPayload);
}

export function mobileHmacSha256Hex(key: Uint8Array, message: string): string {
  if (key.length === 0) throw new TypeError('Mobile HMAC key must not be empty');
  return bytesToHex(hmac(sha256, key, utf8ToBytes(message)));
}

export function mobileManifestDigest(items: readonly OfflineCaptureLeaseItem[]): string {
  return bytesToHex(sha256(encodeOfflineLeaseManifest(items)));
}

export function mobileManifestDigestV2(items: readonly OfflineCaptureLeaseItemV2[]): string {
  return bytesToHex(sha256(encodeOfflineLeaseManifestV2(items)));
}

export function mobileSha256Hex(value: Uint8Array): string {
  return bytesToHex(sha256(value));
}
