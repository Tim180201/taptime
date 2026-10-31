import {
  BusinessEngine, BreakIntervalId, OrganizationId, TimeEntryId, UserId, WorkEventId,
  createTimestamp, type StartedTimeEntry, type StartedBreakInterval, type WorkEvent,
  type BusinessEngineDecision,
} from '@taptime/core';
import type { SafeOwnTimeRecord } from '@taptime/mobile-work-contract';

/** D-159: these are the only cached values. Identity is provided by offline_owner. */
export interface ConfirmedOwnTime {
  readonly activeTimeId: string | null;
  readonly target: { readonly targetType: 'customer'|'project'|'general_work'; readonly targetId: string; readonly displayName: string } | null;
  readonly startedAt: string | null;
  readonly breakStartedAt: string | null;
  readonly confirmedAt: string;
}
export interface OwnTimeOwner { readonly organizationId:string; readonly userId:string; readonly membershipId:string }
export interface OwnTimeEvidence { readonly sequence:number; readonly event:WorkEvent; readonly displayName:string }
export interface OwnTimeDisplay {
  readonly validUntil?:string;
  readonly owner: string | null;
  readonly activeRecord: SafeOwnTimeRecord | null;
  readonly records: readonly SafeOwnTimeRecord[];
  readonly pending: boolean;
  readonly known: boolean;
  readonly notice: string | null;
  readonly decisions: ReadonlyMap<string, BusinessEngineDecision['status']>;
}
export const EMPTY_OWN_TIME_DISPLAY: OwnTimeDisplay = Object.freeze({owner:null,activeRecord:null,records:[],pending:false,known:false,notice:null,decisions:new Map()});
export const ownTimeOwnerKey = (owner:OwnTimeOwner) => `${owner.organizationId}/${owner.membershipId}/${owner.userId}`;

/** Pure, read-only replay. IDs belong only to this display, never to a submitted command. */
export function projectOwnTime(base:ConfirmedOwnTime, owner:OwnTimeOwner, evidence:readonly OwnTimeEvidence[]):OwnTimeDisplay {
  let active:StartedTimeEntry|null=base.activeTimeId&&base.target&&base.startedAt ? {
    id:TimeEntryId(base.activeTimeId),workEventId:WorkEventId(base.activeTimeId),
    organizationId:OrganizationId(owner.organizationId),userId:UserId(owner.userId),
    target:{targetType:base.target.targetType,targetId:base.target.targetId} as StartedTimeEntry['target'],
    status:'started',startedAt:createTimestamp(base.startedAt),
  }:null;
  let pause:StartedBreakInterval|null=active&&base.breakStartedAt ? {
    id:BreakIntervalId(active.id),organizationId:active.organizationId,userId:active.userId,timeEntryId:active.id,
    status:'started',startedAt:createTimestamp(base.breakStartedAt),startedByWorkEventId:WorkEventId(active.id),startedVia:'manual',
  }:null;
  let displayName=base.target?.displayName??'';
  const previous=new Map<string,WorkEvent>(), records:SafeOwnTimeRecord[]=[], decisions=new Map<string,BusinessEngineDecision['status']>();
  const record=(entry:StartedTimeEntry|Extract<BusinessEngineDecision,{status:'time_entry_stopped'}>['timeEntry']):SafeOwnTimeRecord=>({
    timeRecordId:entry.id,source:'canonical',targetType:entry.target.targetType,targetId:entry.target.targetId,
    targetDisplayName:displayName,status:entry.status,startedAt:entry.startedAt,
    stoppedAt:entry.status==='stopped'?entry.stoppedAt:null,startedVia:entry.startedVia==='administration'?null:entry.startedVia??null,
    stoppedVia:entry.status==='stopped'?entry.stoppedVia??null:null,breakStartedAt:pause?.startedAt??null,
  });
  for(const item of [...evidence].sort((a,b)=>a.sequence-b.sequence)) {
    const event=item.event;
    if(event.organizationId!==owner.organizationId||event.triggeredBy!==owner.userId)throw Error('Foreign own-time evidence');
    const key=event.subject?.type==='break'?'break':`work:${event.target!.targetType}:${event.target!.targetId}`;
    const decision=new BusinessEngine(()=>TimeEntryId(event.id),()=>BreakIntervalId(event.id)).evaluate(event,{
      activeTimeEntryForUser:active,activeBreakIntervalForUser:pause,previousAcceptedWorkEventForUserAndTarget:previous.get(key)??null,
    });
    decisions.set(event.id,decision.status);
    const prior=previous.get(key);
    if(!prior||event.occurredAt>=prior.occurredAt)previous.set(key,event);
    switch(decision.status) {
      case 'time_entry_started': active=decision.timeEntry;displayName=item.displayName;break;
      case 'time_entry_stopped': records.push(record(decision.timeEntry));active=null;pause=null;break;
      case 'break_started': pause=decision.breakInterval;break;
      case 'break_stopped': pause=null;break;
      case 'duplicate_scan_ignored':
      case 'active_entry_for_other_target_rejected':
      case 'break_without_active_time_entry_rejected':
      case 'work_trigger_during_break_rejected':
      case 'escalation_required': break;
      default: decision satisfies never;
    }
  }
  return {owner:ownTimeOwnerKey(owner),activeRecord:active?record(active):null,records,pending:evidence.length>0,known:true,notice:null,decisions};
}
