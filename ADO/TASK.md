# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-015d · Die Oberfläche zeigt den Standort

**Für:** Codex · **Risiko:** keine Berechtigungsentscheidung, aber die sichtbare Standortgrenze
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** T-015c (`1712b55`), **D-021**, **D-027**, **D-028**, `UI_Leitlinien.md`

### Zuerst lesen

**`ADO/01_Architecture/UI_Leitlinien.md`** — vollständig. Das Regelwerk gilt für jede
Oberflächenaufgabe und wird hier nicht wiederholt.

### Die Ausgangslage, gelesen statt vermutet

`/v2/session` liefert `locationsEnabled`, `availableSections` und `managementScope` — **und keine
Rolle.** Das ist bewusst so: Der Browser erfährt nicht, wer er ist, sondern nur, was offensteht.
Eine browserseitige Berechtigungsentscheidung ist damit nicht nur verboten, sondern unmöglich.

Im Admin-Web steht dem heute entgegen:

- `parseSession` erwartet **exakt** vier Felder und nur `administrator` oder `employee`
- `AdminWebCoordinator` lädt **alle vier** Projektionen ungefragt
- die Übersicht zeichnet Arbeitszeiten und Prüfungen **immer** als Kachel und macht aus einer
  Abweisung eine Kachel mit `0` und einem Wiederholen-Knopf (D-028)
- eine veraltete Rollenprüfung verhindert heute die Anmeldung einer Standortleitung überhaupt

### Ziel

**Eine Standortleitung meldet sich an und sieht ihren Standort — nichts, was sie nicht darf, und
keine Kachel, die beim Laden scheitert.**

### Umfang

**1 · Auf `/v2` wechseln**

Sitzung und Beschäftigtenprojektion. Der Parser bleibt **streng** — `exact` mit dem neuen
Feldsatz, nicht tolerant. Die veraltete Rollenprüfung entfällt: Wer **keinen** Bereich hat,
kommt nicht hinein; das ersetzt sie vollständig.

`/v1/session` bleibt vorerst bestehen. Es wird erst entfernt, wenn diese Fassung ausgeliefert und
in Betrieb bestätigt ist — nicht in dieser Aufgabe.

**2 · Die Navigation kommt aus `availableSections`**

Unverändert übernommen, nicht abgeleitet. Kein Rollenvergleich, keine Zuordnungstabelle im
Browser. Was nicht in der Liste steht, erscheint nicht — nicht ausgegraut, gar nicht.

**3 · Nur laden, was offensteht — nur zeichnen, was geladen wurde (D-028)**

Die Übersicht ist eine Zusammensetzung. Eine Kachel entsteht, wenn ihr Bereich offensteht.
Geschlossene Bereiche werden **nicht angefragt**. Keine Kachel mit `0` für etwas, das nie geladen
werden durfte.

**4 · Der Standort ist sichtbar und steht in der Adresse**

Wer mehrere Verwaltungsstandorte hat, muss erkennen, welchen er gerade sieht. Der Standort gehört
sichtbar in den Kopfbereich **und in die Adresse** — ein Link führt dorthin, ein Lesezeichen auch.

**5 · Listen benennen ihren Bezug**

Der Trefferzähler sagt, worauf er sich bezieht. Niemand darf eine Standortzahl für den Betrieb
halten.

**6 · Der leere Standort führt weiter**

Keine Beschäftigten am Standort ist der erstmalig leere Zustand aus dem Regelwerk und führt zur
Einladung. Kein Fehler, keine unerklärte Leere.

**7 · Ausgeschaltet bleibt unsichtbar**

Ist die Standort-Funktion aus, sieht die Oberfläche aus wie heute. Kein Standortwähler, kein
Bezug, keine Hinweise.

### Die Antwortgrenze prüfen

`readBoundedResponseText` begrenzt die Antwortgröße. Die Sitzung trägt jetzt eine **Liste von
Standorten mit Namen**. Prüfe, ob die Grenze für einen Betrieb mit vielen Standorten reicht, und
melde die Zahl, ab der sie nicht mehr reicht. Eine Sitzung, die wegen ihrer Größe als „nicht
verfügbar" gilt, wäre ein Fehler, den niemand versteht.

### Nicht anfassen

- **Jede Berechtigungsentscheidung.** Der Server hat sie getroffen; die Oberfläche stellt sie dar
- `packages/core`, Migrationen, Backend-Module
- Die Mobile-App
- `/v1/session` in seiner Antwortform
- Barrierefreiheit über den sichtbaren Tastaturfokus hinaus, CSP, Sitzungsdauer — das ist T-017
- **Neue Funktionen.** Keine

### Prüfung — nachweisen, nicht behaupten

- Ändert man **allein** `availableSections`, ändert sich die Seitenleiste entsprechend — ohne
  jede weitere Änderung. Dieser Nachweis belegt, dass nichts abgeleitet wird
- Ein geschlossener Bereich wird **nicht angefragt**; das ist an den ausgehenden Aufrufen
  nachzuweisen, nicht an der Darstellung
- Die Übersicht einer Standortleitung enthält **keine** Kachel für Arbeitszeiten und Prüfungen —
  weder gefüllt noch mit `0` noch als Fehler
- Der angezeigte Standort steht in der Adresse; ein Link darauf öffnet genau diesen Standort
- Jede standortbezogene Liste benennt ihren Bezug
- Ein leerer Standort zeigt den erstmalig leeren Zustand mit dem Weg zur Einladung
- Ein Aufruf mit **fremdem** Standort wird vom Server abgewiesen; die Oberfläche macht daraus
  einen wahren Satz — **kein** nacktes „nicht berechtigt", kein technischer Fehlercode
- Bei ausgeschalteter Standort-Funktion ist die Oberfläche unverändert; alle bestehenden
  Admin-Web-Tests bleiben grün
- Die Anwendung bleibt allein mit der Tastatur bedienbar, mit sichtbarem Fokus
- Der Grenzlauf aus T-025 bleibt grün; das Verhältnis wird in `ADO/STATUS.md` eingetragen
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Melde dich als Standortleitung an und versuche, an einen fremden Standort zu kommen — über die
> Adresse, einen Filter, ein Lesezeichen, den Zurück-Knopf. Der Server weist ab.
> **Beschreibe, was der Benutzer dabei sieht.** Ein „nicht berechtigt" ohne Erklärung ist kein
> Ergebnis, sondern ein zweiter Befund.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**, nicht als Testzahlen. Entfernte oder umgeschriebene
Tests **einzeln** benennen. **Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

**Ausliefern.** Danach `T-020` Freigabekette und Kennzeichnung der Selbstkorrektur (D-014,
**D-026**) · `T-016` Löschkonzept · `T-024` Geheimnisse rotieren · siehe `ADO/PLAN.md`.
