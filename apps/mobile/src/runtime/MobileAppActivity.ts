import type { AppStatePort } from './AppStateAutoRefreshLifecycle';

export interface SessionActivity {
  isBackground(): boolean;
  waitForForeground(): Promise<void>;
}
export const alwaysForeground: SessionActivity = {
  isBackground: () => false,
  async waitForForeground() {},
};

/** An initial inactive state is a normal cold launch, not evidence of a background launch. */
export class MobileAppActivity implements SessionActivity {
  constructor(readonly platform: string, readonly appState: AppStatePort) {}
  isBackground(): boolean {
    return this.platform === 'ios' && this.appState.currentState === 'background';
  }
  waitForForeground(): Promise<void> {
    if (!this.isBackground()) return Promise.resolve();
    return new Promise(resolve => {
      const subscription = this.appState.addEventListener('change', state => {
        // Once waiting, inactive does not release a background launch/write.
        if (state !== 'active') return;
        subscription.remove();
        resolve();
      });
    });
  }
}
