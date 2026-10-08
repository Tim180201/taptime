# Aktuelle Aufgabe

> **Stand 08.10.2026:** T-112 abgeschlossen (`280c057`). Nach T-114 folgen Deploy 4 (T-109, T-113) und neue App-Builds
> mit T-109 bis T-114, dann die Geräteabnahme. Befunde aus dem PO-Test vom 07.10.

## T-114 · „Erfassen“ auf einen Blick, Reiter ohne Wortbruch, Einzahl

**Für:** Development · **Risiko:** niedrig (nur Oberfläche der App) · **Zeitbox:** eine Sitzung. Nur `apps/mobile`; kein
Server, keine Logik der Erfassung.

### Auftrag

1. **„Erfassen“ ohne Scrollen (PO 07.10.).**
   - **Ziel:** Auf einem Bildschirm von 360 × 640 dp mit Statusleiste (24 dp) und Navigationsleiste (48 dp) passt im
     Normalzustand alles zwischen Kopf und Reiterleiste ohne Scrollen, bei normaler Schrift. Normalzustand heißt: bereit,
     laufende Zeit, Pause.
   - **Mittel:**
     - Der Scan-Kreis passt seine Größe der verfügbaren Höhe an (heute fest 300 × 300).
     - Die Karte der laufenden Zeit wird kompakter (Knöpfe nebeneinander).
     - Hilfetexte werden kürzer und bleiben verständlich.
   - **„Zuletzt“ entfällt** samt Ersatzkarte; die Zeiten stehen in „Meine Zeiten“. `RecentTime` bleibt für „Manuell“.
   - **Scrollen bleibt erlaubt** bei Hinweisen (App aktualisieren, Übertragung, nicht übertragene Erfassungen), bei großer
     Schrift und bei kleineren Bildschirmen. Nichts wird abgeschnitten.
2. **Reiterleiste ohne Wortbruch.** Beschriftungen sind einzeilig und verkleinern sich bei Bedarf bis 80 %. Die
   Schriftvergrößerung ist in der Reiterleiste auf 1,3 begrenzt. Die Bedienhilfe liest weiter den vollen Namen. Das gilt
   für fünf Reiter bei 360 dp.
3. **Einzahl.** „1 Erfassung wartet auf Bestätigung“, „1 Vorgang …“ in `ScanScreen.tsx` (heute Zeilen 188, 195, 201).
   Bei 0 entfällt der Satz.

### Tests

Je Punkt rot vor der Änderung.
- **Höhenbudget** als Test aus den tatsächlichen Stilwerten für die drei Normalzustände bei 360 × 568 dp Inhaltsfläche.
- **Screenshots** über RN-Web für dieselben Zustände bei 360 und 390 dp, normal und doppelte Schrift.
- **Reiter:** Eigenschaften der Beschriftung (einzeilig, Verkleinerung, Begrenzung) für fünf Reiter.
- **Einzahl und Mehrzahl**, „Zuletzt“ nicht mehr auf „Erfassen“, „Manuell“ unverändert.
- **Volle App-Suite**, Typecheck, Begriffsprüfung.
- **PO am Gerät** nach dem Build: „Erfassen“ bereit, laufend und in Pause ohne Scrollen; Reiter bei großer Schrift.

### Nicht Teil

NFC, Signale (T-112), Erfassungslogik, andere Bildschirme, Web.

### Bericht

`.t114-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2.
Kein Commit vor `APPROVED`. ADO nicht ändern.
