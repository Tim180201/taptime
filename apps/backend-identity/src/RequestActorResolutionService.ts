import type { AccessTokenVerifier } from './accessToken.js';
import {
  type IdentityMembershipResolver,
  type RequestActorResolutionResult,
  type ResolveRequestActorCommand,
} from './identityResolution.js';

export class RequestActorResolutionService {
  constructor(
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly identityMembershipResolver: IdentityMembershipResolver,
  ) {}

  async resolve(command: ResolveRequestActorCommand): Promise<RequestActorResolutionResult> {
    const verification = await this.accessTokenVerifier.verify(command.accessToken);
    if (verification.status === 'rejected') {
      return {
        status: 'rejected',
        reason: 'access_token_rejected',
        tokenReason: verification.reason,
      };
    }

    const resolution = await this.identityMembershipResolver.resolve(verification.identity);
    if (resolution.status === 'not_resolved') {
      return { status: 'rejected', reason: 'identity_or_membership_unavailable' };
    }
    if (resolution.membership.organizationId !== command.requestedOrganizationId) {
      return { status: 'rejected', reason: 'requested_organization_mismatch' };
    }

    return {
      status: 'accepted',
      actor: Object.freeze({
        userId: resolution.membership.userId,
        organizationId: resolution.membership.organizationId,
        membershipId: resolution.membership.membershipId,
        role: resolution.membership.role,
      }),
    };
  }
}
