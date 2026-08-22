# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-002 · Betriebsfähig machen — Container und Healthcheck

**Für:** Codex · **Risiko:** normaler Code + eine neue öffentliche Route
**Zeitbox:** zwei Arbeitssitzungen
**Vorbedingung:** T-001 ist committet

### Ziel

`backend-api` läuft reproduzierbar in einem Container und sagt von außen, ob es lebt.
**Alles läuft lokal — es wird kein einziges Konto und kein Cloud-Dienst gebraucht.**

Das ist die Vorbereitung für T-003 (Supabase) und T-004 (Hetzner). Wenn diese Aufgabe fertig
ist, ist das Deployment nur noch Kontenarbeit.

### Schritte

**1. Healthcheck-Endpunkt**

In `apps/backend-api/src/BackendHttpServer.ts` eine Route `GET /health` ergänzen:

- **Ohne Authentifizierung** — Überwachung muss ohne Zugangsdaten funktionieren
- Antwort bei Erfolg: `200` mit exakt `{"status":"ok"}`
- Antwort bei nicht erreichbarer Datenbank: `503` mit exakt `{"status":"degraded"}`
- **Keine weiteren Felder.** Keine Version, kein Hostname, keine Fehlermeldung, kein Stacktrace,
  keine Datenbank-Details. Ein unauthentifizierter Endpunkt gibt nichts preis.
- Header `Cache-Control: no-store`
- Die Datenbankprüfung ist ein einfaches `SELECT 1` mit kurzem Timeout (2 s), niemals eine
  fachliche Abfrage, und **nie** mit Mandantenkontext.

**2. Dockerfile für `backend-api`**

Ablage: `infrastructure/backend-api/Dockerfile` (der Ordner `infrastructure/` ist bisher leer).

- Mehrstufiger Build: Build-Stufe installiert und baut, Laufzeit-Stufe enthält nur das Ergebnis
- Node 24, exakt die Version aus `package.json` (`engines`)
- **Läuft als nicht-privilegierter Benutzer**, nicht als root
- `HEALTHCHECK` auf `/health`
- Passendes `.dockerignore` — `node_modules`, `dist`, `.git`, `ADO`, `.env*` bleiben draußen

**3. `docker-compose.yml` für lokal**

Ablage: `infrastructure/docker-compose.local.yml`

- `backend-api` plus eine lokale PostgreSQL zum Ausprobieren
- Migrationen aus `apps/backend-schema/migrations/` werden beim Start eingespielt
- Nur für lokale Entwicklung. Das ist **nicht** die Produktionsumgebung.

**4. Umgebungsvariablen dokumentieren**

`infrastructure/env.example` mit allen benötigten Variablen und Erklärung, **ohne echte Werte**.

- Prüfen, welche Variablen `backend-api` tatsächlich liest, und genau die aufführen
- Fehlt eine Pflichtvariable, muss der Dienst **beim Start** mit klarer Meldung abbrechen —
  nicht erst bei der ersten Anfrage
- Niemals ein Secret ins Repository. `.env` steht bereits in `.gitignore`

**5. `admin-web` Build prüfen**

`npm run build --workspace=@taptime/admin-web` muss durchlaufen und statische Dateien erzeugen.
Falls nicht: reparieren. Ausliefern kommt erst in T-005.

### Vision-Check

Diese Aufgabe berührt keine Nutzerinteraktion. Die Kette
`Trigger → WorkEvent → BusinessEngine → TimeEntry` wird nicht angefasst.
**Keine fachliche Logik ändern.** Fällt dabei etwas Fachliches auf, wird es gemeldet, nicht
nebenbei repariert.

### Nicht anfassen

- `packages/core`, jede Geschäftslogik, jede Migration
- `apps/mobile`, `apps/synthetic-android-e2e`
- Bestehende API-Routen und deren Verhalten

### Prüfung

- `npm run typecheck` und `npm test` grün (mindestens `backend-api`, `core`, `admin-web`)
- **CI grün — `[skip ci]` ist hier verboten**, es ändert sich ausführbarer Code
- Container baut und startet
- `curl http://localhost:<port>/health` liefert `200` und exakt `{"status":"ok"}`
- Bei gestoppter Datenbank liefert dieselbe Anfrage `503` und exakt `{"status":"degraded"}`
- Dienst startet **nicht** ohne Pflichtvariablen und sagt verständlich, welche fehlt

### Zusätzliches Review

`/health` ist eine neue **unauthentifizierte, öffentlich erreichbare** Route. Nach der
Implementierung läuft ein unabhängiges Review durch einen zweiten Agenten mit genau einer Frage:

> Gibt dieser Endpunkt irgendeine Information preis, die ein Unbefugter nicht haben darf —
> direkt, über Fehlermeldungen, über Antwortzeiten oder über Header?

### Abschluss

Vier Punkte melden: geänderte Dateien · ausgeführte Verifikation · verbleibende Risiken ·
nächster Schritt. **Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-003` — Supabase-Projekt in der EU-Region, Migrationen einspielen.
Braucht ein Supabase-Konto vom Product Owner.
