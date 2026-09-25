import type { Notice } from './contracts';
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
    administration_stopped: 'Zeit wurde von der Verwaltung beendet',
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

export function triggerLabel(value: 'nfc' | 'manual' | 'administration'): string {
  return value === 'administration' ? 'Beendet durch Verwaltung' : value === 'nfc' ? 'Gescannt' : 'Manuell erfasst';
}

export function captureLabel(
  startedVia: 'nfc' | 'manual' | null,
  stoppedVia: 'nfc' | 'manual' | 'administration' | null,
): string {
  const labels = [startedVia, stoppedVia]
    .filter((value): value is 'nfc' | 'manual' | 'administration' => value !== null)
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

export function FeedbackBand({ message }: { readonly message: Notice }) {
  const error = message.kind === 'error';
  return <section className={`notice notice-${message.kind}`}
    role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'}>
    <strong>{error ? 'Die Aktion wurde nicht abgeschlossen' : message.kind === 'success' ? 'Erledigt' : 'Hinweis'}</strong>
    <p>{message.text}</p>
  </section>;
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
