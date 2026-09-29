# Aktuelle Aufgabe

> **Stand 29.09.2026:** Produktion auf `0230188` (Migrationen bis 039), ausgeliefert 28.09. Geräteabnahme auf iPhone 4 /
> Android 11 läuft. Danach T-093, T-091 bis T-098, T-100 → zweiter Deploy → T-024 → Pilot. Frühere Briefs stehen in der
> Git-Historie.

## T-093 · Sicherung: tägliches Aufräumen wirkt, Fehler werden sichtbar (D-106)

**Für:** Development · **Risiko:** Sicherung und Wiederherstellbarkeit (D-051, D-055); es darf nie eine geprüfte Basis
verloren gehen · **Zeitbox:** eine Sitzung. Analyse-Befunde F-007, F-054, F-067, F-076, F-124. Nur
`infrastructure/backup/*`, `infrastructure/monitoring/*`, deren Tests, `RESTORE.md`, `MONITORING.md`. Kein Deploy, kein
Serverzugriff, keine Geheimnisse.

### Befund (Code auf `0230188`)

1. `taptime-restore-verify` prüft sonntags ohne Ziel und ohne Pin die **neueste** Basis (`select_base_archive`), etwa
   die von 03:05, und schreibt ihren Marker. `run_backup_retention daily` (aus `taptime-backup`) schützt den neuesten
   Marker. Borg behält je Regel nur das jüngste Archiv einer Periode; die 03:05-Basis fällt nach 24 h aus allen Regeln.
   `prune_after_verified_restore` bricht dann mit 3 ab („protected“). Folge: Das tägliche Aufräumen setzt an sechs von
   sieben Tagen aus.
2. Seit T-083 gibt `run_backup_retention` auch bei `failed`/`protected`/`unregistered` 0 zurück; die Sonntagsprüfung
   meldet „ok“, kein Monitor liest `retention-status`. Früher ließ ein gescheitertes Aufräumen die Sonntagsprüfung
   scheitern.
3. Die Test-Fakes für `borg prune` geben „Keeping“/„Would prune“ per Schalter vor, statt die Keep-Regeln aus
   Zeitstempeln zu berechnen. Deshalb blieb 1. unentdeckt.
4. Während der Sonntagsprüfung hält `taptime-restore-verify` die Borg-Sperre lange; der Wächter kennt als Sperrhalter
   nur `taptime-backup.service` und toleriert einen wartenden Archivierer höchstens 600 s (T-089).
5. `record_archive_counts … || return 1` im Archivierer: Ein Fehler beim Schreiben einer reinen Anzeigezahl lässt den
   WAL-Durchlauf scheitern (in `taptime-backup` ist derselbe Fehler nicht fatal).

### Auftrag

**A. Sonntagsprüfung auf eine Basis, die Borg behält.** Ohne Ziel und ohne Pin wählt die Wochenprüfung die jüngste
Basis, die vor Beginn des aktuellen Tages entstand, in der Zeitzone, in der Borg auf dem Server seine Perioden
bildet (im Bericht belegen, woher). Die gezielte Prüfung mit Zeitpunkt, der gepinnte Weg des Deploys, Probe und
Materialisierung bleiben unverändert. Gibt es keine solche Basis (frische Installation), wie heute die neueste.

**B. Schutzregel.** Das Aufräumen (täglich und sonntags) wählt als geschützte Basis die neueste geprüfte Basis, die
laut Vorschau (`--dry-run`) von Borg behalten wird, und läuft dann. Nur wenn keine geprüfte Basis behalten würde,
wird ausgesetzt wie heute (3). Alles andere bleibt: nur `borg prune` löscht Basen, Vorschau vor dem echten Lauf,
unbekannte Ausgabe bricht ab, Nachprüfung, dass die geschützte Basis danach noch da ist, WAL-Untergrenze aus allen
behaltenen Basen, Marker gelöschter Basen werden entfernt.

**C. Fehler sichtbar, fünf Meldungen bleiben.** Die Sonntagsprüfung scheitert (bestehende Meldung
„Wiederherstellungsprüfung fehlgeschlagen“), wenn ihr eigenes Aufräumen `failed` endet oder `retention-status` seit
mehr als 8 Tagen nicht `ok` war (Zeitpunkt des letzten Erfolgs steht bereits im Status). Der tägliche Lauf bleibt ohne
Push-Meldung.

**D. Wächter kennt die Sonntagsprüfung.** Läuft `taptime-restore-verify.service`, behandelt der Wächter sie wie die
Sicherung: Pause der Altersprüfung bis zu einer festen, im Code benannten Obergrenze (90 min); darüber Meldung mit
Ursache „Wiederherstellungsprüfung läuft seit … min“. Ohne laufende Prüfung gilt alles aus T-089 unverändert.

**E. Anzeigezahl nicht kritisch.** Im Archivierer darf ein Fehler von `record_archive_counts` den Durchlauf nicht
scheitern lassen (Meldung auf stderr wie in `taptime-backup`).

### Tests

Das Fake-`borg prune` berechnet „Keeping“/„Would prune“ aus den Archivzeitstempeln nach Borgs Regeln (je Regel das
jüngste Archiv einer Periode, Regeln in Reihenfolge `hourly`, `daily`, `weekly`, `monthly`, Ausgabeformat wie Borg 1.2/1.4).
Rot vor Grün am alten Code: (1) Wochenablauf: stündliche Basen ab Sa, Sonntagsprüfung, Tageslauf Mo 04:05 → heute
`protected`, danach `ok` mit echten Löschungen und behaltener geprüfter Basis; (2) die gewählte Wochenbasis ist die
letzte des Vortags und wird 14 Tage behalten; (3) keine geprüfte Basis würde behalten → `protected`, nichts gelöscht;
(4) Sonntagsprüfung mit gescheitertem Aufräumen → Prüfung scheitert; `retention-status` seit 9 Tagen nicht `ok` →
Prüfung scheitert; seit 7 Tagen → nicht; (5) Wächter: laufende Sonntagsprüfung 40 min, Archivierer ohne Lebenszeichen →
kein Alarm; 91 min → Alarm mit Ursache; (6) Schreibfehler der Archivzahlen → WAL-Durchlauf `result=0`. Bestehende Suiten
unter `infrastructure/tests/*` und `infrastructure/monitoring/tests/*`, ShellCheck, Workflow-Tests; Linux-Container
für GNU-Werkzeuge wie in T-089.

### Nicht Teil

Keine Änderung an Keep-Werten, Sicherungszeitplan, Archivvertrag, WAL-Empfang, Restore-Ablauf, Controller, Compose oder
der Konfigurationsdatei auf dem Server. Keine neue ntfy-Meldung. Wird ein Konsolenschritt nötig: stoppen und berichten.

### Bericht

`.t093-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf „es geht nie eine geprüfte
Basis verloren“. Kein Commit vor `APPROVED`.
