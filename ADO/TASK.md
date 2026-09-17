# Aktuelle Aufgabe

## T-036 · Zeitrichtigkeit — abgeschlossen

**Für:** Development · **Risiko:** Lohnabrechnung, jede Monatsgrenze falsch
**Zeitbox:** eine Sitzung. **Grundlage:** D-056, Audit vom 17.09.2026.
Technisch APPROVED; Umsetzung `bc675d0` auf main, [Code-CI grün](https://github.com/Tim180201/taptime/actions/runs/35214461215).

### Zweck und Grenzen

Alle fachlichen Grenzen und Anzeigen im Admin-Web gelten in Europe/Berlin, unabhängig von
der Browser-Zone. Keine zusätzliche Nutzerentscheidung; Ereigniskette und Originalhistorie
bleiben intakt. Die Zone entsteht als Core-Konstante und wird durch Development mit dem Code
gepflegt; bei späterem Bedarf ersetzt eine explizite Folgeaufgabe sie durch ein Feld (D-056).
Kein Zonenfeld, kein Deploy, kein Produktionszugriff, kein T-048 oder T-055. Migration 025
ist für reine Grenzwertkorrekturen per CREATE OR REPLACE erlaubt; keine Datenänderung.
Commit und Push nach APPROVED durch den Technical Lead erfolgt; T-048 kann folgen.

### Umsetzung

1. Eine benannte Zeitzonen-Konstante an genau einer Stelle in packages/core; Backend und Web
   importieren sie. Bestehende Core-Abhängigkeit des Admin-Web prüfen und bei Fehlen melden.
2. monthTimeWindow verwendet die vorhandene Wandzeit-Umrechnung aus timeZone.ts und die
   Konstante statt Date.UTC. Keine zweite Umrechnung. Den alten falschen Navigationstest ersetzen.
3. resolveBrowserTimeZone und Browser-Zone entfernen. Admin-Web zeigt überall Berlin;
   Bildschirm und CSV stimmen auch bei einem Browser in einer anderen Zone überein.
4. Export-Abfrageschutz aus längstem Berliner Kalendermonat ableiten: 31 Tage plus eine Stunde.
   Herleitung sichtbar, kein Vertragswechsel. 025 ersetzt betroffene SQL-Funktionen; alte
   Migrationen unverändert. SQL-Wert aus laufender DB gegen beide Verträge testen, inklusive
   wirksamer Annahme-/Abweisungsgrenze jeder vorhandenen Funktionsversion.
5. Alle Tages-/Monatsgrenzen aus Zeitstempeln in apps/backend-* suchen und vollständig melden,
   auch bei leerer Liste. Core-Konstante für spätere Backend-Tagesgrenzen erreichbar machen.
6. OwnTimeScreen und Work-Coordinator auf selbst gebildete Tagesgrenzen prüfen; Gerätezeit als
   P2 in STATUS aufnehmen; in T-036 nicht ändern.

### Pflichtgegenbeweise — vor Reparatur rot

- August 2026: [2026-07-31T22:00:00.000Z, 2026-08-31T22:00:00.000Z).
- März 2026: [2026-02-28T23:00:00.000Z, 2026-03-31T22:00:00.000Z), 31 Tage minus eine Stunde.
- Oktober 2026: [2026-09-30T22:00:00.000Z, 2026-10-31T23:00:00.000Z), 31 Tage plus eine Stunde;
  dieser Monat muss das Exportfenster passieren.
- 2026-08-31T22:30:00.000Z gehört zum September, nicht zum August. Rote Läufe zeigen.

### Verifikation und Abschluss

Testsinklusive Typechecks, vollständige Tests betroffener Workspaces; unabhängiges Review,
maximal zwei Runden. D-056, aktualisierte T-036-Planzeile und dieser Auftrag vor Umsetzung
getrennt committen und sofort pushen. Bericht nach AGENTS.md §8, ausgelassene Prüfungen begründen.
