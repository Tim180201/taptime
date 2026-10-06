import type {ManualTriggerOutcome} from './contracts';

export function manualCaptureOutcome(outcome: ManualTriggerOutcome): string {
  if (outcome === 'time_entry_started') return 'Arbeitszeit gestartet';
  if (outcome === 'time_entry_stopped') return 'Arbeitszeit gestoppt';
  if (outcome === 'duplicate_scan_ignored') return 'Doppelte Erfassung; deine Arbeitszeit bleibt unverändert';
  if (outcome === 'active_entry_for_other_target_rejected') {
    return 'Eine andere Arbeitszeit ist aktiv.';
  }
  if (outcome === 'break_started') return 'Pause begonnen';
  if (outcome === 'break_stopped') return 'Pause beendet';
  if (outcome === 'break_without_active_time_entry_rejected') {
    return 'Ohne laufende Arbeitszeit ist keine Pause möglich.';
  }
  if (outcome === 'work_trigger_during_break_rejected') {
    return 'Deine Arbeitszeit bleibt unverändert. Beende zuerst die Pause über „Pause beenden“.';
  }
  if (outcome === 'work_location_unavailable') return 'Das Arbeitsziel ist keinem für dich berechtigten Standort zugeordnet. Deine Arbeitszeit bleibt unverändert; bitte die Verwaltung um Prüfung.';
  if (outcome === 'escalation_required') return 'Deine Arbeitszeit bleibt unverändert. Bitte die Verwaltung, die Erfassung zu prüfen.';
  if (outcome === 'rejected') return 'Sitzung nicht mehr gültig';
  if (outcome === 'not_transferred') return 'Deine Erfassung konnte nicht übertragen werden. Der Beleg bleibt auf dem Handy. Prüfe „Meine Zeiten“.';
  if (outcome === 'pending') return 'Deine Erfassung ist gespeichert, wird übertragen.';
  return outcome satisfies never;
}

