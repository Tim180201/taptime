# Aktuelle Aufgabe

> **Stand 12.11.2026:** T-055b ist auf main (`ae02cb4`, CI und Images grün): Wiederaufnahme-Eingang mit Migration 070.
> Jetzt T-055c. Danach T-055d (App), dann App-Build und ein Deploy mit T-144.

## T-055c · Prüfung der Wiederaufnahme im Web (D-162)

**Für:** Development (Astra, Extra High) · **Risiko:** hoch. Es geht um Zeiten, Rechte und Mandantentrennung
· **Zeitbox:** zwei Sitzungen. Reißt sie, wird geschnitten und gemeldet (AGENTS 3).

**Grundlage:** D-162, `.t055-review/tl-review.md`, `.t055b-review/tl-review.md` (Abschnitt „Entscheidung zur offenen
Frage“) und `restore_recovery_evidence` aus Migration 070.

### Umfang

1. **In „Zeiten prüfen“, keine neue Insel:**
   - Offene Wiederaufnahme-Fälle erscheinen in der bestehenden Prüfansicht im Web. Die Standortleitung sieht nur ihren
     Bereich, die Verwaltung den ganzen Betrieb, die Lehrkraft nichts von anderen.
   - Je Fall: Person, Erfassungszeit und Art (Start, Stopp, Pause, Weiter), Ziel soweit im Bestand, Gerät und Sequenz,
     Zeitpunkt der Wiederherstellung und der Grund in Klartext, etwa „Bestätigte Erfassung nach Wiederherstellung
     verloren“ oder „Herkunftsbeleg nach Wiederherstellung fehlt“.
   - Ein Fall ist eine Behauptung des Geräts, nicht belegt. Das muss erkennbar sein.
2. **Abschluss wie die bestehende Prüfung:** Die drei vorhandenen Auflösungen sind „Keine Änderung“, „Zeit ändern“ und
   „Ende/Zeit nachtragen“:
   - immer mit Grund (D-162, auch für die Verwaltung);
   - append-only, idempotent, mit Gleichzeitigkeitsschutz;
   - vorbefüllt aus dem Beleg.

   Dazu ein Abschluss „Vollständigkeit unbestätigt“, wenn ein Gerät nicht zurückkommt; er bleibt sichtbar. Eine daraus
   entstehende Buchung ist als Prüfentscheidung zum Beleg erkennbar, nie als ursprünglicher Tap (D-070, D-162).
3. **Freigabe:** Ein abgeschlossener Fall zählt nicht mehr in `has_offline_review_predecessor_v1` und nicht mehr in
   den Sperrbildschirm-Prüfungen. Offene Fälle derselben Person zählen weiter.
4. **Restore-Bezug sichtbar (W2):** Normale Prüffälle mit Bezug aus `offline_review_restore_references` zeigen „nach
   Wiederherstellung“ statt der Meldung, das Handy habe zu spät übertragen.
5. **Übrige Schreibwege (TL zu T-055b):**
   - Für eine Person mit offenem Fall buchen nicht:
     - die Web-Erfassung eigener Zeiten (`/v1/lifecycle-events/manual`, `/manual-break`);
     - die direkten Routen (`/v1/lifecycle-events`, `/v1/lifecycle-events/deferred`).
   - Das Web zeigt dann einen neuen, versionierten Zustand, etwa „Deine Zeiten werden nach einer Wiederherstellung
     geprüft“.
   - Alte Clients bekommen einen sicheren, wiederholbaren Fehler. Dabei geht nichts verloren und nichts wird gebucht.
6. **Verträge:** Neue Prüfdaten kommen nur über neue, versionierte Abfragen. Bestehende Versionen (`review-items` v1–v4)
   bleiben unverändert, damit kein alter Leser an unbekannten Werten scheitert.
7. **Lebenszyklus (AGENTS 1.5):** Abschlüsse sind neue, unveränderliche Datensätze, der Umschlag bleibt unverändert,
   kein produktiver Löschweg vor T-016. Neue Tabellen mit Mandantenbindung, ENABLE und FORCE RLS und minimalen Rechten.
8. **`infrastructure/RESTORE.md`** im selben Commit anpassen (AGENTS 7). Darin steht, wie die Verwaltung nach einem
   Restore die Fälle abarbeitet.

### Tests und Nachweis

- **Rechte:** Standortleitung nur im eigenen Bereich; fremder Betrieb, Lehrkraft und fehlender Grund werden abgewiesen;
  exakter Retry ergibt dasselbe Ergebnis, abweichender Inhalt oder veralteter Stand einen Konflikt.
- **Freigabe:** Nach dem Abschluss gehen neue Taps wieder normal und der Sperrbildschirm wird wieder ausgestellt.
  Bleibt ein zweiter Fall offen, sperrt er weiter.
- **Schreibwege:** Mit offenem Fall bucht keiner der vier Wege, ohne Fall alle wie bisher.
- **Physischer Restore** nach dem Vorbild `T055bRecoveryPostgres.test.ts`: Eingang, Prüfung und Abschluss Ende zu Ende,
  mit Isolation eines zweiten Betriebs.
- **Web:** Layout- und Barrierefreiheitsprüfung (alle Chrome-Shards) mit Fokus, Tastatur und schmaler Breite; Texte in
  Klartext ohne Technikbegriffe.
- **Rot zuerst** gegen `8e250e3`. Die CI ganz lokal nachbauen, die Betriebsskripte auch ohne root. Ein unabhängiges
  Review (AGENTS 4).
- **Bericht:** `.t055c-review/bericht.md` mit den PO-Schritten nach `infrastructure/DEPLOY.md`.

### Grenzen

- Keine App-Änderung (T-055d), keine Änderung am Eingang aus T-055b außer den Punkten 3 und 5.
- Kein Deploy, kein Server, kein Supabase, kein EAS, keine GHCR-Paketaktion, keine Image-Pulls, nichts installieren.
- Kein Commit vor `APPROVED`. `acceptance.yml`, `.dossier/`, `junit-*.xml` und `Claude outputs/` gehören dem PO: nicht
  ändern, nicht committen, nicht löschen.
