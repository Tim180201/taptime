import {expect,it} from 'vitest';
import {TIME_REVIEW_REASONS} from '@taptime/time-review-contract';
import {reviewReasonLabel} from '../src/viewHelpers';
const facts={employeeDisplayName:'Alex Berger',occurredAt:'2026-07-20T09:00:00.000Z',targetDisplayName:'Werkstatt'};
// TL decision, 15.10.: expected prose is independent of the implementation table.
const expected:Record<string,string>={
 event_content_conflict:'Für 20.07.2026, 11:00 liegen zwei verschiedene Angaben zur selben Erfassung von Alex Berger vor.',
 sequence_content_conflict:'Das Handy von Alex Berger hat für 20.07.2026, 11:00 dieselbe Erfassung zweimal mit unterschiedlichen Angaben geschickt.',
 receipt_metadata_conflict:'Für 20.07.2026, 11:00 liegt bereits ein Beleg vor, zu dem diese Erfassung von Alex Berger nicht passt.',
 lease_binding_conflict:'Alex Berger hat am 20.07.2026 um 11:00 offline erfasst; die Berechtigung des Handys dafür ließ sich nicht bestätigen.',
 invalid_response:'Die App von Alex Berger konnte die Antwort des Servers zur Erfassung vom 20.07.2026, 11:00 nicht verarbeiten.',
 http_400:'Die Erfassung von Alex Berger am 20.07.2026 um 11:00 enthielt ungültige Angaben.',
 http_409:'Die Erfassung von Alex Berger am 20.07.2026 um 11:00 widerspricht bereits gespeicherten Zeiten.',
 http_422:'Die Erfassung von Alex Berger am 20.07.2026 um 11:00 konnte nicht verarbeitet werden.',
 identity_or_membership_not_current:'Als die Erfassung von Alex Berger (20.07.2026, 11:00) ankam, war der Zugang der Person nicht mehr gültig.',
 capture_time_out_of_bounds:'Der Zeitpunkt der Erfassung von Alex Berger am 20.07.2026 (11:00 laut Handy) ließ sich nicht bestätigen.',
 automatic_window_elapsed:'Alex Berger hat am 20.07.2026 um 11:00 erfasst; das Handy hat es zu spät übertragen, um die Zeit automatisch zu bilden.',
 customer_deleted:'Alex Berger hat am 20.07.2026 um 11:00 für Werkstatt erfasst; dieser Kunde ist inzwischen gelöscht.',
 historical_configuration_not_valid:'Alex Berger hat am 20.07.2026 um 11:00 eine Karte benutzt, deren damalige Zuordnung sich nicht mehr bestätigen lässt.',
 predecessor_requires_review:'Vor dieser Erfassung von Alex Berger liegt ein offener Fall.',
 server_lifecycle_deferred:'Alex Berger hat am 20.07.2026 um 11:00 erfasst; daraus konnte noch keine Zeit sicher gebildet werden.',
 active_time_entry_user_mismatch:'Als Alex Berger am 20.07.2026 um 11:00 erfasst hat, lief eine Zeit, die zu einer anderen Person gehört.',
 active_time_entry_organization_mismatch:'Als Alex Berger am 20.07.2026 um 11:00 erfasst hat, lief eine Zeit, die zu einem anderen Betrieb gehört.',
 active_break_user_mismatch:'Als Alex Berger am 20.07.2026 um 11:00 erfasst hat, lief eine Pause, die zu einer anderen Person gehört.',
 active_break_organization_mismatch:'Als Alex Berger am 20.07.2026 um 11:00 erfasst hat, lief eine Pause, die zu einem anderen Betrieb gehört.',
 active_break_time_entry_mismatch:'Als Alex Berger am 20.07.2026 um 11:00 erfasst hat, lief eine Pause, die zu einer anderen Zeit gehört.',
 previous_work_event_user_mismatch:'Die Erfassung vor 20.07.2026, 11:00 gehört zu einer anderen Person.',
 previous_work_event_organization_mismatch:'Die Erfassung vor 20.07.2026, 11:00 gehört zu einem anderen Betrieb.',
 previous_work_event_target_mismatch:'Alex Berger hat am 20.07.2026 um 11:00 für Werkstatt erfasst; die Erfassung davor galt einem anderen Kunden oder Projekt.',
 previous_work_event_subject_mismatch:'Alex Berger hat am 20.07.2026 um 11:00 erfasst; die Erfassung davor war eine Pause statt einer Arbeitszeit oder umgekehrt.',
 work_event_precedes_active_time_entry:'Alex Berger hat am 20.07.2026 um 11:00 erfasst, aber die laufende Zeit hat erst später begonnen.',
 work_event_precedes_active_break:'Alex Berger hat am 20.07.2026 um 11:00 erfasst, aber die laufende Pause hat erst später begonnen.',
 work_event_precedes_previous_accepted_work_event:'Alex Berger hat am 20.07.2026 um 11:00 erfasst; das liegt vor der zuletzt bestätigten Erfassung.',
 work_location_unavailable:'Alex Berger durfte am 20.07.2026 am Standort von Werkstatt keine Zeit erfassen.',
 administration_stopped:'Die Zeit von Alex Berger wurde am 20.07.2026 um 11:00 von der Verwaltung beendet; diese Erfassung kam danach.',
};
it('covers exactly the reasons defined by the contract',()=>expect(Object.keys(expected).sort()).toEqual([...new Set(TIME_REVIEW_REASONS)].sort()));
it.each(TIME_REVIEW_REASONS)('translates %s using the TL table',reason=>expect(reviewReasonLabel(reason,facts)).toBe(expected[reason]));
it('keeps unknown reasons out of the sentence',()=>expect(reviewReasonLabel('future_reason',facts)).toBe('Alex Berger hat am 20.07.2026 um 11:00 erfasst; daraus konnte keine Zeit sicher gebildet werden. Prüfen Sie die Zeiten dieses Tages.'));
it('omits absent clauses rather than inventing names, dates or targets',()=>{
 expect(reviewReasonLabel('customer_deleted',{})).toBe('Es wurde erfasst; dieser Kunde ist inzwischen gelöscht.');
 expect(reviewReasonLabel('predecessor_requires_review',facts)).not.toContain('20.07.');
 for(const reason of TIME_REVIEW_REASONS)expect(reviewReasonLabel(reason,{})).not.toMatch(/undefined|null|\{.*\}|  /);
});
