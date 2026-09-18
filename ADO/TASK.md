# Aktuelle Aufgabe

> **Stand 18.09.2026:** Produktion läuft auf `91441c8` (Deploy 17:0x Uhr, im ersten Anlauf;
> Migration 027 und 028 angewendet, zwei weitere Wiederherstellungen bewiesen). Die APK aus
> `91441c8` wird gebaut. Reihenfolge: **Geräteabnahme (D-044) → T-049 → Pilot Monat 1.**

## T-049 · Das Web, wie es gemeint ist — alle drei Rollen, eine Sprache

**Für:** Development · **Risiko:** Sitzungsvertrag des Webs, Rollenschale, Mandantengrenze
**Zeitbox:** fünf Sitzungen. **Grundlage:** D-060, D-059, D-062, D-031 (Farbrollen),
`ADO/01_Architecture/Web_Entwurf/` (README und 10 Bildschirme). Auftrag vom 18.09.2026.

### Befund (am Quelltext geprüft)

- **Ein Mitarbeiter kommt heute nicht ins Web.** `/v2/session` antwortet `401`, wenn die
  Verwaltungsautorität leer ist (`BackendHttpServer.ts:965`); der Coordinator wirft bei
  `availableSections.length === 0` eine Sackgasse (`AdminWebCoordinator.ts:1789`). Der
  Web-Sitzungstyp hat **kein Rollenfeld** (`AdminWebApiClient.ts:32`), und sein Parser weist
  zusätzliche Felder ab.
- Die T-059-Routen (`/v1/administration/managed-active-summary`,
  `/v1/administration/managed-person-time`) sind Verwaltungsrouten mit derselben Anmeldung wie
  alle Web-Aufrufe — **das Web kann sie unverändert rufen**; die Verträge liegen in
  `@taptime/administration-contract/managed-people`.
- „Meine Zeiten" und „Manuell" brauchen keine neue Route: `/v1/mobile/own-time/query`,
  `/v1/mobile/work-targets/query`, `/v1/lifecycle-events/manual` existieren, werden vom Web
  aber nie gerufen.
- Es gibt heute **keine Übersicht mit lebenden Zahlen** (nur „geladen"-Zähler), **keine
  Personenseite** und **keinen Kalender** im Web. `App.tsx` ist eine Datei mit 1.462 Zeilen;
  Navigation ist handgeschrieben (`navigation.ts`), Gestaltung sind CSS-Variablen in
  `styles.css` (D-031). Kein Router, kein `React.lazy`, ein einziges Bündel (bekannter P2).
- Prüfwerkzeug ist vorhanden: Vitest mit jsdom, Testing Library **und `axe-core`** — Rot-
  nachweise sind auf jeder Ebene verlangbar.

### Umsetzung, in dieser Reihenfolge

1. **Die Sitzung lernt die Rolle.** Migration 029 erweitert `read_administration_session_v2`
   additiv um `role` und um zwei Bereiche, die jede lebende Mitgliedschaft hat:
   `own_time` und `manual_capture`. `/v2/session` liefert sie; die Sackgasse entfällt, solange
   mindestens ein Bereich vorhanden ist. Ein Konto ganz ohne Mitgliedschaft bleibt abgewiesen.
   Nichts an bestehenden Bereichen ändert sich; `setup_available` und die Standortlogik aus
   027 bleiben, wie sie sind.
2. **Rollenschale und Leiste je Rolle** (`navigation.ts`, `App.tsx`): Mitarbeiter sieht
   *Meine Zeiten, Manuell*; Standortleitung *Übersicht, Beschäftigte, Prüfungen, Meine Zeiten,
   Manuell* im eigenen Standort; Administrator zusätzlich *Einrichtung* und *Lohnexport*.
   Jeder Bereich wird weiterhin bei jedem Befehl gegen die Sitzung geprüft, nicht nur beim
   Zeichnen.
3. **Übersicht (Entwurf 01/11)** mit Aktiv-Kachel aus `managed-active-summary`: „x / y gerade
   aktiv", Stand der **Serverzeit**, Umfang benannt (Betrieb oder Standort). Daneben offene
   Prüfungen und der laufende Monat. Keine Zahl ohne Herkunft; was der Server nicht liefert,
   wird weggelassen.
4. **Beschäftigte und Person (02/03)**: Liste mit Aktiv/Inaktiv, Zeile mit Initialen, Name,
   „seit hh:mm · Ziel"; Person öffnet Monatskalender und Tagesliste aus
   `managed-person-time`. **Die Kalenderlogik wird geteilt, nicht kopiert:** die reinen Helfer
   aus `apps/mobile/src/screens/ownTimeCalendar.ts` (`businessDay`, `monthDays`, `weekStart`,
   `rangeSummary`, `recordsForDay`, `intervalMilliseconds`, `formatHours`, `formatDuration`)
   ziehen nach `packages/core` (Berlin-Zone liegt dort schon, D-056); Handy und Web importieren
   dieselbe Datei. Kein Verhaltenswechsel — die Mobile-Tests bleiben unverändert grün.
5. **Prüfungen, Einrichtung, Lohnexport (05/06/07)** im neuen Kleid, dabei die alten Befunde
   abräumen: **ein** CSV-Knopf statt zwei (`App.tsx:883` und `:962`), Filter wirken sofort statt
   erst nach „Anwenden", Rollenwechsel nicht als Auswahlfeld in jeder Zeile, Prüfentscheidung
   (Freigeben/Korrigieren/Ablehnen) **in der Zeile** statt im getrennten Formular darunter.
6. **Mitarbeiter im Web (21/22)**: *Meine Zeiten* mit denselben Kalenderbausteinen wie Punkt 4;
   *Manuell* mit Zielwahl, Pause und einer Haupttaste über die vorhandenen Routen. Kein NFC im
   Web. Ein Mitarbeiter sieht ausschließlich sich selbst — der Server entscheidet das, das Web
   filtert nichts.
7. **Ein Bündel je Bereich.** Weil die Schale ohnehin neu geschnitten wird: die Ansichten über
   `React.lazy` trennen und den bekannten P2 damit schließen. Nachweis: nach `vite build` liegen
   mehrere Bündel vor, und der erste Aufruf lädt nicht alle.

### Grenzen

Kein neues Datenmodell, keine Änderung an Evidenz, Scan oder Offline (D-052/D-055). Keine
Tagesfreigabe (T-048, D-063), keine Pausenautomatik (T-050), kein Soll-Modell (T-051). Die
Rolle der Eingeladenen bleibt, was die Route kennt. Farben und Radien bleiben die Tokens aus
D-031; der Web-Entwurf benutzt genau sie.

### Verifikation und Abschluss

Rotnachweise, jeder zuerst rot: (a) Mitarbeiter meldet sich am Web an und sieht *Meine Zeiten*
und *Manuell* — heute eine Sackgasse; (b) Mitarbeiter ruft eine Verwaltungsroute → abgewiesen,
und die Leiste zeigt sie nicht; (c) Standortleitung sieht in Übersicht, Beschäftigte und
Person nur den eigenen Standort, ein zweiter Betrieb gar nichts; (d) Aktiv-Kachel stimmt mit
den laufenden Buchungen überein und nennt die Serverzeit; (e) Personenkalender an Monats- und
Zeitumstellungsgrenzen (Europe/Berlin) — dieselben Helfer wie am Handy, belegt durch den
gemeinsamen Import; (f) die fünf alten Befunde aus Punkt 5 sind weg, je ein Test; (g)
`vite build` erzeugt getrennte Bündel. Dazu **axe ohne Verstöße** auf jedem neuen Bildschirm
und Tastaturbedienbarkeit der Zeilenentscheidung. Suiten: Admin-Web, B3, B4, C3C/C3E1/C3E2,
C2, Mobile (wegen des Umzugs der Kalenderhelfer); Typecheck; Migration ab 001 und auf
befülltem 028. Unabhängiges Review (Schwerpunkt: Rollenschale, Standortgrenze, keine Zahl ohne
Herkunft), maximal zwei Runden. Umsetzung nicht vor Technical-Lead-APPROVED committen. Deploy
danach gemeinsam mit der Abnahme des Product Owners im Web.
