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
idempotente Wiederholung; alte Clients bytegleich; Export v4 `changed`. App- und Web-Tests inkl. axe.

### Nicht Teil

Keine Änderung an Nachtragen/Kommentar außer der neuen Marke, keine Standortleitungsrechte, kein
Deploy. Passt eine Regel nicht zum Code (z. B. Engine kann keine Quelle ohne Gerät), **stoppen
und melden**, nicht umgehen.

### Bericht

`.t069-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review vor dem Bericht.
Kein Commit, kein Push.
