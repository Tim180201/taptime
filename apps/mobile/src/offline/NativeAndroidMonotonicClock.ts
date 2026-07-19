import TapTimeMonotonicClock from '../../modules/taptime-monotonic-clock';
import { AndroidMonotonicClock } from './AndroidMonotonicClock';

export function createNativeAndroidMonotonicClock(): AndroidMonotonicClock {
  return new AndroidMonotonicClock({
    sample: async () => TapTimeMonotonicClock.sample(),
  });
}
