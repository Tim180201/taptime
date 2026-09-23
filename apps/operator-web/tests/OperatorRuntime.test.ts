// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { OperatorRuntime, type OperatorAuth } from "../src/OperatorRuntime";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it("sends the session request with the browser fetch receiver before showing MFA", async () => {
  const fetch = vi.fn(function (this: unknown, _input: RequestInfo | URL, _init?: RequestInit) {
    // Native browser fetch rejects a class instance as its receiver. Arrow mocks
    // and Node's fetch do not expose this browser failure.
    if (this !== globalThis) throw new TypeError("Illegal invocation");
    return Promise.resolve(new Response(JSON.stringify({ status: "mfa_required", aal: "aal1" })));
  });
  vi.stubGlobal("fetch", fetch);
  const auth: OperatorAuth = {
    signIn: vi.fn(async () => {}),
    getAccessToken: async () => "synthetic-token",
    prepareMfa: vi.fn(async () => ({ factorId: "factor-a" })),
    verifyMfa: async () => {},
    signOut: async () => {},
    onSignedOut: () => () => {},
  };
  // Leave the fetch argument absent, exactly as main.tsx does.
  const runtime = new OperatorRuntime(auth, sessionStorage);
  await runtime.signIn("operator@example.test", "synthetic-password");

  expect(runtime.getSnapshot()).toEqual({ status: "mfa", factor: { factorId: "factor-a" } });
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/v1/operator/session", expect.objectContaining({
    method: "GET",
    headers: expect.objectContaining({ Authorization: "Bearer synthetic-token" }),
  }));
  expect(auth.prepareMfa).toHaveBeenCalledOnce();
  runtime.dispose();
});
