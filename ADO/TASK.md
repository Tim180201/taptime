# Aktuelle Aufgabe

> **Stand 22.09.2026:** Produktion auf `d75fd56`. Auf `main` T-065, T-066 und T-070 (`5868a6e`,
> CI und Images grün, noch nicht ausgeliefert). PO-Entscheid: alles in **einen** Deploy.
> Reihenfolge: **T-069 → T-057 → T-068 → Deploy → APK → Geräteabnahme → Pilot Monat 1**.

## T-069 · Die Verwaltung beendet eine vergessene laufende Zeit

**Für:** Development · **Risiko:** Lebenszyklus, Offline-Abgleich, Rechte
**Zeitbox:** zwei Sitzungen; Reihenfolge Server → App → Web. Reicht die Zeit nicht, nach der App
stoppen und melden. **Grundlage:** D-069, D-071, D-073; bekannter P2 „unbegrenzter vergessener Stopp".

### Ziel

Ein Mitarbeiter vergisst den Stopp. Der Administrator öffnet die Person (Handy: Reiter
Mitarbeiter; Web: Personenkalender), tippt beim laufenden Eintrag **„Beenden"**, wählt die
Endzeit (Europe/Berlin) und schreibt einen Grund. Danach ist der Eintrag geschlossen, kann wie
jeder andere geändert werden (T-066), und der nächste Tap des Mitarbeiters startet korrekt neu.

### Regeln (D-073)

1. **Durch die Engine:** Die Aktion erzeugt ein WorkEvent der neuen Quelle `administration` im
   Namen des Mitarbeiters mit `occurred_at` = gewählte Endzeit. Die Engine entscheidet wie bei
   jedem Tap. Kein direktes UPDATE am Eintrag an der Engine vorbei. Ergebnis:
   `stopped_via='administration'` (neue Migration 031; 001–030 unverändert).
2. **Grenzen serverseitig:** nur Administrator (Standortleitung abgewiesen, kommt mit T-062);
   nur im eigenen Betrieb; nur ein Eintrag mit Status `started`, erwartete `row_version`
   (sonst `conflict`); Endzeit > Beginn, ≤ jetzt, ≤ Beginn + 24 h; Grund 1–500 Zeichen, Pflicht;
   idempotent über `commandId`; gleiche Personensperre wie Lebenszyklus und Nachtragen.
3. **Spät eintreffende Gerätetrigger:** Trifft nach der Aktion ein Gerätetrigger (online oder
   aus der Offline-Warteschlange, T-052) derselben Person ein, dessen `occurred_at` nach dem Beginn
   des beendeten Eintrags und **vor dem Zeitpunkt der Verwaltungsaktion** liegt, entsteht **kein**
   Eintrag, sondern ein Prüffall (bestehender Weg aus 015) mit verständlichem Grund
   („Zeit wurde von der Verwaltung beendet"). Trigger nach der Aktion laufen normal.
4. **Sichtbarkeit:** Details (T-066-Vertrag `time-details.v2`) zeigen „Beendet durch Verwaltung ·
   Zeitpunkt · Grund". Mitarbeiter sieht das in Meine Zeiten. Export v4: `changed` ist wahr.
   Alte App-Versionen erhalten unveränderte Antwortkörper.
5. **Audit:** jede Aktion mit Akteur, Zielperson, Eintrag, Endzeit, Grund.
6. **Offene Pause (D-076):** Läuft beim Beenden eine Pause, beendet dasselbe Verwaltungs-WorkEvent
   in der Engine **erst die Pause und dann die Zeit**, beide zur gewählten Endzeit, in einer
   Transaktion. Neue Engine-Regel nur für die Quelle `administration`; für Geräte-Trigger bleibt
   `work_trigger_during_break_rejected` unverändert.
7. **Untergrenze der Endzeit (D-076):** Endzeit > Beginn **und** ≥ letzter Pausengrenze des
   Eintrags (Ende der letzten geschlossenen Pause bzw. Beginn der offenen Pause). Sonst
   `end_before_break` mit verständlicher Meldung („Die Endzeit liegt vor einer erfassten Pause").
   Eine frühere Endzeit setzt der Administrator danach über die Korrektur (T-066).
8. **Kein Duplikatfenster (D-076):** Das 5-Sekunden-Duplikatfenster gilt nur für Gerätetrigger.
   Ein Verwaltungs-WorkEvent wird nie als `duplicate_scan_ignored` verworfen; Endzeit 1 s nach
   Beginn stoppt.
9. **Alte Clients (D-077):** Gespeichert wird `stopped_via='administration'`. Antworten ohne
   ausgehandelte neue Version (alte APKs) erhalten dafür `stoppedVia='manual'` — bytegleich im
   Format, nur der Wert ist ein bekannter. `time-details.v2` ist noch nirgends ausgeliefert und
   darf erweitert werden: dort stehen `stoppedVia='administration'` und die Marke „Beendet durch
   Verwaltung · Zeitpunkt · Grund". Keine neue Aushandlungsversion.
10. **Neuer Prüfgrund (D-077):** Überall, wo ein Client mit geschlossener Grundliste eine alte
    APK sein kann (Geräte-, Offline- und Abgleichsantworten), wird der Prüffall mit dem bestehenden,
    allgemeinsten Prüf-/Eskalationsgrund gemeldet. Den neuen Grund `administration_stopped` sehen
    nur Oberflächen, die mit dem Server gemeinsam ausgeliefert werden (Admin-Web), und neue Clients
    über `time-details.v2` bzw. eine bereits vorhandene ausgehandelte Version. Welcher bestehende
    Grund das ist, benennt der Bericht mit Fundstelle.
11. **Quittung erst nach externer Archivierung (D-078):** Der Verwaltungsstopp ist ein WorkEvent und
    fällt unter D-051. Nach dem lokalen COMMIT registriert der Server den Archivbedarf nach dem
    Muster von `record_lifecycle_event_archive_requirement_v1` (023) — neue, schmale Funktion in 031,
    gebunden an Befehlsquittung, WorkEvent und Zielperson, ausführbar nur für
    `taptime_time_review_writer`. Die Antwort heißt `committed` mit `requiredWalFile` und
    `offsiteArchived`. Die Oberfläche (App und Web) zeigt erst bei `offsiteArchived=true`
    „Gespeichert"; bis dahin „Wird gesichert …" und fragt mit derselben `commandId` bzw. über den
    bestehenden Lesezugang für Archivquittungen (023) nach, höchstens drei Minuten. Danach:
    „Noch nicht extern gesichert — bitte später prüfen"; eine Wiederholung mit derselben
    `commandId` ist idempotent und meldet den aktuellen Stand. Kein Wasserstandscheck ohne
    registrierten Bedarf.

### Oberfläche

- **App (Admin, Person):** beim laufenden Eintrag „Beenden" statt „Läuft noch — erst beenden,
  dann ändern"; Formular mit Datum/Uhrzeit (Standard: jetzt) und Grund; nur online; nach Erfolg
  Kalender neu laden. Für den Mitarbeiter selbst bleibt der Hinweis (er beendet per Tap).
- **Web (Admin, Personenkalender):** dasselbe.
- **Mitarbeiter-App:** Marke „Beendet durch Verwaltung" mit Grund.

### Tests (Rotnachweis zuerst)

Admin beendet → Eintrag geschlossen, WorkEvent vorhanden, nächster Tap startet neu; Standortleitung,
Mitarbeiter, fremder Betrieb, bereits gestoppt, falsche Version, Zukunft, vor Beginn, > 24 h,
ohne Grund → abgewiesen; gleichzeitiger Tap und Verwaltungsaktion → genau ein Stopp;
Offline-Trigger vor der Aktion → Prüffall, kein Eintrag; Offline-Trigger nach der Aktion → normal;
idempotente Wiederholung; alte Clients bytegleich; Export v4 `changed`; offene Pause → Pause und
Zeit geschlossen; Endzeit vor Pausenbeginn / vor Ende einer geschlossenen Pause → `end_before_break`;
Endzeit 1 s nach Beginn → Stopp; Gerätetrigger während Pause weiter abgewiesen, Gerätetrigger im
Duplikatfenster weiter ignoriert. App- und Web-Tests inkl. axe.

### Nicht Teil

Keine Änderung an Nachtragen/Kommentar außer der neuen Marke, keine Standortleitungsrechte, kein
Deploy. Passt eine Regel nicht zum Code (z. B. Engine kann keine Quelle ohne Gerät), **stoppen
und melden**, nicht umgehen.

### Bericht

`.t069-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review vor dem Bericht.
Kein Commit, kein Push.

---

## Danach (erst nach Abschluss von T-069): T-057 · Der Deploy wird robuster

**Für:** Development · **Risiko:** Deploy-Controller, Sicherungskette, Root-Zugänge
**Zeitbox:** eine Sitzung. **Grundlage:** PLAN T-057 (Befunde 1–4 vom 18.09.), Deploys 21./22.09., D-066, D-072.

### Befunde (zusätzlich zu PLAN T-057, Punkte 1–4)

5. **Sicherung mitten im Deploy:** Erster Anlauf `d75fd56` (21.09.) scheiterte bei `[1/7]` mit
   „No complete offsite WAL segment exists for the physical base": Die stündliche Sicherung legte
   nach der `[Archiv]`-Prüfung eine neue Basis an, die Probe nahm die neueste. Produktion blieb heil.
6. **Vorprüfung von Hand:** Vor jedem Deploy prüft der PO per SSH, ob eine Sicherung läuft
   (`InactiveEnterTimestamp`, nicht `ActiveEnterTimestamp` — Oneshot).
7. **Diagnose nur über die Hetzner-Konsole:** Der Deploy-Benutzer darf das Journal nicht lesen
   (richtig so, T-024: Schlüssel ohne Passphrase). Jede Diagnose kostet eine Konsolensitzung mit
   US-Tastatur.
8. **Spool-Besitzer:** `/var/lib/taptime-wal` gehört auf dem Host `dnsmasq:systemd-journal`
   (UID-Kollision mit dem Container, STATUS P2).

### Auftrag

1. **PLAN-Punkte 1–4** wie beschrieben (alte Statusdatei, Barriere beim Erstlauf, ehrliche
   `[7/7]`-Meldung, DEPLOY.md-Tippregeln und Terminal-Ablauf).
2. **Sicherungs-Timer während des Deploys anhalten:** Der Controller stoppt `taptime-backup.timer`
   zu Beginn und stellt ihn in **jedem** Ausgang wieder her (EXIT-Trap, auch bei Fehler und
   Abbruch; Test mit Signal). Läuft gerade eine Sicherung, wartet er begrenzt (Standard 20 min,
   sichtbare Fortschrittszeile je Minute) und bricht sonst **vor** jeder Änderung ab.
3. **Die Probe nimmt die eigene Basis:** Die Generalprobe `[1/7]` stellt genau die Basis wieder
   her, die `[2/7]` in diesem Lauf erzeugt hat (Name festhalten und übergeben), nicht „die neueste".
4. **Vorprüfung eingebaut:** Vor `[Vorbereitung]` eine Zeile je Befund: laufende Version, Ziel,
   Sicherung (Zustand, letztes Ende, Ergebnis), Archivierer/Empfänger aktiv, freier Platz.
   Bei rotem Befund Abbruch ohne Änderung.
5. **Lesender Diagnosebefehl für den Deploy-Benutzer:** `/usr/local/sbin/taptime-status`
   (root-eigen, ohne Argumente, nur lesen). Gibt aus: Versionen, Dienstzustände, letzte 30
   `WAL cycle`-Zeilen, letzte Sicherungen (Start/Ende/Ergebnis), Monitor-Zustand, freien Platz.
   **Keine Geheimnisse, keine Adressen:** Speicherbox-Adresse, Repository-Pfade und E-Mails werden
   maskiert; nur feste Filter, keine freien Journalabfragen. sudoers-Zeile genau für diesen Befehl
   ohne Argumente. Test: Ausgabe enthält nie `your-storagebox`, `ssh://`, `@`-Adressen oder
   Werte aus `/etc/taptime-backup/*`.
6. **Spool-Besitzer (untersuchen, dann entscheiden):** feste eigene UID/GID für den Spool, die
   zum schreibenden Container passt. Nur umsetzen, wenn es ohne Änderung an Compose-Semantik
   und Wiederherstellung geht; sonst Befund und Vorschlag im Bericht, nicht bauen.
7. **Root-Schritt einmal:** Controller-Update und die neue sudoers-Zeile brauchen die Konsole.
   DEPLOY.md bekommt dafür **einen** kurzen Block, der mit US-Belegung tippbar ist (keine `~`,
   möglichst wenige Sonderzeichen; Tippregeln daneben). T-068b erweitert den Controller später
   noch einmal; beide Änderungen werden in **einer** Konsolensitzung vor dem großen Deploy
   installiert.

### Tests

Signal-/Fehlertest: Timer danach wieder aktiv; laufende Sicherung → Warten, Zeitüberschreitung →
Abbruch vor Änderung; Probe nutzt die eigene Basis, auch wenn eine neuere existiert; alte
Statusdatei führt nicht mehr zu „ok"; Diagnosebefehl maskiert (Rotnachweis mit Beispielzeilen,
die Adressen enthalten); `shellcheck`; bestehende Deploy-, Backup- und Restore-Tests grün.

### Nicht Teil

Keine Änderung an Basissicherung, `borg check`, Aufbewahrung, Archivierer-Logik (T-070), Wächter.
Kein Zugriff auf Server oder Secrets. Kein Deploy.

### Bericht

`.t057-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit, kein Push.
