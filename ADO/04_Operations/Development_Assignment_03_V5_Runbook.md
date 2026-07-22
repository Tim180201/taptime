# Development Assignment 3 — V5 Human Functional/Physical Gate Runbook

Status: **DA3-PHYS-02 FOCUSED ADO-ONLY CORRECTION INDEPENDENTLY APPROVED/CI-GREEN; HUMAN ACCEPTANCE AND NEW EXACT-BOUND AUTHORIZATION REQUIRED; NO NEW RUN AUTHORIZED**
Owner: Technical Lead
Approval authority for any later physical run: Human Architect

## 1. Purpose and authority boundary

This runbook defines one focused, fresh Human observation of the already implemented DA3 boundary:

1. an Administrator corrects one stopped canonical time record and exports the effective result;
2. a real Android offline sequence creates two durable review items;
3. partial adjudication retains the Mobile review marker; and
4. complete exact-prefix adjudication lets authenticated Mobile reconciliation clear that marker.

Preparation, local harness code, automated verification and artifact creation are authorized only
for the exact enablement scope recorded in the DA3 V5 evidence. **This document does not authorize
the Physical Gate itself**, an APK install, production resources/data, deployment or distribution.
A later run requires a new, separate Human-Architect authorization bound to the independently
approved exact source/ADO commits, trees, CI and immutable candidate artifacts.

## 2. Fixed safety boundary

- Use only numeric loopback, USB `adb reverse`, the disposable database named
  `taptime_synthetic_android_e2e`, reserved `.invalid` identities and synthetic Customers/Tags.
- Use exactly one Human-authorized USB Android device and exactly two Human-authorized synthetic
  NFC tags. TCP/Wireless ADB, emulators, LAN, tunnels and cloud resources are prohibited.
- Do not record passwords, tokens, invitation secrets, raw NFC UID/canonical payloads, provider
  subjects, device serials, local encryption keys, internal UUIDs or real-person data.
- Evidence is limited to exact repository/artifact bindings, public synthetic labels,
  12-character validation fingerprints, safe UI states and aggregate counts.
- A failed, interrupted or ambiguous observation invalidates the entire run. No observation or
  database state from that run may be reused.
- Do not use `research/` for preparation, execution or evidence.

## 3. Mandatory exact binding before a later run

Do not install or begin the gate until all of the following are recorded and independently checked:

1. exact product commit/tree and exact ADO/review-synchronization commit/tree;
2. complete green GitHub Actions matrix on every binding head required by the current R3 evidence;
3. independent exact-SHA V5-enablement review with zero open P0–P3 findings;
4. read-only APK path, byte size, SHA-256, package, version, signature scheme and signer digest;
5. exact Admin Web and synthetic harness source/build binding;
6. approved device model/OS/USB transport and the two approved synthetic tag fingerprints; and
7. a separate Human authorization quoting those exact bindings and authorizing this fresh run.

Any changed source, ADO, lockfile, CI result, artifact or required configuration invalidates the
binding and requires fresh R3 verification, independent review and Human authorization.

### 3.1 Reproducible artifact construction before binding

Artifact construction is preparation only and does not authorize installation or the gate. Use a
fresh detached worktree at the exact product commit; never delete or replace a pre-existing
`apps/mobile/android` directory. With the locked dependencies, Node 24, Java 17 and the configured
Android SDK, run in order:

```bash
npm ci
npm run build --workspace=@taptime/core
npm run build --workspace=@taptime/offline-sync-contract
npm run build --workspace=@taptime/time-review-contract
npm run android:synthetic-e2e:build --workspace=@taptime/mobile
```

Require exit code zero plus `offline_storage_android_backup_boundary_verified`,
`synthetic_e2e_android_runtime_complete_verified` and `synthetic_e2e_android_apk_ready`. Copy the
APK out of the disposable worktree, make the APK and adjacent binding manifest read-only, and
recompute size, SHA-256, package/version, signature scheme/signer digest, packaged manifest backup
boundary and Hermes runtime completeness from the copied binary. Do not invoke ADB or install the
package during artifact construction. A failed or partially red preparation command contributes no
artifact evidence.

## 4. Local preflight after authorization

1. Verify the checked-out commit/tree and clean tracked worktree against the authorization.
2. Recompute every artifact property from the read-only candidate. Do not rebuild in place.
3. Confirm exactly one USB device, NFC enabled, no pre-existing synthetic package and an empty
   `adb reverse` table. Stop on any unrelated or unexpected mapping.
4. Start the disposable PostgreSQL/Auth/API harness and loopback-only Admin Web exactly as described
   in `apps/synthetic-android-e2e/README.md`.
5. Install the exact authorized APK with the scoped helper and verify only the approved Auth/API
   reverse mappings.
6. Run `status`. Require zero lifecycle, correction, adjudication and export evidence before setup.
7. In Admin Web, require exactly the two Customers already seeded by the fresh harness:
   `Synthetic Android Customer` and `Synthetic Reassignment Target`. Create no additional Customer
   during this V5 run. Through the real Administrator Android setup path, provision approved Tag A
   to `Synthetic Android Customer` and approved Tag B to `Synthetic Reassignment Target`. Record
   only labels, fingerprints and aggregate counts. Sign out Android.
8. Run sanitized `status`. Require exactly two Tags, two active Assignments, two administration
   receipts and four setup AuditEvents, with zero lifecycle, correction, adjudication and export
   evidence.

### 4.1 Mandatory clean exact-artifact identity boundary

The Administrator setup installation is prerequisite-only and must never continue into Employee
Gate A. After step 8, perform exactly this boundary while keeping the same harness/database and
server-side prerequisite rows:

1. Recompute size, SHA-256, mode, package/version, signature/signer, backup boundary and Hermes
   runtime completeness from the same read-only authorized APK. Require exact equality with the
   authorization and initial-install preflight.
2. Run the scoped synthetic disconnect helper. Require the complete reverse table to be empty;
   any unrelated or unexpected mapping fails the complete run.
3. Require exactly one installed `com.tim180201.mobile.synthetic` package. Uninstall only that
   exact package with `adb uninstall com.tim180201.mobile.synthetic` on the authorized USB device
   and require the exact successful result. Never use `pm clear` as a substitute.
4. Require zero installed synthetic packages and an empty reverse table. Do not clear another
   package, invoke backup/restore, reset the device or mutate the disposable database.
5. Without rebuilding or changing the APK, run the same reviewed install helper against that exact
   read-only file. Because the package is absent, this creates a new clean installation rather
   than updating or retaining the Administrator-owned store.
6. Require exactly one installed synthetic package and exactly the two approved mappings
   `tcp:54321 -> tcp:54321` and `tcp:3000 -> tcp:3000`. Recompute the host APK SHA-256 again and
   require the exact authorized value.
7. Run sanitized `status`. Require the step-8 server-side setup counts to remain byte-for-byte
   equivalent at the aggregate level and every lifecycle/DA3 count to remain zero. Do not repeat
   Administrator setup and do not reuse any local Administrator observation after uninstall.
8. Launch the clean installation and sign in only as the synthetic Employee. It must reach the
   normal authenticated capture surface without `protected_pending`; otherwise fail the complete
   run before presenting a Tag.

Every uninstall, mapping removal and reinstall above is part of one later separately authorized
fresh run and must be named explicitly in that authorization. A failed, interrupted or ambiguous
boundary invalidates the whole run. Perform Section 8 cleanup; never repair, retry or continue
inside that run.

## 5. Gate A — correction and effective export

1. Sign in on Android as the synthetic Employee. Scan Tag A to start, wait at least six seconds,
   scan Tag A again to stop, then sign out.
2. Sign in to Admin Web as the synthetic Administrator and refresh. Require exactly one selectable
   stopped canonical record in the current bounded window.
3. Select it, enter a small past, non-overlapping replacement interval and the synthetic reason
   `DA3 V5 correction observation`. Check the displayed before/after values, then use the explicit
   second confirmation.
4. Require the append-only success notice and revision increment. Refresh and require the corrected
   values to persist.
5. Export CSV through the real Web action. Require HTTP/UI success, the unchanged CSV-v1 columns
   and formula-safe dialect, and the corrected effective timestamps exactly once. Do not record an
   internal ID or the CSV body; record only the safe comparison result and file hash/size if needed.
6. Run sanitized `status`. Require exactly one added time-record revision, one correction receipt,
   one correction AuditEvent and one export audit, with no base WorkEvent/Decision mutation caused
   by correction or export.

Any active-record correction, missing second confirmation, stale/raw value in CSV, duplicate row,
unexpected disclosure or count mismatch fails the complete gate.

## 6. Gate B — create and retain a real review predecessor

Use the DA1-proven historical cutover, starting from a clean offline queue and no review marker:

1. Ensure Tag A has no active time record; start Tag B online so another target is active.
2. Enter the valid cold offline state and capture Tag A once before cutover.
3. While Android remains offline, use Admin Web to reassign Tag A explicitly to the second Customer.
4. Capture stale Tag A once after cutover, then capture Tag B as the successor.
5. Restore only the approved mappings/connectivity and allow automatic FIFO synchronization; do
   not invoke a per-event retry.
6. Require the three durable outcomes in order:
   `active_entry_for_other_target_rejected`,
   `review_pending/historical_configuration_not_valid`, then
   `review_pending/predecessor_requires_review`.
7. Require zero canonical Decision/TimeEntry mutation for both review-pending events. Mobile must
   drain the queue yet display `Sichere Prüfung erforderlich`.
8. Force-stop and cold relaunch. The same review-required state must persist.

## 7. Gate C — partial retain, complete adjudication and exact Mobile clear

1. Refresh Admin Web. Require the two review items in their server order and no local-only evidence.
2. Adjudicate only the oldest item with `Keine Arbeitszeit ändern` and reason
   `DA3 V5 partial prefix observation`; inspect and explicitly confirm the decision.
3. Foreground/restart Android. Because one successor remains unresolved, Mobile must still display
   `Sichere Prüfung erforderlich`; a ready state here fails the gate.
4. Adjudicate the remaining oldest item with `Keine Arbeitszeit ändern` and reason
   `DA3 V5 complete prefix observation`, again with explicit confirmation.
5. Foreground authenticated Android. Require exact server high-water proof to clear the encrypted
   marker and return to `Bereit zum Scannen`; do not clear app storage or reinstall.
6. Force-stop and cold relaunch. Require `Bereit zum Scannen` to persist with an empty queue and no
   review marker.
7. Run sanitized `status`. Require exactly two append-only adjudications, two command receipts,
   their exact summary AuditEvents, no unresolved predecessor, and no mutation/deletion of the
   original offline reconciliation evidence.

## 8. Evidence, abort and cleanup

Record one fresh evidence section containing the exact authorization/bindings, each Gate result,
safe aggregate before/after counts, disclosure result and cleanup result. Screenshots are optional
and must contain no protected values.

On any failure: stop interaction, preserve only disclosure-safe diagnostics, mark the whole run
failed, and perform the same cleanup below. Do not repair or resume inside the failed run.

Final cleanup is mandatory whether the run passes or fails:

1. sign out Mobile and Admin Web; clear the Web password field and system clipboard;
2. delete the downloaded synthetic CSV and any temporary screenshot after evidence extraction;
3. stop Admin Web and the harness normally;
4. run the scoped synthetic disconnect helper; never use `adb reverse --remove-all`;
5. uninstall only `com.tim180201.mobile.synthetic`;
6. confirm listener count zero on 3000, 3001, 5173 and 54321;
7. confirm the approved reverse-mapping count and installed synthetic-package count are zero;
8. confirm the synthetic schema/migration ledger and generated runtime-role counts are zero;
9. confirm the tracked repository still matches the authorized head and report unrelated user
   files only by path/status, never by content; and
10. leave the pre-existing local PostgreSQL service and unrelated device/repository state intact.

Only the Human Architect or an explicitly delegated tester may mark the later physical observation
passed. Automated tests, CI, artifacts and this runbook alone do not pass V5 or close DA3.

## 9. First authorized-run historical disposition

The Human Architect authorized exactly one run on 2026-07-22. Exact artifact/device preflight and
real Administrator setup of both approved tags passed. Gate A then failed before an unambiguous
Start result with disclosure-safe Mobile state `Ausstehender Vorgang geschützt`; sanitized server
counts remained zero for lifecycle and DA3 correction/review/export evidence. Gates B/C were not
started and complete abort cleanup passed.

`DA3-PHYS-01` (P1) records the exact conflict: Administrator setup binds the encrypted local store
owner, explicit logout preserves that owner by design, and the following Employee session on the
same installation fails closed as an identity mismatch. Full evidence:
`ADO/05_Evidence/Development_Assignment_03_Physical_Validation_Evidence.md`.

Independent exact-delta review of the failure synchronization returned
`APPROVED FOR FAILURE SYNCHRONIZATION` with zero review findings while keeping `DA3-PHYS-01` open:
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_01_Failure_Synchronization_Independent_Review.md`.

This historical section changes no procedure and grants no repair. Do not execute this runbook
again until an independently reviewed correction and a new exact-bound Human authorization
explicitly replace the failed boundary. At that historical checkpoint the correction review had
passed and the new Human authorization had not yet been granted; Section 11 records its later
grant and consumed failed run.

## 10. DA3-PHYS-01 operational correction disposition

On exact baseline `f0c9db3d2fc8ed5fae3d54f147a696c56a79aec3`, tree
`27cabe61e25a77fe73427aded735dfb4e59cbe01`, the Human Architect selected and authorized the
operational clean exact-artifact reinstall boundary now specified in Section 4.1, including AVS
V0–V4 and independent review. The alternative product identity-transition rule is rejected for
this correction scope.

This correction changes no Mobile source, owner binding, encryption, logout behavior, API,
database, product rule or immutable APK. It deliberately preserves server-side synthetic setup
while removing only the prerequisite Administrator package/local store and installing the same
verified artifact into a new package state for Employee Gate A.

At this correction-publication checkpoint, Section 4.1 was not executable until complete authorized
verification, exact-head CI and independent review with zero open P0–P3 findings, followed by a
new separate Human authorization bound to the final source/ADO/CI/artifact/device/tag set. This
correction itself performed and authorized no ADB command, installation, Physical Gate, production
action, production data use, deployment or distribution.

The correction is published at `f7a2b1e159bd4715c40e3ee32e99b76c70ca9e18`, tree
`a8caed6ebcc6f01c4b025b0b64da5be96130542a`; exact-head GitHub Actions run `29935693909`, attempt
1, passed 12/12 jobs. Independent exact-delta review returned
`APPROVED FOR DA3-PHYS-01 OPERATIONAL CORRECTION` with zero P0–P3 findings. At that checkpoint,
Section 4.1 remained non-executable until a new Human authorization bound the review-publication
head/CI and every required source/artifact/device/tag/install/uninstall boundary. Section 11
records the later authority and failed replacement run.

## 11. First replacement-run historical disposition

The Human Architect issued the required exact-bound replacement-run authorization on 2026-07-22,
including both installations, the clean reinstall boundary, Gates A–C and cleanup. Exact
repository/CI/artifact/device/database preflight and the first installation passed. The run then
failed closed during Section 4 prerequisite setup before Tag B, the clean reinstall boundary or
any Gate A–C action.

`DA3-PHYS-02` (P1) records the pre-correction contradiction: a fresh harness already seeded exactly
two Customers, the former step 7 said to create two Customers, while step 8 required exactly two
administration receipts and four setup AuditEvents after two Tag provisions. Real Customer
creation contributed a receipt and AuditEvent, so following that literal create instruction made
the required aggregate unreachable. After two added Customers and one correctly assigned Tag A,
sanitized status was four Customers, one Tag, one Assignment, three administration receipts, four
AuditEvents and zero lifecycle/DA3 rows. Interaction stopped immediately; complete scoped cleanup
and zero-state verification passed. Full evidence:
`ADO/05_Evidence/Development_Assignment_03_Physical_Validation_Evidence.md`.

No retry, repair or resume is authorized. Independent read-only review of failure synchronization
`abd58be`/tree `b2cb210` and run `29939539390` returned
`APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-02 CORRECTION CANDIDATE` with zero open P0–P3.
The Human Architect accepted that review and explicitly authorized the focused ADO-only correction
now implemented in step 7: use the two seeded Customers, create no additional Customer and retain
step 8's exact two-receipt/four-audit invariant.

This correction changes no source, harness, schema, dependency, product rule or APK. It was
published as `4d54dc2981759498de94571e2b2a4c6f134c88d5`, tree
`ad9b6ba661dae7572a8b825fe1ceadac8c108b79`, and passed exact-head run `29941019865`, attempt 1,
12/12. Do not execute this runbook again until this exact ADO-only delta has passed independent
exact-delta re-review, followed by a new separate Human authorization binding the final
publication/CI/artifact/device/tag/install/uninstall set.

Independent exact-delta re-review subsequently bound the complete
`abd58be3..53ec139` correction/Evidence range, exact parent chain, both 12/12 exact-head runs and
unchanged APK. It independently verified step 7's two exact seed names, no-additional-Customer
rule, Tag mapping and step 8's unchanged exact aggregate. Verdict:
`APPROVED FOR DA3-PHYS-02 ADO CORRECTION`; no open P0–P3 review findings. Review archive:
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_02_Correction_Independent_Exact_Delta_Review.md`.

Review archival publication `030dbf6`, tree `8695708`, passed exact-head run `29942397982`,
attempt 1, 12/12. This review and publication do not make the runbook executable. Explicit Human
acceptance and a new separate exact-bound Human authorization remain required. `DA3-PHYS-01` and
`DA3-PHYS-02` stay P1 open. No run, installation, ADB or retry is authorized.
