import { describe, expect, it, vi } from 'vitest';
import type { InternalAuthenticatedSessionSnapshot } from '../../src/auth/contracts';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type {
  MobileWorkApiPort,
  MobileWorkSessionReader,
} from '../../src/work/contracts';

const snapshot: InternalAuthenticatedSessionSnapshot = {
  generation: 7,
  session: {
    userId: '10000000-0000-4000-8000-000000000001',
    membershipId: '20000000-0000-4000-8000-000000000001',
    organizationId: '30000000-0000-4000-8000-000000000001',
    role: 'employee',
  },
};
const target = {
  targetType: 'general_work' as const,
  targetId: '40000000-0000-4000-8000-000000000001',
  displayName: 'Allgemeine Arbeitszeit',
};
const readyRead = {
  status: 'ready' as const,
  ownTime: {
    activeRecord: null,
    records: [],
    nextCursor: null,
    windowStartedAt: '2026-06-23T10:00:00.000Z',
    windowEndedAt: '2026-07-24T10:00:00.000Z',
  },
  targets: { targets: [target], nextCursor: null },
};

describe('MobileWorkCoordinator', () => {
  it('drops a read result when the authenticated generation is replaced', async () => {
    let current = true;
    let resolveRead!: (value: typeof readyRead) => void;
    const api: MobileWorkApiPort = {
      read: () => new Promise((resolve) => { resolveRead = resolve; }),
      async readOwnTimePage() { return { status: 'unavailable' }; },
      async triggerManual() { return { status: 'unavailable' }; },
    };
    const session = sessionReader(() => current);
    const coordinator = new MobileWorkCoordinator(session, api);
    const pending = coordinator.refresh();
    current = false;
    resolveRead(readyRead);
    await pending;

    expect(coordinator.getState()).toEqual({ status: 'loading' });
  });

  it('accepts only a target from the current safe projection and refreshes after the trigger', async () => {
    const api: MobileWorkApiPort = {
      read: vi.fn(async () => readyRead),
      readOwnTimePage: vi.fn(async () => ({ status: 'unavailable' as const })),
      triggerManual: vi.fn(async () => ({
        status: 'accepted' as const,
        outcome: 'time_entry_started' as const,
      })),
    };
    const coordinator = new MobileWorkCoordinator(sessionReader(() => true), api);
    await coordinator.refresh();
    await coordinator.triggerManual({
      ...target,
      targetId: '50000000-0000-4000-8000-000000000001',
    });
    expect(api.triggerManual).not.toHaveBeenCalled();

    await coordinator.triggerManual(target);
    expect(api.triggerManual).toHaveBeenCalledWith(snapshot.session.membershipId, target);
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      outcome: 'time_entry_started',
    });
    expect(api.read).toHaveBeenCalledTimes(2);
  });

  it('persists the selected target through the shared offline FIFO before reporting pending', async () => {
    const api: MobileWorkApiPort = {
      read: vi.fn(async () => readyRead),
      readOwnTimePage: vi.fn(async () => ({ status: 'unavailable' as const })),
      triggerManual: vi.fn(async () => ({
        status: 'accepted' as const,
        outcome: 'time_entry_started' as const,
      })),
    };
    const captureManual = vi.fn(async () => ({
      status: 'saved' as const,
      workEventId: '50000000-0000-4000-8000-000000000001',
    }));
    const coordinator = new MobileWorkCoordinator(
      sessionReader(() => true),
      api,
      { captureManual },
    );
    await coordinator.refresh();
    await coordinator.triggerManual(target);
    expect(captureManual).toHaveBeenCalledWith(target);
    expect(api.triggerManual).not.toHaveBeenCalled();
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      submitting: false,
      outcome: 'pending',
    });
  });

  it('loads own-time pages on demand while preserving the immutable active/window frame', async () => {
    const first = {
      ...readyRead,
      ownTime: { ...readyRead.ownTime, nextCursor: 'v1:next' },
    };
    const continuation = {
      ...readyRead.ownTime,
      records: [{
        timeRecordId: '60000000-0000-4000-8000-000000000001',
        source: 'canonical' as const,
        targetType: 'general_work' as const,
        targetDisplayName: 'Allgemeine Arbeitszeit',
        status: 'stopped' as const,
        startedAt: '2026-07-23T08:00:00.000Z',
        stoppedAt: '2026-07-23T09:00:00.000Z',
        startedVia: 'manual' as const,
        stoppedVia: 'nfc' as const,
      }],
      nextCursor: null,
    };
    const api: MobileWorkApiPort = {
      read: vi.fn(async () => first),
      readOwnTimePage: vi.fn(async () => ({ status: 'ready' as const, ownTime: continuation })),
      triggerManual: vi.fn(async () => ({ status: 'unavailable' as const })),
    };
    const coordinator = new MobileWorkCoordinator(sessionReader(() => true), api);

    await coordinator.refresh();
    await coordinator.loadMoreOwnTime();

    expect(api.readOwnTimePage).toHaveBeenCalledWith(
      snapshot.session.membershipId,
      'v1:next',
    );
    const state = coordinator.getState();
    expect(state).toMatchObject({
      status: 'ready',
      loadingMore: false,
      ownTime: { nextCursor: null, records: [{ timeRecordId: continuation.records[0]!.timeRecordId }] },
    });
    if (state.status === 'ready') {
      expect(Object.isFrozen(state.ownTime)).toBe(true);
      expect(Object.isFrozen(state.ownTime.records)).toBe(true);
    }
  });

  it.each(['duplicate', 'changed_frame', 'repeated_cursor'] as const)(
    'fails a malformed own-time %s continuation closed',
    async (scenario) => {
      const record = {
        timeRecordId: '60000000-0000-4000-8000-000000000001',
        source: 'canonical' as const,
        targetType: 'general_work' as const,
        targetDisplayName: 'Arbeit',
        status: 'stopped' as const,
        startedAt: '2026-07-23T08:00:00.000Z',
        stoppedAt: '2026-07-23T09:00:00.000Z',
        startedVia: 'manual' as const,
        stoppedVia: 'manual' as const,
      };
      const firstRecord = scenario === 'duplicate' ? [record] : [];
      const first = {
        ...readyRead,
        ownTime: { ...readyRead.ownTime, records: firstRecord, nextCursor: 'v1:next' },
      };
      const page = {
        ...readyRead.ownTime,
        records: [record],
        nextCursor: scenario === 'repeated_cursor' ? 'v1:next' : null,
        windowEndedAt: scenario === 'changed_frame'
          ? '2026-07-24T10:01:00.000Z'
          : readyRead.ownTime.windowEndedAt,
      };
      const api: MobileWorkApiPort = {
        read: vi.fn(async () => first),
        readOwnTimePage: vi.fn(async () => ({ status: 'ready' as const, ownTime: page })),
        triggerManual: vi.fn(async () => ({ status: 'unavailable' as const })),
      };
      const coordinator = new MobileWorkCoordinator(sessionReader(() => true), api);
      await coordinator.refresh();
      await coordinator.loadMoreOwnTime();
      expect(coordinator.getState()).toEqual({
        status: 'unavailable',
        message: 'Arbeitsdaten sind derzeit nicht erreichbar.',
      });
    },
  );

  it('drops an own-time continuation when the session generation is replaced', async () => {
    let current = true;
    let resolvePage!: (value: {
      status: 'ready';
      ownTime: typeof readyRead.ownTime;
    }) => void;
    const api: MobileWorkApiPort = {
      read: vi.fn(async () => ({
        ...readyRead,
        ownTime: { ...readyRead.ownTime, nextCursor: 'v1:next' },
      })),
      readOwnTimePage: () => new Promise((resolve) => { resolvePage = resolve; }),
      triggerManual: vi.fn(async () => ({ status: 'unavailable' as const })),
    };
    const coordinator = new MobileWorkCoordinator(sessionReader(() => current), api);
    await coordinator.refresh();
    const loading = coordinator.loadMoreOwnTime();
    current = false;
    resolvePage({ status: 'ready', ownTime: readyRead.ownTime });
    await loading;
    expect(coordinator.getState()).toMatchObject({
      status: 'ready',
      loadingMore: true,
      ownTime: { records: [] },
    });
  });

  it('moves pending manual evidence only from its exact server acknowledgement and refreshes',
    async () => {
      let acknowledgement:
        | { status: 'pending' }
        | { status: 'review_pending' }
        | { status: 'protected' }
        | { status: 'server_decision'; outcome: 'time_entry_started' }
        | null = null;
      const listeners = new Set<() => void>();
      const workEventId = '50000000-0000-4000-8000-000000000001';
      const captureManual = vi.fn(async () => {
        acknowledgement = { status: 'pending' };
        return { status: 'saved' as const, workEventId };
      });
      const api: MobileWorkApiPort = {
        read: vi.fn(async () => readyRead),
        readOwnTimePage: vi.fn(async () => ({ status: 'unavailable' as const })),
        triggerManual: vi.fn(async () => ({ status: 'unavailable' as const })),
      };
      const coordinator = new MobileWorkCoordinator(sessionReader(() => true), api, {
        captureManual,
        readManualAcknowledgement: () => acknowledgement,
        subscribeManualAcknowledgements(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      });
      coordinator.start();
      await coordinator.refresh();
      await coordinator.triggerManual(target);
      await coordinator.triggerManual(target);
      expect(captureManual).toHaveBeenCalledOnce();
      expect(coordinator.getState()).toMatchObject({ status: 'ready', outcome: 'pending' });

      acknowledgement = { status: 'review_pending' };
      for (const listener of listeners) listener();
      await Promise.resolve();
      expect(coordinator.getState()).toMatchObject({ status: 'ready', outcome: 'pending' });
      acknowledgement = { status: 'protected' };
      for (const listener of listeners) listener();
      await Promise.resolve();
      expect(coordinator.getState()).toMatchObject({ status: 'ready', outcome: 'pending' });

      acknowledgement = { status: 'server_decision', outcome: 'time_entry_started' };
      for (const listener of listeners) listener();
      await vi.waitFor(() => expect(coordinator.getState()).toMatchObject({
        status: 'ready',
        outcome: 'time_entry_started',
      }));
      expect(api.read).toHaveBeenCalledTimes(2);
    });

  it.each(['signout', 'replacement'] as const)(
    'invalidates a pending manual acknowledgement on %s',
    async (transition) => {
      let current: InternalAuthenticatedSessionSnapshot | null = snapshot;
      const sessionListeners = new Set<() => void>();
      const acknowledgementListeners = new Set<() => void>();
      let acknowledgement:
        | { status: 'pending' }
        | { status: 'server_decision'; outcome: 'time_entry_stopped' } = {
          status: 'pending',
        };
      const session: MobileWorkSessionReader = {
        capture: () => current,
        isCurrent: (candidate) => candidate === current,
        subscribe(listener) {
          sessionListeners.add(listener);
          return () => sessionListeners.delete(listener);
        },
      };
      const api: MobileWorkApiPort = {
        read: vi.fn(async () => readyRead),
        readOwnTimePage: vi.fn(async () => ({ status: 'unavailable' as const })),
        triggerManual: vi.fn(async () => ({ status: 'unavailable' as const })),
      };
      const coordinator = new MobileWorkCoordinator(session, api, {
        async captureManual() {
          return {
            status: 'saved',
            workEventId: '50000000-0000-4000-8000-000000000001',
          };
        },
        readManualAcknowledgement: () => acknowledgement,
        subscribeManualAcknowledgements(listener) {
          acknowledgementListeners.add(listener);
          return () => acknowledgementListeners.delete(listener);
        },
      });
      coordinator.start();
      await coordinator.refresh();
      await coordinator.triggerManual(target);
      current = transition === 'signout'
        ? null
        : { ...snapshot, generation: snapshot.generation + 1 };
      for (const listener of sessionListeners) listener();
      acknowledgement = { status: 'server_decision', outcome: 'time_entry_stopped' };
      for (const listener of acknowledgementListeners) listener();
      await Promise.resolve();

      expect(coordinator.getState()).toEqual({ status: 'inactive' });
      expect(api.read).toHaveBeenCalledOnce();
    },
  );

  it('moves pending manual evidence to rejected only from the exact rejection acknowledgement',
    async () => {
      let acknowledgement:
        | { status: 'pending' }
        | { status: 'rejected' } = { status: 'pending' };
      const listeners = new Set<() => void>();
      const api: MobileWorkApiPort = {
        read: vi.fn(async () => readyRead),
        readOwnTimePage: vi.fn(async () => ({ status: 'unavailable' as const })),
        triggerManual: vi.fn(async () => ({ status: 'unavailable' as const })),
      };
      const coordinator = new MobileWorkCoordinator(sessionReader(() => true), api, {
        async captureManual() {
          return {
            status: 'saved',
            workEventId: '50000000-0000-4000-8000-000000000001',
          };
        },
        readManualAcknowledgement: () => acknowledgement,
        subscribeManualAcknowledgements(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      });
      coordinator.start();
      await coordinator.refresh();
      await coordinator.triggerManual(target);
      acknowledgement = { status: 'rejected' };
      for (const listener of listeners) listener();
      await vi.waitFor(() => expect(coordinator.getState()).toMatchObject({
        status: 'ready',
        outcome: 'rejected',
      }));
      expect(api.read).toHaveBeenCalledOnce();
    });
});

function sessionReader(
  isCurrent: () => boolean,
): MobileWorkSessionReader {
  return {
    capture: () => snapshot,
    isCurrent,
    subscribe: () => () => undefined,
  };
}
