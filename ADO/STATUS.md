# TapTim.e — Status

**Stand 08.10.2026.** Produktion läuft auf `7cd4233` (dritter Deploy 06.10., 19:30–20:00 UTC, `b1ecb8c` → `7cd4233`,
Migrationen 043–051, zwei Probe-Wiederherstellungen grün). Abgeschlossen, CI und Image grün: T-109 (Weg zur App,
`d72ba94`), T-113 (Zeiten im Web, D-131, `2c9f7b8`), T-112 (Karte einrichten, D-132, `280c057`), T-114 („Erfassen“,
`af86406`). Als Nächstes Deploy 4, dann App-Builds und Geräteabnahme.
„Taptura“ ist der Arbeitsname; Code, Pakete und Abbilder heißen weiter `taptime`, der sichtbare Name kommt aus `shared/product.json`.
T-098b Teil 1 erledigt (21 Versionen wiederhergestellt), Teil 2 geparkt bis T-098c. UI/UX-Durchsicht und
Persona-Walkthrough vom 06.10. liegen nur lokal in `.audit-ux-2026-10/` (nie committen).
**Weg zum Pilot:** Deploy 4 → App-Builds → Geräteabnahme abschließen → T-024 → Pilot. Pilot als
Einzelunternehmer (D-116): Gewerbeanmeldung, danach Supabase Pro (D-130) und D-U-N-S, AVV und Haftpflicht vor echten
Daten; beide Apps zum Pilotstart in den Stores (D-129). Fertig ist das Produkt, wenn das ausgelieferte,
wiederherstellbare System einen vollständigen Monatsabschluss übersteht.
Ältere Einträge dieser Datei (Deploys, Befunde, erledigte Kleinigkeiten): `git show 1043011:ADO/STATUS.md`.

## Geräteabnahme nach dem dritten Deploy (PO)

**iPhone (07.10.):** bestanden: Anmeldung, Begriffe und Reiter, „Übertragung“ mit Konto, Erfassen mit laufender Zeit und
Pause samt „Zeit beenden“ aus der Pause, offline, Kalender, „Zeit hinzufügen“, Kunden anlegen/umbenennen/löschen,
Mitarbeiter mit Monatswähler und Herunterziehen, „Passwort vergessen“ mit neuer Vorlage, große Schrift.
**Offen:** am iPhone die Scan-Teile (Karte startet und beendet, „Karte prüfen“; bei geschlossener App erscheint nur die
Hinweisseite `/tag`, keine Erfassung, D-081); Android komplett (dort öffnet die Karte die App und erfasst); Web
(Übersicht mit nächstem Schritt, „Zeiten prüfen“, Mitarbeiter mit Monat, Betreiber-Paket); Aussperr-Test mit einem
zweiten Konto; einmal VoiceOver/TalkBack. Nach Deploy 4 die Einladung dieses zweiten Kontos bis „App laden“
durchspielen. Befunde des PO-Tests vom 07.10. sind in T-112 bis T-114 erledigt; „Erfassen“ bereit, laufend und in Pause ohne
Scrollen, Reiter bei großer Schrift. Mit den neuen Builds zusätzlich: je 20 Einrichtungen am iPhone und am Android (am iPhone dreimal bewusst zu
früh wegnehmen, Karten über „Kunde löschen“ wieder frei); Apple-Fenster ohne Haken bei Fehlern; Vibration und Ton
(Stummschalter); Android ohne Systemton, nach dem Einrichten startet keine Zeit, nach einer Erfassung keine zweite.

## Deploy 4 (T-109 und T-113, danach App-Builds mit T-109 bis T-114)

1. **Ziel `af86406`** (Server-Stand wie `2c9f7b8`). Neu: öffentliche Seite `/app`, Caddyfile,
   Verwaltung, Migration 052. Keine neuen Schlüssel, Steuerung unverändert. PO-Schritte aus `infrastructure/DEPLOY.md`
   vorher abfragen. Durch den Caddy-Wechsel ist einmal `curl: (7)` möglich (bekannt). Danach neue App-Builds; der
   iOS-Build kompiliert das neue Signalmodul aus T-112 zum ersten Mal (lokal kein Xcode).
2. **Danach (PO):** Einladungsvorlage aus `docs/T-047-Einladungsvorlage.md` vollständig übertragen (zweiter Link „App
   laden“, neuer Satz zum abgelaufenen Link). `https://tb-infra.de/app` am Handy und am Rechner öffnen: ohne
   Passwortabfrage, „Die App erhalten Sie von Ihrer Verwaltung.“, solange die Links leer sind.
3. **T-098c** nach dem Deploy: Teil 2 von T-098b (`t098b-verify`, lokal `212486d`) bleibt bis dahin geparkt. Der
   Schutzsatz des Servers führt 16 alte Stände aus dem September ohne Kind-Manifeste; bis dahin überspringt jeder
   Image-Lauf die Bereinigung mit einer Warnung (Manifest-404). Das ist gewollt.
4. **Store-Links:** Der PO liefert TestFlight- und Play-Test-Link; Development trägt sie in
   `apps/landing-web/src/appLinks.json` ein (kleiner Auftrag, danach regulärer Deploy). Mit Google Play kommt der
   Fingerabdruck der Play-App-Signatur in `assetlinks.json` hinzu.

## Fakten für den Betrieb

- Supabase (PO): Registrierung aus, E-Mail-Bestätigung an, Linkdauer 1 h (D-113), Site URL `https://admin.tb-infra.de`.
  Grenzen: 30 Mails je Stunde, 30 Anmeldungen je 5 min und IP-Adresse; vor der Ausweitung anheben (T-099).
- frogs (PO 28.09.): etwa 200 Lehrer, 5 Standorte mit je einer Standortleitung, 400–500 Schüler als Kunden; Start
  womöglich mit wenigen Lehrern. Offene Fragen für den CEO-Termin stehen im PLAN.
- Apps ohne Versionskopf (vor T-096) werden weiter angenommen; Pflicht erst, wenn alle Pilotgeräte einen Build ab T-096
  haben.
- Die getrennt verwahrte `.env`-Kopie des PO stammt eventuell von vor dem 04.10. (ohne `SUPABASE_PUBLISHABLE_KEY`);
  mit T-024 ohnehin neu verwahren. Auf dem Server liegt seit 04.10. `/root/env-0410.bak`; mit T-024 entfernen.
- ntfy am Telefon ist an (PO 06.10.). Letzte Meldungen „WAL-Archivierung steht“ (Phase base, einmal lock) am 29.09.
  und 04.10. um 01:20 und 03:45 UTC, also vor dem Deploy von T-093b; seitdem keine. Das ntfy-Thema mit T-024 erneuern.
- Supabase Pro mit der Gewerbeanmeldung, vor den ersten echten Konten (D-130): der kostenlose Tarif pausiert das
  Projekt und sichert die Konten nicht.
- Android: Prüf-APK (`com.tim180201.mobile.productionvalidation`) und Store-App (`com.tim180201.mobile`, EAS-Profil
  `store`) sind verschiedene Apps mit getrennten Daten. Pilotnutzer bekommen nur die Store-App; „App aktualisieren“
  führt immer dorthin. Unter iOS teilen sich beide Profile eine App.

## Beobachten

- Sicherung beim Deploy 06.10.: WAL-Zyklus 64–66 s, `base_seconds` 40 (24.09. noch 200–215 s). Weiter beobachten;
  Export-Grenztest: absolute Laufzeitwarnung beobachten.
- Fehlt zu einem laufenden Eintrag die Zusatzprojektion (043), scheitert das Lesen der eigenen Zeiten (T-103); bei
  wiederhergestellten Einträgen prüfen.
- Android: Bleibt eine Karte nach Ende des Lesemodus (T-112) am Handy, könnte Android sie neu erkennen und an die App
  geben; das Plugin speichert außerdem auch bei Vordergrund-Erkennung eine Erfassung. In der Android-Abnahme prüfen.
- Android 17 zeigt für Tags mit Web-Adresse eine Mitteilung (D-037); am ersten Android-17-Gerät prüfen, ob der App
  Link (T-096) das umgeht.

## Bekannte Kleinigkeiten (P2/P3, offen)

Kurzform; Herkunft in Klammern, Einzelheiten in Git. Einordnung in die Analyse-Pakete mit B16.

- **App:** Kopf zeigt die E-Mail statt „Name · Rolle“, die Sitzung liefert keinen Namen (T-107) · nach einer
  Offline-Aktion bleibt die Karte der laufenden Zeit auf „Erfassen“ bis zur Bestätigung gesperrt (T-107) · „Zeit
  beendet“ nennt die Dauer ohne Pausen, die Uhrzeitspanne enthält sie (T-103) · Einladen-Knopf wirkt nach Erfolg aktiv,
  tut aber nichts (T-101) · Anzeige „wird gesichert“ eines Verwaltungsstopps nur im Speicher · „Meine Zeiten“ nur
  laufender und Vormonat, Summe nur über den geladenen Zeitraum (T-077, T-058) · Kalenderwoche über zwei Monate „nicht
  vollständig geladen“ (T-079) · offline vor einem Rollenwechsel erfasst → Prüffall (T-080) · Abbruch im
  Vorbereitungsfenster des Kontowechsels → Schutzzustand, jede fremde `.db`-Datei im SQLite-Ordner ebenso (T-076) · iOS
  Uhrdatei bei gesperrtem iPhone nicht lesbar (T-072, wichtig für T-073/T-104) · Sitzungsvergleich ohne
  Verwaltungsumfang (T-059) · Android SecureStore prüft das Ergebnis von `commit` nicht · Web-Export der App scheitert an
  `wa-sqlite.wasm` (P2) · eine alte Registrierungsantwort kann nach einer Sitzungsmeldung derselben Person erneut
  erscheinen (`tagReceipt`, T-112) · `NativeAndroidFeedback` bedient auch iOS (Name, T-112).
- **Beschäftigte (T-102):** Sortierung nach Bytes (`COLLATE "C"` wie bei den Kunden), Namen mit Umlaut am Anfang stehen
  am Ende · wird beim Blättern jemandem der Zugang entzogen, können Personen nach ihm auf der nächsten Seite fehlen
  (Aktualisieren hilft) · Spalte „Standort“ steht neben der Standort-Überschrift doppelt.
- **Paket (T-075):** eine nie angenommene Einladung belegt den Platz, bis der Zugang entzogen wird (gewollt, D-087) ·
  `operator_create_organization_v3` ist eine Kopie von v2 mit Paketgröße, v4 (T-107) zusätzlich mit Namen; v2 und v3
  beim nächsten Rückbau entfernen.
- **Web:** globale Aktualisierung lädt Kundenstunden nicht neu (T-084) · Tags für die Standortleitung nur in der App
  (T-062) · ungeteiltes Bündel über 500 kB · Inhaltslinks 44 px, Blatt ohne Überschrift, zweimal „Hauptnavigation“
  (T-074) · „Passwort vergessen“ braucht `SubmitEvent.submitter` (Safari ab 15.4, T-101) · Zeitfehler in
  Lohnexport-Korrektur und „Zeiten prüfen“ nicht mehr per `aria-describedby` an den Feldern (T-113) · Anlegen meldet
  Fehler 23514 als ungültige Eingabe, unbekannter Standort als `forbidden` (T-090) · abgewiesene Prüfposten ohne Erklärung ·
  Erfolgskarte nach „Passwort setzen“ ohne Überschrift (T-109).
- **Server und SQL:** direkter SQL-Pfad `taptime_admin_setup` prüft keine Betriebspause (T-085) · `xmin` über
  `::text::xid` (T-086, mit der nächsten Migration) · Standortleitung mit Heimatstandort außerhalb ihres
  Verwaltungsbereichs kann eigene Zeiten nicht nachtragen (T-062) · mehrere Standort-Grants im Handy-Vertrag nicht
  darstellbar (T-059) · Nachtragen ohne externen Archivnachweis bis T-016 (D-078) · frühere Offline-Prüfgründe vor
  `administration_stopped`, Dreiminutenmeldung kann sich verzögern (T-069) · Geräteuhr bei manueller Erfassung,
  unbegrenzter vergessener Stopp, Offline-Pausenkonflikte ohne aktive Zeit · Lease-Bindung nach Restore (P1, eigene
  Aufgabe T-055).
- **Betrieb:** Deploy-Kantenprüfung zeigt direkt nach dem Caddy-Neustart einmal `curl: (7)`, der nächste Versuch ist
  grün (06.10.) · WAL-Spool gehört UID 999 (Kollision mit `dnsmasq`, T-057) · Kantenprüfung nach dem Caddy-Wechsel
  schließt die Backend-Gesundheit ein (T-031) · `taptime-landing-password` ohne Eingabeaufforderung · systemd meldet
  „unit file changed“ beim Ordnerwechsel · `registered_chain_watermark` liest direkt statt über eine Lesefunktion ·
  Health ohne Cache, alte Caddy-Assets · Caddy-Negativprüfung: EXIT-Trap verliert `holder` · Monitoring-Test braucht
  GNU-Werkzeuge · ShellCheck CI 0.9 gegen lokal 0.11 · DNS-Wildcard nach dem Pilot verengen · `/app/` mit
  Schrägstrich landet bei der Passwortabfrage der Startseite (T-109).
- **Sicherheit:** CSP `*.supabase.co` auf den Aussteller verengen · SECURITY-DEFINER-Pfade und Policy-Prädikate prüfen ·
  Supabase-Anmeldung außerhalb der eigenen Ratenbegrenzung.
- **Entwicklung:** Root-Build mit veralteten Workspace-Deklarationen (Reihenfolge Identity → Administration → API) ·
  Swift-Tests der iOS-Uhr nur auf macOS · Landing-Workflow-Tests nur unter Linux · PostgreSQL-Suiten seriell.
