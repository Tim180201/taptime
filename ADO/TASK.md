# Aktuelle Aufgabe

> **Stand 15.10.2026:** T-105 abgeschlossen (`fb28166`). Jetzt **T-024**: Teil A (Werkzeug, Codex), dann Deploy 6
> (T-119, T-121, T-122, T-105, T-024a) und Teil B an der Konsole (PO, TL begleitet). Danach Pilot-Vorbereitung.

## T-024 · Geheimnisse rotieren (Teil A: Werkzeug und Runbook)

**Für:** Development · **Risiko:** hoch (Produktionszugänge) · **Zeitbox:** eine Sitzung. Unabhängiges Review (AGENTS
§ 4). Codex liest nie `/opt/taptime/.env` oder `/etc/taptime-*`, führt nichts auf dem Server aus und deployt nicht.

### Warum

Datenbank-Zugangsdaten und der Cursor-Schlüssel stehen seit dem Screenshot vom 25.08. als offengelegt in PLAN. Für den
Betreiber-Zugang gibt es `taptime-operator-db-login --rotate`; für die übrigen Zugänge fehlt ein Werkzeug.

### Umfang

1. **`infrastructure/operations/taptime-runtime-rotate`** nach dem Muster von `taptime-operator-db-login`: root, Lock,
   `.env` als Daten lesen (nie `source`), Besitz root:root 0600, doppelte Schlüssel brechen ab, genau ein laufender
   Datenbank- und Backend-Container. Die Liste der LOGIN-Rollen wird aus `infrastructure/postgres/server-runtime-logins.sql`
   abgeleitet (AGENTS 1.6, keine feste Liste) und mit den `*_DATABASE_URL`-Schlüsseln der `.env` abgeglichen; jede
   Abweichung bricht ab, bevor etwas geändert wird. Der Betreiber-Zugang bleibt ausgenommen.
2. **Ablauf:** je Rolle ein neues Passwort, dazu ein neuer `TAPTIME_MOBILE_OWN_TIME_CURSOR_HMAC_KEY` (je 32 Zufallsbytes,
   base64url ohne Auffüllung). Neue `.env` im selben Verzeichnis vorbereiten; `ALTER ROLE … PASSWORD` in **einer**
   Transaktion vorbereiten; erst wenn beides bereit ist, gemeinsam festschreiben; Backend neu starten; Gesundheit wie
   im Deploy prüfen. Scheitert etwas danach: alte Passwörter zurück, alte `.env` zurück, Backend neu starten, Exit ≠ 0.
   Erfolgreich: die vorbereitete Altkopie sicher entfernen. Ausgabe nur Rollennamen und „rotiert“; kein Geheimnis in
   `argv`, Ausgabe, Protokoll oder Umgebung von Kindprozessen außer dem einen psql über stdin.
3. **Lebenszyklus (AGENTS 1.5):** Das Operations-Abbild liefert das Werkzeug wie `taptime-operator-db-login` aus
   (Dockerfile, Dateiliste und Modus 700 in `infrastructure/deploy`); der PO ruft es an der Konsole auf; es verschwindet
   mit dem Operations-Abbild, das es nicht mehr enthält. Es legt nichts dauerhaft an außer der neuen `.env`.
4. **Runbook in `infrastructure/DEPLOY.md`, Abschnitt „T-024: Geheimnisse rotieren“**, als Schrittfolge für Teil B (unten),
   jeder Konsolenbefehl kurz genug für die Hetzner-Konsole ohne Einfügen. `MONITORING.md`: ntfy-Thema erneuern
   (neues Thema aus 32 Zufallsbytes in `/etc/taptime-monitor/ntfy.curl`, App umstellen, Testmeldung).
5. **Tests** nach dem Muster von `taptime-operator-tools.test`: Erfolg; Abweichung Rollenliste/`.env`; falsche Rechte;
   doppelter Schlüssel; Fehler beim `ALTER ROLE` (nichts geändert); Fehler beim Start (vollständiger Rückweg);
   Lock; kein Geheimnis in aufgezeichnetem `argv` oder Ausgabe. Nachgebaute docker/psql folgen der Semantik der
   installierten Versionen (AGENTS § 4). Dazu der Deploy-Test für Dateiliste und Modus.

### Teil B (nicht Codex; PO an der Konsole, TL begleitet, mit Deploy 6)

Vorher alte `.env` getrennt verwahrt. Neuer Deploy-Schlüssel mit Passphrase am Mac; der öffentliche Teil kommt über
`https://github.com/<Konto>.keys` an die Konsole, Fingerabdruck vergleichen, Zeile in `authorized_keys` von
`taptime-deploy` ergänzen. **Deploy 6 mit dem neuen Schlüssel** (belegt ihn), danach alten Schlüssel entfernen.
`taptime-runtime-rotate`, dann `taptime-operator-db-login --rotate`, Status prüfen. Neue `.env` vollständig neu
verwahren (mit `SUPABASE_PUBLISHABLE_KEY`). `/root/env-0410.bak` mit `shred -u` entfernen. Neues ntfy-Thema.
Supabase nach D-139 (Mindestlänge 10, Anmeldegrenze 100 je 5 min).

### Grenzen

Keine Änderung an Backend, Web, App, Migrationen. Kein Deploy, kein Serverzugriff. ADO nicht ändern.

### Bericht

`.t024-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2.
Kein Commit vor `APPROVED` durch den TL.
