import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AdminWebCoordinator } from './AdminWebCoordinator';
import { readAdminWebConfiguration } from './runtimeConfiguration';
import { SupabaseMemoryAuth } from './SupabaseMemoryAuth';

const configuration = readAdminWebConfiguration(import.meta.env);
const root = createRoot(document.getElementById('root')!);
root.render(configuration === null ? <main style={{ padding: 32 }}><h1>TapTim.e ist nicht konfiguriert.</h1></main> : <StrictMode><App administration={new AdminWebCoordinator(new SupabaseMemoryAuth(configuration.supabaseUrl, configuration.supabasePublishableKey))} /></StrictMode>);
