# TapTim.e — Status

**Stand:** 18.09.2026 · Produktion läuft auf `939b4ba` (Deploy 10:47 Uhr, vier Belege nach
DEPLOY.md erbracht). Fertig ist das Produkt, wenn das ausgelieferte, wiederherstellbare System
einen vollständigen Monatsabschluss übersteht.

## Vorhanden — und seit heute ausgeliefert

- Domäne und Business Engine: `Trigger → WorkEvent → Engine → TimeEntry`, Korrekturen append-only.
- Backend: 11 `apps/backend-*`-Workspaces; 52 registrierte HTTP-Pfade aus `BACKEND_HTTP_ROUTES`,
  jede Route mit Schutzklasse (T-053). 26 Migrationen, in Produktion vollständig angewendet.
- Mobile: Anmeldung, Einladungseinlösung, NFC, manuelle Erfassung, eigene Zeiten, Offline v4,
  Abgleich v2, Leases v3; Queue-Löschung erst nach Archivnachweis (T-052).
- Verwaltung: Beschäftigte mit Kontoeinladung (T-047), Standorte, Arbeitsziele, Tags, Korrektur,
  Prüfentscheidung, Pausen, CSV V3; eine Zeitzone Europe/Berlin (T-036); Anmeldefehler mit
  Ursache (T-040); strikte CSP; Deploy-Tor auf den Backend-Aussteller (T-039).
- Betrieb: T-035 in Produktion aktiv — physische Basissicherung, fortlaufendes externes WAL
  (`pg_receivewal` + Borg), versionierter Archivvertrag (Migration 023), Wiederherstellung am
  18.09. viermal aus dem externen Archiv bewiesen (zuletzt `base-…-20260918T084325Z`, 26
  Migrationen, RLS erzwungen). Rückweg auf ein Image vor 023 ist keiner mehr.
- Mail: Supabase → Brevo (D-057) mit DKIM/DMARC bei INWX; Zurücksetzungs-Mail zugestellt.

## Deploy am 18.09. — was er gekostet hat

Fünf Anläufe für den ersten T-035-Deploy; jeder Fehler ein Erstlauf-Fehler, jeder mit
Regressionstest behoben, jeder vorwärts repariert, kein Container von Hand gestartet:

1. `taptime-backup`: `tar --list | grep --quiet` starb an EPIPE bei 280 KB Liste; dazu ein
   EXIT-Trap auf einer `local`-Variablen (`d68ff4d`).
2. `--glob-archives "sh:…"`: Borg 1.2/1.4 sucht das Präfix wörtlich, kein Archiv gefunden;
   der nachgebaute Borg im Test erwartete genau das falsche Muster (`9ea3b31`).
3. `taptime-restore-verify`: derselbe Trap-Fehler wie in 1 (`939b4ba`).
4. Barriere-Fenster 120 s zu knapp für die erste Basis-Registrierung des Archivierers
   (Quittung 08:31:27, Fenster bis 08:30:45); zweiter Aufruf lief durch.

Offen daraus (T-057): Das Deploy-Skript läuft nach gescheiterter Sicherung weiter, weil die
zweite Prüfung die alte Statusdatei liest; Barriere-Fenster oder Reihenfolge beim Erstlauf;
DEPLOY.md beschreibt eine Einfügefunktion der Hetzner-Konsole, die es nicht gibt (US-Belegung,
Tippregeln nötig); der Deploy läuft aus dem Terminal des Product Owners, nicht aus Codex.
Deploy-Schlüssel `taptime_server` hat keine Passphrase (T-024 rückt vor).

## Offen bis zum Pilotbetrieb

- PO-Schritt 5 (D-049): `SUPABASE_SERVICE_ROLE_KEY` und Redirect-URL in `/opt/taptime/.env`;
  echte Einladung an echtes Postfach, am Handy gelesen = Abnahme T-047. Neue APK für T-052.
- Tagesfreigabe, Kalender, Pausenautomatik: T-048–T-050. T-055 Wiederaufnahme nach Restore.
- T-056 CI baut die Images; T-057 Deploy-Härtung; T-037; T-043/T-044; T-016; T-024.
- Firma, Recht, Store, Signierschlüssel; Supabase-Tarif; Aussperr-Test durch den PO.

## Bekannte Kleinigkeiten und offene Risiken

- **P1 T-055:** Lease-Bindung und Reihenfolge über Installationen nach Restore (D-055).
- **P2 Betrieb:** `[7/7] Archivvertrag ist aktiv`-Meldung erscheint auch, wenn nur der Cutover
  aktiv war; Health-Abfrage ohne Cache; alte Caddy-Assets; Monitoring-Test braucht GNU-Werkzeuge.
- **P2 Sicherheit:** `*.supabase.co` in der CSP auf den Aussteller verengen; SECURITY-DEFINER-
  Pfade und Policy-Prädikate prüfen; Supabase-Anmeldung außerhalb eigener Ratenbegrenzung.
- **P2 Fachlich:** Geräteuhr bei manueller Erfassung, unbegrenzter vergessener Stopp, Offline-
  Pausenkonflikte ohne aktive Zeitreferenz. Mobile OwnTimeScreen zeigt die Gerätezone.
- **P2/P3 Oberfläche und Pflege:** keine APK-Meldung, Prüfposten-Abweisung ohne Erklärung,
  ungeteiltes Web-Bündel, Fachdokumente in T-019, PostgreSQL-Suiten seriell.
