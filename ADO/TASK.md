# Aktuelle Aufgabe

## T-052 · Die Bestätigung kommt zurück in den Tap — abgeschlossen

**Für:** Development · **Risiko:** personenbezogene Lohndaten, Produktvision
**Zeitbox:** zwei Sitzungen. **Grundlage:** D-052, D-055; D-051 bleibt unverändert.
Technisch APPROVED; Umsetzung auf main, CI vollständig grün. Kein Deploy.
T-055 und T-036 werden in eigenen Chats beauftragt.

### Zweck und Grenzen

Eine Serverbestätigung zeigt und fühlt die Entscheidung und lässt die Übertragung sofort
weiterrücken. Die lokale Zeile wird erst nach externem Archivnachweis gelöscht. Kein Knopf,
kein Dialog, keine neue Nutzerentscheidung. Die fachliche Kette und Originalhistorie bleiben
intakt. Das Telefon legt die Zeile an, bestätigt sie lokal und entfernt sie nach Archivnachweis.
Kein Deploy, Produktionszugriff, T-055, T-036 oder T-043. Umsetzung nicht vor APPROVED committen.

### Umsetzung

1. Bereits umgesetzt beibehalten: v4 und Reconciliation v2 tragen dieselbe geschlossene
   Entscheidungs-/Prüfgrund-Union mit eigenem Archivstatus; exakte Schlüsselmengen bleiben exakt.
   reconcileV2 ist verpflichtend. Tote mobile Lease-V1/V2-Wege bleiben entfernt;
   sämtliche Server-Endpunkte bleiben für alte Apps bestehen.
2. Bei synchronized oder review_pending sofort Entscheidung zeigen und fühlen, nächste
   Queue-Zeile senden. Kein retryOffline für diese Bestätigung. Unarchivierte Zeilen in einem
   eigenen dauerhaften Zustand behalten; sie zählen nicht als offene Übertragung für die UI.
3. Ein ruhiger, unabhängig getakteter Nachlauf fragt Reconciliation v2 ab. Er löscht nur die
   jeweils nachweislich archivierte Zeile und blockiert keine Erfassung. Persistenz, Neustart
   und Eigentümerbindung erhalten. Der Nachlauf aktualisiert und entfernt den Aufbewahrungszustand.
4. Oberfläche zeigt die Entscheidung. Zusätzlichen Sicherungs-Wartezustand entfernen, wenn
   er keinen Nutzen mehr hat; Ergebnis melden. Entscheidungsimpuls und exhaustive Abbildung
   mit satisfies never bleiben erhalten.

### Pflichtbelege und Verifikation

- Vor Reparatur roter Test mit echter SQLite: zwei Ereignisse, erstes bestätigt und noch
  unarchiviert; zweites wird trotzdem gesendet und bekommt seine eigene Entscheidung.
- Commit ohne Archivnachweis löscht keine Zeile. Nachlauf löscht erst nach offsite_archived
  aus Reconciliation v2 und niemals eine andere Zeile. Alte v1–v3-Routen bleiben formstabil.
- Restore-Befunde gehören zu D-055/T-055. RESTORE.md und OfflineRestorePostgres.test.ts bleiben
  unverändert; den belegten Fehlerfall nicht durch andere Erwartungen grün machen.
- Typecheck nachweislich einschließlich Tests, vollständige Tests betroffener Workspaces,
  PostgreSQL-Integrationssuiten lokal seriell; unabhängiges Review, maximal zwei Runden.
- D-055 und T-055-Planzeile mit dem neuen Auftrag vor Umsetzung getrennt committen und sofort
  pushen, ausschließlich ADO/ und AGENTS.md. RESTORE.md gehört zur Umsetzung.
- Abschlussbericht gemäß AGENTS.md §8; ausgelassene Prüfungen mit Grund melden.
