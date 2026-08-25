# ADR-0022: Die Standortleitung verwaltet Beschäftigte an ihrem Standort

**Status:** Angenommen · **Datum:** 25.08.2026
**Entschieden von:** Product Owner · **Vorbereitet von:** Technical Lead
**Ändert:** ADR-0020, DA6-L05 und Abschnitt 5 · **Grundlage:** `ADO/DECISIONS.md`, D-008 und D-013
**Risiko:** R3 — Berechtigungsdimension. Unabhängiges Review verpflichtend.
**Umsetzung:** Aufgabe `T-015`

## Kontext

ADR-0020 hat der Standortleitung ausdrücklich untersagt, `Memberships` und `invitations` zu
verwalten. Sie durfte Beschäftigte **sehen**, nicht einladen und nicht aussperren.

Damit hätte sie genau das nicht gekonnt, wofür Standorte eingeführt wurden. D-008 nennt den
Grund wörtlich: „damit die Verwaltung der Mitarbeiter nicht nur auf den Admin fällt". Der
Engpass wäre geblieben — in einem Nachhilfebetrieb liefe jede neue Lehrkraft zu Semesterbeginn
weiter über eine einzige Person.

## Entscheidung

Die Standortleitung darf an **ihrem** Standort Beschäftigte **einladen und aussperren**.

Die Fähigkeitsmatrix DA6-L05 wird entsprechend erweitert:

| Ressource | Lesen | Verwalten | Grenze |
|---|---:|---:|---|
| Beschäftigte / Zugehörigkeiten | ja | **ja** | nur am eigenen Standort, nur mit aktiver Verwaltungszuweisung |
| Einladungen | ja | **ja** | nur an den eigenen Standort |

Alle übrigen Zeilen von DA6-L05 bleiben unverändert.

## Grenzen, die bestehen bleiben

1. **Keine Rollenvergabe.** Die Standortleitung kann niemanden zur Standortleitung oder zum
   Administrator machen. Keine Rechteausweitung.
2. **Kein fremder Standort.** Weder einladen noch aussperren.
3. **Keine Veränderung der eigenen Zugehörigkeit** und keiner Administrator-Zugehörigkeit.
4. **Niemals die eigene Arbeitszeit korrigieren, niemals die eigene Prüfung entscheiden.** Diese
   Zeile aus ADR-0020 ist die wichtigste darin und bleibt.

Die Ausschlussliste in ADR-0020 Abschnitt 5 wird um `Memberships` und `invitations` **gekürzt**;
alle anderen Ausschlüsse — Organisationseinstellungen, Administratorautorität, Standorte selbst,
Zuweisungen, Sicherheit, Identitätsanbieter, Betriebskonfiguration, Abrechnung — bleiben.

## Vorbereitung, die bereits erfolgt ist

`T-009` hat Einladen, Aussperren und Rollenwechsel für den Administrator gebaut, und zwar so,
dass die Berechtigung an **einer** Stelle sitzt: `has_membership_management_authority_v1`,
Migration 016. Die Zuständigkeit wird dort aus der Zugehörigkeit abgeleitet, nicht aus der Rolle
allein; der Kommentar im Quelltext markiert die Stelle, an der die Standortzuständigkeit
einzusetzen ist.

`T-015` ändert damit den Körper dieser einen Funktion. Route, Coordinator und die vier
Aufrufstellen bleiben unberührt.

## Abnahmekriterien für T-015

- Eine Standortleitung lädt an ihrem Standort ein und sperrt dort aus — nachgewiesen
- Derselbe Versuch an einem **fremden** Standort wird abgewiesen
- Der Versuch, eine Rolle zu vergeben, wird abgewiesen
- Der Versuch, eine Administrator-Zugehörigkeit zu verändern, wird abgewiesen
- Die Berechtigungsprüfung liegt weiterhin an genau **einer** Stelle
- Eine Standortleitung einer fremden Organisation sieht nichts davon

## Konsequenzen

**Positiv:** Der Zweck von Standorten wird erfüllt. Ein Betrieb mit fünf Filialen verwaltet sein
Personal ohne den Inhaber.

**Preis:** Die Standortleitung kann Personen Zugang zu Beschäftigtendaten ihres Standorts
verschaffen. Das ist die Absicht — die Grenze ist der Standort, nicht die Fähigkeit.

**Ersetzt** die Vorüberlegung aus ADR-0020, delegierte Verwaltung auf Ressourcen zu beschränken
und Personen auszunehmen.
