# Aktuelle Aufgabe

> **Stand 22.09.2026:** Produktion auf `d75fd56`. Auf `main` fertig und grün: T-065, T-066, T-069,
> T-070, T-057. T-068a ist abgenommen und wird mit dieser Aufgabe zusammen committet bzw. ist
> bereits committet. Reihenfolge: **T-068b → Konsolenschritt (Controller) → Deploy → Betreiber-Konto
> → APK → Geräteabnahme → Pilot Monat 1**. Frühere Briefs stehen in der Git-Historie.

## T-068b · Betreiber-Bereich — Web und Auslieferung

**Für:** Development · **Risiko:** Trennung der Oberflächen, Auslieferung, zweiter Faktor
**Zeitbox:** zwei Sitzungen; Reihenfolge App → Caddy/Compose → CI/Abbild → Deploy-Controller → Runbook.
**Grundlage:** D-068, D-074, D-075, D-079, T-068a; Entwurf
`ADO/01_Architecture/Betreiber_Entwurf/README.md` (Abschnitte 2, 6, 7) und der abgenommene
Klick-Entwurf `betreiber-bereich-entwurf.html` im selben Ordner.

### Auftrag

1. **`apps/operator-web`** (neu, Muster `apps/admin-web`: Vite, React, TypeScript, dieselben
   UI-Leitlinien, deutsch, Europe/Berlin):
   - **Anmelden** mit E-Mail und Passwort über Supabase, danach **TOTP**: beim ersten Mal
     einrichten (QR und Handeingabe des Schlüssels), sonst Code abfragen. Erst bei `aal2`
     antwortet der Server; `/v1/operator/session` steuert die Anzeige (`mfa_required`).
   - **Übersicht** mit Kacheln (Betriebe, Mitarbeiter gesamt, jetzt aktiv, Taps heute) und
     Tabelle der Betriebe (Name, Status, Zahlen, letzter Tap) — nur die Felder aus T-068a.
   - **Betrieb anlegen** im Seitenpanel (Name, E-Mail des ersten Administrators), Ergebnis
     verständlich, `identity_unavailable` als eigener Text; `commandId` je Versuch stabil.
   - **Pausieren / Fortsetzen** mit Grund und Bestätigungsschritt, erwartete Version mitgeben,
     `conflict` heißt „Ansicht veraltet, bitte neu laden".
   - **Protokoll** (seitenweise) und **Betriebszustand** (Version, Datenbankgröße, letzte
     Archivierung, letzte geprüfte Basis).
   - **Sitzung:** `sessionStorage`, kein `localStorage`; Abmelden nach 30 min ohne Aktivität;
     Abmelden-Knopf. Keine Tenant-Funktionen, kein gemeinsamer Client mit dem Admin-Web.
   - Tests wie im Admin-Web (Verhalten, Fehlerfälle, Rollen-/Zustandswechsel) **inklusive axe**.
2. **Caddy und Compose:** neuer Block `betreiber.tb-infra.de` nach dem Muster von `admin.`:
   strikte CSP (nur `self` plus Supabase in `connect-src`), HSTS, `X-Frame-Options DENY`,
   statische Auslieferung aus `/srv/operator-web` mit `releases/<version>` und `current`,
   `no-store` für `index.html`. **Nur `/v1/operator/*` wird zum Backend geleitet.**
   `api.` und `admin.` beantworten `/v1/operator/*` ausdrücklich mit 404 (Test).
   Compose bindet `/opt/taptime/operator-web` schreibgeschützt ein.
3. **CI und Abbild:** `operator-web` wie `admin-web` bauen und als
   `…:operator-web-<sha>` veröffentlichen (gleiche Quelle für Supabase-URL und öffentlichen
   Schlüssel, gleiche Prüfungen). Die bestehenden Abhängigkeits-Schutztests decken den neuen
   Workspace mit ab.
4. **Deploy-Controller:** vorbereiten, aktivieren und prüfen wie Admin-Web
   (`/opt/taptime/operator-web`, `https://betreiber.tb-infra.de/version.txt`, Bündelprüfung:
   genau ein Skript, erwartete Supabase-Herkunft, `sb_publishable_`-Schlüssel), Rücknahme auf die
   Vorversion im selben Muster. Reihenfolge und bestehende Schritte bleiben unverändert;
   die Aktivierung beider Weboberflächen erfolgt im selben Schritt wie heute Admin-Web.
5. **Erstinstallation und Rücknahme (TL, 23.09.):** Das Betreiber-Web gibt es in keiner früheren
   Version. Der Controller behandelt eine fehlende Vorversion einer Weboberfläche ausdrücklich als
   **Erstinstallation**: Er bereitet nur die Zielversion vor, bricht nicht ab und schreibt eine
   eigene Zeile („Betreiber-Web wird erstmals installiert; keine Rücknahmeversion"). Bei einer
   **Rücknahme** ohne Vorversion wird die Oberfläche deaktiviert (`current` entfernen, Zustand
   prüfen, Zeile im Protokoll); Admin-Web und Backend werden wie bisher zurückgenommen.
   Beides mit Rotnachweis. Sobald eine Vorversion existiert, gilt wieder das heutige Verhalten.
6. **DNS als Voraussetzung:** Die Prüfung von `https://betreiber.tb-infra.de/version.txt` setzt den
   DNS-Eintrag voraus. Die Vorprüfung löst den Namen zuerst auf und bricht **vor** jeder Änderung
   mit einer klaren Meldung ab („DNS-Eintrag für betreiber.tb-infra.de fehlt"), statt später an der
   Bündelprüfung zu scheitern.
7. **Runbook:** `infrastructure/DEPLOY.md` bekommt den **einen** Konsolenblock für T-057 **und**
   T-068b (Controller-Update aus dem Operations-Abbild, US-tippbar), den Ablauf nach dem Deploy
   (`taptime-operator-db-login`, `taptime-operator-grant <uuid>`, Anmeldung, TOTP einrichten)
   und den DNS-Eintrag als Voraussetzung. `RESTORE.md` bleibt wie in T-068a ergänzt.

### Tests (Rotnachweis zuerst)

Anmeldung ohne zweiten Faktor kommt nicht über die Einrichtung hinaus; abgelaufene Sitzung führt
zurück zur Anmeldung; Betrieb anlegen (Erfolg, bekannte E-Mail, Fehler der Einladung);
Pausieren/Fortsetzen inkl. `conflict`; Protokollseiten; Betriebszustand; axe ohne Verstöße;
Caddy: `/v1/operator/*` nur auf `betreiber.`, statische Pfade, Header; Deploy: Vorbereiten,
Aktivieren, Prüfen und Rücknahme beider Weboberflächen, fehlendes Bündel bricht ab.

### Nicht Teil

Keine Änderung an T-068a-Server, Migrationen oder Werkzeugen außer echten Befunden (dann melden).
Kein Server, keine Secrets, kein Deploy, kein APK.

### Bericht

`.t068b-review/` (report.md, tracked.diff, untracked.txt) inkl. des fertigen Konsolenblocks.
Unabhängiges Review. Kein Commit, kein Push.
