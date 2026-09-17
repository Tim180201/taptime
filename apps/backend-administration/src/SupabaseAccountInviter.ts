import { createHash } from 'node:crypto';

export type AccountInvitationFailure = 'account_creation_not_configured' | 'email_exists'
  | 'membership_exists' | 'former_membership' | 'invitation_delivery_failed'
  | 'invitation_rate_limited' | 'invitation_service_unavailable' | 'invitation_needs_attention'
  | 'invalid_email' | 'command_id_conflict' | 'invalid_request' | 'forbidden' | 'unauthorized';
export type AccountInvitationResult = { readonly status: 'succeeded' | 'succeeded_existing_account'; readonly membershipId: string }
  | { readonly status: AccountInvitationFailure };
export interface AccountInvitationDiagnostic {
  readonly code: 'account_invitation_provider_request' | 'account_invitation_needs_attention';
  readonly correlationId: string;
  readonly organizationId: string;
  readonly administratorMembershipId: string;
  readonly targetAccount: string;
}
export interface AccountInvitationContext {
  readonly correlationId: string;
  readonly organizationId: string;
  readonly administratorMembershipId: string;
  readonly deadlineEpochMilliseconds: number;
}
export type SupabaseInvitationResult = { readonly status: 'invited'; readonly subject: string }
  | { readonly status: 'existing'; readonly subject: string }
  | { readonly status: Exclude<AccountInvitationFailure, 'email_exists'> };

/** The only backend capability allowed to use the service-role credential. */
export class SupabaseAccountInviter {
  readonly issuer: string;
  #key: string;
  #redirectUrl: string;
  #fetch: typeof fetch;
  #diagnostic: (value: AccountInvitationDiagnostic) => void;

  constructor(issuer: string, key: string, redirectUrl: string,
    diagnostic: (value: AccountInvitationDiagnostic) => void, fetchRequest: typeof fetch = fetch) {
    const provider = new URL(issuer);
    const redirect = new URL(redirectUrl);
    if (provider.protocol !== 'https:' || provider.pathname !== '/auth/v1'
      || provider.username || provider.password || provider.search || provider.hash
      || redirect.protocol !== 'https:' || redirect.pathname !== '/willkommen'
      || redirect.username || redirect.password || redirect.search || redirect.hash) {
      throw new Error('Account invitation configuration is invalid');
    }
    this.issuer = provider.toString().replace(/\/$/, '');
    this.#key = key;
    this.#redirectUrl = redirect.toString();
    this.#diagnostic = diagnostic;
    this.#fetch = fetchRequest;
  }

  async invite(email: string, context: AccountInvitationContext): Promise<SupabaseInvitationResult> {
    // Lookup is confined to this business operation. It prevents resending mail to an
    // already enrolled/revoked person and resolves email_exists without guessing.
    let attemptedInvite = false;
    try {
      const existing = await this.findAccount(email, context);
      if (existing.status !== 'not_found') return existing;
      attemptedInvite = true;
      const result = await this.request(`/invite?${new URLSearchParams({ redirect_to: this.#redirectUrl })}`,
        { email }, email, context);
      if (!result.ok) {
        const code = providerFailureCode(result.body);
        if (code === 'email_exists' || code === 'user_already_exists') {
          // The account may have appeared between lookup and invitation. Only our
          // local binding can establish whether it belongs to another organization.
          const raced = await this.findAccount(email, context);
          return raced.status === 'not_found' ? { status: 'invitation_needs_attention' } : raced;
        }
        return { status: mapProviderFailure(result.status, result.body) };
      }
      if (!validUser(result.body, email)) return { status: 'invitation_needs_attention' };
      return { status: 'invited', subject: result.body.id };
    } catch {
      // Never propagate fetch errors, response bodies, credentials or email addresses.
      return { status: attemptedInvite ? 'invitation_needs_attention' : 'invitation_service_unavailable' };
    }
  }

  private async findAccount(email: string, context: AccountInvitationContext): Promise<
    Exclude<SupabaseInvitationResult, { readonly status: 'invited' }> | { readonly status: 'not_found' }
  > {
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ filter: email, page: String(page), per_page: '100' });
      const listed = await this.request(`/admin/users?${query}`, undefined, email, context);
      if (!listed.ok) return { status: mapProviderFailure(listed.status, listed.body) };
      if (!record(listed.body) || !Array.isArray(listed.body.users)) return { status: 'invitation_service_unavailable' };
      const exact = listed.body.users.filter((user: unknown) => record(user)
        && typeof user.email === 'string' && user.email.toLowerCase() === email);
      if (exact.length > 1) return { status: 'invitation_needs_attention' };
      if (exact.length === 1) {
        const user: unknown = exact[0];
        return validUser(user, email) ? { status: 'existing', subject: user.id }
          : { status: 'invitation_service_unavailable' };
      }
      if (listed.body.users.length < 100) return { status: 'not_found' };
    }
  }

  needsAttention(email: string, context: AccountInvitationContext, subject?: string): void {
    this.#diagnostic({ code: 'account_invitation_needs_attention',
      correlationId: context.correlationId, organizationId: context.organizationId,
      administratorMembershipId: context.administratorMembershipId,
      targetAccount: subject ?? emailFingerprint(email) });
  }

  private async request(path: string, body: object | undefined, email: string, context: AccountInvitationContext) {
    const remaining = context.deadlineEpochMilliseconds - Date.now() - 250;
    if (remaining <= 0) throw new Error('Account invitation deadline exceeded');
    // Log BEFORE every use; a failing diagnostic sink prevents the credential use.
    this.#diagnostic({ code: 'account_invitation_provider_request',
      correlationId: context.correlationId, organizationId: context.organizationId,
      administratorMembershipId: context.administratorMembershipId, targetAccount: emailFingerprint(email) });
    const response = await this.#fetch(`${this.issuer}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { apikey: this.#key, Authorization: `Bearer ${this.#key}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(remaining), redirect: 'error',
    });
    // Bound even a malformed provider response. Raw response text never leaves this adapter.
    const reader = response.body?.getReader();
    if (reader === undefined) throw new Error('Account invitation response unavailable');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 1_048_576) { await reader.cancel(); throw new Error('Account invitation response too large'); }
      chunks.push(part.value);
    }
    const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return { ok: response.ok, status: response.status, body: decoded };
  }
}

export function normalizeInvitationEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/.test(email) ? email : null;
}
function emailFingerprint(email: string): string {
  return createHash('sha256').update('taptime:invitation-email:v1\0').update(email).digest('hex');
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validUser(value: unknown, email: string): value is { id: string; email: string } {
  return record(value) && typeof value.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.id)
    && typeof value.email === 'string' && value.email.toLowerCase() === email;
}
function providerFailureCode(body: unknown): unknown {
  return record(body) ? body.code ?? body.error_code : null;
}
function mapProviderFailure(status: number, body: unknown): Exclude<AccountInvitationFailure, 'email_exists'> {
  const code = providerFailureCode(body);
  if (status === 429) return 'invitation_rate_limited';
  switch (code) {
    case 'email_exists':
    case 'user_already_exists': return 'invitation_needs_attention';
    case 'email_address_invalid':
    case 'validation_failed': return 'invalid_email';
    case 'email_address_not_authorized':
    case 'email_provider_disabled': return 'invitation_delivery_failed';
    case 'over_email_send_rate_limit': return 'invitation_rate_limited';
    default: return 'invitation_service_unavailable';
  }
}
