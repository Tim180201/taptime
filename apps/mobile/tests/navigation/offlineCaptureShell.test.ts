import { describe, expect, it } from 'vitest';
import { canPresentOfflineCaptureShell } from '../../src/navigation/offlineCaptureShell';
import type { MobileSessionState } from '../../src/auth/contracts';
import type { ProductScanState } from '../../src/scan/contracts';

describe('offline capture shell', () => {
  it.each([
    { status: 'offline_ready', queueCount: 0, outcome: null },
    { status: 'saved_locally', queueCount: 1 },
    { status: 'scanning' },
    { status: 'synchronizing', queueCount: 1 },
    { status: 'server_review_pending', queueCount: 1 },
    {
      status: 'server_decision',
      outcome: { status: 'time_entry_started' },
      queueCount: 0,
    },
  ] satisfies ProductScanState[])(
    'presents $status only behind the typed transient session state',
    (scan) => {
      expect(canPresentOfflineCaptureShell({ status: 'context_unavailable' }, scan)).toBe(true);
      expect(canPresentOfflineCaptureShell(
        { status: 'runtime_unavailable', reason: 'authentication_unavailable' },
        scan,
      )).toBe(false);
      expect(canPresentOfflineCaptureShell({ status: 'signed_out' }, scan)).toBe(false);
    },
  );

  it.each([
    { status: 'inactive' },
    { status: 'checking' },
    { status: 'ready', outcome: null },
    { status: 'retry_pending' },
    { status: 'secure_storage_unavailable' },
    { status: 'protected_pending', reason: 'identity_mismatch' },
  ] satisfies ProductScanState[])(
    'keeps $status closed while session context is unavailable',
    (scan) => {
      const session: MobileSessionState = { status: 'context_unavailable' };
      expect(canPresentOfflineCaptureShell(session, scan)).toBe(false);
    },
  );
});
