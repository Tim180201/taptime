# T-031 · Startseite — Entwurf

**Stand:** 23.09.2026 · **Autor:** Claude (TL) · **Grundlage:** D-083, D-014, D-061, UI_Leitlinien
**Oberfläche:** `startseite-entwurf.html` in diesem Ordner (vom PO am 23.09. abgenommen, Fassung 3).

Der Entwurf ist die Vorlage für T-031. **Verbindlich** sind Texte, Aufbau, Reihenfolge,
Farben, Schriften und Bewegungen. **Nicht verbindlich** ist die technische Form: Der Entwurf
ist eine einzelne Datei mit eingebettetem CSS und Skript und lädt Schriften von Google —
beides ist in der Umsetzung verboten (CSP, D-083).

---

## 1. Aufbau

1. Navigation: Marke, fünf Anker, Knopf „Pilot anfragen“.
2. Einstieg: Hinweis „NFC-Zeiterfassung für Reinigung, Handwerk und Außeneinsätze“,
   Überschrift „One Tap. One Decision.“, Handy tippt auf einen Tag (Schleife mit Pause-Knopf),
   Punktfeld mit Wellen im Hintergrund.
3. Satz mit Wort-Aufhellung beim Scrollen.
4. „So funktioniert es“: klebende Szene über drei Schritte (Tippen, Entscheiden, Fertig).
5. „Zwei Wege, ein Zeiteintrag“: NFC-Tag (hervorgehoben) und Manuell (Büro, Ausnahmen).
6. Verwaltung: Beispielfenster mit erfundenen Daten und vier Punkten.
7. Ohne Netz: gespeichert → vom Server bestätigt.
8. Sicherheit: vier Kacheln und der BAG-Satz mit Link.
9. Für wen: neun Branchen als ruhige Liste.
10. Pilotphase in vier Schritten, fünf häufige Fragen plus „Geht es auch ohne NFC-Tags?“.
11. Anfrage: Kasten mit Anfrage-Adresse.

## 2. Jede Aussage ist am Code geprüft (23.09.)

| Aussage auf der Seite | Beleg |
|---|---|
| „Vom Server bestätigt“ / „Sicher gespeichert, wird nachgereicht“ | Texte der App, `ScanScreen.tsx` |
| Kopie auf dem Handy erst nach Sicherung entfernt | T-052, Archivnachweis vor Löschung |
| Bestätigt heißt extern gesichert | D-051, D-078 |
| Wiederherstellung jede Woche geprüft | `taptime-restore-verify.timer`, sonntags |
| Korrekturen ergänzt, mit Grund | Migration 012, Grund 1–500 Zeichen |
| Vergessene Zeit mit Grund beenden | Migration 031, `reason_required` |
| CSV mit Pausen, Dauer, Erfassungsart | `TimeEntryExportCoordinator` (V3) |
| Manuell in App und Browser, für alle Rollen | `ManualCaptureScreen`, Migration 029 |
| Datenbank trennt Betriebe | FORCE RLS über `app.organization_id` |
| iPhone „in Vorbereitung“, zuerst mit geöffneter App | D-081 |

Nicht auf der Seite, weil nicht belegt oder nicht entschieden: Zeitangaben wie „drei
Sekunden“, Preise, Kundenzahlen, Siegel, Freigabe manueller Zeiten (D-014, noch nicht
eingeschaltet), Schnittstellen zu Lohnprogrammen, Leistungen im Pilot.

## 3. Umsetzung — Abweichungen vom Entwurf

- Schriften selbst ausliefern; nur benötigte Schnitte.
- Kein Inline-Skript, kein Inline-Stil, keine `style`-Attribute.
- Alle „Vorschau“-Hinweise entfallen. Fußzeile nur „© 2026 Taptura (Arbeitsname)“.
- Anfrage-Adresse ist **ein** Konfigurationswert. Leer: „E-Mail-Adresse folgt“, kein Knopf.
  Gesetzt: `mailto:`-Knopf und der Satz „Wir verwenden Ihre Angaben nur, um Ihre Anfrage zu
  beantworten.“
- Seitentitel: „Taptura – NFC-Zeiterfassung für Reinigung und Handwerk“.
  Beschreibung: „Arbeitszeiten am Einsatzort per NFC-Tag erfassen – auch ohne Netz.
  Verwaltung im Browser und Export für die Lohnabrechnung.“

## 4. Hilfeseite `/tag`

Für alle, die einen Tag außerhalb der App antippen: iPhone zeigt dann einen Hinweis auf
`https://tb-infra.de/tag`, Android ohne installierte App öffnet den Browser. Gleicher Stil,
ohne Anrede, ohne Link auf die geschützte Startseite, liest nichts aus der Adresse:

> **Das ist ein Taptura-Tag.**
> Er dient der Zeiterfassung. Zum Erfassen die Taptura-App öffnen, auf „Tag scannen“ tippen
> und das Handy an den Tag halten. Auf Android öffnet sich die App beim Antippen direkt,
> wenn sie installiert ist.

## 5. Später (T-031b, nicht jetzt)

Öffentlich schalten: Impressum (§ 5 DDG), Datenschutzhinweise (Art. 13 DSGVO), echte
Anfrage-Adresse, Pilotbedingungen (Dauer, Kosten, Tags), `noindex` erst mit endgültigem Namen
und Domain entfernen.
