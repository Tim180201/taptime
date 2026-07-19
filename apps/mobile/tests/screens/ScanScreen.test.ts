import { describe, expect, it, vi } from 'vitest';
import type { ProductScanState } from '../../src/scan/contracts';

vi.mock('react-native', () => ({
  Button: () => null,
  StyleSheet: { create: <Value>(value: Value) => value },
  Text: () => null,
  View: () => null,
}));

const { presentActor, presentScanState } = await import('../../src/screens/ScanScreen');

describe('ScanScreen presentation', () => {
  it('labels offline capture without disclosing a retained account identity', () => {
    expect(presentActor('administrator')).toBe('Administrator');
    expect(presentActor('employee')).toBe('Mitarbeiter');
    expect(presentActor('offline')).toBe('Offline-Erfassung');
  });

  it.each([
    [{ status: 'checking' }, 'NFC wird geprüft'],
    [{ status: 'not_supported' }, 'NFC nicht unterstützt'],
    [{ status: 'disabled' }, 'NFC ist ausgeschaltet'],
    [{ status: 'unavailable' }, 'NFC nicht verfügbar'],
    [{ status: 'scanning' }, 'Bereit zum Erfassen'],
    [{ status: 'submitting', phase: 'scan_context' }, 'Scan wird sicher verarbeitet'],
    [{ status: 'submitting', phase: 'lifecycle' }, 'Scan wird sicher verarbeitet'],
    [{ status: 'retry_pending' }, 'Übertragung noch offen'],
    [{ status: 'secure_storage_unavailable' }, 'Sicherer Speicher nicht verfügbar'],
    [{ status: 'protected_pending', reason: 'identity_mismatch' }, 'Ausstehender Vorgang geschützt'],
    [{ status: 'protected_pending', reason: 'legacy_membership_unknown' }, 'Älterer Vorgang geschützt'],
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
    [{ status: 'ready', outcome: { status: 'server_review_pending' } }, 'Scan sicher gespeichert'],
    [{ status: 'ready', outcome: { status: 'session_rejected' } }, 'Sitzung nicht mehr gültig'],
  ] as Array<[ProductScanState, string]>)('presents %s truthfully', (state, title) => {
    expect(presentScanState(state).title).toBe(title);
  });

  it('discloses that pending evidence survives restart and only unchanged evidence can be retried', () => {
    const presentation = presentScanState({ status: 'retry_pending' });
    expect(presentation.message).toContain('App-Neustart');
    expect(presentation.message).toContain('unveränderten Daten');
    expect(presentation.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
  });

  it('does not claim a local mutation for rejected, duplicate, escalation or deferred evidence', () => {
    for (const status of [
      'duplicate_scan_ignored',
      'active_entry_for_other_target_rejected',
      'escalation_required',
      'server_review_pending',
    ] as const) {
      const message = presentScanState({ status: 'ready', outcome: { status } }).message;
      expect(message).not.toMatch(/lokal gestartet|lokal gestoppt|erfolgreich geändert/i);
    }
  });

  it('does not disclose protected evidence from another identity', () => {
    const presentation = presentScanState({
      status: 'protected_pending', reason: 'identity_mismatch',
    });
    expect(presentation.message).toContain('nicht mit dem ausstehenden Vorgang überein');
    expect(presentation.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
    expect(presentation.message).not.toContain('nfc:uid');
  });

  it('gives protected legacy evidence support guidance without identifiers', () => {
    const presentation = presentScanState({
      status: 'protected_pending', reason: 'legacy_membership_unknown',
    });
    expect(presentation.message).toContain('keine eindeutig zuordenbare Mitgliedschaft');
    expect(presentation.message).toContain('Support');
    expect(presentation.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27,}/i);
  });

  it('does not promise that restart repairs a persistent secure-storage failure', () => {
    const presentation = presentScanState({ status: 'secure_storage_unavailable' });
    expect(presentation.message).toContain('Bleibt die Meldung bestehen');
    expect(presentation.message).toContain('wende dich an den Support');
    expect(presentation.message).toContain('lösche weder die App noch ihre Daten');
    expect(presentation.message).not.toContain('versuche es dann noch einmal');
  });
});
