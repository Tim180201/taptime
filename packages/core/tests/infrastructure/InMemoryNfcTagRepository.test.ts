import { describe, expect, it } from 'vitest';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { NfcTagId, OrganizationId } from '../../src/domain/ids';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import type { NfcTag } from '../../src/domain/NfcTag';

describe('InMemoryNfcTagRepository (DT-021)', () => {
  it('returns null when no NfcTag was ever registered for the given payload', () => {
    const repository = new InMemoryNfcTagRepository();

    expect(repository.findByPayload(createNfcPayload('unknown-payload'))).toBeNull();
  });

  it('registers an NfcTag and finds it again by payload (round-trip)', () => {
    const repository = new InMemoryNfcTagRepository();
    const tag: NfcTag = {
      id: NfcTagId('tag-1'),
      organizationId: OrganizationId('org-1'),
      payload: createNfcPayload('tag-payload-1'),
    };

    repository.register(tag);

    expect(repository.findByPayload(createNfcPayload('tag-payload-1'))).toEqual(tag);
  });

  it('does not find an NfcTag registered under a different payload', () => {
    const repository = new InMemoryNfcTagRepository();
    repository.register({
      id: NfcTagId('tag-1'),
      organizationId: OrganizationId('org-1'),
      payload: createNfcPayload('tag-payload-1'),
    });

    expect(repository.findByPayload(createNfcPayload('some-other-payload'))).toBeNull();
  });

  it('supports constructor-seeded NfcTags (existing, unchanged behavior)', () => {
    const seeded: NfcTag = {
      id: NfcTagId('tag-seed'),
      organizationId: OrganizationId('org-1'),
      payload: createNfcPayload('seed-payload'),
    };
    const repository = new InMemoryNfcTagRepository([seeded]);

    expect(repository.findByPayload(createNfcPayload('seed-payload'))).toEqual(seeded);
  });

  it('does not mutate the array passed into its constructor', () => {
    const seed: NfcTag[] = [
      { id: NfcTagId('tag-seed'), organizationId: OrganizationId('org-1'), payload: createNfcPayload('seed-payload') },
    ];
    const repository = new InMemoryNfcTagRepository(seed);

    repository.register({
      id: NfcTagId('tag-2'),
      organizationId: OrganizationId('org-1'),
      payload: createNfcPayload('tag-payload-2'),
    });

    expect(seed).toHaveLength(1);
  });
});
