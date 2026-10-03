# Aktuelle Aufgabe

> **Stand 03.10.2026:** Produktion auf `0230188` (Migrationen bis 039). T-093 auf `main` (`19a363d`). Vor dem Pilot: T-091, T-092,
> T-094 bis T-098, T-100 bis T-102 → zweiter Deploy → T-024 → Pilot. Frühere Briefs stehen in der Git-Historie.

## T-094 · Einladung und Passwort (D-110)

**Für:** Development · **Risiko:** Zugang zum Konto, Identität (D-048, D-049, D-057) · **Zeitbox:** zwei Sitzungen.
Analyse-Befunde F-001, F-011, F-027, F-078, F-079, F-092, F-114. Kein Deploy, kein Serverzugriff, keine Geheimnisse;
der service-role-Schlüssel bleibt ausschließlich in `/opt/taptime/.env` (D-049) und wird von keinem Test benötigt.

### Befund

1. `SupabaseAccountInviter.findAccount` übernimmt jedes vorhandene, lokal ungebundene Supabase-Konto mit derselben
   Adresse, unabhängig davon, wie es entstanden ist.
2. Mobile und Betreiber-Web sagen bei `succeeded_existing_account` nicht, dass keine Mail verschickt wurde (das
   Admin-Web schon).
3. Die Adresse wird ohne Unicode-Normalisierung verglichen und gesperrt; Diagnosen enthalten einen aus der Adresse
   abgeleiteten Wert; „Adresse gehört zu einem anderen Betrieb“ wird anders gemeldet als andere Fälle, in denen die
   Adresse nicht aufgenommen werden kann.
4. Es gibt keinen Weg, eine abgelaufene Einladung erneut zu senden: Erneutes Einladen meldet „bereits Mitglied“ ohne
   Mail. Bei `invitation_needs_attention` bietet das Web keinen nächsten Schritt.
5. „Passwort vergessen“ in der App fordert den Reset mit dem festen Ziel `taptime://auth/recovery` an
   (`MobileSessionCoordinator.requestPasswordReset`). Die installierte Variante `production-validation` registriert das
   Schema `taptime-production-validation`; der Link endet in Safari mit „Adresse ungültig“ (Geräteabnahme 02.10.).
   Die App verwirft beim Öffnen eines Wiederherstellungslinks die bestehende Sitzung vor jeder Prüfung.
6. Ob in Supabase die Selbstregistrierung aus und die E-Mail-Bestätigung an ist, prüft heute nichts im System
   (PO hat beides am 28.09. eingestellt).

### Auftrag

**A. Vorhandene Konten.** Ein lokal ungebundenes Supabase-Konto wird nur übernommen, wenn es aus einer Einladung
stammt (`invited_at` gesetzt). Jedes andere vorhandene Konto wird nicht übernommen, sondern als Klärungsfall gemeldet;
nichts wird automatisch gelöscht oder umgebunden. Gilt für Administrator-, Standortleitungs- und Betreiberweg. Im
Bericht mit Supabase-Dokumentation belegen, welche Felder die Admin-API liefert.

**B. Einheitlich und sparsam.** Adresse vor dem Kleinschreiben nach NFC normalisieren (beide Wege, Sperr-Hash
eingeschlossen). In Diagnosen keinen aus der Adresse abgeleiteten Wert mehr, nur Korrelations-ID und, sobald bekannt,
die Supabase-Konto-ID. Nach außen eine gemeinsame Rückmeldung für „Adresse kann nicht aufgenommen werden“; die
Unterscheidung bleibt im Serverprotokoll. Mobile und Betreiber-Web zeigen bei vorhandenem Konto denselben Hinweis wie
das Admin-Web (keine Mail verschickt, Person selbst informieren).

**C. Einladung erneut senden.** Für eine Mitgliedschaft im eigenen Verwaltungsbereich (Administrator alle,
Standortleitung ihr Standort), deren Konto die Einladung nie angenommen hat (Supabase: Adresse unbestätigt, nie
angemeldet), gibt es in App und Web „Einladung erneut senden“. Der Server liest das Konto über die gespeicherte
Konto-ID, sendet die Einladung über denselben Supabase-Weg erneut, begrenzt je Mitgliedschaft (höchstens einmal je
10 min) und schreibt ein Audit-Ereignis. Hat die Person die Einladung schon angenommen: verständliche Antwort
(„bereits angemeldet, ‚Passwort vergessen‘ nutzen“), keine Mail. `invitation_needs_attention` bekommt im Web einen
Knopf „Erneut versuchen“. Woran die Liste „Einladung offen“ erkennt, ohne je Zeile Supabase zu fragen, legst du im
Bericht dar; wenn das lokal nicht sicher geht, steht der Knopf nur in der Personenansicht und der Server entscheidet.

**D. Passwort über die Webseite.** „Passwort vergessen“ in der App fordert dieselbe Wiederherstellung an wie das
Admin-Web (gleiches Ziel, gleiche Seite). Die App sagt danach: „Wir haben dir eine E-Mail geschickt. Öffne den Link,
setze dein neues Passwort und melde dich dann hier an.“ Die App wertet keine Wiederherstellungslinks mehr aus; der
Deep-Link-Pfad und seine Sitzungsverwerfung entfallen. Die Web-Seite „Neues Passwort setzen“ funktioniert für alle
Rollen und bei 360 px Breite und sagt nach Erfolg, dass man sich jetzt auch in der App anmelden kann.

**E. Einstellungen prüfen.** Beim Start und vor jeder Einladung liest der Server die öffentlichen Supabase-Einstellungen
(`/auth/v1/settings`, nur mit dem öffentlichen Schlüssel). Ist die Selbstregistrierung an oder die E-Mail-Bestätigung
aus, bleiben Einladungen und erneutes Senden gesperrt (`account_creation_not_configured`) mit eigener Diagnose; alles
andere läuft weiter. `docs/T-047-Inbetriebnahme.md` und `DEPLOY.md`: Registrierung aus, Bestätigung an, Linkdauer
(„Email OTP Expiration“) 86400 s, Site URL und Redirect-Liste, wer sie anlegt, ändert und entfernt.

### Tests

Supabase-Fake mit echten Antwortformen der Admin-API (Felder aus der Dokumentation). Rot vor Grün: (1) ungebundenes
Konto ohne `invited_at` → Klärungsfall, keine Übernahme; mit `invited_at` → Übernahme wie heute; (2) Adresse in NFC
und NFD → gleicher Sperr-Hash; (3) Diagnosen enthalten keinen adressabgeleiteten Wert; (4) erneut senden: offen → Mail,
angenommen → keine Mail mit Hinweis, fremder Bereich → `forbidden`, zweimal in 10 min → begrenzt, Audit vorhanden;
(5) App fordert den Reset ohne App-Schema an, kein Deep-Link-Handler mehr; (6) Web-Wiederherstellung bei 360 px für
Mitarbeiter, Standortleitung, Administrator; (7) Einstellungen falsch → Einladen gesperrt, Rest läuft. Alle Suiten, die
die geänderten Pfade berühren oder Migrationen einspielen (inkl. `backend-schema`, `backend-time-review` mit T-062-Probe,
`backend-administration`, `backend-api`, `admin-web` mit Browser-Layout, `operator-web`, `mobile` Typecheck, Tests und
`expo export` für Android und iOS).

### Nicht Teil

Kein Deploy, kein Serverzugriff, keine Änderung an Supabase-Einstellungen (macht der PO), keine neue Rolle, kein
Löschen von Supabase-Konten. Keine Änderung am Anmeldeweg selbst.

### Bericht

`.t094-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review mit Blick auf „niemand bekommt ein Konto,
das ihm nicht gehört“. Kein Commit vor `APPROVED`.
