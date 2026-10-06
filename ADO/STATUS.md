# TapTim.e — Status

**Stand 06.10.2026.** Produktion läuft auf `b1ecb8c` (Deploy 04.10., Migrationen bis 042). App-Builds 04.10.: iPhone
1.0.0 (5), Android versionCode 12. „Taptura“ ist der Arbeitsname; Code, Pakete und Abbilder heißen weiter `taptime`.
**Auf `main`, noch nicht ausgeliefert:** T-094b (`2a9eb73`), T-103 (`d807da6`, `15ba7a4`, Migration 043), T-095
(`df19da8`), T-095b (`bc4e2dc`, Migration 044), T-096 (`e7cad13`), T-097 (`58e8bba`, Migration 045), T-098 (`4f6fa75`),
T-100 (`b693fde`, Migration 046), T-101 (`1043011`), T-102 (`d399c69`, Migration 047), T-075 (`28e3685`, `5aa8ea2`,
Migration 048), T-106 (`06b3008`, Migration 049), T-107 (`16670ed`, Migration 050; danach eine Testkorrektur der
synthetischen WAL-Belege), T-108 (`66b1952`), App-Link-Fingerabdrücke (T-096). In Arbeit: T-110. T-098b Teil 1 erledigt
(06.10.): 21 Versionen wiederhergestellt, alle Abbilder von `b1ecb8c`, `0230188` und `66b1952` vollständig abrufbar.
Teil 2 geparkt (siehe unten). UI/UX-Durchsicht und Persona-Walkthrough vom 06.10. liegen nur lokal in
`.audit-ux-2026-10/` (nie committen); daraus T-107, T-108 und T-110; T-109 bereitet die Stores vor (D-129).
**Weg zum Pilot:** T-110 → dritter Deploy → Mail-Vorlage „Reset Password“ → App-Builds und Geräteabnahme → T-024 →
Pilot. Pilot als Einzelunternehmer (D-116): Gewerbeanmeldung, AVV und Haftpflicht vor echten Daten. Fertig ist das
Produkt, wenn das ausgelieferte, wiederherstellbare System einen vollständigen Monatsabschluss übersteht.
Ältere Einträge dieser Datei (Deploys, Befunde, erledigte Kleinigkeiten): `git show 1043011:ADO/STATUS.md`.

## Vor dem nächsten Deploy

1. **T-098b:** Teil 1 erledigt (06.10.): die 21 gelöschten Versionen von `b1ecb8c` und `0230188` sind wiederhergestellt
   und vollständig geprüft. Teil 2 (`t098b-verify`, lokal `212486d`) bleibt geparkt: Der Schutzsatz des Servers führt
   16 alte Stände aus dem September, deren Kind-Manifeste längst fehlen; die Abrufprüfung würde jeden Lauf rot machen,
   das Aufräumen bleibt übersprungen. Keine Voraussetzung für den Deploy (die Vorprüfung zieht die Abbilder selbst);
   Lösung mit T-098c nach dem Deploy.
2. **Fingerabdrücke (T-096):** eingetragen (06.10.), der Test lässt keinen Platzhalter mehr zu. Nach dem Deploy neue
   Builds installieren; erst dann öffnet eine Karte bei geschlossener App die App. Mit Google Play (T-109) kommt der
   Fingerabdruck der Play-App-Signatur hinzu.
3. **PO-Schritte aus `infrastructure/DEPLOY.md`** für alle enthaltenen Aufgaben abfragen (AGENTS.md §7).
4. Vorprüfung: Sicherung und Wiederherstellungsprobe inaktiv, letzte Sicherung mit bekanntem Ende. Nach einem
   Server-Neustart erst nach der nächsten stündlichen Sicherung (Meldung unklar → B11).
5. Nach dem Deploy: Supabase-Vorlage „Reset Password“ aus `docs/T-094b-Ruecksetzvorlage.md` übertragen (PO). „Invite
   user“ ist seit 06.10. auf dem Stand von `docs/T-047-Einladungsvorlage.md`.

## Geräteabnahme nach dem Deploy (PO, iPhone und Android)

Erfassen mit laufender Zeit und Pause (T-103) · offline erfassen, abgelehnte Erfassung, Abmelden mit Warten, Kontowechsel
(T-095, T-095b) · Neuinstallation am iPhone, Tag öffnet die App bei geschlossener App (T-096) · Kunden anlegen,
umbenennen, löschen, „Tag prüfen“ (T-100) · leere Pflichtfelder, einmal mit VoiceOver/TalkBack: Hinweis einmal vorgelesen
(T-101) · Beschäftigte nach Standort mit Monatsstunden (T-102) · „Passwort vergessen“ bis zur Anmeldung (T-094b) ·
Aussperr-Test: Zugang entziehen, die Person kommt in App und Web nicht mehr weiter (PO) · Paket im Betreiber-Bereich
setzen und ändern, Hinweis beim Administrator (T-075) · Kalender mit Monatsbeginn am Sonntag, „Erfassen“ laufend, in der
Pause und offline, „Zeit beenden“ aus der Personenansicht, Dauern als „9:54 h“, große Systemschrift und eine
Ergebnismeldung mit VoiceOver/TalkBack (T-107).

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
- Supabase Pro vor dem ersten zahlenden Kunden (D-039): der kostenlose Tarif pausiert das Projekt.

## Beobachten

- Sicherungsdauer und `base_seconds` des Archivierers (24.09.: 13–17 min statt 6–7, 200–215 s statt 61); beim nächsten
  Deploy aus `taptime-status` notieren, Ursache klären (wachsende Archivliste?). Export-Grenztest: absolute
  Laufzeitwarnung beobachten.
- Fehlt zu einem laufenden Eintrag die Zusatzprojektion (043), scheitert das Lesen der eigenen Zeiten (T-103); bei
  wiederhergestellten Einträgen prüfen.
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
  ohne eigenen Ton/Vibration; Uhrdatei bei gesperrtem iPhone nicht lesbar (T-072, wichtig für T-073/T-104) · „Zuletzt“
  zeigt nach einem Abruffehler weiter „Laden“ · Sitzungsvergleich ohne Verwaltungsumfang (T-059) · Android SecureStore
  prüft das Ergebnis von `commit` nicht · Web-Export der App scheitert an `wa-sqlite.wasm` (P2).
- **Beschäftigte (T-102):** Sortierung nach Bytes (`COLLATE "C"` wie bei den Kunden), Namen mit Umlaut am Anfang stehen
  am Ende · wird beim Blättern jemandem der Zugang entzogen, können Personen nach ihm auf der nächsten Seite fehlen
  (Aktualisieren hilft) · Spalte „Standort“ steht neben der Standort-Überschrift doppelt.
- **Paket (T-075):** eine nie angenommene Einladung belegt den Platz, bis der Zugang entzogen wird (gewollt, D-087) ·
  `operator_create_organization_v3` ist eine Kopie von v2 mit Paketgröße, v4 (T-107) zusätzlich mit Namen; v2 und v3
  beim nächsten Rückbau entfernen.
- **Web:** globale Aktualisierung lädt Kundenstunden nicht neu (T-084) · Tags für die Standortleitung nur in der App
  (T-062) · ungeteiltes Bündel über 500 kB · Inhaltslinks 44 px, Blatt ohne Überschrift, zweimal „Hauptnavigation“
  (T-074) · „Passwort vergessen“ braucht `SubmitEvent.submitter` (Safari ab 15.4, T-101) · Anlegen meldet Fehler 23514
  als ungültige Eingabe, unbekannter Standort als `forbidden` (T-090) · abgewiesene Prüfposten ohne Erklärung.
- **Server und SQL:** direkter SQL-Pfad `taptime_admin_setup` prüft keine Betriebspause (T-085) · `xmin` über
  `::text::xid` (T-086, mit der nächsten Migration) · Standortleitung mit Heimatstandort außerhalb ihres
  Verwaltungsbereichs kann eigene Zeiten nicht nachtragen (T-062) · mehrere Standort-Grants im Handy-Vertrag nicht
  darstellbar (T-059) · Nachtragen ohne externen Archivnachweis bis T-016 (D-078) · frühere Offline-Prüfgründe vor
  `administration_stopped`, Dreiminutenmeldung kann sich verzögern (T-069) · Geräteuhr bei manueller Erfassung,
  unbegrenzter vergessener Stopp, Offline-Pausenkonflikte ohne aktive Zeit · Lease-Bindung nach Restore (P1, eigene
  Aufgabe T-055).
- **Betrieb:** WAL-Spool gehört UID 999 (Kollision mit `dnsmasq`, T-057) · Kantenprüfung nach dem Caddy-Wechsel schließt
  die Backend-Gesundheit ein (T-031) · `taptime-landing-password` ohne Eingabeaufforderung · systemd meldet „unit file
  changed“ beim Ordnerwechsel · `registered_chain_watermark` liest direkt statt über eine Lesefunktion · Health ohne
  Cache, alte Caddy-Assets · Caddy-Negativprüfung: EXIT-Trap verliert `holder` · Monitoring-Test braucht
  GNU-Werkzeuge · ShellCheck CI 0.9 gegen lokal 0.11 · DNS-Wildcard nach dem Pilot verengen.
- **Sicherheit:** CSP `*.supabase.co` auf den Aussteller verengen · SECURITY-DEFINER-Pfade und Policy-Prädikate prüfen ·
  Supabase-Anmeldung außerhalb der eigenen Ratenbegrenzung.
- **Entwicklung:** Root-Build mit veralteten Workspace-Deklarationen (Reihenfolge Identity → Administration → API) ·
  Swift-Tests der iOS-Uhr nur auf macOS · Landing-Workflow-Tests nur unter Linux · PostgreSQL-Suiten seriell.
