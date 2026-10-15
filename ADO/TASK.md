# Aktuelle Aufgabe

> **Stand 15.10.2026:** Deploy 6 abgeschlossen (`d193725` → `fb28166`). Abgeschlossen: T-024 Teil A (`7e36c58`),
> T-122c (`e614779`), T-122d (`df76957`, CI in drei Teilen grün). Der Image-Workflow zu `df76957` hat alle fünf Abbilder
> veröffentlicht, scheiterte aber beim Aufräumen und in der Abrufprüfung an `GHCR manifests/fb28166 failed (404)`; das
> klärt T-130 nur lesend. Reihenfolge: **T-129** (jetzt, Startseite) und parallel **T-130** (Befund), dann T-126
> (Namen ändern), T-127a und T-127b (Archiv); je ein Auftrag, je ein Review, je ein Commit. Danach Deploy 7 mit allem und
> T-024 Teil B an der Konsole (PO, TL begleitet; Runbook in `infrastructure/DEPLOY.md`).

## Parallel: T-130 · GHCR-Befund: Produktionsabbild `fb28166` nicht abrufbar (nur lesen)

**Für:** Development · **Risiko:** Befund in der Lieferkette; die Aufgabe selbst ist rein lesend · **Zeitbox:** kurz.
Läuft parallel zu T-129: kein Branch, keine Änderung am Arbeitsverzeichnis außer `.t130-review/`.

### Warum

Image-Workflow zu `df76957` (Lauf 38809812772): alle fünf Abbilder veröffentlicht, danach scheiterten Aufräumen und
Abrufprüfung mit `GHCR manifests/fb28166 failed (404)`. `fb28166` ist seit Deploy 6 (15.10., etwa 18:14 bis 18:52 UTC)
die Produktion. Der Lauf zu `7e36c58` meldete Aufräumen und Abrufprüfung noch grün. Das Aufräumen hat diesmal richtig
nichts gelöscht, weil die strenge Prüfung vorher scheiterte. Die Produktion läuft mit den lokal vorhandenen Abbildern
weiter; offen ist, ob ein Produktionsabbild in GHCR fehlt und warum.

### Erlaubt und verboten

Nur lesende Abfragen (`gh api` GET, anonymer Abruf wie der Server). Verboten: Löschen, Wiederherstellen, Tags setzen,
Workflows neu oder manuell starten, Serverzugriff, Deploy (STATUS: kein manuelles GHCR-DELETE, kein manueller Neustart).

### Fragen

1. Lauf 38809812772: die genauen Fehlerzeilen beider Schritte; welcher Abruf zuerst scheiterte.
2. Schutzsatz jetzt: `https://admin.tb-infra.de/status/ghcr-protected-versions.json` (nicht sensitiv, DEPLOY.md):
   `current_version`, `previous_version`, `operations_version`, Zahl der `known_versions`.
3. Anonymer Abruf je Tag mit HTTP-Status: `fb28166`, `admin-web-fb28166`, `operator-web-fb28166`,
   `landing-web-fb28166`, dieselben für `d193725`, dazu `7e36c58`, `df76957`, der Operations-Tag aus dem Schutzsatz und
   `ops`.
4. Paketversionen von `taptime-backend-api` (aktiv und mit `state=deleted`): Gibt es eine Version mit Tag `fb28166`
   (Kennung, `created_at`, `updated_at`, Tags)? Wie viele aktive Versionen gibt es?
5. Die Image-Läufe zu `fb28166` und `7e36c58`: Start und Ende in UTC, der geladene Schutzsatz, soweit protokolliert,
   und jede Zeile „Deleting obsolete unprotected GHCR package version …“. Wurde eine Version mit `fb28166` gelöscht,
   und lag der Lauf vor oder nach dem Ende von Deploy 6?
6. Ursache mit Belegen oder ehrlich „unklar“ mit den offenen Punkten. Vorschlag für den Rückweg (etwa Wiederherstellen
   einer gelöschten Version innerhalb der 30-Tage-Frist) und für eine Absicherung, damit ein laufendes
   Produktionsabbild nie gelöscht werden kann. Nur Vorschläge, nichts ausführen.

### Bericht

`.t130-review/report.md` mit den Befehlen (ohne Token) und Ergebnissen. Keine Änderung am Repository.

---

## Jetzt: T-129 · Startseite: Abschnitt „Stempelpunkte“ (D-144)

**Für:** Development · **Risiko:** niedrig (nur `apps/landing-web`; die Startseite ist bis T-031b passwortgeschützt) ·
**Zeitbox:** eine kurze Sitzung. Beginnt jetzt.

### Warum

PO 15.10.: Stationäre Stempelpunkte (die Taptura-Karte fest in einem Wandrahmen oder Tischkeil, ohne Strom und Netz)
sollen so früh wie möglich auf die Startseite. Produkt, Karten für „Allgemeine Arbeitszeit“ (T-128) und
fälschungssichere Chips (T-073) kommen erst nach dem Pilot (D-144). Die Seite kündigt darum ehrlich an und verspricht
nichts, was es noch nicht gibt.

### Umfang

1. **Neuer Abschnitt `#stempelpunkte`** direkt nach `#ohne-tag`, im Aufbau der übrigen Abschnitte, in beiden Themen und
   in der Sie-Form der ganzen Seite:
   - Eyebrow „Bald verfügbar“ (Kennzeichnung, kein Knopf).
   - Überschrift „Ihr Stempelpunkt. Ohne Kabel.“
   - Text: „Die Taptura-Karte gibt es bald fest montiert: im Wandrahmen am Eingang oder als Tischkeil auf dem
     Schreibtisch. Kein Strom, kein Netzwerk, kein Terminal. Ihre Mitarbeiter halten ihr Handy kurz daran – die App
     weiß, wer stempelt.“
   - Drei Vorteile: „Einfach anbringen“ (kleben oder schrauben, ohne Kabel und Batterie) · „Mit dem Handy stempeln“
     (das Handy weist die Person aus; eine Mitarbeiterkarte gibt es nicht) · „Flexibel erweitern“ (so viele Punkte wie
     nötig – am Eingang, je Schreibtisch, beim Kunden; zugeordnet in der Verwaltung).
   - Zwei Bilder „Wandrahmen“ und „Tischkeil“ aus `.t129-review/assets/` (Konzeptbilder des PO), je mit der
     sichtbaren Unterschrift „Entwurf“ und einem beschreibenden Alternativtext; als optimierte lokale Dateien (WebP
     oder JPEG, je höchstens 60 KB, `width`/`height` gesetzt, `loading="lazy"`), CSP unverändert.
   - Kein Preis, kein Video, kein Bestellknopf; am Ende ein Textlink „Interesse? Sprechen Sie uns an.“ zu `#anfrage`.
2. **Häufige Fragen:** neue Frage „Was ist ein Stempelpunkt?“ mit der Antwort „Eine Taptura-Karte in einem festen
   Halter für Wand oder Schreibtisch. Er braucht weder Strom noch Netzwerk. Gestempelt wird mit dem Handy und der
   Taptura-App, auf dem iPhone heute mit geöffneter App. Die Stempelpunkte sind in Vorbereitung.“
3. **Tests und Fotos:** Der bestehende Landing-Browsertest (axe, beide Themen, 390 und 1440 px, kein seitliches
   Scrollen, keine fremden Anfragen) deckt den Abschnitt ab; dazu eine Prüfung, dass der Abschnitt „Bald verfügbar“
   und an beiden Bildern „Entwurf“ trägt. Fotos des Abschnitts bei 390 und 1440 px in beiden Themen.

### Grenzen

Nur `apps/landing-web`; `/app`, `/tag` und Caddy unverändert. Sobald echte Prototypen fotografiert sind, ersetzt ein
kleiner Folgeauftrag die Entwürfe. ADO nicht ändern. Bericht in `.t129-review/`; kein Commit vor `APPROVED`.

---

## Danach: T-126 · Namen von Zugängen ändern (D-142)

**Für:** Development · **Risiko:** mittel (Datenbank, Berechtigung, Lohnexport) · **Zeitbox:** eine Sitzung. Unabhängiges
Review (AGENTS § 4). Beginnt nach T-129.

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
