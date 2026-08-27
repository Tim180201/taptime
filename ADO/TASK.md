# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-015b · Die Standortleitung darf verwalten

**Für:** Codex · **Risiko:** Berechtigungsdimension, Mandantengrenze → **unabhängiges Review verpflichtend**
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** ADR-0022, ADR-0020 (DA6-L03, L04, L05, L08), D-013, D-022

### Zuerst lesen

- **`ADR-0022`** — sie ist kurz und enthält die Abnahmekriterien wörtlich
- **`ADR-0020`**, Abschnitte DA6-L03 (Rolle, Heimat, Zuweisungen), DA6-L04 (was allein dem
  Administrator bleibt), DA6-L05 (die geschlossene Fähigkeitsmatrix), DA6-L08 (serverseitige
  Prüfung und zugeschnittene Ergebnisse)
- **`ADR-0025`** und **`D-022`** — ein Standort wird nie rückwirkend vergeben

### Warum diese Aufgabe existiert

D-008 nennt den Grund wörtlich: *„damit die Verwaltung der Mitarbeiter nicht nur auf den Admin
fällt"*. Heute fällt sie das. In einem Nachhilfebetrieb liefe zu Semesterbeginn **jede** neue
Lehrkraft über eine einzige Person. Standorte ohne delegierte Verwaltung wären eine Gliederung
ohne Nutzen.

### Ziel

**Eine Standortleitung lädt an ihrem Standort Beschäftigte ein und sperrt sie dort aus — und
sonst nirgends und sonst nichts.**

### Die eine Stelle

`T-009` hat vorgearbeitet: Die Zuständigkeit sitzt an **einer** Stelle,
`has_membership_management_authority_v1` in Migration 016. Sie leitet die Berechtigung aus der
Zugehörigkeit ab, nicht aus der Rolle allein; ein Kommentar markiert die Stelle für den
Standortbezug.

**Diese Aufgabe ändert den Körper dieser einen Funktion.** Route, Coordinator und die vier
Aufrufstellen bleiben unberührt. Wenn du feststellst, dass das nicht reicht, ist das ein Befund
und wird gemeldet, bevor du die Aufrufstellen anfasst.

### Was dazukommt

**Die dritte Rolle.** `standortleitung` neben `administrator` und `employee`. Der `CHECK` auf
`role` wird erweitert; die betroffenen Migrationen und Abstimmtabellen ziehen nach.

**Verwaltungszuweisung ≠ Rolle.** Eine Standortleitung **ohne** aktive Verwaltungszuweisung hat
keinerlei delegierte Befugnis. Eine Verwaltungszuweisung allein gibt kein Recht, dort selbst zu
arbeiten. Die vier Begriffe aus T-015a bleiben getrennt.

### Die Grenzen — sie sind der eigentliche Inhalt

Aus ADR-0022, unverhandelbar:

1. **Keine Rollenvergabe.** Die Standortleitung macht niemanden zur Standortleitung oder zum
   Administrator. Keine Rechteausweitung, auf keinem Weg
2. **Kein fremder Standort.** Weder einladen noch aussperren
3. **Keine Veränderung der eigenen Zugehörigkeit** und keiner Administrator-Zugehörigkeit
4. **Niemals die eigene Arbeitszeit korrigieren, niemals die eigene Prüfung entscheiden**

Punkt 4 ist die wichtigste Zeile in ADR-0020 und bleibt unverändert bestehen.

Die Organisation bleibt die harte Mandantengrenze. Die Berechtigung prüft **zuerst** die
Organisation, **danach** den Standort. Eine fehlende, veraltete, mehrdeutige oder
organisationsfremde Standortbindung schlägt fehl — **nicht** durchlässig.

### Ausgeschaltet bleibt ausgeschaltet

Solange die Standort-Funktion aus ist, existiert keine Standortleitung und keine delegierte
Befugnis. Die bestehende Testsuite muss das weiterhin belegen.

### Vision-Check

**One Tap. One Decision.** Für den Beschäftigten ändert sich nichts. Für den Betrieb hört die
Verwaltung auf, an einer Person zu hängen.

### Nicht anfassen

- `BusinessEngine` und die Entscheidungsreihenfolge
- Die vier Aufrufstellen von `has_membership_management_authority_v1`
- `apps/admin-web` und `apps/mobile` — der Zuschnitt der Oberfläche ist **T-015c**
- Alles aus DA6-L04, was dem Administrator vorbehalten bleibt: Standorte anlegen und ändern,
  Zuweisungen vergeben, die Funktion ein- und ausschalten, Organisationseinstellungen
- Rückwirkende Standortvergabe — siehe D-022

### Prüfung — nachweisen, nicht behaupten

Die ersten sechs stehen wörtlich in ADR-0022:

- Eine Standortleitung lädt an ihrem Standort ein und sperrt dort aus — nachgewiesen
- Derselbe Versuch an einem **fremden** Standort wird abgewiesen
- Der Versuch, eine Rolle zu vergeben, wird abgewiesen
- Der Versuch, eine Administrator-Zugehörigkeit zu verändern, wird abgewiesen
- Die Berechtigungsprüfung liegt weiterhin an genau **einer** Stelle
- Eine Standortleitung einer fremden **Organisation** sieht nichts davon

dazu:

- Eine Standortleitung **ohne** Verwaltungszuweisung darf nichts
- Eine Standortleitung mit **Arbeits**zuweisung an einem Standort darf dort **nicht** verwalten
- Eine Standortleitung kann ihre eigene Zugehörigkeit nicht verändern
- Bei **ausgeschalteter** Funktion existiert keine delegierte Befugnis
- Der Grenzlauf aus T-025 bleibt grün; das gemessene Verhältnis steht im Bericht
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Gibt es **irgendeinen** Weg, auf dem eine Standortleitung mehr erreicht als die Matrix in
> DA6-L05 erlaubt — über eine Einladung, über einen Rollenwechsel, über eine zweite
> Zugehörigkeit, über eine Zuweisung an sich selbst? Suche danach, statt es auszuschließen.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-015c` Zuschnitt der Oberfläche · `T-020` Freigabekette (D-014) · `T-016` Löschkonzept ·
siehe `ADO/PLAN.md`.
