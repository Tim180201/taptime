# Aktuelle Aufgabe

> **Stand 22.09.2026:** Produktion auf `d75fd56`. Auf `main` fertig und grün: T-065, T-066, T-070,
> T-069 (`360b356`, CI-Fix `059b054`) und T-057. PO-Entscheid: alles in **einen** Deploy.
> Reihenfolge: **T-068a → T-068b → Konsolenschritt (Controller) → Deploy → Betreiber-Konto →
> APK → Geräteabnahme → Pilot Monat 1**. Frühere Briefs (T-066, T-069, T-057) stehen in der Git-Historie.

## T-068a · Betreiber-Bereich — Server

**Für:** Development · **Risiko:** Mandantentrennung, Anmeldung, service-role-Schlüssel, zentrale Auflösung
**Zeitbox:** zwei Sitzungen; Reihenfolge Schema → Anmeldung → Fähigkeiten → Pausieren → Werkzeug.
Reicht die Zeit nicht, nach „Fähigkeiten" stoppen und melden.
**Grundlage:** D-049, D-068, D-074, D-075; Entwurf `ADO/01_Architecture/Betreiber_Entwurf/README.md`
(Abschnitte 1–5, 8). T-068b (Web, Caddy, Deploy) folgt danach.

### Auftrag

1. **Migration 032** (001–031 unverändert):
   - `platform_operators(id, issuer, subject, created_at, revoked_at)`, eindeutig je aktivem
     (issuer, subject); `platform_audit_events` append-only (Trigger gegen UPDATE/DELETE), FORCE RLS,
     `operator_principal` für Root-Aktionen.
   - **Gegenseitiger Ausschluss (D-074):** Ein Betreiber kann keine aktive Mitgliedschaft haben und
     umgekehrt — in beiden Richtungen in der Datenbank erzwungen (Freischalten und jede
     Mitgliedschafts-Anlage, inkl. 008/026-Wege).
   - `organizations.status ('active'|'paused')`, `paused_at`, `pause_reason`.
   - NOLOGIN-Rolle `taptime_platform_operator`; alle Betreiber-Funktionen SECURITY DEFINER,
     `EXECUTE` nur für diese Rolle, jede prüft `current_setting('role')` und ein aktives
     Betreiber-Konto aus `app.operator_id`.
2. **Anmeldung:** `SupabaseJwtAccessTokenVerifier` gibt `aal` mit heraus (bestehende Aufrufer
   unverändert). Betreiber-Auflösung über (issuer, subject) → `app.operator_id`. Jede Route
   `/v1/operator/*` außer `GET /v1/operator/session` verlangt `aal2` und ein aktives Konto.
   Die Session-Route antwortet `mfa_required` bei `aal1`.
3. **Verbindung zur Datenbank (D-079, entschieden 22.09.):** Vorschlag aus dem Stopp-Bericht
   angenommen: Login `taptime_operator_runtime` (NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB,
   NOCREATEROLE, NOREPLICATION), nur Mitglied von `taptime_platform_operator`; Variable
   `TAPTIME_OPERATOR_DATABASE_URL`, eigener Pool, Aufnahme in die Prüfung auf getrennte
   Datenbanknutzer. **Optional wie der Einlader:** fehlt die Variable, startet das Backend normal
   und die Betreiber-Routen antworten `503 operator_not_configured` (Test). Dazu das Root-Werkzeug
   `taptime-operator-db-login` (mit den Betriebsdateien installiert, ohne Argumente = anlegen,
   `--rotate` = neu erzeugen): Passwort kryptografisch im Prozess, an PostgreSQL nur über stdin
   (nie argv, `log_statement` für diese Sitzung aus), `.env` atomar (root:root, 0600, doppelte
   oder abweichende Schlüssel → Abbruch, Anlegen rotiert nie still), danach nur `backend-api` neu
   starten und prüfen, dass `/v1/operator/session` nicht mehr `operator_not_configured` meldet.
   Keine Ausgabe des Werts, kein Tracing. Rücknahme bei Fehler vor dem Schreiben der `.env`.
   Keine gesonderte Verwahrung nötig (D-079); RESTORE.md bekommt den Schritt „nach
   Wiederherstellung `taptime-operator-db-login --rotate`".
4. **Routen und Schutz:** `GET /v1/operator/session`, `POST /v1/operator/overview`,
   `/organizations/create`, `/organizations/status`, `/audit`, `/health` (Inhalte laut Entwurf
   Abschnitt 4). Eigene Schutzklasse `operator_api` (30/min) im Routen-Guard (T-053).
   **Zusätzlich im Backend:** Betreiber-Routen antworten nur, wenn der vom Proxy übergebene Host
   `betreiber.tb-infra.de` ist (konfigurierbar, Standard gesetzt); sonst 404 wie eine unbekannte
   Route. Caddy folgt in T-068b.
5. **Betrieb anlegen:** zweiphasig wie 026 (vorbereiten → Einladung über den bestehenden
   `SupabaseAccountInviter`, Weiterleitung `/willkommen` → abschließen: Betrieb, Benutzer, Bindung,
   Mitgliedschaft `administrator`). Nur E-Mail-Hash gespeichert. E-Mail gehört einem Konto mit
   Mitgliedschaft oder einem Betreiber → `identity_unavailable`, nichts angelegt. Name wie 007
   normalisiert. Idempotent über `commandId`. Der service-role-Schlüssel bleibt in genau einer
   Klasse; jede Verwendung wird wie heute protokolliert (D-049).
6. **Übersicht nur Zahlen (D-068):** Test mit Erlaubnisliste der Spalten/Schlüssel jeder
   Betreiber-Funktion; nie Namen, E-Mails, `display_name`, Personen-IDs oder einzelne Zeiten
   (einzige Ausnahme: letzter Tap je Betrieb).
7. **Pausieren (D-075, D-080):** Auch die beiden Offline-Resolver `lock_offline_active_actor_v1`
   und `lock_offline_historical_actor_v1` weisen pausierte Betriebe ab; bei aktivem Betrieb bleibt
   ihr Verhalten unverändert (auch entzogene Mitgliedschaften im historischen Weg). Nachweis, dass
   weder neue noch alte Clients deswegen etwas aus der Warteschlange löschen.
   Weiter gilt: An der zentralen Auflösung (`resolve_request_actor`,
   `lock_request_actor`) wird ein pausierter Betrieb erkannt; das Backend antwortet überall
   `403 organization_paused`. Die Unterscheidung „pausiert" vs. „unbekannt" darf nur dem
   betroffenen, sonst gültigen Mitglied gegenüber sichtbar werden. App und Admin-Web zeigen
   „Ihr Betrieb ist pausiert. Bitte wenden Sie sich an Taptura." Offline-Warteschlange bleibt
   erhalten (T-052), nach Fortsetzen normaler Abgleich. Alte APKs: bestehende Fehleranzeige ist
   erlaubt, sie dürfen nur nichts löschen — nachweisen.
8. **Werkzeug `taptime-operator-grant`:** root-eigen, mit den Betriebsdateien installiert;
   Argument genau eine Supabase-UUID (Regex), optional `--revoke`; liest den Aussteller aus der
   vorhandenen Server-Konfiguration, ohne Werte auszugeben; schreibt ein Protokoll-Ereignis mit
   `operator_principal`. Kein HTTP-Weg zum Anlegen von Betreibern.

### Tests (Rotnachweis zuerst)

Mandant erreicht keine Betreiber-Funktion (jede Laufzeitrolle); Betreiber ohne `aal2` abgewiesen;
entzogener Betreiber abgewiesen; Betreiber-Route über fremden Host 404; Betreiber mit
Mitgliedschaft unmöglich (beide Richtungen); Anlegen: Erfolg, idempotent, `identity_unavailable`,
Einladung schlägt fehl → nichts halb angelegt; Pausieren: jede Mandantenroute `organization_paused`,
Fortsetzen stellt alles her, Offline-Abgleich danach; Erlaubnisliste der Ausgaben; Protokoll
append-only; Routen-Guard mit `operator_api`; `taptime-operator-grant` mit Stub-Datenbank.

### Nicht Teil

Keine Web-App, kein Caddy (T-068b). Kein Server, keine Secrets. Kein Deploy.

**Abgrenzung 22.09. (TL):** Am Deploy-Controller darf T-068a **ausschließlich** die Inventar-,
Rechte-, Syntax- und Abgleichlisten um `taptime-operator-grant` und `taptime-operator-db-login`
erweitern (`operations_paths()` und die Prüfungen darum), dazu Operations-Dockerfile und
-Bootstrap. **Keine Änderung am Ablauf** des Deploys: keine neuen Schritte, keine geänderte
Reihenfolge, keine neuen Aufrufe der Werkzeuge im Deploy. T-068b erweitert den Controller
danach um das Betreiber-Web.

**Zwei P2 aus dem Review vorher beheben:** (1) Die E-Mail-Sperre benutzt denselben Hash wie der
bestehende 026-Weg (gemeinsame Hilfsfunktion, kein zweites Präfix); Rotnachweis über den
gleichzeitigen Anlageversuch. (2) Der neue Weg meldet wie 026 `inviter.needsAttention()`, wenn
extern eingeladen wurde und der lokale Abschluss scheitert oder unklar bleibt.

### Bericht

`.t068a-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit, kein Push.
