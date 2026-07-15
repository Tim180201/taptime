import type { NfcScanPort } from '@taptime/core';
import type { NfcCaptureLifecyclePort } from '../nfc/RnNfcScanAdapter';
import type { AdminSessionContextReader, AdminSetupApiPort, AdminSetupCapability, AdminSetupOutcome, AdminSetupState } from './contracts';

export class AdminSetupCoordinator implements AdminSetupCapability {
  private state: AdminSetupState = Object.freeze({ status: 'inactive' });
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private generation = 0;
  private active = false;

  constructor(
    private readonly session: AdminSessionContextReader,
    private readonly nfc: NfcScanPort & NfcCaptureLifecyclePort,
    private readonly api: AdminSetupApiPort,
    private readonly createCommandId: () => string,
  ) {}

  getState(): AdminSetupState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.unsubscribe = this.session.subscribe(() => { void this.onSessionChanged(); });
    await this.onSessionChanged();
  }

  async stop(): Promise<void> {
    if (!this.active) return;
    this.active = false;
    this.generation += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.nfc.stop();
    this.setState({ status: 'inactive' });
  }

  async refresh(): Promise<void> { await this.loadProjection(null); }

  async provision(customerId: string, displayName: string): Promise<void> {
    const current = this.state;
    const snapshot = this.session.capture();
    if (current.status !== 'ready' || snapshot === null || snapshot.session.role !== 'administrator') return;
    if (!current.projection.customers.some((customer) => customer.id === customerId && customer.active)
      || displayName.trim().length < 1 || Array.from(displayName.normalize('NFC').trim()).length > 80) {
      this.setState({ status: 'ready', projection: current.projection, outcome: { status: 'invalid_input' } });
      return;
    }
    const generation = ++this.generation;
    this.setState({ status: 'capturing', projection: current.projection });
    const capture = await this.nfc.scan();
    if (!this.isCurrent(generation, snapshot)) return;
    if (capture.status !== 'captured') {
      const status = capture.status === 'unavailable' ? 'nfc_unavailable' : capture.status;
      this.finish(current.projection, { status });
      return;
    }
    this.setState({ status: 'submitting', projection: current.projection });
    const result = await this.api.provisionTag({
      expectedMembershipId: snapshot.session.membershipId,
      commandId: this.createCommandId(),
      customerId,
      displayName,
      canonicalPayload: capture.payload,
    });
    if (!this.isCurrent(generation, snapshot)) return;
    if (result.status === 'succeeded') {
      await this.loadProjection({ status: 'tag_provisioned', validationFingerprint: result.validationFingerprint }, snapshot, generation);
      return;
    }
    const mapped: AdminSetupOutcome['status'] = result.status === 'authority_rejected' ? 'session_rejected'
      : result.status === 'tag_payload_already_registered' ? 'tag_already_registered'
        : result.status === 'assignment_target_unavailable' ? 'customer_unavailable'
          : result.status === 'invalid_request' ? 'invalid_input' : 'request_failed';
    this.finish(current.projection, { status: mapped } as AdminSetupOutcome);
  }

  async cancel(): Promise<void> { this.generation += 1; await this.nfc.cancelCapture(); await this.loadProjection({ status: 'cancelled' }); }

  private async onSessionChanged(): Promise<void> {
    this.generation += 1;
    await this.nfc.cancelCapture();
    const snapshot = this.session.capture();
    if (snapshot === null) { this.setState({ status: 'inactive' }); return; }
    if (snapshot.session.role !== 'administrator') { this.setState({ status: 'not_administrator' }); return; }
    await this.loadProjection(null, snapshot, this.generation);
  }

  private async loadProjection(outcome: AdminSetupOutcome | null, supplied = this.session.capture(), suppliedGeneration = ++this.generation): Promise<void> {
    const snapshot = supplied;
    if (!this.active || snapshot === null || snapshot.session.role !== 'administrator') return;
    const generation = suppliedGeneration;
    this.setState({ status: 'loading' });
    const result = await this.api.readProjection(snapshot.session.membershipId);
    if (!this.isCurrent(generation, snapshot)) return;
    if (result.status === 'succeeded') {
      this.setState({ status: 'ready', projection: { organization: result.organization, customers: result.customers, nfcTags: result.nfcTags }, outcome });
    } else if (result.status === 'authority_rejected') {
      this.setState({ status: 'inactive' });
    } else {
      this.setState({ status: 'inactive' });
    }
  }

  private isCurrent(generation: number, snapshot: Parameters<AdminSessionContextReader['isCurrent']>[0]): boolean {
    return this.active && generation === this.generation && this.session.isCurrent(snapshot);
  }
  private finish(projection: Extract<AdminSetupState, { status: 'ready' }>['projection'], outcome: AdminSetupOutcome): void { this.setState({ status: 'ready', projection, outcome }); }
  private setState(state: AdminSetupState): void { this.state = Object.freeze(state); for (const listener of this.listeners) listener(); }
}
