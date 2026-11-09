# Aktuelle Aufgabe

> **Stand 09.11.2026:**
> - T-143 ist auf main (`2f37db2`). CI und Image sind grün.
> - Jetzt T-142, danach ein gemeinsamer App-Build mit T-141, T-143 und T-142.

## T-142 · „Meine Zeiten“ schnell

**Für:** Development (Astra, Extra High) · **Risiko:** mittel. Die Abrufe hängen mit dem Sperrbildschirm zusammen
(T-143). Berührt die Änderung dessen Weg, gibt es ein unabhängiges Review (AGENTS 4) · **Zeitbox:** zwei Sitzungen.
Reißt sie, wird Hebel 4 geschnitten.

### Befund (PO 31.10. und 09.11.)

„Meine Zeiten“ braucht bei jedem Öffnen spürbar lange, bis alles da ist: am iPhone 1–3 s, am Android 3–5 s, mit gutem
Netz.

### Was der TL im Code sieht (zu prüfen)

- **Seiten:** Eigene Zeiten kommen in Seiten zu 20 Einträgen, einschließlich Details und Kalender je Eintrag, und zwar
  eine nach der anderen für diesen und den letzten Monat. Das Höchstmaß 20 legt der Vertrag fest
  (`MOBILE_OWN_TIME_LIMIT_MAXIMUM`).
- **Öffnen:** Jedes Öffnen ruft `refresh()` auf und liest damit alle Seiten neu (`readPreservingActive`). Jedes `read`
  holt dazu die Arbeitsziele.
- **Zusätzliche Abrufe:** Bestätigungsabrufe aus T-140 und der neue Durchlauf aus T-143 lösen weitere vollständige
  Abrufe aus. Diese verdrängen sich gegenseitig.
- **Seit T-140:** Vor und nach jedem Abruf liest und schreibt die App die Offline-Datenbank.

### Umfang

1. **Zuerst messen**, mit den Pilotgrößen aus `tests/pilot-size/`: eine Lehrkraft mit zwei vollen Monaten und eine
   Standortleitung. Je Öffnen erfassen:
   - die Zahl der Anfragen;
   - die Serverzeit je Anfrage;
   - die Datenmenge;
   - die Rechenzeit in der App bis zur vollständigen Anzeige, getrennt nach Netz, Server, Offline-Datenbank und Rendern;
   - was die Nutzerin in jedem Moment sieht: beim ersten Öffnen nach dem App-Start und bei jedem weiteren Öffnen.
2. **Dann die größten Hebel umsetzen**, belegt durch die Messung:
   1. **Sofort zeigen:** Ein bekannter, bestätigter Kalender bleibt beim Öffnen sichtbar und wird still ersetzt, sobald
      der neue vollständig ist. Kein Lade-Bildschirm, wenn schon Daten da sind.
   2. **Abrufe bündeln:** Gleichzeitige Anstöße teilen sich einen laufenden Abruf, danach folgt höchstens einer. Für den
      Sperrbildschirm muss weiter gelten, was T-143 sichert: Er bekommt nach seinem `suspend` einen gültigen Abgleich.
   3. **Nicht unnötig neu laden:** Beim Öffnen nur neu laden, wenn sich etwas geändert haben kann. Den Auslöser legt
      Codex vor und begründet ihn.
   4. **Größere Seiten:** Nur wenn die Messung es verlangt. Das braucht eine Server- und Vertragsänderung; alte
      App-Builds mit 20 Einträgen müssen weiter funktionieren. Dann kommt der App-Build erst nach dem Deploy.
3. **Keine neue Speicherung eigener Zeiten auf dem Gerät** ohne Rückfrage beim TL (AGENTS 1.5).
4. **Ziel:**
   - Bekannte Inhalte sind sofort da.
   - Bei Pilotgröße und gutem Netz ist „Meine Zeiten“ in unter 1 s aktuell.
   - Je Öffnen höchstens ein vollständiger Abruf.

### Tests und Nachweis

- **Messung vorher und nachher** mit demselben Werkzeug, als Tabelle im Bericht.
- **Anfragezählung:**
  - Zweimal öffnen ergibt höchstens einen vollständigen Abruf.
  - Mehrere gleichzeitige Anstöße ergeben einen Abruf und höchstens einen Folgeabruf.
- **Grün bleiben:**
  - die Regressionen aus T-140, darunter R1 und die Bestätigung;
  - die Regressionen aus T-143 (verdrängter Abgleich, veralteter Tipp, Netzfehler);
  - T-104e (keine Leseschleife, Kalenderwechsel nur mit vollständigen Seiten).
- **Bei Hebel 4:** API- und Vertragstests und der Nachweis, dass Anfragen mit 20 weiter angenommen werden.
- **Builds und CI:** Android-Release-Build, iOS-JS-Export, ganze CI lokal nachgebaut.
- **Bericht:** `.t142-review/bericht.md` mit einer kurzen Geräteprüfliste für beide Telefone.

### Grenzen

- Kein Deploy, keine EAS-Builds, kein Server-, Supabase- oder Produktionszugriff, keine GHCR-Paketaktion, nichts
  installieren (AGENTS 3).
- Kein Commit vor `APPROVED`.
