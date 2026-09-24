# Aktuelle Aufgabe

> **Stand 24.09.2026:** Produktion auf `b635c4a` (Deploy 24.09.). iPhone mit T-072b im TestFlight-Build vom 24.09.
> abgenommen. Reihenfolge: **T-077 → T-076 → ein App-Build für iPhone und Android → T-024 → Pilot Monat 1**.
> Frühere Briefs stehen in der Git-Historie.

## T-077 · Reiter „Meine Zeiten“ für Administrator und Standortleitung (D-090)

**Für:** Development · **Risiko:** Rechte (nur eigene Zeiten), Navigation je Rolle
**Zeitbox:** eine kurze Sitzung; Reihenfolge Beleg → Tests rot → Umsetzung → Nachweis.
**Grundlage:** D-090, D-058, D-062, T-059 (Reiter Mitarbeiter), T-058 (Meine Zeiten).

### Ziel

Administrator und Standortleitung sehen in der App ihre eigenen Zeiten mit einem Tipp. Reiter:
**Erfassen · Meine Zeiten · Mitarbeiter · Tags** (Tags wie heute nur bei `nfcSetupAvailable`). Beschäftigte bleiben
unverändert (Erfassen · Meine Zeiten). Die eigene Person bleibt zusätzlich in der Mitarbeiterliste.

### Auftrag

1. **Erst belegen (Stop-Regel):** Der vorhandene `OwnTimeScreen` mit der `work`-Capability liefert für
   Administrator und Standortleitung dieselben eigenen Zeiten wie für Beschäftigte: Endpunkt, Rechte,
   Membership-Bindung, Kalender in Europe/Berlin. Braucht es dafür eine Server-, API-, Migrations- oder
   Rechteänderung: stoppen und melden.
2. `productDestinations` gibt Rollen mit `managementScope` zusätzlich `times` vor `employees`. Bestehende Logik
   bleibt: Rücksprung auf Erfassen, wenn ein Ziel wegfällt; Offline-Ziele; Abgleich hinter dem Statuspunkt;
   „Manuell“ wie heute.
3. Nachtragen, Ändern und Kommentieren aus „Meine Zeiten“ verhalten sich für Administrator und Standortleitung
   genau wie heute bei der eigenen Person unter „Mitarbeiter“: keine neuen Rechte, keine umgangenen Prüfungen,
   dieselben Texte.
4. Die Leiste mit vier Reitern bleibt ab 320 pt Breite vollständig lesbar, ohne abgeschnittene Beschriftungen.
   Kurzbeschriftungen nur mit Begründung; Tippflächen mindestens 44 pt.
5. Kontowechsel-Verhalten bleibt unverändert (T-076 folgt).

### Tests

Navigation je Rolle: Beschäftigte, Standortleitung mit und ohne Tags, Administrator mit und ohne Tags, offline.
Wechsel von Rolle oder Scope während der Sitzung. „Meine Zeiten“ mit Fixtures für beide Führungsrollen, inklusive
leerem Monat und Fehlerfall. Bestehende App-Suite und tests-inklusiver Typecheck grün.

### Nicht Teil

Kein Server, keine Migration, keine Web-Änderung, kein App-Build, kein Deploy, T-076 nicht vorwegnehmen.

### Bericht

`.t077-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit, kein Push.
