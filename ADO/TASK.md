# Aktuelle Aufgabe

> **Stand 21.10.2026:** Sperrbildschirm fertig: T-104a (Server), T-104b und T-104d (Android), T-104c (`5c15d81`,
> iPhone). Jetzt **T-133** (Runbook); danach T-132 (Sicherung, Brief nach den Messwerten des PO an der Konsole). Dann
> Deploy 8 und neue App-Builds. Ohne Verbindung des TL zum Mac legt Codex den geprüften Stand nach PO-Freigabe als
> Zweig `review/<aufgabe>` ab (STATUS).

## T-133 · Runbook nachziehen (DEPLOY.md)

**Für:** Development · **Risiko:** niedrig (nur Betriebsdokumentation, nach AGENTS 7 Teil der Umsetzung) · **Zeitbox:**
eine halbe Sitzung. Beginnt jetzt. Grundlage sind die Erfahrungen aus Deploy 7 und T-024 Teil B (17.10.).

### Umfang

1. **`.env` verschlüsselt sichern (Weg vom 17.10.)** als eigener Abschnitt, auf den T-024 und Deploy verweisen. Ablauf:
   - Root an der Hetzner-Konsole, in `/home/taptime-deploy`: `umask 077`, dann
     `openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -salt -in /opt/taptime/.env >env.enc` (Umleitung mit
     `>`, kein `-out`, weil ein fehlendes Leerzeichen dort zu „Unknown cipher“ führt), `chown taptime-deploy env.enc`.
     Die Passphrase steht im Passwortmanager unter „Taptura env-Transport“ (nur Kleinbuchstaben ohne y/z und Ziffern,
     wegen der US-Tastatur) und wird nur in die Abfrage von `openssl` getippt.
   - Am Mac: `ssh taptime-deploy@46.225.58.30 'cat env.enc' > ~/env.enc`, dann
     `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -in ~/env.enc | pbcopy` und **sofort** in den
     Passwortmanager einfügen; dazwischen nichts anderes kopieren. Danach `pbcopy < /dev/null` und `rm ~/env.enc`.
   - Zurück an der Konsole: `shred -u /home/taptime-deploy/env.enc`. Prüfung der verwahrten Kopie nur anhand der
     Schlüsselnamen, nie der Werte.
2. **Image-Revision eindeutig bestimmen.** Der Abschnitt mit `gh run view <run-id> --json headSha` ist falsch: Bei einem
   `workflow_run` ist `headSha` des Image-Laufs die Spitze von `main` beim Start, etwa ein späterer `[skip ci]`-Commit,
   nicht der gebaute Commit (Deploy 7: Image zu `1918d5a`). Einen geprüften Weg beschreiben, der den gebauten Commit
   liefert (zum Beispiel über den auslösenden CI-Lauf des freigegebenen Commits oder das Label
   `org.opencontainers.image.revision`), und ihn mit den Läufen zu Deploy 7 nachweisen. Der Vergleichswert bleibt der vom
   TL freigegebene Commit, nie die Spitze von `main`.
3. **Hetzner-Konsole richtig beschreiben.** Einfügen gibt es doch, aber unzuverlässig: mehrere Zeilen verschmelzen zu
   einer, Leerzeichen können fehlen. Deshalb jede Zeile einzeln, vor Enter lesen, Foto der Abschlusszeile. Tastentabelle
   für eine deutsche Tastatur vervollständigen: `-` ß, `_` Shift+ß, `/` Minus-Taste, `=` ´, `:` Shift+Ö, `"` Shift+Ä,
   `$` Shift+4, `{` Shift+Ü, `}` Shift++, `>` Shift+Punkt, `|` Shift+#, `y` und `z` vertauscht. Nie Strg+Alt+Entf.
4. **Verweise:** T-024 Teil B (Schritte „neu verwahren“) und die PO-Schritte vor einem Deploy zeigen auf Punkt 1.

### Grenzen

Nur `infrastructure/DEPLOY.md` (und, falls dort dieselben Aussagen stehen, `infrastructure/MONITORING.md` oder
`RESTORE.md`). Kein Server-Zugriff, keine Geheimnisse, kein Deployment, keine Workflow-Änderung. Prüfung: Lesbarkeit,
keine falsche Aussage, Befehle gegen die Skripte und Workflows im Repository geprüft. Bericht in `.t133-review/`; kein
Commit vor `APPROVED`.

---

## Danach: T-132 · Sicherung und Wiederherstellungsprobe brauchen mehr Platz (Befund 17.10.)

Brief folgt nach den Messwerten des PO an der Konsole (`df -h /run`, `free -m`, Datenbankgröße) und seiner
Entscheidung über die Lösung (u. a. größerer Server). Siehe STATUS und PLAN.
