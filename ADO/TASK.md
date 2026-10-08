# Aktuelle Aufgabe

> **Stand 08.10.2026:** T-109 und T-112 bis T-114 abgeschlossen (zuletzt `af86406`). Befund des PO vom 08.10.: Die App
> bleibt beim Öffnen manchmal bei „derzeit nicht verfügbar“ stehen, bis man sie beendet. T-115 behebt das vor den
> App-Builds (D-133). Deploy 4 ist davon unabhängig.

## T-115 · App öffnet immer, auch nach dem Sperren (D-133)

**Für:** Development · **Risiko:** hoch (Anmeldung, sicherer Speicher, Offline-Schutz) · **Zeitbox:** eine Sitzung.
Nur `apps/mobile`; kein Server, keine Migration, keine neue Berechtigung.

### Befund und Ursache

PO 08.10.: Beim Öffnen steht immer wieder „Taptura ist derzeit nicht verfügbar.“; nur Beenden und neu Öffnen hilft.
Ziel 0 von 10. TL-Analyse mit unabhängiger Prüfung (Zeilen Stand `066fe21`), von dir aus den installierten Quellen zu
belegen; Abweichungen in den Bericht, die Regeln gelten trotzdem:

1. **Hauptweg.** `expo-background-task` plant unter iOS einen `BGProcessingTask`
   (`com.expo.modules.backgroundtask.processing`). iOS startet die App dafür im Hintergrund, meist bei gesperrtem Handy.
   Die Expo-AppDelegate hängt die React-Wurzel trotzdem ein, also läuft `DefaultProductMobileRuntime.start()` mit
   `AppState` `background`. Alle Schlüsselbund-Einträge sind `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, das Lesen wirft.
   `MobileSessionCoordinator.performRefresh` macht daraus `runtime_unavailable` (633, 648). Dieser Zustand ist endgültig:
   `start()` tut danach nichts (170–172), `retryContext` wirkt nur bei `context_unavailable`, und `AppNavigator.tsx:126`
   hat keinen Knopf. Der Prozess bleibt im Speicher, und beim späteren Öffnen steht die Meldung.
2. **Nebenwege** (melden ab, passen also nicht zu „Neustart hilft“, trotzdem beheben):
   - Eine geweckte App erneuert nach 401 das Token. Das Schreiben in `onProviderEvent` (835–839) scheitert, und
     `handleStorageFailure` ruft `signOutLocal`; das beendet die Sitzung auch beim Server.
   - Ohne Erneuerung: `retryContext` → `resolveBackendContext` → `writeIdentity` scheitert (741–745).
3. **Offline-Teil.** Daraus wird `local_evidence_protected` mit der Klasse sichere Identität
   (`OfflineCaptureCoordinator.ts:500–507`). Das heilt sich schon heute beim Wechsel des Kontos von leer auf gesetzt.
   Es wird nichts gespeichert und kein Schlüssel und keine Datenbank neu angelegt. Der gescheiterte Versuch verbraucht
   aber `firstOpen` (`OfflineAccountStorage.ts:54`), sodass ein Wiederholen Waisenreparatur und Aufräumen überspringt;
   im Bericht festhalten.

### Auftrag (D-133)

1. **iOS: kein Hintergrundauftrag, kein Start im Hintergrund.**
   - iOS registriert den Offline-Hintergrundauftrag nicht mehr und entfernt beim Start eine alte Registrierung.
   - Startet der Prozess ohne Vordergrund (etwa beim Vorwärmen), beginnt `DefaultProductMobileRuntime.start()` erst mit
     dem ersten **Wechsel** nach `active`. Nicht `currentState` prüfen, denn ein normaler Kaltstart kann zuerst
     `inactive` melden.
   - Bis dahin zeigt die App „Sitzung wird sicher wiederhergestellt …“.
   - Android bleibt unverändert (WorkManager ohne Oberfläche, Startabsicht-Fenster, Ingress).
2. **Kein endgültiger Fehlerzustand.**
   - Neu versucht werden: `runtime_unavailable`, `startFailed` in `ProductMobileApp` und beim Start entstandener
     Offline-Schutz der Klasse sichere Identität. Das geschieht bei jeder Rückkehr nach `active` und per Knopf „Erneut
     versuchen“.
   - Ein `active` ohne Fehlerzustand löst nichts aus, etwa nach jedem Apple-NFC-Fenster.
   - Die Sitzung läuft dabei über `initializing` → `performStart`, nie über `refresh()`. Das würde die bestätigte
     Identität nicht laden (644–657), und `enqueueTokenWrite` löschte sie (899).
   - Die Laufzeit nur im Fehlerzustand über `stop()` + `start()`.
   - Integritätsfehler im Offline-Teil (falscher Schlüssel, Besitzer, Migration) bleiben unverändert.
   - Während des Versuchs steht der Wiederherstellungstext. Erfolg führt ohne Neustart in den Normalzustand, die
     Erfassungen bleiben.
   - Die Texte dieser Zustände verlangen keinen Neustart mehr; NFC-Texte sind nicht Teil.
3. **Schreibfehler bei der Erneuerung desselben bestätigten Kontos.**
   - Die Sitzung bleibt im Speicher gültig: kein Löschen, kein `signOutLocal`.
   - Speichern wird bei `active` mit Rückzug wiederholt, nur das neueste Token, geprüft gegen Generation und
     Token-Stand.
   - Solange ein Speichern aussteht, gibt es keine weitere Erneuerung. Sonst liegt ein zwei Schritte altes Token im
     Schlüsselbund, und Supabase verwirft beim nächsten Kaltstart die Sitzung.
   - Scheitert es im Vordergrund wiederholt, folgt ein Fehlerzustand mit Knopf.
   - Anmeldung, Abmelden, Kontowechsel und abgelehnte Sitzungen bleiben streng, aber ohne `runtime_unavailable`: die
     Anmeldung nach Punkt 5, sonst gesperrt mit Knopf und neuem Versuch bei `active`.
4. **iOS im Hintergrund: nichts an der Sitzung.**
   - In `background` keine Erneuerung (`renewAfterUnauthorized`, `retryContext` → `refresh()`) und kein Schreiben (auch
     nicht `writeIdentity`); beides wartet auf `active`.
   - Eine Anfrage mit abgelaufenem Token endet als „nicht verfügbar“.
   - `inactive` (Apple-NFC-Fenster, T-112) gilt nicht als Hintergrund. Android bleibt unverändert.
5. **Anmeldefehler bleiben auf der Anmeldeseite.**
   - Gilt bei einem Anbieterfehler (473–475) und bei einem Speicherfehler während der Anmeldung (461–465, 487–491).
   - Dafür gibt es einen neuen Grund für `unauthenticated` (`contracts.ts`).
   - Text: „Anmeldung gerade nicht möglich. Prüfe die Verbindung und versuche es erneut.“ Er ersetzt den Text in
     `LoginScreen.tsx:45–49`.
6. **Zuhörer isolieren.** Eine Ausnahme in einem Zuhörer von `setState` bricht den Ablauf nicht ab (heute: `catch` in
   `performStart` 219–222).
7. **Fehlercode.** Jeder verbleibende Fehlerzustand zeigt klein einen Code für den Ort, etwa „Code S2“. Das Verzeichnis
   steht im Bericht. Kein Inhalt, kein Token, keine E-Mail.

### Tests

Je Punkt rot vor der Änderung.
- iOS `background` → `inactive` → `active` mit werfendem Schlüsselbund: vor `active` kein Lesen, danach angemeldet und
  der Offline-Teil bereit, ohne neuen Prozess.
- Kaltstart mit zuerst `inactive` startet normal.
- iOS registriert keinen Auftrag und entfernt einen alten; Android unverändert.
- Gescheiterter Start (Sitzung, Laufzeit, Offline-Schutz) erholt sich bei `active` und per Knopf. Die Identität und die
  Offline-Wiederherstellung bleiben; `active` im Normalzustand bewirkt nichts.
- Schreibfehler bei der Erneuerung: Sitzung bleibt, kein Löschen, kein `signOutLocal`, Wiederholung bei `active`, keine
  zweite Erneuerung, solange das Speichern aussteht.
- iOS `background`: 401 und `retryContext` ohne Erneuerung und ohne `writeIdentity`.
- Anmeldung mit Anbieter- und mit Speicherfehler.
- Abmelden und Kontowechsel bei scheiterndem Löschen.
- Werfender Zuhörer.
- Bestehende Fail-closed-Tests anpassen und im Bericht begründen: `tests/auth/MobileSessionCoordinator.test.ts:368–401`,
  `581–597`, `642–664` (zweite Hälfte), `701–711`; gegebenenfalls `tests/navigation/offlineCaptureShell.test.ts:26`.
- Volle App-Suite, Typecheck, Begriffsprüfung; Android-Ingress- und Kaltstarttests unverändert grün.
- PO am iPhone nach dem Build: einmal über Nacht gesperrt am Ladekabel mit WLAN, dazu zehnmal nach mehr als einer
  Stunde Sperre öffnen. 0 von 10; ein Code wird mit Foto gemeldet.

### Nicht Teil, Risiken

- Nicht Teil:
  - Die Schutzklasse des Schlüsselbunds (`AFTER_FIRST_UNLOCK` bräuchte Löschen und Neuanlegen und ist eine eigene
    Sicherheitsentscheidung).
  - Der Hintergrundabgleich unter iOS.
  - Server, NFC, andere Bildschirme.
- Für den Bericht:
  - iOS meldet beim Löschen keine Fehler, weil `SecItemDelete` nicht geprüft wird. Die Löschfehler-Zweige betreffen
    also nur Android.
  - Der Abmelde-Takt beim Archivwarten (`DefaultProductMobileRuntime.ts:352`) muss unter iOS nach Punkt 4 auf `active`
    warten.

### Bericht

`.t115-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2.
Kein Commit vor `APPROVED`. ADO nicht ändern.
