import { describe, expect, it } from 'vitest';
import { MembershipId, NfcTagId, OrganizationId } from '../../src/domain/ids';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import { createTimestamp } from '../../src/domain/Timestamp';

describe('domain value objects', () => {
  it('accepts a non-empty value', () => {
    expect(OrganizationId('org-1')).toBe('org-1');
    expect(NfcTagId('tag-1')).toBe('tag-1');
    expect(MembershipId('membership-1')).toBe('membership-1');
  });

  it('rejects an empty id', () => {
    expect(() => OrganizationId('')).toThrow();
    expect(() => NfcTagId('   ')).toThrow();
    expect(() => MembershipId('')).toThrow();
    expect(() => MembershipId('   ')).toThrow();
  });

  it('rejects an empty NfcPayload', () => {
    expect(() => createNfcPayload('')).toThrow();
  });

  it('rejects an invalid Timestamp', () => {
    expect(() => createTimestamp('not-a-date')).toThrow();
    expect(createTimestamp('2026-07-03T10:00:00.000Z')).toBe('2026-07-03T10:00:00.000Z');
  });
});
