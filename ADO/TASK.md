# Aktuelle Aufgabe

> **Stand 22.10.2026:** T-133 fertig (`b29bbaa`). T-132 wartet auf die Messwerte des PO an der Konsole. Vorgezogen nach
> D-149: jetzt **T-134** (B15, Rechtstexte), danach **T-099a** (Pilotgröße messen). Sobald die Messwerte vorliegen, geht
> T-132 vor. Codex arbeitet an einer Aufgabe zur Zeit im Arbeitsbaum. Ohne Verbindung des TL zum Mac legt Codex den
> geprüften Stand nach PO-Freigabe als Zweig `review/<aufgabe>` ab (STATUS).

## T-134 · Rechtstexte an den Code angleichen (B15)

**Für:** Development (Sol, High) · **Risiko:** mittel. Kein Code, aber Aussagen gegenüber Kunde, Beschäftigten und
Anwalt; eine falsche Zusage wiegt schwerer als eine benannte Lücke · **Zeitbox:** eine Sitzung.

### Ziel

Die Rechtstexte beschreiben den gebauten Stand: Migration 062 und T-104c, also einschließlich dessen, was mit Deploy 8
ausgeliefert wird. Nicht den Stand von Migration 016 und keine Absichten. Was fehlt, steht als Lücke mit Aufgabe da. Das
Ergebnis ist die Vorlage für den Fachanwalt (D-116, PLAN Phase 2).

### Dateien

`ADO/06_Recht/Verzeichnis_Verarbeitungstaetigkeiten.md`, `ADO/06_Recht/AVV_Anlagen.md`,
`ADO/06_Recht/Beschaeftigten_Information_Art13.md`, `docs/store/privacy.md`. Stehen dieselben Aussagen dort, auch
`infrastructure/MONITORING.md` (Inhalt der Betriebsprotokolle). `Rechtsform_Vorschlag.md` bleibt unverändert.

### Umfang

1. **Befunde zuerst am heutigen Code prüfen:** F-025, F-026, F-050, F-082, F-083, F-102 und F-163 aus
   `.audit-2026-09/report.md`. Der Ordner bleibt lokal und wird nie committet; in ADO neutral formulieren (D-103).
2. **Mindestens neu oder richtig:**
   - **Parteien:** Einzelunternehmen des PO (D-116), keine UG. Platzhalter für Anschrift und Kontakt bleiben.
   - **Betroffene:** neben den Beschäftigten auch die Kunden des Verantwortlichen. Bei frogs sind das Schüler, oft
     minderjährig. Dazu gehören Name oder Bezeichnung, Kontingent, Zuordnung zu Beschäftigten und Zeiten je Kunde.
     Besondere Kategorien sind nicht vorgesehen; Freitext kann trotzdem alles enthalten.
   - **Rollen:** Administrator, Standortleitung, Mitarbeiter; dazu der Plattformbetreiber mit Zweck und Umfang. Belegen,
     was der Betreiber-Bereich zeigt und was nicht, sowie Paket und Betreiber-Protokoll.
   - **Datenarten seit Migration 016:**
     - Standorte und Standortzuordnung, Karten, Projekte;
     - Kommentare und Gründe (D-134); eigene Zeiten ohne Grund (D-131);
     - Namensänderung mit altem und neuem Namen (D-142);
     - Anmeldestand je Zugang (Migration 059);
     - Zuordnungen (D-135);
     - Archiv mit ehemaligen Beschäftigten sowie gelöschten Kunden und Projekten (D-143);
     - Prüffälle und Plausibilität (D-122);
     - Offline-Belege: Installation, Sequenz, Uhr;
     - Sperrbildschirm-Schlüssel: nur als Hash gespeichert, höchstens 24 h gültig (D-146).
   - **Anzeige außerhalb der App (D-147):** Name des Ziels und Dauer stehen auf dem gesperrten Bildschirm. Unter
     Android ist die Meldung öffentlich sichtbar, am iPhone ist es die Live-Aktivität. Lokal gespeichert wird dafür im
     Keystore bzw. Schlüsselbund. Das gehört ins Verzeichnis, in die TOM als bewusste Abwägung des Verantwortlichen
     (keine Lücke) und in die Art.-13-Vorlage: Wer das Handy sieht, sieht den Namen.
   - **Betriebsprotokolle (F-025):** die tatsächlichen Felder nennen, auch die Kennungen auf dem Einladungsweg, mit
     ihrem Zweck. „Technisch erzwungen, vier Felder“ nur schreiben, wenn es so stimmt.
   - **Löschung (F-026):** den Ist-Stand ehrlich beschreiben. Heute gibt es keine Löschklassen und keinen Löschweg
     (T-016, D-018), und Einladungen sind nicht löschbar. Fristen als Ziel nach T-016 kennzeichnen, nicht als Bestand.
   - **Sicherungen (F-050, F-083):** die tatsächliche Aufbewahrung aus Skripten und `RESTORE.md`: Prune-Regel, manuelle
     Schnappschüsse, Alt-Archive. Dazu, wo die Passphrase liegt (Server, root, 0600; Kopie beim PO) und wovor sie
     schützt. Eine Höchstdauer für manuelle Schnappschüsse entscheidet der PO. Den Vorschlag „höchstens sechs Monate,
     Löschung durch den PO“ im Bericht vorlegen, nicht als gelebte Praxis schreiben.
   - **Container (F-082):** je Dienst angeben, was wirklich gilt (`docker-compose.server.yml`).
   - **Unterauftragsverarbeiter (F-102):**
     - Supabase: EU-Region, US-Mutter; die offene Frage aus D-006 bleibt offen und steht auch so da.
     - Brevo über Supabase (D-057).
     - Hetzner: Server und Storage Box.
     - ntfy.sh und healthchecks.io.
     - GitHub und GHCR: ohne Endnutzerdaten.
     - Keine Aussage „keine Drittlandübermittlung“, solange D-006 offen ist.
   - **Zahlen durch Regeln ersetzen (F-163):** statt „30 von 30 Tabellen“, „26 Tests“ oder „11 Prüfungen“ die geprüfte
     Regel nennen, etwa „jede Anwendungstabelle mit RLS `ENABLE` und `FORCE`“, und den Test benennen, der sie
     dauerhaft prüft (T-119).
   - **Bekannte Lücken:**
     - Erledigte streichen, jede am Code geprüft: CSP seit T-119, Recovery-Schema, Policies.
     - Offene ergänzen: T-016; T-132, solange offen; T-055; Schutz vor geleakten Passwörtern erst mit Pro (D-130);
       Container-Härtung, wo sie fehlt.
   - **Art.-13-Vorlage:**
     - wer was sieht: Standortleitung, Administrator; der Betreiber nur, was der Code ihm zeigt;
     - die letzte Anmeldung;
     - der Sperrbildschirm;
     - der Ort der Daten korrekt;
     - Löschung ehrlich.
   - **Store-Datenschutzangaben:** dieselben Fakten und die Anzeige auf dem Sperrbildschirm. Store-Kategorien nur mit
     Quelle.
3. **Belege:** Jede geänderte Aussage bekommt im Bericht einen Codebeleg (Datei mit Zeile, Migration oder Funktion). In
   den Rechtstexten selbst stehen keine Zeilennummern. Kopfzeile je Datei: „Stand 22.10.2026 · Systemstand: Migration
   062, bis T-104c“. Der Hinweis „Entwurf des Technical Lead, keine Rechtsberatung“ bleibt.
4. **Fakten, die nur der PO kennt,** als `[PO bestätigt: …]` markieren und im Bericht als Frage aufführen:
   - Standort von Server und Storage Box (Hetzner);
   - Region des Supabase-Projekts;
   - Stand der AVV mit Hetzner, Supabase und Brevo.

### Grenzen

Nur die genannten Dateien. Kein Code, keine Migration, kein Server-Zugriff, keine Geheimnisse. Supabase, Hetzner und
Brevo nicht selbst nachsehen, sondern den PO fragen. Kein Inhalt aus `.audit-2026-09/` wörtlich in ADO. Bericht in
`.t134-review/report.md`: Belegtabelle Aussage · alt · neu · Beleg, offene PO-Fragen, Vorschläge für PO-Entscheidungen.
Kein Commit vor `APPROVED`.

---

## Danach: T-099a · Pilotgröße messen (T-099, D-149)

**Für:** Development (Astra, High) · **Risiko:** für die Produktion niedrig (nur lokal, synthetische Daten, kein
Produktcode). Für den Pilot wäre es hoch, es nicht zu wissen · **Zeitbox:** eine bis zwei Sitzungen.

### Ziel

Mit Zahlen statt Vermutung belegen, ob App-Wege, Verwaltung, Betreiber-Bereich und Lohnexport bei frogs-Größe halten.
Nur messen; jede Behebung kommt als T-099b nach dem Bericht.

### Datenbild

Synthetisch, mit erkennbar künstlichen Namen:

- Ein Betrieb mit 5 Standorten: 1 Administrator, 5 Standortleitungen, 194 Mitarbeiter. Dazu 10 Ehemalige sowie 20
  gelöschte Kunden und Projekte.
- 500 Kunden mit Kontingent, je Mitarbeiter 3 bis 15 zugeordnet. Außerdem 500 Karten und 10 Projekte.
- Drei abgeschlossene Monate und der laufende Monat.
- **Profil „Erwartet“:** je Mitarbeiter 3 Tage je Woche, 4 Einheiten am Tag, mit Pausen.
- **Profil „Spitze“:** 5 Tage je Woche, 6 Einheiten am Tag, mit Pausen.
- In beiden Profilen ein kleiner Anteil an Nachträgen, Korrekturen mit Grund, Prüffällen und Offline-Erfassungen,
  dazu laufende Zeiten am Messzeitpunkt.
- Im Bericht die Zeilenzahl je Monat und Profil nennen.

### Weg

- **Datenbank:** lokal mit der vorhandenen PostgreSQL-Testinstanz und frisch migriertem Schema bis 062.
  - Fachdaten entstehen über die echten Schreibwege (SQL-Funktionen und Coordinators wie in der App), ohne direkte
    INSERTs in Fachtabellen.
  - Stammdaten dürfen über die vorhandenen Fixture-Helfer entstehen.
  - Fester Startwert, damit der Lauf wiederholbar ist.
- **Server:** jeden Lesepfad von App, Verwaltung und Betreiber-Bereich über die HTTP-Schicht je 20-mal messen.
  - Immer mit der Produktionskonfiguration: Pools, Zeitgrenzen und Antwortgrenzen aus `runtime.ts` und
    `BackendHttpServer.ts`, keine Testwerte.
  - Erfassen: p50, p95, Antwortgröße und Fehler (`export_limit_exceeded`, Antwortgrenze, Zeitüberschreitung).
  - Administrator und Standortleitung getrennt messen.
  - Die lokalen Befunde F-018 (Antwortgrenze) und F-043 (Pool-Zeitgrenze beim Export) dabei ausdrücklich prüfen.
- **Lohnexport:** ein ganzer Monat je Profil, in jeder Fassung, die die Verwaltung anbietet. Messen: Zeilen, Bytes,
  Dauer. Vergleichen mit dem festen Abbruch über 10.000 Zeilen (`TIME_ENTRY_EXPORT_MAXIMUM_ROWS`, auch in den
  Export-Migrationen) und dem internen Budget von 8 s im `TimeEntryExportCoordinator`.
- **Schreibspitze:**
  - 200 Starts innerhalb von 10 Minuten;
  - ein Offline-Abgleich von 20 Geräten gleichzeitig;
  - Fehler und Sperrwartezeiten zählen.
- **Web:** die größten gemessenen Antworten über den vorhandenen Fixture-Weg der Browser-Prüfstrecke rendern.
  - Seiten: Übersicht, Mitarbeiter mit Zeiten und Zugängen, Kunden, Zeiten prüfen, Lohnexport, Archiv, Einrichtung,
    Betreiber-Bereich.
  - Messen: Zeit bis zur fertigen Seite und Zahl der Anfragen je Seite.
- **Datenbankgröße:** nach jedem Profil `pg_database_size` sowie die größten Tabellen und Indizes messen und daraus ein
  Jahr hochrechnen. Diese Zahl braucht T-132.
- **Abfragepläne:** die fünf langsamsten Abfragen mit `EXPLAIN (ANALYZE, BUFFERS)`.

### Richtwerte des TL

- Lesepfade: p95 unter 300 ms.
- Monatsübersicht und Personenzeiten: unter 1 s.
- Seiten: höchstens 14 KiB (D-138).
- Lohnexport: unter 8 s und unter der Zeilengrenze.
- Schreibspitze: keine Fehler.

Ein Richtwert ist kein Test. Ein überschrittener Wert wird als Befund mit P1, P2 oder P3 und der Ursache gemeldet, nicht
repariert.

### Ergebnis

- **Werkzeug im Repository**, zum Beispiel unter `tests/pilot-size/`: Generator und Messung.
  - Läuft nur mit eigener Umgebungsvariable und nicht in der CI.
  - Nur synthetische Daten.
  - Es bleibt für T-099b und spätere Ausweitungen.
- **Bericht** in `.t099a-review/report.md`:
  - Datenbild mit Zeilenzahlen;
  - Tabelle Weg · Rolle · Profil · p50 · p95 · Größe · Richtwert · Befund;
  - Ergebnisse von Lohnexport, Schreibspitze und Web;
  - Datenbankgröße mit Hochrechnung auf ein Jahr;
  - Befundliste mit Vorschlag für T-099b;
  - Angaben zum Rechner (Mac-Modell, PostgreSQL-Version), weil die Zahlen lokal sind.

### Grenzen

Kein Produktcode, keine Migration, keine Änderung an bestehenden Tests. Kein Zugriff auf Produktion oder Supabase,
keine echten Namen. Nichts installieren (AGENTS §3): Fehlt ein Werkzeug, wird es gemeldet. Die vorhandene Prüfstrecke
bleibt grün. Kein Commit vor `APPROVED`.

---

## Danach: T-132 · Sicherung und Wiederherstellungsprobe brauchen mehr Platz (Befund 17.10.)

Der Brief folgt nach den Messwerten des PO an der Konsole (`df -h /run /`, `free -m`, Datenbankgröße) und seiner
Entscheidung über die Lösung (u. a. größerer Server). B12 kommt mit dazu (D-149). Siehe STATUS und PLAN.
