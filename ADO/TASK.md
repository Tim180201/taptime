# Aktuelle Aufgabe

> **Stand 24.09.2026:** Produktion auf `b635c4a`. Auf `main`: T-077, T-076 und T-062 (APPROVED, noch nicht gebaut).
> Reihenfolge nach D-093: **T-078 → T-079 → ein Deploy mit Migration 033 und 034 → ein App-Build (iPhone und
> Android) → T-024 → Pilot Monat 1**. Frühere Briefs stehen in der Git-Historie.

## T-078 · Der Image-Bau hängt nie am Cache (D-094)

**Für:** Development · **Risiko:** Auslieferungsweg; jedes Release läuft durch diesen Workflow · **Zeitbox:** eine
Sitzung.

### Ziel

`Release container images` baut und veröffentlicht jedes Abbild ohne den GitHub-Actions-Cache. Hängt ein Bau-Schritt
trotzdem, bricht genau dieser Schritt mit seinem Namen ab, statt dass der ganze Lauf nach 20 Minuten endet.

### Hintergrund

Am 24.09. brach der Image-Lauf für `130d115` nach 20 Minuten ab. Ursache war der hängende Export in den
GHA-Cache (`cache-to: type=gha,mode=max`), nicht der Bau. Der nächste Commit `7d1da19` lief grün. Ein Cache
beschleunigt nur; er darf nie entscheiden, ob ein geprüfter Stand ein Abbild bekommt.

### Auftrag

1. In `.github/workflows/container-image.yml` bei allen fünf `docker/build-push-action`-Schritten (Backend,
   Admin-Web, Betreiber-Web, Startseite, Betriebsdateien) `cache-from: type=gha` und `cache-to: type=gha,mode=max`
   entfernen. Kein Ersatz-Cache in dieser Aufgabe (kein `type=registry`, kein `type=local`).
2. Jeder dieser fünf Schritte bekommt ein eigenes `timeout-minutes`; der Job-Timeout (heute 20) wird so gesetzt,
   dass alle Schritte samt Prüf-, Aufräum- und Kurzname-Schritten hineinpassen. Beide Werte aus einer Messung
   begründen: Dauer der Bau-Schritte in den letzten grünen Läufen (`gh run view --log` oder Job-Zeitstempel),
   plus Aufschlag für den Bau ohne Cache. Keine Zahl ohne Herleitung im Bericht.
3. Alles andere bleibt bytegleich: Auslöser, `permissions`, `concurrency`, Tags, Labels, Build-Argumente,
   `provenance: mode=max`, `sbom: true`, die Prüfschritte, der Kurzname `ops`, das Löschen alter GHCR-Versionen.
4. `infrastructure/DEPLOY.md`: ein Satz im Abschnitt zum Image-Bau, dass ohne Cache gebaut wird und warum (D-094).
5. Tests oder Skripte, die `container-image.yml` lesen (`infrastructure/tests/*`), anpassen, nicht abschwächen.

### Nachweis

- Workflow-Tests grün; `actionlint` oder die vorhandene Workflow-Prüfung, falls eingerichtet.
- Nach dem Commit: Der Image-Lauf für diesen Commit läuft vollständig grün. Im Bericht Dauer je Bau-Schritt und
  gesamt, verglichen mit dem letzten grünen Lauf mit Cache. Braucht der Lauf ohne Cache mehr als 30 Minuten:
  nicht selbst nachsteuern, melden.
- Laufende CI- und Image-Läufe werden weder abgebrochen noch neu gestartet.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse. Keine Änderung an Dockerfiles, an `ci.yml` oder an den
Abbildern selbst. Kein anderer Cache.

### Bericht

Die vier Punkte aus `AGENTS.md` §8, dazu die Messung aus Punkt 2 und dem Nachweis. Nach `APPROVED` committen und
pushen (Code-Commit, ohne `[skip ci]`).
