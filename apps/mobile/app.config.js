const base = require('./app.json');
const withDa5V5ValidationAndroidBoundary = require('./plugins/withDa5V5ValidationAndroidBoundary');

const appVariant = process.env.APP_VARIANT;
const runtimeVariant = process.env.EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT;
const physicalValidation = appVariant === 'physical-validation';
const da5V5Validation = appVariant === 'da5-v5-validation';
const syntheticE2e = appVariant === 'synthetic-e2e';

const validVariantPair = (
  (appVariant === undefined && runtimeVariant === undefined)
  || (physicalValidation && runtimeVariant === 'physical-validation')
  || (da5V5Validation && runtimeVariant === 'da5-v5-validation')
  || (syntheticE2e && runtimeVariant === 'synthetic-e2e')
);
if (!validVariantPair) {
  throw new Error('APP_VARIANT and EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT must select the same runtime.');
}

const configuration = {
  ...base.expo,
  name: da5V5Validation
    ? 'TapTim.e DA5 Validation'
    : physicalValidation
      ? 'TapTim.e Validation'
    : syntheticE2e
      ? 'TapTim.e Synthetic E2E'
      : 'TapTim.e',
  slug: 'mobile',
  ...(da5V5Validation
    ? {}
    : {
        scheme: physicalValidation
          ? 'taptime-validation'
          : syntheticE2e
            ? 'taptime-synthetic-e2e'
            : 'taptime',
      }),
  ...(da5V5Validation
    ? {
        extra: {},
        plugins: [[
          'react-native-nfc-manager',
          {
            nfcPermission: 'TapTim.e validates explicitly presented local NFC tags.',
            selectIdentifiers: [],
            systemCodes: [],
          },
        ]],
        updates: { enabled: false },
      }
    : {}),
  android: {
    ...base.expo.android,
    ...(da5V5Validation
      ? {
          allowBackup: false,
          permissions: ['android.permission.NFC'],
        }
      : {}),
    package: da5V5Validation
      ? 'com.tim180201.mobile.validation'
      : physicalValidation
      ? 'com.tim180201.mobile.validation'
      : syntheticE2e
        ? 'com.tim180201.mobile.synthetic'
      : base.expo.android.package,
  },
};

if (da5V5Validation) {
  module.exports = withDa5V5ValidationAndroidBoundary(configuration);
} else {
  const withNfcTagDispatch = require('./plugins/withNfcTagDispatch');
  const withSyntheticE2eNetworkSecurity = require(
    './plugins/withSyntheticE2eNetworkSecurity',
  );
  const withNfcIngress = withNfcTagDispatch(configuration);
  module.exports = syntheticE2e
    ? withSyntheticE2eNetworkSecurity(withNfcIngress)
    : withNfcIngress;
}
