# Aktuelle Aufgabe

> **Stand 18.09.2026:** T-058 (`3daa09b`) und T-043 (`b68e48b`) sind auf `main`, CI grün.
> Reihenfolge: **T-060 → T-059 → APK → Geräteabnahme (D-044) → T-049.**

## T-060 · Standortleitung darf im eigenen Standort Tags zuordnen — und einladen kann sie schon

**Für:** Development · **Risiko:** Mandantentrennung, Standortgrenze, SECURITY DEFINER, RLS
**Zeitbox:** drei Sitzungen. **Grundlage:** D-059, D-021, Migrationen 007/009/019/020/021/026.
Auftrag vom 18.09.2026.

### Befund (am Quelltext geprüft)

- **Einladen ist bereits offen.** `has_membership_management_authority_v1` (020, Zeile 208) gibt
  der Standortleitung `invite` nur für Rolle `employee` und nur im gewährten Standort;
  `change_role` ist ihr verwehrt (sie kann keine Standortleitung anlegen oder befördern).
  `employee_account_invitation_v1` (026) und `EmployeeMembershipEnrollmentCoordinator` prüfen
  genau diese Funktion, nichts Administrator-spezifisches. Belegt durch
  `C3E1PostgresEmployeeEnrollment.test.ts:609` und `T047AccountInvitation.test.ts:195`.
  **Hier wird nichts geöffnet, nur bewiesen** (Rotnachweis unten).
- **Tags sind die Mauer.** `has_current_admin_setup_authority` (007, Zeile 336) und
  `has_current_assignment_reassignment_authority` (009, Zeile 210) verlangen Rolle
  `administrator`; `AdminWriteSessionCoordinator.runWithAuthority` (Zeile 868, 896) und
  `NfcTagReassignmentCoordinator.runWithAuthority` (Zeile 353, 379) ebenso, und sie setzen
  `app.membership_role` wörtlich auf `administrator`. Das Sitzungsfeld `setup_available`
  (021, Zeile 69) hängt an derselben Funktion. Die App prüft in `AdminSetupCoordinator`
  (Zeilen 48, 69, 108, 169, 175) auf `role === 'administrator'`.
- Ein Kunde hat keinen Standort; sein Standort ist die Zuordnung seines Arbeitsziels in
  `work_target_location_assignments` (019, Zeile 107). Standortleitung ist nur mit
  `locations_enabled` und einem lebenden Eintrag in `membership_management_location_grants`
  eine Autorität (020, Zeile 286).

### Umsetzung

1. **Migration 027 — Tag-Autorität mit Standortgrenze.** Neue Funktion
   `has_current_nfc_setup_authority_v1(organization_id, customer_id)`: wahr für einen
   Administrator (wie bisher, unabhängig vom Kunden); wahr für eine Standortleitung nur, wenn
   `locations_enabled`, ein gültiger Verwaltungs-Grant besteht **und** der Kunde ein lebendes
   Arbeitsziel in genau diesem Standort hat. `customer_id = NULL` bedeutet „irgendein Kunde im
   Umfang" (für Lesen und Pausen-Tags). `insert_admin_setup_nfc_tag_v1` und
   `lock_admin_setup_active_customer_v1` (007), die Pausen-Tag-Funktion (017) und
   `lock_assignment_reassignment_target_v1` (009) prüfen die neue Funktion mit dem
   betroffenen Kunden. Die RLS-Policies der Rollen `taptime_admin_setup` und
   `taptime_assignment_reassigner` auf `nfc_tags`, `nfc_assignments`, `admin_setup_receipts`
   folgen ihr; `customers`-SELECT für die Standortleitung nur Kunden im eigenen Standort.
   **Unverändert administrator-only:** `customers`-INSERT, alle Standort-Lebenszyklus-Befehle
   (022), `has_current_admin_setup_authority` selbst. Kein DROP, kein Umschreiben von Daten.
2. **Backend.** Beide `runWithAuthority` akzeptieren `administrator` und `standortleitung`
   und setzen `app.membership_role` auf die **tatsächliche** Rolle des Aufrufers (Vorbild
   `withMembershipManagementAuthority`, Zeilen 666–678). Die Entscheidung trifft die
   Datenbank, nicht TypeScript. Keine neuen Routen.
3. **Sitzungsvertrag.** `read_administration_session_v2` bekommt additiv
   `nfc_setup_available` (wahr, wenn die neue Funktion für `NULL`-Kunden wahr ist);
   `setup_available` bleibt, wie es ist (Standorte und Arbeitsziele bleiben Administrator).
   Die Mobile-Sitzung (`/v1/session`, `TapTimeSessionApiClient`, `contracts.ts`) trägt
   `nfcSetupAvailable: boolean`; fehlt das Feld (alter Server), gilt `false`.
4. **App.** `AdminSetupCoordinator` prüft `nfcSetupAvailable` statt der Rolle;
   `productDestinations` zeigt „Tags" nach diesem Feld — Administrator wie heute,
   Standortleitung nur mit Feld. Der Bildschirm zeigt der Standortleitung nur Kunden ihres
   Standorts (Projektion kommt aus dem Backend, nichts wird in der App gefiltert).
5. **Admin-Web:** keine Änderung in dieser Aufgabe. Die Standortleitung ordnet Tags am Handy
   zu (D-058); das Web folgt mit T-049. Bestehende Web-Gates bleiben.

### Verifikation und Abschluss

Rotnachweise, jeder zuerst rot: (a) Standortleitung A ordnet einen Tag einem Kunden mit
Arbeitsziel in Standort B zu → `forbidden`, kein Receipt, kein Tag; (b) dieselbe Zuordnung
für einen Kunden in Standort A → Erfolg, Receipt trägt die echte Rolle; (c) Standortleitung
ohne Grant oder mit `locations_enabled = false` → `forbidden`; (d) Standortleitung legt einen
Kunden an oder ruft einen Standort-Befehl → weiterhin `forbidden`
(`C3CPostgresAdministration.test.ts:1961` bleibt grün); (e) Umhängen (009) über die
Standortgrenze → `forbidden`, innerhalb → Erfolg; (f) Einladen: Standortleitung lädt
`employee` im eigenen Standort ein → Erfolg; in Standort B → `forbidden`; mit Rolle
`standortleitung` → `forbidden`; (g) Sitzung: `nfc_setup_available` wahr/falsch je Fall,
`setup_available` unverändert; (h) App: Reiter „Tags" nur mit `nfcSetupAvailable`,
`AdminSetupCoordinator.test.ts:122` um `standortleitung` erweitert. Mandantentrennung: ein
zweiter Betrieb sieht nichts (bestehende Muster in C3C/C3E2). Suiten: B3, B4, C3C/C3E1/C3E2,
C2, Mobile; Typecheck; Migration lokal gegen den Erstlaufpfad und gegen einen Bestand mit
Daten. Unabhängiges Review (Schwerpunkt Standortgrenze in SQL, Rolle nicht mehr wörtlich),
maximal zwei Runden. Umsetzung nicht vor Technical-Lead-APPROVED committen. Deploy erst
gemeinsam mit T-059 (D-044). Bericht nach AGENTS.md §8, ausgelassene Prüfungen mit Grund.
