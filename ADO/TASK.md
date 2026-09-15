# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-043 · Der Tag startet die App

**Für:** Development · **Risiko:** Der Kernweg „One Tap. One Decision.“ ist bei geschlossener App
unterbrochen; eine zu breite Änderung an mehreren NFC-Filtern würde die Ursache verdecken. ·
**Zeitbox:** eine Sitzung · **Grundlage:** Gerätetest T-033 und Befund D-042, APK `486ad76`,
SM-A336B mit Android 15, Paket `com.tim180201.mobile.productionvalidation`

### Ziel

Die Ursache des Android-Auswahldialogs bei vollständig geschlossener App ist mit Ausgaben vom
echten Gerät belegt. Vor jeder Reparatur steht fest, ob TapTim.e richtig registriert ist, welcher
Intent tatsächlich ankommt, was der eingerichtete Tag trägt und ob sein Technologieprofil vom
Filter erfasst wird.

### Umsetzung

- Die ADB-Strecke aus `ADO/04_Operations/Android_Produktionstest.md` verwenden.
- Das Paketsystem für `NDEF_DISCOVERED`, `TECH_DISCOVERED` und `TAG_DISCOVERED` einzeln abfragen;
  alle beanspruchenden Activities benennen und ausdrücklich sagen, ob TapTim.e darunter ist.
- Im Android-Dialog TapTim.e auswählen und praktisch feststellen, ob der Scan stempelt.
- Den beim Antippen tatsächlich ankommenden Intent und den NDEF-Inhalt des über die App
  eingerichteten Tags feststellen; NDEF hat bei Android Vorrang vor TECH und TAG.
- Den Inhalt von `taptime_nfc_tech_filter.xml` den vom Gerät gemeldeten Tag-Technologien
  gegenüberstellen.
- Den Verdacht prüfen, dass `plugins/withNfcTagDispatch.js` für `TECH_DISCOVERED` fälschlich
  `android.intent.category.DEFAULT` setzt: offizielle Android-Dokumentation und Geräteverhalten
  müssen beide den Befund tragen. Ist der Verdacht falsch, wird die echte Ursache benannt.

### Verifikation und Grenzen

- Keine Codeänderung, keine Reparatur, kein APK-Bau, kein Deploy und kein Zugriff auf
  Produktionsdaten. Geheimnisse, Schlüssel, Token, Datenbank- und Personendaten bleiben aus
  Befehlsausgaben, Protokollen und Bericht ausgeschlossen.
- Der getrennte Vordergrundmangel bleibt ausschließlich als T-044 im Plan: kein Reader-Mode-
  Umbau und keine Änderung von `ScanScreen.tsx` in T-043.
- Erst den Diagnosebericht abgeben. Eine Reparatur folgt nur als eigener, einzeln messbarer
  Schritt nach neuer Anweisung.

### Bericht

Vier Punkte gemäß `AGENTS.md`, darin die Tatsachen a) bis d) jeweils samt bereinigter Ausgabe,
das Ergebnis zum benannten Verdacht, T- und D-Nummer sowie Hash des Dokumentations-Commits.
