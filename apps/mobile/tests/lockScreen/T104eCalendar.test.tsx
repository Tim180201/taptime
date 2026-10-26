// @vitest-environment jsdom
import { createElement as h } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import { harness, snapshot } from './lockScreenHarness';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type { ProductScanCapability } from '../../src/scan/contracts';
vi.mock('react-native', async () => ({ ...await vi.importActual<typeof import('react-native')>('react-native-web'),
  AccessibilityInfo: { announceForAccessibility: vi.fn(), isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
}));
vi.mock('react-native-safe-area-context', async () => {
  const { View } = await vi.importActual<typeof import('react-native')>('react-native-web');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
const { OwnTimeScreen } = await import('../../src/screens/OwnTimeScreen');
const { ScanScreen } = await import('../../src/screens/ScanScreen');

afterEach(() => { cleanup(); vi.useRealTimers(); });
async function settle() {
  // Advance individual request round trips so React runs the real page-loading effect between pages.
  for (let i = 0; i < 30; i++) await act(async () => { await vi.advanceTimersByTimeAsync(10); });
}
async function calendarHarness(active=false) {
  const test = harness();
  const base = await test.api.read('member');
  if (base.status !== 'ready' || !base.ownTime.activeRecord) throw Error('Missing fixture');
  const record = base.ownTime.activeRecord;
  const records = [1, 2, 3].map(n => ({ ...record, timeRecordId: `60000000-0000-4000-8000-00000000001${n}`,
    status: 'stopped' as const, stoppedAt: record.calendar!.asOf, stoppedVia: 'manual' as const }));
  const page = (index: number): MobileOwnTimeQueryResponse => ({ ...base.ownTime,
    activeRecord: active ? record : null, records: [records[index]!], nextCursor: index < records.length - 1 ? String(index + 1) : null });
  const delay = () => new Promise(resolve => setTimeout(resolve, 10));
  test.api.read = vi.fn(async () => { await delay(); return { ...base, ownTime: page(0) }; });
  test.api.readOwnTimePage = vi.fn(async (_member, cursor) => { await delay(); return { status: 'ready' as const, ownTime: page(Number(cursor)) }; });
  return { test, records, page, base };
}
it.each([
  ['Android', false, false], ['iPhone', true, false], ['Android', false, true], ['iPhone', true, true],
] as const)('T104e B: %s with open own times, active=%s/%s, reaches a complete calendar and stops reading', async (_platform, foregroundOnly, active) => {
  const {test,records}=await calendarHarness(active);
  Object.defineProperty(test.native, 'foregroundOnly', { value: foregroundOnly });
  vi.useFakeTimers();
  try {
    test.controller.start();
    render(h(OwnTimeScreen, { work: test.work }));
    await settle();
    const reads = vi.mocked(test.api.read).mock.calls.length;
    const pageReads = vi.mocked(test.api.readOwnTimePage).mock.calls.length;
    await settle();
    expect({ reads: vi.mocked(test.api.read).mock.calls.length, pageReads: vi.mocked(test.api.readOwnTimePage).mock.calls.length })
      .toEqual({ reads, pageReads });
    expect(test.work.getState()).toMatchObject({ status: 'ready', ownTime: { nextCursor: null, records } });
    expect(pageReads).toBeGreaterThanOrEqual(records.length - 1);
  } finally { test.controller.stop(); cleanup(); }
});

it.each(['refresh','refreshPreservingActive'] as const)('keeps the complete visible calendar until %s has every new page, including on failure', async method => {
  const {test,records,page,base}=await calendarHarness();
  vi.useFakeTimers();
  try {
    render(h(OwnTimeScreen,{work:test.work}));
    await settle();
    const before=test.work.getState();
    expect(before).toMatchObject({ownTime:{nextCursor:null,records}});
    const updated=(index:number)=>({...page(index),records:page(index).records.map(r=>({...r,targetDisplayName:'Neuer Name'}))});
    test.api.read=vi.fn(async()=>({...base,ownTime:updated(0)}));
    let finish!:(value:Awaited<ReturnType<typeof test.api.readOwnTimePage>>)=>void;
    test.api.readOwnTimePage=vi.fn(async()=>new Promise<Awaited<ReturnType<typeof test.api.readOwnTimePage>>>(resolve=>{finish=resolve;}));
    let flight!:Promise<unknown>;
    await act(async()=>{flight=test.work[method]();});
    expect(test.work.getState()).toBe(before);
    await act(async()=>{finish({status:'unavailable'});await flight;});
    const failed=test.work.getState();
    if(method==='refresh') {
      expect(failed).toMatchObject({status:'ready',refreshError:'Arbeitsdaten sind derzeit nicht erreichbar.'});
      expect(failed.status==='ready'&&failed.ownTime).toBe(before.status==='ready'&&before.ownTime);
    } else expect(failed).toBe(before);
    test.api.readOwnTimePage=vi.fn(async(_member,cursor)=>cursor==='1'?new Promise<Awaited<ReturnType<typeof test.api.readOwnTimePage>>>(resolve=>{finish=resolve;}):{status:'ready' as const,ownTime:updated(2)});
    await act(async()=>{flight=test.work[method]();});
    expect(test.work.getState()).toBe(failed);
    await act(async()=>{finish({status:'ready',ownTime:updated(1)});await flight;});
    expect(test.work.getState()).toMatchObject({status:'ready',ownTime:{nextCursor:null,
      records:records.map(r=>({...r,targetDisplayName:'Neuer Name'}))},refreshError:null});
  } finally {cleanup();test.controller.stop();}
});

it('T104e R2: Aktualisieren offline keeps the calendar and offers a visible read retry',async()=>{
  const {test,records}=await calendarHarness();
  vi.useFakeTimers();
  render(h(OwnTimeScreen,{work:test.work}));await settle();
  const before=test.work.getState();
  const read=test.api.read;
  test.api.read=vi.fn(async()=>{throw Error('offline');});
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Aktualisieren'}));});
  expect(test.work.getState()).toMatchObject({status:'ready',ownTime:{records,nextCursor:null}});
  expect(screen.getByText('Arbeitsdaten sind derzeit nicht erreichbar.')).toBeDefined();
  test.api.read=read;
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Erneut versuchen'}));});
  await settle();
  expect(screen.queryByText('Arbeitsdaten sind derzeit nicht erreichbar.')).toBeNull();
  expect(test.work.getState()).toMatchObject({status:'ready',ownTime:before.status==='ready'?before.ownTime:undefined});
});

it('T104e R2: a confirmed queued capture clears transferring even when its follow-up read fails',async()=>{
  const test=harness(),base=await test.api.read('member');
  let pending=true,acknowledge=()=>{};
  const work=new MobileWorkCoordinator({capture:()=>snapshot,isCurrent:value=>value===snapshot,subscribe:()=>()=>{}},test.api,{
    captureManual:vi.fn(async()=>({status:'unavailable' as const})),
    hasUnconfirmedCapture:async()=>pending,
    readManualAcknowledgement:()=>null,
    subscribeManualAcknowledgements:listener=>{acknowledge=listener;return()=>{};},
  });
  const scan:ProductScanCapability={getState:()=>scanReady,subscribe:()=>()=>{},scan:vi.fn(async()=>{}),cancel:async()=>{},retry:vi.fn(async()=>{})};
  const scanReady={status:'ready' as const,outcome:null};
  work.start();
  try {
    await work.refresh();
    render(h(ScanScreen,{actor:'employee',scan,work,signOut:async()=>{},retryRecovery:async()=>{}}));
    expect(screen.getByText('Wird übertragen … Deine Erfassung ist gespeichert, wird übertragen.')).toBeDefined();
    const before=work.getState();
    test.api.read=vi.fn(async()=>({status:'unavailable' as const}));
    // Queue confirmation notifies the existing acknowledgement subscription (also used for NFC).
    pending=false;await act(async()=>{acknowledge();});
    expect(work.getState()).toMatchObject({status:'ready',capturePending:false,outcome:null,
      ownTime:before.status==='ready'?before.ownTime:undefined});
    expect(screen.queryByText('Wird übertragen … Deine Erfassung ist gespeichert, wird übertragen.')).toBeNull();
    expect(screen.getByText('Arbeitsdaten sind derzeit nicht erreichbar.')).toBeDefined();
    test.api.read=vi.fn(async()=>base);
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Erneut versuchen'}));});
    expect(screen.queryByText('Arbeitsdaten sind derzeit nicht erreichbar.')).toBeNull();
    expect(scan.scan).not.toHaveBeenCalled();expect(scan.retry).not.toHaveBeenCalled();
    expect(test.api.triggerManual).not.toHaveBeenCalled();
  }finally{cleanup();work.stop();}
});
