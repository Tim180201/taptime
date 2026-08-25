# TapTim.e — Plan bis zum ersten Kunden

> **One Tap. One Decision.** Jede Aufgabe unten muss diesem Ziel dienen.

**Team:** Tim (Product Owner) · Claude (Technical Lead) · Codex (Development)
**Leitentscheidung:** Erst das System vollständig fertig, dann Firma, Recht und Store (D-007),
mit getrennten Uhren für reine Wartezeiten (D-011).
**Stand:** 24.08.2026, nach vollständiger Anforderungsprüfung gegen den Code (D-012).

---

## Was die Prüfung ergeben hat

21 ADRs, Vision, Prinzipien, Domänen- und Rollenmodell sowie drei archivierte Roadmaps wurden
gegen den echten Quelltext geprüft — nicht gegen die Dokumentation. Ergebnis: **Der Kern trägt.**
Mandantentrennung, append-only Korrekturhistorie, Idempotenz, Offline-Warteschlange und die Kette
`Trigger → WorkEvent → Engine → TimeEntry` sind sauber gebaut und belegt getestet. Es gibt keinen
Pfad, auf dem ein Auslöser die Engine umgeht.

Gefehlt haben nicht Funktionen des Kerns, sondern **alles, was ein echter Betrieb mit echten
Menschen braucht**: jemanden aussperren, den Betrieb sehen, einen festgefahrenen Fall auflösen,
eine Abrechnung erzeugen, die eine Prüfung übersteht.

Die alte Aufgabenkette deckte davon vier Punkte ab. Diese hier deckt sie alle ab.

---

## Nummernwechsel — einmalig

`T-001` bis `T-006` bleiben unverändert; sie stehen in Commit-Nachrichten. Alles danach ist neu
sortiert, weil die alte Reihenfolge die Betriebsfähigkeit hinter Ausbaustufen gestellt hätte.

| Alt | Neu |
|---|---|
| T-007 Backup | **T-007** unverändert |
| T-008 Pausen | **T-012** |
| T-009 Standorte | **T-015** |
| T-010 Oberflächen | **T-017** |
| T-011 Installierbare App | **T-018** |

---

## Phase 1 — Betriebsfähig werden

Ziel: Ein System, das ein fremder Betrieb benutzen kann, ohne dass der Product Owner mit
Datenbankrechten eingreifen muss.

| | Aufgabe | Warum jetzt | Größe |
|---|---|---|---|
| **T-006** | Admin-Web ausliefern und Erstinbetriebnahme | läuft | 2 |
| **T-007** | Sicherung und **getesteter Restore** | Datenverlust ist heute endgültig | 2 |
| **T-008** | Betriebssichtbarkeit: Protokolle, Alarm | Es entsteht heute **kein einziger Logeintrag** | 2 |
| **T-009** | Menschen verwalten: zweiter Administrator, Zugang entziehen, Passwort zurücksetzen | Ein Kunde kann eine ausgeschiedene Person nicht aussperren. **Standortfähig bauen — D-013** | 3 |
| **T-010** | Die Warteschlange darf nie blockieren | Eine Eskalation legt heute das Gerät dauerhaft still | 3 |
| **T-011** | Ratenbegrenzung an den eigenen Rändern | Einladungscodes ließen sich ungebremst raten | 1 |
| **T-012** | Pausenerfassung | Ohne Pausen keine belastbare Arbeitszeit | 3 |
| **T-013** | Export für die Lohnbuchhaltung, inkl. Kennzeichnung manueller Zeiten (D-014) | Heutige CSV übersteht keine Prüfung | 2 |
| **T-014** | Zweite Umgebung und wiederholbares Ausliefern | 14 Migrationen liefen nie vor der Produktion | 2 |
| **T-017a** | **Grundpolitur der Oberfläche** | Vorgezogen: Der Pilot-Trockenlauf soll Antworten zum Ablauf liefern, nicht zur Kosmetik. Rollenunabhängig, daher kaum Nacharbeit. | 3 |
| **T-022** | **Auslieferungsweg dokumentieren und absichern** | Am 25.08. musste der Weg zum Produktionsserver aus einer Shell-Historie rekonstruiert werden. `DEPLOY.md` nennt den Befehl, aber nicht den Host, nicht den Zugangsweg und nicht, wer ausliefern darf; `RESTORE.md` hat dieselbe Lücke an der Stelle, an der sie im Ernstfall am teuersten ist. Enthält zusätzlich den Wechsel vom Root-Login auf einen eng begrenzten Deploy-Benutzer. | 2 |
| **T-024** | **Geheimnisse rotieren** | Die achtzehn Datenbank-Zugangsdaten und der Cursor-HMAC-Schlüssel aus `/opt/taptime/.env` waren am 25.08. auf einem Screenshot sichtbar. Feste Reihenfolge: verwahren, rotieren, erneut verwahren — ohne verwahrte Altwerte gibt es bei einem Fehlschlag keinen Rückweg. **Enthält zusätzlich** den Wechsel auf einen passphrasegeschützten Deploy-Schlüssel (Vorschlag Codex, 25.08.): neuen Schlüssel einrichten, durch eine echte Auslieferung belegen, **erst danach** den alten öffentlichen Schlüssel entfernen. | 2 |
| **T-015** | Standorte und Standortleiter (ADR-0020, überarbeitet nach D-013) | Verwaltung hängt sonst an einer Person | 7 |
| **T-020** | **Freigabekette für nicht per NFC erfasste Zeiten (D-014)** | Braucht die Standortleitung als Instanz | 5 |
| **T-016** | Löschkonzept und Betroffenenrechte | Der AVV verlangt die Fähigkeit, nicht den Text | 5 |
| **T-017** | Feinschliff, Standortleitungs-Zuschnitt, Barrierefreiheit, **CSP und Sitzung (D-015)**, Landing Page | Nach dem Nutzer-Feedback | 4 |
| **T-018** | Installierbare App per Direktlink | Für den eigenen Test | 2 |
| **T-023** | **Vorschlag:** Übersicht als Arbeitsvorrat statt Zustandsbericht | Die Übersicht zählt heute, was geladen ist. Sie soll zeigen, **was ohne den Administrator stehen bleibt**: offene Prüfungen, manuell erfasste Zeiten vor der Freigabe, laufende Arbeitszeiten. Summen über Projekte brauchen eine echte Auswertung im Backend auf Basis von `effective_work_duration_seconds_v1` — geladene Seiten zu addieren ergibt eine Zahl, die falsch ist und richtig aussieht. **Noch keine Entscheidung.** Der Inhalt wird vom Pilotgespräch bestimmt (D-020), nicht geraten. | 4 |
| **T-019** | Dokumente an die Wirklichkeit angleichen | Vier Dokumente beschreiben, was es nicht gibt | 1 |
| **T-021** | **Zustellbarkeit: eigener Mailversand, SPF/DKIM/DMARC** | Supabase erlaubt eingebaut nur **zwei Mails pro Stunde** projektweit — die Zurücksetzung aus T-009 versagt beim ersten echten Kunden, und zwar lautlos. Braucht den Product Owner. | 1 |

**Größe** in Arbeitssitzungen. Summe 48.

**Reihenfolge ist echt.** T-020 steht zwischen T-015 und T-016, weil die Freigabekette die
Standortleitung als Instanz voraussetzt. T-013 braucht die Pausen aus T-012. T-016 braucht die Standorte aus
T-015, weil ein Löschlauf sie mit erfassen muss. T-017 braucht Nutzer-Feedback.

**Zwischen T-018 und Phase 2:** zwei Wochen selbst stempeln, dann zwei bis drei Leute aus einem
passenden Betrieb durchklicken lassen. Feedback vor Politur, nicht Politur vor Feedback.

---

## Phase 2 — Offiziell werden

Läuft nach D-011 in Teilen bereits parallel zu Phase 1.

| Bahn | Wer | Inhalt |
|---|---|---|
| **Marke** | Tim | Produktname, Ähnlichkeitsrecherche, DPMA-Anmeldung — **längste Uhr, über neun Monate** |
| **Firma** | Tim | UG, Notar, Handelsregister, Konto, Finanzamt, Steuerberater |
| **Recht** | Tim + Anwalt | AVV, Datenschutzerklärung, AGB; Verzeichnis und TOM prüfen lassen |
| **Store** | Tim + Codex | D-U-N-S, Play-Firmenkonto, Icon, Texte, signiertes Release |
| **Support** | Tim + Claude | Meldeweg, Störungsprozess, 72-Stunden-Frist nach Art. 33 DSGVO |

**Eigenes Tor:** Die Website darf erst veröffentlicht werden, wenn Impressum nach § 5 DDG und
Datenschutzerklärung stehen. Google verlangt beides für den Store-Eintrag.

---

## Phase 3 — Pilot und Verkauf

Echter Pilotbetrieb mit AVV · Politur an den Stellen, die im Pilot weh taten ·
Preis, Einseiter, Demo-Pfad · Mitbestimmungs-Handreichung für Kunden mit Betriebsrat ·
Go/No-Go.

---

## Was bewusst wartet

Controlling und Stundensätze, Budgets, Self-Service-Onboarding, Abrechnungsautomatik, iOS,
Dashboards, vollständige Rollenmatrix mit System Owner und Team Lead, Mehrfach-Mitgliedschaft,
Statusseite, Zertifizierungen.

Die Architektur trägt das bereits. Ein Feld, das heute niemand benutzt, ist Datenschutz-Ballast
und Migrationsschuld.

---

## Zuordnung zur ursprünglichen Roadmap

254 Punkte aus `Roadmap.md`, `Core_Roadmap_v2_Commercial_Readiness.md`,
`Product_Readiness_Roadmap.md` und `FB-002` wurden ausgewertet: **148 gebaut, 42 im Plan,
15 fehlten und sind jetzt aufgenommen, 49 bewusst später.**

| Dieser Plan | Ursprüngliche Roadmap |
|---|---|
| T-002…T-008, T-011, T-014 | **DA6-P01…P12** — ADR-0018 |
| T-015 | **DA6-L01…L11** — ADR-0020 |
| T-018 + Store in Phase 2 | **DT-075…DT-077**, **DA7** |
| Smoke-Test-Checkliste | **DT-078** |
| T-017 | **Block I**, DT-090…DT-103 |
| T-016, Phase 2 Recht | **DT-079…DT-085** |
| Phase 3 | **DT-086…DT-089**, **DA8** |

Von den 17 Punkten unter „Must-Have Before First Sale" sind zwölf gebaut; die fünf offenen
stehen oben in der Kette.

---

## Was der Betrieb kostet

**~8 € netto im Monat**, dauerhaft. In Phase 2 einmalig 25 USD Play Console, ~400 € Gründung,
290 € Markenanmeldung und das Rechtspaket.
