import type { NfcTagRepository } from '../../ports/NfcTagRepository';
import type { NfcTag } from '../../domain/NfcTag';
import type { NfcPayload } from '../../domain/NfcPayload';

export class InMemoryNfcTagRepository implements NfcTagRepository {
  private readonly tags: NfcTag[];

  constructor(tags: readonly NfcTag[] = []) {
    this.tags = [...tags];
  }

  findByPayload(payload: NfcPayload): NfcTag | null {
    return this.tags.find((tag) => tag.payload === payload) ?? null;
  }

  register(nfcTag: NfcTag): void {
    this.tags.push(nfcTag);
  }
}
