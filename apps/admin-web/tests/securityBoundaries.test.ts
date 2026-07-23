import { readFile } from 'node:fs/promises';
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
    await expect(client.session('secret-token')).resolves.toEqual({ status: 'unavailable' });
    expect(calls[0]?.input).toBe('/v1/session');
    expect(calls[0]?.init).toMatchObject({ credentials: 'omit', redirect: 'manual' });
  });

  it('keeps browser UI and state free from canonical NFC capture data', async () => {
    const source = await Promise.all(['../src/App.tsx', '../src/contracts.ts', '../src/AdminWebCoordinator.ts'].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));
    expect(source.join('\n')).not.toMatch(/canonicalPayload|NfcManager|registerTagEvent|nfc:uid/i);
    const auth = await readFile(new URL('../src/SupabaseMemoryAuth.ts', import.meta.url), 'utf8');
    expect(auth).toContain('persistSession: false'); expect(auth).toContain('detectSessionInUrl: false');
  });

  it('retains a narrow mobile layout for the production-rendered setup surface', async () => {
    const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('@media (max-width: 48rem)');
    expect(styles).toContain('@media (max-width: 28rem)');
    expect(styles).toContain('min-width: 20rem');
    expect(styles).toContain('.form-grid { grid-template-columns: 1fr; }');
    expect(styles).toContain(':focus-visible');
    expect(styles).toContain('@media (forced-colors: active)');
  });

  it('keeps control boundaries and keyboard focus indicators above 3:1 non-text contrast', async () => {
    const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('--color-control-border: #657b75');
    expect(styles).toContain('--color-focus: #005fcc');
    expect(styles).toContain('--color-focus-on-dark: #f4d35e');
    expect(styles).toMatch(/\.sidebar :focus-visible \{ outline-color: var\(--color-focus-on-dark\); \}/);
    expect(styles).toMatch(/input, select, textarea \{[\s\S]*border: 1px solid var\(--color-control-border\);/);
    expect(styles).toMatch(/button\.secondary \{[\s\S]*border-color: var\(--color-control-border\);/);
    expect(styles).toMatch(/\.verbatim-reason \{[\s\S]*white-space: pre-wrap;/);

    expect(contrastRatio('#657b75', '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio('#005fcc', '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio('#f4d35e', '#123c36')).toBeGreaterThanOrEqual(3);
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
