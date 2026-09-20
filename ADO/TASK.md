# Aktuelle Aufgabe

> **Stand 18.09.2026:** Produktion läuft auf `91441c8`. Auf `main` liegen zusätzlich T-061
> (`d5a58a6`) und T-049 (`adc7258`, Metro-Reparatur `dcdaebb`), CI grün. Offen: T-063, dann
> **ein** Deploy für alle drei, dann Web-Abnahme und neue APK.
> Reihenfolge: **T-063 → Deploy → Abnahme Web und Gerät → Pilot Monat 1.**

## T-063 · Ein Tap ist binnen Minuten extern gesichert, nicht binnen Tagen

**Für:** Development · **Risiko:** Produktionskonfiguration der Datenbank, Sicherungskette
**Zeitbox:** eine Sitzung. **Grundlage:** Befund vom 18.09. (ntfy-Alarm beim Product Owner),
D-051, T-035, T-052. Auftrag vom 18.09.2026.

### Befund (am Quelltext geprüft)

Der Product Owner bekommt wiederholt „WAL-Archivierung steht" von ntfy. Die Meldung ist formal
richtig und die Ursache ist eine fehlende Einstellung:

- Jeder Tap legt eine Archivanforderung an (`lifecycle_event_archive_requirements`,
  Migration 023). Erfüllt ist sie erst, wenn die WAL-Datei, die den Vorgang enthält, extern
  im Archiv liegt.
- PostgreSQL schließt eine WAL-Datei aber erst ab, wenn sie **voll** ist (16 MB), solange
  `archive_timeout` nicht gesetzt ist. **Es ist nirgends gesetzt** — die Datenbank läuft mit
  den Standardwerten (`infrastructure/docker-compose.server.yml`, Dienst `database`, kein
  `command`; kein `ALTER SYSTEM`, keine `postgresql.conf` im Repository).
- Der Wächter (`infrastructure/monitoring/taptime-immediate-monitor`,
  `wal_archive_is_current`) erwartet eine Erfüllung binnen
  `WAL_ARCHIVE_INTERVAL_SECONDS * WAL_ARCHIVE_MISSED_CYCLES` = 120 s. Im ruhigen Testbetrieb
  füllt sich die Datei nie, also meldet er — zu Recht — Stillstand.
- **Die wichtigere Folge:** T-052 löscht die Warteschlange des Handys erst nach Archivnachweis.
  Ohne `archive_timeout` liegt Evidenz tagelang auf dem Gerät statt Minuten. Beim Pilotkunden
  wäre das der eigentliche Schaden; der Alarm ist nur der Bote.

### Umsetzung

1. **`archive_timeout = 60s`** für die Produktionsdatenbank, gesetzt an genau einer Stelle und
   versioniert: `command` des Dienstes `database` in `infrastructure/docker-compose.server.yml`
   (`postgres -c archive_timeout=60s`), damit die Einstellung mit dem Deploy kommt und nicht
   von Hand am Server. Dieselbe Einstellung in `docker-compose.local.yml`, damit lokal dasselbe
   Verhalten herrscht. PostgreSQL wechselt die Datei nur, **wenn seit dem letzten Wechsel
   geschrieben wurde** — im Leerlauf entsteht keine Last.
2. **Prüfen, was der Wechsel für die Kette bedeutet**, und im Bericht beantworten: Wie oft
   entsteht im ungünstigsten Fall eine fast leere 16-MB-Datei, was kostet sie nach Borg-
   Komprimierung im Archiv, und reicht die Aufbewahrung (`WAL_KEEP_*` in
   `/etc/taptime-backup/config`) dafür weiter? Wenn eine Kennzahl dagegen spricht: stoppen und
   melden, statt die Zahl zu ändern.
3. **Test:** Die vorhandene Monitor-Suite (`infrastructure/monitoring/tests/taptime-monitor.test`)
   um einen Fall erweitern, der belegt: eine Anforderung, die jünger als das Fenster ist, löst
   keinen Alarm aus; eine ältere löst genau einen aus. Dazu ein Test, der die
   Compose-Einstellung festhält, damit sie nicht stillschweigend verschwindet.
4. **`infrastructure/MONITORING.md`** ergänzen: was „WAL-Archivierung steht" bedeutet, welche
   drei Ursachen es hat (Archivierer tot, Repository nicht erreichbar, Datei noch nicht
   abgeschlossen) und dass die dritte seit dieser Aufgabe nicht mehr durch Untätigkeit entsteht.
5. **Grenzen:** keine Änderung an Migration, Archivvertrag, Aufbewahrungswerten oder am
   Alarmfenster. Der Wächter bleibt streng — wir machen die Wirklichkeit ehrlich, nicht die
   Messlatte niedriger.

### Verifikation und Abschluss

Rotnachweis: Der neue Monitor-Test schlägt ohne die Compose-Einstellung fehl. Lokal mit
`docker-compose.local.yml` belegen: ein einzelner Schreibvorgang, danach innerhalb von zwei
Minuten eine abgeschlossene, extern archivierte WAL-Datei und `pending_count = 0` — mit
Protokoll im Bericht. Vorhandene Infrastruktur-Tests und die PITR-Suite bleiben grün.
Unabhängiges Review (Schwerpunkt: keine Absenkung der Sicherungsansprüche). Nicht vor
Technical-Lead-APPROVED committen. **Der Deploy trägt danach T-061, T-049 und T-063 gemeinsam.**

---

## Danach

## T-049 · Das Web, wie es gemeint ist — alle drei Rollen, eine Sprache

**Für:** Development · **Risiko:** Sitzungsvertrag des Webs, Rollenschale, Mandantengrenze
**Zeitbox:** fünf Sitzungen. **Grundlage:** D-060, D-059, D-062, D-031 (Farbrollen),
`ADO/01_Architecture/Web_Entwurf/` (README und 10 Bildschirme). Auftrag vom 18.09.2026.

### Befund (am Quelltext geprüft)

- **Ein Mitarbeiter kommt heute nicht ins Web.** `/v2/session` antwortet `401`, wenn die
  Verwaltungsautorität leer ist (`BackendHttpServer.ts:965`); der Coordinator wirft bei
  `availableSections.length === 0` eine Sackgasse (`AdminWebCoordinator.ts:1789`). Der
  Web-Sitzungstyp hat **kein Rollenfeld** (`AdminWebApiClient.ts:32`), und sein Parser weist
  zusätzliche Felder ab.
- Die T-059-Routen (`/v1/administration/managed-active-summary`,
  `/v1/administration/managed-person-time`) sind Verwaltungsrouten mit derselben Anmeldung wie
  alle Web-Aufrufe — **das Web kann sie unverändert rufen**; die Verträge liegen in
  `@taptime/administration-contract/managed-people`.
- „Meine Zeiten" und „Manuell" brauchen keine neue Route: `/v1/mobile/own-time/query`,
  `/v1/mobile/work-targets/query`, `/v1/lifecycle-events/manual` existieren, werden vom Web
  aber nie gerufen.
- Es gibt heute **keine Übersicht mit lebenden Zahlen** (nur „geladen"-Zähler), **keine
  Personenseite** und **keinen Kalender** im Web. `App.tsx` ist eine Datei mit 1.462 Zeilen;
  Navigation ist handgeschrieben (`navigation.ts`), Gestaltung sind CSS-Variablen in
  `styles.css` (D-031). Kein Router, kein `React.lazy`, ein einziges Bündel (bekannter P2).
- Prüfwerkzeug ist vorhanden: Vitest mit jsdom, Testing Library **und `axe-core`** — Rot-
  nachweise sind auf jeder Ebene verlangbar.

### Umsetzung, in dieser Reihenfolge

1. **Die Sitzung lernt die Rolle.** Migration 029 erweitert `read_administration_session_v2`
   additiv um `role` und um zwei Bereiche, die jede lebende Mitgliedschaft hat:
   `own_time` und `manual_capture`. `/v2/session` liefert sie; die Sackgasse entfällt, solange
   mindestens ein Bereich vorhanden ist. Ein Konto ganz ohne Mitgliedschaft bleibt abgewiesen.
   Nichts an bestehenden Bereichen ändert sich; `setup_available` und die Standortlogik aus
   027 bleiben, wie sie sind.
2. **Rollenschale und Leiste je Rolle** (`navigation.ts`, `App.tsx`): Mitarbeiter sieht
   *Meine Zeiten, Manuell*; Standortleitung *Übersicht, Beschäftigte, Meine Zeiten, Manuell*
   im eigenen Standort; Administrator zusätzlich *Prüfungen*, *Einrichtung* und *Lohnexport*.
   **Korrektur vom 18.09. (Befund Development):** Prüfen ist seit Migration 012
   (`has_current_time_review_administrator_v1`) administrator-only. D-059 sieht es für die
   Standortleitung vor, gebaut ist es nie worden — das ist **T-062**, nicht T-049. Die Leiste
   zeigt *Prüfungen* deshalb weiterhin genau dann, wenn die Sitzung den Bereich `review_items`
   nennt; wenn T-062 ihn öffnet, erscheint er von selbst. Jeder Bereich wird weiterhin bei jedem
   Befehl gegen die Sitzung geprüft, nicht nur beim Zeichnen.
3. **Übersicht (Entwurf 01/11)** mit Aktiv-Kachel aus `managed-active-summary`: „x / y gerade
   aktiv", Stand der **Serverzeit**, Umfang benannt (Betrieb oder Standort). Die Kachel „offene
   Prüfungen" erscheint nur, wenn die Sitzung `review_items` nennt — für eine Standortleitung
   heute also nicht. Keine Zahl ohne Herkunft; was der Server nicht liefert, wird weggelassen,
   und keine Kachel zeigt eine Zahl, die der Aufrufer nicht lesen darf.
4. **Beschäftigte und Person (02/03)**: Liste mit Aktiv/Inaktiv, Zeile mit Initialen, Name,
   „seit hh:mm · Ziel"; Person öffnet Monatskalender und Tagesliste aus
   `managed-person-time`. **Die Kalenderlogik wird geteilt, nicht kopiert:** die reinen Helfer
   aus `apps/mobile/src/screens/ownTimeCalendar.ts` (`businessDay`, `monthDays`, `weekStart`,
   `rangeSummary`, `recordsForDay`, `intervalMilliseconds`, `formatHours`, `formatDuration`)
   ziehen nach `packages/core` (Berlin-Zone liegt dort schon, D-056); Handy und Web importieren
   dieselbe Datei. Kein Verhaltenswechsel — die Mobile-Tests bleiben unverändert grün.
5. **Prüfungen, Einrichtung, Lohnexport (05/06/07)** im neuen Kleid, dabei die alten Befunde
   abräumen: **ein** CSV-Knopf statt zwei (`App.tsx:883` und `:962`), Filter wirken sofort statt
   erst nach „Anwenden", Rollenwechsel nicht als Auswahlfeld in jeder Zeile, Prüfentscheidung
   (Freigeben/Korrigieren/Ablehnen) **in der Zeile** statt im getrennten Formular darunter.
6. **Mitarbeiter im Web (21/22)**: *Meine Zeiten* mit denselben Kalenderbausteinen wie Punkt 4;
   *Manuell* mit Zielwahl, Pause und einer Haupttaste über die vorhandenen Routen. Kein NFC im
   Web. Ein Mitarbeiter sieht ausschließlich sich selbst — der Server entscheidet das, das Web
   filtert nichts.
7. **Ein Bündel je Bereich.** Weil die Schale ohnehin neu geschnitten wird: die Ansichten über
   `React.lazy` trennen und den bekannten P2 damit schließen. Nachweis: nach `vite build` liegen
   mehrere Bündel vor, und der erste Aufruf lädt nicht alle.

### Grenzen

Kein neues Datenmodell, keine Änderung an Evidenz, Scan oder Offline (D-052/D-055). Keine
Tagesfreigabe (T-048, D-063), keine Pausenautomatik (T-050), kein Soll-Modell (T-051). Die
Rolle der Eingeladenen bleibt, was die Route kennt. Farben und Radien bleiben die Tokens aus
D-031; der Web-Entwurf benutzt genau sie.

### Verifikation und Abschluss

Rotnachweise, jeder zuerst rot: (a) Mitarbeiter meldet sich am Web an und sieht *Meine Zeiten*
und *Manuell* — heute eine Sackgasse; (b) Mitarbeiter ruft eine Verwaltungsroute → abgewiesen,
und die Leiste zeigt sie nicht; (c) Standortleitung sieht in Übersicht, Beschäftigte und
Person nur den eigenen Standort, ein zweiter Betrieb gar nichts; (d) Aktiv-Kachel stimmt mit
den laufenden Buchungen überein und nennt die Serverzeit; (e) Personenkalender an Monats- und
Zeitumstellungsgrenzen (Europe/Berlin) — dieselben Helfer wie am Handy, belegt durch den
gemeinsamen Import; (f) die fünf alten Befunde aus Punkt 5 sind weg, je ein Test; (g)
`vite build` erzeugt getrennte Bündel. Dazu **axe ohne Verstöße** auf jedem neuen Bildschirm
und Tastaturbedienbarkeit der Zeilenentscheidung. Suiten: Admin-Web, B3, B4, C3C/C3E1/C3E2,
C2, Mobile (wegen des Umzugs der Kalenderhelfer); Typecheck; Migration ab 001 und auf
befülltem 028. Unabhängiges Review (Schwerpunkt: Rollenschale, Standortgrenze, keine Zahl ohne
Herkunft), maximal zwei Runden. Umsetzung nicht vor Technical-Lead-APPROVED committen. Deploy
danach gemeinsam mit der Abnahme des Product Owners im Web.
