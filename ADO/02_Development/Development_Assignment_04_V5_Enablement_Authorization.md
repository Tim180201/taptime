# Development Assignment 4 — V5 Enablement Authorization Candidate

- Status: **F06 AUDIT-INVARIANT CORRECTION LOCAL V0–V3 GREEN; V4/EXACT-SHA REVIEW PENDING — HUMAN V5 UNAUTHORIZED**
- Date: 2026-07-23
- Candidate baseline commit: `4594529667fe1570045eea03fd7132bc27e2e479`
- Candidate baseline tree: `72338ec9b65dabdd71ab9011604817f61c13c288`
- Candidate baseline CI: GitHub Actions `30009920314`, attempt 1, 12/12 successful
- Published candidate commit: `5774ab7971f1c5df6834be44ab556c8138cfcf54`
- Published candidate tree: `062ded6af067967a3019a7d5abe42428ca58af0e`
- Published candidate CI: GitHub Actions `30012402185`, attempt 1, 12/12 successful
- Reviewed product commit: `f0f1e177628bd763c894a1d9c9c50a70168ffe1f`
- Reviewed product tree: `5259887894a0b97394c748a4556707c6582c93f8`
- Reviewed product CI: GitHub Actions `30009111061`, attempt 1, 12/12 successful
- Owner: Technical Lead
- Decision authority: Human Architect
- Risk class: current ADO-only candidate **R0**; proposed executable enablement **R3**

## 1. Objective and current gap

ADR-0015 requires a separately authorized Human V5 functional, visual and browser gate before DA4
closure. The reviewed Admin Web product is ready for that gate, but the current default
`apps/synthetic-android-e2e` profile seeds only two Customers and no DA4-specific multi-page
Employee, TimeRecord or review state. It therefore cannot truthfully exercise every required
cursor/completeness and privileged-action observation without Android/NFC activity or unreviewed
manual database preparation.

The smallest candidate is one opt-in, local, disposable DA4-V5 profile in the existing synthetic
harness. It prepares synthetic browser state for the unchanged real Admin Web and API. It neither
changes nor bypasses product behavior.

## 2. Proposed executable scope

A later explicit implementation authorization may change only:

- `apps/synthetic-android-e2e/src/**` for the opt-in DA4-V5 fixture/profile, disclosure-safe
  readiness/status and loopback-only serving of the exact built Admin Web;
- `apps/synthetic-android-e2e/tests/**` for profile isolation, deterministic fixture, aggregate
  invariant, disclosure and cleanup regressions;
- `apps/synthetic-android-e2e/package.json` only if a focused local profile/start command is
  required;
- `apps/synthetic-android-e2e/README.md`; and
- truthful ADO/evidence files.

The default harness profile and its current tests, ports, reset and cleanup behavior SHALL remain
unchanged.

## 3. Required profile contract

The proposed profile SHALL:

1. require an explicit allow-listed opt-in such as `TAPTIME_SYNTHETIC_E2E_PROFILE=da4-v5` and fail
   closed for missing or unknown values;
2. bind Auth, API and the built Admin Web only to numeric loopback ports `54321`, `3000` and
   `5173`;
3. use only the disposable `taptime_synthetic_android_e2e` database, generated runtime roles,
   synthetic labels and reserved `.invalid` login identities;
4. prepare exactly 21 Customer summaries, 21 projected Employee Memberships, 101 stopped effective
   TimeRecords, 101 unresolved ordered review items, one safely labelled Tag and exactly one
   initial active Assignment/history row;
5. prove the shared sorted setup cursor exactly: page 1 contains 20 Customers and zero Tags; page 2
   contains the remaining one Customer and one Tag. The Employee cursor is 20 then 1, while
   TimeRecords and review items are 100 then 1;
6. start with total Assignments `1`, active Assignments `1`, zero active invitations and zero
   V5-operator Customer, invitation, reassignment, correction, adjudication and export
   receipts/audits;
7. bind a disclosure-safe public test manifest for unambiguous Human selection: the exact labels,
   fixed operation names/reasons, uniquely labelled Correction and oldest-review targets, the
   isolated correction window and the exact safe correction shift defined by the runbook. The
   correction timestamps SHALL round-trip in the visibly declared browser IANA timezone and fail
   closed if invalid, non-existent or ambiguous;
8. expose only disclosure-safe readiness, aggregate-count and invariant-match events—never raw IDs,
   NFC payloads, tokens, passwords, invitation secrets, CSV bodies or personal data;
9. separate fixture preparation from every observed Human action; fixture writes and direct helper
   calls SHALL NOT count as Admin-Web evidence;
10. serve only an exact, manifest-bound production build of the reviewed Admin Web while forwarding
   only same-origin `/v1` requests to the loopback API;
11. provide one explicitly armed, single-use, read-only section-unavailable control limited to one
    allow-listed projection request; it SHALL emit only safe arm/consume state, reject concurrent
    or repeated use, perform no write and disarm on cleanup;
12. preserve the unchanged real Admin Web capability/coordinator/client, API routes, authorization,
    RLS, confirmation, append-only and CSV behavior for every counted action; and
13. enforce the runbook's fixed serial write allocation: three operations in Safari, then three in
    Chromium, each exactly once with a refresh/aggregate stop point; Firefox and every other
    browser/viewport pass remain read-only; and
14. stop and clean the schema, migration ledger, generated runtime roles, port listeners and
    profile-owned temporary build/download data on normal exit and startup/runtime failure.

The deterministic fixture may use trusted test-only installer authority before the Human session.
That authority SHALL not be reachable from the browser and SHALL not provide a product-operation
bypass.

## 4. Deterministic Human-action invariant

The profile SHALL record its exact disclosure-safe initial aggregate vector in memory. A complete
Human run may change it only through the six real Admin-Web operations below:

| Real Admin-Web operation | Required exact delta |
|---|---:|
| Create one Customer | Customers `+1`, setup receipt `+1`, general `audit_events` `+1` |
| Create one Employee invitation | Active invitations `+1`, invitation receipt `+1`, general `audit_events` `+1` |
| Reassign the fixture Tag once | Tags unchanged; Assignment history total `+1`, active Assignments unchanged at `1`, prior row inactive, reassignment receipt `+1`, general `audit_events` `+2` (`NfcAssignmentDeactivated` and `NfcTagAssigned`), target changes exactly once |
| Correct one stopped TimeRecord | TimeRecord total unchanged, revision `+1`, review command receipt `+1`, general `audit_events` `+1` |
| Adjudicate the oldest review item | Unresolved review items `-1`, adjudication `+1`, review command receipt `+1`, general `audit_events` `+1` |
| Export the effective window once | General `audit_events` `+1`; that same row is the one `TimeEntryExportGenerated` export-audit increment, not an additional row; no lifecycle/revision mutation |

The final projection totals are therefore exactly 22 Customers, 21 projected Employees, 101
TimeRecords, 100 unresolved review items, one Tag, two total Assignment-history rows and one active
Assignment. The final operator delta contains exactly seven general `audit_events` rows for the six
operations; exactly one of those seven is also counted by the filtered
`TimeEntryExportGenerated` export-audit aggregate. It also contains two time-review command
receipts and exactly one named receipt for Customer, invitation and reassignment. Any additional,
missing or double-counted delta fails the later run.

## 5. Explicitly unchanged and prohibited

The enablement SHALL NOT change:

- `apps/admin-web/**`, backend/API product code, neutral contracts, schema or migrations;
- dependencies, root lockfile, CI workflow or product runtime configuration;
- Mobile, Android, NFC, ADB, device, Tag or installation behavior;
- authentication, authorization, Membership, RLS, business rules, pagination limits, CSV format,
  append-only semantics or invitation lifetime; or
- production resources/data, deployment, hosting or distribution.

No actual password, invitation secret, internal identifier, NFC payload or production value may be
committed or emitted.

## 6. Adaptive Verification Plan

### Current ADO-only candidate

- Classification: AVS-001 R0.
- Required: V0 exact diff/scope, whitespace, reference, status/authority and protected-path checks.
- Product tests: not rerun; product evidence is carried from the exact bindings above.
- Publication: exact seven-ADO-file candidate `5774ab7971f1c5df6834be44ab556c8138cfcf54`,
  tree `062ded6af067967a3019a7d5abe42428ca58af0e`, passed CI `30012402185`, attempt 1,
  12/12. Independent exact-SHA review returned `APPROVED`, `MERGE_READY` and zero open P0–P3.

### Proposed executable enablement

- Classification: AVS-001 R3 because it handles local credentials, privileged synthetic state,
  runtime listeners, exact build binding and Human-gate evidence.
- V1: focused fixture/profile, fail-closed opt-in, single-use read-fault, disclosure and cleanup
  tests.
- V2: complete synthetic-harness suite/typecheck/build plus unchanged Admin-Web focused boundary.
- V3: complete locally executable repository regression required by the impact record.
- V4: focused publication, complete exact-head CI and independent exact-SHA review with zero open
  P0–P3.

Any R3 correction repeats the relevant V1–V4 sequence.

## 7. Gates and authority

Required sequence:

```text
ADO-only candidate and V0
  -> independent candidate review if required by the Technical Lead
  -> Human acceptance and exact-baseline implementation authorization
  -> focused R3 harness implementation and V0–V4
  -> independent exact-SHA implementation review
  -> separate exact-bound Human V5 authorization
  -> one fresh browser-only Human V5
  -> evidence publication, final review and DA4 closure decision
```

No arrow authorizes a later arrow. The Human Architect accepted this candidate and separately
authorized its R3 implementation on `decf806aeb2fd1619252a6efd62b71202e53eefb`, tree
`519a1a703bf4c55861b4c25e95cd651b2f7a51ee`, CI `30013796325`, attempt 1, 12/12.
Human V5, production, production data, deployment and distribution remain separately unauthorized.

The independent pre-implementation review is archived at
`ADO/05_Evidence/Development_Assignment_04_V5_Enablement_Independent_Pre_Implementation_Review.md`.
Its approval made this exact ADO candidate publication-ready only. Human acceptance and the
separate exact-baseline R3 implementation authorization were subsequently granted as recorded
above.

The implementation review is archived at
`ADO/05_Evidence/Development_Assignment_04_V5_Enablement_Independent_Implementation_Review.md`.
Round 1 bound `b63a0db`, tree `cd7ac40`, CI `30021272713` 12/12 and returned exactly one P2 with
zero P0/P1/P3. Focused correction `e731a77`, tree `6c2b34d`, exact parent `b63a0db`, passed final
V1 29/29, affected V2 78/78, final V3 1,825 tests and exact-head CI `30022981656`, attempt 1,
12/12. Round 2 returned `APPROVED`, `MERGE_READY / EXACT-SHA APPROVED` and zero open P0–P3.
The later `DA4-V5-F06` correction of the stale reassignment AuditEvent invariant requires its own
V4 and independent exact-SHA review before another separately exact-bound Human V5 Browser Gate.
That Human gate remains unauthorized.
