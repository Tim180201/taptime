import type {
  AccessTokenVerifier,
  AdministrationSessionProjectionResolver,
  IdentityMembershipResolver,
} from '@taptime/backend-identity';
import { isMembershipRole } from '@taptime/core';
import type {
  AdministrationSessionAuthorityResolution,
  AdministrationSessionAuthorityResolver,
  SessionAuthorityResolution,
  SessionAuthorityResolver,
} from './types.js';

/**
 * The C1 endpoint deliberately composes B4 verification and Membership resolution directly: it
 * accepts no requested Organization and therefore cannot use client scope as authority.
 */
export class B4SessionAuthorityResolver implements SessionAuthorityResolver {
  constructor(
    private readonly verifier: AccessTokenVerifier,
    private readonly membershipResolver: IdentityMembershipResolver,
    private readonly projectionResolver: AdministrationSessionProjectionResolver,
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
    if (!isMembershipRole(resolution.membership.role)) {
      return { status: 'rejected' };
    }

    const projected = await this.projectionResolver.resolveAdministrationSession(resolution.membership);
    if (projected.status !== 'resolved') return { status: 'rejected' };
    return {
      status: 'resolved',
      session: Object.freeze({
        userId: resolution.membership.userId,
        membershipId: resolution.membership.membershipId,
        organizationId: resolution.membership.organizationId,
        role: resolution.membership.role,
        nfcSetupAvailable: projected.projection.nfcSetupAvailable,
        locationsEnabled: projected.projection.locationsEnabled,
        managementScope: mobileManagementScope(projected.projection),
      }),
    };
  }
}

export class B4AdministrationSessionAuthorityResolver
implements AdministrationSessionAuthorityResolver {
  constructor(
    private readonly verifier: AccessTokenVerifier,
    private readonly membershipResolver: IdentityMembershipResolver,
    private readonly projectionResolver: AdministrationSessionProjectionResolver,
  ) {}

  async resolve(accessToken: string): Promise<AdministrationSessionAuthorityResolution> {
    const verification = await this.verifier.verify(accessToken);
    if (verification.status === 'rejected') return { status: 'rejected' };
    const resolution = await this.membershipResolver.resolve(verification.identity);
    if (resolution.status === 'not_resolved') return { status: 'rejected' };
    const projected = await this.projectionResolver.resolveAdministrationSession(
      resolution.membership,
    );
    if (projected.status === 'not_resolved') return { status: 'rejected' };
    return {
      status: 'resolved',
      session: Object.freeze({
        userId: resolution.membership.userId,
        membershipId: resolution.membership.membershipId,
        organizationId: resolution.membership.organizationId,
        role: projected.projection.role,
        locationsEnabled: projected.projection.locationsEnabled,
        availableSections: projected.projection.availableSections,
        managementScope: projected.projection.managementScope,
      }),
    };
  }
}

function mobileManagementScope(projection: import('@taptime/backend-identity').AdministrationSessionProjection) {
  if (!projection.availableSections.includes('employees')) return null;
  if (projection.managementScope.kind === 'organization') return { kind: 'organization' as const };
  // The Mobile contract represents one location. Never broaden or choose a grant arbitrarily.
  const locations = projection.managementScope.locations;
  if (locations.length !== 1) return null;
  return { kind: 'location' as const, locationId: locations[0]!.id, locationName: locations[0]!.name };
}
