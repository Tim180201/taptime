# Wiederholbar ausliefern

Das Backend-Abbild wird nach grüner `CI` einmal von `Backend container image` gebaut. Sein Tag
ist der siebenstellige Commit-Kurzschlüssel, zum Beispiel
`ghcr.io/tim180201/taptime-backend-api:abcdef0`. Es gibt bewusst kein `latest`.

## Einmalige Einrichtung

Installiere `infrastructure/deploy` als root-ausführbares Skript und
`infrastructure/docker-compose.server.yml` unter `/opt/taptime/source/infrastructure/`.
Schreibe den tatsächlich laufenden Commit-Kurzschlüssel nach
`/var/lib/taptime-deploy/current-version`. Diese Datei ist die Rücknahme-Referenz und darf nicht
geraten werden. Das öffentliche Repository erzeugt über GitHub Actions ein öffentliches,
anonym lesbares GHCR-Paket; ein Registry-Passwort wird auf dem Server daher nicht benötigt.

Jede erfolgreiche Auslieferung veröffentlicht `current`, `previous` und die vollständige Datei
`known-versions` atomar als nicht sensitiven Schutzsatz unter
`/opt/taptime/admin-web/status/ghcr-protected-versions.json`. Die Veröffentlichungs-Workflow
lädt und validiert diesen Satz fail-closed. Vor einem neuen Push behält sie die neun neuesten
vorhandenen Abbilder, sodass das neue Abbild den regulären Satz auf zehn ergänzt. Bei einem
bereits existierenden Ziel bleiben zehn erhalten. Jedes Abbild aus dem Schutzsatz bleibt
zusätzlich erhalten; insbesondere können laufende und vorherige Version nie durch die
Aufräumung gelöscht werden.

## Ausliefern

```sh
sudo /usr/local/sbin/taptime-deploy abcdef0
```

Ohne genau einen siebenstelligen Commit-Kurzschlüssel bricht das Skript ab. Es lädt das genannte
Abbild und lässt die unveränderte T-007-Wiederherstellungsprüfung laufen. Unmittelbar vor deren
Cleanup spielt ein begrenzter Hook die ausstehenden Migrationen in **denselben** Wegwerf-Container
ein. Danach wartet das Skript auf eine frische Sicherung, migriert die Produktion und startet
exakt das genannte Abbild. Erst interne und externe Gesundheit schreiben `current-version` fort.
Das Migrationsabbild bringt die eingefrorenen SQL-Dateien selbst mit; das Skript hält die von
T-007 geprüfte lokale Quelle dazu synchron. Wegwerf-Container und Klartext-Dump existieren nach
der Probe nicht mehr.

Schlägt die Probe fehl, wurden weder Sicherung noch Produktionsdatenbank noch Anwendung
angefasst. Ausgabe sichern, Migration korrigieren, ein neues Abbild mit neuem Commit bauen und
den Befehl mit dessen Version wiederholen. Niemals eine bereits veröffentlichte Migration
umschreiben.

## Rücknahme und Unterbrechung

Rücknahme ist derselbe Befehl mit der ausdrücklich gewünschten früheren Version. Schlägt Start
oder Gesundheit fehl, setzt das Skript automatisch das vorherige Abbild zurück und prüft es.
Das Schema wird nie zurückgedreht; Migrationen müssen deshalb zur vorherigen Anwendung
kompatibel bleiben.

Bricht der Prozess nach der Migration, aber vor dem Start ab, läuft der alte Container weiter.
`current-version` bleibt unverändert. Der nächste Aufruf probt erneut, erkennt die Migrationen
als bereits angewendet und kann den Start sicher fortsetzen. Nach einem Serverneustart startet
Docker den zuletzt gesund gestarteten Container über `restart: unless-stopped`; für ein späteres
manuelles `docker compose up` muss `TAPTIME_VERSION` ausdrücklich aus `current-version` gesetzt
werden.
