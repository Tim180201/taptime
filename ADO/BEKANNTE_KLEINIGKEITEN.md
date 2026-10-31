# TapTim.e — Bekannte Kleinigkeiten (P2/P3, offen)

Hierher gehören die nicht blockierenden Befunde aus Reviews und Tests (AGENTS 5): je Befund eine Zeile, Herkunft in
Klammern, Einzelheiten in Git. Erledigte Zeilen werden entfernt, nicht durchgestrichen. Keine Seitengrenze, aber nichts
als diese Liste. Einordnung in die Analyse-Pakete mit B16. Stand bis 31.10.: aus `ADO/STATUS.md` hierher verschoben.

- **T-140, TL-R1 (P2/P3):** Ohne bekannte Grundlage zeigt „Erfassen“ offline nur den Hinweis statt der früheren Karte (P2); „offline gespeichert“ erscheint auch mit Netz bis zur Bestätigung in App und Sperrbildschirm (P3).
- **T-140, unabhängiges Review R1 (P2):** Bei lokalem Ende von A und serverseitigem Ende von B mit gleichem Ergebnisstatus und anschließend leerem Aktivstand fehlt der Abweichungshinweis; betroffene Stop-Zeit-ID künftig mitvergleichen.
- **Lokale CI (T-140, P2):** Host-Node 26 überschattet JSDOM-`localStorage`; Webtests scheitern. Workflow-Node 24.17.0 ist installiert und wird für den CI-Nachbau explizit im PATH gewählt. Erstfehler bleibt in `.t140-review/ci/ci-quality-final-10.log`. TL-R1: Sandbox-Zugriffe auf Build-/Compiler-Caches und lokale Testdienste waren gesperrt; nach Freigabe grün. Ein 5-s-Timeout im unveränderten Konfigurationstest unter Parallelbetrieb trat einzeln und im vollständigen Quality-Lauf nicht erneut auf (`tl-r1-mobile.log`, `tl-r1-regressionen.log`).
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
