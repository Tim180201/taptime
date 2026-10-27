# TapTim.e — Plan bis zum ersten Kunden

> **One Tap. One Decision.** Jede Aufgabe unten muss diesem Ziel dienen.

**Team:** Tim (Product Owner) · Claude (Technical Lead) · Codex (Development)
**Leitentscheidung:** Erst das System vollständig fertig, dann Firma, Recht und Store (D-007), mit getrennten Uhren für
reine Wartezeiten (D-011). Grundlage: Anforderungsprüfung gegen den Code (D-012) und Code-Analyse 28.09. (D-103).
**Stand 26.10.2026:** Produktion und Auslieferungsstand siehe STATUS. Erledigte Aufgaben stehen in Git und DECISIONS;
die vollständige Aufgabentabelle bis 05.10. mit allen Begründungen: `git show 1043011:ADO/PLAN.md`.

---

## Bis zum Pilot

| | Aufgabe | Inhalt | Wer |
|---|---|---|---|
| **T-102 ✓** | Beschäftigte nach Standort, Stunden des Monats (D-105, T-081) — abgeschlossen `d399c69` | App und Web: Gruppen je Standort, Spalte „Diesen Monat“ (Migration 047, Vertrag v3, v1/v2 unverändert); „Angemeldet bleiben“ beim Abmelden, Hinweis bei gleicher Tag-Zuordnung. | ✓ |
| **T-098b** | Registry wiederherstellen, Abrufprüfung immer (Befund 05.10.) — Brief in `5071e6e:ADO/TASK.md`; Teil 2 geprüft auf Branch `t098b-verify` | 21 gelöschte Versionen (Plattform-Manifeste, Attestationen, ein Operations-Index) von `b1ecb8c` und `0230188` über die Packages-API wiederherstellen (Frist bis Anfang November), alle geschützten Abbilder vollständig prüfen; die Abrufprüfung läuft künftig bei jedem Image-Lauf und scheitert laut. PO gibt vorher `read:packages`/`write:packages` für `gh` frei. Teil 1 erledigt (06.10.), Teil 2 geht in T-098c. | PO, Codex |
| **T-107 ✓** | UX vor dem Pilot: Fehler und Kernabläufe (D-112, D-123) — abgeschlossen `16670ed` | Befunde der UI/UX-Durchsicht 06.10. (lokal `.audit-ux-2026-10/`): Kalender-Wochentage, unsichtbar gewähltes Ziel im Web, Standorte einschalten ohne Bindung der Allgemeinen Arbeitszeit (D-102), Stopp/Pause auf „Erfassen“, fremde laufende Zeit direkt beenden, Name des ersten Administrators, Stunden:Minuten, Textkorrekturen (Migration 050). | Codex |
| **T-108 ✓** | Selbsterklärend I: Begriffe und Bedienmuster (D-124 bis D-127) — abgeschlossen `66b1952` | Karte, Mitarbeiter, „Zeiten prüfen“, „Übertragung“ mit Konto, Wortlaut aus der Begriffsliste, einheitlicher Zurück-Weg, Personenname in der Personenansicht, erkennbare Löschaktionen, Herunterziehen zum Aktualisieren. Ohne Migration. | Codex |
| **T-110 ✓** | Selbsterklärend II: Führung, Zeiten prüfen, Monatswähler (D-128) — abgeschlossen `7cd4233` | Nächster Schritt in der Übersicht aus vorhandenen Daten, Hinweis nach Rollenwechsel, „Zeiten prüfen“ mit Tageszeiten und klaren Knöpfen, Monatswähler in der Mitarbeiterliste (Vertrag v5, Migration 051), SQL-Ersatzname „Mitarbeiter“. | Codex |
| **T-098c ✓** | Registry-Aufräumen trotz alter Fehlstellen — abgeschlossen `f97bc4e` (erster Lauf 234 Versionen gelöscht) | Teil 2 von T-098b mitnehmen. Abrufprüfung streng für aktuellen, vorherigen und Operations-Stand sowie die neuesten zwanzig; unvollständige ältere bekannte Stände nur als Warnung. Fehlende Kind-Manifeste unter ungeschützten Eltern blockieren das Aufräumen nicht mehr (Eltern zuerst löschen). `known-versions` bleibt ungekürzt (TL 08.10.). Trockenlauf des Löschplans vor dem Commit, nach Deploy 4 wiederholt. | Codex, TL |
| **T-109 ✓** | Weg zur App (D-129) — abgeschlossen `d72ba94` | Öffentliche Seite `/app` (Ziele in `apps/landing-web/src/appLinks.json`, vorerst leer), „App laden“ nach dem Passwortsetzen und in der Einladungsmail, „App aktualisieren“ in der App, Name aus `shared/product.json`, EAS-Profil `store`, Store-Entwürfe in `docs/store/` („Entwurf, rechtliche Prüfung mit B15“). Offen beim PO vor der Einreichung: App-Name, D-U-N-S, Play-Organisationskonto, öffentliche Datenschutzerklärung und Impressum, Apple-Antrag „unlisted“, Händlerangaben (DSA), Demo-Zugang; danach Store-Links und Einreichung als eigene Schritte. | Codex, PO |
| **App Links ✓** | Fingerabdrücke in `assetlinks.json` (T-096, D-119) | Fingerabdrücke der drei Varianten eingetragen (06.10.). | PO, Codex |
| **Deploy 3 ✓** | Dritter Deploy, Mail-Vorlage, App-Builds, Geräteabnahme — ausgeliefert 06.10. | Ziel `7cd4233`: T-094b bis T-102, T-075, T-106, T-107, T-108 und T-110, Migrationen 043–051; Ablauf und Abnahme in STATUS. | PO, TL |
| **T-113 ✓** | Zeiten eingeben im Web einfacher, eigene Zeiten ohne Grund (D-131) — abgeschlossen `2c9f7b8` | Eigene Zeiten ohne Grund nachtragen und ändern (Migration 052, Historie „selbst“), „Zeit hinzufügen“ rückt ins Bild, Enter ins nächste Feld, Datum, Von und Bis getrennt in allen Zeitformularen im Web. | Codex |
| **T-112 ✓** | Karte einrichten zuverlässig, Signal erst bei Erfolg (D-132) — abgeschlossen `280c057` | Schreiben nur wenn nötig und nachgelesen; am iPhone ein Apple-Fenster bis „Karte zugeordnet“ mit Neuabfrage derselben Karte; gesendete Registrierung gewinnt, gleiche Befehls-ID beim Wiederholen; iPhone mit Vibration und Ton; Android-Lesemodus ohne Systemton; Bezeichnung vorbelegt. Geräteabnahme (je 20 Einrichtungen) mit den App-Builds nach Deploy 4. | Codex |
| **T-114 ✓** | „Erfassen“ auf einen Blick (PO 07.10.) — abgeschlossen `af86406` | „Erfassen“ im Normalzustand ohne Scrollen (Kreis passt sich an, kompakte Karte der laufenden Zeit), ohne „Zuletzt“; Reiter einzeilig ohne Wortbruch; Einzahl. | Codex |
| **T-115 ✓** | App öffnet immer, auch nach dem Sperren (D-133, PO 08.10.) — abgeschlossen `831cb29` | Unter iOS kein Hintergrundauftrag und kein Start im Hintergrund; kein endgültiger Fehlerzustand (neuer Versuch bei Rückkehr in den Vordergrund und per Knopf); Schreibfehler bei der Erneuerung zerstören keine Sitzung; Anmeldefehler bleiben auf der Anmeldeseite; kurzer Fehlercode für den PO. Geräteabnahme mit den App-Builds. | Codex |
| **Deploy 4 ✓** | T-109 und T-113 ausliefern — ausgeliefert 08.10. (`7cd4233` → `831cb29`) | Startseite mit `/app`, Caddyfile, Verwaltung, Migration 052; Ziel `831cb29` (Server wie `2c9f7b8`). Danach überträgt der PO die Einladungsvorlage; dann neue App-Builds mit T-109 bis T-115 und Geräteabnahme. | PO, TL |
| **T-116a ✓** | Regeln und Karten (D-134, D-137) — abgeschlossen `2596899`, `a9d5c54` | Gründe nach D-134 (Migration 053). „Karte entfernen“ in App und Web, „Karte prüfen“ v2, Offline-Erfassungen vor dem Entfernen bleiben gültig (Migration 054). Mit Deploy 5. | Codex |
| **T-116b ✓** | Oberfläche und Kleinigkeiten — abgeschlossen `514f919` | Feste Startleiste in „Manuell“, Kartenaktionen oben, Pausen als eigene Zeilen, „Zeit beendet“ mit Pause, Umlaute richtig sortiert und eigene Zeiten der Standortleitung außerhalb ihres Bereichs (Migration 055), Einladen-Knopf, Überschrift, einfache Anmeldemeldung, `/app/`. Mit Deploy 5. | Codex |
| **T-117a ✓** | Suche und Seiten auf dem Server (D-138) — abgeschlossen `1372b81` | Suche und Blättern nach Namen für Kunden (Stunden geblättert, Detail je Kunde), Beschäftigte, Zugänge, Karten, Kundenauswahl, Arbeitsziele, Nachtrage-Ziele und Projekte; Seiten höchstens 14 KiB (Migration 056). Alte Wege bleiben. Mit Deploy 5. | Codex |
| **T-117b ✓** | Suche in App und Web — abgeschlossen `e9bf389` | Suchfelder und „Weitere laden“ auf den neuen Wegen in Kunden, Mitarbeitern, Karten, „Manuell“, „Zeit hinzufügen“, Einrichtung, Zugängen und Projekten; kein vollständiges Vorladen mehr; „Manuell“ offline lokal; Rest-P2 `tagReceipt` behoben. Mit Deploy 5. | Codex |
| **T-118a ✓** | Zuordnung und Kontingent-Hinweise auf dem Server (D-135) — abgeschlossen `8eff459` | Zuordnung von Kunden und Projekten zu Mitarbeitern durch Administrator und Standortleitung (eigener Bereich), mit Historie; Zielwege liefern „mir zugeordnet“ und filtern darauf; Verwaltungsabfrage je Person und je Ziel; eigener Weg nur für Kontingent-Hinweise (Migration 057). Sichtbarkeit, Karten und Berechtigungen unverändert. Mit Deploy 5, nur zusammen mit T-118b. | Codex |
| **T-118b ✓** | Zuordnung und Hinweise in App und Web — abgeschlossen `41d68dc` | Web: beim Kunden „Mitarbeiter zuordnen“, beim Mitarbeiter „Kunden und Projekte zuordnen“, je mit Mehrfachauswahl und Suche. App und Web: „Meine Kunden und Projekte“ oben in „Manuell“ und „Zeit hinzufügen“. Kontingent-Hinweise über den neuen Weg. Aus T-117b (K4): Bestätigung nach „Kunde anlegen“ in der App und „nächster Schritt“ in der Web-Übersicht ohne vollständige Altliste; die Standort-Einrichtung im Web darf vollständig laden. Zuordnen nur im Web, die App zeigt an. „Nächster Schritt“ zeigt nur sichere Hinweise; die gemischte Altliste lädt nur noch ihre erste Seite. Mit Deploy 5. | Codex |
| **T-120 ✓** | Systemicon „Funk-Zifferblatt“ überall (D-136, PO 13.10.) — abgeschlossen `d193725` | Bilddateien liegen fertig in `shared/brand/` (TL, 13.10.); die Platzhalter in `apps/mobile/assets/` entfallen. App: Symbol für iOS hell, dunkel und getönt, Android adaptiv auf #0E1512 mit Themensymbol; natives Startbild (expo-splash-screen) mit dem Zeichen auf #0E1512 bleibt, bis die Sitzung bereit ist, erst nach etwa 3 s darunter „Wird geladen …“, ohne Sprung; die Fehlerzustände aus T-115 bleiben. Zeichen in der Anmeldung und im Kopf von „Erfassen“. Web: Zeichen statt „T“ und Ringen in Verwaltung, Betreiber-Bereich und Startseite, App-Symbol auf `/app` und `/tag`, Favicon und Apple-Touch-Symbol überall; öffentliche Pfade im Caddyfile freigeben. Neuer App-Build; das 512-px-Symbol für die Play Console lädt der PO hoch. Mit Deploy 5. | Codex |
| **T-119 ✓** | Sicherheit vor echten Daten — abgeschlossen `3284c99` | CSP auf die genaue Supabase-Herkunft verengen; SECURITY-DEFINER-Funktionen und Policies dauerhaft im Katalog prüfen; Anmeldung nach D-139 (Mindestlänge 10 aus einer Quelle, klare Meldung bei Drosselung, Supabase-Einstellungen durch den PO). Supabase-Altlasten am 14.10. entfernt (PO). Vor den ersten echten Konten, zusammen mit T-024. Mit Deploy 6 (T-024). | Codex |
| **T-121 ✓** | Befunde der Geräteabnahme Deploy 5 (PO 14.10.) — abgeschlossen `4e64473` | P1: Android erfasste die Karte nur nach Antippen; Ursache im JS: die Grant-Erneuerung beim Vordergrund verschob die Zeitgrenze der Erfassung hinter die Karte, die Grenze aus D-043 bleibt und ist im Test begründet. Dazu: „Meine Kunden und Projekte“ ohne Altliste (D-135), Tastatur schließt beim Antippen; flackerndes Symbol im Kreis bleibt P2. Nachtest am Android mit dem Build nach T-122b. Mit Deploy 6. | Codex |
| **T-122a ✓** | Web-Gestaltung mit zwei Themen (D-140) — abgeschlossen `e227f63` | Verwaltung im Browser nach `ADO/01_Architecture/Web_Entwurf_v2/`: dunkles und helles Thema mit demselben Aufbau, Umschalter, Seitenkopf mit einer Hauptaktion, Seitenleiste in zwei Gruppen, Tabellen; Übersicht, Kunden mit „Kunde anlegen“, Manuell in zwei Schritten, Einrichtung mit Reitern. Betreiber-Bereich und Startseite nur Farbsätze. Dazu die Befunde aus dem Durchgang „Standortleitung, zum ersten Mal hier“ (Sprache ohne Technik, ein Titel je Seite, Anmeldung, Hinweise in der Zeile, Hilfe). Browser-Fotos in beiden Themen; PO-Abnahme 15.10. Mit Deploy 6. | Codex |
| **T-122b ✓** | App-Themen und übrige Web-Seiten (D-140) — abgeschlossen `26eed76` | App: helles Thema, Umschalter in „Übertragung“, Startbild bleibt dunkel; neue Builds. Web: Mitarbeiter, Person (Aktionen in der Zeile, ein Zielwähler), Zeiten prüfen (Fälle in Menschensprache, Ergebnis-Knöpfe), Meine Zeiten, Lohnexport (Monat vorbelegt, Korrektur bei der Person), Zugänge, Betreiber-Bereich und Startseite im selben Aufbau; Lohnexport-Datei heißt „Einzelzeiten (CSV)“; Zeiten prüfen in Menschensprache. PO-Abnahme 15.10. Mit Deploy 6. | Codex |
| **T-105 ✓** | Zugänge verwalten (Wunsch PO 04.10., Schnitt D-141) — abgeschlossen `fb28166` | Mitarbeiter-Seite mit Reitern „Zeiten“ und „Zugänge“: Tabelle Person · Rolle · Standort · Anmeldung · Zugang, Aktionen in der Zeile (Rolle ändern als Blatt, Entzug mit Rückfrage), Einladen als Hauptaktion, Filter aktiv/entzogen. Server: Migration 059 mit Anmeldestand je Zugang (`membership_sign_ins`, nur bei der Sitzung geschrieben), `read_managed_memberships_v4` mit Filter. Vorab Härtung des T117-Suchtests. Keine Wiederaufnahme (T-125). PO-Abnahme 15.10. Mit Deploy 6. | Codex |
| **Deploy 6 ✓** | T-119, T-121, T-122a, T-122b, T-105 ausliefern — ausgeliefert 15.10. (`d193725` → `fb28166`) | Migrationen 058 und 059, Verwaltung mit zwei Themen, Zugänge verwalten; Abnahme in STATUS. Teil B von T-024 vom Deploy entkoppelt (Deploy 7). | PO, TL |
| **T-122c ✓** | Kopfbalken in beiden Themen, fest oben; ein Monatsschalter (Web-Abnahme PO 15.10., D-140) — abgeschlossen `e614779` | Ein Aufbau in allen Themen: Balken mit Betrieb, Name · Rolle und „Abmelden“ auch im dunklen Thema (Farbe `surface` mit Linie), Seitenleiste ohne Zeichen und Konto-Block; Balken fest oben, Seitenleiste fest darunter ohne Lücke; nur die Rolle, wenn der Zugang keinen Namen hat; Betrieb nicht doppelt über dem Titel. P1: Lohnexport wurde beim Ändern des Monatsfelds leer (Renderfehler ohne Fehlergrenze) → ein Monatsschalter auf allen Seiten, Lohnexport startet mit dem Vormonat, Fehlergrenze statt weißer Seite. Nur Web, Brief in TASK. Mit Deploy 7. | Codex |
| **T-122d ✓** | Browser-Prüfstrecke in drei Teilen (CI zu `e614779` am Zeitlimit abgebrochen) — abgeschlossen `df76957` | `layout.test.mjs` teilt sich über `TAPTIME_LAYOUT_SHARD`, CI läuft in drei parallelen Teilen mit je 15 min; Vollständigkeit belegt, kein Test gelockert. Brief in TASK. | Codex |
| **T-130 ✓** | GHCR-Befund: Produktionsabbilder `fb28166` fehlten (Image-Lauf zu `df76957`) — geklärt und wiederhergestellt 16.10. | Ursache: Der Image-Lauf zu `7e36c58` räumte während Deploy 6 auf, bevor der Deploy `fb28166` in den Schutzsatz schrieb; „neueste zwanzig“ zählte einzelne Paketversionen. Neun Versionen gelöscht, in T-130b exakt nach Digest wiederhergestellt, strenge Abrufprüfung grün. Fix in T-131. | Codex, TL, PO |
| **T-131 ✓** | GHCR-Aufräumen darf kein Deploy-Ziel löschen (D-145) — abgeschlossen `3350aed`, `70745ad`, `d8456e8` | Aufbewahrung der neuesten zehn ganzen Releases, Reservierung des Deploy-Ziels vor dem ersten Abruf, zweites Lesen des Schutzsatzes vor dem Löschen, Operations-Abbilder von current und previous, Löschplan im Protokoll; der Vorfall als Test. Nachgezogen: ShellCheck-Ausnahme auch für die CI-Version 0.9 (`70745ad`); ältere bekannte Releases unter den zehn neuesten behalten die Fehlstellen-Toleranz (T-131c, `d8456e8`, vorab lesend gegen GHCR geprüft). Mit Deploy 7. | Codex |
| **T-129 ✓** | Startseite: Abschnitt „Stempelpunkte“ (D-144) — APPROVED 16.10. | „Ihr Stempelpunkt. Ohne Kabel.“ als „Bald verfügbar“ mit Entwurfsbildern Wandrahmen und Tischkeil, drei Vorteilen und einer Frage in „Kurz beantwortet“; kein Preis, kein Bestellknopf. Brief in TASK. Mit Deploy 7. | Codex |
| **T-126 ✓** | Name ändern (Web-Abnahme PO 15.10.) — abgeschlossen `1918d5a` | Zugänge ohne Namen (Altbestand von vor T-107, Migration 050) stehen in Lohnexport-Liste, CSV und Zeiten prüfen ohne Namen; ändern kann einen Namen heute niemand, ein Tippfehler bei der Einladung bliebe in der Lohnabrechnung. „Name ändern“ bei der Person und unter Zugänge, Berechtigung wie beim Entzug (T-105), mit Protokoll samt altem und neuem Namen, Migration 060 (D-142); Lohnexport und Zeiten prüfen zeigen „Name fehlt“; Monatsknopf mit fester Breite. Commit durch den PO (Plan B). Mit Deploy 7. | Codex, PO |
| **T-127a ✓** | Archiv auf dem Server (Wunsch PO 15.10., D-143) — abgeschlossen `6b0c867` | Migration 061: Lesewege für ehemalige Mitarbeiter und gelöschte Kunden/Projekte im Bereich (Standortleitung nach letztem Standort, ohne Frist), Monatsübersicht v6 (Ehemalige nur mit Zeit im Monat, nie in „Gerade aktiv“), Personenzeiten v2 (lesen ohne Frist, ändern nach D-115), Statusabfrage für Markierungen. Brief in TASK. Mit Deploy 8 (Plan B, 16.10.). | Codex |
| **T-127b ✓** | Archiv im Browser (D-143) — abgeschlossen `c41fc2c` | Seite „Archiv“ mit zwei Reitern; im laufenden Betrieb nur Aktive (Übersicht, Zugänge ohne Filter „Entzogen“, Einrichtung); bei Monatszahlen Ehemalige getrennt oder als „ehemalig“/„gelöscht“ markiert; Rückfragen nennen das Archiv; „Projekt löschen“ statt „Deaktivieren“. Brief in TASK. Mit Deploy 8 (Plan B, 16.10.). | Codex |
| **T-104a ✓** | Sperrbildschirm: Schlüssel und Aktionen auf dem Server (D-114, D-146) — abgeschlossen `90fadc3`, `873cbfd` | Migration 062: Sperrbildschirm-Schlüssel je laufender Zeit (nur Hash gespeichert, höchstens 24 h, ungültig mit dem Ende der Zeit), Weg „Pause · Weiter · Beenden“ mit Zustandsprüfung und denselben manuellen Ereignissen, Verlauf „vom Sperrbildschirm“. CI-Nachtrag: Migrationsvergleiche aus T-116 dulden neue leere Spalten. Mit Deploy 8. | Codex |
| **T-104b ✓** | Sperrbildschirm Android (D-146) — abgeschlossen `c332b91` | Laufende Benachrichtigung mit Ziel (D-147), Dauer und Knöpfen, Aktionen nativ ohne App; ohne Netz „Nicht gesendet“ mit „Erneut senden“, Antippen öffnet „Erfassen“; die App liest ihre Zeit beim Öffnen neu und zeigt nach eigener Erfassung „Wird übertragen …“. Zwei Review-Runden, Schlussänderung vom TL vorgegeben. Neuer App-Build. | Codex |
| **T-104d ✓** | Android-Meldung im Taptura-Look (D-148) — abgeschlossen `a76630c` | Eigenes Symbol aus dem Funk-Zifferblatt (aus `mark.json` erzeugt), Akzent Mint, Ziel als Titel und Zustand darunter, Knöpfe mit den Worten der App; ab Android 16 als Live Update (AndroidX Core 1.17 aus Expo, keine neue Abhängigkeit). Nur Anzeige. | Codex |
| **T-104c ✓** | Sperrbildschirm iPhone (D-146, D-148) — abgeschlossen `5c15d81` | Live-Aktivität (Sperrbildschirm, Dynamic Island) im Taptura-Design mit Knöpfen ab iOS 17 als `LiveActivityIntent` im App-Prozess, Aktion nativ ohne Entsperren; ein Hintergrundstart hält React zurück und schreibt nichts in den Schlüsselbund (D-133). iOS 16 und ohne Netz öffnet die App. Eigenes Config-Plugin, Erweiterung lokal gebaut. Zwei Review-Runden, Schlusskorrektur vom TL. Neuer App-Build. | Codex |
| **T-132 ✓** | Arbeitsbereich der Sicherung auf die Platte, mit B12 — abgeschlossen `81f55b7` | Wochenprobe scheiterte am tmpfs (382 MB). Jetzt root-eigener Ordner auf der Platte mit Wächter, Platzprüfung gegen die Alarmschwelle und Aufräumen (D-150); begrenzte Borg-Wartezeiten mit Zeitgrenzen passend zur Überwachung; Totmannschalter der Tagesprüfung (zweiter Healthchecks-Check, PO); Hetzner Cloud Backups im Runbook (D-151). Mit Deploy 8; vorher Controller installieren. | Codex, TL, PO |
| **T-133 ✓** | Runbook nachziehen (DEPLOY.md) — abgeschlossen `b29bbaa` | `.env` verschlüsselt sichern (Weg vom 17.10.), Image-Revision über den CI-Lauf des freigegebenen Commits statt `headSha` des Image-Laufs, Konsole: jede Zeile einzeln, Tastentabelle. | Codex |
| **T-134 ✓** | Rechtstexte an den Code angleichen (B15, D-149) — abgeschlossen `5f65fc3` | Verzeichnis, AVV-Anlagen (TOM), Aushang nach Art. 13 und Store-Datenschutzangaben auf dem gebauten Stand (Migration 062, T-104c): Kunden als Betroffene, Rollen und Betreiber, Sperrbildschirm (D-147), Protokollfelder, Löschung und Sicherungen ehrlich, Orte vom PO bestätigt, Hetzner Cloud Backups. Offen beim PO: AVV mit Hetzner, Supabase und Brevo, Drittlandfrage (D-006), Anschrift und Kontakt, Höchstdauer manueller Storage-Box-Schnappschüsse. | Codex (Sol) |
| **T-024 ✓** | Geheimnisse rotieren — abgeschlossen 23.10. (Teil A `7e36c58`, Teil B PO an der Konsole) | Teil A: Werkzeug `taptime-runtime-rotate` für alle Laufzeit-Logins und den Cursor-HMAC-Schlüssel, Runbook in DEPLOY.md und MONITORING.md. Teil B: neuer Deploy-Schlüssel (Deploy 7), alter entfernt; Laufzeit- und Betreiber-Zugänge rotiert; `.env` neu verwahrt; `/root/env-0410.bak` vernichtet; neues ntfy-Thema (zweimal, STATUS); Supabase nach D-139. | Codex, PO, TL |
| **Deploy 7 ✓** | T-024 Teil A, T-122c, T-122d, T-129, T-131, T-126 ausliefern — ausgeliefert 17.10. (`fb28166` → `1918d5a`) | Migration 060; neuer Deploy-Schlüssel vor dem Deploy. Belege aus dem Log, T-024 Teil B ab Schritt 7 und Web-Abnahme offen (STATUS). | PO, TL |
| **Deploy 8 ✓** | T-127a, T-127b, T-104a, T-132 ausliefern — ausgeliefert 23.10. (`1918d5a` → `e577fa8`) | Migrationen 061 und 062, zwei Wiederherstellungsproben grün, Tagesprüfung grün. App-Builds Android 17 und iPhone 10 (EAS). Konsolenbeleg der Wochenprobe offen (STATUS). | PO, TL |
| **T-099 ✓** | Pilotgröße (D-149, D-152) — abgeschlossen `e577fa8` (T-099a), `eebe736` und `1edb047` (T-099b) | Messwerkzeug `tests/pilot-size/`; Migration 063 behebt die Pilotblocker, Wiederholungsmessung grün; wirkt mit Deploy 9. P2 offen: gebündelter Prüffall-Kontext, Spitzen-Richtwerte. Supabase-Mailgrenze vor dem Einladen aller anheben (STATUS). | Codex |
| **T-104e ✓** | Sperrbildschirm: Bestätigung trotz laufender Sicherung, keine Leseschleife, Anzeige bleibt bis zum Ende (D-153, D-154) — abgeschlossen `c84dfc9` | Vertrag v2 mit `archiveStatus` (alte Builds behalten v1, Migration 064 nur lesend), „wird gesichert“ statt „Noch nicht bestätigt“, Kalenderwechsel erst mit vollständigen Seiten, Anzeige endet sofort mit der Zeit, Android stellt Weggewischtes wieder her. Zwei TL-Runden, unabhängiges Review. iOS-Gesamtbuild über EAS vor Deploy 9. Neuer App-Build. | Codex |
| **T-135 ✓** | „Zeiten prüfen“ in Pilotgröße (T-099b P2, T-111 Teil 2) — abgeschlossen `f384279` | Tageszeiten der Prüffälle gebündelt (Migration 065, je 20 Fälle eine Abfrage, Server leitet Person und Tag aus dem Prüffall ab), „So lassen“ auch ohne lesbare Tageszeiten; Browser-p95 lokal 1.442 → 322 ms. Mit Deploy 10. | Codex |
| **T-136 ✓** | Sicherung unter Pilotlast messen (B13) — gemessen 27.10., Werkzeug `tests/backup-scale/` | 20.000 echte WAL-Archive (Borg 1.2.8): monatliche Aufbewahrung 4.089 Einzellöschungen 992 s, gesammelt 28 s; Archivierer wartet so lange auf die Sperre, die stündliche Basis scheitert nach 600 s. Gefunden: P1 in der Belegprüfung (`SET\nt`), die Aufbewahrung läuft in der Produktion vermutlich nie (an der Konsole zu prüfen). | Codex |
| **T-136b** | Sicherung: Belegprüfung reparieren, veraltete Archive gesammelt löschen | P1 beheben (echter PostgreSQL-Test), exakt benannte Archive blockweise in einem `borg delete`, Arbeit je Lauf unter der Sperre begrenzt, Rückstand sicher abbauen, Runbook. Brief in TASK. Mit Deploy 10. | Codex |
| **T-137** | Restliche Ladezeiten und kleine Restpunkte (T-099b P2, T-104e P3) | Administrator-Kundenmonat und Kontingente, Einrichtung der Standortleitung, Kartensuche und Archivstatus unter den Richtwert (300 ms); Index für die Archivabfrage des Sperrbildschirms; vollständiger Kalender nach einer Erfassung (App, kommt mit dem nächsten App-Build). Nach T-136. | Codex |
| **Deploy 9** | T-099b und T-104e ausliefern, Ziel `c84dfc9` | Migrationen 063 und 064, keine Änderung an der Server-Einrichtung seit Deploy 8. Vorher beide App-Builds aus `c84dfc9` grün; danach Geräteabnahme, dann Pilot (D-152). | PO, TL |
| **Deploy 10** | T-135 und T-136b ausliefern | Migration 065 und Sicherungsskripte; vorher Rückstand an der Konsole zählen, danach die erste Aufbewahrung beobachten (DEPLOY.md). | PO, TL |
| **Pilot** | Betrieb frogs | Betrieb anlegen, Standortleitungen einladen, Tags verteilen. Voraussetzung: T-099b und T-104e ausgeliefert (D-152), Gewerbeanmeldung, AVV/TOM nach B15, Haftpflicht mit Cyber-Baustein (D-116), Supabase Pro mit der Gewerbeanmeldung (D-130), Aussperr-Test bestanden. | PO |

---

## Pilotmonat 1

| | Aufgabe | Inhalt |
|---|---|---|
| **T-125** | Wiederaufnahme nach Entzug (F-153, D-141) | Derselbe Zugang wird wieder aktiv, mit Protokolleintrag; vorher jede Stelle prüfen, die „entzogen ist endgültig“ voraussetzt (Offline-Berechtigungen, Belege, Archive, eine Mitgliedschaft je Person). Erst, wenn frogs den Fall hat. | Codex |
| **T-111** | Eindeutiger Vorgänger in „Zeiten prüfen“ (aus T-110) | Der Prüfvertrag liefert eine serverseitige Kennung der blockierenden früheren Erfassung; „Zeiten prüfen“ verlinkt dann direkt dorthin. Bis dahin nur der Satz „Eine frühere Erfassung muss zuerst geprüft werden.“ ohne Link, weil gleiche Sequenznummern zweier Geräte derselben Person keine sichere Zuordnung erlauben (TL-Entscheidung 06.10.). Teil 2 (Schließen ohne lesbare Tageszeiten) geht in T-135. | Codex |
| **T-123** | Lohnexport als Monatsformat (B01, D-017) | Nach der Antwort von frogs (unten): Personalnummer als Feld an der Person (Admin pflegt sie; Entstehen, Ändern, Entfernen nach AGENTS 1.5), eine Zeile je Person und Monat (ggf. je Tag) mit Stunden in deutschem Format und deutschen Spaltenköpfen, bei Bedarf das Spaltenlayout des Lohnsystems (DATEV, Lexware). Additiv als neue Exportfassung; „Einzelzeiten (CSV)“ bleibt. Vor dem ersten echten Lohnlauf. | Codex |
| **T-124** | Business-Central-Anbindung (Wunsch frogs) | Stunden je Mitarbeiter und je Schüler/Projekt aus denselben Zeilen; Richtung (Taptura schiebt oder BC holt), Ziel in BC (Standard-Zeiterfassung oder eigene Schnittstelle des BC-Partners), Umgang mit Korrekturen nach der Übergabe, Sandbox. Nummern aus BC an Person und Kunde (mit T-123). Übertragungslauf mit Wiederholung und Protokoll in der Verwaltung; Zugangsdaten nur auf dem Server. Erst nach Sandbox-Zugang schneiden; zwei bis vier Sitzungen. | Codex |
| **T-075 ✓** | Paket mit weicher Grenze (D-087) — abgeschlossen `28e3685` (Testnachtrag `5aa8ea2`) | Paketgröße je Betrieb (Migration 048), Änderung mit Grund im Betreiber-Protokoll, Höchstwert aktiver Zugänge je Monat aus der Mitgliedschaftshistorie, Hinweis für Administratoren; nichts wird gesperrt. |
| **T-073** | Fälschungssichere Tags, iPhone ohne geöffnete App (D-037, D-081, D-088, D-111) | NTAG 424 DNA mit SUN: jede Berührung eine einmalige, vom Server geprüfte Adresse; dieselbe Adresse trägt das Erfassen per Universal Link. |
| **T-048, T-050** | Arbeitstag freigeben, Pausenautomatik (D-046, D-047, D-096) | Während Monat 1 bauen, Freigabe zu Monat 2 zuschalten (D-063). |
| **T-055** | Wiederaufnahme nach Wiederanlauf (D-055) | Lease-Bindung, Reihenfolge über Installationen und Zeitfenster bei spätem Replay nach einem Restore; Nachweis `OfflineRestorePostgres.test.ts` Fall 2. |
| **T-037** | Ungeprüfte Befunde aus dem Gutachten 06.09. (damals B07–B09, Text in Git) | Erst am Code verifizieren, dann beheben oder verwerfen. |
| **T-106 ✓** | Plausibilität an der Servergrenze (B02, D-122) — abgeschlossen `06b3008` | Gerätezeit in der Zukunft wird Prüffall, Korrektur höchstens 24 h, strenge Zeitstempel, Pflichtgründe mit sichtbarem Text (Migration 049, Drift-Probe der Funktionskörper). |
| **B03–B06, B12, B16** | Analyse-Pakete | B16 gleicht dabei die älteren Aufgaben ohne ✓ (Tabelle in Git) und die Kleinigkeiten aus STATUS mit dem Code ab. |

## Später, ohne Termin

T-016 Löschkonzept und Betroffenenrechte (mit B23) · T-020 Freigabekette für nicht per NFC erfasste Zeiten (D-014) ·
T-017 Feinschliff, Barrierefreiheit, Sitzung (D-015) · T-031b Startseite öffentlich mit Impressum (nach dem Pilot) ·
T-042 Aufstiegspfade der Gerätedatenbank (fällig vor der ersten Schemaänderung der Gerätedatenbank nach dem Pilotstart)
· T-044 Lesemodus gehört der App · T-056 CI baut die Images (teils mit T-064, T-078, T-098 erledigt; mit B14
abgleichen) · T-023 und T-029 (Vorschläge: Übersicht als Arbeitsvorrat, Ansichten folgen der Arbeit) · T-051
Überstunden und Urlaub (geparkt, braucht ein Soll-Modell). Ob ältere Zeilen ohne ✓ der Tabelle in Git erledigt sind,
klärt B16.

---

## Phase 2 — Offiziell werden

Läuft nach D-011 in Teilen parallel.

| Bahn | Wer | Inhalt |
|---|---|---|
| **Firma** | Tim | Pilot als Einzelunternehmer (D-116), später GmbH; Konto, Finanzamt, Steuerberater |
| **Marke** | Tim | Produktname, Ähnlichkeitsrecherche, DPMA-Anmeldung (längste Uhr, über neun Monate); die Tags hängen seit D-119 nicht mehr am Namen |
| **Recht** | Tim + Anwalt | AVV, Datenschutzerklärung, AGB; Verzeichnis und TOM prüfen lassen (Texte zuerst an den Code angleichen, B15) |
| **Store** | Tim + Codex | D-U-N-S, Play-Firmenkonto, Icon, Texte, signiertes Release |
| **Support** | Tim + Claude | Meldeweg, Störungsprozess, 72-Stunden-Frist nach Art. 33 DSGVO |

**Eigenes Tor:** Die Website wird erst öffentlich, wenn Impressum nach § 5 DDG und Datenschutzerklärung stehen.

## Phase 3 — Pilot und Verkauf

Echter Pilotbetrieb mit AVV · Politur an den Stellen, die im Pilot weh taten · Preis, Einseiter, Demo-Pfad ·
Mitbestimmungs-Handreichung für Kunden mit Betriebsrat · Go/No-Go.

**Stempelpunkte (D-144), nach dem Pilot:**

| | Aufgabe | Inhalt | Wer |
|---|---|---|---|
| **T-128** | Karten für „Allgemeine Arbeitszeit“ und Projekte | Heute darf eine Karte nur auf einen Kunden oder auf „Pause“ zeigen (`nfc_assignments_subject_shape_v3`, Migration 017). Künftig auf jedes Arbeitsziel; beliebig viele Karten je Ziel (für Kunden schon heute möglich). Server mit Migration, Offline-Freigaben und Erfassung; „Karte einrichten“ in App und Web mit Zielwahl; neuer App-Build. Antippen wie heute: starten, beenden, wechseln. Etwa zwei Sitzungen. | Codex |
| **Prototypen** | Wandrahmen (01) und Tischkeil (04) aus dem 3D-Drucker | PLA oder PETG, kein Filament mit Metall- oder Carbonanteil; Karte im Scheckkartenformat (NTAG 424 DNA, D-111) höchstens etwa 1 mm unter der Oberfläche (Druckpause oder Kartenschlitz); Keil mit Gummifüßen und schwerer Füllung. Lesetest mit iPhone und Android, mit und ohne Hülle (auch Metallring), Rahmen auf Holz, Gipskarton und Metall. Danach Fotos und kurzes Video für die Startseite. | PO |
| **T-073** | Fälschungssichere Chips | Voraussetzung, um einen Wandpunkt als Anwesenheitsnachweis zu verkaufen (siehe Pilotmonat 1). | Codex |


## Was bewusst wartet

Controlling und Stundensätze, Budgets, Self-Service-Onboarding, Abrechnungsautomatik, Dashboards, vollständige
Rollenmatrix mit System Owner und Team Lead, Mehrfach-Mitgliedschaft, Statusseite, Zertifizierungen. Ein Feld, das heute
niemand benutzt, ist Datenschutz-Ballast und Migrationsschuld.

## Was der Betrieb kostet

**~8 € netto im Monat**, dauerhaft. Einmalig 25 USD Play Console, 290 € Markenanmeldung und das Rechtspaket.

---

## Analyse-Pakete nach T-098 (D-103)

Neutral benannt; die Einordnung aller 191 Befunde liegt nur lokal in `.audit-2026-09/`. Nummern (T-…) bekommt ein
Paket, wenn es startet; große Pakete werden dann geteilt.

| Paket | Inhalt | Befunde | Zeitpunkt |
|---|---|---|---|
| B01 | Lohnexport inhaltlich (laufende Einträge, Spalten, Verwaltungsstopp, Zeitbudget; PO-Fragen) | F-017, F-043, F-061, F-140 | vor dem ersten Lohnexport |
| B02 | Plausibilität an der Servergrenze | F-010, F-016, F-062, F-081, F-095, F-099 | Monat 1 |
| B03 | Admin-Web: Bedienung und Robustheit | F-018, F-040, F-041, F-042, F-093, F-094, F-111, F-112, F-133, F-156 | Monat 1 |
| B04 | App: Bedienung und Texte | F-034, F-035, F-106, F-107, F-149, F-150 | Monat 1 |
| B05 | App: Sitzung und Hintergrund | F-011, F-030, F-033, F-147 | Monat 1 |
| B06 | Server-Robustheit | F-009, F-044, F-045, F-046, F-080, F-113, F-115, F-116, F-117, F-118 | Monat 1 |
| B07 | Schema: Eigentümer, Rechte, Views, append-only | F-013, F-087, F-088, F-089, F-090, F-091, F-154, F-155, F-169 | Monat 1–2 |
| B08 | Idempotenz und Sperrreihenfolge | F-097, F-098, F-100, F-110, F-134, F-137 | Monat 2 |
| B09 | Engine: Duplikatfenster, Verwaltungs-Trigger | F-022, F-138, F-139 | Monat 2 |
| B10 | Cursor für Ziele und Projekte | F-019, F-096 | Monat 2 |
| B11 | Deploy-Controller: Fehlersemantik, Protokoll, Tests unter errexit | F-036, F-037, F-059, F-077, F-108, F-128, F-184 | vor dem Deploy danach |
| B12 | Sicherung und Monitoring: Zeitgrenzen, Totmannschalter | F-049, F-055, F-056, F-084, F-120, F-122, F-123 | mit T-132 (D-149) |
| B13 | Sicherung vereinfachen, PITR-Reichweite (PO/TL) | F-053, F-060, F-125, F-182 | Monat 2–3 |
| B14 | CI und Migrationen | F-109, F-126, F-127, F-129, F-130, F-131, F-132 | Monat 2 |
| B15 | Rechtstexte an den Code angleichen | F-025, F-026, F-050, F-082, F-083, F-102, F-163 | vorgezogen als T-134 (D-149) |
| B16 | Doku straffen | F-064, F-065, F-135, F-142, F-144, F-151, F-152 | Monat 1 |
| B17 | Linter, Formatter, Tests mit Verhalten | F-164, F-165, F-166 | nach Pilotstart |
| B18 | HTTP-Schicht: Routentabelle, Transaktionshülle | F-157, F-158, F-162, F-173, F-174 | nach Pilotstart |
| B19 | Admin-Web-Struktur | F-170, F-171, F-172, F-190, F-191 | nach Pilotstart |
| B20 | Kernkette einmal, geteilte Validierung | F-071, F-160, F-161 | nach Pilotstart |
| B21 | Schema-Snapshot und Rückbau | F-167, F-168, F-177, F-178, F-185, F-187, F-188, F-189 | nach Pilotstart |
| B22 | Demo-Pipeline und toter Code | F-086, F-175, F-176, F-180, F-181, F-183, F-186 | nach Pilotstart |
| B23 | Aufbewahrung und Wachstum | F-051, F-119 | mit T-016 |
| B24 | Kalender und Zeitzone | F-023, F-072, F-141, F-159 | nach Pilotstart |

**Offene Fragen an frogs (CEO-Termin):** Umsatzsteuerbefreiung von frogs (D-116), Startumfang, Chips gleich als NTAG 424
DNA (D-111), Tags je Schüler oder Raum, Ablauf einer Stunde, Gruppennachhilfe (Vorschlag: Teilnehmer an einem
Zeiteintrag, Lehrer zählt einmal, jeder Schüler einmal mit Gruppengröße), Kontingente, Geräte, Termine. **Lohn:**
Welches Lohnsystem, und in welcher Form bekommt es heute die Stunden (Personalnummer plus Monatssumme oder je Tag; Excel,
CSV oder DATEV-Import)? **Business Central (T-124):** Soll BC die Stunden je Mitarbeiter, je Schüler oder beides
bekommen, und welche Nummern verwendet BC dafür? Schiebt Taptura oder holt BC? Standard-Zeiterfassung oder eigene
Schnittstelle des BC-Partners? Was passiert mit Korrekturen nach der Übergabe? Gibt es eine Sandbox für uns?

**Offene PO-Fragen:** F-069 (Reaktivieren gelöschter Kunden, Projekte, Standorte), F-146 (Leerlauf-Abmeldung im Web),
F-148 (eigene laufende Zeit beenden je Rolle). F-153 ist mit D-141 entschieden (T-125). F-021 liegt in T-055; F-179 ist mit
T-084 erledigt.
