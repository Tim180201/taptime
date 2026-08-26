# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-025 · Grenztests messen statt raten

**Für:** Codex · **Risiko:** kein Produktcode, aber die Verlässlichkeit jeder künftigen Prüfung
**Zeitbox:** eine Arbeitssitzung · **Grundlage:** drei Vorfälle, zuletzt bei T-015a

### Der Befund, und was er wirklich sagt

Derselbe Test, zweimal, dieselbe Version:

| | Erster Lauf | Wiederholung |
|---|---:|---:|
| Payroll-v3, 8 MiB | **30 163 ms** (Zeitüberschreitung) | **8 926 ms** |
| Gesamte Exportstrecke | **294,19 s** | **34,75 s** |

Faktor 3,4 beim Test, **Faktor 8,5 auf der ganzen Strecke.** Das ist kein knappes Budget und
kein Zufall an der Kante. Der Läufer hatte zeitweise fast seine gesamte Leistung verloren.

Daraus folgt etwas Unbequemes: **Eine feste Millisekundenschranke auf dieser CI misst nicht die
Software, sondern das Wetter.** Ein Budget von 30 Sekunden auf einer Maschine, die um den Faktor
8,5 schwanken kann, ist ein Münzwurf mit gutem Gewissen. Es hat dreimal ausgelöst, und dreimal
war die Software in Ordnung — dreimal haben wir Zeit mit der Frage verbracht, ob etwas kaputt
ist.

Ein Test, der bei Überlast **fremde** Prüfungen mit Datenbank-Zeitüberschreitungen umwirft,
macht darüber hinaus die gesamte CI unzuverlässig. Das ist der eigentliche Schaden.

### Ziel

**Ein rotes CI-Ergebnis bedeutet wieder: die Software ist kaputt.** Nicht: der Läufer hatte
einen schlechten Tag.

### Schritte

**1. Die Schranke relativ machen, nicht abschaffen**

Miss im **selben** Lauf eine Bezugsgröße — eine einfache, stabile Operation bekannter Größe —
und drücke das Budget als **Vielfaches** davon aus. Ein langsamer Läufer verlangsamt beides,
und die Aussage bleibt gültig.

Die absolute Zahl darf als Warnung im Protokoll stehen. Sie darf den Lauf nicht mehr rot machen.

Wenn du einen besseren Weg siehst, der dasselbe leistet — etwa eine Messung ohne Uhr, über
Zeilen, Abfragen oder Speicher — schlag ihn vor, bevor du baust. Die Uhr ist das Mittel, nicht
das Ziel.

**2. Den Grenztest von den anderen trennen**

Er darf keine fremde Prüfung mehr mitreißen. Eigene Datenbank, eigener Lauf, eigener
Ressourcenrahmen — was in dieser CI dafür zur Verfügung steht, entscheidest du und begründest es.

**3. Den bekannten C3E1-Fall gleich mitnehmen**

Der Paginationstest erzeugt Mitgliedschafts-UUIDs zufällig, erwartet aber eine feste
Rollenreihenfolge. Er steht seit T-012 als P2 in `STATUS.md` und ist heute erneut aufgetreten.
Eine nichtdeterministische Erwartung ist kein Flackerer, sondern ein falscher Test. Repariere
die Erwartung, nicht den Zufall.

**4. `STATUS.md` aufräumen**

Die drei Vorfallseinträge zu Grenztests werden durch **einen** Eintrag ersetzt, der den Befund
und die Lösung beschreibt. Kein Korrektur-Abschnitt angehängt — die Datei wird editiert.

### Vision-Check

Kein Produktcode. Aber jede künftige Aufgabe hängt daran, dass ein rotes Ergebnis etwas bedeutet.

### Nicht anfassen

- Der Payroll-Export selbst. Seine Logik ist nicht der Befund
- `packages/core`, Migrationen, Produktionsbetrieb
- Die inhaltlichen Erwartungen des Grenztests. Er prüft weiterhin dasselbe

### Prüfung — nachweisen, nicht behaupten

- Der Grenztest läuft **dreimal hintereinander** grün; die gemessenen Zeiten stehen im Bericht
- Ein künstlich verlangsamter Lauf macht den Test **nicht** rot, erzeugt aber die Warnung
- Eine künstlich eingebaute echte Verschlechterung wird weiterhin **erkannt** — sonst haben wir
  den Test nur stumm geschaltet. Dieser Nachweis ist der wichtigste der Aufgabe
- Der C3E1-Test ist unabhängig von der Erzeugungsreihenfolge der UUIDs
- Kein anderer Test wird durch den Grenztest beeinflusst
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Kann dieser Test nach der Änderung noch irgendetwas melden, das eine echte Verschlechterung
> wäre? Oder haben wir eine Prüfung durch eine Beruhigung ersetzt? Beantworte es mit einem
> Versuch, nicht mit einer Meinung.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-015b` Standortleitung als Rolle und Berechtigung (ADR-0022) · `T-015c` Oberfläche ·
`T-020` Freigabekette · siehe `ADO/PLAN.md`.
