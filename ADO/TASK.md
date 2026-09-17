# Aktuelle Aufgabe

## T-054 · Rückbau des eingefrorenen Prüfapparats

**Für:** Development · **Risiko:** versehentliches Löschen von Tragendem
**Zeitbox:** zwei Sitzungen; bei Überschreitung nach der letzten grünen Stufe abbrechen und
offene Stufen melden. **Grundlage:** D-053, externes Audit, vom Technical Lead bestätigt.

### Zweck und Grenzen

Löschaufgabe: Der eingestellte Prüfapparat verschwindet aus Projekt, Build und Testauswahl.
Neue Implementierung entsteht nur, wo das Löschen eine echte Lücke hinterlässt. Keine neue
Nutzerentscheidung; `Trigger → WorkEvent → BusinessEngine → TimeEntry`, unveränderliche
Historie und trigger-agnostische Domäne bleiben erhalten. Development entfernt die alten
Einheiten nach Referenzbeleg; ein neuer fachlicher Lebenszyklus entsteht nicht.

- Keine Server-Endpunkte entfernen, auch keine alten: `/v1/session` und Scan-Context bleiben.
- Die produktive Android-APK-Baustrecke bleibt vollständig; ihre Aufrufkette am Code prüfen.
- Keine Datenbankmigration entfernen oder verändern (gespeicherte Prüfsummen).
- Kein Deploy, kein Produktionszugriff, kein T-052.

### Reihenfolge — jede Stufe vollständig und für sich grün

1. **`apps/synthetic-android-e2e`:** Paket, Workspace-/Build-Anbindung und betroffene CI-Jobs.
2. **Mobile DA5/Synthetic:** sieben `android:da5-v5:*`-/`android:synthetic-e2e:*`-Skripte samt
   Dateien unter `scripts/` und zugehörigen Tests. `android:offline-storage-boundary:verify`
   und `android:production-validation:build` am Code als produktiv oder Apparat einordnen
   und den Befund melden; produktive APK-Strecke erhalten.
3. **`apps/backend-b1-spike`:** Wegwerf-Paket samt eigenem CI-Job; produktive PostgreSQL-Tests
   bleiben bestehen.
4. **Alter mobiler Scan-Ablauf:** `ProductScanOrchestrator`, `ProductScanContextResolver`,
   `SessionBoundScanContextResolver`, `TapTimeScanContextApiClient` und
   `ProductMobileRuntime.serverTransport.scanContext`. `compositionBoundary.test.ts` durch
   eine Prüfung der tatsächlichen Verdrahtung ersetzen, nicht durch Quelltext-Zeichenfolgen.
5. **Unbenutzte Core-Dienste:** `OrganizationManagementService`, `MembershipService`,
   `OrganizationAdministrationService`, Barrel-Exporte, Tests und zugehörige gebaute Artefakte
   in `packages/core/dist/`. Versionierung von `dist/` prüfen und einschätzen; nur Nötiges ändern.
6. **Projektgedächtnis:** STATUS und ARCHITECTURE auf ausgeführten Code bringen. Migrationen
   aus Dateien, Routen aus `BACKEND_HTTP_ROUTES`, Rollen aus dem Schema ableiten; Betrieb,
   Offline v4 und überholte Aussagen korrigieren. Synthetic-Drifts aus T-035 streichen.
   Diese Stufe beschreibt das Ergebnis und gehört erst ans Ende.

### Belege, Verifikation und Freigabe

- **Vor jeder Löschung:** Referenzsuche über das ganze Repository für jede entfernte Einheit;
  belegen, dass kein produktiver Pfad sie benötigt. Grüne Tests allein sind kein Löschbeleg.
- Nach jeder Stufe: Typecheck nachweislich einschließlich Tests und vollständige Tests aller
  betroffenen Workspaces. Gelaufene Tests vorher/nachher melden und Rückgang erklären.
- Zum Abschluss: Zeilen vorher/nachher je Bereich. Unabhängiges Review, maximal zwei Runden.
- Zuerst eigener Dokumentations-Commit, sofort pushen: ausschließlich `ADO/` und `AGENTS.md`,
  einschließlich der vorhandenen TL-Ergänzung zur Betriebsdokumentation in §7.
- Umsetzung nicht vor `APPROVED` committen oder pushen. Nach Freigabe jede Stufe als eigenen
  Commit in obiger Reihenfolge pushen. Stufe 6 ist kein vorgezogener Dokumentations-Commit.
- Bericht nach `AGENTS.md` §8, zusätzlich je Stufe: entfernt, Referenzbeleg, Testzahl.
