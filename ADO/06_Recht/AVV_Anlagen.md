# Anlagen zum Auftragsverarbeitungsvertrag

> **Entwurf des Technical Lead, keine Rechtsberatung.** Jede Maßnahme unten ist im Quelltext
> umgesetzt und geprüft — dies ist eine Beschreibung des Ist-Zustands, keine Absichtserklärung.
> Was fehlt, steht in Abschnitt „Bekannte Lücken". Zur Prüfung durch einen Fachanwalt bestimmt.
>
> **Stand:** 25.08.2026 · **Systemstand:** Migration 016, Aufgaben T-001 bis T-011

---

# Anlage 1 · Technische und organisatorische Maßnahmen (Art. 32 DSGVO)

## 1.1 Vertraulichkeit

### Zutrittskontrolle
Verarbeitung ausschließlich in Rechenzentren der Hetzner Online GmbH in Nürnberg
(Anwendung, Datenbank) und Falkenstein (Sicherungen). Beide in Deutschland, beide nach ISO 27001
zertifiziert. Eigene Hardware wird nicht betrieben.

### Zugangskontrolle
- Anmeldung über einen getrennten Authentifizierungsanbieter; das Produkt speichert **kein**
  Passwort und keinen Passwort-Prüfwert.
- Serverzugang ausschließlich über SSH mit Schlüsselpaar.
- Von außen erreichbar sind genau drei Ports: 22, 80, 443. Nachgewiesen durch vollständigen
  Scan über alle 65.535 Ports.
- Die Datenbank ist von außen **nicht** erreichbar; sie liegt in einem Docker-Netz ohne
  Außenverbindung.
- Häufigkeitsbegrenzung auf den öffentlichen Endpunkten. Die Herkunftsadresse wird nur
  akzeptiert, wenn die Anfrage ein 32-Byte-Geheimnis des Reverse Proxy mitführt; der Vergleich
  ist zeitkonstant.

### Zugriffskontrolle
- **Mandantentrennung auf Datenbankebene** durch PostgreSQL Row Level Security, aktiviert **und**
  erzwungen (`ENABLE` + `FORCE`) auf **30 von 30** Tabellen. Die Trennung greift damit auch
  gegenüber dem Tabelleneigentümer.
- Der Mandantenkontext wird **transaktionslokal** gesetzt. Dass er nicht auf wiederverwendete
  Verbindungen überspringt, ist nach Commit und nach Rollback getestet.
- **26 Isolationstests** für Lese- **und** Schreibzugriffe gegen eine echte PostgreSQL-Instanz.
- **Über 50 Datenbankrollen** nach dem Prinzip der geringsten Rechte. Rollen mit erweiterten
  Rechten sind anmeldeunfähig und besitzen ausschließlich ihre eigene Funktion.
- Berechtigungen werden **serverseitig** aus Zugehörigkeit und Rolle abgeleitet, niemals aus
  Angaben des Clients. Ein Zugangsentzug wirkt beim **nächsten Zugriff**, nicht erst bei der
  nächsten Anmeldung — auch bei noch gültigem Token.
- Die letzte Administrator-Zugehörigkeit einer Organisation kann weder entzogen noch herabgestuft
  werden; die Prüfung liegt in der Datenbank und ist gegen Wettläufe gesperrt.

### Trennungskontrolle
Jedes Kundenunternehmen ist eine eigene Organisation. Sämtliche Zugriffe sind auf die
Organisation der handelnden Person begrenzt; die Durchsetzung erfolgt in der Datenbank, nicht in
der Anwendung.

## 1.2 Integrität

### Weitergabekontrolle
- Transportverschlüsselung über TLS mit automatisch erneuerten Zertifikaten (Let's Encrypt).
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` auf allen Hosts.
- Unverschlüsselte Aufrufe werden dauerhaft auf HTTPS umgeleitet.
- Die Warteschlange der mobilen Anwendung ist auf dem Gerät mit SQLCipher verschlüsselt und an
  genau eine Identität gebunden.

### Eingabekontrolle
- **Fortlaufendes, unveränderliches Protokoll.** Arbeitsereignisse, Entscheidungen, Korrekturen
  und Prüfvorgänge werden angehängt, niemals überschrieben. Die Unveränderlichkeit ist durch
  Datenbank-Trigger gesichert.
- Jede Korrektur trägt Urheber, Zeitpunkt und eine **erzwungene Begründung** von 1 bis 500
  Zeichen. Eine Korrektur ohne Begründung ist technisch nicht möglich.
- Der ursprüngliche Wert bleibt erhalten und bleibt lesbar.
- Doppelte Übertragungen werden **serverseitig** erkannt und verworfen, nicht im Client.

## 1.3 Verfügbarkeit und Belastbarkeit

- **Stündliche verschlüsselte Sicherung** der Datenbank auf einen getrennten Speicher in
  Falkenstein. Verschlüsselung mit BorgBackup; der Schlüssel wird getrennt vom Server verwahrt.
- **Wöchentliche automatische Wiederherstellungsprüfung** in eine Wegwerf-Umgebung, mit Abgleich
  von Migrationsstand, Zeilenzahlen, Rollen und der Row-Level-Security. Ein absichtlich
  beschädigtes Archiv wird erkannt.
- Aufbewahrung: 24 stündliche, 14 tägliche, 8 wöchentliche, 6 monatliche Stände.
- Unveränderliche Schnappschüsse des Sicherungsspeichers als zweite Ebene.
- **Überwachung mit Alarmierung** auf das Telefon des Betreibers: Ausfall der Schnittstelle,
  überfällige Sicherung, fehlgeschlagene Wiederherstellungsprüfung, volle Platte. Zusätzlich ein
  Totmannschalter außerhalb der eigenen Infrastruktur.
- Container laufen schreibgeschützt, ohne Capabilities, ohne Möglichkeit zur Rechteerweiterung.

## 1.4 Verfahren zur Überprüfung und Bewertung

- Jede Änderung durchläuft eine automatisierte Prüfstrecke mit 11 Prüfungen, darunter
  ausdrückliche Sicherheits- und Isolationsprüfungen gegen eine echte Datenbank.
- Jede Änderung mit Berührung der Mandantengrenze wird zusätzlich unabhängig geprüft.
- Datenbankänderungen laufen über ein Verzeichnis mit Prüfsummen; eine nachträgliche Änderung
  einer bereits eingespielten Änderung wird erkannt und abgewiesen.
- Betriebsgeheimnisse liegen ausschließlich in Dateien mit Modus 0600 und Eigentümer `root`;
  sie erscheinen in keinem Prozessaufruf, keinem Protokoll und keinem Quelltextbestand.

## 1.5 Datenminimierung

- Betriebsprotokolle enthalten Zeitpunkt, Fehlerklasse, Route und Korrelationskennung — **keinen
  Personenbezug**. Erzwungen durch eine Projektion auf vier getippte Felder, nicht durch einen
  Filter.
- Alarmmeldungen nennen ausschließlich, was gestört ist.
- Der Totmannschalter erhält ein Lebenszeichen **ohne Rumpf**.

---

## Bekannte Lücken — Stand 25.08.2026

Vollständigkeit gehört zur Belastbarkeit dieser Anlage. Offen sind:

| Lücke | Wirkung | Behebung |
|---|---|---|
| Keine Content-Security-Policy im Admin-Web | Schutz gegen eingeschleustes JavaScript unvollständig | T-017, D-015 |
| Löschkonzept nicht implementiert | Betroffenenrechte nach Art. 17 noch nicht durchsetzbar | T-016 |
| Sieben von 30 Tabellen ohne eigene Policy | `FORCE` ohne Policy sperrt alles, also fail-closed; die zweite Verteidigungslinie fehlt dort | T-019 |
| Wiederherstellung des Wiederherstellungsschlüssels über eigenes URL-Schema in der App | Auf Android durch eine fremde App abfangbar | vor der ersten Verteilung, T-018 |
| Keine zweite Umgebung | Datenbankänderungen laufen erstmals in der Produktion | T-014 |

---

# Anlage 2 · Unterauftragsverarbeiter

Siehe `Verzeichnis_Verarbeitungstaetigkeiten.md`, Abschnitt 4.

Der Verantwortliche wird über einen Wechsel oder eine Ergänzung im Voraus unterrichtet und kann
widersprechen (Art. 28 Abs. 2).

---

# Anlage 3 · Löschkonzept

Siehe `Verzeichnis_Verarbeitungstaetigkeiten.md`, Abschnitt 5, und `ADO/DECISIONS.md`, D-018.

---

# Anlage 4 · Unterstützung des Verantwortlichen

| Pflicht des Verantwortlichen | Unterstützung |
|---|---|
| Auskunft, Art. 15 | Export der Daten einer Person; Umsetzung mit `T-016` |
| Berichtigung, Art. 16 | Korrektur mit lückenloser Historie — **vorhanden** |
| Löschung, Art. 17 | `T-016` |
| Datenübertragbarkeit, Art. 20 | CSV-Export — **vorhanden**, Umfang wächst mit `T-013` |
| Meldung von Verletzungen, Art. 33 | Unverzügliche Unterrichtung des Verantwortlichen. Meldeweg und Prozess sind in Phase 3 zu beschreiben. |
| Datenschutz-Folgenabschätzung, Art. 35 | Zuarbeit durch diese Anlagen |
