import type {
  MobileOwnTimeQueryRequest,
  MobileOwnTimeQueryResponse,
  MobileWorkTargetQueryRequest,
  MobileWorkTargetQueryResponse,
  ProjectCreateRequest,
  ProjectDeactivateRequest,
  ProjectQueryRequest,
  ProjectSummary,
} from '@taptime/mobile-work-contract';

export interface MobileReadCommand<Request> {
  readonly accessToken: string;
  readonly request: Request;
}

export type MobileReadResult<Response> =
  | { readonly status: 'succeeded'; readonly response: Response }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'forbidden' }
  | { readonly status: 'invalid_request' };

export interface MobileWorkReader {
  queryOwnTime(
    command: MobileReadCommand<MobileOwnTimeQueryRequest>,
  ): Promise<MobileReadResult<MobileOwnTimeQueryResponse>>;
  queryWorkTargets(
    command: MobileReadCommand<MobileWorkTargetQueryRequest>,
  ): Promise<MobileReadResult<MobileWorkTargetQueryResponse>>;
}

export interface ProjectAdministrationPort {
  queryProjects(
    command: MobileReadCommand<ProjectQueryRequest>,
  ): Promise<MobileReadResult<{
    readonly projects: readonly ProjectSummary[];
    readonly nextCursor: string | null;
  }>>;
  createProject(
    command: MobileReadCommand<ProjectCreateRequest>,
  ): Promise<ProjectMutationResult>;
  deactivateProject(
    command: MobileReadCommand<ProjectDeactivateRequest>,
  ): Promise<ProjectMutationResult>;
}

export type ProjectMutationResult =
  | {
      readonly status: 'succeeded';
      readonly idempotentRetry: boolean;
      readonly project: ProjectSummary;
      readonly receiptId: string;
    }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'forbidden' }
  | { readonly status: 'invalid_request' }
  | { readonly status: 'command_id_conflict' }
  | { readonly status: 'project_in_use' }
  | { readonly status: 'project_unavailable' }
  | { readonly status: 'stale_row_version' };
