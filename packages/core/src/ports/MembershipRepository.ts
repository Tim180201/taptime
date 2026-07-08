import type { Membership } from '../domain/Membership';
import type { UserId } from '../domain/ids';

// DT-018 (TS-002 Ports). Finds the Membership for a given actor (per FB-002's single-
// membership-per-actor assumption), plus the one write method this specification's new
// repository needs.
export interface MembershipRepository {
  findByUserId(userId: UserId): Membership | null;
  save(membership: Membership): void;
}
