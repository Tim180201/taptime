import { expect, it } from 'vitest';
import { createSearchContext, boundedSearchPage } from '../src/serverSearch.js';

const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
const request = { expectedMembershipId: id(1), search: '  O\u0308zd  ', cursor: null, limit: 50 };
it('T117 cursor carries the key and binds normalized search, filters, actor and route', () => {
  const context = createSearchContext('work_targets', { ...request, targetType: 'customer' })!;
  const cursor = context.cursor({ name: 'Özdemir/😀', id: id(2), rank: 1 });
  expect(createSearchContext('work_targets', { ...request, targetType: 'customer', cursor, limit: 1 })?.after)
    .toEqual({ name: 'Özdemir/😀', id: id(2), rank: 1 });
  for (const patch of [{ search: 'other' }, { targetType: 'project' }, { expectedMembershipId: id(3) }]) {
    expect(createSearchContext('work_targets', { ...request, targetType: 'customer', cursor, ...patch })).toBeNull();
  }
  expect(createSearchContext('projects', { ...request, cursor })).toBeNull();
  for (const invalid of ['', 'q1:invalid', cursor + '=', 'x'.repeat(2049)]) {
    expect(createSearchContext('work_targets', { ...request, cursor: invalid })).toBeNull();
  }
});
it('T117 byte pruning accounts for the full serialized envelope and last delivered cursor', () => {
  const input = Array.from({ length: 51 }, (_, i) => ({ id: id(i + 2), name: '😀'.repeat(120) }));
  const context = createSearchContext('projects', request)!;
  const build = (items: typeof input, nextCursor: string | null) => ({ status: 'succeeded', organization: { name: '😀'.repeat(120) }, items, nextCursor });
  const page = boundedSearchPage(input, 50, build, row => context.cursor(row));
  expect(page.items.length).toBeGreaterThan(0); expect(page.items.length).toBeLessThan(50);
  expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(14_336);
  expect(createSearchContext('projects', { ...request, cursor: page.nextCursor })?.after?.id).toBe(page.items.at(-1)!.id);
  const untrimmed = build(input.slice(0, page.items.length + 1), context.cursor(input[page.items.length]!));
  expect(Buffer.byteLength(JSON.stringify(untrimmed))).toBeGreaterThan(14_336);
  expect(boundedSearchPage([], 50, build, row => context.cursor(row)).nextCursor).toBeNull();
  expect(boundedSearchPage(input.slice(0, 1), 50, build, row => context.cursor(row)).nextCursor).toBeNull();
});
it('T117 rejects a cursor name that PostgreSQL cannot represent as text', () => {
  const context = createSearchContext('projects', request)!;
  const cursor = context.cursor({ name: '\u0000', id: id(2) });
  expect(createSearchContext('projects', { ...request, cursor })).toBeNull();
});
