import {describe,it,expect} from 'vitest';
import {BusinessEngine,TimeEntryId,BreakIntervalId,WorkEventId,OrganizationId,UserId,createTimestamp,type WorkEvent} from '@taptime/core';
import {projectOwnTime,type ConfirmedOwnTime,type OwnTimeEvidence} from '../../src/work/ProvisionalOwnTime';
const owner={organizationId:'10000000-0000-4000-8000-000000000001',userId:'20000000-0000-4000-8000-000000000001',membershipId:'30000000-0000-4000-8000-000000000001'};
const target={targetType:'customer' as const,targetId:'40000000-0000-4000-8000-000000000001',displayName:'Werkstatt'};
const idle:ConfirmedOwnTime={activeTimeId:null,target:null,startedAt:null,breakStartedAt:null,confirmedAt:'2026-07-18T10:00:00.000Z'};
function event(index:number,seconds:number,subject:'work'|'break'='work',other=false):OwnTimeEvidence{
  return {sequence:index,displayName:other?'Anderer Kunde':target.displayName,event:{
    id:WorkEventId(`50000000-0000-4000-8000-${String(index).padStart(12,'0')}`),
    organizationId:OrganizationId(owner.organizationId),triggeredBy:UserId(owner.userId),
    occurredAt:createTimestamp(new Date(Date.parse(idle.confirmedAt)+seconds*1000).toISOString()),
    trigger:{type:'manual'},subject:{type:subject},
    ...(subject==='work'?{target:{targetType:target.targetType,targetId:other?owner.organizationId:target.targetId}}:{}),
  } as WorkEvent};
}
describe('T140 BusinessEngine replay',()=>{
 it.each([
   {name:'start',events:[event(1,10)],statuses:['time_entry_started'],active:true},
   {name:'pause without work',events:[event(1,10,'break')],statuses:['break_without_active_time_entry_rejected'],active:false},
   {name:'different target',events:[event(1,10),event(2,20,'work',true)],statuses:['time_entry_started','active_entry_for_other_target_rejected'],active:true},
   {name:'work during break',events:[event(1,10),event(2,20,'break'),event(3,30)],statuses:['time_entry_started','break_started','work_trigger_during_break_rejected'],active:true},
   {name:'sliding duplicate window including ignored triggers',events:[event(1,10),event(2,13),event(3,16),event(4,21)],statuses:['time_entry_started','duplicate_scan_ignored','duplicate_scan_ignored','time_entry_stopped'],active:false},
   {name:'out of order time',events:[event(1,20),event(2,10)],statuses:['time_entry_started','escalation_required'],active:true},
   {name:'full lifecycle',events:[event(1,10),event(2,20,'break'),event(3,30,'break'),event(4,40)],statuses:['time_entry_started','break_started','break_stopped','time_entry_stopped'],active:false},
 ])('$name uses the same canonical engine decisions',({events,statuses,active})=>{
   const result=projectOwnTime(idle,owner,[...events].reverse());
   expect([...result.decisions.values()]).toEqual(statuses);
   expect(result.activeRecord!==null).toBe(active);
   expect(result.pending).toBe(true);
   expect(idle.activeTimeId).toBeNull();
 });
 it.each([false,true])('restores confirmed active state (paused=%s) as engine context',paused=>{
   const base={...idle,activeTimeId:'60000000-0000-4000-8000-000000000001',target,startedAt:idle.confirmedAt,breakStartedAt:paused?'2026-07-18T10:01:00.000Z':null};
   const evidence=event(1,120,paused?'break':'work');
   const result=projectOwnTime(base,owner,[evidence]);
   const time={id:TimeEntryId(base.activeTimeId),workEventId:WorkEventId(base.activeTimeId),organizationId:OrganizationId(owner.organizationId),userId:UserId(owner.userId),target:{targetType:target.targetType,targetId:target.targetId} as any,status:'started' as const,startedAt:createTimestamp(base.startedAt)};
   const canonical=new BusinessEngine().evaluate(evidence.event,{activeTimeEntryForUser:time,activeBreakIntervalForUser:paused?{id:BreakIntervalId(time.id),organizationId:time.organizationId,userId:time.userId,timeEntryId:time.id,status:'started',startedAt:createTimestamp(base.breakStartedAt!),startedByWorkEventId:WorkEventId(time.id),startedVia:'manual'}:null,previousAcceptedWorkEventForUserAndTarget:null});
   expect(result.decisions.get(evidence.event.id)).toBe(canonical.status);
   expect(canonical.status).toBe(paused?'break_stopped':'time_entry_stopped');
 });
 it('rejects foreign evidence before exposing any state',()=>{
   const evidence=event(1,10);
   expect(()=>projectOwnTime(idle,{...owner,userId:owner.organizationId},[evidence])).toThrow('Foreign');
 });
});
