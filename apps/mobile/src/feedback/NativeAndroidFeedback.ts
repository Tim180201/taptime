import nativeFeedback from '../../modules/taptime-feedback';
import { scanFeedbackProfiles, type ScanFeedbackKind } from './profiles';

export interface ScanFeedbackPort {
  perform(kind: ScanFeedbackKind): Promise<void>;
}

export class NativeAndroidFeedback implements ScanFeedbackPort {
  async perform(kind: ScanFeedbackKind): Promise<void> {
    await nativeFeedback.perform(scanFeedbackProfiles[kind]);
  }
}
