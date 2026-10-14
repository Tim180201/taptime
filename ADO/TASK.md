# Aktuelle Aufgabe

> **Stand 14.10.2026:** T-117a abgeschlossen (`1372b81`, Migration 056, D-138), noch nicht ausgeliefert. Jetzt
> **T-117b**. Danach T-118 und T-120, dann Deploy 5 mit neuen App-Builds.

## T-117b · Suche in App und Web

**Für:** Development · **Risiko:** mittel (viele Oberflächen, kein Server) · **Zeitbox:** zwei Sitzungen; reißt sie, wird
nach App und Web getrennt gemeldet. Nur Clients (App, Web) und ihre Tests. Kein Server, keine Migration, kein Deploy.

### Ausgangslage (`1372b81`)

Die neuen Wege aus T-117a (D-138) sind auf dem Server, aber noch ungenutzt. App und Web laden Ziellisten vollständig
vor und filtern nur Geladenes; „Kunden“ lädt den ganzen Monat in einem Block und scheitert bei frogs-Größe an der
16-KiB-Grenze der App; Einrichtung und Kartenliste zeigen Kunden und Karten nach UUID.

### Gemeinsame Regeln

1. **Suchfeld** oben in jeder genannten Liste, Beschriftung „Suchen“, Platzhalter z. B. „Name eingeben“. Anfrage etwa
   300 ms nach dem letzten Tastendruck; ältere Antworten werden verworfen, wenn eine neuere Suche läuft. Leeres Feld =
   ohne Suche. Ergebnis wird angesagt („12 Treffer“, bei weiteren Seiten „mehr als 12“). Ohne Treffer:
   „Keine Treffer für „X““ und „Suche löschen“.
2. **Seiten:** „Weitere laden“ am Listenende, solange `nextCursor` gesetzt ist. Kein vollständiges Vorladen mehr.
3. **Auswahl** (Ziel, Kunde, Karte) bleibt erhalten, solange sie in den geladenen Ergebnissen steht; die Prüfung „Ziel
   ist in der geladenen Liste“ gilt gegen die aktuellen Ergebnisse. Der Server bleibt die Instanz.
4. **Alte Wege** werden in App und Web nicht mehr aufgerufen (Ausnahme: „Manuell“ ohne Netz, siehe unten).
5. **Barrierefreiheit:** Suchfeld beschriftet, Ergebnisse als Liste, „Weitere laden“ erreichbar; große Schrift ohne
   abgeschnittene Texte.

### App

1. **Kunden** (`CustomersScreen`): `/v2/customers/hours/query` mit Suche und Seiten. Detail über
   `/v2/customers/hours/detail` mit „Weitere Personen laden“; auch für Umbenennen, Löschen, Kontingent und den
   Kontingent-Link.
2. **Mitarbeiter** (`EmployeesScreen`): Accept `managed-people.v6` mit Suche. Die Antwort ist nach Namen sortiert; die
   Gruppen nach Standort (ausgetreten zuletzt) bildet die App aus den geladenen Seiten, Standorte nach Namen. Filter
   „Zeit läuft“ / „Keine laufende Zeit“ und Monatswahl bleiben; die Zähler kommen weiter vom Server.
3. **Karten** (`AdminSetupScreen`): Liste über `/v3/administration/setup-projection` mit `kind:'nfc_tags'` und Suche,
   Kundenname aus `customerDisplayName`. Die Kundenauswahl in „Karte einrichten“ sucht über `kind:'customers'`; „Pause“
   bleibt als feste Wahl. Nach „Karte prüfen“ funktioniert „Karte entfernen“ ohne Blättern (Kennungen aus Inspect v2;
   Name aus den geladenen Ergebnissen, sonst „diese Karte“). Dazu der Rest-P2 aus T-116b: Nach `authority_rejected`
   werden Kartenbeleg und Rückfall-Projektion verworfen.
4. **Manuell, online** (`ManualCaptureScreen`): `/v2/mobile/work-targets/query` mit Suche und Seiten, Gruppen Kunden /
   Projekte / Allgemeine Arbeitszeit. Die feste Startleiste aus T-116b bleibt. **Ohne Netz**
   (`OfflineManualCaptureScreen`) bleibt alles lokal wie heute.
5. **Zeit hinzufügen** (eigene Zeit und für andere): Zielauswahl mit Suche und Gruppen über
   `/v2/mobile/work-targets/query` bzw. `/v2/administration/time-records/backfill-targets/query`.

### Web

6. **Kunden** (`CustomersView`): wie App 1, Detail mit „Weitere Personen laden“.
7. **Mitarbeiter** (`EmployeesView`, Übersicht `PeopleTable`): wie App 2; die Übersicht bleibt bei „Zeit läuft“ ohne
   Suchfeld. **Zugänge verwalten:** `/v3/administration/employee-memberships-projection` mit Suche.
8. **Einrichtung** (`SetupView`): Karten (`kind:'nfc_tags'`) und Kunden (`kind:'customers'`) je mit eigener Suche und
   eigenen Seiten statt der gemischten UUID-Liste; „Zuordnung ändern“ mit durchsuchbarer Karten- und Kundenauswahl;
   Projekte über `/v2/administration/projects/query` mit Suche.
9. **Manuell** (`ManualView`) und **Zeit hinzufügen** (`TimeEditingControls`): wie App 4 und 5.

### Tests

Je Punkt rot vor der Änderung:
- Je Liste: Suche schickt den normalisierten Begriff nach der Wartezeit, eine ältere Antwort überschreibt keine neuere,
  „Weitere laden“ hängt die nächste Seite an, keine Treffer, Fehler mit „Erneut versuchen“.
- Kein vollständiges Vorladen mehr (höchstens eine Anfrage je Liste beim Öffnen).
- Kundendetail mit mehreren Personenseiten; Kontingent-Link öffnet den Kunden ohne Liste.
- Mitarbeitergruppen aus mehreren Seiten richtig zusammengeführt.
- Karten: Entfernen nach „Karte prüfen“ ohne Liste; `tagReceipt` nach `authority_rejected` nicht mehr sichtbar.
- „Manuell“ offline unverändert lokal.
- Browser: Suchfelder und Listen in Web-Layouts bei 390 und 1440 px, 200 % Schrift.
- Alle Suiten, Typecheck, Builds und Browserläufe grün.

### Grenzen

Kein Server, keine Migration, keine Änderung an Verträgen außer Client-Parsern für die T-117a-Antworten. „Meine Kunden“
oben ist T-118. Kein Deploy. ADO nicht ändern.

### Bericht

`.t117b-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei
P1/P2. Kein Commit vor `APPROVED` durch den TL.
