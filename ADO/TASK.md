# Aktuelle Aufgabe

> **Stand 24.09.2026:** Produktion auf `b635c4a`. T-077 (Meine Zeiten für Führungsrollen) ist auf `main`.
> Reihenfolge: **T-076 → ein App-Build für iPhone und Android mit Geräteabnahme → T-024 → Pilot Monat 1**.
> Frühere Briefs stehen in der Git-Historie.

## T-076 · Kontowechsel am Gerät, wenn alles bestätigt ist (ADR-0012)

**Für:** Development · **Risiko:** Arbeitszeit-Evidenz, Konto-Trennung auf einem Gerät, Absturzsicherheit
**Zeitbox:** zwei Sitzungen; Reihenfolge Beleg → Entwurf im Bericht → Tests rot → Umsetzung → Nachweis.
**Grundlage:** ADR-0012 (Abschnitt „Explicit logout“: ein anderes Konto bleibt gesperrt, bis die Warteschlange
des bisherigen Kontos exakt und dauerhaft vom Server bestätigt ist), D-055, D-058, D-090, STATUS „P2
Kontowechsel am Gerät“ (24.09.).

### Befund

`OfflineCaptureDatabase.bindOwner` bindet die lokale Datenbank beim ersten angemeldeten Konto an
Organisation, Nutzer, Mitgliedschaft und Installationsbindung; die Zeile `offline_owner` wird nie gelöst.
Jedes weitere Konto bleibt dauerhaft bei `identity_mismatch`, auch wenn alle Vorgänge bestätigt sind. Das ist
strenger als ADR-0012 und trifft im Pilot die Weitergabe eines Handys und eine neue Mitgliedschaft nach
erneuter Einladung. Serverseitig ist `offline_installations.binding_digest` eindeutig und an genau ein Konto
gebunden; ein neues Konto braucht deshalb eine neue Installationsbindung, nie die alte.

### Ziel

Meldet sich auf einem Gerät ein anderes Konto (oder dieselbe Person mit neuer Mitgliedschaft) an und sind alle
Vorgänge des bisherigen Kontos dauerhaft vom Server bestätigt, arbeitet das neue Konto ohne Sperre: neue
Installationsbindung, frische lokale Datenbank, eigener Lease. Sind noch Vorgänge offen, bleibt die Sperre, und
die App sagt verständlich, was zu tun ist. Fremde Evidenz wird nie gezeigt, umgebunden, erneut gesendet oder
still gelöscht.

### Auftrag

1. **Erst belegen (Stop-Regel):** Am Code zeigen, wie „alles dauerhaft bestätigt“ exakt festgestellt wird
   (keine unbestätigten Ereignisse, kein `review_pending_sequence`, keine geschützten, beschädigten oder
   Legacy-Einträge, keine offene manuelle Bestätigung, kein laufender Abgleich) und dass der Server ein neues
   Konto mit neuer Bindung ohne Änderung annimmt (Installation, Lease, Sequenz). Braucht es eine Server-,
   API-, Migrations- oder Rechteänderung oder eine destruktive Wiederherstellung: stoppen und melden.
2. **Entwurf im Bericht vor dem Code:** Ablauf des Wechsels in Schritten, mit Absturzfolge je Schritt
   (App-Abbruch, Stromausfall, fehlender SecureStore, Datenbank nicht lesbar). Nach jedem Absturz muss die App
   in einen der beiden sicheren Zustände kommen: altes Konto unverändert gebunden oder neues Konto sauber
   gebunden. Nie zwei Konten, nie eine Datenbank ohne passenden Schlüssel.
3. **Umsetzung in `apps/mobile`:** Wechsel nur bei vollständig bestätigter Warteschlange und nur für eine
   aktuell voll angemeldete Sitzung (keine Offline-Wiederherstellung). Neue Installationsbindung, neuer
   Nachschlage- und Datenbankschlüssel, alte lokale Daten erst nach dem sicheren Wechselpunkt entfernen.
   Der bestehende Schutzweg (`protected_pending`, Neustart der Erfassung beim Kontowechsel) bleibt für den Fall
   „noch offen“ erhalten.
4. **Texte:** Noch offen → Titel „Vorgänge eines anderen Kontos offen“, Text sinngemäß: „Auf diesem Gerät warten
   noch Vorgänge eines anderen Kontos auf den Server. Melde dich mit diesem Konto an, damit sie übertragen
   werden; danach kannst du wechseln.“ Keine Namen, Mailadressen oder Zahlen des anderen Kontos. Erfolg ohne
   eigene Meldung. Wo nötig die Abgleich-Seite anpassen.
5. **Nebenbei:** `ios.config.usesNonExemptEncryption: false` in `app.json` (nur Betriebssystem-Kryptografie:
   HTTPS, SQLCipher über CommonCrypto). Im erzeugten iOS-Projekt `ITSAppUsesNonExemptEncryption = false`
   nachweisen.

### Tests

Wechsel bei leerer, bestätigter Warteschlange; Sperre bei unbestätigtem Ereignis, `review_pending`,
geschütztem oder Legacy-Eintrag, offener manueller Bestätigung und während des Abgleichs; Rückwechsel zum alten
Konto bei offener Sperre überträgt dessen Vorgänge, danach Wechsel möglich; neue Mitgliedschaft derselben Person;
Abbruch nach jedem Schritt des Wechsels (Datenbank, SecureStore, Owner-Zeile) landet in einem sicheren Zustand;
neues Konto sieht keine alten Einträge; Android und iOS; bestehende App-Suite und tests-inklusiver Typecheck;
`expo prebuild` für iOS mit der Verschlüsselungsangabe.

### Nicht Teil

Kein Server, keine Migration, keine destruktive Wiederherstellung offener Fremd-Evidenz, kein Kiosk-Modus
(mehrere Personen im schnellen Wechsel), kein App-Build, kein Deploy.

### Bericht

`.t076-review/` (report.md mit Beleg und Entwurf, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit,
kein Push.
