# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-015c · Die Oberfläche zeigt den Standort

**Für:** Codex · **Risiko:** keine Berechtigungsentscheidung, aber sichtbare Standortgrenze
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** T-015b abgeschlossen, ADR-0022, **D-021**, `UI_Leitlinien.md`

### Zuerst lesen

**`ADO/01_Architecture/UI_Leitlinien.md`** — vollständig. Das Regelwerk gilt für **jede**
Oberflächenaufgabe. Was dort steht, wird hier nicht wiederholt.

### Ziel

**Eine Standortleitung öffnet das Admin-Web und sieht ihren Standort — nicht den halben Betrieb
mit gesperrten Schaltflächen.**

Fertig ist die Aufgabe, wenn sich eine Standortleitung anmelden, ihre Beschäftigten sehen,
jemanden einladen und jemanden aussperren kann, ohne an einer Stelle zu raten, warum etwas fehlt.

### Der Grundsatz

**Nichts anzeigen, was diese Person nicht darf.** Keine ausgegrauten Schaltflächen, keine
Bereiche, die beim Klick „nicht berechtigt" sagen. Eine Oberfläche, die Verbotenes zeigt, stellt
bei jedem Blick dieselbe Frage und beantwortet sie nie.

Die Ausnahme ist der **leere Standort**: keine Beschäftigten ist der erstmalig leere Zustand aus
dem Regelwerk und führt zur Einladung. Kein Fehler, keine unerklärte Leere.

### Umfang

**1 · Die Seitenleiste richtet sich nach der Rolle**

Eine Standortleitung sieht nur Bereiche, die sie bedienen kann. Einrichtung, betriebsweiter
Export und Standortverwaltung erscheinen gar nicht.

**2 · Der Standort ist sichtbar, immer**

Wer mehrere Verwaltungsstandorte hat, muss erkennen, **welchen** er gerade sieht. Der Standort
gehört sichtbar in den Kopfbereich und **in die Adresse** — ein Link führt zu genau diesem
Standort, ein Lesezeichen ebenfalls.

**3 · Listen sagen, worauf sie sich beziehen**

Eine Liste, die nur den eigenen Standort zeigt, muss das sagen. Der bestehende Trefferzähler
bekommt den Bezug — sonst hält jemand die Zahl für den ganzen Betrieb.

**4 · Der Administrator sieht mehr, nicht anders**

Gleicher Aufbau, betriebsweit, mit der Möglichkeit, auf einen Standort einzuschränken. Zwei
verschiedene Oberflächen für dieselbe Aufgabe wären ein Wartungsfehler.

**5 · Ausgeschaltet bleibt unsichtbar**

Kein Standortwähler, kein Standortbezug, keine Hinweise. Die Oberfläche sieht aus wie heute.

### Wortschatz

**Standort** und **Standortleitung**. Nicht Filiale, nicht Niederlassung, nicht Manager. Ergänze
beide im verbindlichen Wortschatz des Regelwerks. Das Admin-Web **siezt** (D-021).

### Nicht anfassen

- **Jede Berechtigungsentscheidung.** Sie liegt vollständig im Server; die Oberfläche fragt, sie
  entscheidet nicht. Wenn du versucht bist, im Browser zu prüfen, wer was darf: melden
- `packages/core`, Migrationen, Backend-Module
- Die Mobile-App
- Barrierefreiheit über den sichtbaren Tastaturfokus hinaus, CSP, Sitzungsdauer — das ist T-017
- **Neue Funktionen.** Keine

### Prüfung — nachweisen, nicht behaupten

- Eine Standortleitung sieht **keinen** Bereich in der Seitenleiste, den sie nicht bedienen kann
- Der angezeigte Standort steht in der Adresse; ein Link darauf öffnet genau diesen Standort
- Jede standortbezogene Liste benennt ihren Bezug; keine Zahl kann für den Betrieb gehalten werden
- Ein leerer Standort zeigt den erstmalig leeren Zustand mit dem Weg zur Einladung — **keinen**
  Fehler und keine leere Fläche
- Bei ausgeschalteter Standort-Funktion ist die Oberfläche unverändert
- Kein technischer Fehlercode erreicht den Bildschirm; kein Toast für einen Fehler
- Die Anwendung bleibt allein mit der Tastatur bedienbar, mit sichtbarem Fokus
- Alle bestehenden Admin-Web-Tests bleiben grün
- Der Grenzlauf aus T-025 bleibt grün; das Verhältnis steht im Bericht
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Melde dich als Standortleitung an und versuche, an Daten eines fremden Standorts zu kommen —
> über eine Adresse, einen Filter, ein Lesezeichen, den Zurück-Knopf. Der Server muss abweisen.
> **Beschreibe, was der Benutzer dabei sieht.** Ein „nicht berechtigt" ohne Erklärung ist kein
> Ergebnis, sondern ein zweiter Befund.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**, nicht als Testzahlen. Entfernte oder umgeschriebene
Tests **einzeln** benennen. **Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-020` Freigabekette und Kennzeichnung der Selbstkorrektur (D-014, **D-026**) ·
`T-016` Löschkonzept · `T-024` Geheimnisse rotieren · siehe `ADO/PLAN.md`.
