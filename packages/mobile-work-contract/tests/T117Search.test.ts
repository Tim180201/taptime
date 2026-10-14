import { describe, expect, it } from 'vitest';
import * as contract from '../src/index.js';

const parse = (kind: string, value: unknown): any => (contract as any).parseSearchRequest(kind, value);
const id = '00000000-0000-4000-8000-000000000001';
const base = { expectedMembershipId: id, search: null, cursor: null, limit: 50 };
const month = { fromInclusive: '2026-09-30T22:00:00.000Z', toExclusive: '2026-10-31T23:00:00.000Z' };
const requests = {
  customer_hours: { ...base, ...month },
  managed_people: { ...base, ...month, locationId: null, isRunning: null },
  memberships: { ...base, locationId: null },
  setup_customers: { ...base, kind: 'customers' },
  setup_tags: { ...base, kind: 'nfc_tags' },
  work_targets: base,
  backfill_targets: { ...base, targetMembershipId: id },
  projects: base,
};
describe.each(Object.entries(requests))('T117 %s request', (kind, request) => {
  it('normalizes NFC and Unicode whitespace without changing case', () => {
    expect(parse(kind, { ...request, search: '\u2003O\u0308zd\u00a0' })).toEqual({ ...request, search: 'Özd' });
    expect(parse(kind, request)).toEqual(request);
  });
  it.each(['', ' \t\n ', 'x'.repeat(81), '😀'.repeat(81), 'a\u0000b', '\ud800'])('rejects invalid search %j', search => {
    expect(parse(kind, { ...request, search })).toBeNull();
  });
  it('counts Unicode scalars, preserves literal wildcards and rejects extra fields', () => {
    for (const search of ['😀'.repeat(80), '%_\\', 'özD']) expect(parse(kind, { ...request, search })?.search).toBe(search);
    expect(parse(kind, { ...request, other: true })).toBeNull();
    for (const limit of [0, 51, 1.5]) expect(parse(kind, { ...request, limit })).toBeNull();
  });
});
it('T117 detail selects a customer and has a bounded page, without introducing a search field', () => {
  const request = { expectedMembershipId: id, customerId: id, ...month, cursor: null, limit: 50 };
  expect(parse('customer_detail', request)).toEqual(request);
  expect(parse('customer_detail', { ...request, search: null })).toBeNull();
});
it('T117 targetType is optional and only supported for the own target list', () => {
  for (const targetType of ['customer', 'project', 'general_work']) {
    expect(parse('work_targets', { ...base, targetType })?.targetType).toBe(targetType);
  }
  expect(parse('work_targets', { ...base, targetType: 'location' })).toBeNull();
  expect(parse('projects', { ...base, targetType: 'project' })).toBeNull();
});
