# Aktuelle Aufgabe

> **Stand 11.11.2026:**
> - T-144 ist auf main (`ed7e964`). Der Entwurf T-055 Teil 1 ist abgenommen, entschieden ist D-162: prüfen statt neu
>   entscheiden.
> - T-055 kommt in vier Teilen (PLAN): a Vorgang, b Eingang, c Prüfung im Web, d App. Danach App-Build und ein Deploy
>   mit T-144.

## T-055a · Wiederaufnahmevorgang nach einem Restore

**Für:** Development (Astra, Extra High) · **Risiko:** hoch. Es geht um Wiederherstellung und Betrieb · **Zeitbox:**
eine Sitzung.

**Grundlage:** D-162 und der Entwurf `.t055-review/entwurf.md`, Abschnitt 4, Punkte 1 und 2. Heute schreibt
`taptime-restore-activate` nur den Abschlussmarker mit Format, Cluster, Basis und Ziel. Eine Wiederaufnahme ist für
Server und App nicht erkennbar.

### Umfang

1. **Vorgang anlegen:** `taptime-restore-activate` legt nach der Clusterprüfung und **vor** dem Start der Schreibwege
   (`DEPLOY_COMMAND`) einen Wiederaufnahmevorgang in der wiederhergestellten Datenbank an. Er enthält:
   - eigene Kennung, Cluster und Timeline;
   - Ziel: letzter Archivstand oder Zeitpunkt (bewusster Rücksprung);
   - den tatsächlich erreichten WAL-Punkt mit seiner Zeitgrundlage, aus der Datenbank abgeleitet, nicht geschätzt
     (AGENTS 1.6);
   - die Aktivierungszeit.

   Keine Nutzerdaten. Eine wiederholte Aktivierung desselben Volumes ergibt denselben Vorgang. Ein neuer Restore ergibt
   einen neuen Vorgang, frühere bleiben erhalten.
2. **Lebenszyklus (AGENTS 1.5):** Wer legt an (nur die Aktivierung, über eine versionierte Funktion mit eigener Rolle),
   wer ändert (niemand; spätere Teile ergänzen nur Statusereignisse), wer entfernt (kein produktiver Löschweg vor T-016).
   Tabelle mit ENABLE und FORCE RLS, minimale Rechte.
3. **Lesevertrag:** Eine angemeldete App kann den neuesten Vorgang (Kennung, Ziel, Aktivierungszeit) in einem neuen,
   versionierten Vertrag lesen. Bestehende Verträge und alte Apps bleiben unverändert.
4. **Noch keine geänderte Entscheidung:** Erfassung, Abgleich und Prüfung bleiben wie heute. Das kommt mit T-055b.
5. **`infrastructure/RESTORE.md`** im selben Commit anpassen (AGENTS 7).

### Tests und Nachweis

- **Physischer Restore** nach dem Vorbild `OfflineRestorePostgres.test.ts` (echte Basis, echtes WAL, zerstörter
  Quelldatenträger):
  - letzter Stand und früherer Zeitpunkt ergeben je einen Vorgang mit richtigem Ziel und erreichtem Punkt;
  - eine wiederholte Aktivierung ergibt keinen zweiten Vorgang.
- **Aktivierung:** Der Vorgang besteht, bevor der Deploy startet. Schlägt das Anlegen fehl, startet nichts. Die Tests
  von `taptime-restore-activate` gegen die dokumentierte Semantik von Docker und PostgreSQL (AGENTS 4).
- **Rechte:** Nur die Aktivierungsrolle legt an. App-Rollen lesen nur über die Funktion. Keine Schreibrechte für die App.
- **Lesevertrag:** mit Vorgang, ohne Vorgang, alte Vertragsversion unverändert.
- **CI** ganz lokal nachgebaut, die Betriebsskripte auch ohne root.
- **Bericht:** `.t055a-review/bericht.md` mit den PO-Schritten nach `infrastructure/DEPLOY.md`. Dazu gehört auch, ob die
  Aktivierung an der Konsole vorher aktualisiert werden muss.

### Grenzen

- Keine Änderung an Erfassung, Abgleich, Prüfung oder App.
- Kein Deploy, kein Server, kein Supabase, kein EAS, keine GHCR-Paketaktion, keine Image-Pulls, nichts installieren.
- Unabhängiges Review (AGENTS 4). Kein Commit vor `APPROVED`.
