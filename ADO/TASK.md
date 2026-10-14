# Aktuelle Aufgabe

> **Stand 13.10.2026:** T-116a abgeschlossen (`2596899`, `a9d5c54`; Migrationen 053, 054; D-134, D-137), noch nicht
> ausgeliefert. Jetzt T-116b. Danach T-117, T-118 und T-120, dann Deploy 5 mit neuen App-Builds.

## T-116b · Oberfläche und Kleinigkeiten vor dem Pilot

**Für:** Development · **Risiko:** mittel bis hoch (Migration 055 mit Berechtigungsausnahme und Sortierung, Startablauf
unberührt) · **Zeitbox:** ein bis zwei Sitzungen; reißt sie, entfällt zuerst Teil 3. App, Web, Server, Caddy. Kein Deploy.

### Teil 1 · Oberfläche

1. **Manuell, App** (`ManualCaptureScreen.tsx`): Die Karte mit „Zeit starten“ steht heute unter der ganzen Liste. Neu
   eine feste Leiste unten, außerhalb der Liste, direkt über der Tab-Leiste: sichtbar nur ohne laufende Zeit und mit
   gewähltem Ziel, mit Zielnamen und „Zeit starten“. Sie scrollt nicht mit; bei großer Schrift bricht der Name um, der
   Knopf bleibt sichtbar. Die Auswahl wird angesagt („Ausgewählt: NAME“). Blendet die Suche das gewählte Ziel aus, wird
   die Auswahl gelöscht (wie im Web). **Web „Manuell“** (`ManualView.tsx`): Startknopf `position: sticky` am unteren
   Rand, auf kleinen Bildschirmen über der mobilen Navigation.
2. **Karten, App** (`AdminSetupScreen.tsx`): „Karte einrichten“, „Karte prüfen“, „Scan abbrechen“ sowie Ergebnis,
   „Karte entfernen“ und Rückfrage stehen über der Kartenliste. „Weitere Karten laden“ und „Aktualisieren“ bleiben
   darunter.
3. **Pausen als eigene Zeilen** in beiden Kalendern (`apps/mobile/src/screens/TimeCalendar.tsx`,
   `apps/admin-web/src/TimeCalendar.tsx`), also „Meine Zeiten“ und Personenansicht in App und Web. Ein Eintrag mit
   Pausen zeigt chronologisch Abschnitte, auf den gewählten Tag zugeschnitten (`calendar.breakIntervals`):
   „08:00–10:00 · Kunde X · 2:00 h“, „10:00–10:30 · Pause · 0:30 h“, „10:30–12:00 · Kunde X · 1:30 h“. Der Eintrag bleibt
   eine Gruppe: Herkunft, Verlauf und Knöpfe (Ändern, Löschen, Kommentar) stehen einmal darunter. Ohne Pause wie heute;
   die Zeile „0:00 h Pause“ entfällt. Eine laufende Pause zeigt „seit HH:MM · Pause“, wo `breakStartedAt` vorliegt.
   Summen bleiben. Nur Darstellung: keine Änderung an Verträgen, `break_intervals` oder Lohnexport. Die Tabelle
   „Arbeitszeiten“ im Web bleibt ohne Pausen (keine Daten im Vertrag).
4. **„Zeit beendet“** (`packages/mobile-work-contract/src/captureTime.ts`): mit Pause
   „Zeit beendet · Kunde X · 08:12–11:47 · 3:05 h · Pause 0:30 h“, ohne Pause wie heute.
5. **Einladen, App** (`InviteEmployeeScreen.tsx`): Nach Erfolg ist „Einladung senden“ deaktiviert; darunter
   „Weitere Person einladen“, das Formular leert.
6. **Erfolgskarte nach „Passwort setzen“, Web** (`WelcomePage.tsx`): Überschrift „Passwort gespeichert“ mit
   `aria-labelledby`.
7. **Anmeldung, App** (`LoginScreen.tsx`): „Anmeldung gerade nicht möglich“ steht höchstens einmal; „Code S5“ bleibt.
8. **Beschäftigte, Web** (`PeopleShared.tsx`): Spalte „Standort“ nur, wenn nicht nach Standort-Überschriften gruppiert.
9. **`tagReceipt`, App** (`AdminSetupCoordinator.ts`): Nach der Anzeige verbraucht; eine spätere Sitzungsmeldung zeigt
   die alte Antwort nicht erneut. Ein Beleg ohne Kontext erscheint weiterhin genau einmal.

### Teil 2 · Server und Caddy

10. **Migration 055** mit vollständigen Funktionskörpern (`T106FunctionBodies`):
    - **Sortierung nach Schreibweise statt Bytes:** `COLLATE "und-x-icu"` statt `"C"` für Namen in
      `read_managed_active_summary_v3` und `_v4` (Beschäftigte), `read_customer_hours_v1` (Kunden und ihre Personen)
      und `read_mobile_work_targets_v1` (Ziellisten). Sortierung und Blätter-Cursor nutzen dieselbe Collation. Vorher
      in allen genutzten Abbildern prüfen, dass sie existiert (Produktion `postgres:17.10-bookworm`, CI
      `postgres:17.10-alpine`); fehlt sie irgendwo, stoppen und melden.
    - **Eigene Zeiten der Standortleitung unabhängig vom Heimatstandort (D-131):** In `backfill_time_record_v1`,
      `correct_time_record_v1` und `prepare_administration_stop_v1` entfällt die Bereichsprüfung, wenn die Zeit der
      handelnden Person gehört; die Rollenprüfung bleibt. `has_time_management_authority_v1` bleibt unverändert (Lesen,
      Prüffälle).
11. **Caddy:** `/app/` und `/tag/` leiten mit 308 auf `/app` bzw. `/tag`. `/app/unknown` bleibt hinter dem Passwort.

### Teil 3 · Tests durchsehen (Zeitbox eine Stunde)

12. Tests suchen, die feste Kalenderdaten neben relativen Fenstern verwenden (jetzt, Vormonat, 24 h) oder Ergebnisse
    von Effekten ohne `waitFor` prüfen. Offensichtliche Fälle wie `80bbb3a` und `4598d25` beheben; den Rest mit
    Einschätzung in den Bericht.

**Nicht dabei:** Name im Kopf der App (braucht eine neue Sitzungsversion mit Namen; bleibt Kleinigkeit). Pausen in der
Web-Tabelle „Arbeitszeiten“.

### Tests

Je Punkt rot vor der Änderung, auch für SQL (vollständiger fachlicher Rotlauf, nicht nur ein abgebrochener):
- Leiste: erscheint nur mit Auswahl und ohne laufende Zeit, liegt außerhalb der Liste, Auswahl wird beim Ausfiltern
  gelöscht; Web: Knopf sticky. Karten: Knöpfe und Ergebnis vor der Liste.
- Pausenzeilen: Abschnitte, Zuschnitt über Mitternacht, laufende Pause, ohne Pause unverändert, Knöpfe einmal je
  Eintrag. „Zeit beendet“ mit und ohne Pause (`T103Capture`, `T103CapturePostgres` anpassen).
- Einladen nach Erfolg, Überschrift, einfache Anmeldemeldung, Spalte „Standort“, `tagReceipt` nicht erneut.
- SQL: „Ärztehaus“, „Özdemir“, „Abel“, „Zander“ ergeben Abel, Ärztehaus, Özdemir, Zander, auch über eine Seitengrenze.
  Standortleitung mit Heimat außerhalb ihres Bereichs trägt nach, ändert und beendet eigene Zeit; fremde Zeit außerhalb
  bleibt abgewiesen; Mitarbeiter unverändert.
- Caddy: `/app/`, `/tag/` → 308; `/app/unknown` → 401.
- Alle Suiten, Postgres-Tests, Typecheck und Browserläufe grün.

### Grenzen

Kein Deploy, kein Zugriff auf Produktion. 055 ändert keine Daten. Startablauf der App (T-115) und Verträge bleiben
unverändert. ADO nicht ändern.

### Bericht

`.t116b-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei
P1/P2. Kein Commit vor `APPROVED` durch den TL.
