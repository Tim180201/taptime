# TapTim.e — Status

> **Diese Datei wird überschrieben, nie angehängt.** Sie beschreibt nur den Jetzt-Zustand.

**Stand:** 22.08.2026 · **Ziel:** Pilotfähig in ~6 Wochen, verkaufsfähig in ~10–12 Wochen

---

## Wo wir stehen

Das Produkt ist weitgehend gebaut. Was fehlt, ist Betrieb, Distribution und Recht.

**Fertig und im Repository:**

- Domäne und Business Engine (`Trigger → WorkEvent → Engine → TimeEntry`)
- Backend: 15 Module, gebündelt in einem deploybaren Dienst, 34 API-Endpunkte
- Datenbank: 13 Migrationen, Mandantentrennung über RLS
- Mobile-App: NFC-Scan, Offline-Queue, Anmeldung, Einladung/Enrollment, eigene Zeiten,
  manuelle Erfassung
- Admin-Web: Übersicht, Einrichtung, Beschäftigte, Arbeitszeiten, Prüfungen
- Korrekturen mit lückenloser Historie, CSV-Export (V2), Offline-Abgleich
- CI auf GitHub Actions

**Nicht vorhanden:**

- Deployment, Backup, getesteter Restore, Monitoring (`infrastructure/` ist leer)
- Signierte App, Play-Console-Eintrag
- Datenschutz-/Rechtspaket
- Pausenlogik

---

## Was als Nächstes passiert

| # | Was | Wer | Bahn |
|---|---|---|---|
| 1 | Prozess-Reset committen, Altdoku archivieren | Codex | — |
| 2 | Smoke-Test am echten Gerät | Tim | — |
| 3 | Anwaltspaket zusammenstellen und rausgeben | Tim + Claude | A |
| 4 | Backend deployen, Backup + Restore testen | Codex | B |
| 5 | Branding, signiertes Release, Play Internal Track | Tim + Codex | C |

Details in `ADO/PLAN.md`. Die aktuelle Aufgabe steht in `ADO/TASK.md`.

---

## Blockiert / wartet auf Entscheidung

| Was | Von wem | Warum es drängt |
|---|---|---|
| **Pausenerfassung ja/nein** | Tim (ggf. nach Anwaltsauskunft) | Berührt das Datenmodell. Nach dem ersten Kunden nur noch teuer änderbar. |
| **Hosting-Region** | Tim | EU-/DE-Hosting ist im B2B ein Verkaufsargument. Blockiert Bahn B. |
| **App-Package-ID** | Tim | Aktuell `com.tim180201.mobile`. **Nach dem ersten Play-Upload unwiderruflich.** Muss vor dem Release stehen. |
| **Erster Pilotbetrieb** | Tim | Verändert die Priorisierung deutlich. |

---

## Bekannte Kleinigkeiten (blockieren nichts)

- App heißt intern noch `mobile` (Name, Slug, Package-ID) statt TapTim.e.
- Nur zwei Rollen (`administrator`, `employee`). `team_lead` ist eine typische
  B2B-Rückfrage, aber additiv nachrüstbar.
- `apps/backend-b1-spike` ist ein altes Experiment und kann entfernt werden.
- Ungetracktes app.json im Wurzelverzeichnis (seit 20.07.2026), von keinem Build oder Runtime gelesen. Package-ID entscheidet der Product Owner.

---

## Eingefroren

- **`apps/synthetic-android-e2e`** — der automatisierte Hardware-Testlauf ist eingestellt.
  Ersetzt durch `ADO/04_Operations/Smoke_Test_Checkliste.md`. Code bleibt liegen, wird
  nicht weiterentwickelt. Begründung: siehe `ADO/DECISIONS.md`, D-001.
- **Development Assignment 5 / V5-Verfahren** — beendet. Die offene Frage war nie ein
  Produktfehler; im Ereignisprotokoll steht durchgehend `Product finding: NONE`.
