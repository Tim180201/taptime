# Aktuelle Aufgabe

> **Stand 04.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b (`2a9eb73`) und T-103, Auslieferung mit dem nächsten
> Deploy. Reihenfolge: **T-095**, dann T-096 bis T-098, T-100 bis T-102 → Deploy und App-Builds → T-024 → Pilot.
> Frühere Briefs (T-094b, T-103) stehen in der Git-Historie.

## T-095 · App: keine Warteschlange ohne Ausweg, neue Ziele sofort scanbar (D-118)

**Für:** Development · **Risiko:** Offline-Warteschlange, Belegerhalt, Kontowechsel · **Zeitbox:** eine Sitzung. Nur
`apps/mobile` und deren Tests; Server nur, falls für A5 ein Lesefeld nötig ist (dann mit Begründung im Bericht). Keine
Änderung an Engine, Lebenszyklus-Routen oder Datenbankschreibern.

### Befund

1. Eine dauerhaft abgelehnte Erfassung (z. B. Konflikt) bleibt als Kopf der Warteschlange liegen; alle folgenden
   bleiben unversendet, die App zeigt nur „Sicher lokal gespeichert“ (F-029). Dasselbe bei einer Antwort, die die App
   nicht versteht (Zusatzfeld, neuer Wert, 400/404/410) oder bei „App veraltet“ (F-047).
2. Wiederholungsfristen hängen an der Wanduhr; eine Uhrkorrektur rückwärts sperrt den Kopf, auch „Erneut versuchen“
   greift nicht (F-103).
3. Eine manuelle Erfassung, die schon dauerhaft in der Warteschlange liegt, meldet bei einem Sitzungswechsel
   „Sitzung nicht mehr gültig“ (F-031). Seit T-103 bleiben die Knöpfe nach dem Speichern gesperrt, bis die Bestätigung
   kommt; ohne Netz ohne Ausweg auf diesem Bildschirm.
4. Im Produktionspfad mit Kontogenerationen werden Migrations- und Integritätsfehler als allgemeiner Schutz gemeldet;
   die genaue Ursache geht verloren, Tests prüfen nur den ungenutzten Pfad (F-075).
5. Geräteabnahme 02.10.: In einem neuen Betrieb mit nur dem Administrator ging Scannen und manuelles Erfassen erst
   nach Anlegen eines Mitarbeiters (vermutlich veraltete Offline-Freigabe; erst nachstellen).
6. Geräteabnahme 04.10.: Kontowechsel Admin → Mitarbeiter am Android zeigte „Vorgänge eines anderen Kontos offen“,
   obwohl alles grün war. Ursache: bestätigte Erfassungen warten als `confirmed_awaiting_archive` auf den
   Archivnachweis; nach rund 10 min ging der Wechsel.

### Auftrag

**A1 (D-118).** Drei Klassen von Antworten trennen: vorübergehend (Netz, 429, 5xx) → wiederholen wie heute; dauerhaft
abgelehnt oder fachlich nicht verstanden → Beleg in die vorhandene Quarantäne, sichtbar machen (Erfassen: „1 Erfassung
konnte nicht übertragen werden · Kunde X · 08:12“, „Meine Zeiten“: Eintrag „nicht übertragen“ mit Hinweis auf
„Nachtragen“), Nachfolger weiter senden; veraltet (426 oder unbekannte Vertragsversion) → Übertragung stoppt sichtbar
mit „Bitte App aktualisieren“. Diagnose bleibt erhalten. Die Quarantäne sperrt den Kontowechsel weiter (Belegerhalt);
der Hinweis sagt das.

**A2.** Wiederholungsfrist beim Laden gegen die aktuelle Zeit begrenzen; „Erneut versuchen“ ignoriert die Frist.

**A3.** Eine gespeicherte manuelle Erfassung meldet immer „gespeichert, wird übertragen“, auch nach Sitzungswechsel.
Nach dem Speichern werden die Knöpfe auf „Erfassen“ wieder frei, sobald die App offline ist oder nach 15 s ohne
Bestätigung; der Stand oben zeigt dann „Wird übertragen …“. Keine zweite Erfassung aus einem unbestätigten Stand: „Zeit
beenden“ bleibt bis zur Bestätigung gesperrt, „Manuell erfassen“ über den Offline-Weg bleibt möglich.

**A4.** Die tatsächliche Ursache aus dem Öffnen der Kontogeneration bis zur Schutzanzeige durchreichen; Tests auf die
Produktionskomposition.

**A5.** Befund 5 nachstellen (Test mit neuem Betrieb, nur Administrator). Nach jedem Anlegen von Kunde, Projekt oder Tag
und nach jeder Rollen- oder Standortänderung die Offline-Freigabe neu laden; Rotnachweis zuerst.

**A6.** Kontowechsel: Wartet die App nur noch auf den Archivnachweis, zeigt sie „Deine Erfassungen sind gebucht und
werden noch gesichert. Wechsel in wenigen Minuten möglich.“ statt „Vorgänge eines anderen Kontos offen“ und fragt den
Nachweis bei geöffneter App spätestens jede Minute ab. Offene, nicht gebuchte Vorgänge behalten den bisherigen Text.

### Tests

Rot vor Grün je Punkt. Pflicht: (1) Konflikt am Kopf → Quarantäne, Hinweis, Nachfolger gesendet, Engine-Ergebnis
unverändert; (2) unbekannte Antwortform → wie (1); 426 → Stopp mit „Bitte App aktualisieren“; (3) Uhr rückwärts →
Kopf wird gesendet; (4) Sitzungswechsel nach gespeicherter manueller Erfassung → „gespeichert“; (5) Knöpfe nach 15 s
ohne Bestätigung frei, „Zeit beenden“ gesperrt; (6) neuer Betrieb nur mit Administrator: Tag anlegen, sofort scannen;
(7) Kontowechsel mit nur `confirmed_awaiting_archive` → neuer Text, nach Archivnachweis Wechsel ohne Neustart. Volle
App-Suite, Typecheck, `expo export`, CI-Bauordnung.

### Nicht Teil

Server-Ende für Quarantäne-Belege (später), Versionskennung und „bitte aktualisieren“ vom Server (T-096), Engine,
neue Ereignisarten.

### Bericht

`.t095-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
