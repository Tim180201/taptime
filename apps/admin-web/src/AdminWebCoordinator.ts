import type {
  AdminWebCapability,
  AdminWebState,
  SafeEmployeeProjection,
  SafeProjection,
  VolatileInvitationSecret,
} from './contracts';
import { AdminWebApiClient, type AdminWebApiPort } from './AdminWebApiClient';
import { isSafeEmployeeProjectionPage } from './employeeProjectionSafety';

export interface AdminWebAuthPort {
  signIn(email: string, password: string): Promise<boolean>;
  withAccessToken<Value>(operation: (accessToken: string) => Promise<Value>): Promise<Value | null>;
  signOut(): Promise<void>;
}

export class AdminWebCoordinator implements AdminWebCapability {
  private state: AdminWebState = Object.freeze({ status: 'signed_out' });
  private membershipId: string | null = null;
  private generation = 0;
  private authenticationQueue: Promise<void> = Promise.resolve();
  private invitationExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private invitationDisclosureEpoch = 0;
  private readonly invitationDisclosureEpochs = new WeakMap<VolatileInvitationSecret, number>();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly auth: AdminWebAuthPort,
    private readonly api: AdminWebApiPort = new AdminWebApiClient(),
  ) {}

  getState(): AdminWebState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async signIn(email: string, password: string): Promise<void> {
    const generation = ++this.generation;
    this.membershipId = null;
    this.clearInvitationExpiryTimer();
    this.setState({ status: 'signing_in' });
    await this.enqueueAuthentication(() => this.completeSignIn(generation, email, password));
  }

  async signOut(): Promise<void> {
    this.generation += 1;
    this.membershipId = null;
    this.clearInvitationExpiryTimer();
    this.setState({ status: 'signed_out' });
    await this.enqueueAuthentication(() => this.safeSignOut());
  }

  async refresh(): Promise<void> {
    const membershipId = this.membershipId;
    if (membershipId === null) return;
    const generation = this.generation;
    this.setState({ status: 'loading' });
    let result;
    let employees;
    try {
      result = await this.auth.withAccessToken((token) => this.api.projection(token, membershipId, null));
      employees = result?.status === 'succeeded'
        ? await this.auth.withAccessToken((token) => this.api.employeeProjection(token, membershipId, null))
        : null;
    } catch {
      result = null;
      employees = null;
    }
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded' && employees?.status === 'succeeded') {
      this.setState(readyState(result.value, employees.value));
    } else if (
      result === null
      || result.status === 'rejected'
      || (
        result.status === 'succeeded'
        && (employees === null || employees.status === 'rejected')
      )
    ) {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({ status: 'unavailable', message: 'Einrichtungsdaten sind derzeit nicht erreichbar.' });
    }
  }

  async loadMore(): Promise<void> {
    let current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null || current.projection.nextCursor === null) return;
    const generation = this.generation;
    const requestedCursor = current.projection.nextCursor;
    current = { ...current, invitation: null };
    this.setState({ status: 'loading' });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.projection(token, membershipId, requestedCursor));
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded') {
      const merged = mergeProjection(current.projection, result.value, requestedCursor);
      if (merged !== null) {
        this.setState({ ...current, projection: merged, creating: false });
      } else {
        this.setState({ status: 'unavailable', message: 'Weitere Einrichtungsdaten konnten nicht sicher bestätigt werden.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({ status: 'unavailable', message: 'Weitere Einrichtungsdaten sind derzeit nicht erreichbar.' });
    }
  }

  async createCustomer(displayName: string): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null || displayName.trim().length < 1 || Array.from(displayName.normalize('NFC').trim()).length > 120) return;
    const generation = this.generation;
    this.setState({ ...current, creating: true, notice: null });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.createCustomer(token, membershipId, crypto.randomUUID(), displayName));
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded') {
      await this.refresh();
      if (generation !== this.generation) return;
      const next = this.state;
      if (next.status === 'ready') this.setState({ ...next, notice: 'Kunde wurde sicher angelegt.' });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      const latest = this.state;
      if (latest.status === 'ready') {
        this.setState({
          ...latest,
          creating: false,
          notice: 'Kunde konnte nicht bestätigt angelegt werden.',
        });
      }
    }
  }

  async loadMoreEmployees(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || current.employeeProjection.nextCursor === null
    ) return;
    const generation = this.generation;
    const requestedCursor = current.employeeProjection.nextCursor;
    let result;
    try {
      result = await this.auth.withAccessToken(
        (token) => this.api.employeeProjection(token, membershipId, requestedCursor),
      );
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    const latest = this.state;
    if (
      latest.status !== 'ready'
      || latest.employeeProjection.nextCursor !== requestedCursor
    ) return;
    if (result?.status === 'succeeded') {
      const merged = mergeEmployeeProjection(
        latest.employeeProjection,
        result.value,
        requestedCursor,
      );
      if (merged !== null) {
        this.setState({ ...latest, employeeProjection: merged });
      } else {
        this.setState({ status: 'unavailable', message: 'Weitere Beschäftigtendaten konnten nicht sicher bestätigt werden.' });
      }
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({ ...latest, notice: 'Weitere Beschäftigtendaten sind derzeit nicht erreichbar.' });
    }
  }

  async createEmployeeInvitation(displayName: string): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (
      current.status !== 'ready'
      || membershipId === null
      || displayName.trim().length < 1
      || Array.from(displayName.normalize('NFC').trim()).length > 120
    ) return;
    const generation = this.generation;
    this.setState({
      ...current,
      creatingEmployee: true,
      invitation: null,
      notice: null,
    });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.createEmployeeInvitation(
        token,
        membershipId,
        crypto.randomUUID(),
        displayName,
      ));
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (generation !== this.generation) return;
    const latest = this.state;
    if (latest.status !== 'ready') return;
    if (result?.status === 'succeeded') {
      this.setState({
        ...latest,
        creatingEmployee: false,
        invitation: result.value,
        notice: 'Einladung wurde einmalig erzeugt.',
      });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else if (result.status === 'conflict') {
      const notice = result.code === 'invitation_limit_reached'
        ? 'Es sind bereits fünf aktive Einladungen vorhanden.'
        : result.code === 'invitation_created_token_unavailable'
          ? 'Diese Einladung wurde bereits erzeugt; ihr Geheimnis kann nicht erneut angezeigt werden.'
          : 'Die Einladungsanfrage steht mit einer vorhandenen Anfrage in Konflikt.';
      this.setState({ ...latest, creatingEmployee: false, invitation: null, notice });
    } else {
      this.setState({
        ...latest,
        creatingEmployee: false,
        invitation: null,
        notice: 'Einladung konnte nicht sicher erzeugt werden.',
      });
    }
  }

  dismissInvitation(): void {
    const current = this.state;
    if (current.status !== 'ready' || current.invitation === null) return;
    this.setState({ ...current, invitation: null, notice: 'Einladungsgeheimnis wurde verworfen.' });
  }

  private async completeSignIn(generation: number, email: string, password: string): Promise<void> {
    try {
      if (!await this.auth.signIn(email, password)) {
        await this.safeSignOut();
        if (generation === this.generation) this.setState({ status: 'signed_out' });
        return;
      }
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      const session = await this.auth.withAccessToken((token) => this.api.session(token));
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      if (session?.status !== 'succeeded') {
        await this.rejectWithinAuthentication(generation, 'Sitzung konnte nicht sicher bestätigt werden.');
        return;
      }
      if (session.value.role !== 'administrator') {
        await this.rejectWithinAuthentication(generation, 'Diese Oberfläche ist nur für Administratoren verfügbar.', true);
        return;
      }
      this.membershipId = session.value.membershipId;
      this.setState({ status: 'loading' });
      const projection = await this.auth.withAccessToken((token) => this.api.projection(token, session.value.membershipId, null));
      if (generation !== this.generation) { await this.safeSignOut(); return; }
      if (projection?.status === 'succeeded') {
        const employees = await this.auth.withAccessToken(
          (token) => this.api.employeeProjection(token, session.value.membershipId, null),
        );
        if (generation !== this.generation) { await this.safeSignOut(); return; }
        if (employees?.status === 'succeeded') {
          this.setState(readyState(projection.value, employees.value));
        } else if (employees === null || employees.status === 'rejected') {
          await this.rejectWithinAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
        } else {
          this.setState({ status: 'unavailable', message: 'Beschäftigtendaten sind derzeit nicht erreichbar.' });
        }
      } else if (projection === null || projection.status === 'rejected') {
        await this.rejectWithinAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
      } else {
        this.setState({ status: 'unavailable', message: 'Einrichtungsdaten sind derzeit nicht erreichbar.' });
      }
    } catch {
      await this.safeSignOut();
      if (generation === this.generation) {
        this.membershipId = null;
        this.setState({ status: 'unavailable', message: 'Anmeldung derzeit nicht verfügbar.' });
      }
    }
  }

  private async rejectWithinAuthentication(generation: number, message: string, forbidden = false): Promise<void> {
    if (generation !== this.generation) { await this.safeSignOut(); return; }
    this.membershipId = null;
    const invalidatedGeneration = ++this.generation;
    await this.safeSignOut();
    if (invalidatedGeneration === this.generation) this.setState({ status: forbidden ? 'forbidden' : 'unavailable', message });
  }

  private async rejectOutsideAuthentication(generation: number, message: string): Promise<void> {
    if (generation !== this.generation) return;
    this.membershipId = null;
    this.generation += 1;
    this.setState({ status: 'unavailable', message });
    await this.enqueueAuthentication(() => this.safeSignOut());
  }

  private enqueueAuthentication(operation: () => Promise<void>): Promise<void> {
    const queued = this.authenticationQueue.then(operation, operation);
    this.authenticationQueue = queued.catch(() => undefined);
    return queued;
  }

  private async safeSignOut(): Promise<void> {
    try { await this.auth.signOut(); } catch { /* local state remains invalidated */ }
  }

  private setState(requestedState: AdminWebState): void {
    this.clearInvitationExpiryTimer();
    const previousInvitation = this.state.status === 'ready' ? this.state.invitation : null;
    let state = requestedState;
    if (state.status === 'ready' && state.invitation !== null) {
      const recordedEpoch = this.invitationDisclosureEpochs.get(state.invitation);
      if (recordedEpoch === undefined) {
        this.invitationDisclosureEpoch += 1;
        this.invitationDisclosureEpochs.set(state.invitation, this.invitationDisclosureEpoch);
      } else if (recordedEpoch !== this.invitationDisclosureEpoch) {
        state = {
          ...state,
          invitation: this.state.status === 'ready' ? this.state.invitation : null,
        };
      }
    }
    const nextInvitation = state.status === 'ready' ? state.invitation : null;
    if (previousInvitation !== null && nextInvitation === null) {
      this.invitationDisclosureEpoch += 1;
    }
    this.state = Object.freeze(state);
    if (state.status === 'ready' && state.invitation !== null) {
      const generation = this.generation;
      const invitation = state.invitation;
      const remaining = Date.parse(invitation.expiresAt) - Date.now();
      if (remaining <= 0) {
        this.state = Object.freeze({ ...state, invitation: null, notice: 'Einladung ist abgelaufen.' });
      } else {
        this.invitationExpiryTimer = setTimeout(() => {
          const current = this.state;
          if (
            generation === this.generation
            && current.status === 'ready'
            && current.invitation?.value === invitation.value
          ) {
            this.setState({ ...current, invitation: null, notice: 'Einladung ist abgelaufen.' });
          }
        }, Math.min(remaining, 2_147_483_647));
      }
    }
    for (const listener of this.listeners) listener();
  }

  private clearInvitationExpiryTimer(): void {
    if (this.invitationExpiryTimer !== null) {
      clearTimeout(this.invitationExpiryTimer);
      this.invitationExpiryTimer = null;
    }
  }
}

function readyState(
  projection: SafeProjection,
  employeeProjection: SafeEmployeeProjection,
): Extract<AdminWebState, { readonly status: 'ready' }> {
  if (
    projection.organization.id !== employeeProjection.organization.id
    || projection.organization.name !== employeeProjection.organization.name
    || !isSafeEmployeeProjectionPage(employeeProjection, null)
  ) {
    throw new Error('Administration projections disagree about the Organization');
  }
  return {
    status: 'ready',
    projection,
    employeeProjection,
    creating: false,
    creatingEmployee: false,
    invitation: null,
    notice: null,
  };
}

function mergeProjection(current: SafeProjection, next: SafeProjection, requestedCursor: string): SafeProjection | null {
  if (current.organization.id !== next.organization.id || current.organization.name !== next.organization.name || next.nextCursor === requestedCursor) return null;
  const customerIds = new Set(current.customers.map((customer) => customer.id));
  const tagIds = new Set(current.nfcTags.map((tag) => tag.id));
  if (next.customers.some((customer) => customerIds.has(customer.id)) || next.nfcTags.some((tag) => tagIds.has(tag.id))) return null;
  return Object.freeze({
    organization: current.organization,
    customers: Object.freeze([...current.customers, ...next.customers]),
    nfcTags: Object.freeze([...current.nfcTags, ...next.nfcTags]),
    nextCursor: next.nextCursor,
  });
}

function mergeEmployeeProjection(
  current: SafeEmployeeProjection,
  next: SafeEmployeeProjection,
  requestedCursor: string,
): SafeEmployeeProjection | null {
  if (
    current.organization.id !== next.organization.id
    || current.organization.name !== next.organization.name
    || next.nextCursor === requestedCursor
    || !isSafeEmployeeProjectionPage(next, requestedCursor)
  ) return null;
  const membershipIds = new Set(current.employeeMemberships.map((membership) => membership.id));
  if (next.employeeMemberships.some((membership) => membershipIds.has(membership.id))) return null;
  return Object.freeze({
    organization: current.organization,
    employeeMemberships: Object.freeze([
      ...current.employeeMemberships,
      ...next.employeeMemberships,
    ]),
    nextCursor: next.nextCursor,
  });
}
