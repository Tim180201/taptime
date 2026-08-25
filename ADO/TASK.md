# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-011 · Schutz der öffentlichen Ränder

**Für:** Codex · **Risiko:** öffentlich erreichbar, Fehlkonfiguration wirkt wie kein Schutz → **unabhängiges Review verpflichtend**
**Zeitbox:** eine Arbeitssitzung · **Grundlage:** T-009 abgeschlossen

### Der Zustand heute

Kopf- und Rumpfgrenzen stehen (`MAX_BODY_BYTES`, `MAX_HEADER_BYTES`, `headersTimeout`). Was
fehlt, ist eine **Häufigkeitsgrenze**. Anmeldung, Einladungseinlösung und Passwortzurücksetzung
stehen ungebremst im Netz — jemand kann beliebig oft raten.

### Ziel

**Wiederholtes Raten wird teuer, ohne dass ein echter Benutzer es merkt.**

### Die Falle — hier scheitert diese Aufgabe normalerweise

Der Dienst steht **hinter Caddy**. Aus Sicht der Anwendung kommt jede Anfrage von derselben
Adresse — der des Reverse Proxy. Eine Begrenzung „pro IP" wäre damit eine Begrenzung für alle
gemeinsam: Ein einziger Angreifer sperrt sämtliche Kunden aus.

Die echte Adresse steht in `X-Forwarded-For`. Diesem Kopf **blind zu vertrauen ist der zweite
Fehler**: Der Wert ist frei wählbar, jeder Angreifer schreibt bei jeder Anfrage eine neue Adresse
hinein und die Bremse greift nie.

Beides zusammen ist der Grund, warum Ratenbegrenzungen oft nur wie Schutz aussehen.

**Also:** Caddy setzt den Kopf und die Anwendung akzeptiert ihn **ausschließlich** von Caddy.
Nichts anderes darf ihn setzen können. Weise beides nach — dass die Grenze pro Adresse greift
**und** dass ein gefälschter Kopf sie nicht umgeht.

### Was begrenzt wird

| Ziel | Wonach | Warum |
|---|---|---|
| `/v1/session` | Adresse **und** Konto | Anmeldung erraten |
| `/v1/employee-enrollment/redeem` | Adresse | Einladungscode erraten |
| alles übrige unter `/v1/*`, `/v2/*` | Adresse, großzügig | Überlastung, nicht Raten |

**Zwei Achsen bei der Anmeldung, nicht eine.** Nur pro Adresse begrenzt hilft nicht gegen viele
Adressen auf ein Konto; nur pro Konto nicht gegen viele Konten von einer Adresse.

### Was ausdrücklich nicht dazugehört

Die **Passwortzurücksetzung** läuft nicht über unsere API, sondern direkt gegen Supabase. Wir
können sie nicht begrenzen. Prüfe, welche Grenzen Supabase dort selbst setzt, und schreib das
Ergebnis in den Bericht — auch wenn nichts zu tun ist. Es ist ein offener Rand, und wir sollten
wissen, wie weit er offen steht.

### Invarianten

1. **Ein echter Benutzer merkt nichts.** Wer sein Passwort zweimal vertippt, wird nicht gesperrt.
2. **Die Antwort verrät nichts.** Eine Bremse darf nicht offenbaren, ob ein Konto existiert.
3. **Nichts wird dauerhaft gesperrt.** Grenzen laufen ab. Ein Kunde darf sich nicht selbst
   aussperren können.
4. **Kein Personenbezug im Zustand.** Was zum Zählen gespeichert wird, ist ein Merkmal, keine
   Kartei. Kurze Aufbewahrung.

### Vision-Check

Keine fachliche Logik, keine Oberfläche. Schutz.

### Nicht anfassen

- `packages/core`, jede Geschäftslogik
- Die Prüfungs- und Berechtigungsmaschinerie aus T-009 und T-010

### Prüfung — nachweisen, nicht behaupten

- Wiederholte Fehlanmeldungen von **einer** Adresse werden gebremst; eine **andere** Adresse ist
  davon unberührt — mit echter Ausgabe
- Ein **gefälschter** `X-Forwarded-For` umgeht die Bremse **nicht**
- Wiederholte Versuche auf **ein Konto** von wechselnden Adressen werden gebremst
- Zwei Fehlversuche eines echten Benutzers bremsen nichts
- Die gebremste Antwort unterscheidet nicht zwischen bestehendem und nicht bestehendem Konto
- Nach Ablauf der Frist geht es ohne Zutun weiter
- Der Zustand enthält keinen Personenbezug und wird nicht dauerhaft aufbewahrt
- Die vier Meldungen aus T-008 lösen dabei **nicht** aus — eine Bremse ist kein Störfall
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Zeige, wie du an die echte Adresse kommst, und wie du ausschließt, dass jemand sie selbst
> bestimmt. Nenne Datei und Zeilen. Wenn es einen Weg vorbei gibt, nenne ihn — statt zu
> behaupten, es gäbe keinen.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-012` Pausen · `T-013` Export · `T-014` Zweite Umgebung · `T-015` Standorte ·
siehe `ADO/PLAN.md`.
