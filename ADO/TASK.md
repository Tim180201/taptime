# Aktuelle Aufgabe

> **Stand 18.09.2026:** T-058 ist auf `main` (`3daa09b`, CI grün, Review in einer Runde).
> Der Product Owner hat die Tag-Adresse entschieden (D-061): `tb-infra.de` zum Testen, die
> offizielle Domain vor dem ersten Pilot-Tag; die App nimmt eine Liste von Hosts an.
> Reihenfolge: **T-043 → T-060 → T-059 → APK → Geräteabnahme (D-044) → T-049.**

## T-043 · Der Android-Auswahldialog verschwindet — NDEF-Adresse auf dem Tag

**Für:** Development · **Risiko:** Tag-Zuordnung (schreibt jetzt), Android-Dispatch, Evidenz
**Zeitbox:** zwei Sitzungen. **Grundlage:** D-037, D-061, PLAN-Eintrag T-043, Vorbild
`frogs-zeiterfassung/plugins/withNfcIntentFilters`. Auftrag vom 18.09.2026.

### Befund

Bei geschlossener App öffnet Android beim Dranhalten einen Auswahldialog (T-033, Schritt 11):
Unser TECH-Filter (`NfcA`, `plugins/withNfcTagDispatch.js`) und Androids System-App treffen
denselben Tag; Androids Reihenfolge ist NDEF vor TECH, und `NDEF_DISCOVERED` beansprucht auf dem
Testgerät niemand. Trägt der Tag eine NDEF-URI mit unserem Host und beansprucht die App genau
diese, geht der Intent ohne Dialog an uns.

### Umsetzung

1. **Adresse an einer Stelle.** `apps/mobile/src/nfc/tagAddress.ts` exportiert die Liste der
   Hosts (heute genau `tb-infra.de`) und baut die URI `https://<erster Host>/tag`. Kein Tag-
   Kennzeichen in der URI: Die Identität des Tags bleibt die heutige UID-Evidenz
   (`canonicalPayload`, Prüf-Fingerprint); die URI dient nur dem Android-Dispatch. Das Config-
   Plugin liest dieselbe Liste (über `app.config` extra), damit Manifest und App nie auseinander-
   laufen; ein Test belegt das.
2. **Manifest.** `NDEF_DISCOVERED` mit `<data android:scheme="https" android:host="…" android:pathPrefix="/tag">`
   je Host, zusätzlich zum bestehenden TECH-Filter (alte Test-Tags ohne NDEF funktionieren
   weiter, mit Dialog, bis sie neu beschrieben sind). Kein `autoVerify`, keine App-Links-
   Verifikation in dieser Aufgabe (Android braucht sie für NFC nicht; iOS-Universal-Links kommen,
   wenn die offizielle Domain steht).
3. **Tag zuordnen schreibt.** `AdminSetupCoordinator.provision`/`provisionBreak`: nach der
   Erfassung und **vor** der Server-Registrierung die NDEF-URI schreiben (`Ndef`-Technologie,
   ein URI-Record). Schreibfehler → eigenes Ergebnis `tag_write_failed` („Tag konnte nicht
   beschrieben werden, nichts wurde registriert"); erneutes Zuordnen desselben Tags schreibt
   dieselbe URI erneut (idempotent). **Tags werden nicht schreibgeschützt** (D-061: der Wechsel
   auf die offizielle Domain muss möglich bleiben). Ein Tag, der nicht NDEF-formatierbar ist,
   liefert `tag_write_failed` mit Grund.
4. **Lesen bleibt, wie es ist.** Der Scan-Pfad (`RnNfcScanAdapter`, `NativeNfcIngress`,
   `ExclusiveNfcCaptureArbiter`) wertet die NDEF-Nachricht nicht aus; Evidenz und Verträge
   unverändert (D-052/D-055). Ein Tag mit fremder oder fehlender URI wird wie heute behandelt.
5. **Text.** „Tag zuordnen" sagt, dass der Tag beschrieben wird; `Tags`-Liste zeigt nichts Neues.
   Kein Backend, keine Migration, keine neue Route.

### Verifikation und Abschluss

Rotnachweise: Plugin-Test — Manifest enthält `NDEF_DISCOVERED` mit Daten-Filter für jeden Host
aus `tagAddress.ts` und weiterhin den TECH-Filter; Coordinator-Test — Schreiben passiert vor der
Registrierung, mit der URI aus `tagAddress.ts`, Schreibfehler registriert nichts und meldet
`tag_write_failed`; Adapter-Test — Evidenz eines Tags mit und ohne NDEF-Nachricht ist identisch.
Typecheck, volle Mobile-Suite, `expo prebuild`-Manifest im Bericht zeigen. Unabhängiges Review
(Evidenz unverändert, Schreibreihenfolge). Umsetzung nicht vor Technical-Lead-APPROVED committen.
Gerätenachweis durch den Product Owner erst mit der APK nach T-059 (D-044): App geschlossen,
Tag dranhalten, App öffnet ohne Auswahldialog und bucht. Bericht nach AGENTS.md §8.
