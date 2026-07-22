# Development Assignment 3 — V5 Physical Validation Evidence

- Status: **FIRST AUTHORIZED RUN FAILED CLOSED; DA3-PHYS-01 (P1) OPEN**
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
- Physical result: Gate A failed before an unambiguous successful Start observation; Gates B and C
  were not started
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
keeping `DA3-PHYS-01` P1 open. A separately approved correction candidate and a new exact-bound
Human authorization remain mandatory before any replacement physical run. Production, production
data, deployment and distribution remain unauthorized.

The Human Architect subsequently selected and authorized the operational clean exact-artifact
reinstall correction on exact baseline `f0c9db3`, tree `27cabe6`. Its ADO-only R3 candidate passes
local AVS V0–V3 and awaits V4 plus independent exact-delta review. This changes no historical
observation and does not authorize a replacement run.
