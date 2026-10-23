# Aktuelle Aufgabe

> **Stand 23.10.2026:** T-099a fertig (`e577fa8`, Messwerkzeug `tests/pilot-size/`, Bericht lokal
> `.t099a-review/report.md`). Jetzt **T-099b** (D-152). Parallel liefert der PO Deploy 8 aus; der Deploy läuft aus
> seinem Terminal und berührt den Arbeitsbaum nicht.

## T-099b · Pilotgröße: Lesewege und Lohnexport bei frogs-Größe reparieren

**Für:** Development (Astra, Extra High) · **Risiko:** hoch: SQL-Funktionen mit Berechtigung (SECURITY DEFINER, RLS,
Standortbereich, Austritt) und eine neue Migration, deshalb unabhängiges Review durch einen zweiten Agenten (AGENTS 4) ·
**Zeitbox:** drei Sitzungen. Reißt sie, wird von hinten geschnitten (erst 7, dann 6), nie die Punkte 1 bis 5.

**Befund (T-099a):**
- Kalender `read_time_record_calendar_v1`: 15,8 s für 22 Datensätze, 9,2 Mio. Buffer-Treffer. Eigene Zeiten (alle
  Rollen) und Personenzeiten in der App liefern 503, schon im Profil „erwartet“.
- Lohnexport v3 und v4: alle 320 Aufrufe 503. Monate mit 10.400 bis 29.010 Datensätzen liegen über
  `TIME_ENTRY_EXPORT_MAXIMUM_ROWS` (10.000); schon 7.420 brauchen über 8 s (Exportfunktion: 10.001 Zeilen in 11,6 s).
- Kundenmonat `read_customer_hours_v2` und Kontingentwarnungen 3,9 bis 4,3 s, in der Spitze 503; v2 baut zuerst die
  volle v1-Projektion.
- Zeitdatensuche der Standortleitung in der Spitze 503 nach 10 s; die Seitensuche prüft
  `has_time_management_authority_v1` je Kandidat.
- F018: Die Standort-Einrichtung fordert 100 Mitgliedschaften bzw. Ziele an, die Antwort überschreitet 16 KiB → 503.
- F043: Pool 5 s, Coordinator 8 s, HTTP 10 s; der Client-Abbruch beendet die SQL-Abfrage nicht, ROLLBACK wartet.

**Hypothese des TL, zuerst prüfen, nicht voraussetzen:** `effective_time_records_v2` (038) ist `security_barrier` und
bildet `latest_revision` als CTE mit `DISTINCT ON` über alle Revisionen aller Betriebe; zweimal referenziert, wird sie
materialisiert. Jede Abfrage darüber rechnet so den Gesamtbestand, in Schleifen je Datensatz vielfach. Dasselbe Muster
in `effective_time_records_v1` und den Export- und Stundenfunktionen prüfen.

### Umfang

1. **Ursache belegen:** innere Pläne der SECURITY-DEFINER-Funktionen mit `auto_explain` (`log_nested_statements`,
   `log_analyze`, `log_buffers`) im lokalen Lauf des Werkzeugs; je P1-Befund Ursache und Plan im Bericht.
2. **Aufwand folgt der angefragten Menge, nicht dem Bestand:** effektive Zeiten schlüsselgetrieben lesen (etwa jüngste
   Revision je Datensatz über einen passenden Index) für Kalender, Personenzeiten, Export, Kundenstunden,
   Kontingentwarnungen und Zeitdatensuche. Neue Migration, alte bleiben unverändert. Fachlich identisch: Revisionen,
   Voids, „recovered“, Pausen, Monatsgrenzen in Europe/Berlin, Berechtigung je Rolle, Standortbereich, Ausgeschiedene,
   Mandantentrennung.
3. **Lohnexport ganzer Monat (D-152):** Grenze aus der Pilotgröße ableiten, mindestens 58.020 Datensätze; die Antwort
   puffert nicht den ganzen Monat. Eine gemeinsame Frist für SQL, Verbindung und HTTP; ein Abbruch beendet die Abfrage
   auf dem Server und verwirft die Verbindung (F043). Über der Grenze eine schnelle, verständliche Ablehnung mit Text in
   der Verwaltung statt 503.
4. **F018:** Standort-Einrichtung auf bytebegrenzte Seiten mit Cursor wie D-138; die Verwaltung lädt seitenweise.
5. **Zeitdatensuche der Standortleitung:** Berechtigung mengenbasiert statt je Kandidat.
6. P2 „Zeiten prüfen“: Kontext der Prüffälle gebündelt laden statt 20 Einzelabfragen.
7. P2-Richtwerte (Kundenmonat, Personenübersicht, Einrichtung), soweit sie aus Punkt 2 folgen.

### Tests und Nachweis

- Je geänderter Funktion ein Gleichheitstest alt gegen neu auf Fixture-Daten mit Revisionen, Voids, „recovered“,
  Pausen, Monatsgrenze, Ausgeschiedenen und Standortbereichen; die bestehenden Berechtigungstests bleiben grün.
- Ein CI-tauglicher Rückfallschutz, der die Art des Aufwands prüft (etwa: Buffer-Treffer wachsen nicht mit fremden
  oder älteren Daten), ohne flackernde Zeitgrenzen.
- **Wiederholungsmessung** mit dem Werkzeug, beide Profile: alle Lesewege mit erwartetem Status, alle Exporte
  erfolgreich; Lohnexport der Spitze p95 höchstens 3 s auf dem Mac (Reserve für den langsameren Server, Budget 8 s);
  übrige Richtwerte wie T-099a, Überschreitungen als Befund. Bericht `.t099b-review/report.md` mit Vorher-Nachher-Tabelle.
  Das Werkzeug darf an neue Verträge und die neue Migrations-Baseline angepasst werden, Mess- und Prüflogik bleiben.

### Grenzen

Kein Server- oder Supabase-Zugriff, kein Deploy, keine GHCR-Paketaktion, nichts installieren (AGENTS 3), keine Änderung
alter Migrationen. Fristen und Antwortgrenzen nicht als Lösung hochsetzen; die Exportgrenze folgt Punkt 3. Die ganze CI
lokal nachbauen. Kein Commit vor `APPROVED`.
