# Block C3E2 Physical Validation Evidence

**Date:** 2026-07-18

**Status:** PASSED AND INDEPENDENTLY CLOSED — complete fresh Human
Admin-Web/Galaxy-A33/NTAG213 validation and cleanup passed on the independently approved
implementation; ADO closure synchronization passed exact-head CI and independent final review with
zero open P0/P1/P2/P3

**Validated head:** `7050df43977fc79bba3483aada91b5f98ef0e3b0`

**Validated tree:** `587ef8f5385d08af297a0c38322a2522cb7516a2`

**Validated exact-head CI:** GitHub Actions `29649683173`, attempt 1 — ten of ten jobs passed

**Independent implementation review:** `APPROVED`, zero open P0/P1/P2/P3

**Installed APK SHA-256 recorded at build time:**
`9facc1bcc043da7ff117273c94237ad8dd4c19444456c3d673486f4fea281600`

**Physical set:** Samsung Galaxy A33 5G (`SM-A336B`), Android 15/API 35, one synthetic-test
NTAG213, safe validation fingerprint `B55E8B6AEB30`

**Authority:** Section 11 of
`ADO/02_Development/Block_C3E2_Explicit_Tag_Reassignment_Authorization.md`

## Exact artifact binding

Before the Human gate began, the Technical Lead independently confirmed:

- checked-out head/tree were exactly `7050df4` / `587ef8f`;
- the synthetic harness and Admin Web production build were produced from that exact source;
- a fresh synthetic release APK was generated and installed as
  `com.tim180201.mobile.synthetic`;
- the exact APK hash above was recorded at build time;
- the previous ignored/generated local Android project was preserved outside the build and restored
  unchanged afterward;
- Auth and API listened only on numeric host loopback;
- Android had exactly `tcp:54321 -> tcp:54321` and `tcp:3000 -> tcp:3000` USB reverse mappings;
- Admin Web listened only on `http://127.0.0.1:5173`; and
- the disposable PostgreSQL database was the exact local
  `taptime_synthetic_android_e2e` database.

No production resource, production data, LAN endpoint, tunnel, provider account or deployment was
used.

## Attempt separation

One preliminary disposable start was fully stopped and reset before the accepted run. The
Technical Lead unnecessarily armed the retained legacy `arm-tag-a` fixture before the real C3C
Android provision action. Real C3C succeeded, but the unrelated one-shot fixture remained armed and
had no operator cancel command. The run was not promoted: normal harness shutdown removed its
schema/logins, the next start recreated a fresh schema, Android application data was cleared, and
fresh status proved two Customers with zero Tags, Assignments, receipts, audits or lifecycle rows
and both control latches disarmed.

The accepted run used no `arm-tag-a` command. One first physical NFC contact before the Customer-A
start was only a positioning miss. Sanitized status immediately proved exactly one WorkEvent,
Decision, lifecycle Receipt and active TimeEntry after the successful second contact, so the
miss produced no API or database mutation.

During the active-work check, the first Web submission returned the exact disclosure-safe
`assignment_in_use` notice, confirmed in the real page state, but the Human closed the browser
before personally reading it. Sanitized status proved zero Assignment, receipt, audit or lifecycle
change. A fresh memory-only Administrator Web session repeated the same active-work operation; the
Human then directly observed the required notice. Neither rejection created a receipt or mutation,
and the accepted run continued from the exact unchanged pre-command state.

## Completed Human physical validation

The Human Architect completed the complete Section-11 sequence on the exact artifact set:

1. A fresh harness start seeded only the two required synthetic Customers:
   `Synthetic Android Customer` (Customer A) and `Synthetic Reassignment Target` (Customer B).
   Initial status showed both control latches disarmed and zero Tags, Assignments, receipts, audits
   and lifecycle rows.
2. The synthetic Administrator signed in on Android, opened protected `NFC-Einrichtung`, selected
   Customer A and registered/assigned the physical NTAG213 as `C3E2 Physical Tag`. The only exposed
   matching aid was fingerprint `B55E8B6AEB30`.
3. Sanitized status proved two Customers, one Tag, one active Assignment, one administration
   receipt, two AuditEvents and zero lifecycle rows.
4. Through the closed C3E1 path, Admin Web created one `C3E2 Physical Employee` invitation. The
   first pre-Membership synthetic identity reached only `Als Beschäftigter beitreten`, redeemed the
   secret through its intended secure Web/Android surfaces and resolved a normal Employee session
   with no `NFC-Einrichtung`.
5. The one-time Web disclosure was discarded. Admin Web projected exactly one safe Employee.
   Pre-scan status was exactly three Users, IdentityBindings and Memberships, two active Employee
   Memberships, one consumed invitation, one invitation receipt, one redemption receipt, zero
   active invitations, four AuditEvents and zero lifecycle rows.
6. The Employee scanned the Tag and observed `Arbeitszeit gestartet` on Customer A. Status proved
   exactly one WorkEvent, canonical Decision, lifecycle Receipt and active TimeEntry.
7. Admin Web safely displayed the Tag label, fingerprint and explicit
   `Synthetic Android Customer -> Synthetic Reassignment Target` confirmation. While Customer-A
   work was active, the Human observed:
   `Für diese Zuordnung läuft noch eine Arbeitszeit. Bitte zuerst stoppen und dann erneut bestätigen.`
8. Sanitized status after rejection remained exactly one Assignment, one WorkEvent, one Decision,
   one lifecycle Receipt, one active TimeEntry, one administration receipt and five AuditEvents.
   The rejection therefore changed neither counts nor history.
9. The Employee scanned the Tag again and observed `Arbeitszeit gestoppt` on Customer A.
10. The still-explicit Web operation then succeeded with
    `NFC-Tag wurde sicher neu zugeordnet.` Web and refreshed Android Administrator projections both
    showed the same safe label/fingerprint assigned to Customer B.
11. Cutover status showed exactly two Assignments, two administration receipts, eight AuditEvents,
    two WorkEvents/Decisions/lifecycle Receipts and one stopped TimeEntry.
12. After normal Employee sign-in, the same physical Tag produced server-backed
    `Arbeitszeit gestartet`, more than six seconds elapsed, and a second scan produced
    `Arbeitszeit gestoppt` on Customer B.

## Sanitized final history

Final harness status was exactly:

| Evidence | Count |
|---|---:|
| Customers | 2 |
| NFC Tags | 1 |
| NFC Assignments | 2 |
| Administration receipts | 2 |
| WorkEvents | 4 |
| Canonical Decisions | 4 |
| Lifecycle Receipts | 4 |
| TimeEntries | 2 |
| Stopped TimeEntries | 2 |
| AuditEvents | 10 |
| Users / IdentityBindings / Memberships | 3 / 3 / 3 |
| Active Employee Memberships | 2 |
| Active / consumed invitations | 0 / 1 |
| Invitation / redemption receipts | 1 / 1 |

A read-only installer-session query selected only safe label/fingerprint, Customer, validity,
status and timestamp fields and proved:

- Assignment 1 targets Customer A, is inactive and has row version 2;
- Assignment 2 targets Customer B, is active and has row version 1;
- old `valid_to`, new `valid_from` and reassignment-receipt `result_effective_at` are the exact same
  PostgreSQL timestamp: `2026-07-18 18:09:12.084379+02`;
- TimeEntry 1 is stopped on Customer A through Assignment 1;
- TimeEntry 2 is stopped on Customer B through Assignment 2;
- both TimeEntry start/stop timestamps equal their corresponding WorkEvent timestamps;
- receipts are exactly one `provisionNfcTag` and one `reassignNfcTag`, both succeeded;
- reassignment audits are exactly one `NfcAssignmentDeactivated` and one additional
  `NfcTagAssigned`; and
- a server-side equality probe returned zero AuditEvent payload occurrences of the stored canonical
  NFC payload without returning or displaying that payload.

The Human Architect confirmed that Web, Android and terminal exposed only synthetic safe data and
no raw UID/canonical payload, access/refresh token, password, private key, database/provider error,
real-person data or invitation secret outside its intended one-time disclosure and secure input.

## Cleanup

The Human signed out of Android and Admin Web and confirmed both login surfaces. Normal harness
shutdown then removed the disposable `taptime_server` schema, migration ledger, synthetic tenant
data and every generated `taptime_synthetic_e2e_*` runtime login. The Technical Lead:

- stopped Admin Web;
- closed the signed-out browser tab;
- force-stopped the synthetic Android app;
- ran the scoped disconnect helper, which removed exactly the two approved reverse mappings;
- confirmed ports 54321/3000/5173 had no listener;
- confirmed the reverse table was empty;
- confirmed `to_regnamespace('taptime_server') IS NULL`;
- confirmed zero generated runtime logins remained; and
- reconfirmed exact head/tree with no tracked or staged repository diff.

## Human observation checklist

| Observation | Status |
|---|---|
| Exact reviewed head/tree/CI bound to APK, Web and harness | Passed |
| Fresh numeric-loopback environment and exact scoped USB reverse | Passed |
| Two synthetic Customers and real C3C Android NTAG213 registration/assignment | Passed |
| Closed C3E1 Employee enrollment and authority-correct normal session | Passed |
| Customer-A server-backed Start | Passed |
| Active-work Web reassignment rejected with zero count/history mutation | Passed |
| Customer-A server-backed Stop | Passed |
| Explicit post-stop Web reassignment succeeds | Passed |
| Web and Android projections safely show Customer B | Passed |
| Customer-B server-backed Start and Stop | Passed |
| Exactly two immutable Assignment-history rows with one shared cutover timestamp | Passed |
| Pre-cutover lifecycle remains on A and post-cutover lifecycle remains on B | Passed |
| Exact receipt/audit counts and raw-payload nondisclosure | Passed |
| Web/Android sign-out and schema/login/listener/reverse cleanup | Passed |

The Human Physical Gate is passed for the authorized local repository/device scope. Production
resources/data, deployment/distribution, Web/iOS NFC, broader Membership administration,
TimeEntry correction, reporting/export and broader Block-E work remain outside this evidence.
Closure commit `a2fdebc`, tree `1872f9f`, passed exact-head ten-of-ten run `29652072268`;
independent read-only final review returned `APPROVED` with zero open P0/P1/P2/P3 and accepted the
documented attempt separation, safe-data evidence and cleanup. This closes the C3E2 Human physical
gate and governance synchronization for the authorized local repository/device scope.
