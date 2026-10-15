# Aktuelle Aufgabe

> **Stand 15.10.2026:** T-122b abgeschlossen (`26eed76`). Jetzt **T-105**; parallel baut der PO die Apps und macht den
> Android-Nachtest zu T-121. Danach T-024 mit Deploy 6 (T-119, T-121, T-122, T-105).

## T-105 · Zugänge verwalten (Wunsch PO 04.10., Schnitt PO 15.10.)

**Für:** Development · **Risiko:** hoch (Zugänge, Rollen, Entzug; Migration 059) · **Zeitbox:** zwei Sitzungen, eine
Server und Verträge, eine Web; reißt sie, wird der Serverteil allein gemeldet. Unabhängiges Review (AGENTS § 4, Auth).

### Entscheidung vorab (D-141)

Ein Entzug bleibt endgültig. „Wieder aufnehmen“ (F-153) ist **nicht** Teil dieser Aufgabe; Richtung und Prüfung
stehen in D-141, Umsetzung in T-125. Wer versehentlich entzogen wurde, wird neu eingeladen und bekommt eine neue
Mitgliedschaft; die alten Stunden bleiben unter der alten im Export.

### Umfang

0. **Vorab, im selben Branch:** `T117SearchPostgres.test.ts` scheiterte im CI zu `26eed76` an der Transaktionsfrist
   (Zeile 266, Schleife über alle Rollen; STATUS P2 „Suchtest unter Last“, zweiter Fall). Ursache im CI-Protokoll
   nennen. Härtung nur im Test: eigene, großzügige Frist je Aufruf statt der Produktionsfrist, oder die Schleife in
   Einzelfälle teilen; die Produktionsfrist bleibt. Begründung im Bericht.
1. **Server (Migration 059):** Tabelle `membership_sign_ins` (organization_id, membership_id, first_signed_in_at,
   last_signed_in_at; RLS wie die übrigen Anwendungstabellen, eigener NOLOGIN-Besitzer nach dem Muster aus 058).
   Entsteht beim ersten erfolgreichen `/v1/session` oder `/v2/session` je Zugang, ändert sich bei jeder weiteren
   Anmeldung (nur `last_signed_in_at`), verschwindet mit der Organisation (AGENTS 1.5). Schreibweg: eine
   SECURITY-DEFINER-Funktion `record_membership_sign_in_v1`, aufgerufen nach erfolgreicher Auflösung der Sitzung;
   ein Fehler dort bricht die Anmeldung **nicht** ab, wird aber protokolliert. Kein Schreiben in
   `resolve_request_actor` (jede Anfrage), nur bei der Sitzung.
2. **Lesen:** `read_managed_memberships_v4` liefert zusätzlich `first_signed_in_at`, `last_signed_in_at` und nimmt
   einen Filter `active` (true, false, null). v3 bleibt unverändert; der Vertrag `memberships` in
   `mobile-work-contract` bekommt `active?: boolean | null` in der Anfrage und die beiden Zeitpunkte in der Antwort.
   Prüfung nach AGENTS 1.6: RLS und Besitzer aus dem Katalog, nicht aus Zahlen.
3. **Web, Mitarbeiter-Seite mit zwei Reitern** „Zeiten“ (die heutige Tabelle) und „Zugänge“ (README § 3.3, § 4):
   - Seitenkopf: Hauptaktion „+ Mitarbeiter einladen“ (Administrator; Standortleitung ohne Hauptaktion), Nebentext
     mit „12 Zugänge · Paket 10“ und, falls überschritten, „Paket überschritten, alle Zugänge bleiben nutzbar“ in
     `notice`. Der orangefarbene Absatz entfällt.
   - Suche, Pillen „Alle · Aktiv · Entzogen“ (Serverfilter), Tabelle Person · Rolle · Standort · Anmeldung
     („noch nicht angemeldet“ in `notice` / „zuletzt 14.10.“) · Zugang (Pille aktiv/entzogen) · Aktionen.
   - Aktionen in der Zeile: „Rolle ändern“ öffnet ein Blatt mit den drei Rollen als Auswahl, einem Satz je Rolle
     und bei Standortleitung dem Weg „Verwaltete Standorte zuweisen“; „Zugang entziehen“ mit der heutigen Rückfrage
     und der Prüfung auf laufende Zeit. Entzogene Zeilen ohne Aktionen.
   - Das Einladungsblatt bleibt wie heute; nach Erfolg steht die Person in der Tabelle als „noch nicht angemeldet“.
   - Das aufklappbare Feld „Zugänge verwalten“ entfällt.
4. **Betreiber-Bereich:** keine Änderung.

### Regeln

- Dieselben Schreibwege wie heute für Einladen, Rolle, Entzug; keine neue Berechtigung, kein Umweg um RLS.
- Keine Anmeldezeit in Exporten, Belegen oder Protokollen; sie dient nur der Anzeige.
- Eine gefüllte Hauptaktion je Seite; Texte nach UI_Leitlinien § 3, keine Technik.

### Tests

Je Punkt rot vor der Änderung: Anmeldung erzeugt und aktualisiert den Eintrag, Fehler beim Schreiben bricht die
Sitzung nicht ab; Mandantentrennung der neuen Tabelle (fremde Organisation sieht nichts); Filter aktiv/entzogen; v3
unverändert; Web beide Reiter in beiden Themen bei 390/1440 px und 200 % Schrift, Fotos nach README § 7, eine
Hauptaktion; Root-Browsermatrix; alle Suiten, Typecheck, Builds, Migration 059 gegen PostgreSQL 17 mit Drift-Probe.

### Grenzen

Keine Wiederaufnahme nach Entzug, keine E-Mail-Anzeige, keine App-Änderung, kein Deploy. ADO nicht ändern.

### Bericht

`.t105-review/` (report.md, tracked.diff, untracked.txt, screenshots/). Unabhängiges Review in einer Runde, eine
zweite nur bei P1/P2. Der PO nimmt den Reiter anhand der Fotos ab, dann der TL technisch. Kein Commit vor `APPROVED`.
