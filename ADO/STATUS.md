# TapTim.e — Status

> **Diese Datei wird überschrieben, nie angehängt.** Sie beschreibt nur den Jetzt-Zustand.

**Stand:** 25.08.2026 (T-017a ausgeliefert, Produktion auf `471b376`) · **Ziel:** System fertig in ~6 Wochen, erster Kunde in ~3 Monaten

---

## Wo wir stehen

Das Produkt ist weitgehend gebaut. Was fehlt: Betrieb, Standorte, Pausen, fertige Oberflächen —
danach Firma, Recht und Store.

**Fertig und im Repository:**

- Domäne und Business Engine (`Trigger → WorkEvent → Engine → TimeEntry`)
- Backend: 15 Module in einem deploybaren Dienst, 34 API-Endpunkte
- Datenbank: 13 Migrationen, Mandantentrennung über RLS
- Mobile-App: NFC-Scan, Offline-Queue, Anmeldung, Einladung, eigene Zeiten, manuelle Erfassung
- Admin-Web: Übersicht, Einrichtung, Beschäftigte, Arbeitszeiten, Prüfungen
- Korrekturen mit lückenloser Historie, CSV-Export (V2), Offline-Abgleich
- CI auf GitHub Actions — 11 Jobs, alle produktrelevant
- **T-001 Prozess-Reset** — `84ac01b`
- **T-002 Container und Healthcheck** — `e7a16f0`, `/health` mit eigenem Verbindungspool,
  Dockerfile ohne root, `env.example` mit 17 Least-Privilege-Rollen
- **T-002b** — `1c81aed`, eingefrorener Harness aus CI entfernt (1.180 → 767 Zeilen)
- **T-004 Server und Datenbank** — `3b35007` und `93fd143`. Hetzner Nürnberg, CX23,
  `46.225.58.30`. PostgreSQL 17 im Container, von außen nicht erreichbar, nur Port 22 offen.
  Schema 001–014, RLS auf 29/29 Tabellen, 17 Laufzeitrollen mit minimalen Rechten.
  Migration 014 entzieht tote Schreibrechte; B3-Sicherheitstests von 109 auf 124 gewachsen,
  Nachweisführung von einem auf sieben Tests.
- **T-005 API im Netz** — `4fd2de2`. Backend-API im Container hinter Caddy, automatisches
  TLS von Let's Encrypt. Zwei Netze: `taptime-internal` ohne Außenverbindung für API und
  Datenbank, `taptime-edge` nur für Caddy. Container schreibgeschützt, ohne Capabilities,
  ohne Rechteerweiterung. `https://api.tb-infra.de/health` liefert `200`, überlebt den
  Serverneustart.
- **T-006 Admin-Web und Erstinbetriebnahme** — `7ef3951`. `https://admin.tb-infra.de` liefert
  das Admin-Web, `/v1/*`, `/v2/*` und `/health` gehen an dieselbe API — gleicher Ursprung, kein
  CORS. HSTS auf beiden Hosts. Ausgeliefert werden genau drei Dateien, kein Quelltext, keine
  Source Maps, kein Service-Role-Key. Vollständiger Portscan 1–65535: nur 22, 80, 443.
  Erstinbetriebnahme: eine Organisation „Tim Bartz", eine Administrator-Mitgliedschaft, eine
  Identitätsbindung, die eingebaute Allgemeine Arbeitszeit. Nach echtem Neustart alles wieder da.
  **Der Product Owner hat sich angemeldet und die Übersicht gesehen.**
- **T-010 Eskalationen erreichen den Administrator** — Migration 015. Eine Engine-Eskalation
  ist jetzt zugleich dauerhafte Entscheidung **und** offener Prüfposten; die Datenbank erzwingt
  diese Form über `offline_reconciliations_result_shape_v2`. Alle sieben Eskalationsgründe
  erscheinen einzeln und in verständlichem Deutsch in der Ansicht *Prüfungen*. Das Gerät
  quittiert weiterhin, spätere Ereignisse werden nicht blockiert. Kanonischer und manueller Weg
  sind mit abgedeckt.
- **T-007 Sicherung und getesteter Restore** — `2e53907`. Stündlich `pg_dump` in ein
  verschlüsseltes Borg-Archiv auf einer Hetzner Storage Box in Falkenstein. Wöchentliche
  **automatische Wiederherstellung** in einen Wegwerf-Container mit Abgleich gegen ein
  Manifest aus dem Archiv: Migrationsverzeichnis, Zeilenzahlen, Rollen, RLS auf 29/29.
  Ein absichtlich beschädigtes Archiv wird erkannt. Borg-Schlüssel und `.env` liegen getrennt
  beim Product Owner.
- **T-008 Betriebssichtbarkeit** — `3ab175d`. Diagnose angeschlossen: Protokolle mit Zeitpunkt,
  Fehlerklasse, geschlossener Route und Korrelations-ID — **kein Personenbezug**, erzwungen durch
  eine Projektion auf vier getippte Felder statt durch einen Filter. journald mit 14 Tagen
  Aufbewahrung. Vier Meldungen per ntfy in zwei Dringlichkeitsstufen, alle vier absichtlich
  ausgelöst und angekommen. Totmannschalter über healthchecks.io, nach echtem Neustart bewährt.
  Geheimnisse ausschließlich in root-eigenen `curl`-Konfigurationen, nie in `argv`.
- **T-009 Menschen verwalten** — `b85b0ce`. Zugang entziehen, zweiter Administrator, Passwort
  zurücksetzen — in Web und App. Die Berechtigung sitzt in **einer** Funktion
  (`has_membership_management_authority_v1`), die T-015 nur noch auf einen Standort einschränken
  muss. Letzter Administrator und Selbstentzug sind **in der Datenbank** abgewiesen, der Wettlauf
  über einen Advisory Lock je Organisation. Der Entzug wirkt beim nächsten Zugriff, nicht erst
  beim nächsten Anmelden. Vier nicht übertragene Ereignisse eines Gesperrten werden zu
  Prüfposten statt zu Verlust.
- **T-011 Ratenbegrenzung** — `3a08601`. Einladungseinlösung streng und alle übrigen eigenen
  API-Ränder großzügig je Adresse begrenzt. Caddy überschreibt fremde `X-Forwarded-For`-Werte;
  die API akzeptiert sie nur mit einem gemeinsamen Proxy-Geheimnis. Zustand ist flüchtig,
  adressverschleiert, zeitlich und mengenmäßig begrenzt.
- **T-012 Pausenerfassung** — `59bdafd`. Die Pause ist ein **Auslöser**, kein Knopf: Die Engine
  entscheidet, ob sie beginnt oder endet. Der Zeiteintrag bleibt offen, die Pause ist ein
  Intervall darin. Vier neue Konsistenzprüfungen rund um die Pause. Ein Arbeits-Auslöser während
  einer Pause wird abgewiesen, weil er mehrdeutig wäre.
- **T-013 Export für die Lohnbuchhaltung** — `8094744`. CSV **V3**: Pausen, lokale Zeit mit
  Sommerzeit, garantiert belegte Personenkennung, Korrekturhinweis mit Revisionsnummer,
  Erfassungsart je Grenze. Die effektive Arbeitszeit kommt aus
  `effective_work_duration_seconds_v1` — **eine** Quelle, in SQL. V2 bleibt unverändert.
- **`tb-infra.de`** zeigt auf den Server, TTL 300, DNS bestätigt

**Nicht vorhanden** — nach vollständiger Anforderungsprüfung am 24.08. (D-012):

- Sicherung und getesteter Restore. Datenverlust ist heute endgültig.
- **Protokollierung.** Im Betrieb entsteht kein einziger Logeintrag, kein Alarm.
- **Zugang entziehen, zweiter Administrator, Passwort zurücksetzen.** Die Datenbank kann es,
  die Anwendung nicht.
- **Auflösung eskalierter Ereignisse.** Eine Eskalation legt die Warteschlange dauerhaft still.
- Eigener Mailversand mit SPF, DKIM und DMARC; als T-021 vor dem ersten echten Kunden geparkt
- Pausenerfassung; Export ohne Pausen, lokale Zeit, Personenkennung und Korrekturhinweis
- Zweite Umgebung; die Produktion baut aus dem Quellbaum statt aus einem geprüften Artefakt
- Standorte und Standortleiter (ADR-0020 ist beschrieben, nicht gebaut)
- Löschkonzept und Betroffenenrechte im laufenden System
- Fertige Oberflächen, Barrierefreiheit der Mobile-Anmeldung, Landing Page
- Signierte App, Store-Eintrag, Rechtspaket, Firma

---

## Aktuelle Aufgabe

**T-015d — Die Oberfläche zeigt den Standort.** Siehe `ADO/TASK.md`. Keine
Berechtigungsentscheidung — der Server hat sie getroffen —, aber die sichtbare Standortgrenze.

**Zuletzt abgeschlossen:** T-015c (Sitzungsvertrag), Commit `1712b55`, CI grün, Migration 021.
`/v2/session` liefert `locationsEnabled`, `availableSections` und `managementScope` — **und keine
Rolle.** Der Browser erfährt nicht, wer er ist, sondern nur, was offensteht; eine browserseitige
Berechtigungsentscheidung ist damit unmöglich. Jeder Bereich stammt aus der Autorität, die dort
ohnehin entscheidet (**D-027**): Einrichtung `007:336`, Beschäftigte `020:208`, Arbeitszeiten und
Prüfungen `012:438`, Export `011:130`. Die Übersicht hat bewusst kein Merkmal (**D-028**).
`/v1/session` bleibt unverändert, bis T-015d ausgeliefert und bestätigt ist.

Danach die Folgeaufgaben in neuer Reihenfolge, siehe `ADO/PLAN.md`. Die Kette wurde am 24.08.
nach Betriebsfähigkeit sortiert und um sieben Aufgaben erweitert (D-012). `T-001` bis `T-006`
sind unverändert, alles danach ist neu nummeriert.

## T-003 — eingestellt, nicht abgeschlossen

Der Versuch, das Schema auf Supabase einzuspielen, ist nach **sechs Berechtigungshürden**
eingestellt worden. Das Ziel — Schema und 17 Laufzeitrollen — wandert unverändert nach T-004,
auf eine selbstbetriebene Datenbank. Begründung: `ADR-0021` und `DECISIONS.md` D-010.

**Dauerhaft übernommen:** `d6b8679` (Prüfblöcke gegen SUPERUSER in den Migrationen) und
`400fd43` (B4-Test deckt Normalisierung *und* Verweigerung ab). Beide sind unabhängig vom
Betreiber Verbesserungen.

**Verworfen:** die uncommitteten Nicht-Superuser-Umbauten aus T-003d und T-003f.

## Schätzung gegen Wirklichkeit

Der Technical Lead führt beide Zahlen mit, um eigene systematische Fehler zu erkennen.

| Aufgabe | Geschätzt | Tatsächlich |
|---|---|---|
| T-001 | eine Sitzung | eine Sitzung + eine Nachbesserung |
| T-002 | zwei Sitzungen | zwei Sitzungen (inkl. T-002b) |
| T-003 | zwei Sitzungen | **sechs** — eingestellt |
| T-004 | zwei Sitzungen | drei — inkl. einer Korrekturrunde |
| T-005 | eine Sitzung | eine Sitzung |
| T-006 | zwei Sitzungen | zwei Sitzungen |
| T-010 | drei Sitzungen | eine Sitzung |
| T-007 | zwei Sitzungen | eine Sitzung |
| T-008 | zwei Sitzungen | zwei Sitzungen |
| T-009 | drei Sitzungen | zwei Sitzungen |
| T-011 | eine Sitzung | eine Sitzung |
| T-012 | drei Sitzungen | vier — inkl. drei Runden CI-Reparatur |
| T-013 | zwei Sitzungen | zwei Sitzungen |
| T-014 | zwei Sitzungen | drei |
| T-017a | drei Sitzungen | offen |

Die Prüfung vom 24.08. hat die Restschätzung von 11 auf **38 Sitzungen** über 13 Aufgaben
korrigiert — nicht weil mehr Arbeit entstanden ist, sondern weil sieben nötige Aufgaben vorher
in keinem Plan standen.

---

## Bewusst offene Ränder

| Was | Wie weit offen | Wann neu bewerten |
|---|---|---|
| **Anmeldung** | Läuft direkt gegen Supabase, nicht über unsere API. `/v1/session` ist ein `GET` mit Bearer-Token und sieht nie ein Passwort. Supabase begrenzt auf 1.800 Anfragen/Stunde je IP, Burst 30 — **keine Konto-Achse**. Wir können daran nichts bremsen, solange der öffentliche Password-Grant erreichbar ist. | vor dem ersten zahlenden Kunden |
| **Passwortzurücksetzung** | Ebenfalls direkt gegen Supabase. Mindestens 60 Sekunden je Nutzer. Bekannte und unbekannte Adresse liefern beide `200 {}` — kein Kontoverrat. | mit T-021 |

---

## Offene Abnahme durch den Product Owner

| Was | Warum es zählt | Spätestens |
|---|---|---|
| **Aussperr-Test** | Zweiten Administrator anlegen, damit anmelden, dem ersten den Zugang entziehen — und rückwärts. Prüft, ob ein Kunde sich aus jeder Lage selbst befreien kann, ohne uns. Braucht einen Rechner, nicht das Telefon. | vor dem ersten fremden Nutzer |

---

## Blockiert / wartet auf Entscheidung

| Was | Von wem | Warum es drängt |
|---|---|---|
| **Produktname** | Tim | Engste Wahl: **Taptura** — `taptura.de`, `.com` und `.io` frei, `.app` vergeben. Kunstwort, trägt das „Tap" der Bedienung, in beiden Sprachen gleich aussprechbar, keine Kollision mit TIM/Telecom Italia. **Domains registrieren, bevor die Markenvorprüfung läuft** — sie sind das Einzige, das über Nacht weg sein kann. Regel aus der Suche: `.com` darf nicht über den Namen entscheiden; `.de` plus eine moderne Endung genügt. Verworfen: „MyTim" (Domains weg, TIM-Kollision, falsche Perspektive), „Zeitura" (international unklar auszusprechen). „TapTime" ist vergeben. Wird für Store, Firma und Domain gebraucht — Deadline Woche 12. Blockiert Phase 1 nicht. |
| **T-021 Zustellbarkeit** | Tim | Brevo-Konto und DNS. Vor dem ersten echten Kunden, blockiert T-012 nicht. |
| **Vier Fragen an den Pilot-Inhaber** | Pilotbetrieb | Am 26.08. **schriftlich** hinausgegangen, Rücklaufzeit offen. Reihenfolge: was an Jibble stört · wie der Monatsabschluss abläuft · was bei einer falschen Stunde passiert · ob es Personalnummern gibt. Blockiert **T-020** (Freigabekette: pro Eintrag oder pro Person und Monat, D-020), **T-023** (Inhalt der Übersicht) und die letzte offene Stelle in **T-013**. Blockiert T-015a/b/c nicht. Schriftlich heißt: kürzere, glattere Antworten als im Gespräch — vor allem bei Frage 1. Kommt dort nichts Konkretes, ist ein Telefonat nachzuholen. |
| **Monatsgrenzen in Ortszeit** | Tim + Claude | Adressen wie `?monat=2026-10` rechnen heute in UTC-Monatsgrenzen. Ein Oktober in `Europe/Berlin` dauert durch die Zeitumstellung 31 Tage plus eine Stunde; Abfrage und CSV-Export erlauben vertraglich höchstens exakt 31 Tage. Betrifft genau zwei Monate im Jahr — und verschiebt dort Arbeitszeiten über die Monatsgrenze. Bei einer Lohnabrechnung ist das kein Rundungsfehler. Braucht eine Vertrags- und Backendentscheidung, nicht Oberflächenarbeit. Fällt spätestens mit T-013 an. |

---

## Geheimnisse — verwahrt am 25.08.2026

Bis zum 25.08. lagen Borg-Passphrase, Borg-Schlüssel und `/opt/taptime/.env` **ausschließlich
auf dem Server**. Jede Sicherung wäre bei einem Serververlust unlesbar gewesen — T-007 hat
funktioniert, aber sein Zweck nicht. Der Product Owner hat vier Einträge angelegt:

| Eintrag | Inhalt |
|---|---|
| TapTime Server Root (Hetzner-Konsole) | Root-Passwort für den Konsolen-Rückweg |
| TapTime Borg Passphrase | am 25.08. rotiert, weil die alte in einem Chatverlauf landete |
| TapTime Borg Schlüssel (Papierform) | `borg key export --paper`, zusätzlich ausgedruckt |
| TapTime Produktions-.env | 18 Datenbank-Zugangsdaten und der Cursor-HMAC-Schlüssel |

**Regel ab sofort:** Eine Aufgabe, die ein Geheimnis erzeugt, ist erst abgeschlossen, wenn der
Product Owner bestätigt hat, dass es verwahrt ist — nicht wenn das Skript läuft. Und bei jeder
Änderung auf dem Server wird der Eintrag am selben Tag nachgezogen; **T-024** rotiert die
`.env` und muss sie danach erneut verwahren.

---

## Bekannte Kleinigkeiten (blockieren nichts)

- **P2, gelöst in T-025:** Drei Grenztest-Vorfälle waren Läuferwetter statt Produktfehler; zuletzt
  schwankte Payroll V3 von 8,9 auf 30,2 Sekunden. Der 8-MiB-Test vergleicht den Export nun mit
  einem festen, V3-ähnlichen PostgreSQL-Workload im selben Lauf (`1,20×`), meldet absolute
  Langsamkeit nur als Warnung und läuft in einem eigenen CI-Job mit eigener Datenbank.
- **P2:** PostgreSQL-Integrationssuiten dürfen lokal nicht parallel auf demselben Cluster laufen:
  Migrationen normalisieren clusterweite Rollen und können dadurch eine fremde Suite stören.
  Die CI-Jobs besitzen getrennte PostgreSQL-Servicecontainer; lokale Prüfläufe bleiben seriell.
- **P2:** `effective_work_duration_seconds_v1` hat noch keinen Aufrufer. Das ist bis T-013
  korrekt; **T-013 muss diese Funktion aufrufen** und darf den Pausenabzug nicht in TypeScript
  nachrechnen, sonst entstehen zwei Wahrheiten.
- **P2:** Offline-Reconciliation speichert bei `work_trigger_during_break_rejected` die aktive
  `server_time_entry_id` noch nicht mit, obwohl die Entscheidung selbst korrekt ankommt.
- **P2:** Die Break-WorkEvent-Bindung könnte zusätzlich über `subject_type = 'break'` sowie die
  Gleichheit von `started_via`/`stopped_via` und `trigger_type` gehärtet werden. Die aktuellen
  Writer erzeugen bereits die richtige Form.
- App heißt intern noch `mobile` (Name, Slug, Package-ID) statt TapTim.e.
- Ungetracktes `app.json` im Wurzelverzeichnis (seit 20.07.2026), von keinem Build oder Runtime
  gelesen. Package-ID entscheidet der Product Owner.
- Nur zwei Rollen (`administrator`, `employee`). `team_lead` ist eine typische B2B-Rückfrage,
  additiv nachrüstbar. Der Standortleiter aus T-015 deckt den häufigsten Fall ab.
- **P1, Frist spätestens T-018:** `taptime://auth/recovery` ist ein eigenes URL-Schema. Auf
  Android kann eine fremde App es beanspruchen und den Wiederherstellungstoken abfangen; auf
  iOS ist die Zuordnung bei mehreren beanspruchenden Apps undefiniert. Vor Installation auf dem
  ersten fremden Telefon auf HTTPS App Links / Universal Links mit Domainnachweis umstellen.
- **P2:** Acht von 30 Tabellen tragen keine RLS-Policy — `bootstrap_receipts`,
  `employee_membership_invitations`, `employee_invitation_command_receipts`,
  `employee_enrollment_redemption_receipts`, `membership_management_command_receipts`,
  `time_record_revisions`,
  `time_review_command_receipts`, `offline_review_adjudications`. `FORCE` ohne Policy sperrt
  alles, sie sind also fail-closed; ihre Mandantentrennung hängt aber allein an den Prädikaten
  der `SECURITY DEFINER`-Funktionen. Auf `time_record_revisions` liegt ein `UPDATE`-Recht, dessen
  Unveränderlichkeits-Trigger nirgends getestet ist.
- **P2:** Fünf Policies aus Migration 013 leiten die Administrator-Eigenschaft aus einer
  Anwendungsvariablen ab statt aus `memberships` wie die anderen 42. Heute nicht ausnutzbar,
  bricht aber das Muster.
- **P2:** `admin.tb-infra.de` hat **keine Content-Security-Policy** — weder in Caddy noch in der
  Seite. Der Schutz „Token nur im Arbeitsspeicher" aus ADR-0015 DA4-P10 wirkt gegen
  eingeschleustes JavaScript deshalb nur begrenzt. Wird in T-017 zusammen mit der Umstellung auf
  `sessionStorage` behoben, in dieser Reihenfolge. Siehe D-015.
- **P2:** Der Zeitstempel der manuellen Erfassung stammt von der Geräteuhr. Der Serverpfad mit
  `transaction_timestamp()` existiert, wird von der App aber nie aufgerufen.
- **P2:** Die Wiederherstellungsprüfung läuft gegen eine praktisch leere Datenbank —
  `work_events`, `time_entries` und `canonical_decisions` stehen auf 0. Die Mechanik ist damit
  bewiesen, ein echter Datenrundlauf nicht. Erledigt sich mit den ersten echten Daten.
- **P2:** Zehn automatische Schnappschüsse rotieren täglich. Bei anhaltender Serverübernahme
  sind sie nach zehn Tagen ersetzt. Gegenmittel ist der zweite Topf: zehn **manuelle**
  Schnappschüsse rotieren nicht — einer pro Monat, einer vor jeder größeren Serveränderung.
- **P3:** Eine gemischte Auswahl in *Prüfungen* — Engine-Eskalation zusammen mit einem anderen
  Prüfposten — wird mit `invalid_evidence` abgewiesen. Sicher, aber für den Administrator nicht
  selbsterklärend. Gehört in T-017.
- **P2:** Ein vergessener Stopp läuft unbegrenzt weiter. Es gibt keine Obergrenze und keinen
  Hinweis an den Administrator.
- **P3:** Vier Dokumente beschreiben, was es nicht gibt — `Role_Model.md` und `Domain_Model.md`
  führen System Owner und Team Lead, `Glossary.md` kennt Work Target und Revision nicht,
  ADR-0018 DA6-P03 nennt Supabase als Datenebene. Wird in T-019 angeglichen.
- `apps/backend-b1-spike` ist ein altes Experiment und kann entfernt werden.
- **P2:** `/health` löst pro Aufruf eine Datenbankabfrage aus. Der eigene Pool (`max: 1`) schützt
  die Fachmodule, aber ein Ergebnis-Zwischenspeicher von wenigen Sekunden würde das Thema ganz
  erledigen.
- **Bewusste Betriebseinschränkung:** Die API-Ausfallmeldung kommt genau einmal pro Ausfall.
  Bleibt die API lange unerreichbar und wird die Meldung übersehen, gibt es keine Erinnerung.
  Das vermeidet bewusst einen Alarmsturm.
- **P3:** Fünf hohe npm-Audit-Meldungen, alle im Expo/Metro-Build-Werkzeug der Mobile-App.
  Nichts davon läuft im Backend-Container. Updates verfügbar.
- **P3:** Caddy nennt bei HTTP-Anfragen an die IP oder einen fremden Host seinen Produktnamen
  ohne Version. Die Antworten für `api.tb-infra.de` enthalten den Header nicht.
- **P3:** Caddy kündigt HTTP/3 per `Alt-Svc` an, obwohl aktuell nur 443/TCP veröffentlicht ist.
  Funktional fällt der Client auf HTTP/2 zurück; die Ankündigung ist unnötig.
- **P2:** Der T-011-Caddy-Integrationstest prüft eine kleine äquivalente Testkonfiguration statt
  der Produktionsdatei. Die Produktionsdatei wird separat validiert; ein späteres Entfernen der
  Proxy-Header aus nur einer echten Route würde der Integrationstest aber nicht bemerken.
- Mit dem entfernten CI-Job entfielen auch Absicherungen gegen bekannte Lücken in
  Abhängigkeiten (GHSA-Einträge, `image-size`). Falls das erhalten bleiben soll, gehört es in
  eine eigene Abhängigkeits-Richtlinie — nicht zurück in den eingefrorenen Harness.
- **P2:** `securityBoundaries.test.ts` prüft die Tabellenfixierung über reguläre Ausdrücke
  auf dem **Quelltext** von `styles.css`, nicht über Verhalten. Er bricht bei jeder
  Umformatierung ohne Verhaltensänderung — und würde einen echten Verlust der Fixierung
  durch eine andere Schreibweise nicht bemerken. Bewusst so belassen, weil jsdom die
  Fixierung nicht darstellt.
- **P2:** Das Admin-Web-Bündel liegt bei 510 kB JavaScript. Ohne Aufteilung wird der erste
  Aufbau in schlechten Netzen spürbar.
- **P2:** Der private Deploy-Schlüssel auf dem Arbeitsrechner ist weiterhin **ohne
  Passphrase**. Nach T-022 öffnet er nicht mehr root, sondern nur noch `taptime-deploy` mit
  genau einer erlaubten `sudo`-Regel — der Schaden bei Verlust des Rechners ist damit deutlich
  kleiner, aber nicht null. Vorschlag von Codex vom 25.08., aufgenommen in **T-024**: neuen
  passphrasegeschützten Schlüssel einrichten, mit einer echten Auslieferung belegen, **erst
  danach** den alten öffentlichen Schlüssel entfernen. In dieser Reihenfolge, sonst sperrt man
  sich aus.
- **Offen, laufend:** Die Grenztests aus T-025 messen relativ, Budget `1,20×`. Gemessene
  Verhältnisse: `0,66` · `0,64` · `0,91` · `0,91` (T-015d lokal; CI ausstehend). **Jede
  abgeschlossene Aufgabe trägt ihren Wert hier ein.**
  Bei zehn Werten wird die Verteilung ausgewertet und das Budget mit Daten nachgezogen — nicht
  geschätzt.
- Geparkte Idee: **`ADO/RESULT.md`** — Codex schreibt seinen Abschlussbericht ins Repo statt nur
  in den Chat. Spart dem Product Owner bei jeder Aufgabe einen Handgriff.

---

## Eingefroren

- **`apps/synthetic-android-e2e`** — der automatisierte Hardware-Testlauf ist eingestellt.
  Ersetzt durch `ADO/04_Operations/Smoke_Test_Checkliste.md`. Code bleibt liegen, wird nicht
  weiterentwickelt. Begründung: `ADO/DECISIONS.md`, D-001.
- **Development Assignment 5 / V5-Verfahren** — beendet. Die offene Frage war nie ein
  Produktfehler; im Ereignisprotokoll stand durchgehend `Product finding: NONE`.
