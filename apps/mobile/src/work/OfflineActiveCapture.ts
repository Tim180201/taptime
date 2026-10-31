import type {MobileOwnTimeQueryResponse,SafeOwnTimeRecord} from '@taptime/mobile-work-contract';
import type {ManualOfflineCapturePort,ManualOfflineCaptureResult} from '../offline/OfflineCaptureCoordinator';
import {manualCaptureOutcome} from './manualCaptureFeedback';

const sameRecord=(a:SafeOwnTimeRecord|null|undefined,b:SafeOwnTimeRecord)=>!!a&&a.timeRecordId===b.timeRecordId&&a.startedAt===b.startedAt&&a.targetId===b.targetId&&(a.breakStartedAt??null)===(b.breakStartedAt??null);

type Target={targetType:'customer'|'project'|'general_work';targetId:string};
type State={busy:boolean;pending:boolean;feedback:string|null};
/** Owned by the account shell, across offline/online transitions; disposed on account change.
 * Retains only an in-memory continuation, like MobileWorkCoordinator. Evidence lives in the queue.
 */
export class OfflineActiveCapture {
  private state:State={busy:false,pending:false,feedback:null};
  private listeners=new Set<()=>void>();
  private unsubscribe?:()=>void;
  private disposed=false;
  private pendingId:string|null=null;
  private nextTarget:Target|null=null;
  private snapshot:MobileOwnTimeQueryResponse|null=null;
  private acknowledgementWork=Promise.resolve();
  constructor(private readonly manual:ManualOfflineCapturePort){}
  getState=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  start(){this.disposed=false;this.unsubscribe=this.manual.subscribeManualAcknowledgements?.(this.check);}
  dispose(){this.disposed=true;this.nextTarget=null;this.unsubscribe?.();}
  updateSnapshot(value:MobileOwnTimeQueryResponse){
    if(value!==this.snapshot && !this.pendingId && !this.state.busy)this.publish({...this.state,pending:false});
    this.snapshot=value;
  }
  private publish(state:State){if(this.disposed)return;this.state=state;this.listeners.forEach(listener=>listener());}
  stop=(record:SafeOwnTimeRecord)=>this.trigger(record,true);
  pause=(record:SafeOwnTimeRecord)=>this.trigger(record,false);
  private async trigger(record:SafeOwnTimeRecord,stop:boolean){
    const provisional=this.manual.getOwnTimeDisplay?.();
    const canContinue=provisional?.known===true&&sameRecord(provisional.activeRecord,record);
    if(this.disposed || this.state.busy || this.state.pending&&!canContinue || !record.targetId)return;
    this.publish({busy:true,pending:false,feedback:null});
    let allowed = false;
    try {
      if(this.manual.prepareActiveCapture && !await this.manual.prepareActiveCapture()) {
        const rejection=this.manual.activeCaptureRejection?.();
        this.publish({busy:false,pending:rejection?.blocked??false,feedback:rejection?.message??'Die Erfassung ist gerade nicht möglich. Bitte erneut versuchen.'});return;
      }
      allowed = true;
      if(!canContinue&&(!this.manual.hasUnconfirmedCapture || await this.manual.hasUnconfirmedCapture())){
        this.publish({busy:false,pending:true,feedback:'Deine letzte Erfassung wartet noch auf Bestätigung.'});return;
      }
      if(this.disposed)return;
      if(canContinue&&(!sameRecord(this.manual.getOwnTimeDisplay?.().activeRecord,record)||this.manual.getOwnTimeDisplay?.().owner!==provisional?.owner)){
        this.publish({busy:false,pending:false,feedback:'Der Stand hat sich geändert. Bitte prüfe die angezeigte Zeit.'});return;
      }
      const target={targetType:record.targetType,targetId:record.targetId};
      this.nextTarget=stop && record.breakStartedAt ? target : null;
      await this.save(stop && !record.breakStartedAt ? ()=>this.manual.captureManual(target) : ()=>this.manual.captureBreak?.()??Promise.resolve({status:'unavailable'}));
      if(canContinue&&this.nextTarget&&this.pendingId){
        const after=this.manual.getOwnTimeDisplay?.();
        if(after?.known&&after.owner===provisional?.owner&&after.decisions.get(this.pendingId)==='break_stopped'){
          this.nextTarget=null;await this.save(()=>this.manual.captureManual(target));
        }
      }
    } catch {this.nextTarget=null;this.publish({busy:false,pending:true,feedback:'Die Erfassung konnte nicht bestätigt werden. Prüfe „Übertragung“.'});}
    finally {if(allowed)await this.manual.finishActiveCapture?.();}
  }
  private async save(capture:()=>Promise<ManualOfflineCaptureResult>){
    if(this.disposed)return;
    this.publish({...this.state,busy:true});
    const result=await capture();if(this.disposed)return;
    if(result.status!=='saved'){
      this.nextTarget=null;
      this.publish({busy:false,pending:false,feedback:'Die Erfassung konnte nicht gespeichert werden. Prüfe „Übertragung“.'});return;
    }
    this.pendingId=result.workEventId;
    this.publish({busy:false,pending:true,feedback:this.nextTarget
      ? 'Pausenende gespeichert. Nach seiner Bestätigung wird die Zeit beendet.'
      : 'Deine Erfassung ist gespeichert, wird übertragen.'});
    this.check();
  }
  private check=()=>{
    this.acknowledgementWork=this.acknowledgementWork.then(async()=>{
      if(this.disposed || !this.pendingId)return;
      const ack=this.manual.readManualAcknowledgement?.(this.pendingId);
      if(!ack || ack.status==='pending')return;
      this.pendingId=null;
      const target=this.nextTarget;this.nextTarget=null;
      if(ack.status==='server_decision' && ack.outcome==='break_stopped' && target){
        await this.save(()=>this.manual.captureManual(target));return;
      }
      this.publish({busy:false,pending:true,feedback:ack.status==='server_decision'
        ? manualCaptureOutcome(ack.outcome)
        : ack.status==='review_pending' ? 'Wird von der Verwaltung geprüft' : 'Die Erfassung konnte nicht bestätigt werden. Prüfe „Übertragung“.'});
    }).catch(()=>{this.nextTarget=null;this.publish({busy:false,pending:true,feedback:'Die Erfassung konnte nicht bestätigt werden. Prüfe „Übertragung“.'});});
  };
}
