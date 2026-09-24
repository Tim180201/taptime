export type NfcDiagnosticPhase = 'requested' | 'connected' | 'read' | 'action_finished'
  | 'cancel_ok' | 'cancel_failed' | 'session_closed' | 'deadline_expired';

/** Non-iOS fallback. Metro selects IosNfcDiagnostics.ios.ts on the iPhone. */
export function recordNfcDiagnostic(_phase: NfcDiagnosticPhase, _elapsedMs: number, _code: number): void {}
