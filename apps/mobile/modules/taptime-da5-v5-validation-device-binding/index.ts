import { requireOptionalNativeModule } from 'expo-modules-core';

export interface Da5V5ValidationDeviceBindingNativeModule {
  readBinding(): unknown;
}

export default requireOptionalNativeModule<
  Da5V5ValidationDeviceBindingNativeModule
>('Da5V5ValidationDeviceBinding');
