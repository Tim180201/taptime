# Aktuelle Aufgabe

> **Stand 24.09.2026:** Produktion auf `b635c4a`. Auf `main`: T-077 und T-076 (APPROVED, noch nicht gebaut).
> Reihenfolge nach D-091: **T-062 → Deploy mit Migration 033 → App-Build (iPhone und Android) → T-024 → Pilot
> Monat 1**. Frühere Briefs stehen in der Git-Historie.

## T-062 · Die Standortleitung ist Administrator im eigenen Standort (D-059, D-064, D-067, D-069, D-073, D-091)

**Für:** Development · **Risiko:** Mandantentrennung, Standortgrenze, append-only Korrekturen, Sitzungsvertrag
**Zeitbox:** drei Sitzungen; Reihenfolge Bestandsaufnahme → Autorität in SQL mit Rotnachweis → Backend → App und
Web → Nachweis. **Muster:** T-060 (`has_membership_management_authority_v1`, Migration 020/027).

### Ziel

Eine Standortleitung kann für Personen mit Heimatstandort in ihrem Standort alles, was der Administrator für den
ganzen Betrieb kann: Zeiten **nachtragen** (mit Grund), abgeschlossene Zeiten **ändern** (mit Grund), laufende Zeiten
**beenden**, **Prüffälle entscheiden**; dazu wie heute sehen, einladen und Tags zuordnen. Ihre eigenen Zeiten
gehören dazu. Alles andere bleibt verschlossen: andere Standorte, Personen ohne Heimatstandort in ihrem Standort,
Arbeitsziele, Standorte, Lohnexport, Anlegen von Administratoren oder Standortleitungen. Die Grenze entscheidet
die Datenbank; App und Web zeigen nur, was die Sitzung nennt.

### Auftrag

1. **Bestandsaufnahme im Bericht:** Jede Autorität, die heute `administrator` verlangt, mit Fundstelle und
   Einordnung: (a) öffnen mit Standortgrenze, (b) bewusst Administrator-only, (c) schon standortfähig. Mindestens:
   `has_current_time_review_administrator_v1` (012), `correct_time_record_v1`, `adjudicate_time_review_items_v1`,
   `read_time_review_items_v1`, `read_effective_time_records_v1`, `backfill_time_record_v1` (030),
   `read_time_record_details_v1` (Zweig `taptime_time_review_reader`, 030/031), der Verwaltungsstopp (031),
   `review_items_available` im Sitzungsvertrag (021), `TimeReviewCoordinator.withAdministrator`,
   `AdministrationStopCoordinator`, `ProjectAdministrationCoordinator`, `TimeEntryExportCoordinator`.
   Export, Arbeitsziele und Standorte sind (b). Unklare Fälle: stoppen und fragen, nicht raten.
2. **Migration 033 `location_manager_time_authority`:** Eine SQL-Autorität nach dem Muster von 020, die für
   Administrator „Betrieb“ und für Standortleitung „eigene Standorte“ liefert und je Zielperson den Heimatstandort
   prüft (aktive `membership_home_location_assignments`). Die Funktionen aus Punkt 1 (a) prüfen damit die Zielperson
   in derselben Transaktion; `app.membership_role` trägt die echte Rolle. Bestehende Rechte des Administrators
   bytegleich. Prüffälle einer Person außerhalb des Standorts sind für die Standortleitung unsichtbar, nicht nur
   unentscheidbar. Ein Prüffall, dessen Zielperson ihren Heimatstandort wechselt, folgt der Person.
3. **Backend:** `withAdministrator` und Verwandte nehmen `standortleitung` an und geben die Rolle unverändert an
   die Datenbank weiter; keine zweite Grenzprüfung in TypeScript, keine Aufweichung für den Administrator.
   Sitzung: `review_items_available` und die Bereiche für die Standortleitung, sobald die Datenbank es erlaubt.
4. **App:** `AddTimeControl` und `TimeRecordControls` behandeln die Standortleitung wie den Administrator (Grund
   statt Kommentar, Beenden online). Serverablehnungen an der Grenze zeigen den vorhandenen Text „nicht erlaubt“,
   keine neuen Texte ohne Grund.
5. **Web:** Prüfungen, Korrekturen, Nachtragen und Beenden erscheinen für die Standortleitung nach dem, was die
   Sitzung nennt; Tabellen und Karten wie bei T-074. Lohnexport bleibt verborgen.
6. Nichts an Tags (T-060), Einladen (020), Mitarbeiterliste (028) ändern, außer die Bestandsaufnahme zeigt eine
   Lücke gegen D-059; dann melden.

### Tests

Rotnachweise vor der Umsetzung, in PostgreSQL: Standortleitung A (Standort 1) und B (Standort 2), Person P in
Standort 1, Person Q in Standort 2, Person R ohne Heimatstandort, ein zweiter Betrieb mit gleichen Rollen. A darf
für P und sich selbst: nachtragen, ändern, beenden, Prüffall entscheiden; A darf nichts für Q, R oder den zweiten
Betrieb, auch nicht lesen (Prüffälle, Details). Rollenwechsel A → Beschäftigte entzieht sofort. Zwei gleichzeitige
Entscheidungen desselben Prüffalls: eine gewinnt. App- und Web-Suiten, Typechecks, Browser-Layouttest mit
Standortleitungs-Fixtures, Migrationsprobe wie bei T-007.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse, kein App-Build. Kein Kiosk, kein Export für die
Standortleitung, keine Standortverwaltung durch die Standortleitung.

### Bericht

`.t062-review/` (report.md mit Bestandsaufnahme, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf
Mandanten- und Standortgrenze. Kein Commit, kein Push.
