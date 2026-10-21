import { expect, it, vi } from 'vitest';
import { LockScreenCoordinator, ownLockScreenState } from '../../src/lockScreen/LockScreenCoordinator';
import { issueCapability } from '../../src/lockScreen/issueCapability';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import { OfflineActiveCapture } from '../../src/work/OfflineActiveCapture';
import type { AuthenticatedRequestCapability, MobileSessionState } from '../../src/auth/contracts';
import type { LockScreenNativePort, LockScreenStand, IssueStatus } from '../../src/lockScreen/contracts';
import type { MobileWorkApiPort } from '../../src/work/contracts';
import type { LockScreenState } from '@taptime/mobile-work-contract';
import type { ProductScanState } from '../../src/scan/contracts';

import { harness, ready, initial } from './lockScreenHarness';

it('capability 401 is completed, renews once and never enters the rejecting executor path',async()=>{
  const values:IssueStatus[]=['unauthorized','unauthorized'];const callbacks:string[]=[];
  const auth:AuthenticatedRequestCapability & {refresh():Promise<void>}={executeAuthenticatedRequest:async attempt=>{const result=await attempt(()=> 'access');callbacks.push(result.status);return result;},refresh:vi.fn(async()=>{})};
  const issue=vi.fn(async()=>values.shift()!);
  expect(await issueCapability(auth,issue,()=>true)).toBe('unauthorized');
  expect(auth.refresh).toHaveBeenCalledOnce();expect(issue).toHaveBeenCalledTimes(2);expect(callbacks).toEqual(['completed','completed']);
});
it('does not issue for a different account after refresh',async()=>{
  let current=true;const issue=vi.fn(async()=> 'unauthorized' as const);
  const auth:AuthenticatedRequestCapability & {refresh():Promise<void>}={executeAuthenticatedRequest:async attempt=>attempt(()=> 'access'),refresh:async()=>{current=false;}};
  expect(await issueCapability(auth,issue,()=>current)).toBe('superseded');expect(issue).toHaveBeenCalledOnce();
});
it('keeps the card while reading and on a failed foreground read',async()=>{
  const h=harness();try {await ready(h);const before=h.work.getState();
    let release!:(value:{status:'unavailable'})=>void;
    h.api.read=vi.fn(()=>new Promise<{status:'unavailable'}>(resolve=>{release=resolve;}));
    const flight=h.work.refreshPreservingActive();await Promise.resolve();
    expect(h.work.getState()).toBe(before);release({status:'unavailable'});expect(await flight).toBe(false);expect(h.work.getState()).toBe(before);
  }finally{h.controller.stop();}
});
it('opening never replays a pending command; the next explicit action retries the same ID then only refreshes',async()=>{
  const h=harness();try {await ready(h);
    const pending={action:'pause' as const,commandId:'99000000-0000-4000-8000-000000000001'};
    h.setStand({revision:'pending',pending,display:'UNCONFIRMED'});
    await h.controller.refresh();expect(h.native.retry).not.toHaveBeenCalled();expect(h.getStand().pending).toEqual(pending);
    await h.work.triggerBreak();
    expect(h.native.retry).toHaveBeenCalledOnce();expect(h.api.triggerBreak).not.toHaveBeenCalled();
    expect(h.work.getState()).toMatchObject({ownTime:{activeRecord:{breakStartedAt:initial.asOf}}});
  }finally{h.controller.stop();}
});
it('offline a newer lock-screen result blocks both toggles, including the offline card',async()=>{
  const h=harness();try {await ready(h);h.setStand({revision:'paused',state:{...initial,status:'paused',breakStartedAt:initial.asOf}});h.setOnline(false);
    await h.work.triggerBreak();await h.work.stopActiveTime();expect(h.api.triggerBreak).not.toHaveBeenCalled();expect(h.api.triggerManual).not.toHaveBeenCalled();
    expect(h.work.getState()).toMatchObject({captureBlockedReason:expect.stringContaining('Sperrbildschirm')});
    const queue={prepareActiveCapture:h.controller.beforeCapture,activeCaptureRejection:h.controller.getCaptureRejection,finishActiveCapture:h.controller.afterCapture,captureManual:vi.fn(async()=>({status:'unavailable' as const})),captureBreak:vi.fn(async()=>({status:'unavailable' as const})),hasUnconfirmedCapture:async()=>false};
    const offline=new OfflineActiveCapture(queue);const state=h.work.getState();if(state.status!=='ready'||!state.ownTime.activeRecord)throw Error('missing card');
    offline.start();await offline.pause(state.ownTime.activeRecord);await offline.stop(state.ownTime.activeRecord);
    expect(queue.captureBreak).not.toHaveBeenCalled();expect(queue.captureManual).not.toHaveBeenCalled();expect(offline.getState()).toMatchObject({pending:true,feedback:expect.stringContaining('Sperrbildschirm')});offline.dispose();
  }finally{h.controller.stop();}
});
it('unconfirmed own captures show a fallback; sign-out removes the native session',async()=>{
  const h=harness();try {h.setUnconfirmed(true);h.controller.start();await h.controller.refresh();
    expect(h.native.awaitOwnCapture).toHaveBeenCalled();expect(h.native.issue).not.toHaveBeenCalled();
    h.signOut();expect(h.native.clear).toHaveBeenCalled();expect(h.getStand().owner).toBeUndefined();
  }finally{h.controller.stop();}
});
it('ignores a native result racing the read instead of marking it reconciled',async()=>{
  const h=harness();try {await ready(h);const read=h.api.read;
    h.api.read=vi.fn(async (membership:string,search?:string|null)=>{const result=await read(membership,search);h.setStand({revision:'newer'});return result;});
    h.native.issue=vi.fn(async()=> 'issued' as const);await h.controller.refresh();expect(h.native.issue).not.toHaveBeenCalled();
    h.setOnline(false);await h.work.triggerBreak();expect(h.api.triggerBreak).not.toHaveBeenCalled();
  }finally{h.controller.stop();}
});
it('notification denial remains visible with a settings action',async()=>{
  const h=harness();try {h.setStand({permissionGranted:false,permissionAsked:true});h.controller.start();await h.controller.refresh();
    expect(h.controller.getState().notificationsDenied).toBe(true);h.controller.openSettings();expect(h.native.openSettings).toHaveBeenCalledOnce();
  }finally{h.controller.stop();}
});
it('derives durations from the server calendar without re-counting pauses',async()=>{
  const h=harness();await h.work.refresh();const state=h.work.getState();if(state.status!=='ready')throw Error('missing');
  expect(ownLockScreenState(state.ownTime)).toEqual(initial);
});
it('checks the persisted stand after suspending native buttons, closing the tap race',async()=>{
  const h=harness();try {await ready(h);
    h.native.suspend=vi.fn(()=>{h.setStand({revision:'raced',pending:{action:'pause',commandId:'99000000-0000-4000-8000-000000000002'}});return true;});
    h.setOnline(false);await h.work.triggerBreak();expect(h.api.triggerBreak).not.toHaveBeenCalled();
  }finally{h.controller.stop();}
});

it.each([
  {status:'ready',outcome:{status:'cancelled'}},
  {status:'ready',outcome:{status:'unreadable'}},
  {status:'ready',outcome:{status:'tag_not_assigned'}},
  {status:'unavailable'},
] satisfies ProductScanState[])('restores native actions after a terminal scan outcome %j',async state=>{
  const h=harness();try {await ready(h);vi.mocked(h.native.issue).mockClear();
    h.setScan({status:'scanning'});h.setScan(state);
    await vi.waitFor(()=>expect(h.native.issue).toHaveBeenCalled());
  }finally{h.controller.stop();}
});
it('a foreground read finishing during scanning cannot re-enable native actions',async()=>{
  const h=harness();try {await ready(h);vi.mocked(h.native.issue).mockClear();
    const read=h.api.read;let release!:()=>void;
    h.api.read=vi.fn(async (membership:string,search?:string|null)=>{
      await new Promise<void>(resolve=>{release=resolve;});return read(membership,search);
    });
    const flight=h.controller.refresh();await vi.waitFor(()=>expect(release).toBeDefined());
    h.setScan({status:'scanning'});release();await flight;
    expect(h.native.issue).not.toHaveBeenCalled();
    h.api.read=read;h.setScan({status:'ready',outcome:{status:'cancelled'}});await h.controller.refresh();
    expect(h.native.issue).toHaveBeenCalled();
  }finally{h.controller.stop();}
});
it('an own scan completion during a foreground read still discards an older pending command',async()=>{
  const h=harness();try {await ready(h);
    h.setStand({revision:'pending',pending:{action:'pause',commandId:'99000000-0000-4000-8000-000000000003'}});
    const read=h.api.read;let release!:()=>void;
    vi.spyOn(h.api,'read').mockImplementationOnce(async (membership,search)=>{
      await new Promise<void>(resolve=>{release=resolve;});return read(membership,search);
    });
    const flight=h.controller.refresh();await vi.waitFor(()=>expect(release).toBeDefined());
    h.setScan({status:'server_decision',outcome:{status:'break_started'},queueCount:0});release();await flight;
    expect(h.getStand().pending).toBeUndefined();expect(h.native.retry).not.toHaveBeenCalled();
  }finally{h.controller.stop();}
});
