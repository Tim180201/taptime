// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import axe from "axe-core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../src/App";
import {
  OperatorRuntime,
  type OperatorAuth,
  type MfaFactor,
} from "../src/OperatorRuntime";

// Wire names follow read_operator_*_v1 in migration 032, not the visual mockup.
const organization = {
  organization_id: "30000000-0000-4000-8000-000000000001",
  name: "Werkstatt",
  status: "active",
  created_at: "2026-09-01T10:00:00Z",
  row_version: 3,
  administrators: 1,
  location_managers: 0,
  employees: 8,
  active_now: 4,
  last_tap: "2026-09-23T09:00:00Z",
  tags: 5,
  active_assignments: 4,
  open_invitations: 1,
};
const overview = {
  status: "succeeded",
  organizations: [organization],
  totals: {
    organizations: 1,
    administrators: 1,
    location_managers: 0,
    employees: 8,
    active_now: 4,
    taps_today: 20,
  },
};
class Auth implements OperatorAuth {
  token: string | null = null;
  factor: MfaFactor = {
    factorId: "factor",
    qrCode: "data:image/svg+xml,%3Csvg/%3E",
    secret: "SYNTHETICTOTP",
  };
  signIn = vi.fn(async () => {
    this.token = "aal1";
  });
  signOut = vi.fn(async () => {
    this.token = null;
  });
  getAccessToken = vi.fn(async () => this.token);
  prepareMfa = vi.fn(async () => this.factor);
  verifyMfa = vi.fn(async () => {
    this.token = "aal2";
  });
  signedOut = () => {};
  onSignedOut(callback: () => void) {
    this.signedOut = callback;
    return () => {};
  }
}
let auth: Auth;
let runtime: OperatorRuntime;
let calls: { path: string; body: Record<string, unknown> }[];
let replies: Record<string, () => unknown>;
let now: number;
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  sessionStorage.clear();
  localStorage.clear();
  now = Date.now();
  auth = new Auth();
  calls = [];
  replies = {
    overview: () => overview,
    "organizations/create": () => ({
      status: "succeeded",
      organization_id: organization.organization_id,
    }),
    "organizations/status": () => ({
      status: "succeeded",
      organization_id: organization.organization_id,
      row_version: 4,
    }),
    audit: () => ({
      status: "succeeded",
      events: [
        {
          id: "51",
          organization_id: organization.organization_id,
          action: "organization_created",
          reason: null,
          created_at: "2026-09-23T09:00:00Z",
          actor: "operator",
        },
      ],
      next_before: "51",
    }),
    health: () => ({
      status: "succeeded",
      database_bytes: 1048576,
      last_archived_at: "2026-09-23T09:00:00Z",
      last_base_at: null,
      version: "abcdef0",
    }),
  };
  runtime = new OperatorRuntime(
    auth,
    sessionStorage,
    async (input, init) => {
      const path = String(input).replace("/v1/operator/", "");
      calls.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
      if (path === "session")
        return response({
          status: auth.token === "aal2" ? "active" : "mfa_required",
          aal: auth.token,
        });
      const result = await replies[path]!();
      return result instanceof Response ? result : response(result);
    },
    () => now,
  );
});
afterEach(() => {
  cleanup();
  runtime.dispose();
  vi.useRealTimers();
});
async function login() {
  render(<App runtime={runtime} />);
  await screen.findByLabelText("E-Mail");
  fireEvent.change(screen.getByLabelText("E-Mail"), {
    target: { value: "operator@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Passwort"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));
  await screen.findByLabelText("Code aus der Authenticator-App");
}
async function ready() {
  await login();
  fireEvent.change(screen.getByLabelText("Code aus der Authenticator-App"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Code bestätigen" }));
  await screen.findByText("Werkstatt");
}
async function create() {
  fireEvent.click(screen.getByRole("button", { name: "Betrieb anlegen" }));
  fireEvent.change(screen.getByLabelText("Name des Betriebs"), {
    target: { value: "Neuer Betrieb" },
  });
  fireEvent.change(screen.getByLabelText("E-Mail des ersten Administrators"), {
    target: { value: "new@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Anlegen und einladen" }));
}
it("requires server aal2 before loading any business data; first-time TOTP has QR and manual key", async () => {
  await login();
  expect(screen.getByText("SYNTHETICTOTP")).toBeVisible();
  expect(
    screen.getByAltText("QR-Code für die Authenticator-App"),
  ).toBeVisible();
  expect(calls.every((c) => c.path === "session")).toBe(true);
  expect(screen.queryByText("Werkstatt")).not.toBeInTheDocument();
  auth.verifyMfa.mockImplementation(async () => {});
  fireEvent.change(screen.getByLabelText("Code aus der Authenticator-App"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Code bestätigen" }));
  await waitFor(() => expect(auth.verifyMfa).toHaveBeenCalled());
  expect(calls.every((c) => c.path === "session")).toBe(true);
});
it("existing verified factor asks for a code without enrolling or exposing a key", async () => {
  auth.factor = { factorId: "verified" };
  await login();
  expect(
    screen.queryByAltText("QR-Code für die Authenticator-App"),
  ).not.toBeInTheDocument();
});
it("loads truthful totals, Berlin time, paginated audit and health including missing evidence", async () => {
  await ready();
  expect(screen.getByText("20")).toBeVisible();
  expect(screen.getByText(/23.09.2026.*11:00/)).toBeVisible();
  fireEvent.click(screen.getByRole("link", { name: "Protokoll" }));
  await screen.findByText("Betrieb angelegt");
  replies.audit = () => ({
    status: "succeeded",
    events: [],
    next_before: null,
  });
  fireEvent.click(screen.getByRole("button", { name: "Ältere Ereignisse" }));
  await waitFor(() =>
    expect(calls.filter((c) => c.path === "audit").at(-1)?.body.before).toBe(
      "51",
    ),
  );
  await screen.findByText("Keine weiteren Ereignisse.");
  fireEvent.click(screen.getByRole("link", { name: "Betriebszustand" }));
  await screen.findByText("abcdef0");
  expect(screen.getByText("Noch kein Nachweis")).toBeVisible();
});
it("confirms creation honestly and keeps one commandId across retry after lost reply", async () => {
  await ready();
  replies["organizations/create"] = () => {
    throw new Error("offline");
  };
  await create();
  await screen.findByText(/Dienst ist nicht erreichbar/);
  const first = calls.find((c) => c.path === "organizations/create")!.body;
  replies["organizations/create"] = () => ({
    status: "succeeded",
    organization_id: organization.organization_id,
  });
  fireEvent.click(screen.getByRole("button", { name: "Anlegen und einladen" }));
  await screen.findByText(
    /Betrieb angelegt. Das Administratorkonto ist zugeordnet/,
  );
  expect(
    calls.filter((c) => c.path === "organizations/create").at(-1)!.body,
  ).toEqual(first);
});
it.each([
  ["identity_unavailable", "bereits einem Zugang"],
  ["invitation_delivery_failed", "Einladung konnte nicht zugestellt"],
  ["invitation_needs_attention", "Einladung muss geprüft"],
])("explains %s and retains inputs", async (code, text) => {
  await ready();
  replies["organizations/create"] = () => response({ error: { code } }, 409);
  await create();
  await screen.findByText(new RegExp(text));
  expect(screen.getByLabelText("E-Mail des ersten Administrators")).toHaveValue(
    "new@example.test",
  );
});
it.each(["active", "paused"])(
  "confirms %s transition with reason and expected version; conflict requests reload",
  async (status) => {
    replies.overview = () => ({
      ...overview,
      organizations: [{ ...organization, status }],
    });
    await ready();
    const action = status === "active" ? "Pausieren" : "Fortsetzen";
    fireEvent.click(screen.getByRole("button", { name: action }));
    fireEvent.change(screen.getByLabelText("Grund"), {
      target: { value: "Vereinbarung" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Weiter zur Bestätigung" }),
    );
    expect(calls.some((c) => c.path === "organizations/status")).toBe(false);
    replies["organizations/status"] = () =>
      response({ error: { code: "conflict" } }, 409);
    fireEvent.click(
      screen.getByRole("button", { name: `${action} bestätigen` }),
    );
    await screen.findByText("Ansicht veraltet, bitte neu laden.");
    expect(
      calls.find((c) => c.path === "organizations/status")!.body,
    ).toMatchObject({
      rowVersion: 3,
      reason: "Vereinbarung",
      status: status === "active" ? "paused" : "active",
    });
  },
);
it("expires at 30 minutes even if next input arrives after browser sleep; late data cannot return", async () => {
  await ready();
  now += 30 * 60 * 1000;
  fireEvent.keyDown(window, { key: "Tab" });
  await screen.findByLabelText("E-Mail");
  expect(screen.queryByText("Werkstatt")).not.toBeInTheDocument();
  expect(auth.signOut).toHaveBeenCalled();
});
it("retains inactivity deadline on reload and rejects old persisted sessions", async () => {
  await ready();
  runtime.dispose();
  cleanup();
  now += 31 * 60 * 1000;
  const next = new OperatorRuntime(
    auth,
    sessionStorage,
    async () => response(overview),
    () => now,
  );
  runtime = next;
  render(<App runtime={next} />);
  await screen.findByLabelText("E-Mail");
  expect(screen.queryByText("Werkstatt")).not.toBeInTheDocument();
});
it("clears privileged content on forbidden or expired responses and drops pending response after logout", async () => {
  await ready();
  let resolve!: (v: unknown) => void;
  replies.health = () =>
    new Promise((r) => {
      resolve = r;
    });
  fireEvent.click(screen.getByRole("link", { name: "Betriebszustand" }));
  await waitFor(() => expect(resolve).toBeDefined());
  fireEvent.click(screen.getByRole("button", { name: "Abmelden" }));
  await screen.findByLabelText("E-Mail");
  await act(async () =>
    resolve({
      status: "succeeded",
      database_bytes: 1,
      last_archived_at: null,
      last_base_at: null,
      version: "private-version",
    }),
  );
  expect(screen.queryByText("private-version")).not.toBeInTheDocument();
});
it.each(["unauthorized", "forbidden", "mfa_required"])(
  "closes business views after %s from a route",
  async (code) => {
    await ready();
    replies.health = () => {
      if (code === "mfa_required") auth.token = "aal1";
      return response({ error: { code } }, 403);
    };
    fireEvent.click(screen.getByRole("link", { name: "Betriebszustand" }));
    await waitFor(() =>
      expect(screen.queryByText("Werkstatt")).not.toBeInTheDocument(),
    );
    await screen.findByLabelText(
      code === "mfa_required" ? "Code aus der Authenticator-App" : "E-Mail",
    );
    expect(
      screen.queryByRole("link", { name: "Übersicht" }),
    ).not.toBeInTheDocument();
  },
);
it("axe reports no violations on login, MFA, overview and create panel", async () => {
  render(<App runtime={runtime} />);
  await screen.findByLabelText("E-Mail");
  const check = async () =>
    expect(
      (
        await axe.run(document.body, {
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  await check();
  cleanup();
  runtime.dispose();
  await login();
  await check();
  fireEvent.change(screen.getByLabelText("Code aus der Authenticator-App"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Code bestätigen" }));
  await screen.findByText("Werkstatt");
  await check();
  fireEvent.click(screen.getByRole("button", { name: "Betrieb anlegen" }));
  await check();
});

it.each(["active", "paused"])(
  "completes %s status change and refreshes the overview",
  async (status) => {
    let changed = false;
    const nextStatus = status === "active" ? "paused" : "active";
    replies.overview = () => ({
      ...overview,
      organizations: [
        {
          ...organization,
          status: changed ? nextStatus : status,
          row_version: changed ? 4 : 3,
        },
      ],
    });
    replies["organizations/status"] = () => {
      changed = true;
      return {
        status: "succeeded",
        organization_id: organization.organization_id,
        row_version: 4,
      };
    };
    await ready();
    const action = status === "active" ? "Pausieren" : "Fortsetzen";
    fireEvent.click(screen.getByRole("button", { name: action }));
    fireEvent.change(screen.getByLabelText("Grund"), {
      target: { value: "Vereinbarung" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Weiter zur Bestätigung" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: `${action} bestätigen` }),
    );
    await screen.findByText(
      status === "active" ? "Betrieb pausiert." : "Betrieb fortgesetzt.",
    );
    await screen.findByRole("button", {
      name: status === "active" ? "Fortsetzen" : "Pausieren",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  },
);
