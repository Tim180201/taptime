# TapTim.e auf dem Android-Telefon testen

Diese Anleitung führt den Product Owner vom privaten Installationslink bis zur sichtbaren
Arbeitszeit im Admin-Web. Du brauchst keine Entwicklungswerkzeuge.

## Vorbereiten

- Ein Android-Telefon mit eingeschaltetem NFC.
- Dein bestehendes TapTim.e-Administratorkonto.
- Einen NFC-Tag. Empfohlen ist ein **NXP NTAG213**; NTAG215 und NTAG216 funktionieren ebenfalls.
  Beim Kauf müssen ausdrücklich **NFC-A / ISO 14443 Type A** und am besten
  **NFC Forum Type 2** dabeistehen. TapTim.e liest nur die ab Werk eindeutige Kennung und
  beschreibt den Tag nicht. „Leer", „NDEF-formatiert" und die Speichergröße sind daher egal.
- Für Holz, Kunststoff, Glas oder Papier genügt ein normaler NTAG21x-Aufkleber. Für Metall nur
  einen ausdrücklich als **On-Metal** oder **mit Ferrit-Abschirmung** angebotenen NTAG21x kaufen.
- Nicht kaufen: 125-kHz-RFID, NFC-V/ISO 15693, NFC-B oder einen Tag, der nur als
  „MIFARE Classic" beschrieben ist. Diese Typen erfüllen den benötigten NFC-A-Weg nicht
  verlässlich auf jedem Android-Gerät.

Der technische Grund: TapTim.e verlangt Android `NfcA` (ISO 14443-3A). NXP beschreibt
NTAG213/215/216 als NFC Forum Type 2 und ISO/IEC 14443 Type A. Siehe
[Android-Dokumentation](https://developer.android.com/reference/android/nfc/tech/NfcA) und
[NXP-Produktinformation](https://www.nxp.com/products/NTAG213_215_216).

## App installieren

1. Der Technical Lead zeigt dir den **privaten Installationslink** am besten persönlich als
   QR-Code. Der Link steht niemals im Repository, in einer Gruppe oder in einem weiterleitbaren
   Chat. Jeder mit dem Link könnte die APK laden.
2. Öffne den Link auf dem Android-Telefon, tippe auf **Installieren** und lade die APK herunter.
3. Android warnt, weil die App nicht aus dem Play Store kommt. Das ist bei diesem internen
   Produktionstest normal. Erlaube deinem Browser für diesen einen Vorgang
   **„Unbekannte Apps installieren"** und bestätige die Installation. Falls Play Protect eine
   Prüfung anbietet, lass sie durchlaufen.
4. Öffne **TapTim.e Produktionstest**. Diese App hat einen eigenen Paketnamen und kann später
   neben der Store-App installiert bleiben.
   Sie trägt bewusst eine Wegwerf-Signatur: Sie kommt nie in einen Store, deshalb kostet ein
   verlorener Schlüssel nur einen Neubau dieser Testfassung.
5. Unten auf der Anmeldung steht **„App-Stand: …"**. Vergleiche die sieben Zeichen mit dem
   Commit, den der Technical Lead zusammen mit dem QR-Code nennt. Bei Abweichung oder
   **„nicht verfügbar"** nicht weitermachen, sondern den Technical Lead informieren.
6. Entziehe dem Browser danach in den Android-Einstellungen wieder die Erlaubnis
   **„Unbekannte Apps installieren"** und lösche die heruntergeladene APK aus *Downloads*.

## Anmelden und NFC-Tag einrichten

1. Melde dich in der App mit der E-Mail-Adresse und dem Passwort deines Administratorkontos an.
   Die Serveradresse ist bereits eingebaut; du musst nichts auswählen oder eingeben.
2. Falls noch kein passendes Arbeitsziel existiert, öffne
   [das Admin-Web](https://admin.tb-infra.de), melde dich an und lege unter **Einrichtung** einen
   Kunden für den Test an, zum Beispiel „Telefon-Test".
3. Öffne in der App unten **NFC-Einrichtung**.
4. Wähle den Kunden. Gib als Tag-Bezeichnung zum Beispiel „Telefon-Test Tag 1" ein.
5. Tippe **NFC-Tag erfassen und zuordnen** und halte die NFC-Fläche des Telefons ruhig direkt an
   den Tag. Je nach Gerät sitzt sie oben, mittig oder nahe der Kamera auf der Rückseite.
6. Warte auf **„Tag erfolgreich zugeordnet"**. Damit sind Registrierung und Zuordnung in einem
   Schritt abgeschlossen.

## Den vollständigen Weg prüfen

1. Öffne in der App **Erfassen** und halte denselben Tag erneut ans Telefon.
2. Die App muss einen gestarteten Vorgang bestätigen, ohne nach „Start" oder „Stopp" zu fragen.
3. Öffne im Browser das Admin-Web und dort **Arbeitszeiten**. Aktualisiere die Ansicht. Der
   laufende Eintrag für „Telefon-Test" muss erscheinen.
4. Scanne denselben Tag in der App ein zweites Mal. Die Engine stoppt die laufende Zeit.
5. Aktualisiere **Arbeitszeiten** erneut. Beginn und Ende müssen jetzt sichtbar sein.
6. Unter **Sync** zeigt die App denselben App-Stand wie auf der Anmeldung. Notiere diesen Stand
   zusammen mit dem Testergebnis in der Smoke-Test-Checkliste.

## Wenn etwas nicht funktioniert

### Fehler per USB eingrenzen

Diese Diagnose ist nur nach einem abgebrochenen Test nötig. Sie liest den flüchtigen
Android-Systemlog des App-Prozesses; sie liest weder App-Daten noch die lokale Datenbank.

1. Installiere auf dem Rechner die Android **Platform Tools**. Prüfe im Terminal mit
   `adb version`, dass `adb` erreichbar ist.
2. Öffne am Telefon *Einstellungen → Telefoninfo → Softwareinformationen* und tippe siebenmal
   auf *Buildnummer*. Schalte danach unter *Entwickleroptionen* vorübergehend
   *USB-Debugging* ein.
3. Verbinde das entsperrte Telefon mit einem Datenkabel. Führe `adb devices -l` aus und
   bestätige den Fingerabdruck-Dialog am Telefon. Hinter dem Gerät muss `device` stehen;
   bei `unauthorized` ist der Dialog noch nicht bestätigt.
4. Erfasse Paket- und Installationsstand, ohne App-Inhalte auszulesen:

   ```sh
   adb shell dumpsys package com.tim180201.mobile.productionvalidation \
     | grep -E 'versionCode=|versionName=|firstInstallTime=|lastUpdateTime='
   ```

5. Notiere die sichtbare Fehlermeldung, leere dann für den kontrollierten Wiederholungslauf
   den flüchtigen Logpuffer und starte ausschließlich die Produktionstest-App neu:

   ```sh
   adb logcat -c
   adb shell am force-stop com.tim180201.mobile.productionvalidation
   adb shell am start -W \
     -n com.tim180201.mobile.productionvalidation/.MainActivity
   TAPTIME_APP_PID="$(adb shell pidof \
     com.tim180201.mobile.productionvalidation | tr -d '\r')"
   printf '%s\n' "$TAPTIME_APP_PID"
   ```

   Eine leere PID bedeutet: Die App läuft nicht. Dann nicht mit einem ungefilterten Log
   weitermachen, sondern den Startfehler melden.
6. Lies nur den gerade gestarteten App-Prozess und nur Diagnosebegriffe aus. Die letzte Stufe
   schwärzt zusätzlich lange Hexwerte, JWT-artige Werte und Bearer-Werte:

   ```sh
   adb logcat -d --pid="$TAPTIME_APP_PID" -v threadtime '*:V' \
     | grep -Ei 'P0[1-9]|sqlite|sqlcipher|database|migration|exception|syntax error|failed' \
     | sed -E \
       -e 's/[[:xdigit:]]{64}/<REDACTED>/g' \
       -e 's/eyJ[A-Za-z0-9._-]+/<REDACTED>/g' \
       -e 's/(Bearer[[:space:]]+)[A-Za-z0-9._-]+/\1<REDACTED>/g'
   ```

7. Gib nur die gefilterten Diagnosezeilen, den App-Stand und die sichtbare Meldung weiter.
   Niemals den vollständigen Logpuffer, Schlüssel, Token, Zugangsdaten, SQL-Parameter oder
   Datenbankinhalte kopieren. Schalte anschließend *USB-Debugging* wieder aus.

**Grenze des aktuellen Testbaus:** Die APK mit App-Stand `2b0a5573` schreibt weder die
Schutzklasse P01–P09 noch eine innerhalb der Offline-Initialisierung abgefangene Ausnahme in
den App-Log. Bleibt die gefilterte Ausgabe trotz sichtbarer Schutzmeldung leer, ist genau das
zu melden; aus dem deutschen Titel darf keine Klasse geraten werden.

- **Installation blockiert:** Prüfe, ob du die APK über den erhaltenen Link geöffnet und dem
  verwendeten Browser vorübergehend die Installation unbekannter Apps erlaubt hast.
- **„TapTim.e ist nicht verfügbar":** Nicht weiterprobieren. App-Stand notieren und Technical
  Lead informieren; die Laufzeitkonfiguration fehlt oder ist ungültig.
- **Anmeldung scheitert:** E-Mail-Adresse und Passwort einmal neu eingeben. Danach im Admin-Web
  prüfen, ob dieselben Daten funktionieren. Keine Zugangsdaten per Chat senden.
- **NFC wird nicht erkannt:** NFC in den Android-Einstellungen einschalten, Handyhülle abnehmen,
  die Rückseite langsam über den Tag bewegen und fünf Sekunden ruhig halten.
- **Tag nicht lesbar:** Kaufangabe auf **NFC-A / ISO 14443 Type A** prüfen. Auf Metall einen
  On-Metal-/Ferrit-Tag verwenden.
- **„Tag nicht zugeordnet":** In **NFC-Einrichtung** prüfen, ob der Tag unter „Registrierte Tags"
  als „Arbeitsziel zugeordnet" erscheint.
- **Eintrag fehlt im Admin-Web:** Unter **Sync** offene Vorgänge prüfen, Internetverbindung
  einschalten und die Ansicht im Admin-Web aktualisieren. Nichts löschen; unveränderte Daten
  bleiben lokal erhalten.

## Wer die Test-App anlegt, ändert und entfernt

- **Anlegen:** Der Technical Lead baut die APK über EAS ausschließlich aus einem technisch
  freigegebenen, sauberen Commit und übergibt Link und erwarteten App-Stand direkt an den
  Product Owner. Dafür verwendet er im Mobile-Workspace ausschließlich
  `npm run android:production-validation:build`; der Befehl bricht bei uncommittetem Quellcode ab.
- **Ändern:** Eine neue freigegebene APK mit demselben Paketnamen ersetzt nur
  **TapTim.e Produktionstest**. Nach jeder Installation wird der angezeigte App-Stand erneut
  verglichen. Eine alte App erkennt eine neuere Fassung nicht selbst; der Technical Lead muss
  den Product Owner über einen neuen Teststand informieren.
- **Entfernen:** Der Product Owner deinstalliert **TapTim.e Produktionstest** über
  *Einstellungen → Apps*. Der Technical Lead löscht den zugehörigen EAS-Build und damit den
  Installationslink, sobald der Teststand nicht mehr gebraucht wird.
