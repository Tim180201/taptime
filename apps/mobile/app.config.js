const base = require('./app.json');
const withSyntheticE2eNetworkSecurity = require('./plugins/withSyntheticE2eNetworkSecurity');

const appVariant = process.env.APP_VARIANT;
const runtimeVariant = process.env.EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT;
const physicalValidation = appVariant === 'physical-validation';
const syntheticE2e = appVariant === 'synthetic-e2e';

const validVariantPair = (
  (appVariant === undefined && runtimeVariant === undefined)
  || (physicalValidation && runtimeVariant === 'physical-validation')
  || (syntheticE2e && runtimeVariant === 'synthetic-e2e')
);
if (!validVariantPair) {
  throw new Error('APP_VARIANT and EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT must select the same runtime.');
}

const configuration = {
  ...base.expo,
  name: physicalValidation
    ? 'TapTim.e Validation'
    : syntheticE2e
      ? 'TapTim.e Synthetic E2E'
      : 'TapTim.e',
  slug: 'mobile',
  scheme: physicalValidation
    ? 'taptime-validation'
    : syntheticE2e
      ? 'taptime-synthetic-e2e'
      : 'taptime',
  android: {
    ...base.expo.android,
    package: physicalValidation
      ? 'com.tim180201.mobile.validation'
      : syntheticE2e
        ? 'com.tim180201.mobile.synthetic'
      : base.expo.android.package,
  },
};

module.exports = syntheticE2e
  ? withSyntheticE2eNetworkSecurity(configuration)
  : configuration;
