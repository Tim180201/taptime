import {isCanonicalUuid} from './index.js';
import {isInspectTagResult,type InspectTagResult} from './customerManagement.js';
export interface RemoveNfcTagRequest {
  readonly expectedMembershipId:string;
  readonly commandId:string;
  readonly nfcTagId:string;
  readonly expectedAssignmentId:string;
}
export type RemoveNfcTagResult = {readonly status:'succeeded';readonly removedAt:string}
  | {readonly status:'assignment_changed'|'command_id_conflict'|'forbidden'|'unauthorized'|'invalid_request'|'unavailable'};
export function isRemoveNfcTagRequest(value:unknown):value is RemoveNfcTagRequest {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const r=value as Record<string,unknown>;
  return Object.keys(r).length===4&&isCanonicalUuid(r.expectedMembershipId)&&isCanonicalUuid(r.commandId)
    &&isCanonicalUuid(r.nfcTagId)&&isCanonicalUuid(r.expectedAssignmentId);
}
export function isRemoveNfcTagResult(value:unknown):value is RemoveNfcTagResult {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const r=value as Record<string,unknown>;
  if(r.status==='succeeded')return Object.keys(r).length===2&&typeof r.removedAt==='string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(r.removedAt)&&Number.isFinite(Date.parse(r.removedAt));
  return Object.keys(r).length===1&&['assignment_changed','command_id_conflict','forbidden','unauthorized','invalid_request','unavailable'].includes(String(r.status));
}
export function nfcTagRemovalMessage(result:RemoveNfcTagResult):string {
  switch(result.status){
    case 'succeeded':return 'Karte entfernt. Sie kann neu eingerichtet werden.';
    case 'assignment_changed':return 'Die Karte wurde inzwischen geändert. Bitte die Liste aktualisieren.';
    case 'command_id_conflict':return 'Dieser Vorgang wurde bereits mit anderen Angaben verwendet. Bitte die Liste aktualisieren.';
    case 'forbidden':case 'unauthorized':return 'Keine Berechtigung für diese Karte.';
    case 'invalid_request':return 'Die Angaben zur Karte sind ungültig. Bitte die Liste aktualisieren.';
    case 'unavailable':return 'Entfernen konnte nicht bestätigt werden. Bitte erneut versuchen.';
  }
}
export const NFC_TAG_REMOVAL_EXPLANATION='Bisherige Zeiten bleiben unverändert. Läuft gerade eine Zeit über diese Karte, läuft sie weiter und wird in der App beendet.';
export type InspectTagResultV2 = (Extract<InspectTagResult,{status:'succeeded'}>&{readonly nfcTagId:string|null;readonly activeAssignmentId:string|null})|Exclude<InspectTagResult,{status:'succeeded'}>;
export function isInspectTagResultV2(value:unknown):value is InspectTagResultV2 {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const r=value as Record<string,unknown>;
  if(r.status!=='succeeded')return isInspectTagResult(value);
  if(Object.keys(r).length!==6)return false;
  const {nfcTagId,activeAssignmentId,...v1}=r;
  return isInspectTagResult(v1)&&(r.assignment==='unassigned'
    ?nfcTagId===null&&activeAssignmentId===null&&r.locationName===null
    :isCanonicalUuid(nfcTagId)&&isCanonicalUuid(activeAssignmentId));
}
