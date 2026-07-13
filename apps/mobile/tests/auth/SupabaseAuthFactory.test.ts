import { describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
    startAutoRefresh: vi.fn(),
    stopAutoRefresh: vi.fn(),
  },
  createClient: vi.fn(),
  processLock: vi.fn(),
}));
supabase.createClient.mockReturnValue({ auth: supabase.auth });

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabase.createClient,
  processLock: supabase.processLock,
}));
vi.mock('react-native-url-polyfill/auto', () => ({}));

const { createSupabaseEmailPasswordAuthAdapter } = await import(
  '../../src/auth/SupabaseEmailPasswordAuthAdapter'
);

describe('Supabase auth client composition', () => {
  it('disables provider persistence and delegates refresh lifetime to AppState', () => {
    createSupabaseEmailPasswordAuthAdapter(
      'https://synthetic.supabase.co',
      'sb_publishable_synthetic',
    );

    expect(supabase.createClient).toHaveBeenCalledWith(
      'https://synthetic.supabase.co',
      'sb_publishable_synthetic',
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          lock: supabase.processLock,
          persistSession: false,
        },
      },
    );
  });
});
