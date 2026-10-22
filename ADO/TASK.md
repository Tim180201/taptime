# Aktuelle Aufgabe

> **Stand 22.10.2026:** T-132 fertig (`81f55b7`). Jetzt **T-099a** (D-149). Parallel bereitet der PO Deploy 8 vor; der
> Deploy läuft aus seinem Terminal und berührt den Arbeitsbaum nicht. Ohne Verbindung des TL zum Mac legt Codex den
> geprüften Stand nach PO-Freigabe als Zweig `review/<aufgabe>` ab (STATUS).

## T-099a · Pilotgröße messen (T-099, D-149)

**Für:** Development (Astra, High) · **Risiko:** für die Produktion niedrig (nur lokal, synthetische Daten, kein
Produktcode); für den Pilot hoch, es nicht zu wissen · **Zeitbox:** eine bis zwei Sitzungen.

**Ziel:** Mit Zahlen belegen, ob App-Wege, Verwaltung, Betreiber-Bereich und Lohnexport bei frogs-Größe halten. Nur
messen; jede Behebung kommt als T-099b nach dem Bericht.

### Datenbild (synthetisch, erkennbar künstliche Namen)

- Ein Betrieb, 5 Standorte: 1 Administrator, 5 Standortleitungen, 194 Mitarbeiter; dazu 10 Ehemalige und 20 gelöschte
  Kunden und Projekte.
- 500 Kunden mit Kontingent, je Mitarbeiter 3 bis 15 zugeordnet; 500 Karten, 10 Projekte.
- Drei abgeschlossene Monate und der laufende Monat.
- Profil „Erwartet“: je Mitarbeiter 3 Tage je Woche, 4 Einheiten am Tag, mit Pausen. Profil „Spitze“: 5 Tage, 6
  Einheiten, mit Pausen. In beiden ein kleiner Anteil Nachträge, Korrekturen mit Grund, Prüffälle und
  Offline-Erfassungen, dazu laufende Zeiten am Messzeitpunkt. Zeilenzahl je Monat und Profil im Bericht.

### Weg

- **Datenbank:** vorhandene lokale PostgreSQL-Testinstanz, frisch migriert bis 062. Fachdaten über die echten
  Schreibwege (SQL-Funktionen und Coordinators wie in der App), keine direkten INSERTs in Fachtabellen; Stammdaten
  dürfen über vorhandene Fixture-Helfer entstehen. Fester Startwert, damit der Lauf wiederholbar ist.
- **Server:** jeden Lesepfad von App, Verwaltung und Betreiber-Bereich über die HTTP-Schicht je 20-mal messen, mit der
  Produktionskonfiguration (Pools, Zeit- und Antwortgrenzen aus `runtime.ts` und `BackendHttpServer.ts`). p50, p95,
  Antwortgröße, Fehler; Administrator und Standortleitung getrennt. Die lokalen Befunde F-018 (Antwortgrenze) und
  F-043 (Pool-Zeitgrenze beim Export) ausdrücklich prüfen.
- **Lohnexport:** ganzer Monat je Profil in jeder Fassung, die die Verwaltung anbietet: Zeilen, Bytes, Dauer gegen den
  festen Abbruch über 10.000 Zeilen (`TIME_ENTRY_EXPORT_MAXIMUM_ROWS`) und das Budget von 8 s im Coordinator.
- **Schreibspitze:** 200 Starts in 10 Minuten und ein Offline-Abgleich von 20 Geräten gleichzeitig; Fehler und
  Sperrwartezeiten zählen.
- **Web:** die größten gemessenen Antworten über den Fixture-Weg der Browser-Prüfstrecke rendern (Übersicht,
  Mitarbeiter mit Zeiten und Zugängen, Kunden, Zeiten prüfen, Lohnexport, Archiv, Einrichtung, Betreiber-Bereich): Zeit
  bis zur fertigen Seite, Zahl der Anfragen je Seite.
- **Datenbankgröße** nach jedem Profil (`pg_database_size`, größte Tabellen und Indizes) und Hochrechnung auf ein
  Jahr, als Eingang für den Platzbedarf der Sicherung (D-150). Die fünf langsamsten Abfragen mit
  `EXPLAIN (ANALYZE, BUFFERS)`.

**Richtwerte (TL):** Lesepfade p95 unter 300 ms; Monatsübersicht und Personenzeiten unter 1 s; Seiten höchstens 14 KiB
(D-138); Lohnexport unter 8 s und unter der Zeilengrenze; keine Fehler unter der Schreibspitze. Ein Richtwert ist kein
Test: Überschreitungen sind Befunde mit P1/P2/P3 und Ursache, keine Reparatur.

### Ergebnis

- Generator und Messung als Werkzeug im Repository (etwa `tests/pilot-size/`): nur mit eigener Umgebungsvariable, nicht
  in der CI, nur synthetische Daten. Es bleibt für T-099b und spätere Ausweitungen.
- Bericht in `.t099a-review/report.md`: Datenbild mit Zeilenzahlen; Tabelle Weg · Rolle · Profil · p50 · p95 · Größe ·
  Richtwert · Befund; Lohnexport, Schreibspitze, Web; Datenbankgröße mit Jahreshochrechnung; Befundliste mit Vorschlag
  für T-099b; Rechnerangaben (Mac-Modell, PostgreSQL-Version).

### Grenzen

Kein Produktcode, keine Migration, keine Änderung an bestehenden Tests, kein Zugriff auf Produktion oder Supabase, keine
echten Namen, nichts installieren (AGENTS 3), kein Docker-Socket in Containern. Die vorhandene Prüfstrecke bleibt grün;
Tests, die vom Werkzeug berührte Dateien lesen, laufen mit (AGENTS 4). Kein Commit vor `APPROVED`.
