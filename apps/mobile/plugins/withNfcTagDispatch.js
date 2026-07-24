const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const ACTION = 'android.nfc.action.TECH_DISCOVERED';
const METADATA_NAME = 'android.nfc.action.TECH_DISCOVERED';
const TECH_RESOURCE = '@xml/taptime_nfc_tech_filter';
const KOTLIN_IMPORT = 'import com.taptime.nfcingress.TapTimeNfcIngress';

function withNfcTagDispatch(config) {
  config = withAndroidManifest(config, (result) => {
    result.modResults = mutateAndroidManifest(result.modResults);
    return result;
  });
  return withDangerousMod(config, ['android', (result) => {
    const androidRoot = result.modRequest.platformProjectRoot;
    const resourceDirectory = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(resourceDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(resourceDirectory, 'taptime_nfc_tech_filter.xml'),
      techFilterXml(),
      'utf8',
    );
    const mainActivityPath = AndroidConfig.Paths.getMainActivityFilePath(androidRoot);
    const source = fs.readFileSync(mainActivityPath, 'utf8');
    fs.writeFileSync(mainActivityPath, patchMainActivitySource(source), 'utf8');
    return result;
  }]);
}

function mutateAndroidManifest(manifest) {
  const permissions = manifest.manifest['uses-permission'] ?? [];
  if (!permissions.some((entry) => entry.$?.['android:name'] === 'android.permission.NFC')) {
    permissions.push({ $: { 'android:name': 'android.permission.NFC' } });
  }
  manifest.manifest['uses-permission'] = permissions;
  const application = manifest.manifest.application?.[0];
  if (application === undefined) throw new Error('Android application manifest entry is missing');
  const activity = application.activity?.find((candidate) => (
    candidate.$?.['android:name'] === '.MainActivity'
    || candidate.$?.['android:name']?.endsWith('.MainActivity')
  ));
  if (activity === undefined) throw new Error('TapTim.e MainActivity manifest entry is missing');
  const filters = activity['intent-filter'] ?? [];
  if (!filters.some((filter) => filter.action?.some(
    (entry) => entry.$?.['android:name'] === ACTION,
  ))) {
    filters.push({
      action: [{ $: { 'android:name': ACTION } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
    });
  }
  activity['intent-filter'] = filters;
  const metadata = activity['meta-data'] ?? [];
  if (!metadata.some((entry) => entry.$?.['android:name'] === METADATA_NAME)) {
    metadata.push({
      $: {
        'android:name': METADATA_NAME,
        'android:resource': TECH_RESOURCE,
      },
    });
  }
  activity['meta-data'] = metadata;
  return manifest;
}

function patchMainActivitySource(source) {
  if (!source.includes('class MainActivity')) {
    throw new Error('Generated Android MainActivity is not Kotlin source');
  }
  let result = source;
  if (!result.includes(KOTLIN_IMPORT)) {
    const packageLineEnd = result.indexOf('\n');
    if (packageLineEnd < 0) throw new Error('MainActivity package declaration is missing');
    result = `${result.slice(0, packageLineEnd + 1)}\n${KOTLIN_IMPORT}\n${result.slice(packageLineEnd + 1)}`;
  }
  const createMarker = 'override fun onCreate(savedInstanceState: Bundle?) {';
  if (!result.includes('TapTimeNfcIngress.captureIntent(intent)')) {
    if (!result.includes(createMarker)) {
      throw new Error('MainActivity onCreate boundary is missing');
    }
    result = result.replace(
      createMarker,
      `${createMarker}\n    TapTimeNfcIngress.captureIntent(intent)`,
    );
  }
  const warmMarker = 'override fun onNewIntent(intent: Intent) {';
  const captureCount = result.split('TapTimeNfcIngress.captureIntent(intent)').length - 1;
  if (result.includes(warmMarker) && captureCount < 2) {
    result = result.replace(
      warmMarker,
      `${warmMarker}\n    TapTimeNfcIngress.captureIntent(intent)`,
    );
  } else if (!result.includes(warmMarker)) {
    if (!result.includes('import android.content.Intent')) {
      result = result.replace(KOTLIN_IMPORT, `import android.content.Intent\n${KOTLIN_IMPORT}`);
    }
    const finalBrace = result.lastIndexOf('}');
    if (finalBrace < 0) throw new Error('MainActivity class boundary is missing');
    result = `${result.slice(0, finalBrace)}
  ${warmMarker}
    super.onNewIntent(intent)
    setIntent(intent)
    TapTimeNfcIngress.captureIntent(intent)
  }
${result.slice(finalBrace)}`;
  }
  return result;
}

function techFilterXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:xliff="urn:oasis:names:tc:xliff:document:1.2">
  <tech-list>
    <tech>android.nfc.tech.NfcA</tech>
    <tech>android.nfc.tech.MifareUltralight</tech>
  </tech-list>
</resources>
`;
}

module.exports = withNfcTagDispatch;
module.exports.mutateAndroidManifest = mutateAndroidManifest;
module.exports.patchMainActivitySource = patchMainActivitySource;
module.exports.techFilterXml = techFilterXml;
