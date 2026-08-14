# Development Assignment 5 — V5 Human Android Gate Runbook

## 2026-08-14 Compact-Login/Invitation R2 fulfillment — PASS / INDEPENDENT R3 APPROVED / CONSUMED / HARDWARE STOP

The exact one-shot `DA5-CLIS-V3-R2` run is complete. Its published authority head is
`eb3c2d006934fe64031153834426864ffb9a5ce5`, tree
`9b024e5de558bf6be72348d9a88aa573bf37ab16`, parent
`caa4fb55c227de137d16ce4d7a39e67faafa38f0`. Immutable pre-D01 binding root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r2-pre-d01-binding-3de9b87baafb00cc6f29d44e93fdf14d`
has receipt SHA-256 `c679dbfb767f5fa4bc88c1dd5699177578a8e1ddf293b3400a68b9c66e2e164a`
and manifest SHA-256 `4dea8b66ce831f77df27422252670da460439d1f66c82118bfffb8064f7b3513`.
It binds the unchanged nine overlay blobs, resulting tree
`b61e3ec4ef2b84d36d1fb88f3c5bcc16e9042379`, and canonical 95,701-byte full-index patch
SHA-256 `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`.
The authoritative frozen bundle is bound by manifest SHA-256
`db5c8a895eb7900271d35d0c68606c7e8c6f4399b8a43fd1f3a673c5173fccf2`, independent review
receipt SHA-256 `511095747c30ef9af20b7cff7048dc1ccdeab125983358271a067927626a72e3`
and review-subject SHA-256 `6f8fda9686c5fa8f8275037c4c52f7c72b67f3b75acdb9b49b9ccfc115d55e3f`.

Receipt-bound absolute Node invoked the frozen terminal supervisor exactly once. Supervisor,
orchestrator and final-root validator each ended `exit`/`0`; the second atomic terminal-envelope
rename committed the authoritative `PASS`. Immutable inner root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r1-20260814T094123Z-3de9b87baafb00cc6f29d44e93fdf14d`
is `0555`, with 883 manifested payloads plus its manifest = 884 regular files, 217 command sets
and 868 command records. Its 2,524-byte receipt SHA-256 is
`b6124d02eecf961ad0cae1b883e2169476d955551c4a02ca932401f93a0224e5`; its 102,706-byte
manifest SHA-256 is `d63ebdef1f03c5c715ea3d87bc0c16a187b067114aada333610290a4923920e0`.
The literal `v3r1` inner path remains the reviewed R2 recipe value only.

Authoritative terminal root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r2-terminal-20260814T094123Z-3de9b87baafb00cc6f29d44e93fdf14d`
is `0555`, with two manifested payloads plus its manifest = three regular files. Its 839-byte
terminal receipt SHA-256 is
`ca48e2a7935e42906d09fd38694ab11ceebb67d5015df7f1a711fdd96adb4fc3`; its 192-byte manifest
SHA-256 is `a96119329668328e0a2a4d2f9a0f76d0f3499f46744a3fa013a06882e2c718d9`.
D01 and D02 passed; PostgreSQL 17, eleven fresh databases and all 27 migrations passed. All 20
builds, 21 tests-inclusive-Typecheck memberships/commands and 21 suites passed; suite totals are
156 files, 3,071 passed, three expected skips and zero failures. C3B, no-install preflight,
Node/JavaScript/map and artifact checks, Expo export, final V0, inventory/sealing and cleanup all
passed. Product finding is `NONE`; no ADB, installation, Product-Human or Hardware action ran.

Independent R3 execution/Evidence review `/root/review_clis_v3r2_execution` returned `APPROVED`
with zero open P0–P3 findings. R2 is consumed `PASS`, cannot be rerun, and the prospective R2
recipe below is retained as history only. The only next route is independent R0/V0 review of
these three ADO additions within the final 12-path candidate, one intentional commit/push of the
unchanged nine code/test blobs plus these three ADO blobs, one exact-head CI/V4, fresh
runtime/Operator artifact generation and independent review, then **STOP** for fresh explicit
Human/Hardware authority. There is no local V3 rerun because only these documentation blocks were
added after independent review of the byte-unchanged nine blobs.

## 2026-08-14 Compact-Login/Invitation fresh R2 frozen-orchestrator correction — REVIEW PENDING / NOT ACTIVE / HARDWARE STOP

This is the sole operative recipe for conditional `DA5-CLIS-V3-R2` and supersedes the following
R1 addendum only where this block changes authority, orchestration, inventory validation, D01
digest matching and terminal handling. Formal independent execution review classified R1
**`FAIL_CLOSED / EVIDENCE INVALID / RUNNER-VALIDATOR DEVIATION`**: outer D01 digest matcher
return code `125` was the first decision-path deviation and first pre-seal inventory-validator
return code `91` was the second. Every later technical gate is diagnostic only and cannot be
reused. The unchanged historical root, receipt and manifest are bound by the Event-Ledger top
claim; its receipt's `PASS` classification is superseded. Product finding is `NONE`, cleanup is
`PASS`, and no ADB, installation, Product-Human or Hardware action ran.

R2 may start exactly once only after the AVS-ordered independent ADO `APPROVED`, focused exact
three-document `[skip ci]` publication, independent frozen-runner-bundle `APPROVED`, and
independent exact-head review/receipt. That receipt supplies the sole admissible ADO head/tree,
three ADO blobs, unchanged nine overlay blobs, resulting combined tree, 95,701-byte canonical
nine-path full-index patch SHA-256
`948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`, and exact runner-bundle
bindings. R2 creates fresh task, worktree, PostgreSQL and Evidence roots and begins at D01. No R1
result, process, database, path, file, gate or observation is reused, retried or resumed.

Except for the explicit supersessions in this block, every exact tool, CWD, argv, environment,
port, PostgreSQL, migration, 20/21/21, artifact, Expo, final-V0 and cleanup requirement in the
immediately following R1 addendum applies unchanged and in the same order. Its remaining
`v3r1` path and public fixture literals stay literal recipe values; they do not restore R1
authority. No alternative command matrix, external override or implicit default exists.

### Frozen runner bundle, terminal supervisor and direct orchestration

The frozen bundle must contain `terminal-supervisor.mjs`, `orchestrator.mjs`,
`inventory-validator.mjs`, `run-plan.json`, the validator and terminal-supervisor self-/fault-test
sources and immutable receipts, the independent `APPROVED` review receipt, and
`evidence-manifest.txt`. The manifest names every exact relative path and binds every other bundle
payload by bytes, mode and SHA-256; only the manifest excludes itself. All regular payloads,
including every receipt, are `0444`; all directories are `0555`. The exact-head receipt binds the
final bundle manifest metadata, every payload binding, the run ID, canonical final inner root and
three canonical same-filesystem terminal-envelope paths: fresh stage, nonauthoritative pending and
final. All three are receipt-prebound and initially absent. Before the first pre-port command and
D01, the exact bundle is copied into fresh run Evidence and its bytes, hashes, modes and paths are
proved identical.

Only receipt-bound absolute Node may invoke receipt-bound `terminal-supervisor.mjs`, which is the
sole entrypoint; an external/ad-hoc wrapper, direct orchestrator invocation, monolithic shell
runner or substitute plan is forbidden. The supervisor directly spawns the receipt-bound
`orchestrator.mjs` with receipt-bound `run-plan.json`, `shell: false`, and awaits its true terminal
state. The orchestrator must use `shell: false` and spawn every preflight, D01/D02, database,
migration, build, Typecheck, suite, artifact, Expo, V0, cleanup, inner sealing and pre-rename
validation gate as its own separate direct, sequential and awaited child. It records each child's
actual terminal kind and return code before the next child. The first failed or ambiguous gate
stops technical execution and enters only required cleanup and Evidence finalization.

The orchestrator's disclosure-safe inner `receipt.txt` must classify only
`TECHNICAL_GATES_COMPLETE_PENDING_TERMINAL_ENVELOPE`, never `PASS`. After it atomically publishes
the immutable final inner root and terminates, the supervisor requires orchestrator terminal kind
`exit` and code `0`. It then independently directly spawns the receipt-bound
`inventory-validator.mjs` against that final root with `shell: false`, awaits the true terminal,
and requires kind `exit`/code `0`. The supervisor independently verifies exact run ID, bound
canonical final-root path, manifest byte count/mode/SHA-256, and complete root/directory/file
mode/path inventory. Neither the inner root nor either successful child terminal alone authorizes
`PASS`.

### Exact inventory-validator and D01-digest contract

The bundle cannot receive independent `APPROVED` until its validator negative tests and receipt
prove rejection of every forbidden case below and success of the sole valid fixture. At each
receipt-bound phase the validator uses `lstat`, requires the bound canonical root, rejects path
escape and symlinks, requires every root/entry on the same device, and requires every
`(st_dev, st_ino)` pair to be unique. Every regular file has `nlink == 1`; directories have no
link-count requirement. Every entry must have the phase-exact regular-file or directory type and
mode; hard links, FIFOs, sockets and every other type are rejected.

Each manifest is strict LF-terminated, sorted and unique by canonical relative path, with exactly
four fields per row: SHA-256, decimal byte count, four-digit mode and relative path. It covers
every regular payload and excludes only itself. Duplicate or unsorted rows, duplicate paths,
missing or extra entries, path escape, type/device/inode/link-count mismatch, and hash, byte or
mode drift are rejection conditions. The orchestrator must run the exact validator for pre-seal
inventory and again after payload `0444`/directory `0555` chmod. After the same-filesystem inner
atomic rename and the orchestrator's true successful terminal, the supervisor independently runs
the exact validator against the final root; post-chmod and final-root validations require
identical manifest coverage and payload bytes.

The D01 digest matcher is a separate direct awaited child. Success requires both its terminal kind
`exit`/code `0` and programmatic equality of the observed and receipt-bound expected digest; grep,
shell marker text or output-presence inference is forbidden. Any outer matcher/orchestrator
nonzero terminal, signal, timeout, missing return code or digest inequality is terminal failure.

### Non-circular terminal-envelope commit

Only after both awaited children and every independent binding check above pass may the supervisor
create a fresh separate terminal-envelope stage at its receipt-prebound canonical absent path.
Stage, nonauthoritative pending and final are three distinct receipt-prebound canonical paths in
one reviewed same-filesystem atomic-rename domain and must all be absent initially; any
preexistence is terminal failure. The supervisor writes disclosure-safe `terminal-receipt.txt`
containing exactly the bound `run_id`, orchestrator terminal kind/code, final-validator terminal
kind/code, canonical final inner-root path plus its manifest bytes/mode/SHA-256, result `PASS`, and
the bound terminal-supervisor/orchestrator/validator/plan bundle digests. No secret or Product
data enters the envelope.

The supervisor writes the envelope manifest covering `terminal-receipt.txt` and every other
regular envelope input, excluding only that manifest; chmods every payload `0444` and every
directory `0555`; validates exact manifest coverage, bytes, hashes, types, modes, device/inode and
path inventory; and atomically renames sealed stage to the prebound absent pending path while final
remains absent. It then fully rereads and validates pending, including the exact receipt, path
inventory, bytes, modes and SHA-256 values. Stage and pending are nonauthoritative even when their
complete receipt says `PASS`; every consumer must reject them and accept only the exact prebound
final path.

Only after pending fully passes may the supervisor atomically rename pending to the prebound absent
final path. That second rename is the sole terminal authority and commit point and is the final
operation affecting authority, classification, state or Evidence. The exact reviewed
same-filesystem rename semantics and prevalidated pending bytes make final authoritative on
successful second rename; no required reread, fallible validation, cleanup or classification
operation follows it. Supervisor process return after commit is informational and is not a second
authority. Successful commit has stage/pending absent and final present; only that exact final
envelope together with its referenced immutable inner Evidence root proves R2 `PASS`.

Before the second rename, any supervisor/orchestrator/validator nonzero exit, signal, timeout,
missing terminal/return code, validation or seal error, manifest/root drift, write/chmod fault,
first-rename fault, pending reread/validation fault or second-rename fault is `FAIL_CLOSED` and
must leave final absent. Any stage or pending root is nonauthoritative regardless of completeness;
cleanup success cannot repair the failure.

Before frozen-bundle `APPROVED`, receipt-bound fault tests must cover orchestrator nonzero exit,
signal and timeout; validator nonzero exit; manifest/root drift; stage, pending or final-path
preexistence; envelope write/chmod faults; first-rename faults; pending reread/validation faults;
and second-rename faults. Every case must prove final absent until the successful second rename;
that success must prove stage/pending absent and final present. The test sources/results and
immutable receipt are bundle payloads and must themselves match the reviewed manifest.

Every R2 failure, interruption or ambiguity consumes `DA5-CLIS-V3-R2`; there is no retry, resume
or replacement. Green proceeds only to independent R3 execution/Evidence review and then
**STOPS before Supervisor, ADB, installation, Product-Human and Hardware**.

## 2026-08-14 Compact-Login/Invitation fresh replacement V3 — REVIEW PENDING / NOT ACTIVE / HARDWARE STOP

This addendum is the sole operative contract for conditional `DA5-CLIS-V3-R1`. The consumed first
final V3 was bound to unchanged candidate tree `534b1bfed4696833d2e6994af7e2eb2590b37388`
and canonical nine-path full-index patch 95,701 bytes / SHA-256
`948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`. D01/D02 and the
PostgreSQL 17.10 plus eleven-database gates passed; the first migration failed before 001 with
SQLSTATE `42501` because the ad-hoc bootstrap's separate installer LOGIN role lacked the
CI-equivalent role-creation privilege. No code/Product finding exists. No later gate, ADB,
installation, Product-Human or Hardware action ran, and cleanup passed. The exact immutable root,
receipt and manifest are bound by the Event-Ledger top claim. Its preflight port stdout lacks
separately immutable return codes; complete post-cleanup proof does not retroactively repair that
gap.

Independent Review Round 1 used exact combined 12-path tree
`468ae43e2bf18914bef9a08c6b65c8ff7b9ff932` and canonical full-index patch 109,107 bytes /
SHA-256 `aafe63a4bc156c5204820d9784cd7cba9e483e2353e7bde88b9cc76016c0f509`, then returned
`CHANGES REQUIRED` for deterministic-runner and activation-binding gaps. Those values are
Round-1 input only; this correction changes the three ADO blobs and therefore cannot reuse them
as the final Pre-D01 target.

Only after independent ADO `APPROVED`, focused publication of exactly these three ADO documents
with `[skip ci]`, and independent exact-head review may `DA5-CLIS-V3-R1` start once. That review's
immutable receipt must bind the published ADO commit/tree, all three published ADO blob IDs, all
nine unchanged executable/test overlay blob IDs, the resulting final combined candidate tree,
and the canonical nine-path overlay patch byte count/SHA-256 relative to the published ADO head.
Those external exact values are the sole Pre-D01 target. Missing/ambiguous receipt/value is
`STOP`; do not infer or invent a placeholder/hash. Create a full **normal, non-sparse** detached
worktree at the receipt-bound ADO commit, overlay exactly the receipt-bound nine blobs and require
the resulting tree to equal the receipt-bound final tree. The unchanged V2 and pre-V3 R3
`APPROVED` are preconditions only. No failed-run gate, result, process, PostgreSQL cluster/
database, task/worktree/Evidence root, file or observation is copied or reused.

Create a fresh `mkdtemp` task root under `/private/tmp` with prefix
`taptime-da5-clis-v3r1-`; bind its absolute value as `$TASK_ROOT`. Bind the final worktree root as
`$CANDIDATE_CWD`, then define `$TASK_HOME=$TASK_ROOT/home`, `$TASK_TMP=$TASK_ROOT/tmp`,
`$NPM_CACHE=$TASK_ROOT/npm-cache`, `$NPM_USERCONFIG=$TASK_ROOT/npmrc-user`,
`$NPM_GLOBALCONFIG=$TASK_ROOT/npmrc-global`, `$PGDATA=$TASK_ROOT/postgres/data`,
`$PGLOG=$TASK_ROOT/postgres/postgresql.log`, `$PGSOCKET=$TASK_ROOT/postgres/socket` and
`$EXPO_OUT=$TASK_ROOT/expo-out`; fixed `$POST_CLEANUP_CWD=/private/tmp` must remain an existing
directory through final Evidence capture. Create all task-owned directories fresh. Both npmrc
files are empty `0444` files with SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

### Exact tool and immutable recipe bindings

| Tool | Bytes / mode / SHA-256 |
|---|---|
| `/opt/homebrew/opt/postgresql@17/bin/initdb` | 213,936 / `0555` / `43f864de4746e096246a2a9f9784ccbd7364b35b2301b82aeeb6d2a12c1912c4` |
| `/opt/homebrew/opt/postgresql@17/bin/pg_ctl` | 116,432 / `0555` / `ba12d9fbe4492e3ab0e8bcedd53e3a0da8163fd8c2cef340dfaf619af0e132c5` |
| `/opt/homebrew/opt/postgresql@17/bin/pg_isready` | 136,352 / `0555` / `a28e468c1ac200dee1d56f02d1436dfe2e799371a8c4448d5a2540efeb80dabb` |
| `/opt/homebrew/opt/postgresql@17/bin/createdb` | 137,312 / `0555` / `8a997310fc83db360751187ba8e4aff8b123751a60c1abbac36687dba9f467b6` |
| `/opt/homebrew/opt/postgresql@17/bin/psql` | 728,912 / `0555` / `bb4ef660720948d242d8c4e32450ae5607241510dc8f06cf685048e4c493447d` |
| `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node` | 120,591,840 / `0755` / `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601` |
| `/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js` | 54 / `0755` / `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| `/usr/sbin/lsof` | 307,600 / `0755` / `28c36d6b6dfcce1f544717b0d1961aa03441ee0a736fee3e1eaeb215c0fbff4c` |
| `/usr/bin/git` | 118,928 / `0755` / `179301dcb41ea78accc3fa0048a7e6f6710d891945a751a34addd622020c1818` |
| `/usr/bin/stat` | 118,768 / `0755` / `934656def5cfb8e85b2e4d983bb59ba97479cec49b63b4ea2fa42d067c569242` |
| `/usr/bin/shasum` | 9,979 / `0755` / `0812595f981a26f813d98dc380af14d4af427626c9339eda29eb849ae13de1e3` |

Before the first port preflight, independently re-stat and SHA-256 every table row and require an
exact match; a symlink/path/size/mode/digest mismatch is `STOP` before D01.

Two immutable historical files are byte-bound normative inputs only for command structure,
environment-name matrix and workspace order, never for prior results: `execution-matrix.txt` at
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-fast-d8a7-v3d-OCGEwA2H/execution-matrix.txt`
(3,646 bytes / `0444` / SHA-256
`e9060f6a1019b7eeeea0f052dc5b72caf2fae0d616d0ebc3614970b96ba3bc1d`) and
`runner-record.txt` at
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-9380758-corrected-4r21J4/runner-record.txt`
(2,839 bytes / `0444` / SHA-256
`5b23c0308ff5ca3cde791538b60a2092dafcf2b52878bf416ea6511339907921`). Consumed historical
authority does not consume these instruction bytes. Their historical CWD, candidate, Expo paths,
ports 55439 and cleanup-port literals are non-operative; this top addendum's receipt-bound paths
and fixed port 55436 supersede them.

### Persistent external Evidence contract

Set exact
`$EVIDENCE_PARENT=/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5` and require it
to be an existing real directory outside `$TASK_ROOT` and `$CANDIDATE_CWD`. Before D01 derive one
fresh canonical 32-lowercase-hex nonce and bind
`$EVIDENCE_STAGE=$EVIDENCE_PARENT/.da5-clis-v3r1-stage-<nonce>` plus
`$EVIDENCE_FINAL=$EVIDENCE_PARENT/da5-clis-v3r1-<UTC-YYYYMMDDTHHMMSSZ>-<nonce>`. Require both
paths absent, create only `$EVIDENCE_STAGE` as mode `0700`, and leave `$EVIDENCE_FINAL` absent
until atomic publication. The stage root is never inside or removed with the task root. Define
fresh mode-`0700` `$D01_LOGS=$EVIDENCE_STAGE/npm-debug/d01` and
`$D02_LOGS=$EVIDENCE_STAGE/npm-debug/d02`; npm writes both raw debug logs directly to persistent
external Evidence.

Every preflight, execution gate and cleanup child through the four post-cleanup `lsof` commands
writes four files directly beneath `$EVIDENCE_STAGE/commands` before the next child:
`NNN-<gate>.meta` with exact CWD, literal argv and sorted environment **names**; corresponding
`NNN-<gate>.stdout.log`, `NNN-<gate>.stderr.log` and `NNN-<gate>.rc` with the exact decimal return
code plus LF. No secret value enters metadata, output or filenames. A missing write, noncanonical
name/order, duplicate sequence number or output/RC mismatch is terminal `FAIL_CLOSED`.

On every PASS, failure, signal, timeout or ambiguity, stop further gates and execute exactly:

1. Complete the bound PostgreSQL/worktree/task-root cleanup and write all four post-`lsof`
   command records directly to the external stage.
2. Write one disclosure-safe `receipt.txt` binding final classification, cleanup state, reviewed
   commit/tree/blob/overlay values, gate counts and omissions; never include credentials, runtime
   fixture values, raw device identifiers or raw Product/database records.
3. Inventory the stage by sorted relative pathname. Reject symlinks, sockets, devices, FIFOs,
   hard-link multiplicity, unexpected/nonregular files and any path not created by this run.
4. Set every existing regular payload file, including the receipt, to `0444`. Then write
   `evidence-manifest.txt` with one LF-terminated row per other regular file, sorted by relative
   pathname and containing SHA-256, byte count, exact `0444` mode and relative path; set the
   completed manifest itself to `0444`. The manifest is the sole intentionally self-excluded
   regular file; it is never called an extra.
5. Set every directory, including the stage root, to `0555`. Reinventory and reject any
   byte/path/type/mode drift or any payload row whose path, size, mode or SHA no longer matches.
6. Compute and retain the manifest's exact future final path, byte count, `0444` mode and SHA-256,
   then atomically rename the same sealed root from `$EVIDENCE_STAGE` to the previously absent
   `$EVIDENCE_FINAL` on the same filesystem.
7. Fully reread from `$EVIDENCE_FINAL`: require stage absent; root/directories `0555`; no symlink,
   nonregular or unlisted payload; every payload byte count/mode/SHA equal to its manifest row;
   and manifest path/bytes/mode/SHA equal to the retained publication result.

Only that fully reread sealed final root and its retained final manifest metadata are authority.
Any cleanup, receipt, inventory, chmod, manifest, atomic-rename or reread failure leaves the run
`FAIL_CLOSED / EVIDENCE INVALID`, never PASS; no unsealed stage or task-local copy is reusable.

Execute every gate as a separate direct, sequential, awaited process call; a monolithic/ad-hoc
runner, sparse checkout or inherited/global phase environment is forbidden. Every child starts
with this exact `/usr/bin/env -i` base, in this order:
`HOME=$TASK_HOME TMPDIR=$TASK_TMP PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin USER=timbartz LOGNAME=timbartz SHELL=/bin/zsh`.
Every `$...` token below is replaced before direct process spawn by its already receipt-bound
absolute literal; there is no shell evaluation. Unlisted names are absent.

D01 and D02 run from exact CWD `$CANDIDATE_CWD`. Their only overlay is
`NPM_CONFIG_CACHE=$NPM_CACHE NPM_CONFIG_USERCONFIG=$NPM_USERCONFIG
NPM_CONFIG_GLOBALCONFIG=$NPM_GLOBALCONFIG NPM_CONFIG_LOGS_DIR=$D01_LOGS` (or `$D02_LOGS`),
`NPM_CONFIG_LOGS_MAX=1 NPM_CONFIG_LOGLEVEL=verbose
npm_node_execpath=/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node
npm_execpath=/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js`.
After base and overlay, D01 argv is
`/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node
/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js ci --no-audit
--no-fund`; D02 is the same absolute pair followed by `ls --all --json`. D02 starts only after
D01 terminal success, installed-manifest/root-lock verification and immediate retention/hash of
the sole raw D01 debug log. Retain/hash the sole raw D02 log before PostgreSQL. Missing/rotated/
unreadable raw log or any exact CWD/argv/environment/stdout/stderr/return-code field is `STOP`.

Before D01, run four distinct commands from CWD `$CANDIDATE_CWD`, one per port 3000, 54321, 55435
and 55436. Each exact argv is `/usr/bin/env -i`, the exact base above, then
`/usr/sbin/lsof -nP -iTCP:<port> -sTCP:LISTEN`. After PostgreSQL stop plus confirmed worktree and
task-root removal, run the same four port-specific `lsof` argv from fixed CWD
`$POST_CLEANUP_CWD`, but with fixed post-removal base
`HOME=/private/tmp TMPDIR=/private/tmp PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin USER=timbartz LOGNAME=timbartz SHELL=/bin/zsh`.
Retain each literal argv, CWD, stdout, stderr and return code separately. Only return code 1 with
empty stdout and stderr is `MATCH`; missing CWD/tool, combined/missing return codes or any output
is `STOP`/cleanup `UNVERIFIED`.

### Exact fresh PostgreSQL recipe

Use fixed loopback `127.0.0.1:55436` and exact PostgreSQL `17.10`. Every PostgreSQL-tool child has
exact argv prefix `/usr/bin/env -i`, the exact base above, then sole overlay `LC_ALL=C`; all
`LANG`, `LANGUAGE`, other `LC_*`, `PG*` and `PQ*` names are absent. `LC_ALL` is removed before
every Node/npm child. From CWD `$CANDIDATE_CWD`, run these direct argv templates in order:

1. `/opt/homebrew/opt/postgresql@17/bin/initdb --pgdata=$PGDATA --locale=C --encoding=UTF8
   --username=timbartz --auth=trust`.
2. `/opt/homebrew/opt/postgresql@17/bin/pg_ctl --pgdata=$PGDATA --log=$PGLOG
   --options=-h 127.0.0.1 -p 55436 -k $PGSOCKET --wait --timeout=60 start`, where the complete
   text after `--options=` is one argv element after receipt-bound path substitution.
3. `/opt/homebrew/opt/postgresql@17/bin/pg_isready --host=127.0.0.1 --port=55436
   --username=timbartz --dbname=postgres --timeout=5`; require exit 0 and `accepting connections`.
4. `/opt/homebrew/opt/postgresql@17/bin/psql --no-psqlrc --tuples-only --no-align
   --set=ON_ERROR_STOP=1 --host=127.0.0.1 --port=55436 --username=timbartz --dbname=postgres
   --command=<role-query>`, where `<role-query>` is exactly `SELECT current_user, rolsuper,
   rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls FROM pg_roles WHERE
   rolname=current_user;`; require the sole trimmed row `timbartz|t|t|t|t|t`.

Create no separate installer role. Execute the following exact `createdb` argv template once per
database, as eleven separate awaited children in the listed order:
`/opt/homebrew/opt/postgresql@17/bin/createdb --host=127.0.0.1 --port=55436
--username=timbartz --owner=timbartz --encoding=UTF8 --template=template0 <database>`.

Create exactly these eleven fresh databases, each with owner `timbartz`:
`taptime_b1`, `taptime_synthetic_android_e2e`, `taptime_b4`, `taptime_b5`, `taptime_b6`,
`taptime_c2`, `taptime_c3b`, `taptime_c3c`, `taptime_offline_sync`, `taptime_da2` and
`taptime_da3`. Then run one PostgreSQL-prefixed `psql` owner attestation with the same connection
argv as step 4 and exact query `SELECT string_agg(datname || '=' || pg_get_userbyid(datdba), ','
ORDER BY datname) FROM pg_database WHERE left(datname,8)='taptime_';`. Require exactly:
`taptime_b1=timbartz,taptime_b4=timbartz,taptime_b5=timbartz,taptime_b6=timbartz,taptime_c2=timbartz,taptime_c3b=timbartz,taptime_c3c=timbartz,taptime_da2=timbartz,taptime_da3=timbartz,taptime_offline_sync=timbartz,taptime_synthetic_android_e2e=timbartz`.
Thus there is no `taptime_b3` or extra task database. `taptime_b1` and `taptime_c3b` remain
outside the 27-command migration matrix.

Each migration is a fresh Node/npm child from `$CANDIDATE_CWD` with `/usr/bin/env -i`, the exact
base, then only `B3_DATABASE_URL=<row-url>`; no locale or npm overlay. For each row, invoke exactly
twice `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node
/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js run migrate
--workspace=@taptime/backend-schema`, then once the same absolute pair with
`run verify-migrations --workspace=@taptime/backend-schema`:

| Boundary | Exact database URL |
|---|---|
| Synthetic (B3) | `postgresql://timbartz@127.0.0.1:55436/taptime_synthetic_android_e2e` |
| B4 | `postgresql://timbartz@127.0.0.1:55436/taptime_b4` |
| B5 | `postgresql://timbartz@127.0.0.1:55436/taptime_b5` |
| B6 | `postgresql://timbartz@127.0.0.1:55436/taptime_b6` |
| C2 | `postgresql://timbartz@127.0.0.1:55436/taptime_c2` |
| C3C | `postgresql://timbartz@127.0.0.1:55436/taptime_c3c` |
| Offline Sync | `postgresql://timbartz@127.0.0.1:55436/taptime_offline_sync` |
| DA2 | `postgresql://timbartz@127.0.0.1:55436/taptime_da2` |
| DA3 | `postgresql://timbartz@127.0.0.1:55436/taptime_da3` |

This is exactly nine triplets/27 commands. Any count, owner, role, URL, version, locale or port
mismatch is `STOP`; do not repair it in-place.

### Exact 20/21/21 command and environment matrix

Every build, Typecheck and suite runs from CWD `$CANDIDATE_CWD` and uses `/usr/bin/env -i` plus
the exact base and absolute Node/npm pair. Builds use `run build --workspace=<workspace>` in this
exact 20-entry order:
`@taptime/administration-contract`, `@taptime/mobile-work-contract`,
`@taptime/offline-sync-contract`, `@taptime/time-entry-export-contract`,
`@taptime/time-review-contract`, `@taptime/core`, `@taptime/backend-schema`,
`@taptime/backend-identity`, `@taptime/backend-b1-spike`, `@taptime/backend-mobile-work`,
`@taptime/backend-read-model`, `@taptime/backend-lifecycle`,
`@taptime/backend-administration`, `@taptime/backend-bootstrap`,
`@taptime/backend-offline-sync`, `@taptime/backend-time-review`,
`@taptime/backend-time-export`, `@taptime/backend-api`, `@taptime/admin-web`,
`@taptime/synthetic-android-e2e`.

Tests-inclusive Typechecks use `run typecheck --workspace=<workspace> -- --listFiles` in this exact
21-entry order: the build order through `@taptime/admin-web`, then `@taptime/mobile`, then
`@taptime/synthetic-android-e2e`. Each retained `--listFiles` membership must prove its expected
source/test boundary before the next command.

Suites use `test --workspace=<workspace>` in this exact 21-entry order:
`@taptime/administration-contract`, `@taptime/core`, `@taptime/mobile-work-contract`,
`@taptime/offline-sync-contract`, `@taptime/time-entry-export-contract`,
`@taptime/time-review-contract`, `@taptime/admin-web`, `@taptime/mobile`,
`@taptime/backend-b1-spike`, `@taptime/backend-schema`, `@taptime/backend-identity`,
`@taptime/backend-read-model`, `@taptime/backend-lifecycle`,
`@taptime/backend-offline-sync`, `@taptime/backend-mobile-work`, `@taptime/backend-api`,
`@taptime/backend-bootstrap`, `@taptime/backend-administration`,
`@taptime/backend-time-export`, `@taptime/backend-time-review`,
`@taptime/synthetic-android-e2e`. Only the final Synthetic argv adds
`-- --no-file-parallelism`.

Build and Typecheck overlays are empty. Suite overlays are exactly the fixed assignments below;
there is no external plan or implicit/default value. These values are public disposable local
nonproduction fixtures, never a Product/Hardware Credential and never reusable outside this V3.

| Suite workspace | Exact additions to base |
|---|---|
| all unlisted rows | none |
| `@taptime/backend-b1-spike` | `B1_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_b1`; `B1_RUNTIME_PASSWORD=da5-clis-v3r1-b1-runtime-only`; `B1_RUNTIME_DATABASE_URL=postgresql://taptime_b1_runtime:da5-clis-v3r1-b1-runtime-only@127.0.0.1:55436/taptime_b1` |
| `@taptime/backend-schema` | `B3_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_synthetic_android_e2e` |
| `@taptime/backend-identity` | `B4_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_b4`; `B4_RUNTIME_PASSWORD=b4-local-synthetic-only` |
| `@taptime/backend-read-model` | `B5_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_b5`; `B5_RUNTIME_PASSWORD=b5-local-synthetic-only` |
| `@taptime/backend-lifecycle` | `B6_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_b6`; `B6_RUNTIME_PASSWORD=b6-local-synthetic-only` |
| `@taptime/backend-offline-sync` | `OFFLINE_SYNC_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_offline_sync` |
| `@taptime/backend-mobile-work` | `DA5_MOBILE_WORK_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_offline_sync` |
| `@taptime/backend-api` | `C2_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_c2` |
| `@taptime/backend-bootstrap` | `C3B_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_c3b` |
| `@taptime/backend-administration` | `C3C_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_c3c` |
| `@taptime/backend-time-export` | `DA2_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_da2`; `DA2_RUNTIME_PASSWORD=da2-local-synthetic-only` |
| `@taptime/backend-time-review` | `DA3_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_da3`; `DA3_RUNTIME_PASSWORD=da3-local-synthetic-only` |
| `@taptime/synthetic-android-e2e` | `TAPTIME_SYNTHETIC_E2E_DATABASE_URL=postgresql://timbartz@127.0.0.1:55436/taptime_synthetic_android_e2e`; `TAPTIME_DA5_V5_PRODUCT_APK_REACHABILITY=required`; `TAPTIME_DA5_V5_CI_OWNER_RECORD` absent |

### Exact post-build and post-suite bundle gates

Immediately after build 20 and again immediately after suite 21, require these exact regular
files; no rebuild occurs between the two attestations:

| File | Exact bytes / SHA-256 / source-map semantics |
|---|---|
| `$CANDIDATE_CWD/apps/synthetic-android-e2e/dist/da5V5Main.js` | 981,670 / `f480968a588e15bf974c172615edc0778fc4679088f6ccc86a5cdafecb5b00c1` |
| `$CANDIDATE_CWD/apps/synthetic-android-e2e/dist/da5V5Main.js.map` | 1,904,949 / `1c4c8e791eea704b2cb135fc77b2ef1f3d9cda3fa11898fdfa8f8de106fe2768`; v3; `sourceRoot` absent; 93 `sources`; 93 `sourcesContent`; 334 `names` |
| `$CANDIDATE_CWD/apps/synthetic-android-e2e/dist/da5V5FlightMain.js` | 163,638 / `eda3a6e407a07f6d923c62c3c7591a1bb79a2232e87a5b265ab77a7c419fe023` |
| `$CANDIDATE_CWD/apps/synthetic-android-e2e/dist/da5V5FlightMain.js.map` | 453,423 / `1b0fbead6b33599c42567031f0eb113babbbfeb24317ba59e90f16e8e3529dbc`; v3; `sourceRoot` absent; 16 `sources`; 16 `sourcesContent`; 38 `names` |

For each file, from `$CANDIDATE_CWD`, run exact-base direct children `/usr/bin/stat -f %z
<absolute-file>` and `/usr/bin/shasum -a 256 <absolute-file>` and require the table's decimal size
and first SHA field. For each map, run exact-base argv
`/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --input-type=module
--eval=<map-verifier> <absolute-map> <sources> <sourcesContent> <names>`, where the exact one-line
`<map-verifier>` argv element is:

```text
import{readFile}from'node:fs/promises';const[p,s,c,n]=process.argv.slice(1);const m=JSON.parse(await readFile(p,'utf8'));if(m.version!==3||Object.hasOwn(m,'sourceRoot')||!Array.isArray(m.sources)||m.sources.length!==Number(s)||!Array.isArray(m.sourcesContent)||m.sourcesContent.length!==Number(c)||!Array.isArray(m.names)||m.names.length!==Number(n))process.exit(97);
```

### Exact remaining gates and final V0

After the post-suite bundle gate, run in order:

1. C3B from `$CANDIDATE_CWD` with exact base then absolute Node/npm plus `run verify-bin
   --workspace=@taptime/backend-bootstrap`.
2. The sole APK/tool inspection gate: exact base plus only
   `ANDROID_HOME=/Users/timbartz/Library/Android/sdk`,
   `ANDROID_SDK_ROOT=/Users/timbartz/Library/Android/sdk` and
   `TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5`, then exact argv
   `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node
   $CANDIDATE_CWD/apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`. No other APK/tool
   inspection or APK build is permitted.
3. Two separate exact-base argv from `$CANDIDATE_CWD`:
   `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check
   apps/synthetic-android-e2e/dist/da5V5Main.js`, then the same with `da5V5FlightMain.js`.
4. Expo from CWD `$CANDIDATE_CWD/apps/mobile` with exact base plus
   `APP_VARIANT=synthetic-e2e`, `EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT=synthetic-e2e`,
   `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`,
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_taptime_synthetic_android_e2e`,
   `EXPO_PUBLIC_TAPTIME_API_BASE_URL=http://127.0.0.1:3000` and
   `EXPO_PUBLIC_TAPTIME_DEMO_MODE=false`, then exact argv
   `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node
   $CANDIDATE_CWD/node_modules/expo/bin/cli export --platform android --output-dir $EXPO_OUT
   --clear`.
5. Final V0 below. Unknown/extra environment names or values are `STOP`; there is no external
   candidate/run-plan artifact. Preserve expected-skip rules. No ADB or install exists in V3.

For final V0, take `$ADO_COMMIT`, `$ADO_TREE`, three ADO blob IDs, nine overlay blob IDs,
`$FINAL_TREE`, `$OVERLAY_PATCH_BYTES` and `$OVERLAY_PATCH_SHA256` only from the mandatory
exact-head receipt. Define fresh `$FINAL_INDEX=$TASK_ROOT/final-v0.index`. Using exact base plus
only `GIT_INDEX_FILE=$FINAL_INDEX`, directly run `/usr/bin/git read-tree $ADO_COMMIT`, then
`/usr/bin/git add --` with exactly these nine paths in this order:
`apps/synthetic-android-e2e/src/Da5V5FlightController.ts`,
`apps/synthetic-android-e2e/src/da5V5Main.ts`,
`apps/synthetic-android-e2e/src/Da5V5CredentialTransfer.ts`,
`apps/synthetic-android-e2e/src/Da5V5InvitationSecret.ts`,
`apps/synthetic-android-e2e/tests/Da5V5FlightController.test.ts`,
`apps/synthetic-android-e2e/tests/Da5V5CredentialTransfer.test.ts`,
`apps/synthetic-android-e2e/tests/Da5V5InvitationSecret.test.ts`,
`apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts`,
`apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts`; then run
`/usr/bin/git write-tree` and require sole stdout `$FINAL_TREE`.

From `$CANDIDATE_CWD`, use exact-base `/usr/bin/git ls-tree $ADO_COMMIT --` for the three ADO
paths and require the receipt's three blobs; run `/usr/bin/git hash-object -- <path>` separately
for every overlay path and require its receipt blob. Run exact-base `/usr/bin/git diff --check
$ADO_COMMIT $FINAL_TREE -- <nine paths>` and require RC 0 with empty stdout/stderr. Finally run
exact-base `/usr/bin/git diff --full-index --binary $ADO_COMMIT $FINAL_TREE -- <nine paths>` with
its raw stdout written directly as the command's external Evidence stdout file; exact-base
`/usr/bin/stat -f %z` and `/usr/bin/shasum -a 256` of that file must equal
`$OVERLAY_PATCH_BYTES`/`$OVERLAY_PATCH_SHA256`. Also require exact-base `/usr/bin/git rev-parse
$ADO_COMMIT^{tree}` equals `$ADO_TREE`. Any blob, diff, byte, SHA, tree, argv/tool or Evidence
mismatch is `STOP`; only all matches complete V0.

During cleanup, if PostgreSQL started, run the PostgreSQL-prefixed exact argv
`/opt/homebrew/opt/postgresql@17/bin/pg_ctl --pgdata=$PGDATA --wait --timeout=60 --mode=fast
stop` and require terminal exit. Then deregister/remove only the receipt-bound worktree, remove
only the receipt-bound task root, separately attest both absent, require existing
`$POST_CLEANUP_CWD`, and only then execute the four separate post-cleanup `lsof` commands there
with the fixed post-removal base above. Cleanup uncertainty is never `PASS`.

Every failure, interruption or ambiguity consumes `DA5-CLIS-V3-R1`; no retry, resume or second
replacement is authorized. Green proceeds only to independent R3 execution/Evidence review and
then **STOPS before Supervisor, ADB, installation, Product-Human and Hardware**.

## 2026-08-14 invitation-secret source/transfer procedure amendment — REVIEW PENDING / STOP

This R0/V0 top candidate is bound to clean `HEAD == main == origin/main ==
b36d2795afd9d0a6bd8e597203ae05c2c8a8aeb6`, tree
`eb4e1e1872f017ec377fb48a7fb31b5a67bbb5e0`. The b36 R3 read-only preflight found no exact DA5
source or safe transfer procedure for `Einladungsgeheimnis` and therefore stopped before edits,
tests, builds or execution. This procedure is **not active** before independent R0 approval,
focused `[skip ci]` publication and independent exact-head review. It grants no Supervisor, ADB,
installation, Product-Human or Hardware run.

After the combined Administrator login result is `PASS`, machine automation creates exactly one
task-owned invitation through the already-running real loopback stack:

1. Require the exact environment-provided `http://127.0.0.1:<bound-port>` Auth origin. Send one
   `POST /auth/v1/token?grant_type=password` using public
   `administrator-e2e@example.invalid`, public
   `sb_publishable_taptime_synthetic_android_e2e` and the existing memory-only password.
2. Strictly bind HTTP 200, exact `Cache-Control: no-store`, no redirect and the exact local
   Synthetic Administrator session response. Retain its bearer token only in memory.
3. Require the exact environment-provided loopback API origin. Send one `POST
   /v1/administration/employee-invitations` with that bearer token and exactly
   `{"expectedMembershipId":"12000000-0000-4000-8000-000000000702","commandId":"<fresh
   canonical random UUID>","displayName":"DA5 V5 Synthetic Employee"}`.
4. Accept only HTTP 200, exact `Cache-Control: no-store`, no redirect and an exact three-key
   response `{"status":"succeeded","invitationSecret":"<secret>","expiresAt":"<time>"}`.
   Expiry is canonical and strictly future; `<secret>` is exactly 43 canonical unpadded base64url
   characters decoding to exactly 32 bytes, including canonical pad bits.

Immediately before step 1 require enrollment counts `active=0`, `consumed=0`,
`invitationReceipts=0`, `redemptionReceipts=0`. Immediately after step 4 require `active=1`,
`consumed=0`, `invitationReceipts=1`, `redemptionReceipts=0`. A second call, redirect, unexpected
origin/port, timeout, response/header/schema mismatch or count drift is fail-closed.

The separate one-shot invitation owner accepts only that canonical secret. It must reject the
64-hex password master before opening any ADB transfer, then send the invitation exactly once by
bound non-PTY ADB stdin to the already active empty `Einladungsgeheimnis` field. It never uses
clipboard, environment, argv, file, terminal output, log, Evidence, artifact manifest or IPC.
Every Operator-owned secret/candidate/frame Buffer is overwritten after success and on every
failure, abort, exception and cleanup; reuse/reset is forbidden. Only the password uses existing
FD3. Strict HTTP/JSON handling necessarily creates brief JavaScript access-token and invitation-
secret strings. They are nonloggable and nonpersistent, their references are dropped immediately,
and byte-zeroization is not claimed; owned Buffer copies are zeroized.

The exact operator sequence is:

1. Administrator combined result reaches its expected surface; machine creates and binds the
   invitation once.
2. On `TapTim.e — Anmeldung`, Human types
   `employee-enrollment-e2e@example.invalid` into `E-Mail-Adresse`, activates `Passwort` and
   answers `EMPTY_ACTIVE`. Machine injects the password. The next result action presses `Mit
   Einladung beitreten`; answer `PASS` only when `Als Beschäftigter beitreten` is visible.
3. Human activates `Einladungsgeheimnis` and answers its separate `EMPTY_ACTIVE`. Machine injects
   the one-shot invitation secret. There is no standalone `VISIBLE` response.
4. The existing `employee-install-transition` action presses the redemption button, answers
   `PASS` only when `Bereit zum Scannen` is visible, signs out exactly once and confirms
   `TapTim.e — Anmeldung`. Machine then requires `active=0`, `consumed=1`,
   `invitationReceipts=1`, `redemptionReceipts=1` plus exactly one new Employee Membership,
   identity binding, Membership and User against the pre-create baseline before installation
   transition may continue.

An empty/not-filled-looking or doubtful field, rejected action, wrong surface, `FAIL`,
`AMBIGUOUS`, `ABORT`, counter mismatch or cleanup uncertainty stops fail-closed. No button is
tapped automatically.

The existing seven executable/test paths gain only
`apps/synthetic-android-e2e/src/Da5V5InvitationSecret.ts` and
`apps/synthetic-android-e2e/tests/Da5V5InvitationSecret.test.ts`.
`apps/synthetic-android-e2e/src/constants.ts` and
`apps/synthetic-android-e2e/src/SyntheticAndroidE2eEnvironment.ts` remain read-only. The new unit
suite covers strict loopback/status/no-store/exact-response/expiry parsing, one-shot and state
order, sentinel non-disclosure, abort/failure cleanup and zeroing, invalid alphabet/length/pad
bits, and rejection of a 64-hex password before ADB. The unchanged full Synthetic suite remains
the real-endpoint verification boundary. After focused verification, tests-inclusive typecheck,
full Synthetic required-APK reachability, build/bundle/Node checks, exactly one final V3,
independent review, publication, one exact-head CI and fresh reviewed runtime/artifact, **STOP
before ADB/install/Product-Human/Hardware** for fresh explicit authority.

## 2026-08-14 compact e-mail/credential prompt addendum — REVIEW PENDING / NOT ACTIVE / STOP

This top addendum is an R0/V0 procedure candidate on baseline
`3edae6bc5e91da1c286d32f3fe577b25154717fe` / tree
`25971097144a0d043d1656108da7045469bd36e5`. It supersedes only conflicting future prompt
wording below. It grants no Supervisor invocation, ADB, installation, Product-Human or Hardware
authority.

For every affected surface, the Human types the named public Synthetic e-mail into
`E-Mail-Adresse`, then
activates the named credential field and answers the retained `EMPTY_ACTIVE` checkpoint:

| Surface | E-mail to type | Credential field | Human button |
|---|---|---|---|
| Administrator login | `administrator-e2e@example.invalid` | `Passwort` | `Anmelden` |
| Enrollment login | `employee-enrollment-e2e@example.invalid` | `Passwort` | `Mit Einladung beitreten` |
| Employee login | `android-e2e@example.invalid` | `Passwort` | `Anmelden` |
| Accessibility Administrator reauthentication | `administrator-e2e@example.invalid` | `Passwort` | `Anmelden` |
| Accessibility Employee reauthentication | `android-e2e@example.invalid` | `Passwort` | `Anmelden` |

Each generated prompt names screen, `E-Mail-Adresse`, the exact address, credential field, button
and expected destination surface. Only these fixed public Synthetic addresses may appear in the
compiled plan and terminal prompt output; no personal/free-form e-mail is accepted or persisted.
The Operator never injects an e-mail and never places one in the credential/ADB/clipboard path,
child environment, argv, evidence receipt or artifact manifest. The run credential is still
captured once through hidden input before child start, transferred only as the exact FD3 frame,
retained memory-only as required and machine-injected into the active empty credential field. It
never appears in clipboard, environment, argv, file or log.

`enrollment` means only the `Passwort` field on `TapTim.e — Anmeldung`, followed once by `Mit
Einladung beitreten`; expected destination is `Als Beschäftigter beitreten`. Never inject the
64-hex password master into `Einladungsgeheimnis`. Invitation redemption remains a separate
existing Product step. If its exact safe source/procedure is not already bound, stop before R3
implementation and request a scope amendment; never improvise or reuse the password.

There is no separate positive `VISIBLE` answer after injection. Instead, the next already-required
Human result/surface action tells the Human to press the listed button and observe the expected
destination. Respond `PASS` only after that destination is visible. If the credential field is
empty, not filled-looking or doubtful, the button/login is rejected, a different surface appears,
or the observation is uncertain, respond immediately with `FAIL`, `AMBIGUOUS` or `ABORT`; the
run stops fail-closed. No button is tapped automatically. Accessibility restore/check/abort
semantics remain unchanged.

Activation order is fixed: independent R0 review → focused `[skip ci]` publication → independent
exact-head review → allowlisted R3 implementation and verification → independent R3 review →
focused publication → one exact-head CI → fresh runtime/artifact plus independent review →
**STOP before ADB/install/Human/Hardware for fresh explicit authority**. Until that sequence
completes, the existing runtime must not be used for another Hardware run.

## V3-D fulfilled (`2026-08-14`) — publication path only / Hardware STOP

V3-D ran exactly once on candidate tree `d8a7c272a41738e95b9bb5b6043312443bdfd7e5` and passed
the complete established sequence and cleanup. Event-Ledger claim
`d1b1d67ef28081e25900e6b1367e3585a7846547960af47969b68c5aca341a5b` binds the exact Evidence;
independent R3 review returned `APPROVED` with zero open P0–P3. V3-D is consumed: no restart,
retry, replacement or result reuse is authorized.

Current route is independent R0/V0 review of the focused three-document truth sync, one
intentional exact-candidate commit/push after Technical-Lead approval and remote check, one
exact-head CI/V4, then fresh runtime/artifact generation and independent review. **STOP** before
Supervisor invocation, ADB, installation, Product-Human and Hardware; a fresh explicit Human
Hardware authorization remains mandatory. The retained runner matrix below is historical and
consumed; it MUST NOT be executed again.

### Historical consumed worktree and order gate

Create a fresh **normal, non-sparse**, detached worktree at published baseline
`9032581b1cb13b4a44f575aaface8a87989f4932` / tree
`03c06109a622e666d693ad9f28785ad834f4e663`, then overlay exactly the independently reviewed 18
candidate-tree blobs. Before D01 prove: baseline tracked count 971; candidate tracked count 977;
all 18 blob identities and the reviewed candidate tree/canonical baseline patch match; root
`tsconfig.base.json`, `package.json` and `package-lock.json` exist and are blob-equal to the bound
candidate tree. Root `app.json` and `research/` are absent from both bound Git trees; never
enumerate or read their contents. Sparse checkout or any omitted tracked file is `STOP`.

Execute every command as its own direct, awaited process call—no monolithic/ad-hoc shell runner
or wrapper. Follow only the command order in immutable
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-9380758-corrected-4r21J4/runner-record.txt`
(2,839 bytes / `0444` / SHA-256
`5b23c0308ff5ca3cde791538b60a2092dafcf2b52878bf416ea6511339907921`); that file supplies order,
not results. Bind absolute Node 24, npm CLI, PostgreSQL 17.10 and artifact tools. Before D01 use
exact `/usr/sbin/lsof` and retained command/path/stdout/stderr/return-code Evidence to prove owned
ports 3000/54321/55435 absent; missing tool or ambiguous output is `STOP`.

### Historical consumed state, environment and evidence gates

Create one fresh task-owned `V3D_TASK_ROOT`; derive fresh `HOME`, `TMPDIR`, npm cache, empty
`0444` user/global npmrc files (empty SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) and separate D01/D02
debug directories from it. Each child uses `/usr/bin/env -i`, closed base `HOME`, `TMPDIR`,
`PATH=/Users/timbartz/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin`, `USER=timbartz`,
`LOGNAME=timbartz`, `SHELL=/bin/zsh`, plus only its row's overlay:

| Phase | Closed overlay/rule |
|---|---|
| D01 / D02 | Fresh root-derived `NPM_CONFIG_CACHE`, `NPM_CONFIG_USERCONFIG`, `NPM_CONFIG_GLOBALCONFIG`, phase-specific `NPM_CONFIG_LOGS_DIR`; `NPM_CONFIG_LOGS_MAX=1`, `NPM_CONFIG_LOGLEVEL=verbose`, exact absolute `npm_node_execpath` and `npm_execpath`; invoke absolute Node 24 + absolute npm CLI. D01 completes before D02. Immediately after **each** command, before D02 or any PG/later command respectively, copy the raw npm debug log into Evidence and hash-bind it. Missing/rotated/unreadable raw log is `STOP`; JSON/stderr/return code/digest is not a substitute. |
| PostgreSQL | Only `LC_ALL=C`; exact PostgreSQL 17.10, `initdb --locale=C --encoding=UTF8`, `pg_ctl`/postmaster inherit `LC_ALL=C`; argv-bound host/port/user/database; all other locale and every `PG*`/`PQ*` environment name absent. Remove locale before Node. Run fresh 11-database and 27-migration gates. |
| Node gates | Absolute Node 24 and absolute npm CLI only where required; no locale. Only the established per-command database overlay may exist. Run the full established 20 builds, 21 membership/typecheck gates and 21 suites, then all additional/bundle checks in recorded order. |
| DA5 no-install preflight | From candidate CWD, direct absolute Node 24 invocation of `apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`; add only `TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5`, equal bound Android roots and task/OS support names. No package lifecycle, bare tool, locale, DB/PG/PQ, ADB control or installation. |
| Expo/artifact | Exact recorded direct absolute-Node invocation and established synthetic-e2e overlay only; no locale, operational DB overlay, ADB or DA5 profile. |

All unnamed `LANG`, `LANGUAGE`, `LC_*`, `PG*`, `PQ*`, database credential/URL, Android/ADB and
profile names remain absent. Retain exact CWD/argv, environment-name proof, raw output and return
code for every gate. Cleanup uses exact `/usr/sbin/lsof` for each owned port and retains the same
five evidence fields; missing tool or ambiguity means cleanup `UNVERIFIED`, never `PASS`.

Any mismatch/failure consumes V3-D; no retry, replacement or result reuse. Green routes only to
independent R3 review. **STOP before ADB, install, Product-Human and Hardware.**

## Current fast-flight procedure activation — implementation candidate / STOP

The exact-head approved authorization is
`9032581b1cb13b4a44f575aaface8a87989f4932` / tree
`03c06109a622e666d693ad9f28785ad834f4e663`. After required implementation verification, review,
publication, V4 and exact runtime/artifact review, `npm run da5-v5:start
--workspace=@taptime/synthetic-android-e2e` reaches only the compiled Supervisor. Until those
gates and a fresh separate Human authorization complete, **do not invoke it**; no ADB, install,
Product or Hardware action is authorized.

The Supervisor captures the bound 64-lowercase-hex Credential once through hidden TTY input,
passes it only as one exact FD3 frame to one fresh child, and follows its immutable hashed plan.
Before capture it recomputes `binding_set_id` from the exact Supervisor/child bytes, plan digest,
Node version, allowlisted child environment and the six separately reviewed SHA-256 bindings for
procedure, closure, final V3, exact-head CI, runtime manifest and toolchain; mismatch stops before
the child. Those six values are supplied only as Supervisor bindings named
`TAPTIME_DA5_V5_{PROCEDURE,CLOSURE,FINAL_V3,EXACT_HEAD_CI,RUNTIME_MANIFEST,TOOLCHAIN}_SHA256`
and are never passed to the child.
At each prompt the Human uses only the displayed `screen`, exact `field`/`button`, `action`,
`do_not` and `allowed_response`; only `PASS`, `FAIL`, `AMBIGUOUS`, the requested non-negative
integer queue count, or `ABORT` is valid. Never type the Credential into the command channel.
There is no mid-flight source/Runbook lookup, resume, retry or automatic next run.

Every terminal path waits for Operator cleanup/exit, runs the fresh scoped checker and then seals
one disclosure-safe external JSON receipt plus manifest. `FAIL`, `AMBIGUOUS`, unexpected input,
order/nonce mismatch, signal, timeout/hang, child failure, cleanup/checker/seal mismatch or unknown
state is fail-closed `STOP`. Accessibility restoration remains mandatory once started. A later
run always begins at step one under new separate Human authority. Campaign synchronization and
the maximum-three/24-hour rule are enforced through the Event Ledger, never by the Supervisor.

### Current verification and V3-B runner correction (`2026-08-14`)

Pre-amendment candidate tree `b775c248bb268e91b141c62361b47614f38934a5`, full patch 212,896
bytes / SHA-256 `155bb35851508e30bed6c3b2908c8b410845ddd6fabc3bd795016bd0ed744cc1`, has fresh V2 PASS:
Synthetic 16 files / 384 passed / 19 expected DB skips; Mobile 1 file / 120 passed; both
tests-inclusive typechecks, fresh build and both bundle checks.

V3-A is consumed `FAIL_CLOSED`. It passed D01/D02, 11 DB, 27 migration commands, 20 builds,
21 memberships/typechecks/suites (155 files; 3,043 tests: 3,040 passed / zero failed / three
expected skips) and C3B. The next no-install preflight stopped because the runner did not supply
exact `TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5`; repository code requires it. No ADB, install,
Product or Hardware action occurred; cleanup passed. The immutable evidence root is
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-fast-b775c248-failed-profile-20260814T0049Z`
(root `0555`, 78 manifest-bound payload files plus `evidence-manifest.txt` = 79 regular files
total), receipt SHA-256
`d13dae77c997167962ac31c843e8ee22f904001957c25db0143dceb88c61fb75`, manifest SHA-256
`36d1172e26f330d12d3990a29e0e0bd31e42adc0fd80b71c09be373773fb79f1`.

Only after independent ADO review `APPROVED`, run exactly one **new** V3-B on this amendment's
resulting bound tree/patch. Start the full established sequence at D01; do not reuse V3-A gates as
execution. Before D01 prove exact profile `da5-v5`, the unchanged minimal sanitized V3 environment
and absence of conflicting profile, DB-credential or secret variables. From exact
candidate-checkout CWD `/Users/timbartz/Dokumente/GitHub/taptime`, directly invoke exactly once:
`/usr/bin/env TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5 /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`.
The helper is the direct child of D01-bound absolute Node `24.17.0`; no package script/npm
lifecycle is invoked. Its runtime environment needs only the already-bound exact profile, equal
exact `ANDROID_HOME`/`ANDROID_SDK_ROOT`, task-owned `TMPDIR` and existing allowlisted OS support
names; this correction adds none. Retain exact CWD/argv, environment-name proof, raw stdout/stderr
and return code. No bare `node`/`npm`/`npx`, ADB or installation is allowed. A failure consumes
V3-B without retry; green routes to independent review, not Product/Hardware.

The latest historical terminal truth remains the correction-2 event below:
`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2; LATER CURRENT STATE CLEAN`, authority
consumed. It is not retryable and is not reclassified by this activation.

## Current Human-order-deviation correction 2 — terminal STOP

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CORRECTION2-2026-08-13`. This section supersedes
correction 1's inaccurate child-TMP relationship, its overbroad no-entry wording and every
conflicting generic task-state, immediate-cleanup, queue or clean-working-tree assertion.
Terminal classification remains **`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2; LATER
CURRENT STATE CLEAN`**, never Product PASS and no Product-defect finding. Authority `E` is
consumed; there is no retry, resume, relogin or replacement run.

Executable `M` `9380758f3e149718c8c0b8d34a1818de64c0d8d1`, exact
`apps/synthetic-android-e2e/src/da5V5Main.ts:232-237`, passes
`temporaryBase: '/private/tmp'`; Guard mkdtemp therefore creates `/private/tmp/.t5-*` directly,
not beneath an additional child TMP base. The immutable historical roots remain byte-exact:
original `0555`
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
contains `receipt.txt` 3,825 bytes / `0444` / SHA-256
`98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94` and manifest 1,827 bytes /
`0444` / SHA-256 `db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`;
correction-1 `0555`
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction1`
contains `correction-receipt.txt` 3,155 bytes / `0444` / SHA-256
`fd94e071d611ff7c08b1220b85d8aad740e3f750cd6edffe2f687f4443dcee81` and manifest 1,831 bytes /
`0444` / SHA-256 `1a453bfa8474462a13fda346b76e78daa82f007154c8545fcc887e300c6d0da8`.
Neither root was changed. Correction 1's child-base description is not exact source truth, and
its no-entry wording is not bound by its sealed bytes because the type-filter-free recheck
occurred only after correction 1 was sealed, after Review.

New immutable correction-2 root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction2`
is `0555`, containing exactly `correction-receipt.txt` 3,549 bytes / `0444` / SHA-256
`da712709ab51016a822b6eb3a282a89f038f6ebaf64a533bcae008c9e1064b4a` and manifest 3,014 bytes /
`0444` / SHA-256 `6e3b86c39df0200e276a3b6993de199ad059642197e0d11de0ea2ddfe78f9c5d`.
It binds only the Technical-Lead-reported later read-only check after Review:
`current_cleanup_correction2=MATCH`; max-depth-one `/private/tmp/.t5-*` name check without a type
filter found no entry; bound Guard and `/private/tmp/.t5-*/run-*/data` PostgreSQL processes were
zero; owned ports 3000/54321/55435 were zero; exact Product package/process/reverse mappings were
absent; Operator process was zero; standard profile matched at font scale 1, accessibility 0 and
services null. The staged index was clean while the working tree was intentionally dirty with the
exact eight-ADO-path candidate; no clean repository or working tree is claimed. This proves only
later current state, never immediate abort cleanup. Queue remains unobserved and unclaimed.
Remain stopped: AVS scope is R0/V0 documentation only; no test, build, Typecheck, CI, ADB,
Hardware, commit or push is run or claimed.

## Preserved Human-order-deviation correction 1 — terminal STOP

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CORRECTION1-2026-08-13`. This preserved correction-1
section is superseded by correction 2 above. Its terminal classification is
**`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2;
LATER CURRENT STATE CLEAN`**, never Product PASS and no Product-defect finding. Authority `E` is
consumed; there is no retry, resume, relogin or replacement run.

The immutable original `0555` Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
remains historical flawed Evidence: receipt
3,825 bytes / `0444` / `98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94`;
manifest 1,827 bytes / `0444` /
`db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`. Its generic task-state
and every queue-zero/no-queue-event claim are not independently bound and are superseded. The
original check covered only repository-local `.t5-*`; correction 1 inaccurately described an
exact bound child TMP base, while correction 2 binds direct `/private/tmp/.t5-*`.
`da5_v5_aborted` precedes cleanup. Complete immediate post-abort cleanup cannot be reconstructed
and is unverified.

New immutable `0555` correction root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction1`
contains exactly correction receipt
3,155 bytes / `0444` / `fd94e071d611ff7c08b1220b85d8aad740e3f750cd6edffe2f687f4443dcee81`
and manifest 1,831 bytes / `0444` /
`1a453bfa8474462a13fda346b76e78daa82f007154c8545fcc887e300c6d0da8`. It binds only two
separately timed Technical-Lead-reported later current checks: package/process absent, mappings
empty, profile `MATCH`, Operator absent and a historical tracked/staged-clean report; then
`current_guard_cleanup=MATCH` and the listed Guard/PostgreSQL/owned-port checks. Correction 2
supersedes correction 1's child-base and no-entry scope. This proves later current state only, not
immediate cleanup. The status
schema has no queue field, the queue checkpoint was not reached and no machine queue Evidence
exists; queue state/event is not observed or claimed.

## Preserved predecessor Human-order-deviation override — terminal STOP before Preview 2

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CLOSURE-2026-08-13`. This section supersedes every later
conflicting current/start statement while preserving the procedure below as non-executable
history. Exact published baseline is `E`
`42b330a1ea700169d7adcd1c3bf54e3dfb868d0a` / tree
`21aad9fa3e0dd7de1d87c66fdaaba8ee0cdc6a92`, parent `C`
`33a1d70c06b0275c59be20bf9d5afc4c8af44767`.

Fresh read-only preflight and the reviewed name-only child-environment contract matched with the
exact allowlist present and forbidden names absent. The Operator emitted `da5_v5_ready` and
`device-preflight=match`; Human physical Tag readiness passed. Installation emitted
`synthetic_e2e_android_runtime_complete_verified` and `da5_v5_android_install=match`.
Administrator empty-active/visible Human confirmations and memory-only Credential binding/
injection receipts matched, and the Human reported login PASS. Initial digital status proved the
lifecycle and Tag records exposed by that status zero; the schema exposed no queue field. The
Human reported Tag A to Customer A setup PASS; machine
reattestation proved exactly one active Tag-A assignment, one Customer-A assignment and one setup
receipt, with WorkEvents/NFC/manual/time all zero; it did not prove queue state.

Before the next mandatory step, **Admin Setup Preview 2**, the Human reported an accidental
sign-out. That report is an order deviation and is not a machine receipt. No relogin, Preview 2 or
continuation is allowed. From ordinary-idle, invoke `abort` exactly once only; the completed run
did so, emitted `da5_v5_aborted` and terminated exit 1. Correction 1 binds only the separately
timed later current-state checks and does not establish immediate complete cleanup.

Terminal classification is **`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2; LATER CURRENT
STATE CLEAN`**, never PASS and no Product defect. Authority `E` is consumed. There is no retry,
resume, relogin or replacement run. No lifecycle/time event was observed at the reached machine
checkpoints; queue state/event is unobserved and unclaimed. Preview 2, Employee, Tag B/X, Gate B–F
and Accessibility action did not occur. Do not reuse any observation.

Immutable disclosure-safe Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
is `0555`: receipt 3,825 bytes / `0444` / SHA-256
`98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94`; manifest 1,827 bytes /
`0444` / SHA-256 `db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`.
It is preserved historical Evidence; its generic task-state and queue claims are superseded by
correction 1. Human reports remain separate from machine receipts and later current-state checks.

## Current startup-environment failure override — STOP pending new E and Human authority

Marker: `DA5-V5-STARTUP-ENV-FAILURE-CLOSURE-2026-08-13`. This section supersedes later
conflicting current/start statements and preserves every physical gate below. Published ADO
baseline is `C` `33a1d70c06b0275c59be20bf9d5afc4c8af44767` / tree
`ce4c62cf64f8bfe6a1891813e6a9fadec3168af5`; executable `M`
`9380758f3e149718c8c0b8d34a1818de64c0d8d1`, r4 runtime and APK SHA-256
`b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234` are unchanged.

The exact one-time authorization was consumed by one r4 TTY invocation. All fresh preflight
bindings matched, but the Technical-Lead wrapper unnecessarily included fixed nonsecret `LANG`.
Exact `Da5V5PostgresRuntimeGuard.ts` calls `rejectOperationalEnvironment` at line 712; line 1830
rejects `LANG`, `LANGUAGE` and every `LC_*` before PostgreSQL owner creation. The exact r4 bundle
has the same predicate at line 2183 and safe failure write at line 23735. The invocation exited 1
after about 0.23 seconds, emitted solely `da5_v5_start_failed`, never `da5_v5_ready`, and was not
retried. Immediate checks: zero `.t5-*` roots and listeners 3000/54321/55435; absent Product
package/process; empty reverse mappings; unchanged standard profile. No PostgreSQL/API/runtime,
install, Product, NFC, Tag or accessibility mutation occurred. Classification is
**`FAIL_CLOSED AND CLEAN / STARTUP-ENV WRAPPER`**, never PASS; no Product finding and no
executable correction.

Immutable disclosure-safe Evidence is the `0555` root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-33a1d70-startup-env-failure-20260813`:
receipt 4,317 bytes / `0444` / SHA-256
`bf5608695d6d3e495ecb09a6b2203da82335e9b982e12e3966383c29f32262c0`; manifest 1,446 bytes /
`0444` / SHA-256 `ed4b507d512f7f65a3bae0ad8bbdc46dba48c72df1f1cd389c13ebe536b85506`.
The sequence is Technical-Lead-reported from live tool output, not raw transcript; exact start
time was not independently preserved.

### Mandatory child-environment contract for any later newly authorized start

The Technical Lead constructs the child environment from an allowlist; parent-environment
inheritance is forbidden. Before invoking absolute Node, a separate name-only predicate records
only `MATCH`/`MISMATCH` plus present/forbidden name sets and stops on any forbidden name. It never
records values, the memory credential, a digest, serial or personal data.

- `PATH` is exactly
  `/Users/timbartz/Library/Android/sdk/platform-tools:/usr/bin:/bin:/usr/sbin:/sbin`.
- Allowed non-Product names are only required `HOME`, `USER`, `LOGNAME`, `SHELL`, `TMPDIR`,
  `ANDROID_HOME`, `ANDROID_SDK_ROOT` and `PATH`; both Android roots equal the exact authorized SDK.
- Allowed exact Operator bindings are only `TAPTIME_SYNTHETIC_E2E_PROFILE`,
  `TAPTIME_SYNTHETIC_E2E_PASSWORD` (fresh 64-lowercase-hex, memory-only),
  `TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY`, `TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST`,
  `TAPTIME_DA5_V5_RUNTIME_GUARD_BINARY_SHA256`, `TAPTIME_DA5_V5_RUNTIME_GUARD_MANIFEST_SHA256`,
  `TAPTIME_DA5_V5_IMPLEMENTATION_COMMIT`, `TAPTIME_DA5_V5_IMPLEMENTATION_TREE`,
  `TAPTIME_DA5_V5_PG_CONFIG`, `TAPTIME_DA5_V5_TAG_A_FINGERPRINT`,
  `TAPTIME_DA5_V5_TAG_B_FINGERPRINT`, `TAPTIME_DA5_V5_TAG_X_FINGERPRINT`,
  `TAPTIME_DA5_V5_TAG_TECHNOLOGY`, `TAPTIME_DA5_V5_ANDROID_API`,
  `TAPTIME_DA5_V5_ANDROID_BUILD`, `TAPTIME_DA5_V5_ANDROID_RELEASE`,
  `TAPTIME_DA5_V5_DEVICE_MODEL`, `TAPTIME_DA5_V5_TALKBACK_PACKAGE` and
  `TAPTIME_DA5_V5_TALKBACK_VERSION`, each at its separately authorized exact value.
- `LANG`, `LANGUAGE`, every `LC_*`, every `PG*`/`PQ*`, `DATABASE_URL`,
  `TAPTIME_SYNTHETIC_E2E_DATABASE_URL`, `TAPTIME_DA5_V5_CI_OWNER_RECORD`, every name matching the
  forbidden `(DATABASE|POSTGRES)` URL/URI/password/pass/credential suffix boundary, every `ADB_*`,
  every `ANDROID_ADB_*` and `ANDROID_SERIAL` are absent. Because the environment is allowlisted,
  compiler, loader and every other unlisted name are absent too.

Any name mismatch stops before Node and consumes no new run because no run may be requested until
the exact predicate contract itself is reviewed. No automatic retry exists.

Next allowed sequence is independent prepublication review of exactly eight ADO files → focused
`[skip ci]` publication at unknown `E` → independent exact-head review → STOP → fresh one-time
Human authorization quoting reviewed `E` and all unchanged bindings. No V3, CI, runtime or APK
rebuild is required or authorized for this R0 correction; the old authority cannot restart,
resume or be replaced.

## Current pre-Hardware operating override — exact M / Source-A artifact / R4 runtime

Marker: `DA5-V5-PRE-HARDWARE-CLOSURE-M-2026-08-13`. This section supersedes later conflicting
`Current` bindings while preserving consumed-run history and every physical gate below.

Executable `M` is `9380758f3e149718c8c0b8d34a1818de64c0d8d1` / tree
`3c3b566124cf8c7ccd7727faf3a8aa76231f20f7`, parents `B`
`489a853e1af45e60bab0b94bcce05d674f6af700` and `D`
`cc6767d118a66e7926b2a5c2a457684695d05d45`. Exact-head CI `31695047997` attempt 1 passed
12/12. Corrected V3 at `v3-9380758-corrected-4r21J4` is independently `APPROVED` with zero
findings and complete cleanup. The immutable Product APK/manifest are the Source-A pair under
`lean-03e0e48a-b02fdb2544225d03`, with SHA-256
`b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234` and
`91725bb6f14306eb40d0e4414f38511fc829250799af91bacf840ac622efc577`.
The final independently `APPROVED` Round-4 Operator runtime is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/9380758f-f06a1b50-r4`;
its manifest is 16,492 bytes / `0444` / SHA-256
`8a179bf8ef7dd206f6095d4d1248780062fe3a7d8db78d45276dbf356b95609d`; entry/map SHA-256 values are
respectively
`f06a1b508369fc525e562485f7a08bd5b1174034d0554cdb5174b3bbf3ef70d5` and
`aba65ced7deb7aa6a44809cc2fef33e202c0157b3056cd00324911e7890dc30a`.
R1 was rejected for npm-hash transcription; r2 closed it but exposed the A→B recipe label; r3
fixed A→B but exposed B→M/D→M labels. R4 binds ordinary and full-index outputs for all three
pairs without rebuild and its final independent review has zero open P0–P3.

Before any physical action: independent prepublication review → focused exact ten-file ADO
commit/push at not-yet-known `C` → independent exact-head review. This R0 delta triggers no V3/V4
rerun. After exact-head review, STOP for a new one-time Human authorization quoting `C`, `M`
lineage, CI/V3, APK/manifest, runtime manifest/entry/map, Node/toolchain and private device/Tag/
port/mapping/Guard/Credential bindings. Do not place raw secrets, UID or serial values in ADO.

In a later authorized flight, the Technical Lead alone owns every digital ADB/Operator command,
checkpoint, Evidence update and cleanup. The Human only unlocks/changes requested settings,
presents requested Tags, reports visible `PASS`/`FAIL`/`AMBIGUOUS` and enters a Credential at the
hidden active prompt. All existing physical observation, restoration and cleanup gates remain.
The consumed failure is historical/non-reusable and its actual root cause is not asserted; machine
`READY` identifiers, real lifecycle regression and safe abort close only the technical gap.
No ADB, install, Hardware or Product-Human action is currently authorized.

## Current terminal override — consumed run and cleanup-only closure (`2026-08-13`)

The one-time run started on `2026-08-12` and is consumed. After exact package clear and Employee
Credential it reached visible `Ausstehender Vorgang geschützt`, before `employee-ready-confirm`.
Do not reuse that observation: Tag B and Gates A–F did not continue. The Operator was left idle;
the original child session/TTY and Operator process were later absent. Therefore no regular
Operator `abort`, `da5_v5_aborted`, Operator cleanup receipt or terminal Operator exit may be
claimed, and the run cannot be resumed or retried.

The later Human authorization was cleanup-only and limited to exact package
`com.tim180201.mobile.synthetic`, owned `tcp:54321`/`tcp:3000` mappings and associated DA5
resources. Disclosure-safe exact binding was proved before mutation. Cleanup removed
`tcp:54321` exactly once and proved it zero, removed `tcp:3000` exactly once and proved the full
mapping set zero, reattested the exact package and uninstalled it with exact output `Success`.
It did not run `pm clear`. After complete reattestation, cleanup deleted only the exact-bound
task-owned PostgreSQL 17 temp cluster. No restart, retry, foreign cleanup or mutation of the
unrelated Homebrew PostgreSQL listener on `5432` occurred.

These precleanup bindings, executed mutation results and the historical null-check sequence are
`Technical-Lead-execution-reported from live tool outputs; no immutable raw/receipt artifact was
preserved before cleanup`. Only current-state null plus ADO scope/repository state is independently
re-checkable. `FAIL_CLOSED AND CLEAN` is the current-state disposition, not independent proof of
the cleanup execution sequence; regular Operator abort, receipt and exit remain unproved.

Two identical disclosure-safe null checks two seconds apart passed; terminal classification is
**`FAIL_CLOSED AND CLEAN`**, never `PASS`. No fachliche Product-, Tag- oder NFC-Mutation followed
the failure; the only mutations were the authorized cleanup mutations. No Operator restart,
`stop`, installation, build, test or publication followed. Before any future
Hardware run, the P1 in current Operator `22fe85d` must be resolved and independently verified:
after a successful Accessibility check it can accept `abort`, close input and then fail cleanup
without restoration proof, preventing `standard-profile-check`. Gate E was not reached in this
run. Prior authority `2d0cbd` is consumed; closure head
`7dad6a5caa9f42e6f29a096df21d915ea34e3296` / tree
`cbf54d36a525ed1bc0d3bf1611bc0ea06288c5ef` grants no new Hardware authority. Sections below are
historical or future procedure only where they conflict with this override.

## Current Lean Stage-6 operating index — ADO PRE-HARDWARE PACKAGE / EXACT-REVIEWED PUBLISHED CLOSURE HEAD REQUIRED / STOP BEFORE HARDWARE

Use `ADO/04_Operations/Development_Assignment_05_V5_Lean_Hardware_Flight_Card.md` as the compact
four-phase index for one continuous Stage-6 run. It does not replace or shorten this Runbook or
the AVS Physical gate: every observation, checkpoint, fresh-first-step rule, fail-closed stop and
cleanup obligation below remains controlling. The Technical Lead owns all digital commands,
binding checks, status/Evidence recording and cleanup; the Human performs only irreducible
device/Tag/visual actions and hidden Credential entry.

The exact ADO preparation is published at
`HEAD == main == origin/main == 3a0469ac1d0c9d781e49648a73bc9ef019423c8e` / tree
`4521f179bbae8867c6776d643679cce32658c979`, parent
`2d0cbd01ce483987c375eeee9ecc49f37e2185f8` / tree
`840fd156fe46614adf9d1bec2a018a2c6b453c1c`: nine ADO files, 405 insertions/63 deletions,
binary diff SHA-256 `b98c6fcb424cf2fda31748efa2b0ce5b79f77bdc0da1e1a32364ae9f48efaf52`, corrected
prepublication independent review `APPROVED`, zero open P0–P3. It is not the Operator CI source.
The current exact Operator remains executable
`22fe85d540c8949f179b96589ed493f0211002db` / tree
`7514edfe90da11a3288fec0df872fb7010238c0b`, CI `31630253237`, attempt 1, 12/12, final strict
independent `APPROVED`, zero open P0–P3; its exact runtime/APK/Node bindings remain in the Flight
Card and Evidence.

This is an ADO/pre-Hardware package, not Operator or Hardware authority. The closure candidate at
`ADO/05_Evidence/Development_Assignment_05_V5_Lean_Hardware_Publication_Closure.md` must first
receive independent `APPROVED`, then be focusedly published, and then receive independent
exact-head read-only review binding the actual published closure commit/tree, final governing
blobs, exact delta and no executable delta. Its future self-hash is intentionally not embedded.
Only that externally exact-reviewed published closure head may be quoted by a new one-time Human
Hardware authorization. Its live signal must also bind every governing
Operator/runtime/APK/manifest/Node and exact device/Tags/environment/Guard/Credential constraint.
Missing or differing binding stops before Phase B, ADB, installation or Hardware without retry.

The legacy 45-gate Harness is superseded; do not run it, create Attempt 16, repeat V3/V4, run
`npm ci` or rebuild an artifact merely for this R0 closure. No Hardware, ADB, installation or
Product action may begin without the later fresh exact Human start signal in the live task.

## Current package-clear / Employee-ready correction — published and artifact-approved; do not run without new authority

Published executable `22fe85d540c8949f179b96589ed493f0211002db`, tree
`7514edfe90da11a3288fec0df872fb7010238c0b`, has direct parent
`5fa6389aad785007b0322a38cfd81a17816c7eab`, tree
`2387276f4969e9ca16cbb31e03a4ad50949bbaba`. The exact nine-path Full-Index/Binary delta is
45,172 bytes / SHA-256
`2346cccc6e3727f39f0f09470fc5e2a66cd8dbba8f20d9aa95da2c1d206fc592`; prepublication
candidate provenance is three code/test paths at 5,037 bytes / SHA-256
`61c56a2afcf9a986f69fe67f28de2fda037d1e1cac942407b943a0b3b5fda2ea` and six ADO paths at
40,135 bytes / SHA-256
`51da9ddc31788e020f85ce3b54aee8b01568e9d846f0cdace6c4fdc9a98c337f`.

After enrollment sign-out and `employee-installation-transition-confirm PASS`, keep existing
pre-state, old-offline close, exact cleanup and same-APK replacement order. The owning Mobile
transaction then runs exactly once:
`adb -s <exact-bound-serial> shell pm clear --user 0 com.tim180201.mobile.synthetic`.
Accept only `Success\n` with empty stderr. No other package, wildcard, broad clear,
`--remove-all`, retry, recovery or resume. Timeout, abort, receipt/concurrency or runner,
transaction, serial/device drift is terminal. After APK provenance/signer verification and the
complete installed-APK digest, reattest exact device, package, process null and exactly
`tcp:54321 -> tcp:54321` plus `tcp:3000 -> tcp:3000`; any mismatch stops closed. The immediately
following Employee-only offline arm proves process-null once again without starting the App or
mutating mappings. That immediate arm must issue exact Toybox argv
`ps -A -w -o NAME:4`; `-w` prevents long primary/secondary Product names from truncating, while
the exact `NAME` header, whitespace-free rows, exit/stdout and fail-closed parser remain
unchanged. Do not substitute `ps -A -o NAME`.

After fresh offline arm and unchanged server/Tag/session-lifecycle/queue/time/review postcheck,
state is `employee-prepared`, never `matched`. Only Employee empty-field, one hidden Credential,
Employee visible-field, then `employee-ready-confirm <PASS|FAIL|AMBIGUOUS>` may run. `PASS`
asserts solely exact Human-visible `Bereit zum Scannen` after login and requires the same boundary
reattestation; only then `matched`. `FAIL`, `AMBIGUOUS`, protected/unavailable, early, late,
repeat or concurrent confirmation is terminal.

Before `matched`, do not arm Tag B, record Gate A, present a Tag, or run checkpoint, dedupe,
offline, fixture, device or Accessibility continuation. Existing status, abort, safe-event,
terminal-cleanup and Accessibility-restore handling remains authoritative. Product/Mobile
semantics, APK, schema, dependencies/lockfile, backup rules and workflow are unchanged.

Fresh Development evidence under Node `24.17.0` / npm `11.13.0` remains bound: focused Controller
60/60, required-reachability ProductStart 5/5, tests-inclusive Synthetic Typecheck with 573 files
and all three changed inputs exactly once, build/syntax/map invariants, and exactly one final full
required-reachability Synthetic run at 345 passed plus 19 expected skips. Exact-head push CI run
`31630253237`, attempt 1, passed 12/12 without retry.

Fresh read-only Product Operator Runtime is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/22fe85d5-2a48d52d`:
manifest 10,726 bytes / mode `0444` / SHA-256
`2e24bb5c5d39089ef871d9fd986a67532d51f71df3a6e1652b1b1e232bf6e1fe`; bundle 930,095 bytes /
mode `0444` / SHA-256 `2a48d52d204ef8cfba73d9a789de3ef50ecefa29e32c51953bc75b9d48d023a6`;
map 1,728,717 bytes / mode `0444` / SHA-256
`a51b9cfa0dfa883bf5d091789051ec16c85529afbecd53b37017940fa16a70d2`, version 3, absent
`sourceRoot`, 90/90/90. The manifest's generation-time pending-review field remains historical.
Final strict OS-sandboxed Exact-Head/Artifact Review returned `APPROVED` with zero open P0–P3,
proved unchanged commit/runtime/artifact identity, and verified CI locally from immutable manifest
plus exact refs because reviewer network access was denied.

Package-only `pm clear` and Employee-ready semantics are technically closed. The previous consumed
Hardware run and its abort/null cleanup are non-reusable. R-026 is technically mitigated but open
only pending a new, separate exact Human Hardware authorization and run. Product APK, Guard,
device, Tag, path and Credential constraints remain unchanged. Production, production data,
deployment and distribution remain unauthorized. **STOP before Hardware — DO NOT INSTALL / DO
NOT START without new Human authorization.**

## Historical incorporated terminal-abort / lost-reverse correction — published and artifact-approved

The `2026-08-11` run continued on `2026-08-12` only after same-session continuity checks. The
bound device/package/profile remained exact, but both transaction-owned reverse mappings were
absent (`0/2`). The run therefore stopped fail-closed before further Product action. `stop`
remained correctly restricted to a fully successful terminal gate; using it for an early Human
abort produced `operator_command_rejected`. Final cleanup then rejected the already-absent owned
mappings and retained the exact Operator/Guard/PostgreSQL chain until exact external PID cleanup
proved terminal null. This is no NFC, Tag or Product finding.

Published executable `2a13b71737bc34a69b137943cb9ccb790caa058b`, tree
`c79402af300112d7fdad901079fc0a5fc30f1938`, with direct parent
`d39446f2a67b51788e8a63d3f73e90e373cc8da8`, tree
`eb1a0f540e52a55ece87e647e325d6ca2c4219ff`, contains the independently approved correction.
Its exact 12-path Full-Index/Binary delta is 40,772 bytes / SHA-256
`b1e6bac320c8a091a40bfa05b9f404d732f6086fbe1188d6fd2b71b881215286`.

The correction introduces `abort` only on the ordinary idle command surface. It is
exactly-once, emits only `da5_v5_aborted`, fixes exit 1, closes command/secret input, aborts an
owned mutation and joins the single cleanup flight; later input is impossible. It is unavailable
while Accessibility restoration is required: only the existing restoration proof remains valid.
`stop` stays success-only and continues to be the sole source of `da5_v5_stopped`.

Final cleanup uses `settleForTerminalCleanup()`, not operational `close()`: it waits for any
mutation flight, freezes the controller and never recreates or removes a reverse mapping. Only
zero, one or both exact owned `tcp:54321` / `tcp:3000` mappings are accepted. Existing Android
cleanup then removes any present exact-owned mapping/package and proves repeated zero. Any
foreign/extra, wrong-host, duplicate, malformed, changed-device, unreadable or ownership-
ambiguous state remains a terminal mismatch and no foreign mapping is mutated.

Prepublication independent R3 review returned `APPROVED` with zero open P0–P3. Exact-Head CI run
`31613335215`, attempt 1, passed 12/12 without retry. Fresh read-only runtime
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/2a13b717-b2b439d5`
binds manifest/bundle/map exactly; final OS-sandboxed Exact-Head/Artifact review blocked its write
probe with `EPERM` and returned `APPROVED`, zero open P0–P3. The cleanup subfinding is technically
closed, but the consumed run remains non-reusable and no runbook step may start until one new,
separate exact Human authorization binds the executable, closure head, runtime, unchanged APK,
Guard, device and Tags. The then-pending ADO-only closure was later published by documentation
commit `aa9ad8c`; it claimed no Product rerun or replacement executable. **DO NOT INSTALL / DO NOT
START.**

## Historical incorporated clean-identity installation boundary — published and artifact-approved

The `2026-08-10` R4 Hardware authority is consumed and non-reusable. It reached Administrator
Tag-A assignment plus the enrollment-only sign-out, but Employee readiness remained at
`NFC wird geprüft`; reopening the Product showed `Ausstehender Vorgang geschützt` without an
intervening scan. Tag B was not presented in the Employee phase. No scan, lifecycle, queue, time
or review mutation occurred, and terminal Operator cleanup proved package/process, owned reverse
mappings, listener, PostgreSQL, Guard, Credential and task state null.

The same installation retained the deliberately permanent Administrator offline-store ownership
and therefore refused the different Employee identity. This is the DA5-scoped R-026 recurrence
of the `DA3-PHYS-01` clean-install precedent. It is not an NFC, Tag or Human-input defect.

Published executable `416f1bc8a7803b1ce96d0d767d6b0179ea1ffb6a`, tree
`ba9d884fd7eb71b988ecaab9991efbc995141f32`, inserts exactly one command after enrollment
sign-out and immediately before Employee Credential readiness:

`employee-installation-transition-confirm <PASS|FAIL|AMBIGUOUS>`

Only `PASS` at credential phase 2 with idle Credential input, the initial Gate-A session,
registration disarmed, exact Tag A active/Customer A plus Tag B zero/Tag X zero, direct-ordinary
offline mode and null lifecycle/queue/time/review state may begin. The Operator then performs,
strictly and once: pre-state match; old offline close; cleanup of only the old exact package and
owned reverse mappings with zero proof; a new installation transaction; reinstall of the same
immutable APK; fresh offline arm; exact post-state/Tag-role equality; disclosure-safe match
receipt. Employee field-ready/check, Tag-B arm and Gate-A checkpoint remain blocked until the
transition is matched. Early, late, concurrent, repeated, `FAIL`, `AMBIGUOUS` or stage failure is
terminal fail-closed; no resume or retry exists. Final cleanup owns whichever exact old/new
transaction is current. `pm clear`, broad `--remove-all`, backup/restore and Product changes are
forbidden. A runner can be reused only after its exact cleanup has succeeded.

Independent Review Round 1 returned `CHANGES REQUIRED` with exactly one P2: a typed failure of
the replacement install was folded into the transition mismatch before its closed install
category and cleanup evidence were emitted. The correction now routes both the initial and the
replacement install through the same disclosure-safe receipt:

`da5_v5_android_install=mismatch category=<closed-install-category> cleanup_status=<not_required|match|mismatch> cleanup_substage=<closed-cleanup-substage>`

The receipt is emitted before the replacement error enters the monotone transition failure. No
raw error is exposed; no following stage starts; final cleanup continues to own the replacement
transaction. At that stage, independent re-review remained pending.

Review Round 2 returned `CHANGES REQUIRED` with exactly one P3 and no other finding because the
preceding evidence summary did not distinguish carried Mobile evidence from fresh post-Round-1
Synthetic evidence. The corrected provenance under Node `24.17.0` / npm `11.13.0` is:

- carried pre-Round-1 Full Mobile: 54/54 files and 1,247/1,247 tests, receipt `8f392d`, exit 0;
- carried pre-Round-1 Mobile tests-inclusive Typecheck: receipt `108def`, exit 0, with the changed
  Mobile test listed by membership receipt `bf24e7`, exit 0;
- fresh current Mobile focus: 1/1 file and 103/103 tests, receipt `734cdc`, exit 0;
- fresh post-Round-1 Full Synthetic: 14/14 files, 324 passed and 19 expected skips, receipt
  `00267f`, terminal exit 0 from the identical child session;
- fresh post-Round-1 Synthetic tests-inclusive Typecheck and five-file membership: `7d3c10`, exit 0;
- fresh post-Round-1 Synthetic build/bundle syntax: `43f3d6`, exit 0; and
- fresh post-Round-1 ProductStart 5/5 with required APK reachability and final bundle syntax:
  `2b5744`, exit 0.

Every relevant Mobile runner, test, TypeScript/configuration, package and dependency input remained
byte-identical through the Round-1 P2 correction. No test or build was rerun for this ADO-only
Round-2 P3 correction. Published/runtime bundle is 920,552 bytes / SHA-256
`8d4981e591820ed6a62bd3b6ca139a7f4b8da90156f858ed0c71a1018a0a0d22`; map is 1,712,456 bytes /
SHA-256 `7286e001e1b55c65aa31e2bbb6a5ec65059d68295fc579037c892c4111e67afa`, version 3, no
`sourceRoot`, 90 sources, 90 unique sources and 90 `sourcesContent` entries.

The exact published 13-path Full-Index/Binary delta from direct parent
`55f4d4984175dd544fd4f27f6a97d9507dcf14a2`, tree
`cbc27ac9cac93dee674bdb07d81c15c226218575`, is 81,331 bytes / SHA-256
`4d586d2ad5318f288e611393554b2fbc25731c95fd35e4c1fc1376d30737c70c`.
Exact-Head CI `31430310571`, attempt 1, passed 12/12 without retry. Use only the fresh read-only
runtime
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/416f1bc8-8d4981e5`:

| Runtime input | Exact binding |
|---|---|
| Manifest | 9,775 bytes; mode `0444`; SHA-256 `26ba35d40b23439a533526d102fadf68176f7c6d8cce189fb32c1fbac80364ca` |
| Bundle | 920,552 bytes; mode `0444`; SHA-256 `8d4981e591820ed6a62bd3b6ca139a7f4b8da90156f858ed0c71a1018a0a0d22` |
| Source map | 1,712,456 bytes; mode `0444`; SHA-256 `7286e001e1b55c65aa31e2bbb6a5ec65059d68295fc579037c892c4111e67afa`; version 3; `sourceRoot` absent; 90 sources, 90 unique sources and 90 `sourcesContent` entries |

Final independent Exact-Head/Artifact Review ran under OS-enforced write denial; its adversarial
write failed with `EPERM`, the candidate and artifacts were byte-identical before/after, and the
result is `APPROVED` with zero open P0–P3. No Hardware, ADB, installation or Operator run occurred
after publication. Technical correction is complete, but R-026 remains open until one new exact
Human Hardware run. This R0 documentation sync runs no execution gate. **STOP before Hardware;
DO NOT INSTALL / DO NOT START without a new, separately bound one-time Human authorization.**

## Historical incorporated dependency-security / test-TMPDIR technical closure — approved

The independently approved candidate and its prepublication ADO synchronization are published as
executable `e2f4f6c777d4dc89531394609e44b3471537b2d7`, tree
`0850d2f254877580773f62174d4c85e10cfff165`. Its direct development baseline is
`627e8512631c53bc2c6882aed80b163ab81051fd`, tree
`dfaf1d32574e4253aad07d99d84e3489cc5634aa`. Its pre-ADO exact four-path Full-Index/Binary
diff is 45,981 bytes / SHA-256
`7d76ebb9d717ca7b2578b3e50e192b1abf1140c24b2895e5a1c4ff5ee870b37e`. The four tracked
inputs are the lockfile at SHA-256
`902286a30377eef08ce7613eff44d5af5bdd47bb09f7d3cc0741c69685bad491`, Runtime-Guard source
`267f41bcb978604849a5feac177dc88edc98e514a230413d8f2994f8595b567e`, Runtime-Guard test
`a86a6afc4198e0b2a0113fa83db5c7b363cbb7f8e5418d596de15afa66165c6e` and Product-start test
`40c14eda526739a9dc6ae09fdf22828cb4119dee4b646dbcb1dc3dde6fc13806`.

The test-only Runtime-Guard verifier obtains `os.tmpdir()` exactly once, resolves a canonical
root and canonical binary, and selects same-EUID-private trust only for a nonempty strict
component descendant. The bound temp root requires same EUID, owner execute and no group/world
write; the binary requires same-EUID-private trust. Unsafe state within that root fails closed and
must never fall back to root-system; outside paths remain root-system. Root, binary and codesign
are revalidated in fixed order immediately before and after process verification. Production
artifact/verifier semantics are unchanged.

The lock correction binds `js-yaml@4.3.1` and `nanoid@3.3.18`. The only accepted High findings
are `image-size@1.2.1` advisories `GHSA-w3rx-r6r6-pgpr` and
`GHSA-5p2g-fcmc-qvqq`, narrowly accepted through `2026-09-09` under R-038. The current generated
bindings are `da5V5Main.js` 912,627 bytes / SHA-256
`97448febd21887fa29a08e26ed9e2ac5737736502d6241e6053a3f241aac01ce` and its map 1,697,795
bytes / SHA-256 `c8cd0e8aa5bb19945946ef9ba4d157075e7cd3ac3e888c6645f31bd6a50854f5`.
The map must remain version 3 with absent `sourceRoot`, 90 sources, 90 unique sources and 90
`sourcesContent` entries.

Independent Exact-Delta review returned `APPROVED` with zero open P0–P3. On `2026-08-10`, the
Human accepted an explicitly composite evidence set instead of another local full Synthetic
rerun. Carry-forward is restricted to gates whose V3r3 bound inputs remain byte-identical:
dependency install/graph/audits/validator, 19 non-Synthetic builds, 20 non-Synthetic
tests-inclusive Typechecks, C3B `verify-bin`, migration apply/replay/ledger, Expo export and the
first 20 non-Synthetic workspace suites. The later RuntimeGuard source/test and ProductStart test
changes forbid carrying the V3r3 Synthetic build, Typecheck or workspace result.

Fresh evidence passed the final Synthetic binding build under exact Node `24.17.0`, npm
`11.13.0`, `js-yaml@4.3.1` and `nanoid@3.3.18`. The tests-inclusive Synthetic Typecheck passed
with 573 listed files and included exactly the changed RuntimeGuard source, RuntimeGuard test and
ProductStart test. Fresh macOS correction slices passed RuntimeGuard 17 plus one expected skip,
PostgresGuard 78/78, SyntheticDB 21/21 and final ProductStart 5/5 with
`TAPTIME_DA5_V5_PRODUCT_APK_REACHABILITY=required`. This composite must not be relabeled as one
monolithic full-workspace rerun.

The unchanged Product APK is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`,
95,522,751 bytes, mode `0444`, SHA-256
`b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8`; its same-directory
manifest is 1,968 bytes, mode `0444`, SHA-256
`83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b`.

One later intended full-rerun setup stopped at the pre-test `initdb --pwfile=-` invocation. That
is an orchestration-only failure: no PostgreSQL server and no full Synthetic test started. All
task-owned execution/runtime state was cleaned; only the immutable disclosure-safe receipt was
retained at
`/private/tmp/taptime-da5-full-final-evidence.6krwCf/final-evidence.txt`, 4,260 bytes, mode
`0444`, root mode `0555`, SHA-256
`479758b48825ef3dee311255824a53c9a890953792104f4e54e9057977e29af7`.

Exact-Head CI GitHub Actions run `31384903728`, attempt 1, passed 12/12. Use no mutable
development output. The fresh Product Operator Runtime is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/e2f4f6c7-97448feb`.
Its checkout is detached, sparse and tracked-clean at the executable commit/tree. Its read-only
manifest is 8,640 bytes, mode `0444`, SHA-256
`4cf1d4589028707c3328826d3148d34f2ae1e4e6226d75566c4ff3d0476e2790`.

| Runtime input | Exact binding |
|---|---|
| Bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 912,627 bytes; mode `0444`; SHA-256 `97448febd21887fa29a08e26ed9e2ac5737736502d6241e6053a3f241aac01ce` |
| Source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,697,795 bytes; mode `0444`; SHA-256 `c8cd0e8aa5bb19945946ef9ba4d157075e7cd3ac3e888c6645f31bd6a50854f5`; version 3; `sourceRoot` absent; 90 sources, 90 unique sources and 90 `sourcesContent` entries |
| Product APK — DO NOT INSTALL | Unchanged path and exact 95,522,751-byte, mode-`0444`, SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` binding above |
| Product manifest | Unchanged 1,968-byte, mode-`0444`, SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` binding above |

The runtime manifest retains its generation-time
`candidate_status=exact_head_ci_passed_pending_final_artifact_review`; do not rewrite it after
review. Final Artifact Review Round 1 raised only a formal sandbox-enforcement P2, with no
material Candidate/Artifact defect and no candidate mutation. Round 2 ran fully under enforced
write denial and returned `APPROVED` with zero open P0–P3.

Technical closure is complete. A later ADO-only closure commit remains distinct from the
executable/CI commit and does not invalidate this runtime. The next possible Product gate is one
fresh, exactly-bound Human Hardware run, and it still requires separate one-time Human
authorization. No Hardware, ADB, installation, Product Human V5, production, production-data,
deployment or distribution action occurred or is authorized here. **DO NOT INSTALL / DO NOT
START without that authorization.**

## Historical snapshot — superseded by 2026-08-10 final closure above — Credential PTY correction before publication

The latest Product Human/Hardware authority is consumed and final cleanup is null. The protection
filter detected the memory-only Credential in child PTY output after the password field was
confirmed active and empty, then stopped the run fail-closed. The published Product Operator
runtime must not be reused. No raw Credential or Credential digest may be recorded, and no run
observation authorizes a retry or later Product gate.

The focused local candidate is based on
`aca2fcfb794adf9bd44786459a7dbd35448172d2` / tree
`124cce6f4b80eca3562fe50fe219d0c2517ee99a`. For every Credential action, the Command interface
must transfer ownership synchronously to one Secret interface without `removeAllListeners`.
Muted output, the active Secret question and the exclusively owned raw-input audit must be
installed before exactly one `synthetic_password_input_ready` receipt. Only exact
64-lowercase-hex input is accepted. Close and Error reject until final settlement; any byte after
the first line terminator, including same-write Ctrl-D or an unterminated foreign rest, rejects in
that same input event. Secret, line and write buffers are zeroized in place where mutable and
otherwise immediately discarded. No product Credential-capture timeout was added or proved, and
no timing delay is part of the correction. Command input may restart only after Secret release and
completion of the owning command.

The exact five transfer positions and success receipts are normative:

1. Standard Administrator: `synthetic_password_binding=match`.
2. Standard Enrollment: `synthetic_password_binding=match`.
3. Standard Employee: `synthetic_password_binding=match`.
4. Gate-E `administrator-setup` reauthentication:
   `da5_v5_accessibility_password_binding=match`.
5. Gate-E `employee-navigation` reauthentication:
   `da5_v5_accessibility_password_binding=match`.

Every position retains its existing empty-active check, hidden digest comparison, exact bound
Android runner, both-streams-empty injection proof and Human `VISIBLE` confirmation before phase
advance. A standard receipt is never accepted at an Accessibility position or conversely.

Hardware-free V0 reproduced one synthetic-dummy occurrence on the predecessor and zero on the
corrected built helper. Independent Review Round 1 returned `CHANGES REQUIRED` with one P1 for
same-turn settlement, two P2 findings for timeout/full-V2 evidence and one P3 for the official
ADO entry. The bundled local correction now passes focused tests at 3/3 files and 63/63 tests.
Its real PTY matrix proves success plus rejection of complete/unterminated foreign input, valid
line plus Ctrl-D/Close, empty Ctrl-D, Error and invalid format with zero Secret occurrences.
A separate bounded PTY-wrapper/process-group check proves final-output scanning and whole-group
cleanup with a live descendant; it does not prove a Credential-capture timeout.

The first complete Synthetic run stopped at one stale static signature assertion after 13/14
files, 302 passed and 18 skipped. After correcting that changed-input test, final complete
Synthetic V2 passed 14/14 files, 303 tests and 18 unchanged expected skips. The tests-inclusive
Typecheck passed with 572 listed files and exact changed-input membership; build and bundle syntax
passed. These checks used no ADB, installation, APK or Hardware.

Independent Review Round 2 returned `APPROVED` with zero open P0–P3. The first exactly-once final
Synthetic V3 on 09.08.2026 nevertheless ended formally `FAIL` with exit 98: tests passed 14/14
files with 303 passed and 18 expected skips; tests-inclusive Typecheck, exact 572-file membership,
Synthetic build and bundle syntax all passed. The sole failure was the terminal cleanup check:
Node 24 created task-owned `node-compile-cache/**` under basename
`taptime-da5-credential-v3.nSz7lx`. The exact root was subsequently removed through bounded
cleanup and its absence proven. This first run remains non-reusable `FAIL` evidence and does not
authorize continuation.

Separate exact Human authorization then permitted one fresh corrected V3 on the unchanged
baseline and six-path input-manifest SHA-256
`6f7c0f11c1db4dc52b8f7742f356a3dec629aac5b3ca01609bc457ee98cba8f3`. Before start, the old
root was absent. Fresh mode-`0700` root `taptime-da5-credential-v3-corrected.aKLa2n` was bound to
its parent, UID and inode; fixed `tmp` and `node-compile-cache` children were inherited by every
Node/npm/Vitest/TypeScript/Vite invocation. The run passed 14/14 files, 303 tests and 18 expected
skips; tests-inclusive Typecheck; exactly one 572-file membership list with every required input
once and SHA-256 `c91ba74dbf6a834f620cc9971048f22700f3e03eceb15368a133d1c5ed949a3b`;
Synthetic build; and bundle syntax. After all children exited, Root/Parent/UID/Inode remained
bound, symlinks, mounts and open handles were absent, and exact `xdev`-bounded removal plus
root-absence proof passed. This corrected run is the current V3 `PASS` evidence only.

This remains an uncommitted and unpublished candidate. Prepublication review remains pending; no
V4/CI or exact publication is claimed. **DO NOT INSTALL / DO NOT START.** A separate Human
authorization would still be required before any future Hardware action.

## Historical snapshot — superseded by 2026-08-10 final closure above — Credential-transfer / Lean-Accessibility V4 runtime

The latest Product Human/Hardware authority on baseline
`aab04442721d57d53def25e45e5e3ce1d6ea3f77` / tree
`e96fee7f3fa0f9783693c9f2c84605bae4c63920` is consumed and fully cleaned. It reached
Administrator authentication, Tag-A assignment, assigned-Tag setup preview rejection and the
signed-out Tag-A rejection. Enrollment credential transfer then left the focused field empty, so
the run stopped before enrollment authentication. No lifecycle, queue, time, export or protected
fixture mutation occurred. Product/Validation packages and processes, owned reverse mappings,
listeners, disposable database and task runtime all ended at the confirmed null state.

The superseding technical candidate uses one fail-closed mobile transfer for Administrator,
Enrollment and Employee credentials. The already bound Android runner reattests the exact
standard profile, accepts only one 64-lowercase-hex line through non-PTY stdin, requires the
device-side input command to exit successfully and applies a Credential-only runner policy that
requires both child stdout and stderr to be empty. Ordinary ADB calls retain their prior stderr
behavior. The transfer advances only after the Human confirms visible field content. The first
Administrator transfer immediately after installation is the short transfer preflight and its
real Gate-A entry; do not repeat it.

Functional Gates A–D now use the exact standard profile (`font_scale=1.0`, accessibility disabled
and no active accessibility service). After Gate D and while that exact standard profile still
applies, the operator must run the single-use `accessibility-prepare` command. Only its exact
`da5_v5_accessibility_prepare=match restore_required=armed` receipt authorizes the Human to change
TalkBack/text scale; the receipt first activates a monotone restore obligation in both the Gate-E
session and device checkpoint. One read-only Gate E then uses the separately bound
`font_scale=2.0` and exact TalkBack provider/version on essential surfaces and interactions only;
it repeats no business mutation. Gate E has one exact ordered read-only surface plan and only two
narrow reauthentication transfers needed to reach Administrator and Employee surfaces. From the
prepare receipt onward, a boundary/check mismatch, PASS, FAIL, AMBIGUOUS or explicit Cancel accepts
only the separate standard-profile restore proof before terminal cleanup can complete. A failed
route terminates after that proof; it cannot resume Gate E. The exact successful order is
`A -> B -> C -> D -> accessibility-prepare -> Human profile change -> accessibility-check -> E ->
restore proof -> F`.

Independent Round-3 Re-Review returned `APPROVED` with zero open P0–P3. The exactly-once final
Lean-V3 is `PASS` on unchanged `HEAD` = local `origin/main`
`aab04442721d57d53def25e45e5e3ce1d6ea3f77` / tree
`e96fee7f3fa0f9783693c9f2c84605bae4c63920` and the pre-sync exact 14-file, 144,817-byte
Full-Index/Binary delta SHA-256
`4cfab7b09377c59f25f88af2caf3d0238824325a285baf6ee16d04bc01c13f70`. The ADB boundary is
`match` with `adb` not resolvable; no ADB command ran.

Under Node `24.17.0`, npm `11.13.0`, Vitest `4.1.9`, TypeScript `6.0.3` and esbuild `0.28.1`,
Mobile syntax passed, all 54/54 files and 1,245/1,245 tests passed, and its tests-inclusive
Typecheck passed. Its normalized 868-file membership list has SHA-256
`11d72c73fe9c420a4c7b4aaadbdcad91187ec78500b5f7c8b68c9dd07f2f82e6` and includes the changed
Mobile test. Synthetic passed 14/14 files with 303 passed, 18 expected skips and 321 total; its
tests-inclusive Typecheck, build and final bundle syntax passed. Its normalized 571-file list has
SHA-256 `45ac1d63ca5f619fcb432594b8495ec08968af1aed99edb8c336d357dcb74e5b` and includes all four
changed Synthetic tests. Both temporary membership lists were unlinked.

Unchanged dependency, backend, PostgreSQL, migration, APK and security evidence is carried under
the Lean profile; it was not freshly executed or relabeled by this R0 synchronization.

The independently prepublication-approved executable is published at
`0f7ea912d861ecc0bfbf760bfd170496c37220b2` / tree
`86f742536b2439955eb8291d53931487b15fff83`, direct parent
`aab04442721d57d53def25e45e5e3ce1d6ea3f77` / tree
`e96fee7f3fa0f9783693c9f2c84605bae4c63920`. Its exact 14-file, 148,041-byte
Full-Index/Binary delta has SHA-256
`0f9384c67a04edeaff62d8174462c41df5d315a55162c5299f8a03995303ec92`. Exact-Head V4 CI
`31039633334`, attempt 1, passed 12/12 without retry.

Use no mutable development output. The fresh read-only Product Operator Runtime is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/0f7ea912-af5cde8b`.
Its checkout is detached and tracked-clean with exact sparse patterns `/*` and `!/research/`.
Fresh `npm ci` ran exactly once, added 695 packages and audited 717; 20/20 applicable workspace
builds passed once in dependency-derived topological order. The audit reports 12 moderate, zero
high and zero critical findings. The task cache is absent and the staging root is removed.

| Runtime input | Exact binding |
|---|---|
| Bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 907,171 bytes; mode `0444`; SHA-256 `af5cde8b304ebb8c5fe623c604addd5d2d40727fcb69f713d524f715771ac7ac` |
| Source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,688,780 bytes; mode `0444`; SHA-256 `55ab8eebd277b551042b0766a3c1781857d8b0f1714fc42d6f1d759b5ad1df15` |
| Runtime manifest | `operator-runtime-manifest.json`; 9,219 bytes; mode `0444`; SHA-256 `7c5931035446faa1d0fc90fe31de8ef123ecba43f6de1c5a0b7a1da47f4b91e4` |
| Product APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; unchanged; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Product manifest | Same directory, `artifact-manifest.txt`; unchanged; 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |

Focused final independent Exact-Head/Artifact Re-Review returned `APPROVED` with zero open P0–P3.
It is bound to executable `0f7ea912d861ecc0bfbf760bfd170496c37220b2` / tree
`86f742536b2439955eb8291d53931487b15fff83`, Exact-Head CI `31039633334` attempt 1 at 12/12,
the corrected 9,219-byte mode-`0444` manifest SHA-256
`7c5931035446faa1d0fc90fe31de8ef123ecba43f6de1c5a0b7a1da47f4b91e4` with all 14/14 changed-file
entries exact, the unchanged Bundle/Map/Product APK/Product manifest bindings above and the exact
pre-status-synchronization three-file R0 Full-Index/Binary diff of 13,485 bytes, SHA-256
`576334a65612239ff8d73caaab122eb6320877b7c901dd6a17c6127e1d47f445`.

The read-only manifest's `candidate_status` value
`exact_head_ci_passed_pending_final_artifact_review` records its generation state before that
final review; this status synchronization does not mutate the manifest. It claims no new test,
build, CI or artifact action. Publication of this ADO closure remains pending until commit/push,
and no future commit is claimed. **DO NOT START** Hardware, ADB, installation or Human V5 without
a separate exact one-time Human authorization. No database action occurred. Product/Validation
APKs remain unchanged. Production, production data, system changes, deployment and distribution
remain unauthorized.

## Historical snapshot — superseded by 2026-08-10 final closure above — ADB-37 reverse correction

The latest Product Human/Hardware authority is consumed and may not be retried or reused. On
correction baseline `6b7f60ba483a65f1723cbf29e87f8a439f0804c9` / tree
`fbe43ebce13fdc0d7851ca8384043b948c9ca898`, the run created exact owned mappings `tcp:54321`
and `tcp:3000`, then stopped before `install-create`. The bound USB/ADB-37 command
`adb -s <bound-serial> reverse --list` returned `UsbFfs` in its first transport column. Both
parsers expected the serial there, so the primary failure fell back to `child_start_transport`
and cleanup failed at `reverse_list`. Final recovery/observation established null package,
process and owned-mapping state; no authentication, NFC, Product or time action occurred.

Do not repeat the diagnostic post-failure mapping mutation. It crossed the authorized operator
boundary, is a P2 process finding and is not run Evidence. No observation from it may validate
the parser correction or a Product/Hardware result.

The published correction permits exactly the `UsbFfs` transport token. It does not ignore column
one and does not derive device identity from it. Every command remains scoped by
`-s <bound-serial>`, exactly one USB device, exact model/build and serial continuity. Exactly
three columns, bounded nonzero TCP endpoints, unique device endpoints and exact owned mapping
sets are mandatory; every foreign, malformed, duplicate or ambiguous result stops fail-closed.

Development V0/V1/V2 passed the focused install/controller, error rollback/final-zero, preinstall
zero, both offline cycles, Credential transfer and hardware-free built-bundle boundaries; full
Mobile/Synthetic suites and tests-inclusive Typechecks are green. The prior failing Synthetic run
was caused only by an old Serial-emitting fake and was followed by a changed-input two-line
`UsbFfs` fixture correction.

The exactly-once final V3 is `PASS` on unchanged `HEAD`/`origin/main`
`6b7f60ba483a65f1723cbf29e87f8a439f0804c9` / tree
`fbe43ebce13fdc0d7851ca8384043b948c9ca898` and pre-ADO-sync exact 11-file
Full-Index/Binary patch SHA-256
`a2baca0159e1c64c8b552a2d95b9b29aad5b5196be6aa11c205572df510bf1d6`. Node `24.17.0` / npm
`11.13.0` passed MJS syntax; Mobile 54/54 files, 1,243/1,243 tests, Typecheck and exact 868-entry
membership SHA-256 `6d29af79968b01bb14f14b0ec3b0b280b4c6fd8dd4e9be04bab3b8cc7f34f3fe`;
Synthetic 14/14 files, 291 passed plus 18 expected skips, Typecheck, exact 571-entry membership
SHA-256 `c79f5c314c1bc3df8002bc7ba53d975d4f671c8e49575f12e83b1134dacd84ae`, build and final bundle
syntax. Every changed test is included. After all V3 checks, `rg` was unavailable under a
minimized `PATH` for a membership helper and exited 127; `/usr/bin/grep` immediately verified the
already-created lists, both temporary lists were unlinked and no gate was repeated.

The executable correction is published at `f8d68c541056cb19e0f222b8a2c04cd3db2b734f` / tree
`ddb4a69a2db0167b7a57c4f708f2cc64553f4799`, direct parent
`6b7f60ba483a65f1723cbf29e87f8a439f0804c9` / tree
`fbe43ebce13fdc0d7851ca8384043b948c9ca898`. Its exact 11-file, 38,897-byte
Full-Index/Binary delta has SHA-256
`abec3ca7acbe4619c724fa7dba9422db4dc987d48844f0d39a31043b9d32fdc9`. Exact-Head CI
`30943224381`, attempt 1, passed 12/12 without retry.

Use no mutable development output. The fresh read-only Operator Runtime is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/f8d68c54-1406581c`;
its top level contains exactly detached/sparse/tracked-clean `checkout/` plus
`operator-runtime-manifest.json`, `research/` is absent and the task cache is removed.

| Runtime input | Exact binding |
|---|---|
| Bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 895,276 bytes; mode `0444`; SHA-256 `1406581cf5974f899cd512511289cbdae47a3f05875ebea5cfbcabc2538701dd` |
| Source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,659,973 bytes; mode `0444`; SHA-256 `3c8d2b1b9e69ede819708c82934b0be45b10f317079bc6d6453ed6cd4d59fc13` |
| Runtime manifest | `operator-runtime-manifest.json`; 7,554 bytes; mode `0444`; SHA-256 `2e20e4b028294527e52fca621467997e2805db28c365b22db7f6d3eba05acd31` |
| Dependency closure | Fresh `npm ci` 695/717; audits 12 moderate, zero high and zero critical; 18/18 builds |
| Product APK — DO NOT INSTALL | Unchanged existing binding: 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Product manifest | Unchanged existing binding: 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |

Final independent Exact-Head/Artifact Review ran under a technically enforced read-only sandbox;
its adversarial write was blocked and repository/artifacts were identical before/after. Final
result is `APPROVED` with zero open P0–P3. The executable correction is technically closed and
artifact-bound.

This R0 ADO closure changes no executable/test/artifact input, claims no CI for its own future
documentation head and grants no executable command. Product and Validation APKs remain
byte-exact and **DO NOT INSTALL**. Runtime/Hardware is **DO NOT START**. Every ADB, installation,
Human V5, production, production-data, deployment and distribution action remains separately
unauthorized and requires its own exact authority.

## Prior CI-CLIPBOARD-CLEANUP-01 technical closure — before consumed Hardware run

`DA5-V5-PRODUCT-INSTALL-02` is independently approved and published at
`c92744bc35a2c2fca27dd5ff7c54b39a93692fde` / tree
`60ef4d73916370367e5259e6557014e0364139b8`. Exact-Head CI `30926820054`, attempt 1, is 11/12
without retry. The INSTALL-02 tests passed; only the hardware-free Linux bundle-start smoke
failed because pristine startup cleanup called unavailable `pbcopy`/`pbpaste`, yielding
`da5_v5_cleanup_failed` before Product, installation, database, Hardware or NFC activity.

The authorized local correction binds clipboard-zero duty before every possible mutation and
removes it only after empty-write plus zero-byte readback. Close may skip platform processes only
when no active operation, watchdog or zero-proof duty remains. Pending, failed, aborted and
not-zero-proven paths must still clear and prove zero or fail closed; close is idempotent and
blocks every later injection. Independent review returned `CHANGES REQUIRED` with exactly one P1:
an inject waiting on initial clear could write once after close began. Recheck the closing latch
immediately after that clear and stop with `mismatch` before the non-empty write. Focused
verification passed 2/2 files and 15/15 tests, the
empty-`PATH` bundle smoke and the tests-inclusive Synthetic Typecheck with both changed tests
listed. Independent re-review returned `APPROVED` with zero open P0–P3.

The exactly-once final Synthetic V3 passed 14/14 files, 291 passed, 18 expected skips and 309
total. The tests-inclusive Synthetic Typecheck, normalized 571-entry membership with SHA-256
`45ac1d63ca5f619fcb432594b8495ec08968af1aed99edb8c336d357dcb74e5b`, build and bundle syntax
passed. Unchanged Mobile/backend/dependency evidence carries under Lean V5/ADR-0019.

The executable correction is published as `7eead7560b075763a8ef5076d499b621d63dc3c7` / tree
`a832bcd574af169fd9600a2a0940f5f5d962914f`, direct parent
`c92744bc35a2c2fca27dd5ff7c54b39a93692fde` / tree
`60ef4d73916370367e5259e6557014e0364139b8`. The exact eight-file, 32,916-byte
Full-Index/Binary delta has SHA-256
`c763bee4b070ec56ffbe799485df34e6e003665e39bd9fd0c0fa705b941d3bd8`. Prepublication
correction re-review and publication-delta review each returned `APPROVED` with zero open P0–P3.
Exact-Head CI `30930590588`, attempt 1, passed 12/12 without retry.

Use no mutable development output for a later gate. The fresh read-only Operator Runtime is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/7eead756-dbacb6b9`.
Its root contains exactly detached tracked-clean `checkout/` plus mode-`0444`
`operator-runtime-manifest.json`; `research/` is absent and the task cache is removed. Exact
runtime bindings are:

| Runtime input | Exact binding |
|---|---|
| Bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 894,993 bytes; mode `0444`; SHA-256 `dbacb6b9c5c1a5e1a0960441331580acc6acf8e6f3c99e34985d99d504c80e3f` |
| Source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,659,518 bytes; mode `0444`; SHA-256 `c2e6eeb28be5dc6d0bfcb9ee19804e4ae61ba17143ad59c8d4d152988bdcc6dd` |
| Runtime manifest | `operator-runtime-manifest.json`; 6,815 bytes; mode `0444`; SHA-256 `320efc48f083d9b42bad043eac2e9c81cd0b8c21ea2f04487841666a41f36c32` |
| Lockfile / toolchain | `checkout/package-lock.json`; 356,795 bytes; SHA-256 `b905263b7b303938f8e0a5381f82bb151073588a3176fb14fd84fdd79caf9f1e`; Node `24.17.0`; npm `11.13.0`; fresh `npm ci` 695/717; 18/18 runtime dependency-closure builds |
| Product APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; unchanged; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Product manifest | Same directory, `artifact-manifest.txt`; unchanged; 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |

The first final substantive review found no Code, Artifact or CI finding but formally returned
`CHANGES REQUIRED` with one P2 because its runtime read-only boundary was not technically enforced.
A fresh independent re-review ran wholly under `/usr/bin/sandbox-exec` with `(deny file-write*)`;
an adversarial write attempt was blocked with `Operation not permitted`, and repository/artifacts
were identical before and after. It returned final `APPROVED` with zero open P0–P3 and closes the
formal P2.

The executable candidate is technically closed and artifact-bound. **DO NOT INSTALL / DO NOT
START Hardware, ADB or installation.** None occurred and none is authorized. Production,
production data, deployment and distribution remain separately unauthorized. This ADO-only R0
closure sync claims no test, CI or Artifact execution for its own documentation head and does not
move reviewed executable head `7eead7560b075763a8ef5076d499b621d63dc3c7`. Before any later
Hardware action, a new exact Human prompt must separately bind that executable head and the exact
published ADO-closure head.

## Historical prepublication PRODUCT-INSTALL-02 correction candidate — hardware was blocked

This section preserves the state before Review Round 3 approval and publication and is superseded
by the current CI-CLIPBOARD-CLEANUP-01 section above.

The Product-Human/Hardware run on `8723221aba847f778f97febc13f4dd8c1447cac4` / tree
`fcb6249a5ccdb402a39f7a0dd7beefb4930651d7` is consumed and fully cleaned. It reached complete
Product-APK runtime verification, then emitted `da5_v5_android_install=mismatch category=cleanup`
and `da5_v5_cleanup_failed`. Scoped recovery removed only `tcp:3000` and `tcp:54321`; final
Product/Validation package, process, reverse, listener and task-runtime state was null, and no
authentication, NFC, Product or time action occurred. Do not retry that authority.

The local R3 correction candidate uses one durable per-run install transaction bound to the exact
control runner, stream runner, device and serial. Product-package and reverse-mapping cleanup
authority is acquired separately for each resource only after the transaction proves package and
mapping zero and then starts or proves that resource's mutation. A matching Product-shaped
package or mapping that predates that proof is observation-only and must never be removed.
Install failure output is closed and disclosure-safe:

```text
da5_v5_android_install=mismatch category=<closed-install-category> cleanup_status=<not_required|match|mismatch> cleanup_substage=<closed-cleanup-substage>
```

The primary category is retained even when cleanup fails. A bound pending session receives at
most one `install-abandon` attempt across inner rollback and outer operator cleanup. Package
removal is also one persistent flight per transaction; final-zero and uncertain null-window proof
are observation-only for package state and never uninstall again. Cleanup coalesces persistently,
continues safe independent stages after failure and reattests the exact device. A later stronger
uncertainty request after a weaker flight returns closed substage `uncertainty_escalation` without
new mutation. The uncertain path shares one absolute 60-second deadline across device discovery,
both exact binding reads, command timeouts, waits and retries.

Only explicitly typed transient command failures may retry once, and only at reattestation,
reverse-list or an individual exact reverse-remove boundary. Abort, replacement/ambiguous device,
binding, parse, ownership and permanent command failures do not retry. Never remove a foreign
mapping/package, use `--remove-all`, or print raw errors, stderr, PackageManager details, paths,
serials or secrets. SIGINT, SIGTERM, SIGHUP, uncaught exception, unhandled rejection, EOF and
install-stream abort remain fail-closed; every background path has a terminal non-rejecting sink,
and stream signal abort has the distinct safe category `signal_abort`.

Independent review Round 1 returned `CHANGES REQUIRED` with exactly two P1, four P2 and one P3;
the preceding rules remain part of the current in-scope correction. Independent review Round 2
returned `CHANGES REQUIRED` with exactly one P1 and no P0, P2 or P3: a signal during Guard,
PostgreSQL capability or Environment acquisition could permanently complete cleanup before the
late resource assignment. Cleanup now waits for a separate monotone startup-acquisition
settlement while failure, mutation abort and input closure latch immediately. Settle directly
after normal lifecycle binding, and settle in startup catch before invoking cleanup; never make
settlement depend on `handleSignal()`. One persistent cleanup flight then owns every acquired
startup resource exactly once.

Final composite Lean-V3 is `PASS`. Immediately before this ADO-only sync, the candidate remained
exactly 12 tracked paths and its 158,738-byte full-index/binary delta had SHA-256
`ef86b48ad5882b1020b593a8a82139ff618a5b0dd0ef7d2eff2e1433493b557a` on unchanged HEAD/origin
`8723221aba847f778f97febc13f4dd8c1447cac4` / tree
`fcb6249a5ccdb402a39f7a0dd7beefb4930651d7`. Fresh Synthetic passed 14/14 files with 286 tests
and 18 expected skips, its tests-inclusive Typecheck, the 571-entry normalized membership receipt
SHA-256 `45ac1d63ca5f619fcb432594b8495ec08968af1aed99edb8c336d357dcb74e5b`
including `Da5V5ProductStartBundle.test.ts` and `Da5V5Profile.test.ts`, the build and final bundle
syntax. Current local `dist/da5V5Main.js` is 894,145 bytes, mode `0644`, SHA-256
`6612aca547727e1b77b2e0deb88bd029f80fba0eb30ca39c962fe84fbb9a5f19`; its source map is
1,658,075 bytes, mode `0644`, SHA-256
`a010852ceebe55878e7b211b183ea785a86a812336ab73f0eff246e6da992779`. They are mutable local
verification outputs, not an authorized or published runtime.

No Mobile byte changed after the immediately preceding pre-Round-2 Lean-V3. Carry its Mobile
evidence without rerun: MJS syntax, 54/54 files, 1,243/1,243 tests, Typecheck pass and normalized
868-entry membership SHA-256
`11d72c73fe9c420a4c7b4aaadbdcad91187ec78500b5f7c8b68c9dd07f2f82e6`.

AVS carry-forward is limited to the remaining 19 unchanged workspace test suites, 19 Typechecks
and 19 builds, Guard 89/89, unchanged privileged database/migration evidence,
`npm ci`/`npm ls`/audits with zero high/critical findings, C3B/Android export/APK verification and
cleanup from exact composite source `bcddf757c7ef64e82c167b39f20d763fdb159ceb` / tree
`ee00e3246f2cd5498cc67eabf9b2f7e2fc19205b`, with full source
`613feb8d4bfa71e48c75cf933f6aea422404096c` / tree
`b1a73234abfbd19623a96c7ba330da731d7320ea`. Fresh Synthetic evidence replaces the old
Synthetic checks; carry only the byte-identical Mobile evidence specified above. Do not
substitute old runtime bundle/map/manifest evidence for the current local V3 outputs. Product and
Validation APKs remain unchanged.
This is an uncommitted, unapproved candidate, not Hardware authority or technical closure. No
ADB, installation, Hardware, CI, V4 or publication occurred. Independent final Review Round 3,
V4, exact publication/runtime binding, final approval and a new fully populated one-time Human
authorization are required before any ADB, installation or Hardware command.

## Historical snapshot — superseded by 2026-08-10 final closure above — Product-install failure/correction

The authorized Product run on `7b971070c7fc108fea4ae92db30b87f340b24e91` / tree
`a053d34581687b541fc0fe67a477250bb24319c3` is consumed. Artifact verification and both scoped
reverse mappings completed before `operator_command_failed` and automatic
`da5_v5_cleanup_failed`. Final recovery removed only `tcp:3000` and `tcp:54321`; terminal cleanup
matched with package, process, owned listeners and task database null. No Product action occurred.

Confirmed `DA5-V5-PRODUCT-INSTALL-01` is corrected in the R3 candidate using
exact `install-create`, `install-write`, `install-commit`, memory-only session binding, exact
write-byte/PackageManager receipts and mandatory bounded `install-abandon` before ordinary
cleanup for every known uncommitted session. Existing Product APK/package/User-0/size/SHA,
timeout, reverse, provenance, zeroization and cleanup boundaries remain mandatory. Only eight
fixed safe categories may be emitted. Independent review Round 1 returned `CHANGES REQUIRED` with
exactly two P2 findings. The candidate correction now centrally maps typed timeout/child-exit
failures at both reattestation boundaries and installed provenance, and derives the default write
runner only from the verified System ADB dependencies while incomplete custom pairings fail before
ADB mutation. Focused V1 and affected V2 are green. Independent review Round 2 returned `CHANGES
REQUIRED` with exactly one P2: the real installed-APK binary-digest runner mapped a nonzero or
signaled child close to a generic error, so the central classifier retained
`installed_provenance` rather than `child_exit`. Development Round 3 emits the typed
disclosure-safe child-exit error for both forms and preserves timeout, transport, provenance and
cleanup behavior. MJS syntax, the affected Installer suite at 75/75 and the tests-inclusive Mobile
Typecheck with changed-test membership are green. The separately Human-authorized
`DA5-V5-SECURITY-BRACE-01` addition changes only the lock resolution of `brace-expansion` from
`5.0.8` to patched `5.0.9` under `minimatch@10.2.5`'s unchanged `brace-expansion` range `^5.0.5`;
package manifests and all other dependencies remain unchanged. The bounded advisory regression,
focused Product tests, affected tests-inclusive Typechecks and Synthetic build pass. Runtime and
full audits each show 12 moderate, zero high and zero critical findings and no `brace-expansion`
advisory.

Final post-correction V3 is `PASS` on snapshot
`bcddf757c7ef64e82c167b39f20d763fdb159ceb` / tree
`ee00e3246f2cd5498cc67eabf9b2f7e2fc19205b`. The changed-input verification passed MJS syntax,
Mobile 54/54 files and 1,219/1,219 tests, the tests-inclusive Mobile Typecheck, exactly
`Da5V5ProductStartBundle` plus `Da5V5Profile` at 2/2 files and 33/33 Synthetic tests, the
tests-inclusive Synthetic Typecheck and the Synthetic build. Under AVS risk-adaptive
carry-forward, unchanged evidence from the immediately preceding full V3 snapshot
`613feb8d4bfa71e48c75cf933f6aea422404096c` / tree
`b1a73234abfbd19623a96c7ba330da731d7320ea` remains applicable: 20 builds, 21 Typechecks, all
remaining tests including the user-owned Safe-Root continuation at 89/89, audits with zero
high/critical findings, unchanged privileged database evidence under ADR-0019 and complete
cleanup. Package lock and carried verification inputs are unchanged. Independent review Round 3
returned `APPROVED` with zero open P0–P3; `DA5-V5-PRODUCT-INSTALL-01` and
`DA5-V5-SECURITY-BRACE-01` are technically prepublication approved. Execution publication
`354e2dff2877ee1681f222f2616b4ad318296023` / tree
`84542b4a9efd499f1f6ae43610cb93bf89c8e299`, direct parent `7b971070c7fc108fea4ae92db30b87f340b24e91`
/ tree `a053d34581687b541fc0fe67a477250bb24319c3`, binds exactly 12 changed files and a 71,761-byte
full-index/binary delta, SHA-256 `7d69b8055c752a2afe4f6644b5e9b463d3b256a4eb171a19ae535e43497aa84f`.
Exact-Head CI `30848391390`, attempt 1, passed 12/12.

The fresh read-only Operator Runtime is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/354e2dff-ced93b4b`.
Its checkout is exact and tracked clean. Bundle `da5V5Main.js` is 867,317 bytes, mode `0444`,
SHA-256 `ced93b4b6ce7a82538bedbde301b2cf49615936dee275ce15ebb0dee993aae12`; its map is 1,613,470
bytes, mode `0444`, SHA-256 `82add1a869444e2d3e6f63005e1fa2f3bb73eb536045ccbd37e35205134347a6`;
`operator-runtime-manifest.json` is 7,545 bytes, mode `0444`, SHA-256
`cb44082adfdcfeeef673f51ee14f302a8002b0e1bd465e322a52dd50ec322dd9`. The initial Node-26
setup was discarded and replaced; only Node `24.17.0` artifact evidence is valid. The lock is
SHA-256 `b905263b7b303938f8e0a5381f82bb151073588a3176fb14fd84fdd79caf9f1e`; audits remain zero
high/critical. Product APK and manifest remain unchanged at SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8`
and `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b`.
Final independent Exact-Head/Artifact review returned `APPROVED` with zero open P0–P3;
`DA5-V5-PRODUCT-INSTALL-01` and `DA5-V5-SECURITY-BRACE-01` are technically closed. **DO NOT START
OR RETRY HARDWARE, ADB OR INSTALLATION.** The failed run remains consumed and cleaned. A new
Human/Hardware V5 requires separate one-time exact authority.

## Historical snapshot — superseded by 2026-08-10 final closure above — Product-start-bundle correction

The Product-Hardware run bound to `4dff147031e2d8ebbd95b9451705f66b35fbacd3` / tree
`be05ca8e893a00dbd95f84e7133e73f080f96547` is consumed. The standard operator stopped before
database, device preflight and installation with `Synthetic E2E release APK is missing`.
`DA5-V5-PRODUCT-START-BUNDLE-01` was the bundled verifier mistaking the importing
`da5V5Main.js` URL for the verifier's direct CLI URL. Authorized read-only cleanup inspection
proved Product/Validation packages and processes, reverse mappings, synthetic listeners and new
task PostgreSQL/runtime state absent; repository and remote were unchanged.

Executable correction `e939d8c40e7994c72ab1cd2e68e47f189ed8abc1` / tree
`dfd5e160c6c14d09daadcc192afaf81daf1ad060` makes the direct-CLI predicate module-specific and
leaves the existing externally supplied Product-APK verifier unchanged. Source import and the
built operator no longer auto-check the default APK path; explicit direct CLI missing/wrong APK
checks remain fail-closed. Independent prepublication review is `APPROVED`, zero open P0–P3.

The fresh no-custom-executor runtime candidate is preserved read-only at:

| Runtime entry | Exact binding |
|---|---|
| Root | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/e939d8c4-379b2d9b` |
| Checkout | source `e939d8c40e7994c72ab1cd2e68e47f189ed8abc1` / tree `dfd5e160c6c14d09daadcc192afaf81daf1ad060`; sparse checkout excludes `research/`; tracked clean |
| Entrypoint | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 846,602 bytes; mode `0444`; SHA-256 `379b2d9b32a26f3fb120b4247431644ae65c4eebe257893948a8e252989dd66b` |
| Source map | same directory, `da5V5Main.js.map`; 1,579,813 bytes; mode `0444`; SHA-256 `4c61abcfc81b77afa223e207c56a4fef05e249a2659129d32f2f2992b2468ed8` |
| Runtime manifest | root `operator-runtime-manifest.json`; 4,977 bytes; mode `0444`; SHA-256 `2b041dee0e945b680da15764b7584eced36c19d3860f6b4067cfc400988c627b` |

Fresh Node `24.17.0` / npm `11.13.0` V3 completed 20/20 builds and 21/21 typechecks.
Focused verifier tests passed 12/12, the built-bundle start smoke passed 1/1, Mobile passed
1,198/1,198, Synthetic passed 280 with 18 unchanged database-gated skips, and all other
non-database workspace suites passed. Exact unchanged database evidence was carried from parent
CI `30829321321`; Exact-Head CI `30834192270`, attempt 1, reran the final publication matrix and
passed 12/12 without retry. Runtime-Guard artifact,
isolated PostgreSQL, environment creation and initial DA5 status matched, followed by complete
cleanup. Audit reports zero High/Critical vulnerabilities. Final independent Exact-Head/Artifact
review of publication `e5a566bc60be7dc7647183bbbcfb9947ac3a6fb7` / tree
`05a0f4c2ff4006a73ec18b2d19c74cb903d064f0` returned `APPROVED` with zero open P0–P3 and
confirmed the runtime and unchanged Product-/Validation-artifact bindings.

**DO NOT START HARDWARE, ADB OR INSTALLATION.** Product and Validation APKs remain unchanged.
Only a fresh exact Human authorization is still mandatory before the hardware gate. Production,
production data, production/distribution signing, deployment and distribution remain unauthorized.

## Historical snapshot — superseded by 2026-08-10 final closure above — Product-preinstall correction

The matched read-only inspection on `304ddb159f3def2b50d059678086e02aacbd51c9` / tree
`97940b61ce76017c9c295b1cb43fe007727f2ca9` did not start the Product operator or install
anything. That Human authority is superseded and must not be reused.

`DA5-V5-PRODUCT-PREINSTALL-01` is corrected by executable commit
`e525a9ad2b937356002928028fddaaa3e1dca301` / tree
`11aa7fdf526c9b149af5dc60ef5567fb727a24fe`, with verification-head fixture correction
`4329fec6783907b3549322a344085b96e7d00d16` / tree
`4165f9d88d07f80f0b3a4772764c53aa2f515e0f`. Exactly empty User-0 package-list output proves
absence; exactly the canonical package line proves presence, after which alone strict `base.apk`
inspection may run. Every other result fails closed. Strict main/secondary process parsing and
joint package/process/reverse-null proof remain mandatory at preinstall and cleanup.

The approved no-custom-executor runtime is preserved read-only at:

| Runtime entry | Exact binding |
|---|---|
| Root | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/e525a9ad-00932e6a` |
| Checkout | source `e525a9ad2b937356002928028fddaaa3e1dca301` / tree `11aa7fdf526c9b149af5dc60ef5567fb727a24fe`; tracked clean |
| Entrypoint | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 846,453 bytes; mode `0444`; SHA-256 `00932e6a1f8ba8d6ff95ff92ec8437b99c48a3f7e97e6b679f205b8f254b66c6` |
| Source map | same directory, `da5V5Main.js.map`; 1,579,577 bytes; mode `0444`; SHA-256 `2d4064af3424779f05cabab6d8e6f8bd66ad2d33fa08f4ffe0a654abec29eb1b` |
| Runtime manifest | root `operator-runtime-manifest.json`; 4,475 bytes; mode `0444`; SHA-256 `6ef434d2c1a5684b19bb9a349edc6fd3eefa3aa4d6f8846ba1e5f932de14708b` |

Local V3 and Exact-Head CI `30829321321`, attempt 1, are green; correction reviews are `APPROVED`.
**DO NOT START HARDWARE, ADB OR INSTALLATION** until this R0 delta is independently `APPROVED`
and a new exact Human authorization binds the corrected publication/runtime. Existing Product and
Validation artifacts remain unchanged. Production, production data, signing, deployment and
distribution remain unauthorized.

## Historical snapshot — superseded by 2026-08-10 final closure above — automated Lean governance

ADR-0019 and the Lean authorization were Human-accepted and published at
`83635335aa4f547dc8994243c604dacf9797f593` / tree
`40b7655a94e607b8afe19f90f42a95f42ee6d582`; independent architecture/authorization review
returned `APPROVED` with zero open P0–P3. Lean stages 1–5 and automated V0–V4 are complete on
executable candidate `1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree
`2db756832a81f07cdb1a927ff3076320cc253960`. Prepublication binding review and final independent
Exact-Head/Artifact review returned `APPROVED` with zero open P0–P3. Exact-head CI
`30786622180`, attempt 1, passed 12/12 without retry.

Fresh read-only hardware-candidate bindings, which supersede populated earlier `Current` artifact
rows later in this historical runbook, are:

| Artifact | Exact current binding |
|---|---|
| Product source | `83635335aa4f547dc8994243c604dacf9797f593` / tree `40b7655a94e607b8afe19f90f42a95f42ee6d582` |
| Product APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Product manifest | Same directory, `artifact-manifest.txt`; 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| Validation source | `83635335aa4f547dc8994243c604dacf9797f593` / tree `40b7655a94e607b8afe19f90f42a95f42ee6d582` |
| Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-83635335aa4f-9908d76ea97a1ae9/app-release-9908d76ea97a1ae9.apk`; 65,634,553 bytes; mode `0444`; SHA-256 `9908d76ea97a1ae95ad4a08b24f626d72e8cfc6ddb20d3d1629fa822686c9d29` |
| Validation manifest/closure | Same directory, `manifest-83635335aa4f.json`; 6,855 bytes; mode `0444`; SHA-256 `ab6a02980058259ae719bc597cfa4e7ba25ef0da28d2de4f0ee039884f373298`; 33-record sourceClosure digest `a50ec386e87217eb9a02fede94fd37a97fefb0734fa5a9791b7ff142a9c44c2f` |

The Product App is not installed. This runbook grants no Hardware/ADB/install authority and no
Product Human V5 action may start without a separate exact Human authorization. DA5 and R-034
remain open only for that gate. Production, production data, production signing, deployment and
distribution remain unauthorized. Attempt 15 remains consumed with no retry. CI
`30786622180` binds the executable candidate, not a future R0 documentation-sync head.

## Historical superseded Harness override — Attempt 14 consumed; Attempt 15 prospective read-only candidate

Attempt 14 is consumed fail-closed on exact publication `7f6c94886b4dff263e364ea8860b5de1b98b3b53`
/ tree `c6df9d7b05374f2baba369d3ca163ea83048b68a` and cannot be retried, repaired, resumed or
executed again. Its immutable 45-record distribution is six passed, two failed and 37 hard-stop
omissions. Gate 4 `NPM_CI` failed at `unexpected_output_root`; the mapped child nevertheless
exited 0 with stdout/stderr both 0 bytes. Quality count is zero, Cleanup/Postcleanup are complete,
artifact is `null` and raw output is false. Exact receipt/snapshot/manifest are 110,812 / 2,490 /
1,147 bytes with SHA-256 respectively
`6001c9786038acc8d76e08f9842ccd3b84dc714017134f3aad8df1e5ac779f88`,
`b75dd8ae0f973171f3806c03f963a4f500901e968ef8b2b99ab3cda60b0219bb` and
`53987c9676748016e7e1d16cfac8306266622d6e9a25102e86bb5c834cf5588c`, all mode `0444` under
the immutable mode-`0555` Attempt-14 Evidence root.

The prospective Attempt-15 root is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-executor-4dad93bd-cfea2c8a-r1-outputbind`,
mode `0555`, with only mode-`0444` executor 410,449 bytes / SHA-256
`19fe8fe403c230ea0bd914d7e7beb54552954b161bf92033483d92c9a17b6769` and manifest 4,782 bytes /
SHA-256 `ecc5c2ced55db323bc02af9cf225161171b3bc59f0ed96c95da821422ef2c440`. Permitted non-mutating
candidate inspection is limited to:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-executor-4dad93bd-cfea2c8a-r1-outputbind/attempt15-executor.mjs
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-executor-4dad93bd-cfea2c8a-r1-outputbind/attempt15-executor.mjs --self-test
```

The exact original map remains unchanged. The adapted map adds only NPM_CI output roots derived
from exact `4dad93b…:package-lock.json` blob `77555096088f864860f2b6c75f51d364a7349d65`, 356,795
bytes / SHA-256 `62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470`. It requires 34 install
nodes and the exact 17-root list/SHA
`13457aaa6dbfe55870b5dcc813eb3fd602d9bf0c3939378b89282c0ac087131f`; root `node_modules` makes
18 internal roots/SHA `8f2294960bc1db56e066acc987705918f914a5dd628ee3ff2f60c371ce4ce856`.
The only additional allowed output is the exact unchanged task cache. No broad checkout/apps/
packages/workspace/glob root is legal. All lockfile identity/parser/path/boundary/count/digest
checks occur before NPM_CI starts; every ambiguity hard-stops later nonterminal gates while the
unchanged terminal cleanup runs.

Fresh token `cfea2c8a` prospectively binds:

```text
/private/tmp/taptime-da5-harness-4dad-attempt15-20260802-cfea2c8a
/private/tmp/taptime-da5-harness-4dad-attempt15-cache-20260802-cfea2c8a
/private/tmp/taptime-da5-harness-4dad-attempt15-logs-20260802-cfea2c8a
/private/tmp/taptime-da5-harness-4dad-attempt15-config-20260802-cfea2c8a
/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt15-4dad93bd-cfea2c8a
/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-4dad93bd-cfea2c8a
/Users/timbartz/Dokumente/GitHub/taptime/.git/worktrees/taptime-da5-harness-4dad-attempt15-20260802-cfea2c8a
```

All seven paths are absent; self-test must leave them absent. Development syntax passed and the
bounded no-mutation self-test passed 387/387 with zero failures and fixture-name-set SHA-256
`7e77005f392e87a93937e823d4452b99f24538593dec55add66b6d9d135743a5`.

Attempt 15 is **PROSPECTIVE / READ-ONLY / NOT EXECUTED / DO NOT EXECUTE**. There is deliberately
no currently valid reference `--execute` command. A future exact execution publication must be a
caller-bound single child of `7f6c948…` / tree `c6df9d7…`; prepublication review, focused
publication, local AVS R3, V4 exact-head CI, final independent zero-finding approval and separate
exact Human one-run authority must all occur first and be bound by that later caller. This embedded
runbook claims none of those gates complete. Hardware, ADB, installation, Human/Product V5,
production, production data, deployment and distribution remain **DO NOT START**.

## Historical superseded Harness override — Attempt 14 candidate

Attempt 13 is consumed fail-closed and cannot be retried, repaired, resumed or executed. Its
immutable evidence is five passed, two failed and 38 hard-stop omissions; Gate 3 stopped at
`identity_byte_limit`, quality count is zero, Cleanup/Postcleanup completed, artifact is `null`
and raw output is false. Receipt/snapshot/manifest are 108,071 / 2,503 / 1,160 bytes with SHA-256
`6dacaad7db7bcec61f591724b3bcf6ce30aad88ecd2d60e05e301c3ca79285ae`,
`ea6b71d50122aefce343055cdef00422331c05247191beef1042ab6a6a39d74e` and
`2a2a19965a0708051dff7a7eda86eb4416c60b3f4dacb162d7590b2e9bd0a474`. Its accepted P2/P3 review
findings authorize no run and prove no Product or test cause.

The R6 executor remains immutable and is superseded by readonly root
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind`,
mode `0555`, containing only mode-`0444` executor 388,219 bytes / SHA-256
`89c283b211456a1cf7ae20ee4ae551d7ef8a6a17dd443f541dd0cd2e314cfbb9` and manifest 3,729 bytes /
SHA-256 `c118bd24fe455f944bf81ccf10faeef7dea89f41f2b3490ee9470ad2228f69f1`. The correction preserves
source `4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / tree
`d44bc534c16866dbc16cd889098e6ca33d75d1f5`, Synthetic blob
`183b82674ed92e51375fad41e9efb034976ff5e3` and the exact inherited map SHA. It binds Node to
`/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`, `v24.17.0`, 120,591,840 bytes and SHA-256
`f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`; missing explicit size
retains the exact 32,000,000-byte generic limit.

Permitted non-mutating candidate inspection is limited to:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind/attempt14-executor.mjs
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind/attempt14-executor.mjs --self-test
```

Both commands must leave checkout, cache, logs, config, evidence, success-artifact and exact
registration absent. The final development self-test passed 354/354 fixtures, zero failures,
fixture-name-set SHA-256 `17e6b685be359459916b7970f58857eab7f14996017ec07f22164a65a12a3c7d`,
empty failure-set SHA-256 `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`
and real Node identity match. One earlier development self-test exposed only an incorrectly
initialized new Gate-3 sequence fixture (`gate_sequence_invalid`); the fixture was corrected and
the final bounded run passed. This was not an Attempt execution.

The following reference CLI shape is **FORBIDDEN TO RUN WITHOUT SEPARATE EXACT RUN
AUTHORIZATION THAT BINDS ALL REQUIRED EXTERNAL EVIDENCE**:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind/attempt14-executor.mjs --execute \
  --approval-token APPROVED_ZERO_OPEN_P0_P3_EXACTLY_ONE_ATTEMPT14_R3 \
  --expected-manifest-sha256 c118bd24fe455f944bf81ccf10faeef7dea89f41f2b3490ee9470ad2228f69f1 \
  --execution-publication-repository /Users/timbartz/Dokumente/GitHub/taptime \
  --execution-publication-commit FUTURE_CALLER_BOUND_40_HEX_COMMIT \
  --execution-publication-tree FUTURE_CALLER_BOUND_40_HEX_TREE \
  --execution-publication-delta-sha256 FUTURE_CALLER_BOUND_64_HEX_CANONICAL_DELTA
```

The execution publication presented by the caller must be a single child of
`da64ae31648166184739b056a917ea2762bc9f23` / tree
`a20721ad15c5c824f3bf32987449ffa08569bede`; HEAD, local `origin/main`, exact six-path scope,
caller-supplied commit/tree/delta, all anchors and fresh state must match before `EVIDENCE_INIT`.
Before any execution: independent prepublication review, exact publication, one local AVS R3,
one V4 exact-head CI, final independent zero-finding approval and separate exact Human one-run
authorization are mandatory. This embedded runbook does not itself establish completion of those
external gates; the exact run authorization must bind their evidence. Attempt 14 is **NOT
EXECUTED / DO NOT EXECUTE WITHOUT SEPARATE EXACT RUN AUTHORIZATION**; Hardware and Human/Product
V5 remain **DO NOT START**. This section supersedes older Attempt-13 preparation procedure
below without erasing history.

- Status: **PHASE-0 RUN 18 ESTABLISHED SAFE TRANSFER BINDING A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; FORMAT/DISTINCTNESS AND DEVICE/UI/10×A+10×B+10×X/NFCA/FINAL PASS/TERMINAL CLEANUP MATCHED WITH EXIT 0; VALIDATION APP REMOVED; AUTHORITY CONSUMED; R-035 LOCALLY MITIGATED; PRODUCT HUMAN V5 NOT RUN; PRODUCT APP NOT INSTALLED; R-034/DA5 OPEN; NO PRODUCT CORRECTNESS/PRODUCTION/DEPLOYMENT/DISTRIBUTION AUTHORITY**
- Date: 2026-07-31
- Owner: Technical Lead
- Approval authority for any run: Human Architect

Current Harness execution-binding override: the unchanged Round-5 executor is superseded by local
independently reviewed read-only publication candidate
`attempt13-executor-4dad93bd-483fcf40-r6-execbind`. Independent prepublication
exact-delta/artifact review Round 1 returned exactly one P3 for stale historic labels; Round 2
closure returned `APPROVED` with zero open P0–P3. It binds
the immutable Round-5 candidate, exact two-commit closure chain, corrected
`4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` source and
Synthetic blob `183b82674ed92e51375fad41e9efb034976ff5e3`, and a single-parent execution publication
directly after `2a5f32b2d29d03f26e53eee07dfe3d0658192b49` / tree
`29a8485f2a19e20ae0c483e701b4a0e36a1ad4a7`. The publication commit/tree/delta are intentionally
not embedded or self-referentially asserted; they must be caller-bound and exactly verified at an
authorized execution. External V4 and final-review evidence are not asserted by this embedded
document. Attempt 13 remains **NOT EXECUTED / DO NOT EXECUTE**;
no run, Hardware or Human/Product V5 authority exists.

Historical Harness CI-closure context (2026-08-02): Attempt 12 is consumed fail-closed. Attempt-13 Round-5
review returned `APPROVED` with zero open P0–P3; the candidate was published as
`387421b3caeed988b159c93ff217fb78a0bee60c` / tree
`ace680660468e0374004869f205e6a1e0af0ac7f`, and its one authorized local AVS R3 verification
passed. V4 exact-head CI `30745607263`, attempt 1, failed closed 11/12 only in `Synthetic
server-connected Android E2E harness` job `91490562435` because its fixed July query/export
window excluded the current-date lifecycle row. `DA5-V5-CI-TIMEWINDOW-01` is confirmed. The
focused deterministic record-bound/window-bound test correction was locally verified, published
and remote-bound as `4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / tree
`d44bc534c16866dbc16cd889098e6ca33d75d1f5`. Exactly one replacement V4 exact-head CI,
`30748749632`, attempt 1, passed 12/12; Synthetic job `91498873248` passed 13/13 files with 283
passed and 14 platform-dependent skips, with Typecheck, Build and Cleanup green. Final independent
Exact-Head review returned `APPROVED` with zero open P0–P3. Do not rerun the unchanged failed
head. Attempt 13 remains **NOT EXECUTED / DO NOT EXECUTE**; no run, Hardware or Human/Product V5
authority exists.

## Historical snapshot — superseded by 2026-08-10 final closure above — Run-18 fingerprint-transfer result and then-current Product boundary

Run 18 used exact ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` / tree
`e2970d1851ab55f99ff7a027e6268ec4b7622643`, Validation Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c` / tree
`b32af38c8ac769965ab062762004312d96d0de25`, and Validation Execution
`be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`. APK SHA-256
`3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144` and manifest SHA-256
`1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a` matched.

Exact receipts were `artifact:match`, `preflight:match`, `install_launch:match`, `waiting:match`,
`human_pass:match`, `cleanup:match`, `complete:match`; exit was 0. Device/UI, 10×A then 10×B
then 10×X with 10/10 per role, `NfcA`, final UI `PASS` and complete cleanup matched. The transferred
12-uppercase-hex fingerprints are A `B55E8B6AEB30`, B `32A54C8F2F29` and X `F61C9F702CFE`;
format and pairwise distinctness were validated. The exact authority is consumed successfully and
R-035 is locally mitigated with the transfer binding established. Raw UID, payload, Technology
list, device serial and secrets remain prohibited.

Product Human V5 did not run and the Product App was not installed. Run 18 establishes no Product
correctness. R-034 and DA5 remain open. The R3 Harness-artifact closure and its independent
source/artifact Exact-SHA review must complete with zero open P0–P3 before any later separate exact
Product-Human-V5 authorization. Attempt 1 failed closed before build/test/artifact because the
isolated dependency step selected unauthorized Node `26.3.1` / npm `11.16.0`. `npm ci` exited 0
and installed the locked 695-package tree only into task-owned `node_modules`; cleanup completely
removed the worktree, `node_modules` and every dependency output, with no registered worktree
remaining. No Product/APK or system installation occurred. No retry is authorized by that failure
record. The separately approved attempt-2 authorization matched fresh paths, source/tree, hashes,
Node/npm and lifecycle proof, and bound `npm ci` exited 0. Dependency closure then failed closed
before build/test/artifact because `npm ls --all --json` returned `ELSPROBLEMS` for two
extraneous Expo packages and invalid `expo-modules-core`; it also wrote one debug log outside the
bound cache. Cleanup removed checkout, cache, `node_modules`, dependency output, debug log and
worktree registration completely. The attempt-3 authorization then received independent
`APPROVED` review with zero open P0–P3, but its execution was not independently verified. Every
attempt-3 path/source/hash/tool binding, npm exit, gate-order, omission and external-log-set claim
is **Development-reported/unverified** because no disclosure-safe raw/receipt artifact was
preserved and task logs were cleaned. Development reported a predicate-1 fail-closed stop and
cleanup; the failure-evidence gap remains open. Independent review confirmed only the four bound
paths and worktree registration absent, current package-lock hash exact and the six-file ADO-only
delta without executable delta. Attempt 4 received independent authorization review `APPROVED`
with zero open P0–P3 and ran only within the exact technical boundary. Fresh-path/source/tool,
bound install, globally recursive clean exit-0 npm closure, dependency/workspace/lifecycle/
external-log and V0 gates passed; Mobile focused tests passed 38/38. V1 failed closed before any
Synthetic test executed because `@taptime/backend-schema` could not resolve from its package
entry. The receipt explicitly proves only `V2`, `BUILD`, `NODE_CHECK`, `METAFILE_RUNTIME` and
`ARTIFACT_PRESERVE` omitted. It contains no Mobile/Synthetic typecheck command IDs or omission decisions;
Development reported both tests-inclusive typechecks omitted, but that claim is unverified and a
separate fail-closed evidence gap. No output artifact exists. Cleanup removed all task execution state and preserved only
the `0444` receipt/snapshot/manifest evidence under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87`.
Independent review identified this P2 evidence-claim gap; correction re-review is pending and
Attempt 4 grants no retry. Attempt-5 candidate review returned `APPROVED` with zero open P0–P3.
Execution passed the evidence-first preflight, bound install, strict global/affected npm closure,
dependency-file/tool/source and external-log predicates, then stopped at
`DEPENDENCY_BINDINGS` when the lifecycle-binding verification exited 2. V0, all 16 prerequisite
builds and every focus/typecheck/V2/Node/metafile/artifact step are explicitly omitted. No build
output or artifact exists. Cleanup removed checkout/cache/logs/`node_modules` and registration;
immutable evidence remains under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87`.
Attempt 5 is `NOT_VERIFIED`; independent execution/evidence review is pending and no retry is
authorized. Hardware, Human, Product installation, ADB and
Product Human V5 remain **DO NOT START**. Production, production data, deployment and
distribution remain unauthorized.

Attempt-6 candidate review returned `APPROVED` with zero open P0–P3. Attempt 6 started, recorded
only green `EVIDENCE_INIT` and `SOURCE_BINDING`, was interrupted and is consumed. Its only
evidence is the unchanged 2,716-byte mode-`0444` receipt, SHA-256
`6a5b23db67bbe1ff6715f377e3f0f041942d8e8b447b5e3e45cb7aa224ad5402`; no checkout, install,
build, test, Typecheck or artifact exists.

Attempt 7 is consumed fail-closed, but its authorization is **UNVERIFIED** because no exact
candidate/digest/review preceded execution. Its receipt uses aggregate dependency/build/V1/V2
records and lacks V0, individual build IDs and separate Typecheck IDs; those results are therefore
Development-reported/unverified. Verified facts are the immutable receipt, `METAFILE_RUNTIME`
exit 2, completed cleanup/path absence and no artifact. Attempt-8 candidate review Round 3 returned
`APPROVED` with zero open P0–P3. Its single execution is consumed fail-closed. Records 1–7 retain
their stated decisions and npm exit/count evidence, but the normative per-command external-log
isolation is insufficient/unverified: `NPM_CI` and `GLOBAL_NPM_LS` have only before hashes and
`WORKSPACE_NPM_LS` has neither side. Record 8 detected cumulative drift that cannot be attributed;
records 9–41 are individually omitted and records 42–45 completed cleanup/finalization. No
external npm log was mutated or raw name/content preserved; no build/test/Typecheck/artifact ran.
Failure/evidence review returned `CHANGES REQUIRED` with exactly one P2, corrected here.

Attempt 9 was independently `APPROVED` with zero open P0–P3 on published candidate
`9d9aa10242231d85afd5a9b018c0652f60b90de2` / tree
`7aa1bcd0026372b196b0fc7d39cd6fbf8b2233ee`; its single execution is consumed fail-closed.
`EVIDENCE_INIT` passed. The first exact no-checkout worktree process exited 0, then the runner
rejected macOS `/tmp` -> `/private/tmp` normalization as `noncanonical_cwd`; `WORKTREE_ADD`
failed and records 3–41 are omitted. No npm, install, build, test, Typecheck, Metafile, TalkBack or
artifact gate ran. The immutable receipt records `CLEANUP` failed with
`Cannot read properties of undefined (reading 'root')`, `POSTCLEANUP` failed with
`worktree_registration_residue`, and `FINALIZE` failed closed. A later separate
Development-reported cleanup operation cannot alter those records. Independent review verified
only current absence of the literal/canonical checkout, cache, log, config and artifact roots and
the exact worktree registration/list mapping. Immutable receipt/snapshot/manifest SHA-256 values are
`8b1b6669e7f55df2d93773e1c8d8446ee7c4ea4a552ba261d39679ee958de5ba`,
`55398e75e02544df79be62b8ac72be739ff5a725d159847fa49e4d1a0cf49b6b` and
`1653d957e6af823388792e049a0b87356dc2ac1fe14b4f8219aaed4a946ad677`. No artifact or retry exists.
Exact Attempt 10 was independently `APPROVED` with zero open P0–P3 on published
`a08e2e89a2aa3962b1bc4ddeb0f77e480f1f4f85` / tree
`dbec8fb277b1a915153c765cad4c5a060e0626b4`; its single R3 execution is consumed fail-closed.
Records 1–30 passed. At record 31 both mapped `SYNTHETIC_TYPECHECK` processes exited 0 and the gate
failed with predicate code `synthetic_typecheck_test_not_listed`. The deliberately non-preserved
`--listFilesOnly` output has no persisted normalized count/digest, required path, observed match or
membership boolean. Independent review cannot decide between config exclusion and matcher/path
normalization; config exclusion is unproved and statically unlikely because the tracked Synthetic
tsconfig includes `tests` and the expected tracked test exists. No Harness, TypeScript-configuration
or Product defect is inferred. Records 32–41 are individually omitted; no V2, Node, Metafile,
TalkBack closure or artifact gate ran, and no Harness artifact exists. Snapshot, cleanup
and postcleanup passed; cleanup is complete with all ten manifest flags true, while `FINALIZE`
remains `FAIL_CLOSED`. The external npm-log baseline remained count `11` / SHA-256
`80a1dc655812427ae4541df6e2bd9ece4834efa17bfa9d5e2dec2370a74f79af`. Immutable receipt,
snapshot and manifest are respectively 111,980 / 64,793 / 3,980 bytes with SHA-256
`d4bd5c9566a213abfcd1872bce92cb745414f8f6c682a52ed00f278e74f6f99f`,
`c323f3d6c59936f6c489497e4689d1b44562a26e979717323417d35ebacd914d` and
`081d3c77fa5b044eefd4fa8c0fb1d623af1fb14fcf5ac0c585d28223cbc1b64e`; files are mode `0444`
and their directory mode `0555`. Independent failure/evidence review returned `CHANGES REQUIRED`
with exactly one P2. The current six-file R0 Attempt-11 candidate corrects that overclaim and remains
**REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE**. No retry or resume is authorized.
Hardware/Human/Product V5 remains **DO NOT START**.

The exact Attempt-11 candidate remains **REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE**. Fresh
token `fdf09c30` binds only new canonical `/private/tmp` checkout/cache/log/config paths, new
`attempt11-a0359a87-fdf09c30` artifact/evidence roots and the matching worktree registration.
Executable source/tree remains `a0359a87fd1738c8493929a1661cbbc7adb3c07c` /
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`. The authorization contains the exact 1,437-byte
descriptor, 290-byte npmrc and 72,103-byte direct no-shell 45-gate map, with SHA-256 respectively
`ac819b20cbc26ebb650216012c81a8c9ed76e5468e883e37c8bbd25926e9c9f4`,
`459d76447f1fbd04d46628f7a97e1f69281e3e38eb9b970bfddb480b6c0379c0` and
`9bc2cb1c4bac854126a16b2047cd875537eb32399322cd2212de8587f4236168`. Both Typecheck gates now
require the exact Round-2 byte/decode/LF/CR/terminal-LF/line-limit/path-set pipeline. The line-limit
counter is memory-only; `listed_file_count` is only the final deduplicated canonical-set cardinality,
and raw lists or raw/split line counts never persist. Candidate review returned `CHANGES REQUIRED`
with exactly two P2 corrected here; re-review is pending. All Attempt-10 log, omission, Cleanup V2 and FINALIZE
gates otherwise remain unchanged.

Run 17 remains the historical successful stability/UI/cleanup record:

Run 17 used authorized Validation Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c` / tree
`b32af38c8ac769965ab062762004312d96d0de25` and Execution Repository
`be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176` / tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c` passed exact-head CI `30612797541`,
attempt 1, 12/12. Later R0 `[skip ci]` closure head
`3b544c731d15428334bbadc8e70a3492ef60b886` / tree
`52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries that evidence only and is not the
Exact-Head-CI SHA.

The exact terminal receipts were `artifact:match`, `preflight:match`,
`install_launch:match`, `waiting:match`, `human_pass:match`, `cleanup:match`,
`complete:match`; exit was 0. Human device confirmation matched `SM-A336B`, Android 15/API 35,
build `samsung/a33xnseea/a33x:15/AP3A.240905.015.A2/A336BXXUDFYE3:user/release-keys`, Owner
User 0, 200 % text scale and Samsung TalkBack `15.1.01.1`; package/process/reverse null state
matched. The Human confirmed exactly 10 A, then 10 B, then 10 X, every role 10/10, `NfcA`,
three pairwise-distinct 12-uppercase-hex safe fingerprints, exact final title
`Alle drei Rollen stabil gebunden`, exact final text
`A, B und X sind stabil, eindeutig und voneinander verschieden.` and `PASS`.

The three concrete safe values were not transferred before run-17 cleanup. That historical
operational transfer gap, not a Product, Validation or hardware defect, is now locally mitigated by
run 18. Terminal operator evidence confirms the Validation App was removed.

Run 16 remains historical: it matched `artifact`, `preflight`, `install_launch` and `waiting`,
then stopped at the first physical Tag-A `technology_evidence`. No B/X, Human PASS or retry
occurred; `abort`, `cleanup:match` and `failed:mismatch` closed that run without raw technology,
UID or fingerprint disclosure or a hardware-defect finding.

The Human Architect explicitly decided NfcA-only v1 Product dispatch/Validation. The Technical
Lead delegated only its focused R3 implementation on baseline
`17f4b47b8429d3862789b7e13a23f8da9d28c449`, tree
`4bbfe9e3fdcdf474f1f506135560e4e111122fb5`; this record grants no run authority.

Artifact preparation on approved source `814cb9013be7da98e46a4c36c5d4e716eef4cf46`,
tree `0181c50faf6936ea1236f4454d536bf734334c91`, produced one local read-only Product
Synthetic artifact candidate. After the separately approved APFS Tool-Identity correction, the
authorized rebuild from source and execution commit
`5675297dab94258e50d7371a95e07fe7a77fc51c`, tree
`b32af38c8ac769965ab062762004312d96d0de25`, published one read-only Validation candidate.
Publisher initial, staged and final checks passed. The first standalone verifier invocation from
the retained build checkout stopped at repository readiness because ignored module-build residue
was present; no artifact inspection had begun. The authorized corrected invocation from a fresh
clean execution checkout passed with `da5_v5_validation_artifact_verified`. This first stop is an
operational wrong-location record, not a Contract or Artifact finding.

The Product NfcA/MifareUltralight artifact and the then-current Validation/Operator bindings are
historical **DO NOT INSTALL/DO NOT START**. Artifact Binding Review R1 of the first hardbinding
candidate returned `CHANGES REQUIRED` with one P1 and three P2. The published correction retains
both exact artifacts and binds Validation Artifact Source to the ordered
33-record source closure, whose compact-JSON SHA-256 is
`62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763`.
It removes Execution self-literals, derives the Execution Repository from the loaded readiness
module, cross-checks the exact 59-field Product manifest and attests aapt, apksigner, unzip and
hermesc before and after use. Source and prepublication reviews returned `APPROVED` with zero open
P0–P3. The first final V3 detected one real stale Validation bundle binding: Mobile covered only
53/54 test sources and 1,168/1,169 tests. The focused two-file correction updated the executable
bundle to 2,044,686 bytes / SHA-256
`f33e4ecdf0e0d34e39220be9a96d952f3f9718692e766a6e57bdddd28b3b2a88` and the
555-entry / 2,679,201-source-byte closure to SHA-256
`93224940aeab41a86bef9bf3fc959d85f8d7cbdc69876cf94c900abd5d9c6bdd`; focused
verification passed 8/8 and independent bundle re-review returned `APPROVED` with zero open
P0–P3. The corrected candidate was committed as
`be76ce4a69c8a971ad73b5232082a9e500d8d471`, tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`, parent
`cda51c81255dfd7b8944e7d19efb7d209eae7001`, parent tree
`e2ee3bc6cef96c33e9cce692309891577767f1a7`.

The only complete final V3 on that commit/tree used a research-free sparse safe root and a narrow
ADB-free `PATH`; Node 24.17.0, npm 11.13.0 and PostgreSQL 17.10. It passed `npm ci`, 20/20 builds,
21/21 tests-inclusive typechecks, all 54 Mobile test sources including the changed test, migrations
001–013 apply/replay/ledger for nine databases, 21/21 suites with 151 test files and 2,821 passed
tests plus exactly two documented optional B1 skips, Mobile 54/54 and 1,169/1,169, Synthetic 13/13
and 290/290, C3B verify-bin, the no-install Product preflight, the existing exact Validation
artifact standalone verifier from a fresh clean execution checkout, and an 861-module Expo
Android export. The verifier kept Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c` / tree
`b32af38c8ac769965ab062762004312d96d0de25` with its exact 33-record closure. Ports 55439/55435
and the tracked safe root were clean after cleanup.

Before that complete successful run, the setup wrapper stopped because `npm ci` first ran in the
main checkout instead of the safe root; no gate had started. A later premature Admin-Web build
stopped before its dependency build; no green build was claimed or selectively repeated, and the
complete CI dependency ordering produced the final green run. No ADB command was executed; the
Validation verifier only checked the bound ADB file identity read-only. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176`/tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c` passed exact-head CI `30612797541`, attempt 1,
12/12. Correction
`9c6eec7`/tree `0aaa6de` closed the two docs-only P3 findings, and both independent Exact-Delta
re-reviews returned `APPROVED` with zero open P0–P3. At that historical pre-run checkpoint, this
R0 synchronization carried V3/V4 without a second V3 or CI; the non-hardware preparation was
technically `APPROVED`/`MERGE_READY`, both artifacts were **DO NOT INSTALL**, the operator was
**DO NOT START** and Human Phase 0/hardware was unauthorized. Run 17 later passed under its
separate exact authorization and consumed that authority. Run 18 later established the exact safe
transfer binding and consumed its separate authority. Post-run, both artifacts are again **DO NOT
INSTALL** and the operator **DO NOT START** for every new action; DA5 and R-034 remain open while
R-035 is locally mitigated. The sole read-only no-hardware readiness entry is
`npm run android:da5-v5-validation:verify --workspace=@taptime/mobile`. Its inputs are separate and
must never be collapsed:

| Readiness input class | Explicit variables and current non-executable binding |
|---|---|
| Execution Repository | `DA5_V5_VALIDATION_REPOSITORY_ROOT`, `DA5_V5_VALIDATION_EXECUTION_COMMIT`, `DA5_V5_VALIDATION_EXECUTION_TREE`; root must equal the canonical symlink-free root derived from the loaded readiness module and commit/tree must equal that root's actual HEAD/tree. Current candidate: `be76ce4a69c8a971ad73b5232082a9e500d8d471` / `56abec5e7f2752f5004fe3e8667f47a917429c52` — **DO NOT START** |
| Artifact Source | `DA5_V5_VALIDATION_SOURCE_COMMIT`, `DA5_V5_VALIDATION_SOURCE_TREE`, and for artifact verification `DA5_V5_VALIDATION_SOURCE_CLOSURE`; current artifact source is explicitly `5675297dab94258e50d7371a95e07fe7a77fc51c` / `b32af38c8ac769965ab062762004312d96d0de25`, separate from Execution `be76ce4a69c8a971ad73b5232082a9e500d8d471` / `56abec5e7f2752f5004fe3e8667f47a917429c52`, with the exact 33-record closure |
| Immutable tools | For each of `NODE`, `GIT`, `ADB`, `AAPT`, `APKSIGNER`, `HERMESC`, `UNZIP`: `DA5_V5_VALIDATION_<TOOL>_PATH`, `_BYTES`, `_MODE`, `_SHA256`; hermesc must equal the repository-resolved compiler and unzip must equal `/usr/bin/unzip`; the current execution form supplies these exact bindings, but grants no Human-run authority |
| Android SDK | `ANDROID_HOME` and/or `ANDROID_SDK_ROOT`; if both are supplied they must be identical. ADB, aapt and apksigner must equal their exact SDK-derived paths |
| Artifact files | Exact `DA5_V5_VALIDATION_APK_*` and `DA5_V5_VALIDATION_MANIFEST_*` values from the current candidate rows below |

The readiness path requires current Node to equal `process.execPath`; verifies every tool as a
canonical symlink-free regular executable with exact path/mode/size/SHA-256 and stable identity;
and requires clean state in the Validation source scopes. Its ordinary status call covers staged,
unstaged and untracked state with root `app.json` and `research/**` as explicit top-level
exclusions. A second `status --ignored=matching` call receives only the positive deduplicated
source scopes plus the exact 13-file transitive local `.mjs` import closure, detecting ignored
`.env*` and module-build residue without traversing or listing protected paths;
`apps/mobile/app.json` remains in scope. The mutation-capable operator executes the same readiness
boundary before session creation and before any ADB-capable object exists. Readiness executes Git
only, never ADB. The Product manifest must have exactly one MainActivity TECH+DEFAULT/no-data
filter and one exact metadata reference; compiled APK inspection must bind its numeric resource ID
to the uniquely resolved exact-NfcA XML tree. Duplicate/broader/TAG/NDEF or foreign
activity/activity-alias NFC bindings stop verification. The two ADB runners and APK inspector then
reattest and use their exact bound tool identities; successful completion rechecks stable
dev/inode/path metadata. After operator-abort arbitration, every winning typed child timeout at
reattestation, installed provenance, prelaunch, activity start, postlaunch or installation maps
only to `adb_child_timeout_mismatch`. Blank/foreign input or EOF during an active install is an
operator abort and converges through one cleanup. Native cancel unregister/cleanup-timeout failure
settles capture and remains `cleanup_failed` ahead of cancel/order outcomes. The UI coalesces only
the same active offer, removes it at settlement and rejects stale replay. This is not permission
to build, install or run.

## Historical snapshot — superseded by 2026-08-10 final closure above — non-executable bindings and phase separation

The Runtime Guard is bound to source `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867`,
tree `980b6c57fdd71c12820f2890b640946db0d883c6`, CI `30255104609`, attempt 2,
12/12, and independently approved immutable binary/manifest. Historical query-visibility correction
`5c239b1c30c6263a036077460e23373b767f66df`, tree
`53e8d4ed012ccc662f1005f895a3b6e685cf560e`, passed exact-head CI `30276804017`,
attempt 1, 12/12. Independent Exact-SHA re-review of review base
`11a8269de145ad33c230f55a064bd18f9bb59731`, tree
`2292010e43d2620fbdbba6eeb6a9d77c36674144`, and CI `30277641127`, attempt 1,
12/12, returned `APPROVED` with zero open P0–P3; P1 and P3 are closed. Stopped intermediate
`0f7e131` produced no published artifact.

The exact Validation Runtime correction/review sequence is archived in
`ADO/05_Evidence/Development_Assignment_05_V5_Validation_Runtime_Correction_Independent_Exact_SHA_Review.md`.
Historical correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree
`3e4d1356b859fecf70d365fecbb563e2088100f3`, passed CI `30284566289`, attempt 1,
12/12; independent re-review returned `APPROVED` with zero open P0–P3. Its exact executable Metro
bundle/source closure, ExpoAsset absence, Validation package, local synthetic signer, exact
required native modules and zero forbidden modules or extra permissions are bound. The final
APK/manifest passed the official verifier and independent Artifact Exact-SHA review with zero
open P0–P3 for that exact historical source. The DA5-V5-VAL-UI-01 Controller/UI source correction
historically superseded it: the listed APK/manifest is **HISTORICAL — DO NOT INSTALL**.

**Phase 0 — Validation Binding Preflight** has no new execution authority after successful run 17
consumed its exact authority. Runs 1–16 are consumed without an attributable Tag result; run 17
passed as recorded in Section 0A. Historical run 1 stopped on a preinstalled
Validation package; run 2 on the unsupported Samsung provider in the then-prior build; run 3
because the generic launcher/package resolver did not uniquely start the explicit Activity and
cleaned; run 4
after explicit `.MainActivity` reached cold start but failed on missing ExpoAsset, opening
`DA5-V5-VAL-RUNTIME-01`. Run 5, on repository baseline
`55070aa9a74c2606668caba9dc113ae8d689bd8d`, installed and verified the then-current exact
`7e8c0f7` Validation APK, passed the Human-confirmed device checkpoint and then reached only the generic fail-closed
scan path without a distinguishable cause. No successful or attributable Tag result is Evidence,
and no hardware defect is proven. Cleanup again confirmed package, process and reverse mappings
at zero. Run 6 used ADO baseline `96daac0b3cf1cfe98249a8c94fe927f34ee33af1`, tree
`4e7ccd41a4fda0608a7e9deab7fbc258e1cf94bf`, installed and verified the then-current
`e97bbe9` artifact and passed the Human-confirmed device checkpoint. At the first required A-scan
it showed only `Prüfung sicher gestoppt` /
`Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden`. No cause or Tag result is
attributable and no hardware defect is proven. Cleanup again confirmed package, process and
reverse mappings at zero. Run 7 used ADO baseline
`aebffbec7c72c028ace6365ecdcc413e314526dd`, tree
`9e0104229756fe223753916ace8247ee2626f4d5`, and exact `effc57a` source/artifact. It stopped at
the first required A-scan with the fixed safe failure stage `technology_evidence`. The authority
is consumed; no fingerprint or Tag result exists. Concrete physical `techTypes` were
intentionally not exposed and remain unknown, no hardware defect is proven, and cleanup again
confirmed package, process and reverse mappings at zero.

Run 8 used ADO/code baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree
`10cdf16421fe564e1961a39d79e20775c0269fc4`, and the exact `03694f2` artifact. Installation
succeeded, but an ad-hoc host pathname regex rejected the legitimate Android-15 installed path
solely because it contained `~`. `.MainActivity` was not started, the Validation process was
absent, and no checkpoint, scan, fingerprint or Tag result was reached. Its authority is consumed;
uninstall succeeded and final package, process and global reverse state were zero. This is an
operator-boundary failure, not a Product, NFC or hardware result.

Run 9 used baseline `2f057cb4e5d096e34785c72c51340f589c711dd2`, tree
`6f65f44e53574921f1e8e9fdfde94f7a9a9ade2c`. It emitted exactly `artifact:match`,
`preflight:match`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It reached no
scan or Validation UI handoff. The aggregate receipt cannot reconstruct which install-/launch
boundary failed; no Product, NFC or hardware defect is proven. The authority is consumed, and
terminal cleanup restored package, process and global reverse state to zero.

Run 10 used baseline `b63641953536bb36625fcd42d850e429ddab8db3`, tree
`dc1b9a11e0391074b35139f5948ef6b2c45f1d26`. It emitted exactly `artifact:match`,
`preflight:match`, `stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. Because the then
current `installation` category also summarized verification mismatches before the PackageManager
call, the exact cause is not further reconstructable and the category does not prove that the
install call ran. No Product, APK, NFC or hardware finding is established. The authority is consumed,
terminal cleanup matched, and another run remains **DO NOT START** without fresh exact Human
authorization.

Run 11 used baseline `d8549c3f1d14c15846d4f81dbe7669a598626633`, tree
`04ea2d0571a2e030fe99fbba27b622e68604644e`. It emitted exactly `artifact:match`,
`preflight:match`,
`stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. On that exact
operator, the category proves entry into the existing PackageManager-call boundary but cannot
distinguish a rejected ADB/child transport from a resolved PackageManager operation with a
non-accepted exact `Success` receipt. No Product, APK, NFC or hardware finding is established.
The authority is consumed and terminal cleanup matched.

The authorized focused local correction preserves the FD-/snapshot-bound streaming install,
exact APK/package/user-0 binding, timeouts, fail-closed behavior, zeroization and cleanup. A
rejected install runner maps only to fixed `adb_child_transport_mismatch`; only after the runner
resolves does a non-exact `Success` receipt map to fixed
`package_manager_receipt_mismatch`. Pre-install verification and later Activity categories stay
unchanged. Receipts cannot contain raw errors/stderr, PackageManager output, paths or serials.
Focused verification passes the complete Operator test file 139/139 and the Mobile
tests-inclusive typecheck, with the changed test source proven included. The one complete
safe-root V3 used Node `24.17.0`, npm `11.13.0` and PostgreSQL `17.10`; it passed 20/20 builds,
21/21 tests-inclusive typechecks and 21/21 workspace suites with 2,516 passed tests and exactly
two optional B1 skips. Migrations 001–013 apply/replay/ledger, C3B `verify-bin`, the unchanged
official `03694f2` artifact verifier and an 861-module Android export passed; candidate bytes
matched, and ports `55439`/`55435` plus process state ended at zero. Published candidate
`9549da9cda578c60ca11144221e8030fb95697d3`, tree
`ced33c8d9d9cdef7d628a47147427ed6147b898a`, parent
`d8549c3f1d14c15846d4f81dbe7669a598626633`, passed exact-head CI `30471511446`,
attempt 1, 12/12. Prepublication review round 1 found exactly one P3 ADO-truth gap and no
code/test finding; round 2 approved and closed it. Final independent Exact-Head review returned
`APPROVED` with zero open P0–P3. The correction is technically final; the operator remains
**DO NOT START**.

Run 12 used ADO baseline `3fcbcdec79dada8d43041a241127e52f4775e8d8`, tree
`74cac3e8611e39938e2c52c25df8cde38be254d2`, and exact candidate `9549da9`/tree
`ced33c8`. It emitted exactly `artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_child_transport_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. Its authority is
consumed, terminal cleanup matched, and no Product, APK, NFC or hardware finding is established.

The focused local Run-12 correction changes only the PackageManager streaming invocation from
`shell -T` to `shell -T -x`. The official ADB shell contract defines `-x` as disabling remote
exit-code propagation and stdout/stderr separation. A remote PackageManager rejection therefore
settles the ADB child and reaches the strict single-line parser. Only exact `Success` succeeds.
Fixed allowlisted output forms map to disclosure-safe policy/user, artifact/parse/signature,
installed-state/version/signature-conflict, storage or command-contract/usage categories.
Unknown, malformed or multiline output remains generic `package_manager_receipt_mismatch`; a
real spawn, stream, timeout, abort or ADB-child failure still rejects and maps to
`adb_child_transport_mismatch`. No raw output, code or detail is emitted or persisted. The shared
ADB runner, streaming snapshot, exact artifact/package/user-0 binding, timeouts, zeroization,
provenance, fail-closed behavior and cleanup remain unchanged. Focused Operator regression passes
150/150 and the tests-inclusive Mobile typecheck passes with the test
source included. A complete Mobile attempt passed 51/52 files and 866/867 tests; the sole failure
was the known generated native-output contamination exceeding the locked Validation native-source
closure. It was not retried or removed. The Run-12 install candidate remains V1/V2-focused green.
A later isolated V3 attempt is not recognized as V3: after all 288/288 Synthetic assertions
passed, two post-test PostgreSQL `57P01` events exposed that the local Guard stopped PostgreSQL
before closing its still-live pools. Preceding wrapper setup stops likewise provide no V3
evidence. The Human Architect replaced that contradictory order with successful capability/DB
reattestation, closure of all owned Runtime pools and the active Installer pool, unchanged
binary/lifecycle reattestation and only then `STOP_FAST`. The focused Guard suite passes 78/78 and
the Synthetic workspace tests-inclusive typecheck passes. Final combined candidate
`3a77603825db573bdabb2d4202fe7cca5383c1ed`, tree
`3996b4c27d2970b99e1b407217dd269e62be72ce`, parent
`3fcbcdec79dada8d43041a241127e52f4775e8d8`, passed V3 with 20/20 builds, 21/21
tests-inclusive typechecks and 21/21 suites / 2,529 passed tests / two expected skips, plus
migration, binary, artifact, export and cleanup verification. Exact-head CI `30479752844`,
attempt 1, passed 12/12 without retry. Independent prepublication and final Exact-SHA reviews
each returned `APPROVED` with zero open P0–P3. The Run-12 diagnostic and local Guard cleanup
correction is technically closed; the operator remains **DO NOT START**.

Run 13 used baseline `63feaf48a98e656dcceb395098bea8b260420e16`, tree
`1d635956eb22c9bba99834ca831159741889e83f`. Its complete disclosure-safe receipt sequence was
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_child_transport_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. The read-only device binding
matched before installation. It emitted no `installed_provenance` or `waiting` receipt and
reached no Validation UI, NFC or Tag step. Its authority is consumed, terminal cleanup matched,
and no Product, APK, NFC or hardware finding is established.

The focused Run-13 correction is confined to a Validation-only streaming-install runner; the
shared ADB runner remains unchanged. Child start/transport, timeout, stdin-pipe abort and
nonzero/signal exit are distinct disclosure-safe terminal categories. `EPIPE`/`ECONNRESET`
remains provisional until the same absolute timeout observes actual child close and complete
stdout. Only then may the existing strict single-line PackageManager parser run; exact `Success`
still requires the unchanged installed-artifact provenance proof. Missing or ambiguous terminal
evidence fails closed, and stderr, raw errors, device paths, serials and PackageManager details
remain undisclosed. Focused V1/V2 passes 161/161 tests and the tests-inclusive Mobile typecheck.
The final complete Mobile run passed 52/53 files and 887/888 tests; only the known unrelated generated
native-output contamination exceeded the locked Validation native-source closure, and it was not
retried or removed. Pre-sync ten-file V3 patch SHA-256
`265bdc5b6c5c31897743fdbcc1160deccc2a9c152bb3cca85c7f598ad08899b4` passed fresh,
research-free sparse-safe-root V3 with Node `24.17.0`, npm `11.13.0`, task-owned PostgreSQL
`17.10`, 20/20 builds, 21/21 tests-inclusive typechecks including changed Mobile tests,
migrations 001–013 apply/replay/ledger, 21/21 suites / 150 files / 2,540 passed tests / exactly two
optional B1 Supavisor skips, C3B `verify-bin`, unchanged Validation APK/manifest verifier,
861-module Android export and final ports `55439`/`55435` plus task cleanup matched. Wrapper setup
first lacked `rg` in `PATH` after green builds/typechecks and later omitted the already bound
artifact-verifier environment after all suites; both stopped outside Product verification. The
same safe root continued without code change or retry of green gates, and final exact bindings
passed. That patch was captured while the four ADO files still said `V3 pending`; the subsequent
R0 synchronization changed only those documents, while all six code/test files remained
byte-identical. AVS evidence therefore transfers to round-1 candidate
`a03811011eed2d3ebde1c94e60c42f806bde7ecf`, tree
`b21d39887ea613294ed2d9612fd3fa0ff5025a0e`, parent `63feaf48…`, with six-file
code/test diff SHA-256 `ad34c36fbfc5088252a6bd961c426ccae4fdc3b7b8e212bc25481eb17a390452`
and full ten-file candidate diff SHA-256
`ed0047c1311bc83f664cf67702d8150bc2575d9d88f31449704a480b2ddaa4b8`.
Independent round 1 returned `CHANGES REQUIRED` for exactly this one P3 ADO finding and no code,
security or test finding. The focused ADO-only correction was published as commit
`ac51dfd338c75c4bbc0c73345e4d045924022423`, tree
`3d1f3ddfec3d0f07a1ceea7f5ab87029b18d69a5`, parent
`a03811011eed2d3ebde1c94e60c42f806bde7ecf`, and `origin/main` matched that commit exactly.
V3 evidence transferred under the documented R0 byte-identity boundary and was not rerun.
Exact-head CI `30485438652`, attempt 1, event `push`, completed successfully with 12/12 and zero
failed checks. The independent pre-V4 Exact-Delta review and final independent Exact-Head/V4
review both returned `APPROVED` with zero open P0–P3, closing the P3 and the Run-13 correction
scope technically. This following closure synchronization is R0; its own `[skip ci]` commit and
tree remain pending and are not claimed. No ADB, hardware or installation occurred. This
correction does not authorize another Phase-0 run.

Run 14 used baseline `887801943064d686da40785d64cd1105431c44ac`, tree
`5c15f0fae9c14844b604addf1c38b3bd5203647e`. The Operator session started and emitted exactly
`artifact:mismatch`, `cleanup:match`, `failed:mismatch`. It stopped internally at artifact
verification before preflight, ADB or installation because the cleaned Operator environment did
not retain the exact Android SDK binding. No device/install mutation occurred and the authority is
consumed.

Run 15 used the same exact baseline after binding `ANDROID_HOME` and `ANDROID_SDK_ROOT` to the
already authorized SDK. Offline artifact verification matched, then the Operator emitted
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_stdin_pipe_abort_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` or `waiting` receipt and reached no Validation UI, NFC or Tag step. The
authority is consumed, cleanup matched and no Product, APK, NFC or hardware finding is established.

The focused non-executable `DA5-V5-INSTALL-SESSION-01` candidate replaces the combined one-shot
stream with exact `install-create`, `install-write` and `install-commit` stages under one install
deadline. The exact canonical session ID remains memory-only; the sealed snapshot, `-R`,
package/User-0/size binding, exact write-byte and PackageManager receipts, and installed
SHA/provenance proof remain mandatory. Every known uncommitted session failure triggers one
bounded idempotent `install-abandon` before ordinary cleanup, and cleanup cannot match without
proven session absence or settlement. A partial `EPIPE`/`ECONNRESET` reaches only the existing
strict parser after terminal child/stdout evidence; partial success, empty, malformed or multiline
evidence remains fail-closed. On exact baseline
`887801943064d686da40785d64cd1105431c44ac`, tree
`5c15f0fae9c14844b604addf1c38b3bd5203647e`, the uncommitted nine-path candidate had original
pre-sync diff SHA-256
`1ca772260b64d402b19af6012c15074d2c801c3a63c52790319db056977dc084`. Focused scope passed
179/179. Fresh research-free safe-root V3 passed `npm ci`, 20/20 builds, 21/21 tests-inclusive
typechecks, Mobile test-source inclusion 53/53, migrations 001–013 apply/replay/ledger and 21/21
workspace suites across 150 test files with 2,558 passed and exactly two expected optional B1
Supavisor skips. Mobile passed 53/53 files and 906 tests. C3B `verify-bin`, the unchanged
Validation APK/manifest verifier and an Expo Android export of 861 modules passed; ports
`55439`/`55435` were absent and Guard/task cleanup matched. Prepublication review returned
`CHANGES REQUIRED` with exactly one P3 against the stale ADO V3 binding and no code, test,
security, tenant-isolation, install-session or cleanup finding. This four-file R0 sync is the
historical correction. It and the candidate were published as
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`, tree
`d27432bc6c934a83842c8ca661723f4dd15aaf5b`. Exact-head CI `30547584412`,
attempt 1, passed 12/12 and remains historical green evidence for that exact source. Final
Exact-Head review nevertheless returned `CHANGES REQUIRED` with exactly one P3: after a
successful `install-create` or `install-write`, device re-attestation drift still inherited
`adb_child_transport_mismatch` before the next PackageManager mutation. The published candidate
is not closed, and that CI remains predecessor-only evidence. This authorized focused additional
round keeps both re-attestation boundaries at `verification_mismatch` and switches to
`adb_child_transport_mismatch` only immediately before `install-write` or `install-commit`.
Focused V1/V2 passes the changed MJS syntax check, the complete Operator file at 171/171 and the
tests-inclusive Mobile typecheck with the changed test source included. The only new final V3 is
complete for the uncommitted six-path candidate on baseline
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`, tree
`d27432bc6c934a83842c8ca661723f4dd15aaf5b`; its pre-sync diff SHA-256
`d5c99d072415198e28c6fd2bf97d4b81869ed6fcff5a759606ba6bd56b415683` remained exact
throughout V3. A research-free sparse Safe Root with a narrow ADB-free `PATH` passed `npm ci`,
20/20 builds, 21/21 tests-inclusive typechecks, Mobile source inclusion 53/53, migrations 001–013
apply/replay/ledger and 21/21 workspace suites across 150 test files with 2,560 passed and exactly
two expected B1 skips; Mobile passed 53/53 files and 908 tests. The protection check first stopped
before `npm ci` because global `adb` was visible; narrowing `PATH` meant no V3 gate had started or
was repeated. The artifact-verifier wrapper stopped before the verifier because it named the
wrong absolute `jq` path; with `/usr/bin/jq`, the first actual verifier run passed and no green
stage was repeated. C3B `verify-bin`, unchanged Validation APK/manifest verification and an Expo
Android export of 861 modules passed. Ports `55439`/`55435` were clear, task/Guard cleanup matched
and the Safe Root was recoverably moved to Trash. The exact six-path implementation diff SHA-256
`e11b9a0a7aaad54c7416d680feffdbdefce793d298e320a70dd5868c96d99927` was published as
`4067f629f12ee0fa2994de0e4b64946924dc5e6f`, tree
`10629b848a7ad6435a2f9683d6f700d327d28f8d`, on parent
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`. Exact-head push V4 `30552233999`, attempt 1,
passed 12/12 without retry. Final independent Exact-Head/V4 review returned `APPROVED` with zero
P0–P3; the correction is technically closed and `MERGE_READY`, but not Human-run-ready.
Historical CI `30547584412` remains predecessor history. This four-document closure sync is R0:
executable/test blobs remain byte-identical to `4067f62`, V3/V4 carry forward, and a second CI is
neither required nor authorized. The closure-sync commit/tree remain pending and unclaimed. It
grants no new Phase-0, Human-run, ADB, installation or hardware authority and remains **DO NOT
START**.

The focused local Run-10 diagnostic correction preserves every stage, aggregate receipt,
mutation, cleanup and terminal boundary. A pre-install device re-attestation mismatch remains
`installation` + `verification_mismatch`; the category changes to `operation_mismatch` only
immediately before the PackageManager install call. The regression proves zero install
mutation/call, exact aggregate/terminal ordering and no synthetic-secret disclosure, while the
existing true install-failure matrix remains `operation_mismatch`.

Combined V2/V3 on the unchanged 950-file tracked candidate used Node `24.17.0`, npm `11.13.0`
and task-owned PostgreSQL `17.10`. Carried isolated evidence supplied 20/20 builds, 21/21
tests-inclusive typechecks, Mobile 52/52 test-source inclusion, suites 1–8 and migrations 001–013
apply/replay/ledger. Fresh authorized continuation supplied suites 9–21, C3B `verify-bin`, the
official unchanged `03694f2` verifier and one isolated Android export. Overall, 21/21 suites
passed across 149 test files and 2,515 tests with exactly two optional B1 Supavisor skips; Android
bundled 861 modules. No V4 was executed locally, and no ADB, installation or hardware action
occurred.

The install-category correction is technically final and published as
`12d1ace89494851025555d1d06d45570c4fcc4cb`, tree
`b747b4306637d90765b33f273ad89291bd4ea9a7`, on exact parent
`b63641953536bb36625fcd42d850e429ddab8db3`. Its exact code/test delta is limited to
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`; the published six-file delta
contains only the four synchronized ADO truth files in addition. V2/V3 above are green.
Exact-head V4 CI `30466798295`, attempt 1, completed successfully 12/12. The prior round-2 delta
review and final independent Exact-Head/V4 review returned `APPROVED` with zero open P0–P3,
closing the round-1 P2. At that historical checkpoint, all ten Phase-0 authorities were consumed;
the operator remains
**DO NOT START**, with no new Phase-0, hardware, ADB, installation or Product Human-V5 authority.

Non-code preparation stops remain explicit: contaminated main-workspace native dependency outputs
exceeded the fail-closed source-closure bound; the first clean safe-root lacked required contract
entrypoints before Mobile; B1 first lacked its required synthetic runtime password; the first
verifier binding supplied paths instead of 32 `{path, sha256}` records; and the first Expo
invocation used an unsupported positional project path. Each stopped fail-fast without an
unchanged retry. Separately authorized runner-only continuations passed every remaining gate and
cleaned all task-owned database, port and temporary-root state.

### 0.1 Approved Validation Phase-0 operator correction — non-executable

The focused correction is published as
`083fdfb259089d976e48f824e0862f10637d3290`, tree
`24bd130500934c6a48fd9314fa06387d6ebdedcd`, exact parent
`39a6ef09fad18375af025bc8ed12cc1ea6dda964`, and consists of
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs`, its `.d.mts`, the thin direct CLI
`apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`, plus the minimal shared
Android ADB-runner `.mjs`/`.d.mts` deadline correction and its already focused runner test. It has
no package script. It
fixes the exact `03694f2` APK/manifest/source closure, requires one exact USB device plus
Human-bound model/build inputs and exactly one non-headless running Owner User 0, requires complete
user-0 package null, accepts bounded legitimate Android installed paths, streams only a stable
verified host snapshot to `cmd package install -R --user 0`, proves installed bytes, version and
identity before latching ownership, launches only
`com.tim180201.mobile.validation/.MainActivity` as user 0, and owns fail-closed conditional user-0
cleanup without creating or removing reverse mappings. It re-attests the ownership token before
force-stop and again before version-conditional uninstall; absent, ambiguous or changed
provenance is preserved and returns mismatch.

The historical install-/launch-diagnostic predecessor
`8ce03852e782d541319bb852f216cf596ab1787f`, tree
`f5b914c1b8f1243244733808beaef54f0351a563`, on parent
`2f057cb4e5d096e34785c72c51340f589c711dd2` keeps that aggregate, ownership, deadline, cleanup
and terminal protocol unchanged. Its exact eight-file +488/-132 delta has patch SHA-256
`c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`. On failure it adds
exactly one disclosure-safe receipt for the matching boundary: `installation`,
`installed_provenance`, `prelaunch`, `activity_start` or `postlaunch`. Its required category is
closed to `operation_mismatch` or `verification_mismatch`; the category follows only the fixed
local control-flow boundary and never `Error.message` or command output. The diagnostic receipt
immediately precedes the existing `install_launch:mismatch`. V1/V2 executed green with both MJS
syntax checks, the complete affected Operator test file at 137/137 and the Mobile tests-inclusive
typecheck including the changed test source. Unchanged green V3 from `496ca59`/tree `b398b89` is
carried. Exact-head CI `30459539801`, attempt 1, passed 12/12; independent
Exact-Delta/Commit/Tree/CI review returned `APPROVED` with zero open P0–P3. The operator remains
**DO NOT START** and this approval grants no Phase-0, installation, ADB, hardware or Product
Human-V5 authority; any run requires separate fresh exact Human authorization.

#### Historical published readiness candidate and consumed failed V4/review

The published eight-file candidate
`496ca59f0965670b29a210b8aa2443b99bb4a386`, tree
`b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`, starts from exact baseline
`fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree
`da69081517d2b0b9631eaef393b0a6022735061e`. It remains **DO NOT START**. It changes no
Validation App, APK, manifest, artifact, NFC acceptance rule, dependency, lockfile, schema,
Product rule or later Product-Human-V5 workflow. It also does not supersede the mandatory R3
Harness-artifact closure and independent review prerequisite.

The final fresh detached sparse safe-root V3 bound executable-patch SHA-256
`5dea48121b62fe7ebb4894f72425aa5ef5f759e113c3dd349f9fd48bb29fe9b4` and exact Node
`24.17.0`/npm `11.13.0`/task-owned PostgreSQL `17.10`. The first alphabetical build aggregate
passed 15/20 and stopped five dependency-sensitive builds before their fresh internal declarations
existed; only those five were continued topologically and passed 5/5 with candidate bytes
unchanged, completing 20/20 unique builds. All 21/21 tests-inclusive typechecks and 21/21 suites
passed across 148 test files, 2,505 tests and exactly two optional B1 Supavisor skips. Migrations
001–013 applied, replayed with `applied=none` and passed ledger verification; C3B `verify-bin`,
52/52 Mobile test-source inclusion, the unchanged official artifact verifier and one isolated
861-module Android export passed. The exact task PostgreSQL was stopped, ports 55437 and 55435
were absent, and the complete task root was moved recoverably to Trash. The subsequent four-file
ADO synchronization was R0 over unchanged executable/test bytes. The safe-root V3/eight-file
candidate itself has no code finding.

Exact-candidate CI `30427205223`, attempt 1, completed failure with 11/12 jobs. Job
`90496143535` became red after its 3/3 files and 121/121 assertions passed because a subsequent
unhandled PostgreSQL `57P01` occurred on `taptime_c3e1_dirty_*`. The C3E1 test, backend and
workflow are unchanged; the test blob is identical to green `083fdfb` and five previous green CI
runs. The cause is the `dirtyPool.end()` to immediate `DROP DATABASE ... WITH (FORCE)` sequence
racing asynchronous client-end handling in `pg-pool@3.14.0`. Independent formal review returned
`CHANGES REQUIRED` with exactly one P2 outside the candidate scope for CI/test reliability and no
Product or Security finding. No retry was authorized or executed. At that historical checkpoint,
a focused harness correction and new CI required new Human authority.

#### PostgreSQL test-cleanup correction and technical closure

The subsequently authorized focused test-only correction is
`21e518151a3f4727ebf4ce90cd1557660960ff21`, tree
`8f764f9260378b631b4b026355852c324d6dc06b`, on exact parent
`d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree
`753feedcae6724e711557e6492bbe26fa0b02083`. Its seven-file test-only delta is +192/-12 with
SHA-256 `b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`.
The known B3, C3B, C3C and C3E1 dirty-database finalizers now wait boundedly for zero sessions
of the exact bound test database after `Pool.end()` and then drop it without `FORCE`; the
separate pre-test cleanup and C3E2 remain unchanged.

Focused V1 passed 2/2. V2 passed B3 128/128, C3B 60/60 and C3C+C3E1 102/102; the three
tests-inclusive typechecks passed. The unchanged safe-root V3 evidence from
`496ca59`/tree `b398b89` was carried forward because product, operator, Validation App/artifact,
workflow, dependencies and lockfile did not change. Exact-head CI `30429746848`, attempt 1,
passed 12/12 without retry. Independent source/delta and final Exact-SHA/V4 reviews returned
`APPROVED` with zero open P0–P3, closing the historical P2. This technical closure grants no
Phase-0, installation, ADB, hardware, device/Tag or Product Human-V5 authority; the operator
remains **DO NOT START**.

The readiness delta uses the Android-Toybox-compatible exact process query
`ps -A -w -o NAME:4`. Only the exact unpadded header `NAME` and unpadded, whitespace-free process
rows are accepted; `-w` preserves full package and `package:process` names instead of silently
truncating them. Any header, padding, column or row deviation fails closed.

The following checks are **INFO-only pre-authority readiness**, not a Helper, wrapper, start or
hardware authorization:

1. Use the canonical repository CWD
   `/Users/timbartz/Dokumente/GitHub/taptime` and require its canonical real path to be identical.
2. Bind the separately named Execution Repository commit/tree and require clean staged, unstaged
   and untracked Validation source scopes, retaining the explicit `research/**` and root-`app.json`
   exclusions without listing either protected path.
3. Resolve and bind canonical absolute Node, Git, ADB, aapt and apksigner paths plus exact regular
   executable mode, byte size and SHA-256; Node must equal `process.execPath`, and Android tools
   must equal the SDK-derived paths. Do not rely on aliases, shell functions or PATH substitution.
4. Start the future operator only from a cleaned environment with `NODE_OPTIONS` unset and without
   `ADB_SERVER_SOCKET`, `ANDROID_ADB_SERVER_PORT`, `ANDROID_SERIAL`, `ADB_VENDOR_KEYS` or any other
   ADB override. These checks may not install, launch, contact hardware or change system state.

The direct future invocation shape is:

```sh
TAPTIME_DA5_V5_VALIDATION_PHASE0_PROFILE=da5-v5-validation-phase0 \
TAPTIME_DA5_V5_VALIDATION_DEVICE_MODEL='<future exact Human-authorized model>' \
TAPTIME_DA5_V5_VALIDATION_ANDROID_BUILD='<future exact Human-authorized build fingerprint>' \
node apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs
```

This is a protocol description, not execution authority. After automatic preflight, an authorized
operator enters exact `install-launch`. Receipt `waiting:match` is only the handoff to the
separately authorized Human sequence below; it is not a UI attestation.

Any future independently approved install-launch failure must emit exactly one of the five fixed
stage/category receipts above immediately before the aggregate `install_launch:mismatch`. The
PackageManager install uses exact `shell -T -x` so a remote rejection reaches only the strict
single-line parser. Only exact `Success` succeeds. Fixed allowlisted forms may emit only the safe
policy/user, artifact/parse/signature, installed-state/version/signature-conflict, storage,
command-contract/usage or generic receipt category; unknown, malformed and multiline output is
generic. True local ADB/child failures continue to reject before it. Raw errors, codes, details,
installed paths, device serials and PackageManager output remain prohibited.

After `waiting:match`, the future Human and operator must perform exactly this sequence:

1. On the Validation UI require the exact title
   `Geräte- und Bedienungshilfen-Bindung prüfen` and exact text
   `Alle angezeigten Werte exakt mit dem Hardware-Runbook abgleichen.` Compare the displayed
   model, Android release/API/build, exact **200 %** font scale and TalkBack package/version with
   the future authorization. Exactly one installed and active provider is permitted:
   `com.google.android.marvin.talkback` at the authorized version or
   `com.samsung.android.accessibility.talkback` at the authorized version. None, both, a different
   package or a different version fails closed. Only after exact equality may the Human activate
   `Gerätebindung exakt bestätigen`.
2. Perform exactly 30 separate successful stable physical presentations in the fixed order:
   ten Tag-A presentations for role A, then ten Tag-B presentations for role B, then ten Tag-X
   presentations for role X. This is **10 A + 10 B + 10 X**, not three scans. At every
   presentation use only the physically matching marked Tag for the active role; no substitution,
   interleaving or out-of-order role is allowed.
3. Require each role to finish at `10 / 10`, require three pairwise-distinct disclosure-safe
   12-uppercase-hex SHA-256 fingerprints and require the displayed Technology value `NfcA` for
   every role. The future superseding boundary requires fully qualified
   `android.nfc.tech.NfcA`; additional or duplicated Android technologies are ignored for the
   decision and are neither displayed nor persisted. MifareUltralight alone is insufficient. No
   raw UID, payload or raw Technology list may be recorded.
4. After the thirtieth successful presentation require the exact final title
   `Alle drei Rollen stabil gebunden` and exact final text
   `A, B und X sind stabil, eindeutig und voneinander verschieden.`
5. Only after personally confirming every preceding UI observation does the trusted Human state
   exact `PASS`. The operator then enters exact `human-pass` once, requires the unique receipt
   `human_pass:match`, and only then enters exact `cleanup`.

The operator does not infer or independently attest UI truth. `human-pass` is the explicit
one-time trusted Human handoff after the runbook-bound UI sequence. It is valid only once in
`waiting`; it moves the session into a separate Human-passed state. `cleanup` from `waiting` is a
failure, and cleanup can satisfy success only from that Human-passed state. Early, duplicate,
late, foreign or out-of-order input fails closed. Exact `abort` starts the same one-time
fail/cleanup flight from every pre-completion state.

Any Cancel, timeout, safe failure stage, failure title/text, ambiguity, wrong Tag/role/order,
non-distinct fingerprint, Technology mismatch or desire to reset consumes the authority. Do not
press `Lokale Nachweise löschen`, retry, repair, resume or reuse an observation; enter exact
`abort` immediately and complete cleanup.

The catchable signals are exactly `SIGHUP`, `SIGINT`, `SIGQUIT` and `SIGTERM`. Repeated or mixed
delivery uses the same idempotent fail/cleanup flight, and all four handlers remain active until
cleanup and terminal settlement finish. `SIGKILL` and `SIGSTOP` are not catchable and are
therefore explicitly excluded from the protocol; they cannot produce a valid terminal receipt or
successful evidence.

The first finish/abort request starts one absolute deadline shared by active-operation settlement
and cleanup; every cleanup wait and ADB call is capped to its remaining budget, expiry cannot
match, and the shared text/binary ADB runner force-settles after SIGKILL grace even without child
close. `complete:match` is emitted only after Human-PASS receipt, cleanup, deadline and all prior
receipt preconditions succeed. It is terminal and can never be followed by `failed:mismatch`.
A failed path emits only terminal `failed:mismatch`, and the CLI exits nonzero. Conversely,
`complete:match` makes the CLI exit zero. This terminal result proves only the combined
Human-PASS handshake plus operator/cleanup success; it is not APK approval, a Product-Human-V5
pass or production authority.
The final post-R1-correction safe-root V3 passed 20/20 builds, 21/21 tests-inclusive typechecks,
21/21 workspace suites covering 148 test files and 2,484 passed tests with exactly two documented
optional B1 skips, migrations 001–013 apply/replay/ledger, C3B binary verification, 52/52 Mobile
test-source inclusion, the unchanged official Validation artifact verifier and Android export of
861 modules. One initial Synthetic invocation exposed only the sparse-runner omission of tracked
`.github/workflows/ci.yml`; materializing that tracked directory and executing only the affected
adapter file passed 31/31, completing the unique Synthetic matrix at 288/288 without changing
candidate bytes.
Historical formal review R1 returned `CHANGES REQUIRED` with exactly the two corrected P1
findings above. Exact-head CI `30402655381`, attempt 1, passed 12/12 on the correction.
Independent Exact-SHA re-review round 2 returned `APPROVED` with zero open P0–P3 and closed both
P1 findings. The candidate remains **DO NOT START** and grants no Phase-0, installation, ADB,
hardware or Product Human-V5 authority.

`DA5-V5-VAL-UI-01` tracks the repository-visible accessibility/UI reliability gap:
identical repeated TalkBack activations require a separate one-shot/coalescing boundary while
true concurrent, out-of-order and foreign Controller calls remain strict fail-closed. Its focused
correction source `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`, tree
`2958f456875e8dab3f10834df280e10a8438efce`, passed exact-head CI `30370977809`,
attempt 1, 12/12. Round-2 and Round-3 source reviews plus the formal independent Source/Artifact
Exact-SHA review returned `APPROVED` with zero open P0–P3. The exact replacement APK/manifest
passed the official verifier and that independent review. Because the following native-capture
diagnostics correction changes the Validation source, the `e97bbe9` APK/manifest is now
**HISTORICAL — DO NOT INSTALL**.

The now-historical diagnostics correction source is
`effc57a6780ff86784de0519a34abd6c5b7b8cd6`, tree
`758dbfaa04d0968fb25122352055fbcb80f8f022`, with exactly seven authorized changed files.
It adds six closed, typed, fixed-allowlist and disclosure-safe stages for Technology evidence,
UID readability, listener/registration, digest, concurrency and cleanup. It emits no raw UID,
payload, Technology list, provider diagnostic, exception text or Logcat; NFC acceptance,
timeouts and Controller fail-closed behavior are unchanged. V3 passed 20/20 builds, 21/21
tests-inclusive typechecks and 21 workspace suites / 147 test files / 2,373 tests, with exactly
two documented optional B1 skips. Migrations 001–013 apply/replay/ledger, C3B CLI and Android
export passed. The initial Synthetic stop was solely a Technical-Lead runner database-name
configuration; the previously unexecuted unchanged suite passed 288/288 on a fresh exact
database. No ports or temporary residue remained. Exact-head CI `30377569479`, attempt 1, passed
12/12. Independent source review and final prepublication review returned `APPROVED` with zero
open P0–P3. The exact replacement APK/manifest below passed independent Artifact Exact-SHA review
with zero open P0–P3.

These reviews close only their exact historical repository/source/artifact correction. Run 7 and
repository inspection confirm `DA5-V5-VAL-TECH-01`: the `effc57a` helper imposed a closed
Technology allowlist, maximum length and duplicate rejection. Focused correction source
`03694f2d877bc323791e93473ad01ceb82af70df`, tree
`6c6039683e067ef29f1f917a60c2628d26e38784`, passed exact-head CI `30386552118`,
attempt 1, 12/12; prepublication review round 2 returned `APPROVED` with zero open P0–P3.
Both fully qualified `android.nfc.tech.NfcA` and
`android.nfc.tech.MifareUltralight` were required by that historical contract, while additional
or duplicated entries were ignored. This is superseded by the NfcA-only correction and is not a
future instruction. The exact historical replacement APK/manifest below passed
the official verifier and independent Source/Artifact Exact-SHA review with zero open P0–P3. It
remains **DO NOT INSTALL** because no separate Phase-0, installation, ADB or hardware authority
exists.

The historical safe stage did not reveal the concrete physical `techTypes` and proved no
fingerprint, Tag result or hardware defect. The later successful run 17 bound the independently
approved exact Product/Validation/operator set, Galaxy A33, OS/build/accessibility values and
three Human-confirmed distinct safe A/B/X fingerprints. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176`/tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c` passed exact-head CI `30612797541`, attempt 1,
12/12; both Exact-Delta re-reviews of docs-only correction `9c6eec7`/tree `0aaa6de` returned
`APPROVED` with zero open P0–P3. Later R0 `[skip ci]` closure
`3b544c731d15428334bbadc8e70a3492ef60b886`/tree
`52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries that evidence only and is not the
Exact-Head-CI SHA. This is carried evidence only and is not exact-head CI for run-18 ADO baseline
`5a0d59c` or this R0 synchronization. Run-17 authority is consumed; run 18 separately established
the transfer binding A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE` and consumed its
exact authority. Both artifacts are **DO NOT INSTALL** and the operator is **DO NOT START** for
every new action. No APK listed below may be installed under current authority; all entries are
non-executable audit bindings. **Historical snapshot — superseded by the 2026-08-10 final
closure above:** every `Current` label in the table below is snapshot-local, non-normative and
must not be used for a future Product run. At that checkpoint the R3 Harness-artifact closure and
independent review still had to pass. They later passed only as recorded in the top closure;
no auth, network, database, Product action or timekeeping is authorized by this historical table.

| Phase 0 artifact | Exact binding |
|---|---|
| Runtime Guard binary | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-runtime-guard/ba1b6e922ceb7902ecedd9dc2df01d6b22d90867/da5_v5_runtime_guard`; 74,336 bytes; mode `0555`; SHA-256 `4b2a7e6b15d3348dffda94f9125c20a4db82bb8eb08a03aabd35932ad0d5853c` |
| Runtime Guard manifest/review | Same directory, `guard-manifest.txt`; 19,971 bytes; mode `0444`; SHA-256 `957d6e99c271663763945026995e7463cf2f20b385eb942fd16a152d3de5f709`; focused evidence SHA-256 `440928371f7acc48272eff2e819c37a851d66cae4a908ffa330228982328d708`; independent Exact-SHA `APPROVED`, zero open P0–P3 |
| Current NfcA-only Product source — DO NOT INSTALL | `814cb9013be7da98e46a4c36c5d4e716eef4cf46`; tree `0181c50faf6936ea1236f4454d536bf734334c91`; source/prepublication reviews `APPROVED`, zero open P0–P3; current operator candidate final V3 passed |
| Current NfcA-only Product APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90/app-release-fd0886dc1c393d3b.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96` |
| Current NfcA-only Product manifest — DO NOT INSTALL | Same directory, `artifact-manifest.txt`; 1,964 bytes; mode `0444`; SHA-256 `c0645dda543394cba9d6029b41a23aff5bcb5d0d805e3e944d9f8f880d1d5639` |
| Current Product package/runtime boundary | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; one v2 signer, v1/v3/v3.1/v4 false; certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; compiled unique exact-NfcA resource and packaged runtime matched |
| Current Validation Artifact Source — DO NOT INSTALL | `5675297dab94258e50d7371a95e07fe7a77fc51c`; tree `b32af38c8ac769965ab062762004312d96d0de25`; exact 33-record closure |
| Current Validation Execution Repository — DO NOT START | `be76ce4a69c8a971ad73b5232082a9e500d8d471`; tree `56abec5e7f2752f5004fe3e8667f47a917429c52`; parent `cda51c81255dfd7b8944e7d19efb7d209eae7001`, parent tree `e2ee3bc6cef96c33e9cce692309891577767f1a7`; canonical loaded-module root and actual HEAD/tree matched in final V3 |
| Pre-run ADO/V4/re-review closure | ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176`/tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`; exact-head CI `30612797541`, attempt 1, 12/12; docs-only correction `9c6eec7`/tree `0aaa6de`; both Exact-Delta re-reviews `APPROVED`, zero open P0–P3; later R0 `[skip ci]` closure `3b544c731d15428334bbadc8e70a3492ef60b886`/tree `52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries the evidence only and is not the Exact-Head-CI SHA; at that checkpoint no Human/hardware authority. Run 17 later passed under separate exact authorization, which is now consumed |
| Current Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-5675297dab94-3d5450f257eda716/app-release-3d5450f257eda716.apk`; 65,634,553 bytes; mode `0444`; SHA-256 `3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144` |
| Current Validation manifest/closure — DO NOT INSTALL | Same directory, `manifest-5675297dab94.json`; 6,855 bytes; mode `0444`; SHA-256 `1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a`; 33 ordered source records; compact-JSON SHA-256 `62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763` |
| Current Validation bundle/source closure | Executable Metro bundle 2,044,686 bytes / SHA-256 `f33e4ecdf0e0d34e39220be9a96d952f3f9718692e766a6e57bdddd28b3b2a88`; 555 entries / 2,679,201 source bytes / SHA-256 `93224940aeab41a86bef9bf3fc959d85f8d7cbdc69876cf94c900abd5d9c6bdd`; focused 8/8 verification and independent bundle re-review `APPROVED`, zero open P0–P3 |
| Current Validation artifact publication/verification | Publisher initial/staged/final `PASS`; exact existing artifact verifier returned `da5_v5_validation_artifact_verified` from a fresh clean execution checkout at `be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree `56abec5e7f2752f5004fe3e8667f47a917429c52`, while preserving Artifact Source `5675297dab94258e50d7371a95e07fe7a77fc51c` / tree `b32af38c8ac769965ab062762004312d96d0de25` and its exact 33-record closure; no ADB command was executed. The earlier retained-build-checkout readiness stop occurred before artifact inspection and is not an Artifact finding |
| Historical `effc57a` Validation source/review/CI — DO NOT INSTALL | `effc57a6780ff86784de0519a34abd6c5b7b8cd6`; tree `758dbfaa04d0968fb25122352055fbcb80f8f022`; exactly seven authorized changed files; exact-head CI `30377569479`, attempt 1, 12/12; independent source review and final prepublication review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation V3 | 20/20 builds; 21/21 tests-inclusive typechecks; 21 workspace suites / 147 test files / 2,373 tests; exactly two documented optional B1 skips; migrations 001–013 apply/replay/ledger, C3B CLI and Android export passed. Initial Synthetic stop solely from Technical-Lead runner database-name configuration; previously unexecuted unchanged suite passed 288/288 on a fresh exact database; no port or temporary residue |
| Historical `effc57a` Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-effc57a6780f-e423073e51f72a68/app-release-e423073e51f72a68.apk`; 65,631,681 bytes; mode `0444`; SHA-256 `e423073e51f72a68421c8e4afd17a9b86c397ca83628deaf4b174543d817330f`; Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation manifest — DO NOT INSTALL | Same directory, `manifest-effc57a6780f.json`; 6,700 bytes; mode `0444`; SHA-256 `9d1238e821d92b26ed9bc9b9ee8ccd48607280ff0d0e752ec6965827c68ccc22`; Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation package/security boundary | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; signing scope `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup disabled; no Product deep links or Tag dispatch |
| Historical `effc57a` Validation native/source closure | Metro source closure 555 entries / 2,675,576 bytes / SHA-256 `e9fee0629af81357e4563836f9f5ef2b404c1ef97bc135d1cb3ed410f713b593`; executable 2,040,604 bytes / SHA-256 `c24457514436a63878107e1593dc90c6de17ad2424a6b625a6f18a14f66b8cfe`; unchanged native source 123 directories / 587 entries / 464 files / 1,176,224 bytes / SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |
| Historical `effc57a` Artifact Exact-SHA review | `APPROVED`, zero open P0–P3; all 32 manifest source-closure files byte-exact; package/signature/version, NFC-only permission, backup/transfer disabled, cleartext/network blocked and no Product dispatch/deep link; DEX 4 required present / 14 forbidden absent; Hermes Validation markers present and Product/network/database/storage markers absent |
| Historical `DA5-V5-VAL-TECH-01` source/review/CI | `03694f2d877bc323791e93473ad01ceb82af70df`; tree `6c6039683e067ef29f1f917a60c2628d26e38784`; exact-head CI `30386552118`, attempt 1, 12/12; prepublication review round 2 `APPROVED`, zero open P0–P3 |
| Validation Phase-0 operator source/review/CI — DO NOT START | Baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree `10cdf16421fe564e1961a39d79e20775c0269fc4`; candidate `083fdfb259089d976e48f824e0862f10637d3290`, tree `24bd130500934c6a48fd9314fa06387d6ebdedcd`; exact-head CI `30402655381`, attempt 1, 12/12; independent Exact-SHA re-review round 2 `APPROVED`, zero open P0–P3; both round-1 P1 findings closed; no Phase-0, installation, ADB or hardware authority |
| Final install-category correction/review — DO NOT START | Candidate `12d1ace89494851025555d1d06d45570c4fcc4cb`; tree `b747b4306637d90765b33f273ad89291bd4ea9a7`; parent `b63641953536bb36625fcd42d850e429ddab8db3`; exact code/test delta limited to the Operator core and focused runtime test, plus four synchronized ADO truth files; V2/V3 green; exact-head V4 CI `30466798295`, attempt 1, 12/12; prior round-2 delta review and final independent Exact-Head/V4 review `APPROVED`, zero open P0–P3; round-1 P2 closed; no Phase-0, installation, ADB or hardware authority |
| Run-12 diagnostic/local Guard cleanup correction — technically closed/DO NOT START | Candidate `3a77603825db573bdabb2d4202fe7cca5383c1ed`; tree `3996b4c27d2970b99e1b407217dd269e62be72ce`; parent `3fcbcdec79dada8d43041a241127e52f4775e8d8`; V3 20/20 builds, 21/21 tests-inclusive typechecks, 21/21 suites / 2,529 passed / two expected skips plus migration/bin/artifact/export/cleanup match; exact-head CI `30479752844`, attempt 1, 12/12 without retry; independent prepublication and final Exact-SHA reviews `APPROVED`, zero open P0–P3; no Phase-0, installation, ADB, hardware or Product Human-V5 authority |
| Historical install-/launch-diagnostic predecessor/review — DO NOT START | Candidate `8ce03852e782d541319bb852f216cf596ab1787f`; tree `f5b914c1b8f1243244733808beaef54f0351a563`; parent `2f057cb4e5d096e34785c72c51340f589c711dd2`; exact eight-file +488/-132 delta; patch SHA-256 `c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`; V1/V2 executed green; unchanged V3 carried from `496ca59`/tree `b398b89`; exact-head CI `30459539801`, attempt 1, 12/12; independent Exact-Delta/Commit/Tree/CI review `APPROVED`, zero open P0–P3; no Phase-0, installation, ADB or hardware authority |
| Historical published Phase-0 readiness candidate — DO NOT START | Candidate `496ca59f0965670b29a210b8aa2443b99bb4a386`, tree `b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`; exact baseline `fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree `da69081517d2b0b9631eaef393b0a6022735061e`; Toybox process parsing, explicit one-time `human-pass`, deterministic terminal receipt ordering, four catchable signals and exact 30-presentation Human protocol; safe-root V3/eight-file candidate has no code finding; exact-candidate CI `30427205223`, attempt 1, failed 11/12 after job `90496143535` passed 3/3 files and 121/121 assertions but emitted later unhandled PostgreSQL `57P01` on `taptime_c3e1_dirty_*`; formal review `CHANGES REQUIRED`, exactly one P2 CI/test-reliability finding, no Product/Security finding; no retry |
| PostgreSQL test-cleanup correction — technically closed/DO NOT START | Candidate `21e518151a3f4727ebf4ce90cd1557660960ff21`, tree `8f764f9260378b631b4b026355852c324d6dc06b`; parent `d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree `753feedcae6724e711557e6492bbe26fa0b02083`; seven test-only files, +192/-12, delta SHA-256 `b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`; V1 2/2, V2 B3 128/128 + C3B 60/60 + C3C/C3E1 102/102 and three tests-inclusive typechecks passed; unchanged green V3 carried from `496ca59`; exact-head CI `30429746848`, attempt 1, 12/12 without retry; independent source/delta and final Exact-SHA/V4 reviews `APPROVED`, zero open P0–P3; historical P2 closed; no hardware authority |
| Historical `DA5-V5-VAL-TECH-01` candidate APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd/app-release-d2084486b07f27bd.apk`; 65,631,433 bytes; mode `0444`; SHA-256 `d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; official verifier `PASS`; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `DA5-V5-VAL-TECH-01` candidate manifest — DO NOT INSTALL | Same directory, `manifest-03694f2d877b.json`; 6,700 bytes; mode `0444`; SHA-256 `aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`; all 32 source-closure entries matched; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `DA5-V5-VAL-TECH-01` package/security boundary — DO NOT INSTALL | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup/transfer denied; no Product deep links or Tag dispatch; required native modules present, forbidden modules absent; Validation marker present and Product runtime marker absent |
| Historical `e97bbe9` Validation source/review/CI — DO NOT INSTALL | `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`; tree `2958f456875e8dab3f10834df280e10a8438efce`; exact-head CI `30370977809`, attempt 1, 12/12; Round-2/Round-3 source reviews and formal Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `e97bbe9` Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-e97bbe9e2a28-810b856ff7113b4f`; APK `app-release-810b856ff7113b4f.apk`, 65,629,505 bytes, mode `0444`, SHA-256 `810b856ff7113b4f2a454007595e1b6c1ae5dc69c601a2120b577f124e213e28`; manifest `manifest-e97bbe9e2a28.json`, 6,700 bytes, mode `0444`, SHA-256 `af53d646558449a7a5c907fbdf59e3366c6ffd2755f6049141db8e567549e051` |
| Historical Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-7e8c0f7742e6-303bfd33cf7fa000/app-release-303bfd33cf7fa000.apk`; 65,626,753 bytes; mode `0444`; SHA-256 `303bfd33cf7fa000ee808a048f91883c18dbfe85c1ba359d3f0764ac7ae7f2f8` |
| Historical Validation manifest — DO NOT INSTALL | Same directory, `manifest-7e8c0f7742e6.json`; 6,700 bytes; mode `0444`; SHA-256 `11c1664cee37caa8b093a9023f571e3b8733e8bb078bf7f78b6f20d8f39388a7` |
| Historical `03694f2` package/runtime — DO NOT INSTALL | `com.tim180201.mobile.validation`; signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; `local-validation-only`; historical `NfcA+MifareUltralight`; exact roles A/B/X; exactly one active installed provider from `com.google.android.marvin.talkback` or `com.samsung.android.accessibility.talkback`; none or both fail closed; exactly one queries block with those two package queries, one exact `VIEW` + `BROWSABLE` + `https` intent and zero providers; no Product deep link or Tag dispatch |
| Historical native/source verification — DO NOT INSTALL | Correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree `3e4d1356b859fecf70d365fecbb563e2088100f3`; exact-head CI `30284566289`, attempt 1, 12/12; exact 2,032,807-byte executable Metro bundle SHA-256 `e4caf2db73cfbcdaf779f337bf3a3f99e95d182950522323052bc31ae10c93d3`; exact 555-source/2,667,064-source-byte closure SHA-256 `29691fc137c63906e5cf0c5cd47e2df0643064ab6dbddc00e0d3ec467d492ed3`; independent correction re-review and Artifact Exact-SHA review each `APPROVED`, zero open P0–P3; official artifact verifier `PASS`; superseded for installation by DA5-V5-VAL-UI-01 source correction |
| Run-17 device/accessibility and A/B/X outcome | `SM-A336B`; Android 15/API 35; build `samsung/a33xnseea/a33x:15/AP3A.240905.015.A2/A336BXXUDFYE3:user/release-keys`; Owner User 0; 200 %; Samsung TalkBack `15.1.01.1`; 10×A then 10×B then 10×X, every role 10/10, `NfcA`, three distinct safe fingerprints and Human PASS matched. Concrete safe A/B/X values were not transferred before run-17 cleanup; run 18 later established the transfer binding |
| Run-18 fingerprint-transfer outcome | ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` / tree `e2970d1851ab55f99ff7a027e6268ec4b7622643`; source `5675297` / tree `b32af38`, execution `be76ce4` / tree `56abec5`; APK/manifest matched; device/UI/10×A+10×B+10×X/NfcA/final PASS/receipts/cleanup matched; A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; format and pairwise distinctness validated; exit 0; authority consumed; R-035 locally mitigated; Product App not installed and Product Human V5 `NOT RUN` |
| One-time Phase 0 authorization/result | `RUN 1 CONSUMED — PREINSTALLED PACKAGE`; `RUN 2 CONSUMED — SAMSUNG PROVIDER UNSUPPORTED BY PRIOR BUILD`; `RUN 3 CONSUMED — GENERIC RESOLVER DID NOT UNIQUELY START EXPLICIT ACTIVITY`; `RUN 4 CONSUMED — EXPLICIT MAINACTIVITY COLD START FAILED MISSING EXPOASSET`; `RUN 5 CONSUMED — EXACT APK/DEVICE CHECKPOINT PASSED, THEN GENERIC FAIL-CLOSED SCAN PATH`; `RUN 6 CONSUMED — EXACT e97bbe9 APK/DEVICE CHECKPOINT PASSED, THEN FIRST A-SCAN SHOWED ONLY GENERIC FAIL-CLOSED STATE`; `RUN 7 CONSUMED — EXACT effc57a APK/DEVICE CHECKPOINT PASSED, THEN FIRST A-SCAN STOPPED AT SAFE technology_evidence`; `RUN 8 CONSUMED — EXACT 03694f2 APK INSTALLED, THEN LEGITIMATE ANDROID-15 ~ PATH REJECTED BEFORE MAINACTIVITY LAUNCH`; `RUN 9 CONSUMED — artifact:match, preflight:match, install_launch:mismatch, cleanup:match, failed:mismatch; NO SCAN/UI HANDOFF AND EXACT CAUSE NOT RECONSTRUCTABLE`; `RUN 10 CONSUMED — artifact:match, preflight:match, installation/operation_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP; EXACT CAUSE NOT RECONSTRUCTABLE BECAUSE PRE-INSTALL VERIFICATION WAS SUMMARIZED BY THE SAME CATEGORY`; `RUN 11 CONSUMED — BASELINE d8549c3/TREE 04ea2d0; artifact:match, preflight:match, stage=installation status=mismatch category=operation_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP`; `RUN 12 CONSUMED — BASELINE 3fcbcdec/TREE 74cac3e; artifact:match, preflight:match, stage=installation status=mismatch category=adb_child_transport_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP`; `RUN 13 CONSUMED — BASELINE 63feaf48/TREE 1d63595; artifact:match, preflight:match, stage=installation status=mismatch category=adb_child_transport_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance/WAITING/UI/NFC/TAG STEP`; runs 5–13 have no attributable Tag result and prove no hardware defect; runs 10–13 establish no Product/APK finding; run-7 physical `techTypes` remain unknown; no current authority |

| Later Phase 0 results | `RUN 14 CONSUMED — BASELINE 8878019/TREE 5c15f0f; OPERATOR-SESSION artifact:mismatch, cleanup:match, failed:mismatch BEFORE PREFLIGHT/ADB/INSTALLATION`; `RUN 15 CONSUMED — SAME BASELINE; OFFLINE ARTIFACT MATCH, THEN artifact:match, preflight:match, stage=installation status=mismatch category=adb_stdin_pipe_abort_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance/WAITING/UI/NFC/TAG STEP`; `RUN 16 CONSUMED — artifact:match, preflight:match, install_launch:match, waiting:match, HUMAN-CONFIRMED DEVICE BINDING, FIRST TAG-A technology_evidence, abort, cleanup:match, failed:mismatch; NO ACCEPTED FINGERPRINT/B/X/HUMAN PASS/RETRY`; `RUN 17 CONSUMED SUCCESSFULLY — SOURCE 5675297/TREE b32af38, EXECUTION be76ce4/TREE 56abec5; CI 30612797541 ATTEMPT 1 12/12 ONLY ON ADO CI HEAD f45f49aa6c56c70a503322a043bec3d2360c2176/TREE 714300da7656822dd9b7a2a42fe1be85ab33aa6c; artifact:match, preflight:match, install_launch:match, waiting:match, human_pass:match, cleanup:match, complete:match; EXIT 0; DEVICE/UI/10×A+10×B+10×X/NFCA/FINAL TITLE+TEXT/PASS CONFIRMED; VALIDATION APP REMOVED`; `RUN 18 CONSUMED SUCCESSFULLY — ADO 5a0d59c/TREE e2970d1; SOURCE 5675297/TREE b32af38, EXECUTION be76ce4/TREE 56abec5; SAME MATCHING RECEIPTS/DEVICE/UI/ORDER/NFCA/FINAL PASS/CLEANUP, EXIT 0; A B55E8B6AEB30, B 32A54C8F2F29, X F61C9F702CFE; FORMAT AND PAIRWISE DISTINCTNESS VALIDATED; R-035 LOCALLY MITIGATED`; carried CI is not exact-head CI for run 18 or this sync; no Product Human V5 authority |

**Later Product Human V5** remains the separate run described below. Successful Validation
Phase-0 runs 17 and 18 supply no Product/Human-V5 result. The Product App was not installed. The
run-18 transfer binding locally mitigates R-035 but authorizes no Product installation, Product
action or other hardware action. The R3 Product-Operator artifact closure has now passed for
executable `e2f4f6c777d4dc89531394609e44b3471537b2d7` / tree
`0850d2f254877580773f62174d4c85e10cfff165`, exact-head CI `31384903728` attempt 1 at
12/12 and fully sandboxed final Artifact Review Round 2 `APPROVED` with zero open P0–P3.
That technical readiness still authorizes no Product installation, Product action or Hardware
run; Product Human V5 requires a new, separate and exact one-time Human authorization.
Production, production data, system changes, deployment and distribution remain unauthorized.

## 1. Purpose and authority boundary

This runbook defines one fresh Human Android observation for ADR-0016 DA5-P12 and ADR-0017
DA5-T15. It minimizes repetition through staged gates, but every listed boundary remains
mandatory.

The historical carried V0–V4 software closure used Source+Lock baseline
`a323834f51607841d0cd5f11aafdbfd3dd93ed5f`, tree
`65c669b0a941c21d23ffca5e79fa03285323a7cf`, exact-head CI `30149165373`,
attempt 1, 12/12. Independent implementation review round 2 returned `APPROVED` with zero open
P0–P3. Exact Evidence commit `e6a06e2ec8f580d6314bfe5a51378f949d524b16`, tree
`6dcdce405feb2eccb1462c373ab6be891152715c`, passed exact-head CI `30150095109`,
attempt 1, 12/12; final independent Artifact/Evidence Exact-SHA review returned `APPROVED` with
zero open P0–P3.

Those facts close the DA5 V0–V4 software scope only. **This document does not authorize V5,
installation, ADB, device or Tag interaction.** One future fresh run requires a separate exact
Human-Architect authorization despite the completed artifact/evidence review and CI. The
authorization must fully quote the current top-closure/executable-runtime binding and every
freshly reattested current Product, runtime, device, Tag and environment binding; it must not
copy, inherit or rely on any superseded Section 3 binding.

A failed, interrupted or ambiguous preflight, action, observation or checkpoint consumes that
one-run authority. Stop, mark the entire run failed and clean up. No retry, repair, resume,
replacement action or evidence reuse is allowed. If Gate E has started, its separately defined
Human standard-profile restoration plus read-only proof occurs before cleanup; it is a terminal
device-safety obligation, not a Gate-E retry or resume.

## 2. Fixed safety and disclosure boundary

- Use only fresh synthetic accounts and synthetic data on the exact local environment named by
  the future authorization.
- Use only the separately named, screen-unlocked Samsung/reference Android device and separately
  named approved Tags. An unnamed device or Tag must not be connected, presented or observed.
- Keep every endpoint local and exactly bound. LAN, tunnel, cloud and production resources are
  prohibited.
- Record only exact source/artifact bindings, public synthetic labels, safe UI states, Human
  pass/fail checkpoints and disclosure-safe aggregate results.
- Never record credentials, password digests, tokens, invitation/enrollment secrets, raw NFC UID
  or payload, provider subjects, device serials, encryption keys, internal identifiers or personal
  data. A screenshot is optional and prohibited while any such value is visible.
- Do not build, modify, sign, deploy or distribute an artifact during the run.
- Do not access `research/`. Repository checks must use an explicit protected-path exclusion and
  must also exclude the repository-root `app.json`.
- Production, production data, signing, deployment, distribution, pilot operation and
  legal/privacy approval remain unauthorized.

## 3. Historical mandatory-binding snapshot — superseded and non-normative

This complete table is preserved only as historical evidence of the former
`814cb901…`/`fd0886…`/`c0645…` binding. It is superseded by the 2026-08-10 top closure and
must not be used, completed or interpreted as current operational input. The only current
operational path is the top closure plus a future, separately issued exact one-time Human
authorization that freshly binds every Product, runtime, device, Tag and environment value before
installation, device interaction or Gate A. Until then: **UNBOUND — DO NOT START**.

| Binding | Required exact value |
|---|---|
| Product Human V5 one-run authorization and date | Historical snapshot value: `UNBOUND — DO NOT START`. The prerequisite later passed only as recorded in the top closure, but supplies no run authority; successful Validation Phase-0 run-17 and transfer run-18 authorities are separate and consumed |
| Product source commit/tree and review state | `814cb9013be7da98e46a4c36c5d4e716eef4cf46` / `0181c50faf6936ea1236f4454d536bf734334c91`; source/prepublication reviews `APPROVED`, zero open P0–P3; current execution candidate final V3 passed |
| Historical runbook/evidence commit/tree and review — not current binding | `e6a06e2ec8f580d6314bfe5a51378f949d524b16` / `6dcdce405feb2eccb1462c373ab6be891152715c`; CI `30150095109`, attempt 1, 12/12; historical Artifact/Evidence Exact-SHA review `APPROVED`, zero open P0–P3 |
| Read-only Product APK path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90/app-release-fd0886dc1c393d3b.apk`; 95,522,751 bytes; `fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96`; `0444` |
| Read-only Product manifest path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90/artifact-manifest.txt`; 1,964 bytes; `c0645dda543394cba9d6029b41a23aff5bcb5d0d805e3e944d9f8f880d1d5639`; `0444` |
| Package, version, signature scheme, signer digest and packaged manifest/runtime values | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 `true`, v1/v3/v3.1/v4 `false`; one local synthetic non-production signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; packaged boundary/runtime `match` per adjacent manifest |
| Read-only Validation Artifact Source commit/tree | `5675297dab94258e50d7371a95e07fe7a77fc51c` / `b32af38c8ac769965ab062762004312d96d0de25`; exact 33-record closure |
| Validation Execution Repository commit/tree | `be76ce4a69c8a971ad73b5232082a9e500d8d471` / `56abec5e7f2752f5004fe3e8667f47a917429c52` — **DO NOT START**; matched the canonical loaded-module root's actual HEAD/tree in final V3 |
| Superseding closure pointer — not an operational binding | Use only the exact top closure plus a future exact Human authorization. The top closure records executable `e2f4f6c777d4dc89531394609e44b3471537b2d7` / tree `0850d2f254877580773f62174d4c85e10cfff165`, exact-head CI `31384903728` attempt 1 at 12/12, runtime `e2f4f6c7-97448feb`, manifest 8,640 bytes / mode `0444` / SHA-256 `4cf1d4589028707c3328826d3148d34f2ae1e4e6226d75566c4ff3d0476e2790`, and fully sandboxed final Artifact Review Round 2 `APPROVED` with zero open P0–P3. This pointer grants no Human-run authority |
| Read-only Validation APK path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-5675297dab94-3d5450f257eda716/app-release-3d5450f257eda716.apk`; 65,634,553 bytes; `3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144`; `0444` |
| Read-only Validation manifest/closure | Same directory, `manifest-5675297dab94.json`; 6,855 bytes; `1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a`; `0444`; 33 records; compact-JSON SHA-256 `62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763` |
| Device model, OS/build and approved screen-unlocked mode | `UNBOUND — DO NOT START` |
| Approved assigned, unassigned and unrelated Tag labels/safe fingerprints | `UNBOUND — DO NOT START` |
| Exact synthetic services, status boundary and controlled-offline switch | `UNBOUND — DO NOT START` |
| Admin Setup Preview 2 entry, preview/validation result and safe exit procedure | `UNBOUND — DO NOT START` |
| DA5-T06 exact five-second dedupe boundary and lifecycle-cancellation checkpoint | `UNBOUND — DO NOT START` |
| Separately reviewed Protected/Review induction fixture, synthetic labels, exact start state, cutover procedure, expected state sequence and scoped teardown | `UNBOUND — DO NOT START` |
| Exact large-text setting and active allowlisted TalkBack package/version | `UNBOUND — DO NOT START`; technical candidate context supports exact Google or Samsung package/version, including Samsung, but the future authorization must bind one exact active provider/version and setting |

The populated historical artifact/evidence rows retain their recorded independent approvals. At
that historical checkpoint, the then-current Product/Validation/operator candidate had passed
final V3, exact-head CI and both Exact-Delta re-reviews with zero open P0–P3; the non-hardware
preparation was technically `APPROVED`/`MERGE_READY`, and that R0 synchronization carried V3/V4
without a second V3 or CI. The Human gate remained unbound. None of these rows is a Human-run
authorization. Only the top closure plus a new exact Human authorization may define any future
operational binding.

At preflight, recompute both read-only file sizes, SHA-256 digests and modes from the preserved APK
and manifest. Independently verify package/version, signature/signer and packaged
manifest/runtime values from the APK. Require exact equality with the authorization. Any changed
source, review, CI, file, mode, dependency, configuration, device, OS, Tag or synthetic
environment invalidates the binding and consumes the run authority.

The Protected/Review fixture must bind one exact DA5-compatible historical cutover procedure. Its
reviewed expected sequence is:

```text
clean FIFO and no review marker
-> active_entry_for_other_target_rejected
-> review_pending/historical_configuration_not_valid
-> review_pending/predecessor_requires_review
-> FIFO drained and protected/review-required UI
-> protected/review-required UI retained after one cold relaunch
```

The fixture uses only named synthetic Customer assignments and approved Tags, never device-clock
tampering. If its exact source/procedure, starting aggregate, cutover action, expected safe
aggregate or fixture-scoped teardown is absent or differs, do not start.

## 4. Preflight and short Human checkpoints

Before Gate A:

1. Verify the exact repository heads and a clean tracked worktree with both protected exclusions.
2. Verify the exact current Product, Operator/runtime, device, Tag and environment bindings quoted
   by the separate one-time Human authorization and the Lean Stage-6 Flight Card, without
   rebuilding or changing read-only files. Never use the historical Section 3 values.
3. Require only the authorized USB device, no unexpected mapping/listener, no retained package
   state and fresh synthetic database/accounts/data. Require exact `font_scale=1.0`,
   `accessibility_enabled=0` and an empty/null active-service setting.
4. Install only the exact bound APK through the separately reviewed scoped procedure. Enable NFC
   and keep the device screen unlocked.
5. Require the authorized disclosure-safe status boundary to report fresh zero DA5 setup,
   lifecycle, queue, sync and protected-state evidence before the first action.

After each staged gate, the operator states only the expected and observed safe result. The Human
answers `PASS`, `FAIL` or `AMBIGUOUS`. Only `PASS` permits the next gate. Short acknowledgement
never replaces a listed observation.

Immediately after the Human confirms each first action that will later have an intended opposite
Start/Stop for the same User/WorkTarget, the operator captures the exact named
`dedupe-window-baseline`. The harness queries a fresh PostgreSQL server clock only after that
action, keeps the allow-listed phase/target baseline only in process memory and records only
`dedupe_window_baseline=match`. It must not derive this baseline from WorkEvent persistence; this
conservatively covers an action still held only in the encrypted offline FIFO.

Before the matching opposite action, the operator consumes that exact single-use baseline through
`dedupe-window-check` and must prove that strictly more than the five-second DA5-T06 window has
elapsed. Record only `dedupe_window_elapsed=match`; do not record wall-clock or monotonic
timestamps. A missing, wrong-phase, wrong-target, reused, equal-to-five-seconds or ambiguous
baseline fails before the action. No elapsed check is required before a first action.

## 5. Staged Human gate

### Gate A — Authentication, enrollment and setup exclusion

1. Immediately after installation, use the Administrator login as the single short Credential-
   transfer preflight and the real first Gate-A login. The Human must first confirm the password
   field is empty and active. Only after the operator's hidden digest match may the bound runner
   send exactly one 64-lowercase-hex line through non-PTY stdin. Require successful remote format
   and input exit, no remote output, and then explicit Human `VISIBLE` confirmation before login
   or phase advancement. `EMPTY`, `AMBIGUOUS`, wrong phase/order or any transport/format/exit
   mismatch stops fail-closed. Do not use the Mac clipboard and do not repeat the Administrator
   entry as a separate preflight.
2. Apply the same empty-active -> hidden match -> stdin injection -> visible-confirmation boundary
   exactly once for Enrollment and Employee in that order. Exercise the authorized fresh
   authentication/enrollment path and verify signed-out, Employee and Administrator navigation
   disclose only role-appropriate screens and actions.
3. In Administrator setup, present only the approved assigned Tag and complete its authorized
   synthetic Customer assignment. Require setup UI success and setup aggregates, with zero
   lifecycle action. Require that first assignment capture to finish and release capture
   ownership.
4. Start the separately bound second operation named **Admin Setup Preview 2**. Within only that
   new setup capture/preview, present the already assigned Tag. Require setup-side
   preview/validation only, with zero lifecycle WorkEvent/Decision/Receipt/Audit, zero queue item
   and no navigation into lifecycle handling.
5. Safely cancel/leave Admin Setup Preview 2 through its bound exit. After returning to the normal
   shell and again after refresh/relaunch, require zero replay and unchanged lifecycle/queue
   aggregates. Verify Administrator setup state remains visible and correct.
6. Sign out and present the assigned Tag. Require signed-out rejection with zero lifecycle or
   queue mutation.
7. After Employee authentication, present the separately approved unassigned Tag and unrelated
   Tag. Require safe rejection and zero lifecycle or queue mutation for each.

Checkpoint: auth/enrollment, role boundary, completed first assignment capture, separately started
and safely exited Admin Setup Preview 2, zero setup-to-lifecycle replay, setup preservation and all
three rejection paths are unambiguous.

### Gate B — Cold launch, background resume and same-Tag dedupe

1. From a cold, non-running app with unlocked screen and authenticated synthetic Employee
   authority, present the approved assigned Customer Tag. Require one cold launch and exactly one
   NFC lifecycle result.
2. Present that same Tag again within the exact bound dedupe interval. Require no second lifecycle
   mutation, but exactly one additional persisted WorkEvent, Decision, Receipt and Audit with
   Decision `duplicate_scan_ignored`. Own-time and the current TimeEntry remain unchanged.
   After the Human confirms that duplicate result, capture the named Gate-B Customer baseline.
3. Before the intended opposite lifecycle result, consume that same baseline and require
   `dedupe_window_elapsed=match`. Then put the app in the background and present the same Tag.
   Require one background/resume dispatch and exactly one next lifecycle result.
4. Verify active/history truth and immutable NFC provenance for both accepted results.

Checkpoint: cold launch, warm/background resume, consume-once ownership and same-Tag dedupe pass
with exact duplicate evidence and without a second TimeEntry mutation.

### Gate C — Online targets, mixed provenance and own-time truth

Use only valid server-decided toggles; never select Start or Stop manually.

1. Exercise the online Customer path with one NFC action and the matching manual Customer action
   so the resulting pair proves mixed NFC/manual provenance. After Human confirmation of the
   first action, capture the named Gate-C Customer baseline; consume it and require
   `dedupe_window_elapsed=match` before the intended opposite action.
2. Exercise one online manual Project Start/Stop pair. After Human confirmation of Start, capture
   the named Gate-C Project baseline; consume it and require
   `dedupe_window_elapsed=match` before Stop.
3. Exercise one online manual General Work Start/Stop pair. After Human confirmation of Start,
   capture the named Gate-C General Work baseline; consume it and require
   `dedupe_window_elapsed=match` before Stop.
4. After each pair, require the current active state, ordered own-time active/history projection,
   exact Customer/Project/General target label and immutable trigger provenance to agree.

NFC remains Customer-assignment-based; this gate does not invent NFC assignment to Project or
General Work.

Checkpoint: applicable NFC/manual Customer plus manual Project/General online coverage and
own-time truth are complete.

### Gate D — Controlled offline, reviewed Protected/Review fixture and final stop

1. Activate only the exact authorized controlled-offline switch and prove loss of the bound
   server path without changing authentication, device or app state.
2. Exercise the applicable ordinary offline matrix once: assigned Customer NFC with matching
   manual Customer action, one manual Project pair and one manual General Work pair. Immediately
   after Human confirmation of each first pending action, capture its named Gate-D ordinary
   target baseline; consume that same baseline and require `dedupe_window_elapsed=match` before
   its intended opposite action. Require FIFO order, target/provenance truth and explicit pending
   UI; no server success may be claimed.
3. Restart the app once while ordinary evidence is pending. Require durable restoration,
   unchanged order and no false ready/cleared state. Restore only the authorized server path and
   require one ordered synchronization, no duplicate result and eventual own-time active/history
   agreement.
4. At the exact lifecycle-cancellation checkpoint bound in Section 3, begin only the named
   cancellable action and perform the named background/restart transition. Require the stale or
   cancelled result to produce zero later mutation or replay. Do not repeat the action.
5. Require the ordinary FIFO to be clean and no review marker to exist. Start only the separately
   reviewed Protected/Review fixture. Require Tag A to have no active TimeEntry; after
   that clean checkpoint, start approved Tag B online so its other target is active. This is Tag
   B's first action and has no preceding elapsed check. After Human confirmation of Start, capture
   the named Gate-D Tag-B/Customer-B baseline.
6. Enter the bound cold offline state and capture approved Tag A once before cutover. While the
   device remains offline, require its pending UI and capture the named Gate-D Tag-A baseline.
   Then execute only the fixture's reviewed synthetic reassignment of Tag A from its named
   Customer A to named Customer B. Do not alter device clocks.
7. Consume the Gate-D Tag-A baseline and require `dedupe_window_elapsed=match`, then capture stale
   Tag A once after cutover. Consume the independently retained Gate-D Tag-B/Customer-B baseline
   and require `dedupe_window_elapsed=match` before capturing Tag B as its intended successor
   action.
8. Restore only the approved path and allow automatic FIFO reconciliation without per-event retry.
   Require, in order:
   `active_entry_for_other_target_rejected`,
   `review_pending/historical_configuration_not_valid`, then
   `review_pending/predecessor_requires_review`. Require zero TimeEntry mutation for both
   review-pending outcomes, a drained FIFO and the protected/review-required UI.
9. Force-stop and cold relaunch exactly once as part of the fixture. Require the same protected/
   review-required state to persist.
10. Stop all further Product and fixture mutation at
    `protected_review_fixture_checkpoint=match`. Do not repair, retry, adjudicate, clear, resume
    or reuse any fixture state or observation. Proceed only to the read-only Gate E block.

Checkpoint: ordinary offline parity/restart/cancellation and the separately reviewed historical
cutover sequence are exact; `review_pending` and protected state persist at the final mandatory
stop.

### Gate E — final TalkBack, text scaling and layout block

After Gate D has stopped Product mutation, keep the exact standard profile unchanged and run
`accessibility-prepare` once. It is accepted only at the exact Gate-D protected-relaunch terminal,
complete-offline and terminal-fixture boundary. Do not enable TalkBack or change text scale unless
the operator emits exactly
`da5_v5_accessibility_prepare=match restore_required=armed`. That receipt monotonically activates
the mandatory standard-profile restore proof before any Human setting change; it cannot be
disarmed by Cancel, mismatch, abort or cleanup.

Only after that receipt, the Human enables the exact bound TalkBack provider and
`font_scale=2.0`. The next operator command must be `accessibility-check` (or
`accessibility-cancel`). `accessibility-check` revalidates the exact Gate-E entry boundary and
binds the profile values read-only. A boundary mismatch or accessibility-binding mismatch after
preparation immediately consumes Gate E and becomes restore-only; it never authorizes retry or
resume. The following exact Human navigation/session plan is then single-use and ordered; after
every row the Human submits
`accessibility-surface-confirm <surface> PASS|FAIL|AMBIGUOUS`:

1. `protected-review-error`: inspect the already-retained Protected/Review state and its error/
   explanation affordances before leaving it. Do not adjudicate, clear or retry it.
2. `auth-login`: sign out through ordinary session navigation and inspect the Login surface.
3. Use `accessibility-credential-field-ready administrator EMPTY_ACTIVE`,
   `accessibility-credential-check administrator` and
   `accessibility-credential-field-confirm administrator VISIBLE` exactly once. This is only the
   narrow reauthentication needed to reach `administrator-setup`; open the existing setup screen
   read-only without starting capture, preview, assignment or any save action.
4. Sign out through ordinary session navigation. Use the corresponding three
   `accessibility-credential-* employee` commands exactly once to reach `employee-navigation`.
5. Inspect, in order, `employee-scan`, `employee-manual-target`, `employee-own-time` and
   `employee-sync-pending`. Do not present a Tag or activate a scan/manual target, Start/Stop,
   retry, synchronization or queue action.

For every named surface require logical focus order, meaningful labels/roles, visible focus,
announced state, non-color-only meaning, readable controls and no clipped, overlapping,
unreachable or horizontally overflowing essential content. The two reauthentication transfers
reuse the exact empty-active -> hidden digest -> non-PTY stdin -> both-streams-empty -> Human
`VISIBLE` contract. Authentication/session navigation is permitted only to reach the listed
surfaces; it may not create or change setup, lifecycle, queue, sync or fixture records. The final
Gate-E checkpoint re-reads the unchanged aggregate and invariant set before Human confirmation.

Any wrong surface/order, missing reauthentication, `FAIL`, `AMBIGUOUS`, explicit
`accessibility-cancel` (including Cancel after preparation but before a successful check),
Gate-E-entry boundary mismatch, Credential/profile mismatch or premature command consumes Gate E
and enters a restore-only terminal state. It authorizes no Gate-E resume, navigation, Credential
retry, Product mutation or operator device-setting mutation. Before successful
`accessibility-check`, no command other than that check or `accessibility-cancel` is accepted; a
different command also becomes restore-only.

After PASS, FAIL, AMBIGUOUS or Cancel, the Human manually restores `font_scale=1.0`, disables
TalkBack/accessibility and leaves no active accessibility service. In restore-only state the sole
accepted command is `standard-profile-check`; the operator verifies exact model/build continuity,
`font_scale=1.0`, `accessibility_enabled=0` and empty/null active services read-only. An incomplete
proof remains restore-only and converts a prior PASS to failure; it never resumes Gate E. Exact
proof after PASS permits Gate F. Exact proof after failure/ambiguity/Cancel terminates fail-closed
and only then starts scoped cleanup. The cleanup result cannot be complete if Gate E started and
this restore proof is absent. For this rule, Gate E has started as soon as the exact
`accessibility-prepare` receipt was emitted, even if `accessibility-check` never succeeds.

Checkpoint: all eight named accessibility/layout surfaces pass in exact order, both narrow reauth
handoffs are Human-confirmed, business aggregates remain unchanged and the exact standard profile
is restored.

### Gate F — Final truth and complete cleanup

1. Require the disclosure-safe final status to match only the staged actions, with no duplicate,
   foreign or unexplained setup/lifecycle/sync evidence.
   Require the Gate-E restore proof to be present whenever `accessibility-prepare` matched;
   cleanup/completion cannot substitute for it.
2. Sign out every Mobile/Admin session and clear clipboard, downloads and temporary screenshots.
3. Stop synthetic services normally; remove only scoped mappings/listeners and the exact synthetic
   package. Never use blanket device cleanup.
4. Invoke only the Protected/Review fixture's separately reviewed scoped teardown. Do not
   adjudicate, repair, retry or clear fixture records through product actions.
5. Remove the task-owned synthetic database/schema/ledger and generated runtime roles through the
   reviewed scoped procedure.
6. Require zero authorized package, mapping, listener, fixture and disposable database/role
   residue.
7. Reverify the tracked repository against the authorized head using both protected exclusions
   and leave unrelated repository, device and PostgreSQL state untouched.

Cleanup is mandatory after pass, failure or abort. Cleanup success does not convert a failed or
ambiguous run into a pass.

## 6. Result authority

Record only in
`ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`. Only the Human Architect or an
explicitly delegated Human tester may mark a separately authorized fresh V5 `PASSED`. Automated
tests, V4, software review, this shell or a clean preflight do not pass V5 or authorize production,
signing, deployment or distribution.

## 7. Attempt-11 terminal operator record — 2026-08-01

The earlier Attempt-11 candidate-state text is historical. Exact authorization publication
`32272ca8e1155839380797cadb64fbc454bf2133` / tree
`4f11d9a86f7a060a3a2cfccda4eb7520c2145aa1` activated one run against executable source
`a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`. That run is consumed fail-closed.

Records 1–31 passed in exact order. Both Typecheck records retained the corrected disclosure-safe
membership objects and included their exact required tests; no raw list was retained. Record 32
`V2_SYNTHETIC_TEST` recorded process exit 1. Do not infer a cause: raw output was not preserved and
the command may not be rerun under this authority. Records 33–41 are omitted, so there is no
startable/preserved Harness artifact. Records 42–44 passed and cleanup state is
`cleanup_complete`; every temporary/output root and the worktree registration/list mapping are
absent. Record 45 is `FAIL_CLOSED`.

Preserved evidence is only the immutable mode-`0444` receipt/snapshot/manifest under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt11-a0359a87-fdf09c30`,
with SHA-256 respectively
`9b555534c18ca90fb1a4c18f377bb5f488d04f8805db3692564ff4d08f9916ef`,
`6f0a840d22a17fcc6b77a1f447bf6e1f23ef6f15fecf96b77a7dde491da58abc` and
`b1e198bd18e3c5eb71e4374f4114e3620f79929732bc87083dc834275cad5653`; directory mode is `0555`.
Independent failure/evidence review returned `CHANGES REQUIRED` with exactly one P2. Gate 32
proves only the exact mapped Vitest run exited 1, with `raw_output_preserved:false` and
`mapped_process_exit_nonzero`. Assertion, collection, transform, hook, configuration,
worker/process and infrastructure causes cannot be distinguished; no Product, Harness or test
defect is proven. The fail-closed stop and cleanup remain safe.

Both passed Typecheck records preserve exactly nine result fields and
`raw_list_preserved:false`: Mobile recorded 103,561 bytes/868 final normalized entries and
Synthetic 68,700 bytes/569; each exact expected member is included. For any possible future
authorization, the open need is a bounded closed Vitest pass/failure result schema, a
source-allowlisted expected-test set with normalized repository-relative count/digest/membership,
test/file counts, and a closed failure category plus stable canonical signature. Messages, stacks,
raw stdout/stderr, arbitrary paths and secrets remain excluded. If JSON output were later chosen,
its output root would need exact command mapping, bounds, schema and cleanup. That Attempt-11
terminal runbook section itself binds no Attempt-12 candidate, token, digest, map or path and
grants no later execution authority. Do not
retry or resume Attempt 11, install, use ADB/device/Tags or start Hardware/Human/Product V5.

## Attempt-12 candidate operating contract — do not execute

Status is `REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE`. Attempt 11 is consumed and its single
P2 review finding is evidence undecidability at Gate 32, not a diagnosed Product, Harness or test
defect. This R0 ADO-only candidate creates no paths, worktree, installation, process, receipt or
other Attempt state.

Independent Attempt-12 Round-1 review returned `CHANGES REQUIRED` with exactly one P2: the
29-result/13-binding schema was not fully closed for type/null/default, lifecycle tuples,
category precedence and signature state. Round 2 corrected that point. Round-2 review returned
`CHANGES REQUIRED` with exactly two P2 and one P3 for incomplete within-bucket simultaneous-fault
precedence, absent disclosure-safe signal termination and stale document-head truth. Round 3
corrected those findings. Round-3 review then returned `CHANGES REQUIRED` with exactly one P2:
signal-terminated `WORKTREE_ADD[0]` was not fully integrated into Cleanup V2 timing,
reattestation and removal authority. The first focused correction closed that coupling. Its
re-review returned `CHANGES REQUIRED` with exactly one P2 because terminal `cleanup_residue` lacked
schema-legal absorbing receipt retention for all 56 mismatch/ambiguity tuples. This correction
closes only that point and remains independent-re-review pending.

If and only if independent review returns `APPROVED` and this exact candidate is then published,
the standing Human authorization may activate one exact R3 Attempt-12 run. That conditional run
uses token `710d46dc`, exact unchanged source
`a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`, the inherited direct no-shell 45-gate order and
three npm groups, Membership Receipt Schema V1 and Cleanup Receipt Schema/Contract V2. The exact
descriptor/npmrc/map SHA-256 values are
`dffb1647781084f9e81ff34447d603ebbfaad1c2b1d595109b1eebc6cbd9210a`,
`7308ea83d13da67fa75178f530444db9649f371cd79266363d1f2d7f49f64c82`, and
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`.
The command map is exactly 222,596 compact UTF-8 bytes. Cleanup Receipt Schema V2 is exactly
84,102 compact UTF-8 bytes / SHA-256
`4caa1b43e2b99b22400ce16213bff4b890dd855b13e4caafae8829fe7ff82d94`. The embedded reporter
schema remains exactly 73,538 compact UTF-8 bytes / SHA-256
`c78b307bb5003e1d81a97dd909b9ddaeeabda4c98d1475f1a185e680cfb304a7`.

Before Gate 32, `DEPENDENCY_BINDINGS` must verify the exact locked reporter implementation files
and package-lock resolved/integrity. At Gate 32 the exact existing process receives only
`--reporter=json` and the exact checkout-internal `--outputFile`. Stdout/stderr use non-forwarded
1 MiB bounded pipes whose content/digest is discarded; overflow fails closed. Before spawn,
reporter root/file must be absent. After spawn,
the runner bounds the file at 16 MiB, verifies `lstat`/realpath/device/inode/regular-file and exact
single-entry containment, parses strict UTF-8 JSON in memory, rejects unknown/unbounded fields,
normalizes only canonical checkout-contained test paths, and checks exact counter, status,
membership and exit consistency. Expected membership is the embedded exact 13-file tracked
allowlist; compact set SHA-256 is
`6d3d0d28585a65d8e1357716285896176549416262b3fdba5e5a88ff4966716f`.

Persist only the exact 31-field sanitized result plus 13-field reporter-binding receipt. Every
direct child process record includes only closed `termination_kind`, `exit_code` and
`signal_category`; raw signal names/numbers and synthetic signal exit codes are forbidden. Raw JSON,
stdout/stderr, names, titles, messages, failure messages, stacks, timestamps, metadata, tags,
arbitrary paths and secrets must not enter any receipt, snapshot, manifest or artifact. Reported
failure classes remain explicitly ambiguous when the JSON cannot safely narrow them. Stable
signatures cover only the closed canonical sanitized values and identifier hashes.

Construct all 31 result and 13 binding defaults before the first fallible preflight step. Follow
only the embedded twelve-state lifecycle and terminal tuples. Before full normalization the
status matrix mandates null process/reporter/observed/count/signature fields as applicable; a
started process has exactly an exit/integer/null or signal/null/closed-category tuple, and a
normalized result always has all safe counts, exact membership and a nonnull signature. Select
the one validation code using the 46 strictly ranked checks; `unknown_field` precedes
`schema_type_mismatch`, and all 12 multi-fault fixtures must match. Then select category/code by
the exact first-match exhaustive algorithm; do not infer or combine categories.

For `WORKTREE_ADD[0]`, copy outer `termination_kind`, nullable `exit_code` and nullable closed
`signal_category` exactly into `identity_binding_timing` and reject any inequality. On signal,
reattest checkout, registration and worktree mapping once; classify every observation exactly as
`absent|exact|mismatch|ambiguous`. All absent is unbound, all exact is bound, other absent/exact
mixtures are partial, and any mismatch/ambiguity is cleanup residue. Do not launch deletion from
unbound, partial or residue. A fully exact signal-bound state may enter Cleanup only through the
existing identity-/mapping-revalidation rules; signal still fails the process gate and never
authorizes a later fallible spawn. The eight signal fixtures and six termination fixtures are
normative; removal-without-full-binding is rejected.

For each of the 56 mismatch/ambiguity tuples, persist `cleanup_residue` at binding. At `CLEANUP`
and `POSTCLEANUP`, retain residue only under the exact named boundary rule: increment the sequence
once, preserve every other cleanup-state fact, set every root/registration removal attempt false,
and do not repair, rebind, reobserve-to-bound, resume or promote. Do not interpret this as a
general residue self-transition. At `FINALIZE`, perform no transition or removal; copy the named
gate records exactly, keep residue, set both completion flags false and record `FAIL_CLOSED`.

Remove the exact reporter file/root by recorded identity before writing the Gate-32 receipt. If
identity-safe removal is impossible, record only the bounded deferred disposition, do not copy the
raw reporter, fail the gate, and leave removal solely to the already bound Gate-43 checkout
cleanup; `FINALIZE` cannot pass until Cleanup V2 proves complete absence. Never rerun Vitest for
diagnosis. Do not start any of these steps before approval plus publication, and do not use this
candidate for Hardware, device/ADB/Tags or Human/Product V5.

If cleanup residue follows normalization, keep normalized counts, override category/code to
reporter-contract/cleanup-failed and recompute the canonical signature before receipt append.
Before normalization, signature is always null. A missing, null or stale signature in a purported
normalized tuple is invalid evidence and fails closed.

## Attempt-13 superseding execution-binding candidate — do not execute

The independently reviewed read-only publication-candidate root is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind`,
mode `0555`, with exactly two mode-`0444` entries: executor 376,105 bytes / SHA-256
`810090e78b247820a2ffb24a97846d74c76768db22c2e3d5f77c68084c7e50b6` and manifest 2,648 bytes /
SHA-256 `b60ecb41200c4cbc5010fba22af63ab919ee373ae0b6f80fa1cc5628a7778717`. Candidate review may use
only these non-mutating artifact commands:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind/attempt13-executor.mjs
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind/attempt13-executor.mjs --self-test
```

The executor separately verifies, before `EVIDENCE_INIT`, the immutable Round-5 candidate and its
single parent/tree/exact six-path canonical delta; both exact correction/closure commits, trees and
single parents; corrected source `4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` /
`d44bc534c16866dbc16cd889098e6ca33d75d1f5` with Synthetic test blob
`183b82674ed92e51375fad41e9efb034976ff5e3`, 94,403 bytes and SHA-256
`f47409fa4135e45c04ac63b00dc02cd636375cd7728b6a5d1d9b67f6ad6cc198`; and the
execution-publication domain. The byte-exact Attempt-12 command-map SHA-256 remains
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`.

The execution publication must be a single-parent commit directly after
`2a5f32b2d29d03f26e53eee07dfe3d0658192b49` / tree
`29a8485f2a19e20ae0c483e701b4a0e36a1ad4a7`; caller-bound commit, tree and canonical delta must
match HEAD and local `origin/main`, exactly the six scoped ADO files and a clean scoped worktree.
Its commit, tree and canonical delta are intentionally not embedded or self-referentially asserted
by this document or the manifest; the caller must bind them exactly at invocation. The invocation
shape is:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind/attempt13-executor.mjs --execute \
  --approval-token APPROVED_ZERO_OPEN_P0_P3_EXACTLY_ONE_ATTEMPT13_R3 \
  --expected-manifest-sha256 b60ecb41200c4cbc5010fba22af63ab919ee373ae0b6f80fa1cc5628a7778717 \
  --execution-publication-repository /Users/timbartz/Dokumente/GitHub/taptime \
  --execution-publication-commit <exact-future-published-commit> \
  --execution-publication-tree <exact-future-published-tree> \
  --execution-publication-delta-sha256 <canonical-direct-six-path-delta-sha256>
```

This command is reference-only and forbidden without a separate exact Human single-run
authorization. The normative gate order is the approved prepublication exact-delta/artifact
review, focused exact publication, one local AVS R3 verification of the publication, one V4
exact-head CI, final independent exact-head/artifact review `APPROVED` with zero open P0–P3, and
only then that Human authorization. This embedded document makes no claim that the external V4 or
final-review evidence occurred. No step activates the next automatically. Attempt 13 is **NOT
EXECUTED / DO NOT EXECUTE**. Hardware, ADB, installation, Human/Product V5,
production, production data, deployment and distribution remain unauthorized.

## Historical Round-5 candidate procedure — superseded unchanged

Attempt 12 is consumed with immutable 34/2/9 gate distribution, no artifact and no retry. Do not
rerun or diagnose it. Attempt 13 uses fresh token `483fcf40` and the exact paths and external
executor hashes in the authorization. During candidate review only these non-mutating commands are
permitted:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-a0359a87-483fcf40-r5-plcym5sw/attempt13-executor.mjs
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-a0359a87-483fcf40-r5-plcym5sw/attempt13-executor.mjs --self-test
```

Neither command may create an Attempt path. The retained Round-3 and Round-4 artifacts remain
immutable and were superseded by this now-historical Round-5 candidate. The Round-5 artifact is
352,258 bytes with executor SHA-256
`f5cad177fc8efaefcb0d8d1b52f626c809be9cb3f46e9446a62cd6b60a74b4ec`; its 1,111-byte manifest
SHA-256 is `8d6416d99717efe8929d3f6dcb639fa10a9dd8ab14dd452eabc6d23ca9d23fab` and binds the superseded
Round-4 root plus both Round-4 entry digests.
Round-2 review returned three P1 and four P2 findings; Round 3 corrects receipt/Gate-42/artifact
transactions, fresh Postcleanup observation, committed-record quality links, Gate-32 matrix and
failing-file closure, and exact source identity. The focused Round-4 correction closes the local
snapshot-residue branch, total truthful artifact rollback under state ambiguity, prejournal
rollback-failure retention and the stale authorization header. Formal Round-4 review returned
`CHANGES REQUIRED` with exactly two P1 findings. Focused Round 5
persists the descriptor/lstat-bound receipt creation identity before fallible initial
realpath/readback while retaining the handle and binding on failure. It also requires strict exact
artifact state, transaction and nested identity shapes before equality, absence or removal: only
exact `{exists:false,stat:null}` proves absence; malformed, falsy or partial values retain residue
with zero removal, and empty identities never compare equal or establish creation binding.
Development syntax passed, and the necessary final bounded collect-all no-mutation self-test
passed 314/314 fixtures, 45 gates and 25
collectable gates with zero fixture failures. Fixture-name-set SHA-256 is
`8d69314f7a703cfe5c44011033e3325e505667c33f9d631618172ff72e9262c4`; empty failure-set and
empty-ledger SHA-256 are `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`;
maximum-ledger SHA-256 is `8b3f59e179040dcb3d30611abb1ef55fc679b4fe807ac9ce721d678fc122055d`, with
`raw_output_preserved:false` and `mutation_performed:false`. Intermediate development runs failed
closed at one legacy fail-fast fixture, one pre-fixture name guard and the complete nine-item
preflight matrix before their common map-derived correction. Independent exact-delta/artifact
re-review remains pending. The prior V3
claim remains revoked; V3 is `PENDING` until the Technical Lead independently repeats the final
exact checks. Product source remains unchanged. This was not Product or Attempt execution, created
no Attempt path and proves no Product correctness.

The historical Round-5 order printed here is superseded by the execution-binding procedure above.
The normative gate order is independent prepublication exact-delta/artifact review of the
superseding candidate `APPROVED` with zero open P0–P3; exact publication; exactly one local AVS R3
verification of that publication; one new V4
exact-head CI; final independent exact-head/artifact review `APPROVED` with zero open P0–P3; then
a separate exact Human authorization for one Attempt-13 run. The local R3 verification is not an
Attempt execution. No step activates the next automatically. The obsolete Round-5 command below
is retained as historical text only, is not valid for the superseding candidate and remains
forbidden. Only a later separate Human authorization may bind its exact published
commit, tree, delta and single-run scope before the Technical Lead invokes it:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node <exact-executor> --execute \
  --approval-token APPROVED_ZERO_OPEN_P0_P3_EXACTLY_ONE_ATTEMPT13_R3 \
  --expected-manifest-sha256 8d6416d99717efe8929d3f6dcb639fa10a9dd8ab14dd452eabc6d23ca9d23fab \
  --publication-repository /Users/timbartz/Dokumente/GitHub/taptime \
  --publication-commit <exact-published-commit> \
  --publication-tree <exact-published-tree> \
  --publication-delta-sha256 <SHA-256-of-exact-git-diff-output>
```

The delta digest is SHA-256 of the executor's exact direct `git diff --binary --full-index
--no-ext-diff <preparation> <publication> -- <six sorted ADO paths>` UTF-8 stdout after removal of
its single final LF. Never substitute a different digest convention.

Operational interpretation is deterministic:

- The pure-fixture `--self-test` is bounded collect-all: it executes every isolated allowlisted
  fixture, returns sorted closed failure tuples and their digest, and is PASS only with zero
  failures. Runner setup, overflow, artifact/map IO and non-fixture infrastructure errors hard-stop.
- Gate 42 permits exactly three snapshot outcomes: `snapshot:null` only after proved absence; the
  unchanged fully bound `{name,bytes,sha256}` object; or the fixed safe-name residue
  `{name,status,removal_attempted:false}` with status `present_unbound|present_ambiguous`. Residue
  exposes no bytes, digest, content, raw path or identity details, authorizes zero removal, forces
  `evidence_preserved:false` and `FAIL_CLOSED`, and remains in the exact three-entry Evidence set.
- Artifact rollback requires exact parent and creation identity. Null/partial transaction state,
  an observation failure or missing/ambiguous binding authorizes no removal and finalizes only a
  truthful residue with no success claim. A creation-bound descriptor requires a proved created
  object and nonnull creation identity.
- Prejournal rollback failures are never suppressed and never clear the receipt/root bindings
  still required for exact terminal recovery. Incomplete or ambiguous recovery records only the
  closed safe outcome and performs zero unbound removal.

- A collectable quality failure does not stop unrelated gates. Record it once, continue only DAG
  nodes whose direct prerequisites remain available, and mark direct dependents
  `dependency_omitted`.
- A signal, non-start, infrastructure/worker anomaly, parser/schema/bounds problem, raw-output
  risk, path/symlink/special-file/output-root mutation, source/tool/publication/identity/mapping
  mismatch or Cleanup anomaly hard-stops; remaining Gates through 41 are
  `not_run_hard_stop`.
- Gate-32 preflight failure remains a legal `not_started` result. If the mapped process never
  starts, persist `processes:[]` plus the explicit gate termination tuple. Its pre/post inventory
  has exactly two allowed roots, `node_modules` and the reporter root; only the exact
  identity-bound reporter root may change and must be restored.
- Gates 42–45 always run. CLEANUP and POSTCLEANUP must each retain their mapped child record and
  the four exact cleanup objects. Never remove a checkout or registration unless all exact
  identities and the worktree-list mapping revalidate.
- Do not add a Git probe around Cleanup or Postcleanup. Use only their mapped children and fresh
  bounded filesystem/mapped-output observations. Missing, partial, mismatched or ambiguous binding
  performs zero removal and ends in absorbing `cleanup_residue`; only exact bound state may proceed
  `bound -> cleanup_applied -> cleanup_complete`.
- Gate 32 may be collected only after complete normalized 13/13 membership and safe persisted
  `failing_files`. Validate the exact 31-field result, 13-field binding and all cross-field
  partitions against the loaded map's
  `DA5_V5_ATTEMPT13_VITEST_FAILURE_SIGNATURE_V1`. Source size/digest drift uses the existing
  `unexpected_file_path` code. Reporter/signature/cleanup uncertainty hard-stops.
- Gate 39 remains independent of Gate 38, but requires the successful exact Gate-34 esbuild and
  metafile after a green first Gate-34 child. Gate 40 requires Gate 39. Gate 41 requires zero
  failures and no residue.
- Do not create the success artifact at Gate 41. The executor stages two bounded files in memory
  and publishes them only during successful Finalize after exact Cleanup/Postcleanup. Any failure
  requires artifact-path absence.
- Finalize must derive from frozen copies of already committed records. Its common transaction
  stages artifact/evidence/modes and commits the receipt last; any caught write/chmod fault rolls
  back the staged prefix. Do not claim crash atomicity.

Do not manually repair, resume, remove ambiguous residue, repeat only failed tests, or invoke a
second Attempt. Stop after the one terminal receipt. Hardware, ADB, install, device/Tag and
Human/Product V5 operations are outside this procedure.
