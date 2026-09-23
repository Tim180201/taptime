# Aktuelle Aufgabe

> **Stand 23.09.2026:** Produktion auf `ff69bfe`. T-072 (iPhone Stufe 1) ist auf `main`. T-031-Befund vom
> 23.09. (Stopp: Caddy-Neustart ohne Rückweg bei aktivem Archivvertrag) ist vom TL mit **D-085** entschieden;
> der zweite Befund (Autosave nicht verlässlich) ist unten in Teil A eingearbeitet.
> Reihenfolge: **T-031 (Teil A, dann B) → T-074 → Konsole und Deploy → Pilot Monat 1**.

## T-031 · Caddy-Rückweg (D-085) und Startseite hinter Passwort (D-083)

**Für:** Development · **Risiko:** gemeinsamer Caddy (api/admin/betreiber), Deploy-Controller, Datenschutz
**Zeitbox:** drei Sitzungen; **Teil A zuerst**, Teil B baut darauf auf. Ein Bericht, ein Review.
**Grundlage:** D-083, D-085, D-061, `UI_Leitlinien.md`, Befund `.t031-review/report.md` (23.09.), Entwurf
`ADO/01_Architecture/Startseite_Entwurf/` (README dort lesen).

### Teil A · Caddy-Rückweg unabhängig vom Archivvertrag (D-085)

Belegte Fakten (Caddy 2.10.2, Quelltext und Echttest im Befund vom 23.09.): `autosave.json` ist **kein**
verlässlicher Stand — ein Schreibfehler wird nur protokolliert, das Laden gilt trotzdem als erfolgreich;
`--resume` lädt dann eine ältere Konfiguration. Beides wird deshalb nicht verwendet. Ein abgewiesener Reload
lässt die laufende Konfiguration aktiv; ein CLI- oder Transportfehler allein beweist aber keinen unveränderten
Zustand. `{file.*}` in `basic_auth` wird beim Laden aufgelöst, eine fehlende Datei ist ein Ladefehler; bei
unverändertem JSON braucht ein neuer Hash `reload --force`.

1. **Vorab exakt prüfen:** `validate_caddy_candidate` prüft die neue Konfiguration in einem Wegwerf-Container
   mit **denselben Einbindungen wie der Dienst** (Caddyfile, Web-Verzeichnisse, Zugangsverzeichnis). Scheitert
   das, bricht der Deploy vor jeder Umschaltung ab.
2. **Vor dem Umschalten sichern — Pflicht:** Der Controller liest die **laufende** Konfiguration über Caddys
   lokale Admin-Schnittstelle im Container aus, speichert sie atomar und nur für root lesbar in seinem Zustand
   und prüft die gespeicherte Datei (gültiges JSON, von Caddy ladbar). Scheitert Auslesen, Speichern oder
   Prüfen, bricht der Deploy vor jeder Umschaltung ab.
3. **Nach dem Umschalten zuerst die Kante prüfen**, mit Wiederholung im gemeinsamen Zeitbudget (T-071):
   admin und betreiber liefern die erwartete `version.txt` bzw. 404, api antwortet über Caddy. Scheitert das,
   lädt der Controller **unabhängig vom Archivvertrag** ausdrücklich die gesicherte Datei — läuft der neue
   Container, über die Admin-Schnittstelle und mit anschließendem Abgleich der laufenden Konfiguration gegen die
   Sicherung; startet er nicht, mit genau dieser Datei als `--config`, ohne `--resume` —, prüft die Kante
   erneut und beendet den Deploy mit Fehler und klarer Meldung. Das Backend bleibt, wie es ist
   (Vorwärtsreparatur wie bisher, `DEPLOY.md`). Die Archivvertragssperre bleibt unverändert.
4. **Rot vor Grün mit aktivem Archivvertrag:** neue Konfiguration lädt nicht; Container startet nicht; Kante
   antwortet falsch → jeweils alte Kante wiederhergestellt, Backend unberührt, Exitcode erhalten. Dazu der
   Normalfall ohne Rücknahme, der Fall „Rücknahme scheitert auch“ mit eindeutiger Meldung und „Sicherung
   scheitert“ → Abbruch vor der Umschaltung. Nach jedem Rückladen stimmt die laufende Konfiguration mit der
   Sicherung überein; `autosave.json` und `--resume` kommen nirgends vor.

### Teil B · Startseite hinter Passwort (D-083)

5. **Seite `apps/landing-web`** wie bisher beauftragt: Vite ohne Framework, Texte/Aufbau/Bewegungen nach
   Entwurf, Schriften selbst ausgeliefert (Muster: Admin-Web), keine Inline-Skripte/-Stile, Anfrage-Adresse
   als ein Wert (leer), `/tag`, `robots.txt`, `version.txt`, Titel, Beschreibung, noindex nach README.
6. **Caddy:** Block `tb-infra.de`, `www` → 301; Kopfzeilen wie Betreiber-Web plus `X-Robots-Tag`; strikte CSP
   ohne fremde Quellen; Basic Auth mit Benutzer `pilot` und Hash aus einer Datei im neuen Zugangsverzeichnis
   `/opt/taptime/landing-auth` (Verzeichnis einbinden, nicht die Datei), frei nur `/tag` samt Dateien,
   `robots.txt`, `version.txt`; `/v1/*` und `/health` → 404; ohne aktive Version 404.
   **Gesperrt statt kaputt:** Fehlt die Hash-Datei, legt der Controller vor der Prüfung aus Punkt 1 einen
   gesperrten Zugang an (Hash eines verworfenen Zufallswerts) — Caddy lädt, niemand kommt hinein (401).
7. **`taptime-landing-password`** (root, über die Betriebsdateien installiert): Passwort zweimal über stdin
   ohne Echo; Hash ohne Argumentübergabe; neue Datei atomar; `caddy reload --force`; scheitert der Reload oder
   die anschließende Prüfung, alte Datei zurück und erneut `reload --force`. Danach prüfen (`/` ohne Zugang 401, `/tag` 200). `--disable` setzt wieder einen gesperrten
   Zugang. Ausgabe nur „gesetzt“ bzw. „gesperrt“.
8. **Auslieferung** wie Betreiber-Web: CI, `…:landing-web-<sha>` mit Fähigkeits-Label, GHCR-Bereinigung,
   vorbereiten/aktivieren/zurücknehmen; Stände ohne Startseite bleiben auslieferbar. Scheitert nur die
   Startseiten-Prüfung (z. B. Zertifikat nach Budget), wird sie deaktiviert und der Deploy schlägt fehl;
   api/admin/betreiber bleiben unberührt, keine Caddy-Rücknahme dafür.
9. **Anleitung** in `infrastructure/DEPLOY.md`: ein Konsolenblock für Controller (T-071 und dieser) →
   Deploy → `taptime-landing-password` → Prüfung im Browser. Passwort an der Hetzner-Konsole (US-Tastatur):
   nur Kleinbuchstaben ohne y/z und Ziffern, mindestens 16 Zeichen. Wiederherstellungsweg für Caddy beschreiben.

### Tests

Teil A wie Punkt 4. Teil B: axe ohne Verstöße (Startseite, `/tag`); keine fremden Ressourcen; keine
Inline-Skripte/-Stile; Adresse leer/gesetzt; reduzierte Bewegung; Pause-Knopf; keine waagerechte Scrollleiste
bei 320/390/1440 px im echten Browser. Echter Caddy: `/` 401 ohne und 200 mit Zugang; `/tag`, `robots.txt`,
`version.txt` 200; `X-Robots-Tag` und CSP überall inkl. 401; `www` 301; gesperrter Zugang 401; fehlende
Hash-Datei = Ladefehler (belegt, warum der Controller anlegt); api/admin/betreiber unverändert. Werkzeug: nie
Passwort in argv/Ausgabe, Reload-Fehler stellt alte Datei her. Vollständige Suiten, Typechecks, ShellCheck.

### Nicht Teil

Impressum, Datenschutzhinweise, öffentliches Freischalten, Anfrage-Adresse (T-031b); Formular, Cookies,
Tracking; Änderungen am Backend-Rollback oder an der Archivvertragssperre; kein Deploy, kein Serverzugriff.

### Bericht

`.t031-review/` (report.md, tracked.diff, untracked.txt), Bildschirmfotos Startseite und `/tag` bei 390 und
1440 px. Unabhängiges Review. Kein Commit, kein Push.
