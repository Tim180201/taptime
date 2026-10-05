import { describe, expect, it, vi } from 'vitest';
import type { EmployeeEnrollmentResult, MobileSessionState, SignInResult } from '../../src/auth/contracts';
import {
  DefaultProductMobileRuntime,
  type ProductScanRuntimeOwner,
  type ProductSessionRuntimeOwner,
  type ProductMobileWorkRuntimeOwner,
} from '../../src/runtime/DefaultProductMobileRuntime';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type { ProductScanState } from '../../src/scan/contracts';
import type { AdminSetupState } from '../../src/administration/contracts';
import type { ProductServerTransport } from '../../src/transport/contracts';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeSessionRuntimeOwner implements ProductSessionRuntimeOwner {
  readonly start = vi.fn<() => Promise<void>>(async () => undefined);
  readonly stop = vi.fn<() => void>();
  readonly subscribe = vi.fn<(_listener: () => void) => () => void>(() => () => undefined);
  readonly signIn = vi.fn<
    (_email: string, _password: string) => Promise<SignInResult>
  >(async () => ({ status: 'invalid_credentials' }));
  readonly signInForEmployeeEnrollment = vi.fn<
    (_email: string, _password: string) => Promise<SignInResult>
  >(async () => ({ status: 'invalid_credentials' }));
  readonly redeemEmployeeInvitation = vi.fn<
    (_invitationSecret: string) => Promise<EmployeeEnrollmentResult>
  >(async () => ({ status: 'context_unavailable' }));
  readonly retryContext = vi.fn<() => Promise<void>>(async () => undefined);
  readonly requestPasswordReset = vi.fn(async () => 'requested' as const);
  readonly handlePasswordRecoveryUrl = vi.fn(async () => true);
  readonly completePasswordRecovery = vi.fn(async () => true);
  readonly refresh = vi.fn<() => Promise<void>>(async () => undefined);
  readonly signOut = vi.fn<() => Promise<void>>(async () => undefined);

  getState(): MobileSessionState {
    return { status: 'signed_out' };
  }
}

class FakeScanRuntimeOwner implements ProductScanRuntimeOwner {
  readonly refreshOfflineGrant = vi.fn(async () => undefined);
  readonly start = vi.fn<() => Promise<void>>(async () => undefined);
  readonly stop = vi.fn<() => Promise<void>>(async () => undefined);
  readonly scan = vi.fn<() => Promise<void>>(async () => undefined);
  readonly cancel = vi.fn<() => Promise<void>>(async () => undefined);
  readonly retry = vi.fn<() => Promise<void>>(async () => undefined);
  readonly subscribe = vi.fn<(_listener: () => void) => () => void>(() => () => undefined);

  getState(): ProductScanState {
    return { status: 'inactive' };
  }
}

class FakeAdministrationRuntimeOwner {
  async prepareCustomer() { return { status: 'unavailable' as const }; }
  async createCustomer() {}

  readonly start = vi.fn<() => Promise<void>>(async () => undefined);
  readonly stop = vi.fn<() => Promise<void>>(async () => undefined);
  readonly refresh = vi.fn<() => Promise<void>>(async () => undefined);
  readonly loadMore = vi.fn<() => Promise<void>>(async () => undefined);
  readonly provision = vi.fn<(_customerId: string, _displayName: string) => Promise<void>>(async () => undefined);
  readonly provisionBreak = vi.fn<(_displayName: string) => Promise<void>>(async () => undefined);
  readonly cancel = vi.fn<() => Promise<void>>(async () => undefined);
  readonly subscribe = vi.fn<(_listener: () => void) => () => void>(() => () => undefined);
  getState(): AdminSetupState { return { status: 'inactive' }; }
}

function setup(work?: ProductMobileWorkRuntimeOwner) {
  const session = new FakeSessionRuntimeOwner();
  const scan = new FakeScanRuntimeOwner();
  const administration = new FakeAdministrationRuntimeOwner();
  const appState = {
    start: vi.fn<() => void>(),
    stop: vi.fn<() => void>(),
  };
  const serverTransport = Object.freeze({}) as ProductServerTransport;
  const runtime = new DefaultProductMobileRuntime(session, appState, serverTransport, scan, administration, undefined, work);
  return { session, scan, administration, appState, runtime };
}

describe('DefaultProductMobileRuntime lifecycle', () => {
  it('T-095 D-120 preserves waiting across a network suspension and resumes only for the same account',async()=>{
    const h=setup(),listeners=new Set<()=>void>();
    const authenticated:MobileSessionState={status:'authenticated',session:{userId:'A',organizationId:'org',membershipId:'A-member',role:'employee',nfcSetupAvailable:false}};
    let state:MobileSessionState=authenticated;
    vi.spyOn(h.session,'getState').mockImplementation(()=>state);
    h.session.subscribe.mockImplementation(listener=>{listeners.add(listener);return()=>listeners.delete(listener);});
    const scan=Object.assign(h.scan,{prepareSignOut:vi.fn(async()=>({wait:true as const,accountKey:'org/A-member/A'})),pollArchiveForSignOut:vi.fn(async()=>false)});
    await h.runtime.start();vi.useFakeTimers();
    try {
      await h.runtime.session.signOut();
      state={status:'context_unavailable'};for(const listener of listeners)listener();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(h.runtime.scan.getState().status).toBe('archive_signout_pending');
      expect(scan.pollArchiveForSignOut).toHaveBeenCalledOnce();expect(h.session.signOut).not.toHaveBeenCalled();
      state=authenticated;for(const listener of listeners)listener();scan.pollArchiveForSignOut.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(scan.pollArchiveForSignOut).toHaveBeenCalledTimes(2);expect(h.session.signOut).toHaveBeenCalledOnce();
    } finally {h.runtime.stop();vi.useRealTimers();}
  });
  it('T-095 D-120 can enter archive waiting while the confirmed owner is offline',async()=>{
    const h=setup();
    vi.spyOn(h.session,'getState').mockReturnValue({status:'context_unavailable'});
    const scan=Object.assign(h.scan,{prepareSignOut:vi.fn(async()=>({wait:true as const,accountKey:'org/A-member/A'})),pollArchiveForSignOut:vi.fn(async()=>false)});
    await h.runtime.start();vi.useFakeTimers();
    try {
      await h.runtime.session.signOut();await vi.advanceTimersByTimeAsync(30_000);
      expect(h.runtime.scan.getState().status).toBe('archive_signout_pending');
      expect(scan.pollArchiveForSignOut).not.toHaveBeenCalled();expect(h.session.signOut).not.toHaveBeenCalled();
      await h.runtime.session.signOutImmediately!();expect(h.session.signOut).toHaveBeenCalledOnce();
    } finally {h.runtime.stop();vi.useRealTimers();}
  });
  it('T-095 D-120 never signs out account B on a late archive proof for A',async()=>{
    const h=setup(),listeners=new Set<()=>void>();
    let state:MobileSessionState={status:'authenticated',session:{userId:'A',organizationId:'org',membershipId:'A-member',role:'employee',nfcSetupAvailable:false}};
    vi.spyOn(h.session,'getState').mockImplementation(()=>state);
    h.session.subscribe.mockImplementation(listener=>{listeners.add(listener);return()=>listeners.delete(listener);});
    let resolve!:(proof:boolean)=>void;
    const scan=Object.assign(h.scan,{prepareSignOut:vi.fn(async()=>({wait:true as const,accountKey:'org/A-member/A'})),pollArchiveForSignOut:vi.fn(()=>new Promise<boolean>(r=>{resolve=r;})),onExplicitLogout:vi.fn(async()=>{})});
    await h.runtime.start();vi.useFakeTimers();
    try {
      await h.runtime.session.signOut();
      state={status:'authenticated',session:{userId:'B',organizationId:'org',membershipId:'B-member',role:'employee',nfcSetupAvailable:false}};
      for(const listener of listeners)listener();resolve(true);await vi.advanceTimersByTimeAsync(90_000);
      expect(h.session.signOut).not.toHaveBeenCalled();expect(scan.onExplicitLogout).not.toHaveBeenCalled();
      expect(scan.pollArchiveForSignOut).toHaveBeenCalledOnce();expect(h.runtime.scan.getState().status).not.toBe('archive_signout_pending');
    } finally {h.runtime.stop();vi.useRealTimers();}
  });
  it('T-095 D-120 waits as the current account, polls every 30 seconds and signs out after archive proof',async()=>{
    const h=setup();
    const state:MobileSessionState={status:'authenticated',session:{userId:'A',organizationId:'org',membershipId:'A-member',role:'employee',nfcSetupAvailable:false}};
    vi.spyOn(h.session,'getState').mockReturnValue(state);
    const scan=Object.assign(h.scan,{prepareSignOut:vi.fn(async()=>({wait:true as const,accountKey:'org/A-member/A'})),pollArchiveForSignOut:vi.fn(async()=>false),onExplicitLogout:vi.fn(async()=>{})});
    await h.runtime.start();vi.useFakeTimers();
    try {
      await h.runtime.session.signOut();
      expect(h.session.signOut).not.toHaveBeenCalled();
      expect(h.runtime.scan.getState()).toMatchObject({status:'archive_signout_pending'});
      expect(scan.pollArchiveForSignOut).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30_000);expect(scan.pollArchiveForSignOut).toHaveBeenCalledTimes(2);
      scan.pollArchiveForSignOut.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(scan.onExplicitLogout).toHaveBeenCalledOnce();expect(h.session.signOut).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(60_000);expect(scan.pollArchiveForSignOut).toHaveBeenCalledTimes(3);
    } finally {h.runtime.stop();vi.useRealTimers();}
  });
  it('T-095 D-120 forced sign-out cancels a late proof and the polling timer',async()=>{
    const h=setup();
    vi.spyOn(h.session,'getState').mockReturnValue({status:'authenticated',session:{userId:'A',organizationId:'org',membershipId:'A-member',role:'employee',nfcSetupAvailable:false}});
    let resolve!:(value:boolean)=>void;
    const scan=Object.assign(h.scan,{prepareSignOut:vi.fn(async()=>({wait:true as const,accountKey:'org/A-member/A'})),pollArchiveForSignOut:vi.fn(()=>new Promise<boolean>(r=>{resolve=r;})),onExplicitLogout:vi.fn(async()=>{})});
    await h.runtime.start();vi.useFakeTimers();
    try {
      await h.runtime.session.signOut();expect(h.session.signOut).not.toHaveBeenCalled();
      expect(h.runtime.session.signOutImmediately).toBeTypeOf('function');
      await h.runtime.session.signOutImmediately!();
      resolve(true);await vi.advanceTimersByTimeAsync(90_000);
      expect(h.session.signOut).toHaveBeenCalledOnce();expect(scan.pollArchiveForSignOut).toHaveBeenCalledOnce();
    } finally {h.runtime.stop();vi.useRealTimers();}
  });
  it('T-095 D-120 stops waiting when the runtime stops and ignores the old proof',async()=>{
    const h=setup();
    vi.spyOn(h.session,'getState').mockReturnValue({status:'authenticated',session:{userId:'A',organizationId:'org',membershipId:'A-member',role:'employee',nfcSetupAvailable:false}});
    let resolve!:(value:boolean)=>void;
    const scan=Object.assign(h.scan,{prepareSignOut:vi.fn(async()=>({wait:true as const,accountKey:'org/A-member/A'})),pollArchiveForSignOut:vi.fn(()=>new Promise<boolean>(r=>{resolve=r;}))});
    await h.runtime.start();vi.useFakeTimers();
    try {
      await h.runtime.session.signOut();h.runtime.stop();resolve(true);await vi.advanceTimersByTimeAsync(90_000);
      expect(h.session.signOut).not.toHaveBeenCalled();expect(scan.pollArchiveForSignOut).toHaveBeenCalledOnce();
    } finally {vi.useRealTimers();}
  });
  it('T-095 reloads the offline grant after a customer or tag write through the production facade', async () => {
    const {runtime,scan}=setup();
    await runtime.administration.createCustomer('Kunde X');
    await runtime.administration.provision('customer','Tag');
    await runtime.administration.provisionBreak('Pause');
    expect(scan.refreshOfflineGrant).toHaveBeenCalledTimes(3);
  });
  it('T103 forwards stopping the confirmed active target through the production React facade', async () => {
    const target = {targetType:'customer' as const,targetId:'20000000-0000-4000-8000-000000000001',displayName:'Kunde X'};
    const snapshot = {generation:1,session:{userId:'user',organizationId:'organization',membershipId:'membership',role:'employee' as const,nfcSetupAvailable:false}};
    const ownTime = {activeRecord:{timeRecordId:'entry',source:'canonical' as const,targetType:target.targetType,
      targetId:target.targetId,targetDisplayName:target.displayName,status:'started' as const,startedAt:'2026-10-04T06:12:00.000Z',
      stoppedAt:null,startedVia:'manual' as const,stoppedVia:null,breakStartedAt:null},records:[],nextCursor:null,
      windowStartedAt:'2026-08-31T22:00:00.000Z',windowEndedAt:'2026-10-04T09:00:00.000Z'};
    const triggerManual = vi.fn(async()=>({status:'accepted' as const,outcome:'time_entry_stopped' as const}));
    const work = new MobileWorkCoordinator({capture:()=>snapshot,isCurrent:()=>true,subscribe:()=>()=>{}},
      {read:async()=>({status:'ready',ownTime,targets:{targets:[],nextCursor:null}}),readOwnTimePage:async()=>({status:'unavailable'}),triggerManual});
    const {runtime} = setup(work);
    await runtime.work.refresh();
    expect(runtime.work.stopActiveTime).toBeTypeOf('function');
    await runtime.work.stopActiveTime?.();
    expect(triggerManual).toHaveBeenCalledExactlyOnceWith('membership',target);
  });
  it('does not start session or app-state ownership after stop during scan recovery', async () => {
    const context = setup();
    const scanStart = deferred();
    context.scan.start.mockImplementationOnce(() => scanStart.promise);

    const starting = context.runtime.start();
    context.runtime.stop();
    scanStart.resolve();
    await starting;

    expect(context.scan.stop).toHaveBeenCalledTimes(1);
    expect(context.session.stop).toHaveBeenCalledTimes(1);
    expect(context.session.start).not.toHaveBeenCalled();
    expect(context.appState.start).not.toHaveBeenCalled();
  });

  it('does not start app-state ownership after stop during session restoration', async () => {
    const context = setup();
    const sessionStart = deferred();
    context.session.start.mockImplementationOnce(() => sessionStart.promise);

    const starting = context.runtime.start();
    await vi.waitFor(() => expect(context.session.start).toHaveBeenCalledTimes(1));
    context.runtime.stop();
    sessionStart.resolve();
    await starting;

    expect(context.appState.stop).toHaveBeenCalledTimes(1);
    expect(context.appState.start).not.toHaveBeenCalled();
  });

  it('does not start session or app-state ownership after stop during administration setup', async () => {
    const context = setup();
    const administrationStart = deferred();
    context.administration.start.mockImplementationOnce(() => administrationStart.promise);

    const starting = context.runtime.start();
    await vi.waitFor(() => expect(context.administration.start).toHaveBeenCalledTimes(1));
    context.runtime.stop();
    administrationStart.resolve();
    await starting;

    expect(context.administration.stop).toHaveBeenCalledTimes(1);
    expect(context.session.start).not.toHaveBeenCalled();
    expect(context.appState.start).not.toHaveBeenCalled();
  });

  it.each(['scan recovery', 'administration setup', 'session restoration'] as const)(
    'ignores a stale %s failure after stop and a successful restart',
    async (phase) => {
      const context = setup();
      const staleStart = deferred();
      if (phase === 'scan recovery') {
        context.scan.start.mockImplementationOnce(() => staleStart.promise);
      } else if (phase === 'administration setup') {
        context.administration.start.mockImplementationOnce(() => staleStart.promise);
      } else {
        context.session.start.mockImplementationOnce(() => staleStart.promise);
      }

      const firstStart = context.runtime.start();
      if (phase === 'administration setup') {
        await vi.waitFor(() => expect(context.administration.start).toHaveBeenCalledTimes(1));
      } else if (phase === 'session restoration') {
        await vi.waitFor(() => expect(context.session.start).toHaveBeenCalledTimes(1));
      }
      context.runtime.stop();
      await context.runtime.start();
      staleStart.reject(new Error('synthetic stale runtime failure'));

      await expect(firstStart).resolves.toBeUndefined();
      expect(context.appState.start).toHaveBeenCalledTimes(1);
    },
  );

  it('still reports a failure owned by the current runtime generation', async () => {
    const context = setup();
    context.scan.start.mockRejectedValueOnce(new Error('synthetic current runtime failure'));

    await expect(context.runtime.start()).rejects.toThrow('synthetic current runtime failure');
    expect(context.session.start).not.toHaveBeenCalled();
    expect(context.appState.start).not.toHaveBeenCalled();
  });
});

describe('account-scoped scan protection', () => {
  it('re-evaluates a protected scanner for a new account, without changing evidence through the UI', async () => {
    const context = setup();
    const listeners = new Set<() => void>();
    let sessionState: MobileSessionState = { status: 'signed_out' };
    let scanState: ProductScanState = { status: 'protected_pending', reason: 'local_evidence_protected' };
    vi.spyOn(context.session, 'getState').mockImplementation(() => sessionState);
    vi.spyOn(context.scan, 'getState').mockImplementation(() => scanState);
    context.session.subscribe.mockImplementation((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; });
    context.scan.start.mockImplementation(async () => {
      if (sessionState.status === 'authenticated') scanState = { status: 'ready', outcome: null };
    });
    await context.runtime.start();
    expect(context.runtime.scan.getState().status).toBe('protected_pending');
    sessionState = { status: 'authenticated', session: {
      userId: 'person-B', organizationId: 'business', membershipId: 'membership-B', nfcSetupAvailable: false, role: 'employee',
    } };
    for (const listener of listeners) listener();
    await vi.waitFor(() => expect(context.runtime.scan.getState()).toEqual({ status: 'ready', outcome: null }));
    expect(context.scan.stop).toHaveBeenCalledTimes(1);
    expect(context.scan.start).toHaveBeenCalledTimes(2);
    expect(context.scan.scan).not.toHaveBeenCalled();
    expect(context.scan.retry).not.toHaveBeenCalled();
    for (const listener of listeners) listener();
    expect(context.scan.start).toHaveBeenCalledTimes(2);
    context.runtime.stop();
  });
});
