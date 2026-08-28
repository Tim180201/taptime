import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { presentBuildIdentity } from '../../src/runtime/buildIdentity';

describe('build identity', () => {
  it('shows the short commit while preserving the complete accessible identity', () => {
    const commit = '5e461f581b8e4cba7ec11168b15a76d40c615a9b';
    expect(presentBuildIdentity(commit)).toEqual({
      text: 'App-Stand: 5e461f5',
      accessibilityLabel: `App-Stand: Commit ${commit}`,
    });
  });

  it.each([undefined, null, '', '5e461f5', 'z'.repeat(40)])(
    'does not present invalid provenance %s as a commit',
    (value) => {
      expect(presentBuildIdentity(value)).toEqual({
        text: 'App-Stand: nicht verfügbar',
        accessibilityLabel: 'App-Stand ist nicht verfügbar',
      });
    },
  );

  it('is visible before sign-in, during normal use, and on configuration failure', async () => {
    const [login, synchronization, product] = await Promise.all([
      '../../src/screens/LoginScreen.tsx',
      '../../src/screens/SynchronizationScreen.tsx',
      '../../src/ProductMobileApp.tsx',
    ].map((path) => readFile(fileURLToPath(new URL(path, import.meta.url)), 'utf8')));
    expect(login).toContain('<AppBuildIdentity');
    expect(synchronization).toContain('<AppBuildIdentity');
    expect(product.match(/<AppBuildIdentity/gu)).toHaveLength(2);
  });
});
