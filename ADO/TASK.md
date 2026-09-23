# Aktuelle Aufgabe

> **Stand 23.09.2026:** Produktion auf `ff69bfe`. T-072 (iPhone) und T-031 (Startseite) sind auf `main`.
> Reihenfolge: **T-074 → Konsole (T-071-Controller, T-031) und Deploy → T-024 → Pilot Monat 1**; Geräteabnahme
> parallel.
> Der nächste Deploy wartet auf T-074 (D-086). Frühere Briefs stehen in der Git-Historie.

## T-074 · Verwaltung und Betreiber-Bereich am Handy (D-086)

**Für:** Development · **Risiko:** Bedienbarkeit, Rückschritt am PC, Barrierefreiheit
**Zeitbox:** zwei Sitzungen; Reihenfolge Befund → Layouttest (rot) → Verwaltung → Betreiber → Nachweis.
**Grundlage:** D-086, D-031, `UI_Leitlinien.md`, Entwurf `ADO/01_Architecture/Mobil_Entwurf/` (vom PO am
23.09. abgenommen; README dort zuerst lesen).

### Ziel

`admin.tb-infra.de` und `betreiber.tb-infra.de` sind auf dem Smartphone ab 360 px Breite vollständig und
professionell bedienbar — gleiche Funktionen wie am PC, nichts abgeschnitten, kein seitliches Scrollen.
Am PC (ab 1024 px) bleibt die Oberfläche unverändert.

### Auftrag

1. **Befund zuerst:** Alle Ansichten beider Webs bei 360 und 390 px im Browser ansehen — auch Anmeldung,
   Passwort vergessen/neu, Einladung `/willkommen` (Beschäftigte öffnen sie auf dem Handy), Pausenhinweis,
   TOTP-Einrichtung, alle Bestätigungen und Panels. Probleme im Bericht auflisten.
2. **Layouttest im echten Browser** (z. B. Playwright mit Chromium) gegen die gebauten Webs mit festen
   Beispieldaten über eine Test-Capability bzw. abgefangene API-Aufrufe — nie im Produktionsbündel. Je
   Ansicht und Zustand bei 360, 390, 768 und 1440 px: Seitenbreite nie größer als das Fenster, kein
   sichtbares Element ragt heraus, Bedienelemente mindestens 44 px hoch, Eingabefelder mindestens 16 px
   Schrift, axe ohne Verstöße. Erst rot gegen den heutigen Stand, dann grün. Läuft in der CI mit; ist die
   Browser-Installation in der CI nicht tragbar: melden, nicht weglassen.
3. **Verwaltung** nach Entwurf Abschnitt 2: Leiste unten (bis zu vier Bereiche plus „Mehr“, je Rolle aus
   `availableSections`), „Mehr“ als Blatt von unten, schmale Leiste oben mit Betrieb, Bereich, Aktualisieren
   und Standortauswahl; Tabellen werden unterhalb der Handy-Grenze Karten mit denselben Angaben und Aktionen;
   Formulare einspaltig; Bestätigungen als Blatt von unten (Fokus, Escape, Abbrechen wie heute; wird es
   modal, dann konsequent mit Fokusfalle und inertem Hintergrund); Kalender ohne abgeschnittene Tage.
4. **Betreiber-Web** nach Entwurf: Reiter als Umschalter, Kacheln 2 × 2, Betriebe als Karten, „Betrieb
   anlegen“ und „Pausieren / Fortsetzen“ als Blatt; TOTP mit QR und Handeingabe-Schlüssel ohne Zoomen.
5. **Für alle:** `viewport-fit=cover` mit `env(safe-area-inset-*)`, passende `inputmode`/`autocomplete`,
   Hoch- und Querformat. CSP unverändert (keine Inline-Stile). Keine Änderung an Aufrufen, Rechten,
   Texten oder Abläufen — nur Anordnung. Kurzbeschriftungen in der Leiste nur mit Begründung.

### Tests

Layouttest aus Punkt 2 rot → grün; bestehende Suiten beider Webs und Typechecks grün; am PC (1440 px)
Bildschirmfotos vorher/nachher je Ansicht, unverändert bis auf begründete Kleinigkeiten.

### Nicht Teil

Keine neuen Funktionen, keine Server-, API- oder App-Änderung, keine Änderung an der Startseite außer
der Übernahme ihres Layouttests in dieselbe Umgebung; kein Deploy, kein Serverzugriff, keine Geheimnisse.

### Bericht

`.t074-review/` (report.md, tracked.diff, untracked.txt) mit Bildschirmfotos aller Ansichten bei 390 und
1440 px (vorher/nachher). Unabhängiges Review. Kein Commit, kein Push.
