# Aktuelle Aufgabe

> **Stand 14.10.2026:** T-116b abgeschlossen (`514f919`, Migration 055), noch nicht ausgeliefert. T-117 ist geteilt:
> jetzt **T-117a** (Suche und Seiten auf dem Server), danach T-117b (Oberfläche), T-118, T-120, dann Deploy 5.

## T-117a · Suche und Seiten auf dem Server

**Für:** Development · **Risiko:** hoch (neue Lesefunktionen über Mandanten- und Standortgrenzen, Vertragsversionen) ·
**Zeitbox:** ein bis zwei Sitzungen. Nur Server, Verträge und deren Tests; keine Oberfläche. Kein Deploy.

### Ausgangslage (`514f919`)

- Auf dem Server gibt es keine Suche; App und Web filtern nur in bereits geladenen Seiten („Manuell“).
- **Kundenstunden** (`/v1/customers/hours/query`) kommen ungeblättert als ein JSON samt Personen bzw. Tagen. Bei
  frogs-Größe überschreitet das die 16-KiB-Grenze der App: Der Reiter „Kunden“ lädt dann nicht. Das ist der wichtigste
  Grund für T-117a.
- Die Einrichtungsliste (`setup-projection`) liefert erst alle Kunden, dann alle Karten, jeweils nach UUID; Auswahllisten
  sehen nur geladene Seiten. Ziellisten werden vollständig vorgeladen, Nachtrage-Ziele sind nicht nach Namen sortiert.

### Gemeinsame Regeln (TL-Entscheidung)

1. **Suchbegriff:** Feld `search` im Body, `null` = keine Suche. NFC-normalisiert und getrimmt (wie
   `normalizeTapTimeNameV1`), 1 bis 80 Zeichen, sonst `invalid_request`. Treffer: Teilzeichenfolge ohne Groß-/Klein-
   unterschied, `strpos(lower(name COLLATE "und-x-icu"), lower(term COLLATE "und-x-icu")) > 0` (kein `LIKE`, also
   kein Escaping). Umlaute müssen getippt werden; keine Akzent-Gleichsetzung.
2. **Sortierung und Seiten:** Name `COLLATE "und-x-icu"`, dann `id`. Keyset-Cursor mit Name und `id`; der Cursor ist an
   Suchbegriff und Filter gebunden (Hash im Cursor, abweichend → `invalid_request`). Seitengröße höchstens 50, außer wo
   unten anders genannt; jede Antwort bleibt unter 16 KiB bei 50 Einträgen mit 120-Zeichen-Namen (Test).
3. **Sichtbarkeit unverändert:** Jede neue Funktion übernimmt die Sichtbarkeitsregel ihres Vorgängers wörtlich (D-102);
   die Suche filtert nur innerhalb. Rollen, RLS und Funktionseigentümer wie beim Vorgänger.
4. **Alte Wege bleiben** unverändert und funktionsfähig (installierte App-Builds). Neue Wege sind neue Pfade bzw. eine
   neue Accept-Version; Routentabelle, `isAdministrationRoute`, Diagnose und Header-Schutzliste ergänzen.
5. **Datenschutz:** Suchbegriffe werden nicht geloggt, auch nicht in Diagnosen oder Fehlertexten.

### Neue Wege

| Liste | Neuer Weg | Inhalt |
|---|---|---|
| Kunden (App und Web) | `POST /v2/customers/hours/query` | Seite mit Kunden-Summen (Id, Name, aktiv, Sekunden, läuft, Kontingent wie v2), ohne Personen/Tage; `search`, `cursor`, `limit` ≤ 50. |
| Kunde im Detail | `POST /v2/customers/hours/detail` | Ein Kunde (`customerId`) mit Personen bzw. Tagen wie heute; Personen nach Name. Nicht sichtbar → `not_found`. |
| Beschäftigte | Accept `managed-people.v6` auf dem bestehenden Pfad | Wie v5 plus `search`; `read_managed_active_summary_v5`, Cursor-Präfix `s6`. `runningCount` und `totalCount` zählen weiter den ganzen Bereich ohne Suche. |
| Zugänge verwalten | `POST /v3/administration/employee-memberships-projection` | Wie v2 plus `search`, nach Name statt UUID. |
| Karten | `POST /v3/administration/setup-projection` mit `kind:'nfc_tags'` | Nur Karten, `search` auf Kartenname und Kundenname; jede Karte trägt `customerDisplayName`. |
| Kundenauswahl beim Einrichten und Umhängen | dasselbe mit `kind:'customers'` | Nur aktive Kunden, `search`. Weiter als `taptime_admin_setup` mit RLS. |
| Arbeitsziele („Manuell“, eigenes Nachtragen) | `POST /v2/mobile/work-targets/query` | `search`, optional `targetType`; `read_mobile_work_targets_v2`, Reihenfolge Kunden, Projekte, Allgemein, dann Name. |
| Nachtrage-Ziele für andere | `POST /v2/administration/time-records/backfill-targets/query` | `search`, sortiert wie die Arbeitsziele; `read_time_backfill_targets_v2`. |
| Projekte (Web) | `POST /v2/administration/projects/query` | `search`; sonst wie v1. |

Für jede neue Lesefunktion: vollständige Körper in **Migration 056**, `T106FunctionBodies` ergänzen.

### Tests

Je Punkt rot vor der Änderung, SQL mit vollständigem fachlichem Rotlauf:
- Je Weg: Treffer ohne Groß-/Kleinunterschied („özd“ findet „Özdemir“), keine Treffer, `search` zu lang oder leer nach
  Trim → `invalid_request`, Blättern über mehrere Seiten mit Suche ohne Lücke und Dopplung, Cursor mit anderer Suche
  abgewiesen, Sortierung mit Umlauten.
- **Sichtbarkeit je Rolle:** Administrator, Standortleitung (eigener Bereich, außerhalb nichts), Mitarbeiter mit und
  ohne Standorte; Suche findet nie, was ohne Suche unsichtbar ist; fremder Mandant nie.
- Kundenstunden: Antwortgröße bei 50 Kunden unter 16 KiB; Detail eines unsichtbaren Kunden → `not_found`; Summen der
  Seiten gleich der alten v2-Antwort für denselben Monat.
- Alte Wege liefern unverändert dieselben Antworten wie vor 056 (Vergleichstest).
- Kein Suchbegriff in Logs (Test über die Diagnoseausgabe).
- Alle Suiten, Postgres-Tests und Typecheck grün.

### Grenzen

- Keine Oberfläche (kommt in T-117b), keine Zuordnung zu Mitarbeitern (T-118). Keine Datenänderung in 056, kein Index
  nötig bei Pilotgröße. Kein Deploy, kein Zugriff auf Produktion. ADO nicht ändern.

### Bericht

`.t117a-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei
P1/P2. Kein Commit vor `APPROVED` durch den TL.
