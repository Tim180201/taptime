# Aktuelle Aufgabe

> **Stand 07.10.2026:** T-109 abgeschlossen (`d72ba94`), Deploy 4 vom PO verschoben; T-109 und T-113 gehen zusammen
> raus. Danach T-112 (nur App). Befunde aus dem PO-Test vom 07.10.

## T-113 · Zeiten eingeben im Web einfacher, eigene Zeiten ohne Grund (D-131)

**Für:** Development · **Risiko:** mittel (Migration 052, Korrekturvertrag, Zeitumstellung) · **Zeitbox:** eine bis zwei
Sitzungen. Schema, `backend-time-review`, Verwaltungs-Server, Verträge, Verwaltung (Web), App (nur Grund und Kommentar).

### Auftrag

1. **Eigene Zeiten ohne Grund (D-131).** „Eigen“ entscheidet der Server über die Person (Zeit gehört der handelnden
   Person), nicht über die Rolle.
   - **Nachtragen und Ändern:** Bei eigenen Zeiten ist der Grund freiwillig (`string|null` in den Verträgen). Ohne Grund
     speichert der Server „Selbst nachgetragen“ bzw. „Selbst geändert“; ein angegebener Grund wird gespeichert.
   - **Kommentar:** Beim Nachtragen eigener Zeiten ist er für jede Rolle freiwillig möglich.
   - **Fremde Zeiten ohne Grund:** neues Ergebnis `reason_required` statt Ausnahme, durchgängig von SQL über Koordinator,
     Vertrag und HTTP bis Web und App. Meldung allgemein: „Bitte geben Sie einen Grund an.“
   - **Historie:** `change.actor` ist `self`, wenn die ändernde Person die Zeit besitzt. Das gilt auch für bestehende
     Zeilen; nur die Anzeige ändert sich. Die Historie zeigt „selbst“ und die drei Systemtexte nicht doppelt.
   - **Antworten unverändert:** Schlüssel bleiben gleich, `reason` ist immer Text, ältere Apps lesen weiter.
   - **Migration 052** mit ausgeschriebenen Körpern: `backfill_time_record_v1` (Quelle 049),
     `correct_time_record_v1` (049, Grundprüfung nach dem Laden des Eintrags), `read_time_record_details_v1` (042).
     Alle drei in die Drift-Probe aufnehmen.
   - **Nicht ändern:** Verwaltungsstopp samt Entzugspfad, Löschen und „Zeiten prüfen“.
   - **Oberflächen:** Bei eigenen Zeiten blenden sie das Grundfeld aus und senden `null`, nicht `''`. Betroffen sind
     „Meine Zeiten“ und „Mitarbeiter → Person“ (Web), das Korrekturfeld im Lohnexport (Web) sowie die App.
2. **„Zeit hinzufügen“ ohne Scrollen** (Web).
   - Das Formular bekommt die sichtbare Überschrift „Zeit hinzufügen“.
   - Beim Öffnen rückt es ins Bild: bei 1440 × 900 von der Überschrift bis „Speichern“, sonst ab der Überschrift.
   - Auf breiten Fenstern stehen Datum, Von und Bis in einer Zeile.
   - Enter in einem einzeiligen Feld oder einer Auswahl springt zum nächsten Feld; im letzten Feld vor „Speichern“
     speichert Enter. In Textfeldern bleibt Enter ein Zeilenumbruch. Nur in den Zeitformularen, nicht im gemeinsamen
     `RequiredForm`.
3. **Datum und Uhrzeit getrennt** (Web) statt `datetime-local`. Gilt für „Ändern“ und „Beenden“ in „Meine Zeiten“ und
   „Mitarbeiter → Person“, die Korrektur im Lohnexport und „Zeiten prüfen“ (auch in der Übersicht).
   - Felder: Datum, Von, Bis; bei „Beenden“ Datum und Bis, vorbelegt mit jetzt.
   - Liegt ein geändertes Bis vor oder gleich Von, endet die Zeit am Folgetag; der Hinweis lautet wie beim Nachtragen.
   - Unveränderte Angaben behalten ihren ursprünglichen Zeitpunkt, mit Sekunden und Zeitumstellung. Nur geänderte
     Angaben werden neu berechnet; neue mehrdeutige oder nicht existierende Zeiten werden wie heute abgewiesen.

### Tests

Je Punkt rot vor der Änderung.
- **Server:** eigene Zeit nachtragen und ändern ohne Grund für Administrator und Standortleitung (Systemtext, `self`,
  Kommentar); fremde Zeit `reason_required`; Mitarbeiter, Verwaltungsstopp, Entzug, Löschen und „Zeiten prüfen“
  unverändert; gleiche Befehls-ID idempotent; Antworten bestehen die bisherigen Vertragsprüfungen.
- **Web:** Formular im Bild bei 1440 und 390; Enter-Reihenfolge; getrennte Felder in allen Formularen. Dazu: unverändert
  speichern, nur Bis ändern bei Eintrag über Mitternacht, Herbst-Umstellungsnacht, 23 Stunden über die Frühjahrsnacht.
- **App:** kein Grundfeld bei eigenen Zeiten, bei fremden weiter.
- **Volle Suiten** einschließlich Migrations-Nachspiel, T062-Probe, Drift-Probe, Typechecks, Begriffsprüfung, Layout
  360/390 dp und 1440 px. Bestehende Tests zu fremden Zeiten (T062, T066, T069) bleiben unverändert grün.

### Nicht Teil

Rechte (wer was ändern darf), Fristen für Mitarbeiter, Verwaltungsstopp, Löschen, Entscheidungen in „Zeiten prüfen“,
Datumsfelder der App, T-111, T-112.

### Bericht

`.t113-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2.
Kein Commit vor `APPROVED`. ADO nicht ändern.
