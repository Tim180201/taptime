# Aktuelle Aufgabe

> **Stand 18.09.2026:** T-058 ist auf `main` (`3daa09b`, CI grün, Review in einer Runde).
> Nächste Aufgabe ist **T-043** (Android-Auswahldialog, NDEF-Nachricht auf dem Tag). Ihr
> Brief folgt, sobald der Product Owner die Adresse festlegt, die auf die Tags geschrieben
> wird (D-037: genau einmal, ein Formatwechsel heißt jeden Tag neu beschreiben).
> Reihenfolge: **T-043 → T-060 → T-059 → APK → Geräteabnahme (D-044) → T-049.**

## T-058 · Die App, wie sie gemeint ist — abgeschlossen `3daa09b`

**Für:** Development · **Risiko:** Scan-Bildschirm, Sitzungswechsel, Offline-Zustände
**Zeitbox:** drei Sitzungen. **Grundlage:** D-058, `ADO/01_Architecture/Mobile_Entwurf/`
(README und 15 Bildschirme), `UI_Leitlinien.md`. Auftrag vom 18.09.2026.

### Ergebnis und Grenzen

Die App sieht aus und verhält sich wie der Entwurf. Nur `apps/mobile` und geteilte Design-
Tokens; kein Backend, keine Migration, keine neuen Routen. Kein Reiter „Mitarbeiter" (T-059),
keine Rechteänderung (T-060), kein NDEF-Filter (T-043). Farben sind die heutigen Tokens.

### Umsetzung

1. **Reiterleiste je Rolle** (Icon + Beschriftung, 56 px, aktiv mint): Mitarbeiter *Erfassen,
   Manuell, Meine Zeiten*; Administrator und Standortleitung *Erfassen, Manuell, Meine Zeiten,
   Tags* (bis T-059). Erfassen ist immer der Startbildschirm.
2. **Abgleich ist kein Reiter.** Ein Statuspunkt in der Kopfzeile: mint bei „alles bestätigt",
   bernstein mit Zahl bei wartenden Vorgängen; er öffnet die Abgleich-Seite mit Zurück-Pfeil.
3. **Tap-Moment.** Kreis 236 px mit NFC-Symbol, Atem-Skalierung und zwei Wellen (Vorbild
   `frogs-zeiterfassung/app/scan.jsx`, nur die Animation, keine Logik). Nach der Serverantwort
   ein eigener Zustand: Kreis mint, Haken, GESTARTET/GESTOPPT, Uhrzeit, Ziel, „Vom Server
   bestätigt", nach ~2 s wieder bereit. Ohne Netz dieselbe Szene in Bernstein mit „sicher
   gespeichert, wird nachgereicht". T-052 liefert die Entscheidung; hier wird sie gezeigt.
4. **Meine Zeiten:** Kacheln Monat/Woche, Monatskalender mit Stunden je Tag, Tagesliste mit
   Ziel, Zeitraum, Herkunft, Dauer. Berlin-Zone aus `packages/core` (D-056), nicht die Geräte-
   zone — das schließt den P2-Befund aus T-036.
5. **Manuell, Abgleich, Tags** im neuen Kleid; „NFC-Einrichtung" heißt Tags; App-Name Taptura;
   Schrift Manrope über das Expo-Google-Fonts-Paket.
6. **Zwei Befunde vom 18.09.:** `ScanScreen` sagt je Schutzursache etwas anderes —
   `identity_mismatch` (Mitgliedschaft), `local_evidence_protected` (lokaler Speicher),
   `legacy_membership_unknown`; und der Schutzzustand einer Sitzung wird beim Kontowechsel
   verworfen und neu bestimmt, ohne Evidenz zu verändern (D-055: nie Evidenz umschreiben).
7. Bestehende Coordinatoren, Offline-Datenbank und Verträge bleiben unverändert; nur Screens,
   Navigation, Design-Primitive. Wo der Entwurf etwas zeigt, das die App heute nicht weiß
   (z. B. „0,4 s"), wird es weggelassen, nicht erfunden.

### Verifikation und Abschluss

Rotnachweise: Rolle → Reiter (drei Rollen); Statuspunkt bei 0 und n wartenden Vorgängen; die
drei Schutztexte; Sitzungswechsel verwirft den Schutzzustand; Kalender an Monats- und
Zeitumstellungsgrenzen in Europe/Berlin. Testsinklusiver Typecheck und volle Mobile-Suite.
Unabhängiges Review (Sitzungs- und Schutzlogik), maximal zwei Runden. Umsetzung nicht vor
Technical-Lead-APPROVED committen. Geräteabnahme durch den Product Owner erst mit der APK nach
T-059 (D-044). Bericht nach AGENTS.md §8, ausgelassene Prüfungen mit Grund.
