import type { NativeFeedbackProfile } from '../../modules/taptime-feedback';

export type ScanFeedbackKind =
  | 'work_started'
  | 'work_stopped'
  | 'break_changed'
  | 'pending_confirmation'
  | 'failed';

export const scanFeedbackProfiles: Readonly<Record<
  ScanFeedbackKind,
  NativeFeedbackProfile
>> = Object.freeze({
  work_started: profile([0, 120], [0, 255], [523, 659], [64, 96], 0.75),
  work_stopped: profile([0, 80, 72, 80], [0, 230, 0, 230], [659, 523], [64, 96], 0.75),
  break_changed: profile([0, 64], [0, 80], [440], [120], 0.25),
  pending_confirmation: profile(
    [0, 32, 36, 32, 36, 20],
    [0, 150, 0, 150, 0, 150],
    [494, 494, 494],
    [48, 40, 24],
    0.45,
  ),
  failed: profile([0, 400], [0, 255], [196], [400], 0.9),
});

function profile(
  vibrationTimingsMs: readonly number[],
  vibrationAmplitudes: readonly number[],
  toneFrequenciesHz: readonly number[],
  toneDurationsMs: readonly number[],
  toneVolume: number,
): NativeFeedbackProfile {
  return Object.freeze({
    vibrationTimingsMs: Object.freeze(vibrationTimingsMs),
    vibrationAmplitudes: Object.freeze(vibrationAmplitudes),
    toneFrequenciesHz: Object.freeze(toneFrequenciesHz),
    toneDurationsMs: Object.freeze(toneDurationsMs),
    toneVolume,
  });
}
