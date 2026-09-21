# Aktuelle Aufgabe

> **Stand 21.09.2026:** Produktion läuft seit 20.09., 15:11 Uhr, auf `7f0012e` (T-061, T-049,
> T-063, T-064; Migration 029). Web vom Product Owner abgenommen, Gerät abgenommen bis auf den
> Kalender. **Die WAL-Archivierung läuft in Produktion aus dem Ruder** (Befund unten); bis zum
> Deploy von T-067 ist der Archivierer angehalten.
> Reihenfolge: **T-067 → Deploy → T-065 → T-066 → Deploy → Pilot Monat 1.**

## T-067 · Die Archivierung erzeugt ihre Arbeit nicht mehr selbst

**Für:** Development · **Risiko:** Sicherungskette, Betriebsüberwachung, Plattenplatz in Produktion
**Zeitbox:** eine Sitzung. **Grundlage:** Produktionsprotokolle vom 20./21.09. (Journal der drei
Einheiten, vom Product Owner über die Konsole gezogen), D-065, D-066. Auftrag vom 21.09.2026.

### Befund (Produktion, am Journal belegt)

- **Rund 200 WAL-Archive je Stunde, Tag und Nacht, ohne Taps.** Journal-Zählung je Stunde:
  144 bis 425. `archive_timeout=15s` schließt ein Segment, sobald seit dem letzten Wechsel WAL
  geschrieben wurde — und der Archivierer schreibt bei jedem Durchlauf selbst Quittungen und
  Wassermarken. Er erzeugt sich damit alle 15 bis 18 Sekunden das nächste Segment. Die Schätzung
  aus T-063 (1.848–3.288 je Tag) lag um den Faktor zwei zu niedrig, weil nur ein einzelner Tap
  und nie der stundenlange Leerlauf gemessen wurde.
- **Vier Fernaufrufe je Segment** (`archive_file`: `borg info`, `borg create`, `borg extract`;
  Abgleich: `borg info`). Gegen die Storage Box liegt die Kapazität knapp über der
  Ankunftsrate. Jede Störung verlängert den nächsten Durchlauf, der dann mehr Rückstand
  vorfindet: Zwischen 02 und 04 Uhr, 05 und 07 Uhr und ab etwa 09 Uhr UTC wurde nichts
  hochgeladen; um 11:13 UTC stand der Abgleich bei `…0D00000085`, rund 600 Segmente hinter dem
  aktuellen Stand.
- **Die stündliche Basissicherung verhungert.** Sie hält dieselbe Sperre rund zwei Minuten
  (`borg check --verify-data`) und wartet hinter den Durchläufen: gestartet 02:05, gelaufen
  04:04; gestartet 04:10, gelaufen 07:44; gestartet 07:51, um 11:13 noch wartend.
- **Platte:** 6,0 GB belegt vor dem Deploy, 17 GB 20 Stunden später. Noch nicht hochgeladene
  Segmente (je 16 MB) liegen auf derselben Platte wie die Datenbank.
- **Alle sechs Alarme** vom 20./21.09. fallen in Fenster, in denen Sicherung und Archivierer
  sich gegenseitig blockieren.
- **Fehlannahme in T-063 (Technical Lead):** Der Archivierer fordert schon selbst einen
  Segmentwechsel an, sobald eine Anforderung offen ist (`pending_wal_files` →
  `pg_switch_wal()`), und das bereits vor T-063. `archive_timeout` war der falsche Hebel. Die
  Warnung aus dem T-063-Bericht (Laufzeit bei sehr großem Archivbestand ungeprüft) war
  berechtigt und wurde als Restrisiko durchgewunken.

### Umsetzung

1. **`archive_timeout` kommt aus beiden Compose-Dateien wieder heraus.** Der Monitor-Test aus
   T-063 wird umgedreht: Er verlangt, dass der Datenbankdienst **kein** `archive_timeout`
   setzt, und verweist im Kommentar auf D-066.
2. **Der Archivierer wechselt selbst — in jedem Durchlauf, aber nur, wenn es nötig ist.** Ein
   Wechsel wird angefordert, wenn eine offene Anforderung im **noch offenen** Segment liegt
   (nicht bei jeder offenen Anforderung). Danach wartet der Durchlauf begrenzt, höchstens
   zehn Sekunden, bis das geschlossene Segment im Spool liegt, und archiviert es im selben
   Durchlauf. Trägt die Unterscheidung voller Durchlauf / Spool-Durchlauf danach keinen
   Unterschied mehr, fällt sie weg; die halbe Pause zwischen den Durchläufen bleibt.
3. **Keine doppelte Fernabfrage im Abgleich.** Für ein Archiv mit registrierter Quittung
   entfällt die `borg info`-Existenzprüfung. Begründung: Die Quittung entsteht in
   `archive_file` nur nach bytegenauem Read-back — das ist stärker als eine Existenzprüfung.
   Ohne Quittung (Wiederaufbau nach Restore) bleibt der Weg über `archived_checksum`
   unverändert. Die tiefe Prüfung bleibt bei `taptime-restore-verify`. Der Kommentar im Code
   sagt das.
4. **Die Sicherung pausiert die Archivierung — begrenzt und ehrlich.** Während
   `taptime-backup.service` läuft, archiviert niemand; das ist gewollt. Der Wächter misst
   deshalb Status- und Anforderungsalter ab dem **späteren** Zeitpunkt von (Beobachtung bzw.
   Anforderung, Ende der letzten Sicherung). Läuft eine Sicherung — einschließlich Warten auf
   die Sperre — länger als **zehn Minuten**, wird alarmiert, gleich was sonst gilt. Keine neue
   Konfigurationsvariable; die zehn Minuten sind eine dokumentierte Konstante.
5. **Eine Zeile je Durchlauf im Journal:** Dauer, hochgeladene Segmente, abgeglichene Archive,
   ob ein Wechsel angefordert wurde. Keine Adressen, keine Pfade zum Speicher, keine
   Geheimnisse. Damit ist der nächste Befund eine Zeile im Journal statt einer Rekonstruktion.

### Grenzen

- Unverändert: Migrationen und Archivvertrag, Aufbewahrung, `taptime-restore-verify`,
  Intervall und verpasste Zyklen in der Konfiguration, Häufigkeit der Basissicherung, ein
  Borg-Archiv je Segment. Scheint eines davon nötig: stoppen und melden.
- Nichts am Server. Kein Deploy.
- Kein Geheimnis, keine Speicheradresse in Test, Protokoll oder Bericht.

### Verifikation und Abschluss

- **Leerlauf-Rotnachweis — der Test, der in T-063 fehlte.** Lokal zehn Minuten ohne Tap: mit
  `archive_timeout=15s` Segmente zählen (erwartet: viele), mit der Umsetzung erneut zählen
  (erwartet: höchstens die aus Checkpoints und Sicherung). Beide Zahlen berichten.
- **Einzel-Tap:** Zeit bis zur Quittung messen; ungünstigster Fall ohne laufende Sicherung
  gegen die Regel aus D-065 (unter 70 % des Fensters, also unter 84 s).
- **Wächter an den Grenzen:** Sicherung läuft 9:59 / 10:01 Minuten; Sicherung seit
  Fenster − 1 / Fenster + 1 Sekunden beendet; Anforderung vor, während und nach der Sicherung;
  wartende Sicherung, die nie startet.
- **Abgleich:** Zähltest — null Fernaufrufe für quittierte Archive, unveränderter Weg ohne
  Quittung.
- **Aufholzeit:** Mit lokalen Zahlen abschätzen, wie lange der erste Durchlauf nach dem Deploy
  für rund 600 Segmente im Spool und rund 1.500 quittierte, noch nicht abgeglichene Archive
  braucht. Deutlich kennzeichnen, dass die Fernaufrufe gegen die Storage Box langsamer sind.
- Bestehende Rotnachweise, Infrastruktur- und Monitor-Tests, PITR, ShellCheck erneut grün.
- Unabhängiges read-only Review, höchstens zwei Runden. Nichts committen, nichts pushen.
  Review-Dateien nach `.t067-review/` (`tracked.diff`, `untracked.txt`, `report.md`).

## Danach

**T-065** (nur App): Kalender passt ganz auf den Bildschirm; schneller Offline-Start mit dem
Namen der angemeldeten Person; „Manuell starten" als Knopf unten auf Erfassen, die Seite
Manuell entfällt — Start, Pause, Fortsetzen, Stopp bleiben vollständig.
**T-066** (Backend, App, Web): Zeit nachtragen und Kommentar je Zeiteintrag nach D-067.
