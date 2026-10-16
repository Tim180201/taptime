# Aktuelle Aufgabe

> **Stand 16.10.2026:** Deploy 6 abgeschlossen (`d193725` → `fb28166`). Abgeschlossen: T-024 Teil A (`7e36c58`),
> T-122c (`e614779`), T-122d (`df76957`), T-129 (Startseite „Stempelpunkte“, nach APPROVED 16.10. committet). T-130 hat
> geklärt, warum Abbilder der laufenden Produktion in GHCR fehlten; T-130b hat sie am 16.10. wiederhergestellt.
> Reihenfolge: **T-131** (jetzt, vor jedem weiteren Deploy), dann T-126 (Namen ändern), T-127a und T-127b (Archiv); je
> ein Auftrag, je ein Review, je ein Commit. Danach Deploy 7 mit allem und T-024 Teil B an der Konsole (PO, TL begleitet;
> Runbook in `infrastructure/DEPLOY.md`). **Bis T-131 committet ist: kein Push auf main, solange ein Deploy läuft.**

## T-131 · GHCR-Aufräumen darf kein Deploy-Ziel löschen (D-145)

**Für:** Development · **Risiko:** hoch (Lieferkette und Wiederherstellbarkeit) · **Zeitbox:** eine Sitzung.
Unabhängiges Review (AGENTS § 4). Nur Repository: kein Workflow-Start, kein Löschen, kein Wiederherstellen, kein
Serverzugriff, kein Deploy.

### Warum

T-130 und T-130b (Belege in `.t130-review/`): Während Deploy 6 (15.10., 18:14 bis 18:52 UTC) lud der Image-Lauf zu
`7e36c58` um 18:47 den Schutzsatz. Darin stand `fb28166` noch nicht, weil der Deploy ihn erst nach Aktivierung und
Gesundheitsprüfung veröffentlicht (`infrastructure/deploy`, `publish_protected_versions` nach `wait_for_health`). Als
Zusatzschutz gelten „die neuesten zwanzig“, gezählt als einzelne Paketversionen (`select-ghcr-deletions.mjs`,
`sortedVersions`, `keepNewest` höchstens 20). Ein Release besteht aus fünf Abbildern mit je Index, Plattform und
Attestation, also 15 Paketversionen. So löschte der Lauf neun Versionen der Produktion (Backend, Admin-Web, Operator-Web
zu `fb28166`). Am 16.10. wurden sie wiederhergestellt; die strenge Abrufprüfung ist wieder grün.

### Umfang

1. **Aufbewahrung nach ganzen Releases.** `keepNewest` (Paketversionen) entfällt. Stattdessen bleiben die neuesten
   **zehn Releases** vollständig erhalten. Ein Release ist eine Anwendungsversion mit allen ihren Tags (`<v>`,
   `admin-web-<v>`, `operator-web-<v>`, `landing-web-<v>`, `operations-<v>`) und den vollständigen Manifestgraphen.
   Die Reihenfolge ist deterministisch und im Code begründet (etwa nach dem frühesten `created_at` der getaggten
   Versionen eines Releases, Kennung als Gleichstandsregel). Unbekannte und ungetaggte Wurzeln wie heute.
2. **Reservierung des Deploy-Ziels.** Der Deploy-Controller veröffentlicht den Schutzsatz zusätzlich **vor dem ersten
   Abruf eines Abbilds** (`pull_image`), mit einem neuen Feld `pending_versions` (Zielversion und gewählte
   Operations-Version), atomar wie heute. Die Endveröffentlichung nach Aktivierung entfernt den erledigten Eintrag.
   Bei Abbruch oder Rücknahme bleibt er stehen, bis der nächste erfolgreiche Deploy ihn ersetzt; ein Absturz ist damit
   sicher. Der Workflow schützt `pending_versions` wie bekannte Versionen. Fehlt das Feld, gilt es als leer; ist es
   ungültig, wird das Aufräumen übersprungen.
3. **Zweites Lesen vor dem Löschen.** Unmittelbar vor der ersten Löschung liest der Workflow den Schutzsatz erneut.
   Weicht der Inhalt vom ersten Stand ab, wird nichts gelöscht (Warnung), die Abrufprüfung läuft trotzdem.
4. **Operations-Abbild des vorherigen Stands.** Erhalten bleiben auch `operations-<current>` und
   `operations-<previous>`, zusätzlich zur gewählten Operations-Version und `ops`. (Der Löschplan aus T-130b hätte
   `operations-d193725` entfernt.)
5. **Nachvollziehbarkeit.** Der geladene Schutzsatz (nicht sensitiv), beide Abfragezeiten und der Löschplan mit
   Kennung, Digest und Tags stehen in der Laufübersicht; jede Löschzeile nennt Kennung, Digest und Tags.
6. **Tests:**
   - Der Vorfall vom 15.10. als Test: Schutzsatz ohne `fb28166`, zwei neuere Releases zu je 15 Versionen → alle
     `fb28166`-Versionen bleiben. Rotnachweis gegen den alten Stand.
   - Zehn Releases bleiben vollständig samt Kindern und Attestationen; das elfte unbekannte Release wird gelöscht.
   - `pending_versions` schützt; fehlendes Feld gilt als leer; ungültiges Feld → kein Löschen.
   - Geänderter Schutzsatz beim zweiten Lesen → kein DELETE.
   - Deploy-Test (`infrastructure/tests/taptime-deploy.test`): Reservierung wird vor dem ersten `docker pull`
     veröffentlicht; die Endveröffentlichung enthält den erledigten Eintrag nicht mehr; ein Abbruch lässt ihn stehen.
   - Alle bestehenden GHCR- und Deploy-Tests grün.
7. **`infrastructure/DEPLOY.md`**, Abschnitt Schutzsatz, entsprechend nachziehen.

### Grenzen

Keine Änderung an den Abbildern, keine Workflow-Starts, kein Löschen oder Wiederherstellen. Die 74 bekannten
Fehlstellen in 16 älteren September-Ständen bleiben unverändert. Restrisiko im Bericht nennen (etwa eine Reservierung
genau zwischen zweitem Lesen und Löschen eines Ziels, das weder bekannt noch unter den zehn neuesten Releases ist).
ADO nicht ändern. Bericht in `.t131-review/`; kein Commit vor `APPROVED`. Nach dem Commit müssen CI und Image-Workflow
grün sein, einschließlich Aufräumen und Abrufprüfung.

---

## Danach: T-126 · Namen von Zugängen ändern (D-142)

**Für:** Development · **Risiko:** mittel (Datenbank, Berechtigung, Lohnexport) · **Zeitbox:** eine Sitzung. Unabhängiges
Review (AGENTS § 4). Beginnt nach T-131.

### Warum

Web-Abnahme des PO nach Deploy 6: Im Lohnexport stehen Zeiten des Administrators ohne Namen. Sein Zugang stammt von vor
T-107 (Migration 050) und hat keinen Namen; die Lesewege setzen dann einen leeren Text ein (Lohnexport-Liste
`read_effective_time_records_v2`, CSV `read_effective_time_entry_export_v3`, Zeiten prüfen) oder das Rollenwort
(Mitarbeiter, Zugänge). Seit C3E1 verhindert der Trigger `memberships_display_name_immutable` (Migration 008) jede
Änderung: Auch ein Tippfehler bei der Einladung bliebe für immer in der Lohnabrechnung. Kunden sind seit D-108
umbenennbar (Migration 046), Zugänge nicht.

### Umfang

1. **Migration 060**, nach dem Muster von „Kunde umbenennen“ (046) und `manage_membership_v1` (058):
   - `rename_membership_v1(command_id, target_membership_id, expected_row_version, display_name)` unter
     `taptime_membership_manager`, SECURITY DEFINER nach den Regeln aus T-119 (Katalogtest). Idempotent über die
     Befehls-ID wie `manage_membership_v1`; dieselbe Befehls-ID mit anderem Inhalt → `command_id_conflict`.
   - Name über `normalize_membership_display_name_v1`; leer, ungültig oder unverändert → `invalid_request`.
   - Berechtigung: Administrator für jeden aktiven Zugang des Betriebs, auch den eigenen und andere Administratoren;
     Standortleitung nur für aktive Mitarbeiter (Rolle `employee`) mit Heimatstandort in ihren Grants, wie beim Entzug.
     Sonst `forbidden`. Entzogene Zugänge bleiben unverändert (D-141): Antwort wie beim Entzug (`already_departed`
     bzw. `forbidden`). Veraltete Version → `stale_row_version`.
   - Der Trigger wird so ersetzt, dass `display_name` nur über diese Funktion änderbar ist, nie bei entzogenen Zugängen
     und nie zurück auf leer.
   - Protokoll: eigenes Ereignis `MembershipRenamed` mit `changedFields: ['name']` und `rowVersion`, ohne alten oder
     neuen Namen (wie bei Kunden). Eine Umbenennung darf nicht mehr als `MembershipRoleChanged` gebucht werden.
   - Lebenszyklus nach AGENTS 1.5 (was entsteht, wer es ändert, wie es entfernt wird) im Bericht.
2. **API und Vertrag:** neuer Weg wie „Rolle ändern“ (gleiche Fehlerabbildung, gleiche Zeitgrenzen), Vertrag in
   `apps/admin-web/src/contracts.ts`.
3. **Web:** „Name ändern“ als Nebenaktion im Seitenkopf der Person und als Zeilenaktion unter Zugänge neben „Rolle
   ändern“. Blatt mit einem Feld „Name“ (vorbelegt mit dem eigenen Namen, leer, wenn keiner da ist) und der Hauptaktion
   „Namen speichern“. Meldungen in Menschensprache (README § 8.1). Nach dem Speichern zeigen Balken, Listen und
   Lohnexport den neuen Namen ohne Neuladen der Seite.
4. **Nebenbei aus der Abnahme von T-122c (P3):** Der Monatsknopf im Monatsschalter bekommt eine feste Mindestbreite
   für den längsten Monatsnamen („September 2026“), damit ‹ beim Blättern nicht springt.
5. **Fehlender Name sichtbar machen:** In Lohnexport-Liste und Zeiten prüfen steht bei leerem Namen „Name fehlt“ (Text
   in `notice`) als Link zur Person. Ist unter den geladenen Zeiten mindestens eine ohne Namen, steht über der Tabelle
   ein Hinweis-Band: „Bei mindestens einer Person fehlt der Name. In der CSV bleibt er dann leer. Namen bei der Person
   ergänzen.“
6. **Tests:** PostgreSQL 17: Erfolg als Administrator und als Standortleitung; fremder Standort; Standortleitung auf
   Administrator oder Standortleitung; entzogener Zugang; veraltete Version; Idempotenz und Konflikt; direkte
   Änderung am Trigger scheitert; Ereignis ohne Namen; Normalisierung; Katalogtest. API; Web-Einheit; Browser für das
   Blatt (390 und 1440 px, beide Themen) und das Hinweis-Band im Lohnexport.

### Grenzen

Keine Änderung an App, CSV-Format und an entzogenen Zugängen. Kein neuer App-Build (die App liest Namen vom Server).
ADO nicht ändern. Bericht in `.t126-review/`; kein Commit vor `APPROVED`.

---

## Danach: T-127a · Archiv auf dem Server (D-143)

**Für:** Development · **Risiko:** mittel (Datenbank, Berechtigung) · **Zeitbox:** eine Sitzung. Unabhängiges Review.
Beginnt nach T-126.

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

## Danach: T-127b · Archiv im Browser (D-143)

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
