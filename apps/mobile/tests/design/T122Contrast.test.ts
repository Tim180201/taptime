import { expect, it } from 'vitest';
import { mobileThemes } from '../../src/design/tokens';
import { readFile, readdir } from 'node:fs/promises';
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return r! * .2126 + g! * .7152 + b! * .0722;
}
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
it('checks every README 2.1 pair from each palette, including the dark scan disc', () => {
  expect(Object.keys(mobileThemes)).toEqual(['dark', 'light']);
  for (const [theme, { color: c }] of Object.entries(mobileThemes)) {
    for (const fg of ['text', 'textMuted', 'accent', 'notice', 'error'] as const)
      for (const bg of ['ground', 'surface', 'surfaceRaised'] as const)
        expect(contrast(c[fg], c[bg]), `${theme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    for (const bg of ['action', 'notice', 'error'] as const) expect(contrast(c.onAction, c[bg]), `${theme}: onAction on ${bg}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onRunning, c.running)).toBeGreaterThanOrEqual(4.5);
    for (const fg of ['accent', 'notice', 'error', 'textMuted'] as const)
      for (const bg of ['surface', 'surfaceRaised'] as const) expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(3);
    expect(contrast(c.scanAccent, c.scanDisc)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.scanOnResult, c.scanAccent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.scanOnResult, c.scanNotice)).toBeGreaterThanOrEqual(4.5);
  }
});
it('keeps source colors in tokens and makes every colored component consume a theme hook', async () => {
  async function check(dir: URL): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) await check(path);
      else if (/\.tsx?$/.test(entry.name) && entry.name !== 'tokens.ts') {
        const source = await readFile(path, 'utf8');
        expect(source, path.pathname).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i);
        if (/\.tsx$/.test(entry.name)) expect(source, path.pathname).not.toMatch(/import\s*\{\s*mobileTokens\s*\}/);
      }
    }
  }
  await check(new URL('../../src/', import.meta.url));
  const config = JSON.parse(await readFile(new URL('../../app.json', import.meta.url), 'utf8'));
  expect(config.expo.userInterfaceStyle).toBe('automatic');
});
