# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-045 · Der startauslösende Intent gehört zur neuen Berechtigung

**Für:** Development · **Risiko:** Eine gelockerte Authority-Grenze könnte eine Erfassung unter
fremder Identität oder Mitgliedschaft, aus einem früheren Gerätestart oder ohne Startbezug
verarbeiten. · **Zeitbox:** eine Sitzung · **Grundlage:** Diagnose T-043, D-043 und das lesbare
Vergleichsprojekt `/Users/timbartz/Dokumente/GitHub/frogs-zeiterfassung`

### Ziel

Der Intent, der den Prozess gestartet hat, wird unter der Berechtigung verarbeitet, die durch
genau diesen Start entsteht. Die bestehende Authority-Grenze bleibt für Erfassungen unter einer
anderen Identität oder Mitgliedschaft, aus einem früheren Gerätestart und für beliebig alte,
nicht startursächliche Erfassungen wirksam.

### Umsetzung

- In zwei bis drei Sätzen benennen, welche Verwechslungs- und Angriffsfälle die Grenze schützt,
  bevor die Reparatur festgelegt wird.
- `plugins/withNfcIntentFilters` und `utils/nfcService.js:393` im Vergleichsprojekt als Beleg
  lesen, aber keinen Code übernehmen. Insbesondere prüfen, ob dessen `launchMode = singleTop`
  für den Cold-Start nötig, hilfreich oder irrelevant ist und welche Nebenwirkungen es im
  Vordergrund hätte.
- Ein belastbares Kriterium für „dieser Intent hat den Prozess gestartet“ vorschlagen und
  begründen. Eine Zeitschranke muss aus ihrer Quelle abgeleitet und ihre Zahl begründet sein.
- Den `ExclusiveNfcCaptureArbiter` erhalten: Vordergrunderfassung und Tag-Dispatch dürfen keine
  konkurrierenden NFC-Sitzungen eröffnen.
- Den bestehenden Test „discards a Tag captured before new authority“ in einen positiven Test
  für den startauslösenden Intent und einen wichtigeren negativen Grenztest aufteilen. Der
  Grenztest deckt fremde Identität oder Mitgliedschaft, einen abweichenden Boot-Marker und
  fehlenden Startbezug außerhalb der Schranke ab. Beide Tests begründen im Testtext, warum ihre
  Erwartung richtig ist.

### Entstehung, Änderung und Entfernung

- Führt das Kriterium einen Startbezug ein, muss der Vorschlag festlegen, wer ihn beim
  startauslösenden Intent erzeugt, dass er nach der Erfassung nicht umgedeutet wird und wann er
  nach einmaliger Verarbeitung, Verwerfen, Prozess- oder Gerätestart verschwindet.
- Es entsteht kein fachlicher Datensatz außerhalb der Kette
  `Trigger → WorkEvent → BusinessEngine → TimeEntry`.

### Verifikation und Grenzen

- Mobile-Typecheck und vollständiger Mobile-Testlauf grün; nachweisen, dass die Testdateien in
  der ausgeführten TypeScript- und Testkonfiguration enthalten sind.
- Unabhängiges Review, weil die Änderung eine Identitäts- und Berechtigungsgrenze präzisiert.
- Kalter Gerätetest nach `ADO/04_Operations/Android_Produktionstest.md`: force-stop, Tag
  dranhalten, im weiterhin erwarteten Android-Dialog TapTim.e wählen; ein sichtbarer Stempel muss
  entstehen. Bereinigtes Protokoll und sichtbares Ergebnis belegen.
- Keine Reparatur des Android-Auswahldialogs aus T-043, kein Reader-Mode-Umbau aus T-044, kein
  Deploy und kein Zugriff auf Produktionsdaten. Die Umsetzung weder committen noch pushen.

### Bericht

Vier Punkte gemäß `AGENTS.md`, darin: Schutzzweck der Grenze, Kriterium samt Begründung,
`launchMode`-Ergebnis, beide Tests, Geräteprotokoll, Typecheck und Testlauf sowie T- und D-Nummer
und Hash des Dokumentations-Commits.
