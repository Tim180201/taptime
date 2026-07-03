import type { NfcScanCaptureResult, NfcScanPort } from '../../ports/NfcScanPort';
import { createNfcPayload } from '../../domain/NfcPayload';

// Manually-triggered test double for DT-001. Emits the same normalized NfcScanCaptureResult
// shape a real NFC SDK adapter would; no real NFC hardware/SDK is used (Development Sprint
// 001 Plan, Section 5/7).
export class FakeNfcScanAdapter implements NfcScanPort {
  private queuedResult: NfcScanCaptureResult = { status: 'unreadable' };

  triggerScan(rawPayload: string): void {
    this.queuedResult = { status: 'captured', payload: createNfcPayload(rawPayload) };
  }

  triggerUnreadableScan(): void {
    this.queuedResult = { status: 'unreadable' };
  }

  scan(): NfcScanCaptureResult {
    return this.queuedResult;
  }
}
