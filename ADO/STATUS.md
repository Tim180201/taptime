# TapTim.e — Status

**Stand 11.11.2026.** Höchstens eine Seite, überschreiben statt anhängen (AGENTS 6). Frühere Fassung mit allen
Befunden und Deploys: `git show b50e85a:ADO/STATUS.md`.

## Jetzt

- **Produktion:** `05bcf51` seit dem gemeinsamen Deploy am 29.10. (Migrationen bis 068). Seither nur App-Änderungen,
  also kein Deploy nötig.
- **Sicherung:** Aufräumen täglich `ok` (09.11.: 53 Basen, 2 Marker). WAL wächst weiter bis zur ältesten
  aufbewahrten Basis, das ist gewollt. Die Wochenprobe ist grün, seit dem 01.11. kommt keine Morgenmeldung mehr.
  Am 09.11. um 13:48 UTC kam ein Fehlalarm „WAL-Segment wartet seit 2 min“ ohne Datenverlust; der Status war danach
  wieder `ok` (T-144).
- **Apps:** iPhone aus `62266b4` (Build 14, iOS 26.5), Android aus `5ba70b8`. Geräteprüfung PO 10.11. bestanden:
  - Initialen auf dem Sperrbildschirm;
  - iPhone-Knöpfe wirken nach Face ID, auch bei geschlossener App (D-161);
  - „Meine Zeiten“ am iPhone sofort, am Android 0,85–1,5 s.

  Lokales Schema 8: keine ältere App darüber installieren.
- **Aufgabe:** T-144 auf main (`ed7e964`); die Messung vorher und nachher macht der PO. Der Entwurf zu T-055 ist
  abgenommen, entschieden ist D-162 (prüfen statt neu entscheiden). T-055a ist auf main (Wiederaufnahmevorgang,
  Migration 069). T-055b ist auf main (Wiederaufnahme-Eingang, Migration 070). Jetzt T-055c (Prüfung im Web), der Brief folgt vom TL.
  T-144 und T-055 gehen zusammen in einen Deploy, mit neuem App-Build (PO 11.11.).

## Weg zum Pilot

T-055c → T-055d → App-Build und ein Deploy mit T-144 → T-146 (Abnahme-IDs an Tests) und restliche
Geräteabnahme → Pilot (D-152).

**Vor echten Daten (D-116):**
- Gewerbeanmeldung, danach Supabase Pro (D-130) und D-U-N-S;
- AVV und Haftpflicht;
- beide Apps in den Stores (D-129).

Fertig ist das Produkt, wenn das ausgelieferte, wiederherstellbare System einen vollständigen Monatsabschluss übersteht.

**Termin mit frogs** (CEO und Entwickler, Ende November): Mit den Antworten folgen T-123b (Lohnprogramm, D-157) und
T-124 (Business Central). Die Fragen stehen im PLAN.

## Beim PO

- AVV mit Hetzner und Brevo, Drittlandfrage (D-006), Anschrift und Kontakt für die Rechtstexte (T-134).
- **Einladungsvorlage:** `docs/T-047-Einladungsvorlage.md` vollständig in Supabase übertragen und `https://tb-infra.de/app`
  prüfen.
- **Store-Links:** TestFlight- und Play-Test-Link liefern; Development trägt sie in `apps/landing-web/src/appLinks.json`
  ein.
- **Nach Supabase Pro:** Schutz vor geleakten Passwörtern einschalten (D-130, DEPLOY.md).

## Restliche Geräteabnahme (PO)

- je 20 Einrichtungen am iPhone und am Android;
- Einladung eines zweiten Kontos bis „App laden“;
- VoiceOver und TalkBack einmal, große Schrift;
- T-115: über Nacht am Ladekabel und zehnmal nach langer Sperre;
- Android ohne Antippen: offene App, Hintergrund, beendete App, zwei Karten nacheinander, morgens als Erstes.

Einzelheiten zu früheren Abnahmen in der früheren Fassung (Link oben).

## Beobachten

- GHCR-Aufräumen brach am 14.10. einmal mit `unexpected end of JSON input` ab. Kein manuelles Löschen, kein Neustart.
- Fehlt zu einem laufenden Eintrag die Zusatzprojektion (043), scheitert das Lesen der eigenen Zeiten (T-103). Bei
  wiederhergestellten Einträgen prüfen.
- Android 16 hebt laufende Benachrichtigungen als „Live Update“ hervor. Android 17 meldet Tags mit Web-Adresse (D-037).
  Am ersten solchen Gerät prüfen.
- Android: Bleibt eine Karte nach dem Lesemodus am Handy liegen, könnte Android sie erneut an die App geben (T-112). In
  der Android-Abnahme prüfen.

## Weitere Dateien

- Bekannte Kleinigkeiten (P2/P3): `ADO/BEKANNTE_KLEINIGKEITEN.md`.
- Fakten für den Betrieb (Orte, Mac, Supabase, frogs, Android-Varianten, Konsole): `ADO/04_Operations/Betriebsfakten.md`.
