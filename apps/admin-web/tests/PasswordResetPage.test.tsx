import { PasswordResetPage } from '../src/PasswordResetPage';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactElement } from 'react';

const sdk = vi.hoisted(() => ({
  createClient: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  setSession: vi.fn(), getSession: vi.fn(), signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: sdk.createClient }));
import { createApplicationPage } from '../src/ApplicationRoot';
import type { App } from '../src/App';
import { AdminWebApiClient } from '../src/AdminWebApiClient';

const token = 'c'.repeat(64);
const configuration = {
  supabaseUrl: 'https://synthetic.supabase.co', supabasePublishableKey: 'synthetic-public-key',
};
const expired = 'Der Link ist abgelaufen oder wurde schon benutzt. Öffnen Sie „Im Browser anmelden“ und wählen Sie dort „Passwort vergessen“. Sie können auch in der App einen neuen Link anfordern.';

function submit(password = 'new-test-password') {
  fireEvent.change(screen.getByLabelText('Neues Passwort'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Passwort ändern' }));
}

describe('T-094b real application entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear(); sessionStorage.clear();
    sdk.createClient.mockReturnValue({ auth: sdk });
    vi.spyOn(AdminWebApiClient.prototype, 'recordPasswordReset').mockImplementation(sdk.audit);
    sdk.audit.mockResolvedValue({ status: 'succeeded', value: true });
    sdk.verifyOtp.mockResolvedValue({ error: null, data: { session: { access_token: 'memory-only-session' } } });
    sdk.updateUser.mockResolvedValue({ error: null });
    sdk.signOut.mockResolvedValue({ error: null });
    sdk.setSession.mockResolvedValue({ error: null, data: { session: { access_token: 'legacy-session' } } });
    sdk.getSession.mockResolvedValue({ data: { session: { access_token: 'memory-only-session' } } });
    sdk.resetPasswordForEmail.mockResolvedValue({ error: null });
    window.history.replaceState(null, '', `/passwort-neu#token_hash=${token}&type=recovery`);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); });

  it('removes credentials before rendering, verifies only on submit and signs out locally after changing', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    const page = createApplicationPage(configuration);
    expect(window.location.href).not.toContain(token);
    expect(window.history.state).toBeNull();
    expect(sdk.verifyOtp).not.toHaveBeenCalled();
    expect(sdk.updateUser).not.toHaveBeenCalled();
    expect(sdk.setSession).not.toHaveBeenCalled();
    render(page);
    expect(document.title).toBe('Taptura · Neues Passwort setzen');
    expect(screen.getByLabelText('Neues Passwort')).toHaveAttribute('minlength', '8');
    expect(sdk.createClient).toHaveBeenCalledExactlyOnceWith(configuration.supabaseUrl,
      configuration.supabasePublishableKey,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    submit();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(
      'Passwort geändert. Melden Sie sich jetzt in der App oder hier mit dem neuen Passwort an.'));
    expect(sdk.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: token, type: 'recovery' });
    expect(sdk.updateUser).toHaveBeenCalledExactlyOnceWith({ password: 'new-test-password' });
    expect(sdk.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' });
    expect(sdk.audit).toHaveBeenCalledExactlyOnceWith('memory-only-session');
    expect(sdk.verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(sdk.updateUser.mock.invocationCallOrder[0]!);
    expect(sdk.updateUser.mock.invocationCallOrder[0]).toBeLessThan(sdk.audit.mock.invocationCallOrder[0]!);
    expect(sdk.audit.mock.invocationCallOrder[0]).toBeLessThan(sdk.signOut.mock.invocationCallOrder[0]!);
    expect(sdk.signInWithPassword).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Neues Passwort')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Im Browser anmelden' })).toHaveAttribute('href', '/');
    expect(document.documentElement.outerHTML).not.toContain(token);
    expect(window.location.hash).toBe('');
    expect(localStorage.length + sessionStorage.length).toBe(0);
    expect(storage).not.toHaveBeenCalled();
    for (const log of logs) expect(JSON.stringify(log.mock.calls)).not.toContain(token);
  });

  it.each(['otp_expired', 'session_not_found', 'session_expired', 'bad_jwt'])('%s shows a new-link instruction without signing in', async code => {
    sdk.verifyOtp.mockResolvedValue({ error: { code, message: token }, data: { session: null } });
    render(createApplicationPage(configuration));
    submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(expired));
    expect(sdk.updateUser).not.toHaveBeenCalled();
    expect(sdk.signInWithPassword).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(token);
    expect(screen.getByRole('link', { name: 'Im Browser anmelden' })).toHaveAttribute('href', '/');
  });

  it.each([
    '/passwort-neu',
    `/passwort-neu#token_hash=${token}&type=invite`,
    `/passwort-neu#token_hash=${token}&type=recovery&type=recovery`,
    `/passwort-neu#token_hash=${token}&token_hash=${token}&type=recovery`,
    `/passwort-neu#token_hash=${token}&type=recovery&redirect_to=/beschaeftigte`,
    `/passwort-neu?token_hash=${token}&type=recovery`,
    '/passwort-neu#token_hash=short&type=recovery',
  ])('rejects missing, ambiguous or wrong-purpose credentials (%s)', path => {
    window.history.replaceState(null, '', path);
    render(createApplicationPage(configuration));
    expect(screen.getByRole('alert')).toHaveTextContent(expired);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(sdk.createClient).not.toHaveBeenCalled();
    expect(window.location.hash + window.location.search).toBe('');
  });

  it.each([
    '/#error=access_denied&error_code=otp_expired&error_description=UNSAFE_PROVIDER_DETAIL',
    '/uebersicht#error=access_denied',
    '/#error_code=otp_expired',
  ])('shows a fixed error at sign-in and clears the old provider fragment (%s)', path => {
    window.history.replaceState(null, '', path);
    const page = createApplicationPage(configuration) as ReactElement<ComponentProps<typeof App>>;
    expect(window.location.hash).toBe('');
    expect(window.history.state).toBeNull();
    render(page);
    expect(screen.getByRole('alert')).toHaveTextContent(expired);
    expect(screen.getByLabelText('E-Mail')).toBeVisible();
    expect(document.body.textContent).not.toContain('UNSAFE_PROVIDER_DETAIL');
    expect(JSON.stringify(page.props.administration.getState())).not.toContain('access_denied');
    expect(localStorage.length + sessionStorage.length).toBe(0);
    expect(sdk.verifyOtp).not.toHaveBeenCalled();
    expect(sdk.setSession).not.toHaveBeenCalled();
  });

  it('clears the initial link error when requesting a new link', async () => {
    window.history.replaceState(null, '', '/#error_code=otp_expired');
    render(createApplicationPage(configuration));
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'employee@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Passwort vergessen' }));
    await screen.findByText('Falls das Konto existiert, wurde eine Wiederherstellungs-E-Mail versendet.');
    expect(screen.queryByText(expired)).not.toBeInTheDocument();
  });

  it('retains the existing access-token recovery route', async () => {
    window.history.replaceState(null, '', '/#access_token=aaaaaaaaaaaaaaaa&refresh_token=bbbbbbbbbbbbbbbb&type=recovery&token_type=bearer');
    render(createApplicationPage(configuration));
    await screen.findByRole('heading', { name: 'Neues Passwort setzen' });
    expect(window.location.hash).toBe('');
    expect(sdk.setSession).toHaveBeenCalledExactlyOnceWith({ access_token: 'aaaaaaaaaaaaaaaa', refresh_token: 'bbbbbbbbbbbbbbbb' });
    expect(sdk.verifyOtp).not.toHaveBeenCalled();
    expect(sdk.updateUser).not.toHaveBeenCalled();
  });

  it('reuses the memory session after a password-policy rejection', async () => {
    sdk.updateUser.mockResolvedValueOnce({ error: { code: 'weak_password', message: token } });
    render(createApplicationPage(configuration));
    submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('nicht angenommen'));
    expect(document.body.textContent).not.toContain(token);
    submit('stronger-test-password');
    await screen.findByRole('status');
    expect(sdk.verifyOtp).toHaveBeenCalledTimes(1);
    expect(sdk.updateUser).toHaveBeenCalledTimes(2);
  });

  it.each(['unreachable', 'rejected', 'invalid_response'] as const)('retains recovery authority until the mandatory audit succeeds (%s)', async status => {
    sdk.audit.mockResolvedValueOnce({ status });
    render(createApplicationPage(configuration));
    submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      'Ihr Passwort wurde geändert; der Abschluss ist noch nicht bestätigt. Bestätigen Sie die Änderung erneut.'));
    expect(sdk.signOut).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Neues Passwort')).toBeDisabled();
    expect(localStorage.length + sessionStorage.length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Änderung abschließen' }));
    await screen.findByRole('status');
    expect(sdk.verifyOtp).toHaveBeenCalledOnce();
    expect(sdk.updateUser).toHaveBeenCalledOnce();
    expect(sdk.audit).toHaveBeenCalledTimes(2);
    expect(sdk.signOut).toHaveBeenCalledOnce();
  });

  it.each([
    [{ status: 429 }, 'Zu viele Versuche'],
    [{ code: 'unexpected_failure', message: token }, 'Verbindung wieder funktioniert'],
  ])('keeps provider failures within a closed message set (%j)', async (error, message) => {
    sdk.verifyOtp.mockResolvedValue({ error, data: { session: null } });
    render(createApplicationPage(configuration));
    submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
    expect(sdk.updateUser).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(token);
  });

  it('never falls back to administration without configuration', () => {
    render(createApplicationPage(null));
    expect(screen.getByRole('alert')).toHaveTextContent('nicht verfügbar');
    expect(sdk.createClient).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(screen.queryByLabelText('E-Mail')).not.toBeInTheDocument();
  });

  it('blocks duplicate submits until local sign-out finishes and treats a thrown logout as completed', async () => {
    let finish!: () => void;
    sdk.signOut.mockImplementationOnce(() => new Promise((_, reject) => { finish = () => reject(new Error(token)); }));
    render(createApplicationPage(configuration));
    submit();
    await waitFor(() => expect(sdk.signOut).toHaveBeenCalledOnce());
    expect(screen.getByRole('button')).toBeDisabled();
    fireEvent.submit(screen.getByLabelText('Neues Passwort').closest('form')!);
    expect(sdk.updateUser).toHaveBeenCalledOnce();
    finish();
    await screen.findByRole('status');
    expect(document.body.textContent).not.toContain(token);
  });
});

it('T101 PasswordResetPage points to the password and clears the hint before auth',()=>{
 const setPassword=vi.fn(async()=> 'succeeded' as const);render(<PasswordResetPage recovery={{hasRecovery:true,setPassword}}/>);
 const field=screen.getByLabelText('Neues Passwort');fireEvent.submit(field.closest('form')!);expect(setPassword).not.toHaveBeenCalled();expect(field).toHaveFocus();expect(field).toHaveAttribute('aria-invalid','true');expect(document.getElementById(field.getAttribute('aria-describedby')!)).toHaveAttribute('role','alert');
 fireEvent.change(field,{target:{value:'a'}});expect(field).toHaveAttribute('aria-invalid','true');fireEvent.change(field,{target:{value:'long-password'}});expect(field).not.toHaveAttribute('aria-invalid');
});
