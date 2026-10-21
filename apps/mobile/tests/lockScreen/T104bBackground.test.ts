import { expect, it, vi } from 'vitest';
import { harness, ready, initial } from './lockScreenHarness';

// Mirrors LockScreenRuntime.kt for the flags that decide whether a lock-screen button sends or only opens the app.
function nativeFlags(h:ReturnType<typeof harness>){
  const flags={appBlocked:false,capability:true};
  const project=vi.mocked(h.native.project).getMockImplementation()!;
  vi.mocked(h.native.suspend).mockImplementation(()=>{flags.appBlocked=true;return true;});
  vi.mocked(h.native.project).mockImplementation((...args)=>{const ok=project(...args);if(ok){flags.capability=false;flags.appBlocked=true;}return ok;});
  vi.mocked(h.native.issue).mockImplementation(async()=>{flags.capability=true;flags.appBlocked=false;return 'issued';});
  return {canSend:()=>flags.capability&&!flags.appBlocked&&h.getStand().ownCapturePending!==true};
}
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(resolve=>setTimeout(resolve,0));};
const paused={...initial,status:'paused' as const,breakStartedAt:initial.asOf};

it('TL: a lock-screen action in the background keeps the next lock-screen buttons sending (no suspend, read or re-issue)',async()=>{
  const h=harness();try {await ready(h);const native=nativeFlags(h);
    h.setAppState('background');
    const reads=vi.mocked(h.api.read).mock.calls.length,suspends=vi.mocked(h.native.suspend).mock.calls.length,issues=vi.mocked(h.native.issue).mock.calls.length;
    h.setStand({revision:'sending',pending:{action:'pause',commandId:'99000000-0000-4000-8000-000000000001'},display:'SENDING'},true);
    h.setStand({revision:'lock-paused',pending:undefined,state:paused,display:'STATE'},true);
    await settle();
    expect(vi.mocked(h.native.suspend).mock.calls.length).toBe(suspends);
    expect(vi.mocked(h.api.read).mock.calls.length).toBe(reads);
    expect(vi.mocked(h.native.issue).mock.calls.length).toBe(issues);
    expect(native.canSend(),'Weiter and Beenden must still act from the lock screen').toBe(true);
    h.setAppState('active');await settle();
    expect(vi.mocked(h.api.read).mock.calls.length,'opening the app reconciles as before').toBeGreaterThan(reads);
  }finally{h.controller.stop();}
});

it('TL: a connectivity change in the background does not disable lock-screen buttons',async()=>{
  const h=harness();try {await ready(h);const native=nativeFlags(h);
    h.setAppState('background');vi.mocked(h.api.read).mockResolvedValue({status:'unavailable'});
    h.setOnline(false);h.setOnline(true);await settle();
    expect(native.canSend()).toBe(true);
  }finally{h.controller.stop();}
});

it('TL: an own capture awaiting its result is still reconciled in the background',async()=>{
  const h=harness({queued:true});try {await ready(h);
    await h.work.stopActiveTime();h.setAppState('background');
    expect(h.getStand()).toMatchObject({display:'TRANSFERRING',ownCapturePending:true});
    h.setServer({status:'stopped',stoppedAt:initial.asOf});h.setUnconfirmed(false);
    await h.controller.refresh();await settle();
    expect(h.getStand()).toMatchObject({ownCapturePending:false,state:{status:'stopped'}});
  }finally{h.controller.stop();}
});
