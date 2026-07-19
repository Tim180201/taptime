export interface AndroidMonotonicSample {
  readonly bootMarker: string;
  readonly elapsedRealtimeMilliseconds: number;
}

export interface AndroidMonotonicClockPort {
  sample(): Promise<AndroidMonotonicSample>;
}

export function validateAndroidMonotonicSample(value: unknown): AndroidMonotonicSample | null {
  if (
    typeof value !== 'object'
    || value === null
    || !Object.hasOwn(value, 'bootMarker')
    || !Object.hasOwn(value, 'elapsedRealtimeMilliseconds')
  ) {
    return null;
  }
  const sample = value as Record<string, unknown>;
  if (
    typeof sample.bootMarker !== 'string'
    || sample.bootMarker.length < 1
    || new TextEncoder().encode(sample.bootMarker).length > 256
    || typeof sample.elapsedRealtimeMilliseconds !== 'number'
    || !Number.isSafeInteger(sample.elapsedRealtimeMilliseconds)
    || sample.elapsedRealtimeMilliseconds < 0
  ) {
    return null;
  }
  return {
    bootMarker: sample.bootMarker,
    elapsedRealtimeMilliseconds: sample.elapsedRealtimeMilliseconds,
  };
}

export class AndroidMonotonicClock {
  constructor(private readonly nativeClock: AndroidMonotonicClockPort) {}

  async sample(): Promise<AndroidMonotonicSample> {
    const sample = validateAndroidMonotonicSample(await this.nativeClock.sample());
    if (sample === null) throw new Error('Android monotonic clock returned invalid evidence');
    return Object.freeze(sample);
  }
}
