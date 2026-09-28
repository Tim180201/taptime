# Aktuelle Aufgabe

> **Stand 28.09.2026:** Produktion auf `e13916b` (Migrationen bis 034). Auf `main` zusätzlich T-080 (App), T-086/T-087
> (035), T-084 (`0bc4760`, 036). Reihenfolge (PO 28.09., D-097, D-098): **T-085** → Sicherungs-Fix (falls nötig) →
> T-088 → ein Deploy, ein App-Build → T-024 → Pilot Monat 1. Frühere Briefs stehen in der Git-Historie.

## T-085 · Monatskontingent je Kunde, Hinweis ab 90 % (D-097)

**Für:** Development · **Risiko:** neues Schreibrecht der Standortleitung; Kontingent darf Mitarbeitern nie
erscheinen · **Zeitbox:** eine Sitzung. Eine Migration `037`, Backend (Administration und Kundenleser), Route,
`apps/admin-web`, `apps/mobile`, deren Tests. Baut auf T-084 auf.

### Was der Nutzer sieht

Administrator und Standortleitung: in der Kundenansicht „Kontingent: 40 h pro Monat“ mit „Ändern“ (ganze oder halbe
Stunden, 0,5 bis 744; leer = kein Kontingent). In der Kundenliste und in der Kundenansicht bei gesetztem Kontingent
„32 / 40 h“ mit Balken; ab 90 % markiert („Kontingent fast erreicht“), ab 100 % „Kontingent überschritten“.
Beim Öffnen von App und Web ein Hinweis, wenn im laufenden Monat ein sichtbarer Kunde neu die 90- oder die 100-%-Stufe
erreicht hat: einmal je Kunde, Monat und Stufe, mit „Ansehen“ (öffnet den Kunden) und „Schließen“. Mitarbeiter sehen
vom Kontingent nichts, weder Wert noch Stufe noch Hinweis. Keine Push-Nachricht, keine Mail.

### Auftrag

**A. Speicherung, append-only (037).** Neue Tabelle für Kontingent-Einstellungen: Betrieb, Kunde, Minuten (NULL =
entfernt), gesetzt am, gesetzt von (Mitgliedschaft, echte Rolle), Befehls-ID eindeutig je Betrieb. Nie ändern, nie
löschen; gültig ist je Monat die jüngste Einstellung bis zum Monatsende (Europe/Berlin), so dass alte Monate mit
dem damaligen Kontingent angezeigt werden. RLS und Mandantentrennung wie bei den übrigen Einrichtungstabellen.

**B. Wer darf setzen.** Administrator: jeder Kunde des Betriebs. Standortleitung: nur ein aktiver Kunde, dessen
aktuelle Standortbindung auf einen ihrer verwalteten Standorte zeigt; dafür die vorhandene
`has_current_nfc_setup_authority_v1(org, customer)` wiederverwenden, keine dritte Grenzfunktion. Mitarbeiter nie.
Grenze in SQL (RLS und SECURITY DEFINER), nicht nur in TypeScript. Idempotent über die Befehls-ID; gleiche ID mit
anderem Wert ist ein Konflikt. Eine Schreibroute mit Schutzklasse (T-053).

**C. Lesen.** Der Kundenleser (036) liefert für Administrator und Standortleitung je Kunde zusätzlich das für den
Monat gültige Kontingent in Sekunden und die Stufe (`none`, `ok`, `warning` ab 90 %, `exceeded` ab 100 %), vom
Server berechnet aus den gelieferten Arbeitssekunden, laufende Einträge eingeschlossen. Für Mitarbeiter fehlen
beide Felder in der Antwort vollständig. Neue Funktion oder `CREATE OR REPLACE` in 037, 036 bleibt unverändert.

**D. Hinweis beim Öffnen.** App: nach erfolgreicher Online-Anmeldung einmal den laufenden Monat laden; ist ein Kunde
auf `warning` oder `exceeded` und diese Kombination aus Kunde, Monat und Stufe auf diesem Gerät für diese
Mitgliedschaft noch nicht bestätigt, erscheint der Hinweis; „Schließen“ oder „Ansehen“ bestätigt sie lokal. Web
ebenso mit lokaler Speicherung im Browser und der Hinweisart `info` aus T-079. Ein Rollen- oder Kontowechsel zeigt
keine Hinweise der vorigen Sitzung.

**E. P3 aus T-086 mitnehmen.** `is_current_customer_creation_v1` in 037 per `CREATE OR REPLACE` auf
`customer.xmin = pg_catalog.xid(pg_current_xact_id())` umstellen (statt `::text::xid`); die T-062-Probe und
T086-Suite müssen grün bleiben.

### Tests

Mit PostgreSQL, Rot vor Grün für die Grenzen: (1) Administrator setzt, ändert, entfernt; (2) Standortleitung A setzt
für einen Kunden in A, nicht in B, nicht nach Entzug ihrer Zuweisung, nicht bei ausgeschalteten Standorten;
Mitarbeiter `forbidden`, auch direkt gegen RLS; (3) Befehls-ID: Wiederholung gleich, anderer Wert Konflikt;
(4) Kontingent je Monat: Änderung am 15.10. gilt ab Oktober, September behält den alten Wert; (5) Stufen exakt an den
Grenzen (89,99 %, 90 %, 100 %) mit laufendem Eintrag; (6) Mitarbeiterantwort enthält kein Kontingentfeld;
(7) Mandantentrennung. App und Web: Ändern, Balken, Stufen, Hinweis einmal je Kunde/Monat/Stufe, nicht nach
Kontowechsel, nie für Mitarbeiter. Lokal alle Suiten, die Migrationen anwenden oder nachspielen, App, Web,
Typechecks inklusive Tests.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse, kein App-Build. Keine Push-Nachricht, keine Mail, keine
Änderung an Kalender, Export oder der Stundenformel. Kein Löschen von Zeiten (T-088).

### Bericht

`.t085-review/` (report.md, tracked.diff, untracked.txt, Screenshots Web 360/390/1440 und App). Unabhängiges Review
mit Blick auf das Schreibrecht der Standortleitung und „Mitarbeiter sehen nichts“. Kein Commit vor `APPROVED`.
