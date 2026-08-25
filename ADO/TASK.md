# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-014 · Wiederholbar ausliefern

**Für:** Codex · **Risiko:** berührt die laufende Produktion → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** T-013 abgeschlossen

### Der Zustand heute

**Die Produktion baut aus dem Quellbaum.** `docker-compose.server.yml` benutzt `build:` für die
API. Was auf dem Server läuft, ist damit nicht reproduzierbar — derselbe Quellstand kann morgen
ein anderes Abbild ergeben, sobald sich eine Abhängigkeit bewegt.

**Es gibt kein Auslieferungsskript.** Jede Auslieferung ist Handarbeit über SSH. Bei T-006 und
T-008 hat das funktioniert, weil Codex jeden Schritt einzeln geprüft hat. Das skaliert nicht und
ist bei Nacht oder unter Druck nicht wiederholbar.

**Achtzehn Migrationen sind nie irgendwo gelaufen außer in CI und in der Produktion.** CI läuft
gegen eine leere Datenbank. Die Produktion ist das erste Mal, dass eine Migration echte Daten
sieht.

**Was bereits gut ist und nicht angefasst wird:** Jede Migration läuft in einer eigenen
Transaktion mit `ROLLBACK` im Fehlerfall. Eine halb eingespielte Migration kann es nicht geben.

### Ziel

**Eine Auslieferung ist ein Befehl, sie ist wiederholbar, und sie nimmt sich selbst zurück,
wenn sie schiefgeht.**

### Kein zweiter Server — die Probe kommt aus der Sicherung

Ein dauerhafter zweiter Server kostet Geld und pflegt sich nicht von selbst. Wir haben etwas
Besseres: **stündliche Sicherungen echter Produktionsdaten.**

Die Generalprobe läuft deshalb gegen eine **Wiederherstellung des letzten Standes**, nicht gegen
eine leere Datenbank. Das prüft genau das, was CI nicht prüfen kann — ob eine Migration mit
echten Daten durchläuft, und wie lange sie dabei braucht.

Die Maschinerie dafür steht seit `T-007`. **Benutze sie, bau nichts daneben.**

### Schritte

**1. Ein Abbild statt eines Bauvorgangs**

- Das Abbild der API wird **einmal in CI gebaut** und mit dem Commit-Kurzschlüssel versehen.
- Ablage in der GitHub Container Registry.
- `docker-compose.server.yml` benutzt `image:` mit fester Version. **Kein `build:` mehr auf dem
  Server.**
- Prüfe die Speichergrenzen des kostenlosen Tarifs und melde sie. Wenn es eng wird, sag es,
  statt es zu umgehen.

**2. Generalprobe vor jeder Auslieferung**

- Letzten Sicherungsstand in einen Wegwerf-Container einspielen.
- Die **ausstehenden** Migrationen dort einspielen. Dauer messen und melden.
- Schlägt die Probe fehl, bricht die Auslieferung ab — **bevor** die Produktion angefasst wird.
- Wegwerf-Container danach restlos entfernen.

**3. Ausliefern als ein Befehl**

Ein Skript im Repository, `infrastructure/deploy`, das der Reihe nach:

1. die Generalprobe fährt
2. die Sicherung anstößt und deren Erfolg abwartet
3. das Abbild der gewünschten Version holt
4. die Migrationen in der Produktion einspielt
5. den neuen Stand startet
6. die Gesundheit prüft
7. **bei Misserfolg auf die vorherige Version zurückgeht**

Jeder Schritt meldet, was er tut. Das Skript ist ohne Argumente **nicht** ausführbar — die
Version wird ausdrücklich genannt.

**4. Rücknahme, die wirklich funktioniert**

Die Rücknahme setzt das **Abbild** zurück, nicht das Schema. Migrationen sind vorwärtsgerichtet.

**Daraus folgt eine Regel, die du in `ADO/ARCHITECTURE.md` festhältst:** Eine Migration darf
nichts entfernen, was die vorherige Anwendungsversion noch braucht. Spalten werden erst
hinzugefügt, in einer späteren Auslieferung befüllt, und frühestens in einer übernächsten
entfernt. Sonst ist die Rücknahme unmöglich, und wir merken es im schlechtesten Moment.

**5. Aufschreiben**

`infrastructure/DEPLOY.md`, eine Seite: wie liefere ich aus, wie nehme ich zurück, was tue ich,
wenn die Probe fehlschlägt.

### Vision-Check

Keine fachliche Logik, keine Oberfläche. Betrieb.

### Nicht anfassen

- `packages/core`, jede Geschäftslogik
- Die Migrationen selbst
- Die Sicherungs- und Wiederherstellungsskripte aus T-007 — benutzen, nicht ändern

### Prüfung — nachweisen, nicht behaupten

- Eine **echte** Auslieferung des aktuellen Standes ist über das Skript gelaufen
- Eine **echte** Rücknahme auf die vorherige Version ist gelaufen; danach war das System gesund
- Eine absichtlich fehlerhafte Migration lässt die Generalprobe scheitern und die Produktion
  **unberührt** — mit echter Ausgabe
- Die Dauer der Migrationen gegen echte Daten steht im Bericht
- Das ausgelieferte Abbild trägt den Commit-Kurzschlüssel und ist wiederauffindbar
- Kein `build:` mehr in `docker-compose.server.yml`
- Kein Geheimnis in argv, keines im Abbild, keines im Bericht
- Nach echtem Serverneustart läuft alles wieder
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Angenommen, die Auslieferung bricht zwischen Schritt 4 und 5 ab — Migrationen sind drin, der
> neue Stand läuft nicht. Was passiert? Führe es vor, statt es zu beschreiben.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-015` Standorte und Standortleitung (ADR-0022) · `T-016` Löschkonzept · `T-017` Oberflächen ·
siehe `ADO/PLAN.md`.
