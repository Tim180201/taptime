import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AdminWebApiClient } from './AdminWebApiClient';

export type RecoveryPasswordResult = 'succeeded' | 'invalid_link' | 'weak_password'
  | 'rate_limited' | 'unavailable' | 'completion_unconfirmed';

export interface RecoveryPasswordCapability {
  readonly hasRecovery: boolean;
  setPassword(password: string): Promise<RecoveryPasswordResult>;
}

/** A separate, memory-only recovery session, never passed to administration. */
export class SupabaseRecoveryAuth implements RecoveryPasswordCapability {
  readonly hasRecovery: boolean;
  private client: SupabaseClient | null;
  private tokenHash: string | null;
  private verified = false;
  private passwordChanged = false;
  private busy = false;
  private readonly api = new AdminWebApiClient();

  constructor(url: string, publishableKey: string, recoveryUrl: string) {
    this.tokenHash = parseRecoveryToken(recoveryUrl);
    this.hasRecovery = this.tokenHash !== null;
    this.client = this.hasRecovery ? createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }) : null;
  }

  async setPassword(password: string): Promise<RecoveryPasswordResult> {
    if (this.busy) return 'unavailable';
    const client = this.client;
    if (client === null) return 'invalid_link';
    if (!this.passwordChanged && password.length < 8) return 'weak_password';
    this.busy = true;
    try {
      if (!this.verified) {
        if (this.tokenHash === null) return 'invalid_link';
        // A mail prefetch or page load must not consume the one-time token.
        const verification = await client.auth.verifyOtp({
          token_hash: this.tokenHash, type: 'recovery',
        });
        if (verification.error !== null) return mapRecoveryError(verification.error);
        if (verification.data.session === null) return 'invalid_link';
        this.verified = true;
        this.tokenHash = null;
      }
      if (!this.passwordChanged) {
        const update = await client.auth.updateUser({ password });
        if (update.error !== null) return mapRecoveryError(update.error);
        this.passwordChanged = true;
      }
      // Preserve the existing mandatory PasswordResetCompleted audit. Its token stays
      // inside this isolated session. Retrying completion never changes the password again.
      const session = await client.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const audit = typeof accessToken === 'string'
        ? await this.api.recordPasswordReset(accessToken) : null;
      if (audit?.status !== 'succeeded') return 'completion_unconfirmed';
      this.client = null;
      this.verified = false;
      this.passwordChanged = false;
      // Logout failure cannot undo the password change. Nothing persists in storage,
      // and the capability drops its session reference before awaiting logout.
      try { await client.auth.signOut({ scope: 'local' }); } catch { /* memory only */ }
      return 'succeeded';
    } catch {
      // Provider details may contain credentials; only closed results reach the UI.
      return this.passwordChanged ? 'completion_unconfirmed' : 'unavailable';
    } finally {
      this.busy = false;
    }
  }
}

function parseRecoveryToken(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.pathname !== '/passwort-neu' || url.search !== '') return null;
  const parameters = new URLSearchParams(url.hash.slice(1));
  if ([...parameters.keys()].some((key) => key !== 'token_hash' && key !== 'type')
    || parameters.getAll('type').length !== 1 || parameters.get('type') !== 'recovery'
    || parameters.getAll('token_hash').length !== 1) return null;
  const token = parameters.get('token_hash');
  return token !== null && /^[a-zA-Z0-9_-]{32,256}$/.test(token) ? token : null;
}

function mapRecoveryError(error: { readonly code?: string; readonly status?: number }): RecoveryPasswordResult {
  if (error.status === 429) return 'rate_limited';
  switch (error.code) {
    case 'weak_password':
    case 'same_password': return 'weak_password';
    case 'otp_expired':
    case 'invite_not_found':
    case 'session_not_found':
    case 'session_expired':
    case 'bad_jwt': return 'invalid_link';
    default: return 'unavailable';
  }
}
