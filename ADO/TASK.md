# Aktuelle Aufgabe

> **Stand 21.09.2026, abends:** T-067 ist auf `main` (`d75fd56`), CI und Abbilder grün; der
> Deploy `7f0012e -> d75fd56` läuft (Aufholen des Archivrückstaus, mehrere Stunden).
> Reihenfolge: **Deploy T-067 → T-065 → T-066 → T-068 → Deploy → Pilot Monat 1**
> (D-067, D-068, D-069).

## T-065 · Abnahme am Gerät vom 21.09.: Kalender, Offline-Start, Manuell-Knopf

**Für:** Development · **Risiko:** gering, nur `apps/mobile` · **Zeitbox:** eine Sitzung.
**Grundlage:** Geräteabnahme des Product Owners vom 21.09.2026, `UI_Leitlinien.md` §13,
D-058. Auftrag vom 21.09.2026.

### Befund (am Quelltext geprüft)

1. **Kalender passt nicht auf den Bildschirm.** `TimeCalendar.tsx` legt das Monatsraster in
   eine seitlich wischbare `ScrollView` mit `minWidth: 308`. Nach Seitenrand (20) und
   Kartenabstand bleibt auf üblichen Telefonen weniger Platz — der Product Owner muss wischen.
   Dieselbe Komponente dient der Personenansicht (Mitarbeiter-Reiter).
2. **Offline-Kaltstart dauert rund eine Minute.** Mit gespeichertem Refresh-Token ruft
   `performStart` zuerst `provider.refreshSession` auf und wartet, bis dieser am Netz
   scheitert; erst dann folgt `context_unavailable` und die Offline-Erfassung
   (`canPresentOfflineCaptureShell`). `offlineCaptureRestorationAllowed` ist zu diesem
   Zeitpunkt schon gesetzt. Die Dauer ist zu messen und zu belegen, nicht zu vermuten.
3. **Man sieht nicht, wer angemeldet ist.** Die Kopfzeile zeigt nur die Rolle
   (`roleLabel`), offline „Offline-Erfassung". Auf dem Gerät liegt heute ausschließlich der
   Refresh-Token (`ExpoRefreshTokenStore`); eine Identität wird nirgends gespeichert.
4. **Manuell ist ein eigener Reiter** (`productDestinations`, `OFFLINE_PRODUCT_DESTINATIONS`).
   Der Product Owner will stattdessen einen Knopf auf Erfassen.

### Umsetzung

1. **Der Monat passt immer ganz.** Keine seitliche `ScrollView`, keine Mindestbreite; die
   sieben Spalten teilen sich die vorhandene Breite, Stundenangaben verkleinern sich statt
   umzubrechen. Berührziele nach §13 bleiben mindestens 44 hoch.
2. **Offline in Sekunden.** Liegt ein Refresh-Token vor und antwortet das Netz nicht, erscheint
   die Offline-Erfassung nach höchstens drei Sekunden; die Wiederherstellung läuft im
   Hintergrund weiter und wechselt in die volle Oberfläche, sobald der Server die Sitzung
   bestätigt. **Unverändert:** Ohne Serverbestätigung gibt es keine Verwaltung, keine Rolle
   und keine Mitarbeiterdaten — die Rechte entscheidet der Server.
3. **Wer angemeldet ist, steht in der Kopfzeile — online und offline.** Angezeigt wird die
   E-Mail-Adresse (oder ein vom Server gelieferter Name) aus der **letzten vom Server
   bestätigten** Sitzung dieses Kontos auf diesem Gerät, gespeichert im sicheren Speicher neben
   dem Token, gelöscht beim Abmelden und beim Kontowechsel. Nie geraten: Fehlt sie, bleibt es
   bei „Offline-Erfassung".
4. **Manuell starten ist ein Knopf unten auf Erfassen.** Der Reiter Manuell entfällt online und
   offline. Der Knopf führt zur Auswahl von Kunde/Projekt und startet die Zeit. **Alles, was der
   Reiter heute kann, bleibt höchstens einen Schritt von Erfassen entfernt**: Start, Pause,
   Fortsetzen, Stopp — die Pause ist in T-058 schon einmal verloren gegangen. Offline führt der
   Knopf in die bestehende Offline-Erfassung von Hand. Die Zurück-Geste führt immer zu
   Erfassen.

### Grenzen

- Nur `apps/mobile`. Keine Änderung an Backend, Verträgen, Web oder Abhängigkeiten; scheint
  eine neue Abhängigkeit nötig: stoppen und melden.
- Keine neue Datenspeicherung außer der Identität aus Punkt 3.
- Gestaltung nach `UI_Leitlinien.md` §13.

### Verifikation und Abschluss

- Kalender bei 320, 360 und 412 Punkten Breite ohne seitliches Wischen; Rotnachweis mit dem
  heutigen Raster.
- Offline-Kaltstart: Test mit einem Anbieter, der nicht antwortet — Offline-Erfassung nach
  höchstens drei Sekunden; danach Wechsel in die volle Oberfläche, wenn der Server bestätigt.
  Die heutige Dauer als Rotnachweis messen und berichten.
- Identität: gespeichert nach bestätigter Sitzung, gelöscht bei Abmeldung und Kontowechsel,
  nie aus unbestätigten Daten.
- Kein Reiter Manuell mehr; jede Aktion von Hand ist von Erfassen aus erreichbar, online und
  offline; Barrierefreiheitsbezeichnungen vorhanden.
- Typecheck, Mobile-Tests, `npx expo export --platform android`.
- Unabhängiges read-only Review, höchstens zwei Runden. Nichts committen, nichts pushen.
  Review-Dateien nach `.t065-review/`.

## Danach

**T-066** Zeit nachtragen und Kommentar (D-067, D-069). **T-068** Betreiber-Bereich (D-068).
