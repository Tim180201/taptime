import * as Crypto from 'expo-crypto';
import { RnNfcScanAdapter } from '../nfc/RnNfcScanAdapter';
import { PhysicalValidationController } from './PhysicalValidationController';

/**
 * Composition stays outside React so canonical NFC evidence is reduced to a non-authoritative,
 * shortened fingerprint before any observable UI state is published.
 */
export function createPhysicalValidationRuntime(): PhysicalValidationController {
  const adapter = new RnNfcScanAdapter();
  return new PhysicalValidationController(adapter, adapter, async (canonicalPayload) => {
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      canonicalPayload,
    );
    return digest.slice(0, 12).toUpperCase();
  });
}
