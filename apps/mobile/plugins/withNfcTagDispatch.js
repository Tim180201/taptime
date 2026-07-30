const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const ACTION = 'android.nfc.action.TECH_DISCOVERED';
const DEFAULT_CATEGORY = 'android.intent.category.DEFAULT';
const METADATA_NAME = 'android.nfc.action.TECH_DISCOVERED';
const NFC_ACTION_PREFIX = 'android.nfc.action.';
const TECH_RESOURCE = '@xml/taptime_nfc_tech_filter';
const KOTLIN_IMPORT = 'import com.taptime.nfcingress.TapTimeNfcIngress';

function withNfcTagDispatch(config) {
  config = withAndroidManifest(config, (result) => {
    result.modResults = mutateAndroidManifest(result.modResults);
    return result;
  });
  return withDangerousMod(config, ['android', async (result) => {
    const androidRoot = result.modRequest.platformProjectRoot;
    const resourceDirectory = path.join(androidRoot, 'app', 'src', 'main', 'res', 'xml');
    fs.mkdirSync(resourceDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(resourceDirectory, 'taptime_nfc_tech_filter.xml'),
      techFilterXml(),
      'utf8',
    );
    await patchMainActivityAtProjectRootAsync(result.modRequest.projectRoot);
    return result;
  }]);
}

async function patchMainActivityAtProjectRootAsync(projectRoot) {
  const mainActivity = await AndroidConfig.Paths.getMainActivityAsync(projectRoot);
  if (mainActivity.language !== 'kt' || path.basename(mainActivity.path) !== 'MainActivity.kt') {
    throw new Error('Generated Android MainActivity is not Kotlin source');
  }
  fs.writeFileSync(
    mainActivity.path,
    patchMainActivitySource(mainActivity.contents),
    'utf8',
  );
}

function mutateAndroidManifest(manifest) {
  const application = manifest.manifest.application?.[0];
  if (application === undefined) throw new Error('Android application manifest entry is missing');
  const activities = application.activity ?? [];
  const mainActivities = activities.filter((candidate) => (
    candidate.$?.['android:name'] === '.MainActivity'
    || candidate.$?.['android:name']?.endsWith('.MainActivity')
  ));
  if (mainActivities.length !== 1) {
    throw new Error('TapTim.e MainActivity manifest entry mismatch');
  }
  const activity = mainActivities[0];
  const owners = [
    ...activities.map((entry) => ({ entry, kind: 'activity' })),
    ...(application['activity-alias'] ?? [])
      .map((entry) => ({ entry, kind: 'activity-alias' })),
  ];
  const nfcFilters = owners.flatMap((owner) =>
    (owner.entry['intent-filter'] ?? [])
      .filter((filter) => touchesNfcDispatchFilter(filter))
      .map((filter) => ({ ...owner, filter })));
  if (nfcFilters.length > 1) {
    throw new Error('TapTim.e NFC intent-filter manifest entry mismatch');
  }
  if (
    nfcFilters.length === 1
    && (
      nfcFilters[0].kind !== 'activity'
      || nfcFilters[0].entry !== activity
      || !isExactNfcDispatchFilter(nfcFilters[0].filter)
    )
  ) {
    throw new Error('TapTim.e NFC intent-filter manifest entry mismatch');
  }
  const nfcMetadata = owners.flatMap((owner) =>
    (owner.entry['meta-data'] ?? [])
      .filter((entry) => touchesNfcDispatchMetadata(entry))
      .map((metadata) => ({ ...owner, metadata })));
  if (
    nfcMetadata.length > 1
    || (
      nfcMetadata.length === 1
      && (
        nfcMetadata[0].kind !== 'activity'
        || nfcMetadata[0].entry !== activity
        || !isExactNfcDispatchMetadata(nfcMetadata[0].metadata)
      )
    )
  ) {
    throw new Error('TapTim.e NFC metadata manifest entry mismatch');
  }

  const permissions = manifest.manifest['uses-permission'] ?? [];
  if (!permissions.some((entry) => entry.$?.['android:name'] === 'android.permission.NFC')) {
    permissions.push({ $: { 'android:name': 'android.permission.NFC' } });
  }
  manifest.manifest['uses-permission'] = permissions;
  if (nfcFilters.length === 0) {
    const filters = activity['intent-filter'] ?? [];
    filters.push({
      action: [{ $: { 'android:name': ACTION } }],
      category: [{ $: { 'android:name': DEFAULT_CATEGORY } }],
    });
    activity['intent-filter'] = filters;
  }
  if (nfcMetadata.length === 0) {
    const metadata = activity['meta-data'] ?? [];
    metadata.push({
      $: {
        'android:name': METADATA_NAME,
        'android:resource': TECH_RESOURCE,
      },
    });
    activity['meta-data'] = metadata;
  }
  return manifest;
}

function touchesNfcDispatchFilter(filter) {
  return (filter.action ?? []).some((entry) => (
    typeof entry.$?.['android:name'] === 'string'
    && entry.$['android:name'].startsWith(NFC_ACTION_PREFIX)
  ));
}

function isExactNfcDispatchFilter(filter) {
  return (
    exactKeys(filter, ['action', 'category'])
    && Array.isArray(filter.action)
    && filter.action.length === 1
    && isExactNamedEntry(filter.action[0], ACTION)
    && Array.isArray(filter.category)
    && filter.category.length === 1
    && isExactNamedEntry(filter.category[0], DEFAULT_CATEGORY)
  );
}

function touchesNfcDispatchMetadata(metadata) {
  const name = metadata.$?.['android:name'];
  return (
    (
      typeof name === 'string'
      && name.startsWith(NFC_ACTION_PREFIX)
    )
    || metadata.$?.['android:resource'] === TECH_RESOURCE
  );
}

function isExactNfcDispatchMetadata(metadata) {
  return (
    exactKeys(metadata, ['$'])
    && exactKeys(metadata.$, ['android:name', 'android:resource'])
    && metadata.$['android:name'] === METADATA_NAME
    && metadata.$['android:resource'] === TECH_RESOURCE
  );
}

function isExactNamedEntry(entry, name) {
  return (
    exactKeys(entry, ['$'])
    && exactKeys(entry.$, ['android:name'])
    && entry.$['android:name'] === name
  );
}

function exactKeys(value, expected) {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.keys(value).sort().join('\n')
      === [...expected].sort().join('\n')
  );
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
  </tech-list>
</resources>
`;
}

module.exports = withNfcTagDispatch;
module.exports.mutateAndroidManifest = mutateAndroidManifest;
module.exports.patchMainActivityAtProjectRootAsync = patchMainActivityAtProjectRootAsync;
module.exports.patchMainActivitySource = patchMainActivitySource;
module.exports.techFilterXml = techFilterXml;
