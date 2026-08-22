# Development Assignment 1 — DA1-PHYS-03 Independent Exact-Delta Review

Date: 2026-07-20
Status: **APPROVED — ZERO OPEN P0/P1/P2/P3; DA1-PHYS-03 REPOSITORY FINDING CLOSED**
Review mode: Independent, read-only exact-delta architecture/security/evidence review

## 1. Exact binding

The independent reviewer verified the complete linear chain:

- independently reviewed predecessor
  `bc89c70bda3be78355964cd27cb462170670eeaa`, parent
  `8d1a0d86539790028526e8d62c1f867c1b68fe57`, tree
  `b7a64a9c7a94454ffd4f7cf981b788369a2d9e63`;
- focused product correction
  `7dbda3bc0a56009c7e6931e3ad8320514f64f4a8`, parent `bc89c70`, tree
  `e6abc9ebaadc70cf4b2f78caa46f332b3fb21309`; and
- reviewed ADO synchronization head
  `798bada77a4fbc7ba235bc692afcf3bd9ffc760b`, parent `7dbda3b`, tree
  `d181370ca6e2199ca76d46313ad57113c52cd100`.

The complete `bc89c70..798bada` delta contains exactly 14 files, 557 additions and 63 deletions:
seven Mobile/offline-contract source and test files plus seven ADO files. Backend, API,
PostgreSQL, Admin Web and Core production code are unchanged. `git diff --check` passed.
The reviewer independently confirmed `HEAD == origin/main` and a clean tracked Working Tree.
The pre-existing untracked `research/` remained unread, unlisted and unchanged.

The reviewer changed no file and created no commit.

## 2. CI binding

Both GitHub Actions runs were independently retrieved and bound to their exact push heads:

- run `29700339367`, attempt 1, head `7dbda3b`, ten of ten jobs successful; and
- run `29700546787`, attempt 1, head `798bada`, ten of ten jobs successful.

Each was a push to `main` with no re-run marker.

## 3. Final verdict and finding disposition

Final verdict: **APPROVED**.

There are no open P0, P1, P2 or P3 findings. `DA1-PHYS-03` is closed as a repository finding.

The failed third Gate-D observation remains historical evidence. Repository closure means only
that the independently reviewed correction satisfies its technical, security and evidence
requirements. It does not convert that failed run into a physical pass, complete Development
Assignment 1 or authorize a fourth run.

## 4. Third-run truth reviewed

The reviewer confirmed the exact third-run binding:

- product `869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`, tree
  `325fdd5b003e1bccaee15eeac6b0b82826316554`;
- reviewed ADO head `8d1a0d86539790028526e8d62c1f867c1b68fe57`, tree
  `3464697130900ed55e68acc02e5fb5af41db90a5`;
- review synchronization head `bc89c70bda3be78355964cd27cb462170670eeaa`, tree
  `b7a64a9c7a94454ffd4f7cf981b788369a2d9e63`;
- exact-head run `29697976617`; and
- the 95,418,203-byte APK with SHA-256
  `0f2e0ea9385dd34ecd3f24da4970d11ab50df77f44debf82d5b0009e7dfa44c5`.

Gates A–C passed afresh. Gate D preserved the server boundary:

- sequence 11: `synchronized`, `active_entry_for_other_target_rejected`;
- sequence 12: `review_pending`, `historical_configuration_not_valid`, no canonical decision;
- sequence 13: `review_pending`, `predecessor_requires_review`, no canonical decision; and
- exactly one decision and no TimeEntry across sequences 11–13.

The failure was limited to Mobile truthfulness. After durable acknowledgement/deletion, a later
session/lease refresh replaced the transient review warning with `Bereit zum Scannen` while
review predecessor 12 remained unresolved on the server. The P1 classification was consistent:
server-canonical authority and mutation safety held, but the mandatory Gate-D presentation did
not. Gate E was not started and complete abort cleanup passed.

## 5. Durable-review correction assessment

The reviewer adversarially confirmed:

- local schema version 2 adds only nullable `review_pending_sequence` to the encrypted,
  identity-bound owner singleton;
- version 1 migrates through `ALTER TABLE ADD COLUMN` inside an exclusive transaction;
- the marker is set only through `COALESCE`, is never automatically cleared and retains the
  earliest sequence;
- marker update and exact Sequence/WorkEvent/Receipt head deletion run in the same exclusive
  transaction, with `changes !== 1` guards causing complete rollback;
- invalid marker values fail closed and existing owner/identity/protected-state boundaries remain
  intact;
- the scheduler reads the marker fail-closed whenever the queue is empty;
- the coordinator reads queue count and marker together, rechecks lifecycle staleness, fails
  closed on read error and lets `server_review_pending` dominate authenticated/offline-ready
  publication; and
- the marker contains no token, raw NFC data, provider identity or server decision.

No client authority, automatic adjudication, BusinessEngine rule, backend/API/PostgreSQL behavior,
Assignment rule or numeric ADR-0012 policy changed. The shared local schema-version constant has
no unexpected server consumer.

The reviewer found no remaining downgrade path.

## 6. Regression assessment

The three new regression areas were accepted as effective:

- durable review persistence before FIFO deletion and dominance on a later empty trigger;
- dominance across authenticated lease restoration; and
- exclusive version-1-to-2 migration plus atomic marker/deletion rollback.

The first two behavior tests necessarily fail against the previous transient-only
implementation. The migration test covers the declared additive `ALTER TABLE` path. An additional
real SQLite/SQLCipher migration test was not required for the authorized correction scope; the
next complete fresh gate starts with deleted app state and will exercise native version-2
creation.

## 7. Independent verification

The reviewer independently reproduced on head `798bada`:

- Mobile 409/409 in 29 files;
- Offline Contract 7/7;
- Core 290/290;
- Admin Web 44/44;
- Administration Contract 4/4;
- Mobile and Offline Contract tests-inclusive TypeScript checks;
- Offline Contract build; and
- `git diff --check`.

The reviewer also proved that the Mobile TypeScript configuration includes all 29 test files.

The review sandbox lacked PostgreSQL, the Android toolchain and the host APK path. It therefore
did not independently reproduce the PostgreSQL suites, Expo export, backup-boundary verifier,
690-task native build or APK hash:

- correction APK size: 95,422,571 bytes;
- correction APK SHA-256:
  `e634f03a0eedf43a3c1d2d7d94213c223ea13c627556e641e39c9d08c4f93623`.

Those environment limits were transparently reported and not described as independently passed.
They were accepted as non-findings because both exact-head ten-job CI runs are green, the
repository correction is fully regression-tested and the missing on-device proof remains
explicitly assigned to a later separately authorized gate.

## 8. Governance result

The reviewer confirmed all seven changed ADO surfaces distinguish:

- the failed third run;
- the independently reviewed repository correction;
- the absent corrected physical result;
- the absent fourth-run authorization; and
- the continuing prohibition on production resources/data, deployment and distribution.

No artifact prematurely claimed `DA1-PHYS-03` closure, a physical pass, Development Assignment 1
closure or production authority at the reviewed head.

## 9. Exact next gate

With this independent `APPROVED` verdict and zero open P0/P1/P2/P3, `DA1-PHYS-03` may be closed
as a repository finding. After truthful ADO synchronization and green exact-head CI, the Human
Architect may separately authorize a fourth complete fresh Gate A–E run.

Any such authorization must bind:

- independently approved product correction `7dbda3b`;
- reviewed ADO head `798bada`;
- the later review-synchronization head and its exact-head CI;
- exact APK/Web/harness artifacts; and
- a full restart at Gate A step 1 without reusing any observation from the three failed runs.

This review itself neither starts nor authorizes that run. A successful physical run,
truthful closure synchronization and independent final closure review remain required before
Development Assignment 1 can close. Production resources/data, deployment and distribution
remain unauthorized.
