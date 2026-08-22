# TapTim.e — Status

> **Diese Datei wird überschrieben, nie angehängt.** Sie beschreibt nur den Jetzt-Zustand.

**Stand:** 22.08.2026 · **Ziel:** System fertig in ~11 Wochen, erster Kunde in ~4 Monaten

---

## Wo wir stehen

Das Produkt ist weitgehend gebaut. Was fehlt: Betrieb, Standorte, Pausen, fertige Oberflächen —
danach Firma, Recht und Store.

**Fertig und im Repository:**

- Domäne und Business Engine (`Trigger → WorkEvent → Engine → TimeEntry`)
- Backend: 15 Module in einem deploybaren Dienst, 34 API-Endpunkte
- Datenbank: 13 Migrationen, Mandantentrennung über RLS
- Mobile-App: NFC-Scan, Offline-Queue, Anmeldung, Einladung, eigene Zeiten, manuelle Erfassung
- Admin-Web: Übersicht, Einrichtung, Beschäftigte, Arbeitszeiten, Prüfungen
- Korrekturen mit lückenloser Historie, CSV-Export (V2), Offline-Abgleich
- CI auf GitHub Actions
- **Prozess-Reset (T-001)** — Commit `84ac01b`, auf `main`, CI grün

**Nicht vorhanden:**

- Deployment, Backup, getesteter Restore, Monitoring (`infrastructure/` ist leer)
- Standorte und Standortleiter (ADR-0020 ist beschrieben, nicht gebaut)
- Pausenerfassung, Löschkonzept
- Fertige Oberflächen, Landing Page
- Signierte App, Store-Eintrag, Rechtspaket, Firma

---

## Aktuelle Aufgabe

**T-002 — Container und Healthcheck.** Siehe `ADO/TASK.md`.
Läuft vollständig lokal, braucht kein einziges Konto.

Danach T-003 bis T-010, siehe `ADO/PLAN.md`.

---

## Blockiert / wartet auf Entscheidung

| Was | Von wem | Warum es drängt |
|---|---|---|
| **Produktname** | Tim | „TapTime" ist vergeben. Wird für Store, Firma und Domain gebraucht — Deadline Woche 12. Blockiert Phase 1 nicht. |
| **Supabase-Konto** | Tim | Blockiert T-003. |
| **Hetzner-Konto + eine Domain** | Tim | Blockiert T-004. Die Domain ist nur für TLS und **muss nicht der Produktname sein**. |

---

## Bekannte Kleinigkeiten (blockieren nichts)

- App heißt intern noch `mobile` (Name, Slug, Package-ID) statt TapTim.e.
- Ungetracktes `app.json` im Wurzelverzeichnis (seit 20.07.2026), von keinem Build oder Runtime
  gelesen. Package-ID entscheidet der Product Owner.
- Nur zwei Rollen (`administrator`, `employee`). `team_lead` ist eine typische B2B-Rückfrage,
  additiv nachrüstbar. Der Standortleiter aus T-008 deckt den häufigsten Fall ab.
- `apps/backend-b1-spike` ist ein altes Experiment und kann entfernt werden.

---

## Eingefroren

- **`apps/synthetic-android-e2e`** — der automatisierte Hardware-Testlauf ist eingestellt.
  Ersetzt durch `ADO/04_Operations/Smoke_Test_Checkliste.md`. Code bleibt liegen, wird nicht
  weiterentwickelt. Begründung: `ADO/DECISIONS.md`, D-001.
- **Development Assignment 5 / V5-Verfahren** — beendet. Die offene Frage war nie ein
  Produktfehler; im Ereignisprotokoll stand durchgehend `Product finding: NONE`.
