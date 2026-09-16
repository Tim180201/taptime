# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-035 · Kein stiller Datenverlust

**Für:** Development · **Risiko:** personenbezogene Lohndaten · **Zeitbox:** zwei Sitzungen;
reißt sie, Scope melden und schneiden. · **Grundlage:** bestätigte Befunde B05/B03 und D-051

### Produktgrenze

- RPO: Kein serverbestätigtes WorkEvent geht beim Ausfall eines Servers oder Datenträgers
  verloren. RTO: API und Datenbank sind spätestens vier Stunden nach Alarm wieder schreibfähig.
- Kein synchroner Standby. Solange nur der Gründer den Betrieb beherrscht, wiegen dessen neue
  Ausfall-, Failover- und Überwachungswege schwerer. Neu bewerten, sobald eine zweite Person den
  Betrieb unabhängig beherrscht.
- Die fachliche Kette, Append-only-Historie und Trigger-Agnostik bleiben unverändert; der Nutzer
  trifft keine neue Entscheidung.

### B05 · Quittung erst nach externer Archivierung

- Den logischen Stundendump nicht als PITR-Basis ausgeben. Eine geprüfte physische
  PostgreSQL-Basissicherung und fortlaufend verschlüsselt außer Haus archiviertes WAL bilden die
  Wiederherstellungskette. Lokal geschriebenes oder nur empfangenes WAL gilt nicht als archiviert.
- Nach dem Commit die für genau dieses Ereignis erforderliche WAL-Position konservativ erfassen.
  `synchronized` oder `review_pending` darf erst nach einem externen Archiv-Wasserstand an App
  oder Reconciliation zurückgegeben werden, der diese Position abdeckt. Vorher bleibt die
  vorhandene FIFO-Zeile erhalten und wird wiederholt; kein neuer Telefon-Zweitspeicher entsteht.
- Der heutige Vertrag kann Archivhaltbarkeit nicht ausdrücken. Eine neue exakte Version der
  Offline-Ingestion und Reconciliation benennt `archive_pending` und `offsite_archived`.
  Bestehende v1–v3-Routen bleiben formstabil und liefern bis zum Archivnachweis ihr bekanntes
  `pending`; niemals eine vorzeitige Alt-Quittung. Keine tolerante Feldmengenprüfung.
- Archivierungsrückstand alarmiert aus der ältesten noch benötigten WAL-Position, dem letzten
  extern bestätigten Wasserstand und der konfigurierten Archivtaktung. Keine fest hineingeschriebene
  Prüfzahl. Die Prüfung wird mit einem absichtlich angehaltenen Archivweg negativ belegt.
- Wiederherstellung gegen einen Zeitpunkt zwischen zwei Änderungen: die frühere ist vorhanden,
  die spätere nicht. Pflicht-Gegenbeweis auf der App-Seite: Commit ohne Archivnachweis löscht die
  FIFO-Zeile nicht.

### B03 · Fehlenden Wecker reparieren

- Wenn `trigger()` einen Timer löscht und der echte SQLite-FIFO-Kopf noch nicht fällig ist, den
  nächsten Weckzeitpunkt aus dessen gespeichertem `next_attempt_at` neu setzen.
- Regressionstest mit kontrollierter Uhr, echter SQLite-Abfrage und zweitem Auslöser vor der
  Fälligkeit: vorher kein Senden, zur Fälligkeit genau ein neuer Versuch. Ohne Reparatur rot.

### Entstehung, Änderung und Entfernung

Physische Basen und WAL entstehen ausschließlich im Betriebsdienst, bleiben unverändert und
werden nur entfernt, wenn eine neuere geprüfte Basis samt lückenlos benötigtem WAL und die
Aufbewahrungsregel sie entbehrlich machen. Der Server legt je Event eine unveränderliche
WAL-Anforderung nach Commit an; sie verschwindet mit dem zugehörigen WorkEvent. Den externen
Wasserstand ändert nur der Archivierer nach erfolgreichem Upload; er verschwindet beim bewussten
Rückbau der Archivstrecke. Die Telefonzeile entsteht weiter beim Trigger und verschwindet nur
nach exakter archivierter Quittung oder dem bestehenden bewussten Schutz-/Identitätsverfahren.

### Verifikation und Grenzen

- Typecheck einschließlich Tests und vollständige Tests aller betroffenen Workspaces grün;
  PostgreSQL-Integrationssuiten lokal seriell. Unabhängiges Review, maximal zwei Runden.
- Kein Deploy, kein Produktionszugriff, kein B02/T-036, B06–B09 oder T-043. Umsetzung nicht
  committen oder pushen vor `APPROVED`; Dokumentations-Commit getrennt sofort pushen.
- Bericht nach `AGENTS.md`: Vertrag und Lebenszyklen, B03/B05-Gegenbeweise, Zeitpunkt-Restore,
  Rückstandsalarm, Typechecks, Tests, Review und Hash des Dokumentations-Commits.
