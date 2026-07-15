import type { SafeProjection } from './contracts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fingerprint = /^[A-F0-9]{12}$/;
export type Session = { readonly membershipId: string; readonly role: 'administrator' | 'employee' };
export type ApiResult<Value> = { readonly status: 'succeeded'; readonly value: Value } | { readonly status: 'rejected' | 'unavailable' };

export class AdminWebApiClient {
  constructor(private readonly fetchRequest: typeof fetch = fetch) {}
  async session(token: string): Promise<ApiResult<Session>> { return this.request('/v1/session', token, 'GET', undefined, parseSession); }
  async projection(token: string, membershipId: string): Promise<ApiResult<SafeProjection>> {
    return this.request('/v1/administration/setup-projection', token, 'POST', { expectedMembershipId: membershipId, cursor: null, limit: 20 }, parseProjection);
  }
  async createCustomer(token: string, membershipId: string, commandId: string, displayName: string): Promise<ApiResult<true>> {
    return this.request('/v1/administration/customers', token, 'POST', { expectedMembershipId: membershipId, commandId, displayName }, (value) => {
      if (!isRecord(value) || !exact(value, ['status', 'idempotentRetry', 'customer'])
        || value.status !== 'succeeded' || typeof value.idempotentRetry !== 'boolean'
        || !isRecord(value.customer) || !exact(value.customer, ['id', 'displayName', 'active'])
        || !uuid.test(String(value.customer.id)) || typeof value.customer.displayName !== 'string'
        || typeof value.customer.active !== 'boolean') return null;
      return true;
    });
  }
  private async request<Value>(path: string, token: string, method: 'GET' | 'POST', body: object | undefined, parse: (value: unknown) => Value | null): Promise<ApiResult<Value>> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchRequest(path, { method, headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Cache-Control': 'no-store', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit', redirect: 'manual', signal: controller.signal });
      if (response.status === 401 || response.status === 403) return { status: 'rejected' };
      if (response.status !== 200 || response.redirected || !response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return { status: 'unavailable' };
      const length = Number(response.headers.get('content-length') ?? '0'); if (length > 16_384) return { status: 'unavailable' };
      const text = await response.text(); if (new TextEncoder().encode(text).byteLength > 16_384) return { status: 'unavailable' };
      const value = parse(JSON.parse(text)); return value === null ? { status: 'unavailable' } : { status: 'succeeded', value };
    } catch { return { status: 'unavailable' }; } finally { clearTimeout(timeout); }
  }
}

function parseSession(value: unknown): Session | null { if (!isRecord(value) || !exact(value, ['userId', 'membershipId', 'organizationId', 'role']) || !uuid.test(String(value.userId)) || !uuid.test(String(value.membershipId)) || !uuid.test(String(value.organizationId)) || (value.role !== 'administrator' && value.role !== 'employee')) return null; return { membershipId: String(value.membershipId), role: value.role }; }
function parseProjection(value: unknown): SafeProjection | null {
  if (!isRecord(value) || !exact(value, ['status', 'organization', 'customers', 'nfcTags', 'nextCursor']) || value.status !== 'succeeded' || !isRecord(value.organization) || !exact(value.organization, ['id', 'name']) || !uuid.test(String(value.organization.id)) || typeof value.organization.name !== 'string' || !Array.isArray(value.customers) || !Array.isArray(value.nfcTags)) return null;
  const customers = value.customers.map((x) => isRecord(x) && exact(x, ['id', 'displayName', 'active']) && uuid.test(String(x.id)) && typeof x.displayName === 'string' && typeof x.active === 'boolean' ? { id: String(x.id), displayName: x.displayName, active: x.active } : null);
  const tags = value.nfcTags.map((x) => isRecord(x) && exact(x, ['id', 'displayName', 'validationFingerprint', 'assignmentState', 'targetCustomerId']) && uuid.test(String(x.id)) && typeof x.displayName === 'string' && fingerprint.test(String(x.validationFingerprint)) && (x.assignmentState === 'assigned' || x.assignmentState === 'unassigned') && (x.targetCustomerId === null || uuid.test(String(x.targetCustomerId))) ? { id: String(x.id), displayName: x.displayName, validationFingerprint: String(x.validationFingerprint), assignmentState: x.assignmentState, targetCustomerId: x.targetCustomerId === null ? null : String(x.targetCustomerId) } : null);
  if (customers.some((x) => x === null) || tags.some((x) => x === null)) return null;
  return { organization: { id: String(value.organization.id), name: value.organization.name }, customers: customers as SafeProjection['customers'], nfcTags: tags as SafeProjection['nfcTags'] };
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean { return Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
