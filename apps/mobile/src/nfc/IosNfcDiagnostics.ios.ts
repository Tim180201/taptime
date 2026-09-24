import { requireOptionalNativeModule } from 'expo-modules-core';
import type { NfcDiagnosticPhase } from './IosNfcDiagnostics';
export type { NfcDiagnosticPhase } from './IosNfcDiagnostics';

export function recordNfcDiagnostic(phase: NfcDiagnosticPhase, elapsedMs: number, code: number): void {
  try {
    requireOptionalNativeModule<{ record(phase: string, elapsedMs: number, code: number): void }>(
      'TapTimeNfcDiagnostics',
    )?.record(phase, elapsedMs, code);
  } catch {
    // Diagnostics must never change capture, cancellation or ownership.
  }
}
