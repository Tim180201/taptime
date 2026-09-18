# Aktuelle Aufgabe

> **Stand 18.09.2026:** T-058 (`3daa09b`), T-043 (`b68e48b`), T-060 (`1d0a4e9`) und T-059
> (`91441c8`) sind auf `main`, CI grün. Produktion läuft auf `939b4ba`, also vier Aufgaben
> zurück. Reihenfolge: **Deploy → APK → Geräteabnahme (D-044) → T-049 → Pilot Monat 1.**

## Nächster Schritt · Deploy von `91441c8`, danach die APK

**Für:** Product Owner (Terminal) mit Technical Lead · **Risiko:** zwei Migrationen in einem
Deploy, T-057 noch offen. **Grundlage:** `infrastructure/DEPLOY.md`, AGENTS.md §7.

### Warum der Deploy vor die APK gehört

Die neue App fragt Dinge ab, die es in der Produktion noch nicht gibt: Migration 027 (Tag-
Autorität mit Standortgrenze), Migration 028 (`read_managed_person_time_v1`,
`read_managed_active_summary_v1`), die zwei neuen Routen und die erweiterte Sitzung mit
`nfcSetupAvailable` und `managementScope`. Eine APK vor dem Deploy zeigt weder Tags noch
Mitarbeiter — der Server sagt nichts davon.

### Was dieser Deploy mitbringt

- **Migration 027 und 028** — beide additiv, beide gegen einen Bestand mit Daten geprüft.
  Kein Rückweg hinter 023 (Archivvertrag); 027 und 028 legen nur Funktionen und Policies an.
- T-053/T-039-Tor, Archivvertrag und Sicherungskette laufen unverändert weiter.
- Der Deploy läuft aus einer interaktiven Terminalsitzung des Product Owners (AGENTS §7):
  SSH-Agent geladen, `caffeinate`, `tee`-Log außerhalb des Repositorys. Nicht aus Codex.

### Vorprüfung vor dem Aufruf (enger als am Vormittag, weil T-057 offen ist)

1. Image zum Commit `91441c8` ist veröffentlicht (Workflow „Release container images" grün).
2. Letzte Sicherung ist **frisch und erfolgreich** — nicht nur die Statusdatei lesen, sondern
   Zeitstempel und Ergebnis der letzten `taptime-backup`-Einheit prüfen (T-057: die zweite
   Prüfung im Deploy-Skript liest sonst eine alte Statusdatei).
3. WAL-Archivierer läuft und hat eine Quittung jünger als zwei Zyklen.
4. Erst danach `infrastructure/deploy` mit dem Ziel-Commit.

### Nach dem Deploy

Belege nach DEPLOY.md; zusätzlich: `/v1/session` mit der neuen Antwortform liefert
`nfcSetupAvailable` und `managementScope`, und beide neuen Routen antworten einem Mitarbeiter
mit `forbidden`. Dann die APK bauen
(`npm run android:production-validation:build --workspace apps/mobile`), Link persönlich an
den Product Owner. Geräteabnahme nach D-044; Test-Tags einmal neu zuordnen (T-043).
