# Wiederherstellung unter Druck

Die Sicherungen enthalten die PostgreSQL-Datenbank einschließlich aller TapTim.e-Rollen sowie
den Migrationsstand. Sie enthalten **nicht** `/opt/taptime/.env`, Server-SSH-Schlüssel oder
Storage-Box-Zugangsdaten. Der Borg-Schlüssel und die Borg-Passphrase liegen beim Product Owner
getrennt verwahrt. Die laufende `/opt/taptime/.env` muss der Product Owner zusätzlich in seinem
Passwortmanager hinterlegen; ohne diese Kopie kann ein Ersatzserver nicht starten.

Der letzte erfolgreiche Lauf ist ohne SSH sichtbar: Seine nicht erratbare URL steht nur beim
Product Owner im Passwortmanager, nicht in Git oder Chat. Ein Zeitpunkt, der älter als eine
Stunde ist, oder ein anderer Zustand als `ok` ist ein Betriebsfall.

## Zugang im Notfall

Der aktuelle Produktionsserver ist `taptime-prod` unter `46.225.58.30`. Der normale SSH-Zugang
für Auslieferungen ist:

```sh
# Bestehender, geladener SSH-Agent:
ssh taptime-deploy@46.225.58.30

# Nach Schlüsselverlust mit der neu erzeugten Datei:
ssh -i ~/.ssh/taptime-deploy taptime-deploy@46.225.58.30
```

Die erste Variante verwendet den bereits geladenen SSH-Agenten. Die zweite ist der vollständige
Weg mit dem nach einem Rechnerverlust neu erzeugten Schlüssel.

Er authentifiziert den ausdrücklich berechtigten Product Owner oder seine beauftragte Person
per SSH-Schlüssel und gewährt `sudo` ausschließlich für `/usr/local/sbin/taptime-deploy`.
Direkter Root-Login über SSH ist kein Betriebsweg.

Der davon unabhängige Rückweg ist die **Hetzner Console**: mit dem Hetzner-Konto aus dem
Passwortmanager Projekt *Taptime* → Server *taptime-prod* → *Aktionen* → *Konsole* öffnen und
mit `root` sowie dem dort verwahrten Server-Root-Passwort anmelden. Die Konsole verwendet eine
**US-Tastaturbelegung**; ein Passwort wird beim Tippen nicht angezeigt. Dieser Konsolen-Login
wurde praktisch geprüft und funktioniert auch bei defektem SSH-Zugang.

Ist der Rechner mit dem privaten Deploy-Schlüssel verloren, den privaten Schlüssel niemals
rekonstruieren oder über Chat versenden. Auf einem vertrauenswürdigen Ersatzrechner ein neues
ED25519-Schlüsselpaar erzeugen und nur den öffentlichen Teil verwenden:

```sh
ssh-keygen -t ed25519 -a 100 -f ~/.ssh/taptime-deploy
```

Dann über die Hetzner Console als `root` nur den neuen öffentlichen Schlüssel einlesen und den
verlorenen Schlüssel damit ersetzen:

```sh
install -d -o taptime-deploy -g taptime-deploy -m 0700 /home/taptime-deploy/.ssh
read -r deploy_public_key
printf '%s\n' "$deploy_public_key" > /home/taptime-deploy/.ssh/authorized_keys
unset deploy_public_key
chown taptime-deploy:taptime-deploy /home/taptime-deploy/.ssh/authorized_keys
chmod 0600 /home/taptime-deploy/.ssh/authorized_keys
```

Bei `read` die eine Zeile aus `~/.ssh/taptime-deploy.pub` einfügen und Enter drücken. Danach in
einer zweiten Sitzung `ssh -i ~/.ssh/taptime-deploy taptime-deploy@46.225.58.30` erfolgreich
prüfen, bevor die Konsole geschlossen wird. Niemals den privaten Schlüssel auf den Server
kopieren.

## Vor dem Start

1. Nimm den Borg-Schlüssel, die Borg-Passphrase und die verwahrte `/opt/taptime/.env` aus dem
   Passwortmanager. Fehlt die `.env`, ist dies ein Blocker für den Anwendungsstart, nicht etwas
   zum Neu-Erfinden.
2. Falls auch der bisherige Arbeitsrechner weg ist, erzeuge zuerst dort ein neues Deploy-
   Schlüsselpaar und hinterlege dessen **öffentlichen** Teil beim Erstellen des Ersatzservers in
   der Hetzner Console. Erstelle dann den Server und installiere Docker und Borg 1.2. Der
   verlorene Storage-Box-Privatschlüssel wird **nicht** wiederbeschafft: Erzeuge auf dem
   Ersatzserver ein neues ED25519-Schlüsselpaar. Der Product Owner meldet dessen öffentlichen
   Teil einmalig mit dem Storage-Box-Passwort über `install-ssh-key` auf Port 23 an.
3. Stelle `/etc/taptime-backup/config`, die Borg-Passphrase-Datei, die verwahrte `.env` und die
   hier versionierten Skripte und systemd-Dateien wieder her. Die Produktion bleibt bis zum
   erfolgreichen Restore abgeschaltet.
4. Richte `taptime-deploy`, dessen `authorized_keys`, die begrenzte sudoers-Regel und erst nach
   dem Konsolen- und SSH-Nachweis die Root-SSH-Sperre exakt nach *Einmalige Einrichtung* in
   `DEPLOY.md` ein. Ohne diese vier Schritte ist der Ersatzserver nicht betriebsbereit.

## Server ist weg

1. Stelle den Anwendungscode aus Git und `/opt/taptime/.env` aus der getrennten Verwahrung
   wieder her. Baue die Container noch nicht mit einer leeren Datenbank hoch.
2. Führe `systemctl start taptime-restore-verify.service` aus. Der Dienst prüft das Archiv, spielt das
   neueste Archiv isoliert in einen Wegwerf-PostgreSQL-Container ein und vergleicht
   Migrations-Checksums, sieben tragende Tabellen, alle TapTim.e-Rollen und `37/37` aktivierte
   und erzwungene RLS-Tabellen.
3. Ist die Prüfung grün, spiele dasselbe Archiv mit den dort verwendeten Schritten in die neue
   Produktdatenbank ein, starte den Stack und prüfe `/health` von außen. Bei Fehlern nicht
   improvisieren: ein älteres Archiv auswählen und den Restore erneut vollständig prüfen.

Für die aktuelle Datenmenge dauert Dump, Upload und isolierte Prüfung wenige Minuten. Die
gemessene Dauer steht im Journal von `taptime-restore-verify.service` und ist nach jedem Lauf
zu aktualisieren, bevor sie als Zusage verwendet wird.

## Nur die Datenbank ist beschädigt

1. Stoppe nur `backend-api`, nicht den Sicherungsdienst. Kopiere den Produktions-Compose-Stack
   in ein separates Arbeitsverzeichnis; greife nie auf das Produktions-Volume im Wegwerfpfad zu.
2. Wähle ein Archiv mit `borg list`; prüfe es mit `borg check --verify-data`.
3. Starte einen leeren PostgreSQL-17-Container ohne veröffentlichte Ports und ohne
   Produktions-Volume, spiele zuerst `globals.sql`, dann `database.dump` ein.
4. Führe die gleichen Vergleiche wie `taptime-restore-verify` durch. Insbesondere ist ein
   Ergebnis ohne `RLS enabled and forced: 37/37` kein gültiger Restore.
5. Erst nach erfolgreicher Prüfung die defekte Produktdatenbank durch den geprüften Stand
   ersetzen, `backend-api` starten und `/health` prüfen.

Die Wiederherstellungsprüfung läuft außerdem automatisch sonntags um 03:35 UTC. Die Sicherung
läuft stündlich um Minute 05 UTC; beide Timer stehen mit `systemctl list-timers taptime-*`.

## Storage-Box-Schnappschüsse

Der normale Weg ist, einen benötigten Archivstand aus
`/home/.zfs/snapshot/<snapshot-name>/` herauszukopieren und dann gegen die Kopie zu prüfen.
Das ist nicht destruktiv. Ein Zurücksetzen der Storage Box auf einen Schnappschuss ist nur
gerechtfertigt, wenn der aktuelle Repository-Zustand insgesamt unbrauchbar ist: Es löscht alle
neueren Daten **und auch alle neueren Schnappschüsse** dauerhaft. Vor einem solchen Reset muss
der Product Owner ausdrücklich zustimmen.

Die zehn automatischen Snapshots rotieren täglich. Bei einer anhaltenden vollständigen
Serverübernahme sind sie nach zehn Tagen alle durch kompromittierte Stände ersetzt. Deshalb ist
zusätzlich **jeden Monat ein manueller Snapshot und vor jeder größeren Serveränderung ein
manueller Snapshot** in der Hetzner Console anzulegen. Manuelle Snapshots rotieren nicht; ihre
Löschung entscheidet der Product Owner ausdrücklich.
