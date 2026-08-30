import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeFeedbackProfile {
  readonly vibrationTimingsMs: readonly number[];
  readonly vibrationAmplitudes: readonly number[];
  readonly toneFrequenciesHz: readonly number[];
  readonly toneDurationsMs: readonly number[];
  readonly toneVolume: number;
}

interface TapTimeFeedbackModule {
  perform(profile: NativeFeedbackProfile): Promise<void>;
}

const nativeModule = requireOptionalNativeModule<TapTimeFeedbackModule>(
  'TapTimeFeedback',
);

export default {
  async perform(profile: NativeFeedbackProfile): Promise<void> {
    if (nativeModule === null) {
      throw new Error('TapTim.e feedback is unavailable on this platform');
    }
    await nativeModule.perform(profile);
  },
} satisfies TapTimeFeedbackModule;
