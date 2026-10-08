# Aktuelle Aufgabe

> **Stand 08.10.2026:** T-113 abgeschlossen (`2c9f7b8`). Danach T-114 („Erfassen“ auf einen Blick), dann Deploy 4 und
> neue App-Builds. Befunde aus dem PO-Test vom 07.10.

## T-112 · Karte einrichten zuverlässig, Signal erst bei Erfolg (D-132)

**Für:** Development · **Risiko:** hoch (NFC nativ auf iPhone und Android, neues iOS-Modul) · **Zeitbox:** zwei Sitzungen.
Nur App (`apps/mobile`, `modules/taptime-feedback`, `modules/taptime-nfc-diagnostics`); kein Server, keine Migration.

PO-Test 07.10. am iPhone: Etwa jede fünfte Einrichtung endete mit `write_failed`, obwohl die Karte vorher keine Zuordnung
hatte. Heute schließt das Apple-Fenster auch nach einem Fehlschlag mit Haken, und die Registrierung läuft erst danach.

### Auftrag

1. **Schreiben nur, wenn nötig, und dann geprüft.**
   - Enthält die Karte beim Erkennen schon genau `TAG_URI`, wird nicht geschrieben.
   - Sonst schreiben und mit echter Kartenabfrage nachlesen: iOS `ndefHandler.getNdefMessage`, nicht `getTag`;
     Android neu verbinden (`reconnectAfterWrite`) und `getNdefMessage`, nicht die gespeicherte Nachricht. Registriert
     wird nur nach passendem Inhalt.
   - Leere, formatierbare Android-Karten gelten nach erfolgreichem `formatNdef` als beschrieben.
   - Ein Fehler beim Trennen nach geprüftem Schreiben ist kein Fehlschlag (Absicherung; `RnNfcTagWriter.test.ts:143` dreht).
2. **iPhone: ein Apple-Fenster von der Karte bis „Karte zugeordnet“.** `IosNfcSession` besitzt die Sitzung und schließt
   sie genau einmal.
   - Nach dem Erkennen steht im Fenster „Karte wird eingerichtet. Nicht wegnehmen …“.
   - **Verbindung verloren** (Fehlerklassen 100, 101, 102, 104, 401): „Halte das iPhone wieder an dieselbe Karte.“,
     `restartTechnologyRequestIOS`, höchstens drei Mal. Eine andere Kennung wird abgewiesen, das Fenster sucht weiter.
   - **Erfolg erst nach der Server-Bestätigung:** `setAlertMessageIOS('Karte zugeordnet')`, dann schließen. Fehler über
     `invalidateSessionWithErrorIOS` mit der passenden Meldung.
   - **Zwei Zeitgrenzen:** 20 s bis zum Erkennen wie heute, danach 25 s für Schreiben und Registrieren. Ist das Budget
     aufgebraucht, schließt das Fenster neutral; die App wartet weiter und zeigt das Ergebnis.
3. **Eine gesendete Registrierung gewinnt.**
   - Ihr Ergebnis wird angezeigt, auch nach Apple „Abbrechen“, Zeitablauf, Hintergrund, Reiterwechsel
     (`AppNavigator.tsx:180`) oder der 2-s-Frist. „Nichts gesendet“ erscheint dann nie.
   - Bis zu einem endgültigen Ergebnis behält ein Wiederholen dieselbe Befehls-ID; sie ist gebunden an Mitgliedschaft,
     Kunde oder Pause, Bezeichnung und Kartenkennung (Muster `pendingCustomer`). Die Bezeichnung ist so lange gesperrt.
   - Vor dem Öffnen des Fensters wird geprüft, ob die App online ist; offline: „Zum Einrichten brauchst du eine
     Internetverbindung.“
4. **Signal erst bei echtem Erfolg (D-132).**
   - `taptime-feedback` bekommt iOS: Swift, gleiche Profile, Ton über die Audio-Kategorie `.ambient` (Stummschalter
     gilt). Das Signal spielt nach dem Schließen des Apple-Fensters.
   - Neues Signal „Karte zugeordnet“ beim Registrierungsergebnis (`AdminSetupCoordinator.ts:228/258`), nicht beim
     Endzustand. Fehler bekommen das Fehlersignal; Abbrechen durch die Person bekommt keins.
   - Erfassen per Karte: Die bestehende Zuordnung gilt jetzt auch am iPhone.
   - **Android ohne Systemton**, wo die App selbst liest (Erfassen, Einrichten, „Karte prüfen“): Lesemodus mit
     `FLAG_READER_NFC_A | FLAG_READER_NO_PLATFORM_SOUNDS`, aktiv bis Schreiben und Nachlesen fertig sind. Eine Karte zum
     Einrichten löst nie eine Zeiterfassung aus. Ohne gestarteten Scan bleibt alles wie heute.
5. **Bezeichnung vorbelegt.** Kundenname (auf 80 Zeichen gekürzt wie in `CustomerCreation`) bzw. „Pause“, änderbar. Ein
   Kundenwechsel ersetzt sie, solange sie nicht von Hand geändert wurde. „eindeutige“ entfällt aus dem Hinweistext.
6. **Diagnose:** iOS-Phasen für Schreiben, Nachlesen, Neuabfrage und Registrierung (Swift-Allowlist), ohne Inhalte.

### Tests

Je Punkt rot vor der Änderung.
- **Schreiber und Sitzung, simuliert:** schon beschriebene Karte, Verbindung verloren und dieselbe bzw. eine andere Karte,
  abweichendes Nachlesen, Trennfehler, Budget erschöpft während der Registrierung, Abbrechen nach dem Senden,
  Reiterwechsel, gleiche Befehls-ID beim Wiederholen.
- **Fenster:** schließt genau einmal, kein Haken bei Fehlern.
- **Signale:** nur beim Ergebnis, mit neuer, unterscheidbarer Art; Android-Lesemodus mit Flags, keine Erfassung beim
  Einrichten.
- **Volle App-Suite**, Typecheck, Begriffsprüfung.
- **PO am Gerät nach dem Build:** je 20 Einrichtungen am iPhone und am Android mit NTAG213. Dabei am iPhone dreimal
  bewusst zu früh wegnehmen; Karten werden über „Kunde löschen“ wieder frei. Bei einem Fehlschlag die Diagnose sichern.

### Nicht Teil

Server, Karte umhängen in der App, Erfassen ohne geöffnete App am iPhone (T-073), Abschluss des Apple-Fensters beim
Erfassen, Signal für manuelles Erfassen, „Erfassen“-Layout (T-114), Web.

### Bericht

`.t112-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2.
Kein Commit vor `APPROVED`. ADO nicht ändern.
