# Store-Vorbereitung

**Entwurf, rechtliche Prüfung mit B15.** Keine Einreichung und keine Freigabe zur Veröffentlichung.

`shared/product.json` ist die Namensquelle für App-Konfiguration, sichtbare App-Texte, Web-Titel,
Startseite und diese Vorlagen. `{{APP_NAME}}` wird beim Erzeugen der Store-Unterlagen ersetzt:

```sh
node scripts/renderStoreDrafts.mjs .t109-review/store
```

Development legt Quellen und Generator an, pflegt sie bei Produktänderungen und entfernt abgelöste
Vorlagen. Der PO entscheidet den Namen, prüft die erzeugten Texte vor einer Einreichung und pflegt
oder entfernt die späteren Store-Einträge. Erzeugte Dateien sind wegwerfbare Ausgabe; sie werden
nicht zusätzlich versioniert. Die Namensprüfung läuft in der Verwaltungs-Testsuite.

## Bezugslinks

Nur `apps/landing-web/src/appLinks.json` enthält die beiden externen Ziele. Beide bleiben auf
PO-Anweisung leer. Der PO liefert später TestFlight-/Play-Test-Links; Development trägt sie ein,
prüft und liefert die Startseite regulär aus. Ein leeres Feld entfernt den jeweiligen Bezugsweg.
Später ersetzt Development dieselben Werte durch die freigegebenen Store-Links. Besucher können
kein eigenes Weiterleitungsziel angeben. Unterstützt sind HTTPS-Adressen auf `testflight.apple.com`,
`apps.apple.com` und `play.google.com`; die Datei ist keine Laufzeit- oder Servereinstellung.

## Build-Profil

`apps/mobile/eas.json` enthält `store`: erbt die öffentlichen Produktionswerte und die iOS-
Store-Verteilung von `production-validation`, erzeugt unter Android ein App Bundle und erhöht
native Build-Nummern automatisch. `APP_VARIANT=store` wählt die bestehenden produktiven IDs
`com.tim180201.mobile` und das Schema `taptime`; die Prüf-APK behält ihre eigene Identität.
`EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT=production-validation` bezeichnet dabei weiterhin die
Produktlaufzeit, nicht die Paketidentität. Es werden keine Schlüssel oder Konten hinzugefügt.
Grundlage: [Expo Build-Profile](https://docs.expo.dev/build/eas-json/) und
[Versionsverwaltung](https://docs.expo.dev/build-reference/app-versions/).

Vor einem separat freigegebenen Store-Bau: finalen Namen, Konten, Signierung, Datenschutz-/Support-
und Impressumsadressen, Apple-unlisted-Antrag, DSA-Angaben und Demo-Zugang durch den PO klären.
Mit der Play-App-Signatur folgt deren Fingerabdruck in `assetlinks.json` als eigener Schritt.
Nach dem nächsten Deploy überträgt der PO die Einladungsvorlage aus `docs/T-047-Einladungsvorlage.md`.

## Bestandteile

- `listing.md`: deutsche Store-Texte, Kategorien und Altersfreigabe als Vorschlag.
- `review.md`: Prüferhinweise und Screenshot-Aufträge, ohne Zugangsdaten.
- `privacy.md`: technische Bestandsaufnahme für die beiden Datenschutzfragebögen.
