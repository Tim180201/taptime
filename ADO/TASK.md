# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-005 · API im Netz — Container, Reverse Proxy, TLS

**Für:** Codex · **Risiko:** öffentlich erreichbarer Dienst → **unabhängiges Review verpflichtend**
**Zeitbox:** eine Arbeitssitzung · **Grundlage:** T-004 abgeschlossen (`93fd143`)

### Ziel

`https://api.tb-infra.de/health` antwortet aus dem Internet mit `200 {"status":"ok"}` —
über ein gültiges Zertifikat, und der Dienst übersteht einen Neustart des Servers.

### Schritte

**1. API-Container ausrollen**

- `backend-api` mit dem Dockerfile aus T-002 auf dem Server bauen und starten
- Erreicht PostgreSQL **ausschließlich über das interne Netz** — kein Umweg über die
  öffentliche Adresse
- Liest die 17 Verbindungszeichenfolgen und `SUPABASE_ISSUER` aus der `.env` vom Server
- **Läuft als nicht-privilegierter Benutzer**, nicht als root

**2. Caddy als Reverse Proxy**

- Holt und erneuert das Zertifikat für `api.tb-infra.de` automatisch über Let's Encrypt
- Leitet `http://` dauerhaft auf `https://` um
- Gibt **keine Versionsangaben** preis — weder Caddy noch Node in den Antwort-Headern
- Reicht ausschließlich an den API-Container weiter; **PostgreSQL ist nicht über den Proxy
  erreichbar**

**3. Neustartfestigkeit**

- Alle Container starten nach einem Serverneustart **von selbst** wieder
- **Weise das nach:** Server wirklich neu starten, dann prüfen, dass `/health` ohne
  Handgriff wieder antwortet. Nicht die Konfiguration lesen — den Neustart durchführen.

**4. Protokollhygiene**

- Prüfe die Protokolle von Caddy und API auf Zugangsdaten, Verbindungszeichenfolgen,
  Token oder E-Mail-Adressen. **Nichts davon darf dort auftauchen.**

### Vision-Check

Keine fachliche Logik, keine Migration, keine Nutzerinteraktion. Reiner Betrieb.

### Nicht anfassen

- `apps/backend-schema/migrations/` und jede Geschäftslogik
- `packages/core`, `apps/mobile`, `apps/synthetic-android-e2e`
- Der Healthcheck selbst — der ist aus T-002 fertig und geprüft

### Prüfung — alles nachweisen, nichts behaupten

- `https://api.tb-infra.de/health` → `200` und **exakt** `{"status":"ok"}`
- Zertifikat gültig, korrekte Kette, richtiger Name
- `http://api.tb-infra.de/health` leitet auf `https://` um
- **Von außen weiterhin nur 22, 80 und 443 offen.** Voller Portscan, wie in T-004.
- PostgreSQL von außen **nicht** erreichbar
- Ein beliebiger anderer Endpunkt ohne Anmeldung → `401`, nicht `200`
- Antwort-Header enthalten keine Versionsangaben
- Nach echtem Serverneustart antwortet `/health` wieder ohne Eingriff
- Keine Geheimnisse in Protokollen oder im Diff
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Ist über `api.tb-infra.de` irgendetwas erreichbar, das nicht erreichbar sein soll?
> Verrät eine Antwort — Header, Fehlermeldung, Zeitverhalten — mehr als nötig?

### Abschluss

Vier Punkte melden. **Entfernte oder umgeschriebene Tests einzeln benennen, mit Begründung** —
nie als Sammelposten. **Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-006` Admin-Web ausliefern · `T-007` Backup und **getesteter Restore** · `T-008` Pausen ·
`T-009` Standorte · `T-010` Oberflächen · `T-011` installierbare App.
