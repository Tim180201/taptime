# Aktuelle Aufgabe

> **Stand 10.11.2026:**
> - T-141 bis T-145 sind auf main (`62266b4`). Die Geräteprüfung hat der PO am 10.11. bestanden:
>   - Initialen auf dem Sperrbildschirm;
>   - iPhone-Knöpfe nach Face ID, auch bei geschlossener App (D-161);
>   - „Meine Zeiten“ am iPhone sofort, am Android 0,85–1,5 s.
> - Jetzt T-144, danach T-055. Beide kommen zusammen in einen Deploy.

## T-144 · WAL-Fehlalarm bei Wiederanlauf, Rechtstexte zu D-160 und D-161

**Für:** Development (Astra, Extra High) · **Risiko:** mittel. Es geht um Sicherung und Überwachung. Beides darf nicht
blinder werden · **Zeitbox:** eine Sitzung.

### Teil 1 · WAL-Fehlalarm (PO 09.11.)

**Befund:**
- Am 09.11. um 13:48 UTC kam „WAL-Archivierung steht: WAL-Segment wartet seit 2 min“, kurz nach der ersten Erfassung
  seit Tagen. Danach war der Status wieder `ok`, es gingen keine Daten verloren.
- Durchläufe mit Upload dauern 60–61 s, davon `base_seconds` 47–48. Am 31.10. waren es 55–57 s.
- Die Wartegrenze ist `WAL_ARCHIVE_INTERVAL_SECONDS` × `WAL_ARCHIVE_MISSED_CYCLES` = 2 × 60 s.

**Spur des TL:** Nach jedem Upload ruft `taptime-wal-archiver` `latest_base_has_offsite_start_wal` auf. Das macht drei
`borg extract --stdout` aus der neuesten Basis und ein `borg info`, jeweils über die Storage Box. Die Werte einer Basis
ändern sich nie, werden aber in jedem Durchlauf neu gelesen.

**Umfang:**
1. **Messen:** Die Basisphase in einen Zeitanteil je Borg-Aufruf zerlegen, mit dem vorhandenen Werkzeug
   `tests/backup-scale/` oder einem gleichwertigen lokalen Aufbau.
2. **Die Basisphase verkürzen, ohne Prüfungen wegzulassen.** Die Werte einer unveränderlichen Basis werden einmal je
   Basis gelesen und an ihren Archivnamen gebunden. Erst eine neue Basis liest neu. Wo dieser Wert liegt und wer ihn
   anlegt, ändert und entfernt, benennt Codex (AGENTS 1.5). Was falsch oder fremd ist, löst wie bisher einen Fehler aus.
3. **Reicht das nicht** für einen Durchlauf deutlich unter dem Intervall, wird die Grenze des Monitors aus Intervall und
   gemessener Durchlaufdauer abgeleitet, nicht aus einer neuen festen Zahl (AGENTS 1.6). Ein echter Stillstand meldet
   weiter.
4. **`infrastructure/MONITORING.md`** und, falls nötig, **`RESTORE.md`** werden im selben Commit angepasst (AGENTS 7).

### Teil 2 · Rechtstexte an D-160 und D-161 angleichen

Betroffen sind `ADO/06_Recht/Beschaeftigten_Information_Art13.md`, `Verzeichnis_Verarbeitungstaetigkeiten.md`,
`AVV_Anlagen.md`, `docs/store/privacy.md` und in `acceptance.yml` nur das Kriterium LK-8:
- **Android:** Pause, Weiter und Beenden vom Sperrbildschirm ohne Entsperren.
- **iPhone:** nur bei entsperrtem Gerät (Face ID oder Code). Die App öffnet sich dabei nicht.
- **`AVV_Anlagen.md`:** Hier stehen noch Kundennamen auf dem Sperrbildschirm. Das wird nach D-160 korrigiert: Kunden
  nur mit Initialen.
- **`acceptance.yml`** (Abnahmekriterien des PO, 10.11.): LK-8 verspricht „ohne Entsperren“ für beide Systeme. Titel und
  Beschreibung nach D-161 je System fassen. ID, `verification` und `confirmedBy` bleiben, alle anderen Kriterien auch.

Leser mit `grep` suchen und ausführen (T-134).

### Tests und Nachweis

- **Zuerst rot:** Ein Test belegt, dass heute jeder Durchlauf mit Upload die drei Extrakte erneut liest.
- **Danach:** Gleiche Basis bedeutet keine Extrakte. Eine neue Basis liest einmal neu. Sind die Werte falsch, beschädigt
  oder fremd, gibt es einen Fehler wie bisher.
- **Monitor-Tests:** Ein gesunder Durchlauf mit Upload meldet nicht. Stillstand, fehlendes Lebenszeichen und Lücke
  melden wie bisher.
- **Messung vorher und nachher** im Bericht.
- **Builds und CI:** Betriebsskripte, ShellCheck und PITR grün, ganze CI lokal nachgebaut.
- **Bericht:** `.t144-review/bericht.md` mit den PO-Schritten für den Deploy nach `infrastructure/DEPLOY.md`, zum
  Beispiel ob der Controller vorher an der Konsole installiert werden muss.

### Grenzen

- Kein Deploy, kein Server, kein Supabase, keine GHCR-Paketaktion, nichts installieren (AGENTS 3).
- Kein Commit vor `APPROVED`.
