# Aktuelle Aufgabe

> **Stand 27.10.2026:** T-136b freigegeben, mit Deploy 10 (Konsolenschritt vorher). Jetzt **T-138** (Rückmeldung einer Testerin), danach T-137. Beide kommen in den
> nächsten App-Build. Die Builds aus `c84dfc9` für die Abnahme von T-104e bleiben unverändert.

## T-138 · Kunden: Löschen abgesetzt, Tage je Person

**Für:** Development (Astra; Extra High für Server und Vertrag, sonst High) · **Risiko:** mittel. Es gibt einen neuen
Leseweg mit Berechtigung je Person, und die Löschbedienung in App und Web ändert sich · **Zeitbox:** zwei Sitzungen.
Reißt sie, wird Punkt 3 geschnitten, nie 1 und 2.

**Befund (Testerin, PO 27.10.):**
- **Löschen zu nah:** In der App stehen „Kunde umbenennen“ und „Kunde löschen“ direkt untereinander unter Name und
  Stunden (`CustomerManagement.tsx`). Die Rückfrage „Löschen bestätigen“ erscheint fast an derselben Stelle, ein
  schneller Doppeltipp genügt. Im Web stehen beide Knöpfe nebeneinander.
- **Tage je Person fehlen:** Beim Kunden sieht man „Stunden je Person“ für den Monat, aber nicht, an welchen Tagen
  diese Person wie viele Stunden bei diesem Kunden gearbeitet hat. Für die eigenen Stunden gibt es diese Ansicht schon
  („Deine Stunden je Tag“, `scope: 'self'` mit `days`).

### Umfang

1. **Löschen abgesetzt (App und Web):**
   - „Kunde löschen“ steht unten auf der Kundenseite, mit deutlichem Abstand und von den übrigen Aktionen getrennt.
     Es ist als Warnaktion erkennbar, aber nicht die Hauptaktion.
   - Die Rückfrage ist ein eigener Dialog. Darin ist „Abbrechen“ die hervorgehobene Wahl, „Löschen“ steht nie an der
     Stelle des auslösenden Knopfs, und es gibt keinen Fokus und keine Vorauswahl auf „Löschen“.
   - Text wie heute: „Stunden bleiben erhalten.“
   - Dasselbe Muster prüfen bei „Projekt löschen“, „Karte entfernen“, „Zugang entziehen“ und beim Löschen einer Zeit.
     Stellen, an denen Auslöser und Bestätigung ebenso eng liegen, mitkorrigieren und im Bericht auflisten.
2. **Tage je Person (Server, Vertrag):**
   - Neuer additiver Leseweg „Tage einer Person bei einem Kunden in einem Monat“: je Tag die Stunden, „läuft“ und die
     Summe.
   - Tageszuordnung wie bei `days`: nach dem Berliner Tag, an dem der Eintrag beginnt.
   - Die Summe stimmt exakt mit der Zeile in „Stunden je Person“ überein, das ist ein Test.
   - Berechtigung genau wie die Personenliste des Kunden: Administrator im Betrieb, Standortleitung nur in ihrem
     Bereich, Ehemalige nach D-143. Mitarbeiter bekommen nur ihre eigenen Tage.
   - Fremde oder unberechtigte Person oder fremder Kunde: dieselbe Antwort wie „nicht gefunden“, ohne Hinweis.
   - Antwort höchstens 14 KiB (D-138). Bestehende Wege bleiben unverändert.
3. **Tage je Person (App und Web):**
   - In „Stunden je Person“ ist jede Person antippbar beziehungsweise anklickbar.
   - Darunter erscheint eine Unteransicht „Person · Kunde · Monat“ mit den Tagen (Datum, Stunden, „läuft“), der Summe
     und dem Zurück-Weg wie bei den übrigen Unteransichten.
   - Monatswechsel bleibt in der Unteransicht. Laden, Fehler, „Erneut versuchen“ und leere Tage wie in den bestehenden
     Ansichten. Barrierefrei: Rolle und Beschriftung je Zeile.

### Tests und Nachweis

- **Zuerst rot:**
  - Rückfrage an der Stelle des Auslösers;
  - fehlende Tagesansicht.
- **Server:** gegen PostgreSQL 17:
  - Mandantentrennung;
  - Standortleitung außerhalb ihres Bereichs;
  - Ehemalige;
  - Monatsgrenzen bei Sommer- und Winterzeit;
  - laufende Zeit;
  - Summe gleich Personenzeile;
  - Größengrenze.
- **B3:** Inventar ergänzen, falls neue Funktionen oder Rechte entstehen.
- **Browser-Layout und Barrierefreiheit:** neue Ansichten in beiden Themen und bei 390 px.
- **App:** Fotos der neuen Ansichten für den PO, im Bericht.
- **Prüfliste** `.t138-review/pruefliste.md` für den PO am Gerät.
- **Bericht** `.t138-review/bericht.md`. Die ganze CI lokal nachbauen.

### Grenzen

- Kein Server- oder Supabase-Zugriff, kein Deploy, keine EAS-Builds, keine GHCR-Paketaktion, nichts installieren
  (AGENTS 3).
- Kein Commit vor `APPROVED`.
