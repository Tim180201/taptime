import { describe, expect, it, vi } from 'vitest';
import type { AppStateStatus } from 'react-native';

vi.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: vi.fn() },
}));

import {
  AppStateAutoRefreshLifecycle,
  type AppStatePort,
} from '../../src/runtime/AppStateAutoRefreshLifecycle';

class FakeAppState implements AppStatePort {
  listener: ((state: AppStateStatus) => void) | null = null;
  readonly remove = vi.fn();
  addCount = 0;

  constructor(readonly currentState: AppStateStatus) {}

  addEventListener(_type: 'change', listener: (state: AppStateStatus) => void) {
    this.addCount += 1;
    this.listener = listener;
    return { remove: this.remove };
  }

  emit(state: AppStateStatus): void {
    this.listener?.(state);
  }
}

describe('AppStateAutoRefreshLifecycle', () => {
  it('registers once, starts once for active state, and deduplicates repeated state', async () => {
    const provider = {
      startAutoRefresh: vi.fn(async () => undefined),
      stopAutoRefresh: vi.fn(async () => undefined),
    };
    const appState = new FakeAppState('active');
    const lifecycle = new AppStateAutoRefreshLifecycle(provider, appState);

    lifecycle.start();
    lifecycle.start();
    appState.emit('active');

    await vi.waitFor(() => expect(provider.startAutoRefresh).toHaveBeenCalledTimes(1));
    expect(provider.stopAutoRefresh).not.toHaveBeenCalled();
    expect(appState.addCount).toBe(1);
  });

  it('serializes background and foreground transitions and stops on disposal', async () => {
    const calls: string[] = [];
    const provider = {
      startAutoRefresh: vi.fn(async () => { calls.push('start'); }),
      stopAutoRefresh: vi.fn(async () => { calls.push('stop'); }),
    };
    const appState = new FakeAppState('active');
    const lifecycle = new AppStateAutoRefreshLifecycle(provider, appState);

    lifecycle.start();
    await vi.waitFor(() => expect(calls).toEqual(['start']));
    appState.emit('background');
    appState.emit('active');
    await vi.waitFor(() => expect(calls).toEqual(['start', 'stop', 'start']));
    lifecycle.stop();
    await vi.waitFor(() => expect(calls).toEqual(['start', 'stop', 'start', 'stop']));
    expect(appState.remove).toHaveBeenCalledTimes(1);
  });

  it('contains provider lifecycle rejection without an unhandled promise', async () => {
    const provider = {
      startAutoRefresh: vi.fn(async () => { throw new Error('provider detail'); }),
      stopAutoRefresh: vi.fn(async () => undefined),
    };
    const appState = new FakeAppState('active');
    const lifecycle = new AppStateAutoRefreshLifecycle(provider, appState);

    lifecycle.start();
    await vi.waitFor(() => expect(provider.startAutoRefresh).toHaveBeenCalledTimes(1));
    appState.emit('background');
    await new Promise((resolve) => setTimeout(resolve, 0));
    lifecycle.stop();
  });
});

it('T-115 stops automatic refresh while token persistence is pending, including foreground return',async()=>{
  const provider={startAutoRefresh:vi.fn(async()=>{}),stopAutoRefresh:vi.fn(async()=>{})};
  const appState=new FakeAppState('active');let allowed=true;let changed=()=>{};
  const lifecycle=new AppStateAutoRefreshLifecycle(provider,appState,{canAutoRefresh:()=>allowed,subscribeRefreshPolicy:l=>{changed=l;return()=>{};}});
  lifecycle.start();await vi.waitFor(()=>expect(provider.startAutoRefresh).toHaveBeenCalledOnce());
  allowed=false;changed();await vi.waitFor(()=>expect(provider.stopAutoRefresh).toHaveBeenCalledOnce());
  appState.emit('background');appState.emit('active');await new Promise(r=>setTimeout(r,0));
  expect(provider.startAutoRefresh).toHaveBeenCalledOnce();
  allowed=true;changed();await vi.waitFor(()=>expect(provider.startAutoRefresh).toHaveBeenCalledTimes(2));lifecycle.stop();
});
