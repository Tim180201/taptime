# Aktuelle Aufgabe

> **Stand 26.10.2026:** T-104e auf main (`c84dfc9`). Der PO baut die Apps aus einer sauberen Kopie von `c84dfc9`,
> danach Deploy 9 (Ziel `c84dfc9`, T-099b und T-104e) und Geräteabnahme. Parallel **T-135** für Deploy 10.

## T-135 · „Zeiten prüfen“ in Pilotgröße: Tageszeiten gebündelt, Schließen ohne Tageszeiten

**Für:** Development (Astra, Extra High für Server und Vertrag, sonst High) · **Risiko:** mittel: neuer Leseweg mit
Berechtigung je Prüffall, Standortleitung nur im eigenen Bereich · **Zeitbox:** zwei Sitzungen. Reißt sie, wird
Punkt 3 geschnitten, nie 1 und 2.

**Befund:**
- `ReviewsView` lädt die Tageszeiten jedes Falls einzeln und nacheinander über `loadReviewDay` →
  `managedPersonTime`. Die Seite liefert bis zu 100 Fälle (`limit: 100`).
- In der T-099b-Messung brauchte die Browser-Ansicht p95 1,59 s für 20 Fälle (STATUS, P2). Bei 100 offenen Fällen
  wären es entsprechend mehr.
- Der Knopf „Änderung prüfen“ ist gesperrt, solange die Tageszeiten nicht geladen sind, auch bei „So lassen“.
  Sind sie nicht lesbar, lässt sich der Fall nicht schließen (Teil 2 von T-111).

### Umfang

1. **Gebündelter Leseweg** (neue Vertragsfassung, additiv; `managedPersonTime` und die Prüffall-Wege bleiben
   unverändert):
   - Der Client schickt nur Prüffall-IDs. Person und Berliner Geschäftstag leitet der Server aus dem Prüffall ab,
     unter der Berechtigung des Prüfers: Administrator im Betrieb, Standortleitung nur in ihrem Bereich, Ehemalige nach
     D-143.
   - Fremde, unbekannte oder nicht berechtigte IDs bekommen kein Ergebnis und verraten nichts.
   - Inhalt je Fall wie heute: Zeiten des Tages und laufende Zeit, abgeschnitten wie in `loadReviewDay`.
   - Höchstens eine Abfrage je angefangene 20 Fälle. Jede Antwort höchstens 14 KiB (D-138).
   - Seiten, Cursor und Grenzen sind fest. Keine Grenze wird als Lösung hochgesetzt (D-152).
2. **Browser:**
   - `ReviewsView` lädt die Tageszeiten über den neuen Weg statt seriell je Fall.
   - Bestehende Fehler- und Erneut-Laden-Zustände je Fall bleiben.
   - Ein Wechsel von Berechtigung oder Standort verwirft alte Antworten wie heute.
   - „Weitere Erfassungen laden“ lädt nur die Tageszeiten der neuen Fälle.
3. **Schließen ohne Tageszeiten (T-111, Teil 2):**
   - „So lassen“ und reine Notizfälle (`offline_skip`, Pause) lassen sich auch ohne geladene Tageszeiten entscheiden.
   - Dazu ein sichtbarer Hinweis, dass die Tageszeiten fehlen.
   - „Zeit ändern“ und „Ende nachtragen“ brauchen die Tageszeiten weiterhin.
   - Die Prüfung auf dem Server bleibt unverändert.
   - Der direkte Verweis auf die blockierende frühere Erfassung (Teil 1 von T-111) bleibt im Pilotmonat 1.

### Tests und Nachweis

- **Zuerst rot:**
  - Zahl der Leseabfragen für 20 und für 100 Fälle;
  - „So lassen“ bei nicht lesbaren Tageszeiten.
- **Server:** gegen PostgreSQL 17:
  - Mandantentrennung;
  - Standortleitung außerhalb ihres Bereichs;
  - Ehemalige;
  - gemischte erlaubte und nicht erlaubte IDs;
  - Tagesgrenze bei Sommer- und Winterzeit;
  - laufende Zeit;
  - Größengrenze.
- **B3:** Sicherheitsinventar ergänzen, falls neue Funktionen oder Rechte entstehen.
- **Messung** mit `tests/pilot-size/` vorher und nachher (Profil Spitze), als Vorher-Nachher-Tabelle im Bericht:
  - „Zeiten prüfen“ im Browser p95 unter 1 s;
  - neuer Leseweg p95 unter 300 ms (Richtwerte T-099a).
  - Ist danach die Archivstatus-Abfrage dieser Seite der Engpass, darf sie mit behandelt werden.
- **Bericht:** `.t135-review/bericht.md`.

### Grenzen

- Kein Server- oder Supabase-Zugriff, kein Deploy, keine EAS-Builds, keine GHCR-Paketaktion, nichts installieren
  (AGENTS 3).
- Die ganze CI lokal nachbauen.
- Kein Commit vor `APPROVED`.
- `c84dfc9` bleibt das Ziel von Deploy 9: Diese Aufgabe kommt mit Deploy 10.
