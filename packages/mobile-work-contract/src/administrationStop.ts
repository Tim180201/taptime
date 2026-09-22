export interface AdministrationStopRequest {
  readonly expectedMembershipId: string;
  readonly targetMembershipId: string;
  readonly timeRecordId: string;
  readonly expectedRowVersion: number;
  readonly commandId: string;
  readonly stoppedAt: string;
  readonly reason: string;
}
export type AdministrationStopResult =
  | { readonly status: 'committed'; readonly timeRecordId: string; readonly idempotentRetry: boolean; readonly requiredWalFile: string; readonly offsiteArchived: boolean }
  | { readonly status: 'authority_rejected' | 'invalid_request' | 'invalid_interval' | 'reason_required' | 'conflict' | 'command_id_conflict' | 'end_before_break' | 'unavailable' };
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const exact = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(n => Object.hasOwn(v, n));
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export function isAdministrationStopRequest(v: unknown): v is AdministrationStopRequest {
  return object(v) && exact(v, ['expectedMembershipId', 'targetMembershipId', 'timeRecordId', 'expectedRowVersion', 'commandId', 'stoppedAt', 'reason'])
    && uuid(v.expectedMembershipId) && uuid(v.targetMembershipId) && uuid(v.timeRecordId) && uuid(v.commandId)
    && Number.isSafeInteger(v.expectedRowVersion) && Number(v.expectedRowVersion) > 0
    && typeof v.stoppedAt === 'string' && Number.isFinite(Date.parse(v.stoppedAt)) && new Date(v.stoppedAt).toISOString() === v.stoppedAt
    && typeof v.reason === 'string' && Array.from(v.reason).length <= 500;
}
export function isAdministrationStopResult(v: unknown): v is AdministrationStopResult {
  return object(v) && (v.status === 'committed'
    ? exact(v, ['status', 'timeRecordId', 'idempotentRetry', 'requiredWalFile', 'offsiteArchived']) && uuid(v.timeRecordId) && typeof v.idempotentRetry === 'boolean' && typeof v.requiredWalFile === 'string' && /^[0-9A-F]{24}$/.test(v.requiredWalFile) && typeof v.offsiteArchived === 'boolean'
    : exact(v, ['status']) && ['authority_rejected', 'invalid_request', 'invalid_interval', 'reason_required', 'conflict', 'command_id_conflict', 'end_before_break', 'unavailable'].includes(String(v.status)));
}
export function administrationStopMessage(result: AdministrationStopResult, mobile = false): string {
  switch (result.status) {
    case 'committed': return result.offsiteArchived ? 'Gespeichert.' : 'Wird gesichert …';
    case 'end_before_break': return 'Die Endzeit liegt vor einer erfassten Pause.';
    case 'invalid_interval': return 'Die Endzeit muss nach dem Beginn, spätestens 24 Stunden danach und darf nicht in der Zukunft liegen.';
    case 'reason_required': return 'Bitte einen Grund mit 1 bis 500 Zeichen eingeben.';
    case 'conflict': return mobile ? 'Der Eintrag wurde inzwischen geändert. Lade den Kalender neu.' : 'Der Eintrag wurde inzwischen geändert. Laden Sie den Kalender neu.';
    case 'authority_rejected': return 'Die Berechtigung zum Beenden fehlt.';
    case 'invalid_request': return 'Bitte die Eingaben prüfen.';
    case 'command_id_conflict': return 'Die Anfrage wurde bereits mit anderen Angaben verwendet.';
    case 'unavailable': return 'Die Zeit konnte nicht beendet werden. Bitte mit denselben Angaben erneut versuchen.';
  }
}
