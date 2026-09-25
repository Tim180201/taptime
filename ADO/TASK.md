# Aktuelle Aufgabe

> **Stand 25.09.2026:** Produktion auf `6c7007d` (Migrationen bis 034), App-Builds iPhone 1.0.0 (3) und Android
> versionCode 10 auf demselben Stand. Geräteabnahme läuft. Reihenfolge: **T-080 → ein App-Build → Rest der
> Geräteabnahme → T-024 → Pilot Monat 1**. Frühere Briefs stehen in der Git-Historie.

## T-080 · Die Standortleitung scannt (Befund Geräteabnahme 25.09.)

**Für:** Development · **Risiko:** Offline-Erfassung, lokales Schema mit Bestandsdaten, Rollenwechsel · **Zeitbox:**
eine Sitzung. Nur App und gemeinsamer Vertrag; kein Serververhalten ändern.

### Befund

Eine Standortleitung (auch eine, die vorher Beschäftigte war) sieht auf iPhone und Android „NFC nicht verfügbar ·
Die Scan-Funktion konnte nicht sicher vorbereitet werden.“ Ein frisches Beschäftigten-Konto scannt auf denselben
Geräten. Der Server stellt die Offline-Freigabe für die Standortleitung korrekt aus (Migration 020 hat die
Rollenprüfung erweitert; `lock_offline_active_actor_v1` und die Policies kennen keine Rollengrenze). Die **App**
verwirft sie: `OfflineCaptureLeaseClient.ts:195` akzeptiert nur `administrator` und `employee`; ebenso die lokalen
Prüfungen in `OfflineCaptureDatabase.ts` (1684, 1737), der `CHECK` in `offline_lease_generations` (2041), der
Kontexttyp in `OfflineCaptureCoordinator.ts:1403` und `OfflineMembershipRole` in `packages/offline-sync-contract`.
Ergebnis `unavailable` ohne gespeicherten Kontext → Zustand `unavailable`.

### Auftrag

1. **Rotnachweis zuerst, App:** Test mit einer Freigabe-Seite `role: 'standortleitung'` durch Lease-Client, lokale
   Speicherung und Aktivierung bis „Bereit zum Erfassen“; heute rot. Zweiter Test: bestehende lokale Datenbank
   (Schema V5) mit Zeilen der Rolle `employee` und ausstehender Evidenz, dann Freigabe mit `standortleitung` für
   dieselbe Mitgliedschaft (Rollenwechsel); heute rot.
2. **Rotnachweis Server, PostgreSQL:** Freigabe ausstellen, Offline-Ereignis einspielen und abgleichen für eine
   Standortleitung, einmal frisch, einmal nach Rollenwechsel von Beschäftigte mit bestehender Installation.
   Erwartung: grün ohne Serveränderung. Ist einer rot, stoppen und melden; dann ist der Schnitt anders.
3. **Umsetzung:** `OfflineMembershipRole` um `standortleitung` erweitern; alle Stellen aus dem Befund, gefunden
   per Suche nach `'administrator'` und `'employee'` unter `apps/mobile/src/offline` und
   `packages/offline-sync-contract`. Lokales Schema **V6**: `offline_lease_generations` und jede weitere Tabelle
   mit dieser Rollenprüfung mit erweitertem `CHECK` neu anlegen, Zeilen übernehmen, alte Tabelle entfernen, in
   einer exklusiven Transaktion nach dem Muster V4→V5; `user_version` 6; unbekannte höhere Versionen weiter
   schützen. Kein Datenverlust: Evidenz, Warteschlangen und Sequenzen bleiben bytegleich (Test vergleicht alle
   Tabellen vor und nach der Migration). T-076-Generationen unverändert.
4. Rollenwechsel im laufenden Konto: Nach dem Wechsel holt die App die neue Freigabe; die alte Generation wird nie
   still verworfen. Der Fall aus Punkt 1 (zweiter Test) muss danach „Bereit zum Erfassen“ erreichen, ohne dass
   ausstehende Evidenz verloren geht.
5. Server: nur Typen, falls nötig; kein Verhalten. Backend-Typen `membership_role: 'administrator' | 'employee'`
   in `backend-offline-sync` auf den Vertragstyp umstellen.

### Tests

Die Rotnachweise aus 1 und 2 grün. Vollständige Mobile-Suite und tests-inklusiver Typecheck; Vertragspaket;
Backend-Offline-Sync-Suite mit PostgreSQL. Migrationsprobe der lokalen Datenbank: V5-Datei mit Bestandsdaten →
V6, Replay ohne Änderung, Prüfung, dass jede alte Version (0, 1, 2, 3, 4, 5) weiterhin auf V6 kommt.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse, kein App-Build. Keine Änderung an SQL-Migrationen. T-081
(Beschäftigte nach Standort) nicht.

### Bericht

`.t080-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf die lokale
Schemamigration und den Rollenwechsel. Kein Commit vor `APPROVED`.
