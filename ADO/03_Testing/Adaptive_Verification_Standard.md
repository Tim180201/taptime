# AVS-001 – Adaptive Verification and CI Efficiency Standard

## DA5 Product-Human visible-TTY routing closure and conditional replacement (`2026-08-18`) — FAIL_CLOSED / R0 REVIEW PENDING / NOT ACTIVE / STOP

The exact Product-Human/Hardware authority on head
`c2151a833043801440d20127cbf096b418d8e324`, tree
`6d4ffdc0b74016632dfb59b2f6b10ca30d7bd9cf`, CI `31812974037` attempt 1 / 12 of 12,
APK SHA-256 `b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234`
and Operator manifest SHA-256
`9a7224fcf459095dc5cb69de08780ce797a113464762ddf5c3d5cdb4d0a90ec3` was invoked
exactly once. The name-only environment preflight matched binding set
`ef9149d7a76aee1185cf01fe1c30f14c8cbef08a37ac639b0ae9c8f6f68236e8`, and the
Supervisor emitted the exact hidden-credential prompt. Codex UI then exposed an unrelated ordinary
zsh terminal; the Human entered a candidate there and received `zsh: command not found`. That
candidate is compromised and permanently non-reusable; neither its value nor a digest is retained.

The real Supervisor remained at its first input read. The Technical Lead sent SIGINT exactly once;
the Supervisor emitted only `da5_v5_flight_start_failed`, exited 1, emitted no
`da5_v5_flight_terminal` and created no Flight root. Exact source ordering awaits
`readDa5V5FlightCredential` before Controller construction and `controller.run()`; the child spawn
exists only inside `run()`. Therefore no Controller, child, ADB, installation, Product, NFC, Tag or
Hardware step occurred. Terminal truth is **`FAIL_CLOSED / PRE-CONTROLLER VISIBLE-TTY ROUTING
FAILURE`**, Product finding `NONE`, fast lane `STOP`; the authority and old binding set are consumed.

Immutable disclosure-safe Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-c2151a8-pre-controller-visible-tty-routing-failure-20260818`
is `0555`: `receipt.txt` is 3,989 bytes / `0444` / SHA-256
`cdb92889be81a710ed817fb0983faaf41e8e54e71503b0ea3b0530daf8755cec`; manifest is 1,309
bytes / `0444` / SHA-256
`90609a7b4f0c85d8d907063fb6f11aa9fb94f1915da3ed83ed7dcfa0abed1c59`. Its later
`2026-08-18T16:29:01Z` audit observed no DA5 Supervisor/child/Guard process, zero owned listeners,
zero `/private/tmp/.t5-*` names and no new Flight root. That is later current state only, never proof
of immediate complete cleanup, device/profile/package state, queue state or absence of transient
state.

Exactly one fully fresh replacement may become eligible only in this order: independent R0
semantic `APPROVED` of this exact three-document delta; one focused exact-three-document `[skip ci]`
publication; independent exact-head review; post-publication creation of a private immutable
visible-terminal launcher/execution-binding artifact bound to the final new Runbook/Ledger SHA-256
values and a new binding set; independent `APPROVED` review of that artifact; then **STOP** for a
fresh explicit Human authority. No replacement is active before that final authority. There is no
retry, resume or second replacement.

The replacement may carry unchanged only executable head/tree
`c2151a833043801440d20127cbf096b418d8e324` /
`6d4ffdc0b74016632dfb59b2f6b10ca30d7bd9cf`, the CI/APK/Operator bindings above, Supervisor
SHA-256 `eda3a6e407a07f6d923c62c3c7591a1bb79a2232e87a5b265ab77a7c419fe023`, child
SHA-256 `f480968a588e15bf974c172615edc0778fc4679088f6ccc86a5cdafecb5b00c1` and plan
SHA-256 `bd6d8f9614d9e86b46a0ca49cc431ce95130f99e35b4d1458238eb019bed08bf`.
The consumed binding-set ID above and old Runbook/Ledger file SHA-256 values
`3c5f3d89d9e519510647173490ac876f8d537f4f10a94aac383e64cdcdb1186b` /
`bfacfd30e2d40661c197ffe05eb413f8012672672ee5c23869df24f54cc60f2b` are non-reusable
because this amendment changes those files. Scope is R0/V0 and exactly these three ADO paths; no
Product test, Typecheck, build, V3, CI rerun, ADB or Hardware action follows.

## DA5 Compact-Login/Invitation R2 terminal PASS and publication gate (`2026-08-14`) — INDEPENDENT R3 APPROVED / R2 CONSUMED / HARDWARE STOP

The one-shot `DA5-CLIS-V3-R2` authority was activated on published head
`eb3c2d006934fe64031153834426864ffb9a5ce5`, tree
`9b024e5de558bf6be72348d9a88aa573bf37ab16`, parent
`caa4fb55c227de137d16ce4d7a39e67faafa38f0`. Immutable pre-D01 binding root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r2-pre-d01-binding-3de9b87baafb00cc6f29d44e93fdf14d`
is `0555`; its 7,490-byte receipt SHA-256 is
`c679dbfb767f5fa4bc88c1dd5699177578a8e1ddf293b3400a68b9c66e2e164a` and its 87-byte
manifest SHA-256 is `4dea8b66ce831f77df27422252670da460439d1f66c82118bfffb8064f7b3513`.
It binds the unchanged nine overlay blobs, resulting tree
`b61e3ec4ef2b84d36d1fb88f3c5bcc16e9042379`, and the 95,701-byte canonical full-index
patch SHA-256 `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`.
The authoritative frozen bundle is bound by manifest SHA-256
`db5c8a895eb7900271d35d0c68606c7e8c6f4399b8a43fd1f3a673c5173fccf2`, independent review
receipt SHA-256 `511095747c30ef9af20b7cff7048dc1ccdeab125983358271a067927626a72e3`
and review-subject SHA-256 `6f8fda9686c5fa8f8275037c4c52f7c72b67f3b75acdb9b49b9ccfc115d55e3f`.

The receipt-bound terminal supervisor ran exactly once. Supervisor, orchestrator and final-root
validator each terminated with `exit`/`0`, and the prebound final terminal envelope committed
`PASS`. Immutable inner root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r1-20260814T094123Z-3de9b87baafb00cc6f29d44e93fdf14d`
is `0555` and contains 883 manifested payloads plus its manifest = 884 regular files and 217
command sets / 868 command records. Its 2,524-byte receipt SHA-256 is
`b6124d02eecf961ad0cae1b883e2169476d955551c4a02ca932401f93a0224e5`; its 102,706-byte
manifest SHA-256 is `d63ebdef1f03c5c715ea3d87bc0c16a187b067114aada333610290a4923920e0`.
The literal `v3r1` inner path is the reviewed R2 recipe value and does not restore R1 authority.

Authoritative terminal root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r2-terminal-20260814T094123Z-3de9b87baafb00cc6f29d44e93fdf14d`
is `0555` and contains two manifested payloads plus its manifest = three regular files. Its
839-byte terminal receipt SHA-256 is
`ca48e2a7935e42906d09fd38694ab11ceebb67d5015df7f1a711fdd96adb4fc3`; its 192-byte manifest
SHA-256 is `a96119329668328e0a2a4d2f9a0f76d0f3499f46744a3fa013a06882e2c718d9`.
D01/D02, PostgreSQL 17 with eleven databases and 27 migrations, 20 builds, all 21
tests-inclusive-Typecheck memberships/commands, and all 21 suites passed. The suites covered 156
files, 3,071 passed tests, exactly three expected skips and zero failures. Artifact, C3B,
no-install, Node/JavaScript/map, Expo, final V0, inventory/sealing and cleanup gates all passed;
Product finding is `NONE`. No ADB, installation, Product-Human or Hardware action ran.

Independent R3 execution/Evidence review `/root/review_clis_v3r2_execution` returned `APPROVED`
with zero open P0–P3 findings. R2 is consumed `PASS`; there is no rerun. This top block supersedes
only the prospective R2 authority/current-state wording below and preserves all R1 history.
Next is exactly: independent R0/V0 review of these three ADO additions within the final 12-path
candidate → one intentional commit/push of the unchanged nine code/test blobs plus these three ADO
blobs → one exact-head CI/V4 → fresh runtime/Operator artifact generation and independent review
→ **STOP** for fresh explicit Human/Hardware authority. No local V3 rerun occurs because only
documentation was added after the independently reviewed, byte-unchanged nine blobs.

## DA5 Compact-Login/Invitation R1 correction and conditional R2 authority (`2026-08-14`) — REVIEW PENDING / NOT ACTIVE

Formal independent execution review returned `CHANGES REQUIRED` for `DA5-CLIS-V3-R1`. Its
terminal truth is **`FAIL_CLOSED / EVIDENCE INVALID / RUNNER-VALIDATOR DEVIATION`**, never
`PASS`: the outer D01 digest matcher exited `125` at the first decision-path deviation, and the
first pre-seal inventory validator exited `91` at the second. Technical gates observed after the
first deviation are diagnostic history only and are not reusable execution Evidence. Product
finding is `NONE`; cleanup is `PASS`; no ADB, installation, Product-Human or Hardware action ran.

The immutable historical root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r1-20260814T082337Z-2a40cfb8fa0d45e9b4de8362177a368b`
remains byte-unchanged with 787 payloads plus `evidence-manifest.txt` and 196 command sets.
`receipt.txt` is 4,511 bytes / `0444` / SHA-256
`05c6d91cd34e7c325e1378e7649b2a50d81f1ba4b92c9bc394e3527f955efc16`; the manifest is
91,302 bytes / `0444` / SHA-256
`c9ca075e0ebbf4d3cd81ea07a20224c8370613796e655f9610dbac2cda6af02c`. Its recorded `PASS`
classification is superseded; sealing does not make deviating execution valid. The following R1
authority block remains history and grants no run.

At this amendment baseline, `HEAD == main == origin/main ==
caa4fb55c227de137d16ce4d7a39e67faafa38f0`, tree
`28546aeab6c54f367f1f7ac312bc3a23b57eee1f`. The byte-identical nine-path executable/test
overlay produces tree `ea785f3f2b0eb23ee8c031a325ba5cac79da78c7`; its canonical full-index
patch remains 95,701 bytes / SHA-256
`948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`. These are
prepublication preparation facts, not substitutes for the future exact-head receipt.

This AVS block is the sole prospective authority for exactly one new, complete and fully fresh
`DA5-CLIS-V3-R2`. It remains inactive until, in order: independent `APPROVED` of this exact
three-document R0/V0 amendment; one focused three-document `[skip ci]` publication; independent
`APPROVED` of an immutable frozen runner bundle; and independent exact-head review issuing an
immutable receipt. That receipt must bind the published ADO head and tree, each of the three ADO
blob IDs, each unchanged overlay blob ID, the resulting combined tree, the canonical nine-path
patch bytes/SHA above, and every runner-bundle path, byte count, mode and SHA-256 together with
its manifest, validator/self-test receipts, terminal-supervisor/fault-test receipt and independent
review receipt. It also prebinds the run ID, canonical final inner-Evidence root and absent
canonical same-filesystem terminal-envelope stage, nonauthoritative pending and final paths; all
three must initially be absent. Missing, ambiguous or drifting binding is `STOP`; no value is
inferred.

R2 starts at D01 in fresh roots and may reuse no R1 gate, result, process, database, file, root or
observation; it is neither retry nor resume. Correction Round 1 found that the sealed inner root
cannot non-circularly record either its post-rename validator result or the orchestrator's eventual
terminal state. Therefore only receipt-bound absolute Node may invoke frozen
`terminal-supervisor.mjs` as the sole entrypoint. The supervisor directly spawns and awaits the
receipt-bound orchestrator with `shell: false`, requires terminal kind `exit`/code `0`, and then
separately directly spawns and awaits the receipt-bound validator against the immutable final
inner root with the same terminal requirement. The inner receipt is always
`TECHNICAL_GATES_COMPLETE_PENDING_TERMINAL_ENVELOPE`, never `PASS`.

The supervisor alone prepares a separate sealed terminal envelope after verifying the run ID,
canonical final-root path, exact manifest bytes/mode/SHA-256 and complete root/directory/file
mode/path inventory. It seals and validates stage, atomically renames stage to the prebound
nonauthoritative pending path while final remains absent, then fully rereads and validates pending
including its receipt and exact path/byte/mode/SHA inventory. Only after that success may it
atomically rename pending to the prebound final path. This second rename is the single terminal
authority, commit point and final operation affecting authority or Evidence; reviewed
same-filesystem rename semantics plus the prevalidated pending bytes make final authoritative on
successful rename. No required reread, fallible validation, cleanup or classification operation
follows it, and the supervisor's later process return is informational rather than a second
authority.

Stage and pending are explicitly nonauthoritative even if a complete `PASS` receipt is visible;
consumers accept only the exact prebound final path together with its referenced exact inner root.
Every fault before the second rename is `FAIL_CLOSED` and must leave final absent. Successful
commit leaves stage/pending absent and final present. This finite outer commit replaces any
self-recording requirement without permitting an external/ad-hoc wrapper. The Runbook top
addendum is the sole operative R2 recipe and leaves the existing exact run matrix otherwise
unchanged. Green R2 proceeds only to independent R3 execution/Evidence review and then **STOPS
before Supervisor, ADB, installation, Product-Human and Hardware**.

## DA5 Compact-Login/Invitation replacement V3 authority (`2026-08-14`) — REVIEW PENDING / NOT ACTIVE

The first final V3 for the unchanged nine-path Compact-Login/Invitation candidate tree
`534b1bfed4696833d2e6994af7e2eb2590b37388` and canonical full-index patch 95,701 bytes /
SHA-256 `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0` is consumed
`FAIL_CLOSED`. D01 and D02 passed exactly once; PostgreSQL 17.10 started and all eleven databases
were created, but the first migration stopped before migration 001 with SQLSTATE `42501`
(`permission denied to create role`). The runner had created separate installer LOGIN roles
without the required CI-equivalent superuser/role-creation semantics. This is a runner-bootstrap
failure, not a code or Product finding. Zero of 27 migrations and no build, Typecheck, suite,
additional gate, ADB, installation, Product-Human or Hardware action followed. Cleanup passed.

Immutable Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-534b1bfe-20260814T063909Z`
is `0555`, with 102 manifested payloads plus `evidence-manifest.txt` = 103 regular files. Receipt:
2,355 bytes / `0444` / SHA-256
`ed7d7972d385cbb2262df90e19ae490884c3a7a1a9c934f2bc600a943d29c96c`; manifest: 11,651
bytes / `0444` / SHA-256
`30cfdb6747dc0814cf3db1e487b1a578df8726578e56d8d7302d125ed7d8a68c`. Initial preflight
stdout was retained, but the four individual port return codes were not immutably bound; that
preflight Evidence remains incomplete. Post-cleanup Evidence fully binds separate successful
checks for ports 3000, 54321, 55435 and 55436, stopped PostgreSQL and absent worktree/task root.

Independent Review Round 1 inspected the combined 12-path input tree
`468ae43e2bf18914bef9a08c6b65c8ff7b9ff932` and its canonical full-index patch 109,107 bytes /
SHA-256 `aafe63a4bc156c5204820d9784cd7cba9e483e2353e7bde88b9cc76016c0f509`, and returned
`CHANGES REQUIRED` for non-deterministic runner detail and self-referential activation binding.
Those values remain Round-1 review input only; this three-document correction necessarily changes
them and must never be substituted for the final Pre-D01 target.

Only the byte-identical V2 result and pre-V3 independent R3 `APPROVED` with zero open P0–P3 may
be carried. No failed-V3 gate, result, process, database, task root, file or observation may count
as replacement-run execution or be reused. Only after independent `APPROVED` of this exact
three-document R0/V0 amendment, one focused documentation-only `[skip ci]` publication and
independent exact-head review may exactly one **new, fully fresh** replacement V3
(`DA5-CLIS-V3-R1`) start. That exact-head review must issue an immutable receipt binding the
published ADO commit/tree, each of the exact three published ADO blob IDs, each of the unchanged
nine executable/test overlay blob IDs, the resulting final combined candidate tree, and the
canonical nine-path overlay patch byte count and SHA-256 relative to the published ADO head.
Those externally exact-reviewed values—not the Round-1 input and not an in-document placeholder—
are the sole Pre-D01 target. A missing/ambiguous receipt or value is `STOP`; no hash is inferred or
invented. The run is expressly not a retry or resume and starts again at D01 in a fresh normal
detached worktree and task root. The Runbook top addendum is the sole operative database,
environment, command, port-Evidence and cleanup contract.

There is no separate candidate/run-plan input: suite fixtures, Expo values, final artifact gates
and final V0 are fixed only by that Runbook and the mandatory exact-head receipt. Replacement-run
Evidence is valid only as the fully reread, sealed final root below the Runbook-bound external
Evidence parent; deleting the disposable task root cannot delete it, and any staging,
inventory, manifest, permission, atomic-publication or reread failure makes the Evidence invalid
and can never yield `PASS`.

Any deviation, interruption, ambiguity or failed gate consumes `DA5-CLIS-V3-R1` fail-closed;
there is no retry, resume or further replacement. Green routes only to independent R3 execution/
Evidence review. **STOP** before ADB, installation, Product-Human and Hardware; those gates still
require fresh explicit Human authority.

## DA5 V3-D fulfillment and publication gate (`2026-08-14`)

V3-D ran exactly once on candidate tree `d8a7c272a41738e95b9bb5b6043312443bdfd7e5` and passed
the complete local R3 regression. Event-Ledger claim
`d1b1d67ef28081e25900e6b1367e3585a7846547960af47969b68c5aca341a5b` binds the immutable
Evidence; independent R3 review returned `APPROVED` with zero open P0–P3. V3-D authority is
consumed `PASS`; the prospective instructions below are historical and grant no further run.

Authorized next is only independent R0/V0 review of this focused three-ADO-file truth sync, then
one intentional commit/push of the exact 18-path candidate after Technical-Lead approval and
remote-state verification, followed by one exact-head CI/V4 and fresh runtime/artifact generation
and independent review. No local V3 rerun follows because these three documentation blobs change
no executable, test, package, dependency, workflow or artifact input and the other 15 candidate
blobs remain exact. **STOP** before ADB, installation, Product-Human and Hardware; fresh explicit
Human authority remains mandatory.

Historical consumed rule: only after independent ADO review returned `APPROVED` for the exact
three-document correction could
exactly one **new, fully fresh V3-D** start. It reruns the complete established sequence from D01;
no V3-A/B/C result, process, database, task root, file or observation is reused, resumed or called
a retry. The successful immutable runner record
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-9380758-corrected-4r21J4/runner-record.txt`
(2,839 bytes / `0444` / SHA-256
`5b23c0308ff5ca3cde791538b60a2092dafcf2b52878bf416ea6511339907921`) supplies command order
only, never prior results. The Runbook is the sole operative execution/environment contract.

The consumed V3-D used direct sequential process invocations in a full normal tracked detached worktree; sparse
checkout, monolithic/ad-hoc runners and inherited/global phase environments are forbidden. Raw
D01 and D02 npm debug logs and exact `/usr/sbin/lsof` port Evidence are hard gates. Any mismatch
or failure consumes V3-D; there is no retry or replacement. Green routes only to independent R3
review and stops before ADB, installation, Product-Human and Hardware. V3-D is a local technical
verification attempt, not a Human fast-flight event; the maximum three runs/24 hours applies only
to separately Human-authorized Product-Hardware flight events.

## DA5 fast-flight addendum (`2026-08-13`)

The exact-head approved DA5 fast-flight authorization at
`9032581b1cb13b4a44f575aaface8a87989f4932` activates one R3 implementation cycle with focused
V1, one affected-boundary V2 and exactly one final complete V3. Routine qualifying aborts do not
rerun Product verification: they require a sealed external receipt and every closed fast-lane
predicate to match. Campaign limits (at most three separately authorized runs in 24 hours) are
governance/Event-Ledger rules; executable code never starts another run. Any Product/security/
tenant failure or ambiguity, binding drift, cleanup/checker/seal risk, missing observation or
non-disposable mutation is `STOP`. V4, exact runtime/artifact review and every Human/Hardware gate
remain separately required.

### Current DA5 verification and one-new-run rule (`2026-08-14`)

Candidate tree `b775c248bb268e91b141c62361b47614f38934a5` / 212,896-byte full patch SHA-256
`155bb35851508e30bed6c3b2908c8b410845ddd6fabc3bd795016bd0ed744cc1` has fresh V2 PASS:
Synthetic 16 files / 384 passed / 19 expected DB skips, Mobile 1 file / 120 passed, both
tests-inclusive typechecks (579/870 listed files), fresh Synthetic build and exact child/flight
bundle checks. This R0 amendment carries those results and reruns no Product test.

V3-A is consumed `FAIL_CLOSED`. It passed D01/D02, 11 DB, 27 migrations, 20 builds, all 21
memberships/typechecks/suites (155 files; 3,040 passed, zero failed, three expected skips) and C3B,
then stopped at the read-only no-install preflight because the runner omitted
`TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5`. The Mobile package script calls
`da5V5AndroidNoInstallPreflight.mjs`, which reads that environment variable; the artifact helper
rejects every value except exact `da5-v5`. This is no code/Product finding. No ADB/install/Product/
Hardware action occurred and cleanup passed.

After independent ADO review `APPROVED`, one new fresh V3-B—and no retry/resume—is authorized on
the resulting exact amendment tree/patch. It repeats the complete established V3 from D01 using
absolute Node 24/npm CLI where npm is required; no V3-A result counts as V3-B execution. From exact
candidate-checkout CWD `/Users/timbartz/Dokumente/GitHub/taptime` and the unchanged minimal
sanitized V3 environment, the established gate directly runs the helper exactly once:
`/usr/bin/env TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5 /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`.
The helper is the direct child of D01-bound absolute Node `24.17.0`, not npm. Gate evidence retains
exact CWD/argv, environment-name proof, raw stdout/stderr and return code; conflicting profile,
DB-credential and secret variables remain excluded. No package lifecycle, bare
`node`/`npm`/`npx`, ADB or installation is allowed. Failure consumes V3-B without retry; green
V3-B proceeds to independent review, and no Hardware gate opens.

Status: Active — Human Architect Accepted; Manual Operating Rules Effective; CI Automation Pending
Document ID: AVS-001
Version: 1.0
Date: 2026-07-20
Owner: Technical Lead
Approval Authority: Human Architect
Related Standards: EOM-001, DTP-001, OAP-001, RHS-001

## Purpose

AVS-001 defines how TapTim.e preserves professional verification quality while avoiding repeated
execution of unrelated tests, builds and CI jobs.

The standard replaces the informal practice of repeating the complete repository matrix after
nearly every intermediate action with an evidence-based, risk-adaptive verification model.

It does not lower the Definition of Done. It changes when and why each verification layer runs.

## Human Decision

The Human Architect accepted the following operating decision on 2026-07-20:

> TapTim.e shall use focused verification during implementation, complete affected-boundary
> verification before Technical-Lead acceptance, one complete candidate regression before
> independent review, and a complete exact-head CI gate for product/release candidates. Existing
> security, independent-review, artifact and Human physical gates remain intact.

## Current Repository Truth

At adoption time, `.github/workflows/ci.yml` starts the complete ten-job matrix for every push and
pull request targeting `main`:

1. Core, Mobile, Admin Web and neutral-contract quality;
2. B1 PostgreSQL spike;
3. B3 schema security;
4. B4 identity and Membership security;
5. B5 tenant-safe read model;
6. B6 server-canonical lifecycle;
7. C2/C3C/C3E1/C3E2/offline API and Mobile transport;
8. C3B secure Organization bootstrap;
9. C3C/C3E1/C3E2 administration security; and
10. synthetic server-connected Android E2E harness.

The workflow already cancels an older in-progress run when a newer run for the same reference
starts. It does not yet contain a reviewed change-impact classifier or documentation-only path.

Therefore:

- the manual verification rules in this standard take effect immediately;
- fewer intermediate pushes and fewer redundant local full-suite runs may be used immediately;
- automatic CI job selection requires a separate authorized implementation task;
- this document does not claim that the current GitHub Actions behavior has changed; and
- until that implementation is independently approved, every push to `main` still consumes the
  current complete CI matrix.

## Scope

AVS-001 applies to:

- implementation work;
- bug and security corrections;
- refactoring;
- tests and test infrastructure;
- database schema and migration work;
- build, packaging and artifact work;
- ADO and other documentation-only work;
- Technical-Lead verification;
- independent-review preparation;
- exact-head CI;
- physical-gate preparation; and
- future deployment and release verification.

It applies to Humans and Agents performing Technical Lead, Development, Review and Implementation
Support responsibilities.

## Non-Goals

AVS-001 does not:

- authorize implementation, production, production data, deployment or distribution;
- relax an existing authorization package or gate;
- make a focused test equivalent to a complete regression;
- allow a green source-only typecheck to be described as tests-inclusive;
- allow a failed test to be ignored because it appears unrelated or expensive;
- allow skipped jobs to be reported as executed;
- replace independent review;
- replace Human physical validation where required;
- permit evidence from one commit, tree, artifact or environment to be silently attributed to
  another; or
- optimize CI by weakening tenant isolation, authentication, durability, migration or artifact
  checks.

## Normative Language

`MUST`, `MUST NOT`, `SHALL`, `SHALL NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT` and `MAY` are used
normatively.

Where AVS-001 conflicts with a concrete Human authorization, accepted ADR, security boundary,
release gate or Physical-Gate runbook, the stricter requirement applies.

## Core Principles

### 1. Verify the Changed Risk

Verification SHALL follow the changed behavior, its transitive dependencies and its failure
impact, not merely the directory containing the edited file.

### 2. Fast Feedback First

During implementation, the smallest regression-effective test set SHALL run first. This shortens
the feedback loop without converting focused evidence into final evidence.

### 3. Full Confidence at Decision Points

Complete regression and exact-head CI SHALL be concentrated at the points where a candidate is
accepted, independently reviewed, physically tested, deployed or released.

### 4. Evidence Is Bound

Every verification claim SHALL identify the source state, command or job, result and relevant
environment. Artifact claims SHALL additionally identify artifact size, digest and required
identity/signature metadata.

### 5. Uncertainty Expands the Test Set

If impact cannot be determined confidently, the verifier SHALL select the broader boundary or the
complete matrix. Cost or elapsed time is not a reason to guess.

### 6. Quality Is Not a Run Count

Repeated execution of unchanged tests against unchanged inputs does not create new product
confidence. New evidence is required when code, configuration, dependencies, environment,
artifact or risk changes.

## Change-Impact Record

Before selecting verification, the responsible Agent SHALL create a concise Change-Impact Record
in the task notes, implementation evidence or final handover.

The record contains:

- exact baseline commit and tree when available;
- changed files and intended behavior;
- affected workspaces and transitive consumers;
- affected security, data and runtime boundaries;
- risk class;
- selected verification levels;
- checks intentionally not run and the evidence-based reason;
- evidence carried forward, including its exact binding; and
- any uncertainty that forced broader verification.

The record may be concise for a small task. It may not be omitted.

## Risk Classes

### R0 — Non-Executable Documentation

All changed files are human-readable documentation and do not affect:

- source code;
- schemas or migrations;
- dependencies or lockfiles;
- compiler, bundler, native or release configuration;
- CI workflows or verification scripts;
- generated runtime inputs;
- security policy enforcement; or
- an artifact used for installation, deployment or release.

R0 classification requires an exact diff proving those conditions.

### R1 — Isolated Low-Risk Implementation

The change is contained within one well-understood component or workspace, has no privileged or
durable-data effect and has an explicit regression test.

Examples include a pure presenter correction or a local non-security UI rendering change.

### R2 — Boundary or Cross-Component Change

The change affects a public contract, shared package, API parser, Mobile/Web coordination,
repository adapter, build boundary or multiple workspaces.

### R3 — Security, Durability or Release-Critical Change

R3 includes any change involving:

- authentication, authorization, Membership or identity binding;
- Organization isolation, RLS or least-privilege roles;
- NFC capture ownership, concurrency, session generation or tag reassignment;
- offline persistence, queue ordering, idempotency, retry or reconciliation;
- encryption, SecureStore, SQLCipher, backup or transfer boundaries;
- schema migrations, transaction isolation or canonical lifecycle decisions;
- secrets, runtime configuration, CORS or disclosure boundaries;
- build, signing, packaging, artifact verification or installer behavior;
- CI selection logic, test runners or verification tools; or
- production, deployment, rollback, backup or recovery.

R3 SHALL fail closed and receives the broadest relevant verification.

## Verification Levels

### V0 — Integrity and Scope Check

Purpose: prove what changed and that the repository remains structurally valid.

Minimum:

- exact tracked diff and scope review;
- clean whitespace/error check;
- reference/link or formatting validation where available;
- no unsupported status, approval, CI or closure claim; and
- tracked working-tree preservation.

V0 is required for every task.

### V1 — Focused Feedback

Purpose: catch defects quickly while work is in progress.

Minimum:

- directly changed tests;
- a regression test that fails against the previous defect where applicable;
- nearest contract/parser/behavior tests; and
- a focused typecheck or static check for the changed source.

V1 MAY run repeatedly during implementation.

V1 alone is never final Technical-Lead evidence for R2 or R3.

### V2 — Affected-Boundary Verification

Purpose: prove the complete impacted dependency boundary before technical acceptance.

Minimum:

- complete tests for every affected workspace;
- tests-inclusive typechecks for changed test sources;
- relevant builds, bundles or declarations;
- direct database/migration verification if a persistence boundary is affected;
- direct adversarial or failure-path checks for changed security behavior; and
- unchanged-boundary confirmation for explicitly protected neighboring components.

V2 is required before Technical-Lead `APPROVED` for executable changes.

### V3 — Complete Candidate Regression

Purpose: establish one complete local candidate baseline before independent review or another
high-consequence gate.

Minimum:

- all locally executable repository suites;
- all applicable tests-inclusive typechecks;
- all applicable builds and bundles;
- migration-ledger verification against clean PostgreSQL where relevant;
- native release or artifact verification where relevant;
- exact test counts and disclosed skips; and
- final diff/scope inspection.

V3 is required:

- once for the final implementation candidate before its independent review;
- after any R3 correction;
- after dependency, lockfile, toolchain, root configuration or CI-verifier changes;
- when accumulated changes cross multiple architectural boundaries;
- when affected scope is uncertain;
- when V1 or V2 exposes an unexplained failure; and
- before a release or Physical-Gate candidate is published if the governing package requires it.

V3 SHOULD NOT be repeated after an unchanged documentation-only synchronization unless a stricter
existing gate explicitly requires it.

### V4 — Complete Exact-Head CI

Purpose: prove the published candidate on an independent clean runner.

The complete required GitHub Actions matrix SHALL pass on the exact commit selected as the
product, correction, artifact, deployment or release candidate.

V4 is required:

- for every final product implementation candidate;
- for every published security or R3 correction;
- before independent review where the review package requires exact-head CI;
- before a Human Physical Gate;
- before deployment or release; and
- whenever an explicit authorization package requires complete exact-head CI.

Intermediate implementation checkpoints SHOULD NOT be pushed only to obtain additional complete
CI runs when V1/V2 can provide equivalent development feedback.

### V5 — Human, Physical and Operational Validation

Purpose: verify behavior that automated source and CI evidence cannot establish.

V5 includes:

- real-device NFC;
- airplane-mode and process-restart behavior;
- Human-visible disclosure and interaction checks;
- exact APK/artifact binding;
- deployment rehearsal;
- backup/restore and recovery exercises; and
- production-readiness gates.

V5 requires separate Human authorization when the governing artifact says so. No observation from
an aborted or failed fresh gate may be reused unless the governing authorization explicitly
allows it.

## Required Verification by Risk

| Risk | During implementation | Before Technical-Lead approval | Before independent review/publication | Before Physical/Release gate |
|---|---|---|---|---|
| R0 | V0 | V0 | V0 plus any explicit document-review check | Stricter existing gate wins |
| R1 | V1 | V0 + V2 | One V3 candidate run, unless the accepted task explicitly narrows it | V4 and V5 if applicable |
| R2 | V1 | V0 + V2 | V3 + V4 on the selected candidate | V4 exact binding + applicable V5 |
| R3 | V1 plus adversarial checks | V0 + V2 | V3 + V4; independent review mandatory | Fresh V4 binding + separately authorized V5 |

## Documentation-Only and ADO-Only Changes

A documentation-only change MAY omit product test suites only when the Change-Impact Record proves
R0.

Required evidence:

- exact changed-file list;
- proof that no executable, schema, dependency, configuration, workflow, script or artifact input
  changed;
- V0 integrity checks;
- truthful references to existing test/CI evidence; and
- no new product correctness claim derived solely from documentation.

An ADO-only synchronization MAY carry forward a complete product CI result when:

- the exact product commit/tree remains named;
- the synchronization delta is R0;
- no generated artifact or runtime value changes;
- the carried evidence is identified as carried, not freshly executed; and
- no accepted authorization package explicitly requires a second complete exact-head run on the
  ADO head.

This rule is prospective. It does not retroactively weaken Development Assignment 1 or any other
existing exact-head binding.

## Test-Inclusive Typecheck Rule

A typecheck SHALL be described as tests-inclusive only when objective evidence proves that the
executed configuration includes the relevant test files.

Vitest or another transpile-and-run test result is not, by itself, a TypeScript typecheck.

If the standard workspace configuration excludes tests, the task SHALL run a supplementary
tests-inclusive configuration or report the gap. A source-only typecheck may still be reported,
but only by its accurate name.

## Complete Regression Cadence

During active development:

- V1 runs as needed;
- V2 runs once the affected implementation boundary is coherent;
- V3 runs once on the final review candidate rather than after every intermediate edit;
- V4 runs once on the final published candidate rather than on disposable checkpoints; and
- after CI automation exists, one scheduled complete matrix SHOULD run at least weekly during
  active repository development to detect dependency/environment drift.

No scheduled run is required during a period with no repository or dependency change unless a
release, compliance or operational rule requires it.

## Push and Publication Discipline

Agents SHALL avoid pushing transient or known-incomplete candidates to `main`.

The preferred sequence is:

1. implement locally with V1;
2. complete the affected boundary with V2;
3. run one V3 candidate regression;
4. obtain Technical-Lead approval;
5. publish the focused candidate once;
6. obtain one V4 exact-head result;
7. prepare the independent-review prompt; and
8. synchronize review/closure documentation without repeating product verification unless a
   stricter gate requires it.

Fewer pushes MUST NOT be achieved by creating an oversized, mixed-scope or unreviewable delta.

## Failure and Retry Policy

A failed check SHALL be investigated.

It may not be excluded merely because:

- it is slow;
- it passed previously;
- the changed file appears unrelated; or
- a rerun might turn green.

An unchanged CI attempt MAY be rerun when evidence identifies an infrastructure or teardown
failure after the tested assertions completed. The report SHALL preserve:

- the failed attempt;
- the exact failure;
- the reason it is classified as infrastructure/teardown;
- the unchanged source binding; and
- the successful retry, if any.

A repeated or unexplained failure is a repository finding and expands verification scope.

## Evidence Reuse

Evidence MAY be carried forward only when all relevant inputs are unchanged.

Required binding:

- source commit and tree;
- changed range proving the affected input stayed unchanged;
- dependency and lockfile state;
- toolchain/configuration state;
- command or CI job;
- environment relevant to the result; and
- result, count, skip and attempt information.

Artifact evidence additionally requires:

- byte size;
- cryptographic digest;
- package/version identity where applicable;
- signature identity where applicable;
- runtime-configuration verification where applicable; and
- preservation location and mutability state.

Evidence reuse SHALL be rejected if any relevant input changed or cannot be proven unchanged.

## Independent Review Requirements

Whenever an independent review is due, the Technical Lead SHALL provide the Human Architect with a
complete copy-ready Review Agent prompt.

The review package SHALL contain:

- exact baseline, candidate commit, tree and delta;
- exact changed-file scope;
- authorization and exclusions;
- Change-Impact Record and risk class;
- V0–V4 results that actually occurred;
- omitted checks and rationale;
- carried-forward evidence and its binding;
- open findings and known limitations;
- explicit prohibition on repository changes by the reviewer unless separately authorized; and
- the exact verdict format, including P0–P3 findings.

The independent reviewer MAY reproduce focused or adversarial checks. It SHALL not be told to
accept the Technical Lead's risk classification without verification.

## Human Physical Gate Requirements

AVS-001 does not shorten a Physical Gate.

Before a Physical Gate:

- the product/correction must have independent `APPROVED` review with no open blocking finding;
- the exact required V4 run must be green;
- the Human Architect must separately authorize the run;
- source, ADO head, artifact, size, digest, signature, package and runtime configuration must be
  bound as required;
- device and local infrastructure preflight must pass; and
- the run starts fresh at its first mandatory step.

## Future CI Automation Requirements

Automatic selective CI is not authorized by this document alone. A separate Infrastructure Task
shall implement it.

That task MUST provide:

- a version-controlled dependency and path-to-job map;
- a fail-closed classifier where unknown or ambiguous paths select the complete matrix;
- explicit full-matrix override for candidate, security, release and manual runs;
- a lightweight always-run integrity/governance job;
- a required aggregate result that distinguishes authorized skips from executed passes;
- tests proving every path class and transitive dependency;
- lockfile, root configuration, workflow and classifier self-change rules that select all jobs;
- one scheduled complete-matrix workflow during active development;
- preserved concurrency cancellation;
- auditable output listing selected and omitted jobs with reasons;
- no use of production secrets or production data; and
- independent review before the classifier controls a required gate.

No job-selection implementation may infer safety from folder names alone where a shared contract,
schema, build script or transitive consumer exists.

## Roles

### Human Architect

- accepts or rejects changes to verification policy;
- separately authorizes Physical, deployment and release gates; and
- decides whether a stricter product-specific gate may be relaxed prospectively.

### Technical Lead

- owns Change-Impact classification;
- selects and justifies verification levels;
- expands scope when uncertainty exists;
- approves technical evidence;
- produces the independent-review prompt whenever review is due; and
- prevents optimization from reducing security or product truth.

### Development and Implementation Support Agents

- run V1 and V2 as instructed;
- add regression-effective tests;
- report every failure and omitted check truthfully; and
- do not redefine risk or gate requirements.

### Review Agent

- independently verifies scope, risk and evidence;
- challenges unsafe omissions;
- distinguishes carried evidence from freshly reproduced evidence; and
- returns an evidence-based verdict without implementing changes.

## Standard Completion Report

Every implementation or correction handover SHALL include:

```text
Verification Summary

Baseline commit/tree:
Candidate commit/tree:
Risk class:
Changed boundaries:
V0:
V1:
V2:
V3:
V4:
V5:
Carried evidence:
Checks not run and reason:
Failures/retries:
Remaining risks:
Next required gate:
```

Fields that do not apply remain present as `Not applicable` or `Not authorized`.

## Metrics

The Technical Lead SHOULD periodically record:

- complete local regression runs per Development Assignment;
- complete CI runs per published candidate;
- duplicate runs caused only by documentation synchronization;
- cancelled superseded runs;
- failed attempts and root causes;
- average feedback time for V1/V2; and
- defects found after a narrower verification level.

Metrics guide improvement. They SHALL NOT become quotas that pressure an Agent to skip required
verification.

## Adoption and Precedence

AVS-001 applies prospectively from 2026-07-20.

For work already governed by an accepted authorization, implementation plan, Physical-Gate
runbook or exact-head requirement, the existing stricter text remains authoritative until the
Human Architect explicitly amends it.

In particular, AVS-001 does not alter the current Development Assignment 1
`DA1-ARTIFACT-02` review, artifact rebinding or future Human Physical Gate requirements.

## Revision History

| Version | Date | Change | Approval |
|---|---|---|---|
| 1.0 | 2026-07-20 | Established risk-adaptive local verification, concentrated complete candidate regression, exact-head CI requirements, evidence-reuse rules and the separately gated selective-CI target | Human Architect accepted |
