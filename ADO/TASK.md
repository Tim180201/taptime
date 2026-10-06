# Aktuelle Aufgabe

> **Stand 06.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-102 (Migrationen 043–047). T-098b wartet auf den
> PO am Mac (Brief: `git show 5071e6e:ADO/TASK.md`; Teil 2 liegt geprüft auf dem lokalen Branch `t098b-verify`).
> Bis dahin T-075 aus Pilotmonat 1. Ausgeliefert wird beim nächsten Deploy ein ausdrücklich genannter Stand.

## T-075 · Paket mit weicher Grenze (D-087)

**Für:** Development · **Risiko:** mittel (Migration, Betreiber-Rechte, Vertragsvariante) · **Zeitbox:** eine Sitzung.
`apps/backend-schema` (Migration 048), Betreiber- und Verwaltungs-Server, `apps/operator-web`, `apps/admin-web`,
`apps/mobile`, Verträge.

### Befund

Betriebe haben keine Paketgröße. Für die Rechnung zählt nach D-087 die höchste Zahl aktiver Zugänge im Monat; heute
kann das niemand ablesen.

### Auftrag

1. **Paketgröße (048):** je Betrieb eine ganze Zahl ab 1 oder leer (kein Paket, kein Hinweis). Der Betreiber setzt sie
   beim Anlegen und ändert sie mit Grund; beides steht im Betreiber-Protokoll wie Pausieren (D-075). Wer anlegt, ändert
   und entfernt, im Bericht benennen (AGENTS.md §1.5).
2. **Zählung:** Aktiv ist jede nicht entzogene Mitgliedschaft aller Rollen, auch mit noch nicht angenommener Einladung
   (eingeladen belegt den Platz; TL-Annahme, Einspruch des PO möglich). Höchstwert je Kalendermonat in Europe/Berlin.
   Aus der vorhandenen Historie (Anlage- und Entzugszeitpunkte) berechnen, wenn sie dafür reicht; sonst eine
   append-only Aufzeichnung. Die Wahl im Bericht begründen. Nichts wird gesperrt.
3. **Betreiber-Web:** je Betrieb Paket, aktuelle Zahl, Höchstwert im laufenden und im Vormonat; Markierung, wenn die
   aktuelle Zahl über dem Paket liegt. Paket beim Anlegen und „Paket ändern“ mit Grund. Nur Zählungen, keine Namen
   (D-068, D-074).
4. **Verwaltung (nur Administrator):** Web „Beschäftigte“ und App „Mitarbeiter“ zeigen über der Liste „12 Zugänge,
   Paket 10“, mit Hinweis, sobald die Zahl über dem Paket liegt. Beim Einladen, wenn die Einladung das Paket
   überschreitet, ein Hinweis im Formular; Einladen bleibt möglich.
5. **Verträge:** neue Felder nur über neue Vertragsvarianten; installierte Apps und ihre strengen Parser bleiben
   unverändert (wie T-102).

### Tests

Zählung über Einladen, Annehmen, Entzug, erneutes Einladen und Monatswechsel (Europe/Berlin, Zeitumstellung Oktober);
Höchstwert innerhalb des Monats, nicht nur am Monatsende. Rechte: der Betreiber sieht nur Zahlen, der Administrator nur
den eigenen Betrieb, die Standortleitung keinen Pakethinweis. Ändern ohne Grund wird abgewiesen, mit Grund protokolliert.
Alte Vertragsvarianten unverändert. Volle Suiten einschließlich Migrationsproben und Rechteinventar (048), Typechecks,
Layoutprüfung der geänderten Ansichten.

### Nicht Teil

Preise, Rechnungsstellung, Sperren oder Drosseln über dem Paket, Paketgröße durch den Kunden selbst.

### Bericht

`.t075-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
