# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-015c · Der Server sagt, was die Oberfläche zeigen darf

**Für:** Codex · **Risiko:** Vertragsänderung an der Sitzung, Standortgrenze → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** T-015b abgeschlossen, ADR-0020 (DA6-L08, L10), ADR-0022, D-023

### Warum es diese Aufgabe gibt

Die ursprüngliche Fassung von T-015c verlangte eine standortbewusste Oberfläche und verbot
gleichzeitig Backend-Änderungen. **Das war unmöglich, und der Fehler lag bei mir:** Ich habe
„die Oberfläche fragt den Server" geschrieben, ohne zu prüfen, ob der Server antworten kann. Er
kann es nicht — `/v1/session` liefert nur Identität, Betrieb und Rolle.

Diese Aufgabe schließt die Lücke. Die Oberfläche folgt als **T-015d**.

### Ziel

**Eine Sitzungsantwort enthält alles, was die Oberfläche zum Zeichnen braucht — und nichts, was
sie selbst entscheiden müsste.**

### Der Grundsatz

DA6-L08 verlangt serverseitige Prüfung **und zugeschnittene Ergebnisse**. Die Oberfläche darf
keine Berechtigungslogik enthalten. Also liefert der Server nicht die Bausteine für eine
Entscheidung, sondern **das Ergebnis der Entscheidung**.

**Eine Quelle der Wahrheit:** Alles, was hinzukommt, wird aus **derselben** Autoritätsfunktion
abgeleitet wie die Berechtigung selbst (D-023). Keine zweite Tabelle, keine parallele
Rollenzuordnung im Backend. Wer die Zuweisung entzieht, ändert damit zwingend beides.

### Was die Sitzung zusätzlich trägt

1. **Ob die Standort-Funktion für diesen Betrieb an ist.** Ist sie aus, verhält sich alles wie
   heute.
2. **Die Bereiche, die dieser Person offenstehen** — als ausdrückliche Liste, nicht als Rolle,
   aus der die Oberfläche etwas ableiten müsste.
3. **Der Verwaltungsumfang:** betriebsweit oder eine Liste von Standorten mit Kennung und Namen.
   Der Name ist nötig, damit die Oberfläche ihn anzeigen kann, ohne ihn nachzuschlagen.

### Was die Beschäftigtenprojektion zusätzlich trägt

- Den **Standort** je Zeile, mit Kennung und Namen
- Einen **optionalen Standortfilter** in der Anfrage

Der Filter wird **serverseitig autorisiert**. Ein fremder Standort wird abgewiesen — mit einem
**unterscheidbaren Grund**, nicht mit einem nackten „nicht berechtigt". Die Oberfläche muss
daraus einen wahren Satz bilden können; das ist die Voraussetzung für T-015d.

### Vision-Check

Kein neues fachliches Verhalten. Der Server sagt, was ohnehin gilt — nur so, dass man es
darstellen kann.

### Nicht anfassen

- `BusinessEngine` und die Entscheidungsreihenfolge
- Die Autoritätsfunktion aus Migration 020 in ihrer **Entscheidung**. Sie darf gelesen und
  projiziert, aber nicht in ihrer Wirkung verändert werden
- `apps/admin-web` — das ist T-015d
- Die Mobile-App
- Eine zweite Rollen- oder Fähigkeitszuordnung irgendwo im Backend. Wenn du eine brauchst, ist
  der Entwurf falsch: **melden, nicht bauen**

### Prüfung — nachweisen, nicht behaupten

- Die Sitzung einer Standortleitung nennt **nur** die Bereiche, die sie öffnen darf
- **Entzieht man ihr die Verwaltungszuweisung, ändern sich Umfang und Bereiche gemeinsam.**
  Dieser Nachweis belegt die eine Quelle der Wahrheit und ist der wichtigste der Aufgabe
- Die Sitzung eines Administrators nennt den betriebsweiten Umfang
- Eine Anfrage mit einem **fremden** Standort wird serverseitig abgewiesen, mit einem Grund, der
  sich von „nicht angemeldet" und von „Betrieb unbekannt" unterscheidet
- Die Beschäftigtenprojektion trägt je Zeile den Standort; eine Standortleitung sieht darin
  weiterhin ausschließlich ihre Verwaltungsstandorte
- Bei **ausgeschalteter** Standort-Funktion verhält sich die Sitzung wie vor dieser Aufgabe;
  bestehende Admin-Web-Tests bleiben unverändert grün
- Der Grenzlauf aus T-025 bleibt grün; das Verhältnis steht im Bericht **und wird in
  `ADO/STATUS.md` in die laufende Reihe eingetragen**
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Gibt es nach dieser Änderung **irgendeine** Angabe in der Sitzungsantwort, die die Oberfläche
> zu einer eigenen Berechtigungsentscheidung verleiten könnte — ein Rollenwert, ein Merker, eine
> Liste, aus der man etwas ableiten *müsste*? Suche danach, statt es auszuschließen.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**, nicht als Testzahlen. Entfernte oder umgeschriebene
Tests **einzeln** benennen. **Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-015d` Die Oberfläche zeigt den Standort · `T-020` Freigabekette und Kennzeichnung der
Selbstkorrektur (D-014, **D-026**) · `T-016` Löschkonzept · siehe `ADO/PLAN.md`.
