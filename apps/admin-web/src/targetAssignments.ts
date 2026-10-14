import type {TargetAssignmentChangeRequest,TargetAssignmentChangeResult,TargetAssignmentQueryResponse} from '@taptime/mobile-work-contract';
import type {PageResult} from '../../mobile/src/search/search';
export type AssignmentSelector={membershipId:string}|{targetType:'customer'|'project';targetId:string};
export type AssignmentPair=Omit<TargetAssignmentChangeRequest,'expectedMembershipId'|'commandId'>;
export type AssignmentQuery=AssignmentSelector&{search:string|null;cursor:string|null};
export interface AssignmentCapability {
  readTargetAssignments?(request:AssignmentQuery):Promise<PageResult<TargetAssignmentQueryResponse>>;
  changeTargetAssignment?(pair:AssignmentPair):Promise<TargetAssignmentChangeResult>;
}
export function assignmentMessage(status:TargetAssignmentChangeResult['status'],name:string,assigned:boolean,targetType:'customer'|'project') {
  if(status==='succeeded')return `${name}: ${assigned?'Zugeordnet.':'Entfernt.'}`;
  if(status==='target_not_selectable')return `${name} kann ${targetType==='project'?'dieses Projekt':'diesen Kunden'} nicht wählen (anderer Standort).`;
  if(status==='forbidden'||status==='unauthorized')return 'Dafür fehlt Ihnen die Berechtigung.';
  if(status==='command_id_conflict')return `${name}: Diese Änderung konnte nicht bestätigt werden. Bitte laden Sie die Liste neu.`;
  if(status==='invalid_request')return `${name}: Diese Zuordnung ist nicht möglich. Bitte laden Sie die Liste neu.`;
  return `${name}: Noch keine Bestätigung. Erneut versuchen.`;
}
