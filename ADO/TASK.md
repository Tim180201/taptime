# Aktuelle Aufgabe

> **Stand 06.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-102 und T-075 (Migrationen 043–048). T-098b wartet
> auf den PO am Mac (Brief: `git show 5071e6e:ADO/TASK.md`; Teil 2 geprüft auf dem lokalen Branch `t098b-verify`).
> Bis dahin T-106 (Analyse-Paket B02). Ausgeliefert wird beim nächsten Deploy ein ausdrücklich genannter Stand.

## T-106 · Plausibilität an der Servergrenze (B02, D-122)

**Für:** Development · **Risiko:** mittel bis hoch (Offline-Abgleich, Zeitregeln, Migration) · **Zeitbox:** eine
Sitzung. Befunde F-010, F-016, F-062, F-081, F-095, F-099; Einzelheiten nur lokal in `.audit-2026-09/` (D-103).

### Befund

Der Server prüft einige Eingaben weniger streng als die Oberflächen oder vergleichbare Wege: Zeitangaben aus dem Gerät,
Kalenderdaten in Zeitstempeln, Pflichtgründe aus unsichtbaren Zeichen, Korrektur und Prüfentscheidung ohne
Dauergrenze, und ein Ende in der Zukunft endet dort als Serverfehler statt als klare Ablehnung.

### Auftrag

1. **Gerätezeit (F-010):** Eine Erfassungszeit nach der Serverzeit plus der vorhandenen Toleranz wird nicht automatisch
   gebucht, sondern zum Prüffall mit dem bestehenden Grund `capture_time_out_of_bounds`, im Abgleich und in der Engine
   gleich. Kein Tap geht verloren, keine Evidenz wird umgeschrieben (D-055).
2. **Korrektur und Prüfentscheidung (F-016, F-062, D-122):** Ende in der Zukunft oder Dauer über 24 Stunden ergibt einen
   eigenen Rückgabestatus wie beim Nachtragen (`invalid_interval`), mit klarer Meldung in App und Web („Das Ende liegt
   in der Zukunft.“, „Höchstens 24 Stunden.“), vorab schon im Formular am Feld (Baustein aus T-101). Kein 503 mehr.
3. **Zeitstempel (F-081, F-099):** nur echte Kalenderdaten und immer mit Offset (`Z` oder `±hh:mm`); eine gemeinsame
   Prüfung in den Verträgen bzw. in `packages/core`, die der Server importiert statt eigener Kopien.
4. **Pflichtgründe (F-095):** Ein Grund oder eine Notiz nur aus Leer- oder Steuerzeichen (einschließlich Tab,
   Zeilenumbruch, geschütztem Leerzeichen) gilt als leer, in Vertrag und SQL gleich; Meldung am Feld.
5. **Installierte Apps:** Was sie heute senden und plausibel ist, bleibt angenommen. Eine unplausible Erfassung wird
   zum Prüffall, nicht abgewiesen.

### Tests

Je Befund rot vor der Änderung. Offline-Abgleich mit Zeit in der Zukunft → Prüffall, Ereignis erhalten, Nachfolger
laufen weiter. Korrektur 24 h → angenommen, 24 h + 1 min und Ende in der Zukunft → Status, kein 503. `2026-02-30…` und
Zeit ohne Offset abgelehnt. Grund aus ` \t` abgelehnt. Zeitumstellung (Oktober). Volle Suiten einschließlich aller
Suiten, die Migrationen nachspielen (Lehre T-086 und T-075), Typechecks.

### Nicht Teil

Neue Prüfgründe, wo ein bestehender passt; Änderungen an Rechten; Lohnexport (B01).

### Bericht

`.t106-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
