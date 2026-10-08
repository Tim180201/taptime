import {normalizeCustomerNameV1} from '@taptime/administration-contract/names';
import type {CustomerManagementChange,ManageCustomerResult} from '@taptime/mobile-work-contract';
import type { NfcScanCaptureResult, NfcScanPort } from '@taptime/core';
import type { CapturedTagAction, ConnectedTagSession, TagActionResult } from '../nfc/IosNfcSession';
import type { ScanFeedbackPort } from '../feedback/NativeAndroidFeedback';
import type { NfcCaptureLifecyclePort } from '../nfc/RnNfcScanAdapter';
import { TAG_URI } from '../nfc/tagAddress';
import type { NfcTagWriter, TagWriteResult } from './NfcTagWriter';
import type { AdminSessionContextReader, AdminSetupApiPort, AdminSetupCapability, AdminSetupOutcome, AdminSetupState, CustomerCreationOptions, CreateAdminCustomerResult, ProvisionAdminTagResult, AdminSetupProjection, AdminSessionSnapshot } from './contracts';

export class AdminSetupCoordinator implements AdminSetupCapability {
  private state: AdminSetupState = Object.freeze({ status: 'inactive' });
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private generation = 0;
  private authorityGeneration = 0;
  private projectionInvalidated = false;
  private active = false;
  private pendingCustomer: { key: string; commandId: string } | null = null;

  private pendingTag: { authorityKey: string; commandId: string; membershipId: string; customerId: string | null; displayName: string; canonicalPayload: string } | null = null;
  private tagOperation: { snapshot: AdminSessionSnapshot; projection: AdminSetupProjection; sent: boolean } | null = null;
  private tagReceipt: { authorityKey: string; projection: AdminSetupProjection; outcome: AdminSetupOutcome } | null = null;

  constructor(
    private readonly session: AdminSessionContextReader,
    private readonly nfc: NfcScanPort & NfcCaptureLifecyclePort,
    private readonly api: AdminSetupApiPort,
    private readonly createCommandId: () => string,
    private readonly writer: NfcTagWriter,
    private readonly isOnline: () => Promise<boolean> = async () => true,
    private readonly feedback?: ScanFeedbackPort,
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
    this.authorityGeneration += 1;
    this.generation += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.writer.cancel();
    await this.nfc.stop();
    this.setState({ status: 'inactive' });
  }

  async refresh(): Promise<void> {
    if (this.tagOperation !== null) return;
    await this.loadProjection(this.state.status === 'ready' ? this.state.outcome : null);
  }

  async loadMore(): Promise<void> {
    const current = this.state;
    const snapshot = this.session.capture();
    if (!this.active || current.status !== 'ready' || current.projection.nextCursor === null
      || snapshot === null || snapshot.session.nfcSetupAvailable !== true) return;
    const requestedCursor = current.projection.nextCursor;
    const generation = ++this.generation;
    this.setState({ status: 'loading' });
    const result = await this.api.readProjection(snapshot.session.membershipId, requestedCursor);
    if (!this.isCurrent(generation, snapshot)) return;
    if(this.projectionInvalidated){await this.loadProjection(current.outcome,snapshot,generation);return;}
    if (result.status === 'succeeded') {
      const merged = mergeProjection(current.projection, result, requestedCursor);
      if (merged !== null) {
        this.setState({ status: 'ready', projection: merged, outcome: current.outcome });
      } else {
        await this.finish(current.projection, { status: 'request_failed' });
      }
    } else if (result.status === 'authority_rejected') {
      this.setState({ status: 'inactive' });
    } else {
      await this.finish(current.projection, { status: 'request_failed' });
    }
  }

  async inspectTag():Promise<void>{
    const current=this.state,snapshot=this.session.capture();
    if(!this.active||current.status!=='ready'||!snapshot?.session.nfcSetupAvailable)return;
    const generation=++this.generation;
    this.setState({status:'capturing',projection:current.projection});
    try{
      const capture=await this.nfc.scan();
      if(!this.isCurrent(generation,snapshot))return;
      if(capture.status!=='captured'){
        await this.finish(current.projection,{status:capture.status==='unavailable'?'nfc_unavailable':capture.status});return;
      }
      const result=await this.api.inspectTag?.({expectedMembershipId:snapshot.session.membershipId,canonicalPayload:capture.payload})??{status:'unavailable'};
      if(!this.isCurrent(generation,snapshot))return;
      if(result.status==='succeeded')await this.finish(current.projection,{...result,status:'tag_checked'});
      else await this.finish(current.projection,{status:result.status==='forbidden'||result.status==='unauthorized'?'session_rejected':'request_failed'});
    }catch{if(this.isCurrent(generation,snapshot))await this.finish(current.projection,{status:'request_failed'});}
  }

  private pendingManagement:{key:string;commandId:string}|null=null;
  private managementBusy=false;
  async manageCustomer(customerId:string,change:CustomerManagementChange):Promise<ManageCustomerResult> {
    const snapshot=this.session.capture(),authorityGeneration=this.authorityGeneration;
    if(!this.active||!snapshot?.session.nfcSetupAvailable)return {status:'forbidden'};
    if(this.managementBusy)return {status:'unavailable'};
    if(change.action==='rename'){
      const name=normalizeCustomerNameV1(change.displayName);
      if(name.status!=='valid')return {status:'invalid_request'};
      change={action:'rename',displayName:name.canonicalName};
    }
    const key=JSON.stringify([snapshot.session.membershipId,customerId,change]);
    if(this.pendingManagement?.key!==key)this.pendingManagement={key,commandId:this.createCommandId()};
    this.managementBusy=true;
    try {
      if(!await this.isOnline())return {status:'unavailable'};
      if(!this.isManagementCurrent(authorityGeneration,snapshot))return {status:'forbidden'};
      const result=await this.api.manageCustomer?.({expectedMembershipId:snapshot.session.membershipId,commandId:this.pendingManagement.commandId,customerId,...change})??{status:'unavailable' as const};
      if(!this.isManagementCurrent(authorityGeneration,snapshot))return {status:'forbidden'};
      if(result.status==='succeeded'){
        this.pendingManagement=null;
        // Navigation/projection generations do not cancel a confirmed server mutation.
        // Wait for an ongoing NFC/creation operation to finish before reloading its projection.
        this.projectionInvalidated=true;
        if(this.state.status==='ready'||this.state.status==='inactive')await this.refresh().catch(()=>undefined);
        if(!this.isManagementCurrent(authorityGeneration,snapshot))return {status:'forbidden'};
      }
      return result;
    }catch{return {status:'unavailable'};}finally{this.managementBusy=false;}
  }

  async prepareCustomer(): Promise<CustomerCreationOptions> {
    const snapshot = this.session.capture();
    const generation = this.generation;
    if (!this.active || snapshot === null || !snapshot.session.nfcSetupAvailable) return { status: 'authority_rejected' };
    try {
      if (!await this.isOnline()) return { status: 'offline' };
      if (!this.isCurrent(generation, snapshot)) return { status: 'authority_rejected' };
      if (!snapshot.session.locationsEnabled) return { status: 'ready', locationsEnabled: false, locations: [] };
      const locations: { id: string; displayName: string }[] = [];
      let cursor: string | null = null;
      const seen = new Set<string>();
      do {
        const page: Awaited<ReturnType<NonNullable<AdminSetupApiPort['readCustomerLocations']>>> | undefined = await this.api.readCustomerLocations?.(snapshot.session.membershipId, cursor);
        if (!this.isCurrent(generation, snapshot)) return { status: 'authority_rejected' };
        if (page?.status === 'authority_rejected') return { status: 'authority_rejected' };
        if (page?.status !== 'succeeded') return { status: 'unavailable' };
        if (page.locations.some(location => locations.some(old => old.id === location.id))) return { status: 'unavailable' };
        locations.push(...page.locations);
        cursor = page.nextCursor;
        if (cursor !== null) { if (seen.has(cursor)) return { status: 'unavailable' }; seen.add(cursor); }
      } while (cursor !== null);
      return { status: 'ready', locationsEnabled: true, locations };
    } catch { return { status: 'unavailable' }; }
  }

  async createCustomer(displayName: string, locationId?: string): Promise<void> {
    const current = this.state;
    const snapshot = this.session.capture();
    if (!this.active || current.status !== 'ready' || snapshot === null || !snapshot.session.nfcSetupAvailable) return;
    const name = displayName.normalize('NFC').trim();
    if (name.length === 0 || Array.from(name).length > 120) { await this.finish(current.projection, { status: 'invalid_input' }); return; }
    if (snapshot.session.locationsEnabled && !locationId) { await this.finish(current.projection, { status: 'customer_location_required' }); return; }
    const generation = ++this.generation;
    this.setState({ status: 'creating_customer', projection: current.projection });
    let result: CreateAdminCustomerResult;
    try {
      if (!await this.isOnline()) {
        if (this.isCurrent(generation, snapshot)) await this.finish(current.projection, { status: 'customer_offline' });
        return;
      }
      if (!this.isCurrent(generation, snapshot)) return;
      const key = JSON.stringify([snapshot.session.membershipId, name, locationId ?? null]);
      if (this.pendingCustomer?.key !== key) this.pendingCustomer = { key, commandId: this.createCommandId() };
      result = await this.api.createCustomer?.({ expectedMembershipId: snapshot.session.membershipId,
        commandId: this.pendingCustomer.commandId, displayName: name, ...(locationId === undefined ? {} : { locationId }) }) ?? { status: 'unavailable' };
    } catch { result = { status: 'unavailable' }; }
    if (!this.isCurrent(generation, snapshot)) return;
    if (result.status === 'succeeded') {
      this.pendingCustomer = null;
      let projection = current.projection;
      let refreshed = false;
      try {
        let page = await this.api.readProjection(snapshot.session.membershipId, null);
        if (!this.isCurrent(generation, snapshot)) return;
        if (page.status === 'succeeded') {
          let next = page;
          const seen = new Set<string>();
          while (!next.customers.some(customer => customer.id === result.customer.id) && next.nextCursor !== null) {
            const cursor = next.nextCursor;
            if (seen.has(cursor)) break;
            seen.add(cursor);
            page = await this.api.readProjection(snapshot.session.membershipId, cursor);
            if (!this.isCurrent(generation, snapshot)) return;
            if (page.status !== 'succeeded') break;
            const merged = mergeProjection(next, page, cursor);
            if (merged === null) break;
            next = { status: 'succeeded', ...merged };
          }
          if (next.customers.some(customer => customer.id === result.customer.id)) { projection = next; refreshed = true; }
        }
      } catch { /* Creation is already confirmed; a failed reload must not invite another insert. */ }
      if (this.isCurrent(generation, snapshot)) await this.finish(projection,
        { status: 'customer_created', customerId: result.customer.id, refreshFailed: !refreshed });
      return;
    }
    await this.finish(current.projection, { status: result.status === 'location_required' ? 'customer_location_required'
      : result.status === 'forbidden' || result.status === 'authority_rejected' ? 'customer_forbidden'
        : result.status === 'invalid_request' ? 'invalid_input' : 'customer_request_failed' });
  }

  async provision(customerId: string, displayName: string): Promise<void> {
    await this.provisionCard(customerId, displayName);
  }

  async provisionBreak(displayName: string): Promise<void> {
    await this.provisionCard(null, displayName);
  }

  private async provisionCard(customerId: string | null, displayName: string): Promise<void> {
    const current = this.state, snapshot = this.session.capture();
    if (!this.active || this.tagOperation !== null || current.status !== 'ready' || !snapshot?.session.nfcSetupAvailable) return;
    displayName = displayName.normalize('NFC').trim();
    if (this.pendingTag !== null && (this.pendingTag.membershipId !== snapshot.session.membershipId
      || this.pendingTag.customerId !== customerId || this.pendingTag.displayName !== displayName)) return;
    if (this.pendingTag === null && customerId !== null && !current.projection.customers.some(customer => customer.id === customerId && customer.active)
      || displayName.length === 0 || Array.from(displayName).length > 80) {
      await this.finish(current.projection, { status: 'invalid_input' }); return;
    }
    const generation = ++this.generation;
    const operation = { snapshot, projection: current.projection, sent: false };
    this.tagReceipt = null;
    this.tagOperation = operation;
    this.setState({ status: 'capturing', projection: current.projection });
    let outcome: AdminSetupOutcome | null = null;
    const signal = (kind: 'tag_assigned' | 'failed', connected?: ConnectedTagSession) => {
      const play = () => { if (this.isTagAuthorityCurrent(snapshot)) void this.feedback?.perform(kind).catch(() => undefined); };
      if (connected) connected.afterClosed(play); else play();
    };
    const submit = async (connected?: ConnectedTagSession): Promise<TagActionResult> => {
      const command = this.pendingTag!;
      operation.sent = true;
      connected?.registrationStarted();
      this.setState({ status: 'submitting', projection: current.projection });
      let result: ProvisionAdminTagResult;
      try {
        const input = { expectedMembershipId: command.membershipId, commandId: command.commandId,
          displayName: command.displayName, canonicalPayload: command.canonicalPayload };
        result = command.customerId === null
          ? await this.api.provisionBreakTag?.(input) ?? { status: 'unavailable' }
          : await this.api.provisionTag({ ...input, customerId: command.customerId });
      } catch { result = { status: 'unavailable' }; }
      connected?.diagnose('registration_finished');
      // Missing context is not a different account. Keep its answer private until
      // the same identity returns; a confirmed switch has already detached command.
      if (this.pendingTag !== command) return { status: 'cancelled' };
      // Only transport uncertainty retains the command. A terminal answer releases it.
      if (result.status !== 'unavailable' && result.status !== 'transient_failure') this.pendingTag = null;
      if (result.status === 'succeeded') {
        outcome = { status: 'tag_provisioned', validationFingerprint: result.validationFingerprint };
        this.tagReceipt = { authorityKey: command.authorityKey, projection: current.projection, outcome };
        signal('tag_assigned', connected);
        return { status: 'succeeded' };
      }
      const status = result.status === 'authority_rejected' ? 'session_rejected'
        : result.status === 'tag_payload_already_registered' ? 'tag_already_registered'
          : result.status === 'assignment_target_unavailable' ? 'customer_unavailable'
            : result.status === 'invalid_request' ? 'invalid_input' : 'request_failed';
      outcome = { status };
      this.tagReceipt = { authorityKey: command.authorityKey, projection: current.projection, outcome: { status } };
      signal('failed', connected);
      return { status: 'failed', message: status === 'tag_already_registered' ? 'Karte bereits registriert. Die bisherige Zuordnung bleibt erhalten.'
        : status === 'customer_unavailable' ? 'Kunde nicht verfügbar. Aktualisiere die Ansicht.'
          : status === 'session_rejected' ? 'Sitzung nicht mehr gültig. Bitte melde dich erneut an.'
            : 'Noch keine Bestätigung. Versuche die Zuordnung in der App erneut.' };
    };
    try {
      if (!await this.isOnline()) {
        if (this.isCurrent(generation, snapshot)) {
          outcome = { status: 'setup_offline' }; signal('failed');
        }
        return;
      }
      if (!this.isCurrent(generation, snapshot)) return;
      // The card was already verified. An uncertain server reply needs the identical
      // command, not another physical write (or a newly discovered UID).
      if (this.pendingTag !== null) { await submit(); return; }
      const action: CapturedTagAction = async (capture, connected) => {
        if (!this.isCurrent(generation, snapshot) || connected?.isOpen() === false) return { status: 'cancelled' };
        this.setState({ status: 'writing', projection: current.projection });
        let written: TagWriteResult;
        try { written = await (connected ? this.writer.write(capture.payload, TAG_URI, connected) : this.writer.write(capture.payload, TAG_URI)); }
        catch { written = { status: 'failed', reason: 'write_failed' }; }
        if (!this.isCurrent(generation, snapshot) || connected?.isOpen() === false) return { status: 'cancelled' };
        if (written.status === 'failed') {
          outcome = written.reason === 'cancelled' ? { status: 'cancelled' } : { status: 'tag_write_failed', reason: written.reason };
          if (written.reason === 'cancelled') return { status: 'cancelled' };
          signal('failed', connected);
          return { status: 'failed', message: tagWriteErrorMessage(written.reason) };
        }
        this.pendingTag = { authorityKey: tagAuthorityKey(snapshot), commandId: this.createCommandId(), membershipId: snapshot.session.membershipId,
          customerId, displayName, canonicalPayload: capture.payload };
        return submit(connected);
      };
      const capture = this.nfc.scanWithTagAction ? await this.nfc.scanWithTagAction(action) : await this.nfc.scan();
      if (operation.sent || !this.isCurrent(generation, snapshot)) return;
      if (capture.status !== 'captured') {
        outcome ??= { status: capture.status === 'unavailable' ? 'nfc_unavailable' : capture.status };
        if (capture.status !== 'cancelled') signal('failed');
      } else if (!this.nfc.scanWithTagAction) await action(capture);
    } catch {
      if (this.isTagAuthorityCurrent(snapshot)) { outcome ??= { status: 'request_failed' }; signal('failed'); }
    } finally {
      if (this.tagOperation === operation) this.tagOperation = null;
      if (outcome !== null && this.isTagAuthorityCurrent(snapshot) && (operation.sent || generation === this.generation)) {
        // A projection fetch must never replace an already confirmed registration.
        this.setState({ status: 'ready', projection: current.projection, outcome });
        if ((outcome as AdminSetupOutcome).status === 'tag_provisioned') {
          const result = await this.api.readProjection(snapshot.session.membershipId, null).catch(() => null);
          if (this.isTagAuthorityCurrent(snapshot) && this.state.status === 'ready' && this.state.outcome === outcome && result?.status === 'succeeded') {
            this.projectionInvalidated = false;
            this.setState({ status: 'ready', projection: result, outcome });
          }
        }
      }
    }
  }

  async cancel(): Promise<void> {
    if (this.tagOperation?.sent) {
      // Navigation/background can dismiss NFC; they cannot unsend a command.
      void this.nfc.cancelCapture().catch(() => undefined);
      return;
    }
    if (this.pendingTag !== null) return;
    if (this.state.status === 'ready') { await this.refresh(); return; }
    this.generation += 1;
    await this.writer.cancel();
    await this.nfc.cancelCapture();
    await this.loadProjection({ status: 'cancelled' });
  }

  private isTagAuthorityCurrent(snapshot: NonNullable<ReturnType<AdminSessionContextReader['capture']>>): boolean {
    const current = this.session.capture();
    return this.active && current !== null && current.session.nfcSetupAvailable === true
      && current.session.membershipId === snapshot.session.membershipId
      && current.session.organizationId === snapshot.session.organizationId
      && current.session.userId === snapshot.session.userId;
  }

  private async onSessionChanged(): Promise<void> {
    const snapshot = this.session.capture();
    const operation = this.tagOperation;
    if (operation?.sent && this.isTagAuthorityCurrent(operation.snapshot)) {
      this.setState({ status: 'submitting', projection: operation.projection });
      return;
    }
    // Hide the previous account synchronously. Missing context keeps unresolved
    // evidence private; only a confirmed different identity discards that context.
    if (snapshot !== null) {
      const key = tagAuthorityKey(snapshot);
      if (this.pendingTag?.authorityKey !== key) this.pendingTag = null;
      if (this.tagReceipt?.authorityKey !== key) this.tagReceipt = null;
      if (operation && tagAuthorityKey(operation.snapshot) !== key) this.tagOperation = null;
    }
    this.setState(snapshot?.session.nfcSetupAvailable === false ? { status: 'not_authorized' } : { status: 'inactive' });
    this.pendingCustomer = null;
    this.pendingManagement = null;
    this.authorityGeneration += 1;
    this.projectionInvalidated = false;
    const generation = ++this.generation;
    await this.writer.cancel();
    if (generation !== this.generation) return;
    if (operation?.sent) void this.nfc.cancelCapture().catch(() => undefined);
    else await this.nfc.cancelCapture();
    if (snapshot === null || !this.isCurrent(generation, snapshot) || !snapshot.session.nfcSetupAvailable) return;
    const receipt = this.tagReceipt;
    if (receipt) this.setState({ status: 'ready', projection: receipt.projection, outcome: receipt.outcome });
    await this.loadProjection(receipt?.outcome ?? null, snapshot, generation);
  }

  private async loadProjection(outcome: AdminSetupOutcome | null, supplied = this.session.capture(), suppliedGeneration = ++this.generation): Promise<void> {
    const snapshot = supplied;
    if (!this.active || snapshot === null || snapshot.session.nfcSetupAvailable !== true) return;
    const generation = suppliedGeneration;
    const previous = 'projection' in this.state ? this.state.projection : null;
    this.projectionInvalidated = false;
    this.setState({ status: 'loading' });
    let result = await this.api.readProjection(snapshot.session.membershipId, null).catch(() => ({ status: 'unavailable' as const }));
    // Keep the newly created customer visible when a management refresh was deferred.
    const seen = new Set<string>();
    while (this.isCurrent(generation,snapshot) && result.status==='succeeded'
      && outcome?.status==='customer_created' && !result.customers.some(customer=>customer.id===outcome.customerId)
      && result.nextCursor!==null && !seen.has(result.nextCursor)) {
      const cursor=result.nextCursor;seen.add(cursor);
      const page=await this.api.readProjection(snapshot.session.membershipId,cursor);
      if(page.status!=='succeeded')break;
      const merged=mergeProjection(result,page,cursor);
      if(merged===null)break;
      result={status:'succeeded',...merged};
    }
    if (!this.isCurrent(generation, snapshot)) return;
    if(this.projectionInvalidated){await this.loadProjection(outcome,snapshot,generation);return;}
    if (result.status === 'succeeded') {
      this.setState({ status: 'ready', projection: { organization: result.organization, customers: result.customers, nfcTags: result.nfcTags, nextCursor: result.nextCursor }, outcome });
    } else if (result.status === 'authority_rejected') {
      this.setState({ status: 'inactive' });
    } else if (previous !== null && (outcome?.status === 'tag_provisioned' || this.pendingTag !== null)) {
      this.setState({ status: 'ready', projection: previous, outcome });
    } else {
      this.setState({ status: 'inactive' });
    }
  }

  private isCurrent(generation: number, snapshot: Parameters<AdminSessionContextReader['isCurrent']>[0]): boolean {
    return this.active && generation === this.generation && this.session.isCurrent(snapshot);
  }
  private isManagementCurrent(generation: number, snapshot: Parameters<AdminSessionContextReader['isCurrent']>[0]): boolean {
    return this.active && generation===this.authorityGeneration && this.session.isCurrent(snapshot);
  }
  private async finish(projection: Extract<AdminSetupState, { status: 'ready' }>['projection'], outcome: AdminSetupOutcome): Promise<void> {
    if(this.projectionInvalidated){
      const snapshot=this.session.capture(),generation=this.generation+1;
      await this.loadProjection(outcome).catch(()=>undefined);
      if(snapshot!==null&&this.isCurrent(generation,snapshot)){
        const current=this.state;
        if(outcome.status==='customer_created'){
          // Creation is already committed. A projection failure cannot erase its receipt.
          const refreshed=current.status==='ready'?current.projection:projection;
          this.setState({status:'ready',projection:refreshed,outcome:{...outcome,
            refreshFailed:current.status!=='ready'||!refreshed.customers.some(customer=>customer.id===outcome.customerId&&customer.active)}});
        }else if(current.status==='loading')this.setState({status:'inactive'});
      }
      return;
    }
    this.setState({ status: 'ready', projection, outcome });
  }
  private setState(state: AdminSetupState): void {
    const snapshot = this.session.capture();
    const pending = snapshot?.session.nfcSetupAvailable && this.pendingTag?.authorityKey === tagAuthorityKey(snapshot)
      ? this.pendingTag : null;
    this.state = Object.freeze(pending === null ? state : { ...state,
      pendingTag: { customerId: pending.customerId, displayName: pending.displayName } });
    for (const listener of this.listeners) listener();
  }
}

function mergeProjection(current: Extract<AdminSetupState, { status: 'ready' }>['projection'], next: Extract<Awaited<ReturnType<AdminSetupApiPort['readProjection']>>, { status: 'succeeded' }>, requestedCursor: string): Extract<AdminSetupState, { status: 'ready' }>['projection'] | null {
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

function tagWriteErrorMessage(reason: import('./NfcTagWriter').TagWriteFailureReason): string {
  switch (reason) {
    case 'read_only': return 'Diese Karte ist schreibgeschützt. Verwende eine beschreibbare Karte.';
    case 'capacity_exceeded': return 'Diese Karte hat nicht genug Speicher. Verwende eine andere Karte.';
    case 'ndef_not_supported': return 'Verwende eine beschreibbare NFC-Karte.';
    case 'tag_changed': return 'Halte dein Handy wieder an dieselbe Karte.';
    case 'write_failed': return 'Karte konnte nicht beschrieben werden. Halte dein Handy an der Karte und versuche es erneut.';
    case 'cancelled': return 'Einrichtung abgebrochen.';
  }
}

function tagAuthorityKey(snapshot: AdminSessionSnapshot): string {
  return JSON.stringify([snapshot.session.organizationId, snapshot.session.membershipId, snapshot.session.userId]);
}
