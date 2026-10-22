# {{APP_NAME}} · Datenschutzangaben für Apple und Google

> **Entwurf, rechtliche Prüfung mit B15** (Codeabgleich T-134) und vor Einreichung durch den
> Fachanwalt. Entwurf des Technical Lead, keine Rechtsberatung.
> **Stand 22.10.2026 · Systemstand: Migration 062, bis T-104c**
> Technische Vorlage einschließlich noch auszuliefernder Server-/App-Funktionen; keine
> veröffentlichte Datenschutzerklärung und keine bereits eingereichten Store-Antworten.

Anbieter: Einzelunternehmen des PO Tim Bartz (D-116), `[Geschäftsbezeichnung, Anschrift, Kontakt]`.
Der PO verantwortet die Store-Antworten und gleicht vor Einreichung den eingereichten Build,
die Verträge, Anbieter-Einstellungen und die öffentliche Datenschutz-/Löschkontaktseite ab.

## Tatsächliche Daten und Zwecke

Alle Rollen der App sind erfasst. Konto-, Mitgliedschafts- und Installationskennungen lassen
die Zuordnung zu Personen zu; zufällige IDs sind keine Anonymisierung. Produktzwecke:
Zeiterfassung, Zugang, Zuordnung, Korrektur/Prüfung, Offline-Übertragung und Betriebsdiagnose.
Kein Werbe-SDK oder Datenverkaufs-/Werbeverknüpfungsweg ist im Produktablauf eingebunden.

| Daten | Verarbeitung / Erforderlichkeit |
|---|---|
| Name, E-Mail, Konto-/Benutzer-/Mitgliedschafts- und Betriebskennung, Rolle, Standortumfang | Anmeldung und Einladungen, auch anderer Personen; erforderlich für den jeweiligen Zugang/Verwaltungsweg |
| Kunden-/Projektnamen, Kontingente, Mitarbeiterzuordnungen und Verlauf, Kartenkennung | Sichtbare Arbeitsziele und geleistete Stunden; Kunden können natürliche Personen, Schüler und Minderjährige sein; Kontingent/Zuordnung optional |
| Arbeitsereignisse, Zeiten, Pausen, Herkunft, betrieblicher Standort, Kommentare, Änderungen, Stornierungen, Prüffälle | Fachliche Verarbeitung mit unverändertem Original; Kommentare freiwillig, Grund bei fremden Zeiten durch Standortleitung Pflicht, beim Administrator freiwillig; kein Grund beim Stornieren |
| Namensänderung mit altem/neuem Namen; erste/letzte erfolgreiche Sitzungsabfrage als Anmeldestand | Historie bzw. Zugangsverwaltung; erste/letzte Sitzung ist kein vollständiges Passwort-Anmeldeprotokoll |
| Installation, Sequenz, Geräteuhr/Bootbeleg, Freigaben, Übertragungs-, Archivierungs-/Quarantänestatus | Offline-Zuordnung und Plausibilität, erforderlich auf diesem Weg; keine Werbe-ID |
| Sperrbildschirm-Schlüssel, Bindung an laufende Zeit, Zustand und Nutzungsdaten | Pause/Weiter/Beenden ohne Entsperren; Server speichert nur Schlüsselhash, höchstens 24 Stunden nutzbar und an aktive Zeit/Berechtigung gebunden |
| Zeitpunkt, Fehlerklasse, optionale Route, Korrelation; auf Einladungswegen zusätzlich erlaubte Betriebs-/Akteur-/Kontokennungen und Grund | Eigene Diagnose und Nachweis von Anbieteraufrufen/Klärfällen; gegebenenfalls personenbezogen |

Eigene Anmeldedaten gehen über HTTPS direkt an Supabase. Die API verarbeitet keine
Anmeldepasswörter und speichert keinen Passwort-Prüfwert, aber fachliche Daten in PostgreSQL.
Einladungswege verarbeiten E-Mail/Namen und speichern Befehlsbelege einschließlich
E-Mail-Fingerabdruck; Backups enthalten Datenkopien. Freitext kann sensible Angaben enthalten,
obwohl keine besondere Datenkategorie angefordert wird. Das Archiv behält Ehemalige und
inaktive Ziele; Zugangsentzug und Stornierung löschen die Historie nicht.

## Sperrbildschirm und lokaler Speicher

**Zielname, Zustand und Dauer sind auf dem gesperrten Handy sichtbar:** Android verwendet eine
öffentliche Benachrichtigung, iOS eine Live-Aktivität/Dynamic Island. Wer das Handy sieht, kann
Kunden-/Schülernamen lesen und die angebotenen Pause-/Stoppaktionen ohne Entsperren auslösen.
Die Anzeige ist nach D-147 bewusst vorgesehen; Betroffeneninformation und Bewertung durch den
Verantwortlichen gehören dazu. Die Live-Aktivität nutzt lokale Aktualisierung ohne Push-Dienst.

Refresh-Token und bestätigte Identität liegen im gerätegebundenen SecureStore; die Offline-Datenbank
ist mit SQLCipher verschlüsselt. Unter iOS bleibt die Anmeldung nur entsperrt zugänglich.
Android hält Sperrbildschirm-Zustand und Aktionsschlüssel verschlüsselt mit Keystore-Schlüssel;
iOS hält den Aktionsschlüssel separat im Schlüsselbund nach erstem Entsperren auf diesem Gerät,
den Zustand in einer geschützten Datei ohne Backup. Der geheime Schlüssel wird nicht an die
Live-Aktivität/Erweiterung weitergegeben. Lokale Verarbeitung und Serverübermittlung sind im
Store-Fragebogen getrennt zu bewerten.

## Vorgesehene Store-Zuordnung mit Quellen

Die folgende Zuordnung ist eine technische Ableitung aus dem Code, keine verbindliche Antwort
der Stores. Die Kategorien stammen aus [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
und [Google Data safety](https://support.google.com/googleplay/android-developer/answer/10787469),
am 22.10.2026 geprüft. Englische Kategorien vermeiden abweichende Übersetzungen des Formulars.

| Daten | Apple | Google |
|---|---|---|
| Personenname/E-Mail, auch erfasste Kunden-/Mitarbeiternamen | Name, Email Address | Name, Email address |
| Konto-/Mitgliedschaftsbezug | User ID | User IDs |
| Installation | Device ID | Device or other IDs |
| Kommentare, Gründe, frei vergebene Bezeichnungen | Other User Content | Other user-generated content |
| Arbeitsereignisse, Zeiten, Zuordnungen, Anmeldestand | Other Usage Data / Other Data Types prüfen | Other actions / Other info prüfen |
| Diagnose-/Fehlerbelege | Other Diagnostic Data | Diagnostics / Other app performance data prüfen |
| Aus Karte/Ziel/Standort ableitbarer Arbeitsort | Coarse Location / Precise Location prüfen | Approximate location / Precise location prüfen |

Zwecke: Kontozugang und Fachfunktion; Diagnose kann nach den Formularbegriffen zusätzlich
unter Analyse fallen. Die konkrete Auswahl je Datenart bleibt vor Einreichung zu bestätigen.
Apple definiert Erhebung anhand einer über die unmittelbare Anfrage hinaus zugänglichen
Übermittlung; Google berücksichtigt auch flüchtige Übermittlung, ausgenommen rein lokale
Verarbeitung. Die Dienstleister-Ausnahme bei Google „sharing“ ist anhand der Verträge zu prüfen.
„Nicht geteilt“ wird nicht vorweg zugesagt. Diese Regeln und die Tabellenbegriffe folgen den
oben verlinkten Primärquellen.

Kein GPS, keine Hintergrundortung; betriebliche Standort-/Kartenzuordnung kann dennoch den
Arbeitsort erkennen lassen. Kartenkennung ist kein kryptografischer Anwesenheitsbeweis.
Kein eingebundenes Werbe-/Crash-Analytics-SDK; Betriebskategorien im Formular trotzdem anhand
der tatsächlich übertragenen Diagnosen bewerten. Nicht vorgesehen sind Kamera, Mikrofon,
Adressbuch, Fotos, Gesundheits- oder Zahlungsdaten als App-Funktion. Personenbezug und
Erforderlichkeit müssen je Datenart angegeben werden, nicht pauschal für die gesamte App.

## Anbieter und offene Betriebsnachweise

| Weg | Stand / Bestätigung |
|---|---|
| Produkt-API und Datenbank bei Hetzner | Nürnberg, Deutschland; AVV noch nicht abgeschlossen (PO, 22.10.2026) |
| Hetzner Cloud Backups der ganzen Server-Systemplatte einschließlich Datenbank, Konfiguration und Zugangsdaten | Nürnberg, meist anderes Rechenzentrum am selben Standort; sieben rotierende Plätze, bei fortlaufend täglicher Erstellung höchstens sieben Tage; AVV noch nicht abgeschlossen (PO, 22.10.2026) |
| Borg-/WAL-Sicherungen auf Hetzner Storage Box | Falkenstein, Deutschland; AVV noch nicht abgeschlossen (PO, 22.10.2026) |
| Supabase für Anmeldung/Sitzung | Central EU (Frankfurt), `eu-central-1`; US-Mutter, D-006 offen; AVV noch nicht abgeschlossen (PO, 22.10.2026) |
| Supabase → Brevo für Anmelde-/Einladungs-/Rücksetzmails | Versand nach D-057; AVV noch nicht abgeschlossen (PO, 22.10.2026); Orte/Unterauftragnehmer prüfen |
| ntfy.sh / healthchecks.io | Feste Störungstexte bzw. HEAD-Lebenszeichen ohne Nutzdatenrumpf; Verbindungs-/Betreibermetadaten, keine fachlichen Endnutzerinhalte im Meldeweg |
| GitHub / GHCR | Quelltext, CI und Abbilder ohne Endnutzerdaten im vorgesehenen Ablauf |

Die drei Standorte und der ausstehende Abschluss aller drei AVV sind vom PO am 22.10.2026
bestätigt. Die AVV müssen vor den ersten echten Daten abgeschlossen sein (D-116).
Netz-Endpunkte verarbeiten IP-Adressen. Eigene Diagnoseprotokolle übernehmen keine IP, E-Mail
im Klartext, Token oder Anfragekörper; Anbieterprotokolle und Fristen lassen sich aus dem
Repository nicht vollständig belegen. Keine pauschale Aussage zu rein deutscher/europäischer
Verarbeitung oder fehlenden Drittlandübermittlungen, solange Vertrags-/Drittlandprüfung offen ist.

## Löschung, Aufbewahrung und Einreichung

Kein durchgängiger Konten-/Datenlöschweg, keine Löschklassen und keine automatische Löschung
fachlicher Daten nach Frist (T-016/B23). Einladungen verschwinden nicht automatisch mit Ablauf
oder Einlösung. Die eigene journald-Konfiguration begrenzt Diagnosen auf 14 Tage/256 MiB;
fachliche Audits bleiben erhalten. Kurzlebige Sperrbildschirm-Belege werden beim Ausstellen
nach Ablauf plus sieben Tagen bereinigt, was keinen allgemeinen Löschweg ersetzt.

Für `taptime-prod` sind Hetzner Cloud Backups aktiv: täglich derzeit gegen 10:45 UTC, je etwa
2,5 GB, gesamte Server-Systemplatte einschließlich Datenbank, Konfiguration und Zugangsdaten
(PO bestätigt 22.10.2026). Hetzner ersetzt bei sieben belegten Plätzen mit der nächsten Kopie
die älteste; bei fortlaufend täglicher Rotation höchstens sieben Tage Aufbewahrung. Ohne neue
Kopie bewirkt die Slot-Regel keine Alterslöschung. **Hetzner Cloud Snapshots gibt es laut PO nicht.**
Die Cloud-Backups liegen wie der Server in Nürnberg, meist in einem anderen Rechenzentrum am
selben Standort. Quelle: [Hetzner-FAQ](https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/).
Die Borg-Verschlüsselung schützt dessen eigene Archive; Cloud-Plattenkopien erfassen auch die
auf dem Server vorhandenen Zugangsmittel.

Borg nutzt Auswahlregeln für stündliche, tägliche, wöchentliche und monatliche Basen mit
Schutz einer geprüften Basis. Manuelle Storage-Box-Schnappschüsse und logische Alt-Archive haben keine
bestätigte automatische Höchstfrist; „maximal sechs Monate“ darf nicht zugesagt werden.
Der PO muss mit Rechtsbeistand Kontaktweg, Fristen und Umgang mit Sicherungen festlegen und
bereitstellen. Offene technische Grenzen: T-016, T-132 (Wochenprobe/Platz), T-055 (Offline nach
Restore), Pro-/Passwortschutz nach D-130/D-139 und dienstabhängige Container-Härtung.

Vollständige Dienstleister-/Maßnahmenbeschreibung: `ADO/06_Recht/Verzeichnis_Verarbeitungstaetigkeiten.md`
und `AVV_Anlagen.md`. Codebelege mit Zeilen und offene Entscheidungen stehen im lokalen T-134-Bericht.

## Codebelege (Einstieg)

- Anmeldung und Sitzungsablage: `apps/mobile/src/auth/SupabaseEmailPasswordAuthAdapter.ts`,
  `apps/mobile/src/auth/ExpoRefreshTokenStore.ts`.
- Offline-Erfassung: `apps/mobile/src/offline/OfflineInstallationIdentityStore.ts`,
  `apps/mobile/src/offline/OfflineCaptureDatabase.ts`.
- Sperrbildschirm: `apps/mobile/src/lockScreen/LockScreenCoordinator.ts`,
  `apps/mobile/modules/taptime-lock-screen/` (Android, iOS, Widget) und
  `apps/backend-schema/migrations/062_lock_screen_capabilities.sql`.
- Diagnose: `apps/backend-api/src/diagnosticLog.ts`.
- Bibliotheken, Berechtigungen und Transport: `apps/mobile/package.json`, `apps/mobile/app.json`,
  `infrastructure/caddy/Caddyfile`, `infrastructure/SMTP.md`.
