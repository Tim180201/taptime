# Aktuelle Aufgabe

> **Stand 31.10.2026:**
> - T-139 und T-140 sind auf main (`b50e85a`).
> - Die Apps aus diesem Stand sind auf beiden Handys geprüft und bestanden (PO 31.10.).
> - Jetzt T-141, danach ein gemeinsamer App-Build.

## T-141 · Sperrbildschirm mit Initialen (D-160), „Erfassen“ nur mit aktuellem Stand (T-140c)

**Für:** Development (Astra, Extra High) · **Risiko:** niedrig bis mittel. Es geht um personenbezogene Daten
Minderjähriger, deshalb ein unabhängiges Review (AGENTS 4) · **Zeitbox:** eine Sitzung. Reißt sie, wird Teil 2
geschnitten, nie Teil 1.

### Teil 1 · Initialen außerhalb der App (D-160)

- Android-Benachrichtigung und iPhone-Live-Aktivität (Sperrbildschirm, Dynamic Island) zeigen einen **Kunden** nur mit
  Initialen.
- Projekte und allgemeine Arbeit behalten ihren Namen. In der App bleibt überall der volle Name.
- **Regel:** Je der erste Buchstabe des ersten und des letzten Wortes, großgeschrieben, jeweils mit Punkt. Wörter trennen
  Leerzeichen und Komma, ein Bindestrich nicht.
  - „Max Kunde“ → „M. K.“
  - „Anna-Lena Schmidt“ → „A. S.“
  - „Müller, Max“ → „M. M.“
  - „Özil Ünal“ → „Ö. Ü.“
  - „Max“ → „M.“
  - Kein Buchstabe im Namen → „Kunde“
- **Ort:** je Plattform genau eine Funktion, unmittelbar bevor die Anzeige an das System geht. Kotlin und Swift folgen
  derselben Regel.
- **Gilt für alle Wege:** Server-Antworten der nativen Knöpfe, Projektion aus der App und die Offline-Vorschau (T-140).
- **Der volle Name erreicht das System nie:**
  - Android: kein Feld der Benachrichtigung enthält ihn (Titel, Text, Ticker, Zusatztext).
  - iOS: der Inhaltszustand der Live-Aktivität enthält ihn nicht.
- **Was bleibt:** Die Benachrichtigung bleibt öffentlich sichtbar und behält ihre Knöpfe. Speicher und Server bleiben
  unverändert.
- **Rechtstexte im selben Commit anpassen**, weil sie Verhalten beschreiben (AGENTS 7):
  - `ADO/06_Recht/Verzeichnis_Verarbeitungstaetigkeiten.md` (2.5);
  - `ADO/06_Recht/Beschaeftigten_Information_Art13.md` („Achtung: Dein Sperrbildschirm zeigt Namen“);
  - `docs/store/privacy.md`, falls dort der Name genannt ist.
  - Leser mit `grep` suchen (T-134).

### Teil 2 · „Erfassen“ wie mit Netz (T-140c, PO 31.10.)

- „Erfassen“ und „Manuell erfassen“ zeigen ohne Netz nur noch eins von drei Dingen:
  - die laufende Zeit mit Uhr;
  - die Pause;
  - direkt nach dem Beenden die gerade beendete Zeit als eine Zeile, bis zur nächsten Erfassung.
- Die Liste früherer beendeter Offline-Zeiten erscheint dort nicht mehr.
- „Meine Zeiten“ behält die beendeten Offline-Zeiten mit „offline gespeichert“, bis der Server bestätigt.
- Projektion, Speicherung und Sperrbildschirm-Logik aus T-140 bleiben unverändert.

### Tests und Nachweis

- **Zuerst rot:**
  - Ein Kunde erscheint heute mit vollem Namen auf dem Sperrbildschirm.
  - „Erfassen“ zeigt heute nach zwei Offline-Zeiten beide Zeiten.
- **Gleiche Tabelle in Kotlin und Swift:** alle Beispiele oben, dazu Leerzeichen am Rand, ein Projekt und allgemeine
  Arbeit.
- **Android:** Für einen Kunden enthält die gebaute Benachrichtigung in keinem Textfeld den vollen Namen, auch nicht bei
  „Zeit beendet“ und in der Offline-Vorschau.
- **iOS:** Der Inhaltszustand der Live-Aktivität enthält für einen Kunden nur die Initialen.
- **App:**
  - „Erfassen“: laufend, Pause und gerade beendet.
  - „Meine Zeiten“: Liste bleibt.
  - Der volle Name in der App bleibt.
- **Builds und CI:** Sperrbildschirm-Suite, Swift-Typecheck der nativen Laufzeit samt Widget, Android-Release-Build,
  iOS-JS-Export, ganze CI lokal nachgebaut.
- **Bericht:** `.t141-review/bericht.md` mit einer kurzen Geräteprüfliste für beide Telefone.

### Grenzen

- Kein Deploy, keine EAS-Builds, kein Server, kein Supabase, keine GHCR-Paketaktion, nichts installieren (AGENTS 3).
- Kein Commit vor `APPROVED`.
