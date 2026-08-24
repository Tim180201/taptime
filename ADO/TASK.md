# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-010 · Eine Eskalation muss beim Administrator ankommen

**Für:** Codex · **Risiko:** fachliche Entscheidung, Migration, Mandantengrenze → **unabhängiges Review verpflichtend**
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** D-012, `ADO/PLAN.md`

### Der Fehler

Die App sagt dem Beschäftigten heute:

> „Prüfung erforderlich. Der Scan muss geprüft werden. Deine Arbeitszeit wurde nicht
> stillschweigend verändert."

Diese Prüfung findet nie statt. Der Weg im Einzelnen:

1. Die Engine entscheidet `escalation_required`.
2. `OfflineLifecycleIngestionCoordinator` schreibt die Abstimmzeile trotzdem mit
   `result_status = 'synchronized'` und `review_reason = null`.
3. `persistTimeEntryMutation` legt für diese Entscheidung keinen Zeiteintrag an — richtig so.
4. Das Gerät quittiert, die Warteschlange läuft weiter — ebenfalls richtig.
5. `read_time_review_items_v1` wählt nur `result_status = 'review_pending'`. Die Eskalation
   erscheint **in keiner Administratoransicht.**

Ergebnis: Die Arbeitszeit ist weg. Der einzige Nachweis liegt in `audit_events` und
`canonical_decisions` — beides hat keine Oberfläche. Der Beschäftigte hat ein Versprechen
bekommen, das das System nicht einlösen kann.

### Ziel

**Jede Entscheidung `escalation_required` erzeugt einen Prüfposten, den ein Administrator
sieht und entscheiden kann.** Auf jedem Weg — offline, kanonisch, manuell.

Die Aufgabe ist fertig, wenn ein absichtlich herbeigeführter Eskalationsfall in der Ansicht
*Prüfungen* auftaucht, dort entschieden wird und danach verschwindet.

### Invarianten, die nicht verletzt werden dürfen

1. **Die Warteschlange darf nie blockieren.** Das Gerät quittiert weiterhin und arbeitet die
   Warteschlange ab. Ein Prüfposten hält kein Gerät an.
2. **Kein Zeiteintrag ohne Engine-Entscheidung.** Eine Eskalation legt weiterhin keinen
   Zeiteintrag an. Erst die Entscheidung des Administrators tut das.
3. **Die Historie wird nicht umgeschrieben.** Append-only bleibt append-only.
4. **Die Meldung an den Beschäftigten muss wahr werden**, nicht verschwinden.

### Schritte

**1. Die Abstimmzeile muss die Wahrheit sagen**

- Migration: `review_reason` um einen Wert für die Engine-Eskalation erweitern. Der bestehende
  `CHECK` in `010_complete_offline_synchronization.sql:309` zählt fünf Werte auf.
- Bei `escalation_required` die Abstimmzeile mit `result_status = 'review_pending'` und dem
  neuen Grund schreiben statt mit `'synchronized'`.
- **Den Nachfolge-Block nicht setzen.** `predecessor_requires_review` hält spätere Ereignisse
  absichtlich an; eine Eskalation betrifft nur ihr eigenes Ereignis. Spätere Ereignisse werden
  normal bewertet. Begründung in den Bericht.

**2. Der Prüfposten muss den Grund tragen**

Der Administrator muss unterscheiden können, warum geprüft werden soll. Die Engine kennt sieben
Eskalationsgründe (`BusinessEngineEscalationReason`). Er braucht den Grund in verständlicher
Form, nicht den technischen Bezeichner.

**3. Alle drei Wege, nicht nur der Offline-Weg**

`ServerCanonicalLifecycleIngestionCoordinator` und `ManualLifecycleIngestionCoordinator` treffen
dieselbe Entscheidung. Wenn dort eine Eskalation entstehen kann, muss auch dort ein Prüfposten
entstehen. Prüfe beide und melde, was du gefunden hast.

**4. Die Ansicht Prüfungen**

Der neue Grund muss im Admin-Web lesbar dargestellt werden. Keine neue Ansicht, keine neue
Route — der bestehende Weg trägt das.

### Vision-Check

**One Tap. One Decision.** Der Beschäftigte tippt einmal. Das System löst die Unklarheit auf,
nicht er. Genau dafür gibt es die Eskalation — sie war nur bisher eine Sackgasse.

### Nicht anfassen

- `BusinessEngine`. Die Entscheidungslogik ist richtig und bleibt unverändert.
- Die Reihenfolge der Entscheidungen. Nichts an `findInconsistency`.
- `apps/admin-web` über die Darstellung des neuen Grundes hinaus.
- Nachträgliches Befüllen alter Daten. Die Produktionsdatenbank enthält nur die Erstinbetriebnahme.

### Prüfung — nachweisen, nicht behaupten

- Ein Test führt eine echte Eskalation gegen PostgreSQL herbei und weist nach, dass sie in
  `read_time_review_items_v1` erscheint.
- Ein Test weist nach, dass die Adjudikation sie auflöst und sie danach verschwindet.
- Ein Test weist nach, dass das Gerät weiterarbeitet: nach einer Eskalation wird das nächste
  Ereignis normal bewertet und die Warteschlange leert sich.
- Ein Test weist nach, dass **kein** Zeiteintrag durch die Eskalation entsteht.
- Ein Test weist nach, dass ein Administrator einer fremden Organisation den Prüfposten
  **nicht** sieht.
- Die sieben Eskalationsgründe sind vollständig abgebildet — keiner fällt in einen Standardfall.
- CI grün, kein `[skip ci]`.

### Zusätzliches Review

> Gibt es nach dieser Änderung noch irgendeinen Weg, auf dem ein Auslöser angenommen wird,
> keinen Zeiteintrag erzeugt und in keiner Administratoransicht erscheint? Suche danach, statt
> es auszuschließen.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-007` Sicherung und getesteter Restore · `T-008` Betriebssichtbarkeit ·
`T-009` Menschen verwalten · `T-011` Ratenbegrenzung · siehe `ADO/PLAN.md`.
