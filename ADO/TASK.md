# Aktuelle Aufgabe

> **Stand 09.11.2026:**
> - T-141 ist auf main (`8363511`).
> - Die CI war wegen eines Datums-Tests rot (Kontingent, seit 01.11.). Mit `011e67e` ist sie wieder grün.
> - Jetzt T-143, danach T-142, dann ein gemeinsamer App-Build.

## T-143 · iPhone: Sperrbildschirm-Knöpfe öffnen seit Build 12 nur die App (P1, Rückschritt)

**Für:** Development (Astra, Extra High) · **Risiko:** hoch. Es geht um die Sperrbildschirm-Berechtigung (Auth),
deshalb ein unabhängiges Review (AGENTS 4) · **Zeitbox:** eine Sitzung. Ohne belegte Ursache wird nichts geändert;
dann stoppen und melden.

### Befund (PO 31.10. und 09.11.)

- **Auf dem iPhone,** Build aus `b50e85a` mit T-139 und T-140, mit Netz:
  - Zeit in der App starten, die App mindestens 10 s offen lassen, dann sperren.
  - Die Live-Aktivität zeigt „Läuft seit …“ ohne Zusatz.
  - Pause und Beenden öffnen nur die App und buchen nichts, egal wie lange man wartet.
- **Mit Build 11** (`05bcf51`) wirkten die Knöpfe direkt (D-146).
- **Android** ist nicht betroffen.

Die Knöpfe sind dann Links statt Intents. `canSend` ist also falsch: Es fehlt der Schlüssel, `appBlocked` ist gesetzt
oder `ownCapturePending` ist gesetzt.

### Spuren des TL (nicht bewiesen)

1. **Offline-Vorschau aus T-140:** `LockScreenCoordinator.publishPreview` ruft bei jeder vorläufigen Anzeige
   `awaitOwnCapture()` auf. Die RAM-Vorhersage bleibt nach der Quittung vorläufig, bis `confirmOwnTime` gelaufen ist.
   - Unter iOS setzt `suspend(ownCapture:)` jedes Mal eine neue Nonce und verwirft den Schlüssel, auch wenn schon
     gewartet wird.
   - Android kehrt in diesem Fall früh zurück.
   - `issue` unter iOS gilt nur bei gleicher Nonce und ohne `ownCapturePending`.
2. **Neue Serverabrufe aus T-140:** `requestOwnTimeConfirmation` startet zusätzliche `refreshPreservingActive`-Läufe.
   Ein neuerer Lauf verdrängt den laufenden (`preservingEpoch`).
   - `LockScreenCoordinator.refreshOnce` gibt dann ohne neuen Versuch auf.
   - Folge: kein `project` und kein `issue`.

### Umfang

1. **Zuerst nachstellen, rot:** Ein Integrationstest mit dem echten `LockScreenCoordinator`, `MobileWorkCoordinator`
   und `OfflineCaptureCoordinator` (wie in T-140). Die native Seite folgt der dokumentierten iOS-Semantik von
   `LockScreenEngine.swift`: `foregroundOnly`, Nonce und Schlüssel bei `suspend` und `issue`.
   - Ablauf: online in der App erfassen, Server bestätigt, die App bleibt im Vordergrund.
   - Erwartung: Danach gibt es einen gültigen Schlüssel, `appBlocked` und `ownCapturePending` sind falsch, und
     `canSend` ist wahr.
   - Belegen, welche Änderung aus T-140 den Unterschied macht, zum Beispiel mit abgeschalteter Vorschau.
   - Spur 1 oder 2 bestätigen oder verwerfen.
2. **Ursache beheben, so klein wie möglich.** Diese Schutzregeln bleiben unverändert:
   - Ein veralteter Tipp bucht nie.
   - Der P1-Schutz aus T-140 R1 (neuere native Pause oder neueres Ende) bleibt.
   - D-043, D-146 und D-160 bleiben.
   - Ohne Netz bleibt alles wie in T-140: Die Knöpfe öffnen die App.
   - Kein neuer Weg, einen Schlüssel auszustellen.
3. **Wird ein Abgleich des Sperrbildschirms verdrängt,** darf er nicht still verloren gehen.

### Tests und Nachweis

- **iOS- und Android-Semantik**, jeweils:
  - Erfassung in der App, per Karte und per Sperrbildschirm-Knopf;
  - Rückkehr in den Vordergrund;
  - Pause, Fortsetzen und Beenden in Folge.
- **Die Offline-Vorschau** und die R1-Regressionen aus T-140 bleiben grün.
- **Builds und CI:** Swift-Engine-Tests und Typecheck von Laufzeit und Widget, Android-Release-Build, iOS-JS-Export,
  ganze CI lokal nachgebaut.
- **Bericht:** `.t143-review/bericht.md` mit einer kurzen Geräteprüfliste für beide Telefone.

### Grenzen

- Kein Deploy, keine EAS-Builds, kein Server, kein Supabase, keine GHCR-Paketaktion, nichts installieren (AGENTS 3).
- Kein Commit vor `APPROVED`.
