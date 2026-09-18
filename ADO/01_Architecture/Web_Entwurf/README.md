# Taptura Admin-Web — Entwurf je Rolle · 18.09.2026

Vom Product Owner am 18.09. abgenommen. Grundlage: D-058, D-059, D-060, `UI_Leitlinien.md`
(Web siezt). Jede HTML-Datei ist ein Bildschirm in 1440 × 900 (`index.html` öffnen); die
Navigation links ist verlinkt. Zeiten, Namen und Orte sind Beispiele. Dieselben Bausteine wie
der App-Entwurf (`../Mobile_Entwurf/README.md`): Tokens, Manrope, Radien, Kacheln, Karten.

## Aufbau

- **Leiste links (248 px):** Wortmarke Taptura, Navigation je Rolle, unten Person · Rolle ·
  Umfang und „Abmelden". Prüfungen tragen eine bernsteinfarbene Zahl, wenn Fälle offen sind.
- **Kopf:** Titel 28/800, Untertitel gedämpft, rechts die eine Limetten-Taste der Seite.
- **Kacheln:** Beschriftung 13, Wert 32–48/800, Unterzeile; die erste Kachel ist immer die
  Antwort auf „was läuft gerade" oder „was braucht mich".

## Bildschirme

| Datei | Rolle | Kern |
|---|---|---|
| 01 Übersicht | Admin | Kacheln *Gerade aktiv 7/12*, *Braucht Ihre Entscheidung*, *Fehlender Stopp*, *Diesen Monat*; darunter *Gerade aktiv* (Personenzeilen) und *Braucht Ihre Entscheidung* (Fälle mit Freigeben/Korrigieren in der Zeile). |
| 02 Beschäftigte | Admin | Suche, Alle/Aktiv/Inaktiv, Zeilen: Person, Standort, heute, Monat, Status-Punkt. |
| 03 Person | Admin | Kacheln, Monatskalender (Stunden je Tag), Tagesliste mit Herkunft (Tap/automatisch/manuell) und Korrekturhinweis; „Zeit korrigieren", „CSV dieser Person". |
| 04 Einladen | Admin | Seitenpanel 480 px über Beschäftigte: Name, E-Mail, Rolle (Beschäftigte/r, Standortleitung, Administrator), Standort. |
| 05 Prüfungen | Admin/SL | Offen/Entschieden; je Fall: was fehlt, Details, Vorschlag; Freigeben · Korrigieren · Ablehnen. Historie bleibt, Originale nie überschrieben. |
| 06 Einrichtung | Admin/SL | Reiter Standorte · Arbeitsziele · Tags; Tags als Bestand (zugeordnet wird mit dem Handy), „Neu zuordnen". |
| 07 Lohnexport | Admin/SL | Monat, Standort, Kacheln (Arbeit, Pausen, Manuell, Revisionsstand V3), Tabelle je Person, „CSV herunterladen"; offene Prüfungen gekennzeichnet. |
| 11 Übersicht | Standortleitung | Wie 01 für den eigenen Standort („3 / 5"); Hinweis „Standortleitungen legt der Administrator an". |
| 21 Meine Zeiten | Mitarbeiter | Kacheln Monat/Woche/Heute, Kalender, Tagesliste, „Korrektur beantragen". |
| 22 Manuell | Mitarbeiter | Arbeitsziel wählen, „Jetzt erfassen" — ohne Datum, die Engine entscheidet Start/Stopp. |

## Was der Entwurf zeigt, was es noch nicht gibt

Pausenzeilen „automatisch" (T-050), der Lösungsvorschlag im Prüffall („16:30, Ende des
Betriebs") und das Soll in der Personenkachel (T-051) sind Richtung, keine Zusage. Die
Umsetzung (T-049) baut, was das Backend liefert, und lässt den Rest weg, statt es zu erfinden.
