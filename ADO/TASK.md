# Aktuelle Aufgabe

> **Stand 28.10.2026:** T-137 auf main (`9f584ff`, mit Deploy 10). Jetzt **T-123a**, die Grundlage des Lohnexports
> nach D-156. Das erste Programmformat (T-123b, vermutlich DATEV) folgt mit der Antwort von frogs und einer
> Beispiel-Importdatei.

## T-123a · Lohnexport: Personalnummer und Monatsübersicht

**Für:** Development (Astra, Extra High) · **Risiko:** hoch, weil die Zahlen direkt in die Lohnabrechnung gehen. Jede
Stunde muss mit den Einzelzeiten übereinstimmen. Unabhängiges Review (AGENTS 4) · **Zeitbox:** zwei Sitzungen. Reißt
sie, wird Punkt 3 geschnitten, nie 1 und 2.

**Hintergrund:**
- Der heutige Export „Einzelzeiten (CSV)“ (v4, eine Zeile je Zeit) ist vollständig, aber ein Rohdatenexport: englische
  Spalten, Sekunden, interne Kennungen. Lohnbüros brauchen je Person die Summe des Monats unter ihrer Personalnummer.
- Alle verbreiteten Lohnprogramme importieren im Kern dasselbe: Personalnummer, Monat, Lohnartnummer und Wert.
  Programmformate kommen nach D-156 erst mit dem ersten Kunden.

### Umfang

1. **Personalnummer an der Person:**
   - Neues Feld an der Mitgliedschaft, Zeichen `0-9A-Za-z-` und 1 bis 20 Zeichen lang, im Betrieb eindeutig über alle
     Mitgliedschaften einschließlich ehemaliger.
   - Nur der Administrator setzt, ändert und entfernt sie: im Web bei der Person und unter „Zugänge“.
   - Jede Änderung wird protokolliert, mit alter und neuer Nummer, wie „Name ändern“ (D-142). Eine Nummer, die schon
     vergeben ist, wird mit einer verständlichen Meldung abgelehnt.
   - Entstehen, Ändern und Entfernen nach AGENTS 1.5.
   - Ehemalige behalten ihre Nummer (D-143).
2. **Lohnart für Arbeitsstunden:**
   - Eine Angabe je Betrieb (Ziffern, 1 bis 6 Stellen, darf leer bleiben). Nur der Administrator pflegt sie, am
     Lohnexport. Änderungen werden protokolliert.
   - Berater- und Mandantennummer für DATEV gehören nicht hierher, sondern kommen mit T-123b.
3. **Monatsübersicht (CSV), neue additive Exportfassung:**
   - **Zeilen:** Eine Zeile je Person mit Zeit im Monat, Ehemalige eingeschlossen.
   - **Spalten:** `Personalnummer;Name;Monat;Stunden;Lohnart;Hinweis`.
   - **Monat:** `MM.JJJJ`.
   - **Stunden:** Sekunden der abgeschlossenen Zeiten je Person summieren, danach einmal auf zwei Nachkommastellen
     kaufmännisch runden; Dezimalkomma, kein Tausendertrennzeichen.
   - **Zuordnung:** nach dem Berliner Tag des Beginns, wie bei den Einzelzeiten und D-152.
   - **Hinweis-Spalte:** „Zeit läuft noch“ bei einer laufenden Zeit dieser Person im Monat (sie zählt nicht mit),
     „Personalnummer fehlt“ bei einer Person ohne Nummer.
   - **Technik:** UTF-8 mit BOM, Semikolon, CRLF, Formelschutz wie bei den Einzelzeiten.
   - Berechtigung, Frist und Grenzen wie bei den Einzelzeiten. Ein ganzer Monat in einem Abruf.
   - **Web:** Die Auswahl am Lohnexport bekommt „Monatsübersicht“ als neue erste Option. Darüber steht ein Hinweis mit
     der Zahl der Personen ohne Personalnummer und einem Link zur Pflege. „Einzelzeiten“ bleibt unverändert.

### Tests und Nachweis

- **Zuerst rot:** Monatsübersicht und Personalnummer fehlen.
- **Summen-Gleichheit (Hauptnachweis):** Für jede Person und jeden Monat stimmen die Stunden mit der Summe der
  abgeschlossenen Einzelzeiten v4 aus derselben Transaktion überein, bis auf die eine dokumentierte Rundung.
  - Gegen PostgreSQL 17 und auf beiden Profilen des Pilotwerkzeugs, für alle Monate.
  - Abgedeckt: Pausen, Nachträge, Korrekturen, Storno, Verwaltungsstopp, Ehemalige, Sommer- und Winterzeit, Monatsgrenze
    und laufende Zeit.
- **Personalnummer:** Eindeutigkeit (auch gegen Ehemalige), Rechte (Standortleitung und Mitarbeiter abgewiesen),
  Protokoll und Mandantentrennung.
- **Weiteres:** B3-Inventar; Browser-Layout und Barrierefreiheit der neuen Felder in beiden Themen und bei 390 px.
- **Messung:** Monatsübersicht der Spitze mit `tests/pilot-size/`, p95 unter 1 s.
- **Bericht:** `.t123a-review/bericht.md` mit einer Beispieldatei aus synthetischen Daten. Die ganze CI lokal nachbauen.

### Grenzen

- Keine Spaltenwähler, keine Vorlagen, kein Programmformat (D-156).
- Kein Server- oder Supabase-Zugriff, kein Deploy, keine EAS-Builds, keine GHCR-Paketaktion, nichts installieren
  (AGENTS 3).
- Kein Commit vor `APPROVED`.
