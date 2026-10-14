import type {DependencyList} from 'react';
import type {AssignedTargetResponse,SafeWorkTarget} from '@taptime/mobile-work-contract';
import type {ClientSearchCapability} from './search';
import {useSearchPages} from './useSearchPages';
export const targetKey=(t:SafeWorkTarget)=>`${t.targetType}:${t.targetId}`;
export const isAssignedTarget=(t:SafeWorkTarget)=>('assignedToMe' in t&&t.assignedToMe===true)||('assignedToPerson' in t&&t.assignedToPerson===true);
export const targetLabel=(t:SafeWorkTarget,search:string|null)=>`${t.displayName}${search&&isAssignedTarget(t)?' · zugeordnet':''}`;
export function useAssignedTargets(capability:ClientSearchCapability,person:string|null,search:string|null,dependencies:DependencyList,enabled=true) {
  return useSearchPages<AssignedTargetResponse,AssignedTargetResponse['targets'][number]>((_search,cursor)=>person
    ?capability.querySearch?.('backfill_targets',{targetMembershipId:person,search:null,cursor,assignedOnly:true})??Promise.resolve({status:'unavailable'})
    :capability.querySearch?.('work_targets',{search:null,cursor,assignedOnly:true})??Promise.resolve({status:'unavailable'}),
    p=>p.targets,targetKey,[capability,person,search!==null,enabled,...dependencies],enabled&&search===null&&!!capability.querySearch);
}
export function combineTargets<T extends SafeWorkTarget>(all:readonly T[],assigned:readonly T[]) {
  const seen=new Set<string>();return [...assigned,...all].filter(t=>{const key=targetKey(t);if(seen.has(key))return false;seen.add(key);return true;});
}
