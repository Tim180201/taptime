# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-028 · Der Auslieferungsweg trägt auch die Betriebsskripte

**Für:** Codex · **Risiko:** Auslieferungsweg, Sicherung, laufender Betrieb → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** **D-032**, D-030, T-026

### Der Anlass

Der erste Deploy nach T-026 brach in der Generalprobe ab. Die auf dem Server **installierte**
`taptime-restore-verify` erwartet `32/32` RLS-Tabellen; seit Migration 019 sind es `37`. Das
Repository ist seit T-015a richtig — die Datei kam nie dort an.

T-026 hat die Oberfläche in den Auslieferungsweg geholt. **Die Betriebsskripte fehlen weiterhin.**

### Ziel

**Was auf dem Server läuft, kommt aus einer versionierten Auslieferung.** Keine von Hand
installierte Datei bleibt Bestandteil des Produkts.

### Umfang

Diese Dateien gehören dazu — prüfe die Liste und ergänze, was du zusätzlich findest:

- `taptime-restore-verify`, `taptime-backup` und ihre systemd-Einheiten
- die Monitoring-Skripte und ihre Einheiten
- der Caddyfile
- `docker-compose.server.yml`

**Nicht** dazu gehören Geheimnisse und Konfiguration mit betriebseigenen Werten:
`/etc/taptime-backup/config`, die Passphrase-Datei, `/opt/taptime/.env`. Die bleiben, wo sie
sind, und werden nicht aus einem Abbild überschrieben.

### Die Reihenfolge, die zählt

Die Skripte werden **vor** der Generalprobe installiert — sonst läuft die Probe wieder gegen
einen alten Prüfer und die Aufgabe hätte nichts geändert.

Schlägt die Installation fehl, ist der Deploy fehlgeschlagen: keine Sicherung, keine Migration,
keine Aktivierung.

Eine Einheit, deren Datei sich geändert hat, wird neu eingelesen. Ein Caddyfile, der sich
geändert hat, wird geprüft **bevor** er übernommen wird — ein fehlerhafter Caddyfile nimmt die
gesamte Adresse vom Netz.

### Die eine Handarbeit, die bleibt

Das Deploy-Skript kann sich nicht selbst ausliefern. Es muss **einmal** von Hand ersetzt werden,
und der Root-Zugang über SSH ist seit T-022 gesperrt — also über die Hetzner-Konsole.

**Schreibe dafür eine Anleitung**, die der Product Owner ohne Rückfrage befolgen kann: die
genauen Befehle, in der genauen Reihenfolge, mit den **tatsächlichen** Pfaden — nachgesehen, nicht
vermutet. Die Konsole verwendet eine US-Tastaturbelegung; halte die Befehle kurz und ohne
Sonderzeichen, wo es geht.

Und schreibe dazu, **wie er merkt, dass es geklappt hat**, und was er tut, wenn nicht.

### Vision-Check

Kein Produktcode. Ohne diese Aufgabe altert der Server still weiter, und die nächste Überraschung
kommt zum ungünstigsten Zeitpunkt.

### Nicht anfassen

- `apps/`, `packages/`, Migrationen
- Die Entscheidungslogik der Generalprobe, der Sicherung und der Rücknahme
- Geheimnisse und betriebseigene Konfiguration
- Der eingeschränkte Deploy-Zugang aus T-022

### Prüfung — nachweisen, nicht behaupten

- Ein echter Deploy installiert die Skripte und läuft anschließend durch; die Ausgabe steht im
  Bericht
- **Der wichtigste Nachweis:** Wird absichtlich eine kaputte Skriptfassung ausgeliefert, schlägt
  der Deploy **vor** Sicherung und Migration fehl. Vorführen, nicht behaupten
- Ein absichtlich fehlerhafter Caddyfile wird abgewiesen, **ohne** die Adresse vom Netz zu nehmen
- Nach dem Deploy erwartet die installierte Wiederherstellungsprüfung `37/37`, und ein echter
  Lauf von `taptime-restore-verify` ist grün
- Geheimnisse und betriebseigene Konfiguration sind nach dem Deploy unverändert
- Die Anleitung für die einmalige Handarbeit ist vollständig, mit echten Pfaden
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Melde den Zustand der Sicherung: Wann lief die letzte erfolgreiche Sicherung, wann die letzte
> erfolgreiche Wiederherstellungsprüfung, und was steht in der Statusdatei? Seit dem letzten
> Deploy schlägt die Prüfung fehl — ich will wissen, wie lange und ob es jemand gemeldet hat.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**. **Nicht committen** vor `APPROVED`.

---

## Danach

Deploy von `3893611` · `T-027` Dunkles Gestaltungsraster (D-031) · `T-015e` (D-029) ·
`T-020` Freigabekette · siehe `ADO/PLAN.md`.
