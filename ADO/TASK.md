# Aktuelle Aufgabe

> **Stand 28.09.2026:** Produktion auf `e13916b` (Migrationen bis 034). Auf `main` bis `537af63` zusätzlich T-080,
> T-084 bis T-089 (035–038). Reihenfolge (TL 28.09.): **T-090** → ein Deploy → App-Builds → T-091 bis T-098 → zweiter
> Deploy → T-024 → Pilot. Frühere Briefs stehen in der Git-Historie.

## T-090 · Lohnexport v4 erreichbar, Projekt mit Standort anlegen, Anlegen ohne Doppel

**Für:** Development · **Risiko:** Lohnexport (Kernversprechen), Standortmodus (D-102), Idempotenz · **Zeitbox:** eine
Sitzung. Analyse-Befunde F-002, F-003, F-005 (Projekt-Teil), F-020, F-039, F-070, F-136. Kein Deploy, kein Serverzugriff.

### Befund (Code auf `537af63`)

1. **Export v4.** Das Admin-Web fragt standardmäßig `/v4/time-entries/export` an. Der Admin-Block im
   `infrastructure/caddy/Caddyfile` leitet nur `/v1/*`, `/v2/*`, `/v3/*` weiter; `/v4/*` landet im Web-Fallback.
   Zusätzlich lehnt `respondCsv` in `apps/backend-api/src/BackendHttpServer.ts` jeden Dateinamen außer ohne Version,
   `_v2` und `_v3` mit 503 ab, ohne Diagnose. Die Koordinator-Tests laufen grün, weil kein Test über HTTP mit dem
   echten v4-Dateinamen und keiner über Caddy geht.
2. **Projekt anlegen.** `ProjectAdministrationCoordinator.createProject` legt das Projekt ohne Standortbindung an; bei
   eingeschalteten Standorten scheitert der Commit an der Vollständigkeitsprüfung aus 019 (503, Web meldet „unklar“).
   Für Kunden ist das mit T-086 (035) behoben; das Muster steht in `AdminWriteSessionCoordinator.createCustomer`.
3. **Projektname.** Der Vertrag nimmt Namen an, die der CHECK `projects_name_shape` ablehnt (503 statt 400).
4. **Wiederholung.** `AdminWebCoordinator` erzeugt beim Anlegen von Kunde, Projekt und Standort je Klick eine neue
   `commandId`; eine Wiederholung nach „unklar“ legt ein Duplikat an.
5. **Tests.** Die Projektverwaltung hat keinen Test gegen PostgreSQL mit der echten Laufzeitrolle.

### Auftrag

**A. Export v4 über die echte Grenze.** Im Admin-Block alle Versionspräfixe über einen Matcher weiterleiten
(z. B. `path_regexp ^/v[0-9]+/`), `/v1/operator/*` verhält sich wie heute. `respondCsv` leitet den erwarteten Namen
aus der Schemaversion ab statt aus einer festen Liste; eine Ablehnung schreibt eine Diagnose (`invalid_export_filename`,
ohne Personenbezug). Die Präfixe im Forwarding-Test werden aus den tatsächlichen Pfaden des Admin-Web-Clients
abgeleitet, nicht aufgezählt (AGENTS §1.6). V1–V3 bleiben byte-gleich.

**B. Projekt mit Standort.** Wie T-086: bei eingeschalteten Standorten ist `locationId` Pflicht
(`location_required`), bei ausgeschalteten verboten (`invalid_request`); Projekt und Bindung in derselben
Transaktion, serialisiert mit derselben Standort-Sperre; Standort im Beleg und im Anfrage-Digest, exakte Wiederholung
liefert das gespeicherte Ergebnis. Anlegen darf weiter nur der Administrator, an jedem aktiven Standort des Betriebs.
Höchstens eine Migration (039), nur anfügend, nach dem Muster von 035; bestehende Daten bleiben unverändert. Admin-Web:
Standortauswahl im Projektformular wie beim Kunden, nur bei eingeschalteten Standorten.

**C. Projektname.** Validator nutzt `normalizeCustomerNameV1` wie bei Kunden und nimmt nur den kanonischen Namen an;
23514 wird zu `invalid_request`.

**D. Anlegen ohne Doppel.** Im Admin-Web je Aktion (Kunde, Projekt, Standort) eine ausstehende Befehlsidentität
(normalisierter Name, Standort → `commandId` und ggf. Objekt-ID) halten, bei Wiederholung wiederverwenden, erst nach
bestätigtem Erfolg oder eindeutiger Ablehnung verwerfen (Muster `pendingStops` / `saveTimeEdit`).

### Tests

Rot vor Grün, jeweils zuerst am alten Code: (1) HTTP-Test: v4-Export mit echtem Dateinamen → 200 und
`Content-Disposition`; unbekannte Version → 503 mit Diagnose; (2) Caddy-Forwarding: jeder Präfix, den der Admin-Web-Client
benutzt, erreicht das Backend, `/v4/time-entries/export` eingeschlossen; (3) PostgreSQL mit echter Laufzeitrolle:
Projekt anlegen mit und ohne Standorte, exakte Wiederholung, `commandId`-Konflikt, fremder Standort, fremder Betrieb,
Deaktivieren, `project_in_use`, veraltete `row_version`; (4) ungültiger Projektname → 400; (5) Web: Wiederholung
nach Zeitüberschreitung sendet dieselbe `commandId` für Kunde, Projekt und Standort.

**Lokal alle Suiten, die Migrationen einspielen oder die geänderten Pfade berühren** (Lehre aus T-086):
`backend-schema`, `backend-time-review` (DA3 mit T-062-Probe), `backend-time-export`, `backend-api`,
`backend-mobile-work`, `backend-administration`, `admin-web` (Unit und Browser-Layout), Caddy-Tests unter
`infrastructure/caddy/tests/`, Workflow-Tests. Im Bericht jede Suite mit Befehl und Ergebnis.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse. Keine Änderung am Exportinhalt (B01), an Standortregeln für
Allgemeine Arbeitszeit, Pausen oder Lease (T-091), an Mobile. Keine neue Rolle darf Projekte anlegen.

### Bericht

`.t090-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
