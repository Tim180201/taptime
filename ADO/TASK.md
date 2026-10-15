# Aktuelle Aufgabe

> **Stand 15.10.2026:** Deploy 6 abgeschlossen (`d193725` → `fb28166`, Migrationen 058 und 059). T-024 Teil A
> abgeschlossen (`7e36c58`). Jetzt **T-122c** aus der Web-Abnahme des PO nach Deploy 6; danach Deploy 7 (T-024a,
> T-122c) mit neuem Deploy-Schlüssel und T-024 Teil B an der Konsole (PO, TL begleitet; Runbook in `infrastructure/DEPLOY.md`).

## T-122c · Kopfbalken in beiden Themen, fest oben (D-140)

**Für:** Development · **Risiko:** niedrig (nur Verwaltung im Browser, keine Daten) · **Zeitbox:** eine kurze Sitzung.

### Warum

Web-Abnahme des PO nach Deploy 6 (15.10.): Hell und Dunkel haben verschiedenen Aufbau. Der Kopfbalken mit Betrieb,
Name · Rolle und „Abmelden“ steht nur im hellen Thema; im dunklen liegt dasselbe als Zeichen und Konto-Block in der
Seitenleiste. Das widerspricht D-140 (ein Aufbau, zwei Farbsätze); die Ausnahme stand im Entwurf (TL), die Umsetzung
folgte ihm. Zweitens scrollt der Balken mit, während die Seitenleiste fest 56 px tiefer bleibt: Beim Scrollen entsteht
oben links eine Lücke, durch die der Inhalt läuft. Dazu zwei Kleinigkeiten aus denselben Fotos: „Administrator ·
Administrator“ im Balken und der Betrieb doppelt (Balken und Eyebrow über jedem Titel). Der Entwurf ist angepasst:
`ADO/01_Architecture/Web_Entwurf_v2/README.md` § 2, § 2.1, § 2.2, § 3.1 bis § 3.3 und § 3.5.

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
7. **Tests:**
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
   - Fotos: 1440 px hell und dunkel, jeweils oben und gescrollt; 390 px hell und dunkel.

### Grenzen

Nur `apps/admin-web` und `scripts/browser`. Keine Änderung an Server, Migrationen, App, Betreiber-Bereich und
Startseite. Keine neue Farbe außer `band` (dunkel) und `band-line`; kein neuer Baustein. ADO nicht ändern.

### Bericht

`.t122c-review/` (report.md, tracked.diff, untracked.txt, Fotos). Kein Commit vor `APPROVED` durch den TL.
