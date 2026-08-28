# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-027 · Das dunkle Gestaltungsraster umsetzen

**Für:** Codex · **Risiko:** keine Datenänderung, aber das Gesicht des Produkts
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** **D-031**, `UI_Leitlinien.md`, D-021

### Zuerst lesen

**`ADO/01_Architecture/UI_Leitlinien.md`** — vollständig, besonders den Abschnitt
*Farb- und Gestaltungsraster*. Die elf Farbrollen, die Rundungen und die Icon-Regel sind
verbindlich und werden hier nicht wiederholt.

### Ziel

**Das Admin-Web sieht aus wie der Entwurf — und sagt nicht mehr, als es weiß.**

### Umfang: Aussehen. Nichts sonst.

**1 · Farben aus Merkmalen, nicht aus der Hand**

Jede Farbe kommt aus einem benannten Merkmal des Rasters. Außerhalb der Merkmalsdefinition steht
**kein einziger Farbwert** im Quelltext. Nur so lässt sich später etwas ändern, ohne alles zu
suchen.

**2 · Schrift**

Inter, **selbst ausgeliefert**. Nicht von einer fremden Adresse nachladen — weder Google Fonts
noch sonst ein Netz. Zwei Gründe, beide zwingend: Es sendet die Adresse jedes Besuchers an einen
Dritten, und die Content-Security-Policy aus T-017 würde es ohnehin blockieren.

Ersatzschrift, falls sie nicht lädt: die Systemschrift. Zahlen bleiben `tabular-nums`.

**3 · Icons**

Ein Linien-Icon je Bereich der Seitenleiste, 20 px, **als eingebettetes SVG**. Keine
Icon-Bibliothek, kein Icon-Font, keine fremde Adresse — dieselben zwei Gründe. Icons stehen
**neben** der Beschriftung, nie allein.

**4 · Seitenleiste, Kopfbereich, Karten**

Seitenleiste als eigene Fläche mit Logoblock; der aktive Bereich als gefüllter Block statt nur
fetter Schrift. Kopfbereich mit Betriebsname links und der wichtigsten Handlung rechts. Karten
mit mehr Luft, große Zahl mit gedämpfter Beschriftung darunter.

**5 · Der Fokusring**

3 px in Akzentfarbe, immer sichtbar. Auf hellem Grund genügt ein dünner Rahmen, auf dunklem nicht.

**6 · Der Ausdruck**

Ein eigenes Regelwerk fürs Drucken: **schwarz auf weiß**, keine Flächen, keine Verläufe. Eine
gedruckte Zeitliste geht zur Lohnbuchhaltung; ein dunkler Block aus dem Drucker ist unbrauchbar.

**7 · Eine Begrüßung, mehr nicht**

Der Kopf der Übersicht darf eine Begrüßung und das Datum tragen. **Keine Zeile, die behauptet,
was die Seite zeigt** — „Hier sehen Sie, was Ihre Aufmerksamkeit braucht" wäre heute unwahr.

### Nicht anfassen

- **Jeder Inhalt.** Keine neue Kachel, keine Liste „Jetzt zu erledigen", kein Standortwähler,
  keine Freigabeansicht. Das ist T-020, T-023 und T-015e
- Der Aufbau: fünf Bereiche, dieselben Adressen, Tabellen bleiben Tabellen
- Der Wortschatz — mit der einen Ausnahme aus Punkt 7
- Spalten einer Tabelle hinzufügen oder entfernen. Das ist **T-029**
- Die Mobile-App. Sie bekommt dasselbe Raster später, in einer eigenen Aufgabe
- `packages/core`, Migrationen, Backend-Module
- Ein Logo. Der Name wird sich ändern; ein Platzhalter bleibt ein Platzhalter

### Prüfung — nachweisen, nicht behaupten

- **Kein Farbwert außerhalb der Merkmalsdefinition.** Ein Test weist das nach
- Der vorhandene `contrastRatio`-Test wird **erweitert**, nicht ersetzt, und deckt **jede**
  Kombination aus Schrift und Untergrund des Rasters ab
- **Kein einziger Abruf an eine fremde Adresse** — nicht für Schrift, nicht für Icons.
  Nachzuweisen an den ausgehenden Anfragen, nicht an der Konfiguration
- Der Tastaturfokus ist auf dunklem Grund sichtbar; die Anwendung bleibt allein mit der Tastatur
  bedienbar
- Das Druck-Regelwerk existiert und setzt Schrift auf Schwarz und Grund auf Weiß
- Die Übersicht enthält **keine** Aussage über Inhalte, die sie nicht zeigt
- Alle bestehenden Admin-Web-Tests bleiben grün
- Der Grenzlauf aus T-025 bleibt grün; das Verhältnis kommt in die Reihe in `ADO/STATUS.md`
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Öffne jeden der fünf Bereiche und nenne **jede** Stelle, an der etwas schlechter lesbar
> geworden ist als vorher. Gedämpfter Text auf dunklem Grund ist die häufigste Art, eine dunkle
> Oberfläche unbenutzbar zu machen. Suche danach, statt es auszuschließen.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**. **Nicht committen** vor `APPROVED`.

---

## Danach

Offen aus T-028: der Konsolenschritt des Product Owners, danach der Deploy mit den beiden
Vorführungen. · `T-015e` (D-029) · `T-020` Freigabekette (D-014, D-026) ·
**Vorschlag T-029** Die Ansichten folgen der Arbeit · siehe `ADO/PLAN.md`.
