import { normalizeCustomerNameV1 } from '@taptime/administration-contract/names';
import { isCanonicalUuid } from './index.js';
export type ManageCustomerRequest = {
  readonly expectedMembershipId: string; readonly commandId: string; readonly customerId: string;
} & ({readonly action:'rename'; readonly displayName:string} | {readonly action:'deactivate'});
export type ManageCustomerStatus = 'succeeded'|'running_time'|'customer_unavailable'|'command_id_conflict'|'unauthorized'|'forbidden'|'invalid_request'|'unavailable';
export type ManageCustomerResult = {readonly status:ManageCustomerStatus};
export function isManageCustomerRequest(v:unknown):v is ManageCustomerRequest {
  if(typeof v!=='object'||v===null||Array.isArray(v))return false;
  const r=v as Record<string,unknown>;
  return isCanonicalUuid(r.expectedMembershipId)&&isCanonicalUuid(r.commandId)&&isCanonicalUuid(r.customerId)
    && (r.action==='deactivate'&&Object.keys(r).length===4 || r.action==='rename'&&Object.keys(r).length===5&&typeof r.displayName==='string'&&normalizeCustomerNameV1(r.displayName).status==='valid');
}
export function isManageCustomerResult(v:unknown):v is ManageCustomerResult {
  return typeof v==='object'&&v!==null&&Object.keys(v).length===1&&'status' in v
    && ['succeeded','running_time','customer_unavailable','command_id_conflict','unauthorized','forbidden','invalid_request','unavailable'].includes(String(v.status));
}
export function customerManagementMessage(result:ManageCustomerResult):string {
  switch(result.status){
    case 'succeeded':return 'Gespeichert';
    case 'running_time':return 'Erst die laufende Zeit beenden';
    case 'customer_unavailable':return 'Dieser Kunde ist nicht mehr verfügbar.';
    case 'invalid_request':return 'Bitte einen gültigen Kundennamen eingeben.';
    case 'forbidden':case 'unauthorized':return 'Keine Berechtigung für diesen Kunden.';
    default:return 'Änderung konnte nicht bestätigt werden. Bitte erneut versuchen.';
  }
}

export type CustomerManagementChange = {readonly action:'rename';readonly displayName:string}|{readonly action:'deactivate'};
export interface InspectTagRequest {readonly expectedMembershipId:string;readonly canonicalPayload:string}
export type InspectTagResult = {readonly status:'succeeded';readonly assignment:'customer'|'break'|'unassigned';readonly customerName:string|null;readonly locationName:string|null}|{readonly status:'forbidden'|'unauthorized'|'invalid_request'|'unavailable'};
export function isInspectTagRequest(v:unknown):v is InspectTagRequest {
  if(typeof v!=='object'||v===null||Array.isArray(v))return false;
  const r=v as Record<string,unknown>;
  return Object.keys(r).length===2&&isCanonicalUuid(r.expectedMembershipId)&&typeof r.canonicalPayload==='string'&&/^nfc:uid:v1:(?:[0-9A-F]{2}){1,32}$/.test(r.canonicalPayload);
}
export function isInspectTagResult(v:unknown):v is InspectTagResult {
  if(typeof v!=='object'||v===null||Array.isArray(v))return false;
  const r=v as Record<string,unknown>;
  if(r.status!=='succeeded')return Object.keys(r).length===1&&['forbidden','unauthorized','invalid_request','unavailable'].includes(String(r.status));
  return Object.keys(r).length===4&&['customer','break','unassigned'].includes(String(r.assignment))
    && (r.assignment==='customer'?typeof r.customerName==='string'&&r.customerName.length>0&&r.customerName.length<=480:r.customerName===null)
    && (r.locationName===null||typeof r.locationName==='string'&&r.locationName.length>0&&r.locationName.length<=480);
}
