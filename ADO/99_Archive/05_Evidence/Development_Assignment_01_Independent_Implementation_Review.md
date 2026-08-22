# Development Assignment 1 — Independent Implementation Review and Correction Disposition

Date: 2026-07-19
Status: **INDEPENDENT EXACT-DELTA RE-REVIEW APPROVED WITH ZERO OPEN P0/P1/P2/P3 —
DA1-IMPL-01 CLOSED ON REVIEWED HEAD `767043d`, TREE `19c434a`; SEPARATE HUMAN PHYSICAL GATE
AUTHORIZATION MAY NOW BE REQUESTED BUT IS NOT YET GRANTED; PRODUCTION, DEPLOYMENT AND DISTRIBUTION
NOT AUTHORIZED**
Owner: Technical Lead

## 1. Exact original review binding

The received independent read-only implementation review was bound to:

- Human-accepted implementation baseline
  `180093091c47a926b5871a27ea8b00fb21b9b4ac`, tree
  `73e77b6ca5dfd7671cdd3d77a344168fddff3627`;
- implementation commit `4f51918993e02b7bf51a1194f8d4d750abfae7c4`, tree
  `617081f34e34cbf5e314a26f4cc634c846c2e319`;
- reviewed publication head `de895215b28110b8fe7129863df17795351b5795`, tree
  `443a697cb3e5d2f6339884ba504aa9103634fcf4`;
- implementation exact-head GitHub Actions run `29675842388`, attempt 1, ten of ten jobs; and
- publication exact-head GitHub Actions run `29675933304`, attempt 1, ten of ten jobs.

The reviewer independently confirmed the commit/tree/delta/CI bindings, the accepted ADR-0012
authority and numeric policies, the complete Workstream A–E scope, least privilege, tenant
isolation, encrypted Mobile persistence, FIFO synchronization and governance separation.
The review and focused correction did not read, list or modify `research/`.

## 2. Exact correction binding

The focused correction is published as:

- correction commit `c71399a349ec5615acee5abc13eda726bcdaa84f`;
- correction tree `7a159ce6e21548c69dd2a77fed3e17f3e7865212`;
- direct parent `de895215b28110b8fe7129863df17795351b5795`; and
- exact-head GitHub Actions run `29692113159`, attempt 1, push to `main`, ten of ten jobs
  successful.

## 3. Original verdict and finding

Original verdict: **CHANGES REQUIRED**.

Open findings at review time:

- P0: none;
- P1: none;
- P2: one — `DA1-IMPL-01`; and
- P3: none.

`DA1-IMPL-01` identified that the Offline ingestion coordinator serialized by
`OrganizationId + ":" + UserId`, while the existing canonical/deferred B6 boundary serialized by
`OrganizationId + U+001F + UserId`. Because `hashtextextended` hashes the complete byte sequence,
the two routes could evaluate concurrently for the same Organization/User during the compatibility
window. PostgreSQL uniqueness constraints still protected hard lifecycle invariants, but the
accepted shared serialization and deterministic duplicate-decision behavior were not proven.

## 4. Focused correction

The correction changes only the Offline coordinator's advisory-lock input to the byte-identical B6
framing:

```text
OrganizationId + U+001F + UserId
```

The PostgreSQL integration suite now drives the real
`ServerCanonicalLifecycleIngestionCoordinator` and
`OfflineLifecycleIngestionCoordinator` for the same Organization/User. It uses a real signed JWT,
holds the canonical transaction immediately after the shared lock is acquired, and observes through
`pg_stat_activity` that the Offline transaction is actively waiting at
`pg_advisory_xact_lock`. Before release, no WorkEvent is committed. After canonical commit, results
are deterministic: canonical `time_entry_started`, then Offline `duplicate_scan_ignored`.

The production change is one lock-framing line. The remaining delta is test-only dependency,
integration evidence and truthful governance.

## 5. Fresh correction verification

| Scope | Result |
|---|---:|
| Core | 290/290, 43 files |
| Mobile | 383/383, 27 files |
| Admin Web | 44/44, 5 files |
| Administration contract | 4/4 |
| Offline synchronization contract | 7/7 |
| Backend Schema | 125/125 |
| Backend Identity | 55/55 |
| Backend Read Model | 42/42 |
| Backend Lifecycle | 88/88 |
| Backend Bootstrap | 189/189 |
| Backend Administration | 121/121, 3 files |
| Backend Offline Synchronization | 13/13, 2 files |
| Backend API | 208/208, 6 files |
| Synthetic Android/Auth/API/PostgreSQL harness | 18/18, 2 files |
| B1 direct PostgreSQL harness | 39 passed, 2 unchanged optional Supavisor modes skipped |
| Total passed | 1,626 |

All 15 Workspace TypeScript checks and all available Workspace builds passed, including
declarations/bundles and the Admin-Web production build. `git diff --check` passed. A new Android
release build was not repeated because the production correction is server-only and changes no
Mobile/native source or dependency. Exact-head run `29692113159` independently reran the ten-job
CI matrix against the published correction and passed every job.

## 6. Independent exact-delta re-review

The renewed independent read-only review was bound to:

- final reviewed head `767043d8f91bc2806cb1bd111989cf9b741b858c`, tree
  `19c434a8ba4586aeb1344778cbe483504ce46a34`;
- the exact two-commit chain `de89521` → `c71399a` → `767043d`;
- the complete `de89521..767043d` delta of 12 files, +414/-48;
- correction run `29692113159`, attempt 1, ten of ten jobs; and
- final reviewed-head run `29692304824`, attempt 1, ten of ten jobs.

Final verdict: **APPROVED — zero open P0/P1/P2/P3**.

The reviewer independently confirmed that the one-line U+001F lock framing is byte-identical to
B6, that the real cross-route PostgreSQL test is regressionswirksam and that no authority, tenant,
BusinessEngine, TimeEntry, lease, sequence, reconciliation or numeric ADR-0012 rule changed.
Core 290/290, Mobile 383/383, Admin Web 44/44, Administration Contract 4/4 and Offline Contract
7/7 plus the tests-inclusive Offline typecheck were locally reproduced. The PostgreSQL-backed
matrix was independently bound to both green exact-head runs. `DA1-IMPL-01` is closed.

The review did not change the repository and did not read or list `research/`.

## 7. Gate disposition

The prerequisite independent implementation approval is now complete. The Technical Lead may
request the separate Human-Architect authorization for the complete fresh Physical Gate defined in
Authorization Section 9, Gates A–E.

The review does not itself authorize or start that gate. Until the Human Architect gives a distinct
explicit authorization, the Human Physical Gate remains closed. Production resources/data,
deployment and distribution remain unauthorized.
