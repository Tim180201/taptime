import { EmployeeAccountInvitationClient } from './EmployeeAccountInvitationForm';
import { App } from './App';
import { AdminWebCoordinator } from './AdminWebCoordinator';
import { AdminWebApiClient } from './AdminWebApiClient';
import { SupabaseMemoryAuth } from './SupabaseMemoryAuth';
import { SupabaseInviteAuth } from './SupabaseInviteAuth';
import { WelcomePage } from './WelcomePage';
import type { AdminWebConfiguration } from './runtimeConfiguration';

export function createApplicationPage(configuration: AdminWebConfiguration | null) {
  if (window.location.pathname === '/willkommen') {
    document.title = 'Taptura · Passwort setzen';
    const invitationUrl = window.location.href;
    // Remove even malformed links before rendering. Tokens never enter admin state,
    // query parameters, storage, diagnostics or subsequent browser navigation.
    window.history.replaceState(null, '', '/willkommen');
    return <WelcomePage invitation={configuration === null ? null : new SupabaseInviteAuth(
      configuration.supabaseUrl, configuration.supabasePublishableKey, invitationUrl,
    )} />;
  }
  if (configuration === null) return <main className="configuration-error">
    <h1>Die Verwaltung kann nicht gestartet werden</h1>
    <p role="alert">Die sichere Verbindung zum Anmeldedienst ist nicht vollständig eingerichtet.
      Prüfen Sie die Konfiguration und laden Sie die Seite anschließend neu.</p>
  </main>;
  const auth = new SupabaseMemoryAuth(configuration.supabaseUrl, configuration.supabasePublishableKey);
  const api = new AdminWebApiClient();
  return <App administration={new AdminWebCoordinator(auth, api)}
    accountInvitations={new EmployeeAccountInvitationClient(auth, api)} />;
}
