# ADR-0024: Erst die Content-Security-Policy, dann die überdauernde Sitzung

**Status:** Angenommen · **Datum:** 25.08.2026
**Entschieden von:** Product Owner · **Vorbereitet von:** Technical Lead
**Ändert:** ADR-0015, DA4-P10 · **Grundlage:** `ADO/DECISIONS.md`, D-015
**Risiko:** R2 · **Umsetzung:** Aufgabe `T-017`

## Kontext

ADR-0015, DA4-P10 hält die Zugangs- und Erneuerungstoken bewusst nur im Arbeitsspeicher:
*„Reload starts signed out."*

Der Gedanke ist richtig — ein Token, das nirgends gespeichert wird, kann nirgends gestohlen
werden. Die Wirkung ist aber begrenzter, als sie wirkt: Wer Fremdcode in der Seite ausführen
kann, erreicht auch den Arbeitsspeicher. Was solchen Code verhindert, ist eine
Content-Security-Policy — und `admin.tb-infra.de` hat **keine**, weder in Caddy noch in der Seite.

Wir haben damit die unbequeme Hälfte des Schutzes und nicht die wirksame.

Und die unbequeme Hälfte trifft ausgerechnet die Person, die am meisten mit dem System arbeitet.
Eine Standortleitung, die F5 drückt, den Laptop zuklappt oder deren Tab abstürzt, meldet sich neu
an. Bei täglicher Nutzung ist das der Unterschied zwischen Werkzeug und Zumutung.

## Entscheidung

Zwei Änderungen, **in dieser Reihenfolge**:

1. Eine **strikte Content-Security-Policy** für `admin.tb-infra.de`.
2. Die Sitzung wandert von „nur im Arbeitsspeicher" auf **`sessionStorage`**.

**Die Reihenfolge ist Teil der Entscheidung. Ohne 1 wird 2 nicht gebaut.** Andernfalls gewinnen
wir die Bequemlichkeit und geben den Schutz auf — die schlechteste der drei möglichen
Kombinationen.

## Warum `sessionStorage` und nicht `localStorage`

Die Sitzung endet mit dem Tab. Ein vergessener Rechner im Betrieb hält keine offene Sitzung über
Nacht, und ein zweiter Tab erbt sie nicht.

## Was DA4-P10 künftig sagt

Statt „Reload starts signed out":

> Die Sitzung überdauert das Neuladen der Seite und endet mit dem Schließen des Tabs. Sie wird
> nicht dauerhaft gespeichert. Der Schutz gegen eingeschleusten Fremdcode wird durch eine
> Content-Security-Policy geleistet, nicht durch die Flüchtigkeit des Tokens.

Alle übrigen Festlegungen von DA4-P10 — Bindung jedes Ergebnisses an die aktive Sitzung und
Zugehörigkeit, sofortiges Ende bei Abmeldung oder Identitätswechsel, keine Zwischenspeicherung
von Exportinhalten — bleiben unverändert.

## Abnahmekriterien für T-017

- Eine CSP ist gesetzt und blockiert nachweislich ein eingebettetes Skript
- Die Anwendung funktioniert vollständig **mit** der CSP; keine Ausnahme über `unsafe-inline`
  für Skripte
- Neuladen der Seite hält die Anmeldung
- Schließen des Tabs beendet sie
- Ein zweiter Tab erbt sie nicht
- Abmelden räumt den Speicher
- Ein Wiederherstellungslink funktioniert weiterhin und wird weiterhin streng geprüft

## Konsequenzen

**Positiv:** Der tatsächliche Schutz steigt, die Bedienung wird deutlich besser.

**Preis:** Eine strikte CSP erfordert, dass keine Skripte inline stehen. Beim heutigen
Vite-Aufbau ist das erreichbar, kann aber Anpassungen erzwingen.

**Ersetzt** die Annahme aus ADR-0015, Flüchtigkeit des Tokens könne eine
Content-Security-Policy ersetzen.
