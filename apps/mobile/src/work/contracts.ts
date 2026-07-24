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
  | 'escalation_required'
  | 'pending'
  | 'rejected';

export type MobileWorkState =
  | { readonly status: 'inactive' }
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly ownTime: MobileOwnTimeQueryResponse;
      readonly targets: MobileWorkTargetQueryResponse;
      readonly submitting: boolean;
      readonly loadingMore: boolean;
      readonly outcome: ManualTriggerOutcome | null;
    };

export interface MobileWorkCapability {
  getState(): MobileWorkState;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  loadMoreOwnTime(): Promise<void>;
  triggerManual(target: SafeWorkTarget): Promise<void>;
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
  read(
    expectedMembershipId: string,
  ): Promise<MobileWorkReadResult>;
  readOwnTimePage(
    expectedMembershipId: string,
    cursor: string,
  ): Promise<MobileOwnTimePageResult>;
  triggerManual(
    expectedMembershipId: string,
    target: SafeWorkTarget,
  ): Promise<ManualTriggerResult>;
}
