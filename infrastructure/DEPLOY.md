# Wiederholbar ausliefern

Das Backend-Abbild wird nach grüner `CI` einmal von `Backend container image` gebaut. Sein Tag
ist der siebenstellige Commit-Kurzschlüssel, zum Beispiel
`ghcr.io/tim180201/taptime-backend-api:abcdef0`. Es gibt bewusst kein `latest`.

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

Installiere `infrastructure/deploy` als root-ausführbares Skript und
`infrastructure/docker-compose.server.yml` unter `/opt/taptime/source/infrastructure/`.
Schreibe den tatsächlich laufenden Commit-Kurzschlüssel nach
`/var/lib/taptime-deploy/current-version`. Diese Datei ist die Rücknahme-Referenz und darf nicht
geraten werden. Das öffentliche Repository erzeugt über GitHub Actions ein öffentliches,
anonym lesbares GHCR-Paket; ein Registry-Passwort wird auf dem Server daher nicht benötigt.

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
lädt und validiert diesen Satz fail-closed. Vor einem neuen Push behält sie die neun neuesten
vorhandenen Abbilder, sodass das neue Abbild den regulären Satz auf zehn ergänzt. Bei einem
bereits existierenden Ziel bleiben zehn erhalten. Jedes Abbild aus dem Schutzsatz bleibt
zusätzlich erhalten; insbesondere können laufende und vorherige Version nie durch die
Aufräumung gelöscht werden.

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

Ohne genau einen siebenstelligen Commit-Kurzschlüssel bricht das Skript ab. Es lädt das genannte
Abbild und lässt die unveränderte T-007-Wiederherstellungsprüfung laufen. Unmittelbar vor deren
Cleanup spielt ein begrenzter Hook die ausstehenden Migrationen in **denselben** Wegwerf-Container
ein. Danach wartet das Skript auf eine frische Sicherung, migriert die Produktion und startet
exakt das genannte Abbild. Erst interne und externe Gesundheit schreiben `current-version` fort.
Das Migrationsabbild bringt die eingefrorenen SQL-Dateien selbst mit; das Skript hält die von
T-007 geprüfte lokale Quelle dazu synchron. Wegwerf-Container und Klartext-Dump existieren nach
der Probe nicht mehr.

Der belegte Lauf mit der aktuellen kleinen Datenmenge dauerte rund eine Minute; für größere
Stände sind mehrere Minuten einzuplanen. Wiederherstellungsprobe und frische Sicherung können
dabei minutenlang keine neue Ausgabe erzeugen; das ist kein Hänger und kein Grund zum
Abbrechen. Die Ausgabe schreitet insgesamt von `[1/7]` bis `[7/7]` fort und endet erfolgreich
mit `Auslieferung abgeschlossen: <vorher> -> <ziel>`.

Danach vom eigenen Rechner aus alle drei Belege prüfen:

```sh
# Genau eine der beiden current-Prüfungen passend zum Zugangsweg ausführen:
ssh taptime-deploy@46.225.58.30 'cat /var/lib/taptime-deploy/current-version'
ssh -i ~/.ssh/taptime-deploy taptime-deploy@46.225.58.30 \
  'cat /var/lib/taptime-deploy/current-version'

curl --fail --silent --show-error https://api.tb-infra.de/health
```

`current-version` muss exakt den Ziel-Commit nennen und `/health` muss erfolgreich antworten.
Der Ledger-Nachweis steht bereits in der gesicherten Deploy-Ausgabe: Die Zeile
`B3 migrations complete: applied=... existing=...` muss sämtliche Migrationen entweder als neu
angewendet oder vorhanden ausweisen. Fehlt einer dieser drei Belege, ist die Auslieferung nicht
erfolgreich nachgewiesen.

Schlägt die Probe fehl, wurden weder Sicherung noch Produktionsdatenbank noch Anwendung
angefasst. Ausgabe sichern, Migration korrigieren, ein neues Abbild mit neuem Commit bauen und
den Befehl mit dessen Version wiederholen. Niemals eine bereits veröffentlichte Migration
umschreiben.

## Rücknahme und Unterbrechung

Rücknahme ist derselbe Befehl mit der ausdrücklich gewünschten früheren Version. Schlägt Start
oder Gesundheit fehl, setzt das Skript automatisch das vorherige Abbild zurück und prüft es.
Das Schema wird nie zurückgedreht; Migrationen müssen deshalb zur vorherigen Anwendung
kompatibel bleiben.

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
