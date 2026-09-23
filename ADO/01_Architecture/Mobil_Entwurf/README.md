# T-074 · Verwaltung und Betreiber-Bereich am Handy — Entwurf

**Stand:** 23.09.2026 · **Autor:** Claude (TL) · **Grundlage:** D-086, D-031 (Farbrollen), UI_Leitlinien
**Oberfläche:** `mobil-entwurf.html` in diesem Ordner (vom PO am 23.09. abgenommen).

Der Entwurf zeigt fünf Handy-Ansichten bei 360 px Breite mit erfundenen Daten. **Verbindlich**
sind Muster und Regeln: Leiste unten, „Mehr“ als Blatt, Tabellen als Karten, Bestätigung als
Blatt, Kacheln 2 × 2 im Betreiber-Bereich, die Regeln unten. **Nicht verbindlich** sind die
Beispielinhalte und genaue Maße; Texte, Funktionen und Reihenfolgen kommen aus dem heutigen Code.

## 1. Befund (Quelltext, 23.09.)

| Web | Heute am Handy |
|---|---|
| Verwaltung | Unter 48rem bleibt die Seitenleiste als 7–8rem breite Spalte stehen; daneben rund zwei Drittel der Breite. Tabellen (Beschäftigte, Lohnexport mit sieben Spalten) scrollen seitlich in `.table-scroll`. Formulare und Kacheln werden einspaltig. Bestätigungen sind eingebettete `alertdialog`-Blöcke. |
| Betreiber | Eine Grenze bei 800 px: Kacheln zweispaltig, Filter umbrechend. Tabelle der Betriebe in `.tablewrap`. |
| Startseite | Mit T-031 fürs Handy gebaut und geprüft. |

Nie auf einem echten Gerät oder in einem Browser-Layouttest geprüft.

## 2. Muster

- **Navigation Verwaltung:** Leiste unten mit bis zu vier Bereichen plus „Mehr“. Hat eine Rolle
  höchstens fünf Bereiche, stehen alle direkt in der Leiste. „Mehr“ öffnet ein Blatt von unten
  mit den übrigen Bereichen, Betrieb, Rolle, Zeitdarstellung und „Abmelden“. Oben eine schmale
  Leiste: Marke, Betrieb, aktueller Bereich, „Alle Bereiche aktualisieren“ als Symbolknopf mit
  zugänglichem Namen, Standortauswahl erreichbar.
- **Tabellen → Karten** unterhalb der Handy-Grenze, mit denselben Angaben und Aktionen.
- **Bestätigungen und Seitenpanels → Blatt von unten**, Knöpfe über die volle Breite, Fokus und
  Tastaturbedienung wie heute.
- **Betreiber:** Reiter als Umschalter, Kacheln 2 × 2, Betriebe als Karten, „Betrieb anlegen“ und
  „Pausieren / Fortsetzen“ als Blatt; TOTP-Einrichtung mit QR und Schlüssel ohne Zoomen.

## 3. Regeln für alle Webs

Ab 360 px kein seitliches Scrollen; gleiche Funktionen wie am PC; Tippflächen mindestens 44 px;
Eingabefelder mit 16 px Schrift und passender Tastatur (`inputmode`, `autocomplete`); Kerbe und
Home-Leiste frei (`viewport-fit=cover`, `env(safe-area-inset-*)`); Hoch- und Querformat; am PC
(ab 1024 px) bleibt die Oberfläche unverändert; CSP unverändert (keine Inline-Stile).
