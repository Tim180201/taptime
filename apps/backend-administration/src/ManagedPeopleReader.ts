import type { PoolClient, QueryResultRow } from 'pg';
import { isManagedActiveSummary, isManagedPersonTimeRequest, isManagedActiveSummaryRequest,
  isManagedTimestamp, isManagedUuid, type ManagedActiveSummary, type ManagedActiveSummaryRequest,
  type ManagedPersonTimeRequest } from '@taptime/administration-contract/managed-people';
import { isDetailedTimeResponse, validateOwnTimeResponse, type MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';

export type ManagedPersonTimeCommand = ManagedPersonTimeRequest & { readonly accessToken: string; readonly includeTimeDetails?: boolean };
export type ManagedActiveSummaryCommand = ManagedActiveSummaryRequest & { readonly accessToken: string };
export type ManagedReadResult<T> = { readonly status: 'succeeded'; readonly value: T }
  | { readonly status: 'forbidden' | 'unauthorized' | 'invalid_request' };
export type ManagedPersonTimeResult = ManagedReadResult<MobileOwnTimeQueryResponse>;
export type ManagedActiveSummaryResult = ManagedReadResult<ManagedActiveSummary>;

// Cursors bind the request, but never authorize it. SQL re-evaluates the live scope on every page.
function timePrefix(request: ManagedPersonTimeRequest): string {
  return ['p1',request.expectedMembershipId,request.targetMembershipId,request.fromInclusive,request.toExclusive].join('/');
}
export function personCursor(request: ManagedPersonTimeRequest): { startedAt: string; id: string } | null | undefined {
  if (request.cursor === null) return null;
  const parts = request.cursor.split('/');
  if (parts.length !== 7 || parts.slice(0,5).join('/') !== timePrefix(request)
    || !isManagedTimestamp(parts[5]) || !isManagedUuid(parts[6])) return undefined;
  return { startedAt: parts[5], id: parts[6] };
}
function summaryPrefix(request: ManagedActiveSummaryRequest): string {
  return ['s1',request.expectedMembershipId,request.locationId ?? '-',String(request.isRunning)].join('/');
}
export function summaryCursor(request: ManagedActiveSummaryRequest): string | null | undefined {
  if (request.cursor === null) return null;
  const parts = request.cursor.split('/');
  return parts.length === 5 && parts.slice(0,4).join('/') === summaryPrefix(request) && isManagedUuid(parts[4]) ? parts[4] : undefined;
}
export function validPersonCommand(command: ManagedPersonTimeCommand): boolean {
  const {accessToken,includeTimeDetails,...request}=command;
  return typeof accessToken === 'string' && accessToken.length > 0 && isManagedPersonTimeRequest(request) && personCursor(request) !== undefined;
}
export function validSummaryCommand(command: ManagedActiveSummaryCommand): boolean {
  const {accessToken,...request}=command;
  return typeof accessToken === 'string' && accessToken.length > 0 && isManagedActiveSummaryRequest(request) && summaryCursor(request) !== undefined;
}
const timestamp = (value: unknown): string => {
  if (!(value instanceof Date) && typeof value !== 'string') throw new Error('Invalid managed timestamp');
  return new Date(value).toISOString();
};
function record(row: QueryResultRow, includeTimeDetails = false) {
  return { timeRecordId:row.time_record_id,source:row.source,targetType:row.target_type,targetDisplayName:row.target_display_name,
    status:row.status,startedAt:timestamp(row.started_at),stoppedAt:row.stopped_at===null?null:timestamp(row.stopped_at),
    startedVia:row.started_via,stoppedVia:!includeTimeDetails && row.stopped_via==='administration'?'manual':row.stopped_via };
}
export async function readManagedPerson(client: PoolClient, command: ManagedPersonTimeCommand): Promise<ManagedPersonTimeResult> {
  const cursor=personCursor(command);
  // Both STABLE readers share this statement's snapshot even under READ COMMITTED.
  // Never attach a newer correction version to older times.
  const result=await client.query(command.includeTimeDetails ? `
    WITH page AS MATERIALIZED (
      SELECT * FROM taptime_server.read_managed_person_time_v1($1,$2,$3,$4,$5,$6) WITH ORDINALITY
    ), details AS MATERIALIZED (
      SELECT * FROM taptime_server.read_time_record_details_v1(
        ARRAY(SELECT time_record_id FROM page WHERE time_record_id IS NOT NULL))
    )
    SELECT page.*,details.details FROM page LEFT JOIN details USING(time_record_id) ORDER BY page.ordinality`
    : `SELECT * FROM taptime_server.read_managed_person_time_v1($1,$2,$3,$4,$5,$6)`,
    [command.targetMembershipId,command.fromInclusive,command.toExclusive,cursor?.startedAt??null,cursor?.id??null,command.limit+1]);
  const first=result.rows[0];
  if (first?.row_kind === 'forbidden' || first?.row_kind === 'invalid_request') return {status:first.row_kind};
  if (first?.row_kind !== 'window') throw new Error('Managed time omitted window');
  const history=result.rows.filter(r=>r.row_kind==='history');
  const active=result.rows.filter(r=>r.row_kind==='active');
  if (active.length>1 || result.rows.length !== history.length+active.length+1) throw new Error('Invalid managed time rows');
  const page=history.slice(0,command.limit),last=page.at(-1);
  const detailed=(row:QueryResultRow)=> {
    const base=record(row,command.includeTimeDetails);
    if (!command.includeTimeDetails) return base;
    const details=row.details;
    if (!details) throw new Error('Missing managed time details');
    return {...base,details};
  };
  const value={activeRecord:active[0]?detailed(active[0]):null,records:page.map(detailed),
    windowStartedAt:timestamp(first.window_started_at),windowEndedAt:timestamp(first.window_ended_at),
    nextCursor:history.length>command.limit && last ? `${timePrefix(command)}/${timestamp(last.started_at)}/${last.time_record_id}`:null};
  if (!(command.includeTimeDetails ? isDetailedTimeResponse(value) : validateOwnTimeResponse(value))) throw new Error('Invalid managed time response');
  return {status:'succeeded',value};
}
export async function readManagedSummary(client: PoolClient, command: ManagedActiveSummaryCommand): Promise<ManagedActiveSummaryResult> {
  const result=await client.query(`SELECT * FROM taptime_server.read_managed_active_summary_v1($1,$2,$3,$4)`,
    [command.locationId,command.isRunning,summaryCursor(command),command.limit]);
  const first=result.rows[0];
  if (first?.result_status === 'forbidden' || first?.result_status === 'invalid_request') return {status:first.result_status};
  if (first?.result_status !== 'succeeded') throw new Error('Managed summary omitted status');
  const rows=result.rows.filter(r=>r.membership_id!==null), page=rows.slice(0,command.limit),last=page.at(-1);
  const value={serverTime:timestamp(first.server_time),runningCount:Number(first.running_count),totalCount:Number(first.total_count),
    people:page.map(r=>({membershipId:r.membership_id,displayName:r.membership_display_name,role:r.membership_role,
      location:r.location_id===null?null:{id:r.location_id,name:r.location_name},isRunning:r.is_running,
      runningSince:r.running_since===null?null:timestamp(r.running_since),runningTargetDisplayName:r.running_target_display_name})),
    nextCursor:rows.length>command.limit && last ? `${summaryPrefix(command)}/${last.membership_id}`:null};
  if (!isManagedActiveSummary(value)) throw new Error('Invalid managed summary response');
  return {status:'succeeded',value};
}
