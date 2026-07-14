import type { ProductScanSessionSnapshot } from './contracts';

export function sameProductScanSessionSnapshot(
  left: ProductScanSessionSnapshot,
  right: ProductScanSessionSnapshot,
): boolean {
  return left.generation === right.generation
    && left.session.userId === right.session.userId
    && left.session.organizationId === right.session.organizationId
    && left.session.membershipId === right.session.membershipId
    && left.session.role === right.session.role;
}

export function copyFrozenProductScanSessionSnapshot(
  snapshot: ProductScanSessionSnapshot,
): ProductScanSessionSnapshot {
  return Object.freeze({
    generation: snapshot.generation,
    session: Object.freeze({
      userId: snapshot.session.userId,
      organizationId: snapshot.session.organizationId,
      membershipId: snapshot.session.membershipId,
      role: snapshot.session.role,
    }),
  });
}
