import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeMonotonicClockSample {
  readonly bootMarker: string;
  readonly elapsedRealtimeMilliseconds: number;
}

interface TapTimeMonotonicClockModule {
  sample(): NativeMonotonicClockSample;
}

const nativeModule = requireOptionalNativeModule<TapTimeMonotonicClockModule>(
  'TapTimeMonotonicClock',
);

export default {
  sample(): NativeMonotonicClockSample {
    if (nativeModule === null) {
      throw new Error('TapTim.e monotonic clock is unavailable on this platform');
    }
    return nativeModule.sample();
  },
} satisfies TapTimeMonotonicClockModule;
