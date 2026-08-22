# TapTim.e — Smoke-Test am echten Gerät

> **One Tap. One Decision.**
> Dieser Test prüft nicht nur, ob etwas funktioniert — sondern ob es sich *richtig anfühlt*.

**Ersetzt:** den automatisierten Hardware-Testlauf (siehe `ADO/DECISIONS.md`, D-001)
**Dauer:** 45–60 Minuten · **Wer:** Product Owner · **Wann:** vor jedem Release

---

## Vorbereitung

- [ ] Android-Gerät mit NFC, App installiert
- [ ] Zwei NFC-Chips (nachfolgend **Tag A** und **Tag B**)
- [ ] Backend erreichbar, Admin-Web im Browser offen
- [ ] Stift für Notizen — **jede Beobachtung notieren, auch Kleinigkeiten**

**Datum:** ________  **Version:** ________  **Getestet von:** ________

---

## Die drei Fragen, die während des Tests mitlaufen

Neben „funktioniert es?" gilt bei **jedem** Schritt:

1. **Musste ich nachdenken?** Wenn ja — wo genau? Das ist ein Befund, auch wenn es klappt.
2. **Musste ich etwas auswählen, das das System hätte wissen können?**
3. **War klar, was passiert ist?** Ohne die Anzeige zu interpretieren.

Ein Schritt kann technisch bestehen und trotzdem gegen die Vision verstoßen. Beides notieren.

---

## Teil 1 — Einrichtung (Admin-Web)

| # | Schritt | Erwartung | ✓ / ✗ | Notiz |
|---|---|---|---|---|
| 1 | Als Administrator anmelden | Übersicht erscheint | | |
| 2 | Einrichtung → Kunde anlegen | Kunde erscheint in der Liste | | |
| 3 | NFC-Tag registrieren (**Tag A**) | Tag ist erfasst | | |
| 4 | **Tag A** dem Kunden zuweisen | Zuweisung sichtbar | | |
| 5 | **Tag B** anlegen + zweitem Kunden zuweisen | Zwei getrennte Zuweisungen | | |
| 6 | Beschäftigte → Einladung erzeugen | Einladungscode wird angezeigt | | |

---

## Teil 2 — Beschäftigter einrichten (App)

| # | Schritt | Erwartung | ✓ / ✗ | Notiz |
|---|---|---|---|---|
| 7 | App öffnen, „Mit Einladung beitreten" | Anmeldung gelingt | | |
| 8 | Einladungscode eingeben | Beitritt bestätigt | | |
| 9 | Startbildschirm | „Bereit zum Scannen" | | |

---

## Teil 3 — Der Kern: One Tap

Das ist der wichtigste Teil. Hier entscheidet sich, ob das Produkt seine Vision einlöst.

| # | Schritt | Erwartung | ✓ / ✗ | Notiz |
|---|---|---|---|---|
| 10 | **Tag A** scannen | Zeit läuft. **Keine Rückfrage, keine Auswahl.** | | |
| 11 | Wie viele Taps waren nötig? | **Genau einer.** Alles darüber ist ein Befund. | | |
| 12 | Eigene Zeiten öffnen | Laufender Eintrag mit richtigem Kunden | | |
| 13 | **Tag A** erneut scannen | Zeit **stoppt** — ohne dass du „Stopp" wählen musstest | | |
| 14 | **Tag B** scannen | Startet beim zweiten Kunden | | |
| 15 | Während B läuft: **Tag A** scannen | System entscheidet nachvollziehbar. **Notieren, was passiert.** | | |

> Schritt 13 und 15 sind der eigentliche Vision-Test: **Die Engine entscheidet, nicht du.**
> Wenn du an irgendeiner Stelle selbst wählen musstest, ob es Start oder Stopp ist — Befund.

---

## Teil 4 — Offline (Produktprinzip 4)

| # | Schritt | Erwartung | ✓ / ✗ | Notiz |
|---|---|---|---|---|
| 16 | Flugmodus **an** | | | |
| 17 | **Tag A** scannen | Wird angenommen. Kein Fehler, keine Blockade. | | |
| 18 | Nochmal scannen (Stopp) | Wird ebenfalls angenommen | | |
| 19 | Flugmodus **aus**, kurz warten | Synchronisiert **von selbst** — ohne Knopfdruck | | |
| 20 | Admin-Web → Arbeitszeiten | Beide Zeiten sind da, mit korrekten Uhrzeiten | | |

> Musstest du irgendwo „Jetzt synchronisieren" drücken? Das ist ein Befund.

---

## Teil 5 — Verwaltung und Nachweis

| # | Schritt | Erwartung | ✓ / ✗ | Notiz |
|---|---|---|---|---|
| 21 | Arbeitszeiten durchsehen | Alle Einträge, richtige Dauer | | |
| 22 | Eine Zeit korrigieren | Korrektur wird übernommen | | |
| 23 | Nach der Korrektur | **Der Originalwert ist weiterhin nachvollziehbar** | | |
| 24 | Prüfungen öffnen | Konflikte (falls vorhanden) sind entscheidbar | | |
| 25 | CSV exportieren | Datei lädt | | |
| 26 | CSV in Excel öffnen | Spalten sauber, Umlaute korrekt, Zahlen stimmen | | |

> Schritt 23 ist die Nachweisführung. Ohne sie ist das Produkt im B2B nicht verkaufbar.

---

## Teil 6 — Robustheit

| # | Schritt | Erwartung | ✓ / ✗ | Notiz |
|---|---|---|---|---|
| 27 | Unbekannten NFC-Chip scannen | Verständliche Meldung, **kein Absturz** | | |
| 28 | App schließen, Tag scannen | Verhalten notieren | | |
| 29 | Abmelden und neu anmelden | Zeiten sind noch da | | |
| 30 | Bildschirm gesperrt, Tag scannen | Verhalten notieren | | |

---

## Ergebnis

**Bestanden:** ☐ ja ☐ nein

**P0 — kaputt, Datenverlust, Sicherheitsproblem** *(blockiert das Release)*

_____________________________________________________________

**P1 — falsches Verhalten im Normalfall** *(blockiert das Release)*

_____________________________________________________________

**Vision-Befunde — funktioniert, fühlt sich aber falsch an**

_____________________________________________________________

**P2/P3 — Kleinigkeiten** *(blockieren nicht, kommen in `STATUS.md`)*

_____________________________________________________________

---

Ausgefüllte Liste an den Technical Lead. P0/P1 werden sofort bearbeitet, Vision-Befunde
gehen in die Priorisierung, alles andere wird notiert.
