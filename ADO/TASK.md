# Aktuelle Aufgabe

> **Stand 27.10.2026:** T-136 gemessen (Werkzeug `tests/backup-scale/`). Jetzt **T-136b**, mit Deploy 10 zusammen
> mit T-135. Deploy 9 bleibt bei `c84dfc9`. Danach T-137 (PLAN).

## T-136b · Sicherung: Belegprüfung reparieren, veraltete Archive gesammelt löschen

**Für:** Development (Astra, Extra High) · **Risiko:** hoch. Sicherung und Wiederherstellung sind betroffen, und
in der Produktion läuft dann zum ersten Mal seit Wochen die Aufbewahrung mit einem großen Rückstand.
Unabhängiges Review (AGENTS 4) · **Zeitbox:** zwei Sitzungen, nichts wird geschnitten.

**Befund (T-136, vom TL mit PostgreSQL 17.10 bestätigt):**
- `production_base_is_registered` (`taptime-restore-verify`) ruft `psql --tuples-only --no-align` mit
  `SET ROLE …; SELECT EXISTS …` ohne `--quiet` auf. Seit PostgreSQL 15 lautet die Ausgabe `SET\nt`, verlangt wird `t`.
- Deshalb wird die Aufbewahrung immer zurückgestellt. Die Wochenprobe scheitert, sobald acht Tage lang keine
  Aufbewahrung gelungen ist.
- Die Tests verdecken das, weil sie die SQL-Ausgabe nachbilden.
- **Folge:** In der Produktion wachsen vermutlich Basen und WAL-Archive ohne Aufbewahrung. Der Rückstand wird beim
  Deploy 10 an der Konsole gezählt.
- Die erste gelungene Aufbewahrung löscht heute jedes WAL-Archiv einzeln, unter der gemeinsamen Sperre. Lokal dauerte
  das für 4.089 Archive 992 s, an der Storage Box ist es langsamer. In dieser Zeit warten Archivierer und stündliche
  Basis.

### Umfang

1. **P1 beheben:**
   - Die Belegprüfung liest genau einen Wert.
   - Alle `psql`-Auswertungen in `infrastructure/backup/` und `infrastructure/monitoring/` werden auf dasselbe Muster
     geprüft: mehrere Befehle in `--command` und ausgewertete Ausgabe. Betroffene Stellen werden mitkorrigiert und im
     Bericht aufgelistet.
   - Regressionstest mit echtem PostgreSQL 17 und echter `psql`-Ausgabe, ohne nachgebildete SQL-Ausgabe: Beleg
     vorhanden, Beleg fehlt, Funktion fehlt.
2. **Gesammelt löschen:**
   - Dieselbe Auswahl und dieselben Timeline-Untergrenzen wie heute.
   - Ein `borg delete` je Block mit exakt benannten Archiven, kein Glob. Die Blockgröße richtet sich nach der
     Argumentgrenze und ist begründet.
   - Prüfmarker ebenso. Am Ende einmal `compact`.
   - Bei einem Fehler stoppen, ohne einen weiteren Block.
   - Syntax und Fehlerverhalten mit der Produktionsversion von Borg belegen. Der PO liest `borg --version` an der
     Konsole ab; bis dahin gilt 1.2.8.
3. **Rückstand sicher abbauen:**
   - Die Arbeit unter der Sperre ist je Lauf zeitlich begrenzt. Vorschlag: 10 min; nur ganze Blöcke; der Rest folgt im
     nächsten Lauf.
   - Der Aufbewahrungsstatus zeigt Teilfortschritt ehrlich an. „Erfolg“ heißt vollständig.
   - Überwachung und Wochenprobe bleiben konsistent: Ein Teilfortschritt ist kein Erfolg. Ohne Erfolg in acht Tagen
     bleibt die Wochenprobe rot.
   - Die Alarmgrenzen für „Sicherung läuft seit …“ passen zur Begrenzung.
4. **Runbook:**
   - RESTORE.md und MONITORING.md beschreiben das Verhalten beim ersten Lauf nach dem Deploy und wie man den Fortschritt
     liest.
   - DEPLOY.md nennt die PO-Schritte für Deploy 10: Rückstand vorher zählen, erste Aufbewahrung beobachten, keine
     Geheimnisse anzeigen.

### Nachweis

- Bestehende Betriebstests grün. Wo Tests die SQL-Ausgabe nachbilden, kommt mindestens ein echter Pfad dazu.
- Messung mit `tests/backup-scale/` und Borg im Wegwerf-Container (PO-Freigabe wie in T-136):
  - Wochenprobe bei 20.000 WAL-Archiven grün und unter 110 min;
  - Rückstand mit mindestens 20.000 zu löschenden WAL-Archiven und 300 Basen: Dauer je Lauf, Zahl der Läufe bis
    „vollständig“, Wartezeit von Archivierer und stündlicher Basis;
  - eine Wiederherstellung (PITR) nach dem Abbau grün.
- Die ganze CI lokal nachbauen. Bericht `.t136b-review/bericht.md`.

### Grenzen

- Kein Server, keine Storage Box, kein Supabase, kein Deploy, keine EAS-Builds, keine GHCR-Paketaktion.
- Nichts installieren außer im freigegebenen Wegwerf-Container.
- Kein Commit vor `APPROVED`.
