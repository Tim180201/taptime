// Server-only entry point. Keep crypto/Buffer out of the client contract bundle.
import { createHash } from 'node:crypto';
import { isCanonicalUuid } from './index.js';
import { parseSearchRequest, SEARCH_PAGE_MAXIMUM_BYTES, type SearchKind, type SearchRequests } from './search.js';

export interface SearchKey { readonly name: string; readonly id: string; readonly rank?: number }
export function createSearchContext<K extends SearchKind>(kind: K, input: unknown) {
  const request = parseSearchRequest(kind, input);
  if (request === null) return null;
  const { cursor, limit: _limit, ...filters } = request;
  const hash = createHash('sha256').update(JSON.stringify([kind, Object.entries(filters).sort(([a], [b]) => a.localeCompare(b))])).digest('hex');
  const prefix = kind === 'managed_people' ? 's6' : 'q1';
  let after: SearchKey | null = null;
  if (cursor !== null) {
    if (!cursor.startsWith(`${prefix}:`)) return null;
    try {
      const encoded = cursor.slice(prefix.length + 1), decoded = Buffer.from(encoded, 'base64url');
      if (decoded.toString('base64url') !== encoded) return null;
      const key: unknown = JSON.parse(decoded.toString('utf8'));
      if (!Array.isArray(key) || key.length !== 4 || key[0] !== hash || typeof key[1] !== 'string'
        || key[1].includes('\u0000') || Array.from(key[1]).length > 120 || !isCanonicalUuid(key[2])
        || !(key[3] === null || Number.isInteger(key[3]) && key[3] >= 1 && key[3] <= 3)) return null;
      // PostgreSQL text cannot represent NUL. Keep representable stored keys verbatim
      // rather than normalizing a cursor and shifting its ICU page boundary.
      after = { name: key[1], id: key[2], ...(key[3] === null ? {} : { rank: key[3] }) };
      if (['work_targets', 'backfill_targets'].includes(kind) !== (after.rank !== undefined)) return null;
    } catch { return null; }
  }
  return { request: request as SearchRequests[K], after,
    cursor: (key: SearchKey): string => `${prefix}:${Buffer.from(JSON.stringify([hash, key.name, key.id, key.rank ?? null])).toString('base64url')}` };
}
/** G1: SQL supplies limit+1. Trim the tail using the actual wire envelope, including cursor. */
export function boundedSearchPage<Row, Response>(rows: readonly Row[], limit: number,
  build: (page: Row[], nextCursor: string | null) => Response, cursor: (row: Row) => string): Response {
  for (let count = Math.min(rows.length, limit); count >= (rows.length ? 1 : 0); count--) {
    const page = rows.slice(0, count);
    const response = build(page, rows.length > count ? cursor(page[count - 1]!) : null);
    if (Buffer.byteLength(JSON.stringify(response), 'utf8') <= SEARCH_PAGE_MAXIMUM_BYTES) return response;
  }
  // Current bounded fields fit one item. A future oversized field must fail loudly;
  // neither an empty nonterminal page nor an over-budget response may escape.
  throw new Error('Search item exceeds response budget');
}
export const searchTargetRank = (type: string) => type === 'customer' ? 1 : type === 'project' ? 2 : 3;
