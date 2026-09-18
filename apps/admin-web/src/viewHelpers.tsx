import { useEffect,useRef,type MouseEvent as ReactMouseEvent,type RefObject } from 'react';
import type { AdminRoute } from './navigation';
export function reviewReasonLabel(value: string): string {
  const labels: Record<string, string> = {
    identity_or_membership_not_current: 'Identität oder Mitgliedschaft nicht aktuell',
    capture_time_out_of_bounds: 'Erfassungszeit außerhalb des Fensters',
    automatic_window_elapsed: 'Automatisches Zeitfenster abgelaufen',
    historical_configuration_not_valid: 'Historische Konfiguration ungültig',
    predecessor_requires_review: 'Vorgänger muss geprüft werden',
    server_lifecycle_deferred: 'Verarbeitung auf dem Server zurückgestellt',
    active_time_entry_organization_mismatch: 'Laufende Arbeitszeit gehört zu einem anderen Betrieb',
    active_time_entry_user_mismatch: 'Laufende Arbeitszeit gehört zu einer anderen Person',
    previous_work_event_organization_mismatch: 'Vorherige Erfassung gehört zu einem anderen Betrieb',
    previous_work_event_user_mismatch: 'Vorherige Erfassung gehört zu einer anderen Person',
    previous_work_event_target_mismatch: 'Vorherige Erfassung gehört zu einem anderen Ziel',
    work_event_precedes_active_time_entry: 'Erfassung liegt vor dem Beginn der laufenden Arbeitszeit',
    work_event_precedes_previous_accepted_work_event: 'Erfassung liegt vor der vorherigen bestätigten Erfassung',
  };
  return labels[value] ?? 'Prüfung erforderlich';
}

export function resolutionLabel(value: string): string {
  if (value === 'no_time_record_change') return 'Keine Arbeitszeit ändern';
  if (value === 'create_recovered_time_record') return 'Arbeitszeit wiederherstellen';
  return 'Bestehende Arbeitszeit korrigieren';
}

export function targetLabel(value: 'customer' | 'project' | 'general_work'): string {
  if (value === 'customer') return 'Kunde';
  if (value === 'project') return 'Projekt';
  return 'Allgemeine Arbeitszeit';
}

export function triggerLabel(value: 'nfc' | 'manual'): string {
  return value === 'nfc' ? 'Gescannt' : 'Manuell erfasst';
}

export function captureLabel(
  startedVia: 'nfc' | 'manual' | null,
  stoppedVia: 'nfc' | 'manual' | null,
): string {
  const labels = [startedVia, stoppedVia]
    .filter((value): value is 'nfc' | 'manual' => value !== null)
    .map(triggerLabel);
  return labels.length === 0 ? 'Nicht überliefert' : [...new Set(labels)].join(' / ');
}

export function navigateFromLink(
  event: ReactMouseEvent<HTMLAnchorElement>,
  route: AdminRoute,
  navigate: (route: AdminRoute) => void,
): void {
  if (
    event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) return;
  event.preventDefault();
  navigate(route);
}

export function recentTimeWindow(): { readonly fromInclusive: string; readonly toExclusive: string } {
  const to = Date.now();
  return Object.freeze({
    fromInclusive: new Date(to - 31 * 24 * 60 * 60 * 1_000).toISOString(),
    toExclusive: new Date(to).toISOString(),
  });
}

export function FeedbackBand({ message }: { readonly message: string }) {
  const error = isErrorMessage(message);
  return <section className={`notice ${error ? 'notice-error' : 'notice-success'}`}
    role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'}>
    <strong>{error ? 'Die Aktion wurde nicht abgeschlossen' : 'Erledigt'}</strong>
    <p>{message}</p>
  </section>;
}

export function isErrorMessage(message: string): boolean {
  return !new Set([
    'Falls das Konto existiert, wurde eine Wiederherstellungs-E-Mail versendet.',
    'Das Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.',
    'Kunde wurde sicher angelegt.',
    'Projekt wurde sicher angelegt.',
    'Projekt wurde deaktiviert.',
    'Einladung wurde einmalig erzeugt.',
    'Zugang wurde entzogen.',
    'Rolle wurde geändert.',
    'Einladungsgeheimnis wurde verworfen.',
    'Änderung wurde verworfen.',
    'NFC-Tag wurde sicher neu zugeordnet.',
    'Die Zuordnung war bereits korrekt.',
    'Korrektur wurde verworfen.',
    'Die Arbeitszeit wurde korrigiert. Die ursprüngliche Fassung bleibt lückenlos erhalten.',
    'Die Prüfentscheidung wurde verworfen.',
    'Die Prüfentscheidung wurde lückenlos protokolliert.',
    'Die CSV-Datei wurde erstellt und heruntergeladen.',
  ]).has(message);
}

export function returnFocus(...references: readonly RefObject<HTMLElement | null>[]): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => focusFirstAvailable(references));
  } else {
    focusFirstAvailable(references);
  }
}

export function useIntentFocusReturn(
  intentPresent: boolean,
  ...targets: readonly RefObject<HTMLElement | null>[]
): void {
  const previousIntent = useRef(intentPresent);
  const pendingReturn = useRef(false);
  if (previousIntent.current && !intentPresent) pendingReturn.current = true;
  previousIntent.current = intentPresent;
  useEffect(() => {
    if (!pendingReturn.current) return;
    pendingReturn.current = !focusFirstAvailable(targets);
  });
}

export function focusFirstAvailable(
  references: readonly RefObject<HTMLElement | null>[],
): boolean {
  for (const reference of references) {
    const element = reference.current;
    if (
      element === null
      || !element.isConnected
      || element.hasAttribute('disabled')
      || element.getAttribute('aria-disabled') === 'true'
    ) continue;
    element.focus();
    if (document.activeElement === element) return true;
  }
  return false;
}
