# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-006 · Admin-Web ausliefern und Erstinbetriebnahme

**Für:** Codex · **Risiko:** öffentlich erreichbar + erster echter Zugang → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** T-005 abgeschlossen (`4fd2de2`)

### Ziel

**Der Product Owner meldet sich unter `https://admin.tb-infra.de` an und sieht die Übersicht.**

Die Aufgabe ist erst fertig, wenn das passiert ist — nicht wenn etwas ausgeliefert wurde.

### Der entscheidende Aufbau — bitte genau lesen

`AdminWebApiClient` ruft die API über **relative Pfade** auf (`/v1/session`,
`/v1/administration/…`), und `backend-api` hat **kein CORS**. Admin-Web und API **müssen
also auf demselben Ursprung liegen.**

Daher:

```
admin.tb-infra.de
  /            → statische Dateien des Admin-Web
  /v1/*        → backend-api
  /health      → backend-api

api.tb-infra.de   bleibt unverändert (Mobile-App)
```

**Kein CORS einbauen.** Wenn du in Versuchung gerätst, CORS-Header zu setzen, ist der Aufbau
falsch — dann melden statt bauen.

### Schritte

**1. Admin-Web bauen**

- `npm run build --workspace=@taptime/admin-web`
- Erforderliche Bau-Variablen: `VITE_TAPTIME_SUPABASE_URL` und
  `VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY`
- Der Publishable Key ist bauartbedingt öffentlich — er gehört in den Auslieferungsstand.
  **Der Service-Role-Key niemals.** Prüfe das Ergebnis darauf.

**2. Ausliefern über Caddy**

- Statische Dateien schreibgeschützt einhängen, **kein Verzeichnislisting**
- Single-Page-Fallback auf `index.html`, aber **nicht** für `/v1/*` und `/health`
- Versionsangaben weiterhin unterdrückt

**3. HSTS auf beiden Hosts**

`Strict-Transport-Security: max-age=31536000; includeSubDomains`
Caddy setzt das nicht von selbst. Jetzt ist der richtige Zeitpunkt, weil ab hier echte
Browser auf das System zugreifen.

**4. Erstinbetriebnahme**

- Benutzer für den Product Owner in Supabase Auth anlegen
- Bootstrap auf dem Server ausführen: `apps/backend-bootstrap`, CLI mit
  `--organization-name`, `--operator-login`, `--request-id`, Geheimnisse über
  `--secrets-stdin` — **niemals über argv**
- Identität des Product Owner als Administrator binden
- Nachweisen: genau **eine** Organisation, genau **eine** Administrator-Mitgliedschaft,
  die eingebaute **Allgemeine Arbeitszeit** vorhanden

**5. Übergabe an den Product Owner**

Melde ihm: Adresse, E-Mail des Zugangs und wie er sein Passwort setzt.
**Das Passwort niemals im Chat, im Bericht oder im Repository.**

### Vision-Check

Keine fachliche Logik, keine Migration. Ausliefern und in Betrieb nehmen.

### Nicht anfassen

- `apps/backend-schema/migrations/`, `packages/core`, jede Geschäftslogik
- `apps/mobile`, `apps/synthetic-android-e2e`
- Der bestehende `api.tb-infra.de`-Block in der Caddy-Konfiguration

### Prüfung — nachweisen, nicht behaupten

- `https://admin.tb-infra.de` lädt das Admin-Web, gültiges Zertifikat
- `https://admin.tb-infra.de/health` liefert `200 {"status":"ok"}` — beweist denselben Ursprung
- Ein Aufruf von `/v1/session` ohne Anmeldung → `401`
- `Strict-Transport-Security` auf beiden Hosts vorhanden
- Kein Verzeichnislisting, keine Versionsangaben
- **Kein Service-Role-Key** im Auslieferungsstand — im gebauten Ergebnis suchen
- Weiterhin von außen nur 22, 80 und 443 offen
- Genau eine Organisation, genau eine Administrator-Mitgliedschaft
- Nach echtem Serverneustart ist beides wieder erreichbar
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Ist über `admin.tb-infra.de` etwas erreichbar, das nicht erreichbar sein soll — Quelltext,
> Verzeichnisse, Konfiguration, Schlüssel? Kann jemand ohne gültige Anmeldung eine
> `/v1/`-Route erreichen?

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-007` Backup und **getesteter Restore** · `T-008` Pausen · `T-009` Standorte ·
`T-010` Oberflächen · `T-011` installierbare App.
