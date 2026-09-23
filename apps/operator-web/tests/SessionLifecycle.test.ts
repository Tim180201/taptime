// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseOperatorAuth } from "../src/SupabaseOperatorAuth";
import { OperatorRuntime } from "../src/OperatorRuntime";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const token = (aal: string) =>
  `${btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: "operator-a", aal, exp: Math.floor(Date.now() / 1000) + 3600 }))}.synthetic`;
const user = {
  id: "operator-a",
  aud: "authenticated",
  role: "authenticated",
  email: "operator-a@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-09-01T10:00:00Z",
  factors: [{ id: "factor-a", factor_type: "totp", status: "verified" }],
};
const session = (aal: string) => ({
  access_token: token(aal),
  refresh_token: "synthetic-refresh-a",
  expires_in: 3600,
  token_type: "bearer",
  user,
});
let auth: SupabaseOperatorAuth;
let runtime: OperatorRuntime;
let resolveVerify: (value: Response) => void;
let verifyStarted: Promise<void>;
function setup(sessionStatus = 200) {
  sessionStorage.clear();
  let started: () => void;
  verifyStarted = new Promise((resolve) => {
    started = resolve;
  });
  const verification = new Promise<Response>((resolve) => {
    resolveVerify = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/token?")) return response(session("aal1"));
      if (url.endsWith("/user")) return response(user);
      if (url.endsWith("/factors/factor-a/challenge"))
        return response({
          id: "challenge-a",
          expires_at: Math.floor(Date.now() / 1000) + 120,
        });
      if (url.endsWith("/factors/factor-a/verify")) {
        started();
        return verification;
      }
      if (url.includes("/logout")) return new Response(null, { status: 204 });
      throw new Error(`Unexpected synthetic SDK request: ${url}`);
    }),
  );
  auth = new SupabaseOperatorAuth(
    "https://syntheticproject.supabase.co",
    "sb_publishable_synthetic_public_value",
    sessionStorage,
  );
  runtime = new OperatorRuntime(auth, sessionStorage, async (_input, init) => {
    if (sessionStatus !== 200)
      return response(
        {
          error: {
            code:
              sessionStatus === 401 ? "unauthorized" : "service_unavailable",
          },
        },
        sessionStatus,
      );
    const bearer = new Headers(init?.headers).get("authorization")!.slice(7);
    const aal = JSON.parse(atob(bearer.split(".")[1]!)).aal;
    return response({
      status: aal === "aal2" ? "active" : "mfa_required",
      aal,
    });
  });
}
afterEach(async () => {
  runtime?.dispose();
  // Cleanup only: stop the real SDK's timer without changing production's API.
  await (
    auth as unknown as { client: SupabaseClient }
  )?.client.auth.stopAutoRefresh();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
it("finishes logout after an in-flight real SDK MFA response so credentials cannot reappear", async () => {
  setup();
  await runtime.signIn("operator-a@example.test", "synthetic-password");
  expect(runtime.getSnapshot().status).toBe("mfa");
  const verifying = runtime.verify("123456");
  await verifyStarted;
  const loggingOut = runtime.signOut();
  expect(runtime.getSnapshot().status).toBe("login");
  // Let an unqueued logout finish before releasing verification. A correctly
  // serialized logout remains pending until the deliberately delayed response.
  await Promise.race([
    loggingOut,
    new Promise((resolve) => setTimeout(resolve, 25)),
  ]);
  resolveVerify(response(session("aal2")));
  await Promise.all([verifying, loggingOut]);
  expect(await auth.getAccessToken()).toBeNull();
  expect(sessionStorage.getItem("taptime-operator-auth")).toBeNull();
  expect(runtime.getSnapshot().status).toBe("login");
});
it("returns an expired server session directly to login", async () => {
  setup(401);
  await runtime.signIn("operator-a@example.test", "synthetic-password");
  expect(runtime.getSnapshot().status).toBe("login");
  expect(await auth.getAccessToken()).toBeNull();
});
it("expires an authenticated blocked session on focus after thirty idle minutes", async () => {
  setup(503);
  runtime.start();
  await runtime.signIn("operator-a@example.test", "synthetic-password");
  expect(runtime.getSnapshot().status).toBe("blocked");
  sessionStorage.setItem(
    "taptime-operator-last-activity",
    String(Date.now() - 30 * 60 * 1000),
  );
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() => expect(runtime.getSnapshot().status).toBe("login"));
  await vi.waitFor(() =>
    expect(sessionStorage.getItem("taptime-operator-auth")).toBeNull(),
  );
});
