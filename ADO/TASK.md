# Aktuelle Aufgabe

> **Stand 21.10.2026:** T-104b (`c332b91`) und T-104d (`a76630c`) abgeschlossen; Android ist fertig. Jetzt **T-104c**;
> T-132 (Sicherung, Brief folgt nach Messung) wird vorgezogen, sobald sein Brief steht; T-133 (Runbook) klein
> dazwischen. Ausgeliefert wird mit Deploy 8 und neuen App-Builds. Ohne Verbindung des TL zum Mac legt Codex den
> geprüften Stand nach PO-Freigabe als Zweig `review/<aufgabe>` ab (STATUS).

## T-104c · Sperrbildschirm iPhone (D-114, D-133, D-146 bis D-148)

**Für:** Development · **Risiko:** hoch (neue App-Erweiterung, Start der App im Hintergrund, D-133) · **Zeitbox:** eine
Sitzung; reicht sie nicht, Umfang schneiden und melden. Unabhängiges Review. Beginnt jetzt. Server (T-104a) und
Android (T-104b, T-104d) sind fertig. Die JS-Seite aus T-104b (`LockScreenCoordinator`, `issueCapability`) wird über
einen iOS-Port wiederverwendet: Abgleich vor jeder Aktion, „Wird übertragen …“ nach eigener Erfassung, kein
automatisches Ausführen, ein 401 beim Ausstellen meldet nie ab.

### Was man sieht (D-148, Entwurf vom 21.10.)

Live-Aktivität auf dem Sperrbildschirm: Grund `#0E1512`, farbiges Zeichen, Ziel und Zustand in Manrope, Dauer groß in
Lime `#C9F24D` (läuft mit). Knöpfe „Pause starten“ bzw. „Pause beenden“ zurückhaltend (`#1A2320`, Linie `#24302C`) und
„Zeit beenden“ in Lime mit Schrift `#0E1512`. Pause: „Pause seit 08:30“ in Mint `#7EE0C0`, Dauer steht („1:06 h
gearbeitet“). Hinweise und „Zeit beendet · 3:42 h“ mit denselben Texten wie T-104d. Dynamic Island: kompakt Zeichen und
Dauer in Lime, minimal das Zeichen, erweitert Ziel, Dauer und Knöpfe. iOS 16.4 bis 16.x ohne Knöpfe. Antippen öffnet
immer „Erfassen“.

### Umfang

1. **Erweiterung:** Widget-Extension (SwiftUI, ActivityKit) per Config-Plugin, verträglich mit Expo SDK 57 und EAS.
   `@bacons/apple-targets` nur exakt in Version 5.0.0 (6.0.0 für SDK 57 ist noch nicht veröffentlicht) und nur, wenn
   `expo prebuild -p ios` und `xcodebuild` (App und Erweiterung, Simulator, ohne Signatur) sauber laufen; sonst ein
   eigenes kleines Plugin. `expo-widgets` passt nicht: Knöpfe können dort keine Netzwerkaufrufe machen. Manrope wird in
   der Erweiterung mitgeliefert. Bundle-ID `com.tim180201.mobile.<Name>`; die Erweiterung steht für EAS unter
   `extra.eas.build.experimental.ios.appExtensions`. Alle Varianten teilen eine iOS-App; das URL-Schema kommt aus der
   Variante (`taptime`, `taptime-validation`, `taptime-production-validation`). `NSSupportsLiveActivities`.
2. **Knöpfe ab iOS 17:** `Button(intent:)` mit `LiveActivityIntent`. `perform()` läuft im App-Prozess; das System
   startet die App dafür gegebenenfalls im Hintergrund. Nativer Aufruf von `/v1/lock-screen/action` mit denselben
   Kopfzeilen, Befehls-IDs, Fehlerzuordnungen und Zuständen wie T-104b, „Erneut senden“ mit derselben ID; Anzeige über
   `Activity.update` aus der Antwort.
3. **D-133 bleibt wörtlich:** Ein Start der App für die Aktion berührt weder JavaScript-Sitzung noch Anmeldung (die
   Startreihenfolge aus T-115 wartet auf den Vordergrund) und schreibt nichts in den Schlüsselbund. Der Schlüssel liegt
   in einem eigenen Eintrag „nach erster Entsperrung“, geschrieben nur von der App im Vordergrund. Veränderlicher Stand
   (offener Befehl, Anzeige, Ablauf) in einer Datei mit Schutzklasse „bis zur ersten Entsperrung“, von der Sicherung
   ausgeschlossen. Test oder Rotnachweis dafür.
4. **Lebenszyklus (AGENTS 1.5):** Anlegen nur durch die App im Vordergrund bei eigener laufender Zeit (ActivityKit
   erlaubt den Start nur dort). Ändern durch die App im Vordergrund und durch den Knopf. Entfernen: Zeit beendet
   („Zeit beendet“ 10 s, dann weg), 401 oder Ablauf, Abmelden, Kontowechsel, abgewiesene Sitzung, keine laufende Zeit
   beim Öffnen. iOS beendet eine Live-Aktivität nach höchstens 8 Stunden selbst; beim nächsten Öffnen startet die App
   sie neu. Unter iOS gleicht die App nur im Vordergrund ab: nach eigener Erfassung bleibt „Wird übertragen …“, bis die
   App wieder offen ist.
5. **App-Seite:** iOS-Port des Sperrbildschirm-Moduls; Android bleibt unverändert. Keine Erlaubnisabfrage
   (Live-Aktivitäten brauchen keine Mitteilungs-Erlaubnis); sind sie in den Einstellungen aus, Hinweis in
   „Übertragung“ mit Weg in die Einstellungen.
6. **Tests:** Zustandslogik in TypeScript; Swift-Logik (Antwort → Anzeige, Texte, Knöpfe) auf macOS ausgeführt;
   `expo prebuild -p ios` und `xcodebuild` für App und Erweiterung; beide Exporte; volle Prüfstrecke, Android-Tests
   unverändert grün. Den PO-Schritt für den ersten EAS-Build mit der neuen Erweiterung (Anmeldedaten) im README der App
   beschreiben.
7. **Prüfliste für den PO** in `.t104c-review/`: gesperrt Pause, Weiter, Beenden; Dynamic Island; Flugmodus mit „Erneut
   senden“; Verwaltungsstopp; nach eigener Erfassung sofort sperren; iOS 16 ohne Knöpfe; zehnmal nach langer Sperre
   öffnen (T-115-Nachtest); Zeit über 8 Stunden; erster EAS-Build mit der Erweiterung.

### Grenzen

Keine Push-Nachrichten (APNs später), keine Änderung an Android und Server. EAS- und TestFlight-Build durch den PO.
ADO nicht ändern. Bericht in `.t104c-review/`; kein Commit vor `APPROVED`.
