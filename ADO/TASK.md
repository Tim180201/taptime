# Aktuelle Aufgabe

> **Zwischenstand 17.09.:** T-047 ist pausiert (Codex ohne Kontingent, Teilarbeit uncommittet im Arbeitsbaum). In der Zwischenzeit hat der Technical Lead drei kleine Aufgaben umgesetzt: T-040 ✓, CSP ✓, T-039 ✓. T-044 bleibt bei Codex: Der Lesemodus aendert NFC-Verhalten, das nur am Geraet abgenommen werden kann, und der heutige Bildschirmtext beschreibt den heutigen Weg korrekt — ihn vor der Verhaltensaenderung zu aendern, liesse ihn luegen. Diese Datei behaelt den T-047-Auftrag, damit Codex ihn unveraendert wieder aufnimmt.

## T-047 · Beschäftigte aufnehmen können

**Für:** Development · **Risiko:** Kontenerstellung im Anmeldedienst, service-role-Schlüssel
**Zeitbox:** zwei Sitzungen. **Grundlage:** D-048, D-049, D-057. Auftrag vom 17.09.2026.

### Ergebnis und Grenzen

In Beschäftigte: „Mitarbeiter hinzufügen“, Name und E-Mail. Supabase verschickt die deutsche
Taptura-Einladung über Brevo Custom SMTP. Der Link öffnet eine eigene Passwort-Seite im
Admin-Web. Danach: „Jetzt die App öffnen und anmelden.“ Anmeldung führt direkt in die
Mitgliedschaft, ohne Einladungscode. Keine Admin-Navigation oder Verwaltungsdaten auf dieser
Seite. Der zusätzliche Code-Schritt entfällt; Ereigniskette und Originalhistorie bleiben intakt.
Kein Deploy, Produktionszugriff oder echter Supabase-Aufruf aus Tests. Alte Code-Strecke bleibt.

### Umsetzung

1. Backend lädt über den Supabase-Admin-Endpunkt ein. Mitgliedschaft und identity_binding
   (issuer + zurückgelieferter subject) entstehen zusammen in einer Datenbanktransaktion.
   Supabase-Fehler dürfen keine halbe Mitgliedschaft hinterlassen.
2. Eigene Route, etwa `/willkommen`, nimmt das Invite-Token entgegen und setzt das Passwort.
   Erlaubte Redirect-URLs recherchieren und die erforderliche Dashboard-Konfiguration nennen.
3. D-049 wörtlich: Schlüssel ausschließlich in `/opt/taptime/.env`, root-eigen, Modus 0600;
   nie Abbild, Bauargument, argv, Repository oder Chat. Genau eine Operation: Einladen.
   Jede Nutzung diagnostizieren mit Betrieb, Administrator und Zielkonto, ohne Schlüssel oder
   E-Mail im Klartext. Ohne Schlüssel startet das Backend normal; Einladen meldet ausdrücklich
   „Kontenerstellung nicht eingerichtet“.
4. Eigener enger Ratenbegrenzungs-Scope nach `enrollment_redemption`; der Wächter aus T-053
   muss die neue Route automatisch erfassen.
5. Doppelte E-Mail, vorhandene Mitgliedschaft und ausgeschiedene Person sichtbar unterscheiden.
   Tatsächliche Supabase-Antworten recherchieren und abbilden, keine Vermutungen.
6. Unter `docs/`: deutsche Einladungsvorlage (Absender Taptura, Betreff, Text, Link) und PO-Liste:
   DNS bei INWX; Brevo-SMTP in Supabase; Vorlage einsetzen; Redirect freigeben; Schlüssel selbst
   eintragen und Verwahrung bestätigen. Backend enthält keinen Mailcode.
7. Lebenszyklus: Administrator stößt Konto/Mitgliedschaft an; Beschäftigter setzt sein Passwort;
   bestehende Verwaltung ändert/sperrt Mitgliedschaften, Löschfähigkeit bleibt T-016.
   PO legt SMTP, Vorlage, Redirect und Schlüssel an, pflegt/rotiert und entfernt sie im Betrieb;
   Development pflegt die Vorlagendatei. Neue persistente Dinge brauchen denselben Nachweis.
8. Entfällt der letzte produktive Aufrufer der Code-Strecke, als Befund mit Zeilenzahl melden;
   nicht entfernen. Architektur- oder Produktentscheidungen als offene Frage melden.

### Verifikation und Abschluss

Pflichtgegenbeweise: Start und übrige Funktionen ohne Schlüssel; benannter Einladungsfehler;
Supabase-Testdoppel mit erfolgreicher atomarer Bindung und Rollback; Diagnoseprüfung auf
Schlüsselmuster; automatischer Routenwächter; Passwort-Erfolg ohne Admin-Web-Inhalte.
Testsinklusive Typechecks und vollständige betroffene Workspace-Tests, PostgreSQL seriell.
Unabhängiges Review, maximal zwei Runden. Umsetzung nicht vor Technical-Lead-APPROVED committen.
D-057 und dieser Auftrag getrennt vor Umsetzung committen und sofort pushen.
Echte Einladung an echtes Postfach, gelesen am echten Handy, folgt nach Commit und PO-Schritten
(D-044). Bericht nach AGENTS.md §8; ausgelassene Prüfungen mit Grund nennen.

**Development-Stand T-047:** umgesetzt im separaten Arbeitsbaum; TL-Korrektur zu Bestandskonten
mit Rotnachweis umgesetzt. UI-Befund aus Review Runde 2 ebenfalls behoben;
Technical-Lead-APPROVED am 17.09.; Commit, CI und anschließende TL-Integration beauftragt.
Nachweise und Grenzen: `docs/T-047-Verifikation.md`.

**Integration am 17.09.:** T-047 auf main, CI grün; Hauptarbeitsbaum ohne Code-Konflikt integriert.
TL-Korrekturpatch angewandt, genau vier Auth-Gegenbeweise vor Korrektur rot, danach alle 202
Admin-Web-Tests und testsinklusiver Typecheck grün; bash -n, CI-ShellCheck und Deploy-Test grün.
Unabhängiges Korrekturreview Runde 2 APPROVED; drei getrennte Commits mit anschließender CI
beauftragt. Image-Workflow wird nicht unterbrochen; Wiederanlauf und offener Build-Befund in STATUS.md.
