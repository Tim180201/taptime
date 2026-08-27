# Betriebssichtbarkeit

Das Backend schreibt ausschließlich JSON-Diagnosen nach stderr; Docker leitet sie mit dem Tag
`taptime-backend-api` an journald weiter. Jeder Eintrag enthält nur `timestamp`, `error_class`,
`route` und `correlation_id`. Die Route stammt aus der geschlossenen Backend-Routenmenge. Namen,
E-Mail-Adressen, Kundenbezeichnungen, Arbeitszeiten, Token, Anfrageinhalte und
Organisationskennungen sind nicht Teil des Diagnosevertrags.

```sh
journalctl CONTAINER_TAG=taptime-backend-api --since today --output=cat
```

Die aus `infrastructure/logging/taptime-journald.conf` versioniert installierte Datei
`/etc/systemd/journald.conf.d/60-taptime.conf` begrenzt alle Journale auf 14 Tage und 256 MiB bei
mindestens 1 GiB freiem Plattenplatz. Der API-Container muss den Docker-Logging-Treiber
`journald` und den Tag `taptime-backend-api` verwenden.

## Genau vier Meldungen

| Text | Prüfung | Versand |
|---|---|---|
| `API antwortet nicht` | jede Minute | ntfy, Priorität 5, einmal je Ausfall |
| `Sicherung überfällig` | täglich 08:00 Europe/Berlin, letzter Erfolg älter als zwei Stunden | gebündelt, ntfy, Priorität 3 |
| `Wiederherstellungsprüfung fehlgeschlagen` | täglich 08:00 Europe/Berlin, letzter Status nicht `ok` oder älter als acht Tage | gebündelt, ntfy, Priorität 3 |
| `Platte über 80 Prozent` | täglich 08:00 Europe/Berlin, Belegung mindestens 80 Prozent | gebündelt, ntfy, Priorität 3 |

Es gibt keine Entwarnungs- oder Transportfehlermeldung als fünfte Meldung. Nach einer still
erkannten Erholung darf derselbe Fehler bei einem späteren neuen Ausfall wieder melden.

## Geheimnisse und Telefon

`/etc/taptime-monitor/ntfy.curl` und `/etc/taptime-monitor/healthchecks.curl` gehören `root`,
haben Modus `0600` und enthalten die beiden geheimen URLs. Die Skripte übergeben nur den
Dateipfad an curl; das ntfy-Thema und die Healthchecks-UUID erscheinen dadurch nicht in `argv`.
Auch ntfy-Antwortkörper werden verworfen, weil die erfolgreiche Serverantwort den geheimen
Themennamen wiederholt und sonst in stdout beziehungsweise journald landen würde.
Der ntfy-Themenname wird auf dem Server aus 32 Zufallsbytes erzeugt und nur dem Product Owner
zur Einrichtung der App gegeben.

Nach einem Telefonwechsel sind einmalig die Mitteilungen für ntfy zu erlauben. Auf dem iPhone
muss der Product Owner ntfy außerdem in jeden tatsächlich verwendeten Fokus aufnehmen, damit
Priorität 5 dort hörbar zugestellt werden darf; derzeit gehört ntfy in den Schlaf-Fokus. Auf
Android ist entsprechend in ntfy unter `Settings → Channel settings` für den Kanal der
maximalen Priorität das Übersteuern von „Nicht stören“ zu erlauben. Priorität 5 bleibt für beide
Sofort-Meldungen gesetzt, ersetzt aber nicht diese Betriebssystemfreigabe.

Healthchecks.io enthält genau einen groben Totmannschalter: Zeitraum fünf Minuten, Nachfrist
15 Minuten. Dieses absichtlich träge Zeitfenster vermeidet Fehlalarme bei normalen
Serverneustarts; den Ausfall nur der API meldet der Server selbst sofort. Der Server sendet jede
Minute einen leeren `HEAD` an die geheime Ping-URL. Nur der Übergang auf *Down* löst einen
POST-Webhook an das geheime ntfy-Thema aus:

- Body: `API antwortet nicht`
- Header: `Title: TapTim.e Betrieb`, `Priority: 5`, `Tags: rotating_light`
- Kein Up-Webhook, keine E-Mail-Integration

Healthchecks.io erhält aus TapTim.e ausschließlich Zeitpunkt, Absender-IP und den opaken
Check-Endpunkt eines leeren Lebenszeichens. Es erhält keine Protokolle, Organisations-, Kunden-
oder Personendaten. Für diese Betriebsprüfung verarbeitet der Dienst daher keine
personenbezogenen Daten im Auftrag von TapTim.e; die vom Product Owner selbst angelegten
Accountdaten verarbeitet der Anbieter nach seiner eigenen Datenschutzerklärung in eigener
Verantwortung.

## Installation und Prüfung

Die beiden Skripte unter `/usr/local/sbin`, ihre Services und Timer unter
`/etc/systemd/system` sowie die journald-Konfiguration kommen aus dem Operations-Abbild der
ausgelieferten Version. Der Deploy validiert sie vor Generalprobe und Sicherung, wechselt sie
gemeinsam und liest geänderte Einheiten neu ein. Nur die geheimen Dateien
`/etc/taptime-monitor/ntfy.curl` und `/etc/taptime-monitor/healthchecks.curl` werden getrennt
eingerichtet und vom Deploy nicht verändert. Der Restore-Dienst schreibt seinen dauerhaften
Status nach `/var/lib/taptime-monitor/restore-status.json`; das Verzeichnis ist root-only.
Auf dem bestehenden Produktionsserver sind alle vier Timer bereits aktiviert. Auf einem
Ersatzserver werden sie nach dem ersten erfolgreichen Deploy einmalig aktiviert:

```sh
systemctl enable --now taptime-backup.timer taptime-restore-verify.timer
systemctl enable --now taptime-immediate-monitor.timer taptime-daily-monitor.timer
systemctl list-timers 'taptime-*'
systemctl start taptime-immediate-monitor.service
systemctl start taptime-daily-monitor.service
```

Meldungstests verwenden ausschließlich kontrollierte Statusdateien beziehungsweise einen
kurzen API-Stopp. Geheim-URLs werden dabei weder ausgegeben noch als Argument übergeben. Nach
jeder Prüfung müssen API, Restore-Status und alle Timer wieder grün sein.
