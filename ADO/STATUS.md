# TapTim.e — Status

**Stand 29.10.2026.** Produktion läuft auf `05bcf51` (gemeinsamer Deploy am 29.10., Deploy 9 und 10: Migrationen 063 bis
068, Controller vorher an der Konsole installiert, Generalprobe und zwei Wiederherstellungsproben grün, vom TL im Log
geprüft). Damit ausgeliefert: T-099b, T-104e, T-135, T-136b, T-137, T-138 und T-123a. Bestand der Sicherung vor dem
Deploy: 1.030 Basen, 7.963 WAL, 26 Marker, noch nie erfolgreich aufgeräumt; die erste Aufbewahrung läuft mit der
stündlichen Sicherung nach 05:25 UTC am 30.10. (Tagesrhythmus), danach stündlich bis `ok`; dann Wochenprobe. Bis zur
ersten grünen Probe kommt die Morgenmeldung weiter. App-Builds aus `05bcf51` (iPhone Build 11 über TestFlight, Android
Version 18): Kurztest am 29.10. bestanden, Lohnexport-Monatsübersicht am echten Download geprüft. Gefunden: T-139
(Android-Karte bei geschlossener App, auf main `09ac588`) und offline keine laufende Anzeige (D-158). Jetzt **T-140**,
danach ein App-Build mit T-139 und T-140 und dessen Geräteprüfung. Davor Deploy 8 (`e577fa8`, 23.10.). T-134
(`5f65fc3`): Rechtstexte auf dem gebauten Stand; offen beim PO: AVV mit Hetzner und Brevo, Drittlandfrage (D-006),
Anschrift und Kontakt. T-123b folgt mit den Antworten von frogs (D-157).
**T-136 gemessen (27.10.):** 20.000 echte WAL-Archive (Borg 1.2.8): monatliche Aufbewahrung einzeln 992 s, gesammelt
28 s. P1: Die Belegprüfung liest `SET\nt` statt `t`, die Aufbewahrung wird immer zurückgestellt, Wochenproben werden
rot. T-136b auf main, wirkt mit dem gemeinsamen Deploy; vorher den Controller-Konsolenschritt
ausführen (DEPLOY.md). Werkzeug `tests/backup-scale/`, Bericht lokal `.t136-review/bericht.md`.
**Befund 27.10. (PO, ntfy):** 03:19 „WAL-Archivierung steht: Sicherung läuft seit 14 min“ (stündliche Sicherung um
02:05 UTC), 08:00 „Wiederherstellungsprüfung fehlgeschlagen“. Am 29.10. per `taptime-status`
geklärt: Aufräumen lief nie (1.029 Basen, 7.954 WAL), Wochenprobe rot, alle Sicherungen erfolgreich, einzelne Nachtläufe
bis 40 min. Behebung T-136b mit dem gemeinsamen Deploy.
**CI 21.10. (T-104a):** Zwei Migrationsvergleiche aus T-116 verglichen ganze Zeilen und scheiterten an der neuen leeren
Spalte `lock_screen_action`; als Test korrigiert (`873cbfd`), danach CI und Image-Lauf grün. Der TL hatte im Review den
Job DA3 nicht nachgebaut; seitdem baut er bei jedem Code-Review die ganze CI nach.
**T-024 Teil B erledigt (23.10.):** alter Deploy-Schlüssel entfernt, Laufzeit-Logins und Betreiber-Zugang rotiert,
neue `.env` verschlüsselt im Passwortmanager, `/root/env-0410.bak` vernichtet, neues ntfy-Thema am Server, im Telefon
und in beiden Healthchecks-Webhooks; Test vom Server und beide Webhook-Tests kamen an. Das erste neue Thema geriet über
ein Konsolenfoto (`cat`-Ausgabe im Verlauf) in den TL-Chat und wurde am selben Tag nochmals gewechselt; vor jedem
Konsolenfoto `clear`. Supabase nach D-139 am 22.10. gesetzt (PO). Zweiter Healthchecks-Check „Tagesprüfung“ (ein Tag,
eine Stunde, Webhook „Tagesprüfung ausgeblieben“) angelegt, `/etc/taptime-monitor/daily-healthchecks.curl` (root, 0600,
112 B) eingerichtet, Test-Ping grün; der Check ist bis Deploy 8 pausiert, der erste Ping danach hebt die Pause auf.
**Pilotgröße T-099a/b:** T-099a (`e577fa8`) fand in frogs-Größe Ausfälle bei eigenen und Personenzeiten, Export,
Kundenmonat, Kontingenten, Standortsuche und Einrichtung. T-099b (`eebe736`, Migration 063) behebt sie; Hauptursache war
die Pausenberechnung über alle Pausen des Betriebs je Zeit. Dazu schlüsselbezogene effektive Zeiten, Standortumfang
einmal je Seite, begrenzte Einrichtungsseiten (F018) und CSV-Streaming bis 58.020 Zeilen mit gemeinsamer 8-s-Frist und
echtem Abbruch (F043). Wiederholungsmessung beider Profile: alle Lesewege mit erwartetem Status, alle 320 Exporte
vollständig, Export der Spitze p95 269 ms. Zwei TL-Runden, unabhängiges Review, CI-Nachbau des TL; die GitHub-CI
scheiterte zuerst an der v4/v3-Grenze 1,30 (Faktor 1,33), TL-Patch `1edb047` setzt 1,50 (D-155). Wirkt mit dem gemeinsamen Deploy.
Bericht lokal `.t099b-review/report.md`.
**T-104e auf main, wirkt mit dem gemeinsamen Deploy (26.10.):** Beide iPhone-Befunde rot belegt: Aktion nach COMMIT trotz Buchung als Fehler,
Kalender-Leseschleife durch nachgeladene Seiten. V2 zeigt Zustand mit „wird gesichert“, alte Builds bleiben bei V1;
Kalenderwechsel erst mit vollständigen Seiten, native Anzeige endet sofort und Android stellt Weggewischtes wieder her.
TL-R1: verlorener Kaltstart-Abgleich (P1-1), stumme Lesefehler (P2-1) und Rollback-Fehler (P3-3) in Runde 2 mit
Rot/Grün korrigiert; Capability-HTTP-Test ergänzt. Quality, vollständiges C2, Android-Release und iOS-JS-Export erneut
grün; kurzer unabhängiger R2-Check und TL-Runde 2 APPROVED. Bericht `.t104e-review/bericht-r2.md`, Prüfliste im selben Ordner.
iOS-Entscheidung TL: kein weiterer lokaler Pod-/Xcode-Versuch, keine Netzfreigabe. Den Gesamtbuild belegt der PO per
EAS aus einer sauberen Kopie des freigegebenen Commits nach grüner CI: beide App-Builds aus `05bcf51` grün (29.10.).
Geräteabnahme steht aus.
**Befund 17.10. (T-132):** Die wöchentliche Wiederherstellungsprobe scheiterte am 11.10. um 03:43 UTC mit „No space left
on device“: Basis und WAL-Kette werden im tmpfs `/run/taptime-backup` entpackt, der zu klein ist. Die Probe beim Deploy
(frische Basis) war am 15.10. grün; die stündliche Sicherung baut ihre Basis im selben tmpfs. Sicherungen laufen; mit
wachsender Datenbank droht aber auch die Sicherung zu scheitern. Am 18.10. scheiterte die Sonntagsprobe erneut; seitdem
meldet die Tagesprüfung um 08:00 jeden Morgen „Wiederherstellungsprüfung fehlgeschlagen“ (PO 22.10., erwartet bis zur
nächsten grünen Probe). Messwerte 22.10.: `/run` 382 MB, RAM 3,8 GB, Datenbank 125 MB, WAL-Puffer 17 MB, Platte 29 GB
frei; die Probe vom 18.10. scheiterte beim Kopieren der vierten WAL-Datei. Behoben mit T-132 (D-150), wirksam ab
Deploy 8; bis dahin kommt die Morgenmeldung weiter.
**GHCR-Vorfall 15.10. (T-130, T-130b):** Der Image-Lauf zu `7e36c58` räumte um 18:47 UTC auf, während Deploy 6
noch lief; `fb28166` stand noch nicht im Schutzsatz, und der Zusatzschutz „neueste zwanzig“ zählte einzelne
Paketversionen. Gelöscht wurden neun Versionen der Produktionsabbilder (Backend, Admin-Web, Operator-Web). Die Produktion
lief mit lokalen Abbildern weiter. Am 16.10. um 04:47 UTC exakt nach Digest wiederhergestellt; die strenge Abrufprüfung
von current und previous samt Konfigurationen und Schichten ist grün. `gh` hat seit 16.10. wieder keine Paketrechte
(`write:packages`, `delete:packages` entzogen). Seit T-131 gilt die Regel „kein Push während eines Deploys“ nicht mehr.
Supabase-Projekt am 14.10. vom PO aufgeräumt (Kopie von vor D-010 entfernt); der Security Advisor meldet nur noch den
Schutz vor geleakten Passwörtern, der mit Pro kommt (D-130, D-139).
„Taptura“ ist der Arbeitsname; Code, Pakete und Abbilder heißen weiter `taptime`, der sichtbare Name kommt aus `shared/product.json`.
T-098b ist mit T-098c abgeschlossen. UI/UX-Durchsicht und Persona-Walkthrough vom 06.10. liegen nur lokal in
`.audit-ux-2026-10/` (nie committen).
**Weg zum Pilot:** T-140 → App-Build mit T-139 und T-140 → Geräteprüfung → Aufbewahrung `ok` und grüne Wochenprobe → restliche Geräteabnahme →
Pilot (D-152; die Wiederholungsmessung mit 063 ist grün). Review ohne Verbindung zum Mac (19.10.): Codex legt den geprüften Stand als Zweig
`review/<aufgabe>` ab, Fotos auf einem verwaisten Zweig `review/<aufgabe>-fotos`; nach APPROVED Fast-forward auf main und beide Zweige löschen. Lohnexport und Business Central: erst
die Antworten von frogs (PLAN, CEO-Termin), dann T-123 und T-124.
Pilot als Einzelunternehmer (D-116): Gewerbeanmeldung, danach Supabase Pro (D-130) und D-U-N-S, AVV und Haftpflicht vor echten
Daten; beide Apps zum Pilotstart in den Stores (D-129). Fertig ist das Produkt, wenn das ausgelieferte,
wiederherstellbare System einen vollständigen Monatsabschluss übersteht.
Ältere Einträge dieser Datei (Deploys, Befunde, erledigte Kleinigkeiten): `git show 1043011:ADO/STATUS.md`.

## Geräteabnahme (PO)

**Deploy 6, 15.10. (Web, Android):** Deploy vollständig (`d193725` → `fb28166`): frische Sicherung, Migrationen 058 und
059 in der Produktion, Probe-Wiederherstellung mit Migrations-Generalprobe, Kantenprüfung und Versionsnachweis grün.
Web gefällt dem PO; zwei Befunde → T-122c: Kopfbalken nur im hellen Thema (Aufbau je Thema verschieden, Fehler im
Entwurf), und der Balken scrollt weg, während die Seitenleiste 56 px tiefer stehen bleibt (Lücke oben links). Dazu
„Administrator · Administrator“ bei Zugängen ohne eigenen Namen und der Betrieb doppelt über jedem Titel. Lohnexport:
Ändern im Monatsfeld macht die Verwaltung leer (P1, TL nachgestellt: ungültiger Zwischenwert, Renderfehler ohne
Fehlergrenze; T-122c); Zeiten des Administrators ohne Namen, weil sein Zugang von vor T-107 keinen Namen hat und
niemand einen Namen ändern kann (T-126). Wunsch PO: Gelöschte und Ehemalige nur bei Monatszahlen und im Archiv
(T-127, D-143); dabei gefunden: „Gerade aktiv“ zeigt Ausgeschiedene, Mitarbeiter → Zeiten lässt sie in älteren
Monaten weg. App-Rückfragen zum Archiv kommen mit dem nächsten App-Build. **Web-Abnahme Deploy 7 bestanden (PO 22.10.):** Balken in
beiden Themen fest oben, auch beim Nachfedern in Safari; eigener Name gesetzt und im Balken; Lohnexport mit Vormonat,
Monatsschalter mit Monatsübersicht; Startseite „Stempelpunkte“. P3: „Name · Rolle“ im Balken ist so blass, dass der PO
ihn zuerst übersah. Android mit
dem Build zu `ad4cd29`: Die Karte wird ohne Antippen erfasst (PO 15.10.); die übrigen Fälle des Nachtests stehen in
der Prüfliste.

**Deploy 5, 14.10., iPhone und Android, Web (31 von 43 Punkten bestanden):** neues Symbol und Startbild, Zeichen in
App und Web, Favicons; Karte startet und stoppt am iPhone, geschlossene App zeigt nur `/tag` (D-081); zwei Karten
nacheinander mit klarer Meldung; offline mit Abgleich von selbst; Vibration und Ton; Karte einrichten mit Suche,
„Karte prüfen“ und „Karte entfernen“, entfernte Karte erfasst nicht; eigene Zeit ändern und löschen ohne Grund,
Standortleitung mit Pflichtgrund; Kunden mit Suche und Detail; Kontingent-Hinweis; Pause als eigene Zeile; Web-Übersicht,
„Zeiten prüfen“, Betreiber-Bereich; Aussperr-Test.
**Befunde:** Android erfasst die Karte nur nach Antippen des Kreises, bei offener wie geschlossener App (P1; Ursache
in T-121 behoben: die Grant-Erneuerung beim Vordergrund verschob die Zeitgrenze der Erfassung hinter die Karte; am Gerät
bestätigt 15.10.) · unter „Meine Kunden und Projekte“ stehen weiter alle (T-121 ✓) · Tastatur bleibt nach Antippen
eines Ziels offen (T-121 ✓) · Symbol „Zeit gespeichert“ im Kreis flackert gelegentlich (P2, Ursache ohne Gerät nicht
erkennbar) · Web: Farben teils zu grell, „Kunde anlegen“ fehlt im Reiter Kunden, „Manuell“ und „Einrichtung“
unübersichtlich (T-122a ✓, D-140).
**Noch offen:** je 20 Einrichtungen am iPhone und am Android; Einladung eines zweiten Kontos bis „App laden“; einmal
VoiceOver und TalkBack; große Schrift; T-115 über Nacht am Ladekabel und zehnmal nach langer Sperre (0 von 10 mit
„derzeit nicht verfügbar“, Code mit Foto melden). **Android-Nachtest zu T-121 mit dem Build nach T-122b,** jeweils ohne
Antippen: offene App, aus dem Hintergrund, beendete App, zwei Karten nacheinander, nach der Verwaltung, offline mit
Abgleich, und morgens als Erstes nach einer Nacht nur im Hintergrund; dabei das Symbol im Kreis beobachten (verschwindet
der Haken, oder schwankt nur Größe/Helligkeit; zusammen mit Scan oder Abgleich?). iPhone unverändert, kurz gegenprüfen.

## Beim PO (nach Deploy 5)

1. **Einladungsvorlage** aus `docs/T-047-Einladungsvorlage.md` vollständig in Supabase übertragen (zweiter Link „App
   laden“, neuer Satz zum abgelaufenen Link); `https://tb-infra.de/app` am Handy und am Rechner prüfen.
2. **Store-Links:** Der PO liefert TestFlight- und Play-Test-Link; Development trägt sie in
   `apps/landing-web/src/appLinks.json` ein (kleiner Auftrag, danach regulärer Deploy). Mit Google Play kommt der
   Fingerabdruck der Play-App-Signatur in `assetlinks.json` hinzu; das 512-px-Symbol liegt in `shared/brand/store/`.
3. **Supabase nach D-139:** am 22.10. gesetzt (PO). Offen bleibt nach Pro der Schutz vor geleakten Passwörtern
   (D-130, `infrastructure/DEPLOY.md`).

## Fakten für den Betrieb

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

## Beobachten

- Image-Lauf zu `d193725` (14.10.): alle fünf Abbilder veröffentlicht, danach brach das Aufräumen alter GHCR-Versionen
  beim Löschen einer Backend-Version mit `unexpected end of JSON input` ab. Die Läufe zu `e227f63` und `fb28166`
  meldete Codex grün; bleibt das so, entfällt der Punkt. Kein manuelles Löschen und kein manueller Neustart.
- Sicherung beim Deploy 06.10.: WAL-Zyklus 64–66 s, `base_seconds` 40 (24.09. noch 200–215 s). Weiter beobachten;
  Export-Grenztest: absolute Laufzeitwarnung beobachten.
- Fehlt zu einem laufenden Eintrag die Zusatzprojektion (043), scheitert das Lesen der eigenen Zeiten (T-103); bei
  wiederhergestellten Einträgen prüfen.
- Android: Bleibt eine Karte nach Ende des Lesemodus (T-112) am Handy, könnte Android sie neu erkennen und an die App
  geben; das Plugin speichert außerdem auch bei Vordergrund-Erkennung eine Erfassung. In der Android-Abnahme prüfen.
- Android 16 kann eine laufende Benachrichtigung als „Live Update“ hervorheben; dann stehen ihre Knöpfe auf dem
  Sperrbildschirm ausgeklappt. Nach der Geräteabnahme von T-104b entscheiden, ob es nötig ist.
- Android 17 zeigt für Tags mit Web-Adresse eine Mitteilung (D-037); am ersten Android-17-Gerät prüfen, ob der App
  Link (T-096) das umgeht.

## Bekannte Kleinigkeiten (P2/P3, offen)

Kurzform; Herkunft in Klammern, Einzelheiten in Git. Einordnung in die Analyse-Pakete mit B16.

- **Android-Karte (T-139, unabhängiges Review R2, P2):** Nach einer geworfenen DB-Leseoperation vor dem Speichern erscheint der Wiederholungshinweis, der Scan bleibt aber bis zur nächsten Sitzungserneuerung gesperrt.

- **T-104e, TL-R1 P3-1:** Fehlt die Archiv-Anforderungszeile nach Prozessende zwischen COMMIT und Registrierung, bleibt `archiveStatus` pending; erneutes Senden derselben Befehls-ID behebt das.
- **T-104e, TL-R1 P3-6:** Android-Wiederherstellen nach Wegwischen und SAVING in `project` nur durch Quelltext-Tests abgedeckt; Nachweis per Geräteabnahme.
- **T-135, unabhängiges Review R1 (P2):** Beginnt eine laufende Zeit während einer Cursor-Seitenfolge der Tageszeiten, fehlt sie gegebenenfalls bis zum Aktualisieren; der neue Leser vergleicht den laufenden Stand nicht auf jeder Folgeseite. Schreibprüfung unverändert.
- **Lokale CI (T-135, P2):** `T104cNative` erreichte beim parallelen Prüf-/Messaufbau das 60-s-Swift-Compilerlimit; unverändert separat in 45 s grün. Ursache Last wird vermutet; Erstfehler bleibt in `.t135-review/ci/ci-quality-10.log`.
- **Test, TL-R1 T-104e (P2):** admin-web `T108Experience` („loads the named person from a later page …“) wackelt unter Last; lokaler R2-Quality-Lauf grün.
- **Lohnexport (T-123a, TL-R1):** Personalnummer mit führendem Bindestrich erscheint wegen des Formelschutzes als `'-…` (P2, Ursache im Brief, mit T-123b) · Zahl „ohne Personalnummer“ in Pilotgröße nicht gemessen (P3) · Monatsübersicht sortiert Umlaute nach Z (P3).

- **Betrieb (T-132, TL-R1, offen):** Borg-Altkonfiguration vor dem Löschen beiseite schieben statt `rm` (Konfliktfall); `Persistent=true` kann nach Neustart Sicherung und Probe zugleich nachholen; `plan_restore_space` ruft für jedes WAL-Archiv `borg list` auf (PITR-Laufzeit); monatliche Einzellöschung mit T-136b durch Sammellöschung ersetzt (wirkt mit dem gemeinsamen Deploy).

- **Export (T-099b, TL-R1, P3):** Fehler vor dem ersten Exportbyte führen zum Verbindungsabbruch statt 503.
- **Export (T-099b, TL-R1, P3):** FOR-SHARE-Sperren auf Akteur, Mitgliedschaft und Betrieb bleiben während des Downloads bestehen (bis 8 s).
- **Export (T-099b, TL-R1, P3):** `ExportConnection.close()` wartet ohne Zeitgrenze auf `client.end()`.
- **Export (T-099b, TL-R1, P3):** Der Abbruch nutzt eine neue Verbindung außerhalb der zehn Plätze.
- **Export (T-099b, TL-R1, P3):** Die Vorab-Zählung zählt die View ohne die Joins von v2 bis v4.
- **Migration (T-099b, TL-R1, P3):** Die Indizes in 063 werden ohne `CONCURRENTLY` angelegt.
- **Export (T-099b, TL-R1, P3):** Ein voller Spitzenmonat braucht beim Client etwa 10 Mbit/s innerhalb der 8-s-Frist.
- **Lokale CI (T-099b, P2):** ShellCheck-Sammellauf vom lokalen VM-OOM-Killer beendet; gleicher Dateisatz mit gleicher
  Linux-Version einzeln grün. Host-v0.11 meldet bestehende SC2329-Hinweise; CI-v0.9 grün, Infrastruktur unverändert.

- **Lokale CI (T-132, P2):** der T-092-Offlinetest mischt Host- und Datenbankuhr; mit PostgreSQL in Colima trat ein ungültiges Zeitdelta auf. Uhrabweichung belegt; kompletter C2-Lauf mit PostgreSQL auf demselben Host grün, Details in `.t132-review/`.
- **Sperrbildschirm iPhone (T-104c):** ein Link, der nach einem Hintergrundstart ankommt, geht verloren (der Start
  landet ohnehin auf „Erfassen“) · das Plugin übernimmt `ios.version` nicht (heute ungenutzt) · Zeitüberschreitung und
  TLS-Fehler gelten als „Noch nicht bestätigt“ statt „Nicht gesendet“ · `requestToContinueInForeground` ist in iOS 26
  abgekündigt, am Gerät prüfen · nach der 8-Stunden-Grenze von iOS erst beim nächsten Öffnen wieder sichtbar ·
  `@expo/plist` ist nur indirekt vorhanden (alle P3).
- **Sperrbildschirm Android (T-104b):** ein 401 beim Ausstellen entfernt Stand und Meldung vor dem zweiten Versuch;
  scheitert dieser, fehlt die Meldung bis zum nächsten Öffnen (P2) · „Wird gesendet …“ bleibt nach Prozesstod bis zum
  Öffnen · „Wird übertragen …“ auch ohne tatsächliche Übertragung (abgelehntes Speichern, angehaltene Übertragung) ·
  nach bestätigter eigener Erfassung einmal „Der Stand hat sich geändert“ · Ablauf von „Zeit beendet“ auf dem
  Hauptthread, Entschlüsseln auf dem JS-Thread · Rennen „gesendet/nicht gesendet“ nur in der Beschriftung ·
  verworfenes Empfänger-Ergebnis bei einem Scan während „Erneut senden“ · `permissionAsked` geht bei
  Entschlüsselungsfehler verloren · der Abgleich verliert eine Änderung während eines laufenden Abgleichs · unter
  Android 7 bleibt „Zeit beendet“ nach Prozesstod bis zum Öffnen (alle P3) · `FOREGROUND_SERVICE` ist gesperrt, der
  WorkManager-Dienst bleibt deklariert und unbenutzt (gewollt).
- **App:** nach gescheitertem Neustart der Laufzeit kann die Sitzung außerhalb der Startreihenfolge starten (T-115,
  P2) · ein dauerhaft
  defekter Android-Schlüsselspeicher zeigt P01 mit „Erneut versuchen“ statt Support-Hinweis (T-115) · Kopf zeigt die E-Mail statt „Name · Rolle“, die Sitzung liefert keinen Namen (T-107) · nach einer
  Offline-Aktion bleibt die Karte der laufenden Zeit auf „Erfassen“ bis zur Bestätigung gesperrt (T-107) · Anzeige „wird gesichert“ eines Verwaltungsstopps nur im Speicher · „Meine Zeiten“ nur
  laufender und Vormonat, Summe nur über den geladenen Zeitraum (T-077, T-058) · Kalenderwoche über zwei Monate „nicht
  vollständig geladen“ (T-079) · offline vor einem Rollenwechsel erfasst → Prüffall (T-080) · Abbruch im
  Vorbereitungsfenster des Kontowechsels → Schutzzustand, jede fremde `.db`-Datei im SQLite-Ordner ebenso (T-076) · iOS
  Uhrdatei bei gesperrtem iPhone nicht lesbar (T-072, wichtig für T-073/T-104) · Sitzungsvergleich ohne
  Verwaltungsumfang (T-059) · Android SecureStore prüft das Ergebnis von `commit` nicht · Web-Export der App scheitert an
  `wa-sqlite.wasm` (P2) · `NativeAndroidFeedback` bedient auch iOS (Name, T-112) · alte App-Builds können nach Deploy 5 gelöschte
  Einträge ohne Grund (`none`) nicht anzeigen, bis der neue Build installiert ist (T-116a) · Suchtest „Kunden“ einmal über
  5 s bei paralleler Last, isoliert 0,7 s (T-118b; zweiter Fall 15.10., Test in T-105 mit eigener Frist gehärtet) · fällt ein Token-Refresh genau mit einer Karte
  zusammen (erster Vordergrund nach über einer Stunde im Hintergrund), kann die Sitzungsbenachrichtigung die Zeitgrenze
  der Erfassung ein zweites Mal verschieben (T-121, P3, Fall „morgens als Erstes“ im Nachtest).
- **Beschäftigte (T-102):** wird beim Blättern jemandem der Zugang entzogen, können Personen nach ihm auf der nächsten
  Seite fehlen (Aktualisieren hilft).
- **Paket (T-075):** eine nie angenommene Einladung belegt den Platz, bis der Zugang entzogen wird (gewollt, D-087) ·
  `operator_create_organization_v3` ist eine Kopie von v2 mit Paketgröße, v4 (T-107) zusätzlich mit Namen; v2 und v3
  beim nächsten Rückbau entfernen.
- **Web:** globale Aktualisierung lädt Kundenstunden nicht neu (T-084) · Tags für die Standortleitung nur in der App
  (T-062) · ungeteiltes Bündel über 500 kB · Inhaltslinks 44 px, Blatt ohne Überschrift, zweimal „Hauptnavigation“
  (T-074) · `/app` bricht bei 200 % Schrift und 390 px mitten im Wort um, ohne Trennstrich (T-120, P3) ·
  Übersicht überschreibt beim Prüfen den Suchstand der Einrichtung (T-118b, P3) · Archiv-Markierungen bleiben nach
parallelem Entzug oder Löschen trotz „Aktualisieren“ bis zum Seiten- oder Monatswechsel alt (T-127b, P2) · am Handy
leere Feldbeschriftungen („Zeiten“ bei Projekten im Archiv, „Hinweise und Aktionen“ in nur lesenden Zeiten, „Aktionen“
bei der eigenen Zeile unter Zugänge) und „gelöscht“ doppelt bei gelöschten Kunden; Archiv-Reiter brechen bei 390 px um
(T-127b, P3) · am Handy dehnt sich die Pille
  „läuft“ in der gestapelten Tabellenzeile über die volle Breite (T-122a, P3) · Admin-Bündel über 500 kB, Vite warnt
  (T-122a, P2, keine neue Bündelarchitektur in der Gestaltung) · „Passwort vergessen“ braucht `SubmitEvent.submitter` (Safari ab 15.4, T-101) · Zeitfehler in
  Lohnexport-Korrektur und „Zeiten prüfen“ nicht mehr per `aria-describedby` an den Feldern (T-113) · Anlegen meldet
  Fehler 23514 als ungültige Eingabe, unbekannter Standort als `forbidden` (T-090) · abgewiesene Prüfposten ohne Erklärung.
- **Server und SQL:** `read_managed_person_time_v2` übernimmt Details und Kalender als Kopie aus v1 (sonst griffe die Frist
  aus D-115); beim nächsten Rückbau auf eine gemeinsame Funktion zurückführen (T-127a, P3) · direkter SQL-Pfad `taptime_admin_setup` prüft keine Betriebspause (T-085) · `xmin` über
  `::text::xid` (T-086, mit der nächsten Migration) · mehrere Standort-Grants im Handy-Vertrag nicht
  darstellbar (T-059) · Nachtragen ohne externen Archivnachweis bis T-016 (D-078) · frühere Offline-Prüfgründe vor
  `administration_stopped`, Dreiminutenmeldung kann sich verzögern (T-069) · Geräteuhr bei manueller Erfassung,
  unbegrenzter vergessener Stopp, Offline-Pausenkonflikte ohne aktive Zeit · Lease-Bindung nach Restore (P1, eigene
  Aufgabe T-055) · C3E2-Test „expired deadline“ einmal rot beim neuen Versuch (13.10., Ursache offen); seit T-116a wird
  eine Verbindung mit gescheitertem ROLLBACK verworfen, beobachten · Rotnachweis der SQL-Tests zum Entfernen fehlt
  (Prozess, T-116a); ebenso für die später ergänzten T-118a-Tests (Parallelität, Historie, Seiten) ·
  `taptime_admin_setup_data_function_owner` liest `memberships` seit 057 ganz statt spaltenweise (T-118a, P3) ·
  `read_mobile_work_targets_v2` und `read_time_backfill_targets_v2` sind seit 057 unbenutzt, beim nächsten Rückbau entfernen.
- **Betrieb:** Deploy-Kantenprüfung zeigt direkt nach dem Caddy-Neustart einmal `curl: (7)`, der nächste Versuch ist
  grün (06.10.) · WAL-Spool gehört UID 999 (Kollision mit `dnsmasq`, T-057) · Kantenprüfung nach dem Caddy-Wechsel
  schließt die Backend-Gesundheit ein (T-031) · `taptime-landing-password` ohne Eingabeaufforderung · systemd meldet
  „unit file changed“ beim Ordnerwechsel · `registered_chain_watermark` liest direkt statt über eine Lesefunktion ·
  Health ohne Cache, alte Caddy-Assets · Caddy-Negativprüfung: EXIT-Trap verliert `holder` · Monitoring-Test braucht
  GNU-Werkzeuge · ShellCheck CI 0.9 gegen lokal 0.11 · DNS-Wildcard nach dem Pilot verengen · MONITORING.md: nach
  `cat ntfy.new` gleich `clear`; für `daily-healthchecks.curl` fehlt eine Befehlsfolge, bewährt hat sich `grep -v '^url'
  healthchecks.curl >`, `read -rs u` und `printf … >>` (T-024, P3, mit der nächsten Runbook-Änderung).
- **Sicherheit:** in T-119 (CSP, SECURITY DEFINER, Policies, Anmeldung nach D-139).
- **Entwicklung:** Root-Build mit veralteten Workspace-Deklarationen (Reihenfolge Identity → Administration → API) ·
  Swift-Tests der iOS-Uhr nur auf macOS · Landing-Workflow-Tests nur unter Linux · PostgreSQL-Suiten seriell · PITR-Test braucht Linux-Werkzeuge und
  Linux-Dateirechte (T-116b) · der Codex-Zweitprüfer verlangt laut `.codex/agents/taptime_reviewer.toml` eine technisch
  schreibgeschützte Umgebung, die Codex nicht bietet, und meldet deshalb formal CHANGES REQUIRED ohne Befund (T-134, P3).
