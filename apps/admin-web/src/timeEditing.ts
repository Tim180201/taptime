import type { SafeOwnTimeRecord, SafeWorkTarget, TimeSupplementResult } from '@taptime/mobile-work-contract';

export type TimeEditInput =
  | { readonly kind: 'backfill'; readonly targetMembershipId: string; readonly target: SafeWorkTarget;
      readonly startedAt: string; readonly stoppedAt: string; readonly reason: string | null; readonly comment: string | null }
  | { readonly kind: 'comment'; readonly targetMembershipId: string; readonly record: SafeOwnTimeRecord; readonly comment: string }
  | { readonly kind: 'correct'; readonly targetMembershipId: string; readonly record: SafeOwnTimeRecord;
      readonly startedAt: string; readonly stoppedAt: string; readonly reason: string };
export type TimeEditResult = TimeSupplementResult | { readonly status: 'offline' | 'busy' | 'conflict' | 'not_adjustable' };
export const timeEditMessages: Record<TimeEditResult['status'], string> = {
  committed: 'Gespeichert.', offline: 'Nur online möglich. Ihre Eingaben bleiben erhalten.', busy: 'Ein Eintrag wird noch gespeichert.',
  authority_rejected: 'Ihre Berechtigung wurde nicht bestätigt. Aktualisieren Sie Ihre Sitzung.',
  invalid_request: 'Prüfen Sie die Eingaben. Texte dürfen höchstens 500 Zeichen enthalten.',
  invalid_interval: 'Die Zeit muss beendet sein, in der Vergangenheit liegen und darf höchstens 24 Stunden dauern.',
  outside_window: 'Sie können Zeiten im laufenden Monat und im Vormonat nachtragen.',
  reason_required: 'Bitte begründen Sie den Nachtrag.', invalid_comment: 'Der Kommentar braucht 1 bis 500 Zeichen.',
  overlap: 'Die Zeit überschneidet sich mit einem anderen Eintrag. Prüfen Sie Ihre Zeiten.',
  command_id_conflict: 'Dieser Speichervorgang wurde bereits mit anderen Angaben verwendet. Aktualisieren Sie die Ansicht.',
  unavailable: 'Die Speicherung konnte nicht bestätigt werden. Versuchen Sie es erneut; Ihre Eingaben bleiben erhalten.',
  conflict: 'Der Eintrag wurde inzwischen geändert. Aktualisieren Sie die Ansicht.',
  not_adjustable: 'Dieser Eintrag kann nicht geändert werden. Aktualisieren Sie die Ansicht.',
};
