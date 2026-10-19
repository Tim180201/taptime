# `@taptime/backend-administration`

Private C3C/C3E1/C3E2 Node 24 workspace for tenant-safe setup, Employee enrollment and explicit NFC
Tag reassignment. It verifies the existing B4
identity boundary, locks the current Membership, requires an exact expected Membership plus current
Administrator role, then uses only `taptime_admin_setup` inside migration `007`.

The workspace exposes fixed Customer creation, atomic NFC Tag registration/first Assignment and a
bounded safe projection. It exposes no Pool, repository, generic SQL, Membership mutation,
generic delete or lifecycle operation. Raw canonical NFC payload is accepted only by the
provision command and is absent from every result, receipt, audit payload and diagnostic.

Migration `007` keeps the runtime role free of raw-payload reads and Customer update privileges.
Two callable `SECURITY DEFINER` data capabilities perform only the conflict-safe Tag insert and
active Customer row lock under a separate non-login owner. A trigger-only receipt-integrity
capability independently rebinds every committed receipt to its exact resources, request digest and
audit provenance; the authority/audit owner remains isolated from those data rights. Every command
carries its HTTP deadline into PostgreSQL lock, statement and transaction bounds.

Migration `008` adds a distinct current-Administrator invitation capability and a separate
pre-Membership redemption capability. A server-generated 32-byte secret is returned once and only
its domain-separated digest is stored. Redemption creates User, IdentityBinding, Employee
Membership, consumption, receipt and creator-attributed audit atomically. The two runtime logins
cannot assume one another's role and have no direct table access.

Migration `009` adds a third, separately pooled reassignment runtime capability. The coordinator
locks the expected active Assignment and active target Customer, rejects started TimeEntries,
closes the old Assignment and appends its successor at one transaction timestamp, writes two safe
audits and commits a globally idempotent receipt. Same-target intent is a receipt-only no-op.
Receipt replay precedes mutable resource checks; the runtime cannot read raw NFC payloads.

Local verification uses a disposable PostgreSQL 17 database and a superuser installer:

```bash
export C3C_DATABASE_URL="postgresql://$USER@127.0.0.1:5432/taptime_c3c"
npm run build --workspace=@taptime/administration-contract
npm run typecheck --workspace=@taptime/backend-administration
npm test --workspace=@taptime/backend-administration
npm run build --workspace=@taptime/backend-administration
```

This is repository implementation evidence, not a public or production deployment approval.

## Archiv und vollständige Monatslisten (T-127a, Migration 061)

Alle fünf Lesewege sind POST-Routen mit `expectedMembershipId`; die Identität kommt aus
Bearer-Token und aktueller Mitgliedschaft. Mitarbeiter sind ausgeschlossen. Bestehende
SQL-Fassungen, `/v1/administration/managed-person-time` und die bisherigen Accept-Verträge
für die Übersicht bleiben unverändert.

| Route | Anfrage zusätzlich zu `expectedMembershipId` | Antwort |
|---|---|---|
| `/v1/administration/archive/people` | `locationId`, `membershipId` (je UUID oder null), `search`, `cursor`, `limit` | `people`, `nextCursor`; Name bleibt nullable, `revokedAt`, `lastStartedAt` |
| `/v1/administration/archive/targets` | `locationId`, `search`, `cursor`, `limit` | `targets`, `nextCursor`; `targetType`, `targetId`, `deactivatedAt`, `lastStartedAt` |
| `/v1/administration/archive/status` | `membershipIds`, `targets: [{targetType, targetId}]`, zusammen höchstens 200 eindeutige Kennungen | `people`, `targets` mit `archived`; nicht lesbare Kennungen fehlen |
| `/v2/administration/managed-active-summary` | Suchvertrag der bisherigen Übersicht: `locationId`, `isRunning`, `fromInclusive`, `toExclusive`, `search`, `cursor`, `limit` | bisherige Suchantwort; Ehemalige nur mit Zeit im Startmonat, nie bei `isRunning: true`; Zählungen nur Aktive |
| `/v2/administration/managed-person-time` | `targetMembershipId`, `fromInclusive`, `toExclusive`, `cursor`, `limit` | Kalenderantwort mit Details/Pausen und `canManageTime`; kein Accept-Schalter nötig |

Archivseiten und Übersicht liefern höchstens 50 Einträge und 14 KiB; SQL liest höchstens
51 Zeilen für den Fortsetzungshinweis. Cursor binden Suche, Aufrufer und Filter. Die
Personenansicht behält die Grenze von 20 historischen Einträgen und die 256-KiB-Grenze der
bestehenden Kalenderantwort. Die gebündelte Statusantwort ist auf 32 KiB begrenzt.

Administrator: ganzer Betrieb. Standortleitung: letzter Heimatstandort der Person bzw.
letzte Bindung des deaktivierten Ziels, ohne Austrittsfrist. Nur die Statusabfrage umfasst
zusätzlich bereits lesbare Kundenbeiträge und Ziele aus nach D-115 lesbaren Prüfzeiten;
dadurch öffnet sie keine fremde Archiv- oder Personenansicht. `canManageTime` stammt aus
`has_time_management_authority_v1`; einzelne Schreibbefehle prüfen weiterhin selbst,
insbesondere Zeitgrenzen und Austrittszeitpunkt. Keine neue Tabelle, kein neuer Schreibweg.
