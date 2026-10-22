# Aktuelle Aufgabe

> **Stand 22.10.2026:** T-134 fertig (`5f65fc3`). Jetzt **T-132** (Messwerte des PO und Entscheidung D-150 liegen vor),
> danach T-099a (Brief in `8e33a3c:ADO/TASK.md`). Ohne Verbindung des TL zum Mac legt Codex den geprüften Stand nach
> PO-Freigabe als Zweig `review/<aufgabe>` ab (STATUS).

## T-132 · Arbeitsbereich der Sicherung auf die Platte, mit B12

**Für:** Development (Astra, Extra High) · **Risiko:** hoch: Sicherung und Wiederherstellung personenbezogener Daten,
deshalb unabhängiges Review durch einen zweiten Agenten (AGENTS 4) · **Zeitbox:** zwei Sitzungen. Reißt sie, wird B12 in
der Reihenfolge unten geschnitten, nie der Kern (Punkte 1 bis 3).

**Befund (Konsole 22.10.):** `/run` ist ein tmpfs mit 382 MB, RAM 3,8 GB, Datenbank 125 MB, WAL-Puffer 17 MB, Platte
38 GB mit 29 GB frei. Die Sonntagsprobe am 18.10. spielte die Basis vom 17.10., 23:05 UTC, ein und scheiterte beim
Kopieren der vierten WAL-Datei mit „No space left on device“. Im tmpfs liegen gleichzeitig `base.tar`, die entpackte
Basis und alle WAL-Dateien seit der Basis (16 MB je Datei, etwa drei je Stunde). Die stündliche Sicherung legt
`base.tar` im selben tmpfs ab und scheitert, sobald die Datenbank wächst.

### Umfang

1. **Arbeitsbereich auf der Platte (D-150)** für `taptime-backup`, `taptime-restore-verify` (Wochen- und Deploy-Probe,
   Wiederherstellung) und die Probe im `deploy`: ein fester Ordner auf dem Root-Dateisystem, root:root, 0700. Er
   ersetzt `/run/taptime-backup` und die tmpfs-Pflicht. Der Wächter verlangt stattdessen: Verzeichnis, kein Symlink,
   Eigentümer root, Modus 0700, kein für andere beschreibbarer Elternpfad. Sonst Abbruch vor dem ersten Schreiben.
2. **Entsteht, ändert, verschwindet (AGENTS 1.5):** systemd bzw. der Deploy legen den Ordner an. Jeder Lauf arbeitet in
   einem eigenen Unterordner mit eindeutigem Präfix und entfernt ihn am Ende, auch im Fehlerfall. Reste früherer
   Abstürze entfernt der nächste Lauf derselben Art unter seiner Sperre, nie den Unterordner eines laufenden anderen
   Jobs (F-122). Beim Systemstart wird der Ordner geleert (zum Beispiel `tmpfiles.d`). Der Ordner selbst bleibt; der
   Rückbau steht im Runbook.
3. **Platzprüfung vor jedem Lauf**, aus der Quelle abgeleitet statt einer festen Zahl (AGENTS 1.6): Basis zweifach
   (Archiv und entpackt) plus die benötigten WAL-Dateien plus Reserve. Der Lauf darf die Belegung nicht über die
   Alarmschwelle des Tagesmonitors heben (`DISK_USAGE_THRESHOLD_PERCENT`, gelesen wie im Deploy-Vorabcheck). Reicht der
   Platz nicht: klarer Abbruch vor dem Schreiben, Statusdatei auf Fehler, damit der bestehende Alarm greift.
4. **B12:** jeden Befund zuerst am heutigen Code prüfen (lokal `.audit-2026-09/`). Reihenfolge, zugleich
   Schnittreihenfolge:
   - F-122: Überlappung von Sicherung und Prüfung;
   - F-055: Zeitgrenzen (`flock -w`, `TimeoutStartSec`, Keepalive und Verbindungs-Timeout für Borgs SSH);
   - F-049: Sonntagsprobe während eines Deploys;
   - F-084: Borg-Sicherheitszustand nicht im Cache-Verzeichnis;
   - F-120: UTC-Quelle für den Zielzeitpunkt im Runbook;
   - F-056: Totmannschalter für den Tagesmonitor. Der zweite Healthchecks-Check wird vom PO angelegt; Code und
     Runbook-Schritt vorbereiten, im Repository nur den Konfigurationsnamen.
   - F-123: nur als Prüfschritt für den PO nach Deploy 8, ohne Codeänderung.
5. **Tests** mit der echten Semantik der Werkzeuge (AGENTS 4):
   - Wächter: Symlink, Eigentümer, Modus;
   - Platzmangel bricht vor dem Schreiben ab und setzt den Status;
   - Aufräumen nach Fehler und nach Absturz, nur mit eigenem Präfix;
   - gleichzeitige Sicherung und Probe;
   - Deploy-Probe im neuen Ordner.

   Die bisherigen tmpfs-Annahmen der Tests anpassen, nicht löschen.
6. **Runbook:** `RESTORE.md`, `DEPLOY.md`, `MONITORING.md`.
   - Hetzner Cloud Backups (D-151): Inhalt, sieben Tage, alte Zugangswerte bleiben dort bis zu sieben Tage nach einer
     Rotation, kein geprüfter Datenbank-Restore-Weg, wann man sie nutzt.
   - PO-Schritte für Deploy 8: neuen Controller installieren, falls `infrastructure/deploy` geändert ist. Nach dem
     Deploy die Wochenprobe einmal von Hand an der Konsole starten und den grünen Status belegen (kurze Befehle,
     US-Tastatur).

### Grenzen

Kein Server-Zugriff, kein Deploy, keine Geheimnisse, keine GHCR-Paketaktion, nichts installieren. Borg-Aufbewahrung,
Verschlüsselung und Archivformat bleiben unverändert. Die ganze CI lokal nachbauen. Bericht in `.t132-review/`; kein
Commit vor `APPROVED`.
