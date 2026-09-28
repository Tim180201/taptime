# Aktuelle Aufgabe

> **Stand 27.09.2026:** Produktion auf `e13916b` (T-083 ausgeliefert; Migrationen bis 034). Auf `main` zusätzlich T-080
> (`7bd7877`, App). Reihenfolge (PO 25.09.): **App-Builds auf `e13916b` → Rest der Geräteabnahme → T-024 → Pilot Monat 1**.
> Kein offener Auftrag für Development; der nächste Brief folgt aus der Geräteabnahme oder der Code-Analyse.
> Frühere Briefs stehen in der Git-Historie (T-083 zuletzt in `a0bcfc7`).

## T-083 · Die Sicherung bleibt kurz, der Wächter passt sich an — abgeschlossen (`e13916b`, ausgeliefert 27.09.)

Umgesetzt und abgenommen: gemeinsamer Borg-Cache unter der vorhandenen Sperre, tägliches Aufräumen nach erfolgreicher
Sicherung mit Trockenlauf-Schutz für die geprüfte Basis und `borg compact`, Wächter-Toleranz aus der letzten Dauer
(10–55 min), Archivzahlen in `taptime-status`. Offen bleibt nur der Nachtrag aus dem Brief: Dauer der nächsten drei
Sicherungen und `base_seconds` des Archivierers aus `taptime-status` (liefert der PO), Ergebnis in STATUS.md
„Beobachten“. Die neuen Statuszeilen erscheinen erst nach dem Konsolenschritt für `taptime-status` (mit T-024).
