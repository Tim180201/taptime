const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const resourceName = 'taptime_synthetic_e2e_network_security_config';

/**
 * Test-only Android transport policy. The synthetic product variant reaches host-loopback through
 * adb reverse; every non-loopback cleartext destination remains denied by this native policy.
 */
module.exports = function withSyntheticE2eNetworkSecurity(config) {
  const withManifest = withAndroidManifest(config, (manifestConfig) => {
    const application = manifestConfig.modResults.manifest.application?.[0];
    if (application === undefined) {
      throw new Error('Synthetic E2E Android application manifest is unavailable');
    }
    application.$['android:usesCleartextTraffic'] = 'false';
    application.$['android:networkSecurityConfig'] = `@xml/${resourceName}`;
    return manifestConfig;
  });

  return withDangerousMod(withManifest, ['android', async (modConfig) => {
    const xmlDirectory = path.join(
      modConfig.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'res',
      'xml',
    );
    await mkdir(xmlDirectory, { recursive: true });
    await writeFile(path.join(xmlDirectory, `${resourceName}.xml`), [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<network-security-config>',
      '  <base-config cleartextTrafficPermitted="false" />',
      '  <domain-config cleartextTrafficPermitted="true">',
      '    <domain includeSubdomains="false">127.0.0.1</domain>',
      '  </domain-config>',
      '</network-security-config>',
      '',
    ].join('\n'), 'utf8');
    return modConfig;
  }]);
};
