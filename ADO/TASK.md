# Aktuelle Aufgabe

> **Stand 29.10.2026:**
> - Der gemeinsame Deploy ist ausgeliefert (`e577fa8` → `05bcf51`).
> - Der Kurztest mit iPhone Build 11 und Android Version 18 ist bestanden, außer dem Fall T-139.
> - T-139 ist auf main (`09ac588`).
> - Jetzt T-140, danach ein gemeinsamer App-Build mit T-139 und T-140 (PO 29.10.).

## T-140 · Ohne Netz wie mit Netz, Stufe 1: vorläufige Anzeige (D-158)

**Für:** Development (Astra, Extra High) · **Risiko:** mittel bis hoch. Die Anzeige darf nichts als bestätigt
zeigen, was der Server noch nicht entschieden hat, und sie bucht nichts. Unabhängiges Review (AGENTS 4) ·
**Zeitbox:** zwei Sitzungen. Reißt sie, wird Punkt 3 (Sperrbildschirm) geschnitten, nie 1 und 2.

**Befund (PO 29.10.):** Wird ohne Netz per Karte oder manuell eine Zeit gestartet, zeigt die App keine laufende Zeit.
Auch der Sperrbildschirm zeigt keine laufende Uhr. Mit Netz läuft beides sofort.

### Umfang

1. **Vorläufiger eigener Stand:**
   - Grundlage ist der zuletzt vom Server bestätigte eigene Stand (aktive Zeit, Pause) zusammen mit den eigenen, noch
     nicht bestätigten Erfassungen dieses Geräts in der Reihenfolge ihrer Erfassung.
   - Ausgewertet wird mit der `BusinessEngine` aus `@taptime/core`. Es gibt keine zweite Entscheidungslogik.
   - Der Stand liegt nur im Speicher, ohne neue Tabelle. Ein Wechsel von Konto, Mitgliedschaft oder Betrieb und das
     Abmelden verwerfen ihn.
2. **Anzeige in der App:**
   - „Erfassen“ und „Meine Zeiten“ zeigen ohne Netz dieselbe Karte wie mit Netz: laufende Zeit mit Uhr,
     „Pause seit …“, beendet.
   - Dazu kommt ein kleines, zugängliches Zeichen „offline gespeichert“, als Text und nicht nur als Farbe.
   - Bestätigt der Server dasselbe, verschwindet das Zeichen still.
   - Entscheidet er anders (Ablehnung, Prüffall, andere Zeit), erscheint ein kurzer Hinweis mit seiner Entscheidung.
     Dann gilt der Server.
3. **Sperrbildschirm** (Android-Benachrichtigung, iPhone-Live-Aktivität):
   - Er zeigt den vorläufigen Stand mit laufender Uhr und demselben Offline-Zeichen.
   - Ohne Netz buchen die Knöpfe weiterhin nichts selbst; das ist Stufe 2 nach dem Pilot. Sie öffnen die App oder
     zeigen wie heute „Nicht gesendet · kein Netz“.
4. **Keine Änderung an Server oder Vertrag.** Verwaltung, Exporte und Prüffälle bleiben unverändert.

### Tests und Nachweis

- **Zuerst rot:** Eine ohne Netz gestartete Zeit zeigt heute keine laufende Zeit.
- **Abgedeckte Fälle:**
  - Start, Pause, Pause beenden und Ende ohne Netz;
  - mehrere Erfassungen hintereinander;
  - Neustart der App ohne Netz;
  - Netz kommt zurück, und der Server entscheidet gleich (das Zeichen verschwindet);
  - Netz kommt zurück, und der Server entscheidet anders (Hinweis, der Server gilt);
  - Kontowechsel und Abmelden;
  - abgelaufene Offline-Freigabe;
  - Kaltstart per Karte ohne Netz zusammen mit T-139.
- **Gleiche Entscheidung wie auf dem Server:** Die Auswertung im Client wird gegen dieselben Fälle geprüft wie auf dem
  Server, also gleiche Eingaben und gleiche Entscheidung.
- **Builds:** Android-Release-Build und iOS-JS-Export lokal, die ganze CI lokal nachgebaut.
- **Bericht:** `.t140-review/bericht.md` mit einer kurzen Geräteprüfliste für beide Telefone.

### Grenzen

- Kein Deploy, keine EAS-Builds, kein Server, kein Supabase, keine GHCR-Paketaktion, nichts installieren (AGENTS 3).
- Ohne Netz keine Buchung vom Sperrbildschirm (Stufe 2).
- Kein Commit vor `APPROVED`.
