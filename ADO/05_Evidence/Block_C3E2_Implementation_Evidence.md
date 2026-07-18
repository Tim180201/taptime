# Block C3E2 — Explicit NFC Tag Reassignment Implementation Evidence

Status: **IMPLEMENTATION PUBLISHED/CI-VERIFIED, INDEPENDENT IMPLEMENTATION REVIEW APPROVED AND
COMPLETE FRESH HUMAN PHYSICAL GATE PASSED — ADO CLOSURE PUBLICATION/CI/FINAL REVIEW PENDING**
Date: 2026-07-18
Contract Commit: `dbefc1cc2bab66bab87a00c3209bd8a1f926f731`
Implementation Baseline Commit: `5bc495107292d8cdd959c9c40319e8ae180099b3`
Implementation Baseline Tree: `0b8a2d01439af55d86696127ae1f1bc748c3a4ce`
Implementation Commit: `b783733658f4c88ba3081737f13198afe7e719aa`
Implementation Tree: `7c779ee222cdd221b2b0ee89a954e263d0155595`
CI Integration Correction Commit: `672b7ac35dfd676138dd6c3999366de9ce25c80e`
CI Integration Correction Tree: `8b4c601919187dadb4a976a9a2d7c5ff6a3ec1c1`
Exact-head CI: GitHub Actions `29649388470`, attempt 1, ten of ten jobs passed
Final Reviewed Commit: `7050df43977fc79bba3483aada91b5f98ef0e3b0`
Final Reviewed Tree: `587ef8f5385d08af297a0c38322a2522cb7516a2`
Final Reviewed Exact-head CI: GitHub Actions `29649683173`, attempt 1, ten of ten jobs passed
Independent Implementation Review: **APPROVED — zero open P0/P1/P2/P3**
Fresh Human Physical Gate: **PASSED**
Owner: Technical Lead
Production/Deployment Authority: **Not granted**

## 1. Authority and scope

The Human Architect first accepted Sections 3–13 of the independently approved C3E2 contract while
explicitly withholding implementation authority. The later separate instruction `leg los!!!`
released the bounded repository implementation on the exact baseline above.

The implementation stays inside that release:

- explicit reassignment of one already assigned Tag to another active same-Organization Customer;
- no initial assignment, unassign, bulk CRUD, history rewrite or lifecycle-rule change;
- Admin Web as the only operator surface and Android as projection-parser compatibility only;
- local synthetic/PostgreSQL evidence only;
- no production resource, production data, deployment, distribution or physical-gate authority.

## 2. Implemented boundary

### Schema and authority

- Additive migration `009_explicit_nfc_tag_reassignment.sql`; migrations `001`–`008` are unchanged.
- Distinct `taptime_assignment_reassigner` executor and non-login BYPASSRLS function owner.
- A distinct `LOGIN NOINHERIT` runtime pool may assume only the identity resolver and reassignment
  roles.
- The existing global `(organization_id, command_id)` administration receipt namespace is extended
  with one exact `reassignNfcTag` result shape and database-authoritative digest.
- Runtime access is limited to tenant-qualified Assignment close/append, exact active-work reads and
  receipt access. It has no Customer/Tag/Membership/lifecycle mutation, delete or raw-payload read.
- The target-lock function owner has only Membership authority reads, Customer `id`/Organization/
  active reads and the minimal `UPDATE(active)` column privilege PostgreSQL requires for its
  `FOR SHARE` row lock. It is non-login and is not granted to the runtime login.
- Changed reassignment produces exactly `NfcAssignmentDeactivated` and `NfcTagAssigned` audits plus
  one receipt. Same-target no-op produces one receipt and no Assignment/audit mutation.

### Coordinator and HTTP

- `NfcTagReassignmentCoordinator` owns the exact precedence, eight-second transaction deadline,
  Membership/command/Assignment/target locks, replay, active-TimeEntry guard and atomic cutover.
- Old `valid_to`, new `valid_from`, both audits and receipt use one PostgreSQL transaction timestamp.
- `POST /v1/administration/nfc-tags/reassign` accepts only the five canonical UUID narrowing fields,
  rejects aliases/query strings/extra keys/shared narrowing headers and maps only the contracted
  disclosure-safe outcomes.
- Backend runtime configuration requires a seventh, username-distinct reassignment database URL.

### Safe clients

- Setup projection adds only `activeAssignmentId`; assigned and unassigned nullability is strict in
  backend, Admin Web and Android parsers.
- The C3C provision-success response shape is unchanged.
- Admin Web creates one explicit intent, shows safe label/fingerprint/current→target confirmation,
  disables the current target, retains its command ID only across ambiguous retry and destroys it on
  conflict/session/projection transition.
- Android adds no reassignment action and no new capture or persistence path.

## 3. Atomicity, history and race evidence

Fresh PostgreSQL integration tests prove:

- different-target close plus append, two audits and one receipt share the exact cutover timestamp;
- old Assignment target/validity start remain immutable and row version advances exactly once;
- same-target is receipt-only; replay is exact and divergent actor/Membership/content conflicts;
- missing, unassigned, foreign and stale Tag/Assignment states collapse to `assignment_conflict`;
- missing, inactive and foreign targets collapse to `assignment_target_unavailable`;
- an active TimeEntry blocks with zero mutation, remains normally stoppable, and the same receipt-free
  command succeeds after the canonical Stop;
- concurrent identical commands yield one mutation plus replay; concurrent different commands yield
  one success plus one stale conflict;
- the command namespace is independent across Organizations but not across command content/type;
- B6 holding the old Assignment completes its Start before C3E2 returns `assignment_in_use`;
- C3E2 holding the old Assignment commits first and the losing B6 snapshot is stored and replayed as
  old-target deferred evidence with zero Decision/TimeEntry mutation;
- injected failures after every mutation/audit stage, expired deadline, pre-commit interruption and
  terminated runtime connection all leave exact pre-command state and a healthy retry path.

The real local synthetic harness additionally proves stopped B6 lifecycle → C3E2 reassignment →
receipt replay against the actual API/runtime composition.

## 4. Verification

Fresh local results on Node 24 and PostgreSQL 17:

| Scope | Result |
|---|---:|
| Core | 290/290 |
| Mobile | 356/356, 23 files |
| Admin Web | 44/44, 5 files |
| Administration contract | 4/4 |
| Backend Administration | 121/121, 3 files |
| Backend API | 201/201, 5 files |
| Backend Schema | 125/125 |
| Backend Bootstrap | 189/189 |
| Backend Identity | 55/55 |
| Backend Lifecycle | 88/88 |
| Backend Read Model | 42/42 |
| Synthetic Android/Auth/API/PostgreSQL harness | 17/17 |
| B1 PostgreSQL harness | 39 passed, 2 unchanged optional Supavisor modes skipped |
| Total passed | 1,571 |

All workspace TypeScript checks passed. Test sources are included by their executed package
configurations. All workspace builds passed, including Admin Web Vite production build and
synthetic-harness declarations/bundles. `git diff --check` passed.

Focused implementation commit `b783733`, tree `7c779ee`, was pushed to `main`. Its first exact-head
run `29649322831` found one CI-only integration omission: the administration job had not built the
new test-only B6 dependency before TypeScript resolution. No product or PostgreSQL test failed.
Correction `672b7ac`, tree `8b4c601`, added that dependency build and C3E2 administration-step
labels. The final publication synchronization aligns the remaining top-level API/Mobile and
administration job labels with their executed C3E2 coverage. Exact-head run `29649388470`, attempt
1, passed all ten implementation jobs. Final reviewed head `7050df4`, tree `587ef8f`, then passed
exact-head run `29649683173`, attempt 1, ten of ten. Independent read-only implementation review
returned `APPROVED` with zero open P0/P1/P2/P3.

## 5. Human physical disposition

After the independent review opened Gate 10, the Technical Lead bound a freshly built/installed
synthetic APK, Admin Web and harness to exact head `7050df4`, tree `587ef8f`. The Human Architect
then completed a fresh Galaxy-A33/Android-15/NTAG213 sequence:

- real C3C protected Android registration/assignment to Customer A;
- closed C3E1 Employee enrollment and normal Employee session;
- Customer-A Start;
- explicit Web reassignment rejection while work was active and exact zero-mutation proof;
- Customer-A Stop;
- explicit successful Web A→B reassignment and matching Web/Android projections;
- Customer-B Start/Stop; and
- exact two-row Assignment history, shared cutover timestamp, A-before/B-after lifecycle
  attribution, exact receipt/audit counts, safe-data confirmation and complete cleanup.

Final sanitized counts were two Customers, one Tag, two Assignments, two administration receipts,
four WorkEvents, four canonical Decisions, four lifecycle Receipts, two stopped TimeEntries and ten
AuditEvents, plus the exact closed C3E1 identity/invitation counts. Detailed evidence:
`ADO/05_Evidence/Block_C3E2_Physical_Validation_Evidence.md`.

## 6. Technical-Lead disposition and next gate

The implementation matches Sections 3–13, independent implementation review is zero-finding and the
complete fresh Human Physical Gate passed. The remaining sequence is limited to:

1. publish this focused ADO-only closure synchronization;
2. require green exact-head GitHub Actions on that closure commit; and
3. obtain independent read-only final closure review before calling C3E2 independently closed.

Production resources/data, deployment and distribution remain unauthorized.
