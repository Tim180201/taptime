# Wiederholbar ausliefern

Backend, Admin-Web und Betriebsdateien werden nach grüner `CI` einmal von
`Release container images` gebaut. Jeder geprüfte Stand erzeugt drei unveränderliche Abbilder,
zum Beispiel
`ghcr.io/tim180201/taptime-backend-api:abcdef0`,
`ghcr.io/tim180201/taptime-backend-api:admin-web-abcdef0` und
`ghcr.io/tim180201/taptime-backend-api:operations-abcdef0`. Sie liegen getrennt im selben
öffentlichen GHCR-Paket und bleiben ohne Registry-Geheimnis anonym lesbar. Es gibt bewusst kein
`latest` und keinen Build auf dem Server. Backend und Admin-Web werden immer gemeinsam auf die
gewünschte Anwendungsversion geschaltet. Ein neuer Anwendungsstand nimmt automatisch sein
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
Passworteingabe bleibt vollständig unsichtbar. Dieser Weg umgeht SSH und wurde vor dem Sperren
des Root-SSH-Logins praktisch geprüft.

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

### Einmaliger Wechsel auf den versionierten Betriebsweg

Das Deploy-Skript kann sich nicht selbst ersetzen. Nach Freigabe des T-028-Commits muss der
Product Owner deshalb genau einmal die Hetzner Console öffnen und dort als `root` die folgenden
Befehle ausführen. `abcdef0` ist der freigegebene T-028-Commit, **nicht** die anschließend
auszuliefernde Anwendungsversion:

```sh
docker pull ghcr.io/tim180201/taptime-backend-api:operations-abcdef0
docker create --name taptime-ops-bootstrap ghcr.io/tim180201/taptime-backend-api:operations-abcdef0
install -d -m 0755 /var/lib/taptime-deploy
docker cp taptime-ops-bootstrap:/bootstrap/taptime-deploy /usr/local/sbin/taptime-deploy.new
docker cp taptime-ops-bootstrap:/bootstrap/version.txt /var/lib/taptime-deploy/operations-version.new
chmod 0755 /usr/local/sbin/taptime-deploy.new
bash -n /usr/local/sbin/taptime-deploy.new
grep -Fx abcdef0 /var/lib/taptime-deploy/operations-version.new
mv /var/lib/taptime-deploy/operations-version.new /var/lib/taptime-deploy/operations-version
cp -a /usr/local/sbin/taptime-deploy /usr/local/sbin/taptime-deploy.previous
mv /usr/local/sbin/taptime-deploy.new /usr/local/sbin/taptime-deploy
grep -F operations- /usr/local/sbin/taptime-deploy
docker rm taptime-ops-bootstrap
```

`bash -n` bleibt bei Erfolg ohne Ausgabe. Der erste `grep` muss genau `abcdef0` ausgeben, der
zweite mehrere Zeilen mit `operations-`. Scheitert ein Befehl vor dem Verschieben des
Deploy-Skripts, bleibt das bisherige Skript aktiv: stoppen und die Ausgabe sichern. Bleibt der
zweite Nachweis nach dem Wechsel leer oder fehlerhaft, sofort zurücksetzen und die Ausgabe melden:

```sh
mv /usr/local/sbin/taptime-deploy.previous /usr/local/sbin/taptime-deploy
```

Die Konsole bleibt offen, bis der erste SSH-Deploy mit dem neuen Skript begonnen hat. Die Datei
`taptime-deploy.previous` wird erst nach einem vollständig erfolgreichen Deploy entfernt.

Auf einem Ersatzserver ohne vorhandenes Deploy-Skript gelten dieselben Befehle, aber die Zeile
mit `cp -a ... taptime-deploy.previous` wird ausgelassen. Nach dem ersten `grep` werden
Operations-Version und Controller wie oben mit `mv` aktiviert; der zweite `grep` ist derselbe
Erfolgsnachweis. Scheitert er, bleibt der Server abgeschaltet und die Konsole offen, bis der
Bootstrap mit einem neu gebauten, freigegebenen Operations-Abbild wiederholt werden kann.

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
Deploy aber nicht ausgewählt. Für den noch ausstehenden Deploy ist die Anwendungsversion
`3893611`; die Rücknahmeversion steht in
`/var/lib/taptime-deploy/current-version`, die Betriebsfassung in
`/var/lib/taptime-deploy/operations-version`. Keine davon darf geraten werden.

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

- `/usr/local/sbin/taptime-backup` und `taptime-restore-verify`
- `/usr/local/sbin/taptime-immediate-monitor` und `taptime-daily-monitor`
- alle acht zugehörigen Dateien unter `/etc/systemd/system/`
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
lässt die unveränderte T-007-Wiederherstellungsprüfung laufen. Unmittelbar vor
deren Cleanup spielt ein begrenzter Hook die ausstehenden Migrationen in **denselben**
Wegwerf-Container ein. Danach wartet das Skript auf eine frische Sicherung, migriert die
Produktion und aktiviert Backend und Oberfläche. Die Oberfläche wechselt durch genau eine
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
Backend-Abbild und die öffentliche
`/version.txt` beide exakt das Ziel belegen, schreibt das Skript `current-version` fort. Das
Migrationsabbild bringt die eingefrorenen SQL-Dateien selbst mit; das Skript hält die von T-007
geprüfte lokale Quelle dazu synchron. Wegwerf-Container und Klartext-Dump existieren nach der
Probe nicht mehr.

Der belegte Lauf mit der aktuellen kleinen Datenmenge dauerte rund eine Minute; für größere
Stände sind mehrere Minuten einzuplanen. Wiederherstellungsprobe und frische Sicherung können
dabei minutenlang keine neue Ausgabe erzeugen; das ist kein Hänger und kein Grund zum
Abbrechen. Die Ausgabe schreitet insgesamt von `[1/7]` bis `[7/7]` fort und endet erfolgreich
mit `Auslieferung abgeschlossen: <vorher> -> <ziel>`.

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
erfolgreich antworten. Der Ledger-Nachweis steht bereits in der gesicherten Deploy-Ausgabe: Die Zeile
`B3 migrations complete: applied=... existing=...` muss sämtliche Migrationen entweder als neu
angewendet oder vorhanden ausweisen. Fehlt einer dieser vier Belege, ist die Auslieferung nicht
erfolgreich nachgewiesen.

Schlägt die Operations-Prüfung oder die Generalprobe fehl, wurden weder Sicherung noch
Produktionsdatenbank noch Anwendung angefasst. Ausgabe sichern, Ursache korrigieren, ein neues
Abbild mit neuem Commit bauen und den Befehl mit dessen Version wiederholen. Niemals eine bereits
veröffentlichte Migration umschreiben.

## Rücknahme und Unterbrechung

Rücknahme ist derselbe Befehl mit der ausdrücklich gewünschten früheren Anwendungsversion. Sie
behält die separat freigegebene Betriebsfassung und aktiviert Backend und Admin-Web der älteren
Anwendung gemeinsam. Schlägt Start oder Gesundheit fehl, setzt das Skript automatisch Backend
und Oberfläche auf die vorherige Anwendungsversion zurück und belegt erneut Backend und
öffentliche `/version.txt`. Das Schema wird nie zurückgedreht; Migrationen müssen deshalb zur
vorherigen Anwendung kompatibel bleiben.

Meldet das Skript `[7/7] Neuer Stand fehlgeschlagen`, **nicht von Hand nachhelfen und nicht selbst
Container starten**. Den automatischen Rücklauf bis `Rücknahme erfolgreich` abwarten, die gesamte
Ausgabe sichern und Ursache sowie beide genannten Versionen melden. Scheitert auch die
automatische Rücknahme, Produktion unverändert lassen, die Hetzner Console als Rückweg offen
halten und den Betriebsfall sofort eskalieren.

Bricht der Prozess nach der Migration, aber vor dem Start ab, läuft der alte Container weiter.
`current-version` bleibt unverändert. Der nächste Aufruf probt erneut, erkennt die Migrationen
als bereits angewendet und kann den Start sicher fortsetzen. Nach einem Serverneustart startet
Docker den zuletzt gesund gestarteten Container über `restart: unless-stopped`; für ein späteres
manuelles `docker compose up` muss `TAPTIME_VERSION` ausdrücklich aus `current-version` gesetzt
werden.

## Was dieser Weg weiterhin nicht aktualisiert

| Bestandteil | Wie er heute auf den Server kommt | Folge eines veralteten Stands |
|---|---|---|
| `/opt/taptime/.env` und Dateien unter `/opt/taptime/secrets` | getrennte Verwahrung und bewusste Installation durch den Product Owner | Anwendung startet mit alten Zugangsdaten oder nach einer Rotation gar nicht; eine automatische Verteilung wäre selbst ein Geheimnisweg |
| `/usr/local/sbin/taptime-deploy` | einmaliger, ausdrücklich belegter Konsolenschritt aus dem Operations-Abbild | der Controller kann sich nicht sicher selbst ersetzen; die von ihm verwalteten Betriebsdateien und deren Versionsstand laufen danach ohne weitere Handkopie durch den normalen Deploy |
| `/etc/taptime-backup/config`, Borg-Schlüssel und Passphrase-Datei | getrennte Verwahrung und bewusste Installation durch den Product Owner | Sicherung oder Restore können ohne betriebliche Zugangswerte nicht laufen; ein Operations-Abbild darf sie nicht enthalten |
| `/etc/taptime-monitor/*.curl` | getrennte geheime Einrichtung nach `MONITORING.md` | Alarmziele fehlen oder zeigen auf alte Endpunkte; sie dürfen nicht in Git oder einem öffentlichen Abbild stehen |
| SSH-Härtung, Deploy-Schlüssel und sudoers-Regel | bewusster Konsolen-/Root-Schritt nach dieser Anleitung | verlorene oder zu breite Zugänge bleiben bestehen; ein automatisches Deploy darf diese Rückwege nicht selbst verändern |

Diese Grenze ist ausdrücklich inventarisiert. Backend, Admin-Web, Backup- und Monitoring-Skripte,
deren Einheiten, journald-Grenzen, Compose und Caddy kommen dagegen ausschließlich über die drei
gleich markierten Abbilder.
