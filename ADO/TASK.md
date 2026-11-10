# Aktuelle Aufgabe

> **Stand 10.11.2026:**
> - Die Apps sind aus `5ba70b8` gebaut (T-141, T-143, T-142). Am iPhone erscheinen die Initialen.
> - Am gesperrten iPhone öffnen die Sperrbildschirm-Knöpfe aber weiter nur die App. Jetzt T-145, danach ein App-Build.

## T-145 · iPhone gesperrt: Sperrbildschirm-Knöpfe verlangen Face ID und buchen nichts (P1)

**Für:** Development (Astra, Extra High) · **Risiko:** hoch. Es geht um die Sperrbildschirm-Berechtigung (Auth),
deshalb ein unabhängiges Review (AGENTS 4) · **Zeitbox:** eine Sitzung.

### Befund (PO 09.11. und 10.11., iPhone mit iOS 26.5, Build aus `5ba70b8`, mit Netz)

- **Gesperrt,** Pause oder Beenden in der Live-Aktivität tippen: Das iPhone verlangt Face ID, danach öffnet sich die
  App. Gebucht wird nichts, die Zeit läuft weiter. Das passiert immer, egal wie lange das iPhone schon gesperrt ist.
- **Entsperrt,** dieselbe Live-Aktivität über die Mitteilungszentrale: Die Aktion wirkt.
- **Android** ist nicht betroffen.
- **Folgerung:** Der Knopf ist ein Intent (`canSend`), Schlüssel und Nonce sind da. Speicher und Schlüsselbund nutzen
  `AfterFirstUnlock`.

### Spuren des TL (nicht bewiesen)

1. **iOS verlangt das Entsperren, bevor `perform` läuft.** Möglicher Auslöser:
   - `LockScreenActionIntent` ist zusätzlich `ForegroundContinuableIntent` und ruft `requestToContinueInForeground()`
     auf. Beides hat Apple in iOS 26 abgekündigt, an seine Stelle tritt `supportedModes`.
   - T-104c hat das als P3 „am Gerät prüfen“ notiert.
2. **`perform` läuft, kehrt aber mit „App öffnen“ zurück.** Nach Face ID wird die App aktiv, und ihr Abgleich
   (`suspend`) dreht die Nonce, bevor die Aktion gelesen wird. Oder ein anderer Zweig in `LockScreenEngine.action`
   liefert `true`, darunter `catch`.

### Umfang

1. **Apple-Dokumentation zu iOS 26 prüfen:**
   - App Intents: `supportedModes` und `IntentModes`;
   - `LiveActivityIntent`, `authenticationPolicy`;
   - die Abkündigung von `ForegroundContinuableIntent`;
   - interaktive Live-Aktivitäten auf dem gesperrten Gerät.

   Die Quellen gehören in den Bericht.
2. **Die belegte Korrektur umsetzen.** Der Aktions-Intent läuft nur im Hintergrund: unter iOS 26 über `supportedModes`,
   ab iOS 17 ohne Vordergrund-Fortsetzung. Muss eine Aktion in die App, zeigt die Live-Aktivität „Bitte App öffnen“ als
   Link, statt mitten im Intent in den Vordergrund zu wechseln. Diese Regeln bleiben:
   - Eine Aktion wird beim Öffnen der App nie nachgeholt.
   - Ein veralteter Tipp bucht nie.
   - D-146 und D-160 bleiben.
   - Das Verhalten ohne Netz bleibt wie in T-140.
3. **Diagnose ohne Kabel.** Die native Seite merkt sich nur den letzten Sperrbildschirm-Tipp:
   - Uhrzeit;
   - ob `perform` lief;
   - App-Zustand;
   - ob geschützte Daten verfügbar waren;
   - das Ergebnis als feste Kennung, etwa `executed`, `no_key`, `nonce_changed`, `blocked`, `storage`, `network`,
     `continued`.

   Keine Namen, Schlüssel oder Antworttexte. Angelegt wird der Eintrag beim Tipp, überschrieben beim nächsten, gelöscht
   beim Abmelden (AGENTS 1.5). Die App zeigt ihn als eine kleine Zeile unter „Übertragung“. Kommt ein Tipp gar nicht an,
   bleibt der frühere Eintrag stehen, und die Uhrzeit zeigt das.

### Tests und Nachweis

- **Swift-Engine-Tests:** für jede Ergebniskennung und dafür, dass eine Aktion nie nachgeholt wird.
- **Intent-Metadaten:** Was der Intent erklärt (`supportedModes`, Vordergrund, `authenticationPolicy`), muss im
  iOS-26.5-SDK-Typecheck der Laufzeit, des Widgets und des AppIntent sichtbar sein.
- **Grün bleiben:** Android unverändert, die Regressionen aus T-140, T-143 und T-142.
- **Builds und CI:** Android-Release-Build, iOS-JS-Export, ganze CI lokal nachgebaut.
- **Bericht:** `.t145-review/bericht.md` mit einer kurzen Geräteprüfliste. Sie enthält, wie der PO die Diagnosezeile
  abliest.

### Grenzen

- Kein Deploy, keine EAS-Builds, kein Server, kein Supabase, keine GHCR-Paketaktion, nichts installieren (AGENTS 3).
- Kein Commit vor `APPROVED`.
