# T-122 · Verwaltung im Browser und App: Gestaltung mit zwei Themen (D-140)

**Stand:** 14.10.2026 · **Autor:** Claude (TL) · **Entschieden:** Tim (PO), D-140 · **Grundlage:** `UI_Leitlinien.md`,
D-021, D-125, D-135, D-136 · **Vorlage:** `web-entwurf.html` in diesem Ordner (Richtung A = dunkel, Richtung B = hell;
Richtung C ist verworfen, nur die Live-Zeile daraus ist optional). Löst den Entwurf vom 18.09.
(`../Web_Entwurf/`, D-058 bis D-060) in Aufbau und Farbe ab; die dortigen Bildschirme je Rolle bleiben als Vorlage für
Inhalte, die hier nicht gezeichnet sind.

Diese Datei sagt, **wie** die Oberfläche aussieht und sich anfühlt. Was eine Seite fachlich tut, bleibt wie heute;
T-122 ändert keine Regel, keinen Vertrag und keinen Serverweg. Weicht der Code von einer Annahme hier ab, wird das im
Bericht benannt, nicht stillschweigend umgangen.

---

## 1 · Grundsatz

**Die beste Oberfläche ist die, über die niemand nachdenkt** (UI_Leitlinien § 1). Daraus folgen vier Regeln, die auf
jeder Seite nachprüfbar sind:

1. **Eine Hauptaktion je Seite.** Genau ein gefüllter Knopf. Alles andere ist Umriss, Text oder Symbol.
2. **Farbe trägt Bedeutung, nicht Schmuck.** Lime heißt „läuft“ oder „jetzt“. Mint heißt „anklickbar“. Orange heißt
   „braucht Sie“. Rot heißt „Fehler“. Nichts anderes ist farbig.
3. **Zuerst, was gerade passiert.** Die Übersicht beginnt mit den laufenden Zeiten; Hinweise erscheinen nur, wenn es
   etwas zu tun gibt (K5 aus T-118b).
4. **Listen sind Tabellen.** Feste Spalten, Zahlen rechtsbündig in Tabellenziffern, 44 px je Zeile. Karten nur für
   einzelne Dinge (eine Kachel, ein Schritt), nie für Listen mit vielen Zeilen (D-021).

---

## 2 · Zwei Themen, ein Aufbau

Dunkel und hell sind **derselbe Aufbau mit zwei Farbsätzen**. Kein Element darf nur in einem Thema existieren;
Ausnahme ist der dunkle Kopfbalken im hellen Thema (§ 3.2).

### 2.1 Farbsätze

| Name | Dunkel (A) | Hell (B) | Verwendung |
|---|---|---|---|
| `ground` | `#0F1613` | `#F3F7F5` | Seitengrund |
| `surface` | `#151E1A` | `#FFFFFF` | Flächen: Kacheln, Karten, Tabellen, Seitenleiste (hell) |
| `surface-raised` | `#1B2622` | `#EAF1ED` | aktive Navigation, Auswahlfelder, Tabellenkopf |
| `line` | `#25332D` | `#D6E1DB` | Linien, Rahmen |
| `text` | `#EEF3F0` | `#101916` | Text |
| `text-muted` | `#97A59F` | `#5B6B64` | Nebentext, Beschriftungen |
| `accent` (Mint) | `#7EE0C0` | `#156F55` | Links, Fokus, aktive Navigation und Reiter, Markierungen „zugeordnet“, Balken „ok“ |
| `action` | `#C9F24D` (Lime) | `#156F55` (Mint tief) | die eine Hauptaktion je Seite |
| `on-action` | `#0E1512` | `#FFFFFF` | Text auf `action`, auf `notice` und auf `error`, wenn diese Fläche sind |
| `running` (Lime) | `#C9F24D` | `#9CC21A` | nur als Fläche: Punkt und Pille „läuft“; nie als Textfarbe, nie für den Kontingent-Balken |
| `on-running` | `#0E1512` | `#0E1512` | Text in der Pille „läuft“ |
| `notice` | `#E0A44C` | `#875506` | „braucht Sie“ als Text, Zahl und Punkt; Kontingent-Balken ab 90 % |
| `error` | `#FF8F8F` | `#AE3626` | Fehler als Text und Band; Kontingent-Balken ab 100 % |
| `band` | – | `#0E1512` | Kopfbalken im hellen Thema (Text `#EEF3F0`, Nebentext `#97A59F`) |

Alle Werte stehen als CSS-Variablen in `apps/admin-web/src/styles.css` (heute `--color-*`), `apps/operator-web` und
`apps/landing-web` nutzen dieselben Namen. Die hellen Werte für `accent`, `action`, `notice` und `error` wurden am
15.10. abgedunkelt, nachdem die erste Fassung die eigene Kontrastregel verfehlte (T-122a, STOPP).

**Kontrastregel, aus den Variablen nachgerechnet (AGENTS 1.6), je Thema:**

- Text auf Fläche, mindestens 4,5 : 1: `text`, `text-muted`, `accent`, `notice` und `error` auf `ground`, `surface`
  und `surface-raised`; `on-action` auf `action`, `notice` und `error`; `on-running` auf `running`; im Kopfbalken
  `#EEF3F0` und `#97A59F` auf `band`.
- Fläche ohne Text, mindestens 3 : 1 gegen die angrenzende Fläche: `accent` als Fokusrahmen und als Balkenfüllung,
  `notice` und `error` als Balkenfüllung, jeweils auf `surface` und `surface-raised`; Rahmen von Eingabefeldern und
  Umriss-Knöpfen in `text-muted`. `line` ist nur Trennlinie und hat keinen Kontrastanspruch.
- `running` ist nie Textfarbe und nie allein Bedeutungsträger: der Punkt steht immer neben dem Wort „läuft“ oder in
  der Pille, die das Wort trägt. Deshalb gilt für ihn keine eigene Grenze; Lime bleibt in beiden Themen Lime.
  Allgemein: Farbe trägt Bedeutung, aber nie allein; neben jeder Statusfarbe steht das Wort.
- Der Test liest die Werte aus den Variablen beider Themen und prüft genau diese Paare; eine feste Zahl in einem Test
  ist falsch.

### 2.2 Auswahl des Themas

- **Automatisch nach System** (`prefers-color-scheme`). Das ist die Vorgabe; niemand muss etwas einstellen.
- **Umschalter** im Konto-Block der Seitenleiste: drei Knöpfe „Hell · Dunkel · Automatisch“, der aktive ist gefüllt.
  Die Wahl liegt im Browser dieses Geräts (`localStorage`), nicht beim Server; sie gilt je Browser, nicht je Konto.
  Fehlt oder scheitert der Speicher, gilt Automatisch.
- Umschalten wechselt sofort, ohne Neuladen; das Dokument trägt `data-theme="light|dark"` oder nichts für
  Automatisch. `color-scheme` folgt dem Thema, damit Browser-Elemente (Scrollbalken, Auswahlfelder) passen.
- Betreiber-Bereich und Startseite: dieselben zwei Themen, derselbe Umschalter (Startseite: in der Fußzeile).

### 2.3 Schrift

Manrope wie heute, 400/600/800. Zahlen überall mit `font-variant-numeric: tabular-nums`. Für Spaltenköpfe,
Kleinbeschriftungen über Titeln („Eyebrow“) und Uhrzeiten in Kacheln die Monospace **JetBrains Mono** (liegt schon in
`apps/landing-web/public/tag-assets/fonts/`), selbst gehostet; CSP `font-src 'self'` bleibt.

---

## 3 · Gerüst

### 3.1 Seitenleiste (dunkel und hell)

- Breite 236 px, zwei Gruppen mit Gruppentitel in Monospace-Kapitälchen: **Arbeit** (Übersicht, Kunden, Mitarbeiter,
  Zeiten prüfen, Meine Zeiten, Manuell) und **Verwaltung** (Einrichtung, Lohnexport). Standortleitung und Mitarbeiter
  sehen nur, was sie heute sehen; die Gruppen bleiben.
- Jeder Eintrag: Symbol 16 px plus Wort. Symbole wie heute (Lucide); kein Eintrag ohne Symbol.
- Aktiver Eintrag: Fläche `surface-raised`, Text `accent`. Kein Balken, keine Unterstreichung.
- Oben das Zeichen (D-136, kompakt 28 px) mit „Taptura“ und darunter in Monospace „ZEIT. EINFACH. KLAR.“.
- Unten der **Konto-Block**: „Angemeldet für“, Betrieb fett, Name · Rolle, dann der Themen-Umschalter, dann „Abmelden“
  als Textknopf in `accent`.
- Schmal (unter 900 px): Seitenleiste wird zur oberen Leiste mit Menü-Knopf; die Gruppen bleiben als Abschnitte.

### 3.2 Kopfbalken (nur hell)

Im hellen Thema liegt über allem ein 56 px hoher Balken in `band`: links Zeichen und „Taptura“, dann der Betrieb hinter
einer feinen Trennlinie, rechts Name · Rolle und „Abmelden“. Der Konto-Block in der Seitenleiste entfällt dann bis auf
den Themen-Umschalter. Im dunklen Thema gibt es den Balken nicht; dort steht das alles in der Seitenleiste.

### 3.3 Seitenkopf (jede Seite)

Links: Betrieb als Eyebrow in `accent` (Monospace, Versalien, 11 px, Laufweite 0,1 em), darunter der Titel (26 px,
800), darunter eine Zeile Nebentext (Datum, Monat, Zählung). Rechts: die Aktionen in einer Zeile, höchstens drei: die
Hauptaktion gefüllt, davor höchstens ein Umriss-Knopf (z. B. Monat), ganz rechts der Symbol-Knopf **Aktualisieren**
(38 × 38 px, Umriss, Tooltip „Alle Bereiche aktualisieren“). Der heutige Lime-Knopf „Alle Bereiche aktualisieren“
entfällt auf allen Seiten.

Der Fokus nach einem Seitenwechsel liegt weiter auf dem Titel (Barrierefreiheit), aber **ohne sichtbaren Rahmen** bei
Maus und Touch (`:focus-visible` nur bei Tastatur). Der heutige Mint-Kasten um den Titel verschwindet.

### 3.4 Fußzeile

Eine Zeile am unteren Rand, Nebentext 11,5 px: links „Deutsche Ortszeit · Stand 14:03“, rechts „Version d193725“.
„Deutsche Ortszeit“ steht nirgends sonst mehr.

---

## 4 · Bausteine

| Baustein | Regel |
|---|---|
| **Knopf, Hauptaktion** | gefüllt `action`, Text `on-action`, 600, 13 px, Höhe 38 px, Radius 9 px. Genau einer je Seite. Beim Speichern wird derselbe Knopf gesperrt und zeigt „Wird gesichert …“; er springt nicht und bekommt keinen Nachbarn. |
| **Knopf, Nebenaktion** | Umriss `line`, Text `text`. Beliebig viele. |
| **Textknopf** | ohne Rahmen, Text `accent`, 600. Für „Weitere laden“, „Alle anzeigen“, „Abmelden“. |
| **Symbol-Knopf** | 38 × 38 px, Umriss, Symbol 16 px, Tooltip. Für Aktualisieren und Monat vor/zurück. |
| **Eingabefeld** | Höhe 38 px, Fläche `surface` (hell: weiß), Rahmen `line`, Radius 9 px, Platzhalter `text-muted`. Suchfelder mit Lupe links und Beschriftung „Suchen“ als `aria-label`; der sichtbare Text „Suchen“ über dem Feld entfällt, der Platzhalter sagt „Name eingeben“. |
| **Tabelle** | Kopfzeile Monospace 10,5 px Versalien `text-muted`, Linie darunter. Zeilen 44 px, Linie `line` zwischen den Zeilen, kein Zebra. Zahlen rechtsbündig, Tabellenziffern, Monospace. Erste Spalte beginnt mit 18 px Abstand. Unter der Tabelle „Weitere laden · 6 von 48“ als Textknopf. Schmal: erste Spalte fest, Rest scrollt seitlich (D-021). |
| **Kachel** | Fläche `surface`, Rahmen `line`, Radius 12 px, 16 × 18 px Innenabstand, Höhe 118 px. Beschriftung oben klein, Zahl 34 px Monospace 600, unten ein Textknopf mit Pfeil. Orange Zahl nur bei „braucht Sie“. |
| **Karte** | wie Kachel, mit Titel 15 px 800 links und Nebentext rechts in derselben Zeile. |
| **Pille** | 999 px Radius, 12 px, 600, Umriss `line`. `läuft`: gefüllt in `running`, Text in `on-running`. `Pause`: neutral. `prüfen` in `notice`, `überschritten` in `error`: Umriss, Text und Punkt davor in der Farbe. |
| **Chip** | wie Pille, aber mit „×“ zum Entfernen und ein gestrichelter Chip „+ Standort“ zum Hinzufügen. Aktive Chips in `accent`. |
| **Balken** | 120 × 6 px, Grund `surface-raised`, Füllung `accent`; ab 90 % `notice`, ab 100 % `error`. Daneben „11:00 / 12:00 h“ in Nebentext. |
| **Person** | 28-px-Kreis mit Initialen in Monospace, dann der Name. Überall gleich. |
| **Leerer Zustand** | gestrichelter Rahmen, ein Satz, dann die nächste Aktion als Textknopf: „Noch keine Kunden. Kunde anlegen“. Nie leere Fläche. |
| **Rückmeldung** | ein Band unter dem Seitenkopf (Erfolg in `accent`, Hinweis in `notice`, Fehler in `error`), mit Text und höchstens einem Textknopf („Erneut versuchen“). Es ersetzt nichts anderes und schiebt nur den Inhalt nach unten. |

---

## 5 · Seiten

### 5.1 Übersicht

Drei Kacheln nebeneinander: **Gerade aktiv** („7 / 12“, Textknopf „Aktivübersicht“), **Braucht Ihre Entscheidung**
(Zahl in `notice`, „Zeiten prüfen“), **Kontingent im Monat** („1 Warnung“, „Kunden“). Darunter zwei Spalten 1,5 : 1.
Links die Tabelle **Gerade aktiv** (Person, Standort, Kunde, seit, Pille) mit „3 weitere · Alle anzeigen“. Rechts
**Zu entscheiden** (Liste mit Person · Datum, Nebentext, Pille „prüfen“). Eine Karte **Heute** (Erfasste Stunden,
Manuell erfasst, Offline abgeglichen) gibt es **nicht**: dafür fehlt ein Leseweg, und T-122a erfindet keine Zahlen; wenn
der PO sie will, ist das eine eigene kleine Aufgabe mit Server. **Ihr nächster Schritt** erscheint nur mit sicherem
Treffer (K5) und dann als Karte über den Kacheln, nicht statt ihnen. Hauptaktion: keine; rechts nur Aktualisieren.

### 5.2 Kunden

Seitenkopf mit Monat-Umschalter (Umriss), **+ Kunde anlegen** (Hauptaktion) und Aktualisieren. Darunter Suchfeld (max.
420 px) und rechts daneben „48 Kunden, 3 mit Kontingent-Hinweis“. Tabelle: Kunde (fett; „· inaktiv“ als Nebentext),
Standort, Zugeordnet („2 Lehrer“ bzw. „2 Mitarbeiter“ nach D-125), Kontingent (Balken + Werte oder „kein Kontingent“),
Stunden (rechts), Pille. Klick auf die Zeile öffnet das Detail wie heute; das Detail bekommt denselben Seitenkopf mit
„Zur Kundenliste“ als Umriss-Knopf. **Kunde anlegen** öffnet das heutige Formular (Name, Standort) in einem Blatt
rechts; nach dem Speichern steht der Kunde oben. Das Anlegen in der Einrichtung entfällt.

### 5.3 Manuell

Zwei Schritte nebeneinander (1,1 : 0,9), schmal untereinander. **1 · Wofür?** Suchfeld, dann „Meine Kunden und
Projekte“ (nur bei Zuordnung, D-135, T-121 Teil 2), darunter „Weitere Kunden und Projekte über die Suche ·
Allgemeine Arbeitszeit“. Gewähltes Ziel mit Haken in `accent`. **2 · Starten** erscheint gefüllt erst mit gewähltem
Ziel: Zielname 20 px 800, Uhrzeit 28 px Monospace, Nebentext „Start jetzt · als manuell gekennzeichnet“, Hauptaktion
„Zeit starten“ über die volle Breite. Läuft eine Zeit, zeigt Schritt 2 „läuft seit 14:03“ mit **Zeit beenden**
(Hauptaktion) und **Pause** (Umriss); Schritt 1 ist dann gesperrt und grau. Rückmeldung nach § 4, nie ein zweiter
Knopf neben dem ersten. Darunter die Karte **Zuletzt manuell** (diese Woche). Rechts im Seitenkopf die Pille „Keine
Zeit läuft“ bzw. „läuft“.

### 5.4 Einrichtung

Seitenkopf, darunter Reiter **Standorte · Mitarbeiter · Kunden und Projekte · Karten** (Unterstreichung in `accent`).
Jeder Reiter beginnt mit genau einem Erklärsatz links (max. 70 Zeichen je Zeile) und dem Suchfeld rechts.

- **Mitarbeiter:** Tabelle Person · Rolle · Hauptstandort (Auswahlfeld) · Weitere Standorte (Chips) · Verwaltet (Chips,
  nur bei Standortleitung, sonst „–“; Administrator „alle“). Keine Wiederholung von Beschriftungen je Zeile, keine
  leeren Rahmen. Änderungen speichern sofort; die Zeile zeigt kurz „gespeichert“ als Nebentext.
- **Standorte:** Tabelle Standort · Mitarbeiter · Kunden · Zustand (Pille „aktiv“/„aus“), Hauptaktion „+ Standort“.
- **Kunden und Projekte:** Tabelle Name · Art · Standort (Auswahlfeld), Hauptaktion „+ Projekt“ (Kunden werden im
  Reiter Kunden angelegt).
- **Karten:** Tabelle Karte · Kunde · Zustand · Aktion („Zuordnung ändern“, „Entfernen“), Hauptaktion keine (Karten
  werden in der App eingerichtet; Hinweis als leerer Zustand).
- **Vor dem Einschalten** (nur solange der Standortmodus aus ist): eine Karte unter der Tabelle, links „2 von 3
  Prüfungen bestanden · Familie Özkan hat noch keinen Standort“ (Lücken verlinkt wie heute), rechts der Knopf
  „Standorte einschalten“ (Umriss, gesperrt bis alles grün).

### 5.5 Übrige Seiten (T-122b)

Mitarbeiter, Person, Zeiten prüfen, Meine Zeiten, Lohnexport, Zugänge, Betreiber-Bereich und Startseite übernehmen
Gerüst und Bausteine. Zeiten prüfen: eine Tabelle je Tag, die Entscheidung als Umriss-Knöpfe in der Zeile, der
gewählte als Hauptaktion. Lohnexport: Monat als Umriss, „CSV herunterladen“ als Hauptaktion.

---

## 6 · App (T-122b)

- Zwei Farbsätze in `apps/mobile/src/design/tokens.ts`: dunkel wie heute, hell nach § 2.1 (ohne `band`). Bildschirme
  lesen das Thema über einen Hook; keine festen Farben in Screens.
- Auswahl: automatisch nach System (`useColorScheme`), Umschalter „Hell · Dunkel · Automatisch“ in „Übertragung“
  unter dem Konto, gespeichert in `expo-secure-store` wie andere Einstellungen. Statusleiste folgt dem Thema.
- Das **Startbild bleibt dunkel** (nativ, D-136). Der Erfassen-Kreis ist im hellen Thema eine dunkle Scheibe (`band`),
  damit das Funkzeichen leuchtet; Lime bleibt „läuft“.
- Keine Änderung an Erfassung, Offline, Karten oder Texten.

---

## 7 · Abnahme

- Browser-Fotos **jeder** Seite in beiden Themen, bei 390 und 1440 px, normal und 200 % Schrift; kein Seitenüberlauf,
  axe ohne Befund, Kontrasttest grün. Die Fotos liegen in `.t122-review/screenshots/` nach dem Muster
  `<seite>-<thema>-<breite>-<schrift>.png`.
- Der PO vergleicht die Fotos mit `web-entwurf.html` und nimmt die Gestaltung ab, bevor der TL technisch abnimmt.
- App: beide Themen auf iPhone und Android, Erfassen, Manuell, Meine Zeiten und Übertragung.

---

## 8 · Durchgang „Standortleitung, 58, zum ersten Mal hier“

Prüfmaßstab aus UI_Leitlinien § 1: Weiß jemand, der zum ersten Mal hier ist, was er als Nächstes tun soll, und
versteht er jede Meldung ohne Hilfe? Der Durchgang über die heutigen Seiten (Stand `d193725`, Fotos der Browserläufe)
ergab die folgenden Änderungen. Sie gehören zu T-122a, soweit die Seite dort umgebaut wird, sonst zu T-122b.

### 9.1 Sprache, überall

- **Ein Wort für die Sache.** „Zeit“ für den Zeiteintrag („Zeit läuft“, „Zeit hinzufügen“, „Zeit ändern“, „Zeit
  löschen“), wie in der App. „Erfassung“ nur für die Berührung mit der Karte. „Arbeitszeit“ nur in Summen („38:20 h
  Arbeitszeit“). „Arbeitsziel“ erscheint nirgends mehr; es heißt „Kunde oder Projekt“, die Reiter heißen „Kunden und
  Projekte“.
- **Keine Technik im Satz.** Gestrichen werden: „vollständig geladen“, „Serverzeit“, „Aktivübersicht aktualisieren“,
  „Auslösende Erfassung“, „Entstehung“, „Nicht überliefert“, „Technische Kennung“ im Vordergrund, „Die Aktion wurde
  nicht abgeschlossen“. Zählungen stehen als Nebentext im Seitenkopf („12 Mitarbeiter · 7 aktiv“), ohne Nachsatz.
- **Meldungen sagen das Ding, nicht die Kategorie.** Kein Titel wie „Die Aktion wurde nicht abgeschlossen“; stattdessen
  direkt „E-Mail-Adresse oder Passwort stimmen nicht. Bitte prüfen Sie Ihre Eingaben.“ Jede Fehlermeldung nennt, was
  die Person jetzt tun kann.
- **Ein Titel je Seite.** Keine Karte wiederholt den Seitentitel („Mitarbeiter“ als Titel und darunter noch eine Karte
  „Mitarbeiter: Mitarbeiter und ihre Zugänge“). Der Erklärsatz steht einmal im Seitenkopf.
- **Orange nur für „braucht Sie“.** Knöpfe wie „Zeit löschen“ oder „Kunde löschen“ sind Umriss in `text-muted`, nicht
  orange; die Rückfrage danach ist orange. Orange Wörter wie „überschneidet sich“ stehen nie allein, sondern mit dem
  Bezug: „überschneidet sich mit 11:00–11:30“.

### 9.2 Anmeldung

- Überschrift „Taptura Verwaltung“, darunter „Melden Sie sich mit Ihrem Zugang an.“ Die Werbezeile „Einfach sauber
  eingerichtet.“ bleibt der Startseite vorbehalten.
- Knopf „Anmelden“ statt „Sicher anmelden“. Darunter „Passwort vergessen“ und ein Satz: „Noch keinen Zugang? Ihre
  Verwaltung lädt Sie per E-Mail ein.“
- Fehler direkt über dem Formular nach § 8.1, ohne Kategorie-Titel.

### 9.3 Übersicht der Standortleitung

- Statt des Auswahlfelds „Standort“ im Kopf steht bei genau einem Bereich der Bereich als Nebentext („Ihr Bereich:
  Nord · 12 Mitarbeiter“). Bei mehreren Bereichen ein Umriss-Knopf „Bereich: Nord ▾“ an derselben Stelle wie der
  Monat auf anderen Seiten.
- Dieselben Kacheln wie beim Administrator, auf den Bereich bezogen: Gerade aktiv „3 / 5“, Braucht Ihre Entscheidung,
  Kontingent. Darunter Gerade aktiv und Zu entscheiden.
- Der Eintrag **Zeiten prüfen** in der Seitenleiste trägt eine Zahl in `notice`, solange Fälle offen sind (Entwurf
  18.09.). So sieht sie ohne Klick, ob etwas auf sie wartet.

### 9.4 Mitarbeiter und Person

- Mitarbeiterliste: Seitenkopf mit Monat (Umriss) und „+ Mitarbeiter einladen“ (Hauptaktion, Administrator) bzw.
  ohne Hauptaktion (Standortleitung). Darunter Suchfeld und die Filter-Pillen „Alle · Zeit läuft · Keine Zeit“.
  Tabelle Person · Standort · Stunden im Monat · Status. Die Kachel „Gerade aktiv“ entfällt hier; sie steht auf der
  Übersicht.
- Person: Seitenkopf mit Name, darunter „Nord · Mitarbeiter · seit 03/2026“; rechts „Zeit hinzufügen“ als
  Hauptaktion. Kalender links wie heute. Rechts die Tagesliste als Tabelle: Von–Bis · Kunde · Dauer · Art (Karte,
  manuell, nachgetragen) · Zeichen für Hinweise. **Ändern und Löschen stehen in der Zeile** (Symbol-Knöpfe am
  Zeilenende), nicht unter der Liste; so ist klar, welche Zeit gemeint ist.
- Hinweise in der Zeile als Pille: „überschneidet sich mit 11:00–11:30“ in `notice`; Klick zeigt beide Zeiten.
- Verlauf einer Zeit („Geändert · 23.09., 12:00 · durch Verwaltung: Vergessenen Beginn berichtigt“) aufklappbar unter
  der Zeile, Überschrift „Verlauf“, nicht dauerhaft sichtbar.
- „Zeit hinzufügen“ und „Zeit ändern“ als Blatt rechts mit **einem** Zielwähler (Suchfeld mit Liste, „Meine“ bzw.
  „Zugeordnete“ oben, D-135), nicht Suche plus Auswahlfeld. Datum, Von, Bis; der Satz über den nächsten Tag erscheint
  erst, wenn „Bis“ vor „Von“ liegt: „Endet am 24.09.“ Pausen: Hinweis „Pause? Zwei Zeiten eintragen.“ nur bei Bedarf.
  Grund: Feld „Grund“ mit „(Pflicht)“ nur, wenn D-134 ihn verlangt.
- Rückfrage beim Löschen: „Zeit löschen? 23.09., 10:00–12:00, Werkstatt am Park.“ mit „Löschen“ in `notice` und
  „Abbrechen“.

### 9.5 Zeiten prüfen

- Seitenkopf: „Zeiten prüfen“, Nebentext „2 offene Fälle“. Reiter „Offen · Entschieden“.
- Jeder Fall ist eine Karte in Menschensprache: **Was ist passiert** („Alex Berger hat am 20.07. um 11:00 eine Zeit
  begonnen, aber kein Ende.“), **Was heute dort steht** (die Zeiten des Tages als kleine Tabelle, ohne Klick), ggf.
  **Vorschlag** („Ende 16:30, Ende des Standorttags“), dann drei Umriss-Knöpfe mit Ergebnis statt Vorgang: **Ende
  nachtragen · Zeit ändern · So lassen**. Der gewählte Knopf wird zur Hauptaktion, darunter öffnet sich nur das nötige
  Feld (Datum/Von/Bis bzw. Grund). Kein zweites Auswahlfeld „Entscheidung“, das den Knopf wiederholt.
- „Eine frühere Erfassung muss zuerst geprüft werden“ wird zu: „Zuerst den Fall vom 19.07. entscheiden“ mit Link.
- Formulierungen der Engine („Reihenfolge der Erfassungen“, „Auslösende Erfassung“) erscheinen nicht; wenn ein Fall
  keine klare Übersetzung hat, STOPP und TL fragen, nicht umschreiben.

### 9.6 Lohnexport

- Seitenkopf: „Lohnexport“, Nebentext „Oktober 2026 · 12 Mitarbeiter · 1 offener Fall“. Monat als Umriss-Knopf,
  Hauptaktion **„CSV herunterladen“**. Der Monat ist vorbelegt (laufender Monat), nie leer; der rollende 31-Tage-
  Zeitraum verschwindet aus der Oberfläche.
- Filter „Status“ und „Erfasst mit“ als Pillen unter dem Kopf; die Dateiwahl („Standard“ / „Kurz“) als Auswahlfeld
  neben der Hauptaktion, mit Beschriftung „Datei“.
- Tabelle Mitarbeiter · Kunde · Von–Bis · Dauer · Art · Status; Hinweise als Pille wie in § 8.4. Keine Spalten
  „Entstehung“ und „Änderungen“; der Verlauf liegt bei der Person.
- Das Formular „Abgeschlossene Arbeitszeit korrigieren“ verschwindet vom Lohnexport; Korrekturen laufen über die
  Person (§ 8.4). Offene Fälle sind in der Tabelle gekennzeichnet und verlinken zu Zeiten prüfen.

### 9.7 Einrichtung, zusätzlich zu § 5.4

- Standorte: Tabelle statt Textfeld je Standort; Umbenennen über ein Stift-Symbol in der Zeile, „Stilllegen“ als
  Textknopf in `text-muted` mit Rückfrage. „+ Standort“ als Hauptaktion.
- Karten: Tabelle Karte (Name) · Kunde („Pause“ bei Pausenkarten, „nicht zugeordnet“ in `text-muted`) · Aktionen.
  Keine Spalte „seit“: der Zuordnungsbeginn wird heute nicht geliefert, und T-122a ändert keine Verträge. Die
  technische Kennung steht nur im aufgeklappten Detail.
  „Zuordnung ändern“ öffnet ein Blatt mit genau einem Kundenwähler (Suchfeld mit Liste); „Entfernen“ mit Rückfrage
  nach D-137. Der heutige Block mit zwei Suchfeldern und zwei Auswahlfeldern entfällt.
- „Standorte verwenden“ heißt „Standorte einschalten“; die Rückfrage erklärt in einem Satz, was sich ändert.

### 9.8 Kunden, zusätzlich zu § 5.2

- Detail: „Zur Kundenliste“ als Umriss-Knopf im Seitenkopf; Stunden als Kachel („32:00 h · läuft“), daneben die
  Kachel Kontingent („kein Kontingent · Ändern“). „Umbenennen“ und „Löschen“ als Umriss-Knöpfe im Seitenkopf rechts
  der Hauptaktion; „Löschen“ fragt nach.
- Die Liste „Stunden je Person“ als Tabelle Person · Stunden · Status, mit „Weitere Personen laden“.

### 9.9 Hilfe

- Jede Seite erklärt sich im Nebentext des Seitenkopfs in einem Satz. Eine eigene Hilfeseite gibt es nicht.
- Unten in der Seitenleiste ein Textknopf „So funktioniert Taptura“ mit einem Blatt, das die fünf Begriffe erklärt:
  Erfassen mit Karte, Zeit, Pause, Zeiten prüfen, Kontingent. Je zwei Sätze, kein Bild.

---

## 9 · Schnitt

- **T-122a** (Web): § 2 bis § 4 vollständig, § 5.1 bis 5.4, dazu § 8.1 bis 8.3, 8.7, 8.8 und 8.9. Admin-Web zuerst;
  Betreiber-Bereich und Startseite nur Farbsätze und Umschalter.
- **T-122b** (App und Rest): § 6, § 5.5 mit § 8.4 bis 8.6, Betreiber-Bereich und Startseite vollständig.
- Nicht Teil von T-122: Server, Verträge, Fachregeln, neue Funktionen. Wortschatz nach UI_Leitlinien § 3 und D-125.
