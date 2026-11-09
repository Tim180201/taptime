import { afterEach, expect, it, vi } from 'vitest';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type { MobileWorkApiPort, MobileWorkReadResult } from '../../src/work/contracts';
import type { InternalAuthenticatedSessionSnapshot } from '../../src/auth/contracts';

const time = Date.parse('2026-10-31T12:00:00Z');
const snapshot: InternalAuthenticatedSessionSnapshot = { generation: 1, session: {
  userId:'10000000-0000-4000-8000-000000000001',organizationId:'20000000-0000-4000-8000-000000000001',
  membershipId:'30000000-0000-4000-8000-000000000001',role:'employee',nfcSetupAvailable:false,
} };
const ready = { status:'ready' as const, ownTime:{activeRecord:null,records:[],nextCursor:null,
  windowStartedAt:'2026-09-30T22:00:00.000Z',windowEndedAt:'2026-10-31T12:00:00.000Z'},
  targets:{targets:[],nextCursor:null} };
function deferred<T>() {
  let resolve!:(value:T)=>void;
  return {promise:new Promise<T>(done=>{resolve=done;}),resolve:(value:T)=>resolve(value)};
}
function setup() {
  let current: InternalAuthenticatedSessionSnapshot | null = snapshot;
  const listeners=new Set<()=>void>();
  const api:MobileWorkApiPort={read:vi.fn(async()=>ready),readOwnTimePage:vi.fn(),triggerManual:vi.fn()};
  const work=new MobileWorkCoordinator({capture:()=>current,isCurrent:s=>s===current,
    subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}},api);
  work.start();
  return {work,api,change:(next:typeof current)=>{current=next;listeners.forEach(listener=>listener());}};
}
afterEach(()=>vi.restoreAllMocks());

it('T142: two openings share one complete read and never publish partial sums',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(time);
  const {work,api}=setup();
  const page=deferred<Awaited<ReturnType<MobileWorkApiPort['readOwnTimePage']>>>(),entered=deferred<void>();
  vi.mocked(api.read).mockResolvedValue({...ready,ownTime:{...ready.ownTime,nextCursor:'next'}});
  vi.mocked(api.readOwnTimePage).mockImplementation(()=>{entered.resolve();return page.promise;});
  const published:string[]=[];
  work.subscribe(()=>published.push(work.getState().status));
  const first=work.ensureOwnTime();await entered.promise;
  const second=work.ensureOwnTime();
  expect(work.getState().status).toBe('loading');
  page.resolve({status:'ready',ownTime:ready.ownTime});await Promise.all([first,second]);
  await work.ensureOwnTime();
  expect(api.read).toHaveBeenCalledOnce();expect(api.readOwnTimePage).toHaveBeenCalledOnce();
  expect(published.filter(status=>status==='ready')).toHaveLength(1);work.stop();
});

it('T142: simultaneous requests share a read; later authority requests share one follow-up begun after suspend',async()=>{
  const {work,api}=setup(),response=deferred<MobileWorkReadResult>(),entered=deferred<void>();
  vi.mocked(api.read).mockImplementationOnce(()=>{entered.resolve();return response.promise;});
  const initial=[work.refresh(),work.refreshPreservingActive(),work.refresh()];
  await entered.promise;
  const followups=[work.refreshPreservingActive(),work.refreshPreservingActive(),work.refreshPreservingActive()];
  expect(api.read).toHaveBeenCalledOnce();
  response.resolve(ready);await Promise.all([...initial,...followups]);
  expect(api.read).toHaveBeenCalledTimes(2);work.stop();
});

it.each(['stop','signout','account'] as const)('T142: a queued read cannot restore the old owner after %s',async change=>{
  const {work,api,change:setSession}=setup(),response=deferred<MobileWorkReadResult>(),entered=deferred<void>();
  vi.mocked(api.read).mockImplementationOnce(()=>{entered.resolve();return response.promise;});
  const first=work.refresh();await entered.promise;
  const next=work.refreshPreservingActive();
  if(change==='stop')work.stop();else setSession(change==='signout'?null:{...snapshot,generation:2,
    session:{...snapshot.session,membershipId:'30000000-0000-4000-8000-000000000002'}});
  response.resolve(ready);await first;expect(await next).toBe('superseded');
  expect(work.getState().status).toBe('inactive');expect(api.read).toHaveBeenCalledOnce();work.stop();
});

it('T142: a known calendar remains visible until every replacement page arrives, including a retry after failure',async()=>{
  const {work,api}=setup();await work.refresh();const old=work.getState();
  const page=deferred<Awaited<ReturnType<MobileWorkApiPort['readOwnTimePage']>>>(),entered=deferred<void>();
  vi.mocked(api.read).mockResolvedValueOnce({...ready,ownTime:{...ready.ownTime,nextCursor:'next'}});
  vi.mocked(api.readOwnTimePage).mockImplementationOnce(()=>{entered.resolve();return page.promise;});
  const refresh=work.refresh();await entered.promise;expect(work.getState()).toBe(old);
  page.resolve({status:'unavailable'});await refresh;
  expect(work.getState()).toMatchObject({status:'ready',ownTime:ready.ownTime,refreshError:expect.any(String)});
  await work.ensureOwnTime();expect(api.read).toHaveBeenCalledTimes(3);
  expect(work.getState()).toMatchObject({status:'ready',refreshError:null});work.stop();
});

it('T142: age, day change and local edits invalidate reuse; explicit refresh always reads',async()=>{
  const clock=vi.spyOn(Date,'now').mockReturnValue(time);
  const {work,api}=setup();await work.ensureOwnTime();await work.ensureOwnTime();
  expect(api.read).toHaveBeenCalledOnce();
  work.invalidateOwnTime();await work.ensureOwnTime();expect(api.read).toHaveBeenCalledTimes(2);
  clock.mockReturnValue(time+30_000);await work.ensureOwnTime();expect(api.read).toHaveBeenCalledTimes(3);
  await work.refresh();expect(api.read).toHaveBeenCalledTimes(4);
  clock.mockReturnValue(Date.parse('2026-10-31T22:59:59.999Z'));
  vi.mocked(api.read).mockResolvedValue({...ready,ownTime:{...ready.ownTime,windowEndedAt:new Date(Date.now()).toISOString()}});
  await work.refresh();clock.mockReturnValue(Date.parse('2026-10-31T23:00:00.001Z'));
  await work.ensureOwnTime();expect(api.read).toHaveBeenCalledTimes(6);work.stop();
});

it('T142: an edit during a read queues one fresh snapshot instead of making the old one reusable',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(time);
  const {work,api}=setup(),response=deferred<MobileWorkReadResult>(),entered=deferred<void>();
  vi.mocked(api.read).mockImplementationOnce(()=>{entered.resolve();return response.promise;});
  const first=work.ensureOwnTime();await entered.promise;
  work.invalidateOwnTime();const edited=work.refresh();
  response.resolve(ready);await Promise.all([first,edited]);await work.ensureOwnTime();
  expect(api.read).toHaveBeenCalledTimes(2);work.stop();
});

it('T142: an edit during capture reload cannot make the older calendar reusable',async()=>{
  vi.spyOn(Date,'now').mockReturnValue(time);
  const {work,api}=setup();await work.ensureOwnTime();
  api.triggerBreak=vi.fn(async()=>({status:'accepted',outcome:'break_started'} as const));
  const page=deferred<Awaited<ReturnType<MobileWorkApiPort['readOwnTimePage']>>>(),entered=deferred<void>();
  vi.mocked(api.read).mockResolvedValueOnce({...ready,ownTime:{...ready.ownTime,nextCursor:'next'}});
  vi.mocked(api.readOwnTimePage).mockImplementationOnce(()=>{entered.resolve();return page.promise;});
  const capture=work.triggerBreak();await entered.promise;
  work.invalidateOwnTime();
  page.resolve({status:'ready',ownTime:ready.ownTime});await capture;
  await work.ensureOwnTime();expect(api.read).toHaveBeenCalledTimes(3);work.stop();
});
