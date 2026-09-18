export type TagWriteFailureReason =
  | 'ndef_not_supported' | 'read_only' | 'capacity_exceeded'
  | 'tag_changed' | 'write_failed' | 'cancelled';

export type TagWriteResult =
  | { readonly status: 'written' }
  | { readonly status: 'failed'; readonly reason: TagWriteFailureReason };

/** Private setup capability; does not change scan evidence or transport contracts. */
export interface NfcTagWriter {
  write(canonicalPayload: string, uri: string): Promise<TagWriteResult>;
  cancel(): Promise<void>;
}
