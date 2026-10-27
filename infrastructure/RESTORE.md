# Wiederherstellung unter Druck

## Verlust- und Zeitgrenze

Für nach externer Archivierung quittierte WorkEvents gilt bei Ausfall eines einzelnen Servers
oder Datenträgers RPO 0. Eine Quittung ist deshalb erst dauerhaft, wenn das zugehörige PostgreSQL-WAL
verschlüsselt außerhalb des Servers liegt und der lückenlose Archiv-Wasserstand diese Position
erreicht hat. Bis dahin bleibt die bestehende FIFO-Zeile auf dem Telefon. Die
Wiederanlaufgrenze beträgt vier Stunden ab Alarm bis API und Datenbank wieder schreibfähig sind.

Die Wiederherstellungskette besteht aus einer geprüften physischen PostgreSQL-Basissicherung und
dem danach fortlaufend archivierten WAL. Der frühere logische Stundendump ist keine PITR-Basis.
Ein synchroner Standby ist bewusst nicht Teil des Weges: Solange nur der Gründer den Betrieb
beherrscht, würden Failover, Failback und Replikationsüberwachung das größere Betriebsrisiko
erzeugen. Das ist neu zu bewerten, sobald eine zweite Person Störungen unabhängig beherrscht.

## Was außerhalb des Servers liegt

Borg enthält clustergebundene Archive `base-<system-id>-<utc>` und
`wal-<system-id>-<wal-datei>`. Die System-ID verhindert, dass Basen und WAL verschiedener
PostgreSQL-Cluster vermischt werden. Basen enthalten Datenbank, Rollen, Backup-Manifest und die
Checksummen der angewendeten Migrationsquellen. WAL gilt erst nach Upload und Rücklesen des
Inhaltsnachweises als extern archiviert.
Die Betriebsskripte erzwingen dafür ein entferntes `ssh://`-Borg-Ziel, einen fest gewählten
SSH-Schlüssel und strikte Hostschlüsselprüfung; ein lokaler Pfad oder der lokale Host kann
keine Archivquittung erzeugen.

`taptime-backup` erzeugt die unveränderliche physische Basis, der WAL-Empfänger ausschließlich
lokale vollständige Segmente und `taptime-wal-archiver` deren unveränderliche externe Archive.
Eine lokale WAL-Datei verschwindet erst nach Upload und erfolgreichem Rücklesen ihres
Inhaltsnachweises. Retention läuft erst, nachdem eine Basis vollständig wiederhergestellt,
extern markiert und in der Produktionsdatenbank registriert wurde. Sie behält für jede Timeline
WAL ab dem Startpunkt ihrer jeweils ältesten noch aufbewahrten Basis; ein unvollständiges
Borg-Inventar führt zu keiner WAL- oder Marker-Löschung.

Nach erfolgreicher stündlicher Sicherung und `borg check` wird höchstens einmal je 24 Stunden
aufgeräumt. Ein zeitlich begrenzter Teillauf wird schon mit der nächsten stündlichen Sicherung
fortgesetzt (mindestens eine Stunde seit seinem Beginn). Die Sonntagsprüfung ruft dieselbe Funktion nach erfolgreichem Restore weiterhin
unabhängig von dieser Tagesgrenze auf. Maßgeblich sind die vier `BASE_BACKUP_KEEP_*`-Werte.
Die Wochenprüfung ohne Zeitpunkt und ohne Pin wählt die jüngste Basis vor Beginn des heutigen
Tages; fehlt eine solche Basis, nimmt sie die neueste. Dafür zählt Borgs Archivstart, nicht der
UTC-Name: Borg bildet Perioden in der lokalen Prozesszeitzone (`TZ`, sonst `/etc/localtime`).
Die Prüfung verwendet dieselbe Umgebung. Gepinnte Deploy-Prüfung, Zeitpunkt-Restore,
Migrationsprobe und Materialisierung behalten ihre bisherige Basisauswahl.

Vor dem echten `borg prune` läuft `borg prune --dry-run --list` mit denselben Parametern.
Geschützt wird die neueste geprüfte Basis, die laut Vorschau ohnehin behalten wird; ihre
Registrierung und Existenz werden vor dem Löschen geprüft. Würde keine geprüfte Basis bleiben,
entfällt der gesamte Aufräumlauf (`protected`). Eine leere oder unbekannte Vorschau erlaubt
ebenfalls keine Löschung. Ausschließlich `borg prune` löscht Basen; danach wird die geschützte
Basis erneut geprüft. Es folgen die bisherigen Timeline-Untergrenzen aus allen behaltenen
Basen, verwaiste Marker und veraltetes WAL. WAL und Marker werden mit exakt benannten Archiven
blockweise gelöscht, niemals mit einem Lösch-Glob. Die Argumentgröße folgt aus `ARG_MAX` abzüglich
Umgebung, Repository und Reserve, höchstens 32 KiB einschließlich Zeigerreserve je Block.
Nach einem fehlgeschlagenen Block folgt kein weiterer Block. Am Ende eines vollständigen oder
planmäßig angehaltenen Teillaufs gibt einmal `borg compact` den entfernten Speicher frei.
Historische Restore-Proben und Materialisierung räumen weiterhin nicht auf.

`BACKUP_RETENTION_BUDGET_SECONDS` begrenzt die Aufbewahrung einschließlich Inventur und Compact
auf standardmäßig 600 Sekunden (auch ohne neuen Konfigurationseintrag; zulässig 90–600).
`prune` und `delete` erhalten `--checkpoint-interval 15`: Borg 1.2.8 schreibt zwischen Archiven
regelmäßig Manifest, Repository-Index und Cache dauerhaft. Bei SIGINT beendet Borg das gerade
laufende Archiv und schreibt einen weiteren Checkpoint. Dafür bleiben innerhalb der Frist ein
Viertel des Budgets, mindestens 30 und höchstens 60 Sekunden Kulanz; erst danach folgt SIGKILL.
Kulanz plus fünf Sekunden bleiben außerdem für den einmaligen Compact-Aufruf reserviert
(beim Standardbudget 65 Sekunden). Das Mindestbudget lässt Platz für diese beiden Abschlussphasen.
Zwischen vollständigen Blöcken wird das Restbudget einschließlich Kulanz erneut geprüft.

Ein **Budgetstopp ist `partial`**, auch nach sauberem SIGINT-Checkpoint oder nach erzwungenem
Abbruch am Ende der Kulanz. Er ist kein vollständig bestätigter Löschblock. Andere Borg-Fehler
bleiben `failed`; ein vorzeitiges SIGKILL wird nicht als Budgetstopp umgedeutet. Nach einem
Budgetstopp folgt der nächste stündliche Versuch mit neuer Inventur, die auch bereits dauerhaft
gelöschte Basen und Teile eines Blocks berücksichtigt. Alte Löschlisten werden nie fortgesetzt.
Die bisherigen Timeline-Untergrenzen gelten weiter. Kann selbst ein Checkpoint nicht innerhalb
der Kulanz fertig werden, bleibt nur der letzte abgeschlossene Checkpoint erhalten; fehlender
Fortschritt erfordert die im Deploy-Ablauf beschriebene Diagnose.

Ein Aufräumfehler macht die abgeschlossene Sicherung nicht ungültig. Die Skripte schreiben
Versuch, Ergebnis und letzten vollständigen Erfolg atomar nach `/var/lib/taptime-monitor/retention-status`
(root, 0600). Das Format lautet `Zustand|Versuch-Epoch|Erfolg-Epoch|gelöschte-WAL/Marker|Rest-WAL/Marker`;
alte dreifeldrige Zustände bleiben lesbar. `-1` bedeutet noch nicht vollständig ermittelter Rest.
Die Zähler gelten für bestätigte ganze WAL-/Marker-Blöcke dieses Laufs, bei Budgetstopp oder
Befehlsfehler nur als letzter bekannter Stand. Basen und nur teilweise bestätigte Blöcke sind darin
nicht enthalten; die nächste Inventur berücksichtigt ihre tatsächliche Löschung.
`partial` aktualisiert niemals den Erfolg. Fehlgeschlagene oder ausgesetzte
Versuche behalten die 24-Stunden-Grenze; nur `partial` wird stündlich fortgesetzt.
Ein abgebrochener Lauf bleibt als begonnen sichtbar. Nur die geplante Sonntagsprüfung ohne
Pin, Zielzeitpunkt, Migrationsprobe oder Materialisierung scheitert, wenn ihr eigener
Aufräumlauf fehlschlägt oder danach kein Erfolg innerhalb der letzten acht Tage belegt ist
(auch bei fehlendem/ungültigem Status). `unregistered` ist eine Verschiebung, kein
Aufräumfehler; die Acht-Tage-Regel gilt auf dem Sonntagsweg trotzdem. Bei gepinnter Basis
(Deploy) läuft das Aufräumen ebenfalls ohne Tagesgrenze und speichert und zeigt sein
Ergebnis, lässt die erfolgreiche Restore-Prüfung aber nicht scheitern. Das gilt auch bei
noch fehlender Registrierung oder einem Aufräumfehler. Der Tagesmonitor meldet eine
gescheiterte Sonntagsprüfung über die bestehende „Wiederherstellungsprüfung fehlgeschlagen“.
Der Tagesmonitor meldet außerdem fehlgeschlagene Aufbewahrung oder fehlenden vollständigen Erfolg
innerhalb von acht Tagen, auch während eines Teilabbaus. `archive-counts` im selben Verzeichnis
enthält Erhebungszeitpunkt und Anzahlen, keine Archivnamen oder Adressen. Sicherung und voller
Archivierer-Abgleich ersetzen diese Datei. Schreibfehler dieser Anzeigezahl werden auf stderr
gemeldet und lassen einen erfolgreichen WAL-Durchlauf erfolgreich bleiben. Beim Rückbau hält root die Sicherungs-, Prüf- und
Archivierungsdienste samt Timern an und entfernt beide Zustandsdateien; keine davon ist ein
Archivnachweis. Bei fehlender Zustandsdatei beginnt die Tagesplanung neu.

Sicherung, Prüfung und Deploy-Probe verwenden `/var/lib/taptime-backup` auf dem
Root-Dateisystem (D-150). systemd legt den Ordner als `StateDirectory` an, der Deploy und der
manuelle Verifier bei Bedarf über denselben Wächter. Vor dem ersten Schreiben muss der Pfad
root:root, 0700, ohne Symlink und ohne für andere beschreibbare Eltern sein. Bestehende unsichere
Pfade werden abgewiesen. Jeder Lauf erzeugt einen eigenen Ordner `backup.*`, `restore.*` oder
`deploy-hook.*`; EXIT, TERM, INT und HUP entfernen ihn. Unter der jeweiligen Sperre entfernt der
nächste Lauf ausschließlich Reste seines Präfixes. `/etc/tmpfiles.d/taptime-backup.conf` leert
den Ordner nur beim Systemstart (`D!`); niemals während des Betriebs mit `--boot --remove` ausführen.
Der Ordner selbst bleibt. Rückbau: alle drei Borg-Dienste und die Sicherungs-/Prüftimer anhalten,
keinen Deploy oder manuellen Restore laufen lassen, dann Arbeitsordner und tmpfiles-Regel entfernen.
Die Datenbank und diese kurzzeitige Arbeitskopie liegen auf derselben unverschlüsselten Platte.

Vor dem Schreiben von Basis oder WAL gilt eine abgeleitete Platzprüfung gegen
`DISK_USAGE_THRESHOLD_PERCENT` aus dem installierten Tagesmonitor: Basis zweifach (Tar und entpackt),
ausgewählte WAL-Dateien, deren zusätzliche Kopie während Recovery und 20 Prozent Reserve. Bei
Materialisierung kommt eine weitere Basis-/WAL-Kopie für das Docker-Volume hinzu. Für die Sicherung
wird die Größe des gesamten PGDATA einschließlich WAL mit `du -sk` ermittelt; für Restore stammen
die unkomprimierten Größen aus `borg list --format '{size}{NL}'`. Die geprüfte WAL-Auswahl wird
unter derselben Borg-Sperre extrahiert; ohne externes Start-WAL beginnt kein Entpacken. Fehlender
Platz bricht ab und schreibt einen Fehlerstatus (historische Proben ändern wie bisher keinen
kanonischen Status). Wachstum und andere Schreiber nach der Messung bleiben möglich; die Reserve
ist keine Quota. Die regulären Alarm- und Fehlerwege bleiben deshalb erforderlich.

Alle Borg-Aufrufe teilen `/run/lock/taptime-borg.lock`. Sicherung und Wochenprobe warten höchstens
zehn Minuten; der Archivierer wartet bis zu zwei Stunden, damit eine lange Wochenprobe keinen
falschen Archivierungsfehler erzeugt. Die oneshot-Grenzen betragen 70 Minuten für die Sicherung
und 110 Minuten für die Probe, danach jeweils 30 Sekunden zum Beenden. Bedingungstests verlangen:
Unit-Grenze mindestens Monitorgrenze plus Sperrwartezeit; Archivierer-Wartezeit größer als
Start- und Stoppgrenze jedes legitimen oneshot-Sperrhalters, mit Reserve. Nach bestätigter
Basissicherung ändert ein Abbruch der anschließenden Aufbewahrung deren Status nicht zurück auf Fehler. Direkte manuelle Restores behalten die konfigurierte Recovery-Frist (vier Stunden).
Borgs SSH erhält vor den vorhandenen Optionen `ConnectTimeout=30`, `ServerAliveInterval=30` und
`ServerAliveCountMax=4`; die vorhandene Konfiguration muss dafür nicht geändert werden.

Nur `/var/cache/taptime-borg/cache` ist Cache. Konfiguration, Schlüssel und Borg-Sicherheitszustand
liegen dauerhaft in `/var/lib/taptime-borg/config`, der Sicherheitszustand ausdrücklich in dessen
`security`-Unterordner. systemd verwaltet `/var/lib/taptime-borg` als `StateDirectory`, root:root,
0700. Beim ersten Lauf unter der Borg-Sperre wird der alte Config-Inhalt vollständig kopiert und
am Ziel atomar umbenannt, erst danach wird die alte Kopie entfernt. Unterschiedliche vorhandene
Kopien führen zum Abbruch, niemals zum Verwerfen von Nonce oder Manifest-Zeitstempel. Borg pflegt
den Inhalt; beim vollständigen Rückbau entfernt root nach dem Anhalten aller Borg-Dienste Cache
und Zustand, nachdem Schlüssel und Passphrase unabhängig verwahrt sind.
Die gemeinsamen Funktionen liegen in `taptime-restore-verify` und `taptime-backup-workspace`;
beide müssen auch auf dem Ersatzserver aus demselben Operations-Abbild installiert sein.

Nicht enthalten sind `/opt/taptime/.env`, Server- und Storage-Box-SSH-Schlüssel,
Borg-Passphrase sowie die geheimen Monitoring-Curl-Dateien. Borg-Schlüssel, Passphrase und
`.env` liegen beim Product Owner getrennt verwahrt. Betriebsskripte, Compose, Caddy und
Migrationen kommen aus dem unveränderlichen Operations-Abbild, nie aus einem handkopierten
Checkout.

Zusätzlich bleiben die täglichen **Hetzner Cloud Backups** aktiv (D-151, sieben Plätze,
Nürnberg). Sie kopieren die ganze Serverplatte einschließlich Datenbank, Einstellungen,
Zugangsdaten und gegebenenfalls gerade vorhandener Arbeitskopien. Alte Zugangswerte können bis
zu sieben Tage nach einer Rotation darin verbleiben. Der PO nutzt sie als ergänzenden Rückweg
für einen beschädigten oder verlorenen Server; sie ersetzen weder die Borg-Kette noch die
geprüfte Datenbank-Wiederherstellung. Ein direkt aus einer solchen Kopie gestarteter
Datenbankstand ist kein nachgewiesener PITR- oder RPO-0-Stand. Vor Freigabe des Verkehrs den
Datenbankstand über den hier beschriebenen Borg-Restore herstellen und prüfen.

Die frühere Sicherung hat logische Archive `taptime-<UTC>` angelegt. T-035 verändert oder
rotiert sie nicht und löscht beim Cutover keines davon. Sie enthalten personenbezogene Lohndaten:
Nach erfolgreicher externer Basis-/WAL-Restoreprobe und bestätigtem Smoke-Test entscheidet der
Product Owner über ihre Entfernung; eine beauftragte Betriebsperson löscht als `root` nur zuvor
einzeln inventarisierte, exakt benannte Archive, niemals per Glob oder Repository-Prune.

Die stündliche Basissicherung muss im täglichen Monitor jünger als zwei Stunden sein. Die
wöchentliche Restore-Probe muss innerhalb ihres Acht-Tage-Fensters grün sein. Davon getrennt
prüft der Sofortmonitor die WAL-Archivierung: zulässiges
Alter und Rückstand ergeben sich aus `WAL_ARCHIVE_INTERVAL_SECONDS *
WAL_ARCHIVE_MISSED_CYCLES`; eine fest eingebaute Verlustschwelle gibt es nicht.

## Zugang im Notfall

Alle Restore-, Borg-, Docker-, Konfigurations- und Volume-Befehle dieses Dokuments laufen als
`root` in der Hetzner Console: Konto aus dem Passwortmanager, Projekt *Taptime*, Server
*taptime-prod*, *Aktionen* → *Konsole*. Der Benutzer `taptime-deploy` darf über SSH ausschließlich
den normalen Deploy-Controller ausführen und ist kein Restore-Zugang; seine Rechte werden im
Störfall nicht erweitert. Direkter Root-Login über SSH ist ebenfalls kein Betriebsweg.

Die Console hat US-Tastaturbelegung. Das Server-Root-Passwort liegt im Passwortmanager; seine
Eingabe bleibt unsichtbar. Einfügen ist möglich, aber unzuverlässig: Mehrere Zeilen können zu
einer verschmelzen, Leerzeichen können fehlen. Jede Zeile einzeln tippen oder einfügen, vor
Enter vollständig lesen und die geheimnisfreie Abschlusszeile als Foto sichern. Nie
Strg+Alt+Entf drücken. Die Tastentabelle steht in
[DEPLOY.md unter „Zugang und Berechtigung“](DEPLOY.md#zugang-und-berechtigung).

## Voraussetzungen vor dem Restore

1. Alarmzeit notieren; daran wird die Vier-Stunden-Grenze gemessen. Produktion bis zur
   bewussten Aktivierung geschlossen halten.
2. Borg-Schlüssel, Passphrase, `/opt/taptime/.env`, die beiden Compose-Secrets
   `/opt/taptime/secrets/postgres-installer-password` und
   `/opt/taptime/secrets/proxy-shared-secret` sowie Monitoring-Geheimnisse aus der getrennten
   Verwahrung holen. Fehlende Geheimnisse sind ein Blocker, kein Anlass zum Neuerfinden.
3. Die zuletzt belegte Operations-Version und eine zum Zielzeitpunkt kompatible siebenstellige
   Anwendungsversion aus dem Betriebsnachweis bestimmen. Auf einem erhaltenen Server muss die
   Operations-Version mit `/var/lib/taptime-deploy/operations-version` übereinstimmen; auf einem
   Ersatzserver legt der folgende Bootstrap diese Datei erst an. Alle benötigten Backend-,
   Admin-Web- und Operations-Abbilder in GHCR nachweisen.
4. `/etc/taptime-backup/config` mit Modus `0600` aus der Verwahrung herstellen. Die vollständige
   T-035-Liste aus `DEPLOY.md` derselben freigegebenen Fassung muss enthalten sein: vier Werte
   für die Basisaufbewahrung, WAL-Spool, Containerpfad, Replikationsslot, Archivintervall,
   zulässige verpasste Zyklen, WAL-Status, WAL-Cache sowie Restore-Timeout und Pollintervall.
   Danach Eigentümer, Modus und `bash -n /etc/taptime-backup/config` prüfen; Geheimnisse stehen
   weiterhin nur in ihren eigenen Dateien.
5. Auf einem Ersatzserver Docker, Borg und die einmalige Bootstrap-/SSH-Härtung nach
   `DEPLOY.md` einrichten. Compose und Skripte nicht von Hand aus Git kopieren. Das
   Operations-Abbild stellt sie bereit.

Ist mit dem Server auch der private Storage-Box-Schlüssel verloren, entsteht auf dem
Ersatzserver ein neues ED25519-Paar unter `/etc/taptime-backup/ssh/`. Der Product Owner meldet
dessen **öffentlichen** Teil einmalig mit dem Storage-Box-Passwort über `install-ssh-key` auf Port
23 an. Der private Teil verlässt den Server nicht. Den Hostschlüssel gegen die von Hetzner
veröffentlichte Fingerprint-Quelle prüfen und erst dann root-eigen in
`storage-box-known_hosts` hinterlegen; ein ungeprüftes `ssh-keyscan` ist kein Vertrauensbeleg.
Vor dem Restore muss ein `borg list` mit genau der konfigurierten Identität funktionieren.

### Betriebswerkzeuge auf einem Ersatzserver bereitstellen

Der einmalige Bootstrap aus `DEPLOY.md` installiert nur Controller und belegte
Operations-Version. Vor dem Restore werden Verifier, Aktivator, Compose und Migrationen aus
demselben exakten, unveränderlichen Operations-Abbild bereitgestellt. `abcdef0` ist jeweils
durch die belegte Operations-, `1234567` durch die kompatible Anwendungsversion zu ersetzen:

```sh
set -euo pipefail
operations_version=abcdef0
application_version=1234567
operations_image="ghcr.io/tim180201/taptime-backend-api:operations-$operations_version"
docker pull "$operations_image"
docker run --rm --volume /:/h "$operations_image"

restore_stage="$(mktemp -d /run/taptime-restore-bootstrap.XXXXXX)"
restore_holder="$(docker create "$operations_image")"
install -d -m 0700 "$restore_stage/operations"
docker cp "$restore_holder:/operations/." "$restore_stage/operations/"
docker rm "$restore_holder"
test "$(tr -d '\r\n' < "$restore_stage/operations/version.txt")" = "$operations_version"

install -o root -g root -m 0700 \
  "$restore_stage/operations/usr/local/sbin/taptime-backup-workspace" \
  /usr/local/sbin/taptime-backup-workspace
install -o root -g root -m 0755 \
  "$restore_stage/operations/usr/local/sbin/taptime-daily-monitor" \
  /usr/local/sbin/taptime-daily-monitor
install -d -o root -g root -m 0755 /etc/tmpfiles.d
install -o root -g root -m 0644 \
  "$restore_stage/operations/etc/tmpfiles.d/taptime-backup.conf" \
  /etc/tmpfiles.d/taptime-backup.conf
install -o root -g root -m 0700 \
  "$restore_stage/operations/usr/local/sbin/taptime-restore-verify" \
  /usr/local/sbin/taptime-restore-verify
install -o root -g root -m 0700 \
  "$restore_stage/operations/usr/local/sbin/taptime-restore-activate" \
  /usr/local/sbin/taptime-restore-activate
install -d -o root -g root -m 0755 /opt/taptime/source/infrastructure
install -o root -g root -m 0644 \
  "$restore_stage/operations/opt/taptime/source/infrastructure/docker-compose.server.yml" \
  /opt/taptime/source/infrastructure/docker-compose.server.yml
install -d -o root -g root -m 0755 /opt/taptime/source/apps/backend-schema
test ! -e /opt/taptime/source/apps/backend-schema/migrations
mv "$restore_stage/operations/opt/taptime/source/apps/backend-schema/migrations" \
  /opt/taptime/source/apps/backend-schema/migrations

install -d -o root -g root -m 0755 /var/lib/taptime-deploy
version_state="$(mktemp /var/lib/taptime-deploy/current-version.XXXXXX)"
printf '%s\n' "$application_version" > "$version_state"
chmod 0644 "$version_state"
mv "$version_state" /var/lib/taptime-deploy/current-version
rm -r "$restore_stage"
```

Jeder Befehl muss erfolgreich enden. Schlägt er fehl, den begonnenen Stand nicht ergänzen,
sondern Ursache und exakte Operations-Version klären. Die dauerhaft installierten Ziele werden
beim anschließenden Aktivierungs-Deploy vollständig aus dem validierten Operations-Release
ersetzt. Auf einem bestehenden Server ist dieser Ersatzserver-Bootstrap nicht nötig.

## Prüfung und Auswahl eines Zeitpunkts

Die normale Prüfung stellt den neuesten Stand isoliert wieder her, prüft `pg_verifybackup`,
Migrationschecksummen und für jede tatsächlich vorhandene Anwendungstabelle aktivierte und
erzwungene RLS. Sie verlangt außerdem eine lückenlose WAL-Kette bis zum letzten vollständigen
externen WAL-Datensatz:

```sh
/usr/local/sbin/taptime-restore-verify
```

### Einsatzregel: letzter Archivstand oder bewusster Rücksprung

- **Server-/Datenträgerverlust:** Ohne `TAPTIME_RESTORE_TARGET_TIME` bis zum letzten
  vollständigen, lückenlos archivierten WAL-Datensatz wiederherstellen. Keine bequemere ältere
  Basis als Endstand aktivieren. Jedes nach Archivnachweis vom Telefon gelöschte Ereignis muss
  in diesem Kandidaten enthalten sein. Die zugehörigen WorkEvent-IDs, Entscheidungen und
  Gerätereihenfolgen am Kandidaten nachlesen, bevor der Wiederanlauf als vollständig gilt.
- **Auf dem Telefon verbliebene Ereignisse:** Apps und App-Daten erhalten; keine Neuinstallation,
  keine Queue-Löschung und keine ersatzweise Neuerfassung desselben Taps. Nach dem Wiederanlauf
  den Abgleich beobachten. Ein geschützter Vorgang ist ein offener Störfall, kein erledigter
  Abgleich. Betroffene Zeiten als ungeklärt melden; ihre Vollständigkeit nicht zusichern.
- **Befund T-052, nachgewiesen am 17.09.2026:** Ereigniserhalt allein garantiert die zuvor
  gezeigte Entscheidung nicht. Eine erst nach der letzten Archivgrenze ausgestellte Lease kann
  zusammen mit ihrem bereits entschiedenen Ereignis fehlen. Beim unveränderten Replay verweigert
  der Server die fehlende Bindung (`lease_binding_conflict`), obwohl er vorher den Start bestätigt
  hatte. Die laufende Implementierung besitzt keinen Reparaturweg für diese Grundlage. Dies an
  den Technical Lead eskalieren; niemals eine neue Lease-ID in die erhaltene Evidenz schreiben.
  Ein erfolgreicher physischer Restore beweist deshalb noch keine vollständige Wiederaufnahme
  dieser Telefonereignisse. D-052s Zusicherung „vorläufig, nie falsch“ ist bis zur Entscheidung
  und erneutem Nachweis nicht als Betriebszusage verwendbar.
- **Bewusster Rücksprung vor den letzten Archivstand:** Nur mit ausdrücklicher Freigabe des
  Product Owners und dokumentiertem Zielzeitpunkt. Schon vom Telefon gelöschte Ereignisse können
  dann fehlen; automatische Wiederholung kann sie nicht zurückbringen. Den letzten Archivstand
  zusätzlich isoliert erhalten und dessen Ereignisse nach dem Zielzeitpunkt inventarisieren,
  fachlich klären und nachvollziehbar nachtragen. Eine vollständige Abrechnung ist vorher nicht belegt.
  Das ist eine bewusst gewählte Rücknahme; hierfür darf kein RPO-0-Ergebnis gemeldet werden.

Der ausführbare Nachweis ist `apps/backend-offline-sync/tests/OfflineRestorePostgres.test.ts`
(`npm test --workspace=@taptime/backend-offline-sync -- tests/OfflineRestorePostgres.test.ts`,
lokaler Docker-Dienst erforderlich). Er prüft eine echte physische Basis mit `pg_verifybackup`,
archiviert echte WAL-Segmente in ein vom Quelldatenträger getrenntes lokales Test-Volume und
zerstört den Quelldatenträger vor zwei Restores. Kein Produktionszugriff und kein externer
Borg-Transport werden damit simuliert oder behauptet. Belegt werden:

1. Letzter Archivpunkt: gelöschtes Start-Ereignis vorhanden; der erhaltene Stopp mit bereits
   archivierter Lease erzeugt dieselbe Entscheidung einschließlich derselben TimeEntry-ID.
2. Derselbe Archivpunkt: der folgende erhaltene Start mit verlorener neuer Lease endet im
   Bindungskonflikt. Dies ist ein reproduzierter Fehlerbeleg, keine Freigabe des Verhaltens.
3. Früherer Zeitpunkt: gelöschter Start fehlt; der erhaltene Stopp meldet `sequence_gap`.

Die Testressourcen legt der Test selbst an, PostgreSQL verändert sie während der Probe, und der
Test entfernt seine eigenen Container und Volumes im Abschlussblock. Zusätzliche Review-Befunde
zur Reihenfolge über mehrere Installationen und zum neu bewerteten Zeitfenster sind keine durch
diese Einzelgeräteprobe belegten Garantien; auch sie sind vor einer Freigabe zu klären.

Für einen Zeitpunkt zwischen zwei Änderungen muss der Zeitpunkt exakt in UTC angegeben werden.
Quelle ist eine UTC-Zeit aus den Datenbankzeitstempeln (gezielt mit `AT TIME ZONE 'UTC'` lesen)
oder einem Protokoll mit ausdrücklichem UTC-Bezug. Eine Berliner Uhrzeit allein reicht am Tag
der Zeitumstellung nicht: erst den belegten Offset (+02:00 oder +01:00) bestimmen. Auf dem Server
rechnet etwa `date -u -d '2026-10-25T02:30:00+02:00' +%Y-%m-%dT%H:%M:%SZ` eindeutig in UTC um.
Den Offset niemals aus einer mehrdeutigen Web-Anzeige erraten; bei fehlender Quelle stoppen.
Auf einem Ersatzserver mit Archiven mehrerer PostgreSQL-Cluster ist zusätzlich die gewünschte
16-stellige kleingeschriebene hexadezimale System-ID Pflicht; ohne eindeutige Auswahl bricht die
Prüfung ab:

```sh
env \
  TAPTIME_RESTORE_TARGET_TIME='2026-09-16T12:34:56.123456Z' \
  TAPTIME_RESTORE_SYSTEM_IDENTIFIER='0123456789abcdef' \
  /usr/local/sbin/taptime-restore-verify
```

Der automatisierte PITR-Nachweis stellt einen Zeitpunkt zwischen zwei Änderungen her und prüft:
die frühere Änderung ist vorhanden, die spätere fehlt. Bei einem echten Störfall wird dieselbe
fachliche Nachlese an den **materialisierten Kandidaten** beziehungsweise dessen
Aktivierungs-Smoke-Test gebunden; der isolierte Prüfcontainer wird beim Ende des Verifiers
absichtlich entfernt und kann danach nicht mehr als Lesebeleg dienen. Ein historischer Probelauf
verändert weder den kanonischen Restore-Status noch Retention oder Basis-Markierungen.

## Geprüften Stand materialisieren und aktivieren

Sobald der Product Owner einen Kandidaten zur möglichen Aktivierung bestimmt, wird auf einem
noch erhaltenen Server zuerst ausschließlich das Backend gestoppt. Datenbank, WAL-Empfänger und
Archivierer bleiben für die letzte Archivierung aktiv; neue Telefonereignisse erhalten ohne
Backend keine Serverquittung und bleiben lokal erhalten:

```sh
current_version="$(tr -d '[:space:]' < /var/lib/taptime-deploy/current-version)"
current_volume='taptime-postgres-data'
if [[ -f /var/lib/taptime-deploy/postgres-volume ]]; then
  current_volume="$(tr -d '[:space:]' < /var/lib/taptime-deploy/postgres-volume)"
fi
TAPTIME_VERSION="$current_version" TAPTIME_POSTGRES_VOLUME="$current_volume" \
  docker compose --file /opt/taptime/source/infrastructure/docker-compose.server.yml \
    stop backend-api
running_backend="$(TAPTIME_VERSION="$current_version" \
  TAPTIME_POSTGRES_VOLUME="$current_volume" \
  docker compose --file /opt/taptime/source/infrastructure/docker-compose.server.yml \
    ps --quiet backend-api)"
test -z "$running_backend"
```

Bei einer historischen Wiederherstellung geschieht das vor ihrer produktiven Materialisierung.
Der bisherige Datenstand bleibt als getrenntes Volume erhalten; Ereignisse nach dem gewählten
Zeitpunkt müssen daraus fachlich inventarisiert und gegebenenfalls nachgetragen werden, bevor der
Product Owner seine Entfernung erlaubt.

Ein Produktivkandidat entsteht immer in einem neuen, eindeutig benannten Docker-Volume. Ein
vorhandenes Volume wird niemals überschrieben:

```sh
restore_volume="taptime-postgres-restored-$(date -u +%Y%m%dT%H%M%SZ)"
env \
  TAPTIME_RESTORE_TARGET_TIME='2026-09-16T12:34:56.123456Z' \
  TAPTIME_RESTORE_SYSTEM_IDENTIFIER='0123456789abcdef' \
  /usr/local/sbin/taptime-restore-verify --materialize-volume "$restore_volume"
```

Für den neuesten Stand werden die beiden `TAPTIME_RESTORE_*`-Variablen weggelassen, sofern der
Cluster eindeutig ist. Erst der vollständig wiederhergestellte und gestoppte Kandidat erhält
seinen Abschlussmarker. Dann wird er mit demselben exakten Namen aktiviert:

```sh
/usr/local/sbin/taptime-restore-activate "$restore_volume"
```

Die Aktivierung belegt Labels, Abschlussmarker, tatsächlichen Datenbank-Mount und Cluster-ID,
bevor sie `/var/lib/taptime-deploy/postgres-volume` atomar umschaltet. Vor dem Kandidatenstart
stoppt sie beide WAL-Dienste und verschiebt den bisherigen Spool atomar nach
`/var/lib/taptime-wal.pre-restore-<Kandidatenzeit>`. Der Kandidat erhält einen neuen, leeren Spool;
damit kann ein vollständiges Segment seiner alten Zukunfts-Timeline den Empfänger nach der
Promotion nicht blockieren. Danach ruft die Aktivierung den normalen Deploy der belegten
Anwendungsversion auf. Fehlt in einem historischen Stand der neue Archivvertrag, bleibt das alte
Backend gestoppt; der WAL-Weg läuft zunächst ausschließlich im Upload-Modus. Erst nach der
versionierten Migration startet der normale Archivierer und erst ein archivfähiges Backend nimmt
wieder Verkehr an.

Nach der Wiederherstellung eines Stands mit Migration 032 gleicht root den Betreiber-Zugang
mit `/usr/local/sbin/taptime-operator-db-login --rotate` ab. Das erzeugt das Passwort neu,
schreibt die lokale `.env` atomar und erstellt ausschließlich den laufenden `backend-api`-Dienst
mit derselben Anwendungsversion neu. Die Session-Prüfung muss erfolgreich sein; der erzeugte
Wert wird weder angezeigt noch aus einer gesonderten Verwahrung eingespielt (D-079).

Der Deploy erzeugt und prüft unmittelbar eine neue physische Basis samt Start-WAL. Anschließend
sind `/health`, öffentliche `/version.txt`, der Archivstatus und der vollständige Smoke-Test aus
`ADO/04_Operations/Smoke_Test_Checkliste.md` durch den Product Owner zu belegen. Alarmzeit,
Zeitpunkt der wieder schreibfähigen API und Gesamtdauer dokumentieren; über vier Stunden ist das
RTO verfehlt, auch wenn der Restore technisch gelingt.

## Lebenszyklus der Restore-Volumes

`taptime-restore-verify` legt einen Kandidaten an. Vor der Aktivierung wird er nicht verändert;
danach verändert ausschließlich PostgreSQL den Datenbestand. Die Aktivierung überschreibt das
zuvor aktive Volume nicht und lässt es nach dem sauberen PostgreSQL-Stopp unberührt als letzten
Rückfallstand liegen. Alle diese Volumes
enthalten personenbezogene Lohndaten und dürfen nicht unbegrenzt vergessen werden.

Der Product Owner entscheidet die Entfernung, eine beauftragte Betriebsperson führt sie als
root aus. Voraussetzung für das Entfernen eines alten aktiven Volumes sind: das neue Volume ist
aktiv, eine danach erzeugte externe Basis samt benötigtem WAL wurde erfolgreich
wiederhergestellt, und der Product Owner hat den Smoke-Test bestätigt. Nach einem historischen
Restore müssen außerdem alle Ereignisse nach dem Zielzeitpunkt aus dem alten Volume inventarisiert
und fachlich geklärt sein. Ein erfolgreich materialisierter, aber verworfener Kandidat darf
entfernt werden, sobald sein Verwerfen
dokumentiert, sein Name ungleich dem Inhalt von `postgres-volume` und seine Nichtbenutzung durch
Container belegt ist. Dieselbe Regel gilt für einen nach hartem Abbruch markerlos gebliebenen
Kandidaten und für `taptime-postgres-data`, sobald dieses Defaultvolume nach einer Aktivierung
zum alten inaktiven Stand geworden ist.

Vor jeder Entfernung werden Zustand und exakter Name einzeln geprüft:

```sh
cat /var/lib/taptime-deploy/postgres-volume
docker volume inspect taptime-postgres-restored-YYYYMMDDTHHMMSSZ
docker ps --all --filter volume=taptime-postgres-restored-YYYYMMDDTHHMMSSZ
docker volume rm taptime-postgres-restored-YYYYMMDDTHHMMSSZ
```

Kein Glob und kein rekursiver Löschbefehl ist zulässig. `docker volume prune` und
`docker compose down -v` sind auf diesem Server verboten. Das aktive Volume und der letzte belegte
Rückfallstand werden niemals automatisch entfernt. Scheitert eine Materialisierung vor dem
Abschlussmarker, entfernt das Skript den begonnenen Kandidaten selbst; nach einem harten
Prozessabbruch bleibt er markerlos und die Aktivierung weist ihn ab.

## Lebenszyklus des vorigen WAL-Spools

`taptime-restore-activate` legt die exakt benannte Quarantäne beim Aktivierungsversuch an. Danach
ändern Empfänger und Archivierer ausschließlich `/var/lib/taptime-wal`; die Quarantäne bleibt als
unveränderte Evidenz des vorigen Datenstands liegen. Sie enthält möglicherweise personenbezogene
Lohndaten. Der Product Owner entscheidet ihre Entfernung, eine beauftragte Betriebsperson führt
sie als `root` aus. Zulässig ist das erst, wenn die neue aktive Datenbank eine danach erzeugte
externe physische Basis samt WAL erfolgreich wiederhergestellt hat, der Smoke-Test bestätigt ist
und bei historischem Restore alle Ereignisse nach dem Zielzeitpunkt fachlich geklärt sind.

Vor der Entfernung werden aktiver Spool, exakter Quarantänename und Inhalt einzeln geprüft. Der
Name wird aus dem exakten Kandidatennamen abgeleitet: Aus
`taptime-postgres-restored-YYYYMMDDTHHMMSSZ` wird
`/var/lib/taptime-wal.pre-restore-YYYYMMDDTHHMMSSZ`; nach Erfolg nennt der Aktivator ihn außerdem
in seiner Abschlussmeldung. Platzhalter werden vor Ausführung ersetzt:

```sh
test -d /var/lib/taptime-wal
find /var/lib/taptime-wal.pre-restore-YYYYMMDDTHHMMSSZ -maxdepth 1 -type f -print
rm -r -- /var/lib/taptime-wal.pre-restore-YYYYMMDDTHHMMSSZ
```

Kein Glob ist zulässig. Wird die Aktivierung vor der Umschaltung aufgegeben und der alte
Datenbankstand wieder aufgenommen, darf dessen Quarantäne nicht gelöscht werden: Zuerst bleiben
Datenbank und WAL-Dienste gestoppt; die leere aktive Spool-Struktur wird entfernt und die exakt
zugehörige Quarantäne atomar auf `/var/lib/taptime-wal` zurückbenannt. Das ist eine bewusste
Störfallentscheidung des Product Owners, kein automatischer Rückfall.

## Abbruch während der Aktivierung

Bei jedem Fehler zuerst `/var/lib/taptime-deploy/postgres-volume` und die vollständige Ausgabe
sichern. Zeigt die Datei noch auf das bisherige Volume, sind altes Backend und Datenbank trotzdem
möglicherweise bereits gestoppt. Ursache beheben und denselben geprüften Kandidaten erneut mit
`taptime-restore-activate <exakter-name>` aktivieren; nicht durch einen manuellen Compose-Start
abkürzen.

Zeigt die Datei bereits auf den Kandidaten, hat der Aktivator den Zustandswechsel vollzogen und
der nachgelagerte Deploy ist fail-closed abgebrochen. Nach Behebung wird genau dieser Deploy mit
der belegten Version wiederholt:

```sh
/usr/local/sbin/taptime-deploy \
  "$(cat /var/lib/taptime-deploy/current-version)"
```

Das Volume niemals automatisch zurückstellen. Nach möglichem neuen Verkehr könnte der Kandidat
bereits zusätzliche Ereignisse enthalten; ein Umschalten auf den alten Stand würde zwei
Datenlinien erzeugen und kann bestätigte Arbeit verlieren. Eine Rückkehr ist dann eine eigene,
belegte Störfallentscheidung des Product Owners.

## Betrieb nach dem Wiederanlauf

WAL-Empfänger und Archivierer laufen als dauerhafte Dienste; Basissicherung, Restore-Probe und
Monitore laufen über Timer. Nach dem ersten erfolgreichen Deploy auf einem Ersatzserver prüfen:

```sh
systemctl enable --now taptime-wal-receiver.service taptime-wal-archiver.service
systemctl enable --now taptime-backup.timer taptime-restore-verify.timer
systemctl enable --now taptime-immediate-monitor.timer taptime-daily-monitor.timer
systemctl list-timers 'taptime-*'
systemctl is-active taptime-wal-receiver.service taptime-wal-archiver.service
```

Ein manuelles `docker compose up` darf die Volumenauswahl nicht verlieren. Es ist nur mit der
belegten Anwendungsversion und dem gespeicherten Volume zulässig; der normale Weg bleibt
`taptime-deploy` beziehungsweise `taptime-restore-activate`:

```sh
TAPTIME_VERSION="$(cat /var/lib/taptime-deploy/current-version)" \
TAPTIME_POSTGRES_VOLUME="$(cat /var/lib/taptime-deploy/postgres-volume)" \
docker compose --file /opt/taptime/source/infrastructure/docker-compose.server.yml up --detach
```

## Storage-Box-Schnappschüsse

Ein benötigter Stand wird bevorzugt aus `/home/.zfs/snapshot/<snapshot-name>/` in eine Kopie
geholt und dort geprüft. Das Zurücksetzen der Storage Box löscht alle neueren Daten und neueren
Snapshots dauerhaft und braucht deshalb die ausdrückliche Freigabe des Product Owners.

Automatische Snapshots rotieren. Zusätzlich wird monatlich und vor größeren Serveränderungen ein
manueller Snapshot angelegt. Seine Löschung entscheidet der Product Owner ausdrücklich. Ein
Snapshot ersetzt weder die clustergebundene Basis/WAL-Prüfung noch den Zeitpunktnachweis.
