# TapTim.e Arbeitsanweisung für Codex

Diese Regeln gelten verbindlich für alle Codex-Tasks in diesem Repository. Vor Arbeitsbeginn sind mindestens `ADO/README.md`, der aktuelle Projektstatus und die für den Task maßgeblichen ADO-Artefakte zu lesen.

## Rollen und Freigaben

- Der Human Architect entscheidet über Produktziel, Prioritäten, Produktabnahme und Produktfreigaben.
- Der Technical Lead verantwortet Architektur, Task-Scope, technische Risiken und technische Abnahme.
- Implementation Agents implementieren ausschließlich den ausdrücklich freigegebenen Scope.
- Produktentscheidungen, Businessregeln und Architektur dürfen ohne Freigabe der jeweils verantwortlichen Rolle weder geändert noch neu interpretiert werden. Fehlende oder widersprüchliche Vorgaben sind als offene Frage zu melden, nicht durch Annahmen zu ersetzen.

## Arbeitsweise

- Repository-Wahrheit und tatsächlich ausgeführter Code haben Vorrang vor veralteter oder widersprüchlicher Dokumentation. Abweichungen sind transparent zu benennen.
- Änderungen müssen klein, fokussiert und anhand des Diffs nachvollziehbar bleiben.
- Unverwandte Dateien und bestehende Nutzeränderungen dürfen nicht verändert, überschrieben oder zurückgesetzt werden.
- ADO-Dokumente sind nur zu aktualisieren, wenn die Änderung die tatsächliche Projektwahrheit materiell verändert.
- Implementation Agents erstellen ohne ausdrücklichen Auftrag keine Commits, Pushes, Pull Requests oder Merges.
- Änderungen, die der Technical Lead nach vollständiger Prüfung ausdrücklich mit `APPROVED` abnimmt, dürfen unter der dauerhaften Freigabe des Human Architect direkt committed und nach `main` gepusht werden. Vor dem Push müssen der Remote-Stand geprüft und alle relevanten Verifikationen erfolgreich abgeschlossen sein.

## Verifikation und Abschluss

- Vor Abschluss sind alle für den geänderten Scope relevanten Tests und Typechecks auszuführen. Ausgelassene oder nicht ausführbare Prüfungen sind mit Grund zu melden.
- Ein grüner Standard-Typecheck darf nicht als tests-inklusiver Typecheck bezeichnet werden. Testquellen gelten nur dann als typegeprüft, wenn die ausgeführte Konfiguration sie nachweislich einschließt.
- Wesentliche Risiken, Scope-Abweichungen, Dokumentationswidersprüche und offene Fragen sind transparent zu melden.
- Der Abschlussbericht nennt geänderte Dateien, ausgeführte Verifikation, verbleibende Risiken beziehungsweise offene Fragen und den empfohlenen nächsten Schritt.

## Risikoadaptiver Development-Review-Kreislauf

- Der Technical Lead bleibt Orchestrator und prüft vor jeder Delegation die exakte Autorität, Baseline, Risikoklasse und die nach dem Adaptive Verification Standard erforderlichen Nachweise.
- Für Implementierungen der Risikoklassen R2 und R3 sowie immer dann, wenn ADO oder der Human Architect ein unabhängiges Review verlangen, ist der Kreislauf `Development -> Review -> gegebenenfalls Korrektur -> erneutes Review` verpflichtend. Für R0 und einfache R1-Arbeiten ist er optional, sofern keine strengere Vorgabe gilt.
- Der Custom Agent `taptime_development` ist während seiner Aufgabe der einzige schreibende Agent. Der Technical Lead und andere Agenten verändern das Repository nicht gleichzeitig. Der Development Agent darf ohne ausdrücklichen Auftrag weder committen noch pushen oder mergen.
- Erst nachdem Development vollständig beendet ist und der Technical Lead Arbeitsbaum sowie Delta geprüft hat, wird der Custom Agent `taptime_reviewer` gestartet.
- `taptime_reviewer` arbeitet technisch read-only und unabhängig. Er prüft mindestens Anforderungen und Autorität, Korrektheit, Regressionen, Architektur, Sicherheit, Tenant-Isolation, Tests und Codequalität. Er darf keine Dateien ändern, nichts stagen, committen, pushen, installieren, deployen oder anderweitig externen Zustand verändern.
- Ein interner Review-Subagent ersetzt kein separat vorgeschriebenes formales unabhängiges Review. Verlangt ADO eine exakte Bindung an Commit, Tree oder CI, muss diese Bindung zusätzlich nachgewiesen werden.
- Zulässige Review-Ergebnisse sind ausschließlich `APPROVED` oder `CHANGES REQUIRED`. Findings werden als P0 bis P3 mit konkreter Evidenz berichtet. `APPROVED` ist nur ohne offene P0-P3-Findings und mit ausreichender Verifikation zulässig.
- Bestätigte Code- oder Test-Findings innerhalb des bereits autorisierten Scopes gehen zurück an Development. Findings, die eine neue Produkt-, Business-, Architektur-, Scope- oder Autorisierungsentscheidung erfordern, stoppen den Kreislauf und gehen an den Human Architect.
- Nach jeder Korrektur werden die relevanten Prüfungen erneut ausgeführt und ein neues unabhängiges Review gestartet. Nach höchstens drei Review-Runden wird bei verbleibenden Findings mit `CHANGES REQUIRED` beziehungsweise `BLOCKED` berichtet; Qualität oder Prüftiefe werden nicht reduziert.
- Sobald das vorgeschriebene unabhängige Review einen konkreten technischen Architektur- und Autorisierungskandidaten vollständig mit `APPROVED` und ohne offene P0–P3-Findings freigegeben hat, darf der Technical Lead den darin exakt bestimmten technischen Scope auf der exakt bestimmten Baseline ohne separaten Bestätigungsprompt implementieren, risikoadaptiv verifizieren, unabhängig reviewen, bestätigte In-Scope-Findings korrigieren und erneut reviewen lassen. Diese Regel endet unmittelbar vor jedem Human-, Hardware- oder Physical-V5-Gate. Sie erlaubt weder das Erfinden fehlender Produkt-, Business- oder Architekturentscheidungen noch die Auflösung von Scope-Mehrdeutigkeit; solche Punkte gehen an den Human Architect. Produktion, Produktionsdaten, Deployment und Distribution benötigen immer eine separate ausdrückliche Autorisierung.
- `MERGE_READY` beziehungsweise technischer Abschluss darf erst nach Technical-Lead-Abnahme, allen erforderlichen Verifikationen, Remote-Prüfung sowie gegebenenfalls Exact-Head-CI und formaler Review-Freigabe gemeldet werden. Produktion, Produktionsdaten, Deployment und Distribution benötigen weiterhin jeweils eine separate ausdrückliche Autorisierung.
