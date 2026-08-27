# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-026 · Die Oberfläche wird mit ausgeliefert — und der Nachweis beweist es

**Für:** Codex · **Risiko:** Auslieferungsweg, laufender Betrieb → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** **D-030**, T-022, `infrastructure/DEPLOY.md`

### Der Befund

`infrastructure/deploy` liefert nur das Backend-Abbild aus. Caddy bedient das Admin-Web aus
`/opt/taptime/admin-web` — einem Verzeichnis, das **niemand im Repository beschreibt**. Dort
liegt ein von Hand kopierter Stand aus T-006.

**T-017a und T-015d sind nie in Produktion angekommen**, und der Gesundheitstest hat es nicht
bemerkt, weil er nur prüft, ob etwas antwortet.

### Ziel

**Eine Version ist eine Version.** Ein Commit-Kurzschlüssel liefert Backend **und** Oberfläche
aus, und der Gesundheitstest **beweist**, dass beides in der erwarteten Version läuft.

### Schritte

**1. Die Oberfläche wird gebaut wie das Backend**

Ein unveränderliches Abbild, in derselben CI erzeugt, mit **demselben** siebenstelligen
Commit-Kurzschlüssel als Marke. Kein `latest`, kein Bauen auf dem Server, kein Kopieren von Hand.

**2. Der Deploy legt sie ab — unteilbar**

Der Inhalt wird zuerst vollständig danebengelegt und dann **in einem Zug** umgeschaltet. Es darf
keinen Moment geben, in dem halb alte und halb neue Dateien nebeneinanderliegen: Ein Browser, der
genau dann lädt, bekommt sonst eine `index.html`, die auf Bausteine zeigt, die es nicht mehr gibt.

Der vorhandene `status`-Ordner unter `/opt/taptime/admin-web` **überlebt die Umschaltung** — dort
liegen Sicherungsstatus und Versions-Schutzsatz.

**3. Die Version wird von außen prüfbar**

Die ausgelieferte Oberfläche trägt ihren Commit-Kurzschlüssel so, dass er **ohne Anmeldung**
abfragbar ist. Halte es einfach.

**4. Das Gesundheitstor prüft beide Hälften**

`wait_for_health` prüft heute Containergesundheit und die externe Adresse. Es prüft künftig
zusätzlich, dass die **ausgelieferte Oberfläche die erwartete Version meldet.** Stimmt sie nicht,
ist der Deploy fehlgeschlagen und wird zurückgenommen — wie jeder andere Fehlschlag auch.

Das ist der eigentliche Kern dieser Aufgabe. Ein Tor, das nur fragt „antwortet etwas?", hätte
diesen Fehler nie gefunden.

**5. Die Rücknahme nimmt beides zurück**

Ein Rollback auf eine frühere Version stellt **auch** die frühere Oberfläche wieder her. Eine
Rücknahme, die nur das Backend zurückdreht, erzeugt einen Mischstand — schlimmer als der Fehler,
den sie beheben soll.

**6. `DEPLOY.md` und `RESTORE.md` nachziehen**

Beide beschreiben heute einen Weg, der die Oberfläche nicht kennt. `RESTORE.md` muss außerdem
sagen, wie die Oberfläche auf einem Ersatzserver wieder dorthin kommt.

### Vision-Check

Kein Produktcode. Aber ohne diese Aufgabe kann der Pilotkunde nichts von dem sehen, was wir
gebaut haben.

### Nicht anfassen

- `apps/`, `packages/`, Migrationen — **keine** Produktänderung
- Die Entscheidungslogik von `infrastructure/deploy`: Generalprobe, Sicherung, Migration,
  Rücknahme bleiben unverändert in Ablauf und Reihenfolge
- Der `status`-Ordner und sein Inhalt
- Der eingeschränkte Deploy-Zugang aus T-022

### Prüfung — nachweisen, nicht behaupten

- Ein echter Deploy liefert Backend und Oberfläche gemeinsam aus; die Ausgabe steht im Bericht
- **Der wichtigste Nachweis:** Wird absichtlich eine falsche Oberflächenversion abgelegt, schlägt
  das Gesundheitstor fehl und der Deploy wird zurückgenommen. Vorführen, nicht behaupten
- Ein echter Rollback stellt die **vorherige** Oberfläche wieder her — nachgewiesen an der von
  außen abgefragten Version
- Während der Umschaltung liefert die Adresse zu **keinem** Zeitpunkt einen gemischten Stand
- Der `status`-Ordner ist nach dem Deploy unverändert vorhanden
- Nach dem Deploy meldet die Oberfläche `28dcac6` oder neuer, und der Text
  „Bereich derzeit nicht verfügbar" kommt nicht mehr vor
- `DEPLOY.md` und `RESTORE.md` beschreiben den vollständigen Weg
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Nenne jeden weiteren Bestandteil des laufenden Produkts, den der Auslieferungsweg **nicht**
> mitnimmt — Konfiguration, Caddyfile, systemd-Dateien, Sicherungsskripte. Für jeden eine Zeile:
> wie kommt er heute auf den Server, und was passiert, wenn er veraltet? Suche danach, statt es
> auszuschließen.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**. Entfernte oder umgeschriebene Tests **einzeln**
benennen. **Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-015e` Standorte auswählbar machen (D-029) · `T-020` Freigabekette (D-014, D-026) ·
`T-016` Löschkonzept · siehe `ADO/PLAN.md`.
