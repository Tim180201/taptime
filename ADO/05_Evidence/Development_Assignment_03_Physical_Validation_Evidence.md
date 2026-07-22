# Development Assignment 3 — V5 Physical Validation Evidence

- Status: **FIRST AND REPLACEMENT RUNS FAILED CLOSED; DA3-PHYS-01 AND DA3-PHYS-02 (P1) OPEN**
- Date: 2026-07-22
- Owner: Technical Lead
- Human observer and approval authority: Human Architect
- Product commit/tree: `6eb68a3b4f9567600e12ec5a4f4b72ca4da99dca`,
  `bb8564fd0911d2b32dccb776f4a3f938621ee052`
- Product CI: GitHub Actions run `29927309720`, attempt 1, 12/12 successful
- V5 Evidence commit/tree: `f4e2eeb3bb47ed1dd3b2f0cf10fd0f725650d6ba`,
  `20e5715c448331f5d99536259743dccc7005dffb`
- V5 Evidence CI: GitHub Actions run `29928717227`, attempt 1, 12/12 successful
- Independent-review publication commit/tree:
  `b14262691753c2c5b5772558414b7f3b6e5dc9d4`,
  `9aa61806bc057bf71c119d1511adbbebab3a9080`
- Independent-review publication CI: GitHub Actions run `29930922165`, attempt 1, 12/12
  successful
- Operational-correction commit/tree: `f7a2b1e159bd4715c40e3ee32e99b76c70ca9e18`,
  `a8caed6ebcc6f01c4b025b0b64da5be96130542a`
- Operational-correction CI: GitHub Actions run `29935693909`, attempt 1, 12/12 successful
- Correction-Evidence-sync commit/tree: `1ed32637f44ed07f5515614bffc1e1d331f9db08`,
  `dc26ae74dc17997684ed712b43c019ded491da9d`
- Correction-Evidence-sync CI: GitHub Actions run `29936204801`, attempt 1, 12/12 successful
- Independent-correction-review publication commit/tree:
  `b8f1eb7262258a4242a4c8268969c92a05d20c55`,
  `71966b09f266c0cb3c1bba1eb0f71e97c1e8ea5b`
- Independent-correction-review publication CI: GitHub Actions run `29937437746`, attempt 1,
  12/12 successful
- Physical result: the first run failed at Gate A; the separately authorized replacement run
  failed during prerequisite setup before the clean reinstall boundary; Gates A–C were not started
  in the replacement run
- Unauthorized throughout: production, production data, deployment and distribution

## 1. Exact Human authority and boundary

After the independently approved V5 enablement and review publication, the Human Architect
separately authorized exactly one focused local run of
`ADO/04_Operations/Development_Assignment_03_V5_Runbook.md`. The authorization quoted all three
commits above and allowed only:

- the bound synthetic APK;
- installation and runbook-scoped USB ADB/loopback use on Samsung Galaxy A33 5G (`SM-A336B`),
  Android 15/API 35;
- the two synthetic NTAG213 tags with safe validation fingerprints `B55E8B6AEB30` and
  `32A54C8F2F29`;
- disclosure-safe evidence; and
- mandatory cleanup.

Production, production data, deployment and distribution remained explicitly unauthorized. This
authority was consumed by the failed fresh run. It grants neither a repair inside that run nor a
replacement run.

## 2. Exact artifact and preflight

Immediately before installation the Technical Lead recomputed and confirmed the read-only APK:

- path:
  `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da3-v5/6eb68a3/app-release-215b4c924f0b7702.apk`;
- 95,437,611 bytes, mode `0444`, SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`;
- package `com.tim180201.mobile.synthetic`, version `1.0.0` (`1`), target SDK 36;
- exactly one v2 signer, certificate SHA-256
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`;
- `allowBackup=false`, `usesCleartextTraffic=false`, both backup-rule references; and
- fresh `synthetic_e2e_android_runtime_complete_verified` Hermes verification.

The adjacent 2,206-byte, mode-`0444` manifest remained SHA-256
`07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`.
The Product, Evidence and review-publication CI runs were independently re-read and each resolved
to its exact head with 12/12 successful jobs. `main == origin/main == b142626...`; the tracked
worktree was clean. Untracked user-owned `app.json` and `research/` were preserved, and `research/`
was not read, listed, searched or changed.

The approved device was the only connected device, used USB transport, matched `SM-A336B`, Android
15/API 35 and reported NFC on. Before install, the reverse table and installed synthetic-package
count were both zero. Ports 3000, 3001, 5173 and 54321 had zero listeners. The dedicated disposable
database had zero connections and was freshly recreated. Harness and Admin Web were built/run from
an isolated detached worktree at exact Product commit `6eb68a3`; an existing unrelated ignored
Android build directory in the primary workspace was not overwritten or deleted.

The exact copied APK passed the reviewed install helper. Installation produced exactly the two
approved mappings `tcp:54321 -> tcp:54321` and `tcp:3000 -> tcp:3000` and exactly one installed
synthetic package.

## 3. Fresh prerequisite observation

Initial sanitized status was:

- two seeded synthetic Customers;
- zero Tags and Assignments;
- zero administration receipts and AuditEvents;
- zero WorkEvents, Decisions, synchronization receipts and TimeEntries; and
- zero revisions, correction receipts, export audits, review adjudications, review command
  receipts and predecessor cursors.

The Human Administrator used the real Android setup path and confirmed both successful assignments
and exact safe fingerprints:

| Tag | Customer | Safe fingerprint |
|---|---|---|
| `DA3 V5 TAG A` | `Synthetic Android Customer` | `B55E8B6AEB30` |
| `DA3 V5 TAG B` | `Synthetic Reassignment Target` | `32A54C8F2F29` |

The Human then signed out. Sanitized status exactly showed two Tags, two active Assignments, two
administration receipts and four AuditEvents, with every lifecycle and DA3 review/correction/export
count still zero.

## 4. Gate A failure

The Human signed in as the synthetic Employee and began the required Tag-A Start/Stop observation.
Before any unambiguous required `Arbeitszeit gestartet` result could be accepted, Mobile displayed
`Ausstehender Vorgang geschützt`. Interaction stopped immediately; no retry, reinstall, storage
clear, repair or continuation occurred.

The tracked presentation maps that exact safe message to
`protected_pending / identity_mismatch`. Immediate sanitized server status remained unchanged at:

- zero WorkEvents;
- zero canonical Decisions;
- zero synchronization receipts;
- zero TimeEntries/stopped TimeEntries; and
- zero revisions, correction receipts, export audits, adjudications and review command receipts.

Gate A therefore failed closed. Gates B and C were not started, and no observation from this run
is reusable.

## 5. DA3-PHYS-01 — exact diagnosis and classification

`DA3-PHYS-01` is **P1 OPEN** because the exact authorized procedure cannot reach its first required
DA3 observation on the approved artifact:

1. `DefaultProductMobileRuntime` starts `OfflineCaptureCoordinator` for the whole product runtime.
2. On the Administrator session used for physical Tag setup,
   `OfflineCaptureCoordinator.prepareAuthenticatedCapture()` calls
   `OfflineCaptureDatabase.bindOwner()` and permanently creates the encrypted store's Organization,
   User and Membership owner row.
3. Explicit logout correctly invalidates capture and removes the active lookup key, but deliberately
   does not delete or rebind that owner row.
4. The following Employee session calls `bindOwner()` with a different User/Membership. The
   database correctly fails closed with `identity_mismatch`, which Mobile presents as
   `Ausstehender Vorgang geschützt`.
5. The V5 runbook currently performs Administrator setup and then Employee Gate A on the same
   installation without an intervening clean exact-artifact reinstall/reset boundary. DA1 physical
   evidence used such a clean reinstall after Administrator prerequisite setup.

The focused read-only diagnosis reran 26/26 Mobile tests across the offline database/scheduling,
exclusive NFC arbiter and Administrator setup boundaries. They confirm the intentional
identity-mismatch protection, explicit logout invalidation and exclusive native capture behavior;
no test or product source was changed.

The security boundary behaved as implemented: it did not silently rebind or expose another
identity's local state. The defect is the unresolved mismatch between that deliberate single-owner
installation behavior and the authorized V5 procedure. No product or architecture decision is made
by this diagnosis. Potential remediation requires a new Human decision between at least an
operational exact-artifact reinstall boundary and a separately designed/tested safe empty-store
identity-transition rule.

## 6. Abort cleanup

The Human confirmed Mobile sign-out. Admin Web was left at a fresh signed-out login surface with an
empty password field; the system clipboard was cleared to zero bytes. No CSV or screenshot was
created. Admin Web and the harness stopped normally. The scoped disconnect helper removed only the
two approved mappings, and only `com.tim180201.mobile.synthetic` was uninstalled.

Final checks passed:

- reverse mapping count: 0;
- installed synthetic package count: 0;
- listeners on 3000, 3001, 5173 and 54321: 0;
- `taptime_server` schema count: 0;
- migration-ledger count: 0;
- generated synthetic runtime-role count: 0;
- dedicated database connection count: 0;
- temporary detached worktree removed; and
- original read-only APK still has the exact authorized SHA-256.

The pre-existing local PostgreSQL service and unrelated device/repository state were retained.
Final repository state was `HEAD == origin/main == b142626...`, tracked-clean, with only the
pre-existing untracked paths `app.json` and `research/` reported without inspecting their contents.

## 7. Current disposition

The first authorized V5 Physical Gate is **FAILED CLOSED**. DA3 and DT-069–DT-074 remain open.
Independent exact-delta review of this failure synchronization returned
`APPROVED FOR FAILURE SYNCHRONIZATION` with zero P0–P3 findings against the publication while
keeping `DA3-PHYS-01` P1 open. The operational correction is now independently approved; a new
exact-bound Human authorization remains mandatory before any replacement physical run. Production,
production data, deployment and distribution remain unauthorized.

The Human Architect subsequently selected and authorized the operational clean exact-artifact
reinstall correction on exact baseline `f0c9db3`, tree `27cabe6`. Local AVS V0–V3 passed;
publication `f7a2b1e`, tree `a8caed6`, passed exact-head run `29935693909` 12/12.
Independent exact-delta review returned `APPROVED FOR DA3-PHYS-01 OPERATIONAL CORRECTION` with zero
P0–P3. This changes no historical observation, keeps `DA3-PHYS-01` P1 open and does not authorize a
replacement run.

## 8. Exact replacement-run authority

The Human Architect subsequently authorized one complete fresh replacement run bound to every
Product, Evidence, review, correction and correction-review commit/tree/CI listed above, the same
read-only APK SHA-256, the approved Galaxy A33 5G and both approved safe tag fingerprints. The
authorization explicitly included both installations, the intervening scoped disconnect, exact
package-only uninstall, package/mapping zero proof, same-artifact reinstall, Gates A–C,
disclosure-safe evidence and complete cleanup. It prohibited every retry, repair or resume of a
failed or ambiguous run. Production, production data, deployment and distribution remained
unauthorized.

Repository, remote, six exact-head CI bindings, immutable artifact/manifest, package/signature,
backup boundary, Hermes runtime, device/USB/NFC state, empty package/reverse/listener state and the
clean disposable database were reverified before the counted run. The initial installation of the
exact APK succeeded with exactly the two approved reverse mappings. Initial sanitized status was
two seeded Customers and zero Tags, Assignments, administration receipts, AuditEvents, lifecycle
rows and DA3 correction/export/review rows.

## 9. Replacement-run prerequisite failure

Runbook Section 4 step 7 says to create two Customers and provision the two approved tags. The real
harness already contained the two seeded Customers named `Synthetic Android Customer` and
`Synthetic Reassignment Target`. Following the literal create instruction through the real Admin
Web added `DA3 V5 Ersatzlauf Kunde A` and `DA3 V5 Ersatzlauf Kunde B`. The Administrator then used
the real Android setup path to assign Tag A to the first new Customer. The Human observed `Tag
erfolgreich zugeordnet`; Mobile displayed safe fingerprint `B55E8B6AEB30`.

The immediate mandatory sanitized status was:

- four Customers;
- one Tag and one active Assignment;
- three administration receipts and four AuditEvents; and
- zero WorkEvents, canonical Decisions, synchronization receipts, TimeEntries, revisions,
  correction receipts, export audits, adjudications, review command receipts and predecessor
  cursors.

The end-of-setup requirement is exactly two administration receipts and four setup AuditEvents
after two Tag assignments. Because three receipts already existed after only Tag A, completing Tag
B could not satisfy that exact aggregate. Interaction therefore stopped before presenting Tag B.
The clean exact-artifact reinstall boundary and Gates A–C were not started. No observation from
this replacement run is reusable.

## 10. DA3-PHYS-02 — procedure/baseline contradiction

`DA3-PHYS-02` is **P1 OPEN** because the independently approved procedure is internally
contradictory at its mandatory setup boundary:

1. fresh harness startup deterministically seeds exactly two Customers;
2. Section 4 step 7 nevertheless instructs the operator to create two Customers;
3. real Customer creation appends one administration receipt and one AuditEvent per Customer;
4. real Tag provisioning appends one administration receipt and two AuditEvents per Tag; and
5. Section 4 step 8 requires exactly two administration receipts and four setup AuditEvents,
   which is reachable only when the seeded Customers are used and no additional Customers are
   created.

The APK, product behavior and correction boundary did not fail. The run failed because the written
operator instruction and its required aggregate cannot both be satisfied. A focused ADO-only
correction must explicitly require use of the two seeded Customers, prohibit additional Customer
creation for this V5 run and retain the exact two-receipt/four-audit assertion. That proposed
wording is a correction candidate only; this evidence does not implement or authorize it.

## 11. Replacement-run abort cleanup

Mobile was explicitly signed out. The in-app Admin-Web tab was already closed before an explicit
Web sign-out click could be observed; its authentication is configured memory-only with
`persistSession: false`, so tab disposal retained no browser session. The system and in-app-browser
clipboards were cleared, no CSV or screenshot had been created, and Admin Web and the harness
stopped normally.
The scoped helper removed only the two approved reverse mappings, and only
`com.tim180201.mobile.synthetic` was uninstalled.

Final checks passed:

- reverse mapping, installed synthetic package and listeners on 3000/3001/5173/54321: 0;
- `taptime_server` schema, migration ledger and generated synthetic runtime roles: 0;
- temporary detached worktree: removed;
- tracked changes before evidence synchronization: 0; and
- repository `HEAD`/tree remained exactly `b8f1eb7262258a4242a4c8268969c92a05d20c55` /
  `71966b09f266c0cb3c1bba1eb0f71e97c1e8ea5b`.

The pre-existing PostgreSQL service, read-only artifact and unrelated repository/device state were
preserved. User-owned untracked paths remain reported only by path/status without content access.

## 12. Current disposition after replacement run

The one replacement-run authority is consumed. `DA3-PHYS-01` remains open because its corrected
operational boundary was not reached, and `DA3-PHYS-02` is P1 open against the contradictory setup
procedure. DA3 and DT-069–DT-074 remain open. Before any new run, the failure synchronization and
focused ADO-only correction require independent review, followed by a new separate exact-bound
Human authorization. Production, production data, deployment and distribution remain
unauthorized.

## 13. Failure-synchronization change impact and AVS

The resulting synchronization is AVS **R0**: exactly 11 tracked Markdown files change. No source,
schema/migration, dependency/lockfile, configuration, workflow, script, generated runtime input or
installable artifact changes. Product correctness remains carried from unchanged Product
`6eb68a3`/tree `bb8564f`; no failed V5 observation is promoted to success.

V0 passed: exact changed-file/diff review, `git diff --check`, zero missing ADO references in the
changed files, six of six local commit/tree bindings and six of six GitHub Actions head/result/job
bindings (`12/12` each). Product suites, builds and Android export were intentionally not repeated
because this is unchanged documentation-only synchronization; the existing exact Product and
correction evidence is explicitly carried, not freshly executed. Independent read-only review of
the complete failure synchronization and proposed correction boundary remains mandatory before
any correction publication or new Physical Gate authorization.
