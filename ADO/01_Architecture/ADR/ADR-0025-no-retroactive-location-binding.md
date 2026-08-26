# ADR-0025: Ein Standort wird nie rückwirkend vergeben

**Status:** Angenommen · **Datum:** 26.08.2026
**Entschieden von:** Technical Lead · **Grundlage:** `D-022`, zwei Befunde aus dem unabhängigen
Review von T-015a
**Ergänzt:** ADR-0020, DA6-L01 · **Schärft:** ADR-0020, DA6-L06
**Umsetzung:** `T-015a` (Ausschluss), `T-015b` (Umsetzung)

## Kontext

ADR-0020 DA6-L01 beschreibt, was beim Einschalten der Standort-Funktion geprüft wird:
Zugehörigkeiten, Kunden, Projekte, Arbeitsziele und NFC-Zuordnungen brauchen eine eindeutige
aktive Standortbindung. **Zwei Fälle fehlen dort**, und das unabhängige Review von T-015a hat
beide gefunden.

Beide haben dieselbe Wurzel: die Versuchung, einen fehlenden Standort aus dem **heutigen**
Zustand zu erschließen.

## Entscheidung 1 — Laufende Einträge blockieren das Einschalten nicht

Beim Einschalten wird **nicht** verlangt, dass laufende Zeiteinträge oder laufende Pausen einen
Standort tragen. Sie bleiben ohne Standort und lassen sich normal beenden.

**Warum nicht abweisen.** Die naheliegende Lösung wäre, das Einschalten zu verweigern, solange
irgendetwas läuft — fail-closed, im Geist von DA6-L01. Sie ist eine Falle.

Ein vergessener Stopp läuft heute unbegrenzt weiter; das steht als bekannte Einschränkung in
`STATUS.md`. Ein **einziger** vergessener Stopp würde das Einschalten von Standorten dauerhaft
unmöglich machen — und zwar ohne erkennbaren Zusammenhang. Der Administrator sähe eine
Umschaltung, die grundlos scheitert, und niemand käme auf einen im Juli vergessenen Stopp.

Ein bekannter Mangel darf keine unabhängige Funktion dauerhaft sperren.

**Warum nicht nachtragen.** Ein Eintrag, der begann, als es die Funktion nicht gab, würde
nachträglich eine Eigenschaft erhalten, die zu seiner Entstehung nicht existierte. Append-only
heißt: die Vergangenheit wird nicht umgeschrieben.

**Regel:** Der Standortbezug entsteht am **Auslöser**, nicht an der Auswertung. Was vor dem
Einschalten begann, bleibt ohne Standort.

## Entscheidung 2 — Wiederhergestellte Zeiten übernehmen nie den heutigen Standort

Ein aus Evidenz wiederhergestellter Zeitdatensatz erhält seinen Standort **ausschließlich aus
seiner eigenen Evidenz** — aus dem `WorkEvent`, aus dem er stammt. Ist er dort nicht eindeutig,
bleibt der Datensatz **ohne Standort**.

Der heutige Standort des Kunden, des Projekts oder der NFC-Zuordnung wird **nie** eingesetzt.

**Warum.** Ein Kunde kann umziehen. Ein Tag kann neu zugeordnet werden. Der heutige Ort ist
keine Aussage über den damaligen. Wer ihn einsetzt, erzeugt keine Lücke, sondern eine falsche
Angabe — und falsche Angaben, die wie Messwerte aussehen, sind bei einer Zeiterfassung, die eine
Prüfung überstehen soll, der teurere Fehler.

**„Kein Standort" ist eine wahre Angabe. „Der heutige Standort" ist eine falsche.**

Das ist dieselbe Linie wie ADR-0023 und D-014: Der Scan ist Beweis, alles andere ist Behauptung.
Eine Behauptung wird gekennzeichnet, nicht als Beweis ausgegeben.

## Zuschnitt

`T-015a` vergibt an **keinen** Bestands- und an **keinen** wiederhergestellten Datensatz einen
Standort. Damit fällt Entscheidung 2 aus dem Umfang dieser Aufgabe heraus; die Regel ist
bindend notiert und wird in `T-015b` umgesetzt, wenn der Standort überhaupt erst Verhalten
beeinflusst.

## Abnahmekriterien

- Einschalten gelingt, während ein Zeiteintrag **und** eine Pause laufen; beide bleiben ohne
  Standort und lassen sich danach normal beenden
- Ein wiederhergestellter Zeitdatensatz erhält keinen Standort — auch dann nicht, wenn sein
  Kunde einen eindeutigen aktiven Standort hat

## Konsequenzen

**Positiv:** Das Einschalten kann nicht durch einen unabhängigen bekannten Mangel dauerhaft
blockiert werden. Die Historie bleibt unverändert wahr.

**Preis:** Es gibt dauerhaft Datensätze ohne Standort. Jede spätere Auswertung nach Standort
muss diesen Fall darstellen, statt ihn zu unterschlagen — eine Summe je Standort ist ohne die
Zeile „ohne Standort" unvollständig.

**Ersetzt nichts.** Ergänzt ADR-0020 um zwei dort nicht behandelte Fälle.
