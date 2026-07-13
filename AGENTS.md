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
- Commits, Pushes, Pull Requests und Merges sind ohne ausdrücklichen Auftrag verboten.

## Verifikation und Abschluss

- Vor Abschluss sind alle für den geänderten Scope relevanten Tests und Typechecks auszuführen. Ausgelassene oder nicht ausführbare Prüfungen sind mit Grund zu melden.
- Ein grüner Standard-Typecheck darf nicht als tests-inklusiver Typecheck bezeichnet werden. Testquellen gelten nur dann als typegeprüft, wenn die ausgeführte Konfiguration sie nachweislich einschließt.
- Wesentliche Risiken, Scope-Abweichungen, Dokumentationswidersprüche und offene Fragen sind transparent zu melden.
- Der Abschlussbericht nennt geänderte Dateien, ausgeführte Verifikation, verbleibende Risiken beziehungsweise offene Fragen und den empfohlenen nächsten Schritt.
