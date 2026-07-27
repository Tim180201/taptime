import * as Crypto from 'expo-crypto';
import { Da5V5ValidationController } from './Da5V5ValidationController';
import { Da5V5ValidationNfcCapture } from './Da5V5ValidationNfcCapture';
import {
  NativeDa5V5ValidationDeviceBinding,
} from './NativeDa5V5ValidationDeviceBinding';

/**
 * Validation-only composition. It owns no Product runtime, authentication, storage, database,
 * transport or lifecycle capability.
 */
export function createDa5V5ValidationRuntime(): Da5V5ValidationController {
  const capture = new Da5V5ValidationNfcCapture({
    digestCanonicalPayload: (canonicalPayload) => Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      canonicalPayload,
    ),
  });
  return new Da5V5ValidationController(
    capture,
    new NativeDa5V5ValidationDeviceBinding(),
  );
}
