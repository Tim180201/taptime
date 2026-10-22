> **Hinweise für den Arbeitgeber (nicht mit ausgeben)**
>
> **Entwurf des Technical Lead, keine Rechtsberatung.** Vor Ausgabe fachanwaltlich prüfen lassen.
> **Stand 22.10.2026 · Systemstand: Migration 062, bis T-104c**
>
> Die Vorlage umfasst noch auszuliefernde Funktionen von Deploy 8 und neuen App-Builds.
> Vor Ausgabe mit dem tatsächlich eingesetzten Stand abgleichen und nur den Aushang unterhalb
> dieses Kastens ausgeben. Alle Platzhalter vervollständigen. Datenschutzkontakt entsprechend
> der Bestellung benennen. Rechtsgrundlagen für den Betrieb prüfen und konkret eintragen,
> insbesondere Art. 6 Abs. 1 DSGVO, gegebenenfalls § 26 BDSG, Aufzeichnungspflichten und
> Betriebsvereinbarung. Pflichtangaben, Folgen fehlender Angaben, gegebenenfalls berechtigte
> Interessen sowie Widerspruchs- und Widerrufsrechte ergänzen. Eine pauschale Aussage zur
> Einwilligung ersetzt diese Prüfung nicht. Empfänger, Fristen und Meldeweg festlegen.
>
> **Vor echten Daten offen:** AVV mit dem Softwareanbieter vervollständigen; für Hetzner,
> Supabase und Brevo gilt jeweils: AVV noch nicht abgeschlossen (PO, 22.10.2026).
> Drittlandfrage zu Supabase mit US-Mutter (D-006), tatsächliche Zugriffe, Garantien und deren
> Bezugsmöglichkeit fachanwaltlich klären. Es gibt noch keinen allgemeinen Lösch-/Auskunftsweg
> und keine automatische Löschung fachlicher Daten (T-016). Fristen, Löschaufträge, Umgang
> nach Vertragsende und erneute Löschung nach Wiederherstellung bleiben offene Aufgaben.
> Die fehlende Umsetzung hebt Betroffenenrechte nicht auf. Die mindestens zweijährige Frist
> bestimmter Arbeitszeitnachweise ist keine technische Löschfrist; weitere Pflichten prüfen.
>
> Die Anzeige von Zielnamen auf dem gesperrten Handy ist bewusst vorgesehen (D-147).
> Bewertung und Einsatz erläutern, insbesondere bei minderjährigen Kunden. Kunden brauchen
> eine eigene Information; dieses Blatt richtet sich an Beschäftigte. Das Produkt bleibt
> branchenunabhängig. Namen und Freitext können sensible Angaben enthalten.
>
> Technische Einzelheiten zur Vollständigkeit: Anmeldestand bedeutet erste/letzte erfolgreiche
> Sitzungsabfrage, auch beim Öffnen; kein vollständiges Passwort-Anmeldeprotokoll. Offline-Belege
> umfassen Installation, Sequenz, Geräteuhr/Bootbeleg, Karten-/Ereigniskennungen und Übertragungs-/
> Sicherungsstatus. SQLCipher verschlüsselt die Offline-Datenbank. Anmeldedaten liegen
> gerätegebunden geschützt, auf iOS nur entsperrt zugänglich. Für Sperrbildschirm-Aktionen
> speichert der Server nur einen Hash; die gesonderte Berechtigung gilt höchstens 24 Stunden
> und nur für die laufende Zeit. Android schützt sie mit dem Keystore, iOS im Schlüsselbund
> nach erstem Entsperren; der iOS-Anzeigezustand liegt zusätzlich in einer geschützten Datei
> ohne Backup. Betreiberprotokolle erfassen Akteur, Betrieb, Aktion, Zeitpunkt und gegebenenfalls
> Grund/Paketänderung. Auch kleine Aggregate können Personen erkennen lassen.
>
> Sicherungen: aktive Cloud-Tageskopien der gesamten Serverplatte in Nürnberg einschließlich
> Datenbank, Konfiguration und Zugangsdaten, derzeit gegen 10:45 UTC; sieben Plätze, die älteste
> Kopie wird bei einer neuen entfernt. Höchstens sieben Tage bei fortlaufend täglicher Rotation;
> kein davon unabhängiger Ablauf. Keine Cloud Snapshots laut PO. Gesonderte verschlüsselte
> Borg-Sicherungen auf der Storage Box in Falkenstein mit geschützter geprüfter Basis;
> manuelle Storage-Box-Schnappschüsse und logische Alt-Archive ohne automatische Höchstfrist.
> Kein belegter allgemeiner Ablauf nach sechs Monaten. Diagnoseaufbewahrung in journald:
> 14 Tage und Speicherobergrenze; Datenbank-Audits separat. Quellen:
> [Hetzner-FAQ](https://docs.hetzner.com/cloud/servers/backups-snapshots/faq/),
> [§ 16 Abs. 2 ArbZG](https://www.gesetze-im-internet.de/arbzg/__16.html).
> Ausgabe: [Ort, Datum] · [Arbeitgeber].

---

# Deine Arbeitszeit: Was wir speichern und wer es sieht

Ab [Datum] erfassen wir deine Arbeitszeit mit [Produktname]. Verantwortlich: [Firma, Anschrift].
Kontakt für Fragen: [Name, E-Mail, Telefon].
Datenschutzkontakt: [Name, Kontakt].

## Warum wir die Daten brauchen

Wir erfassen und prüfen deine Arbeitszeit. Wir ordnen Einsätze zu und bereiten die
Lohnabrechnung vor. Angaben zur Anmeldung und zu deinem Handy helfen bei Zugang und Fehlern.
Zugänge zählen wir zur Verwaltung unseres gebuchten Pakets.
Rechtsgrundlagen: [für unseren Betrieb geltende Vorschriften und Vereinbarungen].
Es gibt keine automatische Rangliste oder Benotung deiner Arbeit.

## Was gespeichert wird

- Dein Name, deine dienstliche E-Mail und Kennungen deines Zugangs. Dazu gehören Betrieb,
  Rolle, Standorte, Berechtigungen sowie Beginn und Ende deines Zugangs.
- Beginn, Ende und Pausen deiner Arbeit. Dazu: Kunde, Projekt oder allgemeine Tätigkeit,
  zugeordneter Standort und wie die Zeit erfasst wurde: per Karte, von Hand, nachträglich,
  durch die Verwaltung oder vom Sperrbildschirm.
- Kommentare, Änderungen, gelöschte Zeiten und ungeklärte Erfassungen: was geändert wurde,
  von wem und wann. Frühere Fassungen bleiben erhalten, auch ein früherer Name.
- Wann du dich zuerst und zuletzt angemeldet hast. Auch das erneute Öffnen der App kann
  diesen Stand aktualisieren. Nicht jede Passworteingabe wird einzeln aufgezeichnet.
- Angaben deines Handys, damit Zeiten auch ohne Internet richtig ankommen: eine zufällige
  Gerätekennung, Reihenfolge und Uhrzeit der Erfassungen, Neustarts, die verwendete Karte
  und ob die Angaben angekommen und gesichert sind.

Für Kunden speichern wir Namen, vereinbarte Stunden, zuständige Mitarbeiter und geleistete
Zeiten. Kunden können auch Schüler und Minderjährige sein. Schreibe in Kommentare und Gründe
nur nötige Angaben. Sensible Inhalte werden nicht automatisch erkannt oder ausgeschlossen.

Die App verschlüsselt gespeicherte Zeiten und schützt deine Anmeldedaten.
Für die Knöpfe auf dem Sperrbildschirm merkt sich das Handy eine eigene Berechtigung und den
Stand der laufenden Zeit. Diese Berechtigung gilt höchstens 24 Stunden und nur für diese Zeit.

## Achtung: Dein Sperrbildschirm zeigt Namen

**Auf dem gesperrten Handy sind Zielname, Zustand und Dauer sichtbar. Wer dein Handy sieht,
kann den Namen des Kunden oder Schülers lesen.** Android zeigt eine laufende Mitteilung;
das iPhone zeigt die Angaben auf dem Sperrbildschirm und gegebenenfalls oben neben der Kamera.
**Pause, Weiter und Beenden sind ohne Entsperren möglich.** Die Herkunft der Aktion wird gespeichert.

Die App verfolgt deinen Standort nicht laufend und nutzt kein GPS. Aus Karte, Arbeitsziel und
betrieblichem Standort kann sich trotzdem dein Einsatzort ergeben. Eine Kartenkennung allein
ist kein sicherer Beweis, dass du vor Ort warst.

## Wer was sehen darf

- **Du:** deine Zeiten, frühere Fassungen, erlaubte Arbeitsziele und deine Stunden je Kunde.
  Eine Kundenzuteilung schränkt andere erlaubte Ziele nicht zusätzlich ein.
- **Standortleitung:** Personen, Zeiten, ungeklärte Erfassungen und Zuordnungen im zugewiesenen
  Bereich, auch die Zeiten anderer Führungskräfte.
- **Administrator:** Zeiten, Zugänge samt Anmeldestand, Einrichtung und aufbewahrte ältere
  Angaben im ganzen Betrieb. Er kann Daten für die Abrechnung ausgeben.
- **Lohnbuchhaltung oder Steuerberatung:** die von uns übergebenen Abrechnungsdaten.
  Empfänger: [Name und Kontakt].
- **Softwareanbieter:** Betriebsname, Status, Anzahlen, letzte Erfassung, gebuchtes Paket, genutzte Zugänge und
  Zustand der Software. Sein Verwaltungsbereich zeigt keine Liste deiner Einzelzeiten oder
  bestehender Mitarbeiternamen und E-Mails. Bei der Einrichtung verarbeitet er Name und
  E-Mail des ersten Administrators. Kleine Anzahlen können Personen erkennen lassen.
  Seine Aktionen werden aufgezeichnet. Für Wartung und Fehlerbehebung können befugte
  Personen außerdem auf Daten zugreifen.

Kollegen ohne Verwaltungsrolle sehen deine Einzelzeiten nicht. Maßgeblich ist die Berechtigung,
nicht die Stellenbezeichnung „Geschäftsführung“.

## Wer die Software und die Speicherung betreibt

Anbieter: Einzelunternehmen Tim Bartz, [Geschäftsbezeichnung, Anschrift, Kontakt].
Er verarbeitet die Daten in unserem Auftrag.

Hetzner betreibt Anwendung und Datenbank in **Nürnberg, Deutschland**. Dort liegen auch tägliche
Kopien der ganzen Serverplatte, meist in einem anderen Rechenzentrum am selben Standort.
Diese Kopien enthalten Datenbank, Einstellungen und Zugangsdaten für den Betrieb der Software.
Weitere **verschlüsselte Sicherungskopien liegen bei Hetzner in Falkenstein, Deutschland**.

**Supabase in Frankfurt** übernimmt die Anmeldung. Das Unternehmen hat eine US-Mutter.
**Brevo** versendet darüber Anmelde-, Einladungs- und E-Mails zum Zurücksetzen des Passworts.
Zugriffe außerhalb der EU: [Empfänger, Schutzmaßnahmen, Bezugsquelle].

ntfy.sh erhält feste Störungsmeldungen, healthchecks.io ein Lebenszeichen. Sie erhalten
keine Arbeitszeiten oder Kundeninhalte, aber Angaben zur Verbindung und zum Empfang der Meldung.
Bei Einladungen werden Angaben zum Betrieb und den beteiligten Zugängen zur Fehlerklärung gespeichert.
GitHub und GHCR liefern die Software und erhalten dabei keine Daten von Mitarbeitern oder Kunden.

## Wie lange Angaben bleiben

Fristen für unseren Betrieb: [Aufbewahrungsfristen je Datenart]. Bestimmte
Arbeitszeitnachweise müssen mindestens zwei Jahre aufbewahrt werden.

**Deine Zeiten und andere Betriebsdaten werden heute noch nicht automatisch gelöscht.**
Auch wenn ein Zugang entzogen, ein Kunde entfernt oder eine Zeit gelöscht wird, bleibt die
frühere Aufzeichnung erhalten. Ehemalige Mitarbeiter und entfernte Ziele bleiben für die
Verwaltung lesbar. Einladungsbelege und Anmeldekonto bleiben auch erhalten.

Technische Fehlerprotokolle sind auf 14 Tage und eine begrenzte Datenmenge beschränkt.
Aufzeichnungen über Änderungen bleiben erhalten. Die täglichen Gesamtkopien in Nürnberg
bleiben bei täglicher Erneuerung **höchstens sieben Tage**. Das setzt neue tägliche Kopien voraus.
Bei den verschlüsselten Sicherungen in Falkenstein werden stündliche, tägliche, wöchentliche und
monatliche Stände aufbewahrt. Gelöscht wird erst, wenn eine geprüfte Sicherung erhalten bleibt.
Zusätzliche Einzelkopien und ältere Sicherungen haben derzeit keine automatische Höchstfrist.
Eine allgemeine Löschung nach sechs Monaten wird deshalb nicht zugesagt.
Unser Ablauf für Löschwünsche und Daten nach einer Wiederherstellung: [vereinbarter Ablauf].

## Deine Rechte und Hilfe bei Fehlern

Du kannst Auskunft, Berichtigung, Löschung, eingeschränkte Nutzung und die Herausgabe deiner
Daten verlangen. Wir prüfen Voraussetzungen und Aufbewahrungspflichten im Einzelfall.
Deine Rechte gelten auch, wenn die technische Umsetzung noch fehlt. Wende dich an den Kontakt oben.
Wann du der Nutzung widersprechen oder eine Einwilligung zurücknehmen kannst: [Angaben].
Du kannst dich bei [Datenschutz-Aufsichtsbehörde, Kontakt] beschweren.

Fehlt eine Zeit oder stimmt sie nicht, kannst du sie im vorgesehenen Zeitraum selbst nachtragen
oder ändern. Eigene Änderungen brauchen keinen Grund. Bei fremden Zeiten muss die Standortleitung
einen Grund nennen; der Administrator kann ihn weglassen. Zum Löschen ist kein Grund nötig.
Ungeklärte Erfassungen prüft die zuständige Verwaltung nach eigenen Begründungsregeln.
Normale Nachträge müssen nicht zusätzlich freigegeben werden.
