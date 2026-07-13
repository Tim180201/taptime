import type { NfcScanCaptureResult, NfcScanPort } from '../../ports/NfcScanPort';
import { createNfcPayload } from '../../domain/NfcPayload';

function normalize(rawInput: string | undefined): NfcScanCaptureResult {
  const trimmed = rawInput?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return { status: 'unreadable' };
  }

  return { status: 'captured', payload: createNfcPayload(trimmed) };
}

// DT-001 extension (Development Sprint 005): reads a genuinely external, non-hard-coded-
// fixture scan payload (a CLI argument or stdin line, sourced by the caller) and normalizes
// it into the same NfcScanCaptureResult shape FakeNfcScanAdapter uses for tests. An empty,
// missing or whitespace-only input is treated as an explicit "unreadable" result, exactly
// like a malformed NFC payload would be. FakeNfcScanAdapter remains the test-only adapter,
// unmodified.
export class CliNfcScanAdapter implements NfcScanPort {
  private queuedResult: NfcScanCaptureResult;

  constructor(rawInput: string | undefined) {
    this.queuedResult = normalize(rawInput);
  }

  setInput(rawInput: string | undefined): void {
    this.queuedResult = normalize(rawInput);
  }

  async scan(): Promise<NfcScanCaptureResult> {
    return this.queuedResult;
  }
}
