# Aktuelle Aufgabe

> **Stand 08.10.2026:** T-115 abgeschlossen (`831cb29`, CI und Image grün). Als Nächstes Deploy 4 durch den PO (Ziel
> `831cb29`), dann App-Builds und Geräteabnahme. T-098c wird jetzt umgesetzt und erst nach Deploy 4 committet.

## T-098c · Registry aufräumen trotz alter Fehlstellen, Abrufprüfung bei jedem Lauf

**Für:** Development · **Risiko:** hoch (löscht erstmals wieder Paketversionen) · **Zeitbox:** eine Sitzung.
Nur `.github/` (Skripte, Workflow, Tests). Kein Server, kein Deploy.

### Ausgangslage

- Das Paket `taptime-backend-api` hält alle Abbilder: Backend, Verwaltung, Betreiber, Startseite und Operations.
- T-098b Teil 1 hat 21 Versionen wiederhergestellt.
- Teil 2 liegt lokal auf `t098b-verify` (`212486d`, nicht gepusht): Abrufprüfung bei jedem Image-Lauf, rot bei fehlendem
  geschütztem Inhalt. Er wurde angehalten, weil 74 Kind-Manifeste hinter 37 älteren Indizes von 16 Ständen aus dem
  September fehlen (`.t098-review/part2-report.md`).
- Folge heute: `collectManifests` scheitert an jedem 404. Jeder Image-Lauf überspringt das Aufräumen mit Warnung; nichts
  wird gelöscht und nichts geprüft.
- Die 16 Stände stehen in `known_versions` des Schutzsatzes. Abrufbar sind sie nicht mehr, geschützt bleiben sie.

### Regeln (TL-Entscheidung)

1. **Teil 2 übernehmen:** `212486d` inhaltsgleich auf das aktuelle `main` bringen (Beleg mit `range-diff`).
2. **Streng geprüft** (Lauf rot bei Fehlen), jeweils mit allen Kindern bis zu den Schichten:
   - `current` und `previous`;
   - die Operations-Version und `ops`;
   - die neuesten zwanzig Paketversionen.
3. **Ältere bekannte Stände** (`known_versions` ohne `current`/`previous`):
   - Fehlende Kinder geben **eine** Warnung mit Anzahl und Ständen, kein Rot.
   - Ihre Indizes bleiben erhalten.
   - `known_versions` wird nicht gekürzt (keine Serveränderung).
4. **Fehlende Kinder blockieren das Aufräumen nicht mehr.**
   - Unter einem löschbaren Eltern-Index wird ein 404-Kind übergangen. Der Eltern-Index wird gelöscht, Eltern vor
     Kindern.
   - Unter einem streng geschützten Eltern-Index wird der Lauf vor jeder Löschung rot.
   - Unter einem älteren bekannten Stand gibt es eine Warnung, und der Eltern-Index bleibt.
   - Andere Fehler überspringen das Aufräumen weiter mit Warnung, ohne zu raten. Das gilt für alles, was kein 404 ist,
     für Zeitüberschreitungen und für eine unvollständige Versionsliste.
5. **Unverändert:**
   - Ist der Schutzsatz nicht abrufbar, wird mit Warnung übersprungen.
   - Ein Löschfehler macht den Lauf rot.
   - Kinder eines erhaltenen Index bleiben.

### Trockenlauf vor dem Commit (Pflicht)

- Den Löschplan mit dem neuen Code nur lesend erzeugen, kein DELETE:
  - Registry anonym abfragen;
  - Versionsliste per `gh api` lesen (`read:packages`);
  - Schutzsatz von `https://admin.tb-infra.de/status/ghcr-protected-versions.json`.
- Ergebnis in `.t098c-review/dry-run.md`:
  - Anzahl der Löschungen;
  - je Version Tags, ID und Datum, nach Stand gruppiert;
  - behaltene Stände mit Grund (streng, bekannt, neueste zwanzig, Kind);
  - Warnliste.
- Belegen: Kein Tag von `current`, `previous`, Operations oder `ops` und keine der neuesten zwanzig Versionen steht im
  Plan.
- Nach Deploy 4 den Trockenlauf mit dem dann gültigen Schutzsatz wiederholen. Erst danach folgt der Commit.

### Reihenfolge

Umsetzung und Review jetzt. **Commit und Push erst nach Deploy 4 und einem frischen Trockenlauf.**

Grund: Der erste echte Lauf löscht. Vor Deploy 4 schützt das Deploy-Ziel nur die Regel „neueste zwanzig Versionen“, und
das sind nur etwa zwei Image-Läufe. Jeder weitere Lauf könnte es löschen, dann scheitert Deploy 4. Nach dem Deploy ist es
`current`.

### Tests

Je Punkt rot vor der Änderung:
- 404-Kind unter löschbarem Eltern-Index: Das Aufräumen läuft, Eltern vor Kindern.
- 404-Kind unter streng geschütztem Eltern-Index: rot, keine Löschung.
- 404-Kind unter älterem bekanntem Stand: eine Warnung, der Eltern-Index bleibt, der Lauf ist grün.
- Abrufprüfung auch bei übersprungenem Aufräumen (Teil 2), rot bei fehlendem streng geschütztem Inhalt.
- Fehler, der kein 404 ist: Überspringen mit Warnung.
- Workflow-Test: Die Prüfung hängt an `protection.available`.
- Alle Skript-Tests und der Typecheck von `.github/scripts`.

### Grenzen

- Kein Deploy, kein Serverzugriff.
- Kein DELETE von Hand, kein Workflow von Hand gestartet.
- Token nie ausgeben. Fehlt `read:packages`, führt der PO `gh auth refresh -h github.com -s read:packages` aus; gemeldet
  wird nur die Zeile „Token scopes“.

### Bericht

`.t098c-review/` (report.md, tracked.diff, untracked.txt, dry-run.md). Unabhängiges Review in einer Runde, eine zweite
nur bei P1/P2. Kein Commit vor `APPROVED`. ADO nicht ändern.
