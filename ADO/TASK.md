# Aktuelle Aufgabe

> **Stand 15.10.2026:** Deploy 6 abgeschlossen (`d193725` → `fb28166`, Migrationen 058 und 059). T-024 Teil A
> abgeschlossen (`7e36c58`). Jetzt **T-122c** aus der Web-Abnahme des PO nach Deploy 6, danach T-126 (Name ändern,
> Brief folgt); dann Deploy 7 (T-024a, T-122c, T-126) mit neuem Deploy-Schlüssel und T-024 Teil B an der Konsole (PO,
> TL begleitet; Runbook in `infrastructure/DEPLOY.md`).

## T-122c · Kopfbalken in beiden Themen, fest oben; ein Monatsschalter (D-140)

**Für:** Development · **Risiko:** niedrig bis mittel (nur Verwaltung im Browser, keine Daten; berührt jede Seite mit Monat) · **Zeitbox:** eine Sitzung.

### Warum

Web-Abnahme des PO nach Deploy 6 (15.10.): Hell und Dunkel haben verschiedenen Aufbau. Der Kopfbalken mit Betrieb,
Name · Rolle und „Abmelden“ steht nur im hellen Thema; im dunklen liegt dasselbe als Zeichen und Konto-Block in der
Seitenleiste. Das widerspricht D-140 (ein Aufbau, zwei Farbsätze); die Ausnahme stand im Entwurf (TL), die Umsetzung
folgte ihm. Zweitens scrollt der Balken mit, während die Seitenleiste fest 56 px tiefer bleibt: Beim Scrollen entsteht
oben links eine Lücke, durch die der Inhalt läuft. Dazu zwei Kleinigkeiten aus denselben Fotos: „Administrator ·
Administrator“ im Balken und der Betrieb doppelt (Balken und Eyebrow über jedem Titel). Der Entwurf ist angepasst:
`ADO/01_Architecture/Web_Entwurf_v2/README.md` § 2, § 2.1, § 2.2, § 3.1 bis § 3.3 und § 3.5.

Drittens (P1, vom TL nachgestellt): Im Lohnexport wird die Seite leer, sobald man im Monatsfeld etwas ändert.
`<input type="month">` meldet beim Tippen Zwischenwerte wie `0002-10` (Chromium) oder ist in manchen Browsern ein Textfeld;
`navigate` übernimmt jeden nicht leeren Wert, `monthTimeWindow(month)!` ist dann `null`, das Rendern wirft
(„Cannot read properties of null (reading 'fromInclusive')“), und ohne Fehlergrenze verschwindet die ganze Verwaltung.
Jeder Pfeil im Feld lädt außerdem sofort neu. Dazu gibt es heute drei verschiedene Monatswähler (Monatsfeld in
Lohnexport und Zeiten prüfen, Auswahlliste in Mitarbeiter und Kunden, ←/→ im Kalender). PO-Entscheidung 15.10.: ein
Monatsschalter überall, Lohnexport startet mit dem Vormonat (README § 4 „Monatsschalter“, § 8.6).

### Umfang

1. **Ein Aufbau in Hell, Dunkel und Automatisch (ab 1024 px).** Der Kopfbalken steht in jedem Thema, an derselben
   Stelle, mit demselben Inhalt. Alle themenabhängigen Regeln für die Sichtbarkeit von Balken, Seitenleisten-Zeichen,
   Konto-Block und `--band-height` entfallen (heute in `apps/admin-web/src/styles.css` etwa Zeile 692–716 und
   878–879). Die Seitenleiste zeigt in jedem Thema nur die Navigation und unten den Themen-Umschalter und „So
   funktioniert Taptura“; kein Zeichen, kein Konto-Block, kein „Abmelden“. Das Blatt „Mehr“ unter 1024 px behält
   Konto-Block und „Abmelden“, weil es dort keinen Balken gibt.
2. **Farbe des Balkens je Thema, nur über Variablen.** Hell wie heute: `band` `#0E1512`, ohne Linie. Dunkel: `band`
   ist `surface` (`#151E1A`), darunter eine 1-px-Linie in `line` (`#25332D`); der heutige dunkle Wert `#0E1512` wäre
   auf `ground` (`#0F1613`) unsichtbar. Dafür eine Variable `--color-band-line` (hell gleich `band`, dunkel gleich
   `line`) in allen drei Themenblöcken. Die Kontrastpaare `band-text` und `band-text-muted` auf `band` prüft der
   bestehende Kontrasttest in beiden Themen aus den Variablen (dunkel rechnerisch 15,2 und 6,7 : 1).
3. **Fest oben.** Balken `position: sticky; top: 0` (oder `fixed` mit gleichwertigem Platzhalter), feste Höhe 56 px,
   genau eine Zeile; Betrieb und Name · Rolle kürzen mit Auslassungszeichen, der volle Text steht im `title`. Die
   Seitenleiste bleibt `fixed` und beginnt in jeder Scrollstellung genau an der Unterkante des Balkens, auch beim
   Nachfedern in Safari unter macOS. Stapelordnung: der Balken liegt über allem, was im Inhalt klebt (Tabellenköpfe und
   erste Spalte mit `z-index` 2 und 3, `.manual-start-bar`), und unter Blättern und Dialogen (`.invitation-panel` mit
   5, `MobileSheet`, `dialog`). Auf dem Dokument `scroll-padding-top` in Balkenhöhe, damit Sprungziele, Fokus und
   `scrollIntoView` (Kalender, Zeitformular, Einrichtung) nicht unter dem Balken landen.
4. **Name · Rolle.** Hat die Mitgliedschaft keinen eigenen Namen, liefert der Server das Rollenwort als Namen
   (`COALESCE(display_name, …)` in den Lesefunktionen; je nach Funktion „Administrator“, „Standortleitung“,
   „Mitarbeiter“ oder „Beschäftigter“). Ist der gelieferte Name eines dieser Wörter, steht nur die Rolle da, nicht
   „Administrator · Administrator“. Eine Funktion für Balken und Konto-Block im Blatt „Mehr“. Keine Server-Änderung.
5. **Betrieb nicht doppelt.** Der Betrieb steht im Balken (breit) und in der oberen Zeile (schmal). Die Eyebrow mit dem
   Betrieb über dem Seitentitel (`PageHeader`) entfällt auf dem Bildschirm und bleibt im Druck, wo der Balken fehlt.
   Die Eyebrow „Taptura“ auf Willkommens- und Passwortseite bleibt.
6. **Schmal (unter 1024 px)** bleibt wie heute: eine obere Zeile, die mitscrollt, unten die feste Navigationsleiste.
   Im dunklen Thema bekommt die obere Zeile unten dieselbe Linie wie der Balken. `--band-height` ist dort 0.
7. **Monatsschalter** nach README § 4 als **ein** Baustein (z. B. `MonthSwitch` mit Wert, Bereich und `onChange`),
   eingesetzt in Lohnexport, Mitarbeiter (Reiter „Zeiten“), Kunden (Liste und Detail), Person und Meine Zeiten
   (ersetzt die Pfeile im Kalender) und Zeiten prüfen („Monat der Arbeitszeit“). Danach gibt es in `apps/admin-web`
   kein `type="month"` und keine Monats-Auswahlliste mehr. Der Baustein liefert nur gültige Monate im Bereich; schnelles
   Klicken darf keinen älteren Monat über einen neueren schreiben. Den Bereich von Meine Zeiten aus dem heutigen Code
   ableiten und im Bericht nennen.
8. **Lohnexport startet mit dem Vormonat**, wenn die Adresse keinen Monat trägt; Nebentext „<Monat> · abgeschlossen“
   oder „<Monat> · läuft noch“ (§ 8.6). Andere Seiten starten wie heute mit dem laufenden Monat.
9. **Keine weiße Seite mehr:** Kein `!` auf `monthTimeWindow(...)` in den Ansichten; ein ungültiger Monat fällt auf
   den Startmonat der Seite zurück. Dazu eine Fehlergrenze um die angemeldete Verwaltung: Statt einer leeren Seite
   steht „Diese Seite konnte nicht angezeigt werden.“ mit „Neu laden“, ohne technische Einzelheiten; die Diagnose
   geht nur in die Konsole. Seitenleiste und Balken bleiben bedienbar, wenn nur der Inhalt scheitert.
10. **Tests:**
    - Browser-Matrix (`scripts/browser/`) bei 1024 und 1440 px in Hell, Dunkel und Automatisch mit beiden
      Systemvorgaben: Balken sichtbar; Höhe des Balkens und waagrechte Lage von Zeichen, Betrieb, Name · Rolle und
      „Abmelden“ in allen Themen gleich (±1 px); Seitenleiste ohne Zeichen, ohne Konto-Block, ohne „Abmelden“.
    - Auf einer langen Seite mit Tabelle (Mitarbeiter oder Zeiten prüfen) nach `scrollTo(0, 800)`: Balken `top` 0,
      Seitenleiste `top` gleich Balken-Unterkante (±0,5 px); `elementFromPoint` an fünf Punkten im Balken trifft den
      Balken, ein Punkt 4 px unter dem Balken bei x = 10 trifft die Seitenleiste. Ein offenes Blatt (Einladen) liegt
      über dem Balken.
    - Einheit: Namensregel (eigener Name → „Name · Rolle“; Rollenwort → nur Rolle).
    - Druck: Balken nicht sichtbar, Eyebrow mit Betrieb sichtbar.
    - Die bestehenden Prüfregeln (nichts außerhalb des Fensters, 44 px, 16 px, kein seitliches Scrollen unter 1024 px,
      axe) bleiben in beiden Themen grün.
    - Monatsschalter: ‹ und › wechseln den Monat und die Adresse; › ist im laufenden Monat gesperrt; die Übersicht
      öffnet mit dem Fokus auf dem gewählten Monat, Esc schließt und gibt den Fokus zurück; künftige Monate gesperrt;
      fünfmal ‹ schnell hintereinander → Tabelle und Nebentext zeigen den fünften Monat. Der Fall des PO als
      Rotnachweis: alter Stand mit Tippen in die Jahreszahl → leere Seite; neuer Stand: kein Eingabefeld, und ein
      erzwungener Renderfehler zeigt die Meldung der Fehlergrenze statt einer leeren Seite.
    - Lohnexport ohne `?monat=` zeigt den Vormonat; mit `?monat=` den genannten.
    - Fotos: 1440 px hell und dunkel, jeweils oben und gescrollt; 390 px hell und dunkel; Monatsübersicht offen in
      beiden Breiten.

### Grenzen

Nur `apps/admin-web` und `scripts/browser`. Keine Änderung an Server, Migrationen, App, Betreiber-Bereich und
Startseite. Keine neue Farbe außer `band` (dunkel) und `band-line`; neuer Baustein nur der Monatsschalter. Leere
Namen in Lohnexport-Liste und CSV löst T-126 (Name ändern), nicht diese Aufgabe. ADO nicht ändern.

### Bericht

`.t122c-review/` (report.md, tracked.diff, untracked.txt, Fotos). Kein Commit vor `APPROVED` durch den TL.
