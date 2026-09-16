# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-035 · Kein stiller Datenverlust

**Für:** Development · **Risiko:** Lohndaten können nach einer Serverbestätigung endgültig
verschwinden oder dauerhaft ungesendet auf dem Telefon liegen. · **Zeitbox:** eine Sitzung;
reißt sie, Scope melden und schneiden. · **Grundlage:** bestätigte Gutachtenbefunde B05 und B03

### Vision-Check und Produktgrenze

Die Reparatur fügt keine Nutzerentscheidung hinzu und lässt
`Trigger → WorkEvent → BusinessEngine → TimeEntry`, Append-only-Historie und
Trigger-Agnostik intakt. Vor jeder B05-Umsetzung benennt der Product Owner jedoch verbindlich:

- wie viel bereits bestätigte Arbeitszeit nach einem Ausfall verloren gehen darf;
- bis wann der Dienst nach einem Ausfall wiederhergestellt sein muss.

Development bewertet mindestens fortlaufende Datenbankarchivierung zusätzlich zum stündlichen
Dump und ein befristetes Zweitstück bestätigter Ereignisse auf dem Telefon. Kosten, Betrieb,
Datenschutz, Speicher, Entstehung, Änderung und Entfernung jedes neuen Zustands sind zu nennen.
Erst berichten, dann B05 bauen; die gewählte Grenze wird als eigene Entscheidung dokumentiert.

### B03 · Fehlenden Wecker reparieren

`OfflineSyncScheduler.trigger()` löscht zunächst den vorhandenen Timer. Ist der FIFO-Kopf in
der Datenbank noch nicht fällig, liefern `claimLegacyHead` und `claimHead` `null`; der Zweig
`retry_wait` muss aus der gespeicherten Fälligkeit wieder einen Wecker ableiten, statt die
Warteschlange ohne Auslöser liegen zu lassen.

- Regressionstest mit kontrollierter Uhr und dem echten Fälligkeitsverhalten von
  `OfflineCaptureDatabase`: erster Fehlversuch speichert die Wiederholungszeit; ein zweiter
  Auslöser kommt davor; bis zur Fälligkeit erfolgt kein Senden, zur Fälligkeit genau der Versuch.
- Keine fest hineingeschriebene Sicherheitszahl: Der Weckzeitpunkt wird aus dem vorhandenen
  Kopfzustand abgeleitet. Neue Test-/Produkt-Schnittstellen bilden diese Bedingung ab.
- Pflicht-Gegenbeweis: Ohne die Reparatur muss genau dieser Test rot sein. Die bestehende
  Scheduler-Stichprobe mit vereinfachten Datenbank- und Timer-Stellvertretern genügt nicht.

### Verifikation und Grenzen

- Typecheck einschließlich der Testdatei und vollständige Tests des Mobile-Workspace grün.
- Vorherigen roten Gegenbeweis und anschließenden grünen Lauf getrennt belegen; jeden weiteren
  Fehlschlag untersuchen und mindestens als P2 festhalten.
- Wegen personenbezogener Lohndaten unabhängiges Review durch einen zweiten Agenten; maximal
  zwei Review-Runden, nur P0/P1 blockieren.
- Nicht in diesem Scope: B02/T-036, B06, B07, B08, B09 und Android-Dialog/T-043.
- Kein Deploy und kein Zugriff auf Produktionsdaten. Umsetzung nicht committen oder pushen vor
  `APPROVED`; der beauftragte Dokumentations-Commit wird getrennt sofort gepusht.

### Bericht

Vier Punkte gemäß `AGENTS.md`, darin: vorgeschlagene Verlustgrenze und Wiederanlaufzeit mit
Begründung, empfohlener Weg, B03-Gegenbeweis und Reparatur, Typecheck, Testlauf, Review-Ergebnis
und Hash des Dokumentations-Commits.
