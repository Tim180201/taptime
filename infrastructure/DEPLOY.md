# Wiederholbar ausliefern

Backend und Admin-Web werden nach grüner `CI` einmal von `Release container images` gebaut.
Beide unveränderlichen Abbilder tragen denselben siebenstelligen Commit-Kurzschlüssel, zum
Beispiel `ghcr.io/tim180201/taptime-backend-api:abcdef0` und
`ghcr.io/tim180201/taptime-backend-api:admin-web-abcdef0`. Beide liegen als getrennte Abbilder
im selben öffentlichen GHCR-Paket; so bleiben sie ohne Registry-Geheimnis anonym lesbar. Es gibt
bewusst kein `latest` und keinen Build auf dem Server.

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

Installiere `infrastructure/deploy` als root-ausführbares Skript sowie
`infrastructure/docker-compose.server.yml` und `infrastructure/caddy/Caddyfile` unter
`/opt/taptime/source/infrastructure/`.
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
install -o root -g root -m 0755 \
  /opt/taptime/source/infrastructure/deploy /usr/local/sbin/taptime-deploy
install -d -o root -g root -m 0755 /opt/taptime/admin-web/status
```

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
`known-versions` atomar als nicht sensitiven Schutzsatz unter
`/opt/taptime/admin-web/status/ghcr-protected-versions.json`. Die Veröffentlichungs-Workflow
lädt und validiert diesen Satz fail-closed. Sie wendet denselben Schutz unabhängig auf Backend-
und Admin-Web-Tag an. Vor einem neuen Push behält sie die neuesten vollständigen Paare bis zu
insgesamt zwanzig Abbildern. Jedes Backend- und Admin-Web-Abbild aus dem Schutzsatz bleibt
zusätzlich erhalten; insbesondere können laufende und vorherige Version nie durch die
Aufräumung gelöscht werden.

Vor der ersten T-026-Auslieferung muss auch für die bisher laufende Version ein Admin-Web-Abbild
existieren, damit eine Rücknahme nicht auf den handkopierten Altstand angewiesen ist. Starte dazu
`Release container images` einmal manuell mit `source_ref` gleich dem Inhalt von
`current-version`. Ein bereits vorhandenes Backend-Abbild wird dabei geprüft und nicht neu
gebaut; nur das fehlende Admin-Web-Abbild wird ergänzt.

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

Ohne genau einen siebenstelligen Commit-Kurzschlüssel bricht das Skript ab. Es lädt die beiden
genannten Abbilder und legt die vollständigen Admin-Web-Releases für Ziel und Rücknahme zunächst
daneben. Dann lässt es die unveränderte T-007-Wiederherstellungsprüfung laufen. Unmittelbar vor
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

Schlägt die Probe fehl, wurden weder Sicherung noch Produktionsdatenbank noch Anwendung
angefasst. Ausgabe sichern, Migration korrigieren, ein neues Abbild mit neuem Commit bauen und
den Befehl mit dessen Version wiederholen. Niemals eine bereits veröffentlichte Migration
umschreiben.

## Rücknahme und Unterbrechung

Rücknahme ist derselbe Befehl mit der ausdrücklich gewünschten früheren Version. Sie aktiviert
deren Backend- und Admin-Web-Abbild gemeinsam. Schlägt Start oder Gesundheit fehl, setzt das
Skript automatisch beide Hälften auf die vorherige Version zurück und belegt erneut Backend und
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
| `docker-compose.server.yml`, `Caddyfile` und `/usr/local/sbin/taptime-deploy` | aus dem ausdrücklich geprüften Git-Stand bei einer Betriebsänderung als `root` installiert; der Deploy erzeugt Caddy danach neu | neue Dienste, Routen oder Auslieferungsregeln kommen nicht an; T-026 setzt deshalb vor seinem ersten Lauf die neue Caddy- und Deploy-Fassung voraus |
| Backup-Skripte, `/etc/taptime-backup/config`, Services und Timer | einmalig als `root` aus `infrastructure/backup/` installiert; Konfiguration separat | Sicherung oder Wiederherstellungsprobe kann hinter dem dokumentierten Verfahren zurückbleiben |
| Monitoring-Skripte, Services, Timer und journald-Konfiguration | einmalig als `root` nach `MONITORING.md` installiert | neue Alarme oder Aufbewahrungsgrenzen wirken nicht; ein Ausfall kann ungemeldet bleiben |
| SSH-Härtung, Deploy-Schlüssel und sudoers-Regel | bewusster Konsolen-/Root-Schritt nach dieser Anleitung | verlorene oder zu breite Zugänge bleiben bestehen; ein automatisches Deploy darf diese Rückwege nicht selbst verändern |

Diese Grenze ist ausdrücklich inventarisiert; sie ist kein behaupteter Vollautomatismus. Das
eigentliche Release-Paar aus Backend und Admin-Web kommt dagegen ausschließlich über die beiden
gleich markierten Abbilder.
