# Aktuelle Aufgabe

> **Stand 18.09.2026:** T-058 (`3daa09b`), T-043 (`b68e48b`) und T-060 (`1d0a4e9`) sind auf
> `main`, CI grün. Reihenfolge: **T-059 → APK → Geräteabnahme (D-044) → T-049 → Pilot.**
> Der Product Owner hat entschieden: T-059 wird vollständig gebaut, einschließlich des
> Personen-Kalenders; die APK kommt danach.

## T-059 · Mitarbeiter im Handy — wer ist da, wer war wann da, wer kommt dazu

**Für:** Development · **Risiko:** neuer Lesezugang auf fremde Zeiten, Standortgrenze, RLS
**Zeitbox:** vier Sitzungen. **Grundlage:** D-058, D-059, D-062,
`ADO/01_Architecture/Mobile_Entwurf/` (Bildschirme 12, 13, 14, 21, 22). Auftrag vom 18.09.2026.

### Befund (am Quelltext geprüft)

- `read_managed_memberships_v2` (021) liefert Personen je Umfang — Administrator den Betrieb,
  Standortleitung ihren Standort — aber **nichts über laufende Arbeit**. Es gibt nirgends eine
  Zählung laufender Buchungen.
- Zeiten **anderer** Personen liest heute nur `read_effective_time_records_v2` (013/025), und
  zwar administrator-only (`has_current_time_review_administrator_v1`, 012), betriebsweit, ohne
  Personenfilter und ohne Standortbegriff. Für eine Standortleitung existiert kein Weg.
  `read_mobile_own_time_v1` ist ausdrücklich nur für die eigene Person.
- Die Handy-Sitzung kennt den eigenen Standort nicht (`ProductSessionContext` hat ihn nicht);
  die Einladung (T-047) verlangt ihn aber, sobald Standorte eingeschaltet sind.
- Die Kalenderhilfen in `screens/ownTimeCalendar.ts` sind rein und wiederverwendbar; drei
  davon (`timeRecords`, `rangeSummary`, `recordsForDay`) sind auf die Antwortform der eigenen
  Zeiten typisiert.

### Umsetzung

1. **Migration 028 — ein Lesezugang für fremde Zeiten (D-062).**
   `read_managed_person_time_v1(target_membership_id, from_inclusive, to_exclusive, cursor…)`:
   Autorität ist `has_membership_management_authority_v1(… 'read' …)` — also Administrator im
   Betrieb, Standortleitung in ihrem Standort; die Zielperson muss im selben Umfang liegen
   (Heimatstandort). Fenster wie 025 begrenzt (`maximum_calendar_month_range`), Keyset wie
   `read_effective_time_records_v2`, Antwortform **gleich der eigenen Zeiten**
   (`MobileOwnTimeQueryResponse`: `activeRecord`, `records`, `windowStartedAt`,
   `windowEndedAt`, `nextCursor`), damit Kalender und Web dieselben Bausteine nutzen.
   Dazu `read_managed_active_summary_v1(location_id?)`: je Umfang die Zahl der Personen mit
   laufender Buchung und die Gesamtzahl aktiver Mitgliedschaften, plus je Person
   `is_running`, `running_since`, `running_target_display_name` — genau so viel, wie die
   Kachel und die Liste zeigen. Keine neue Rolle, keine Änderung an bestehenden Funktionen;
   RLS und SECURITY DEFINER wie in 021/027. Ein fremder Betrieb sieht nichts.
2. **Backend.** Zwei Routen in `apps/backend-api`, beide über den vorhandenen
   Mitgliedschafts-Manager-Weg (`withMembershipManagementAuthority`, echte Rolle):
   `POST /v1/administration/managed-person-time` und
   `POST /v1/administration/managed-active-summary`. Antworten disclosure-sicher wie C3E1.
3. **Sitzung.** Die Handy-Sitzung trägt zusätzlich `managementScope`
   (`{kind:'organization'}` oder `{kind:'location', locationId, locationName}`) aus
   `read_administration_session_v2`. Die Erweiterung geht in dieselbe ausdrücklich
   angeforderte Antwortform wie `nfcSetupAvailable` — **sie hat noch keinen installierten
   Nutzer**, die APK mit diesem Feld ist noch nicht gebaut. Die alte Antwortform bleibt
   unverändert. Fehlt das Feld, gilt `{kind:'organization'}` nicht als Annahme, sondern der
   Reiter Mitarbeiter bleibt aus.
4. **App — Reiter Mitarbeiter** für Administrator und Standortleitung (neues Ziel
   `employees` in `productDestinations`, Icon und Beschriftung wie die anderen; sichtbar,
   wenn die Sitzung einen Verwaltungsumfang trägt). Drei Ansichten nach dem Entwurf:
   - **Liste (12):** Kachel „x / y gerade aktiv" mit Stand der Serverzeit und Umfang
     („Betrieb" oder Standortname); Umschalter Aktiv/Inaktiv; Zeilen mit Initialen, Name,
     „seit hh:mm · Ziel" bei laufender Arbeit, Punkt mint/aus. Weitere Seiten über den Cursor.
   - **Person (13):** Kopf mit Rolle, Standort, laufender Arbeit; Monatskalender und Tagesliste
     **mit denselben Helfern** wie „Meine Zeiten" (Berlin-Zone, D-056); wo der geladene
     Zeitraum nicht reicht, „—" statt erfundener Summe.
   - **Einladen (14):** Name, E-Mail, Rolle, Standort, „Einladung senden" über die T-047-Route
     (`POST /v1/administration/employee-account-invitations`). Der Server kennt keine Rolle im
     Aufruf — die Eingeladenen sind immer Mitarbeiter; die Rollenzeile zeigt das an und ist
     nicht wählbar, solange es keinen Vertrag dafür gibt (nichts erfinden). Standort:
     Administrator wählt aus der Liste, Standortleitung sieht ihren festgeschrieben. Alle
     Ergebnisse der Route bekommen einen eigenen deutschen Text; bei Fehlern bleiben die
     Eingaben stehen.
   - Ein neuer API-Client nach dem Muster von `TapTimeAdministrationApiClient` (strikte
     Prüfung, 401/403 → `authority_rejected`), ein Coordinator wie `AdminSetupCoordinator`.
5. **Nicht in dieser Aufgabe:** Web (T-049 nutzt dieselben Routen), Rollenwahl beim Einladen,
   Zugang entziehen, Korrektur oder Prüfung am Handy.

### Verifikation und Abschluss

Rotnachweise, jeder zuerst rot: (a) Standortleitung A liest die Zeiten einer Person aus
Standort B → `forbidden`; im eigenen Standort → Erfolg; (b) Administrator liest jede Person
des Betriebs, aber keine eines zweiten Betriebs; (c) Mitarbeiter ruft beide neuen Routen →
`forbidden`; (d) Aktiv-Zusammenfassung: Zahlen stimmen mit den laufenden Buchungen überein,
je Umfang getrennt, eine laufende Buchung einer Person aus Standort B zählt bei
Standortleitung A nicht mit; (e) Fensterprüfung und Keyset wie 025 (Monatsgrenze,
Zeitumstellung Europe/Berlin); (f) Sitzung trägt den Umfang; ohne Umfang kein Reiter; (g)
Einladen vom Handy: Administrator und Standortleitung im eigenen Standort erfolgreich,
fremder Standort `forbidden`, jedes Fehlerergebnis mit eigenem Text; (h) Kalender einer
fremden Person nutzt dieselben Helfer und zeigt „—" außerhalb des geladenen Zeitraums.
Mandantentrennung wie in C3C/C3E1. Suiten: B3, B4, C3C/C3E1/C3E2, C2, Mobile; Typecheck;
Migration ab 001 und auf befülltem 027 mit Daten. Unabhängiges Review (Schwerpunkt: fremde
Zeiten, Standortgrenze, keine Personendaten in Fehlermeldungen), maximal zwei Runden.
Umsetzung nicht vor Technical-Lead-APPROVED committen. Danach APK und Geräteabnahme (D-044).
Bericht nach AGENTS.md §8, ausgelassene Prüfungen mit Grund.
