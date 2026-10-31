import {describe,it,expect,vi} from 'vitest';
import {harness,ready,owner,initial} from './lockScreenHarness';
import {EMPTY_OWN_TIME_DISPLAY,type OwnTimeDisplay} from '../../src/work/ProvisionalOwnTime';
const until='2099-10-29T20:00:00.000Z';
function display(paused=false):OwnTimeDisplay{return {...EMPTY_OWN_TIME_DISPLAY,owner,known:true,pending:true,validUntil:until,
 activeRecord:{timeRecordId:initial.timeEntryId,source:'canonical',targetType:initial.target.targetType,targetId:initial.target.targetId,targetDisplayName:initial.target.displayName,status:'started',startedAt:initial.startedAt,stoppedAt:null,breakStartedAt:paused?initial.asOf:null,startedVia:'manual',stoppedVia:null}};}
describe('T140 native preview',()=>{
 it.each([false,true])('publishes the same provisional state paused=%s without issuing booking authority',async paused=>{
  const h=harness();await ready(h);h.setOnline(false);h.setUnconfirmed(true);
  vi.mocked(h.native.issue).mockClear();h.setOwnTimeDisplay(display(paused));
  expect(h.native.preview).toHaveBeenLastCalledWith(owner,expect.objectContaining({timeEntryId:initial.timeEntryId,status:paused?'paused':'running',breakStartedAt:paused?initial.asOf:null,target:initial.target}),until);
  expect(h.native.awaitOwnCapture).toHaveBeenCalled();expect(h.native.issue).not.toHaveBeenCalled();
  // A saved offline capture is not an active NFC read. Further app captures stay possible.
  h.setScan({status:'saved_locally',queueCount:1});expect(await h.controller.beforeCapture()).toBe(true);
  await h.controller.afterCapture();h.controller.stop();
 });
 it('removes the preview after server confirmation, expiry, owner reset and stop',async()=>{
  const h=harness();await ready(h);h.setOnline(false);h.setOwnTimeDisplay(display());
  h.setOwnTimeDisplay({...display(),pending:false});expect(h.native.preview).toHaveBeenLastCalledWith(owner,null,null);
  h.setOwnTimeDisplay(display());h.setOwnTimeDisplay(EMPTY_OWN_TIME_DISPLAY);expect(h.native.preview).toHaveBeenLastCalledWith(owner,null,null);
  h.setOwnTimeDisplay(display());h.controller.stop();expect(h.native.preview).toHaveBeenLastCalledWith(owner,null,null);
 });
 it('a provisional stop removes the running notification and a native unknown command blocks preview',async()=>{
  const h=harness();await ready(h);h.setOnline(false);h.setOwnTimeDisplay({...display(),activeRecord:null});
  expect(h.native.preview).toHaveBeenLastCalledWith(owner,null,until);
  vi.mocked(h.native.preview!).mockClear();h.setStand({pending:{commandId:'50000000-0000-4000-8000-000000000001',action:'stop'}});
  h.setOwnTimeDisplay(display());expect(h.native.preview).not.toHaveBeenCalled();expect(await h.controller.beforeCapture()).toBe(false);h.controller.stop();
 });
 it('failed suspension does not leave app capture permanently busy',async()=>{
  const h=harness();await ready(h);h.setOnline(false);h.setOwnTimeDisplay(display());
  vi.mocked(h.native.suspend).mockReturnValueOnce(false);expect(await h.controller.beforeCapture()).toBe(false);
  expect(await h.controller.beforeCapture()).toBe(true);h.controller.stop();
 });
});

it.each([['paused',true],['paused',false],['stopped',true],['stopped',false]] as const)(
 'R1: known running baseline must reject a stale tap after native %s (online=%s)',async(status,online)=>{
 const h=harness({queued:true});
 try{
  await ready(h);h.setOnline(online);h.setOwnTimeDisplay({...display(),pending:false});
  const newer={...initial,status,breakStartedAt:status==='paused'?initial.asOf:null,stoppedAt:status==='stopped'?initial.asOf:null};
  h.setServer(newer);h.setStand({revision:'native-newer',state:newer,ownCapturePending:false});
  if(status==='paused')await h.work.triggerBreak();else await h.work.stopActiveTime();
  expect(h.queue.captureBreak).not.toHaveBeenCalled();expect(h.queue.captureManual).not.toHaveBeenCalled();
  expect(h.controller.getCaptureRejection()?.message).toBeTruthy();
 }finally{h.controller.stop();h.work.stop();}
});

it('R1: a later native revision invalidates an existing preview and cannot be blessed by republishing it',async()=>{
 const h=harness();try{
  await ready(h);h.setOnline(false);h.setUnconfirmed(true);h.setOwnTimeDisplay(display());
  h.setStand({revision:'new-native-result',state:{...initial,status:'paused',breakStartedAt:initial.asOf},ownCapturePending:false});
  h.setOwnTimeDisplay(display());h.setOwnTimeDisplay(display());
  expect(h.native.preview).toHaveBeenLastCalledWith(owner,null,null);
  expect(await h.controller.beforeCapture()).toBe(false);
 }finally{h.controller.stop();}
});
it('R1: a confirmed offline baseline may continue when its native state still matches exactly',async()=>{
 const h=harness();try{
  await ready(h);h.setOnline(false);h.setOwnTimeDisplay({...display(),pending:false});
  h.setStand({revision:'same-state-new-capability',ownCapturePending:false});
  expect(await h.controller.beforeCapture()).toBe(true);
 }finally{h.controller.stop();}
});
