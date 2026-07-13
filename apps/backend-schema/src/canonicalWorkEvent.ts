import { createHash } from 'node:crypto';

export const B3_CONTENT_HASH_VERSION = 1;
export const B3_CONTENT_HASH_ALGORITHM = 'sha256';

export interface CanonicalWorkEventFields {
  readonly id: string;
  readonly organizationId: string;
  readonly assignmentId: string;
  readonly nfcTagId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly triggeredBy: string;
  readonly occurredAt: string;
}

// Version 1 intentionally matches the B1-proven representation: a JSON array fixes field
// order, JSON escaping fixes string encoding, Date#toISOString fixes UTC millisecond form,
// and the resulting string is hashed as UTF-8 bytes. Server metadata is excluded.
export function canonicalWorkEventContent(fields: CanonicalWorkEventFields): string {
  return JSON.stringify([
    fields.id,
    fields.organizationId,
    fields.assignmentId,
    fields.nfcTagId,
    fields.targetType,
    fields.targetId,
    fields.triggeredBy,
    new Date(fields.occurredAt).toISOString(),
  ]);
}

export function workEventContentHash(fields: CanonicalWorkEventFields): string {
  return createHash(B3_CONTENT_HASH_ALGORITHM)
    .update(canonicalWorkEventContent(fields), 'utf8')
    .digest('hex');
}
