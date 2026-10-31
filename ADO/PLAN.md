# TapTim.e — Plan bis zum ersten Kunden

> **One Tap. One Decision.** Jede Aufgabe unten muss diesem Ziel dienen.

**Team:** Tim (Product Owner) · Claude (Technical Lead) · Codex (Development)
**Leitentscheidung:** Erst das System vollständig fertig, dann Firma, Recht und Store (D-007), mit getrennten Uhren für
reine Wartezeiten (D-011). Grundlage: Anforderungsprüfung gegen den Code (D-012) und Code-Analyse 28.09. (D-103).
**Stand 31.10.2026:** Produktion und Auslieferungsstand siehe STATUS. Erledigte Aufgaben stehen in Git und DECISIONS;
die Aufgabentabelle bis 05.10. mit allen Begründungen: `git show 1043011:ADO/PLAN.md`, die erledigten Zeilen bis T-140:
`git show b50e85a:ADO/PLAN.md`.

---

## Bis zum Pilot

| | Aufgabe | Inhalt | Wer |
|---|---|---|---|
| **T-141** | Sperrbildschirm mit Initialen (D-160), „Erfassen“ nur mit aktuellem Stand (T-140c, PO 31.10.) | Außerhalb der App erscheint ein Kunde nur mit Initialen, gebildet auf dem Gerät vor der Übergabe an das System; Projekte und allgemeine Arbeit behalten ihren Namen. „Erfassen“ zeigt ohne Netz nur laufende Zeit, Pause oder die gerade beendete Zeit; der Verlauf bleibt in „Meine Zeiten“. Rechtstexte im selben Commit. Danach ein App-Build. Brief in TASK. | Codex |
| **T-142** | „Meine Zeiten“ schnell (PO 31.10.: iPhone 1–3 s, Android 3–10 s, bei jedem Öffnen) | Erst messen: Zahl der Anfragen, Server- und Netzzeit je Seite, Aufwand im Gerät (Offline-Datenbank seit T-140, Rendern). Heute holt die App eigene Zeiten in Seiten zu 20 Einträgen nacheinander und lädt beim Öffnen alle Seiten neu. Dann den größten Hebel umsetzen, etwa größere Seiten, sofort den letzten Stand zeigen und still aktualisieren. Ziel: Inhalt sofort sichtbar, bei gutem Netz in unter 1 s aktuell. Braucht es eine Serveränderung, kommt der App-Build nach dem Deploy. | Codex |
| **T-055** | Wiederaufnahme nach Wiederanlauf (D-055), vorgezogen vor den Pilot (externes Review 30.10., P1) | Lease-Bindung, Reihenfolge über Installationen und Zeitfenster bei spätem Replay nach einem Restore; Nachweis `OfflineRestorePostgres.test.ts` Fall 2. Braucht einen Deploy. | Codex |
| **Pilot** | Betrieb frogs | Betrieb anlegen, Standortleitungen einladen, Tags verteilen. Voraussetzung: App-Build mit T-141, T-055 ausgeliefert, grüne Wochenprobe (D-152), Gewerbeanmeldung, AVV/TOM nach B15, Haftpflicht mit Cyber-Baustein (D-116), Supabase Pro mit der Gewerbeanmeldung (D-130), Aussperr-Test bestanden. | PO |

---

## Pilotmonat 1

| | Aufgabe | Inhalt |
|---|---|---|
| **T-125** | Wiederaufnahme nach Entzug (F-153, D-141) | Derselbe Zugang wird wieder aktiv, mit Protokolleintrag; vorher jede Stelle prüfen, die „entzogen ist endgültig“ voraussetzt (Offline-Berechtigungen, Belege, Archive, eine Mitgliedschaft je Person). Erst, wenn frogs den Fall hat. | Codex |
| **T-111** | Eindeutiger Vorgänger in „Zeiten prüfen“ (aus T-110) | Der Prüfvertrag liefert eine serverseitige Kennung der blockierenden früheren Erfassung; „Zeiten prüfen“ verlinkt dann direkt dorthin. Bis dahin nur der Satz „Eine frühere Erfassung muss zuerst geprüft werden.“ ohne Link, weil gleiche Sequenznummern zweier Geräte derselben Person keine sichere Zuordnung erlauben (TL-Entscheidung 06.10.). Teil 2 (Schließen ohne lesbare Tageszeiten) geht in T-135. | Codex |
| **T-123b** | Erstes Lohnprogramm-Format (D-156) | Nach der Antwort von frogs und einer Beispiel-Importdatei ihres Lohnbüros: Importformat des genutzten Programms (vermutlich DATEV LODAS oder Lohn und Gehalt) mit Berater- und Mandantennummer, abgenommen mit einem echten Testimport. Dazu fehlende Personalnummer bei Ehemaligen nachtragen (D-157) und das erste Zeichen der Personalnummer auf Buchstabe oder Ziffer beschränken (TL-Review T-123a). Weitere Programme (Lexware, Sage, Agenda, Addison) jeweils erst mit dem ersten Kunden. | Codex |
| **T-124** | Business-Central-Anbindung (Wunsch frogs) | Stunden je Mitarbeiter und je Schüler/Projekt aus denselben Zeilen; Richtung (Taptura schiebt oder BC holt), Ziel in BC (Standard-Zeiterfassung oder eigene Schnittstelle des BC-Partners), Umgang mit Korrekturen nach der Übergabe, Sandbox. Nummern aus BC an Person und Kunde (mit T-123). Übertragungslauf mit Wiederholung und Protokoll in der Verwaltung; Zugangsdaten nur auf dem Server. Erst nach Sandbox-Zugang schneiden; zwei bis vier Sitzungen. | Codex |
| **T-140b** | Ohne Netz wie mit Netz, Stufe 2 (D-158) | Pause und Ende vom Sperrbildschirm ohne Netz: Der native Teil schreibt die Aktion in den verschlüsselten Offline-Speicher, am iPhone über die App-Intents der Live-Aktivität. Erst wenn der Pilot zeigt, wie oft Lehrkräfte ohne Netz arbeiten. |
| **T-075 ✓** | Paket mit weicher Grenze (D-087) — abgeschlossen `28e3685` (Testnachtrag `5aa8ea2`) | Paketgröße je Betrieb (Migration 048), Änderung mit Grund im Betreiber-Protokoll, Höchstwert aktiver Zugänge je Monat aus der Mitgliedschaftshistorie, Hinweis für Administratoren; nichts wird gesperrt. |
| **T-073** | Fälschungssichere Tags, iPhone ohne geöffnete App (D-037, D-081, D-088, D-111) | NTAG 424 DNA mit SUN: jede Berührung eine einmalige, vom Server geprüfte Adresse; dieselbe Adresse trägt das Erfassen per Universal Link. |
| **T-048, T-050** | Arbeitstag freigeben, Pausenautomatik (D-046, D-047, D-096) | Während Monat 1 bauen, Freigabe zu Monat 2 zuschalten (D-063). |
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
| **Vertrieb** | Tim + Claude | Produktüberblick als PDF (TL 29.10.): nach der Gewerbeanmeldung Impressum nach § 5 DDG und Website-Adresse ergänzen; an Interessenten erst nach dem gemeinsamen Deploy. Termin mit frogs (CEO und Entwickler) Ende November: Folien und Leitfaden als Artifacts |

**Eigenes Tor:** Die Website wird erst öffentlich, wenn Impressum nach § 5 DDG und Datenschutzerklärung stehen.

## Phase 3 — Pilot und Verkauf

Echter Pilotbetrieb mit AVV · Politur an den Stellen, die im Pilot weh taten · Preis, Einseiter, Demo-Pfad ·
Mitbestimmungs-Handreichung für Kunden mit Betriebsrat · Go/No-Go.

**Stempelpunkte (D-144), nach dem Pilot:**

| | Aufgabe | Inhalt | Wer |
|---|---|---|---|
| **T-128** | Karten für „Allgemeine Arbeitszeit“ und Projekte | Heute darf eine Karte nur auf einen Kunden oder auf „Pause“ zeigen (`nfc_assignments_subject_shape_v3`, Migration 017). Künftig auf jedes Arbeitsziel; beliebig viele Karten je Ziel (für Kunden schon heute möglich). Server mit Migration, Offline-Freigaben und Erfassung; „Karte einrichten“ in App und Web mit Zielwahl; neuer App-Build. Antippen wie heute: starten, beenden, wechseln. Etwa zwei Sitzungen. | Codex |
| **Prototypen** | Wandrahmen (01) und Tischkeil (04) aus dem 3D-Drucker | PLA oder PETG, kein Filament mit Metall- oder Carbonanteil; Karte im Scheckkartenformat (NTAG 424 DNA, D-111) höchstens etwa 1 mm unter der Oberfläche (Druckpause oder Kartenschlitz); Keil mit Gummifüßen und schwerer Füllung. Lesetest mit iPhone und Android, mit und ohne Hülle (auch Metallring), Rahmen auf Holz, Gipskarton und Metall. Danach Fotos und kurzes Video für die Startseite. | PO |
| **T-073** | Fälschungssichere Chips | Voraussetzung, um einen Wandpunkt als Anwesenheitsnachweis zu verkaufen (siehe Pilotmonat 1). | Codex |


## Was bewusst wartet

Controlling und Stundensätze, Budgets, Self-Service-Onboarding, Abrechnungsautomatik, Dashboards, vollständige
Rollenmatrix mit System Owner und Team Lead, Mehrfach-Mitgliedschaft, Statusseite, Zertifizierungen. Ein Feld, das heute
niemand benutzt, ist Datenschutz-Ballast und Migrationsschuld.

## Was der Betrieb kostet

**Laufend:** Hetzner-Server mit Backups und Storage Box (bisher rund 8 € netto im Monat; mit den Rechnungen prüfen), ab der
Gewerbeanmeldung Supabase Pro mit 25 USD im Monat (D-130) und die Jahresgebühr des Apple Developer Program.
**Einmalig:** 25 USD Play Console, 290 € Markenanmeldung und das Rechtspaket.

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
| B12 | Sicherung und Monitoring: Zeitgrenzen, Totmannschalter | F-049, F-055, F-056, F-084, F-120, F-122, F-123 | mit T-132 (D-149) |
| B13 | Sicherung vereinfachen, PITR-Reichweite (PO/TL) | F-053, F-060, F-125, F-182 | Monat 2–3 |
| B14 | CI und Migrationen | F-109, F-126, F-127, F-129, F-130, F-131, F-132 | Monat 2 |
| B15 | Rechtstexte an den Code angleichen | F-025, F-026, F-050, F-082, F-083, F-102, F-163 | vorgezogen als T-134 (D-149) |
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
Zeiteintrag, Lehrer zählt einmal, jeder Schüler einmal mit Gruppengröße), Kontingente, Geräte, Termine. **Lohn:**
Welches Lohnsystem, und in welcher Form bekommt es heute die Stunden (Personalnummer plus Monatssumme oder je Tag; Excel,
CSV oder DATEV-Import)? **Business Central (T-124):** Soll BC die Stunden je Mitarbeiter, je Schüler oder beides
bekommen, und welche Nummern verwendet BC dafür? Schiebt Taptura oder holt BC? Standard-Zeiterfassung oder eigene
Schnittstelle des BC-Partners? Was passiert mit Korrekturen nach der Übergabe? Gibt es eine Sandbox für uns?

**Offene PO-Fragen:** F-069 (Reaktivieren gelöschter Kunden, Projekte, Standorte), F-146 (Leerlauf-Abmeldung im Web),
F-148 (eigene laufende Zeit beenden je Rolle). F-153 ist mit D-141 entschieden (T-125). F-021 liegt in T-055; F-179 ist mit
T-084 erledigt.
