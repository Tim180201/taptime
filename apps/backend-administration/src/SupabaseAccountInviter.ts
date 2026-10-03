import { createHash } from 'node:crypto';

export type AccountInvitationFailure = 'account_creation_not_configured' | 'email_unavailable'
  | 'membership_exists' | 'former_membership' | 'invitation_delivery_failed'
  | 'invitation_rate_limited' | 'invitation_service_unavailable' | 'invitation_needs_attention'
  | 'invalid_email' | 'command_id_conflict' | 'invalid_request' | 'forbidden' | 'unauthorized';
export type AccountInvitationResult = { readonly status: 'succeeded' | 'succeeded_existing_account'; readonly membershipId: string }
  | { readonly status: AccountInvitationFailure };
export interface AccountInvitationDiagnostic {
  readonly code: 'account_invitation_provider_request' | 'account_invitation_needs_attention';
  readonly correlationId: string;
  readonly organizationId?: string;
  readonly administratorMembershipId?: string;
  readonly operatorId?: string;
  readonly targetAccount?: string;
  readonly reason?: 'other_organization' | 'outside_management_scope' | 'account_not_invited' | 'identity_unavailable' | 'settings_unsafe' | 'settings_unavailable';
}
export interface AccountInvitationContext {
  readonly correlationId: string;
  readonly organizationId?: string;
  readonly administratorMembershipId?: string;
  readonly operatorId?: string;
  readonly deadlineEpochMilliseconds: number;
}
export type SupabaseInvitationResult = { readonly status: 'invited'; readonly subject: string }
  | { readonly status: 'existing'; readonly subject: string; readonly wasInvited: boolean }
  | { readonly status: Exclude<AccountInvitationFailure, 'email_exists'> };

/** The only backend capability allowed to use the service-role credential. */
export class SupabaseAccountInviter {
  readonly issuer: string;
  #key: string;
  #redirectUrl: string;
  #fetch: typeof fetch;
  #diagnostic: (value: AccountInvitationDiagnostic) => void;

  constructor(issuer: string, key: string, redirectUrl: string,
    diagnostic: (value: AccountInvitationDiagnostic) => void, fetchRequest: typeof fetch = fetch, private readonly publicKey?: string) {
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
      if (!await this.checkSettings(context)) return { status: 'account_creation_not_configured' };
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
    // Provider filtering is not Unicode-normalization aware. Enumerate bounded pages
    // and compare locally so legacy NFD accounts and duplicates cannot be missed.
    let match: {id:string;email:string;invited_at?:unknown} | undefined;
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({page:String(page),per_page:'100'});
      const listed = await this.request(`/admin/users?${query}`,undefined,email,context);
      if (!listed.ok) return {status:mapProviderFailure(listed.status,listed.body)};
      if (!record(listed.body) || !Array.isArray(listed.body.users)) return {status:'invitation_service_unavailable'};
      for (const user of listed.body.users) {
        if (!record(user) || typeof user.email!=='string' || normalizeInvitationEmail(user.email)!==email) continue;
        if (match) return {status:'invitation_needs_attention'};
        if (!validUser(user,email)) return {status:'invitation_service_unavailable'};
        match=user;
      }
      if (listed.body.users.length<100) return match ? {status:'existing',subject:match.id,
        wasInvited:typeof match.invited_at==='string' && Number.isFinite(Date.parse(match.invited_at))} : {status:'not_found'};
    }
  }

  needsAttention(email: string, context: AccountInvitationContext, subject?: string): void {
    this.#diagnostic({ code: 'account_invitation_needs_attention',
      correlationId: context.correlationId, organizationId: context.organizationId,
      administratorMembershipId: context.administratorMembershipId,
      ...(context.operatorId === undefined ? {} : { operatorId: context.operatorId }),
      ...(subject === undefined ? {} : { targetAccount: subject }) });
  }

  async resend(subject: string, context: AccountInvitationContext): Promise<{status: string}> {
    let attempted = false;
    try {
      if (!await this.checkSettings(context)) return {status:'account_creation_not_configured'};
      const account = await this.request(`/admin/users/${encodeURIComponent(subject)}`, undefined, '', context);
      const user = account.body;
      if (!account.ok || !record(user) || user.id !== subject || typeof user.email !== 'string'
        || normalizeInvitationEmail(user.email) === null) return {status:'invitation_needs_attention'};
      if (user.email_confirmed_at != null || user.last_sign_in_at != null) return {status:'invitation_already_accepted'};
      if (typeof user.invited_at !== 'string'
        || !Number.isFinite(Date.parse(user.invited_at))) return {status:'invitation_needs_attention'};
      attempted = true;
      const result = await this.request(`/invite?${new URLSearchParams({redirect_to:this.#redirectUrl})}`,
        {email:user.email}, '', context);
      if (!result.ok) return {status: providerFailureCode(result.body) === 'email_exists'
        ? 'invitation_already_accepted' : mapProviderFailure(result.status,result.body)};
      if (!validUser(result.body, normalizeInvitationEmail(user.email)!) || result.body.id !== subject)
        return {status:'invitation_needs_attention'};
      return {status:'succeeded'};
    } catch { return {status:attempted?'invitation_needs_attention':'invitation_service_unavailable'}; }
  }

  diagnose(context: AccountInvitationContext, reason: NonNullable<AccountInvitationDiagnostic['reason']>, subject?: string): void {
    this.#diagnostic({ code: 'account_invitation_needs_attention', correlationId: context.correlationId,
      reason, ...(subject === undefined ? {} : { targetAccount: subject }) });
  }

  async checkSettings(context: AccountInvitationContext): Promise<boolean> {
    try {
      if (!this.publicKey) throw new Error('Public key unavailable');
      const remaining = context.deadlineEpochMilliseconds - Date.now() - 250;
      if (remaining <= 0) throw new Error('Deadline exceeded');
      const response = await this.#fetch(`${this.issuer}/settings`, {
        headers: { apikey: this.publicKey }, redirect: 'error', signal: AbortSignal.timeout(remaining),
      });
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Settings body unavailable');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 65_536) { await reader.cancel(); throw new Error('Settings body too large'); }
        chunks.push(part.value);
      }
      const settings: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!response.ok || !record(settings) || typeof settings.disable_signup !== 'boolean'
        || typeof settings.mailer_autoconfirm !== 'boolean') throw new Error('Invalid settings');
      if (settings.disable_signup && !settings.mailer_autoconfirm) return true;
      this.diagnose(context, 'settings_unsafe');
    } catch { this.diagnose(context, 'settings_unavailable'); }
    return false;
  }

  private async request(path: string, body: object | undefined, email: string, context: AccountInvitationContext) {
    const remaining = context.deadlineEpochMilliseconds - Date.now() - 250;
    if (remaining <= 0) throw new Error('Account invitation deadline exceeded');
    // Log BEFORE every use; a failing diagnostic sink prevents the credential use.
    this.#diagnostic({ code: 'account_invitation_provider_request',
      correlationId: context.correlationId, organizationId: context.organizationId,
      administratorMembershipId: context.administratorMembershipId,
      ...(context.operatorId === undefined ? {} : { operatorId: context.operatorId }) });
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
  const email = value.trim().normalize('NFC').toLowerCase();
  return email.length <= 254 && /^[^\s@<>\x00-\x1f\x7f]+@[^\s@<>\x00-\x1f\x7f]+\.[^\s@<>\x00-\x1f\x7f]+$/.test(email) ? email : null;
}
/** Both account-creation paths must lock the same normalized email in PostgreSQL. */
export function accountInvitationEmailHash(normalizedEmail: string): Buffer {
  return createHash('sha256').update(normalizedEmail.trim().normalize('NFC').toLowerCase()).digest();
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validUser(value: unknown, email: string): value is { id: string; email: string; invited_at?: unknown } {
  return record(value) && typeof value.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.id)
    && typeof value.email === 'string' && normalizeInvitationEmail(value.email) === email;
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
