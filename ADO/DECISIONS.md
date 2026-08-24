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

---

## D-010 · PostgreSQL selbstbetrieben, Supabase nur für Auth · 23.08.2026 · Claude (TL)

**Entscheidung:** Die Produktdatenbank läuft als PostgreSQL-Container auf dem eigenen
Hetzner-Server in Deutschland. Supabase bleibt ausschließlich Authentifizierungsanbieter.
Ausführlich in `ADO/01_Architecture/ADR/ADR-0021`.

**Warum:** Sechs Berechtigungshürden in einer einzigen Aufgabe, alle aus derselben Ursache —
das Schema wurde für einen Superuser gebaut, Supabase gibt keinen. Die Fehlerrate nahm nicht ab.
Hürde 5 und 6 hätten Eingriffe in die Rollengraph-Normalisierung verlangt, also in genau den
Code, der die Mandantentrennung absichert. Umgebungszwänge sind das schlechteste Motiv für
solche Eingriffe.

**Möglich, weil:** Das Schema ist vollständig anbieterunabhängig. `identity_bindings` speichert
nur `issuer` und `subject`, keine Referenz auf Supabases `auth`-Schema.

**Nebeneffekte:** Produktion verhält sich exakt wie CI. Personenbezogene Produktdaten liegen in
Deutschland statt bei einem US-Anbieter. Rund 8 € statt 32 € im Monat.

**Preis:** Wir betreiben die Datenbank selbst. Bekannte Einschränkung: Datenbank und Anwendung
zunächst auf demselben Server — vor dem ersten zahlenden Kunden neu zu bewerten.

**Ersetzt** die frühere Empfehlung des Technical Lead, auf Supabase weiterzupatchen.

---

## D-011 — Gründung und Recht laufen als getrennte Uhr neben dem Bau

**Datum:** 23.08.2026 · **Entschieden von:** Tim, vorbereitet vom Technical Lead

**Entscheidung:** D-007 („erst System, dann Firma") bleibt bestehen, wird aber in zwei Uhren
geteilt. Reine Wartezeiten — Markenrecherche, Markenanmeldung, Notartermin, Handelsregister,
Finanzamt, D-U-N-S — starten sofort und laufen neben dem Bau. Bindendes — Anwaltspaket
beauftragen, echte Kundenverträge — wartet auf den eigenen Zweiwochen-Test.

**Warum:** Der Engpass ist nicht mehr die Entwicklung. Die Uhren, die den ersten zahlenden
Kunden bestimmen, laufen bei Dritten: Steuernummer 4–8 Wochen, D-U-N-S bis 30 Tage,
Anwaltspaket 4–8 Wochen, Marke über sechs Monate bis zur Eintragung plus drei Monate
Widerspruchsfrist. Nacheinander kosten sie rund sieben Wochen mehr als nebeneinander.

**Preis:** Rund 400 € Gründungskosten und einige Monate Buchhaltung früher als nötig.

**Nicht verhandelbar:** Zwischen Beurkundung und Handelsregistereintragung haftet der Gründer
für Geschäfte der UG i. G. persönlich. Erste echte Kundenverträge deshalb erst nach der
Eintragung.

---

## D-012 — Die Aufgabenkette wird nach Betriebsfähigkeit sortiert, nicht nach Ausbaustufe

**Datum:** 24.08.2026 · **Entschieden von:** Technical Lead

**Entscheidung:** Vollständige Prüfung aller 21 ADRs, der Vision, der Prinzipien, des Domänen-
und Rollenmodells sowie der drei archivierten Roadmaps gegen den echten Quelltext. Ergebnis:
Die Aufgabenkette wird neu sortiert und um sieben Aufgaben erweitert. `T-001` bis `T-006`
bleiben unverändert, alles danach ist neu nummeriert. Siehe `ADO/PLAN.md`.

**Warum:** Der Produktkern ist belastbar — Mandantentrennung, append-only Historie, Idempotenz,
Offline-Warteschlange und die Kette `Trigger → WorkEvent → Engine → TimeEntry` sind gebaut und
getestet, ohne Umgehungspfad. Was fehlte, war ausnahmslos Betrieb mit echten Menschen. Die alte
Kette hätte Standorte und Oberflächen gebaut, während ein Kunde weiterhin niemanden aussperren
und niemand einen Ausfall bemerken kann.

**Die vier Befunde, die die Sortierung bestimmen:**

1. **Eine Eskalation verschwindet spurlos.** Die Engine eskaliert bei sieben
   Konsistenzverstößen, zwei davon im Alltag erreichbar. Es entsteht kein Zeiteintrag — richtig.
   Die Abstimmzeile wird aber mit `result_status = 'synchronized'` geschrieben, das Gerät
   quittiert, und `read_time_review_items_v1` wählt nur `review_pending`. Folge: Die Arbeitszeit
   ist weg, die Warteschlange leert sich sauber, und kein Administrator sieht den Fall. Die App
   verspricht dem Beschäftigten dabei eine Prüfung, die nie stattfindet. → **T-010**

   *Korrektur des Technical Lead:* Der erste Befundbericht nannte dies richtig. Ich habe ihm
   widersprochen — auf Basis der empfangenden Seite (`OfflineSyncScheduler.ts`) statt der
   sendenden. Auf dem Offline-Weg ist die Hülle immer `synchronized`; `escalation_required` ist
   darin nur die Entscheidung. Für Befunde, die eine Aufgabe auslösen, werden ab jetzt beide
   Enden geprüft.

2. **Kein Weg, jemanden auszusperren.** Die Datenbank kann es und ist dafür getestet; es gibt
   keine Route, keinen Coordinator, keine Oberfläche. Migration 014 hat das ungenutzte Recht
   folgerichtig entzogen. → **T-009**

3. **Im Betrieb entsteht kein einziger Logeintrag.** Das Diagnoseschema mit Allowlist existiert,
   aber `main.ts` ruft `createBackendApiRuntime` ohne `onDiagnostic`. Einzige Laufzeitausgabe:
   eine Zeile auf stderr, wenn der Server nicht startet. → **T-008**

4. **Der Export übersteht keine Prüfung.** Keine Pausen, keine lokale Zeitzone, keine
   garantierte Personenkennung — der Anzeigename darf leer sein —, kein Korrekturhinweis. Eine
   nachträglich verschobene Zeit sieht in der CSV aus wie eine Originalzeit. → **T-012**, **T-013**

**Was ausdrücklich in Ordnung ist:** RLS auf 29 von 29 Tabellen mit `ENABLE` und `FORCE`,
Mandantenkontext transaktionslokal mit Nicht-Leckage-Tests über wiederverwendete Verbindungen,
26 Isolationstests für Lesen und Schreiben, erzwungene Korrekturbegründung, Administrator-
Vorbehalt für Korrekturen, protokollierter und mandantensicherer Export, serverseitige
Idempotenz.

**Nachgetragen:** Sieben Tabellen tragen keine Policy und hängen allein an den Prädikaten ihrer
`SECURITY DEFINER`-Funktionen; darunter `time_record_revisions`, auf der ein `UPDATE`-Recht
liegt, dessen Unveränderlichkeits-Trigger ungetestet ist. Kein akutes Risiko, aber die zweite
Verteidigungslinie fehlt dort. → aufgenommen als bekannte Kleinigkeit, Prüfung in **T-019**.

---

## D-013 — Die Standortleitung verwaltet Beschäftigte an ihrem Standort

**Datum:** 24.08.2026 · **Entschieden von:** Tim, vorbereitet vom Technical Lead

**Entscheidung:** Eine Standortleitung darf Beschäftigte **an ihrem Standort einladen und
aussperren**. ADR-0020, DA6-L05 wird entsprechend überarbeitet, bevor T-015 gebaut wird.

**Warum:** ADR-0020 verbot der Standortleitung ausdrücklich `Memberships` und `invitations`.
Damit hätte sie genau das nicht gekonnt, wofür der Product Owner Standorte eingeführt hat —
D-008: „damit die Verwaltung der Mitarbeiter nicht nur auf den Admin fällt". Der Engpass wäre
geblieben. In einem Nachhilfebetrieb liefe jede neue Lehrkraft zu Semesterbeginn weiter über
eine einzige Person.

**Die Sicherheitsgrenze bleibt unverändert.** Eine Standortleitung darf nicht:

- eine Rolle vergeben — weder Standortleitung noch Administrator. Keine Rechteausweitung.
- jemanden an einen fremden Standort holen oder dort aussperren.
- die eigene Mitgliedschaft oder die eines Administrators verändern.

Alles Übrige aus DA6-L05 bleibt wie beschrieben, insbesondere: niemals die eigene Arbeitszeit
korrigieren, niemals die eigene Prüfung entscheiden, kein organisationsweiter Export.

**Folge für die Reihenfolge:** `T-009` baut Einladen und Aussperren für den Administrator.
Das muss von vornherein so gebaut werden, dass `T-015` es auf einen Standort einschränken kann —
also Berechtigung serverseitig aus Mitgliedschaft und Zuständigkeit ableiten, nicht aus der
Rolle allein. Sonst wird die Fähigkeit zweimal gebaut.

**Offen bis T-015:** ADR-0020 überarbeiten. Der Technical Lead bereitet den Änderungsvorschlag
vor; DA6-L05 und die Ausschlussliste in Abschnitt 5 sind betroffen.

---

## D-014 — Der NFC-Scan ist der Beweis. Alles andere ist eine Behauptung und braucht Freigabe.

**Datum:** 24.08.2026 · **Entschieden von:** Tim, vorbereitet vom Technical Lead

**Entscheidung:** Jede Arbeitszeit, die **nicht** per NFC-Scan entstanden ist, wird als
geändert beziehungsweise manuell **gekennzeichnet** und muss **freigegeben** werden.

**Die Freigabekette:** Immer die nächsthöhere Instanz.

| Wessen Zeit | Wer gibt frei |
|---|---|
| Beschäftigter | Standortleitung, falls vorhanden — sonst Administrator |
| Standortleitung | Administrator |
| Administrator | niemand. Die Kette endet hier. |

**Was Freigabe braucht:** ein Eintrag, dessen Beginn oder Ende `manual` ist, sowie jede
Korrektur. Ein Eintrag kann per Scan beginnen und von Hand enden — dann greift die Regel,
weil die Kennzeichnung pro Grenze gilt, nicht pro Eintrag.

**Was keine Freigabe braucht:** Beginn und Ende beide per NFC-Scan. Auch offline erfasst —
offline ist kein Mangel an Beweis, es ist nur verzögerte Zustellung.

**Warum das die Produktidee stärkt:** Der Tag ist der Beweis. Wer ihn scannt, war körperlich
dort. Alles andere ist eine Aussage über die Vergangenheit und wird von einem Menschen
bestätigt. Damit ist NFC nicht mehr nur der bequemste Weg, sondern der **einzige ohne
Zusatzaufwand** — ein echter Grund für einen Kunden, Tags aufzuhängen.

**Verhältnis zur Vision:** „One Tap. One Decision." bleibt unberührt. Der Beschäftigte tippt
weiterhin genau einmal und entscheidet nichts. Die Freigabe passiert danach und woanders.

**Ersetzt** die Vorüberlegung aus ADR-0020, der Standortleitung die Korrektur eigener Zeiten zu
verbieten. Verbieten war das falsche Mittel — sichtbar machen und bestätigen lassen ist das
richtige. Damit darf auch der Administrator seine eigene Zeit korrigieren; heute kann er das
ohnehin, nur unsichtbar.

**Folgen:**

- Neue Dimension am Zeiteintrag: *bestätigt / wartet auf Bestätigung / abgelehnt*. `time_entries`
  kennt heute nur `started` und `stopped`. Braucht eine eigene ADR.
- `T-013` kennzeichnet im Export. Die Daten liegen bereits vor: `started_via` und `stopped_via`
  aus Migration 013.
- **`T-020`** baut die Freigabekette. Nach `T-015`, weil die Kette die Standortleitung als
  Instanz voraussetzt.
- Der Export bleibt **vollständig** und weist Unbestätigtes in einer eigenen Spalte aus. Eine
  vergessene Freigabe darf nicht dazu führen, dass jemandem Geld auf der Abrechnung fehlt.
  Vom Technical Lead entschieden, vom Product Owner überstimmbar.
