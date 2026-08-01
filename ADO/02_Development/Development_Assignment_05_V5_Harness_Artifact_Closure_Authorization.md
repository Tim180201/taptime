# Development Assignment 5 — V5 Harness Artifact Closure Architecture and Authorization Candidate

- Status: **ATTEMPT-8 REVIEW APPROVED WITH ZERO P0–P3; EXACT EXECUTION CONSUMED FAIL-CLOSED AT EXTERNAL_LOG_CHECK BEFORE LIFECYCLE/V0/BUILD/TEST/ARTIFACT; PRODUCT HUMAN V5 DO NOT START**
- Date: 2026-08-01
- Exact preparation baseline commit: `ac568be39d455951488dbeb4a49ae23018fa111b`
- Exact preparation baseline tree: `655632c883643819f1bdc44b08979bd83e03f718`
- Current Attempt-9 ADO candidate baseline commit: `90b90ba0e9c87fb8ebf22145399630ea4dfc46ae`
- Current Attempt-9 ADO candidate baseline tree: `02c657dbeccf2da6866f66bd25a7c3b16182587f`
- Corrected executable-source commit: `a0359a87fd1738c8493929a1661cbbc7adb3c07c`
- Corrected executable-source tree: `102c913e264bd0ccce1d085db1c50bd407f7d4a4`
- Owner: Technical Lead
- Decision authority: Human Architect
- Current change risk: AVS-001 **R0**
- Attempt-8 artifact-closure risk: AVS-001 **R3** — authority consumed fail-closed
- Independent authorization review: **attempts 1–3 `APPROVED`; zero open P0–P3; this does not verify attempt-3 execution**
- Attempt-3 failure-evidence review: **`CHANGES REQUIRED` P2 correction applied; re-review pending**
- Attempt-4 candidate review: **`APPROVED`; zero open P0–P3**
- Attempt-4 execution/evidence review: **`CHANGES REQUIRED` P2 evidence-claim correction applied; re-review pending**
- Attempt-5 candidate review: **`APPROVED`; zero open P0–P3**
- Attempt-5 execution/evidence review: **pending**
- Attempt-6 candidate review: **`APPROVED`; zero open P0–P3**
- Attempt-6 execution: **started, interrupted and consumed after `SOURCE_BINDING`; no terminal records or artifact**
- Attempt-7 authorization: **UNVERIFIED — no exact Attempt-7 candidate, digest or independent review was bound before execution**
- Attempt-7 execution: **aggregated build/test/Typecheck claims Development-reported/unverified; immutable receipt, `METAFILE_RUNTIME` exit 2, cleanup/absence and no artifact are verified**
- Attempt-8 candidate review: **`APPROVED`; zero open P0–P3**
- Attempt-8 failure/evidence review: **`CHANGES REQUIRED`; exactly one P2 corrected in this candidate; re-review pending**
- Attempt-8 execution: **consumed fail-closed at `EXTERNAL_LOG_CHECK`; npm exits/counts recorded, per-command external-log isolation insufficient/unverified; no build, test, Typecheck or artifact**
- Attempt-9 final-review Round-3 correction: **`CHANGES REQUIRED`; exactly two P2 findings corrected in this candidate; re-review pending**
- Attempt-9 candidate: **`REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE` on the exact current baseline above**

## 1. Purpose and current authority

This document records the pre-run governance gap and the now-consumed Attempt-8 closure authority:
the command used to start the DA5 Product Human-V5 Harness is not currently bound to the corrected
reviewed source. Independent candidate review Round 3 approved the exact Attempt-8 scope; its one
execution failed closed at `EXTERNAL_LOG_CHECK`. The result authorizes no retry, resume, Attempt 9,
source change, package installation, ADB command, device or Tag interaction, Product Human V5,
production, deployment or distribution. Sections 3–7 retain the approved Attempt-8 contract as
historical evidence, not reusable execution authority.

Product behavior, NFC semantics, authentication, tenant isolation, database behavior, schema,
dependencies, lockfiles, APKs and Human-gate acceptance criteria remain unchanged.

### R3 attempt 1 failure state

The fresh task-owned detached worktree matched exact source
`a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`; all five input hashes in Section 3 matched and
`dist/` was absent. The authorized Node `24.17.0` path and SHA-256 matched before entry.

Command `npm ci --no-audit --no-fund` exited 0 after installing the locked 695-package dependency
tree into the isolated task-owned worktree's `node_modules`. Its engine warnings showed that the
worktree toolchain had selected Node `26.3.1` and npm `11.16.0`.
Because this differs from the exact authorized Node `24.17.0` / npm `11.13.0` binding, the
closure stopped fail-closed at the dependency stage. `package-lock.json` remained byte-identical,
`dist/` remained absent, and no build, typecheck, test, bundle, source map, manifest, Product/APK
installation, system installation, ADB, hardware or Product action occurred. Cleanup completely
removed the task-owned worktree together with `node_modules` and every dependency output; no
worktree registration remained. No retry was performed and attempt 2 remains unauthorized by
the attempt-1 failure record; the separate attempt-2 authority below is later and independently
review-gated.

### Exact attempt-2 authority and result — executed fail-closed

The Human Architect authorized continuous technical work only up to the boundary immediately
before any Hardware/Human test. Independent review approved this exact R0 attempt-2 authorization
with zero open P0–P3. Attempt 1 remains immutable fail-closed history and no attempt-1 checkout,
cache, `node_modules`, `dist/` or output was reused.

Attempt 2 is bound exactly to:

| Binding | Exact value |
|---|---|
| Source commit/tree | `a0359a87fd1738c8493929a1661cbbc7adb3c07c` / `102c913e264bd0ccce1d085db1c50bd407f7d4a4` |
| Fresh task-owned checkout | `/tmp/taptime-da5-harness-a035-attempt2-20260731` |
| Fresh task-owned npm cache | `/tmp/taptime-da5-harness-a035-attempt2-cache-20260731` |
| Fresh task-owned metafile | `/tmp/taptime-da5-harness-a035-attempt2-20260731/da5-v5-esbuild-metafile.json` |
| Fresh task-owned artifact output | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt2-a0359a87` |
| Node executable | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`; `v24.17.0`; SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601` |
| npm CLI | `/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js`; `11.13.0`; SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| Required explicit PATH | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin` |

Every dependency, npm-script, build and test invocation SHALL use the literal form

```text
env PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node \
  /Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js <arguments>
```

A bare `npm`, another Node/npm path, inherited worktree toolchain selection, attempt-1 path or
repository-local `dist/` is prohibited.

Before `npm ci`, before the build, after the build and before artifact preservation, attempt 2
must reverify all of the following and stop immediately on mismatch:

- `process.execPath` is the exact Node path above; Node version and executable SHA-256 match;
- the absolute npm CLI path, version and SHA-256 match;
- npm lifecycle environment reports the exact `npm_node_execpath`, `npm_execpath` and explicit
  Node-24-first `PATH`; the build record captures the same Node binding for npm lifecycle/build
  processes;
- checkout source/tree and all five Section-3 input hashes match;
- the checkout, cache, metafile and artifact-output paths were fresh before first use; and
- no attempt-1 or repository-local ignored output is present or consumed.

The exact dependency command is the literal prefix above plus:

```text
ci --cache /tmp/taptime-da5-harness-a035-attempt2-cache-20260731 --no-audit --no-fund
```

The exact build command is the literal prefix above plus:

```text
run build --workspace @taptime/synthetic-android-e2e -- \
  --metafile=/tmp/taptime-da5-harness-a035-attempt2-20260731/da5-v5-esbuild-metafile.json
```

V0–V2 remain exactly as approved in Section 5. V1 uses only the focused Mobile
`da5V5AndroidDevice` and Synthetic `Da5V5AdbController` Google/Samsung/fail-closed regressions,
both affected tests-inclusive typechecks and `node --check` on the exact bundle. V2 runs the
complete Synthetic test/typecheck/build boundary once and the affected Mobile runtime
test/typecheck boundary once; unchanged V1 evidence may be carried into V2 without repetition.
Every npm-script invocation uses the literal absolute prefix above.

On any source, path, cache, Node, npm, lifecycle, dependency, build, metafile, test, typecheck,
bundle or manifest mismatch, attempt 2 stops fail-closed without retry or attempt 3. Cleanup may
remove only the exact attempt-2 checkout, cache and failed output after identity checks; it must
prove removal of their `node_modules`, dependency/build output and worktree registration. On
success, preserve only the exact read-only bundle, source map and manifest in the bound artifact
output, then remove checkout/cache/metafile residue. Hardware, Human, Product APK installation,
ADB, device/Tag interaction and Product Human V5 remain `UNBOUND — DO NOT START`.

Attempt 2 matched the fresh checkout/cache/output preflight, exact source/tree and all five input
hashes. Node `24.17.0`, npm `11.13.0`, both tool hashes, `process.execPath`, lifecycle
`npm_node_execpath`/`npm_execpath` and the Node-24-first PATH matched with no Node-26 path.
TypeScript `6.0.3` and esbuild `0.28.1` resolved exactly. The bound `npm ci` exited 0.

The dependency-closure command `npm ls --all --json` then returned `ELSPROBLEMS`: extraneous
`@expo/expo-modules-macros-plugin@0.3.0`, extraneous `expo-modules-jsi@57.0.0` and invalid
`expo-modules-core`. It also wrote one npm debug log outside the bound cache path. Attempt 2
therefore stopped fail-closed before V1/V2, build, typecheck, test, `dist/`, bundle, source map,
metafile or artifact-output creation. Cleanup moved the exact debug log and bound cache into the
task-owned worktree, removed that worktree together with `node_modules` and every dependency
output, and proved checkout, cache, artifact output, debug log and worktree registration absent.
No Product/APK/system installation, ADB, hardware or Product action occurred. No retry or attempt 3
is authorized by this record.

### Exact attempt-3 authority and Development-reported failure — independent evidence gap open

Continuous Human authority permitted this focused R0 preparation and, after independent
`APPROVED` review with zero open P0–P3, the exact technical R3 closure up to but not including any
Hardware/Human gate. Attempts 1 and 2 remain immutable fail-closed history. The ADO preparation
itself performed no install, build, typecheck, test, ADB, Hardware, Product or Human-V5 action.

Exact carried repository truth explains, but does not broadly waive, the attempt-2 diagnostic:

- exact-source CI `30638926835`, attempt 1, used Linux, Node `24.17.0`, npm `11.13.0`, `npm ci`
  and passed 12/12; it reported 696 packages;
- local macOS attempt 2 used the same Node/npm versions and locked install but reported 695
  packages; package count alone is therefore not the acceptance predicate; and
- root `package-lock.json` binds the following exact package records and the
  `expo-modules-core` dependency edges shown below.

| Package | Version | `resolved` | `integrity` |
|---|---:|---|---|
| `@expo/expo-modules-macros-plugin` | `0.3.0` | `https://registry.npmjs.org/@expo/expo-modules-macros-plugin/-/expo-modules-macros-plugin-0.3.0.tgz` | `sha512-2tRq8kiIZTVZcI5uggh86HefQ7s++Zk5WkFFomNp4aUqyN5ownHHvj1jPEP9jWXaXjPDmWuf5SUZTGD5G6AKkg==` |
| `expo-modules-jsi` | `57.0.0` | `https://registry.npmjs.org/expo-modules-jsi/-/expo-modules-jsi-57.0.0.tgz` | `sha512-lNcA2XLKpbG/Qr3CZ6yCgzlK8oT+zwuD19QKYoRfN5ZurkVhnSA3QdTR5K32n9AxohcENYtZRtnHr2pZoG7W4w==` |
| `expo-modules-core` | `57.0.2` | `https://registry.npmjs.org/expo-modules-core/-/expo-modules-core-57.0.2.tgz` | `sha512-gs1Ng2Ci1C/CwN1xRZp2RR74C9iWByf9AHaovYEtOlkly9AolitQGAt9+iLT0CoCb6xw128NcDQ00OJl/Bmv9Q==` |

The bound `expo-modules-core` lock and installed-manifest edges are
`@expo/expo-modules-macros-plugin: 0.3.0` and `expo-modules-jsi: ~57.0.0`.

Attempt 3 is bound exactly to fresh, nonexistent-before-use locations:

| Binding | Exact value |
|---|---|
| Source commit/tree | `a0359a87fd1738c8493929a1661cbbc7adb3c07c` / `102c913e264bd0ccce1d085db1c50bd407f7d4a4` |
| Checkout | `/tmp/taptime-da5-harness-a035-attempt3-20260731` |
| npm cache | `/tmp/taptime-da5-harness-a035-attempt3-cache-20260731` |
| npm logs | `/tmp/taptime-da5-harness-a035-attempt3-logs-20260731` |
| Metafile | `/tmp/taptime-da5-harness-a035-attempt3-20260731/da5-v5-esbuild-metafile.json` |
| Artifact output | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt3-a0359a87` |
| Node executable | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`; `v24.17.0`; SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601` |
| npm CLI | `/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js`; `11.13.0`; SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| Explicit PATH | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin` |

Every npm invocation SHALL use this literal prefix; bare npm, another Node/npm, inherited cache,
inherited logs directory, attempt-1/2 state and repository-local ignored output are prohibited:

```text
env PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node \
  /Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js \
  --cache /tmp/taptime-da5-harness-a035-attempt3-cache-20260731 \
  --logs-dir /tmp/taptime-da5-harness-a035-attempt3-logs-20260731 <arguments>
```

The dependency command is the prefix plus `ci --no-audit --no-fund`. Before it runs, record the
entry-name set of `/Users/timbartz/.npm/_logs` and of any other pre-existing npm log directory
reported by read-only user/system npm-config inspection, without reading log contents. The same
prefix must report the bound task-owned cache and logs directory. After every npm step, those
external sets must be unchanged: no newly generated npm log may exist outside the bound
attempt-3 logs directory. No user or system npm configuration may be changed.

After fresh bound `npm ci`, attempt 3 may accept the global
`npm ls --all --json` nonzero exit only as the following single known diagnostic exception. A
machine parser, not text matching or Human discretion, must prove all predicates; any missing or
additional fact stops and cleans up before build/test/artifact acceptance:

1. The semantic problem set contains exactly three tuples and nothing else: `extraneous` /
   `@expo/expo-modules-macros-plugin` / `0.3.0`, `extraneous` / `expo-modules-jsi` / `57.0.0`,
   and `invalid` / `expo-modules-core` / `57.0.2`.
2. Root `package-lock.json` still has SHA-256
   `62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470`; both it and hidden
   `node_modules/.package-lock.json` contain the three exact version/`resolved`/`integrity`
   records above, and the root lock contains both exact `expo-modules-core` dependency edges.
3. Each installed package `package.json` reports the exact version above; each directory is a
   real directory whose canonical realpath is exactly its expected path under the fresh
   checkout's `node_modules`, not a symlink or external path; installed `expo-modules-core`
   contains both exact dependency edges.
4. The prefix plus `ls --all --json --workspace=@taptime/synthetic-android-e2e` exits 0, has no
   problem records and proves a clean affected-workspace dependency closure.
5. Exact source/tree, all five Section-3 hashes, Node/npm path/version/hash,
   `process.execPath`, lifecycle `npm_node_execpath`/`npm_execpath`/Node-24-first PATH, TypeScript
   `6.0.3`, esbuild `0.28.1`, fresh paths and absence of attempt-1/2 or repository-local output
   still match.

Only after predicates 1–5 pass may the later R3 run execute the previously approved V1 and V2
commands and the exact Synthetic build, using the literal prefix above. The build command is:

```text
run build --workspace @taptime/synthetic-android-e2e -- \
  --metafile=/tmp/taptime-da5-harness-a035-attempt3-20260731/da5-v5-esbuild-metafile.json
```

Artifact acceptance adds a sixth mandatory predicate: machine-parse the complete esbuild
metafile graph rooted at `src/da5V5Main.ts`, including every normalized input and every output
import/external runtime edge. None may resolve to or reference any of the three Expo package
roots above. The exact bundle must have no external runtime dependency on them. V1 and V2 must
remain green, including both affected tests-inclusive typechecks and `node --check` on the exact
bundle. Static marker searching alone is insufficient. Any dependency-graph, metafile, runtime,
V1 or V2 mismatch stops fail-closed and produces no authorized artifact.

On success only, preserve the exact read-only bundle, source map and manifest in the bound output
and proceed to independent source/artifact Exact-SHA review. Cleanup is restricted to the exact
attempt-3 checkout, cache, logs, metafile residue and failed output after identity checks. Failure
must prove all five paths absent plus no worktree registration; success must prove checkout,
cache, logs, metafile residue and registration absent while preserving only the exact bound output.
No dependency, lockfile, source, Product, APK, workflow or configuration change is permitted.

The attempt-3 authorization received independent `APPROVED` review with zero open P0–P3. The
subsequent execution narrative is only **Development-reported/unverified** because no
disclosure-safe raw output or command-receipt artifact was preserved and the task-owned logs were
cleaned. Specifically, the claimed fresh-path, source/tree/five-hash, Node/npm/tool-hash/PATH and
cache/log bindings; `npm ci` and global `npm ls` exits; predicate/gate order; claimed omitted
predicates, V1/V2/build/typecheck/test/artifact steps; and external-log-set equality are not
independent Evidence. Development reported an immediate fail-closed stop at predicate 1 and
complete cleanup, but that execution sequence may not be promoted to independently verified
closure evidence.

Independent review verified only the current state: the four bound attempt-3 checkout, npm-cache,
npm-log and artifact-output paths are absent; no attempt-3 worktree registration exists; current
`package-lock.json` has SHA-256
`62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470`; and the current
working-tree delta is limited to these six ADO files with no executable delta. The attempt-3
failure-evidence gap therefore remains open and fail-closed. No retry or attempt 4 is authorized.
Hardware, Human, Product installation, ADB, device/Tag interaction and Product Human V5 remain
**UNBOUND — DO NOT START**.

Any future attempt must create and preserve one disclosure-safe command receipt outside the
cleanup set before cleanup begins, append the path/worktree cleanup proof after cleanup, and then
finalize it immutable/read-only. It must bind pre/post source/tree/input/tool/cache/log/output
facts, every command exit, gate/predicate sequence, omitted steps, external-log-set comparison and
cleanup proof without secrets. It must use separate `MOBILE_TYPECHECK` and
`SYNTHETIC_TYPECHECK` command IDs and record for each either the actual exit/decision or an
explicit omission decision and reason. A future execution claim without that preserved receipt is
unverified and fails closed.

### Exact attempt-4 authorization and fail-closed execution result

Continuous Human authority permitted preparation and independent review of this R0 candidate.
Independent review returned `APPROVED` with zero open P0–P3 and activated the exact later R3
execution only through the technical boundary before Hardware/Human/Product V5.

Attempt 4 is bound to exact source/tree, Section-3 input hashes, Node/npm identities and PATH from
attempt 3, but to these new fresh paths:

| Binding | Exact value |
|---|---|
| Source commit/tree | `a0359a87fd1738c8493929a1661cbbc7adb3c07c` / `102c913e264bd0ccce1d085db1c50bd407f7d4a4` |
| Node executable | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`; `v24.17.0`; SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601` |
| npm CLI | `/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js`; `11.13.0`; SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| Explicit PATH | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin` |
| Checkout | `/tmp/taptime-da5-harness-a035-attempt4-20260731` |
| npm cache | `/tmp/taptime-da5-harness-a035-attempt4-cache-20260731` |
| npm logs | `/tmp/taptime-da5-harness-a035-attempt4-logs-20260731` |
| Metafile | `/tmp/taptime-da5-harness-a035-attempt4-20260731/da5-v5-esbuild-metafile.json` |
| Artifact output | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt4-a0359a87` |
| Preserved evidence directory | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87` |
| Live command receipt | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87/attempt4-command-receipt.jsonl` |
| Pre-cleanup snapshot | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87/attempt4-precleanup-receipt.jsonl` |
| Evidence manifest | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87/attempt4-evidence-manifest.json` |

Checkout, cache, logs, metafile, output and the entire evidence directory must all be absent and
unregistered before first use. The evidence directory and live receipt are then the first
state-changing action; no checkout/cache/log/output creation may precede them. The receipt is
append-only during the run and contains only disclosure-safe records with UTC timestamp, fixed
command identifier, exit code, gate decision or omission, and hashes/counts needed below. It must
never contain raw command output, argv containing values, environment values, UID, device/Tag
data, credentials, tokens, secrets, private paths beyond the exact authorized bindings or other
private environment content.

The evidence directory is outside the repository, cleanup set and every protected area. Its
initial `EVIDENCE_INIT` record captures the before-state bound-path existence set, worktree
registration set and count/SHA-256 of external npm-log entry names before any other state change;
entry names and log contents are not stored.

Allowed command identifiers are `EVIDENCE_INIT`, `WORKTREE_ADD`, `SOURCE_BINDING`, `NPM_CI`,
`GLOBAL_NPM_LS`, `DEPENDENCY_BINDINGS`, `WORKSPACE_NPM_LS`, `EXTERNAL_LOG_CHECK`, `V0`, `V1`,
`V2`, `BUILD`, `NODE_CHECK`, `METAFILE_RUNTIME`, `ARTIFACT_PRESERVE`, `PRECLEANUP_SNAPSHOT`,
`CLEANUP`, `POSTCLEANUP` and `FINALIZE`. Each invoked gate records its identifier, timestamp and
exit; every later gate not reached records a fixed omission reason. Exact source/tree, five input
hashes, Node/npm versions/paths/hashes, TypeScript/esbuild versions, path-set state and hashed
external-log entry-name set are receipt fields, never inferred afterward.

Every npm invocation uses this literal prefix:

```text
env PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node \
  /Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js \
  --cache /tmp/taptime-da5-harness-a035-attempt4-cache-20260731 \
  --logs-dir /tmp/taptime-da5-harness-a035-attempt4-logs-20260731 <arguments>
```

Bare npm, inherited cache/logs, attempt-1/2/3 state and repository-local ignored output remain
prohibited. The dependency command is the prefix plus `ci --no-audit --no-fund`.

Attempt 4 has no Expo allowlist, nonzero-exit exception or diagnostic waiver. Immediately after
fresh bound `npm ci`, global `npm ls --all --json` must exit 0. A machine parser must recursively
prove no nonempty `problems` and no `extraneous`, `invalid`, `missing` or `error` record/flag
anywhere in the JSON. Nonzero exit, parse failure, any such record or any additional dependency
problem stops fail-closed before build/V1/V2.

Only after that clean global closure may attempt 4 prove, in order:

1. unchanged root lock SHA-256 and exact root/hidden-lock version/`resolved`/`integrity` records;
2. installed package versions, nonsymlink canonical realpaths and exact
   `expo-modules-core` dependency edges;
3. exit-0/problem-free affected Synthetic workspace closure;
4. task-owned npm cache/log confinement and unchanged hashed external-log entry-name set;
5. exact source/tree/five inputs, Node/npm/lifecycle/TypeScript/esbuild bindings and V0–V2 exactly
   as already specified; and
6. machine-parsed metafile/runtime closure excluding all three Expo packages while proving the
   required DA5 source inputs, green `node --check`, focused Google/Samsung/fail-closed tests,
   affected tests-inclusive typechecks and complete Synthetic test/typecheck/build boundary.

Every gate records its decision and exit in the live receipt before the next gate. Any mismatch
stops without retry. Before cleanup, copy the live receipt to the exact pre-cleanup snapshot, set
that snapshot to mode `0444`, and append its exact path/size/SHA-256/mode binding to the live
receipt. Cleanup may remove only attempt-4 checkout, cache, `node_modules`, logs, metafile and
failed artifact output; it must never remove or mutate the evidence directory or pre-cleanup
snapshot.

After cleanup, append current-state proofs for checkout/cache/log/output absence, worktree
registration absence, package-lock hash and protected executable-delta status. Then set the final
live receipt to mode `0444`, compute its path/size/SHA-256/mode, write the evidence manifest with
the receipt and snapshot bindings plus success/failure artifact inventory, and set the manifest to
`0444`. Record the manifest path/size/SHA-256/mode in the later ADO truth synchronization. On
failure, preserve receipt, snapshot and manifest while output remains absent. On success, preserve
those three evidence files together with only the read-only bundle, source map and artifact
manifest. No source, dependency, lockfile, Product, workflow or protected-area change is allowed.
No ADB, APK/App/system installation, Hardware, Human or Product V5 action is authorized.

#### Attempt-4 execution result — fail-closed at V1

The exact preflight proved all attempt-4 paths absent, no registered attempt-4 worktree, exact
source/tree, all five input hashes, exact Node/npm versions and binary hashes, and the unchanged
external npm-log entry-name set. The evidence directory and live receipt were the first state
change. Fresh worktree creation and bound `npm ci` exited 0. Global `npm ls --all --json` exited 0
and its recursive parser found zero problems, extraneous, invalid, missing or error records. Exact
root/hidden-lock records, installed manifests/realpaths, `expo-modules-core` edges, affected
Synthetic workspace closure, lifecycle binding, TypeScript `6.0.3`, esbuild `0.28.1`, source/tree/
five hashes, external-log confinement and V0 all passed.

The focused Mobile runtime test passed one file and 38/38 tests. The focused Synthetic
`Da5V5AdbController` suite then failed before any test executed because the package entry for
`@taptime/backend-schema` could not resolve from the fresh installed workspace. V1 therefore
failed closed. The immutable receipt explicitly records omission decisions only for `V2`,
`BUILD`, `NODE_CHECK`, `METAFILE_RUNTIME` and `ARTIFACT_PRESERVE`. Receipt and manifest
contain no separate Mobile/Synthetic typecheck command IDs or omission decisions. Development
reported both tests-inclusive typechecks omitted, but that claim is unverified and constitutes a
separate fail-closed evidence gap. No `dist/`, metafile or artifact-output path was produced. This record does not authorize a
prerequisite workspace build, source/package change or retry; deciding such a correction requires
a new exact architecture/authorization candidate.

Before cleanup, the live receipt was copied to the exact read-only snapshot and bound back into
the receipt. Cleanup removed the exact checkout, cache, task logs, `node_modules` and worktree
registration. The artifact output remains absent, root `package-lock.json` remains exact, the
external npm-log set is unchanged and the protected executable delta is empty. Only these three
mode-`0444` evidence files remain:

| Evidence file | Size | SHA-256 |
|---|---:|---|
| `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87/attempt4-command-receipt.jsonl` | 10,003 bytes | `ae6e9181a83187a8affa358649437f37104f359581b137fca07be036b41d8cf6` |
| `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87/attempt4-precleanup-receipt.jsonl` | 7,747 bytes | `bc3d60818b6e20cfe4eecbe26917857ce9c7d9a5bf4f39c0323d351197f12077` |
| `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87/attempt4-evidence-manifest.json` | 1,589 bytes | `61e30ff4e81f301873607b8f5978f0b1e675d73bb3f2b757f0d1937dbe3562c9` |

Independent execution/evidence review returned `CHANGES REQUIRED` with this P2 evidence-claim
gap; the ADO correction is applied and re-review is pending. Any future receipt must include
separate `MOBILE_TYPECHECK` and `SYNTHETIC_TYPECHECK` command IDs and record for each either the
actual exit/decision or an explicit omission decision and reason. No Attempt-4 retry, artifact
acceptance or later gate is authorized by that record.

### Exact attempt-5 authorization and fail-closed execution

Continuous Human authority permitted this focused R0 preparation and independent review.
Independent review returned `APPROVED` with zero open P0–P3 and activated the exact R3 execution
below; that standing authority ended immediately before Hardware/Human/Product V5. Attempt 4 remains independently authorized but
fail-closed/`NOT_VERIFIED`, including its separate Typecheck-evidence gap; none of its checkout,
cache, logs, generated outputs or failed execution state may be reused.

#### Root-cause candidate and unchanged product boundary

Attempt 4's fresh `npm ci` left workspace package entries that may require their normal generated
build outputs before Synthetic Vitest resolution. This is an architecture candidate, not a proven
root cause. Exact-source GitHub Actions run `30638926835`, attempt 1, job
`Synthetic server-connected Android E2E harness` built the exact 16 workspaces below in order
after `npm ci` and before Synthetic typecheck/test/build. Attempt 5 reproduces only that tracked CI
prerequisite order locally; it does not change a package, dependency, lockfile, source, build
script, Product rule or CI workflow.

#### Exact bindings and first-state evidence

Attempt 5 retains the exact source/tree, Section-3 input hashes, Node/npm identities and explicit
PATH from attempt 4 and binds only these fresh, nonexistent-before-use paths:

| Binding | Exact value |
|---|---|
| Source commit/tree | `a0359a87fd1738c8493929a1661cbbc7adb3c07c` / `102c913e264bd0ccce1d085db1c50bd407f7d4a4` |
| Node executable | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`; `v24.17.0`; SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601` |
| npm CLI | `/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js`; `11.13.0`; SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| Explicit PATH | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin` |
| Checkout | `/tmp/taptime-da5-harness-a035-attempt5-20260731` |
| npm cache | `/tmp/taptime-da5-harness-a035-attempt5-cache-20260731` |
| npm logs | `/tmp/taptime-da5-harness-a035-attempt5-logs-20260731` |
| Metafile | `/tmp/taptime-da5-harness-a035-attempt5-20260731/da5-v5-esbuild-metafile.json` |
| Artifact output | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt5-a0359a87` |
| Preserved evidence directory | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87` |
| Live command receipt | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87/attempt5-command-receipt.jsonl` |
| Pre-cleanup snapshot | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87/attempt5-precleanup-receipt.jsonl` |
| Evidence manifest | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87/attempt5-evidence-manifest.json` |

The receipt architecture and disclosure prohibitions remain exactly as in attempt 4. Read-only
preflight first proves every bound path absent, no attempt-5 worktree registration, exact
source/tree/five hashes/tool bindings and the hashed external npm-log entry-name set. The evidence
directory and live receipt are the first state change. Every reached identifier records timestamp,
execution state, exit and decision; every unreached identifier records an explicit omission
decision and reason. Before cleanup the receipt is copied to the exact mode-`0444` snapshot and
bound back into the live receipt. After cleanup, receipt and evidence manifest are finalized
mode `0444` with exact paths, sizes and SHA-256 values.

The fixed Attempt-5 identifier set is `EVIDENCE_INIT`, `WORKTREE_ADD`, `SOURCE_BINDING`,
`NPM_CI`, `GLOBAL_NPM_LS`, `DEPENDENCY_BINDINGS`, `WORKSPACE_NPM_LS`, repeated checkpoint
`EXTERNAL_LOG_CHECK`, `V0`, all 16 `PREREQ_BUILD_*` IDs in the ordered table,
`GENERATED_OUTPUT_CLOSURE`, `MOBILE_FOCUS_TEST`, `SYNTHETIC_FOCUS_TEST`,
`MOBILE_TYPECHECK`, `SYNTHETIC_TYPECHECK`, aggregate `V1`, all five `V2_*` component IDs,
aggregate `V2`, `NODE_CHECK`, `METAFILE_RUNTIME`, `ARTIFACT_PRESERVE`,
`PRECLEANUP_SNAPSHOT`, `CLEANUP`, `POSTCLEANUP` and `FINALIZE`. No aggregate record may hide a
missing component record.

Every attempt-5 npm invocation uses only this literal prefix:

```text
env PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node \
  /Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js \
  --cache /tmp/taptime-da5-harness-a035-attempt5-cache-20260731 \
  --logs-dir /tmp/taptime-da5-harness-a035-attempt5-logs-20260731 <arguments>
```

Bare npm, inherited cache/logs, attempt-1/2/3/4 state and repository-local ignored output are
prohibited. The strict attempt-4 sequence remains unchanged: bound `ci --no-audit --no-fund`;
global `npm ls --all --json` exit 0 with recursively zero problems/extraneous/invalid/missing/
error; exact root/hidden-lock/install/realpath/`expo-modules-core` edges; clean affected Synthetic
workspace closure; external-log-set equality after every npm step; exact source/tree/five hashes,
Node/npm/lifecycle/TypeScript `6.0.3`/esbuild `0.28.1`; then V0. Any mismatch stops before the
prerequisite builds and explicitly omits every later identifier.

#### Exact prerequisite build order

Only after all strict gates pass may these commands run, one at a time and in this exact order.
Each is the literal prefix above plus `run build --workspace=<workspace>`, has its own receipt ID
and exit, and stops on first nonzero result:

| Order | Receipt ID | Workspace |
|---:|---|---|
| 1 | `PREREQ_BUILD_ADMINISTRATION_CONTRACT` | `@taptime/administration-contract` |
| 2 | `PREREQ_BUILD_MOBILE_WORK_CONTRACT` | `@taptime/mobile-work-contract` |
| 3 | `PREREQ_BUILD_OFFLINE_SYNC_CONTRACT` | `@taptime/offline-sync-contract` |
| 4 | `PREREQ_BUILD_TIME_ENTRY_EXPORT_CONTRACT` | `@taptime/time-entry-export-contract` |
| 5 | `PREREQ_BUILD_TIME_REVIEW_CONTRACT` | `@taptime/time-review-contract` |
| 6 | `PREREQ_BUILD_CORE` | `@taptime/core` |
| 7 | `PREREQ_BUILD_BACKEND_SCHEMA` | `@taptime/backend-schema` |
| 8 | `PREREQ_BUILD_BACKEND_IDENTITY` | `@taptime/backend-identity` |
| 9 | `PREREQ_BUILD_BACKEND_MOBILE_WORK` | `@taptime/backend-mobile-work` |
| 10 | `PREREQ_BUILD_BACKEND_READ_MODEL` | `@taptime/backend-read-model` |
| 11 | `PREREQ_BUILD_BACKEND_LIFECYCLE` | `@taptime/backend-lifecycle` |
| 12 | `PREREQ_BUILD_BACKEND_ADMINISTRATION` | `@taptime/backend-administration` |
| 13 | `PREREQ_BUILD_BACKEND_TIME_EXPORT` | `@taptime/backend-time-export` |
| 14 | `PREREQ_BUILD_BACKEND_OFFLINE_SYNC` | `@taptime/backend-offline-sync` |
| 15 | `PREREQ_BUILD_BACKEND_TIME_REVIEW` | `@taptime/backend-time-review` |
| 16 | `PREREQ_BUILD_BACKEND_API` | `@taptime/backend-api` |

`GENERATED_OUTPUT_CLOSURE` must machine-bind the before/after entry delta for every prerequisite
step. Every created entry must be a nonsymlink file/directory canonically inside the exact task
checkout, ignored or untracked, attributable to the immediately preceding build and inventoried
with path/type/size/SHA where applicable. Tracked status and tracked diff must remain empty;
source/tree, Section-3 hashes and root `package-lock.json` must remain exact after every build and
before V1. Any tracked/source/lock mutation, external path, symlink or unexplained generated entry
fails closed. All generated outputs remain temporary task-checkout state and are removed with the
checkout after failure or successful artifact preservation.

#### Exact V1/V2 and artifact gates

After `GENERATED_OUTPUT_CLOSURE` passes, attempt 5 runs the prior approved V1/V2 boundary without
unnecessary repetition. The receipt uses these explicit component IDs; each executed command gets
its exit/decision, each aggregate/carried gate names its source record and unchanged-input proof,
and every unreached component gets an omission decision and reason:

| Receipt ID | Exact action |
|---|---|
| `MOBILE_FOCUS_TEST` | Prefix plus `exec --workspace=@taptime/mobile -- vitest run tests/runtime/da5V5AndroidDevice.test.ts` |
| `SYNTHETIC_FOCUS_TEST` | Prefix plus `exec --workspace=@taptime/synthetic-android-e2e -- vitest run tests/Da5V5AdbController.test.ts` |
| `MOBILE_TYPECHECK` | Prefix plus `run typecheck --workspace=@taptime/mobile`; record exit and objective inclusion of `tests/runtime/da5V5AndroidDevice.test.ts` |
| `SYNTHETIC_TYPECHECK` | Prefix plus `run typecheck --workspace=@taptime/synthetic-android-e2e`; record exit and objective inclusion of `tests/Da5V5AdbController.test.ts` |
| `V2_SYNTHETIC_TEST` | Prefix plus `run test --workspace=@taptime/synthetic-android-e2e` |
| `V2_SYNTHETIC_TYPECHECK` | Gate record carried from green `SYNTHETIC_TYPECHECK`; no second invocation; bind its exit and unchanged inputs |
| `V2_SYNTHETIC_BUILD` | Prefix plus `run build --workspace @taptime/synthetic-android-e2e -- --metafile=/tmp/taptime-da5-harness-a035-attempt5-20260731/da5-v5-esbuild-metafile.json` |
| `V2_MOBILE_RUNTIME_TEST` | Gate record carried from green `MOBILE_FOCUS_TEST`; no second invocation; bind its exit and unchanged inputs |
| `V2_MOBILE_TYPECHECK` | Gate record carried from green `MOBILE_TYPECHECK`; no second invocation; bind its exit and unchanged inputs |
| `NODE_CHECK` | Exact Node executable plus `--check apps/synthetic-android-e2e/dist/da5V5Main.js` |
| `METAFILE_RUNTIME` | Machine-parse the exact metafile and bundle closure |
| `ARTIFACT_PRESERVE` | On success only, preserve exact read-only bundle/map/artifact manifest |

Aggregate `V1` and `V2` records may summarize only their explicit component records and may not
replace them. A carried V2 gate is not a second command and records `execution_state=carried`,
`carried_from`, the original exit and unchanged-input decision. An omitted component records
`execution_state=omitted`, null exit and exact reason. Typecheck inclusion evidence is mandatory;
an exit-0 source-only typecheck does not pass either tests-inclusive gate.

Under each Typecheck ID, immediately after the workspace typecheck command, the same absolute
prefix runs `exec --workspace=@taptime/mobile -- tsc -p tsconfig.json --noEmit --listFilesOnly`
or respectively `exec --workspace=@taptime/synthetic-android-e2e -- tsc -p tsconfig.json --noEmit --listFilesOnly`.
A machine parser must record both component exits and prove the exact relevant
test path is present; raw file lists are not preserved. External-log equality is rechecked after
each invocation.

`METAFILE_RUNTIME` retains the exact attempt-4 acceptance rule: the complete esbuild graph must
prove `src/da5V5Main.ts`, `src/Da5V5AdbController.ts` and
`apps/mobile/scripts/da5V5AndroidDevice.mjs` inputs and exclude all references/import/runtime edges
to `@expo/expo-modules-macros-plugin`, `expo-modules-jsi` and `expo-modules-core`; static bundle
scanning is supplemental only. `NODE_CHECK` and every V1/V2 component must be green.

On success only, `ARTIFACT_PRESERVE` copies the exact bundle, source map and artifact manifest to
the bound output, makes every file `0444` and the directory read-only, and binds size/SHA/mode plus
the exact later start command using the absolute Node path and preserved bundle path. Cleanup then
removes checkout/cache/logs/metafile residue/worktree registration while preserving only those
three output files and receipt/snapshot/evidence manifest. On any failure, output remains absent
and cleanup removes all task execution/generated state while preserving the immutable evidence
set. No source, dependency, lockfile, Product, workflow or protected-area change; ADB, APK/App/
system installation, Hardware, Human/Product V5, production, deployment and distribution remain
unauthorized.

#### Attempt-5 execution result — fail-closed before V0 and prerequisite builds

Independent candidate review returned `APPROVED` with zero open P0–P3 and activated the exact R3
scope above. Read-only preflight proved all fresh paths absent, no attempt-5 worktree registration,
exact source/tree/five hashes and exact Node/npm binaries. The evidence directory and receipt were
the first state change. Fresh worktree creation and bound `npm ci` passed; global and affected-
workspace `npm ls --all --json` both exited 0 and were recursively problem-free. Root/hidden lock
records, installed versions/realpaths, `expo-modules-core` edges, package-lock hash, TypeScript
`6.0.3`, esbuild `0.28.1` and source/tree/input bindings passed. The external npm-log entry-name
set remained unchanged.

The final lifecycle-binding verification invocation exited 2. Attempt 5 therefore failed closed at
`DEPENDENCY_BINDINGS` without promoting that nonzero result to a diagnosed Node/npm mismatch.
V0, all 16 prerequisite builds, `GENERATED_OUTPUT_CLOSURE`, every focused test and Typecheck,
V1/V2, `NODE_CHECK`, `METAFILE_RUNTIME` and `ARTIFACT_PRESERVE` each have an explicit immutable
omission record. No prerequisite or Synthetic build, test, Typecheck, generated build output,
metafile or artifact output occurred.

The pre-cleanup receipt snapshot was bound before cleanup. Cleanup removed the exact checkout,
`node_modules`, cache, task logs and worktree registration; the artifact output remains absent,
root package-lock remains exact, external npm logs remain unchanged and protected executable delta
is empty. The preserved evidence files are mode `0444`:

| Evidence file | Size | SHA-256 |
|---|---:|---|
| `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87/attempt5-command-receipt.jsonl` | 18,204 bytes | `4e08e3765ba2ee2813ab0a7f44463986abf0fc0a3c592c4fda40e40d34f2ee45` |
| `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87/attempt5-precleanup-receipt.jsonl` | 15,887 bytes | `efb4f2b649b94d1707a759dab870e13ef0de6316b8e4f601382ca756cd3a6114` |
| `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87/attempt5-evidence-manifest.json` | 1,921 bytes | `558111bfdc8ffc5acdabd6c56fe76324a1b87ce6a9e0c0329854237428d0fc4b` |

Attempt 5 is `NOT_VERIFIED`; independent execution/evidence review is pending. This result grants
no retry, altered lifecycle checker, artifact acceptance or later gate.

### Exact attempt-6 ADO-only R0 candidate — approved, started, interrupted and consumed

Independent candidate review returned `APPROVED` with zero open P0–P3. Attempt 6 then started,
recorded only sequence 1 `EVIDENCE_INIT` pass and sequence 2 `SOURCE_BINDING` pass, was interrupted
and is consumed. No later gate or terminal record exists and none may be reconstructed. All bound
Attempt-6 checkout/cache/log/output paths and worktree registration are absent. The only evidence
is the unchanged 2,716-byte mode-`0444` receipt at
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt6-a0359a87/attempt6-command-receipt.jsonl`,
SHA-256 `6a5b23db67bbe1ff6715f377e3f0f041942d8e8b447b5e3e45cb7aa224ad5402`.
No install, dependency reconstruction, build, test, Typecheck, generated output or artifact
occurred. Hardware/Human/Product V5 remains **DO NOT START**.

Attempt 6 changes no source, dependency, lockfile, Product behavior, build script or workflow. It
corrects only the verification architecture: `DEPENDENCY_BINDINGS` remains the separately proven
lock/hidden-lock/install-version/realpath/Expo-edge/package-lock/TypeScript/esbuild/source-input
gate, while the npm lifecycle child proof moves to a distinct `LIFECYCLE_BINDING` gate. A lifecycle
failure therefore cannot obscure a passed dependency gate.

#### Fresh attempt-6 bindings

| Binding | Exact value |
|---|---|
| Source commit/tree | `a0359a87fd1738c8493929a1661cbbc7adb3c07c` / `102c913e264bd0ccce1d085db1c50bd407f7d4a4` |
| Checkout | `/tmp/taptime-da5-harness-a035-attempt6-20260731` |
| npm cache | `/tmp/taptime-da5-harness-a035-attempt6-cache-20260731` |
| npm logs | `/tmp/taptime-da5-harness-a035-attempt6-logs-20260731` |
| Metafile | `/tmp/taptime-da5-harness-a035-attempt6-20260731/da5-v5-esbuild-metafile.json` |
| Artifact output | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt6-a0359a87` |
| Evidence directory | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt6-a0359a87` |
| Live receipt | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt6-a0359a87/attempt6-command-receipt.jsonl` |
| Pre-cleanup snapshot | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt6-a0359a87/attempt6-precleanup-receipt.jsonl` |
| Evidence manifest | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt6-a0359a87/attempt6-evidence-manifest.json` |

The evidence-first preflight, disclosure rules, immutable snapshot/finalization, strict npm-ci/
global-and-workspace closure, external-log equality, V0, exact ordered 16-workspace prerequisite
build table, `GENERATED_OUTPUT_CLOSURE`, V1/V2 component/carried-gate rules, Typecheck inclusion
proof, Node/metafile/runtime closure, success artifact preservation and success/failure cleanup are
unchanged from Attempt 5 except for the fresh paths above and the dedicated lifecycle gate below.
Every identifier receives an executed, carried or explicit omitted record. The fixed set adds
`LIFECYCLE_BINDING` immediately after green `DEPENDENCY_BINDINGS` and green
`WORKSPACE_NPM_LS`; aggregate gates may not hide either result.

#### Exact lifecycle executable and command-form binding

Before any state change, read-only preflight must bind all of these facts and repeat them after
`npm ci` immediately before `LIFECYCLE_BINDING`:

| Item | Exact binding |
|---|---|
| Node path and canonical realpath | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node` |
| Node version / SHA-256 | `v24.17.0` / `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601` |
| npm CLI path and canonical realpath | `/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js` |
| npm version / CLI SHA-256 | `11.13.0` / `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| npm CLI first line | `#!/usr/bin/env node` |
| env path / canonical realpath / SHA-256 | `/usr/bin/env` / `/usr/bin/env` / `6e506aec3c0cff703ac1e66cedc6f1945354ad41339a38db4425c7c88227128f` |
| Explicit child PATH / SHA-256 | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin` / `d39874462cf90d511bd59ab212c232f2d105ddb0a619fd669f4df969850757be` |
| Command-form ID | `DA5_V5_ATTEMPT6_LIFECYCLE_BINDING_V1` |
| Canonical command descriptor SHA-256 | `ca47c29ee56bc19a20c350c99645d0e24ed78eaa2d9dfd3566d3812dfca73b23` |
| Fixed assertion-source SHA-256 | `287b611cabecdf31fce652dda5425c1ae8941746b9ddac45a1877514ce4609d4` |

The canonical descriptor hashed above is exactly:

```text
{"id":"DA5_V5_ATTEMPT6_LIFECYCLE_BINDING_V1","prefix":"ATTEMPT6_ABSOLUTE_NPM_PREFIX","subcommand":["exec","--","/usr/bin/env","PATH=<EXACT_PATH>","<EXACT_NODE>","-e","<ASSERTION_SHA256>"]}
```

The exact invocation uses the proper npm-exec option terminator and resets only the child PATH to
the already bound explicit value:

```sh
env PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node \
  /Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js \
  --cache /tmp/taptime-da5-harness-a035-attempt6-cache-20260731 \
  --logs-dir /tmp/taptime-da5-harness-a035-attempt6-logs-20260731 \
  exec -- \
  /usr/bin/env PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node \
  -e 'const n="/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node",v="v24.17.0",m="/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js",b="/Users/timbartz/.nvm/versions/node/v24.17.0/bin";const p=(process.env.PATH||"").split(":");const c={processExecPath:process.execPath===n,processVersion:process.version===v,npmNodeExecPath:process.env.npm_node_execpath===n,npmExecPath:process.env.npm_execpath===m,pathFirst:p[0]===b,noNode26:!p.some(x=>x.includes("/.nvm/versions/node/v26"))};process.stdout.write(JSON.stringify(c));if(!Object.values(c).every(Boolean))process.exit(2);'
```

A machine parser accepts only exit 0 and exactly the six named boolean results, all `true`:
`processExecPath`, `processVersion`, `npmNodeExecPath`, `npmExecPath`, `pathFirst`, `noNode26`.
The receipt stores only those booleans, exit, decision, command-form ID, descriptor/assertion
hashes and prebound executable facts. Raw stdout, environment, argv and private values are never
preserved. External npm-log equality is checked immediately afterward. Any false/missing/extra
field, parse error, nonzero exit, realpath/shebang/hash/PATH mismatch or external-log drift fails
only `LIFECYCLE_BINDING`, leaves the already completed `DEPENDENCY_BINDINGS` result unchanged,
explicitly omits every later gate and triggers Attempt-5-equivalent evidence preservation and
cleanup.

Attempt 6 has no additional waiver or retry. Only after `DEPENDENCY_BINDINGS`,
`WORKSPACE_NPM_LS`, `LIFECYCLE_BINDING` and their log checks all pass may V0 and the unchanged
16-build/V1/V2/artifact sequence begin. No ADB, APK/App/system installation, Hardware,
Human/Product V5, production, deployment or distribution is authorized.

#### Attempt-6 execution result — interrupted after source binding

Candidate review returned `APPROVED` with zero open P0–P3. The immutable receipt proves only
`EVIDENCE_INIT` and `SOURCE_BINDING`, both exit 0/pass. No checkout was created and no later gate
ran. The attempt was interrupted and is consumed; it may not be resumed or retried. Its exact
receipt binding and absent-state proof are recorded above.

### Attempt-7 execution result — fail-closed Metafile verifier

The Human Architect said “Dann abfahrt” toward the previously reported goal, but no exact
Attempt-7 candidate, descriptor/digest or independent candidate review was bound before execution.
Attempt-7 authorization is therefore **UNVERIFIED** and no authority may be inferred
retrospectively. Development reported that a fresh sparse checkout excluding `research/**` and
root `app.json` used exact source
`a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`, exact Node `24.17.0` and npm `11.13.0`, and fresh
Attempt-7 checkout/cache/log/output/evidence paths. A mistaken read-only shell preflight ended
before any state change; exact path absence was reverified before the one stateful Attempt 7 began.

The immutable receipt uses aggregate records `DEPENDENCY_LIFECYCLE_BINDINGS`,
`PREREQUISITE_BUILDS`, `V1` and `V2`; it has no separate V0, no 16 individual prerequisite-build
IDs and no separate Mobile/Synthetic Typecheck IDs. Consequently the following results remain
**Development-reported/unverified**, even though their aggregate values are present in the
receipt: bound `npm ci` installed 695 locked packages; global and affected-workspace dependency
closure reported 1,556 and 424 traversed nodes and zero problems; all six lifecycle booleans;
TypeScript `6.0.3`, esbuild `0.28.1`, source/tree/five inputs, lockfile and external npm-log set
matched; all 16 ordered prerequisite builds reported pass; V1 reported Mobile 38/38 and Synthetic
Controller 29/29; both Typechecks reportedly exited 0 with the target tests listed; database-free
Synthetic V2 reported 13/13 files with 279 passed and 18 skipped tests; and the Synthetic build
reportedly succeeded into the temporary checkout.

The immutable receipt and independently checked current state verify that `METAFILE_RUNTIME`
exited 2, cleanup completed, all Attempt-7 execution/output/worktree paths are absent and no
artifact was published. The receipt reports 198 inputs, 14 outputs and zero
forbidden Expo references, but tested repository-relative suffixes against esbuild
working-directory-relative keys, producing false required-input and output booleans. This was a
verifier path-basis mismatch, not accepted artifact evidence. No corrected parser invocation,
TalkBack-closure decision or artifact preservation ran. The temporary bundle, source map and
metafile were removed with the checkout; no artifact output exists. Attempt 7 is consumed
fail-closed.

Cleanup removed checkout, `node_modules`, generated outputs and worktree registration. The exact
cache and task-log directories were moved out of `/tmp` to recoverable Trash paths
`/Users/timbartz/.Trash/taptime-da5-harness-attempt7-9b7c4e2f-cache` and
`/Users/timbartz/.Trash/taptime-da5-harness-attempt7-9b7c4e2f-logs`; external npm logs remained
unchanged. Preserved evidence files are mode `0444` under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt7-a0359a87-9b7c4e2f`:

| Evidence file | Size | SHA-256 |
|---|---:|---|
| `attempt7-command-receipt.jsonl` | 8,686 bytes | `5d940416b1dd4e26432e462f41144cced33950d9501ff3bd9017278bf354e6a4` |
| `attempt7-precleanup-receipt.jsonl` | 6,685 bytes | `ba56a79ea65d859ddc19475788417917eebafaeddbcbc118b6e82a0285ebfb23` |
| `attempt7-evidence-manifest.json` | 1,440 bytes | `a6c2cf280ec9dcc598c489060816b6cd6c1d0085e3ef3eb6b200b94a6cb89500` |

### Exact Attempt-8 candidate and execution — approved, consumed fail-closed

Independent review Round 3 returned `APPROVED` with zero open P0–P3 and activated only this exact
technical scope. The single execution result below consumed that authority. No retry, resume,
Attempt 9, installation, ADB, Hardware or Human/Product-V5 authority follows.

The complete fresh path binding is:

| Binding | Exact Attempt-8 path |
|---|---|
| Checkout | `/tmp/taptime-da5-harness-a035-attempt8-20260801-f3c81d6a` |
| npm cache | `/tmp/taptime-da5-harness-a035-attempt8-cache-20260801-f3c81d6a` |
| npm logs | `/tmp/taptime-da5-harness-a035-attempt8-logs-20260801-f3c81d6a` |
| esbuild Metafile | `/tmp/taptime-da5-harness-a035-attempt8-20260801-f3c81d6a/da5-v5-esbuild-metafile.json` |
| Artifact output directory | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt8-a0359a87-f3c81d6a` |
| Preserved bundle | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt8-a0359a87-f3c81d6a/da5V5Main.js` |
| Preserved source map | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt8-a0359a87-f3c81d6a/da5V5Main.js.map` |
| Artifact manifest | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt8-a0359a87-f3c81d6a/attempt8-artifact-manifest.json` |
| Evidence directory | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt8-a0359a87-f3c81d6a` |
| Live receipt | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt8-a0359a87-f3c81d6a/attempt8-command-receipt.jsonl` |
| Precleanup snapshot | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt8-a0359a87-f3c81d6a/attempt8-precleanup-receipt.jsonl` |
| Evidence manifest | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt8-a0359a87-f3c81d6a/attempt8-evidence-manifest.json` |

The receipt schema is exactly `DA5-V5-HARNESS-ATTEMPT8-RECEIPT-1`. Before execution, all five
fresh state roots (checkout, cache, logs, artifact output and evidence directory), the worktree
registration and all bound files were absent. No Attempt-6/7 literal path or execution state was
inherited.

Command-form ID `DA5_V5_ATTEMPT8_METAFILE_RUNTIME_V1` has canonical descriptor length 1,435 bytes
and SHA-256 `fd2dd34aee53ebbefcfe7e4bdc7ff4d063053abbd5d6457adca057cfc24d5431`.
The exact no-newline descriptor is:

```json
{"id":"DA5_V5_ATTEMPT8_METAFILE_RUNTIME_V1","receipt_schema":"DA5-V5-HARNESS-ATTEMPT8-RECEIPT-1","canonical_checkout":"realpath(<CHECKOUT>)","canonical_cwd":"realpath(<CHECKOUT>/apps/synthetic-android-e2e)","key_resolution":"realpath(join(canonical_cwd,key))","boundary":"resolved_path_is_canonical_checkout_or_descendant","comparison":"repository_relative_only_after_boundary","allowed_input_policy":"tracked file at exact source commit or lock-backed file under node_modules; forbidden Expo roots rejected","required_inputs":["apps/synthetic-android-e2e/src/da5V5Main.ts","apps/synthetic-android-e2e/src/Da5V5AdbController.ts","apps/mobile/scripts/da5V5AndroidDevice.mjs"],"allowed_outputs":["apps/synthetic-android-e2e/dist/index.js","apps/synthetic-android-e2e/dist/index.js.map","apps/synthetic-android-e2e/dist/main.js","apps/synthetic-android-e2e/dist/main.js.map","apps/synthetic-android-e2e/dist/gateCResponseDropMain.js","apps/synthetic-android-e2e/dist/gateCResponseDropMain.js.map","apps/synthetic-android-e2e/dist/gateCTransportRestoreMain.js","apps/synthetic-android-e2e/dist/gateCTransportRestoreMain.js.map","apps/synthetic-android-e2e/dist/da4V5Main.js","apps/synthetic-android-e2e/dist/da4V5Main.js.map","apps/synthetic-android-e2e/dist/da4V5ManifestMain.js","apps/synthetic-android-e2e/dist/da4V5ManifestMain.js.map","apps/synthetic-android-e2e/dist/da5V5Main.js","apps/synthetic-android-e2e/dist/da5V5Main.js.map"]}
```

For every esbuild Metafile input and output key it first resolves
`realpath(join(realpath(<checkout>/apps/synthetic-android-e2e), key))`; resolution failure,
symlink, escape or any resolved path outside symlink-free `realpath(<checkout>)` fails closed.
Only after that boundary passes is the path made repository-relative and compared with the
allowed-input policy, required inputs and exact 14-output build set encoded in the descriptor.
Every allowed tracked input must match the exact source commit; every `node_modules` input must be
lock-backed, and all forbidden Expo roots remain rejected. The prior runtime and exact
artifact-output rules remain unchanged.

The fixed ordered identifier set is normative and complete. The live receipt must contain one
record for every identifier, in this order:

1. `EVIDENCE_INIT`
2. `WORKTREE_ADD`
3. `SOURCE_TOOL_BINDING`
4. `NPM_CI`
5. `GLOBAL_NPM_LS`
6. `DEPENDENCY_BINDINGS`
7. `WORKSPACE_NPM_LS`
8. `EXTERNAL_LOG_CHECK`
9. `LIFECYCLE_BINDING`
10. `V0`
11. `PREREQ_BUILD_ADMINISTRATION_CONTRACT`
12. `PREREQ_BUILD_MOBILE_WORK_CONTRACT`
13. `PREREQ_BUILD_OFFLINE_SYNC_CONTRACT`
14. `PREREQ_BUILD_TIME_ENTRY_EXPORT_CONTRACT`
15. `PREREQ_BUILD_TIME_REVIEW_CONTRACT`
16. `PREREQ_BUILD_CORE`
17. `PREREQ_BUILD_BACKEND_SCHEMA`
18. `PREREQ_BUILD_BACKEND_IDENTITY`
19. `PREREQ_BUILD_BACKEND_MOBILE_WORK`
20. `PREREQ_BUILD_BACKEND_READ_MODEL`
21. `PREREQ_BUILD_BACKEND_LIFECYCLE`
22. `PREREQ_BUILD_BACKEND_ADMINISTRATION`
23. `PREREQ_BUILD_BACKEND_TIME_EXPORT`
24. `PREREQ_BUILD_BACKEND_OFFLINE_SYNC`
25. `PREREQ_BUILD_BACKEND_TIME_REVIEW`
26. `PREREQ_BUILD_BACKEND_API`
27. `GENERATED_OUTPUT_CLOSURE`
28. `MOBILE_FOCUS_TEST`
29. `SYNTHETIC_FOCUS_TEST`
30. `MOBILE_TYPECHECK`
31. `SYNTHETIC_TYPECHECK`
32. `V2_SYNTHETIC_TEST`
33. `V2_SYNTHETIC_TYPECHECK`
34. `V2_SYNTHETIC_BUILD`
35. `V2_MOBILE_RUNTIME_TEST`
36. `V2_MOBILE_TYPECHECK`
37. `BUILD`
38. `NODE_CHECK`
39. `METAFILE_RUNTIME`
40. `TALKBACK_CLOSURE`
41. `ARTIFACT_PRESERVE`
42. `PRECLEANUP_SNAPSHOT`
43. `CLEANUP`
44. `POSTCLEANUP`
45. `FINALIZE`

Every executed command has only its own ID. `V2_SYNTHETIC_TYPECHECK`, `V2_MOBILE_RUNTIME_TEST`,
`V2_MOBILE_TYPECHECK` and `BUILD` may be `carried` only from their named earlier green component,
with original exit and unchanged-input proof; `BUILD` carries only from `V2_SYNTHETIC_BUILD` and
is not a second build command. `EXTERNAL_LOG_CHECK` is the final equality gate, while every npm
command record also contains its before/after external-log-set hashes. If execution stops, every
unreached identifier through `ARTIFACT_PRESERVE` must still receive its own record with
`execution_state=omitted`, null exit and the exact prior-failure reason. Cleanup identifiers always
receive their own executed result. No `V1`, `V2`, `PREREQUISITE_BUILDS` or other aggregate may
carry or replace an individual gate claim.

`ARTIFACT_PRESERVE` alone binds the exact bundle, source map and artifact-manifest paths above,
including size/SHA/mode; `PRECLEANUP_SNAPSHOT`, `POSTCLEANUP` and `FINALIZE` bind the exact receipt,
snapshot and evidence-manifest paths above. Attempt-7 execution state may not be reused.
Independent candidate review with zero open P0–P3 is required before any later exact execution
authority can be considered.

#### Attempt-8 execution result — fail-closed at `EXTERNAL_LOG_CHECK`

The historical Attempt-8 execution was separately bound to ADO commit
`90b90ba0e9c87fb8ebf22145399630ea4dfc46ae` / tree
`02c657dbeccf2da6866f66bd25a7c3b16182587f`. That historical binding is evidence only and does
not itself bind or authorize Attempt 9.

The one authorized execution produced all 45 individually identified records in normative order.
Records 1–7 contain their stated `decision=pass` values and preserve the npm exit/count evidence:
`NPM_CI` exit 0 with 695 packages, `GLOBAL_NPM_LS` exit 0 with 1,556 nodes/zero problems and
`WORKSPACE_NPM_LS` exit 0 with 424 nodes/zero problems. They do **not** establish the normative
per-command external-log-isolation contract: `NPM_CI` and `GLOBAL_NPM_LS` record only a before
set hash, while `WORKSPACE_NPM_LS` records neither a before nor after external set. Record 8,
`EXTERNAL_LOG_CHECK`, then failed closed on cumulative external npm-log entry-name-set drift, which
cannot be attributed to an individual npm invocation, because the external npm-log entry-name set
changed from count 10 / SHA-256
`dafb152bbacdbe3ed33469f594f5f1fda3d8de4804c17e897f49b437bbb8b8e8` to count 11 / SHA-256
`eb6db27ff83d9975d60d0451912a5c62095fb4a009b101ef536cad3e483e0ebe`.
Only entry names and stat metadata were observed; no external log content or raw entry name was
preserved. Because the exact changed entry or entries could not be safely attributed from the
hashed before-set, cleanup did not mutate external npm logs.

Records 9–41 each explicitly record `execution_state=omitted`, null exit and the prior
`EXTERNAL_LOG_CHECK` failure reason. Consequently no lifecycle/V0 gate, prerequisite build,
focused test, tests-inclusive Typecheck, V2 component, build, Node check, Metafile-runtime check,
TalkBack closure or artifact preservation ran. Records 42–45 completed the pre-cleanup snapshot,
cleanup, post-cleanup proof and fail-closed finalization. Checkout, task npm cache/logs, generated
output, worktree registration and artifact-output directory are absent; no bundle, source map or
artifact manifest exists. The external npm-log drift remains unmodified.

Preserved evidence is read-only under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt8-a0359a87-f3c81d6a`:

| Evidence file | Size | SHA-256 |
|---|---:|---|
| `attempt8-command-receipt.jsonl` | 16,424 bytes | `81105a0ebf66324aee55507e7970dafe3e58c5540178e0a071757a301ce53b06` |
| `attempt8-precleanup-receipt.jsonl` | 14,335 bytes | `1362d4b31eabac446c7422ada510f17442f0bea5215cff1e567e2d7c018a5958` |
| `attempt8-evidence-manifest.json` | 1,827 bytes | `98081ea10da768f93f4c08790406259049e331f5e02d8c30f831b12247a3dc30` |

The three files are mode `0444` and their directory is mode `0555`. Attempt 8 is consumed and
grants no retry, resume or Attempt-9 authority. Hardware/Human/Product V5 remains **DO NOT START**.

### Exact Attempt-9 ADO-only candidate — review pending, not executed

Attempt 9 is only a correction candidate. It is **REVIEW PENDING / NOT EXECUTED / DO NOT
EXECUTE**. It creates no file or directory and grants no execution, dependency installation,
build, test, Typecheck, artifact, ADB, Hardware or Human/Product-V5 authority. Independent review
must return `APPROVED` with zero open P0–P3 before the `AGENTS.md` standing rule can activate this
exact R3 scope. Attempt-8 state, receipt facts, external baseline or task paths may not be reused.
This exact ADO candidate is based on HEAD `90b90ba0e9c87fb8ebf22145399630ea4dfc46ae` / tree
`02c657dbeccf2da6866f66bd25a7c3b16182587f`; review must bind that baseline plus the exact current
six-file ADO delta. It is distinct from the historical Attempt-8 execution binding above even
though both currently name the same published commit/tree.
The executable source remains exactly `a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`, with the five source/lock hashes and exact Node/npm
paths, versions and hashes already listed below unchanged; future preflight must re-prove them.

The fresh binding is:

| Binding | Exact Attempt-9 path |
|---|---|
| Checkout | `/tmp/taptime-da5-harness-a035-attempt9-20260801-6d4e27b9` |
| npm cache | `/tmp/taptime-da5-harness-a035-attempt9-cache-20260801-6d4e27b9` |
| npm logs | `/tmp/taptime-da5-harness-a035-attempt9-logs-20260801-6d4e27b9` |
| npm config root | `/tmp/taptime-da5-harness-a035-attempt9-config-20260801-6d4e27b9` |
| npm userconfig | `/tmp/taptime-da5-harness-a035-attempt9-config-20260801-6d4e27b9/npmrc` |
| empty npm globalconfig | `/tmp/taptime-da5-harness-a035-attempt9-config-20260801-6d4e27b9/global-npmrc` |
| esbuild Metafile | `/tmp/taptime-da5-harness-a035-attempt9-20260801-6d4e27b9/da5-v5-esbuild-metafile.json` |
| Artifact output directory | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt9-a0359a87-6d4e27b9` |
| Preserved bundle | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt9-a0359a87-6d4e27b9/da5V5Main.js` |
| Preserved source map | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt9-a0359a87-6d4e27b9/da5V5Main.js.map` |
| Artifact manifest | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt9-a0359a87-6d4e27b9/attempt9-artifact-manifest.json` |
| Evidence directory | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt9-a0359a87-6d4e27b9` |
| Live receipt | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt9-a0359a87-6d4e27b9/attempt9-command-receipt.jsonl` |
| Precleanup snapshot | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt9-a0359a87-6d4e27b9/attempt9-precleanup-receipt.jsonl` |
| Evidence manifest | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt9-a0359a87-6d4e27b9/attempt9-evidence-manifest.json` |

The receipt schema is exactly `DA5-V5-HARNESS-ATTEMPT9-RECEIPT-1`. The Metafile command-form ID
is `DA5_V5_ATTEMPT9_METAFILE_RUNTIME_V1`; its exact no-newline descriptor is 1,435 bytes with
SHA-256 `be2f1c655fac23adcc4f3d6a0110619b25e03ef9d816834427dc12881e649d18`:

```json
{"id":"DA5_V5_ATTEMPT9_METAFILE_RUNTIME_V1","receipt_schema":"DA5-V5-HARNESS-ATTEMPT9-RECEIPT-1","canonical_checkout":"realpath(<CHECKOUT>)","canonical_cwd":"realpath(<CHECKOUT>/apps/synthetic-android-e2e)","key_resolution":"realpath(join(canonical_cwd,key))","boundary":"resolved_path_is_canonical_checkout_or_descendant","comparison":"repository_relative_only_after_boundary","allowed_input_policy":"tracked file at exact source commit or lock-backed file under node_modules; forbidden Expo roots rejected","required_inputs":["apps/synthetic-android-e2e/src/da5V5Main.ts","apps/synthetic-android-e2e/src/Da5V5AdbController.ts","apps/mobile/scripts/da5V5AndroidDevice.mjs"],"allowed_outputs":["apps/synthetic-android-e2e/dist/index.js","apps/synthetic-android-e2e/dist/index.js.map","apps/synthetic-android-e2e/dist/main.js","apps/synthetic-android-e2e/dist/main.js.map","apps/synthetic-android-e2e/dist/gateCResponseDropMain.js","apps/synthetic-android-e2e/dist/gateCResponseDropMain.js.map","apps/synthetic-android-e2e/dist/gateCTransportRestoreMain.js","apps/synthetic-android-e2e/dist/gateCTransportRestoreMain.js.map","apps/synthetic-android-e2e/dist/da4V5Main.js","apps/synthetic-android-e2e/dist/da4V5Main.js.map","apps/synthetic-android-e2e/dist/da4V5ManifestMain.js","apps/synthetic-android-e2e/dist/da4V5ManifestMain.js.map","apps/synthetic-android-e2e/dist/da5V5Main.js","apps/synthetic-android-e2e/dist/da5V5Main.js.map"]}
```

Attempt 9 retains exactly the same ordered 45 individual command IDs listed for Attempt 8 above.
That cross-reference adopts only the ID names, order and per-gate architecture: it adopts no
Attempt-8 path, state, result, receipt or baseline. Every command retains its own ID and receipt
record; no `V1`, `V2`, prerequisite-build or other aggregate may replace an individual claim.
Every unreached ID through `ARTIFACT_PRESERVE` is individually omitted with null exit and exact
prior-failure reason; cleanup and finalization retain their own executed records.

#### Attempt-9 npm configuration and per-command log-isolation contract

At future evidence-first preflight, the current external npm-log entry-name set must be newly
observed and bound only as `entry_count` plus SHA-256 of the UTF-8 compact JSON array of direct
entry names sorted lexicographically, with no trailing newline. It is an unattributed, immutable
comparison baseline: no raw name or content may be recorded, no external log file may be opened,
deleted, moved, adopted or used as task evidence, and no Attempt-8 count/hash may be reused.

Before the first npm invocation, execution must create fresh canonical config, cache and task-log
directories, each mode `0700`, plus userconfig mode `0600`, zero-byte globalconfig mode `0600`
and cache child `tmp` mode `0700`. The globalconfig SHA-256 is
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. The UTF-8 userconfig has
exactly the following 272 bytes including its final newline, SHA-256
`ac6f0eaba58b3cdb341f58fd4d2afdc1f063617eab502a81cb886646e085bad1`:

```ini
cache=/tmp/taptime-da5-harness-a035-attempt9-cache-20260801-6d4e27b9
logs-dir=/tmp/taptime-da5-harness-a035-attempt9-logs-20260801-6d4e27b9
logs-max=0
loglevel=silent
timing=false
ignore-scripts=true
audit=false
fund=false
update-notifier=false
progress=false
color=false
```

Only three npm invocations exist: `NPM_CI` uses `ci --ignore-scripts`, `GLOBAL_NPM_LS` uses
`ls --all --json`, and `WORKSPACE_NPM_LS` uses
`ls --all --json --workspace=@taptime/synthetic-android-e2e`. Each is one ordered
`npm_invocations[]` element with exact canonical cwd, absolute Node/npm argv, allowlisted env,
system-only `PATH`, allowed outputs and exit. No npm `run`, `exec`, test, Typecheck or build command
exists. `HOME` is absent rather than rebound and no user/global/system npm config is changed.

npm `11.13.0` source `lib/utils/log-file.js`, SHA-256
`0545402f1a53075726505829f4dc6b0ec2f43e857fd559b8868c60feae1c46a4`, opens no logfile when
`logsMax` is zero; its bundled logging documentation, SHA-256
`1b851f0ef48a7925b665b4b61888619e6ce63ef92325877473de5d193d909785`, states that
`loglevel=silent` plus `logs-max=0` prevents terminal and filesystem logs. The task-log directory
must therefore remain exactly empty before and after every npm invocation: count `0` and SHA-256
`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` of compact JSON `[]`.
Any entry, hash drift or noncanonical/mode/type mismatch stops before the next gate.

`npm ci --ignore-scripts` blocks both and only lock-recorded install scripts: nonoptional
`esbuild@0.28.1` and optional `fsevents@2.3.3`. No npm lifecycle child may run. `fsevents` remains
optional and every Vitest argv uses `run`, never watch mode.

Immediately before and immediately after every individual npm command, the same receipt record
must contain mandatory `external_log_entry_count_before`, `external_log_entry_set_sha256_before`,
`external_log_entry_count_after`, `external_log_entry_set_sha256_after`,
`task_log_entry_count_before`, `task_log_entry_set_sha256_before`,
`task_log_entry_count_after` and `task_log_entry_set_sha256_after`, together with canonical cwd,
exact argv/environment binding and exit. External count and hash must equal the newly bound
preflight baseline on both sides; any mismatch stops before the next gate. Task-log enumeration is
confined to the canonical task log directory, rejects symlinks/non-regular entries/escape and
uses the same compact-JSON sorted-name encoding while recording only count/set hash, never raw
names or contents. Any write outside the task
cache/log/config roots or any unbound task-log transition fails closed. The pre-lifecycle
`EXTERNAL_LOG_CHECK` remains a cumulative equality check for commands already completed and cannot
substitute for any command's mandatory before/after fields.

Every non-npm build, focused test, complete test, Typecheck, list-files proof, final Synthetic
bundle and Node syntax check uses an absolute Node argv against the lock-backed `typescript/bin/tsc`,
`vitest/vitest.mjs` or `esbuild/bin/esbuild` entrypoint. The environment is an exact allowlist with
`PATH=/usr/bin:/bin:/usr/sbin:/sbin`, contains no npm/npx path, and has `npm_execpath`,
`npm_node_execpath` and every `NPM_CONFIG_*` absent. esbuild invocations alone add exact
`ESBUILD_BINARY_PATH=<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild`; preflight must
bind version `0.28.1`, mode `0755`, size 10,573,778 bytes, SHA-256
`e2dc9a52440a2a34f09434a2f4843cb1e30f84e40dcf238976ec61ef8cd7f36a`, Darwin and arm64 before
use. The orchestrator executes immutable argv arrays directly without a shell and records every
ordered invocation, canonical cwd, exact argv/env, allowed output roots and exit in that gate's
`process_invocations[]`. A scalar gate result cannot cover multiple invocations. The orchestrator
rejects every requested process launch outside the closed map before spawn; shell indirection or
npm/npx/npm-CLI reference in a non-npm gate fails closed. Lock-backed tool-internal workers are not
separately runtime-traced; their boundary is the exact entrypoint/argv/env plus before/after result.
In-process stat/hash/JSON/copy checks launch no child, so no unenforceable tracing claim is made.

The closed command-map ID is `DA5_V5_ATTEMPT9_COMMAND_MAP_V1`. Its exact no-newline compact JSON
is 41,133 bytes with SHA-256
`1f155e62b123df3555bdbf503a32e9dea99da035836db6f27a4956e672e77d12`:

```json
{"id":"DA5_V5_ATTEMPT9_COMMAND_MAP_V1","receipt_schema":"DA5-V5-HARNESS-ATTEMPT9-RECEIPT-1","source_commit":"a0359a87fd1738c8493929a1661cbbc7adb3c07c","source_tree":"102c913e264bd0ccce1d085db1c50bd407f7d4a4","gate_order":["EVIDENCE_INIT","WORKTREE_ADD","SOURCE_TOOL_BINDING","NPM_CI","GLOBAL_NPM_LS","DEPENDENCY_BINDINGS","WORKSPACE_NPM_LS","EXTERNAL_LOG_CHECK","LIFECYCLE_BINDING","V0","PREREQ_BUILD_ADMINISTRATION_CONTRACT","PREREQ_BUILD_MOBILE_WORK_CONTRACT","PREREQ_BUILD_OFFLINE_SYNC_CONTRACT","PREREQ_BUILD_TIME_ENTRY_EXPORT_CONTRACT","PREREQ_BUILD_TIME_REVIEW_CONTRACT","PREREQ_BUILD_CORE","PREREQ_BUILD_BACKEND_SCHEMA","PREREQ_BUILD_BACKEND_IDENTITY","PREREQ_BUILD_BACKEND_MOBILE_WORK","PREREQ_BUILD_BACKEND_READ_MODEL","PREREQ_BUILD_BACKEND_LIFECYCLE","PREREQ_BUILD_BACKEND_ADMINISTRATION","PREREQ_BUILD_BACKEND_TIME_EXPORT","PREREQ_BUILD_BACKEND_OFFLINE_SYNC","PREREQ_BUILD_BACKEND_TIME_REVIEW","PREREQ_BUILD_BACKEND_API","GENERATED_OUTPUT_CLOSURE","MOBILE_FOCUS_TEST","SYNTHETIC_FOCUS_TEST","MOBILE_TYPECHECK","SYNTHETIC_TYPECHECK","V2_SYNTHETIC_TEST","V2_SYNTHETIC_TYPECHECK","V2_SYNTHETIC_BUILD","V2_MOBILE_RUNTIME_TEST","V2_MOBILE_TYPECHECK","BUILD","NODE_CHECK","METAFILE_RUNTIME","TALKBACK_CLOSURE","ARTIFACT_PRESERVE","PRECLEANUP_SNAPSHOT","CLEANUP","POSTCLEANUP","FINALIZE"],"paths":{"checkout":"<CHECKOUT>","cache":"<CACHE>","logs":"<LOGS>","config":"<CONFIG>","evidence":"<EVIDENCE>","artifact":"<ARTIFACT>"},"tools":{"node":{"path":"/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","version":"v24.17.0","sha256":"f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601"},"npm":{"path":"/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js","version":"11.13.0","sha256":"8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7"},"git":{"path":"/usr/bin/git","mode":"0755","size":118928,"sha256":"179301dcb41ea78accc3fa0048a7e6f6710d891945a751a34addd622020c1818"},"tsc":{"path":"<CHECKOUT>/node_modules/typescript/bin/tsc","version":"6.0.3"},"vitest":{"path":"<CHECKOUT>/node_modules/vitest/vitest.mjs","version":"4.1.9","mode":"run_no_watch"},"esbuild_js":{"path":"<CHECKOUT>/node_modules/esbuild/bin/esbuild","version":"0.28.1"},"esbuild_binary":{"path":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild","version":"0.28.1","mode":"0755","size":10573778,"sha256":"e2dc9a52440a2a34f09434a2f4843cb1e30f84e40dcf238976ec61ef8cd7f36a","os":"darwin","arch":"arm64"}},"env_policy":{"npm":"exact allowlist in each npm invocation; HOME absent and not rebound","non_npm":"exact allowlist in each process invocation; npm_execpath,npm_node_execpath and every NPM_CONFIG_* absent","path":"/usr/bin:/bin:/usr/sbin:/sbin","shell":false},"npm_install_scripts_blocked":[{"package":"esbuild","version":"0.28.1","optional":false},{"package":"fsevents","version":"2.3.3","optional":true}],"npm_invocations":{"NPM_CI":[{"cwd":"<CHECKOUT>","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js","ci","--ignore-scripts"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NPM_CONFIG_USERCONFIG":"<CONFIG>/npmrc","NPM_CONFIG_GLOBALCONFIG":"<CONFIG>/global-npmrc","NPM_CONFIG_CACHE":"<CACHE>","NPM_CONFIG_LOGS_DIR":"<LOGS>","NPM_CONFIG_LOGS_MAX":"0","NPM_CONFIG_LOGLEVEL":"silent","NPM_CONFIG_TIMING":"false","NPM_CONFIG_IGNORE_SCRIPTS":"true","NPM_CONFIG_AUDIT":"false","NPM_CONFIG_FUND":"false","NPM_CONFIG_UPDATE_NOTIFIER":"false","NPM_CONFIG_PROGRESS":"false","NPM_CONFIG_COLOR":"false"},"allowed_output_roots":["<CHECKOUT>/node_modules","<CACHE>"],"allowed_output_policy":"locked install and task cache only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code","external_log_entry_count_before","external_log_entry_set_sha256_before","external_log_entry_count_after","external_log_entry_set_sha256_after","task_log_entry_count_before","task_log_entry_set_sha256_before","task_log_entry_count_after","task_log_entry_set_sha256_after"],"external_log_requirement":"before and after equal newly bound Attempt-9 preflight count/hash","task_log_requirement":{"count_before":0,"sha256_before":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","count_after":0,"sha256_after":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}}],"GLOBAL_NPM_LS":[{"cwd":"<CHECKOUT>","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js","ls","--all","--json"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NPM_CONFIG_USERCONFIG":"<CONFIG>/npmrc","NPM_CONFIG_GLOBALCONFIG":"<CONFIG>/global-npmrc","NPM_CONFIG_CACHE":"<CACHE>","NPM_CONFIG_LOGS_DIR":"<LOGS>","NPM_CONFIG_LOGS_MAX":"0","NPM_CONFIG_LOGLEVEL":"silent","NPM_CONFIG_TIMING":"false","NPM_CONFIG_IGNORE_SCRIPTS":"true","NPM_CONFIG_AUDIT":"false","NPM_CONFIG_FUND":"false","NPM_CONFIG_UPDATE_NOTIFIER":"false","NPM_CONFIG_PROGRESS":"false","NPM_CONFIG_COLOR":"false"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code","external_log_entry_count_before","external_log_entry_set_sha256_before","external_log_entry_count_after","external_log_entry_set_sha256_after","task_log_entry_count_before","task_log_entry_set_sha256_before","task_log_entry_count_after","task_log_entry_set_sha256_after"],"external_log_requirement":"before and after equal newly bound Attempt-9 preflight count/hash","task_log_requirement":{"count_before":0,"sha256_before":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","count_after":0,"sha256_after":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}}],"WORKSPACE_NPM_LS":[{"cwd":"<CHECKOUT>","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js","ls","--all","--json","--workspace=@taptime/synthetic-android-e2e"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NPM_CONFIG_USERCONFIG":"<CONFIG>/npmrc","NPM_CONFIG_GLOBALCONFIG":"<CONFIG>/global-npmrc","NPM_CONFIG_CACHE":"<CACHE>","NPM_CONFIG_LOGS_DIR":"<LOGS>","NPM_CONFIG_LOGS_MAX":"0","NPM_CONFIG_LOGLEVEL":"silent","NPM_CONFIG_TIMING":"false","NPM_CONFIG_IGNORE_SCRIPTS":"true","NPM_CONFIG_AUDIT":"false","NPM_CONFIG_FUND":"false","NPM_CONFIG_UPDATE_NOTIFIER":"false","NPM_CONFIG_PROGRESS":"false","NPM_CONFIG_COLOR":"false"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code","external_log_entry_count_before","external_log_entry_set_sha256_before","external_log_entry_count_after","external_log_entry_set_sha256_after","task_log_entry_count_before","task_log_entry_set_sha256_before","task_log_entry_count_after","task_log_entry_set_sha256_after"],"external_log_requirement":"before and after equal newly bound Attempt-9 preflight count/hash","task_log_requirement":{"count_before":0,"sha256_before":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945","count_after":0,"sha256_after":"4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"}}]},"process_invocations":{"WORKTREE_ADD":[{"cwd":"/Users/timbartz/Dokumente/GitHub/taptime","argv":["/usr/bin/git","-C","/Users/timbartz/Dokumente/GitHub/taptime","worktree","add","--detach","--no-checkout","<CHECKOUT>","a0359a87fd1738c8493929a1661cbbc7adb3c07c"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>","/Users/timbartz/Dokumente/GitHub/taptime/.git/worktrees/taptime-da5-harness-a035-attempt9-20260801-6d4e27b9"],"allowed_output_policy":"fresh exact worktree and its exact registration only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","sparse-checkout","init","--no-cone"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>","/Users/timbartz/Dokumente/GitHub/taptime/.git/worktrees/taptime-da5-harness-a035-attempt9-20260801-6d4e27b9"],"allowed_output_policy":"sparse metadata only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","sparse-checkout","set","/*","!/research/","!/app.json"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>","/Users/timbartz/Dokumente/GitHub/taptime/.git/worktrees/taptime-da5-harness-a035-attempt9-20260801-6d4e27b9"],"allowed_output_policy":"sparse metadata only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","checkout","--detach","a0359a87fd1738c8493929a1661cbbc7adb3c07c"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>","/Users/timbartz/Dokumente/GitHub/taptime/.git/worktrees/taptime-da5-harness-a035-attempt9-20260801-6d4e27b9"],"allowed_output_policy":"initial tracked source materialization excluding protected paths","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"SOURCE_TOOL_BINDING":[{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","rev-parse","HEAD^{commit}"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","rev-parse","HEAD^{tree}"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","status","--porcelain=v1","--untracked-files=all","--",".",":(exclude)research/**",":(exclude)app.json"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_ADMINISTRATION_CONTRACT":[{"cwd":"<CHECKOUT>/packages/administration-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/packages/administration-contract/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/packages/administration-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/packages/administration-contract/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_MOBILE_WORK_CONTRACT":[{"cwd":"<CHECKOUT>/packages/mobile-work-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/packages/mobile-work-contract/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_OFFLINE_SYNC_CONTRACT":[{"cwd":"<CHECKOUT>/packages/offline-sync-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/packages/offline-sync-contract/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/packages/offline-sync-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=neutral","--target=es2022","--format=esm","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/packages/offline-sync-contract/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_TIME_ENTRY_EXPORT_CONTRACT":[{"cwd":"<CHECKOUT>/packages/time-entry-export-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/packages/time-entry-export-contract/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/packages/time-entry-export-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=neutral","--target=es2022","--format=esm","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/packages/time-entry-export-contract/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_TIME_REVIEW_CONTRACT":[{"cwd":"<CHECKOUT>/packages/time-review-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/packages/time-review-contract/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/packages/time-review-contract","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=neutral","--target=es2022","--format=esm","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/packages/time-review-contract/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_CORE":[{"cwd":"<CHECKOUT>/packages/core","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.json"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/packages/core/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_SCHEMA":[{"cwd":"<CHECKOUT>/apps/backend-schema","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-schema/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-schema","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:pg","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-schema/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_IDENTITY":[{"cwd":"<CHECKOUT>/apps/backend-identity","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-identity/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-identity","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:jose","--external:pg","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-identity/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_MOBILE_WORK":[{"cwd":"<CHECKOUT>/apps/backend-mobile-work","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-mobile-work/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-mobile-work","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:@taptime/backend-identity","--external:@taptime/mobile-work-contract","--external:pg","--sourcemap","--outdir=dist"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-mobile-work/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_READ_MODEL":[{"cwd":"<CHECKOUT>/apps/backend-read-model","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-read-model/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-read-model","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:@taptime/backend-identity","--external:@taptime/core","--external:pg","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-read-model/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_LIFECYCLE":[{"cwd":"<CHECKOUT>/apps/backend-lifecycle","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-lifecycle/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-lifecycle","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:@taptime/backend-identity","--external:@taptime/backend-schema","--external:@taptime/core","--external:pg","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-lifecycle/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_ADMINISTRATION":[{"cwd":"<CHECKOUT>/apps/backend-administration","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-administration/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-administration","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:@taptime/administration-contract","--external:@taptime/backend-identity","--external:@taptime/core","--external:pg","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-administration/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_TIME_EXPORT":[{"cwd":"<CHECKOUT>/apps/backend-time-export","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-time-export/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-time-export","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:@taptime/backend-identity","--external:@taptime/time-entry-export-contract","--external:pg","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-time-export/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_OFFLINE_SYNC":[{"cwd":"<CHECKOUT>/apps/backend-offline-sync","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-offline-sync/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-offline-sync","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:@taptime/backend-identity","--external:@taptime/backend-schema","--external:@taptime/core","--external:@taptime/offline-sync-contract","--external:@taptime/time-review-contract","--external:pg","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-offline-sync/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_TIME_REVIEW":[{"cwd":"<CHECKOUT>/apps/backend-time-review","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-time-review/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-time-review","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:pg","--external:jose","--sourcemap","--outfile=dist/index.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-time-review/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"PREREQ_BUILD_BACKEND_API":[{"cwd":"<CHECKOUT>/apps/backend-api","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/backend-api/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/backend-api","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","src/main.ts","--bundle","--platform=node","--target=node24","--format=esm","--external:@taptime/backend-administration","--external:@taptime/backend-identity","--external:@taptime/backend-lifecycle","--external:@taptime/backend-mobile-work","--external:@taptime/backend-offline-sync","--external:@taptime/backend-read-model","--external:@taptime/backend-time-export","--external:@taptime/backend-time-review","--external:@taptime/core","--external:@taptime/mobile-work-contract","--external:@taptime/offline-sync-contract","--external:@taptime/time-entry-export-contract","--external:@taptime/time-review-contract","--external:pg","--sourcemap","--outdir=dist"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/backend-api/dist"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"MOBILE_FOCUS_TEST":[{"cwd":"<CHECKOUT>/apps/mobile","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/vitest/vitest.mjs","run","tests/runtime/da5V5AndroidDevice.test.ts"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/node_modules"],"allowed_output_policy":"lock-backed tool cache only; no watch mode","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"SYNTHETIC_FOCUS_TEST":[{"cwd":"<CHECKOUT>/apps/synthetic-android-e2e","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/vitest/vitest.mjs","run","tests/Da5V5AdbController.test.ts"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/node_modules"],"allowed_output_policy":"lock-backed tool cache only; no watch mode","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"MOBILE_TYPECHECK":[{"cwd":"<CHECKOUT>/apps/mobile","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","--noEmit"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/mobile","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.json","--noEmit","--listFilesOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"SYNTHETIC_TYPECHECK":[{"cwd":"<CHECKOUT>/apps/synthetic-android-e2e","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.json","--noEmit"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/synthetic-android-e2e","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.json","--noEmit","--listFilesOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"V2_SYNTHETIC_TEST":[{"cwd":"<CHECKOUT>/apps/synthetic-android-e2e","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/vitest/vitest.mjs","run"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/node_modules"],"allowed_output_policy":"lock-backed tool cache only; no watch mode","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"V2_SYNTHETIC_BUILD":[{"cwd":"<CHECKOUT>/apps/synthetic-android-e2e","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/typescript/bin/tsc","-p","tsconfig.build.json","--emitDeclarationOnly"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>/apps/synthetic-android-e2e/dist"],"allowed_output_policy":"tracked-source-derived TypeScript outputs declared by the selected tsconfig only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>/apps/synthetic-android-e2e","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","<CHECKOUT>/node_modules/esbuild/bin/esbuild","src/index.ts","src/main.ts","src/gateCResponseDropMain.ts","src/gateCTransportRestoreMain.ts","src/da4V5Main.ts","src/da4V5ManifestMain.ts","src/da5V5Main.ts","--bundle","--platform=node","--target=node24","--format=esm","--alias:@taptime/backend-administration=../backend-administration/src/index.ts","--alias:@taptime/backend-api=../backend-api/src/index.ts","--alias:@taptime/backend-identity=../backend-identity/src/index.ts","--alias:@taptime/backend-lifecycle=../backend-lifecycle/src/index.ts","--alias:@taptime/backend-mobile-work=../backend-mobile-work/src/index.ts","--alias:@taptime/backend-offline-sync=../backend-offline-sync/src/index.ts","--alias:@taptime/backend-read-model=../backend-read-model/src/index.ts","--alias:@taptime/backend-schema=../backend-schema/src/index.ts","--alias:@taptime/backend-time-export=../backend-time-export/src/index.ts","--alias:@taptime/backend-time-review=../backend-time-review/src/index.ts","--alias:@taptime/administration-contract=../../packages/administration-contract/src/index.ts","--alias:@taptime/core=../../packages/core/src/index.ts","--alias:@taptime/mobile-work-contract=../../packages/mobile-work-contract/src/index.ts","--alias:@taptime/offline-sync-contract=../../packages/offline-sync-contract/src/index.ts","--alias:@taptime/time-entry-export-contract=../../packages/time-entry-export-contract/src/index.ts","--alias:@taptime/time-review-contract=../../packages/time-review-contract/src/index.ts","--external:jose","--external:pg","--sourcemap","--outdir=dist","--metafile=<CHECKOUT>/da5-v5-esbuild-metafile.json"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1","ESBUILD_BINARY_PATH":"<CHECKOUT>/node_modules/@esbuild/darwin-arm64/bin/esbuild"},"allowed_output_roots":["<CHECKOUT>/apps/synthetic-android-e2e/dist","<CHECKOUT>/da5-v5-esbuild-metafile.json"],"allowed_output_policy":"exact esbuild outfile/outdir products and maps declared by argv only","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"NODE_CHECK":[{"cwd":"<CHECKOUT>/apps/synthetic-android-e2e","argv":["/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node","--check","<CHECKOUT>/apps/synthetic-android-e2e/dist/da5V5Main.js"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"V0":[{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","rev-parse","HEAD^{commit}"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","rev-parse","HEAD^{tree}"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","status","--porcelain=v1","--untracked-files=all","--",".",":(exclude)research/**",":(exclude)app.json"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]},{"cwd":"<CHECKOUT>","argv":["/usr/bin/git","-C","<CHECKOUT>","diff","--check","--",".",":(exclude)research/**",":(exclude)app.json"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"CLEANUP":[{"cwd":"/Users/timbartz/Dokumente/GitHub/taptime","argv":["/usr/bin/git","-C","/Users/timbartz/Dokumente/GitHub/taptime","worktree","remove","--force","<CHECKOUT>"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":["<CHECKOUT>","/Users/timbartz/Dokumente/GitHub/taptime/.git/worktrees/taptime-da5-harness-a035-attempt9-20260801-6d4e27b9"],"allowed_output_policy":"only after identity-bound realpath/device/inode validation of exact task worktree","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}],"POSTCLEANUP":[{"cwd":"/Users/timbartz/Dokumente/GitHub/taptime","argv":["/usr/bin/git","-C","/Users/timbartz/Dokumente/GitHub/taptime","worktree","list","--porcelain"],"env":{"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","TMPDIR":"<CACHE>/tmp","NO_COLOR":"1"},"allowed_output_roots":[],"allowed_output_policy":"none","required_exit":0,"required_receipt_fields":["array_index","canonical_cwd","argv","env","exit_code"]}]},"in_process_only_gates":["EVIDENCE_INIT","DEPENDENCY_BINDINGS","EXTERNAL_LOG_CHECK","LIFECYCLE_BINDING","GENERATED_OUTPUT_CLOSURE","V2_SYNTHETIC_TYPECHECK","V2_MOBILE_RUNTIME_TEST","V2_MOBILE_TYPECHECK","BUILD","METAFILE_RUNTIME","TALKBACK_CLOSURE","ARTIFACT_PRESERVE","PRECLEANUP_SNAPSHOT","FINALIZE"],"enforcement":"orchestrator executes only these argv arrays directly without shell and rejects every requested process launch outside this map before spawn; canonical cwd, exact argv/env, exit and ordered array index are recorded; lock-backed tool-internal workers are not separately runtime-traced"}
```

The command map translates the exact `a0359a8` package scripts without npm or shell indirection.
Its 45-entry gate order is normative. Every gate receipt contains ordered `npm_invocations[]`
and/or `process_invocations[]` exactly as mapped, or empty arrays for a named in-process/carried
gate; a scalar or aggregate cannot replace an array element. `V2_SYNTHETIC_TYPECHECK`,
`V2_MOBILE_RUNTIME_TEST`, `V2_MOBILE_TYPECHECK` and `BUILD` remain carried gates with no child.

Allowed mutation is closed to: receipt/snapshot/manifest creation under `<EVIDENCE>`; exact config
files under `<CONFIG>`; npm cache plus `<CACHE>/tmp`; the always-empty `<LOGS>` directory; initial
tracked-source materialization and exact worktree registration during `WORKTREE_ADD`; then only
`<CHECKOUT>/node_modules`, compiler-declared tracked-source-derived declaration/JS/map outputs
under the mapped `dist` roots, lock-backed tool cache beneath `node_modules`, and the exact
Metafile. TSC output paths must be the deterministic selected-tsconfig projection of tracked
included sources; esbuild outputs must equal the exact `outfile`/`outdir` argv products and maps.
The artifact root may first be created only by green `ARTIFACT_PRESERVE` for the exact bundle,
source map and manifest. Everything else, including tracked source/lock/config, is immutable.

Before cleanup, every removable root and worktree registration must still match its bound
canonical realpath, device and inode. Cleanup may address only those exact identity-bound task
roots; mismatch stops deletion and leaves residue reported. No external npm log, unrelated
worktree or repository path may be opened, adopted, moved or deleted.

All fresh roots and bound files must be absent before evidence initialization; the config,
checkout, cache, logs, generated output and worktree registration must be removed during cleanup.
Only a disclosure-safe mode-`0444` receipt/snapshot/evidence manifest and, after all gates pass,
the exact read-only artifact tuple may remain. This candidate performs no external mutation and
does not authorize Attempt-9 execution.

## 2. Confirmed finding `DA5-V5-HARNESS-ARTIFACT-01`

Repository truth on the exact preparation baseline is:

- `apps/synthetic-android-e2e/package.json` starts DA5 V5 with
  `node dist/da5V5Main.js`; `dist/` is ignored by `.gitignore`.
- Corrected source `apps/synthetic-android-e2e/src/da5V5Main.ts` requires
  `TAPTIME_DA5_V5_TALKBACK_PACKAGE` and validates it through
  `requireDa5V5TalkBackPackage`.
- `apps/mobile/scripts/da5V5AndroidDevice.mjs` allowlists exactly
  `com.google.android.marvin.talkback` and
  `com.samsung.android.accessibility.talkback`; the current controller verifies the exact active
  expected package and version.
- The locally startable ignored `apps/synthetic-android-e2e/dist/da5V5Main.js` is 800,623 bytes,
  mode `0644`, SHA-256
  `f0f4fdde80f7cf8cc1869aaa4b2267dbf22539e240beacbddf51cd3591e59cac`, and has modification
  time `2026-07-28T18:11:16+0200`, before source commit `a0359a8` on
  `2026-07-31T16:30:50+0200`.
- Static inspection of that ignored bundle finds the Google package twice, the Samsung package
  zero times, `TAPTIME_DA5_V5_TALKBACK_PACKAGE` zero times and `talkBackPackage` zero times.

Therefore the reviewed source correction remains valid source evidence, but the currently
startable ignored bundle is stale and Google-only. It is not an authorized execution artifact and
cannot support the documented Google-or-Samsung pre-run closure. Product Human V5 remains
**DO NOT START**.

GitHub Actions run `30638926835`, attempt 1, is correctly bound to `a0359a8` and completed
successfully with 12/12 jobs. It proves the tracked source candidate, not the later ignored local
bundle. Earlier ADO references to 11/11 are corrected by this R0 synchronization.

## 3. Exact Attempt-8 R3 scope — historical, authority consumed

Independent review Round 3 returned `APPROVED` with zero open P0–P3 and activated the following
exact technical scope for the single Attempt-8 execution. The authority is now consumed; this
historical scope cannot authorize a retry, resume or Attempt 9:

1. Use a fresh task-owned clean checkout of exact source `a0359a8` / tree `102c913` or a later
   accepted ADO-only descendant proven byte-identical for all executable inputs.
2. Prove no delta from `a0359a8` in `apps/synthetic-android-e2e/**`, `apps/mobile/**`, root
   `package.json` or `package-lock.json`. Do not change Product source, schema, migration,
   dependency, lockfile, workflow, APK, manifest or signer input.
3. Recreate the locked dependency tree only inside that isolated checkout, without dependency
   update or system installation, then execute the existing exact
   `@taptime/synthetic-android-e2e` build. Do not reuse any pre-existing `dist/` output.
4. Preserve only the newly built `da5V5Main.js`, its source map and a disclosure-safe binding
   manifest in a task-owned read-only artifact directory. Do not commit generated `dist/` output.
5. Bind the later start command to the exact absolute bundle path and SHA-256 from that manifest;
   the generic unverified repository-local `npm run da5-v5:start` path remains prohibited.
6. Perform only the focused ADO/status/runbook/evidence synchronization necessary to record the
   actual result. No Product Human V5 authorization is included.

The current input hashes to reverify before the later build are:

| Input | SHA-256 |
|---|---|
| `package-lock.json` | `62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470` |
| `apps/synthetic-android-e2e/package.json` | `49312f9d66372616275bf2cee4fdd335b4f8320d66a65ae89352356450f07bd8` |
| `apps/synthetic-android-e2e/src/da5V5Main.ts` | `fe010475bb5ae4182d7dc386d465f60db935ea5b9f628c5ce88b76f8780ba204` |
| `apps/synthetic-android-e2e/src/Da5V5AdbController.ts` | `f20c2c36e324aa6c2031be0699e5b5b4caac63c0268c1b7c2d77d5e00138b80b` |
| `apps/mobile/scripts/da5V5AndroidDevice.mjs` | `5b34cfdfb5426b7a16b28dce5108767286f83e2f253b89f0f19c4c3098e850d1` |

## 4. Attempt-8 required source, bundle, dependency and Node binding — historical

The later artifact manifest and verification record must bind all of the following in one closure:

- source commit/tree, exact changed range and the five input hashes above;
- complete `package-lock.json` hash and proof of no dependency or lockfile delta;
- Node version, canonical executable path and executable SHA-256 used for both build and later
  start; the proposed exact tool is Node `24.17.0` at
  `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`, SHA-256
  `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`;
- npm, TypeScript and esbuild versions resolved from the locked dependency tree;
- exact build command, exit status and an esbuild input/metafile closure proving
  `src/da5V5Main.ts`, `src/Da5V5AdbController.ts` and
  `apps/mobile/scripts/da5V5AndroidDevice.mjs` fed the generated bundle;
- bundle and source-map absolute paths, byte sizes, modes and SHA-256 digests; and
- exact read-only preservation location plus proof that the later start uses that exact Node and
  bundle digest rather than any repository-local residue.

Any mismatch, missing input, additional executable input or unbound tool fails closed.

## 5. Attempt-8 adaptive verification contract — historical

Because the bundle controls a release-critical Human gate, the later closure is R3 even without a
Product-source change.

- **V0:** exact source/tree/status/diff and protected-path exclusions; no stale `dist/` reuse;
  exact input/tool/dependency/output manifest.
- **V1:** only the focused Mobile Android-device and Synthetic DA5 ADB-controller regressions
  covering Google success, Samsung success, none/inactive/both/foreign/drift rejection; both
  affected tests-inclusive typechecks; `node --check` on the exact bundle.
- **V2:** complete `@taptime/synthetic-android-e2e` test/typecheck/build plus the affected Mobile
  runtime test/typecheck boundary.
- **V3/V4:** required only if AVS-001 or the final publication boundary requires them; run once on
  the final candidate, not on intermediate artifacts. No test result may substitute for the
  source/artifact manifest.
- **Independent review:** exact source commit/tree, exact ADO delta, locked dependency state,
  Node binding, bundle/source-map SHA-256, focused results and omissions. Verdict is only
  `APPROVED` or `CHANGES REQUIRED`, with P0–P3 findings; approval requires zero open P0–P3.
- **V5:** not authorized and not run by this closure.

The independent reviewer must verify Google and Samsung semantics from focused tests and confirm
that the exact reviewed bundle closure includes both allowlisted packages, the explicit expected
package input and the active-provider/version enforcement. Static marker presence alone is not
sufficient without the source/metafile/test binding.

## 6. Failure, rollback and ADO synchronization

Any build, dependency, tool, manifest, bundle, focused-check or review mismatch stops the closure.
The operator must preserve disclosure-safe failure evidence, remove or quarantine only the new
task-owned output and leave the repository without an authorized startable DA5-V5 bundle. The
stale ignored bundle must never be restored or reclassified as valid rollback output.

On failure, synchronize only the finding, failed stage, exact bindings and continuing
**DO NOT START** state in Project Status, Risk Register, this runbook and DA5 V5 Evidence. On
success, synchronize the exact read-only bundle/manifest/Node/dependency/review bindings and keep
all Product Human V5 fields `UNBOUND — DO NOT START` until a separate Human authorization.

## 7. Gates that remain separate

The historical expected sequence was:

```text
ADO-only candidate V0
  -> independent candidate review with zero open P0–P3
  -> exact R3 artifact closure under the AGENTS.md standing rule
  -> independent source/artifact Exact-SHA review with zero open P0–P3
  -> separate exact Product-Human-V5 authorization
  -> fresh Product Human V5
```

No arrow authorizes a later arrow. Human, installation, ADB, device, Tag, hardware, Product V5,
production, production-data, deployment and distribution gates remain separate.
Attempt 8 stopped before the artifact closure completed; no later arrow was reached and no Attempt
9 is authorized.

## 8. Current R0 Change-Impact Record

- Baseline: current HEAD `90b90ba0e9c87fb8ebf22145399630ea4dfc46ae` / tree
  `02c657dbeccf2da6866f66bd25a7c3b16182587f` plus this exact six-file ADO delta. The historical
  Attempt-8 execution binding is recorded separately above and is not reused as Attempt-9 state.
- Exact changed-file scope: `ADO/README.md`, `ADO/00_Core/Project_Status.md`,
  `ADO/00_Core/Risk_Register.md`,
  `ADO/02_Development/Development_Assignment_05_V5_Harness_Artifact_Closure_Authorization.md`,
  `ADO/04_Operations/Development_Assignment_05_V5_Runbook.md` and
  `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`.
- Changed boundary: ADO Markdown only; no executable, schema, dependency, configuration, workflow,
  script or artifact input changes.
- Risk: AVS-001 R0.
- Verification: Attempt 6 candidate review `APPROVED`; exact two-record receipt proves only its
  start/source binding and interruption. Attempt-7 authorization and its aggregate dependency/
  build/V1/V2 results are unverified; only receipt binding, Exit-2 failure, cleanup/absence and no
  artifact are verified.
- Product tests/builds/typechecks: Attempt-7 aggregate values remain Development-reported/
  unverified because required per-command IDs are missing. Attempt 8 stopped at record 8
  `EXTERNAL_LOG_CHECK`; npm exit/count evidence exists, but records 4–7 do not prove the normative
  per-command external-log isolation and the cumulative drift cannot be attributed. Records 9–41
  prove the lifecycle/V0/build/test/Typecheck/Node/Metafile/TalkBack/artifact gates omitted. No
  V3/V4/V5 ran.
- Carried evidence: source/CI evidence remains bound to `a0359a8`; no Product correctness or local
  bundle validity is inferred from it.
- Next gate: independent read-only re-review of these two P2 corrections and exact Attempt-9
  ADO-only candidate. Attempt 8 is consumed; Attempt 9 remains `REVIEW PENDING / NOT EXECUTED /
  DO NOT EXECUTE`. Hardware/Human/Product V5 remains separate and unauthorized. No commit, push or
  CI occurred.
