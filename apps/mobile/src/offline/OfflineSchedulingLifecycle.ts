import * as Network from 'expo-network';
import { AppState, type AppStateStatus } from 'react-native';
import { OfflineCaptureCoordinator } from './OfflineCaptureCoordinator';
import { registerOfflineBackgroundTask } from './registerOfflineBackgroundTask';

interface RemovableSubscription {
  remove(): void;
}

export interface OfflineSchedulingAppStatePort {
  readonly currentState: AppStateStatus;
  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void,
  ): RemovableSubscription;
}

export interface OfflineSchedulingNetworkPort {
  addNetworkStateListener(listener: () => void): RemovableSubscription;
}

export class OfflineSchedulingLifecycle {
  private appStateSubscription: RemovableSubscription | null = null;
  private networkSubscription: RemovableSubscription | null = null;

  constructor(
    private readonly coordinator: Pick<
      OfflineCaptureCoordinator,
      'triggerForeground' | 'triggerNetworkHint'
    >,
    private readonly appState: OfflineSchedulingAppStatePort = AppState,
    private readonly network: OfflineSchedulingNetworkPort = Network,
    private readonly registerBackground: () => Promise<void> = registerOfflineBackgroundTask,
  ) {}

  start(): void {
    if (this.appStateSubscription !== null) return;
    this.appStateSubscription = this.appState.addEventListener('change', (state) => {
      if (state === 'active') this.coordinator.triggerForeground();
    });
    this.networkSubscription = this.network.addNetworkStateListener(() => {
      // Connectivity is deliberately only a scheduling hint. The real request still decides.
      this.coordinator.triggerNetworkHint();
    });
    if (this.appState.currentState === 'active') this.coordinator.triggerForeground();
    void this.registerBackground().catch(() => undefined);
  }

  stop(): void {
    this.appStateSubscription?.remove();
    this.networkSubscription?.remove();
    this.appStateSubscription = null;
    this.networkSubscription = null;
  }
}
