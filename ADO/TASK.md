# Aktuelle Aufgabe

> **Stand 06.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-102 (Migrationen 043–047), Auslieferung mit dem
> nächsten Deploy. Vorher T-098b (diese Aufgabe) und die Fingerabdrücke aus EAS (STATUS, „Vor dem nächsten Deploy“).
> Frühere Briefs stehen in der Git-Historie.

## T-098b · Registry wiederherstellen, Abrufprüfung bei jedem Lauf (Befund 05.10.)

**Für:** Development · **Risiko:** hoch (Registry-Schreibzugriff auf Produktionsabbilder) · **Zeitbox:** eine Sitzung.
Grundlage: der lokale Plan `.t098-review/restore-plan.md` (05.10.). `.github/workflows/container-image.yml`,
`.github/scripts/clean-ghcr.mjs` und ihre Tests.

### Befund

Das alte Aufräumen hat 21 Versionen im Paket `tim180201/taptime-backend-api` gelöscht: zehn Plattform-Manifeste, zehn
Attestationen und den Index `operations-0230188` der Stände `b1ecb8c` (Produktion) und `0230188`. Der Deploy zieht den
laufenden und den neuen Stand und würde daran scheitern. Seit T-098 überspringt der Image-Workflow das Aufräumen bei
einem fehlenden referenzierten Manifest und damit auch die anschließende Abrufprüfung (zuletzt bei `1043011` und
`d399c69`); der Lauf bleibt grün. Frist der Wiederherstellung: frühester Eintrag am 02.11.2026, 13:46 UTC.

### Auftrag

1. **Vorprüfung, nur lesend:** Die lokale `gh`-Anmeldung hat `read:packages` und `write:packages` (der PO hat
   `gh auth refresh -h github.com -s read:packages,write:packages` ausgeführt). Konto und Paketrechte, Versions-IDs und
   Digests gegen den Plan prüfen. Zusätzlich: Was haben die Aufräumläufe seit dem Plan gelöscht (`b693fde` lief als
   „erfolgreich“)? Ist darunter etwas, das ein geschützter Stand referenziert, gehört es in die Wiederherstellung.
2. **Wiederherstellen:** nur die geprüften Versionen, in der Reihenfolge des Plans (Plattform, Attestation, zuletzt
   Index), je Version `POST …/versions/{id}/restore`. Nach jeder Version: Antwort protokollieren, Digest direkt aus
   GHCR lesen. Bei 403/404, unklarer Antwort oder falschem Digest anhalten und melden.
3. **Abschlussprüfung:** alle fünf Abbilder von `b1ecb8c` und `0230188` vom Tag über Index, Plattform und Attestation
   bis zu jeder Schicht vollständig abrufen (genug Zeit je Blob), Größen und Digests prüfen. Ebenso `d399c69`.
4. **Code (Teil 2, erst nach erfolgreichem Teil 1):** Die Abrufprüfung aller geschützten Abbilder läuft bei jedem
   Image-Lauf, auch wenn das Aufräumen übersprungen wird. Fehlt etwas Geschütztes, wird der Lauf rot (nicht nur eine
   Warnung). Tests dafür, rot vor der Änderung.

### Grenzen

Kein Deploy, kein Serverzugriff, keine manuelle Löschung, kein manueller Start einer Bereinigung. Token und
Zugangsdaten nie in Bericht, Log oder Kommandozeile ausgeben. Teil 1 verändert kein Repository; Teil 2 normal mit
Review.

### Bericht

`.t098-review/` (restore-report.md für Teil 1, report.md, tracked.diff, untracked.txt für Teil 2). Teil 1 sofort
melden; Teil 2 erst danach. Kein Commit vor `APPROVED`.
