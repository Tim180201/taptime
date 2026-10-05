# Aktuelle Aufgabe

> **Stand 05.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-101 (Migrationen 043–046), Auslieferung mit dem
> nächsten Deploy (vorher T-098b und Fingerabdrücke aus EAS, siehe STATUS). T-102 ist die letzte Codex-Aufgabe vor dem
> Deploy. Frühere Briefs stehen in der Git-Historie.

## T-102 · Beschäftigte nach Standort, Stunden des Monats (D-105, T-081)

**Für:** Development · **Risiko:** mittel (neue Lesefunktion mit Rechteprüfung, neue Vertragsvariante) · **Zeitbox:**
eine Sitzung. `apps/backend-schema` (Migration 047), `apps/backend-administration`, `apps/backend-api`,
`packages/administration-contract`, `apps/admin-web`, `apps/mobile`.

### Befund

„Beschäftigte“ (Web) und „Mitarbeiter“ (App) sind nach interner ID sortiert, also scheinbar zufällig; der Standort steht
nur als Spalte. Die Stunden des Monats sieht man erst in der Person (D-105 fehlt). Bei frogs (5 Standorte, etwa 200
Personen) ist die Liste so nicht zu gebrauchen.

### Auftrag

1. **Server (Migration 047):** neue Lesefunktion `read_managed_active_summary_v3` mit derselben Rechte- und
   Sichtbarkeitsprüfung wie v2 (Administrator alle, Standortleitung ihre Standorte, Ausgeschiedene nach D-101).
   Zusätzlich je Person die Summe des laufenden Monats in Europe/Berlin: nur beendete Einträge, Pausen abgezogen,
   stornierte nicht, mit denselben Bausteinen und derselben Monatszuordnung wie 036 (`effective_time_records_v2`,
   `time_record_duration_v1`). Prüfen, dass der Lohnexport dieselbe Zuordnung nutzt; eine Abweichung melden, nicht
   raten. Eine Abfrage je Seite, kein Aufruf je Person.
2. **Reihenfolge:** aktuelle vor ausgeschiedenen Personen, dann Standortname (ohne Standort zuletzt; bei
   ausgeschalteten Standorten entfällt die Stufe), dann Name, die ID als letzter Schlüssel. Seiten bleiben bei 20. Der
   Cursor enthält keine Namen (Vertrag: druckbares ASCII, höchstens 256 Zeichen), z. B. die letzte Membership-ID,
   deren Sortierschlüssel der Server neu liest.
3. **Vertrag:** neue Variante v3 (`MANAGED_PEOPLE_ACCEPT_V3`, strenger Parser, Feld für die Monatssumme). v1 und v2
   bleiben unverändert, damit installierte Apps (iPhone 5, Android 12) weiterlaufen. Admin-Web und App fragen v3 an
   und verstehen weiter v1/v2; ohne v3 zeigen sie die Liste wie bisher ohne Monatsspalte.
4. **Web „Beschäftigte“:** Zwischenüberschrift je Standort (bei gewähltem Standort nur einer), Spalte „Diesen Monat“
   im Format des Reiters „Kunden“, „Ausgeschieden“ bleibt eigener Block. Nach „Weitere Personen laden“ läuft die
   Gruppe weiter, ohne doppelte Überschrift.
5. **App „Mitarbeiter“:** gleiche Gruppierung mit Überschrift je Standort; je Person zusätzlich „Diesen Monat …“.
6. **Nebenbei (klein):** (a) Web „Tag neu zuordnen“: gehört der Tag schon zum gewählten Kunden, Hinweis am Feld („Der
   Tag gehört bereits zu diesem Kunden.“) statt der Meldung „nicht mehr verfügbar“ (P3 aus T-101). (b) App,
   Warte-Bildschirm beim Abmelden (D-120): Knopf „Angemeldet bleiben“ bricht das Abmelden ab (P3 aus T-095).

### Tests

SQL: Monatssumme je Person gleich der Summe derselben Person im Lohnexport (nur beendete); laufende, stornierte und
Vormonats-Einträge zählen nicht; Pausen abgezogen; Monat mit Zeitumstellung (Oktober). Rechte: die Standortleitung
sieht keine fremden Standorte, auch nicht über einen Cursor. Blättern über Gruppengrenzen ohne Lücke oder Doppel
(z. B. 45 Personen in 3 Standorten plus Ausgeschiedene). Vertrag: v1/v2 unverändert, v3 streng. Web und App: Gruppen,
Spalte, Rückfall ohne v3, beide Kleinigkeiten. Volle Suiten einschließlich Migrationsproben und Rechteinventar (047),
Typechecks.

### Nicht Teil

Suche (T-099), Standortwahl als eigener Schritt, „Zugänge verwalten“ (T-105, später), Änderungen an Rechten.

### Bericht

`.t102-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
