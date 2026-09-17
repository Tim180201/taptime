# TapTim.e — Status

**Stand:** 17.09.2026 · T-036 abgeschlossen, auf main, CI grün; T-048 freigegeben zur Planung.
Fertig ist das Produkt, wenn das ausgelieferte, wiederherstellbare System einen vollständigen
Monatsabschluss übersteht. Der Produktionsstand wurde in T-054 nicht abgefragt oder verändert.

## Vorhanden

- Domäne und Business Engine: `Trigger → WorkEvent → Engine → TimeEntry`, Korrekturen append-only.
- Backend: 11 `apps/backend-*`-Workspaces einschließlich API und Schema; 52 registrierte
  HTTP-Pfade inklusive `/health` aus `BACKEND_HTTP_ROUTES` in `BackendHttpServer.ts`.
- 25 SQL-Migrationsdateien unter `apps/backend-schema/migrations`; Rollen laut Migration 020:
  `administrator`, `standortleitung`, `employee`. RLS und mandantengebundene Berechtigungen.
- Mobile: Anmeldung, Einladungseinlösung, NFC, manuelle Erfassung, eigene Zeiten, Offline-Queue.
  Erfassung über Offline v4, Abgleich v2, Leases v3; Löschung der Queue erst nach Archivnachweis.
- Verwaltung: Beschäftigte, Standorte und Zuständigkeiten, Arbeitsziele, Tags, Korrektur und
  Prüfentscheidung. Pausenintervalle und CSV V3 mit Pausen, Ortszeit und Revisionskennzeichnung.
- Betrieb im Repository: Container, Caddy, Deploy/Rollback, Diagnose, Alarmierung, physische
  Basissicherung, externes WAL, Zeitpunkt-Restore und Wiederherstellungsprüfung samt Tests.
- Android-APK-Baustrecke über `android:production-validation:build` bleibt erhalten.
  NFC und Offline wurden am Gerät abgenommen; der Android-Auswahldialog bleibt T-043.

## Aktuelle Aufgabe

**Integration T-047 am 17.09.:** Umsetzung auf main gepusht, [CI grün](https://github.com/Tim180201/taptime/actions/runs/35248015826).
Hauptarbeitsbaum nach Stash wiederhergestellt; beide ADO-Textstände erhalten, kein Code-Konflikt.
TL-Korrekturpatch sauber angewandt; unabhängiges Korrekturreview Runde 2: APPROVED ohne Befund.
Rotnachweis mit vorheriger Auth-Quelle: genau vier Fälle rot (422 deaktivierter E-Mail-Dienst,
401 mit/ohne Code, 400 unbekannter Code). Danach testsinklusiver Typecheck und alle 202
Admin-Web-Tests grün; CI-ShellCheck-Dateiliste, bash -n und Deploy-Shelltest ebenfalls grün.
Die drei TL-Pakete sind getrennt zum Commit freigegeben; ihre CI folgt auf den Push.
Caddy-Containertest mangels lokalem Docker-Daemon nicht ausgeführt.

**Image-Workflow-Vorfall am 17.09.:** Codex brach [Lauf 35248229152](https://github.com/Tim180201/taptime/actions/runs/35248229152/attempts/1)
für T-047 ab und deaktivierte den Workflow vorübergehend; er ist wieder aktiv. Vor dem Abbruch
hatte der Lauf den öffentlichen Rollback-Schutz gelesen und drei GHCR-Versionen gelöscht:
`1260160671` = `sha256:feb2041de8f98e5ed8b9a077f05ec90e11863c1d89fa097b417eb1ed4654ad31`,
`1260159757` = `sha256:2a0d4a2cc68523382dcb10bb9eda19ffe276f7c8928427050114d162407fc793`,
`1260159735` = `sha256:75427605b16a0f6005c98d6adfb99ba20e92908a06ccea765a253ad029f6dfc8`.
IDs sind im Löschprotokoll, Digests auf den jeweiligen GitHub-Paketdetailseiten belegt.
Keine davon war laut erfolgreicher Schutzprüfung des damaligen Laufs geschützt:
`select-ghcr-deletions.mjs` schloss geschützte Tags vor der Ausgabe der Lösch-IDs aus.
Das Backend-Image wurde noch veröffentlicht und beim Wiederanlauf bestätigt; die frühere
Aussage, es sei kein Image veröffentlicht worden, war falsch. Kein Deploy ausgeführt.
Wiederanlauf vollständig laufen gelassen: Admin-Web-Bau scheitert am fehlenden Build von
`@taptime/time-entry-export-contract` im Dockerfile; Operations dadurch ebenfalls noch offen.

**T-047 — technisch abgenommen (APPROVED):** isolierter Arbeitsbaum `../taptime-t047`;
geschützte TL-Änderungen im ursprünglichen Arbeitsbaum unverändert. Direkte Kontoeinladung,
atomare lokale Mitgliedschaft/Identitätsbindung und isolierte Passwort-Seite umgesetzt.
TL-Befund zu ungebundenen Bestandskonten korrigiert; Rotnachweis für Aufnahme und Rollback-Reparatur.
Review Runde 2: CHANGES REQUIRED wegen verlorener Erfolgsmeldung beim Refresh; ebenfalls
mit Rot-/Grün-Nachweis behoben. Technical-Lead-APPROVED am 17.09.; Commit und Integration beauftragt.
Prüfungen und Grenzen: `docs/T-047-Verifikation.md`; PO-Schritte: `docs/T-047-Inbetriebnahme.md`.

**T-040 — umgesetzt, Review offen:** Vom Technical Lead gebaut, weil Codex ohne Kontingent war. Anmeldefehler tragen jetzt ihre Ursache; ein nicht erreichbarer Anmeldedienst liest sich nicht mehr als falsches Passwort. Im Container 155 Tests gruen, Typecheck auf dem Mac gruen; Testlauf auf dem Mac ueber die Bruecke nicht moeglich (native Bindings fuer macOS). CI prueft beim Push. Codex holt das unabhaengige Review nach, sobald Kontingent da ist.

**T-047 — pausiert:** Codex hat begonnen (uncommittete Dateien: WelcomePage, SupabaseInviteAuth, ApplicationRoot, zwei docs/); Kontingent erschoepft. Wird mit neuem Kontingent fortgesetzt.

**T-036 — abgeschlossen:** Gemeinsame Core-Zone Europe/Berlin, Monatsgrenzen über
vorhandene Wandzeitumrechnung, feste Web-Anzeige einschließlich Übersicht und CSV-Zone.
Beide Abfrageverträge und SQL erlauben den längsten Berliner Monat: 31 Tage plus eine Stunde.
025 ersetzt ausschließlich Grenzprüfungen; alte Migrationen, Bestandsdaten und Rechte bleiben
unverändert, durch Aufstiegstest belegt. Nahttests lesen den SQL-Wert aus der Datenbank,
vergleichen beide Verträge und prüfen jede installierte Funktionsversion am Rand und darüber.
Pflichtgegenbeweise einschließlich PostgreSQL-Oktober vor Reparatur rot, danach grün.
Testsinklusive Typechecks und Builds grün; volle betroffene Suiten geprüft, PG lokal seriell.
Review Runde 1: Übersichtsdatum gefunden und korrigiert; Runde 2 APPROVED ohne offene Befunde.
Technical-Lead-APPROVED; Umsetzung `bc675d0` auf main, [Code-CI grün](https://github.com/Tim180201/taptime/actions/runs/35214461215).
Dokumentationsauftrag separat gepusht. Kein Deploy/Produktionszugriff. T-048 kann folgen.
Backend-Inventur: keine Tages-/Monatsgrenzen, nur CSV-Datum und gleitendes Mobile-Fenster.
Mobile OwnTimeScreen/Work-Coordinator bilden keine Tagesgrenzen; Geräteanzeige bleibt als P2.

## Offen bis zum Pilotbetrieb

- Registrierung/Einladung mit Kontenerstellung und zustellbarer Mail: T-021/T-047.
- Tagesfreigabe, Kalender und beschlossene Pausenautomatik: T-048–T-050.
- Android-App-Auswahl und Lesemodus, iOS, Datenschutz/Löschung, fertige Oberflächen.
- Firma, Recht, Store-Freigabe und Verwahrung des Release-Signierschlüssels; unabhängiger
  Aussperr-Test durch den Product Owner. Supabase-Tarif vor zahlenden Kunden klären.

## Bekannte Kleinigkeiten und offene Risiken

- **TL-Reviewbefunde erledigt:** T-040-P1 durch codebasierte Fehlerzuordnung, CSP-P2 durch
  plattformunabhängige Zählung und T-039-P2 durch exakte Issuer-Prüfung korrigiert; Review APPROVED.
- **P1 Image-Bau:** Admin-Web-Dockerfile baut den benötigten TimeEntry-Export-Vertrag nicht;
  T-047-Backend-Image vorhanden, Admin-Web/Operations noch nicht vollständig veröffentlicht.
- **P2 Prüfstrecke T-047:** Erstaufbau ohne Abhängigkeitsreihenfolge fehlgeschlagen; CI-Reihenfolge
  und Node 24 verwendet. UI-Test erwartete alten Code, Schema-Inventar kannte neuen Beleg nicht;
  Erwartungen fachlich angepasst, volle Suiten grün. Bestehende Bündelgrößenwarnung bleibt.
- **P2 Prüfstrecke T-047/R2:** Lokaler Testcluster zunächst ohne vorgesehenen Port gestartet;
  neuer UI-Test zunächst auf Übersicht statt Beschäftigte. Testaufbau korrigiert, fachliche
  Rotnachweise separat erbracht. Volle Suiten grün; Integration mit TL-Diffs ungeprüft.

- **P2 Mobile T-036:** OwnTimeScreen zeigt weiterhin die Gerätezone; bewusst nicht geändert.
- **P2 Prüfstrecke T-036:** Lokaler PG/Clustervorlage zunächst ohne UTF8; behoben. Neutraler
  Contract-Bündler brauchte main-Auflösung für Core. Neue Tests erwarteten unnormalisierte
  datetime-local-Werte bzw. UTC-Text statt gleichem Audit-Zeitpunkt mit Offset; korrigiert.
- **P2 Prüfstrecke T-052:** Zwei neue Testfixtures zunächst rot (fehlender Konstantenimport,
  falscher Lookup-Feldname); Ursachen korrigiert, vollständige Läufe danach grün. Kein Flaky-Befund.

- **P1 T-055:** Restore braucht erhaltene Lease-Bindung und Reihenfolge über Installationen;
  erneute Zeitfensterprüfung kann das Ergebnis ändern. Nach Restore serverseitig fehlende, schon
  bestätigte Zeilen bleiben lokal erhalten; der Archivnachlauf spielt sie nicht erneut ein und
  erzeugt keinen automatischen sichtbaren Konflikt. D-055 nimmt die Wiederanlaufzusage zurück.
- **P1:** Passwort-Recovery nutzt ein fremd beanspruchbares eigenes URL-Schema;
  das Web-Bündeltor prüft seit 17.09. die Übereinstimmung mit dem Backend-Aussteller (T-039 ✓).
- **P2 Betrieb:** Öffentliche Web-Konfiguration stammt aus dem Mobile-Testprofil; Rollback mit
  echtem Bündeltor, Betriebsversion und systemd-Pfadwechsel bleiben gesondert abzusichern.
  Caddy-Test nutzt eine eigene Konfiguration; Monitoring-Test benötigt GNU-Werkzeuge.
- **P2 Sicherheit:** CSP am 17.09. gesetzt (Admin-Web strikt ohne Inline, API gesperrt gegen Rendern und Framing; Test zieht den Wert aus der Produktions-Caddyfile). Offen: `*.supabase.co` auf den exakten Aussteller verengen, sobald T-039 den Aussteller dem Deploy bekannt macht. SECURITY-DEFINER-Zugriffspfade und uneinheitliche Policy-Prädikate
  bleiben Prüfaufgaben. Geheimnisrotation und passphrasegeschützter Deploy-Schlüssel: T-024.
  Direkte Supabase-Anmeldung liegt außerhalb eigener API-Ratenbegrenzung; kontobezogenen
  Schutz vor zahlenden Kunden prüfen.
- **P2 Fachlich:** Geräteuhr für manuelle Erfassung, unbegrenzter vergessener Stopp,
  fehlende aktive Zeitreferenz bei Offline-Pausenkonflikten und zusätzliche Break-Bindungen.
- **P2/P3 Oberfläche:** Keine automatische Meldung neuer APKs; gemischte Prüfposten-Auswahl
  erklärt ihre Abweisung nicht; CSS-Quelltexttest und ungeteiltes Web-Bündel bleiben offen.
- **P2/P3 Pflege:** Weitere Fach-/Rollendokumente in T-019 abgleichen; Abhängigkeitssicherheit
  braucht eine eigene Richtlinie. Lokale PostgreSQL-Suiten wegen clusterweiter Rollen seriell.
  Health-Abfrage ohne Cache, einmaliger API-Ausfallalarm und alte Caddy-Assets bleiben bestehen.
