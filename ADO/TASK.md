# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-007 · Sicherung und getesteter Restore

**Für:** Codex · **Risiko:** personenbezogene Daten verlassen den Server → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** T-010 abgeschlossen

### Ziel

**Ein Restore ist nachweislich durchgeführt worden, automatisch, gegen echte Sicherungsdaten.**

Die Aufgabe ist nicht fertig, wenn Sicherungen geschrieben werden. Sie ist fertig, wenn eine
Wiederherstellung ohne menschliches Zutun gelaufen ist und ihr Ergebnis geprüft wurde. Eine
ungetestete Sicherung ist keine Sicherung, sondern eine Hoffnung.

### Der Aufbau

| | |
|---|---|
| **Wohin** | Hetzner Storage Box **BX11**, Standort **FSN1 Falkenstein** — Deutschland, nicht Helsinki |
| **Womit** | BorgBackup über SSH. Verschlüsselung, Deduplizierung und Integritätsprüfung sind eingebaut |
| **Was** | `pg_dump` der Produktdatenbank, **stündlich** |
| **Aufbewahrung** | 24 stündliche, 14 tägliche, 8 wöchentliche, 6 monatliche |
| **Unveränderlichkeit** | Storage-Box-Schnappschüsse, planmäßig |

**Warum stündlich und nicht täglich:** Die Datenbank ist heute wenige Megabyte groß, und Borg
dedupliziert. Stündlich kostet praktisch nichts und senkt den möglichen Datenverlust von einem
Tag auf eine Stunde. Bei einer Zeiterfassung ist ein verlorener Tag ein verlorener Lohn — und
die Geräte können ihn nicht nachliefern, sie quittieren und löschen ihre Warteschlange.

**Warum Schnappschüsse:** Wer den Server übernimmt, hat auch dessen Zugang zur Storage Box.
Ohne eine unveränderliche Ebene könnte er die Sicherungen mitlöschen. Prüfe, wie weit
Storage-Box-Schnappschüsse das leisten, und melde ehrlich, wo die Grenze liegt.

### Schritte

**1. Sicherung einrichten**

- `pg_dump` läuft **innerhalb** von `taptime-internal`. Die Datenbank bleibt von außen
  unerreichbar.
- Ergebnis unmittelbar in das Borg-Archiv. Kein unverschlüsselter Zwischenstand auf der Platte.
- Der Borg-Schlüssel ist **nicht ausschließlich** auf dem Server. Er wird dem Product Owner
  übergeben, damit er ihn getrennt verwahrt. Stirbt der Server mit dem einzigen Schlüssel, sind
  alle Sicherungen wertlos.

**2. Wiederherstellung, automatisch und wöchentlich**

Das ist der Kern der Aufgabe.

- Neuestes Archiv in einen **Wegwerf-Container** einspielen, nie gegen die Produktion.
- Nachweisen, und zwar mit Vergleich, nicht mit „lief durch":
  - Migrationsstand stimmt, Prüfsummen des Migrationsverzeichnisses stimmen
  - Zeilenzahlen der tragenden Tabellen entsprechen der Produktion
  - RLS ist auf allen 29 Tabellen aktiv und erzwungen — eine Wiederherstellung, die die
    Mandantentrennung verliert, ist ein Datenleck, kein Restore
  - alle Rollen sind vorhanden
- Wegwerf-Container danach restlos entfernen.

**3. Ein Signal, das ankommt**

Bis `T-008` gibt es keine Protokollierung. Diese Aufgabe braucht trotzdem eine Antwort auf die
Frage „lief die letzte Sicherung?", die **ohne Anmeldung am Server** zu bekommen ist. Halte es
einfach und wähle etwas, das ohne fremden Dienst auskommt. `T-008` hängt es später an die
richtige Alarmierung.

**4. Ein Wiederherstellungs-Leitfaden**

Eine Seite, `infrastructure/RESTORE.md`, geschrieben für jemanden unter Druck:

- Server ist weg — was tue ich, in welcher Reihenfolge, wie lange dauert es
- Nur die Datenbank ist beschädigt — wie hole ich einen einzelnen Stand zurück
- **Was nicht in der Sicherung ist und wo es stattdessen liegt.** Insbesondere
  `/opt/taptime/.env`. Die steht in keinem Repository. Ohne sie startet nichts.
- **Warnung zu Storage-Box-Schnappschüssen:** Ein Zurücksetzen auf einen Schnappschuss löscht
  alle neueren Schnappschüsse endgültig. Der übliche Weg ist deshalb **nicht** das Zurücksetzen,
  sondern das Herauskopieren des benötigten Standes aus `/.zfs/snapshot/`. Beschreibe beide Wege
  und sag klar, wann welcher gilt.

### Vision-Check

Keine fachliche Logik, keine Migration, keine Oberfläche. Betrieb.

### Nicht anfassen

- `apps/`, `packages/`, `apps/backend-schema/migrations/`
- Der laufende Betrieb. Die Sicherung darf die Produktion nicht anhalten.

### Prüfung — nachweisen, nicht behaupten

- Ein echter Wiederherstellungslauf ist gelaufen; seine vollständige Ausgabe steht im Bericht
- Die Zeilenzahlen aus Wiederherstellung und Produktion stehen nebeneinander
- Der Nachweis, dass RLS nach der Wiederherstellung auf **29 von 29** Tabellen aktiv und
  erzwungen ist
- Ein absichtlich beschädigtes Archiv wird erkannt und nicht stillschweigend akzeptiert
- Die Datenbank ist während der Sicherung weiterhin von außen unerreichbar
- Nach echtem Serverneustart läuft die Sicherung von selbst weiter
- Kein Geheimnis in argv, keines im Repository, keines im Bericht
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Angenommen, jemand hat den Server vollständig übernommen. Wie viele der Sicherungen kann er
> zerstören? Nenne die Zahl und den Weg, statt zu behaupten, es ginge nicht.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-008` Betriebssichtbarkeit · `T-009` Menschen verwalten (standortfähig, D-013) ·
`T-011` Ratenbegrenzung · siehe `ADO/PLAN.md`.
