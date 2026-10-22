# Wiederholbar ausliefern

Backend, Admin-Web, Betreiber-Web, Startseite und Betriebsdateien werden nach erfolgreicher `CI` eines
Pushs auf `main` aus diesem Repository einmal von `Release container images` gebaut. Vor jedem Bau
wird geprüft, dass der exakte Commit in der Geschichte von `main` liegt. Jeder geprüfte Stand erzeugt die zu seinen Fähigkeiten gehörenden unveränderlichen Abbilder,
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
Der Image-Bau nutzt keinen GitHub-Actions-Cache, damit ein hängender Cache-Import oder -Export die Veröffentlichung eines geprüften Stands nicht verhindert (D-094).
Die Veröffentlichungen laufen nacheinander, damit Bau und Aufräumen verschiedener Commits sich nicht
überschneiden. Actions sind auf vollständige Commit-SHAs festgelegt; Dependabot schlägt wöchentlich
Aktualisierungen vor. Diese durchlaufen die übliche Prüfung, keine automatische Übernahme.

## PO-Schritte für Deploy 8: T-132

Vor dem Deploy installiert der PO den neuen Controller nach dem Bootstrap-Ablauf unten.
Der Controller hält jetzt Sicherungs- und Wochenprüftimer an, wartet begrenzt auf beide Dienste
und startet beide Timer auch bei einem Abbruch wieder. Die neue Operations-Version liefert den
Wächter, den Plattenordner als StateDirectory und die Boot-Aufräumregel mit.

Vorher legt der PO in Healthchecks einen **zweiten Check** an (Periode ein Tag, Toleranz eine
Stunde, Down-Meldung „Tagesprüfung ausgeblieben“ an das vorhandene ntfy-Thema). Seine geheime URL
kommt nach `MONITORING.md` ausschließlich in `/etc/taptime-monitor/daily-healthchecks.curl`,
root:root, 0600. Der Deploy prüft nur Metadaten und bricht bei fehlender, verlinkter oder unsicherer
Datei vor der Vorbereitung ab. Er liest und verändert ihren Inhalt nicht. Der Tagesmonitor meldet
eine fehlende Einrichtung zusammen mit seinen übrigen Befunden per ntfy und endet ohne Ping mit Fehler.
Borgs SSH-Grenzen und die Migration des Sicherheitszustands wirken ohne Änderung der Geheimnisse.

Nach erfolgreichem Deploy startet der PO an der Hetzner-Konsole die Wochenprobe einmal selbst.
Die erste Probe kann wegen des nachzuholenden Prune-/Compact-Rückstands länger dauern.
Asynchron starten; die Konsole bleibt bedienbar. Später Zustand und Ergebnis abfragen, erst nach
Ende den frischen Status abnehmen. Jede Zeile einzeln, US-Tastatur wie unten; Status als Foto
belegen, keine Geheimnisdatei anzeigen:

```sh
systemctl start --no-block taptime-restore-verify
```

Später, bis `ActiveState=inactive` und `Result=success`:

```sh
systemctl show taptime-restore-verify -p ActiveState -p Result
cat /var/lib/taptime-monitor/restore-status.json
systemctl start taptime-daily-monitor
systemctl show taptime-daily-monitor -p Result
systemctl show taptime-wal-receiver -p NRestarts
```

Erwartet: Restore `state: ok` mit neuem UTC-Zeitpunkt, Tagesmonitor `Result=success`, der zweite
Check erhält sein Lebenszeichen. F-123 bleibt eine Prüfung am Server: `NRestarts` darf nicht
fortlaufend wachsen. Zusätzlich als root kurz prüfen, dass genau der vorgesehene WAL-Empfänger
am Slot hängt (nur Slot, Aktivität und Anzahl, keine Verbindungsdaten):

```sh
docker exec -u postgres taptime-prod-database-1 psql -d taptime -c "SELECT slot_name,active FROM pg_replication_slots;"
docker exec -u postgres taptime-prod-database-1 psql -d taptime -c "SELECT count(*) FROM pg_stat_replication;"
```

Bei Neustartschleife oder unerwarteter Belegung stoppen und den TL informieren; T-132 ändert den
WAL-Empfänger nicht. Hetzner Cloud Backups bleiben als ganze Plattenkopien aktiv (sieben Plätze,
Nürnberg, D-151). Sie enthalten auch alte Zugangswerte bis zu sieben Tage nach Rotation und sind
kein geprüfter Datenbank-Restore-Weg; Nutzung und Grenzen stehen in `RESTORE.md`.

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
Passworteingabe bleibt vollständig unsichtbar. **Einfügen ist möglich, aber unzuverlässig:**
Mehrere Zeilen können zu einer verschmelzen, Leerzeichen können fehlen. Deshalb jede Zeile
einzeln tippen oder einfügen, vor Enter vollständig lesen und die geheimnisfreie Abschlusszeile
als Foto sichern. **Nie Strg+Alt+Entf drücken.** Auf einer deutschen Tastatur gelten diese Tasten:

| Gewünschtes Zeichen | Deutsche Taste bei US-Belegung |
|---|---|
| `-` | `ß` |
| `_` | `Shift` + `ß` |
| `/` | Minus-Taste rechts neben dem Punkt |
| `=` | `´` |
| `:` | `Shift` + `Ö` |
| `"` | `Shift` + `Ä` |
| `$` | `Shift` + `4` |
| `{` | `Shift` + `Ü` |
| `}` | `Shift` + `+` |
| `>` | `Shift` + Punkt |
| `\|` | `Shift` + `#` |
| `y`, `z` | `z`, `y` (vertauscht) |

Dieser Weg umgeht SSH und wurde vor dem Sperren des Root-SSH-Logins praktisch geprüft.

## `.env` verschlüsselt im Passwortmanager verwahren

Diesen Ablauf führt ausschließlich der PO nach separater Freigabe aus, vor einer Rotation und
nach jeder Änderung der vollständigen `/opt/taptime/.env`. Root liest die Datei nur zur
Verschlüsselung; über SSH wird allein die verschlüsselte Transportdatei übertragen. Keine Werte
in Chat, Fotos, Befehlsargumente oder Protokolle übernehmen. Bei einem Befehlsfehler stoppen.

1. **Root an der Hetzner-Konsole.** Die Transport-Passphrase im Passwortmanager unter
   **„Taptura env-Transport“** verwahren; nur Kleinbuchstaben außer `y`/`z` sowie Ziffern verwenden.
   Sie wird ausschließlich in die beiden Passphrase-Abfragen von `openssl` getippt. Jede Zeile
   einzeln ausführen:

   ```sh
   cd /home/taptime-deploy
   umask 077
   openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -salt -in /opt/taptime/.env >env.enc
   chown taptime-deploy env.enc
   ```

   Die Ausgabeumleitung `>` verwenden, kein `-out`: Ein fehlendes Leerzeichen an der Option
   führte an der Konsole zu „Unknown cipher“. Die neue Datei hat durch `umask 077` Modus 0600;
   nach `chown` kann `taptime-deploy` sie lesen, ohne Leserecht auf der ursprünglichen `.env`.

2. **Am Mac im eigenen Terminal.** Der Deploy-Schlüssel muss im SSH-Agenten geladen sein
   (siehe „Ausliefern“). Die verschlüsselte Datei landet im Benutzerverzeichnis, außerhalb des
   Repositorys:

   ```sh
   umask 077
   ssh taptime-deploy@46.225.58.30 'cat env.enc' > ~/env.enc
   set -o pipefail
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -in ~/env.enc | pbcopy
   ```

   Die Passphrase nur in die `openssl`-Abfrage eingeben. Nach erfolgreichem Entschlüsseln
   **sofort** in den Passwortmanager einfügen und speichern; dazwischen nichts anderes kopieren.
   Die verwahrte Kopie nur anhand der Schlüsselnamen auf Vollständigkeit prüfen, nie Werte
   ausgeben. Danach Zwischenablage leeren und die lokale Transportdatei entfernen:

   ```sh
   pbcopy < /dev/null
   rm ~/env.enc
   ```

3. **Zurück an der Root-Konsole.** Nach erfolgreicher Verwahrung die Server-Transportdatei
   entfernen:

   ```sh
   shred -u /home/taptime-deploy/env.enc
   ```

Der PO erzeugt die Transportdateien bei jeder erneuten Verwahrung neu und entfernt sie danach
auf beiden Rechnern. Die vollständige Kopie im Passwortmanager ersetzt er nach jeder Änderung;
bei endgültiger Stilllegung entfernt er Kopie und Transport-Passphrase nach Freigabe.

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
**Push-CI-Lauf des freigegebenen Commits** (Workflow *CI*, Zweig `main`). Dessen Run-ID aus
der URL am Mac verwenden:

```sh
gh run view <ci-run-id> --repo Tim180201/taptime \
  --json workflowName,event,headBranch,conclusion,headSha \
  --jq 'select(.workflowName == "CI" and .event == "push" and .headBranch == "main" and .conclusion == "success") | .headSha'
```

Ohne Ausgabe stoppen. Die vollständige SHA muss mit dem vom TL freigegebenen Commit
übereinstimmen; dessen erste sieben Zeichen sind die Revision für den Konsolenblock.
Der zugehörige erfolgreiche Image-Lauf muss dieselbe Quellrevision gebaut haben: Sein Schritt
*Check out the exact tested commit* verwendet `github.event.workflow_run.head_sha`, und seine
Build-Schritte setzen `org.opencontainers.image.revision` auf diese vollständige Quell-SHA.
**`headSha` des Image-Laufs ist kein Nachweis des gebauten Commits:** Bei `workflow_run`
bezeichnet es die Spitze von `main` beim Start des Image-Laufs und kann bereits einen späteren
Dokumentationscommit nennen. Dieser menschliche Vergleich ist die
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

Der Deploy-Controller veröffentlicht nach dem Lesen der Zustandsdateien und unter dem Deploy-Lock
**vor dem ersten Image-Pull** seine Zielversion als `pending_versions` im nicht sensitiven Schutzsatz
`/opt/taptime/admin-web/status/ghcr-protected-versions.json`. Die Reservierung schützt alle Tags des
Ziels, auch `operations-<Ziel>`; `operations_version` schützt weiterhin die installierte Fassung aus
der Zustandsdatei. So sind beide möglichen Operations-Auswahlen geschützt, bevor die Fähigkeit des
Zielabbilds bekannt ist. `current`, `previous` und bekannte Versionen bleiben dabei geschützt.
Der Controller ergänzt bestehende Reservierungen atomar; Abbruch, Rücknahme und Absturz entfernen
sie nicht. Erst die erfolgreiche Endveröffentlichung nach Aktivierung und Gesundheitsprüfung ersetzt
sie durch eine leere Liste, schreibt den neuen aktuellen und vorherigen Stand, die vollständige Datei
`known-versions` und die tatsächlich gewählte Operations-Version. Es gibt keinen zeitgesteuerten
Ablauf und keinen manuellen Bereinigungsschritt für Reservierungen. Die Datei bleibt im vom Controller
erzeugten flachen Format; fremdes oder beschädigtes Format stoppt den Deploy vor dem ersten Pull.

Der Veröffentlichungsworkflow lädt diesen Satz erst nach dem Bauen und Veröffentlichen. Ist er nicht abrufbar oder ungültig, bleiben die
veröffentlichten Abbilder verfügbar; das Aufräumen wird mit Warnung und Eintrag in der Laufübersicht
übersprungen. Dasselbe gilt bei einer unvollständigen Registry-Auskunft oder unbekannten Manifesten.
Geschützt sind Backend, Admin-Web und vorhandene Betreiber- und Startseiten-Abbilder aller bekannten
Anwendungsversionen, alle Abbilder reservierter Versionen, die Operations-Abbilder von `current` und
`previous`, die ausgewählte Operations-Version, `ops` und die **neuesten zehn vollständigen Releases**.
Ein Release umfasst die fünf Versions-Tags und ihre Manifestgraphen. Seine Reihenfolge folgt dem frühesten
`created_at` seiner getaggten Paketversionen (neueste zuerst), bei Gleichstand der Versionskennung
aufsteigend. Ein später ergänztes Abbild oder ein ungetaggtes Kind verjüngt ein Release nicht.
Zusätzlich bleiben sämtliche von erhaltenen Indizes referenzierten Kind-Manifeste bestehen, auch
ohne eigenen Tag und über verschachtelte Indizes. Ein fehlendes `pending_versions` in einem alten
Schutzsatz bedeutet leer; ein ungültiges Feld verhindert jede Löschung.
Unmittelbar vor der ersten Löschung wird der Schutzsatz erneut geladen. Jede inhaltliche Abweichung
oder ein Lesefehler setzt das gesamte Aufräumen mit Warnung aus; die separate Abrufprüfung läuft trotzdem.
Beide Abfragezeiten, die geladenen Schutzsätze und der Löschplan mit Kennung, Digest und Tags stehen
in der Laufübersicht; jede Löschzeile nennt ebenfalls diese drei Angaben.
Gelöscht werden zuerst entbehrliche Eltern, dann deren nicht anderweitig benötigte Kinder.
Danach prüft ein eigener Schritt current, previous, die ausgewählte Operations-Version, `ops` und
die zehn neuesten Releases durch frischen anonymen Abruf der Indizes,
Kind-Manifeste, Konfigurationen und Schichten samt Digest und Größe. Ein Lösch- oder Abruffehler macht
den Lauf rot; die Prüfung erfolgt auch nach einer teilweise fehlgeschlagenen Löschung.
Ältere bekannte und reservierte Stände bleiben geschützt; bereits fehlende Kinder außerhalb der
streng geprüften Menge verhindern das Aufräumen nicht. Bekannte historische Fehlstellen bleiben unverändert.
Ein Restrisiko bleibt ohne gemeinsamen Lock zwischen Workflow und Deploy: Eine Reservierung genau zwischen
zweitem Lesen und Löschen kann ein unbekanntes Ziel außerhalb der zehn neuesten Releases zu spät schützen.

Vor dem ersten T-028-Deploy müssen Backend und Admin-Web für Ziel und Rücknahme sowie die
Operations-Abbilder des freigegebenen T-028-Controllers und der Zielanwendung vorhanden sein.
Starte `Release container images` bei Bedarf manuell vom Zweig `main` mit `source_ref` gleich dem
vollständigen Commit der gewünschten Version. Auch er muss auf `main` liegen und einen erfolgreichen
Push-CI-Lauf aus diesem Repository haben. Dieser Reparaturbau benötigt keine erreichbare Produktion.
Bereits vorhandene unveränderliche Abbilder werden geprüft und nicht neu gebaut; fehlende Backend-,
Admin-Web-, Betreiber-Web-, Startseiten- oder Operations-Abbilder werden ergänzt.
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

Vor jedem Deploy geht der TL mit dem PO die PO-Schritte aller enthaltenen Aufgaben durch.
Wurde `.env` geändert, verwahrt der PO die vollständige aktuelle Datei nach
[„`.env` verschlüsselt im Passwortmanager verwahren“](#env-verschlüsselt-im-passwortmanager-verwahren)
und bestätigt die Vollständigkeit anhand der Schlüsselnamen, bevor der Deploy beginnt.

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
caffeinate -i ssh -t -o ServerAliveInterval=30 -o ServerAliveCountMax=10 taptime-deploy@46.225.58.30 \
  'sudo /usr/local/sbin/taptime-deploy abcdef0' 2>&1 \
  | tee "$HOME/taptime-logs/deploy-$(date +%Y%m%d-%H%M%S).log"
```

Bei fehlendem Agent-Schlüssel vor dem letzten Befehl stoppen. Terminal und Mac bleiben bis
zum Abschluss offen. Die Keepalive-Optionen halten die Verbindung während langer Phasen ohne Ausgabe (Sicherung, Restore-Probe) offen; ohne sie hat am 24.09. ein Netzgerät die Verbindung still getrennt, und der Controller brach sicher ab. Danach liest Codex bei Bedarf das gesicherte Log.

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
geprüfte lokale Quelle dazu synchron. Wegwerf-Container sowie die im geschützten Plattenordner entpackte Basis
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

**T-083:** Die neuen `taptime-status`-Zeilen erscheinen erst nach dem nächsten Konsolenschritt
(voraussichtlich mit T-024); Sicherung, Archivierer und Wächter (A–C) wirken sofort mit dem Deploy.

Diese Grenze ist ausdrücklich inventarisiert. Backend, Admin-Web, Betreiber-Web, Backup- und Monitoring-Skripte,
deren Einheiten, journald-Grenzen, Compose und Caddy kommen dagegen ausschließlich über die vier
gleich markierten Abbilder.

## T-024: Geheimnisse rotieren

**Teil A ist das Werkzeug und dieses Runbook. Es kommt erst mit Deploy 7 nach dem
Implementierungs-Commit, nicht mit Deploy 6.** Teil B führt ausschließlich der PO nach separater
Produktionsfreigabe aus, begleitet vom TL. Codex liest keine Server-Geheimnisse und führt diese
Schritte nicht aus. Vorher die alte vollständige `.env` nach
[„`.env` verschlüsselt im Passwortmanager verwahren“](#env-verschlüsselt-im-passwortmanager-verwahren)
sichern; keine Geheimnisse in Chat, Fotos, Befehlsargumente oder Deploy-Protokolle übernehmen.

1. **Neuer Deploy-Schlüssel am Mac.** Mit `ssh-keygen` interaktiv eine Passphrase setzen und
   im Passwortmanager verwahren. Den öffentlichen Teil dem eigenen GitHub-Konto hinzufügen
   (Settings → SSH and GPG keys); den privaten Teil niemals hochladen. Fingerabdruck am Mac:

   ```sh
   ssh-keygen -t ed25519 -f ~/.ssh/taptime-deploy-new
   ssh-keygen -lf ~/.ssh/taptime-deploy-new.pub
   ssh-add ~/.ssh/taptime-deploy-new
   ```

2. **Root an der Hetzner-Konsole.** Jede Zeile einzeln tippen oder einfügen und vor Enter lesen
   (US-Tastatur und unzuverlässiges Einfügen, siehe „Zugang und Berechtigung“).
   `Tim180201` ist das GitHub-Konto des PO; bei einem anderen Konto entsprechend ersetzen.
   Alle geladenen Fingerabdrücke mit der Ausgabe am Mac vergleichen. Erst danach die Zeile
   des neuen Schlüssels auswählen: `n` auf deren tatsächliche Zeilennummer setzen, nicht raten.

   ```sh
   umask 077
   cd /root
   curl -fsS https://github.com/Tim180201.keys -o t024.keys
   ssh-keygen -lf t024.keys
   cat -n t024.keys
   cd /home/taptime-deploy/.ssh
   cp -p authorized_keys /root/t024-authorized_keys
   ```

   Danach `n=<geprüfte Zeilennummer>` eingeben, dann:

   ```sh
   sed -n "${n}p" /root/t024.keys >> authorized_keys
   chown taptime-deploy:taptime-deploy authorized_keys
   chmod 600 authorized_keys
   ssh-keygen -lf authorized_keys
   ```

3. **Neuen SSH-Zugang belegen.** Am Mac in einer zweiten Sitzung mit
   `ssh -i ~/.ssh/taptime-deploy-new -o IdentitiesOnly=yes taptime-deploy@46.225.58.30`
   anmelden und `sudo -n /usr/local/sbin/taptime-status` aufrufen. Die Konsole offen halten.
   Für Deploy 7 in Schritt 4 ausschließlich diesen Schlüssel verwenden. War Deploy 6 schon
   mit dem neuen Schlüssel erfolgreich, ist dessen Deploy-Nachweis bereits erbracht.

4. **Werkzeug ausliefern.** Deploy 7 muss den freigegebenen Implementierungs-Commit enthalten.
   Weil sich Dateiliste und Prüfung des Controllers erweitern, vorher den Controller aus
   genau diesem Operations-Abbild über den Abschnitt „Deploy-Controller installieren oder
   aktualisieren“ erneuern. Danach regulär Deploy 7 ausführen. Der Deploy installiert
   `taptime-runtime-rotate` root-eigen mit Modus 0700 sowie seine Rollenquelle
   `server-runtime-logins.sql`. Nach erfolgreichem Deploy und erneutem Statusaufruf den alten
   Schlüssel entfernen: an der Konsole in `/home/taptime-deploy/.ssh` mit `nano authorized_keys`
   ausschließlich die am Fingerabdruck erkannte alte Zeile löschen, Rechte beibehalten und die
   neue Mac-Sitzung nochmals prüfen. Erst danach die temporären öffentlichen Dateien und die
   Sicherung entfernen:

   ```sh
   rm /root/t024.keys
   shred -u /root/t024-authorized_keys
   ```

   Anschließend startet der PO das Rotationswerkzeug an der Root-Konsole:


   ```sh
   taptime-runtime-rotate
   ```

   Nur bei Exit 0 fortfahren. Erfolg nennt jede Laufzeit-Rolle und den Cursor-Schlüssel mit
   „rotiert“, keine Werte. Das Werkzeug liest `.env` als Daten (Literalwerte, optional einfach
   oder doppelt eingefasst; keine Interpolation, Inline-Kommentare oder Escape-Sequenzen).
   Jeder LOGIN aus der ausgelieferten SQL-Quelle muss genau einem `*_DATABASE_URL` entsprechen,
   jeder URL auf `database:5432/taptime` zeigen. Abweichungen, doppelte Schlüssel, andere
   Eigentümer/Rechte, mehrere Container oder belegte Deploy-/Betreiber-Sperren stoppen vor
   einer Änderung. Der Betreiber-Zugang bleibt ausgenommen.

   Neue Passwörter und Cursor-Schlüssel enthalten je 32 Zufallsbytes (base64url ohne Auffüllung).
   Erst nach vollständiger Vorbereitung ersetzt das Werkzeug `.env` atomar und schreibt alle
   Passwortänderungen in einer Datenbanktransaktion fest. Es erstellt nur das Backend mit dem
   bereits laufenden Abbild neu und prüft dessen Gesundheit, öffentliche API und Admin-Version
   wie das Deploy-Tor. Offene Kalender-Cursor verlieren ihre Gültigkeit; neu laden.
   Bei einem anschließenden Fehler stellt es alte Passwörter, `.env` und Backend wieder her und
   endet mit Fehler. Nach Erfolg oder gelungenem Rückweg überschreibt und entfernt es seine
   geschützten Arbeitsdateien. Das Operations-Abbild liefert und aktualisiert das Werkzeug;
   entfällt es in einem späteren Abbild, ist es nach dessen Aktivierung nicht mehr verfügbar.

   **Bei Fehler:** nicht mit dem nächsten Rotationsschritt fortfahren. Der TL prüft die feste
   Fehlermeldung. Bei „alte Zugänge und Konfiguration wiederhergestellt“ ist der Rückweg beendet.
   Misslingt auch dieser, bleibt das ausgegebene root-eigene Arbeitsverzeichnis (0700, Dateien
   0600) für die Wiederherstellung durch PO/TL erhalten. Ebenso kann es nach Stromausfall oder
   SIGKILL zurückbleiben; Datenbank und Dateisystem haben keinen gemeinsamen atomaren Commit.
   Ohne Abgleich durch den TL weder erneut starten noch diese Altkopie löschen. Nach belegter
   Wiederherstellung entfernt der PO die darin enthaltenen Dateien mit `shred -u`, dann das leere
   Verzeichnis mit `rmdir`. Keine Arbeitsdatei oder Konfiguration an den Chat übergeben.

5. **Betreiber-Zugang separat rotieren und prüfen.**

   ```sh
   taptime-operator-db-login --rotate
   taptime-status
   ```

   Bei einem Fehler stoppen und dem TL die geheimnisfreie Fehlermeldung geben. Danach im Web
   anmelden, eigene Zeiten laden und den Betreiber-Bereich prüfen. Die neue vollständige `.env`
   einschließlich `SUPABASE_PUBLISHABLE_KEY` nach
   [„`.env` verschlüsselt im Passwortmanager verwahren“](#env-verschlüsselt-im-passwortmanager-verwahren)
   neu sichern; die verwahrte Kopie anhand der Schlüsselnamen auf Vollständigkeit prüfen.
   Erst danach die überholte Server-Kopie löschen:

   ```sh
   shred -u /root/env-0410.bak
   ```

6. **Alarmziel und Supabase.** ntfy-Thema nach „T-024: ntfy-Thema erneuern“ in
   `MONITORING.md` erneuern, Telefon und Healthchecks-Down-Webhook umstellen und eine Testmeldung
   empfangen. Im Supabase-Dashboard nach D-139 die Mindestlänge 10 setzen, „Rate limit for
   sign-ups and sign-ins“ und „Rate limit for token verifications“ je auf 100; „Rate limit for
   token refreshes“ bleibt 150 (Details unten). Mit Supabase Pro zusätzlich den Schutz vor
   geleakten Passwörtern einschalten. Der PO bestätigt diese Schritte dem TL.

## Supabase-Einladungen und Wiederherstellung (T-094, T-094b)

Vor der separat freigegebenen Auslieferung prüft der Product Owner: Selbstregistrierung aus, E-Mail-Bestätigung an, „Email OTP Expiration“ **3600 s**. Site URL `https://admin.tb-infra.de` ohne abschließenden Schrägstrich; Einladungs-Redirect `https://admin.tb-infra.de/willkommen`, ohne Wildcard. App und Web setzen Passwörter über dieselbe Site URL; keine Recovery-App-Schemata. Der PO legt diese Einstellungen und die Redirect-Liste an, pflegt sie bei Domain-/Projektwechsel und entfernt obsolete Einträge nach Ablösung. Deutsche Vorlage und vollständiger Ablauf: `docs/T-047-Inbetriebnahme.md`, `docs/T-047-Einladungsvorlage.md`.

**T-119 / D-139, vor den ersten echten Konten, zusammen mit T-024:** Der Product Owner
setzt im Supabase-Dashboard unter Authentication → Sign In / Providers → Email die
Passwort-Mindestlänge („Minimum password length“) auf **10 Zeichen**, gleich der gemeinsamen
Quelle `shared/authPolicy.ts`. Sie gilt beim Setzen und Ändern eines Passworts; bestehende
kürzere Passwörter melden sich weiter an (Supabase liefert dann nur den Hinweis `weak_password`).
Unter Authentication → Rate Limits setzt der PO **„Rate limit for sign-ups and sign-ins“** und
**„Rate limit for token verifications“** je **auf 100** je 5 Minuten und IP-Adresse (Standard
jeweils 30). Ein Einladungs- oder Rücksetzlink zählt in beiden: Prüfen des Links unter „token
verifications“, Setzen des Passworts unter „sign-ups and sign-ins“. So wird ein Standort hinter
einer gemeinsamen Internetadresse am Einführungstag nicht ausgebremst. Die Anmeldung mit Passwort
zählt dagegen unter **„Rate limit for token refreshes“** (Standard 150 je 5 Minuten und IP,
zusammen mit den Sitzungserneuerungen); diesen Wert nicht senken (D-139, Nachtrag 22.10.). Sonst
bleibt auf beiden Seiten alles unverändert. Mit der Gewerbeanmeldung stellt der PO auf
**Supabase Pro** um (D-130) und aktiviert unmittelbar danach den **Schutz vor bekannten
geleakten Passwörtern**, ebenfalls vor den ersten echten Konten. Der PO prüft und pflegt diese
Einstellungen bei späteren Richtlinien- oder Projektwechseln und entfernt die alten
Einstellungen mit der Ablösung des Projekts. Die Anmeldung geht weiter direkt von den Clients
an Supabase; im Pilot gibt es kein CAPTCHA. Vor der Ausweitung bewerten PO und TL den Schutz
erneut. Diese Dashboard-Schritte sind keine automatischen Schritte des Deploys.

**Erst nach dem erfolgreichen Deploy von T-094b:** Der Product Owner setzt Betreff und HTML aus
`docs/T-094b-Ruecksetzvorlage.md` unter Authentication → Email Templates → Reset Password ein.
Der Link führt direkt zu `/passwort-neu`, mit `token_hash` und `type=recovery` im Anker; die Seite
prüft den Link erst beim Absenden des neuen Passworts. Site URL ohne abschließenden Schrägstrich
prüfen, **Redirect-Liste unverändert lassen**. Der PO pflegt die Vorlage bei Änderungen und entfernt
sie bei Ablösung; Link-Tracking bleibt abgeschaltet. Danach neue Rücksetz-Mail aus App und Web
anfordern, am Handy Passwort setzen, anmelden und einen erneuten Versuch mit demselben Link prüfen.
Vor der Umstellung verschickte `access_token`-Links funktionieren weiter; verbrauchte Links zeigen
an der Anmeldung den Hinweis, einen neuen Link anzufordern.

Der Backend-Prozess benötigt zusätzlich den **öffentlichen** `SUPABASE_PUBLISHABLE_KEY` in seiner Konfiguration. Der PO übernimmt ihn aus dem Projekt, aktualisiert ihn bei Rotation und entfernt ihn bei Projektablösung. Beim Start und vor jedem Einladungsversand liest der Prozess damit `/auth/v1/settings`. Nur `disable_signup=true` und `mailer_autoconfirm=false` erlauben Einladungen. Fehlende, unlesbare oder unsichere Einstellungen liefern `account_creation_not_configured`, mit Korrelations-ID und Ursache im Serverprotokoll; andere Funktionen laufen weiter. Das Backend ändert keine Supabase-Einstellungen. Den geheimen service-role-Schlüssel weiterhin ausschließlich nach D-049 verwahren.
