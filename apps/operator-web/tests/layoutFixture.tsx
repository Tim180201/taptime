import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import { OperatorRuntime, OperatorError, type OperatorAuth } from '../src/OperatorRuntime';
// Synthetic test account only; this entry never belongs to the production build.
const variant = window.location.hash.slice(1) || (window as unknown as { layoutScenario: string }).layoutScenario;
let token: string | null = variant.startsWith('login') ? null : variant.startsWith('mfa') ? 'aal1' : 'aal2';
const auth: OperatorAuth = {
  getAccessToken: async () => token,
  signIn: async () => { if (variant === 'login-busy') return new Promise(() => {}); throw new OperatorError('credentials_rejected'); },
  signOut: async () => { token = null; }, onSignedOut: () => () => {},
  prepareMfa: async () => variant === 'mfa-existing' ? { factorId: 'synthetic' } : { factorId: 'synthetic',
    qrCode: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="220" height="220"%3E%3Cpath d="M10 10h60v60H10zM150 10h60v60h-60zM10 150h60v60H10zM90 90h40v40H90z"/%3E%3C/svg%3E', secret: 'SYNTHETICEXAMPLEKEYNOTAREALSECRET234567' },
  verifyMfa: async () => { if (variant === 'mfa-busy') return new Promise(() => {}); throw new OperatorError('mfa_invalid'); },
};
const organization = { organization_id: '30000000-0000-4000-8000-000000000001', name: 'Beispiel Gebäudereinigung', status: 'active', created_at: '2026-09-01T10:00:00Z', row_version: 3,
  administrators: 1, location_managers: 2, employees: 8, active_now: 4, last_tap: '2026-09-23T09:00:00Z', tags: 5, active_assignments: 4, open_invitations: 1 };
sessionStorage.setItem('taptime-operator-last-activity', String(Date.now()));
const runtime = new OperatorRuntime(auth, sessionStorage, async (input) => {
  const path = String(input).replace('/v1/operator/', '');
  if (variant.endsWith('-busy') && path.startsWith('organizations/')) return new Promise(() => {});
  if (variant === 'checking' || (variant.endsWith('loading') && path !== 'session')) return new Promise(() => {});
  if ((variant === 'blocked' && path === 'session') || ((variant === 'error' || variant === 'audit-error' || variant === 'health-error') && path !== 'session') || path.startsWith('organizations/')) return Response.json({ error: { code: variant.startsWith('create') ? 'identity_unavailable' : 'service_unavailable' } }, { status: 503 });
  const replies: Record<string, unknown> = {
    session: { status: token === 'aal2' ? 'active' : 'mfa_required', aal: token },
    overview: { status: 'succeeded', organizations: variant === 'empty' ? [] : [organization, { ...organization, organization_id: '30000000-0000-4000-8000-000000000002', name: 'Beispiel Hausmeisterdienst', status: 'paused', active_now: 0, last_tap: null }],
      totals: { organizations: 2, administrators: 2, location_managers: 2, employees: 16, active_now: 4, taps_today: 27 } },
    audit: { status: 'succeeded', events: variant === 'audit-empty' ? [] : [{ id: '51', organization_id: organization.organization_id, action: 'organization_paused', reason: 'Auf Wunsch des Betriebs', created_at: '2026-09-23T09:00:00Z', actor: 'operator' }], next_before: '51' },
    health: { status: 'succeeded', database_bytes: 1048576, last_archived_at: variant === 'health-missing' ? null : '2026-09-23T09:00:00Z', last_base_at: null, version: variant === 'health-missing' ? null : 'example' },
  };
  if (!(path in replies)) throw new Error('Unexpected test request');
  return Response.json(replies[path]);
});
createRoot(document.getElementById('root')!).render(<App runtime={runtime} />);
