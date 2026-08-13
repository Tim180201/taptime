# Development Assignment 5 — V5 Final-V3 Sequencing Correction Authorization

- Status: **CANDIDATE — R0 REVIEW/PUBLICATION PENDING / NO EXECUTION OR HARDWARE AUTHORITY**
- Date: 2026-08-13
- Owner: Technical Lead
- Approval authority: Human Architect
- Exact R0 baseline: `fe029f078654e5b46b9563bf613f36fa90ec765c`
- Exact R0 baseline tree: `a1d251a2c392cdb58739769bfa56e53ff054363c`
- Current candidate risk: AVS-001 **R0**; corrected future sequence: **R3**
- Governing documents: ADR-0019; AVS-001
- Amends: `Development_Assignment_05_V5_Fresh_Artifact_Rebinding_Authorization.md`
- Related risks: R-026; R-034

## 1. Purpose and current truth

The approved Product source and artifact hardbinding exist locally, but the first attempted final
V3 did not execute its dependency gates sequentially. The dependency graph observation began
while the single dependency installation was still running. Its resulting four problem tuples
are therefore partial-install observations, not a lockfile or Product defect. No build,
Typecheck, test, PostgreSQL, migration or additional final gate ran.

This five-path ADO-only candidate records that failure without relabeling it, closes the runner
sequencing defect, and authorizes exactly one fresh corrected final V3 after the publication and
merge sequence below. It changes no executable, test, dependency, lockfile, schema, workflow,
artifact or runtime input. It grants no current install, build, publication, CI, ADB, device or
Hardware claim.

## 2. Exact local lineage and approved artifact binding

The following identities are immutable inputs, not future hashes:

| Item | Exact binding |
|---|---|
| Published remote baseline | `fe029f078654e5b46b9563bf613f36fa90ec765c` / tree `a1d251a2c392cdb58739769bfa56e53ff054363c` |
| Local source A | `03e0e48ad53ff91b24ee1182abf782473317988d` / tree `4465f8ee5be41f82cdaed5f31f2da92b839c952d`; direct parent `fe029f078654e5b46b9563bf613f36fa90ec765c` |
| Local hardbinding B | `489a853e1af45e60bab0b94bcce05d674f6af700` / tree `841727f8228f85ab91f5f7e9e9a052608e105152`; direct parent A |
| Exact A→B delta | Exactly the four paths authorized by the fresh-artifact amendment; ordinary `git diff --binary A B` SHA-256 `d430d51edf2459f37b96f6634611ad6092d9aa23330ec923da15e7dc2fc55127` |

B and its exact four-path delta already received independent pre-V3 `APPROVED` with zero open
P0–P3. A and B remain local and unpushed.

The independently approved read-only Product artifact pair is:

| Artifact | Bytes | Mode | SHA-256 |
|---|---:|---:|---|
| `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-03e0e48a-b02fdb2544225d03/app-release-b02fdb2544225d03.apk` | 95,526,563 | `0444` | `b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234` |
| `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-03e0e48a-b02fdb2544225d03/artifact-manifest.txt` | 1,968 | `0444` | `91725bb6f14306eb40d0e4414f38511fc829250799af91bacf840ac622efc577` |

The APK remains bound to source A and package `com.tim180201.mobile.synthetic`; B only hardbinds
that approved pair. This correction authorizes no artifact rebuild, replacement or mutation.

## 3. Consumed failed V3 evidence and exact cause

The failed execution is immutable and non-reusable:

- evidence root:
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-489a853-20260813T101450Z`;
- receipt: 3,105 bytes, mode `0444`, SHA-256
  `1d5d4c19cc339e099b2961f7cdbda41eba82ee17d56865c96cda5a99338910d8`;
- manifest: 739 bytes, mode `0444`, SHA-256
  `ffe4fd456740db2c5ee1b2de305725ca35f0fc010f9d2683549205892f0e9866`.

Independent timing from the retained npm logs supersedes the receipt's claimed dependency-gate
sequence and duration: D01 started at `10:24:20.409`; D02 started at `10:25:00.314`, only
39.905 seconds later. D01 then recorded `hermes-compiler` fetch at 59.369 seconds,
`expo-modules-core` fetch at 60.980 seconds, package addition and terminal exit 0. D02 therefore
overlapped the still-running D01.
The wrapper treated a yielded/backgrounded command path as completion and its failure handler also
attempted to assign zsh's read-only `status` parameter.

The partial D02 output contained exactly:

1. extraneous `@expo/expo-modules-macros-plugin@0.3.0`;
2. extraneous `expo-modules-jsi@57.0.0`;
3. invalid `expo-modules-core@` although `expo` wants `~57.0.2` and lock/actual is `57.0.2`;
4. invalid `hermes-compiler@` although `react-native` and lock/actual require
   `250829098.0.14`.

These are exact hard production lock edges: `expo -> expo-modules-core@~57.0.2`;
`expo-modules-core@57.0.2 -> @expo/expo-modules-macros-plugin@0.3.0` and
`expo-modules-jsi@~57.0.0`; and
`react-native -> hermes-compiler@250829098.0.14`. Each locked package has its exact
version, registry `resolved` value and integrity. Root `package-lock.json` is unchanged at
SHA-256 `902286a30377eef08ce7613eff44d5af5bdd47bb09f7d3cc0741c69685bad491`.
No tuple is waived or allowlisted.

The failed attempt ran no PostgreSQL, build, Typecheck, test, migration, artifact or additional
gate. Its exact bounded cleanup/postcleanup result and immutable evidence preservation remain as
recorded; no cleaned execution state may be resumed. It is not V3 PASS evidence and may not be
retried unchanged.

## 4. Activation and publication/merge sequence

This correction activates only after this exact five-path R0 candidate receives independent
read-only `APPROVED` with zero open P0–P3 and is focusedly published from exact `fe029f` as one
documentation commit D. D's actual commit and tree are recorded only after publication and are
not predicted here.

After D is published, create exactly one local merge commit M with:

- first parent exactly B `489a853e1af45e60bab0b94bcce05d674f6af700`;
- second parent exactly published D;
- no merge conflict;
- content delta relative to B exactly these five ADO paths; and
- no executable, test, dependency, lockfile, schema, workflow, artifact or runtime delta.

Do not rebase, cherry-pick or change A, B or the approved artifact pair. M is the sole final
candidate, corrected-V3 execution head and later publication head. The APK stays source-A-bound;
B stays unchanged in M's first-parent ancestry. D is already remote, so a later push of approved
M advances `main` once and carries A/B through M's ancestry without an A-only or B-only push.

## 5. Corrected D01/D02 runner contract

Run in one fresh research-free, task-owned safe root bound to exact M, using the governing exact
Node `24.17.0` and npm `11.13.0` identities. The receipt and manifest live in a fresh uniquely
named immutable evidence root outside the cleanup target.

1. Record absolute D01 start time. Run exactly one foreground child:
   `node npm-cli.js ci --no-audit --no-fund`. A synchronous foreground child or an explicitly
   awaited execution session is required. A pipeline, `tee`, background process, output yield or
   session identifier is never child completion. Await terminal child completion and record its
   absolute end time and exit in `d01_rc`; do not assign `status`.
2. Continue only if `d01_rc == 0` and the exact npm debug log proves terminal
   `verbose exit 0` and `info ok`. Missing, ambiguous or late proof fails closed.
3. Only then bind the canonical installed manifest realpath, name and version for exactly
   `@expo/expo-modules-macros-plugin@0.3.0`, `expo-modules-jsi@57.0.0`,
   `expo-modules-core@57.0.2` and `hermes-compiler@250829098.0.14`. Verify root and hidden
   lockfile hashes, each exact `resolved`/integrity tuple and all four hard edges above. Any
   absence, mismatch, invalid, extraneous, missing or path ambiguity fails before D02.
4. Record absolute D02 start time and run exactly one foreground child:
   `node npm-cli.js ls --all --json`. Require terminal exit 0, root `taptime@0.1.0`, absent or
   empty `problems`, and a recursive zero count for `invalid`, `extraneous`, `missing` and
   `error`. No package, problem or edge allowlist and no workspace-only weakening is permitted.

The receipt records absolute start/end times, every child exit, strict D01-before-D02 ordering,
the complete later gate order and exact postcleanup result. It persists no secret or unbounded
raw output. A failed safety prerequisite stops dependent work; an independent Product-quality
failure follows the governing AVS collect/stop rule and is never hidden by cleanup.

## 6. One corrected final V3 and closure

After D01 and D02 pass, continue the original complete V3 without narrowing: exactly 20/20
applicable workspace builds, 21/21 tests-inclusive Typechecks, 21/21 workspace suites, the clean
isolated PostgreSQL 17 migration apply/replay/ledger boundary, C3B binary verification, Android
export, Product no-install/artifact verification and every other unchanged additional gate from
the correction and fresh-artifact authorizations. Record actual file/test counts and disclosed
expected skips. Do not substitute carried, workspace-only or focused evidence for a gate selected
by the complete matrix.

Exactly one fresh corrected V3 attempt is authorized on M. This is a corrected execution, not a
retry or resumption of the failed wrapper. Any new failure is preserved and investigated under
AVS-001; it creates no automatic additional attempt or weakened gate.

After V3 PASS only:

1. independent prepublication review binds exact A, B, D and M, their trees/parents/deltas, the
   approved APK/manifest and corrected V3; required verdict is `APPROVED`, zero open P0–P3;
2. after exact remote/ref and scope checks, push M once to `main`;
3. run one complete exact-head V4 on exact M;
4. create the fresh read-only Product Operator runtime and manifest from exact published M under
   the already authorized artifact root; and
5. obtain final independent exact-head/artifact `APPROVED` binding M/tree, V4, source-A APK and
   manifest, hardbinding B and M runtime/manifest/bundle/map.

No D-only Product CI, A/B publication, extra complete V3, duplicate V4 or artifact rebuild is
authorized.

## 7. Boundaries and R0 Change-Impact Record

- Current changed scope: exactly this new file plus compact top/index entries in
  `ADO/00_Core/Project_Status.md`, `ADO/00_Core/Risk_Register.md`,
  `ADO/00_Core/Decision_Log.md` and `ADO/README.md`.
- Current affected executable boundary: none; current risk is R0. Future corrected final V3,
  publication, CI and Operator artifact closure remain R3.
- Current V0: exact baseline/ref/path/diff/reference/whitespace checks and proof of no executable
  delta. No npm, test, Typecheck, build, PostgreSQL, artifact, CI or V5 action runs for this R0
  candidate.
- Production, production data, production signing, deployment and distribution remain excluded.
- No ADB, installation, emulator, device, Tag/NFC, Product Operator device run, Human observation
  or Hardware V5 is authorized. Those remain behind final closure and a fresh separate exact
  Human authorization.
- Current next gate: independent read-only review of this exact five-path R0 candidate.
