export type AdminWebConfiguration = { readonly supabaseUrl: string; readonly supabasePublishableKey: string };
export function readAdminWebConfiguration(env: Record<string, unknown>): AdminWebConfiguration | null {
  const url = env.VITE_TAPTIME_SUPABASE_URL;
  const key = env.VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || typeof key !== 'string' || key.length < 20) return null;
  try {
    const parsed = new URL(url);
    const isSecureOrigin = parsed.protocol === 'https:';
    const localHarnessOrigin = 'http://127.0.0.1:54321';
    const isLocalHarnessOrigin = parsed.origin === localHarnessOrigin && (url === localHarnessOrigin || url === `${localHarnessOrigin}/`);
    if ((!isSecureOrigin && !isLocalHarnessOrigin) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return Object.freeze({ supabaseUrl: parsed.origin, supabasePublishableKey: key });
  } catch { return null; }
}
