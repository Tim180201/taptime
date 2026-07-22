# Development Assignment 3 — DA3-PHYS-01 Failure-Synchronization Independent Review

Status: **APPROVED FOR FAILURE SYNCHRONIZATION; DA3-PHYS-01 (P1) REMAINS OPEN**
Review Date: 2026-07-22
Review Scope: Read-only exact-delta review of the first failed DA3 V5 Human Physical Gate and its
ADO synchronization
Owner: Independent Review Agent
Approval Authority for any correction or replacement physical run: Human Architect

## 1. Exact review binding

The independent reviewer verified:

- reviewed failure-publication head and `origin/main`:
  `a66788e880022d3da14aedddba7e373b73f55eb3`;
- reviewed tree: `55242152c996a0d1ef6f695b99452d43d5356a40`;
- exact parent: `b14262691753c2c5b5772558414b7f3b6e5dc9d4`;
- exact product binding: `6eb68a3b4f9567600e12ec5a4f4b72ca4da99dca`, tree
  `bb8564fd0911d2b32dccb776f4a3f938621ee052`;
- exact failure-synchronization delta: 11 ADO files, `+319/-40`, with no executable or test-code
  change and clean `git diff --check`;
- exact-head GitHub Actions run `29933136031`, attempt 1, push event, 12/12 successful;
- the complete predecessor chain and its three exact-head 12/12 runs:
  Product `6eb68a3` / `29927309720`, V5 Evidence `f4e2eeb` / `29928717227`, and review
  publication `b142626` / `29930922165`;
- the unchanged read-only 95,437,611-byte APK SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`; and
- the unchanged 2,206-byte artifact manifest SHA-256
  `07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`.

The supplied raw review record is bound by SHA-256
`7bf3de71922e55e250f4604b364de7c8d20a7c65c2353587738ab05c1de1336e`.

## 2. Verdict and findings

Verdict: **APPROVED FOR FAILURE SYNCHRONIZATION**.

Findings against the failure synchronization: P0: 0, P1: 0, P2: 0, P3: 0.

This verdict confirms only the truthful, complete and disclosure-safe publication of the failed
run, diagnosis, cleanup and governance state. It does not pass V5, close DA3, close DT-069–DT-074
or close `DA3-PHYS-01`.

## 3. Independently confirmed diagnosis

The reviewer independently traced the deterministic product/runbook conflict:

1. `DefaultProductMobileRuntime` starts `OfflineCaptureCoordinator` for the product runtime.
2. Every authenticated session reaches `prepareAuthenticatedCapture()` and then `bindOwner()`.
3. Administrator prerequisite setup therefore creates the encrypted singleton owner row before
   any lifecycle scan.
4. Explicit logout invalidates capture, retires leases and removes the active lookup key but
   deliberately retains that owner identity.
5. The following Employee session on the same installation reaches `bindOwner()` with a different
   User/Membership and fails closed with `identity_mismatch`.
6. Mobile presents the resulting `protected_pending` state as
   `Ausstehender Vorgang geschützt`.
7. The current V5 runbook has no clean reinstall/reset boundary between Administrator setup and
   Employee Gate A; the DA1 physical precedent did use a clean exact-artifact reinstall there.

The reviewer reran the four named Mobile test files and obtained 4/4 files and 26/26 tests passing,
including the direct identity-mismatch protection. The review confirms that the product preserved
its fail-closed cross-identity security property; the defect is the unresolved procedure/product
boundary mismatch.

One precision note is retained: the safe UI string also covers `local_evidence_protected`, so the
exact `identity_mismatch` reason follows from the deterministic source diagnosis and run sequence,
not from the UI text alone. The published Evidence already presents that reason as source diagnosis
and is therefore not misleading.

## 4. Severity, cleanup and disclosure

The reviewer confirms P1 as proportionate: no P0 disclosure or server mutation occurred, but the
approved procedure cannot reach its first required DA3 observation and therefore blocks V5 and
DA3/DT-069–DT-074 closure.

The recorded abort sequence matches the runbook: both sign-outs, empty password field, cleared
clipboard, normal service shutdown, scoped reverse removal, package-specific uninstall, zero
listeners/mappings/package/schema/ledger/generated roles/connections, detached-worktree removal and
artifact rehash. The ADO delta contains only permitted synthetic labels, safe 12-character tag
fingerprints, device model/OS, safe UI states and aggregate counts; it discloses none of the
prohibited credentials, tokens, raw NFC values, device serials, internal identifiers, keys or
real-person data.

## 5. Authority and next gate

The consumed first-run authority granted no retry, repair or replacement run. No failed-run
observation may be reused. Production, production data, deployment and distribution remain
unauthorized.

`DA3-PHYS-01` remains open. Before implementation, the Human Architect must select one correction
architecture:

- an operational clean exact-artifact reinstall boundary after Administrator setup; or
- a separately designed and tested safe empty-store identity-transition rule in the product.

The operational reinstall is the lower-risk correction because it preserves the current permanent
single-owner binding unchanged. Either path requires its own exact baseline/scope, R3 verification,
independent review and later a separately authorized complete fresh physical run.

## 6. Subsequent Human disposition

After this review was archived at `f0c9db3`, tree `27cabe6`, the Human Architect selected the
operational clean exact-artifact reinstall boundary and authorized its focused implementation,
Runbook/Evidence, AVS V0–V4 and independent review on that exact baseline. The replacement Physical
Gate remained separately unauthorized. Current correction evidence:
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_01_Operational_Reinstall_Correction_Evidence.md`.
The ADO-only correction publication `f7a2b1e`, tree `a8caed6`, subsequently passed exact-head run
`29935693909` 12/12; its independent exact-delta review remains pending.
