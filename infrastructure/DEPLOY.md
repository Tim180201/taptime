# Wiederholbar ausliefern

Backend, Admin-Web, Betreiber-Web, Startseite und Betriebsdateien werden nach grüner `CI` einmal von
`Release container images` gebaut. Jeder geprüfte Stand erzeugt die zu seinen Fähigkeiten gehörenden unveränderlichen Abbilder,
zum Beispiel
`ghcr.io/tim180201/taptime-backend-api:abcdef0`,
`ghcr.io/tim180201/taptime-backend-api:admin-web-abcdef0`,
`ghcr.io/tim180201/taptime-backend-api:operator-web-abcdef0`,
`ghcr.io/tim180201/taptime-backend-api:landing-web-abcdef0` und
`ghcr.io/tim180201/taptime-backend-api:operations-abcdef0`. Sie liegen getrennt im selben
öffentlichen GHCR-Paket und bleiben ohne Registry-Geheimnis anonym lesbar. Es gibt bewusst kein
`latest` und keinen Build auf dem Server. Nur der kurze Tag `ops` zeigt als Tippabkürzung auf das
neueste automatisch veröffentlichte Operations-Abbild; dessen Revision wird im Abbild selbst
geprüft. Ein manueller Bau für eine alte Rücknahmeversion verschiebt `ops` ausdrücklich nicht.
Backend und die vorhandenen Weboberflächen werden gemeinsam auf die gewünschte Anwendungsversion geschaltet.
Historische Quellen ohne `apps/operator-web` erzeugen kein Betreiber-Abbild. Das Backend-Abbild
trägt dafür das aus der Quelle abgeleitete Label `io.taptime.operator-web`; ein fehlendes Label
älterer Abbilder bedeutet ebenfalls, dass diese Version kein Betreiber-Web enthält.
Entsprechend kennzeichnet `io.taptime.landing-web` die Startseite. Historische Quellen ohne
`apps/landing-web` erzeugen kein Startseiten-Abbild; fehlende Fähigkeit deaktiviert die
Startseite, ein fehlgeschlagenes Herunterladen gilt niemals als fehlende Fähigkeit.
Ein neuer Anwendungsstand nimmt automatisch sein
gleich markiertes Operations-Abbild mit; eine Rücknahme auf eine bereits bekannte Anwendung oder ein historisches Ziel ohne Startseiten-Fähigkeit
behält dagegen den zuletzt installierten, neueren Betriebsstand.

## Zugang und Berechtigung

Der Produktionsserver ist `taptime-prod` unter `46.225.58.30`. Ausliefern darf nur der Product
Owner oder eine von ihm ausdrücklich beauftragte Person mit dem privaten SSH-Schlüssel, dessen
öffentlicher Teil beim Unix-Benutzer `taptime-deploy` hinterlegt ist. Der Schlüssel und andere
Geheimnisse gehören weder in Git noch in Befehlsargumente. `taptime-deploy` hat kein allgemeines
`sudo`; erlaubt sind `/usr/local/sbin/taptime-deploy` mit einer geprüften Zielversion und
`/usr/local/sbin/taptime-status` **ohne Argumente**. Der Diagnosebefehl zeigt Versionen,
Dienstzustände, die letzten 30 WAL-Durchläufe, Sicherungsanfänge/-enden, gespeicherte
Monitor-Alarme und freien Platz. Er lädt keine Geheimnisdatei und gibt aus dem Journal nur
fest erlaubte Felder aus. Aufruf im eigenen Terminal:

```sh
ssh taptime-deploy@46.225.58.30 'sudo -n /usr/local/sbin/taptime-status'
```

Der unabhängige Rückweg ist die **Hetzner Console**: Projekt *Taptime* → Server
*taptime-prod* → *Aktionen* → *Konsole*. Mit `root` und dem im Passwortmanager verwahrten
Server-Root-Passwort anmelden. Diese Konsole verwendet eine **US-Tastaturbelegung**; die
Passworteingabe bleibt vollständig unsichtbar. Auf einer deutschen Tastatur erzeugt
`Shift` + `Ö` den Doppelpunkt `:`, die Taste `-` unten rechts neben dem Punkt den Schrägstrich
`/` und die Taste `ß` oben rechts neben der `0` den Bindestrich `-`; außerdem sind `y` und `z`
vertauscht. **Es gibt keine Einfügefunktion.** Jeden Befehl von Hand tippen, vor Enter lesen
und die Abschlussmeldung als Foto sichern. Für den kurzen Block unten außerdem: `=` liegt auf
der deutschen Taste `´`, `$` auf `Shift` + `4`. Keine Tilde erforderlich. Dieser Weg umgeht SSH
und wurde vor dem Sperren des Root-SSH-Logins praktisch geprüft.

## Einmalige Einrichtung

Vor dem ersten T-068b-Deploy muss `betreiber.tb-infra.de` per DNS-A-Eintrag auf
`46.225.58.30` zeigen. Ein AAAA-Eintrag ist nur mit tatsächlich eingerichtetem IPv6-Zugang
zulässig. Der Controller löst den Namen vor Sperre, Timeränderung und Downloads auf. Ohne
Auflösung endet er mit `DNS-Eintrag für betreiber.tb-infra.de fehlt`; die übrigen Schritte
bleiben aus. Die Vorprüfung prüft die Auflösung, nicht die korrekte Zieladresse. Diese wird
bei der DNS-Einrichtung kontrolliert; HTTPS und ausgelieferte Inhalte prüft das spätere Tor.

Schreibe den tatsächlich laufenden Commit-Kurzschlüssel nach
`/var/lib/taptime-deploy/current-version`. Diese Datei ist die Rücknahme-Referenz und darf nicht
geraten werden. Das öffentliche Repository erzeugt über GitHub Actions ein öffentliches,
anonym lesbares GHCR-Paket; ein Registry-Passwort wird auf dem Server daher nicht benötigt.
Lege `/opt/taptime/admin-web/status` an. Daneben verwaltet das Deploy-Skript künftig
`releases/<version>` und den atomar gewechselten Symlink `current`; es verändert den
`status`-Ordner bei der Umschaltung nicht.
Für das Betreiber-Web legt der Controller `/opt/taptime/operator-web/releases/<version>`
selbst an und schaltet `current` atomar. Caddy bindet diesen Baum nur lesbar ein.
Alte Releases bleiben für noch geöffnete Browser erhalten; es gibt keine automatische
lokale Löschung. Bei endgültiger Stilllegung entfernt root nach gesonderter Freigabe
den `current`-Link, prüft HTTP 404 und entfernt anschließend den Release-Baum. Bei einer
Rücknahme entfernt der Controller ausschließlich den Link, nicht die Release-Dateien.

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
v=abcdef0
i=ghcr.io/tim180201/taptime-backend-api:operations-$v
docker pull $i
docker run --rm -v /:/h $i
cat /var/lib/taptime-deploy/operations-version
```

Bei einem Fehler keine weitere Zeile ausführen. Die Abschlussmeldung und die letzte Ausgabe
müssen die technisch freigegebene Revision nennen. **T-057 und die
Controller-Erweiterungen T-068b, T-071 und T-031 werden gemeinsam in einer einzigen Konsolensitzung vor dem großen
Deploy installiert.** Dafür erst das gemeinsame, geprüfte Operations-Abbild verwenden.
Der Block installiert auch den root-eigenen Diagnosebefehl (0755) und die geprüfte Regel
(root:root, 0440) in `/etc/sudoers.d/taptime-status`:

```sudoers
taptime-deploy ALL=(root) NOPASSWD: /usr/local/sbin/taptime-status ""
```

Die leeren Anführungszeichen verbieten Argumente. Der Installer legt beide Dateien an,
aktualisiert sie bei einem weiteren Controller-Update und nimmt sie bei einem Installationsfehler
zusammen mit dem Controller zurück. Bei dauerhafter Entfernung dieses Diagnosezugangs entfernt
root zuerst die sudoers-Datei und dann den Befehl in einer gesondert freigegebenen Konsolensitzung.

Die vollständige Einbindung des Server-Dateisystems mit `-v /:/h` ist nur hier vertretbar:
bewusst, durch `root` in der Hetzner Console und mit dem eigenen, exakt versionierten Abbild. Sie
gibt dem Container absichtlich Schreibzugriff auf den ganzen Server und gehört deshalb
ausdrücklich in keinen automatisierten Ablauf, keine CI und keinen gewöhnlichen Deploy.

`ops` ist nur ein beweglicher Hinweis auf das neueste Operations-Abbild und kein zulässiger
Freigabenachweis für eine Controlleraktualisierung. Das exakte Abbild trägt seine siebenstellige
Revision zusätzlich fest im Installer und in einer getrennten Versionsdatei; der Installer
vergleicht beide, bevor er den eingebundenen Server berührt. Das beweist nur, dass das Abbild in
sich stimmig ist. Danach prüft der Installer die
Shell-Syntax und sudoers-Regel, sichert eine vorhandene Vorgängerfassung und ersetzt Controller,
Diagnosebefehl, Diagnose-Regel und aufgezeichnete Betriebsversion mit Rücknahme bei einem Fehler.
Derselbe Befehl ist wiederholbar
und gilt unverändert auf einem Ersatzserver ohne vorhandenes Deploy-Skript.

Docker kann vor der Abschlussmeldung mehrere Ladezeilen ausgeben; für die Bedienung zählt die
**letzte Zeile**. Erfolg lautet `ERFOLG: Deploy-Controller <revision> installiert.`. Die
ausführende Person vergleicht die dort genannte Revision mit dem technisch freigegebenen Commit, aus dem
die zugehörigen Abbilder gebaut wurden, und fährt nur bei Gleichheit fort — nicht mit der Spitze von `main`, auf der inzwischen
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
lädt und validiert diesen Satz fail-closed. Sie schützt Backend, Admin-Web und vorhandene Betreiber-Web-Abbilder für alle bekannten
Anwendungsversionen sowie genau das ausgewählte Operations-Abbild. Vor einem neuen Push behält
sie die neuesten Abbilder bis zu insgesamt zwanzig Paketversionen. Laufende Anwendung,
Rücknahmeversion und Betriebsfassung können dadurch nie von der Aufräumung gelöscht werden.

Vor dem ersten T-028-Deploy müssen Backend und Admin-Web für Ziel und Rücknahme sowie die
Operations-Abbilder des freigegebenen T-028-Controllers und der Zielanwendung vorhanden sein.
Starte `Release container images` bei Bedarf manuell mit `source_ref` gleich dem vollständigen
Commit der gewünschten Version. Bereits vorhandene unveränderliche Abbilder werden geprüft und
nicht neu gebaut; fehlende Backend-, Admin-Web-, Betreiber-Web- oder Operations-Abbilder werden ergänzt.
Betreiber-Web wird dabei nur gebaut, wenn es in der ausgewählten Quelle vorhanden ist. Ein
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

Der folgende Ablauf läuft in einer **interaktiven Terminalsitzung des Product Owners** auf
seinem Mac. Codex startet keinen Deploy; seine Werkzeugumgebung kann Hintergrundprozesse
beenden. Der bestehende Schlüssel muss im SSH-Agenten geladen sein (`ssh-add -l` prüfen;
gegebenenfalls den verwahrten Schlüssel mit `ssh-add` laden). Nach Schlüsselverlust beim
SSH-Aufruf zusätzlich `-i "$HOME/.ssh/taptime-deploy"` verwenden. `abcdef0` ist durch den
geprüften, in CI grünen Ziel-Commit zu ersetzen. Das Log liegt außerhalb des Repositorys:

```sh
mkdir -p "$HOME/taptime-logs"
ssh-add -l
set -o pipefail
caffeinate -i ssh -t taptime-deploy@46.225.58.30 \
  'sudo /usr/local/sbin/taptime-deploy abcdef0' 2>&1 \
  | tee "$HOME/taptime-logs/deploy-$(date +%Y%m%d-%H%M%S).log"
```

Bei fehlendem Agent-Schlüssel vor dem letzten Befehl stoppen. Terminal und Mac bleiben bis
zum Abschluss offen. Danach liest Codex bei Bedarf das gesicherte Log.

Vor der ersten `[Vorbereitung]`-Zeile hält der Controller den Sicherungs-Timer an und wartet
auf eine laufende Sicherung, höchstens 20 Minuten mit einer Fortschrittszeile je Minute.
Er zeigt laufende und Zielversion, Sicherungszustand samt letztem Ende (`InactiveEnterTimestamp`,
bei Oneshot nicht `ActiveEnterTimestamp`) und Ergebnis, Archivierer/Empfänger sowie freien Platz.
Die Plattengrenze stammt aus dem installierten Tagesmonitor. Bei rotem Befund beginnt keine
Abbildvorbereitung oder Änderung an Anwendung/Betriebsdateien. Nur beim erkannten erstmaligen
Archiv-Cutover dürfen die noch nicht eingerichteten Archivdienste inaktiv sein.
Der EXIT-Trap startet den zuvor aktiven Timer wieder, auch bei Fehler, `INT`, `TERM` und `HUP`.
`SIGKILL`, Stromausfall und Kernelabbruch können keinen Shell-Trap ausführen; nach einem solchen
Abbruch prüft root den Timer über den bestehenden Konsolenweg, bevor weiter ausgeliefert wird.

Ohne genau einen siebenstelligen Commit-Kurzschlüssel bricht das Skript ab. Es lädt Backend und
Admin-Web für Ziel und Rücknahme und bereitet deren Releases vor. Danach liest es die
Betreiber-Fähigkeit aus den beiden Backend-Abbildern und bereitet die jeweils vorhandenen
Betreiber-Releases vor. Bei Erstinstallation lädt es nur das Betreiber-Ziel und protokolliert
`Betreiber-Web wird erstmals installiert; keine Rücknahmeversion`. Ein fehlgeschlagener
Download eines laut Label erforderlichen Abbilds bricht ab. Ein bisher unbekanntes Ziel mit
Startseiten-Fähigkeit wählt sein gleich markiertes Operations-Abbild. Beim erneuten Deploy des
laufenden Stands, einer bekannten Rücknahme **oder einem historischen Ziel ohne Startseite**
behält es den Stand aus `operations-version`. So bleibt auch ein bereits veröffentlichtes
Alt-Abbild ohne das neue Passwortwerkzeug unverändert auslieferbar. Noch vor der Generalprobe extrahiert es dieses Abbild nach
`/opt/taptime/operations/releases/<operations-version>` und prüft Dateibestand,
Dateimodi, Shell-Syntax, systemd-Einheiten, Compose und Caddy. Ein ungültiger Caddyfile wird in
einem getrennten Wegwerf-Container abgewiesen; der laufende Caddy wird dabei weder neu geladen
noch ersetzt. Erst nach vollständig grüner Prüfung wechselt
`/opt/taptime/operations/current` atomar und diese Ziele verweisen auf den ausgewählten Stand:

- `/usr/local/sbin/taptime-operator-grant`, `taptime-operator-db-login` und `taptime-landing-password`
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

Nach Operations-Auswahl und Download, aber vor der Installation weist das Skript nach, dass
das Zielabbild den versionierten Vertrag für verzögerte Archivquittungen trägt. WAL-Mount und
Datenbankvertrag wurden in der Vorprüfung getrennt erfasst. Fehlt einer von beiden, beginnt
nach der geprüften Operations-Installation der Archiv-Cutover: das Skript stoppt das alte
Backend, richtet den physischen Empfänger ein und lädt vorhandenes WAL zunächst ohne
Datenbankquittung extern hoch. Vor der Migration erzeugt es eine frische physische Basis, belegt
deren Start-WAL extern und probt die Wiederherstellung samt ausstehenden Migrationen in einem
isolierten Container. Beide Proben erhalten jeweils den exakten Namen ihrer eigenen, gerade
erzeugten Basis aus der abgeschlossenen Sicherungsmeldung nach einer Journalmarke vor dem Start.
Eine inzwischen neuere Basis wird nicht ausgewählt; eine fehlende oder mehrdeutige Meldung
bricht ab. Nach der Migration wiederholt es Basis, WAL-Nachweis und Restore mit dem
aktiven versionierten Archivvertrag. Erst danach aktiviert es beide Weboberflächen im bisherigen Aktivierungsschritt und startet das Backend. Ein
serverbestätigtes WorkEvent kann daher nicht in einem unarchivierten Umschaltfenster entstehen.
Beim ersten Cutover registriert ein synchroner Archiviererlauf die verifizierte Basis, bevor
das unveränderte Zeitfenster für die WAL-Barriere beginnt.
Jede Oberfläche wechselt durch eine atomare
Symlink-Umbenennung. Ihre `index.html` verweist ausschließlich auf
`/releases/<version>/assets/...`; die vorherigen Releases bleiben erreichbar. Deshalb lädt auch
ein Browser an der Umschaltgrenze alle Bausteine aus der Version seiner `index.html`. Der
Caddy-Pfad liefert die kleine `index.html` immer mit `Cache-Control: no-store` aus. Dateien unter
`/releases/*` tragen den Commit-Kurzschlüssel im Pfad und dürfen deshalb ein Jahr lang als
`immutable` zwischengespeichert werden. Nur im Admin-Web bedient `/assets/*` weiterhin ausschließlich die
unversionierten T-006-Bausteine aus dem bisherigen Wurzelverzeichnis, damit auch eine unmittelbar
vor der ersten T-026-Umschaltung geladene alte `index.html` ihre Dateien noch vollständig erhält;
diese Übergangsdateien dürfen nur fünf Minuten im Cache bleiben und müssen danach neu validiert
werden. Der alte Pfad kann in einer Folgeaufgabe entfernt werden, sobald T-026 mindestens fünf
Minuten produktiv ist und keine vor der Umschaltung geöffnete T-006-Seite mehr unterstützt werden
muss. Der
Caddy-Container wird ohne seine Daten- und Konfigurationsvolumes zu verändern neu erzeugt, damit
auch eine neu installierte Caddyfile sicher eingelesen wird. Erst wenn das laufende
Backend-Abbild, beide öffentlichen `/version.txt` und die vollständige öffentliche
Anmeldekonfiguration in beiden tatsächlich ausgelieferten Anwendungsbündeln gemeinsam das Ziel belegen,
schreibt das Skript `current-version` fort. Das
Migrationsabbild bringt die eingefrorenen SQL-Dateien selbst mit; das Skript hält die von T-007
geprüfte lokale Quelle dazu synchron. Wegwerf-Container sowie die nur im tmpfs entpackte Basis
und WAL-Kette existieren nach der Probe nicht mehr.

Basis- und WAL-Upload sowie beide Restore-Proben können minutenlang keine neue Ausgabe
erzeugen; das ist kein Hänger und kein Grund zum Abbrechen. Maßgeblich ist die abschließende
Zeile `[7/7] Auslieferung abgeschlossen: <vorher> -> <ziel>` und ein erfolgreicher Prozessausgang.

Danach vom eigenen Rechner aus die Versions- und Gesundheitsbelege prüfen:

```sh
# Genau eine der beiden current-Prüfungen passend zum Zugangsweg ausführen:
ssh taptime-deploy@46.225.58.30 'cat /var/lib/taptime-deploy/current-version'
ssh -i ~/.ssh/taptime-deploy taptime-deploy@46.225.58.30 \
  'cat /var/lib/taptime-deploy/current-version'

curl --fail --silent --show-error https://api.tb-infra.de/health
curl --fail --silent --show-error \
  --header 'Cache-Control: no-cache' https://admin.tb-infra.de/version.txt
curl --fail --silent --show-error \
  --header 'Cache-Control: no-cache' https://betreiber.tb-infra.de/version.txt
```

`current-version` und beide `/version.txt` müssen exakt den Ziel-Commit nennen; `/health` muss
erfolgreich antworten. Die gesicherte Deploy-Ausgabe muss zusätzlich
`Backend und startfähiges Admin-Web belegen gemeinsam Version <ziel>` enthalten; diese Prüfung
hat die ausgelieferte `index.html` und ihr versionsgebundenes Anwendungsbündel geladen und darin
Supabase-Herkunft und öffentlichen Anwendungsschlüssel nachgewiesen, ohne deren Werte auszugeben.
Zusätzlich muss `Betreiber-Web: Version <ziel> oder geprüfte Deaktivierung belegt.` erscheinen.
Für eine Version mit Betreiber-Web prüft dieses Tor exakt ein Skript im Release-Pfad,
dessen Erreichbarkeit, die erwartete Supabase-Herkunft und den öffentlichen
`sb_publishable_`-Schlüssel. Für eine historische Version prüft es den fehlenden `current`-Link
und HTTP 404 für Startseite, Versionsdatei und Betreiber-Session.
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

## Startseite: Konsole → Deploy → Zugang → Browser (T-031)

Den gemeinsamen Controller aus T-071 und T-031 **einmal** mit dem Konsolenblock oben installieren,
danach den normalen, separat freigegebenen Deploy im interaktiven Terminal des Product Owners
mit geladenem SSH-Agent, `caffeinate` und Log außerhalb des Repositorys ausführen (Abschnitt
„Deploy ausführen“). Keine zweite Controllerinstallation zwischen beiden Aufgaben.
`tb-infra.de` und `www.tb-infra.de` müssen auf denselben Server zeigen. Zertifikate werden beim
Deploy geprüft; läuft allein das Startseitenbudget ab, entfernt der Controller deren `current`-Link
und beendet sich mit Fehler. API, Verwaltung, Betreiber-Web und Backend bleiben dabei aktiv.
Die Ursache vorwärts korrigieren und denselben Deploy wiederholen; der Versionszustand wird
bei diesem Fehler noch nicht fortgeschrieben.

Nach erfolgreichem Deploy in der Hetzner-Konsole als root eingeben:

```sh
taptime-landing-password
```

Das Passwort zweimal eingeben, jede Eingabe mit Enter abschließen. Es wird weder angezeigt noch
als Befehlsargument eingegeben. US-Tastatur: **16 bis 64 Kleinbuchstaben ohne y/z und Ziffern**;
im Passwortmanager aufbewahren. Es gibt keine Eingabeaufforderung; Erfolg ist ausschließlich
`gesetzt`. Benutzername im Browser: **pilot**. Zum Sperren:

```sh
taptime-landing-password --disable
```

Erfolg ist `gesperrt`. Ein verworfener Zufallswert ersetzt den Zugang; ein späterer normaler
Aufruf setzt einen neuen. Jeder Wechsel ersetzt die Datei atomar und lädt die laufende
Konfiguration erzwungen neu. Fehler beim Reload oder bei den anschließenden Prüfungen stellen
Datei **und** geladenen Zugang wieder her. Meldet auch dieser Rückweg einen Fehler, keinen Erfolg
annehmen; Konsolensitzung offen halten und an den Technical Lead melden. Das Werkzeug teilt
sich die Auslieferungssperre mit dem Controller.

Browserprüfung: `https://tb-infra.de/` fragt in einem neuen privaten Fenster nach dem Zugang;
mit `pilot` und Passwort erscheint die Seite. `https://tb-infra.de/tag`, `/robots.txt` und
`/version.txt` bleiben ohne Zugang erreichbar. `www` leitet mit 301 auf die Hauptdomain um.
Nach `--disable` muss auch der zuvor gültige Zugang abgewiesen werden. Die Anfrage-Adresse ist
noch leer; öffentliches Freischalten und Rechtstexte sind T-031b.

Lebenszyklus: Der Controller legt `/opt/taptime/landing-web/releases/<version>` unveränderlich an
und wechselt oder entfernt nur `current`. Historische Stände bleiben dadurch auslieferbar.
Root entfernt nicht mehr benötigte Release-Verzeichnisse erst nach Abgleich mit den geschützten
Anwendungsständen; GHCR bewahrt deren `landing-web-`-Abbilder mit auf. Der Controller legt
`/opt/taptime/landing-auth` (0700) und bei fehlender Datei `password.hash` (0600) **vor der
Caddy-Vorprüfung** mit gesperrtem Zugang an. Das root-eigene Werkzeug (0700) wird mit den
Betriebsdateien installiert und ersetzt den Hash. Das gesamte Verzeichnis ist read-only in Caddy
eingebunden, damit atomare Dateiwechsler sichtbar bleiben. Bei endgültiger Entfernung: root nimmt
zuerst den Caddy-Block samt Einbindungen über eine geprüfte Betriebsänderung heraus und löscht erst
danach Zugang, Werkzeug und nicht mehr geschützte Releases. Hash-Dateien nie ausgeben oder sichern,
indem sie in einen Bericht kopiert werden.

### Caddy-Rückweg unabhängig vom Backend

Vor jeder Umschaltung validiert der Controller den Kandidaten mit den echten Diensteinbindungen.
Er liest zusätzlich die tatsächlich laufende JSON-Konfiguration über die lokale Admin-Schnittstelle
im Container und legt sie atomar als `/var/lib/taptime-deploy/caddy/running.json` ab (Verzeichnis 0700,
Datei 0600). Die Ladbarkeitsprüfung verwendet die laufenden Einbindungen. Ein Fehler bei Lesen,
Speichern oder Prüfen beendet den Deploy vor der Umschaltung. Die Sicherung wird beim nächsten
Deploy ersetzt; root entfernt den Zustand erst nach endgültiger Stilllegung des Caddy-Rückwegs.

Nach dem Caddy-Wechsel werden zuerst API sowie Versionen von Verwaltung und Betreiber-Web geprüft.
Bei Fehlern stellt der Controller die vorherigen Web-Verweise wieder her und lädt ausdrücklich die
gesicherte JSON-Datei mit erzwungenem Reload. Ein anschließendes GET muss bytegleich zur Sicherung
sein. Anschließend wird ausschließlich Caddy mit dieser Datei als explizitem `--config` neu
erzeugt (`--no-deps`), damit auch ein späterer Container- oder Host-Neustart den Rückweg erhält.
Bei gestopptem Dienst, Neustartschleife oder nicht nachweisbarem Reload geschieht dieser
JSON-Rückstart direkt. Danach wird die laufende JSON erneut abgeglichen. Die dafür angelegte private
`recovery.compose.yml` bleibt bis zum nächsten normalen Deploy bestehen; dann wird wieder die
normale Dienstdefinition verwendet. Die drei bestehenden Oberflächen werden erneut geprüft;
der ursprüngliche Fehlercode bleibt erhalten. Backend und Archivvertragssperre bleiben unberührt.

Meldet der Controller `Caddy-Ruecknahme fehlgeschlagen`, ist die alte Kante nicht nachgewiesen.
Den gespeicherten Zustand nicht überschreiben, keinen weiteren normalen Deploy beginnen und
keine gesamte Compose-Gruppe starten. Root und Technical Lead prüfen in einer separat freigegebenen
Konsolensitzung die Caddy-Einbindungen sowie `running.json`; der manuelle Rückweg verwendet genau
sie mit `recovery.compose.yml`, nur für den Dienst `caddy`, ohne Abhängigkeiten. Danach lokale
Admin-Antwort mit der Sicherung vergleichen und API/admin/betreiber prüfen. Ein zurückgesetzter
Caddy ist keine Erlaubnis, das ältere Backend am Archivtor vorbei zu starten.

## Rücknahme und Unterbrechung

Rücknahme ist derselbe Befehl mit der ausdrücklich gewünschten früheren Anwendungsversion. Sie
behält die separat freigegebene Betriebsfassung und aktiviert Backend und Admin-Web der älteren
Anwendung gemeinsam. Hat die Zielversion ein Betreiber-Web, aktiviert der Controller auch
dessen Release. Ohne Betreiber-Web entfernt er `operator-web/current`, prüft die deaktivierte
Oberfläche und schreibt `Betreiber-Web deaktiviert; keine Oberfläche für diese Version.`.
Caddy gibt dann auch für Betreiber-API und archivierte Betreiber-Assets 404 zurück. Derselbe
Zweig gilt für die automatische Rücknahme ohne Vorversion, sofern der bestehende Archiv-Schutz
eine automatische Rücknahme überhaupt erlaubt. Das Schema wird nie zurückgedreht; Migrationen müssen deshalb zur
vorherigen Anwendung kompatibel bleiben.

**Nach Migration 023 ist ein Rückbau auf ein älteres Backend-Image kein gangbarer Rollback.**
`app.offline_archive_contract_version` erzwingt den versionierten Archivvertrag; ein älteres
Image verweigert die Offline-Ingestion bewusst. Weder ein unverändertes `current-version` noch
ein manueller Containerstart heben diesen Zaun auf. Bei einem Fehler den archivfähigen Stand
vorwärts reparieren und erneut geprüft ausliefern, statt das ältere Image zu starten.

Der Controller nimmt nach einem fehlgeschlagenen Backend-Start keine automatische
Backend-Rücknahme vor: Jeder erreichbare Start folgt bereits auf Archiv-Cutover oder aktiven
Archivvertrag. Bei aktivem Vertrag meldet er
`[7/7] Archivvertrag ist aktiv; keine automatische Rücknahme auf das alte Backend.`
Hat nur der Cutover begonnen, meldet er
`[7/7] Archiv-Cutover begonnen; das alte Backend bleibt zur Verlustvermeidung gestoppt.`
Vollständige Ausgabe sichern, keine Container von Hand starten,
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

## Betreiber-Zugang (ab Migration 032)

Nach erfolgreichem Deploy wird ein eigenes Supabase-Konto ohne aktive Betriebsmitgliedschaft
verwendet. Root führt in der Konsole zuerst `/usr/local/sbin/taptime-operator-db-login` aus,
danach `/usr/local/sbin/taptime-operator-grant <Supabase-UUID>` mit der UUID dieses Kontos.
Ein bereits vorhandener Datenbanklogin wird nicht erneut angelegt; für einen bewussten
Passwortwechsel gilt `--rotate` wie unten beschrieben.

Anschließend öffnet der Betreiber `https://betreiber.tb-infra.de`, meldet sich mit E-Mail und
Passwort an und richtet beim ersten Mal TOTP ein: QR-Code mit der Authenticator-App scannen
oder den angezeigten Schlüssel von Hand übernehmen, dann den aktuellen Code bestätigen.
Bei späteren Anmeldungen wird der vorhandene Faktor abgefragt. Erst nach serverbestätigtem
zweiten Faktor erscheinen Betriebsdaten. Zur Verhaltensabnahme Übersicht, Protokoll und
Betriebszustand prüfen und abmelden. Die Sitzung bleibt nur im Tab-Speicher und endet auch
nach 30 Minuten ohne Aktivität; ein Neuladen setzt diese Frist nicht zurück.

Die Operations-Dateien installieren `taptime-operator-db-login` und `taptime-operator-grant`
root-eigen mit Modus 0700. Root ruft sie nach dem freigegebenen Deploy in der Konsole auf;
der Deploy ruft sie nicht auf. Ohne Betreiber-Datenbankzugang startet das Backend normal,
Betreiber-Routen melden `503 operator_not_configured`.

`/usr/local/sbin/taptime-operator-db-login` legt den separaten Login an. `--rotate` erneuert
sein Passwort, auch nach einem Restore. Das Werkzeug liest nur die eindeutige root:root/0600
`.env`, erwartet die installierte Compose-Datenbank `database:5432/taptime`, erzeugt das Passwort
intern, übergibt es ausschließlich auf PostgreSQL-stdin und ersetzt `.env` atomar. Ein vorhandener
Login oder Konfigurationsschlüssel wird ohne `--rotate` niemals überschrieben. Fehler vor dem
Dateitausch rollen die Datenbanktransaktion zurück. Bei einem unklaren Transaktionsabschluss
oder fehlgeschlagenem Neustart meldet es einen Fehler; root gleicht ausdrücklich mit `--rotate`
ab. Nur `backend-api` wird mit seinem derzeit laufenden Abbild neu erstellt und die Betreiber-
Session geprüft. Weder Shell-Tracing noch das Ausgeben oder Kopieren der `.env` ist erforderlich.

`/usr/local/sbin/taptime-operator-grant <Supabase-UUID>` schaltet ein bereits vorhandenes
Supabase-Konto frei; `--revoke <Supabase-UUID>` entzieht es. Der Aussteller kommt aus
`SUPABASE_ISSUER`. Aktive Mitgliedschaft und Betreiber-Freigabe schließen sich in der Datenbank
aus. Jede tatsächliche Änderung erhält einen unveränderlichen Eintrag mit `root@<Rechner>`
und dem betroffenen Betreiber-Datensatz. Erneutes Freischalten nach Entzug erzeugt einen neuen
Datensatz; die vorherige Freigabe und ihr Protokoll bleiben erhalten.

Zum vollständigen Abschalten entzieht root zunächst die Betreiber-Freigaben, entfernt den
Schlüssel `TAPTIME_OPERATOR_DATABASE_URL` atomar aus der root:root/0600-Konfiguration und erstellt
nur `backend-api` mit derselben Version neu. Danach entfernt root den Login in einer lokalen
PostgreSQL-Sitzung mit `DROP ROLE taptime_operator_runtime`; die NOLOGIN-Fähigkeit und die
Audit-Historie bleiben bestehen. Eine spätere Anlage erfolgt wieder mit dem argumentlosen
Werkzeug. Die Skripte selbst werden mit dem Operations-Stand installiert bzw. zurückgenommen.

## Was dieser Weg weiterhin nicht aktualisiert

| Bestandteil | Wie er heute auf den Server kommt | Folge eines veralteten Stands |
|---|---|---|
| `/opt/taptime/.env` und Dateien unter `/opt/taptime/secrets` | getrennte Verwahrung und bewusste Installation durch den Product Owner | Anwendung startet mit alten Zugangsdaten oder nach einer Rotation gar nicht; eine automatische Verteilung wäre selbst ein Geheimnisweg |
| `/usr/local/sbin/taptime-deploy`, `taptime-status` und dessen argumentlose sudoers-Regel | gemeinsamer Konsolenschritt aus dem exakten Operations-Abbild | der Controller kann sich nicht sicher selbst ersetzen; Diagnosezugang und Controller bleiben an die ausdrücklich installierte Fassung gebunden |
| `/etc/taptime-backup/config`, Borg-Schlüssel und Passphrase-Datei | getrennte Verwahrung und bewusste Installation durch den Product Owner | Sicherung oder Restore können ohne betriebliche Zugangswerte nicht laufen; ein Operations-Abbild darf sie nicht enthalten |
| `/etc/taptime-monitor/*.curl` | getrennte geheime Einrichtung nach `MONITORING.md` | Alarmziele fehlen oder zeigen auf alte Endpunkte; sie dürfen nicht in Git oder einem öffentlichen Abbild stehen |
| SSH-Härtung, Deploy-Schlüssel und sudoers-Regel | bewusster Konsolen-/Root-Schritt nach dieser Anleitung | verlorene oder zu breite Zugänge bleiben bestehen; ein automatisches Deploy darf diese Rückwege nicht selbst verändern |

Diese Grenze ist ausdrücklich inventarisiert. Backend, Admin-Web, Betreiber-Web, Backup- und Monitoring-Skripte,
deren Einheiten, journald-Grenzen, Compose und Caddy kommen dagegen ausschließlich über die vier
gleich markierten Abbilder.
