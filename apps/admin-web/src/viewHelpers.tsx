import { BUSINESS_TIME_ZONE } from '@taptime/core';
import { isKnownTimeReviewReason, type TimeReviewReason } from '@taptime/time-review-contract';
import type { Notice } from './contracts';
import { useEffect,useRef,type MouseEvent as ReactMouseEvent,type RefObject } from 'react';
import type { AdminRoute } from './navigation';
/** TL wording from 15.10.2026; optional clauses use only facts in the response. */
export function reviewReasonLabel(value: string, facts: Partial<Pick<import('./contracts').SafeReviewItem,'employeeDisplayName'|'occurredAt'|'targetDisplayName'>> = {}): string {
  const name=facts.employeeDisplayName?.trim(), target=facts.targetDisplayName?.trim();
  const instant=facts.occurredAt ? new Date(facts.occurredAt) : null;
  const valid=instant && Number.isFinite(instant.getTime());
  const date=valid ? new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,day:'2-digit',month:'2-digit',year:'numeric'}).format(instant) : '';
  const time=valid ? new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(instant) : '';
  const who=name?` von ${name}`:'', when=date?` am ${date} um ${time}`:'', stamp=date?`${date}, ${time}`:'';
  const captured=`${name?`${name} hat`:'Es wurde'}${when}`;
  const asCaptured=`Als ${name?`${name}${when} erfasst hat`:`${when.trim()}${when?' ':''}erfasst wurde`}`;
  const labels:Record<TimeReviewReason,string>={
    event_content_conflict:`${stamp?`Für ${stamp} liegen`:'Es liegen'} zwei verschiedene Angaben zur selben Erfassung${who} vor.`,
    sequence_content_conflict:`Das Handy${who} hat${stamp?` für ${stamp}`:''} dieselbe Erfassung zweimal mit unterschiedlichen Angaben geschickt.`,
    receipt_metadata_conflict:`${stamp?`Für ${stamp} liegt`:'Es liegt'} bereits ein Beleg vor, zu dem diese Erfassung${who} nicht passt.`,
    lease_binding_conflict:`${captured} offline erfasst; die Berechtigung des Handys dafür ließ sich nicht bestätigen.`,
    invalid_response:`Die App${who} konnte die Antwort des Servers zur Erfassung${stamp?` vom ${stamp}`:''} nicht verarbeiten.`,
    http_400:`Die Erfassung${who}${when} enthielt ungültige Angaben.`,
    http_409:`Die Erfassung${who}${when} widerspricht bereits gespeicherten Zeiten.`,
    http_422:`Die Erfassung${who}${when} konnte nicht verarbeitet werden.`,
    identity_or_membership_not_current:`Als die Erfassung${who}${stamp?` (${stamp})`:''} ankam, war der Zugang der Person nicht mehr gültig.`,
    capture_time_out_of_bounds:`Der Zeitpunkt der Erfassung${who}${date?` am ${date} (${time} laut Handy)`:''} ließ sich nicht bestätigen.`,
    automatic_window_elapsed:`${captured} erfasst; das Handy hat es zu spät übertragen, um die Zeit automatisch zu bilden.`,
    customer_deleted:`${captured}${target?` für ${target}`:''} erfasst; dieser Kunde ist inzwischen gelöscht.`,
    historical_configuration_not_valid:`${name?`${name} hat${when} eine Karte benutzt`:`Es wurde${when} eine Karte benutzt`}, deren damalige Zuordnung sich nicht mehr bestätigen lässt.`,
    // The response carries neither the predecessor date nor its ID; do not invent either.
    predecessor_requires_review:`Vor dieser Erfassung${who} liegt ein offener Fall.`,
    server_lifecycle_deferred:`${captured} erfasst; daraus konnte noch keine Zeit sicher gebildet werden.`,
    active_time_entry_user_mismatch:`${asCaptured}, lief eine Zeit, die zu einer anderen Person gehört.`,
    active_time_entry_organization_mismatch:`${asCaptured}, lief eine Zeit, die zu einem anderen Betrieb gehört.`,
    active_break_user_mismatch:`${asCaptured}, lief eine Pause, die zu einer anderen Person gehört.`,
    active_break_organization_mismatch:`${asCaptured}, lief eine Pause, die zu einem anderen Betrieb gehört.`,
    active_break_time_entry_mismatch:`${asCaptured}, lief eine Pause, die zu einer anderen Zeit gehört.`,
    previous_work_event_user_mismatch:`Die Erfassung${stamp?` vor ${stamp}`:' davor'} gehört zu einer anderen Person.`,
    previous_work_event_organization_mismatch:`Die Erfassung${stamp?` vor ${stamp}`:' davor'} gehört zu einem anderen Betrieb.`,
    previous_work_event_target_mismatch:`${captured}${target?` für ${target}`:''} erfasst; die Erfassung davor galt einem anderen Kunden oder Projekt.`,
    previous_work_event_subject_mismatch:`${captured} erfasst; die Erfassung davor war eine Pause statt einer Arbeitszeit oder umgekehrt.`,
    work_event_precedes_active_time_entry:`${captured} erfasst, aber die laufende Zeit hat erst später begonnen.`,
    work_event_precedes_active_break:`${captured} erfasst, aber die laufende Pause hat erst später begonnen.`,
    work_event_precedes_previous_accepted_work_event:`${captured} erfasst; das liegt vor der zuletzt bestätigten Erfassung.`,
    work_location_unavailable:`${name?`${name} durfte`:'Es durfte'}${date?` am ${date}`:''}${target?` am Standort von ${target}`:''} keine Zeit ${name?'erfassen':'erfasst werden'}.`,
    administration_stopped:`Die Zeit${who} wurde${when} von der Verwaltung beendet; diese Erfassung kam danach.`,
  };
  return isKnownTimeReviewReason(value) ? labels[value] : `${captured} erfasst; daraus konnte keine Zeit sicher gebildet werden. Prüfen Sie die Zeiten dieses Tages.`;
}

export function resolutionLabel(value: string): string {
  if (value === 'no_time_record_change') return 'Ohne Zeitänderung schließen';
  if (value === 'create_recovered_time_record') return 'Fehlende Arbeitszeit ergänzen';
  return 'Vorhandene Arbeitszeit ändern';
}

export function targetLabel(value: 'customer' | 'project' | 'general_work'): string {
  if (value === 'customer') return 'Kunde';
  if (value === 'project') return 'Projekt';
  return 'Allgemeine Arbeitszeit';
}

export function triggerLabel(value: 'nfc' | 'manual' | 'administration'): string {
  return value === 'administration' ? 'Von der Verwaltung beendet' : value === 'nfc' ? 'Gescannt' : 'Manuell erfasst';
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
