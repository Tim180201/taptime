# Aktuelle Aufgabe

> **Stand 07.10.2026:** Produktion `7cd4233` (Deploy 06.10., Migrationen bis 051). Geräteabnahme läuft (iPhone bis auf die
> Scan-Teile bestanden). T-109 geht in den nächsten Deploy. Befund SE-002: `.audit-ux-2026-10/selbsterklaerend.md`, nur
> lokal (D-103).

## T-109 · Weg zur App (D-129), noch ohne Store-Einreichung

**Für:** Development · **Risiko:** mittel (öffentliche Route an der Startseiten-Domain, Caddy, Build-Profil) ·
**Zeitbox:** eine Sitzung. Startseite, Caddy, Verwaltung (Willkommen), App, EAS-Konfiguration, `docs/`.

### Auftrag

1. **Öffentliche Seite `/app`** auf `tb-infra.de`, ohne Passwort wie `/tag`, mit derselben strengen CSP und ohne
   Tracking. Erkennt iPhone/iPad bzw. Android und leitet zum hinterlegten Ziel weiter; sonst zwei Knöpfe „App Store“ und
   „Google Play“. Die Ziele stehen in einer versionierten Datei der Startseite (vorerst TestFlight-Link und Link zum
   geschlossenen Google-Play-Test; der PO liefert die Werte). Ist ein Ziel leer, keine Weiterleitung, sondern „Die App
   erhalten Sie von Ihrer Verwaltung.“. `/tag` und `assetlinks.json` bleiben unverändert.
2. **Willkommen und neues Passwort (SE-002):** Nach Erfolg „Ihr Passwort ist eingerichtet. Laden Sie jetzt die App und
   melden Sie sich dort mit Ihrer E-Mail-Adresse und diesem Passwort an.“ mit Knopf „App laden“ → `/app`. Abgelaufene
   erste Administratoreinladung: „Bitten Sie die Person, die Ihren Betrieb eingerichtet hat, um einen neuen
   Einladungslink.“
3. **Einladungsmail:** In `docs/T-047-Einladungsvorlage.md` ein zweiter Link „App laden“ → `/app` unter „Passwort
   setzen“; der PO überträgt die Vorlage nach dem Deploy.
4. **App:** „Bitte App aktualisieren“ bekommt den Knopf „App aktualisieren“ → `/app`.
5. **App-Name an einer Stelle:** Der sichtbare Name („Taptura“, Arbeitsname) kommt in App-Konfiguration, Web-Titeln,
   Startseite und Store-Unterlagen aus genau einer Quelle je Build; eine Prüfung findet abweichende Schreibweisen.
   Paketnamen und Bundle-IDs bleiben.
6. **Store-Build-Profil `store`** in `eas.json`: iOS Store-Verteilung, Android App Bundle, dieselben öffentlichen
   Produktionswerte wie `production-validation`, automatische Build-Nummer. Keine Schlüssel oder Konten im Repository.
7. **Store-Unterlagen als Entwurf** in `docs/store/`: Kurz- und Langbeschreibung (Deutsch), Kategorie, Altersfreigabe,
   Hinweise für die Prüfer (Zugang nur per Einladung; Demo-Zugang legt der PO an), Screenshot-Liste und die
   Datenschutzangaben für Apple und Google, aus dem tatsächlichen Code abgeleitet (welche Daten, wofür, ob mit der
   Person verknüpft, keine Werbung, kein Tracking). Kennzeichnung „Entwurf, rechtliche Prüfung mit B15“.

### Tests

Je Punkt rot vor der Änderung. `/app`: Weiterleitung für iOS- und Android-Kennungen, Knöpfe für Desktop, leeres Ziel ohne
Weiterleitung, öffentlich ohne Passwort, CSP und `noindex` wie `/tag`, keine offene Weiterleitung auf fremde Ziele
außerhalb der Datei. Willkommen und Aktualisieren mit Link. Namensprüfung. `eas.json`-Profil gültig. Caddy-, Startseiten-
und Verwaltungs-Suiten, Begriffsprüfung (T-108), Typechecks, Layout bei 360/390 dp und 1440 px.

### Nicht Teil

Store-Einreichung, Konten, Zahlungen, Festlegung des App-Namens, Play-App-Signatur in `assetlinks.json` (folgt mit dem
Play-Konto), Supabase-Einstellungen.

### Bericht

`.t109-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2.
Kein Commit vor `APPROVED`.
