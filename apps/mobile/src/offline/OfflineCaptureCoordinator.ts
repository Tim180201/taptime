import {
  isCanonicalNfcUidPayload,
  type NfcScanCaptureResult,
  type NfcScanPort,
} from '@taptime/core';
import {
  OFFLINE_CLOCK_PROOF_VERSION,
  OFFLINE_CLOCK_TOLERANCE_MILLISECONDS,
  OFFLINE_PROVENANCE_VERSION,
  isCanonicalOfflineUuid,
  type OfflineCanonicalDecision,
} from '@taptime/offline-sync-contract';
import type { MobileSessionState } from '../auth/contracts';
import type { NfcCaptureLifecyclePort } from '../nfc/RnNfcScanAdapter';
import type {
  LifecycleEvidenceOutbox,
} from '../scan/LifecycleEvidenceOutbox';
import type {
  ProductScanCapability,
  ProductScanOutcome,
  ProductScanSessionContextReader,
  ProductScanSessionSnapshot,
  ProductScanState,
  SecureUuidGenerator,
} from '../scan/contracts';
import type { LifecycleEventApiPort } from '../transport/contracts';
import { AndroidMonotonicClock } from './AndroidMonotonicClock';
import {
  OfflineCaptureDatabase,
  type ActiveOfflineCaptureContext,
  type ActiveOfflineLeaseItem,
  type OfflineLifecycleEventDraft,
} from './OfflineCaptureDatabase';
import type { OfflineCaptureLeaseApiPort } from './OfflineCaptureLeaseClient';
import type { OfflineLifecycleApiPort } from './OfflineLifecycleClient';
import {
  OfflineInstallationIdentityStore,
  type OfflineInstallationSecrets,
} from './OfflineInstallationIdentityStore';
import { LegacyLifecycleEvidenceImporter } from './LegacyLifecycleEvidenceImporter';
import {
  mobileLookupHmac,
  mobileSha256Hex,
} from './MobileLookupHmac';
import {
  OfflineSyncScheduler,
  type OfflineSyncSchedulerState,
} from './OfflineSyncScheduler';
import { decodeBase64Url32, encodeBase64Url } from './encoding';

export interface OfflineCaptureSessionReader extends ProductScanSessionContextReader {
  getState(): MobileSessionState;
  retryContext(): Promise<void>;
}

export type OfflineDatabaseFactory = (
  databaseKey: Uint8Array,
) => OfflineCaptureDatabase;

export type OfflineSchedulerFactory = (
  database: OfflineCaptureDatabase,
  authorityRejection: { rejectOfflineCapture(): Promise<void> },
) => OfflineSyncScheduler;

export interface OfflineBackgroundSchedulerBinding {
  bind(scheduler: OfflineSyncScheduler | null): void;
}

type CaptureMode = 'authenticated' | 'offline';

export class OfflineCaptureCoordinator implements ProductScanCapability {
  private state: ProductScanState = Object.freeze({ status: 'inactive' });
  private readonly listeners = new Set<() => void>();
  private started = false;
  private generation = 0;
  private operationFlight: Promise<void> | null = null;
  private unsubscribeSession: (() => void) | null = null;
  private unsubscribeScheduler: (() => void) | null = null;
  private database: OfflineCaptureDatabase | null = null;
  private scheduler: OfflineSyncScheduler | null = null;
  private secrets: OfflineInstallationSecrets | null = null;
  private captureMode: CaptureMode | null = null;
  private protectedLegacy = false;

  constructor(
    private readonly nfcScan: NfcScanPort,
    private readonly nfcLifecycle: NfcCaptureLifecyclePort,
    private readonly session: OfflineCaptureSessionReader,
    private readonly identityStore: OfflineInstallationIdentityStore,
    private readonly databaseFactory: OfflineDatabaseFactory,
    private readonly leaseClient: OfflineCaptureLeaseApiPort,
    private readonly monotonicClock: AndroidMonotonicClock,
    private readonly schedulerFactory: OfflineSchedulerFactory,
    private readonly legacyOutbox: LifecycleEvidenceOutbox,
    private readonly createUuid: SecureUuidGenerator,
    private readonly backgroundBinding: OfflineBackgroundSchedulerBinding = { bind() {} },
    private readonly now: () => Date = () => new Date(),
  ) {}

  getState(): ProductScanState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const generation = ++this.generation;
    this.setState({ status: 'checking' });
    const ready = await this.initializeInfrastructure();
    if (!this.isCurrent(generation) || !ready) return;
    this.unsubscribeSession = this.session.subscribe(() => {
      void this.transitionToSession(++this.generation);
    });
    await this.transitionToSession(generation);
    if (!this.isCurrent(generation)) return;
    void this.scheduler?.trigger('runtime_start');
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.generation += 1;
    this.captureMode = null;
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.unsubscribeScheduler?.();
    this.unsubscribeScheduler = null;
    this.backgroundBinding.bind(null);
    this.scheduler?.stop();
    this.scheduler = null;
    await this.nfcLifecycle.stop();
    await this.database?.close().catch(() => undefined);
    this.database = null;
    this.setState({ status: 'inactive' });
  }

  scan(): Promise<void> {
    if (this.operationFlight !== null || !canStartScan(this.state)) {
      return this.operationFlight ?? Promise.resolve();
    }
    const operation = this.performScan(this.generation);
    let flight!: Promise<void>;
    flight = operation.finally(() => {
      if (this.operationFlight === flight) this.operationFlight = null;
    });
    this.operationFlight = flight;
    return flight;
  }

  async cancel(): Promise<void> {
    if (this.state.status === 'scanning') await this.nfcLifecycle.cancelCapture();
  }

  async retry(): Promise<void> {
    await this.scheduler?.trigger('manual');
  }

  async onExplicitLogout(): Promise<void> {
    await this.invalidateCapture(true);
  }

  async rejectOfflineCapture(): Promise<void> {
    await this.invalidateCapture(false);
  }

  triggerForeground(): void {
    this.restoreSessionAndSchedule('foreground');
  }

  triggerNetworkHint(): void {
    this.restoreSessionAndSchedule('network_hint');
  }

  private restoreSessionAndSchedule(trigger: 'foreground' | 'network_hint'): void {
    const restore = this.session.getState().status === 'context_unavailable'
      ? this.session.retryContext()
      : Promise.resolve();
    void restore
      .catch(() => undefined)
      .then(() => this.scheduler?.trigger(trigger))
      .catch(() => undefined);
  }

  private async initializeInfrastructure(): Promise<boolean> {
    let identity;
    try {
      identity = await this.identityStore.loadOrCreate();
    } catch {
      identity = { status: 'unavailable' } as const;
    }
    if (identity.status !== 'ready') {
      this.setState(identity.status === 'protected'
        ? { status: 'protected_pending', reason: 'local_evidence_protected' }
        : { status: 'secure_storage_unavailable' });
      return false;
    }
    this.secrets = identity.secrets;
    let database: OfflineCaptureDatabase;
    try {
      database = this.databaseFactory(identity.secrets.databaseKey);
    } catch {
      this.setState({ status: 'secure_storage_unavailable' });
      return false;
    }
    const initialized = await database.initialize();
    if (initialized.status !== 'ready') {
      this.setState({ status: 'protected_pending', reason: 'local_evidence_protected' });
      return false;
    }
    this.database = database;
    const imported = await new LegacyLifecycleEvidenceImporter(
      this.legacyOutbox,
      database,
      this.now,
    ).importOnce();
    if (imported.status === 'protected' && imported.reason === 'review_predecessor') {
      this.protectedLegacy = true;
    } else if (imported.status !== 'ready') {
      this.setState({ status: 'protected_pending', reason: 'local_evidence_protected' });
      return false;
    }
    this.scheduler = this.schedulerFactory(database, {
      rejectOfflineCapture: () => this.rejectOfflineCapture(),
    });
    this.scheduler.start();
    this.unsubscribeScheduler = this.scheduler.subscribe(() => this.onSchedulerState());
    this.backgroundBinding.bind(this.scheduler);
    return true;
  }

  private async transitionToSession(generation: number): Promise<void> {
    if (!this.started || this.database === null) return;
    this.captureMode = null;
    await this.nfcLifecycle.cancelCapture();
    if (!this.isCurrent(generation)) return;
    if (this.protectedLegacy) {
      this.setState({ status: 'protected_pending', reason: 'legacy_membership_unknown' });
      return;
    }

    const snapshot = this.session.capture();
    if (snapshot !== null) {
      await this.prepareAuthenticatedCapture(snapshot, generation);
      return;
    }
    const sessionState = this.session.getState();
    if (sessionState.status === 'context_unavailable') {
      const offline = await this.readValidOfflineContext();
      if (!this.isCurrent(generation)) return;
      if (offline !== null) {
        this.captureMode = 'offline';
        await this.publishReady('offline');
        return;
      }
    }
    if (
      sessionState.status === 'signed_out'
      || (
        sessionState.status === 'unauthenticated'
        && sessionState.reason === 'authority_rejected'
      )
    ) {
      await this.invalidateCapture(sessionState.status === 'signed_out');
    }
    if (this.isCurrent(generation)) this.setState({ status: 'inactive' });
  }

  private async prepareAuthenticatedCapture(
    snapshot: ProductScanSessionSnapshot,
    generation: number,
  ): Promise<void> {
    const database = this.database;
    let secrets = this.secrets;
    if (database === null) return;
    if (secrets === null) {
      const loaded = await this.identityStore.loadOrCreate();
      if (loaded.status !== 'ready') {
        this.setState({ status: 'secure_storage_unavailable' });
        return;
      }
      secrets = loaded.secrets;
      this.secrets = secrets;
    }
    const decodedBinding = decodeBase64Url32(secrets.installationBinding);
    if (decodedBinding === null) {
      this.setState({ status: 'secure_storage_unavailable' });
      return;
    }
    const bound = await database.bindOwner({
      organizationId: snapshot.session.organizationId,
      userId: snapshot.session.userId,
      membershipId: snapshot.session.membershipId,
      installationBindingDigest: mobileSha256Hex(decodedBinding),
    });
    if (!this.isCurrent(generation) || !this.session.isCurrent(snapshot)) return;
    if (bound.status !== 'ready') {
      this.setState({ status: 'protected_pending', reason: 'identity_mismatch' });
      return;
    }
    this.setState({ status: 'checking' });
    const commandId = this.createUuid();
    if (!isCanonicalOfflineUuid(commandId)) {
      this.setState({ status: 'unavailable' });
      return;
    }
    const result = await this.leaseClient.issueComplete({
      commandId,
      installationBinding: secrets.installationBinding,
      lookupKey: encodeBase64Url(secrets.lookupKey),
    });
    if (!this.isCurrent(generation) || !this.session.isCurrent(snapshot)) return;
    if (result.status === 'authority_rejected') {
      await this.rejectOfflineCapture();
      this.setReady({ status: 'session_rejected' });
      return;
    }
    if (
      result.status === 'ready'
      && sameSessionLease(result.page, snapshot)
    ) {
      let activationSample;
      try {
        activationSample = await this.monotonicClock.sample();
      } catch {
        activationSample = null;
      }
      if (activationSample !== null) {
        const activated = await database.activateLease({
          page: result.page,
          activationBootMarker: activationSample.bootMarker,
          activationMonotonicMilliseconds: activationSample.elapsedRealtimeMilliseconds,
        });
        if (activated.status === 'ready') {
          this.captureMode = 'authenticated';
          await this.publishReady('authenticated');
          void this.scheduler?.trigger('session_restored');
          return;
        }
      }
    }

    // A refresh failure may not destroy a still-valid exact local generation.
    const fallback = await this.readValidAuthenticatedContext(snapshot);
    if (!this.isCurrent(generation) || !this.session.isCurrent(snapshot)) return;
    if (fallback !== null) {
      this.captureMode = 'authenticated';
      await this.publishReady('authenticated');
      void this.scheduler?.trigger('session_restored');
      return;
    }
    this.setState(result.status === 'incomplete_or_oversize'
      ? { status: 'protected_pending', reason: 'local_evidence_protected' }
      : { status: 'unavailable' });
  }

  private async performScan(generation: number): Promise<void> {
    const database = this.database;
    const secrets = this.secrets;
    const mode = this.captureMode;
    if (database === null || secrets === null || mode === null) return;
    this.setState({ status: 'scanning' });
    let capture: NfcScanCaptureResult;
    try {
      capture = await this.nfcScan.scan();
    } catch {
      capture = { status: 'unavailable' };
    }
    if (!this.isCurrent(generation)) return;
    if (capture.status !== 'captured') {
      await this.publishReady(mode, captureOutcome(capture.status));
      return;
    }
    if (!isCanonicalNfcUidPayload(capture.payload) || capture.capturedAt === undefined) {
      await this.publishReady(mode, { status: 'unreadable' });
      return;
    }
    const item = await database.lookupActiveItem(
      mobileLookupHmac(secrets.lookupKey, capture.payload),
    );
    if (!this.isCurrent(generation)) return;
    if (item === null) {
      await this.publishReady(mode, { status: 'tag_not_assigned' });
      return;
    }
    let sample;
    try {
      sample = await this.monotonicClock.sample();
    } catch {
      sample = {
        bootMarker: 'native-clock-unavailable',
        elapsedRealtimeMilliseconds: 0,
      };
    }
    let workEventId: string;
    let receiptId: string;
    try {
      workEventId = this.createUuid();
      receiptId = this.createUuid();
    } catch {
      await this.publishReady(mode, { status: 'nfc_unavailable' });
      return;
    }
    if (
      !isCanonicalOfflineUuid(workEventId)
      || !isCanonicalOfflineUuid(receiptId)
      || workEventId === receiptId
    ) {
      await this.publishReady(mode, { status: 'nfc_unavailable' });
      return;
    }
    const context = await database.readActiveCaptureContext();
    if (
      context === null
      || context.leaseId !== item.leaseId
      || context.organizationId.length === 0
      || context.membershipId.length === 0
    ) {
      this.setState({ status: 'protected_pending', reason: 'local_evidence_protected' });
      return;
    }
    const clock = clockEvidence(item, sample);
    const draft: OfflineLifecycleEventDraft = Object.freeze({
      organizationId: context.organizationId,
      expectedMembershipId: context.membershipId,
      leaseId: item.leaseId,
      leaseItemId: item.leaseItemId,
      installationBinding: secrets.installationBinding,
      provenanceVersion: OFFLINE_PROVENANCE_VERSION,
      clock,
      workEvent: Object.freeze({
        id: workEventId,
        assignmentId: item.assignmentId,
        nfcTagId: item.nfcTagId,
        target: Object.freeze({
          targetType: item.targetType,
          targetId: item.targetId,
        }),
        occurredAt: capture.capturedAt,
      }),
      receipt: Object.freeze({ id: receiptId, attemptNumber: 1 }),
    });
    const appended = await database.appendEvent(draft);
    if (!this.isCurrent(generation)) return;
    if (appended.status === 'full') {
      await this.publishReady(mode, { status: 'queue_full' });
      return;
    }
    if (appended.status !== 'ready') {
      this.setState({ status: 'protected_pending', reason: 'local_evidence_protected' });
      return;
    }
    const queueCount = await database.queueCount();
    this.setState({ status: 'saved_locally', queueCount });
    void this.scheduler?.trigger('event_append');
  }

  private async publishReady(
    mode: CaptureMode,
    outcome: ProductScanOutcome | null = null,
  ): Promise<void> {
    let capability;
    try {
      capability = await this.nfcLifecycle.checkCapability();
    } catch {
      capability = 'unavailable' as const;
    }
    if (!this.started || this.captureMode !== mode) return;
    if (capability !== 'ready') {
      this.setState(capability === 'unavailable'
        ? { status: 'unavailable' }
        : { status: capability });
      return;
    }
    const queueCount = await this.database?.queueCount().catch(() => 0) ?? 0;
    if (mode === 'offline') {
      this.setState({ status: 'offline_ready', queueCount, outcome });
    } else {
      this.setState({ status: 'ready', outcome });
    }
  }

  private async readValidAuthenticatedContext(
    snapshot: ProductScanSessionSnapshot,
  ): Promise<ActiveOfflineCaptureContext | null> {
    const context = await this.readValidOfflineContext();
    return context !== null
      && context.organizationId === snapshot.session.organizationId
      && context.userId === snapshot.session.userId
      && context.membershipId === snapshot.session.membershipId
      && context.role === snapshot.session.role
      ? context
      : null;
  }

  private async readValidOfflineContext(): Promise<ActiveOfflineCaptureContext | null> {
    const context = await this.database?.readActiveCaptureContext() ?? null;
    if (context === null) return null;
    let sample;
    try {
      sample = await this.monotonicClock.sample();
    } catch {
      return null;
    }
    if (
      sample.bootMarker !== context.activationBootMarker
      || sample.elapsedRealtimeMilliseconds < context.activationMonotonicMilliseconds
    ) return null;
    const estimatedServerTime = Date.parse(context.issuedAt)
      + sample.elapsedRealtimeMilliseconds
      - context.activationMonotonicMilliseconds;
    const wallTime = this.now().getTime();
    if (
      !Number.isFinite(estimatedServerTime)
      || estimatedServerTime > Date.parse(context.expiresAt)
      || Math.abs(wallTime - estimatedServerTime) > OFFLINE_CLOCK_TOLERANCE_MILLISECONDS
    ) return null;
    return context;
  }

  private onSchedulerState(): void {
    if (this.operationFlight !== null) return;
    const schedulerState = this.scheduler?.getState();
    if (schedulerState === undefined) return;
    switch (schedulerState.status) {
      case 'idle':
        if (this.captureMode !== null) void this.publishReady(this.captureMode);
        return;
      case 'synchronizing':
        this.setState({
          status: 'synchronizing',
          queueCount: schedulerState.queueCount,
        });
        return;
      case 'retry_wait':
        this.setState({
          status: 'saved_locally',
          queueCount: schedulerState.queueCount,
        });
        return;
      case 'review_pending':
        this.setState({
          status: 'server_review_pending',
          queueCount: schedulerState.queueCount,
        });
        return;
      case 'server_decision':
        this.setState({
          status: 'server_decision',
          outcome: decisionOutcome(schedulerState.decision),
          queueCount: schedulerState.queueCount,
        });
        return;
      case 'protected':
        this.setState({
          status: 'protected_pending',
          reason: 'local_evidence_protected',
        });
        return;
      case 'authority_rejected':
        this.setReady({ status: 'session_rejected' });
        return;
      default:
        return schedulerState satisfies never;
    }
  }

  private async invalidateCapture(removeLookupKey: boolean): Promise<void> {
    this.captureMode = null;
    await this.nfcLifecycle.cancelCapture().catch(() => undefined);
    await this.database?.invalidateCapture().catch(() => undefined);
    if (removeLookupKey) {
      await this.identityStore.removeActiveLookupKey().catch(() => undefined);
      this.secrets?.lookupKey.fill(0);
      this.secrets = null;
    }
    this.setState({ status: 'inactive' });
  }

  private isCurrent(generation: number): boolean {
    return this.started && generation === this.generation;
  }

  private setReady(outcome: ProductScanOutcome): void {
    this.setState({ status: 'ready', outcome: Object.freeze(outcome) });
  }

  private setState(state: ProductScanState): void {
    this.state = Object.freeze(state);
    for (const listener of this.listeners) listener();
  }
}

function sameSessionLease(
  page: {
    readonly userId: string;
    readonly organizationId: string;
    readonly membershipId: string;
    readonly role: 'administrator' | 'employee';
  },
  snapshot: ProductScanSessionSnapshot,
): boolean {
  return page.userId === snapshot.session.userId
    && page.organizationId === snapshot.session.organizationId
    && page.membershipId === snapshot.session.membershipId
    && page.role === snapshot.session.role;
}

function canStartScan(state: ProductScanState): boolean {
  return state.status === 'ready'
    || state.status === 'offline_ready'
    || state.status === 'saved_locally'
    || state.status === 'server_review_pending'
    || state.status === 'server_decision';
}

function clockEvidence(
  item: ActiveOfflineLeaseItem,
  sample: { readonly bootMarker: string; readonly elapsedRealtimeMilliseconds: number },
) {
  const verified = sample.bootMarker === item.activationBootMarker
    && sample.elapsedRealtimeMilliseconds >= item.activationMonotonicMilliseconds;
  return Object.freeze({
    bootMarker: sample.bootMarker,
    monotonicAnchorMilliseconds: item.activationMonotonicMilliseconds,
    monotonicDeltaMilliseconds: verified
      ? sample.elapsedRealtimeMilliseconds - item.activationMonotonicMilliseconds
      : 0,
    wallClockAnchor: item.issuedAt,
    clockProofStatus: verified ? 'verified_same_boot' as const : 'review_only' as const,
    clockProofVersion: OFFLINE_CLOCK_PROOF_VERSION,
  });
}

function captureOutcome(
  status: Exclude<NfcScanCaptureResult['status'], 'captured'>,
): ProductScanOutcome {
  switch (status) {
    case 'unreadable':
      return { status: 'unreadable' };
    case 'timed_out':
      return { status: 'timed_out' };
    case 'cancelled':
      return { status: 'cancelled' };
    case 'unavailable':
      return { status: 'nfc_unavailable' };
    default:
      return status satisfies never;
  }
}

function decisionOutcome(decision: OfflineCanonicalDecision): ProductScanOutcome {
  switch (decision.status) {
    case 'time_entry_started':
      return { status: 'time_entry_started' };
    case 'time_entry_stopped':
      return { status: 'time_entry_stopped' };
    case 'duplicate_scan_ignored':
      return { status: 'duplicate_scan_ignored' };
    case 'active_entry_for_other_target_rejected':
      return { status: 'active_entry_for_other_target_rejected' };
    case 'escalation_required':
      return { status: 'escalation_required' };
    default:
      return decision satisfies never;
  }
}
