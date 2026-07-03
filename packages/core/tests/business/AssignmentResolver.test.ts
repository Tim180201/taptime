import { describe, expect, it } from 'vitest';
import { AssignmentResolver } from '../../src/business/AssignmentResolver';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { NfcAssignmentId, NfcTagId, OrganizationId } from '../../src/domain/ids';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import { createTimestamp } from '../../src/domain/Timestamp';
import { nfcTagScanned } from '../../src/domain/facts/NfcTagScanned';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { CustomerId } from '../../src/domain/ids';
import type { NfcTag } from '../../src/domain/NfcTag';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';

const organizationId = OrganizationId('org-1');
const payload = createNfcPayload('known-tag-payload');
const tag: NfcTag = { id: NfcTagId('tag-1'), organizationId, payload };
const target = customerAssignmentTarget(CustomerId('customer-1'));

function scanFact(rawPayload = payload) {
  return nfcTagScanned(rawPayload, createTimestamp('2026-07-03T10:00:00.000Z'));
}

describe('AssignmentResolver (DT-002)', () => {
  it('resolves a known tag with an active assignment to NfcAssignmentResolved', () => {
    const assignment: NfcAssignment = {
      id: NfcAssignmentId('assignment-1'),
      organizationId,
      nfcTagId: tag.id,
      target,
      active: true,
    };
    const resolver = new AssignmentResolver(
      new InMemoryNfcTagRepository([tag]),
      new InMemoryNfcAssignmentRepository([assignment]),
    );

    const result = resolver.resolve(scanFact());

    expect(result).toEqual({ type: 'NfcAssignmentResolved', assignment });
  });

  it('rejects an unknown NFC tag explicitly', () => {
    const resolver = new AssignmentResolver(
      new InMemoryNfcTagRepository([]),
      new InMemoryNfcAssignmentRepository([]),
    );

    const result = resolver.resolve(scanFact());

    expect(result).toEqual({ type: 'NfcAssignmentRejected', payload, reason: 'unknown_tag' });
  });

  it('rejects a known tag with an inactive assignment explicitly', () => {
    const inactiveAssignment: NfcAssignment = {
      id: NfcAssignmentId('assignment-1'),
      organizationId,
      nfcTagId: tag.id,
      target,
      active: false,
    };
    const resolver = new AssignmentResolver(
      new InMemoryNfcTagRepository([tag]),
      new InMemoryNfcAssignmentRepository([inactiveAssignment]),
    );

    const result = resolver.resolve(scanFact());

    expect(result).toEqual({ type: 'NfcAssignmentRejected', payload, reason: 'inactive_assignment' });
  });

  it('rejects a known tag with no assignment at all as inactive_assignment', () => {
    const resolver = new AssignmentResolver(
      new InMemoryNfcTagRepository([tag]),
      new InMemoryNfcAssignmentRepository([]),
    );

    const result = resolver.resolve(scanFact());

    expect(result).toEqual({ type: 'NfcAssignmentRejected', payload, reason: 'inactive_assignment' });
  });

  it('does not create WorkEvents (resolver returns a decision result only)', () => {
    const resolver = new AssignmentResolver(
      new InMemoryNfcTagRepository([tag]),
      new InMemoryNfcAssignmentRepository([]),
    );

    const result = resolver.resolve(scanFact());

    expect(result).not.toHaveProperty('workEvent');
  });
});
