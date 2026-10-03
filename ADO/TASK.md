# Aktuelle Aufgabe

> **Stand 03.10.2026:** Produktion auf `0230188` (Migrationen bis 039). Auf `main` zusätzlich T-093, T-094 (040) und
> T-091 (041). Vor dem Pilot: T-092, T-095 bis T-098, T-100 bis T-103 → zweiter Deploy → T-024 → Pilot. Frühere Briefs
> stehen in der Git-Historie.

## T-092 · Austritt (D-101, D-115)

**Für:** Development · **Risiko:** Lohn des Austrittsmonats, Kernkette (Verwaltungsstopp D-071/D-073), Rechte der
Standortleitung · **Zeitbox:** eine bis zwei Sitzungen. Analyse-Befunde F-004, F-066, F-101.

### Befund

1. `manage_membership_v1` (020) setzt beim Entzug nur `revoked_at`; eine laufende Zeit oder Pause bleibt offen, wächst im
   Export weiter, blockiert Projektdeaktivierung und Tag-Umbuchung und ist im Produkt nicht mehr beendbar (Person fällt
   aus „Gerade aktiv“ und aus der Personentabelle, `028:151`; einziger Link auf die Personenansicht in
   `PeopleShared.tsx`). Die Bestätigung sagt nur „kann sich danach nicht mehr anmelden“.
2. Nachtragen für Ausgeschiedene antwortet `authority_rejected` (`033:55-58`, `:1655-1659`); die Standortleitung verliert
   mit der Heimat-Kaskade (`022:158-170`) sofort jede Sicht.
3. Entzug oder Rollenwechsel einer inzwischen entzogenen Person liefert 403 vor der Versionsprüfung; das Web meldet
   daraufhin die Verwaltung ab (`020:649-665`).

### Auftrag

**A. Entzug beendet vorher.** Läuft bei der Person eine Zeit oder Pause, beendet der Entzug sie zum Entzugszeitpunkt
über den bestehenden Verwaltungsstopp (gleiche Kette, Herkunft „Verwaltung“, im Kalender und Export erkennbar), danach
erst wird entzogen. Der Entzug selbst lehnt ab, solange noch eine Zeit läuft (eigener Status, nie 503); so gibt es nie
einen Entzug mit offener Zeit, auch bei Wettläufen. Wiederholung derselben Befehlskennung liefert das gespeicherte
Ergebnis. Die Bestätigung im Web sagt vorher „Läuft gerade eine Zeit, wird sie jetzt beendet“ mit Ziel und Beginn.
Gilt für Administrator und Standortleitung im eigenen Bereich.

**B. Ausgeschiedene sichtbar (D-115).** In „Beschäftigte“ (Web und App) ein Abschnitt „Ausgeschieden“ mit Personen, deren
Austritt im laufenden oder im Vormonat liegt, verlinkt auf die Personenansicht. Administrator sieht alle, die
Standortleitung die Personen, deren letzter Heimatstandort vor dem Austritt ihr Standort war. Ändern, Nachtragen und
Prüfen sind für Zeiten bis zum Austrittszeitpunkt möglich (Nachtragen: Ende ≤ Austritt; Ziele nach den bestehenden
Regeln für deaktivierte Ziele, D-092); danach antwortet der Server verständlich. Nach Ende des Folgemonats verschwinden
sie aus der Liste; Daten und Export bleiben.

**C. Klare Antwort statt Abmeldung.** Entzug oder Rollenwechsel einer bereits entzogenen Person liefert einen
Konflikt-Status („Diese Person ist bereits ausgeschieden“), die Sitzung bleibt bestehen.

Höchstens eine Migration (042), nur anfügend. T-062-Probe beachten (schützt sie eine ersetzte Funktion, Erwartung
testseitig erweitern und im Bericht nennen).

### Tests

Rot vor Grün am alten Code. PostgreSQL mit echten Rollen: (1) Entzug bei laufender Zeit → Zeit endet zum
Entzugszeitpunkt als Verwaltungsstopp, dann entzogen; bei laufender Pause ebenso; (2) paralleler Start und Entzug → nie
entzogen mit offener Zeit; (3) Wiederholung; (4) Standortleitung sieht Ausgeschiedene ihres Standorts, nicht fremde;
nach Ende des Folgemonats nicht mehr; (5) Nachtragen bis Austritt ok, danach abgelehnt, für Administrator und
Standortleitung; (6) Entzug einer bereits entzogenen Person → Konflikt, Web bleibt angemeldet; (7) Offline-Stopp-Tap der
Person nach dem Entzug → Prüffall wie heute, ohne zweiten Stopp. Alle Suiten, die Migrationen einspielen oder die
Pfade berühren (`backend-schema`, `backend-time-review` mit T-062-Probe, `backend-administration`, `backend-lifecycle`,
`backend-offline-sync`, `backend-time-export`, `backend-api`, `admin-web` mit Browser, `mobile` mit `expo export`).

### Nicht Teil

Kein Deploy, kein Serverzugriff. Keine Wiederaufnahme ausgeschiedener Personen (F-153, offene PO-Frage). Kein
automatischer Entzug, keine Änderung am Export-Inhalt (B01).

### Bericht

`.t092-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf „keine offene Zeit nach
einem Entzug, kein Datenverlust im Austrittsmonat“. Kein Commit vor `APPROVED`.
