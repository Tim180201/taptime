# {{APP_NAME}} · Datenschutzangaben für Apple und Google

**Entwurf, rechtliche Prüfung mit B15.** Technische Bestandsaufnahme aus dem Code, Stand 07.10.2026.
Keine veröffentlichte Datenschutzerklärung. Der PO und B15 prüfen die tatsächlichen Anbieter-
Einstellungen, Verträge, Löschwege und Store-Formulare vor der Einreichung erneut.

## Daten und Zweck

Die Angaben gelten für alle Rollen der App. „Verknüpft“ bedeutet: Die Daten sind über Konto,
Mitgliedschaft oder Installation einer Person zuordenbar. Ein zufälliger Bezeichner ist hier
keine Anonymisierung. Die Daten dienen der App-Funktion, Kontoverwaltung und sicheren Verarbeitung;
keine Werbung, keine Vermarktung, kein Abgleich mit fremden Apps für Werbezwecke.

| Tatsächliche Daten | Apple: vorgesehene Datenart | Google: vorgesehene Datenart | Zweck / verknüpft / Erforderlichkeit |
|---|---|---|---|
| Name, E-Mail; Verwaltung kann andere Mitarbeiter einladen | Kontaktinformationen: Name, E-Mail | Personenbezogene Daten: Name, E-Mail | Konto und Einladung; ja; E-Mail für Anmeldung erforderlich, Namen im Einladungsablauf |
| Konto-, Benutzer-, Mitgliedschafts- und Betriebskennungen, Rolle und Berechtigungsumfang | Kennungen: Benutzerkennung | Personenbezogene Daten: Nutzer-IDs | Zuordnung und Zugriffsschutz; ja; erforderlich |
| Installationskennung, Sequenz, Uhr-/Bootbelege für Offline-Ereignisse | Kennungen: Gerätekennung; weitere technische Daten | Geräte- oder andere IDs; weitere App-Leistungsdaten prüfen | Offline-Zuordnung, Reihenfolge und Plausibilität; ja; erforderlich für diesen Erfassungsweg, keine Werbe-ID |
| Arbeitsereignisse, Beginn/Ende/Pausen, Kunde/Arbeitsziel, zugeordneter betrieblicher Standort, NFC-Kartenkennung | Sonstige Daten, bei Interaktionen Nutzungsdaten | App-Aktivitäten; sonstige personenbezogene Daten | Zeiterfassung und Zuordnung; ja; gewählter Erfassungsweg. Kein GPS und keine laufende Ortung; Karten-/Standortzuordnung kann Arbeitsorte erkennen lassen |
| Kommentare, Nachträge, Korrektur- und Stornogründe, Karten- und Kundennamen | Benutzerinhalte: sonstige Inhalte | App-Aktivitäten: nutzergenerierte Inhalte | Ergänzung/Korrektur/Verwaltung; ja; Kommentar optional, Grund bei entsprechenden Änderungen erforderlich |
| Fehlerklasse, Zeitpunkt, Route, Korrelationskennung; bei Einladungen ausgewählte Konto-/Betriebs-/Akteurkennungen | Diagnosedaten: sonstige Diagnose | App-Informationen und Leistung: Diagnosedaten | Betrieb und Fehlerbehebung; bei Kontobezug ja; kein installiertes Analytics-/Crash-Reporting-SDK im Produktgraphen |

Das Passwort wird bei der Anmeldung an Supabase über HTTPS übergeben, nicht an die Produkt-API.
Supabase verarbeitet die Anmeldedaten und Sitzungen. Lokale Refresh-Tokens liegen im SecureStore;
die Offline-Datenbank ist mit SQLCipher verschlüsselt. Diese lokalen Daten sind getrennt von der
oben beschriebenen Übermittlung zu bewerten. Die API speichert fachliche Daten auf PostgreSQL;
Sicherungen erhalten Kopien. Namen von Kunden oder Freitext können weitere personenbezogene
Angaben enthalten; die Oberfläche fordert keine Gesundheits- oder Zahlungsdaten an.

## Übermittlung und Partner

Produkt-API: Hetzner; Anmeldung: Supabase; Anmelde-/Einladungsmails: über den in Supabase
konfigurierten SMTP-Dienst (laut Betriebsdokumentation Brevo). An jedem Netz-Endpunkt wird technisch
die IP-Adresse verarbeitet. Supabase-/SMTP-Protokollierung und deren Aufbewahrung sind aus dem
Repository allein nicht vollständig feststellbar und vor Einreichung zu prüfen. Die eigene
Diagnoselog-Allowlist enthält keine IP, E-Mail, Passwörter oder Request-Bodies.

Apple: gesammelte Daten einschließlich der Dienstleister angeben, überwiegend mit Personenbezug;
Tracking im Sinn der plattformübergreifenden Werbeverknüpfung: nein. Google: erhobene Daten und
Zwecke wie oben, Übertragung verschlüsselt. Ob die Weitergabe an beauftragte Dienstleister im
Google-Formular unter dessen Dienstleister-Ausnahme fällt, muss B15 anhand der Verträge bestätigen;
„nicht geteilt“ wird hier nicht ungeprüft zugesagt. Keine Datenverkäufe im implementierten Ablauf.

Nicht im Produktcode verwendet: Werbe-ID, Werbe-SDK, Kamera, Mikrofon, Kontakte, Fotos,
GPS-/Hintergrundortung, Gesundheitsdaten oder Bezahlung. NFC liest die zugeordnete Karte; das ist
kein kryptografischer Anwesenheitsbeweis. Die Kategorie für aus Karten/Standorten ableitbare
Ortsinformationen muss B15 im aktuellen Fragebogen ausdrücklich bewerten.

## Löschung und offene Angaben

Ein Entzug des Zugangs löscht keine Arbeitszeithistorie. Korrekturen und Stornierungen erhalten
die Originale; ein durchgängiger Selbstbedienungsweg zur Konten-/Datenlöschung ist noch nicht
implementiert (T-016/B23). Keine sofortige Löschmöglichkeit oder feste Aufbewahrungsfrist im Store
behaupten. Der PO muss mit B15 den beantragbaren Löschweg, öffentliche Kontakt-/Datenschutzadresse,
Aufbewahrung und Umgang mit Sicherungen festlegen und vor Einreichung tatsächlich bereitstellen.

## Codebelege und Formulargrundlagen

- `apps/mobile/src/auth/SupabaseEmailPasswordAuthAdapter.ts`, `ExpoRefreshTokenStore.ts`: Anmeldung,
  Reset und Sitzungsablage; `apps/mobile/src/employees/` und `apps/backend-api/src/BackendHttpServer.ts`:
  Namen/E-Mail bei Einladungen.
- `apps/mobile/src/offline/OfflineInstallationIdentityStore.ts`, `OfflineCaptureDatabase.ts`,
  `OfflineLifecycleClient.ts`, `OfflineCaptureCoordinator.ts`: Installation, Uhr, Belege, Übertragung.
- `apps/mobile/src/timeEditing/TimeEditingControls.tsx`, `TimeVoidControls.tsx`,
  `apps/mobile/src/administration/`: Kommentare, Gründe und Verwaltungsdaten.
- `apps/backend-api/src/diagnosticLog.ts`: explizite Log-Allowlist;
  `apps/mobile/src/offline/OfflineCaptureDiagnostic.ts`: bereinigte lokale Fehlerkategorien.
- `apps/mobile/package.json`, `app.json`, `infrastructure/caddy/Caddyfile`, `infrastructure/SMTP.md`:
  Bibliotheken, Berechtigungen, HTTPS-Grenze und vorgesehene Mail-Zustellung.
- [Apple: Angaben zum App-Datenschutz](https://developer.apple.com/app-store/app-privacy-details/)
  und [Google: Datensicherheitsformular](https://support.google.com/googleplay/android-developer/answer/10787469).
  Die Zuordnung oben ist eine aus dem Code abgeleitete Vorlage, keine Antwort der Stores.
