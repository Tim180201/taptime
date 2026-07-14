import { useSyncExternalStore } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type { ProductSessionContext } from '../auth/contracts';
import type { ProductScanCapability, ProductScanState } from '../scan/contracts';

interface ScanScreenProps {
  readonly session: ProductSessionContext;
  readonly scan: ProductScanCapability;
  readonly signOut: () => Promise<void>;
}

export interface ScanScreenPresentation {
  readonly title: string;
  readonly message: string;
  readonly tone: 'neutral' | 'success' | 'warning' | 'error';
}

export function ScanScreen({ session, scan, signOut }: ScanScreenProps) {
  const state = useSyncExternalStore(
    (listener) => scan.subscribe(listener),
    () => scan.getState(),
    () => scan.getState(),
  );
  const presentation = presentScanState(state);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>TapTim.e</Text>
        <Text style={styles.role}>
          {session.role === 'administrator' ? 'Administrator' : 'Mitarbeiter'}
        </Text>
      </View>

      <View
        style={[styles.statusCard, styles[`status_${presentation.tone}`]]}
        accessibilityLiveRegion="polite"
        testID="scan-status"
      >
        <Text style={styles.statusTitle}>{presentation.title}</Text>
        <Text style={styles.statusMessage}>{presentation.message}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="NFC-Tag scannen"
          onPress={() => scan.scan()}
          disabled={state.status !== 'ready'}
          accessibilityLabel="NFC-Tag jetzt scannen"
          testID="scan-button"
        />
        {state.status === 'scanning' ? (
          <Button
            title="Scan abbrechen"
            onPress={() => scan.cancel()}
            accessibilityLabel="Aktiven NFC-Scan abbrechen"
            testID="cancel-scan-button"
          />
        ) : null}
        {state.status === 'retry_pending' ? (
          <Button
            title="Unveränderte Daten erneut senden"
            onPress={() => scan.retry()}
            accessibilityLabel="Dieselben Scan-Daten erneut senden"
            testID="retry-same-evidence-button"
          />
        ) : null}
      </View>

      <View style={styles.signOut}>
        <Button
          title="Abmelden"
          onPress={signOut}
          accessibilityLabel="Von TapTim.e abmelden"
          testID="sign-out-button"
        />
      </View>
    </View>
  );
}

export function presentScanState(state: ProductScanState): ScanScreenPresentation {
  switch (state.status) {
    case 'inactive':
    case 'checking':
      return {
        title: 'NFC wird geprüft',
        message: 'Die Scan-Funktion wird sicher vorbereitet.',
        tone: 'neutral',
      };
    case 'not_supported':
      return {
        title: 'NFC nicht unterstützt',
        message: 'NFC-Scans sind in dieser App-Version nur auf unterstützten Android-Geräten möglich.',
        tone: 'warning',
      };
    case 'disabled':
      return {
        title: 'NFC ist ausgeschaltet',
        message: 'Aktiviere NFC in den Android-Einstellungen und öffne die App anschließend erneut.',
        tone: 'warning',
      };
    case 'unavailable':
      return {
        title: 'NFC nicht verfügbar',
        message: 'Die Scan-Funktion konnte nicht sicher vorbereitet werden.',
        tone: 'error',
      };
    case 'scanning':
      return {
        title: 'Bereit zum Erfassen',
        message: 'Halte das Android-Gerät an den NFC-Tag.',
        tone: 'neutral',
      };
    case 'submitting':
      return {
        title: 'Scan wird sicher verarbeitet',
        message: 'Bitte warte auf die Bestätigung des Servers.',
        tone: 'neutral',
      };
    case 'retry_pending':
      return {
        title: 'Übertragung noch offen',
        message: 'Der Scan ist sicher auf diesem Gerät vorgemerkt. Es können ausschließlich dieselben unveränderten Daten erneut gesendet werden – auch nach einem App-Neustart.',
        tone: 'warning',
      };
    case 'secure_storage_unavailable':
      return {
        title: 'Sicherer Speicher nicht verfügbar',
        message: 'Neue Scans sind zum Schutz deiner Arbeitszeit gesperrt. Starte die App einmal neu. Bleibt die Meldung bestehen, lösche weder die App noch ihre Daten und wende dich an den Support.',
        tone: 'error',
      };
    case 'protected_pending':
      return state.reason === 'legacy_membership_unknown'
        ? {
            title: 'Älterer Vorgang geschützt',
            message: 'Dieser Vorgang besitzt noch keine eindeutig zuordenbare Mitgliedschaft. Lösche weder die App noch ihre Daten und wende dich zur sicheren Klärung an den Support.',
            tone: 'warning',
          }
        : {
            title: 'Ausstehender Vorgang geschützt',
            message: 'Die aktuelle Mitgliedschaft stimmt nicht mit dem ausstehenden Vorgang überein. Er bleibt geschützt und kann nicht neu zugeordnet werden.',
            tone: 'warning',
          };
    case 'ready':
      return state.outcome === null
        ? {
            title: 'Bereit zum Scannen',
            message: 'Tippe auf „NFC-Tag scannen“ und halte das Gerät anschließend an den Tag.',
            tone: 'success',
          }
        : presentOutcome(state.outcome.status);
    default:
      return state satisfies never;
  }
}

function presentOutcome(
  status: NonNullable<Extract<ProductScanState, { status: 'ready' }>['outcome']>['status'],
): ScanScreenPresentation {
  switch (status) {
    case 'unreadable':
      return { title: 'Tag nicht lesbar', message: 'Bitte versuche den Scan erneut.', tone: 'error' };
    case 'timed_out':
      return { title: 'Scan abgelaufen', message: 'Es wurde rechtzeitig kein NFC-Tag erkannt.', tone: 'warning' };
    case 'cancelled':
      return { title: 'Scan abgebrochen', message: 'Es wurden keine Scan-Daten gesendet.', tone: 'neutral' };
    case 'nfc_unavailable':
      return { title: 'NFC nicht verfügbar', message: 'Die Scan-Funktion ist derzeit nicht verfügbar.', tone: 'error' };
    case 'tag_not_assigned':
      return { title: 'Tag nicht zugeordnet', message: 'Für diesen NFC-Tag ist keine verwendbare Zuordnung vorhanden.', tone: 'warning' };
    case 'scan_context_unavailable':
      return { title: 'Zuordnung nicht erreichbar', message: 'Es wurden noch keine Arbeitszeit-Daten gesendet. Bitte starte später einen neuen Scan.', tone: 'error' };
    case 'time_entry_started':
      return { title: 'Arbeitszeit gestartet', message: 'Der Server hat den Start bestätigt.', tone: 'success' };
    case 'time_entry_stopped':
      return { title: 'Arbeitszeit gestoppt', message: 'Der Server hat den Stopp bestätigt.', tone: 'success' };
    case 'duplicate_scan_ignored':
      return { title: 'Doppelter Scan ignoriert', message: 'Deine Arbeitszeit wurde nicht verändert.', tone: 'neutral' };
    case 'active_entry_for_other_target_rejected':
      return { title: 'Andere Arbeitszeit ist aktiv', message: 'Beende zuerst die bereits aktive Arbeitszeit. Es wurde nichts verändert.', tone: 'warning' };
    case 'escalation_required':
      return { title: 'Prüfung erforderlich', message: 'Der Scan muss geprüft werden. Deine Arbeitszeit wurde nicht stillschweigend verändert.', tone: 'warning' };
    case 'server_review_pending':
      return { title: 'Scan sicher gespeichert', message: 'Der Server hat die Scan-Evidenz gespeichert. Deine Arbeitszeit wurde noch nicht verändert und wartet auf eine sichere Prüfung.', tone: 'warning' };
    case 'session_rejected':
      return { title: 'Sitzung nicht mehr gültig', message: 'Bitte melde dich erneut an.', tone: 'error' };
    default:
      return status satisfies never;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 20,
    backgroundColor: '#f4f7f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#12372a',
  },
  role: {
    fontSize: 14,
    color: '#52635d',
  },
  statusCard: {
    minHeight: 160,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
  },
  status_neutral: { backgroundColor: '#eef3f1', borderColor: '#c6d3ce' },
  status_success: { backgroundColor: '#e7f6ed', borderColor: '#8fc9a4' },
  status_warning: { backgroundColor: '#fff7df', borderColor: '#e5c86b' },
  status_error: { backgroundColor: '#fdecea', borderColor: '#e1a29b' },
  statusTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#183c30',
    marginBottom: 10,
  },
  statusMessage: {
    fontSize: 16,
    lineHeight: 23,
    color: '#2f423b',
  },
  actions: {
    gap: 12,
    marginTop: 28,
  },
  signOut: {
    marginTop: 'auto',
    marginBottom: 28,
  },
});
