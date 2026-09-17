import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AdminWebSignInOutcome } from './AdminWebCoordinator';

interface RecoveryLocationAdapter {
  readonly recoveryUrl?: () => string;
  readonly clearRecoveryUrl?: () => void;
}

interface RecoveryTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export class SupabaseMemoryAuth {
  private readonly client: SupabaseClient;
  private recoveryReady = false;
  private readonly recoveryListeners = new Set<() => void>();
  constructor(url: string, publishableKey: string, locationAdapter: RecoveryLocationAdapter = {}) {
    this.client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });
    const recoveryUrl = locationAdapter.recoveryUrl?.()
      ?? (typeof window === 'undefined' ? '' : window.location.href);
    const tokens = parseRecoveryTokens(recoveryUrl);
    if (tokens !== null) {
      (locationAdapter.clearRecoveryUrl ?? clearBrowserRecoveryUrl)();
      void this.activateRecovery(tokens);
    }
  }
  async signIn(email: string, password: string): Promise<AdminWebSignInOutcome> {
    let result: Awaited<ReturnType<SupabaseClient['auth']['signInWithPassword']>>;
    try {
      result = await this.client.auth.signInWithPassword({ email, password });
    } catch {
      // The SDK throws only before a response exists (aborted fetch, broken client).
      return 'service_unavailable';
    }
    if (result.error === null) {
      return result.data.session !== null ? 'signed_in' : 'service_unavailable';
    }
    return classifySignInError(result.error);
  }
  async withAccessToken<Value>(operation: (accessToken: string) => Promise<Value>): Promise<Value | null> {
    const result = await this.client.auth.getSession();
    const token = result.data.session?.access_token;
    return typeof token === 'string' ? operation(token) : null;
  }
  async signOut(): Promise<void> {
    this.recoveryReady = false;
    await this.client.auth.signOut({ scope: 'local' });
  }
  async requestPasswordReset(email: string): Promise<boolean> {
    const result = await this.client.auth.resetPasswordForEmail(email);
    return result.error === null;
  }
  async updateRecoveredPassword(password: string): Promise<boolean> {
    if (!this.recoveryReady) return false;
    const result = await this.client.auth.updateUser({ password });
    if (result.error !== null) return false;
    return true;
  }
  subscribePasswordRecovery(listener: () => void): () => void {
    this.recoveryListeners.add(listener);
    if (this.recoveryReady) queueMicrotask(listener);
    return () => this.recoveryListeners.delete(listener);
  }
  private async activateRecovery(tokens: RecoveryTokens): Promise<void> {
    const result = await this.client.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    if (result.error !== null || result.data.session === null) return;
    this.recoveryReady = true;
    for (const listener of this.recoveryListeners) listener();
  }
}

function parseRecoveryTokens(value: string): RecoveryTokens | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.hash.length < 2) return null;
  const parameters = new URLSearchParams(url.hash.slice(1));
  const allowed = new Set(['access_token', 'expires_at', 'expires_in', 'refresh_token', 'token_type', 'type']);
  if ([...parameters.keys()].some((key) => !allowed.has(key))) return null;
  for (const key of allowed) if (parameters.getAll(key).length > 1) return null;
  const accessToken = parameters.get('access_token');
  const refreshToken = parameters.get('refresh_token');
  if (
    parameters.get('type') !== 'recovery'
    || typeof accessToken !== 'string' || accessToken.length < 16
    || typeof refreshToken !== 'string' || refreshToken.length < 16
  ) return null;
  return { accessToken, refreshToken };
}

function clearBrowserRecoveryUrl(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

// T-040: an outage must never read as a wrong password. Only a code that names the user's
// input may blame the user. Every other answer — a disabled provider, a rejected API key, an
// unknown code, no response at all — is reported as "your inputs were not checked", because
// that is the only honest statement then. Review round 2 caught 422 email_provider_disabled
// reading as wrong credentials; the status alone is never evidence against the user.
function classifySignInError(error: { readonly status?: number; readonly code?: string }): Exclude<AdminWebSignInOutcome, 'signed_in'> {
  switch (error.code) {
    case 'invalid_credentials':
    case 'validation_failed':
    case 'email_address_invalid':
      return 'credentials_rejected';
    case 'email_not_confirmed': return 'email_not_confirmed';
    case 'user_banned': return 'access_blocked';
    case 'over_request_rate_limit': return 'rate_limited';
    default: break;
  }
  if (error.status === 429) return 'rate_limited';
  // A bare 400 without a code is the pre-error-code API shape for rejected credentials.
  if (error.status === 400 && error.code === undefined) return 'credentials_rejected';
  return 'service_unavailable';
}
