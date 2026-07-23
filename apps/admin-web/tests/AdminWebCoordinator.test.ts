import { describe, expect, it, vi } from 'vitest';
import type { AdminWebApiPort, ApiResult, Session } from '../src/AdminWebApiClient';
import { AdminWebCoordinator, type AdminWebAuthPort } from '../src/AdminWebCoordinator';
import type { SafeEmployeeProjection, SafeProjection, SafeReviewItem, SafeTimeRecord } from '../src/contracts';

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
const fixedNow = Date.parse('2026-07-21T12:00:00.000Z');
const readyTimeReviewState = {
  timeRecords: [],
  timeRecordsNextCursor: null,
  reviewItems: [],
  reviewItemsNextCursor: null,
  sections: {
    setup: { status: 'ready' as const },
    employees: { status: 'ready' as const },
    timeRecords: { status: 'ready' as const },
    reviewItems: { status: 'ready' as const },
  },
  timeWindow: {
    fromInclusive: '2026-06-20T12:00:00.000Z',
    toExclusive: '2026-07-21T12:00:00.000Z',
  },
  timeReviewBusy: false,
  correctionIntent: null,
  adjudicationIntent: null,
} as const;
const stoppedRecord: SafeTimeRecord = {
  timeRecordId: '90000000-0000-4000-8000-000000000001',
  employeeDisplayName: 'Employee Alpha', customerDisplayName: 'Werkstatt',
  source: 'canonical', status: 'stopped',
  startedAt: '2026-07-20T08:00:00.000Z', stoppedAt: '2026-07-20T10:00:00.000Z',
  baseRowVersion: 1, effectiveRevisionNumber: 0, overlapsAnotherRecord: false,
};
const reviewItem: SafeReviewItem = {
  reviewItemId: '90000000-0000-4000-8000-000000000002',
  source: 'offline_v2', employeeDisplayName: 'Employee Alpha',
  customerDisplayName: 'Werkstatt', occurredAt: '2026-07-20T11:00:00.000Z',
  reviewReason: 'automatic_window_elapsed', deviceSequence: 7, predecessorBlocked: true,
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
  readonly reassignNfcTag = vi.fn<AdminWebApiPort['reassignNfcTag']>(async () => ({
    status: 'succeeded',
    value: { assignmentChanged: true },
  }));
  readonly timeRecords = vi.fn<AdminWebApiPort['timeRecords']>(async () => ({
    status: 'succeeded', value: { items: [], nextCursor: null },
  }));
  readonly reviewItems = vi.fn<AdminWebApiPort['reviewItems']>(async () => ({
    status: 'succeeded', value: { items: [], nextCursor: null },
  }));
  readonly correctTimeRecord = vi.fn<AdminWebApiPort['correctTimeRecord']>(async () => ({
    status: 'succeeded', value: true,
  }));
  readonly adjudicateReviewItem = vi.fn<AdminWebApiPort['adjudicateReviewItem']>(async () => ({
    status: 'succeeded', value: true,
  }));
  readonly exportTimeEntries = vi.fn<AdminWebApiPort['exportTimeEntries']>(async () => ({
    status: 'succeeded', value: { blob: new Blob(['csv']), filename: 'taptime-time-entries_20260721T000000Z_20260722T000000Z.csv' },
  }));
}

function setup() {
  const auth = new FakeAuth();
  const api = new FakeApi();
  const coordinator = new AdminWebCoordinator(auth, api, () => fixedNow);
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
      ...readyTimeReviewState,
      status: 'ready', projection, employeeProjection, creating: false,
      creatingEmployee: false, invitation: null, reassignmentIntent: null,
      reassigning: false, notice: null,
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
      ...readyTimeReviewState,
      status: 'ready', projection, employeeProjection, creating: false,
      creatingEmployee: false, invitation: null, reassignmentIntent: null,
      reassigning: false, notice: 'Kunde wurde sicher angelegt.',
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
      ...readyTimeReviewState,
      status: 'ready', creating: false, creatingEmployee: false,
      invitation: null, reassignmentIntent: null, reassigning: false,
      notice: null, employeeProjection,
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

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      sections: {
        setup: {
          status: 'unavailable',
          message: 'Weitere Einrichtungsdaten konnten nicht sicher bestätigt werden.',
        },
      },
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

      expect(coordinator.getState()).toMatchObject({
        status: 'ready',
        sections: {
          setup: {
            status: 'unavailable',
            message: 'Weitere Einrichtungsdaten konnten nicht sicher bestätigt werden.',
          },
        },
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

  it('tombstones a pending invitation before disclosure and never restores it after return', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    const pendingInvitation = deferred<ApiResult<{
      readonly value: string;
      readonly expiresAt: string;
    }>>();
    api.createEmployeeInvitation.mockImplementationOnce(() => pendingInvitation.promise);

    const creating = coordinator.createEmployeeInvitation('Employee Pending');
    await vi.waitFor(() => expect(api.createEmployeeInvitation).toHaveBeenCalledTimes(1));
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', creatingEmployee: true, invitation: null,
    });

    coordinator.dismissInvitation();
    pendingInvitation.resolve({
      status: 'succeeded',
      value: {
        value: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        expiresAt: '2099-07-15T12:34:56.789Z',
      },
    });
    await creating;

    expect(coordinator.getState()).toMatchObject({
      status: 'ready', creatingEmployee: false, invitation: null,
    });
    await coordinator.retrySection('employees');
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', invitation: null,
    });
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

      expect(coordinator.getState()).toMatchObject({
        status: 'ready',
        sections: {
          employees: {
            status: 'unavailable',
            message: 'Weitere Beschäftigtendaten konnten nicht sicher bestätigt werden.',
          },
        },
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

  it('creates one explicit reassignment intent and retains its command ID across ambiguous retries', async () => {
    const { api, coordinator } = setup();
    const reassignmentProjection: SafeProjection = {
      ...projection,
      customers: [
        ...projection.customers,
        { id: '40000000-0000-4000-8000-000000000002', displayName: 'Lager', active: true },
      ],
      nfcTags: [{
        id: '50000000-0000-4000-8000-000000000001',
        displayName: 'Eingang',
        validationFingerprint: 'A1B2C3D4E5F6',
        assignmentState: 'assigned',
        targetCustomerId: projection.customers[0]!.id,
        activeAssignmentId: '60000000-0000-4000-8000-000000000001',
      }],
    };
    api.projection.mockResolvedValue({ status: 'succeeded', value: reassignmentProjection });
    api.reassignNfcTag
      .mockResolvedValueOnce({ status: 'unavailable' })
      .mockResolvedValueOnce({ status: 'succeeded', value: { assignmentChanged: true } });
    await coordinator.signIn('administrator@example.test', 'secret');

    coordinator.prepareReassignment(
      reassignmentProjection.nfcTags[0]!.id,
      reassignmentProjection.customers[1]!.id,
    );
    const prepared = coordinator.getState();
    expect(prepared).toMatchObject({
      status: 'ready',
      reassignmentIntent: {
        nfcTagId: reassignmentProjection.nfcTags[0]!.id,
        expectedActiveAssignmentId: reassignmentProjection.nfcTags[0]!.activeAssignmentId,
        targetCustomerId: reassignmentProjection.customers[1]!.id,
      },
    });
    const commandId = prepared.status === 'ready'
      ? prepared.reassignmentIntent!.commandId
      : '';

    await coordinator.confirmReassignment();
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      reassigning: false,
      reassignmentIntent: { commandId },
      notice: 'Zuordnung konnte nicht sicher bestätigt werden. Erneut bestätigen verwendet dieselbe Anfrage.',
    });
    await coordinator.confirmReassignment();

    expect(api.reassignNfcTag).toHaveBeenCalledTimes(2);
    expect(api.reassignNfcTag.mock.calls[0]?.[2]).toBe(commandId);
    expect(api.reassignNfcTag.mock.calls[1]?.[2]).toBe(commandId);
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      reassignmentIntent: null,
      notice: 'NFC-Tag wurde sicher neu zugeordnet.',
    });
  });

  it('does not create a reassignment intent for the current Customer', async () => {
    const { api, coordinator } = setup();
    const tagId = '50000000-0000-4000-8000-000000000001';
    const assignmentId = '60000000-0000-4000-8000-000000000001';
    api.projection.mockResolvedValue({
      status: 'succeeded',
      value: {
        ...projection,
        nfcTags: [{
          id: tagId,
          displayName: 'Eingang',
          validationFingerprint: 'A1B2C3D4E5F6',
          assignmentState: 'assigned',
          targetCustomerId: projection.customers[0]!.id,
          activeAssignmentId: assignmentId,
        }],
      },
    });
    await coordinator.signIn('administrator@example.test', 'secret');

    coordinator.prepareReassignment(tagId, projection.customers[0]!.id);

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      reassignmentIntent: null,
      notice: 'Die gewünschte Zuordnung ist nicht sicher verfügbar.',
    });
    expect(api.reassignNfcTag).not.toHaveBeenCalled();
  });

  it('destroys the reassignment intent on projection conflict and reloads authoritative data', async () => {
    const { api, coordinator } = setup();
    const targetCustomerId = '40000000-0000-4000-8000-000000000002';
    const tagId = '50000000-0000-4000-8000-000000000001';
    api.projection.mockResolvedValue({
      status: 'succeeded',
      value: {
        ...projection,
        customers: [...projection.customers, { id: targetCustomerId, displayName: 'Lager', active: true }],
        nfcTags: [{
          id: tagId,
          displayName: 'Eingang',
          validationFingerprint: 'A1B2C3D4E5F6',
          assignmentState: 'assigned',
          targetCustomerId: projection.customers[0]!.id,
          activeAssignmentId: '60000000-0000-4000-8000-000000000001',
        }],
      },
    });
    api.reassignNfcTag.mockResolvedValueOnce({ status: 'conflict', code: 'assignment_conflict' });
    await coordinator.signIn('administrator@example.test', 'secret');
    coordinator.prepareReassignment(tagId, targetCustomerId);

    await coordinator.confirmReassignment();

    expect(api.projection).toHaveBeenCalledTimes(2);
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      reassignmentIntent: null,
      notice: 'Die Zuordnung wurde zwischenzeitlich geändert. Daten wurden neu geladen.',
    });
  });

  it('shows before/after correction intent and retains one command ID across an ambiguous retry', async () => {
    const { api, coordinator } = setup();
    api.timeRecords.mockResolvedValue({
      status: 'succeeded',
      value: { items: [stoppedRecord], nextCursor: null },
    });
    api.correctTimeRecord
      .mockResolvedValueOnce({ status: 'unavailable' })
      .mockResolvedValueOnce({ status: 'succeeded', value: true });
    await coordinator.signIn('administrator@example.test', 'secret');

    coordinator.prepareCorrection(
      stoppedRecord.timeRecordId,
      '2026-07-20T08:15:00.000Z',
      '2026-07-20T10:30:00.000Z',
      'Kundennachweis geprüft',
    );
    const prepared = coordinator.getState();
    expect(prepared).toMatchObject({
      status: 'ready',
      correctionIntent: {
        timeRecord: stoppedRecord,
        startedAt: '2026-07-20T08:15:00.000Z',
        stoppedAt: '2026-07-20T10:30:00.000Z',
        reason: 'Kundennachweis geprüft',
      },
    });
    const commandId = prepared.status === 'ready' ? prepared.correctionIntent!.commandId : '';

    await coordinator.confirmCorrection();
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', correctionIntent: { commandId }, timeReviewBusy: false,
    });
    await coordinator.confirmCorrection();

    expect(api.correctTimeRecord).toHaveBeenCalledTimes(2);
    expect(api.correctTimeRecord.mock.calls.map((call) => call[2])).toEqual([commandId, commandId]);
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', correctionIntent: null,
      notice: 'Arbeitszeit wurde append-only korrigiert.',
    });
  });

  it('invalidates a pending time-bound command before a changed-zone response can apply', async () => {
    const { api, coordinator } = setup();
    api.timeRecords.mockResolvedValue({
      status: 'succeeded',
      value: { items: [stoppedRecord], nextCursor: null },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    coordinator.prepareCorrection(
      stoppedRecord.timeRecordId,
      '2026-07-20T08:15:00.000Z',
      '2026-07-20T10:30:00.000Z',
      'Kundennachweis geprüft',
    );
    const correctionResult = deferred<ApiResult<true>>();
    api.correctTimeRecord.mockImplementationOnce(() => correctionResult.promise);
    const confirming = coordinator.confirmCorrection();
    await vi.waitFor(() => expect(api.correctTimeRecord).toHaveBeenCalledOnce());

    coordinator.invalidateTimeBoundIntents();
    await vi.waitFor(() => expect(api.projection).toHaveBeenCalledTimes(2));
    correctionResult.resolve({ status: 'succeeded', value: true });
    await confirming;

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      correctionIntent: null,
      adjudicationIntent: null,
      timeReviewBusy: false,
    });
  });

  it('requires an explicit review decision and submits its exact selected evidence', async () => {
    const { api, coordinator } = setup();
    api.reviewItems.mockResolvedValue({
      status: 'succeeded',
      value: { items: [reviewItem], nextCursor: null },
    });
    await coordinator.signIn('administrator@example.test', 'secret');

    coordinator.prepareAdjudication(
      reviewItem.reviewItemId, 'no_time_record_change', null, null, null,
      'Beleg geprüft; keine Arbeitszeitänderung',
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      adjudicationIntent: { reviewItem, resolution: 'no_time_record_change' },
    });
    await coordinator.confirmAdjudication();

    expect(api.adjudicateReviewItem).toHaveBeenCalledWith(
      'memory-only-token', membershipId, expect.stringMatching(/^[0-9a-f-]{36}$/i),
      reviewItem.reviewItemId, { type: 'no_time_record_change' },
      'Beleg geprüft; keine Arbeitszeitänderung',
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', adjudicationIntent: null,
      notice: 'Review-Entscheidung wurde append-only protokolliert.',
    });
  });

  it('retains server order while loading TimeRecord pages and rejects duplicate or stuck pages', async () => {
    const { api, coordinator } = setup();
    const nextRecord: SafeTimeRecord = {
      ...stoppedRecord,
      timeRecordId: '90000000-0000-4000-8000-000000000003',
      startedAt: '2026-07-20T11:00:00.000Z',
      stoppedAt: '2026-07-20T12:00:00.000Z',
    };
    api.timeRecords.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [stoppedRecord], nextCursor: 'time_page_2' },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    api.timeRecords.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [nextRecord], nextCursor: 'time_page_3' },
    });

    await coordinator.loadMoreTimeRecords();

    expect(api.timeRecords).toHaveBeenLastCalledWith(
      'memory-only-token',
      membershipId,
      readyTimeReviewState.timeWindow.fromInclusive,
      readyTimeReviewState.timeWindow.toExclusive,
      'time_page_2',
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      timeRecords: [stoppedRecord, nextRecord],
      timeRecordsNextCursor: 'time_page_3',
      sections: { timeRecords: { status: 'ready' } },
    });

    api.timeRecords.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [nextRecord], nextCursor: 'time_page_3' },
    });
    await coordinator.loadMoreTimeRecords();
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      timeRecords: [stoppedRecord, nextRecord],
      sections: {
        timeRecords: {
          status: 'unavailable',
          message: 'Die nächste Seite konnte nicht in bestätigter Reihenfolge übernommen werden.',
        },
      },
    });
  });

  it('loads Review pages independently and contains a page failure to Review state', async () => {
    const { api, coordinator } = setup();
    const nextReviewItem: SafeReviewItem = {
      ...reviewItem,
      reviewItemId: '90000000-0000-4000-8000-000000000004',
      deviceSequence: 8,
    };
    api.reviewItems.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [reviewItem], nextCursor: 'review_page_2' },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    api.reviewItems.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [nextReviewItem], nextCursor: null },
    });

    await coordinator.loadMoreReviewItems();

    expect(api.reviewItems).toHaveBeenLastCalledWith(
      'memory-only-token', membershipId, 'review_page_2',
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      reviewItems: [reviewItem, nextReviewItem],
      reviewItemsNextCursor: null,
      sections: { reviewItems: { status: 'ready' } },
    });
  });

  it('keeps successful sections usable when one authenticated read area is unavailable', async () => {
    const { api, coordinator } = setup();
    api.reviewItems.mockResolvedValueOnce({ status: 'unavailable' });

    await coordinator.signIn('administrator@example.test', 'secret');

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      projection,
      employeeProjection,
      sections: {
        setup: { status: 'ready' },
        employees: { status: 'ready' },
        timeRecords: { status: 'ready' },
        reviewItems: {
          status: 'unavailable',
          message: 'Review-Evidence ist derzeit nicht erreichbar.',
        },
      },
    });
    api.reviewItems.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [reviewItem], nextCursor: null },
    });
    await coordinator.retrySection('reviewItems');
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      reviewItems: [reviewItem],
      sections: { reviewItems: { status: 'ready' } },
    });
  });

  it('discards an older refresh after a newer refresh for the same Membership completes', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    const lateProjection = deferred<ApiResult<SafeProjection>>();
    api.projection
      .mockImplementationOnce(() => lateProjection.promise)
      .mockResolvedValueOnce({
        status: 'succeeded',
        value: {
          ...projection,
          customers: [{
            id: '40000000-0000-4000-8000-000000000009',
            displayName: 'Neuester Stand',
            active: true,
          }],
        },
      });

    const older = coordinator.refresh();
    await vi.waitFor(() => expect(api.projection).toHaveBeenCalledTimes(2));
    const newer = coordinator.refresh();
    await newer;
    lateProjection.resolve({
      status: 'succeeded',
      value: {
        ...projection,
        customers: [{
          id: '40000000-0000-4000-8000-000000000008',
          displayName: 'Veralteter Stand',
          active: true,
        }],
      },
    });
    await older;

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      projection: {
        customers: [{ displayName: 'Neuester Stand' }],
      },
    });
  });

  it('contains a thrown refresh area while keeping every successful section usable', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    api.reviewItems.mockRejectedValueOnce(new Error('synthetic read failure'));

    await coordinator.refresh();

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      sections: {
        setup: { status: 'ready' },
        employees: { status: 'ready' },
        timeRecords: { status: 'ready' },
        reviewItems: {
          status: 'unavailable',
          message: 'Review-Evidence ist derzeit nicht erreichbar.',
        },
      },
    });
  });

  it.each(['setup', 'employees'] as const)(
    'establishes a safe initial ready state when only the %s Organization projection succeeds',
    async (succeededSection) => {
      const { api, coordinator } = setup();
      if (succeededSection === 'setup') {
        api.employeeProjection.mockRejectedValueOnce(new Error('employee projection unavailable'));
      } else {
        api.projection.mockRejectedValueOnce(new Error('setup projection unavailable'));
      }

      await coordinator.signIn('administrator@example.test', 'secret');

      expect(coordinator.getState()).toMatchObject({
        status: 'ready',
        projection: { organization: projection.organization },
        employeeProjection: { organization: projection.organization },
        sections: {
          setup: succeededSection === 'setup'
            ? { status: 'ready' }
            : { status: 'unavailable', message: 'Einrichtungsdaten sind derzeit nicht erreichbar.' },
          employees: succeededSection === 'employees'
            ? { status: 'ready' }
            : { status: 'unavailable', message: 'Beschäftigtendaten sind derzeit nicht erreichbar.' },
        },
      });
    },
  );

  it('drops stale Customer and invitation results after a newer full refresh', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    const customerResult = deferred<ApiResult<true>>();
    api.createCustomer.mockImplementationOnce(() => customerResult.promise);
    const creatingCustomer = coordinator.createCustomer('Veralteter Kunde');
    await vi.waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1));
    await coordinator.refresh();
    customerResult.resolve({ status: 'succeeded', value: true });
    await creatingCustomer;
    expect(api.projection).toHaveBeenCalledTimes(2);
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', creating: false, notice: null,
    });

    const invitationResult = deferred<ApiResult<{
      readonly value: string;
      readonly expiresAt: string;
    }>>();
    api.createEmployeeInvitation.mockImplementationOnce(() => invitationResult.promise);
    const creatingInvitation = coordinator.createEmployeeInvitation('Veraltete Einladung');
    await vi.waitFor(() => expect(api.createEmployeeInvitation).toHaveBeenCalledTimes(1));
    await coordinator.refresh();
    invitationResult.resolve({
      status: 'succeeded',
      value: {
        value: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
        expiresAt: '2099-07-15T12:34:56.789Z',
      },
    });
    await creatingInvitation;
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', creatingEmployee: false, invitation: null, notice: null,
    });
  });

  it('drops stale reassignment, correction and adjudication results after newer refreshes', async () => {
    const targetCustomer = {
      id: '40000000-0000-4000-8000-000000000002',
      displayName: 'Lager',
      active: true,
    };
    const assignedProjection: SafeProjection = {
      ...projection,
      customers: [...projection.customers, targetCustomer],
      nfcTags: [{
        id: '50000000-0000-4000-8000-000000000001',
        displayName: 'Eingang',
        validationFingerprint: 'A1B2C3D4E5F6',
        assignmentState: 'assigned',
        targetCustomerId: projection.customers[0]!.id,
        activeAssignmentId: '60000000-0000-4000-8000-000000000001',
      }],
    };
    const { api, coordinator } = setup();
    api.projection.mockResolvedValue({ status: 'succeeded', value: assignedProjection });
    api.timeRecords.mockResolvedValue({
      status: 'succeeded',
      value: { items: [stoppedRecord], nextCursor: null },
    });
    api.reviewItems.mockResolvedValue({
      status: 'succeeded',
      value: { items: [reviewItem], nextCursor: null },
    });
    await coordinator.signIn('administrator@example.test', 'secret');

    coordinator.prepareReassignment(
      assignedProjection.nfcTags[0]!.id,
      targetCustomer.id,
    );
    const reassignmentResult = deferred<ApiResult<{ readonly assignmentChanged: boolean }>>();
    api.reassignNfcTag.mockImplementationOnce(() => reassignmentResult.promise);
    const reassigning = coordinator.confirmReassignment();
    await vi.waitFor(() => expect(api.reassignNfcTag).toHaveBeenCalledTimes(1));
    await coordinator.refresh();
    reassignmentResult.resolve({ status: 'succeeded', value: { assignmentChanged: true } });
    await reassigning;
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', reassignmentIntent: null, reassigning: false, notice: null,
    });

    coordinator.prepareCorrection(
      stoppedRecord.timeRecordId,
      '2026-07-20T08:15:00.000Z',
      '2026-07-20T10:15:00.000Z',
      'Synthetische Korrekturbegründung',
    );
    const correctionResult = deferred<ApiResult<true>>();
    api.correctTimeRecord.mockImplementationOnce(() => correctionResult.promise);
    const correcting = coordinator.confirmCorrection();
    await vi.waitFor(() => expect(api.correctTimeRecord).toHaveBeenCalledTimes(1));
    await coordinator.refresh();
    correctionResult.resolve({ status: 'succeeded', value: true });
    await correcting;
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', correctionIntent: null, timeReviewBusy: false, notice: null,
    });

    coordinator.prepareAdjudication(
      reviewItem.reviewItemId,
      'no_time_record_change',
      null,
      null,
      null,
      'Synthetische Reviewbegründung',
    );
    const adjudicationResult = deferred<ApiResult<true>>();
    api.adjudicateReviewItem.mockImplementationOnce(() => adjudicationResult.promise);
    const adjudicating = coordinator.confirmAdjudication();
    await vi.waitFor(() => expect(api.adjudicateReviewItem).toHaveBeenCalledTimes(1));
    await coordinator.refresh();
    adjudicationResult.resolve({ status: 'succeeded', value: true });
    await adjudicating;
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', adjudicationIntent: null, timeReviewBusy: false, notice: null,
    });
  });

  it('binds retry and export to the newest attempted rolling window after a partial refresh', async () => {
    const auth = new FakeAuth();
    const api = new FakeApi();
    let currentNow = fixedNow;
    const coordinator = new AdminWebCoordinator(auth, api, () => currentNow);
    await coordinator.signIn('administrator@example.test', 'secret');
    currentNow += 2 * 24 * 60 * 60 * 1_000;
    const newestWindow = {
      fromInclusive: '2026-06-22T12:00:00.000Z',
      toExclusive: '2026-07-23T12:00:00.000Z',
    };
    api.timeRecords.mockResolvedValueOnce({ status: 'unavailable' });

    await coordinator.refresh();

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      timeWindow: newestWindow,
      sections: {
        timeRecords: {
          status: 'unavailable',
          message: 'Arbeitszeiten sind derzeit nicht erreichbar.',
        },
      },
    });
    api.timeRecords.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [stoppedRecord], nextCursor: null },
    });
    await coordinator.retrySection('timeRecords');
    expect(api.timeRecords).toHaveBeenLastCalledWith(
      'memory-only-token',
      membershipId,
      newestWindow.fromInclusive,
      newestWindow.toExclusive,
      null,
    );

    api.exportTimeEntries.mockResolvedValueOnce({ status: 'unavailable' });
    await coordinator.exportTimeRecords();
    expect(api.exportTimeEntries).toHaveBeenLastCalledWith(
      'memory-only-token',
      membershipId,
      newestWindow.fromInclusive,
      newestWindow.toExclusive,
    );
  });

  it('does not download or announce a stale export response after a newer refresh', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    const exportResult = deferred<ApiResult<{ readonly blob: Blob; readonly filename: string }>>();
    api.exportTimeEntries.mockImplementationOnce(() => exportResult.promise);
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');

    const exporting = coordinator.exportTimeRecords();
    await vi.waitFor(() => expect(api.exportTimeEntries).toHaveBeenCalledTimes(1));
    await coordinator.refresh();
    exportResult.resolve({
      status: 'succeeded',
      value: {
        blob: new Blob(['stale']),
        filename: 'taptime-time-entries_20260721T000000Z_20260722T000000Z.csv',
      },
    });
    await exporting;

    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(coordinator.getState()).toMatchObject({
      status: 'ready', timeReviewBusy: false, notice: null,
    });
    createObjectUrl.mockRestore();
  });
});
