import { describe, expect, it } from 'vitest';
import { isArchiveResponse, parseArchiveRequest } from '../src/archive.js';
import { createArchiveContext } from '../src/serverSearch.js';
const id = '00000000-0000-4000-8000-000000000001';
const page = { expectedMembershipId: id, locationId: null, search: null, cursor: null, limit: 50 };
const month = { fromInclusive: '2026-06-30T22:00:00.000Z', toExclusive: '2026-07-31T22:00:00.000Z' };
it('archive accepts only closed, normalized requests with explicit bounds', () => {
  expect(parseArchiveRequest('people', { ...page, membershipId: null, search: '  A\u0308rzte  ' })).toMatchObject({ search: 'Ärzte' });
  for (const patch of [{ limit: 51 }, { search: '' }, { locationId: 'other' }, { membershipId: 'invalid' }, { unexpected: true }])
    expect(parseArchiveRequest('people', { ...page, membershipId: null, ...patch })).toBeNull();
  expect(parseArchiveRequest('managed_people', { ...page, ...month, isRunning: true })).not.toBeNull();
  expect(parseArchiveRequest('person_time', { expectedMembershipId: id, targetMembershipId: id, ...month, cursor: null, limit: 21 })).toBeNull();
  expect(parseArchiveRequest('status', { expectedMembershipId: id, membershipIds: [id, id], targets: [] })).toBeNull();
  expect(parseArchiveRequest('status', { expectedMembershipId: id, membershipIds: [], targets: [{ targetType: 'general_work', targetId: id }] })).toBeNull();
});
it('archive cursors bind kind, actor, search, location, single-person filter and month', () => {
  const request = { ...page, membershipId: id };
  const context = createArchiveContext('people', request)!;
  const cursor = context.cursor({ name: '', id }); // nullable legacy display name sorts as empty text, without replacing its payload
  expect(createArchiveContext('people', { ...request, cursor })?.after).toEqual({ name: '', id });
  expect(createArchiveContext('targets', { ...page, cursor })).toBeNull();
  for (const patch of [{ expectedMembershipId: '00000000-0000-4000-8000-000000000002' }, { search: 'Neu' }, { locationId: id }, { membershipId: null }])
    expect(createArchiveContext('people', { ...request, ...patch, cursor })).toBeNull();
  const summary = { ...page, ...month, isRunning: null };
  const summaryCursor = createArchiveContext('managed_people', summary)!.cursor({ name: 'Name', id });
  expect(createArchiveContext('managed_people', { ...summary, cursor: summaryCursor, fromInclusive: month.toExclusive, toExclusive: '2026-08-31T22:00:00.000Z' })).toBeNull();
});
describe('archive responses', () => {
  const person = { membershipId: id, displayName: null, role: 'employee', location: null, revokedAt: month.fromInclusive, lastStartedAt: null };
  it('preserves nullable names, rejecting invalid fields and duplicates', () => {
    expect(isArchiveResponse('people', { people: [person], nextCursor: null })).toBe(true);
    for (const row of [{ ...person, displayName: '' }, { ...person, revokedAt: 'yesterday' }, { ...person, email: 'private' }])
      expect(isArchiveResponse('people', { people: [row], nextCursor: null })).toBe(false);
    expect(isArchiveResponse('people', { people: [person, person], nextCursor: null })).toBe(false);
    expect(isArchiveResponse('targets', { targets: [], nextCursor: 'q1:more' })).toBe(false);
  });
  it('requires write authority separately from the ordinary time response', () => {
    const time = { activeRecord: null, records: [], windowStartedAt: month.fromInclusive, windowEndedAt: month.toExclusive, nextCursor: null };
    expect(isArchiveResponse('person_time', time)).toBe(false);
    expect(isArchiveResponse('person_time', { ...time, canManageTime: false })).toBe(true);
  });
  it('distinguishes equal target IDs by type and rejects extra status fields', () => {
    const response = { people: [{ membershipId: id, archived: false }], targets: [
      { targetType: 'customer', targetId: id, archived: true }, { targetType: 'project', targetId: id, archived: true },
    ] };
    expect(isArchiveResponse('status', response)).toBe(true);
    expect(isArchiveResponse('status', { ...response, secret: 'no' })).toBe(false);
  });
});
