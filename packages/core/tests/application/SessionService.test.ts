import { describe, expect, it, vi } from 'vitest';
import { SessionService, toCallerContext } from '../../src/application/SessionService';
import { DEFAULT_DEMO_ACCOUNT, FakeAuthenticationGateway } from '../../src/infrastructure/adapters/FakeAuthenticationGateway';
import type { AuthenticationGateway } from '../../src/ports/AuthenticationGateway';
import type { AuthenticationResult } from '../../src/application/AuthenticationResult';

describe('SessionService (DT-013)', () => {
  it('forwards a successful authentication result from the gateway faithfully', () => {
    const gateway = new FakeAuthenticationGateway();
    const service = new SessionService(gateway);

    const result = service.signIn({ signInCode: DEFAULT_DEMO_ACCOUNT.signInCode });

    expect(result).toEqual({
      status: 'authenticated',
      userId: DEFAULT_DEMO_ACCOUNT.userId,
      organizationId: DEFAULT_DEMO_ACCOUNT.organizationId,
    });
  });

  it('forwards a rejection result from the gateway faithfully', () => {
    const gateway = new FakeAuthenticationGateway();
    const service = new SessionService(gateway);

    const result = service.signIn({ signInCode: 'unknown' });

    expect(result).toEqual({ status: 'rejected', reason: 'invalid_credentials' });
  });

  it('does not decide anything beyond what the gateway returned (pure pass-through)', () => {
    const scriptedResult: AuthenticationResult = {
      status: 'authenticated',
      userId: DEFAULT_DEMO_ACCOUNT.userId,
      organizationId: DEFAULT_DEMO_ACCOUNT.organizationId,
    };
    const authenticate = vi.fn().mockReturnValue(scriptedResult);
    const gateway: AuthenticationGateway = { authenticate };
    const service = new SessionService(gateway);
    const credentials = { signInCode: 'anything' };

    const result = service.signIn(credentials);

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(authenticate).toHaveBeenCalledWith(credentials);
    expect(result).toBe(scriptedResult);
  });
});

describe('toCallerContext (DT-013)', () => {
  it('produces the existing authenticatedCaller() shape for an authenticated result', () => {
    const result: AuthenticationResult = {
      status: 'authenticated',
      userId: DEFAULT_DEMO_ACCOUNT.userId,
      organizationId: DEFAULT_DEMO_ACCOUNT.organizationId,
    };

    expect(toCallerContext(result)).toEqual({
      status: 'authenticated',
      userId: DEFAULT_DEMO_ACCOUNT.userId,
      organizationId: DEFAULT_DEMO_ACCOUNT.organizationId,
    });
  });

  it('produces UNAUTHENTICATED_CALLER for a rejected result', () => {
    const result: AuthenticationResult = { status: 'rejected', reason: 'invalid_credentials' };

    expect(toCallerContext(result)).toEqual({ status: 'unauthenticated' });
  });

  it('introduces no new CallerContext shape: the result matches authenticatedCaller() exactly', async () => {
    const { authenticatedCaller } = await import('../../src/domain/CallerContext');
    const result: AuthenticationResult = {
      status: 'authenticated',
      userId: DEFAULT_DEMO_ACCOUNT.userId,
      organizationId: DEFAULT_DEMO_ACCOUNT.organizationId,
    };

    expect(toCallerContext(result)).toEqual(
      authenticatedCaller(DEFAULT_DEMO_ACCOUNT.userId, DEFAULT_DEMO_ACCOUNT.organizationId),
    );
  });
});
