import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { resolveControlVisualState } from '../../src/design/controlState';
import { mobileTokens } from '../../src/design/tokens';

describe('mobile color and control raster', () => {
  it('uses the binding dark raster and keeps every source color in its named definition', async () => {
    expect(mobileTokens.color).toMatchObject({
      ground: '#0E1512',
      surface: '#141C19',
      surfaceRaised: '#1A2320',
      line: '#24302C',
      text: '#F2F5F4',
      textMuted: '#97A5A0',
      accent: '#7EE0C0',
      onAccent: '#0E1512',
      callToAction: '#C9F24D',
      notice: '#E0A44C',
      focus: '#7EE0C0',
    });
    const sourceRoot = new URL('../../src/', import.meta.url);
    const sources = await readSourceFiles(sourceRoot);
    for (const [path, source] of sources) {
      // The frozen development demo and isolated hardware-validation compositions are not
      // product surfaces; their executable identity is guarded independently.
      if (/\/src\/(?:demo|validation)\//u.test(path)) continue;
      if (path.endsWith('/design/tokens.ts')) continue;
      expect(source, path).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    }
  });

  it('asks Android for vibration and selects the dark system surface', async () => {
    const configuration = JSON.parse(await readFile(
      new URL('../../app.json', import.meta.url),
      'utf8',
    ));
    expect(configuration.expo.userInterfaceStyle).toBe('dark');
    expect(configuration.expo.android.permissions).toEqual([
      'android.permission.NFC',
      'android.permission.VIBRATE',
    ]);
  });

  it('keeps all raster text combinations readable and the focus ring above 3:1', () => {
    const backgrounds = [
      mobileTokens.color.ground,
      mobileTokens.color.surface,
      mobileTokens.color.surfaceRaised,
    ];
    for (const foreground of [
      mobileTokens.color.text,
      mobileTokens.color.textMuted,
      mobileTokens.color.accent,
      mobileTokens.color.callToAction,
      mobileTokens.color.notice,
    ]) {
      for (const background of backgrounds) {
        expect(contrastRatio(foreground, background), `${foreground} on ${background}`)
          .toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const background of backgrounds) {
      expect(contrastRatio(mobileTokens.color.focus, background))
        .toBeGreaterThanOrEqual(3);
    }
  });

  it('defines all six control states with deterministic precedence', () => {
    expect(resolveControlVisualState(state())).toBe('idle');
    expect(resolveControlVisualState(state({ hovered: true }))).toBe('hovered');
    expect(resolveControlVisualState(state({ focused: true }))).toBe('focused');
    expect(resolveControlVisualState(state({ pressed: true }))).toBe('pressed');
    expect(resolveControlVisualState(state({ disabled: true }))).toBe('disabled');
    expect(resolveControlVisualState(state({ loading: true }))).toBe('loading');
    expect(resolveControlVisualState(state({ loading: true, pressed: true }))).toBe('loading');
  });

  it('uses no React Native standard button in product screens and a visible 3 px focus ring',
    async () => {
      const [screenSources, primitives] = await Promise.all([
        readSourceFiles(new URL('../../src/screens/', import.meta.url)),
        readFile(new URL('../../src/design/primitives.tsx', import.meta.url), 'utf8'),
      ]);
      for (const [path, source] of screenSources) {
        expect(source, path).not.toMatch(/\bButton\b/);
      }
      expect(primitives).toContain('outlineWidth: 3');
      expect(primitives).toContain('outlineColor: mobileTokens.color.focus');
    });

  it('keeps scan completion passive and disables breathing motion on system request', async () => {
    const source = await readFile(
      new URL('../../src/screens/ScanScreen.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/\bAlert\b|\bModal\b|title=["'](?:OK|Bestätigen|Schließen)["']/);
    expect(source).toContain('if (reducedMotion) return false');
    expect(source).toContain('progress.stopAnimation()');
    expect(source).toContain("'reduceMotionChanged'");
  });
});

function state(overrides: Partial<Parameters<typeof resolveControlVisualState>[0]> = {}) {
  return {
    hovered: false,
    focused: false,
    pressed: false,
    disabled: false,
    loading: false,
    ...overrides,
  };
}

async function readSourceFiles(root: URL): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), root);
    if (entry.isDirectory()) {
      for (const [path, source] of await readSourceFiles(url)) files.set(path, source);
    } else if (/\.(?:ts|tsx)$/u.test(entry.name)) {
      files.set(url.pathname, await readFile(url, 'utf8'));
    }
  }
  return files;
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => (
    Number.parseInt(hex.slice(index, index + 2), 16) / 255
  ));
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}
