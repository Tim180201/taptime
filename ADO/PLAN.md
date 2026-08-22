# TapTim.e — Plan bis zum ersten Kunden

> **One Tap. One Decision.** Jede Aufgabe unten muss diesem Ziel dienen.

**Kapazität:** ~4 h/Tag · **Team:** Tim (Product Owner) · Claude (Technical Lead) · Codex (Development)
**Leitentscheidung:** Erst das System vollständig fertig, dann Firma, Recht und Store (D-007).

---

## Das Prinzip: parallel über Rollen, nicht über Codex

Codex bearbeitet immer nur **eine** Aufgabe. Echte Parallelität entsteht dadurch, dass Tim und
Claude an Dingen arbeiten, die keinen Code brauchen.

**Ziel:** Codex' Warteschlange ist nie leer — und Tim wartet nie auf Codex.

---

## Die Linie, die nicht verschiebbar ist

Recht wird zwingend, sobald **echte Beschäftigte eines fremden Betriebs** ihre echten Zeiten
stempeln. Ab dann bist du Auftragsverarbeiter und brauchst einen AVV.

Vorher nicht. Du selbst, Freunde, erfundene Firmen und erfundene Kunden sind rechtlich frei —
beliebig lange, beliebig gründlich. Deshalb geht Phase 1 ohne Anwalt auf.

---

## Phase 1 — System fertig bauen (Woche 1–11)

Ziel: Vollständiges Produkt. Läuft auf einem Server, installiert auf einem Telefon,
von dir durchgetestet.

| Bahn | Wer | Inhalt |
|---|---|---|
| **Betrieb** | Codex + Tim | Container, Supabase EU, Hetzner Deutschland, TLS, Backup und **getesteter Restore** |
| **Standorte** | Claude + Codex | Standort als Berechtigungsdimension, Standortleiter mit voller Verwaltung am Standort, Pausen, Löschkonzept |
| **Oberflächen** | Codex + Tim | App, Admin-Web, Standortleiter-Bereich, Landing Page |
| **Eigener Test** | Tim | APK per Direktlink, Smoke-Test, zwei Wochen selbst stempeln |

**Reihenfolge zwingend:** Betrieb → Standorte → Oberflächen. Der Standortleiter-Bereich ist
Oberfläche für ein Feature, das es vorher nicht gibt. Andersherum wird die UI zweimal gebaut.

**Vor dem Polieren:** Zwei, drei Leute aus einem passenden Betrieb durchklicken lassen. Kein
Vertrag, keine echten Daten, keine Rechtsfolge — nur ein Gespräch vor einem Bildschirm.
Feedback vor Politur, nicht Politur vor Feedback.

---

## Phase 2 — Offiziell werden (Woche 12–15)

| Bahn | Wer | Inhalt |
|---|---|---|
| **Firma** | Tim | Rechtsform, Notar, Handelsregister, Bank, Steuerberater |
| **Recht** | Tim + Anwalt | AVV, Datenschutzerklärung, AGB; Verzeichnis und TOM prüfen lassen; Markenrecherche |
| **Store** | Tim + Codex | Name und Package-ID final, Play-Konto, Icon, Texte, signiertes Release |

**Eigenes Tor: Die Website darf erst veröffentlicht werden**, wenn Impressum nach DDG § 5 und
Datenschutzerklärung stehen. Beides hängt an der Firmengründung. Gebaut wird sie in Phase 1,
veröffentlicht in Phase 2.

---

## Phase 3 — Pilot und Verkauf (ab Woche 16)

Echter Pilotbetrieb mit AVV · Politur an den Stellen, die im Pilot weh taten ·
Support- und Störungsprozess · Preis, Einseiter, Demo-Pfad · Go/No-Go.

**Erster Kunde realistisch in rund vier Monaten** — am unteren Ende der ursprünglichen
Roadmap-Schätzung von vier bis sieben Monaten, bei größerem Funktionsumfang.

---

## Aufgabenkette

Immer genau eine. Die Reihenfolge ist echt.

| | Aufgabe | Braucht |
|---|---|---|
| T-001 | Prozess-Reset | ✅ erledigt |
| T-002 | Container und Healthcheck | nichts — läuft lokal |
| T-003 | Supabase EU, Migrationen | Supabase-Konto |
| T-004 | Hetzner Deutschland, Deploy mit TLS | Hetzner-Konto, eine Domain |
| T-005 | Admin-Web ausliefern | — |
| T-006 | Backup und getesteter Restore | Supabase Pro |
| T-007 | Pausenerfassung | — |
| T-008 | Standorte und Standortleiter (ADR-0020) | R3, unabhängiges Review |
| T-009 | Oberflächen fertigstellen | Nutzer-Feedback |
| T-010 | Installierbare App per Direktlink | — |

---

## Zuordnung zur ursprünglichen Roadmap

Die `Core_Roadmap_v2_Commercial_Readiness.md` liegt im Archiv. Sie ist abgelöst, nicht verworfen —
ihr Inhalt lebt hier weiter:

| Dieser Plan | Ursprüngliche Roadmap |
|---|---|
| Phase 1, Betrieb (T-002…T-006) | **DA6-P01…P12** — ADR-0018, Production-like Platform |
| Phase 1, Standorte (T-008) | **DA6-L01…L11** — ADR-0020, Optional Locations |
| Phase 1, T-010 + Store in Phase 2 | **DT-075…DT-077** und **DA7** — Build, Signing, Distribution |
| Smoke-Test-Checkliste | **DT-078** — App Runtime Smoke Test |
| Phase 1, Oberflächen (T-009) | **Block I**, DT-090…DT-103 — pilotgetrieben statt vorab geplant |
| Phase 1, Landing Page + Phase 2 Veröffentlichung | **DA8** — öffentliche Website, Impressum, Trust-Seiten |
| Phase 2, Recht | **DT-079…DT-085** — Block H |
| Phase 3, Verkauf | **DT-086…DT-089** — Block H |

**Blocks A bis F** sind durch DA1 bis DA5 abgearbeitet.
Von den 17 Punkten unter „Must-Have Before First Sale" sind **zwölf gebaut**; die fünf offenen
stehen alle oben in der Aufgabenkette.

---

## Was der Betrieb kostet

Phase 1: **~8 € netto im Monat** — Hetzner CX23 5,49 € + IPv4 0,50 € + Backup 1,10 € +
Supabase Free + EAS Free + eine Domain.

Phase 2: **~32 € netto im Monat** — Supabase Pro kommt dazu (25 $, nötig für tägliche Backups),
plus einmalig 25 € Play Console.

Die Infrastruktur ist nicht das Kostenrisiko. Ein Monat Anwalt kostet mehr als ein Jahr Server.

---

## Nach dem ersten Kunden — bewusst nicht jetzt

Controlling und Stundensätze, Budgets, Self-Service-Onboarding, Abrechnung, iOS, Dashboards,
Design-System, erweiterte Rollenmatrix.

Die Architektur trägt das bereits (siehe `ARCHITECTURE.md`, Invarianten I1–I3). Ein Feld, das
heute niemand benutzt, ist Datenschutz-Ballast und Migrationsschuld.
