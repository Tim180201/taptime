import { describe, expect, it } from 'vitest';
import { classifyAuthenticationResult } from '../../src/application/classifyAuthenticationResult';
import { OrganizationId, UserId } from '../../src/domain/ids';
import type { AuthenticationResult } from '../../src/application/AuthenticationResult';

describe('classifyAuthenticationResult (DT-009)', () => {
  it('returns null for an authenticated result (not an error)', () => {
    const result: AuthenticationResult = {
      status: 'authenticated',
      userId: UserId('demo-employee'),
      organizationId: OrganizationId('demo-org'),
    };

    expect(classifyAuthenticationResult(result)).toBeNull();
  });

  it('classifies invalid_credentials as recoverable', () => {
    const result: AuthenticationResult = { status: 'rejected', reason: 'invalid_credentials' };

    expect(classifyAuthenticationResult(result)).toBe('recoverable');
  });
});
