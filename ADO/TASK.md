# Aktuelle Aufgabe

> **Stand 28.09.2026:** Produktion auf `e13916b` (T-083 ausgeliefert; Migrationen bis 034). Auf `main` zusätzlich T-080
> (`7bd7877`, App). Reihenfolge (PO 28.09., D-097): App-Builds → Rest der Geräteabnahme → **T-086/T-087** → T-084 →
> T-085 → T-088 (D-098) → ein Deploy, ein App-Build → T-024 → Pilot Monat 1. Frühere Briefs stehen in der Git-Historie.

## T-086 + T-087 · Kunde anlegen mit Standort, auch am Handy; Kalendertag springt zu den Zeiten (D-097)

**Für:** Development · **Risiko:** Mandantentrennung und Standortgrenze (neue Schreibrechte für die Standortleitung),
Standort-Invariante aus 019 · **Zeitbox:** eine Sitzung. Eine Migration `035`, `apps/backend-administration`,
`apps/backend-api` (Route/Typen), `apps/admin-web` (Einrichtung, Kalender), `apps/mobile` („Tag zuordnen“, Kalender),
deren Tests. Keine Änderung an Zeiten, Export, Offline-Abgleich oder Betriebsskripten.

### Befund (Code, 28.09., nicht am Gerät beobachtet)

`createCustomer` (`AdminWriteSessionCoordinator.ts:180`) legt nur `customers` an; der Trigger aus 013 erzeugt das
aktive Arbeitsziel. Bei `locations_enabled` prüft `customers_enabled_location_setup` (019, verzögert) beim Commit
`location_setup_is_complete_v1`, das für jedes aktive Arbeitsziel genau eine Standortbindung verlangt → 23514. Das
Ergebnis (`CreateCustomerResult`) kennt diesen Fall nicht. Anlegen darf heute nur der Administrator
(`has_current_admin_setup_authority`, 007; die TS-Vorprüfung `:872` lässt die Standortleitung durch, SQL nicht).
In der App gibt es kein Anlegen; `AdminSetupScreen.tsx:53` verweist ohne Kunden aufs Admin-Web.

### Auftrag

**A. Rot zuerst.** PostgreSQL-Test: Betrieb mit eingeschalteten Standorten, Administrator legt einen Kunden an →
heute Fehler beim Commit (Status und Fehlerbild im Bericht festhalten).

**B. Anlegen mit Standort in einer Transaktion.** Der Befehl bekommt eine optionale `locationId`. Standorte aus:
ohne `locationId` wie heute; mit `locationId` → `invalid_request`. Standorte ein: `locationId` Pflicht, sonst neues
Ergebnis `location_required`; Kunde und Bindung (`work_target_location_assignments`, wie `set_work_target_location`)
in derselben Transaktion, ein Beleg (Receipt) mit der echten Rolle. Idempotenz über die vorhandene `commandId`
unverändert; gleiche `commandId` mit anderem Standort ist ein Konflikt wie heute bei anderem Namen.

**C. Standortleitung darf anlegen, nur im eigenen Standort.** Neue SQL-Funktion (SECURITY DEFINER, Muster
`has_current_nfc_setup_authority_v1` aus 027): Administrator immer (bei Standorten nur aktive Standorte des eigenen
Betriebs); Standortleitung nur bei eingeschalteten Standorten und aktiver Verwaltungszuweisung für genau diesen
Standort. Die RLS-Einfügeregeln für `customers` und die Bindung entsprechend; nicht nur in TypeScript. Kunden
bearbeiten, deaktivieren, umhängen und alle Standortbefehle bleiben Administrator. Der Reiter „Tags“ erscheint für
eine Standortleitung mit Verwaltungszuweisung auch dann, wenn ihr Standort noch keinen Kunden hat (sonst kann sie den
ersten nie anlegen): die Organisationsprüfung (`requested_customer_id IS NULL`) verlangt dann nur die Zuweisung,
die Prüfung für einen bestimmten Kunden bleibt unverändert.

**D. Web.** „Neuen Kunden anlegen“ zeigt bei eingeschalteten Standorten eine Standortauswahl (Pflicht, vorbelegt,
wenn es nur einen gibt); `location_required` und `forbidden` mit verständlicher Meldung (Art aus T-079).

**E. App.** In „Tag zuordnen“ ein „+ Neuer Kunde“: Name eingeben; Standort automatisch, wenn die Person genau einen
verwaltet (Standortleitung) oder es nur einen gibt, sonst Auswahl; nach dem Anlegen Ansicht neu laden, neuen Kunden
vorauswählen, weiter mit dem Scan wie bisher. Der leere Zustand verweist nicht mehr aufs Admin-Web. Nur online; ohne
Verbindung ein klarer Hinweis, keine Offline-Warteschlange.

**F. T-087 Kalender.** App (`TimeCalendar.tsx`, eigener `ScrollView`): Tippen auf einen Tag scrollt zur Tagesüberschrift
unter dem Kalender; bei reduzierter Bewegung (`useReducedMotion`) ohne Animation; Monatswechsel scrollt nicht. Web
(`apps/admin-web/src/TimeCalendar.tsx`): nur in der schmalen Ansicht, in der die Tagesliste unter dem Kalender steht,
`scrollIntoView` auf die Tagesliste (`prefers-reduced-motion` beachten); breite Ansicht unverändert.

### Tests

Rot vor Grün mit PostgreSQL: (1) A; (2) Administrator mit Standort grün, ohne Standort `location_required`, mit
Standort bei ausgeschalteten Standorten `invalid_request`; (3) Standortleitung A legt in A an, in B `forbidden`,
bei ausgeschalteten Standorten `forbidden`; Mitarbeiter `forbidden`; (4) Wiederholung mit gleicher `commandId`
liefert denselben Kunden, andere Standort-ID ist Konflikt; (5) Standortleitung ohne Kunden sieht „Tags“, darf aber
keinen fremden Kunden zuordnen (T-060-Suite bleibt grün); (6) App: Anlegen und Vorauswahl, Offline-Hinweis; (7) App
und Web: Tagesklick ruft das Scrollen mit der Position der Tagesüberschrift auf, reduzierte Bewegung ohne Animation.
Bestehende Suiten, Typecheck, Lint.

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Geheimnisse, kein App-Build. Kein Reiter „Kunden“, keine Stunden je Kunde,
kein Kontingent (T-084, T-085). Keine Änderung an Kalenderformel, Export oder Offline-Abgleich.

### Bericht

`.t086-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf Mandanten- und
Standortgrenze und die Standort-Invariante aus 019. Kein Commit vor `APPROVED`.
