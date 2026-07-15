import { describe, expect, it, vi } from 'vitest';
import type { AdminWebApiPort, ApiResult, Session } from '../src/AdminWebApiClient';
import { AdminWebCoordinator, type AdminWebAuthPort } from '../src/AdminWebCoordinator';
import type { SafeProjection } from '../src/contracts';

const membershipId = '20000000-0000-4000-8000-000000000001';
const projection: SafeProjection = {
  organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' },
  customers: [{ id: '40000000-0000-4000-8000-000000000001', displayName: 'Werkstatt', active: true }],
  nfcTags: [],
  nextCursor: null,
};

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => { resolve = done; });
  return { promise, resolve };
}

class FakeAuth implements AdminWebAuthPort {
  active = false;
  readonly signIn = vi.fn<AdminWebAuthPort['signIn']>(async () => { this.active = true; return true; });
  readonly signOut = vi.fn<AdminWebAuthPort['signOut']>(async () => { this.active = false; });

  async withAccessToken<Value>(operation: (accessToken: string) => Promise<Value>): Promise<Value | null> {
    return this.active ? operation('memory-only-token') : null;
  }
}

class FakeApi implements AdminWebApiPort {
  readonly session = vi.fn<AdminWebApiPort['session']>(async () => ({
    status: 'succeeded', value: { membershipId, role: 'administrator' },
  }));
  readonly projection = vi.fn<AdminWebApiPort['projection']>(async () => ({
    status: 'succeeded', value: projection,
  }));
  readonly createCustomer = vi.fn<AdminWebApiPort['createCustomer']>(async () => ({
    status: 'succeeded', value: true,
  }));
}

function setup() {
  const auth = new FakeAuth();
  const api = new FakeApi();
  const coordinator = new AdminWebCoordinator(auth, api);
  return { auth, api, coordinator };
}

describe('AdminWebCoordinator', () => {
  it('rejects an Employee, clears the memory session, and never loads setup data', async () => {
    const { auth, api, coordinator } = setup();
    api.session.mockResolvedValueOnce({
      status: 'succeeded', value: { membershipId, role: 'employee' },
    });

    await coordinator.signIn('employee@example.test', 'secret');

    expect(coordinator.getState()).toEqual({
      status: 'forbidden', message: 'Diese Oberfläche ist nur für Administratoren verfügbar.',
    });
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.active).toBe(false);
    expect(api.projection).not.toHaveBeenCalled();
  });

  it('clears a late successful sign-in after sign-out instead of retaining a hidden session', async () => {
    const { auth, api, coordinator } = setup();
    const lateSignIn = deferred<boolean>();
    auth.signIn.mockImplementationOnce(async () => {
      const succeeded = await lateSignIn.promise;
      auth.active = succeeded;
      return succeeded;
    });

    const signingIn = coordinator.signIn('administrator@example.test', 'secret');
    const signingOut = coordinator.signOut();
    expect(coordinator.getState()).toEqual({ status: 'signed_out' });

    lateSignIn.resolve(true);
    await Promise.all([signingIn, signingOut]);

    expect(auth.active).toBe(false);
    expect(auth.signOut).toHaveBeenCalledTimes(2);
    expect(api.session).not.toHaveBeenCalled();
    expect(coordinator.getState()).toEqual({ status: 'signed_out' });
  });

  it('serializes a newer sign-in behind stale session resolution and gives only the newer attempt ownership', async () => {
    const { auth, api, coordinator } = setup();
    const staleSession = deferred<ApiResult<Session>>();
    api.session.mockImplementationOnce(() => staleSession.promise);

    const first = coordinator.signIn('first@example.test', 'secret');
    await vi.waitFor(() => expect(api.session).toHaveBeenCalledTimes(1));
    const second = coordinator.signIn('second@example.test', 'secret');
    staleSession.resolve({ status: 'succeeded', value: { membershipId, role: 'administrator' } });
    await Promise.all([first, second]);

    expect(auth.signIn).toHaveBeenCalledTimes(2);
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.active).toBe(true);
    expect(api.projection).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toEqual({
      status: 'ready', projection, creating: false, notice: null,
    });
  });

  it('shows a success notice only after Customer creation and projection refresh both succeed', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');

    await coordinator.createCustomer('Neue Werkstatt');

    expect(api.createCustomer).toHaveBeenCalledWith(
      'memory-only-token',
      membershipId,
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
      'Neue Werkstatt',
    );
    expect(api.projection).toHaveBeenCalledTimes(2);
    expect(coordinator.getState()).toEqual({
      status: 'ready', projection, creating: false, notice: 'Kunde wurde sicher angelegt.',
    });
  });

  it('invalidates and signs out a ready session after an authority-rejected refresh', async () => {
    const { auth, api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    api.projection.mockResolvedValueOnce({ status: 'rejected' });

    await coordinator.refresh();

    expect(coordinator.getState()).toEqual({
      status: 'unavailable', message: 'Administrator-Sitzung ist nicht mehr gültig.',
    });
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.active).toBe(false);
  });

  it('loads and merges exactly one cursor-bounded page', async () => {
    const { api, coordinator } = setup();
    const cursor = 'v1:c:40000000-0000-4000-8000-000000000001';
    api.projection.mockResolvedValueOnce({
      status: 'succeeded', value: { ...projection, nextCursor: cursor },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    api.projection.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        organization: projection.organization,
        customers: [{ id: '40000000-0000-4000-8000-000000000002', displayName: 'Lager', active: true }],
        nfcTags: [],
        nextCursor: null,
      },
    });

    await coordinator.loadMore();

    expect(api.projection).toHaveBeenLastCalledWith('memory-only-token', membershipId, cursor);
    expect(coordinator.getState()).toEqual({
      status: 'ready', creating: false, notice: null,
      projection: {
        organization: projection.organization,
        customers: [...projection.customers, { id: '40000000-0000-4000-8000-000000000002', displayName: 'Lager', active: true }],
        nfcTags: [],
        nextCursor: null,
      },
    });
  });

  it('fails closed when a pagination response does not advance its cursor', async () => {
    const { api, coordinator } = setup();
    const cursor = 'v1:c:40000000-0000-4000-8000-000000000001';
    api.projection.mockResolvedValueOnce({
      status: 'succeeded', value: { ...projection, nextCursor: cursor },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    api.projection.mockResolvedValueOnce({
      status: 'succeeded', value: { ...projection, customers: [], nextCursor: cursor },
    });

    await coordinator.loadMore();

    expect(coordinator.getState()).toEqual({
      status: 'unavailable', message: 'Weitere Einrichtungsdaten konnten nicht sicher bestätigt werden.',
    });
  });

  it('fails closed for cross-Organization or duplicate pagination data', async () => {
    const cursor = 'v1:c:40000000-0000-4000-8000-000000000001';
    const invalidPages: readonly SafeProjection[] = [
      {
        organization: { id: '30000000-0000-4000-8000-000000000002', name: 'Andere Organisation' },
        customers: [{ id: '40000000-0000-4000-8000-000000000002', displayName: 'Lager', active: true }],
        nfcTags: [],
        nextCursor: null,
      },
      {
        ...projection,
        nextCursor: null,
      },
    ];

    for (const invalidPage of invalidPages) {
      const { api, coordinator } = setup();
      api.projection.mockResolvedValueOnce({
        status: 'succeeded', value: { ...projection, nextCursor: cursor },
      });
      await coordinator.signIn('administrator@example.test', 'secret');
      api.projection.mockResolvedValueOnce({ status: 'succeeded', value: invalidPage });

      await coordinator.loadMore();

      expect(coordinator.getState()).toEqual({
        status: 'unavailable', message: 'Weitere Einrichtungsdaten konnten nicht sicher bestätigt werden.',
      });
    }
  });
});
