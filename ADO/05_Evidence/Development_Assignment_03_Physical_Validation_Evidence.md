# Development Assignment 3 — V5 Physical Validation Evidence

- Status: **THREE RUNS FAILED CLOSED; ALL THREE P1 FINDINGS OPEN; DA3-PHYS-03 FOCUSED ADO-ONLY CORRECTION AND ZERO-FINDING INDEPENDENT RE-REVIEW ARCHIVED/PUBLISHED WITH EXACT-HEAD CI 12/12; HUMAN ACCEPTANCE/NEW EXACT-BOUND AUTHORIZATION PENDING; NEW RUN UNAUTHORIZED**
- Date: 2026-07-23
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
- Physical result: first run failed at Gate A; replacement failed during setup; third run reached
  corrected setup/reinstall and Gate-A actions but omitted mandatory CSV content proof and failed
  authentication with a mismatched clipboard credential before Gate B
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
operator instruction and its required aggregate could not both be satisfied. Independent review
approved the focused correction candidate with zero open P0–P3, and the Human Architect then
authorized the ADO-only correction. Runbook step 7 now explicitly requires the two seeded
Customers, prohibits additional Customer creation and retains step 8's exact two-receipt/four-audit
assertion. `DA3-PHYS-02` remains open pending publication, CI, independent re-review and a later
separately authorized successful fresh run.

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
operational boundary was not reached, and `DA3-PHYS-02` remains P1 open until its focused ADO-only
correction is independently re-reviewed and a later separately authorized fresh run passes. DA3
and DT-069–DT-074 remain open. Before any new run, the correction requires focused publication,
exact-head CI and independent exact-delta re-review, followed by a new separate exact-bound Human
authorization. Production, production data, deployment and distribution remain unauthorized.

## 13. Failure-synchronization change impact and AVS

The resulting synchronization is AVS **R0**: exactly 11 tracked Markdown files change. No source,
schema/migration, dependency/lockfile, configuration, workflow, script, generated runtime input or
installable artifact changes. Product correctness remains carried from unchanged Product
`6eb68a3`/tree `bb8564f`; no failed V5 observation is promoted to success.

V0 passed: exact changed-file/diff review, `git diff --check`, zero missing ADO references in the
changed files, six of six local commit/tree bindings and six of six GitHub Actions head/result/job
bindings (`12/12` each). Product suites, builds and Android export were intentionally not repeated
because this is unchanged documentation-only synchronization; the existing exact Product and
correction evidence is explicitly carried, not freshly executed. At this failure-synchronization
checkpoint, independent read-only review of the complete delta and proposed correction boundary
remained mandatory before any correction publication or new Physical Gate authorization; Section
14 records that later review and Human authorization.

## 14. Independent approval and Human-authorized DA3-PHYS-02 correction

Independent read-only review bound failure synchronization `abd58be3`, tree `b2cb210`, exact-head
run `29939539390` 12/12, its exact 11-file `+302/-47` R0 delta, the complete predecessor chain and
unchanged APK. It independently verified the two-Customer seed baseline, zero seed receipts/audits,
Customer and Tag write arithmetic, P1 severity, stop point, cleanup/disclosure and correction
boundary. Verdict:
`APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-02 CORRECTION CANDIDATE`; zero open P0–P3.
Archived review:
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_02_Replacement_Failure_Independent_Review.md`.

The Human Architect accepted that review on exact `abd58be3`/tree `b2cb210`/run `29939539390` and
authorized only the focused ADO correction, review archival, status/Evidence synchronization, AVS
R0/V0, publication, exact-head CI and independent exact-delta re-review. Runbook step 7 now:

- requires exactly the two fresh-harness seed Customers;
- assigns Tag A to `Synthetic Android Customer` and Tag B to
  `Synthetic Reassignment Target`;
- prohibits additional Customer creation during the V5 run; and
- leaves step 8's exact two-receipt/four-audit invariant unchanged.

The correction changes no source, schema, dependency, configuration, workflow, script, product
rule, harness or APK. Retry, Physical Gate, production, production data, deployment and
distribution remain unauthorized. `DA3-PHYS-01` and `DA3-PHYS-02` remain open.

## 15. DA3-PHYS-02 correction change impact and local AVS

The correction candidate is AVS **R0**: exactly 12 `ADO/` Markdown files change, including the new
independent-review archive. No source, schema/migration, dependency/lockfile, configuration,
workflow, script, generated runtime input or installable artifact changes. Runbook step 8 is
byte-unchanged; only the contradictory setup instruction in step 7 changes operational wording.

Local V0 passed: exact authorized baseline/remote binding, complete staged-diff and status review,
`git diff --cached --check`, zero missing ADO references, zero non-ADO/Markdown files, disclosure
scan and explicit confirmation of both seed names, the no-additional-Customer rule and unchanged
two-receipt/four-audit requirement. Product suites, builds and Android export were intentionally not
repeated because the delta is proven documentation-only; unchanged Product/correction CI and APK
evidence are carried, not represented as freshly executed.

Focused publication `4d54dc2981759498de94571e2b2a4c6f134c88d5`, tree
`ad9b6ba661dae7572a8b825fe1ceadac8c108b79`, parent `abd58be3`, contains exactly those 12 ADO
Markdown files with `+309/-52`. Exact-head GitHub Actions run `29941019865`, attempt 1, passed all
12 jobs. Independent exact-delta re-review remained mandatory at that checkpoint; Section 16
records its later approval. This publication/CI result closes no finding or DA3 task and grants no
run authority.

## 16. DA3-PHYS-02 correction independent exact-delta re-review

Independent read-only review of the complete correction range `abd58be3..53ec139` confirmed:

- exact baseline/correction/Evidence commits, trees, parent chain and remote state;
- correction delta 12 files `+309/-52`, Evidence sync 11 files `+62/-44`, and combined 12-file
  `+326/-51` range, exclusively tracked ADO Markdown;
- exact-head runs `29941019865` and `29941415806`, attempt 1, each 12/12;
- unchanged 95,437,611-byte mode-`0444` APK SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`;
- both exact seed names, prohibition of additional Customer creation, exact Tag A/B mapping and
  unchanged step-8 two-receipt/four-audit invariant; and
- consistent open-finding and authority boundaries across status, decision, risk, authorization,
  runbook, evidence, roadmaps and navigation.

Verdict: `APPROVED FOR DA3-PHYS-02 ADO CORRECTION`; no open P0–P3 review findings. Full archive:
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_02_Correction_Independent_Exact_Delta_Review.md`.

Review archive `030dbf6`, tree `8695708`, passed exact-head run `29942397982`, attempt 1, 12/12.
This is repository/procedure evidence only, not a new physical observation. `DA3-PHYS-01` and
`DA3-PHYS-02` remain P1 open, and no DA3 task closes. At that checkpoint, explicit Human acceptance
and a new separate exact-bound authorization were required before another complete fresh run;
Section 17 records the later acceptance without execution authority.

## 17. Human acceptance of the correction review

The Human Architect accepted the exact independent review archive
`030dbf6f44a7f6c03adc089b1a2f8dae73c114eb`, tree
`8695708f82ed98a068338ac33029151ee349f1d6`, run `29942397982` 12/12, and final Evidence sync
`22ee4636b1fec83b0693fdb6f688d3191cfa04ee`, tree
`3d70d5dd4d2cb5257fbcf3374d82485981f8f763`, run `29942786556` 12/12, as the binding review basis.

This acceptance is not a new physical observation and closes neither P1 finding nor any DA3 task.
The Human Architect expressly withheld Physical-Gate authority. No run, installation/uninstall,
ADB/loopback, device/Tag interaction, retry, repair or resume is authorized. A later complete fresh
V5 run requires a new separate exact-bound Human authorization. Production, production data,
deployment and distribution remain unauthorized.

## 18. Third-run exact authority and preflight — 2026-07-22/23

After review-acceptance publication
`acf79ab257df6769d12bd489e27f721a0ae2d354`, tree
`f80bec9a1de0a6106f7bf71b181f6930ffa5450a`, passed GitHub Actions run `29946654825`, attempt 1,
12/12, the Human Architect separately authorized one complete fresh V5 run. The exact binding was:

| Record | Commit | Tree | Exact-head CI |
|---|---|---|---:|
| Product | `6eb68a3b4f9567600e12ec5a4f4b72ca4da99dca` | `bb8564fd0911d2b32dccb776f4a3f938621ee052` | `29927309720`, 12/12 |
| V5 Evidence | `f4e2eeb3bb47ed1dd3b2f0cf10fd0f725650d6ba` | `20e5715c448331f5d99536259743dccc7005dffb` | `29928717227`, 12/12 |
| V5 review publication | `b14262691753c2c5b5772558414b7f3b6e5dc9d4` | `9aa61806bc057bf71c119d1511adbbebab3a9080` | `29930922165`, 12/12 |
| Operational correction | `f7a2b1e159bd4715c40e3ee32e99b76c70ca9e18` | `a8caed6ebcc6f01c4b025b0b64da5be96130542a` | `29935693909`, 12/12 |
| Correction Evidence sync | `1ed32637f44ed07f5515614bffc1e1d331f9db08` | `dc26ae74dc17997684ed712b43c019ded491da9d` | `29936204801`, 12/12 |
| Independent correction review publication | `b8f1eb7262258a4242a4c8268969c92a05d20c55` | `71966b09f266c0cb3c1bba1eb0f71e97c1e8ea5b` | `29937437746`, 12/12 |
| Replacement-failure synchronization | `abd58be3a6231fd7d3e298f2ec111677b53de8a0` | `b2cb2109777b223794a3808bc0e821a459a5d3b8` | `29939539390`, 12/12 |
| DA3-PHYS-02 correction | `4d54dc2981759498de94571e2b2a4c6f134c88d5` | `ad9b6ba661dae7572a8b825fe1ceadac8c108b79` | `29941019865`, 12/12 |
| Correction Evidence sync | `53ec1396d0cb9b7b250546ad478911c1a430dea6` | `9963960662c41c99bfcdbcbffdccfe4d4d5dbe63` | `29941415806`, 12/12 |
| Independent correction-review archive | `030dbf6f44a7f6c03adc089b1a2f8dae73c114eb` | `8695708f82ed98a068338ac33029151ee349f1d6` | `29942397982`, 12/12 |
| Final Evidence sync | `22ee4636b1fec83b0693fdb6f688d3191cfa04ee` | `3d70d5dd4d2cb5257fbcf3374d82485981f8f763` | `29942786556`, 12/12 |
| Human-acceptance publication | `acf79ab257df6769d12bd489e27f721a0ae2d354` | `f80bec9a1de0a6106f7bf71b181f6930ffa5450a` | `29946654825`, 12/12 |

Each run was independently re-read as exact-head 12/12. `main == origin/main == acf79ab...`, the
tracked worktree was clean, and untracked user-owned paths were preserved.

The unchanged read-only APK at the authorized path remained 95,437,611 bytes, mode `0444`, SHA-256
`215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`, package
`com.tim180201.mobile.synthetic`, version `1.0.0`/`1`, target SDK 36, with exactly one v2 signer
certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
Backup/cleartext/Hermes assertions passed. The unchanged 2,206-byte mode-`0444` manifest remained
SHA-256 `07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`.

The only device was the authorized USB Galaxy A33 `SM-A336B`, Android 15/API 35 with NFC enabled.
Package, reverse mappings, four listeners, synthetic schema/ledger/runtime roles and domain rows
all began at zero. The two approved tag fingerprints were `B55E8B6AEB30` and `32A54C8F2F29`.

Two preparation-only failures occurred before database creation, device interaction or the counted
run: the isolated worktree initially resolved Node 26 instead of required Node 24, and an early
harness/Web build was invoked before its dependency build order. Both were discarded; dependency
installation and exact CI build order then passed under Node `24.17.0`. They contribute no physical
observation.

## 19. Third-run prerequisite and clean identity boundary

The fresh harness began with exactly two seeded Customers and zero Tag/setup/lifecycle/DA3 rows.
Using only the accepted seed names, the Human assigned:

- Tag A / `B55E8B6AEB30` / `DA3 V5 TAG A` to `Synthetic Android Customer`; and
- Tag B / `32A54C8F2F29` / `DA3 V5 TAG B` to `Synthetic Reassignment Target`.

The exact prerequisite state was Customers 2, Tags 2, Assignments 2, administration receipts 2,
AuditEvents 4 and zero lifecycle/revision/export/review rows. No Customer was created.

The Administrator signed out. The artifact was reverified, both scoped mappings were removed,
only `com.tim180201.mobile.synthetic` was uninstalled and package/mapping counts reached zero.
Server setup remained unchanged. The same APK was reinstalled through the reviewed helper, exact
package and two mappings returned, the server setup aggregate remained unchanged and the clean
Employee installation reached the normal capture surface without `protected_pending`.

These are truthful historical observations, but they cannot close `DA3-PHYS-01` or
`DA3-PHYS-02`: the later complete-run failure invalidates reuse under AVS V5 and the exact Human
authorization.

## 20. Gate-A actions and missing mandatory CSV proof

The Human scanned Tag A online, observed `Arbeitszeit gestartet`, waited more than six seconds and
scanned it again, observing the Stop result. Sanitized server state became:

```text
AdministrationReceipts=2
AuditEvents=6
WorkEvents=2
SyncReceipts=2
CanonicalDecisions=2
TimeEntries=1
StoppedTimeEntries=1
```

After Mobile sign-out, Admin Web selected the one stopped record. Beginning and end were shifted
one minute earlier with reason `DA3 V5 correction observation`, explicit preview and second
confirmation. Refresh persistence and server state proved one append-only revision, one review
command receipt and one added AuditEvent with no base WorkEvent/Decision mutation. The real Web
export action returned success and server state proved one export audit plus one further
AuditEvent:

```text
AdministrationReceipts=2
AuditEvents=8
WorkEvents=2
SyncReceipts=2
CanonicalDecisions=2
TimeEntries=1
StoppedTimeEntries=1
TimeRecordRevisions=1
TimeReviewCommandReceipts=1
TimeEntryExportAudits=1
ReviewAdjudications=0
ReviewPredecessorCursors=0
```

The generated CSV was 523 bytes with SHA-256
`5e3f6a3be99dba90b0ada36303b239dcfeb087f00184fcf08bd0da573576304e`.
However, the Technical Lead had explicitly told the Human not to open it and advanced based only on
UI/audit success. Therefore the required CSV-v1 header, formula-safe dialect, exactly-once row and
corrected effective timestamps were **not verified**. Section 5 step 5 did not pass, Gate A was
never complete and the file hash alone cannot substitute for content assertions.

## 21. DA3-PHYS-03 stop point and classification

Before Gate B, Mobile was signed out. The Technical Lead filled the fixed Employee email and then
used the current system clipboard as the password source. Several field-entry attempts were made;
the final fixed email and input length matched what was supplied. One sign-in was then rejected.
No Tag was presented and no Gate-B action began.

Read-only diagnosis compared only SHA-256 values and proved:

```text
clipboard_vs_harness=mismatch
```

No password value was printed or persisted. The clipboard had been treated as a stable
credential source even though it was mutable and had not been re-bound to the running harness
secret before injection. The Technical Lead initially described the field as correctly populated
based only on length; that claim was withdrawn after the exact hash mismatch.

`DA3-PHYS-03` is **P1 OPEN** because the authorized complete fresh V5 could not proceed and its
evidence was already incomplete at Gate A. This is an operator-control/evidence-execution finding,
not a Product, schema, APK, authentication or server-canonical correctness finding. Sanitized
server state remained byte-for-byte at the Gate-A aggregate above. Gate B and Gate C did not start.
The one-run authority is consumed; retry, repair and resume are not authorized.

The independently approved narrow correction candidate is now Human-authorized only as an ADO
procedure correction:

1. make every mandatory CSV assertion an explicit recorded stop point before progression/deletion;
2. bind the memory-only password to a disclosure-safe digest at harness start and compare it
   before every injection;
3. inject fixed non-secret synthetic emails without using the credential clipboard; and
4. fail before authentication on any digest mismatch.

Independent review has confirmed the severity, root cause, disclosure boundary and sufficiency of
this candidate with zero open P0–P3 review findings. Publication, exact-head CI and independent
exact-delta re-review are still mandatory. No new run follows from that correction authority.

## 22. Third-run abort cleanup and governance deviation

Mobile was already signed out at the disclosure-safe login surface; the Human signed out Admin
Web. The system clipboard was cleared. The exact synthetic CSV was hashed/sized and deleted.
Admin Web and the harness stopped normally. The first scoped-disconnect cleanup invocation found
zero trusted devices because USB was disconnected; this was a mandatory-cleanup condition, not a
Gate retry. After the Human reconnected the approved phone, the reviewed scoped helper confirmed
zero approved mappings and only `com.tim180201.mobile.synthetic` was uninstalled successfully.

Final zero-state evidence:

```text
ApprovedReverseMappings=0
SyntheticPackage=0
Listeners3000/3001/5173/54321=0/0/0/0
SyntheticSchema=0
MigrationLedger=0
GeneratedRuntimeRoles=0
```

The detached Product worktree was tracked-clean and removed. Primary `main`, tree and `origin/main`
remained exactly `acf79ab...` / `f80bec9...` / `acf79ab...`; tracked state was clean and the
pre-existing untracked `app.json` remained untouched.

During that repository check the Technical Lead mistakenly executed a path-scoped
`git status -- research` probe despite the explicit prohibition on reading/listing that protected
path. The command emitted no protected filename or file content, and no protected or repository
state changed. It nevertheless crossed the stated boundary and is recorded for independent review.
No further command targeted `research/`.

The complete third V5 run is **FAILED CLOSED**. No DA3 task or physical finding closes. Independent
failure-synchronization review, any separately Human-authorized correction, its applicable
verification/review and a new separately authorized complete fresh V5 are required.

## 23. Failure-synchronization change impact and AVS

- Baseline: `acf79ab257df6769d12bd489e27f721a0ae2d354`, tree
  `f80bec9a1de0a6106f7bf71b181f6930ffa5450a`, with `main == origin/main`.
- Scope: exactly 11 tracked `ADO/` Markdown files, working delta `+452/-38`; no source,
  schema/migration, dependency, lockfile, compiler/native/release configuration, workflow, script,
  generated runtime input or installable artifact changes.
- Intended behavior: record the consumed authority, exact failed-run truth, cleanup, disclosure,
  protected-path deviation, open `DA3-PHYS-03` P1 and an explicitly non-authorized correction
  candidate.
- Risk class: AVS **R0** for the repository delta. The underlying failed physical observation and
  proposed later operator-control boundary remain release-critical and independently reviewed.
- V0: exact diff/scope, whitespace, reference, status/authority, disclosure and tracked-state checks
  are required before Technical-Lead publication.
- V1/V2/V3: not run because no executable input changes; exact Product/enablement/correction tests,
  builds, APK evidence and their commit/tree/CI bindings are carried, not re-described as freshly
  executed.
- V4: complete exact-head CI is required after focused publication because this is a
  Physical-Gate failure-synchronization decision point.
- V5: failed closed; no observation from this run is reusable.
- Independent review: mandatory before any correction publication or new Physical authorization.

This section records the failure-synchronization publication baseline. The later independently
approved review, Human authority and applied ADO-only wording are recorded in Section 24.

## 24. DA3-PHYS-03 review acceptance and ADO-only operator-control correction

Independent review archived at
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_03_Operator_Control_Independent_Review.md`
verified baseline `acf79ab257df6769d12bd489e27f721a0ae2d354`/tree
`f80bec9a1de0a6106f7bf71b181f6930ffa5450a`, reviewed failure synchronization
`a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`/tree
`dae80d85bd2d0cacfa77382b5a131888020301b7`, exact 11-file `+452/-38` ADO-only delta and
exact-head run `29984028528`, attempt 1, 12/12. It also revalidated the complete predecessor chain,
immutable APK/manifest, failed-run truth, cleanup/disclosure, protected-path deviation and AVS
R0/V0. Verdict:
`APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-03 OPERATOR-CONTROL CORRECTION CANDIDATE`;
zero open P0–P3 review findings.

The Human Architect accepted that exact basis and separately authorized only the focused ADO-only
operator-control correction. Runbook Sections 2, 3.1, 4, 5 and 8 now require:

- explicit, locally completed CSV-v1, formula-safety, exactly-once and effective-timestamp
  assertions before progress or file deletion;
- a SHA-256 binding of the memory-only password held only in current live operator-session state;
- successful binding comparison before every password injection, emitting only
  `synthetic_password_binding=match|mismatch`;
- fixed non-secret `.invalid` emails entered without modifying the credential clipboard;
- fail-before-authentication on mismatch, missing binding or ambiguity; and
- `git status --short --untracked-files=normal -- . ':!research'` for repository worktree checks,
  with any command capable of entering the protected path prohibited.

### 24.1 AVS classification for this correction

- Risk class: **R0**, because the exact delta is ADO Markdown only and changes no executable input.
- V0: exact diff/scope, whitespace, reference, authority/status, disclosure and protected-path-
  excluding tracked-state checks are mandatory before publication.
- V1/V2/V3: not run; no source, schema, migration, dependency, lockfile, workflow, helper,
  configuration, harness or artifact changed. Existing Product/V5 evidence is carried, not claimed
  as newly executed.
- V4: complete exact-head CI is mandatory after focused publication.
- Independent exact-delta re-review is mandatory after CI.

`DA3-PHYS-01`, `DA3-PHYS-02`, `DA3-PHYS-03`, DA3 and DT-069–DT-074 remain open. The correction
creates no retry, repair, resume, Physical Gate, installation/ADB, production, production-data,
deployment or distribution authority. A later complete fresh V5 still requires a new separate
exact-bound Human authorization after independent approval of the published correction.

## 25. DA3-PHYS-03 correction publication and V4 evidence

Correction/review-archive publication `9424a588683fc78cae1d47861366eff25d501952`, tree
`f2d9a8755be7b5ee021873a5fff6c3f5d5db8b32`, exact parent
`a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`, contains exactly 12 ADO Markdown files and
`+465/-59`. Local AVS R0/V0 passed exact scope, zero unstaged tracked delta, whitespace,
references, authority/status, disclosure and all required Runbook-control assertions. V1–V3 were
not run because no executable input changed.

Exact-head GitHub Actions V4 run `29985219725`, push, attempt 1, passed 12/12 on the publication
commit. Evidence sync `e025a2f860e21f968439a239525c55f63bd258a5`, tree
`4485a43e26de6db3976bbffbd1ade62580613ea1`, passed exact-head run `29985663622`, attempt 1,
12/12. The Product/APK/manifest and their carried evidence are unchanged.

`DA3-PHYS-01/02/03`, Gate A, DA3 and DT-069–DT-074 remain open. No failed-run observation is
reused. Retry, repair, resume, Physical Gate, installation/ADB, production, production data,
deployment and distribution remain unauthorized.

## 26. DA3-PHYS-03 correction independent exact-delta re-review

Independent read-only review reproduced the exact correction and Evidence deltas, both new
exact-head 12/12 CI runs, all 15 carried chain bindings, APK/manifest properties, the prior review
archive and every required CSV, credential-binding and protected-path control. Its verdict is
`APPROVED FOR DA3-PHYS-03 ADO OPERATOR-CONTROL CORRECTION` with zero open P0/P1/P2/P3 review
findings.

The review changes no physical result and closes no physical finding. Review archive
`8545e08cd118f85c0c9defccea0fac0961e9a72e`, tree
`3440e78f379974ebf1f48ca76ad1d923ed9aeb76`, passed exact-head run `29986601053`, attempt 1,
12/12. `DA3-PHYS-01/02/03`, Gate A, DA3 and DT-069–DT-074 remain open. No failed-run observation
is reusable and no retry, repair, resume, installation/ADB, Physical Gate, production, production
data, deployment or distribution is authorized. A later complete fresh V5 requires separate
Human acceptance and a new exact-bound authorization.
