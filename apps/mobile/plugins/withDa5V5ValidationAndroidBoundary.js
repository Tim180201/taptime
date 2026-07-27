const {
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const NETWORK_SECURITY_RESOURCE =
  'taptime_da5_v5_validation_network_security';
const DATA_EXTRACTION_RESOURCE =
  'taptime_da5_v5_validation_data_extraction_rules';
const ANDROID_NAMESPACE = 'http://schemas.android.com/apk/res/android';
const TOOLS_NAMESPACE = 'http://schemas.android.com/tools';
const NFC_PERMISSION = 'android.permission.NFC';
const PROHIBITED_NETWORK_PERMISSIONS = Object.freeze([
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.CHANGE_NETWORK_STATE',
  'android.permission.INTERNET',
]);

function withDa5V5ValidationAndroidBoundary(config) {
  const withManifest = withAndroidManifest(config, (result) => {
    result.modResults = mutateDa5V5ValidationManifest(result.modResults);
    return result;
  });
  return withDangerousMod(withManifest, ['android', async (result) => {
    const xmlDirectory = path.join(
      result.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'res',
      'xml',
    );
    await mkdir(xmlDirectory, { recursive: true });
    await Promise.all([
      writeFile(
        path.join(xmlDirectory, `${NETWORK_SECURITY_RESOURCE}.xml`),
        validationNetworkSecurityXml(),
        'utf8',
      ),
      writeFile(
        path.join(xmlDirectory, `${DATA_EXTRACTION_RESOURCE}.xml`),
        validationDataExtractionXml(),
        'utf8',
      ),
    ]);
    return result;
  }]);
}

function mutateDa5V5ValidationManifest(manifest) {
  manifest.manifest.$ ??= {};
  manifest.manifest.$['xmlns:android'] ??= ANDROID_NAMESPACE;
  manifest.manifest.$['xmlns:tools'] = TOOLS_NAMESPACE;

  const permissions = manifest.manifest['uses-permission'] ?? [];
  const retained = permissions.filter((entry) => (
    entry.$?.['android:name'] === NFC_PERMISSION
  ));
  if (retained.length === 0) {
    retained.push({ $: { 'android:name': NFC_PERMISSION } });
  }
  for (const name of PROHIBITED_NETWORK_PERMISSIONS) {
    retained.push({
      $: {
        'android:name': name,
        'tools:node': 'remove',
      },
    });
  }
  manifest.manifest['uses-permission'] = retained;
  manifest.manifest['uses-feature'] = [{
    $: {
      'android:name': 'android.hardware.nfc',
      'android:required': 'true',
    },
  }];

  const application = manifest.manifest.application?.[0];
  if (application === undefined) {
    throw new Error('DA5 V5 Validation Android application is unavailable');
  }
  application.$ ??= {};
  application.$['android:allowBackup'] = 'false';
  application.$['android:fullBackupContent'] = 'false';
  application.$['android:dataExtractionRules'] =
    `@xml/${DATA_EXTRACTION_RESOURCE}`;
  application.$['android:usesCleartextTraffic'] = 'false';
  application.$['android:networkSecurityConfig'] =
    `@xml/${NETWORK_SECURITY_RESOURCE}`;

  const activity = application.activity?.find((candidate) => (
    candidate.$?.['android:name'] === '.MainActivity'
    || candidate.$?.['android:name']?.endsWith('.MainActivity')
  ));
  if (activity === undefined) {
    throw new Error('DA5 V5 Validation MainActivity is unavailable');
  }
  activity['intent-filter'] = (activity['intent-filter'] ?? []).filter(
    isLauncherOnlyIntentFilter,
  );
  activity['meta-data'] = (activity['meta-data'] ?? []).filter(
    (entry) => entry.$?.['android:name']
      !== 'android.nfc.action.TECH_DISCOVERED',
  );
  return manifest;
}

function isLauncherOnlyIntentFilter(filter) {
  const actions = (filter.action ?? [])
    .map((entry) => entry.$?.['android:name'])
    .filter(Boolean);
  const categories = (filter.category ?? [])
    .map((entry) => entry.$?.['android:name'])
    .filter(Boolean);
  const hasData = (filter.data ?? []).length !== 0;
  return actions.length === 1
    && actions[0] === 'android.intent.action.MAIN'
    && categories.length === 1
    && categories[0] === 'android.intent.category.LAUNCHER'
    && !hasData;
}

function validationNetworkSecurityXml() {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<network-security-config>',
    '  <base-config cleartextTrafficPermitted="false" />',
    '</network-security-config>',
    '',
  ].join('\n');
}

function validationDataExtractionXml() {
  const exclusions = [
    'database',
    'device_database',
    'device_file',
    'device_root',
    'device_sharedpref',
    'external',
    'file',
    'root',
    'sharedpref',
  ].map((domain) => `    <exclude domain="${domain}" path="." />`);
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<data-extraction-rules>',
    '  <cloud-backup>',
    ...exclusions,
    '  </cloud-backup>',
    '  <device-transfer>',
    ...exclusions,
    '  </device-transfer>',
    '</data-extraction-rules>',
    '',
  ].join('\n');
}

module.exports = withDa5V5ValidationAndroidBoundary;
module.exports.mutateDa5V5ValidationManifest =
  mutateDa5V5ValidationManifest;
module.exports.validationDataExtractionXml = validationDataExtractionXml;
module.exports.validationNetworkSecurityXml = validationNetworkSecurityXml;
