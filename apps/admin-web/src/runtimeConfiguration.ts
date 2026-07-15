export type AdminWebConfiguration = { readonly supabaseUrl: string; readonly supabasePublishableKey: string };
export function readAdminWebConfiguration(env: Record<string, unknown>): AdminWebConfiguration | null {
  const url = env.VITE_TAPTIME_SUPABASE_URL;
  const key = env.VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || typeof key !== 'string' || key.length < 20) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return Object.freeze({ supabaseUrl: parsed.origin, supabasePublishableKey: key });
  } catch { return null; }
}
