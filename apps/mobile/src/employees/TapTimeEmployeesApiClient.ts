import { isManagedActiveSummary, isManagedActiveSummaryRequest, isManagedPersonTimeRequest, type ManagedActiveSummaryRequest, type ManagedPersonTimeRequest } from '@taptime/administration-contract/managed-people';
import { isDetailedTimeResponse, validateOwnTimeResponse, type MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
import type { AuthenticatedJsonPostPort } from '../transport/AuthenticatedHttpRequestExecutor';
import { hasExactKeys, isJsonContentType, isObject, isUuid, parseJsonObject } from '../transport/strictJson';
import type { EmployeesApiPort, InvitationCommand, InvitationStatus, ReadResult } from './contracts';
const invitationFailures = new Set<InvitationStatus>(['rate_limited','invalid_request','invalid_email','command_id_conflict','email_exists',
  'membership_exists','former_membership','account_creation_not_configured','invitation_delivery_failed','invitation_rate_limited',
  'invitation_service_unavailable','invitation_needs_attention']);
const locationCursor = /^v1:l:[0-9a-f-]{36}$/;
export class TapTimeEmployeesApiClient implements EmployeesApiPort {
  private readonly base: URL;
  constructor(baseUrl: string, private readonly requests: AuthenticatedJsonPostPort) { this.base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`); }
  summary(request: ManagedActiveSummaryRequest) {
    if (!isManagedActiveSummaryRequest(request)) return Promise.resolve({status:'unavailable'} as const);
    return this.read('managed-active-summary',request,isManagedActiveSummary);
  }
  personTime(request: ManagedPersonTimeRequest) {
    if (!isManagedPersonTimeRequest(request)) return Promise.resolve({status:'unavailable'} as const);
    return this.read('managed-person-time',request,(value): value is MobileOwnTimeQueryResponse =>
      (isDetailedTimeResponse(value) || validateOwnTimeResponse(value)) && value.records.length <= request.limit
      && value.windowStartedAt === request.fromInclusive && value.windowEndedAt === request.toExclusive
      && (value.activeRecord === null || (value.activeRecord.status === 'started' && value.activeRecord.stoppedAt === null))
      && value.records.every(record => record.status === 'stopped' && record.stoppedAt !== null
        && Date.parse(record.stoppedAt) >= Date.parse(record.startedAt)
        && Date.parse(record.stoppedAt) > Date.parse(request.fromInclusive) && Date.parse(record.startedAt) < Date.parse(request.toExclusive))
      && new Set(value.records.map(record => record.timeRecordId)).size === value.records.length
      && (value.nextCursor === null || value.records.length > 0));
  }
  async locations(expectedMembershipId: string, cursor: string | null): ReturnType<EmployeesApiPort['locations']> {
    if (!isUuid(expectedMembershipId) || (cursor !== null && !locationCursor.test(cursor))) return {status:'unavailable'};
    const result = await this.read('locations/query',{expectedMembershipId,cursor,limit:100},isLocationPage);
    return result.status === 'ready' ? {status:'ready',value:{locations:result.value.locations.map(l=>({id:l.id,name:l.displayName})),nextCursor:result.value.nextCursor}} : result;
  }
  async invite(command: InvitationCommand): ReturnType<EmployeesApiPort['invite']> {
    if (!hasExactKeys(command as unknown as Record<string,unknown>,['expectedMembershipId','commandId','displayName','email','locationId'])
      || !isUuid(command.expectedMembershipId) || !isUuid(command.commandId) || (command.locationId !== null && !isUuid(command.locationId))
      || typeof command.displayName !== 'string' || !command.displayName.trim() || [...command.displayName.trim()].length > 80
      || typeof command.email !== 'string' || command.email.length > 254) return {status:'invalid_request'};
    const response = await this.requests.post(new URL('v1/administration/employee-account-invitations',this.base),JSON.stringify(command));
    if (response.status !== 'response') return response;
    if (response.statusCode === 401 || response.statusCode === 403) return {status:'authority_rejected'};
    if (!isJsonContentType(response.contentType)) return {status:'unavailable'};
    const body = parseJsonObject(response.body);
    if (response.statusCode === 200 && body !== null && hasExactKeys(body,['status','membershipId']) && isUuid(body.membershipId)
      && (body.status === 'succeeded' || body.status === 'succeeded_existing_account')) return {status:body.status};
    if (body !== null && hasExactKeys(body,['error']) && isObject(body.error) && hasExactKeys(body.error,['code'])
      && invitationFailures.has(body.error.code as InvitationStatus)) return {status:body.error.code as InvitationStatus};
    return {status:'unavailable'};
  }
  private async read<T>(path: string, request: unknown, validate: (v: unknown)=>v is T): Promise<ReadResult<T>> {
    const response = await this.requests.post(new URL(`v1/administration/${path}`,this.base),JSON.stringify(request),path==='managed-person-time'?{includeTimeDetails:true}:undefined);
    if (response.status !== 'response') return response;
    if (response.statusCode === 401 || response.statusCode === 403) return {status:'authority_rejected'};
    if (response.statusCode !== 200 || !isJsonContentType(response.contentType)) return {status:'unavailable'};
    const body = parseJsonObject(response.body);
    return validate(body) ? {status:'ready',value:body} : {status:'unavailable'};
  }
}
function isLocationPage(v: unknown): v is {status:'succeeded';locations:{id:string;displayName:string}[];nextCursor:string|null} {
  return isObject(v) && hasExactKeys(v,['status','locations','nextCursor']) && v.status === 'succeeded'
    && (v.nextCursor === null || (typeof v.nextCursor === 'string' && locationCursor.test(v.nextCursor)))
    && Array.isArray(v.locations) && v.locations.length <= 100 && v.locations.every(l=>isObject(l) && hasExactKeys(l,['id','displayName'])
      && isUuid(l.id) && typeof l.displayName === 'string' && l.displayName.trim().length > 0 && [...l.displayName].length <= 120)
    && new Set(v.locations.map(l=>l.id)).size === v.locations.length;
}
