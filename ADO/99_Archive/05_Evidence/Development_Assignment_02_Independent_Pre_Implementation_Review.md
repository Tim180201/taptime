# Development Assignment 2 — Independent Pre-Implementation Review

- Status: **APPROVED FOR CANDIDATE PUBLICATION — DA2-REV-01 CLOSED; ZERO OPEN P0/P1/P2/P3; HUMAN ACCEPTANCE AND IMPLEMENTATION AUTHORITY PENDING**
- Review Date: 2026-07-21
- Candidate Parent Commit: `e5978702eca7adb3de3fd85db37921b4a441ca59`
- Candidate Parent Tree: `98ae795bbf4e1d3eb44e12db62024272e861a279`
- Review Target: Uncommitted eight-file ADO-only DA2 candidate delta
- Initial Verdict: `CHANGES REQUIRED`
- Initial Finding Count: P0 0 / P1 0 / P2 1 / P3 0
- Final Re-review Verdict: `APPROVED FOR CANDIDATE PUBLICATION`
- Final Open Finding Count: P0 0 / P1 0 / P2 0 / P3 0
- Owner: Technical Lead
- Final Decision Authority: Human Architect
- Implementation Authority: **Not granted**

## 1. Review scope and binding

The independent read-only reviewer verified the candidate parent against `origin/main`, confirmed
tree `98ae795bbf4e1d3eb44e12db62024272e861a279` and reviewed exactly the original six modified and
two new ADO files:

1. `ADO/README.md`;
2. `ADO/00_Core/Decision_Log.md`;
3. `ADO/00_Core/Project_Status.md`;
4. `ADO/00_Core/Risk_Register.md`;
5. `ADO/05_Evidence/Core_Roadmap_v2_Commercial_Readiness.md`;
6. `ADO/05_Evidence/Product_Readiness_Roadmap.md`;
7. `ADO/01_Architecture/ADR/ADR-0013-tenant-safe-setup-integration-and-time-entry-export.md`; and
8. `ADO/02_Development/Development_Assignment_02_Setup_And_Export_Backend_Authorization.md`.

The reviewer reported an approximately `+724/-16` documentation-only delta, a clean
`git diff --check` and no source, test, dependency, workflow, build or configuration change. The
uncommitted candidate correctly had no candidate exact-head CI; no approval or implementation
authority was inferred from the parent evidence. The reviewer did not read or list `research/` and
did not read or modify the pre-existing untracked `app.json`.

## 2. Initial finding

| ID | Severity | Finding | Required correction |
|---|---:|---|---|
| DA2-REV-01 | P2 | `time_entries` stores `organization_id` and `user_id`, not a Membership foreign key. Membership history may contain multiple revoked/re-granted rows and `memberships.display_name` is nullable. The original DA2-P06/P07 export contract exposed `employee_membership_id` and `employee_display_name` without a deterministic User-to-Membership attribution rule, permitting duplicate or misleading CSV rows. | Define an explicit Human-decision candidate that maps every TimeEntry to at most one deterministic Membership; add revoked/re-granted race behavior and golden/PostgreSQL test obligations proving stable attribution and one row per TimeEntry. |

This table preserves the reviewer's finding accurately. The Technical Lead could not reproduce its
multiple-historical-Membership premise and records the contradictory repository evidence in
Section 4. The finding is neither waived nor independently closed.

## 3. Initial review disposition

The initial verdict is **CHANGES REQUIRED**. The reviewer found no other P0, P1, P2 or P3 issue.
Subject to DA2-REV-01, the reviewer confirmed:

- DA2 integrates instead of duplicating C3B/C3C/C3D/C3E1/C3E2/DA1;
- DT-063–DT-068 remain truthful Roadmap candidate labels;
- the actor, tenant, least-privilege, RLS, pool and audit boundaries are coherent;
- CSV/formula, range, duration, ordering, limit and post-commit audit semantics are testable;
- AVS-001 R3 V0–V4 is proportionate; and
- production, correction, UI, legal/privacy, deployment and distribution boundaries remain closed.

At the initial-review point no positive publication verdict existed. The renewed independent review
recorded in Section 5 later supplied `APPROVED FOR CANDIDATE PUBLICATION` with zero open P0–P3.

## 4. Technical-Lead finding disposition

DA2-REV-01 is **accepted with adjustment**. Its multiple-history/re-grant premise is rejected on
current repository evidence:

1. migration `001_foundation.sql` defines
   `CONSTRAINT memberships_organization_user_unique UNIQUE (organization_id, user_id)`;
2. migrations `002`–`010` do not drop, replace or relax that constraint;
3. `memberships_one_active_per_user` is an additional partial global index for active Memberships,
   not the only Membership uniqueness rule;
4. the Human-accepted C3E1 contract maps any active or historical Membership to fail-closed
   enrollment and explicitly excludes re-onboarding or Organization transfer;
5. C3E1 locks all historical rows defensively but creates no re-grant path; and
6. `memberships.display_name` being nullable is already covered by DA2-P07 and does not create a
   second Membership row.

Therefore a join on the TimeEntry's `(organization_id, user_id)` can return at most one retained
Membership row. Canonical TimeEntries are produced only after current server-side Membership
authorization, so the runtime path establishes that row before TimeEntry creation. Revocation
updates the same row; it does not create a replacement row. DA2-P06/P07 consequently identify one
stable Membership ID and either its immutable display name or the already specified empty value.

Adding a temporal DA2-P13/current-or-latest fallback would invent re-grant behavior that the schema
and accepted C3E1 contract currently forbid. No such architecture/product change is made.

The useful part of the finding is accepted: DA2-P07 now explicitly freezes the exact same-
Organization/User join, the retained stable Membership ID, empty display name for `NULL` and
disclosure-safe `service_unavailable` with zero bytes/success audit if out-of-band corruption leaves
no Membership row. Migration `011` must preserve `memberships_organization_user_unique`, and V1/V2
must prove the constraint, exactly one row per canonical TimeEntry, revoked-row stability and missing-
row rollback. No DA2-P13 is required because DA2-P07 is already a Human decision candidate.

This Technical-Lead correction did not override the independent `CHANGES REQUIRED` verdict. The
renewed independent review recorded below independently closed the finding.

## 5. Independent exact-delta re-review

The independent reviewer re-verified the exact parent commit/tree, live `origin/main`, exact-head CI
run `29837950454` attempt 1 with ten of ten successful jobs and the complete nine-file ADO-only
candidate. The reviewer confirmed six modified tracked files at `+104/-16`, three new files with 833
lines, approximately `+937/-16` in total, clean `git diff --check` and no source, test, dependency,
workflow, build or configuration change.

The reviewer expressly withdrew the first review's multiple-historical-Membership premise after
verifying:

1. `memberships_organization_user_unique UNIQUE (organization_id, user_id)` in migration `001`;
2. no removal or relaxation in migrations `002`–`010`;
3. no current runtime Membership re-grant/re-onboarding path;
4. C3E1's accepted fail-closed handling of every active or historical Membership;
5. current-Membership authority before canonical TimeEntry creation; and
6. no runtime `DELETE` authority on Memberships.

The re-review confirmed that adjusted DA2-P07 deterministically maps the exact TimeEntry
`(organization_id, user_id)` to the single retained Membership, preserves the stable ID after
revocation, serializes a `NULL` name as empty and fails a missing-row integrity error with
disclosure-safe `service_unavailable`, zero CSV bytes and zero success audit. It also confirmed that
the migration, race and V1/V2 obligations preserve/prove this boundary without inventing DA2-P13 or
Membership re-grant semantics.

Final finding disposition:

- DA2-REV-01: **closed**;
- P0: 0;
- P1: 0;
- P2: 0; and
- P3: 0.

Final verdict: **APPROVED FOR CANDIDATE PUBLICATION — ZERO OPEN P0/P1/P2/P3 FINDINGS.**

This verdict is not Human acceptance and grants no implementation, Physical, production,
deployment or distribution authority.

## 6. Current gate and next role

Current gate: **APPROVED FOR FOCUSED CANDIDATE PUBLICATION — HUMAN ACCEPTANCE AND SEPARATE
IMPLEMENTATION RELEASE PENDING**.

The next steps are:

1. focused ADO candidate publication and exact-head CI;
2. explicit Human acceptance, amendment or rejection of DA2-P01–DA2-P12; and
3. a later separate exact-baseline implementation authorization, if granted.

No dependency, migration, source, test, workflow, build, Physical Gate, production resource/data,
deployment or distribution action is authorized by this record.
