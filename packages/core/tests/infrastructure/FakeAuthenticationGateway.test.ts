import { describe, expect, it } from 'vitest';
import { DEFAULT_DEMO_ACCOUNT, FakeAuthenticationGateway } from '../../src/infrastructure/adapters/FakeAuthenticationGateway';
import { OrganizationId, UserId } from '../../src/domain/ids';

describe('FakeAuthenticationGateway (DT-013)', () => {
  it('authenticates the default demo account for its known sign-in code', () => {
    const gateway = new FakeAuthenticationGateway();

    const result = gateway.authenticate({ signInCode: DEFAULT_DEMO_ACCOUNT.signInCode });

    expect(result).toEqual({
      status: 'authenticated',
      userId: DEFAULT_DEMO_ACCOUNT.userId,
      organizationId: DEFAULT_DEMO_ACCOUNT.organizationId,
    });
  });

  it('rejects an unknown sign-in code with an explicit result, not a thrown exception', () => {
    const gateway = new FakeAuthenticationGateway();

    const result = gateway.authenticate({ signInCode: 'not-a-known-code' });

    expect(result).toEqual({ status: 'rejected', reason: 'invalid_credentials' });
  });

  it('rejects an empty sign-in code', () => {
    const gateway = new FakeAuthenticationGateway();

    const result = gateway.authenticate({ signInCode: '' });

    expect(result).toEqual({ status: 'rejected', reason: 'invalid_credentials' });
  });

  it('supports a custom, clearly-labeled set of demo accounts instead of the default', () => {
    const secondAccount = {
      signInCode: 'second-demo-code',
      userId: UserId('second-demo-employee'),
      organizationId: OrganizationId('second-demo-org'),
    };
    const gateway = new FakeAuthenticationGateway([DEFAULT_DEMO_ACCOUNT, secondAccount]);

    const result = gateway.authenticate({ signInCode: 'second-demo-code' });

    expect(result).toEqual({
      status: 'authenticated',
      userId: secondAccount.userId,
      organizationId: secondAccount.organizationId,
    });
  });

  it('is deterministic: the same credentials always produce the same result', () => {
    const gateway = new FakeAuthenticationGateway();
    const credentials = { signInCode: DEFAULT_DEMO_ACCOUNT.signInCode };

    const first = gateway.authenticate(credentials);
    const second = gateway.authenticate(credentials);

    expect(first).toEqual(second);
  });
});
