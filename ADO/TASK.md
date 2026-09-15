# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-033 · Gerätetest durch den Product Owner

**Für:** Product Owner · **Risiko:** Die intern gebaute Android-App gilt ohne vollständigen
Gerätetest fälschlich als einsatzbereit. · **Zeitbox:** ein Testlauf · **Grundlage:** APK mit
Quellstand `2b0a5573`, `ADO/04_Operations/Android_Produktionstest.md`

### Ziel

Der Product Owner belegt am echten Android-Gerät den vollständigen Weg von der Installation und
Anmeldung über die NFC-Erfassung bis zum sichtbaren, beendeten Eintrag im Admin-Web.

### Testgegenstand

- Intern installierbare Android-APK mit angezeigtem App-Stand `2b0a5573`.
- `56e975a` hat keine Datei unter `apps/mobile` verändert. Die vorhandene APK bleibt deshalb der
  richtige Testgegenstand; ein Neubau gehört nicht zu dieser Aufgabe.
- Anleitung und Sollverhalten stehen vollständig in
  `ADO/04_Operations/Android_Produktionstest.md`.

### Durchführung

- App-Stand vor dem Test mit `2b0a5573` vergleichen; bei Abweichung abbrechen und melden.
- Installation, Anmeldung, NFC-Einrichtung, Start und Stopp mit demselben Tag sowie die Anzeige
  des fertigen Eintrags im Admin-Web nach der Anleitung prüfen.
- Ergebnis und angezeigten App-Stand in der Smoke-Test-Checkliste festhalten.

### Grenzen

- Keine App-Änderung, kein Neubau und keine neue Distribution.
- Zugangsdaten und privaten Installationslink nicht in Chat, Repository oder Bericht aufnehmen.
- Ein Fehlschlag wird mit dem beobachteten Schritt gemeldet und nicht in dieser Aufgabe behoben.

### Bericht

Vier Punkte gemäß `AGENTS.md`, darin: angezeigter App-Stand, getestetes Gerät, NFC-Ergebnis und
sichtbarer Start-/Stopp-Eintrag im Admin-Web.
