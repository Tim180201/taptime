import { describe, expect, it, vi } from 'vitest';
import type { AdminWebApiPort, ApiResult, Session } from '../src/AdminWebApiClient';
import {
  AdminWebCoordinator,
  SIGN_IN_FAILURE_NOTICES,
  type AdminWebAuthPort,
  type AdminWebSignInOutcome,
} from '../src/AdminWebCoordinator';
import type { SafeEmployeeProjection, SafeProjection, SafeReviewItem, SafeTimeRecord } from '../src/contracts';

const membershipId = '20000000-0000-4000-8000-000000000001';
const administratorSession: Session = {
  role: 'administrator',
  membershipId,
  organizationId: '30000000-0000-4000-8000-000000000001',
  locationsEnabled: false,
  availableSections: ['setup', 'employees', 'time_records', 'time_export', 'review_items'],
  managementScope: { kind: 'organization' },
};
const projection: SafeProjection = {
  organization: { id: '30000000-0000-4000-8000-000000000001', name: 'TapTim.e' },
  customers: [{ id: '40000000-0000-4000-8000-000000000001', displayName: 'Werkstatt', active: true }],
  nfcTags: [],
  nextCursor: null,
  customersComplete: true,
  nfcTagsComplete: true,
};
const employeeProjection: SafeEmployeeProjection = {
  organization: projection.organization,
  employeeMemberships: [],
  nextCursor: null,
};
const fixedNow = Date.parse('2026-07-21T12:00:00.000Z');
const readyTimeReviewState = {
  membershipId,
  role: 'administrator',
  assignableLocations: [],
  locationSetup: null,
  locationSetupBusy: false,
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
  locationsEnabled: false,
  availableSections: ['setup', 'employees', 'time_records', 'time_export', 'review_items'],
  managementScope: { kind: 'organization' as const },
  selectedLocation: null,
  timeWindow: {
    fromInclusive: '2026-06-20T12:00:00.000Z',
    toExclusive: '2026-07-21T12:00:00.000Z',
  },
  timeReviewBusy: false,
  correctionIntent: null,
  adjudicationIntent: null,
  completedAction: null,
} as const;
const stoppedRecord: SafeTimeRecord = {
  timeRecordId: '90000000-0000-4000-8000-000000000001',
  employeeDisplayName: 'Employee Alpha', targetType: 'customer',
  targetDisplayName: 'Werkstatt', startedVia: 'nfc', stoppedVia: 'nfc',
  source: 'canonical', status: 'stopped',
  startedAt: '2026-07-20T08:00:00.000Z', stoppedAt: '2026-07-20T10:00:00.000Z',
  baseRowVersion: 1, effectiveRevisionNumber: 0, overlapsAnotherRecord: false,
};
const reviewItem: SafeReviewItem = {
  reviewItemId: '90000000-0000-4000-8000-000000000002',
  source: 'offline_v2', employeeDisplayName: 'Employee Alpha',
  targetType: 'customer', targetDisplayName: 'Werkstatt', triggerType: 'nfc',
  occurredAt: '2026-07-20T11:00:00.000Z',
  reviewReason: 'automatic_window_elapsed', deviceSequence: 7, predecessorBlocked: true,
};

function employeeMemberships(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `70000000-0000-4000-8000-${(start + index).toString().padStart(12, '0')}`,
    displayName: `Employee ${start + index}`,
    role: 'employee' as const,
    active: true as const,
    rowVersion: 1,
    location: null,
  }));
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((done) => { resolve = done; });
  return { promise, resolve };
}

class FakeAuth implements AdminWebAuthPort {
  active = false;
  readonly signIn = vi.fn<AdminWebAuthPort['signIn']>(async () => { this.active = true; return 'signed_in'; });
  readonly signOut = vi.fn<AdminWebAuthPort['signOut']>(async () => { this.active = false; });
  readonly requestPasswordReset = vi.fn(async () => true);
  readonly updateRecoveredPassword = vi.fn(async () => true);
  private readonly recoveryListeners = new Set<() => void>();

  subscribePasswordRecovery(listener: () => void): () => void {
    this.recoveryListeners.add(listener);
    return () => this.recoveryListeners.delete(listener);
  }

  emitPasswordRecovery(): void {
    this.active = true;
    for (const listener of this.recoveryListeners) listener();
  }

  async withAccessToken<Value>(operation: (accessToken: string) => Promise<Value>): Promise<Value | null> {
    return this.active ? operation('memory-only-token') : null;
  }
}

class FakeApi implements AdminWebApiPort {
  readonly recordPasswordReset = vi.fn<AdminWebApiPort['recordPasswordReset']>(async () => ({
    status: 'succeeded', value: true,
  }));
  readonly session = vi.fn<AdminWebApiPort['session']>(async () => ({
    status: 'succeeded', value: administratorSession,
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
  readonly revokeMembership = vi.fn<AdminWebApiPort['revokeMembership']>(async () => ({
    status: 'succeeded', value: true,
  }));
  readonly changeMembershipRole = vi.fn<AdminWebApiPort['changeMembershipRole']>(async () => ({
    status: 'succeeded', value: true,
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
  readonly projects = vi.fn<NonNullable<AdminWebApiPort['projects']>>(async () => ({
    status: 'succeeded',
    value: { items: [], nextCursor: null },
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
  it('moves only an explicit provider recovery into password replacement and signs out afterward', async () => {
    const { auth, api, coordinator } = setup();
    auth.emitPasswordRecovery();
    expect(coordinator.getState()).toEqual({
      status: 'password_recovery', completing: false, notice: null,
    });
    await coordinator.completePasswordRecovery('new-memory-secret');
    expect(auth.updateRecoveredPassword).toHaveBeenCalledWith('new-memory-secret');
    expect(api.recordPasswordReset).toHaveBeenCalledWith('memory-only-token');
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(coordinator.getState()).toEqual({
      status: 'signed_out',
      notice: 'Das Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.',
    });
  });

  it('keeps recovery authority when the mandatory password-reset audit cannot be recorded', async () => {
    const { auth, api, coordinator } = setup();
    api.recordPasswordReset.mockResolvedValueOnce({ status: 'unreachable' });
    auth.emitPasswordRecovery();

    await coordinator.completePasswordRecovery('new-memory-secret');

    expect(auth.signOut).not.toHaveBeenCalled();
    expect(coordinator.getState()).toEqual({
      status: 'password_recovery', completing: false,
      notice: 'Das Passwort wurde geändert, der Abschluss konnte aber nicht protokolliert werden. Die sichere Bestätigung durch den Server fehlt. Bestätigen Sie die Änderung erneut.',
    });
  });

  it('rejects a session without an open section and never loads setup data', async () => {
    const { auth, api, coordinator } = setup();
    api.session.mockResolvedValueOnce({
      status: 'succeeded', value: { ...administratorSession, availableSections: [] },
    });

    await coordinator.signIn('employee@example.test', 'secret');

    expect(coordinator.getState()).toEqual({
      status: 'forbidden',
      message: 'Für diesen Zugang ist derzeit kein Verwaltungsbereich geöffnet. Wenden Sie sich an die Betriebsverwaltung, wenn Sie hier arbeiten sollen.',
    });
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.active).toBe(false);
    expect(api.projection).not.toHaveBeenCalled();
  });

  it('loads only the sections named by the session and applies the selected Location', async () => {
    const { api, coordinator } = setup();
    const location = { id: '31000000-0000-4000-8000-000000000001', name: 'Berlin' };
    api.session.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        ...administratorSession,
        locationsEnabled: true,
        availableSections: ['employees'],
        managementScope: { kind: 'locations', locations: [location] },
      },
    });
    api.employeeProjection.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        ...employeeProjection,
        employeeMemberships: [{
          id: '70000000-0000-4000-8000-000000000001',
          displayName: 'Employee Alpha',
          role: 'employee',
          active: true,
          rowVersion: 1,
          location,
        }],
      },
    });
    await coordinator.selectLocation(location.id);

    await coordinator.signIn('leitung@example.test', 'secret');

    expect(api.employeeProjection).toHaveBeenCalledWith(
      'memory-only-token', membershipId, null, location.id,
    );
    expect(api.projection).not.toHaveBeenCalled();
    expect(api.timeRecords).not.toHaveBeenCalled();
    expect(api.reviewItems).not.toHaveBeenCalled();
    expect(api.projects).not.toHaveBeenCalled();
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      availableSections: ['employees'],
      selectedLocation: location,
      sections: {
        setup: { status: 'closed' },
        employees: { status: 'ready' },
        timeRecords: { status: 'closed' },
        reviewItems: { status: 'closed' },
      },
    });
  });

  it('keeps the current Location and explains a server-rejected foreign Location', async () => {
    const { api, coordinator } = setup();
    const location = { id: '31000000-0000-4000-8000-000000000001', name: 'Berlin' };
    api.session.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        ...administratorSession,
        locationsEnabled: true,
        availableSections: ['employees'],
        managementScope: { kind: 'locations', locations: [location] },
      },
    });
    api.employeeProjection.mockResolvedValueOnce({
      status: 'succeeded', value: { ...employeeProjection, employeeMemberships: [] },
    });
    await coordinator.signIn('leitung@example.test', 'secret');
    api.employeeProjection.mockResolvedValueOnce({
      status: 'conflict', code: 'location_scope_forbidden',
    });
    const foreignLocationId = '31000000-0000-4000-8000-000000000002';

    await coordinator.selectLocation(foreignLocationId);

    expect(api.employeeProjection).toHaveBeenLastCalledWith(
      'memory-only-token', membershipId, null, foreignLocationId,
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      selectedLocation: location,
      notice: 'Der angeforderte Standort gehört nicht zu Ihren Verwaltungsstandorten. Der bisherige Standort bleibt geöffnet.',
    });
  });

  it('tries a bookmarked foreign Location through the server before opening the first available Location', async () => {
    const { api, coordinator } = setup();
    const location = { id: '31000000-0000-4000-8000-000000000001', name: 'Berlin' };
    const foreignLocationId = '31000000-0000-4000-8000-000000000002';
    api.session.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        ...administratorSession,
        locationsEnabled: true,
        availableSections: ['employees'],
        managementScope: { kind: 'locations', locations: [location] },
      },
    });
    api.employeeProjection
      .mockResolvedValueOnce({ status: 'conflict', code: 'location_scope_forbidden' })
      .mockResolvedValueOnce({
        status: 'succeeded', value: { ...employeeProjection, employeeMemberships: [] },
      });
    await coordinator.selectLocation(foreignLocationId);

    await coordinator.signIn('leitung@example.test', 'secret');

    expect(api.employeeProjection).toHaveBeenNthCalledWith(
      1, 'memory-only-token', membershipId, null, foreignLocationId,
    );
    expect(api.employeeProjection).toHaveBeenNthCalledWith(
      2, 'memory-only-token', membershipId, null, location.id,
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      selectedLocation: location,
      notice: 'Der angeforderte Standort gehört nicht zu Ihren Verwaltungsstandorten. Stattdessen wurde Ihr erster verfügbarer Standort geöffnet.',
    });
  });

  it('clears a late successful sign-in after sign-out instead of retaining a hidden session', async () => {
    const { auth, api, coordinator } = setup();
    const lateSignIn = deferred<AdminWebSignInOutcome>();
    auth.signIn.mockImplementationOnce(async () => {
      const outcome = await lateSignIn.promise;
      auth.active = outcome === 'signed_in';
      return outcome;
    });

    const signingIn = coordinator.signIn('administrator@example.test', 'secret');
    const signingOut = coordinator.signOut();
    expect(coordinator.getState()).toEqual({ status: 'signed_out' });

    lateSignIn.resolve('signed_in');
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
    staleSession.resolve({ status: 'succeeded', value: administratorSession });
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
      completedAction: 'customer_created',
    });
  });

  it('invalidates and signs out a ready session after an authority-rejected refresh', async () => {
    const { auth, api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    api.projection.mockResolvedValueOnce({ status: 'rejected' });

    await coordinator.refresh();

    expect(coordinator.getState()).toEqual({
      status: 'unavailable',
      message: 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.',
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
      status: 'unavailable',
      message: 'Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um weiterzuarbeiten.',
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
        customersComplete: true,
        nfcTagsComplete: true,
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
        customersComplete: true,
        nfcTagsComplete: true,
      },
    });
  });

  it('loads and merges one bounded Project page without replacing prior rows', async () => {
    const { api, coordinator } = setup();
    const cursor = 'v1:p:80000000-0000-4000-8000-000000000001';
    const first = {
      projectId: '80000000-0000-4000-8000-000000000001',
      displayName: 'Innenausbau',
      active: true,
      rowVersion: 1,
    } as const;
    const second = {
      projectId: '80000000-0000-4000-8000-000000000002',
      displayName: 'Montage Nord',
      active: true,
      rowVersion: 1,
    } as const;
    api.projects.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [first], nextCursor: cursor },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    await coordinator.refreshProjects();
    api.projects.mockResolvedValueOnce({
      status: 'succeeded',
      value: { items: [second], nextCursor: null },
    });

    await coordinator.loadMoreProjects();

    expect(api.projects).toHaveBeenLastCalledWith('memory-only-token', membershipId, cursor);
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      projects: [first, second],
      projectsNextCursor: null,
      projectBusy: false,
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
          message: 'Weitere Einrichtungsdaten konnten nicht übernommen werden. Die Reihenfolge der geladenen Seiten ist widersprüchlich. Laden Sie den Bereich erneut.',
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
        customersComplete: true,
        nfcTagsComplete: true,
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
            message: 'Weitere Einrichtungsdaten konnten nicht übernommen werden. Die Reihenfolge der geladenen Seiten ist widersprüchlich. Laden Sie den Bereich erneut.',
          },
        },
      });
    }
  });

  it('holds an invitation secret only in the ready generation and clears it on sign-out', async () => {
    const { auth, api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');

    await coordinator.createEmployeeInvitation('Employee Alpha', 'employee');

    expect(api.createEmployeeInvitation).toHaveBeenCalledWith(
      'memory-only-token',
      membershipId,
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
      'Employee Alpha',
      'employee',
      undefined,
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      invitation: {
        value: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        expiresAt: '2099-07-15T12:34:56.789Z',
      },
      creatingEmployee: false,
      completedAction: 'invitation_created',
    });

    await coordinator.signOut();

    expect(coordinator.getState()).toEqual({ status: 'signed_out' });
    expect(auth.active).toBe(false);
  });

  it('loads the complete Location setup before exposing activation gaps', async () => {
    const { api, coordinator } = setup();
    const assignableLocations = vi.fn<NonNullable<AdminWebApiPort['assignableLocations']>>(
      async () => ({ status: 'succeeded', value: {
        items: [{ id: '91000000-0000-4000-8000-000000000001', name: 'Berlin' }],
        nextCursor: null,
      } }),
    );
    const locationSetupPage = vi.fn<NonNullable<AdminWebApiPort['locationSetupPage']>>(
      async (_token, _membershipId, kind) => ({
        status: 'succeeded',
        value: {
          locationsEnabled: false,
          items: kind === 'locations'
            ? [{ id: '91000000-0000-4000-8000-000000000001', displayName: 'Berlin',
                active: true, rowVersion: 1 }]
            : kind === 'activation_gaps'
              ? [{ kind: 'membership', id: membershipId, displayName: 'Administrator Anna' }]
              : [],
          nextCursor: null,
        },
      }),
    );
    Object.assign(api, { assignableLocations, locationSetupPage });

    await coordinator.signIn('administrator@example.test', 'secret');

    expect(assignableLocations).toHaveBeenCalledWith('memory-only-token', membershipId, null);
    expect(locationSetupPage).toHaveBeenCalledTimes(4);
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      assignableLocations: [{ id: '91000000-0000-4000-8000-000000000001', name: 'Berlin' }],
      locationSetup: {
        locations: [{ displayName: 'Berlin', active: true }],
        memberships: [],
        workTargets: [],
        activationGaps: [{ kind: 'membership', displayName: 'Administrator Anna' }],
      },
      locationSetupBusy: false,
    });
  });

  it('never restores a once-disclosed secret on refresh or command replay conflict', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    await coordinator.createEmployeeInvitation('Employee Alpha', 'employee');
    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: expect.any(Object) });

    await coordinator.refresh();

    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: null });
    api.createEmployeeInvitation.mockResolvedValueOnce({
      status: 'conflict', code: 'invitation_created_token_unavailable',
    });
    await coordinator.createEmployeeInvitation('Employee Alpha', 'employee');
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      invitation: null,
      notice: 'Die Einladung wurde bereits erzeugt. Ihr Geheimnis kann aus Sicherheitsgründen nicht erneut angezeigt werden. Erzeugen Sie bei Bedarf eine neue Einladung.',
    });
  });

  it('revokes a projected Membership with its row version and refreshes former-member truth', async () => {
    const { api, coordinator } = setup();
    const membership = employeeMemberships(1, 1)[0]!;
    api.employeeProjection.mockResolvedValueOnce({
      status: 'succeeded', value: { ...employeeProjection, employeeMemberships: [membership] },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    api.employeeProjection.mockResolvedValueOnce({
      status: 'succeeded', value: {
        ...employeeProjection,
        employeeMemberships: [{ ...membership, active: false, rowVersion: 2 }],
      },
    });

    await coordinator.revokeMembership(membership.id, 1);

    expect(api.revokeMembership).toHaveBeenCalledWith(
      'memory-only-token', membershipId, expect.any(String), membership.id, 1,
    );
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      employeeProjection: { employeeMemberships: [{ active: false, rowVersion: 2 }] },
      notice: 'Zugang wurde entzogen.',
    });
  });

  it('never restores a once-disclosed secret after setup pagination leaves the ready screen', async () => {
    const { api, coordinator } = setup();
    const cursor = 'v1:c:40000000-0000-4000-8000-000000000001';
    api.projection.mockResolvedValueOnce({
      status: 'succeeded', value: { ...projection, nextCursor: cursor },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    await coordinator.createEmployeeInvitation('Employee Alpha', 'employee');
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
        customersComplete: true,
        nfcTagsComplete: true,
      },
    });

    await coordinator.loadMore();

    expect(coordinator.getState()).toMatchObject({ status: 'ready', invitation: null });
  });

  it('tombstones a dismissed secret against a later Employee-pagination completion', async () => {
    const { api, coordinator } = setup();
    const firstPage = employeeMemberships(1, 20);
    const cursor = `v1:m:${firstPage.at(-1)!.id}`;
    api.employeeProjection.mockResolvedValueOnce({
      status: 'succeeded',
      value: {
        organization: projection.organization,
        employeeMemberships: firstPage,
        nextCursor: cursor,
      },
    });
    await coordinator.signIn('administrator@example.test', 'secret');
    await coordinator.createEmployeeInvitation('Employee Alpha', 'employee');
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
    await coordinator.createEmployeeInvitation('Employee Alpha', 'employee');
    const pendingCustomer = deferred<ApiResult<true>>();
    api.createCustomer.mockImplementationOnce(() => pendingCustomer.promise);

    const creating = coordinator.createCustomer('Werkstatt Zwei');
    await vi.waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1));
    coordinator.dismissInvitation();
    pendingCustomer.resolve({ status: 'unreachable' });
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

    const creating = coordinator.createEmployeeInvitation('Employee Pending', 'employee');
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
    const cursor = `v1:m:${firstPage.at(-1)!.id}`;
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
        nextCursor: `v1:m:${nextPage[18]!.id}`,
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
            message: 'Weitere Beschäftigte konnten nicht übernommen werden. Die Reihenfolge der geladenen Seiten ist widersprüchlich. Laden Sie den Bereich erneut.',
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
      status: 'unavailable',
      message: 'Die Anmeldung konnte nicht abgeschlossen werden. Der Anmeldedienst ist derzeit nicht erreichbar. Versuchen Sie es später erneut.',
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
        assignmentType: 'work',
        targetCustomerId: projection.customers[0]!.id,
        activeAssignmentId: '60000000-0000-4000-8000-000000000001',
      }],
    };
    api.projection.mockResolvedValue({ status: 'succeeded', value: reassignmentProjection });
    api.reassignNfcTag
      .mockResolvedValueOnce({ status: 'unreachable' })
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
      notice: 'Der NFC-Tag konnte nicht neu zugeordnet werden. Der Server hat den Vorgang nicht bestätigt. Versuchen Sie es erneut; dieselbe Anfrage wird sicher weiterverwendet.',
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
          assignmentType: 'work',
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
      notice: 'Die Zuordnung kann nicht vorbereitet werden. Der NFC-Tag oder das Arbeitsziel ist nicht mehr verfügbar. Laden Sie die Einrichtung neu und wählen Sie erneut.',
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
          assignmentType: 'work',
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
      notice: 'Der NFC-Tag konnte nicht neu zugeordnet werden. Die Zuordnung wurde zwischenzeitlich geändert. Prüfen Sie die neu geladenen Daten und versuchen Sie es erneut.',
    });
  });

  it('shows before/after correction intent and retains one command ID across an ambiguous retry', async () => {
    const { api, coordinator } = setup();
    api.timeRecords.mockResolvedValue({
      status: 'succeeded',
      value: { items: [stoppedRecord], nextCursor: null },
    });
    api.correctTimeRecord
      .mockResolvedValueOnce({ status: 'unreachable' })
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
      notice: 'Die Arbeitszeit wurde korrigiert. Die ursprüngliche Fassung bleibt lückenlos erhalten.',
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
      notice: 'Die Prüfentscheidung wurde lückenlos protokolliert.',
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
          message: 'Weitere Daten konnten nicht übernommen werden. Die Reihenfolge der geladenen Seiten ist widersprüchlich. Laden Sie den Bereich erneut.',
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
    api.reviewItems.mockResolvedValueOnce({ status: 'unreachable' });

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
          message: 'Die offenen Prüfungen konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.',
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

  it('reports a reachable but unusable setup response without claiming the service is down',
    async () => {
      const { api, coordinator } = setup();
      api.projection.mockResolvedValueOnce({ status: 'invalid_response' });

      await coordinator.signIn('administrator@example.test', 'secret');

      expect(coordinator.getState()).toMatchObject({
        status: 'ready',
        sections: {
          setup: {
            status: 'unavailable',
            message: 'Die Einrichtung konnte nicht übernommen werden. Die Antwort des Dienstes ist nicht verwertbar. Laden Sie den Bereich erneut.',
          },
          employees: { status: 'ready' },
        },
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
          message: 'Die offenen Prüfungen konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.',
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
            : {
                status: 'unavailable',
                message: 'Die Einrichtung konnte nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.',
              },
          employees: succeededSection === 'employees'
            ? { status: 'ready' }
            : {
                status: 'unavailable',
                message: 'Die Beschäftigten konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.',
              },
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
    const creatingInvitation = coordinator.createEmployeeInvitation('Veraltete Einladung', 'employee');
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
        assignmentType: 'work',
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

  it('passes the complete Berlin October unchanged to time records and payroll export', async () => {
    const { api, coordinator } = setup();
    await coordinator.signIn('administrator@example.test', 'secret');
    const from = '2026-09-30T22:00:00.000Z';
    const to = '2026-10-31T23:00:00.000Z';
    await coordinator.setTimeWindow(from, to);
    expect(coordinator.getState()).toMatchObject({
      timeWindow: { fromInclusive: from, toExclusive: to },
    });
    expect(api.timeRecords).toHaveBeenLastCalledWith(
      'memory-only-token', membershipId, from, to, null,
    );
    api.exportTimeEntries.mockResolvedValueOnce({ status: 'unreachable' });
    await coordinator.exportTimeRecords();
    expect(api.exportTimeEntries).toHaveBeenLastCalledWith(
      'memory-only-token', membershipId, from, to,
    );
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
    api.timeRecords.mockResolvedValueOnce({ status: 'unreachable' });

    await coordinator.refresh();

    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      timeWindow: newestWindow,
      sections: {
        timeRecords: {
          status: 'unavailable',
          message: 'Die Arbeitszeiten konnten nicht abgerufen werden. Der Dienst ist derzeit nicht erreichbar. Laden Sie den Bereich erneut.',
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

    api.exportTimeEntries.mockResolvedValueOnce({ status: 'unreachable' });
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

describe('T-040 sign-in names its cause', () => {
  const failures: readonly Exclude<AdminWebSignInOutcome, 'signed_in'>[] = [
    'credentials_rejected', 'email_not_confirmed', 'access_blocked', 'rate_limited', 'service_unavailable',
  ];

  it.each(failures)('shows the notice for %s and never a session', async (outcome) => {
    const { auth, api, coordinator } = setup();
    auth.signIn.mockImplementationOnce(async () => outcome);

    await coordinator.signIn('administrator@example.test', 'secret');

    expect(coordinator.getState()).toEqual({ status: 'signed_out', notice: SIGN_IN_FAILURE_NOTICES[outcome] });
    expect(api.session).not.toHaveBeenCalled();
  });

  it('never blames the password when the sign-in service did not answer', async () => {
    // Counter-proof for the paused-project incident: before T-040 every failure read as a
    // wrong password. An outage must say the inputs were not checked.
    const { auth, coordinator } = setup();
    auth.signIn.mockImplementationOnce(async () => 'service_unavailable');

    await coordinator.signIn('administrator@example.test', 'secret');

    const state = coordinator.getState();
    expect(state.status).toBe('signed_out');
    const notice = state.status === 'signed_out' ? state.notice ?? '' : '';
    expect(notice).not.toContain('Passwort');
    expect(notice).toContain('nicht geprüft');
  });

  it('keeps every failure notice distinct so a support call can tell them apart', () => {
    const notices = failures.map((outcome) => SIGN_IN_FAILURE_NOTICES[outcome]);
    expect(new Set(notices).size).toBe(failures.length);
  });
});

it('T049 a: opens a live employee session without loading any administration projection', async () => {
  const {api,coordinator}=setup();
  api.session.mockResolvedValue({status:'succeeded',value:{...administratorSession,
    role:'employee',availableSections:['own_time','manual_capture'],managementScope:{kind:'locations',locations:[]}}});
  await coordinator.signIn('employee@example.test','password');
  expect(coordinator.getState()).toMatchObject({status:'ready',role:'employee',availableSections:['own_time','manual_capture']});
  expect(api.projection).not.toHaveBeenCalled();
  expect(api.employeeProjection).not.toHaveBeenCalled();
  expect(api.reviewItems).not.toHaveBeenCalled();
});

it('T049 manual: retries uncertain acknowledgement with exactly the same event and receipt', async () => {
  const auth = new FakeAuth();
  const api = new FakeApi();
  api.session.mockResolvedValue({status:'succeeded',value:{...administratorSession,role:'employee',availableSections:['own_time','manual_capture']}});
  const target = {targetType:'customer' as const,targetId:'40000000-0000-4000-8000-000000000001',displayName:'Werkstatt'};
  const workTargets = vi.fn(async()=>({status:'succeeded' as const,value:{targets:[target],nextCursor:null}}));
  const manualLifecycle = vi.fn(async()=>({status:'unreachable' as const}));
  const coordinator = new AdminWebCoordinator(auth, {...api,workTargets,manualLifecycle},()=>fixedNow);
  await coordinator.signIn('employee@example.test','secret');
  await coordinator.loadWorkTargets();
  await coordinator.captureManual(target);
  await coordinator.refresh();
  await coordinator.captureManual('break');
  expect(manualLifecycle).toHaveBeenCalledTimes(2);
  expect(manualLifecycle.mock.calls[1]).toEqual(manualLifecycle.mock.calls[0]);
  expect(coordinator.getState()).toMatchObject({status:'ready',manual:{pending:true,busy:false}});
  await coordinator.signOut();
  await coordinator.captureManual(target);
  expect(manualLifecycle).toHaveBeenCalledTimes(2);
});

it('T049 b: own-only sessions issue no administration request even through direct commands',async()=>{
 const auth=new FakeAuth(),api=new FakeApi();
 api.session.mockResolvedValue({status:'succeeded',value:{...administratorSession,role:'employee',availableSections:['own_time','manual_capture']}});
 const assignableLocations=vi.fn(),locationSetupPage=vi.fn(),mutateLocationSetup=vi.fn();
 const coordinator=new AdminWebCoordinator(auth,{...api,assignableLocations,locationSetupPage,mutateLocationSetup},()=>fixedNow);
 await coordinator.signIn('a@example.test','secret');
 await coordinator.refreshLocationSetup();await coordinator.refreshProjects();await coordinator.createLocation('Halle');
 await coordinator.createCustomer('Kunde');await coordinator.createEmployeeInvitation('Name','employee');
 await coordinator.refreshManagedPeople();await coordinator.loadPersonTime(membershipId,'2026-07');
 await coordinator.exportTimeRecords();coordinator.prepareReassignment('tag','target');await coordinator.confirmReassignment();
 for(const call of [assignableLocations,locationSetupPage,mutateLocationSetup,api.projection,api.employeeProjection,api.timeRecords,api.reviewItems,api.createCustomer,api.createEmployeeInvitation,api.reassignNfcTag,api.exportTimeEntries]) expect(call).not.toHaveBeenCalled();
 expect(coordinator.getState()).toMatchObject({status:'ready',role:'employee',notice:null});
});
it('T049 own-time: a changing active record during pagination never yields a complete sum',async()=>{
 const auth=new FakeAuth(),api=new FakeApi();
 api.session.mockResolvedValue({status:'succeeded',value:{...administratorSession,role:'employee',availableSections:['own_time','manual_capture']}});
 const active={timeRecordId:'90000000-0000-4000-8000-000000000003',source:'canonical' as const,targetType:'customer' as const,targetDisplayName:'Werkstatt',status:'started' as const,startedAt:'2026-07-21T08:00:00.000Z',stoppedAt:null,startedVia:'manual' as const,stoppedVia:null};
 const closed={...active,timeRecordId:stoppedRecord.timeRecordId,status:'stopped' as const,startedAt:stoppedRecord.startedAt,stoppedAt:stoppedRecord.stoppedAt,stoppedVia:'manual' as const};
 const frame={windowStartedAt:'2026-06-20T12:00:00.000Z',windowEndedAt:'2026-07-21T12:00:00.000Z'};
 const ownTime=vi.fn().mockResolvedValueOnce({status:'succeeded',value:{...frame,activeRecord:active,records:[closed],nextCursor:'next'}})
  .mockResolvedValueOnce({status:'succeeded',value:{...frame,activeRecord:null,records:[],nextCursor:null}});
 const coordinator=new AdminWebCoordinator(auth,{...api,ownTime},()=>fixedNow);
 await coordinator.signIn('a@example.test','secret');await coordinator.loadOwnTime('2026-07');
 expect(coordinator.getState()).toMatchObject({status:'ready',calendar:{status:'unavailable',value:null}});
 expect(ownTime).toHaveBeenCalledTimes(2);
});

it('T049 refresh: the shell refresh reloads opened own-time data',async()=>{
 const auth=new FakeAuth(),api=new FakeApi();
 api.session.mockResolvedValue({status:'succeeded',value:{...administratorSession,role:'employee',availableSections:['own_time','manual_capture']}});
 const ownTime=vi.fn(async()=>({status:'succeeded' as const,value:{activeRecord:null,records:[],nextCursor:null,
  windowStartedAt:'2026-06-20T12:00:00.000Z',windowEndedAt:'2026-07-21T12:00:00.000Z'}}));
 const coordinator=new AdminWebCoordinator(auth,{...api,ownTime},()=>fixedNow);
 await coordinator.signIn('a@example.test','secret');await coordinator.loadOwnTime('2026-07');
 await coordinator.refresh();
 expect(ownTime).toHaveBeenCalledTimes(2);
 expect(coordinator.getState()).toMatchObject({status:'ready',calendar:{status:'ready',month:'2026-07',targetMembershipId:null}});
});

function t066Setup(role:Session['role']='employee') {
 const auth=new FakeAuth(),api=new FakeApi();
 api.session.mockResolvedValue({status:'succeeded',value:{...administratorSession,role,availableSections:['own_time','manual_capture','employees']}});
 const details={origin:'backfilled' as const,baseRowVersion:0,effectiveRevisionNumber:1,comment:null,changed:false,change:null,overlapsAnotherRecord:false};
 const record={...stoppedRecord,details};
 const page={activeRecord:null,records:[record],nextCursor:null,windowStartedAt:'2026-07-01T00:00:00.000Z',windowEndedAt:'2026-07-21T12:00:00.000Z'};
 const ownTime=vi.fn(async()=>({status:'succeeded' as const,value:page}));
 const managedPersonTime=vi.fn(async()=>({status:'succeeded' as const,value:{...page,windowStartedAt:'2026-06-30T22:00:00.000Z'}}));
 const supplementTime=vi.fn<NonNullable<AdminWebApiPort['supplementTime']>>(async()=>({status:'succeeded',value:{status:'committed',timeRecordId:record.timeRecordId,idempotentRetry:false}}));
 const coordinator=new AdminWebCoordinator(auth,{...api,ownTime,managedPersonTime,supplementTime},()=>fixedNow);
 return {auth,api,coordinator,record,page,ownTime,managedPersonTime,supplementTime};
}
it('T066 retains an uncertain command, releases confirmed identity and refuses foreign or manager comments',async()=>{
 const h=t066Setup('administrator');await h.coordinator.signIn('a@example.test','secret');await h.coordinator.loadOwnTime('2026-07');
 const input={kind:'comment' as const,targetMembershipId:membershipId,record:h.record,comment:'Eigene Notiz'};
 h.supplementTime.mockResolvedValueOnce({status:'unreachable'});
 expect(await h.coordinator.saveTimeEdit(input)).toEqual({status:'unavailable'});
 expect((await h.coordinator.saveTimeEdit(input)).status).toBe('committed');
 expect(h.supplementTime.mock.calls[0]![2]).toEqual(h.supplementTime.mock.calls[1]![2]);
 await h.coordinator.saveTimeEdit(input);expect(h.supplementTime.mock.calls[2]![2]).not.toEqual(h.supplementTime.mock.calls[1]![2]);
 expect((await h.coordinator.saveTimeEdit({...input,targetMembershipId:'20000000-0000-4000-8000-000000000002'})).status).toBe('authority_rejected');
 const manager=t066Setup('standortleitung');await manager.coordinator.signIn('a@example.test','secret');await manager.coordinator.loadOwnTime('2026-07');
 expect((await manager.coordinator.saveTimeEdit({...input,record:manager.record})).status).toBe('authority_rejected');expect(manager.supplementTime).not.toHaveBeenCalled();
});
it('T066 does not adopt an edit after logout',async()=>{
 const h=t066Setup('administrator');await h.coordinator.signIn('a@example.test','secret');await h.coordinator.loadOwnTime('2026-07');
 const pending=deferred<ApiResult<import('@taptime/mobile-work-contract').TimeSupplementResult>>();h.supplementTime.mockReturnValueOnce(pending.promise);
 const writing=h.coordinator.saveTimeEdit({kind:'comment',targetMembershipId:membershipId,record:h.record,comment:'Notiz'});
 await h.coordinator.signOut();pending.resolve({status:'succeeded',value:{status:'committed',timeRecordId:h.record.timeRecordId,idempotentRetry:false}});
 expect((await writing).status).toBe('authority_rejected');expect(h.coordinator.getState()).toEqual({status:'signed_out'});
});
it('T066 sends calendar correction versions through the unchanged correction API',async()=>{
 const h=t066Setup('administrator');await h.coordinator.signIn('a@example.test','secret');await h.coordinator.loadOwnTime('2026-07');
 expect((await h.coordinator.saveTimeEdit({kind:'correct',record:h.record,targetMembershipId:membershipId,startedAt:h.record.startedAt,stoppedAt:h.record.stoppedAt!,reason:'Prüfung'})).status).toBe('committed');
 expect(h.api.correctTimeRecord).toHaveBeenCalledWith('memory-only-token',membershipId,expect.any(String),expect.objectContaining({baseRowVersion:0,effectiveRevisionNumber:1}),h.record.startedAt,h.record.stoppedAt,'Prüfung');
});
it('T066 accepts structurally identical active details across pages',async()=>{
 const h=t066Setup();const active={...h.record,timeRecordId:'90000000-0000-4000-8000-000000000003',status:'started' as const,stoppedAt:null};
 h.ownTime.mockResolvedValueOnce({status:'succeeded',value:{...h.page,activeRecord:active,nextCursor:'next'}} as never)
  .mockResolvedValueOnce({status:'succeeded',value:{...h.page,activeRecord:JSON.parse(JSON.stringify(active)),records:[]}});
 await h.coordinator.signIn('a@example.test','secret');await h.coordinator.loadOwnTime('2026-07');
 expect(h.coordinator.getState()).toMatchObject({status:'ready',calendar:{status:'ready',value:{activeRecord:active,nextCursor:null}}});
});

it('T066 leaves a newly opened person untouched by the prior edit acknowledgement',async()=>{
 const h=t066Setup('administrator');await h.coordinator.signIn('a@example.test','secret');await h.coordinator.loadOwnTime('2026-07');
 const pending=deferred<ApiResult<import('@taptime/mobile-work-contract').TimeSupplementResult>>();h.supplementTime.mockReturnValueOnce(pending.promise);
 const writing=h.coordinator.saveTimeEdit({kind:'comment',targetMembershipId:membershipId,record:h.record,comment:'Notiz'});
 const another='20000000-0000-4000-8000-000000000002';await h.coordinator.loadPersonTime(another,'2026-07');
 pending.resolve({status:'succeeded',value:{status:'committed',timeRecordId:h.record.timeRecordId,idempotentRetry:false}});await writing;
 expect(h.coordinator.getState()).toMatchObject({status:'ready',notice:null,timeEditBusy:false,calendar:{targetMembershipId:another}});expect(h.managedPersonTime).toHaveBeenCalledTimes(1);expect(h.ownTime).toHaveBeenCalledTimes(1);
});
