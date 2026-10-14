# Aktuelle Aufgabe

> **Stand 14.10.2026:** T-117b abgeschlossen (`e9bf389`), noch nicht ausgeliefert. T-118 ist geteilt: jetzt **T-118a**
> (Zuordnung und Kontingent-Hinweise auf dem Server), danach T-118b (Oberfläche), T-120, dann Deploy 5.

## T-118a · Zuordnung zu Mitarbeitern und Kontingent-Hinweise auf dem Server

**Für:** Development · **Risiko:** hoch (neue Tabelle mit Personenbezug, Schreibrechte, Lesewege) · **Zeitbox:** ein bis
zwei Sitzungen. Server, Verträge und deren Tests; keine Oberfläche. Kein Deploy.

### Ausgangslage (`e9bf389`)

- D-135: Administrator und Standortleitung können Kunden und Projekte einzelnen Mitarbeitern zuordnen, freiwillig.
  Zugeordnete stehen für den Mitarbeiter oben, alles andere findet er über die Suche. Sichtbarkeit (D-102), Karten und
  Berechtigungen bleiben unverändert.
- `/v2/mobile/work-targets/query` und `/v2/administration/time-records/backfill-targets/query` (T-117a) sind noch nicht
  ausgeliefert; ihr Vertrag darf deshalb wachsen. Alle anderen Wege bleiben unverändert.
- Die Kontingent-Hinweise in App und Web lesen noch alle Kunden über den alten Weg (T-117b, K1).

### Teil 1 · Zuordnung (D-135, TL-Entscheidung zur Umsetzung)

1. **Datenmodell:** neue Tabelle für Zuordnungen von Mitgliedschaft zu Ziel (Kunde oder Projekt über den Schlüssel von
   `work_targets`), mit Anlage (wann, durch wen) und Ende (wann, durch wen). Höchstens eine aktive Zuordnung je Person
   und Ziel. Beenden statt Löschen, die Historie bleibt. RLS erzwungen; geschrieben wird nur über SECURITY-DEFINER-
   Funktionen. **Lebenszyklus (AGENTS 1.5):** angelegt und beendet von Administrator oder Standortleitung; geändert wird
   nichts (beenden und neu anlegen). Austritt oder gelöschtes Ziel beenden nichts automatisch; die Lesewege zeigen nur
   aktive Personen und Ziele. Das Löschen personenbezogener Daten regelt später T-016.
2. **Befehl** `POST /v1/administration/target-assignments/change` mit `{expectedMembershipId, commandId, membershipId,
   targetType, targetId, assigned}` für genau ein Paar. `assigned: true` legt an, `false` beendet; ist der Zustand schon
   so, ist das ein Erfolg ohne neue Zeile. Idempotent je `commandId`, abweichender Inhalt → `command_id_conflict`.
3. **Wer darf:** Administrator für alle Personen und aktiven Ziele des Betriebs. Standortleitung nur für Personen, die sie
   heute verwalten darf (`has_membership_management_authority_v1`), und nur für Ziele, die in ihrem Bereich an einen
   Standort gebunden sind. Mitarbeiter: `forbidden`. Zuordnen geht nur, wenn die Person das Ziel heute wählen darf
   (`membership_may_choose_time_target_v1`), sonst `target_not_selectable`. Beenden ist immer möglich, solange die
   Verwaltungsrechte für die Person bestehen.
4. **Lesewege:**
   - `/v2/mobile/work-targets/query`: Eingabe `assignedOnly` (boolean), Ausgabe je Ziel `assignedToMe`.
   - `/v2/administration/time-records/backfill-targets/query`: dasselbe für die Zielperson (`assignedToPerson`).
   - Verwaltung: `POST /v1/administration/target-assignments/query` für eine Person (ihre Ziele) oder für ein Ziel (seine
     Personen), mit Suche und Seiten nach D-138, nur im eigenen Verwaltungsbereich.
   - `assignedOnly` filtert nur. Eine Zuordnung macht nie etwas sichtbar, das ohne sie unsichtbar wäre.
5. Kartenscan, Offline-Freigabe, Erfassung und alle Berechtigungen bleiben unverändert.

### Teil 2 · Kontingent-Hinweise (aus T-117b)

6. `POST /v2/customers/quota-alerts/query` mit `{expectedMembershipId, fromInclusive, toExclusive, cursor, limit}`: nur
   Kunden mit `warning` oder `exceeded` im Monat, gleiche Sichtbarkeit und Kontingentregel wie `read_customer_hours_v3`,
   Seiten nach D-138. Für Mitarbeiter (`scope: 'self'`) eine leere Liste.

Alle neuen oder geänderten Funktionen mit vollständigen Körpern in **Migration 057** (`T106FunctionBodies`).

### Tests

Je Punkt rot vor der Änderung, SQL mit vollständigem fachlichem Rotlauf:
- Zuordnen und Beenden: Administrator, Standortleitung innerhalb und außerhalb (Person, Ziel), Mitarbeiter `forbidden`,
  nicht wählbares Ziel `target_not_selectable`, Wiederholung idempotent, abweichender Inhalt abgewiesen, Historie
  bleibt, fremder Mandant nie.
- Lesen: `assignedOnly` liefert nur zugeordnete und weiterhin sichtbare Ziele; Markierungen stimmen; eine Zuordnung zu
  einem Ziel außerhalb der Sichtbarkeit erscheint nicht; ausgetretene Personen und inaktive Ziele erscheinen nicht.
- Verwaltungsabfrage für Person und für Ziel nur im eigenen Bereich, mit Suche und Seiten.
- Kontingent-Hinweise: dieselben Stufen wie v2, auch für Kunden jenseits der ersten Seite, Seiten unter 14 KiB,
  Mitarbeiter leer.
- RLS erzwungen, geringste Rechte (`B3SchemaSecurity`), keine Suchbegriffe in Logs.
- Alle Suiten, Postgres-Tests und Typecheck grün.

### Grenzen

Keine Oberfläche (T-118b). Keine Änderung an Sichtbarkeit, Berechtigungen, Karten oder ausgelieferten Wegen. Kein
Deploy, kein Zugriff auf Produktion. ADO nicht ändern.

### Bericht

`.t118a-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei
P1/P2. Kein Commit vor `APPROVED` durch den TL.
