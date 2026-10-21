# Aktuelle Aufgabe

> **Stand 19.10.2026:** Deploy 7 ausgeliefert (`1918d5a`, 17.10.). Abgeschlossen und auf main: T-127a (`6b0c867`) und
> T-127b (`c41fc2c`, Archiv, D-143). Reihenfolge für Codex, je ein Auftrag, je ein Review, je ein Commit: **T-104a**,
> **T-104b**, **T-104c**; T-132 (Sicherung, Brief folgt nach Messung) wird vorgezogen, sobald sein Brief steht; T-133
> (Runbook) klein dazwischen. Ausgeliefert wird mit Deploy 8 und neuen App-Builds. Ohne Verbindung des TL zum Mac legt
> Codex den geprüften Stand nach PO-Freigabe als Zweig `review/<aufgabe>` ab (STATUS).

## T-104a · Sperrbildschirm: Schlüssel und Aktionen auf dem Server (D-114, D-146)

**Für:** Development · **Risiko:** hoch (Berechtigung ohne Anmeldung, Zeiterfassung) · **Zeitbox:** eine Sitzung.
Unabhängiges Review. Beginnt jetzt.

### Warum

PO 19.10.: Läuft eine Zeit, sollen „Pause“, „Weiter“ und „Beenden“ direkt auf dem Sperrbildschirm wirken, ohne Entsperren
und ohne die App zu öffnen. Die Anmeldung liegt nach D-133 im Schlüsselbund „nur entsperrt“ und ist bei gesperrtem
Handy nicht lesbar. Deshalb ein eigener, eng begrenzter Sperrbildschirm-Schlüssel (D-146).

### Umfang

1. **Migration (nächste freie Nummer):**
   - Tabelle für Sperrbildschirm-Schlüssel: Betrieb, Zugang, Benutzer, laufende Zeit, Installation (falls vorhanden),
     SHA-256 des Schlüssels (nie der Schlüssel selbst), `issued_at`, `expires_at`, `last_used_at`, `revoked_at`. RLS
     erzwungen, kein direkter Zugriff der Laufzeitrollen; Funktionen nach den Regeln aus T-119 (Katalogtest).
   - `issue_lock_screen_capability_v1` (angemeldet, wie die übrigen mobilen Wege): nur für die eigene, gerade laufende
     Zeit; erzeugt 32 Zufallsbytes, gibt den Schlüssel genau einmal zurück, ersetzt einen älteren Schlüssel derselben
     Zeit und Installation. Gültig bis zum Ende der Zeit, höchstens 24 Stunden; erneutes Ausstellen beim Öffnen der App
     verlängert.
   - `perform_lock_screen_action_v1(schlüssel, aktion, befehls_id)` mit `pause`, `resume`, `stop`: prüft Schlüssel,
     Ablauf, aktiven Zugang, aktiven Betrieb und dass genau diese Zeit noch läuft. **Zustandsprüfung statt Wechsel:**
     `pause` nur ohne laufende Pause, `resume` nur mit laufender Pause, `stop` nur bei laufender Zeit; sonst
     `state_changed` mit dem aktuellen Zustand, ohne Ereignis. Gebucht werden dieselben manuellen Ereignisse wie in der
     App (Pause als Pausen-Ereignis, Beenden als Ereignis des laufenden Ziels; aus der Pause erst Pausenende, dann
     Beenden, D-117), Zeitpunkt = Serverzeit, Herkunft bleibt `manual`. Idempotent über die Befehls-ID.
   - Kennzeichen „vom Sperrbildschirm“ am gebuchten Ereignis und Protokolleintrag; der Verlauf der Zeit im Web
     (Person → Zeit) zeigt es. CSV-Format und `startedVia`/`stoppedVia` bleiben unverändert.
   - Lebenszyklus nach AGENTS 1.5: Wer legt an (Ausstellen), wer ändert (`last_used_at`, Entzug), wer entfernt
     (Ungültig mit Ende der Zeit, Entzug des Zugangs; abgelaufene Zeilen werden nach 7 Tagen gelöscht, vom Ausstellen
     selbst oder einer vorhandenen Wartung).
2. **API:** `POST /v1/lock-screen/capability` (angemeldet) und `POST /v1/lock-screen/action` (ohne Anmeldung, Schlüssel
   im Kopf `Authorization`, nie in URL oder Protokoll). Antwort der Aktion: aktueller Zustand (läuft, Pause seit,
   beendet mit Dauer, Ziel). Begrenzung je Schlüssel (z. B. 10 je Minute). Fehler ohne Auskunft, ob ein Schlüssel je
   existierte.
3. **Verträge** in `packages/mobile-work-contract` (neue Typen, Prüffunktionen), additiv.
4. **Tests (PostgreSQL 17 und HTTP):** Ausstellen nur für die eigene laufende Zeit; fremder Betrieb, fremde Person,
   beendete Zeit, entzogener Zugang, abgelaufener oder ersetzter Schlüssel → abgewiesen; jede Aktion in jedem Zustand
   (auch Verwaltungsstopp dazwischen: kein neuer Start durch „Beenden“); Pause aus und wieder an mehrfach; Beenden aus
   der Pause; Wiederholung derselben Befehls-ID; nur der Hash steht in der Datenbank; Katalogtest; Rotnachweis, dass
   ein blinder Wechsel eine neue Zeit starten würde.

### Grenzen

Keine App- und Web-Oberfläche außer der Verlaufsangabe. Keine Push-Nachrichten. Keine Änderung an D-133, an der
Anmeldung und an bestehenden Wegen. ADO nicht ändern. Bericht in `.t104a-review/`; kein Commit vor `APPROVED`.

---

## Danach: T-104b · Sperrbildschirm Android (D-114, D-146)

**Für:** Development · **Risiko:** mittel (nativ, Hintergrund) · **Zeitbox:** eine Sitzung. Beginnt nach T-104a.

### Umfang

1. **Laufende Benachrichtigung** (eigenes lokales Expo-Modul, Kanal „Laufende Zeit“, leise, dauerhaft): Ziel und
   mitlaufende Arbeitsdauer ohne Pausen wie in „Erfassen“. Zustände: läuft → [Pause] [Beenden]; Pause → „Pause seit
   12:30“, [Weiter] [Beenden]; beendet → kurz „Zeit beendet · 3:42 h“, dann weg. Antippen öffnet „Erfassen“.
2. **Aktionen nativ ohne App:** Empfänger ruft `/v1/lock-screen/action` mit dem Schlüssel auf und aktualisiert die
   Anzeige aus der Antwort. `state_changed` → Anzeige auf den gemeldeten Zustand setzen. Ohne Netz oder bei Fehler →
   App öffnen und dort dieselbe Aktion über den gewohnten Weg mit Zustandsprüfung ausführen (offline sicher).
3. **App-Seite:** Bei laufender Zeit Schlüssel holen und Anzeige starten; nach jeder eigenen Aktion und beim Öffnen
   abgleichen (D-114: Änderungen von außen beim nächsten Öffnen). Schlüssel im verschlüsselten App-Speicher, getrennt
   von der Anmeldung; beim Abmelden und Kontowechsel löschen und Anzeige entfernen.
4. **Erlaubnis** (Android 13+): einmal beim ersten Start einer Zeit mit kurzem Satz; abgelehnt → keine Anzeige, kein
   erneutes Fragen, Hinweis in „Übertragung“.
5. **Tests:** Einheitstests der Zustandslogik und des Abgleichs; Prüfliste für den PO am Gerät (gesperrt: Pause, Weiter,
   Beenden; Flugmodus; Verwaltungsstopp, dann App öffnen; Abmelden).

### Grenzen

Keine iPhone-Änderung, keine Push-Nachrichten, kein Start einer neuen Zeit von außen. Neuer App-Build durch den PO.
Bericht in `.t104b-review/`; kein Commit vor `APPROVED`.

---

## Danach: T-104c · Sperrbildschirm iPhone (D-114, D-146)

**Für:** Development · **Risiko:** mittel bis hoch (Erweiterung, Hintergrundstart, D-133) · **Zeitbox:** eine Sitzung.
Beginnt nach T-104b.

### Umfang

1. **Live-Aktivität** (Sperrbildschirm und Dynamic Island, kompakt und erweitert) über eine Widget-Erweiterung per
   Config-Plugin, verträglich mit Expo SDK 57 und EAS; Bibliothek nur gepflegt und auf exakte Version festgelegt, sonst
   eigenes Plugin. Inhalte und Zustände wie T-104b, Farben aus `shared/brand`.
2. **Knöpfe ab iOS 17** als `LiveActivityIntent`: nativer Aufruf von `/v1/lock-screen/action`, Anzeige aus der Antwort.
   Der Schlüssel liegt in einem eigenen Schlüsselbund-Eintrag „nach erster Entsperrung“; die Anmeldung bleibt
   unverändert „nur entsperrt“ (D-133). Ohne Netz → Anzeige „Kein Netz · App öffnen“, Antippen öffnet die App, die die
   Aktion mit Zustandsprüfung ausführt. iOS 16: Live-Aktivität ohne Knöpfe, Antippen öffnet „Erfassen“.
3. **D-133 bleibt intakt:** Der Start der App durch die Aktion berührt weder JavaScript-Sitzung noch Anmeldung; der
   spätere Start im Vordergrund verhält sich wie heute. Rotnachweis oder Test dafür.
4. **App-Seite** wie T-104b Punkt 3; `NSSupportsLiveActivities`.
5. **Tests:** Einheitstests der Zustandslogik; Prüfliste für den PO am iPhone (gesperrt: Pause, Weiter, Beenden;
   Flugmodus; Verwaltungsstopp; danach normal öffnen; T-115-Nachtest: zehnmal nach langer Sperre öffnen).

### Grenzen

Keine Push-Nachrichten (APNs später), kein Start einer neuen Zeit von außen, keine Änderung an Android. Neuer
TestFlight-Build durch den PO. Bericht in `.t104c-review/`; kein Commit vor `APPROVED`.
