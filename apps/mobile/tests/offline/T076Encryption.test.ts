import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('T-076 iOS encryption declaration', () => {
  it('declares operating-system encryption to the iOS prebuild', () => {
    const config = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'));
    expect(config.expo.ios.config?.usesNonExemptEncryption).toBe(false);
  });
});
