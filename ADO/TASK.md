# Aktuelle Aufgabe

> **Stand 05.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-098, Auslieferung mit dem nächsten Deploy (vorher
> Fingerabdrücke aus EAS, siehe STATUS). Reihenfolge: **T-100**, dann T-101, T-102 → Deploy und App-Builds → T-024 →
> Pilot. Frühere Briefs stehen in der Git-Historie.

## T-100 · Kunden verwalten in App und Web (D-104, D-108)

**Für:** Development · **Risiko:** Kundenstamm, Tag-Zuordnung, laufende Zeiten, Offline-Freigabe · **Zeitbox:** eine
Sitzung, bei Bedarf zwei (dann nach Teil B schneiden). `apps/backend-administration`, `apps/backend-api`, Verträge,
neue Migration 046, `apps/mobile`, `apps/admin-web`. Keine Änderung an Engine-Regeln außer dem unten genannten Prüffall.

### Auftrag

**A. App, Reiter „Kunden“ (D-104).** Für Administrator und Standortleitung „+ Kunde hinzufügen“: Name (bei mehreren
Standorten auch Standort), dann „NFC-Tag zuordnen“ (anlegen und direkt den Tag beschreiben, bestehender Ablauf) oder
„Nur anlegen“. Im Reiter „Tags“ entfällt „+ Neuer Kunde“; Zuordnen/Ändern für bestehende Kunden und Pausen-Tags bleiben.
Mitarbeiter sehen nichts davon.

**B. Umbenennen und Löschen (D-108), App und Web.** Administrator alle Kunden, Standortleitung nur Kunden ihres
Standorts (Grenze in SQL, wie T-086/T-060).
- Umbenennen: gleiche Namensregeln und Doppelprüfung wie beim Anlegen; Historie behält den alten Namen nachvollziehbar
  (Kalender und Export zeigen den aktuellen Namen wie bisher).
- Löschen = deaktivieren, in einer Transaktion mit Sperre gegen gleichzeitiges Starten: läuft auf dem Kunden eine Zeit
  (bei irgendeiner Person), wird abgelehnt mit „Erst die laufende Zeit beenden“. Sonst: Kunde inaktiv, verschwindet aus
  Listen und Auswahlen (App, Web, manuelles Erfassen, Nachtragen), sein Tag wird frei (Zuordnung beendet, Tag danach
  neu zuordenbar). Geleistete Stunden bleiben in Kalender, Kunden-Stunden, Kontingent-Historie und Export.
- Bestätigung vor dem Löschen in der Oberfläche („Kunde X löschen? Stunden bleiben erhalten.“).
- Offline: Die Freigabe wird nach dem Löschen neu geladen (Weg aus T-095). Trifft danach noch ein Offline-Ereignis für
  den gelöschten Kunden ein, dessen Zeitpunkt nach dem Löschen liegt, bucht der Server es nicht still, sondern legt einen
  Prüffall an („Kunde wurde gelöscht“); Ereignisse von vor dem Löschen werden normal verarbeitet.
- Kein Reaktivieren (offene PO-Frage F-069).

**C. „Tag prüfen“ im Reiter „Tags“ (D-108).** Tag scannen, die App zeigt Kunde (oder Pause, oder „nicht zugeordnet“)
und Standort, ohne etwas zu ändern und ohne Zeitbuchung. Für Administrator und Standortleitung.

### Tests

Rot vor Grün: (1) Anlegen mit und ohne Tag aus „Kunden“; „+ Neuer Kunde“ nicht mehr in „Tags“; Mitarbeiter ohne
Knöpfe; (2) Umbenennen inkl. Doppelname → abgelehnt; Standortleitung fremder Standort → abgelehnt; (3) Löschen mit
laufender Zeit → abgelehnt; parallel Start und Löschen → genau eins gewinnt; nach Löschen: Kunde weg aus Auswahlen,
Tag frei und neu zuordenbar, Stunden unverändert in Kalender und Export; (4) Offline-Ereignis nach Löschzeitpunkt →
Prüffall, davor → normal; (5) „Tag prüfen“ ändert nichts und bucht nichts. Alle Suiten, die Migrationen abspielen,
seriell; CI-Bauordnung.

### Nicht Teil

Reaktivieren, Projekte und Standorte löschen, Massenänderungen, Zugangsverwaltung im Web (eigenes Vorhaben).

### Bericht

`.t100-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
