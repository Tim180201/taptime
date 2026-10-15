# Aktuelle Aufgabe

> **Stand 15.10.2026:** T-122a abgeschlossen (`e227f63`). Jetzt **T-122b**, danach App-Builds mit Android-Nachtest
> (T-121) und T-024 mit Deploy 6 (T-119, T-121, T-122).

## T-122b · App-Themen und übrige Web-Seiten (D-140)

**Für:** Development · **Risiko:** mittel (App: alle Bildschirme; Web: Seiten mit Fachlogik) · **Zeitbox:** zwei
Sitzungen, eine für die App, eine für das Web; reißt sie, werden die fertigen Teile gemeldet, der Rest wird T-122c.
Kein Server, keine Verträge, keine Migration.

### Vorlage

`ADO/01_Architecture/Web_Entwurf_v2/README.md`: § 6 (App), § 5.5 mit § 8.4 bis 8.6 (Web), dazu § 2 bis § 4 und § 3.5
als Gerüst und Bausteine wie in T-122a. Bei Widerspruch gilt der Text; bei Fragen STOPP und melden. Zeigt der Entwurf
etwas, das keine Antwort heute liefert: weglassen und im Bericht nennen, nicht erfinden (wie in T-122a).

### Umfang

1. **App (§ 6):** zwei Farbsätze in `apps/mobile/src/design/tokens.ts` (dunkel wie heute, hell nach § 2.1 ohne
   `band`), Bildschirme lesen das Thema über einen Hook, keine festen Farben in Screens. Auswahl nach System,
   Umschalter „Hell · Dunkel · Automatisch“ in „Übertragung“ unter dem Konto, gespeichert in `expo-secure-store`;
   Statusleiste folgt. Startbild bleibt dunkel; der Erfassen-Kreis ist im hellen Thema eine dunkle Scheibe.
   Keine Änderung an Erfassung, Offline, Karten oder Texten.
2. **Mitarbeiter und Person (§ 8.4):** Tabelle, Aktionen in der Zeile, Verlauf aufklappbar, ein Zielwähler in
   „Zeit hinzufügen“ und „Zeit ändern“, Rückfrage beim Löschen.
3. **Zeiten prüfen (§ 8.5):** Fälle in Menschensprache, Tageszeiten als kleine Tabelle, drei Ergebnis-Knöpfe, kein
   zweites Auswahlfeld. Hat ein Fall keine klare Übersetzung: STOPP und TL fragen.
4. **Lohnexport (§ 8.6):** Monat vorbelegt, „CSV herunterladen“ als Hauptaktion, Datei heißt „Einzelzeiten (CSV)“,
   Korrekturformular entfällt (läuft über die Person), offene Fälle verlinken zu Zeiten prüfen.
5. **Meine Zeiten, Zugänge:** Gerüst und Bausteine, kein neuer Aufbau.
6. **Betreiber-Bereich und Startseite (§ 5.5):** vollständig im Gerüst; Umschalter der Startseite in der Fußzeile.

### Regeln

- Keine fachliche Änderung: dieselben Wege, dieselben Texte (UI_Leitlinien § 3, D-125), dieselben Fehlerfälle.
- Eine gefüllte Hauptaktion je Seite; Farbe nur mit Bedeutung; Bedienelemente 44 px, Eingabefelder 16 px.
- Keine festen Farben in Komponenten und Screens, nur Variablen bzw. Tokens; ein Test findet jede Hex-Farbe.
- Tests, die den alten Aufbau prüfen, werden mit Begründung angepasst; `scripts/browser/harness.mjs` bleibt.

### Tests

Je Punkt rot vor der Änderung:
- App: Themenwahl (System, Umschalter, Speicherung, Ausfall des Speichers), Kontrastpaare aus README § 2.1 je Thema
  aus den Tokens gelesen, jeder Bildschirm in beiden Themen im Komponententest; Expo-Export beider Plattformen grün.
  Keine Geräteprüfung in dieser Aufgabe (kommt mit den Builds).
- Web: jede Seite in beiden Themen bei 390 und 1440 px, normal und 200 % Schrift, kein Überlauf, axe ohne Befund;
  Fotos nach README § 7 in `.t122b-review/screenshots/`; eine Hauptaktion je Seite; Root-Browsermatrix grün.
- Alle Suiten, Typecheck, Builds und Bundles grün.

### Grenzen

Kein Server, keine Migration, keine Verträge, keine Fachregel. Kein Deploy, kein EAS-Build. ADO nicht ändern.

### Bericht

`.t122b-review/` (report.md, tracked.diff, untracked.txt, screenshots/). Unabhängiges Review in einer Runde, eine
zweite nur bei P1/P2. **Der PO nimmt die Gestaltung anhand der Fotos ab, bevor der TL technisch abnimmt.** Kein Commit
vor `APPROVED` durch den TL. Danach App-Builds, Android-Nachtest (STATUS) und T-024 mit Deploy 6.
