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
  private operationTail: Promise<void> = Promise.resolve();

  constructor(
    private readonly provider: Pick<ProviderAuthPort, 'startAutoRefresh' | 'stopAutoRefresh'>,
    private readonly appState: AppStatePort,
  ) {}

  start(): void {
    if (this.subscription !== null) {
      return;
    }
    this.requestState(this.appState.currentState);
    this.subscription = this.appState.addEventListener('change', (state) => this.applyState(state));
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.requestRunning(false);
  }

  private applyState(state: AppStateStatus): void {
    this.requestState(state);
  }

  private requestState(state: AppStateStatus): void {
    this.requestRunning(state === 'active');
  }

  private requestRunning(shouldRun: boolean): void {
    this.operationTail = this.operationTail.then(async () => {
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
): AppStateAutoRefreshLifecycle {
  return new AppStateAutoRefreshLifecycle(provider, AppState);
}
