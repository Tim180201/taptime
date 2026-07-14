const base = require('./app.json');

const physicalValidation = process.env.APP_VARIANT === 'physical-validation';
const runtimeVariant = process.env.EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT;

if (physicalValidation !== (runtimeVariant === 'physical-validation')) {
  throw new Error('APP_VARIANT and EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT must select the same runtime.');
}

module.exports = {
  ...base.expo,
  name: physicalValidation ? 'TapTim.e Validation' : 'TapTim.e',
  slug: 'mobile',
  scheme: physicalValidation ? 'taptime-validation' : 'taptime',
  android: {
    ...base.expo.android,
    package: physicalValidation
      ? 'com.tim180201.mobile.validation'
      : base.expo.android.package,
  },
};
