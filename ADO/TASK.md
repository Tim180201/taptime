# Aktuelle Aufgabe

> **Stand 05.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b, T-103, T-095, T-095b und T-096, Auslieferung mit dem
> nächsten Deploy (vorher Fingerabdrücke aus EAS, siehe STATUS). Reihenfolge: **T-097**, dann T-098, T-100 bis T-102 →
> Deploy und App-Builds → T-024 → Pilot. Frühere Briefs stehen in der Git-Historie.

## T-097 · Prüffälle vollständig

**Für:** Development · **Risiko:** Prüfliste der Verwaltung (Server-Leser, Verträge, Web) · **Zeitbox:** eine Sitzung.
`apps/backend-time-review`, `apps/backend-api`, `packages/time-review-contract`, `apps/admin-web`, gegebenenfalls
`packages/core` (nur Export der Gründe), neue Migration 045 (nur lesend). Keine Änderung an Engine-Entscheidungen.

### Befund

1. „Weitere laden“ in der Prüfliste bricht ab 100 offenen Fällen ab: der Cursor verliert Mikrosekunden (F-015).
2. Prüffälle zu Pausen fehlen im Leser und sperren die Prüfwarteschlange der Person (F-038). Seit T-095b gibt es
   `read_time_review_items_v3` (mit übersprungenen Sequenzen); die Pausenfälle fehlen dort weiterhin.
3. Vertrag und Web kennen nicht alle Eskalationsgründe der Engine; ein unbekannter Grund verwirft die ganze Seite
   (F-063). Rollen-, Prüf- und Eskalationsgründe werden an mehreren Stellen von Hand gepflegt, Antworten haben nur
   Typen, keine Parser (F-073).
4. „Korrigieren“ bietet Einträge fremder Personen und nur die erste Seite an; eine Fehlwahl gibt eine irreführende
   Meldung (F-068).

### Auftrag

1. Cursor mit voller Genauigkeit (Text mit Mikrosekunden aus SQL, unverändert zurück) oder gleichwertig; Blättern über
   mehrere Seiten mit gleichen Zeitstempeln.
2. Pausenfälle im Prüfleser (neue Version, Migration 045, nur lesend): Ziel darf leer sein („Pause“), gleiche
   Rollengrenzen wie die übrigen Fälle; übersprungene Sequenzen aus T-095b bleiben enthalten.
3. Eine Quelle je Liste (Rollen, Prüfgründe, Eskalationsgründe) als `as const` im Vertrag, mit Parser für Antworten;
   Server, Web und App leiten daraus ab. Vollständigkeitstest gegen die SQL-CHECK-Listen und die Engine-Gründe.
   Ein unbekannter Grund wird als „Sonstiger Prüfgrund“ angezeigt, die Seite bleibt.
4. „Korrigieren“ lädt gezielt die Einträge genau dieser Person (vorhandener Leser für Personenzeiten), mit Blättern;
   verständliche Meldung, wenn die Auswahl nicht passt.

### Tests

Rot vor Grün: (1) 101+ Fälle mit gleichen Sekunden → alle Seiten vollständig, keine Dopplung; (2) Pausenfall sichtbar,
Warteschlange der Person nicht gesperrt; Standortleitung sieht nur ihren Standort; (3) jeder Engine-Grund hat eine
Anzeige; unbekannter Grund → „Sonstiger Prüfgrund“; Vollständigkeitstest; (4) „Korrigieren“ zeigt nur Einträge der
Person, auch von Seite 2. Alle Suiten, die Migrationen abspielen, seriell (Lehre T-086); CI-Bauordnung (Lehre T-091).

### Nicht Teil

Prüfliste in der App, neue Prüfgründe, Engine.

### Bericht

`.t097-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
