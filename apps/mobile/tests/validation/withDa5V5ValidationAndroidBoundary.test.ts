import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  mutateDa5V5ValidationManifest,
  validationDataExtractionXml,
  validationNetworkSecurityXml,
} = require('../../plugins/withDa5V5ValidationAndroidBoundary');

describe('DA5 V5 Validation Android boundary plugin', () => {
  it('keeps only launcher semantics and explicitly removes network permissions', () => {
    const manifest: any = {
      manifest: {
        $: {},
        'uses-permission': [
          { $: { 'android:name': 'android.permission.NFC' } },
          { $: { 'android:name': 'android.permission.INTERNET' } },
          { $: { 'android:name': 'android.permission.ACCESS_NETWORK_STATE' } },
        ],
        application: [{
          $: {
            'android:allowBackup': 'true',
            'android:dataExtractionRules': '@xml/product_rules',
            'android:usesCleartextTraffic': 'true',
          },
          activity: [{
            $: { 'android:name': '.MainActivity' },
            'intent-filter': [
              {
                action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                category: [{
                  $: { 'android:name': 'android.intent.category.LAUNCHER' },
                }],
              },
              {
                action: [{
                  $: { 'android:name': 'android.nfc.action.TECH_DISCOVERED' },
                }],
              },
              {
                action: [{
                  $: { 'android:name': 'android.intent.action.VIEW' },
                }],
                category: [{
                  $: { 'android:name': 'android.intent.category.BROWSABLE' },
                }],
                data: [{ $: { 'android:scheme': 'taptime' } }],
              },
            ],
            'meta-data': [{
              $: {
                'android:name': 'android.nfc.action.TECH_DISCOVERED',
                'android:resource': '@xml/taptime_nfc_tech_filter',
              },
            }],
          }],
        }],
      },
    };

    mutateDa5V5ValidationManifest(manifest);
    const application = manifest.manifest.application[0];
    const activity = application.activity[0];
    expect(activity['intent-filter']).toHaveLength(1);
    expect(JSON.stringify(activity['intent-filter'][0])).toContain(
      'android.intent.action.MAIN',
    );
    expect(activity['meta-data']).toEqual([]);
    expect(application.$).toMatchObject({
      'android:allowBackup': 'false',
      'android:dataExtractionRules':
        '@xml/taptime_da5_v5_validation_data_extraction_rules',
      'android:fullBackupContent': 'false',
      'android:usesCleartextTraffic': 'false',
      'android:networkSecurityConfig':
        '@xml/taptime_da5_v5_validation_network_security',
    });
    const permissions = manifest.manifest['uses-permission'];
    expect(permissions.filter(
      (entry: { $: Record<string, string> }) => (
        entry.$['android:name'] === 'android.permission.NFC'
      ),
    )).toHaveLength(1);
    for (const permission of [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.CHANGE_NETWORK_STATE',
    ]) {
      expect(permissions).toContainEqual({
        $: {
          'android:name': permission,
          'tools:node': 'remove',
        },
      });
    }
    expect(manifest.manifest['uses-feature']).toEqual([{
      $: {
        'android:name': 'android.hardware.nfc',
        'android:required': 'true',
      },
    }]);
  });

  it('defines a deny-all cleartext policy without a domain exception', () => {
    const xml = validationNetworkSecurityXml();
    expect(xml).toContain('cleartextTrafficPermitted="false"');
    expect(xml).not.toContain('<domain');
    expect(xml).not.toContain('127.0.0.1');
  });

  it('excludes every local storage domain from backup and transfer', () => {
    const xml = validationDataExtractionXml();
    expect(xml).toContain('<cloud-backup>');
    expect(xml).toContain('<device-transfer>');
    for (const domain of [
      'database',
      'device_database',
      'device_file',
      'device_root',
      'device_sharedpref',
      'external',
      'file',
      'root',
      'sharedpref',
    ]) {
      expect(xml.match(new RegExp(`domain="${domain}"`, 'gu'))).toHaveLength(2);
    }
  });
});
