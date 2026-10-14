import {isSearchCursor} from '@taptime/mobile-work-contract';
import type { SafeEmployeeProjection } from './contracts';
import { isCanonicalSafeTapTimeName } from './safeTapTimeName';

const canonicalUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const pageLimit = 50;

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
  if (!isSearchCursor(requestedCursor)||!isSearchCursor(projection.nextCursor)) return false;
  if(new Set(projection.employeeMemberships.map(member=>member.id)).size!==projection.employeeMemberships.length)return false;

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
    ) return false;
  }

  return projection.nextCursor===null || projection.employeeMemberships.length>0;
}
