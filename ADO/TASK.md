# Aktuelle Aufgabe

> **Stand 06.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-102, T-075 und T-106 (Migrationen 043–049).
> T-107 geht noch in den dritten Deploy. T-098b wartet auf den PO am Mac (Brief: `git show 5071e6e:ADO/TASK.md`).
> Befunde: `.audit-ux-2026-10/report.md` (UX-…) und `selbsterklaerend.md` (SE-…), nur lokal (D-103).

## T-107 · UX vor dem Pilot: Fehler und Kernabläufe (D-112, D-123)

**Für:** Development · **Risiko:** mittel (Kernablauf Erfassen, Einrichtung, eine Migration) · **Zeitbox:** zwei
Sitzungen. App, Verwaltung, Betreiber-Web, Verwaltungs- und Betreiber-Server.

### Auftrag

1. **App-Kalender (UX-001):** Kopf und Tage immer in sieben festen Spalten; kein Umbruch von „So“, jeder Tag unter
   seinem Wochentag, bei 360/390 dp und großer Systemschrift.
2. **Web „Manuell“ (UX-002):** Das gewählte Ziel steht sichtbar am Knopf („Zeit starten · Kunde X“). Blendet die Suche
   es aus, wird die Auswahl aufgehoben. Nulltreffer: „Keine Arbeitsziele für ‚…‘ gefunden.“ mit „Suche löschen“.
3. **Standorte einschalten (SE-001, D-102):** Die Liste der fehlenden Zuordnungen verlangt für die Allgemeine
   Arbeitszeit keine Standortbindung mehr, wie die Datenbankregel aus 041. Vorhandene Bindungen bleiben unberührt.
4. **Erfassen zeigt, was läuft (UX-005, D-112):** In der App steht oben auf „Erfassen“, vor dem Scan-Kreis: „Läuft seit
   08:12 · Kunde X“ bzw. „Pause seit 10:30“, mit „Zeit beenden“ und „Pause starten“/„Pause beenden“. Dieselben
   manuellen Ereignisse und Abläufe wie heute auf „Manuell“; auch offline wie dort. „Manuell erfassen“ bleibt für den
   Start ohne Karte.
5. **Fremde laufende Zeit beenden (SE-006):** In der Personenansicht (App und Web) führt der laufende Status direkt zu
   „Zeit beenden“ im vorhandenen Formular für den Verwaltungsstopp.
6. **Name des ersten Administrators:** „Betrieb anlegen“ im Betreiber-Web verlangt zusätzlich den Namen der Person; er
   wird ihr Anzeigename. Neue Funktionsversion per Migration (050); die bisherige bleibt für laufende Clients. Wo heute
   „Ohne Namen“ erscheint, steht ersatzweise die Rolle wie in den übrigen Listen. Kennt die App-Sitzung den Namen
   bereits, zeigt der Kopf „Name · Rolle“ statt der E-Mail; sonst nicht Teil.
7. **Stunden:Minuten (D-123):** jede Dauer in App und Web als „9:54 h“, auch Pausen, Kalenderzellen, Summen,
   Personen- und Kundenstunden; Kontingente „32:30 von 40 h“. Lohnexport unverändert. Eine gemeinsame Formatfunktion.
8. **Texte und kleine Rückmeldungen** mit dem im Bericht genannten Wortlaut: UX-004 (Löschblatt nennt Person, Ziel,
   Datum, Zeitraum), UX-006, UX-008 (Feldgrenzen Betreiber ≥ 3:1), UX-009 (Schließen während Speichern gesperrt),
   UX-011 (Ergebnis einmal angekündigt), UX-013, UX-014, UX-015, UX-017, UX-019, UX-020, UX-021.

### Tests

Je Punkt rot vor der Änderung. Kalender: Monat mit Beginn am Sonntag und am Montag, Oktober 2026, 360 dp. Manuell: Ziel
wählen, wegsuchen, Start bucht nichts Unsichtbares. Standorte einschalten mit ungebundener Allgemeiner Arbeitszeit
(Server und Web). Erfassen: laufend, Pause, offline, Beenden aus der Pause (D-117). Betrieb anlegen mit Namen, alte
Variante weiter gültig. Formate: Grenzfälle 0:00, 0:59, 24:00, über 100 h. Volle Suiten einschließlich aller Suiten, die
Migrationen nachspielen, Drift-Probe der Funktionskörper, Typechecks, Layoutprüfung der geänderten Ansichten.

### Nicht Teil

Begriffe („Karte“, D-124) und übrige SE-Vorschläge (T-108), Suche (T-099), Zugangsverwaltung (T-105).

### Bericht

`.t107-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
