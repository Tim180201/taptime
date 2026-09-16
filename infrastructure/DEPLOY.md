# Wiederholbar ausliefern

Backend, Admin-Web und Betriebsdateien werden nach grüner `CI` einmal von
`Release container images` gebaut. Jeder geprüfte Stand erzeugt drei unveränderliche Abbilder,
zum Beispiel
`ghcr.io/tim180201/taptime-backend-api:abcdef0`,
`ghcr.io/tim180201/taptime-backend-api:admin-web-abcdef0` und
`ghcr.io/tim180201/taptime-backend-api:operations-abcdef0`. Sie liegen getrennt im selben
öffentlichen GHCR-Paket und bleiben ohne Registry-Geheimnis anonym lesbar. Es gibt bewusst kein
`latest` und keinen Build auf dem Server. Nur der kurze Tag `ops` zeigt als Tippabkürzung auf das
neueste automatisch veröffentlichte Operations-Abbild; dessen Revision wird im Abbild selbst
geprüft. Ein manueller Bau für eine alte Rücknahmeversion verschiebt `ops` ausdrücklich nicht.
Backend und Admin-Web werden immer gemeinsam auf die gewünschte Anwendungsversion geschaltet.
Ein neuer Anwendungsstand nimmt automatisch sein
gleich markiertes Operations-Abbild mit; eine Rücknahme auf eine bereits bekannte Anwendung
behält dagegen den zuletzt installierten, neueren Betriebsstand.

## Zugang und Berechtigung

Der Produktionsserver ist `taptime-prod` unter `46.225.58.30`. Ausliefern darf nur der Product
Owner oder eine von ihm ausdrücklich beauftragte Person mit dem privaten SSH-Schlüssel, dessen
öffentlicher Teil beim Unix-Benutzer `taptime-deploy` hinterlegt ist. Der Schlüssel und andere
Geheimnisse gehören weder in Git noch in Befehlsargumente. `taptime-deploy` hat kein allgemeines
`sudo`; erlaubt ist ausschließlich `/usr/local/sbin/taptime-deploy`.

Der unabhängige Rückweg ist die **Hetzner Console**: Projekt *Taptime* → Server
*taptime-prod* → *Aktionen* → *Konsole*. Mit `root` und dem im Passwortmanager verwahrten
Server-Root-Passwort anmelden. Diese Konsole verwendet eine **US-Tastaturbelegung**; die
Passworteingabe bleibt vollständig unsichtbar. Auf einer deutschen Tastatur erzeugt
`Shift` + `Ö` den Doppelpunkt `:`, die Taste `-` unten rechts neben dem Punkt den Schrägstrich
`/` und die Taste `ß` oben rechts neben der `0` den Bindestrich `-`; außerdem sind `y` und `z`
vertauscht. Die Einfügefunktion oben rechts in der Console übernimmt einen Befehl aus der
Zwischenablage und vermeidet das Tippen mit dieser abweichenden Belegung vollständig. Dieser Weg
umgeht SSH und wurde vor dem Sperren des Root-SSH-Logins praktisch geprüft.

## Einmalige Einrichtung

Schreibe den tatsächlich laufenden Commit-Kurzschlüssel nach
`/var/lib/taptime-deploy/current-version`. Diese Datei ist die Rücknahme-Referenz und darf nicht
geraten werden. Das öffentliche Repository erzeugt über GitHub Actions ein öffentliches,
anonym lesbares GHCR-Paket; ein Registry-Passwort wird auf dem Server daher nicht benötigt.
Lege `/opt/taptime/admin-web/status` an. Daneben verwaltet das Deploy-Skript künftig
`releases/<version>` und den atomar gewechselten Symlink `current`; es verändert den
`status`-Ordner bei der Umschaltung nicht.

Auf einem frischen Server richtet `root` den begrenzten Weg ein. Hetzner muss den öffentlichen
Deploy-Schlüssel zuvor bei der Servererstellung für `root` hinterlegt haben:

```sh
useradd --create-home --shell /bin/bash taptime-deploy
install -d -o taptime-deploy -g taptime-deploy -m 0700 /home/taptime-deploy/.ssh
install -o taptime-deploy -g taptime-deploy -m 0600 \
  /root/.ssh/authorized_keys /home/taptime-deploy/.ssh/authorized_keys
printf '%s\n' \
  'taptime-deploy ALL=(root) NOPASSWD: /usr/local/sbin/taptime-deploy *' \
  > /etc/sudoers.d/taptime-deploy
chmod 0440 /etc/sudoers.d/taptime-deploy
visudo -cf /etc/sudoers.d/taptime-deploy
install -d -o root -g root -m 0755 /opt/taptime/admin-web/status
```

### Deploy-Controller installieren oder aktualisieren

Das Deploy-Skript kann sich nicht selbst ersetzen und der normale Deploy ersetzt es bewusst nie.
Bei jeder technisch freigegebenen Controlleränderung öffnet eine ausdrücklich beauftragte Person
nach separater Produktionsfreigabe die Hetzner Console als `root`. `abcdef0` wird durch die exakt
freigegebene siebenstellige Revision ersetzt:

```sh
controller_version=abcdef0
controller_image="ghcr.io/tim180201/taptime-backend-api:operations-$controller_version"
docker pull "$controller_image"
docker run --rm --volume /:/h "$controller_image"
test "$(tr -d '\r\n' < /var/lib/taptime-deploy/operations-version)" = \
  "$controller_version"
```

Die vollständige Einbindung des Server-Dateisystems mit `-v /:/h` ist nur hier vertretbar:
bewusst, durch `root` in der Hetzner Console und mit dem eigenen, exakt versionierten Abbild. Sie
gibt dem Container absichtlich Schreibzugriff auf den ganzen Server und gehört deshalb
ausdrücklich in keinen automatisierten Ablauf, keine CI und keinen gewöhnlichen Deploy.

`ops` ist nur ein beweglicher Hinweis auf das neueste Operations-Abbild und kein zulässiger
Freigabenachweis für eine Controlleraktualisierung. Das exakte Abbild trägt seine siebenstellige
Revision zusätzlich fest im Installer und in einer getrennten Versionsdatei; der Installer
vergleicht beide, bevor er den eingebundenen Server berührt. Das beweist nur, dass das Abbild in
sich stimmig ist. Danach prüft der Installer die
Shell-Syntax, sichert eine vorhandene Vorgängerfassung und ersetzt Controller und aufgezeichnete
Betriebsversion mit vollständiger Rücknahme bei einem Fehler. Derselbe Befehl ist wiederholbar
und gilt unverändert auf einem Ersatzserver ohne vorhandenes Deploy-Skript.

Docker kann vor der Abschlussmeldung mehrere Ladezeilen ausgeben; für die Bedienung zählt die
**letzte Zeile**. Erfolg lautet `ERFOLG: Deploy-Controller <revision> installiert.`. Die
ausführende Person vergleicht die dort genannte Revision mit dem technisch freigegebenen Commit, aus dem
die drei Abbilder gebaut wurden, und fährt nur bei Gleichheit fort — nicht mit der Spitze von `main`, auf der inzwischen
ein `[skip ci]`-Dokumentations-Commit liegen kann. Die gesuchte Revision steht im erfolgreichen
GitHub-Actions-Lauf *Release container images* oben beim Commit; eindeutig auslesen lässt sie
sich mit der Run-ID aus dessen URL über
`gh run view <run-id> --json headSha --jq '.headSha[0:7]'`. Dieser menschliche Vergleich ist die
Freigabeprüfung, die der bewegliche Tag selbst nicht leisten kann. Bei einer abgewiesenen Nutzlast
lautet die letzte Zeile
`FEHLER: Bootstrap abgebrochen; nichts wurde veraendert.`; dann bleibt die Konsole offen und die
vollständige Ausgabe wird gemeldet. Fehlt eine dieser Abschlusszeilen, ist schon Docker vor dem
Start des Installers gescheitert und hat am Server nichts installiert.

Vor jeder SSH-Härtung muss in einer **zweiten** Sitzung sowohl der neue Zugang als auch dessen
einzige sudo-Regel funktionieren. Nach Schlüsselverlust ist die neu erzeugte Identität
ausdrücklich mit `-i` auszuwählen:

```sh
ssh -i ~/.ssh/taptime-deploy taptime-deploy@<server-ip> 'sudo -n -l'
```

Auf einem Ersatzserver außerdem mit `passwd root` ein eigenes Root-Passwort setzen, unmittelbar
im Passwortmanager verwahren und **danach** die Hetzner Console öffnen und dort eine Root-Shell
belegen. Erst dann als `root` die SSH-Härtung installieren:

```sh
cat > /etc/ssh/sshd_config.d/99-taptime-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
EOF
chmod 0644 /etc/ssh/sshd_config.d/99-taptime-hardening.conf
sshd -t
systemctl reload ssh
```

Anschließend muss eine neue Root-SSH-Verbindung mit `Permission denied` scheitern, während der
Aufruf als `taptime-deploy` weiter funktioniert. Bei einem Fehler nichts weiter härten und die
offene Hetzner Console verwenden.

Jede erfolgreiche Auslieferung veröffentlicht `current`, `previous` und die vollständige Datei
`known-versions` sowie die ausgewählte Operations-Version atomar als nicht sensitiven
Schutzsatz unter
`/opt/taptime/admin-web/status/ghcr-protected-versions.json`. Die Veröffentlichungs-Workflow
lädt und validiert diesen Satz fail-closed. Sie schützt Backend und Admin-Web für alle bekannten
Anwendungsversionen sowie genau das ausgewählte Operations-Abbild. Vor einem neuen Push behält
sie die neuesten Abbilder bis zu insgesamt zwanzig Paketversionen. Laufende Anwendung,
Rücknahmeversion und Betriebsfassung können dadurch nie von der Aufräumung gelöscht werden.

Vor dem ersten T-028-Deploy müssen Backend und Admin-Web für Ziel und Rücknahme sowie die
Operations-Abbilder des freigegebenen T-028-Controllers und der Zielanwendung vorhanden sein.
Starte `Release container images` bei Bedarf manuell mit `source_ref` gleich dem vollständigen
Commit der gewünschten Version. Bereits vorhandene unveränderliche Abbilder werden geprüft und
nicht neu gebaut; fehlende Backend-, Admin-Web- oder Operations-Abbilder werden ergänzt. Ein
Operations-Abbild einer alten Rücknahmeversion wird zwar vollständig reproduzierbar gebaut, vom
Deploy aber nicht ausgewählt. Für den noch ausstehenden Deploy gilt der dann aktuelle, eigens
freigegebene Commit; die Rücknahmeversion steht in
`/var/lib/taptime-deploy/current-version`, die Betriebsfassung in
`/var/lib/taptime-deploy/operations-version`. Keine davon darf geraten werden.

Vor dem ersten T-035-Deploy wird zuerst der T-035-Controller mit dem exakten Operations-Abbild
nach dem vorigen Abschnitt installiert. Danach ergänzt `root` in der Hetzner Console mit
`sudoedit /etc/taptime-backup/config` die folgende Liste vollständig und führt aus:

```sh
chown root:root /etc/taptime-backup/config
chmod 0600 /etc/taptime-backup/config
bash -n /etc/taptime-backup/config
```

Das Deploy verteilt
bewusst keine Zugangswerte. Fehlen Basisaufbewahrung, WAL-Spool, Containerpfad,
Replikationsslot, Archivintervall, zulässige verpasste Zyklen, WAL-Status, WAL-Cache oder die
konfigurierten Restore-Zeiten, bricht es vor Sicherung und Migration ab. Borg-Zugang und
Passphrase bleiben in ihren getrennten Dateien.
Deploy und Betrieb akzeptieren ausschließlich ein entferntes `ssh://`-Borg-Ziel mit festem
Schlüssel, Batch-Modus und strikt geprüftem Hostschlüssel; lokale Pfade und der lokale Host
brechen vor jeder Sicherung, Archivierung oder Wiederherstellung ab.
Diese nicht geheimen T-035-Werte werden ergänzt, ohne bestehende Zugänge oder Pfade zu
überschreiben:

```sh
BASE_BACKUP_KEEP_HOURLY='24'
BASE_BACKUP_KEEP_DAILY='14'
BASE_BACKUP_KEEP_WEEKLY='8'
BASE_BACKUP_KEEP_MONTHLY='6'
WAL_SPOOL_DIRECTORY='/var/lib/taptime-wal'
WAL_CONTAINER_DIRECTORY='/var/lib/postgresql/wal-archive'
WAL_REPLICATION_SLOT='taptime_offsite_archive'
WAL_ARCHIVE_INTERVAL_SECONDS='60'
WAL_ARCHIVE_MISSED_CYCLES='2'
WAL_ARCHIVE_STATUS_FILE='/var/lib/taptime-monitor/wal-archive-status.json'
WAL_ARCHIVE_CACHE_DIRECTORY='/var/cache/taptime-wal-archive'
RESTORE_RECOVERY_TIMEOUT_SECONDS='14400'
RESTORE_RECOVERY_POLL_SECONDS='5'
```

## Ausliefern

Der folgende vollständige Befehl läuft auf dem Rechner der ausliefernden Person, nicht auf dem
Server. Er setzt voraus, dass der bestehende Schlüssel im SSH-Agenten geladen ist; nach
Schlüsselverlust ist stattdessen die zweite Variante mit dem neu erzeugten Schlüssel zu
verwenden. `abcdef0` ist durch den geprüften, in CI grünen Ziel-Commit zu ersetzen:

```sh
# Bestehender, geladener SSH-Agent:
ssh taptime-deploy@46.225.58.30 'sudo /usr/local/sbin/taptime-deploy abcdef0'

# Nach Schlüsselverlust mit der neu erzeugten Datei:
ssh -i ~/.ssh/taptime-deploy taptime-deploy@46.225.58.30 \
  'sudo /usr/local/sbin/taptime-deploy abcdef0'
```

Ohne genau einen siebenstelligen Commit-Kurzschlüssel bricht das Skript ab. Es lädt Backend und
Admin-Web für Ziel und Rücknahme. Unterscheidet sich das Ziel vom laufenden Stand und ist noch
nicht als ausgeliefert bekannt, wählt es dessen gleich markiertes Operations-Abbild. Beim
erneuten Deploy des laufenden Stands oder einer bekannten Rücknahme behält es den Stand aus
`operations-version`. Noch vor der Generalprobe extrahiert es dieses Abbild nach
`/opt/taptime/operations/releases/<operations-version>` und prüft Dateibestand,
Dateimodi, Shell-Syntax, systemd-Einheiten, Compose und Caddy. Ein ungültiger Caddyfile wird in
einem getrennten Wegwerf-Container abgewiesen; der laufende Caddy wird dabei weder neu geladen
noch ersetzt. Erst nach vollständig grüner Prüfung wechselt
`/opt/taptime/operations/current` atomar und diese Ziele verweisen auf den ausgewählten Stand:

- `/usr/local/sbin/taptime-backup`, `taptime-restore-verify`,
  `taptime-restore-activate`, `taptime-wal-receiver` und `taptime-wal-archiver`
- `/usr/local/sbin/taptime-immediate-monitor` und `taptime-daily-monitor`
- alle zugehörigen versionierten Einheiten unter `/etc/systemd/system/`
- `/etc/systemd/journald.conf.d/60-taptime.conf`
- `/opt/taptime/source/infrastructure/docker-compose.server.yml`
- `/opt/taptime/source/infrastructure/caddy/Caddyfile`
- `/opt/taptime/source/apps/backend-schema/migrations`
- `/var/lib/taptime-deploy/operations-version`

Geänderte systemd-Einheiten werden mit `daemon-reload` eingelesen und aktive Timer neu gestartet;
eine geänderte journald-Konfiguration startet journald neu. Scheitert Installation oder Reload,
stellt das Skript sämtliche bisherigen Ziele einschließlich Migrationsquellen und Versionsstand
sowie den bisherigen Operations-Zeiger wieder her.
Das geschieht vollständig **vor** Generalprobe, Sicherung und Migration.

Danach legt das Skript die vollständigen Admin-Web-Releases für Ziel und Rücknahme daneben und
weist nach, dass das Zielabbild den versionierten Vertrag für verzögerte Archivquittungen trägt.
Es prüft WAL-Mount und Datenbankvertrag getrennt. Fehlt einer von beiden, stoppt es das alte
Backend, richtet den physischen Empfänger ein und lädt vorhandenes WAL zunächst ohne
Datenbankquittung extern hoch. Vor der Migration erzeugt es eine frische physische Basis, belegt
deren Start-WAL extern und probt die Wiederherstellung samt ausstehenden Migrationen in einem
isolierten Container. Nach der Migration wiederholt es Basis, WAL-Nachweis und Restore mit dem
aktiven versionierten Archivvertrag. Erst danach aktiviert es Backend und Oberfläche. Ein
serverbestätigtes WorkEvent kann daher nicht in einem unarchivierten Umschaltfenster entstehen.
Die Oberfläche wechselt durch genau eine
Symlink-Umbenennung. Ihre `index.html` verweist ausschließlich auf
`/releases/<version>/assets/...`; die vorherigen Releases bleiben erreichbar. Deshalb lädt auch
ein Browser an der Umschaltgrenze alle Bausteine aus der Version seiner `index.html`. Der
Caddy-Pfad liefert die kleine `index.html` immer mit `Cache-Control: no-store` aus. Dateien unter
`/releases/*` tragen den Commit-Kurzschlüssel im Pfad und dürfen deshalb ein Jahr lang als
`immutable` zwischengespeichert werden. `/assets/*` bedient weiterhin ausschließlich die
unversionierten T-006-Bausteine aus dem bisherigen Wurzelverzeichnis, damit auch eine unmittelbar
vor der ersten T-026-Umschaltung geladene alte `index.html` ihre Dateien noch vollständig erhält;
diese Übergangsdateien dürfen nur fünf Minuten im Cache bleiben und müssen danach neu validiert
werden. Der alte Pfad kann in einer Folgeaufgabe entfernt werden, sobald T-026 mindestens fünf
Minuten produktiv ist und keine vor der Umschaltung geöffnete T-006-Seite mehr unterstützt werden
muss. Der
Caddy-Container wird ohne seine Daten- und Konfigurationsvolumes zu verändern neu erzeugt, damit
auch eine neu installierte Caddyfile sicher eingelesen wird. Erst wenn das laufende
Backend-Abbild, die öffentliche `/version.txt` und die vollständige öffentliche
Anmeldekonfiguration im tatsächlich ausgelieferten Anwendungsbündel gemeinsam das Ziel belegen,
schreibt das Skript `current-version` fort. Das
Migrationsabbild bringt die eingefrorenen SQL-Dateien selbst mit; das Skript hält die von T-007
geprüfte lokale Quelle dazu synchron. Wegwerf-Container sowie die nur im tmpfs entpackte Basis
und WAL-Kette existieren nach der Probe nicht mehr.

Für den T-035-Pfad liegt vor dem freigegebenen Produktivdeploy noch keine reale Laufzeitmessung
vor. Basis- und WAL-Upload sowie beide Restore-Proben können minutenlang keine neue Ausgabe
erzeugen; das ist kein Hänger und kein Grund zum Abbrechen. Maßgeblich ist die abschließende
Zeile `[7/7] Auslieferung abgeschlossen: <vorher> -> <ziel>`. Die Laufzeit wird beim ersten
freigegebenen Lauf gemessen.

Danach vom eigenen Rechner aus alle vier Belege prüfen:

```sh
# Genau eine der beiden current-Prüfungen passend zum Zugangsweg ausführen:
ssh taptime-deploy@46.225.58.30 'cat /var/lib/taptime-deploy/current-version'
ssh -i ~/.ssh/taptime-deploy taptime-deploy@46.225.58.30 \
  'cat /var/lib/taptime-deploy/current-version'

curl --fail --silent --show-error https://api.tb-infra.de/health
curl --fail --silent --show-error \
  --header 'Cache-Control: no-cache' https://admin.tb-infra.de/version.txt
```

`current-version` und `/version.txt` müssen exakt den Ziel-Commit nennen; `/health` muss
erfolgreich antworten. Die gesicherte Deploy-Ausgabe muss zusätzlich
`Backend und startfähiges Admin-Web belegen gemeinsam Version <ziel>` enthalten; diese Prüfung
hat die ausgelieferte `index.html` und ihr versionsgebundenes Anwendungsbündel geladen und darin
Supabase-Herkunft und öffentlichen Anwendungsschlüssel nachgewiesen, ohne deren Werte auszugeben.
Der Ledger-Nachweis steht ebenfalls in der Deploy-Ausgabe: Die Zeile
`B3 migrations complete: applied=... existing=...` muss sämtliche Migrationen entweder als neu
angewendet oder vorhanden ausweisen. Fehlt einer dieser Belege, ist die Auslieferung nicht
erfolgreich nachgewiesen.

Schlägt die Operations- oder Abbildprüfung **vor** der ersten `[Archiv]`- beziehungsweise
Sicherungszeile fehl, sind Datenbank und Anwendung unangetastet. Danach kann der sichere
Archiv-Cutover das alte Backend bereits gestoppt, die Datenbank mit WAL-Mount neu erzeugt und
eine externe Basis samt WAL geschrieben haben; nach der Migrationszeile kann auch das Schema
fortgeschritten sein. `current-version` bleibt bis zum vollständigen Erfolg unverändert, ist
aber kein Beleg dafür, dass der alte Container noch läuft. Vollständige Ausgabe sichern, Ursache
korrigieren und den Deploy kontrolliert wiederholen. Niemals eine veröffentlichte Migration
umschreiben oder das alte Backend am Archivtor vorbei manuell starten.

## Rücknahme und Unterbrechung

Rücknahme ist derselbe Befehl mit der ausdrücklich gewünschten früheren Anwendungsversion. Sie
behält die separat freigegebene Betriebsfassung und aktiviert Backend und Admin-Web der älteren
Anwendung gemeinsam. Das Schema wird nie zurückgedreht; Migrationen müssen deshalb zur
vorherigen Anwendung kompatibel bleiben.

**Nach Migration 023 ist ein Rückbau auf ein älteres Backend-Image kein gangbarer Rollback.**
`app.offline_archive_contract_version` erzwingt den versionierten Archivvertrag; ein älteres
Image verweigert die Offline-Ingestion bewusst. Weder ein unverändertes `current-version` noch
ein manueller Containerstart heben diesen Zaun auf. Bei einem Fehler den archivfähigen Stand
vorwärts reparieren und erneut geprüft ausliefern, statt das ältere Image zu starten.

Der aktuelle T-035-Controller nimmt nach einem fehlgeschlagenen Start keine automatische
Rücknahme vor: Jeder erreichbare Start folgt bereits auf Archiv-Cutover oder aktiven
Archivvertrag. Er meldet `[7/7] Archivvertrag ist aktiv; das alte Backend bleibt zur
Verlustvermeidung gestoppt.` Vollständige Ausgabe sichern, keine Container von Hand starten,
Ursache beheben und den Deploy kontrolliert wiederholen. Der ältere automatische Vor-Archiv-Zweig
ist im T-035-Ablauf nicht erreichbar.

Bricht der Prozess nach der Migration, aber vor dem Start ab, bleibt `current-version`
unverändert. War der Archivvertrag bereits aktiv, kann der alte archivfähige Container
weiterlaufen. Beim erstmaligen Archiv-Cutover bleibt das alte Backend dagegen bewusst gestoppt;
ein manueller Start würde wieder eine vorzeitige Quittung ermöglichen. Der nächste Deploy-Aufruf
probt erneut, erkennt die Migrationen als bereits angewendet und setzt den sicheren Weg fort.
Für einen späteren manuellen Compose-Start müssen Anwendungsversion **und** ausgewähltes
PostgreSQL-Volume ausdrücklich aus ihren Zustandsdateien gesetzt werden; der normale Weg bleibt
der Deploy-Controller:

```sh
postgres_volume=taptime-postgres-data
if test -f /var/lib/taptime-deploy/postgres-volume; then
  postgres_volume="$(cat /var/lib/taptime-deploy/postgres-volume)"
fi
TAPTIME_VERSION="$(cat /var/lib/taptime-deploy/current-version)" \
TAPTIME_POSTGRES_VOLUME="$postgres_volume" \
docker compose --file /opt/taptime/source/infrastructure/docker-compose.server.yml up --detach
unset postgres_volume
```

## Was dieser Weg weiterhin nicht aktualisiert

| Bestandteil | Wie er heute auf den Server kommt | Folge eines veralteten Stands |
|---|---|---|
| `/opt/taptime/.env` und Dateien unter `/opt/taptime/secrets` | getrennte Verwahrung und bewusste Installation durch den Product Owner | Anwendung startet mit alten Zugangsdaten oder nach einer Rotation gar nicht; eine automatische Verteilung wäre selbst ein Geheimnisweg |
| `/usr/local/sbin/taptime-deploy` | bei jeder ausdrücklich freigegebenen Controlleränderung separater Konsolenschritt aus dem exakten Operations-Abbild | der Controller kann sich nicht sicher selbst ersetzen; ohne den Schritt läuft ein neuer Betriebsvertrag unter einem alten Controller nicht an |
| `/etc/taptime-backup/config`, Borg-Schlüssel und Passphrase-Datei | getrennte Verwahrung und bewusste Installation durch den Product Owner | Sicherung oder Restore können ohne betriebliche Zugangswerte nicht laufen; ein Operations-Abbild darf sie nicht enthalten |
| `/etc/taptime-monitor/*.curl` | getrennte geheime Einrichtung nach `MONITORING.md` | Alarmziele fehlen oder zeigen auf alte Endpunkte; sie dürfen nicht in Git oder einem öffentlichen Abbild stehen |
| SSH-Härtung, Deploy-Schlüssel und sudoers-Regel | bewusster Konsolen-/Root-Schritt nach dieser Anleitung | verlorene oder zu breite Zugänge bleiben bestehen; ein automatisches Deploy darf diese Rückwege nicht selbst verändern |

Diese Grenze ist ausdrücklich inventarisiert. Backend, Admin-Web, Backup- und Monitoring-Skripte,
deren Einheiten, journald-Grenzen, Compose und Caddy kommen dagegen ausschließlich über die drei
gleich markierten Abbilder.
