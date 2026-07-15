# Block C3E1 Physical Validation Evidence

**Date:** 2026-07-15

**Status:** NOT STARTED — implementation correction independently approved and exact-head CI
green; first physical-harness commit `ee522a5` passed exact-head CI but independent review returned
`CHANGES REQUIRED`; focused four-finding harness correction is 16/16 locally and still requires
publication, exact-head CI and independent delta re-review before the first Human observation

**Validated implementation correction:** `450d7673431d3201dd02b2887f98ff6a1754e553`

**Validated implementation tree:** `a60d306ad063e4117b2685bb578742bb0a46bccb`

**Validated implementation CI:** GitHub Actions `29416554531`, attempt 1 — exact correction SHA,
ten of ten jobs passed

**Implementation review:** independent read-only delta re-review of `42b7c7a...450d767` returned
`APPROVED` with no open P0/P1/P2/P3 and authorized the complete fresh Human Physical Gate

**First harness candidate:** commit `ee522a568f3c8dee71b8ffeac34f2dec9a905559`, tree
`2e8d850dd8627af9ca873c1faaaf5adc18d53087`; exact-head GitHub Actions run `29418851293`, attempt 1,
passed all ten jobs

**Harness review disposition:** `CHANGES REQUIRED` with two P2 and two P3 findings: the fault
controller itself accepted sensitive commands, callback failure could skip cleanup, a delegate
failure before `beforeCommit` retained stale arm state, and lifecycle regressions were missing

**Authority:** Section 9 of
`ADO/02_Development/Block_C3E1_Identity_First_Employee_Membership_Authorization.md`

## Why a harness extension is required

The previously approved C3D harness intentionally rejected all three C3E1 routes and seeded both
of its provider identities with existing Memberships. It therefore could neither expose the real
pre-Membership Android shell nor prove invitation redemption, rollback or post-redemption session
resolution.

The current delta changes only strictly local synthetic validation infrastructure:

- two additional generated-password runtime logins hold exactly
  `taptime_identity_resolver` plus `taptime_employee_invitation_creator`, or exactly
  `taptime_employee_enrollment_redeemer`;
- the local Auth fixture exposes two additional reserved-domain identities, while database setup
  deliberately creates no User, IdentityBinding or Membership for either;
- the real `EmployeeMembershipEnrollmentCoordinator` is wired behind the existing loopback-only
  API with separate invitation and redemption pools;
- a credential-free fault latch claims only the next redemption attempt and receives only no-argument
  `beforeCommit()`/`finish()` lifecycle calls. Command/delegate forwarding remains in the separate
  harness composition, so the latch never receives the invitation secret, token, command or
  provider identity. It pauses only at the final hook, auto-aborts after eight seconds and isolates
  diagnostic callback failure from rollback and cleanup;
- sanitized status adds only aggregate invitation/receipt/User/Binding/Membership counts and the
  interruption state; and
- existing C3D physical setup and Block-D lifecycle regressions remain unchanged.

No Mobile, Admin Web, backend production behavior, schema migration, Core rule, C3E2 capability,
production resource, deployment/distribution path or personal data is added.

## Automated harness evidence

The PostgreSQL-backed harness now passes 16/16 tests in two files. The real C3E1 regression proves:

- both new runtime-role graphs and absence of inherited direct table access;
- provider authentication for a pre-Membership identity followed by `/v1/session` 401;
- real Administrator invitation creation with `no-store` and a canonical 43-character secret;
- a wrong canonical secret returns disclosure-safe 404 with no mutation;
- operator-armed final-pre-commit interruption returns 503 and rolls back User, Binding,
  Membership, invitation consumption and redemption receipt;
- correct redemption returns only safe display data, creates exactly one Employee grant and makes
  the unchanged `/v1/session` resolve Employee;
- a second pre-Membership identity cannot reuse the consumed invitation and creates no row; and
- safe events contain neither invitation secret nor either access token.

Six focused lifecycle regressions additionally prove exact eight-second autoabort, paused shutdown,
delegate rejection before `beforeCommit`, throwing diagnostic callbacks, manual/timer double-abort
safety and single-attempt claiming under concurrency.

Including these regressions, the clean local repository matrix is 1,534 passed tests plus the
two approved Supavisor-mode skips. The exact complete verification record is maintained in
`ADO/05_Evidence/Block_C3E1_Implementation_Evidence.md`.

## Controlled prerequisite

After exact-head CI and independent approval of the harness commit, the Human Architect starts one
fresh disposable run. Before checklist observation 1, the synthetic Administrator uses Android
`NFC-Einrichtung` to assign one physical NTAG213 to the seeded `Synthetic Android Customer` with
label `C3E1 Existing Tag`, then signs out. Sanitized status must show exactly one Customer, one Tag,
one Assignment, one administration receipt, two AuditEvents, zero lifecycle rows and zero C3E1
invitation/redemption rows.

This prerequisite supplies the “already assigned physical Tag” required by the accepted contract;
it does not exercise or authorize C3E2 reassignment.

## Human observation checklist

| Observation | Status |
|---|---|
| Approved Galaxy Android device connected over authorized USB; NFC enabled; exact two reverse mappings | Not started |
| Controlled prerequisite assigns one physical NTAG213 through real C3C without raw-payload disclosure | Not started |
| Administrator Web creates one `C3E1 Physical Employee` invitation and shows the secret only once | Not started |
| Secret absent from URL, storage, logs, terminal status and Admin projection | Not started |
| First pre-Membership identity reaches only the authority-free Android enrollment shell | Not started |
| Fixed wrong canonical secret fails closed with zero database mutation | Not started |
| Armed final-pre-commit redemption is force-stop interrupted and fully rolled back | Not started |
| Restart restores no enrollment intent or authority | Not started |
| Correct redemption creates exactly one Employee Membership and normal session resolves Employee | Not started |
| New Employee has no `NFC-Einrichtung` and performs one server-confirmed Start/Stop on the assigned Tag | Not started |
| Consumed-secret reuse by the second pre-Membership identity fails closed without a new row | Not started |
| Admin Web projects exactly one new safe Employee and no secret | Not started |
| Final sanitized counts match the accepted fresh-run expectation | Not started |
| Web/Android sign-out, harness/schema/login cleanup and scoped reverse removal succeed | Not started |
| No raw UID/payload, token, password, private key, database/provider error or real-person data disclosed | Not started |

Expected final sanitized counts are one Customer, one Tag, one Assignment, one administration
receipt, two WorkEvents, two canonical Decisions, two lifecycle Receipts, one stopped TimeEntry, six
AuditEvents, three Users, three IdentityBindings, three Memberships, two active Employee
Memberships, one consumed invitation, one invitation receipt, one redemption receipt and zero
active invitations.

No observation from an aborted or failed attempt may be promoted. Only the Human Architect or a
delegated physical tester may mark an observation passed. C3E2, production, deployment/
distribution, Web/iOS NFC, provider-account creation, email delivery and real-person data remain
outside this gate.
