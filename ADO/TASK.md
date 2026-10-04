# Aktuelle Aufgabe

> **Stand 04.10.2026:** Produktion: Anwendung `0230188`, Betrieb `764935b`, Migrationen bis 041 (Deploy 04.10. in der
> Probe gescheitert). Auf `main` bis `8b6b292` (T-091 bis T-094). Danach T-095 bis T-098, T-100 bis T-103 → T-024 →
> Pilot. Frühere Briefs stehen in der Git-Historie.

## T-093b · Deploy-Probe und Wächter

**Für:** Development · **Risiko:** Auslieferung (Deploy-Tor), Sicherung, Alarmierung · **Zeitbox:** eine Sitzung.
Nur `infrastructure/backup/*`, `infrastructure/monitoring/*`, `infrastructure/deploy` nur lesend, deren Tests, `RESTORE.md`,
`MONITORING.md`. Kein Deploy, kein Serverzugriff. Der Controller (`infrastructure/deploy`) wird nicht geändert, sonst
wäre ein Konsolenschritt nötig.

### Befund (Deploy 04.10., `764935b`)

1. Der Deploy ruft `taptime-restore-verify` mit gepinnter Basis (`TAPTIME_RESTORE_BASE_ARCHIVE`, `REHEARSAL_ONLY=0`)
   auf. Danach läuft `run_backup_retention weekly`, das seit T-093 scheitert, wenn das Aufräumen seit mehr als 8 Tagen
   nicht erfolgreich war. Das Aufräumen konnte genau wegen F-007 seit T-083 nie gelingen, und die frische Basis des
   Deploys war noch nicht registriert („Retention deferred: no registered verified base. Retention has no success
   within the last eight days. Weekly restore verification failed its retention check.“). Der Deploy brach nach den
   Migrationen ab; die Wiederherstellung selbst war grün.
2. Wächter-Fehlalarme „Durchlauf hängt seit 10–14 min (Phase base)“ etwa dreimal täglich (29.09., 04.10.): Der
   Archivierer-Durchlauf beginnt mit der stündlichen Sicherung (:05) und wartet auf sie; die feste Obergrenze von 600 s
   ab Durchlaufbeginn läuft dabei weiter.

### Auftrag

**A. Probe im Deploy.** Die 8-Tage-Regel und das Scheitern bei `failed` gelten nur für die geplante Sonntagsprüfung
(kein Pin, kein Zielzeitpunkt, keine Probe, keine Materialisierung). Mit gepinnter Basis (Deploy) läuft das Aufräumen
wie vor T-093: Ergebnis wird gespeichert und ausgegeben, lässt die Prüfung aber nie scheitern. `unregistered` (Basis
gerade erst entstanden) ist in keinem Weg ein Fehler.

**B. Wächter.** Solange `taptime-backup.service` oder `taptime-restore-verify.service` läuft, zählt die Zeit nicht gegen
die 600 s eines laufenden Durchlaufs; die Obergrenze läuft ab dem späteren von Durchlaufbeginn und Ende der Sicherung
bzw. Prüfung. Die bestehenden Obergrenzen für Sicherung und Prüfung bleiben. Meldungstexte und Ursachen wie bisher.

### Tests

Rot vor Grün: (1) Deploy-Weg mit gepinnter Basis, `retention-status` ohne Erfolg seit 9 Tagen und `unregistered` → Prüfung
`ok`; (2) derselbe Zustand auf dem geplanten Sonntagsweg → scheitert wie in T-093; (3) Deploy-Test des Controllers mit
diesem Zustand bis „T-007 … ok“ (Controller unverändert); (4) Wächter: Durchlauf beginnt :05, Sicherung läuft 12 min,
Durchlauf endet :19 → kein Alarm; Sicherung endet :12, Durchlauf läuft noch nach :22:01 → Alarm „hängt“; (5) Sonntagsprüfung
läuft 40 min → kein Alarm (T-093 unverändert). Alle Suiten unter `infrastructure/tests/*` und `infrastructure/monitoring/tests/*`,
Deploy-Tests, ShellCheck, Workflow-Tests, im Linux-Container wie bei T-093.

### Nicht Teil

Keine Änderung am Controller, an Keep-Werten, Zeitplan, Archivvertrag oder Restore-Ablauf. Keine neue Meldung.

### Bericht

`.t093b-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
