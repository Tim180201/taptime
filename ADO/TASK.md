# Aktuelle Aufgabe

> **Stand 29.10.2026:** `05bcf51` ist der Stand für den gemeinsamen Deploy (Deploy 9 und 10 zusammen, PO 29.10.).
> App-Builds grün: iPhone Build 11, Android Version 18. Beim ersten Gerätetest gefunden: T-139.

## T-139 · Android: Karte startet die Zeit bei geschlossener App nicht

**Für:** Development (Astra, Extra High) · **Risiko:** hoch. Eine geschlossene App ist im Pilot der Normalfall (P1).
Die Prüfung, die hier greift, schützt die Zuordnung einer Karte zur richtigen Sitzung (D-043). Deshalb ist ein
unabhängiges Review nötig (AGENTS 4) · **Zeitbox:** eine Sitzung.

**Befund (PO 29.10.):**
- Gerät: Android, Version 18 aus `05bcf51`, noch gegen den Server `e577fa8`.
- Die App ist aus den zuletzt genutzten Apps weggewischt. Beim Antippen der Karte öffnet sich „Erfassen“ ohne Meldung,
  und es startet keine Zeit.
- Ein zweites Antippen bei offener App startet die Zeit. Das war bei jedem Versuch so.

**Vermutung TL (nicht belegt):**
- `NativeNfcIngressLifecycle.tick()` verwirft die Karte still mit `clear()`, wenn `captureNativeNfcIngressAuthority`
  `null` liefert.
- Beim Kaltstart gilt die Karte nur über `startedCurrentRuntime`. Das verlangt
  `authority.generation === nativeNfcIngressRuntimeStartGeneration`.
- Die Startgeneration wird beim Start des Lebenszyklus gebunden. Jede spätere Sitzungsänderung erhöht `generation`
  (Wiederherstellung, Token-Erneuerung, nach T-104e womöglich auch der Abgleich des Sperrbildschirms beim Start). Neu
  gebunden wird nur in `renewOfflineGrant`.
- Siehe auch den P3 aus T-121 in STATUS: Ein Token-Refresh verschiebt die Zeitgrenze.

### Umfang

1. **Ursache belegen, zuerst rot:**
   - Ein Test stellt den Kaltstart in der tatsächlichen Reihenfolge nach: Prozessstart mit Karte, Wiederherstellung der
     Sitzung, gegebenenfalls Token- und Freigabe-Erneuerung, dann die Verarbeitung.
   - Ist `adb` vorhanden und schließt der PO das Handy per USB an, darf `logcat` gelesen werden. Nichts installieren.
2. **Beheben, ohne D-043 aufzuweichen.** Eine Karte aus dem Prozessstart gilt, wenn alles davon stimmt: derselbe
   Prozess, derselbe Boot, dieselbe Sitzung (Konto, Mitgliedschaft, Betrieb) und keine Abmeldung dazwischen. Eine
   reine Erneuerung von Token oder Freigabe in derselben Sitzung verwirft sie nicht mehr. Ein Konto- oder
   Sitzungswechsel, eine Abmeldung und ein anderer Boot verwerfen sie weiterhin.
3. **Nie mehr still verwerfen:** Wird eine Karte verworfen, zeigt „Erfassen“ einen kurzen Hinweis mit der Bitte, die
   Karte noch einmal anzutippen. Es wird nichts gebucht.
4. **Gegenprobe:** Die App im Hintergrund (`activity_delivery_intent`) und die geöffnete App funktionieren unverändert.
   Keine Serveränderung, iOS unverändert.

### Tests und Nachweis

- Rot zuerst, dann grün. Abgedeckte Kaltstarts:
  - mit Wiederherstellung;
  - mit Token-Erneuerung;
  - mit Freigabe-Erneuerung;
  - mit Abgleich des Sperrbildschirms;
  - mit Kontowechsel (verwirft, mit Hinweis);
  - mit anderem Boot (verwirft);
  - ohne Netz mit gültiger Offline-Freigabe.
- Android-Release-Build lokal, die ganze CI lokal nachgebaut.
- Bericht `.t139-review/bericht.md` mit kurzer Prüfliste für den PO: geschlossene App, App im Hintergrund, nach
  Neustart, morgens als Erstes.

### Grenzen

- Kein Deploy, keine EAS-Builds, kein Server, kein Supabase, keine GHCR-Paketaktion, nichts installieren (AGENTS 3).
- Kein Commit vor `APPROVED`.
