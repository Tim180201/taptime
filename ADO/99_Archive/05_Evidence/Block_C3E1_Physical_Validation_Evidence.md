# Block C3E1 Physical Validation Evidence

**Date:** 2026-07-18

**Status:** PASSED AND INDEPENDENTLY CLOSED — implementation correction, corrected physical
harness and ADO closure synchronization independently approved with zero open P0/P1/P2/P3; every
exact-head CI run green; one complete fresh Human identity/device validation passed on the approved
Galaxy A33/NTAG213 set

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

**Approved harness correction:** commit `43389100fcf539e64053e95dab0aa57bdba919f9`, tree
`0657f4bf2125f1a924a1b35d5ec5a8e38b8d5c8e`, direct parent
`ee522a568f3c8dee71b8ffeac34f2dec9a905559`

**Harness correction CI:** GitHub Actions `29420832927`, attempt 1 — exact correction SHA, ten of
ten jobs passed

**Harness correction review:** independent read-only delta re-review returned `APPROVED`, closed
all four findings and reported no open P0/P1/P2/P3

**Installed exact-head APK SHA-256:**
`2bbb1f09c78ed25a044df59bb2e114d03feabe1bfa407b518e6ce76a69100116`

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

After exact-head CI and independent approval of the harness correction, the Human Architect
completed the accepted observation set in one fresh disposable run. Before checklist observation 1,
the synthetic Administrator used Android
`NFC-Einrichtung` to assign one physical NTAG213 to the seeded `Synthetic Android Customer` with
label `C3E1 Existing Tag`, safe fingerprint `B55E8B6AEB30`, then signed out. Sanitized status showed
exactly one Customer, one Tag, one Assignment, one administration receipt, two AuditEvents, zero
lifecycle rows and zero C3E1 invitation/redemption rows.

This prerequisite supplies the “already assigned physical Tag” required by the accepted contract;
it does not exercise or authorize C3E2 reassignment.

## Completed Human physical validation

The Human Architect completed the accepted sequence against product correction `450d767` and
harness correction `4338910` on `SM-A336B`, Android 15/API 35, with one physical NTAG213. Auth and
API were reachable from Android only through the exact two scoped numeric-loopback reverse
mappings. Admin Web remained on `http://127.0.0.1:5173`.

Three earlier disposable attempts were fully discarded and reset: one invitation expired before the
consumed-secret reuse observation; one transferred the invitation through unauthorized clipboard
automation; and one reached safe automatic interruption rollback before the required physical
force-stop sequence. None of those attempts contributes an observation below. The accepted run used
a newly generated memory-only password, a newly created invitation and no legacy `arm-tag-a`
fixture command.

- Admin Web first projected exactly the seeded Customer and assigned Tag, with zero Employees and
  only the safe label, Customer name and fingerprint. The Administrator created one
  `C3E1 Physical Employee` invitation. The one-time disclosure was exactly 43 characters, stayed
  open through the reuse check and was never placed in a URL, terminal, file, screenshot,
  persistent note, clipboard, copy action, speech input or automation.
- The first pre-Membership identity reached only `Als Beschäftigter beitreten`. The fixed public
  negative value returned `Diese Einladung ist nicht verfügbar`; sanitized status remained one
  active invitation, one invitation receipt, two Users/Bindings/Memberships and three AuditEvents.
- With the real secret entered only through the intended Web disclosure and secure Android input,
  and manually transcribed without tooling, the armed final-pre-commit attempt reached
  `redemption_paused`. Android was force-stopped one second later. Client cancellation completed the
  attempt-scoped rollback and emitted `redemption_interrupted` plus the disclosure-safe unavailable
  event before the subsequent `abort-redemption` command was processed; that command then failed
  closed because the controller was already disarmed. Status proved zero User, Binding, Membership,
  consumption, receipt or audit mutation.
- Restart restored neither enrollment intent nor product authority. A fresh explicit enrollment
  intent for the same identity redeemed the still-open invitation successfully. Normal session
  resolution exposed the Employee scan surface, no `NFC-Einrichtung`, exactly one new Employee
  Membership and one consumed invitation/redemption receipt.
- The new Employee scanned the assigned physical Tag, observed `Arbeitszeit gestartet`, waited more
  than six seconds and observed `Arbeitszeit gestoppt`. Server status proved exactly two WorkEvents,
  two canonical Decisions, two lifecycle Receipts and one stopped TimeEntry.
- After sign-out, the second pre-Membership identity reached only the authority-free enrollment
  shell. Reuse of the same already consumed secret returned `Diese Einladung ist nicht verfügbar`,
  granted no authority and left every User/Binding/Membership/receipt/audit count unchanged.
- Admin Web then projected exactly one `C3E1 Physical Employee` and no invitation secret. The
  remaining one-time disclosure was discarded. Final sanitized state was exactly one Customer, one
  Tag, one Assignment, one administration receipt, two WorkEvents, two canonical Decisions, two
  lifecycle Receipts, one stopped TimeEntry, six AuditEvents, three Users, three IdentityBindings,
  three Memberships, two active Employee Memberships, one consumed invitation, one invitation
  receipt, one redemption receipt and zero active invitations.
- Human observation confirmed Android and Web sign-out and no disclosure of raw UID/canonical NFC
  payload, access/refresh token, password, private key, database/provider error or real-person data.
  The invitation secret appeared only in its intended one-time Web disclosure and three manually
  entered secure Android inputs, never in a clipboard, tool, terminal, file, screenshot, note or
  speech input.
- Normal harness shutdown removed the disposable `taptime_server` schema, migration ledger and all
  seven generated runtime logins. Admin Web stopped, the scoped disconnect helper removed both
  reverse mappings, and ports 54321/3000/5173 each had zero listeners.

## Human observation checklist

| Observation | Status |
|---|---|
| Approved Galaxy Android device connected over authorized USB; NFC enabled; exact two reverse mappings | Passed |
| Controlled prerequisite assigns one physical NTAG213 through real C3C without raw-payload disclosure | Passed |
| Administrator Web creates one `C3E1 Physical Employee` invitation and shows the secret only once | Passed |
| Secret absent from URL, storage, logs, terminal status and Admin projection | Passed |
| First pre-Membership identity reaches only the authority-free Android enrollment shell | Passed |
| Fixed wrong canonical secret fails closed with zero database mutation | Passed |
| Armed final-pre-commit redemption is force-stop interrupted and fully rolled back | Passed |
| Restart restores no enrollment intent or authority | Passed |
| Correct redemption creates exactly one Employee Membership and normal session resolves Employee | Passed |
| New Employee has no `NFC-Einrichtung` and performs one server-confirmed Start/Stop on the assigned Tag | Passed |
| Consumed-secret reuse by the second pre-Membership identity fails closed without a new row | Passed |
| Admin Web projects exactly one new safe Employee and no secret | Passed |
| Final sanitized counts match the accepted fresh-run expectation | Passed |
| Web/Android sign-out, harness/schema/login cleanup and scoped reverse removal succeed | Passed |
| No raw UID/payload, token, password, private key, database/provider error or real-person data disclosed | Passed |

Expected final sanitized counts are one Customer, one Tag, one Assignment, one administration
receipt, two WorkEvents, two canonical Decisions, two lifecycle Receipts, one stopped TimeEntry, six
AuditEvents, three Users, three IdentityBindings, three Memberships, two active Employee
Memberships, one consumed invitation, one invitation receipt, one redemption receipt and zero
active invitations.

The Human Architect supplied every physical observation above and confirmed both UI sign-outs. No
observation from any of the three discarded attempts is promoted. Closure commit `fe0781b`, tree
`76284e5`, passed exact-head ten-of-ten run `29645336694`; independent read-only final review
returned `APPROVED` with zero open P0/P1/P2/P3 and accepted the documented Force-Stop timing
disposition. This closes the C3E1 Human physical gate and governance synchronization for the
authorized repository/device scope. C3E2, production, deployment/distribution, Web/iOS NFC,
provider-account creation, email delivery and real-person data remain outside this gate.
