import {expect,it,vi} from 'vitest';
import {harness,ready} from './lockScreenHarness';

it.each(['background','sign-out'] as const)('T143: a superseded read never restores authority after %s',async interruption=>{
  const h=harness();Object.defineProperty(h.native,'foregroundOnly',{value:true});
  let release:()=>void=()=>{};
  try{
    await ready(h);vi.mocked(h.native.issue).mockClear();
    const read=vi.mocked(h.api.read).getMockImplementation()!;
    const started=vi.fn();
    vi.mocked(h.api.read).mockImplementationOnce(async(...args)=>{
      const value=await read(...args);await new Promise<void>(resolve=>{release=resolve;started();});return value;
    });
    const flight=h.controller.refresh();await vi.waitFor(()=>expect(started).toHaveBeenCalled());
    await h.work.refresh(); // Same active time, so no state-change refresh is queued.
    if(interruption==='background')h.setAppState('background');else h.signOut();
    const reads=vi.mocked(h.api.read).mock.calls.length;
    release();await flight;
    expect(h.api.read).toHaveBeenCalledTimes(reads);expect(h.native.issue).not.toHaveBeenCalled();
    if(interruption==='background'){
      h.setAppState('active');await h.controller.refresh();expect(h.native.issue).toHaveBeenCalled();
    }
  }finally{release();h.controller.stop();}
});

it('T143: a failed read stops rather than starting a retry loop',async()=>{
  const h=harness();try{
    await ready(h);vi.mocked(h.api.read).mockClear().mockResolvedValue({status:'unavailable'});
    vi.mocked(h.native.issue).mockClear();await h.controller.refresh();
    expect(h.api.read).toHaveBeenCalledOnce();expect(h.native.issue).not.toHaveBeenCalled();
  }finally{h.controller.stop();}
});

it('T143: a superseded pre-capture read rejects the stale tap instead of treating it as success',async()=>{
  const h=harness({queued:true});let release:()=>void=()=>{};
  try{
    await ready(h);h.setStand({revision:'native-newer'});
    const read=vi.mocked(h.api.read).getMockImplementation()!,started=vi.fn();
    vi.mocked(h.api.read).mockImplementationOnce(async(...args)=>{
      const value=await read(...args);await new Promise<void>(resolve=>{release=resolve;started();});return value;
    });
    const tap=h.work.triggerBreak();await vi.waitFor(()=>expect(started).toHaveBeenCalled());
    await h.work.refresh();release();await tap;
    // D-043/T140 R1: refreshing authority cannot reinterpret the user's old pause label.
    expect(h.queue.captureBreak).not.toHaveBeenCalled();expect(h.queue.captureManual).not.toHaveBeenCalled();
    expect(h.controller.getCaptureRejection()).toMatchObject({blocked:true});
  }finally{release();h.controller.stop();h.work.stop();}
});
