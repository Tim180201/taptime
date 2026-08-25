import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
  async signIn(email: string, password: string): Promise<boolean> {
    const result = await this.client.auth.signInWithPassword({ email, password });
    return result.error === null && result.data.session !== null;
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
