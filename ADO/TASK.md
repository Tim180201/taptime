# Aktuelle Aufgabe

> **Stand 06.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-102, T-075, T-106 und T-107 (Migrationen 043–050).
> T-108 und T-110 gehen noch in den dritten Deploy. T-098b wartet auf den PO am Mac (`git show 5071e6e:ADO/TASK.md`).
> Befunde: `.audit-ux-2026-10/selbsterklaerend.md` (SE-…, Begriffsliste in Abschnitt 3) und `report.md` (UX-…), nur
> lokal (D-103).

## T-108 · Selbsterklärend I: Begriffe und Bedienmuster (D-124 bis D-127)

**Für:** Development · **Risiko:** niedrig bis mittel (viele sichtbare Texte, keine Migration) · **Zeitbox:** eine
Sitzung. App, Verwaltung, Betreiber-Web, Landing (`index.html`, `tag.html`), Mail-Vorlagen in `docs/`.

**Grundsatz:** Nur sichtbare Texte, Bedienungshilfe-Beschriftungen und Bedienmuster. Bezeichner, Routen, Verträge,
SQL und die CSV-Datei des Lohnexports bleiben; einzige Ausnahme ist die Kundenauswahl in der Web-Route (UX-007). Weicht
die Begriffsliste des Berichts von D-124 bis D-127 ab, gelten die Entscheidungen.

### Auftrag

1. **Begriffe:**
   - Das Medium heißt je Ansicht beim ersten Auftreten „NFC-Karte“, danach „Karte“/„Karten“ (Reiter „Karten“).
     Aktionen: „Karte scannen“, „Karte einrichten“, „Karte prüfen“, „Zuordnung ändern“. Der Kalendertag bleibt „Tag“.
   - „Beschäftigte“, „Beschäftigte/r“ und die Rolle „Beschäftigter“ heißen „Mitarbeiter“, ehemalige „Ausgeschiedene
     Mitarbeiter“, auch in der Lohnexport-Ansicht. „Person“ im Satz bleibt. Den SQL-Ersatznamen ändert T-110.
   - Web: „Prüfungen“ heißt „Zeiten prüfen“, mit dem Satz aus D-126 wörtlich. Die App hat keinen solchen Bereich; ihre
     Hinweise auf offene Prüfungen lauten „Wird von der Verwaltung geprüft“.
   - Die Seite hinter dem Statuspunkt der App heißt „Übertragung“ und hat einen Bereich „Konto“ mit „Abmelden“
     (Abläufe nach D-120 unverändert); Hinweise wie „Prüfe den Abgleich“ verweisen auf „Übertragung“.
2. **Wortlaut aus der Begriffsliste**, soweit nicht schon in T-107: „Wofür arbeitest du?“ (App) bzw. „Wofür wird die
   Zeit erfasst?“ (Web) mit „Kunde, Projekt oder allgemeine Arbeit“; „Allgemeine Arbeitszeit – ohne Kunde oder
   Projekt“; „Hauptarbeitsstandort“ mit „Der Standort, dem die Person regulär zugeordnet ist.“; „Weitere Standorte, an
   denen die Person arbeiten darf“; „Standorte, die diese Person verwalten darf“; „Standorte verwenden“ mit „Die
   vorbereiteten Standortzuordnungen werden jetzt wirksam.“; einmal „Ihr Betrieb umfasst alle zugehörigen Standorte.“;
   fehlende Zuordnungen als „Für diese Mitarbeiter fehlt der Hauptarbeitsstandort“, „Für diese Kunden fehlt der
   Standort“, sinngemäß für Projekte und Karten, mit direktem Link und lesbarem Namen statt Kennung; „Deutsche
   Ortszeit“ statt „Europe/Berlin“, Folgetag ausgeschrieben; Filter „Zeit läuft“ / „Keine laufende Zeit“; Kunden „Für
   neue Zeiten verfügbar“; „Monatliches Stundenkontingent“ mit „Es dient als Hinweis. Weitere Zeit kann weiterhin
   erfasst werden.“; „Kommentar (optional)“ und „Grund der Änderung (Pflicht)“; „Erfasst mit“, „Entstehung“,
   „Änderungen“ statt „Erfassungsart“, „Herkunft“, „Korrekturstand“; Verwaltungsstopp in der Historie „Von der
   Verwaltung beendet“; Überschneidung „Die Zeit überschneidet sich mit einem anderen Eintrag. Prüfen Sie die Zeiten
   dieses Tages.“; „Dein Konto hat derzeit keinen aktiven Zugang zu diesem Betrieb.“; unter „Manuell erfassen“: „Für
   jetzt. Vergessene Zeiten findest du unter Meine Zeiten → Zeit hinzufügen.“; SE-012 und UX-018 wie im Bericht.
3. **Bedienmuster:**
   - App-Unteransichten mit Pfeil und Zielname an derselben Stelle; Android-Zurück geht eine Ebene zurück, Regeln für
     NFC-Abbruch und Schutzzustände bleiben (SE-008). Web: UX-007 wie im Bericht.
   - UX-003: Die Personenansicht zeigt den Namen; solange er nicht geladen ist, keine Bearbeitung, sondern „Person wird
     geladen …“ bzw. „Person nicht gefunden“ mit Rückweg.
   - Ist die Karte der laufenden Zeit auf „Erfassen“ gesperrt, steht der Grund daneben (z. B. „Deine letzte Erfassung
     wartet noch auf Bestätigung.“, T-107).
   - „Zeit löschen“, „Kunde löschen“, „Zugang entziehen“ und „Zuordnung ändern“ in eigenem Warnstil mit Text, ohne
     zusätzlichen Bestätigungsdialog (SE-009).
   - Mitarbeiter-, Kunden- und Kartenliste der App zusätzlich mit Herunterziehen zum Aktualisieren; nach eigener
     Änderung beim Zurückkehren neu geladen; „Stand 10:42“ sichtbar; kein Neuladen bei offenem Formular oder während
     eines Scans, kein Dauerabruf (SE-010).

### Tests

Je Punkt rot vor der Änderung. Eine Begriffsprüfung über alle sichtbaren Texte findet „Tag“ als Medium,
„Beschäftigte“, „Prüfungen“, „Prüfung erforderlich“ und „Abgleich“ (Ausnahmen: Kalendertag, Routen wie
`/beschaeftigte`, `/pruefungen`). Abmelden aus „Konto“ mit wartender Sicherung, Personenansicht per Direktlink,
Android-Zurück während eines Scans, Herunterziehen bei offenem Formular. Volle Suiten der geänderten Workspaces,
Typechecks, Layoutprüfung der geänderten Ansichten bei 360/390 dp, großer Systemschrift und 1440 px.

### Nicht Teil

Nächster Schritt in der Übersicht, Rollenwechsel-Hinweis, Zeiten prüfen mit Zusammenhang, Monatswähler, SQL-Ersatzname
(T-110); „Kunde“ als „Schüler“ und Erklärung von Kunde/Projekt (F1, D-009); Store-Links (SE-002, T-109); Suche (T-099);
Zugangsverwaltung (T-105); UX-010, UX-012, UX-016; übrige Zeilen der Begriffsliste.

### Bericht

`.t108-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2.
Kein Commit vor `APPROVED`.
