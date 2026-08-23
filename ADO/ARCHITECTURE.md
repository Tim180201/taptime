# TapTim.e — Architektur

> **One Tap. One Decision.** Der Nutzer löst aus. Die Engine entscheidet.

Diese Datei beschreibt, wie das System gebaut ist und welche Invarianten nicht gebrochen
werden dürfen. Sie ist die Datei, die ein neuer Agent lesen muss, um mitarbeiten zu können.

---

## 1. Die fachliche Kette

```
Trigger (NFC-Scan | manuell | offline nachgetragen)
  -> WorkEvent            unveränderliche Tatsache: "etwas ist passiert"
  -> BusinessEngine       entscheidet, was es bedeutet
  -> TimeEntry            fachliches Ergebnis: started -> stopped
```

Ein Trigger erzeugt **nie** direkt einen `TimeEntry`. Das ist die zentrale Invariante des
Produkts. Sie ist der Grund, warum später QR-Code, Terminal, Kalender-Import oder eine API
als weitere Trigger dazukommen können, ohne das Datenmodell zu ändern.

Implementiert in `packages/core/src`:
`domain/` (WorkEvent, TimeEntry, Events) · `business/` (BusinessEngine, WorkEventFactory) ·
`application/` (Orchestrierung, keine Geschäftsregeln) · `ports/` + `infrastructure/`
(Adapter, austauschbar).

Hexagonal: Geschäftslogik kennt weder UI noch NFC-Bibliothek noch Datenbank.

---

## 2. Bausteine

| Baustein | Was | Technik |
|---|---|---|
| `packages/core` | Domäne, Business Engine, Ports | TypeScript, ohne Framework |
| `packages/*-contract` | Geteilte Verträge Mobile ↔ Server | versioniert |
| `apps/backend-api` | **Das einzige deploybare Backend.** Bündelt alle `backend-*` | Node 24, esbuild, `node dist/main.js` |
| `apps/backend-*` | Fachliche Server-Module (15 Stück) | als Bibliotheken eingebunden |
| `apps/backend-schema` | Datenbankmigrationen (013) | SQL, Schema `taptime_server` |
| `apps/mobile` | Android-App | Expo 57, RN 0.86, NFC, SQLite-Offline-Queue |
| `apps/admin-web` | Verwaltung im Browser | Vite + React, 5 Ansichten |

**Ein Container, eine Datenbank, zwei Frontends.** Mehr braucht der Betrieb nicht.

Neue fachliche Module (z. B. später `backend-controlling`) kommen als weiteres
`apps/backend-*` dazu und werden in `backend-api` eingehängt. Kein Umbau nötig.

---

## 3. Mandantentrennung

Supabase-managed PostgreSQL. Jede fachliche Tabelle trägt `organization_id` und ist über
**Row Level Security** (`ENABLE` + `FORCE`) abgesichert. Zusammengesetzte Fremdschlüssel
enthalten immer `organization_id`, damit ein Datensatz technisch nicht über Mandantengrenzen
zeigen kann.

Auth läuft über Supabase; die Zuordnung Benutzer → Mitgliedschaft → Organisation passiert
serverseitig (`identity_bindings`, `memberships`).

**Regel:** Jede neue Tabelle mit fachlichen Daten bekommt `organization_id`, RLS und einen
mandantensicheren Fremdschlüssel. Ohne Ausnahme.

---

## 4. Die Invarianten für spätere Erweiterung

Diese Eigenschaften sind der Grund, warum Controlling, Auswertungen oder Abrechnung
später *additiv* möglich sind. Sie dürfen nicht gebrochen werden.

### I1 — `work_targets` ist die einzige Dimensionstabelle

Alles, worauf Zeit gebucht wird, läuft über `work_targets`
(`target_type IN ('customer','project','general_work')`).

Ein neuer Typ — Kostenstelle, Auftrag, Maschine — ist später eine CHECK-Erweiterung plus
eine Zeile. Kein Rewrite. **Niemals eine parallele Zuordnungstabelle einführen.**

### I2 — Append-only bei fachlicher Wahrheit

`work_events`, `time_record_revisions`, `audit_events`, `canonical_decisions` und
`sync_receipts` werden nur geschrieben, nie fachlich überschrieben.

Deshalb bleiben alte Auswertungen reproduzierbar, wenn sich später etwas ändert (z. B. ein
Stundensatz zum Jahreswechsel). Das ist genau die Eigenschaft, an der die meisten
Zeiterfassungen scheitern, sobald jemand Controlling darauf aufsetzen will.

**Kein `UPDATE` auf fachliche Wahrheit. Korrektur = neuer Revisionsdatensatz.**

### I3 — Der Export ist versioniert

`TIME_ENTRY_EXPORT_SCHEMA_VERSION` V1 → V2 ist bereits sauber migriert. Neue Spalten
erzeugen eine **neue Version**, niemals eine Änderung an einer bestehenden.

Controlling wird V3. Bestehende Kunden-Importe brechen dadurch nicht.

### I4 — Angewendete Migrationen sind eingefroren

Der Migrations-Ledger speichert je Migration eine SHA-256-Prüfsumme und bricht bei
Abweichung ab. Sobald eine Migration auf einer Datenbank mit schützenswerten Daten
verzeichnet ist, ist ihre Datei dauerhaft unveränderlich. Korrekturen kommen
ausschließlich als neue Migration. Die einmalige Änderung von 004 bis 012 am
2026-08-23 war zulässig, weil zu diesem Zeitpunkt keine solche Datenbank existierte.

---

## 5. Offline

Kernerfassung funktioniert ohne Netz (Produktprinzip 4). Die App schreibt in eine lokale
SQLite-Queue und synchronisiert später über `/v1/lifecycle-events/offline` und die
Leases-/Reconcile-Endpunkte. Konflikte werden nicht still aufgelöst, sondern landen in
`Prüfungen` zur Adjudikation durch einen Administrator.

**Regel:** Kein Erfassungsweg darf eine Netzverbindung voraussetzen.

---

## 6. Rollen (Stand heute)

Im Schema existieren genau zwei: `administrator` und `employee`.

`system_owner` und `team_lead` aus dem ursprünglichen Role Model sind **nicht** implementiert.
Das ist eine bewusste v1-Reduktion, kein Versehen. Eine Erweiterung ist additiv möglich.

---

## 7. Was heute fehlt

Ehrlicher Stand, damit niemand es für vorhanden hält:

- **Kein Betrieb.** `infrastructure/` ist leer. Kein Deployment, kein Backup, kein
  getesteter Restore, kein Healthcheck, kein Monitoring.
- **Keine Pausenlogik.** `time_entries` kennt nur `started` und `stopped`.
  Offene Produkt-/Rechtsfrage — siehe `ADO/PLAN.md`, Bahn A.
- **Keine Distribution.** Kein signiertes Release, kein Play-Console-Eintrag.
- **Kein Rechts-/Datenschutzpaket.**

---

## 8. Wo was steht

- Plattformentscheidung: `ADO/01_Architecture/ADR/ADR-0007`, `ADR-0008`
- Alle weiteren Entscheidungen: `ADO/01_Architecture/ADR/`
- Produktabsicht: `ADO/01_Architecture/Product_Vision.md`, `Product_Principles.md`
- Alles unter `ADO/99_Archive/`: Historie, wird nicht gelesen.
