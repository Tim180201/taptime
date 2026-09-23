export interface MfaFactor {
  factorId: string;
  qrCode?: string;
  secret?: string;
}
export interface OperatorAuth {
  getAccessToken(): Promise<string | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  prepareMfa(): Promise<MfaFactor>;
  verifyMfa(factorId: string, code: string): Promise<void>;
  onSignedOut(callback: () => void): () => void;
}
export class OperatorError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export type OperatorState =
  | { status: "login" | "checking" | "blocked"; message?: string }
  | { status: "mfa"; factor: MfaFactor; message?: string }
  | { status: "ready" };
export const IDLE_MILLISECONDS = 30 * 60 * 1000;
const ACTIVITY_KEY = "taptime-operator-last-activity";

/** The server is the authority. An SDK session alone never opens the business views. */
export class OperatorRuntime {
  private state: OperatorState = { status: "checking" };
  private listeners = new Set<() => void>();
  private generation = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private unsubscribeAuth: (() => void) | undefined;
  private pending = new Set<AbortController>();
  private running = false;
  private signOutWork: Promise<void> = Promise.resolve();
  constructor(
    private auth: OperatorAuth,
    private storage: Storage,
    private fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
    private now = Date.now,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(state: OperatorState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.unsubscribeAuth = this.auth.onSignedOut(() =>
      this.clear("Die Sitzung ist beendet. Bitte melden Sie sich erneut an."),
    );
    for (const event of ["pointerdown", "keydown", "scroll"])
      window.addEventListener(event, this.activity, { passive: true });
    window.addEventListener("focus", this.checkIdle);
    document.addEventListener("visibilitychange", this.checkIdle);
    this.timer = setInterval(this.checkIdle, 1000);
    void this.refresh();
  }
  dispose() {
    this.running = false;
    this.generation++;
    this.abort();
    this.unsubscribeAuth?.();
    clearInterval(this.timer);
    for (const event of ["pointerdown", "keydown", "scroll"])
      window.removeEventListener(event, this.activity);
    window.removeEventListener("focus", this.checkIdle);
    document.removeEventListener("visibilitychange", this.checkIdle);
  }
  private abort() {
    this.pending.forEach((controller) => controller.abort());
    this.pending.clear();
  }
  private expired() {
    const value = Number(this.storage.getItem(ACTIVITY_KEY));
    return (
      !Number.isFinite(value) ||
      value <= 0 ||
      this.now() < value ||
      this.now() - value >= IDLE_MILLISECONDS
    );
  }
  private touch() {
    this.storage.setItem(ACTIVITY_KEY, String(this.now()));
  }
  private tracksActivity() {
    return (
      this.state.status !== "login" &&
      (this.state.status === "ready" ||
        this.state.status === "mfa" ||
        this.storage.getItem(ACTIVITY_KEY) !== null)
    );
  }
  private activity = () => {
    if (this.tracksActivity()) {
      if (this.expired()) void this.signOut();
      else this.touch();
    }
  };
  private checkIdle = () => {
    if (this.tracksActivity() && this.expired()) void this.signOut();
  };
  private clear(message?: string) {
    this.generation++;
    this.abort();
    this.storage.removeItem(ACTIVITY_KEY);
    this.emit({ status: "login", message });
  }
  async signOut() {
    this.clear("Die Sitzung ist beendet. Bitte melden Sie sich erneut an.");
    this.signOutWork = this.signOutWork
      .then(() => this.auth.signOut())
      .catch(() => {});
    await this.signOutWork;
  }
  async signIn(email: string, password: string) {
    await this.signOutWork;
    const generation = ++this.generation;
    this.emit({ status: "checking" });
    try {
      await this.auth.signIn(email, password);
      if (generation !== this.generation) return;
      this.touch();
      await this.refresh();
    } catch (error) {
      if (generation === this.generation)
        this.emit({ status: "login", message: errorText(error) });
    }
  }
  async verify(code: string) {
    if (this.state.status !== "mfa") return;
    if (this.expired()) {
      await this.signOut();
      return;
    }
    const generation = this.generation;
    const factor = this.state.factor;
    try {
      await this.auth.verifyMfa(factor.factorId, code);
      if (generation === this.generation) await this.refresh(factor);
    } catch (error) {
      if (generation === this.generation)
        this.emit({ status: "mfa", factor, message: errorText(error) });
    }
  }
  async refresh(existingFactor?: MfaFactor) {
    const generation = ++this.generation;
    this.abort();
    this.emit({ status: "checking" });
    try {
      const token = await this.auth.getAccessToken();
      if (generation !== this.generation) return;
      if (token === null) {
        this.emit({ status: "login" });
        return;
      }
      if (this.expired()) {
        await this.signOut();
        return;
      }
      const result = await this.exchange(
        "session",
        undefined,
        token,
        generation,
      );
      if (generation !== this.generation) return;
      if (result.status === "active" && result.aal === "aal2") {
        this.emit({ status: "ready" });
        return;
      }
      if (result.status === "mfa_required" && result.aal === "aal1") {
        const factor = existingFactor ?? (await this.auth.prepareMfa());
        if (generation === this.generation)
          this.emit({ status: "mfa", factor });
        return;
      }
      throw new OperatorError("invalid_response");
    } catch (error) {
      if (generation === this.generation) {
        if (error instanceof OperatorError && error.code === "unauthorized")
          await this.signOut();
        else this.emit({ status: "blocked", message: errorText(error) });
      }
    }
  }
  async request<T>(
    path: string,
    body: Record<string, unknown>,
    decode: (value: Record<string, unknown>) => T,
  ): Promise<T> {
    if (this.state.status !== "ready") throw new OperatorError("session_ended");
    if (this.expired()) {
      await this.signOut();
      throw new OperatorError("session_ended");
    }
    const generation = this.generation;
    try {
      const token = await this.auth.getAccessToken();
      if (!token) throw new OperatorError("unauthorized");
      if (generation !== this.generation)
        throw new OperatorError("session_ended");
      const result = await this.exchange(path, body, token, generation);
      if (generation !== this.generation)
        throw new OperatorError("session_ended");
      return decode(result);
    } catch (error) {
      if (generation === this.generation && error instanceof OperatorError) {
        if (error.code === "unauthorized" || error.code === "forbidden")
          await this.signOut();
        else if (error.code === "mfa_required") await this.refresh();
      }
      throw error;
    }
  }
  private async exchange(
    path: string,
    body: Record<string, unknown> | undefined,
    token: string,
    generation: number,
  ) {
    if (
      ![
        "session",
        "overview",
        "organizations/create",
        "organizations/status",
        "audit",
        "health",
      ].includes(path)
    )
      throw new OperatorError("invalid_request");
    const controller = new AbortController();
    this.pending.add(controller);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await this.fetcher(`/v1/operator/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
      });
      const value: unknown = await response.json();
      if (generation !== this.generation)
        throw new OperatorError("session_ended");
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new OperatorError("invalid_response");
      const result = value as Record<string, unknown>;
      if (!response.ok) {
        const error = result.error as { code?: unknown } | undefined;
        throw new OperatorError(
          typeof error?.code === "string" ? error.code : "service_unavailable",
        );
      }
      return result;
    } catch (error) {
      throw error instanceof OperatorError
        ? error
        : new OperatorError("service_unavailable");
    } finally {
      clearTimeout(timeout);
      this.pending.delete(controller);
    }
  }
}
export function errorText(error: unknown): string {
  const code =
    error instanceof OperatorError ? error.code : "service_unavailable";
  const messages: Record<string, string> = {
    credentials_rejected:
      "E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie Ihre Eingaben.",
    email_not_confirmed: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.",
    forbidden:
      "Dieses Konto hat keinen Betreiber-Zugang. Bitte verwenden Sie Ihr freigeschaltetes Betreiberkonto.",
    unauthorized:
      "Die Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
    session_ended: "Die Sitzung ist beendet. Bitte melden Sie sich erneut an.",
    mfa_invalid:
      "Der Code konnte nicht bestätigt werden. Bitte geben Sie einen aktuellen Code ein.",
    identity_unavailable:
      "Diese E-Mail-Adresse gehört bereits einem Zugang in einem Betrieb oder einem Betreiberkonto. Bitte verwenden Sie eine andere Adresse.",
    invitation_delivery_failed:
      "Die Einladung konnte nicht zugestellt werden. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut.",
    invitation_service_unavailable:
      "Der Einladungsdienst ist nicht erreichbar. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es erneut.",
    invitation_needs_attention:
      "Die Einladung muss geprüft werden. Bitte prüfen Sie den Einladungsversand, bevor Sie den Versuch wiederholen.",
    conflict: "Ansicht veraltet, bitte neu laden.",
    command_id_conflict:
      "Der Versuch passt nicht mehr zu diesen Eingaben. Bitte schließen Sie den Bereich und beginnen Sie erneut.",
    operator_not_configured:
      "Der Betreiber-Zugang ist noch nicht eingerichtet. Bitte schließen Sie die Einrichtung auf dem Server ab.",
    account_creation_not_configured:
      "Der Einladungsversand ist noch nicht eingerichtet. Bitte lassen Sie die Einrichtung prüfen.",
    invalid_email: "Bitte prüfen Sie die E-Mail-Adresse.",
    invalid_request:
      "Die Angaben konnten nicht verarbeitet werden. Bitte prüfen Sie Ihre Eingaben.",
    invalid_response:
      "Die Antwort konnte nicht gelesen werden. Bitte laden Sie die Ansicht erneut.",
    rate_limited:
      "Zu viele Anfragen. Bitte warten Sie eine Minute und versuchen Sie es erneut.",
    invitation_rate_limited:
      "Zu viele Einladungen. Bitte warten Sie und versuchen Sie es erneut.",
    not_found:
      "Der Betrieb wurde nicht gefunden. Bitte laden Sie die Ansicht neu.",
    service_unavailable:
      "Der Dienst ist nicht erreichbar. Ihre Eingaben wurden nicht geprüft. Bitte versuchen Sie es erneut.",
  };
  return messages[code] ?? messages.service_unavailable!;
}
