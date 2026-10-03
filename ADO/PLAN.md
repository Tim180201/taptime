# TapTim.e — Plan bis zum ersten Kunden

> **One Tap. One Decision.** Jede Aufgabe unten muss diesem Ziel dienen.

**Team:** Tim (Product Owner) · Claude (Technical Lead) · Codex (Development)
**Leitentscheidung:** Erst das System vollständig fertig, dann Firma, Recht und Store (D-007),
mit getrennten Uhren für reine Wartezeiten (D-011).
**Stand:** 03.10.2026, Produktion auf `0230188` (Deploy 28.09.: T-080, T-084 bis T-090; Migrationen bis 039; Controller
`b635c4a`). App-Builds 28.09. auf `0230188`: iPhone 1.0.0 (4), Android versionCode 11. Code-Analyse 28.09. eingeordnet
(D-103). T-093 (`19a363d`) und T-094 (`947ac51`) abgeschlossen, mit dem zweiten Deploy. Vor dem Pilot (TL 03.10.): T-091, T-092, T-095 bis
T-098, T-100 bis T-103 (T-099 je nach Startumfang) → zweiter Deploy und App-Builds → **T-024** → Pilot. Ebenfalls vor dem
Echtbetrieb: UG eingetragen und AVV unterschrieben (D-019; Kosten in `ADO/06_Recht/Rechtsform_Vorschlag.md`), AVV/TOM an
den Code angeglichen (B15). In Monat 1 zusaetzlich T-075 (Paketgrenze, D-087), T-073
(faelschungssichere Tags, D-111) und die Analyse-Pakete B01 bis B06, B12, B16 (unten); waehrend Monat 1 T-048 und T-050,
Freigabe zu Monat 2 (D-063). T-031b (Startseite oeffentlich) nach dem Pilot. Grundlage weiterhin die
Anforderungspruefung gegen den Code (D-012).

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
| **T-043 ✓** | **Der Android-Auswahldialog verschwindet — abgeschlossen `b68e48b`** | Der Auswahldialog entsteht, weil unser TECH-Filter (NfcA) und Androids System-App Tags (Ndef) denselben Tag treffen und Androids TECH-Pfad bei mehreren Treffern den Resolver oeffnet. NDEF_DISCOVERED beansprucht auf dem Testgeraet NIEMAND; Androids Reihenfolge ist NDEF vor TECH. Loesung daher: eine NDEF-Nachricht auf den Tag schreiben und NDEF_DISCOVERED mit Datenfilter beanspruchen — Vorbild ist das Vergleichsprojekt frogs-zeiterfassung, plugins/withNfcIntentFilters. Fuer Android genuegt jede Adresse und ist ohne Domainbesitz testbar; fuer iOS muss es ein https-Universal-Link auf einer von Apple verifizierten Domain sein (D-037), eigene Schemata akzeptiert Apple nicht. Das Tag-Format wird deshalb GENAU EINMAL festgelegt, erst wenn die Domain steht — ein Formatwechsel bedeutet, jeden ausgegebenen Tag neu zu beschreiben. AdminSetupScreen muss dann schreiben statt nur lesen. **Entschieden 18.09. (D-061): Host `tb-infra.de` bis zum Pilot, Hostliste an einer Stelle, keine Schreibsperre; Umgesetzt 18.09.: NDEF-URI plus Android Application Record beim Zuordnen (Schreiben vor Registrierung), Manifest NDEF/VIEW je Host, Ingress nimmt TECH/NDEF/VIEW nur mit EXTRA_TAG; 551 Mobile-Tests, CI gruen. Geraetenachweis mit der APK nach T-059.** | ✓ |
| **T-044** | **Der Lesemodus gehoert der App, solange der Scan-Bildschirm sichtbar ist** | Heute startet nur der Knopf „NFC-Tag scannen" eine Lesesitzung; ohne ihn uebernimmt Androids Vermittler und fragt. Solange der Reiter Erfassen sichtbar ist, muss die App Tags selbst abfangen (`enableReaderMode`), damit blosses Dranhalten genuegt. Ausserdem lehrt der Bildschirmtext den falschen Weg — „Tippe auf NFC-Tag scannen und halte das Geraet anschliessend an den Tag" (`ScanScreen.tsx:287`) — und verschweigt, dass bei geschlossener App Dranhalten reicht. Beachten: Der `ExclusiveNfcCaptureArbiter` regelt, dass Vordergrund-Erfassung und Tag-Dispatch sich nicht ins Gehege kommen. Getrennt von T-043. | — |
| **T-045 ✓** | **Der startausloesende Intent gehoert zur neuen Berechtigung — abgeschlossen** | Der kalte Start stempelt am Geraet; Product-Owner-Nachweis 16.09., 11:15:21, „Arbeitszeit gestoppt“. Der Android-Auswahldialog bleibt getrennt als T-043 offen. | 1 |
| **T-046 ✓** | **Der Einrichtungsvertrag traegt Pausen-Tags und beschaedigte Einzelzeilen — abgeschlossen und ausgeliefert (`3954282`)** | Arbeits-, Pausen- und unzugeordnete Tags teilen einen exakten Vertrag; fehlerhafte Einzelzeilen lassen den Rest sichtbar. Der Product Owner hat bestaetigt, dass die Einrichtung in Produktion wieder laedt. | 1 |
| **T-047 ✓** | **Beschaeftigte aufnehmen koennen — ausgeliefert (D-048, D-049, D-057)** | Seit 18.09. in Produktion: Kontoeinladung ueber den Supabase-Admin-Endpunkt, Mitgliedschaft und Identitaetsbindung in einer Transaktion, `/willkommen`-Passwortseite, eigener Ratenscope, Migration 026. Abnahme steht noch aus: PO-Schritt 5 (service-role-Schluessel in `/opt/taptime/.env`), dann eine echte Einladung an ein echtes Postfach, am Handy gelesen (D-044). | — |
| **T-048** | **Der Arbeitstag und seine Freigabe — Backend (D-046)** | Der Tag als Begriff, die zwei Stufen, die Sperre, Oeffnen und Ablehnen mit Begruendung, Sperre bei offenem Prueffall. Erst wenn das traegt, lohnt eine Oberflaeche dafuer. **Voraussetzung T-036 abgeschlossen**; die gemeinsame Zone steht fuer die Tagesgrenze bereit. **Termin nach D-063: waehrend Pilotmonat 1 bauen, zu Monat 2 zuschalten — mit Oberflaeche in App und Web, die der Web-Entwurf noch nicht zeigt.** | — |
| **T-049** | **Das Web, wie es gemeint ist — Oberflaeche je Rolle (D-060)** | Umsetzung des Web-Entwurfs vom 18.09. (`ADO/01_Architecture/Web_Entwurf`): Leiste links je Rolle, Uebersicht mit Aktiv-Kachel und Entscheidungen am Fall, Beschaeftigte mit Person und Kalender, Einladen im Seitenpanel, Pruefungen mit Freigeben/Korrigieren/Ablehnen in der Zeile, Einrichtung (Standorte, Arbeitsziele, Tags), Lohnexport mit Kennzeichnung offener Pruefungen; Standortleitung im eigenen Standort; **Mitarbeiter erstmals im Web** mit Meine Zeiten und Manuell. Einzelbefunde der alten Tabelle bleiben gueltig: doppelter CSV-Knopf (App.tsx:933/:1013), sieben Spalten, Filter erst nach Anwenden, Rolle als Auswahlfeld in jeder Zeile (:820), Pruefentscheidung im getrennten Formular (:1182/:1195). Was das Backend nicht liefert (Pausenzeilen T-050, Soll T-051, Loesungsvorschlag), wird weggelassen. **Nach T-058; Mitarbeiter-Rolle im Web braucht die Rollenpruefung der Admin-Session.** | — |
| **T-050** | **Pausenautomatik (D-047, D-096)** | Der Pausen-Tag verschwindet aus App, Backend und Oberflaeche; der Pausen-Knopf (T-082) bleibt. Der Abzug kommt als berechnete Schicht dazu, mit Kennzeichnung fuer den Abzug ohne Luecke und eigener CSV-Spalte. **Braucht T-036 und T-048; zusammen mit ihnen waehrend Pilotmonat 1 (D-063).** | — |
| **T-051** | **Vorschlag: Ueberstunden und Urlaub — bewusst geparkt** | Beides braucht ein Soll-Modell, das es nicht gibt: vereinbarte Arbeitszeit, Arbeitszeitkonto, Urlaubsanspruch, Abwesenheiten, Jahresuebertrag. Eigenes Vorhaben, kein Reiter. **Noch keine Entscheidung.** Die eigenen Stunden im laufenden Monat gehoeren dagegen zu T-049. | — |
| **T-035 ✓** | **Kein stiller Datenverlust — in Produktion (B05, B03, D-051)** | Seit 18.09. aktiv: physische Basissicherung, fortlaufendes externes WAL, versionierter Archivvertrag (023), Wiederherstellung viermal aus dem externen Archiv bewiesen. Der erste Deploy brauchte fuenf Anlaeufe und drei Erstlauf-Reparaturen (`d68ff4d`, `9ea3b31`, `939b4ba`, siehe STATUS). Restfragen: T-055 (Wiederaufnahme), T-057 (Deploy-Haertung). | — |
| **T-052 ✓** | **Die Bestaetigung kommt zurueck in den Tap — abgeschlossen (D-052)** | Technisch APPROVED, umgesetzt auf main, CI gruen. Entscheidung und Uebertragung sofort nach Serverbestaetigung; unarchivierte Zeilen getrennt aufbewahrt und nur mit exaktem Archivnachweis geloescht. Eigener ruhiger Abgleich ohne zusaetzlichen UI-Wartezustand. Echter SQLite-Gegenbeweis fuer den zweiten Tap und seinen eigenen Impuls. Alt-Routen formstabil. Restore-Befunde bleiben T-055; kein Deploy. | — |
| **T-053 ✓** | **Die v4-Route faellt aus dem Schutz — abgeschlossen, ausgeliefert** | `requestRateLimitScope` kennt nur `/v1`, `/v2`, `/v3`; `/v4/...` ergibt `null`. Folge eins: keine Ratenbegrenzung. Folge zwei: `requiresClientAddress` wird dadurch `false`, also laeuft auch die Pruefung der Proxy-Herkunft nicht. Die Tokenpruefung bleibt; kein Auth- oder Mandantendurchbruch, aber die teuerste Route steht ohne Bremse. Reparatur plus ein Test, der aus der tatsaechlichen Routenmenge ableitet und rot wird, sobald eine registrierte Route keine Schutzklasse hat. **Blockiert den Deploy von v4.** | — |
| **T-054 ✓** | **Rueckbau des eingefrorenen Pruefapparats — abgeschlossen (D-053)** | `apps/synthetic-android-e2e`, DA5-Auslaeufer unter `apps/mobile`, `backend-b1-spike`, jeweils mit Bauanbindung, CI-Job und Tests. Dazu der alte Scan-Ablauf (`ProductScanOrchestrator`, beide Resolver, `TapTimeScanContextApiClient`) und drei unbenutzte Core-Verwaltungsdienste. Anschliessend `ADO/STATUS.md` und `ADO/ARCHITECTURE.md` auf den wirklichen Jetzt-Zustand ziehen — der Auditor hat dort dreizehn Widersprueche zum Code belegt. In Stufen, jede fuer sich gruen. | — |
| **T-055** | **Wiederaufnahme nach Wiederanlauf (D-055)** | Drei Befunde aus dem gescheiterten T-052-Nachweis, alle vom selben Typ "was passiert beim erneuten Einspielen": die nach der Archivgrenze verlorene Lease-Bindung, die Reihenfolge ueber mehrere Installationen desselben Beschaeftigten, und die erneute Bewertung des Zeitfensters bei spaetem Replay. Kein Umschreiben erhaltener Evidenz. Denkbarer Weg: die Lease selbst erst nach Archivnachweis aushaendigen — sie lebt zwoelf Stunden, die Wartezeit faellt einmal an und nicht je Tap — plus ein benannter Pruefgrund fuer den Fall, dass es doch eintritt. Nachweis ist `OfflineRestorePostgres.test.ts`, heute Fall 2 rot. | — |
| **T-056** | **Die CI baut die drei Images.** | Der Image-Workflow kann scheitern, ohne dass es jemand merkt: Pflicht-Check für den Image-Workflow oder Bau aller drei Dockerfiles ohne Push in der CI. Die Paketliste im Dockerfile aus den Workspace-Abhängigkeiten ableiten statt von Hand pflegen — dritte Wiederholung des Musters aus T-053. Eigene Aufgabe, jetzt nur eingeplant. | — |
| **T-057** | **Deploy-Haertung nach dem ersten T-035-Deploy (18.09.)** | Vier Befunde aus der Produktion, alle im Controller `infrastructure/deploy` oder seiner Doku: (1) `run_fresh_oneshot` laeuft nach gescheiterter Sicherung weiter, weil `grep '"state":"ok"'` die alte Statusdatei liest — dieselbe Klasse wie T-034; (2) das Barriere-Fenster `WAL_ARCHIVE_INTERVAL_SECONDS * WAL_ARCHIVE_MISSED_CYCLES` ist beim Erstlauf zu knapp, weil der Archivierer zuerst die verifizierte Basis registriert — Archivierer vor der Barriere einmal synchron laufen lassen oder das Fenster daran messen; (3) `[7/7] Archivvertrag ist aktiv` erscheint auch, wenn nur der Cutover aktiv war; (4) DEPLOY.md: die Hetzner-Konsole hat keine Einfuegefunktion, Befehle werden mit US-Belegung getippt (Tippregeln dokumentieren), und der Deploy laeuft aus dem Terminal des Product Owners mit `caffeinate` und `tee`, nicht aus Codex. Ein Controller-Commit, danach Controller-Update ueber die Konsole nach DEPLOY.md. Regel fuer alle Skripttests: nachgebaute Fremdwerkzeuge folgen der dokumentierten Semantik der installierten Version (Borg 1.2). **Ergaenzt 22.09.:** Sicherungs-Timer waehrend des Deploys angehalten, Probe mit eigener Basis, eingebaute Vorpruefung, lesender Diagnosebefehl `taptime-status` fuer den Deploy-Benutzer, Spool-Besitzer. Brief in TASK.md. | 1 |
| **T-058 ✓** | **Die App, wie sie gemeint ist — Navigation je Rolle und der Tap-Moment (D-058) — abgeschlossen `3daa09b`** | Umsetzung des Entwurfs vom 18.09. (`ADO/01_Architecture/Mobile_Entwurf`): Reiterleiste je Rolle, Abgleich hinter dem Statuspunkt, Tags statt NFC-Einrichtung, Erfassen mit Atem-Ring und Wellen (Vorbild frogs-zeiterfassung `app/scan.jsx`), eigener Entscheidungsbildschirm mit Server-Bestaetigung und Offline-Variante, Meine Zeiten mit Monatskalender und Tagesliste, Manuell und Abgleich im neuen Kleid, Name Taptura. Dazu die zwei App-Befunde vom 18.09. (Schutztext je Ursache; Schutzzustand beim Kontowechsel verwerfen). Nur App, kein Backend. Administrator behaelt Meine Zeiten, bis T-059 den Reiter Mitarbeiter bringt. Umgesetzt 18.09., 516 Mobile-Tests, CI gruen; Standortleitung erhaelt Tags erst mit T-060; Geraeteabnahme mit der APK nach T-059. | ✓ |
| **T-059 ✓** | **Mitarbeiter im Handy — abgeschlossen `91441c8`** | Reiter Mitarbeiter fuer Administrator und Standortleitung: Kachel „7 / 12 gerade aktiv" (laufende Zeiten, Stand des Servers), Umschalter Aktiv/Inaktiv, Person → Monatskalender mit Tagesliste, „+ Mitarbeiter" ueber die T-047-Strecke. Braucht einen Lesezugang im Backend fuer laufende und abgeschlossene Zeiten je Person im eigenen Umfang (Administrator: Betrieb, Standortleitung: Standort). Kein neues Datenmodell; „aktiv" ist eine Buchung ohne Ende. **Umgesetzt 18.09.: Migration 028 (`read_managed_person_time_v1`, `read_managed_active_summary_v1`) prueft die Autoritaet auf jeder Seite neu; der Cursor bindet die Anfrage, autorisiert sie nicht. Zwei Routen, Sitzung traegt den Verwaltungsumfang; Reiter Mitarbeiter ersetzt bei Admin und Standortleitung „Meine Zeiten" (D-058). 1.468 Tests, CI gruen.** Befund vorher: Der Lesezugang fuer fremde Zeiten fehlte vollstaendig — heute nur administrator-only und betriebsweit (012/013/025); Migration 028 baut ihn einmal fuer Handy und Web (D-062). Der Product Owner hat entschieden, T-059 vollstaendig zu bauen, die APK kommt danach. | ✓ |
| **T-063** | **Ein Tap ist binnen Minuten extern gesichert (Befund 18.09.)** | `archive_timeout` ist nirgends gesetzt; PostgreSQL schliesst die WAL-Datei erst bei 16 MB. Folge: der Waechter meldet „WAL-Archivierung steht", und T-052 haelt die Warteschlange des Handys tagelang. `archive_timeout=60s` versioniert in beiden Compose-Dateien, Monitor-Test, MONITORING.md. Keine Absenkung des Alarmfensters. Brief in TASK.md. | 1 |
| **T-069** | **Die Verwaltung beendet eine vergessene laufende Zeit (D-071)** | Aenderung am Lebenszyklus: Administrator (spaeter Standortleitung) beendet die laufende Zeit eines Mitarbeiters mit Endzeit und Grund; der naechste Tap beginnt danach korrekt neu; Offline-Abgleich und T-052 beruecksichtigt. Loest auch den bekannten P2 „unbegrenzter vergessener Stopp". Pilotmonat 1, neben T-050. | 2 |
| **T-071** | **Nach dem Deploy bcd903d: Betreiber-Web sendet keine Anfragen; Deploy prueft Betreiber-Web nur einmal** | `fetch` ohne Bindung (Browser-TypeError), echter Browser-Rauchtest; Wiederholung der Betreiber-Pruefung bis zum Zertifikat. | 1 |
| **T-072** | **iPhone Stufe 1: App auf dem iPhone mit Scan in der offenen App (D-081)** | iOS-Einstellungen (Bundle-ID, NFC-Berechtigung, Texte), Scan ueber die Tag-Seriennummer in einer Core-NFC-Sitzung bei offener App (gleiche Identitaet wie Android, kein Server- oder Tag-Umbau), Offline und Warteschlange wie Android, Build fuer TestFlight. Erst Machbarkeit am Code und an den Tag-Typen belegen, dann bauen. | 1 |
| **T-073** | **iPhone Stufe 2 und faelschungssichere Karten (D-037, D-081, D-088)** | NFC-Karten mit NTAG 424 DNA und SUN: jede Beruehrung liefert eine einmalige, vom Server gepruefte Adresse. Dieselbe Adresse traegt das Erfassen ohne geoeffnete App auf dem iPhone (Universal Link, Apple-Datei auf der Tag-Domain). Neue Tag-Evidenz neben bzw. statt der Seriennummer, Schluesselverwaltung je Karte, Karten beim Pilotkunden werden getauscht. Nach dem Pilot, vor dem zweiten Kunden. | 3 |
| **T-074** | **Verwaltung und Betreiber-Bereich am Handy (D-086)** | Entwurf vom PO am 23.09. abgenommen (`ADO/01_Architecture/Mobil_Entwurf/`). Ab 360 px gleiche Funktionen wie am PC: Leiste unten mit „Mehr“, Tabellen als Karten, Bestaetigungen als Blatt von unten, TOTP und Einladung `/willkommen` ohne Zoomen; am PC unveraendert. Nachweis per Layouttest im echten Browser (360/390/768/1440 px) und Bildschirmfotos. Der naechste Deploy wartet darauf. | 1 |
| **T-075** | **Paket mit weicher Grenze (D-087)** | Paketgroesse je Betrieb im Betreiber-Bereich setzen und protokolliert aendern; alle aktiven Zugaenge zaehlen; Hinweis in der Verwaltung ueber dem Paket; Markierung und hoechste Monatszahl je Betrieb im Betreiber-Bereich fuer die Rechnung. Nichts wird gesperrt. Pilotmonat 1, vor der ersten Rechnung. | 2 |
| **T-072b** | **iPhone: gelesener Tag geht beim Schliessen der Apple-Sitzung verloren (Geraeteabnahme 24.09.)** | Apple zeigt den Haken, die App meldet „NFC nicht verfuegbar“, der Server erhaelt nichts; „Tag zuordnen“ ebenso. Erst Ursache an Bibliothek und React Native belegen, dann Ergebnis und Aufraeumen der Sitzung trennen, ohne die Exklusivitaet aufzugeben; Diagnose ohne Seriennummern in der macOS-Konsole. Nur App, danach neuer iPhone-Build. | 1 |
| **T-076** | **Kontowechsel am Geraet, wenn alles bestaetigt ist (ADR-0012)** | Heute sperrt `bindOwner` ein zweites Konto dauerhaft. Kuenftig: Abmelden, anderes Konto anmelden, sobald alle Vorgaenge des bisherigen Kontos serverseitig bestaetigt sind; sonst verstaendlicher Hinweis und zuerst abgleichen. Neue Geraeteidentitaet je Konto, keine Neuzuordnung fremder Evidenz. Dazu `ios.config.usesNonExemptEncryption: false`, damit TestFlight nicht mehr nach der Verschluesselung fragt. Nur App. Vor dem Pilot. | 1 |
| **T-077** | **Reiter „Meine Zeiten“ fuer Administrator und Standortleitung (D-090)** | In der App zusaetzlich zum Reiter Mitarbeiter: Erfassen, Meine Zeiten, Mitarbeiter, Tags. Eigene Zeiten mit einem Tipp, gleiche Daten und Rechte wie heute unter der eigenen Person. Nur App; zusammen mit T-076 in einem Build. Vor dem Pilot. | 1 |
| **T-078 ✓** | **Der Image-Bau haengt nie am Cache (D-094) — abgeschlossen `3a21807`** | Am 24.09. brach der Image-Lauf fuer `130d115` nach 20 Minuten ab, weil der Export in den GHA-Cache hing. Jetzt ohne GHA-Cache, Zeitgrenze je Bau-Schritt (7/6/3/5/3 min, Job 27), Test erzwingt beides. Erster Lauf ohne Cache 3:29 min statt 5:44 mit Cache. | ✓ |
| **T-079 ✓** | **Kundensicht (D-093, D-095) — abgeschlossen `6c7007d`, ausgeliefert 25.09.** | Erfolgsmeldungen mit Art, Kalender mit Pausenabzug wie der Export (Migration 034), Alltagssprache, Export-Beschriftung aus dem echten Zeitfenster, Willkommensseite mit naechstem Schritt, Datum und Uhrzeit getrennt, Startseite ehrlich. Offen: Monatsgrenzen, Chunk-Warnung (P3). | ✓ |
| **T-080** | **Die Standortleitung scannt (Geraeteabnahme 25.09.)** | Die App nimmt Offline-Freigaben nur fuer Administrator und Beschaeftigte an (Vertragstyp, Lease-Parser, lokale SQLite-Pruefungen und CHECK); der Server stellt sie seit 020 auch fuer die Standortleitung aus. Rolle aufnehmen, lokales Schema V6 mit Umbau der Tabelle ohne Datenverlust, Rotnachweis in App und PostgreSQL, danach ein App-Build. Brief in TASK.md. | 1 |
| **T-081** | **Beschaeftigte nach Standort (Wunsch PO 25.09.)** | Aufgegangen in T-100 (vor dem Pilot). | → T-100 |
| **T-082** | **Pause auf dem Erfassen-Bildschirm (D-096)** | Aufgegangen in T-103 (D-112, vor dem Pilot). | → T-103 |
| **T-083 ✓** | **Die Sicherung bleibt kurz, der Waechter passt sich an — abgeschlossen `e13916b`, ausgeliefert 27.09.** | Befund 25.09.: stuendliche Sicherungen 10 bis 44 min bei winziger Datenbank (je Stunde ein Basisarchiv, je WAL-Segment ein Borg-Archiv, Aufraeumen nur sonntags, drei getrennte Borg-Caches). Jetzt ein gemeinsamer Cache unter der vorhandenen Sperre, taegliches Aufraeumen nach erfolgreicher Sicherung mit Trockenlauf-Schutz fuer die gepruefte Basis, `borg compact`, Waechter toleriert das Doppelte der letzten Dauer (10 bis 55 min), Status zaehlt Archive. Wirkung in `taptime-status` nachtragen; neue Statuszeilen nach dem Konsolenschritt mit T-024. | ✓ |
| **T-084 ✓** | **Reiter „Kunden“ mit geleisteten Stunden (D-097, D-099) — abgeschlossen** | App und Web, alle Rollen. Liste der Kunden, antippen zeigt die Stunden im gewaehlten Monat (laufender Monat vorgewaehlt): Administrator alle Kunden, Standortleitung die Kunden ihres Standorts, jeweils Summe und je Person; Mitarbeiter die Kunden seines Standorts nur mit eigenen Stunden, sonst 0. Ein neuer Leser in SQL mit derselben Formel wie Kalender und Export (D-095), Grenzen in SQL, nicht nur in der Oberflaeche. Vor dem Pilot, nach T-086/T-087. | ✓ |
| **T-085 ✓** | **Monatskontingent je Kunde, Hinweis ab 90 % (D-097) — abgeschlossen `9c2df50`** | Optionales Feld „Stunden pro Monat“ am Kunden, eintragen durch Administrator und Standortleitung (eigener Standort). Im Reiter „Kunden“ „32 / 40 h“ mit Balken, ab 90 % markiert, ab 100 % „ueberschritten“; Hinweis beim Oeffnen von App und Web, einmal je Kunde und Monat; Mitarbeiter sehen nichts davon. Keine Push-Nachricht. Baut auf T-084 auf. | ✓ |
| **T-086 ✓** | **Kunde anlegen mit Standort, auch am Handy und durch die Standortleitung (D-097) — abgeschlossen `2602ab7`** | Befund aus dem Code (28.09.): Bei eingeschalteten Standorten scheitert „Kunde anlegen“ am Commit, weil der neue Kunde noch keinen Standort hat (019, verzoegerte Pruefung). Anlegen und Standort in einer Transaktion; Standortleitung darf im eigenen Standort anlegen (SQL-Grenze wie T-060); in der App „+ Neuer Kunde“ direkt in „Tag zuordnen“. Rotnachweis zuerst. Vor dem Pilot, zusammen mit T-087. | ✓ |
| **T-087 ✓** | **Kalendertag antippen springt zu den Zeiten (D-097) — abgeschlossen `2602ab7`** | App: Tippen auf einen Tag scrollt zur Tagesansicht darunter (bei reduzierter Bewegung ohne Animation). Web: in der schmalen Ansicht, wo die Tagesliste unter dem Kalender steht, ebenso. Zusammen mit T-086. | ✓ |
| **T-088 ✓** | **Zeiteintrag loeschen = stornieren (D-098, D-100) — abgeschlossen** | Am beendeten Eintrag „Zeiteintrag loeschen“ in App und Web; Administrator alle, Standortleitung eigene und die ihres Standorts, Mitarbeiter eigene. Pflichtgrund (Doppelt erfasst, Fehlscan, Sonstiges mit Text), sofort wirksam. Append-only als Korrektur: zaehlt danach in Kalender, Summen, Kunden-Stunden, Kontingent und Export nicht mehr, bleibt in der Historie sichtbar. Grenzen in SQL. Vor dem Pilot, nach T-085. | ✓ |
| **T-089 ✓** | **Der Waechter meldet nur echten Stillstand und nennt die Ursache — abgeschlossen `537af63`** | Basis ueber die ohnehin geladene Archivliste statt `borg info`; ein laufender Durchlauf wird mit fester Obergrenze (600 s) toleriert; Meldung mit Ursache und Uhrzeit. Ausgeliefert mit dem naechsten Deploy. | ✓ |
| **T-090 ✓** | **Lohnexport v4 erreichbar, Projekt mit Standort anlegen, Anlegen ohne Doppel — abgeschlossen `0230188`, ausgeliefert 28.09.** | Caddy leitet alle Versionspraefixe weiter (Test ueber die echte Grenze), Dateiname aus der Version, Projekt und Standort in einer Transaktion (039), Wiederholung ohne Doppel fuer Kunde, Projekt, Standort. | ✓ |
| **T-091** | **Standortmodus nach D-102 (F-006, F-008, F-024, F-074, F-145)** | Allgemeine Arbeitszeit standortfrei, Pausen folgen der laufenden Zeit, Lease nur mit Zielen der eigenen Standorte, Standort gelesener Ereignisse, Testmatrix mit eingeschalteten Standorten fuer jede Ereignisart und jeden Verwaltungsweg. F-014 so gewollt (D-107). Brief in TASK.md. Vor dem Pilot. | 2 |
| **T-092** | **Austritt nach D-101 (F-004, F-066, F-101)** | Zugangsentzug beendet laufende Zeit oder Pause als Verwaltungsstopp; Austrittsmonat bleibt sichtbar, nachtragbar, korrigierbar, exportierbar; Rueckmeldung bei inzwischen entzogener Person. Vor dem Pilot. | 1 |
| **T-093 ✓** | **Sicherung: taegliches Aufraeumen wirkt, Fehler werden sichtbar — abgeschlossen `19a363d`** | Sonntagspruefung auf die letzte Basis des Vortags; Aufraeumen schuetzt die neueste gepruefte Basis, die Borg behaelt; Aufraeumfehler oder 8 Tage ohne Erfolg lassen die Sonntagspruefung scheitern; Waechter wartet bei laufender Pruefung bis 90 min; Borg-Fake gegen echtes Borg verglichen. Ausgeliefert mit dem zweiten Deploy. | ✓ |
| **T-094 ✓** | **Einladung und Passwort — abgeschlossen `947ac51` (D-110, D-113)** | Vorhandene Konten nur aus einer Einladung (040), eine gemeinsame Antwort fuer Adressen ausserhalb des eigenen Bereichs, „Einladung erneut senden“ (10-min-Sperre, Protokoll), „Passwort vergessen“ in der App ueber die Webseite, Einladen gesperrt bei unsicheren Supabase-Einstellungen, Linkdauer 1 h. Ausgeliefert mit dem zweiten Deploy. | ✓ |
| **T-095** | **App: keine Warteschlange ohne Ausweg, neue Ziele sofort scanbar (F-029, F-031, F-047, F-075, F-103)** | Dauerhaft abgelehnte oder nicht verstandene Antworten werden ein sichtbarer Zustand statt endloser Wiederholung; manuelle Erfassung meldet „gespeichert“, wenn sie gespeichert ist; Wiederholungsfrist robust gegen Uhrkorrektur; Diagnose bleibt erhalten. Befund PO 02.10.: in einem neuen Betrieb mit nur dem Administrator ging Scannen und manuelles Erfassen erst nach Anlegen eines Mitarbeiters; nachstellen, vermutlich veraltete Offline-Liste, nach jedem Anlegen neu laden. Vor dem Pilot. | 2 |
| **T-096** | **App: Version, Neuinstallation, Sicherung, Paketname (F-028, F-032, F-048, F-052, F-104, F-105, F-121, F-143)** | App sendet Plattform, Build und Commit, Server kann „bitte aktualisieren“ sagen; iOS-Neuinstallation und Geraetewiederherstellung ohne Dauerschutzzustand; erster Start atomar; Paketname im Tag vor dem ersten Pilot-Tag festlegen (PO). Vor dem Pilot. | 2 |
| **T-097** | **Prueffaelle vollstaendig (F-015, F-038, F-063, F-068, F-073)** | Pausenfaelle in der Pruefliste; Gruende und Rollen aus einer Quelle mit Parser, unbekannte Werte einzeln markiert; Blaettern ab 100 Faellen; „Korrigieren“ bietet nur Eintraege der Person. Vor dem Pilot. | 1 |
| **T-098** | **Image-Workflow (F-012, F-057, F-058, F-085)** | Ausloesebedingungen des Veroeffentlichungsjobs, Actions per Commit-SHA, Aufraeumen schuetzt referenzierte Manifeste, Reparaturbau unabhaengig von der Produktion. Vor dem Pilot. | 1 |
| **T-099** | **Pilotgroesse und Suche** | Test mit Daten in frogs-Groesse (5 Standorte, 200 Personen, 500 Kunden und Tags, ein voller Monat) ueber jede Ansicht in App, Web, Betreiber-Bereich und den Lohnexport; was scheitert oder zu langsam ist, wird behoben (u. a. F-018, F-043). Suchfeld auf dem Server fuer Beschaeftigte, Kunden, Tags und jede Kundenauswahl (Tag zuordnen, Nachtragen, manuell starten). Supabase-Grenzen fuer Mails und Anmeldungen vor der Ausweitung anheben. Vor der Ausweitung auf alle Standorte; vor dem Start, falls frogs mit allen beginnt (CEO-Termin). | 2 |
| **T-100** | **Kunden-Verwaltung in der App (D-104, D-108)** | Reiter „Kunden“: „+ Kunde hinzufuegen“ mit „NFC-Tag zuordnen“ oder „Nur anlegen“, umbenennen, loeschen (deaktivieren, Tag frei, gesperrt bei laufender Zeit), auch im Web; „+ Neuer Kunde“ raus aus „Tags“; „Tag pruefen“ in „Tags“. Vor dem Pilot. | 2 |
| **T-101** | **Pflichtfelder sichtbar (D-109)** | Jedes Formular in App und Web markiert fehlende Pflichteingaben am Feld mit Hinweis; Tests je Formular. Vor dem Pilot. | 1 |
| **T-102** | **Beschaeftigte nach Standort, Stunden des Monats (D-105, T-081)** | App und Web: Beschaeftigte zuerst nach Standort, Spalte „Diesen Monat“ (nur beendete Eintraege, Summe je Seite in einer Abfrage). Vor dem Pilot. | 1 |
| **T-103** | **Erfassen: laufende Zeit sichtbar, mit einem Klick beenden (D-112, T-082)** | App „Erfassen“ und Web „Manuell“: oben die laufende Zeit oder Pause mit „Zeit beenden“, „Pause starten“/„Pause beenden“; ohne laufende Zeit Ziel waehlen und „Zeit starten“; eindeutige Rueckmeldung. Gleiche Ereignisse wie heute. Vor dem Pilot. | 1 |
| **T-068** | **Betreiber-Bereich: Betriebe anlegen und ueberblicken (D-068, D-074, D-075)** | Technischer Entwurf `ADO/01_Architecture/Betreiber_Entwurf/README.md` (22.09.). **T-068a Server:** Betreiber-Konten ausserhalb der Betriebe, TOTP (`aal2`), Betrieb anlegen mit Einladung des ersten Administrators, Pausieren an der zentralen Aufloesung, Uebersicht nur mit Zahlen, eigenes Protokoll, `taptime-operator-grant`. **T-068b Web:** `apps/operator-web` auf `betreiber.tb-infra.de`, CI/Image, Caddy, Deploy. Vor dem Pilot. | 3 |
| **T-070** | **Der Archivierer ruht billig; der Waechter laesst nach der Sicherung Luft (Befund 22.09., D-072)** | Leerlauf ohne Storage-Box-Zugriff; Vollabgleich bei Arbeit, sonst hoechstens alle 15 min; einmalige Nachholzeit von fuenf Minuten nach Sicherungsende; Journal mit Dauer je Phase. Brief in TASK.md. | 1 |
| **T-067 ✓** | **Die Archivierung erzeugt ihre Arbeit nicht mehr selbst (Befund 21.09., D-066)** | `archive_timeout` wieder heraus; der Archivierer wechselt selbst, wenn eine Anforderung im offenen Segment liegt; keine doppelte Fernabfrage fuer quittierte Archive; Waechter zaehlt ab Sicherungsende und alarmiert bei Sicherung ueber zehn Minuten; eine Journalzeile je Durchlauf. Brief in TASK.md. | 1 |
| **T-066** | **Zeit nachtragen, Kommentar, Aendern durch den Administrator (D-067, D-069, D-070)** | Nachtragen ohne WorkEvent als eigene Herkunft; Mitarbeiter im laufenden und Vormonat, Administrator ohne Grenze mit Grund; Kommentar je Eintrag; Mitarbeiter sieht Aenderungen; Administrator aendert und traegt nach auch im Handy; Kopfzeile E-Mail und Rolle; Export v4; neue Felder nur fuer neue Clients. Server, App, Web. Standortleitung mit T-062. | 2 |
| **T-065 ✓** | **Abnahme am Geraet 21.09.: Kalender, Offline-Start, Manuell-Knopf — umgesetzt `ae6e0bf`** | Monat ohne Wischen; Offline-Erfassung nach zwei statt sechzig Sekunden, Identitaet aus der letzten bestaetigten Sitzung; „Manuell starten" auf Erfassen, offline auch Pause. Geraeteabnahme gemeinsam mit T-066. | ✓ |
| **T-064 ✓** | **Das Abbild baut, was die Anwendung braucht — abgeschlossen `7f0012e`** | Eine Liste der Vertragspakete (`build:contracts`) fuer CI und beide Dockerfiles; Waechter leitet die Pflichtmenge aus den Paketdateien ab. | ✓ |
| **T-049 ✓** | **Das Web fuer alle drei Rollen — abgeschlossen `adc7258`** | Migration 029 gibt der Web-Sitzung Rolle und zwei Bereiche fuer jede lebende Mitgliedschaft; Rollenschale je Sitzung, Uebersicht mit Aktiv-Kachel, Personenseite mit Kalender aus `packages/core` (D-062), Mitarbeiter mit Meine Zeiten und Manuell. Pruefen bleibt Administrator (D-064). Ansichten getrennt geladen. Metro-Reparatur `dcdaebb`: relative Importe in Core ohne `.js`. | ✓ |
| **T-062** | **Pruefen im eigenen Standort fuer die Standortleitung (D-059, D-064, D-069)** | `has_current_time_review_administrator_v1` (012) und `TimeReviewCoordinator.withAdministrator` verlangen heute `administrator`; D-059 sieht Pruefen fuer die Standortleitung vor. Muster ist T-060: eine SQL-Autoritaet mit Standortgrenze (Zielperson im eigenen Standort), Backend gibt die echte Rolle weiter, Sitzung traegt `review_items` dann auch fuer die Standortleitung. Rotnachweis ueber die Standortgrenze und einen zweiten Betrieb, unabhaengiges Review. **Vorgezogen (D-091, 24.09.): vor dem naechsten App-Build; Umfang pruefen, korrigieren, nachtragen, beenden im eigenen Standort, App und Web; Migration 033 und Deploy.** | 3 |
| **T-061** | **Feinschliff am Geraet: Rand, Symbole, Tap-Moment (Gerätetest 18.09.)** | Randlose Darstellung mit Systemleiste im Grundton und Sicherheitsabstaenden statt fester Pixel; echte Vektorsymbole statt zusammengesetzter `View`-Striche (Lucide, ISC); Ring-Variante B (staerker, heller, mit Leuchten); Durchgang durch alle Bildschirme gegen `UI_Leitlinien.md` §13. Nur `apps/mobile`. Abnahme mit neuer APK. Brief in TASK.md. | 2 |
| **T-060 ✓** | **Standortleitung darf im eigenen Standort Tags zuordnen — abgeschlossen `1d0a4e9`** | Einladung (T-047-Route, `employee_account_invitation_v1`) und Tag-Zuordnung (`NfcTagReassignmentCoordinator`, Admin-Write-Session) fuer `standortleitung` oeffnen, begrenzt auf den eigenen Standort; Rolle der Eingeladenen nur `employee`. RLS und SECURITY-DEFINER-Pfade, nicht nur Oberflaeche. Rotnachweis: Standortleitung A kann in Standort B weder einladen noch zuordnen, und keine Standortleitung anlegen. Unabhaengiges Review (Mandantentrennung). **Umgesetzt 18.09.: Migration 027 entscheidet die Standortgrenze in SQL (Kunde braucht ein Arbeitsziel im Standort); Backend setzt die echte Rolle, Receipts speichern sie; Sitzung traegt `nfc_setup_available`. Einladen war in 020/026 bereits standortbegrenzt offen. Kunden anlegen, Standort-Befehle und `setup_available` bleiben Administrator. CI gruen.** | ✓ |
| **T-036 ✓** | **Zeitrichtigkeit — abgeschlossen (B02, D-056)** | Technisch und unabhaengig APPROVED, `bc675d0` auf main, CI gruen. Gemeinsame Berliner Zone, korrekte Monatsgrenzen und feste Web-/CSV-Anzeige. Beide Vertrags- und SQL-Grenzen tragen 31 Tage plus eine Stunde; Live-Nahttests und Migration-025-Aufstieg geprueft. Voraussetzung fuer T-048, T-049 und T-050 erfuellt. Mobile-Geraeteanzeige bleibt P2; kein Deploy. | — |
| **T-037** | **Reparaturweg und die ungeprüften Befunde (B06, dann B08, B09, B07)** | `container-image.yml:194–201` holt die Schutzliste mit `curl --fail` unter `set -euo pipefail` vor der Veröffentlichung bei `:268` aus der Produktion; bei deren Ausfall lässt sich kein Reparaturabbild veröffentlichen. B08 (Sicherung und Vergleichsliste aus verschiedenen Datenständen), B09 (Auth-Widerruf sperrt die eigene API nicht sofort) und B07 (kein gemeinsames Verbindungsbudget) zuerst verifizieren, dann bewerten. | — |
| **T-030** | **iOS-Weg klären — nur Recherche, kein Code** | iOS ist nach D-037 festes Ziel; Tap plus Bestätigung ist akzeptiert. Zu klären sind NDEF-Datensatz, Universal Link, Bauprofil und die technische Einbindung in das trigger-agnostische Modell. | 1 |
| **T-031** | **Caddy-Rückweg (D-085) und Startseite hinter Passwort (D-083)** | Teil A: eigener Caddy-Rückweg unabhängig vom Archivvertrag (Befund 23.09.). Teil B: Entwurf vom PO am 23.09. abgenommen (`ADO/01_Architecture/Startseite_Entwurf/`, jede Aussage am Code belegt). Unter `tb-infra.de` mit Basic Auth, Zugang gibt Tim an Interessenten; frei nur `/tag` als Hilfeseite fuer Tags ausserhalb der App. Keine Cookies, kein Tracking, Schriften selbst ausgeliefert, noindex. Eigenes Abbild und Deploy-Schritt wie Betreiber-Web; Zugang setzt root mit `taptime-landing-password`. **T-031b** danach: oeffentlich mit Impressum (§ 5 DDG), Datenschutzhinweisen, Anfrage-Adresse und Pilotbedingungen — braucht Anschrift fuers Impressum und Entscheidungen des PO. | 1 |
| **T-018** | Installierbare App per Direktlink | Für den eigenen Test | 2 |
| **T-023** | **Vorschlag:** Übersicht als Arbeitsvorrat statt Zustandsbericht | Die Übersicht zählt heute, was geladen ist. Sie soll zeigen, **was ohne den Administrator stehen bleibt**: offene Prüfungen, manuell erfasste Zeiten vor der Freigabe, laufende Arbeitszeiten. Summen über Projekte brauchen eine echte Auswertung im Backend auf Basis von `effective_work_duration_seconds_v1` — geladene Seiten zu addieren ergibt eine Zahl, die falsch ist und richtig aussieht. **Noch keine Entscheidung.** Der Inhalt wird vom Pilotgespräch bestimmt (D-020), nicht geraten. | 4 |
| **T-029** | **Vorschlag:** Die Ansichten folgen der Arbeit | Die Arbeitszeiten-Tabelle zeigt sieben Spalten — darunter *Herkunft* und *Korrekturstand* aus der Systembuchhaltung — und **nicht die Dauer**, also die einzige Zahl, die ein Inhaber sonst im Kopf ausrechnet. Die Liste ist flach, die Erfassungsart steht als Wort statt als Zeichen. **Noch keine Entscheidung:** Zuerst muss beantwortet sein, was jemand dort tun will — sehen wer vergessen hat zu stempeln, Stunden einer Person prüfen, korrigieren, exportieren, oder sehen wer gerade arbeitet. Das sind fünf Bildschirme; heute versucht einer, alle fünf zu sein. | 4 |
| **T-019** | Dokumente an die Wirklichkeit angleichen | Vier Dokumente beschreiben, was es nicht gibt | 1 |
| **T-021 ✓** | **Zustellbarkeit — abgeschlossen (D-057)** | Supabase versendet über Brevo Custom SMTP; Domain `tb-infra.de` bei INWX mit Brevo-Code, zwei DKIM-CNAMEs und DMARC authentifiziert. Am 17.09. kam die Zurücksetzungs-Mail als „Taptura“ an. Die Zwei-Mails-pro-Stunde-Grenze gilt nur noch für den eingebauten Versand, der nicht mehr benutzt wird. | 1 |

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

---

## Analyse-Pakete nach T-098 (D-103)

Neutral benannt; die Einordnung aller 191 Befunde liegt nur lokal in `.audit-2026-09/`. Nummern (T-…) bekommt ein
Paket, wenn es startet; grosse Pakete werden dann geteilt.

| Paket | Inhalt | Befunde | Zeitpunkt |
|---|---|---|---|
| B01 | Lohnexport inhaltlich (laufende Eintraege, Spalten, Verwaltungsstopp, Zeitbudget; PO-Fragen) | F-017, F-043, F-061, F-140 | vor dem ersten Lohnexport |
| B02 | Plausibilitaet an der Servergrenze | F-010, F-016, F-062, F-081, F-095, F-099 | Monat 1 |
| B03 | Admin-Web: Bedienung und Robustheit | F-018, F-040, F-041, F-042, F-093, F-094, F-111, F-112, F-133, F-156 | Monat 1 |
| B04 | App: Bedienung und Texte | F-034, F-035, F-106, F-107, F-149, F-150 | Monat 1 |
| B05 | App: Sitzung und Hintergrund | F-011, F-030, F-033, F-147 | Monat 1 |
| B06 | Server-Robustheit | F-009, F-044, F-045, F-046, F-080, F-113, F-115, F-116, F-117, F-118 | Monat 1 |
| B07 | Schema: Eigentuemer, Rechte, Views, append-only | F-013, F-087, F-088, F-089, F-090, F-091, F-154, F-155, F-169 | Monat 1–2 |
| B08 | Idempotenz und Sperrreihenfolge | F-097, F-098, F-100, F-110, F-134, F-137 | Monat 2 |
| B09 | Engine: Duplikatfenster, Verwaltungs-Trigger | F-022, F-138, F-139 | Monat 2 |
| B10 | Cursor fuer Ziele und Projekte | F-019, F-096 | Monat 2 |
| B11 | Deploy-Controller: Fehlersemantik, Protokoll, Tests unter errexit | F-036, F-037, F-059, F-077, F-108, F-128, F-184 | vor dem Deploy danach |
| B12 | Sicherung und Monitoring: Zeitgrenzen, Totmannschalter | F-049, F-055, F-056, F-084, F-120, F-122, F-123 | Monat 1 |
| B13 | Sicherung vereinfachen, PITR-Reichweite (PO/TL) | F-053, F-060, F-125, F-182 | Monat 2–3 |
| B14 | CI und Migrationen | F-109, F-126, F-127, F-129, F-130, F-131, F-132 | Monat 2 |
| B15 | Rechtstexte an den Code angleichen | F-025, F-026, F-050, F-082, F-083, F-102, F-163 | vor AVV |
| B16 | Doku straffen | F-064, F-065, F-135, F-142, F-144, F-151, F-152 | Monat 1 |
| B17 | Linter, Formatter, Tests mit Verhalten | F-164, F-165, F-166 | nach Pilotstart |
| B18 | HTTP-Schicht: Routentabelle, Transaktionshuelle | F-157, F-158, F-162, F-173, F-174 | nach Pilotstart |
| B19 | Admin-Web-Struktur | F-170, F-171, F-172, F-190, F-191 | nach Pilotstart |
| B20 | Kernkette einmal, geteilte Validierung | F-071, F-160, F-161 | nach Pilotstart |
| B21 | Schema-Snapshot und Rueckbau | F-167, F-168, F-177, F-178, F-185, F-187, F-188, F-189 | nach Pilotstart |
| B22 | Demo-Pipeline und toter Code | F-086, F-175, F-176, F-180, F-181, F-183, F-186 | nach Pilotstart |
| B23 | Aufbewahrung und Wachstum | F-051, F-119 | mit T-016 |
| B24 | Kalender und Zeitzone | F-023, F-072, F-141, F-159 | nach Pilotstart |

Offene Fragen an frogs (CEO-Termin): Startumfang, Chips gleich als NTAG 424 DNA (D-111), Tags je Schueler oder Raum, Ablauf einer Stunde, Gruppennachhilfe (Vorschlag: Teilnehmer an einem Zeiteintrag, Lehrer zaehlt einmal, jeder Schueler einmal mit Gruppengroesse), Kontingente, Geraete, Lohn und Rechnungen (Business Central; erst fester Abrechnungs-Export, spaeter lesende API), Termine.

Offene PO-Fragen: F-069 (Reaktivieren geloeschter Kunden, Projekte, Standorte), F-146 (Leerlauf-Abmeldung im Web), F-148 (eigene laufende Zeit
beenden je Rolle), F-153 (Wiederaufnahme nach Entzug). F-021 liegt in T-055; F-179 ist mit T-084 erledigt.
