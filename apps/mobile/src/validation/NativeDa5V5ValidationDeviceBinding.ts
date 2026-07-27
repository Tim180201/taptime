import nativeModule from '../../modules/taptime-da5-v5-validation-device-binding';
import type {
  Da5V5ValidationDeviceBindingPort,
} from './Da5V5ValidationDeviceBinding';

export class NativeDa5V5ValidationDeviceBinding
implements Da5V5ValidationDeviceBindingPort {
  async readBinding(): Promise<unknown> {
    if (nativeModule === null) {
      throw new Error('DA5 V5 Validation device binding is unavailable');
    }
    return nativeModule.readBinding();
  }
}
