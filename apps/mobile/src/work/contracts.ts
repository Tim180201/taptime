import type {QuotaAlertsCapability as importQuotaAlertsCapability} from '../search/search';
import type { ClientSearchCapability } from '../search/search';
import type {
  MobileOwnTimeQueryResponse,
  MobileWorkTargetQueryResponse,
  SafeWorkTarget,
} from '@taptime/mobile-work-contract';
import type { InternalAuthenticatedSessionSnapshot } from '../auth/contracts';

export type ManualTriggerOutcome =
  | 'time_entry_started'
  | 'time_entry_stopped'
  | 'duplicate_scan_ignored'
  | 'active_entry_for_other_target_rejected'
  | 'break_started'
  | 'break_stopped'
  | 'break_without_active_time_entry_rejected'
  | 'work_trigger_during_break_rejected'
  | 'work_location_unavailable'
        | 'escalation_required'
  | 'pending'
  | 'not_transferred'
  | 'rejected';

export type MobileWorkState =
  | { readonly status: 'inactive' }
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly ownTime: MobileOwnTimeQueryResponse;
      readonly targets: MobileWorkTargetQueryResponse;
      readonly targetsSearch?:string|null;
      readonly targetsBusy?:boolean;
      readonly targetsFailed?:boolean;
      readonly submitting: boolean;
      readonly capturePending?: boolean;
      readonly captureBlockedReason?: string | null;
      readonly loadingMore: boolean;
      readonly outcome: ManualTriggerOutcome | null;
      readonly feedback?: string | null;
    };

export interface MobileWorkCapability extends ClientSearchCapability, importQuotaAlertsCapability {
  searchTargets?(search:string|null,more?:boolean):Promise<void>;

  setCustomerQuota?(customerId:string,minutes:number|null):Promise<import('@taptime/mobile-work-contract').SetCustomerQuotaResult>;
  readCustomerHours?(month: string): Promise<import('@taptime/mobile-work-contract').CustomerHoursResult>;
  getState(): MobileWorkState;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  loadMoreOwnTime(): Promise<void>;
  triggerManual(target: SafeWorkTarget): Promise<void>;
  triggerBreak(): Promise<void>;
  stopActiveTime(): Promise<void>;
}

export interface MobileWorkSessionReader {
  capture(): InternalAuthenticatedSessionSnapshot | null;
  isCurrent(snapshot: InternalAuthenticatedSessionSnapshot): boolean;
  subscribe(listener: () => void): () => void;
}

export type MobileWorkReadResult =
  | {
      readonly status: 'ready';
      readonly ownTime: MobileOwnTimeQueryResponse;
      readonly targets: MobileWorkTargetQueryResponse;
    }
  | { readonly status: 'authority_rejected' | 'unavailable' };

export type MobileOwnTimePageResult =
  | { readonly status: 'ready'; readonly ownTime: MobileOwnTimeQueryResponse }
  | { readonly status: 'authority_rejected' | 'unavailable' };

export type ManualTriggerResult =
  | { readonly status: 'accepted'; readonly outcome: ManualTriggerOutcome }
  | { readonly status: 'authority_rejected' | 'unavailable' };

export interface MobileWorkApiPort {
  readQuotaAlerts?(request:import('@taptime/mobile-work-contract').QuotaAlertsQueryRequest):Promise<import('../search/search').PageResult<import('@taptime/mobile-work-contract').QuotaAlertsQueryResponse>>;
  querySearch?<K extends import('@taptime/mobile-work-contract').SearchKind>(kind:K,request:import('@taptime/mobile-work-contract').SearchRequests[K]):Promise<import('../search/search').PageResult<import('@taptime/mobile-work-contract').SearchResponses[K]>>;
  setCustomerQuota?(membershipId:string,customerId:string,minutes:number|null):Promise<import('@taptime/mobile-work-contract').SetCustomerQuotaResult>;
  readCustomerHours?(request: import('@taptime/mobile-work-contract').CustomerHoursRequest): Promise<import('@taptime/mobile-work-contract').CustomerHoursResult>;
  read(
    expectedMembershipId: string,
    targetsSearch?: string | null,
  ): Promise<MobileWorkReadResult>;
  readOwnTimePage(
    expectedMembershipId: string,
    cursor: string,
  ): Promise<MobileOwnTimePageResult>;
  triggerManual(
    expectedMembershipId: string,
    target: SafeWorkTarget,
  ): Promise<ManualTriggerResult>;
  triggerBreak?(expectedMembershipId: string): Promise<ManualTriggerResult>;
}
