# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-001 · Prozess-Reset

**Für:** Codex · **Risiko:** Dokumentation · **Zeitbox:** eine Arbeitssitzung
**Freigegeben von:** Tim (Product Owner), 22.08.2026

### Ziel

Das Projektgedächtnis auf die fünf Kerndateien reduzieren. Kein Code wird angefasst.

### Schritte

**1. Arbeitsanweisung ersetzen**

- Inhalt von `AGENTS.v2.md` nach `AGENTS.md` übernehmen (alte Fassung vollständig ersetzen)
- `AGENTS.v2.md` löschen

**2. Altdokumentation archivieren**

Alles unter `ADO/` nach `ADO/99_Archive/` verschieben — **außer** dieser Liste:

```
ADO/STATUS.md
ADO/PLAN.md
ADO/ARCHITECTURE.md
ADO/TASK.md
ADO/DECISIONS.md
ADO/00_Core/Glossary.md
ADO/01_Architecture/ADR/                    (vollständig)
ADO/01_Architecture/Product_Vision.md
ADO/01_Architecture/Product_Principles.md
ADO/01_Architecture/Domain_Model.md
ADO/01_Architecture/Role_Model.md
ADO/01_Architecture/NFC_Capability_Model.md
ADO/01_Architecture/System_Overview.md
ADO/01_Architecture/Tech_Stack.md
ADO/01_Architecture/Coding_Standards.md
ADO/01_Architecture/Technical_Architecture_Profile.md
ADO/04_Operations/Smoke_Test_Checkliste.md
```

- **`git mv` verwenden**, damit die Historie erhalten bleibt.
- Die Ordnerstruktur unterhalb von `99_Archive/` spiegelt den bisherigen Pfad.
- Archivieren heißt **nicht** löschen. Alles bleibt in Git und ist jederzeit abrufbar.

**3. Wurzel-`README.md` aktualisieren**

Der Abschnitt „Current Phase" wird ersetzt durch einen kurzen Verweis auf `ADO/STATUS.md`,
`ADO/PLAN.md` und `ADO/ARCHITECTURE.md`. Der Rest der Datei bleibt unverändert.

**4. `.DS_Store`-Dateien aus dem Arbeitsbaum entfernen.** In `.gitignore` stehen sie bereits.

**5. Zwei ungetrackte Fundstücke behandeln**

- `research/Time_Tracking_Market_Analysis_2026-07-14.md` — Marktanalyse, nie eingecheckt.
  Wird **mit committet**, sie wird für Preisfindung und Anwaltspaket gebraucht.
- `app.json` **im Wurzelverzeichnis** — enthält nur `android.package = com.tim180201.taptime`
  und widerspricht `apps/mobile/app.json` (`com.tim180201.mobile`).
  **Nicht löschen, nicht ändern.** Nur melden: seit wann existiert die Datei, wird sie von
  irgendetwas gelesen? Die Package-ID entscheidet der Product Owner (siehe `ADO/STATUS.md`).

### Nicht anfassen

- Alles unter `apps/`, `packages/`, `tests/`, `infrastructure/`, `scripts/`, `.github/`
- `package.json`, `package-lock.json`, `tsconfig*.json`
- **`apps/synthetic-android-e2e` bleibt unverändert liegen** (siehe D-001) — kein Rückbau,
  keine Löschung.

### Prüfung

- `git status` zeigt ausschließlich Verschiebungen, die neuen Kerndateien, `README.md`
  und die Marktanalyse
- Kein Diff in `apps/`, `packages/` oder Konfigurationsdateien
- Die fünf Kerndateien sind an ihrem Platz und lesbar
- Kein Test-, Build- oder Typecheck-Lauf nötig — es ändert sich keine ausführbare Zeile

### Abschluss

Vier Punkte an den Technical Lead melden: geänderte Dateien · ausgeführte Prüfung ·
verbleibende Risiken · nächster Schritt.

**Nicht committen**, bevor der Technical Lead den Diff geprüft und `APPROVED` gemeldet hat.

---

## Danach

`T-002` (Bahn B, Deployment) wird vom Technical Lead hier eingetragen, sobald Tim die
Hosting-Region entschieden hat. Siehe `ADO/PLAN.md`.
