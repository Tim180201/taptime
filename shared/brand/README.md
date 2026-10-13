# Systemicon „Funk-Zifferblatt“ (D-136)

Quelle ist `mark.json`: Geometrie im Raster 100 × 100 und Farben. `mark-full.svg` gilt ab 48 px, `mark-compact.svg`
darunter; `app-icon.svg` zeigt das App-Symbol mit Grund. Alle Bilddateien sind daraus abgeleitet.

| Ordner | Inhalt |
|---|---|
| `app/` | App-Symbol iOS hell, dunkel und getönt (1024 px), Android adaptiv: Vordergrund und Themensymbol (1024 px), Startbild, Expo-Web-Favicon |
| `web/` | Favicon als SVG und ICO (16, 32, 48 px), Apple-Touch-Symbol 180 px |
| `store/` | Symbol 512 px für die Play Console |

Regeln: kein Schriftzug im Zeichen; nur Mint #7EE0C0 und Lime #C9F24D auf Grund #0E1512; Änderungen nur über
`mark.json`, nie von Hand nachgezeichnet. Anteil des Zeichens an der Fläche: iOS und Apple-Touch 72 %, Favicon 80 %,
Android-Vordergrund, Themensymbol und Startbild 62 % (Schutzkreis 66 dp von 108 dp).
