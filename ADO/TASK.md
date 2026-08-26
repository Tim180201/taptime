# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-015a · Standorte als Datenmodell — ausgeschaltet

**Für:** Codex · **Risiko:** Migration, Mandantengrenze, Berechtigungsdimension → **unabhängiges Review verpflichtend**
**Zeitbox:** drei Arbeitssitzungen · **Grundlage:** ADR-0020 (DA6-L01 bis L03, L06), D-008, D-013

### Warum geteilt

`T-015` war mit sieben Sitzungen die größte Aufgabe im Plan. Sie wird in drei geschnitten:

- **T-015a** — dieses Datenmodell, vollständig, aber **ohne jede Verhaltensänderung**
- **T-015b** — die Standortleitung als Rolle und Berechtigung (ADR-0022)
- **T-015c** — der Zuschnitt der Oberfläche

Der Schnitt ist möglich, weil ADR-0020 die Funktion ausdrücklich **standardmäßig aus** verlangt.
Diese Aufgabe darf deshalb an keiner Stelle sichtbar werden.

### Ziel

**Das Datenmodell für Standorte existiert vollständig, ist mandantengeschützt — und kein
einziger Benutzer merkt etwas davon.**

Die Aufgabe ist fertig, wenn die Migration eingespielt ist, die gesamte bestehende Testsuite
unverändert grün bleibt und nachgewiesen ist, dass ausgeschaltete Standorte **kein** Verhalten
beeinflussen.

### Die vier Begriffe, die nicht vermischt werden dürfen

ADR-0020 DA6-L03 trennt sie ausdrücklich, und die Trennung ist der Kern dieser Aufgabe:

| Begriff | Was er bedeutet | Was er **nicht** bedeutet |
|---|---|---|
| **Heimatstandort** | genau einer je aktiver Zugehörigkeit, solange die Funktion an ist | keine Einschränkung der Administratorautorität |
| **Arbeitszuweisung** | zusätzliche Standorte, an denen jemand arbeiten darf | keinerlei Verwaltungsrecht |
| **Verwaltungszuweisung** | Standorte, für die später delegiert verwaltet werden darf | kein Recht, dort selbst zu arbeiten |
| **Rolle** | bleibt in dieser Aufgabe unverändert `administrator` / `employee` | **keine dritte Rolle in T-015a** |

Keiner dieser vier impliziert, erweitert oder ersetzt einen anderen. Genau diese Vermischung ist
der Fehler, den ADR-0020 verhindern will.

### Schritte

**1. Migration 019**

- `locations` je Organisation, mit Aktiv-Kennzeichen und unveränderlicher Historie (DA6-L06)
- Heimatstandort an der Zugehörigkeit
- Arbeitszuweisungen und Verwaltungszuweisungen als **getrennte** Tabellen. Nicht eine Tabelle
  mit einem Typfeld — die beiden dürfen nie versehentlich ineinander laufen
- Ein Schalter je Organisation, **standardmäßig aus**

Alles im etablierten Stil: `organization_id` überall, RLS mit `ENABLE` **und** `FORCE`,
mandantenweite Eindeutigkeit über `(organization_id, id)`, keine Rechteausweitung in
`SECURITY DEFINER`-Funktionen, `SET search_path = pg_catalog`.

Die Organisation bleibt die harte Mandantengrenze (DA6-L02). Ein Standort ist eine **untergeordnete**
Dimension und niemals ein Ersatz für die Mandantenprüfung. Jede Berechtigung prüft weiterhin
zuerst die Organisation und **danach** den Standort.

**2. Das Einschalten ist eine einzige Transaktion**

Das ist der anspruchsvollste Teil und der, an dem die Aufgabe steht oder fällt.

Beim Einschalten wird geprüft, dass **jede** aktive Zugehörigkeit genau einen aktiven
Heimatstandort hat und **jeder** aktive Kunde, jedes Projekt, jedes Arbeitsziel und jede
NFC-Zuordnung genau eine eindeutige, aktive Standortbindung derselben Organisation trägt.

Fehlt eine, ist eine doppelt, widersprüchlich oder organisationsfremd, wird **die ganze
Umschaltung abgewiesen**. Kein Teilzustand. Keine automatische Zuweisung, keine Vermutung, kein
stillschweigendes Nachziehen.

**3. Ausschalten nimmt Rechte, löscht aber nichts**

Ausschalten beendet jede standortbezogene Wirkung für neue Entscheidungen sofort. Zuweisungen,
Standorte und Historie bleiben erhalten. Wiedereinschalten prüft **erneut vollständig** — nie
darauf verlassen, dass es beim letzten Mal gültig war.

**4. Keine Datenwanderung**

Keine bestehende Zeile wird automatisch einem Standort zugeordnet. Nichts wird abgeleitet.
Die Produktionsdatenbank ist praktisch leer; für später gilt DA6-L07, aber nicht hier.

### Vision-Check

**One Tap. One Decision.** Diese Aufgabe fügt dem Beschäftigten nichts hinzu — sie ist unsichtbar.
Sie schafft die Voraussetzung dafür, dass die Verwaltung später **nicht** mehr an einer einzigen
Person hängt (D-008).

### Nicht anfassen

- **Die dritte Rolle.** Keine Standortleitung in dieser Aufgabe. Der `CHECK` auf `role` bleibt
  bei `administrator` und `employee`
- `has_membership_management_authority_v1` aus Migration 016 — der Körper dieser Funktion ist
  **T-015b**
- `BusinessEngine` und die Entscheidungsreihenfolge
- `apps/admin-web` und `apps/mobile` — vollständig. Diese Aufgabe hat keine Oberfläche
- Bestehende Leseabfragen. Kein Standortfilter, nirgends

### Prüfung — nachweisen, nicht behaupten

- Die **gesamte bestehende Testsuite** bleibt unverändert grün. Kein Test wird angepasst, um
  die Migration zu überstehen — falls doch, ist das ein Befund und wird einzeln gemeldet
- Ein Test weist nach, dass bei ausgeschalteter Funktion **keine** Abfrage ein anderes Ergebnis
  liefert als vorher
- Ein Test schaltet mit einer absichtlich ungebundenen aktiven Zeile ein und weist nach, dass
  die **gesamte** Umschaltung abgewiesen wird und danach nichts halb umgestellt ist
- Ein Test weist nach, dass Aus- und Wiedereinschalten die vollständige Prüfung erneut ausführt
- Ein Test weist nach, dass eine Arbeitszuweisung **kein** Verwaltungsrecht ergibt und eine
  Verwaltungszuweisung **kein** Arbeitsrecht
- Ein Test weist nach, dass ein Standort einer fremden Organisation nicht sichtbar und nicht
  bindbar ist
- RLS ist auf allen neuen Tabellen aktiv **und** erzwungen; die Gesamtzahl im
  Wiederherstellungsnachweis ist entsprechend erhöht und im Bericht genannt
- Die Migration läuft in ihrer eigenen Transaktion und ist mit `ROLLBACK` geprüft
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Gibt es nach dieser Migration **irgendeinen** Weg, auf dem ein Standortbezug das Verhalten
> beeinflusst, obwohl die Funktion ausgeschaltet ist — eine Abfrage, eine Policy, eine Funktion,
> ein Standardwert? Suche danach, statt es auszuschließen.

### Abschluss

Vier Punkte melden. Entfernte oder umgeschriebene Tests **einzeln** benennen.
**Nicht committen** vor `APPROVED` durch den Technical Lead.

---

## Danach

`T-015b` Standortleitung als Rolle und Berechtigung (ADR-0022) · `T-015c` Oberfläche ·
`T-020` Freigabekette (D-014) · `T-024` Geheimnisse rotieren · siehe `ADO/PLAN.md`.
