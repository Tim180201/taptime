# TapTim.e — Status

**Stand:** 24.09.2026 · Produktion läuft auf `b635c4a` (Deploy 24.09.: T-031 Startseite `tb-infra.de` hinter
Passwort mit eigenem Caddy-Rückweg, T-074 Verwaltung und Betreiber-Bereich am Handy; Controller `b635c4a` an der
Konsole installiert; Migrationen bis 032). Betreiber-Bereich eingerichtet, Anmeldung mit TOTP bestätigt. iPhone mit
T-072b im TestFlight-Build vom 24.09. abgenommen; Android-APK versionCode 9. „Taptura“ ist der Arbeitsname für den
Pilot; Code, Pakete und Abbilder heißen weiter `taptime`.
Auf `main` zusätzlich T-077 (Meine Zeiten für Führungsrollen, D-090) und T-076 (Kontowechsel am Gerät, ADR-0012 A1).
Offen vor dem Pilot: T-062 (Standortleitung im eigenen Standort, vorgezogen nach D-091), Deploy mit Migration 033,
danach ein App-Build für iPhone und Android mit Geräteabnahme; T-024 (Zugangsdaten rotieren,
Deploy-Schlüssel mit Passphrase); AVV/TOM; Verteilung an Pilot-Beschäftigte (APK, TestFlight extern). Zur
Entscheidung vor T-048: Freigabe manueller Zeiten für Betriebe ohne Tags (D-014). Fertig ist das Produkt, wenn das
ausgelieferte, wiederherstellbare System einen vollständigen Monatsabschluss übersteht.

## Beobachten (TL, 23./24.09.)

- Sicherung am 23.09.: Der Fehlschlag um 06:05 UTC wurde sofort wiederholt und lief erfolgreich; alle Läufe
  seitdem erfolgreich (Journal und `taptime-status`, 24.09.). Die Fehlermeldung selbst ist nicht mehr im Blick.
- Volle Archiver-Abgleiche zeigen `base_seconds=61`; beobachten, ob der Wert mit dem Archiv wächst.
- CI: ShellCheck-Version festlegen (lokal 0.11.0, CI 0.9.0).
- DNS: Wildcard-Eintrag bei INWX nach dem Pilot auf die benötigten Namen reduzieren (api, admin,
  betreiber, `tb-infra.de`, www).
- Spool-UID (P2 aus T-035) offen.
- Sicherungen dauern seit 24.09. 02:05 UTC 13–17 min statt 6–7 min (der Lauf um 02:05 70 min); der Archivierer meldet `base_seconds` 200–215 s (23.09.: 61 s). Ursache prüfen (wachsende Archivliste, `borg check --verify-data`).

## Vorhanden — und seit heute ausgeliefert

- Domäne und Business Engine: `Trigger → WorkEvent → Engine → TimeEntry`, Korrekturen append-only.
- Backend: 11 `apps/backend-*`-Workspaces; 52 registrierte HTTP-Pfade aus `BACKEND_HTTP_ROUTES`,
  jede Route mit Schutzklasse (T-053). 26 Migrationen, in Produktion vollständig angewendet.
- Mobile: Anmeldung, Einladungseinlösung, NFC, manuelle Erfassung, eigene Zeiten, Offline v4,
  Abgleich v2, Leases v3; Queue-Löschung erst nach Archivnachweis (T-052). **Seit `3daa09b`
  (T-058, auf `main`):** Reiter je Rolle, Abgleich hinter dem Statuspunkt, Tap-Moment mit
  Serverentscheidung, Meine Zeiten als Monatskalender in Europe/Berlin, Tags, Manrope, Taptura.
  **Seit `b68e48b` (T-043):** „Tag zuordnen“ schreibt NDEF-URI `https://tb-infra.de/tag` plus
  App-Kennung auf den Tag (D-061); Android öffnet die App ohne Auswahldialog.
  **Seit `1d0a4e9` (T-060):** Eine Standortleitung ordnet Tags im eigenen Standort zu — die
  Grenze entscheidet die Datenbank (Migration 027), der Reiter „Tags" folgt der Sitzung.
  **Seit `91441c8` (T-059):** Reiter Mitarbeiter mit Kachel „x / y gerade aktiv", Liste
  Aktiv/Inaktiv, Kalender je Person und Einladen vom Handy (Migration 028, D-062). Bei
  Administrator und Standortleitung ersetzt er „Meine Zeiten" (D-058) — die eigenen Zeiten
  stehen dort unter der eigenen Person.
- Verwaltung: Beschäftigte mit Kontoeinladung (T-047), Standorte, Arbeitsziele, Tags, Korrektur,
  Prüfentscheidung, Pausen, CSV V3; eine Zeitzone Europe/Berlin (T-036); Anmeldefehler mit
  Ursache (T-040); strikte CSP; Deploy-Tor auf den Backend-Aussteller (T-039).
- Betrieb: T-035 in Produktion aktiv — physische Basissicherung, fortlaufendes externes WAL
  (`pg_receivewal` + Borg), versionierter Archivvertrag (Migration 023), Wiederherstellung am
  18.09. viermal aus dem externen Archiv bewiesen (zuletzt `base-…-20260918T084325Z`, 26
  Migrationen, RLS erzwungen). Rückweg auf ein Image vor 023 ist keiner mehr.
- Mail: Supabase → Brevo (D-057) mit DKIM/DMARC bei INWX; Zurücksetzungs-Mail zugestellt.
- **T-047 am 18.09. am Gerät abgenommen (D-044):** Einladung aus dem Admin-Web, Mail von
  „Taptura“, `/willkommen`, Passwort, App-Anmeldung, Mitgliedschaft ohne Code. Danach als
  Administrator getippt: Vorgang im Admin-Web sichtbar — Rundlauf durch den Archivvertrag.

## Die zwei Deploys am 18.09.

**Abends, 17:05 Uhr — `939b4ba` → `91441c8`: ein Anlauf, ohne Zwischenfall.** Migration 027
und 028 wurden erst in einem Wegwerf-Container aus der letzten Sicherung geprobt, dann
transaktional eingespielt; danach eine frische Basissicherung, extern verschlüsselt abgelegt
und wiederhergestellt. Die engere Vorprüfung (Sicherung am Zeitstempel der Einheit statt an der
Statusdatei) hat sich bewährt und gehört nach T-057 ins Skript.

**Morgens — fünf Anläufe für den ersten T-035-Deploy;** jeder Fehler ein Erstlauf-Fehler, jeder mit
Regressionstest behoben, jeder vorwärts repariert, kein Container von Hand gestartet:

1. `taptime-backup`: `tar --list | grep --quiet` starb an EPIPE bei 280 KB Liste; dazu ein
   EXIT-Trap auf einer `local`-Variablen (`d68ff4d`).
2. `--glob-archives "sh:…"`: Borg 1.2/1.4 sucht das Präfix wörtlich, kein Archiv gefunden;
   der nachgebaute Borg im Test erwartete genau das falsche Muster (`9ea3b31`).
3. `taptime-restore-verify`: derselbe Trap-Fehler wie in 1 (`939b4ba`).
4. Barriere-Fenster 120 s zu knapp für die erste Basis-Registrierung des Archivierers
   (Quittung 08:31:27, Fenster bis 08:30:45); zweiter Aufruf lief durch.

Mit T-057 lokal behoben und vom TL **APPROVED**: alte Statusdatei nach gescheiterter Sicherung,
Basisregistrierung vor dem Barriere-Fenster und falsche Cutover-Meldung. DEPLOY.md beschreibt
jetzt US-Tippregeln ohne Einfügefunktion und den Deploy aus dem Terminal des Product Owners.
Deploy-Schlüssel `taptime_server` hat keine Passphrase (T-024 rückt vor).

## Offen bis zum Pilotbetrieb

- **T-066 (22.09.):** vom TL abgenommen und gepusht; CI scheiterte an v4-Exportlaufzeit,
  Images deshalb übersprungen. Laufzeitkorrektur lokal umgesetzt, noch nicht committet;
  Rot-/Grün- und EXPLAIN-Nachweise unter `.t066-review/`. Kein Deploy und keine APK.
- **APK VersionCode 7 am Gerät abgenommen (D-044):** alle acht Punkte bestanden — vier Reiter,
  Tags neu beschrieben, **App geschlossen plus Dranhalten öffnet ohne Auswahldialog** (T-043),
  Tap-Moment, Offline in Bernstein, Aktiv-Kachel, Einladen vom Handy, eigener Kalender.
  Befunde daraus: Systemleiste stört, Symbole zusammengesetzt, Ring soll stärker pulsieren
  (Variante B gewählt) — zusammen als **T-061** beauftragt.
- Tagesfreigabe und Pausenautomatik (T-048, T-050): während Pilotmonat 1 bauen, Freigabe zu
  Monat 2 zuschalten (D-063). T-055 Wiederaufnahme nach Restore.
- **T-057:** Deploy-Härtung vom TL **APPROVED**; Timer während des Deploys angehalten,
  begrenztes Warten, eigene Basis je Probe, Vorprüfung und argumentloser Diagnosezugang.
  Lokale Tests und unabhängiges Review grün; Review-Artefakte auf Auftrag entfernt.
  CI und Images werden nach dem Push geprüft. Controller-Konsolenschritt gemeinsam mit T-068b;
  kein Deploy. Nächste Aufgabe: T-068b.
- T-056 CI baut die Images; T-037; T-043/T-044; T-016; T-024.
- Firma, Recht, Store, Signierschlüssel; Supabase-Tarif; Aussperr-Test durch den PO.

## Bekannte Kleinigkeiten und offene Risiken

- **T-076 (24.09.):** Kontowechsel am Gerät nach ADR-0012 A1: lokale Datenbank-Generationen, ein SecureStore-Wert für Zeiger und Schlüssel, Wechsel nur aus voll angemeldeter Sitzung und nur ohne jede lokale Evidenz; alte Generation erst beim nächsten Kaltstart nach Verifikation entfernt; jeder unklare Zustand → Schutzzustand ohne Löschung. Neue Installation und Lease beim Server ohne Serveränderung. Dazu `ios.config.usesNonExemptEncryption: false` (im erzeugten Projekt belegt). Unabhängiges Review und Technical Lead **APPROVED**. Danach gemeinsamer App-Build mit T-077 und Geräteabnahme.
- **P2 T-076:** Ein Abbruch im kurzen Vorbereitungsfenster (Generation vorbereitet, noch nicht aktiviert) führt in den Schutzzustand statt zur alten Generation zurück; eine unbenutzte Vorbereitung könnte beim Kaltstart sicher verworfen werden. Später.
- **P3 T-076:** Die Kaltstart-Dateiprüfung schützt bei jeder unbekannten `.db`-Datei im SQLite-Ordner; heute nutzt nur Taptura diesen Ordner. Bei einer weiteren SQLite-Bibliothek auf `taptime-offline*` einschränken.
- **P3 Verwaltungsstopp-Anzeige:** Die Anzeige „wird gesichert“ eines Verwaltungsstopps liegt nur im RAM und ist nach einem App-Neustart weg; das Ereignis selbst liegt beim Server. Anzeige nach Neustart wiederherstellen: später.
- **Beobachten, Android-Härtung (Vorschlag aus T-076):** Expo SecureStore ignoriert auf Android den Rückgabewert von SharedPreferences.commit; ein Upstream-Vorschlag (bei false eine WriteException) wäre eine kleine Härtung. Kein eigener nativer Speicher.

- **T-077 (24.09.):** Reiter „Meine Zeiten“ jetzt auch für Administrator und Standortleitung (D-090): Erfassen · Meine Zeiten · Mitarbeiter · Tags; gleiche Daten und Rechte wie unter der eigenen Person (Standortleitung weiterhin ohne Schreibaktionen, T-062). „Meine Zeiten“ lädt beim Öffnen neu, ohne eine laufende manuelle Erfassung zu überholen. Unabhängiges Review und Technical Lead **APPROVED**. Geräteabnahme mit dem gemeinsamen App-Build nach T-076.
- **P3 T-077:** „Meine Zeiten“ zeigt wie bei Beschäftigten den laufenden und vorigen Monat; ältere Monate der eigenen Person bleiben über „Mitarbeiter“ erreichbar.

- **T-072b (24.09.):** iPhone-Scan: Der gelesene Tag wird nach erfolgreichem Schließen der Apple-Sitzung ausgeliefert; die Sitzung bleibt bis `SessionClosed` belegt, damit das späte Zurücksetzen der Bibliothek keine neue Sitzung zerstört. Diagnose `TapturaNfc` im Apple-Log (nur Phase, Millisekunden, Zahlencode). Unabhängiges Review und Technical Lead **APPROVED**. Danach iPhone-Build durch den PO und Geräteabnahme.

- **P2 T-072b (erledigt 24.09.):** Geräteabnahme mit dem TestFlight-Build vom 24.09.: Start und Stopp mehrfach hintereinander ohne App-Neustart; `SessionClosed` kommt an. Einmal „Doppelter Scan ignoriert“ bei weniger als 5 s Abstand, gewollt (Duplikatfenster 5 s).

- **Deploy 24.09. `b635c4a`:** Der erste Versuch verlor während der ersten Sicherung (17 min ohne Ausgabe) still die SSH-Verbindung; der Controller lief ohne Anzeige weiter und brach nach der zweiten Sicherung sicher ab, Produktion blieb auf `ff69bfe`. Der zweite Versuch mit SSH-Keepalive (`DEPLOY.md`) lief vollständig durch: `ff69bfe -> b635c4a`, alle Versionen, `/health`, Startseite 401, `/tag` 200, `www` 301 geprüft; Startseiten-Passwort gesetzt.

- **T-074 (24.09.):** Verwaltung und Betreiber-Bereich am Handy umgesetzt (untere Leiste mit „Mehr“, Blätter von unten, Karten statt Tabellen, Layouttest in Chrome als eigener CI-Job); unabhängiges Review und Technical Lead **APPROVED**. Review-Artefakte entfernt; Commit/Push freigegeben. Deploy durch den PO, danach Verhaltensabnahme am Handy.
- **P3 T-074:** Am PC sind Inhaltslinks 44 px hoch; in der Personenspalte steht der Name dadurch etwas tiefer als die Nachbarzellen, die Initialen sind unterstrichen. Das Zeitbearbeitungs-Blatt hat keine sichtbare Überschrift. Untere Leiste und „Mehr“-Blatt heißen beide „Hauptnavigation“. Bei Gelegenheit bereinigen.
- **P1 Geräteabnahme iPhone (24.09., TestFlight 1.0.0 (1), behoben mit T-072b `3e5c39c`):** Scan in der offenen App liest den Tag (Apple zeigt den Haken), die App meldet aber „NFC nicht verfügbar“; beim Server kommt nichts an. „Tag zuordnen“ auf dem iPhone ebenso. Vermutete Ursache: die 2-s-Aufräumfrist in `IosNfcSession` wartet auf `SessionClosed`. Korrektur T-072b nach dem Deploy; bis dahin Scannen und Zuordnen nur auf Android.
- **P2 Kontowechsel am Gerät (24.09.):** `bindOwner` sperrt ein zweites Konto dauerhaft, auch wenn alle Vorgänge bestätigt sind; ADR-0012 erlaubt den Wechsel nach vollständiger Bestätigung. Das revidiert die Notiz „gewollt“ vom 18.09. Relevant bei Geräteweitergabe; Aufgabe T-076 vor dem Pilot, bis dahin ein Gerät, ein Konto.
- **P2 T-074 Verifikation (behoben):** Fixture-Typ/Rolle, Screenshot-Styleattribute, Hash-Navigation, CI-Skriptverkettung und macOS-Temp-Pfad im Testaufbau korrigiert; Fokusgrenze des neuen Blatts und Farbtoken im Produkt korrigiert. Review 1: fehlende Fehler-/Ladezustände ergänzt. Erstfehler und Schlussnachweise bleiben in `.t074-review/report.md`.

- **T-031 (23.09.):** Caddy-Rückweg unabhängig vom Archivvertrag (D-085) und Startseite hinter Passwort (D-083) umgesetzt; unabhängiges Review Runde 2 und Technical Lead **APPROVED**. Review-Artefakte entfernt; Commit/Push freigegeben. Kein Deploy; Konsolenblock und Passwort nach `infrastructure/DEPLOY.md`.
- **P2 T-031 lokale Verifikation (behoben):** Faktenprobe zunächst mit unvollständigem Docker-Logkanal; Umsetzungsprüfungen mit korrigierten Fixtures, Browser-Locators, Socket-Wiederverwendung und GNU-/Docker-Helfern. Erstfehler bleiben im gemeinsamen `.t031-review/report.md` samt Logs nachvollziehbar; Schlussprüfungen und Review dort. P2 Entwurf: volle Textdeckkraft während Einblendungen für Kontrast, Bewegung bleibt erhalten.
- **P2 T-031 Kante und Backend:** Die Kantenprüfung nach dem Caddy-Wechsel schließt die Backend-Gesundheit ein. Ein langsamer oder kranker Backend-Start löst deshalb eine unnötige Caddy-Rücknahme aus, und die Meldung nennt Caddy statt des Backends. Der Deploy scheitert dann ohnehin (Vorwärtsreparatur); später Caddy-Erreichbarkeit und Backend-Gesundheit getrennt prüfen.
- **P2 T-031 Passwortwerkzeug:** `taptime-landing-password` zeigt keine Eingabeaufforderung (im Runbook beschrieben); später eine kurze Aufforderung ergänzen.

- **T-072 (23.09.):** iPhone Stufe 1 umgesetzt (Core-NFC-Scan in der offenen App, Tag-Zuordnung auf dem iPhone, iOS-Uhr nach D-082, Datenschutz-Manifest 35F9.1); Technical Lead **APPROVED**. Review-Artefakte entfernt; Commit/Push freigegeben. Kein App-Build durch Codex; erster iOS-Build und TestFlight durch den PO nach `apps/mobile/README.md`, danach Geräteabnahme Android und iPhone.
- **P2 T-072 Feedback:** Der vorhandene native Ton-/Vibrationscode ist Android-only; iOS Stufe 1 zeigt die Serverentscheidung, hat aber noch keinen eigenen Feedback-Port. Geräteabnahme nach separat freigegebenem Build steht aus.
- **P2 T-072 Verifikation:** Privacy-Rotlauf scheiterte zuerst am plist-Testimport; korrekter Gegenbeleg gegen Altquelle erst nach Änderung (Prozesslücke). Weitere Mock-/Typ-/Xcode-Prüfannahmen und erster Interop-Aufbau der Reviewer-Probe korrigiert. Schlusslauf: gesamte Mobile-Suite und tests-inklusiver Typecheck grün; Belege in `.t072-review/`. Review-P1 zur nativen Abbruchreihenfolge mit vorgezogenem Rotnachweis behoben. Runde 2 formal CHANGES REQUIRED allein wegen P2; keine offenen P0/P1, Technical Lead hat die Abweichung am 23.09. akzeptiert (nachträglicher Gegenbeleg genügt für eine reine Konfigurationsangabe; Suite und Typecheck vom TL unabhängig nachgelaufen), keine dritte Runde.
- **P2 T-072 Swift-Test nur auf macOS:** Die D-082-Szenarien der iOS-Uhr laufen über `/usr/bin/swift` und werden in der Linux-CI übersprungen. Bis auf Weiteres durch lokale Läufe auf dem Mac abgesichert; ein macOS-Job in der CI folgt bei Bedarf.
- **P2 T-072 iPhone-Hinweis am Tag:** Tags tragen `https://tb-infra.de/tag`. Ein iPhone zeigt beim Antippen außerhalb der App einen Hinweis zum Öffnen dieser Adresse; dort gibt es heute keine Seite. Bis T-073 kommt dort eine kurze Hilfeseite hin (mit T-031, ohne Passwortschutz).
- **P2 T-072 bei der Geräteabnahme prüfen:** Ein erfolgreicher Scan mit fehlgeschlagener nativer Bereinigung wird bewusst als nicht verfügbar gemeldet. Die Uhrdatei hat vollständigen Dateischutz und ist bei gesperrtem Gerät nicht lesbar (Erfassung dann zur Prüfung, Offline-Aktivierung beim nächsten Öffnen).
- **T-068b (23.09.):** Betreiber-Web, Auslieferung und Runbook umgesetzt; unabhängiges Review Runde 2 und Technical Lead **APPROVED**. Review-Artefakte auf Auftrag entfernt; Commit/Push freigegeben, CI und alle vier Abbilder werden anschließend geprüft. Kein Deploy. Gemeinsamer Controller-Konsolenblock T-057/T-068b in `infrastructure/DEPLOY.md`.
- **P2 T-068b CI-Testaufbau (behoben):** Erster CI-Lauf scheiterte als unprivilegierter Runner an wiederverwendeten schreibgeschützten Release-Fixtures; lokaler Root-Lauf hatte das verdeckt. Testbäume je Fall zurückgesetzt, Cleanup macht eigene Testdateien wieder löschbar. Non-root-Rotnachweis und anschließender grüner Lauf; Produktionscode unverändert.
- **P2 T-068b Verifikation:** Erste Testharness-/axe-Fehler korrigiert; echter Caddy-Rotnachweis gegen Altquelle erst nach erster Änderung erbracht (Prozesslücke). SDK-/Idle-Befunde aus Review 1 mit Rotnachweis behoben; alle lokalen Schlussläufe grün; CI und Images werden nach dem freigegebenen Push geprüft.

- **T-068a (22.09.):** Server-Umsetzung und unabhängiges Gesamt-Review Runde 2 vom TL **APPROVED**: Migration 032, Betreiber-Konten/MFA/Fähigkeiten, Pause einschließlich Offline/Einlösung, beide Root-Werkzeuge und erlaubte Installationslisten. Lokal 1.062 Backend-, 648 Mobile- und 271 Web-Tests, tests-inklusive Typechecks und ShellCheck 0.9.0 mit `-e SC1091` grün. Review-Artefakte auf Auftrag entfernt; Commit/Push freigegeben, CI und Images werden anschließend geprüft. Kein Deploy; T-068b ist der nächste Brief.
- **P2 T-068a CI-Testabgleich (behoben):** Erster CI-Lauf scheiterte im B6-Test an der alten `search_path`-Erwartung für `lock_request_actor`; auf den vollständig qualifizierten Resolver aus 032 angepasst. Servercode unverändert. Lokal alle 103 B6-Tests und Typecheck grün. Ein nachlaufendes Leerzeichen im Werkzeugtest ebenfalls entfernt; erneute CI-/Image-Prüfung folgt.
- **T-068a Review-Korrekturen (behoben):** Runde 1: gemeinsamer 026-E-Mail-Sperrhash und `needsAttention`. Runde 2: pausierte Einladungseinlösung ohne Mitgliedschaft, gemeinsamer Web-API-Client und verspätete mobile Kontextantwort. Jeweils Rotnachweis vor Korrektur; keine dritte Runde.
- **P2 lokale Verifikation (T-068a, behoben):** Fixture-/Workspace-Aufbau, SQL-Sperrrechte, Spalten-/search_path-Erwartungen, asynchrone Queue-Proben und Linux-Werkzeuge korrigiert; alle Schlussläufe grün. Ein früher Login-Test hielt den psql-Pipe offen, behoben und Rücknahme erneut geprüft. Review-Artefakte nach TL-Abnahme auf Auftrag entfernt. Export-Grenzlasttest ausgelassen (Lastlogik unverändert); bestehende Web-Bündelwarnung bleibt.
- **P2 lokale Verifikation (T-057, behoben):** Erste Signaltests liefen mit macOS-Bash ohne
  `BASHPID`; der erste Linux-Lauf hatte kein Node, der sudo-Test noch kein `/usr/local/sbin`.
  Auf vollständiger Linux-Testumgebung sind Signal-, Deploy-, Backup-, Restore- und
  Installerprüfungen grün. Frühe Erfolg-/Rücknahmemeldungen im neuen EXIT-Pfad durch Rotnachweise
  korrigiert. Review Runde 1 fand den verworfenen numerischen WAL-Ergebniscode im Diagnosefilter;
  mit echten Archivierer-Ausgabezeilen rot belegt und korrigiert. Prozesslücke: Rotnachweise für
  Vorprüfung/Barriere erst nach erster Änderung; Gegenprüfung ersetzt diese Reihenfolge nicht.
  Unabhängiges Code-Review Runde 2 und TL-Abnahme **APPROVED**; kein Deploy.
- **P2 T-069 (geklärt durch D-076):** Verwaltungsstopps umgehen das Duplikatfenster und schließen eine offene Pause zusammen mit der Zeit; lokal geprüft.
- **T-069:** Server/App/Web einschließlich D-078 umgesetzt und vom TL **APPROVED**; unabhängiges Review Runde 2 sowie lokale Tests/Typechecks grün. Review-Artefakte auf Auftrag entfernt; CI und Images werden nach dem Push geprüft. Kein Deploy, keine APK.
- **P2 T-069 CI-Bauanbindung (behoben):** B6/DA3 scheiterten nach dem Push an fehlenden Builds neuer Testabhängigkeiten; lokale `dist`-Ausgaben hatten die Lücke verdeckt. CI baut jetzt die transitive Workspace-Hülle einschließlich Entwicklungsabhängigkeiten vor den Prüfungen; dynamischer Guard mit Rotnachweis und frische Builds/Typechecks je Job grün. Unabhängiges Review `APPROVED`; `actionlint` lokal nicht installiert.
- **P2 T-069 (Review Runde 2):** Die Dreiminutenmeldung kann sich um die Restlaufzeit der letzten Archivnachfrage verzögern; kein verfrühter Erfolg.
- **P2 T-066 (D-078):** Nachtragen/Korrektur ohne externen Archivnachweis bis T-016.
- **P2 T-069 (Review):** Frühere Offline-Prüfgründe behalten Vorrang vor `administration_stopped`; Scan-Rückmeldung der App bleibt trotz bekanntem Grund allgemein. Detailmarke ist vorhanden.
- **P2 lokale Verifikation (T-069, behoben):** Lokale Datenbank zunächst nicht gestartet; SQL-Stopptest scheiterte an verzögerter Prüfung unter der Laufzeitrolle, anschließend Prüfung innerhalb der Schreibfunktion. Syntaxfehler im Review-Nachweis sowie Testannahmen zu SQL-Zeitpräzision, Projektgrenzen, Prüffall-Feld und CSV-Format korrigiert; Tabellen- und Archivfunktionsinventar um 031 ergänzt. Export-Grenztest: absolute Warnschwelle knapp überschritten, relative Grenzen grün. Schlussläufe grün; Review-Artefakte nach TL-Abnahme auf Auftrag entfernt.

- **P2 lokale Verifikation (T-070, behoben):** Messaufbau brauchte Borg-Logging und persistente
  Testquittungen; der neue Wasserstands-Stub musste append-only abbilden. Linux-Testcontainer
  anfangs ohne Docker-CLI, nachgerüstet. Schlussläufe einschließlich PITR und unabhängiges
  read-only Review grün; Review-Artefakte nach TL-Abnahme auf Auftrag entfernt.

- **P2 lokale Verifikation (T-066, behoben):** Erstläufe scheiterten auch an Testaufbau
  (fehlende lokale DB-Variable, nicht erfasste `.tsx`-Tests, veraltete Schema-/Status-Erwartungen
  und nach Schema-Neuaufbau fehlende Test-Login-Grants). Web-Fortsetzung: Rollen-/Seitenlimit-
  Testdaten aktualisiert. Laufzeitkorrektur: falsche Status-Erwartung im neuen Test berichtigt;
  SQL-NULL-Grenze mit frischer Verbindung belegt. Ursachen/Nachweise im Review-Bericht.
- **P1 T-068 (Befund 21.09.):** Kein gangbarer Weg, einen Kunden als eigenen Betrieb
  anzulegen: nur das C3B-Werkzeug `taptime-bootstrap`, in keinem Produktionsabbild, ohne
  aktuelle Anleitung. Blockiert den Pilot; Betreiber-Bereich nach D-068.
- **P2 Sicherheit (Befund 21.09.):** Der WAL-Spool `/var/lib/taptime-wal` gehört auf dem Host
  `dnsmasq:systemd-journal` — Kollision der Benutzernummer aus dem Datenbankcontainer mit einem
  Hostbenutzer. T-057: Container und Empfänger schreiben fest als 999:999; Änderung braucht
  einen eigenen Auftrag für Container-/Restore-Identität oder Host-Benutzerbereinigung.
  Ob `dnsmasq` läuft, wurde ohne Serverzugriff nicht geprüft.
- **Beobachten (21.09.):** Dauer der stündlichen Basissicherung gegen die Zehn-Minuten-Grenze
  des Wächters (D-066); ein Lauf endete 16:13 UTC nach bis zu acht Minuten.
- **T-070 lokal behoben und TL-APPROVED; Produktion offen (22.09.):** Über 20 Alarme „WAL-Archivierung steht" in einer Nacht, ohne
  fehlende Daten. Ein Leerlauf-Durchlauf dauert 67–68 s (Storage-Box-Zugriffe ohne Arbeit), das
  Alarmfenster ist 120 s; das Nachholen nach der Sicherung dauerte 451 s (08:05–08:13 UTC,
  Sicherung selbst 7:20 min). Berichtigung in D-072.
- **Geprüft 22.09.:** Das Heimverzeichnis des Deploy-Benutzers enthält nur Standarddateien;
  der Journal-Auszug vom 21.09. ist entfernt.
- **Erledigt 22.09. — T-067 (Befund 21.09.):** `archive_timeout=15s` (T-063, ausgeliefert 20.09.) lässt den
  Archivierer seine eigenen Quittungen archivieren — rund 200 Archive je Stunde ohne Taps. Die
  Durchläufe wachsen auf Stunden, die stündliche Sicherung verhungert, der Spool wächst auf der
  Datenbankplatte (6,0 → 17 GB in 20 h). Archivierer bis zum Deploy von T-067 angehalten;
  Basissicherungen laufen weiter. Kein Datenverlust. Berichtigung in D-066.

- **P2 T-059:** Mehrere gleichzeitige Standort-Grants sind im Handy-Vertrag (ein Standort)
  nicht darstellbar; dann bleibt der Reiter Mitarbeiter aus — es wird kein Standort geraten
  und keine Betriebsberechtigung angenommen. Eine Oberfläche dafür braucht eine
  Produktentscheidung.
- **P3 T-059:** Die Handy-Sitzung vergleicht den Verwaltungsumfang nicht mit, wenn sie prüft,
  ob es dieselbe Sitzung ist; eine laufende Abfrage kann nach einem Entzug noch zurückkommen.
  Der Server weist sie ab — die Autorität wird je Seite neu geprüft.

- **P2 Entwicklung (T-060):** Der Root-Build kann mit veralteten Workspace-Deklarationen
  scheitern; betroffene Abhängigkeiten vor ihren Verbrauchern bauen (Identity → Administration → API).
- **Bekannt (T-060):** Eine Standortleitung ohne Kunden im eigenen Standort sieht keinen Reiter
  „Tags", bis dort ein Arbeitsziel zugeordnet ist; Tags ganz ohne Zuordnung sieht nur der
  Administrator. Beides folgt aus der Standortgrenze und ist so gewollt.

- **P1 T-055:** Lease-Bindung und Reihenfolge über Installationen nach Restore (D-055).
- **Bekannt, nicht behebbar (T-043):** Android 17 zeigt für Tags mit Web-Adresse eine
  Mitteilung, die angetippt werden muss — ein Tap plus Bestätigung wie auf iOS (D-037). Ob der
  Android Application Record das umgeht, ist offen; wird am ersten Android-17-Gerät geprüft.
  Test-Tags müssen nach der nächsten APK einmal neu zugeordnet werden (alte Tags ohne NDEF
  zeigen weiter den Auswahldialog).
- **P2 App (18.09., aus T-058):** Meine Zeiten summiert nur den geladenen Abfragezeitraum;
  Schichten davor fehlen im Kalender (wird als „—“ gezeigt, nicht erfunden). „Zuletzt“ zeigt
  bei einem Abruffehler weiter „Laden“. „Abmelden“ liegt nur auf der Abgleich-Seite.
  Ein zweites Konto auf demselben Gerät ist per `bindOwner` dauerhaft gesperrt — gewollt.
  Erledigt mit `3daa09b`: Schutztext je Ursache; Schutzzustand beim Kontowechsel.
- **P2 lokale Verifikation (T-064):** PITR scheitert auf einem macOS/Colima-Bind-Mount beim
  Rechteerhalt durch `cp -a`; isoliert reproduziert, unveränderter Test auf nativem Linux-Volume grün.
- **P2 lokale Verifikation (T-067):** Der neue Messaufbau scheiterte vor dem Messfenster an
  getrennten Borg-Cachepfaden und am Statusverzeichnisrecht; beides im Aufbau korrigiert.
  Image-Abhängigkeitstest mit Node 18 (`globSync` fehlt) und Caddy-Test ohne `curl` scheiterten
  im Helfer; mit CI-Node 24 bzw. vollständiger Linux-Testumgebung grün.

- **P2 Betrieb:** Health-Abfrage ohne Cache; alte Caddy-Assets; Monitoring-Test braucht GNU-Werkzeuge;
  Caddy-Negativprüfung: EXIT-Trap verliert `holder`, Validator-Cleanup kann ausfallen (T-063-Beleg).
- **P3 Betrieb:** `registered_chain_watermark` liest `offsite_wal_archive_watermarks`
  direkt ueber die Superuser-Verbindung statt ueber eine versionierte Lesefunktion mit
  enger Archivierer-Rolle; spaeter mit einer eigenen Migration schliessen (T-063-Befund).
- **P2 Sicherheit:** `*.supabase.co` in der CSP auf den Aussteller verengen; SECURITY-DEFINER-
  Pfade und Policy-Prädikate prüfen; Supabase-Anmeldung außerhalb eigener Ratenbegrenzung.
- **P2 Fachlich:** Geräteuhr bei manueller Erfassung, unbegrenzter vergessener Stopp, Offline-
  Pausenkonflikte ohne aktive Zeitreferenz.
- **P2/P3 Oberfläche und Pflege:** keine APK-Meldung, Prüfposten-Abweisung ohne Erklärung,
  ungeteiltes Web-Bündel, Fachdokumente in T-019, PostgreSQL-Suiten seriell.
