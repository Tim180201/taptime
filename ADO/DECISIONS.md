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

---

## D-015 — Erst die Content-Security-Policy, dann die bequemere Sitzung

**Datum:** 24.08.2026 · **Entschieden von:** Tim, vorbereitet vom Technical Lead

**Entscheidung:** In `T-017` werden zwei zusammengehörige Dinge gemeinsam geändert:

1. Eine **strikte Content-Security-Policy** für `admin.tb-infra.de`. Heute gibt es keine — weder
   in Caddy noch in der Seite.
2. Die Anmeldung wandert von „nur im Arbeitsspeicher" auf **`sessionStorage`**: Sie überlebt das
   Neuladen der Seite und endet mit dem Schließen des Tabs.

**Die Reihenfolge ist Teil der Entscheidung.** Ohne CSP wird 2 nicht gebaut.

**Warum:** ADR-0015, DA4-P10 hält Token bewusst nur im Arbeitsspeicher — „Reload starts signed
out". Der Gedanke ist richtig, aber die Wirkung begrenzt: Wer Fremdcode in der Seite ausführen
kann, erreicht auch den Arbeitsspeicher. Was solchen Code verhindert, ist eine CSP. Wir haben
bisher die unbequeme Hälfte des Schutzes und nicht die wirksame.

**Der Preis der heutigen Lösung** trägt ausgerechnet die Person, die am meisten mit dem System
arbeitet. Ein Standortleiter, der F5 drückt, den Laptop zuklappt oder dessen Tab abstürzt, meldet
sich neu an — bei täglicher Nutzung der Unterschied zwischen Werkzeug und Zumutung.

**Warum `sessionStorage` und nicht `localStorage`:** Die Sitzung endet mit dem Tab. Ein
vergessener Rechner im Betrieb hält keine offene Sitzung über Nacht.

**Offen bis T-017:** ADR-0015, DA4-P10 überarbeiten. Der Technical Lead bereitet den
Änderungsvorschlag vor.

---

## D-016 — Die Pause ist ein Auslöser, kein Knopf

**Datum:** 25.08.2026 · **Entschieden von:** Tim, vorbereitet vom Technical Lead

**Entscheidung:** Pausen werden über einen **eigenen Auslöser** erfasst — NFC-Tag oder Eintrag in
der App. Nicht aus Lücken berechnet und nicht automatisch abgezogen.

**Warum nicht aus Lücken:** Eine Lücke ist mehrdeutig. Zwischen zwei Schülern liegen Fahrzeit,
Vorbereitung oder Wartezeit — je nach Vertrag bezahlte Arbeitszeit. Das System kann das nicht
unterscheiden, ein Mensch schon. Ein Lückenmodell hätte laufend Nacharbeit erzeugt. Eindeutige
Daten sind für einen Nachweis mehr wert als zwei gesparte Antippen.

**Warum nicht automatisch abziehen:** Das dokumentiert eine Pause, die vielleicht nie
stattgefunden hat. Bei einer Prüfung ist das ein falscher Nachweis.

### Zwei Festlegungen, die nicht verhandelbar sind

**1. Kein „Pause starten"-Knopf.** Der Beschäftigte meldet ein Ereignis — „Pause" — und die
Engine entscheidet, was es bedeutet:

- Arbeit läuft → Pause beginnt
- Pause läuft → Pause endet
- nichts läuft → ablehnen oder eskalieren

Dieselbe Kette wie beim NFC-Scan: `Trigger → WorkEvent → Engine → Ergebnis`. Sonst entscheidet
wieder der Benutzer, und die Vision ist an der Stelle durchbrochen, an der sie zählt.

**2. Der Zeiteintrag bleibt während der Pause offen.** Die Pause ist ein eigenes Intervall
**innerhalb** des laufenden Eintrags. Würden wir stattdessen stoppen und neu starten, müsste der
Beschäftigte danach erneut auswählen, für wen er arbeitet — genau die Reibung, die das Produkt
vermeidet.

### Keine Bewertung, nur Aufzeichnung

Das System hält fest, was war, und urteilt **nicht** über § 4 ArbZG. Die Prüfung auf Verstöße —
über sechs Stunden ohne 30 Minuten Pause — ist ein starkes Verkaufsargument und additiv
nachrüstbar. Sie wird nach dem Pilotbetrieb entschieden, wenn wir wissen, ob Kunden sie wollen.

**Bauvorgabe dafür:** Das Datenmodell muss die Auswertung später erlauben, ohne Umbau. Also
Pausenintervalle mit Beginn, Ende und Auslöserart, nicht nur eine Minutensumme am Eintrag.

**Folgen:**

- Berührt `packages/core` und die Entscheidungsmenge der Engine — der am stärksten geschützte
  Teil. Entsprechend sorgfältig und mit unabhängigem Review.
- Nach **D-014** gilt: per NFC ausgelöste Pause = Beweis, manuell erfasste Pause = Kennzeichnung
  und Freigabe.
- `T-013` nimmt die Pausen in den Export auf.
- Ein vergessenes Pausenende verhält sich wie ein vergessener Stopp — bekannte Einschränkung,
  korrigierbar.

---

## D-017 — Der Export trägt alle Daten, aber keine Einstellungen

**Datum:** 25.08.2026 · **Entschieden von:** Tim, vorbereitet vom Technical Lead · **Gilt für:** T-013

**Entscheidung:** Der Export enthält **jedes Feld**, das eine Lohnbuchhaltung brauchen könnte —
Personenkennung, Datum, Beginn, Ende, Pausen, Ziel, Kennzeichnung manuell erfasst, Kennzeichnung
korrigiert, Zeitzone. Etwa zwölf Spalten.

Er bekommt **keinen Spaltenwähler, keine Vorlagen, keine kundenspezifische Konfiguration.**

**Die Unterscheidung, um die es geht:** Vollständigkeit der Daten ist nicht dasselbe wie
Einstellbarkeit des Formats. Wer weniger Spalten braucht, löscht eine in Excel. Eine Einstellung
dagegen muss gebaut, getestet, dokumentiert, migriert und jedem Kunden erklärt werden.

**Warum jetzt keine Konfigurierbarkeit:** Wir wissen noch nicht, was Kunden brauchen. Das ist
eine Unsicherheit, die sich mit einem Gespräch beim Steuerberater auflöst, nicht mit einem
Feature. Der Export ist bereits **versioniert** — ein DATEV-Format oder was der erste Kunde
verlangt, kommt später additiv dazu, ohne Umbau.

**Offene Nutzerfrage vor T-013:** Was muss drinstehen, damit eine Lohnbuchhaltung damit arbeiten
kann? Steuerberater oder Pilotbetrieb fragen. Echte Nutzerforschung, keine Formalie.

---

## D-018 — Löschklassen jetzt, Aufbewahrungsdauern einstellbar

**Datum:** 25.08.2026 · **Entschieden von:** Tim, vorbereitet vom Technical Lead · **Gilt für:** T-016

**Entscheidung:** `T-016` baut die **Fähigkeit** zu löschen, nicht eine bestimmte Frist. Jede
Datenart bekommt eine **Aufbewahrungsklasse** — Arbeitszeiten, Protokolle, Prüfposten,
Mitgliedschaften, Einladungen. Die Dauer je Klasse ist eine **Einstellung**, keine Migration.

**Was sich später nicht ändern lässt, ist die Einteilung.** Fehlt sie oder ist sie falsch, muss
sie auf Bestandsdaten nachgezogen werden — mühsam und fehleranfällig. Also: Klassen jetzt
richtig, Zahlen später verstellbar.

**Korrektur an „gesetzliche Untergrenzen":** Es gibt keine freie Wahl nach oben. Zu kurz
aufbewahren verstößt gegen Arbeitszeit- und Steuerrecht, zu lang aufbewahren gegen die
Speicherbegrenzung nach Art. 5 DSGVO. Für jede Datenart gibt es eine richtige Dauer, keine
Bandbreite.

**Gesichert:** Arbeitszeitaufzeichnungen **zwei Jahre** — § 16 Abs. 2 ArbZG und § 17 MiLoG.
**Noch zu prüfen:** Fristen für Lohn- und Buchungsunterlagen nach der Abgabenordnung. Dort hat
sich zuletzt etwas geändert; der Technical Lead recherchiert frisch, wenn T-016 geschrieben wird,
statt veraltete Zahlen in eine Aufgabe zu schreiben.

**Nicht vergessen — die Sicherungen.** Stündliche Borg-Archive, bis zu sechs Monate Aufbewahrung.
Verlangt jemand Löschung nach Art. 17 DSGVO und die Daten leben in vierzig Archiven weiter, ist
die Löschung unvollständig. Die anerkannte Antwort ist, dass die Löschung mit dem Ablauf der
Sicherungen nachzieht — aber das muss **beschrieben** sein, sonst ist es beim Anwalt zu erklären.

---

## D-019 — Der Pilotkunde rückt die Firmengründung auf den kritischen Pfad

**Datum:** 25.08.2026 · **Entschieden von:** Tim, eingeordnet vom Technical Lead

**Lage:** Ein Nachhilfebetrieb steht als Pilotkunde bereit — warmer Kontakt, der Inhaber ist von
der Idee überzeugt. Er will **so schnell wie möglich mit echten Daten** arbeiten.

**Einordnung, damit die Erwartung stimmt:** „Begeistert von der Idee" ist Zustimmung zum Konzept,
keine Zusage zur Einführung und keine Aussage über Zahlungsbereitschaft. Wertvoll ist der
Zugang zu einem echten Betrieb mit echtem Personal — nicht der Beweis, dass jemand zahlt.

**Entscheidung:** Der Pilot läuft **zweistufig**.

| Stufe | Inhalt | Voraussetzung |
|---|---|---|
| **Trockenlauf** | Der Inhaber klickt sich durch, erfundene Schüler, erfundene Lehrkräfte | keine — startet sofort |
| **Echtbetrieb** | Echte Beschäftigte stempeln echte Zeiten | UG eingetragen **und** AVV unterschrieben |

**Warum:** Mit der ersten echten Arbeitszeit einer fremden Beschäftigten wird TapTim.e
Auftragsverarbeiter nach Art. 28 DSGVO. Ohne Firma haftet der Product Owner dafür mit seinem
Privatvermögen.

**Folge für D-011:** Die Firmengründung war dort eine Optimierung — sieben Wochen sparen. Sie ist
jetzt eine **Voraussetzung**. Rechtsform und Notartermin gehören in diese Woche, nicht nach dem
Selbsttest.

**Vorbereitung durch den Technical Lead:** AVV, Verarbeitungsverzeichnis und TOM als Entwürfe,
damit der Anwalt prüft statt schreibt. Spart Wochen und mehrere hundert Euro.

**Offene Nutzerfragen an den Inhaber, vor T-013 und T-017:**

1. Wie werden die Zeiten heute erfasst — und wird für etwas bezahlt?
2. Was passiert heute, wenn jemand vergisst einzutragen?
3. Was braucht der Steuerberater am Monatsende? (löst die offene Frage aus D-017)

---

## D-020 — Befund aus dem Pilotgespräch: Wettbewerb und der eigentliche Schmerz

**Datum:** 25.08.2026 · **Festgehalten vom Technical Lead** · **Kein Beschluss, ein Befund**

Der Pilotbetrieb hat zwei Dinge mitgeteilt, die die Lage verändern.

### 1. Der Betrieb nutzt bereits Jibble — und Jibble bietet NFC kostenlos an

Jibble bewirbt einen „100 % KOSTENLOSEN NFC-Anwesenheitstracker". Der Zielkunde hat die
Kernfunktion also bereits, ohne dafür zu zahlen.

**Folge: NFC ist kein Unterscheidungsmerkmal.** Die Frage „Warum sollte ein Betrieb wechseln?"
hat keine Antwort mehr, die auf Technik beruht. Zu prüfen sind die Grenzen des kostenlosen
Tarifs — und vor allem, was am bestehenden Werkzeug stört.

### 2. Die Bezahlung hängt an einem monatlichen Einreichvorgang

Wörtlich: *„Lehrer werden erst bezahlt, wenn alle Stunden des Monats korrekt eingereicht sind."*

Es gibt also einen **monatlichen Abschluss mit Prüfung**, an dem die Auszahlung hängt. Das ist
echter finanzieller Schmerz — bei den Beschäftigten und beim Inhaber, der hinterherläuft.

**Vergleich mit dem, was wir gebaut haben:** Die Freigabekette aus D-014 arbeitet **pro Eintrag
und laufend**. Der reale Prozess arbeitet **pro Person und pro Monat**. Dieselbe Bedürfnislage,
andere Form. Durch Nachdenken haben wir sie nicht getroffen.

### Konsequenz für den Bau

D-009 bleibt: Wir bauen generisch, kein Nachhilfe-Produkt. **Aber generisch ist nicht dasselbe
wie geraten.** Wer nicht fragt, baut trotzdem für einen Betrieb — nur für einen ausgedachten.

„Monatsabschluss mit Freigabe, an dem die Abrechnung hängt" ist kein Nachhilfe-Merkmal. Zeitarbeit,
Pflege, Handwerk und Reinigung kennen dasselbe. Das Muster wird generisch gebaut, nicht der
Einzelfall.

**Zu entscheiden vor T-020:** Ob die Freigabekette um einen **Monatsabschluss je Person**
ergänzt wird — oder ob er sie ersetzt. Erst nach der offenen Frage unten.

### Offen — die wichtigste Frage an den Inhaber

**„Was nervt Sie an Jibble?"**

Ohne Antwort darauf gibt es keine Positionierung. Hat er keine, ist die Begeisterung Höflichkeit
und der Pilot kein Marktbeleg.

---

## D-021 — Anrede und ein verbindliches Regelwerk für Oberflächen

**Datum:** 25.08.2026 · **Entschieden von:** Tim, vorbereitet vom Technical Lead

**Entscheidung 1 — Anrede:** Das **Admin-Web siezt**, die **App duzt**, die **Landing Page
siezt**. Innerhalb einer Oberfläche wird nie gemischt.

**Begründung:** Im Web handelt man im Namen des Betriebs über andere Menschen — deutsche
Betriebssoftware siezt, und der Käufer ist der Inhaber. In der App geht es um die eigene
Arbeitszeit, zehnmal am Tag. Die App duzt heute bereits konsequent; das Web sprach bisher
niemanden an.

**Entscheidung 2 — Regelwerk:** `ADO/01_Architecture/UI_Leitlinien.md`. Codex baut bei jeder
Oberflächenaufgabe dagegen. Abweichungen sind erlaubt, aber im Bericht zu begründen.

**Warum ein eigenes Dokument:** Sonst entscheidet jede Aufgabe die Oberfläche neu, und nach drei
Aufgaben sieht das Produkt aus wie von drei Leuten gebaut.

**Zwei eigene Entwürfe des Technical Lead wurden dabei widerlegt:**

- **Reiter oben** waren falsch. Ab fünf Bereichen gehört eine Seitenleiste hin, und wir haben
  fünf. Reiter kosten über 20 % der Fläche, eine Seitenleiste rund 6 %.
- **Kartenansicht auf schmalen Bildschirmen** war falsch. Der Zweck einer Tabelle ist der
  Vergleich zwischen Zeilen; Karten zerstören ihn. Richtig ist eingefrorene erste Spalte plus
  seitliches Scrollen.

**Verbindlicher Wortschatz:** *Betrieb* statt Organisation, *Beschäftigte* statt Mitarbeiter,
*Arbeitsziel* als Oberbegriff für Kunde, Projekt und Allgemeine Arbeitszeit. Keine englischen
Begriffe in der Oberfläche. Vollständige Liste im Regelwerk.

---

## D-022 — Ein Standort wird nie rückwirkend vergeben

**Datum:** 26.08.2026 · **Entschieden vom Technical Lead** · **Ausarbeitung:** `ADR-0025`

Laufende Zeiteinträge und Pausen blockieren das Einschalten **nicht** und bleiben ohne Standort.
Wiederhergestellte Zeiten erhalten ihn nur aus eindeutiger eigener Evidenz, nie aus dem heutigen
Standort von Kunde, Projekt oder NFC-Zuordnung.

**Warum:** Ein vergessener Stopp würde das Einschalten sonst dauerhaft blockieren, und ein
nachgetragener Standort schreibt Geschichte um. „Kein Standort" ist wahr, „der heutige
Standort" ist falsch und sieht wie ein Messwert aus — dieselbe Linie wie D-014.

**Folgen:** Ergänzt ADR-0020 DA6-L01, schärft DA6-L06. T-015a vergibt an keinen Bestands- oder
Wiederherstellungsdatensatz einen Standort; die Regel wird in T-015b umgesetzt.

---

## D-023 — Berechtigung liefert einen Umfang, keinen Wahrheitswert

**Datum:** 27.08.2026 · **Entschieden vom Technical Lead** · **Korrigiert:** ADR-0022

`has_membership_management_authority_v1` antwortet künftig mit dem erlaubten **Umfang** statt mit
wahr oder falsch — mit ausdrücklichem `scope_kind` (`organization` oder `location`), damit `NULL`
nie als betriebsweite Freigabe durchgeht. Die fachliche Entscheidung bleibt an einer Stelle; die
Leseprojektion filtert mit dem gelieferten Umfang.

Einladungen tragen den Standort im Datensatz **und** im Idempotenz-Digest, werden bei der
Einlösung erneut autorisiert und legen in derselben Transaktion den Heimatstandort an.

**Warum:** ADR-0022 behauptete, nur der Körper einer Funktion sei zu ändern. Falsch — aus einem
Kommentar geschlossen statt aus dem Aufrufweg gelesen. Ein Wahrheitswert kann ein Ergebnis nicht
zuschneiden; eine Standortleitung hätte die Beschäftigten **aller** Standorte gesehen. ADR-0020
DA6-L08 verlangte *scoped result truth* von Anfang an.

**Folgen:** T-015b wächst von drei auf fünf Arbeitssitzungen und umfasst Coordinator,
Einladung, Einlösung und Leseprojektion. Wird nicht geteilt — eine halb gebaute Berechtigung
ist schlimmer als eine große Aufgabe.

---

## D-024 — Befund: Unser NFC-Modell gibt es, aber Jibble hat es nicht

**Datum:** 27.08.2026 · **Recherchiert vom Technical Lead** · **Kein Beschluss, ein Befund**

**TimeTac** und **TimO** bieten unser Modell seit Jahren an: Tag am Objekt, Scan mit dem eigenen
Smartphone, Tag trägt eine Aufgabe. TimO kostet 4,49–4,99 € je Nutzer und Monat. Dazu ein ganzer
Schwarm Branchenlösungen für Gebäudereinigung. **Das NFC-Verfahren ist kein Alleinstellungsmerkmal.**

**Jibble arbeitet anders:** Der Tag ist die Karte des Beschäftigten, gescannt wird an einem
geteilten Kiosk-Gerät. Wer zum Kunden fährt, kann damit nicht stempeln — er trägt nach.

**Folge für die Positionierung:** Nicht „wir haben NFC", sondern **„bei uns muss niemand
nachtragen"**. Zu prüfen im Pilotgespräch: *„Wie stempeln Ihre Lehrkräfte, wenn sie beim Schüler
zu Hause sind?"* Bestätigt D-009 und D-020.

Quellen: `play.google.com` (studio.cocreation.taptime), `timetac.com/de/nfc-tags-und-timetac`,
`timo24.de/nfc-zeiterfassung`, `jibble.io/help/how-to-use-jibbles-nfc-time-tracking-kiosk`.

---

## D-025 — Befund: Der Hebel ist Enge und Vertrieb, nicht Funktionsumfang

**Datum:** 27.08.2026 · **Technical Lead auf Frage des Product Owners** · **Kein Beschluss, ein Befund**

Zu Urlaubsanträgen, Controlling und Abrechnung: **Funktionen anzubauen ist der schwächste
Hebel.** Wettbewerber haben sie; auf Breite verliert ein Einzelgründer sicher.

- **Urlaub:** später, kein Verkaufsargument, aber ein Fass (Abwesenheitsarten, Resturlaub, Teilzeit)
- **Abrechnung: niemals selbst bauen.** Reguliert und haftungsbehaftet. Gebraucht wird der
  **Export**, der beim Steuerberater ohne Nacharbeit durchläuft — DATEV, Lexware
- **Controlling:** einziges der drei mit echter Zahlungsbereitschaft, aber erst nach dem Pilot

**Die drei wirklichen Hebel:** enger werden statt breiter (mobile Dienstleister mit wechselnden
Einsatzorten) · den **Monatsabschluss** zur Hauptsache machen, denn dort hängt Geld (D-020) ·
**Vertrieb ist der Engpass**, nicht Entwicklung — ein empfehlender Steuerberater ist mehr wert
als jede Funktion.

**Der unbequeme Teil:** Es gibt noch keinen zahlenden Kunden. Der wertvollste nächste Schritt
ist, den Pilotkunden nach dem Testmonat zahlen zu lassen — auch nur 20 € — weil sich ab dann
ändert, was wir über das Produkt lernen.

---

## D-026 — Befund: Der Administrator prüft sich selbst

**Datum:** 27.08.2026 · **Gefunden bei der Rolleninventur zu T-015b** · **Kein Beschluss, ein Befund**

`012:764` und `012:1071`: Nach der Administratorprüfung fehlt der Selbstausschluss. **Ein
Administrator kann seine eigene Arbeitszeit korrigieren und seine eigene Prüfung entscheiden.**
Bestand seit Migration 012, nicht durch T-015b entstanden.

ADR-0020 verlangt „niemals die eigene Arbeitszeit korrigieren, niemals die eigene Prüfung
entscheiden" — der Satz stand dort für die Standortleitung und wurde für den Administrator nie
umgesetzt.

**Warum das nicht einfach „ein Fehler zum Beheben" ist:** Verbietet man es, kann in einem Betrieb
mit **einem** Administrator dessen eigene vergessene Stempelung nie mehr korrigiert werden —
dieselbe Sackgasse wie bei D-022. Das Vier-Augen-Prinzip lässt sich nicht erzwingen, wo es nur
zwei Augen gibt.

**Entschieden von Tim am 26.08.2026: erlauben, aber kennzeichnen.** Der Administrator darf sich
selbst korrigieren und freigeben — jede Selbstkorrektur und jede Selbstfreigabe wird jedoch
ausdrücklich als solche markiert, trägt in den Export und erscheint in der Übersicht. Ein Prüfer
sieht ohne Nachfrage, wer sich selbst freigegeben hat.

**Warum so:** Das Vier-Augen-Prinzip lässt sich nicht erzwingen, wo es nur zwei Augen gibt. Ein
Verbot hätte den Pilotbetrieb sofort ausgesperrt. Dieselbe Linie wie D-014: markieren statt
verbieten — das System urteilt nicht, es macht sichtbar.

**Umsetzung in T-020**, nicht in T-015b.

---

## D-027 — Der Sitzungsvertrag wird versioniert, nicht aufgeweicht

**Datum:** 27.08.2026 · **Entschieden vom Technical Lead** · **Umsetzung:** T-015c

Die erweiterte Sitzungsantwort kommt als **`/v2/session`**. `/v1/session` bleibt unverändert,
bis das Admin-Web in T-015d gewechselt ist.

**Warum nicht den Parser tolerant machen:** Das Admin-Web weist unbekannte Felder ab. Das ist
eine bewusste Eigenschaft, keine Nachlässigkeit — sie wird nicht per Anweisung aufgeweicht. Ein
versionierter Endpunkt hält sie intakt, macht den Wechsel atomar und erlaubt, die Oberfläche
zurückzunehmen, ohne die Schnittstelle anzufassen.

**Zweite Festlegung — eine Quelle je Bereich.** Die Liste der offenen Bereiche wird **nicht** aus
einer einzigen Funktion abgeleitet. Jeder Bereich wird von **der Autorität** beantwortet, die
dort ohnehin entscheidet: Beschäftigte aus `has_membership_management_authority_v1`, Export,
Prüfungen, Arbeitszeiten und Einrichtung aus ihren eigenen bestehenden Prüfungen. Ein Bereich
ohne aufrufbare Autorität ist ein **Befund**, keine Einladung, eine zu erfinden.

**Warum:** Eine Liste, die einen Bereich als offen ausweist, ohne dessen echte Autorität gefragt
zu haben, ist eine zweite Wahrheit — genau das, was D-023 verhindern sollte.

---

## D-028 — Die Übersicht ist eine Zusammensetzung, kein Bereich
**Datum:** 27.08.2026 · **Entschieden vom Technical Lead** · **Grundlage:** Befund aus T-015c, D-027

Die Übersicht bekommt **kein** eigenes Merkmal in der Sitzung. Sie ist keine Ressource mit
eigener Autorität, sondern aus anderen Bereichen zusammengesetzt. Ein `overview_available` wäre
die von D-027 ausgeschlossene zweite Berechtigungswahrheit.

**Die Regel, allgemein:** Der Server benennt **Bereiche**. Zusammengesetzte Ansichten leiten sich
daraus ab und erfinden kein eigenes Recht. Eine Kachel wird nur gezeichnet, wenn ihr Bereich offensteht.
**Folge für T-015d:** Das Admin-Web lädt heute alle vier Projektionen ungefragt und zeichnet Abweisungen als Kachel mit `0` und Wiederholen-Knopf. T-015d lädt nur offene Bereiche und zeichnet nur geladene Daten.

---

## D-029 — Standorte stehen hinter einem eigenen Aufruf, nicht in der Sitzung

**Datum:** 27.08.2026 · **Entschieden vom Technical Lead** · **Befund aus T-015d** · **Umsetzung:** `T-015e`

`managementScope` trägt im Fall `organization` **keine** Standortliste und bekommt auch keine.
Ein Administrator mit eingeschalteten Standorten wählt den Heimatstandort einer Einladung aus
einem **eigenen, blätterbaren Aufruf**.

**Warum nicht in die Sitzung:** Die Antwort ist auf 256 KiB begrenzt. Gemessen in T-015d: sie
trägt **488** maximal lange Standortnamen, ab 489 nicht mehr. Eine Sitzung, die ab einer
bestimmten Betriebsgröße als „nicht verfügbar" gilt, ist ein Fehler, den niemand versteht. Der
Verwaltungsumfang einer Standortleitung bleibt in der Sitzung — er ist klein und begrenzt; die
Liste **aller** Standorte eines Betriebs ist es nicht.

**Sperre bis dahin:** Die Standort-Funktion darf in **keinem** Betrieb eingeschaltet werden,
bevor `T-015e` steht. Sonst kann ein Administrator niemanden mehr einladen — die Einladung
verlangt seit T-015b einen Heimatstandort, den die Oberfläche nicht anbieten kann.

**Aufgehoben am 28.08.2026 mit T-015e** — und zwar erst **nach dessen Auslieferung**. Solange die
Produktion den Stand nicht trägt, gilt die Sperre dort unverändert weiter.

---

## D-030 — Befund: Die Oberfläche wurde nie ausgeliefert

**Datum:** 27.08.2026 · **Gefunden vom Product Owner beim ersten Blick in die Produktion** · **Umsetzung:** `T-026`

`infrastructure/deploy` liefert **ausschließlich das Backend-Abbild** aus. Caddy bedient das
Admin-Web aus `/opt/taptime/admin-web` — einem Verzeichnis, das **kein Skript, keine CI und keine
Compose-Datei im Repository jemals beschreibt.** Dort liegt, was bei T-006 von Hand hinkopiert
wurde.

**Folge: T-017a und T-015d sind nie in Produktion angekommen.** Der Technical Lead hat beide als
„ausgeliefert" gemeldet, ohne zu prüfen, ob der Auslieferungsweg die Oberfläche mitnimmt. Der
Befund kam vom Product Owner, im ersten Bildschirm, an einem Text, den es im Quelltext nicht
mehr gibt.

**Dieselbe Ursache wie T-022:** ein Schritt, der nur in jemandes Händen existierte.

**Die Lehre, verbindlich:** Ein Deployment ist erst bewährt, wenn der Gesundheitstest die
ausgelieferte Version **belegt** — für Backend *und* Oberfläche. Ein Tor, das nur prüft, ob
etwas antwortet, hätte diesen Fehler nie gefunden. `T-026` schließt beides.

---

## D-031 — Dunkle Oberfläche als einziges Farbschema

**Datum:** 27.08.2026 · **Entschieden von Tim** · **Vorbereitet vom Technical Lead** · **Umsetzung:** `T-027`

Das Admin-Web und die App werden **dunkel**. Ein Farbschema, kein Umschalter. Grundlage sind die
Entwürfe vom 23.08.; das Farb- und Abstandsraster steht in `UI_Leitlinien.md`.

**Warum kein Umschalter:** Jede Farbe müsste zweimal stimmen und zweimal geprüft werden — und es
wäre genau die Art Entscheidung, die wir dem Nutzer abnehmen wollen (Vision).

**Preis, bewusst getragen:** In hellen Räumen ist ein dunkler Bildschirm schlechter lesbar. Und
ein Ausdruck braucht eigene Regeln — schwarze Schrift auf Weiß, kein Farbverlauf. Das gehört zu
`T-027`, nicht später.

**Was ausdrücklich NICHT entschieden ist:** Der **Inhalt** der Übersicht. Die Entwürfe zeigen
Kacheln wie „6 manuell erfasste Zeiten warten auf Freigabe" — das ist T-020 und T-023 und beruht
auf einer Vermutung des Technical Lead, nicht auf einer Aussage des Pilotbetriebs (D-020).
`T-027` ändert **nur das Aussehen**, keinen Inhalt.

---

## D-032 — Befund: Auch die Betriebsskripte werden nicht ausgeliefert

**Datum:** 27.08.2026 · **Gefunden durch die abgebrochene Generalprobe von T-026** · **Umsetzung:** `T-028`

Die auf dem Server installierte `taptime-restore-verify` erwartet `32/32` RLS-Tabellen; seit
Migration 019 sind es `37`. Das Repository ist seit T-015a richtig — die Datei kam nie dorthin.
Ebenso von Hand installiert und still alternd: `taptime-backup`, die Monitoring-Skripte, die
systemd-Einheiten und der Caddyfile. Derselbe Fall wie **D-030**, eine Schicht tiefer.

**Belegt, nicht gefolgert:** genau **ein** Fehlschlag, im Deploy selbst ausgegeben (27.08.,
zwischen 16:05 und 16:37 UTC). Letzte erfolgreiche Sicherung 16:05 UTC. Der wöchentliche Prüftimer
hatte seinen ersten Termin noch nicht (30.08., 03:35 UTC), der Tagesmonitor läuft erst am 28.08.
— eine Alarmierung war noch nicht fällig, sie ist nicht ausgeblieben.

**Die Probe brach vor Sicherung, Migration und Aktivierung ab.** Das Tor hat gehalten.

**Regel:** Was auf dem Server läuft, kommt aus einer versionierten Auslieferung.

---

## D-033 — Befund: Standorte lassen sich nicht anlegen, nicht zuweisen, nicht einschalten

**Datum:** 28.08.2026 · **Gefunden vor dem Schreiben von T-015e** · **Umsetzung:** `T-015e`

Migration 019 hat Tabellen, Auslöser und Berechtigungsregeln. Es gibt aber **keine Funktion, die
einen Standort anlegt**, keine, die einer bestehenden Zugehörigkeit einen Heimatstandort zuweist,
und keine, die eine Arbeits- oder Verwaltungszuweisung vergibt. Nur T-015b schreibt einen
Heimatstandort — und nur für **neue** Einladungen.

**Folge:** Die Funktion ist unerreichbar. Das Einschalten verlangt für **jede** aktive
Zugehörigkeit einen Heimatstandort, auch für den Administrator selbst. Den kann ihr niemand
geben. D-029 beschrieb das Loch als fehlende Auswahl — tatsächlich fehlt der ganze Weg.

**Ursache, benannt:** T-015a hat beschrieben, **was** ein Standort ist, und ausdrücklich verlangt,
dass sich nichts verhält. Niemand hat gefragt, **wie einer entsteht**. Vierter Befund dieser
Bauart in zwei Tagen (D-030, D-032, D-029, dieser). Gegenmaßnahme: neue Regel in `AGENTS.md`.

---

## D-034 · Befund: Ein gesperrtes Telefon kann nicht stempeln

28.08. — Die App startet beim Scannen von selbst; Tag-Dispatch ueber ACTION_TECH_DISCOVERED ist
gebaut (ADR-0017, DA5-T08). Android liefert bei gesperrtem oder dunklem Bildschirm aber
grundsaetzlich keine NFC-Tags an Apps aus. Keine Einstellung, kein Geraet, keine Version aendert
das — es ist eine Entscheidung von Google. „Gesperrt scannen, dann entsperren, Zeit laeuft" ist
von niemandem baubar. Unser Ablauf: entsperren, dranhalten, Zeit laeuft — drei Sekunden, kein
Menue. Die Alternative waere die Bezahlkarten-Technik mit einem Lesegeraet je Einsatzort, also
das Kiosk-Modell, das wir nach D-024 bewusst nicht bauen. Fuer den Vertrieb ist das die Antwort auf eine Frage, die jeder Kunde stellen wird.

---

## D-035 · Das Muster sagt, was wirklich passiert ist

29.08. — Ohne Netz weiss das Geraet noch nicht, ob aus dem Scan Beginn, Ende oder Pause wird.
Wurde der Scan abgelegt, hat er geklappt: das Fehlermuster waere gelogen und verleitet zum
zweiten Stempel, das Startmuster waere geraten. Dafuer gibt es ein fuenftes Muster „aufgenommen,
noch nicht bestaetigt“ — kurz, neutral in der Tonhoehe, hoerbar unfertig, nicht mit dem
Fehlermuster verwechselbar. Wurde der Scan nicht abgelegt, ist er fehlgeschlagen und bekommt das
Fehlermuster. Trifft die Entscheidung spaeter ein, gibt es keinen nachtraeglichen Impuls; der
aufgenommene Scan bleibt sichtbar, bis er bestaetigt oder abgelehnt ist.

---

## D-036 · Befund: Ein erfundener Testablauf hat einen Fehlschlag versteckt

29.08. — Die Rückmeldung ordnete jedem nicht aufgezählten Zustand das Fehlermuster zu. Der
Zustand `server_decision`, mit dem in der Produktion JEDER erfolgreiche Scan mit Netz endet, war
nicht aufgezählt: ein gelungenes Einstempeln haette 400 ms tief gebrummt. 1.320 gruene Tests
sahen das nicht, weil der Test eine Zustandsfolge nachspielte, die kein Produktionscode
veroeffentlicht. Daraus zwei Regeln: Eine Zuordnung ueber einen Vertragstyp wird vollstaendig
ausgeschrieben und endet an einem `never`-Zweig, nie an einem Auffangzweig mit Bedeutung. Und ein
Test ueber Zustandsfolgen faehrt die Folgen, die der Produktionscode wirklich veroeffentlicht.

---

## D-037 · Auf dem iPhone gehört die Bestätigung dazu

15.09. — iOS liest Tags im Hintergrund nur ueber einen NDEF-Datensatz mit Universal Link und
liefert die Daten erst, wenn die Person die Mitteilung antippt; bei gesperrtem Geraet wird vorher
zum Entsperren aufgefordert (Apple, Core NFC: „Adding Support for Background Tag Reading"). Auf
iOS ist es damit ein Tap plus eine Bestaetigung. Der Product Owner hat das ausdruecklich
akzeptiert: lieber ein Tap mehr als kein iPhone. „One Tap. One Decision." bleibt der Massstab;
die Bestaetigung ist die Ausnahme, die benannt wird statt verschwiegen. iOS ist ein festes Ziel,
kein Vielleicht.

---

## D-038 · Öffentliche Schlüssel dürfen ins Abbild, geheime nie

15.09. — Das Admin-Web braucht Supabase-Adresse und oeffentlichen
Anwendungsschluessel schon beim Bauen, weil Vite sie einbackt. Beide sind
oeffentlich: derselbe Schluessel steht bereits in eas.json im Repository und
geht an jedes Telefon. Sie duerfen deshalb Bauargumente sein. Ein Bauargument
landet aber in den Metadaten des Abbilds und ist fuer jeden lesbar, der es
zieht. Fuer den service-role-Schluessel und jedes andere Geheimnis ist dieser
Weg deshalb verboten — die gehoeren in Dateien mit Modus 0600 auf dem Server,
nie in ein Abbild, nie in argv. Fehlt einer der beiden oeffentlichen Werte,
bricht der Bau ab, statt eine startunfaehige App zu erzeugen.

---

## D-039 · Befund: Der pausierte Anmeldedienst sah aus wie ein falsches Passwort

15.09. — Supabase pausiert Gratis-Projekte nach sieben Tagen ohne
Aktivitaet. Heute traf es unser Projekt: Website und App konnten niemanden
mehr anmelden. Die Oberflaeche meldete dabei „E-Mail-Adresse oder Passwort
stimmen nicht", weil SupabaseMemoryAuth.signIn() einen booleschen Wert
liefert und jeden Fehlschlag darauf abbildet. Der Ausfall war also total und
die Erklaerung falsch — der Product Owner suchte sein Passwort, waehrend der
Dienst nicht lief. Zwei Folgen: Supabase Pro gehoert vor den ersten zahlenden
Kunden, und eine Anmeldung muss die Ursache nennen. Dritter Vorfall der
Bauart „ein Wahrheitswert kann keinen Grund tragen" nach D-023 und T-032.

---

## D-040 · Befund: Der lokale Speicher wurde nie angelegt

15.09. — Das Schema der verschluesselten Geraetedatenbank enthaelt einen
SQL-Syntaxfehler: in offline_lease_generations folgt nach einer Tabellen-Bedingung noch die
Spalte generation_state (OfflineCaptureDatabase.ts:1903). SQLite bricht mit „near
generation_state: syntax error" ab, die App faengt das als migration_failed ab und meldet
„Ausstehender Vorgang geschuetzt". Der Offline-Weg hat damit auf keinem Geraet je funktioniert;
ein Scan ohne Netz war nie moeglich. 1.323 gruene Tests sahen es nicht, weil sie gegen
MemoryOfflineDatabase und ein SQLite-Fake laufen. Regel daraus: Ein Schema gilt erst als
geprueft, wenn eine echte SQLite-Maschine es vollstaendig ausgefuehrt hat. Ein Fake, der
ungueltiges SQL annimmt, ist kein Test.

---

## D-041 · Befund: Die Aufstiegspfade der Geraetedatenbank sind unerreichbar

15.09. — Weil das V4-Schema nie fehlerfrei ausgefuehrt wurde (D-040), gibt es
auf keinem Geraet eine Datenbank der Staende v1, v2 oder v3. Die
Migrationsbloecke in OfflineCaptureDatabase.ts sind damit heute toter Code:
sie koennen nicht ausloesen und sind entsprechend nie gegen echte SQLite
gelaufen. Der neue Echttest deckt nur OFFLINE_SCHEMA_V4 ab. Das ist
vertretbar, solange kein Geraet einen aelteren Stand tragen kann — aber es
ist eine bewusste Luecke, keine Vollstaendigkeit. Vor der ersten
Schemaaenderung nach dem Pilotbetrieb muss entschieden werden: entweder die
Aufstiegspfade in denselben Echttest aufnehmen oder sie entfernen.

---

## D-042 · Befund: Die Kette traegt, der Weg der Vision nicht

15.09. — Erster vollstaendiger Geraetetest (T-033), SM-A336B, Android 15, APK 486ad76.
Zehn von elf Schritten bestanden: Tag einrichten, ein- und ausstempeln, Pause, Erfassung ohne
Netz samt Abgleich, Fehlerfall, Blindtest der fuenf Rueckmeldungsmuster, eigene Zeiten und die
Zeile in der CSV. Der Offline-Weg lief zum ersten Mal ueberhaupt, nach der Behebung aus D-040;
die drei kurzen Impulse fuer „aufgenommen" waren spuerbar unterscheidbar. Gescheitert ist allein
der Weg, fuer den das Produkt gebaut ist: bei geschlossener App fragt Android, welche App den
Scan nutzen soll, mit mehreren Kandidaten bei nur einer installierten App. „One Tap. One
Decision." ist auf Android heute nicht erfuellt.

---

## D-043 · Befund: Ein Test hat den Fehler beglaubigt

15.09. — Bei geschlossener App startete ein Tag TapTim.e, erzeugte aber keinen Stempel: die
Erfassung entsteht vor der Laufzeitinitialisierung und wird von der danach gesetzten
Authority-Grenze als zu alt verworfen (TapTimeNfcIngressModule.kt:23,
OfflineCaptureCoordinator.ts:243, DefaultProductMobileRuntime.ts:187).
NativeNfcIngress.test.ts:103 erwartete dieses Verhalten ausdruecklich und war gruen. Fuenfter
Vorfall dieser Bauart nach D-036. Regel daraus: Ein Test, der eine Erwartung festschreibt, muss
begruenden, WARUM sie richtig ist — sonst haelt er fest, was gerade passiert, statt was passieren
soll. Bei einer Sicherheitsgrenze gehoert diese Begruendung in den Test.

---

## D-044 · Eine Geraeteabnahme kommt nach dem Commit, nicht davor

16.09. — „Nicht committen vor APPROVED" liess sich bei Mobilaufgaben nicht
einhalten: ein APK entsteht nur aus einem Commit, und die Abnahme findet am
Geraet statt. Bei T-045 stand beides gleichzeitig im Auftrag. Aufloesung:
Wo die Abnahme nur am Geraet moeglich ist, heisst APPROVED „freigegeben zum
Committen und Bauen", und die Geraeteabnahme folgt danach. Scheitert sie,
wird gemeldet und zurueckgenommen oder nachgebessert — aber nicht aus einem
schmutzigen Arbeitsverzeichnis gebaut. Ein Abbild, das keinem Commit
entspricht, ist nicht nachvollziehbar und darf nie auf ein Geraet.

---

## D-045 · Befund: Eine strenge Pruefung ohne Nahttest bricht leise

16.09. — Der Bereich Einrichtung war unbenutzbar, sobald ein Pausen-Tag
existierte: das Backend liefert ihn als zugeordnet ohne Kunden
(AdminWriteSessionCoordinator.ts:763-776), der Parser im Admin-Web verlangt
fuer zugeordnete Tags einen Kunden (AdminWebApiClient.ts:786), und ein
einziger nicht lesbarer Tag verwirft die gesamte Projektion. Eingefuehrt mit
Migration 017, unbemerkt bis zum ersten Geraetetest. Der Client prueft
Antworten auf exakte Feldmengen — damit ist keine additive Aenderung
vertraeglich, und es gab keinen Test, der Backend-Antwort und Parser
gegeneinander haelt. Regel daraus: Wo zwei Seiten einen Vertrag teilen, muss
ein Test die Naht pruefen, nicht jede Seite nur sich selbst.

---

## D-046 · Der Arbeitstag wird in zwei Stufen freigegeben

16.09. — Ein Zeitdatensatz kennt heute nur started und stopped
(contracts.ts:86); eine Freigabe gibt es nicht. Sie wird eingefuehrt, je
Arbeitstag, in zwei Stufen: Der Beschaeftigte gibt seinen Tag frei, danach
Standortleitung oder Administrator. Ein Tag ohne Zeiten oder mit laufender
Erfassung ist nicht freigebbar, ebenso wenig einer mit offenem Prueffall.
Abgelehnt wird mit Begruendung, die der Beschaeftigte sieht. Freigegeben
heisst auf normalem Weg gesperrt; der Administrator kann wieder oeffnen, aber
nur mit Begruendung in der Korrekturhistorie. Die Benachrichtigung ist
zunaechst ein Zaehler in der Oberflaeche, keine Mail.

---

## D-047 · Pausen werden nicht gestempelt, sondern nach Gesetz abgezogen

16.09. — Der Pausen-Tag entfaellt; damit verschwinden ein Tag-Typ, eine
Scan-Art und ein Rueckmeldungsmuster aus dem Produkt. Stattdessen zieht das
System nach § 4 ArbZG ab: 30 Minuten bei mehr als sechs bis zu neun Stunden,
45 Minuten bei mehr als neun Stunden. Bei exakt neun Stunden sind es 30.
Abgezogen wird immer, auch wenn keine Luecke vorlag; der Beschaeftigte sieht
davon nichts. Im Datensatz steht dann aber ein Feld fuer den Abzug ohne
Luecke, und die CSV bekommt dafuer eine eigene Spalte. Der Abzug veraendert
die Scan-Aufzeichnung nicht — er ist eine berechnete Schicht darueber (D-014).

---

## D-048 · Befund: Niemand kann sich registrieren

16.09. — Der Anmeldeweg der App kennt nur signInWithPassword
(SupabaseEmailPasswordAuthAdapter.ts:31); ein signUp gibt es nicht. Und
/v1/employee-enrollment/redeem verlangt bereits ein gueltiges Zugangstoken —
der Beschaeftigte muss also schon angemeldet sein, bevor er die Einladung
einloesen kann. Ein Konto entsteht damit nur, wenn jemand es von Hand im
Supabase-Dashboard anlegt. Unbemerkt geblieben, weil alle bisherigen Konten
genau so entstanden sind. Dieselbe Bauart wie D-030 und D-033: gebaut, aber
nicht erreichbar — hier fehlte sogar der erste Schritt.

---

## D-049 · Der Server darf Konten anlegen — D-038 wird dafuer erweitert

16.09. — Bisher galt: der Supabase service-role-Schluessel verlaesst das Konto
des Product Owners nie. Das trug, solange das Backend Token nur prueft. Fuer
die Aufnahme von Beschaeftigten legt es kuenftig Konten an und loest die
Einladungsmail aus; dafuer braucht es den Schluessel. Die Folge wird benannt
statt verschwiegen: Wer den Produktionsserver hat, kann Konten im
Supabase-Projekt anlegen. Auflagen: ausschliesslich in /opt/taptime/.env,
Modus 0600, root-eigen, nie in einem Abbild, nie in einem Bauargument, nie in
argv — D-038 gilt unveraendert. Benutzt fuer genau eine Aufgabe, das
Einladen, und jede Verwendung wird protokolliert. Der Product Owner traegt
ihn selbst ein.

---

## D-050 · Der Universal Link braucht keine neue Domain

16.09. — Fuer Android genuegt jede Adresse auf dem Tag; das Vergleichsprojekt
frogs-zeiterfassung belegt das mit einem eigenen Schema. Fuer iOS verlangt
Apple einen https-Universal-Link auf einer Domain, die wir kontrollieren und
die Apple verifizieren kann; eigene Schemata akzeptiert Apple ausdruecklich
nicht. Eine solche Domain haben wir bereits: tb-infra.de. Das Tag-Format wird
deshalb auf einer Adresse unter tb-infra.de festgelegt, statt auf taptura.de
zu warten. Eine App darf mehrere Domains beanspruchen — kommt taptura.de
spaeter dazu, bleiben ausgegebene Tags gueltig und muessen nicht neu
beschrieben werden. Der Domainkauf blockiert damit weder T-043 noch T-030; er
entscheidet nur, wie das Produkt heisst.

---

## D-051 · Quittung folgt externer Archivierung · 16.09.2026 · Tim
**Entscheidung:** RPO 0 fuer bestaetigte WorkEvents bei einem Server- oder Datentraegerausfall;
RTO vier Stunden ab Alarm. Das Telefon loescht erst nach nachgewiesener externer Archivierung.
PostgreSQL erhaelt physische Basissicherungen und fortlaufend extern archiviertes WAL.
**Warum nicht Weg C:** Ein synchroner Standby koppelt Schreiben an einen zweiten Server und
vergroessert Failover, Failback und Ueberwachung, obwohl nur der Gruender den Betrieb beherrscht.
Weg C wird richtig, sobald eine weitere Person Stoerfaelle unabhaengig beherrschen kann.
**Betrieb:** Rueckstand folgt aus Archivbedarf und konfigurierter Taktung, nie aus einer Pruefzahl.
**Nachweis:** Zeitpunkt-Restore; unarchiviert bestaetigte Ereignisse bleiben auf dem Telefon.

---

## D-052 · Die Hand bestaetigt sofort, das Telefon loescht spaeter · 16.09.2026 · Tim
**Entscheidung:** Der Server gibt seine Entscheidung sofort zurueck; sie wird im selben Tap
gezeigt und gefuehlt. Die FIFO-Zeile verschwindet weiter erst nach Archivnachweis (D-051 gilt).
**Warum:** T-035 koppelte beides. Dadurch zeigte jeder gesunde Scan ein bis drei Minuten lang
"Sicher lokal gespeichert" statt "Arbeitszeit gestartet" — genau der Moment, fuer den es das
Produkt gibt.
**Warum es sicher bleibt:** Die Kopie auf dem Telefon bleibt liegen. Verliert der Server das
Ereignis vor der Archivierung, spielt das Telefon es nach der Wiederherstellung erneut ein. Die
gezeigte Entscheidung ist vorlaeufig, nie falsch. RPO bleibt 0.
**Fehler:** Die Vermischung stand in meiner Aufgabenbeschreibung zu T-035, nicht im Code.

---

## D-053 · Der eingefrorene Pruefapparat wird zurueckgebaut · 17.09.2026 · Tim
**Entscheidung:** `apps/synthetic-android-e2e`, die DA5-Auslaeufer unter `apps/mobile` und der
`backend-b1-spike` werden aus dem aktiven Projekt entfernt, einschliesslich Bauanbindung und
CI-Job. Rund 70.000 Zeilen Hilfs- und Testcode.
**Warum D-001s "Kein Rueckbau noetig" falsch war:** Einfrieren hat den Apparat aus einem CI-Pfad
genommen, nicht aus dem Projekt. `build --workspaces` baut ihn weiter, die Mobile-Testauswahl
fuehrt seine Tests weiter aus, und jede kuenftige Aenderung muss ihn mitschleppen.
**Was verloren geht:** Ein historisches Pruefverfahren, sofort ausfuehrbar. Keine Produktfunktion.
Die Geschichte bleibt in Git.
**Grenze:** Die produktive Android-Baustrecke fuer die APK bleibt. Sie ist kein Teil des Apparats.

---

## D-054 · D-014s Anwesenheitsbehauptung wird zurueckgenommen · 17.09.2026 · Tim
**Korrektur:** D-014 sagt "Wer ihn scannt, war koerperlich dort". Das folgt aus dem umgesetzten
UID-Modell nicht. ADR-0009 sagt selbst, dass die UID kopierbar ist und weder Anwesenheit noch
Echtheit beweist. Die Entscheidungen sind append-only; D-014 bleibt stehen, diese Zeile begrenzt
seinen Anspruch.
**Was bleibt:** NFC als Bedienweg ist unberuehrt. Ein Tag am Ort ist der schnellste Ausloeser,
den es gibt, und genau dafuer ist er da.
**Was nicht bleibt:** Die Zusicherung, erfasste Zeit sei ein Anwesenheitsnachweis. Sie darf in
keinem Verkaufstext, keinem Angebot und keiner Auftragsverarbeitung stehen.
**Offen fuer den Product Owner:** Ob das Produkt einen echten Anwesenheitsnachweis braucht.

---

## D-055 · "Vorlaeufig, nie falsch" wird zurueckgenommen · 17.09.2026 · Tim
**Befund:** Der in T-052 geforderte Nachweis an echtem PostgreSQL ist gescheitert. Beim Restore
auf den letzten Archivpunkt kann eine erst danach ausgestellte Lease fehlen; das erhaltene
Telefonereignis wird dann mit `lease_binding_conflict` abgewiesen, obwohl der Server denselben
Start zuvor bestaetigt hatte.
**Was gilt weiter:** Die sofort gezeigte Entscheidung bleibt richtig, und das Ereignis geht nicht
verloren — es liegt auf dem Telefon, der Konflikt ist sichtbar, nicht still.
**Was nicht mehr gilt:** Die Zusage, dass sich die Entscheidung nach einem Wiederanlauf von
selbst wieder einstellt. Bis T-055 ist sie keine Betriebszusage.
**Eiserne Grenze:** Niemals eine neue Lease-ID in erhaltene Evidenz schreiben. Das faelschte
Herkunft, um eine Statistik zu retten.
**Fehler:** Die Zusage stand in meiner Formulierung von D-052, nicht im Code.

---

## D-056 · Eine Zeitzone: Europe/Berlin · 17.09.2026 · Tim
**Entscheidung:** Alle fachlichen Zeitgrenzen — Monat, Tag, Exportfenster, Anzeige — gelten in
`Europe/Berlin`. Die Zone ist eine benannte Konstante an genau einer Stelle in `packages/core`,
von Backend und Web gemeinsam benutzt. Kein Datenbankfeld, keine Migration.
**Warum:** Der Markt ist Mitteleuropa; jedes Nachbarland ausser UK und Portugal liegt in derselben
Zone. Ein Feld, das heute niemand anders belegt, ist Vorratsbau — die Lehre aus dem Audit.
**Was es ersetzt:** Die Browser-Zeitzone im Admin-Web. Ein Lohnbuchhalter im Urlaub sieht
dieselben Zahlen wie am Schreibtisch; Bildschirm und CSV stimmen ueberein.
**Rueckweg:** Braucht ein Kunde eine andere Zone, wird die Konstante ein Feld mit Standardwert.
Eine Migration, kein Umbau.

---

## D-057 · Mails verschickt Supabase ueber Brevo, nicht unser Backend · 17.09.2026 · Tim
**Entscheidung:** Supabase bekommt Brevo als eigenen SMTP-Versand (Custom SMTP). Einladung,
Passwort-Zuruecksetzung und alle kuenftigen Anmelde-Mails laufen damit ueber Brevo, ohne dass
unser Backend eine Zeile Mailcode enthaelt. Vorlagen werden im Supabase-Dashboard gepflegt.
**Warum:** Die Zwei-Mails-pro-Stunde-Grenze von Supabase gilt nur fuer den eingebauten Versand.
Eigener Mailcode im Backend haette die Zuruecksetzung aus T-009 nicht mitgeheilt; so heilt sie
mit. Weniger Code, ein Weg, die Lehre aus dem Audit.
**Zwei Geheimnisse, zwei Orte:** Der Brevo-SMTP-Schluessel liegt im Supabase-Dashboard und nie
auf unserem Server. Der service-role-Schluessel (D-049) liegt in `/opt/taptime/.env` und nie im
Dashboard-Umfeld. Beide traegt der Product Owner selbst ein.

---

## D-058 · Das Handy ist fuer alle Rollen das Werkzeug, die Navigation folgt der Rolle · 18.09.2026 · Tim
**Entscheidung:** Die App beginnt bei jeder Rolle mit *Erfassen*. Mitarbeiter: Erfassen, Manuell,
Meine Zeiten. Administrator und Standortleitung: Erfassen, Manuell, Mitarbeiter, Tags.
Der Abgleich ist kein Reiter, sondern ein Statuspunkt oben rechts (mint: alles bestaetigt,
bernstein mit Zahl: etwas wartet), der die Abgleich-Seite oeffnet. „NFC-Einrichtung" heisst Tags.
Der Moment nach dem Tap ist ein eigener Bildschirm: Entscheidung, Uhrzeit, Ziel, „vom Server
bestaetigt", dann sofort wieder bereit; ohne Netz dieselbe Szene in Bernstein mit „wird nachgereicht".
**Massstab:** der klickbare Entwurf vom 18.09. (ADO/01_Architecture/Mobile_Entwurf) und die
Scan-Animation des Vergleichsprojekts frogs-zeiterfassung. Farben bleiben die heutigen Tokens.
**Warum:** Der Product Owner will die App vor der naechsten APK fertig sehen; ein Handy, das
Fuehrungskraefte nicht benutzen, ist fuer einen Fuenf-Personen-Betrieb keine Fuehrung.

---

## D-059 · Standortleitung ist Administrator im eigenen Standort · 18.09.2026 · Tim
**Entscheidung:** Eine Standortleitung darf im eigenen Standort alles, was ein Administrator darf:
Mitarbeiter einladen, sehen, pruefen, Tags zuordnen. Sie darf keine Standortleitungen und keine
Administratoren anlegen und sieht keinen anderen Standort. Ein Betrieb mit einem Standort merkt
den Unterschied nur an der Rollenauswahl.
**Was es ersetzt:** T-046 gab der Standortleitung Lesen und Pruefen im eigenen Standort; Einladen
(T-047) und Tag-Zuordnung blieben Administratoren vorbehalten. Beides wird auf den Standort
begrenzt geoeffnet — in der Datenbank (RLS, SECURITY DEFINER), nicht nur in der Oberflaeche.
**Grenze:** Mandantentrennung und Standortgrenze brauchen den Rotnachweis ueber die Grenze hinweg
und ein unabhaengiges Review; die Oberflaeche zeigt nur, was die Datenbank erlaubt.

---

## D-060 · Das Web gehoert allen Rollen und spricht dieselbe Sprache wie die App · 18.09.2026 · Tim
**Entscheidung:** Das Admin-Web bekommt die Gestaltung der App (Tokens, Manrope, Kacheln, Karten)
in der Sie-Form. Administrator: Uebersicht, Beschaeftigte, Pruefungen, Einrichtung, Lohnexport.
Standortleitung: dasselbe fuer den eigenen Standort (D-059). Mitarbeiter bekommen erstmals einen
Web-Zugang: Meine Zeiten und Manuell erfassen, sonst nichts. Die Uebersicht zeigt zuerst, was
laeuft und was eine Entscheidung braucht; die Entscheidung steht am Fall, nicht in einem Formular.
**Massstab:** der Entwurf vom 18.09. (ADO/01_Architecture/Web_Entwurf). Er ersetzt die Reiter-
Beschreibung in T-049; die Einzelbefunde dort bleiben.
**Warum:** Eine Oberflaeche aus einem Guss ist billiger zu bauen und zu erklaeren als zwei; ein
Mitarbeiter ohne Web-Zugang muss fuer jede Frage zur Standortleitung. Reihenfolge: nach T-058.

---

## D-061 · Die Tag-Adresse: tb-infra.de zum Testen, die offizielle Domain vor dem ersten Pilot-Tag · 18.09.2026 · Tim
**Entscheidung:** Auf die Tags wird eine NDEF-URI `https://<Host>/tag` geschrieben (T-043). Bis zum
Pilot ist der Host `tb-infra.de`. Vor dem ersten Tag beim Pilotkunden legt der Product Owner die
offizielle Domain fest und sichert sie (INWX); danach werden neue Tags mit ihr beschrieben.
**Bauweise:** Die Hostliste steht an genau einer Stelle in der App; Manifest und App lesen sie
gemeinsam, und die App nimmt mehrere Hosts an. Tags werden nicht schreibgeschuetzt. So bleibt die
Einbahnstrasse aus D-037 vermeidbar: Ein Domainwechsel ergaenzt einen Host, statt jeden Tag zu
entwerten. Die Tag-Identitaet bleibt die UID-Evidenz; die URI ist nur der Android-Dispatch.
**Grenze:** iOS braucht spaeter einen von Apple verifizierten https-Host (D-037) — jeder eigene
Host erfuellt das, tb-infra.de eingeschlossen.

---

## D-062 · Fremde Zeiten liest ein Zugang, den Handy und Web teilen · 18.09.2026 · Claude (TL), bestaetigt Tim
**Entscheidung:** Die Zeiten einer anderen Person liest genau ein neuer Serverzugang
(`read_managed_person_time_v1`, Migration 028), begrenzt durch
`has_membership_management_authority_v1`: Administrator im Betrieb, Standortleitung in ihrem
Standort. Seine Antwortform ist die der eigenen Zeiten, damit Handy-Kalender (T-059) und
Web-Personenseite (T-049) dieselben Bausteine benutzen. Dazu eine Zusammenfassung der
laufenden Buchungen je Umfang fuer die Kachel „x / y gerade aktiv".
**Warum:** Heute liest fremde Zeiten nur der administrator-only, betriebsweite Pruefweg
(`read_effective_time_records_v2`); fuer eine Standortleitung gibt es keinen. Zwei getrennte
Loesungen fuer Handy und Web waeren zwei Mandantengrenzen zum Pruefen statt einer.
**Grenze:** Kein Lesen ueber den eigenen Umfang hinaus, Fenster wie 025 begrenzt, keine
Personendaten in Fehlermeldungen; Rotnachweis ueber die Standortgrenze und ein zweiter Betrieb.

---

## D-063 · Der Pilot laeuft ueber zwei Monate; die Tagesfreigabe kommt zum zweiten · 18.09.2026 · Tim
**Entscheidung:** Monat 1 laeuft ohne Tagesfreigabe: Tippen, Zeiten, CSV und eine bewiesene
Wiederherstellung im echten Betrieb. Waehrend Monat 1 werden T-048 (Freigabe, Backend) und
T-050 (Pausenabzug) gebaut und zu Monat 2 zugeschaltet; der Pilotkunde probiert die Freigabe
dann real aus. Den Abschluss von Monat 1 macht der Product Owner selbst ueber die CSV.
**Warum:** Freigegeben heisst gesperrt (D-046) — eine falsche Regel im ersten Monat blockiert
die Lohnabrechnung eines echten Betriebs. Ausserdem aendert T-050 die Stunden je Tag; wer
vorher freigibt, gibt eine Zahl frei, die das System neu rechnet. Zugleich laesst sich am
Schreibtisch nicht beurteilen, ob Menschen ihren Tag abends freigeben — das sagt nur ein
echter Betrieb. Zwei Monate loesen beides.
**Grenze:** Vor dem Zuschalten wird der Pilotkunde gefragt; die Freigabe gilt erst ab einem
vereinbarten Stichtag, nie rueckwirkend fuer schon abgerechnete Tage.

---

## D-064 · Pruefen im eigenen Standort kommt mit T-062, nicht mit dem Web · 18.09.2026 · Claude (TL), bestaetigt Tim
**Entscheidung:** D-059 bleibt unveraendert gueltig — eine Standortleitung darf im eigenen
Standort auch pruefen. Gebaut wird das als eigene Aufgabe **T-062** (serverseitige Autoritaet
mit Standortgrenze, nach dem Muster von T-060), terminiert in Pilotmonat 1 neben T-048 und
T-050. T-049 aendert keine Pruefautoritaet und zeigt den Bereich weiterhin nach dem, was die
Sitzung nennt.
**Warum:** Eine Berechtigungsaenderung gehoert nicht in eine Oberflaechenaufgabe; sie braucht
Rotnachweise ueber die Standortgrenze und ein eigenes Review. Ausserdem sind Standorte
standardmaessig ausgeschaltet (Migration 019) — ohne Standorte gibt es keine Standortleitung,
und der Pilotbetrieb startet mit Administrator und Mitarbeitern. Der Bereich erscheint im Web
von selbst, sobald T-062 ihn oeffnet.
**Grenze:** Wird im Pilotbetrieb doch eine Standortleitung gebraucht, rueckt T-062 vor den
Pilotstart; die Reihenfolge ist eine Entscheidung des Product Owners, nicht des Technical Lead.

---

## D-065 · Zeitbudget der Archivierung und Abholtakt · 20.09.2026 · Claude (TL)
**Entscheidung:** Der ungünstigste Weg vom Tap bis zum bestätigten externen Archivnachweis
muss unter **70 %** des Alarmfensters bleiben (`WAL_ARCHIVE_INTERVAL_SECONDS *
WAL_ARCHIVE_MISSED_CYCLES`). Erreicht wird das über zwei Schrauben: `archive_timeout=15s` in
beiden Compose-Dateien und ein zusätzlicher Spool-Durchlauf des Archivierers je halber Pause.
Gemessen: 58,7 s = 48,9 %.
**Warum:** Das Fenster und der Konfigurationswert sind Betriebsversprechen; an ihnen wird nicht
gedreht, um eine Rechnung passend zu machen. Eine feste Reserve macht Messungen entscheidbar.
**Grenze:** Der Konfigurationswert bleibt die gesamte Pause zwischen zwei vollen Durchläufen;
das Alarmfenster wird weiter unverändert aus Intervall mal verpassten Zyklen berechnet.

---

## D-066 · Kein archive_timeout; die Sicherung pausiert die Archivierung begrenzt · 21.09.2026 · Claude (TL)
**Entscheidung:** Berichtigt D-065. `archive_timeout` entfällt wieder; den Segmentwechsel
fordert der Archivierer selbst an, in jedem Durchlauf, sobald eine offene Anforderung im noch
offenen Segment liegt. Die 70-%-Regel bleibt. Neu: Während der Basissicherung ruht die
Archivierung gewollt; der Wächter zählt ab dem späteren von Anforderung und Sicherungsende und
alarmiert, wenn eine Sicherung länger als zehn Minuten läuft oder wartet.
**Warum:** `archive_timeout` ließ den Archivierer seine eigenen Quittungen archivieren, rund
200 Archive je Stunde ohne Taps; die Durchläufe wuchsen auf Stunden (Journal 20./21.09.).
**Grenze:** Eine Messung gilt erst, wenn sie auch den stundenlangen Leerlauf abdeckt.

---

## D-067 · Zeit nachtragen und Kommentar · 21.09.2026 · Tim (PO), vorbereitet Claude (TL)
**Entscheidung:** Ein Mitarbeiter trägt Zeiten nach (Arbeitsziel, Datum, von–bis, optional
Kommentar), im laufenden Monat und im Vormonat. Nachgetragenes zählt sofort und ist überall
als „nachgetragen" markiert; Administrator und Standortleitung sehen es und korrigieren mit
Grund. Beide dürfen ohne Zeitgrenze nachtragen, immer mit Grund. Jeder Zeiteintrag kann einen
Kommentar des Mitarbeiters tragen; frühere Fassungen bleiben erhalten; der Kommentar steht im
Export. Kommt vor dem Pilotstart (T-066).
**Warum:** Ein vergessener Tag ist heute von niemandem reparierbar. Der Tap bleibt der
Normalfall; alles andere ist sichtbar die Ausnahme.

---

## D-068 · Betreiber-Bereich vor dem Pilot · 21.09.2026 · Tim (PO), vorbereitet Claude (TL)
**Entscheidung:** Vor dem Pilot entsteht ein Betreiber-Bereich über allen Betrieben: Betrieb
anlegen samt Einladung des ersten Administrators, Betrieb pausieren, Übersicht über alle
Betriebe. Getrennt vom Kunden-Web, eigene Autorität (keine Rolle innerhalb eines Betriebs),
zweiter Faktor, jede Aktion protokolliert.
**Grenze:** Der Betreiber sieht über einen Betrieb (Status, Zahlen, letzte Aktivität,
Betriebszustand), nie hinein: keine Namen, keine Arbeitszeiten von Mitarbeitern der Kunden.
**Warum:** Einen Kunden als eigenen Betrieb anzulegen geht heute nur mit dem C3B-Werkzeug
`taptime-bootstrap`, das in keinem Produktionsabbild steckt und keine aktuelle Anleitung hat.

---

## D-069 · Administrator und Standortleitung ändern jeden Zeiteintrag · 21.09.2026 · Tim (PO)
**Entscheidung:** Ergänzt D-067. Der Administrator (ganzer Betrieb) und die Standortleitung
(eigener Standort) ändern jeden Zeiteintrag jedes Mitarbeiters in ihrem Umfang, nicht nur
Nachgetragenes — append-only, immer mit Grund. Der Administrator kann das heute im Web (DA3);
Standortleitung und App folgen mit T-062.
**Grenze (TL):** Das Original bleibt erhalten, und der Mitarbeiter sieht an seinem Eintrag,
dass, wann und warum geändert wurde.

---

## D-070 · Nachgetragene Zeit ist kein WorkEvent · 21.09.2026 · Claude (TL)
**Entscheidung:** Ein nachgetragener Eintrag entsteht als Revision 1 eines neuen Zeiteintrags
ohne kanonischen Eintrag, mit dauerhaft gespeicherter Herkunft „nachgetragen". Er durchläuft
weder Trigger noch WorkEvent noch Business Engine.
**Warum:** Der Weg `Trigger → WorkEvent → Engine → TimeEntry` beschreibt, was in dem Moment
geschah, in dem es geschah. Eine Zeit, die jemand später aufschreibt, ist eine andere Art von
Beleg und muss als solche erkennbar bleiben — in App, Web und Export. Das Modell trägt solche
Einträge schon (Migration 012/013); sie bekommen nur ihre eigene Herkunft.
**Grenze:** Nachgetragenes überschneidet sich nie mit einem anderen wirksamen Eintrag derselben
Person und liegt nie in der Zukunft.

---

## D-071 · Ändern heißt abgeschlossene Einträge ändern · 21.09.2026 · Claude (TL)
**Entscheidung:** Präzisiert D-069. Administrator und Standortleitung ändern abgeschlossene
Einträge; ein laufender Eintrag wird zuerst beendet (Tap oder von Hand), dann korrigiert.
Dass die Verwaltung eine laufende Zeit selbst beendet, ist eine Änderung am Lebenszyklus und
eine eigene Aufgabe (T-069). Überschneidungen, die nach dem Nachtragen entstehen, werden
markiert, nicht gesperrt.
**Warum:** Die bestehende Korrektur und die Leser der Engine kennen nur geschlossene
Revisionen; ein laufender Eintrag hat seine Wahrheit im Lebenszyklus, nicht in einer Revision.


## D-072 · Der Archivierer ruht billig, der Wächter lässt nach der Sicherung Luft · 22.09.2026 · Claude (TL)
Ein Durchlauf ohne Arbeit fragt die Storage Box nicht: nur Datenbank und Spool. Den Vollabgleich
(Archivliste, Basis, Lückenprüfung) macht er, sobald Arbeit ansteht, sonst höchstens alle 15 Minuten.
Der Wächter behält 120 Sekunden für Herzschlag und Datenalter; nach dem Ende einer Sicherung
bekommt das Nachholen einmalig bis zu fünf Minuten. Jede Journalzeile nennt die Dauer je Phase.
**Warum:** Am 22.09. dauerte ein Leerlauf-Durchlauf 67–68 s bei 120 s Alarmfenster; jede Verzögerung
der Storage Box löste über 20 Alarme aus, obwohl nichts fehlte (08:13 Nachholen nach Sicherung: 451 s).

## D-073 · Die Verwaltung beendet eine laufende Zeit als WorkEvent · 22.09.2026 · Claude (TL)
Der Administrator beendet die laufende Zeit eines Mitarbeiters mit Endzeit und Grund. Das ist ein
WorkEvent der Quelle „Verwaltung" im Namen des Mitarbeiters; die Engine entscheidet wie bei jedem
Tap (Stopp, `stopped_via='administration'`). Endzeit nach Beginn, nicht in der Zukunft, höchstens
24 h nach Beginn. Ein Gerätetrigger derselben Person, der danach eintrifft und zeitlich vor der
Aktion der Verwaltung liegt, erzeugt keinen Eintrag, sondern einen Prüffall. Standortleitung mit T-062.
**Warum:** Ein Weg durch die Engine hält die Kette Trigger → WorkEvent → Engine → TimeEntry; ein
spät eintreffender Offline-Tap war als Stopp gemeint und darf nicht still eine neue Zeit starten.

## D-074 · Betreiber sind keine Mitglieder und melden sich nur mit zweitem Faktor an · 22.09.2026 · Claude (TL)
Betreiber sind eigene Supabase-Konten ohne Mitgliedschaft in einem Betrieb; beides schließt die
Datenbank gegenseitig aus. Freigeschaltet wird nur als root auf dem Server (`taptime-operator-grant`),
nie über HTTP. Jede Betreiber-Route außer der Sitzungsabfrage verlangt `aal2` (TOTP). Eigene Adresse
`betreiber.tb-infra.de`, eigene App, eigenes Protokoll; Caddy leitet `/v1/operator/*` nur dort weiter.
Betreiber-Funktionen liefern Zählungen, nie Namen, E-Mails oder einzelne Zeiten (D-068).
**Warum:** Wer alle Betriebe sieht, braucht eine stärkere Anmeldung als jeder Kunde und darf
nicht zugleich in einen Betrieb hineinschauen können. Entwurf: `ADO/01_Architecture/Betreiber_Entwurf`.

## D-075 · Pausieren sperrt den Zugang, nicht die Daten · 22.09.2026 · Claude (TL)
Ein pausierter Betrieb erhält an der zentralen Auflösung (`resolve_request_actor`/`lock_request_actor`)
`organization_paused`; App und Web zeigen „Ihr Betrieb ist pausiert". Nichts wird gelöscht,
Offline-Taps bleiben auf dem Gerät und werden nach dem Fortsetzen normal abgeglichen. Pausieren und
Fortsetzen nur mit Grund, beides im Betreiber-Protokoll.
**Warum:** Pausieren ist eine vertragliche Maßnahme; sie muss vollständig umkehrbar sein.

## D-076 · Verwaltungsstopp bei offener Pause und kurzer Endzeit · 22.09.2026 · Claude (TL)
Präzisiert D-073 nach dem Befund von T-069. Läuft beim Beenden durch die Verwaltung eine Pause, schließt
dasselbe WorkEvent erst die Pause, dann die Zeit, beide zur gewählten Endzeit. Die Endzeit darf nicht
vor der letzten Pausengrenze liegen (sonst Abweisung; früher geht danach über die Korrektur). Das
Duplikatfenster von fünf Sekunden gilt nur für Gerätetrigger, nie für die Verwaltung.
**Warum:** Wer die Pause vergisst, vergisst meist auch den Stopp; genau dann muss die Verwaltung
beenden können. Das Duplikatfenster schützt vor doppeltem Scannen, nicht vor bewussten Eingaben.

## D-077 · Alte Apps sehen einen Verwaltungsstopp als „manuell" · 22.09.2026 · Claude (TL)
Gespeichert wird die wahre Herkunft `administration`. Wer keine neue Version aushandelt (ältere APKs),
bekommt `manual` und beim späten Gerätetrigger den bestehenden allgemeinen Prüfgrund; das Format
bleibt bytegleich. `time-details.v2` ist noch nicht ausgeliefert und trägt die neue Herkunft samt
Marke „Beendet durch Verwaltung". Das Admin-Web wird mit dem Server ausgeliefert und zeigt alles.
**Warum:** Ein unbekannter Wert ließe den Kalender alter Apps nicht mehr laden. „Manuell" ist aus Sicht
des Mitarbeiters wahr (nicht per Tag beendet); die volle Wahrheit steht in Daten, Audit und neuen Clients.

## D-078 · Auch der Verwaltungsstopp wird erst nach externer Archivierung bestätigt · 22.09.2026 · Claude (TL)
Der Verwaltungsstopp (D-073) ist ein WorkEvent ohne Gerätekopie; D-051 gilt ohne Ausnahme. Der Server
registriert nach dem COMMIT den Archivbedarf, gebunden an Befehl, WorkEvent und Zielperson. Die
Oberfläche meldet „Gespeichert" erst bei externem Archivnachweis, vorher „Wird gesichert …"; die
Wiederholung mit derselben Befehlskennung ist idempotent. Nachtragen und Korrektur (kein WorkEvent,
D-070) bleiben vorerst ohne diesen Nachweis; offen als P2 bis T-016.
**Warum:** Die D-052-Ausnahme trägt nur, weil das Telefon eine Kopie behält. Die Verwaltung hat keine.

## D-079 · Der Betreiber-Zugang zur Datenbank wird erzeugt, nicht verwahrt · 22.09.2026 · Claude (TL)
Der Betreiber-Bereich bekommt ein eigenes Datenbank-Login (`taptime_operator_runtime`, nur Mitglied von
`taptime_platform_operator`). Sein Passwort erzeugt ein Root-Werkzeug auf dem Server im Prozess, setzt es in
Datenbank und `/opt/taptime/.env` (0600) und zeigt es nie an. Es ist jederzeit neu erzeugbar (`--rotate`),
deshalb muss es nicht gesondert verwahrt werden; nach einer Wiederherstellung läuft das Werkzeug erneut.
Fehlt die Angabe, antworten die Betreiber-Routen `503 operator_not_configured`, alles andere läuft normal.
**Warum:** Ein Laufzeit-Login schützt keine Daten wie die Borg-Passphrase; was jederzeit neu entstehen kann,
braucht keinen zweiten Aufbewahrungsort und kann nicht über Chat oder Screenshot auslaufen.

## D-080 · Pausieren gilt auch für den Offline-Abgleich · 22.09.2026 · Claude (TL)
Ergänzt D-075 nach dem Befund von T-068a: Auch `lock_offline_active_actor_v1` und
`lock_offline_historical_actor_v1` weisen einen pausierten Betrieb ab; bei aktivem Betrieb bleibt ihr
Verhalten unverändert, einschließlich entzogener Mitgliedschaften im historischen Weg. Die Antwort ist
dieselbe wie überall (`organization_paused`) und gilt als vorübergehend: Kein Gerät darf deswegen
etwas aus seiner Warteschlange löschen — auch ältere APKs nicht; das ist nachzuweisen.
**Warum:** Ein pausierter Betrieb darf keine neuen Buchungen aufnehmen, egal über welchen Weg.
Die Taps der Mitarbeiter bleiben auf dem Gerät und kommen nach dem Fortsetzen vollständig an.

## D-081 · Das iPhone kommt in zwei Stufen · 23.09.2026 · Claude (TL), auf Wunsch Tim (PO)
Stufe 1 vor dem Pilot (T-072): Die App läuft auf dem iPhone; gescannt wird in der offenen App über eine
Core-NFC-Sitzung, die die Seriennummer des Tags liest — dieselbe Identität wie auf Android, ohne Umbau an
Server, Datenmodell oder Tags. Stufe 2 nach dem Pilot (T-073): Tippen ohne geöffnete App nach D-037;
das braucht eine eigene Adresse je Tag, weil iOS im Hintergrund nur die Adresse liefert, nie die
Seriennummer (Widerspruch zu D-061 „Identität ist die UID" wird dort gelöst).
**Warum:** Stufe 1 ist der kürzeste Weg aufs iPhone und ändert nichts, was Android trägt. Stufe 2
berührt die Tag-Identität und gehört nicht in die Woche vor dem ersten Kunden.

## D-082 · Die iPhone-Uhr erfüllt denselben Vertrag, im Zweifel zur Prüfung · 23.09.2026 · Claude (TL)
iOS liefert keine Bootzählung wie Android. Das iOS-Uhrmodul bildet `bootMarker` so: Beim ersten Sample
eine zufällige Kennung erzeugen und mit Bootzeit (`kern.boottime`) und fortlaufender Uhr
(`mach_continuous_time`, zählt im Schlaf weiter) nativ speichern. Dieselbe Kennung gilt weiter, solange
die Bootzeit höchstens um eine Toleranz abweicht (höchstens 120 s und immer kleiner als die zuletzt
gesehene Laufzeit) und die fortlaufende Uhr nicht zurückspringt; sonst neue Kennung. App-Neustart behält
sie, Geräte-Neustart wechselt sie, eine Änderung der Uhrzeit über die Toleranz wechselt sie ebenfalls.
Folge ist das bestehende Verhalten: Erfassungen landen als `review_only` in der Prüfung, nie verloren.
**Warum:** Kein Fehlalarm darf eine falsche Zeit als geprüft ausgeben; ein Fehlalarm zur Prüfung ist
hinnehmbar. Die Offline-Zusage für Mitarbeiter bleibt unverändert, nur die Quelle ist plattformeigen.

## D-083 · Die Startseite geht zuerst hinter einem Passwort online · 23.09.2026 · Tim (PO), vorbereitet vom TL
Die Startseite (T-031) läuft vorerst unter `tb-infra.de` hinter Benutzername und Passwort, die Tim an
Interessenten gibt. Öffentlich wird sie erst mit Impressum, Datenschutzhinweisen, Anfrage-Adresse und
Pilotbedingungen (T-031b). Frei erreichbar ist nur `/tag` als Hilfeseite für Tags, die außerhalb der App
angetippt werden. Keine Cookies, kein Tracking, keine fremden Server (Schriften selbst ausgeliefert),
`noindex` bis Name und Domain feststehen. Schwerpunkt ist NFC („One Tap. One Decision.“); die manuelle
Erfassung für Büro und Ausnahmen wird gezeigt, eine Freigabe (D-014) wird nicht versprochen.
**Warum:** Eine öffentliche Seite braucht Impressum und Datenschutzhinweise (§ 5 DDG, Art. 13 DSGVO); hinter
einem Passwort können Pilot-Interessenten sie schon jetzt sehen, ohne private Anschrift und Abmahnrisiko.

## D-085 · Caddy hat einen eigenen Rückweg, unabhängig vom Archivvertrag · 23.09.2026 · Claude (TL)
Befund T-031: Der Deploy erneuert den gemeinsamen Caddy; bei aktivem Archivvertrag gibt es danach keinen
automatischen Rückweg — auch nicht für Caddy, dessen Konfiguration mit dem Archiv nichts zu tun hat. Ab jetzt
prüft der Controller neue Caddy-Konfiguration vorab mit denselben Einbindungen wie im Betrieb, sichert vor dem
Umschalten die laufende Konfiguration und stellt sie wieder her, wenn api, admin oder betreiber danach nicht wie
erwartet antworten — unabhängig vom Archivvertrag; der Deploy endet dann mit Fehler. Das Backend bleibt bei der
Vorwärtsreparatur (`DEPLOY.md`), die Archivvertragssperre unverändert. Neue Oberflächen fallen gesperrt aus,
nie offen und nie so, dass Caddy nicht lädt.
**Warum:** Eine neue Webseite darf api, Verwaltung und Betreiber-Bereich nie mitreißen; die Sperre schützt
Arbeitszeitdaten, nicht eine Proxy-Konfiguration.

## D-086 · Jede Webseite ist am Handy so gut wie am PC · 23.09.2026 · Tim (PO), vorbereitet vom TL
Startseite, Verwaltung und Betreiber-Bereich sind ab 360 px Breite vollständig und professionell
bedienbar: gleiche Funktionen wie am PC, kein seitliches Scrollen, Tabellen als Karten, Menü unten,
Bestätigungen als Blatt von unten, Tippflächen mindestens 44 px, Eingabefelder mit 16 px Schrift. Am PC
bleibt die Oberfläche unverändert. Maßstab ist der Entwurf `ADO/01_Architecture/Mobil_Entwurf/` (PO-Abnahme
23.09.). Nachweis durch einen Layouttest im echten Browser bei 360, 390, 768 und 1440 px und Bildschirmfotos
jeder Ansicht. Der nächste Deploy wartet darauf (T-074).
**Warum:** Administratoren im Außeneinsatz und eingeladene Beschäftigte öffnen die Webs auf dem Handy; eine
Oberfläche, die dort eng oder abgeschnitten wirkt, kostet beim ersten Kunden Vertrauen.

## D-087 · Pakete mit weicher Grenze, gezählt werden alle aktiven Zugänge · 23.09.2026 · Tim (PO)
Betriebe buchen ein Paket mit einer Zahl von Zugängen. Gezählt werden alle aktiven Zugänge: Administrator,
Standortleitung und Beschäftigte. Über dem Paket wird nichts gesperrt; die Verwaltung sieht einen Hinweis,
der Betreiber-Bereich markiert den Betrieb, und für die Rechnung zählt die höchste Zahl aktiver Zugänge im
Monat. Die Paketgröße setzt der Betreiber beim Anlegen und ändert sie protokolliert. Preise und Paketgrößen
sind eine eigene Entscheidung des PO (Vorschlag: Preisrahmen vom 23.09.). Umsetzung als T-075 in Pilotmonat 1.
**Warum:** Ein neuer Mitarbeiter muss am ersten Tag erfasst werden können, sonst landet seine Zeit auf Papier;
die Abrechnung braucht trotzdem eine verlässliche Zahl.

## D-088 · Am Einsatzort hängt eine NFC-Karte; im Produktivbetrieb fälschungssicher · 23.09.2026 · Tim (PO)
Der Tag am Einsatzort ist eine NFC-Karte im Scheckkartenformat, auf Wunsch mit dem Logo des Kunden und dem Namen
des Einsatzorts bedruckt. Im Pilot mit NTAG213 (heutige Identität über die Seriennummer, D-061). Ab dem
Produktivbetrieb nach dem Pilot NTAG 424 DNA mit SUN: Jede Berührung liefert einen einmaligen, vom Server
geprüften Code; eine Kopie der Seriennummer genügt dann nicht mehr. Dieselbe Adresse auf der Karte trägt das
Erfassen ohne geöffnete App auf dem iPhone (T-073). Direkt auf Metall: robuster Tag oder Halter mit Abstand.
**Warum:** Die Seriennummer eines NTAG213 lässt sich mit Spezial-Tags nachbauen; „war vor Ort“ braucht
einen kryptografischen Nachweis. Die bedruckte 424-DNA-Karte kostet kaum mehr als die einfache.

## D-089 · Das Repository bleibt vorerst öffentlich · 24.09.2026 · Tim (PO)
`Tim180201/taptime` bleibt öffentlich; die Container-Images sind es ohnehin dauerhaft (öffentliches GHCR-Paket,
ohne Geheimnisse nach D-049). Schnellprüfung der gesamten Historie am 24.09. (787 Commits): keine Passwörter,
Schlüssel oder Storage-Box-Adresse, nur Test- und Platzhalterwerte. Folgen: Ins Repository kommen weiterhin
keine Geheimnisse, keine personenbezogenen Daten und keine Kundennamen; T-024 (Zugangsdaten rotieren,
Deploy-Schlüssel mit Passphrase) bleibt Pflicht vor dem Pilot. Neu prüfen vor dem ersten Kundenvertrag.
**Warum:** Öffentlich bleibt CI kostenlos und am Deploy ändert sich nichts; das Restrisiko ist die öffentliche
Liste offener Sicherheitsaufgaben, und die erledigt T-024.

## D-090 · Administrator und Standortleitung haben in der App auch „Meine Zeiten" · 24.09.2026 · Tim (PO)
In der App bekommen Administrator und Standortleitung zusätzlich zum Reiter „Mitarbeiter" den Reiter
„Meine Zeiten" mit dem eigenen Monatskalender, wie Beschäftigte ihn haben. Reihenfolge: Erfassen, Meine Zeiten,
Mitarbeiter, Tags (Tags nur, wenn die Sitzung sie erlaubt). Die eigene Person bleibt zusätzlich in der
Mitarbeiterliste. Das ändert D-058 („Mitarbeiter ersetzt Meine Zeiten"). Nur App; Umsetzung als T-077,
zusammen mit T-076 in einem App-Build.
**Warum:** Wer selbst stempelt, will seine Zeiten mit einem Tipp sehen, statt sich erst in der Liste zu suchen.
