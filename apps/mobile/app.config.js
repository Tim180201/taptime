const { name: appName } = require('../../shared/product.json');
const base = require('./app.json');
const withNfcTagDispatch = require('./plugins/withNfcTagDispatch');
const TAG_HOSTS = require('./src/nfc/tagHosts.json');

const appVariant = process.env.APP_VARIANT;
const runtimeVariant = process.env.EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT;
const physicalValidation = appVariant === 'physical-validation';
const productionValidation = appVariant === 'production-validation';
const store = appVariant === 'store';
const buildSourceCommit = /^[0-9a-f]{40}$/u.test(process.env.EAS_BUILD_GIT_COMMIT_HASH ?? '')
  ? process.env.EAS_BUILD_GIT_COMMIT_HASH
  : null;

const validVariantPair = (
  (appVariant === undefined && runtimeVariant === undefined)
  || (physicalValidation && runtimeVariant === 'physical-validation')
  || ((productionValidation || store) && runtimeVariant === 'production-validation')
);
if (!validVariantPair) {
  throw new Error('APP_VARIANT and EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT must select the same runtime.');
}

const configuration = {
  ...base.expo,
  name: productionValidation
    ? `${appName} Produktionstest`
    : physicalValidation
      ? `${appName} Validation`
      : appName,
  plugins: base.expo.plugins.map(plugin => Array.isArray(plugin) && plugin[0] === 'react-native-nfc-manager'
    ? [plugin[0], { ...plugin[1], nfcPermission: plugin[1].nfcPermission.replace('%APP_NAME%', appName) }]
    : plugin),
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
  ios: {
    ...base.expo.ios,
    supportsTablet: false,
    infoPlist: {
      ...base.expo.ios.infoPlist,
      UIRequiredDeviceCapabilities: ['nfc'],
    },
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
