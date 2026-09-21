# Aktuelle Aufgabe

> **Stand 21.09.2026, abends:** Auf `main` liegen T-067 (`d75fd56`, Deploy läuft) und T-065
> (`ae6e0bf`, CI grün, noch keine APK). Die nächste APK und die nächste Geräteabnahme kommen
> **gemeinsam** nach T-066 und einem Deploy.
> Reihenfolge: **T-066 → T-068 → Deploy → APK → Geräteabnahme → Pilot Monat 1**
> (D-067, D-068, D-069, D-070).

## T-066 · Zeit nachtragen, Kommentar, Ändern durch den Administrator

**Für:** Development · **Risiko:** Zeitdaten, Rechte, Export, Kompatibilität alter App-Versionen
**Zeitbox:** zwei Sitzungen; Reihenfolge Server → App → Web. Reicht die Zeit nicht, nach der App
stoppen und melden. **Grundlage:** D-067, D-069, D-070, Geräteabnahme vom 21.09.2026.

### Befund (am Quelltext geprüft)

- **Ein vergessener Tag ist heute von niemandem reparierbar.** Die Korrektur (DA3,
  `/v1/administration/time-records/correct`, Migration 012) ändert nur einen vorhandenen
  Eintrag; neu anlegen kann niemand.
- **Das Modell trägt einen Eintrag ohne Tap schon:** `time_record_revisions` erlaubt
  `canonical_time_entry_id IS NULL`; `effective_time_records_v2` (Migration 013) führt solche
  Einträge heute als Quelle `recovered` (aus der Prüfung von Offline-Konflikten). Die App
  zeigt sie als „wiederhergestellt", der Export v3 als `manual` (Migration 018, Zeile 166).
- **Kommentare gibt es nirgends.** Der Grund einer Korrektur ist der Grund des Verwalters, kein
  Kommentar des Mitarbeiters.
- **Der Mitarbeiter sieht nicht, dass sein Eintrag geändert wurde.** Die Antwort von
  `/v1/mobile/own-time/query` kennt nur `startedVia`/`stoppedVia`.
- **Beide Clients prüfen Antworten streng** (T-060: das Admin-Web weist zusätzliche Felder ab;
  der Mobile-Vertrag prüft Felder einzeln). Neue Felder brechen alte App-Versionen im Feld.
- **Administrator und Standortleitung haben in der App keinen Reiter „Meine Zeiten"** (D-058);
  ihre eigenen Zeiten erreichen sie über Mitarbeiter.
- Die Kopfzeile der App zeigt seit T-065 die E-Mail statt der Rolle.

### Umsetzung

1. **Nachtragen nach D-070 — kein WorkEvent.** Ein nachgetragener Eintrag ist ein neuer
   Zeiteintrag als Revision 1 ohne kanonischen Eintrag, mit eigener, dauerhaft gespeicherter
   Herkunft „nachgetragen" (Migration 030, append-only), getrennt von `recovered`. Geschlossenes
   Intervall mit Arbeitsziel. Keine Pausen im nachgetragenen Eintrag; wer eine Pause hatte,
   trägt zwei Einträge nach. Idempotent über `commandId` wie die bestehenden Befehle.
2. **Grenzen, serverseitig geprüft:** Ende nicht in der Zukunft; Beginn vor Ende; höchstens
   24 Stunden; keine Überschneidung mit einem anderen wirksamen Eintrag derselben Person
   (kanonisch, nachgetragen, wiederhergestellt oder laufend).
   - **Mitarbeiter:** nur für sich selbst; Beginn im laufenden oder im Vormonat
     (Europe/Berlin); Kommentar optional.
   - **Administrator:** für jedes Mitglied seines Betriebs, ohne Zeitgrenze; Grund Pflicht.
   - **Standortleitung:** in dieser Aufgabe abgewiesen — ihre Rechte kommen mit T-062.
3. **Kommentar je Zeiteintrag.** Der Mitarbeiter kommentiert jeden eigenen Eintrag, jederzeit;
   append-only, die jüngste Fassung gilt, frühere bleiben erhalten; 1 bis 500 Zeichen.
   Administrator (und später Standortleitung) lesen mit, schreiben aber keine Kommentare —
   ihr Wort ist der Grund einer Korrektur.
4. **Der Mitarbeiter sieht Änderungen an seinem Eintrag** (D-069): dass, wann und warum er
   geändert wurde, ob von ihm selbst nachgetragen oder durch die Verwaltung. Kein Name des
   Verwalters nötig.
5. **Kompatibel:** Neue Felder in Eigenzeit-, Personenzeit- und Sitzungsantworten nur für
   Clients, die die neue Fassung ausdrücklich anfordern — Muster aus T-060 (`Accept` mit
   versioniertem Medientyp, `Vary: Accept`). Alte App-Versionen bekommen die bisherige Antwort
   unverändert.
6. **Export:** Neue Fassung v4 mit Herkunft (gescannt, manuell, nachgetragen, wiederhergestellt),
   Änderungsmarke und aktuellem Kommentar. v3 bleibt in Form und Bedeutung unverändert.
7. **App:**
   - Mitarbeiter: Knopf „Zeit hinzufügen" in Meine Zeiten → Kunde/Projekt → Datum, von, bis →
     Kommentar (optional) → speichern. Nur online; offline sichtbar gesperrt mit Hinweis.
   - Tagesansicht: an jedem eigenen Eintrag Kommentar schreiben und lesen; Marken
     „nachgetragen" und „geändert" mit Zeitpunkt und Grund.
   - Administrator: in Mitarbeiter → Person → Tagesansicht „Zeit hinzufügen" und an jedem
     Eintrag „Ändern" (von, bis, Grund) über die bestehende Korrektur.
   - Kopfzeile: E-Mail **und** Rolle („tim@… · Administrator"; offline „… · Offline").
8. **Web:** dieselben Fähigkeiten für dieselben Rollen: Zeit hinzufügen und Kommentar in
   Meine Zeiten; der Administrator trägt für Personen nach und ändert wie heute; Marken wie in
   der App; Export v4 im Verwaltungsbereich.

### Grenzen

- Keine Änderung an Trigger, WorkEvent, Business Engine, Offline-Abgleich oder T-052-Warteschlange.
- Keine Rechte für die Standortleitung (T-062). Keine Änderung an bestehenden Migrationen 001–029.
- v3-Export, bisherige Antwortformen und alte App-Versionen bleiben unverändert funktionsfähig.
- Kein Deploy, kein APK-Bau.

### Korrektur vom 21.09. (Befund Development, Entscheidung Technical Lead, D-071)

Richtig gestoppt: `correct_time_record_v1` weist alles außer `stopped` als `not_adjustable` ab
(Migration 012, Zeile 820), und die Leser der Engine lesen den laufenden Zustand direkt aus
`time_entries`. Eine laufende Zeit durch die Verwaltung zu beenden ist eine Änderung am
Lebenszyklus — die habe ich mit „jeden Eintrag" versehentlich mitbestellt.

9. **„Ändern" gilt für abgeschlossene Einträge.** An einem laufenden Eintrag gibt es keinen
   Ändern-Knopf, sondern den sichtbaren Hinweis „Läuft noch — erst beenden, dann ändern".
   Der Weg bis T-069: Der Mitarbeiter beendet per Tap oder von Hand, danach korrigiert der
   Administrator das Ende.
10. **Später entstehende Überschneidungen werden sichtbar gemacht, nicht verhindert.** Beim
    Nachtragen gilt die Prüfung aus Punkt 2. Überschneidet sich ein Eintrag später — etwa durch
    einen verspätet abgeglichenen Offline-Tap oder eine Korrektur —, markieren Eigenzeit- und
    Personenzeitansicht (in der neuen Antwortfassung) beide Einträge als „überschneidet sich".
    Keine Sperre in Abgleich, Engine oder Korrektur.
11. Alles andere aus diesem Auftrag gilt unverändert; Reihenfolge Server → App → Web.

### Verifikation und Abschluss

- **Rotnachweise zuerst**, je Grenze: Mitarbeiter für andere; außerhalb des Fensters; in der
  Zukunft; Überschneidung mit kanonischem, nachgetragenem, wiederhergestelltem und laufendem
  Eintrag; Administrator ohne Grund; Standortleitung; fremder Betrieb; Kommentar auf fremden
  Eintrag; Wiederholung mit gleicher und abweichender `commandId`.
- Migration 030 ab leerem Schema und auf befülltem Stand 029; vorhandene Werte vorher/nachher
  unverändert; RLS auf jeder neuen Tabelle aktiviert und erzwungen.
- Alte Clients: bisherige Antworten byteweise gleich, wenn die neue Fassung nicht angefordert
  wird.
- Export v4 mit allen vier Herkünften und Kommentar; v3 unverändert.
- Laufender Eintrag: kein Ändern angeboten, Hinweis sichtbar; die bestehende Korrektur bleibt
  unverändert. Überschneidungsmarke: Rot-/Grünnachweis mit einem verspätet eingespielten Eintrag.
- App und Web: Tests für jeden Knopf und jede Marke; Typechecks einschließlich Tests;
  `npx expo export --platform android`; Barrierefreiheit (axe im Web).
- Unabhängiges read-only Review, höchstens zwei Runden. Nichts committen, nichts pushen.
  Review-Dateien nach `.t066-review/`.

## Danach

**T-068** Betreiber-Bereich (D-068) — Entwurf durch den Technical Lead folgt.
