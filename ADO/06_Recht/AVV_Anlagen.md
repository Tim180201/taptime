# Anlagen zum Auftragsverarbeitungsvertrag

> **Entwurf des Technical Lead, keine Rechtsberatung.** Zur Prüfung durch einen Fachanwalt bestimmt.
> **Stand 22.10.2026 · Systemstand: Migration 062, bis T-104c**
> Beschrieben ist der gebaute Repository-Stand einschließlich Deploy 8 und neuer App-Builds,
> nicht ein Nachweis ihrer Auslieferung. Noch offene Maßnahmen werden ausdrücklich benannt.

Auftragsverarbeiter: Einzelunternehmen des PO Tim Bartz (D-116), `[Geschäftsbezeichnung,
Anschrift und Kontakt ergänzen]`. Verantwortlicher: `[Kundenunternehmen, Anschrift, Kontakt]`.
Betroffen sind Beschäftigte und, soweit identifizierbar, Kunden des Verantwortlichen,
gegebenenfalls minderjährige Schüler. Freitext ist nicht auf unsensible Inhalte begrenzt.

## Anlage 1 · Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

### 1.1 Vertraulichkeit und Berechtigungen

**Verarbeitungsorte (PO bestätigt 22.10.2026):** Hetzner-Server Nürnberg, Deutschland; Storage Box
Falkenstein, Deutschland; Supabase Central EU (Frankfurt), `eu-central-1` (US-Mutter; D-006 offen).
Für Hetzner, Supabase und Brevo gilt jeweils: AVV noch nicht abgeschlossen (PO, 22.10.2026).
Der Abschluss ist Voraussetzung vor den ersten echten Daten (D-116).
Verträge, Unterauftragnehmer und mögliche Drittlandzugriffe bleiben vor Nutzung zu prüfen;
eine pauschale Zusage zur ausschließlichen Verarbeitung in Deutschland/EU wird nicht gemacht.

**Zugang:** Die Anmeldung erfolgt direkt bei Supabase; das Produkt verwahrt keinen
Passwort-Prüfwert. Einladungen veranlasst das Backend, E-Mails versendet Supabase über Brevo.
Die App nutzt für Refresh-Token und bestätigte Identität den gerätegebundenen SecureStore,
unter iOS nur bei entsperrtem Gerät. Passwortsetzen und Wiederherstellung laufen über die
Webseite. Die gemeinsame Client-Mindestlänge ist zehn Zeichen; korrespondierende
Supabase-Einstellungen und der Schutz vor geleakten Passwörtern ab Pro sind PO-Schritte (D-139/D-130).
Eine bereits vollzogene Dashboard-Umstellung wird hier nicht bestätigt.

Der Server hat einen beschränkten SSH-Deploy-Zugang; Root-Betriebsarbeiten erfolgen nach Runbook
über die Hetzner-Konsole. Die Server-Compose-Datei veröffentlicht nur Caddys HTTP-/HTTPS-Ports;
die Datenbank hat keinen Host-Port und liegt im internen Netz. Dies ersetzt keine Prüfung der
Produktionsfirewall. API-Ratenbegrenzung nutzt eine vertrauenswürdige Proxy-Adresse nur mit
Proxy-Geheimnis; die direkte Supabase-Anmeldung hat eigene Anbietergrenzen.
Verwaltung und Betreiber-Web haben eine Content-Security-Policy mit beschränkten Quellen.

**Mandantentrennung:** Jede Anwendungstabelle im Schema `taptime_server` hat RLS aktiviert und
erzwungen. Das prüft `B3SchemaSecurity.test.ts` mit „enables and forces RLS on every logical table“.
Laufzeitrollen haben begrenzte Rechte; der Request-Kontext wird transaktionslokal gesetzt und
mit Tests über Commit, Rollback und wiederverwendete Verbindungen geprüft. Geprüfte
`SECURITY DEFINER`-Funktionen dürfen mit eigenen, nicht anmeldbaren Eigentümerrollen RLS umgehen;
sie müssen die Berechtigung selbst prüfen. `B3SchemaSecurity.test.ts`, Abschnitt
„T119 catalog-wide security invariants“, prüft alle solchen Funktionen auf festen Suchpfad,
Eigentümer und Aufrufrechte sowie alle Mandanten-Policies auf Bindung oder exakt dokumentierte Ausnahme.
Eine policylose, für Laufzeitrollen gesperrte Tabelle ist nicht pauschal eine Schutzlücke.

Administrator: ganzer Betrieb; Standortleitung: zugewiesener Verwaltungsbereich, dort auch
Zeiten anderer Rollen; Mitarbeiter: eigene Zeiten und sichtbare Arbeitsziele. Befugnisse werden
serverseitig aus aktuellen Mitgliedschaften und Zuständigkeiten ermittelt. Der letzte aktive
Administrator ist gegen Entzug/Herabstufung geschützt. Archivzugriff folgt dem zulässigen Bereich;
Kundenzuordnungen sind keine weitere Berechtigungsgrenze.

**Plattformbetreiber:** Getrennter Zugang ohne aktive Betriebsmitgliedschaft, zweiter Faktor
für Aktionen außer der Sitzungsabfrage, eigene Datenbankfähigkeit. Sichtbar sind Betriebsdaten,
Aggregate, letzter Erfassungszeitpunkt, Paketgröße/-nutzung und Betriebszustand, keine Liste
einzelner Beschäftigtenzeiten oder bestehender Beschäftigtennamen/E-Mails. Beim Anlegen werden
Name und E-Mail des ersten Administrators verarbeitet. Betreiberaktionen und Abrufe werden
in einem eigenen unveränderlichen Protokoll mit Akteur, Aktion, Betrieb, Zeitpunkt, gegebenenfalls
Grund und Paketänderung festgehalten. Auch Aggregate kleiner Betriebe können Personenbezug haben.
Technischer Root-Zugriff ist von den Grenzen dieser Oberfläche zu unterscheiden.

### 1.2 Integrität und Übermittlung

- Caddy terminiert TLS, leitet HTTP auf HTTPS um und setzt HSTS. Einladungs-/Anmeldedaten laufen
  über getrennte Anbieterwege; Dienstleister siehe Anlage 2.
- Die mobile Warteschlange ist mit SQLCipher verschlüsselt und an Installation und Kontokontext
  gebunden. Schlüssel liegen getrennt in gerätegebundenem SecureStore.
- Arbeitsereignisse, Entscheidungen, Revisionen, Kommentarverlauf und Stornierungen bewahren die
  ursprüngliche Historie. Nicht jeder Hilfsdatensatz ist unveränderlich: Anmeldestand,
  Übertragungszustand und kurzlebige Sperrbildschirm-Belege werden aktualisiert bzw. bereinigt.
- Korrekturen nennen Urheber und Zeitpunkt. Eigene Änderungen/Nachträge brauchen keinen Grund;
  bei fremden Zeiten verlangt ihn die Standortleitung, der Administrator kann ihn weglassen.
  Stornieren braucht keinen Grund; Prüfentscheidungen haben eigene Regeln. Originale bleiben erhalten.
- Die Namensänderung eines Zugangs protokolliert alten und neuen Namen. Kunden-/Projektzuordnungen
  speichern Anlage und Ende samt handelnder Person. Archivieren ersetzt keine Löschung.
- Ein korrigierter, nachgetragener oder in einer Prüfentscheidung festgelegter Zeiteintrag
  dauert höchstens 24 Stunden und endet nicht in der Zukunft. Doppelte Befehle werden
  serverseitig idempotent behandelt.

### 1.3 Anzeige außerhalb der App — bewusste Abwägung (D-147)

Die öffentlich sichtbare Android-Benachrichtigung bzw. die iPhone-Live-Aktivität zeigt Zielname,
Zustand und Dauer auf dem gesperrten Gerät; am iPhone auch in der Dynamic Island.
Umstehende können Kunden-/Schülernamen lesen. Pause, Weiter und Beenden sind ohne Entsperren
möglich und werden als manuelle Ereignisse mit Sperrbildschirm-Herkunft verarbeitet.
Diese Sichtbarkeit ist bewusst vorgesehen, keine als Fehler behandelte Lücke. Der Verantwortliche
muss sie bei seiner Einsatzentscheidung berücksichtigen und Betroffene informieren.

Der gesonderte Aktionsschlüssel ist auf die laufende Zeit und diese Aktionen beschränkt,
höchstens 24 Stunden gültig und endet fachlich mit Zeit oder Berechtigung. Serverseitig wird
nur sein Hash gespeichert. Android verschlüsselt Zustand und Schlüssel mit einem Keystore-Schlüssel.
iOS hält den Schlüssel getrennt im Schlüsselbund, nach erstem Entsperren auf diesem Gerät nutzbar;
der Zustand liegt in einer geschützten Datei ohne Backup. Der Schlüssel gelangt nicht in die
Live-Aktivität/Erweiterung. Die normale Anmeldung bleibt strenger geschützt und wird für diese
Aktionen nicht im gesperrten Zustand geöffnet. Die Anzeige wird lokal, ohne Push-Dienst aktualisiert.

### 1.4 Verfügbarkeit, Sicherungen und Container

Stündliche physische PostgreSQL-Basissicherungen und fortlaufende externe WAL-Archive bilden die
Wiederherstellungskette. Die sofortige App-Entscheidung und die externe Archivbestätigung sind
getrennt; erhaltene Offline-Zeilen werden erst nach passendem Archivnachweis entfernt.
RPO 0 für extern archivierte WorkEvents und RTO vier Stunden ab Alarm sind Betriebsziele nach D-051;
die offene Wiederaufnahmegrenze T-055 verhindert eine pauschale Zusage automatischer Wiederherstellung
jeder zuvor gezeigten Entscheidung. Nachträge/Korrekturen haben noch keinen eigenen externen
Archivnachweis vor ihrer Erfolgsmeldung (D-078).

Zusätzlich sind für `taptime-prod` **Hetzner Cloud Backups aktiv** (PO bestätigt 22.10.2026):
täglich derzeit gegen 10:45 UTC eine Kopie der gesamten Server-Systemplatte einschließlich
Datenbank, Konfiguration und Zugangsdaten, je etwa 2,5 GB. Sie liegen in Nürnberg, meist in
einem anderen Rechenzentrum desselben Standorts. Sieben Plätze rotieren automatisch; eine neue
Kopie verdrängt die älteste, bei fortlaufend täglicher Erstellung höchstens sieben Tage
Aufbewahrung. Der PO verwaltet die Einstellung. **Hetzner Cloud Snapshots gibt es laut PO nicht.**
Die Borg-Verschlüsselung schützt dessen eigene Archive; die Cloud-Plattenkopie enthält auch
die auf dem Server vorhandenen Zugangsmittel. Bei Sicherung eines laufenden Servers garantiert
Hetzner keine Datenkonsistenz; dieser Weg ist kein eigener Nachweis eines geprüften
Datenbank-Restores. Quelle: [Hetzner-FAQ](https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/).

Borg verschlüsselt die Sicherung auf der Storage Box. Die automatische Sicherung liest die
Passphrase aus einer root vorbehaltenen Datei mit Modus 0600 auf dem Server; Schlüssel und
Passphrase haben zusätzlich eine getrennt verwahrte Kopie beim PO. Das schützt den Inhalt beim
Speicheranbieter, nicht bei vollständiger Kompromittierung des Servers samt Zugangsmitteln.

Die Auswahlregeln der Standardkonfiguration behalten 24 stündliche, 14 tägliche, 8 wöchentliche
und 6 monatliche Basen. Prune läuft nur mit sicher beibehaltener geprüfter Basis und gültiger
Vorschau; benötigtes WAL bleibt erhalten, anschließend werden obsolete Archive entfernt und
Borg kompaktiert. Das garantiert keine maximale Speicherdauer. Manuelle Storage-Box-Schnappschüsse
haben keine beschlossene Höchstfrist; ihre Löschung entscheidet der PO. Logische Alt-Archive
fallen aus der aktuellen Prune-Auswahl und werden nur auf Einzelauftrag entfernt.
Automatische Schnappschüsse rotieren nach Anbieter-Einstellung. Einzelheiten: `infrastructure/RESTORE.md`.
Die Storage-Box-Schnappschüsse gehören zur dort beschriebenen Borg-Speicherebene; die zusätzlichen
Cloud-Backups haben die oben genannte tägliche Rotation. Ausbleibende neue Cloud-Backups lösen
nach der Anbieterregel keine altersabhängige Löschung der vorhandenen Kopien aus.

Die Wochenprobe stellt eine Basis und WAL in einer gesonderten Prüf-Umgebung wieder her und
prüft unter anderem Migrationen, Rollen, Datenbestand und RLS. Die Produktivprobe scheiterte
zuletzt am Platz im tmpfs; T-132 ist offen. Feste Störungstexte gehen an ntfy.sh;
healthchecks.io erhält ein Lebenszeichen per HEAD ohne Nutzdatenrumpf. Verbindungsmetadaten
fallen trotzdem an. Die technischen Prüfungen ersetzen keine Geräteabnahme durch den PO.

| Dienst in `docker-compose.server.yml` | Tatsächlich konfigurierte Härtung |
|---|---|
| `backend-api` | schreibgeschütztes Root-Dateisystem, temporäres `/tmp`, alle Capabilities entfernt, `no-new-privileges` |
| `migration` (nur Deploy-Profil) | läuft ausdrücklich als root, schreibgeschütztes Root-Dateisystem, temporäres `/tmp`, alle Capabilities entfernt, `no-new-privileges` |
| `caddy` | schreibgeschütztes Root-Dateisystem und temporäres `/tmp`, `no-new-privileges`; beschreibbare Daten-/Konfigurationsvolumes, kein `cap_drop: ALL` |
| `database` | beschreibbare Daten-/WAL-Volumes; kein `read_only`, kein `cap_drop`, kein `no-new-privileges` konfiguriert |

### 1.5 Prüfung und Datenminimierung

Codeänderungen durchlaufen die automatisierte CI-Prüfstrecke; Aufgaben mit Mandanten-/Auth-/
Personendatenbezug zusätzlich ein unabhängiges Review. Dokumentationsänderungen können CI
überspringen. Migrationsprüfsummen erkennen veränderte bereits angewendete Migrationen.
Betriebsgeheimnisse sind nach Runbook in zugriffsbeschränkten Dateien zu verwahren; der konkrete
Rotations-/Verwahrstand ist eine PO-Bestätigung, keine aus dem Quelltext abgeleitete Tatsache.

Die eigene Backend-Diagnose projiziert `timestamp`, `error_class`, `correlation_id`, optional
`route`; auf Einladungswegen zusätzlich erlaubte UUID-Kennungen (`organization_id`,
`administrator_membership_id`, `operator_id`, `target_account`) und einen festen `reason`.
Das ist gegebenenfalls personenbezogen. Zweck: Störungsbehebung und Nachweis von Anbieteraufrufen/
Klärfällen. Namen, E-Mails im Klartext, Kundeninhalte, Token und Anfragekörper werden dabei nicht
übernommen. journald ist auf 14 Tage/256 MiB begrenzt; Datenbank-Audits haben andere Lebenszyklen.

## Bekannte Lücken und offene Nachweise

| Thema | Wirkung / nächster Schritt |
|---|---|
| T-016/B23: Löschung, Auskunft und Aufbewahrung | Kein allgemeiner Löschweg, keine Löschklassen; Einladungen und Historien bleiben. Weisungs-/Vertragsende- und Restore-Verfahren umsetzen. |
| T-132: Platz für Sicherung/Restore, mit B12 | Letzte Wochenprobe gescheitert; wachsende Datenbank kann auch Sicherung betreffen. Messwerte, Lösung und erfolgreiche Wiederholungsprobe fehlen. |
| T-055: Offline nach Restore | Eine nicht archivierte Freigabe kann fehlen; erhaltene Gerätebelege spielen nicht zuverlässig automatisch wieder ein. |
| D-130/D-139: Supabase Pro und Passwortschutz | Schutz vor geleakten Passwörtern erst nach Pro und Aktivierung durch den PO; Dashboard-Stand nicht belegt. |
| Dienstabhängige Container-Härtung | Insbesondere Datenbank und Caddy haben nicht alle Schutzmerkmale der API, siehe Tabelle. |
| T-014: eigene Vorabumgebung | Lokale/CI-Prüfungen und Restore-Migrationsprobe bestehen; eine dauerhaft getrennte produktionsnahe Vorabumgebung ist nicht belegt. |
| Betriebs-/Vertragsnachweise | Orte, AVV, Drittlandprüfung, Ansprechpartner und Datenschutz-Meldeprozess vor echter Nutzung klären. |

CSP, der HTTPS-Weg für die Passwortwiederherstellung und die katalogweiten Rechte-/Policyprüfungen
sind gebaut und werden nicht weiter als die früheren pauschalen Lücken geführt.

## Anlage 2 · Dienstleister

Leistungen, Daten, Ortsangaben und Vertragsvorbehalte stehen in
[Verzeichnis_Verarbeitungstaetigkeiten.md](Verzeichnis_Verarbeitungstaetigkeiten.md), Abschnitt 4.
Der AVV muss Unterrichtung und Verfahren bei Änderungen der Unterauftragsverarbeiter regeln.

## Anlage 3 · Aufbewahrung und Auftragsende

Ist-Stand und Ziel mit T-016 siehe Verzeichnis, Abschnitt 5. Zugangsentzug und Stornieren sind
keine Erfüllung eines Löschauftrags. Rückgabe/Löschung, Fristen je Datenart, verbleibende Sicherungen
und das Verfahren nach Restore müssen vor einer entsprechenden Zusage feststehen.

## Anlage 4 · Unterstützung des Verantwortlichen

| Anliegen | Gebauter Stand / offene Arbeit |
|---|---|
| Auskunft | Zeitansichten und Export vorhanden; vollständiges Betroffenenauskunftsverfahren T-016 offen |
| Berichtigung | Nachtragen und Korrigieren mit Herkunft/Revisionen sowie Namensänderung vorhanden |
| Löschung/Einschränkung | Allgemeiner Betroffenenweg T-016 offen; Zugang entziehen pausiert keinen vollständigen Datenlebenszyklus |
| Datenübertragbarkeit | Versionierter CSV-Zeitexport vorhanden; Umfang/Anspruch und zusätzliche Datenarten fachanwaltlich prüfen |
| Datenschutzverletzung | Kontakt, unverzügliche Unterrichtung des Verantwortlichen und betrieblicher Meldeprozess vor Vertragsschluss festlegen |
| Folgenabschätzung | Dieses Verzeichnis und die TOM dienen der Zuarbeit; Bewertung obliegt dem Verantwortlichen |
