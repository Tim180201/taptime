# T-068 · Betreiber-Bereich — technischer Entwurf

**Stand:** 22.09.2026 · **Autor:** Claude (TL) · **Grundlage:** D-049, D-068, D-074, D-075
**Oberfläche:** `betreiber-bereich-entwurf.html` in diesem Ordner (vom PO am 21.09. abgenommen).

Der Entwurf ist am Quelltext geprüft (Stand `47963a2`). Er beschreibt, *was* gebaut wird und
welche Grenzen gelten. Wie genau, entscheidet Development; weicht der Code von einer Annahme ab,
wird gestoppt und gemeldet, nicht umgangen.

---

## 1. Befund (Quelltext)

| Thema | Heute | Folge |
|---|---|---|
| Betrieb anlegen | Nur `bootstrap_first_organization` (006) über die CLI `apps/backend-bootstrap`; in keinem Produktionsabbild. Setzt ein bestehendes Supabase-Konto des ersten Admins voraus. | Neuer Weg mit Einladung wie T-047. |
| Einladen | `employee_account_invitation_v1` (026) legt fest `role='employee'` an; `SupabaseAccountInviter` ist die einzige Stelle mit dem service-role-Schlüssel (D-049). | Inviter wiederverwenden, eigene SQL-Funktion für den ersten Administrator. |
| Plattform-Rolle | Gibt es nicht. Jede Anmeldung braucht genau eine aktive Mitgliedschaft (`memberships_one_active_per_user`). | Neue Tabelle für Betreiber, außerhalb jedes Betriebs. |
| Zweiter Faktor | `SupabaseJwtAccessTokenVerifier` akzeptiert `aal1` und `aal2`, gibt aber nur `{issuer, subject}` weiter. | `aal` durchreichen; Betreiber-Routen verlangen `aal2`. |
| Pausieren | `organizations` hat keinen Status. Jeder Mandanten-Request läuft über `resolve_request_actor` (004) bzw. `lock_request_actor` (005); beide verbinden `organizations` nicht. | Status-Spalte, Prüfung an dieser einen Engstelle. |
| Protokoll | `audit_events.organization_id` ist `NOT NULL`. | Eigenes append-only Betreiber-Protokoll. |
| Mandantenübergreifend lesen | Alle Tabellen FORCE RLS über `app.organization_id`. | Nur über SECURITY-DEFINER-Funktionen, die ausschließlich Zahlen liefern. |
| Web | Admin-Web: eigenes Abbild, `/opt/taptime/admin-web`, Caddy-Block `admin.tb-infra.de`, Deploy-Prüfung des Bündels. | Zweites Web nach demselben Muster. |

## 2. Zuschnitt

- **Eigene Adresse:** `betreiber.tb-infra.de` (DNS-A-Eintrag auf den Produktionsserver, setzt der PO).
- **Eigene App:** `apps/operator-web` (Vite/React wie Admin-Web, gleiche UI-Leitlinien), eigenes
  Abbild `…:operator-web-<sha>`, eigenes Verzeichnis `/opt/taptime/operator-web`.
- **Eigene Routen:** `/v1/operator/*` im bestehenden Backend. Der Caddy-Block `betreiber.`
  leitet **nur** `/v1/operator/*` weiter; `admin.` und `api.` leiten `/v1/operator/*` **nicht**
  weiter (404). Eigene Schutzklasse `operator_api`, 30 Anfragen je Minute.
- **Eigene Datenbank-Fähigkeit:** NOLOGIN-Rolle `taptime_platform_operator`, erreichbar nach
  dem bestehenden Muster „eine Fähigkeit, eine Verbindung". Braucht das eine neue Zugangsangabe
  in `/opt/taptime/.env`, wird sie auf dem Server erzeugt, nie angezeigt, und der PO bestätigt
  die Verwahrung (Muster T-035). Development meldet vor der Umsetzung, ob das nötig ist.

## 3. Identität und zweiter Faktor (D-074)

1. **Betreiber-Konto:** ein eigenes Supabase-Konto (eigene E-Mail, nicht Tims Kundenkonto).
   Ein Betreiber hat **keine** Mitgliedschaft in einem Betrieb; beides schließt sich in der
   Datenbank gegenseitig aus (Prüfung in beiden Richtungen).
2. **Tabelle** `platform_operators(id, issuer, subject, created_at, revoked_at)` plus
   `platform_audit_events` (append-only, Trigger gegen UPDATE/DELETE, FORCE RLS).
3. **Freischalten** nur als root auf dem Server: Skript `taptime-operator-grant <supabase-uid>`
   (mit den Betriebsdateien installiert, liest den Aussteller aus der Umgebung, schreibt ein
   Protokoll-Ereignis mit `operator_principal=root@host`). Entziehen analog `--revoke`.
   Kein HTTP-Weg zum Anlegen von Betreibern.
4. **Zweiter Faktor:** TOTP über Supabase MFA. Der Verifier reicht `aal` durch. Jede Route unter
   `/v1/operator/*` außer `/v1/operator/session` verlangt `aal2` **und** ein aktives
   Betreiber-Konto. `/v1/operator/session` antwortet bei `aal1` mit `mfa_required` (die App
   führt dann durch Einrichtung bzw. Abfrage des Codes), sonst mit dem Betreiberstatus.
5. **Sitzung:** kein eigener Token-Speicher über das Supabase-SDK hinaus; `sessionStorage` statt
   `localStorage`; Abmelden nach 30 min ohne Aktivität.

## 4. Fähigkeiten

Alle als SECURITY-DEFINER-Funktionen, `EXECUTE` nur für `taptime_platform_operator`; jede prüft
`current_setting('role')`, ein aktives Betreiber-Konto (`app.operator_id`, gesetzt nach Auflösung
von issuer/subject) und schreibt ein Protokoll-Ereignis. Idempotent über `commandId`.

| Route | Funktion | Inhalt |
|---|---|---|
| `GET /v1/operator/session` | `read_operator_session_v1` | Betreiber ja/nein, `aal` |
| `POST /v1/operator/overview` | `read_operator_overview_v1` | je Betrieb: Name, Status, angelegt am, aktive Mitglieder je Rolle (Anzahl), jetzt aktiv (Anzahl `status='started'`), letzter Tap (`max(received_at)`), Tags, aktive Zuordnungen, offene Einladungen; Summen über alle |
| `POST /v1/operator/organizations/create` | `operator_create_organization_v1` | zweiphasig wie 026: vorbereiten → Einladung (bestehender `SupabaseAccountInviter`, gleiche Weiterleitung `/willkommen`) → abschließen: Betrieb, Benutzer, Bindung, Mitgliedschaft `administrator` |
| `POST /v1/operator/organizations/status` | `operator_set_organization_status_v1` | `active` ↔ `paused`, Grund 1–500 Zeichen Pflicht, erwartete `row_version` |
| `POST /v1/operator/audit` | `read_platform_audit_v1` | letzte Ereignisse, seitenweise |
| `POST /v1/operator/health` | `read_operator_health_v1` | Version, Datenbankgröße, letzter archivierter WAL-Zeitpunkt und letzte verifizierte Basis (Tabellen aus 023) |

**Grenze „über, nicht hinein" (D-068):** Keine Funktion gibt Namen, E-Mails, `display_name`,
Personen-IDs oder einzelne Zeiten aus. Nur Zählungen und je Betrieb *ein* Zeitpunkt (letzter
Tap). Ein Test prüft die Spaltenliste jeder Betreiber-Funktion gegen eine Erlaubnisliste.
Die E-Mail des ersten Administrators wird nur zum Einladen benutzt; gespeichert wird wie in
026 nur ihr Hash.

**Einladung des ersten Administrators:** Hat die E-Mail schon ein Konto mit Mitgliedschaft
oder ist sie ein Betreiber → `identity_unavailable`, nichts angelegt. Der service-role-Schlüssel
bleibt in genau einer Klasse; jede Benutzung wird wie heute protokolliert (D-049 gilt, es ist
weiterhin „Einladen").

## 5. Pausieren (D-075)

- Spalten `organizations.status ('active'|'paused')`, `paused_at`, `pause_reason`.
- `resolve_request_actor` und `lock_request_actor` werden in einer neuen Migration ersetzt
  (001–030 bleiben unverändert) und liefern für einen pausierten Betrieb einen eigenen Status
  `organization_paused` statt eines Treffers. Das Backend antwortet `403 organization_paused`.
- App und Admin-Web zeigen dann: „Ihr Betrieb ist pausiert. Bitte wenden Sie sich an Taptura."
  Keine anderen Aktionen.
- **Nichts wird gelöscht.** Offline-Taps bleiben in der Warteschlange des Geräts (T-052 löscht erst
  nach Archivnachweis) und werden nach dem Fortsetzen normal abgeglichen.
- Fortsetzen stellt alles unverändert wieder her. Beides im Betreiber-Protokoll.

## 6. Oberfläche (Entwurf vom 21.09.)

Anmelden (E-Mail, Passwort) → Code aus der Authenticator-App (beim ersten Mal: QR-Code
einrichten) → Übersicht mit Kacheln (Betriebe, Mitarbeiter gesamt, jetzt aktiv, Taps heute),
Tabelle der Betriebe (Status, Zahlen, letzter Tap), Seitenpanel „Betrieb anlegen" (Name, E-Mail
des ersten Administrators), Aktion „Pausieren / Fortsetzen" mit Grund und Bestätigung,
Reiter Protokoll und Betriebszustand. Deutsch, Europe/Berlin, axe ohne Verstöße.

## 7. Auslieferung

- CI baut `operator-web` wie `admin-web` (Supabase-URL und öffentlicher Schlüssel aus derselben
  Quelle); Image-Workflow veröffentlicht `…:operator-web-<sha>`.
- `infrastructure/deploy`: vorbereiten, aktivieren und prüfen wie Admin-Web
  (`/opt/taptime/operator-web`, `https://betreiber.tb-infra.de/version.txt`, Bündelprüfung).
- Caddy: neuer Block mit strikter CSP (wie Admin-Web), HSTS, `X-Frame-Options DENY`.
- Vor dem Deploy: DNS-Eintrag durch den PO; Caddy holt das Zertifikat selbst.
- Nach dem Deploy (PO, root): Betreiber-Konto in Supabase anlegen, einmal
  `taptime-operator-grant <uid>`, in `betreiber.tb-infra.de` anmelden, TOTP einrichten.

## 8. Aufteilung

- **T-068a · Server:** Migration (Betreiber, Protokoll, Status, neue Resolver, Funktionen),
  Verifier mit `aal`, Routen und Schutzklasse, Pausenantwort in App und Admin-Web,
  `taptime-operator-grant`. Rotnachweise: Mandant liest nie über Betreiber-Funktionen; Betreiber
  ohne `aal2` abgewiesen; Betreiber mit Mitgliedschaft unmöglich; pausierter Betrieb überall
  `organization_paused`, nach Fortsetzen alles wie vorher; Erlaubnisliste der Spalten.
- **T-068b · Web und Auslieferung:** `apps/operator-web`, CI/Image, Caddy, Deploy-Controller,
  Anleitung für DNS und Freischalten.
