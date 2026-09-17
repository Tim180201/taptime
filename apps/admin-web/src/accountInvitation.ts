export const ACCOUNT_INVITATION_NOTICES = {
  account_creation_not_configured: 'Kontenerstellung nicht eingerichtet. Bitte wenden Sie sich an die Betriebsverwaltung.',
  email_exists: 'Diese Adresse gehört bereits zu einem anderen Betrieb.',
  membership_exists: 'Diese Person ist bereits Mitglied Ihres Betriebs. Es wurde keine weitere Einladung versendet.',
  former_membership: 'Diese Person ist bereits ausgeschieden. Ihr Zugang bleibt gesperrt. Bitte klären Sie eine erneute Aufnahme mit der Betriebsverwaltung.',
  invitation_delivery_failed: 'Die Einladung konnte nicht versendet werden. Bitte lassen Sie den Mailversand durch die Betriebsverwaltung prüfen.',
  invitation_rate_limited: 'Zu viele Einladungen in kurzer Zeit. Bitte warten Sie eine Minute und versuchen Sie es erneut.',
  invitation_service_unavailable: 'Der Anmeldedienst ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut.',
  invitation_needs_attention: 'Die Einladung konnte nicht vollständig abgeschlossen werden. Das Konto oder die Mail kann bereits existieren. Bitte wenden Sie sich zur Klärung an die Betriebsverwaltung.',
  invalid_email: 'Diese E-Mail-Adresse wurde nicht angenommen. Bitte prüfen Sie die Adresse.',
  command_id_conflict: 'Dieser Auftrag wurde bereits mit anderen Angaben verwendet. Bitte öffnen Sie das Formular erneut.',
  invalid_request: 'Die Einladung konnte nicht verarbeitet werden. Bitte prüfen Sie Name, E-Mail und gegebenenfalls Heimatstandort.',
} as const;
export type AccountInvitationFailureCode = keyof typeof ACCOUNT_INVITATION_NOTICES;
export const ACCOUNT_INVITATION_SUCCESS_NOTICES = {
  succeeded: 'Einladung verschickt. Die Person kann ihr Passwort setzen und sich direkt in der App anmelden.',
  succeeded_existing_account: 'Konto bestand bereits — es wurde keine Mail verschickt. Die Person meldet sich mit ihrem vorhandenen Passwort an oder nutzt „Passwort vergessen“. Bitte informieren Sie die Person selbst.',
} as const;
export type AccountInvitationSuccess = keyof typeof ACCOUNT_INVITATION_SUCCESS_NOTICES;
export type AccountInvitationApiResult = { readonly status: AccountInvitationSuccess }
  | { readonly status: 'rejected' } | { readonly status: 'unreachable' }
  | { readonly status: 'invalid_response' }
  | { readonly status: 'failed'; readonly code: AccountInvitationFailureCode };
