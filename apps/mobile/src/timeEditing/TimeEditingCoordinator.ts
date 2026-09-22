import { isAdministrationStopRequest, isAdministrationStopResult, type AdministrationStopResult, isBackfillTimeRequest, isCommentTimeRequest, isTimeSupplementResult, type TimeSupplementResult } from '@taptime/mobile-work-contract';
import { validateTimeRecordCorrectionRequest } from '@taptime/time-review-contract';
import type { AuthenticatedJsonPostPort } from '../transport/AuthenticatedHttpRequestExecutor';
import type { MobileWorkSessionReader } from '../work/contracts';
export type TimeEditKind = 'backfill'|'comment'|'correct'|'stop';
export type TimeEditResult = TimeSupplementResult | AdministrationStopResult | {readonly status:'offline'|'busy'|'conflict'|'not_adjustable'};
export interface TimeEditingState { readonly online: boolean; readonly busy: boolean }
export interface TimeEditingCapability {
  getState(): TimeEditingState;
  subscribe(listener:()=>void):()=>void;
  save(kind:TimeEditKind,input:Record<string,unknown>):Promise<TimeEditResult>;
}
export class TimeEditingCoordinator implements TimeEditingCapability {
  private state:TimeEditingState={online:false,busy:false};
  private listeners=new Set<()=>void>();
  private unsubscribe:(()=>void)|undefined;
  private generation=0;
  private readonly pendingStops=new Map<string,string>();
  private last:{key:string;commandId:string}|undefined;
  constructor(private readonly base:URL,private readonly requests:AuthenticatedJsonPostPort,
    private readonly session:MobileWorkSessionReader,private readonly createUuid:()=>string,
    private readonly network:{get():Promise<boolean>;subscribe(listener:(online:boolean)=>void):()=>void}) {}
  getState=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  async start() {
    const generation=++this.generation;
    this.unsubscribe?.();
    this.unsubscribe=this.network.subscribe(online=>this.publish({...this.state,online}));
    try { const online=await this.network.get(); if(generation===this.generation) this.publish({...this.state,online}); }
    catch { if(generation===this.generation) this.publish({...this.state,online:false}); }
  }
  stop() { ++this.generation; this.unsubscribe?.();this.unsubscribe=undefined;this.last=undefined;this.pendingStops.clear();this.publish({online:false,busy:false}); }
  async save(kind:TimeEditKind,input:Record<string,unknown>):Promise<TimeEditResult> {
    const snapshot=this.session.capture();
    if(!snapshot || !this.session.isCurrent(snapshot)) return {status:'authority_rejected'};
    if(kind==='stop' && snapshot.session.role!=='administrator') return {status:'authority_rejected'};
    if(this.state.busy) return {status:'busy'};
    const generation=this.generation;
    this.publish({...this.state,busy:true});
    try {
      const online=await this.network.get();
      if(generation!==this.generation || !this.session.isCurrent(snapshot)) return {status:'authority_rejected'};
      this.publish({online,busy:true});
      if(!online) return {status:'offline'};
      const key=JSON.stringify([snapshot.generation,snapshot.session.membershipId,kind,input]);
      let commandId:string;
      if(kind==='stop') {
        commandId=this.pendingStops.get(key)??this.createUuid();this.pendingStops.set(key,commandId);
      } else {
        if(this.last?.key!==key) this.last={key,commandId:this.createUuid()};
        commandId=this.last.commandId;
      }
      const request={...input,expectedMembershipId:snapshot.session.membershipId,commandId};
      if(!(kind==='backfill'?isBackfillTimeRequest(request):kind==='comment'?isCommentTimeRequest(request):kind==='stop'?isAdministrationStopRequest(request):validateTimeRecordCorrectionRequest(request).status==='valid')) return {status:'invalid_request'};
      const path=kind==='correct'?'/v1/administration/time-records/correct':`/v1/time-records/${kind}`;
      const result=await this.requests.post(new URL(path,this.base),JSON.stringify(request));
      if(generation!==this.generation || !this.session.isCurrent(snapshot)) return {status:'authority_rejected'};
      if(result.status==='authority_rejected') return result;
      if(result.status!=='response' || !result.contentType?.startsWith('application/json')) return {status:'unavailable'};
      const value:unknown=JSON.parse(result.body);
      if(kind==='stop' && isAdministrationStopResult(value)) {
        if(value.status==='committed' && value.offsiteArchived) this.pendingStops.delete(key);
        return value;
      }
      if(kind!=='correct' && kind!=='stop' && isTimeSupplementResult(value)) {
        if(value.status==='committed') this.last=undefined;
        return value;
      }
      if(kind==='correct' && typeof value==='object' && value!==null) {
        const v=value as Record<string,unknown>;
        if(result.statusCode===200 && v.status==='committed' && v.timeRecordId===input.timeRecordId
          && Number.isSafeInteger(v.revisionNumber) && v.startedAt===input.startedAt && v.stoppedAt===input.stoppedAt
          && typeof v.idempotentRetry==='boolean' && Object.keys(v).length===6) {
          this.last=undefined;
          return {status:'committed',timeRecordId:v.timeRecordId as string,idempotentRetry:v.idempotentRetry};
        }
        const code=(v.error as {code?:string}|undefined)?.code;
        if(code==='conflict' || code==='not_adjustable' || code==='command_id_conflict') return {status:code};
      }
      return {status:result.statusCode===403?'authority_rejected':'unavailable'};
    } catch { return {status:'unavailable'}; }
    finally { if(generation===this.generation) this.publish({...this.state,busy:false}); }
  }
  private publish(value:TimeEditingState) {this.state=Object.freeze(value);this.listeners.forEach(l=>l());}
}
