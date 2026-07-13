import { describe, expect, it } from 'vitest';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { NfcTagId, OrganizationId } from '../../src/domain/ids';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import type { NfcTag } from '../../src/domain/NfcTag';

describe('InMemoryNfcTagRepository (DT-021)', () => {
  it('returns null when no NfcTag was ever registered for the given payload', async () => {
    const repository = new InMemoryNfcTagRepository();

    expect(await repository.findByPayload(createNfcPayload('unknown-payload'))).toBeNull();
  });

  it('registers an NfcTag and finds it again by payload (round-trip)', async () => {
    const repository = new InMemoryNfcTagRepository();
    const tag: NfcTag = {
      id: NfcTagId('tag-1'),
      organizationId: OrganizationId('org-1'),
      payload: createNfcPayload('tag-payload-1'),
    };

    await repository.register(tag);

    expect(await repository.findByPayload(createNfcPayload('tag-payload-1'))).toEqual(tag);
  });

  it('does not find an NfcTag registered under a different payload', async () => {
    const repository = new InMemoryNfcTagRepository();
    await repository.register({
      id: NfcTagId('tag-1'),
      organizationId: OrganizationId('org-1'),
      payload: createNfcPayload('tag-payload-1'),
    });

    expect(await repository.findByPayload(createNfcPayload('some-other-payload'))).toBeNull();
  });

  it('supports constructor-seeded NfcTags (existing, unchanged behavior)', async () => {
    const seeded: NfcTag = {
      id: NfcTagId('tag-seed'),
      organizationId: OrganizationId('org-1'),
      payload: createNfcPayload('seed-payload'),
    };
    const repository = new InMemoryNfcTagRepository([seeded]);

    expect(await repository.findByPayload(createNfcPayload('seed-payload'))).toEqual(seeded);
  });

  it('does not mutate the array passed into its constructor', async () => {
    const seed: NfcTag[] = [
      { id: NfcTagId('tag-seed'), organizationId: OrganizationId('org-1'), payload: createNfcPayload('seed-payload') },
    ];
    const repository = new InMemoryNfcTagRepository(seed);

    await repository.register({
      id: NfcTagId('tag-2'),
      organizationId: OrganizationId('org-1'),
      payload: createNfcPayload('tag-payload-2'),
    });

    expect(seed).toHaveLength(1);
  });
});
