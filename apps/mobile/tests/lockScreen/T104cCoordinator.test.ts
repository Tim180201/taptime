import { expect, it, vi } from 'vitest';
import { harness, ready, initial } from './lockScreenHarness';
import { isLockScreenCaptureLink } from '../../src/lockScreen/captureLink';
const ios=()=>{const h=harness({queued:true});Object.defineProperty(h.native,'foregroundOnly',{value:true});return h;};
it('iOS keeps an own capture transferring until foreground, including network and native changes',async()=>{
  const h=ios();try {await ready(h);await h.work.stopActiveTime();h.setAppState('background');
    h.setServer({status:'stopped',stoppedAt:initial.asOf});h.setUnconfirmed(false);
    const reads=vi.mocked(h.api.read).mock.calls.length,issues=vi.mocked(h.native.issue).mock.calls.length;
    h.setOnline(false);h.setOnline(true);h.setStand({},true);await h.controller.refresh();
    expect(h.getStand()).toMatchObject({display:'TRANSFERRING',ownCapturePending:true});
    expect(h.api.read).toHaveBeenCalledTimes(reads);expect(h.native.issue).toHaveBeenCalledTimes(issues);
    h.setAppState('inactive');await h.controller.refresh();expect(h.native.issue).toHaveBeenCalledTimes(issues);
    h.setAppState('active');await h.controller.refresh();
    expect(h.getStand()).toMatchObject({ownCapturePending:false});
    // The native Swift engine retains the ten-second notice; this JS harness only records projections.
    expect(h.native.project).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({status:'stopped'}),expect.any(String),true);
  }finally{h.controller.stop();}
});
it('iOS invalidates a read chain interrupted by locking before it can issue or renew authentication',async()=>{
  const h=ios();try {await ready(h);
    const original=vi.mocked(h.api.read).getMockImplementation()!;
    vi.mocked(h.api.read).mockImplementationOnce(async(...args)=>{const result=await original(...args);h.setAppState('background');return result;});
    const issues=vi.mocked(h.native.issue).mock.calls.length;
    await h.controller.refresh();expect(h.native.issue).toHaveBeenCalledTimes(issues);expect(h.auth.refresh).not.toHaveBeenCalled();
    expect(await h.controller.beforeCapture()).toBe(false);
  }finally{h.controller.stop();}
});
it('iOS opening never automatically retries a pending native command',async()=>{
  const h=ios();try {await ready(h);h.setAppState('background');
    h.setStand({revision:'native-pending',pending:{commandId:'99000000-0000-4000-8000-000000000001',action:'stop'},display:'UNCONFIRMED'},true);
    h.setAppState('active');await h.controller.refresh();expect(h.native.retry).not.toHaveBeenCalled();
  }finally{h.controller.stop();}
});
it.each(['before-read','during-read'])('Android completes reconciliation after locking %s and restores native actions',async stage=>{
  const h=harness();try {await ready(h);
    const original=vi.mocked(h.api.read).getMockImplementation()!;
    if(stage==='during-read')vi.mocked(h.api.read).mockImplementationOnce(async(...args)=>{const result=await original(...args);h.setAppState('background');return result;});
    else vi.mocked(h.native.suspend).mockImplementationOnce(()=>{h.setAppState('background');return true;});
    vi.mocked(h.native.issue).mockClear();vi.mocked(h.native.project).mockClear();
    await h.controller.refresh();
    expect(h.native.project).toHaveBeenCalled();expect(h.native.issue).toHaveBeenCalled();
  }finally{h.controller.stop();}
});
it('iOS binds again on becoming active after its initial inactive bind was rejected',async()=>{
  const h=ios();try {
    h.setAppState('inactive');h.setStand({owner:undefined,revision:undefined,state:undefined});
    vi.mocked(h.native.bind).mockReturnValueOnce(false).mockImplementation(owner=>{
      h.setStand({owner,revision:'foreground-binding'});return true;
    });
    h.controller.start();await h.controller.refresh();expect(h.native.issue).not.toHaveBeenCalled();
    h.setAppState('active');await h.controller.refresh();
    expect(h.native.issue).toHaveBeenCalled();expect(h.getStand().owner).toBeDefined();
  }finally{h.controller.stop();}
});
it.each(['taptime','taptime-validation','taptime-production-validation'])('opens Erfassen only for the installed iOS scheme %s',scheme=>{
  expect(isLockScreenCaptureLink(`${scheme}://lock-screen/capture`,'ios',scheme)).toBe(true);
  expect(isLockScreenCaptureLink('foreign://lock-screen/capture','ios',scheme)).toBe(false);
  expect(isLockScreenCaptureLink(`${scheme}://different`,'ios',scheme)).toBe(false);
  expect(isLockScreenCaptureLink('taptime://lock-screen/capture','android',scheme)).toBe(true);
});
