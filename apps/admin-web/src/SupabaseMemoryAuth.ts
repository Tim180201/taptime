import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class SupabaseMemoryAuth {
  private readonly client: SupabaseClient;
  constructor(url: string, publishableKey: string) {
    this.client = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });
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
  async signOut(): Promise<void> { await this.client.auth.signOut({ scope: 'local' }); }
}
