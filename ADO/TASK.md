# Aktuelle Aufgabe

> **Stand 18.09.2026:** Produktion läuft auf `91441c8`; die APK (VersionCode 7, aus `b300b14`,
> App-Code gleich `91441c8`) ist vom Product Owner **am Gerät abgenommen — alle acht Punkte
> bestanden**, einschließlich „App geschlossen, Tag dranhalten, kein Auswahldialog" (T-043).
> Reihenfolge: **T-061 → T-049 → Pilot Monat 1.**

## T-061 · Feinschliff am Gerät — Rand, Symbole, Tap-Moment

**Für:** Development · **Risiko:** gering (nur `apps/mobile`), zwei neue native Abhängigkeiten
**Zeitbox:** zwei Sitzungen. **Grundlage:** Gerätetest vom 18.09., D-058, D-031,
`UI_Leitlinien.md` §13. Auftrag vom 18.09.2026.

### Befund des Product Owners am Gerät

1. Die Android-Systemleiste unten stört — sie steht als Fremdkörper unter unserer Reiterleiste.
2. Einige Symbole „sehen komisch zusammengebaut aus". Sie sind es auch: `design/LineIcon.tsx`
   setzt jedes Symbol aus `View`-Strichen und -Rechtecken zusammen.
3. Der Kreis beim Erfassen darf stärker und heller pulsieren. **Entschieden: Variante B**
   (größerer Ausschlag, schneller, mit Leuchten) — der Product Owner hat drei Varianten
   verglichen und B gewählt.

Anspruch des Product Owners für diese Aufgabe: **modern und futuristisch, aber professionell.**
Was das konkret heißt, steht in `UI_Leitlinien.md` §13; es gilt gegen Geschmack.

### Umsetzung

1. **Randlos zeichnen.** `react-native-safe-area-context` aufnehmen; die App zeichnet bis zum
   Rand, die Systemleisten sind durchsichtig und tragen unseren Grundton (Expo-Konfiguration
   `androidNavigationBar`/`androidStatusBar` plus `expo-status-bar` hell). Reiterleiste und
   Kopfzeile nehmen ihren Abstand aus den **Sicherheitsabständen des Geräts**, nicht aus festen
   Pixeln (heute `Platform.OS === 'ios' ? 24 : 12` und `paddingTop: 32/48` in
   `navigation/AppNavigator.tsx`). Die Systemleiste wird **nicht** versteckt — die Zurück-Geste
   bleibt.
2. **Echte Vektor-Symbole.** `react-native-svg` aufnehmen; `design/LineIcon.tsx` wird ein
   Satz echter Pfade (Strichstärke 1,75 px, runde Enden und Ecken, 24 px Raster, `currentColor`).
   Vorlage sind die Umrisse einer freien Linien-Familie (Lucide, ISC-Lizenz) — Herkunft und
   Lizenz im Dateikopf nennen. **Keine zusammengesetzten `View`-Striche mehr**, auch nicht als
   Rückfall. Symbole: Erfassen, Manuell, Meine Zeiten, Mitarbeiter, Tags, Zurück, Haken,
   Wartend, Person, Pfeil.
3. **Tap-Moment, Variante B.** `design/ScanRing.tsx`: Ausschlag 0,94 → 1,10, Takt ~2,0 s,
   Leuchten am Scheitel (Rand heller, weicher Schein in Akzentfarbe), zwei Wellen mit ~650 ms
   Versatz, Wellenrand kräftiger. **Unverändert:** bei „Bewegung reduzieren" steht alles still;
   der Erfolgsmoment bleibt der stärkere Moment — er wechselt die Farbe und zeigt den Haken.
4. **Durchgang durch alle Bildschirme.** Jeden der Bildschirme gegen §13 prüfen und Abweichungen
   beheben: Seitenabstand 20 px, Kartenabstand 16 px, Innenabstand 12 px, Titel 22/800,
   Abschnitt 15/800, Fließtext 15, gedämpft 13, Zahlen tabellarisch. Abweichungen, die bleiben,
   im Bericht mit Grund nennen.
5. **Grenzen:** nur `apps/mobile`; kein Backend, keine Migration, keine Vertragsänderung, keine
   neuen Funktionen, keine Farbänderung an den Tokens. Der Erfassen-Bildschirm behält seine
   Logik unverändert (D-052/D-055).

### Verifikation und Abschluss

Rotnachweise: (a) kein Symbol wird mehr aus `View`-Strichen gebaut — Test über die Quelle von
`design/`, der heute fehlschlägt; (b) Reiterleiste und Kopfzeile lesen Sicherheitsabstände statt
fester Pixel; (c) `ScanRing` trägt die Werte der Variante B und bleibt bei reduzierter Bewegung
still; (d) die bestehenden Farb- und Kontrastprüfungen (`mobileRaster`, `contrastRatio`) bleiben
grün und werden um die neuen Symbolfarben erweitert. Typecheck und volle Mobile-Suite.
`npx expo prebuild --platform android --no-install` in einem Wegwerfverzeichnis, um die beiden
nativen Abhängigkeiten zu belegen; kein `android/` im Repository. Unabhängiges Review
(Schwerpunkt: keine Logikänderung am Erfassen, reduzierte Bewegung, Lizenzvermerk). Umsetzung
nicht vor Technical-Lead-APPROVED committen. **Abnahme durch den Product Owner am Gerät mit
einer neuen APK** — diese Aufgabe ist erst damit fertig.

---

## Danach

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
