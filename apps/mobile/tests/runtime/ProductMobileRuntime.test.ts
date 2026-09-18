import { describe, expect, it, vi } from 'vitest';
import type { EmployeeEnrollmentResult, MobileSessionState, SignInResult } from '../../src/auth/contracts';
import {
  DefaultProductMobileRuntime,
  type ProductScanRuntimeOwner,
  type ProductSessionRuntimeOwner,
} from '../../src/runtime/DefaultProductMobileRuntime';
import type { ProductScanState } from '../../src/scan/contracts';
import type { AdminSetupState } from '../../src/administration/contracts';
import type { ProductServerTransport } from '../../src/transport/contracts';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeSessionRuntimeOwner implements ProductSessionRuntimeOwner {
  readonly start = vi.fn<() => Promise<void>>(async () => undefined);
  readonly stop = vi.fn<() => void>();
  readonly subscribe = vi.fn<(_listener: () => void) => () => void>(() => () => undefined);
  readonly signIn = vi.fn<
    (_email: string, _password: string) => Promise<SignInResult>
  >(async () => ({ status: 'invalid_credentials' }));
  readonly signInForEmployeeEnrollment = vi.fn<
    (_email: string, _password: string) => Promise<SignInResult>
  >(async () => ({ status: 'invalid_credentials' }));
  readonly redeemEmployeeInvitation = vi.fn<
    (_invitationSecret: string) => Promise<EmployeeEnrollmentResult>
  >(async () => ({ status: 'context_unavailable' }));
  readonly retryContext = vi.fn<() => Promise<void>>(async () => undefined);
  readonly requestPasswordReset = vi.fn(async () => 'requested' as const);
  readonly handlePasswordRecoveryUrl = vi.fn(async () => true);
  readonly completePasswordRecovery = vi.fn(async () => true);
  readonly refresh = vi.fn<() => Promise<void>>(async () => undefined);
  readonly signOut = vi.fn<() => Promise<void>>(async () => undefined);

  getState(): MobileSessionState {
    return { status: 'signed_out' };
  }
}

class FakeScanRuntimeOwner implements ProductScanRuntimeOwner {
  readonly start = vi.fn<() => Promise<void>>(async () => undefined);
  readonly stop = vi.fn<() => Promise<void>>(async () => undefined);
  readonly scan = vi.fn<() => Promise<void>>(async () => undefined);
  readonly cancel = vi.fn<() => Promise<void>>(async () => undefined);
  readonly retry = vi.fn<() => Promise<void>>(async () => undefined);
  readonly subscribe = vi.fn<(_listener: () => void) => () => void>(() => () => undefined);

  getState(): ProductScanState {
    return { status: 'inactive' };
  }
}

class FakeAdministrationRuntimeOwner {
  readonly start = vi.fn<() => Promise<void>>(async () => undefined);
  readonly stop = vi.fn<() => Promise<void>>(async () => undefined);
  readonly refresh = vi.fn<() => Promise<void>>(async () => undefined);
  readonly loadMore = vi.fn<() => Promise<void>>(async () => undefined);
  readonly provision = vi.fn<(_customerId: string, _displayName: string) => Promise<void>>(async () => undefined);
  readonly provisionBreak = vi.fn<(_displayName: string) => Promise<void>>(async () => undefined);
  readonly cancel = vi.fn<() => Promise<void>>(async () => undefined);
  readonly subscribe = vi.fn<(_listener: () => void) => () => void>(() => () => undefined);
  getState(): AdminSetupState { return { status: 'inactive' }; }
}

function setup() {
  const session = new FakeSessionRuntimeOwner();
  const scan = new FakeScanRuntimeOwner();
  const administration = new FakeAdministrationRuntimeOwner();
  const appState = {
    start: vi.fn<() => void>(),
    stop: vi.fn<() => void>(),
  };
  const serverTransport = Object.freeze({}) as ProductServerTransport;
  const runtime = new DefaultProductMobileRuntime(session, appState, serverTransport, scan, administration);
  return { session, scan, administration, appState, runtime };
}

describe('DefaultProductMobileRuntime lifecycle', () => {
  it('does not start session or app-state ownership after stop during scan recovery', async () => {
    const context = setup();
    const scanStart = deferred();
    context.scan.start.mockImplementationOnce(() => scanStart.promise);

    const starting = context.runtime.start();
    context.runtime.stop();
    scanStart.resolve();
    await starting;

    expect(context.scan.stop).toHaveBeenCalledTimes(1);
    expect(context.session.stop).toHaveBeenCalledTimes(1);
    expect(context.session.start).not.toHaveBeenCalled();
    expect(context.appState.start).not.toHaveBeenCalled();
  });

  it('does not start app-state ownership after stop during session restoration', async () => {
    const context = setup();
    const sessionStart = deferred();
    context.session.start.mockImplementationOnce(() => sessionStart.promise);

    const starting = context.runtime.start();
    await vi.waitFor(() => expect(context.session.start).toHaveBeenCalledTimes(1));
    context.runtime.stop();
    sessionStart.resolve();
    await starting;

    expect(context.appState.stop).toHaveBeenCalledTimes(1);
    expect(context.appState.start).not.toHaveBeenCalled();
  });

  it('does not start session or app-state ownership after stop during administration setup', async () => {
    const context = setup();
    const administrationStart = deferred();
    context.administration.start.mockImplementationOnce(() => administrationStart.promise);

    const starting = context.runtime.start();
    await vi.waitFor(() => expect(context.administration.start).toHaveBeenCalledTimes(1));
    context.runtime.stop();
    administrationStart.resolve();
    await starting;

    expect(context.administration.stop).toHaveBeenCalledTimes(1);
    expect(context.session.start).not.toHaveBeenCalled();
    expect(context.appState.start).not.toHaveBeenCalled();
  });

  it.each(['scan recovery', 'administration setup', 'session restoration'] as const)(
    'ignores a stale %s failure after stop and a successful restart',
    async (phase) => {
      const context = setup();
      const staleStart = deferred();
      if (phase === 'scan recovery') {
        context.scan.start.mockImplementationOnce(() => staleStart.promise);
      } else if (phase === 'administration setup') {
        context.administration.start.mockImplementationOnce(() => staleStart.promise);
      } else {
        context.session.start.mockImplementationOnce(() => staleStart.promise);
      }

      const firstStart = context.runtime.start();
      if (phase === 'administration setup') {
        await vi.waitFor(() => expect(context.administration.start).toHaveBeenCalledTimes(1));
      } else if (phase === 'session restoration') {
        await vi.waitFor(() => expect(context.session.start).toHaveBeenCalledTimes(1));
      }
      context.runtime.stop();
      await context.runtime.start();
      staleStart.reject(new Error('synthetic stale runtime failure'));

      await expect(firstStart).resolves.toBeUndefined();
      expect(context.appState.start).toHaveBeenCalledTimes(1);
    },
  );

  it('still reports a failure owned by the current runtime generation', async () => {
    const context = setup();
    context.scan.start.mockRejectedValueOnce(new Error('synthetic current runtime failure'));

    await expect(context.runtime.start()).rejects.toThrow('synthetic current runtime failure');
    expect(context.session.start).not.toHaveBeenCalled();
    expect(context.appState.start).not.toHaveBeenCalled();
  });
});

describe('account-scoped scan protection', () => {
  it('re-evaluates a protected scanner for a new account, without changing evidence through the UI', async () => {
    const context = setup();
    const listeners = new Set<() => void>();
    let sessionState: MobileSessionState = { status: 'signed_out' };
    let scanState: ProductScanState = { status: 'protected_pending', reason: 'local_evidence_protected' };
    vi.spyOn(context.session, 'getState').mockImplementation(() => sessionState);
    vi.spyOn(context.scan, 'getState').mockImplementation(() => scanState);
    context.session.subscribe.mockImplementation((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; });
    context.scan.start.mockImplementation(async () => {
      if (sessionState.status === 'authenticated') scanState = { status: 'ready', outcome: null };
    });
    await context.runtime.start();
    expect(context.runtime.scan.getState().status).toBe('protected_pending');
    sessionState = { status: 'authenticated', session: {
      userId: 'person-B', organizationId: 'business', membershipId: 'membership-B', nfcSetupAvailable: false, role: 'employee',
    } };
    for (const listener of listeners) listener();
    await vi.waitFor(() => expect(context.runtime.scan.getState()).toEqual({ status: 'ready', outcome: null }));
    expect(context.scan.stop).toHaveBeenCalledTimes(1);
    expect(context.scan.start).toHaveBeenCalledTimes(2);
    expect(context.scan.scan).not.toHaveBeenCalled();
    expect(context.scan.retry).not.toHaveBeenCalled();
    for (const listener of listeners) listener();
    expect(context.scan.start).toHaveBeenCalledTimes(2);
    context.runtime.stop();
  });
});
