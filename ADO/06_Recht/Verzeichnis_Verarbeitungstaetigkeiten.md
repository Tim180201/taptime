# Verzeichnis von Verarbeitungstätigkeiten

**nach Art. 30 Abs. 2 DSGVO — als Auftragsverarbeiter**

> **Entwurf des Technical Lead, keine Rechtsberatung.** Zur Prüfung durch einen Fachanwalt bestimmt.
> **Stand 22.10.2026 · Systemstand: Migration 062, bis T-104c**
> Beschrieben ist der gebaute Repository-Stand einschließlich der noch auszuliefernden Änderungen
> für Deploy 8 und neuer App-Builds. Dies ist kein Nachweis des Produktionsstands.

## 1. Parteien und Zuständigkeit

| | Angabe |
|---|---|
| Auftragsverarbeiter | Einzelunternehmen des Product Owners Tim Bartz (D-116); Geschäftsbezeichnung `[ergänzen]` |
| Anschrift und Kontakt | `[Anschrift, E-Mail, Telefon ergänzen]` |
| Datenschutzbeauftragte Person | `[Bestellungspflicht und gegebenenfalls Kontakt fachanwaltlich klären]` |
| Verantwortliche | Jeweiliges Kundenunternehmen; dessen Betrieb ist im System eine Organisation |

Der Verantwortliche bestimmt Zweck, berechtigte Personen und zulässige Inhalte. Diese Vorlage
ersetzt weder seinen eigenen Eintrag im Verzeichnis noch eine Information seiner Kunden.
Betroffene sind Beschäftigte einschließlich administrativ Tätiger **und Kunden des Verantwortlichen**,
soweit ihre Bezeichnung oder die zugeordneten Zeiten Personen erkennen lassen. In einem
Nachhilfebetrieb können dies Schüler und Minderjährige sein; die Software ist branchenunabhängig.

## 2. Verarbeitungstätigkeiten

### 2.1 Arbeitszeiten und betriebliche Zuordnung

**Zweck:** Arbeitszeiten erfassen, nachtragen, berichtigen, prüfen und auswerten; Kundeneinsätze
zuordnen und Kontingente anzeigen; Daten für die Abrechnung durch den Verantwortlichen exportieren.

| Datenart | Inhalt |
|---|---|
| Identität und Zugang | Anzeigename, im Anmelde-/Einladungsweg E-Mail, Anbieterkennung (`issuer`, `subject`), Benutzer- und Mitgliedschaftskennung, Rolle, Anlage und Entzug des Zugangs |
| Standorte und Ziele | Standorte mit Bezeichnung, Heimat-, Arbeits- und Verwaltungszuordnungen mit Verlauf; Kunden, Projekte und Allgemeine Arbeitszeit; Kartenkennung und zeitliche Kartenzuordnung |
| Kunden des Verantwortlichen | Name/Bezeichnung, optionales Monatskontingent, Zuordnung zu Mitarbeitern samt Beginn, Ende und handelnder Person; Zeiten und Summen je Kunde und Person |
| Arbeitszeit und Pause | Beginn, Ende, Pausenintervalle, Ziel, zugeordneter betrieblicher Standort und Herkunft (Karte, manuell, nachgetragen, Verwaltung, Sperrbildschirm) |
| Änderungen und Freitext | Original und Revisionen, Stornierungen, Kommentare mit früheren Fassungen, Gründe, Urheber und Zeitpunkt; Namensänderungen mit altem und neuem Namen |
| Prüfungen | Ungeklärte Erfassungen, Prüfgrund, Plausibilitätsbefunde, Entscheidung und gegebenenfalls daraus entstandene Zeitkorrektur |
| Anmeldestand | Erste und letzte erfolgreiche Sitzungsabfrage je Mitgliedschaft; in der Zugangsverwaltung als Anmeldestand angezeigt, kein vollständiges Anmeldeprotokoll |
| Offline-Belege | Installations- und Ereigniskennungen, Sequenz, Erfassungszeit, fortlaufende Geräteuhr und Bootbeleg, Freigaben, Übertragungs-, Archivierungs- und Quarantänestatus |
| Archiv | Ehemalige Mitarbeiter sowie deaktivierte Kunden und Projekte mit ihrer erhaltenen Historie und ihren Zeiten |

Eigene Zeiten können ohne Grund nachgetragen oder geändert werden. Ein Grund ist bei fremden
Zeiten für die Standortleitung Pflicht, beim Administrator freiwillig; Löschen bedeutet Stornieren
und verlangt keinen Grund. Prüfentscheidungen haben eigene Begründungsregeln. Freiwillige
Kommentare bleiben möglich. Ein korrigierter, nachgetragener oder in einer Prüfentscheidung
festgelegter Zeiteintrag dauert höchstens 24 Stunden und endet nicht in der Zukunft;
das ist eine Plausibilitätsprüfung, keine Tagesfreigabe.

Besondere Kategorien personenbezogener Daten sind fachlich nicht vorgesehen. Namen, Kommentare
und Gründe sind aber Freitext und können sensible Angaben enthalten; eine automatische
Inhaltskontrolle oder Anonymisierung ist nicht implementiert. Kein GPS und keine laufende Ortung:
Standort- und Kartenzuordnungen können gleichwohl Rückschlüsse auf Einsatzorte ermöglichen.
Die heutige Kartenkennung liefert keinen kryptografischen Anwesenheitsnachweis.

**Zugriff innerhalb des Betriebs:** Mitarbeiter lesen eigene Zeiten und die für sie sichtbaren
Arbeitsziele. Administratoren verwalten den Betrieb, Standortleitungen ihren zugewiesenen Bereich;
sie können dort auch Zeiten anderer Rollen sehen und bearbeiten. Kundenzuordnungen sind
Sortierhilfen, keine zusätzliche Zugriffssperre. Die Kundensicht zeigt Mitarbeitern eigene
Stunden, der Verwaltung die Stunden in ihrem zulässigen Bereich. Archivlesen hat keine eingebaute
Aufbewahrungsfrist; die Bearbeitung ausgeschiedener Personen bleibt zeitlich beschränkt.
Der Verantwortliche kann CSV-Dateien an seine Lohnbuchhaltung oder Steuerberatung weitergeben.

### 2.2 Anmeldung, Einladung und Wiederherstellung

Die Anmeldung mit E-Mail und Passwort erfolgt direkt zwischen Endgerät und Supabase. Das Passwort
und sein Prüfwert werden nicht in der Produktdatenbank gespeichert. Dort werden Anbieteridentität
und Mitgliedschaft verknüpft. Einladungen verarbeiten Namen und E-Mail; Befehlsbelege enthalten
unter anderem einen E-Mail-Fingerabdruck und zugeordnete Kennungen. Der Server stößt
Einladungen über Supabase an; Supabase versendet die Anmelde- und Rücksetzmails über Brevo (D-057).
Passwörter werden über die Webseite gesetzt, nicht über ein eigenes Recovery-Schema der App.
Anbieter verarbeiten auch Verbindungsdaten wie IP-Adressen; ihre tatsächlichen Protokollfristen
sind vor Vertragsschluss zu klären.

### 2.3 Betriebsdiagnosen und Einladungsnachweis

**Zweck:** Verfügbarkeit und Störungen erkennen sowie Anbieteraufrufe beim Einladen und Fälle
mit Handlungsbedarf nachvollziehen.

Die JSON-Diagnose enthält `timestamp`, `error_class`, `correlation_id` und gegebenenfalls `route`.
Bei `account_invitation_provider_request` und `account_invitation_needs_attention` können
`organization_id`, `administrator_membership_id`, `operator_id`, `target_account` und `reason`
hinzukommen. Kennungen werden nur im UUID-Format, Gründe aus einer festen Auswahl übernommen.
`target_account` bezeichnet gegebenenfalls das Anbieterkonto; ein E-Mail-Fingerabdruck wird vom
heutigen Logschreiber nicht übernommen. Diese Kennungen ermöglichen Personenbezug.
Namen, E-Mail im Klartext, Kundenbezeichnungen, Zeitinhalte, Token und Anfragekörper werden vom
eigenen Diagnoseschreiber nicht ausgegeben. Das gilt nicht als Zusage für sämtliche Dienstlogs.
Die journald-Konfiguration begrenzt Journale auf 14 Tage und insgesamt 256 MiB; Speichergrenzen
können die Vorhaltezeit verkürzen. Datenbank-Audits sind davon getrennt und haben noch keinen Löschweg.

### 2.4 Plattformbetrieb und Paketverwaltung

Der getrennte Betreiber-Bereich dient dem Anlegen, Pausieren und Fortsetzen von Betrieben sowie
der Paketverwaltung und Betriebsprüfung. Er liefert Betriebsname und -kennung, Status,
Anlagezeit, Anzahlen je Rolle, laufender Zeiten, Karten, Zuordnungen und offener Einladungen,
letzten Erfassungszeitpunkt sowie Paketgröße, aktive Zugänge und Monatshöchstwerte. Dazu kommen
Betriebszustand, Datenbankgröße und Versionsangabe. Diese Aggregate sind keine Zusage von Anonymität,
insbesondere bei kleinen Betrieben.

Er liefert keine Liste von Beschäftigtennamen, E-Mails oder einzelnen Arbeitszeiten. Beim
Anlegen verarbeitet der Betreiber jedoch selbst eingegebenen Namen und E-Mail des ersten
Administrators. Das eigene Betreiber-Protokoll hält Akteurkennung bzw. Root-Prinzipal, Betrieb,
Befehl, Aktion, Grund und Zeitpunkt sowie Paketgröße vor/nach Änderung fest; seine Leseansicht
zeigt eine reduzierte Akteurangabe. Betreiberidentitäten sind von aktiven Mitgliedschaften
getrennt; Aktionen außer der Sitzungsabfrage verlangen den zweiten Faktor. Technischer
Root-Zugriff für den Betrieb kann Daten erreichen und ist von dieser Oberflächengrenze zu unterscheiden.

### 2.5 Anzeige und Aktionen auf dem Sperrbildschirm

Android zeigt eine öffentlich sichtbare laufende Benachrichtigung, das iPhone eine Live-Aktivität
auf Sperrbildschirm und gegebenenfalls Dynamic Island: **Zielname, Zustand und Dauer** sind
außerhalb der App lesbar. Wer das Handy sieht, kann damit beispielsweise den Namen eines Kunden
oder Schülers sehen. Pause, Fortsetzen und Beenden können ohne Entsperren ausgelöst werden;
der Verlauf kennzeichnet die Herkunft. Es gibt darüber keinen Start einer neuen Arbeitszeit.
Diese Sichtbarkeit ist die bewusste Produktentscheidung D-147 und vom Verantwortlichen für
seinen Einsatz zu bewerten und den Betroffenen mitzuteilen.

Der Server speichert nur den Hash des Sperrbildschirm-Schlüssels samt Bindung an Betrieb,
Person, laufende Zeit und gegebenenfalls Installation, Ablauf und Nutzungszustand. Gültigkeit:
höchstens 24 Stunden und nur solange die Zeit und Berechtigung fortbestehen. Beim Ausstellen
werden Datensätze, deren Ablauf mehr als sieben Tage zurückliegt, mit ihren temporären
Befehlsbelegen entfernt; dies ist kein allgemeines Löschkonzept für Arbeitszeiten.
Android speichert Zustand und Schlüssel verschlüsselt mit einem Schlüssel im Android Keystore.
Am iPhone liegt der Aktionsschlüssel getrennt im gerätegebundenen Schlüsselbund, nach dem ersten
Entsperren nutzbar; der Anzeigezustand liegt in einer geschützten, vom Backup ausgeschlossenen
Datei. Die normale Anmeldung bleibt nur bei entsperrtem Gerät zugänglich. Die Live-Aktivität
wird lokal aktualisiert; ein Push-Dienst ist in diesem Weg nicht eingebunden.

## 3. Rechtsrahmen und Weisungen

Die Auftragsverarbeitung ist vertraglich nach Art. 28 DSGVO zu regeln. Rechtsgrundlage,
Erforderlichkeit, Aufbewahrung und Informationspflichten für Beschäftigten- und Kundendaten
legt der Verantwortliche mit seinem Rechtsbeistand fest. Keine Verwendung für Werbung,
Datenverkauf oder Modelltraining ist im beschriebenen Produktablauf vorgesehen.

## 4. Dienstleister, Orte und offene Vertragsangaben

| Anbieter | Leistung und übermittelte Daten | Ort / Vertragsstand |
|---|---|---|
| Hetzner Online GmbH | Server mit Anwendung und PostgreSQL, fachliche Daten | Nürnberg, Deutschland (PO bestätigt 22.10.2026); AVV noch nicht abgeschlossen (PO, 22.10.2026) |
| Hetzner Online GmbH | Aktive Cloud-Backups der gesamten Server-Systemplatte einschließlich Datenbank, Konfiguration und Zugangsdaten; tägliche Rotation, höchstens sieben Tage bei fortlaufend täglicher Erstellung | Nürnberg, Deutschland, meist anderes Rechenzentrum am selben Standort; PO bestätigt 22.10.2026 und Hetzner-FAQ; AVV noch nicht abgeschlossen (PO, 22.10.2026) |
| Hetzner Online GmbH | Storage Box mit verschlüsselten Datenbank- und WAL-Archiven, gegebenenfalls Schnappschüssen | Falkenstein, Deutschland (PO bestätigt 22.10.2026); AVV noch nicht abgeschlossen (PO, 22.10.2026) |
| Supabase | Anmeldung, Sitzungen, Einladung/Reset; E-Mail, Authentifizierungs- und Verbindungsdaten | Central EU (Frankfurt), `eu-central-1` (PO bestätigt 22.10.2026); US-Mutter, Drittlandfrage D-006 offen; AVV noch nicht abgeschlossen (PO, 22.10.2026) |
| Brevo über Supabase | SMTP-Versand von Einladung, Wiederherstellung und weiteren Anmeldemails; Empfängeradresse und Mailinhalt/Link | Versandweg nach D-057; AVV noch nicht abgeschlossen (PO, 22.10.2026); tatsächliche Verarbeitungsorte und Unterauftragnehmer vertraglich prüfen |
| ntfy.sh | Feste Störungstexte und technische Zustellungsdaten, keine Beschäftigten-/Kundeninhalte im Nachrichtenrumpf | Betreiberkonto, Metadaten, Ort und Vertragsbedarf prüfen |
| healthchecks.io | Lebenszeichen per HTTP HEAD ohne Nutzdatenrumpf, Verbindungsdaten und Prüfkennung | Betreiberkonto, Metadaten, Ort und Vertragsbedarf prüfen |
| GitHub / GHCR | Quelltext, CI, Container-Abbilder; im vorgesehenen Ablauf ohne Endnutzerdaten | Entwicklungs-/Lieferdienst; keine fachlichen Produktdaten übertragen |

Die drei Standorte sind vom PO am 22.10.2026 bestätigt. Mit Hetzner, Supabase und Brevo
ist nach seiner Bestätigung noch kein AVV abgeschlossen; diese Verträge sind Voraussetzung
vor den ersten echten Daten (D-116). Die Zulässigkeit möglicher Drittlandzugriffe und erforderliche
Garantien sind vor Vertragsschluss fachanwaltlich zu klären. Es wird keine ausschließlich europäische Verarbeitung
und keine Abwesenheit von Drittlandübermittlungen zugesagt. Auch reine Betriebsdienste erhalten
Netzwerkmetadaten; daraus folgt keine pauschale Aussage „ohne Personenbezug“.

## 5. Speicherung, Löschung und Sicherungen

**Ist-Stand:** Für fachliche Daten gibt es keine implementierten Löschklassen, keine konfigurierbaren
Fristen und keinen durchgängigen Lösch-/Auskunftsweg (T-016/B23). Zugang entziehen, Kunden oder
Projekte deaktivieren und Zeiten stornieren erhält die Historie. Auch abgelaufene oder eingelöste
Einladungen werden nicht automatisch gelöscht; bestehende Einladungs- und Befehlsbelege sind
gegen Löschen geschützt. Ein Supabase-Konto wird durch Zugangsentzug nicht entfernt.

**Ziel mit T-016:** Der Verantwortliche legt die rechtlich geprüften Fristen je Datenart fest.
Die mindestens zweijährige Aufbewahrung bestimmter Arbeitszeitnachweise ist eine gesetzliche
Untergrenze, keine heute ausgeführte Löschfrist; siehe [§ 16 Abs. 2 ArbZG](https://www.gesetze-im-internet.de/arbzg/__16.html).
Weitere arbeits-, steuer- und kundendatenbezogene Fristen bleiben zu prüfen. Rückgabe, Auskunft,
Löschung oder Einschränkung auf Weisung brauchen einen umsetzbaren Ablauf vor echter Nutzung;
die technische Umsetzung und der Umgang nach Vertragsende sind offen.

**Sicherungen:** Stündliche physische Basissicherung und fortlaufende externe WAL-Archivierung
mit Borg. Standardkonfiguration: 24 stündliche, 14 tägliche, 8 wöchentliche und 6 monatliche
Basen nach den `BASE_BACKUP_KEEP_*`-Regeln. Das sind Auswahlregeln, keine garantierte Höchstdauer.
Aufgeräumt wird nur mit erhaltener geprüfter Basis und gültigem Inventar; ausgesetzte oder
fehlgeschlagene Läufe verlängern die Speicherung. WAL bleibt erhalten, soweit es die behaltenen
Basen benötigen; verwaiste Marker und entbehrliches WAL werden danach entfernt und Borg kompaktiert.

**Hetzner Cloud Backups (PO bestätigt 22.10.2026):** Für `taptime-prod` sind zusätzlich tägliche
Kopien der gesamten Server-Systemplatte aktiv, derzeit gegen 10:45 UTC, je etwa 2,5 GB.
Sie enthalten Datenbank, Konfiguration und Zugangsdaten. Hetzner hält sieben Plätze vor und
entfernt beim Erstellen einer weiteren Kopie die älteste: bei fortlaufend täglicher Rotation
höchstens sieben Tage Aufbewahrung. Dies ist eine Rotation nach neuen Kopien, keine davon
unabhängige Alterslöschung. Der PO verwaltet die Einstellung, Hetzner erstellt und rotiert die
Kopien automatisch. Sie liegen in Nürnberg, meist in einem anderen Rechenzentrum desselben
Standorts. **Hetzner Cloud Snapshots sind laut PO nicht vorhanden.** Anbieterregeln:
[Hetzner-FAQ](https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/).
Die Borg-Verschlüsselung schützt dessen eigene Archive; die Cloud-Plattenkopie erfasst auch
die auf der Serverplatte liegenden Zugangsmittel. Ein geprüfter Datenbank-Restore aus dieser
zusätzlichen Sicherung ist damit nicht nachgewiesen.

Automatische Storage-Box-Schnappschüsse rotieren nach Anbieter-Einstellung. Manuelle monatliche
Schnappschüsse und Schnappschüsse vor größeren Änderungen bleiben bis zur Entscheidung des PO;
es gibt keine dokumentierte Höchstfrist. Alte logische Archive außerhalb der heutigen
Prune-Auswahl werden nur nach Einzelauftrag anhand exakter Archivnamen entfernt. Weder hier
noch bei manuellen Schnappschüssen ist ein automatischer Ablauf nach sechs Monaten belegt.
Diese Storage-Box-Regeln betreffen eine andere Sicherungsebene als die Cloud-Backups und die
laut PO nicht vorhandenen Cloud Snapshots.

Die Borg-Passphrase liegt für den automatischen Betrieb auf dem Server in einer root vorbehaltenen
Datei mit Modus 0600; Schlüssel/Passphrase werden zusätzlich getrennt beim PO verwahrt. Das schützt
den Inhalt auf dem Sicherungsspeicher, verspricht aber keinen Schutz bei vollständiger Übernahme
des Servers samt Zugangsmitteln. Nach einer künftigen Löschung in der Produktdatenbank können
Kopien in Sicherungen verbleiben; Fristen, Sperre der Nutzung und erneute Löschung nach einem
Restore sind mit T-016 zu regeln. Die derzeit gescheiterte Wochenprobe wegen Platzmangels
(T-132) und die Wiederanlaufgrenze bei verlorener Offline-Freigabe (T-055) bleiben offen.

## 6. Maßnahmen und Pflege

Die TOM und offenen Maßnahmen stehen in [AVV_Anlagen.md](AVV_Anlagen.md).
Der TL verantwortet den Inhalt dieser Vorlage, Development pflegt sie im beauftragten Scope;
der PO ergänzt Betriebs-/Vertragsnachweise und veranlasst die fachanwaltliche Prüfung.
Abgelöste Fassungen werden in Git erhalten; dies ist kein neuer betrieblicher Datenspeicher.
