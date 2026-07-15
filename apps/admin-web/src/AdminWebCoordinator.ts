import type { AdminWebCapability, AdminWebState } from './contracts';
import { AdminWebApiClient } from './AdminWebApiClient';
import { SupabaseMemoryAuth } from './SupabaseMemoryAuth';

export class AdminWebCoordinator implements AdminWebCapability {
  private state: AdminWebState = Object.freeze({ status: 'signed_out' });
  private membershipId: string | null = null;
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly auth: SupabaseMemoryAuth, private readonly api = new AdminWebApiClient()) {}
  getState(): AdminWebState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  async signIn(email: string, password: string): Promise<void> {
    const generation = ++this.generation; this.membershipId = null; this.setState({ status: 'signing_in' });
    try {
      if (!await this.auth.signIn(email, password) || generation !== this.generation) { this.setState({ status: 'signed_out' }); return; }
      const session = await this.auth.withAccessToken((token) => this.api.session(token));
      if (generation !== this.generation) return;
      if (session?.status !== 'succeeded') { await this.reject('Sitzung konnte nicht sicher bestätigt werden.'); return; }
      if (session.value.role !== 'administrator') { await this.reject('Diese Oberfläche ist nur für Administratoren verfügbar.', true); return; }
      this.membershipId = session.value.membershipId; await this.refresh();
    } catch { await this.reject('Anmeldung derzeit nicht verfügbar.'); }
  }
  async signOut(): Promise<void> { this.generation += 1; this.membershipId = null; await this.auth.signOut(); this.setState({ status: 'signed_out' }); }
  async refresh(): Promise<void> {
    const membershipId = this.membershipId; if (membershipId === null) return;
    const generation = this.generation; this.setState({ status: 'loading' });
    const result = await this.auth.withAccessToken((token) => this.api.projection(token, membershipId));
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded') this.setState({ status: 'ready', projection: result.value, creating: false, notice: null });
    else if (result?.status === 'rejected') await this.reject('Administrator-Sitzung ist nicht mehr gültig.');
    else this.setState({ status: 'unavailable', message: 'Einrichtungsdaten sind derzeit nicht erreichbar.' });
  }
  async createCustomer(displayName: string): Promise<void> {
    const current = this.state; const membershipId = this.membershipId;
    if (current.status !== 'ready' || membershipId === null || displayName.trim().length < 1 || Array.from(displayName.normalize('NFC').trim()).length > 120) return;
    const generation = this.generation; this.setState({ ...current, creating: true, notice: null });
    const result = await this.auth.withAccessToken((token) => this.api.createCustomer(token, membershipId, crypto.randomUUID(), displayName));
    if (generation !== this.generation) return;
    if (result?.status === 'succeeded') { await this.refresh(); const next = this.state; if (next.status === 'ready') this.setState({ ...next, notice: 'Kunde wurde sicher angelegt.' }); }
    else if (result?.status === 'rejected') await this.reject('Administrator-Sitzung ist nicht mehr gültig.');
    else this.setState({ ...current, creating: false, notice: 'Kunde konnte nicht bestätigt angelegt werden.' });
  }
  private async reject(message: string, forbidden = false): Promise<void> { this.membershipId = null; await this.auth.signOut(); this.setState({ status: forbidden ? 'forbidden' : 'unavailable', message }); }
  private setState(state: AdminWebState): void { this.state = Object.freeze(state); for (const listener of this.listeners) listener(); }
}
