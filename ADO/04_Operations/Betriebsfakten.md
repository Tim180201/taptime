# TapTim.e — Fakten für den Betrieb

Dauerhafte Fakten zu Orten, Werkzeugen und Einstellungen, die der Betrieb und die Entwicklung brauchen. Überschreiben,
nicht anhängen. Stand bis 31.10.: aus `ADO/STATUS.md` hierher verschoben.

- „Taptura“ ist der Arbeitsname; Code, Pakete und Abbilder heißen weiter `taptime`, der sichtbare Name kommt aus
  `shared/product.json`.
- Orte (PO 22.10.): Server `taptime-prod` (CX23) in Nürnberg, Storage Box in Falkenstein, Supabase Central EU
  (Frankfurt). Hetzner Cloud Backups aktiv: täglich gegen 10:45 UTC, sieben Plätze, je etwa 2,5 GB, ganze Platte samt
  Zugangsdaten (D-151); keine Hetzner Cloud Snapshots. AVV mit Hetzner und Brevo offen; bei Supabase ist der Vertrag zur
  Auftragsverarbeitung mit EU-Standardvertragsklauseln Teil der Nutzungsbedingungen (TL 26.10.), eine Kopie verwahren.
- Mac des PO (21.10.): Xcode 26.5 (die aktive Auswahl zeigt auf die Command Line Tools, deshalb je Befehl
  `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`), CocoaPods 1.17.0 über Homebrew, iOS-26.5-Simulator
  (8,5 GB, von Codex ohne Rückfrage geladen; in Xcode unter Einstellungen → Components entfernbar). Damit baut Codex die
  iPhone-App samt Erweiterung lokal unsigniert.
- Jeder Image-Lauf warnt einmal: 74 fehlende Kind-Manifeste von 16 alten Ständen aus dem September. Gewollt (T-098c);
  die Stände bleiben in `known_versions`, ihre Indizes bleiben erhalten.
- Supabase (PO): Registrierung aus, E-Mail-Bestätigung an, Linkdauer 1 h (D-113), Site URL `https://admin.tb-infra.de`.
  Grenzen je 5 min und IP: „sign-ups and sign-ins“ 30 (Passwort setzen, Zurücksetzen, Codes) und „token
  verifications“ 30 (Einladungs- und Rücksetzlinks), beide hebt D-139 auf 100; die Anmeldung mit Passwort zählt unter
  „token refreshes“, 150 samt Sitzungserneuerungen (Quellcode supabase/auth, TL 22.10.). Dazu 30 Mails je Stunde; mit eigenem
  SMTP (Brevo, D-057) ist die Grenze in Supabase einstellbar, Brevo kostenlos 300 Mails am Tag (TL 26.10.); vor dem
  Einladen aller anheben.
- frogs (PO 28.09.): etwa 200 Lehrer, 5 Standorte mit je einer Standortleitung, 400–500 Schüler als Kunden; Start
  womöglich mit wenigen Lehrern. Offene Fragen für den CEO-Termin stehen im PLAN.
- Apps ohne Versionskopf (vor T-096) werden weiter angenommen; Pflicht erst, wenn alle Pilotgeräte einen Build ab T-096
  haben.
- ntfy am Telefon ist an (PO 06.10.). Letzte Meldungen „WAL-Archivierung steht“ (Phase base, einmal lock) am 29.09.
  und 04.10. um 01:20 und 03:45 UTC, also vor dem Deploy von T-093b; seitdem keine. Thema am 23.10. erneuert (T-024).
- Supabase Pro mit der Gewerbeanmeldung, vor den ersten echten Konten (D-130): der kostenlose Tarif pausiert das
  Projekt und sichert die Konten nicht.
- Android: Prüf-APK (`com.tim180201.mobile.productionvalidation`) und Store-App (`com.tim180201.mobile`, EAS-Profil
  `store`) sind verschiedene Apps mit getrennten Daten. Pilotnutzer bekommen nur die Store-App; „App aktualisieren“
  führt immer dorthin. Unter iOS teilen sich beide Profile eine App.
- Lokale Prüfordner, nie committen: UI/UX-Durchsicht und Persona-Walkthrough vom 06.10. in `.audit-ux-2026-10/`,
  Einordnung der 191 Befunde in `.audit-2026-09/`, Reviews in `.tXXX-review/`.
- Hetzner-Konsole: US-Tastatur ohne Einfügen. Auf einer deutschen Mac-Tastatur: `=` ist ´, `-` ist ß, `/` ist -, `:`
  ist Umschalt+ö, `$` ist Umschalt+4, y und z sind vertauscht. Vor jedem Konsolenfoto `clear`.
