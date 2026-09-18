const base = require('./app.json');
const withNfcTagDispatch = require('./plugins/withNfcTagDispatch');
const TAG_HOSTS = require('./src/nfc/tagHosts.json');

const appVariant = process.env.APP_VARIANT;
const runtimeVariant = process.env.EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT;
const physicalValidation = appVariant === 'physical-validation';
const productionValidation = appVariant === 'production-validation';
const buildSourceCommit = /^[0-9a-f]{40}$/u.test(process.env.EAS_BUILD_GIT_COMMIT_HASH ?? '')
  ? process.env.EAS_BUILD_GIT_COMMIT_HASH
  : null;

const validVariantPair = (
  (appVariant === undefined && runtimeVariant === undefined)
  || (physicalValidation && runtimeVariant === 'physical-validation')
  || (productionValidation && runtimeVariant === 'production-validation')
);
if (!validVariantPair) {
  throw new Error('APP_VARIANT and EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT must select the same runtime.');
}

const configuration = {
  ...base.expo,
  name: productionValidation
    ? 'Taptura Produktionstest'
    : physicalValidation
      ? 'Taptura Validation'
      : 'Taptura',
  slug: 'mobile',
  scheme: physicalValidation
    ? 'taptime-validation'
    : productionValidation
      ? 'taptime-production-validation'
      : 'taptime',
  extra: {
    ...base.expo.extra,
    taptimeBuild: { sourceCommit: buildSourceCommit },
    nfcTagHosts: TAG_HOSTS,
  },
  android: {
    ...base.expo.android,
    package: productionValidation
      ? 'com.tim180201.mobile.productionvalidation'
      : physicalValidation
        ? 'com.tim180201.mobile.validation'
        : base.expo.android.package,
  },
};

module.exports = withNfcTagDispatch(configuration);
