# Aktuelle Aufgabe

> Genau **eine** Aufgabe gleichzeitig. Diese Datei wird pro Aufgabe überschrieben.

---

## T-018 · Die App kommt auf ein echtes Telefon

**Für:** Codex · **Risiko:** eine App, die auf die Produktion zeigt, verlässt den Rechner
**Zeitbox:** zwei Arbeitssitzungen · **Grundlage:** `eas.json`, ADR-0016, ADR-0017

### Ziel

**Der Product Owner installiert die App auf seinem Android-Gerät, scannt einen NFC-Tag und sieht
die Arbeitszeit im Admin-Web erscheinen.**

Das ist der erste vollständige Durchlauf des Produkts durch echte Hardware. Bis heute ist jede
Zeile gegen Testdoppel gelaufen.

### Was schon da ist

`eas.json` hat ein Profil `physical-validation`: interne Verteilung, APK, eigener Paketname.
Der Bauweg existiert. Was fehlt, ist ein Profil, das auf die **Produktion** zeigt.

### Schritte

**1. Ein Profil für den Trockenlauf**

Baut eine APK, die gegen `api.tb-infra.de` läuft. **Eigener Paketname**, damit sie neben einer
späteren Store-Fassung stehen kann und nichts überschreibt.

Die Adresse kommt aus der Konfiguration, nicht aus dem Quelltext. Kein Geheimnis im Abbild, in
der Konfiguration oder im Bericht — der publizierbare Supabase-Schlüssel ist keins, alles andere
schon.

**2. Die Version ist ablesbar**

Die App zeigt an einer ruhigen Stelle, welchen Stand sie hat. Ohne das steht der Product Owner
in vier Wochen vor einem Fehler und niemand weiß, welche Fassung auf dem Telefon liegt — genau
der Fehler, den wir bei der Oberfläche hatten (**D-030**).

**3. Eine Anleitung für den Product Owner**

Kurz, in `ADO/04_Operations/`. Für jemanden, der kein Entwickler ist:

- wie er die App installiert — Android warnt bei Installation außerhalb des Stores, das ist
  normal und muss dastehen, sonst bricht er ab
- wie er sich anmeldet
- wie er einen NFC-Tag registriert und einem Arbeitsziel zuordnet
- was er sieht, wenn es funktioniert — und was, wenn nicht
- **welche NFC-Tags funktionieren.** Er muss welche kaufen; sag ihm, worauf er achten muss

**4. Der Verteilungslink ist nicht öffentlich**

Die APK zeigt auf die Produktion. Wer sie hat, hat eine Anmeldemaske vor echten Daten. Der Link
gehört an den Product Owner, nicht in ein Repository und nicht in einen Chat, den jemand
weiterleitet.

Falls der Bauweg ein Konto oder Geld verlangt: **melden, bevor du es anlegst.** Das ist eine
Entscheidung des Product Owners.

### Vision-Check

**One Tap. One Decision.** Das erste Mal, dass ein Mensch tatsächlich einmal tippt.

### Nicht anfassen

- Die fachliche Logik der App. Sie ist gebaut und getestet
- `packages/core`, Migrationen, Backend
- Das Admin-Web
- iOS. Das ist **T-030**, und zwar zuerst als Recherche
- Der eingefrorene `apps/synthetic-android-e2e`

### Prüfung — nachweisen, nicht behaupten

- Eine APK ist gebaut und ihr Ursprungs-Commit ist benannt
- Die App zeigt ihren Stand an, und er stimmt mit dem Commit überein
- Die Anleitung ist so geschrieben, dass jemand ohne Entwicklerwissen sie befolgen kann —
  einschließlich der Android-Warnung bei Installation außerhalb des Stores
- Kein Geheimnis im Abbild, in der Konfiguration oder im Bericht
- Der Paketname unterscheidet sich von einer späteren Store-Fassung
- Alle bestehenden Mobile-Tests bleiben grün
- CI grün, kein `[skip ci]`

### Zusätzliches Review

> Was passiert, wenn der Product Owner diese App benutzt, während wir eine neue Fassung
> ausliefern? Merkt er, dass seine Fassung alt ist? Wenn nicht: nenne es als Befund — es ist
> derselbe Fehler wie **D-030**, nur auf dem Telefon.

### Abschluss

Vier Punkte melden — Nachweise als **Sätze**. **Nicht committen** vor `APPROVED`; ein
Dokumentations-Commit vorab ist erlaubt.

---

## Danach

`T-030` iOS-Machbarkeit · `T-020` Freigabekette (D-014, D-026) · `T-016` Löschkonzept ·
`T-024` Geheimnisse rotieren · siehe `ADO/PLAN.md`.
