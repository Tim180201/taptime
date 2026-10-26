# Aktuelle Aufgabe

> **Stand 26.10.2026:** T-099b fertig (`eebe736`, `1edb047`). Jetzt **T-104e** (D-153, D-154), danach Deploy 9 mit
> T-099b und T-104e. Neue App-Builds macht der PO aus einer sauberen Kopie des freigegebenen Commits.

## T-104e · Sperrbildschirm: Bestätigung trotz laufender Sicherung, keine Leseschleife

**Für:** Development (Astra, Extra High) · **Risiko:** hoch: Sperrbildschirm-Schlüssel, Dauerhaftigkeit gebuchter
Ereignisse, native Module auf beiden Systemen; unabhängiges Review durch einen zweiten Agenten (AGENTS 4) ·
**Zeitbox:** zwei Sitzungen. Reißt sie, wird Punkt 4 geschnitten, nie 1 bis 3 und 5.

**Befund (PO, iPhone, Build 10 zu `e577fa8`, 23.10.):**
- **A:** „Pause starten“ bzw. „Zeit beenden“ auf dem Sperrbildschirm zeigt „Noch nicht bestätigt“ mit „Erneut senden“;
  einige Minuten später bestätigt „Erneut senden“, und die Zeit ist beendet. Code: `LockScreenCoordinator.perform`
  (Backend) prüft nach dem COMMIT einmal `requireOffsiteArchive`; ist das WAL noch nicht extern bestätigt, wirft es
  `LifecycleArchivePendingError`, der Server antwortet 503, der Client zeigt `UNCONFIRMED`. In den Tests bestätigt der
  Archiv-Adapter sofort, deshalb blieb das unentdeckt. In der Produktion dauert die Bestätigung Minuten.
- **B:** „Meine Zeiten“ springt im Sekundentakt zwischen „Zeitraum nicht vollständig geladen“ und den Summen, auch ohne
  laufende Zeit. Hypothese des TL, zuerst belegen: `LockScreenCoordinator` (App) ruft bei jeder neuen
  `ownTime`-Instanz `refresh()`, das `work.refreshPreservingActive()` lädt nur die erste Seite; die Effekt-Schleife in
  `OwnTimeScreen` lädt weitere Seiten, die neue Instanz löst wieder `refresh()` aus. Jeder Durchlauf liest den Server.

### Umfang

1. **Ursachen belegen:** je Befund ein Test, der heute rot ist (A: Archiv-Adapter zuerst nicht, dann bestätigt;
   B: mehrseitige eigene Zeiten mit geöffneter Ansicht, Zählung der Serverlesungen).
2. **A, Antwort bei ausstehender Sicherung (D-153):** Die Aktion bleibt gebucht, der Server antwortet mit Zustand und
   dem Hinweis „Sicherung ausstehend“ statt 503. Der Sperrbildschirm zeigt sofort den neuen Zustand mit dem Zusatz
   „wird gesichert“; die Knöpfe für den nächsten Schritt bleiben nutzbar. Nach „Zeit beenden“ verschwindet die Anzeige
   sofort (D-154). Die Bestätigung holt der nächste Abgleich der App nach, ohne neue Buchung. Installierte Builds behalten ihr
   heutiges Verhalten (Vertragsfassung oder Fähigkeitsmerkmal), Idempotenz und Befehls-ID bleiben.
3. **B, keine Leseschleife:** Der Sperrbildschirm reagiert nur auf Änderungen, die ihn betreffen (aktive Zeit, Pause,
   Ende, Verwaltungsstopp, eigene Erfassung, Sitzung), nicht auf nachgeladene Seiten. Eine offene App ohne Änderung
   liest den Server nicht wiederholt. Beim Neuladen bleibt der geladene Kalender sichtbar, bis der neue vollständig ist.
4. **Anzeige bleibt und geht mit dem Ende (D-154):** Android: laufende Meldung; wird sie ab Android 14 entsperrt
   weggewischt, stellt die App sie sofort wieder her (ohne Ton, ohne neue Mitteilung). iPhone: nach einem Entfernen
   zeigt die App sie beim nächsten Öffnen wieder (bestehender Weg nach acht Stunden). Ende der Zeit entfernt die Anzeige
   sofort statt nach zehn Sekunden; Fehlerzustände bleiben sichtbar.
5. Android auf dieselben Muster wie A und B prüfen (gleiches Serverprotokoll, gleicher App-Koordinator) und mitbeheben.

### Tests und Nachweis
- Rot/Grün für beide Befunde; die bestehenden Prüflisten-Fälle aus T-104b bis T-104d bleiben grün (Flugmodus „Nicht
  gesendet“, 401, 426, Verwaltungsstopp, eigene Erfassung, Kontowechsel).
- Server: ausstehende Sicherung, späte Bestätigung, Wiederholung derselben Befehls-ID, alter App-Build.
- Native Logik auf beiden Systemen; iOS unsigniert lokal bauen wie T-104c. Prüfliste für die Geräteabnahme in
  `.t104e-review/pruefliste.md`.

### Grenzen
D-133, D-146 bis D-148 bleiben: keine Hintergrundstarts, keine neue Zeit von außen, kein Ton, keine weitere Mitteilung.
Kein Server- oder Supabase-Zugriff, kein Deploy, keine EAS-Builds, keine GHCR-Paketaktion, nichts installieren
(AGENTS 3). Die ganze CI lokal nachbauen. Kein Commit vor `APPROVED`.
