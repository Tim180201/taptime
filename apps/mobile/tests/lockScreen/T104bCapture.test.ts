import { expect, it, vi } from 'vitest';
import { harness, ready, initial } from './lockScreenHarness';
import { OfflineActiveCapture } from '../../src/work/OfflineActiveCapture';

it('real coordinator: applied lock-screen Pause with no pending command refreshes the stale card and explains the rejected tap',async()=>{
  const h=harness();try {await ready(h);
    h.setServer({status:'paused',breakStartedAt:initial.asOf});
    h.setStand({revision:'applied-pause',state:{...initial,status:'paused',breakStartedAt:initial.asOf}});
    await h.work.triggerBreak();
    expect(h.api.triggerBreak).not.toHaveBeenCalled();
    expect(h.work.getState()).toMatchObject({ownTime:{activeRecord:{breakStartedAt:initial.asOf}},feedback:'Der Stand hat sich geändert. Prüfe ihn und tippe erneut.'});
  }finally{h.controller.stop();}
});
it('real coordinator: a pending lock-screen command that cannot be delivered explains the blocked tap even while online',async()=>{
  const h=harness();try {await ready(h);
    h.setStand({revision:'pending',pending:{action:'pause',commandId:'99000000-0000-4000-8000-000000000009'}});
    h.native.retry=vi.fn(async()=>{});await h.work.triggerBreak();
    expect(h.api.triggerBreak).not.toHaveBeenCalled();
    expect(h.work.getState()).toMatchObject({feedback:expect.stringContaining('Sperrbildschirm')});
  }finally{h.controller.stop();}
});
it('RED P1-1: a finished time is projected once and stays empty on two subsequent openings',async()=>{
  const h=harness();try {await ready(h);
    h.setServer({status:'stopped',stoppedAt:initial.asOf});await h.controller.refresh();
    expect(vi.mocked(h.native.project).mock.calls.filter(call=>call[1]?.status==='stopped')).toHaveLength(1);
    for(let opening=0;opening<2;opening++){h.setAppState('background');h.setAppState('active');await h.controller.refresh();}
    expect(vi.mocked(h.native.project).mock.calls.filter(call=>call[1]?.status==='stopped')).toHaveLength(1);
    expect(h.getStand().state).toBeUndefined();
  }finally{h.controller.stop();}
});
it.each([true,false])('RED P1-2: an own queued stop shows transfer immediately and reads the confirmed result in the background (online=%s)',async online=>{
  const h=harness({queued:true});try {await ready(h);h.setOnline(online);
    await h.work.stopActiveTime();h.setAppState('background');
    expect(h.getStand()).toMatchObject({display:'TRANSFERRING',ownCapturePending:true});
    h.setServer({status:'stopped',stoppedAt:initial.asOf});h.setUnconfirmed(false);h.setOnline(true);
    await h.controller.refresh();
    expect(vi.mocked(h.native.project).mock.calls.some(call=>call[1]?.status==='stopped')).toBe(true);
    expect(h.getStand().ownCapturePending).not.toBe(true);
  }finally{h.controller.stop();h.work.stop();}
});
it('RED P1-2: a native card capture in the background shows transfer and never requests permission there',async()=>{
  const h=harness();try {await ready(h);vi.mocked(h.native.ensurePermission).mockClear();h.setAppState('background');
    h.setUnconfirmed(true);h.setScan({status:'synchronizing',queueCount:1});
    expect(h.getStand()).toMatchObject({display:'TRANSFERRING',ownCapturePending:true});
    h.setServer({status:'paused',breakStartedAt:initial.asOf});h.setUnconfirmed(false);
    h.setScan({status:'server_decision',outcome:{status:'break_started'},queueCount:0});await h.controller.refresh();
    expect(h.getStand()).toMatchObject({state:{status:'paused'},ownCapturePending:false});
    expect(h.native.ensurePermission).not.toHaveBeenCalled();
  }finally{h.controller.stop();}
});
it('RED P1-2: offline active card stop also marks its own capture as transferring',async()=>{
  const h=harness();try {await ready(h);h.setOnline(false);
    const active=new OfflineActiveCapture({...h.queue,prepareActiveCapture:h.controller.beforeCapture,finishActiveCapture:h.controller.afterCapture});
    const state=h.work.getState();if(state.status!=='ready'||!state.ownTime.activeRecord)throw Error('missing active');
    active.start();await active.stop(state.ownTime.activeRecord);active.dispose();
    expect(h.getStand()).toMatchObject({display:'TRANSFERRING',ownCapturePending:true});
  }finally{h.controller.stop();}
});
it('P2-b: a failed preserving read does not leave a parallel normal refresh in loading',async()=>{
  const h=harness();let release!:(value:Awaited<ReturnType<typeof h.api.read>>)=>void;
  const original=h.api.read;
  vi.mocked(h.api.read).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;})).mockResolvedValueOnce({status:'unavailable'});
  const normal=h.work.refresh();await vi.waitFor(()=>expect(release).toBeDefined());
  expect(await h.work.refreshPreservingActive()).toBe(false);
  release(await original('test-membership'));await normal;
  expect(h.work.getState().status).toBe('ready');
});

it('P2-c: an own pending capture supersedes a prior retry and shows the transfer notice',async()=>{
  const h=harness();try {await ready(h);
    h.setStand({pending:{action:'pause',commandId:'99000000-0000-4000-8000-000000000010'},display:'NOT_SENT'});
    h.setUnconfirmed(true);h.setScan({status:'saved_locally',queueCount:1});
    expect(h.getStand()).toMatchObject({ownCapturePending:true,display:'TRANSFERRING'});
    expect(h.getStand().pending).toBeUndefined();expect(h.native.retry).not.toHaveBeenCalled();
  }finally{h.controller.stop();}
});
it('P2-d: offline card scan contention does not blame the lock-screen stand',async()=>{
  const h=harness();try {await ready(h);h.setScan({status:'scanning'});
    const active=new OfflineActiveCapture({...h.queue,prepareActiveCapture:h.controller.beforeCapture,
      activeCaptureRejection:h.controller.getCaptureRejection,finishActiveCapture:h.controller.afterCapture});
    const state=h.work.getState();if(state.status!=='ready'||!state.ownTime.activeRecord)throw Error('missing active');
    active.start();await active.stop(state.ownTime.activeRecord);
    expect(active.getState()).toMatchObject({pending:false,feedback:'Der Scan läuft. Beende ihn oder brich ihn ab.'});
    expect(h.queue.captureManual).not.toHaveBeenCalled();active.dispose();
  }finally{h.controller.stop();}
});
