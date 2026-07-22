# Development Assignment 3 — DA3-PHYS-01 Operational Reinstall Independent Review

Status: **APPROVED FOR DA3-PHYS-01 OPERATIONAL CORRECTION — ZERO P0–P3 FINDINGS**
Review Date: 2026-07-22
Review Mode: Independent read-only exact-delta review
Owner: Independent Review Agent
Physical disposition: **REPLACEMENT PHYSICAL GATE REMAINS SEPARATELY UNAUTHORIZED**

## 1. Provenance and exact review binding

The supplied raw independent review record is bound by SHA-256
`2cbef83e253754b1504cb763b944b28726704142d7917b5486173fdb86dc2db7`. This hash records
provenance only and creates no product artifact or authority.

The independent reviewer verified:

- `HEAD == origin/main == 1ed32637f44ed07f5515614bffc1e1d331f9db08`, tree
  `dc26ae74dc17997684ed712b43c019ded491da9d`, with a clean tracked worktree;
- correction publication `f7a2b1e159bd4715c40e3ee32e99b76c70ca9e18`, tree
  `a8caed6ebcc6f01c4b025b0b64da5be96130542a`, with exact parent
  `f0c9db3d2fc8ed5fae3d54f147a696c56a79aec3`;
- Evidence sync `1ed32637f44ed07f5515614bffc1e1d331f9db08`, tree
  `dc26ae74dc17997684ed712b43c019ded491da9d`, with exact parent `f7a2b1e`;
- delta `f0c9db3..f7a2b1e`: exactly 13 files, `+277/-25`, only under `ADO/`;
- delta `f7a2b1e..1ed3263`: exactly 13 files, `+62/-39`, only under `ADO/`, with clean
  complete-range `git diff --check`;
- no change from Product `6eb68a3` through reviewed head in `apps/`, `packages/`, `.github/` or
  the root lockfile;
- exact-head GitHub Actions runs `29934393915`, `29935693909` and `29936204801`, each attempt 1
  and 12/12 successful, plus the complete predecessor Product/Evidence/review/failure chain;
- unchanged 95,437,611-byte, mode-`0444` APK SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`; and
- unchanged 2,206-byte, mode-`0444` artifact manifest SHA-256
  `07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`.

The reviewer preserved the pre-existing untracked `app.json` and `research/` paths without reading
or changing them and made no repository change.

## 2. Verdict and findings

Verdict: **APPROVED FOR DA3-PHYS-01 OPERATIONAL CORRECTION**.

Findings: P0: 0, P1: 0, P2: 0, P3: 0.

This verdict approves the published operational correction as the reviewed procedural basis for a
later separately authorized complete fresh replacement run. It does not pass V5, close
`DA3-PHYS-01`, close DA3 or close DT-069–DT-074.

## 3. Independently confirmed security architecture

The reviewer independently traced the unchanged product behavior:

1. `DefaultProductMobileRuntime` starts `OfflineCaptureCoordinator` for the product runtime.
2. An authenticated session reaches `bindOwner()`, which inserts the permanent encrypted store
   owner only while the local store is empty.
3. Logout invalidates capture and removes the active lookup key but intentionally retains the
   bound owner.
4. A different identity on the same installation fails closed with `identity_mismatch`.
5. No product rebind or empty-store identity-transition rule was introduced by the correction.

The reviewed operational boundary therefore preserves the existing single-owner security rule. It
removes only the prerequisite Administrator package/local store and installs the same immutable
artifact into a new package state before Employee Gate A.

## 4. Independently confirmed reinstall procedure

The reviewer confirmed that Runbook Section 4.1:

- requires exactly one approved USB device and the exact package
  `com.tim180201.mobile.synthetic`;
- uses the scoped disconnect helper and additionally requires the complete reverse table to be
  empty;
- requires successful exact-package uninstall and proof of package/mapping zero, with no `pm clear`;
- prohibits device reset, backup/restore and disposable-database mutation;
- reinstalls the same reverified artifact only after the package-null proof;
- rechecks the exact package, two approved mappings, artifact hash and unchanged safe server
  aggregates;
- requires Employee-only authentication on the clean installation before any Tag is presented;
  and
- fails the complete run with mandatory cleanup and no repair, retry or resume on any ambiguous or
  failed step.

The reviewer accepted the reviewed install helper's `adb install -r` because the mandatory prior
package-zero proof makes this a clean install rather than an update. Packaged `allowBackup=false`,
the data-extraction/full-backup boundaries and the explicit backup/restore prohibition protect
against restoration of the Administrator-owned local store.

## 5. Verification, cleanup and disclosure disposition

The independent reviewer reproduced the four focused Mobile test files with 26/26 tests and
recomputed the artifact and manifest hashes. The reviewer accepted the exact clean-environment
12/12 CI runs instead of performing a mutation-capable complete local 1,758-test rerun. APK
installation, ADB, device interaction and the Physical Gate were correctly omitted.

The Technical Lead independently reconfirmed all seven recorded exact-head CI bindings, both local
artifact hashes, the empty executable-range diff and the same focused 4/4 files with 26/26 tests
before archiving this disposition.

The reviewed ADO deltas disclose only commits, trees, CI identifiers, safe aggregates and status
text. They contain no credentials, tokens, raw NFC values, device serials, internal identifiers,
keys or real-person data.

One non-finding operational observation is retained: the install helper reads a fixed build-output
path. The later Human authorization and execution preflight must bind the hash to the exact file
actually supplied to that helper. The Runbook's repeated hash checks and Hermes verification make
this enforceable without a product or helper change.

## 6. Authority and next gate

The published correction is independently approved and suitable for Technical-Lead ADO acceptance.
It is eligible only as the basis for a later complete fresh replacement execution after a new,
separate Human authorization that explicitly binds:

- Product, correction, Evidence/review-publication commits, trees and exact-head CI;
- the exact read-only APK and manifest properties;
- both the prerequisite Administrator installation and the clean Employee installation;
- the interim scoped disconnect and exact-package uninstall;
- the approved USB device and both approved synthetic tags; and
- the complete Runbook, abort and cleanup requirements.

This review authorizes no ADB command, install/uninstall, device interaction, Physical Gate,
production resource/data, deployment or distribution. `DA3-PHYS-01` remains P1 open until a later
separately authorized fresh replacement run succeeds and its exact evidence is accepted. DA3 and
DT-069–DT-074 remain open.
