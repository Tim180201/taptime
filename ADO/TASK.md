# Aktuelle Aufgabe

> **Stand 28.09.2026:** Produktion auf `e13916b` (Migrationen bis 034). Auf `main` zusätzlich T-080 (App), T-086/T-087
> (035), T-084 (036), T-085 (`9c2df50`, 037). Reihenfolge (PO 28.09., D-097, D-098): **T-088** → Sicherungs-Fix (falls
> nötig) → ein Deploy, ein App-Build → T-024 → Pilot Monat 1. Frühere Briefs stehen in der Git-Historie.

## T-088 · Zeiteintrag löschen heißt stornieren (D-098)

**Für:** Development · **Risiko:** Lohnrelevante Summen (Export, Kalender, Kunden, Kontingent) und die Grenze „wer darf
wessen Zeit entfernen“; append-only darf nicht brechen · **Zeitbox:** eine Sitzung. Eine Migration `038`, Backend,
Route, `apps/admin-web`, `apps/mobile`, deren Tests.

### Was der Nutzer sieht

Am **beendeten** Zeiteintrag (Kalender-Tagesliste in App und Web, auch in der Personenansicht) neben „Ändern“ der Knopf
„Zeiteintrag löschen“. Rückfrage mit Pflichtgrund: „Doppelt erfasst“, „Fehlscan“ oder „Sonstiges“ mit kurzem Text
(1–500 Zeichen); „Löschen“ / „Abbrechen“. Danach ist der Eintrag aus allen Summen verschwunden und steht in der
Tagesliste grau als „Gelöscht am … von … · Grund“, ohne Dauer. Laufende Einträge zeigen den Knopf nicht. Nur online.

Wer darf (D-098): Administrator alle Einträge des Betriebs; Standortleitung die eigenen und die von Personen, deren
heutiger Heimatstandort in ihrer Verwaltungszuweisung liegt (dieselbe Grenze wie „Ändern“, `has_time_management_
authority_v1` aus 033); Mitarbeiter nur die eigenen.

### Auftrag

**A. Speicherung (038), append-only.** Eine eigene Tabelle für Stornierungen: Betrieb, Zeiteintrag, Grundcode
(`duplicate`, `misscan`, `other`), Text (Pflicht bei `other`), wer (Mitgliedschaft, echte Rolle), wann, Befehls-ID
eindeutig je Betrieb, höchstens eine Stornierung je Eintrag. Nie ändern, nie löschen (Trigger wie bei den Revisionen).
Keine Rücknahme in dieser Aufgabe.

**B. Nirgends mehr zählen, per Konstruktion.** `effective_time_records_v2` schließt stornierte Einträge aus, damit
jeder bestehende Leser (Kalender, Meine Zeiten, Personenzeiten, Export v3/v4, Kunden-Stunden und Kontingent, Überlappungs-
prüfung beim Nachtragen) sie automatisch nicht mehr sieht. Im Bericht eine Liste aller Leser der Sicht mit Nachweis.
Für die Anzeige „Gelöscht …“ ein eigener, eng begrenzter Leser für stornierte Einträge im geladenen Zeitraum mit
derselben Sichtbarkeitsgrenze wie der jeweilige Kalender (eigene / verwaltete / alle).

**C. Schreiben.** SECURITY-DEFINER-Funktion mit Grenze in SQL: Eintrag existiert im Betrieb und ist beendet, Rolle aus
der echten Mitgliedschaft, Grenze wie in „Wer darf“, Betrieb aktiv. Idempotent über die Befehls-ID; gleiche ID mit
anderem Eintrag oder Grund ist ein Konflikt; zweite Stornierung desselben Eintrags mit neuer ID ergibt
`already_voided`. Hat der Eintrag einen **offenen Prüffall**, lehnt die Funktion mit `review_open` ab (erst entscheiden,
dann löschen). Eine Schreibroute mit Schutzklasse (T-053). Audit-Ereignis wie bei Korrekturen.

**D. App und Web.** Knopf, Rückfrage und graue Zeile wie oben; Fehlerfälle `forbidden`, `review_open`, `running`,
`already_voided`, offline mit verständlichem Text (Art aus T-079); nach Erfolg Tages- und Monatssummen neu laden.

### Tests

Mit PostgreSQL, Rot vor Grün: (1) Summen vorher/nachher für Kalender, Export v3/v4, Kunden-Stunden, Kontingentstufe —
der stornierte Eintrag fehlt überall, alle anderen unverändert (gleiche Formel, D-095); (2) Grenzen: Mitarbeiter eigene
ja / fremde nein; Standortleitung A eigene und Personen mit Heimat A ja, Heimat B nein, nach Entzug nein; Administrator
alle; Betrieb X nicht Y; auch direkt gegen RLS; (3) laufender Eintrag, offener Prüffall, zweite Stornierung, Befehls-ID
wiederholt / Konflikt; (4) nachgetragener und korrigierter Eintrag lassen sich stornieren, die Revisionen bleiben
unverändert erhalten; (5) nach Stornierung darf in dieselbe Zeitspanne nachgetragen werden; (6) T-062-Migrationsprobe:
ohne Stornierungen sind Daten, geschützte Definitionen und Administrator-Antworten nach 038 identisch. App und Web:
Knopf nur bei beendeten Einträgen, Rückfrage mit Pflichtgrund, graue Zeile, Fehlertexte. Lokal alle Suiten, die
Migrationen anwenden oder nachspielen, App, Web, Typechecks inklusive Tests.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse, kein App-Build. Keine Rücknahme, kein physisches Löschen, kein
Offline-Löschen, keine Änderung an der Stundenformel.

### Bericht

`.t088-review/` (report.md, tracked.diff, untracked.txt, Screenshots Web 360/390/1440 und App). Unabhängiges Review
mit Blick auf Lohnsummen, Grenze und append-only. Kein Commit vor `APPROVED`.
