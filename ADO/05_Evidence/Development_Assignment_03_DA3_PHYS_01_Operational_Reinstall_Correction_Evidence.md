# Development Assignment 3 — DA3-PHYS-01 Operational Reinstall Correction Evidence

- Status: **LOCAL R3 CORRECTION CANDIDATE; AVS V0–V3 PASSED; V4 AND INDEPENDENT REVIEW PENDING**
- Date: 2026-07-22
- Authorized baseline commit/tree:
  `f0c9db3d2fc8ed5fae3d54f147a696c56a79aec3`,
  `27cabe61e25a77fe73427aded735dfb4e59cbe01`
- Product/artifact source remains:
  `6eb68a3b4f9567600e12ec5a4f4b72ca4da99dca`, tree
  `bb8564fd0911d2b32dccb776f4a3f938621ee052`
- Risk class: AVS-001 **R3 — security/identity and Physical-Gate procedure**
- Owner: Technical Lead
- Physical Gate: **NOT AUTHORIZED**
- Production, production data, deployment and distribution: **NOT AUTHORIZED**

## 1. Exact Human decision and authority

After the first failed V5 run and independent zero-finding approval of its failure synchronization,
the Human Architect explicitly selected the operational clean exact-artifact reinstall boundary
after Administrator setup and authorized its focused implementation, Runbook/Evidence, AVS V0–V4
and independent review on the exact baseline above. The Physical Gate remained separately
unauthorized.

This decision rejects a product-side empty-store identity-transition rule for this correction.
No product architecture, business rule, production authority or replacement-run authority is
implied.

## 2. Change-Impact Record

- Intended behavior: Administrator prerequisite setup remains durable on the synthetic server, but
  its single-owner local installation is removed before Employee Gate A. The exact same immutable
  APK is then installed from a verified clean package state.
- Changed boundary: the DA3 V5 operational Runbook and its ADO status/evidence only.
- Unchanged executable boundaries: all Mobile/Admin Web/backend/Core source, tests, migrations,
  dependencies, lockfile, workflow, build scripts, install/disconnect helpers and product artifact.
- Preserved security properties: permanent encrypted single-owner binding; no silent rebind;
  explicit logout invalidation; package backup/transfer exclusion; exact artifact/signature/runtime
  verification; scoped mapping/package cleanup.
- Server data boundary: the disposable database and its synthetic prerequisite rows remain active
  across the local package replacement. No setup observation is re-run or converted into lifecycle
  evidence.
- Failure behavior: any unexpected mapping/package state, artifact mismatch, failed uninstall,
  failed reinstall, changed aggregate server state or protected Employee state invalidates the
  complete later run and triggers normal cleanup.
- Risk: R3 because the procedure crosses identity ownership and installation boundaries before a
  physical release gate, even though the repository delta is ADO-only.
- Verification selected: V0 exact scope/reference checks; focused identity/reinstall-boundary
  source/test confirmation; complete V3 repository regression and artifact revalidation; V4
  exact-head CI; independent exact-delta review.
- Carried evidence: independently approved Product `6eb68a3`, its 12/12 CI and immutable APK; this
  correction makes no new product-correctness claim from documentation alone.
- Intentionally not executed: ADB, package uninstall/install, device interaction and V5 because
  the Physical Gate remains separately unauthorized.

## 3. Implemented operational boundary

`ADO/04_Operations/Development_Assignment_03_V5_Runbook.md` now requires:

1. complete real Administrator setup, sign-out and exact aggregate prerequisite proof;
2. fresh revalidation of the same read-only authorized APK;
3. scoped removal of the two owned reverse mappings and proof that the table is empty;
4. exact-package-only uninstall and proof of zero installed synthetic packages;
5. no device reset, backup/restore, database reset or server prerequisite mutation;
6. reinstall through the already reviewed helper against the unchanged exact artifact;
7. exact package/mapping/artifact and unchanged server-aggregate proof; and
8. Employee-only authentication on the new installation before Gate A may present a Tag.

The procedure does not use `adb reverse --remove-all`, `pm clear`, a product identity transition,
a rebuilt APK or any retained local Administrator state. A failed boundary cannot be repaired or
resumed.

## 4. Verification ledger

This section is completed only from actually executed evidence. No pending row is a pass.

| Level | State | Evidence |
|---|---|---|
| V0 | Passed | exact baseline/remote/authority inventory; ADO-only changed-file proof; reference resolution; `git diff --check`; tracked user-file preservation |
| V1 | Passed | focused Mobile offline database/scheduling, exclusive NFC and Administrator setup: 4 files, 26/26; Mobile typecheck passed |
| V2 | Passed | complete Mobile 421/421 and synthetic harness 46/46; exact runbook adversarial review; unchanged source/schema/dependency/workflow/artifact proof |
| V3 | Passed | 1,758 tests across all 19 workspaces plus two disclosed optional B1 Supavisor skips; 19/19 typechecks; 18/18 applicable builds; Android export of 850 modules; PostgreSQL reruns/cleanup; artifact runtime/hash/mode revalidation; 11 moderate, zero high/critical advisories |
| V4 | Pending | correction publication and complete exact-head GitHub Actions matrix |
| Independent review | Pending | exact-delta review with P0–P3 disposition |
| V5 | Not authorized | no ADB, installation, device interaction or physical observation |

### 4.1 Executed V3 detail

The complete workspace test command first exposed two missing local prerequisites and is not counted
as a pass for those two suites: B1 rejected absent `B1_DATABASE_URL`; DA3 rejected absent local
database `taptime_da3`. Every other workspace completed successfully. The Technical Lead then used
two newly created, task-specific disposable loopback databases and synthetic-only runtime
passwords. B1 passed 39 tests with its two documented optional Supavisor-mode skips; DA3 time review
passed 10/10. Both databases were dropped and the exact pre-run `taptime_%` role set was restored.

The synthetic Android harness then ran against the exact dedicated disposable database and passed
46/46 with zero skips. Its schema, migration ledger, generated runtime roles and connections
returned to zero; a pre-existing database container/service was not removed. Across all workspaces,
the accepted total is exactly 1,758 passing tests plus the two B1 skips.

All 19 tests-inclusive or workspace-appropriate typechecks and all 18 applicable builds passed.
The first Android export invocation from the repository root was rejected because Expo resolved the
wrong app entry and contributes no evidence. The exact CI-equivalent invocation from `apps/mobile`
then bundled 850 modules successfully.

The unchanged read-only APK remained 95,437,611 bytes, mode `0444`, SHA-256
`215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1` and freshly passed the exact
Hermes runtime verifier. The adjacent 2,206-byte mode-`0444` manifest remained SHA-256
`07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`. No ADB command,
installation, device interaction or V5 observation occurred.

## 5. Stop condition and next gate

This candidate cannot close `DA3-PHYS-01` or make a replacement run eligible until V0–V4 and an
independent review have passed. After that, a later complete fresh V5 run still requires a separate
Human authorization explicitly naming both installations, the interim package-only uninstall,
exact commits/trees/CI, immutable artifact, approved device and both approved synthetic tags.
