import type { Membership } from '../Membership';

export interface MembershipGranted {
  readonly type: 'MembershipGranted';
  readonly membership: Membership;
}

export function membershipGranted(membership: Membership): MembershipGranted {
  return { type: 'MembershipGranted', membership };
}
