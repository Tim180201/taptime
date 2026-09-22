// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { createApplicationPage } from '../src/ApplicationRoot';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import type { App } from '../src/App';
import type { ComponentProps, ReactElement } from 'react';

vi.mock('../src/SupabaseMemoryAuth', () => ({ SupabaseMemoryAuth: class {
  async withAccessToken<T>(operation: (token: string) => Promise<T>) { return operation('memory-only-token'); }
} }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['session', 'invitation'] as const)('T068a shows the pause from the production account invitation %s path', async phase => {
  if (phase === 'invitation') vi.spyOn(AdminWebApiClient.prototype, 'session').mockResolvedValue({
    status: 'succeeded', value: { membershipId: '10000000-0000-4000-8000-000000000001',
      organizationId: '20000000-0000-4000-8000-000000000001', role: 'administrator',
      locationsEnabled: false, availableSections: ['employees'], managementScope: { kind: 'organization' } },
  });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 'organization_paused' } }, { status: 403 })));
  window.history.replaceState(null, '', '/');
  const page = createApplicationPage({ supabaseUrl: 'https://synthetic.supabase.co',
    supabasePublishableKey: 'synthetic-publishable-key' }) as ReactElement<ComponentProps<typeof App>>;
  await page.props.accountInvitations!.invite('Neue Person', 'new@example.invalid', null);
  expect(page.props.administration.getState()).toEqual({ status: 'organization_paused' });
  render(page);
  expect(screen.getByText('Ihr Betrieb ist pausiert. Bitte wenden Sie sich an Taptura.')).toBeInTheDocument();
});
