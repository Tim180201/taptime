# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-015e · Standorte entstehen, werden zugewiesen, werden auswählbar

**Für:** Codex · **Risiko:** Berechtigungsdimension, Einschaltvorgang → **unabhängiges Review verpflichtend**
**Zeitbox:** fünf Arbeitssitzungen · **Grundlage:** **D-033**, D-029, ADR-0020 (DA6-L01, L03, L04), ADR-0022

### Der Befund

Migration 019 hat Tabellen, Auslöser und Berechtigungsregeln für Standorte — aber **keinen Weg,
einen anzulegen.** Keine Funktion weist einer bestehenden Zugehörigkeit einen Heimatstandort zu,
keine vergibt eine Arbeits- oder Verwaltungszuweisung. Nur die Einladung aus T-015b schreibt
einen Heimatstandort, und nur für neue Personen.

**Damit lässt sich die Funktion nie einschalten.** Das Einschalten verlangt für jede aktive
Zugehörigkeit einen Heimatstandort — auch für den Administrator, der einschaltet.

D-029 beschrieb das als fehlende Auswahl. Tatsächlich fehlt der ganze Weg.

### Ziel

**Ein Administrator kann Standorte anlegen, Menschen zuweisen und die Funktion einschalten —
und danach funktioniert alles, was T-015a bis T-015d gebaut haben.**

### Umfang

**1 · Standorte anlegen, umbenennen, stilllegen**

Nur der Administrator (DA6-L04). Ein Standort wird **nie gelöscht**, nur stillgelegt — die
Historie hängt daran (DA6-L06). Ein stillgelegter Standort taucht in keiner Auswahl mehr auf,
bleibt aber an alten Datensätzen sichtbar.

**2 · Zuweisungen vergeben**

- **Heimatstandort** je Zugehörigkeit: genau einer, änderbar
- **Arbeitszuweisungen**: null oder mehr
- **Verwaltungszuweisungen**: null oder mehr, nur für die Rolle Standortleitung

Die vier Begriffe bleiben getrennt (T-015a): keiner impliziert einen anderen. Eine
Verwaltungszuweisung an jemanden, der keine Standortleitung ist, wird abgewiesen.

**3 · Standorte abfragen — blätterbar, nicht in der Sitzung (D-029)**

Ein eigener Aufruf, der **genau die Standorte** liefert, die der Aufrufende zuweisen darf:
betriebsweit für den Administrator, die Verwaltungsstandorte für eine Standortleitung. Blätterbar,
damit die Antwortgrenze nie zum Thema wird — in T-015d gemessen: 488 Standorte in einer Sitzung.

**4 · Die Einladung bekommt eine Auswahl**

Ist die Funktion an, wird der Heimatstandort ausgewählt und ist Pflicht. Ist sie aus, ist die
Auswahl nicht vorhanden — nicht ausgegraut, nicht leer.

**5 · Das Einschalten wird bedienbar**

Der Administrator sieht **vor** dem Einschalten, was noch fehlt: welche Zugehörigkeiten, Kunden,
Projekte, Arbeitsziele und NFC-Zuordnungen keine Bindung haben. Die Umschaltung selbst bleibt
unverändert eine einzige Transaktion, die bei jeder Lücke **vollständig** abweist (DA6-L01).

Eine Umschaltung, die kommentarlos scheitert, ist eine Sackgasse. Eine Liste dessen, was fehlt,
ist der Unterschied zwischen einer Funktion und einer Falle.

### Vision-Check

Die Einrichtung ist Arbeit für den Betrieb, nicht für den Beschäftigten. Für ihn ändert sich
nichts.

### Nicht anfassen

- `BusinessEngine` und die Entscheidungsreihenfolge
- Die Autoritätsfunktion aus Migration 020 in ihrer **Wirkung**
- Rückwirkende Standortvergabe — **D-022** und ADR-0025 gelten unverändert
- Die Mobile-App
- Das dunkle Gestaltungsraster. Neue Oberflächenteile folgen ihm, ändern es aber nicht

### Prüfung — nachweisen, nicht behaupten

- Ein Administrator legt einen Standort an, weist sich selbst und einem Beschäftigten einen
  Heimatstandort zu und **schaltet die Funktion erfolgreich ein**. Das ist der Nachweis, dass das
  Loch aus D-033 zu ist
- Vor dem Einschalten nennt die Oberfläche **jede** fehlende Bindung namentlich
- Eine Umschaltung mit einer verbleibenden Lücke wird **vollständig** abgewiesen; danach ist
  nichts halb umgestellt
- Eine **Standortleitung** kann keinen Standort anlegen, umbenennen, stilllegen und keine
  Zuweisung vergeben
- Eine Verwaltungszuweisung an eine Person ohne die Rolle Standortleitung wird abgewiesen
- Ein stillgelegter Standort erscheint in keiner Auswahl, bleibt aber an bestehenden Datensätzen
  sichtbar
- Der Abfrageaufruf liefert einer Standortleitung **ausschließlich** ihre Verwaltungsstandorte
- Bei **ausgeschalteter** Funktion ist von alledem nichts sichtbar
- Nach dieser Aufgabe ist die Sperre aus **D-029** aufgehoben; sag das ausdrücklich im Bericht
- Der Grenzlauf aus T-025 bleibt grün; das Verhältnis kommt in die Reihe in `ADO/STATUS.md`
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Gehe jedes Ding durch, das diese Aufgabe einführt, und beantworte für jedes: **Wer legt es an,
> wer ändert es, wer entfernt es?** (Regel 5 des Vision-Checks.) Fehlt einer der drei, melde es —
> das ist genau der Fehler, der zu D-033 geführt hat.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**. **Nicht committen** vor `APPROVED`; der
Dokumentations-Commit vorab ist erlaubt.

---

## Danach

Offen aus T-028: Konsolenschritt und Deploy. · `T-020` Freigabekette (D-014, D-026) ·
`T-016` Löschkonzept · `T-024` Geheimnisse rotieren · siehe `ADO/PLAN.md`.
