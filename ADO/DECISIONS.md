# TapTim.e — Entscheidungen

Append-only. Ein Eintrag pro echter Entscheidung, maximal zehn Zeilen.
Kein Verlauf, keine Korrektur-Abschnitte — bei Änderung wird ein neuer Eintrag ergänzt,
der den alten mit `Ersetzt:` benennt.

Architekturentscheidungen mit Tragweite bekommen zusätzlich ein ADR unter
`ADO/01_Architecture/ADR/`.

---

## D-001 · Automatisierter Hardware-Testlauf eingestellt · 22.08.2026 · Tim + Claude

**Entscheidung:** `apps/synthetic-android-e2e` wird eingefroren. Der V5-Hardware-Gate wird
durch eine manuelle Checkliste ersetzt (`ADO/04_Operations/Smoke_Test_Checkliste.md`).

**Warum:** Der Harness war mit 42.744 Zeilen das größte Modul im Repository — größer als die
Mobile-App. In drei Wochen erzeugte er 13 Anläufe, keinen abgeschlossenen Testlauf und keinen
einzigen Produktfehler (`Product finding: NONE` im gesamten Ereignisprotokoll). Bei einem
Test, dessen Orakel ohnehin ein Mensch mit einem NFC-Chip ist, kostet die Automatisierung
mehr als sie einbringt.

**Folge:** Code bleibt liegen, wird nicht weiterentwickelt. Kein Rückbau nötig.

---

## D-002 · Review blockiert nur bei P0/P1 · 22.08.2026 · Tim + Claude

**Entscheidung:** Ein Review darf nur bei P0- und P1-Findings blockieren. P2/P3 werden in
`STATUS.md` notiert. Maximal zwei Runden pro Aufgabe.

**Warum:** Ein LLM-Reviewer findet immer noch ein P2. In Kombination mit der alten Regel
„nach jeder Korrektur ein neues Review" konnte kein Arbeitspaket strukturell terminieren.
Genau das ist bei DA5 über fünf Runden passiert, mit Findings wie „prejournal creation
identity was not persisted before fallible initial realpath/readback" — Fehler im Prüfwerkzeug,
nicht im Produkt.

---

## D-003 · Rollen neu geschnitten · 22.08.2026 · Tim + Claude

**Entscheidung:** Der Product Owner autorisiert keine Commit-Hashes, Trees oder Baselines
mehr. Er entscheidet über Produkt, Geschäft und Verhaltensabnahme. Die technische Abnahme
liegt beim Technical Lead (Claude), der jeden Diff prüft.

**Warum:** Tim hat keine Programmiererfahrung. Die Freigabe exakter Hashes war ein Stempel
ohne Prüfung. Die Agenten haben diesen Hohlraum mit immer aufwendigerer Selbstverifikation
gefüllt — daher die 778.000 Wörter Dokumentation.

---

## D-004 · Begrenztes Projektgedächtnis · 22.08.2026 · Tim + Claude

**Entscheidung:** Fünf Dateien mit harter Obergrenze (`STATUS`, `PLAN`, `ARCHITECTURE`,
`TASK`, `DECISIONS`, zusammen ~10 Seiten) sind das gesamte laufende Projektgedächtnis.
Alles Bisherige wandert nach `ADO/99_Archive/` und wird nicht mehr gelesen.

**Warum:** Codex und Claude haben kein Gedächtnis zwischen Sitzungen. Jeder Agent hat
defensiv alles aufgeschrieben, was ein Nachfolger brauchen könnte — das skaliert ins
Unendliche. Ein begrenztes Gedächtnis, das in zwei Minuten lesbar ist, löst dasselbe Problem
und bleibt aktuell.

---

## D-005 · Kein Controlling vor dem ersten Kunden · 22.08.2026 · Tim + Claude

**Entscheidung:** Controlling, Stundensätze, Budgets und Auswertungen werden jetzt **nicht**
gebaut. Stattdessen werden drei Invarianten gehalten (`ARCHITECTURE.md`, I1–I3):
`work_targets` als einzige Dimensionstabelle, Append-only bei fachlicher Wahrheit,
versionierter Export.

**Warum:** Erweiterbarkeit entsteht nicht durch vorgezogene Felder, sondern durch ein
Datenmodell, das später additiv wächst. Ein ungenutztes Feld ist Datenschutz-Ballast.
Die drei Invarianten sind bereits vorhanden und müssen nur gehalten werden.
