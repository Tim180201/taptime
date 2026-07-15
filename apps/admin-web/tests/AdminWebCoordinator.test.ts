import { describe, expect, it, vi } from 'vitest';
import type { AdminWebApiPort, ApiResult, Session } from '../src/AdminWebApiClient';
import { AdminWebCoordinator, type AdminWebAuthPort } from '../src/AdminWebCoordinator';
import type { SafeEmployeeProjection, SafeProjection } from '../src/contracts';

const membershipId = '20000000-0000-4000-8000-000000000001';
const projection: SafeProjection = {
  organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' },
  customers: [{ id: '40000000-0000-4000-8000-000000000001', displayName: 'Werkstatt', active: true }],
  nfcTags: [],
  nextCursor: null,
};
const employeeProjection: SafeEmployeeProjection = {
  organization: projection.organization,
  employeeMemberships: [],
  nextCursor: null,
};

function employeeMemberships(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `70000000-0000-4000-8000-${(start + index).toString().padStart(12, '0')}`,
    displayName: `Employee ${start + index}`,
    role: 'employee' as const,
    active: true as const,
  }));
}

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
  readonly employeeProjection = vi.fn<AdminWebApiPort['employeeProjection']>(async () => ({
    status: 'succeeded', value: employeeProjection,
  }));
  readonly createEmployeeInvitation = vi.fn<AdminWebApiPort['createEmployeeInvitation']>(async () => ({
    status: 'succeeded',
    value: {
      value: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      expiresAt: '2099-07-15T12:34:56.789Z',
    },
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
      status: 'ready', projection, employeeProjection, creating: false,
      creatingEmployee: false, invitation: null, notice: null,
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
      status: 'ready', projection, employeeProjection, creating: false,
      creatingEmployee: false, invitation: null, notice: 'Kunde wurde sicher angelegt.',
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

  it('invalidates and signs out when the Employee projection rejects a refresh', async () => {
    const { auth, api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    api.employeeProjection.mockResolvedValueOnce({ status: 'rejected' });

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
      status: 'ready', creating: false, creatingEmployee: false,
      invitation: null, notice: null, employeeProjection,
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

  it('holds an invitation secret only in the ready generation and clears it on sign-out', async () => {
    const { auth, api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');

    await coordinator.createEmployeeInvitation('Employee Alpha');

    expect(api.createEmployeeInvitation).toHaveBeenCalledWith(
      'memory-only-token',
      membershipId,
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
      'Employee Alpha',
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      invitation: {
        value: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        expiresAt: '2099-07-15T12:34:56.789Z',
      },
      creatingEmployee: false,
    });

    await coordinator.signOut();

    expect(coordinator.getState()).toEqual({ status: 'signed_out' });
    expect(auth.active).toBe(false);
  });

  it('never restores a once-disclosed secret on refresh or command replay conflict', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    await coordinator.createEmployeeInvitation('Employee Alpha');
    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: expect.any(Object) });

    await coordinator.refresh();

    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: null });
    api.createEmployeeInvitation.mockResolvedValueOnce({
      status: 'conflict', code: 'invitation_created_token_unavailable',
    });
    await coordinator.createEmployeeInvitation('Employee Alpha');
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      invitation: null,
      notice: 'Diese Einladung wurde bereits erzeugt; ihr Geheimnis kann nicht erneut angezeigt werden.',
    });
  });

  it('never restores a once-disclosed secret after setup pagination leaves the ready screen', async () => {
    const { api, coordinator } = setup();
    const cursor = 'v1:c:40000000-0000-4000-8000-000000000001';
    api.projection.mockResolvedValueOnce({
      status: 'succeeded', value: { ...projection, nextCursor: cursor },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    await coordinator.createEmployeeInvitation('Employee Alpha');
    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: expect.any(Object) });
    api.projection.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        organization: projection.organization,
        customers: [{
          id: '40000000-0000-4000-8000-000000000002',
          displayName: 'Lager',
          active: true,
        }],
        nfcTags: [],
        nextCursor: null,
      },
    });

    await coordinator.loadMore();

    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: null });
  });

  it('tombstones a dismissed secret against a later Employee-pagination completion', async () => {
    const { api, coordinator } = setup();
    const firstPage = employeeMemberships(1, 20);
    const cursor = `v1:e:${firstPage.at(-1)!.id}`;
    api.employeeProjection.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        organization: projection.organization,
        employeeMemberships: firstPage,
        nextCursor: cursor,
      },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    await coordinator.createEmployeeInvitation('Employee Alpha');
    const pendingPage = deferred<ApiResult<SafeEmployeeProjection>>();
    api.employeeProjection.mockImplementationOnce(() => pendingPage.promise);

    const loading = coordinator.loadMoreEmployees();
    await vi.waitFor(() => expect(api.employeeProjection).toHaveBeenCalledTimes(2));
    coordinator.dismissInvitation();
    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: null });
    pendingPage.resolve({
      status: 'succeeded',
      value: {
        organization: projection.organization,
        employeeMemberships: employeeMemberships(21, 1),
        nextCursor: null,
      },
    });
    await loading;

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      invitation: null,
      employeeProjection: { employeeMemberships: [...firstPage, ...employeeMemberships(21, 1)] },
    });
  });

  it('tombstones a dismissed secret against any later non-disclosure async state write', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    await coordinator.createEmployeeInvitation('Employee Alpha');
    const pendingCustomer = deferred<ApiResult<true>>();
    api.createCustomer.mockImplementationOnce(() => pendingCustomer.promise);

    const creating = coordinator.createCustomer('Werkstatt Zwei');
    await vi.waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1));
    coordinator.dismissInvitation();
    pendingCustomer.resolve({ status: 'unavailable' });
    await creating;

    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: null });
  });

  it('fails closed for duplicate, unordered, cursor-regressing, or discontinuous Employee pages', async () => {
    const firstPage = employeeMemberships(1, 20);
    const cursor = `v1:e:${firstPage.at(-1)!.id}`;
    const nextPage = employeeMemberships(21, 20);
    const invalidPages: readonly SafeEmployeeProjection[] = [
      {
        organization: projection.organization,
        employeeMemberships: [nextPage[0]!, nextPage[0]!],
        nextCursor: null,
      },
      {
        organization: projection.organization,
        employeeMemberships: [nextPage[1]!, nextPage[0]!],
        nextCursor: null,
      },
      {
        organization: projection.organization,
        employeeMemberships: [{ ...nextPage[0]!, id: cursor.slice(5) }],
        nextCursor: null,
      },
      {
        organization: projection.organization,
        employeeMemberships: nextPage,
        nextCursor: `v1:e:${nextPage[18]!.id}`,
      },
      {
        organization: projection.organization,
        employeeMemberships: [{ ...nextPage[0]!, displayName: ' Employee 21' }],
        nextCursor: null,
      },
    ];

    for (const invalidPage of invalidPages) {
      const { api, coordinator } = setup();
      api.employeeProjection.mockResolvedValueOnce({
        status: 'succeeded',
        value: {
          organization: projection.organization,
          employeeMemberships: firstPage,
          nextCursor: cursor,
        },
      });
      await coordinator.signIn('administrator@example.test', 'secret');
      api.employeeProjection.mockResolvedValueOnce({ status: 'succeeded', value: invalidPage });

      await coordinator.loadMoreEmployees();

      expect(coordinator.getState()).toEqual({
        status: 'unavailable',
        message: 'Weitere Beschäftigtendaten konnten nicht sicher bestätigt werden.',
      });
    }
  });

  it('fails closed when the Employee projection claims a different Organization', async () => {
    const { auth, api, coordinator } = setup();
    api.employeeProjection.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        organization: { id: '30000000-0000-4000-8000-000000000002', name: 'Andere Organisation' },
        employeeMemberships: [],
        nextCursor: null,
      },
    });

    await coordinator.signIn('administrator@example.test', 'secret');

    expect(coordinator.getState()).toEqual({
      status: 'unavailable', message: 'Anmeldung derzeit nicht verfügbar.',
    });
    expect(auth.active).toBe(false);
  });
});
