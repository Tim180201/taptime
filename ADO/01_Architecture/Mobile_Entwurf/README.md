# Taptura App — Entwurf je Rolle · 18.09.2026

Vom Product Owner am 18.09. abgenommen („genau so bauen"). Grundlage: D-058, D-059,
`UI_Leitlinien.md`. Jede HTML-Datei ist ein Bildschirm in 390 × 844, im Browser zu öffnen
(`index.html`); die Reiter unten sind verlinkt. Zeiten, Namen und Orte sind Beispiele.
Der klickbare Original-Entwurf liegt als Claude-Artefakt beim Product Owner.

## Bausteine

- **Farben:** die heutigen Tokens aus `apps/mobile/src/design/tokens.ts` — Grund `#0E1512`,
  Fläche `#141C19`, erhoben `#1A2320`, Linie `#24302C`, Text `#F2F5F4`, gedämpft `#97A5A0`,
  Akzent Mint `#7EE0C0`, die eine Haupttaste Limette `#C9F24D`, Hinweis Bernstein `#E0A44C`.
- **Schrift:** Manrope 400/600/800 (Google-Font-Paket), Titel 22/800, Zahlen groß 40–44/800.
- **Radien:** Karten 12, Steuerelemente 10, Kreise 999. Berührziel ≥ 44 px.
- **Kopfzeile:** Titel links, Untertitel (Person · Betrieb/Standort/Rolle), rechts der
  **Abgleich-Punkt**: mint = alles bestätigt; bernstein mit Zahl = wartende Vorgänge. Antippen
  öffnet `06_Abgleich_versteckt.html` (Zurück-Pfeil, kein Reiter).
- **Reiterleiste:** Mitarbeiter 3 Reiter, Administrator/Standortleitung 4 Reiter; aktiver
  Reiter mint, Icon plus 11-px-Beschriftung, 56 px hoch.

## Bildschirme

| Datei | Rolle | Kern |
|---|---|---|
| 01 Erfassen | alle | Kreis 236 px mit NFC-Symbol, „Tag antippen", darunter „Zuletzt". Atem-Skalierung und zwei Wellen wie `frogs-zeiterfassung/app/scan.jsx`. |
| 02 Entscheidung | alle | Kreis wird mint, Haken, „GESTARTET"/„GESTOPPT", Uhrzeit 44 px, Ziel, „Vom Server bestätigt · 0,4 s", unten „Bereit für den nächsten Tap". Nach ~2 s zurück zu 01. |
| 03 Offline | alle | Dieselbe Szene in Bernstein: „Kein Netz · sicher gespeichert, wird nachgereicht"; Abgleich-Punkt zeigt 1. |
| 04 Manuell | alle | Start/Stopp-Wahl, Datum, Uhrzeit, Arbeitsziel, Limetten-Taste „Zeit eintragen". |
| 05 Meine Zeiten | alle | Kacheln Monat/Woche, Monatskalender mit Stunden je Tag (ausgewählter Tag mint), Tagesliste mit Ziel, Zeitraum, Herkunft (Tap/manuell), Dauer. |
| 06 Abgleich | alle | Zustand, „Wartet auf den Server", „Heute bestätigt", Hinweis „nichts löschen". |
| 12 Mitarbeiter | Admin/SL | Kachel „7 / 12 gerade aktiv" (Stand hh:mm, Umfang), Umschalter Aktiv/Inaktiv, Zeilen mit Initialen, Name, „seit 07:42 · Ziel", Punkt mint/aus, unten „+ Mitarbeiter". |
| 13 Person | Admin/SL | Kopf mit Rolle/Standort/aktiv seit, Kacheln Monat/offene Prüfung, Kalender, Tagesliste („läuft"). |
| 14 Einladen | Admin | Name, E-Mail, Rolle (Mitarbeiter/Standortleitung), Standort, „Einladung senden". |
| 15 Tags | Admin/SL | Liste: Bezeichnung, Arbeitsziel, zuletzt; „Tag zuordnen". |
| 16 Tag zuordnen | Admin/SL | Ziel, Bezeichnung, gestrichelter Kreis „Jetzt den Tag antippen". |
| 21/22 Standortleitung | SL | Wie 12/14, Umfang „Standort Nord", Rolle und Standort festgeschrieben. |

## Reihenfolge der Umsetzung

T-058 (Navigation, Tap-Moment, Meine Zeiten, Manuell, Abgleich, Tags-Umbenennung; Admin
behält bis T-059 „Meine Zeiten" statt „Mitarbeiter") → T-043 → T-060 (Rechte) → T-059
(Mitarbeiter-Reiter) → neue APK → Geräteabnahme durch den Product Owner (D-044).
