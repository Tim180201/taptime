import type {
  OfflineCaptureLeaseItem,
  OfflineCaptureLeaseItemV2,
} from './types.js';

const textEncoder = new TextEncoder();

export function encodeOfflineLeaseManifest(
  items: readonly OfflineCaptureLeaseItem[],
): Uint8Array {
  assertLexicographicallyOrderedItems(items);
  const fields = items.flatMap((item) => [
    item.itemId,
    item.lookup,
    item.assignmentId,
    item.nfcTagId,
    item.targetType,
    item.targetId,
    item.displayName,
  ]);
  return encodeLengthFramedUtf8(fields);
}

export function encodeOfflineLeaseManifestV2(
  items: readonly OfflineCaptureLeaseItemV2[],
): Uint8Array {
  assertLexicographicallyOrderedItemsV2(items);
  return encodeLengthFramedUtf8(items.flatMap((item) => (
    item.itemType === 'nfc_assignment'
      ? [
          item.itemType,
          item.itemId,
          item.lookup,
          item.assignmentId,
          item.nfcTagId,
          item.targetType,
          item.targetId,
          item.displayName,
          String(item.assignmentRowVersion),
          String(item.targetRowVersion),
        ]
      : [
          item.itemType,
          item.itemId,
          item.targetType,
          item.targetId,
          item.displayName,
          String(item.targetRowVersion),
        ]
  )));
}

export function encodeLengthFramedUtf8(fields: readonly string[]): Uint8Array {
  const encodedFields = fields.map((field) => textEncoder.encode(field));
  const totalBytes = encodedFields.reduce((total, field) => total + 4 + field.byteLength, 0);
  const result = new Uint8Array(totalBytes);
  const view = new DataView(result.buffer);
  let offset = 0;
  for (const field of encodedFields) {
    view.setUint32(offset, field.byteLength, false);
    offset += 4;
    result.set(field, offset);
    offset += field.byteLength;
  }
  return result;
}

function assertLexicographicallyOrderedItemsV2(
  items: readonly OfflineCaptureLeaseItemV2[],
): void {
  let previous: string | null = null;
  const itemIds = new Set<string>();
  const lookups = new Set<string>();
  const manualTargets = new Set<string>();
  for (const item of items) {
    if (previous !== null && compareAscii(item.itemId, previous) <= 0) {
      throw new TypeError('Offline v2 lease items must be strictly ASCII-ordered by itemId');
    }
    if (itemIds.has(item.itemId)) {
      throw new TypeError('Offline v2 lease manifest contains a duplicate item');
    }
    if (!Number.isSafeInteger(item.targetRowVersion) || item.targetRowVersion <= 0) {
      throw new TypeError('Offline v2 target row version must be a positive safe integer');
    }
    if (item.itemType === 'nfc_assignment') {
      if (lookups.has(item.lookup)) {
        throw new TypeError('Offline v2 lease manifest contains a duplicate NFC lookup');
      }
      if (!Number.isSafeInteger(item.assignmentRowVersion)
        || item.assignmentRowVersion <= 0) {
        throw new TypeError('Offline v2 Assignment row version must be positive');
      }
      lookups.add(item.lookup);
    } else {
      const key = `${item.targetType}\u001f${item.targetId}`;
      if (manualTargets.has(key)) {
        throw new TypeError('Offline v2 lease manifest contains a duplicate manual target');
      }
      manualTargets.add(key);
    }
    previous = item.itemId;
    itemIds.add(item.itemId);
  }
}

function compareAscii(left: string, right: string): number {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function assertLexicographicallyOrderedItems(items: readonly OfflineCaptureLeaseItem[]): void {
  let previous: string | null = null;
  const lookups = new Set<string>();
  const itemIds = new Set<string>();
  for (const item of items) {
    if (previous !== null && item.itemId.localeCompare(previous, 'en') <= 0) {
      throw new TypeError('Offline lease items must be strictly ordered by itemId');
    }
    if (itemIds.has(item.itemId) || lookups.has(item.lookup)) {
      throw new TypeError('Offline lease manifest contains a duplicate item or lookup');
    }
    previous = item.itemId;
    itemIds.add(item.itemId);
    lookups.add(item.lookup);
  }
}
