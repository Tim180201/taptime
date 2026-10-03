# Aktuelle Aufgabe

> **Stand 03.10.2026:** Produktion auf `0230188` (Migrationen bis 039). Auf `main` zusätzlich T-093 (`19a363d`) und
> T-094 (`947ac51`, Migration 040). Vor dem Pilot: T-091, T-092, T-095 bis T-098, T-100 bis T-103 → zweiter Deploy →
> T-024 → Pilot. Frühere Briefs stehen in der Git-Historie.

## T-091 · Standortmodus nach D-102

**Für:** Development · **Risiko:** Kernkette (Trigger → WorkEvent → Engine → TimeEntry), Offline-Warteschlange, Standort-
grenzen der Standortleitung (D-059, D-091, D-107) · **Zeitbox:** zwei Sitzungen. Analyse-Befunde F-006, F-008, F-024,
F-074, F-145. frogs hat mehrere Standorte; das hier ist der Normalfall des Pilots.

### Befund (Code auf `947ac51`)

1. **Allgemeine Arbeitszeit** verlangt bei eingeschalteten Standorten genau eine Standortbindung
   (`location_setup_is_complete_v1`, 019:356-373) und erscheint dann nur Personen dieses Standorts: in der Zielliste
   (`read_mobile_work_targets_v1`, 020), beim Nachtragen (`read_time_backfill_targets_v1`,
   `membership_may_choose_time_target_v1`, 033). Der Trigger `resolve_work_event_location_v1` (019) verlangt für sie
   zusätzlich einen vom Client gesetzten Standort, den kein Aufrufer setzt: Jeder Start scheitert mit 23514.
2. **Der Trigger wirft statt zu entscheiden:** Pause ohne laufende Zeit (23514), Ziel ohne gültige Bindung (23514),
   Person ohne Arbeitsberechtigung am Standort (42501). Online endet das als 503; offline und im Prüfpfad rollt es das
   gespeicherte Ereignis zurück, der Kopf der Geräte-Warteschlange bleibt stehen.
3. **Offline-Freigabe ungefiltert:** `lock_offline_capture_projection_v3` (017) enthält Ziele und Tags aller Standorte;
   online ist die Liste gefiltert (020). Offline gewählte fremde Ziele landen in Fall 2.
4. `accepted_work_location_id` wird geschrieben, aber nirgends gelesen (F-145).
5. Kein Test mit eingeschalteten Standorten für Offline v4 samt Freigabe, Allgemeine Arbeitszeit, Pause ohne laufende
   Zeit, fremden Tag oder Nachtragen außerhalb von Kunden.

### Auftrag (D-102)

**A. Allgemeine Arbeitszeit ist standortfrei.** Keine Bindung nötig und nicht Teil der Vollständigkeitsprüfung; für jede
aktive Person wählbar (Zielliste online und offline, Nachtragen durch die Person selbst, Standortleitung, Administrator
nach den bestehenden Regeln). Standort des Ereignisses ist der Heimatstandort der Person; hat sie keinen, NULL.
Bestehende Bindungen der Allgemeinen Arbeitszeit bleiben unverändert in der Historie, wirken aber nicht mehr.

**B. Der Trigger zeichnet auf, die Engine entscheidet.** Der Standort-Trigger wirft für WorkEvents keine Ausnahme mehr.
Pausen übernehmen den Standort der laufenden Zeit; ohne laufende Zeit NULL, die Engine lehnt wie heute ab. Lässt sich der
Standort eines Ziels nicht auflösen oder fehlt der Person die Arbeitsberechtigung dort: Standort NULL und das Ereignis
bekommt eine sichtbare Entscheidung statt eines 503, online eine verständliche Ablehnung, offline und historisch ein
Prüffall mit eigenem Grund (der Grund kommt in die gemeinsame Liste der Prüfgründe; Admin-Web und App müssen ihn
anzeigen können). Nie endlose Wiederholung, nie verlorene Evidenz. Client-Overrides bleiben verboten.

**C. Offline-Freigabe gefiltert.** Die Projektion enthält dieselben Ziele und Tags wie die Online-Liste der Person
(Heimat- und Arbeitsstandorte) plus Allgemeine Arbeitszeit und Pausen-Tags. Wenn möglich gleicher Vertrag, nur gefiltert,
damit keine App-Änderung nötig ist; sonst im Bericht begründen. Bereits ausgestellte, ungefilterte Freigaben laufen aus;
Ereignisse daraus landen in B.

**D. Testmatrix.** PostgreSQL-Suite „Standortmodus“: zwei Standorte, je eine Standortleitung und Mitarbeiter, ein
Administrator, Kunden und Projekte je Standort. Für Offline v4 und manuell: Start, Stopp, Pause für Kunde, Projekt,
Allgemeine Arbeitszeit; Pause ohne laufende Zeit; Tag eines fremden Standorts; Ziel nach Entzug der Bindung. Nachtragen
von Allgemeiner Arbeitszeit durch Person, Standortleitung, Administrator. Inhalt der Freigabe je Person. Anlegen von
Kunde und Projekt (aus T-086/T-090) im selben Aufbau.

Höchstens eine Migration (041), nur anfügend. Lehre aus T-086: die T-062-Probe vergleicht geschützte Funktionen; wenn sie
eine der ersetzten Funktionen schützt, die Erwartung testseitig auf 041 erweitern und im Bericht nennen.

### Tests

Rot vor Grün am alten Code für jeden Punkt aus D. Alle Suiten, die Migrationen einspielen oder die Pfade berühren:
`backend-schema`, `backend-time-review` (DA3, T-062-Probe), `backend-lifecycle`, `backend-offline-sync`,
`backend-mobile-work`, `backend-administration`, `backend-time-export`, `backend-api`, `admin-web` (Unit und Browser),
`mobile` (Typecheck, Tests; `expo export` nur, falls die App sich ändert). Im Bericht jede Suite mit Befehl und Ergebnis.

### Nicht Teil

Kein Deploy, kein Serverzugriff. Keine Änderung an Rollen und Rechten außerhalb dieser Regeln, keine Exportspalte für
den Standort (B01), keine Änderung am Verhalten bei ausgeschalteten Standorten.

### Bericht

`.t091-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf „kein Ereignis geht verloren
oder blockiert die Warteschlange, keine Person sieht Ziele fremder Standorte“. Kein Commit vor `APPROVED`.
