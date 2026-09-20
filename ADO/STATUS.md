# TapTim.e — Status

**Stand:** 18.09.2026 · Produktion läuft auf `91441c8` (Deploy 17:05 Uhr im ersten Anlauf, Migration 027
und 028 angewendet; sechs bewiesene Wiederherstellungen an diesem Tag). Produktion und `main`
tragen denselben Anwendungsstand (T-058, T-043, T-060, T-059); offen sind nur noch Dokumente
(`e6efe86`). Fertig ist das Produkt, wenn das ausgelieferte, wiederherstellbare System einen
vollständigen Monatsabschluss übersteht.

## Vorhanden — und seit heute ausgeliefert

- Domäne und Business Engine: `Trigger → WorkEvent → Engine → TimeEntry`, Korrekturen append-only.
- Backend: 11 `apps/backend-*`-Workspaces; 52 registrierte HTTP-Pfade aus `BACKEND_HTTP_ROUTES`,
  jede Route mit Schutzklasse (T-053). 26 Migrationen, in Produktion vollständig angewendet.
- Mobile: Anmeldung, Einladungseinlösung, NFC, manuelle Erfassung, eigene Zeiten, Offline v4,
  Abgleich v2, Leases v3; Queue-Löschung erst nach Archivnachweis (T-052). **Seit `3daa09b`
  (T-058, auf `main`):** Reiter je Rolle, Abgleich hinter dem Statuspunkt, Tap-Moment mit
  Serverentscheidung, Meine Zeiten als Monatskalender in Europe/Berlin, Tags, Manrope, Taptura.
  **Seit `b68e48b` (T-043):** „Tag zuordnen“ schreibt NDEF-URI `https://tb-infra.de/tag` plus
  App-Kennung auf den Tag (D-061); Android öffnet die App ohne Auswahldialog.
  **Seit `1d0a4e9` (T-060):** Eine Standortleitung ordnet Tags im eigenen Standort zu — die
  Grenze entscheidet die Datenbank (Migration 027), der Reiter „Tags" folgt der Sitzung.
  **Seit `91441c8` (T-059):** Reiter Mitarbeiter mit Kachel „x / y gerade aktiv", Liste
  Aktiv/Inaktiv, Kalender je Person und Einladen vom Handy (Migration 028, D-062). Bei
  Administrator und Standortleitung ersetzt er „Meine Zeiten" (D-058) — die eigenen Zeiten
  stehen dort unter der eigenen Person.
- Verwaltung: Beschäftigte mit Kontoeinladung (T-047), Standorte, Arbeitsziele, Tags, Korrektur,
  Prüfentscheidung, Pausen, CSV V3; eine Zeitzone Europe/Berlin (T-036); Anmeldefehler mit
  Ursache (T-040); strikte CSP; Deploy-Tor auf den Backend-Aussteller (T-039).
- Betrieb: T-035 in Produktion aktiv — physische Basissicherung, fortlaufendes externes WAL
  (`pg_receivewal` + Borg), versionierter Archivvertrag (Migration 023), Wiederherstellung am
  18.09. viermal aus dem externen Archiv bewiesen (zuletzt `base-…-20260918T084325Z`, 26
  Migrationen, RLS erzwungen). Rückweg auf ein Image vor 023 ist keiner mehr.
- Mail: Supabase → Brevo (D-057) mit DKIM/DMARC bei INWX; Zurücksetzungs-Mail zugestellt.
- **T-047 am 18.09. am Gerät abgenommen (D-044):** Einladung aus dem Admin-Web, Mail von
  „Taptura“, `/willkommen`, Passwort, App-Anmeldung, Mitgliedschaft ohne Code. Danach als
  Administrator getippt: Vorgang im Admin-Web sichtbar — Rundlauf durch den Archivvertrag.

## Die zwei Deploys am 18.09.

**Abends, 17:05 Uhr — `939b4ba` → `91441c8`: ein Anlauf, ohne Zwischenfall.** Migration 027
und 028 wurden erst in einem Wegwerf-Container aus der letzten Sicherung geprobt, dann
transaktional eingespielt; danach eine frische Basissicherung, extern verschlüsselt abgelegt
und wiederhergestellt. Die engere Vorprüfung (Sicherung am Zeitstempel der Einheit statt an der
Statusdatei) hat sich bewährt und gehört nach T-057 ins Skript.

**Morgens — fünf Anläufe für den ersten T-035-Deploy;** jeder Fehler ein Erstlauf-Fehler, jeder mit
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

- **APK VersionCode 7 am Gerät abgenommen (D-044):** alle acht Punkte bestanden — vier Reiter,
  Tags neu beschrieben, **App geschlossen plus Dranhalten öffnet ohne Auswahldialog** (T-043),
  Tap-Moment, Offline in Bernstein, Aktiv-Kachel, Einladen vom Handy, eigener Kalender.
  Befunde daraus: Systemleiste stört, Symbole zusammengesetzt, Ring soll stärker pulsieren
  (Variante B gewählt) — zusammen als **T-061** beauftragt.
- Tagesfreigabe und Pausenautomatik (T-048, T-050): während Pilotmonat 1 bauen, Freigabe zu
  Monat 2 zuschalten (D-063). T-055 Wiederaufnahme nach Restore.
- T-056 CI baut die Images; T-057 Deploy-Härtung; T-037; T-043/T-044; T-016; T-024.
- Firma, Recht, Store, Signierschlüssel; Supabase-Tarif; Aussperr-Test durch den PO.

## Bekannte Kleinigkeiten und offene Risiken

- **P1 T-063 (Befund 18.09.):** `archive_timeout` ist nicht gesetzt; PostgreSQL schließt eine
  WAL-Datei erst bei 16 MB. Deshalb meldet ntfy wiederholt „WAL-Archivierung steht" — formal
  zu Recht — und T-052 hält die Warteschlange des Handys weit länger als nötig. Behebung mit
  T-063 vor dem Pilot, im selben Deploy wie T-049 und T-061.

- **P2 T-059:** Mehrere gleichzeitige Standort-Grants sind im Handy-Vertrag (ein Standort)
  nicht darstellbar; dann bleibt der Reiter Mitarbeiter aus — es wird kein Standort geraten
  und keine Betriebsberechtigung angenommen. Eine Oberfläche dafür braucht eine
  Produktentscheidung.
- **P3 T-059:** Die Handy-Sitzung vergleicht den Verwaltungsumfang nicht mit, wenn sie prüft,
  ob es dieselbe Sitzung ist; eine laufende Abfrage kann nach einem Entzug noch zurückkommen.
  Der Server weist sie ab — die Autorität wird je Seite neu geprüft.

- **P2 Entwicklung (T-060):** Der Root-Build kann mit veralteten Workspace-Deklarationen
  scheitern; betroffene Abhängigkeiten vor ihren Verbrauchern bauen (Identity → Administration → API).
- **Bekannt (T-060):** Eine Standortleitung ohne Kunden im eigenen Standort sieht keinen Reiter
  „Tags", bis dort ein Arbeitsziel zugeordnet ist; Tags ganz ohne Zuordnung sieht nur der
  Administrator. Beides folgt aus der Standortgrenze und ist so gewollt.

- **P1 T-055:** Lease-Bindung und Reihenfolge über Installationen nach Restore (D-055).
- **Bekannt, nicht behebbar (T-043):** Android 17 zeigt für Tags mit Web-Adresse eine
  Mitteilung, die angetippt werden muss — ein Tap plus Bestätigung wie auf iOS (D-037). Ob der
  Android Application Record das umgeht, ist offen; wird am ersten Android-17-Gerät geprüft.
  Test-Tags müssen nach der nächsten APK einmal neu zugeordnet werden (alte Tags ohne NDEF
  zeigen weiter den Auswahldialog).
- **P2 App (18.09., aus T-058):** Meine Zeiten summiert nur den geladenen Abfragezeitraum;
  Schichten davor fehlen im Kalender (wird als „—“ gezeigt, nicht erfunden). „Zuletzt“ zeigt
  bei einem Abruffehler weiter „Laden“. „Abmelden“ liegt nur auf der Abgleich-Seite.
  Ein zweites Konto auf demselben Gerät ist per `bindOwner` dauerhaft gesperrt — gewollt.
  Erledigt mit `3daa09b`: Schutztext je Ursache; Schutzzustand beim Kontowechsel.
- **P2 Betrieb:** `[7/7] Archivvertrag ist aktiv`-Meldung erscheint auch, wenn nur der Cutover
  aktiv war; Health-Abfrage ohne Cache; alte Caddy-Assets; Monitoring-Test braucht GNU-Werkzeuge;
  Caddy-Negativprüfung: EXIT-Trap verliert `holder`, Validator-Cleanup kann ausfallen (T-063-Beleg).
- **P3 Betrieb:** `registered_chain_watermark` liest `offsite_wal_archive_watermarks`
  direkt ueber die Superuser-Verbindung statt ueber eine versionierte Lesefunktion mit
  enger Archivierer-Rolle; spaeter mit einer eigenen Migration schliessen (T-063-Befund).
- **P2 Sicherheit:** `*.supabase.co` in der CSP auf den Aussteller verengen; SECURITY-DEFINER-
  Pfade und Policy-Prädikate prüfen; Supabase-Anmeldung außerhalb eigener Ratenbegrenzung.
- **P2 Fachlich:** Geräteuhr bei manueller Erfassung, unbegrenzter vergessener Stopp, Offline-
  Pausenkonflikte ohne aktive Zeitreferenz.
- **P2/P3 Oberfläche und Pflege:** keine APK-Meldung, Prüfposten-Abweisung ohne Erklärung,
  ungeteiltes Web-Bündel, Fachdokumente in T-019, PostgreSQL-Suiten seriell.
