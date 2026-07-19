import type { OfflineCaptureLeaseItem } from './types.js';

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
