// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
const { createClient, sdk } = vi.hoisted(() => {
  const sdk = {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
    mfa: {
      listFactors: vi.fn(),
      enroll: vi.fn(),
      unenroll: vi.fn(),
      challengeAndVerify: vi.fn(),
    },
  };
  return { createClient: vi.fn(() => ({ auth: sdk })), sdk };
});
vi.mock("@supabase/supabase-js", () => ({ createClient }));
import {
  SupabaseOperatorAuth,
  readConfiguration,
} from "../src/SupabaseOperatorAuth";
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  sdk.signOut.mockResolvedValue({ error: null });
});
it("uses only tab storage and no URL session detection", () => {
  new SupabaseOperatorAuth(
    "https://example.supabase.co",
    "sb_publishable_syntheticpublickey",
    sessionStorage,
  );
  expect(createClient).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(String),
    {
      auth: expect.objectContaining({
        storage: sessionStorage,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: "taptime-operator-auth",
      }),
    },
  );
  expect(localStorage.length).toBe(0);
});
it("reuses a verified TOTP factor; removes only incomplete TOTP enrollments before creating one", async () => {
  const auth = new SupabaseOperatorAuth(
    "https://example.supabase.co",
    "sb_publishable_syntheticpublickey",
    sessionStorage,
  );
  sdk.mfa.listFactors.mockResolvedValue({
    data: { all: [{ id: "ok", factor_type: "totp", status: "verified" }] },
    error: null,
  });
  expect(await auth.prepareMfa()).toEqual({ factorId: "ok" });
  expect(sdk.mfa.enroll).not.toHaveBeenCalled();
  sdk.mfa.listFactors.mockResolvedValue({
    data: {
      all: [
        { id: "stale", factor_type: "totp", status: "unverified" },
        { id: "phone", factor_type: "phone", status: "unverified" },
      ],
    },
    error: null,
  });
  sdk.mfa.unenroll.mockResolvedValue({ error: null });
  sdk.mfa.enroll.mockResolvedValue({
    data: {
      id: "new",
      totp: { qr_code: "data:image/svg+xml,qr", secret: "manual" },
    },
    error: null,
  });
  expect(await auth.prepareMfa()).toEqual({
    factorId: "new",
    qrCode: "data:image/svg+xml,qr",
    secret: "manual",
  });
  expect(sdk.mfa.unenroll).toHaveBeenCalledExactlyOnceWith({
    factorId: "stale",
  });
  await auth.verifyMfa("new", "123456");
  expect(sdk.mfa.challengeAndVerify).toHaveBeenCalledWith({
    factorId: "new",
    code: "123456",
  });
});
it.each([
  ["invalid_credentials", "credentials_rejected"],
  ["email_not_confirmed", "email_not_confirmed"],
  ["user_banned", "forbidden"],
  ["unexpected", "service_unavailable"],
])(
  "classifies %s without printing provider details",
  async (code, expected) => {
    sdk.signInWithPassword.mockResolvedValue({
      error: { code, message: "sensitive detail" },
      data: { session: null },
    });
    const auth = new SupabaseOperatorAuth(
      "https://example.supabase.co",
      "sb_publishable_syntheticpublickey",
      sessionStorage,
    );
    await expect(
      auth.signIn("x@example.test", "password"),
    ).rejects.toMatchObject({ code: expected });
  },
);
it("clears persisted credentials even if local signOut fails", async () => {
  sessionStorage.setItem("taptime-operator-auth", "synthetic");
  sdk.signOut.mockRejectedValue(new Error("offline"));
  const auth = new SupabaseOperatorAuth(
    "https://example.supabase.co",
    "sb_publishable_syntheticpublickey",
    sessionStorage,
  );
  await auth.signOut();
  expect(sessionStorage.getItem("taptime-operator-auth")).toBeNull();
});
it("fails closed on missing, secret or non-project build configuration", () => {
  expect(readConfiguration({})).toBeNull();
  expect(
    readConfiguration({
      VITE_TAPTIME_SUPABASE_URL: "https://example.supabase.co",
      VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY: "service_role_secret",
    }),
  ).toBeNull();
  expect(
    readConfiguration({
      VITE_TAPTIME_SUPABASE_URL: "https://example.supabase.co/path",
      VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_syntheticpublickey",
    }),
  ).toBeNull();
});

import { OperatorRuntime } from '../src/OperatorRuntime';
import { App } from '../src/App';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';
import { createElement } from 'react';
import '@testing-library/jest-dom/vitest';
afterEach(cleanup);
it.each([{ status: 429 }, { code: 'over_request_rate_limit' }, { status: 429, code: 'invalid_credentials' }])(
  'T119 shows throttling through the real login and submits an eight-character password (%j)', async error => {
    sdk.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    sdk.getSession.mockResolvedValue({ data: { session: null }, error: null });
    sdk.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error })
      .mockResolvedValueOnce({ data: { session: { access_token: 'synthetic' } }, error: null });
    const auth = new SupabaseOperatorAuth('https://synthetic.supabase.co', 'synthetic', sessionStorage);
    const runtime = new OperatorRuntime(auth, sessionStorage);
    try {
      render(createElement(App, { runtime }));
      await screen.findByLabelText('E-Mail');
      fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'existing@example.test' } });
      fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: '12345678' } });
      fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Zu viele Versuche. Bitte warten Sie einige Minuten.'));
      expect(sdk.signInWithPassword).toHaveBeenCalledWith({ email: 'existing@example.test', password: '12345678' });
      expect(screen.getByLabelText('Passwort')).not.toHaveAttribute('minlength');
      await expect(auth.signIn('existing@example.test', '12345678')).resolves.toBeUndefined();
    } finally { runtime.dispose(); }
  });

it.each(['list', 'unenroll', 'enroll', 'verify'].flatMap(stage => [
  { stage, error: { status: 429 } }, { stage, error: { code: 'over_request_rate_limit' } },
]))('T119 preserves MFA throttling ($stage, $error)', async ({ stage, error }) => {
  const auth = new SupabaseOperatorAuth('https://synthetic.supabase.co', 'synthetic', sessionStorage);
  sdk.mfa.listFactors.mockResolvedValue({ error: stage === 'list' ? error : null,
    data: { all: stage === 'unenroll' ? [{ id: 'abandoned', factor_type: 'totp', status: 'unverified' }] : [] } });
  sdk.mfa.unenroll.mockResolvedValue({ error });
  sdk.mfa.enroll.mockResolvedValue({ error });
  sdk.mfa.challengeAndVerify.mockResolvedValue({ error });
  await expect(stage === 'verify' ? auth.verifyMfa('factor', '123456') : auth.prepareMfa())
    .rejects.toMatchObject({ code: 'rate_limited' });
});
