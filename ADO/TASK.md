# Aktuelle Aufgabe

> **Stand 05.10.2026:** Produktion `b1ecb8c`; auf `main` T-094b bis T-097, Auslieferung mit dem nächsten Deploy (vorher
> Fingerabdrücke aus EAS, siehe STATUS). Reihenfolge: **T-098**, dann T-100 bis T-102 → Deploy und App-Builds → T-024 →
> Pilot. Frühere Briefs stehen in der Git-Historie.

## T-098 · Image-Workflow

**Für:** Development · **Risiko:** Auslieferungskette (Abbilder, Registry) · **Zeitbox:** eine Sitzung. Nur
`.github/workflows/*`, `.github/scripts/*`, deren Tests, `infrastructure/DEPLOY.md` (Abschnitt Abbilder). Keine
Änderung an Anwendungscode, Controller oder Server.

### Auftrag

1. **Auslösung:** Der Veröffentlichungsjob läuft nur für einen erfolgreichen CI-Lauf eines Pushs auf `main` aus diesem
   Repository; vor dem Bau prüfen, dass der Commit auf `main` liegt. Manuelle Reparaturläufe bleiben möglich und sind
   ebenso auf `main` begrenzt (F-012).
2. **Aufräumen:** Ungetaggte Versionen in der Registry nur löschen, wenn ihr Digest von keinem verbleibenden
   Index referenziert wird; im Zweifel nicht löschen. Ein Prüfschritt belegt nach dem Aufräumen, dass jedes geschützte
   Abbild vollständig abrufbar ist (F-057).
3. **Reparaturbau unabhängig:** Die Schutzliste aus der Produktion ist nur für das Löschen Voraussetzung; ist sie nicht
   abrufbar, wird gebaut und veröffentlicht, das Löschen übersprungen und im Lauf sichtbar gemeldet (F-058).
4. **Pinning:** Alle Actions auf volle Commit-SHAs mit Versionskommentar; Aktualisierung per Dependabot für
   `github-actions` (F-085).

### Tests

Rot vor Grün, ohne echte Registry: (1) Auslösebedingung als Workflow-Test (Push auf `main` ja, anderer Zweig/Ereignis/
Herkunft nein); (2) Löschauswahl mit Indizes und Kind-Manifesten: referenzierte bleiben; (3) Schutzliste nicht abrufbar
→ Bau-Schritte laufen, Löschen übersprungen; (4) Prüfung „alle Actions per SHA“. Bestehende Workflow-Tests grün,
`actionlint` falls vorhanden.

### Nicht Teil

Änderungen an Dockerfiles, Bauinhalt, Controller, Deploy-Ablauf.

### Bericht

`.t098-review/` (report.md, tracked.diff, untracked.txt). Unabhängiges Review. Kein Commit vor `APPROVED`.
