import type {
  AccessTokenVerificationRejectionReason,
  VerifiedProviderIdentity,
} from '@taptime/backend-identity';

export class InvalidBootstrapRequestError extends Error {}

export interface BootstrapOrganizationCommand {
  readonly requestId: string;
  readonly organizationDisplayName: string;
  readonly accessToken: string;
}

export interface VerifiedBootstrapRequest {
  readonly requestId: string;
  readonly canonicalOrganizationName: string;
  readonly identity: VerifiedProviderIdentity;
}

export type BootstrapOrganizationResult =
  | {
      readonly status: 'succeeded';
      readonly idempotentRetry: boolean;
      readonly userId: string;
      readonly identityBindingId: string;
      readonly organizationId: string;
      readonly membershipId: string;
    }
  | {
      readonly status: 'rejected';
      readonly reason: 'access_token_rejected';
      readonly tokenReason: AccessTokenVerificationRejectionReason;
    }
  | {
      readonly status: 'rejected';
      readonly reason:
        | 'identity_unavailable'
        | 'invalid_request'
        | 'operator_not_authorized'
        | 'operator_replay_forbidden'
        | 'request_id_conflict';
    }
  | {
      readonly status: 'unavailable';
      readonly reason: 'service_unavailable';
    };

export interface BootstrapCapability {
  execute(request: VerifiedBootstrapRequest): Promise<BootstrapOrganizationResult>;
}
