# Aktuelle Aufgabe

> **Stand 28.09.2026:** Produktion auf `e13916b` (Migrationen bis 034). Auf `main` zusätzlich T-080 (App), T-086/T-087
> (`2602ab7`, Migration 035). Reihenfolge (PO 28.09., D-097, D-098): **T-084** → T-085 → T-088 → ein Deploy, ein
> App-Build → T-024 → Pilot Monat 1. Frühere Briefs stehen in der Git-Historie.

## T-084 · Reiter „Kunden“ mit geleisteten Stunden (D-097)

**Für:** Development · **Risiko:** Mandanten- und Standortgrenze beim Lesen fremder Zeiten; eine zweite Summenformel
neben Kalender und Export (D-095) · **Zeitbox:** eine Sitzung. Eine Migration `036` (nur Leser, keine Daten),
Backend-Route, `apps/admin-web`, `apps/mobile`, deren Tests. Kein Kontingent (T-085), kein Löschen (T-088).

### Was der Nutzer sieht

Neuer Reiter **„Kunden“** in App und Web für jede Rolle (App: nicht in der Offline-Hülle). Oben der Monat: laufender
Monat vorgewählt, Pfeile vor/zurück und eine Auswahl der letzten 24 Monate, keine zukünftigen. Darunter die Liste der
Kunden mit der Monatssumme in Stunden; antippen öffnet den Kunden:

- **Administrator:** alle Kunden des Betriebs; im Kunden die Summe und je Person die Summe (Name, Stunden).
- **Standortleitung:** die Kunden, deren Standortbindung auf einen ihrer verwalteten Standorte zeigt; im Kunden alle
  dort geleisteten Stunden je Person, auch von Personen anderer Standorte (D-097).
- **Mitarbeiter:** bei eingeschalteten Standorten die Kunden seines Heimatstandorts, sonst alle aktiven Kunden; nur
  die eigenen Stunden, je Tag aufgelistet; ohne Stunden steht „0 h“.

Aktive Kunden immer; ein inaktiver Kunde erscheint nur, wenn im gewählten Monat Stunden bei ihm stehen (markiert
„inaktiv“). Laufende Einträge zählen bis zur Antwortzeit mit und sind als „läuft“ markiert. Leerer Zustand und Fehler
mit verständlichem Text (Art aus T-079).

### Auftrag

**A. Ein Leser in SQL (036).** Eine SECURITY-DEFINER-Funktion nach dem Muster von 034 (`read_time_record_calendar_v1`):
Eingabe Monatsbeginn und -ende (Europe/Berlin, Obergrenze `maximum_calendar_month_range()` aus 025), Ausgabe je
Kunde und Person die Arbeitssekunden nach genau der Kalenderformel (D-095: floor der Spanne minus Summe floor je
zugeschnittener Pause, mindestens null; ein Eintrag zählt in dem Monat, in dem er beginnt; eine Antwortzeit aus
`transaction_timestamp()`). Keine zweite Formel: Die Sekundenberechnung aus 034 in eine gemeinsame interne Funktion
ziehen oder aus ihr lesen, so dass Kalender, Export und Kunden-Summe nachweislich gleich rechnen. Die Grenze (wer
welche Kunden und wessen Stunden sieht) entscheidet die Funktion aus der Sitzung (Organisation, Mitgliedschaft,
Rolle, `locations_enabled`, Verwaltungszuweisungen, Heimatstandort), nie ein Parameter des Clients. Mitarbeiter
bekommen fremde Stunden unter keinen Umständen, auch nicht als Summe. Maßgeblich ist die Kundenbindung des Eintrags
(`target_type = 'customer'`), Projekte und allgemeine Arbeit gehören nicht in den Reiter.

**B. Route.** Eine lesende Route für alle angemeldeten Rollen, mit Schutzklasse in `BACKEND_HTTP_ROUTES` (T-053),
Antwortvertrag mit Versionskennung wie bei den bisherigen Lesern. Die Personenaufschlüsselung liefert der Server
nur Administrator und Standortleitung.

**C. App.** Reiter „Kunden“ in `navigation/presentation.ts` für alle Rollen; Liste, Monatsauswahl, Kundenansicht wie
oben; Zahlen im Stundenformat der Kalenderansicht.

**D. Web.** Eintrag „Kunden“ in der Navigation (`navigation.ts`) für alle Rollen, die das Web nutzen; dieselbe Liste
und Kundenansicht; schmale und breite Ansicht wie die übrigen Seiten (Layout-Tests mit 360/390/1440).

### Tests

Mit PostgreSQL, Rot vor Grün für die Grenzen: (1) Administrator sieht alle Kunden und Personen; (2) Standortleitung A
sieht Kunden von A mit Stunden einer Person aus Standort B, sieht keinen Kunden von B; (3) Mitarbeiter sieht Kunden
seines Heimatstandorts mit nur eigenen Stunden, „0“ ohne Einträge, keine Personenaufschlüsselung, fremde Stunden
auch nicht über manipulierte Eingaben; (4) Standorte aus: Mitarbeiter sieht alle aktiven Kunden, Standortleitung
keinen Umfang wie bisher (020); (5) Betrieb X sieht nichts aus Betrieb Y; (6) Summe gleich Kalender und Export für
dieselben Einträge, mit Pausen, laufendem Eintrag und dem Rundungsbeispiel aus D-095; (7) Monatsgrenze: Beginn
31.10.2026 23:30 Berlin zählt im Oktober; Umstellung auf Winterzeit 25.10.2026 und Sommerzeit 28.03.2027; (8) inaktiver
Kunde nur mit Stunden im Monat. App und Web: Monatsauswahl, Kundenansicht je Rolle, leerer Zustand, Fehler.
**Lokal alle Suiten, die Migrationen anwenden oder nachspielen** (u. a. `backend-schema`, `backend-time-review`/DA3
mit der T-062-Migrationsprobe, `backend-time-export`, `backend-api`), dazu App und Web, Typechecks inklusive Tests.
Die T-062-Probe darf 036 nur als neue Funktion sehen; ändert 036 eine geschützte Definition, ist das ein Befund.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse, kein App-Build. Kein Kontingent, keine Meldung, kein Löschen,
keine Änderung an Kalender- oder Exportausgabe (nur die gemeinsame Rechnung darf in eine interne Funktion wandern,
mit Nachweis gleicher Ergebnisse).

### Bericht

`.t084-review/` (report.md, tracked.diff, untracked.txt), Screenshots Web 360/390/1440 und App je Rolle. Unabhängiges
Review mit Blick auf „wer sieht wessen Stunden“ und „eine Formel“. Kein Commit vor `APPROVED`.
