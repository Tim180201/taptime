import { describe, expect, it } from 'vitest';
import * as contract from '../src/index.js';
import { createSearchContext, createTargetAssignmentContext, createQuotaAlertsContext } from '../src/serverSearch.js';

const id = '00000000-0000-4000-8000-000000000001';
const page = { expectedMembershipId: id, search: null, cursor: null, limit: 50 };
const month = { fromInclusive: '2026-09-30T22:00:00.000Z', toExclusive: '2026-10-31T23:00:00.000Z' };
const change = { expectedMembershipId: id, commandId: id, membershipId: id, targetType: 'customer', targetId: id, assigned: true };
const api = contract as any;

it('T118 validates exactly one customer/project pair and a boolean state', () => {
  expect(api.isTargetAssignmentChangeRequest(change)).toBe(true);
  expect(api.isTargetAssignmentChangeRequest({ ...change, targetType: 'project', assigned: false })).toBe(true);
  for (const patch of [{ assigned: 'true' }, { targetType: 'general_work' }, { membershipId: 'bad' }, { extra: true }]) {
    expect(api.isTargetAssignmentChangeRequest({ ...change, ...patch })).toBe(false);
  }
  const { assigned, ...missing } = change;
  expect(api.isTargetAssignmentChangeRequest(missing)).toBe(false);
});

describe.each(['work_targets', 'backfill_targets'] as const)('T118 %s filter', kind => {
  const request = { ...page, ...(kind === 'backfill_targets' ? { targetMembershipId: id } : {}) };
  it('accepts assignedOnly and binds the cursor to it', () => {
    for (const assignedOnly of [true, false]) expect(api.parseSearchRequest(kind, { ...request, assignedOnly })).toEqual({ ...request, assignedOnly });
    expect(api.parseSearchRequest(kind, { ...request, assignedOnly: 1 })).toBeNull();
    const context = createSearchContext(kind, { ...request, assignedOnly: true })!;
    expect(context).not.toBeNull();
    const cursor = context.cursor({ name: 'Änne', id, rank: 1 });
    expect(createSearchContext(kind, { ...request, assignedOnly: false, cursor })).toBeNull();
    expect(createSearchContext(kind, { ...request, assignedOnly: true, cursor })?.after?.id).toBe(id);
    expect(api.parseSearchRequest(kind, request)).toEqual(request);
  });
});

it('T118 administration query selects exactly one side and normalizes search', () => {
  for (const selector of [{ membershipId: id }, { targetType: 'customer', targetId: id }, { targetType: 'project', targetId: id }]) {
    expect(api.parseTargetAssignmentQuery({ ...page, ...selector, search: '  O\u0308zd  ' })).toEqual({ ...page, ...selector, search: 'Özd' });
  }
  for (const selector of [{}, { membershipId: id, targetId: id, targetType: 'customer' }, { targetId: id }, { targetType: 'general_work', targetId: id }]) {
    expect(api.parseTargetAssignmentQuery({ ...page, ...selector })).toBeNull();
  }
  expect(api.parseTargetAssignmentQuery({ ...page, membershipId: id, search: 'x'.repeat(81) })).toBeNull();
  expect(api.parseTargetAssignmentQuery({ ...page, membershipId: id, limit: 51 })).toBeNull();
});

it('T118 quota query accepts only a calendar month and a bounded page, without search', () => {
  const { search, ...base } = page;
  const request = { ...base, ...month };
  expect(api.parseQuotaAlertsQuery(request)).toEqual(request);
  for (const patch of [{ search: null }, { limit: 51 }, { toExclusive: month.fromInclusive }, { expectedMembershipId: 'bad' }]) {
    expect(api.parseQuotaAlertsQuery({ ...request, ...patch })).toBeNull();
  }
});

it('T118 new cursors bind route, actor, side, search and month without binding page size', () => {
  const assignments = { ...page, membershipId: id };
  const context = createTargetAssignmentContext(assignments)!;
  const cursor = context.cursor({ name: 'Änne', id });
  expect(createTargetAssignmentContext({ ...assignments, cursor, limit: 1 })?.after).toEqual({ name: 'Änne', id });
  expect(createTargetAssignmentContext({ ...page, targetType: 'customer', targetId: id, cursor })).toBeNull();
  expect(createTargetAssignmentContext({ ...assignments, search: 'different', cursor })).toBeNull();
  const quota = { expectedMembershipId: id, cursor: null, limit: 50, ...month };
  expect(createQuotaAlertsContext({ ...quota, cursor })).toBeNull();
  const quotaCursor = createQuotaAlertsContext(quota)!.cursor({ name: 'Änne', id });
  expect(createQuotaAlertsContext({ ...quota, cursor: quotaCursor, limit: 1 })?.after?.id).toBe(id);
  expect(createQuotaAlertsContext({ ...quota, cursor: quotaCursor, fromInclusive: '2026-08-31T22:00:00.000Z', toExclusive: '2026-09-30T22:00:00.000Z' })).toBeNull();
});
