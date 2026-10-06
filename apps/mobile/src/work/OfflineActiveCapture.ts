import type {MobileOwnTimeQueryResponse,SafeOwnTimeRecord} from '@taptime/mobile-work-contract';
import type {ManualOfflineCapturePort,ManualOfflineCaptureResult} from '../offline/OfflineCaptureCoordinator';
import {manualCaptureOutcome} from './manualCaptureFeedback';

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
    if(this.disposed || this.state.busy || this.state.pending || !record.targetId)return;
    this.publish({busy:true,pending:false,feedback:null});
    try {
      if(!this.manual.hasUnconfirmedCapture || await this.manual.hasUnconfirmedCapture()){
        this.publish({busy:false,pending:true,feedback:'Deine letzte Erfassung wartet noch auf Bestätigung.'});return;
      }
      if(this.disposed)return;
      const target={targetType:record.targetType,targetId:record.targetId};
      this.nextTarget=stop && record.breakStartedAt ? target : null;
      await this.save(stop && !record.breakStartedAt ? ()=>this.manual.captureManual(target) : ()=>this.manual.captureBreak?.()??Promise.resolve({status:'unavailable'}));
    } catch {this.nextTarget=null;this.publish({busy:false,pending:true,feedback:'Die Erfassung konnte nicht bestätigt werden. Prüfe den Abgleich.'});}
  }
  private async save(capture:()=>Promise<ManualOfflineCaptureResult>){
    if(this.disposed)return;
    this.publish({...this.state,busy:true});
    const result=await capture();if(this.disposed)return;
    if(result.status!=='saved'){
      this.nextTarget=null;
      this.publish({busy:false,pending:false,feedback:'Die Erfassung konnte nicht gespeichert werden. Prüfe den Abgleich.'});return;
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
        : ack.status==='review_pending' ? 'Die Verwaltung prüft deine Erfassung.' : 'Die Erfassung konnte nicht bestätigt werden. Prüfe den Abgleich.'});
    }).catch(()=>{this.nextTarget=null;this.publish({busy:false,pending:true,feedback:'Die Erfassung konnte nicht bestätigt werden. Prüfe den Abgleich.'});});
  };
}
