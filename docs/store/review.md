# {{APP_NAME}} · Hinweise für die Store-Prüfung

**Entwurf, rechtliche Prüfung mit B15.** Zugangsdaten gehören in das geschützte Prüferformular,
nicht in diese Datei. Die App ist noch nicht eingereicht.

## Zugang

{{APP_NAME}} ist ein Arbeitszeitwerkzeug für eingeladene Personen. Es gibt keine Selbstregistrierung.
Der PO legt vor der Einreichung einen isolierten Demo-Betrieb mit erfundenen Kunden und Personen
an, nimmt die Einladung an und stellt einen dauerhaft während der Prüfung nutzbaren Demo-Zugang
bereit. E-Mail, Passwort und Supportkontakt ergänzt er ausschließlich im Store-Prüferformular.
Kein ablaufender Einladungslink als Prüferzugang. Der PO pflegt den Demo-Betrieb für Rückfragen
und entzieht die Prüferzugänge nach Abschluss bzw. bei Ablösung; keine echten Kundendaten verwenden.

## Ablauf ohne NFC-Karte

1. Mit dem bereitgestellten Demo-Zugang anmelden.
2. Unter „Erfassen“ auf „Manuell erfassen“ tippen, ein Arbeitsziel wählen und „Zeit starten“ verwenden.
3. Pause starten, Pause beenden und die Zeit beenden.
4. Unter „Meine Zeiten“ den heutigen Kalendertag öffnen.
5. Über „Zeit hinzufügen“ eine vergangene Zeit ohne Überschneidung nachtragen.
6. Über den Statuspunkt „Übertragung“ öffnen; dort steht auch „Konto“ mit „Abmelden“.

NFC ist ein zusätzlicher Erfassungsweg. Im Vordergrund verlangt iOS die Systemsitzung nach „Karte
scannen“. Eine Karte muss zuvor im Demo-Betrieb einem Arbeitsziel zugeordnet werden. Auf Wunsch
stellt der PO eine vorbereitete Karte und Anleitung bereit. Es werden keine GPS-Daten abgefragt.
Der Betreiber-Bereich ist eine eigene Webanwendung und gehört nicht zum Demo-Zugang der App.

## Screenshot-Liste

Der PO nimmt nach dem freigegebenen Build auf echten unterstützten Geräten Screenshots auf;
Development kontrolliert Texte und Zuschnitt. Nur synthetische Demo-Daten, keine E-Mail-Adressen
echter Personen. Screenshots bei sichtbaren Produktänderungen ersetzen; alte Aufnahmen entfernen.
Keine Mockups als Beleg einer noch nicht vorhandenen Funktion verwenden.

| Motiv | Was sichtbar sein soll |
|---|---|
| Erfassen | Bereit zum Scannen mit NFC-Karte und manuellem Weg |
| Laufende Zeit | Kunde, Beginn, Dauer und Pause/Beenden |
| Offline | Aufgenommene Erfassung und ehrlicher Übertragungsstand |
| Meine Zeiten | Kalender, Stunden und Pausen mit abgeschlossener Demo-Zeit |
| Zeit hinzufügen | Verständliches Formular, keine personenbezogenen Freitexte |
| Mitarbeiter/Kunden | Verwaltungsrolle und deren eigener Bereich |

Benötigt werden getrennte iPhone- und Android-Telefonserien in den jeweils aktuellen Store-
Abmessungen. iPad wird im App-Build nicht unterstützt (`supportsTablet: false`); die öffentliche
Downloadseite erkennt iPads trotzdem. Keine iPad-Unterstützung bewerben.
