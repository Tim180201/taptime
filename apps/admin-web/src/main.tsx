import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AdminWebCoordinator } from './AdminWebCoordinator';
import { readAdminWebConfiguration } from './runtimeConfiguration';
import { SupabaseMemoryAuth } from './SupabaseMemoryAuth';

const configuration = readAdminWebConfiguration(import.meta.env);
const root = createRoot(document.getElementById('root')!);
root.render(configuration === null
  ? <main style={{ padding: 32 }}>
      <h1>Die Verwaltung kann nicht gestartet werden</h1>
      <p role="alert">Die sichere Verbindung zum Anmeldedienst ist nicht vollständig eingerichtet.
        Prüfen Sie die Konfiguration und laden Sie die Seite anschließend neu.</p>
    </main>
  : <StrictMode><App administration={new AdminWebCoordinator(
      new SupabaseMemoryAuth(configuration.supabaseUrl, configuration.supabasePublishableKey),
    )} /></StrictMode>);
