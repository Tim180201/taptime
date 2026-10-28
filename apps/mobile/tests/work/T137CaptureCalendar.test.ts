import { expect, it, vi } from 'vitest';
import { captureFeedback, type MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type { MobileWorkApiPort, MobileWorkState } from '../../src/work/contracts';
import { harness, snapshot } from '../lockScreen/lockScreenHarness';

async function fixture(queued = false, stillPending = false) {
  const base = await harness().api.read(snapshot.session.membershipId);
  if (base.status !== 'ready' || !base.ownTime.activeRecord) throw Error('Missing fixture');
  const active = base.ownTime.activeRecord;
  const target = { targetType: active.targetType, targetId: active.targetId, displayName: active.targetDisplayName };
  const records = [1, 2, 3].map(n => ({ ...active,
    timeRecordId: `60000000-0000-4000-8000-00000000001${n}`, status: 'stopped' as const,
    stoppedAt: active.calendar!.asOf, stoppedVia: 'manual' as const }));
  const before = { ...base.ownTime, records, nextCursor: null };
  const page = (index: number): MobileOwnTimeQueryResponse => ({ ...before,
    activeRecord: { ...active, breakStartedAt: active.calendar!.asOf },
    records: [{ ...records[index]!, targetDisplayName: 'Neuer Name' }],
    nextCursor: index < records.length - 1 ? String(index + 1) : null });
  const api: MobileWorkApiPort = {
    read: vi.fn().mockResolvedValueOnce({ ...base, ownTime: before, targets: { targets: [target], nextCursor: null } })
      .mockResolvedValue({ ...base, ownTime: page(0) }),
    readOwnTimePage: vi.fn(async (_member, cursor) => ({ status: 'ready' as const, ownTime: page(Number(cursor)) })),
    triggerManual: vi.fn(), triggerBreak: vi.fn(async () => ({ status: 'accepted' as const, outcome: 'break_started' as const })),
  };
  let current = true;
  let saved = false;
  const work = new MobileWorkCoordinator({ capture: () => snapshot, isCurrent: () => current, subscribe: () => () => {} }, api,
    queued ? {
      captureManual: vi.fn(),
      captureBreak: async () => { saved = true; return { status: 'saved', workEventId: 'event' }; },
      hasUnconfirmedCapture: async () => saved && stillPending,
      readManualAcknowledgement: () => ({ status: 'server_decision', outcome: 'break_started' }),
    } : null);
  work.start();
  await work.refresh();
  const states: MobileWorkState[] = [];
  work.subscribe(() => states.push(work.getState()));
  return { api, work, before, page, states, invalidate: () => { current = false; work.stop(); } };
}

it.each([[false, false], [true, false], [true, true]])(
  'T137 publishes all capture pages together; queued=%s, capturePending=%s', async (queued, pending) => {
    const test = await fixture(queued, pending);
    let finish!: (result: Awaited<ReturnType<MobileWorkApiPort['readOwnTimePage']>>) => void;
    vi.mocked(test.api.readOwnTimePage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    try {
      const flight = test.work.triggerBreak();
      await vi.waitFor(() => expect(test.api.readOwnTimePage).toHaveBeenCalledWith(snapshot.session.membershipId, '1'));
      expect(test.work.getState()).toMatchObject({ status: 'ready', ownTime: test.before });
      finish({ status: 'ready', ownTime: test.page(1) });
      await flight;
      const complete = { ...test.page(2), records: [0, 1, 2].flatMap(n => test.page(n).records) };
      expect(test.work.getState()).toMatchObject({ status: 'ready', ownTime: complete,
        submitting: false, loadingMore: false, capturePending: pending,
        outcome: pending ? 'pending' : 'break_started',
        feedback: pending ? null : captureFeedback('break_started', test.before, complete) });
      // A mounted calendar must never see a replacement with a continuation cursor.
      expect(test.states.filter(state => state.status === 'ready').every(state => state.ownTime.nextCursor === null)).toBe(true);
      expect(test.api.readOwnTimePage).toHaveBeenCalledTimes(2);
    } finally { test.work.stop(); }
  },
);

it.each(['unavailable', 'authority_rejected', 'throw', 'duplicate', 'frame', 'cycle'] as const)(
  'T137 does not publish a partial capture calendar after %s on a continuation', async failure => {
    const test = await fixture();
    vi.mocked(test.api.readOwnTimePage).mockImplementation(async () => {
      if (failure === 'throw') throw Error('offline');
      if (failure === 'unavailable' || failure === 'authority_rejected') return { status: failure };
      return { status: 'ready', ownTime: failure === 'duplicate' ? test.page(0)
        : failure === 'frame' ? { ...test.page(1), windowEndedAt: '2026-10-22T07:00:00.000Z' }
          : { ...test.page(1), nextCursor: '1' } };
    });
    try {
      await test.work.triggerBreak();
      expect(test.work.getState()).toEqual({ status: 'unavailable',
        message: 'Bestätigte Zeiten konnten nicht neu geladen werden. Bitte erneut laden.' });
      expect(test.states.filter(state => state.status === 'ready').every(state => state.ownTime.nextCursor === null)).toBe(true);
    } finally { test.work.stop(); }
  },
);

it('T137 discards capture continuation pages after the session ends', async () => {
  const test = await fixture();
  let finish!: (result: Awaited<ReturnType<MobileWorkApiPort['readOwnTimePage']>>) => void;
  vi.mocked(test.api.readOwnTimePage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const flight = test.work.triggerBreak();
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  test.invalidate();
  finish({ status: 'ready', ownTime: test.page(1) });
  await flight;
  expect(test.work.getState()).toEqual({ status: 'inactive' });
});
