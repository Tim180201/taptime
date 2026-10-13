# Aktuelle Aufgabe

> **Stand 13.10.2026:** Doku `117e150` (T-116a bis T-120 geplant, D-135, D-136). Der PO verschiebt die Geräteabnahme;
> die Umsetzung läuft weiter. Jetzt T-116a. Danach folgen T-116b, T-117, T-118 und T-120, dann Deploy 5.

## T-116a · Gründe nach D-134 und „Karte entfernen“

**Für:** Development · **Risiko:** hoch (Migration 053, SECURITY-DEFINER-Funktionen, Offline-Abgleich) · **Zeitbox:**
ein bis zwei Sitzungen. Server, Verträge, App und Web. Kein Deploy.

### Ausgangslage (`117e150`)

- **Gründe:** Ändern und Nachtragen fremder Zeiten verlangen heute in jeder Rolle einen Grund (052, Bedingung nur
  eigen/fremd). Beenden über den Verwaltungsweg verlangt ihn immer (049), auch für die eigene Zeit der Standortleitung.
  Löschen verlangt immer einen Code (`duplicate`, `misscan`, `other` mit Text; 038/049). Einen freiwilligen Grund und
  den Text „Kein Grund angegeben“ gibt es nicht.
- **Karten:** Ein Entfernen gibt es nicht. Eine Zuordnung endet nur durch Umhängen (blockiert bei laufender Zeit mit
  `assignment_in_use`) oder durch Löschen des Kunden. Das Datenmodell trägt es schon: Der Update-Trigger auf
  `nfc_assignments` erlaubt nur das Schließen (`active=false`, `valid_to`, `row_version+1`); Ziel und Identität sind
  unveränderlich. Zeiteinträge verweisen nie auf eine Zuordnung.
- **Offline-Falle:** `OfflineLifecycleIngestionCoordinator.ts` (um Z. 948–983) nimmt eine vor dem Schließen erfasste
  Offline-Zeit nur dann ohne Prüffall an, wenn die Zuordnung durch Kundenlöschung endete (`assignmentClosedByDeletion`).
  Nach einem Entfernen oder Umhängen landet sie wegen `row_version` in „Zeiten prüfen“, obwohl sie gültig war.
- **Karte prüfen:** `InspectTagResult` (v1) ist streng auf vier Felder festgelegt und enthält keine Kennungen.

### Teil A · Gründe (D-134)

**Regel:** Ein Grund ist genau dann Pflicht, wenn die **Standortleitung** die Zeit **einer anderen Person** ändert,
nachträgt oder beendet. Sonst ist er freiwillig. „Zeiten prüfen“ bleibt unverändert (immer Pflicht).

| Aktion | Eigene Zeit, jede Rolle | Fremde Zeit, Administrator | Fremde Zeit, Standortleitung |
|---|---|---|---|
| Ändern | freiwillig, ohne Angabe „Selbst geändert“ (wie heute) | freiwillig, ohne Angabe „Kein Grund angegeben“ | Pflicht |
| Nachtragen | freiwillig, ohne Angabe „Selbst nachgetragen“ (wie heute) | freiwillig, ohne Angabe „Kein Grund angegeben“ | Pflicht |
| Beenden (Verwaltungsweg) | freiwillig, ohne Angabe „Selbst beendet“ | freiwillig, ohne Angabe „Kein Grund angegeben“ | Pflicht |
| Löschen | freiwillig, mit Rückfrage | freiwillig, mit Rückfrage | freiwillig, mit Rückfrage |

1. **Der Server entscheidet.** Rolle aus der aktuellen Mitgliedschaft des Handelnden beim Befehl, „eigen“ aus dem
   geladenen Eintrag (`user_id` = Handelnder), wie heute nach Berechtigungs- und Belegprüfung. Berechtigungen bleiben
   unverändert.
2. **Freiwilliger Grund:** `null` oder nur unsichtbare Zeichen → Standardtext aus der Tabelle; sichtbarer Text mit 1 bis
   500 Zeichen → so gespeichert; länger → bisheriger Fehler. Pflichtgrund wie heute.
3. **Löschen:** `reasonCode` darf `null` sein (dann `reasonText` `null`). Gespeichert wird `reason_code = 'none'`
   (CHECK erweitern, Kopplung an `reason_text` anpassen), angezeigt „Kein Grund angegeben“. Die drei bisherigen Codes
   bleiben gültig (ältere Apps). `'none'` im Request ist ungültig; nur der Server setzt es.
4. **Oberfläche, Web und App gleich:**
   - Pflichtfeld „Grund der Änderung (Pflicht)“ nur für die Standortleitung bei fremden Zeiten.
   - Administrator bei fremden Zeiten: Feld „Grund (freiwillig)“.
   - Eigene Zeiten wie seit T-113 ohne Grundfeld (Nachtragen behält den Kommentar). Das gilt jetzt auch für das
     Beenden der eigenen Zeit durch die Standortleitung.
   - Löschen: Rückfrage „Zeiteintrag löschen?“ mit freiwilliger Auswahl „Grund (freiwillig)“ (Doppelt erfasst,
     Fehlscan, Sonstiges mit Text) und „Löschen bestätigen“ / „Abbrechen“, für alle Rollen.
   - Verlauf: „Kein Grund angegeben“ wird angezeigt; „Selbst beendet“ wird wie die anderen „Selbst …“-Texte durch
     „selbst“ ersetzt.
   - Betroffen sind beide Korrekturformulare im Web (`TimeEditingControls.tsx`, „Abgeschlossene Arbeitszeit
     korrigieren“ in `TimeRecordsView.tsx`) und die Steuerung in der App.
5. **Migration 053** mit vollständigen Funktionskörpern (`T106FunctionBodies`): `backfill_time_record_v1`,
   `correct_time_record_v1` (Basis 052), `prepare_administration_stop_v1` und, falls dort geprüft, die Commit-Funktion
   (Basis 049), `void_time_record_v1` (Basis 049). Keine Änderung bestehender Zeilen. Wiederholung mit gleicher
   `commandId` liefert dasselbe Ergebnis. Das Ende per Zugangsentzug („Zugang entzogen“) bleibt unverändert.
6. **Verträge:** Grund im Verwaltungs-Beenden `string | null`, `reasonCode` beim Löschen `VoidReason | null`;
   Meldungstexte anpassen.

### Teil B · „Karte entfernen“ (TL-Entscheidung)

1. **Befehl** `POST /v1/administration/nfc-tags/remove` mit `{expectedMembershipId, commandId, nfcTagId,
   expectedAssignmentId}`. Er schließt genau diese aktive Zuordnung (`active=false`, `valid_to` = Transaktionszeit,
   `row_version+1`). Karte, Verlauf und Zeiten bleiben. Ergebnisse: `succeeded` (mit `removedAt`), `assignment_changed`
   (aktive Zuordnung weicht ab oder fehlt), `forbidden`, `unauthorized`, `invalid_request`, `unavailable`.
   Idempotent je `commandId`; dieselbe `commandId` mit anderem Inhalt wird abgewiesen wie bei den anderen Befehlen.
2. **Wer:** Administrator; Standortleitung in ihrem Bereich mit denselben Prüfungen wie beim Umhängen
   (`has_current_nfc_setup_authority_v1` für den Zielkunden bzw. `NULL` bei Pausenkarten,
   `has_current_nfc_tag_setup_authority_v1` für die Karte). Mitarbeiter: `forbidden`. Kein Grund.
3. **Laufende Zeit:** Entfernen ist erlaubt, kein `assignment_in_use`. Die Zeit läuft weiter und wird in der App mit
   „Zeit beenden“ bzw. „Pause beenden“ beendet. Ein Scan der entfernten Karte zeigt wie heute „Karte nicht zugeordnet“.
4. **Umsetzung:** SECURITY-DEFINER-Funktion in 053, Eigentümer `taptime_admin_setup_data_function_owner`, dieselbe
   Advisory-Sperre und Sperrreihenfolge wie Umhängen und `manage_customer_v1`, Beleg über eine Audit-Zeile je
   `commandId` wie bei `reuse_nfc_tag_v1` (046). Route in Routentabelle, Diagnose-Switch und `isAdministrationRoute`.
5. **Wiederverwendung:** Eine entfernte Karte lässt sich mit „Karte einrichten“ neu zuordnen (vorhandener Weg über
   `reuse`).
6. **Karte prüfen v2:** `/v2/administration/nfc-tags/inspect` liefert zusätzlich `nfcTagId` und `activeAssignmentId`
   (beide `null`, wenn nicht zugeordnet, unbekannt oder außerhalb des Bereichs; nichts darf durchsickern). v1 bleibt
   für ältere Apps unverändert.
7. **Offline:** `assignmentClosedByDeletion` wird zu jedem Schließen verallgemeinert: Ein vor `valid_to` erfasstes
   Ereignis ist gültig, wenn `valid_to` gesetzt ist und `row_version` genau Lease + 1 beträgt. Das gilt für Entfernen,
   Umhängen und Kundenlöschung; der Update-Trigger lässt an Zuordnungen nichts anderes zu. Ereignisse ab `valid_to`
   bleiben Prüffälle wie heute. Nach dem Entfernen erneuert das handelnde Gerät seine Freigabe wie nach anderen
   Verwaltungsaktionen; andere Geräte erfahren es bei der nächsten Freigabe (höchstens 12 h), das ist akzeptiert.
8. **App, Reiter „Karten“:** In der Liste je zugeordneter Karte (Kunde oder Pause) „Entfernen“ (Bedienhilfe „Karte
   NAME entfernen“). Nach „Karte prüfen“ mit zugeordneter Karte der Knopf „Karte entfernen“. Rückfrage wie in
   `CustomerManagement.tsx`: „Karte „NAME“ entfernen?“, darunter „Bisherige Zeiten bleiben unverändert. Läuft gerade
   eine Zeit über diese Karte, läuft sie weiter und wird in der App beendet.“, dann „Entfernen bestätigen“ /
   „Abbrechen“. Danach „Karte entfernt. Sie kann neu eingerichtet werden.“ und eine aktualisierte Liste. Bei
   `assignment_changed`: „Die Karte wurde inzwischen geändert. Bitte die Liste aktualisieren.“ Die Reihenfolge der
   Knöpfe ändert erst T-116b.
9. **Web, Einrichtung → Karten** (nur Administrator, wie heute): je zugeordneter Karte „Entfernen“ mit derselben
   Rückfrage. Die Standortleitung hat im Web keine Kartenansicht (T-062); das bleibt so.

### Tests

Je Punkt rot vor der Änderung:
- **A, SQL:** Matrix Aktion × Rolle × eigen/fremd. Pflicht genau bei Standortleitung und fremder Zeit; Administrator
  fremd ohne Grund speichert „Kein Grund angegeben“; eigenes Beenden ohne Grund „Selbst beendet“; Löschen ohne Code
  speichert `none`; alte Codes gültig; `none` im Request ungültig; nur Leerzeichen ergibt den Standardtext; mehr als
  500 Zeichen wird abgewiesen; „Zeiten prüfen“ verlangt weiter einen Grund; „Zugang entzogen“ unverändert.
- **A, angepasste Tests:** Nur Erwartungen ändern, die D-134 ändert (u. a. T113, T062, T066, T069, T088,
  TimeReviewApi, Web T066TimeEditing und App.test, App T066Controls, T066TimeEditing, T077OwnTimes). Jede geänderte
  Erwartung im Bericht nennen.
- **B, Server:** Entfernen durch Administrator, durch Standortleitung im Bereich, außerhalb `forbidden`, Mitarbeiter
  `forbidden`, Pausenkarte. Veraltete `expectedAssignmentId` ergibt `assignment_changed`; Wiederholung idempotent;
  `commandId` mit anderem Inhalt abgewiesen. Laufende Zeit läuft weiter und lässt sich online beenden, auch eine
  laufende Pause. Entfernte Karte für einen anderen Kunden neu eingerichtet. Wettlauf Entfernen gegen Start wie in
  `C3E2PostgresNfcTagReassignment`. Geringste Rechte in `B3SchemaSecurity`.
- **B, Offline:** Vor dem Entfernen erfasst und danach hochgeladen ergibt keinen Prüffall; nach `valid_to` mit alter
  Freigabe ergibt `historical_configuration_not_valid`; dasselbe für Umhängen; Kundenlöschung unverändert
  (T100-Test).
- **B, Verträge und Oberfläche:** Inspect v2 mit Kennungen, v1 unverändert, unbekannte Karte ohne Kennungen. App und
  Web: Aktion, Rückfrage, Texte, Bedienhilfe, Aktualisierung der Liste und der Freigabe.
- Alle Suiten, Postgres-Tests und Typecheck grün.

### Grenzen

- Kein Deploy, kein Zugriff auf Produktion. 053 nur additiv: Funktionen, erweiterter CHECK, keine Datenänderung.
- Keine Umstellung der Kartenknöpfe (T-116b), keine Suche (T-117). ADO nicht ändern.

### Bericht

`.t116a-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei
P1/P2. Kein Commit vor `APPROVED` durch den TL.
