import type { ManagedActiveSummary, ManagedActiveSummaryRequest, ManagedPerson, ManagedPersonTimeRequest } from '@taptime/administration-contract/managed-people';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';
export type { ManagedPerson };
export type Failure = 'authority_rejected' | 'transient_failure' | 'unavailable';
export type ReadResult<T> = { readonly status: 'ready'; readonly value: T } | { readonly status: Failure };
export type InvitationStatus = Failure | 'succeeded' | 'succeeded_existing_account' | 'invalid_request' | 'invalid_email'
  | 'command_id_conflict' | 'email_exists' | 'membership_exists' | 'former_membership' | 'account_creation_not_configured'
  | 'rate_limited' | 'invitation_delivery_failed' | 'invitation_rate_limited' | 'invitation_service_unavailable' | 'invitation_needs_attention';
export interface InvitationCommand {
  readonly expectedMembershipId: string; readonly commandId: string; readonly displayName: string;
  readonly email: string; readonly locationId: string | null;
}
export interface EmployeeLocation { readonly id: string; readonly name: string }
export interface EmployeesApiPort {
  summary(request: ManagedActiveSummaryRequest): Promise<ReadResult<ManagedActiveSummary>>;
  personTime(request: ManagedPersonTimeRequest): Promise<ReadResult<MobileOwnTimeQueryResponse>>;
  locations(expectedMembershipId: string, cursor: string | null): Promise<ReadResult<{readonly locations: readonly EmployeeLocation[]; readonly nextCursor: string | null}>>;
  invite(command: InvitationCommand): Promise<{ readonly status: InvitationStatus }>;
}
export type EmployeesState =
  | { readonly status: 'inactive' | 'loading' | 'unavailable' | 'not_authorized' }
  | { readonly status: 'list'; readonly summary: ManagedActiveSummary; readonly filter: boolean; readonly busy: boolean; readonly failed: boolean }
  | { readonly status: 'person'; readonly person: ManagedPerson; readonly value: MobileOwnTimeQueryResponse | null; readonly busy: boolean; readonly failed: boolean }
  | { readonly status: 'invite'; readonly locations: readonly EmployeeLocation[]; readonly locationsReady: boolean; readonly busy: boolean;
      readonly outcome: InvitationStatus | null };
export interface EmployeesCapability {
  getState(): EmployeesState;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  filter(isRunning: boolean): Promise<void>;
  loadMore(): Promise<void>;
  openPerson(person: ManagedPerson): Promise<void>;
  loadPersonMonth(month: string): Promise<void>;
  openInvitation(): Promise<void>;
  invite(displayName: string, email: string, locationId: string | null): Promise<void>;
  back(): Promise<void>;
  leave(): void;
}
