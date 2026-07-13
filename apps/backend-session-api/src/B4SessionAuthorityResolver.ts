import type {
  AccessTokenVerifier,
  IdentityMembershipResolver,
} from '@taptime/backend-identity';
import type { SessionAuthorityResolution, SessionAuthorityResolver } from './types.js';

/**
 * The C1 endpoint deliberately composes B4 verification and Membership resolution directly: it
 * accepts no requested Organization and therefore cannot use client scope as authority.
 */
export class B4SessionAuthorityResolver implements SessionAuthorityResolver {
  constructor(
    private readonly verifier: AccessTokenVerifier,
    private readonly membershipResolver: IdentityMembershipResolver,
  ) {}

  async resolve(accessToken: string): Promise<SessionAuthorityResolution> {
    const verification = await this.verifier.verify(accessToken);
    if (verification.status === 'rejected') {
      return { status: 'rejected' };
    }

    const resolution = await this.membershipResolver.resolve(verification.identity);
    if (resolution.status === 'not_resolved') {
      return { status: 'rejected' };
    }

    return {
      status: 'resolved',
      session: Object.freeze({
        userId: resolution.membership.userId,
        membershipId: resolution.membership.membershipId,
        organizationId: resolution.membership.organizationId,
        role: resolution.membership.role,
      }),
    };
  }
}
