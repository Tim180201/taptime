import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createApplicationPage } from './ApplicationRoot';
import { readAdminWebConfiguration } from './runtimeConfiguration';

const configuration = readAdminWebConfiguration(import.meta.env);
const root = createRoot(document.getElementById('root')!);
root.render(<StrictMode>{createApplicationPage(configuration)}</StrictMode>);
