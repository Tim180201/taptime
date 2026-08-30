import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  feedbackKindForOutcome,
  feedbackKindForState,
} from '../../src/feedback/ScanFeedbackCoordinator';
import { scanFeedbackProfiles } from '../../src/feedback/profiles';

describe('scan feedback', () => {
  it('keeps all five patterns pairwise different in vibration and sound', () => {
    const entries = Object.entries(scanFeedbackProfiles);
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        const [leftName, leftProfile] = entries[left]!;
        const [rightName, rightProfile] = entries[right]!;
        expect(
          vibrationSignature(leftProfile),
          `${leftName} vibration must differ from ${rightName}`,
        ).not.toBe(vibrationSignature(rightProfile));
        expect(
          toneSignature(leftProfile),
          `${leftName} sound must differ from ${rightName}`,
        ).not.toBe(toneSignature(rightProfile));
      }
    }
  });

  it('separates pending from work-stopped by pulse count and pulse lengths', () => {
    const pendingPulses = pulseDurations(scanFeedbackProfiles.pending_confirmation);
    const stoppedPulses = pulseDurations(scanFeedbackProfiles.work_stopped);
    expect(pendingPulses).toEqual([32, 32, 20]);
    expect(stoppedPulses).toEqual([80, 80]);
    expect(pendingPulses).toHaveLength(3);
    expect(stoppedPulses).toHaveLength(2);
  });

  it('makes start rising, stop descending, pause softer, and failure long and low', () => {
    const start = scanFeedbackProfiles.work_started;
    const stop = scanFeedbackProfiles.work_stopped;
    const pause = scanFeedbackProfiles.break_changed;
    const pending = scanFeedbackProfiles.pending_confirmation;
    const failure = scanFeedbackProfiles.failed;
    expect(start.toneFrequenciesHz[0]).toBeLessThan(start.toneFrequenciesHz[1]!);
    expect(stop.toneFrequenciesHz[0]).toBeGreaterThan(stop.toneFrequenciesHz[1]!);
    expect(stop.vibrationAmplitudes.filter((value) => value > 0)).toHaveLength(2);
    expect(pulseDurations(pending)).toHaveLength(3);
    expect(pulseDurations(pending)).not.toEqual(pulseDurations(stop));
    expect(pause.vibrationAmplitudes[1]).toBeLessThan(start.vibrationAmplitudes[1]!);
    expect(pause.toneVolume).toBeLessThan(start.toneVolume);
    expect(new Set(pending.toneFrequenciesHz)).toEqual(new Set([494]));
    expect(pending.toneFrequenciesHz).toHaveLength(3);
    expect(pending.toneDurationsMs[1]).toBeLessThan(pending.toneDurationsMs[0]!);
    expect(pending.toneDurationsMs[2]).toBeLessThan(pending.toneDurationsMs[1]!);
    expect(failure.vibrationTimingsMs.at(-1)).toBeGreaterThan(start.vibrationTimingsMs.at(-1)!);
    expect(failure.toneFrequenciesHz[0]).toBeLessThan(pause.toneFrequenciesHz[0]!);
  });

  it('separates the two decisive pairs from the long, low failure pattern', () => {
    const start = scanFeedbackProfiles.work_started;
    const pending = scanFeedbackProfiles.pending_confirmation;
    const failure = scanFeedbackProfiles.failed;
    for (const [name, profile] of [['work_started', start], ['pending_confirmation', pending]] as const) {
      expect(totalDuration(profile.vibrationTimingsMs), `${name} must stay short`)
        .toBeLessThan(totalDuration(failure.vibrationTimingsMs) / 2);
      expect(Math.min(...profile.toneFrequenciesHz), `${name} must stay clearly above failure`)
        .toBeGreaterThan(Math.max(...failure.toneFrequenciesHz) * 2);
      expect(vibrationSignature(profile)).not.toBe(vibrationSignature(failure));
      expect(toneSignature(profile)).not.toBe(toneSignature(failure));
    }
  });

  it('maps outcomes by explicit semantics without turning duplicates into failures', () => {
    expect(feedbackKindForOutcome({ status: 'time_entry_started' })).toBe('work_started');
    expect(feedbackKindForOutcome({ status: 'time_entry_stopped' })).toBe('work_stopped');
    expect(feedbackKindForOutcome({ status: 'break_started' })).toBe('break_changed');
    expect(feedbackKindForOutcome({ status: 'break_stopped' })).toBe('break_changed');
    expect(feedbackKindForOutcome({ status: 'server_review_pending' }))
      .toBe('pending_confirmation');
    expect(feedbackKindForOutcome({ status: 'escalation_required' }))
      .toBe('pending_confirmation');
    expect(feedbackKindForOutcome({ status: 'duplicate_scan_ignored' })).toBeNull();
    expect(feedbackKindForOutcome({ status: 'tag_not_assigned' })).toBe('failed');
  });

  it('maps scan states explicitly, including durable retry and review states', () => {
    expect(feedbackKindForState({ status: 'server_decision', queueCount: 0,
      outcome: { status: 'time_entry_started' } })).toBe('work_started');
    expect(feedbackKindForState({ status: 'server_decision', queueCount: 0,
      outcome: { status: 'duplicate_scan_ignored' } })).toBeNull();
    expect(feedbackKindForState({ status: 'saved_locally', queueCount: 1 }))
      .toBe('pending_confirmation');
    expect(feedbackKindForState({ status: 'retry_pending' }))
      .toBe('pending_confirmation');
    expect(feedbackKindForState({ status: 'server_review_pending', queueCount: 0 }))
      .toBe('pending_confirmation');
    expect(feedbackKindForState({ status: 'ready', outcome: null })).toBeNull();
    expect(feedbackKindForState({ status: 'synchronizing', queueCount: 1 })).toBeNull();
    expect(feedbackKindForState({ status: 'secure_storage_unavailable' })).toBe('failed');
  });

  it('vibrates before checking silent mode and creates sound only in normal ringer mode', async () => {
    const source = await readFile(new URL(
      '../../modules/taptime-feedback/android/src/main/java/com/taptime/feedback/TapTimeFeedbackModule.kt',
      import.meta.url,
    ), 'utf8');
    const vibration = source.indexOf('vibrate(context, vibrationTimings, vibrationAmplitudes)');
    const ringerCheck = source.indexOf('audioManager.ringerMode == AudioManager.RINGER_MODE_NORMAL');
    const sound = source.indexOf('playToneSequence(toneFrequencies, toneDurations, toneVolume)');
    expect(vibration).toBeGreaterThan(-1);
    expect(ringerCheck).toBeGreaterThan(vibration);
    expect(sound).toBeGreaterThan(ringerCheck);
    expect(source).not.toContain('RINGER_MODE_SILENT) {\n        vibrate');
  });

  it('keeps the product feedback module out of the isolated DA5 hardware build', async () => {
    const source = await readFile(new URL(
      '../../scripts/da5V5ValidationRuntimeContract.mjs',
      import.meta.url,
    ), 'utf8');
    expect(source).toContain("'taptime-feedback'");
  });
});

function vibrationSignature(profile: typeof scanFeedbackProfiles.work_started): string {
  return JSON.stringify([profile.vibrationTimingsMs, profile.vibrationAmplitudes]);
}

function toneSignature(profile: typeof scanFeedbackProfiles.work_started): string {
  return JSON.stringify([
    profile.toneFrequenciesHz,
    profile.toneDurationsMs,
    profile.toneVolume,
  ]);
}

function totalDuration(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function pulseDurations(profile: typeof scanFeedbackProfiles.work_started): readonly number[] {
  return profile.vibrationTimingsMs.filter((_, index) => (
    profile.vibrationAmplitudes[index]! > 0
  ));
}
