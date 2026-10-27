# Aktuelle Aufgabe

> **Stand 27.10.2026:** T-135 auf main (`f384279`, mit Deploy 10). Der PO baut die Apps aus `c84dfc9`, danach
> Deploy 9 (Ziel `c84dfc9`) und Geräteabnahme. Jetzt **T-136**, danach T-137 (PLAN).

## T-136 · Sicherung unter Pilotlast messen (B13), ohne zu reparieren

**Für:** Development (Astra, Extra High) · **Risiko:** niedrig für die Produktion, weil nur lokal gemessen und nichts
am Produkt geändert wird. Inhaltlich zählt aber jede Zahl, auf ihr baut der Umbau auf · **Zeitbox:** zwei
Sitzungen. Reißt sie, gelten die bis dahin gemessenen Stufen, ehrlich gekennzeichnet.

**Anlass (TL-Lesung, nicht gemessen):**
- **Archiv je Datei:** Jede WAL-Datei wird ein eigenes Borg-Archiv `wal-<id>-<datei>`. Ohne `archive_timeout`
  (D-066) wechselt das Segment, sobald eine Archivanforderung offen ist. Im Pilot sind das Tausende Archive im Monat.
- **WAL bleibt lange liegen:** `retained_base_wal_floors` hält alle WAL ab der ältesten behaltenen Basis. Mit
  `BASE_BACKUP_KEEP_MONTHLY=6` ist das bis zu sechs Monate.
- **Viele Einzelaufrufe:**
  - `plan_restore_space` ruft `borg list` einmal je WAL-Archiv auf.
  - Die Aufbewahrung löscht jedes veraltete WAL-Archiv mit einem eigenen `borg delete`.
- **Zeitgrenze:** Die Wochenprobe darf höchstens 110 min laufen (`TimeoutStartSec`). Hält sie die Repository-Sperre,
  wartet der WAL-Archivierer. Damit verzögert sich die Archivbestätigung (D-153: „wird gesichert“).

### Umfang

1. **Lastmodell aus dem Code.** Wann entsteht ein Segment? Dafür zählen:
   - der Archivierer-Durchlauf;
   - die Wechselregeln;
   - die stündliche Basis;
   - Checkpoints.

   Daraus Segmente je Tag für die Profile „erwartet“ und „Spitze“ aus `tests/pilot-size/`, also frogs mit 200
   Lehrkräften. Annahmen offen nennen.
2. **Messen** mit lokalem, synthetischem Borg-Repository und den vorhandenen Werkzeugen aus dem Operations-Abbild:
   - Stufen 1, 3, 6 und 12 Monate nach Modell. Mindestens bis 20.000 WAL-Archive echt messen, darüber extrapolieren
     und die Extrapolation kenntlich machen.
   - Je Stufe:
     - Archivzahl;
     - Größe von Manifest und Repository;
     - Dauer je `borg create` für eine WAL-Datei;
     - `borg list`;
     - `plan_restore_space`, WAL-Extraktion, Aufbewahrung und `compact`;
     - Gesamtdauer der Wochenprobe gegen 110 min;
     - Zahl der Borg-Aufrufe je Lauf. Die Aufrufzahl ist der Hauptwert, weil die Storage Box je Aufruf langsamer ist
       als lokal.
   - Dazu Sperrkonflikte: Archivierer und stündliche Basis gleichzeitig mit Wochenprobe beziehungsweise Aufbewahrung.
     Gemessen wird die Wartezeit bis zur Archivbestätigung.
   - Den monatlichen Fall extra messen: die älteste Monatsbasis fällt weg, ein Monat WAL wird gelöscht.
3. **Befunde mit Vorschlag,** noch ohne Umsetzung. Zum Beispiel:
   - mehrere Archive in einem `borg delete`;
   - Größen aus einer Liste statt je Archiv;
   - WAL gebündelt;
   - kürzere WAL-Aufbewahrung.

   Je Vorschlag die Folgen für die Wiederherstellung (RESTORE.md, PITR) und den Aufwand. Der TL entscheidet danach
   über T-136b.

### Nachweis

- Messwerkzeug unter `tests/backup-scale/`: wiederholbar, räumt seine eigenen Daten auf, ohne Netz, mit README. Es
  wird nach `APPROVED` committet, wie `tests/pilot-size/`.
- Bericht `.t136-review/bericht.md` mit Lastmodell, Tabelle je Stufe, Sperrkonflikten, Befunden, Vorschlägen und den
  Grenzen der Messung (lokal statt Storage Box).
- Unabhängiges Review durch einen zweiten Agenten (AGENTS 4). Die bestehenden Betriebstests bleiben grün.

### Grenzen

- Nur lokal und nur synthetische Daten: kein Server, keine Storage Box, kein Supabase, keine Produktionsdaten.
- Kein Deploy, keine EAS-Builds, keine GHCR-Paketaktion. Nichts installieren und nichts ziehen (AGENTS 3), nur
  vorhandene Abbilder und Werkzeuge.
- Keine Änderung an `infrastructure/`.
- Kein Commit vor `APPROVED`.
