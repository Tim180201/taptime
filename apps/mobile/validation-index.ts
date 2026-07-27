import { AppRegistry } from 'react-native';

import { Da5V5ValidationMobileApp } from './src/validation/Da5V5ValidationMobileApp';

const runtimeMarker = globalThis as typeof globalThis & {
  __TAPTIME_DA5_V5_VALIDATION_RUNTIME__?: string;
};
runtimeMarker.__TAPTIME_DA5_V5_VALIDATION_RUNTIME__ =
  'taptime-da5-v5-validation-only-v1';

AppRegistry.registerComponent('main', () => Da5V5ValidationMobileApp);
