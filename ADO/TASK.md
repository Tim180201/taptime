# Aktuelle Aufgabe

> **Stand 21.10.2026:** T-104a abgeschlossen (`90fadc3`, CI-Nachtrag `873cbfd`). Reihenfolge für Codex, je ein Auftrag,
> je ein Review, je ein Commit: **T-104b**, dann **T-104c**; T-132 (Sicherung, Brief folgt nach Messung) wird
> vorgezogen, sobald sein Brief steht; T-133 (Runbook) klein dazwischen. Ausgeliefert wird mit Deploy 8 und neuen
> App-Builds. Ohne Verbindung des TL zum Mac legt Codex den geprüften Stand nach PO-Freigabe als Zweig
> `review/<aufgabe>` ab (STATUS).

## T-104b · Sperrbildschirm Android (D-114, D-146, D-147)

**Für:** Development · **Risiko:** hoch (Aktion ohne Anmeldung, Hintergrund, Zeiterfassung) · **Zeitbox:** eine
Sitzung. Unabhängiges Review. Beginnt jetzt. Server und Vertrag stehen (T-104a): `POST /v1/lock-screen/capability`
(angemeldet), `POST /v1/lock-screen/action` (Schlüssel als `Authorization: Bearer`), Typen und Prüffunktionen in
`packages/mobile-work-contract/src/lockScreen.ts`.

### Was man sieht

Läuft eine eigene Zeit, zeigt Android eine Benachrichtigung, auch auf dem Sperrbildschirm, mit Ziel (D-147) und
mitlaufender Arbeitsdauer ohne Pausen. Läuft: „Ziel · 1:23 h“ (Dauer läuft mit), [Pause] [Beenden]. Pause: „Pause seit
12:30 · Ziel“, Dauer steht, [Weiter] [Beenden]. Beendet: „Zeit beendet · 3:42 h“, nach 10 s weg. Während des Sendens
„Wird gesendet …“ ohne Knöpfe. Nicht gesendet: „Nicht gesendet · kein Netz“ bzw. „Noch nicht bestätigt“ mit
[Erneut senden]. Antippen öffnet immer „Erfassen“; dort tippt man die Aktion bei Bedarf selbst (keine automatische
Ausführung). Eine neue Zeit startet nie von außen.

### Umfang

1. **Lokales Expo-Modul `taptime-lock-screen`**, nur Android, nach dem Muster der vorhandenen Module; die JS-Hülle ist
   unter iOS ohne Wirkung. Nur Plattform-APIs, keine neue Bibliothek, kein Vordergrunddienst. Kanal „Laufende Zeit“
   mit Wichtigkeit DEFAULT, Ton und Vibration vor dem Anlegen abgeschaltet, `setOnlyAlertOnce` (stumme LOW-Kanäle
   blendet Android auf dem Sperrbildschirm standardmäßig aus). `VISIBILITY_PUBLIC`: eine öffentliche Ersatzfassung
   zeigt dort keine Knöpfe. Läuft: Chronometer mit `setShowWhen(true)` und Basis `workDurationSeconds + (jetzt − asOf)`;
   Pause: kein Chronometer, keine Uhrzeit oben. Uhrzeiten in Europe/Berlin wie in „Erfassen“. Wegwischen (ab Android 14
   möglich, nicht im gesperrten Zustand) heißt nur ausblenden; wie nach Neustart oder Stopp erzwingen zeigt die App sie
   beim nächsten Öffnen wieder.
2. **Aktion nativ ohne App:** nicht exportierter `BroadcastReceiver`, explizite PendingIntents mit `FLAG_IMMUTABLE`,
   je Knopf eigener Request-Code, Aktionen mit `setAuthenticationRequired(false)`; seit Android 12 darf der Empfänger
   keine Activity starten.
   - Je Tipp eine neue Befehls-ID (UUID v4), sofort „Wird gesendet …“; Aufruf mit `goAsync()` auf eigenem Thread,
     `finish()` erst nach dem Aufruf, alles einschließlich Kaltstart in höchstens 8 s (Verbindung und Antwort je
     höchstens 3 s). Kopfzeilen: Bearer-Schlüssel, `Content-Type: application/json`, `X-TapTime-App` (Wert von der
     App), nie `X-TapTime-Expected-Membership-Id`. Abgelaufener Schlüssel → kein Aufruf, „Bitte App öffnen“.
   - 200 → Anzeige aus `state`; `stopped` → „Zeit beendet“ mit `setTimeoutAfter` (ab Android 8; darunter bis zum
     nächsten Öffnen), Schlüssel löschen. Kein Netz (ConnectivityManager oder Verbindungsaufbau scheitert) → „Nicht
     gesendet“. Antwort ausgeblieben oder 5xx → „Noch nicht bestätigt“. „Erneut senden“ nutzt dieselbe ID. 401 →
     Schlüssel löschen, „Bitte App öffnen“ ohne Knöpfe; 426 → „Bitte App aktualisieren“; 400, 409, 429 → „Bitte App
     öffnen“.
   - Jeder Ausgang wird nativ als **Sperrbildschirm-Stand** gespeichert (Zustand mit `asOf`, oder offener Befehl mit
     ID); läuft die App, meldet das Modul ihn als Ereignis. Der Schlüssel steht nie in Intent, Protokoll, JS-Rückgabe
     oder Fehlermeldung.
3. **Speicher:** eigene SharedPreferences-Datei, Inhalt mit eigenem AES-GCM-Schlüssel im Android Keystore verschlüsselt,
   ohne Benutzer-Authentifizierung und ohne `setUnlockedDeviceRequired` (lesbar bei gesperrtem Handy). Getrennt von
   Anmeldung und SecureStore; von Sicherung und Geräteübertragung ausgeschlossen (Plugin
   `withOfflineStorageBackupBoundary`, `verifyOfflineStorageAndroidBoundary.mjs` und Konfigurationstest erweitert).
   Lässt sich der Inhalt nicht entschlüsseln, wird er gelöscht und beim nächsten Öffnen neu ausgestellt.
4. **App-Seite** (Lebenszyklus nach AGENTS 1.5):
   - **Anlegen:** Zeigt der gelesene Stand eine eigene laufende Zeit (`activeRecord.timeRecordId`), holt die App einen
     Schlüssel (`expectedMembershipId` aus der Sitzung, `installationId` aus dem Offline-Kontext, sonst null) und
     startet die Anzeige. Offline gestartete Zeiten bekommen den Schlüssel, sobald die App sie gelesen hat; bis dahin
     öffnen die Knöpfe „Erfassen“.
   - **Ändern:** Bei jedem Öffnen und jeder Rückkehr in den Vordergrund liest die App online ihre eigene Zeit neu, ohne
     dass die Karte in „Erfassen“ verschwindet, und stellt den Schlüssel neu aus (verlängert). Nach jeder eigenen
     Aktion: Anzeige aus dem eigenen Stand, ein offener Sperrbildschirm-Befehl wird verworfen. Solange eigene
     Erfassungen auf Bestätigung warten, öffnen die Knöpfe „Erfassen“, statt zu senden.
   - **Vor jeder Aktion in „Erfassen“:** Ist der Sperrbildschirm-Stand neuer als der Stand der App, wird zuerst ein
     offener Befehl mit derselben ID nachgesendet und neu gelesen. Offline bleiben Pause und Beenden dieser Zeit dann
     mit einem Satz gesperrt, bis abgeglichen ist: Die Aktionen der App sind Umschalter, ein veralteter Stand würde die
     Gegenrichtung buchen.
   - **Entfernen:** Zeit beendet (App, Sperrbildschirm, Verwaltung), 401 oder Ablauf, Abmelden, Kontowechsel,
     abgewiesene Sitzung.
   - Ein 401 beim Ausstellen ist kein Sitzungsfehler: einmal Token erneuern, dann wie „keine laufende Zeit“; nie
     abmelden (der übliche Weg über `AuthenticatedHttpRequestExecutor` würde es tun).
5. **Erlaubnis** (Android 13+): einmal beim ersten Start einer Zeit, mit kurzem Satz vor der Systemabfrage; abgelehnt →
   keine Anzeige, kein erneutes Fragen, Hinweis in „Übertragung“ mit Weg in die Einstellungen. `POST_NOTIFICATIONS`
   ausdrücklich in `app.json`, Test der Berechtigungsliste angepasst.
6. **Tests:** Zustandslogik und Abgleich in TypeScript; reine Kotlin-Logik (Antwort → Anzeige, alle Fehlerfälle) ohne
   Android-Importe, kompiliert und ausgeführt nach dem Muster `T096NativeAudio.test.ts`. Rotnachweis: Ohne Neulesen
   würde „Pause“ in der App nach einer Pause vom Sperrbildschirm die Pause beenden. Mit vorhandenem Android SDK:
   `expo prebuild --platform android`, Release-Build, `android:offline-storage-boundary:verify`, gemergtes Manifest
   (Empfänger nicht exportiert, `POST_NOTIFICATIONS`, kein Vordergrunddienst); `android/` danach entfernen. Fehlt das
   SDK: melden, nichts installieren.
7. **Prüfliste für den PO** in `.t104b-review/`: gesperrt Pause, Weiter, Beenden (auch aus der Pause), dabei notieren,
   ob die Knöpfe gleich sichtbar sind oder erst nach Aufziehen; Flugmodus mit „Erneut senden“; Verwaltungsstopp, dann
   Knopf, dann App; Pause am Sperrbildschirm, dann in der App; Abmelden; Erlaubnis ablehnen; Neustart des Handys.

### Grenzen

Keine iPhone-Änderung, keine Push-Nachrichten, kein Start einer neuen Zeit von außen, keine Server- oder
Migrationsänderung, D-133 unberührt. ADO nicht ändern. Neuer App-Build durch den PO. Bericht in `.t104b-review/`; kein
Commit vor `APPROVED`.

---

## Danach: T-104c · Sperrbildschirm iPhone (D-114, D-146, D-147)

**Für:** Development · **Risiko:** hoch (Erweiterung, Hintergrundstart, D-133) · **Zeitbox:** eine Sitzung. Beginnt
nach T-104b; der Brief wird mit dessen Ergebnis nachgeschärft.

1. **Live-Aktivität** (Sperrbildschirm und Dynamic Island) über eine Widget-Erweiterung per Config-Plugin, verträglich
   mit Expo SDK 57 und EAS; Bibliothek nur gepflegt und exakt festgelegt, sonst eigenes Plugin. Inhalte und Zustände
   wie T-104b, Farben aus `shared/brand`.
2. **Knöpfe ab iOS 17** als `LiveActivityIntent` mit nativem Aufruf von `/v1/lock-screen/action`. Schlüssel in einem
   eigenen Schlüsselbund-Eintrag „nach erster Entsperrung“; die Anmeldung bleibt „nur entsperrt“ (D-133). Ohne Netz
   wie T-104b („Nicht gesendet“, Antippen öffnet „Erfassen“). iOS 16: ohne Knöpfe, Antippen öffnet „Erfassen“.
3. **D-133 bleibt intakt:** Der Start durch die Aktion berührt weder JavaScript-Sitzung noch Anmeldung; Test dafür.
4. **App-Seite** aus T-104b wiederverwenden; `NSSupportsLiveActivities`.
5. **Tests und Prüfliste** am iPhone wie T-104b, dazu T-115-Nachtest (zehnmal nach langer Sperre öffnen).

Keine Push-Nachrichten (APNs später), keine Änderung an Android. Neuer TestFlight-Build durch den PO. Bericht in
`.t104c-review/`; kein Commit vor `APPROVED`.
