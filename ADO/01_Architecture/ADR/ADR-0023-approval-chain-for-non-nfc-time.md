# ADR-0023: Freigabekette für nicht per NFC erfasste Zeiten

**Status:** Angenommen · **Datum:** 25.08.2026
**Entschieden von:** Product Owner · **Vorbereitet von:** Technical Lead
**Grundlage:** `ADO/DECISIONS.md`, D-014 und D-016
**Risiko:** R3 — neue Dimension am Zeiteintrag, berührt Export und Prüfungen. Unabhängiges Review verpflichtend.
**Umsetzung:** Aufgabe `T-020`. Kennzeichnung bereits in `T-013`.

## Kontext

Bis heute kennt ein Zeiteintrag nur `started` und `stopped`. Ob er durch einen NFC-Scan oder von
Hand entstanden ist, steht zwar in `started_via` und `stopped_via` — hat aber keine Wirkung.

Damit ist eine von Hand eingetragene Zeit ununterscheidbar belastbar wie eine gescannte. Für ein
Produkt, dessen Versprechen prüfungsfeste Nachweise sind, ist das die falsche Gleichsetzung.

## Entscheidung

**Der NFC-Scan ist der Beweis. Alles andere ist eine Behauptung und braucht die Bestätigung
eines Menschen.**

### Was Freigabe braucht

- ein Zeiteintrag, dessen **Beginn oder Ende** `manual` ist
- jede **Korrektur** eines Zeiteintrags
- jede **manuell erfasste Pause** (D-016)

Die Kennzeichnung gilt **pro Grenze, nicht pro Eintrag**: Ein Eintrag kann per Scan beginnen und
von Hand enden — dann greift die Regel.

### Was keine Freigabe braucht

Beginn und Ende beide per NFC. **Auch offline erfasst** — offline ist kein Mangel an Beweis,
sondern verzögerte Zustellung. Ein Beschäftigter im Funkloch wird nicht schlechter behandelt als
einer mit Empfang.

### Die Kette

| Wessen Zeit | Wer gibt frei |
|---|---|
| Beschäftigter | Standortleitung, falls vorhanden — sonst Administrator |
| Standortleitung | Administrator |
| Administrator | niemand. Die Kette endet. |

Solange es keine Standorte gibt, ist der Administrator die einzige freigebende Instanz. Die
heutige Zwei-Rollen-Welt erfüllt die Kette damit bereits.

### Zustände

`wartet_auf_freigabe` · `freigegeben` · `abgelehnt`

Eine Ablehnung **löscht nichts.** Der Eintrag bleibt mit Begründung bestehen und ist für den
Beschäftigten sichtbar. Eine Freigabe ist ein angehängtes Ereignis mit Urheber und Zeitpunkt,
niemals eine Änderung am Eintrag selbst.

Eine bereits erteilte Freigabe zu widerrufen ist keine eigene Handlung, sondern eine Korrektur —
und die braucht ihrerseits Freigabe. Die Regel bleibt damit in sich geschlossen.

## Verhältnis zur Vision

**„One Tap. One Decision." bleibt unberührt.** Der Beschäftigte tippt weiterhin genau einmal und
entscheidet nichts. Die Freigabe geschieht danach und bei jemand anderem.

## Verhältnis zum Export

Der Export bleibt **vollständig** und weist Unbestätigtes in einer eigenen Spalte aus. Eine
vergessene Freigabe darf nicht dazu führen, dass jemandem Geld auf der Abrechnung fehlt.
Sichtbar machen statt weglassen — dieselbe Logik wie bei der Kennzeichnung.

## Warum das die Produktidee stärkt

Der Tag ist der Beweis. Wer ihn scannt, war körperlich dort. Damit ist NFC nicht mehr nur der
bequemste Weg, sondern der **einzige ohne Zusatzaufwand** — ein Grund für einen Kunden, Tags
aufzuhängen, der sich von selbst erklärt.

## Abnahmekriterien für T-020

- Ein Eintrag mit manuellem Beginn **oder** Ende wartet auf Freigabe
- Ein vollständig per NFC erfasster Eintrag wartet **nicht**, auch offline erfasst nicht
- Eine Korrektur erzeugt eine neue Freigabepflicht
- Die Kette greift: Beschäftigter → Standortleitung → Administrator; beim Administrator endet sie
- Niemand gibt seine eigene Zeit frei, außer dem Administrator
- Eine Ablehnung löscht nichts und ist für den Beschäftigten sichtbar
- Freigaben sind angehängt, nicht ändernd, und stehen in `audit_events`
- Der Export enthält Unbestätigtes, gekennzeichnet
- Ein Administrator einer fremden Organisation sieht nichts davon

## Konsequenzen

**Preis:** Für Betriebe ohne Tags an jedem Ziel entsteht laufende Freigabearbeit. Das ist
beabsichtigt — es ist der Preis für Zeiten ohne Beweis, und zugleich das Verkaufsargument für
Tags.

**Offen bis zum Pilotbetrieb:** Wie viel Freigabearbeit im Alltag tatsächlich anfällt. Fällt sie
zu hoch aus, ist die Antwort mehr Tags, nicht weniger Freigabe.
