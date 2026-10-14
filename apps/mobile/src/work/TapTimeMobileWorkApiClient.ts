import { parseQuotaAlertsResponse, parseSearchResponse } from '../search/search';
import { readSearch } from '../search/readSearch';
import type { SearchKind, SearchRequests } from '@taptime/mobile-work-contract';
import { isCustomerHoursResponse, type CustomerHoursRequest, type CustomerHoursResult } from '@taptime/mobile-work-contract';
import {
  validateOwnTimeResponse,
  isCaptureTimeResponse,
  validateWorkTargetResponse,
  type SafeWorkTarget,
} from '@taptime/mobile-work-contract';
import type { AuthenticatedJsonPostPort } from '../transport/AuthenticatedHttpRequestExecutor';
import type {
  ManualTriggerResult,
  MobileOwnTimePageResult,
  MobileWorkApiPort,
  MobileWorkReadResult,
} from './contracts';

export class TapTimeMobileWorkApiClient implements MobileWorkApiPort {
  constructor(
    private readonly baseUrl: URL,
    private readonly requests: AuthenticatedJsonPostPort,
    private readonly createUuid: () => string,
  ) {}

  querySearch<K extends SearchKind>(kind:K,request:SearchRequests[K]) { return readSearch(this.requests,this.baseUrl,kind,request); }

  async readQuotaAlerts(request:import('@taptime/mobile-work-contract').QuotaAlertsQueryRequest):Promise<import('../search/search').PageResult<import('@taptime/mobile-work-contract').QuotaAlertsQueryResponse>> {
    const result=await this.requests.post(new URL('/v2/customers/quota-alerts/query',this.baseUrl),JSON.stringify(request));
    if(result.status==='authority_rejected'||result.status==='response'&&(result.statusCode===401||result.statusCode===403))return {status:'authority_rejected'};
    if(result.status!=='response'||result.statusCode!==200||!isJson(result.contentType))return {status:'unavailable'};
    try {const value=parseQuotaAlertsResponse(JSON.parse(result.body));return value?{status:'ready',value}:{status:'unavailable'};}catch{return {status:'unavailable'};}
  }

  private pendingQuota: {key:string;commandId:string}|null=null;
  async setCustomerQuota(expectedMembershipId:string,customerId:string,minutes:number|null):Promise<import('@taptime/mobile-work-contract').SetCustomerQuotaResult> {
    const key=JSON.stringify([expectedMembershipId,customerId,minutes]);
    if(this.pendingQuota?.key!==key) this.pendingQuota={key,commandId:this.createUuid()};
    const pending=this.pendingQuota;
    const result=await this.requests.post(new URL('/v1/administration/customers/quota',this.baseUrl),JSON.stringify({expectedMembershipId,customerId,minutes,commandId:pending.commandId}));
    if(result.status==='authority_rejected') return {status:'forbidden'};
    if(result.status!=='response') return {status:'unavailable'};
    if(result.statusCode===409) return {status:'command_id_conflict'};
    if(result.statusCode===403 || result.statusCode===401) return {status:'forbidden'};
    try {
      const body:unknown=JSON.parse(result.body);
      if(result.statusCode!==200 || !isJson(result.contentType) || typeof body!=='object' || body===null || Object.keys(body).length!==1 || !('status' in body) || body.status!=='succeeded') return {status:'unavailable'};
      if(this.pendingQuota===pending)this.pendingQuota=null;
      return {status:'succeeded'};
    } catch {return {status:'unavailable'};}
  }

  async readCustomerHours(request: CustomerHoursRequest): Promise<CustomerHoursResult> {
    const result = await this.requests.post(new URL('/v1/customers/hours/query', this.baseUrl), JSON.stringify(request));
    if (result.status === 'authority_rejected') return result;
    if (result.status !== 'response' || result.statusCode !== 200 || !isJson(result.contentType)) return {status:'unavailable'};
    try {
      const value: unknown = JSON.parse(result.body);
      return isCustomerHoursResponse(value) ? {status:'ready',value} : {status:'unavailable'};
    } catch { return {status:'unavailable'}; }
  }

  async read(expectedMembershipId: string, targetsSearch: string | null = null): Promise<MobileWorkReadResult> {
    const body = JSON.stringify({
      expectedMembershipId,
      cursor: null,
      limit: 20,
    });
    const [ownTime, targets] = await Promise.all([
      this.requests.post(new URL('/v1/mobile/own-time/query', this.baseUrl), body, {includeTimeDetails:true,includeCalendarBreaks:true,includeActiveCapture:true}),
      this.requests.post(new URL('/v2/mobile/work-targets/query', this.baseUrl), JSON.stringify({
        expectedMembershipId,
        cursor: null,
        limit: 50, search:targetsSearch,
      })),
    ]);
    if (ownTime.status === 'authority_rejected' || targets.status === 'authority_rejected') {
      return { status: 'authority_rejected' };
    }
    if (
      ownTime.status !== 'response'
      || ownTime.statusCode !== 200
      || !isJson(ownTime.contentType)
      || targets.status !== 'response'
      || targets.statusCode !== 200
      || !isJson(targets.contentType)
    ) return { status: 'unavailable' };
    try {
      const ownTimeValue: unknown = JSON.parse(ownTime.body);
      const targetsValue: unknown = JSON.parse(targets.body);
      const targetPage=parseSearchResponse('work_targets',targetsValue);
      if (!isCaptureTimeResponse(ownTimeValue)||!targetPage) return {status:'unavailable'};
      return {
        status: 'ready',
        ownTime: ownTimeValue,
        targets: targetPage,
      };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async readOwnTimePage(
    expectedMembershipId: string,
    cursor: string,
  ): Promise<MobileOwnTimePageResult> {
    const response = await this.requests.post(
      new URL('/v1/mobile/own-time/query', this.baseUrl),
      JSON.stringify({ expectedMembershipId, cursor, limit: 20 }),
      {includeTimeDetails:true,includeCalendarBreaks:true,includeActiveCapture:true},
    );
    if (response.status === 'authority_rejected') return response;
    if (
      response.status !== 'response'
      || response.statusCode !== 200
      || !isJson(response.contentType)
    ) return { status: 'unavailable' };
    try {
      const value: unknown = JSON.parse(response.body);
      return isCaptureTimeResponse(value)
        ? { status: 'ready', ownTime: value }
        : { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async triggerManual(
    expectedMembershipId: string,
    target: SafeWorkTarget,
  ): Promise<ManualTriggerResult> {
    const response = await this.requests.post(
      new URL('/v1/lifecycle-events/manual', this.baseUrl),
      JSON.stringify({
        expectedMembershipId,
        workEvent: {
          id: this.createUuid(),
          target: {
            targetType: target.targetType,
            targetId: target.targetId,
          },
        },
        receipt: { id: this.createUuid(), attemptNumber: 1 },
      }),
    );
    return parseManualTriggerResponse(response);
  }

  async triggerBreak(expectedMembershipId: string): Promise<ManualTriggerResult> {
    const response = await this.requests.post(
      new URL('/v1/lifecycle-events/manual-break', this.baseUrl),
      JSON.stringify({
        expectedMembershipId,
        workEvent: { id: this.createUuid(), subject: { type: 'break' } },
        receipt: { id: this.createUuid(), attemptNumber: 1 },
      }),
    );
    return parseManualTriggerResponse(response);
  }
}

function parseManualTriggerResponse(
  response: Awaited<ReturnType<AuthenticatedJsonPostPort['post']>>,
): ManualTriggerResult {
  if (response.status === 'authority_rejected') return response;
  if (response.status !== 'response' || !isJson(response.contentType)) {
    return { status: 'unavailable' };
  }
  if (response.statusCode === 202) return { status: 'accepted', outcome: 'pending' };
  if (response.statusCode !== 200) {
    return response.statusCode === 401
      ? { status: 'authority_rejected' }
      : { status: 'unavailable' };
  }
  try {
    const value: unknown = JSON.parse(response.body);
    if (
      !isRecord(value)
      || value.status !== 'synchronized'
      || !isRecord(value.decision)
      || ![
        'time_entry_started',
        'time_entry_stopped',
        'duplicate_scan_ignored',
        'active_entry_for_other_target_rejected',
        'break_started',
        'break_stopped',
        'break_without_active_time_entry_rejected',
        'work_trigger_during_break_rejected',
        'escalation_required',
      ].includes(String(value.decision.status))
    ) return { status: 'unavailable' };
    return {
      status: 'accepted',
      outcome: (value.decision.status === 'escalation_required' && value.decision.reason === 'work_location_unavailable'
        ? 'work_location_unavailable' : value.decision.status) as Extract<
        ManualTriggerResult,
        { status: 'accepted' }
      >['outcome'],
    };
  } catch {
    return { status: 'unavailable' };
  }
}

function isJson(value: string | null): boolean {
  return value?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
