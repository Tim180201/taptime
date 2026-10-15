import { expect, it } from 'vitest';
import { parseSearchRequest } from '../src/search.js';
import { createSearchContext } from '../src/serverSearch.js';
const id = '00000000-0000-4000-8000-000000000001';
const request = { expectedMembershipId: id, search: null, cursor: null, limit: 50, locationId: null };
it.each([true, false, null])('T105 accepts the active filter %s', active => {
  expect(parseSearchRequest('memberships', { ...request, active })).toEqual({ ...request, active });
});
it('T105 preserves omitted filters and rejects malformed ones', () => {
  expect(parseSearchRequest('memberships', request)).toEqual(request);
  for (const active of ['true', 0, undefined, [], {}]) expect(parseSearchRequest('memberships', { ...request, active })).toBeNull();
});
it('T105 binds a page cursor to the active filter', () => {
  const context = createSearchContext('memberships', { ...request, active: true });
  expect(context).not.toBeNull();
  const cursor = context!.cursor({ name: 'Alex', id });
  expect(createSearchContext('memberships', { ...request, active: true, cursor })).not.toBeNull();
  expect(createSearchContext('memberships', { ...request, active: false, cursor })).toBeNull();
  expect(createSearchContext('memberships', { ...request, cursor })).toBeNull();
});

import * as contract from '../src/search.js';
const member = { id, displayName: 'Alex', role: 'employee', active: true, rowVersion: 1, location: null,
  firstSignedInAt: '2026-10-14T08:00:00.000Z', lastSignedInAt: '2026-10-15T08:00:00.000Z' };
const page = { status: 'succeeded', organization: { id, name: 'Betrieb' }, employeeMemberships: [member], nextCursor: null };
it('T105 validates complete sign-in pairs, chronological order and the closed response shape', () => {
  const parse = (contract as any).parseMembershipSearchResponse;
  expect(typeof parse).toBe('function');
  expect(parse(page)).toEqual(page);
  const withRow = (patch: Record<string, unknown>) => ({ ...page, employeeMemberships: [{ ...member, ...patch }] });
  expect(parse(withRow({ firstSignedInAt: null, lastSignedInAt: null }))).not.toBeNull();
  for (const patch of [{ firstSignedInAt: null }, { lastSignedInAt: '2026-10-13T08:00:00.000Z' },
    { lastSignedInAt: '2026-02-30T08:00:00.000Z' }, { firstSignedInAt: undefined }, { email: 'private@example.invalid' }]) expect(parse(withRow(patch))).toBeNull();
  expect(parse({ ...page, employeeMemberships: [member, member] })).toBeNull();
  expect(parse({ ...page, employeeMemberships: [], nextCursor: 'next' })).toBeNull();
});
