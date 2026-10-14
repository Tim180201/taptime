# Aktuelle Aufgabe

> **Stand 14.10.2026:** T-120 abgeschlossen (`d193725`). Deploy 5 mit neuen App-Builds und Geräteabnahme liegen beim PO.
> Parallel dazu **T-119** (Code-Teil). Ausgeliefert wird T-119 zusammen mit T-024, vor den ersten echten Konten.

## T-119 · Sicherheit vor echten Daten

**Für:** Development · **Risiko:** hoch (Inhaltsrichtlinie, Rechteprüfung, Anmeldung) · **Zeitbox:** ein bis zwei
Sitzungen. Kein Zugriff auf Supabase oder Produktion, kein Deploy.

### Ausgangslage (`d193725`)

- Die Inhaltsrichtlinie (CSP) von Verwaltung und Betreiber-Bereich erlaubt `connect-src https://*.supabase.co`.
  Die genaue Supabase-Herkunft steht in `apps/mobile/eas.json`; der Image-Bau liest sie dort.
- Viele SECURITY-DEFINER-Funktionen; `B3SchemaSecurity` prüft Eigentümer und Rechte nur für einzelne Gruppen.
- Die Passwort-Mindestlänge 8 steht an mehreren Stellen fest im Code. Die App meldet eine Supabase-Drosselung (HTTP 429)
  als „nicht verfügbar“.
- Die Anmeldung geht direkt von App und Web an Supabase (D-010); D-139 regelt den Schutz.

### Teil 1 · Inhaltsrichtlinie

1. `connect-src` erlaubt statt `*.supabase.co` genau die Supabase-Herkunft, überall, wo die CSP sie heute nennt.
2. Ein Test leitet die erlaubte Herkunft aus `apps/mobile/eas.json` ab und vergleicht sie mit dem Caddyfile (AGENTS
   1.6). Keine Wildcard für Supabase mehr.

### Teil 2 · SECURITY DEFINER und Policies

Dauerhafte Prüfungen in `B3SchemaSecurity`, abgeleitet aus dem Katalog, ohne feste Zahlen:
3. Jede SECURITY-DEFINER-Funktion im Schema hat einen festen `search_path` (`pg_catalog`). Ihr Eigentümer ist eine
   NOLOGIN-Rolle ohne Superuser. `PUBLIC` und LOGIN-Rollen haben kein direktes EXECUTE.
4. Jede RLS-Policy auf einer Tabelle mit `organization_id` bindet an den Mandanten aus dem Anfragekontext. Ausnahmen
   stehen im Test auf einer Liste mit Begründung je Eintrag und werden im Bericht genannt.
5. Befunde werden als P0–P3 gemeldet. P0 und P1 werden in T-119 behoben (Migration 058 mit vollständigen Körpern),
   P2 und P3 nur notiert.

### Teil 3 · Anmeldung (D-139)

6. Die Mindestlänge für Passwörter steht in einer gemeinsamen Quelle (`shared/`), Wert 10. Alle Stellen in App, Web und
   Betreiber-Bereich, die ein Passwort setzen oder prüfen, lesen sie von dort. Die Meldung lautet „mindestens 10
   Zeichen“.
7. Drosselt Supabase (429 oder `over_request_rate_limit`), zeigen App, Web und Betreiber-Bereich „Zu viele Versuche.
   Bitte warten Sie einige Minuten.“ (App: „warte“). Nicht „nicht verfügbar“, nicht „falsches Passwort“.
8. `infrastructure/DEPLOY.md`, Supabase-Abschnitt: die PO-Schritte nach D-139. Mindestlänge 10, Anmeldegrenze je IP
   100 in 5 Minuten. Nach dem Wechsel auf Pro (D-130) den Schutz vor bekannten geleakten Passwörtern einschalten.
   Jeweils mit Hinweis, wer ändert und wann.

### Tests

Je Punkt rot vor der Änderung:
- CSP mit genau einer Supabase-Herkunft, gleich `eas.json`; die Browserläufe mit CSP bleiben grün.
- Katalogprüfungen 3 und 4 über alle Funktionen und Policies; ein absichtlich falsches Testobjekt wird erkannt.
- Mindestlänge: 9 Zeichen abgewiesen, 10 angenommen, in jedem betroffenen Formular. Alle lesen dieselbe Quelle.
- Drosselung: die Meldung in App, Web und Betreiber-Bereich.
- Alle Suiten, Postgres-Tests, Typecheck, Builds, Bundles und Browserläufe grün.

### Grenzen

Keine Vorschaltstelle für die Anmeldung, kein CAPTCHA, kein Zugriff auf das Supabase-Dashboard (D-139). Kein Deploy.
ADO nicht ändern; DEPLOY.md gehört zur Umsetzung (AGENTS 7).

### Bericht

`.t119-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei
P1/P2. Kein Commit vor `APPROVED` durch den TL.
