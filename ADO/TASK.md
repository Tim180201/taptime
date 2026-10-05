# Aktuelle Aufgabe

> **Stand 05.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-098 und T-100, Auslieferung mit dem nächsten Deploy
> (vorher T-098b und Fingerabdrücke aus EAS, siehe STATUS). Reihenfolge: **T-101**, dann T-102 → Deploy und App-Builds →
> T-024 → Pilot. Frühere Briefs stehen in der Git-Historie.

## T-101 · Pflichtfelder sichtbar (D-109)

**Für:** Development · **Risiko:** gering, nur Oberfläche · **Zeitbox:** eine halbe Sitzung. `apps/mobile`,
`apps/admin-web`, `apps/operator-web`, gemeinsame Formular-Bausteine. Keine Änderung an Server, Verträgen oder Regeln,
welche Felder Pflicht sind.

### Befund

Beim Einrichten eines Tags tat „Zuordnen“ ohne Bezeichnung nichts, ohne Hinweis (Geräteabnahme 02.10.). Formulare
melden fehlende Pflichtangaben uneinheitlich: teils gar nicht, teils nur oben als Sammelmeldung.

### Auftrag

1. Ein gemeinsamer Baustein je Oberfläche (App, Web, Betreiber-Web) für Pflichtfelder: Nach dem Absenden ohne gültige
   Eingabe wird das Feld rot markiert, direkt darunter steht, was fehlt („Bitte Bezeichnung eingeben“, „Bitte einen
   Kunden wählen“), der Fokus springt zum ersten fehlerhaften Feld, Bildschirmleser bekommen den Hinweis (App:
   `accessibilityLabel`/Live-Region, Web: `aria-invalid`, `aria-describedby`). Der Hinweis verschwindet, sobald das
   Feld gültig ist.
2. Den Baustein in **jedem** Formular mit Pflichtfeldern einsetzen: u. a. Tag zuordnen/Pausen-Tag, Kunde
   anlegen/umbenennen, Projekt anlegen, Einladen, Nachtragen, Zeit ändern/löschen mit Grund, Kontingent, Prüffall
   schließen mit Notiz, Zugang entziehen, Betriebe im Betreiber-Web. Codex listet im Bericht alle gefundenen Formulare
   mit Feldern.
3. Absende-Knöpfe bleiben bedienbar (nicht ausgegraut wegen fehlender Eingabe), damit der Hinweis überhaupt erscheint;
   ausgegraut nur während einer laufenden Anfrage.

### Tests

Je Formular: Absenden ohne Pflichtangabe → Markierung und Text am Feld, kein Netzaufruf; nach Eingabe verschwindet
der Hinweis. Barrierefreiheit (Web: `aria-invalid`, App: Hinweis lesbar). Volle Suiten App, Web, Betreiber-Web,
Typechecks.

### Nicht Teil

Neue Pflichtfelder, Server-Validierung, Gestaltung außerhalb der Hinweise.

### Bericht

`.t101-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
