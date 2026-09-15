# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-041 · Der lokale Speicher entsteht wirklich

**Für:** Development · **Risiko:** Die Mobile-App blockiert jede Erfassung, wenn das
verschlüsselte lokale Schema nicht von echter SQLite ausgeführt werden kann; eine unbereinigte
Diagnose könnte zugleich Geheimnisse oder Personendaten offenlegen. · **Zeitbox:** eine Sitzung ·
**Grundlage:** bestätigter Befund D-040, APK-Stand `2b0a5573`

### Ziel

Eine jungfräuliche lokale Datenbank lässt sich vollständig mit SQLCipher initialisieren. Die
normale CI lässt jede Anweisung des vollständigen Schemas von einer echten SQLite-Maschine
ausführen und die App protokolliert bei einem Schutzfall ausschließlich Schutzklasse,
SQLite-Fehlercode und bereinigten Meldungstext.

### Umsetzung

- Vor jeder Reparatur jede aus `OFFLINE_SCHEMA_V4` abgeleitete Anweisung einzeln mit
  `node:sqlite` ausführen und sämtliche unabhängigen Fehler erfassen.
- In jeder fehlerhaften Tabelle Spaltendefinitionen vor Tabellen-Bedingungen anordnen; die
  Bedingung bleibt inhaltlich unverändert.
- Einen Test im normalen Mobile-Testlauf ergänzen, der das vollständige Produktionsschema mit
  echter SQLite ausführt. Gegenbeweis: Eine absichtlich syntaktisch beschädigte Variante muss
  von derselben Prüfstrecke abgewiesen werden.
- Schutzklasse und bereinigte SQLite-Ausnahme protokollieren. Erlaubt sind nur Klasse,
  SQLite-Fehlercode und Meldung; Schlüssel, Token, SQL, Parameter, Datenbank- und Personendaten
  sind ausgeschlossen.
- Bestehende Tests benennen, die über `MemoryOfflineDatabase` oder ein SQLite-Fake
  Schema-Verhalten behaupten, ohne SQL zu parsen; kein Umbau außerhalb des neuen Echttests.

### Entstehung, Änderung und Entfernung

- **Anlegen:** Development legt Echttest und minimale Diagnose im Mobile-Workspace an.
- **Ändern:** Jede Änderung am lokalen Schema hält den Echttest im selben Diff aktuell; jede
  neue Schutzklasse bleibt Teil der geschlossenen Diagnosezuordnung.
- **Entfernen:** Der Echttest darf nur entfallen, wenn ihn im normalen CI-Lauf eine gleichwertige
  Prüfung des vollständigen Produktionsschemas mit echter SQLite ersetzt. Die Diagnose darf nur
  durch eine mindestens ebenso datensparsame Diagnose ersetzt werden.

### Verifikation und Grenzen

- Mobile-Typecheck und vollständiger Mobile-Testlauf grün; nachweisen, dass der Test in der
  ausgeführten CI-Konfiguration enthalten ist.
- Positiver Echttest und negativer Gegenbeweis werden getrennt belegt.
- Unabhängiges Review wegen lokal gespeicherter personenbezogener Daten und Diagnosegrenze.
- Keine Änderung der Oberflächenmeldung, kein APK-Bau und kein Testprotokoll.
- Dokumentations-Commit getrennt vor der Umsetzung; Umsetzung weder committen noch pushen.

### Bericht

Vier Punkte gemäß `AGENTS.md`, darin: Gesamtzahl der Vorher-Fehler, Reparatur, Echttest samt
Gegenbeweis, benannte Fake-Tests, T-Nummer und Hash des Dokumentations-Commits.
