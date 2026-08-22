# Development Assignment 3 — Independent V5 Enablement Review

Date: 2026-07-22
Reviewer role: Independent Software Architecture, Security and QA/Release Reviewer
Review mode: Read-only
Final verdict: **APPROVED — ZERO OPEN P0/P1/P2/P3**
Physical disposition: **PHYSICAL GATE, APK INSTALLATION AND ADB REMAIN UNAUTHORIZED**

## 1. Provenance, exact binding and scope

The Human-supplied independent review result was received after the product and Evidence heads had
both passed exact-head CI. The raw supplied review text had SHA-256
`0c21b64e27b6ae4bf020163a91fad52d0973ec756e887845af5b8cfa73472586`; this hash records
provenance only and is not an additional product artifact or authority.

The independent reviewer verified:

- Human-authorized V5/DA3-V5-F01 baseline
  `0b0d04034c88829fdc5c548b057e74554d4ee197`, tree
  `eee26501fd714738aa3ca106d93d5088261206e3`;
- product candidate `6eb68a3b4f9567600e12ec5a4f4b72ca4da99dca`, tree
  `bb8564fd0911d2b32dccb776f4a3f938621ee052`, exact parent `0b0d040`, 20 files and
  `+675/-64`;
- Evidence-sync head `f4e2eeb3bb47ed1dd3b2f0cf10fd0f725650d6ba`, tree
  `20e5715c448331f5d99536259743dccc7005dffb`, exact parent `6eb68a3`, whose final commit changes
  exactly seven ADO files by `+109/-27` and no executable file;
- `origin/main == f4e2eeb` with a clean tracked worktree at review completion;
- byte-identical migrations `001`–`012` across baseline, product and Evidence heads;
- product GitHub Actions run `29927309720`, attempt 1, 12/12 successful; and
- Evidence GitHub Actions run `29928717227`, attempt 1, 12/12 successful.

The reviewer stated that `app.json` and `research/` remained unread and untouched and made no
repository change.

## 2. Findings and verdict

- P0: 0 open.
- P1: 0 open.
- P2: 0 open.
- P3: 0 open.

Final verdict: **APPROVED**.

The reviewer explicitly evaluated, but did not classify as findings:

- the interchangeable ADO wording “V4 independent review” and “independent exact-SHA V5 review”,
  because both references resolve to this one review and create no authority ambiguity; and
- the test-only `exportTimestamp` helper's explicit CSV microsecond form, because the real 46/46
  PostgreSQL run proves agreement with the unchanged CSV-v1 dialect.

## 3. Independently verified DA3-V5-F01 boundary

The reviewer traced the complete request path and confirmed:

- the export contract validator intentionally produces the three public values plus two internal
  epoch helpers;
- the export coordinator independently rejects any request whose key count is not exactly three;
- `BackendHttpServer` now constructs and freezes a fresh literal containing only
  `expectedMembershipId`, `fromInclusive` and `toExclusive`;
- no helper field, caller prototype or additional request value crosses the API/coordinator
  boundary;
- the API regression's deep-equality assertion fails on additional fields, unlike the former
  partial-object assertion; and
- invalid input remains disclosure-safe while CSV shape, range semantics, roles, pools and audit
  meaning remain unchanged.

The reviewer therefore accepted DA3-V5-F01 as corrected for the authorized local candidate scope.

## 4. Independently verified harness and runbook boundary

The reviewer confirmed:

- real time-export and time-review coordinators replace the former DA3-unavailable stubs;
- three isolated pools use distinct generated logins with exact identity-resolution plus one
  least-privilege DA3 capability each;
- cleanup covers all 14 generated runtime logins;
- operator `status` exposes only safe aggregate counts;
- the real journey proves Employee denial, Administrator correction, legacy adjudication, effective
  corrected CSV and append-only ledger/audit increments;
- the lockfile adds only the four intended local harness workspace links;
- partial adjudication retains the Mobile review marker, while complete exact-prefix adjudication
  plus authenticated server proof permits its clear;
- the fixed loopback/USB/synthetic-data, abort, disclosure and cleanup boundaries remain intact;
  and
- the three focused Mobile dependency builds plus the three readiness markers provide the
  documented reproducible artifact boundary.

The reviewer also confirmed that the rejected Node-26, missing-`dist`, partially red root-build and
other pre-final runs are disclosed and are not counted as successful Evidence.

## 5. Artifact verification

The independent reviewer recomputed and confirmed:

- APK path:
  `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da3-v5/6eb68a3/app-release-215b4c924f0b7702.apk`;
- 95,437,611 bytes, mode `0444`, SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`;
- package `com.tim180201.mobile.synthetic`, version `1.0.0` (`1`), minSdk 24 and targetSdk 36;
- exactly one APK Signature Scheme v2 signer with certificate SHA-256
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`;
- local Android debug signing only, with no distribution claim;
- packaged `allowBackup=false`, `usesCleartextTraffic=false`, `fullBackupContent` and
  `dataExtractionRules`; and
- a fresh read-only Hermes check returning
  `synthetic_e2e_android_runtime_complete_verified`.

The adjacent 2,206-byte, mode-`0444` binding manifest was independently confirmed at SHA-256
`07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`.

No APK installation, ADB action or Physical Gate was performed.

## 6. Verification disposition

The reviewer locally reproduced:

- focused Backend API export regression 12/12;
- neutral time-review contract 5/5;
- neutral time-export contract 10/10;
- the deliberately non-evidentiary no-database harness result 35 passed / 11 skipped;
- `npm audit`: 11 moderate, 0 high and 0 critical; and
- clean complete-range `git diff --check`.

The reviewer reconciled the 1,758-test total across all 19 workspaces and verified from the
exact-head CI log that the database-backed harness passed 46/46 with zero skips. A complete local
V3 rerun, APK installation, ADB, Physical Gate and live migration retest were deliberately omitted
under the read-only mandate. Both 12-job exact-head CI runs and byte-identical migrations supplied
the independently checked replacement evidence.

## 7. Remaining risks and authority boundary

The reviewer retained as non-finding risks:

- the Human Web/Android/NFC procedure remains unexecuted;
- the debug signer is unsuitable for distribution;
- 11 moderate Expo/Xcode toolchain advisories remain, with no high/critical advisory;
- artifact integrity must be recomputed immediately before any later authorized run; and
- DA3 and DT-069–DT-074 remain open.

This `APPROVED` verdict completes the independent review required for the focused V5 enablement
candidate. It does not close DA3 or any DT-069–DT-074 item and authorizes neither the Physical Gate,
APK installation, ADB, production, production data, deployment nor distribution. The next possible
step is a new, separate Human-Architect authorization quoting the exact independently approved
product/Evidence/review-publication commits, trees, CI and immutable artifact bindings and
authorizing one fresh execution of the V5 runbook.
