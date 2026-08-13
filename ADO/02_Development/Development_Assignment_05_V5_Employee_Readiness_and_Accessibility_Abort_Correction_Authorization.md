# Development Assignment 5 — V5 Employee Readiness and Accessibility-Abort Correction Authorization

- Status: **CANDIDATE — NOT EXECUTED / INDEPENDENT REVIEW PENDING / NO HARDWARE AUTHORITY**
- Date: 2026-08-13
- Owner: Technical Lead
- Approval authority: Human Architect
- Exact candidate baseline: `HEAD == main == origin/main == 6e84e80ea87f65977acd6b0a57326e6529dcd664`
- Exact candidate baseline tree: `e9f2492aaf66467c61a6bc1a14ee7d8b7f1ef1e1`
- Candidate risk: AVS-001 **R0**; future executable correction: **R3**
- Architecture and verification: ADR-0019; AVS-001
- Related operational risk: R-026; R-034

## 1. Purpose and current truth

This ADO-only candidate binds two pre-Hardware findings for one bounded Lean V0–V4
Development/Review cycle. It changes no executable, test, dependency, lockfile, schema, workflow,
runtime or artifact input and grants no current implementation or execution claim.

The consumed DA5 run reached Human-visible `Ausstehender Vorgang geschützt` after exact package
clear and normal Employee Credential entry. The exact cause is unproved: the visible Product UI
intentionally folds at least `identity_mismatch` and `local_evidence` into the same generic
protected state, while the Operator currently has no disclosure-safe machine proof of the Mobile
pre-scan origin. This current truth supersedes the older technical-closure claim for Employee
readiness. It does not reinterpret the consumed run, produce a Product result or authorize reuse,
resume or retry.

The same pre-Hardware boundary also retains the confirmed Operator finding: direct `abort` after
a successful Accessibility check can close command input while `requiresRestoreProof` is active,
so restoration proof cannot be supplied and `standard-profile-check` cannot complete. Gate E was
not reached in the consumed run; this candidate does not claim that behavior was executed there.

## 2. Activation and authority boundary

The Human Architect's current exact direction, together with the standing `AGENTS.md` rule,
permits the Technical Lead to implement the exact scope below only after:

1. this complete candidate receives independent read-only `APPROVED` with zero open P0–P3;
2. any confirmed ADO-only In-Scope finding is corrected and independently re-reviewed; and
3. this candidate and its four compact truth-synchronization entries are focusedly published.

After those gates, no additional Human prompt is required solely for the exact automated R3
Development/Review cycle below. Product, Business, authentication, tenant-isolation,
architecture, scope or authorization ambiguity stops and returns to the Human Architect. No
future publication commit/tree is predicted here, and no later ADO mutation is required solely
to insert a self-hash. Executable work starts from the actual focused authorization-publication
head whose direct parent is the exact baseline above and whose complete delta is exactly the five
ADO paths in Section 8; any intervening commit, path or working-tree drift stops for re-binding.

This authority ends before ADB, installation, Operator execution against a device and Human/
Hardware V5. A later V5 requires one fresh, separate, exact Human authorization binding the
independently reviewed exact head and fresh artifacts. Production, production data, production
signing, deployment, distribution and DA6 remain excluded.

## 3. Finding A — disclosure-safe Employee readiness

### 3.1 Closed internal protection classification

The Mobile pre-scan boundary may add one closed, typed internal protection classification with
exactly one code for each existing origin:

- secure identity;
- database initialization;
- database integrity;
- database migration;
- legacy import;
- owner binding;
- lease completeness;
- lease activation; and
- scheduler/durable state.

The implementation must map every protected pre-scan branch to exactly one closed code and must
fail closed on an absent, unknown or multiply resolved code. Only deterministic mechanical
plumbing needed to preserve that origin through the existing scan coordinator and screen is
authorized. The Product's generic scan-status semantics, visible copy and TalkBack/accessibility
copy remain unchanged.

Only Synthetic E2E may consume an opaque test-only `testID`/Android resource-id derived from the
closed class. The resource must disclose no organization, user, Membership, owner, lease, Tag,
UID, Credential, raw database/runtime error or other raw value. Production behavior remains the
same generic protected scan status.

### 3.2 Dual-source ready proof

Future `employee-ready-confirm PASS` requires both of these observations in the same bounded
state:

1. the Human confirms exact visible `Bereit zum Scannen`; and
2. a bounded read-only UIAutomator query proves the exact Product package and exactly one opaque
   Synthetic-only `READY` resource-id.

Raw UI XML is transient diagnostic input only and must be discarded in-process. Persistent
output is limited to one fixed disclosure-safe code. Missing, duplicate, unknown, wrong-package,
protected, unavailable and timeout results are terminal and must prevent `matched`, Tag B, Gate A
and every later Product mutation. No fallback to visible-text parsing or Human-only PASS is
authorized.

### 3.3 Real software-only lifecycle integration

At least one fresh production-composition software-only integration must exercise the real path:

`empty SecureStore + empty SQLCipher-model database -> runtime start -> normal Employee login ->`
`ready, no protected timeline, exact Employee owner, active v2 lease`.

The integration must retain the existing different-owner negative and use the real
`OfflineInstallationIdentityStore`, `OfflineCaptureDatabase`, `OfflineCaptureCoordinator` and
normal Employee session transition; it must not stub `initialize`, `bindOwner` or `activateLease`
into a ready result. It must reuse the existing strict v2 Mobile/client/server/neutral-contract
coverage and prove that those tests remain relevant.

Only the realistic Memory SecureStore and Memory OfflineDatabase fixtures may be mechanically
extracted/exported from `MobileOfflinePrimitives.test.ts` and `OfflineCaptureDatabase.test.ts`
into the new test-only `MemoryOfflinePlatform.ts`. Both existing tests may import that helper to
avoid duplication, but their assertions and behavior remain unchanged. Production code must not
import the helper.

If this proof exposes a defect, only the smallest deterministic correction inside the exact
secure-identity, database initialization/integrity/migration, legacy-import, owner-binding,
lease-completeness/activation or scheduler/durable-state branches is authorized. Any correction
requiring a Product rule, Business rule, authentication, tenant-isolation, NFC, backup or owner
fail-closed policy change stops for Human decision.

## 4. Finding B — abort while Accessibility restoration is required

Direct `abort` in every phase whose state has `requiresRestoreProof` must enter the existing
failure/restoration-only path rather than the ordinary idle-abort path. It must:

1. latch terminal failure without accepting later Product-success work;
2. retain only the input needed for the Human restoration proof;
3. require the existing restoration confirmation and read-only `standard-profile-check`;
4. close input only after that proof reaches its existing terminal result; and
5. continue through the existing single terminal cleanup and failure exit.

Ordinary idle `abort`, success-only `stop`, restoration criteria, Product behavior and cleanup
ownership remain unchanged. Focused adversarial tests must cover direct abort at every
restore-required phase, repeat/concurrent/late input, restoration failure/ambiguity/timeout,
rejection of success work after abort, exactly-once terminal cleanup and proof that input is not
closed before `standard-profile-check` can complete.

## 5. Exact future implementation boundary

The executable candidate is restricted to the exact fourteen-path allowlist in Section 6: the
precise Mobile scan-contract/coordinator/screen paths, their directly relevant tests, one test-only
Memory helper and one new Mobile lifecycle integration test; plus Synthetic
`Da5V5AdbController`, `da5V5Main`, their focused tests and
`Da5V5ProductStartBundle.test.ts`. No other path may change.

The three allowlisted Mobile Product TypeScript sources do change Product App code and therefore
code included in the newly built APK. No native Android, prebuild, app configuration, build/
signing/packaging configuration, dependency, lockfile, schema, migration, workflow, tracked
generated runtime/artifact-input or Product-source delta outside Section 6 is authorized. Visible
and TalkBack copy plus Product, Business, authentication, tenant-isolation, NFC, backup and owner
fail-closed semantics remain unchanged. The fresh APK must consequently be rebuilt and verified;
this does not authorize a packaging or signing configuration change. No refactor is authorized
except the mechanical fixture move above.

## 6. Exact path allowlist

The future executable/test delta may contain only these exact paths:

- `apps/mobile/src/scan/contracts.ts`
- `apps/mobile/src/offline/OfflineCaptureCoordinator.ts`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/tests/offline/MobileOfflinePrimitives.test.ts`
- `apps/mobile/tests/offline/OfflineCaptureDatabase.test.ts`
- `apps/mobile/tests/offline/OfflineCaptureCoordinator.test.ts`
- `apps/mobile/tests/runtime/ProductMobileRuntimeEmployeeReadiness.test.ts` (new)
- `apps/mobile/tests/screens/ScanScreen.test.ts`
- `apps/mobile/tests/support/MemoryOfflinePlatform.ts` (new)
- `apps/synthetic-android-e2e/src/Da5V5AdbController.ts`
- `apps/synthetic-android-e2e/src/da5V5Main.ts`
- `apps/synthetic-android-e2e/tests/Da5V5AdbController.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts`

## 7. Required R3 verification and publication

- **V0:** exact baseline/tree, exact allowlisted path delta, `git diff --check`, references and
  working-tree preservation; prove no dependency/lock/schema/workflow/generated/artifact delta.
- **V1:** directly changed and nearest contract/coordinator/screen tests, lifecycle integration,
  strict-v2 client/server/neutral-contract relevance, and adversarial ready-classification,
  UIAutomator and every restore-required abort phase.
- **V2:** complete affected Mobile and Synthetic workspace tests; tests-inclusive typechecks with
  explicit membership of every changed/new test; all relevant builds/bundles; protected-neighbor
  confirmation for authentication, tenant isolation, NFC, backup and owner fail-closed rules.
- **V3:** exactly one final complete local repository candidate regression after the final R3
  delta, with all applicable builds, tests-inclusive typechecks, exact counts and disclosed skips.
- **Publication:** independent prepublication candidate `APPROVED`, focused publication, then
  exact-head V4 on the published executable, a freshly rebuilt Product APK plus artifact
  manifest/package/signature binding, and a fresh read-only Product Operator runtime plus
  manifest/entrypoint/map binding.
- **Final review:** independent exact-head/artifact review binds the published commit/tree, exact
  delta, CI, runtime/manifest and all carried evidence; verdict must be `APPROVED` with zero open
  P0–P3 before any V5 request.

An unchanged failed check is not retried. Confirmed deterministic In-Scope findings may be
corrected within this cycle, then receive the affected checks, one final V3 where required and a
fresh independent review. Development performs no ADB, installation, Operator device run or
Hardware action.

## 8. Candidate Change-Impact Record

- Baseline: `6e84e80ea87f65977acd6b0a57326e6529dcd664` / tree
  `e9f2492aaf66467c61a6bc1a14ee7d8b7f1ef1e1`; `HEAD == main == origin/main` at preparation.
- Current delta: exactly this new authorization plus compact top/index entries in
  `ADO/00_Core/Project_Status.md`, `ADO/00_Core/Risk_Register.md`,
  `ADO/00_Core/Decision_Log.md` and `ADO/README.md`.
- Current affected runtime boundary: none; ADO-only candidate.
- Current risk: R0. Future exact implementation: R3 identity, encrypted persistence, durable
  lifecycle, disclosure and Hardware-readiness/Operator control boundaries.
- Current V0: exact five-path scope, diff/whitespace/reference/tracked-tree preservation and no
  executable delta.
- V1–V5: not run and not authorized for this candidate.
- Carried Evidence: consumed-run and cleanup-only facts remain bound to the current Runbook,
  Evidence and Flight Card; no older readiness PASS or technical closure is carried forward.
- Remaining gates: independent candidate review, focused ADO publication, then the authorized R3
  Development/Review cycle and exact-head/artifact closure.
- Current next gate: independent read-only review of this exact ADO-only candidate.
