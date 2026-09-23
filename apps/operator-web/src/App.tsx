import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type FormEvent,
} from "react";
import { BUSINESS_TIME_ZONE } from "@taptime/core";
import { OperatorRuntime, errorText } from "./OperatorRuntime";
import {
  overviewResult,
  auditResult,
  healthResult,
  mutationResult,
  type Overview,
  type Audit,
  type Health,
  type Organization,
} from "./contracts";
import "./styles.css";

const date = (value: string | null) =>
  value === null
    ? "Noch kein Nachweis"
    : new Intl.DateTimeFormat("de-DE", {
        timeZone: BUSINESS_TIME_ZONE,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
const actions: Record<string, string> = {
  organization_created: "Betrieb angelegt",
  organization_paused: "Betrieb pausiert",
  organization_resumed: "Betrieb fortgesetzt",
  operator_granted: "Betreiber freigeschaltet",
  operator_revoked: "Betreiber-Zugang entzogen",
  session: "Sitzung geprüft",
  overview: "Übersicht gelesen",
  health: "Betriebszustand gelesen",
  audit: "Protokoll gelesen",
};
const paths = {
  overview: "/",
  audit: "/protokoll",
  health: "/betriebszustand",
} as const;
type Page = keyof typeof paths;
function currentPage(): Page {
  return window.location.pathname === paths.audit
    ? "audit"
    : window.location.pathname === paths.health
      ? "health"
      : "overview";
}
function Brand() {
  return (
    <div className="brand">
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
      </svg>
      Taptura <span className="badge">Betreiber</span>
    </div>
  );
}
function ErrorBand({ message }: { message: string | undefined }) {
  return message ? (
    <p role="alert" className="error">
      {message}
    </p>
  ) : null;
}
export function App({ runtime }: { runtime: OperatorRuntime }) {
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    runtime.start();
    return () => runtime.dispose();
  }, [runtime]);
  useEffect(() => {
    if (state.status !== "mfa") setCode("");
    if (state.status === "login") setPassword("");
  }, [state.status]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (state.status === "mfa") await runtime.verify(code);
      else await runtime.signIn(email, password);
    } finally {
      setBusy(false);
      setPassword("");
      setCode("");
    }
  }
  if (state.status === "ready") return <Business runtime={runtime} />;
  return (
    <main className="login">
      <section className="card auth">
        <Brand />
        <h1>
          {state.status === "mfa" ? "Zweiter Faktor" : "Betreiber-Anmeldung"}
        </h1>
        <p className="muted">
          Ein eigenes Betreiberkonto, getrennt von Ihrem Zugang in einem
          Betrieb. Nach 30 Minuten ohne Aktivität werden Sie abgemeldet.
        </p>
        <ErrorBand
          message={state.status === "checking" ? undefined : state.message}
        />
        {state.status === "checking" ? (
          <p role="status">Sitzung wird geprüft …</p>
        ) : state.status === "blocked" ? (
          <>
            <button onClick={() => void runtime.refresh()}>
              Erneut prüfen
            </button>
            <button onClick={() => void runtime.signOut()}>Abmelden</button>
          </>
        ) : (
          <form onSubmit={submit}>
            {state.status === "mfa" ? (
              <>
                {state.factor.qrCode && (
                  <>
                    <p>
                      Scannen Sie den QR-Code in Ihrer Authenticator-App oder
                      geben Sie den Schlüssel von Hand ein.
                    </p>
                    <img
                      className="qr"
                      src={state.factor.qrCode}
                      alt="QR-Code für die Authenticator-App"
                    />
                    <p className="secret">
                      <strong>Schlüssel zur Handeingabe</strong>
                      <br />
                      {state.factor.secret}
                    </p>
                  </>
                )}
                <label>
                  Code aus der Authenticator-App
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {busy ? "Wird geprüft …" : "Code bestätigen"}
                </button>
                <button type="button" onClick={() => void runtime.signOut()}>
                  Abmelden
                </button>
              </>
            ) : (
              <>
                <label>
                  E-Mail
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label>
                  Passwort
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {busy ? "Wird angemeldet …" : "Anmelden"}
                </button>
              </>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
function Business({ runtime }: { runtime: OperatorRuntime }) {
  const [page, setPage] = useState<Page>(currentPage),
    [overview, setOverview] = useState<Overview | null>(null),
    [audit, setAudit] = useState<Audit | null>(null),
    [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState<string>(),
    [notice, setNotice] = useState("");
  const [panel, setPanel] = useState<"create" | Organization | null>(null),
    [refresh, setRefresh] = useState(0),
    [before, setBefore] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  useEffect(() => {
    const pop = () => {
      setPage(currentPage());
      setBefore(null);
      setPanel(null);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(undefined);
    const work =
      page === "overview"
        ? runtime.request("overview", {}, overviewResult).then((value) => {
            if (live) setOverview(value);
          })
        : page === "audit"
          ? runtime
              .request("audit", { before, limit: 50 }, auditResult)
              .then((value) => {
                if (live) setAudit(value);
              })
          : runtime.request("health", {}, healthResult).then((value) => {
              if (live) setHealth(value);
            });
    void work
      .catch((reason) => {
        if (live) setError(errorText(reason));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [runtime, page, before, refresh]);
  const navigate = (next: Page) => {
    window.history.pushState(null, "", paths[next]);
    setPage(next);
    setBefore(null);
    setPanel(null);
    setNotice("");
  };
  const rows = overview?.organizations.filter(
    (row) =>
      (filter === "all" || row.status === filter) &&
      row.name
        .toLocaleLowerCase("de-DE")
        .includes(search.toLocaleLowerCase("de-DE")),
  );
  return (
    <>
      <div className="app" inert={panel !== null}>
        <header>
          <Brand />
          <button onClick={() => void runtime.signOut()}>Abmelden</button>
        </header>
        <nav aria-label="Betreiber-Bereich">
          {(
            [
              ["overview", "Übersicht"],
              ["audit", "Protokoll"],
              ["health", "Betriebszustand"],
            ] as const
          ).map(([key, label]) => (
            <a
              key={key}
              href={paths[key]}
              aria-current={page === key ? "page" : undefined}
              onClick={(event) => {
                if (
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  navigate(key);
                }
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <main>
          <div className="section-head">
            <h1>
              {page === "overview"
                ? "Übersicht"
                : page === "audit"
                  ? "Protokoll"
                  : "Betriebszustand"}
            </h1>
            <button onClick={() => setRefresh((value) => value + 1)}>
              Neu laden
            </button>
          </div>
          <p className="muted">
            Über jeden Betrieb: Status, Zahlen und letzte Aktivität. Keine Namen
            oder Arbeitszeiten der Beschäftigten.
          </p>
          <ErrorBand message={error} />
          {notice && (
            <p role="status" className="success">
              {notice}
            </p>
          )}
          {loading ? (
            <p role="status">Wird geladen …</p>
          ) : error ? null : page === "overview" && overview ? (
            <>
              <div className="tiles">
                {[
                  ["Betriebe", overview.totals.organizations],
                  ["Mitarbeiter gesamt", overview.totals.employees],
                  ["Jetzt aktiv", overview.totals.active_now],
                  ["Taps heute", overview.totals.taps_today],
                ].map(([label, value]) => (
                  <section className="card tile" key={label}>
                    <h2>{label}</h2>
                    <p>{value}</p>
                  </section>
                ))}
              </div>
              <section className="card">
                <div className="section-head">
                  <h2>Betriebe</h2>
                  <button
                    className="primary"
                    onClick={() => setPanel("create")}
                  >
                    Betrieb anlegen
                  </button>
                </div>
                <div className="filters">
                  <label>
                    Betrieb suchen
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <label>
                    Status
                    <select
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    >
                      <option value="all">Alle</option>
                      <option value="active">Aktiv</option>
                      <option value="paused">Pausiert</option>
                    </select>
                  </label>
                </div>
                {overview.organizations.length === 0 ? (
                  <p>Noch keine Betriebe. Legen Sie den ersten Betrieb an.</p>
                ) : rows?.length === 0 ? (
                  <p>
                    Keine Betriebe für diese Auswahl.{" "}
                    <button
                      onClick={() => {
                        setSearch("");
                        setFilter("all");
                      }}
                    >
                      Filter zurücksetzen
                    </button>
                  </p>
                ) : (
                  <div
                    className="tablewrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Betriebe"
                  >
                    <table>
                      <thead>
                        <tr>
                          {[
                            "Betrieb",
                            "Status",
                            "Mitarbeiter",
                            "Administratoren",
                            "Standortleitungen",
                            "Jetzt aktiv",
                            "Letzter Tap",
                            "Tags",
                            "Zuordnungen",
                            "Einladungen",
                            "Angelegt",
                            "Aktion",
                          ].map((label) => (
                            <th key={label} scope="col">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows?.map((row) => (
                          <tr key={row.organization_id}>
                            <th scope="row">{row.name}</th>
                            <td>
                              <span className={`badge ${row.status}`}>
                                {row.status === "active" ? "Aktiv" : "Pausiert"}
                              </span>
                            </td>
                            <td>{row.employees}</td>
                            <td>{row.administrators}</td>
                            <td>{row.location_managers}</td>
                            <td>{row.active_now}</td>
                            <td>
                              {row.last_tap
                                ? date(row.last_tap)
                                : "Noch kein Tap"}
                            </td>
                            <td>{row.tags}</td>
                            <td>{row.active_assignments}</td>
                            <td>{row.open_invitations}</td>
                            <td>{date(row.created_at)}</td>
                            <td>
                              <button onClick={() => setPanel(row)}>
                                {row.status === "active"
                                  ? "Pausieren"
                                  : "Fortsetzen"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : page === "audit" && audit ? (
            <section className="card">
              <h2>Protokollierte Aktionen</h2>
              {audit.events.length === 0 ? (
                <p>Keine weiteren Ereignisse.</p>
              ) : (
                <ul className="log">
                  {audit.events.map((event) => (
                    <li key={event.id}>
                      <time dateTime={event.created_at}>
                        {date(event.created_at)}
                      </time>
                      <div>
                        <strong>
                          {actions[event.action] ?? "Betreiber-Aktion"}
                        </strong>
                        <p>
                          {event.actor === "root"
                            ? "Serververwaltung"
                            : "Betreiber"}
                          {event.organization_id
                            ? ` · Betrieb ${event.organization_id}`
                            : ""}
                        </p>
                        {event.reason && <p>Grund: {event.reason}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="actions">
                {before && (
                  <button onClick={() => setBefore(null)}>
                    Neueste Ereignisse
                  </button>
                )}
                {audit.next_before && (
                  <button onClick={() => setBefore(audit.next_before)}>
                    Ältere Ereignisse
                  </button>
                )}
              </div>
            </section>
          ) : page === "health" && health ? (
            <section className="card">
              <h2>Ausgelieferter Stand und Sicherung</h2>
              <dl>
                <dt>Version</dt>
                <dd>{health.version ?? "Nicht verfügbar"}</dd>
                <dt>Datenbankgröße</dt>
                <dd>
                  {new Intl.NumberFormat("de-DE", {
                    maximumFractionDigits: 1,
                  }).format(health.database_bytes / 1024 / 1024)}{" "}
                  MiB
                </dd>
                <dt>Letzte Archivierung</dt>
                <dd>{date(health.last_archived_at)}</dd>
                <dt>Letzte geprüfte Basis</dt>
                <dd>{date(health.last_base_at)}</dd>
              </dl>
              <p className="muted">
                Zeitangaben in {BUSINESS_TIME_ZONE}. Die Basiszeit bezeichnet
                die Registrierung der geprüften Sicherung.
              </p>
            </section>
          ) : null}
        </main>
      </div>
      {panel !== null && (
        <ActionPanel
          runtime={runtime}
          target={panel}
          onClose={() => setPanel(null)}
          onDone={(message) => {
            setNotice(message);
            setPanel(null);
            setRefresh((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
function SidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button,input,textarea")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="overlay">
      <div
        ref={ref}
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "Tab") {
            const focusable = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),textarea:not(:disabled)",
              ) ?? [],
            );
            const first = focusable[0],
              last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="section-head">
          <h2 id="panel-title">{title}</h2>
          <button onClick={onClose}>Schließen</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ActionPanel({
  runtime,
  target,
  onClose,
  onDone,
}: {
  runtime: OperatorRuntime;
  target: "create" | Organization;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const command = useRef<{ key: string; id: string } | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const action =
    target === "create"
      ? "Betrieb anlegen"
      : target.status === "active"
        ? "Pausieren"
        : "Fortsetzen";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (target !== "create" && !confirmed) {
      if (reason.trim().length === 0) {
        setError("Bitte geben Sie einen Grund ein.");
        return;
      }
      setConfirmed(true);
      return;
    }
    const values =
      target === "create"
        ? { name: name.trim(), email: email.trim() }
        : {
            organizationId: target.organization_id,
            status: target.status === "active" ? "paused" : "active",
            reason: reason.trim(),
            rowVersion: target.row_version,
          };
    const key = JSON.stringify(values);
    if (command.current?.key !== key)
      command.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setError(undefined);
    try {
      await runtime.request(
        target === "create" ? "organizations/create" : "organizations/status",
        { ...values, commandId: command.current.id },
        mutationResult,
      );
      if (alive.current)
        onDone(
          target === "create"
            ? "Betrieb angelegt. Das Administratorkonto ist zugeordnet."
            : target.status === "active"
              ? "Betrieb pausiert."
              : "Betrieb fortgesetzt.",
        );
    } catch (error) {
      if (alive.current) setError(errorText(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <SidePanel
      title={target === "create" ? action : `${action}: ${target.name}`}
      onClose={onClose}
    >
      <ErrorBand message={error} />
      <form onSubmit={submit}>
        {target === "create" ? (
          <>
            <p>
              Der erste Administrator richtet danach Mitarbeiter, Arbeitsziele
              und Tags selbst ein. Ein neues Konto erhält eine Einladung; bei
              einem vorhandenen freien Konto erfolgt die Zuordnung ohne neue
              Mail.
            </p>
            <label>
              Name des Betriebs
              <input
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              E-Mail des ersten Administrators
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Wird angelegt …" : "Anlegen und einladen"}
            </button>
          </>
        ) : confirmed ? (
          <>
            <p>
              {target.status === "active"
                ? "Der Zugang dieses Betriebs wird pausiert. Die Daten bleiben erhalten."
                : "Der Zugang dieses Betriebs wird wieder freigegeben."}
            </p>
            <p>
              <strong>Grund:</strong> {reason}
            </p>
            <button className="primary" disabled={busy}>
              {busy ? "Wird gespeichert …" : `${action} bestätigen`}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmed(false)}
            >
              Grund bearbeiten
            </button>
          </>
        ) : (
          <>
            <label>
              Grund
              <textarea
                required
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button className="primary">Weiter zur Bestätigung</button>
          </>
        )}
      </form>
    </SidePanel>
  );
}
