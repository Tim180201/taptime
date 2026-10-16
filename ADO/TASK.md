# Aktuelle Aufgabe

> **Stand 16.10.2026:** Deploy 6 abgeschlossen (`d193725` → `fb28166`). Abgeschlossen und auf main: T-024 Teil A
> (`7e36c58`), T-122c (`e614779`), T-122d (`df76957`), T-129 (`579f372`), T-131 (`3350aed`, `70745ad`, `d8456e8`) und
> T-126 (`1918d5a`). **Plan B (GPT-Kontingent knapp):** Als Nächstes Deploy 7 mit T-024 Teil B an der Konsole (PO, TL
> begleitet; Runbook in `infrastructure/DEPLOY.md`). Danach T-127a und T-127b (Archiv) mit Deploy 8; je ein Auftrag, je
> ein Review, je ein Commit.

## T-127a · Archiv auf dem Server (D-143), mit Deploy 8

**Für:** Development · **Risiko:** mittel (Datenbank, Berechtigung) · **Zeitbox:** eine Sitzung. Unabhängiges Review.
Beginnt nach Deploy 7.

### Warum

PO 15.10.: Gelöschte Kunden und Projekte und ehemalige Mitarbeiter sollen im laufenden Betrieb nicht mehr erscheinen,
nur noch dort, wo Zahlen eines Monats stehen, und sonst in einem Archiv für Administrator und Standortleitung (nur ihr
Bereich). Heute ist das uneinheitlich (Erhebung 15.10.): „Gerade aktiv“ zeigt Ausgeschiedene mit „Keine Zeit“
(`read_managed_active_summary_v5` nimmt entzogene Zugänge bei `requested_is_running = true` mit, 056:341); unter
Mitarbeiter → Zeiten fehlen in älteren Monaten Personen, deren Austritt länger zurückliegt (Frist D-115 statt „hat Zeit
im Monat“), die Summen sind dort also unvollständig; entzogene Zugänge sieht unter Zugänge nur der Administrator ohne
Standortwahl (`read_managed_memberships_v4` verbindet nur aktuelle Heimatstandorte, 059:213–238); ein Archiv fehlt.

### Umfang

1. **Migration 061:**
   - `read_archive_people_v1` (Suche, Blättern nach Name und Kennung, höchstens 51 je Seite, Seiten höchstens 14 KiB
     wie T-117a; optional genau eine Kennung für die Personenansicht): entzogene Zugänge im Bereich. Administrator
     alle; Standortleitung, wenn der letzte Heimatstandort (`membership_management_home_v1`) in ihren Grants liegt,
     **ohne Frist**. Spalten: Kennung, Name (ohne Ersatzwort), Rolle, letzter Standort, `revoked_at`, Beginn der
     letzten Zeit (oder leer).
   - `read_archive_targets_v1` (gleiche Suche und Seiten): stillgelegte Kunden und Projekte im Bereich. Administrator
     alle; Standortleitung über die letzte Standortbindung, wie inaktive Kunden in `read_customer_hours_v3`
     (056:48–54). Spalten: Art, Kennung, Name, Standort, `deactivated_at`, Beginn der letzten Zeit.
   - `read_managed_active_summary_v6`: wie v5, aber Ehemalige erscheinen genau dann, wenn sie im angefragten Monat Zeit
     haben (statt Frist D-115), für Administrator und Standortleitung des letzten Heimatstandorts; bei
     `requested_is_running = true` nie; Zählungen weiter nur Aktive.
   - `read_managed_person_time_v2`: wie v1, aber die Standortleitung liest Ehemalige ihres letzten Heimatstandorts
     ohne Frist. Dazu ein Merkmal, ob der Aufrufer Zeiten dieser Person ändern darf (dieselbe Prüfung wie
     `has_time_management_authority_v1`; Ändern, Nachtragen und Prüfen bleiben nach D-115).
   - `read_archive_status_v1`: für bis zu 200 Kennungen von Personen und Zielen, die der Aufrufer lesen darf, ob der
     Zugang entzogen bzw. das Ziel stillgelegt ist; nicht lesbare Kennungen werden ausgelassen. Damit markiert das Web
     Ehemalige in Lohnexport, Zeiten prüfen und Kundendetail, ohne neue Fassungen dieser großen Lesewege.
2. **API und Verträge** für alle fünf; die alten Fassungen bleiben (die App nutzt v5 und v1).
3. **Tests (PostgreSQL 17):** Bereich (Administrator, Standortleitung eigener und fremder Standort, Mitarbeiter
   verboten); Austritt vor drei Monaten sichtbar; Suche und Blättern; Seitengröße; v6: Ehemalige mit und ohne Zeit im
   Monat, nie bei „läuft“, Zählungen; v2: Lesen außerhalb der Frist ja, Ändern nein; Status lässt fremde Kennungen aus;
   Katalogtest. Rotnachweis für „Gerade aktiv“ und für den älteren Monat unter Mitarbeiter → Zeiten.

### Grenzen

Keine Änderung an Schreibwegen, an D-115 fürs Ändern, an App und CSV. Kein Wiederaufnehmen (T-125). ADO nicht ändern.
Bericht in `.t127a-review/`; kein Commit vor `APPROVED`.

---

## Danach: T-127b · Archiv im Browser (D-143), mit Deploy 8

**Für:** Development · **Risiko:** niedrig bis mittel (nur Web) · **Zeitbox:** eine Sitzung. Beginnt nach T-127a.

### Umfang

1. **Seite „Archiv“** in der Seitenleiste unter „Verwaltung“ für Administrator und Standortleitung (`/archiv`, Reiter
   „Ehemalige Mitarbeiter“ und „Gelöschte Kunden und Projekte“, `?bereich=`). Tabellen: Person · Standort ·
   Ausgeschieden · Letzte Zeit · „Zeiten ansehen ›“ bzw. Name · Art · Standort · Gelöscht · Letzte Zeit · „Zeiten
   ansehen ›“. Suchfeld, „Weitere laden“, leerer Zustand („Noch niemand im Archiv.“ bzw. „Noch nichts gelöscht.“).
   Nur Anzeige, keine Aktion; keine Hauptaktion auf der Seite. README § 5.6.
2. **„Zeiten ansehen“:** Person → Personenansicht im Monat der letzten Zeit; Kunde → Kundendetail im Monat der letzten
   Zeit; Projekte haben keine Stundenansicht, dort steht kein Link. Die Personenansicht findet Ehemalige unabhängig vom
   gewählten Monat (Einzelabfrage aus T-127a), trägt im Kopf die Pille „ehemalig“ und „Ausgeschieden am …“ und zeigt
   Bearbeiten nur, wenn der Server Ändern erlaubt; sonst den Satz „Diese Zeiten können nur noch angesehen werden.“
3. **Laufender Betrieb nur Aktive:**
   - Übersicht „Gerade aktiv“ über v6: keine Ehemaligen.
   - Mitarbeiter → Zeiten über v6: Ehemalige mit Zeit im Monat unten unter „Ehemalige · Zeiten in diesem Monat“
     (ersetzt „Ausgeschiedene Mitarbeiter“).
   - Mitarbeiter → Zugänge: nur aktive; der Filter Alle · Aktiv · Entzogen entfällt; unter der Tabelle der Textknopf
     „Ehemalige im Archiv“.
   - Kunden: gelöschte Kunden mit Stunden im Monat nicht mehr zwischen den aktiven, sondern unten unter „Gelöschte
     Kunden · Zeiten in diesem Monat“, ohne Aktionen.
   - Einrichtung → Projekte: stillgelegte Projekte nicht mehr in der Liste. Der Knopf „Deaktivieren“ heißt wie bei
     Kunden „Projekt löschen“.
4. **Markierung an den Stellen mit Monatszahlen:** Pille „ehemalig“ bzw. „gelöscht“ (neutral) neben dem Namen in
   Lohnexport-Liste, Zeiten prüfen und Kundendetail (Personen), über `read_archive_status_v1` für die geladenen Kennungen.
5. **Rückfragen sagen, was passiert:** Entzug: „Danach steht <Name> im Archiv. Die Zeiten bleiben im Lohnexport und bei
   den Kundenzeiten. Das lässt sich nicht rückgängig machen.“ Kunde und Projekt löschen entsprechend. Hilfe („So
   funktioniert Taptura“): ein Satz zum Archiv.
6. **Tests und Fotos:** Browser-Szenarien Archiv (beide Reiter, Administrator und Standortleitung, leer, Suche),
   Übersicht ohne Ehemalige, Zugänge ohne Filter, Kunden-Abschnitt, Markierungen, Personenansicht nur lesend; Fotos
   1440 und 390 px in beiden Themen.

### Grenzen

App unverändert (ihre Rückfragetexte beim nächsten App-Build, in STATUS notiert). CSV unverändert. ADO nicht ändern.
Bericht in `.t127b-review/`; kein Commit vor `APPROVED`.
