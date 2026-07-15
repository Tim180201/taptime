import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.createClient }));

import { SupabaseMemoryAuth } from '../src/SupabaseMemoryAuth';

describe('SupabaseMemoryAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.createClient.mockReturnValue({
      auth: {
        signInWithPassword: sdk.signInWithPassword,
        getSession: sdk.getSession,
        signOut: sdk.signOut,
      },
    });
    sdk.signInWithPassword.mockResolvedValue({ error: null, data: { session: { access_token: 'memory-token' } } });
    sdk.getSession.mockResolvedValue({ data: { session: { access_token: 'memory-token' } } });
    sdk.signOut.mockResolvedValue({ error: null });
  });

  it('constructs Supabase with memory-only auth and no URL session detection', () => {
    new SupabaseMemoryAuth('https://example.supabase.co', 'publishable-key');

    expect(sdk.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } },
    );
  });

  it('keeps token access callback-scoped and signs out only the local browser session', async () => {
    const auth = new SupabaseMemoryAuth('https://example.supabase.co', 'publishable-key');

    await expect(auth.signIn('administrator@example.test', 'secret')).resolves.toBe(true);
    await expect(auth.withAccessToken(async (token) => `used:${token}`)).resolves.toBe('used:memory-token');
    await auth.signOut();

    expect(sdk.signInWithPassword).toHaveBeenCalledWith({ email: 'administrator@example.test', password: 'secret' });
    expect(sdk.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
