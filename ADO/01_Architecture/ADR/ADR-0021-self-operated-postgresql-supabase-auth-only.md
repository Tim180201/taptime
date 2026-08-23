# ADR-0021: Selbstbetriebenes PostgreSQL, Supabase nur für Authentifizierung

- **Status:** Angenommen
- **Datum:** 2026-08-23
- **Entscheidung:** Technical Lead, delegiert vom Product Owner
- **Ersetzt teilweise:** ADR-0008 (Supabase-managed PostgreSQL)
- **Berührt:** ADR-0007, ADR-0018, T-003, T-004

## 1. Kontext

Beim Einspielen des Schemas auf Supabase sind in einer einzigen Aufgabe **sechs
Berechtigungshürden** aufgetreten, alle aus derselben Ursache: Das Schema wurde unter der
Annahme entwickelt und getestet, dass die migrierende Rolle **Superuser** ist. Supabases
`postgres` ist es nicht.

| # | Blockierte Operation |
|---|---|
| 1 | `ALTER ROLE ... NOSUPERUSER` |
| 2 | Änderung bereits verzeichneter Migrationen (Prüfsummen) |
| 3 | Test hielt am alten Normalisierungsverhalten fest |
| 4 | `ALTER ... OWNER TO` ohne `SET`-Mitgliedschaft |
| 5 | `normalize_role_graph` entzieht dem Installer genau diese Mitgliedschaft |
| 6 | Eigentümerpflichtige Folgeoperationen wie `REVOKE ALL ON ALL FUNCTIONS` |

Die Fehlerrate nahm nicht ab. Jede Lösung legte die nächste Hürde frei. Das Schema umfasst
rund 4.000 Zeilen sicherheitskritisches SQL mit 51 Eigentümerwechseln, 16 Funktionsowner-Rollen
und RLS auf 29 Tabellen.

**Entscheidender Befund:** Das Schema ist **vollständig anbieterunabhängig**. `identity_bindings`
speichert ausschließlich `issuer` und `subject` — generische JWT-Identität. Es gibt keine
Referenz auf Supabases `auth`-Schema, kein `auth.uid()`, keine Supabase-Erweiterung. Die
Abstraktion aus ADR-0008 hat gehalten.

## 2. Entscheidung

**Die Produktdatenbank läuft als PostgreSQL-Container auf dem eigenen Hetzner-Server in
Deutschland. Supabase bleibt ausschließlich Authentifizierungsanbieter.**

- Das Schema `taptime_server` und alle Produktdaten liegen auf dem eigenen Server.
- Die Migrationen laufen dort als Superuser — **identisch zu lokal und CI**.
- Supabase gibt weiterhin JWTs aus. Das Backend prüft sie gegen `SUPABASE_ISSUER`.
  Mobile-App und Admin-Web behalten ihre Anmeldung unverändert.
- Der Supabase-Free-Tarif genügt dafür. Kein Pro-Tarif nötig.

## 3. Begründung

**Der Fehlerklasse wird die Grundlage entzogen.** Als Superuser verhält sich die Migration in
Produktion exakt wie in CI. Weitere Hürden dieser Art sind nicht möglich, nicht bloß
unwahrscheinlich.

**Kein Auseinanderlaufen von Test und Produktion.** Der bisherige Weg hätte bedeutet, dauerhaft
zwei Rechtemodelle zu bedienen — jede künftige Migration hätte beide erfüllen müssen. Das ist
eine dauerhafte Steuer und eine dauerhafte Fehlerquelle.

**Keine Kompromisse an der Sicherheit.** Alle bisherigen Lösungen waren sauber, aber Hürde 5 und 6
verlangten Eingriffe in die Rollengraph-Normalisierung — also in genau den Code, der die
Mandantentrennung absichert. Diesen Code aus Umgebungsgründen umzubauen ist das schlechteste
aller Motive.

**Datenschutz wird besser.** Personenbezogene Produktdaten — Namen, Arbeitszeiten,
Zuordnungen — liegen dann auf einem deutschen Server bei einem deutschen Anbieter. Bei Supabase
verbleiben nur Anmeldedaten. Das verkleinert den Umfang der Auftragsverarbeitung durch einen
US-Anbieter erheblich.

**Es ist günstiger.** Rund 8 € statt 32 € im Monat, weil der Supabase-Pro-Tarif entfällt.

## 4. Konsequenzen

**Wir übernehmen den Datenbankbetrieb:** Sicherung, Wiederherstellung, Aktualisierungen,
Überwachung, Plattenplatz.

Das war teilweise ohnehin vorgesehen — ein **getesteter Restore** stand bereits als eigene
Aufgabe im Plan, weil kein B2B-Käufer eine Zeiterfassung ohne belastbare Sicherung akzeptiert.

**Bekannte Einschränkung:** Datenbank und Anwendung laufen zunächst auf demselben Server. Fällt
er aus, fällt beides aus. Für Eigentest und Pilot ist das vertretbar. **Vor dem ersten zahlenden
Kunden ist zu entscheiden**, ob die Datenbank einen eigenen Server bekommt.

## 5. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Datenverlust bei Serverausfall | Tägliche Sicherung an einen zweiten Ort **plus mindestens einmal nachgewiesene Wiederherstellung** |
| Sicherheitslücken durch fehlende Updates | Automatische Sicherheitsaktualisierungen, festgelegte PostgreSQL-Hauptversion, geplantes Aktualisierungsfenster |
| Ausfall unbemerkt | Healthcheck-Überwachung mit Benachrichtigung |
| Betriebslast beim Product Owner | Betrieb liegt bei Technical Lead und Development, nicht beim Product Owner |

## 6. Was bestehen bleibt

ADR-0008 gilt unverändert für **Mandantentrennung über RLS**, das **Rollenmodell mit minimalen
Rechten** und die **asynchrone Repository-Grenze**. Ersetzt wird ausschließlich die Aussage, dass
PostgreSQL von Supabase verwaltet wird.

Die Verbesserungen aus T-003b bleiben erhalten: Die Migrationen prüfen jetzt ausdrücklich, dass
keine Rolle Superuser ist, statt es stillschweigend zu erzwingen. Das ist unabhängig vom
Betreiber die bessere Lösung.

## 7. Revisionspunkt

Diese Entscheidung wird erneut geprüft, **wenn der Betriebsaufwand nachweislich Entwicklungszeit
verdrängt** oder wenn ein Kunde Verfügbarkeitszusagen verlangt, die ein einzelner Server nicht
tragen kann.
