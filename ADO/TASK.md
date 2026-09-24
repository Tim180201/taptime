# Aktuelle Aufgabe

> **Stand 24.09.2026:** Produktion auf `b635c4a`. Auf `main`: T-077, T-076, T-062 und T-078 (APPROVED, noch nicht
> ausgeliefert). Reihenfolge nach D-093: **T-079 → ein Deploy mit Migration 033 und 034 → ein App-Build (iPhone und
> Android) → T-024 → Pilot Monat 1**. Frühere Briefs stehen in der Git-Historie.

## T-079 · Kundensicht: Was der Kunde sieht, stimmt und ist verständlich (D-093)

**Für:** Development · **Risiko:** Vertrauen im Pilot; Lesevertrag „Meine Zeiten“ mit App-Ständen im Feld;
Zeitpunkte bei Korrekturen · **Zeitbox:** drei Sitzungen, Reihenfolge A → B → C → D → E. Reißt sie, wird hinten
geschnitten, nie A oder B.

### Ziel

Die Code-Punkte des externen Reviews vom 24.09. (1, 2, 3, 5–9, 12). Keine neue Funktion. Der Kunde sieht, was
wirklich passiert ist, in seiner Sprache, und dieselben Stunden wie sein Lohnbüro.

### Auftrag

**A. Erfolg ist Erfolg (P1).** `isErrorMessage` (`admin-web/src/viewHelpers.tsx`) hält eine Liste von Erfolgstexten;
alles andere wird rot als „Die Aktion wurde nicht abgeschlossen“ gezeigt. Es fehlen „Gespeichert.“ (Nachtragen,
Ändern) und die elf Meldungen der Standort-Einrichtung. Künftig trägt jede Meldung ihre Art selbst
(Erfolg/Hinweis/Fehler), gesetzt dort, wo das Ergebnis entsteht; die Liste entfällt, der Typ erzwingt die Art. Im
Bericht: jede Stelle, die `notice` setzt, mit Art. Die App auf dasselbe Muster prüfen: beheben oder „nicht betroffen“.

**B. Kalender mit Pausenabzug.** App und Web zeigen „Zeitspannen ohne Pausenabzug“; der Export zieht erfasste
Pausen ab (Migration 025, `break_intervals` auf die wirksame Zeit geschnitten, `effective_work_duration_seconds_v1`).
Künftig zeigen Tag, Woche und Monat die Arbeitszeit nach Pausen und die Pausen daneben, gerechnet wie der Export.
- Migration 034: Die Lesewege des Kalenders (`read_mobile_own_time_v2` für Meine Zeiten in App und Web,
  `read_managed_person_time_v1` für die Personenansicht; T-062-Stand prüfen) liefern je Eintrag die Pausen als
  Intervalle, damit die Aufteilung über Mitternacht stimmt. Neue Fassung oder neuer Zweig; alte Fassungen bytegleich.
- **Versionsmix:** App-Stände im Feld (TestFlight 24.09., APK versionCode 9) prüfen Antworten streng. Sie bekommen
  dieselbe Antwort wie heute; Pausen nur auf ausdrückliche Anfrage (Muster `includeTimeDetails`). Test dafür.
- Laufende Einträge und Pausen bis jetzt, wie der Export. Der Hinweis „ohne Pausenabzug“ entfällt.

**C. Texte (Review 3, 6, 7, 9).** Export-Knopf nennt Monat und Umfang, z. B. „CSV September herunterladen“ mit
„Alle Einträge des Monats, unabhängig von den Filtern“; die Filter wirken nicht auf den Export. Formatwahl ohne
„v3/v4“: „Standard (mit Herkunft und Kommentar)“ und „Bisheriges Format“; Werte und CSV bytegleich. Alle sichtbaren
Texte in App und Web auf Fachsprache durchgehen, mindestens „atomar“, „Prüffingerabdruck“ (als „Technische
Kennung“ in eine Detailzeile), „Scan-Evidenz“, „Der Server hat … bestätigt“, „dieselbe Anfrage wird sicher
weiterverwendet“, „Serverantwort“, „lückenlos protokollieren“, „Pausenauslöser“, „stillschweigend“; Zeitpunkte
bei Änderungen als „23.09.2026, 12:00“ statt „12:00:00 GMT+2 [Europe/Berlin]“. Jede Ausnahme-
und Fehlermeldung sagt in höchstens zwei kurzen Sätzen: was passiert ist, ob die Daten sicher sind, was jetzt zu
tun ist. „Freigeben“ bei Prüffällen sagt, was geschieht („Als Arbeitszeit übernehmen“). Anrede bleibt (App du,
Web Sie). Im Bericht eine Tabelle alt → neu. Textprüfende Tests anpassen, nicht löschen.

**D. Eingaben (Review 5, 8).** `/willkommen` nach dem Passwort: „Im Browser anmelden“ (Link auf `/`) und „In der
App anmelden; die App erhalten Sie von Ihrem Betrieb.“ Kein Link auf TestFlight, APK oder Stores. Ändern und
Beenden in der App: Datum und Uhrzeit (HH:MM) getrennt und vorausgefüllt wie beim Nachtragen statt
`JJJJ-MM-TTTHH:MM`; im Web Eingabe auf Minuten statt `step="0.001"`. Unveränderte Felder behalten den exakten
bisherigen Zeitpunkt. Sommerzeit mit denselben Helfern und Tests wie das Nachtragen (25.10.2026, 28.03.2027).
Keine neue native Abhängigkeit.

**E. Startseite (Review 12).** In `apps/landing-web/index.html`: „Bestätigt heißt gesichert … Ein Tippen gilt erst
als bestätigt, wenn es außerhalb des Servers gesichert ist.“ → „Doppelt gesichert · Das Handy behält jede
Erfassung, bis sie außerhalb des Servers gesichert ist.“ (Satz zur wöchentlichen Prüfung bleibt). „für einen frei
wählbaren Zeitraum“ (zwei Stellen) → „für jeden Monat“. Sonst nichts an der Startseite.

### Tests

Web: jede Erfolgsmeldung rendert „Erledigt“. PostgreSQL mit Pausen, Korrektur und Mitternacht: Monatssumme im
Kalender = Summe `work_duration_seconds` im Export für dieselbe Person; alte Anfrage liefert die alte Form;
Standortgrenze aus 033 gilt für den neuen Zweig. App- und Web-Suiten, Typechecks, Browser-Layouttest (T-074),
Migrationsprobe wie bei T-007; Bildschirmfotos der geänderten Stellen (360 und 1280 px) im Bericht.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse, kein App-Build. CSV-Inhalt unverändert (Spalten, Sekunden).
Kalender über Monatsgrenzen (Review 4), Kontaktweg und Ausrichtung der Startseite (Review 10, 11) nicht.

### Bericht

`.t079-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf Versionsmix und
Standortgrenze in 034. Kein Commit vor `APPROVED`.
