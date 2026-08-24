# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-008 · Betriebssichtbarkeit — sehen, dass etwas kaputt ist

**Für:** Codex · **Risiko:** Protokolle können personenbezogene Daten enthalten → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** T-007 abgeschlossen

### Der Zustand heute

`apps/backend-api/src/main.ts` ruft `createBackendApiRuntime` **ohne** `onDiagnostic`. Das
Diagnoseschema mit Allowlist, Fehlerklassen und Korrelations-ID ist gebaut und angeschlossen —
an nichts. Die einzige Laufzeitausgabe des gesamten Backends ist eine Zeile auf stderr, wenn der
Server nicht startet.

Solange alles läuft, fällt das nicht auf. Im Störfall gibt es nichts.

### Ziel

**Der Product Owner erfährt von einer Störung, ohne dass ein Kunde ihn anruft — und kann
danach nachlesen, was passiert ist.**

Die Aufgabe ist fertig, wenn eine absichtlich herbeigeführte Störung nachweislich eine Meldung
ausgelöst hat, die auf seinem Telefon angekommen ist.

### Schritt 0 · Erst die Produktion auf den aktuellen Stand bringen

Die Produktionsdatenbank läuft auf Migration **014**. Im Repository steht **015** — die
Eskalations-Reparatur aus T-010 ist auf dem Server **nicht aktiv**.

Bring den Server auf den aktuellen Stand, bevor du irgendetwas anderes tust. Nachweisen:
Migrationsverzeichnis auf 015, `https://admin.tb-infra.de` erreichbar, `/health` grün, Sicherung
danach weiterhin erfolgreich. Wiederholbar wird dieser Vorgang erst in T-014 — heute von Hand,
aber dokumentiert.

### Schritte

**1. Protokolle anschließen**

- `onDiagnostic` verdrahten, Ausgabe nach journald.
- **Die Allowlist ist der Kern, nicht das Beiwerk.** In ein Protokoll gehören Zeitpunkt,
  Fehlerklasse, Route, Korrelations-ID und Organisationsbezug als Kennung. Niemals Namen,
  E-Mail-Adressen, Kundenbezeichnungen, Arbeitszeiten, Token oder Anfrageinhalte.
- Aufbewahrung begrenzen — Vorschlag 14 Tage, mit Größenobergrenze. Protokolle sind
  personenbezogene Daten, sobald sie Rückschlüsse erlauben; Datensparsamkeit gilt auch hier.
- Ein Test weist nach, dass ein Fehler mit personenbezogenem Inhalt **nichts davon** ins
  Protokoll schreibt.

**2. Melden, was wirklich wehtut**

Vier Dinge, mehr nicht. Jede weitere Meldung senkt die Aufmerksamkeit für die vier:

- Die API antwortet nicht mehr
- Die letzte Sicherung ist älter als zwei Stunden
- Die wöchentliche Wiederherstellungsprüfung ist fehlgeschlagen
- Die Platte läuft voll (Schwelle 80 Prozent)

**3. Der Fall, den ein Server nicht selbst melden kann — entschieden**

**healthchecks.io**, kostenloser Tarif, genau **ein** Check als Totmannschalter.

- Nach draußen geht ausschließlich ein Lebenszeichen **ohne Rumpf**. Keine Daten, keine
  Kennungen, keine Protokolle. Begründe im Bericht, warum der Dienst damit kein
  Auftragsverarbeiter wird.
- Der Alarm geht **nicht per E-Mail**, sondern per Webhook an dasselbe ntfy-Thema wie alles
  andere. Der Product Owner soll eine App haben, nicht zwei Orte zum Nachsehen.
- Die drei übrigen Meldungen erkennt der Server selbst und schickt sie direkt an ntfy — dafür
  braucht es keine weiteren Checks bei healthchecks.io.

**4. Der Weg zum Telefon — entschieden**

**ntfy**, Push auf das Telefon des Product Owner. Kostenlos, kein Konto nötig.

Zwei Dringlichkeitsstufen, keine dritte:

| Stufe | Was | Verhalten |
|---|---|---|
| **Sofort** | API antwortet nicht · Server weg | Push mit hoher Priorität, darf den Stummmodus durchbrechen |
| **Morgens** | Sicherung überfällig · Wiederherstellungsprüfung fehlgeschlagen · Platte über 80 % | Gesammelt einmal täglich, feste Uhrzeit, normale Priorität |

Der Themenname (Topic) ist der einzige Zugangsschutz bei ntfy. Erzeuge ihn auf dem Server aus
Zufallszeichen, gib ihn nur dem Product Owner, und halte ihn aus dem Repository und aus allen
Berichten heraus — genau wie den Statuspfad aus T-007.

**Im Meldungstext steht niemals ein Personenbezug.** Eine Meldung nennt, was kaputt ist, und
sonst nichts. Kein Kundenname, keine E-Mail-Adresse, keine Arbeitszeit. Die Meldung verlässt
den Server über einen fremden Dienst — behandle sie entsprechend.

### Vision-Check

Keine fachliche Logik, keine Oberfläche für Benutzer. Betrieb.

### Nicht anfassen

- `packages/core`, jede Geschäftslogik
- `apps/backend-schema/migrations/` — außer dem Einspielen von 015 in Schritt 0
- Das Diagnoseschema selbst. Es ist richtig gebaut, es war nur nicht angeschlossen.

### Prüfung — nachweisen, nicht behaupten

- Produktion läuft auf Migration 015; Nachweis im Bericht
- Ein echter Fehler erzeugt einen Protokolleintrag; der Eintrag steht im Bericht
- Ein Fehler mit personenbezogenem Inhalt erzeugt einen Eintrag **ohne** diesen Inhalt
- Jede der vier Meldungen wurde **absichtlich ausgelöst** und ist angekommen
- Der Wächter von außen hat bei einem echten Serverneustart angeschlagen
- Protokolle rotieren und laufen nicht voll
- Kein Geheimnis in Protokollen, keines in argv, keines im Repository
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Nimm einen echten Protokollauszug aus dem Betrieb. Wie viel über eine einzelne Person lässt
> sich daraus rekonstruieren? Zeige den Auszug, statt die Frage zu beantworten.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-009` Menschen verwalten, standortfähig (D-013) · `T-011` Ratenbegrenzung ·
`T-012` Pausen · siehe `ADO/PLAN.md`.
