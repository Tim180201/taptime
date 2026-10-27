# T-136: Sicherung unter synthetischer Pilotlast messen

Diese Werkzeuge messen ausschließlich lokal. Sie verändern keine Produktionsdatei und reparieren keinen
Betriebspfad. Modell, echte Messung, bedingte Teilmessung und Extrapolation sind getrennte Nachweise.
Der Ergebnisbericht liegt in `.t136-review/bericht.md`; dieser Ordner wird nie committet.

## Voraussetzungen und Freigabe

Benötigt werden die vorhandene lokale Colima-VM mit Python 3, Bash, Docker und GNU-Werkzeugen sowie
`postgres:17.10-bookworm`. Borg läuft in einem separaten Ubuntu-Container, ohne Docker-Socket. Für den Lauf
am 27.10.2026 hat Tim ausdrücklich **einmalig** `ubuntu:24.04` und `apt-get install --no-install-recommends
borgbackup` aus offiziellen Ubuntu-Quellen freigegeben. Das ergab **Borg 1.2.8-1**; die Produktionsversion
steht noch aus. Auf dem Mac wurde nichts installiert.

Der Offline-Runner erwartet das daraus lokal vorbereitete Abbild `t136-borg:local`. Er zieht und installiert
selbst nichts. Alle Containerstarts verwenden `--pull=never --network=none`; kein Port und kein Docker-Socket
wird eingebunden. Der Docker-CLI läuft **auf der lokalen VM**, fest an `unix:///var/run/docker.sock` gebunden.
Nach dem beauftragten Cleanup sind die beiden eigens beschafften Abbilder nicht mehr vorhanden. Eine erneute
Beschaffung braucht eine neue passende Freigabe; die einmalige Freigabe wird nicht automatisch wiederverwendet.

Vorher mindestens 30 GB frei auf Mac und Docker-Datenträger prüfen. Geschätzter Arbeitsbedarf: höchstens
18 GB einschließlich Vergleichskopie, PostgreSQL, Caches und Wiederherstellungsdaten, mit Abstand zur
PO-Obergrenze von 20 GB. Der Runner prüft freien Platz und belegte Blöcke vor/zwischen Phasen und alle zwei
Sekunden während langer Operationen. Bei 17 GB Arbeitsdaten stoppt er; ein optionaler unabhängiger Wächter
(`watch-space.py`) stoppt bei 18 GB die **exakt übergebenen** Container-IDs. Unter 30 GB freiem Platz wird
abgebrochen. Nur beim gleichzeitigen Verschwinden einer temporären Datei toleriert die `du`-Abfrage ENOENT;
andere Fehler bleiben Abbruchgründe. Speichergrenzen sind keine Laufzeitprognose.

## Ausführen

Im Repository-Stamm, ohne parallel laufende Benchmarks:

```sh
mkdir -p .t136-review
node tests/backup-scale/run-model.mjs > .t136-review/lastmodell.json
TAPTIME_BACKUP_SCALE=synthetic-local-only \
  node tests/backup-scale/postgres-probe.mjs > .t136-review/postgres-probe.json

# Erst wenn die bereits vorhandenen, freigegebenen Abbilder bereitstehen:
colima ssh -- sudo env TAPTIME_BACKUP_SCALE=synthetic-local-only \
  python3 "$PWD/tests/backup-scale/measure.py" all \
  --results "$PWD/.t136-review/messung"

node_modules/.bin/tsc -p tests/backup-scale/tsconfig.json
node --test tests/backup-scale/*.test.mjs
colima ssh -- env PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s "$PWD/tests/backup-scale" -p 'test_*.py'
```

`messung` muss neu sein. Der Komplettlauf besitzt `finally`-Cleanup. Die Teilaktionen `initialize`, `seed`,
`fixture`, `registration`, `monthly` und `stages` dienen der beaufsichtigten Diagnose und lassen ihre Daten
bis `cleanup --results NEUER_ORDNER` stehen. Sie sind **kein** Ersatz für den selbst aufräumenden Komplettlauf.
Vorhandene Ergebnisdateien werden nicht still überschrieben. Die festen Ressourcennamen verhindern parallele
T-136-Läufe. Ein vorhandenes Messvolume wird vom Komplettlauf abgewiesen.

Das ergänzende `preflight.mjs ABBILD` prüft nur Voraussetzungen, nicht Leistung. Die ursprünglichen
Operations-Abbilder enthalten Betriebsskripte, aber kein Borg. Die PostgreSQL-Segmentprobe benötigt nur das
vorhandene PostgreSQL-Abbild und räumt ihren eigenen Container samt anonymer Volume auf.

## Was echt gemessen wird

Der Generator lädt die aktuellen SQL-Migrationen in eine neue lokale PostgreSQL-17-Datenbank. Eine zusätzliche
synthetische Tabelle erhält unabhängig erzeugte Textdaten. Explizite Wechsel liefern echte 16-MiB-Segmente;
`archive_command` kopiert sie lokal, später läuft ein echter lokaler `pg_receivewal`. Daten sind weder
Produktionskopien noch künstlich umbenannte Null-Dateien. Segmentnummern, Datensatz-Eindeutigkeit, tatsächliche
Archivzahl und Borg-Integritätsprüfung sind Nachweise. Repositorybytes bleiben eine **synthetische Schätzung**,
keine Größenprognose für die Anwendung oder Storage Box.

`seed-borg.py` baut reale Borg-Archive mit der installierten Borg-1.2.8-API auf. Nur für diese Vorbereitung
werden bis zu 100 vollständige Archive in einer Manifest-/Repository-/Cache-Transaktion committed. Erst nach
deren Commit werden Quelldateien entfernt. Diese Aufbauzeit ist **keine** Messung von `borg create`.
`borg check --verify-data` prüft den Bestand. Alle gemessenen Befehle benutzen die unveränderte Borg-CLI mit
Produktionskompression `zstd,6` und verschlüsseltem Repository. Die private API ist versionsgebunden.

Der Monatsfall kommt zuerst: mindestens 20.000 echte WAL-Archive, reale physische Basen an mehreren
WAL-Untergrenzen und synthetische Kalenderpositionen. Neun Monatsend-Kandidaten plus aktuelle Tages-/Wochen-/
Stundenbasen stellen einen tatsächlich wegfallenden ältesten Monat her. Die Regeln werden aus
`backup.conf.example` gelesen. Zwei identische Repository-Kopien haben getrennte, vorgewärmte Borg-Caches.
Ein Arm löscht einzeln; der andere übergibt die **exakten gleichen Namen** in einem einzigen `borg delete`.
Die gelöschten Mengen werden anschließend auf Gleichheit geprüft. Es gibt keine Lösch-Globs im Vergleich.

Die weiteren kontrollierten Archivzahlpunkte sind 4.088, 7.648, 11.920 und 20.000. Sie verwenden dieselben
Basisfixtures und dieselbe vollständige aktuelle Wiederherstellungskette. Kleinere Punkte entfernen alte WALs
aus einer Kopie; **historische PITR-Ketten aller alten Basen sind dort nicht Gegenstand des Nachweises**.
Damit wird der Einfluss der Manifestgröße getrennt von Datenbankwachstum untersucht. Die Basisanzahl entspricht
nicht für jeden Punkt exakt der Kalender-Modellstufe. Werte oberhalb des größten echten Punkts müssen explizit
extrapoliert werden. Eine Fortschreibung lokaler Zeiten ist keine Storage-Box-Garantie.

Je Punkt: tatsächliche Archivzahl, gespeicherte verschlüsselte Manifestbytes, belegte Repositorybytes, fünf
CLI-`create`-/`list`-Stichproben, tatsächliche Größenplanung und Extraktion sowie die ganze unveränderte
Wochenprobe einschließlich PostgreSQL-Recovery, Migrations- und RLS-Prüfung. Borg-Aufrufe werden gezählt;
Zeitmessung enthält Docker-Exec-Transport. Der äußere Prozess misst unabhängig davon, wann der Elternprozess
ein paralleles Ergebnis abholt. `compact` wird separat ausgewiesen. Der Monatsvergleich umfasst außerdem
gleichzeitig wartende Basis und WAL-Datei. Die Wochenprobe startet zusätzlich einen echten vollständigen
Archivierer-Durchlauf und die stündliche Sicherung. Lock- und Abschlusszeitpunkte stehen in den Protokollen.

## Unveränderter Produktionspfad und bedingter Vergleich

`operations.sh` lädt die vorhandenen `infrastructure/backup/`-Funktionen direkt. Die lokalen Adapter ersetzen
die Offsite-Validierung durch eine Pfadprüfung, erlauben den separaten Docker-Datenträger statt der Root-Platte,
transportieren echte Borg-Befehle in den Offline-Container und protokollieren die unveränderte äußere `flock`-
Bedingung. Keine DNS-/SSH-Verbindung wird hergestellt. Dateirechte-/Symlink-Prüfungen bleiben erhalten.

Der reale Lauf fand einen bestehenden P1: `production_base_is_registered` ruft `SET ROLE; SELECT EXISTS` ohne
`psql --quiet` auf und vergleicht `SET\nt` mit `t`. Die Aufbewahrung wird trotz vorhandenem Beleg zurückgestellt.
`registration` misst diesen unveränderten Pfad zuerst. **Nur** für den ausdrücklich isolierten Monatsvergleich
prüft `T136_ISOLATED_RETENTION=1` denselben echten Datenbankbeleg mit unterdrücktem Kommando-Status. Danach läuft
die originale Auswahl-/Prune-/Lösch-/Compact-Funktion. Im Sammelarm werden lediglich deren ausgewählte
Einzellöschungen gesammelt. Das ist ein bedingter Vergleich eines Folgeschritts, keine Reparatur und kein
erfolgreicher Produktionslauf. Der Adapter ist für `main` gesperrt.

Die vollständigen Wochenproben benutzen diesen Ersatz **nicht**. Ein bekannter Registrierungsfehler wird nur
dann als solcher klassifiziert, wenn zuvor die echte physische Wiederherstellung erfolgreich war und der
konkrete Retention-Fehler im Log steht. Andere Fehler brechen den Runner ab. Eine fehlgeschlagene Probe wird
auch unter 110 Minuten niemals als bestanden ausgegeben. Monatliches `archive-file`-Warten misst den realen
Speicher-/Checksum-/SQL-Belegpfad; es ist kein vollständiger Mobile-Trigger-bis-UI-Nachweis.

## Lastmodell und Lebenszyklus

`model.mjs` liest Profile aus `tests/pilot-size/{dataset,load}.ts`, Takte/Regeln/Zeitgrenzen aus den
Betriebsquellen. Nicht erkannte Quellformen brechen ab. Annahmen: UTC-Kalender ab 01.01.2026, zwei Segmente je
stündlicher Basis, jede Ereigniswelle mit dem Start-Burst-Abstand von drei Sekunden je Person und ein Segment
je belegtem 30-Sekunden-Fenster. Reale Durchlaufdauer, Überschneidungen, natürliche Segmentfüllung und zusätzliche
Schreibarbeit sind nicht quantifiziert. Das Modell ist keine obere Schranke. Seine Aufbewahrung nutzt den
vorhandenen Fake nur zur Auswahl, niemals zur Zeitmessung; tägliche Prune-Historie wird nicht nachgespielt.

Der Runner erzeugt das eigene Volume und zwei Container, verändert nur dort Daten und speichert genaue
Container-IDs für den Cleanup. Labels erlauben das Wiederfinden eines eigenen Containers nach verlorener
Startantwort. Wiederherstellungscontainer werden ebenfalls mit ihrer genauen ID erfasst. Cleanup verweigert
die Löschung, wenn ein Name inzwischen zu einem anderen Container gehört. Keine Präfix-Sammellöschung.
Anonyme PostgreSQL-Volumes werden mit den Containern entfernt; das eigene Messvolume folgt danach. SIGTERM/
SIGINT des Komplettlaufs führen durch `finally`. Nach SIGKILL oder Rechnerabbruch bleibt die genaue
Eigentumsprüfung vor einem manuellen Cleanup erforderlich. Das bereitgestellte Laufzeitabbild gehört zur
separat freigegebenen Vorbereitung; am Ende dieses Auftrags werden es und `ubuntu:24.04` zusätzlich entfernt.

Das Modell entfernt seinen eigenen temporären Ordner auch bei Fehlern; Signalbehandlung und ein begrenzter
Auswahl-Unterprozess sind vorhanden. Aus dem Messvolume werden nur kompakte Protokolle und Zusammenfassungen
exportiert. PostgreSQL-Daten, WAL-Dateien, Borg-Repositories und Caches werden gelöscht. Bericht, Werkzeug und
prüfbare Messprotokolle bleiben lokal; der Anwender bestimmt deren weitere Aufbewahrung.
