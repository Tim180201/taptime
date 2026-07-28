# Development Assignment 5 — DA5-V5-VAL-TECH-01 Independent Source/Artifact Exact-SHA Review

- Status: **APPROVED**
- Date: 2026-07-28
- Verdict: `APPROVED`
- Open findings: P0 `0`; P1 `0`; P2 `0`; P3 `0`

## Exact review target source

| Binding | Candidate value |
|---|---|
| Authorized baseline | `aebffbec7c72c028ace6365ecdcc413e314526dd`; tree `9e0104229756fe223753916ace8247ee2626f4d5` |
| Source commit | `03694f2d877bc323791e93473ad01ceb82af70df` |
| Source tree | `6c6039683e067ef29f1f917a60c2628d26e38784` |
| Exact-head CI | `30386552118`, attempt 1, 12/12, success |
| Source review | Prepublication review round 2 `APPROVED`; zero open P0–P3 |

The focused correction requires both fully qualified
`android.nfc.tech.NfcA` and `android.nfc.tech.MifareUltralight` as a subset of the
Android-reported Technology array. Additional or duplicated entries are ignored for the decision
and are neither returned nor persisted. Contract, output label, UID/digest semantics, timeout,
Controller and filter remain unchanged.

## Exact review target artifact

Artifact directory:
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd`

| File/boundary | Candidate value |
|---|---|
| APK | `app-release-d2084486b07f27bd.apk`; 65,631,433 bytes; mode `0444`; SHA-256 `d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5` |
| Manifest | `manifest-03694f2d877b.json`; 6,700 bytes; mode `0444`; SHA-256 `aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347` |
| Package/version | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0` |
| Signing | `local-validation-only`; one v2 signer; certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; v1/v3/v3.1/v4 absent |
| Runtime/security boundary | NFC permission plus package-private signature receiver guard only; NFC feature required; backup and device transfer denied; no network permission; cleartext denied; no Product deep links or Tag dispatch |
| Native/runtime inspection | Four required native modules present; all 14 forbidden network/storage/database/background/task/dev native modules absent; exactly one Hermes bundle; Validation marker present; Product/network/database/storage runtime markers absent |
| Source closure | All 32 manifest source-closure entries matched real, non-symlink exact-source files and their exact Git objects |
| Native source closure before build | 123 directories; 587 entries; 464 files; 1,176,224 bytes; SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |

## Candidate preparation and verification

One fresh research-free detached sparse checkout of the exact source was prepared with only
`apps/**`, `packages/**`, root `package.json` and root `package-lock.json` materialized. Root
`app.json` was not materialized. Offline dependencies were recreated under Node.js `v24.17.0`
and npm `11.13.0`.

The existing documented builder ran exactly once:

```text
npm --workspace @taptime/mobile run android:da5-v5-validation:build
```

It completed `BUILD SUCCESSFUL` with 275 actionable Gradle tasks and emitted:

```text
da5_v5_validation_artifact_published publication=da5-v5-validation-03694f2d877b-d2084486b07f27bd source_commit=03694f2d877bc323791e93473ad01ceb82af70df source_tree=6c6039683e067ef29f1f917a60c2628d26e38784
```

Separate post-publication checks confirmed canonical real paths, non-symlink regular files, exact
sizes, modes and SHA-256 values; exact source commit/tree; all 32 source-closure files and Git
objects; package/version/signature/signer; permissions, queries, NFC, backup, cleartext and
network boundaries; required/forbidden native modules; and Validation-only Hermes markers.

The official verifier ran with the exact bindings above and returned:

```text
da5_v5_validation_artifact_verified
```

No V3/source test suite was rerun during artifact preparation; source V3, exact-head CI and source
review remain the separately recorded source-publication evidence.

## Review and authority boundary

The independent Source/Artifact Exact-SHA review returned `APPROVED` with zero open P0–P3 for
the exact source, CI, APK, manifest and closure bindings above. The candidate APK/manifest
remains **DO NOT INSTALL** because this review grants no Phase-0, installation, ADB or hardware
authority; any use requires a future separate exact Human authorization.

All seven Phase-0 authorities remain consumed. Run 7 stopped at safe stage
`technology_evidence`, with no fingerprint or Tag result, physical `techTypes` unknown, no
hardware defect proven and final package/process/reverse state zero. The `effc57a`, `e97bbe9`
and `7e8c0f7` artifacts remain historical and **DO NOT INSTALL**.

This package grants no Phase-0, installation, ADB, hardware, device/Tag, Product Human-V5,
production, production-data, system-change, deployment or distribution authority. It also does
not and cannot certify its own future publication commit, tree, CI or review.
