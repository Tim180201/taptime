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
