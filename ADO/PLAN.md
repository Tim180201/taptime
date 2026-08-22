# TapTim.e — Plan bis zum ersten Kunden

> **One Tap. One Decision.** Jede Aufgabe unten muss diesem Ziel dienen.

**Kapazität:** ~4 h/Tag · **Team:** Tim (Product Owner) · Claude (Technical Lead) · Codex (Development)

---

## Das Prinzip: parallel über Rollen, nicht über Codex

Codex kann immer nur **eine** Aufgabe gleichzeitig bearbeiten. Echte Parallelität entsteht
dadurch, dass Tim und Claude an Dingen arbeiten, die keinen Code brauchen.

**Ziel:** Codex' Warteschlange ist nie leer — und Tim wartet nie auf Codex.

---

## Die Bahnen

### Bahn A — Recht und Datenschutz · *Tim + Claude + Anwalt* · **startet sofort**

Der längste Pol im Projekt und der einzige, der nicht von Arbeitszeit abhängt, sondern von
Kalenderzeit. Deshalb zuerst.

1. **Verarbeitungsverzeichnis** — leitet sich direkt aus den Migrationen ab. Wir wissen
   exakt, welche personenbezogenen Daten wo liegen. Claude erstellt den Entwurf.
2. **TOM** (technische und organisatorische Maßnahmen) — RLS-Mandantentrennung,
   Verschlüsselung, Zugriffsmodell, Backup. Entwurf aus `ARCHITECTURE.md`.
3. **AVV-Entwurf** (Auftragsverarbeitung) — für B2B zwingend.
4. **Datenschutzerklärung** für App, Admin-Web und Website.
5. **Fragen an den Anwalt** — mit rausgeben:
   - Muss TapTim.e **Pausen** erfassen, um in Deutschland als Arbeitszeiterfassung
     einsetzbar zu sein?
   - Welche **Aufbewahrungsfristen** gelten für Zeitdaten?
   - Reicht die vorhandene Korrektur-Historie als Nachweisführung?
   - Was muss ein Beschäftigter einsehen können?

**Ergebnis:** Paket beim Anwalt. Danach läuft die Uhr ohne uns. Die Pausen-Antwort füttert
direkt Bahn D.

---

### Bahn B — Betrieb · *Codex + Tim (Accounts)* · **startet sofort**

Der technische kritische Pfad. Ohne erreichbares Backend gibt es keinen Piloten.

1. Supabase-Projekt (EU-Region), Migrationen einspielen
2. `backend-api` als Container deployen, Umgebungsvariablen sauber trennen
3. `admin-web` als statisches Build ausliefern
4. **Healthcheck-Endpunkt** — ohne den weiß niemand, ob der Dienst lebt
5. **Backup einrichten und Restore einmal wirklich durchführen**

Punkt 5 ist der wichtigste im ganzen Plan. „Was passiert mit unseren Daten, wenn bei euch
etwas kaputtgeht?" ist die Frage, die jeder B2B-Käufer stellt. Ein getesteter Restore ist
mehr wert als jeder Testbericht.

---

### Bahn C — Store und Branding · *Tim + Codex* · **startet sofort**

1. **Package-ID festlegen** (z. B. `e.taptime.app`) — **nach dem ersten Play-Upload
   unwiderruflich.** Muss vor Schritt 3 stehen.
2. App-Name, Slug, Icon, Store-Texte
3. Play-Console-Konto (~25 € einmalig), `eas build --profile production`
4. Internal Testing Track, App auf Tims Gerät installieren

`eas.json` ist bereits vollständig konfiguriert. Das ist überwiegend Konten- und
Formulararbeit, keine Entwicklung.

---

### Bahn D — Produktlücken · *Claude + Codex* · **nach Entscheidung**

- **Pausen** — abhängig von Bahn A. Additiv gebaut: neuer WorkEvent-Typ, die Engine
  entscheidet. Der Nutzer bekommt **keine** zusätzliche Entscheidung (Prinzip 3).
- **Rolle `team_lead`** — nur wenn ein Pilotkunde danach fragt.
- Was der Smoke-Test und der Pilot als echte Fehler zutage fördern.

---

### Bahn E — UI-Politur · *Codex* · **ab Woche 4**

Erst polieren, was im Piloten wirklich weh getan hat. Nicht vorher raten.
Dazu Landing Page und Datenschutzseiten.

---

## Wochenraster

| Woche | Tim | Codex | Claude |
|---|---|---|---|
| **1** | Smoke-Test · Accounts anlegen · Anwaltspaket freigeben | Prozess-Reset · Bahn B1–B2 | Anwaltsentwürfe · Briefings |
| **2** | Package-ID entscheiden · Play-Konto | Bahn B3–B5 (Deploy, Backup, Restore) | Review · Bahn C vorbereiten |
| **3** | Store-Texte · Gerät einrichten | Bahn C (Branding, Release-Build) | Review · Pilot vorbereiten |
| **4** | **Pilotwoche — echte Nutzung** | Bugfixes aus dem Piloten | Triage · Priorisierung |
| **5–6** | Pilot-Feedback | Bahn E (UI dort, wo es weh tat) | Anwalts-Feedback einarbeiten |
| **7–10** | Preis, Angebot, erster Kunde | Restarbeiten | Verkaufsbereitschaft prüfen |

**≈ 6 Wochen bis pilotfähig · ≈ 10–12 Wochen bis verkaufsfähig.**

---

## Nach dem ersten Kunden — bewusst nicht jetzt

Controlling und Stundensätze, Self-Service-Onboarding, Abrechnung, iOS, Dashboards,
Design-System, erweiterte Rollenmatrix.

Die Architektur trägt das bereits (siehe `ARCHITECTURE.md`, Invarianten I1–I3). Ein Feld,
das heute niemand benutzt, ist Datenschutz-Ballast und Migrationsschuld.
