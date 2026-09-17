# TapTim.e — Architektur

**Stand:** 17.09.2026 · Ausgeführter Repository-Code ist maßgeblich.
**One Tap. One Decision.** Der Nutzer löst aus; die Engine entscheidet.

## Fachliche Kette

`Trigger (NFC | manuell | nachträglich synchronisiert) → WorkEvent → BusinessEngine → TimeEntry`

Ein Trigger erzeugt niemals direkt einen Zeiteintrag. Das WorkEvent hält das Ereignis fest;
Beginn, Ende, Pause, Ablehnung und Eskalation entstehen in der Engine. Korrekturen ergänzen
Revisionen, ohne die ursprüngliche Aufzeichnung umzuschreiben. Ein NFC-UID identifiziert einen
Tag, beweist aber weder physische Anwesenheit noch Echtheit (D-054).

`packages/core/src` enthält Domäne, Engine, Anwendungsdienste und austauschbare Ports/Adapter.
Die Domäne kennt weder NFC-Bibliothek noch UI oder Datenbank. Produktive Verwaltung liegt in
Backend-Coordinators und Datenbankfunktionen; die unbenutzten Core-Verwaltungsdienste sind entfernt.

## Bausteine und Quellen

| Baustein | Aufgabe |
|---|---|
| `packages/core` | Domäne, Business Engine, Ports; TypeScript ohne UI-Framework |
| `packages/*-contract` | Geteilte, exakt geprüfte und versionierte Verträge |
| `apps/backend-api` | Einziger deploybarer Backend-Dienst; Node 24 und esbuild |
| Weitere `apps/backend-*` | Fachmodule und Schema; zusammen mit API 11 Workspaces |
| `apps/backend-schema/migrations` | 25 SQL-Dateien, Migration 001 bis 025 |
| PostgreSQL 17 | Selbstbetriebene Produktdatenbank; Supabase dient ausschließlich der Anmeldung |
| `apps/mobile` | Expo 57 / React Native 0.86, Android, native NFC-Erfassung, verschlüsselte SQLite-Queue |
| `apps/admin-web` | React/Vite: Übersicht, Beschäftigte, Einrichtung, Arbeitszeiten, Prüfungen |

`BACKEND_HTTP_ROUTES` in `apps/backend-api/src/BackendHttpServer.ts` registriert **52 Pfade**,
inklusive `/health` (**51 API-Pfade**). Migrationen werden durch `loadMigrations()` aus Dateien
mit dem Muster `NNN_name.sql` geladen. Dies sind abgeleitete Bestandszahlen, keine Prüfgrenzen.
Die CI in `.github/workflows/ci.yml` enthält nach dem Rückbau **12 Jobs**.

Der Root-Build verwendet `npm run build --workspaces --if-present`; die Workspaces werden über
`packages/*` und `apps/*` gefunden. Synthetic-Android und B1 sind entfernt. `packages/core/dist/`
ist ignorierter Build-Output, nicht versioniert; der Core-Paket-Einstieg verweist auf `src/index.ts`.

## Identität, Rollen und Mandantentrennung

Supabase authentifiziert. Der Server ordnet `issuer`/`subject` über `identity_bindings` einer
Mitgliedschaft und Organisation zu. Mobile liest weiterhin `/v1/session`; Admin-Web nutzt den
erweiterten Vertrag `/v2/session`. Alte Serverrouten bleiben für ausgelieferte Clients bestehen,
auch die Scan-Context-Routen ohne aktuellen Mobile-Verbraucher.

Migration 020 definiert **`administrator`, `standortleitung`, `employee`**. Standorte, Heimatstandort,
Arbeits- und Verwaltungszuweisungen sowie ihr Aktivierungsweg sind implementiert. Die Funktion
ist pro Organisation einschaltbar. Der Server liefert den erlaubten Verwaltungsumfang und die
zugänglichen Bereiche; die Oberfläche erfindet keine eigenen Berechtigungen.

Mandantenfachdaten sind organisationsgebunden; zusammengesetzte Fremdschlüssel erhalten diese
Bindung. Für jede Anwendungstabelle im Schema `taptime_server` sind RLS `ENABLE` und `FORCE`
erforderlich. Laufzeitrollen haben eng begrenzte Rechte; transaktionslokaler Kontext darf keine
Verbindung überleben. Organisationsübergreifende Archivmetadaten haben eigene Betriebsrollen.
`SECURITY DEFINER`-Funktionen müssen ihre Autorisierung selbst erzwingen; RLS allein ersetzt sie nicht.

## Mobile-Erfassung und Abgleich

`createProductMobileRuntime()` verdrahtet den `OfflineCaptureCoordinator`. Vordergrund-NFC und
native Start-Intents teilen den `ExclusiveNfcCaptureArbiter`; Einrichtung hat einen eigenen
Erfassungsumfang. React erhält schmale Fähigkeiten für Sitzung, Scan, Verwaltung, Arbeitsziele
und manuelle Offline-Erfassung. Tokens, NFC-Rohdaten und private Clients bleiben dahinter.

Der Coordinator bindet verschlüsselte SQLite-Daten an Installation, Benutzer, Organisation und
Mitgliedschaft. Er verwendet Leases **v3**, schreibt zuerst lokal und übergibt den Abgleich an
`OfflineSyncScheduler`. Dessen `OfflineLifecycleClient` verwendet:

- `/v4/lifecycle-events/offline` für Erfassung,
- `/v2/lifecycle-events/reconcile` für Archivabgleich,
- `/v1/offline-review-state/query` für spätere Prüfentscheidungen.

Die Queue-Zeile bleibt bis zum expliziten Nachweis externer WAL-Archivierung erhalten. T-052
trennt Bestätigung, Fortschritt und Löschung: Entscheidung/Prüfgrund werden sofort angezeigt,
unarchivierte Bestätigungen bleiben in SQLite v5 als `confirmed_awaiting_archive`. Die FIFO
sendet danach den nächsten unbestätigten Eintrag; die Oberfläche zählt nur offene Übertragungen.
Ein eigener Nachlauf fragt höchstens eine Vertragsseite pro Minute ab, rotiert über erhaltene
Zeilen und löscht ausschließlich exakt zugeordnete archivierte Zeilen. Er verändert keine
Scan-Rückmeldung. Alle erhaltenen Zeilen zählen weiterhin gegen die Speichergrenzen.
Mobile nutzt ausschließlich den Lease-Client v3; Serverrouten v1–v3 bleiben bestehen.
Migration 024 ergänzt die fehlenden Pausen-IDs im Abgleich v2. Ein echter Restore belegt:
Ein auf dem Telefon erhaltenes Ereignis kann seine unarchivierte Lease verlieren und dann
nicht identisch wiederholt werden. Der Archivnachlauf bewahrt serverseitig fehlende Bestätigungen
weiter auf, spielt sie aber nicht erneut ein; er erzeugt damit auch keinen sichtbaren Lease-Konflikt.
D-055 nimmt die Wiederanlaufzusage zurück; Reparatur T-055.
Der vorhandene Lifecycle-Client und die alte SecureStore-Outbox bleiben für die Wiederaufnahme
bereits gespeicherter Evidenz erhalten. Eskalationen werden zu Prüfposten.

Die Android-APK entsteht über `scripts/buildProductionValidationAndroid.mjs` und das EAS-Profil
`production-validation`. Dieser Weg und seine Konfiguration bleiben erhalten. Der produktive
Backup-Plugin und `verifyOfflineStorageAndroidBoundary.mjs` schützen SQLite/Schlüssel vor
Android-Backup und Geräteübertragung. Die separate physische NFC-Prüfansicht bleibt verfügbar.

## Fachliche Invarianten

- **Eine Zieldimension:** `work_targets` trägt `customer`, `project`, `general_work`.
  Allgemeine Arbeitszeit ist einmalig pro Organisation; Standorte sind Berechtigungsumfang.
- **Historie bleibt:** fachliche Ereignisse und ursprüngliche Entscheidungen werden nicht durch
  Korrekturen ersetzt. Eine Korrektur erzeugt einen begründeten Revisionsdatensatz.
- **Ein Geschäftskalender:** Core definiert Europe/Berlin für Web und CSV sowie die maximale
  Berliner Monatslänge. Migration 025 nutzt eine gemeinsame SQL-Grenze; Nahttests vergleichen
  den Datenbankwert mit beiden Abfrageverträgen und prüfen die wirksamen Funktionsgrenzen.
- **Export bleibt versioniert:** V1, V2 und V3 existieren nebeneinander. V3 enthält Pausen,
  Ortszeit, Personenkennung und Revision. `read_effective_time_entry_export_v3` ruft die
  SQL-Berechnung `effective_work_duration_seconds_v1` auf; keine zweite Rechnung im Client.
- **Pausen sind heute Intervalle:** Pausen-Trigger laufen durch dieselbe Engine; der Zeiteintrag
  bleibt dabei offen. Der beschlossene automatische Abzug aus D-047 ist noch nicht umgesetzt.
- **Migrationen bleiben unveränderlich:** Der Ledger prüft gespeicherte Prüfsummen. Korrekturen
  kommen als neue Migration; keine Entfernung historischer Dateien.

## Betrieb und verbleibende Arbeit

Dockerfiles, `infrastructure/deploy`, Caddy, Diagnoselogging und Monitoring sind vorhanden.
Auslieferung umfasst API, Web-Bündel und Betriebsskripte. Das Gesundheitstor prüft Version und
Web-Inhalt; die Prüfung der richtigen Supabase-Herkunft bleibt T-039.

`infrastructure/backup/` enthält physische Basissicherung, WAL-Empfang/-Archivierung,
Wiederherstellungsprüfung und Aktivierung. `infrastructure/tests/` prüft auch Zeitpunkt-Restore
und Archivierung. D-051 verlangt RPO 0 für bestätigte WorkEvents und RTO vier Stunden.
Ein Repository-Nachweis ist keine Aussage über den gerade ausgelieferten Produktionsstand.

Rollback setzt das Anwendungsabbild zurück; Migrationen laufen ausschließlich vorwärts.
Schemaänderungen müssen die vorherige Anwendung weiter tragen: zunächst hinzufügen, dann
umstellen, erst in einer späteren Auslieferung entbehrliche Struktur entfernen.

Offen sind unter anderem Mitarbeiter-Kontenerstellung und Mailzustellung, Tagesfreigabe,
Ortszeitgrenzen, Pausenautomatik, NFC-App-Auswahl, iOS, CSP, Löschfähigkeit sowie Recht und Store.
Aktuelle Prioritäten: `ADO/PLAN.md`; Auftrag: `ADO/TASK.md`; Entscheidungen: `ADO/DECISIONS.md`.
