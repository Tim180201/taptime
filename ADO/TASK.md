# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-017a · Grundpolitur der Oberfläche

**Für:** Codex · **Risiko:** keine Datenänderung, aber der erste Eindruck beim Pilotkunden → unabhängiges Review
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** T-014 abgeschlossen, **D-021**

### Zuerst lesen

**`ADO/01_Architecture/UI_Leitlinien.md`** — vollständig, bevor du eine Zeile änderst.

Das Regelwerk ist verbindlich und gilt ab jetzt für **jede** Oberflächenaufgabe, nicht nur für
diese. Abweichungen sind erlaubt, aber im Bericht zu begründen. Was dort steht, wird hier nicht
wiederholt.

### Warum vorgezogen

Der Pilot-Inhaber macht bald einen Trockenlauf. Sitzt er dabei vor leeren Listen und
Fehlercodes, redet er über die Oberfläche — statt über seinen Monatsabschluss und das, was ihn
an seinem heutigen Werkzeug stört. Das wäre das teuerste Missverständnis im Projekt.

### Umfang — fünf Dinge, mehr nicht

**1 · Navigation**

- Seitenleiste statt Reiter oben. Fünf Bereiche sind die Grenze, mit Standorten werden es mehr.
- **Echte Adressen**, kein `#hash`. Vor und Zurück funktionieren, ein Link führt dahin, wo er
  hinführt, ein Lesezeichen auch. Filter und Zeitraum gehören in die Adresse.

**2 · Leere Zustände — drei Arten**

Erstmalig leer führt hin. Durch Filter leer bietet Zurücksetzen. Ein Fehler wird **nie** als
leerer Zustand getarnt. Einzelheiten im Regelwerk.

Der erstmalig leere Zustand der Übersicht ist der wichtigste Bildschirm dieser Aufgabe — er ist
das Erste, was ein neuer Kunde sieht.

**3 · Ladezustände**

Nach den Schwellenwerten im Regelwerk. Unter einer Sekunde passiert nichts — eine Anzeige würde
nur flackern und den Eindruck verschlechtern.

**4 · Fehlermeldungen**

Jede Meldung, die ein Mensch sehen kann, wird übersetzt: was ist passiert, warum, was kann ich
tun. Kein nackter Fehlercode. Kein Toast für Fehler.

**Geh die Fehlerfälle systematisch durch**, nicht nur die offensichtlichen. Liste im Bericht auf,
welche du gefunden und wie du jeden formuliert hast.

**5 · Tabellen**

Kopfzeile bleibt stehen, erste Spalte wird eingefroren. **Keine Kartenansicht auf schmalen
Bildschirmen.** Filter als Chips mit Trefferzahl und Zurücksetzen.

### Wortschatz — überall angleichen

Der verbindliche Wortschatz steht im Regelwerk. Besonders: **Betrieb** statt Organisation,
**Beschäftigte** statt Mitarbeiter, **Arbeitsziel** als Oberbegriff, **gescannt** und **manuell
erfasst** als Erfassungsarten.

**Das Admin-Web siezt** (D-021). Es spricht heute niemanden an — jede neue Formulierung siezt.
Die App bleibt unverändert beim Duzen.

### Nicht anfassen

- Jede Geschäftslogik, `packages/core`, alle Backend-Module
- Die Mobile-App. Diese Aufgabe betrifft ausschließlich `apps/admin-web`.
- Der Zuschnitt auf die Standortleitung — das ist T-015
- Barrierefreiheit, Content-Security-Policy, Sitzungsdauer — das ist T-017
- **Neue Funktionen.** Keine. Diese Aufgabe macht Vorhandenes benutzbar.

### Prüfung — nachweisen, nicht behaupten

- Jeder der fünf Bereiche ist über eine **echte Adresse** erreichbar; Vor und Zurück
  funktionieren; ein Link auf einen gefilterten Monat öffnet genau diesen
- Alle drei Arten leerer Zustände existieren und unterscheiden sich sichtbar
- Ein künstlich verzögerter Abruf zeigt **unter** einer Sekunde nichts und **darüber** ein
  Skeleton
- Kein technischer Fehlercode erreicht mehr den Bildschirm — die gefundenen Fälle sind einzeln
  aufgelistet
- Kein Toast für einen Fehler
- Die Namensspalte bleibt beim seitlichen Scrollen stehen
- Jedes Bedienelement hat die sechs Zustände aus dem Regelwerk, **einschließlich sichtbarem
  Tastaturfokus**
- Der Wortschatz ist durchgängig; „Organisation" und „Mitarbeiter" kommen in der Oberfläche
  nicht mehr vor
- Die Anwendung ist mit der Tastatur allein bedienbar
- Alle bestehenden Admin-Web-Tests bleiben grün
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Öffne die Anwendung mit einem frisch eingerichteten, leeren Betrieb und arbeite dich ohne
> Vorwissen bis zum ersten angelegten Arbeitsziel durch. Wo hast du gestockt? Nenne die Stellen,
> statt zu behaupten, es sei selbsterklärend.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-015` Standorte und Standortleitung (ADR-0022) · `T-016` Löschkonzept · `T-017` Feinschliff ·
siehe `ADO/PLAN.md`.
