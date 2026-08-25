# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-013 · Export für die Lohnbuchhaltung

**Für:** Codex · **Risiko:** verlässt das System, wird zur Abrechnung verwendet → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** T-012 abgeschlossen, **D-017**, **D-014**

### Der Zustand heute

Der Export ist technisch tadellos: mandantensicher, protokolliert, versioniert, mit Prüfsumme,
und er fällt oberhalb von 8 MiB sauber zu. Inhaltlich fehlt ihm das, was eine Lohnbuchhaltung
braucht:

- **keine Pausen** — seit T-012 vorhanden, aber nicht im Export
- **keine lokale Zeit** — nur UTC. Wer um 00:30 Uhr deutscher Zeit stempelt, erscheint am Vortag.
- **keine verlässliche Personenkennung** — `COALESCE(display_name, '')`, der Name darf leer sein
- **kein Korrekturhinweis** — eine nachträglich verschobene Zeit sieht aus wie eine Originalzeit
- **kein Hinweis auf manuelle Erfassung** — obwohl `started_via` und `stopped_via` es wissen

Der letzte Punkt wiegt am schwersten: Die Provenienz einer Korrektur liegt vollständig im Audit —
nachvollziehbar, unveränderlich, vorbildlich. Nur steht sie nicht in der Datei, die der Prüfer in
die Hand bekommt.

### Ziel

**Eine Datei, mit der eine Lohnbuchhaltung arbeiten kann, und die eine Prüfung übersteht.**

### Die Auflage aus T-012 — zuerst lesen

`effective_work_duration_seconds_v1` existiert seit Migration 017 und hat **keinen Aufrufer.**

**Der Export ruft diese Funktion auf. Er rechnet den Pausenabzug nicht in TypeScript nach.**

Sonst haben wir zwei Wahrheiten über dieselbe Zahl, und die erste Abweichung findet ein Kunde,
nicht wir. Das ist keine Empfehlung.

### Der Umfang — vollständig, aber nicht einstellbar (D-017)

Etwa zwölf Spalten. **Kein Spaltenwähler, keine Vorlagen, keine kundenspezifische
Konfiguration.** Wer weniger braucht, löscht eine Spalte in Excel.

| Spalte | Hinweis |
|---|---|
| Personenkennung | **muss immer belegt sein** — siehe unten |
| Anzeigename | darf leer sein |
| Datum | lokale Zeitzone |
| Beginn, Ende | lokale Zeitzone, dazu die UTC-Werte |
| Pausendauer | aus den Intervallen |
| Effektive Arbeitszeit | **aus der SQL-Funktion**, nicht nachgerechnet |
| Ziel | Kunde, Projekt oder Allgemeine Arbeitszeit |
| Erfassungsart Beginn / Ende | `nfc` oder `manual` — nach D-014 die Beweisfrage |
| Korrigiert | ja/nein, mit Nummer der Revision |

**Zeitzone:** Europe/Berlin, mit korrekter Behandlung der Sommerzeit. Die UTC-Werte bleiben
zusätzlich erhalten — sie sind die Wahrheit, die lokale Zeit ist die Lesehilfe.

**Version:** V3. V2 bleibt unverändert erreichbar.

### Eine offene Produktfrage — nicht raten

Eine Lohnbuchhaltung braucht in der Regel eine **Personalnummer**. Wir haben keine. Heute gäbe es
nur die Mitgliedschafts-Kennung — eindeutig, aber für einen Menschen unlesbar.

**Baue keine Personalnummer, bevor der Product Owner geantwortet hat.** Exportiere vorerst die
Mitgliedschafts-Kennung als garantiert belegte Personenkennung und melde die Frage im Bericht.

### Invarianten

1. **Vollständigkeit vor Schönheit.** Der Export enthält alles, auch Unbestätigtes und
   Korrigiertes — gekennzeichnet. Eine fehlende Zeile kostet jemandem Geld.
2. **Der Mandant bleibt getrennt.** Keine Zeile einer fremden Organisation, unter keinen Umständen.
3. **Der Export bleibt protokolliert** und fällt oberhalb der Grenze weiterhin zu.
4. **Die effektive Zeit hat genau eine Quelle.**

### Nicht anfassen

- `packages/core`, die Business Engine, die Entscheidungsreihenfolge
- Die Freigabekette. Das ist T-020 — hier nur die **Kennzeichnung** manueller Erfassung.
- Die bestehende V2. Additiv, nicht ersetzend.

### Prüfung — nachweisen, nicht behaupten

- Ein Tag mit zwei Pausen erscheint mit korrekter effektiver Zeit — verglichen mit der
  SQL-Funktion, nicht mit einer eigenen Rechnung
- Eine Zeit über die Sommerzeitumstellung hinweg ist lokal korrekt
- Ein Eintrag um 00:30 Uhr deutscher Zeit erscheint am **richtigen** Tag
- Eine korrigierte Zeit ist als korrigiert erkennbar, mit Revisionsnummer
- Ein manuell begonnener und per Scan beendeter Eintrag zeigt **beide** Erfassungsarten
- Die Personenkennung ist in **jeder** Zeile belegt, auch wenn der Anzeigename leer ist
- Ein Administrator einer fremden Organisation erhält nichts davon
- V2 liefert unverändert dasselbe wie vorher
- Die 8-MiB-Grenze fällt weiterhin zu, ohne Abschneiden und ohne Prüfeintrag
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Nimm eine exportierte Zeile und rechne von Hand nach: Beginn, Ende, Pausen, effektive Zeit.
> Stimmt die Summe? Zeige die Rechnung, statt sie zuzusichern.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-014` Zweite Umgebung · `T-015` Standorte (ADR-0022) · `T-016` Löschkonzept ·
siehe `ADO/PLAN.md`.
