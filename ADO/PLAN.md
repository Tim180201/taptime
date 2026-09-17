# TapTim.e — Plan bis zum ersten Kunden

> **One Tap. One Decision.** Jede Aufgabe unten muss diesem Ziel dienen.

**Team:** Tim (Product Owner) · Claude (Technical Lead) · Codex (Development)
**Leitentscheidung:** Erst das System vollständig fertig, dann Firma, Recht und Store (D-007),
mit getrennten Uhren für reine Wartezeiten (D-011).
**Stand:** 17.09.2026, Reihenfolge aus der vollständigen Anforderungsprüfung gegen den Code
(D-012).

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
| **T-015a** | **Standorte als Datenmodell — ausgeschaltet** | Geteilt am 26.08.: sieben Sitzungen in einem Chat sind die Bauart, die zu veralteten Kontexten führt. ADR-0020 verlangt die Funktion standardmäßig aus — der Schnitt ist dadurch gefahrlos. Diese Aufgabe ändert kein Verhalten. | 3 |
| **T-025** | **Grenztests messen statt raten** | Derselbe Test schwankte am 26.08. zwischen 8,9 s und 30,2 s, die Exportstrecke um Faktor 8,5. Eine feste Millisekundenschranke misst auf dieser CI nicht die Software, sondern die Tagesform des Läufers — dreimal ausgelöst, dreimal war nichts kaputt. Vorgezogen, weil der Flackerer sonst T-015b und T-015c weiter verrauscht. | 1 |
| **T-015b** | Standortleitung als Rolle und Berechtigung (ADR-0022) | Ändert den Körper von `has_membership_management_authority_v1`; Route und Aufrufstellen bleiben | 3 |
| **T-015c** | **Der Server sagt, was die Oberfläche zeigen darf** | Geteilt am 26.08.: `/v1/session` trägt weder Standortfunktion noch Verwaltungsumfang, die Beschäftigtenprojektion keinen Standort. Ohne diesen Vertrag müsste die Oberfläche selbst über Berechtigungen entscheiden — verboten nach DA6-L08. | 2 |
| **T-015d** | Zuschnitt der Oberfläche auf den Standort | Braucht T-015c und das Regelwerk aus D-021 | 2 |
| **T-026** | **Die Oberfläche wird mit ausgeliefert (D-030)** | Der Deploy liefert nur das Backend; das Admin-Web liegt seit T-006 von Hand kopiert auf dem Server. Zwei Oberflächenaufgaben sind nie angekommen, und das Gesundheitstor hat es nicht bemerkt. **Vorgezogen vor allem anderen** — ohne sie sieht der Pilotkunde nichts von dem, was gebaut wurde. | 2 |
| **T-028** | **Der Auslieferungsweg trägt auch die Betriebsskripte (D-032)** | Der erste Deploy nach T-026 brach ab: Die installierte Wiederherstellungsprüfung erwartet `32/32`, seit Migration 019 sind es `37`. Betriebsskripte, systemd-Einheiten und Caddyfile liegen von Hand installiert auf dem Server und altern still. Blockiert jeden weiteren Deploy. | 2 |
| **T-027** | **Dunkles Gestaltungsraster umsetzen (D-031)** | Nach T-026, weil eine schöne Oberfläche, die nicht ausgeliefert wird, niemandem hilft. Vor T-015e und T-020, weil sie den Pilotkunden nicht braucht. **Nur Aussehen, kein Inhalt.** | 3 |
| **T-015e** | **Standorte auswählbar machen (D-029)** | Ein Administrator mit eingeschalteten Standorten kann heute niemanden einladen: Die Einladung verlangt einen Heimatstandort, die Oberfläche kennt keine Liste. Eigener blätterbarer Aufruf statt Liste in der Sitzung — die trägt nur 488 Standorte. **Sperre: Standorte dürfen vorher in keinem Betrieb eingeschaltet werden.** | 2 |
| **T-020** | **Freigabekette für nicht per NFC erfasste Zeiten (D-014)** | Braucht die Standortleitung als Instanz | 5 |
| **T-016** | Löschkonzept und Betroffenenrechte | Der AVV verlangt die Fähigkeit, nicht den Text | 5 |
| **T-017** | Feinschliff, Standortleitungs-Zuschnitt, Barrierefreiheit, **Sitzung (D-015); CSP ✓ 17.09.**, Landing Page | Nach dem Nutzer-Feedback | 4 |
| **T-032 ✓** | **Die App bekommt das Raster und spürbare Rückmeldung — abgeschlossen (`846a126`, CI-grün)** | Fünf unterscheidbare Rückmeldungen, dunkles Raster und reduzierte Bewegung sind gebaut. | 3 |
| **T-034 ✓** | **Beweisbarer Betrieb (B01, B04) — abgeschlossen und ausgeliefert (`56e975a`)** | CI und vollständiger Image-Bau grün; Produktion läuft auf `56e975a`. Das Auslieferungstor hat das echte Bündel mit öffentlicher Anmeldekonfiguration belegt, die Restore-Prüfung die RLS-Bedingung aus allen vorhandenen Anwendungstabellen abgeleitet. Anmeldung im Admin-Web durch den Product Owner bestätigt. | — |
| **T-039 ✓** | **Das Auslieferungstor prueft die richtige Herkunft — abgeschlossen** | 17.09., vom Technical Lead umgesetzt. Der Deploy liest genau einen Schluessel aus `/opt/taptime/.env` — `SUPABASE_ISSUER` — leitet daraus den Projektursprung ab und verlangt, dass das Web-Buendel GENAU diesen und keinen anderen Supabase-Ursprung traegt. **Nebenbefund:** Das Tor aus T-034 lief als `if`-Bedingung, wo Bash `set -e` ignoriert; nur die LETZTE Pruefung entschied. Ein Buendel mit fremdem Ursprung und gueltigem Schluessel waere durchgegangen — im Test belegt, jede Ablehnung ist jetzt explizit. Kein unabhaengiges Review — Codex holt es nach. | — |
| **T-040 ✓** | **Die Anmeldung nennt die Ursache — abgeschlossen** | 17.09., vom Technical Lead umgesetzt, waehrend Codex ohne Kontingent war. `signIn` liefert eine geschlossene Union statt eines booleschen Werts: `credentials_rejected`, `email_not_confirmed`, `access_blocked`, `rate_limited`, `service_unavailable`. Jede Ursache hat einen eigenen Satz; ein Ausfall des Anmeldedienstes sagt "Ihre Eingaben wurden nicht geprueft" und nie "Passwort". Gegenbeweis: mit alter Quelle 12 rot, danach 155 gruen. Kein unabhaengiges Review — Codex holt es nach. | — |
| **T-042** | **Aufstiegspfade der Geraetedatenbank: abdecken oder entfernen** | Der Echttest fuehrt nur OFFLINE_SCHEMA_V4 aus. Entweder fahren die Migrationsbloecke ueber denselben Treiber, den die App benutzt, ebenfalls durch echte SQLite — oder sie werden geloescht, weil sie nachweislich nicht ausloesen koennen. Faellig, bevor nach dem Pilotbetrieb zum ersten Mal das Schema geaendert wird; dann tragen Geraete echte Daten und ein fehlerhafter Aufstieg ist Datenverlust. | — |
| **T-038** | **Beschäftigte kommen auch über den Browser an ihre Zeiten** | Wer im Büro sitzt, soll ohne Telefon stempeln und Zeiten eintragen können. Die vorhandenen manuellen Lifecycle-, Pausen-, Eigenzeiten- und Arbeitsziel-Aufrufe bekommen eine Oberfläche. Browser-Erfassung bleibt sichtbarer `manual`-Trigger nach D-014/D-026; `/v2/session` wird nach D-027 versioniert erweitert. Rückfallweg statt Hauptweg, ohne Offline-Betrieb sowie ohne Vibrations- und Tonmuster. | — |
| **T-033 ✓** | **Gerätetest der Android-APK durch den Product Owner — abgeschlossen** | APK `486ad76`, VersionCode 5, SM-A336B mit Android 15: zehn von elf Schritten bestanden. Die Kette bis zur CSV-Zeile und der Offline-Weg tragen. Offen bleibt Schritt 11: Bei geschlossener App erscheint der Android-Auswahldialog mit mehreren Kandidaten; weiter als T-043. | PO |
| **T-043** | **Der Android-Auswahldialog verschwindet — getrennte Reparatur** | Der Auswahldialog entsteht, weil unser TECH-Filter (NfcA) und Androids System-App Tags (Ndef) denselben Tag treffen und Androids TECH-Pfad bei mehreren Treffern den Resolver oeffnet. NDEF_DISCOVERED beansprucht auf dem Testgeraet NIEMAND; Androids Reihenfolge ist NDEF vor TECH. Loesung daher: eine NDEF-Nachricht auf den Tag schreiben und NDEF_DISCOVERED mit Datenfilter beanspruchen — Vorbild ist das Vergleichsprojekt frogs-zeiterfassung, plugins/withNfcIntentFilters. Fuer Android genuegt jede Adresse und ist ohne Domainbesitz testbar; fuer iOS muss es ein https-Universal-Link auf einer von Apple verifizierten Domain sein (D-037), eigene Schemata akzeptiert Apple nicht. Das Tag-Format wird deshalb GENAU EINMAL festgelegt, erst wenn die Domain steht — ein Formatwechsel bedeutet, jeden ausgegebenen Tag neu zu beschreiben. AdminSetupScreen muss dann schreiben statt nur lesen. | — |
| **T-044** | **Der Lesemodus gehoert der App, solange der Scan-Bildschirm sichtbar ist** | Heute startet nur der Knopf „NFC-Tag scannen" eine Lesesitzung; ohne ihn uebernimmt Androids Vermittler und fragt. Solange der Reiter Erfassen sichtbar ist, muss die App Tags selbst abfangen (`enableReaderMode`), damit blosses Dranhalten genuegt. Ausserdem lehrt der Bildschirmtext den falschen Weg — „Tippe auf NFC-Tag scannen und halte das Geraet anschliessend an den Tag" (`ScanScreen.tsx:287`) — und verschweigt, dass bei geschlossener App Dranhalten reicht. Beachten: Der `ExclusiveNfcCaptureArbiter` regelt, dass Vordergrund-Erfassung und Tag-Dispatch sich nicht ins Gehege kommen. Getrennt von T-043. | — |
| **T-045 ✓** | **Der startausloesende Intent gehoert zur neuen Berechtigung — abgeschlossen** | Der kalte Start stempelt am Geraet; Product-Owner-Nachweis 16.09., 11:15:21, „Arbeitszeit gestoppt“. Der Android-Auswahldialog bleibt getrennt als T-043 offen. | 1 |
| **T-046 ✓** | **Der Einrichtungsvertrag traegt Pausen-Tags und beschaedigte Einzelzeilen — abgeschlossen und ausgeliefert (`3954282`)** | Arbeits-, Pausen- und unzugeordnete Tags teilen einen exakten Vertrag; fehlerhafte Einzelzeilen lassen den Rest sichtbar. Der Product Owner hat bestaetigt, dass die Einrichtung in Produktion wieder laedt. | 1 |
| **T-047** | **Beschaeftigte aufnehmen koennen (D-048, D-049)** | Heute kann sich niemand registrieren; ein Konto entsteht nur von Hand im Supabase-Dashboard. In Beschaeftigte ein Knopf *Mitarbeiter hinzufuegen*: Name und E-Mail, das Backend legt das Konto an und loest die Einladungsmail aus, der Mitarbeiter setzt beim ersten Anmelden sein eigenes Passwort. Kein eigener Reiter fuer Einladungen. **Braucht T-021** und die Regelaenderung aus D-049. | — |
| **T-048** | **Der Arbeitstag und seine Freigabe — Backend (D-046)** | Der Tag als Begriff, die zwei Stufen, die Sperre, Oeffnen und Ablehnen mit Begruendung, Sperre bei offenem Prueffall. Erst wenn das traegt, lohnt eine Oberflaeche dafuer. **Voraussetzung T-036 abgeschlossen**; die gemeinsame Zone steht fuer die Tagesgrenze bereit. | — |
| **T-049** | **Kalender und Reiter je Rolle — Oberflaeche** | Beschaeftigter: Meine Zeiten. Standortleitung: Meine Zeiten, Beschaeftigte, Pruefungen — ihr Standort ist ihr Umfang, keine Auswahl. Administrator: Uebersicht, Meine Zeiten, Beschaeftigte, Pruefungen, Einrichtung, Lohnexport. **Uebersicht:** die drei Kacheln bleiben, was darunter steht faellt weg; neu dazu die eigenen Stunden im laufenden Monat. Keine Ueberstunden, kein Urlaub — siehe T-051. Der Kalender ersetzt die flache Tabelle als Zugang; die Gesamttabelle zieht in den Lohnexport um, weil die Lohnbuchhaltung alle auf einmal braucht. Meine Zeiten ist zugleich die Oberflaeche aus T-038. Einzelbefunde: zweimal derselbe CSV-Knopf auf einer Seite (App.tsx:933 und :1013); sieben Tabellenspalten, davon vier Statusangaben; Filter wirken erst nach dem Anwenden-Knopf; die Rolle ist ein Auswahlfeld in jeder Zeile (:820), sodass ein verrutschter Klick eine Berechtigung aendert; die Pruefentscheidung liegt in einem eigenen Formular mit Auswahlfeld statt am Fall (:1182 und :1195). | — |
| **T-050** | **Pausenautomatik (D-047)** | Der Pausen-Tag verschwindet aus App, Backend und Oberflaeche. Der Abzug kommt als berechnete Schicht dazu, mit Kennzeichnung fuer den Abzug ohne Luecke und eigener CSV-Spalte. **Braucht T-036 und T-048.** | — |
| **T-051** | **Vorschlag: Ueberstunden und Urlaub — bewusst geparkt** | Beides braucht ein Soll-Modell, das es nicht gibt: vereinbarte Arbeitszeit, Arbeitszeitkonto, Urlaubsanspruch, Abwesenheiten, Jahresuebertrag. Eigenes Vorhaben, kein Reiter. **Noch keine Entscheidung.** Die eigenen Stunden im laufenden Monat gehoeren dagegen zu T-049. | — |
| **T-035** | **Kein stiller Datenverlust (B05, B03) — aktuell, D-051** | RPO 0 fuer bestaetigte WorkEvents, RTO vier Stunden: physische Basissicherung plus fortlaufendes externes WAL; die vorhandene Telefon-Queue wird erst nach explizitem Archivnachweis geloescht. Kein synchroner Standby, solange nur der Gruender den Betrieb beherrscht. B03 bekommt den fehlenden Wecker und einen Regressionstest mit echter SQLite-Faelligkeit. | — |
| **T-052 ✓** | **Die Bestaetigung kommt zurueck in den Tap — abgeschlossen (D-052)** | Technisch APPROVED, umgesetzt auf main, CI gruen. Entscheidung und Uebertragung sofort nach Serverbestaetigung; unarchivierte Zeilen getrennt aufbewahrt und nur mit exaktem Archivnachweis geloescht. Eigener ruhiger Abgleich ohne zusaetzlichen UI-Wartezustand. Echter SQLite-Gegenbeweis fuer den zweiten Tap und seinen eigenen Impuls. Alt-Routen formstabil. Restore-Befunde bleiben T-055; kein Deploy. | — |
| **T-053** | **Die v4-Route faellt aus dem Schutz (Audit, an der Quelle bestaetigt)** | `requestRateLimitScope` kennt nur `/v1`, `/v2`, `/v3`; `/v4/...` ergibt `null`. Folge eins: keine Ratenbegrenzung. Folge zwei: `requiresClientAddress` wird dadurch `false`, also laeuft auch die Pruefung der Proxy-Herkunft nicht. Die Tokenpruefung bleibt; kein Auth- oder Mandantendurchbruch, aber die teuerste Route steht ohne Bremse. Reparatur plus ein Test, der aus der tatsaechlichen Routenmenge ableitet und rot wird, sobald eine registrierte Route keine Schutzklasse hat. **Blockiert den Deploy von v4.** | — |
| **T-054** | **Rueckbau des eingefrorenen Pruefapparats (D-053)** | `apps/synthetic-android-e2e`, DA5-Auslaeufer unter `apps/mobile`, `backend-b1-spike`, jeweils mit Bauanbindung, CI-Job und Tests. Dazu der alte Scan-Ablauf (`ProductScanOrchestrator`, beide Resolver, `TapTimeScanContextApiClient`) und drei unbenutzte Core-Verwaltungsdienste. Anschliessend `ADO/STATUS.md` und `ADO/ARCHITECTURE.md` auf den wirklichen Jetzt-Zustand ziehen — der Auditor hat dort dreizehn Widersprueche zum Code belegt. In Stufen, jede fuer sich gruen. | — |
| **T-055** | **Wiederaufnahme nach Wiederanlauf (D-055)** | Drei Befunde aus dem gescheiterten T-052-Nachweis, alle vom selben Typ "was passiert beim erneuten Einspielen": die nach der Archivgrenze verlorene Lease-Bindung, die Reihenfolge ueber mehrere Installationen desselben Beschaeftigten, und die erneute Bewertung des Zeitfensters bei spaetem Replay. Kein Umschreiben erhaltener Evidenz. Denkbarer Weg: die Lease selbst erst nach Archivnachweis aushaendigen — sie lebt zwoelf Stunden, die Wartezeit faellt einmal an und nicht je Tap — plus ein benannter Pruefgrund fuer den Fall, dass es doch eintritt. Nachweis ist `OfflineRestorePostgres.test.ts`, heute Fall 2 rot. | — |
| **T-036 ✓** | **Zeitrichtigkeit — abgeschlossen (B02, D-056)** | Technisch und unabhaengig APPROVED, `bc675d0` auf main, CI gruen. Gemeinsame Berliner Zone, korrekte Monatsgrenzen und feste Web-/CSV-Anzeige. Beide Vertrags- und SQL-Grenzen tragen 31 Tage plus eine Stunde; Live-Nahttests und Migration-025-Aufstieg geprueft. Voraussetzung fuer T-048, T-049 und T-050 erfuellt. Mobile-Geraeteanzeige bleibt P2; kein Deploy. | — |
| **T-037** | **Reparaturweg und die ungeprüften Befunde (B06, dann B08, B09, B07)** | `container-image.yml:194–201` holt die Schutzliste mit `curl --fail` unter `set -euo pipefail` vor der Veröffentlichung bei `:268` aus der Produktion; bei deren Ausfall lässt sich kein Reparaturabbild veröffentlichen. B08 (Sicherung und Vergleichsliste aus verschiedenen Datenständen), B09 (Auth-Widerruf sperrt die eigene API nicht sofort) und B07 (kein gemeinsames Verbindungsbudget) zuerst verifizieren, dann bewerten. | — |
| **T-030** | **iOS-Weg klären — nur Recherche, kein Code** | iOS ist nach D-037 festes Ziel; Tap plus Bestätigung ist akzeptiert. Zu klären sind NDEF-Datensatz, Universal Link, Bauprofil und die technische Einbindung in das trigger-agnostische Modell. | 1 |
| **T-031** | Landing Page | Aus T-017 herausgelöst, damit sie unabhängig laufen kann. Eine statische Seite, ein halber Tag — aber sie braucht drei Dinge, die nicht bei der Entwicklung liegen: **Name und Domain**, **Impressum nach § 5 DDG und Datenschutzerklärung** (ohne die darf sie nicht online), und den **Werbesatz aus dem Pilotgespräch**. Vorher gebaut heißt zweimal gebaut. | 2 |
| **T-018** | Installierbare App per Direktlink | Für den eigenen Test | 2 |
| **T-023** | **Vorschlag:** Übersicht als Arbeitsvorrat statt Zustandsbericht | Die Übersicht zählt heute, was geladen ist. Sie soll zeigen, **was ohne den Administrator stehen bleibt**: offene Prüfungen, manuell erfasste Zeiten vor der Freigabe, laufende Arbeitszeiten. Summen über Projekte brauchen eine echte Auswertung im Backend auf Basis von `effective_work_duration_seconds_v1` — geladene Seiten zu addieren ergibt eine Zahl, die falsch ist und richtig aussieht. **Noch keine Entscheidung.** Der Inhalt wird vom Pilotgespräch bestimmt (D-020), nicht geraten. | 4 |
| **T-029** | **Vorschlag:** Die Ansichten folgen der Arbeit | Die Arbeitszeiten-Tabelle zeigt sieben Spalten — darunter *Herkunft* und *Korrekturstand* aus der Systembuchhaltung — und **nicht die Dauer**, also die einzige Zahl, die ein Inhaber sonst im Kopf ausrechnet. Die Liste ist flach, die Erfassungsart steht als Wort statt als Zeichen. **Noch keine Entscheidung:** Zuerst muss beantwortet sein, was jemand dort tun will — sehen wer vergessen hat zu stempeln, Stunden einer Person prüfen, korrigieren, exportieren, oder sehen wer gerade arbeitet. Das sind fünf Bildschirme; heute versucht einer, alle fünf zu sein. | 4 |
| **T-019** | Dokumente an die Wirklichkeit angleichen | Vier Dokumente beschreiben, was es nicht gibt | 1 |
| **T-021** | **Zustellbarkeit: eigener Mailversand, SPF/DKIM/DMARC** | Supabase erlaubt eingebaut nur **zwei Mails pro Stunde** projektweit — die Zurücksetzung aus T-009 versagt beim ersten echten Kunden, und zwar lautlos. Braucht den Product Owner. | 1 |

**Größe** in Arbeitssitzungen. Bestehende Schätzung: 48; T-034 bis T-037 sind noch ungeschätzt.

**Gutachten vom 06.09.:** B01 bis B06 hat der Product Owner an den Fundstellen geprüft und
bestätigt. B07, B08 und B09 sind ungeprüft; T-037 behandelt sie ausdrücklich erst nach
Verifikation.

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

Controlling und Stundensätze, Budgets, Self-Service-Onboarding, Abrechnungsautomatik,
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
