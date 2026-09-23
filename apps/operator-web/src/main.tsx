import { createRoot } from "react-dom/client";
import { App } from "./App";
import { OperatorRuntime } from "./OperatorRuntime";
import {
  SupabaseOperatorAuth,
  readConfiguration,
} from "./SupabaseOperatorAuth";
const configuration = readConfiguration(import.meta.env);
const root = createRoot(document.getElementById("root")!);
// Storage may be disabled by browser policy. Never silently fall back to permanent storage.
try {
  if (!configuration) throw new Error("configuration");
  sessionStorage.setItem("taptime-storage-check", "1");
  sessionStorage.removeItem("taptime-storage-check");
  const runtime = new OperatorRuntime(
    new SupabaseOperatorAuth(
      configuration.url,
      configuration.key,
      sessionStorage,
    ),
    sessionStorage,
  );
  root.render(<App runtime={runtime} />);
} catch {
  root.render(
    <main className="login">
      <section className="card">
        <h1>Betreiber-Zugang nicht verfügbar</h1>
        <p>
          Bitte prüfen Sie die öffentliche Anmeldekonfiguration und erlauben Sie
          den Sitzungsspeicher im Browser.
        </p>
      </section>
    </main>,
  );
}
