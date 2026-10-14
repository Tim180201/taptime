# Aktuelle Aufgabe

> **Stand 14.10.2026:** Deploy 5 ist auf `d193725` (Migrationen 053–057). T-119 liegt auf main (`3284c99`, Migration
> 058), ausgeliefert wird es mit T-024. Die Geräteabnahme vom 14.10. ergab einen P1 und drei Befunde: **T-121**.

## T-121 · Befunde der Geräteabnahme Deploy 5

**Für:** Development · **Risiko:** hoch (Teil 1 betrifft die Erfassungskette auf Android) · **Zeitbox:** eine Sitzung für
Teil 1, eine zweite für Teile 2 bis 4; reißt Teil 1, wird allein gemeldet. Nur die App und das Web; kein Server, keine
Migration, kein Deploy.

### Teil 1 · P1: Android erfasst die Karte nur nach Antippen

**Beobachtung (PO, 14.10., neue Prüf-APK zu `d193725`):** Auf Android startet die Karte keine Zeit, solange der Kreis
in „Erfassen“ nicht angetippt wurde.
- App offen auf „Erfassen“, Karte angehalten, nicht getippt: der Statuspunkt oben rechts zeigt kurz „…“ (orange), sonst
  nichts. Keine Zeit, keine Meldung.
- App geschlossen, Karte angehalten: die App öffnet sich, keine Zeit.
- Kreis antippen, dann Karte: Zeit läuft (Lesemodus aus T-112). Start, Stopp und zwei Karten nacheinander stimmen.

**Erwartung:** Android erfasst ohne Antippen, bei offener App sofort und bei geschlossener App beim Öffnen (D-042,
D-043, STATUS „Geräteabnahme“). Das Antippen ist der iPhone-Weg (D-081), nicht der Android-Weg.

**Weg im Code:** System-Intent → `TapTimeNfcIngress.captureActivityCreateIntent/DeliveryIntent` (Kotlin) →
`NativeNfcIngressLifecycle.tick` → `OfflineCaptureCoordinator.captureNativeNfcIngressAuthority` → `scan()` →
`ExclusiveNfcCaptureArbiter` → `ingress.consume()`. Der kurze Zustand „…“ zeigt, dass die Kette bis zum Scan kommt und
ohne Ergebnis endet. Verdächtige, in dieser Reihenfolge prüfen: die Autoritätsgrenze (`intentOrigin`,
`closeProcessStartIntentWindow` nur in der Hintergrundaufgabe, `canStartScan`, `operationFlight`); der Arbiter
(`activeOwner`, ein nicht beendeter Verwaltungs-Scan); die Lesemodus-Registrierung aus T-112
(`registerTagEvent`/`unregisterTagEvent`, verbleibender Lesemodus unterdrückt den System-Dispatch); die Startfolge
seit T-115 und T-120 (`StartupBoundary`, Zeitpunkt von `start()` der Ingress-Lifecycle); `consume()` in
`NativeNfcIngress.ts` (Normalisierung von UID und Zeit). Der letzte grüne Android-Test dieses Wegs liegt vor T-107;
die Ursache kann in jedem Commit seit `831cb29` oder davor liegen.

1. **Rot zuerst:** ein Test über die echte Kette mit simuliertem System-Intent bei offener App
   (`nativeNfcIntentBoundary.test.ts`, `NativeNfcIngress.test.ts`), der heute scheitern muss, wenn die Ursache im
   JS liegt. Liegt sie im nativen Teil, der Test auf der Kotlin-Seite (`TapTimeNfcIngressModule`) oder im
   Config-Plugin (`withNfcTagDispatch`).
2. Ursache benennen, Test grün machen. Die Grenze aus D-043 (keine Erfassung von vor dem Laufzeitstart) bleibt
   bestehen und begründet im Test.
3. Ist die Ursache ohne Gerät nicht zu bestimmen: STOPP und dem TL genau sagen, welche Beobachtung am Gerät fehlt.
   Keine Diagnoseansicht bauen.

### Teil 2 · „Meine Kunden und Projekte“ ohne Altliste (D-135)

Wer Zuordnungen hat, sieht ohne Suchbegriff **nur** „Meine Kunden und Projekte“ und darunter den Hinweis „Weitere
Kunden und Projekte über die Suche“. „Alle Kunden und Projekte“ erscheint nur, wenn keine Zuordnung besteht. Mit
Suchbegriff bleibt die Trefferliste wie heute. Gilt in App und Web für „Manuell“ und „Zeit hinzufügen“ (eigene Zeit:
„Meine“, fremde Person: „Zugeordnete Kunden und Projekte“ dieser Person). Die feste Startleiste, die Auswahlregel und
„Manuell“ ohne Netz bleiben unverändert.

### Teil 3 · Tastatur schließt beim Antippen (App)

In „Manuell“ und „Zeit hinzufügen“ schließt die Tastatur, sobald ein Ziel angetippt wird, so wie beim Tippen neben das
Feld. Der Suchbegriff bleibt stehen.

### Teil 4 · Symbol im Kreis (Android, P2)

Das Symbol „Zeit gespeichert“, das im Kreis von „Erfassen“ das Funkzeichen ersetzt, flackert nach dem PO-Bericht
gelegentlich. Nur ansehen und Ursache notieren, falls sie ohne Gerät erkennbar ist; sonst als P2 im Bericht.

### Tests

Je Punkt rot vor der Änderung: Teil 1 wie oben; Teil 2 mit und ohne Zuordnung, mit und ohne Suchbegriff, für eigene
und fremde Person, App und Web; Teil 3 Tastatur-Ereignis beim Antippen. Alle Suiten, Typecheck, Builds, Bundles und
Browserläufe grün.

### Grenzen

Kein Server, keine Migration, keine Vertragsänderung. Kein Deploy, kein EAS-Build. ADO nicht ändern.

### Bericht

`.t121-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei
P1/P2. Kein Commit vor `APPROVED` durch den TL. Danach neue App-Builds und Nachtest am Android durch den PO.
