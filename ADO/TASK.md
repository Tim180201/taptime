# Aktuelle Aufgabe

> **Stand 14.10.2026:** T-121 abgeschlossen (`4e64473`). Jetzt **T-122a**, danach T-122b (App-Themen, übrige Seiten),
> dann App-Builds mit Android-Nachtest und T-024 mit Deploy 6 (T-119, T-121, T-122).

## T-122a · Web-Gestaltung mit zwei Themen (D-140)

**Für:** Development · **Risiko:** mittel (nur Oberfläche, aber alle Seiten) · **Zeitbox:** zwei Sitzungen; reißt sie,
werden die fertigen Seiten gemeldet und der Rest wird T-122b. Nur `apps/admin-web`, dazu Farbsätze und Umschalter in
`apps/operator-web` und `apps/landing-web`. Kein Server, keine Verträge, keine App.

### Vorlage

`ADO/01_Architecture/Web_Entwurf_v2/README.md` ist die Vorgabe, Abschnitt für Abschnitt; `web-entwurf.html` daneben
zeigt die vier Seiten in beiden Themen (Richtung A = dunkel, B = hell). Bei Widerspruch zwischen Text und Bild gilt
der Text; bei Fragen STOPP und melden, nicht raten.

### Umfang

1. **Themen (README § 2):** beide Farbsätze als CSS-Variablen, Auswahl nach System, Umschalter „Hell · Dunkel ·
   Automatisch“ im Konto-Block, `data-theme` am Dokument, `color-scheme`. Kontrasttest aus den Variablen (AGENTS 1.6).
   JetBrains Mono selbst gehostet aus `apps/landing-web/public/tag-assets/fonts/`.
2. **Gerüst (§ 3):** Seitenleiste in zwei Gruppen, Kopfbalken im hellen Thema, Seitenkopf mit genau einer gefüllten
   Hauptaktion und dem Symbol-Knopf Aktualisieren, Fußzeile, Fokus ohne sichtbaren Rahmen bei Maus und Touch.
3. **Bausteine (§ 4):** Knöpfe, Felder, Tabelle, Kachel, Karte, Pille, Chip, Balken, Person, leerer Zustand,
   Rückmeldungsband als gemeinsame Komponenten, einmal gebaut, überall verwendet.
4. **Seiten (§ 5.1 bis 5.4):** Übersicht, Kunden mit „+ Kunde anlegen“, Manuell in zwei Schritten, Einrichtung mit
   Reitern (Standorte, Mitarbeiter, Kunden und Projekte, Karten). Das Kundenanlegen wandert aus der Einrichtung in den
   Reiter Kunden; die Logik bleibt dieselbe.
5. **Betreiber-Bereich und Startseite:** nur Farbsätze und Umschalter; der Aufbau folgt in T-122b.
6. **Übrige Admin-Web-Seiten:** bekommen Gerüst, Themen und Bausteine (Seitenkopf, Tabelle), aber keinen neuen Aufbau;
   der folgt in T-122b. Nichts darf in einem Thema unlesbar sein.

### Regeln

- Keine fachliche Änderung: dieselben Wege, dieselben Texte (UI_Leitlinien § 3, D-125), dieselben Fehlerfälle.
- Eine gefüllte Hauptaktion je Seite; Farbe nur mit Bedeutung (README § 1).
- Keine festen Farben in Komponenten, nur Variablen. Ein Test findet jede Hex-Farbe außerhalb der Variablen.
- Bestehende Tests, die Texte und Reihenfolgen prüfen, bleiben gültig; Tests, die den alten Aufbau prüfen, werden
  mit Begründung angepasst.

### Tests

Je Punkt rot vor der Änderung:
- Themen: System hell/dunkel, Umschalter, Speicherung, Ausfall des Speichers; Kontrast je Variable je Thema.
- Jede Seite in beiden Themen, bei 390 und 1440 px, normal und 200 % Schrift: kein Seitenüberlauf, axe ohne Befund.
  Fotos nach README § 7 in `.t122-review/screenshots/`.
- Eine Hauptaktion je Seite (Test zählt gefüllte Knöpfe im Seitenkopf und Inhalt).
- Alle Suiten, Typecheck, Builds und Browserläufe grün.

### Grenzen

Kein Server, keine Migration, keine Verträge, keine App. Kein Deploy. ADO nicht ändern.

### Bericht

`.t122-review/` (report.md, tracked.diff, untracked.txt, screenshots/). Unabhängiges Review in einer Runde, eine
zweite nur bei P1/P2. **Der PO nimmt die Gestaltung anhand der Fotos ab, bevor der TL technisch abnimmt.** Kein Commit
vor `APPROVED` durch den TL.
