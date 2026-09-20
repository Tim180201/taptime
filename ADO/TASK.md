# Aktuelle Aufgabe

> **Stand 20.09.2026:** Auf `main` liegen T-061 (`d5a58a6`), T-049 (`adc7258`, Metro-Reparatur
> `dcdaebb`) und T-063 (`3e089fb`), CI grün. Produktion läuft weiter auf `91441c8`.
> **Der Deploy ist blockiert:** Der Bildworkflow baut das Admin-Web-Abbild nicht mehr.
> Reihenfolge: **T-064 → Deploy (T-061, T-049, T-063, T-064) → Abnahme Web und Gerät →
> Pilot Monat 1.**

## T-064 · Das Abbild baut, was die Anwendung braucht — nicht, was jemand aufgeschrieben hat

**Für:** Development · **Risiko:** Auslieferung (ohne Abbild kein Deploy)
**Zeitbox:** eine Sitzung. **Grundlage:** roter Bildworkflow vom 20.09.2026 nach `3e089fb`.

### Befund (am Quelltext geprüft)

`apps/admin-web` hängt seit T-049 von `@taptime/mobile-work-contract` ab — fünf Quelldateien
importieren daraus (`AdminWebApiClient.ts`, `AdminWebCoordinator.ts`, `contracts.ts`,
`manualCapture.ts`, `TimeCalendar.tsx`). Das Paket liefert seine Typen aus `./dist`, muss also
vor dem Web gebaut werden.

`infrastructure/admin-web/Dockerfile` baut vor dem Web nur drei Vertragspakete:
`administration-contract`, `time-entry-export-contract`, `time-review-contract`. Das vierte
fehlt. Deshalb bricht `tsc --noEmit` im Abbild ab — und nur dort.

Der Grund, warum CI trotzdem grün ist: `.github/workflows/ci.yml` hat unter „Build shared
contracts for workspace type resolution" eine **zweite, eigene Liste** derselben Pakete, und
die ist vollständig. `infrastructure/backend-api/Dockerfile` hat eine **dritte**. Drei
handgepflegte Listen derselben Sache; eine ist abgedriftet. Das ist der eigentliche Befund.
Die bestehende Prüfung `infrastructure/tests/taptime-admin-web-image.test` konnte das nicht
sehen: Sie baut das Abbild absichtlich ohne Build-Argumente und erwartet den Abbruch an der
Argumentprüfung — sie kommt nie bis zum Übersetzen.

Die vollständige Hülle für das Web ist: `administration-contract`, `mobile-work-contract`,
`time-entry-export-contract`, `time-review-contract`. `@taptime/core` zeigt auf `./src` und
wird nicht gebaut.

### Umsetzung

1. **Die fehlende Zeile.** `@taptime/mobile-work-contract` wird im Admin-Web-Dockerfile vor
   dem Bauen des Webs gebaut. Das allein macht den Bildworkflow wieder grün.
2. **Eine Liste statt drei, wo das ohne Umbau geht.** Die Vertragspakete werden an **einer**
   Stelle aufgezählt und von CI und den Dockerfiles von dort verwendet. Ob das ein
   Wurzel-Skript (`npm run …`) oder ein anderer Weg ist, entscheidet Development; die
   Bedingung ist, dass eine neue Vertragsabhängigkeit künftig an genau einer Stelle
   nachgetragen wird. **Berührt das die Baureihenfolge von `backend-api`** (dessen Liste
   zusätzlich die `backend-*`-Pakete in Abhängigkeitsreihenfolge enthält und heute vollständig
   ist): nicht umbauen, sondern melden — dann bleibt dort die eigene Liste und Punkt 3 schützt
   sie.
3. **Ein Wächter, der die Drift vor dem Merge fängt.** Ein neuer Test leitet für `admin-web`
   und `backend-api` aus den Paketdateien die transitive Hülle der `@taptime/*`-Abhängigkeiten
   ab, behält davon die, deren `main` oder `types` auf `./dist` zeigt, und verlangt, dass jedes
   davon im Bauweg des zugehörigen Abbilds vorkommt — und **vor** dem Bauen der Anwendung
   selbst. Fehlt eines, ist der Test rot und nennt Paket und Datei im Klartext. Der Test läuft
   in CI, nicht nur lokal.

### Grenzen

- Kein Umbau der Dockerfiles auf einen Wurzel-Build (`npm run build --workspaces`): der würde
  auch Mobile/Expo mitziehen.
- Keine Änderung an Paketen, an Abhängigkeiten, am `package-lock.json` oder am Anwendungscode.
  Wenn eine Abhängigkeit falsch erscheint: melden, nicht ändern.
- Die bestehende Prüfung `taptime-admin-web-image.test` bleibt erhalten und behält ihren Zweck
  (Abbruch ohne öffentliche Build-Konfiguration). Sie wird nicht durch den Wächter ersetzt.
- Kein echter Supabase-Wert in Skripten, Tests, Protokollen oder Berichten. Für den
  Probebau werden offensichtlich synthetische Werte verwendet.

### Korrektur vom 20.09. (Entscheidung Technical Lead)

Der Wächter steht, die Listen sind zusammengeführt, der Probebau beweist das Abbild. Eine
Lücke bleibt genau dort, wo dieser Wächter dicht sein muss.

4. **Am Wurzelknoten zählen auch die `devDependencies`.** Der Entwurf überspringt
   `devDependencies` auf allen Ebenen. Für ein **konsumiertes** Paket ist das richtig — dessen
   Testwerkzeuge (`backend-bootstrap`) gehören nicht ins Abbild, der Befund aus
   `guard-development.log` war korrekt. Für die **Anwendung selbst** ist es falsch: Der Bauweg
   des Admin-Web-Abbilds ist `tsc --noEmit` gegen `apps/admin-web/tsconfig.json`, und das
   schließt `tests` ein — mit `tsc --showConfig` selbst nachgewiesen. Bekäme `admin-web` morgen
   eine `@taptime/*`-Entwicklungsabhängigkeit mit `dist`-Einstieg und ein Test importierte
   daraus, bräche der Abbildbau genau wie heute — und der Wächter bliebe grün. Das ist die
   Fehlerklasse, für die T-064 existiert, eine Ebene höher.

   Also: Der Wurzelknoten folgt zusätzlich seinen `devDependencies`; jeder tiefere Knoten
   folgt ihnen weiterhin nicht. Der Kommentar im Test sagt, warum die beiden Ebenen
   unterschiedlich behandelt werden.

   **Folge für `backend-api`, die hinzunehmen ist:** Dessen Abbild übersetzt gegen
   `tsconfig.build.json` (`include: ["src"]`, `exclude: ["tests"]`), braucht seine
   Entwicklungsabhängigkeit `@taptime/backend-schema` also nicht. Der Wächter fordert sie
   künftig trotzdem — und ist grün, weil das Dockerfile sie ohnehin vor `backend-api` baut.
   Diese Richtung ist die sichere: zu streng meldet sich laut und wird mit einer Bauzeile
   beantwortet, zu locker liefert ein kaputtes Abbild aus.

**Nachweis:** ein Fixture-Fall, der beides zeigt — eine `dist`-Entwicklungsabhängigkeit der
Wurzelanwendung wird gefordert, dieselbe Abhängigkeit an einem konsumierten Paket nicht. Der
Wächter läuft danach grün; die heutige Pflichtmenge ändert sich nicht, weil `admin-web` keine
`@taptime/*`-Entwicklungsabhängigkeit hat. Der Docker-Probebau muss dafür nicht wiederholt
werden.

### Verifikation und Abschluss

- **Rotnachweis zuerst:** Der neue Wächter ist mit dem heutigen Dockerfile rot und nennt
  `@taptime/mobile-work-contract`. Danach grün.
- **Der echte Beweis:** das Admin-Web-Abbild lokal **erfolgreich** bauen (`docker build` mit
  `TAPTIME_VERSION` und beiden `VITE_…`-Argumenten als synthetische Werte), Protokoll
  beilegen. Vorher scheitert derselbe Bau am Übersetzen; beides zeigen.
- Die bestehenden Infrastruktur-Tests, die Admin-Web-Suiten und die Typechecks laufen erneut.
- Unabhängiges read-only Review, höchstens zwei Runden.
- Nichts committen, nichts pushen, kein Deploy. Review-Dateien nach `.t064-review/`
  (`tracked.diff`, `untracked.txt`, `report.md`); das Verzeichnis wird vor dem Commit gelöscht.

## Danach

Ein Deploy für T-061, T-049, T-063 und T-064; anschließend Abnahme des Webs im Browser
(Mitarbeiter, Standortleitung, Administrator) und der neuen APK auf dem Gerät.
