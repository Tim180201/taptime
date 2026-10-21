# Aktuelle Aufgabe

> **Stand 21.10.2026:** T-104b abgeschlossen (`c332b91`). Reihenfolge für Codex, je ein Auftrag, je ein Review, je ein
> Commit: **T-104d**, dann **T-104c**; T-132 (Sicherung, Brief folgt nach Messung) wird vorgezogen, sobald sein Brief
> steht; T-133 (Runbook) klein dazwischen. Ausgeliefert wird mit Deploy 8 und neuen App-Builds. Ohne Verbindung des TL
> zum Mac legt Codex den geprüften Stand nach PO-Freigabe als Zweig `review/<aufgabe>` ab (STATUS).

## T-104d · Android-Meldung im Taptura-Look (D-148)

**Für:** Development · **Risiko:** niedrig bis mittel (nativ, nur Anzeige) · **Zeitbox:** eine halbe Sitzung. Beginnt
jetzt. Entwurf A und C vom 21.10. (PO freigegeben); Verhalten, Abgleich und Schlüssel aus T-104b bleiben unverändert.

### Umfang

1. **Symbol:** eigenes einfarbiges Benachrichtigungssymbol (24 dp, weiß auf transparent) aus der kompakten Geometrie in
   `shared/brand/mark.json`, als Vector Drawable im Modul `taptime-lock-screen`. Es wird aus `mark.json` erzeugt, nie
   von Hand nachgezeichnet; ein Test vergleicht die Datei mit der Erzeugung. Ersetzt
   `android.R.drawable.ic_lock_idle_alarm`.
2. **Farbe:** `setColor` Mint `#7EE0C0` aus `mark.json` (Android passt den Kontrast im hellen Thema selbst an). Kein
   `setColorized`, kein eigenes Layout (Entwurf B verworfen).
3. **Texte:** Titel ist immer das Ziel, darunter der Zustand. Läuft: „Läuft seit 07:24“, Dauer als Chronometer im Kopf.
   Pause: „Pause seit 08:30 · 1:06 h gearbeitet“, ohne Chronometer. Hinweise als zweite Zeile unter dem Ziel: „Wird
   übertragen …“, „Wird gesendet …“, „Nicht gesendet · kein Netz“, „Noch nicht bestätigt“, „Bitte App öffnen“, „Bitte
   App aktualisieren“. Beendet: Titel „Zeit beendet · 3:42 h“, darunter das Ziel. Uhrzeiten in Europe/Berlin.
4. **Knöpfe** mit den Worten der App: „Pause starten“, „Pause beenden“, „Zeit beenden“, „Erneut senden“. Aktionen,
   Reihenfolge und Request-Codes bleiben.
5. **Live Update ab Android 16:** hervorgehobene laufende Meldung über die offizielle Schnittstelle
   (`setRequestPromotedOngoing`, Berechtigung `POST_PROMOTED_NOTIFICATIONS`), nur wenn das System sie erlaubt
   (`canPostPromotedNotifications`); der Chip in der Statusleiste zeigt die Dauer. Nur mit dem vorhandenen compileSdk 36
   und ohne neue Abhängigkeit; geht das nicht, melden und Punkt 5 weglassen. Ältere Android-Versionen zeigen die
   Meldung wie in Punkt 1 bis 4.
6. **Tests:** Kotlin-Logik für alle Texte und Knopfbeschriftungen (Muster `T096NativeAudio.test.ts`), Symbol gegen
   `mark.json`, Manifest (`POST_PROMOTED_NOTIFICATIONS` erlaubt, weiterhin kein Vordergrunddienst), volle Prüfstrecke
   wie T-104b einschließlich Release-Build.
7. **Prüfliste** in `.t104d-review/` ergänzen: Symbol und Farbe im hellen und dunklen Thema; an einem Android-16-Gerät
   Chip in der Statusleiste und aufgeklappte Meldung auf dem Sperrbildschirm.

### Grenzen

Keine Änderung an Verhalten, Abgleich, Schlüssel oder Server; keine iPhone-Änderung; keine weiteren Mitteilungen, kein
Ton (D-148). ADO nicht ändern. Bericht in `.t104d-review/`; kein Commit vor `APPROVED`.

---

## Danach: T-104c · Sperrbildschirm iPhone (D-114, D-146 bis D-148)

**Für:** Development · **Risiko:** hoch (Erweiterung, D-133) · **Zeitbox:** eine Sitzung. Beginnt nach T-104d; der Brief
wird vorher nachgeschärft.

1. **Live-Aktivität** auf dem Sperrbildschirm und in der Dynamic Island (kompakt, minimal, erweitert) über eine
   Widget-Erweiterung per Config-Plugin, verträglich mit Expo SDK 57 und EAS; Bibliothek nur gepflegt und exakt
   festgelegt, sonst eigenes Plugin. **Design nach Entwurf vom 21.10. (D-148):** Grund `#0E1512`, farbiges Zeichen,
   Ziel und Zustand in Manrope (in der Erweiterung mitgeliefert), Dauer groß in Lime `#C9F24D`; Pause: „Pause seit …“
   in Mint, Dauer steht; Knöpfe wie in der App („Pause starten“/„Pause beenden“ zurückhaltend, „Zeit beenden“ in Lime).
2. **Knöpfe ab iOS 17** als `LiveActivityIntent` mit nativem Aufruf von `/v1/lock-screen/action`; Zustände, Texte und
   Fehlerfälle wie T-104b. Schlüssel in einem eigenen Schlüsselbund-Eintrag „nach erster Entsperrung“; die Anmeldung
   bleibt „nur entsperrt“ (D-133). iOS 16: ohne Knöpfe, Antippen öffnet „Erfassen“.
3. **App-Seite** aus T-104b wiederverwenden (Abgleich vor jeder Aktion, „Wird übertragen …“ nach eigener Erfassung,
   kein automatisches Ausführen, 401 beim Ausstellen meldet nie ab). Unter iOS gleicht die App nur im Vordergrund ab
   (D-133); das ist im Brief und in der Prüfliste zu benennen.
4. **D-133 bleibt intakt:** Der Start durch die Aktion berührt weder JavaScript-Sitzung noch Anmeldung; Test dafür.
5. **Tests und Prüfliste** am iPhone wie T-104b, dazu T-115-Nachtest (zehnmal nach langer Sperre öffnen).

Keine Push-Nachrichten (APNs später), keine Änderung an Android. Neuer TestFlight-Build durch den PO. Bericht in
`.t104c-review/`; kein Commit vor `APPROVED`.
