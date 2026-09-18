const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const ACTION = 'android.nfc.action.TECH_DISCOVERED';
const NDEF_ACTION = 'android.nfc.action.NDEF_DISCOVERED';
const VIEW_ACTION = 'android.intent.action.VIEW';
const DEFAULT_CATEGORY = 'android.intent.category.DEFAULT';
const METADATA_NAME = 'android.nfc.action.TECH_DISCOVERED';
const NFC_ACTION_PREFIX = 'android.nfc.action.';
const TECH_RESOURCE = '@xml/taptime_nfc_tech_filter';
const KOTLIN_IMPORT = 'import com.taptime.nfcingress.TapTimeNfcIngress';

function withNfcTagDispatch(config) {
  config = withAndroidManifest(config, (result) => {
    result.modResults = mutateAndroidManifest(result.modResults, result.extra?.nfcTagHosts);
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

function mutateAndroidManifest(manifest, hosts) {
  if (!Array.isArray(hosts) || hosts.length === 0
    || hosts.some((host) => typeof host !== 'string'
      || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/u.test(host))
    || new Set(hosts).size !== hosts.length) {
    throw new Error('TapTim.e NFC host list is missing or invalid');
  }
  const expectedFilters = [
    { action: [{ $: { 'android:name': ACTION } }],
      category: [{ $: { 'android:name': DEFAULT_CATEGORY } }] },
    ...hosts.flatMap((host) => [
      {
        action: [{ $: { 'android:name': NDEF_ACTION } }],
        category: [{ $: { 'android:name': DEFAULT_CATEGORY } }],
        data: [{ $: { 'android:scheme': 'https', 'android:host': host, 'android:pathPrefix': '/tag' } }],
      },
      {
        action: [{ $: { 'android:name': VIEW_ACTION } }],
        category: [{ $: { 'android:name': DEFAULT_CATEGORY } },
          { $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
        data: [{ $: { 'android:scheme': 'https', 'android:host': host, 'android:pathPrefix': '/tag' } }],
      },
    ]),
  ];
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
      .filter((filter) => touchesNfcDispatchFilter(filter, hosts))
      .map((filter) => ({ ...owner, filter })));
  const presentFilters = new Set();
  for (const owner of nfcFilters) {
    const index = expectedFilters.findIndex((expected) => isExactFilter(owner.filter, expected));
    if (owner.kind !== 'activity' || owner.entry !== activity || index < 0
      || presentFilters.has(index)) {
      throw new Error('TapTim.e NFC intent-filter manifest entry mismatch');
    }
    presentFilters.add(index);
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
  activity['intent-filter'] = [
    ...(activity['intent-filter'] ?? []),
    ...expectedFilters.filter((_, index) => !presentFilters.has(index)),
  ];
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

function touchesNfcDispatchFilter(filter, hosts) {
  return (filter.action ?? []).some((entry) => (
    typeof entry.$?.['android:name'] === 'string'
    && entry.$['android:name'].startsWith(NFC_ACTION_PREFIX)
  )) || ((filter.action ?? []).some((entry) => entry.$?.['android:name'] === VIEW_ACTION)
    && (filter.data ?? []).some((entry) => hosts.includes(entry.$?.['android:host'])));
}

function isExactFilter(value, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(value) && value.length === expected.length
      && expected.every((entry, index) => isExactFilter(value[index], entry));
  }
  if (typeof expected === 'object' && expected !== null) {
    return exactKeys(value, Object.keys(expected))
      && Object.keys(expected).every((key) => isExactFilter(value[key], expected[key]));
  }
  return value === expected;
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
  if (!result.includes('TapTimeNfcIngress.captureActivityCreateIntent(intent')) {
    if (!result.includes(createMarker)) {
      throw new Error('MainActivity onCreate boundary is missing');
    }
    result = result.replace(
      createMarker,
      `${createMarker}\n    TapTimeNfcIngress.captureActivityCreateIntent(intent, savedInstanceState != null)`,
    );
  }
  const warmMarker = 'override fun onNewIntent(intent: Intent) {';
  if (
    result.includes(warmMarker)
    && !result.includes('TapTimeNfcIngress.captureActivityDeliveryIntent(intent)')
  ) {
    result = result.replace(
      warmMarker,
      `${warmMarker}\n    TapTimeNfcIngress.captureActivityDeliveryIntent(intent)`,
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
    TapTimeNfcIngress.captureActivityDeliveryIntent(intent)
  }
${result.slice(finalBrace)}`;
  }
  const postResumeMarker = 'override fun onPostResume() {';
  const closeStartWindow = 'TapTimeNfcIngress.closeProcessStartIntentWindow()';
  if (result.includes(postResumeMarker) && !result.includes(closeStartWindow)) {
    const postResumeStart = result.indexOf(postResumeMarker);
    const superCall = 'super.onPostResume()';
    const superCallStart = result.indexOf(superCall, postResumeStart);
    const nextOverride = result.indexOf('\n  override fun ', postResumeStart + 1);
    if (
      superCallStart < 0
      || (nextOverride >= 0 && superCallStart > nextOverride)
    ) {
      throw new Error('MainActivity onPostResume super boundary is missing');
    }
    const superCallEnd = superCallStart + superCall.length;
    result = `${result.slice(0, superCallEnd)}\n    ${closeStartWindow}${result.slice(superCallEnd)}`;
  } else if (!result.includes(postResumeMarker)) {
    const finalBrace = result.lastIndexOf('}');
    if (finalBrace < 0) throw new Error('MainActivity class boundary is missing');
    result = `${result.slice(0, finalBrace)}
  ${postResumeMarker}
    super.onPostResume()
    ${closeStartWindow}
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
