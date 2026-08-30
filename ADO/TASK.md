# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-033 · Die App kommt aufs Gerät

**Für:** Codex · **Risiko:** nicht reproduzierbarer oder falsch konfigurierter Testbau
**Zeitbox:** eine Arbeitssitzung · **Grundlage:** T-032 (`846a126`, CI-grün), ADR-0017, D-034

### Ziel

Die auf `main` abgeschlossene Android-App wird mit demselben EAS-Profil wie Bau
`aa00f3e2-dd90-4057-9d86-a2f81b2549ec` als intern installierbare APK gebaut. Der Link wird nur
dem Product Owner im Bericht übergeben, nie im Repository gespeichert.

### Vor dem Bau

- D-034 wortgleich in der vom Technical Lead gelieferten Kurzfassung und mit höchstens zehn
  Zeilen als Dokumentations-Commit sichern.
- Die ausschließlich auf dem Mac des Product Owners liegende Root-`app.json` und die dortigen
  uncommittierten T-028-Änderungen nicht anfassen. Beide als offene Mac-Arbeiten in
  `ADO/STATUS.md` festhalten.
- Den Bau aus einem sauberen Checkout des Code-Stands `846a126` starten.

### Bau und Grenzen

- Profil aus dem Referenzbau nachschlagen, nicht aus dem Namen ableiten.
- Keine Produktiv-Auslieferung und kein Store-Release.
- Der bekannte Testsignierschlüssel wird bewusst nicht verwahrt. Der echte Release-Schlüssel
  bleibt unberührt und verwahrungspflichtig.
- Keine Geheimnisse lesen oder ausgeben; keine Zugangsdaten in Datei, Bericht oder Argumenten.
- Fehlt die EAS-Anmeldung, sofort stoppen. Kein Konto anlegen und keine Zugangsdaten hinterlegen.
- Nicht committen vor `APPROVED`; ausdrücklich beauftragte Dokumentations-Commits sind die
  einzige Ausnahme.

### Bericht

Vier Punkte gemäß `AGENTS.md`, darin: alle Dokumentations-Hashes, nicht erledigte Mac-Punkte,
Build-ID, nachgeschlagenes Profil und persönlicher Installationslink.
