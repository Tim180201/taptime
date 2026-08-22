# Development Assignment 1 — DA1-PHYS-01 Independent Exact-Delta Review

Date: 2026-07-19
Status: **APPROVED — ZERO OPEN P0/P1/P2/P3; DA1-PHYS-01 CLOSED**
Review mode: Independent, read-only exact-delta architecture/security/evidence review

## 1. Exact binding

The independent reviewer verified:

- failed-gate evidence baseline
  `bd1ad611c7f594caef70bc55308cd2155bb5735d`, tree
  `02bb5c449c6867cb2280ee6aa912a4c9dbc4070f`;
- focused product correction
  `04399fa7ef8b3e58e44e82a81c0b0757acae1adc`, tree
  `ecf5e6f9f5dbe83d9100deb98ab6126ef7473ead`;
- reviewed ADO head
  `76be116a5b3d62298bff5d784213a6da9a446c66`, tree
  `d320db3d77c9352422c73aaff378a4a18ff1396e`;
- exact product delta `bd1ad61..04399fa`, containing the eight declared Mobile files;
- exact ADO delta `04399fa..76be116`, containing the seven declared ADO files;
- exact complete delta `bd1ad61..76be116`, 15 files, 354 additions and 37 deletions;
- HEAD and `origin/main` both at the reviewed ADO head; and
- a clean tracked/staged Working Tree. The pre-existing untracked `research/` remained excluded,
  unread, unlisted and unchanged.

The reviewer changed no file and created no commit.

## 2. CI binding

Both GitHub Actions runs were independently retrieved and bound to their exact push heads:

- product correction run `29695449737`, attempt 1, head `04399fa`, ten of ten jobs successful;
  and
- reviewed ADO-head run `29695605706`, attempt 1, head `76be116`, ten of ten jobs successful.

## 3. Final verdict and finding disposition

Final verdict: **APPROVED**.

There are no open P0, P1, P2 or P3 findings. `DA1-PHYS-01` is closed.

The original Gate-A failure remains a truthful failed historical observation. Closing the finding
means the independently reviewed correction satisfies its required technical and evidence scope;
it does not convert the failed attempt into a passed gate and does not authorize a replacement
gate automatically.

## 4. SQLCipher correction assessment

The reviewer confirmed the root cause and correction:

- Expo's exclusive-transaction helper executes the task on a separately opened SQLite
  connection;
- SQLCipher key state and first-page salt creation are connection-local;
- the failed clean-first-start path separated actor keying from first-page
  creation/migration;
- the correction opens one non-cached, runtime-owned actor connection;
- `PRAGMA key`, `BEGIN EXCLUSIVE`, schema/data work, `COMMIT` and error `ROLLBACK` remain on that
  same connection;
- the key-bound process singleton prevents rebinding to a different key;
- the existing promise-tail actor serialization prevents overlapping or nested transaction
  brackets; and
- cipher/database integrity and wrong-/missing-key paths remain fail-closed without deletion,
  reinitialization or rebinding.

The two new adapter tests are regressionswirksam because the previous helper-connection
implementation cannot produce the asserted begin/task/commit or begin/task/rollback sequence on
the main connection.

No Business Rule, server-canonical lifecycle authority or client authority changed.

## 5. Android backup and transfer boundary

The reviewer confirmed:

- `android:allowBackup="false"` in base configuration and generated manifest;
- SecureStore automatic Android backup disabled;
- legacy full-backup exclusions;
- Android-12+ cloud-backup exclusions;
- Android-12+ device-transfer exclusions;
- exclusion of SecureStore shared preferences;
- exclusion of Expo SQLite under `files/SQLite`;
- exclusion of the Android database domain; and
- a build-enforced verifier over the generated and merged release manifests and both rule files.

OEM transfer tooling that disregards AOSP rules remains a theoretical platform residual risk.
The independently accepted defense remains fail-closed because restored encrypted bytes without
the non-exportable device-bound key enter the protected cipher-integrity path.

## 6. Verification assessment

The reviewer independently reproduced on the exact reviewed head:

- Mobile 385/385 in 28 files;
- Mobile tests-inclusive typecheck;
- Core 290/290;
- Admin Web 44/44;
- Offline Contract 7/7; and
- Administration Contract 4/4.

The review sandbox did not provide PostgreSQL, Android tooling, the Galaxy device or the host
APK path. The reviewer therefore classified the unreproduced PostgreSQL suites, 690-task Android
release build, merged-manifest verifier execution and device observations as a transparent
environmental verification limit, not a finding. The exact correction code, regressionswirksame
tests, build-enforced verifier, two independently verified ten-job CI runs and recorded native
evidence were sufficient for approval.

## 7. Governance result and next gate

The seven reviewed ADO surfaces truthfully preserved the failed Gate-A attempt, did not claim an
independent review prematurely, kept Gates B–E not started and retained the production,
production-data, deployment and distribution prohibitions.

With this independent `APPROVED` verdict and zero open P0/P1/P2/P3, the Human Architect may now
separately authorize a complete fresh Gate-A–E run. Any such run must:

- start again at Gate A step 1;
- bind the approved correction product head, the then-current ADO synchronization head, exact
  CI and the exact APK/Web/harness artifacts;
- reuse no observation from the failed attempt; and
- leave production resources/data, deployment and distribution unauthorized.

This review itself neither starts nor authorizes that run.
