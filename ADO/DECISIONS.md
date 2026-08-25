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
