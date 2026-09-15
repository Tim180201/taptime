# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-034 · Beweisbarer Betrieb

**Für:** Codex · **Risiko:** eine nicht startfähige Verwaltung oder unvollständig geschützte
Wiederherstellung wird fälschlich akzeptiert · **Zeitbox:** eine Arbeitssitzung · **Grundlage:**
B01, B04, D-038

### Ziel

Ein Admin-Web-Abbild ist nur baubar und auslieferbar, wenn es die öffentliche
Supabase-Konfiguration trägt und die Anwendung damit starten kann. Die Wiederherstellungsprüfung
belegt für jede vorhandene Anwendungstabelle im Schema `taptime_server`, dass RLS eingeschaltet
und erzwungen ist.

### B01 · Konfiguration und Startnachweis

- `infrastructure/admin-web/Dockerfile` übernimmt
  `VITE_TAPTIME_SUPABASE_URL` und `VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY` als Bauargumente und
  Umgebung. Ein fehlender oder leerer Wert bricht den Bau ab.
- `.github/workflows/container-image.yml` reicht beide Werte nach bestehender
  Repository-Konvention durch, nie aus einer `.env`-Datei im Build-Kontext.
- Die Auslieferungsprüfung weist Startfähigkeit statt nur `version.txt` nach. Der Bericht nennt
  Weg und Begründung.
- Gegenbeweis: Ein Abbild ohne Konfiguration wird gebaut und muss an Bau oder Auslieferungstor
  nachweislich scheitern.

### B04 · RLS-Bedingung

- `infrastructure/backup/taptime-restore-verify` prüft ohne feste Tabellenzahl jede vorhandene
  Anwendungstabelle auf `ENABLE` und `FORCE` RLS und nennt bei Fehlern die Tabellen.
- Gegenbeweis: Eine Tabelle ohne RLS im Prüfbestand lässt die Prüfung fehlschlagen.

### Grenzen

- Service-Role-Schlüssel und andere Geheimnisse weder lesen noch anfassen, durchreichen oder
  ausgeben. Öffentliche Werte erscheinen ebenfalls nicht in Ausgaben, Logs oder Berichten.
- Migrations-Rückwärtsfrage sowie B02, B03, B05 und B06 nicht anfassen.
- Umsetzung nicht committen. Der ausdrücklich beauftragte Dokumentations-Commit erfolgt vorher.

### Bericht

Vier Punkte gemäß `AGENTS.md`, darin: gewählter Startnachweis mit Begründung, beide
Gegenbeweise, Typecheck, Tests und Hash des Dokumentations-Commits.
