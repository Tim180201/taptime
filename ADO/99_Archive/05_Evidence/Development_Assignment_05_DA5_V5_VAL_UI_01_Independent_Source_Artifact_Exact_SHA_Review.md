# Development Assignment 5 — DA5-V5-VAL-UI-01 Independent Source/Artifact Exact-SHA Review

- Status: **APPROVED**
- Date: 2026-07-28
- Verdict: `APPROVED`
- Open findings: P0 `0`; P1 `0`; P2 `0`; P3 `0`

## Exact reviewed source

| Binding | Reviewed value |
|---|---|
| Source commit | `e97bbe9e2a281099899e2ecb3aad2588ef20f22d` |
| Source tree | `2958f456875e8dab3f10834df280e10a8438efce` |
| Exact-head CI | `30370977809`, attempt 1, 12/12, success |
| Source reviews | Round 2 `APPROVED`; Round 3 `APPROVED`; zero open P0–P3 |

## Exact reviewed artifact

Artifact directory:
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-e97bbe9e2a28-810b856ff7113b4f`

| File/boundary | Reviewed value |
|---|---|
| APK | `app-release-810b856ff7113b4f.apk`; 65,629,505 bytes; mode `0444`; SHA-256 `810b856ff7113b4f2a454007595e1b6c1ae5dc69c601a2120b577f124e213e28` |
| Manifest | `manifest-e97bbe9e2a28.json`; 6,700 bytes; mode `0444`; SHA-256 `af53d646558449a7a5c907fbdf59e3366c6ffd2755f6049141db8e567549e051` |
| Package/version | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0` |
| Signing | `local-validation-only`; one v2 signer; certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Runtime/security boundary | NFC-only; no network permission; cleartext denied; backup disabled; no Product deep links or Tag dispatch |
| Metro source closure | 555 entries; 2,672,214 bytes; SHA-256 `75906c91cf382aa6b50f1846174b0d13ece28cae15f417b499eab29c263f0327` |
| Executable closure | 2,037,617 bytes; SHA-256 `6694a99a1388e376c253e72cdec88f879346389c0dccf683defe9805440e6bf2` |
| Native source closure | 123 directories; 587 entries; 464 files; 1,176,224 bytes; SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |

The official verifier returned `PASS`. The independent formal review verified exact local,
`main`, `origin/main` and GitHub source identity, exact-head CI, file sizes, modes and SHA-256
digests, the single v2 signer, permissions and components, deep-link and Tag-dispatch absence,
network/cleartext/backup boundaries, Hermes runtime markers, the native-module allowlist and all
32 manifest source entries and their closures. It also verified that the historical `7e8c0f7`
artifact was not reused.

## Closure and authority boundary

`DA5-V5-VAL-UI-01` is closed for its exact repository, source and artifact scope with zero open
P0–P3. This review does not prove the indistinguishable Phase-0 run-5 cause and grants no
installation, ADB, hardware, new Phase-0, Product Human-V5, production, production-data,
deployment or distribution authority. The historical `7e8c0f7` APK/manifest remains
**HISTORICAL — DO NOT INSTALL**. All five prior Phase-0 authorities remain consumed.

This archive records the independent review of the exact source and artifact bindings above. It
does not and cannot certify its own future publication commit, tree or CI.
