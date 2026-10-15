import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import { readAdminWebConfiguration } from '../src/runtimeConfiguration';

describe('C3D Admin Web security boundaries', () => {
  it('accepts only an HTTPS Supabase origin or the exact numeric HTTP loopback harness origin', () => {
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'https://example.supabase.co/path?x=1', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://example.supabase.co', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://localhost:54321', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.0.0.2:54321', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.1:54321', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://2130706433:54321', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://[::1]:54321', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.0.0.1:54322', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://user:secret@127.0.0.1:54321', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.0.0.1:54321/path', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.0.0.1:54321?query=1', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.0.0.1:54321#fragment', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'short' })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toEqual({ supabaseUrl: 'http://127.0.0.1:54321', supabasePublishableKey: 'x'.repeat(20) });
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://127.0.0.1:54321/', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toEqual({ supabaseUrl: 'http://127.0.0.1:54321', supabasePublishableKey: 'x'.repeat(20) });
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'https://example.supabase.co', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toEqual({ supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'x'.repeat(20) });
  });

  it('uses same-origin routes, omits credentials, and rejects over-broad session JSON', async () => {
    const calls: Array<{ readonly input: RequestInfo | URL; readonly init?: RequestInit }> = [];
    const fetchRequest: typeof fetch = async (input, init) => { calls.push({ input, init }); return new Response(JSON.stringify({ userId: '10000000-0000-4000-8000-000000000001', membershipId: '20000000-0000-4000-8000-000000000001', organizationId: '30000000-0000-4000-8000-000000000001', role: 'administrator', tenantSelector: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    const client = new AdminWebApiClient(fetchRequest);
    await expect(client.session('secret-token')).resolves.toEqual({ status: 'invalid_response' });
    expect(calls[0]?.input).toBe('/v2/session');
    expect(calls[0]?.init).toMatchObject({ credentials: 'omit', redirect: 'manual' });
  });

  it('keeps browser UI and state free from canonical NFC capture data', async () => {
    const viewFiles=await readdir(new URL('../src/views/',import.meta.url));
    const source = await Promise.all(['../src/App.tsx', '../src/contracts.ts', '../src/AdminWebCoordinator.ts',...viewFiles.map(file=>'../src/views/'+file)].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
    expect(source.join('\n')).not.toMatch(/canonicalPayload|NfcManager|registerTagEvent|nfc:uid/i);
    const auth = await readFile(new URL('../src/SupabaseMemoryAuth.ts', import.meta.url), 'utf8');
    expect(auth).toContain('persistSession: false'); expect(auth).toContain('detectSessionInUrl: false');
  });

  it('retains a narrow mobile layout for the production-rendered setup surface', async () => {
    const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('@media (max-width: 48rem)');
    expect(styles).toContain('@media (max-width: 1023px)');
    expect(styles).toContain('min-width: 0');
    expect(styles).toContain('grid-template-columns: minmax(0,1fr)');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('@media (forced-colors: active)');
  });

  // D-140 contrast and literal-color coverage now reads both palettes and the
  // exact README pairs in T122Themes; this retains the control/focus wiring check.
  it('uses semantic focus and control border colors', async () => {
    const styles=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');
    expect(styles).toContain('outline: 3px solid var(--color-accent)');
    expect(styles).toContain('border: 1px solid var(--color-text-muted)');
    expect(styles).toContain('white-space: pre-wrap');
    expect(styles.replace(/--[a-z-]+:\s*#[0-9a-f]{3,8};/gi,'')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it('bundles Manrope locally, embeds navigation icons, and defines black-on-white print', async () => {
    const [app, styles, packageJson] = await Promise.all([
      readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ]);
    for(const font of ['400Regular','600SemiBold','800ExtraBold','jetbrains-mono-400.ttf','jetbrains-mono-500.ttf'])expect(styles).toContain(font);
    expect(styles).toContain('@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf');
    expect(JSON.parse(packageJson).dependencies['@expo-google-fonts/manrope']).toBe('^0.4.2');
    expect(app).toContain("className: 'section-icon'");
    expect(app).not.toMatch(/<img|<use|href=.*\.svg|https?:\/\//i);
    expect(styles).toMatch(/@media print \{[\s\S]*color: var\(--color-print-text\) !important;/);
    expect(styles).toMatch(/@media print \{[\s\S]*background: var\(--color-print-ground\) !important;/);
    expect(styles).toMatch(/@media print \{[\s\S]*background-image: none !important;/);
  });

  it('keeps table headings and the name column fixed while the table scrolls', async () => {
    const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(styles).toMatch(/th \{[\s\S]*position: sticky;[\s\S]*top: 0;/);
    expect(styles).toMatch(/th:first-child, td:first-child \{[\s\S]*position: sticky;[\s\S]*left: 0;/);
    expect(styles).toMatch(/\.table-scroll \{[\s\S]*overflow: auto;/);
  });
});

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}
