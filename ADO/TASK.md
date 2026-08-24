# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-009 · Menschen verwalten

**Für:** Codex · **Risiko:** Berechtigungen, Mandantengrenze, Migration → **unabhängiges Review verpflichtend**
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** T-008 abgeschlossen

### Der Zustand heute

Ein Kunde kann **niemanden aussperren**. Die Datenbank kann es — jede Policy prüft
`revoked_at IS NULL`, und es ist getestet. Es gibt nur keine Route, keinen Coordinator und keine
Oberfläche. Migration 014 hat das ungenutzte Schreibrecht folgerichtig sogar entzogen.

Dasselbe Loch zweimal daneben: Es gibt **keinen zweiten Administrator** — die entstehen
ausschließlich über die Betreiber-CLI. Und ein vergessenes Passwort führt aus der Anwendung
**nirgendwohin**.

Alle drei landen heute beim Betreiber, mit Datenbankrechten. Das ist kein B2B-Produkt.

### Ziel

**Ein Kunde verwaltet die Menschen in seinem Betrieb selbst — vollständig, ohne uns.**

Drei Fähigkeiten:

1. Zugang entziehen
2. Einen zweiten Administrator einsetzen
3. Passwort zurücksetzen

### Bauvorgabe aus D-013 — bitte zuerst lesen

`T-015` gibt dieselben Fähigkeiten der Standortleitung, beschränkt auf ihren Standort.

**Leite die Berechtigung deshalb aus Mitgliedschaft und Zuständigkeit ab, nicht aus der Rolle
allein.** Ein `role = 'administrator'` mitten in einer Bedingung ist die Stelle, an der T-015
alles noch einmal bauen müsste. Der Zuständigkeitsbereich ist heute „die ganze Organisation" —
er muss morgen „dieser Standort" sein können, ohne dass die Prüfung umgeschrieben wird.

### Die Falle — hier steckt die eigentliche Arbeit

Ein Beschäftigter kündigt. Auf seinem Telefon liegen **noch nicht übertragene Arbeitszeiten**
aus den letzten Tagen.

Sperrst du ihn naiv, wird der nächste Abgleich abgelehnt, das Gerät räumt seine Warteschlange —
und **echte, geleistete Arbeitszeit ist weg**. Genau der Fehler, den wir in T-010 behoben haben,
nur an anderer Stelle.

Umgekehrt darf ein Gesperrter selbstverständlich nicht weiterstempeln.

**Die Auflösung:** Der Zeitstempel des Geräts ist manipulierbar, taugt also nicht als Beweis.
Ereignisse einer entzogenen Mitgliedschaft werden deshalb **nicht angenommen und nicht
verworfen, sondern zu Prüfposten**. Ein Administrator sieht: „Dieses Gerät wollte nach dem
Entzug vier Ereignisse abgleichen" — und entscheidet.

Die Maschinerie dafür steht seit T-010. **Benutze sie, bau nichts daneben.**

### Invarianten

1. **Die letzte Administrator-Mitgliedschaft kann nicht entzogen und nicht herabgestuft
   werden.** Sonst sperrt sich ein Kunde selbst aus, und nur wir kommen wieder hinein — genau
   das Problem, das diese Aufgabe löst.
2. **Niemand entzieht sich selbst.** Auch nicht als Administrator.
3. **Ein Entzug wirkt sofort**, auch wenn das Zugangstoken noch gültig ist. Die Prüfung
   geschieht serverseitig bei jedem Zugriff, nicht beim Anmelden.
4. **Arbeitszeit geht niemals still verloren.** Siehe oben.
5. **Der Entzug löscht nichts.** Zeiten, Ereignisse und Historie des Ausgeschiedenen bleiben —
   das sind Geschäftsunterlagen. Löschen ist `T-016`.
6. **Jede dieser Handlungen ist ein Audit-Ereignis** mit Urheber, Zeitpunkt und Ziel.

### Schritte

**1. Zugang entziehen**

Route, Coordinator, Oberfläche unter *Beschäftigte*. Migration: das in 014 entzogene
Schreibrecht gezielt und minimal zurückgeben — nicht pauschal.

**2. Zweiter Administrator**

Zwei Wege, beide nötig: eine Einladung, die bereits die Rolle trägt, und die Höherstufung einer
bestehenden Mitgliedschaft. Beides mit Audit-Ereignis.

**3. Passwort zurücksetzen**

Supabase kann das; das Produkt bietet nur keinen Weg dorthin. „Passwort vergessen" im Admin-Web
**und** in der App.

Dazu gehört die **Site URL** in Supabase — sie steht noch auf dem Auslieferungswert, weshalb der
Einladungslink des Product Owner in Safari ins Leere lief. Ohne diese Einstellung geht auch die
Zurücksetzung ins Leere. Sag dem Product Owner genau, was er wo einträgt.

Die Missbrauchsbremse für diesen Weg ist `T-011`, nicht hier. Baue keine eigene.

### Vision-Check

Verwaltung, keine Erfassung. Der Beschäftigte merkt von alldem nichts — außer dass er sich nicht
mehr anmelden kann.

### Nicht anfassen

- `packages/core`, die Business Engine, die Entscheidungsreihenfolge
- Die Prüfungs-Maschinerie aus T-010 — benutzen, nicht erweitern, außer um den neuen Prüfgrund
- Löschen von Daten. Das ist T-016.

### Prüfung — nachweisen, nicht behaupten

- Ein Entzug wirkt beim **nächsten Zugriff**, nicht erst beim nächsten Anmelden — mit noch
  gültigem Token nachweisen
- Der Versuch, die **letzte** Administrator-Mitgliedschaft zu entziehen oder herabzustufen,
  wird abgewiesen
- Der Versuch, sich **selbst** zu entziehen, wird abgewiesen
- Ein Gerät mit vier nicht übertragenen Ereignissen erzeugt nach dem Entzug **vier Prüfposten**
  und **keinen** stillen Verlust
- Ein zweiter Administrator kann sich anmelden und alles tun, was der erste kann
- Ein Administrator einer **fremden** Organisation sieht und kann nichts davon
- Die Zurücksetzung führt zu einer funktionierenden Anmeldung — mit echtem Durchlauf
- Alle Handlungen erscheinen in `audit_events`
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Zeige die Stelle, an der die Berechtigung geprüft wird. Wie viel davon müsste `T-015` ändern,
> um sie auf einen Standort zu beschränken? Nenne Datei und Zeilen, statt zu behaupten, es sei
> vorbereitet.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-011` Ratenbegrenzung · `T-012` Pausen · `T-013` Export · `T-014` Zweite Umgebung ·
siehe `ADO/PLAN.md`.
