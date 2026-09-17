# T-047 · Schritte des Product Owners

Vorbereitung für eine spätere, separat freizugebende Auslieferung. Dieser Auftrag führt keine
Produktionszugriffe aus. Die echte Abnahme folgt nach Umsetzungs-Commit und diesen Schritten.

1. **DNS bei INWX abschließen.** Die in Brevo für die tatsächliche Absenderdomain angezeigten
   Authentifizierungseinträge übernehmen und dort prüfen lassen. Bereits laufende DNS-Arbeiten
   berücksichtigen; keine Beispielwerte oder zweite SPF-Einträge hinzufügen.
2. **Brevo in Supabase eintragen.** Unter Authentication → SMTP Settings Custom SMTP aktivieren,
   SMTP-Host, Port, Login und SMTP-Schlüssel aus Brevo übernehmen. Verifizierte Absenderadresse
   verwenden, Absendername **Taptura**. Brevo-Schlüssel ausschließlich im Supabase-Dashboard
   verwahren, nicht auf unserem Server. Link-Tracking für diese Mails abschalten. Unter
   Authentication → Rate Limits die Versandgrenze für den eigenen SMTP-Versand prüfen.
3. **Deutsche Vorlage einsetzen.** Betreff und HTML aus
   [T-047-Einladungsvorlage.md](T-047-Einladungsvorlage.md) unter Invite user eintragen.
   Die Platzhalter erhalten; sie gehören nicht durch echte Schlüssel oder Beispiel-Links ersetzt.
4. **Redirect freigeben.** Unter Authentication → URL Configuration → Redirect URLs genau
   `https://admin.tb-infra.de/willkommen` ergänzen, ohne Wildcard, Query oder Fragment.
   Vorhandene Passwort-Recovery-Redirects erhalten. Bei einer anderen Web-Domain müssen der
   konfigurierte Backend-Redirect und dieser Eintrag gemeinsam auf dieselbe Adresse zeigen.
   Die bestehende Caddy-SPA-Auslieferung unterstützt die neue Route über `/index.html`.
5. **service-role-Schlüssel selbst eintragen und Verwahrung bestätigen.** Ausschließlich in
   `/opt/taptime/.env`, Datei root-eigen und Modus `0600`; niemals in Chat, Git, Abbild,
   Bauargument, Shell-Befehlsargument oder Screenshot. Der Variablenname lautet
   `SUPABASE_SERVICE_ROLE_KEY`. In derselben Datei den öffentlichen Wert
   `TAPTIME_EMPLOYEE_INVITATION_REDIRECT_URL=https://admin.tb-infra.de/willkommen` setzen.
   Die bestehende Compose-Konfiguration liest diese Datei erst zur Laufzeit. Keine Werte
   in Bauparameter übernehmen. Ohne Schlüssel oder Redirect startet das Backend weiter;
   Einladen meldet „Kontenerstellung nicht eingerichtet“ (`account_creation_not_configured`).

Der Product Owner legt DNS/SMTP/Vorlage/Redirect und Schlüssel an, ändert bzw. rotiert sie und
entfernt sie bei Ablösung. Mitgliedschaften werden über die bestehende Verwaltung gesperrt;
die umfassende Löschfähigkeit bleibt T-016.

## Benannte Antworten und Fehlerfallbetrieb

Nur die Operation Einladen verwendet den Schlüssel: zuerst für eine auf die eingegebene
Adresse gefilterte Kontosuche, dann gegebenenfalls für `POST /auth/v1/invite`. Die Suche
vergleicht die vollständige normalisierte Adresse, da Supabases Filter auch Teiltreffer liefert.
Die Adresse wird dabei im `filter`-Query-Parameter an Supabase übertragen und kann dort in
Zugriffsprotokollen stehen; dies ist beim AVV mit Supabase zu berücksichtigen.
Jeder Provider-Aufruf erzeugt eine Diagnose mit Betrieb, handelnder Mitgliedschaft und
Adress-Fingerabdruck. Bei lokalem Rollback nach Remote-Erfolg wird zusätzlich die erhaltene
Konto-ID protokolliert. Kein Klartext der Adresse, kein Antworttext des Providers, kein Schlüssel.

| Fall | Sichtbare Antwort / Ergebnis |
|---|---|
| Neues Supabase-Konto angelegt und lokal gebunden | `succeeded`: Einladung verschickt |
| Bestehendes Supabase-Konto ohne lokale Identitätsbindung | `succeeded_existing_account`: Konto aufgenommen, keine Mail verschickt; Administrator informiert die Person selbst über Anmeldung mit vorhandenem Passwort oder „Passwort vergessen“ |
| Konto und aktive Mitgliedschaft im erlaubten Verwaltungsumfang | `membership_exists`: bereits Mitglied; keine zweite Mail |
| Konto und ausgeschiedene Mitgliedschaft im erlaubten Verwaltungsumfang | `former_membership`: ausgeschieden; Zugang bleibt gesperrt |
| Konto bereits an eine andere Organisation gebunden | `email_exists`: „Diese Adresse gehört bereits zu einem anderen Betrieb“; keine Mehrfachmitgliedschaft |
| Mitgliedschaft im selben Betrieb außerhalb des erlaubten Standortumfangs | `forbidden`: Aufnahme nicht erlaubt; keine Auskunft über den anderen Standort |
| Provider lehnt die Adresse ab | `invalid_email`: Adresse prüfen |
| Provider erlaubt Mailversand nicht | `invitation_delivery_failed`: Mailversand prüfen |
| Eigene oder Supabase-Versandgrenze erreicht | `invitation_rate_limited`: später erneut versuchen |
| Dienst vor Einladen nicht erreichbar oder unerwartete Fehlerantwort | `invitation_service_unavailable`: Anmeldedienst nicht erreichbar |
| Unklarer Versandabschluss oder lokaler Fehler nach Remote-Erfolg | `invitation_needs_attention`: Konto/Mail kann existieren; erneuter Aufnahmeversuch kann die fehlende lokale Bindung herstellen |

Supabase antwortet bei einer bestätigten bestehenden Adresse mit HTTP 422 `email_exists`;
ein unbestätigtes bestehendes Konto würde Supabase erneut einladen. Unsere vorgeschaltete
Suche erkennt beide Fälle und verschickt bewusst keine weitere Einladung. Fehlt die lokale
Bindung, wird das Konto atomar aufgenommen. Tritt Supabases Duplikatantwort erst nach der Suche
auf, wird das Konto erneut gesucht und anhand der lokalen Bindung eingeordnet. Die
Provider-Antwort allein bedeutet nicht, dass ein anderer Betrieb existiert. Der Name eines
fremden Betriebs oder Standorts wird niemals offengelegt. Bestehende Bindungen werden nicht
umgeschrieben; es gibt keine automatische Reaktivierung. Eine vorhandene Bindung ohne jede
Mitgliedschaft bleibt ein benannter Klärungsfall.

Supabase und PostgreSQL bilden **keine gemeinsame Transaktion**. Benutzer, Mitgliedschaft,
Identitätsbindung, Heimatstandort und Wiederholungsbeleg in unserer Datenbank entstehen dagegen
atomar. Scheitert der Provider, entstehen keine halben lokalen Daten. Scheitert der lokale
Commit nach erfolgreichem Provider-Aufruf, kann das externe Konto samt Mail bereits bestehen.
Ein erneuter Aufnahmeversuch findet dieses Konto und legt die fehlenden lokalen Daten in einer
Transaktion an, ohne zweites Konto und ohne zweite Mail. Das Ergebnis lautet dann
`succeeded_existing_account`; die Person kann gegebenenfalls auch den bereits erhaltenen Link
nutzen. Der Administrator informiert sie selbst. Bleibt ein Klärungsfall bestehen, prüft die
Betriebsverwaltung anhand der Korrelations-/Konto-ID den Stand und stimmt die Reparatur mit dem
Technical Lead ab; ein solcher Produktionszugriff braucht eine eigene Freigabe. Kein
automatisches Löschen externer Konten und keine automatische Umbindung. Erfolgreiche
Wiederholungen derselben Auftrags-ID verwenden den gespeicherten Beleg, erhalten die ursprüngliche
Erfolgsart und senden keine zweite Mail.

Der Backend-Vorgang legt `employee_account_invitation_receipts` an. Belege werden nicht geändert;
der Anwendung sind nur Einfügen und Lesen erlaubt. Sie bleiben nach Mitgliedschaftssperrung als
Wiederholungsnachweis erhalten. Aufbewahrung und Entfernung zusammen mit personenbezogenen
Kontodaten sind Teil der noch offenen Löschfähigkeit T-016.

## Bestehende Code-Strecke

Der einzige Aufruf zur **Erzeugung** eines Codes aus der produktiven Beschäftigten-Oberfläche
ist ersetzt. Der alte Coordinator-Einstieg in `apps/admin-web/src/AdminWebCoordinator.ts:973`
bleibt erhalten (77 Zeilen einschließlich Leerzeile bis vor dem nächsten Methodeneinstieg); sein API-Aufruf liegt
in `apps/admin-web/src/AdminWebApiClient.ts:273`. Die alte Backend-Route bleibt registriert.
Die **Einlösung** hat weiterhin einen produktiven Mobile-Aufrufer:
`apps/mobile/src/auth/TapTimeEmployeeEnrollmentApiClient.ts:20`. Die Gesamtstrecke ist damit
nicht verwaist. Nichts davon wird in T-047 entfernt; Entfernung ist eine separate Entscheidung.

## Abnahme

Abnahme nach Commit und freigegebener Auslieferung: im Bereich Beschäftigte an ein echtes
Postfach einladen, Mail auf einem echten Handy öffnen, Passwort setzen, App öffnen und
anmelden. Die Mitgliedschaft muss sofort verfügbar sein, ohne Code. Die Passwort-Seite darf
nach Erfolg ausschließlich „Jetzt die App öffnen und anmelden.“ anzeigen. Ein grüner lokaler
Test ersetzt weder Mailzustellung noch Geräteabnahme.

Quellen: [Supabase Redirect-URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Einladungsvorlagen](https://supabase.com/docs/guides/auth/auth-email-templates),
[Invite-Implementierung](https://github.com/supabase/auth/blob/master/internal/api/invite.go),
[gefilterte Admin-Kontosuche](https://github.com/supabase/auth/blob/master/internal/api/admin.go).
