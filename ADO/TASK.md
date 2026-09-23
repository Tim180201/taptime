# Aktuelle Aufgabe

> **Stand 23.09.2026:** Produktion auf `ff69bfe` (T-065, T-066, T-069, T-070, T-057, T-068a/b, T-071;
> Migrationen 030–032). Betreiber-Bereich eingerichtet. Reihenfolge: **T-072 → APK + TestFlight →
> Geräteabnahme Android und iPhone → Pilot Monat 1**. Frühere Briefs stehen in der Git-Historie.

## T-072 · iPhone Stufe 1: die App auf dem iPhone, Scan in der offenen App

**Für:** Development · **Risiko:** Tag-Identität, Offline-Kette, Plattformgleichheit
**Zeitbox:** zwei Sitzungen; Reihenfolge Machbarkeit → Einstellungen → Scan → Tag zuordnen → Build.
**Grundlage:** D-037, D-061, D-081, ADR-0009 (Android-UID), ADR-0017, D-058 (Tap-Moment).

### Ziel

Ein Mitarbeiter mit iPhone öffnet die App, tippt auf dem Erfassen-Bildschirm auf **„Tag scannen"**,
hält das iPhone an den Tag (Apples Scan-Fenster erscheint) und bekommt dieselbe Entscheidung wie
auf Android. Offline, Warteschlange, Anmeldung, Meine Zeiten, Nachtragen und Verwaltung funktionieren
wie auf Android. Android bleibt unverändert.

### Auftrag

1. **Erst Machbarkeit belegen, dann bauen (Stop-Regel):** Am Code und an der Dokumentation von
   `react-native-nfc-manager` belegen, dass iOS in einer Core-NFC-Sitzung (Tag-Reader, z. B.
   `NfcTech.MifareIOS` bzw. ISO 14443) die **Seriennummer** unserer Tags liefert und dass sie nach
   `createCanonicalNfcUidPayload` **exakt dieselbe kanonische Form** wie auf Android ergibt (Byte-
   Reihenfolge, Groß-/Kleinschreibung, Länge). Welche Tag-Typen nutzen wir (NTAG21x o. ä.)?
   Geht das nicht ohne Änderung an Tag-Identität, Server oder Datenmodell: **stoppen und melden.**
2. **iOS-Einstellungen:** Bundle-ID **gleich wie das Android-Paket** (`com.tim180201.mobile`,
   keine Namensentscheidung nötig), NFC-Berechtigung (Entitlement Tag-Lesen, nötige Formate),
   verständlicher deutscher Nutzungstext für NFC, Hintergrundaufgaben so weit iOS sie erlaubt.
   `eas.json`: iOS im Profil `production-validation` für TestFlight (interne Tester), ohne
   Geheimnisse; Apple-Zugangsdaten gibt Tim beim ersten Build selbst ein.
3. **Scan auf iOS:** Der bestehende `RnNfcScanAdapter` bekommt einen iOS-Weg: Sitzung nur auf
   ausdrückliches Antippen von „Tag scannen", eine Sitzung zur Zeit (bestehender
   `ExclusiveNfcCaptureArbiter`), Abbruch und Zeitüberschreitung ergeben verständliche Hinweise,
   Ergebnis läuft durch **denselben** Pfad wie Android (gleiche Entscheidung, gleiche Offline-
   Warteschlange, gleicher Archivnachweis). Kein Hintergrund-Lesen, keine Universal Links (T-073).
   Android-Verhalten bytegleich; Tests für beide Plattformen.
4. **Tag zuordnen auf iOS:** Das Beschreiben mit der NDEF-Adresse (D-061) auch auf dem iPhone,
   damit ein Admin mit iPhone Tags einrichten kann. Geht das nicht sauber: melden, nicht umgehen.
5. **Aufräumen aus T-071:** Die Standardwerte `= fetch` in `TapTimeSessionApiClient` und
   `AuthenticatedHttpRequestExecutor` auf den gebundenen Wrapper wie im Admin-Web umstellen.
6. **Anleitung für Tim** in `apps/mobile/README` oder `infrastructure/`: erster iOS-Build mit
   `eas build -p ios --profile production-validation`, Anmeldung mit Apple-ID (Zwei-Faktor),
   dann `eas submit -p ios` zu TestFlight, Tester hinzufügen. Schritt für Schritt, deutsch.

### Tests

Machbarkeitsnachweis (Quelle, Version, Codepfad); Einheitstests des iOS-Scanwegs (Erfolg, Abbruch,
Zeitüberschreitung, nicht unterstützt, zweite Sitzung abgewiesen); gleiche kanonische Form für
dieselbe UID auf beiden Plattformen; Android-Regression; `expo prebuild`/Konfigurationsprüfung für
iOS (Entitlements und Texte im erzeugten Projekt); vollständige App-Suite und Typecheck.

### Nicht Teil

Kein Server, keine Migration, keine Änderung der Tag-Identität, kein Hintergrund-Lesen, keine
Apple-Anmeldung durch Codex, kein Build/Submit durch Codex, kein Deploy.

### Bericht

`.t072-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit, kein Push.
