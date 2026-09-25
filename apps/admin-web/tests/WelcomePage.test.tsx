// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  createClient: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  administration: vi.fn(), adminAuth: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.createClient }));
vi.mock('../src/AdminWebCoordinator', () => ({ AdminWebCoordinator: sdk.administration }));
vi.mock('../src/SupabaseMemoryAuth', () => ({ SupabaseMemoryAuth: sdk.adminAuth }));

import { createApplicationPage } from '../src/ApplicationRoot';
import { SupabaseInviteAuth } from '../src/SupabaseInviteAuth';

const token = 'a'.repeat(64);
const configuration = {
  supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'public-test-key',
};
const url = `https://admin.example.test/willkommen#token_hash=${token}&type=invite`;

describe('T-047 standalone welcome route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.createClient.mockReturnValue({ auth: {
      verifyOtp: sdk.verifyOtp, updateUser: sdk.updateUser, signOut: sdk.signOut,
    } });
    sdk.verifyOtp.mockResolvedValue({ error: null, data: { session: { access_token: 'test-only' } } });
    sdk.updateUser.mockResolvedValue({ error: null });
    sdk.signOut.mockResolvedValue({ error: null });
    window.history.replaceState(null, '', `/willkommen#token_hash=${token}&type=invite`);
  });
  afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });

  it('routes the real entry point around all administration and consumes the token only on submit', async () => {
    render(createApplicationPage(configuration));
    expect(document.title).toBe('Taptura · Passwort setzen');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    expect(sdk.verifyOtp).not.toHaveBeenCalled();
    expect(sdk.administration).not.toHaveBeenCalled();
    expect(sdk.adminAuth).not.toHaveBeenCalled();
    expect(sdk.createClient).toHaveBeenCalledWith(configuration.supabaseUrl,
      configuration.supabasePublishableKey,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'new-test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ihr Passwort ist gespeichert.'));
    expect(screen.getByRole('link',{name:'Im Browser anmelden'})).toHaveAttribute('href','/');
    expect(screen.getByText('In der App anmelden; die App erhalten Sie von Ihrem Betrieb.')).toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Im Browser anmelden'})).toHaveAttribute('href','/');
    expect(sdk.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: token, type: 'invite' });
    expect(sdk.updateUser).toHaveBeenCalledExactlyOnceWith({ password: 'new-test-password' });
    expect(sdk.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
    expect(sdk.administration).not.toHaveBeenCalled();
    expect(sdk.adminAuth).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it.each([
    '/willkommen',
    `/willkommen#token_hash=${token}&type=recovery`,
    `/willkommen#token_hash=${token}&type=invite&type=invite`,
    `/willkommen#token_hash=${token}&token_hash=${token}&type=invite`,
    `/willkommen#token_hash=${token}&type=invite&redirect_to=/beschaeftigte`,
    `/willkommen?token_hash=${token}&type=invite`,
  ])('rejects missing, ambiguous or wrong-purpose credentials at %s', (path) => {
    window.history.replaceState(null, '', path);
    render(createApplicationPage(configuration));
    expect(screen.getByRole('alert')).toHaveTextContent('ungültig oder abgelaufen');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(sdk.createClient).not.toHaveBeenCalled();
    expect(sdk.administration).not.toHaveBeenCalled();
    expect(sdk.adminAuth).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
  });

  it('never falls back to administration when configuration is missing', () => {
    render(createApplicationPage(null));
    expect(screen.getByRole('alert')).toHaveTextContent('Kontoeinrichtung ist nicht verfügbar');
    expect(sdk.administration).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('preserves the password after a policy rejection and reuses only the invitation session', async () => {
    sdk.updateUser.mockResolvedValueOnce({ error: { code: 'weak_password', message: 'UNSAFE_PROVIDER_DETAIL' } });
    render(createApplicationPage(configuration));
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'first-test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nicht angenommen'));
    expect(screen.getByLabelText('Neues Passwort')).toHaveValue('first-test-password');
    expect(document.body.textContent).not.toContain('UNSAFE_PROVIDER_DETAIL');
    fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: 'stronger-test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));
    await screen.findByRole('status');
    expect(sdk.verifyOtp).toHaveBeenCalledTimes(1);
    expect(sdk.updateUser).toHaveBeenCalledTimes(2);
  });

  it.each([
    [{ code: 'otp_expired' }, 'invalid_invitation'],
    [{ code: 'invite_not_found' }, 'invalid_invitation'],
    [{ status: 429 }, 'rate_limited'],
    [{ code: 'unexpected_failure' }, 'unavailable'],
  ] as const)('maps provider verification errors without updating a password (%j)', async (error, expected) => {
    sdk.verifyOtp.mockResolvedValue({ error, data: { session: null } });
    const auth = new SupabaseInviteAuth(configuration.supabaseUrl, configuration.supabasePublishableKey, url);
    await expect(auth.setPassword('test-password')).resolves.toBe(expected);
    expect(sdk.updateUser).not.toHaveBeenCalled();
  });

  it('contains thrown provider details and cannot use the capability after success', async () => {
    const auth = new SupabaseInviteAuth(configuration.supabaseUrl, configuration.supabasePublishableKey, url);
    sdk.verifyOtp.mockRejectedValueOnce(new Error('UNSAFE_PROVIDER_DETAIL'));
    await expect(auth.setPassword('test-password')).resolves.toBe('unavailable');
    sdk.signOut.mockRejectedValueOnce(new Error('UNSAFE_PROVIDER_DETAIL'));
    await expect(auth.setPassword('test-password')).resolves.toBe('succeeded');
    await expect(auth.setPassword('test-password')).resolves.toBe('invalid_invitation');
    expect(sdk.updateUser).toHaveBeenCalledTimes(1);
  });
});
