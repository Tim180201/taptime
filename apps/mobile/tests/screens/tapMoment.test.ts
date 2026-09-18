import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectTapMoment, tapMoment, TapMomentPresenter } from '../../src/screens/tapMoment';
import type { ProductScanCapability, ProductScanState } from '../../src/scan/contracts';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type { MobileWorkReadResult } from '../../src/work/contracts';
import type { ManualOfflineAcknowledgement } from '../../src/offline/OfflineCaptureCoordinator';

afterEach(() => vi.useRealTimers());
describe('tap scene lifecycle', () => {
  it('displays only the actual server decision and gives local capture no invented start/stop', () => {
    expect(tapMoment({ status: 'saved_locally', queueCount: 1 })).toEqual({ title: 'GESPEICHERT', confirmed: false });
    expect(tapMoment({ status: 'server_decision', queueCount: 0, outcome: { status: 'time_entry_started' } }))
      .toEqual({ title: 'GESTARTET', confirmed: true });
    expect(tapMoment({ status: 'server_decision', queueCount: 0, outcome: { status: 'active_entry_for_other_target_rejected' } })).toBeNull();
  });
  it('returns after two seconds without clearing evidence or replaying a retained ready outcome', () => {
    vi.useFakeTimers();
    const presenter = new TapMomentPresenter();
    const outcome = { status: 'time_entry_started' as const };
    presenter.observe({ status: 'scanning' });
    presenter.observe({ status: 'synchronizing', queueCount: 1 });
    presenter.observe({ status: 'server_decision', queueCount: 0, outcome });
    presenter.observe({ status: 'ready', outcome });
    vi.advanceTimersByTime(1999);
    expect(presenter.getState()?.title).toBe('GESTARTET');
    vi.advanceTimersByTime(1);
    expect(presenter.getState()).toBeNull();
    presenter.observe({ status: 'ready', outcome });
    expect(presenter.getState()).toBeNull();
    presenter.dispose();
  });
  it('cancels the old timer when a second tap arrives and removes timers on account unmount', () => {
    vi.useFakeTimers();
    const presenter = new TapMomentPresenter();
    const decision = (status: 'time_entry_started' | 'time_entry_stopped'): ProductScanState =>
      ({ status: 'server_decision', queueCount: 0, outcome: { status } });
    presenter.observe(decision('time_entry_started'));
    vi.advanceTimersByTime(1500);
    presenter.observe({ status: 'scanning' });
    expect(presenter.getState()).toBeNull();
    presenter.observe(decision('time_entry_stopped'));
    vi.advanceTimersByTime(500);
    expect(presenter.getState()?.title).toBe('GESTOPPT');
    presenter.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(presenter.getState()).toBeNull();
  });

  it('retains the manual acknowledgement while its read is in flight and refreshes a later NFC decision', async () => {
    const snapshot = { generation: 1, session: { userId: 'user', membershipId: 'member',
      organizationId: 'organization', nfcSetupAvailable: false, role: 'employee' as const } };
    const target = { targetType: 'general_work' as const, targetId: 'target', displayName: 'Arbeit' };
    const projection: MobileWorkReadResult = { status: 'ready', targets: { targets: [target], nextCursor: null },
      ownTime: { activeRecord: null, records: [], nextCursor: null,
        windowStartedAt: '2026-08-18T10:00:00Z', windowEndedAt: '2026-09-18T10:00:00Z' } };
    const reads: Array<(result: MobileWorkReadResult) => void> = [];
    const read = vi.fn(() => new Promise<MobileWorkReadResult>((resolve) => reads.push(resolve)));
    let acknowledgement: ManualOfflineAcknowledgement = { status: 'pending' };
    const acknowledgementListeners = new Set<() => void>();
    const work = new MobileWorkCoordinator({ capture: () => snapshot,
      isCurrent: (candidate) => candidate === snapshot, subscribe: () => () => {} }, {
      read, readOwnTimePage: async () => ({ status: 'unavailable' }),
      triggerManual: async () => ({ status: 'unavailable' }),
    }, {
      captureManual: async () => ({ status: 'saved', workEventId: 'event' }),
      readManualAcknowledgement: () => acknowledgement,
      subscribeManualAcknowledgements: (listener) => {
        acknowledgementListeners.add(listener); return () => acknowledgementListeners.delete(listener);
      },
    });
    let scanState: ProductScanState = { status: 'ready', outcome: null };
    const scanListeners = new Set<() => void>();
    const scan: ProductScanCapability = { getState: () => scanState,
      subscribe: (listener) => { scanListeners.add(listener); return () => scanListeners.delete(listener); },
      scan: async () => {}, cancel: async () => {}, retry: async () => {} };
    const publish = (state: ProductScanState) => {
      scanState = state; for (const listener of scanListeners) listener();
    };
    const presenter = new TapMomentPresenter();
    work.start();
    const initialRead = work.refresh();
    reads.shift()!(projection);
    await initialRead;
    const disconnect = connectTapMoment(scan, presenter, work);
    try {
      await work.triggerManual(target);
      publish({ status: 'saved_locally', queueCount: 1 });
      // OfflineCaptureCoordinator delivers the exact manual acknowledgement before the shared scan signal.
      acknowledgement = { status: 'server_decision', outcome: 'time_entry_started' };
      for (const listener of acknowledgementListeners) listener();
      publish({ status: 'server_decision', queueCount: 0, outcome: { status: 'time_entry_started' } });
      expect(reads).toHaveLength(1);
      reads.shift()!(projection);
      await vi.waitFor(() => expect(work.getState()).toMatchObject({ status: 'ready', outcome: 'time_entry_started' }));
      expect(read).toHaveBeenCalledTimes(2);

      publish({ status: 'scanning' });
      publish({ status: 'server_decision', queueCount: 0, outcome: { status: 'time_entry_stopped' } });
      expect(reads).toHaveLength(1);
      reads.shift()!(projection);
      await vi.waitFor(() => expect(work.getState().status).toBe('ready'));
      expect(read).toHaveBeenCalledTimes(3);
      expect(presenter.getState()?.title).toBe('GESTOPPT');
    } finally {
      disconnect(); presenter.dispose(); work.stop();
    }
  });
});
