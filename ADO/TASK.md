# Aktuelle Aufgabe

> **Stand 11.11.2026:** T-055a ist auf main (`f5d9d69`): Wiederaufnahmevorgang mit Migration 069 und
> `GET /v1/restore-recovery`. Jetzt T-055b. Die Web-Prüfung (T-055c) und die App (T-055d) folgen.

## T-055b · Erhaltene Belege nach einem Restore zur Prüfung (D-162)

**Für:** Development (Astra, Extra High) · **Risiko:** hoch. Es geht um Zeiten, Herkunft und Mandantentrennung
· **Zeitbox:** zwei Sitzungen. Reißt sie, wird geschnitten und gemeldet (AGENTS 3).

**Grundlage:** D-162, `.t055-review/entwurf.md` (Abschnitt 4 sowie L2, O1 und W2) und `.t055-review/tl-review.md`.
Nur der Server: keine Web-Oberfläche, keine App.

### Umfang

1. **Neuer versionierter Eingang:** Eine angemeldete App bietet nach einem Wiederaufnahmevorgang ihre erhaltenen Belege
   unverändert an: WorkEvent-, Receipt-, Lease- und Item-ID, Installationsbindung, Sequenz, Uhrbeleg, Inhalt und der
   lokale Zustand (bestätigt oder noch offen). Die Anfrage nennt den Vorgang, den die App gelesen hat. Belege mit einer
   Erfassungszeit nach dessen Aktivierung nimmt der Eingang nicht an. Bestehende Verträge bleiben unverändert.
2. **Je Beleg genau ein Ergebnis:**
   - Kennt der Server das exakte Ergebnis schon, gibt er es zurück (wie heute).
   - **Bestätigt, aber unbekannt**, oder **Lease, Item oder Installation fehlt:** Der Beleg kommt in einen
     Wiederaufnahme-Eingang. Dort liegen ein unveränderlicher Umschlag mit Inhaltsdigest, der Bezug zum Vorgang und ein
     benannter Grund (zum Beispiel verlorene Herkunft oder verlorene Entscheidung). Behauptete IDs bleiben vom
     serverseitig belegten Eigentümer getrennt. Es entsteht keine Buchung, kein TimeEntry und keine neue oder
     nachgebaute Lease oder Installation (D-055).
   - **Noch offen und Herkunft vorhanden:** der normale Weg.
   - Die Person ist nur über die aktuelle Anmeldung im wiederhergestellten Bestand zugeordnet. Ohne gültigen Akteur
     wird abgewiesen, der Beleg bleibt auf dem Handy.
3. **Sequenz:** Ein angenommener Beleg belegt seine Gerätesequenz bei vorhandener Installation. So hängen spätere
   Belege desselben Geräts nicht an `sequence_gap`.
4. **Offene Fälle bremsen die Person (D-162):**
   - Solange ein Fall offen ist, zählt er in `has_offline_review_predecessor_v1`. Neue Taps gehen dann zur Prüfung.
   - Sperrbildschirm: keine neuen Schlüssel und keine Aktionen für diese Person. Die Anzeige fällt auf „Bitte App
     öffnen“ zurück (D-146, D-161).
   - Andere Personen bleiben unberührt; es gibt keine Sperre aller Personen (`tl-review.md`).
5. **Prüfgründe nach einem Restore erkennbar (W2):** Ein Beleg mit Erfassungszeit vor der Aktivierung, der danach auf
   dem normalen Weg zur Prüfung geht, trägt den Vorgang als Bezug. Die Anzeige dazu baut T-055c.
6. **Archivnachweis (D-052):** Jeder Eingangsbeleg bekommt einen Archivbedarf. Die Antwort quittiert genau diesen Beleg,
   erst danach darf die App löschen (T-055d). Alte `offsite_archived`-Antworten gelten nicht für einen anderen
   Datensatz.
7. **Lebenszyklus (AGENTS 1.5):** Anlegen durch den Eingang, keine Änderung am Umschlag, Abschluss durch T-055c, kein
   produktiver Löschweg vor T-016. Neue Tabellen mit Mandantenbindung, ENABLE und FORCE RLS, minimalen Rechten und
   Idempotenzschlüssel.
8. **`infrastructure/RESTORE.md`** im selben Commit anpassen (AGENTS 7).

### Tests und Nachweis

- **Physischer Restore** (Vorbild `OfflineRestorePostgres.test.ts`, Fall 2):
  - die verlorene Lease und der bestätigte, verlorene Beleg landen im Eingang, nicht in `lease_binding_conflict`;
  - der bekannte Beleg bringt dasselbe Ergebnis;
  - ein folgender offener Beleg derselben Person geht zur Prüfung;
  - die Person B eines anderen Betriebs bleibt unberührt.
- **Grenzen:** exakter Retry ergibt dasselbe Ergebnis; gleiche IDs mit anderem Inhalt ergeben einen Konflikt; fremder
  Betrieb, fremde Person und manipulierte IDs werden abgewiesen; ohne Vorgang oder mit Erfassungszeit nach der
  Aktivierung wird nicht angenommen; ein fehlender Akteur wird abgewiesen.
- **Sperrbildschirm** mit offenem Fall: weder Schlüssel noch Aktion.
- **Rot zuerst:** Die neuen Fälle laufen gegen `f5d9d69` rot.
- **CI** ganz lokal nachgebaut, die Betriebsskripte auch ohne root. Unabhängiges Review (AGENTS 4).
- **Bericht:** `.t055b-review/bericht.md`, mit den PO-Schritten nach `infrastructure/DEPLOY.md`.

### Grenzen

- Keine Web-Oberfläche, keine App, keine Änderung am normalen Erfassungsweg außer den Punkten 4 und 5.
- Kein Deploy, kein Server, kein Supabase, kein EAS, keine GHCR-Paketaktion, keine Image-Pulls, nichts installieren.
- Kein Commit vor `APPROVED`.
