import { describe, expect, it, vi } from 'vitest';
import type { AppStateStatus } from 'react-native';
import { MobileAppActivity } from '../../src/runtime/MobileAppActivity';
import { DefaultProductMobileRuntime } from '../../src/runtime/DefaultProductMobileRuntime';
import { MobileSessionCoordinator } from '../../src/auth/MobileSessionCoordinator';
import type { ProviderAuthEvent, RefreshTokenStore, ProviderAuthPort } from '../../src/auth/contracts';
import type { ProductScanState } from '../../src/scan/contracts';
import type { ProductServerTransport } from '../../src/transport/contracts';

class ActivityState {
  listeners = new Set<(state: AppStateStatus)=>void>();
  constructor(public currentState:AppStateStatus) {}
  addEventListener(_type:'change', listener:(state:AppStateStatus)=>void) {
    this.listeners.add(listener);return {remove:()=>this.listeners.delete(listener)};
  }
  emit(state:AppStateStatus) {this.currentState=state;for(const l of [...this.listeners])l(state);}
}
function harness(initial:AppStateStatus='active', platform='ios') {
  const appState=new ActivityState(initial), activity=new MobileAppActivity(platform,appState);
  const identity={providerUserId:'A',email:'a@example.invalid'};
  const token={accessToken:'a',refreshToken:'r',identity};
  let listener:((event:ProviderAuthEvent)=>void)|null=null;
  const provider:ProviderAuthPort={signInWithPassword:vi.fn(async()=>({status:'authenticated' as const,tokens:token})),refreshSession:vi.fn(async()=>({status:'refreshed' as const,tokens:token})),signOutLocal:vi.fn(async()=>{}),subscribe:l=>{listener=l;return()=>{listener=null;};},startAutoRefresh:vi.fn(async()=>{}),stopAutoRefresh:vi.fn(async()=>{})};
  const store:RefreshTokenStore={isAvailable:vi.fn(async()=>true),read:vi.fn(async()=>{if(activity.isBackground())throw new Error('locked');return 'r';}),readIdentity:vi.fn(async()=>identity),writeIdentity:vi.fn(async()=>{}),write:vi.fn(async()=>{}),clear:vi.fn(async()=>{})};
  const backend={resolve:vi.fn(async()=>({status:'resolved' as const,session:{userId:'A',membershipId:'M',organizationId:'O',role:'employee' as const,nfcSetupAvailable:false}})),recordPasswordReset:vi.fn(async()=>({status:'recorded' as const}))};
  const session=new MobileSessionCoordinator(provider,store,backend,undefined,undefined,activity);
  let scanState:ProductScanState={status:'inactive'};
  const scan={getState:()=>scanState,subscribe:()=>()=>{},start:vi.fn(async()=>{scanState={status:'ready',outcome:null};}),stop:vi.fn(async()=>{}),scan:vi.fn(async()=>{}),cancel:vi.fn(async()=>{}),retry:vi.fn(async()=>{})};
  const admin={getState:()=>({status:'inactive' as const}),subscribe:()=>()=>{},start:async()=>{},stop:async()=>{},refresh:async()=>{},loadMore:async()=>{},provision:async()=>{},provisionBreak:async()=>{},cancel:async()=>{},prepareCustomer:async()=>({status:'unavailable' as const}),createCustomer:async()=>{}};
  const runtime=new DefaultProductMobileRuntime(session,{start(){},stop(){}},{} as ProductServerTransport,scan,admin,undefined,undefined,undefined,undefined,undefined,undefined,undefined,activity);
  return {runtime,session,store,provider,backend,activity,appState,scan,setScan:(s:ProductScanState)=>{scanState=s;},emit:(event:ProviderAuthEvent)=>listener?.(event)};
}
const settle=()=>new Promise(r=>setTimeout(r,0));
describe('T-115 lifecycle',()=>{
  it('waits for the active change after an iOS background launch, including inactive',async()=>{
    const h=harness('background');const start=h.runtime.start();await settle();
    expect(h.store.read).not.toHaveBeenCalled();expect(h.scan.start).not.toHaveBeenCalled();
    h.appState.emit('inactive');await settle();expect(h.store.read).not.toHaveBeenCalled();
    h.appState.emit('active');await start;
    expect(h.session.getState().status).toBe('authenticated');expect(h.scan.getState().status).toBe('ready');h.runtime.stop();
  });
  it.each([['inactive','ios'],['background','android']] as const)('starts %s on %s normally',async(initial,platform)=>{
    const h=harness(initial,platform);await h.runtime.start();expect(h.session.getState().status).toBe('authenticated');h.runtime.stop();
  });
  it.each(['active','button'] as const)('recovers session startup via %s and does nothing on a healthy active',async(trigger)=>{
    const h=harness();vi.mocked(h.store.read).mockRejectedValueOnce(new Error('locked'));
    await h.runtime.start();expect(h.session.getState().status).toBe('runtime_unavailable');
    if(trigger==='active'){h.appState.emit('background');h.appState.emit('active');}else await h.runtime.session.retryContext();
    await vi.waitFor(()=>expect(h.session.getState().status).toBe('authenticated'));
    const reads=vi.mocked(h.store.read).mock.calls.length, scans=h.scan.start.mock.calls.length;
    h.appState.emit('inactive');h.appState.emit('active');await settle();
    expect(h.store.read).toHaveBeenCalledTimes(reads);expect(h.scan.start).toHaveBeenCalledTimes(scans);h.runtime.stop();
  });
  it.each(['active','button'] as const)('recovers secure-identity startup protection via %s without retrying integrity failures',async(trigger)=>{
    const h=harness();await h.runtime.start();h.setScan({status:'protected_pending',reason:'local_evidence_protected',protection:['P01'],identityRecovery:'secure_store'});
    if(trigger==='active'){h.appState.emit('background');h.appState.emit('active');}else await h.runtime.session.retryContext();
    await vi.waitFor(()=>expect(h.scan.start).toHaveBeenCalledTimes(2));
    h.setScan({status:'protected_pending',reason:'local_evidence_protected',protection:['P03']});
    h.appState.emit('inactive');h.appState.emit('active');await h.runtime.session.retryContext();
    expect(h.scan.start).toHaveBeenCalledTimes(2);h.runtime.stop();
  });
  it.each(['P01','P03'] as const)('T-115 TL does not restart or refresh an authenticated integrity %s on active',async(protection)=>{
    const h=harness();await h.runtime.start();
    h.setScan({status:'protected_pending',reason:'local_evidence_protected',protection:[protection]});
    const starts=h.scan.start.mock.calls.length,stops=h.scan.stop.mock.calls.length;
    const refreshes=vi.mocked(h.provider.refreshSession).mock.calls.length;
    h.appState.emit('background');h.appState.emit('active');await settle();
    expect(h.scan.start).toHaveBeenCalledTimes(starts);expect(h.scan.stop).toHaveBeenCalledTimes(stops);
    expect(h.provider.refreshSession).toHaveBeenCalledTimes(refreshes);
    expect(h.session.getState().status).toBe('authenticated');h.runtime.stop();
  });
  it('iOS background 401 and retryContext do not refresh or write identity; inactive permits renewal',async()=>{
    const h=harness();await h.runtime.start();const refreshes=vi.mocked(h.provider.refreshSession).mock.calls.length;
    h.appState.emit('background');
    await expect(h.session.executeAuthenticatedRequest(async()=>({status:'authority_rejected'}))).resolves.toEqual({status:'unavailable'});
    expect(h.provider.refreshSession).toHaveBeenCalledTimes(refreshes);
    h.backend.resolve.mockRejectedValueOnce(new Error('offline'));h.appState.emit('active');await h.session.refresh();
    h.appState.emit('background');vi.mocked(h.store.writeIdentity).mockClear();
    await h.session.retryContext();expect(h.store.writeIdentity).not.toHaveBeenCalled();
    expect(h.provider.refreshSession).toHaveBeenCalledTimes(refreshes+1);
    h.appState.emit('inactive');await h.session.refresh();expect(h.provider.refreshSession).toHaveBeenCalledTimes(refreshes+2);h.runtime.stop();
  });
  it('defers a late refresh result write until active and retains the session',async()=>{
    const h=harness();await h.runtime.start();vi.mocked(h.store.write).mockClear();h.appState.emit('background');
    h.emit({type:'token_refreshed',tokens:{accessToken:'late',refreshToken:'late',identity:{providerUserId:'A',email:'a@example.invalid'}}});
    await settle();expect(h.store.write).not.toHaveBeenCalled();expect(h.provider.signOutLocal).not.toHaveBeenCalled();
    h.appState.emit('active');await vi.waitFor(()=>expect(h.store.write).toHaveBeenCalledWith('late'));h.runtime.stop();
  });
});

it('T-115 resumes a start interrupted by locking after the identity read',async()=>{
  const h=harness();const read=h.store.readIdentity;
  h.store.readIdentity=async()=>{const identity=await read();h.store.readIdentity=read;h.appState.emit('background');return identity;};
  await h.runtime.start();expect(h.provider.refreshSession).not.toHaveBeenCalled();
  h.appState.emit('active');await vi.waitFor(()=>expect(h.session.getState().status).toBe('authenticated'));h.runtime.stop();
});
it('T-115 bounds foreground persistence retries and returns from its recovery screen with the same token',async()=>{
  const h=harness();await h.runtime.start();vi.useFakeTimers();
  try {
    vi.mocked(h.store.write).mockRejectedValue(new Error('unavailable'));
    h.emit({type:'token_refreshed',tokens:{accessToken:'next',refreshToken:'next',identity:{providerUserId:'A',email:'a@example.invalid'}}});
    await vi.advanceTimersByTimeAsync(15_000);
    expect(h.session.getState()).toMatchObject({status:'recovery_required',reason:'token_persistence'});
    const calls=vi.mocked(h.store.write).mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);expect(h.store.write).toHaveBeenCalledTimes(calls);
    expect(h.provider.signOutLocal).not.toHaveBeenCalled();expect(h.store.clear).not.toHaveBeenCalled();
    vi.mocked(h.store.write).mockResolvedValue();await h.session.retryContext();
    expect(h.session.getState().status).toBe('authenticated');expect(h.store.write).toHaveBeenLastCalledWith('next');
  } finally {h.runtime.stop();vi.useRealTimers();}
});
it('T-115 ignores a late failed write after a newer sign-out generation',async()=>{
  const h=harness();await h.runtime.start();let fail!:(error:Error)=>void;
  vi.mocked(h.store.write).mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}));
  h.emit({type:'token_refreshed',tokens:{accessToken:'next',refreshToken:'next',identity:{providerUserId:'A',email:'a@example.invalid'}}});
  await vi.waitFor(()=>expect(fail).toBeTypeOf('function'));
  const logout=h.session.signOut();fail(new Error('old write'));
  await logout;await settle();expect(h.session.getState().status).toBe('signed_out');h.runtime.stop();
});

it('T-115 preserves a confirmed account when updated display identity persistence fails',async()=>{
  const h=harness();await h.runtime.start();
  vi.mocked(h.store.writeIdentity).mockRejectedValue(new Error('locked'));
  h.emit({type:'token_refreshed',tokens:{accessToken:'same-account',refreshToken:'same-account',identity:{providerUserId:'A',email:'updated@example.invalid'}}});
  await vi.waitFor(()=>expect(h.store.writeIdentity).toHaveBeenCalled());await settle();
  expect(h.session.getState().status).toBe('authenticated');expect(h.provider.signOutLocal).not.toHaveBeenCalled();expect(h.store.clear).not.toHaveBeenCalled();
  vi.mocked(h.store.writeIdentity).mockResolvedValue();await h.session.retryContext();
  expect(h.store.writeIdentity).toHaveBeenLastCalledWith({providerUserId:'A',email:'updated@example.invalid'});h.runtime.stop();
});

it('T-115 pauses archive sign-out polling in iOS background and completes on return',async()=>{
  const h=harness();
  const scan=Object.assign(h.scan,{prepareSignOut:vi.fn(async()=>({wait:true as const,accountKey:'O/M/A'})),pollArchiveForSignOut:vi.fn(async()=>false),onExplicitLogout:vi.fn(async()=>{})});
  await h.runtime.start();vi.useFakeTimers();
  try {
    await h.runtime.session.signOut();expect(scan.pollArchiveForSignOut).toHaveBeenCalledOnce();
    h.appState.emit('background');await vi.advanceTimersByTimeAsync(90_000);
    expect(scan.pollArchiveForSignOut).toHaveBeenCalledOnce();expect(h.provider.signOutLocal).not.toHaveBeenCalled();
    scan.pollArchiveForSignOut.mockResolvedValue(true);h.appState.emit('active');
    await vi.advanceTimersByTimeAsync(30_000);expect(h.session.getState().status).toBe('signed_out');
  } finally {h.runtime.stop();vi.useRealTimers();}
});
it('T-115 cannot restore account A after a failed clear when signing in as B',async()=>{
  const h=harness();await h.runtime.start();vi.mocked(h.store.clear).mockRejectedValue(new Error('delete failed'));
  const refreshes=vi.mocked(h.provider.refreshSession).mock.calls.length;
  await h.session.signIn('b@example.invalid','secret');
  expect(h.session.getState()).toMatchObject({status:'unauthenticated',reason:'sign_in_unavailable'});
  expect(h.provider.signInWithPassword).not.toHaveBeenCalled();
  h.appState.emit('background');h.appState.emit('active');await settle();
  expect(h.session.captureAuthenticatedSessionSnapshot()).toBeNull();expect(h.provider.refreshSession).toHaveBeenCalledTimes(refreshes);
  vi.mocked(h.store.clear).mockResolvedValue();await h.session.retryContext();
  expect(h.session.getState().status).toBe('unauthenticated');h.runtime.stop();
});

it('T-115 review P1: a renewal finishing after lock cannot continue the 401 request or read backend context',async()=>{
  const h=harness();await h.runtime.start();let complete!:(value:Awaited<ReturnType<ProviderAuthPort['refreshSession']>>)=>void;
  vi.mocked(h.provider.refreshSession).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
  const attempt=vi.fn(async()=>attempt.mock.calls.length===1?{status:'authority_rejected' as const}:{status:'completed' as const,value:'should not run'});
  const request=h.session.executeAuthenticatedRequest(attempt);
  await vi.waitFor(()=>expect(complete).toBeTypeOf('function'));h.appState.emit('background');
  const contexts=h.backend.resolve.mock.calls.length;
  complete({status:'refreshed',tokens:{accessToken:'late',refreshToken:'late',identity:{providerUserId:'A',email:'a@example.invalid'}}});
  await expect(request).resolves.toEqual({status:'unavailable'});
  expect(attempt).toHaveBeenCalledOnce();expect(h.backend.resolve).toHaveBeenCalledTimes(contexts);
  h.appState.emit('active');await vi.waitFor(()=>expect(h.store.write).toHaveBeenLastCalledWith('late'));
  await vi.waitFor(()=>expect(h.backend.resolve).toHaveBeenCalledTimes(contexts+1));h.runtime.stop();
});
