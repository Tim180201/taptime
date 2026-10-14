// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ createClient: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(),
  signOut: vi.fn(), setSession: vi.fn(), getSession: vi.fn(), signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.createClient }));
import { createApplicationPage } from '../src/ApplicationRoot';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import { SupabaseMemoryAuth } from '../src/SupabaseMemoryAuth';
import { SupabaseInviteAuth } from '../src/SupabaseInviteAuth';
import { SupabaseRecoveryAuth } from '../src/SupabaseRecoveryAuth';
const config = { supabaseUrl: 'https://synthetic.supabase.co', supabasePublishableKey: 'synthetic-only' };
const paths = ['/willkommen#token_hash=' + 'a'.repeat(64) + '&type=invite',
  '/passwort-neu#token_hash=' + 'b'.repeat(64) + '&type=recovery',
  '/#access_token=aaaaaaaaaaaaaaaa&refresh_token=bbbbbbbbbbbbbbbb&type=recovery'];
const limited = 'Zu viele Versuche. Bitte warten Sie einige Minuten.';

beforeEach(() => {
  vi.resetAllMocks();
  sdk.createClient.mockReturnValue({ auth: sdk });
  for (const fn of [sdk.verifyOtp, sdk.setSession, sdk.getSession, sdk.signInWithPassword])
    fn.mockResolvedValue({ error: null, data: { session: { access_token: 'synthetic-token' } } });
  sdk.updateUser.mockResolvedValue({ error: null });
  sdk.signOut.mockResolvedValue({ error: null });
  sdk.resetPasswordForEmail.mockResolvedValue({ error: null });
  vi.spyOn(AdminWebApiClient.prototype, 'recordPasswordReset').mockResolvedValue({ status: 'succeeded', value: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); });

it.each(paths)('T119 rejects nine and accepts ten characters in the real new-password form %s', async path => {
  window.history.replaceState(null, '', path);
  render(createApplicationPage(config));
  const field = await screen.findByLabelText('Neues Passwort');
  fireEvent.change(field, { target: { value: '123456789' } });
  fireEvent.submit(field.closest('form')!);
  expect(sdk.verifyOtp).not.toHaveBeenCalled();
  expect(sdk.updateUser).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('mindestens 10 Zeichen');
  fireEvent.change(field, { target: { value: '1234567890' } });
  fireEvent.submit(field.closest('form')!);
  await waitFor(() => expect(sdk.updateUser).toHaveBeenCalledExactlyOnceWith({ password: '1234567890' }));
  await screen.findByRole('status');
});

it.each(['invite', 'recovery', 'legacy'] as const)('T119 also validates new passwords at the %s capability boundary', async kind => {
  const auth = kind === 'invite' ? new SupabaseInviteAuth(config.supabaseUrl, config.supabasePublishableKey, 'https://admin.example.test' + paths[0])
    : kind === 'recovery' ? new SupabaseRecoveryAuth(config.supabaseUrl, config.supabasePublishableKey, 'https://admin.example.test' + paths[1])
    : new SupabaseMemoryAuth(config.supabaseUrl, config.supabasePublishableKey, { recoveryUrl: () => 'https://admin.example.test' + paths[2], clearRecoveryUrl: () => {} });
  await Promise.resolve();
  const change = (password: string) => auth instanceof SupabaseMemoryAuth ? auth.updateRecoveredPassword(password) : auth.setPassword(password);
  await change('123456789');
  expect(sdk.verifyOtp).not.toHaveBeenCalled();
  expect(sdk.updateUser).not.toHaveBeenCalled();
  await change('1234567890');
  expect(sdk.updateUser).toHaveBeenCalledExactlyOnceWith({ password: '1234567890' });
});

it.each([{ status: 429 }, { code: 'over_request_rate_limit' }, { status: 429, code: 'invalid_credentials' }])(
  'T119 submits existing eight-character passwords and displays throttling at login (%j)', async error => {
    window.history.replaceState(null, '', '/');
    sdk.signInWithPassword.mockResolvedValueOnce({ error, data: { session: null } });
    render(createApplicationPage(config));
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'existing@example.test' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: '12345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sicher anmelden' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(limited));
    expect(sdk.signInWithPassword).toHaveBeenCalledWith({ email: 'existing@example.test', password: '12345678' });
    expect(screen.getByLabelText('Passwort')).not.toHaveAttribute('minlength');
    await expect(new SupabaseMemoryAuth(config.supabaseUrl, config.supabasePublishableKey)
      .signIn('existing@example.test', '12345678')).resolves.toBe('signed_in');
  });

it.each(paths.flatMap(path => [{ path, error: { status: 429 } }, { path, error: { code: 'over_request_rate_limit' } }]))(
  'T119 displays throttling when setting a password ($path, $error)', async ({ path, error }) => {
    window.history.replaceState(null, '', path);
    sdk.updateUser.mockResolvedValue({ error });
    render(createApplicationPage(config));
    const field = await screen.findByLabelText('Neues Passwort');
    fireEvent.change(field, { target: { value: '1234567890' } });
    fireEvent.submit(field.closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(limited));
  });

it.each([{ status: 429 }, { code: 'over_request_rate_limit' }])('T119 displays throttling for reset mail (%j)', async error => {
  window.history.replaceState(null, '', '/');
  sdk.resetPasswordForEmail.mockResolvedValue({ error });
  render(createApplicationPage(config));
  fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'existing@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Passwort vergessen' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(limited));
});
