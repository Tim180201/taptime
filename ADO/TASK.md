# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-022 · Auslieferungsweg dokumentieren und absichern

**Für:** Codex · **Risiko:** Aussperrung aus der Produktion → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** T-017a ausgeliefert, Produktion auf `471b376`

### Der Anlass

Am 25.08. sollte eine geprüfte, grüne Version ausgeliefert werden. Der Befehl stand in
`DEPLOY.md`. Trotzdem ging es nicht — weil dort **nicht steht, auf welcher Maschine er läuft**.
Der Weg musste aus einer Shell-Historie rekonstruiert werden.

Das ist kein Schönheitsfehler. Es heißt: **Genau ein Chatfenster auf der Welt wusste, wie man
dieses Produkt ausliefert.** Chatfenster enden. Genau dagegen haben wir dieses Verzeichnis
gebaut, und ausgerechnet der Weg in die Produktion stand nicht darin.

### Ziel

**Jemand, der nur das Repository und den Passwortmanager hat, kommt auf den Server und liefert
aus.** Ohne Verlauf, ohne Nachfragen, ohne Raten.

Und: **Die Auslieferung läuft nicht mehr als direkter Root-Login.**

### Schritte

**1. `infrastructure/DEPLOY.md` vervollständigen**

Was heute fehlt und hineingehört:

- **Auf welcher Maschine** der Befehl läuft, und wie man dorthin kommt — vollständige
  Befehlszeile einschließlich `ssh`, nicht nur der Teil, der auf dem Server läuft
- **Wer** ausliefern darf und womit er sich ausweist
- **Was man erwartet zu sehen**, und wie lange es dauert. Ein Lauf, der minutenlang schweigt,
  weil Wiederherstellungsprobe und frische Sicherung davorhängen, sieht ohne diesen Satz aus
  wie ein Hänger — und wird abgebrochen
- **Wie man den Erfolg prüft:** `current`, Ledger-Eintrag, `external_health`
- **Was zu tun ist, wenn der Health-Gate zurückrollt** — und ausdrücklich: nicht von Hand
  nachhelfen

**2. `infrastructure/RESTORE.md` hat dieselbe Lücke**

Dort ist sie teurer. Die Anleitung beschreibt einen Menschen unter Druck, dessen Server weg ist
— und setzt stillschweigend voraus, dass er weiß, wie er auf eine Maschine kommt, die es nicht
mehr gibt. Ergänze den Zugangsweg **und** den Fall, dass der Rechner mit dem Schlüssel
ebenfalls weg ist.

**3. Weg vom Root-Login**

Ein eigener Benutzer für die Auslieferung, mit `sudo` **ausschließlich** für
`/usr/local/sbin/taptime-deploy`. Kein allgemeines `sudo`, keine Shell als root.

**Reihenfolge ist hier sicherheitskritisch, nicht Geschmackssache:**

1. Neuen Weg einrichten und **nachweisen**, dass eine echte Auslieferung darüber läuft
2. Erst danach den Root-Login einschränken
3. Vorher prüfen, dass die Hetzner-Konsole als Rückweg tatsächlich funktioniert

Eine Absicherung, die uns selbst aussperrt, ist keine Absicherung. Wenn du an irgendeiner
Stelle nicht sicher bist, ob der Rückweg steht: **anhalten und melden**, nicht weitermachen.

**4. Der Schlüssel liegt unverschlüsselt**

Melde den Befund und den Vorschlag. **Entscheide nicht selbst** und ändere nichts an Schlüsseln
auf dem Rechner des Product Owners — das ist seine Entscheidung, nicht deine.

### Vision-Check

Keine fachliche Logik, keine Migration, keine Oberfläche. Betrieb.

### Nicht anfassen

- Die Logik in `infrastructure/deploy`. Sie hat sich bei T-014 unter echten Bedingungen bewährt
- `apps/`, `packages/`, Migrationen
- Der laufende Betrieb. Produktion steht auf `471b376` und bleibt erreichbar
- Schlüsseldateien auf dem Entwicklungsrechner

### Prüfung — nachweisen, nicht behaupten

- Eine echte Auslieferung ist **über den neuen Weg** gelaufen; die Ausgabe steht im Bericht
- Der Nachweis, dass der Auslieferungsbenutzer **nichts anderes** darf: ein Versuch, eine
  andere Datei mit `sudo` auszuführen, wird abgelehnt
- Der Nachweis, dass ein falsches Argument weiterhin am Skript scheitert, nicht an der Berechtigung
- Der Rückweg über die Hetzner-Konsole ist geprüft, **bevor** der Root-Login eingeschränkt wurde
- `DEPLOY.md` und `RESTORE.md` nennen Host, Zugangsweg, Berechtigten und Prüfschritte
- Kein Geheimnis in argv, keines im Repository, keines im Bericht
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Angenommen, der Entwicklungsrechner ist weg und du hast nur dieses Repository und den
> Passwortmanager. Folge deiner eigenen Anleitung Schritt für Schritt und komm bis zu einer
> ausgelieferten Version. **Wo bleibst du stecken?** Nenne die Stellen, statt zu behaupten, die
> Anleitung sei vollständig.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-015` Standorte und Standortleitung (ADR-0022) · `T-020` Freigabekette (D-014) ·
`T-016` Löschkonzept · siehe `ADO/PLAN.md`.
