# Aktuelle Aufgabe

> **Stand 14.10.2026:** T-118a abgeschlossen (`8eff459`, Migration 057), noch nicht ausgeliefert. Jetzt **T-118b**.
> Danach T-120, dann Deploy 5 mit neuen App-Builds. Deploy 5 nur mit T-118b: Die Clients aus T-117b lehnen die neuen
> Markierungen in den Zielantworten ab.

## T-118b · Zuordnung und Kontingent-Hinweise in App und Web

**Für:** Development · **Risiko:** mittel (viele Oberflächen, kein Server) · **Zeitbox:** zwei Sitzungen; reißt sie, wird
nach App und Web getrennt gemeldet. Nur Clients (App, Web), ihre Parser und Tests. Kein Server, keine Migration, kein Deploy.

### Ausgangslage (`8eff459`)

- Server (T-118a): `POST /v1/administration/target-assignments/change` und `/query`; `/v2/mobile/work-targets/query`
  mit `assignedOnly` und `assignedToMe`; `/v2/administration/time-records/backfill-targets/query` mit `assignedOnly` und
  `assignedToPerson`; `POST /v2/customers/quota-alerts/query`. Alles noch ungenutzt.
- Die Parser der v2-Zielantworten in App und Web verlangen genau `targetType`, `targetId`, `displayName` und lehnen die
  neuen Markierungen heute ab. Der v1-Parser (`validateWorkTargetResponse`) bleibt unverändert.
- K1–K4 aus T-117b: Kontingent-Hinweise lesen alle Kunden über den alten Weg; Bestätigung nach „Kunde anlegen“ (App)
  und „nächster Schritt“ (Web-Übersicht) brauchen noch die vollständige Altliste.

### Regeln

1. **Parser:** v2-Zielantworten verlangen die jeweilige Markierung als Boolean. Anfragen senden `assignedOnly` nur, wenn
   er gebraucht wird.
2. **„Meine Kunden und Projekte“** (D-135) in „Manuell“ online (App und Web) und in „Zeit hinzufügen“ für die eigene
   Zeit. Für andere heißt der Abschnitt „Zugeordnete Kunden und Projekte“ und zeigt die der Zielperson.
   - Ohne Suchbegriff: oben dieser Abschnitt (`assignedOnly: true`, eigene Seiten), darunter „Alle Kunden und Projekte“
     wie heute, Zugeordnete dort auch. Ohne Zuordnung fehlt der Abschnitt; alles bleibt wie heute.
   - Mit Suchbegriff: eine Trefferliste wie heute; Zugeordnete tragen sichtbar und vorgelesen „zugeordnet“.
   - Feste Startleiste (T-116b), Auswahlregel (T-117b) und „Manuell“ ohne Netz bleiben unverändert.
3. **Web, Kunde** (Detail, nur `scope: 'people'`, aktiver Kunde): Abschnitt „Mitarbeiter“ mit den Zugeordneten (Abfrage je
   Ziel, Suche, „Weitere laden“), je „Entfernen“. „Mitarbeiter zuordnen“ öffnet eine Personensuche mit Mehrfachauswahl;
   bereits Zugeordnete sind markiert. Eine Standortleitung sieht nur Mitarbeiter, die sie verwalten darf (Z1–Z3).
4. **Web, Mitarbeiter** (`PersonView`): Abschnitt „Kunden und Projekte“ (Abfrage je Person), je „Entfernen“. „Kunden und
   Projekte zuordnen“ sucht über die Nachtrage-Ziele dieser Person, ohne „Allgemeine Arbeitszeit“, mit Mehrfachauswahl;
   bereits Zugeordnete sind markiert. Liefert die Abfrage `forbidden`, fehlt der Abschnitt.
5. **Zuordnen und Entfernen:** ein Befehl je Paar, nacheinander, ohne Rückfrage. Ergebnis je Eintrag. Unbestätigte Befehle
   behalten ihre `commandId` für „Erneut versuchen“. Meldungen: `target_not_selectable` → „{Name} kann diesen Kunden nicht
   wählen (anderer Standort).“; `forbidden` → „Dafür fehlt Ihnen die Berechtigung.“ Danach werden die Listen neu gelesen.
6. **Kontingent-Hinweise** in App und Web über `/v2/customers/quota-alerts/query` (aktueller Monat). Sind alle Hinweise
   einer Seite gesehen und gibt es `nextCursor`, wird die nächste Seite gelesen. Anzeige und „gesehen“ wie heute.
7. **K4:** Die App bestätigt „Kunde anlegen“ über `/v3/administration/setup-projection` (`kind: 'customers'`, Suche nach
   dem neuen Namen). „Nächster Schritt“ in der Web-Übersicht prüft nur, ob etwas existiert, mit je höchstens einer
   kleinen Seite. Die Standort-Einrichtung im Web darf weiter vollständig laden.
8. Danach ruft keine Oberfläche mehr `/v1/customers/hours/query` oder die gemischte Altliste der Einrichtung auf, außer
   der Standort-Einrichtung im Web.
9. **Barrierefreiheit:** Mehrfachauswahl als beschriftete Kontrollkästchen, Ergebnis angesagt, große Schrift ohne
   abgeschnittene Texte.

### Tests

Je Punkt rot vor der Änderung:
- Parser: v2 mit Markierung angenommen, ohne abgelehnt; v1 unverändert.
- „Meine“ oben mit eigenen Seiten; fehlt ohne Zuordnung; Suche markiert; für andere die Zielperson; offline unverändert.
- Kunde und Mitarbeiter: Liste, Suche, Seiten, Mehrfachauswahl mit Teilfehler und Wiederholen mit derselben `commandId`,
  Entfernen, `forbidden` blendet den Abschnitt aus.
- Kontingent-Hinweise auch von Seite 2; kein Aufruf des alten Wegs.
- K4: Bestätigung und „nächster Schritt“ ohne Altliste; Standort-Einrichtung unverändert.
- Browser: neue Abschnitte und Auswahl bei 390 und 1440 px und 200 % Schrift.
- Alle Suiten, Typecheck, Builds, Bundles und Browserläufe grün.

### Grenzen

Kein Server, keine Migration, keine Vertragsänderung außer Client-Parsern. Keine Zuordnung in der App (nur Anzeige).
Kein Deploy. ADO nicht ändern.

### Bericht

`.t118b-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei
P1/P2. Kein Commit vor `APPROVED` durch den TL.
