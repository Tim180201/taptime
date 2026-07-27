import { requireNativeModule } from 'expo-modules-core';
import { Da5V5ValidationController } from './Da5V5ValidationController';
import { Da5V5ValidationNfcCapture } from './Da5V5ValidationNfcCapture';
import {
  NativeDa5V5ValidationDeviceBinding,
} from './NativeDa5V5ValidationDeviceBinding';

type Da5V5ValidationCryptoModule = {
  digestStringAsync(
    algorithm: 'SHA-256',
    data: string,
    options: Readonly<{ encoding: 'hex' }>,
  ): Promise<string>;
};

const validationCrypto =
  requireNativeModule<Da5V5ValidationCryptoModule>('ExpoCrypto');

/**
 * Validation-only composition. It owns no Product runtime, authentication, storage, database,
 * transport or lifecycle capability.
 */
export function createDa5V5ValidationRuntime(): Da5V5ValidationController {
  const capture = new Da5V5ValidationNfcCapture({
    digestCanonicalPayload: (canonicalPayload) =>
      validationCrypto.digestStringAsync(
        'SHA-256',
        canonicalPayload,
        { encoding: 'hex' },
      ),
  });
  return new Da5V5ValidationController(
    capture,
    new NativeDa5V5ValidationDeviceBinding(),
  );
}
