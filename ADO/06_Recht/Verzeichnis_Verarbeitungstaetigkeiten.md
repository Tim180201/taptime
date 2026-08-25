# Verzeichnis von Verarbeitungstätigkeiten

**nach Art. 30 Abs. 2 DSGVO — als Auftragsverarbeiter**

> **Entwurf des Technical Lead, keine Rechtsberatung.** Grundlage ist der tatsächlich gebaute
> Stand des Systems, nicht eine Absicht. Zur Prüfung durch einen Fachanwalt bestimmt.
> **Stand:** 25.08.2026 · **Systemstand:** Migration 016, Aufgaben T-001 bis T-011

---

## 1. Verantwortlicher und Auftragsverarbeiter

| | |
|---|---|
| **Auftragsverarbeiter** | *(Firma in Gründung — UG (haftungsbeschränkt), Tim Bartz)* |
| **Kontakt** | *(nach Gründung ergänzen)* |
| **Datenschutzbeauftragter** | Nicht bestellt. Pflicht nach § 38 BDSG erst ab 20 ständig mit automatisierter Verarbeitung beschäftigten Personen. Prüfung nach Art. 37 Abs. 1 lit. b DSGVO empfohlen. |
| **Verantwortliche** | Die jeweiligen Kundenunternehmen. Jedes ist eine eigene Organisation im System. |

---

## 2. Kategorien von Verarbeitungstätigkeiten

### 2.1 Erfassung und Nachweis von Arbeitszeiten

**Zweck:** Erfassung, Speicherung, Korrektur und Auswertung der Arbeitszeiten der Beschäftigten
des Verantwortlichen zur Erfüllung von dessen Aufzeichnungspflichten
(§ 3 Abs. 2 Nr. 1 ArbSchG i. V. m. BAG 1 ABR 22/21, § 16 Abs. 2 ArbZG, § 17 MiLoG).

**Betroffene Personen:** Beschäftigte des Verantwortlichen; administrativ Tätige des
Verantwortlichen.

**Datenkategorien:**

| Kategorie | Felder |
|---|---|
| Identität | Anzeigename, E-Mail-Adresse, Benutzerkennung des Authentifizierungsanbieters |
| Zugehörigkeit | Organisation, Rolle (`administrator`, `employee`), Beginn, Entzug |
| Arbeitszeit | Beginn, Ende, Ziel (Kunde/Projekt/Allgemeine Arbeitszeit), Auslöserart (`nfc`, `manual`) |
| Korrekturen | Ursprungswert, neuer Wert, Begründung (1–500 Zeichen, Pflichtangabe), Urheber, Zeitpunkt |
| Ereignisse | Arbeitsereignisse, Entscheidungen der Business Engine, Prüfvorgänge |
| Technisch | Installationskennung des Geräts, NFC-Tag-Kennung, Korrelationskennungen |

**Keine besonderen Kategorien nach Art. 9 DSGVO.** Keine Standortdaten, keine biometrischen
Daten, keine Leistungs- oder Verhaltensbewertung.

**Empfänger:** keine Weitergabe an Dritte außer den unter Abschnitt 4 genannten
Unterauftragsverarbeitern. Der Verantwortliche exportiert Daten selbst und leitet sie in eigener
Verantwortung weiter, etwa an seine Lohnbuchhaltung.

**Drittlandübermittlung:** keine. Sämtliche Verarbeitung findet in der Europäischen Union statt.
Die Region des Authentifizierungsanbieters ist geprüft und liegt in der EU (bestätigt 25.08.2026).

**Löschfristen:** siehe Abschnitt 5.

### 2.2 Authentifizierung

**Zweck:** Feststellung, dass eine anmeldende Person die ist, die sie zu sein vorgibt.

**Datenkategorien:** E-Mail-Adresse, Passwort-Prüfwert, Ausstellerkennung und Subjektkennung.

**Besonderheit:** Das Produkt speichert **kein Passwort und keinen Passwort-Prüfwert.** In der
Produktdatenbank liegen ausschließlich `issuer` und `subject` des Authentifizierungsanbieters
(Tabelle `identity_bindings`). Die Anmeldung selbst läuft unmittelbar zwischen dem Endgerät und
dem Anbieter; sie berührt die Server des Auftragsverarbeiters nicht.

### 2.3 Betrieb und Störungsbehebung

**Zweck:** Nachweis der Verfügbarkeit, Erkennung und Behebung von Störungen.

**Datenkategorien:** Zeitpunkt, Fehlerklasse aus geschlossener Liste, Route aus geschlossener
Liste, Korrelationskennung.

**Ausdrücklich nicht enthalten:** Namen, E-Mail-Adressen, Kundenbezeichnungen, Arbeitszeiten,
Zugangstoken, Anfrageinhalte, Organisationskennungen. Die Beschränkung ist nicht organisatorisch,
sondern technisch erzwungen: Der Protokollschreiber baut aus vier getippten Feldern ein neues
Objekt, statt ein bestehendes zu filtern.

**Aufbewahrung:** 14 Tage, zusätzlich begrenzt auf 256 MB.

---

## 3. Rechtsgrundlage der Auftragsverarbeitung

Art. 28 DSGVO. Der Auftragsverarbeiter verarbeitet ausschließlich auf dokumentierte Weisung des
Verantwortlichen. Eine eigene Zweckbestimmung findet nicht statt; die Daten werden weder für
eigene Zwecke ausgewertet noch zu Trainings- oder Analysezwecken verwendet.

---

## 4. Unterauftragsverarbeiter

| Anbieter | Leistung | Ort | Personenbezug |
|---|---|---|---|
| **Hetzner Online GmbH** | Server, Datenbank, Anwendung | Nürnberg, Deutschland | ja — vollständig |
| **Hetzner Online GmbH** | Sicherungsspeicher | Falkenstein, Deutschland | ja — verschlüsselt |
| **Supabase** | Authentifizierung | EU (geprüft) | ja — E-Mail, Passwort-Prüfwert |
| **Brevo (Sendinblue SAS)** | Systemmails | Frankreich | ja — E-Mail-Adresse |
| **ntfy.sh** | Betriebsmeldungen an den Betreiber | — | **nein** — nur Störungstexte ohne Personenbezug |
| **healthchecks.io** | Totmannschalter | — | **nein** — nur ein Lebenszeichen ohne Rumpf |

**Zu klären vor Vertragsschluss:** AVV mit Hetzner, Supabase und Brevo. Für ntfy.sh und
healthchecks.io ist zu bewerten, ob mangels Personenbezug überhaupt eine Auftragsverarbeitung
vorliegt.

**Nicht Unterauftragsverarbeiter:** GitHub (Quelltext, keine Endnutzerdaten).

---

## 5. Löschfristen

Die Fristen sind je Datenart als **Klasse** hinterlegt und als Einstellung änderbar (D-018).

| Klasse | Frist | Grundlage |
|---|---|---|
| Arbeitszeitaufzeichnungen | 2 Jahre | § 16 Abs. 2 ArbZG, § 17 MiLoG |
| Lohnrelevante Unterlagen | *(zu prüfen)* | Abgabenordnung — Fristen zuletzt geändert, vor Vertragsschluss frisch zu ermitteln |
| Betriebsprotokolle | 14 Tage | Datensparsamkeit, Art. 5 Abs. 1 lit. e |
| Zugehörigkeiten | bis Ende der Aufbewahrung der zugehörigen Zeiten | |
| Einladungen | mit Ablauf oder Einlösung | |

**Sicherungen:** Verschlüsselte Sicherungen bestehen bis zu sechs Monate. Eine Löschung wirkt in
den Sicherungen mit deren Ablauf nach; ein gezielter Eingriff in bestehende Archive erfolgt
nicht. Dieses Vorgehen ist anerkannt, muss dem Verantwortlichen aber offengelegt werden.

**Beendigung des Auftrags:** Rückgabe oder Löschung nach Wahl des Verantwortlichen,
Art. 28 Abs. 3 lit. g. Die Fähigkeit dazu entsteht mit Aufgabe `T-016`.

---

## 6. Technische und organisatorische Maßnahmen

Siehe `ADO/06_Recht/AVV_Anlagen.md`, Anlage 1.
