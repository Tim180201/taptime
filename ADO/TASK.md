# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-003 · Supabase EU — Schema und Laufzeitrollen

**Für:** Codex · **Risiko:** Mandantentrennung → **unabhängiges Review verpflichtend**
**Zeitbox:** zwei Arbeitssitzungen · **Vorbedingung:** T-002b committet, CI grün

### Ziel

Das Supabase-Projekt trägt das vollständige Schema und 17 Laufzeitrollen mit minimalen Rechten.
Das Backend läuft lokal gegen Supabase und meldet `/health` = 200.

### Was der Product Owner bereitstellt

Eine Datei `.env.bootstrap` im Wurzelverzeichnis (nicht im Repo, steht in `.gitignore`):

```
SUPABASE_ADMIN_DATABASE_URL=<direkte Verbindungszeichenfolge aus dem Supabase-Dashboard>
SUPABASE_ISSUER=https://<project-ref>.supabase.co/auth/v1
```

**Das ist das einzige Geheimnis, das er anfassen muss.** Alle 17 Rollenpasswörter erzeugst du.

### Schritte

**1. Verbindung prüfen, bevor irgendetwas geschrieben wird**

- Verbindung aufbauen, PostgreSQL-Version und Region ausgeben
- **Wenn die Region nicht `eu-central-1` / Frankfurt ist: sofort stoppen und melden.** Nicht
  weiterarbeiten. Die Region ist nachträglich nicht änderbar.

**2. Migrationen einspielen**

- `apps/backend-schema/migrations/001` bis `013` in Reihenfolge, über die **direkte** Verbindung
- Danach nachweisen: alle erwarteten Tabellen im Schema `taptime_server` vorhanden, RLS auf jeder
  fachlichen Tabelle `ENABLED` **und** `FORCED`
- **Supabase-eigene Rollen und Schemas (`anon`, `authenticated`, `service_role`, `auth`, `storage`)
  werden nicht verändert.** Falls eine Migration daran scheitert: stoppen und melden, nicht umgehen.

**3. Die 17 Laufzeitrollen anlegen**

- Vorlage: `infrastructure/postgres/local-runtime-logins.sql`, adaptiert auf Supabase
- Namensschema `taptime_<modul>` statt `taptime_local_<modul>`
- **Jede Rolle bekommt ein eigenes, zufällig erzeugtes Passwort** (mindestens 32 Zeichen aus einem
  kryptographischen Zufallsgenerator)
- **Jede Rolle bekommt exakt die Rechte, die ihr Modul braucht — nicht mehr.** Die lokale Datei ist
  die maßgebliche Vorlage dafür.
- `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS` für alle 17. Ohne Ausnahme.
- Als neue Datei `infrastructure/postgres/supabase-runtime-logins.sql` ablegen — **ohne Passwörter**,
  mit Platzhaltern. Die Datei kommt ins Repo, die Passwörter nie.

**4. `.env` erzeugen**

- Nach dem Muster aus `infrastructure/env.example`, mit den echten Werten
- `TAPTIME_MOBILE_OWN_TIME_CURSOR_HMAC_KEY`: 32 Zufallsbytes, base64url ohne Auffüllzeichen
- **Die Datei bleibt lokal.** `.env` steht bereits in `.gitignore` — prüfe das nochmal.

**5. Verbindungsweg klären und dokumentieren**

Supabase bietet zwei Wege: die **direkte Verbindung** und den **Pooler (Supavisor)**.

- Migrationen und Rollenanlage laufen über die direkte Verbindung.
- Für die Laufzeit **prüfe, welcher Weg funktioniert.** Der Pooler im Transaktionsmodus kann
  sitzungsbezogene Einstellungen verwerfen — und unsere Mandantentrennung hängt daran.
  **Prüfe konkret, ob `SET LOCAL` und `current_setting()` über den gewählten Weg zuverlässig
  funktionieren.** Wenn nicht: melden, nicht selbst eine Notlösung bauen.
- Prüfe außerdem, ob der gewählte Weg über IPv4 erreichbar ist. Das entscheidet in T-004, wie der
  Hetzner-Server angebunden wird. Ergebnis in den Abschlussbericht.

**6. Nachweis, dass es wirklich läuft**

- Backend lokal mit dieser `.env` starten
- `/health` liefert `200 {"status":"ok"}`
- **Eine Negativprobe:** Melde dich mit einer Laufzeitrolle an und weise nach, dass sie etwas,
  das ihr Modul nicht braucht, **nicht** kann. Ergebnis in den Abschlussbericht.

### Vision-Check

Diese Aufgabe ändert **keine** fachliche Logik. Die Kette
`Trigger → WorkEvent → BusinessEngine → TimeEntry` wird nicht angefasst. Keine Migration wird
geändert, keine hinzugefügt.

### Nicht anfassen

- `apps/backend-schema/migrations/` — die Migrationen werden **ausgeführt**, nicht bearbeitet
- `packages/core`, jede Geschäftslogik, `apps/mobile`, `apps/synthetic-android-e2e`
- Alles unter `.github/`

### Prüfung

- Typecheck und Tests des betroffenen Bereichs grün, CI grün
- Migrationsprotokoll: 001 bis 013 vollständig, in Reihenfolge, ohne Fehler
- RLS auf jeder fachlichen Tabelle `ENABLED` und `FORCED` — Liste in den Bericht
- Alle 17 Rollen ohne `SUPERUSER` und ohne `BYPASSRLS` — nachweisen, nicht behaupten
- **Kein Geheimnis im Repository.** `git diff` gegen Passwörter, Verbindungszeichenfolgen und
  Schlüssel prüfen.

### Zusätzliches Review

Diese Aufgabe berührt die Mandantentrennung. Nach der Umsetzung läuft ein unabhängiges Review
mit dieser Frage:

> Kann eine der 17 Laufzeitrollen mehr, als ihr Modul benötigt — direkt, über geerbte Rechte,
> über Standardrechte im Schema oder durch Umgehung von RLS?

### Abschluss

Vier Punkte melden. **Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-004` — Hetzner-Server, Container ausrollen, TLS. Braucht Hetzner-Konto und die Domain.
