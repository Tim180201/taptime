import type { ManualLifecycleRequest, ManualBreakLifecycleRequest } from '@taptime/mobile-work-contract';

const messages = {
  time_entry_started: 'Arbeitszeit gestartet.',
  time_entry_stopped: 'Arbeitszeit beendet.',
  break_started: 'Pause gestartet.',
  break_stopped: 'Pause beendet.',
  duplicate_scan_ignored: 'Das Ereignis wurde bereits berücksichtigt. Keine weitere Buchung.',
  active_entry_for_other_target_rejected: 'Es läuft bereits eine Arbeitszeit für ein anderes Ziel. Erfassen Sie zunächst dort erneut, um sie zu beenden.',
  break_without_active_time_entry_rejected: 'Eine Pause benötigt eine laufende Arbeitszeit.',
  work_trigger_during_break_rejected: 'Es läuft eine Pause. Erfassen Sie zunächst die Pause erneut, um sie zu beenden.',
  escalation_required: 'Das Ereignis erfordert eine Prüfung. Es wurde keine neue Arbeitszeit bestätigt.',
} as const;
export type ManualResult =
  | {readonly status:'synchronized'; readonly decision:keyof typeof messages}
  | {readonly status:'deferred';readonly evidenceStored:boolean};
const object=(value:unknown):value is Record<string,unknown>=>typeof value === 'object' && value !== null && !Array.isArray(value);
const exact=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const uuid=(value:unknown)=>typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

export function parseManualResult(value:unknown,request:ManualLifecycleRequest | ManualBreakLifecycleRequest):ManualResult|null {
  if (!object(value)) return null;
  if (value.status === 'deferred') {
    if (value.evidenceStored === false && exact(value,['status','evidenceStored','reason'])
      && value.reason === 'configuration_unavailable_or_inactive') return {status:'deferred',evidenceStored:false};
    if (value.evidenceStored === true && exact(value,['status','evidenceStored','idempotentRetry','workEventId','receiptId'])
      && typeof value.idempotentRetry === 'boolean' && value.workEventId === request.workEvent.id
      && value.receiptId === request.receipt.id) return {status:'deferred',evidenceStored:true};
    return null;
  }
  if (value.status !== 'synchronized' || !exact(value,['status','idempotentRetry','decision','workEventId','receiptId','serverTimeEntryId'])
    || typeof value.idempotentRetry !== 'boolean' || value.workEventId !== request.workEvent.id
    || value.receiptId !== request.receipt.id || (value.serverTimeEntryId !== null && !uuid(value.serverTimeEntryId))
    || !object(value.decision)) return null;
  const decision=value.decision;
  const fields:Record<keyof typeof messages,readonly string[]>={
    time_entry_started:['timeEntryId'],time_entry_stopped:['timeEntryId'],
    break_started:['timeEntryId','breakIntervalId'],break_stopped:['timeEntryId','breakIntervalId'],
    duplicate_scan_ignored:['previousWorkEventId'],active_entry_for_other_target_rejected:['activeTimeEntryId'],
    break_without_active_time_entry_rejected:[],work_trigger_during_break_rejected:['activeTimeEntryId','activeBreakIntervalId'],
    escalation_required:['reason'],
  };
  if (typeof decision.status !== 'string' || !Object.hasOwn(fields,decision.status)) return null;
  const status=decision.status as keyof typeof messages;
  if (!exact(decision,['status',...fields[status]]) || !fields[status].every(key=>key === 'reason'
    ? typeof decision[key] === 'string' && decision[key].length > 0 : uuid(decision[key]))) return null;
  return {status:'synchronized',decision:status};
}
export function manualResultMessage(result:ManualResult):string {
  return result.status === 'synchronized' ? messages[result.decision] : result.evidenceStored
    ? 'Das Ereignis ist sicher gespeichert. Die Verarbeitung ist noch offen. Fragen Sie die Bestätigung erneut ab.'
    : 'Das Ereignis wurde nicht gespeichert. Das Arbeitsziel ist zurzeit nicht verfügbar. Laden Sie die Ziele erneut.';
}
