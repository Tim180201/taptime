# Aktuelle Aufgabe

> **Stand 28.09.2026:** Produktion auf `e13916b` (Migrationen bis 034). Auf `main` zusätzlich T-080 (App), T-086/T-087
> (035), T-084 (036), T-085 (037), T-088 (038). Reihenfolge (PO 28.09.): **T-089** → ein Deploy, ein App-Build → T-024
> → Pilot Monat 1. Frühere Briefs stehen in der Git-Historie.

## T-089 · Der Wächter meldet nur echten Stillstand und nennt die Ursache (Befund 28.09.)

**Für:** Development · **Risiko:** Überwachung der Archivkette (D-051, D-055, D-066); ein echter Stillstand darf nie
unbemerkt bleiben · **Zeitbox:** eine Sitzung. Nur `infrastructure/backup/taptime-wal-archiver`,
`infrastructure/monitoring/taptime-immediate-monitor`, deren Tests, `MONITORING.md`. Kein Deploy, kein Serverzugriff.

### Befund (`taptime-status` und ntfy, 28.09.)

Seit dem Deploy von T-083 kommt „WAL-Archivierung steht“ etwa 1,5 Mal je Stunde (13 Mal von 06:00 bis 13:47 Uhr), auch
wenn keine Sicherung läuft; der gespeicherte Alarm ist jeweils kurz danach wieder weg. Die Sicherungen dauern knapp
7 min. Im Archivierer ist jeder Durchlauf 1 s lang außer dem gründlichen alle 15 min
(`WAL_ARCHIVE_RECONCILE_INTERVAL_SECONDS=900`): 82 s, davon `base_seconds=77`. Ursache im Code:
1. `reconcile_contiguous_watermark` ruft bei registrierter Basis `borg info "$BORG_REPOSITORY::$base_archive"` nur als
   Existenzprüfung auf; `borg info` berechnet dabei die vollständigen Archivstatistiken. Die Archivliste liegt im selben
   Durchlauf bereits aus `load_archive_inventory` (`borg list`, unter derselben Sperre) vor.
2. `write_status` läuft erst am Ende eines Durchlaufs. Der Wächter verlangt ein Lebenszeichen, das höchstens
   `WAL_ARCHIVE_INTERVAL_SECONDS × WAL_ARCHIVE_MISSED_CYCLES` = 120 s alt ist. 60 s Pause plus 82 s Durchlauf ergeben
   rund 140 s Stille; fällt die Minutenprüfung in diese Lücke, kommt der Alarm, beim nächsten Durchlauf ist er weg.
3. Die Meldung sagt nicht, welche Prüfung angeschlagen hat; die WAL-Zeilen im Journal tragen keine Uhrzeit im Text.

### Auftrag

**A. Basis billig prüfen.** Bei registrierter Basis die Existenz über die bereits geladene Archivliste belegen, nicht
über `borg info`. Die Prüfung bleibt streng: fehlt die Basis in der Liste, schlägt der Durchlauf fehl wie heute. Die
übrigen `borg info`-Aufrufe (Nachweis frisch hochgeladener Archive) bleiben unverändert. Im Bericht jeden
`borg info`-Aufruf im Archivierer mit Zweck auflisten.

**B. Laufenden Durchlauf erkennen.** Der Archivierer schreibt zu Beginn jedes Durchlaufs und bei jedem Phasenwechsel
(`set_cycle_phase`) ein Fortschrittszeichen (Zeitpunkt des Durchlaufbeginns, Phase, UTC) in sein Zustandsverzeichnis,
root-eigen, 0600, ohne Pfade der Box, ohne Geheimnisse; „ok“ steht weiterhin nur nach vollständiger Prüfung im
Status. Der Wächter toleriert ein veraltetes Lebenszeichen, solange ein Durchlauf nachweislich läuft und höchstens
600 s alt ist (fester Wert, im Code benannt). Ohne laufenden Durchlauf gilt wie heute 120 s, mit laufendem nie mehr
als 600 s. Die Prüfung auf wartende Segmente (`pending_count`, Datenalter) bleibt unverändert.

**C. Ursache in der Meldung.** Der Text beginnt weiter mit „WAL-Archivierung steht“ und nennt dahinter genau eine
Ursache mit Uhrzeit (UTC), zum Beispiel „Sicherung läuft seit 34 min“, „Archivierer ohne Lebenszeichen seit 3 min“,
„Durchlauf hängt seit 11 min (Phase base)“, „WAL-Segment wartet seit 5 min“, „Status nicht ok“. Keine Pfade, keine
Adressen, keine Geheimnisse. Die WAL-Zeile im Journal bekommt `at=<UTC>` am Anfang.

### Tests

Nachgebautes Borg und Uhr wie in den vorhandenen Tests. Rot vor Grün: (1) gründlicher Durchlauf mit registrierter
Basis ruft kein `borg info` auf die Basis, fehlende Basis in der Liste schlägt fehl; (2) Lebenszeichen 140 s alt bei
laufendem 82-s-Durchlauf → kein Alarm; (3) Durchlauf hängt 601 s → Alarm mit Ursache „hängt“; (4) kein laufender
Durchlauf und Lebenszeichen 121 s alt → Alarm „ohne Lebenszeichen“; (5) wartendes Segment über der Grenze → Alarm wie
bisher, jetzt mit Ursache; (6) laufende Sicherung über der gelernten Toleranz → wie bisher, jetzt mit Ursache;
(7) Meldung enthält keine Pfade oder Adressen. Bestehende Suiten unter `infrastructure/tests/*` und
`infrastructure/monitoring/tests/*`, ShellCheck, Workflow-Tests.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse. Keine Änderung an Sicherung, Aufräumen, Archivvertrag, Restore,
Controller, Compose oder der Konfigurationsdatei auf dem Server. Wird doch ein Konsolenschritt nötig: stoppen und
berichten.

### Bericht

`.t089-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf „ein echter Stillstand
bleibt nie unbemerkt“. Kein Commit vor `APPROVED`.
