# Block C3E2 — Explicit NFC Tag Reassignment Implementation Evidence

Status: **LOCAL IMPLEMENTATION TECHNICAL-LEAD VERIFIED — COMMIT/PUSH, EXACT-HEAD CI, INDEPENDENT
IMPLEMENTATION REVIEW AND FRESH HUMAN PHYSICAL GATE PENDING**
Date: 2026-07-18
Contract Commit: `dbefc1cc2bab66bab87a00c3209bd8a1f926f731`
Implementation Baseline Commit: `5bc495107292d8cdd959c9c40319e8ae180099b3`
Implementation Baseline Tree: `0b8a2d01439af55d86696127ae1f1bc748c3a4ce`
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

No exact-head CI or independent implementation review is claimed by this local evidence.

## 5. Technical-Lead disposition and next gate

The local implementation diff matches Sections 3–13 and has no open Technical-Lead finding.
Unrelated user work is excluded from the candidate.

The exact next sequence is:

1. create and push one focused implementation commit;
2. obtain a ten-of-ten exact-head GitHub Actions run;
3. obtain independent read-only implementation architecture/security review bound to exact
   commit/tree/CI;
4. only after an `APPROVED` review may the complete fresh Human Physical Gate begin at its first
   checklist row.

No observation from an earlier C3D/C3E1 attempt can satisfy C3E2. Production resources/data,
deployment and distribution remain unauthorized.
