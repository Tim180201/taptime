import type { InvitationStatus } from './contracts';
const messages: Record<InvitationStatus,string> = {
  rate_limited:'Zu viele Anfragen. Bitte warte eine Minute, bevor du die Einladung erneut sendest.',
  succeeded:'Die Einladung wurde per E-Mail versendet.',
  succeeded_existing_account:'Das vorhandene Konto wurde als Mitarbeiter aufgenommen.',
  invalid_request:'Bitte prüfe Name, E-Mail und Standort.',
  invalid_email:'Bitte gib eine gültige E-Mail-Adresse ein.',
  command_id_conflict:'Diese Anfrage wurde mit anderen Angaben verwendet. Bitte öffne die Einladung erneut.',
  email_exists:'Diese E-Mail-Adresse ist bereits vergeben.',
  membership_exists:'Diese Person ist bereits Mitglied des Betriebs.',
  former_membership:'Für diese Person besteht eine frühere Mitgliedschaft. Bitte kläre den Zugang in der Verwaltung.',
  account_creation_not_configured:'Das Einladen ist für diesen Betrieb noch nicht eingerichtet.',
  invitation_delivery_failed:'Die Einladung konnte nicht zugestellt werden. Bitte versuche es erneut.',
  invitation_rate_limited:'Zu viele Einladungen in kurzer Zeit. Bitte warte und versuche es später erneut.',
  invitation_service_unavailable:'Der Einladungsdienst ist vorübergehend nicht erreichbar.',
  invitation_needs_attention:'Die Einladung braucht eine Prüfung in der Verwaltung.',
  authority_rejected:'Deine Berechtigung für diese Einladung ist nicht mehr gültig.',
  transient_failure:'Die Verbindung wurde unterbrochen. Bitte versuche dieselbe Einladung erneut.',
  unavailable:'Die Antwort konnte nicht bestätigt werden. Bitte versuche es erneut.',
};
export const invitationMessage = (status: InvitationStatus): string => messages[status];
export const roleName = (role: string): string => role === 'administrator' ? 'Administrator' : role === 'standortleitung' ? 'Standortleitung' : 'Mitarbeiter';
export const initials = (name: string): string => name.trim().split(/\s+/u).slice(0,2).map(n=>[...n][0]).join('').toLocaleUpperCase('de-DE');
