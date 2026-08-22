# TapTim.e — Arbeitsanweisung

> **One Tap. One Decision.**
> Jede Nutzerinteraktion erzeugt genau ein fachliches Ereignis. Die Business Engine
> interpretiert es — nicht der Nutzer.

Diese Datei gilt verbindlich für alle Agenten in diesem Repository. Sie ersetzt die
vorherige Fassung vollständig.

**Vor Arbeitsbeginn zu lesen (zusammen ~10 Seiten, das ist das gesamte Gedächtnis):**
`ADO/STATUS.md` · `ADO/PLAN.md` · `ADO/ARCHITECTURE.md` · `ADO/TASK.md` · `ADO/DECISIONS.md`

---

## 1. Vision-Check — die erste Frage bei jeder Aufgabe

Bevor irgendetwas gebaut wird, muss die Aufgabe diesen Test bestehen:

1. **Reduziert es Entscheidungen für den Nutzer?** Wenn eine Änderung dem Nutzer eine
   Entscheidung *hinzufügt*, ist sie im Zweifel falsch.
2. **Bleibt die Kette intakt?** `Trigger → WorkEvent → BusinessEngine → TimeEntry`.
   Ein Trigger erzeugt nie direkt einen fachlichen Datensatz.
3. **Bleibt es nachvollziehbar?** Korrekturen überschreiben niemals die Original-Historie.
4. **Bleibt die Domäne trigger-agnostisch?** NFC ist der erste Auslöser, nicht die Domäne.

Besteht eine Aufgabe diesen Test nicht, wird sie **nicht implementiert**, sondern als
Produktfrage an den Product Owner gemeldet.

Maßstab bleibt `ADO/01_Architecture/Product_Vision.md` und `Product_Principles.md`.

---

## 2. Rollen

| Rolle | Wer | Entscheidet über |
|---|---|---|
| **Product Owner** | Tim | Produkt, Preis, Recht, Geld, Kunden. **Verhaltensabnahme**: benutzt das Produkt und sagt, ob es das Richtige tut. Go/No-Go bei Deploy, Store-Release, erstem Kunden. |
| **Technical Lead** | Claude | Architektur, Aufgabenzuschnitt, Risiko, **technische Abnahme**. Reviewt jeden Diff vor dem Merge. Schreibt die Briefings. |
| **Development** | Codex | Implementiert genau den Scope aus `ADO/TASK.md`. Führt Tests und Builds aus. Committet nach Freigabe. |

**Der Product Owner autorisiert niemals Commit-Hashes, Trees oder Baselines.**
Er beurteilt Produktverhalten und Geschäft. Technische Abnahme liegt beim Technical Lead.

Fehlende oder widersprüchliche Vorgaben werden als offene Frage gemeldet, nicht durch
Annahmen ersetzt.

---

## 3. Arbeitsweise

- **Codex ist der einzige Schreiber.** Nie zwei Agenten gleichzeitig im Repository.
- **Genau eine Aufgabe gleichzeitig.** Sie steht in `ADO/TASK.md`. Nichts außerhalb dieses
  Scopes wird angefasst.
- Der ausgeführte Code hat Vorrang vor der Dokumentation. Abweichungen werden benannt.
- Änderungen bleiben klein und am Diff nachvollziehbar.
- Unverwandte Dateien und bestehende Nutzeränderungen werden nicht verändert.
- **Jede Aufgabe hat eine Zeitbox.** Reißt sie, wird der Scope geschnitten — nicht die Zeit
  verlängert. Das wird gemeldet, nicht still gelöst.

---

## 4. Verifikation — verhältnismäßig

| Änderung | Erforderlich |
|---|---|
| Dokumentation | Lesbarkeit, keine falsche Aussage. Kein Testlauf. |
| Normaler Code | Typecheck + Tests des betroffenen Workspace grün. CI grün. |
| Auth, Mandantentrennung, personenbezogene Daten, Geld | Zusätzlich ein unabhängiges Review durch einen zweiten Agenten. |
| Release | Zusätzlich Smoke-Test am echten Gerät durch den Product Owner (`ADO/04_Operations/Smoke_Test_Checkliste.md`). |

- Ein Typecheck heißt nur dann „tests-inklusive", wenn die ausgeführte Konfiguration die
  Testdateien nachweislich einschließt.
- **`[skip ci]` ist bei Code-Änderungen verboten.** Nur bei reinen Dokumentänderungen erlaubt.
- Nicht ausgeführte Prüfungen werden mit Grund gemeldet.

---

## 5. Review — die Abbruchregel

Zulässige Ergebnisse: `APPROVED` oder `CHANGES REQUIRED`.

- **Blockieren darf nur P0 und P1.** P0 = kaputt, Datenverlust, Sicherheitsloch.
  P1 = falsches Verhalten im Normalfall.
- **P2 und P3 werden notiert, nicht wiederholt.** Sie landen als Zeile in `ADO/STATUS.md`
  unter „Bekannte Kleinigkeiten" und blockieren nichts.
- **Maximal zwei Review-Runden pro Aufgabe.** Danach entscheidet der Technical Lead:
  liefern oder Scope schneiden. Es gibt keine dritte Runde.

Diese Regel existiert, weil ein Reviewer immer noch ein P2 findet. Ohne sie terminiert
kein Arbeitspaket.

Findings, die eine neue Produkt-, Geschäfts- oder Architekturentscheidung erfordern,
stoppen den Kreislauf und gehen an den Product Owner.

---

## 6. Dokumentation — harte Obergrenzen

| Datei | Max | Regel |
|---|---|---|
| `ADO/STATUS.md` | 1 Seite | **Überschreiben, nie anhängen.** |
| `ADO/PLAN.md` | 2 Seiten | Überschreiben. |
| `ADO/ARCHITECTURE.md` | 3 Seiten | Überschreiben. |
| `ADO/TASK.md` | 1 Seite | Pro Aufgabe überschreiben. |
| `ADO/DECISIONS.md` | 10 Zeilen je Eintrag | Append-only. |
| `ADO/01_Architecture/ADR/` | 2 Seiten je ADR | Eine Entscheidung, ein ADR. |

**Verboten:** Korrektur-Abschnitte anhängen („Correction 2 supersedes Correction 1").
Das Dokument wird editiert. Git ist die Historie.

**Verboten:** SHA-256-Manifeste, versiegelte Evidence-Verzeichnisse, Attempt-Zähler,
Baseline-Hashes in Fließtext. Git ist bereits ein unveränderlicher Hash-Baum.

Alles unter `ADO/99_Archive/` ist Historie und wird nicht gelesen.

---

## 7. Commits und Freigaben

- Kein Commit, Push, PR oder Merge ohne ausdrücklichen Auftrag.
- Nach `APPROVED` durch den Technical Lead darf direkt committet und nach `main` gepusht
  werden. Vorher Remote-Stand prüfen, CI muss grün sein.
- **Produktion, Produktionsdaten, Deployment, Store-Veröffentlichung und alles, was Geld
  kostet, brauchen immer eine separate ausdrückliche Freigabe des Product Owners.**

## 8. Abschlussbericht

Vier Punkte, mehr nicht:

1. Geänderte Dateien
2. Ausgeführte Verifikation (und was ausgelassen wurde, mit Grund)
3. Verbleibende Risiken oder offene Fragen
4. Empfohlener nächster Schritt
