# Wiederherstellung unter Druck

Die Sicherungen enthalten die PostgreSQL-Datenbank einschließlich aller TapTim.e-Rollen sowie
den Migrationsstand. Sie enthalten **nicht** `/opt/taptime/.env`, Server-SSH-Schlüssel oder
Storage-Box-Zugangsdaten. Der Borg-Schlüssel und die Borg-Passphrase liegen beim Product Owner
getrennt verwahrt. Die laufende `/opt/taptime/.env` muss der Product Owner zusätzlich in seinem
Passwortmanager hinterlegen; ohne diese Kopie kann ein Ersatzserver nicht starten.

Der letzte erfolgreiche Lauf ist ohne SSH sichtbar: Seine nicht erratbare URL steht nur beim
Product Owner im Passwortmanager, nicht in Git oder Chat. Ein Zeitpunkt, der älter als eine
Stunde ist, oder ein anderer Zustand als `ok` ist ein Betriebsfall.

## Vor dem Start

1. Nimm den Borg-Schlüssel, die Borg-Passphrase und die verwahrte `/opt/taptime/.env` aus dem
   Passwortmanager. Fehlt die `.env`, ist dies ein Blocker für den Anwendungsstart, nicht etwas
   zum Neu-Erfinden.
2. Erstelle einen neuen Server, installiere Docker und Borg 1.2. Der verlorene Storage-Box-
   Privatschlüssel wird **nicht** wiederbeschafft: Erzeuge auf dem Ersatzserver ein neues
   ED25519-Schlüsselpaar. Der Product Owner meldet dessen öffentlichen Teil einmalig mit dem
   Storage-Box-Passwort über `install-ssh-key` auf Port 23 an.
3. Stelle `/etc/taptime-backup/config`, die Borg-Passphrase-Datei, die verwahrte `.env` und die
   hier versionierten Skripte und systemd-Dateien wieder her. Die Produktion bleibt bis zum
   erfolgreichen Restore abgeschaltet.

## Server ist weg

1. Stelle den Anwendungscode aus Git und `/opt/taptime/.env` aus der getrennten Verwahrung
   wieder her. Baue die Container noch nicht mit einer leeren Datenbank hoch.
2. Führe `systemctl start taptime-restore-verify.service` aus. Der Dienst prüft das Archiv, spielt das
   neueste Archiv isoliert in einen Wegwerf-PostgreSQL-Container ein und vergleicht
   Migrations-Checksums, sieben tragende Tabellen, alle TapTim.e-Rollen und `32/32` aktivierte
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
   Ergebnis ohne `RLS enabled and forced: 32/32` kein gültiger Restore.
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
