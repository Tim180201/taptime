# Aktuelle Aufgabe

> **Stand 23.09.2026:** Produktion auf `ff69bfe`. T-072 (iPhone Stufe 1) ist APPROVED und auf `main`;
> iOS-Build, TestFlight und neue APK macht der PO. Reihenfolge: **T-031 (parallel zur Geräteabnahme)
> → Geräteabnahme Android und iPhone → Konsole und Deploy → Pilot Monat 1**. Frühere Briefs stehen in
> der Git-Historie.

## T-031 · Startseite hinter Passwort (D-083)

**Für:** Development · **Risiko:** Auslieferung (Caddy, Deploy-Controller), Datenschutz, Nebenwirkung
auf api/admin/betreiber
**Zeitbox:** zwei Sitzungen; Reihenfolge Befund → Seite → Caddy → Werkzeug → Auslieferung → Anleitung.
**Grundlage:** D-083, D-061 (Tag-Adresse), `UI_Leitlinien.md` (Startseite: Sie), Entwurf
`ADO/01_Architecture/Startseite_Entwurf/` (vom PO am 23.09. abgenommen; README dort lesen).

### Ziel

Unter `https://tb-infra.de` steht die Startseite nach dem Entwurf, geschützt durch Benutzername und
Passwort; Tim gibt den Zugang an Pilot-Interessenten. Frei erreichbar ist nur `https://tb-infra.de/tag`:
eine kurze Hilfeseite für alle, die einen Tag außerhalb der App antippen. Keine Cookies, kein Tracking,
keine Anfrage an fremde Server, für Suchmaschinen gesperrt. api, admin und betreiber bleiben unverändert.

### Auftrag

1. **Befund zuerst (Stop-Regel):** Am Quelltext belegen, wie Betreiber-Web gebaut, als Abbild
   veröffentlicht, vom Deploy-Controller vorbereitet/aktiviert/geprüft/zurückgenommen und von Caddy
   ausgeliefert wird, und wie Caddy-Geheimnisse und Betriebswerkzeuge (`taptime-operator-grant`) auf
   den Server kommen. Die Startseite folgt diesem Muster. Weicht etwas Wesentliches ab oder bräuchte
   die Lösung einen Caddy-Neustart ohne Rückweg: **stoppen und melden.**
2. **Seite `apps/landing-web`:** Vite ohne Framework, statische Ausgabe. Texte, Aufbau, Reihenfolge und
   Bewegungen wie im Entwurf; Abweichungen im Bericht begründen. Technisch nach README Abschnitt 3:
   Schriften selbst ausgeliefert (OFL-Lizenz beilegen), kein Inline-Skript, kein Inline-Stil, keine
   `style`-Attribute; Anfrage-Adresse als **ein** Konfigurationswert, heute leer; alle
   „Vorschau“-Hinweise entfallen; Titel, Beschreibung und `robots` noindex/nofollow wie dort.
   Die zweite Schriftfamilie (JetBrains Mono) ist eine abgenommene Abweichung von den UI-Leitlinien.
   Dazu `/tag` nach README Abschnitt 4, `robots.txt` mit `Disallow: /` und `version.txt` wie bei den
   anderen Webs.
3. **Caddy:** Block `tb-infra.de` (http → https); `www.tb-infra.de` leitet dauerhaft auf
   `https://tb-infra.de` um. Kopfzeilen wie Betreiber-Web (HSTS, `X-Frame-Options DENY`, nosniff,
   `Referrer-Policy no-referrer`) plus `X-Robots-Tag "noindex, nofollow"` auf jeder Antwort; strikte
   CSP ohne fremde Quellen, `connect-src 'none'`, `form-action 'none'`. Basic Auth auf allem außer
   `/tag`, den dafür nötigen Dateien, `robots.txt` und `version.txt`. `/v1/*` und `/health` → 404.
   **Fail closed, ohne Nebenwirkung:** Ohne gesetztes Passwort oder ohne aktive Version antwortet die
   Startseite 503 bzw. 404 — Caddy startet trotzdem, api/admin/betreiber laufen unverändert. Das
   Passwort steht nie im Repository, Abbild, Argument, Log oder Chat.
4. **Zugang setzen — `taptime-landing-password`** (root, mit den Betriebsdateien installiert wie
   `taptime-operator-grant`): Benutzername fest `pilot`; Passwort zweimal über stdin ohne Echo; Hash
   über `caddy hash-password` ohne Argumentübergabe; atomar und nur für root lesbar gespeichert; Caddy
   neu laden; danach prüfen (`/` ohne Zugang 401, `/tag` 200). `--disable` sperrt die Seite wieder
   (503). Ausgabe nur „gesetzt“ bzw. „gesperrt“, nie Passwort oder Hash.
5. **Auslieferung:** CI baut `landing-web`; der Image-Workflow veröffentlicht `…:landing-web-<sha>` mit
   Fähigkeits-Label wie operator-web. Deploy-Controller: vorbereiten, aktivieren, prüfen
   (`https://tb-infra.de/version.txt`) und Rücksprung wie Betreiber-Web; Stände ohne Startseite
   bleiben auslieferbar. Die Controller-Änderung wird wie bisher an der Konsole installiert — zusammen
   mit der T-071-Korrektur in **einem** Konsolenblock in `infrastructure/DEPLOY.md`.
6. **Anleitung für Tim** in `infrastructure/DEPLOY.md`, deutsch, Schritt für Schritt: Konsolenblock
   → Deploy wie gewohnt → `taptime-landing-password` an der Konsole → Prüfung im Browser (Startseite
   fragt nach Zugang, `/tag` ohne Zugang lesbar). Hinweis: An der Hetzner-Konsole gilt die
   US-Tastatur; darum ein Passwort nur aus Kleinbuchstaben **ohne y und z** und Ziffern, mindestens
   16 Zeichen, damit es im Browser auf der deutschen Tastatur gleich ankommt.

### Tests

Rot vor Grün je Verhaltensänderung. **Seite:** axe ohne Verstöße (Startseite und `/tag`); keine fremden
Ressourcen in der Build-Ausgabe (ausgehender BAG-Link als `<a>` erlaubt); keine Inline-Skripte oder
-Stile; Anfrage-Adresse leer und gesetzt; bei `prefers-reduced-motion` alles sichtbar ohne
Scroll-Inszenierung; Pause-Knopf mit `aria-pressed`; keine waagerechte Scrollleiste bei 320, 390 und
1440 px, soweit mit der vorhandenen Testumgebung prüfbar. **Caddy** (echter Caddy wie
`taptime-operator-web.test.mjs`): `/` ohne Zugang 401, mit Zugang 200; `/tag`, `robots.txt`,
`version.txt` ohne Zugang 200; `X-Robots-Tag` und CSP auf jeder Antwort einschließlich 401; `www` → 301;
`/v1/*` 404; ohne Passwort bzw. ohne aktive Version 503/404 und die anderen Hosts unverändert.
**Werkzeug:** Passwort nie in argv oder Ausgabe, atomares Schreiben, `--disable`. **Deploy:**
Vorbereiten, Aktivieren, Rücksprung, Stand ohne Startseite. Vollständige Suiten, Typechecks, ShellCheck.

### Nicht Teil

Kein Impressum, keine Datenschutzhinweise, kein öffentliches Freischalten, keine Anfrage-Adresse
(T-031b); kein Formular, keine Cookies, kein Tracking, keine Analyse; keine Änderung an Verhalten von
api/admin/betreiber, App oder Tag-Format; kein Deploy, kein Serverzugriff, keine Geheimnisse.

### Bericht

`.t031-review/` (report.md, tracked.diff, untracked.txt), wenn möglich Bildschirmfotos von Startseite
und `/tag` bei 390 und 1440 px. Unabhängiges Review. Kein Commit, kein Push.
