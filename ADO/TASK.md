# Aktuelle Aufgabe

> **Stand 05.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b, T-103 und T-095, Auslieferung mit dem nächsten Deploy.
> Reihenfolge: **T-095b**, dann T-096 bis T-098, T-100 bis T-102 → Deploy und App-Builds → T-024 → Pilot. Frühere
> Briefs stehen in der Git-Historie.

## T-095b · Hängende Erfassung beim Server klären (D-121)

**Für:** Development · **Risiko:** Lebenszyklus-Eingang (Gerätesequenz), Prüffälle, Belegerhalt · **Zeitbox:** eine
Sitzung. `apps/backend-offline-sync`, `apps/backend-api`, `apps/backend-time-review` (Prüfliste), neue Migration 044,
`apps/mobile` (Sendeweg und Anzeige), Admin-Web (Prüffall-Anzeige), Verträge. Keine Änderung an der Engine.

### Befund

Seit T-095 legt die App eine dauerhaft abgelehnte Erfassung unverändert in die Quarantäne (höchstens eine). Der Server
nimmt Ereignisse eines Geräts nur lückenlos an (`offline_sync_cursors.last_durable_sequence + 1`); der Nachfolger
bekommt `sequence_gap`, die App zeigt „Übertragung angehalten“. Ohne Server-Schritt bleibt das Gerät stehen.

### Auftrag

1. **Neuer Aufruf „Sequenz überspringen“** (eigene Route oder Version am Offline-Eingang): Das Gerät meldet für genau die
   nächste erwartete Sequenz `deviceSequence`, `workEventId`, `receiptId`, Grund aus der Quarantäne, Zeitpunkt der
   Erfassung, Lease-Eintrag (Ziel) und SHA-256 des unveränderten Belegs. Gleiche Authentifizierung, Installation,
   Mitgliedschaft und Grenzen wie der Ereigniseingang.
2. **Server (Migration 044):** Tabelle für übersprungene Sequenzen (append-only, Eigentümer und Rechte wie die
   Ereignistabellen); in einer Transaktion Eintrag anlegen, Cursor um genau eins weiter, Prüffall „Erfassung konnte
   nicht verarbeitet werden“ mit Person, Ziel, Zeitpunkt und Grund. **Keine Zeitbuchung**, kein WorkEvent. Idempotent:
   dieselbe Meldung erneut → gleiche Antwort; abweichender Inhalt für dieselbe Sequenz → Konflikt. Eine Sequenz, die
   der Server bereits gebucht hat, darf nie übersprungen werden.
3. **Prüffall:** erscheint in der Prüfliste (Web und App, gleiche Rollenregeln wie andere Prüffälle), ist erledigt,
   sobald die Verwaltung ihn mit Notiz schließt oder die Zeit nachträgt (T-066). Export und Kalender unverändert.
4. **App:** Liegt eine Übertragungs-Quarantäne vor und antwortet der Server mit `sequence_gap`, meldet die App die
   Quarantäne mit dem neuen Aufruf, markiert den Beleg danach als „dem Server gemeldet“ (Beleg bleibt unverändert
   gespeichert, sperrt den Kontowechsel nicht mehr) und sendet die Nachfolger. Anzeige: „1 Erfassung wird von deiner
   Verwaltung geprüft · Kunde X · 08:12“. Scheitert die Meldung, bleibt „Übertragung angehalten“.
5. Alte Apps ohne den Aufruf verhalten sich wie heute.

### Tests

Rot vor Grün: (1) Quarantäne, Meldung, Nachfolger wird gebucht; (2) Wiederholung der Meldung idempotent; abweichender
Inhalt → Konflikt; (3) Meldung für eine bereits gebuchte oder nicht nächste Sequenz → abgelehnt; (4) fremde
Installation/Mitgliedschaft → abgelehnt; (5) Prüffall sichtbar für Administrator und Standortleitung des Standorts,
nicht für andere; (6) keine Zeit in Kalender oder Export; (7) Kontowechsel nach Meldung möglich. Alle Suiten, die
Migrationen abspielen, lokal (Lehre T-086); CI-Bauordnung (Lehre T-091).

### Nicht Teil

Engine, Umnummerieren oder Löschen von Belegen, automatische Nachbuchung.

### Bericht

`.t095b-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
