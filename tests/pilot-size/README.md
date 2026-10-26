# Lokale Pilotgrößen-Messung (T-099a)

Opt-in-Werkzeug, außerhalb der CI. Es verändert keinen Produktcode. Alle angelegten Namen tragen `SYNTHETISCH`; Identitäten und Belege entstehen deterministisch aus einem festen Startwert. Niemals eine Produktionsadresse verwenden.

Voraussetzungen: bereits installierte Repository-Abhängigkeiten, Node 24, lokale PostgreSQL-17-Instanz mit Berechtigung zum Anlegen temporärer Datenbanken/Rollen, vorhandenes Google Chrome unter macOS. Das Werkzeug installiert nichts. Aus dem Repository-Stamm starten:

```sh
TAPTIME_PILOT_SIZE=synthetic-local-only \
TAPTIME_PILOT_DATABASE_URL=postgresql://LOCAL_INSTALLER@127.0.0.1:5432/postgres \
TAPTIME_PILOT_OUTPUT=.t099a-review/full \
node tests/pilot-size/run.mjs --profile=both
```

`--profile=expected` und `--profile=peak` wählen ein Profil. `--smoke` erzeugt nur einen Arbeitstag, eine Wiederholung und einen zeitlich komprimierten Burst: ausschließlich zur Werkzeugprüfung, niemals als Größenmessung verwenden. `TAPTIME_PILOT_AS_OF=YYYY-MM-DD` fixiert den Stichtag (nicht in der Zukunft); Offline-Ereignisse und laufende Zeiten verwenden weiterhin die echte aktuelle Uhr. Ohne Stichtag zählen die drei abgeschlossenen Monate vor dem heutigen UTC-Datum plus der laufende Monat bis gestern. Zeitfenster der Auswertung verwenden Europe/Berlin.

Den Mac während der Messung wach halten. Das vorhandene `/usr/bin/caffeinate -ims` kann vor `node` gesetzt werden; es installiert nichts und endet mit dem Prozess. Ein unterbrochener oder über zehn Minuten verteilter Burst ist ungültig und wird vom Bericht zurückgewiesen.

## Daten und Lebenszyklus

Der Runner legt je Profil eine neue zufällig benannte Datenbank aus `template0` an, migriert mit den vorhandenen Migrationen bis 063 und legt eigene Login-Rollen gemäß `server-runtime-logins.sql` an. Stammdaten folgen dem Fixture-Muster der vorhandenen T117-/T127-Tests. Zeiten, Pausen, Entscheidungen, Belege, Revisionen, Zuordnungen und Kontingente entstehen ausschließlich über echte Coordinators und deren SQL-Funktionen. Historische Ereigniszeitpunkte liegen in den Zielmonaten, Empfangs-/Auditzeitpunkte bleiben die echte aktuelle Serverzeit. Der Betreiber-Tageszähler kann deshalb den synthetischen Import enthalten und ist kein typischer Tageswert. Ehemalige werden nach zwei Monaten widerrufen; archivierte Ziele erhalten vorher echte Nachträge. Historische Arbeitszeit enthält nur Kundentermine, ergänzende Nachträge decken Projekte und archivierte Ziele ab.

Ein Betrieb umfasst 200 aktive Personen, zehn Ehemalige, fünf Standorte, 500 aktive Kunden, zehn aktive Projekte, je zehn archivierte Kunden/Projekte und 500 Karten (495 Kundenkarten, fünf Pausenkarten). Auch Administrator und Standortleitungen erfassen Zeit. Kontingente gelten ab der echten Setzzeit; zusätzlich zum abgeschlossenen Monat wird deshalb die Warnungsabfrage des laufenden Monats mit gefüllten Kontingenten gemessen. An jedem Arbeitstag entstehen vier bzw. sechs Einheiten zu einer Stunde, in der ersten Einheit zehn Minuten Pause; Nachträge ersetzen ungefähr 2 %, Korrekturen betreffen ungefähr 1 % der nicht ersten Einheiten. 20 Prüffälle, 20 gleichzeitig synchronisierende Geräte und 200 laufende Zeiten ergänzen beide Profile.

Eigene Datenbank, Login-Rollen, lokale HTTP-/JWKS-Server und Browser-Builds werden im `finally` entfernt. Es wird keine fremde Datenbank gelöscht. `resources.json` protokolliert die konkreten eigenen Namen und den Cleanup-Status ohne Passwörter. Nach einem harten Prozess-/Rechnerabbruch ausschließlich diese protokollierten Ressourcen prüfen und entfernen; niemals alle Testdatenbanken anhand eines Präfixes löschen. Ausgaben bleiben zur Prüfung erhalten und werden vom Anwender entfernt. Die vorhandenen gemeinsamen NOLOGIN-Migrationsrollen bleiben bestehen.

## Messung und Grenzen

Der Backend-Build bündelt aktuelle Workspace-Quellen. Der echte HTTP-Runtime-Aufbau liefert Pools, Privilegien, Abfrage- und Antwortgrenzen; die Messung überschreibt keine dieser Grenzen. JWT/JWKS, Proxy und Browser-Anmeldung sind lokale Fixtures. Es gibt keine Verbindung zu Supabase, Produktionssystemen oder einem externen Archiv. Die Archiv-Schnittstelle bestätigt ausschließlich im lokalen Testadapter sofort (wie bei der historischen Generierung). Ohne diesen Adapter committen Online-Starts und antworten wegen fehlender Archivierung anschließend mit 503; ein solcher Kurzlauf wurde verworfen. Offline-Antworten behalten ihren sichtbaren Status `archive_pending`. Gemessen wird kein Backup-/WAL-Archivierungsnachweis und keine Archivierungslatenz.

Lesemessungen laufen seriell, nach `ANALYZE`, je 20-mal. Cursor werden zunächst vollständig durchlaufen; gemessen wird anschließend die größte echte Antwort des Pfades. Export wird für jeden der vier Monate in beiden angebotenen Fassungen je 20-mal aufgerufen. p50/p95 verwenden nearest rank ohne Entfernung von Ausreißern. Die gespeicherten Einzelwerte erlauben Nachrechnung. Isolierte Leseaufrufe verwenden verschiedene synthetische Proxy-Adressen; Burst und Offline-Abgleich teilen fünf Standort-Adressen. Dies misst Lesekapazität ohne einen künstlichen Ein-Client-Rate-Limit-Test.

T-099b: Der unbenutzte Altvertrag `/v1/customers/hours/query` bleibt unverändert. Nach TL-Entscheidung wird vor den Messproben aus den vollständigen SQL-Ergebnisbytes und der bestehenden HTTP-Grenze sein erwarteter Status abgeleitet (`legacy-customer-hours-expectations.json`). Der Bericht weist ihn getrennt aus; eine unerwartete 503 bleibt ein Fehler. Aktuelle Kundenmonate v2 müssen weiterhin erfolgreich sein. Bei gestreamten Exporten ordnet der SQL-Beobachter die Laufzeit des Cursor-FETCH der zugehörigen Leseabfrage zu; deren Parameter und Berechtigungskontext bleiben für EXPLAIN erhalten.

200 Starts liegen im Vollprofil drei Sekunden auseinander (erster bis letzter etwa 597 Sekunden); vorher synchronisieren 20 Geräte gleichzeitig Start, nach realen 6,1 Sekunden gleichzeitig Stop. Sperrwartezeiten werden alle 25 ms aus `pg_stat_activity` abgetastet: Samples und beobachtete Warteepisoden sind keine lückenlose PostgreSQL-Ereigniszählung. Eine separate Sperrprobe nach den regulären Messungen prüft F043; ihr künstlich blockierter Export gehört nicht zur normalen Exportlatenz.

Der Browser benutzt den Fixture-Einstieg der vorhandenen Prüftechnik und echte Views/Coordinators. Er lädt echte HTTP-Antworten, ersetzt passende Rollen-/Filter-/Vertragskombinationen durch deren größere gemessene Seite und spielt genau diese Bytes 20-mal ab. Automatisch zusammengesetzte Kalender behalten ihre exakte vollständige Seitenkette. Das Vorladen der Bytes erfolgt außerhalb der Zeitmessung; nur dabei wird das Fetch-Abbruchsignal ignoriert. Seitenwanderungen finden anschließend außerhalb des Browsers statt. Alle 20 Messungen behalten die normalen Client-Fristen. Entsteht beim Replay eine bislang unbekannte asynchrone Folgeabfrage, wird die gesamte Zeitserie verworfen, die echte Antwort vorgeladen und die Serie neu begonnen. Nur 20 vollständig aus Fixtures bediente Seiten gehen ein; JavaScript-Fehler brechen den Lauf ab. Kein Netzwerk außerhalb des lokalen Fixture-Servers ist erlaubt. Fertig bedeutet Shell und Seitenüberschrift sichtbar, beim Personendetail zusätzlich der Kalender, alle instrumentierten Fetches abgeschlossen, 100 ms Ruhe, Fonts bereit und zwei Renderframes. Der feste Ruheanteil ist enthalten. Browserzeiten messen Rendering/Clientarbeit; echte Backend-Latenz steht separat in `reads.json`. Screenshots und Fixture-JSON dienen der Sichtprüfung.

Mit `--browser-source=.t099a-review/full` lässt sich ausschließlich die Browserprüfung wiederholen. Dafür einen **anderen** `TAPTIME_PILOT_OUTPUT` setzen. Der Runner baut dieselben historischen Daten in einer frischen eigenen Datenbank auf, ergänzt Offline-/laufende Zeiten mit zeitlich komprimierten Setup-Schreibvorgängen und verwendet die gespeicherten größten Antworten der Quelle. Diese Setup-Schreibwerte sind keine neue Lastmessung; HTTP-, Export- und Größenwerte der Quelle bleiben erhalten. Stichtag, Profilumfang und Smoke-Modus müssen übereinstimmen. `completion.json` entsteht erst nach erfolgreich beendetem Durchlauf; Cleanup allein ist kein Abschlussnachweis. Browser-Ausgaben und Ressourcenjournal liegen im neuen Ausgabeordner. Dessen gespeicherte Fixtures können danach mit `TAPTIME_PILOT_SIZE=synthetic-local-only node tests/pilot-size/replay.mjs AUSGABEORDNER expected` erneut gerendert werden: ausschließlich lokale Webserver und Browser, keine Datenbank und kein Backend. Die ursprüngliche Browseruhr bleibt fixiert. Die Renderwerte werden überschrieben, die Antwortbytes erhalten.

Auch abgebrochene SELECT-/WITH-Abfragen bleiben in der SQL-Rangliste. Zusätzlich werden langsame und fehlgeschlagene HTTP-Fälle einmal für die Plandiagnose aufgerufen; diese Proben zählen nicht zu den 20 Latenzwerten. Die fünf langsamsten beobachteten SQL-Abfragen werden mit ihren tatsächlichen Parametern und RLS-Kontexten unter `EXPLAIN (ANALYZE, BUFFERS)` ausgeführt. Der Bericht erläutert die lineare Jahresprojektion; sie umfasst weder WAL-/Backup-Aufbewahrung noch Betriebssystem-/Index-Bloat-Prognosen.

Nach beiden vollständigen Profilen erzeugt `node tests/pilot-size/report.mjs .t099a-review/full .t099a-review/report.md` den Bericht. Eine daneben vorhandene `assessment.md` wird als Bewertung aufgenommen. Ein separat wiederholter Browserlauf wird ausdrücklich mit `--browser-expected=AUSGABEORDNER` bzw. `--browser-peak=AUSGABEORDNER` gebunden. Der Bericht weist unvollständige Kataloge, fehlende Wiederholungen, komprimierte Last, nicht abgeschlossenen Cleanup und abweichende Browser-Datenmengen zurück. Serielle, durch Generierung und Cursorwanderung weitgehend warme lokale Messungen ersetzen keine kalte Servermessung oder kombinierte Lese-/Schreiblast.

## Werkzeug prüfen

```sh
node_modules/.bin/tsc -p tests/pilot-size/tsconfig.json
node_modules/.bin/tsc -p tests/pilot-size/browser-tsconfig.json
node --test tests/pilot-size/guard.test.mjs tests/pilot-size/sql-observer.test.mjs tests/pilot-size/report-validation.test.mjs
```

Das Werkzeug ist absichtlich in keinem Workspace- oder CI-Testskript registriert. Bestehende Prüfungen und deren Plattformgrenzen werden im Aufgabenbericht dokumentiert.

T-099b / TL-Entscheidung: Der im aktuellen UI unbenutzte Kundenstunden-Altvertrag v1 bleibt in der Messung. Seine erwartete Größenablehnung wird vor der HTTP-Messung aus den vollständigen SQL-Ergebnisbytes und der bestehenden Antwortgrenze abgeleitet; Status, Bytes und Dauer stehen separat im Bericht. Die aktiven Kundenansichten verwenden die Suchseite v2 (SQL-v3).
