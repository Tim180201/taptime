# Aktuelle Aufgabe

> **Stand 25.09.2026:** Produktion auf `6c7007d` (Migrationen bis 034). Auf `main` zusätzlich T-080 (`7bd7877`, App).
> Reihenfolge (PO 25.09.): **T-083 → Deploy → App-Builds → Rest der Geräteabnahme → T-024 → Pilot Monat 1**.
> Frühere Briefs stehen in der Git-Historie.

## T-083 · Die Sicherung bleibt kurz, der Wächter passt sich an (Befund 25.09.)

**Für:** Development · **Risiko:** Sicherung und Archivkette in Produktion (D-051, D-055, D-066); nichts löschen,
was ein Restore braucht · **Zeitbox:** eine Sitzung. Nur `infrastructure/backup/*`, `infrastructure/monitoring/*`,
`infrastructure/operations/taptime-status`, deren Tests und Runbooks. Kein Vertragswechsel im Archiv (Archivnamen,
Inhalte und Marker bleiben).

### Befund (`taptime-status` 25.09.)

Stündliche Sicherungen dauern 10–44 Minuten bei winziger Datenbank; ein WAL-Zyklus mit einem Segment 142 s, davon
`base_seconds=129` (im Wesentlichen `borg info` auf die geprüfte Basis), `upload_seconds=6`. Drei Ursachen im Code:
1. Je Stunde ein `base-*`-Archiv (`taptime-backup`), je WAL-Segment ein `wal-*`-Archiv (`taptime-wal-archiver`);
   aufgeräumt wird nur sonntags in `taptime-restore-verify` (ab Zeile ~495: `borg prune` auf `base-*`, danach die
   WAL-Untergrenze aus `retained_base_wal_floors`). Zwischen zwei Sonntagen wachsen mehrere hundert Archive an.
2. Drei getrennte Borg-Caches (`$STAGING_ROOT/borg-cache` in der Sicherung, `$WAL_ARCHIVE_CACHE_DIRECTORY/cache`
   im Archivierer, ein eigener in der Prüfung). Jeder Borg-Aufruf gleicht dann alle Archive nach, die ein anderer
   Prozess seit dem letzten Mal angelegt hat; die Kosten wachsen mit der Archivzahl.
3. `BACKUP_PAUSE_MAX_SECONDS=600` im Wächter (`taptime-immediate-monitor`, Zeile 13): Hält die Sicherung die Sperre
   länger als zehn Minuten, folgt „WAL-Archivierung steht“, jede Stunde, ohne echtes Problem.

### Auftrag

**A. Ein Borg-Cache.** Ein gemeinsames, root-eigenes Verzeichnis (0700) für `BORG_CACHE_DIR` und
`BORG_CONFIG_DIR` in Sicherung, Archivierer und Prüfung; jedes Skript legt es bei Bedarf an, die drei bisherigen
Verzeichnisse entfernt das jeweilige Skript beim ersten Lauf (Borg baut den Cache neu; darin liegen keine Daten).
Sicher, weil alle drei Skripte jede Borg-Operation unter derselben `flock` auf `TAPTIME_BORG_LOCK_FILE` ausführen:
im Bericht belegen, dass kein Borg-Aufruf außerhalb der Sperre liegt (Archivierer: `borg list` in
`load_archive_inventory`, `borg info` in der Basisphase). Anlegen: die Skripte. Ändern: nur Borg. Entfernen: Root
beim Rückbau (Runbook).

**B. Täglich aufräumen.** Die Aufräumlogik aus `taptime-restore-verify` (Basis-`prune` mit den `BASE_BACKUP_KEEP_*`-
Werten, dann WAL-Archive unterhalb der Untergrenze der behaltenen Basen) in eine gemeinsame Funktion, die beide
Skripte nutzen; `taptime-backup` ruft sie nach erfolgreicher Sicherung und `borg check` auf, höchstens einmal je
24 Stunden (Zeitstempeldatei im Zustandsverzeichnis). Unverändert bleiben alle Schutzregeln: kein Aufräumen ohne
registrierte, geprüfte Basis (`production_base_is_registered`); die geprüfte Basis und ihr Marker werden nie
entfernt; kein WAL-Segment ab der ältesten behaltenen Basis wird entfernt; die Reihenfolge Sicherung → Prüfung →
Aufräumen bleibt. Danach `borg compact` (Borg 1.2/1.4 laut Testdoubles). Scheitert das Aufräumen, bleibt die
Sicherung erfolgreich, der Fehler steht im Journal und im Status. Die Sonntagsprüfung räumt weiter wie bisher.

**C. Wächter.** `BACKUP_PAUSE_MAX_SECONDS` wird aus der Dauer der letzten abgeschlossenen Sicherung abgeleitet:
Der Wächter merkt sich bei jedem Lauf, in dem `taptime-backup.service` inaktiv ist, die Dauer
`InactiveEnterTimestamp − InactiveExitTimestamp` in seinem Zustandsverzeichnis; Toleranz = das Doppelte davon,
mindestens 600 s, höchstens 3300 s (unter dem Stundentakt). Ohne gemerkte Dauer gelten 600 s. `MONITORING.md`
entsprechend; der Text der Meldung bleibt.

**D. Sichtbar machen.** `taptime-status` zeigt zusätzlich die Archivzahl je Art (`base-*`, `wal-*`, Marker), den
Zeitpunkt des letzten Aufräumens und die aktuelle Wächter-Toleranz; ohne Pfade oder Adressen.

### Tests

Nachgebautes Borg nach der dokumentierten Semantik von 1.2/1.4 wie in den vorhandenen Tests (`prune` mit
`--glob-archives` ohne `sh:`, `compact`). Rot vor Grün: (1) gemeinsamer Cache, alte Verzeichnisse weg; (2) Aufräumen
nach Sicherung höchstens einmal täglich, geprüfte Basis, Marker und WAL ab Untergrenze bleiben, ohne registrierte
Basis kein Aufräumen, Fehler beim Aufräumen lässt die Sicherung grün; (3) Wächter mit gemerkter Dauer 25 min
toleriert 50 min, ohne Dauer 10 min, nie über 55 min; (4) `taptime-status`-Zeilen. Bestehende Suiten unter
`infrastructure/tests/*`, ShellCheck, Workflow-Tests.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse. Kein neuer Archivvertrag, keine Änderung an Restore-Weg,
Deploy-Controller, Compose oder der Konfigurationsdatei auf dem Server. Kein Zusammenfassen von WAL-Segmenten.

### Bericht

`.t083-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf „nichts entfernen, was
ein Restore braucht“. Kein Commit vor `APPROVED`. Nach dem Deploy: Dauer der nächsten drei Sicherungen und
`base_seconds` des Archivierers aus `taptime-status` im Bericht nachtragen.
