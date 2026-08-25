import { createHash } from 'node:crypto';
import type { NfcWorkEvent } from '@taptime/core';

export const B1_CONTENT_HASH_VERSION = 1;
export const B1_CONTENT_HASH_ALGORITHM = 'sha256';

export function canonicalWorkEventContent(workEvent: NfcWorkEvent): string {
  return JSON.stringify([
    workEvent.id,
    workEvent.organizationId,
    workEvent.assignmentId,
    workEvent.nfcTagId,
    workEvent.target.targetType,
    workEvent.target.targetId,
    workEvent.triggeredBy,
    new Date(workEvent.occurredAt).toISOString(),
  ]);
}

export function workEventContentHash(workEvent: NfcWorkEvent): string {
  return createHash(B1_CONTENT_HASH_ALGORITHM)
    .update(canonicalWorkEventContent(workEvent), 'utf8')
    .digest('hex');
}
