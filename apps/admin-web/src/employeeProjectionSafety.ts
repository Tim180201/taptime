import type { SafeEmployeeProjection } from './contracts';
import { isCanonicalSafeTapTimeName } from './safeTapTimeName';

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const employeeCursor = /^v1:m:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const pageLimit = 20;

export function isSafeEmployeeProjectionPage(
  projection: SafeEmployeeProjection,
  requestedCursor: string | null,
  requestedLocationId: string | null = null,
): boolean {
  if (
    !canonicalUuid.test(projection.organization.id)
    || !isCanonicalSafeTapTimeName(projection.organization.name)
    || projection.employeeMemberships.length > pageLimit
  ) return false;
  const cursorMatch = requestedCursor === null ? null : employeeCursor.exec(requestedCursor);
  if (requestedCursor !== null && cursorMatch === null) return false;

  let previousId: string | null = cursorMatch?.[1] ?? null;
  for (const membership of projection.employeeMemberships) {
    if (
      !canonicalUuid.test(membership.id)
      || !isCanonicalSafeTapTimeName(membership.displayName)
      || !['employee', 'standortleitung', 'administrator'].includes(membership.role)
      || typeof membership.active !== 'boolean'
      || !Number.isSafeInteger(membership.rowVersion)
      || membership.rowVersion < 1
      || (membership.location !== null && (
        !canonicalUuid.test(membership.location.id)
        || !isCanonicalSafeTapTimeName(membership.location.name)
      ))
      || (requestedLocationId !== null && membership.location?.id !== requestedLocationId)
      || (previousId !== null && membership.id <= previousId)
    ) return false;
    previousId = membership.id;
  }

  if (projection.nextCursor === null) return true;
  return projection.employeeMemberships.length === pageLimit
    && previousId !== null
    && projection.nextCursor === `v1:m:${previousId}`;
}
