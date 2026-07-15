import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import { readAdminWebConfiguration } from '../src/runtimeConfiguration';

describe('C3D Admin Web security boundaries', () => {
  it('accepts only an HTTPS Supabase origin and required publishable key', () => {
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'https://example.supabase.co/path?x=1', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
    expect(readAdminWebConfiguration({ VITE_TAPTIME_SUPABASE_URL: 'http://example.supabase.co', VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: 'x'.repeat(20) })).toBeNull();
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
    expect(styles).toContain('@media(max-width:720px)');
    expect(styles).toContain('.grid{grid-template-columns:1fr}');
    expect(styles).toContain('.inline{flex-direction:column}');
  });
});
