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

## Genau fünf Meldungen

| Text | Prüfung | Versand |
|---|---|---|
| `API antwortet nicht` | jede Minute | ntfy, Priorität 5, einmal je Ausfall |
| `WAL-Archivierung steht` | jede Minute; Status fehlt/ist nicht `ok`, ist älter als Archivintervall mal zulässige verpasste Zyklen oder älteste benötigte WAL-Position und letzter extern bestätigter Wasserstand belegen keinen rechtzeitigen lückenlosen Fortschritt | ntfy, Priorität 5, einmal je Ausfall |
| `Sicherung überfällig` | täglich 08:00 Europe/Berlin, letzter Erfolg älter als zwei Stunden | gebündelt, ntfy, Priorität 3 |
| `Wiederherstellungsprüfung fehlgeschlagen` | täglich 08:00 Europe/Berlin, letzter Status nicht `ok` oder älter als acht Tage | gebündelt, ntfy, Priorität 3 |
| `Platte über 80 Prozent` | täglich 08:00 Europe/Berlin, Belegung mindestens 80 Prozent | gebündelt, ntfy, Priorität 3 |

Es gibt keine Entwarnungs- oder Transportfehlermeldung als sechste Meldung. Nach einer still
erkannten Erholung darf derselbe Fehler bei einem späteren neuen Ausfall wieder melden.
Der WAL-Schwellwert ist keine fest eingebaute Zeit: Er wird aus
`WAL_ARCHIVE_INTERVAL_SECONDS * WAL_ARCHIVE_MISSED_CYCLES` aus derselben Backup-Konfiguration
abgeleitet, die Empfänger und Archivierer steuert. Bei Rückstand werden die älteste noch
benötigte WAL-Datei und der letzte externe Archivstand gemeinsam ausgewertet; ein späteres
Archiv hinter einer älteren Lücke ist ausdrücklich nicht gesund. Auch bei leerer
Ereigniswarteschlange löst ein stehender Empfänger oder veralteter Status aus.

`WAL-Archivierung steht` bedeutet: Der externe Archivnachweis fehlt oder ist nicht rechtzeitig
aktuell. Drei mögliche Ursachen sind ein ausgefallener WAL-Empfänger/Archivierer, ein nicht
erreichbares Borg-Repository oder eine noch nicht abgeschlossene WAL-Datei. Der Empfänger
überträgt bereits laufend, Borg archiviert aber nur abgeschlossene Dateien. Die Compose-Dateien
setzen kein `archive_timeout` (D-066): Sonst erzeugen die Archivquittungen selbst fortlaufend
neue Segmente. Der Archivierer fordert in jedem Durchlauf einen Wechsel an, wenn eine offene
Anforderung im noch offenen Segment liegt. Er wartet danach höchstens zehn Sekunden auf die
vollständige Datei im Spool und archiviert sie im selben Durchlauf. Trifft sie später ein,
wird sie im nächsten Durchlauf abgeholt; eine `.partial`-Datei wird nie archiviert. Eine
Anforderung in einem schon geschlossenen Segment löst keinen weiteren Wechsel aus. Das Alarmfenster bleibt
unverändert; Segmentabschluss allein ist noch kein externer Archivnachweis. Bei einem Alarm
Empfänger/Archivierer, Repository-Erreichbarkeit und die älteste offene Anforderung samt
lückenlosem Archivstand prüfen.

Zwischen den Durchläufen liegt jeweils die halbe konfigurierte Pause. Jeder Durchlauf prüft
Empfänger, offenen Archivbedarf, Datenbank-Wasserstand und vollständige Spool-Dateien. Ohne
Arbeit und bei unverändertem Wasserstand entsteht der frische Status `ok` lokal, ohne Borg.
Vollständig quittierte Spool-Reste werden nach lokalem Prüfsummenvergleich entfernt;
Timeline-Historien ohne Quittungsvertrag werden weiterhin extern abgelegt. Bei Arbeit, geändertem
Wasserstand oder nach `WAL_ARCHIVE_RECONCILE_INTERVAL_SECONDS` (Standard 900 s) läuft der
Vollabgleich. Er lädt genau eine Archivliste für Basis, Marker und WAL-Kette. Fehler bleiben
`failed`, bis ein Vollabgleich wieder erfolgreich ist; fehlende Basis/Verifizierung behält
weiterhin den eigenen Wartezustand.

Der Archivierer legt im vorhandenen Cache-Verzeichnis `reconcile-state` als reinen Takt-Hinweis
an und ersetzt ihn nach erfolgreichem Vollabgleich. Er entfernt ihn bei Fehler und Dienststart;
fehlende, unpassende oder unlesbare Inhalte erzwingen ebenfalls den Vollabgleich. Darin stehen
Zeitpunkt, Clusterkennung und zuletzt geprüfter Wasserstand, keine Zugangsdaten. Die Datei ist
keine Archivquittung: Jeder Status liest den aktuellen Bedarf und Wasserstand aus PostgreSQL.
Ein Rücksprung der Uhr erzwingt den Vollabgleich. Die Laufzeiten kommen
zu den Pausen hinzu. Intervall, verpasste Zyklen und das daraus berechnete Alarmfenster bleiben
unverändert. Ein Einmallauf führt weiterhin genau einen Durchlauf aus. Eine Journalzeile
`WAL cycle` nennt Dauer in Sekunden, neu hochgeladene Segmente, abgeglichene Archive,
angeforderten Wechsel (0/1) und Exit-Status. Zusätzlich nennt sie die Dauer der Phasen
`database_seconds`, `archive_list_seconds`, `base_seconds`, `upload_seconds`,
`reconcile_seconds` und `lock_seconds`, auch bei Fehlern. Die Phasen sind disjunkte
Ablaufabschnitte in ganzen Sekunden: Datenbank umfasst lokale Vor-/Nachprüfung und Status,
Basis/Hochladen/Abgleich schließen ihre jeweiligen SQL-Aufrufe ein; Sperrwartezeit steht
separat. Die Zeile enthält weder Speicherpfade noch Adressen.

Basissicherung und Archivierer halten dieselbe Borg-Sperre. Solange die Sicherung läuft oder
auf diese Sperre wartet, pausiert der Wächter die WAL-Altersprüfung für höchstens zehn Minuten
(feste Konstante, keine neue Einstellung). Danach meldet er `WAL-Archivierung steht`, auch
bei frischem Status ohne offene Anforderung. Der Beginn folgt dem Verlassen des inaktiven
Zustands der Sicherungseinheit (`InactiveExitTimestamp`); ein `oneshot` ist während
`ExecStart` einschließlich Sperrwartezeit noch `activating`. Nach dem Ende
(`InactiveEnterTimestamp`, auch bei Abbruch) gilt einmalig eine Nachholfrist von
`WAL_ARCHIVE_CATCHUP_SECONDS` (Standard 300 s, zulässig 1–600 s). Für Herzschlag und Datenalter
ist die Frist das spätere Ende aus normalem Altersfenster und Sicherungsende plus Nachholzeit.
Die 120 s des normalen Fensters werden nicht auf die Nachholzeit addiert. Bei einer alten
offenen Anforderung gibt es nach 299 s keinen Alarm, nach 301 s einen. Weitere Wächterläufe
verlängern diese Frist nicht; neuere Anforderungen behalten mindestens ihr normales Fenster. Ein fehlender oder
fehlgeschlagener Archivstatus und eine Lücke bleiben nach der Sicherung Fehler. Der Monitor
liest die Einheitsdaten über die lokale systemd-Verbindung; sein Sandboxprofil erlaubt dafür
`AF_UNIX`. Die Sicherungshäufigkeit bleibt unverändert.

Im laufenden Takt beginnt die Kettenprüfung bei der in PostgreSQL bestätigten Wassermarke
der aktuellen verifizierten Basis: Geprüft werden Anschluss und Lückenfreiheit der neuen
Archive, danach ihre Quittung und Fortschreibung. Bei registrierter Quittung entfällt eine
weitere `borg info`-Abfrage: Die Quittung entstand erst nach bytegenauem Read-back. Ohne
Quittung bleibt der Read-back über `archived_checksum` unverändert. Bereits bestätigte Vorgänger werden dabei
nicht einzeln erneut abgefragt. Ohne eine Marke für diese Basis (auch nach Basiswechsel oder
Restore) wird vollständig ab Basis geprüft. Ein fehlender Anschluss oder eine Lücke erzwingt
ebenfalls diese vollständige Prüfung; eine verbleibende Lücke bleibt ein Fehler. Die tiefe
Prüfung durch `taptime-restore-verify` bleibt unverändert. Der Vollabgleich inventarisiert die
Archivnamen; er ersetzt weder die Wiederherstellungsprüfung noch die Aufbewahrung. Im reinen
Leerlauf kann eine neue externe Störung erst beim nächsten Vollabgleich auffallen (standardmäßig
bis zu 15 Minuten zuzüglich Laufzeit); neuer Archivbedarf löst die Prüfung sofort aus.

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
Minute nach vollständig erfolgreicher API- und WAL-Prüfung beziehungsweise erfolgreich
zugestelltem Erstalarm einen leeren `HEAD` an die geheime Ping-URL. Schlägt die Alarmzustellung
fehl, unterbleibt das Lebenszeichen. Nur der Übergang auf *Down* löst einen
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
Auf dem bestehenden Produktionsserver sind alle Timer bereits aktiviert. WAL-Empfänger und
Archivierer sind dauerhafte Dienste, keine Timer. Auf einem
Ersatzserver werden sie nach dem ersten erfolgreichen Deploy einmalig aktiviert:

```sh
systemctl enable --now taptime-wal-receiver.service taptime-wal-archiver.service
systemctl enable --now taptime-backup.timer taptime-restore-verify.timer
systemctl enable --now taptime-immediate-monitor.timer taptime-daily-monitor.timer
systemctl list-timers 'taptime-*'
systemctl start taptime-immediate-monitor.service
systemctl start taptime-daily-monitor.service
systemctl is-active taptime-wal-receiver.service taptime-wal-archiver.service
```

Meldungstests verwenden ausschließlich kontrollierte Statusdateien beziehungsweise einen
kurzen API-Stopp. Geheim-URLs werden dabei weder ausgegeben noch als Argument übergeben. Nach
jeder Prüfung müssen API, WAL-Archivstatus, Restore-Status, Dienste und alle Timer wieder grün
sein.
