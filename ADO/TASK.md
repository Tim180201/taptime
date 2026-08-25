# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-012 · Pausenerfassung

**Für:** Codex · **Risiko:** berührt `packages/core` und die Business Engine → **unabhängiges Review verpflichtend**
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** T-011 abgeschlossen, **D-016**

### Vorbemerkung

Diese Aufgabe fasst zum ersten Mal seit T-001 die **Business Engine** an. `packages/core` stand
bisher bei jeder Aufgabe auf der Nicht-anfassen-Liste. Entsprechend sorgfältig, entsprechend
gründlich geprüft.

### Die Entscheidung — D-016, nicht verhandelbar

**Die Pause ist ein Auslöser, kein Knopf.**

Der Beschäftigte meldet ein Ereignis — „Pause". Die **Engine** entscheidet, was es bedeutet:

| Zustand | Ergebnis |
|---|---|
| Arbeit läuft | Pause beginnt |
| Pause läuft | Pause endet |
| nichts läuft | ablehnen oder eskalieren |

Dieselbe Kette wie beim NFC-Scan: `Trigger → WorkEvent → Engine → Ergebnis`. **Es gibt kein
„Pause starten" und kein „Pause beenden".** Wenn im Quelltext oder in der Oberfläche zwei
getrennte Befehle entstehen, ist der Entwurf falsch — dann melden statt bauen.

**Der Zeiteintrag bleibt während der Pause offen.** Die Pause ist ein eigenes Intervall
**innerhalb** des laufenden Eintrags. Nicht stoppen und neu starten — sonst müsste der
Beschäftigte danach erneut auswählen, für wen er arbeitet.

### Datenmodell

Pausen werden als **Intervalle** gespeichert: Beginn, Ende, Auslöserart. **Keine Minutensumme
am Zeiteintrag.**

Der Grund ist Vorsorge: Die Bewertung nach § 4 ArbZG — über sechs Stunden ohne 30 Minuten Pause —
soll später **additiv** nachrüstbar sein, ohne Migration und ohne Umschreiben der Historie. Mit
einer Summe wäre das unmöglich.

**Bewertet wird heute nichts.** Das System hält fest, was war, und urteilt nicht.

### Auslöser

Beide Wege, wie bei der Arbeitszeit:

- **NFC** — ein Tag, das auf „Pause" zeigt statt auf ein Arbeitsziel. Nutze das bestehende
  Tag- und Zuordnungsmodell; die Invarianten von `work_targets` dürfen nicht brechen.
- **Manuell** — in der App.

Nach **D-014** gilt: per NFC ausgelöste Pause ist Beweis, manuell erfasste Pause wird
**gekennzeichnet**. Die Freigabekette selbst ist T-020, nicht hier — nur die Kennzeichnung.

### Invarianten

1. **Kein Zeiteintrag ohne Engine-Entscheidung.** Gilt für Pausen genauso.
2. **Die Entscheidungsreihenfolge bleibt nachvollziehbar.** Erweitere sie, kehre sie nicht um.
3. **Offline muss funktionieren.** Eine Pause im Funkloch ist eine Pause.
4. **Duplikatschutz gilt auch hier.** Zweimal in fünf Sekunden auf das Pausen-Tag ist ein Tap.
5. **Effektive Arbeitszeit = Eintrag minus Pausen.** An genau einer Stelle berechnet, nicht an
   dreien.

### Was zu entscheiden ist — und im Bericht begründet gehört

Was passiert, wenn während einer laufenden Pause ein **Arbeits**-Auslöser kommt? Für dasselbe
Ziel, für ein anderes Ziel? Entscheide deterministisch, teste **jede** Kombination und begründe
die Wahl. Rate nicht.

### Nicht anfassen

- Die bestehenden Entscheidungen der Engine. Erweitern ja, ändern nein.
- Die Prüfungs- und Berechtigungsmaschinerie aus T-009 und T-010.
- Der Export. Das ist T-013.

### Prüfung — nachweisen, nicht behaupten

- Jede Kombination aus Zustand und Auslöser ist getestet, auch die abgelehnten
- Ein Pausen-Auslöser bei laufender Arbeit beginnt eine Pause; das Ziel bleibt erhalten
- Der Zeiteintrag bleibt während der Pause **offen**
- Effektive Arbeitszeit stimmt bei mehreren Pausen an einem Tag
- Offline erfasste Pausen kommen vollständig und in Reihenfolge an
- Duplikatschutz greift
- Eine manuell erfasste Pause ist als solche gekennzeichnet
- Ein Administrator einer fremden Organisation sieht nichts davon
- Kein Pfad erzeugt ein Pausenintervall ohne Engine-Entscheidung
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Zeige die Entscheidungsreihenfolge der Engine vor und nach deiner Änderung, nebeneinander.
> Welche bestehende Entscheidung verhält sich jetzt anders als vorher? Wenn keine — zeige,
> woran man das sieht.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-013` Export für die Lohnbuchhaltung · `T-014` Zweite Umgebung · `T-015` Standorte ·
siehe `ADO/PLAN.md`.
