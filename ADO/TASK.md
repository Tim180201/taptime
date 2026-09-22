# Aktuelle Aufgabe

> **Stand 22.09.2026:** Produktion auf `d75fd56` (T-067). Auf `main` T-065 und T-066 (`fd9b5ef`).
> Reihenfolge: **T-070 → Deploy (T-066 + T-070, Migration 030) → APK → Geräteabnahme → T-068**
> (D-072). T-068 ist nur Web und braucht keine neue APK.

## T-070 · Der Archivierer ruht billig; der Wächter lässt nach der Sicherung Luft

**Für:** Development · **Risiko:** Sicherungskette T-035 (WAL-Archiv, Wächter), keine Daten
**Zeitbox:** eine Sitzung. **Grundlage:** D-066, D-072, Journal der Produktion vom 22.09.

### Befund (Produktion, 22.09., am Journal geprüft)

- Über 20 ntfy-Alarme „WAL-Archivierung steht" in einer Nacht (00:31 … 04:40 Ortszeit), ohne
  fehlende Daten; die Platte ist stabil (6,2 GB belegt), T-067 wirkt.
- **Ein Durchlauf ohne Arbeit dauert 67–68 s** (`uploaded_segments=0 reconciled_archives=0`,
  gleichmäßig über Stunden). Mit 30 s Pause liegen ~98 s zwischen zwei Statusschreibungen; das
  Fenster des Wächters ist 120 s. Jede Verzögerung der Storage Box reißt es (08:24:57: 147 s ohne
  Arbeit).
- **Nachholen nach der Sicherung:** Sicherung 08:05:01–08:12:21 UTC (7:20 min, unter der
  Zehn-Minuten-Grenze). Der Durchlauf, der auf die Sperre wartete, endete 08:13:51 nach 451 s mit
  3 Segmenten; Alarm um 08:16 Ortszeit-Minute. Der Wächter zählt ab Sicherungsende, das Nachholen
  braucht länger als 120 s.
- Vermutung (belegen!): Der Leerlauf ruft je Durchlauf Borg über SSH auf (`borg info` der Basis,
  `borg list --glob-archives wal-*` über das ganze Repository); das Repository trägt noch die
  Archive der Flut bis zur nächsten Aufräumung (sonntags, `taptime-restore-verify`).

### Auftrag

1. **Erst belegen:** Aus dem Code alle Borg-/SSH-Aufrufe eines Leerlauf-Durchlaufs auflisten und
   lokal mit einem synthetischen Repository (mindestens 5.000 WAL-Archive) messen, welche Phase
   dominiert. Journalzeile um die Dauer je Phase ergänzen (Datenbank, Archivliste, Basis,
   Hochladen, Abgleich) — keine Adressen, keine Geheimnisse.
2. **Leerlauf ohne Fernzugriff (D-072):** Gibt es keine offene Anforderung, keine vollständige
   Spool-Datei ohne Quittung und keinen neuen Wasserstand, schreibt der Durchlauf den Status
   `ok` allein aus Datenbank und Spool. Der Vollabgleich mit der Storage Box (Liste, Basis,
   Lückenprüfung) läuft, sobald Arbeit ansteht, und sonst höchstens alle 15 Minuten
   (konfigurierbar, Standard 900 s). Eine Lücke oder ein Fehler im Vollabgleich bleibt ein
   Fehler wie heute. Pro Durchlauf höchstens eine Archivliste.
3. **Nachholzeit (D-072):** Nach dem Ende einer Sicherung zählen Herzschlag und Datenalter im
   Wächter erst nach einer einmaligen, begrenzten Nachholzeit (Standard 300 s, konfigurierbar;
   Obergrenze im Code, nicht über 600 s). Sicherung über zehn Minuten alarmiert weiter.
   Alles andere am Wächter bleibt (120 s, Flankenmeldung, AF_UNIX).
4. **Tests:** Leerlauf ohne einen einzigen Borg-Aufruf (Stub zählt); Vollabgleich nach Ablauf
   des Intervalls und bei Arbeit; Lücke im Vollabgleich bleibt rot; Wächter: Alarm 301 s nach
   Sicherungsende mit offener Anforderung, keiner bei 299 s; bestehende T-035/T-063/T-067-Tests
   grün. Rotnachweis für die ersten beiden mit dem alten Code.
5. **Messung vorher/nachher** (lokal, synthetisch): Dauer eines Leerlauf-Durchlaufs und eines
   Nachholens von drei Segmenten.

### Nicht Teil

Keine Änderung an Basissicherung, `borg check`, Aufbewahrung, Wiederherstellung, Migrationen,
Deploy-Skript. Kein Zugriff auf den Server, auf `/opt/taptime/.env` oder `/etc/taptime-backup/*`.

### Bericht

`.t070-review/report.md`, `tracked.diff`, `untracked.txt`. Kein Commit, kein Push, kein Deploy.
