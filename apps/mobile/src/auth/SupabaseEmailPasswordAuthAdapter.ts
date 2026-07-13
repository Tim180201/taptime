import 'react-native-url-polyfill/auto';
import {
  createClient,
  processLock,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type {
  ProviderAuthEvent,
  ProviderAuthPort,
  ProviderRefreshResult,
  ProviderSessionTokens,
  ProviderSignInResult,
} from './contracts';

type SupabaseAuthClient = Pick<SupabaseClient['auth'],
  | 'onAuthStateChange'
  | 'refreshSession'
  | 'signInWithPassword'
  | 'signOut'
  | 'startAutoRefresh'
  | 'stopAutoRefresh'>;

export class SupabaseEmailPasswordAuthAdapter implements ProviderAuthPort {
  constructor(private readonly auth: SupabaseAuthClient) {}

  async signInWithPassword(email: string, password: string): Promise<ProviderSignInResult> {
    const { data, error } = await this.auth.signInWithPassword({ email, password });
    if (error !== null) {
      if (error.code === 'invalid_credentials') {
        return { status: 'invalid_credentials' };
      }
      throw new Error('Authentication provider sign-in is unavailable', { cause: error });
    }
    return { status: 'authenticated', tokens: sessionTokens(data.session) };
  }

  async refreshSession(refreshToken: string): Promise<ProviderRefreshResult> {
    const { data, error } = await this.auth.refreshSession({ refresh_token: refreshToken });
    if (error !== null) {
      if (isRefreshRejection(error.code)) {
        return { status: 'rejected' };
      }
      throw new Error('Authentication provider refresh is unavailable', { cause: error });
    }
    return { status: 'refreshed', tokens: sessionTokens(data.session) };
  }

  async signOutLocal(): Promise<void> {
    const { error } = await this.auth.signOut({ scope: 'local' });
    if (error !== null) {
      throw new Error('Authentication provider sign-out is unavailable', { cause: error });
    }
  }

  subscribe(listener: (event: ProviderAuthEvent) => void): () => void {
    const { data } = this.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        listener({ type: 'signed_out' });
      } else if (event === 'TOKEN_REFRESHED' && session !== null) {
        listener({ type: 'token_refreshed', tokens: sessionTokens(session) });
      }
    });
    return () => data.subscription.unsubscribe();
  }

  async startAutoRefresh(): Promise<void> {
    await this.auth.startAutoRefresh();
  }

  async stopAutoRefresh(): Promise<void> {
    await this.auth.stopAutoRefresh();
  }
}

export function createSupabaseEmailPasswordAuthAdapter(
  supabaseUrl: string,
  publishableKey: string,
): SupabaseEmailPasswordAuthAdapter {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: {
      // React Native foreground/background state is controlled once by the C1 composition.
      autoRefreshToken: false,
      detectSessionInUrl: false,
      lock: processLock,
      persistSession: false,
    },
  });
  return new SupabaseEmailPasswordAuthAdapter(client.auth);
}

function sessionTokens(session: Session | null): ProviderSessionTokens {
  if (
    session === null
    || typeof session.access_token !== 'string'
    || session.access_token.length === 0
    || typeof session.refresh_token !== 'string'
    || session.refresh_token.length === 0
  ) {
    throw new Error('Authentication provider returned an incomplete session');
  }
  return { accessToken: session.access_token, refreshToken: session.refresh_token };
}

function isRefreshRejection(code: string | undefined): boolean {
  return code === 'bad_jwt'
    || code === 'invalid_credentials'
    || code === 'no_authorization'
    || code === 'refresh_token_not_found'
    || code === 'refresh_token_already_used'
    || code === 'session_expired'
    || code === 'session_not_found'
    || code === 'unexpected_audience'
    || code === 'user_banned'
    || code === 'user_not_found';
}
