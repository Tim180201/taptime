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

## D-035 · Das Muster sagt, was wirklich passiert ist

29.08. — Ohne Netz weiss das Geraet noch nicht, ob aus dem Scan Beginn, Ende oder Pause wird.
Wurde der Scan abgelegt, hat er geklappt: das Fehlermuster waere gelogen und verleitet zum
zweiten Stempel, das Startmuster waere geraten. Dafuer gibt es ein fuenftes Muster „aufgenommen,
noch nicht bestaetigt“ — kurz, neutral in der Tonhoehe, hoerbar unfertig, nicht mit dem
Fehlermuster verwechselbar. Wurde der Scan nicht abgelegt, ist er fehlgeschlagen und bekommt das
Fehlermuster. Trifft die Entscheidung spaeter ein, gibt es keinen nachtraeglichen Impuls; der
aufgenommene Scan bleibt sichtbar, bis er bestaetigt oder abgelehnt ist.
