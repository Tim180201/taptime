import type { MobileAppActivity } from './MobileAppActivity';
import { isRecoverableIdentityProtection } from '../navigation/offlineCaptureShell';
import type { TimeEditingCapability, TimeEditingCoordinator } from '../timeEditing/TimeEditingCoordinator';
import type { EmployeesCapability } from '../employees/contracts';
import type { EmployeesCoordinator } from '../employees/EmployeesCoordinator';
import type { MobileSessionCapability, MobileSessionState } from '../auth/contracts';
import type { AdminSetupCapability } from '../administration/contracts';
import type { ProductScanCapability, ProductScanState } from '../scan/contracts';
import type { ProductServerTransport } from '../transport/contracts';
import type { MobileWorkCapability, MobileWorkState } from '../work/contracts';
import type { SafeWorkTarget } from '@taptime/mobile-work-contract';
import type {
  OfflineManualCaptureCapability,
  OfflineSignOutPreparation,
} from '../offline/OfflineCaptureCoordinator';
import type { ScanFeedbackLifecycle } from '../feedback/ScanFeedbackCoordinator';

export interface ProductMobileRuntime {
  readonly timeEditing?: TimeEditingCapability;
  readonly employees?: EmployeesCapability;
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  readonly administration: AdminSetupCapability;
  readonly work: MobileWorkCapability;
  readonly offlineManual: OfflineManualCaptureCapability;
  start(): Promise<void>;
  stop(): void;
}

/** @internal Runtime owner used to keep coordinator lifecycle and React capability separate. */
export interface ProductSessionRuntimeOwner extends MobileSessionCapability {
  start(): Promise<void>;
  stop(): void;
  onActive?(): Promise<void>;
  canAutoRefresh?(): boolean;
  requestPasswordReset(email: string): Promise<'requested' | 'unavailable'>;
}

/** @internal Runtime owner used to keep orchestrator lifecycle and React capability separate. */
export interface ProductScanRuntimeOwner extends ProductScanCapability {
  start(): Promise<void>;
  stop(): Promise<void>;
  onExplicitLogout?(): Promise<void>;
  refreshOfflineGrant?(): Promise<void>;
  prepareSignOut?(): Promise<OfflineSignOutPreparation>;
  pollArchiveForSignOut?(): Promise<boolean>;
  cancelSignOut?(): Promise<void>;
}

export interface ProductAdministrationRuntimeOwner extends AdminSetupCapability {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/** @internal Runtime owner used to keep native app-state lifecycle outside React. */
export interface ProductAppStateRuntimeOwner {
  start(): void;
  stop(): void;
}

export interface ProductOfflineSchedulingRuntimeOwner {
  start(): void;
  stop(): void;
}
export interface ProductMobileWorkRuntimeOwner extends MobileWorkCapability {
  start(): void;
  stop(): void;
}
export interface ProductNativeIngressRuntimeOwner {
  start(): void;
  stop(): void;
}

/**
 * Owns the product runtime lifecycle without importing native composition dependencies. Keeping
 * this coordinator pure makes start/stop races independently testable in the Node test runner.
 */
export class DefaultProductMobileRuntime implements ProductMobileRuntime {
  private started = false;
  private activitySubscription: { remove(): void } | null = null;
  private recoveryState: MobileSessionState | null = null;
  private readonly recoveryListeners = new Set<() => void>();
  private recoveryFlight: Promise<void> | null = null;
  private stoppingFlight: Promise<unknown> | null = null;
  private runtimeGeneration = 0;
  private readonly sessionCapability: MobileSessionCapability;
  private readonly scanCapability: ProductScanCapability;
  private readonly administrationCapability: AdminSetupCapability;
  private readonly workCapability: MobileWorkCapability;
  private readonly offlineManualCapability: OfflineManualCaptureCapability;
  private unsubscribeProtection: (() => void) | null = null;
  private lastAccount: string | null = null;
  private protectionRevision = 0;
  private protectionFlight: Promise<void> = Promise.resolve();
  private protectionState: ProductScanState | null = null;
  private readonly protectionListeners = new Set<() => void>();
  private signOutRevision = 0;
  private signOutAccount: string | null = null;
  private signOutTimer: ReturnType<typeof setInterval> | null = null;
  private signOutRequestFlight: Promise<void> | null = null;
  private signOutPollFlight: Promise<void> | null = null;
  private signOutCompletionFlight: Promise<void> | null = null;

  constructor(
    private readonly coordinator: ProductSessionRuntimeOwner,
    private readonly appStateLifecycle: ProductAppStateRuntimeOwner,
    // C2 composes these private clients for later orchestrators without exposing them to React.
    private readonly serverTransport: ProductServerTransport,
    private readonly scanOrchestrator: ProductScanRuntimeOwner,
    private readonly administrationCoordinator: ProductAdministrationRuntimeOwner,
    private readonly offlineSchedulingLifecycle: ProductOfflineSchedulingRuntimeOwner = {
      start() {},
      stop() {},
    },
    private readonly mobileWorkCoordinator: ProductMobileWorkRuntimeOwner = inactiveMobileWork(),
    private readonly nativeIngressLifecycle: ProductNativeIngressRuntimeOwner = {
      start() {},
      stop() {},
    },
    offlineManualCapture: OfflineManualCaptureCapability = unavailableOfflineManualCapture(),
    private readonly scanFeedbackLifecycle: ScanFeedbackLifecycle = {
      start() {},
      stop() {},
    },
    private readonly employeesCoordinator?: EmployeesCoordinator,
    private readonly timeEditingCoordinator?: TimeEditingCoordinator,
    private readonly activity?: MobileAppActivity,
  ) {
    const employees = this.employeesCoordinator;
    this.employeesCapability = employees ? Object.freeze({
      getState: () => employees.getState(), subscribe: (listener: ()=>void) => employees.subscribe(listener),
      refresh: () => employees.refresh(), filter: (running: boolean) => employees.filter(running),
      loadMore: () => employees.loadMore(), openPerson: (person: import('../employees/contracts').ManagedPerson) => employees.openPerson(person),
      loadPersonMonth: (month: string) => employees.loadPersonMonth(month),
      openInvitation: () => employees.openInvitation(), invite: (name: string,email: string,location: string|null) => employees.invite(name,email,location),
      back: () => employees.back(), leave: () => employees.leave(),
    }) : undefined;
    // React receives a real narrow facade, not the coordinator object that owns C2 token access.
    this.sessionCapability = Object.freeze({
      getState: () => this.recoveryState ?? this.coordinator.getState(),
      subscribe: (listener: () => void) => {
        this.recoveryListeners.add(listener);
        const unsubscribe = this.coordinator.subscribe(listener);
        return () => { this.recoveryListeners.delete(listener); unsubscribe(); };
      },
      signIn: (email: string, password: string) => this.coordinator.signIn(email, password),
      signInForEmployeeEnrollment: (email: string, password: string) => (
        this.coordinator.signInForEmployeeEnrollment(email, password)
      ),
      redeemEmployeeInvitation: (invitationSecret: string) => (
        this.coordinator.redeemEmployeeInvitation(invitationSecret)
      ),
      retryContext: () => this.retryRecovery(true),
      requestPasswordReset: (email: string) => this.coordinator.requestPasswordReset(email),
      refresh: () => this.coordinator.refresh(),
      signOut: () => this.requestSignOut(),
      signOutImmediately: () => this.forceSignOut(),
      cancelSignOut: () => this.keepSignedIn(),
    });
    // React receives state/actions only: no native manager, C2 client, token or raw UID.
    this.scanCapability = Object.freeze({
      getState: () => this.protectionState ?? this.scanOrchestrator.getState(),
      subscribe: (listener: () => void) => {
        this.protectionListeners.add(listener);
        const unsubscribe = this.scanOrchestrator.subscribe(listener);
        return () => { unsubscribe(); this.protectionListeners.delete(listener); };
      },
      scan: () => this.protectionState === null ? this.scanOrchestrator.scan() : Promise.resolve(),
      cancel: () => this.scanOrchestrator.cancel(),
      retry: () => this.scanOrchestrator.retry(),
    });
    this.administrationCapability = Object.freeze({
      inspectTag: () => this.administrationCoordinator.inspectTag?.()??Promise.resolve(),
      manageCustomer: async (customerId:string,change:import('@taptime/mobile-work-contract').CustomerManagementChange) => {
        const result=await this.administrationCoordinator.manageCustomer?.(customerId,change)??{status:'unavailable' as const};
        if(result.status==='succeeded'){
          await this.scanOrchestrator.refreshOfflineGrant?.().catch(()=>undefined);
          await this.mobileWorkCoordinator.refresh().catch(()=>undefined);
        }
        return result;
      },
      prepareCustomer: () => this.administrationCoordinator.prepareCustomer(),
      createCustomer: async (displayName: string, locationId?: string) => {
        await this.administrationCoordinator.createCustomer(displayName, locationId);
        await this.scanOrchestrator.refreshOfflineGrant?.();
      },
      getState: () => this.administrationCoordinator.getState(),
      subscribe: (listener: () => void) => this.administrationCoordinator.subscribe(listener),
      refresh: () => this.administrationCoordinator.refresh(),
      loadMore: () => this.administrationCoordinator.loadMore(),
      provision: async (customerId: string, displayName: string) => {
        await this.administrationCoordinator.provision(customerId, displayName);
        await this.scanOrchestrator.refreshOfflineGrant?.();
      },
      provisionBreak: async (displayName: string) => {
        await this.administrationCoordinator.provisionBreak(displayName);
        await this.scanOrchestrator.refreshOfflineGrant?.();
      },
      cancel: () => this.administrationCoordinator.cancel(),
    });
    this.workCapability = Object.freeze({
      setCustomerQuota: (customerId: string, minutes: number|null) => this.mobileWorkCoordinator.setCustomerQuota?.(customerId,minutes) ?? Promise.resolve({status:'unavailable' as const}),
      readCustomerHours: (month: string) => this.mobileWorkCoordinator.readCustomerHours?.(month) ?? Promise.resolve({status:'unavailable' as const}),
      getState: () => this.mobileWorkCoordinator.getState(),
      subscribe: (listener: () => void) => this.mobileWorkCoordinator.subscribe(listener),
      refresh: () => this.mobileWorkCoordinator.refresh(),
      loadMoreOwnTime: () => this.mobileWorkCoordinator.loadMoreOwnTime(),
      triggerManual: (target: SafeWorkTarget) => this.mobileWorkCoordinator.triggerManual(target),
      triggerBreak: () => this.mobileWorkCoordinator.triggerBreak(),
      stopActiveTime: () => this.mobileWorkCoordinator.stopActiveTime(),
    });
    this.offlineManualCapability = Object.freeze({
      readOfflineManualTargets: () => offlineManualCapture.readOfflineManualTargets(),
      hasUnconfirmedCapture: () => offlineManualCapture.hasUnconfirmedCapture?.() ?? Promise.resolve(true),
      captureManual: (target: SafeWorkTarget) => offlineManualCapture.captureManual(target),
      captureBreak: () => offlineManualCapture.captureBreak?.()
        ?? Promise.resolve({ status: 'unavailable' as const }),
      readManualAcknowledgement: (workEventId: string) => (
        offlineManualCapture.readManualAcknowledgement?.(workEventId) ?? null
      ),
      subscribeManualAcknowledgements: (listener: () => void) => (
        offlineManualCapture.subscribeManualAcknowledgements?.(listener) ?? (() => undefined)
      ),
    });
  }

  get timeEditing(): TimeEditingCapability | undefined {
    const c=this.timeEditingCoordinator;
    return c ? this.timeEditingFacade ??= Object.freeze({getState:c.getState,subscribe:c.subscribe,loadBackfillTargets:(targetMembershipId:string)=>c.loadBackfillTargets(targetMembershipId),save:(kind:import('../timeEditing/TimeEditingCoordinator').TimeEditKind,input:Record<string,unknown>)=>c.save(kind,input)}) : undefined;
  }
  private timeEditingFacade: TimeEditingCapability | undefined;

  get employees(): EmployeesCapability | undefined { return this.employeesCapability; }
  private readonly employeesCapability: EmployeesCapability | undefined;

  get session(): MobileSessionCapability {
    return this.sessionCapability;
  }

  get scan(): ProductScanCapability {
    return this.scanCapability;
  }

  get administration(): AdminSetupCapability {
    return this.administrationCapability;
  }

  get work(): MobileWorkCapability {
    return this.workCapability;
  }

  get offlineManual(): OfflineManualCaptureCapability {
    return this.offlineManualCapability;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    const runtimeGeneration = ++this.runtimeGeneration;
    if (this.activity !== undefined) {
      let previous = this.activity.appState.currentState;
      this.activitySubscription = this.activity.appState.addEventListener('change', state => {
        const returning = state === 'active' && previous !== 'active';
        previous = state;
        if (returning) void this.retryRecovery(false).catch(() => undefined);
      });
      if (this.activity.isBackground()) await this.activity.waitForForeground();
    }
    if (this.stoppingFlight !== null) await this.stoppingFlight;
    if (!this.isCurrentRuntime(runtimeGeneration)) return;
    // Keep the private capability graph owned for the complete product-runtime lifetime.
    void this.serverTransport;
    void this.timeEditingCoordinator?.start();
    this.scanFeedbackLifecycle.start();
    try {
      await this.scanOrchestrator.start();
    } catch (error) {
      this.scanFeedbackLifecycle.stop();
      if (this.isCurrentRuntime(runtimeGeneration)) {
        throw error;
      }
      return;
    }
    if (!this.isCurrentRuntime(runtimeGeneration)) {
      return;
    }
    try {
      await this.administrationCoordinator.start();
    } catch (error) {
      if (this.isCurrentRuntime(runtimeGeneration)) throw error;
      return;
    }
    if (!this.isCurrentRuntime(runtimeGeneration)) return;
    this.lastAccount = this.accountKey();
    this.unsubscribeProtection = this.coordinator.subscribe(() => this.onProtectionAccountChanged());
    try {
      await this.coordinator.start();
    } catch (error) {
      if (this.isCurrentRuntime(runtimeGeneration)) {
        throw error;
      }
      return;
    }
    if (!this.isCurrentRuntime(runtimeGeneration)) {
      return;
    }
    this.appStateLifecycle.start();
    this.offlineSchedulingLifecycle.start();
    this.mobileWorkCoordinator.start();
    this.employeesCoordinator?.start();
    this.nativeIngressLifecycle.start();
  }

  stop(): void {
    this.cancelSignOutWait();
    this.timeEditingCoordinator?.stop();
    if (!this.started) {
      return;
    }
    this.started = false;
    this.activitySubscription?.remove();
    this.activitySubscription = null;
    this.runtimeGeneration += 1;
    this.protectionRevision += 1;
    this.unsubscribeProtection?.();
    this.unsubscribeProtection = null;
    this.protectionState = null;
    this.appStateLifecycle.stop();
    this.offlineSchedulingLifecycle.stop();
    this.mobileWorkCoordinator.stop();
    this.employeesCoordinator?.stop();
    this.nativeIngressLifecycle.stop();
    this.scanFeedbackLifecycle.stop();
    this.stoppingFlight = Promise.all([this.administrationCoordinator.stop(), this.scanOrchestrator.stop()]);
    this.coordinator.stop();
  }

  private retryRecovery(explicit: boolean): Promise<void> {
    if (this.recoveryFlight !== null) return this.recoveryFlight;
    if (this.activity?.isBackground()) return Promise.resolve();
    const operation = async () => {
      const session = this.session.getState();
      if (session.status === 'runtime_unavailable' && session.reason !== 'runtime_start_failed') {
        await this.coordinator.retryContext();
        return;
      }
      if (session.status === 'runtime_unavailable'
        || isRecoverableIdentityProtection(this.scan.getState())) {
        // Never discard a newly rotated token to reopen the offline store.
        await this.coordinator.onActive?.();
        if (this.coordinator.canAutoRefresh?.() === false) return;
        this.publishRecovery({status:'initializing'});
        try {
          this.stop();
          await this.start();
          this.publishRecovery(null);
        } catch {
          this.publishRecovery({status:'runtime_unavailable',reason:'runtime_start_failed'});
        }
      } else if (explicit) {
        await this.coordinator.retryContext();
      } else {
        await this.coordinator.onActive?.();
      }
    };
    const flight = operation().finally(() => {
      if (this.recoveryFlight === flight) this.recoveryFlight = null;
    });
    this.recoveryFlight = flight;
    return flight;
  }

  private publishRecovery(state: MobileSessionState | null): void {
    this.recoveryState = state;
    for (const listener of this.recoveryListeners) { try { listener(); } catch {} }
  }

  private isCurrentRuntime(runtimeGeneration: number): boolean {
    return this.started && runtimeGeneration === this.runtimeGeneration;
  }

  private signOutAccountKey(): string | null {
    const state = this.coordinator.getState();
    return state.status === 'authenticated'
      ? `${state.session.organizationId}/${state.session.membershipId}/${state.session.userId}`
      : null;
  }

  private signOutIsCurrent(revision: number, account: string | null): boolean {
    return revision === this.signOutRevision && (account === this.signOutAccountKey()
      || account !== null && account === this.signOutAccount && this.coordinator.getState().status === 'context_unavailable');
  }

  private requestSignOut(): Promise<void> {
    if (this.signOutTimer !== null) return Promise.resolve();
    if (this.signOutCompletionFlight) return this.signOutCompletionFlight;
    if (this.signOutRequestFlight) return this.signOutRequestFlight;
    const revision = ++this.signOutRevision;
    let account = this.signOutAccountKey();
    this.signOutAccount = account;
    const operation = async () => {
      let preparation: OfflineSignOutPreparation = {wait:false};
      try { preparation = await this.scanOrchestrator.prepareSignOut?.() ?? preparation; }
      catch {
        if (this.signOutIsCurrent(revision, account)) this.publishProtection({status:'protected_pending',reason:'local_evidence_protected'});
        return;
      }
      if (revision !== this.signOutRevision) return;
      if (preparation.wait) {
        account = preparation.accountKey;
        this.signOutAccount = account;
      }
      if (!this.signOutIsCurrent(revision, account)) return;
      if (!preparation.wait) return this.finishSignOut(revision, account);
      this.publishProtection({status:'archive_signout_pending'});
      this.signOutTimer = setInterval(() => { void this.pollSignOutArchive(revision, account); }, 30_000);
      void this.pollSignOutArchive(revision, account);
    };
    let flight!: Promise<void>;
    flight = operation().finally(() => {
      if (this.signOutRequestFlight === flight) this.signOutRequestFlight = null;
    });
    this.signOutRequestFlight = flight;
    return flight;
  }

  private pollSignOutArchive(revision: number, account: string | null): Promise<void> {
    if (this.activity?.isBackground()) return Promise.resolve();
    if (!this.signOutIsCurrent(revision, account) || account !== this.signOutAccountKey()) return Promise.resolve();
    if (this.signOutPollFlight) return this.signOutPollFlight;
    const operation = async () => {
      const archived = await this.scanOrchestrator.pollArchiveForSignOut?.().catch(() => false);
      if (archived) {
        await this.activity?.waitForForeground();
        if (this.signOutIsCurrent(revision, account)) await this.finishSignOut(revision, account);
      }
    };
    let flight!: Promise<void>;
    flight = operation().finally(() => {
      if (this.signOutPollFlight === flight) this.signOutPollFlight = null;
    });
    this.signOutPollFlight = flight;
    return flight;
  }

  private async keepSignedIn(): Promise<void> {
    if (this.signOutCompletionFlight) return;
    if (this.protectionState?.status !== 'archive_signout_pending'
      && this.scanOrchestrator.getState().status !== 'archive_signout_pending') return;
    this.cancelSignOutWait();
    await this.scanOrchestrator.cancelSignOut?.();
  }

  private forceSignOut(): Promise<void> {
    if (this.signOutCompletionFlight) return this.signOutCompletionFlight;
    const account = this.signOutAccountKey();
    this.cancelSignOutWait();
    return this.finishSignOut(this.signOutRevision, account);
  }

  private finishSignOut(revision: number, account: string | null): Promise<void> {
    if (!this.signOutIsCurrent(revision, account)) return Promise.resolve();
    if (this.signOutCompletionFlight) return this.signOutCompletionFlight;
    if (this.signOutTimer !== null) clearInterval(this.signOutTimer);
    this.signOutTimer = null;
    // Archive proof has committed the sign-out; the waiting actions no longer apply.
    this.publishProtection({status:'checking'});
    const operation = async () => {
      await this.scanOrchestrator.onExplicitLogout?.();
      if (!this.signOutIsCurrent(revision, account)) return;
      await this.coordinator.signOut();
      if (revision === this.signOutRevision) {
        this.signOutAccount = null;
        this.publishProtection(null);
      }
    };
    let flight!: Promise<void>;
    flight = operation().finally(() => {
      if (this.signOutCompletionFlight === flight) this.signOutCompletionFlight = null;
    });
    this.signOutCompletionFlight = flight;
    return flight;
  }

  private cancelSignOutWait(): void {
    ++this.signOutRevision;
    if (this.signOutTimer !== null) clearInterval(this.signOutTimer);
    this.signOutTimer = null;
    this.signOutAccount = null;
    this.signOutRequestFlight = null;
    this.signOutPollFlight = null;
    this.signOutCompletionFlight = null;
    if (this.protectionState?.status === 'archive_signout_pending') this.publishProtection(null);
  }

  private accountKey(): string | null {
    const state = this.coordinator.getState();
    return state.status === 'authenticated'
      ? `${state.session.organizationId}/${state.session.membershipId}/${state.session.userId}/${state.session.role}`
      : null;
  }

  private onProtectionAccountChanged(): void {
    if (this.signOutAccount !== null && this.signOutAccount !== this.signOutAccountKey()
      && this.coordinator.getState().status !== 'context_unavailable') this.cancelSignOutWait();
    const account = this.accountKey();
    if (account === this.lastAccount) return;
    this.lastAccount = account;
    if (this.protectionState?.status === 'archive_signout_pending') return;
    const revision = ++this.protectionRevision;
    if (account === null) return;
    const state = this.scanOrchestrator.getState();
    if (this.protectionState === null && state.status !== 'protected_pending'
      && state.status !== 'secure_storage_unavailable') return;
    const runtimeGeneration = this.runtimeGeneration;
    this.publishProtection({ status: 'checking' });
    // Reopen through the existing lifecycle: owner checks and retained evidence stay authoritative.
    // In particular, no owner, lease ID or queued event is reassigned here (D-055).
    this.protectionFlight = this.protectionFlight.then(async () => {
      if (!this.isCurrentRuntime(runtimeGeneration) || revision !== this.protectionRevision) return;
      await this.scanOrchestrator.stop();
      if (!this.isCurrentRuntime(runtimeGeneration) || revision !== this.protectionRevision) return;
      await this.scanOrchestrator.start();
      if (this.isCurrentRuntime(runtimeGeneration) && revision === this.protectionRevision) this.publishProtection(null);
    }).catch(() => {
      if (this.isCurrentRuntime(runtimeGeneration) && revision === this.protectionRevision) {
        this.publishProtection({ status: 'secure_storage_unavailable' });
      }
    });
  }

  private publishProtection(state: ProductScanState | null): void {
    this.protectionState = state === null ? null : Object.freeze(state);
    for (const listener of this.protectionListeners) listener();
  }
}

function inactiveMobileWork(): ProductMobileWorkRuntimeOwner {
  const state: MobileWorkState = Object.freeze({ status: 'inactive' });
  return {
    getState: () => state,
    subscribe: () => () => undefined,
    async refresh() {},
    async loadMoreOwnTime() {},
    async triggerManual() {},
    async triggerBreak() {},
    async stopActiveTime() {},
    start() {},
    stop() {},
  };
}

function unavailableOfflineManualCapture(): OfflineManualCaptureCapability {
  return {
    async readOfflineManualTargets() {
      return { status: 'unavailable' };
    },
    async captureBreak() { return { status: 'unavailable' }; },
    async captureManual() {
      return { status: 'unavailable' };
    },
  };
}
