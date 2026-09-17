# TapTim.e — Status

**Stand:** 17.09.2026 · Repository nach T-054-Rückbau; technisch abgenommen.
Fertig ist das Produkt, wenn das ausgelieferte, wiederherstellbare System einen vollständigen
Monatsabschluss übersteht. Der Produktionsstand wurde in T-054 nicht abgefragt oder verändert.

## Vorhanden

- Domäne und Business Engine: `Trigger → WorkEvent → Engine → TimeEntry`, Korrekturen append-only.
- Backend: 11 `apps/backend-*`-Workspaces einschließlich API und Schema; 52 registrierte
  HTTP-Pfade inklusive `/health` aus `BACKEND_HTTP_ROUTES` in `BackendHttpServer.ts`.
- 23 SQL-Migrationsdateien unter `apps/backend-schema/migrations`; Rollen laut Migration 020:
  `administrator`, `standortleitung`, `employee`. RLS und mandantengebundene Berechtigungen.
- Mobile: Anmeldung, Einladungseinlösung, NFC, manuelle Erfassung, eigene Zeiten, Offline-Queue.
  Erfassung über Offline v4, Abgleich v2, Leases v3; Löschung der Queue erst nach Archivnachweis.
- Verwaltung: Beschäftigte, Standorte und Zuständigkeiten, Arbeitsziele, Tags, Korrektur und
  Prüfentscheidung. Pausenintervalle und CSV V3 mit Pausen, Ortszeit und Revisionskennzeichnung.
- Betrieb im Repository: Container, Caddy, Deploy/Rollback, Diagnose, Alarmierung, physische
  Basissicherung, externes WAL, Zeitpunkt-Restore und Wiederherstellungsprüfung samt Tests.
- Android-APK-Baustrecke über `android:production-validation:build` bleibt erhalten.
  NFC und Offline wurden am Gerät abgenommen; der Android-Auswahldialog bleibt T-043.

## Aktuelle Aufgabe

**T-054:** Synthetic-Paket, Mobile-Prüfapparat, B1-Spike, alter Scan-Client und drei unbenutzte
Core-Dienste entfernt. Tests sichern echte Runtime-Verdrahtung und Android-Backup-Schutz;
Serverrouten und Migrationen bleiben unverändert. Unabhängiges Review (Runde 1) und technische
Abnahme: APPROVED. Sechs getrennte Umsetzungs-Commits; Dokumentationsauftrag zuvor gepusht.

## Offen bis zum Pilotbetrieb

- T-052: Entscheidung sofort im Tap anzeigen, Archivquittung weiterhin später (D-052).
- Registrierung/Einladung mit Kontenerstellung und zustellbarer Mail: T-021/T-047.
- Ortszeitgrenzen, Tagesfreigabe, Kalender und beschlossene Pausenautomatik: T-036/T-048–T-050.
- Android-App-Auswahl und Lesemodus, iOS, Datenschutz/Löschung, fertige Oberflächen und CSP.
- Firma, Recht, Store-Freigabe und Verwahrung des Release-Signierschlüssels; unabhängiger
  Aussperr-Test durch den Product Owner. Supabase-Tarif vor zahlenden Kunden klären.

## Bekannte Kleinigkeiten und offene Risiken

- **P1:** Passwort-Recovery nutzt ein fremd beanspruchbares eigenes URL-Schema;
  das Web-Bündeltor prüft noch nicht die Übereinstimmung mit dem Backend-Aussteller (T-039).
- **P2 Betrieb:** Öffentliche Web-Konfiguration stammt aus dem Mobile-Testprofil; Rollback mit
  echtem Bündeltor, Betriebsversion und systemd-Pfadwechsel bleiben gesondert abzusichern.
  Caddy-Test nutzt eine eigene Konfiguration; Monitoring-Test benötigt GNU-Werkzeuge.
- **P2 Sicherheit:** CSP fehlt; SECURITY-DEFINER-Zugriffspfade und uneinheitliche Policy-Prädikate
  bleiben Prüfaufgaben. Geheimnisrotation und passphrasegeschützter Deploy-Schlüssel: T-024.
  Direkte Supabase-Anmeldung liegt außerhalb eigener API-Ratenbegrenzung; kontobezogenen
  Schutz vor zahlenden Kunden prüfen.
- **P2 Fachlich:** Geräteuhr für manuelle Erfassung, unbegrenzter vergessener Stopp,
  fehlende aktive Zeitreferenz bei Offline-Pausenkonflikten und zusätzliche Break-Bindungen.
- **P2/P3 Oberfläche:** Keine automatische Meldung neuer APKs; gemischte Prüfposten-Auswahl
  erklärt ihre Abweisung nicht; CSS-Quelltexttest und ungeteiltes Web-Bündel bleiben offen.
- **P2/P3 Pflege:** Weitere Fach-/Rollendokumente in T-019 abgleichen; Abhängigkeitssicherheit
  braucht eine eigene Richtlinie. Lokale PostgreSQL-Suiten wegen clusterweiter Rollen seriell.
  Health-Abfrage ohne Cache, einmaliger API-Ausfallalarm und alte Caddy-Assets bleiben bestehen.
