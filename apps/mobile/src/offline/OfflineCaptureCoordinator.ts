import {manualCaptureOutcome} from '../work/manualCaptureFeedback';
import { projectOwnTime, ownTimeOwnerKey, EMPTY_OWN_TIME_DISPLAY, type ConfirmedOwnTime, type OwnTimeDisplay, type OwnTimeEvidence, type OwnTimeOwner } from '../work/ProvisionalOwnTime';
import { OrganizationId, UserId, WorkEventId, createTimestamp, type WorkEvent } from '@taptime/core';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import { OfflineSecureStoreError } from './OfflineSecureStoreError';
import { alwaysForeground, type SessionActivity } from '../runtime/MobileAppActivity';
import type { OfflineMembershipRole } from '@taptime/offline-sync-contract';
import type { OfflineAccountStorage } from './OfflineAccountStorage';
import { OfflineAccountStorageError } from './OfflineCaptureDiagnostic';
import {
  isCanonicalNfcUidPayload,
  type NfcScanCaptureResult,
  type NfcScanPort,
} from '@taptime/core';
import {
  OFFLINE_CLOCK_PROOF_VERSION,
  OFFLINE_CLOCK_TOLERANCE_MILLISECONDS,
  OFFLINE_PROVENANCE_VERSION_V2,
  OFFLINE_PROVENANCE_VERSION_V3,
  isCanonicalOfflineUuid,
  type OfflineCanonicalDecision,
} from '@taptime/offline-sync-contract';
import type { SafeWorkTarget } from '@taptime/mobile-work-contract';
import type {
  InternalOfflineRestorationSnapshot,
  MobileSessionState,
} from '../auth/contracts';
import type { NfcCaptureLifecyclePort } from '../nfc/RnNfcScanAdapter';
import type { NativeNfcIngressCaptureEvidence } from '../nfc/NativeNfcIngress';
import type {
  LifecycleEvidenceOutbox,
} from '../scan/LifecycleEvidenceOutbox';
import type {
  ProductScanCapability,
  ProductScanOutcome,
  ProductScanProtectionClass,
  ProductScanSessionContextReader,
  ProductScanSessionSnapshot,
  ProductScanState,
  SecureUuidGenerator,
} from '../scan/contracts';
import { PRODUCT_SCAN_PROTECTION_CLASS } from '../scan/contracts';
import type { LifecycleEventApiPort } from '../transport/contracts';
import { AndroidMonotonicClock } from './AndroidMonotonicClock';
import {
  OfflineCaptureDatabase,
  type ActiveOfflineCaptureContext,
  type ActiveOfflineLeaseItem,
  type OfflineLifecycleEventDraft,
  type OfflineDatabaseOwner,
} from './OfflineCaptureDatabase';
import type { OfflineCaptureLeaseApiPort } from './OfflineCaptureLeaseClient';
import type { OfflineLifecycleApiPort } from './OfflineLifecycleClient';
import {
  OfflineInstallationIdentityStore,
  type OfflineInstallationSecrets,
} from './OfflineInstallationIdentityStore';
import { LegacyLifecycleEvidenceImporter } from './LegacyLifecycleEvidenceImporter';
import { reportOfflineProtectionDiagnostic } from './OfflineCaptureDiagnostic';
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
  isOfflineCaptureRestorationAllowed(): boolean;
  captureOfflineRestorationSnapshot(): InternalOfflineRestorationSnapshot | null;
  isOfflineRestorationSnapshotCurrent(
    snapshot: InternalOfflineRestorationSnapshot,
  ): boolean;
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

export type OfflineSignOutPreparation =
  | { readonly wait: false }
  | { readonly wait: true; readonly accountKey: string };

interface NativeNfcIngressAuthoritySnapshot {
  readonly generation: number;
  readonly mode: CaptureMode;
  readonly restorationSnapshot: InternalOfflineRestorationSnapshot | null;
  readonly offlineCaptureContext: ActiveOfflineCaptureContext | null;
  readonly validFromBootMarker: string;
  readonly processStartElapsedRealtimeMilliseconds: number | null;
  readonly validFromElapsedRealtimeMilliseconds: number;
}

interface SessionTransitionFlight {
  readonly generation: number;
  readonly promise: Promise<void>;
}

type NativeNfcSessionBinding =
  | { readonly authenticated: ProductScanSessionSnapshot }
  | { readonly restoration: InternalOfflineRestorationSnapshot;
      readonly owner: Pick<OfflineDatabaseOwner, 'organizationId' | 'userId' | 'membershipId'> | null };

export type ManualOfflineCaptureResult =
  | { readonly status: 'saved'; readonly workEventId: string }
  | { readonly status: 'full' | 'protected' | 'unavailable' };

export type ManualOfflineAcknowledgement =
  | { readonly status: 'pending' | 'review_pending' | 'protected' | 'rejected' | 'not_transferred' }
  | {
      readonly status: 'server_decision';
      readonly outcome:
        | 'time_entry_started'
        | 'time_entry_stopped'
        | 'duplicate_scan_ignored'
        | 'active_entry_for_other_target_rejected'
        | 'break_started'
        | 'break_stopped'
        | 'break_without_active_time_entry_rejected'
        | 'work_trigger_during_break_rejected'
        | 'work_location_unavailable'
        | 'escalation_required';
    };

export interface ManualOfflineCapturePort {
  getOwnTimeDisplay?():OwnTimeDisplay;
  subscribeOwnTimeDisplay?(listener:()=>void):()=>void;
  subscribeOwnTimeConfirmationRequests?(listener:()=>void):()=>void;
  ownTimeReadFence?():number;
  ownTimeReadStartedAt?():Promise<string|null>;
  confirmOwnTime?(owner:OwnTimeOwner,value:MobileOwnTimeQueryResponse,fence:number,readStartedAt:string|null):Promise<void>;

  prepareActiveCapture?(): Promise<boolean>;
  activeCaptureRejection?(): import('../lockScreen/contracts').CaptureRejection|null;
  finishActiveCapture?(): Promise<void>;
  captureManual(target: {
    readonly targetType: 'customer' | 'project' | 'general_work';
    readonly targetId: string;
  }): Promise<ManualOfflineCaptureResult>;
  captureBreak?(): Promise<ManualOfflineCaptureResult>;
  readManualAcknowledgement?(workEventId: string): ManualOfflineAcknowledgement | null;
  subscribeManualAcknowledgements?(listener: () => void): () => void;
  hasUnconfirmedCapture?(): Promise<boolean>;
}

export interface OfflineManualCaptureCapability extends ManualOfflineCapturePort {
  readOfflineManualTargets(): Promise<
    | { readonly status: 'ready'; readonly targets: readonly SafeWorkTarget[] }
    | { readonly status: 'unavailable' | 'protected' }
  >;
}

export class OfflineCaptureCoordinator implements ProductScanCapability {
  private ownTimeDisplay:OwnTimeDisplay=EMPTY_OWN_TIME_DISPLAY;
  private ownTimeListeners=new Set<()=>void>();
  private ownTimeExpiry:ReturnType<typeof setTimeout>|null=null;
  private confirmationListeners=new Set<()=>void>();
  subscribeOwnTimeConfirmationRequests=(listener:()=>void)=>{this.confirmationListeners.add(listener);return()=>{this.confirmationListeners.delete(listener);};};
  private requestOwnTimeConfirmation(){for(const listener of this.confirmationListeners)listener();}
  private ownTimeRevision=0;
  private ownTimeRefresh:Promise<void>|null=null;
  private ownTimeRefreshRequested=false;
  private ownTimeBase:ConfirmedOwnTime|null=null;
  private ownTimeBaseOwner:string|null=null;
  private ownTimeEvidence=new Map<string,OwnTimeEvidence>();
  private ownTimeDiverged=false;
  private lastPrediction:OwnTimeDisplay|null=null;
  private ownTimeServerIds=new Map<string,string>();
  getOwnTimeDisplay=()=>this.ownTimeDisplay;
  subscribeOwnTimeDisplay=(listener:()=>void)=>{this.ownTimeListeners.add(listener);return()=>{this.ownTimeListeners.delete(listener);};};
  ownTimeReadFence=()=>this.ownTimeRevision;
  async ownTimeReadStartedAt():Promise<string|null>{
    const database=this.database,generation=this.generation,revision=this.ownTimeRevision,snapshot=this.session.capture();
    if(!this.started||!database||!snapshot)return null;
    const clock=await this.readValidOfflineClock();
    if(!clock||database!==this.database||generation!==this.generation||revision!==this.ownTimeRevision
      ||!this.started||!this.session.isCurrent(snapshot)
      ||ownTimeOwnerKey(clock.context)!==ownTimeOwnerKey(snapshot.session)||clock.context.role!==snapshot.session.role)return null;
    return new Date(clock.estimatedServerTime).toISOString();
  }
  private clearOwnTimeMemory(){
    if(this.ownTimeExpiry)clearTimeout(this.ownTimeExpiry);this.ownTimeExpiry=null;
    this.ownTimeRevision++;this.ownTimeBase=null;this.ownTimeBaseOwner=null;this.ownTimeEvidence.clear();this.ownTimeDiverged=false;this.lastPrediction=null;this.ownTimeServerIds.clear();
    this.publishOwnTime(EMPTY_OWN_TIME_DISPLAY);
  }
  private publishOwnTime(value:OwnTimeDisplay){if(value.known&&value.pending)this.lastPrediction=value;this.ownTimeDisplay=Object.freeze(value);for(const listener of this.ownTimeListeners)listener();}
  async confirmOwnTime(owner:OwnTimeOwner,value:MobileOwnTimeQueryResponse,fence:number,readStartedAt:string|null):Promise<void>{
    const database=this.database,generation=this.generation,snapshot=this.session.capture();
    const current=()=>this.started&&database===this.database&&generation===this.generation&&fence===this.ownTimeRevision
      &&snapshot!==null&&this.session.isCurrent(snapshot)&&ownTimeOwnerKey(snapshot.session)===ownTimeOwnerKey(owner);
    if(!database||!current()||readStartedAt===null)return;
    const active=value.activeRecord;
    if(active&&(!active.targetId||!active.calendar))return;
    const base:ConfirmedOwnTime={activeTimeId:active?.timeRecordId??null,
      target:active?{targetType:active.targetType,targetId:active.targetId!,displayName:active.targetDisplayName}:null,
      startedAt:active?.startedAt??null,breakStartedAt:active?.breakStartedAt??null,confirmedAt:active?.calendar?.asOf??readStartedAt};
    if(!await database.saveConfirmedOwnTime(owner,base,current)||!current())return;
    const expected=this.lastPrediction??this.ownTimeDisplay;
    const signature=(r:OwnTimeDisplay['activeRecord'])=>JSON.stringify(r?[r.targetType,r.targetId,r.startedAt,r.breakStartedAt??null]:null);
    const actual=projectOwnTime(base,owner,[]);
    const expectedId=expected.activeRecord?(this.ownTimeServerIds.get(expected.activeRecord.timeRecordId)
      ??(expected.activeRecord.timeRecordId===this.ownTimeBase?.activeTimeId?expected.activeRecord.timeRecordId:null)):null;
    const changed=expected.pending&&(signature(expected.activeRecord)!==signature(actual.activeRecord)
      ||expectedId!==null&&expectedId!==actual.activeRecord?.timeRecordId);
    this.ownTimeBase=base;this.ownTimeBaseOwner=ownTimeOwnerKey(owner);this.ownTimeEvidence.clear();this.ownTimeDiverged=false;this.lastPrediction=null;this.ownTimeServerIds.clear();
    this.publishOwnTime({...actual,notice:changed?'Der Server hat einen anderen Stand bestätigt. Es gilt der angezeigte Serverstand.':this.ownTimeDisplay.notice});
    await this.refreshOwnTimeDisplay();
  }
  private refreshOwnTimeDisplay():Promise<void>{
    if(this.ownTimeRefresh){this.ownTimeRefreshRequested=true;return this.ownTimeRefresh;}
    this.ownTimeRefresh=(async()=>{do{this.ownTimeRefreshRequested=false;await this.readOwnTimeDisplay();}while(this.ownTimeRefreshRequested);})()
      .catch(()=>this.publishOwnTime({...EMPTY_OWN_TIME_DISPLAY,notice:'Der Offline-Stand ist gerade nicht verfügbar.'}))
      .finally(()=>{this.ownTimeRefresh=null;});
    return this.ownTimeRefresh;
  }
  private async readOwnTimeDisplay(){
    const database=this.database,generation=this.generation,snapshot=this.session.capture(),restoration=this.offlineRestorationSnapshot;
    if(!this.started||!database||!this.captureMode)return;
    // Without a persisted or in-memory baseline there is nothing to replay. Do not
    // consume clock samples or infer an idle state merely because the queue is empty.
    const ownerHint=snapshot?.session??this.offlineCaptureContext;
    if(!ownerHint)return;
    const cached=await database.readConfirmedOwnTime(ownerHint);
    if(!cached&&!this.ownTimeBase)return;
    const context=snapshot?await this.readValidAuthenticatedContext(snapshot):await this.readValidOfflineContext();
    const current=()=>this.started&&database===this.database&&generation===this.generation&&(snapshot?this.session.isCurrent(snapshot):this.isCaptureCurrent(generation,'offline',restoration));
    if(!current())return;
    if(!context){this.clearOwnTimeMemory();await database.clearConfirmedOwnTime();return;}
    const owner=ownTimeOwnerKey(context);
    if(this.ownTimeBaseOwner!==owner){this.clearOwnTimeMemory();this.ownTimeBaseOwner=owner;}
    const base=cached;
    const rows=await database.readOwnTimeEvidence();
    if(!current())return;
    if(base&&!this.ownTimeEvidence.size)this.ownTimeBase=base;
    const initial=this.ownTimeBase;
    if(!initial||Date.parse(initial.confirmedAt)<Date.parse(context.issuedAt)||this.ownTimeDiverged){
      this.publishOwnTime({...EMPTY_OWN_TIME_DISPLAY,owner,notice:this.ownTimeDisplay.notice});return;
    }
    for(const {command,displayName} of rows){
      if(command.organizationId!==context.organizationId||command.expectedMembershipId!==context.membershipId)throw Error('Foreign display evidence');
      const event=command.workEvent;
      // Legacy evidence cannot be interpreted with a guessed subject or identity.
      if(command.provenanceVersion!==3){this.publishOwnTime({...EMPTY_OWN_TIME_DISPLAY,owner});return;}
      if(!('trigger' in event)||!event.trigger){this.publishOwnTime({...EMPTY_OWN_TIME_DISPLAY,owner});return;}
      const trigger=event.trigger;
      const resolved={...event,id:WorkEventId(event.id),organizationId:OrganizationId(context.organizationId),triggeredBy:UserId(context.userId),
        occurredAt:createTimestamp(event.occurredAt),...(trigger.type==='nfc'?{assignmentId:trigger.assignmentId,nfcTagId:trigger.nfcTagId}:{})} as WorkEvent;
      this.ownTimeEvidence.set(event.id,{sequence:command.deviceSequence,event:resolved,displayName});
    }
    const projected=projectOwnTime(initial,context,[...this.ownTimeEvidence.values()]);
    if(this.ownTimeExpiry)clearTimeout(this.ownTimeExpiry);
    this.ownTimeExpiry=setTimeout(()=>{this.ownTimeExpiry=null;void this.refreshOwnTimeDisplay();},Math.max(1,Date.parse(context.expiresAt)-this.now().getTime()+1));
    this.publishOwnTime({...projected,validUntil:context.expiresAt,notice:this.ownTimeDisplay.notice});
  }

  private state: ProductScanState = Object.freeze({ status: 'inactive' });
  private readonly listeners = new Set<() => void>();
  private started = false;
  private generation = 0;
  private operationFlight: Promise<void> | null = null;
  private sessionTransitionFlight: SessionTransitionFlight | null = null;
  private grantRefreshFlight: Promise<void> | null = null;
  private unsubscribeSession: (() => void) | null = null;
  private unsubscribeScheduler: (() => void) | null = null;
  private database: OfflineCaptureDatabase | null = null;
  private scheduler: OfflineSyncScheduler | null = null;
  private secrets: OfflineInstallationSecrets | null = null;
  private captureMode: CaptureMode | null = null;
  private offlineRestorationSnapshot: InternalOfflineRestorationSnapshot | null = null;
  private offlineCaptureContext: ActiveOfflineCaptureContext | null = null;
  private nativeNfcIngressAuthority: NativeNfcIngressAuthoritySnapshot | null = null;
  private nativeNfcIngressRuntimeStartSession: NativeNfcSessionBinding | null = null;
  private nativeNfcIngressWindow: {
    readonly session: NativeNfcSessionBinding;
    readonly authority: NativeNfcIngressAuthoritySnapshot;
  } | null = null;
  private nativeNfcRetryRequired = false;
  private nativeNfcInitialOwner: OfflineDatabaseOwner | null = null;
  private nativeNfcScanSession: NativeNfcSessionBinding | null = null;
  private nativeNfcSessionTransitionPending = false;
  private visibleWorkEventId: string | null = null;
  private visibleTerminalOutcome: ProductScanOutcome | null = null;
  private protectedLegacy = false;
  private ownerSession: ProductScanSessionSnapshot | null = null;
  private readonly manualFlights = new Set<Promise<ManualOfflineCaptureResult>>();
  private readonly manualAcknowledgements = new Map<string, ManualOfflineAcknowledgement>();
  private readonly manualAcknowledgementListeners = new Set<() => void>();
  private untransferred: NonNullable<ProductScanState['untransferred']> = [];
  private updateRequired = false;
  private transmissionPaused = false;
  private transmissionRetryAvailable = false;
  private logoutOwner: OfflineDatabaseOwner | null = null;
  private logoutWaiting = false;

  constructor(
    private readonly nfcScan: NfcScanPort,
    private readonly nfcLifecycle: NfcCaptureLifecyclePort,
    private readonly session: OfflineCaptureSessionReader,
    private readonly identityStore: Pick<OfflineInstallationIdentityStore, 'loadOrCreate' | 'removeActiveLookupKey'>,
    private readonly databaseFactory: OfflineDatabaseFactory,
    private readonly leaseClient: OfflineCaptureLeaseApiPort,
    private readonly monotonicClock: AndroidMonotonicClock,
    private readonly schedulerFactory: OfflineSchedulerFactory,
    private readonly legacyOutbox: LifecycleEvidenceOutbox,
    private readonly createUuid: SecureUuidGenerator,
    private readonly backgroundBinding: OfflineBackgroundSchedulerBinding = { bind() {} },
    private readonly now: () => Date = () => new Date(),
    private readonly accountStorage?: OfflineAccountStorage,
    private readonly activity: SessionActivity = alwaysForeground,
  ) {}

  getState(): ProductScanState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeManualAcknowledgements(listener: () => void): () => void {
    this.manualAcknowledgementListeners.add(listener);
    return () => this.manualAcknowledgementListeners.delete(listener);
  }

  readManualAcknowledgement(workEventId: string): ManualOfflineAcknowledgement | null {
    return this.manualAcknowledgements.get(workEventId) ?? null;
  }

  /** Private runtime context; no credentials are exposed to screens. */
  async lockScreenInstallationId(): Promise<string | null> {
    const database=this.database, generation=this.generation, snapshot=this.session.capture();
    if(!database || !snapshot)return null;
    const current=()=>database===this.database && generation===this.generation
      && this.canSynchronize() && this.session.isCurrent(snapshot);
    if(!current())return null;
    try {
      const context=await database.readActiveCaptureContext();
      if(!context || !current() || context.organizationId!==snapshot.session.organizationId
        || context.userId!==snapshot.session.userId || context.membershipId!==snapshot.session.membershipId)return null;
      return context.installationId;
    } catch {return null;}
  }

  async hasUnconfirmedCapture(): Promise<boolean> {
    const database=this.database, generation=this.generation, snapshot=this.session.capture();
    const restoration=this.offlineRestorationSnapshot, offlineContext=this.offlineCaptureContext;
    const authority=snapshot?.session ?? offlineContext;
    const current=()=>database===this.database && generation===this.generation && (snapshot
      ? this.canSynchronize() && this.session.isCurrent(snapshot)
      : offlineContext!==null && this.offlineCaptureContext===offlineContext
        && this.isCaptureCurrent(generation,'offline',restoration));
    if(!database || !authority || !current())return true;
    try {
      const [owner,count,review]=await Promise.all([database.readOwner(),database.queueCount(),database.readReviewPendingSequence()]);
      if(!current() || !owner || owner.organizationId!==authority.organizationId
        || owner.userId!==authority.userId || owner.membershipId!==authority.membershipId)return true;
      return count>0 || review!==null;
    } catch {return true;}
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const generation = ++this.generation;
    this.setState({ status: 'checking' });
    const ready = await this.initializeInfrastructure();
    if (!this.isCurrent(generation) || !ready) return;
    this.unsubscribeSession = this.session.subscribe(() => {
      const next=this.session.capture()?.session;
      const state=this.session.getState();
      if(next&&this.ownTimeBaseOwner&&ownTimeOwnerKey(next)!==this.ownTimeBaseOwner
        ||state.status==='signed_out'||state.status==='unauthenticated'&&state.reason==='authority_rejected') {
        this.clearOwnTimeMemory();void this.database?.clearConfirmedOwnTime().catch(()=>undefined);
      } else if(!next&&state.status!=='context_unavailable') {
        this.clearOwnTimeMemory();
      }
      // Revoke synchronously: leaving and returning to the same account must not
      // revive a launch card. Token refresh retains the authenticated generation.
      this.revokeChangedNativeNfcSession();
      if (this.operationFlight !== null && this.nativeNfcScanSession !== null) {
        // Finish an already consumed card under its unchanged owner before renewing
        // the lease. Account changes revoke the binding above and still abort immediately.
        this.nativeNfcSessionTransitionPending = true;
        return;
      }
      const snapshot = this.session.capture();
      if (this.logoutOwner && snapshot && sameAccount(snapshot, this.logoutOwner)) {
        this.ownerSession = snapshot;
        this.scheduler?.start();
        return;
      }
      if (this.logoutOwner && this.session.getState().status === 'context_unavailable') {
        this.pauseSynchronization();
        return;
      }
      this.logoutOwner = null;
      this.logoutWaiting = false;
      if (this.canPreserveActiveOfflineCapture()) return;
      this.pauseSynchronization();
      this.untransferred = [];
      this.captureMode = null;
      this.visibleTerminalOutcome = null; this.visibleWorkEventId = null;
      if (this.state.status !== 'inactive' && this.state.status !== 'checking') this.setState({ status: 'checking' });
      void this.scheduleSessionTransition(++this.generation);
    });
    await this.scheduleSessionTransition(generation);
    if (!this.isCurrent(generation)) return;
    void this.scheduler?.trigger('runtime_start');
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.untransferred = [];
    this.transmissionPaused=false;this.logoutOwner=null;this.logoutWaiting=false;
    this.generation += 1;
    this.captureMode = null;
    this.offlineRestorationSnapshot = null;
    this.offlineCaptureContext = null;
    this.nativeNfcIngressAuthority = null;
    this.nativeNfcIngressRuntimeStartSession = null;
    this.nativeNfcIngressWindow = null;
    this.nativeNfcRetryRequired = false;
    this.nativeNfcInitialOwner = null;
    this.nativeNfcScanSession = null;
    this.nativeNfcSessionTransitionPending = false;
    this.visibleTerminalOutcome = null;
    this.visibleWorkEventId = null;
    const transition = this.sessionTransitionFlight?.promise;
    this.sessionTransitionFlight = null;
    this.clearOwnTimeMemory();
    this.manualAcknowledgements.clear();
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.unsubscribeScheduler?.();
    this.unsubscribeScheduler = null;
    this.backgroundBinding.bind(null);
    const scheduler = this.scheduler;
    this.pauseSynchronization();
    this.scheduler = null;
    await this.nfcLifecycle.stop();
    await Promise.all([transition, this.operationFlight, ...this.manualFlights, scheduler?.whenIdle?.()].map(p => p?.catch(() => undefined)));
    await this.database?.close().catch(() => undefined);
    this.database = null;
    this.setState({ status: 'inactive' });
  }

  scan(): Promise<void> {
    return this.startScan(false);
  }

  scanNativeNfcIngress(): Promise<void> {
    return this.startScan(true);
  }

  private startScan(nativeIngress: boolean): Promise<void> {
    if (this.operationFlight !== null || !canStartScan(this.state)) {
      return this.operationFlight ?? Promise.resolve();
    }
    this.nativeNfcRetryRequired = false;
    this.nativeNfcScanSession = nativeIngress ? this.readNativeNfcSession() : null;
    const operation = this.performScan(this.generation, nativeIngress);
    let flight!: Promise<void>;
    flight = operation.finally(() => {
      if (this.operationFlight === flight) this.operationFlight = null;
      this.nativeNfcScanSession = null;
      if (this.nativeNfcSessionTransitionPending) {
        this.nativeNfcSessionTransitionPending = false;
        if (this.started) {
          this.pauseSynchronization();
          this.captureMode = null;
          void this.scheduleSessionTransition(++this.generation);
        }
      }
    });
    this.operationFlight = flight;
    return flight;
  }

  bindNativeNfcIngressRuntimeStart(): void {
    this.nativeNfcIngressRuntimeStartSession = this.started ? this.readNativeNfcSession() : null;
  }

  unbindNativeNfcIngressRuntimeStart(): void {
    this.nativeNfcIngressRuntimeStartSession = null;
  }

  nativeNfcIngressDiscarded(): void {
    if (!this.started) return;
    this.nativeNfcRetryRequired = true;
    this.setState(this.state);
  }

  async captureNativeNfcIngressAuthority(
    evidence: NativeNfcIngressCaptureEvidence,
  ): Promise<object | null> {
    // A delivered Intent waits for grant renewal, without moving the runtime's
    // evidence boundary forward. Never bind a morning tap to yesterday's lease.
    while (this.started) {
      const generation = this.generation;
      await this.grantRefreshFlight?.catch(() => undefined);
      await this.sessionTransitionFlight?.promise.catch(() => undefined);
      if (generation === this.generation) break;
    }
    this.revokeChangedNativeNfcSession();
    const authority = this.nativeNfcIngressAuthority;
    const followsPublishedAuthority = authority !== null
      && evidence.elapsedRealtimeMilliseconds
        > authority.validFromElapsedRealtimeMilliseconds;
    const startedCurrentRuntime = authority !== null
      && evidence.intentOrigin === 'process_start_intent'
      && this.nativeNfcIngressRuntimeStartSession !== null
      && this.isNativeNfcSessionCurrent(this.nativeNfcIngressRuntimeStartSession)
      && evidence.processStartElapsedRealtimeMilliseconds
        === authority.processStartElapsedRealtimeMilliseconds
      && evidence.processStartElapsedRealtimeMilliseconds
        <= evidence.elapsedRealtimeMilliseconds
      && evidence.elapsedRealtimeMilliseconds
        <= authority.validFromElapsedRealtimeMilliseconds;
    return authority !== null
      && this.operationFlight === null
      && canStartScan(this.state)
      && evidence.bootMarker === authority.validFromBootMarker
      && (evidence.intentOrigin === 'process_start_intent' ? startedCurrentRuntime : followsPublishedAuthority)
      && this.isNativeNfcIngressAuthorityCurrent(authority)
      ? authority
      : null;
  }

  isNativeNfcIngressAuthorityCurrent(snapshot: object): boolean {
    const authority = this.nativeNfcIngressAuthority;
    return snapshot === authority
      && authority !== null
      && this.isCaptureCurrent(
        authority.generation,
        authority.mode,
        authority.restorationSnapshot,
      )
      && (
        authority.mode === 'authenticated'
        || (
          authority.offlineCaptureContext !== null
          && this.offlineCaptureContext !== null
          && sameActiveCaptureContext(
            this.offlineCaptureContext,
            authority.offlineCaptureContext,
          )
        )
      );
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

  async prepareSignOut(): Promise<OfflineSignOutPreparation> {
    const database = this.database, generation = this.generation;
    if (!database) return {wait: false};
    const owner = await database.readOwner();
    const snapshot = this.session.capture();
    const restoration = this.offlineRestorationSnapshot;
    const context = this.offlineCaptureContext;
    const authenticated = snapshot !== null && this.canSynchronize() && owner !== null && sameAccount(snapshot, owner);
    const offline = this.captureMode === 'offline' && restoration !== null && context !== null && owner !== null
      && this.session.isOfflineRestorationSnapshotCurrent(restoration)
      && context.organizationId === owner.organizationId && context.userId === owner.userId
      && context.membershipId === owner.membershipId;
    if (database !== this.database || !this.isCurrent(generation) || !owner || (!authenticated && !offline)) return {wait: false};
    // Freeze new capture before waiting for writes already in flight. Keep A's authority for
    // archive reconciliation; a context outage suspends RPCs without enabling capture again.
    this.logoutOwner = owner;
    ++this.generation;
    this.captureMode = null;
    this.nativeNfcIngressAuthority = null;
    await this.nfcLifecycle.cancelCapture();
    await Promise.all([this.sessionTransitionFlight?.promise, this.operationFlight,
      ...this.manualFlights, this.scheduler?.whenIdle()]);
    if (database !== this.database || !this.isLogoutOwnerCurrent(true)) return {wait: false};
    const block = await database.readOwnerReleaseBlock();
    if (!this.isLogoutOwnerCurrent(true) || block !== 'archive_pending') return {wait: false};
    this.logoutWaiting = true;
    this.setState({status: 'archive_signout_pending'});
    return {wait: true, accountKey: `${owner.organizationId}/${owner.membershipId}/${owner.userId}`};
  }

  async cancelSignOut(): Promise<void> {
    if (!this.logoutWaiting) return;
    this.logoutWaiting = false;
    this.logoutOwner = null;
    // Re-enter through the ordinary live session/owner checks, including offline
    // restoration. Retained evidence and its archive requirement stay untouched.
    this.setState({status:'checking'});
    await this.scheduleSessionTransition(++this.generation);
  }

  async pollArchiveForSignOut(): Promise<boolean> {
    const database = this.database;
    if (!database || !this.logoutWaiting || !this.isLogoutOwnerCurrent()) return false;
    await this.scheduler?.reconcileArchives(true);
    if (database !== this.database || !this.logoutWaiting || !this.isLogoutOwnerCurrent()) return false;
    const block = await database.readOwnerReleaseBlock();
    return block === null && this.logoutWaiting && this.isLogoutOwnerCurrent();
  }

  private isLogoutOwnerCurrent(allowOffline = false): boolean {
    const snapshot = this.session.capture();
    return this.started && this.logoutOwner !== null && (
      snapshot !== null && sameAccount(snapshot, this.logoutOwner) && this.canSynchronize()
      || allowOffline && this.session.getState().status === 'context_unavailable'
    );
  }

  async rejectOfflineCapture(): Promise<void> {
    await this.invalidateCapture(false);
  }

  triggerForeground(): void {
    void this.refreshOfflineGrant().catch(() => undefined);
    this.restoreSessionAndSchedule('foreground');
  }

  refreshOfflineGrant(): Promise<void> {
    if (this.grantRefreshFlight !== null) return this.grantRefreshFlight;
    const flight = this.renewOfflineGrant().finally(() => {
      if (this.grantRefreshFlight === flight) this.grantRefreshFlight = null;
    });
    this.grantRefreshFlight = flight;
    return flight;
  }

  private async renewOfflineGrant(): Promise<void> {
    if(this.logoutOwner!==null)return;
    await Promise.all([this.operationFlight, ...this.manualFlights].map(flight=>flight?.catch(()=>undefined)));
    const session = this.session.capture();
    if (!this.started || session === null || this.database === null) return;
    const generation = ++this.generation;
    await this.scheduleSessionTransition(generation);
  }

  private async refreshTransferIssues(): Promise<void> {
    const database = this.database, generation = this.generation;
    const mayRead=()=>this.canSynchronize() || this.captureMode==='offline' && this.offlineCaptureContext!==null
      && this.offlineRestorationSnapshot!==null && this.session.isOfflineRestorationSnapshotCurrent(this.offlineRestorationSnapshot);
    if (!database || !mayRead()) return;
    let issues;
    try {issues=await database.readUntransferredCaptures();}
    catch {
      if(generation===this.generation && database===this.database && mayRead()) {
        this.pauseSynchronization();
        this.captureMode=null;
        this.setState(protectedScanState('local_evidence_protected',PRODUCT_SCAN_PROTECTION_CLASS.databaseIntegrity));
      }
      return;
    }
    if (generation !== this.generation || database !== this.database || !mayRead()) return;
    if (JSON.stringify(this.untransferred) !== JSON.stringify(issues)) {
      this.untransferred = issues;
      this.setState(this.state);
    }
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
    let opened: Awaited<ReturnType<OfflineAccountStorage['open']>> | undefined;
    let identity;
    try {
      opened = await this.accountStorage?.open();
      identity = opened ? { status: 'ready' as const, secrets: opened.secrets } : await this.identityStore.loadOrCreate();
    } catch (error) {
      if (error instanceof OfflineSecureStoreError) {
        this.setState(nativeSecureStoreFailureState(this.accountStorage !== undefined));
        return false;
      }
      if (error instanceof OfflineAccountStorageError) {
        this.setState(protectedScanState('local_evidence_protected', error.protection));
        return false;
      }
      identity = this.accountStorage ? { status: 'protected', reason: 'missing_key' } as const : { status: 'unavailable' } as const;
    }
    if (identity.status !== 'ready') {
      this.setState(identity.status === 'protected'
        ? protectedScanState(
            'local_evidence_protected',
            PRODUCT_SCAN_PROTECTION_CLASS.secureIdentity,
          )
        : classifiedScanState(
            { status: 'secure_storage_unavailable' },
            PRODUCT_SCAN_PROTECTION_CLASS.secureIdentity,
          ));
      return false;
    }
    this.secrets = identity.secrets;
    let database: OfflineCaptureDatabase;
    try {
      database = opened?.database ?? this.databaseFactory(identity.secrets.databaseKey);
    } catch {
      this.setState(classifiedScanState(
        { status: 'secure_storage_unavailable' },
        PRODUCT_SCAN_PROTECTION_CLASS.databaseInitialization,
      ));
      return false;
    }
    let initialized;
    try {
      initialized = await database.initialize((error) => {
        reportOfflineProtectionDiagnostic(
          PRODUCT_SCAN_PROTECTION_CLASS.databaseMigration,
          error,
        );
      });
    } catch {
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.databaseInitialization,
      ));
      return false;
    }
    if (initialized.status !== 'ready') {
      const protection = initialized.status === 'migration_failed'
        ? PRODUCT_SCAN_PROTECTION_CLASS.databaseMigration
        : initialized.status === 'protected'
          ? PRODUCT_SCAN_PROTECTION_CLASS.databaseIntegrity
          : PRODUCT_SCAN_PROTECTION_CLASS.databaseInitialization;
      this.setState(protectedScanState('local_evidence_protected', protection));
      return false;
    }
    this.database = database;
    // Retain the owner before any restoration can replace it. An offline→online
    // continuation must prove all three IDs as well as the auth generation.
    try { this.nativeNfcInitialOwner = await database.readOwner(); }
    catch { this.nativeNfcInitialOwner = null; }
    let imported;
    try {
      imported = await new LegacyLifecycleEvidenceImporter(
        this.legacyOutbox,
        database,
        this.now,
      ).importOnce();
    } catch {
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.legacyImport,
      ));
      return false;
    }
    if (imported.status === 'protected' && imported.reason === 'review_predecessor') {
      this.protectedLegacy = true;
    } else if (imported.status !== 'ready') {
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.legacyImport,
      ));
      return false;
    }
    try {
      this.scheduler = this.schedulerFactory(database, {
        rejectOfflineCapture: () => this.rejectOfflineCapture(),
      });
      this.scheduler.stop();
      this.unsubscribeScheduler = this.scheduler.subscribe(() => this.onSchedulerState());
      this.backgroundBinding.bind(this.scheduler);
    } catch {
      this.unsubscribeScheduler?.();
      this.unsubscribeScheduler = null;
      this.scheduler?.stop();
      this.scheduler = null;
      try {
        this.backgroundBinding.bind(null);
      } catch {
        // The stopped scheduler remains unusable even if the optional native binding rejects.
      }
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.schedulerDurableState,
      ));
      return false;
    }
    return true;
  }

  private scheduleSessionTransition(generation: number): Promise<void> {
    const prior = this.sessionTransitionFlight?.promise;
    const promise = (prior ?? Promise.resolve()).catch(() => undefined).then(() => this.transitionToSession(generation));
    const flight = Object.freeze({ generation, promise });
    this.sessionTransitionFlight = flight;
    void promise.then(() => {
      if (this.sessionTransitionFlight === flight) {
        this.sessionTransitionFlight = null;
      }
    }, () => {
      if (this.sessionTransitionFlight === flight) {
        this.sessionTransitionFlight = null;
      }
    });
    return promise;
  }

  private async transitionToSession(generation: number): Promise<void> {
    if (!this.isCurrent(generation) || this.database === null) return;
    const nextOwner=this.session.capture()?.session;
    const storedOwner=await this.database.readOwner();
    if(!this.isCurrent(generation))return;
    if(nextOwner&&storedOwner&&ownTimeOwnerKey(nextOwner)!==ownTimeOwnerKey(storedOwner)){
      this.clearOwnTimeMemory();await this.database.clearConfirmedOwnTime();
    }
    this.captureMode = null;
    this.offlineRestorationSnapshot = null;
    this.offlineCaptureContext = null;
    this.nativeNfcIngressAuthority = null;
    this.revokeChangedNativeNfcSession();
    await this.nfcLifecycle.cancelCapture();
    if (!this.isCurrent(generation)) return;
    if (this.protectedLegacy) {
      this.setState(protectedScanState(
        'legacy_membership_unknown',
        PRODUCT_SCAN_PROTECTION_CLASS.legacyImport,
      ));
      return;
    }

    const snapshot = this.session.capture();
    if (snapshot !== null) {
      await this.prepareAuthenticatedCapture(snapshot, generation);
      return;
    }
    const sessionState = this.session.getState();
    const restorationSnapshot = this.session.captureOfflineRestorationSnapshot();
    if (
      sessionState.status === 'context_unavailable'
      && restorationSnapshot !== null
      && this.session.isOfflineCaptureRestorationAllowed()
    ) {
      const offline = await this.readValidOfflineContext();
      if (
        !this.isCurrent(generation)
        || !this.session.isOfflineRestorationSnapshotCurrent(restorationSnapshot)
      ) return;
      if (offline !== null) {
        this.offlineRestorationSnapshot = restorationSnapshot;
        this.offlineCaptureContext = offline;
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
    if(this.isCurrent(generation)){this.clearOwnTimeMemory();this.setState({ status: 'inactive' });}
  }

  private async prepareAuthenticatedCapture(
    snapshot: ProductScanSessionSnapshot,
    generation: number,
  ): Promise<void> {
    const database = this.database;
    let secrets = this.secrets;
    if (database === null) return;
    if (secrets === null) {
      let loaded;
      try { loaded = await this.identityStore.loadOrCreate(); }
      catch (error) {
        if (!(error instanceof OfflineSecureStoreError)) throw error;
        this.setState(nativeSecureStoreFailureState(this.accountStorage !== undefined));
        return;
      }
      if (loaded.status !== 'ready') {
        this.setState(classifiedScanState(
          { status: 'secure_storage_unavailable' },
          PRODUCT_SCAN_PROTECTION_CLASS.secureIdentity,
        ));
        return;
      }
      secrets = loaded.secrets;
      this.secrets = secrets;
    }
    const decodedBinding = decodeBase64Url32(secrets.installationBinding);
    if (decodedBinding === null) {
      this.setState(classifiedScanState(
        { status: 'secure_storage_unavailable' },
        PRODUCT_SCAN_PROTECTION_CLASS.secureIdentity,
      ));
      return;
    }
    if (this.accountStorage) {
      try {
        const old = await database.readOwner();
        if (old !== null && (old.organizationId !== snapshot.session.organizationId
          || old.userId !== snapshot.session.userId || old.membershipId !== snapshot.session.membershipId)) {
          const allowed = async () => this.isCurrent(generation) && this.session.isCurrent(snapshot)
            && this.operationFlight === null && this.manualFlights.size === 0
            && ![...this.manualAcknowledgements.values()].some(a => a.status === 'pending')
            && !(this.scheduler?.isBusy() ?? false) && await this.legacyOutbox.read() === null;
          const switched = await this.accountStorage.switchOwner(database, secrets, snapshot.session, allowed);
          if (!switched) {
            const block = await database.readOwnerReleaseBlock();
            this.setState(protectedScanState(block === 'quarantine' ? block : 'identity_mismatch', PRODUCT_SCAN_PROTECTION_CLASS.ownerBinding));
            return;
          }
          this.unsubscribeScheduler?.();
          this.scheduler?.stop();
          this.database = switched.database; this.secrets = switched.secrets;
          this.manualAcknowledgements.clear(); this.visibleWorkEventId = null; this.visibleTerminalOutcome = null;
          this.transmissionPaused=false;
          this.scheduler = this.schedulerFactory(switched.database, { rejectOfflineCapture: () => this.rejectOfflineCapture() });
          this.scheduler.stop();
          this.unsubscribeScheduler = this.scheduler.subscribe(() => this.onSchedulerState());
          this.backgroundBinding.bind(this.scheduler);
          if (this.isCurrent(generation) && this.session.isCurrent(snapshot)) await this.prepareAuthenticatedCapture(snapshot, generation);
          return;
        }
      } catch (error) {
        this.setState(protectedScanState('local_evidence_protected', error instanceof OfflineAccountStorageError ? error.protection : PRODUCT_SCAN_PROTECTION_CLASS.ownerBinding));
        return;
      }
    }
    let bound;
    try {
      bound = await database.bindOwner({
        organizationId: snapshot.session.organizationId,
        userId: snapshot.session.userId,
        membershipId: snapshot.session.membershipId,
        installationBindingDigest: mobileSha256Hex(decodedBinding),
      });
    } catch {
      if (this.isCurrent(generation) && this.session.isCurrent(snapshot)) {
        this.setState(protectedScanState(
          'identity_mismatch',
          PRODUCT_SCAN_PROTECTION_CLASS.ownerBinding,
        ));
      }
      return;
    }
    if (!this.isCurrent(generation) || !this.session.isCurrent(snapshot)) return;
    if (bound.status !== 'ready') {
      this.setState(protectedScanState(
        'identity_mismatch',
        PRODUCT_SCAN_PROTECTION_CLASS.ownerBinding,
      ));
      return;
    }
    this.ownerSession = snapshot;
    this.scheduler?.start();
    this.setState({ status: 'checking' });
    let commandId: string;
    try {
      commandId = this.createUuid();
    } catch {
      this.setState(classifiedScanState(
        { status: 'unavailable' },
        PRODUCT_SCAN_PROTECTION_CLASS.leaseCompleteness,
      ));
      return;
    }
    if (!isCanonicalOfflineUuid(commandId)) {
      this.setState(classifiedScanState(
        { status: 'unavailable' },
        PRODUCT_SCAN_PROTECTION_CLASS.leaseCompleteness,
      ));
      return;
    }
    let result;
    try {
      result = this.leaseClient.issueCompleteV3 === undefined
        ? { status: 'unavailable' as const }
        : await this.leaseClient.issueCompleteV3({
            commandId,
            installationBinding: secrets.installationBinding,
            lookupKey: encodeBase64Url(secrets.lookupKey),
          });
    } catch {
      result = { status: 'unavailable' as const };
    }
    if (!this.isCurrent(generation) || !this.session.isCurrent(snapshot)) return;
    if (result.status === 'authority_rejected') {
      await this.rejectOfflineCapture();
      this.setReady({ status: 'session_rejected' });
      return;
    }
    let readinessProtection: ProductScanProtectionClass | null = null;
    if (result.status === 'ready' && sameSessionLease(result.page, snapshot)) {
      let activationSample;
      try {
        activationSample = await this.monotonicClock.sample();
      } catch {
        activationSample = null;
      }
      if (activationSample !== null) {
        let activated;
        try {
          activated = await database.activateLease({
            page: result.page,
            activationBootMarker: activationSample.bootMarker,
            activationMonotonicMilliseconds: activationSample.elapsedRealtimeMilliseconds,
          });
        } catch {
          activated = { status: 'protected' as const };
        }
        if (activated.status === 'ready') {
          this.captureMode = 'authenticated';
          await this.publishReady('authenticated');
          this.requestOwnTimeConfirmation();
          void this.scheduler?.trigger('session_restored');
          return;
        }
        readinessProtection = activated.status === 'full'
          ? PRODUCT_SCAN_PROTECTION_CLASS.leaseCompleteness
          : PRODUCT_SCAN_PROTECTION_CLASS.leaseActivation;
      } else {
        readinessProtection = PRODUCT_SCAN_PROTECTION_CLASS.leaseActivation;
      }
    } else if (result.status === 'ready' || result.status === 'incomplete_or_oversize') {
      readinessProtection = PRODUCT_SCAN_PROTECTION_CLASS.leaseCompleteness;
    }

    // A refresh failure may not destroy a still-valid exact local generation.
    let fallback: ActiveOfflineCaptureContext | null;
    try {
      fallback = await this.readValidAuthenticatedContext(snapshot);
    } catch {
      if (this.isCurrent(generation) && this.session.isCurrent(snapshot)) {
        this.setState(protectedScanState(
          'local_evidence_protected',
          readinessProtection
            ?? PRODUCT_SCAN_PROTECTION_CLASS.schedulerDurableState,
        ));
      }
      return;
    }
    if (!this.isCurrent(generation) || !this.session.isCurrent(snapshot)) return;
    if (fallback !== null) {
      this.captureMode = 'authenticated';
      await this.publishReady('authenticated');
      this.requestOwnTimeConfirmation();
      void this.scheduler?.trigger('session_restored');
      return;
    }
    this.clearOwnTimeMemory();
    await database.clearConfirmedOwnTime();
    if (result.status === 'incomplete_or_oversize') {
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.leaseCompleteness,
      ));
      return;
    }
    this.setState(readinessProtection === null
      ? { status: 'unavailable' }
      : classifiedScanState({ status: 'unavailable' }, readinessProtection));
  }

  private async performScan(generation: number, nativeIngress = false): Promise<void> {
    this.ownTimeRevision++;
    const database = this.database;
    const secrets = this.secrets;
    const mode = this.captureMode;
    if (database === null || secrets === null || mode === null) return;
    const restorationSnapshot = mode === 'offline'
      ? this.offlineRestorationSnapshot
      : null;
    const expectedOfflineContext = mode === 'offline'
      ? this.offlineCaptureContext
      : null;
    if (
      mode === 'offline'
      && (restorationSnapshot === null || expectedOfflineContext === null)
    ) return;
    this.visibleTerminalOutcome = null;
    this.setState({ status: 'scanning' });
    let capture: NfcScanCaptureResult;
    try {
      capture = await this.nfcScan.scan();
    } catch {
      capture = { status: 'unavailable' };
    }
    const isCurrentCapture = () => {
      const current = nativeIngress
        ? this.isCurrent(generation) && this.captureMode === mode && this.logoutOwner === null
          && this.nativeNfcScanSession !== null && this.isNativeNfcSessionCurrent(this.nativeNfcScanSession)
        : this.isCaptureCurrent(generation, mode, restorationSnapshot);
      if (!current && nativeIngress && capture.status === 'captured') this.nativeNfcIngressDiscarded();
      return current;
    };
    if (!isCurrentCapture()) return;
    if (capture.status !== 'captured') {
      await this.publishReady(mode, captureOutcome(capture.status));
      return;
    }
    if (!isCanonicalNfcUidPayload(capture.payload) || capture.capturedAt === undefined) {
      await this.publishReady(mode, { status: 'unreadable' });
      return;
    }
    let item;
    try {
      item = await database.lookupActiveItem(mobileLookupHmac(secrets.lookupKey, capture.payload));
    } catch (error) {
      if (!nativeIngress) throw error;
      this.nativeNfcIngressDiscarded();
      return;
    }
    if (!isCurrentCapture()) return;
    if (item === null || item.itemType !== 'nfc_assignment') {
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
    let context;
    try { context = await database.readActiveCaptureContext(); }
    catch (error) {
      if (!nativeIngress) throw error;
      this.nativeNfcIngressDiscarded();
      return;
    }
    if (!isCurrentCapture()) return;
    if (
      context === null
      || context.leaseId !== item.leaseId
      || context.organizationId.length === 0
      || context.membershipId.length === 0
      || (
        expectedOfflineContext !== null
        && !sameActiveCaptureContext(context, expectedOfflineContext)
      )
    ) {
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.schedulerDurableState,
      ));
      return;
    }
    const clock = clockEvidence(item, sample);
    const commonDraft = {
      organizationId: context.organizationId,
      expectedMembershipId: context.membershipId,
      leaseId: item.leaseId,
      leaseItemId: item.leaseItemId,
      installationBinding: secrets.installationBinding,
      provenanceVersion: OFFLINE_PROVENANCE_VERSION_V3,
      clock,
      receipt: Object.freeze({ id: receiptId, attemptNumber: 1 as const }),
    } as const;
    const draft: OfflineLifecycleEventDraft = Object.freeze({
      ...commonDraft,
      workEvent: item.subjectType === 'break' ? Object.freeze({
        id: workEventId,
        subject: Object.freeze({ type: 'break' as const }),
        occurredAt: capture.capturedAt,
        trigger: Object.freeze({ type: 'nfc' as const,
          assignmentId: item.assignmentId, nfcTagId: item.nfcTagId }),
      }) : Object.freeze({
        id: workEventId,
        subject: Object.freeze({ type: 'work' as const }),
        target: Object.freeze({
          targetType: item.targetType,
          targetId: item.targetId,
        }),
        occurredAt: capture.capturedAt,
        trigger: Object.freeze({
          type: 'nfc' as const,
          assignmentId: item.assignmentId,
          nfcTagId: item.nfcTagId,
        }),
      }),
    });
    if (!isCurrentCapture()) return;
    const appended = await database.appendEvent(draft);
    if (!this.isCurrent(generation)) return;
    if (appended.status === 'full') {
      await this.publishReady(mode, { status: 'queue_full' });
      return;
    }
    if (appended.status !== 'ready') {
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.schedulerDurableState,
      ));
      return;
    }
    this.visibleWorkEventId = workEventId;
    const queueCount = await database.queueCount();
    if (!this.isCurrent(generation)) return;
    this.setState(mode === 'offline'
      ? { status: 'saved_locally', queueCount }
      : { status: 'synchronizing', queueCount });
    await this.refreshOwnTimeDisplay();
    void this.scheduler?.trigger('event_append');
  }

  captureManual(target: { readonly targetType: 'customer' | 'project' | 'general_work'; readonly targetId: string }): Promise<ManualOfflineCaptureResult> {
    this.ownTimeRevision++;
    return this.trackManual(() => this.performManual(target));
  }

  private async performManual(target: {
    readonly targetType: 'customer' | 'project' | 'general_work';
    readonly targetId: string;
  }): Promise<ManualOfflineCaptureResult> {
    const generation = this.generation;
    const database = this.database;
    const secrets = this.secrets;
    const mode = this.captureMode;
    const restorationSnapshot = mode === 'offline'
      ? this.offlineRestorationSnapshot
      : null;
    const expectedOfflineContext = mode === 'offline'
      ? this.offlineCaptureContext
      : null;
    if (
      database === null
      || secrets === null
      || mode === null
      || (
        mode === 'offline'
        && (restorationSnapshot === null || expectedOfflineContext === null)
      )
      || !isCanonicalOfflineUuid(target.targetId)
    ) return { status: 'unavailable' };
    const item = await database.lookupActiveManualTarget(target.targetType, target.targetId);
    if (
      !this.isCaptureCurrent(generation, mode, restorationSnapshot)
      || item?.itemType !== 'manual_target'
    ) {
      return { status: 'unavailable' };
    }
    let sample;
    try {
      sample = await this.monotonicClock.sample();
    } catch {
      return { status: 'unavailable' };
    }
    if (
      sample.wallClockMilliseconds === undefined
      || !Number.isSafeInteger(sample.wallClockMilliseconds)
    ) return { status: 'unavailable' };
    const context = await database.readActiveCaptureContext();
    if (
      !this.isCaptureCurrent(generation, mode, restorationSnapshot)
      || context === null
      || context.leaseId !== item.leaseId
      || (
        expectedOfflineContext !== null
        && !sameActiveCaptureContext(context, expectedOfflineContext)
      )
    ) return { status: 'protected' };
    let workEventId: string;
    let receiptId: string;
    try {
      workEventId = this.createUuid();
      receiptId = this.createUuid();
    } catch {
      return { status: 'unavailable' };
    }
    if (
      !isCanonicalOfflineUuid(workEventId)
      || !isCanonicalOfflineUuid(receiptId)
      || workEventId === receiptId
    ) return { status: 'unavailable' };
    const appended = await database.appendEvent(Object.freeze({
      organizationId: context.organizationId,
      expectedMembershipId: context.membershipId,
      leaseId: item.leaseId,
      leaseItemId: item.leaseItemId,
      installationBinding: secrets.installationBinding,
      provenanceVersion: OFFLINE_PROVENANCE_VERSION_V3,
      clock: clockEvidence(item, sample),
      workEvent: Object.freeze({
        id: workEventId,
        subject: Object.freeze({ type: 'work' as const }),
        target: Object.freeze({
          targetType: item.targetType,
          targetId: item.targetId,
        }),
        occurredAt: new Date(sample.wallClockMilliseconds).toISOString(),
        trigger: Object.freeze({ type: 'manual' as const }),
      }),
      receipt: Object.freeze({ id: receiptId, attemptNumber: 1 as const }),
    }));
    if (appended.status === 'full') return { status: 'full' };
    if (appended.status !== 'ready') return { status: 'protected' };
    if (!this.isCaptureCurrent(generation, mode, restorationSnapshot)) return {status:'saved',workEventId};
    this.visibleWorkEventId = workEventId;
    this.setManualAcknowledgement(workEventId, { status: 'pending' });
    await this.refreshOwnTimeDisplay();
    void this.scheduler?.trigger('event_append');
    return { status: 'saved', workEventId };
  }

  captureBreak(): Promise<ManualOfflineCaptureResult> {
    this.ownTimeRevision++;
    return this.trackManual(() => this.performBreak());
  }

  private async performBreak(): Promise<ManualOfflineCaptureResult> {
    const generation = this.generation;
    const database = this.database;
    const secrets = this.secrets;
    const mode = this.captureMode;
    const restorationSnapshot = mode === 'offline' ? this.offlineRestorationSnapshot : null;
    const expectedOfflineContext = mode === 'offline' ? this.offlineCaptureContext : null;
    if (database === null || secrets === null || mode === null
      || (mode === 'offline' && (restorationSnapshot === null
        || expectedOfflineContext === null))) return { status: 'unavailable' };
    const item = await database.lookupActiveManualBreak();
    if (!this.isCaptureCurrent(generation, mode, restorationSnapshot)
      || item?.itemType !== 'manual_break') return { status: 'unavailable' };
    let sample;
    try { sample = await this.monotonicClock.sample(); }
    catch { return { status: 'unavailable' }; }
    if (sample.wallClockMilliseconds === undefined
      || !Number.isSafeInteger(sample.wallClockMilliseconds)) return { status: 'unavailable' };
    const context = await database.readActiveCaptureContext();
    if (!this.isCaptureCurrent(generation, mode, restorationSnapshot)
      || context === null || context.leaseId !== item.leaseId
      || (expectedOfflineContext !== null
        && !sameActiveCaptureContext(context, expectedOfflineContext))) {
      return { status: 'protected' };
    }
    let workEventId: string;
    let receiptId: string;
    try { workEventId = this.createUuid(); receiptId = this.createUuid(); }
    catch { return { status: 'unavailable' }; }
    if (!isCanonicalOfflineUuid(workEventId) || !isCanonicalOfflineUuid(receiptId)
      || workEventId === receiptId) return { status: 'unavailable' };
    const appended = await database.appendEvent(Object.freeze({
      organizationId: context.organizationId,
      expectedMembershipId: context.membershipId,
      leaseId: item.leaseId,
      leaseItemId: item.leaseItemId,
      installationBinding: secrets.installationBinding,
      provenanceVersion: OFFLINE_PROVENANCE_VERSION_V3,
      clock: clockEvidence(item, sample),
      workEvent: Object.freeze({ id: workEventId,
        subject: Object.freeze({ type: 'break' as const }),
        occurredAt: new Date(sample.wallClockMilliseconds).toISOString(),
        trigger: Object.freeze({ type: 'manual' as const }) }),
      receipt: Object.freeze({ id: receiptId, attemptNumber: 1 as const }),
    }));
    if (appended.status === 'full') return { status: 'full' };
    if (appended.status !== 'ready') return { status: 'protected' };
    if (!this.isCaptureCurrent(generation, mode, restorationSnapshot)) return {status:'saved',workEventId};
    this.visibleWorkEventId = workEventId;
    this.setManualAcknowledgement(workEventId, { status: 'pending' });
    await this.refreshOwnTimeDisplay();
    void this.scheduler?.trigger('event_append');
    return { status: 'saved', workEventId };
  }

  async readOfflineManualTargets(): Promise<
    | { readonly status: 'ready'; readonly targets: readonly SafeWorkTarget[] }
    | { readonly status: 'unavailable' | 'protected' }
  > {
    const generation = this.generation;
    const restorationSnapshot = this.offlineRestorationSnapshot;
    const expectedContext = this.offlineCaptureContext;
    const database = this.database;
    const mode = this.captureMode;
    if(mode==='authenticated') {
      const snapshot=this.session.capture();
      if(snapshot===null || database===null || !this.session.isCurrent(snapshot))return {status:'unavailable'};
      const context=await this.readValidAuthenticatedContext(snapshot);
      if(context===null || !this.isCaptureCurrent(generation,mode,null) || !this.session.isCurrent(snapshot))return {status:'protected'};
      const targets=await database.listActiveManualTargets(context.leaseId);
      if(!this.isCaptureCurrent(generation,mode,null) || !this.session.isCurrent(snapshot))return {status:'protected'};
      return {status:'ready',targets};
    }
    if (
      this.captureMode !== 'offline'
      || restorationSnapshot === null
      || expectedContext === null
      || database === null
      || !this.session.isOfflineRestorationSnapshotCurrent(restorationSnapshot)
    ) return { status: 'unavailable' };
    const currentContext = await this.readValidOfflineContext();
    if (
      !this.isCaptureCurrent(generation, 'offline', restorationSnapshot)
      || currentContext === null
      || !sameActiveCaptureContext(currentContext, expectedContext)
    ) return { status: 'protected' };
    const targets = await database.listActiveManualTargets(currentContext.leaseId);
    if (
      !this.isCaptureCurrent(generation, 'offline', restorationSnapshot)
      || !this.session.isOfflineRestorationSnapshotCurrent(restorationSnapshot)
    ) return { status: 'protected' };
    return { status: 'ready', targets };
  }

  private async publishReady(
    mode: CaptureMode,
    outcome: ProductScanOutcome | null = null,
  ): Promise<void> {
    await this.refreshTransferIssues();
    if (outcome !== null) this.visibleTerminalOutcome = Object.freeze(outcome);
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
    const database = this.database;
    if (database === null) {
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.schedulerDurableState,
      ));
      return;
    }
    let queueCount: number;
    let reviewPendingSequence: number | null;
    try {
      [queueCount, reviewPendingSequence] = await Promise.all([
        database.queueCount(),
        database.readReviewPendingSequence(),
      ]);
    } catch {
      this.setState(protectedScanState(
        'local_evidence_protected',
        PRODUCT_SCAN_PROTECTION_CLASS.schedulerDurableState,
      ));
      return;
    }
    if (!this.started || this.captureMode !== mode) return;
    await this.ensureNativeNfcIngressAuthority(mode);
    if (!this.started || this.captureMode !== mode) return;
    if (reviewPendingSequence !== null) {
      this.setState({ status: 'server_review_pending', queueCount });
      return;
    }
    if (queueCount > 0 && this.visibleTerminalOutcome === null) {
      this.setState({ status: 'saved_locally', queueCount });
      return;
    }
    const visibleOutcome = outcome ?? this.visibleTerminalOutcome;
    if (mode === 'offline') {
      this.setState({ status: 'offline_ready', queueCount, outcome: visibleOutcome });
    } else {
      this.setState({ status: 'ready', outcome: visibleOutcome });
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
    return (await this.readValidOfflineClock())?.context??null;
  }

  private async readValidOfflineClock():Promise<{context:ActiveOfflineCaptureContext;estimatedServerTime:number}|null>{
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
    return {context,estimatedServerTime};
  }

  private onSchedulerState(): void {
    if (!this.canSynchronize()) return;
    const schedulerState = this.scheduler?.getState();
    if (schedulerState === undefined) return;
    if(['server_decision','review_pending','quarantined','authority_rejected'].includes(schedulerState.status)) {
      this.ownTimeRevision++;
      if('workEventId' in schedulerState){
        const expected=(this.lastPrediction??this.ownTimeDisplay).decisions.get(schedulerState.workEventId??'');
        if(schedulerState.status==='server_decision'&&schedulerState.decision.status==='time_entry_started')this.ownTimeServerIds.set(schedulerState.workEventId,schedulerState.decision.timeEntryId);
        const actual=schedulerState.status==='server_decision'?schedulerState.decision.status:schedulerState.status;
        if(expected&&expected!==actual){this.ownTimeDiverged=true;
          this.publishOwnTime({...EMPTY_OWN_TIME_DISPLAY,owner:this.ownTimeBaseOwner,notice:actual==='review_pending'
            ?'Der Server hat die Erfassung zur Prüfung vorgemerkt. Es gilt der Serverstand.'
            :schedulerState.status==='server_decision'?`Server: ${manualCaptureOutcome(decisionOutcome(schedulerState.decision).status as Extract<ManualOfflineAcknowledgement,{status:'server_decision'}>['outcome'])} Es gilt der Serverstand.`
            :'Die Erfassung konnte nicht übertragen werden. Bitte prüfe deine Zeiten.'});}
      }
    }
    if((this.ownTimeDisplay.pending||this.ownTimeDisplay.notice)
      &&['idle','server_decision','review_pending','quarantined'].includes(schedulerState.status))this.requestOwnTimeConfirmation();
    const wasPaused = this.transmissionPaused;
    this.transmissionPaused = schedulerState.status === 'transmission_paused';
    this.transmissionRetryAvailable = schedulerState.status === 'transmission_paused';
    if (schedulerState.status === 'update_required') this.updateRequired=true;
    if (this.operationFlight !== null) {
      if(wasPaused || schedulerState.status==='transmission_paused' || schedulerState.status==='update_required')this.setState(this.state);
      if(schedulerState.status==='quarantined') {
        this.setManualAcknowledgement(schedulerState.workEventId,{status:'not_transferred'});
        void this.refreshTransferIssues();
      }
      return;
    }
    if (schedulerState.status === 'review_pending' && schedulerState.workEventId !== undefined) {
      this.setManualAcknowledgement(schedulerState.workEventId, { status: 'review_pending' });
    }
    if (schedulerState.status === 'server_decision') {
      this.setManualAcknowledgement(schedulerState.workEventId, {
        status: 'server_decision',
        outcome: decisionOutcome(schedulerState.decision).status as Extract<
          ManualOfflineAcknowledgement, { status: 'server_decision' }
        >['outcome'],
      });
    }
    if ((schedulerState.status === 'server_decision' || schedulerState.status === 'review_pending')
      && this.visibleWorkEventId !== null && schedulerState.workEventId !== undefined
      && schedulerState.workEventId !== this.visibleWorkEventId) {
      // A predecessor's confirmation advances transmission but does not finish this tap.
      return;
    }
    switch (schedulerState.status) {
      case 'transmission_paused':
        this.transmissionPaused=true;
        this.setState({status:'saved_locally',queueCount:schedulerState.queueCount});
        void this.refreshTransferIssues();
        return;
      case 'quarantined':
        this.setManualAcknowledgement(schedulerState.workEventId, {status:'not_transferred'});
        void this.refreshTransferIssues();
        return;
      case 'update_required':
        this.updateRequired = true;
        this.setState({status:'saved_locally',queueCount:schedulerState.queueCount});
        return;
      case 'idle':
        for(const listener of this.manualAcknowledgementListeners)listener();
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
        this.visibleTerminalOutcome = Object.freeze(
          decisionOutcome(schedulerState.decision),
        );
        this.setState({
          status: 'server_decision',
          outcome: this.visibleTerminalOutcome,
          queueCount: schedulerState.queueCount,
        });
        return;
      case 'protected':
        this.updatePendingManualAcknowledgements({ status: 'protected' });
        this.setState(protectedScanState(
          'local_evidence_protected',
          PRODUCT_SCAN_PROTECTION_CLASS.schedulerDurableState,
        ));
        return;
      case 'authority_rejected':
        this.updatePendingManualAcknowledgements({ status: 'rejected' });
        this.setReady({ status: 'session_rejected' });
        return;
      default:
        return schedulerState satisfies never;
    }
  }

  private async invalidateCapture(removeLookupKey: boolean): Promise<void> {
    this.clearOwnTimeMemory();
    this.logoutOwner=null;this.logoutWaiting=false;this.transmissionPaused=false;
    this.untransferred = [];
    const generation = this.generation;
    const database = this.database;
    this.pauseSynchronization();
    this.captureMode = null;
    this.offlineRestorationSnapshot = null;
    this.offlineCaptureContext = null;
    this.nativeNfcIngressAuthority = null;
    this.nativeNfcIngressRuntimeStartSession = null;
    this.nativeNfcIngressWindow = null;
    this.nativeNfcScanSession = null;
    if (removeLookupKey) {
      this.manualAcknowledgements.clear();
      this.visibleTerminalOutcome = null;
    } else {
      this.updatePendingManualAcknowledgements({ status: 'rejected' });
    }
    await this.nfcLifecycle.cancelCapture().catch(() => undefined);
    if (generation !== this.generation) return;
    await database?.invalidateCapture().catch(() => undefined);
    if (generation !== this.generation) return;
    if (removeLookupKey) {
      // A late provider sign-out revokes authority immediately, but iOS keychain mutation
      // must wait for the foreground. A newer capture generation cancels this deletion.
      await this.activity.waitForForeground();
      if (generation !== this.generation) return;
      await this.identityStore.removeActiveLookupKey().catch(() => undefined);
      if (generation !== this.generation) return;
      this.secrets?.lookupKey.fill(0);
      this.secrets = null;
    }
    this.setState({ status: 'inactive' });
  }

  private pauseSynchronization(): void {
    this.ownerSession = null;
    this.scheduler?.stop();
  }

  private canSynchronize(): boolean {
    return this.ownerSession !== null && this.session.isCurrent(this.ownerSession);
  }

  private trackManual(operation: () => Promise<ManualOfflineCaptureResult>): Promise<ManualOfflineCaptureResult> {
    const flight = operation(); this.manualFlights.add(flight);
    void flight.finally(() => this.manualFlights.delete(flight)).catch(() => undefined);
    return flight;
  }

  private isCurrent(generation: number): boolean {
    return this.started && generation === this.generation;
  }

  private canPreserveActiveOfflineCapture(): boolean {
    const snapshot = this.offlineRestorationSnapshot;
    return this.operationFlight !== null
      && this.state.status === 'scanning'
      && this.captureMode === 'offline'
      && snapshot !== null
      && this.session.isOfflineRestorationSnapshotCurrent(snapshot);
  }

  private isCaptureCurrent(
    generation: number,
    mode: CaptureMode,
    restorationSnapshot: InternalOfflineRestorationSnapshot | null,
  ): boolean {
    return this.isCurrent(generation)
      && this.logoutOwner === null
      && this.captureMode === mode
      && (
        mode === 'authenticated'
        || (
          restorationSnapshot !== null
          && this.session.isOfflineRestorationSnapshotCurrent(restorationSnapshot)
        )
      );
  }

  private async ensureNativeNfcIngressAuthority(mode: CaptureMode): Promise<void> {
    const current = this.nativeNfcIngressAuthority;
    if (
      current !== null
      && current.generation === this.generation
      && current.mode === mode
      && current.restorationSnapshot === this.offlineRestorationSnapshot
      && current.offlineCaptureContext === this.offlineCaptureContext
    ) return;
    const generation = this.generation;
    const restorationSnapshot =
      mode === 'offline' ? this.offlineRestorationSnapshot : null;
    const offlineCaptureContext =
      mode === 'offline' ? this.offlineCaptureContext : null;
    let validFrom;
    try {
      validFrom = await this.monotonicClock.sample();
    } catch {
      this.nativeNfcIngressAuthority = null;
      return;
    }
    if (
      !this.isCaptureCurrent(generation, mode, restorationSnapshot)
      || (
        mode === 'offline'
        && (
          offlineCaptureContext === null
          || validFrom.bootMarker !== offlineCaptureContext.activationBootMarker
          || validFrom.elapsedRealtimeMilliseconds
            < offlineCaptureContext.activationMonotonicMilliseconds
        )
      )
    ) {
      this.nativeNfcIngressAuthority = null;
      return;
    }
    this.revokeChangedNativeNfcSession();
    const previous = this.nativeNfcIngressWindow?.authority;
    const sameProcess = previous !== undefined
      && previous.validFromBootMarker === validFrom.bootMarker
      && previous.processStartElapsedRealtimeMilliseconds === (validFrom.processStartElapsedRealtimeMilliseconds ?? null);
    // Capture generations invalidate in-flight work; the evidence window instead
    // belongs to the uninterrupted session. Renewals cannot move its lower bound.
    this.nativeNfcIngressAuthority = Object.freeze({
      generation,
      mode,
      restorationSnapshot,
      offlineCaptureContext,
      validFromBootMarker: validFrom.bootMarker,
      processStartElapsedRealtimeMilliseconds:
        validFrom.processStartElapsedRealtimeMilliseconds ?? null,
      validFromElapsedRealtimeMilliseconds:
        sameProcess ? previous.validFromElapsedRealtimeMilliseconds : validFrom.elapsedRealtimeMilliseconds,
    });
    const session = this.readNativeNfcSession();
    this.nativeNfcIngressWindow = session === null ? null : { session, authority: this.nativeNfcIngressAuthority };
  }

  private readNativeNfcSession(): NativeNfcSessionBinding | null {
    const authenticated = this.session.capture();
    if (authenticated !== null) return { authenticated };
    const restoration = this.session.captureOfflineRestorationSnapshot();
    return restoration === null ? null : { restoration, owner: this.offlineCaptureContext ?? this.nativeNfcInitialOwner };
  }

  private isNativeNfcSessionCurrent(binding: NativeNfcSessionBinding): boolean {
    return 'authenticated' in binding
      ? this.session.isCurrent(binding.authenticated)
      : this.session.isOfflineRestorationSnapshotCurrent(binding.restoration);
  }

  private revokeChangedNativeNfcSession(): void {
    this.nativeNfcIngressRuntimeStartSession = this.continueNativeNfcSession(this.nativeNfcIngressRuntimeStartSession);
    this.nativeNfcScanSession = this.continueNativeNfcSession(this.nativeNfcScanSession);
    if (this.nativeNfcIngressWindow !== null) {
      const session = this.continueNativeNfcSession(this.nativeNfcIngressWindow.session);
      this.nativeNfcIngressWindow = session === null ? null : { ...this.nativeNfcIngressWindow, session };
    }
  }

  private continueNativeNfcSession(binding: NativeNfcSessionBinding | null): NativeNfcSessionBinding | null {
    if (binding === null || this.isNativeNfcSessionCurrent(binding)) return binding;
    const current = this.session.capture();
    return 'restoration' in binding && current !== null && binding.owner !== null
      && current.generation === binding.restoration.generation && sameAccount(current, binding.owner)
      ? { authenticated: current } : null;
  }

  private setReady(outcome: ProductScanOutcome): void {
    if (outcome.status === 'session_rejected') {
      this.nativeNfcIngressAuthority = null;
    }
    this.visibleTerminalOutcome = Object.freeze(outcome);
    this.setState({ status: 'ready', outcome: this.visibleTerminalOutcome });
  }

  private setState(state: ProductScanState): void {
    void this.refreshOwnTimeDisplay();
    const {untransferred,updateRequired,transmissionPaused,transmissionRetryAvailable,nativeNfcRetryRequired,...value} = state;
    const next = {...(this.logoutWaiting ? {status:'archive_signout_pending' as const} : value),
      ...(this.nativeNfcRetryRequired ? { nativeNfcRetryRequired: true as const } : {}),
      ...(this.untransferred.length ? {untransferred:this.untransferred} : {}), ...(this.updateRequired ? {updateRequired:true} : {}),
      ...(this.transmissionPaused && (this.canSynchronize() || this.captureMode==='offline')
        ? {transmissionPaused:true,...(this.transmissionRetryAvailable ? {transmissionRetryAvailable:true} : {})} : {})};
    if (state.protection) Object.defineProperty(next,'protection',{value:state.protection,enumerable:false});
    this.state = Object.freeze(next);
    for (const listener of this.listeners) listener();
  }

  private setManualAcknowledgement(
    workEventId: string,
    acknowledgement: ManualOfflineAcknowledgement,
  ): void {
    if (!this.manualAcknowledgements.has(workEventId) && acknowledgement.status !== 'pending') {
      for(const listener of this.manualAcknowledgementListeners)listener();
      return;
    }
    this.manualAcknowledgements.set(workEventId, Object.freeze(acknowledgement));
    for (const listener of this.manualAcknowledgementListeners) listener();
  }

  private updatePendingManualAcknowledgements(
    acknowledgement: ManualOfflineAcknowledgement,
  ): void {
    let changed = false;
    for (const [workEventId, current] of this.manualAcknowledgements) {
      if (current.status !== 'pending') continue;
      this.manualAcknowledgements.set(workEventId, Object.freeze(acknowledgement));
      changed = true;
    }
    if (changed) {
      for (const listener of this.manualAcknowledgementListeners) listener();
    }
  }
}

function classifiedScanState(
  state: ProductScanState,
  protection: ProductScanProtectionClass,
): ProductScanState {
  const classified = { ...state } as ProductScanState;
  Object.defineProperty(classified, 'protection', {
    configurable: false,
    enumerable: false,
    value: Object.freeze([protection] as const),
    writable: false,
  });
  return Object.freeze(classified);
}

function nativeSecureStoreFailureState(accountStorage: boolean): ProductScanState {
  return classifiedScanState({
    ...(accountStorage
      ? { status: 'protected_pending' as const, reason: 'local_evidence_protected' as const }
      : { status: 'secure_storage_unavailable' as const }),
    identityRecovery: 'secure_store',
  }, PRODUCT_SCAN_PROTECTION_CLASS.secureIdentity);
}

function protectedScanState(
  reason: Extract<ProductScanState, { status: 'protected_pending' }>['reason'],
  protection: ProductScanProtectionClass,
): ProductScanState {
  return classifiedScanState({ status: 'protected_pending', reason }, protection);
}

function sameSessionLease(
  page: {
    readonly userId: string;
    readonly organizationId: string;
    readonly membershipId: string;
    readonly role: OfflineMembershipRole;
  },
  snapshot: ProductScanSessionSnapshot,
): boolean {
  return page.userId === snapshot.session.userId
    && page.organizationId === snapshot.session.organizationId
    && page.membershipId === snapshot.session.membershipId
    && page.role === snapshot.session.role;
}

function sameActiveCaptureContext(
  current: ActiveOfflineCaptureContext,
  expected: ActiveOfflineCaptureContext,
): boolean {
  return current.organizationId === expected.organizationId
    && current.userId === expected.userId
    && current.membershipId === expected.membershipId
    && current.role === expected.role
    && current.leaseId === expected.leaseId
    && current.installationId === expected.installationId
    && current.identityBindingId === expected.identityBindingId
    && current.issuedAt === expected.issuedAt
    && current.expiresAt === expected.expiresAt
    && current.activationBootMarker === expected.activationBootMarker
    && current.activationMonotonicMilliseconds === expected.activationMonotonicMilliseconds;
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

function sameAccount(left: ProductScanSessionSnapshot, right: Pick<OfflineDatabaseOwner, 'organizationId' | 'userId' | 'membershipId'>): boolean {
  return left.session.organizationId === right.organizationId && left.session.userId === right.userId
    && left.session.membershipId === right.membershipId;
}

function decisionOutcome(decision: OfflineCanonicalDecision): ProductScanOutcome {
  switch (decision.status) {
    case 'time_entry_started':
      return { status: 'time_entry_started' };
    case 'time_entry_stopped':
      return { status: 'time_entry_stopped' };
    case 'break_started':
      return { status: 'break_started' };
    case 'break_stopped':
      return { status: 'break_stopped' };
    case 'duplicate_scan_ignored':
      return { status: 'duplicate_scan_ignored' };
    case 'active_entry_for_other_target_rejected':
      return { status: 'active_entry_for_other_target_rejected' };
    case 'break_without_active_time_entry_rejected':
      return { status: 'break_without_active_time_entry_rejected' };
    case 'work_trigger_during_break_rejected':
      return { status: 'work_trigger_during_break_rejected' };
    case 'escalation_required':
      return { status: decision.reason === 'work_location_unavailable' ? 'work_location_unavailable' : 'escalation_required' };
    default:
      return decision satisfies never;
  }
}
