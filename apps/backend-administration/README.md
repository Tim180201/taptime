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
