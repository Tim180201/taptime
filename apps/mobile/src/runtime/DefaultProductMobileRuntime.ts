import type { MobileSessionCapability } from '../auth/contracts';
import type { AdminSetupCapability } from '../administration/contracts';
import type { ProductScanCapability } from '../scan/contracts';
import type { ProductServerTransport } from '../transport/contracts';

export interface ProductMobileRuntime {
  readonly session: MobileSessionCapability;
  readonly scan: ProductScanCapability;
  readonly administration: AdminSetupCapability;
  start(): Promise<void>;
  stop(): void;
}

/** @internal Runtime owner used to keep coordinator lifecycle and React capability separate. */
export interface ProductSessionRuntimeOwner extends MobileSessionCapability {
  start(): Promise<void>;
  stop(): void;
}

/** @internal Runtime owner used to keep orchestrator lifecycle and React capability separate. */
export interface ProductScanRuntimeOwner extends ProductScanCapability {
  start(): Promise<void>;
  stop(): Promise<void>;
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

  constructor(
    private readonly coordinator: ProductSessionRuntimeOwner,
    private readonly appStateLifecycle: ProductAppStateRuntimeOwner,
    // C2 composes these private clients for later orchestrators without exposing them to React.
    private readonly serverTransport: ProductServerTransport,
    private readonly scanOrchestrator: ProductScanRuntimeOwner,
    private readonly administrationCoordinator: ProductAdministrationRuntimeOwner,
  ) {
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
      refresh: () => this.coordinator.refresh(),
      signOut: () => this.coordinator.signOut(),
    });
    // React receives state/actions only: no native manager, C2 client, token or raw UID.
    this.scanCapability = Object.freeze({
      getState: () => this.scanOrchestrator.getState(),
      subscribe: (listener: () => void) => this.scanOrchestrator.subscribe(listener),
      scan: () => this.scanOrchestrator.scan(),
      cancel: () => this.scanOrchestrator.cancel(),
      retry: () => this.scanOrchestrator.retry(),
    });
    this.administrationCapability = Object.freeze({
      getState: () => this.administrationCoordinator.getState(),
      subscribe: (listener: () => void) => this.administrationCoordinator.subscribe(listener),
      refresh: () => this.administrationCoordinator.refresh(),
      loadMore: () => this.administrationCoordinator.loadMore(),
      provision: (customerId: string, displayName: string) => this.administrationCoordinator.provision(customerId, displayName),
      cancel: () => this.administrationCoordinator.cancel(),
    });
  }

  get session(): MobileSessionCapability {
    return this.sessionCapability;
  }

  get scan(): ProductScanCapability {
    return this.scanCapability;
  }

  get administration(): AdminSetupCapability {
    return this.administrationCapability;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    const runtimeGeneration = ++this.runtimeGeneration;
    // Keep the private capability graph owned for the complete product-runtime lifetime.
    void this.serverTransport;
    try {
      await this.scanOrchestrator.start();
    } catch (error) {
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
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.runtimeGeneration += 1;
    this.appStateLifecycle.stop();
    void this.administrationCoordinator.stop();
    void this.scanOrchestrator.stop();
    this.coordinator.stop();
  }

  private isCurrentRuntime(runtimeGeneration: number): boolean {
    return this.started && runtimeGeneration === this.runtimeGeneration;
  }
}
