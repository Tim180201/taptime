import { AppState, type AppStateStatus } from 'react-native';
import type { ProviderAuthPort } from '../auth/contracts';

interface AppStateSubscription {
  remove(): void;
}

export interface AppStatePort {
  readonly currentState: AppStateStatus;
  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void,
  ): AppStateSubscription;
}

export class AppStateAutoRefreshLifecycle {
  private subscription: AppStateSubscription | null = null;
  private appliedRunning = false;
  private currentState: AppStateStatus = 'unknown';
  private unsubscribePolicy: (() => void) | null = null;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly provider: Pick<ProviderAuthPort, 'startAutoRefresh' | 'stopAutoRefresh'>,
    private readonly appState: AppStatePort,
    private readonly policy?: {
      canAutoRefresh(): boolean;
      subscribeRefreshPolicy(listener: () => void): () => void;
    },
  ) {}

  start(): void {
    if (this.subscription !== null) {
      return;
    }
    this.currentState = this.appState.currentState;
    this.unsubscribePolicy = this.policy?.subscribeRefreshPolicy(() => this.requestState(this.currentState)) ?? null;
    this.requestState(this.currentState);
    this.subscription = this.appState.addEventListener('change', (state) => this.applyState(state));
  }

  stop(): void {
    this.unsubscribePolicy?.();
    this.unsubscribePolicy = null;
    this.subscription?.remove();
    this.subscription = null;
    this.requestRunning(false);
  }

  private applyState(state: AppStateStatus): void {
    this.currentState = state;
    this.requestState(state);
  }

  private requestState(state: AppStateStatus): void {
    this.requestRunning(state === 'active' && (this.policy?.canAutoRefresh() ?? true));
  }

  private requestRunning(shouldRun: boolean): void {
    this.operationTail = this.operationTail.then(async () => {
      shouldRun = shouldRun && this.currentState === 'active' && (this.policy?.canAutoRefresh() ?? true);
      if (shouldRun === this.appliedRunning) {
        return;
      }
      if (shouldRun) {
        await this.provider.startAutoRefresh();
      } else {
        await this.provider.stopAutoRefresh();
      }
      this.appliedRunning = shouldRun;
    }).catch(() => {
      // A provider lifecycle failure is contained; no session authority is opened by it.
    });
  }
}

export function createNativeAppStateAutoRefreshLifecycle(
  provider: Pick<ProviderAuthPort, 'startAutoRefresh' | 'stopAutoRefresh'>,
  policy?: { canAutoRefresh(): boolean; subscribeRefreshPolicy(listener: () => void): () => void },
): AppStateAutoRefreshLifecycle {
  return new AppStateAutoRefreshLifecycle(provider, AppState, policy);
}
