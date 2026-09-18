import type { EmployeesCapability } from '../employees/contracts';
import type { EmployeesCoordinator } from '../employees/EmployeesCoordinator';
import type { MobileSessionCapability } from '../auth/contracts';
import type { AdminSetupCapability } from '../administration/contracts';
import type { ProductScanCapability, ProductScanState } from '../scan/contracts';
import type { ProductServerTransport } from '../transport/contracts';
import type { MobileWorkCapability, MobileWorkState } from '../work/contracts';
import type { SafeWorkTarget } from '@taptime/mobile-work-contract';
import type {
  OfflineManualCaptureCapability,
} from '../offline/OfflineCaptureCoordinator';
import type { ScanFeedbackLifecycle } from '../feedback/ScanFeedbackCoordinator';

export interface ProductMobileRuntime {
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
  requestPasswordReset(email: string): Promise<'requested' | 'unavailable'>;
  handlePasswordRecoveryUrl(url: string): Promise<boolean>;
  completePasswordRecovery(password: string): Promise<boolean>;
}

/** @internal Runtime owner used to keep orchestrator lifecycle and React capability separate. */
export interface ProductScanRuntimeOwner extends ProductScanCapability {
  start(): Promise<void>;
  stop(): Promise<void>;
  onExplicitLogout?(): Promise<void>;
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
      getState: () => this.coordinator.getState(),
      subscribe: (listener: () => void) => this.coordinator.subscribe(listener),
      signIn: (email: string, password: string) => this.coordinator.signIn(email, password),
      signInForEmployeeEnrollment: (email: string, password: string) => (
        this.coordinator.signInForEmployeeEnrollment(email, password)
      ),
      redeemEmployeeInvitation: (invitationSecret: string) => (
        this.coordinator.redeemEmployeeInvitation(invitationSecret)
      ),
      retryContext: () => this.coordinator.retryContext(),
      requestPasswordReset: (email: string) => this.coordinator.requestPasswordReset(email),
      handlePasswordRecoveryUrl: (url: string) => this.coordinator.handlePasswordRecoveryUrl(url),
      completePasswordRecovery: (password: string) => (
        this.coordinator.completePasswordRecovery(password)
      ),
      refresh: () => this.coordinator.refresh(),
      signOut: async () => {
        await this.scanOrchestrator.onExplicitLogout?.();
        await this.coordinator.signOut();
      },
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
      getState: () => this.administrationCoordinator.getState(),
      subscribe: (listener: () => void) => this.administrationCoordinator.subscribe(listener),
      refresh: () => this.administrationCoordinator.refresh(),
      loadMore: () => this.administrationCoordinator.loadMore(),
      provision: (customerId: string, displayName: string) => this.administrationCoordinator.provision(customerId, displayName),
      provisionBreak: (displayName: string) => this.administrationCoordinator.provisionBreak(displayName),
      cancel: () => this.administrationCoordinator.cancel(),
    });
    this.workCapability = Object.freeze({
      getState: () => this.mobileWorkCoordinator.getState(),
      subscribe: (listener: () => void) => this.mobileWorkCoordinator.subscribe(listener),
      refresh: () => this.mobileWorkCoordinator.refresh(),
      loadMoreOwnTime: () => this.mobileWorkCoordinator.loadMoreOwnTime(),
      triggerManual: (target: SafeWorkTarget) => this.mobileWorkCoordinator.triggerManual(target),
      triggerBreak: () => this.mobileWorkCoordinator.triggerBreak(),
    });
    this.offlineManualCapability = Object.freeze({
      readOfflineManualTargets: () => offlineManualCapture.readOfflineManualTargets(),
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
    // Keep the private capability graph owned for the complete product-runtime lifetime.
    void this.serverTransport;
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
    if (!this.started) {
      return;
    }
    this.started = false;
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
    void this.administrationCoordinator.stop();
    void this.scanOrchestrator.stop();
    this.coordinator.stop();
  }

  private isCurrentRuntime(runtimeGeneration: number): boolean {
    return this.started && runtimeGeneration === this.runtimeGeneration;
  }

  private accountKey(): string | null {
    const state = this.coordinator.getState();
    return state.status === 'authenticated'
      ? `${state.session.organizationId}/${state.session.membershipId}/${state.session.userId}/${state.session.role}`
      : null;
  }

  private onProtectionAccountChanged(): void {
    const account = this.accountKey();
    if (account === this.lastAccount) return;
    this.lastAccount = account;
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
