# Aktuelle Aufgabe

> **Stand 06.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-102, T-075, T-106 bis T-108 und die
> App-Link-Fingerabdrücke (Migrationen 043–050). T-110 geht noch in den dritten Deploy. T-098b Teil 2 bleibt geparkt
> (T-098c nach dem Deploy). Befunde: `.audit-ux-2026-10/selbsterklaerend.md` (SE-003 bis SE-005), nur lokal (D-103).

## T-110 · Selbsterklärend II: Führung, Zeiten prüfen, Monatswähler (D-128)

**Für:** Development · **Risiko:** mittel (neue Vertragsvariante, Migration 051) · **Zeitbox:** eine bis zwei
Sitzungen. Verwaltung, App (Mitarbeiterliste), Verwaltungs-Server, Schema.

### Auftrag

1. **Nächster Schritt in der Übersicht (SE-003):** Die Web-Übersicht des Administrators zeigt genau eine nächste
   fehlende Voraussetzung, nur aus bereits geladenen Daten (keine neue Serverlesung), in dieser Reihenfolge:
   1. Standorte angelegt, aber nicht eingeschaltet: „Ordnen Sie Mitarbeiter und Kunden ihren Standorten zu und schalten
      Sie die Standorte ein.“ (ohne Standorte entfällt der Schritt)
   2. Standortleitung ohne verwalteten Standort: „Weisen Sie den Standortleitungen ihren Bereich zu.“
   3. keine Kunden und keine Projekte: „Legen Sie Kunden an.“
   4. keine Karte: „Richten Sie in der App Karten ein.“
   5. keine weiteren Mitarbeiter: „Laden Sie Mitarbeiter ein.“
   6. keine beendete Arbeitszeit im geladenen Zeitraum: „Erfassen Sie die erste Arbeitszeit.“

   Jeweils mit einem Knopf zur passenden Stelle; die Karte ersetzt „Ihr Betrieb ist bereit“. Solange ein benötigter
   Bereich lädt oder fehlt, keine Karte; ist alles erfüllt, verschwindet sie. Kein gespeichertes Objekt, keine Häkchen.
2. **Rolle geändert (SE-004):** Nach dem Wechsel zur Standortleitung: „Rolle geändert. Weisen Sie jetzt die Standorte
   zu, die diese Person verwalten darf.“ mit direktem Weg dorthin. Wo Änderungen sofort gelten: „Änderungen werden
   sofort gespeichert.“ Sonst nichts an der Zugangsverwaltung (T-105).
3. **Zeiten prüfen mit Zusammenhang (SE-005):** Vor der Entscheidung sieht die Leitung die Zeiten dieser Person an
   diesem Tag und das auslösende Ereignis. Ein blockierender Vorgänger heißt „Eine frühere Erfassung muss zuerst geprüft
   werden.“ und ist verlinkt, wenn er in der geladenen Liste eindeutig ist. Knöpfe: „Fehlende Arbeitszeit ergänzen“,
   „Vorhandene Arbeitszeit ändern“, „Ohne Zeitänderung schließen“; zweiter Schritt „Änderung prüfen“ → „Änderung
   bestätigen“ bzw. „Abschluss bestätigen“. Gründe als verständlicher Satz, technische Angaben unter „Details“.
   Dieselben drei Wirkungen wie heute, keine automatische Entscheidung.
4. **Monatswähler in der Mitarbeiterliste (D-128):** App und Web wie bei der Kundenliste: laufender Monat und 23
   Vormonate. Neue Vertragsvariante v5 mit `fromInclusive`/`toExclusive` eines vollen Monats in deutscher Ortszeit wie
   bei den Kundenstunden, eigene strenge Anfrageprüfung; v1 bis v4 antworten unverändert. Neue SQL-Funktion
   `read_managed_active_summary_v4` per Migration 051 mit ausgeschriebenem Körper. Stunden nach D-105, ein Eintrag zählt
   in seinem Beginnmonat wie 036/047. Der Monat gehört ins Cursor-Präfix; ein Cursor eines anderen Monats ergibt
   `invalid_request`, ein Monatswechsel beginnt ohne Cursor. Vorhandene Filter bleiben und gelten zusammen mit dem
   Monat; die Spalte nennt den Monat („Oktober 2026“).
5. **SQL-Ersatzname (D-125):** In `read_customer_hours_v1` wird „Beschäftigter“ zu „Mitarbeiter“, neuer Körper in 051.

### Tests

Je Punkt rot vor der Änderung. Übersicht: jeder Schritt einzeln, Ladezustand ohne Karte, Karte verschwindet,
Standortleitung sieht sie nicht. Zeiten prüfen: Tageszeiten sichtbar, Vorgänger mit und ohne Link, alle drei Wirkungen
unverändert. Monatswähler: v5 mit Monat, v1–v4 unverändert, falscher Zeitraum, Cursor eines anderen Monats,
Standortleitung nur ihr Standort, Eintrag über Mitternacht am Monatsende, Monat ohne Zeiten; die Personenansicht per
Direktlink findet die Person weiterhin (T-108). Volle Suiten einschließlich aller Suiten, die Migrationen nachspielen,
T062-Probe, Drift-Probe, Typechecks, Layoutprüfung 360/390 dp und 1440 px.

### Nicht Teil

Begriffe und Muster (T-108), F1, T-099, T-105, T-109.

### Bericht

`.t110-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2.
Kein Commit vor `APPROVED`.
