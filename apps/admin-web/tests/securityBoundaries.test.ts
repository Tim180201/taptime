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
    expect(calls[0]?.input).toBe('/v2/session');
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

  it('keeps every text/background pair readable and control focus above 3:1', async () => {
    const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('--color-text-muted: #97A5A0');
    expect(styles).toContain('--color-focus: #7EE0C0');
    expect(styles).toMatch(/:focus-visible \{[\s\S]*outline: 3px solid var\(--color-focus\);/);
    expect(styles).toMatch(/input, select, textarea \{[\s\S]*border: 1px solid var\(--color-text-muted\);/);
    expect(styles).toMatch(/button\.secondary, \.secondary-link \{[\s\S]*border-color: var\(--color-text-muted\);/);
    expect(styles).toMatch(/\.verbatim-reason \{[\s\S]*white-space: pre-wrap;/);

    const darkBackgrounds = ['#0E1512', '#141C19', '#1A2320'] as const;
    const textOnDark = ['#F2F5F4', '#97A5A0', '#7EE0C0', '#C9F24D', '#E0A44C'] as const;
    for (const foreground of textOnDark) {
      for (const background of darkBackgrounds) {
        expect(contrastRatio(foreground, background), `${foreground} on ${background}`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }

    for (const background of ['#7EE0C0', '#C9F24D', '#E0A44C'] as const) {
      expect(contrastRatio('#0E1512', background), `#0E1512 on ${background}`)
        .toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio('#000000', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);

    expect(contrastRatio('#97A5A0', '#1A2320')).toBeGreaterThanOrEqual(3);
    for (const background of darkBackgrounds) {
      expect(contrastRatio('#7EE0C0', background), `focus on ${background}`)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every color literal inside the named raster definition', async () => {
    const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
    const root = styles.match(/^:root \{[\s\S]*?\n\}/)?.[0];
    expect(root).toBeDefined();
    const namedColors = root?.match(/--color-[a-z-]+:\s*#[0-9A-F]{6};/g) ?? [];
    expect(namedColors).toEqual([
      '--color-ground: #0E1512;',
      '--color-surface: #141C19;',
      '--color-surface-raised: #1A2320;',
      '--color-line: #24302C;',
      '--color-text: #F2F5F4;',
      '--color-text-muted: #97A5A0;',
      '--color-accent: #7EE0C0;',
      '--color-on-accent: #0E1512;',
      '--color-call-to-action: #C9F24D;',
      '--color-notice: #E0A44C;',
      '--color-focus: #7EE0C0;',
      '--color-print-ground: #FFFFFF;',
      '--color-print-text: #000000;',
    ]);
    const implementation = styles.replace(root!, '');
    expect(implementation).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });

  it('bundles Inter locally, embeds navigation icons, and defines black-on-white print', async () => {
    const [app, styles, packageJson] = await Promise.all([
      readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
      readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ]);
    expect(app.match(/@fontsource\/inter\/latin-(400|600|700)\.css/g)).toHaveLength(3);
    expect(JSON.parse(packageJson).dependencies['@fontsource/inter']).toBe('5.3.0');
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
