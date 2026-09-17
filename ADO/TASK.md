# Aktuelle Aufgabe

## T-052 · Die Bestätigung kommt zurück in den Tap

**Für:** Development · **Risiko:** personenbezogene Lohndaten, Produktvision
**Zeitbox:** zwei Sitzungen. **Grundlage:** D-052; D-051 bleibt unverändert.

### Zweck und Grenzen

Die Serverentscheidung wird im selben Tap gezeigt und gefühlt. Keine neue Nutzerentscheidung,
kein Dialog, kein zweiter Schritt. `Trigger → WorkEvent → BusinessEngine → TimeEntry`,
append-only Historie und trigger-agnostische Domäne bleiben erhalten. Das Telefon legt die
FIFO-Zeile beim Tap an, aktualisiert ihren Abgleich und löscht sie ausschließlich nach
nachgewiesener externer Archivierung. RPO bleibt 0. Kein neuer fachlicher Speicher.
Keine Server-Endpunkte entfernen; alte Apps bleiben bedient. Kein Deploy, Produktionszugriff,
T-036 oder T-043. Befunde, die neue Entscheidungen erfordern, melden statt zurechtbiegen.

### Umsetzung

1. Den noch nicht ausgelieferten Vertrag v4 an Ort und Stelle ändern: `archive_pending`
   trägt dieselbe geschlossene Entscheidungs-/Prüfgrund-Union wie der archivierte Fall,
   mit `archiveStatus: archive_pending`. Dasselbe für `OfflineReconciliationRecordV2`.
   Exakte Schlüsselmengen erhalten; die SQL-Zeile aus dem LEFT JOIN auf canonical_decisions
   im nicht archivierten Fall prüfen und ihre vorhandene Entscheidung weiterreichen.
2. Scheduler: in submitOffline und Wiederherstellung bei `archive_pending` sofort ein
   durable-Ergebnis (`server_decision` / `review_pending`) liefern und `retryOffline`
   aufrufen; niemals vor Archivnachweis `acknowledgeHead`.
3. Eigener sichtbarer Zustand: Entscheidung bestätigt, Sicherung läuft noch. Verständlicher
   Text ohne Betriebsbegriffe, Entscheidungsimpuls statt Warteimpuls. Die vollständige
   Abbildung in ScanFeedbackCoordinator endet weiterhin in `satisfies never`.
4. `OfflineEventReconciliationReader.reconcileV2` verpflichtend machen, Testdoppel nachziehen.
5. Tote Lease-V1/V2-Wege im mobilen Client samt Transport und Parser nach Referenzsuche
   entfernen. Bei lebendem Verbraucher nur diesen Punkt abbrechen und melden.

### Pflichtbelege und Verifikation

- Vor der Reparatur roten Test mit echter SQLite zeigen: bei `archive_pending` ist die
  Entscheidung sichtbar UND die FIFO-Zeile bleibt. Bestehenden Nichtlösch-Test erhalten.
- Alte v1–v3-Routen bleiben formstabil mit bekanntem `pending`; Vertragsnaht testen.
- Echtes PostgreSQL: Restore zum zuletzt archivierten Punkt muss gelöschte Ereignisse
  enthalten; erhaltene Telefonereignisse müssen dieselbe Reihenfolge und Grundlage finden.
  Bewussten Restore auf einen früheren Punkt gesondert belegen, einschließlich fehlender
  bereits gelöschter Ereignisse. Ergebnis als Einsatzregel in infrastructure/RESTORE.md.
- Typecheck nachweislich einschließlich Tests; vollständige Tests betroffener Workspaces;
  PostgreSQL-Integrationssuiten lokal seriell. Unabhängiges Review, maximal zwei Runden.
- Dokumentations-Commit vorab getrennt und sofort pushen, nur ADO/ und AGENTS.md.
  RESTORE.md gehört zur Umsetzung. Umsetzung nicht vor APPROVED committen oder pushen.
- Abschlussbericht gemäß AGENTS.md §8; ausgelassene Prüfungen mit Grund melden.
