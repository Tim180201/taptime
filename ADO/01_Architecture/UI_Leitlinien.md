# Leitlinien für Oberflächen

> Gilt für Admin-Web, Mobile-App und Landing Page. Codex baut bei jeder Oberflächenaufgabe
> hiergegen. Abweichungen sind möglich — aber im Bericht zu begründen, nicht stillschweigend.
>
> **Stand:** 25.08.2026 · Grundlage: `Product_Vision.md`, `Product_Principles.md`, D-021

---

## 1 · Grundsatz

**Die beste Oberfläche ist die, über die niemand nachdenkt.**

Das ist keine Floskel, sondern folgt unmittelbar aus der Vision. Wenn „One Tap. One Decision."
für die Erfassung gilt, gilt für die Verwaltung: so wenig Entscheidungen wie möglich, und die
verbleibenden vorbereitet statt offen.

Zwei Prüffragen bei jeder Ansicht:

1. Weiß jemand, der zum ersten Mal hier ist, was er als Nächstes tun soll?
2. Weiß jemand, bei dem gerade etwas schiefging, was er tun kann?

---

## 2 · Anrede

| Oberfläche | Anrede | Warum |
|---|---|---|
| **Admin-Web** | **Sie** | Man handelt im Namen des Betriebs über andere Menschen. Deutsche Betriebssoftware siezt. |
| **Mobile-App** | **du** | Es geht um die eigene Arbeitszeit. Zehnmal am Tag, persönlich. |
| **Landing Page** | **Sie** | Sie spricht den Käufer an. |

**Innerhalb einer Oberfläche wird nie gemischt.** Eine Standortleitung, die morgens in der App
ihre Zeit stempelt und mittags im Web ihren Standort verwaltet, erlebt zwei Rollen — das ist die
Begründung, nicht ein Versehen.

---

## 3 · Wortschatz

Ein Begriff, eine Bedeutung, überall derselbe. Diese Liste ist verbindlich.

| Verwenden | Nicht verwenden |
|---|---|
| **Betrieb** | Organisation, Firma, Mandant, Unternehmen |
| **Beschäftigte / Beschäftigter** | Mitarbeiter, Angestellte, Nutzer, User |
| **Standort** · **Standortleitung** | Filiale, Niederlassung, Manager |
| **Administrator** | Admin, Verwalter |
| **Arbeitsziel** — Oberbegriff | Target, Objekt |
| **Kunde** · **Projekt** · **Allgemeine Arbeitszeit** — die drei Arten | Auftrag, Job, Task |
| **Zeiteintrag** | Buchung, Datensatz, Eintrag |
| **Pause** | Unterbrechung, Break |
| **NFC-Tag** | Chip, Sticker, Etikett, Token |
| **Erfassungsart**: *gescannt* / *manuell erfasst* | automatisch, händisch |
| **Korrektur** | Änderung, Bearbeitung |
| **Prüfung** | Review, Klärfall |
| **Freigabe** | Genehmigung, Bestätigung |

**Keine englischen Begriffe in der Oberfläche.** Kein Dashboard, kein Export-Button, kein Login.
Ausnahme: eingebürgerte Fachwörter ohne brauchbare Entsprechung — NFC, CSV, E-Mail.

**Schaltflächen benennen die Handlung, nicht die Zustimmung.** „Kunde anlegen", nicht „OK".
„Zuordnung lösen", nicht „Ja". Nach dem Klick sagt die Rückmeldung dasselbe Wort: „Kunde
angelegt."

---

## 4 · Raster, Abstände, Schrift

- **4-px-Raster** für alle Abstände, Höhen und Icons. Keine krummen Werte.
- **Eine Schriftfamilie** — Inter. Vier bis sechs Größen, mehr nicht.
- **Tabellenziffern** (`font-variant-numeric: tabular-nums`) überall, wo Zahlen untereinander
  stehen: Zeiten, Dauern, Beträge.
- **Farbdisziplin:** überwiegend Neutraltöne. Der Markenton ist Akzent, keine Fläche. Gesättigte
  Farbe ausschließlich für Status — Warnung, Fehler, Erfolg.
- **Farbe ist nie der einzige Träger einer Aussage.** Immer Symbol oder Text dazu.
- Bedienelemente mindestens **44 px** hoch, Trefferflächen mindestens **24 × 24 px**.

---

## 5 · Sechs Zustände, nicht zwei

Jedes bedienbare Element hat: **Ruhe · Überfahren · Tastaturfokus · Gedrückt · Deaktiviert ·
Lädt.**

Der Tastaturfokus ist der, der am häufigsten vergessen wird. Er muss **sichtbar** sein und darf
nicht mit dem Überfahren-Zustand verwechselbar sein.

---

## 6 · Leere Zustände — drei Arten, niemals gleich behandeln

**Erstmalig leer.** Der Betrieb ist neu, es gibt noch nichts. Führt hin: Überschrift unter zehn
Wörtern, ein bis zwei Sätze, **genau eine** Hauptaktion. Kleine Illustration erlaubt, höchstens
160 px.

**Durch Filter leer.** Es gibt Daten, nur nicht in dieser Auswahl. „Keine Arbeitszeiten vom 1.
bis 7. August" plus **Filter zurücksetzen**. Keine Illustration — sonst wirkt jede
Filteränderung wie ein Ereignis.

**Fehler.** Wird **nie** als leerer Zustand getarnt. Ein Abruf, der scheitert, sieht nicht aus
wie „nichts vorhanden".

---

## 7 · Ladezustände

| Dauer | Was passiert |
|---|---|
| unter 0,1 s | nichts |
| 0,1 – 1 s | nichts. Eine Anzeige würde nur flackern. |
| 1 – 10 s | Skeleton, eingeblendet nach 1 s Verzögerung |
| über 10 s | Fortschritt in Prozent und Abbrechen-Möglichkeit |

**Skeleton** nur, wenn die Form der Antwort bekannt ist — Tabellenzeilen, Karten. **Spinner** nur
für Aktionen unbekannter Form, und dann **in der Schaltfläche**, nie bildschirmfüllend.

**Schreibvorgänge optimistisch anzeigen:** Eine korrigierte Zeit erscheint sofort geändert und
wird zurückgenommen, falls der Server ablehnt.

---

## 8 · Fehlermeldungen

Vier Bestandteile, in dieser Reihenfolge:

1. **Was ist passiert** — konkret, nicht „Es ist ein Fehler aufgetreten"
2. **Warum**
3. **Was kann ich tun** — mit Schaltfläche, wenn es eine Handlung gibt
4. **Die Eingaben bleiben erhalten**

**Platzierung:**

- **Am Feld**, oberhalb davon — für Eingabeprüfung
- **Als Band oben im Inhalt** — für Zusammenfassungen und Systemzustände, bleibt stehen bis gelöst
- **Toast ausschließlich für Erfolg**, rund fünf Sekunden. **Niemals für Fehler** — er
  verschwindet, bevor jemand ihn zu Ende gelesen hat.

**Keine Schuldzuweisung.** Nicht „ungültige Eingabe", sondern „Diese E-Mail-Adresse gehört schon
zu einem Zugang". Kein nackter Fehlercode. Die Korrelations-ID darf klein danebenstehen — für
den Support, nicht als Erklärung.

---

## 9 · Tabellen

- **Kopfzeile bleibt stehen**, erste Spalte wird eingefroren, sobald seitlich gescrollt wird.
- **Auf schmalen Bildschirmen wird nicht in Karten aufgelöst.** Der Zweck einer Tabelle ist der
  Vergleich zwischen Zeilen; Karten zerstören ihn. Richtig ist: eingefrorene erste Spalte,
  seitliches Scrollen, Spaltenauswahl.
- **Details im seitlichen Bereich**, nicht im Modal — die Nachbarzeilen bleiben sichtbar.
- **Filter als Chips** mit Trefferzahl und „Alle zurücksetzen". Eine gefilterte Tabelle darf nie
  aussehen wie eine ungefilterte.
- **Keine Aktionen, die nur beim Überfahren erscheinen.** Tastatur und Touch sehen sie nie.
- Ab etwa 1.000 Zeilen virtualisieren.

---

## 10 · Formulare

- **Beschriftung über dem Feld**, linksbündig. Kein Floating Label, kein Platzhalter als
  Beschriftung.
- **Prüfung beim Verlassen des Feldes.** Steht ein Fehler, wird bei jedem Tastendruck neu geprüft
  und die Meldung sofort entfernt, sobald es stimmt. **Nie beim Betreten prüfen.**
- **Optionale Felder werden gekennzeichnet**, nicht die Pflichtfelder. In Verwaltungsformularen
  ist fast alles Pflicht — Sternchen überall sind wertlos.
- **Die Absenden-Schaltfläche bleibt bedienbar.** Eine graue Schaltfläche verbirgt, warum sie
  grau ist.

---

## 11 · Navigation

**Seitenleiste, nicht Reiter oben.** Bei fünf Bereichen ist die Grenze erreicht, und mit
Standorten und Auswertungen werden es mehr. Eine schmale Seitenleiste kostet rund 6 % der Fläche,
Reiter über 20 %.

Reiter gehören **innerhalb** eines Bereichs — etwa Beschäftigte → Aktiv / Ausgeschieden.

**Echte Adressen**, kein `#hash`. Vor und Zurück funktionieren, ein Link führt dahin, wo er
hinführt, ein Lesezeichen auch. Kein Hamburger-Menü am Rechner.

---

## 12 · Was wir nicht machen

Bestätigungsdialoge für Harmloses — **rückgängig machen statt vorher fragen**. Toast für Fehler.
Bildschirmfüllende Spinner. Kacheln ohne Aufgabe. Aktionen nur beim Überfahren. Karten statt
Tabelle. Floating Labels. Sternchen-Wüsten. Deaktivierte Absenden-Schaltflächen. „Seite 3 von ?".
Farbe als einziger Statusträger. Einführungstouren mit acht Schritten — der leere Zustand führt
hin, nicht ein Assistent.
