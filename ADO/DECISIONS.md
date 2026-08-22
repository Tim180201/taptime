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

---

## D-006 · Hosting bei Hetzner in Deutschland · 22.08.2026 · Claude (TL)

**Entscheidung:** Der Backend-Container läuft bei Hetzner Cloud, Standort Deutschland
(Nürnberg oder Falkenstein). Supabase bleibt wie in ADR-0008 entschieden, in der EU-Region.

**Warum:** Deutsche Firma, deutsches Recht, Server in Deutschland — im B2B-Verkaufsgespräch das
stärkste Argument auf die Frage „wo liegen unsere Daten?". Rund 8 € netto im Monat.
Der Mehraufwand gegenüber einer PaaS entfällt praktisch, weil Backup, Restore und Healthcheck
für den B2B-Verkauf ohnehin selbst beherrscht werden müssen.

**Offen für den Anwalt:** Supabase ist eine US-Firma, auch mit EU-Region.

---

## D-007 · Erst System fertig, dann offiziell · 22.08.2026 · Tim

**Entscheidung:** Das Produkt wird vollständig fertiggestellt und selbst getestet, bevor
Firmengründung, Anwalt und Store angegangen werden.

**Warum:** Der Anwalt beschreibt dann ein fertiges Produkt statt eines geplanten — billiger,
schneller, präziser. Verzeichnis und TOM müssen nicht zweimal geschrieben werden.

**Grenze:** Recht wird zwingend, sobald echte Beschäftigte eines fremden Betriebs ihre echten
Zeiten stempeln. Eigener Test, Freunde und erfundene Daten sind rechtlich frei.

**Preis:** Ein bis drei Wochen mehr, weil die Anwaltszeit seriell statt parallel läuft.

---

## D-008 · Standorte und Standortleiter kommen in Phase 1 · 22.08.2026 · Tim

**Entscheidung:** ADR-0020 (DA6-L01…L11) wird in Phase 1 umgesetzt. Der Standortleiter erhält
**volle Administration begrenzt auf seinen Standort**.

**Warum:** Bei einem Betrieb mit mehreren Filialen ist ein einzelner Administrator ein
Flaschenhals und ein Ausfallrisiko. Der Zweck ist Delegation der Mitarbeiterverwaltung.

**Architektur:** Der Standort ist eine **Berechtigungsdimension**, keine Buchungsdimension.
`work_targets` bleibt unangetastet — Invariante I1 hält. Die Trennung muss auch per RLS in der
Datenbank durchgesetzt werden, nicht nur im Anwendungscode. Risikoklasse R3 mit verpflichtendem
unabhängigem Review.

**Ersetzt** die frühere Einschätzung des Technical Lead, Standorte nach dem ersten Kunden zu
bauen. Sie beruhte auf der falschen Annahme, kein Zielkunde brauche sie.

---

## D-009 · TapTim.e bleibt generisch · 22.08.2026 · Tim

**Entscheidung:** Es wird nicht für einen konkreten Kunden oder eine Branche gebaut. Jede
Anforderung wird auf einen allgemeinen Begriff abgebildet, den das Modell bereits kennt.

**Beispiel:** Ein Nachhilfeschüler ist ein **Projekt**. Eine Filiale ist ein **Standort**.
Beides existiert bereits generisch.

**Warum:** Diese Regel steht schon in ADR-0020 selbst. Sie wird hier festgeschrieben, damit sich
keine branchenspezifische Annahme unbemerkt in den Code schleicht.
