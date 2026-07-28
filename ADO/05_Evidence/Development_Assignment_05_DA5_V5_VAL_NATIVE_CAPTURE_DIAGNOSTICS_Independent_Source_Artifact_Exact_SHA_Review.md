# Development Assignment 5 — DA5-V5-VAL-NATIVE-CAPTURE-DIAGNOSTICS Independent Source/Artifact Exact-SHA Review

- Status: **APPROVED**
- Date: 2026-07-28
- Verdict: `APPROVED`
- Open findings: P0 `0`; P1 `0`; P2 `0`; P3 `0`

## Exact reviewed source

| Binding | Reviewed value |
|---|---|
| Authorized baseline | `96daac0b3cf1cfe98249a8c94fe927f34ee33af1`; tree `4e7ccd41a4fda0608a7e9deab7fbc258e1cf94bf` |
| Source commit | `effc57a6780ff86784de0519a34abd6c5b7b8cd6` |
| Source tree | `758dbfaa04d0968fb25122352055fbcb80f8f022` |
| Exact-head CI | `30377569479`, attempt 1, 12/12, success |
| Source reviews | Independent source review `APPROVED`; final prepublication review `APPROVED`; zero open P0–P3 |

The reviewed delta contains exactly these seven authorized files:

1. `apps/mobile/scripts/da5V5ValidationRuntimeContract.mjs`
2. `apps/mobile/src/validation/Da5V5ValidationContract.ts`
3. `apps/mobile/src/validation/Da5V5ValidationController.ts`
4. `apps/mobile/src/validation/Da5V5ValidationNfcCapture.ts`
5. `apps/mobile/tests/runtime/da5V5ValidationIsolation.test.ts`
6. `apps/mobile/tests/validation/Da5V5ValidationController.test.ts`
7. `apps/mobile/tests/validation/Da5V5ValidationNfcCapture.test.ts`

The correction exposes exactly six closed, typed, fixed-allowlist and disclosure-safe
native-capture failure stages: Technology evidence, UID readability, listener/registration,
digest, concurrency and cleanup. It emits no raw UID, payload, Technology list, provider
diagnostic, exception text or Logcat. NFC acceptance, timeouts and Controller fail-closed behavior
remain unchanged.

## Verification reviewed

Final V3 passed:

- 20/20 applicable builds;
- 21/21 tests-inclusive typechecks;
- 21 workspace suites, 147 test files and 2,373 tests;
- exactly two documented optional B1 skips;
- migrations 001–013 apply/replay/ledger verification;
- C3B CLI verification; and
- Android export.

The initial Synthetic stop was solely a Technical-Lead runner database-name configuration. The
previously unexecuted unchanged suite then passed 288/288 on a fresh exact database. No ports or
temporary residue remained. This operational stop was not a Product defect.

## Exact reviewed artifact

Artifact directory:
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-effc57a6780f-e423073e51f72a68`

| File/boundary | Reviewed value |
|---|---|
| APK | `app-release-e423073e51f72a68.apk`; 65,631,681 bytes; mode `0444`; SHA-256 `e423073e51f72a68421c8e4afd17a9b86c397ca83628deaf4b174543d817330f` |
| Manifest | `manifest-effc57a6780f.json`; 6,700 bytes; mode `0444`; SHA-256 `9d1238e821d92b26ed9bc9b9ee8ccd48607280ff0d0e752ec6965827c68ccc22` |
| Package/version | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0` |
| Signing | `local-validation-only`; one v2 signer; certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Runtime/security boundary | NFC-only permission; backup and device transfer disabled; no network permission; cleartext denied; no Product deep links or Tag dispatch |
| Metro source closure | 555 entries; 2,675,576 bytes; SHA-256 `e9fee0629af81357e4563836f9f5ef2b404c1ef97bc135d1cb3ed410f713b593` |
| Executable closure | 2,040,604 bytes; SHA-256 `c24457514436a63878107e1593dc90c6de17ad2424a6b625a6f18a14f66b8cfe` |
| Native source closure | Unchanged: 123 directories; 587 entries; 464 files; 1,176,224 bytes; SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |

The independent Artifact Exact-SHA review returned `APPROVED` with zero open P0–P3. It verified
all 32 manifest source-closure files byte-exact; package, signature, version, NFC-only permission,
backup/transfer, cleartext/network and Product-dispatch/deep-link boundaries; all four required
DEX modules present and all 14 forbidden modules absent; and Hermes Validation markers present
while Product, network, database and storage markers were absent.

## Consumed-run and authority boundary

Phase-0 run 6 used the authorized ADO baseline above, installed and verified the then-current
`e97bbe9` artifact and passed the Human-confirmed device checkpoint. The first required A-scan
showed only `Prüfung sicher gestoppt` /
`Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden`. No cause or Tag result is
attributable and no hardware defect is proven. Cleanup confirmed package, process and reverse
mappings at zero.

All six Phase-0 authorities are consumed. The `e97bbe9` and `7e8c0f7` artifacts are
**HISTORICAL — DO NOT INSTALL**. The reviewed `effc57a` artifact remains uninstalled and
installation-unauthorized.

This review grants no new Phase-0, hardware, ADB, installation, Product Human-V5, production,
production-data, system-change, deployment or distribution authority. It records the independent
review of the exact source and artifact bindings above, but does not and cannot certify this
archive's own publication commit, tree, CI or review.
