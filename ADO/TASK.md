# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-004 · Server, PostgreSQL, Schema und Laufzeitrollen

**Für:** Codex · **Risiko:** Mandantentrennung → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** ADR-0021

### Ziel

Ein Hetzner-Server in Deutschland trägt PostgreSQL mit dem vollständigen Schema und den
17 Laufzeitrollen. Die Migrationen laufen dort **als Superuser** — identisch zu lokal und CI.

### Schritt 0 — Aufräumen vor dem Anfang

Die uncommitteten Änderungen aus T-003d und T-003f werden **verworfen**:

```
git checkout -- apps/backend-schema/src/migrations.ts apps/backend-schema/migrations/
git status --short
```

Begründung: Sie lösen ausschließlich das Nicht-Superuser-Problem, das mit ADR-0021 entfällt.
Halbfertige Komplexität für einen verworfenen Fall wird nicht mitgeschleppt.

**Was bleibt:** Die committeten Verbesserungen aus T-003b (Prüfblöcke gegen SUPERUSER) sind
unabhängig richtig und bleiben unverändert.

Prüfe danach: Alle 13 Migrationen sind byte-identisch zu `origin/main`.

### Schritt 1 — Server anlegen

Das macht der **Product Owner** in der Hetzner Cloud Console. Sage ihm Bescheid, sobald
Schritt 0 sauber ist, und warte auf die IP-Adresse.

Vorgabe: **CX23**, Standort **Nürnberg oder Falkenstein**, Ubuntu LTS, SSH-Schlüssel
`tim-mac-taptime`, **Backups aktiviert**, kein Passwortlogin.

### Schritt 2 — Server absichern

- SSH nur mit Schlüssel, **Passwortanmeldung und Root-Login per Passwort deaktiviert**
- Firewall: **nur 22, 80 und 443** von außen erreichbar
- **PostgreSQL ist von außen nicht erreichbar** — kein offener Port 5432 ins Internet
- Automatische Sicherheitsaktualisierungen aktiviert
- Zeitzone UTC

### Schritt 3 — PostgreSQL als Container

- Feste Hauptversion, passend zu lokal und CI. **Version nennen und begründen.**
- Daten auf einem dauerhaften Datenträger, nicht im Container
- Erreichbar nur für den API-Container über ein internes Netz
- Ein Installationsbenutzer mit Superuser-Rechten für Migrationen

### Schritt 4 — Schema einspielen

- Migrationen 001 bis 013 in Reihenfolge
- Nachweisen: alle erwarteten Tabellen vorhanden, RLS auf jeder fachlichen Tabelle
  **`ENABLED` und `FORCED`** — Liste in den Bericht
- Ledger vollständig, Prüfsummen stimmen

### Schritt 5 — Die 17 Laufzeitrollen

- Vorlage: `infrastructure/postgres/local-runtime-logins.sql`
- Namensschema `taptime_<modul>`, **je Rolle ein eigenes Zufallspasswort** (mind. 32 Zeichen
  aus kryptographischem Zufall)
- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS` — für alle 17, ohne Ausnahme
- Jede Rolle bekommt **exakt die Rechte, die ihr Modul braucht** — nicht mehr
- Als `infrastructure/postgres/server-runtime-logins.sql` ablegen, **mit Platzhaltern statt
  Passwörtern**

### Schritt 6 — Konfiguration und Nachweis

- `.env` auf dem Server erzeugen, nach dem Muster aus `infrastructure/env.example`
- `SUPABASE_ISSUER` bleibt auf das Supabase-Projekt gerichtet — **Auth ändert sich nicht**
- `TAPTIME_MOBILE_OWN_TIME_CURSOR_HMAC_KEY`: 32 Zufallsbytes, base64url ohne Auffüllzeichen
- **Negativprobe:** Melde dich mit einer Laufzeitrolle an und weise nach, dass sie etwas, das
  ihr Modul nicht braucht, **nicht** kann. Ergebnis in den Bericht.

### Vision-Check

Keine fachliche Logik wird geändert. Keine Migration wird bearbeitet. Die Kette
`Trigger → WorkEvent → BusinessEngine → TimeEntry` bleibt unberührt.

### Nicht anfassen

- `apps/backend-schema/migrations/` — die Migrationen werden **ausgeführt**, nicht bearbeitet
- `packages/core`, jede Geschäftslogik, `apps/mobile`, `apps/synthetic-android-e2e`

### Prüfung

- Migrationen 001–013 vollständig, Ledger stimmt
- RLS auf allen fachlichen Tabellen `ENABLED` und `FORCED`
- Alle 17 Rollen ohne `SUPERUSER` und ohne `BYPASSRLS` — **nachweisen, nicht behaupten**
- PostgreSQL von außen nicht erreichbar — **nachweisen**
- **Kein Geheimnis im Repository.** `git diff` gegen Passwörter und Verbindungszeichenfolgen prüfen
- CI grün

### Zusätzliches Review

> Kann eine der 17 Laufzeitrollen mehr, als ihr Modul benötigt? Ist die Datenbank von außerhalb
> des Servers erreichbar? Liegt irgendein Geheimnis im Repository?

### Abschluss

Vier Punkte melden. **Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-005` — API-Container, Caddy, TLS. Dann T-006 Admin-Web, T-007 Backup und **getesteter
Restore**, T-008 Pausen, T-009 Standorte, T-010 Oberflächen, T-011 installierbare App.
