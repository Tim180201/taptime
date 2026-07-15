import type { AdminWebCapability, AdminWebState, SafeProjection } from './contracts';
import { AdminWebApiClient, type AdminWebApiPort } from './AdminWebApiClient';

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
    this.setState({ status: 'signing_in' });
    await this.enqueueAuthentication(() => this.completeSignIn(generation, email, password));
  }

  async signOut(): Promise<void> {
    this.generation += 1;
    this.membershipId = null;
    this.setState({ status: 'signed_out' });
    await this.enqueueAuthentication(() => this.safeSignOut());
  }

  async refresh(): Promise<void> {
    const membershipId = this.membershipId;
    if (membershipId === null) return;
    const generation = this.generation;
    this.setState({ status: 'loading' });
    let result;
    try {
      result = await this.auth.withAccessToken((token) => this.api.projection(token, membershipId, null));
    } catch {
      result = null;
    }
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded') {
      this.setState({ status: 'ready', projection: result.value, creating: false, notice: null });
    } else if (result === null || result.status === 'rejected') {
      await this.rejectOutsideAuthentication(generation, 'Administrator-Sitzung ist nicht mehr gültig.');
    } else {
      this.setState({ status: 'unavailable', message: 'Einrichtungsdaten sind derzeit nicht erreichbar.' });
    }
  }

  async loadMore(): Promise<void> {
    const current = this.state;
    const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null || current.projection.nextCursor === null) return;
    const generation = this.generation;
    const requestedCursor = current.projection.nextCursor;
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
        this.setState({ status: 'ready', projection: merged, creating: false, notice: current.notice });
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
      this.setState({ ...current, creating: false, notice: 'Kunde konnte nicht bestätigt angelegt werden.' });
    }
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
        this.setState({ status: 'ready', projection: projection.value, creating: false, notice: null });
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

  private setState(state: AdminWebState): void {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }
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
