# Aktuelle Aufgabe

> **Stand 11.11.2026:**
> - T-144 ist APPROVED und auf main. Die Messung vor und nach dem Deploy macht der PO.
> - Jetzt T-055, zuerst nur der Entwurf. T-055 und T-144 gehen zusammen in einen Deploy.

## T-055 · Wiederaufnahme nach einem Restore (D-055), Teil 1: Entwurf mit Varianten

**Für:** Development (Astra, Extra High) · **Risiko:** hoch. Es geht um Zeiten, ihre Herkunft und die Wiederherstellung
· **Zeitbox:** eine Sitzung · **Ergebnis:** ein Entwurf, kein Produktcode.

### Ausgangslage

- **D-055:** Nach einem Restore auf den letzten Archivpunkt kann eine Lease fehlen, die erst danach ausgestellt wurde.
  Das erhaltene Ereignis vom Handy endet dann in `lease_binding_conflict`, obwohl der Server den Start vorher bestätigt
  hatte. Beleg: `OfflineRestorePostgres.test.ts`, Fall 2 in `infrastructure/RESTORE.md`.
- **Eiserne Grenze:** Niemals eine neue Lease-ID in erhaltene Evidenz schreiben.
- **Externes Review 30.10. (P1):** drei Befunde derselben Art, „was passiert beim erneuten Einspielen“:
  1. **Lease-Bindung:** Lease und Installation, die nach der Archivgrenze entstanden, fehlen nach dem Restore.
  2. **Reihenfolge über Installationen:** Die Ereignisse eines Beschäftigten von mehreren Installationen kommen nach dem
     Restore in anderer Reihenfolge an als vorher. Die Entscheidung kann sich dadurch ändern.
  3. **Zeitfenster bei spätem Replay:** Der Zeitpunkt des Replays entscheidet über `automatic_window_elapsed` (72 h nach
     Lease-Ende) und über den aktuellen Stand von Identität und Mitgliedschaft. Eine schon gezeigte Entscheidung kann so
     in eine Prüfung kippen.

### Umfang des Entwurfs (`.t055-review/entwurf.md`)

1. **Belegen:** Für jeden Befund die genaue Code-Spur und, wo möglich, einen roten Test (lokal, uncommittet). Fall 2 ist
   schon rot. Ist ein Befund nicht nachstellbar oder harmlos, das begründen.
2. **Je Befund mindestens zwei Varianten**, jeweils mit:
   - Verhalten für Lehrkraft und Standortleitung;
   - Einhaltung von D-055 und D-052;
   - neue Daten mit Lebenszyklus (AGENTS 1.5) und Migration;
   - App-Änderung ja oder nein, also ob ein App-Build nötig ist;
   - Deploy-Schritte, Testplan und Aufwand.
3. **Kandidaten des TL** (bewerten, nicht einfach übernehmen):
   - Die Lease erst nach externem Archivnachweis aushändigen oder aktivieren. Sie lebt 12 h, die Wartezeit fällt also
     einmal an, nicht je Tap. Vorher klären: Braucht ein Tap mit Netz überhaupt eine Lease?
   - Ein benannter Prüfgrund statt `lease_binding_conflict`, falls es doch eintritt.
   - Das Zeitfenster aus dem Restore selbst ableiten, etwa aus der Ausfalldauer zwischen letztem Archivpunkt und
     Aktivierung, nicht aus einer neuen festen Zahl (AGENTS 1.6).
   - Für die Reihenfolge: belegen, wie oft ein Beschäftigter mehrere aktive Installationen hat, und den Fall erkennen und
     benennen, statt eine Reihenfolge zu raten.
4. **Empfehlung** mit Begründung. Dazu benennen, welche Punkte eine PO-Entscheidung brauchen (AGENTS 5), zum Beispiel
   einen neuen sichtbaren Prüfgrund oder eine Wartezeit nach der Anmeldung.

### Grenzen

- Kein Produktcode, keine Migration, kein Commit. Rote Tests bleiben lokal.
- Lokales Docker nur mit vorhandenen Abbildern. Keine Pulls, nichts installieren (AGENTS 3).
- Kein Deploy, kein Server, kein Supabase, kein EAS, keine GHCR-Paketaktion.
- Ein unabhängiges Review prüft den Entwurf (AGENTS 4). Danach Bericht an den TL nach AGENTS 8.
