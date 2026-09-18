import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('T-061 device polish — red proofs', () => {
  it('(a) draws every design icon with licensed SVG paths, never View strokes', async () => {
    const icon = await source('src/design/LineIcon.tsx');
    expect(icon).toContain("from 'react-native-svg'");
    expect(icon).toContain('Lucide');
    expect(icon).toContain('ISC');
    expect(icon).toContain('viewBox="0 0 24 24"');
    expect(icon).toContain('strokeWidth={1.75}');
    expect(icon).toContain('strokeLinecap="round"');
    expect(icon).toContain('strokeLinejoin="round"');
    for (const file of await readdir(new URL('../../src/design/', import.meta.url))) {
      if (!/Icon.*\.tsx?$/.test(file)) continue;
      const content = await source(`src/design/${file}`);
      expect(content, file).not.toMatch(/<View\b|\bViewStyle\b|border(?:Top|Bottom|Left|Right)?Width/);
    }
    for (const name of ['capture', 'manual', 'times', 'employees', 'setup', 'back', 'check', 'pending', 'person', 'arrow']) {
      expect(icon, name).toMatch(new RegExp(`\\b${name}:`));
    }
    expect(await source('src/design/LUCIDE-LICENSE')).toContain('Permission');
  });

  it('(b) takes header and tab clearances from device insets, keeping system bars visible', async () => {
    const app = await source('App.tsx');
    const navigation = await source('src/navigation/AppNavigator.tsx');
    expect(app).toContain('<SafeAreaProvider');
    expect(app).toContain('hidden={false}');
    expect(navigation).toContain('useSafeAreaInsets()');
    expect(navigation).toMatch(/paddingTop:\s*insets\.top/);
    expect(navigation).toMatch(/paddingBottom:\s*insets\.bottom/);
    expect(navigation).toContain('insets.left');
    expect(navigation).toContain('insets.right');
    expect(navigation).not.toMatch(/Platform\.OS|paddingTop:\s*(32|48)\b/);
  });

  it('(c) uses ring B and resets/stops all motion before the reduced-motion branch', async () => {
    const ring = await source('src/design/ScanRing.tsx');
    expect(ring).toContain('0.94');
    expect(ring).toContain('1.10');
    expect(ring).toContain('duration: 1000');
    expect(ring).toContain('Animated.delay(650)');
    expect(ring).toContain('borderWidth: 2');
    expect(ring).toContain('styles.glow');
    expect(ring).toContain('value.stopAnimation()');
    expect(ring).toContain('if (reducedMotion) return');
  });
});
