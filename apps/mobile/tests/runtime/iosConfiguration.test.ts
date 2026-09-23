import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../../app.json').expo;
const eas = require('../../eas.json');

describe('T-072 iOS configuration', () => {
  it('uses the chosen bundle ID and a TestFlight store profile without changing Android distribution', () => {
    expect(config.ios.bundleIdentifier).toBe(config.android.package);
    expect(config.ios.bundleIdentifier).toBe('com.tim180201.mobile');
    expect(eas.build['production-validation'].ios).toMatchObject({ distribution: 'store', simulator: false });
    expect(eas.build['production-validation'].distribution).toBe('internal');
    expect(eas.build['production-validation'].android).toEqual({ buildType: 'apk' });
  });
  it('generates TAG permission and German purpose text for the tag-reader path', async () => {
    const [, options] = config.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'react-native-nfc-manager');
    const plugin = require('react-native-nfc-manager/app.plugin.js');
    const result = plugin({ name: 'NFC test', slug: 'nfc-test' }, options);
    const entitlements = await result.mods.ios.entitlements({ ...result, modRequest: {}, modResults: {} });
    expect(entitlements.modResults['com.apple.developer.nfc.readersession.formats']).toEqual(['TAG']);
    const plist = await result.mods.ios.infoPlist({ ...result, modRequest: {}, modResults: {} });
    expect(plist.modResults.NFCReaderUsageDescription).toBe('Taptura liest NFC-Tags zur Zeiterfassung und beschreibt sie beim Zuordnen.');
    expect(plist.modResults['com.apple.developer.nfc.readersession.iso7816.select-identifiers']).toBeUndefined();
    expect(plist.modResults['com.apple.developer.nfc.readersession.felica.systemcodes']).toBeUndefined();
  });
  it('includes the same SystemBootTime declaration in the app and native pod manifests', () => {
    const manifest = require('@expo/plist').default.parse(readFileSync(new URL('../../modules/taptime-monotonic-clock/ios/PrivacyInfo.xcprivacy', import.meta.url), 'utf8'));
    expect(config.ios.privacyManifests.NSPrivacyAccessedAPITypes).toContainEqual(manifest.NSPrivacyAccessedAPITypes[0]);
    expect(manifest.NSPrivacyAccessedAPITypes[0]).toEqual({
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
      NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
    });
  });
});
