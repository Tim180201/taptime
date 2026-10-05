import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
it('T-096 declares iPhone NFC as a required capability',()=>{
  const config=createRequire(import.meta.url)('../../app.config.js');
  expect(config.ios.supportsTablet).toBe(false);
  expect(config.ios.infoPlist.UIRequiredDeviceCapabilities).toContain('nfc');
});
