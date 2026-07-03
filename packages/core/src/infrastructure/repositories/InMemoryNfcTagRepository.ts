import type { NfcTagRepository } from '../../ports/NfcTagRepository';
import type { NfcTag } from '../../domain/NfcTag';
import type { NfcPayload } from '../../domain/NfcPayload';

export class InMemoryNfcTagRepository implements NfcTagRepository {
  constructor(private readonly tags: readonly NfcTag[] = []) {}

  findByPayload(payload: NfcPayload): NfcTag | null {
    return this.tags.find((tag) => tag.payload === payload) ?? null;
  }
}
