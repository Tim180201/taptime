# TapTim.e — Plan bis zum ersten Kunden

> **One Tap. One Decision.** Jede Aufgabe unten muss diesem Ziel dienen.

**Team:** Tim (Product Owner) · Claude (Technical Lead) · Codex (Development)
**Leitentscheidung:** Erst das System vollständig fertig, dann Firma, Recht und Store (D-007), mit getrennten Uhren für
reine Wartezeiten (D-011). Grundlage: Anforderungsprüfung gegen den Code (D-012) und Code-Analyse 28.09. (D-103).
**Stand 08.10.2026:** Produktion und Auslieferungsstand siehe STATUS. Erledigte Aufgaben stehen in Git und DECISIONS;
die vollständige Aufgabentabelle bis 05.10. mit allen Begründungen: `git show 1043011:ADO/PLAN.md`.

---

## Bis zum Pilot

| | Aufgabe | Inhalt | Wer |
|---|---|---|---|
| **T-102 ✓** | Beschäftigte nach Standort, Stunden des Monats (D-105, T-081) — abgeschlossen `d399c69` | App und Web: Gruppen je Standort, Spalte „Diesen Monat“ (Migration 047, Vertrag v3, v1/v2 unverändert); „Angemeldet bleiben“ beim Abmelden, Hinweis bei gleicher Tag-Zuordnung. | ✓ |
| **T-098b** | Registry wiederherstellen, Abrufprüfung immer (Befund 05.10.) — Brief in `5071e6e:ADO/TASK.md`; Teil 2 geprüft auf Branch `t098b-verify` | 21 gelöschte Versionen (Plattform-Manifeste, Attestationen, ein Operations-Index) von `b1ecb8c` und `0230188` über die Packages-API wiederherstellen (Frist bis Anfang November), alle geschützten Abbilder vollständig prüfen; die Abrufprüfung läuft künftig bei jedem Image-Lauf und scheitert laut. PO gibt vorher `read:packages`/`write:packages` für `gh` frei. Teil 1 erledigt (06.10.), Teil 2 geht in T-098c. | PO, Codex |
| **T-107 ✓** | UX vor dem Pilot: Fehler und Kernabläufe (D-112, D-123) — abgeschlossen `16670ed` | Befunde der UI/UX-Durchsicht 06.10. (lokal `.audit-ux-2026-10/`): Kalender-Wochentage, unsichtbar gewähltes Ziel im Web, Standorte einschalten ohne Bindung der Allgemeinen Arbeitszeit (D-102), Stopp/Pause auf „Erfassen“, fremde laufende Zeit direkt beenden, Name des ersten Administrators, Stunden:Minuten, Textkorrekturen (Migration 050). | Codex |
| **T-108 ✓** | Selbsterklärend I: Begriffe und Bedienmuster (D-124 bis D-127) — abgeschlossen `66b1952` | Karte, Mitarbeiter, „Zeiten prüfen“, „Übertragung“ mit Konto, Wortlaut aus der Begriffsliste, einheitlicher Zurück-Weg, Personenname in der Personenansicht, erkennbare Löschaktionen, Herunterziehen zum Aktualisieren. Ohne Migration. | Codex |
| **T-110 ✓** | Selbsterklärend II: Führung, Zeiten prüfen, Monatswähler (D-128) — abgeschlossen `7cd4233` | Nächster Schritt in der Übersicht aus vorhandenen Daten, Hinweis nach Rollenwechsel, „Zeiten prüfen“ mit Tageszeiten und klaren Knöpfen, Monatswähler in der Mitarbeiterliste (Vertrag v5, Migration 051), SQL-Ersatzname „Mitarbeiter“. | Codex |
| **T-098c** | Registry-Aufräumen trotz alter Fehlstellen (Umsetzung jetzt, Commit nach Deploy 4) | Teil 2 von T-098b mitnehmen. Abrufprüfung streng für aktuellen, vorherigen und Operations-Stand sowie die neuesten zwanzig; unvollständige ältere bekannte Stände nur als Warnung. Fehlende Kind-Manifeste unter ungeschützten Eltern blockieren das Aufräumen nicht mehr (Eltern zuerst löschen). `known-versions` bleibt ungekürzt (TL 08.10.). Trockenlauf des Löschplans vor dem Commit, nach Deploy 4 wiederholt. | Codex, TL |
| **T-109 ✓** | Weg zur App (D-129) — abgeschlossen `d72ba94` | Öffentliche Seite `/app` (Ziele in `apps/landing-web/src/appLinks.json`, vorerst leer), „App laden“ nach dem Passwortsetzen und in der Einladungsmail, „App aktualisieren“ in der App, Name aus `shared/product.json`, EAS-Profil `store`, Store-Entwürfe in `docs/store/` („Entwurf, rechtliche Prüfung mit B15“). Offen beim PO vor der Einreichung: App-Name, D-U-N-S, Play-Organisationskonto, öffentliche Datenschutzerklärung und Impressum, Apple-Antrag „unlisted“, Händlerangaben (DSA), Demo-Zugang; danach Store-Links und Einreichung als eigene Schritte. | Codex, PO |
| **App Links ✓** | Fingerabdrücke in `assetlinks.json` (T-096, D-119) | Fingerabdrücke der drei Varianten eingetragen (06.10.). | PO, Codex |
| **Deploy 3 ✓** | Dritter Deploy, Mail-Vorlage, App-Builds, Geräteabnahme — ausgeliefert 06.10. | Ziel `7cd4233`: T-094b bis T-102, T-075, T-106, T-107, T-108 und T-110, Migrationen 043–051; Ablauf und Abnahme in STATUS. | PO, TL |
| **T-113 ✓** | Zeiten eingeben im Web einfacher, eigene Zeiten ohne Grund (D-131) — abgeschlossen `2c9f7b8` | Eigene Zeiten ohne Grund nachtragen und ändern (Migration 052, Historie „selbst“), „Zeit hinzufügen“ rückt ins Bild, Enter ins nächste Feld, Datum, Von und Bis getrennt in allen Zeitformularen im Web. | Codex |
| **T-112 ✓** | Karte einrichten zuverlässig, Signal erst bei Erfolg (D-132) — abgeschlossen `280c057` | Schreiben nur wenn nötig und nachgelesen; am iPhone ein Apple-Fenster bis „Karte zugeordnet“ mit Neuabfrage derselben Karte; gesendete Registrierung gewinnt, gleiche Befehls-ID beim Wiederholen; iPhone mit Vibration und Ton; Android-Lesemodus ohne Systemton; Bezeichnung vorbelegt. Geräteabnahme (je 20 Einrichtungen) mit den App-Builds nach Deploy 4. | Codex |
| **T-114 ✓** | „Erfassen“ auf einen Blick (PO 07.10.) — abgeschlossen `af86406` | „Erfassen“ im Normalzustand ohne Scrollen (Kreis passt sich an, kompakte Karte der laufenden Zeit), ohne „Zuletzt“; Reiter einzeilig ohne Wortbruch; Einzahl. | Codex |
| **T-115 ✓** | App öffnet immer, auch nach dem Sperren (D-133, PO 08.10.) — abgeschlossen `831cb29` | Unter iOS kein Hintergrundauftrag und kein Start im Hintergrund; kein endgültiger Fehlerzustand (neuer Versuch bei Rückkehr in den Vordergrund und per Knopf); Schreibfehler bei der Erneuerung zerstören keine Sitzung; Anmeldefehler bleiben auf der Anmeldeseite; kurzer Fehlercode für den PO. Geräteabnahme mit den App-Builds. | Codex |
| **Deploy 4** | T-109 und T-113 ausliefern, danach App-Builds | Startseite mit `/app`, Caddyfile, Verwaltung, Migration 052; Ziel `831cb29` (Server wie `2c9f7b8`). Danach überträgt der PO die Einladungsvorlage; dann neue App-Builds mit T-109 bis T-115 und Geräteabnahme. | PO, TL |
| **T-024** | Geheimnisse rotieren | Datenbank-Zugangsdaten und Cursor-HMAC-Schlüssel aus `/opt/taptime/.env` (Screenshot 25.08.). Reihenfolge: verwahren, rotieren, erneut verwahren; die neue Verwahrung umfasst die ganze `.env` einschließlich `SUPABASE_PUBLISHABLE_KEY`. Dazu ein passphrasegeschützter Deploy-Schlüssel: einrichten, durch eine echte Auslieferung belegen, erst danach den alten entfernen. `/root/env-0410.bak` entfernen; Konsolenschritt für `taptime-status` (DEPLOY.md, MONITORING.md). An der Hetzner-Konsole. Dazu ein neues ntfy-Thema. | PO, TL |
| **T-099** | Pilotgröße und Suche | Test in frogs-Größe (5 Standorte, 200 Personen, 500 Kunden und Tags, ein voller Monat) über jede Ansicht in App, Web, Betreiber-Bereich und den Lohnexport, was scheitert wird behoben (u. a. F-018, F-043); Suchfeld auf dem Server für Beschäftigte, Kunden, Tags und jede Kundenauswahl; Supabase-Grenzen anheben. Vor dem Start nur, falls frogs mit allen beginnt (CEO-Termin), sonst vor der Ausweitung. | Codex |
| **Pilot** | Betrieb frogs | Betrieb anlegen, Standortleitungen einladen, Tags verteilen. Voraussetzung: Gewerbeanmeldung, AVV/TOM nach B15, Haftpflicht mit Cyber-Baustein (D-116), Supabase Pro mit der Gewerbeanmeldung (D-130), Aussperr-Test bestanden. | PO |

---

## Pilotmonat 1

| | Aufgabe | Inhalt |
|---|---|---|
| **T-105** | Zugangsverwaltung im Web überarbeiten (Wunsch PO 04.10.) | Einladen, Entziehen, Rollen und Status der Personen übersichtlicher („Zugänge verwalten“ in „Beschäftigte“). Details mit dem PO, dann Brief. |
| **T-111** | Eindeutiger Vorgänger in „Zeiten prüfen“ (aus T-110) | Der Prüfvertrag liefert eine serverseitige Kennung der blockierenden früheren Erfassung; „Zeiten prüfen“ verlinkt dann direkt dorthin. Bis dahin nur der Satz „Eine frühere Erfassung muss zuerst geprüft werden.“ ohne Link, weil gleiche Sequenznummern zweier Geräte derselben Person keine sichere Zuordnung erlauben (TL-Entscheidung 06.10.). Dazu: Die Entscheidung setzt seit T-110 geladene Tageszeiten voraus; sind sie nicht lesbar (etwa bei lange ausgeschiedenen Personen), muss „Ohne Zeitänderung schließen“ trotzdem möglich sein. | Codex |
| **B01** | Lohnexport inhaltlich | Vor dem ersten echten Lohnexport (Analyse-Pakete unten). |
| **T-075 ✓** | Paket mit weicher Grenze (D-087) — abgeschlossen `28e3685` (Testnachtrag `5aa8ea2`) | Paketgröße je Betrieb (Migration 048), Änderung mit Grund im Betreiber-Protokoll, Höchstwert aktiver Zugänge je Monat aus der Mitgliedschaftshistorie, Hinweis für Administratoren; nichts wird gesperrt. |
| **T-073** | Fälschungssichere Tags, iPhone ohne geöffnete App (D-037, D-081, D-088, D-111) | NTAG 424 DNA mit SUN: jede Berührung eine einmalige, vom Server geprüfte Adresse; dieselbe Adresse trägt das Erfassen per Universal Link. |
| **T-104** | Laufende Zeit auf dem Sperrbildschirm (D-114) | iPhone Live-Aktivität, Android Benachrichtigung mit Ziel und Dauer; Antippen öffnet „Erfassen“. |
| **T-048, T-050** | Arbeitstag freigeben, Pausenautomatik (D-046, D-047, D-096) | Während Monat 1 bauen, Freigabe zu Monat 2 zuschalten (D-063). |
| **T-055** | Wiederaufnahme nach Wiederanlauf (D-055) | Lease-Bindung, Reihenfolge über Installationen und Zeitfenster bei spätem Replay nach einem Restore; Nachweis `OfflineRestorePostgres.test.ts` Fall 2. |
| **T-037** | Ungeprüfte Befunde aus dem Gutachten 06.09. (damals B07–B09, Text in Git) | Erst am Code verifizieren, dann beheben oder verwerfen. |
| **T-106 ✓** | Plausibilität an der Servergrenze (B02, D-122) — abgeschlossen `06b3008` | Gerätezeit in der Zukunft wird Prüffall, Korrektur höchstens 24 h, strenge Zeitstempel, Pflichtgründe mit sichtbarem Text (Migration 049, Drift-Probe der Funktionskörper). |
| **B03–B06, B12, B16** | Analyse-Pakete | B16 gleicht dabei die älteren Aufgaben ohne ✓ (Tabelle in Git) und die Kleinigkeiten aus STATUS mit dem Code ab. |

## Später, ohne Termin

T-016 Löschkonzept und Betroffenenrechte (mit B23) · T-020 Freigabekette für nicht per NFC erfasste Zeiten (D-014) ·
T-017 Feinschliff, Barrierefreiheit, Sitzung (D-015) · T-031b Startseite öffentlich mit Impressum (nach dem Pilot) ·
T-042 Aufstiegspfade der Gerätedatenbank (fällig vor der ersten Schemaänderung der Gerätedatenbank nach dem Pilotstart)
· T-044 Lesemodus gehört der App · T-056 CI baut die Images (teils mit T-064, T-078, T-098 erledigt; mit B14
abgleichen) · T-023 und T-029 (Vorschläge: Übersicht als Arbeitsvorrat, Ansichten folgen der Arbeit) · T-051
Überstunden und Urlaub (geparkt, braucht ein Soll-Modell). Ob ältere Zeilen ohne ✓ der Tabelle in Git erledigt sind,
klärt B16.

---

## Phase 2 — Offiziell werden

Läuft nach D-011 in Teilen parallel.

| Bahn | Wer | Inhalt |
|---|---|---|
| **Firma** | Tim | Pilot als Einzelunternehmer (D-116), später GmbH; Konto, Finanzamt, Steuerberater |
| **Marke** | Tim | Produktname, Ähnlichkeitsrecherche, DPMA-Anmeldung (längste Uhr, über neun Monate); die Tags hängen seit D-119 nicht mehr am Namen |
| **Recht** | Tim + Anwalt | AVV, Datenschutzerklärung, AGB; Verzeichnis und TOM prüfen lassen (Texte zuerst an den Code angleichen, B15) |
| **Store** | Tim + Codex | D-U-N-S, Play-Firmenkonto, Icon, Texte, signiertes Release |
| **Support** | Tim + Claude | Meldeweg, Störungsprozess, 72-Stunden-Frist nach Art. 33 DSGVO |

**Eigenes Tor:** Die Website wird erst öffentlich, wenn Impressum nach § 5 DDG und Datenschutzerklärung stehen.

## Phase 3 — Pilot und Verkauf

Echter Pilotbetrieb mit AVV · Politur an den Stellen, die im Pilot weh taten · Preis, Einseiter, Demo-Pfad ·
Mitbestimmungs-Handreichung für Kunden mit Betriebsrat · Go/No-Go.

## Was bewusst wartet

Controlling und Stundensätze, Budgets, Self-Service-Onboarding, Abrechnungsautomatik, Dashboards, vollständige
Rollenmatrix mit System Owner und Team Lead, Mehrfach-Mitgliedschaft, Statusseite, Zertifizierungen. Ein Feld, das heute
niemand benutzt, ist Datenschutz-Ballast und Migrationsschuld.

## Was der Betrieb kostet

**~8 € netto im Monat**, dauerhaft. Einmalig 25 USD Play Console, 290 € Markenanmeldung und das Rechtspaket.

---

## Analyse-Pakete nach T-098 (D-103)

Neutral benannt; die Einordnung aller 191 Befunde liegt nur lokal in `.audit-2026-09/`. Nummern (T-…) bekommt ein
Paket, wenn es startet; große Pakete werden dann geteilt.

| Paket | Inhalt | Befunde | Zeitpunkt |
|---|---|---|---|
| B01 | Lohnexport inhaltlich (laufende Einträge, Spalten, Verwaltungsstopp, Zeitbudget; PO-Fragen) | F-017, F-043, F-061, F-140 | vor dem ersten Lohnexport |
| B02 | Plausibilität an der Servergrenze | F-010, F-016, F-062, F-081, F-095, F-099 | Monat 1 |
| B03 | Admin-Web: Bedienung und Robustheit | F-018, F-040, F-041, F-042, F-093, F-094, F-111, F-112, F-133, F-156 | Monat 1 |
| B04 | App: Bedienung und Texte | F-034, F-035, F-106, F-107, F-149, F-150 | Monat 1 |
| B05 | App: Sitzung und Hintergrund | F-011, F-030, F-033, F-147 | Monat 1 |
| B06 | Server-Robustheit | F-009, F-044, F-045, F-046, F-080, F-113, F-115, F-116, F-117, F-118 | Monat 1 |
| B07 | Schema: Eigentümer, Rechte, Views, append-only | F-013, F-087, F-088, F-089, F-090, F-091, F-154, F-155, F-169 | Monat 1–2 |
| B08 | Idempotenz und Sperrreihenfolge | F-097, F-098, F-100, F-110, F-134, F-137 | Monat 2 |
| B09 | Engine: Duplikatfenster, Verwaltungs-Trigger | F-022, F-138, F-139 | Monat 2 |
| B10 | Cursor für Ziele und Projekte | F-019, F-096 | Monat 2 |
| B11 | Deploy-Controller: Fehlersemantik, Protokoll, Tests unter errexit | F-036, F-037, F-059, F-077, F-108, F-128, F-184 | vor dem Deploy danach |
| B12 | Sicherung und Monitoring: Zeitgrenzen, Totmannschalter | F-049, F-055, F-056, F-084, F-120, F-122, F-123 | Monat 1 |
| B13 | Sicherung vereinfachen, PITR-Reichweite (PO/TL) | F-053, F-060, F-125, F-182 | Monat 2–3 |
| B14 | CI und Migrationen | F-109, F-126, F-127, F-129, F-130, F-131, F-132 | Monat 2 |
| B15 | Rechtstexte an den Code angleichen | F-025, F-026, F-050, F-082, F-083, F-102, F-163 | vor AVV |
| B16 | Doku straffen | F-064, F-065, F-135, F-142, F-144, F-151, F-152 | Monat 1 |
| B17 | Linter, Formatter, Tests mit Verhalten | F-164, F-165, F-166 | nach Pilotstart |
| B18 | HTTP-Schicht: Routentabelle, Transaktionshülle | F-157, F-158, F-162, F-173, F-174 | nach Pilotstart |
| B19 | Admin-Web-Struktur | F-170, F-171, F-172, F-190, F-191 | nach Pilotstart |
| B20 | Kernkette einmal, geteilte Validierung | F-071, F-160, F-161 | nach Pilotstart |
| B21 | Schema-Snapshot und Rückbau | F-167, F-168, F-177, F-178, F-185, F-187, F-188, F-189 | nach Pilotstart |
| B22 | Demo-Pipeline und toter Code | F-086, F-175, F-176, F-180, F-181, F-183, F-186 | nach Pilotstart |
| B23 | Aufbewahrung und Wachstum | F-051, F-119 | mit T-016 |
| B24 | Kalender und Zeitzone | F-023, F-072, F-141, F-159 | nach Pilotstart |

**Offene Fragen an frogs (CEO-Termin):** Umsatzsteuerbefreiung von frogs (D-116), Startumfang, Chips gleich als NTAG 424
DNA (D-111), Tags je Schüler oder Raum, Ablauf einer Stunde, Gruppennachhilfe (Vorschlag: Teilnehmer an einem
Zeiteintrag, Lehrer zählt einmal, jeder Schüler einmal mit Gruppengröße), Kontingente, Geräte, Lohn und Rechnungen
(Business Central; erst fester Abrechnungs-Export, später lesende API), Termine.

**Offene PO-Fragen:** F-069 (Reaktivieren gelöschter Kunden, Projekte, Standorte), F-146 (Leerlauf-Abmeldung im Web),
F-148 (eigene laufende Zeit beenden je Rolle), F-153 (Wiederaufnahme nach Entzug). F-021 liegt in T-055; F-179 ist mit
T-084 erledigt.
