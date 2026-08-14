# Development Assignment 5 — Append-Only Event Ledger

## Claim `5898f40b130c82a5bdaf540d1f59861cd3775a638749b00040a0bb45bdffaaf9` — Compact-Login/Invitation R1 invalid Evidence and conditional R2 authority (`2026-08-14`)

- `binding_set_id`: `14a4dd1effdb145bfd7c1f8069172a6dffea12f02cbdd30d156f59da65f03c17`;
  binds the unchanged nine-path overlay tree at this amendment baseline
  `ea785f3f2b0eb23ee8c031a325ba5cac79da78c7`, canonical full-index patch 95,701 bytes /
  SHA-256 `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`, and the immutable
  R1 receipt/manifest below.
- `supersedes_claim_ids`:
  [`3d04c462b0f5e1303683e6b11ab21424b7c556b27b94204e8c1845173ed86897`] only for that
  claim's prospective R1 authority and any conflicting current R1 truth. Its first final-V3
  failure, SQLSTATE `42501`, cleanup and other historical facts remain unchanged.
- `provenance`: formal independent execution review `CHANGES REQUIRED` plus the immutable R1
  Evidence root below. This three-document amendment is R0/V0 and review-pending.
- `time_scope` / `observation`: the two named decision-path deviations and later diagnostic gates
  are observed in the immutable run; no later gate is reusable execution Evidence.
- `authority_before`: exactly one `DA5-CLIS-V3-R1`; `authority_after`: R1 is consumed
  `FAIL_CLOSED` with no retry or resume. Prospective R2 remains inactive behind the AVS gates.
- `evidence`: immutable, unchanged root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r1-20260814T082337Z-2a40cfb8fa0d45e9b4de8362177a368b`
  contains 787 payloads plus `evidence-manifest.txt` and 196 command sets. `receipt.txt` is 4,511
  bytes / `0444` / SHA-256
  `05c6d91cd34e7c325e1378e7649b2a50d81f1ba4b92c9bc394e3527f955efc16`; the manifest is
  91,302 bytes / `0444` / SHA-256
  `c9ca075e0ebbf4d3cd81ea07a20224c8370613796e655f9610dbac2cda6af02c`. The receipt's `PASS`
  classification is superseded without changing the root.
- `verification`: outer D01 digest matcher return code `125` was the first decision-path
  deviation; first pre-seal inventory-validator return code `91` was the second. Technical gates
  observed afterward are diagnostic only. Product finding is `NONE`; no ADB, installation,
  Product-Human or Hardware action ran.
- `cleanup`: `PASS`; it does not repair invalid Evidence or authorize reuse.
- `prospective_r2`: the AVS top addendum alone conditionally authorizes exactly one fully fresh
  `DA5-CLIS-V3-R2` after independent ADO `APPROVED`, focused exact-three-document `[skip ci]`
  publication, independent immutable frozen-runner-bundle `APPROVED`, and independent exact-head
  receipt binding the published ADO head/tree/three blobs, unchanged nine overlay blobs,
  resulting combined tree, canonical patch bytes/SHA, exact runner bundle including
  `terminal-supervisor.mjs` and its fault-test receipt, prebound run ID/final inner root and absent
  canonical same-filesystem terminal-envelope stage, nonauthoritative pending and final paths. The
  Runbook top addendum alone is the operative recipe. R2 starts at D01 with no reuse/retry/resume;
  failure consumes it with no replacement.
- `prospective_terminal_commit`: only receipt-bound absolute Node invokes the frozen terminal
  supervisor. It awaits exact orchestrator `exit`/`0`, independently awaits final-root validator
  `exit`/`0`, verifies run/root/manifest/mode/path bindings, and then seals and atomically publishes
  a separate terminal envelope. The inner receipt is
  `TECHNICAL_GATES_COMPLETE_PENDING_TERMINAL_ENVELOPE`, never `PASS`. It seals/validates stage,
  atomically renames stage to nonauthoritative pending while final stays absent, and fully
  rereads/validates pending. Only the second atomic pending-to-final rename is the commit and final
  Evidence/authority operation; exact reviewed same-filesystem semantics plus prevalidated
  pending bytes make final authoritative without a post-final reread. Stage/pending remain
  nonauthoritative even with a visible complete `PASS` receipt, and consumers accept only the
  prebound final path jointly with its referenced exact inner root. Every precommit fault leaves
  final absent; successful commit leaves stage/pending absent and final present. No cleanup or
  classification operation follows; supervisor return is informational, not recursive authority.
  External/ad-hoc wrappers remain forbidden.
- `terminal_state`: **`FAIL_CLOSED / EVIDENCE INVALID / RUNNER-VALIDATOR DEVIATION`**; recorded
  R1 `PASS` is invalid and superseded; Product finding `NONE`; cleanup `PASS`; fast lane `NOT
  APPLICABLE`. R2 green can proceed only to independent R3 execution/Evidence review and then
  **STOPS before Supervisor, ADB, installation, Product-Human and Hardware**.

## Claim `3d04c462b0f5e1303683e6b11ab21424b7c556b27b94204e8c1845173ed86897` — Compact-Login/Invitation V3 terminal failure and conditional replacement authority (`2026-08-14`)

- `binding_set_id`: `50e58860f132131257f487cc5c1bc571b3ab27d1e45027c166e59f6ac0e8a40f`;
  binds candidate tree `534b1bfed4696833d2e6994af7e2eb2590b37388`, canonical nine-path
  full-index patch 95,701 bytes / SHA-256
  `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`, receipt digest and
  manifest digest below.
- `round_1_review_input`: exact combined 12-path tree
  `468ae43e2bf18914bef9a08c6b65c8ff7b9ff932`; canonical full-index patch 109,107 bytes /
  SHA-256 `aafe63a4bc156c5204820d9784cd7cba9e483e2353e7bde88b9cc76016c0f509`.
  Independent Review Round 1 returned `CHANGES REQUIRED` for P1-A deterministic execution detail
  and P1-B activation binding. These values are historical review input, never a final Pre-D01
  target after this three-document correction.
- `supersedes_claim_ids`: `[]`; this is the sole result/Evidence claim for this Compact-Login/
  Invitation final-V3 attempt and does not rewrite prior fast-flight V3-A/B/C/D history.
- `provenance`: machine execution and cleanup facts supplied by the Technical Lead and the
  immutable Evidence below. This three-document amendment is R0/V0 review-pending; it claims no
  independent ADO approval or replacement execution.
- `time_scope` / `observation`: named execution gates and final cleanup are immediate / observed.
  Initial port stdout is observed, but the four individual preflight return codes are unproved /
  unobserved; complete post-cleanup port Evidence does not repair that limitation.
- `authority_before`: exactly one final V3; `authority_after`: that attempt is consumed
  `FAIL_CLOSED`, with no retry or resume. Exactly one new fresh `DA5-CLIS-V3-R1` becomes active
  only after independent ADO `APPROVED`, focused three-document `[skip ci]` publication and
  independent exact-head review. Its immutable receipt must bind the published ADO commit/tree,
  exact three ADO blobs, unchanged nine executable/test overlay blobs, resulting final candidate
  tree, and canonical nine-path overlay-patch bytes/SHA relative to that published head. Those
  externally reviewed values alone are the Pre-D01 target; missing/ambiguous values are `STOP`,
  and no placeholder or hash may be inferred. Failure then consumes the run with no replacement.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-534b1bfe-20260814T063909Z`
  is `0555`, with 102 manifested payloads plus `evidence-manifest.txt` = 103 regular files;
  receipt 2,355 bytes / `0444` / SHA-256
  `ed7d7972d385cbb2262df90e19ae490884c3a7a1a9c934f2bc600a943d29c96c`; manifest 11,651
  bytes / `0444` / SHA-256
  `30cfdb6747dc0814cf3db1e487b1a578df8726578e56d8d7302d125ed7d8a68c`.
- `verification`: unchanged V2 remains carried `PASS`; pre-V3 independent R3 review remains
  carried `APPROVED` with zero open P0–P3. In the consumed V3, D01 and D02 passed exactly once;
  PostgreSQL 17.10 and exactly eleven fresh databases passed. The first migration stopped before
  migration 001 with SQLSTATE `42501` because a separate installer LOGIN role lacked
  CI-equivalent role-creation privilege. Zero of 27 migrations completed; no build, Typecheck,
  suite, later/final gate, ADB, installation, Product-Human or Hardware action ran.
- `cleanup`: `PASS`; PostgreSQL stopped, worktree/task root were absent, and separate retained
  `/usr/sbin/lsof` checks fully proved ports 3000, 54321, 55435 and 55436 free after cleanup.
- `replacement_execution_contract`: there is no separate candidate/run-plan input. The Runbook
  fixes every suite fixture, all six Expo values, all four exact artifact gates and final V0 from
  the mandatory exact-head receipt. Every command writes directly to a fresh external Evidence
  stage; only its inventory/manifest/mode-complete, atomically published and fully reread sealed
  final root is authority. Task-root deletion cannot delete that Evidence; any sealing failure is
  invalid and can never yield `PASS`.
- `terminal_state`: `FAIL_CLOSED`; Product finding `NONE`; fast lane `NOT APPLICABLE`. No failed-
  V3 gate, result, process, database, root, file or observation may be reused. The AVS top
  addendum alone governs the conditional one-shot replacement authority; the Runbook top addendum
  alone governs its fresh execution, including its byte-bound tool and immutable command/
  environment/order recipe inputs. Green replacement V3 routes only to independent R3 review and
  **STOPS before ADB, installation, Product-Human and Hardware**.

## Claim `d1b1d67ef28081e25900e6b1367e3585a7846547960af47969b68c5aca341a5b` — V3-D terminal PASS (`2026-08-14`)

- `binding_set_id`: `7d799b1c2e4ad86bdfe3df0f25b5af081dc881213f8e8a87c0e3ef1e5e71bdb4`;
  binds candidate tree `d8a7c272a41738e95b9bb5b6043312443bdfd7e5` and its canonical 18-path
  baseline patch (237,564 bytes / SHA-256
  `4c21064c2c6cec03029f130df3b885c486739ef6180e8d1e647564d2327cfb73`) to the immutable
  receipt/manifest below.
- `supersedes_claim_ids`:
  [`d01c6ffe997b0e9a1bf4ed1e7a7115ad0e5380fa21e4b04e7b5b45281ebaa476`] only for that
  claim's prospective V3-D authority and conflicting current V3-D result; its V3-C terminal facts
  remain historical and unchanged.
- `provenance`: Machine execution/cleanup facts supplied by the Technical Lead, immutable Evidence
  below, and independent R3 review `APPROVED` with zero open P0–P3.
- `time_scope` / `observation`: immediate / observed for all named gates and final cleanup.
- `authority_before`: exactly one fresh V3-D; `authority_after`: V3-D consumed `PASS`; no ADB,
  installation, Product-Human or Hardware authority was created.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-fast-d8a7-v3d-OCGEwA2H`
  is `0555`, with 381 manifested payloads plus `evidence-manifest.txt` = 382 regular files;
  receipt 2,623 bytes / `0444` / SHA-256
  `5daa9e3b279eac6feabc51fdcad2fae1ec7306f77d984b10bb49f14cfdce5377`; manifest 69,979
  bytes / `0444` / SHA-256
  `40a8053ec1abc436e5f9fdf2c8917f73c67dff1ff8a2560ddd24153bf1b1a4e2`.
- `verification`: D01/D02 ran once with retained raw logs and zero D02 problems; PostgreSQL
  17.10/11 databases/27 migrations, 20 builds, 21 membership/tests-inclusive Typechecks and 21
  suites passed. The suites covered 155 files / 3,043 tests: 3,040 passed, three expected skips,
  zero failures. C3B, direct-Node no-install preflight, Node checks, Expo,
  bundle/map/APK/tool/V0 and cleanup passed; cleanup stopped PostgreSQL, removed the task root and
  proved ports 3000/54321/55435/55439 absent via `/usr/sbin/lsof`.
- `terminal_state`: `PASS`; cleanup `PASS`; Product finding `NONE`; fast lane `NOT APPLICABLE`.
  No ADB, installation, Product-Human or Hardware action occurred; independent review found no
  open code, security, tenant-isolation, FD3, protocol or receipt-sealing finding.

## Claim `d01c6ffe997b0e9a1bf4ed1e7a7115ad0e5380fa21e4b04e7b5b45281ebaa476` — V3-C terminal correction (`2026-08-14`)

- `binding_set_id`: `418aa03701ea5ff5f104092b9e2aac2e2820ac38e3134f03778fe035f7c307f2`;
  binds unchanged candidate tree `5b50f0c2b0f1a6635ea73808911d42d8a3f6f653`, its canonical
  18-path baseline patch (236,475 bytes / SHA-256
  `405efc2b2b03ecd19f41500f3dc362077c371da99f6b2095d4dac3c8fe434c42`) and the immutable
  Evidence manifest below.
- `supersedes_claim_ids`:
  [`a475acb21a8458c447a74c1c344719c8806ab85777156e1a64a644327b73c791`] only for that
  claim's prospective V3-C authority and every conflicting current V3-C result/cleanup wording;
  its V3-B terminal facts remain historical and unchanged.
- `provenance`: Machine execution/cleanup facts supplied by the Technical Lead, immutable Evidence
  below, and independent read-only review `CHANGES REQUIRED` findings.
- `time_scope` / `observation`: execution and gate facts are immediate / observed; immediate
  owned-port cleanup is immediate / unproved and unobserved; the later `/usr/sbin/lsof` state is
  later / observed and cannot repair the unproved immediate state.
- `authority_before`: exactly one V3-C; `authority_after`: V3-C consumed `FAIL_CLOSED`. No V3-D
  may start until the exact three-document correction receives independent ADO `APPROVED`.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-fast-5b50-v3c-failed-sparse-checkout-20260814T0039Z`
  is `0555`, with 43 manifested payloads plus `evidence-manifest.txt`; receipt 1,668 bytes /
  `0444` / SHA-256 `b6a58f5316cf54939465f0d3336cbae1cf8000c44655ee54cd3c3d5680d08a44`;
  manifest 4,057 bytes / `0444` / SHA-256
  `2a3ad07572901c4c6d4ad2f206aedf2dd72c65a08c213440a1e976bee12d7307`.
- `verification`: carried V2 remains `PASS`. D01 and D02 ran once each and their PASS results are
  supported by JSON/stderr/return-code/digest Evidence, but the raw D02 npm debug log was not
  retained; the mandatory retention gate was therefore `MISMATCH` and should have stopped before
  PostgreSQL. PostgreSQL 17.10, 11 databases and 27 migrations later passed. The first build then
  failed with TS5083 solely because the ad-hoc sparse checkout omitted tracked root
  `tsconfig.base.json`; this is a runner failure, not a code or Product finding.
- `cleanup`: immediate owned-port cleanup is `UNVERIFIED`: four sealed checks used missing
  `/usr/bin/lsof`. A later `/usr/sbin/lsof` free observation proves only later state and cannot
  repair the immediate claim. No ADB, install, Product-Human or Hardware action occurred.
- `terminal_state`: `FAIL_CLOSED`; Product finding `NONE`; no result, process, path or observation
  is reusable. AVS-001 alone governs the prospective one-shot V3-D; the Runbook alone governs it.

## Claim `a475acb21a8458c447a74c1c344719c8806ab85777156e1a64a644327b73c791` — V3-B terminal (`2026-08-14`)

- `binding_set_id`: `a07cde46aec06d28446addb18e9c4918fc1f517c3e28e67201de8066349a505c`;
  binds candidate tree `a89127a8dd6c8706ade531065fd65207797da0a0`, canonical baseline diff
  225,713 bytes / SHA-256 `cc8ac2b4b394d925eda71fce65ad88113196aa23e82a9adcf9dfec30ab4adac4`
  and the immutable Evidence manifest below.
- `supersedes_claim_ids`: `[]`; this is the sole current V3-B result/Evidence claim.
- `provenance`: Machine result and cleanup facts supplied by the Technical Lead; independent
  result review `APPROVED`, zero open P0–P3.
- `time_scope` / `observation`: point-in-time / observed for the named gates and cleanup only.
- `authority_before`: exactly one fresh V3-B; `authority_after`: V3-B consumed `FAIL_CLOSED`.
  No V3-C authority exists until the exact three-document amendment receives independent ADO
  `APPROVED` under AVS-001.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-fast-a891-v3b-failed-pg-locale-20260814T0153Z`
  is `0555`, with 43 manifested payloads plus `evidence-manifest.txt` = 44 regular files;
  receipt 1,189 bytes / `0444` / SHA-256
  `cd1805dbcc5e297d861cf9f1150522017e55725066c86732928089d99941b131`;
  manifest 4,102 bytes / `0444` / SHA-256
  `a3059e57162e7a8ace1dda31f907908acd3e3465e9f68187f23d0cb6db0120a7`.
- `verification`: carried V2 remains `PASS`. V3-B ran D01 and D02 exactly once and both passed;
  `initdb` passed with locale `C`. The first and only `pg_ctl` start then failed before any
  database existed with `postmaster became multithreaded during startup` and the valid
  `LC_ALL` hint. No database, migration, build, Typecheck, suite or final gate ran; no ADB,
  install, Product, Human or Hardware action occurred. Cleanup passed and the candidate remained
  unchanged. This is solely a runner-locale failure, not a code or Product finding.
- `terminal_state`: `FAIL_CLOSED`; cleanup `PASS`; Product finding `NONE`; fast lane `NOT
  APPLICABLE`; V3-B results are never reusable.

For current precedence, this claim alone is V3-B result/Evidence truth, AVS-001 alone governs the
prospective one-time V3-C authority, and the Runbook alone defines its operative commands and
phase environments. Conflicting V3-B runner/authority text in unchanged ADR-0019, the Lean
Hardware Flight Card, V5 Evidence and Publication Closure is superseded and remains historical
point-in-time content only.

Status: **ACTIVE SCHEMA / R3 IMPLEMENTATION CANDIDATE / NO RUN AUTHORITY**

Governing activation: exact-head approved authorization commit
`9032581b1cb13b4a44f575aaface8a87989f4932`, tree
`03c06109a622e666d693ad9f28785ad834f4e663`.

This is the single published append-only source for prospective DA5 fast-flight events. Git and
immutable external evidence retain detail; this Ledger does not copy the 13,000-line historical
narrative. Corrections append a new claim and name `supersedes_claim_ids`; existing entries are
never silently mutated. Operational receipts are authoritative until required synchronization.

## Current technical verification / no operational event (`2026-08-14`)

Pre-amendment candidate tree `b775c248bb268e91b141c62361b47614f38934a5`, full 18-path patch
212,896 bytes / SHA-256 `155bb35851508e30bed6c3b2908c8b410845ddd6fabc3bd795016bd0ed744cc1`,
has fresh V2 PASS: Synthetic 16 files / 384 passed / 19 expected DB skips; Mobile 1 file / 120
passed; both tests-inclusive typechecks, fresh build and bundle checks.

Technical V3-A is consumed `FAIL_CLOSED`. It passed D01/D02, 11 DB, 27 migrations, 20 builds,
21 memberships/typechecks/suites (155 files; 3,043 tests: 3,040 passed, zero failed, three expected
skips) and C3B, then stopped at the no-install preflight because exact
`TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5` was missing. Repository source requires that exact profile;
this is a runner-configuration failure, not a code/Product finding. No ADB, install, Product or
Hardware action occurred; cleanup passed. Evidence root
`v3-fast-b775c248-failed-profile-20260814T0049Z` is `0555` / 78 manifest-bound payload files plus
`evidence-manifest.txt` = 79 regular files total; receipt SHA-256
`d13dae77c997167962ac31c843e8ee22f904001957c25db0143dceb88c61fb75`; manifest SHA-256
`36d1172e26f330d12d3990a29e0e0bd31e42adc0fd80b71c09be373773fb79f1`.

After independent ADO review `APPROVED`, exactly one **new** fresh V3-B is authorized on the
amendment's resulting bound tree/patch. It reruns full V3 from D01; V3-A is context only. Before
D01 the runner proves the exact unchanged minimal sanitized profile environment. The read-only
gate binds candidate-checkout CWD exactly as
`/Users/timbartz/Dokumente/GitHub/taptime`, directly invokes exactly once
`/usr/bin/env TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5 /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`,
and retains exact CWD/argv, the environment-name proof, raw output and return code. The helper is
the direct child of D01-bound Node `24.17.0`; no package lifecycle, bare `node`/`npm`/`npx`,
profile/DB-credential/secret leakage, ADB or install is permitted. Failure consumes V3-B with no
retry; green goes to independent review only. No fast-flight/Physical event or Hardware authority
is created.

## Closed entry schema

Each appended event supplies exactly:

- `binding_set_id`: lowercase SHA-256 of the reviewed Flight Package and applicable evidence set;
- `claim_id`: stable unique lowercase digest identity;
- `supersedes_claim_ids`: zero or more earlier claim IDs;
- `provenance`: `Human`, `Machine` or `TL`, plus responsible source;
- `time_scope`: `immediate`, `later` or `unproved`;
- `observation`: `observed` or `unobserved`;
- `authority_before` and `authority_after`, including consumption state;
- `evidence`: algorithms, digests and immutable receipt/artifact bindings only;
- `verification`: AVS risk/level, commands/results, omissions and reasons;
- `terminal_state`: attempted outcome, cleanup, Product-finding and fast-lane state separately.

No entry contains a Credential, secret/digest, raw serial/UID/NFC payload, personal data, PID,
raw Product record or transcript. A routine nonmaterial qualifying receipt may wait until campaign
end, binding change, release/DA6 boundary or 24 hours, whichever is first. A batch containing a
Physical result, authority transition, safety, cleanup or terminal classification receives one
independent semantic delta review.

## Governing pointers

| Claim | Current value |
|---|---|
| `ledger-schema-activation-20260813` | Schema and fast-flight policy activated by the governing commit/tree above; implementation review/publication/V4 remain pending; no run authority |
| `latest-historical-terminal-pointer` | See the correction-2 sections in V5 Evidence and Publication Closure: `FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2; LATER CURRENT STATE CLEAN`; authority consumed; queue unobserved; no retry/resume/relogin/replacement |

No prospective physical or fast-flight run event exists at creation of this Ledger.
