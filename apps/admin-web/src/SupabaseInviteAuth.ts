import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type InvitePasswordResult = 'succeeded' | 'invalid_invitation' | 'weak_password'
  | 'rate_limited' | 'unavailable';

export interface InvitePasswordCapability {
  readonly hasInvitation: boolean;
  setPassword(password: string): Promise<InvitePasswordResult>;
}

/** A separate, memory-only session: never passed to the administration runtime. */
export class SupabaseInviteAuth implements InvitePasswordCapability {
  readonly hasInvitation: boolean;
  private client: SupabaseClient | null;
  private tokenHash: string | null;
  private verified = false;
  private busy = false;

  constructor(url: string, publishableKey: string, invitationUrl: string) {
    this.tokenHash = parseInviteToken(invitationUrl);
    this.hasInvitation = this.tokenHash !== null;
    this.client = this.hasInvitation ? createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }) : null;
  }

  async setPassword(password: string): Promise<InvitePasswordResult> {
    if (this.busy) return 'unavailable';
    const client = this.client;
    if (client === null) return 'invalid_invitation';
    this.busy = true;
    try {
      if (!this.verified) {
        if (this.tokenHash === null) return 'invalid_invitation';
        // Opening or prefetching the mail must not consume the one-time invitation.
        // Verification happens only when the employee submits their password.
        const verification = await client.auth.verifyOtp({
          token_hash: this.tokenHash, type: 'invite',
        });
        if (verification.error !== null) return mapInviteError(verification.error);
        if (verification.data.session === null) return 'invalid_invitation';
        this.verified = true;
        this.tokenHash = null;
      }
      const update = await client.auth.updateUser({ password });
      if (update.error !== null) return mapInviteError(update.error);
      this.client = null;
      this.verified = false;
      // A failed logout cannot undo a successful password change. No session persists
      // in browser storage, and this capability drops its reference in either case.
      try { await client.auth.signOut({ scope: 'local' }); } catch { /* memory only */ }
      return 'succeeded';
    } catch {
      // Provider messages can contain credentials. Expose only our closed result set.
      return 'unavailable';
    } finally {
      this.busy = false;
    }
  }
}

function parseInviteToken(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.pathname !== '/willkommen' || url.search !== '') return null;
  const parameters = new URLSearchParams(url.hash.slice(1));
  if ([...parameters.keys()].some((key) => key !== 'token_hash' && key !== 'type')
    || parameters.getAll('type').length !== 1 || parameters.get('type') !== 'invite'
    || parameters.getAll('token_hash').length !== 1) return null;
  const token = parameters.get('token_hash');
  return token !== null && /^[a-zA-Z0-9_-]{32,256}$/.test(token) ? token : null;
}

function mapInviteError(error: { readonly code?: string; readonly status?: number }): InvitePasswordResult {
  if (error.status === 429) return 'rate_limited';
  switch (error.code) {
    case 'weak_password':
    case 'same_password': return 'weak_password';
    case 'otp_expired':
    case 'invite_not_found':
    case 'session_not_found':
    case 'session_expired':
    case 'bad_jwt': return 'invalid_invitation';
    default: return 'unavailable';
  }
}
