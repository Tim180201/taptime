# Aktuelle Aufgabe

> **Stand 04.10.2026:** Produktion: Deploy `b1ecb8c` (T-091 bis T-094, T-093b, Migrationen bis 042), App-Builds iPhone 5
> und Android 12. Reihenfolge: **T-094b**, dann **T-103** (je ein eigener Chat), danach T-095 bis T-098, T-100 bis T-102 →
> dritter Deploy und App-Builds → T-024 → Pilot. Frühere Briefs stehen in der Git-Historie.

## T-094b · Passwort zurücksetzen über eine eigene Seite (Geräteabnahme 04.10.)

**Für:** Development · **Risiko:** Anmeldung, Zugangsweg · **Zeitbox:** eine halbe Sitzung. Nur `apps/admin-web`, deren
Tests, `docs/T-047-*`, `infrastructure/DEPLOY.md` (Abschnitt Supabase), in der App nur ein Text (4). Kein Backend, kein Caddy.

### Befund

Geräteabnahme 04.10. (`b1ecb8c`, iPhone 5/Android 12): „Passwort vergessen“ in der App, Link in der Mail → die Anmeldeseite
erscheint, nicht „Neues Passwort setzen“; die Adresse endet auf `/uebersicht`. Die Rücksetz-Mail nutzt vermutlich die
Standardvorlage (`{{ .ConfirmationURL }}`): Schon das Öffnen des Links (auch Vorabruf durch Mailprogramme) verbraucht das
Einmal-Token bei Supabase; danach landet nur `#error=…` auf der Site URL, das die Seite still als Anmeldung zeigt, und die
Routenbereinigung entfernt den Anker. Die Einladung hatte dasselbe Problem und löst es seit T-047 mit `token_hash` im
Anker und Prüfung erst beim Absenden (`/willkommen`).

### Auftrag

1. Neue Seite `/passwort-neu` nach dem Muster von `/willkommen` (`SupabaseInviteAuth`, `WelcomePage`): Token aus dem Anker
   (`#token_hash=…&type=recovery`), Anker vor dem ersten Rendern entfernen, nur im Speicher; `verifyOtp` mit `type:
   'recovery'` **erst beim Absenden** des neuen Passworts, dann `updateUser`, dann lokale Abmeldung. Erfolg: „Passwort
   geändert. Melde dich jetzt in der App oder hier mit dem neuen Passwort an.“ Abgelaufen/benutzt: „Der Link ist
   abgelaufen oder wurde schon benutzt. Fordere in der App oder hier unter „Passwort vergessen“ einen neuen an.“ Gleiche
   Mindestlänge und Fehlerabbildung wie bei der Einladung.
2. Kommt die Startseite mit `#error=…` oder `#error_code=…` an (alte Vorlage, verbrauchter Link), zeigt die Anmeldung
   denselben Hinweis „abgelaufen oder schon benutzt“ statt still nichts. Der bisherige Weg mit `#access_token…&type=recovery`
   bleibt bis zur Umstellung der Vorlage funktionsfähig.
3. Neue Vorlage „Reset Password“ als Datei `docs/T-094b-Ruecksetzvorlage.md` (Deutsch, Taptura, Link
   `{{ .SiteURL }}/passwort-neu#token_hash={{ .TokenHash }}&amp;type=recovery`), dazu der Schritt für den PO in
   `DEPLOY.md`: **erst nach dem Deploy** im Supabase-Dashboard einsetzen; Redirect-Liste bleibt unverändert.
4. App-Text nach „Passwort vergessen“ prüfen: sagt, dass das neue Passwort auf einer Webseite gesetzt wird.

### Tests

Rot vor Grün: (1) `/passwort-neu` mit gültigem Anker: kein Netzaufruf vor dem Absenden, Anker sofort aus der Adresse,
`verifyOtp` mit `recovery`, dann `updateUser`, dann Abmeldung; (2) abgelaufenes/benutztes Token → Hinweis, keine Anmeldung;
(3) Startseite mit `#error=access_denied&error_code=otp_expired` → Hinweis an der Anmeldung, Anker entfernt; (4) alter
`#access_token`-Weg unverändert grün; (5) Token erscheint nie in Zustand, Speicher, Protokoll oder Folgenavigation
(Muster der `/willkommen`-Tests); (6) Caddy liefert `/passwort-neu` über den vorhandenen Rückfall auf `index.html` (Test
über die echte Grenze wie T-090).

### Nicht Teil

Keine Änderung an Einladung, Supabase-Einstellungen durch Codex, App-Code ausser Text (4), Backend.

### Bericht

`.t094b-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.

## T-103 · Erfassen: laufende Zeit sichtbar, mit einem Klick beenden (D-112, D-117)

**Für:** Development · **Risiko:** Erfassungsweg (manuelle Ereignisse), Lesevertrag eigener Zeiten · **Zeitbox:** eine
Sitzung. App (`apps/mobile`), Admin-Web (`apps/admin-web`), Vertrag (`packages/mobile-work-contract`), Lesepfad der
eigenen Zeiten im Backend. Keine Änderung an Engine, Lebenszyklus-Routen, Offline-Warteschlange oder Datenbankschreibern. Dazu eine `.easignore` (C).

### Befund

1. App „Manuell erfassen“ und Web „Manuell“ zeigen eine Zielliste mit „Jetzt erfassen“ („Taptura entscheidet über Start
   oder Stopp“). Was gerade läuft, steht nicht da; eine laufende Zeit zu beenden verlangt, das richtige Ziel zu finden.
   Im Web stehen Ziele und „Pause“ in einer Radioliste (PO, 03.10.: „macht aktuell Probleme“).
2. Die eigene laufende Zeit kommt über `/v1/mobile/own-time/query`, aber `activeRecord` trägt keine `targetId`, und eine
   laufende Pause ist nicht darstellbar (`calendar.breakIntervals` kennt nur beendete Pausen). Die Parser sind exakt; ein
   zusätzliches Feld würde alte Apps brechen.
3. Texte verweisen noch auf den „Pausen-Tag“ (entfallen mit D-047/D-096), z. B. `work_trigger_during_break_rejected`.

### Auftrag

**A. Lesevertrag.** Neue Antwortversion der eigenen Zeiten per `Accept` (Muster `TIME_CALENDAR_ACCEPT`, z. B.
`time-calendar.v2`): `activeRecord` trägt zusätzlich `targetId` und den Beginn einer laufenden Pause (oder `null`).
Ältere `Accept`-Werte bekommen byte-gleich die bisherige Antwort. Grenzen wie heute (nur eigene Mitgliedschaft, SQL).
Wenn die laufende Pause dafür einen neuen Leser braucht: Migration 043, nur lesend, gleiche Rechte-Muster wie 041/042.

**B. Oberfläche, App „Erfassen“/„Manuell erfassen“ und Web „Manuell“, alle Rollen, eigene Zeit:**

- **Zeit läuft:** oben „Läuft seit 08:12 · Kunde X“ mit Dauer, darunter „Zeit beenden“ (Hauptknopf) und „Pause starten“.
- **Pause läuft:** „Pause seit 10:30 · Kunde X“, „Pause beenden“ (Hauptknopf) und „Zeit beenden“.
- **Nichts läuft:** Ziel wählen (Suche wie heute, Gruppen Kunden/Projekte/Allgemeine Arbeit), dann „Zeit starten“. Kein
  Pausen-Eintrag in der Zielliste. Im Web Auswahl ohne Radioliste mit „Pause“.
- „Zeit beenden“ sendet das bestehende manuelle Ereignis für das laufende Ziel (`targetType`, `targetId` aus A); „Pause
  starten/beenden“ das bestehende Pausen-Ereignis. **Während einer Pause** sendet „Zeit beenden“ zuerst das
  Pausen-Ereignis und erst nach bestätigtem `break_stopped` das Ereignis für das Ziel (D-117); jede andere Antwort beendet
  die Folge mit ihrer eigenen Meldung.
- **Rückmeldung** nach Bestätigung, aus den neu geladenen eigenen Zeiten: „Zeit gestartet · Kunde X · 08:12“, „Zeit
  beendet · Kunde X · 08:12–11:47 · 3 h 35 min“, „Pause gestartet · 10:30“, „Pause beendet · 10:30–10:52 · 22 min“.
  Abweisungen und `deferred` wie heute, nur ohne „Pausen-Tag“.
- Nach jeder Aktion und beim Öffnen werden die eigenen Zeiten neu geladen; während eine Anfrage läuft, sind alle Knöpfe
  gesperrt (keine Doppelereignisse). Die Engine entscheidet weiter; die Oberfläche schliesst nur aus ihrem Stand, welcher
  Knopf sichtbar ist.
- **Offline (App):** Der Offline-Bildschirm bleibt im Ablauf wie heute; oben steht der zuletzt bestätigte Stand mit
  „Stand 08:15, offline“. Keine neuen Offline-Ereignisarten.
- „Manuell starten“ auf dem Scan-Bildschirm heisst danach „Manuell erfassen“; wenn etwas läuft, zeigt der Bildschirm
  darunter knapp „Läuft seit … · Ziel“.
- T-082 (Pausen-Knopf, D-096) ist damit erledigt; die 45-Minuten-Erinnerung aus D-096 gehört nicht dazu.

**C. Bau-Paket der App.** Eine `.easignore` im Repository-Wurzelverzeichnis, die alles aus den `.gitignore`-Dateien
übernimmt und zusätzlich `.audit-*/` und `.t[0-9]*-review/` ausschliesst (EAS liest `.git/info/exclude` nicht; das Paket
vom 04.10. war 116 MB gross, die versionierten Dateien sind rund 19 MB). Nachweis mit `eas build:inspect --stage archive` (ohne Bau): keine Prüf- oder
Analyseordner, keine `node_modules`, keine `.env*`, Grösse im Bericht.

### Tests

Rot vor Grün: (1) Vertrag: alte `Accept`-Werte unverändert (Snapshot), neue Version mit `targetId` und laufender Pause,
fremde Mitgliedschaft liefert nichts; (2) App und Web je Zustand (nichts läuft, Zeit läuft, Pause läuft, offline):
richtige Knöpfe, Texte, Sperre während der Anfrage; (3) „Zeit beenden“ sendet genau ein Ereignis mit dem laufenden Ziel;
während einer Pause genau zwei in Reihenfolge, das zweite nur nach `break_stopped`; (4) Rückmeldung mit Ziel, Uhrzeit und
Dauer aus dem neu geladenen Eintrag; (5) Ende-zu-Ende gegen die echte Datenbank: Start, Pause, Zeit beenden aus der Pause
ergibt einen Eintrag mit Pause und gleiche Dauer in Kalender und Export. Alle Suiten, die Migrationen nachspielen, lokal
(Lehre aus T-086); CI-Bauordnung prüfen (Lehre aus T-091).

### Nicht Teil

Sperrbildschirm und Benachrichtigungen (T-104), Pausen-Erinnerung, Erfassen für andere Personen, Nachtragen, neue
Ereignisarten, Änderungen an Engine oder Warteschlange.

### Bericht

`.t103-review/` (report.md, tracked.diff, untracked.txt), mit Bildschirmfotos oder Textbeschreibung je Zustand für App und
Web. Unabhängiges Review. Kein Commit vor `APPROVED`.
