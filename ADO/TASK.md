# Aktuelle Aufgabe

> **Stand 14.10.2026:** T-118b abgeschlossen (`41d68dc`), noch nicht ausgeliefert. Jetzt **T-120**, danach Deploy 5 mit
> neuen App-Builds und die Geräteabnahme.

## T-120 · Systemicon „Funk-Zifferblatt“ überall (D-136)

**Für:** Development · **Risiko:** mittel (Startablauf der App nach T-115, neues natives Modul, Caddyfile) · **Zeitbox:**
ein bis zwei Sitzungen; reißt sie, wird nach App und Web getrennt gemeldet. Kein Server, keine Migration, kein Deploy.

### Ausgangslage (`41d68dc`)

- Alle Bilddateien liegen fertig in `shared/brand/` (README dort): `app/` (iOS hell, dunkel, getönt; Android Vordergrund
  und Themensymbol; Startbild; Expo-Favicon), `web/` (SVG, ICO, Apple-Touch), `store/`. Quelle ist `mark.json`.
- App: Expo-Platzhalter in `apps/mobile/assets/`, `adaptiveIcon` auf #E6F4FE mit Hintergrundbild; `expo-splash-screen`
  fehlt; beim Start steht „Sitzung wird sicher wiederhergestellt …“ (`ProductMobileApp.tsx`, `AppNavigator.tsx`).
- Web: „T“ als Zeichen in der Verwaltung, Ringe im Betreiber-Bereich, eigenes Zeichen auf der Startseite; keine Web-App
  hat ein Favicon. Auf der Startseiten-Domain sind ohne Passwort nur `/tag`, `/app`, `/robots.txt`, `/version.txt` und
  deren Assets erreichbar.

### Regeln

1. **App-Symbol:** iOS `icon` als hell, dunkel und getönt; Android adaptiv mit Vordergrund und Themensymbol auf
   #0E1512, ohne Hintergrundbild; `web.favicon`. Alle Pfade zeigen auf `shared/brand/app/`. Kann Expo das nicht, sind
   Kopien erlaubt, und ein Test prüft sie gegen `shared/brand`. Die alten Platzhalter entfallen.
2. **Startbild:** `expo-splash-screen` (passend zu Expo 57) mit `splash-icon.png` auf #0E1512; auf Android 12+ nichts
   abgeschnitten. Das native Startbild bleibt, bis die Sitzung bereit ist oder ein Fehlerzustand aus T-115 erscheint.
   Dauert es länger als etwa 3 s, übernimmt eine Ansicht mit identischer Lage (Zeichen an derselben Stelle, gleicher
   Grund) und zeigt darunter „Wird geladen …“, ohne Sprung. Bedienhilfe „{Name} wird gestartet“, Name aus
   `shared/product.json`. Der Text „Sitzung wird sicher wiederhergestellt …“ entfällt. Fehlerzustände und Codes aus T-115
   bleiben unverändert. Das Startbild steht nie unbegrenzt.
3. **Zeichen in der App:** im Kopf der Anmeldung und von „Erfassen“ neben dem Namen, mit `react-native-svg` aus
   `mark.json`, unter 48 px die kompakte Form. Rein dekorativ für Bedienhilfen; der Name bleibt Text.
4. **Web:** Zeichen statt „T“ (Verwaltung), statt Ringen (Betreiber-Bereich) und auf der Startseite, aus `mark.json`,
   dekorativ (`aria-hidden`). `/app` und `/tag` zeigen das App-Symbol als Kachel über der Überschrift. Favicon (SVG und
   ICO) und Apple-Touch-Symbol in Verwaltung, Betreiber-Bereich und Startseite samt `/app` und `/tag`.
5. **Caddy:** Favicon, Apple-Touch-Symbol und die Bilder für `/app` und `/tag` sind ohne Passwort erreichbar, auch auf
   dem Tag-Host. Alles andere bleibt geschützt. Die Inhaltsrichtlinie (CSP) wird nicht gelockert.
6. **Eine Quelle:** Jedes eingebundene Bild und jeder SVG-Pfad stammt aus `shared/brand` bzw. `mark.json`. Geändert
   wird das Zeichen nur dort (TL, `mark.json`), entfernt nur mit einer neuen Icon-Entscheidung (AGENTS 1.5).

### Tests

Je Punkt rot vor der Änderung:
- Expo-Konfiguration: alle Symbol- und Startbildpfade zeigen auf vorhandene Dateien aus `shared/brand`, Farben
  #0E1512, keine alten Platzhalter mehr.
- Start: Startbild bleibt bis „bereit“; nach 3 s Ansicht mit „Wird geladen …“ (Fake-Timer); jeder T-115-Fehlerzustand
  blendet es aus; Bedienhilfe.
- Zeichen in App und Web: Pfade aus `mark.json`, kompakt unter 48 px, kein „T“ und keine Ringe mehr.
- Favicon-Links in allen Web-Apps; Browser bei 390 und 1440 px und 200 % Schrift ohne Überlauf, axe ohne Befund.
- Caddy: die neuen Bildpfade ohne Passwort erreichbar, alles andere weiter geschützt (`infrastructure/caddy/tests/`).
- Bundles für iOS und Android, alle Suiten, Typecheck, Builds und Browserläufe grün.

### Grenzen

Keine Änderung an `shared/brand` und kein Schriftzug im Zeichen. Nicht dabei: Einladungsmail, Funktionssymbole.
Kein EAS-Build, kein Store-Upload, kein Deploy (macht der PO mit Deploy 5). ADO nicht ändern.

### Bericht

`.t120-review/` (report.md, tracked.diff, untracked.txt, Bildschirmfotos von Start, Anmeldung, „Erfassen“ und den drei
Web-Apps). Unabhängiges Review in einer Runde, eine zweite nur bei P1/P2. Kein Commit vor `APPROVED` durch den TL.
