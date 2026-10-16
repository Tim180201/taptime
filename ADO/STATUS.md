# TapTim.e — Status

**Stand 16.10.2026.** Produktion läuft auf `fb28166` (Deploy 6 am 15.10. abends, Migrationen 058 und 059). Ausgeliefert:
T-119 (D-139), T-121, T-122a, T-122b (D-140) und T-105 (D-141). App-Builds zu `ad4cd29` (T-121, T-122) beim PO,
Prüfliste im Artifact „Abnahme Build T-122“. Auf main, noch nicht ausgeliefert: T-024 Teil A (`7e36c58`, Werkzeug
`taptime-runtime-rotate`, Runbook), T-122c (`e614779`, Kopfbalken in beiden Themen fest oben, ein Monatsschalter,
Fehlergrenzen), T-122d (`df76957`, Browser-Prüfstrecke in drei Teilen) und T-129 (Startseite „Stempelpunkte“,
D-144). **GHCR-Vorfall 15.10. (T-130, T-130b):** Der Image-Lauf zu `7e36c58` räumte um 18:47 UTC auf, während Deploy 6
noch lief; `fb28166` stand noch nicht im Schutzsatz, und der Zusatzschutz „neueste zwanzig“ zählte einzelne
Paketversionen. Gelöscht wurden neun Versionen der Produktionsabbilder (Backend, Admin-Web, Operator-Web). Die Produktion
lief mit lokalen Abbildern weiter. Am 16.10. um 04:47 UTC exakt nach Digest wiederhergestellt; die strenge Abrufprüfung
von current und previous samt Konfigurationen und Schichten ist grün. Der PO entzieht `gh` danach wieder
`write:packages` und `delete:packages`. **Bis T-131 committet ist: kein Push auf main, solange ein Deploy läuft.**
In Arbeit: T-131 (Fix, D-145); danach T-126 (Namen ändern, D-142), T-127a und T-127b (Archiv, D-143). Supabase-Projekt am 14.10. vom PO
aufgeräumt (Kopie von vor D-010 entfernt); der Security Advisor meldet nur noch den Schutz vor geleakten Passwörtern,
der mit Pro kommt (D-130, D-139).
„Taptura“ ist der Arbeitsname; Code, Pakete und Abbilder heißen weiter `taptime`, der sichtbare Name kommt aus `shared/product.json`.
T-098b ist mit T-098c abgeschlossen. UI/UX-Durchsicht und Persona-Walkthrough vom 06.10. liegen nur lokal in
`.audit-ux-2026-10/` (nie committen).
**Weg zum Pilot:** T-131, T-126, T-127a, T-127b → Deploy 7 (T-024a und diese, Migrationen 060 und 061) mit neuem
Deploy-Schlüssel → T-024 Teil B an der Konsole → restliche Geräteabnahme → Pilot. Will der PO Teil B früher, geht
Deploy 7 ohne das Archiv hinaus und T-127 mit Deploy 8. Lohnexport und Business Central: erst die Antworten von frogs (PLAN,
CEO-Termin), dann T-123 und T-124.
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
Monaten weg. App-Rückfragen zum Archiv kommen mit dem nächsten App-Build. Nach Deploy 7 am Mac in Safari prüfen:
bis zum Seitenende scrollen und nachfedern lassen; Balken und Seitenleiste bleiben stehen (in T-122c nicht
automatisierbar, Safari-Fernsteuerung aus). Android mit
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
3. **Supabase nach D-139** (mit T-024): Mindestlänge 10, Anmeldegrenze je IP 100 in 5 min, nach Pro der Schutz vor
   geleakten Passwörtern (`infrastructure/DEPLOY.md`).

## Fakten für den Betrieb

- Jeder Image-Lauf warnt einmal: 74 fehlende Kind-Manifeste von 16 alten Ständen aus dem September. Gewollt (T-098c);
  die Stände bleiben in `known_versions`, ihre Indizes bleiben erhalten.
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

- Image-Lauf zu `d193725` (14.10.): alle fünf Abbilder veröffentlicht, danach brach das Aufräumen alter GHCR-Versionen
  beim Löschen einer Backend-Version mit `unexpected end of JSON input` ab. Die Läufe zu `e227f63` und `fb28166`
  meldete Codex grün; bleibt das so, entfällt der Punkt. Kein manuelles Löschen und kein manueller Neustart.
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
  Übersicht überschreibt beim Prüfen den Suchstand der Einrichtung (T-118b, P3) · am Handy dehnt sich die Pille
  „läuft“ in der gestapelten Tabellenzeile über die volle Breite (T-122a, P3) · Admin-Bündel über 500 kB, Vite warnt
  (T-122a, P2, keine neue Bündelarchitektur in der Gestaltung) · „Passwort vergessen“ braucht `SubmitEvent.submitter` (Safari ab 15.4, T-101) · Zeitfehler in
  Lohnexport-Korrektur und „Zeiten prüfen“ nicht mehr per `aria-describedby` an den Feldern (T-113) · Anlegen meldet
  Fehler 23514 als ungültige Eingabe, unbekannter Standort als `forbidden` (T-090) · abgewiesene Prüfposten ohne Erklärung.
- **Server und SQL:** direkter SQL-Pfad `taptime_admin_setup` prüft keine Betriebspause (T-085) · `xmin` über
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
  GNU-Werkzeuge · ShellCheck CI 0.9 gegen lokal 0.11 · DNS-Wildcard nach dem Pilot verengen.
- **Sicherheit:** in T-119 (CSP, SECURITY DEFINER, Policies, Anmeldung nach D-139).
- **Entwicklung:** Root-Build mit veralteten Workspace-Deklarationen (Reihenfolge Identity → Administration → API) ·
  Swift-Tests der iOS-Uhr nur auf macOS · Landing-Workflow-Tests nur unter Linux · PostgreSQL-Suiten seriell · PITR-Test braucht Linux-Werkzeuge und
  Linux-Dateirechte (T-116b).
