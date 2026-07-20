# Development Assignment 1 — DA1-PHYS-04 Independent Exact-Delta Review

Status: **APPROVED — ZERO OPEN P0/P1/P2/P3; DA1-PHYS-04 REPOSITORY FINDING CLOSED;
FIFTH COMPLETE FRESH HUMAN PHYSICAL GATE MAY BE SEPARATELY AUTHORIZED BUT IS NOT AUTHORIZED
BY THIS REVIEW**
Date: 2026-07-20
Review type: Independent read-only exact-delta architecture, security, concurrency and governance
review

## 1. Review mandate and authority boundary

The review independently assessed the focused `DA1-PHYS-04` correction and its ADO publication
binding. It did not implement or authorize any product, physical or production action.

The reviewer changed no tracked repository file, created no commit or push and neither read nor
listed `research/`. Production resources, production data, deployment and distribution remained
unauthorized.

## 2. Exact binding

Authorized correction baseline:

- commit `3dd798376180051c0dbd8d9e4ee058acff89b43f`;
- tree `e78b5268eb53fd5659461ee290778f7bf3bb70a0`; and
- exact-head GitHub Actions run `29716007657`, attempt 1, ten of ten jobs successful.

Published correction:

- commit `48a21a7ed75c3ab3b15fec93669b5ca2d87d5a30`;
- tree `7c053beeb0c9ef550216bd1dad0a59fc226866a6`;
- exact parent `3dd798376180051c0dbd8d9e4ee058acff89b43f`;
- exact 24-file `+3027/-37` delta; and
- exact-head GitHub Actions run `29743923158`, attempt 1, push to `main`, ten of ten jobs
  successful.

ADO publication synchronization:

- commit `2f6035b1da9e7946cfca8d10c3d406a8c0b852ec`;
- tree `d5513a6ec2fe99c4f2b6fae9b3452004453b965b`;
- exact parent `48a21a7ed75c3ab3b15fec93669b5ca2d87d5a30`;
- exact seven-ADO-file `+107/-68` delta; and
- exact-head GitHub Actions run `29744637928`, attempt 1, push to `main`, ten of ten jobs
  successful.

At review time `HEAD` and `origin/main` both resolved to
`2f6035b1da9e7946cfca8d10c3d406a8c0b852ec`. `git diff --check` and
`git status --untracked-files=no` were clean.

## 3. Mobile continuity and fail-closed result

The review confirmed that `MobileSessionCoordinator` exposes only a private frozen,
credential-free restoration snapshot containing `generation`, `restorationRevision` and trusted
failure `source`.

The restoration revision remains unchanged only for the exact retained provider-suspended
context:

- public state is `context_unavailable`;
- restoration remains eligible;
- a refresh path still exists;
- no provider session grant or access token exists;
- the refresh token is unchanged; and
- the trusted source remains `provider_suspended`.

Credential acceptance, authority/source change, logout or identity change rotates or invalidates
that evidence. Public `context_unavailable` equality alone cannot preserve a capture.

`OfflineCaptureCoordinator` preserves exactly one active in-flight offline capture only while the
private snapshot remains current. Before durable append it revalidates the complete bound active
Owner/Installation/Lease context and performs repeated current-capture checks at asynchronous
boundaries. Uncertainty, storage failure, cross-identity change, owner/install change, logout and
genuinely stale asynchronous results remain fail-closed.

The review found no new client authority, local business decision, ADR-0012 relaxation, numeric
policy change, migration, dependency, lockfile or native-configuration change.

## 4. Gate-C helper result

The review confirmed that the durable helper and runbook:

- bind only numeric loopback `127.0.0.1`;
- listen on port `3001` and forward only to runtime port `3000`;
- accept only exact `POST /v1/lifecycle-events/offline`;
- require a complete upstream HTTP 200 before the Mobile response is dropped;
- send neither response headers nor response body to Mobile for the claimed drop;
- block later requests;
- require exactly one eligible USB-connected ADB device;
- reject wireless devices and emulators;
- use only scope-bound reverse mappings;
- serialize restore/close and retain fail-closed recovery; and
- emit only fixed disclosure-safe events.

The required durable operator procedure is
`ADO/04_Operations/Development_Assignment_01_Gate_C_Response_Drop_Runbook.md`.

## 5. Independent verification

Independently reproduced:

- Mobile: 415/415 in 30 test files;
- `OfflineSchedulingLifecycle.test.ts`: 4/4 plus five separate green repetitions;
- Gate-C helper: 27/27;
- Mobile and Synthetic tests-inclusive typechecks; and
- clean Git bindings and diff checks.

The reviewer accepted the layered database evidence as accurately described: the real
Coordinator/Scheduling/Capture chain reaches the injected 32-byte database boundary, while
production database tests separately prove SQLCipher key-first and FIFO behavior. No same-test
native SQLCipher E2E claim was made.

Not independently reproduced:

- PostgreSQL-17 Synthetic Harness 45/45;
- migrations 001–010 apply/rerun/ledger;
- Android export;
- native release build; and
- the uninstalled 95,425,607-byte APK with SHA-256
  `b34572b9813c4fb8013b09a4a530e5bc88ed4730ceacda46f6fe682bca88c6c0`.

Those items remain supported by the verified exact-head CI and recorded Technical-Lead evidence,
but are not described as independently reproduced. The existing eleven moderate transitive
`uuid@7.0.3` toolchain advisories remain disclosed; the reviewed delta changed no dependency.

## 6. Findings and verdict

Open P0 findings: none.

Open P1 findings: none.

Open P2 findings: none.

Open P3 findings: none.

Final verdict: **APPROVED**.

`DA1-PHYS-04` is closed as a repository finding. The failed fourth physical run remains historical
failure evidence and supplies no corrected physical observation.

## 7. Fifth-gate boundary and exact next step

After truthful synchronization of this result and green exact-head CI, the Human Architect may
separately authorize a fifth complete fresh Gate A–E run bound to:

- the independently approved correction commit/tree;
- the ADO review-synchronization commit/tree and its exact-head CI;
- the exact uninstalled candidate APK and SHA-256;
- the unchanged Web/Harness artifacts; and
- the reviewed Gate-C runbook/helper.

The run must begin again at Gate A step 1 and may reuse no observation from any of the four failed
runs.

This review does not authorize that gate. Production, production data, deployment and distribution
remain unauthorized.
