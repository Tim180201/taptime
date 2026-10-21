# Taptura auf dem iPhone — Stufe 1

Diese Fassung liest NTAG213/215/216 in der geöffneten App: **Erfassen → Tag scannen →
iPhone an den Tag halten**. Das Apple-Scanfenster erscheint erst nach dem Antippen.
Start und Stopp entscheidet derselbe Server wie bei Android. Beim Zuordnen eines Tags
bleibt das iPhone am Tag, bis Lesen und Schreiben abgeschlossen sind. Die Adresse und
Android-App-Kennung werden zusammen geschrieben; die Seriennummer bleibt die Identität.
Nicht beschreibbare bzw. nicht NDEF-fähige Tags werden mit einem Hinweis abgewiesen.
Hintergrund-NFC und Universal Links folgen in T-073.

## Erster TestFlight-Build — Tim führt diese Schritte selbst aus

Voraussetzungen: technisch freigegebener und committeter Stand ohne lokale Änderungen,
Zugriff auf das vorhandene Expo-Projekt sowie ein aktives Apple-Developer-Konto mit den
nötigen Rechten im richtigen Team. Kein Konto anlegen oder kostenpflichtiges Programm
buchen, ohne das separat zu entscheiden. Das iPhone muss NFC unterstützen; Simulatoren
können den Tag-Test nicht ersetzen.

1. Öffne dein Terminal im Mobile-Verzeichnis:

   ```sh
   cd /Users/timbartz/Dokumente/GitHub/taptime/apps/mobile
   git status --short
   ```

   Bei offenen Quellcodeänderungen zuerst den Technical Lead einbeziehen. Review-Dateien
   werden vor dem freigegebenen Build vom Technical Lead eingeordnet/entfernt. Die
   folgenden Schritte wurden durch Codex nicht ausgeführt.

2. Prüfe mit `eas whoami`, dass das richtige Expo-Konto angemeldet ist; andernfalls
   `eas login`. Die vorhandene EAS-CLI verwenden. Expo-Anmeldung und Apple-Anmeldung
   sind getrennte Zugänge.

3. Starte den ersten iOS-Build:

   ```sh
   eas build -p ios --profile production-validation
   ```

   Dieses Profil verwendet für iOS **Store-Verteilung**, wie TestFlight sie verlangt.
   Der Android-Zweig bleibt eine interne APK. Kontrolliere im Dialog die Bundle-ID
   **`com.tim180201.mobile`**. Gib Apple-ID und Zwei-Faktor-Code selbst ein; wähle dein
   richtiges Apple-Team. EAS kann Distribution-Zertifikat und Provisioning-Profil
   einrichten. Passwörter, Codes und private Schlüssel nicht in Chat, Dateien im
   Repository oder Screenshots übernehmen.

4. Warte, bis EAS den Build erfolgreich abgeschlossen hat. Prüfe den verwendeten
   Git-Stand. Bei Fehlern die Fehlermeldung ohne Zugangsdaten an den Technical Lead geben;
   keinen anderen Build und keine andere Bundle-ID als Umgehung wählen.

5. Lade genau diesen Build zu TestFlight hoch:

   ```sh
   eas submit -p ios
   ```

   Wähle den gerade erstellten iOS-Build aus. EAS führt durch die erforderliche
   Apple-Anmeldung und lädt zu App Store Connect hoch. Apple verarbeitet den Upload,
   bevor er unter TestFlight erscheint. Das veröffentlicht die App noch nicht im Store.
   Fragen zur Exportkonformität anhand der verwendeten Verschlüsselung beantworten
   (u. a. HTTPS, SecureStore und SQLCipher), bei Unklarheit fachlich klären lassen.
   Im Projekt ist keine pauschale Ausnahme von Verschlüsselungsangaben hinterlegt.

6. Öffne [App Store Connect](https://appstoreconnect.apple.com/), wähle die App und
   **TestFlight → Internal Testing**. Erstelle eine interne Testergruppe, füge den
   verarbeiteten Build hinzu und wähle die Tester. Interne Tester müssen berechtigte
   Benutzer deines App-Store-Connect-Teams sein. Die Tester installieren Apples
   **TestFlight** auf dem iPhone, nehmen die Einladung an und installieren den Build.

7. Prüfe am echten Gerät: Anmeldung, denselben bereits unter Android zugeordneten Tag,
   Start/Stopp, Tag-Zuordnung auf dem iPhone und anschließendes Lesen unter Android,
   Abbruch, mehrere schnelle Betätigungen, Flugmodus/Offline-Erfassung und anschließenden
   Abgleich, App-Neustart, eigene Zeiten, Nachtragen und die Rollenbereiche. Prüfe den
   sichtbaren App-Stand. Offene Vorgänge niemals durch Deinstallation oder Datenlöschung
   entfernen. Der native Android-Ton-/Vibrationscode besitzt in Stufe 1 noch keinen
   iOS-Zweig; die sichtbare Serverentscheidung ist vorhanden.

## Offline-Uhr und Hintergrundabgleich

D-082 wird nativ umgesetzt: zufälliger Marker, Bootzeit und fortlaufende Uhr werden
atomar in der App gespeichert. Beim App-Neustart bleibt der Marker erhalten. Ein
Rücksprung des Zählers oder eine Bootzeitabweichung oberhalb der Toleranz erzeugt einen
neuen Marker. Die Toleranz ist höchstens 120 Sekunden und strikt kleiner als die zuletzt
gesehene Geräte-Laufzeit. Unter einer Millisekunde ist keine positive Toleranz möglich;
nach einem Sample bei null wird konservativ eine neue Kennung erzeugt. Kleine
Kalenderkorrekturen werden gegen die ursprüngliche Bootzeit dieser Generation geprüft,
damit sich viele kleine Änderungen nicht unbemerkt aufsummieren.

Die rohe Bootzeit und Geräte-Uptime bleiben im nativen Speicher. Die Schnittstelle
meldet Zeitabstände seit dem ersten App-Sample dieser Generation; der Server erhält
weiter denselben Vertrag. Diese Intervalle begründen `SystemBootTime / 35F9.1` im
Datenschutz-Manifest. Der Marker wird unabhängig von Zeitwerten zufällig erzeugt.

Bei geändertem Marker gilt das bestehende Schutzverhalten: Eine noch laufende Erfassung
kann als `review_only` gespeichert werden; eine nach Neustart nicht mehr gültige
Offline-Berechtigung muss mit Netz erneuert werden. Vorhandene Queue-Ereignisse bleiben
erhalten und werden nicht umgeschrieben oder gelöscht. Ein iPhone-Neustart ist deshalb
kein Ersatz für den Abgleich. Die Datenbank bleibt bis zum externen Archivnachweis die
Gerätekopie eines Ereignisses.

Seit T-115/D-133 gleicht iOS ausschließlich im Vordergrund ab. Ein Hintergrundstart
wartet auf die sichtbare App, erneuert keine Anmeldung und schreibt nichts in den
Schlüsselbund. Die gesonderten nativen Sperrbildschirm-Aktionen aus T-104c verwenden
nur ihren eingeschränkten Schlüssel und starten keinen Offline-Abgleich.

## Live-Aktivität auf dem iPhone (T-104c)

Die App legt bei eigener laufender Zeit im Vordergrund eine Live-Aktivität an. Ziel,
Dauer und Pause erscheinen auf dem Sperrbildschirm und in der Dynamic Island. Ab
iOS 17 senden „Pause starten“, „Pause beenden“ und „Zeit beenden“ direkt an den
bestehenden Serverweg. Der Server prüft den Zustand und erzeugt dieselben manuellen
Ereignisse wie in der App. iOS 16.4–16.x zeigt keine Knöpfe. Antippen öffnet „Erfassen“;
das URL-Schema folgt der Variante. Es gibt weder Ton noch Vibration noch eine zusätzliche
Mitteilung oder Mitteilungs-Erlaubnisabfrage. Sind Live-Aktivitäten ausgeschaltet,
zeigt „Übertragung“ den Weg zu den Einstellungen.

Die laufende Dauer verwendet den Systemtimer von SwiftUI (mit Sekunden), damit sie
auch bei ruhenden Prozessen weiterläuft. Die angehaltene Arbeitsdauer und die
Abschlussmeldung verwenden Stunden:Minuten. Manrope und das farbige kompakte Zeichen
aus `shared/brand/` werden in der Erweiterung mitgeliefert.

Der `LiveActivityIntent` läuft im App-Prozess. Bei einem Hintergrundstart hält
`TapTimeForegroundLaunch` den Start von React bis zum Vordergrund zurück; zusätzlich
bleibt die Startreihenfolge aus T-115 bestehen. Nur `.background` wird zurückgehalten;
der normale `.inactive`-Start legt wie Expo sofort Fenster und React-Ansicht an, bevor
die übrigen Start-Callbacks laufen. Es gibt keinen Zugriff der Erweiterung
auf Anmeldung oder Schlüsselbund. Der eigene Eintrag `capability-v1` verwendet
`AfterFirstUnlockThisDeviceOnly` und wird nur im Vordergrund geschrieben oder gelöscht.
Offener Befehl, Anzeige und Ablauf liegen unter `Application Support/TapTimeLockScreen`
mit `completeUntilFirstUserAuthentication`, atomar geschrieben und vom Backup ausgeschlossen.
Bei Ablauf oder 401 im Hintergrund wird der Schlüsselverweis sofort ungültig; der
unbenutzbare Schlüsselbund-Eintrag wird erst im Vordergrund entfernt bzw. ersetzt.

Änderungen kommen aus dem Vordergrundabgleich oder der Antwort auf einen Knopf.
Ohne Netz bleibt der Befehl mit seiner ID erhalten („Erneut senden“); der Intent bittet
iOS, die App zu öffnen. Die Rückkehr führt keine Aktion automatisch aus. Nach eigener
Erfassung bleibt „Wird übertragen …“, bis die App wieder im Vordergrund abgleicht.
Ein Verwaltungsstopp wird beim nächsten Öffnen bzw. bei der nächsten Serveraktion sichtbar.

Beenden zeigt „Zeit beendet“ zehn Sekunden; die zeitgesteuerte Entfernung übernimmt
ActivityKit auch bei ruhender App. Abmelden, Kontowechsel, abgewiesene Sitzung und kein
laufender Eintrag beim Öffnen entfernen die Anzeige. Ablauf wird bei jedem nativen
Lesen und jeder Aktion geprüft; ActivityKit erhält außerdem das Ablaufdatum. Ohne
laufenden Prozess oder APNs kann die App keine punktgenaue Entfernung bei Ablauf
erzwingen. iOS begrenzt aktive Live-Aktivitäten auf acht Stunden; beim nächsten Öffnen
wird eine noch laufende eigene Zeit neu angezeigt.

### Erster EAS-Build mit der neuen Erweiterung — PO-Schritt

Erst nach technischer Freigabe und Commit den oben beschriebenen EAS-Build ausführen.
Das eigene Config-Plugin `plugins/withTaptimeLiveActivity.js` erzeugt das Target
`TapTimeLiveActivity` mit der Bundle-ID `com.tim180201.mobile.TapTimeLiveActivity`.
Unter `extra.eas.build.experimental.ios.appExtensions` deklariert es **vor** dem
Prebuild Targetname, Bundle-ID und leere Entitlements. Dadurch kann EAS die benötigten
Anmeldedaten für App **und** Erweiterung vor dem Build ermitteln. App Groups, geteilte
Keychain-Gruppen und Push-Berechtigungen werden nicht benötigt. Alle Varianten
verwenden dieselben iOS-Bundle-IDs.

App und Erweiterung erben `MARKETING_VERSION` und `CURRENT_PROJECT_VERSION` aus
denselben Projekt-Build-Settings; beide Info.plists verwenden diese Werte. Es gibt
keine eigene festgeschriebene Build-Nummer der Erweiterung. Mit `appVersionSource:
remote` synchronisiert EAS die Versionen im nativen Projekt für die erkannten Targets.
Im fertigen Build müssen `CFBundleShortVersionString` und `CFBundleVersion` der App
und der eingebetteten Erweiterung übereinstimmen.

Beim ersten `eas build -p ios --profile production-validation` kontrolliert der PO im
Anmeldedaten-Dialog beide Bundle-IDs und das vorhandene Apple-Team. EAS benötigt neben
der App ein Provisioning-Profil für die Erweiterung; der PO bestätigt dessen Einrichtung
selbst und gibt Apple-Anmeldung und Zwei-Faktor-Code selbst ein. Bei unbekanntem Team,
abweichender ID oder fehlenden Rechten abbrechen und den TL einbeziehen. Codex hat weder
einen EAS-Build gestartet noch im Developer-Portal Zertifikate oder Profile angelegt.
Nach dem Build muss `TapTimeLiveActivity.appex` eingebettet sein; die Geräteabnahme
erfolgt anhand der T-104c-Prüfliste, einschließlich zehnmal Öffnen nach langer Sperre.

Technische Quellen: [Expo: iOS App Extensions](https://docs.expo.dev/build-reference/app-extensions/),
[Expo: App-Versionen](https://docs.expo.dev/build-reference/app-versions/),
[Apple: interaktive Live-Aktivitäten](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities).

## Anlegen, Ändern und Entfernen

- Das Uhrmodul legt seinen lokalen Zustand beim ersten Sample an, aktualisiert ihn bei
  jedem Sample und ersetzt die Generation bei einem erkannten Bruch. Die Datei liegt
  geschützt im App-Verzeichnis und ist vom Backup ausgeschlossen. Sie wird mit der App
  entfernt; es gibt keine Löschaktion für Mitarbeiter und keine Änderung erhaltener
  Arbeitsereignisse.
- Der Technical Lead gibt neue Quellstände technisch frei; Tim erstellt und verteilt
  Builds über EAS/TestFlight. Ein Update derselben Bundle-ID ersetzt die App unter Erhalt
  ihrer Daten. Tim verwaltet Tester und beendet die Verteilung alter Builds in
  App Store Connect. Erst nach geklärtem Abgleich darf eine Testinstallation entfernt
  werden.

Quellen: [Expo-Bauprofile](https://docs.expo.dev/build/eas-json/),
[EAS Submit für iOS](https://docs.expo.dev/submit/ios/),
[Apple: interne Tester](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers),
[Apple: Pflichtgründe für APIs](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype).
