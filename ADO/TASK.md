# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-046 · Der Einrichtungsvertrag trägt Pausen-Tags und beschädigte Einzelzeilen

**Für:** Development · **Risiko:** Eine gelockerte Vertragsprüfung könnte falsche oder
mandantenfremde Einrichtungsdaten anzeigen; ein unversionierter Wechsel könnte den Rückfall auf
die vorherige Oberfläche brechen. · **Zeitbox:** eine Sitzung · **Grundlage:** D-027 und D-045

### Bestätigter Befund

`AdminWriteSessionCoordinator` bildet Arbeits-Zuordnungen mit Kunde, Pausen-Zuordnungen ohne
Kunde und unzugeordnete Tags ohne beides korrekt ab. Die v1-HTTP-Antwort sendet bereits das neue
Feld `assignmentType`; der exakte Parser kennt es nicht und verlangt außerdem bei jedem
`assigned`-Tag einen Kunden. Damit ist die Einrichtungsprojektion heute nicht lesbar.

### Umsetzung

- Den v1-Endpunkt auf seine alte exakte Antwortform zurückführen. Eine neue
  `/v2/administration/setup-projection` liefert `assignmentType`; das Admin-Web wechselt atomar
  auf v2. V1 und seine strenge Prüfung bleiben für einen Rückfall unverändert nutzbar.
- Den Vertrag in `packages/administration-contract` besitzen lassen: Der Backend-Serializer und
  der Web-Parser werden von ihren Laufzeitseiten verwendet. Ein Nahttest führt eine echte
  Backend-Antwort mit Arbeits-, Pausen- und unzugeordnetem Tag durch den Web-Parser.
- Pflicht-Gegenbeweis: Ein unbekanntes Zusatzfeld in der Backend-Antwort macht den Nahttest rot.
  Keine tolerante Feldmengenprüfung und kein Auffangzweig mit Bedeutung.
- Die Antwort-Hülle einschließlich Status, Betrieb, Listen und Seitenzeiger bleibt exakt und
  fail closed. Eine einzelne ungültige Kunden- oder Tag-Zeile wird ausgelassen; die jeweilige
  Anzahl wird über das vorhandene `CountTruth.complete` als unvollständig ausgewiesen.
- Clientfehler mindestens in `unreachable` und `invalid_response` unterscheiden: Netzfehler und
  Zeitüberschreitung gegen unverwertbare Antwort oder ungültigen Seitenzeiger. Jede Zuordnung zu
  einem deutschen Meldungstext ist vollständig und endet in einem `never`-Zweig.

### Entstehung, Änderung und Entfernung

`assignmentType` entsteht ausschließlich aus der bestehenden aktiven Zuordnung, wird vom
Backend unverändert transportiert und verschwindet mit der Antwort; es entsteht kein neuer
persistenter Zustand. Unlesbare Zeilen erzeugen nur die flüchtige Vollständigkeitsmarkierung;
sie wird bei jeder neu geladenen Seite neu aus deren Inhalt abgeleitet und beim Verlassen oder
erneuten Laden des Bereichs entfernt.

### Verifikation und Grenzen

- Typecheck und vollständige Tests von `administration-contract`, `backend-api` und `admin-web`
  grün; nachweisen, dass der Nahttest in der ausgeführten Konfiguration enthalten ist.
- Positiv belegen: Arbeits-, Pausen- und unzugeordneter Tag sind lesbar; eine ungültige Einzelzeile
  lässt gültige Zeilen sichtbar und setzt `complete = false`; ungültige Hülle verwirft alles.
- Kein Deploy, kein Zugriff auf Produktionsdaten, keine Reparatur des Android-Auswahldialogs.
  Die Umsetzung weder committen noch pushen.

### Bericht

Vier Punkte gemäß `AGENTS.md`, darin: Befund, Versionierungsweg, Ort und Gegenbeweis des
Nahttests, Zeilen-gegen-Hülle-Verhalten, Meldungszuordnung, T- und D-Nummer sowie Hash des
Dokumentations-Commits.
