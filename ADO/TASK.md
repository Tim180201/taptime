# Aktuelle Aufgabe

> **Stand 24.09.2026:** Produktion auf `ff69bfe`. Auf `main` bis `b635c4a`: T-072, T-031 und T-074, alle APPROVED.
> Der PO fuehrt Konsole (Controller) und Deploy `b635c4a` selbst aus; diese Aufgabe laeuft parallel und
> betrifft nur die App. Reihenfolge: **T-072b → T-076 → T-024 → Pilot Monat 1**. Fruehere Briefs stehen in
> der Git-Historie.

## T-072b · iPhone: gelesener Tag geht beim Schließen der Apple-Sitzung verloren

**Für:** Development · **Risiko:** Tag-Identität, Exklusivität der NFC-Sitzung, Plattformgleichheit
**Zeitbox:** eine Sitzung; Reihenfolge Beleg → Tests rot → Korrektur → Diagnose → Nachweis.
**Grundlage:** T-072, D-058, ADR-0009, ADR-0017.

### Befund (Geräteabnahme PO, 23./24.09., TestFlight 1.0.0 (1))

- iPhone, Admin-Konto, zugeordneter Tag: „Tag scannen" → Apple-Fenster → Tag hinhalten → **blauer Haken**
  → App zeigt „NFC nicht verfügbar / Die Scan-Funktion ist derzeit nicht verfügbar." Reproduzierbar, auch
  nach App-Neustart. Beim Server kommt nichts an. Android unauffällig.
- Analyse Technical Lead (am Code, nicht am Gerät belegt): Der Haken erscheint, wenn die App
  `invalidateSession` aufruft, also nach `IosNfcSession.finish()`. `cancelTechnologyRequest` hat damit eine
  lebende Sitzung beendet (nativ `tagSession = nil`, Rückmeldung ohne Fehler). Übrig bleibt der
  2-Sekunden-Aufräumtimer in `finish()`: Er macht aus `captured` ein `unavailable`, wenn `settleIfDrained`
  nicht rechtzeitig fertig ist, weil `closed` erst mit dem Ereignis `NfcManagerSessionClosed` wahr wird.
  Offen ist, ob das Ereignis zu spät kommt (Apple ruft `didInvalidateWithError` womöglich erst nach der
  Haken-Animation) oder gar nicht (RN 0.86, Legacy-`RCTEventEmitter` über die Interop-Schicht).
- Wichtig für die Korrektur: `didInvalidateWithError` der alten Sitzung ruft nativ `[self reset]` und
  würde eine inzwischen gestartete neue Sitzung zerstören (`tagSession`, `techRequestCallback`). Die
  Exklusivität darf deshalb nicht einfach wegfallen.
- „Tag zuordnen" auf dem iPhone nutzt denselben Weg (`scanWithTagAction`): Der Tag wird beschrieben, dann
  wird das Ergebnis `unavailable`, und die Zuordnung am Server findet nicht statt.

### Auftrag

1. **Erst belegen (Stop-Regel):** An `react-native-nfc-manager` 3.17.2 (iOS) und React Native 0.86
   (Interop für `RCTEventEmitter`, Listener-Zählung, Ereigniszustellung) belegen, ob und wann
   `NfcManagerSessionClosed` nach `invalidateSession` in JS ankommt. Ist die Analyse oben falsch: stoppen
   und melden.
2. **Ergebnis und Aufräumen trennen:** Ein gelesener Tag wird ausgeliefert, sobald Lesen (und bei
   `scanWithTagAction` die Aktion) abgeschlossen und `cancelTechnologyRequest` erfolgreich war. Die
   Sitzung bleibt belegt, bis `SessionClosed` kommt oder eine begründete längere Frist abläuft. Ein Scan in
   dieser Zeit bekommt einen verständlichen Hinweis oder wartet kurz, zerstört aber nie eine Sitzung.
   Schlägt `cancelTechnologyRequest` fehl, bleibt die heutige Regel (kein Ergebnis ohne gesicherten
   Sitzungsabbau) — oder begründet anders.
3. **Diagnose ohne Geheimnisse:** Schlanke iOS-Lebenszyklusmeldungen mit festem Präfix `TapturaNfc`
   (angefordert, verbunden, gelesen, Aktion fertig, Abbruch ok/fehlgeschlagen, SessionClosed mit
   Fehlercode, Frist abgelaufen; Millisekunden relativ zum Start), sichtbar in der macOS-Konsole im
   Release-Build. Keine UID, kein Tag-Inhalt, keine Tokens, keine Konto- oder Betriebs-IDs.
4. **Tag zuordnen auf dem iPhone:** Anzeige und Wirkung stimmen überein (Zuordnung erfolgt ↔ Erfolg).
5. Android bytegleich.

### Tests

Realistische Reihenfolgen mit gefälschter Uhr: SessionClosed nach 3 s; SessionClosed nie;
SessionClosed vor der Abbruch-Rückmeldung; Abbruch schlägt fehl; zweiter Scan in der Aufräumphase;
spätes `didInvalidate` der alten Sitzung darf keine neue Sitzung zerstören; `scanWithTagAction` mit
Erfolg. Bestehende Suiten beider Plattformen, Typecheck, Prüfung des erzeugten iOS-Projekts.

### Nicht Teil

Kein Server, keine Tag-Identität, kein Hintergrund-Lesen (T-073), kein Kontowechsel (T-076), keine
Änderung an der Bibliothek selbst ohne Stop-Meldung, kein Build/Submit durch Codex, kein Deploy.

### Bericht

`.t072b-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit, kein Push.
Danach baut der PO `eas build -p ios --profile production-validation` und reicht über TestFlight ein.
