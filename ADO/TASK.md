# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-032 · Die App bekommt das Raster — und eine spürbare Rückmeldung

**Für:** Codex · **Risiko:** keine Datenänderung, aber das Gefühl des Produkts
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** **D-031**, `UI_Leitlinien.md`, D-016, D-021

### Zuerst lesen

**`ADO/01_Architecture/UI_Leitlinien.md`**, besonders *Farb- und Gestaltungsraster*. Es gilt für
**alle** Oberflächen, nicht nur fürs Admin-Web.

Ein Unterschied bleibt: **Die App duzt** (D-021). Das Admin-Web siezt.

### Der Stand heute, gemessen

15 React-Native-Standardknöpfe. Feste **helle** Farbwerte im Quelltext (`#e7f6ed`, `#12372a`)
statt des Rasters. **Null Haptik, null Ton, null Animation** im gesamten Mobile-Quelltext.

Die App ist gebaut und geprüft — 1.298 Tests. Sie ist nur nicht gestaltet.

### Das Wichtigste zuerst: die Rückmeldung

**Wer ein Telefon an einen Tag hält, sieht den Bildschirm nicht.** Er sieht die Rückseite seines
Geräts. Jede noch so schöne Animation erreicht ihn nicht — ein Impuls und ein Ton schon.

Vier Ergebnisse, **mit geschlossenen Augen unterscheidbar**:

| Ergebnis | Rückmeldung |
|---|---|
| Arbeit begonnen | ein kräftiger kurzer Impuls, aufsteigender Ton |
| Arbeit beendet | zwei kurze Impulse, absteigender Ton |
| Pause begonnen oder beendet | weicher und gedämpfter — nicht dieselbe Wucht wie Arbeit |
| Hat nicht geklappt | deutlich anders: länger, unangenehmer, tiefer Ton |

**Ton nur, wenn das Gerät nicht stumm ist.** Eine Lehrkraft im Unterricht will keinen Klang.
Vibration immer, Ton nach Systemeinstellung.

**Keine Bestätigung zum Wegtippen.** Kein Dialog, kein „OK". Dranhalten, spüren, wegstecken.
Sobald eine Schaltfläche nötig wird, ist es kein *One Tap* mehr.

### Danach: das Aussehen

- Farben **ausschließlich** aus benannten Merkmalen. Kein Farbwert im Quelltext
- Die 15 Standardknöpfe durch eigene ersetzen, die dem Raster folgen
- Der Scanbildschirm bekommt die ruhige Bewegung aus dem Entwurf: ein atmender Kreis, der
  zeigt, dass die App bereit ist — für den Moment, in dem doch jemand hinschaut
- Sechs Zustände je Bedienelement, sichtbarer Tastaturfokus, Kontrast geprüft

**Bewegung hat einen Zweck.** Sie zeigt einen Zustand — bereit, arbeitet, fertig. Bewegung ohne
Aussage lenkt ab und kostet Batterie. Und wer *Reduzierte Bewegung* im System eingestellt hat,
bekommt keine.

### Nicht anfassen

- Jede fachliche Logik, `packages/core`, Backend, Migrationen
- Das Admin-Web
- Die Anzeige des eingebetteten Stands — sie bleibt, wo sie ist
- **Neue Funktionen.** Keine. Kein Bildschirm, den es nicht gibt
- iOS

### Prüfung — nachweisen, nicht behaupten

- **Vier unterscheidbare Rückmeldungen**, jede fest einem Ergebnis zugeordnet; ein Test weist
  nach, dass sie sich paarweise unterscheiden — nicht nur, dass es sie gibt
- Bei stummem Gerät kommt **kein** Ton, die Vibration aber schon
- Nach einem Scan erscheint **kein** Dialog und keine Schaltfläche, die weggetippt werden muss
- **Kein Farbwert außerhalb der Merkmalsdefinition**; ein Test weist es nach, wie im Admin-Web
- Kein React-Native-Standardknopf mehr in `screens/`
- Bei eingestellter *Reduzierter Bewegung* läuft keine Animation
- Kontrast geprüft; der Tastaturfokus ist sichtbar
- Alle 1.298 Mobile-Tests bleiben grün
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Halte dir die vier Rückmeldungen vor: Könntest du sie **ohne hinzusehen** auseinanderhalten?
> Insbesondere „Arbeit begonnen" gegen „hat nicht geklappt" — wenn die sich ähneln, ist die
> ganze Aufgabe wertlos, weil die Person doch wieder auf den Bildschirm schaut.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**. **Nicht committen** vor `APPROVED`; ein
Dokumentations-Commit vorab ist erlaubt.

---

## Danach

Gerätetest durch den Product Owner (T-018) · offener P1 aus T-028 · `T-030` iOS-Machbarkeit ·
`T-020` Freigabekette · siehe `ADO/PLAN.md`.
