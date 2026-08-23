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
- CI auf GitHub Actions — 11 Jobs, alle produktrelevant
- **T-001 Prozess-Reset** — `84ac01b`
- **T-002 Container und Healthcheck** — `e7a16f0`, `/health` mit eigenem Verbindungspool,
  Dockerfile ohne root, `env.example` mit 17 Least-Privilege-Rollen
- **T-002b** — `1c81aed`, eingefrorener Harness aus CI entfernt (1.180 → 767 Zeilen)

**Nicht vorhanden:**

- Deployment, Backup, getesteter Restore, Monitoring (`infrastructure/` ist leer)
- Standorte und Standortleiter (ADR-0020 ist beschrieben, nicht gebaut)
- Pausenerfassung, Löschkonzept
- Fertige Oberflächen, Landing Page
- Signierte App, Store-Eintrag, Rechtspaket, Firma

---

## Aktuelle Aufgabe

**T-003 — Supabase EU, Schema und 17 Laufzeitrollen.** Siehe `ADO/TASK.md`.
Berührt die Mandantentrennung, daher mit verpflichtendem unabhängigem Review.

Danach T-004 bis T-010, siehe `ADO/PLAN.md`.

## Schätzung gegen Wirklichkeit

Der Technical Lead führt beide Zahlen mit, um eigene systematische Fehler zu erkennen.

| Aufgabe | Geschätzt | Tatsächlich |
|---|---|---|
| T-001 | eine Sitzung | eine Sitzung + eine Nachbesserung |
| T-002 | zwei Sitzungen | zwei Sitzungen (inkl. T-002b) |
| T-003 | zwei Sitzungen | offen |

---

## Blockiert / wartet auf Entscheidung

| Was | Von wem | Warum es drängt |
|---|---|---|
| **Produktname** | Tim | „TapTime" ist vergeben. Wird für Store, Firma und Domain gebraucht — Deadline Woche 12. Blockiert Phase 1 nicht. |
| **`.env.bootstrap`** | Tim | Blockiert T-003. Zwei Zeilen: Supabase-Admin-Verbindung und Issuer-URL. |
| **Domain `tb-infra.de`** | Tim | Blockiert T-004 — ohne Domainname kein TLS-Zertifikat. Nur technisch, **nicht der Produktname**. |

---

## Bekannte Kleinigkeiten (blockieren nichts)

- App heißt intern noch `mobile` (Name, Slug, Package-ID) statt TapTim.e.
- Ungetracktes `app.json` im Wurzelverzeichnis (seit 20.07.2026), von keinem Build oder Runtime
  gelesen. Package-ID entscheidet der Product Owner.
- Nur zwei Rollen (`administrator`, `employee`). `team_lead` ist eine typische B2B-Rückfrage,
  additiv nachrüstbar. Der Standortleiter aus T-008 deckt den häufigsten Fall ab.
- `apps/backend-b1-spike` ist ein altes Experiment und kann entfernt werden.
- **P2:** `/health` löst pro Aufruf eine Datenbankabfrage aus. Der eigene Pool (`max: 1`) schützt
  die Fachmodule, aber ein Ergebnis-Zwischenspeicher von wenigen Sekunden würde das Thema ganz
  erledigen.
- **P3:** Fünf hohe npm-Audit-Meldungen, alle im Expo/Metro-Build-Werkzeug der Mobile-App.
  Nichts davon läuft im Backend-Container. Updates verfügbar.
- Mit dem entfernten CI-Job entfielen auch Absicherungen gegen bekannte Lücken in
  Abhängigkeiten (GHSA-Einträge, `image-size`). Falls das erhalten bleiben soll, gehört es in
  eine eigene Abhängigkeits-Richtlinie — nicht zurück in den eingefrorenen Harness.
- Geparkte Idee: **`ADO/RESULT.md`** — Codex schreibt seinen Abschlussbericht ins Repo statt nur
  in den Chat. Spart dem Product Owner bei jeder Aufgabe einen Handgriff.

---

## Eingefroren

- **`apps/synthetic-android-e2e`** — der automatisierte Hardware-Testlauf ist eingestellt.
  Ersetzt durch `ADO/04_Operations/Smoke_Test_Checkliste.md`. Code bleibt liegen, wird nicht
  weiterentwickelt. Begründung: `ADO/DECISIONS.md`, D-001.
- **Development Assignment 5 / V5-Verfahren** — beendet. Die offene Frage war nie ein
  Produktfehler; im Ereignisprotokoll stand durchgehend `Product finding: NONE`.
