import { describe, expect, it } from 'vitest';
import { isMembershipRole } from '../src/index.js';

describe('MembershipRole', () => {
  it.each(['administrator', 'standortleitung', 'employee'] as const)(
    'recognizes the persisted role %s',
    (role) => {
      expect(isMembershipRole(role)).toBe(true);
    },
  );

  it.each([null, undefined, '', 'manager', 'Administrator', 1])(
    'rejects the unknown persisted value %j',
    (value) => {
      expect(isMembershipRole(value)).toBe(false);
    },
  );
});
