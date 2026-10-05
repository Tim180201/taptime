# Aktuelle Aufgabe

> **Stand 05.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b, T-103, T-095 und T-095b, Auslieferung mit dem nächsten
> Deploy. Reihenfolge: **T-096**, dann T-097, T-098, T-100 bis T-102 → Deploy und App-Builds → T-024 → Pilot. Frühere
> Briefs stehen in der Git-Historie.

## T-096 · App: Version, Neuinstallation, Sicherung, Tags ohne App-Namen (D-119)

**Für:** Development · **Risiko:** App-Start und Gerätespeicher, Auslieferung der Startseite (Caddy), Tag-Inhalt ·
**Zeitbox:** eine Sitzung, bei Bedarf zwei (dann nach Teil C schneiden und berichten). `apps/mobile` (inkl. nativer
Module und `app.config.js`), `apps/backend-api` (Versionskopf, Mindestversion), `infrastructure/caddy`,
`apps/landing-web` (`/.well-known`), Verträge. Keine Änderung an Engine oder Datenbankschreibern.

### Befund

1. Die App sendet keine Versionskennung; der Server kann keine Mindestversion verlangen, eine APK aktualisiert sich nicht
   selbst (F-048). `mobile-session.v2` wurde in T-059 ohne neue Version erweitert (F-143).
2. iOS: Nach Neuinstallation bleibt die alte Installationsbindung im Schlüsselbund, die neue Datenbank beginnt bei
   Sequenz 1 → Konflikt (F-028). Die verschlüsselte Datenbank ist nicht vom iCloud-/Geräte-Backup ausgeschlossen;
   eine Wiederherstellung auf neuem iPhone führt in den Schutzzustand (F-032). Die Erstinitialisierung der Schlüssel ist
   nicht atomar (F-105).
3. Neu beschriebene Tags tragen den Android-Paketnamen der Testvariante (F-052); nach D-119 sollen sie nur unsere Adresse
   tragen.
4. Android-Feedbackmodul: Ausnahmen im Audio-Thread können die App beenden (F-104). iOS: `supportsTablet` ohne
   NFC-Voraussetzung (F-121).

### Auftrag

**A. Version und Mindestversion.** Jede App-Anfrage trägt einen Kopf mit Plattform, Build-Nummer und Commit. Der Server
führt eine Mindest-Build-Nummer je Plattform als versionierte Datei im Repository (Änderung nur per Commit und Deploy,
kein PO-Schritt). Liegt eine App darunter, antworten alle App-Routen mit 426 und einem festen Text; die App zeigt
„Bitte App aktualisieren“ (Zustand aus T-095) und behält alle Belege. Startwert: aktuelle Builds (iPhone 5, Android 12)
gelten als gültig. F-143: neue Sitzungsversion `mobile-session.v3` für die erweiterte Darstellung; v2 bleibt
unverändert für alte Apps.

**B. iOS-Gerätespeicher.** Fehlt die aktive Datenbankdatei, gelten vorhandene Schlüssel als verwaist: neue Generation mit
frischer Bindung (neue Serverinstallation, Sequenz 1 korrekt); Belege einer noch vorhandenen Legacy-Outbox bleiben
unberührt. SQLite-Ordner auf iOS vom Backup ausschließen (`isExcludedFromBackup`), Nachweis analog zur
Android-Speichergrenze. Erstinitialisierung atomar: ein SecureStore-Eintrag für alle drei Werte oder Überschreiben von
Teilschlüsseln, wenn weder Marker noch Datenbank existieren.

**C. Tags ohne App-Namen (D-119).** Neu beschriebene Tags enthalten nur den URI-Datensatz `https://tb-infra.de/tag`
(Hosts aus `tagHosts.json`), keinen Android Application Record. Android: Intent-Filter mit `autoVerify` für die
Tag-Hosts und den Pfad `/tag`; die Startseite liefert `/.well-known/assetlinks.json` öffentlich (ohne Passwortschutz,
ohne Weiterleitung, `application/json`), mit Paketnamen und SHA-256-Fingerabdrücken aller gültigen Varianten aus einer
Datei im Repository. Die Fingerabdrücke liefert der PO aus EAS (öffentliche Werte); bis dahin Platzhalter, die der
Caddy-Test als „nicht ausgefüllt“ erkennt und meldet. Bereits beschriebene Tags (mit Paketnamen) funktionieren weiter.
Kein Android-Auswahldialog beim Scannen bei offener App (T-043/T-044 bleiben grün).

**D. Kleinigkeiten.** Feedbackmodul: Audio-Thread in try/catch, Zustand vor `play()` prüfen, Interrupt still beenden.
iOS: `supportsTablet: false`, `UIRequiredDeviceCapabilities` um `nfc` ergänzen.

### Tests

Rot vor Grün je Teil. Pflicht: (1) App unter Mindestversion → 426 → „Bitte App aktualisieren“, Belege bleiben; gleiche
Version → normal; (2) v2-Sitzung byte-gleich, v3 mit Erweiterung; (3) iOS-Neuinstallation (Schlüssel da, Datenbank weg)
→ neue Generation, kein Konflikt; (4) Backup-Ausschluss gesetzt (Nachweis); (5) Abbruch zwischen den Schlüsseln beim
ersten Start → nächster Start ohne Schutzzustand; (6) geschriebener Tag enthält genau einen URI-Datensatz; (7) echter
Caddy: `/.well-known/assetlinks.json` 200 ohne Anmeldung, übrige Startseite weiter 401; (8) Feedbackmodul-Ausnahme
beendet die App nicht. Volle Suiten (App, API, Caddy, Startseite), Typechecks, Android/iOS-Export, CI-Bauordnung.

### Nicht Teil

iPhone-Erfassen ohne geöffnete App und NTAG 424 (T-073), Store-Eintrag, Umbenennung der App.

### Bericht

`.t096-review/` (report.md, tracked.diff, untracked.txt), mit dem Schritt für den PO (Fingerabdrücke aus EAS) in
einfachen Worten. Unabhängiges Review. Kein Commit vor `APPROVED`.
