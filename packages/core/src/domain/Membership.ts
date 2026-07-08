import type { MembershipId, OrganizationId, UserId } from './ids';
import type { MembershipRole } from './MembershipRole';

// DT-018 (TS-002 Domain Model). Associates one actor (UserId) with one Organization
// (OrganizationId) and one MembershipRole. Carries its own identifier, following the same
// precedent ADR-0002 already set for NfcAssignment. Per FB-002's assumption (Open Question 2),
// one Membership per actor exists at a time.
export interface Membership {
  readonly id: MembershipId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly role: MembershipRole;
}
