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
- Android-App-Auswahl und Lesemodus, iOS, Datenschutz/Löschung, fertige Oberflächen und CSP.
- Firma, Recht, Store-Freigabe und Verwahrung des Release-Signierschlüssels; unabhängiger
  Aussperr-Test durch den Product Owner. Supabase-Tarif vor zahlenden Kunden klären.

## Bekannte Kleinigkeiten und offene Risiken

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
  das Web-Bündeltor prüft noch nicht die Übereinstimmung mit dem Backend-Aussteller (T-039).
- **P2 Betrieb:** Öffentliche Web-Konfiguration stammt aus dem Mobile-Testprofil; Rollback mit
  echtem Bündeltor, Betriebsversion und systemd-Pfadwechsel bleiben gesondert abzusichern.
  Caddy-Test nutzt eine eigene Konfiguration; Monitoring-Test benötigt GNU-Werkzeuge.
- **P2 Sicherheit:** CSP fehlt; SECURITY-DEFINER-Zugriffspfade und uneinheitliche Policy-Prädikate
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
