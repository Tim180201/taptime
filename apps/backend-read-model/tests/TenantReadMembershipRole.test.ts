import { describe, expect, it } from 'vitest';
import { resolveTenantReadRole } from '../src/TenantReadSessionCoordinator.js';

describe('TenantReadSessionCoordinator Membership role mapping', () => {
  it('maps only the Administrator role to the Administrator database role', () => {
    expect(resolveTenantReadRole('administrator')).toEqual({
      membershipRole: 'administrator',
      databaseRole: 'taptime_administrator',
    });
  });

  it.each(['standortleitung', 'employee'] as const)(
    'maps %s to the least-privilege Employee database role',
    (role) => {
      expect(resolveTenantReadRole(role)).toEqual({
        membershipRole: role,
        databaseRole: 'taptime_employee',
      });
    },
  );

  it.each([null, '', 'manager', 'Administrator'])('rejects unknown role %j', (role) => {
    expect(() => resolveTenantReadRole(role)).toThrow('Unsupported resolved Membership role');
  });
});
