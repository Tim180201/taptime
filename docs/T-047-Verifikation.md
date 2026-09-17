# T-047 · Verifikation und Übergabe

Lokaler Prüfstand zur technischen Abnahme am 17.09.2026, erstellt im isolierten Arbeitsbaum
`/Users/timbartz/Dokumente/GitHub/taptime-t047`. Grundlage ist der separat gepushte
Dokumentationsauftrag `78aaa60`. Die neun vom Product Owner geschützten TL-Dateien sowie
dessen ADO-Zeilen im ursprünglichen Arbeitsbaum wurden nicht übernommen oder verändert.
Die eigenen ADO-Ergänzungen dieses Arbeitsbaums müssen bei der späteren Zusammenführung
zusätzlich zu den vorhandenen TL-Zeilen erhalten bleiben.

## Geänderte Bereiche

- `apps/backend-administration`: schmaler Supabase-Adapter, Einladung im vorhandenen
  Berechtigungskontext, lokaler atomarer Abschluss und fester Fehlerkatalog; PostgreSQL-Tests.
- `apps/backend-schema`: Migration 026 mit RLS-erzwungenem Wiederholungsbeleg und eng
  berechtigter Funktion; erwartetes Schema-Inventar ergänzt.
- `apps/backend-api`: optionale Laufzeitkonfiguration, neue registrierte Route,
  eigener enger Ratenbegrenzungs-Scope, gefilterte Diagnose, Vertrags-/Start-/Geheimnistests.
- `apps/admin-web`: separates Einladeformular, API-Client, eigene Passwort-Seite mit
  speicherflüchtiger Invite-Sitzung; eigener Einstieg vor dem Verwaltungs-Coordinator.
  Keine Änderung an `AdminWebCoordinator.ts`, `SupabaseMemoryAuth.ts` oder deren Tests.
- `docs/T-047-Einladungsvorlage.md`, `docs/T-047-Inbetriebnahme.md`: Mailvorlage,
  fünf PO-Schritte, Lebenszyklus, Fehlerbetrieb und Befund zur alten Code-Strecke.
  `ADO/STATUS.md` und `ADO/TASK.md`: ausschließlich eigene Status-Ergänzungen.

## Ausgeführte Verifikation

Node 24.17.0; eigener lokaler PostgreSQL-17.10-Cluster, UTF8. PostgreSQL-Suiten nacheinander;
keine Verbindung zur Produktion. Provider-Aufrufe ausschließlich mit Testdoppeln.

| Workspace | Vollständige Suite | Typecheck einschließlich Tests | Build |
|---|---:|---|---|
| admin-web | 178 grün | grün | grün |
| backend-administration | 147 grün | grün | grün |
| backend-api | 453 grün | grün | grün |
| backend-schema | 183 grün | grün | grün |

Je Workspace `npm run typecheck`, `npm run test` und `npm run build` mit
`--workspace=@taptime/<workspace>`. Die Typecheck-Konfigurationen schließen `tests` ein;
`tsc --listFilesOnly` weist die neuen Testdateien nach. `git diff --check` grün.

Gegenbeweise: Runtime ohne service-role-Schlüssel startet; fremde Routen bleiben erreichbar;
autorisierter Einladevorgang ohne Schlüssel liefert `account_creation_not_configured`.
Provider-Ablehnung schreibt keine lokalen Teildaten. Erzwungener Fehler vor Commit nach
Provider-Erfolg rollt lokalen Benutzer, Mitgliedschaft, Identitätsbindung und Beleg zurück.
Danach repariert derselbe Befehl die fehlende Bindung mit `succeeded_existing_account`:
genau ein externes Konto, genau eine Mail, genau eine lokale Mitgliedschaft. Ein im Dashboard
angelegtes Konto ohne lokale Bindung wird ebenfalls aufgenommen, ohne den Invite-Endpunkt
aufzurufen. Der Beleg bewahrt auch bei Wiederholung die Erfolgsart. Anschließende normale
Identitätsauflösung erreicht direkt die Mitgliedschaft ohne Code. `email_exists` entsteht
ausschließlich bei einer bestehenden Bindung an eine andere Organisation; bestehende
Bindungen bleiben unverändert. Provider-Duplikate werden erneut aufgelöst statt als fremder
Betrieb interpretiert. Eine bestehende Bindung ohne Mitgliedschaft bleibt ein Klärungsfall.
Standortleitungs-Test: Bestandskonto samt Heimatstandort, Rollback und Wiederholung;
unerlaubter Zielstandort und bestehende Mitgliedschaft außerhalb des Umfangs werden abgewiesen.
Ein bösartiges Testdoppel schreibt den künstlichen Schlüssel in Fehlertext und Antwort;
die Prüfung sucht sowohl nach diesem Wert als auch seinem Muster in der Produktionsdiagnose.
Der Routenwächter erfasst die neue Route aus der Registrierung und prüft ihre Schutzklasse.

Nahttest D-045: reale HTTP-Antworten der Backend-Route durch den produktiven Web-Parser,
sowohl beide Erfolgsarten als auch alle benannten Fehler. Oberflächentests unterscheiden
„Einladung verschickt“ von „Konto bestand bereits — es wurde keine Mail verschickt“ samt
Hinweis auf vorhandenes Passwort, „Passwort vergessen“ und eigene Information der Person.
Beide Erfolgshinweise bleiben beim echten `SectionBoundary`-Wechsel `ready → loading → ready`
sichtbar; der Zustand liegt oberhalb dieser Boundary in `EmployeesView`.
Willkommen-Tests prüfen den echten
Anwendungseinstieg, getrennte Memory-Sitzung, Tokenentfernung und nach Passwort-Erfolg
ausschließlich „Jetzt die App öffnen und anmelden.“ ohne Links, Navigation oder Admin-Inhalte.
Lokale Browser-Sichtprüfung mit künstlichem Token: Passwortformular und Taptura-Titel;
kein Admin-Menü. Kein Provider-Aufruf durch das bloße Öffnen.

Erste rote Läufe bleiben dokumentiert: Build fehlte zunächst die Abhängigkeitsreihenfolge im
frischen Arbeitsbaum; Aufbau in CI-Reihenfolge behoben. Ein UI-Test erwartete die entfernte
Code-Anzeige, die Schema-Inventur enthielt die neue Tabelle noch nicht. Beide Erwartungen
angepasst und vollständige Suiten erneut ausgeführt. Kein Flaky-Befund. Der erste lokale
Prüfstand mit Node 26 ersetzt keinen Nachweis; oben stehen die Läufe mit Node 24. Die bekannte
Warnung zum ungeteilten Web-Bündel bleibt. Keine Abhängigkeitsaktualisierung vorgenommen.

Der geforderte Rotnachweis zur TL-Korrektur lief am 17.09.2026 vor jeder Produktcodeänderung:
`npm run test --workspace=@taptime/backend-administration -- tests/T047AccountInvitation.test.ts`.
Die zwei Tests „repairs a rollback after provider success on the same command without a second
account or mail“ und „binds an existing Supabase account without any local binding and never
calls the invite endpoint“ scheiterten beide: erwartet `succeeded_existing_account` mit
`membershipId`, erhalten `email_exists`. Ergebnis: **2 fehlgeschlagen, 5 grün**. Nach der
Korrektur zunächst alle sieben grün; nach weiteren Grenztests die komplette Suite wie oben.
Der erste Startversuch davor erreichte wegen des fehlenden Testcluster-Ports keine Tests
(`ECONNREFUSED`); Start auf dem vorgesehenen Loopback-Port korrigiert. Dieser Infrastrukturfehler
ist ausdrücklich nicht der fachliche Rotnachweis.

Der zusätzliche UI-Befund aus Review Runde 2 wurde vor seiner Korrektur ebenfalls rot belegt:
beide neuen App-Tests fanden den jeweiligen Erfolgshinweis nach Beginn des Listen-Refreshs
nicht mehr. Danach Zustand und Anzeige über die wechselnde Boundary gehoben; beide Tests
und anschließend die vollständige Web-Suite grün. Beim ersten Versuch dieses Tests war die
Start-Route fälschlich die Übersicht; das Fixture wurde vor dem fachlichen Rotnachweis auf
`/beschaeftigte` gesetzt. Keine Änderung an geschützten Coordinator-Dateien.

## Review, Grenzen und nächster Schritt

Runde 1: unabhängiges Read-only-Review APPROVED; der Technical Lead fand anschließend den
blockierenden Bestandskonto-Fall und meldete **CHANGES REQUIRED**. Dieser Befund ist wie oben
mit Rot-/Grün-Nachweis behoben. Unabhängiges Review Runde 2: **CHANGES REQUIRED**, ein P1:
der lokal gespeicherte Erfolgshinweis ging beim automatischen Refresh verloren. Der Reviewer
reproduzierte dies mit produktivem Formular und produktiver Boundary; die Korrektur samt
Rot-/Grün-Nachweis ist oben beschrieben. Keine weiteren P0/P1 in der Backend-Korrektur.
Keine dritte Review-Runde. Der Technical Lead hat den korrigierten Stand am 17.09. technisch
mit **APPROVED** abgenommen und Commit, CI sowie die anschließende Integration beauftragt.
Der erste angefragte Review-Agent scheiterte vor Arbeitsbeginn am Kontingent und gab keinen
Review-Befund ab. Die technische Freigabe stammt vom Technical Lead.

Zum lokalen Prüfstand noch nicht ausgeführt: Commit-CI und Integration mit parallelen
TL-Änderungen; beide folgen nach technischer Freigabe. Deploy, Produktionsprüfung und echte
Mail-/Handyabnahme bleiben mangels gesonderter Freigabe und PO-Konfiguration aus. Supabase und die lokale
Datenbank sind nicht gemeinsam transaktional; ein nach lokalem Rollback vorhandenes ungebundenes
Konto kann jetzt durch erneute Aufnahme repariert werden. Andere unklare Provider-/Bindungsfälle
bleiben sichtbar und im Betriebsdokument beschrieben. Es wurden keine geschützten TL-Dateien
oder bestehende Bindungen umgeschrieben.

Nächster Schritt gemäß Freigabe: Umsetzung gezielt committen, auf main pushen und grüne CI
abwarten; erst danach parallele TL-Änderungen zusammenführen und unabhängig prüfen.
Danach PO-Konfiguration, separat freigegebene Auslieferung und
echte Einladung an ein Postfach auf einem Handy gemäß D-044.
