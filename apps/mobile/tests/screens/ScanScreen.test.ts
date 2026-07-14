import { describe, expect, it, vi } from 'vitest';
import type { ProductScanState } from '../../src/scan/contracts';

vi.mock('react-native', () => ({
  Button: () => null,
  StyleSheet: { create: <Value>(value: Value) => value },
  Text: () => null,
  View: () => null,
}));

const { presentScanState } = await import('../../src/screens/ScanScreen');

describe('ScanScreen presentation', () => {
  it.each([
    [{ status: 'checking' }, 'NFC wird geprüft'],
    [{ status: 'not_supported' }, 'NFC nicht unterstützt'],
    [{ status: 'disabled' }, 'NFC ist ausgeschaltet'],
    [{ status: 'unavailable' }, 'NFC nicht verfügbar'],
    [{ status: 'scanning' }, 'Bereit zum Erfassen'],
    [{ status: 'submitting', phase: 'scan_context' }, 'Scan wird sicher verarbeitet'],
    [{ status: 'submitting', phase: 'lifecycle' }, 'Scan wird sicher verarbeitet'],
    [{ status: 'retry_pending' }, 'Bestätigung ist unklar'],
    [{ status: 'protected_pending' }, 'Ausstehender Vorgang geschützt'],
    [{ status: 'ready', outcome: null }, 'Bereit zum Scannen'],
    [{ status: 'ready', outcome: { status: 'unreadable' } }, 'Tag nicht lesbar'],
    [{ status: 'ready', outcome: { status: 'timed_out' } }, 'Scan abgelaufen'],
    [{ status: 'ready', outcome: { status: 'cancelled' } }, 'Scan abgebrochen'],
    [{ status: 'ready', outcome: { status: 'nfc_unavailable' } }, 'NFC nicht verfügbar'],
    [{ status: 'ready', outcome: { status: 'tag_not_assigned' } }, 'Tag nicht zugeordnet'],
    [{ status: 'ready', outcome: { status: 'scan_context_unavailable' } }, 'Zuordnung nicht erreichbar'],
    [{ status: 'ready', outcome: { status: 'time_entry_started' } }, 'Arbeitszeit gestartet'],
    [{ status: 'ready', outcome: { status: 'time_entry_stopped' } }, 'Arbeitszeit gestoppt'],
    [{ status: 'ready', outcome: { status: 'duplicate_scan_ignored' } }, 'Doppelter Scan ignoriert'],
    [{ status: 'ready', outcome: { status: 'active_entry_for_other_target_rejected' } }, 'Andere Arbeitszeit ist aktiv'],
    [{ status: 'ready', outcome: { status: 'escalation_required' } }, 'Prüfung erforderlich'],
    [{ status: 'ready', outcome: { status: 'deferred' } }, 'Scan zur Prüfung vorgemerkt'],
    [{ status: 'ready', outcome: { status: 'conflict' } }, 'Scan-Konflikt'],
    [{ status: 'ready', outcome: { status: 'session_rejected' } }, 'Sitzung nicht mehr gültig'],
  ] as Array<[ProductScanState, string]>)('presents %s truthfully', (state, title) => {
    expect(presentScanState(state).title).toBe(title);
  });

  it('discloses that ambiguous evidence is volatile and only unchanged evidence can be retried', () => {
    const presentation = presentScanState({ status: 'retry_pending' });
    expect(presentation.message).toContain('App geöffnet bleibt');
    expect(presentation.message).toContain('unveränderten Daten');
    expect(presentation.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
  });

  it('does not claim a local mutation for rejected, duplicate, escalation, deferred or conflict results', () => {
    for (const status of [
      'duplicate_scan_ignored',
      'active_entry_for_other_target_rejected',
      'escalation_required',
      'deferred',
      'conflict',
    ] as const) {
      const message = presentScanState({ status: 'ready', outcome: { status } }).message;
      expect(message).not.toMatch(/lokal gestartet|lokal gestoppt|erfolgreich geändert/i);
    }
  });

  it('does not disclose protected evidence from another identity', () => {
    const presentation = presentScanState({ status: 'protected_pending' });
    expect(presentation.message).toContain('vorherige Sitzung');
    expect(presentation.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
    expect(presentation.message).not.toContain('nfc:uid');
  });
});
