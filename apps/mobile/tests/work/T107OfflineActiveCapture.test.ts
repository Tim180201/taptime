import {expect,it,vi} from 'vitest';
import {OfflineActiveCapture} from '../../src/work/OfflineActiveCapture';
import type {ManualOfflineAcknowledgement} from '../../src/offline/OfflineCaptureCoordinator';
const record={timeRecordId:'entry',source:'canonical' as const,targetType:'customer' as const,targetId:'customer',targetDisplayName:'Kunde X',status:'started' as const,startedAt:'2026-10-06T08:00:00Z',stoppedAt:null,startedVia:'manual' as const,stoppedVia:null,breakStartedAt:'2026-10-06T08:30:00Z'};
function setup(){
 let notify=()=>{};let ack:ManualOfflineAcknowledgement={status:'pending'};
 const manual={captureBreak:vi.fn(async()=>({status:'saved' as const,workEventId:'break'})),captureManual:vi.fn(async()=>({status:'saved' as const,workEventId:'stop'})),hasUnconfirmedCapture:vi.fn(async()=>false),readManualAcknowledgement:()=>ack,subscribeManualAcknowledgements:(listener:()=>void)=>{notify=listener;return()=>{notify=()=>{};};}};
 const capture=new OfflineActiveCapture(manual);capture.start();
 return {manual,capture,acknowledge:(value:ManualOfflineAcknowledgement)=>{ack=value;notify();}};
}
it.each(['break_stopped','duplicate_scan_ignored','escalation_required'] as const)('continues an offline stop only after %s',async outcome=>{
 const {manual,capture,acknowledge}=setup();
 await capture.stop(record);expect(manual.captureBreak).toHaveBeenCalledOnce();expect(manual.captureManual).not.toHaveBeenCalled();
 await capture.stop(record);expect(manual.captureBreak).toHaveBeenCalledOnce();
 acknowledge({status:'server_decision',outcome});
 if(outcome==='break_stopped')await vi.waitFor(()=>expect(manual.captureManual).toHaveBeenCalledExactlyOnceWith({targetType:'customer',targetId:'customer'}));
 else {await vi.waitFor(()=>expect(capture.getState().feedback).toBe(outcome==='duplicate_scan_ignored'?'Doppelte Erfassung; deine Arbeitszeit bleibt unverändert':'Wird von der Verwaltung geprüft. Deine Arbeitszeit bleibt unverändert.'));expect(manual.captureManual).not.toHaveBeenCalled();}
 capture.dispose();
});
it('never continues the old account after disposal',async()=>{
 const {capture,manual,acknowledge}=setup();await capture.stop(record);capture.dispose();acknowledge({status:'server_decision',outcome:'break_stopped'});
 await Promise.resolve();expect(manual.captureManual).not.toHaveBeenCalled();
});
it('blocks actions against an unconfirmed earlier event',async()=>{
 const {capture,manual}=setup();manual.hasUnconfirmedCapture.mockResolvedValue(true);await capture.stop(record);expect(manual.captureBreak).not.toHaveBeenCalled();capture.dispose();
});

it.each([
 ['time_entry_started','Arbeitszeit gestartet'],
 ['active_entry_for_other_target_rejected','Eine andere Arbeitszeit ist aktiv.'],
 ['work_trigger_during_break_rejected','Deine Arbeitszeit bleibt unverändert. Beende zuerst die Pause über „Pause beenden“.'],
] as const)('shows the actual server result %s after a stale offline snapshot',async(outcome,message)=>{
 const {capture,acknowledge}=setup();await capture.stop({...record,breakStartedAt:null});
 acknowledge({status:'server_decision',outcome});await vi.waitFor(()=>expect(capture.getState().feedback).toBe(message));capture.dispose();
});
