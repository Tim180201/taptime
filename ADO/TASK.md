# Aktuelle Aufgabe

> **Stand 18.09.2026, 10:47 Uhr:** Produktion läuft auf `939b4ba`. Der erste T-035-Deploy hat
> fünf Anläufe gebraucht; drei Erstlauf-Fehler wurden vorwärts repariert (`d68ff4d`, `9ea3b31`,
> `939b4ba`), die Belege nach DEPLOY.md liegen vor: `current-version`, `/health`, `/version.txt`
> und `[6/7] Backend und startfähiges Admin-Web belegen gemeinsam Version 939b4ba`.
> Codex hat keine offene Umsetzungsaufgabe. Die nächsten Schritte liegen beim Product Owner.

## Product Owner — Inbetriebnahme T-047 (D-049)

1. Als root in der Hetzner-Konsole `/opt/taptime/.env` ergänzen: `SUPABASE_SERVICE_ROLE_KEY`
   (aus dem Supabase-Dashboard, selbst eingetragen, nie im Chat) und
   `TAPTIME_EMPLOYEE_INVITATION_REDIRECT_URL=https://admin.tb-infra.de/willkommen`.
   Datei bleibt root-eigen, Modus 0600. Danach das Backend über den normalen Weg neu starten:
   `infrastructure/deploy 939b4ba` erneut aufrufen (erkennt den laufenden Stand, startet neu).
2. Im Supabase-Dashboard: Einladungsvorlage aus `docs/T-047-Inbetriebnahme.md` einsetzen,
   Redirect-URL `https://admin.tb-infra.de/willkommen` freigeben.
3. Abnahme: eine echte Einladung an das eigene Gmail-Postfach, auf dem Handy gelesen, Passwort
   gesetzt, in der App angemeldet (D-044). Erst dann ist T-047 abgenommen.
4. Neue APK über EAS bauen (T-052 ist serverseitig aktiv; die alte APK löscht ihre Queue erst
   nach Archivnachweis, sobald sie den neuen Stand trägt).
5. Verwahren: Bestätigung, dass der service-role-Schlüssel im Passwortmanager liegt.

## Development — nächste Aufgabe auf Zuruf

**T-057 · Deploy-Härtung** (Befunde in `ADO/PLAN.md`): Controller-Commit mit Regressionstests
im Deploy-Shelltest, danach Controller-Update über die Konsole nach DEPLOY.md. Erst nach
ausdrücklichem Auftrag des Technical Lead; bis dahin keine Änderung an `infrastructure/`.
