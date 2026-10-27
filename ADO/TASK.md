# Aktuelle Aufgabe

> **Stand 27.10.2026:** T-138 freigegeben, mit Deploy 10 und dem nächsten App-Build. Jetzt **T-137**. Sein App-Teil kommt mit T-138 in den nächsten App-Build.

## T-137 · Restliche Ladezeiten und kleine Restpunkte

**Für:** Development (Astra; Extra High für Server und Migrationen, sonst High) · **Risiko:** mittel. Leseabfragen und
Indizes ändern sich, der Inhalt der Antworten bleibt gleich · **Zeitbox:** zwei Sitzungen. Reißt sie, werden die
Punkte am Ende von 1 geschnitten, nie 2 und 3.

**Befund (T-099b, Spitze und erwartet, Richtwert p95 300 ms; `.t099b-review/report.md`):**

| Profil | Weg | Rolle | p95 |
|---|---|---|---:|
| Spitze | `quota-alerts` | Administrator | 701,5 ms |
| Spitze | `customer-month` | Administrator | 692,8 ms |
| Spitze | `archive-status` | Standortleitung | 688,3 ms |
| Spitze | `setup-initial` | Standortleitung | 510,1 ms |
| Spitze | `quota-alerts-current` | Administrator | 409,2 ms |
| erwartet | `setup-initial` | Standortleitung | 507,6 ms |
| beide | `setup-nfc_tags` | Standortleitung | 315 bis 316 ms, knapp an der 14-KiB-Grenze |

Dazu kommen zwei Restpunkte aus T-104e:
- **P3-2:** Die Archivabfrage des Sperrbildschirms (`lock_screen_archive_status_v1`) findet keinen passenden Index
  auf `sync_receipts` nach Organisation, Person und Eintrag.
- **P3-5:** `reloadAfterCapture` veröffentlicht nur die erste Seite. Danach steht kurz „Zeitraum nicht vollständig
  geladen“.

### Umfang

1. **Ladezeiten:**
   - Je Weg zuerst die Ursache am Plan belegen (`EXPLAIN (ANALYZE, BUFFERS)` auf den Daten des Pilotwerkzeugs), dann
     beheben.
   - Erlaubt sind Abfrageform, gemeinsame Vorberechnung im selben Aufruf und additive Indizes.
   - Inhalt, Reihenfolge, Berechtigung und Seitenverträge bleiben exakt gleich, belegt durch Alt-Neu-Gleichheitstests
     auf denselben Daten.
   - Keine Grenze und keine Frist wird hochgesetzt (D-152). Alte Vertragsfassungen bleiben.
   - Reihenfolge nach Wirkung: `quota-alerts`, `customer-month`, `archive-status`, `setup-initial`, `setup-nfc_tags`.
2. **Index für die Archivabfrage des Sperrbildschirms:**
   - Nötig ist ein passender Index für die Abfrage; Plan vorher und nachher.
   - Schreibkosten des Index beim Sync messen und im Bericht nennen.
3. **App: vollständiger Kalender nach einer Erfassung:**
   - `reloadAfterCapture` ersetzt den Kalender erst, wenn alle Seiten geladen sind, wie `readPreservingActive` seit
     T-104e.
   - Rot-Test zuerst.
   - Rückmeldungen zur Erfassung und das Verhalten bei `capturePending` bleiben unverändert.

### Tests und Nachweis

- **Messung** mit `tests/pilot-size/` vorher und nachher, beide Profile. Vorher-Nachher-Tabelle je Weg im Bericht,
  Ziel unter 300 ms. Wo das Ziel verfehlt wird, steht die Ursache mit Plan im Bericht.
- **Server:** gegen PostgreSQL 17 Alt-Neu-Gleichheit für jeden geänderten Weg und Rolle.
- **B3** und Migrationsprüfung grün. Neue Migrationen nur additiv.
- **Bericht** `.t137-review/bericht.md`. Die ganze CI lokal nachbauen.

### Grenzen

- Kein Server- oder Supabase-Zugriff, kein Deploy, keine EAS-Builds, keine GHCR-Paketaktion, nichts installieren
  (AGENTS 3).
- Kein Commit vor `APPROVED`.
