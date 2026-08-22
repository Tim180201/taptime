# Development Assignment 5 — V5 Isolated PostgreSQL Correction Authorization

- Status: **RUNTIME GUARD R3 IMPLEMENTATION, IMMUTABLE ARTIFACT AND INDEPENDENT EXACT-SHA REVIEW COMPLETE/APPROVED WITH ZERO OPEN P0–P3; HARDWARE NOT RUN/UNAUTHORIZED**
- Date: 2026-07-27
- Owner: Technical Lead
- Decision authority: Human Architect
- Exact round-2 candidate commit: `7739757a4855ee7bac34408941e94c25516d75f5`
- Exact round-2 candidate tree: `0398066e92fef65562526f61c9515b0ef3be0114`
- Exact round-2 candidate parent: `72fbd3c20329dfbf3e8a1509025bd630b1bb130a`
- Round-2 exact-head CI: `30177897059`, attempt 1, 12/12
- Round-2 independent technically enforced read-only Ultra re-review: `CHANGES REQUIRED` —
  exactly five P1, one P2 and one P3
- Exact round-3 candidate commit: `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`
- Exact round-3 candidate tree: `dfb5abbca1f2ddf603d191ae3303d1336f5440c7`
- Exact round-3 candidate parent: `7739757a4855ee7bac34408941e94c25516d75f5`
- Round-3 exact-head CI: `30185670176`, attempt 1, 12/12
- Independent round-3 review: `CHANGES REQUIRED` — exactly two P1 and zero P0/P2/P3
- Human extra-round authority: exactly one additional focused ADO correction/review round beyond
  the three-round limit; no implementation or hardware authority
- Exact extra-round candidate commit: `43567d256e8f633f16866448e1fb5abbd8022733`
- Exact extra-round candidate tree: `feecced92abe9fc536a2db052b5a616d3e0f1cf7`
- Exact extra-round candidate parent: `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`
- Extra-round exact-head CI: `30186846379`, attempt 1, 12/12
- Independent extra-round Exact-Delta review: `CHANGES REQUIRED` — exactly one P1 and zero
  P0/P2/P3; initdb P1-B closed
- Human last-round authority: the second local administrator and the exact decision-time local
  macOS admin-group snapshot are trusted under Option A; exactly one last focused ADO
  correction/review round, limited to the remaining Homebrew-group P1; no implementation or
  hardware authority
- Human-approved decision-time admin-group snapshot: exactly two direct members, zero nested
  groups
- Decision-time full group-record SHA-256:
  `b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`
- Decision-time canonical membership SHA-256:
  `70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064`
- Decision-time combined snapshot SHA-256:
  `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`
- Current synchronization risk: AVS `R0` documentation only
- Completed implementation boundary: AVS `R3`

## 0. Current implementation and artifact binding

Sections 1–12 retain the authorization and review history. The resulting Runtime Guard source is
bound to `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867`, tree
`980b6c57fdd71c12820f2890b640946db0d883c6`, CI `30255104609`, attempt 2,
12/12; attempt 1 had only one B5 Docker-Hub pull timeout before checkout.

- Binary:
  `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-runtime-guard/ba1b6e922ceb7902ecedd9dc2df01d6b22d90867/da5_v5_runtime_guard`;
  74,336 bytes; mode `0555`; SHA-256
  `4b2a7e6b15d3348dffda94f9125c20a4db82bb8eb08a03aabd35932ad0d5853c`.
- Manifest: same directory, `guard-manifest.txt`; 19,971 bytes; mode `0444`; SHA-256
  `957d6e99c271663763945026995e7463cf2f20b385eb942fd16a152d3de5f709`.
- Focused evidence SHA-256:
  `440928371f7acc48272eff2e819c37a851d66cae4a908ffa330228982328d708`.
- Independent Exact-SHA artifact review: `APPROVED`, zero open P0–P3.

No hardware, ADB, installation, system change or Human V5 occurred.

## 1. Authority and repository truth

This file is an ADO-only last-round correction draft against the exact extra-round candidate above.
It changes no Product, schema, migration, runtime, dependency, workflow, database, device or
artifact state. It grants no implementation or Human/hardware authority. The Human Architect
explicitly selected Option A in Section 4: one exclusive trusted single-user operator session,
with hostile or malicious same-UID processes and mount/unmount churn outside the threat model.
The Human Architect now additionally confirms that the second local administrator and every
member of the exact decision-time local macOS admin-group snapshot are trusted under Option A for
this local Harness. That approval is frozen to the decision-time V1 snapshot in Section 3.2:
exactly two direct members, zero nested groups and the three recorded SHA-256 anchors. It is not
authority to capture or accept whichever admin-group state exists during a later R3 run. No
account or group name, numeric GID, group GUID, username, numeric UID, member GUID or secret is
recorded in ADO/Evidence. After the extra-round Exact-Delta review left one P1, the Human Architect
expressly authorized exactly one last focused ADO correction/review round limited to that finding.
This working-tree draft is not that focused publication, has no last-round commit/tree or exact-
head CI binding and has not received independent `APPROVED`. Only those later gates may allow the
`AGENTS.md` standing rule to activate the exact Section 8 R3 scope.

The local Shared-Cluster follow-up in the working tree is uncommitted, `BLOCKED` and explicitly
**not Candidate Evidence**. Its focused 180/180 Synthetic result and all earlier focused results
remain historical WIP observations only; they establish no acceptance, closure, current green
path or authority. A later implementation must selectively replace only that obsolete
Shared-Cluster delta while preserving unrelated user changes. Reset, checkout, blanket
restoration or treating the dirty worktree as a baseline is forbidden.

Round-2 candidate `7739757a4855ee7bac34408941e94c25516d75f5`, tree
`0398066e92fef65562526f61c9515b0ef3be0114`, exact parent
`72fbd3c20329dfbf3e8a1509025bd630b1bb130a`, passed exact-head CI `30177897059`, attempt 1,
12/12. Its technically enforced read-only Ultra re-review returned `CHANGES REQUIRED` for exactly:

1. P1: `detached=false` still allowed terminal- or process-group-generated SIGINT to reach
   PostgreSQL without passing through the private owner protocol;
2. P1: compiler, native helper and `initdb` had no fully bounded terminal cleanup/hang path;
3. P1: the compiler/toolchain/environment trust boundary did not bind the complete compiler,
   `xcrun`/SDK/sysroot/include and environment input set;
4. P1: `renameat` neither bound the source inode atomically nor guaranteed a no-replace target;
5. P1: the final `fstatat` to `unlinkat` step remained a destructive same-UID TOCTOU;
6. P2: the copy-ready review prompt named only one file instead of the complete candidate delta;
   and
7. P3: the Decision Log and ADO navigation remained stale or incomplete.

This draft addresses the first four technical design gaps, makes the fifth limitation explicit and
records the Human Architect's exact Option A selection without broadening it. It also corrects the
complete review scope and official navigation truth. Product, Business, NFC, tenant, schema,
migration and Human-gate semantics remain unchanged. The boundary stops immediately before any
implementation and, independently, before USB, ADB, installation, device or Tag interaction.

Focused round-3 candidate `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, tree
`dfb5abbca1f2ddf603d191ae3303d1336f5440c7`, exact parent
`7739757a4855ee7bac34408941e94c25516d75f5`, passed exact-head CI `30185670176`, attempt 1,
12/12. Its independent read-only review returned `CHANGES REQUIRED` with exactly two P1 and zero
P0/P2/P3:

1. P1: the PostgreSQL 17.10 Homebrew trust contract required root ownership and therefore rejected
   the exact same-EUID ownership allowed by Option A; it also did not bind and revalidate the
   complete canonical ancestor chain strongly enough; and
2. P1: the initdb termination design used a potentially reaping pre-final-signal child-status
   observation that could release the leader PID/PGID before a later destructive group signal.

The published extra-round candidate addressed only those two findings. The earlier round-2
findings and their round-3 dispositions remain historical review truth; none of them is reopened
or converted into implementation Evidence.

Focused extra-round candidate `43567d256e8f633f16866448e1fb5abbd8022733`, tree
`feecced92abe9fc536a2db052b5a616d3e0f1cf7`, exact parent
`bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, passed exact-head CI `30186846379`, attempt 1,
12/12. Its independent read-only Exact-Delta review returned `CHANGES REQUIRED` with exactly one
P1 and zero P0/P2/P3:

1. P1-A: the complete canonical PostgreSQL 17.10 chain includes the current same-EUID-owned
   Homebrew Cellar ancestor at observed mode `0775`; the prior blanket group-write rejection
   therefore cannot run on the accepted host and did not bind the exact trusted group or its
   complete current membership set.

The review explicitly closed P1-B: the initdb leader remains unreaped through all possible
negative-PGID signals by the non-reaping `waitid(..., WNOWAIT)` contract. This last-round draft
preserves P1-B byte-semantically and corrects only P1-A under the exact Human group-trust decision.

## 2. Correction rationale

DA5-V5 requires destructive setup and cleanup only for state the harness can prove it owns. A
shared PostgreSQL cluster cannot provide that proof strongly enough:

- catalog locks held by the provisioning session cannot prove peer-session survival while the
  peer is blocked behind those same locks;
- a finite catalog fingerprint can miss mutable metadata, ACL, ownership, dependency or comment
  state;
- adoption, quarantine, rename and cleanup of pre-existing roles, databases or schemas can alter
  unrelated state even when the intended names match;
- more Shared-Cluster locks and fingerprints increase destructive complexity without creating a
  physical ownership boundary.

The correction therefore moves database lifecycle ownership outside the DA5 runner. Every
operational local DA5-V5 run gets one private, freshly initialized PostgreSQL 17.10 cluster.
Foreign, shared, dirty or pre-existing PostgreSQL state is rejected without mutation.

## 3. Required architecture

### 3.0 Local discovery, not implementation Evidence

Read-only discovery on 2026-07-25 found PostgreSQL 17.10 in the current Homebrew installation,
with the canonical bin directory `/opt/homebrew/Cellar/postgresql@17/17.10/bin`. A task-owned
temporary probe also showed that this `initdb` accepts a bootstrap password through anonymous
FD 3 via `--pwfile=/dev/fd/3`, exits successfully without the secret in stdout/stderr and allows
exact removal of the probe root. The later extra-round Exact-Delta review established that the
complete current canonical chain includes a same-EUID-owned Homebrew Cellar ancestor at observed
mode `0775`. This last-round R0 correction does not probe or mutate that installation.

This is `DISCOVERED`, not implementation, V1–V3 or Candidate Evidence. The implementation may not
turn that versioned path into a permanent Product promise. It must independently bind the
currently existing PostgreSQL 17.10 `pg_config`, require its absolute `--bindir`, and verify all
required executables from that one exact directory plus `server_version_num=170010` for every
operational run. `pg_ctl` is neither required nor permitted. A later PostgreSQL security-minor
upgrade requires its own reviewed rebind. The existing installation is consumed read-only: no
`chown`, `chmod`, package-manager, Homebrew, ownership or system mutation is permitted.

### 3.1 Outer Node owner and fixed local boundary

One opt-in Node process is the outer DA5 lifecycle/composition owner. It must:

1. bind an existing absolute PostgreSQL 17.10 `pg_config` under the exact Section 3.2
   owner/trusted-group/canonical-chain contract, require an absolute canonical
   `pg_config --bindir`, and resolve and execute `initdb` and `postgres` only inside that one exact
   directory;
2. bind every required tool and input under Section 3.2 before it creates a database capability;
3. verify a parent namespace outside the repository as either a root-owned sticky temporary base
   with only explicitly allow-listed system ACL entries or an already private same-EUID-owned
   `0700` base with no nontrivial/default-inherited ACL; reject remote, network, FUSE and unknown
   filesystems and require an allow-listed local filesystem with supported rename/unlink semantics;
4. create a random same-EUID `0700` staging parent with no nontrivial/default-inherited ACL, retain
   its descriptor, and before creating the task root launch the same reviewed Guard binary once in
   a bounded `PROBE_ONLY` protocol mode with a held handle, private manifest/capability pipe and
   inherited staging FD. That instance may perform only the exact sacrificial no-replace
   rename/unlink semantics probe and one task-local direct-child primitive probe proving that
   Section 3.4's `waitid(..., WNOWAIT)` or exactly proven equivalent observes terminal state
   without reaping before a final terminal reap. It must self-watchdog, emit a bounded proof and
   be terminally reaped. `ENOSYS`,
   `EINVAL`, `ENOTSUP`, replacement of the pre-existing target, timeout, residue, an unavailable
   or reaping child-status primitive or any ambiguous result fails closed. Node/JS `fs.rename` is
   not accepted as the namespace probe. Only after the probe Guard exits cleanly may Node create
   the exact `0700` task root with no
   nontrivial/default-inherited ACL; retain
   base/staging/root descriptors plus canonical path, filesystem type, device, inode, owner, mode,
   ACL and platform mount identity for each;
5. create private data, socket, log and lifecycle-record locations under that root using
   descriptor-relative no-follow operations and no group/other access;
6. launch the persistent instance of that same one native Runtime Guard program in Section 3.3
   with `shell:false`, `detached:true`, a held process handle and private inherited pipes, and
   never call `unref()`; and
7. give the DA5 runner only opaque same-process capabilities derived after final attestation.

The fixed operational cluster uses bootstrap superuser `taptime_da5_v5_installer`, database
`taptime_synthetic_android_e2e`, host authentication `scram-sha-256`, local authentication
`reject`, password encryption `scram-sha-256`, numeric loopback `127.0.0.1`, a private Unix-socket
directory and exact TCP port `55435`. An unavailable resource, listener appearance or bind race
fails closed. Retry, alternate port, `5432`, `localhost`, wildcard/LAN binding, operator database
URL, service-manager fallback, shared cluster and existing-server adoption are forbidden.

Plaintext PostgreSQL secrets, URLs and capabilities remain only in private memory/pipes. The
bootstrap plaintext reaches `initdb` only through an anonymous inherited password FD and
`--pwfile=/dev/fd/<fixed-guard-fd>`; runtime-role plaintext reaches the bound server only as a
parameterized in-memory protocol value. No plaintext PostgreSQL secret may appear in argv,
environment, repository, configuration, log, status, exception or Evidence. Every secret buffer
is explicitly zeroized and every secret/manifest/control descriptor is closed on success,
failure, timeout and signal paths. PostgreSQL may persist only its normal SCRAM verifier beneath
the bound `0700` root.

### 3.2 One-time Guard artifact production and operational trust boundary

The Runtime Guard is compiled exactly once during the authorized R3 software phase, not during an
operational or hardware run. The software-phase artifact producer binds:

- the exact implementation commit/tree and Runtime Guard source path/device/inode/owner/mode/
  SHA-256;
- absolute canonical root-owned, non-group/non-world-writable compiler frontend, platform linker
  and, on macOS, `/usr/bin/xcrun`, selected SDK root and required SDK/compiler binaries;
- compiler/linker/xcrun version, SHA-256, executable mode and platform-verifiable identity,
  including Apple platform/code-signature identity where applicable or the strongest available
  Linux package/platform identity;
- exact compiler resource directory, target, sysroot/SDK, system include roots, linker and startup
  objects, each by canonical root-owned/non-group/non-world-writable identity and digest or a
  platform-verifiable directory manifest; and
- fixed absolute CWD, `umask 077`, fixed target/sysroot/include/link arguments and fixed
  warning/hardening flags.

No implicit `PATH` search, user header, package manager, response file, plugin, config file or
operator flag is permitted. Artifact production rejects inherited `CC`, `CFLAGS`, `CPPFLAGS`,
`LDFLAGS`, `CPATH`, `C_INCLUDE_PATH`, `CPLUS_INCLUDE_PATH`, `OBJC_INCLUDE_PATH`, `LIBRARY_PATH`,
`SDKROOT`, `DEVELOPER_DIR`, every `DYLD_*`, every `LD_*`, every `PG*`, every `PQ*`, `LANG`,
`LANGUAGE`, every `LC_*` and every compiler/locale/loader override. Unknown variables are not
forwarded. Compiler, linker and `xcrun` each receive a separate minimal secret-free allow-listed
environment.

The fixed toolchain record uses a one-process-per-phase compile/link pipeline. It invokes the
bound compiler frontend in non-driver mode (for example exact Clang `-cc1`) and the bound platform
linker as separate sequential direct children. Driver modes or a phase capable of forking/execing
a compiler, assembler, linker, plugin or other grandchild are forbidden. Each phase is:

`spawnSync(absolutePhaseBinary, fixedArgv, { shell: false, timeout: 20_000,
killSignal: 'SIGKILL', cwd: fixedCwd, env: phaseAllowlist,
stdio: ['ignore', 'ignore', 'ignore'] })`.

There is no compiler pipe stdio and no output-based phase-acceptance claim. Timeout permits one
phase-child-only SIGKILL; the call may return only after terminal reap. A phase succeeds only when
the synchronous result has `error === undefined`, `signal === null` and exact `status === 0`
after terminal direct-child reap. Any timeout, spawn error, signal, null/nonzero status or
inability to prove the no-grandchild/reap contract fails artifact production. Bounded read-only
identity/version calls use no shell, fixed argv, five-second timeout, fixed 64-KiB maximum output,
one direct-child SIGKILL on timeout and terminal reap. Negative tests poison every rejected
environment family and replace compiler/xcrun/SDK/sysroot/include/link/startup/source inputs
between bind and use.

Artifact-production signal handlers are installed before the synchronous phases. JavaScript
cannot run them while `spawnSync` blocks, so delivery is treated as pending; immediately after the
terminal/reaped return the producer drains/latches it, rejects the next phase/artifact publication
and boundedly removes only its exact build objects. No PostgreSQL root/process exists in this
phase, and no mid-`spawnSync` cleanup is claimed.

After focused Guard tests pass, the producer fixes exactly one disclosure-safe binary and adjacent
manifest outside the repository at:

- `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-runtime-guard/<IMPLEMENTATION_COMMIT>/da5_v5_runtime_guard`,
  mode `0555`; and
- `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-runtime-guard/<IMPLEMENTATION_COMMIT>/guard-manifest.txt`,
  mode `0444`.

Both files are created no-follow/no-replace, never overwritten, and retained read-only. The
manifest binds absolute path, size, SHA-256, mode, owner, architecture, OS version/build,
executable format, platform signature/identity, every dynamic load dependency by canonical
identity/digest/version, source commit/tree/path/digest, complete toolchain/SDK/input identities,
fixed build-command digest and the exact focused test result. It contains no secret. V3 and the
later independent Exact-SHA review must reverify the stable-FD binary/manifest bindings and the
binary's architecture/load dependencies. This ADO draft creates no artifact.

Every later operational or hardware run is compiler-free. It accepts only the exact independently
reviewed binary/manifest paths and bindings, reopens both no-follow, compares `lstat`/`fstat`
before/after hashing, verifies size/SHA/mode/owner/architecture/OS/load dependencies/signature and
fails before task-root creation on any difference. It neither invokes nor trusts a runtime
compiler, linker, SDK or `xcrun`.

Operationally, before PostgreSQL discovery the owner captures its exact effective UID and resolves
the platform-authoritative local macOS admin-group record through the platform directory service,
never from an operator-supplied name or identity. The Human approval is bound to one decision-time
V1 snapshot, not to whatever group or membership happens to be current later. The disclosure-safe
approved anchors are:

- exactly two direct members and zero nested groups;
- full platform group-record SHA-256
  `b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`;
- canonical sorted numeric-UID/user-GUID membership SHA-256
  `70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064`; and
- combined Human-approved snapshot SHA-256
  `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`.

The owner must reproduce that V1 snapshot exactly:

1. Resolve the platform-authoritative current local macOS admin record through directory service;
   operator input may not select or override the record.
2. Require exactly one numeric GID, exactly one group GUID, zero nested groups and complete direct
   membership. The record's `GroupMembers` GUID set must equal exactly the user-GUID set obtained
   by resolving every `GroupMembership` account to exactly one numeric UID and one user GUID. The
   two direct members must be complete and distinct. A duplicate, unresolved, ambiguous, cyclic,
   nested, partial or unequal record fails closed.
3. Construct the full-record canonical bytes as the UTF-8 prefix
   `DA5-V5-TRUSTED-MACOS-ADMIN-FULL-GROUP-RECORD-V1\n`, followed by one compact UTF-8 JSON object
   containing every returned group-record attribute, followed by one LF. The object keys are
   lexicographically sorted and each attribute's array of string values is lexicographically
   sorted; there is no BOM, indentation or insignificant whitespace. Its SHA-256 must equal
   `b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`.
4. Construct the membership canonical bytes from the UTF-8 prefix
   `DA5-V5-TRUSTED-MACOS-ADMIN-MEMBERSHIP-V1\n`, then one line per direct member as decimal UID,
   `:`, uppercase user GUID and LF. Sort pairs by numeric UID and then by GUID bytes. Its SHA-256
   must equal `70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064`.
5. Construct the combined snapshot canonical bytes in this exact order. `DECIMAL_GID` and
   `UPPERCASE_GROUP_GUID` below denote the protected resolved values substituted into the bytes;
   those labels are not literal byte content:

   ```text
   DA5-V5-TRUSTED-MACOS-ADMIN-SNAPSHOT-V1
   gid:DECIMAL_GID
   guid:UPPERCASE_GROUP_GUID
   group-record:b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5
   members:70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064
   nested-groups:0
   ```

   Every displayed line, including the last, ends with one LF; the first line is the exact UTF-8
   prefix `DA5-V5-TRUSTED-MACOS-ADMIN-SNAPSHOT-V1\n`. The SHA-256 must equal
   `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`.

Only after all validation and all three exact digest comparisons pass may one task-private
immutable trusted-group manifest bind the protected numeric GID, group GUID, complete direct
numeric-UID/user-GUID pairs, all three digests and both counts. The private lifecycle/Guard
manifest may carry those protected values over the private protocol. ADO, Evidence, status and
ordinary output may expose the three digests, `direct-members:2`, `nested-groups:0` and `match` or
`mismatch`, but never the group name, numeric GID, group GUID, username, numeric UID, member GUID
or secret.

Every later R3 preflight must recompute the complete record, membership and combined snapshot
before capability or task-root creation and immediately before every trust use, and all three
digests plus both counts must equal the exact decision-time anchors above. Any mismatch stops
before the corresponding trust use and returns the boundary to the Human Architect. Dynamic
re-acceptance, updating an anchor or rebinding to a newly current group/member state is forbidden.
The exact anchored group identity and membership are trusted only for this local Option-A Harness,
not by group name and not for any later member.

The owner then separately binds the canonical resolved `pg_config`, its exact canonical
PostgreSQL bindir, `initdb` and `postgres`. Every binary and every component of its complete
canonical ancestor chain must be owned by UID 0 or the one captured effective UID. No path may be
world writable. A canonical ancestor may be group writable only when all of the following hold:
its owner is the captured effective UID; its group identity exactly equals the decision-time-
anchored trusted-group manifest; its exact observed mode is bound in the chain manifest; and all
three trusted-group snapshot digests plus both counts still match the exact decision-time anchors.
Every root-owned group-writable path, every group-writable path owned by another UID or group, and
every other group-writable ancestor fails.
The canonical `pg_config`, `initdb` and `postgres` binaries are bound at their exact observed mode
`0555` and must remain non-group/non-world-writable; group trust never permits a writable binary.
Every ancestor and binary mode must exactly equal its initially observed manifest-bound value, so
the accepted current Homebrew Cellar `0775` ancestor is not a wildcard for other modes.

Every accepted component must have no default-inherited ACL and no ACL entry except explicitly
allow-listed non-write-granting system entries. Any unexpected, changed or write-granting ACL is
rejected independently of POSIX mode. The owner resolves the discovery input once, then retains
and executes only the canonical resolved binaries; an alias execution, a symlink introduced into
the bound chain or any post-bind path substitution is forbidden.

The owner opens every canonical ancestor and binary no-follow and retains stable descriptors. For
each ancestor it binds canonical path, device, inode, owner UID, group identity, exact mode and ACL
identity into one immutable chain-manifest digest. For each binary it additionally binds the
stable-FD identity, size, SHA-256, exact PostgreSQL version and platform-verifiable identity. It
compares path and stable-FD identities before and after hashing/version inspection, revalidates
the complete decision-time-anchored trusted-group snapshot, chain and binary bindings before
capability or task-root creation, and repeats that revalidation immediately before every later use
or `execve`. Any owner, group, member set, group record, snapshot anchor, count, mode, ACL, path,
device, inode, digest, version or platform-identity mismatch, world-writable component, unapproved
group-writable component, symlink/swap or lost descriptor fails closed. The initial failure occurs
before any database capability or task root exists; a later revalidation failure occurs before
the corresponding execution and cannot authorize further mutation or signaling. It returns to
the Human Architect rather than accepting a new snapshot. The implementation and preflight must
not repair trust by changing accounts, group membership, ownership, permissions, Homebrew or the
system.

The canonical `pg_config` must report the exact canonical directory already bound as its absolute
`--bindir`; canonical `initdb` and `postgres` must be the two bound executables in that same
directory, and `server_version_num` must equal `170010`. `pg_config` discovery invokes the bound
canonical binary as one synchronous direct child with `shell:false`, fixed argv,
`timeout: 5_000`, `killSignal: 'SIGKILL'` and `maxBuffer: 65_536`. Timeout may SIGKILL only that
direct child, and the call may return only after terminal direct-child reap; any spawn error,
signal, null/nonzero status, buffer overflow or unproved reap fails discovery. `pg_config`,
Runtime Guard, `initdb` and `postgres` each receive a distinct closed, secret-free allow-listed
environment, fixed CWD and `umask 077`; the initdb password FD is the only secret exception.
Operational startup also rejects all compiler/SDK/loader/PG/PQ/locale poisoning variables above
even though no compiler runs.

### 3.3 One native POSIX Runtime Guard

The later R3 implementation may add exactly one native source,
`apps/synthetic-android-e2e/native/da5_v5_runtime_guard.c`. The previously proposed deletion
helper is renamed and expanded into this one Runtime Guard; no second helper or native supervisor
is permitted.

Node launches the bound Runtime Guard with `shell:false` and `detached:true`. On POSIX this creates
the Guard as leader of its own session and process group, separate from Node's foreground terminal
group. Its exact stdio map contains no inherited terminal: stdin is ignored and control, event and
secret channels are private pipes; Node and Guard assert `isatty=false`, no controlling terminal,
the expected distinct SID/PGID and a still-referenced handle. Node never calls `unref()` and does
not use that handle as signal authority. The Guard is the sole direct parent and supervisor of
`initdb` and later `postgres`; no shell, daemonizer, service manager or `pg_ctl` may intervene.

The Guard:

- ignores or blocks externally delivered SIGINT, SIGTERM and SIGHUP in itself and never treats
  terminal/process-group delivery as a PostgreSQL command;
- resets every catchable signal disposition to `SIG_DFL` and replaces the complete inherited
  signal mask with an empty mask in each forked exec child immediately before `execve`;
- keeps each child as its exact unreaped direct child and uses only its own stored direct-child
  state plus direct-child `waitid`/`waitpid`, never a later PID lookup, PID file or name search,
  for control; every initdb observation before a possible group signal is the non-reaping
  Section 3.4 operation;
- runs a bounded poll/monotonic-deadline state machine with no unbounded protocol, readiness,
  child-close or pipe wait; and
- emits only length-delimited disclosure-safe state/proof records on the inherited event pipe.

Before supervising a child, the Guard starts an internal independent monotonic watchdog with
phase-specific deadlines and heartbeat state. A missed supervisor deadline causes the Guard to
self-terminate with process-directed SIGKILL; it never redirects that signal to `initdb` or
PostgreSQL. Node observes/reaps the held Guard handle and reports possible task-owned child/root
residue. This is a terminal Guard hang path, not successful cleanup. A platform that cannot
provide the watchdog/terminal-reap contract is unsupported and fails before the Guard is trusted.

Node and Guard communicate only through a length-delimited binary capability/manifest protocol
over the inherited private pipes. The Guard first emits exactly one `HELLO` binding protocol
version, compiled artifact identity and its fresh lifecycle nonce. Node validates it, then sends
one `START_MANIFEST` containing a fresh 256-bit single-use capability, lifecycle generation and
digest-bound immutable manifest; the Guard authenticates/schema-checks/binds it and emits one
`ACK`. No `initdb` or `postgres` fork is permitted before the valid ACK state.

After ACK, Node sends a fixed one-second authenticated heartbeat; the Guard enforces a fixed
five-second lease. It accepts at most one authenticated `STOP_FAST`. Malformed, replayed,
duplicate, wrong-generation, wrong-digest or post-EOF input, unexpected frame order, control-pipe
EOF/`POLLHUP` and heartbeat lease expiry latch fail-closed stop. If PostgreSQL is live, that latch
is eligible for the same sole direct-child SIGINT and no other process control. Node never calls
`kill()` on the Guard or PostgreSQL and never controls either by PID.

Node installs catchable SIGINT, SIGTERM and SIGHUP handlers before the Guard launch. The first
outer handler only latches failure/cleanup and wakes the existing event loop; it does not write the
Guard pipe from the handler. The cleanup owner first rejects new work and boundedly closes Product
listeners, resources, pools and installer clients. Only after those close results are recorded
does it write exactly one authenticated `STOP_FAST` when a live Guard protocol exists. A close
timeout is retained as the first/cleanup error but does not create a second stop. Later signals
write nothing. Because the Guard/PostgreSQL session and process group are separate,
foreground-TTY SIGINT reaches Node's group but not the Guard or PostgreSQL. Private pipes and the
still-held Guard handle remain available for the bounded result.

Immediately after its own `execve`, the Guard marks control/event/secret/root/staging/log
descriptors `FD_CLOEXEC`. Before each child `execve`, it closes every descriptor except exact
`0/1/2`; for `initdb` only, the anonymous password descriptor is duplicated to exact FD 3 and is
the sole additional descriptor. For PostgreSQL the already bound log descriptor is duplicated to
stdout/stderr and then closed as an extra FD. No control, event, secret, root, staging or manifest
descriptor reaches PostgreSQL.

### 3.4 Bounded `initdb` and PostgreSQL supervision

`initdb` is the Guard's exact direct child and leader of a fresh initdb-only process group. The
Guard performs and verifies `setpgid(child, child)` before allowing exec progress and retains the
leader, including a terminal zombie, unreaped through every possible negative-PGID signal
decision so its PID/PGID cannot be recycled. The group has a fixed 30-second execution budget.
Every leader-status observation before the final permitted signal uses
`waitid(P_PID, leader, &leader_info, WEXITED | WNOHANG | WNOWAIT)` or an exactly proven equivalent
that cannot reap or release the leader identity. `kill(-pgid, 0)` is the only permitted
non-destructive group-presence probe.

On timeout, or on an early terminal leader observation while any group member remains, the Guard
first proves the exact leader is still unreaped and sends at most one SIGTERM to the exact
negative PGID. After the fixed two-second grace it again observes the leader without reaping and
probes the group without signaling. Only an unambiguous group-presence result while the exact
leader remains unreaped permits the one final SIGKILL to that same negative PGID; a permission or
identity ambiguity fails and preserves without another signal. After the final allowed signal or
the decision that no signal is needed, the Guard irrevocably disables destructive group
signaling, terminally reaps the exact leader and performs only a bounded sequence of
non-destructive group-absence probes. Exact `ESRCH` completes the absence proof. Persistent or
reappearing group presence, PID/PGID churn, permission ambiguity or any identity uncertainty
fails and preserves residue; it may cause a safe false failure but can never authorize a signal
to a possibly unrelated group. No destructive group signal is permitted after terminal leader
reap.

The accepted platforms must provide this bounded group-terminate, group-empty and leader-reap
contract, including `waitid` with `WNOWAIT` or an exactly proven non-reaping equivalent. The
pre-root `PROBE_ONLY` capability probe must fail before the persistent Guard is trusted, before
capability/task-root creation and before any operational child spawn when that primitive or the
proof is unavailable. Group SIGTERM/SIGKILL exists only for `initdb`; compiler phases have only
their direct-child SIGKILL. Neither permission is available for PostgreSQL, which retains the
at-most-one direct-child SIGINT contract below.

After successful `initdb`, the Guard creates and binds the exact log with
`O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW|O_CLOEXEC`, mode `0600`, and passes that same bound descriptor
for PostgreSQL stdout/stderr. Before `execve`, the PostgreSQL child has default signal
dispositions, an unblocked mask, no stdin, only the exact required descriptors, fixed argv, fixed
CWD/umask and its closed allow-listed secret-free environment.

The Guard keeps `postgres` unreaped as its direct child. Startup abort and normal fast stop both
map to the single accepted `STOP_FAST` command. Immediately before action the Guard revalidates
the manifest, live-unreaped direct-child state and all applicable process/configuration bindings,
then sends exactly one SIGINT to that still-unreaped direct child. PostgreSQL defines SIGINT as
fast shutdown. There is no second signal, retry, PID lookup, `postmaster.pid` control, `pg_ctl`,
SIGTERM, SIGKILL or alternate shutdown mode. If the child already exited/reaped or any binding is
ambiguous, no signal is sent. A 30-second terminal budget follows the one SIGINT. Expiry causes a
truthful terminal cleanup-failure state: the Guard remains the live supervisor, keeps the
PostgreSQL leader unreaped, performs no rename/deletion and preserves the process/root for explicit
handling. It is no longer waiting for success, and its watchdog treats this deliberate preserved
state as terminal failure rather than a supervisor hang. Node reports the live Guard/PostgreSQL
residue and never claims terminal Guard close or zero residue. No escalation or second stop is
permitted.

PID, process-start identity, executable identity and `postmaster.pid` remain attestations only.
They are not control capabilities. Direct parenthood plus unreaped-child state closes PID-reuse
control; deterministic PID-reuse tests must prove that stale/recycled numeric PIDs can never
receive a signal.

### 3.5 Immutable lifecycle and configuration binding

Before any migration/runner capability is issued, the owner binds one immutable final lifecycle
record containing:

- the complete provisional-record digest and owner capability;
- the decision-time trusted-group full-record, membership and combined snapshot digests, exact
  `direct-members:2`/`nested-groups:0` counts and `match` state, without any protected identity or
  member value;
- temporary-root, data-directory, socket-directory and log canonical paths plus
  device/inode/owner/mode and platform mount identity where applicable;
- the complete canonical PostgreSQL ancestor/binary chain manifest with stable-FD path, device,
  inode, owner UID, group identity, exact mode, ACL and digest/version/platform bindings;
- canonical PostgreSQL binaries, reviewed Runtime Guard binary/manifest, manifest-bound source/
  toolchain/SDK provenance and Guard session/process identities and digests; no live compiler/
  toolchain input;
- canonical path, device, inode, owner, mode and content digest for `postgresql.conf`,
  `pg_hba.conf` and `postgresql.auto.conf`;
- the private log descriptor's device/inode/owner/mode identity;
- Guard PID/session/process-group/start/executable identity and PostgreSQL direct-child
  PID/start/executable identity;
- PostgreSQL `system_identifier`;
- server-reported `server_version_num=170010`;
- server-reported `data_directory`, numeric address `127.0.0.1` and port `55435`; and
- exact `postmaster.pid` identity/content and private-socket identity.

File digesting must use an `O_NOFOLLOW` descriptor, compare `lstat`/`fstat` identity before and
after the read, and reject replacement, truncation or mutation during hashing. Canonical path
lookup alone is never sufficient. `postgresql.auto.conf` must remain the exact bound empty/default
file; `ALTER SYSTEM`, a substituted configuration file, unexpected include, reload drift or an
unbound setting source is forbidden. The mutable log is revalidated by descriptor identity, not
by a fixed content digest.

All applicable provisional and final bindings must be revalidated:

- immediately before Guard launch, before each Guard child `execve` and after readiness;
- before issuing the installer capability or running migrations;
- before creating generated runtime roles or least-privilege capabilities;
- before opening Auth/API/Product listeners;
- before every privileged attestation, fixture/preparation or cleanup transition;
- after every requested PostgreSQL reload/readiness transition;
- before the Guard's one PostgreSQL direct-child SIGINT; and
- before tombstone rename and every destructive Runtime-Guard filesystem operation.

Any configuration/HBA/auto-configuration/log, root, binary, process, postmaster, socket, listener,
system-identifier, mount or capability mismatch fails closed. A mismatching or ambiguous process
is not signalled. A filesystem mismatch observable before a rename/unlink prevents that operation;
a mismatch observable only after a raced name-based operation stops every further destructive
step and reports the exact partial outcome. The remaining root or tombstone stays for explicit
safe diagnosis.

### 3.6 Capability-only same-process runner composition

The outer lifecycle owner, `da5V5Main.ts`, `SyntheticAndroidE2eEnvironment.ts`,
`Da5V5OperatorLifecycle.ts` and the DA5 database preparation path remain in one Node process. The
owner constructs one non-exported, non-serializable in-memory bootstrap-superuser capability for
`taptime_da5_v5_installer` and exact database `taptime_synthetic_android_e2e`. The capability is
an owner-checked closure/private object, not a URL string, and can be consumed only by the
DA5-specific migration/preparation/attestation/cleanup composition. It cannot be cloned,
stringified, logged or passed through IPC.

Migrations and DA5 preparation then create the existing generated runtime roles. Installer access
is confined to migrations, fixture preparation, attestation and cleanup; Product services receive
only their existing least-privilege runtime capabilities. `da5V5Main.ts` creates the lifecycle
owner before the environment; `SyntheticAndroidE2eEnvironment.ts` accepts the private capability
only for explicit `da5-v5`; `database.ts` consumes it without reconstructing a URL; and
`Da5V5OperatorLifecycle.ts` orders Product/pool closure before the single Guard stop/deletion
protocol.

The existing `TAPTIME_SYNTHETIC_E2E_PASSWORD` is the memory-only synthetic **application login**
password used by the real Auth/Product path. It is not a PostgreSQL password, URL or owner
capability and remains subject to its existing immediate environment removal, buffer zeroization
and disclosure tests. This narrow application-login input does not permit any PostgreSQL
credential handoff.

The operational DA5-V5 entry must reject operator-supplied database URLs, command-line URLs,
inherited PostgreSQL URL/credential variables, shared endpoints, default ports and every database
URL handoff through environment or IPC. No layer may log or persist a PostgreSQL URL, password or
capability. Default and `da4-v5` profile behavior, entry points and existing environment contracts
remain byte-semantically unchanged and require explicit regressions.

## 4. HUMAN DECISION RECORDED — Option A same-UID/exact-admin-group threat boundary

### 4.1 Technical limit

POSIX provides no portable primitive that means “unlink this directory entry only if it still
names the inode represented by this already-open descriptor.” `unlinkat()` is name-relative, not
inode-conditional. Linux `renameat2(..., RENAME_NOREPLACE)` and macOS
`renameatx_np(..., RENAME_EXCL)` prevent replacement of an existing destination, but neither
atomically conditions the source name on the retained source FD/inode. Likewise, a final
`fstatat(..., AT_SYMLINK_NOFOLLOW)` followed by `unlinkat()` leaves a same-directory-entry race.
FreeBSD's non-portable `funlinkat` is a useful precedent but is neither POSIX nor available on the
authorized Linux/macOS target boundary and therefore cannot close this design.

Retained descriptors, no-follow walks, mount checks, random names and pre/post identity checks
strongly reduce accidental and cross-user hazards and detect many races. They cannot make
automatic recursive deletion safe against a malicious process running as the same OS UID with
write access to the parent namespace. That process can swap a source name after the last check or
swap a child entry between its last stat and unlink. No truthful ADO wording may call that
atomically safe. A process running as a member of the exact trusted group can likewise mutate an
accepted trusted-group-writable ancestor; the Human-selected boundary therefore excludes both
same-UID and exact-bound trusted-member hostility.

The only Human policy boundary introduced by the correction is Option A as extended by the exact
decision-time local admin-group identity and complete membership snapshot anchored in Section
3.2. The one-last-round authorization is governance only. Product behavior, Business rules, NFC
semantics, tenant authority, database semantics and Human V5 observations do not change.

### 4.2 Selection

**Selection: OPTION A — explicitly selected by the Human Architect on 2026-07-26.**

- **Option A — selected: exclusive trusted single-user operator session.** The local synthetic
  Harness assumes one trusted operator session. The Human Architect additionally confirms the
  second local administrator is trusted and accepts the exact complete decision-time local macOS
  admin-group membership set as a trusted host boundary for this Harness. This is only the exact
  decision-time group identity and membership snapshot bound disclosure-safely by the three
  Section 3.2 V1 digests, `direct-members:2` and `nested-groups:0`; it does not trust a group name,
  a substituted group, a later-added member, membership churn or a newly captured snapshot. No
  protected identity/member value is recorded in ADO/Evidence. Hostile or malicious processes
  running as the operator UID or any member of that exact trusted snapshot are outside the threat
  model because they can mutate an owner- or trusted-group-writable namespace. Depending on host
  hardening, that threat class may also be able to read process memory, ptrace/inspect or kill task
  processes;
  those capabilities are rationale for the explicit exclusion, not a universally proven host
  property.
  Mount/unmount namespace churn during the run is likewise excluded under this local assumption
  because the macOS mount tuple and older Linux mount IDs are observational rather than immutable.
  The implementation still defends against symlinks, users/groups outside the exact bound trusted
  snapshot, accidental drift, mounts and non-cooperating ordinary filesystem changes and fails
  closed wherever a mismatch is observable.
- **Option B — not selected: dedicated isolation identity/namespace.** Require a dedicated OS user, VM or
  container namespace so another process cannot mutate the owner namespace. This requires
  separately authorized system/environment changes, lifecycle design and additional
  implementation/verification work outside the current delta. A container label or namespace
  alone is insufficient if a host bind/shared volume still lets another host same-UID process
  mutate the cleanup namespace; that access must be technically excluded and verified.
- **Option C — not selected: retain every root for manual handling.** Never automatically unlink a DA5 root.
  This removes the destructive cleanup race but cannot provide the zero-residue preflight required
  before a later hardware run; every run would stop for manual handling under separately defined
  authority.

The Human selection means exactly that one trusted operator owns an exclusive local session and
only the exact decision-time macOS admin-group identity and complete membership snapshot anchored
in Section 3.2 are trusted host inputs. Hostile or malicious same-UID or exact-bound trusted-member
processes and mount/unmount churn are not defended threat classes and remain expressly outside the
model. Group/member/mode/ACL/identity drift remains fail-closed and does not become trusted; any
snapshot-anchor mismatch returns to the Human Architect rather than rebinding. The selection does
not claim that interference is impossible, does not close R-036 through an atomic primitive, and
does not authorize implementation. The next gate is a focused seven-file publication bound to
exact commit/tree and exact-head CI, followed by an independent review. Only `APPROVED` with zero
open P0–P3 may let the `AGENTS.md` standing rule activate the exact Section 8 R3 scope.

### 4.3 Conditional no-replace and descriptor-relative cleanup design

Under selected Option A, the Runtime Guard retains the bound parent/root
descriptors and immutable manifest from creation through cleanup. It uses one unpredictable
CSPRNG-generated tombstone name and the strongest supported no-replace primitive:

- Linux: `renameat2(parent_fd, source_name, parent_fd, tombstone, RENAME_NOREPLACE)`;
- macOS: `renameatx_np(parent_fd, source_name, parent_fd, tombstone, RENAME_EXCL)`; and
- every other platform or unavailable primitive: fail closed before destructive work.

Immediately before rename it revalidates parent/root descriptors, source name, inode, type, owner,
mode, device and mount identity. Immediately after rename it proves the original name absent,
opens the tombstone with `openat(..., O_DIRECTORY|O_NOFOLLOW)`, and requires it to match the
retained root identity. A pre-existing target, source mismatch, missing source, post-rename
mismatch or ambiguous result preserves the source/tombstone and performs no recursive unlink.
These checks are strongest-practical detection under the selected threat model, not an atomic
same-UID source-inode guarantee.

The Guard then performs two convergent descriptor-relative no-follow walks before the first
unlink. It accepts only regular files and directories, retains every directory FD needed by the
destructive phase, and requires each entry to remain on the root's `st_dev` and platform mount
identity. Linux requests `STATX_MNT_ID_UNIQUE` when the running kernel supports it; otherwise it
binds ordinary `STATX_MNT_ID` together with device/filesystem observations and treats the result
as observational under the selected threat model. macOS uses `fstatfs(fd)` and exact
`(f_fsid, f_mntonname)`, also observational. Symlink, socket, device, FIFO, unknown type,
nested/cross mount, non-convergent enumeration or identity mismatch observed before recursive
unlink fails before that unlink.

For each bottom-up entry, the Guard performs descriptor-relative last-moment
`fstatat(..., AT_SYMLINK_NOFOLLOW)` revalidation and then `unlinkat()` only under the Human-selected
same-UID model. Every regular file must have `st_nlink == 1`; where opening is permitted, the Guard
retains a no-follow FD across unlink, then requires `fstat(expected_fd).st_nlink == 0`, parent-name
absence and convergent parent enumeration. If a substitute was unlinked, the expected FD remains
linked and the mismatch stops cleanup. For a directory it retains the directory FD, uses
`AT_REMOVEDIR`, requires parent-name absence/convergent enumeration and the platform-validated
removed-directory `fstat`/link-state invariant established by focused Linux/macOS tests.

Test-only hooks must synchronize a swap precisely between that last stat and unlink. The
regression must prove the limitation honestly: a sacrificial substitute introduced
after the last stat may be unlinked; the next post-operation identity/enumeration check must then
stop all further deletion, report the exact partial result and preserve all remaining
root/tombstone state. Likewise, a source-name swap after the pre-rename check may move a
substitute to the tombstone; the mandatory post-rename identity mismatch must stop before the
recursive walk while preserving the original root and substitute tombstone. Under Option A the
unavoidable malicious same-UID/exact-bound-trusted-member and mount-churn gaps are explicitly out
of scope, under Option B they require the separately authorized namespace boundary, and Option C
never reaches this code. No generic recursive remover or fallback path is permitted.

These retained-FD/link-count checks detect the deterministic fixture and other observable races;
they do not create inode-conditional unlink and cannot exclude malicious same-UID or exact-bound-
trusted-member ABA.

The Guard binary and adjacent manifest remain outside the task root and are never unlinked,
rewritten or repaired by cleanup. The Guard reports a bounded result through its event pipe; Node
independently proves the original and tombstone names absent. Any non-identity I/O failure after
destructive work begins is reported as incomplete cleanup with preserved residue, never as
success.

## 5. Mandatory fresh-cluster attestation

The owner must complete both attestations below before migrations `001`–`013` or any other DA5
Product DDL runs.

### 5.1 Untouched-cluster attestation

Immediately after startup, through the bound postmaster and no other endpoint, require:

- matching PID/process, binary, `system_identifier`, data directory, socket, numeric address and
  port;
- exact owner-written PostgreSQL configuration and `pg_hba.conf` digests, SCRAM host rules and no
  `postgresql.auto.conf` override;
- only the fresh `postgres`, `template0` and `template1` databases with their generated owners,
  encodings, locales, connection flags, ACLs and tablespaces;
- only PostgreSQL 17.10 predefined roles plus bootstrap superuser
  `taptime_da5_v5_installer`, with exact memberships, role settings and password state;
- only default tablespaces, no replication slots, prepared transactions, publications,
  subscriptions, foreign servers, user mappings or event triggers;
- no unexpected sessions or locks beyond PostgreSQL background processes and the single bound
  owner session;
- no cluster settings outside the exact owner-written allow-list and no database/role settings,
  non-default ACLs, comments or security labels;
- only the standard `plpgsql` extension where fresh PostgreSQL 17.10 `initdb` creates it, with
  exact default owner, schema and version; no other extension or user-created catalog object.

The allow-list must be derived from and regression-tested against a genuinely fresh PostgreSQL
17.10 cluster with `server_version_num=170010`, not from a previously used local service.

### 5.2 Empty DA5 database attestation

Only after Section 5.1 passes may the owner explicitly create the fixed fresh database
`taptime_synthetic_android_e2e`, owned by `taptime_da5_v5_installer`. The database must be absent
in the freshly attested cluster before this explicit creation, and `initdb` must have created
exactly the fixed installer role. An occupied port or any missing/conflicting fixed resource
fails without an alternative name or port. The owner must adopt nothing. Before composing the DA5
migration/preparation layer, require:

- exact creator/owner, database ACL and bootstrap-superuser SCRAM state created during this same
  owner lifecycle;
- an empty application catalog: no `taptime_server`, migration ledger, Product tables, views,
  materialized views, sequences, routines, triggers, policies, user-defined types or non-default
  schemas;
- no default-privilege, ownership, ACL, dependency, comment, security-label, role-setting or
  connection-state drift;
- no foreign database session; only the exact owner attestation session may exist until it
  closes and the same-process migration/preparation layer receives its capability;
- no generated DA5 runtime role yet.

Migrations and DA5 preparation may then create only the already specified generated runtime
roles, grants, schema and fixture. The installer capability remains isolated from Product
services. Before Product listeners open, re-attest the exact migration ledger, generated-role
attributes/memberships and Product least-privilege capability boundaries.

The checks form a closed allow-list over relevant PostgreSQL 17.10 cluster and database catalogs.
Unknown or newly observable mutable state is rejection, never an invitation to extend cleanup.

Any failed or ambiguous attestation stops before DA5 DDL. No legacy database, role, schema or
object may be adopted, quarantined, renamed, altered, dropped or repaired. An external/shared
endpoint remains completely unchanged. A failed freshly owned cluster may only undergo the exact
lifecycle cleanup in Section 7.

## 6. Runtime and CI invariants

- The outer lifecycle owner retains cluster authority for the complete run. Only the
  migration/fixture/attestation/cleanup layer can use the installer capability; Product services
  hold only their existing least-privilege runtime capabilities.
- Migrations `001`–`013`, fixture preparation and the existing DA5 gate semantics run unchanged
  only after the fresh-cluster attestations pass.
- The owner treats runner failure, timeout, signal, pool-close failure and its own termination as
  mandatory cleanup paths. First error wins; cleanup errors are appended without hiding it.
- Catchable outer SIGINT, SIGTERM and SIGHUP, uncaught failure and unhandled rejection latch one
  cleanup and at most one private-pipe `STOP_FAST`; none is forwarded as an OS signal to the
  Guard/PostgreSQL session. The only PostgreSQL shutdown signal is the Guard's one direct-child
  SIGINT under Sections 3.3–3.4 and 7. A second outer signal writes no second command.
- The held Guard handle, private protocol capability, installer capability, cleanup manifest and
  CI adapter capability are distinct, non-exported and non-serializable.
- No Product listener or safe-ready output may appear before final lifecycle/configuration
  attestation and least-privilege capability verification.
- Default and `da4-v5` profiles must remain unchanged and pass explicit source/behavior
  regressions in addition to the DA5 tests.

### 6.1 Exact CI test-only outer-owner contract

The current `synthetic-android-e2e` job really starts the Docker image
`postgres:17.10-alpine`. The later R3 implementation is authorized to change only that job's
PostgreSQL ownership/adapter/cleanup steps in `.github/workflows/ci.yml`; no job selection,
trigger, permission, dependency, other job or Product setting may change.

CI is an explicit test-only adapter, not the operational DA5-V5 launcher. Its only permitted
differences from the operational cluster are:

- container-internal/host-network port `5432` instead of operational port `55435`;
- bootstrap role `postgres` instead of `taptime_da5_v5_installer`; and
- the target database `taptime_synthetic_android_e2e` created by the official Docker entrypoint
  instead of by the local owner after untouched-cluster attestation.

The CI owner contract is exact:

1. resolve `postgres:17.10-alpine` to one immutable repository digest, record that digest and the
   local image ID, and run that exact digest;
2. generate a cryptographically random per-job nonce and a random container name containing the
   exact GitHub run ID, run attempt, job identity and nonce;
3. add exact owner labels for repository, run ID, attempt, job and nonce; use `--cidfile`, omit
   `--rm`, and never use the name as a cleanup target;
4. bind the exact full container ID, image ID/repository digest, labels, Docker `StartedAt`, host
   init PID and host OS process-start identity before the test adapter is issued;
5. query `pg_control_system().system_identifier` once from inside the exact CID and once through
   the external loopback connection; require exact equality along with PostgreSQL
   `server_version_num=170010`, `127.0.0.1`, port `5432`, role `postgres` and target database;
6. expose the PostgreSQL environment URL only on the one focused test-adapter step together with
   the bound expected owner record; remove the current job-level URL;
7. have that adapter re-attest CID, labels, image, start identity and inner/outer
   `system_identifier`, then construct one non-exported same-process test capability for the
   Synthetic tests; and
8. reject that CI adapter/capability from `da5-v5:start`, every operational entry and every
   Human/hardware Evidence path.

Focused negative tests must fail closed for wrong/missing CID, nonce, owner label, image ID,
repository digest, start identity, inner/outer `system_identifier`, port, role, database and URL,
and must prove that the operational DA5 entry never reads the CI URL.

The final cleanup step remains `if: always()` and:

- reads only the exact CID from the bound cidfile;
- revalidates CID/labels/image/start identity before mutation;
- removes only that CID;
- contains no `|| true`, name fallback, label-based removal or broad Docker cleanup; and
- proves the exact CID absent and zero container residue for the exact run/attempt/job/nonce owner
  labels.

If no exact CID exists, cleanup performs no removal and proves label residue zero. A missing CID
with matching residue, identity mismatch, removal failure or residue is a failing cleanup result,
not an ignored teardown event.

## 7. Mandatory bounded cleanup

Cleanup latches once after success, failure, timeout, catchable outer signal or partial startup.
First error wins; later cleanup failures are appended without replacing it. Every wait has a fixed
monotonic deadline.

1. Reject new operator/Product work; close operator and credential input; zero secret buffers.
2. Close Product listeners/resources and every least-privilege pool, then close
   fixture/migration/attestation installer clients and prove zero application connection.
3. If PostgreSQL never spawned, obtain the Guard's terminal proof for `initdb` or its exact
   pre-spawn state. If PostgreSQL spawned and is still the Guard's unreaped direct child, Node
   writes the single authenticated `STOP_FAST`; only the Guard may translate it into the one
   PostgreSQL SIGINT. If already reaped or ambiguous, no signal is sent.
4. Await the bounded Guard child-process proof event while retaining the live Guard handle. A
   successful process result requires reaped `initdb`/PostgreSQL, closed inherited secret/log
   descriptors, absent `postmaster.pid` and private socket, no `127.0.0.1:55435` listener and no pool/runner
   connection. Guard timeout, protocol ambiguity, failed reap, residual process/listener or any
   identity/configuration mismatch is cleanup failure and forbids deletion.
5. Only after those proofs, and only under the Human-selected Section 4 option, let the still
   running Guard perform the no-replace tombstone and descriptor-relative cleanup before it exits.
   Node then closes the control pipe, awaits the fixed terminal Guard deadline, proves
   original/tombstone absence and reaps the held Guard handle. If the Guard misses that deadline,
   its internal watchdog self-terminates it; Node does not signal it and reports possible residue.

If step 4 reports the defined PostgreSQL 30-second fast-stop timeout, step 5 is not entered: the
Guard deliberately remains supervising the unreaped PostgreSQL process, all filesystem state is
preserved, and cleanup returns `FAIL` with live task-owned residue. This preserved terminal-failure
state is not an unbounded wait and is never described as Guard/process closure.

No compiler/linker process exists in an operational run. The separate R3 artifact-production task
owns its bounded direct-child compile/link termination before any operational PostgreSQL root is
created. Operational `initdb` timeout uses only the Guard's initdb-only process-group
SIGTERM/grace/SIGKILL sequence. PostgreSQL receives at most one SIGINT and no other signal. Node
never signals the Guard or PostgreSQL, and no PID-only cleanup API exists.

Catchable SIGINT/SIGTERM/SIGHUP during artifact verification, Guard startup, `initdb`, PostgreSQL
readiness, migrations or Product startup enters the same latch. Before PostgreSQL, it causes the
Guard to finish or terminate/reap only its exact initdb process group; after PostgreSQL spawn it
causes bounded Product/resource closure followed by the single private-pipe stop command. A
second outer signal does nothing beyond retaining the latched first failure.

An uncatchable SIGKILL of Node or the Guard cannot execute this protocol and may leave a
task-owned Guard/PostgreSQL process or root. Such residue is reported as possible, is never
silently adopted or auto-cleaned by a later run, and blocks zero-residue hardware preflight until
handled under separate explicit authority. This is not represented as successful cleanup.

Cleanup never intentionally targets or adopts another PostgreSQL cluster, database, role,
service, process, container or a path outside the bound task namespace. Under Human-selected
Option A, the descriptor/staging boundary confines ordinary cleanup; the expressly excluded
malicious same-EUID/exact-bound-trusted-member race and mount/unmount churn can still defeat
namespace identity and are not re-described here as impossible. Any observable namespace,
process, mount, descriptor, manifest or configuration mismatch stops every further destructive
step and preserves the remaining root/tombstone.

## 8. Exact implementation delta after Option-A publication, CI and approval

Only after this exact Option A record is focused-published, bound to exact commit/tree and
successful exact-head CI, and receives independent `APPROVED` with zero open P0–P3 may the
`AGENTS.md` standing rule authorize:

- `apps/synthetic-android-e2e/src/database.ts`;
- `apps/synthetic-android-e2e/src/da5V5Main.ts`;
- `apps/synthetic-android-e2e/src/SyntheticAndroidE2eEnvironment.ts`;
- `apps/synthetic-android-e2e/src/Da5V5OperatorLifecycle.ts`;
- new private modules:
  - `apps/synthetic-android-e2e/src/Da5V5RuntimeGuardArtifact.ts`;
  - `apps/synthetic-android-e2e/src/Da5V5PostgresRuntimeGuard.ts`;
  - `apps/synthetic-android-e2e/src/Da5V5PostgresCapability.ts`;
  - `apps/synthetic-android-e2e/src/Da5V5CiPostgresAdapter.ts`;
- `apps/synthetic-android-e2e/tests/SyntheticAndroidE2e.test.ts`;
- `apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts`;
- new focused tests:
  - `apps/synthetic-android-e2e/tests/Da5V5RuntimeGuardArtifact.test.ts`;
  - `apps/synthetic-android-e2e/tests/Da5V5PostgresRuntimeGuard.test.ts`;
  - `apps/synthetic-android-e2e/tests/Da5V5PostgresCapability.test.ts`;
  - `apps/synthetic-android-e2e/tests/Da5V5CiPostgresAdapter.test.ts`;
- exactly one native source:
  `apps/synthetic-android-e2e/native/da5_v5_runtime_guard.c`;
- one software-phase-only immutable external Guard binary/manifest pair at the exact Section 3.2
  path after its implementation SHA is known; artifact creation is authorized only as part of the
  later R3 V0–V4 phase and is not performed by this ADO draft;
- `apps/synthetic-android-e2e/README.md`;
- script/build-entry changes only in `apps/synthetic-android-e2e/package.json`, with no
  dependency or version change;
- the minimal exact `synthetic-android-e2e` PostgreSQL owner/adapter/cleanup delta in
  `.github/workflows/ci.yml` defined by Section 6.1, with every other workflow byte
  behaviorally unchanged; and
- the minimum truthful synchronization in:
  - this authorization and the existing DA5-V5 enablement authorization;
  - `ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`;
  - `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`;
  - `ADO/00_Core/Project_Status.md`;
  - `ADO/00_Core/Decision_Log.md`;
  - `ADO/00_Core/Risk_Register.md`;
  - `ADO/README.md`.

The implementation must remove or simplify obsolete DA5 Shared-Cluster catalog-lock,
fingerprint, adoption, quarantine, legacy-mutation and destructive-cleanup code and tests.
Useful assertions may remain only when they verify the new private-cluster boundary. Existing
uncommitted WIP must be reconstructed as an exact reviewed delta from the later approved
publication baseline, not carried forward wholesale or represented as prior Evidence.

No `Da5V5OwnedTreeDeletion` module/source, second native helper, shell wrapper or alternate
supervisor is authorized. Test synchronization hooks must compile from the same single C source
behind an explicit test-build define; the production binary rejects test protocol fields and has
a distinct bound digest.

The R3 package/build entry may create the Guard artifact once. `da5-v5:start`, the runbook and
every later operational/hardware entry must contain no compiler path and must only verify/use the
reviewed read-only binary/manifest. The runbook/evidence synchronization must bind their exact
path, size, SHA-256, mode, architecture, load dependencies, source/toolchain/SDK/OS provenance and
independent Exact-SHA verdict before any hardware authorization package can be prepared.

The default and `da4-v5` paths may receive no behavior change. Their current PostgreSQL URL-based
test/development composition is not converted into DA5 owner authority, and their complete
existing profile/isolation regressions are mandatory. No existing DA5 Product/gate semantics,
application-login-password behavior or Mobile/ADB logic may be redesigned in this correction.

## 9. Explicit exclusions

This candidate does not authorize:

- Product rules, Business rules, migrations, schema semantics, NFC semantics or production code
  outside the synthetic operational boundary;
- any legacy adoption, quarantine, rename, repair or drop path;
- external dependencies, `package-lock.json`, root scripts or workflow changes outside the exact
  Section 6.1 `synthetic-android-e2e` job delta;
- system installation, package-manager mutation, PostgreSQL service-manager changes, or any
  account, group, membership, ownership, mode, ACL or Homebrew repair/mutation;
- any compiler/linker/SDK invocation from `da5-v5:start`, the runbook or a hardware-bound run;
- `pg_ctl`, PID lookup or any process signal except the R3 artifact-producer's compiler/linker
  direct-child bounded termination, operational initdb-only SIGTERM/SIGKILL sequence, Guard
  watchdog's process-directed self-SIGKILL and one Guard-to-PostgreSQL direct-child SIGINT
  expressly specified above;
- broadening selected Option A to include hostile/malicious same-UID or exact-bound trusted-member
  processes or mount/unmount churn, treating the selection itself as implementation/hardware
  approval, or switching to Option B/C without a new exact Human decision and authorization;
- APK rebuild/change/signing, artifact replacement, installation, ADB, USB, device or Tag access;
- Human-/Hardware-V5, production, production data, deployment or distribution;
- access to or disclosure from `research/` or the repository-root `app.json`;
- commits, pushes or merges merely because this unreviewed candidate exists.

A required dependency, lockfile, other workflow, Product, architecture or broader ADO change is a
new finding and requires separate exact authorization.

## 10. Adaptive Verification Standard

### Candidate now — R0/V0 only

- bind the starting commit/tree to `43567d256e8f633f16866448e1fb5abbd8022733` /
  `feecced92abe9fc536a2db052b5a616d3e0f1cf7`, exact parent
  `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`;
- validate Markdown structure, whitespace, exact status/CI/review wording and every internal path;
- prove the correction changes only these seven ADO files:
  `ADO/02_Development/Development_Assignment_05_V5_Isolated_PostgreSQL_Correction_Authorization.md`,
  `ADO/00_Core/Project_Status.md`,
  `ADO/02_Development/Development_Assignment_05_V5_Enablement_Authorization.md` and
  `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`,
  `ADO/00_Core/Decision_Log.md`, `ADO/00_Core/Risk_Register.md` and `ADO/README.md`;
- report all pre-existing Shared-Cluster WIP separately as `BLOCKED` and not Evidence;
- carry exact-head CI `30186846379`, attempt 1, 12/12 only as extra-round candidate evidence and
  preserve round-3 CI `30185670176` and round-2 CI `30177897059`, each attempt 1, 12/12, as
  history;
- preserve both the historical round-2 five-P1/one-P2/one-P3 truth and the round-3
  `CHANGES REQUIRED` truth of exactly two P1 with zero P0/P2/P3;
- preserve the extra-round Exact-Delta `CHANGES REQUIRED` truth of exactly one P1 and zero
  P0/P2/P3, including explicit closure of initdb P1-B;
- verify the Human Architect trusts the second local administrator and the exact decision-time
  local macOS admin-group identity and complete membership snapshot under Option A only as frozen at
  decision time by exactly two direct members, zero nested groups and the three Section 3.2 V1
  SHA-256 anchors, and authorized exactly one last focused ADO correction/review round limited to
  the remaining P1, with no implementation or hardware authority;
- verify the same three exact decision-time digests and both counts occur consistently in all
  seven files, and no file permits later-current capture, dynamic re-acceptance or anchor update;
- verify disclosure-safe wording: ADO/Evidence contains only the three anchored digests, counts
  and match/mismatch state, never a group name, numeric GID, group GUID, username, numeric UID,
  member GUID or secret; and
- verify that Section 4 visibly records exact Option A, with one exclusive trusted single-user
  operator session, the exact decision-time-anchored admin-group membership snapshot trusted, and hostile/
  malicious same-UID or exact-bound trusted-member processes plus mount/unmount churn outside the
  threat model; verify no system/account/group/Homebrew/mode/ACL mutation occurred, implementation
  remains blocked pending focused publication, exact-head CI and independent `APPROVED`, and no
  Product test or new correctness claim is attributed to this ADO-only synchronization.

### Proposed R3 implementation — V0–V4

- **V0:** Human Option A record, authority, exact baseline, allowed-file diff, WIP separation and
  protected-path checks.
- **V1 process/PTY:** prove `detached:true` creates a distinct POSIX session/process group while
  Node retains the Guard handle/pipes; assert no TTY/no controlling terminal/no `unref`; a
  PTY-generated foreground SIGINT and process-group SIGINT/SIGTERM/HUP reach only Node's latch,
  boundedly close Product resources and create exactly one later `STOP_FAST`, never direct
  Guard/PostgreSQL delivery. Prove HELLO→START_MANIFEST→ACK precedes child spawn, heartbeat lease,
  Guard signal masking, complete child signal-mask/default reset, duplicate/invalid frame
  rejection, EOF/POLLHUP/lease-expiry fail-stop, bounded Guard exit and no PID/signal control by
  Node.
- **V1 artifact/hang/termination:** artifact-producer compiler/linker success/failure/20-second
  timeout/terminal reap/no-grandchild contract and exact immutable manifest; prove operational
  start has no compiler/linker child. Exercise Guard startup/protocol timeouts plus watchdog
  self-SIGKILL/held-handle reap with truthful residue; initdb normal exit, process-group
  SIGTERM-grace exit, one-SIGKILL, group-empty proof and terminal leader reap. Prove every
  pre-final-signal leader observation uses supported non-reaping `waitid(..., WNOWAIT)` or its
  exactly proven equivalent; cover early leader exit with a lingering member, leader-zombie
  retention through TERM/KILL decisions, unsupported primitive fail-before-trust and the
  prohibition on every destructive group signal after terminal leader reap;
  PostgreSQL one-SIGINT/30-second timeout with preserved residue; interruption at every phase;
  secret-FD close and buffer zeroization on each result. Assert compiler/initdb-only termination
  never targets PostgreSQL.
- **V1 trust/environment:** positive artifact-production toolchain identity plus negative compiler, `xcrun`,
  SDK/sysroot/include/linker/start-object/bindir/source/Guard digest, version, mode, owner and
  signature replacements. Poison every rejected variable/family, locale and loader override;
  prove separately closed allow-listed environments for artifact compiler/linker and operational
  `pg_config`, Guard, `initdb` and `postgres`; verify binary/manifest path, size, SHA, mode,
  architecture, OS, signature and load-dependency mismatch rejection. For the existing
  PostgreSQL 17.10 Homebrew toolchain, prove a root-owned non-group/world-writable positive
  fixture, a same-EUID-owned non-group/world-writable positive fixture and the exact decision-time-
  anchored admin-group/same-EUID-owned Homebrew Cellar `0775` positive chain without ownership, permission,
  account, group, membership, system or Homebrew mutation. Reproduce the exact Section 3.2
  directory-service validation and V1 canonical bytes, require `direct-members:2`,
  `nested-groups:0` and exact equality to all three decision-time SHA-256 anchors before
  capability/task-root creation and before every trust use. Reject group substitution, changed
  GID/GUID, member-set or group-record change, count change, digest mismatch, a foreign group, any
  attempt to update/rebind an anchor, any root/foreign-owner group-writable ancestor, every world-
  writable path, any binary group/world writability, any binary mode other than its exact observed
  `0555`, every other exact-mode/ACL change, unexpected or write-granting ACL, noncanonical/alias
  execution, symlink or ancestor-chain swap and every path/device/inode/owner/group/mode/ACL/
  chain-manifest-digest/binary-digest/version/platform-identity mismatch before capability/task-
  root creation. Repeat the three-anchor/count, chain and binary revalidation and every mismatch
  case immediately before each trust use or `execve`; any mismatch must return to the Human
  Architect rather than accept the later-current state.
- **V1 process identity:** direct-parent/unreaped-child state, already-exited child, manifest
  generation/capability replay and deterministic PID/PGID-reuse simulations. Include early
  initdb-leader exit with a lingering group member and churn immediately after terminal reap;
  any churn may only preserve residue/false-fail, and no recycled PID or unrelated group may
  receive control.
- **V1 configuration/cleanup:** replace/reload/truncate `postgresql.conf`, `pg_hba.conf` and
  `postgresql.auto.conf`; substitute the log inode; test Linux/macOS no-replace success,
  pre-existing tombstone rejection, bounded `PROBE_ONLY` lifecycle and unsupported
  platform/filesystem/`ENOSYS`/`EINVAL`/`ENOTSUP` failure; symlink, source-inode swap, child-entry
  swap, cross-device, same-device nested-mount, unknown-platform and non-convergent enumeration.
  Include regular-file link-count/retained-FD and platform-valid removed-directory proofs plus a
  hardlink (`st_nlink != 1`), extended/default ACL, synchronized last-stat-before-`unlinkat` race
  and process-crash tests before/after probe, rename and individual unlink stages. Every observable
  mismatch must prove zero further unlink and retained root/tombstone; expected same-UID/exact-
  bound-trusted-member behavior must match Human-selected Option A and never claim atomic inode-
  conditional unlink.
- **V1 capability/secrecy:** private capability non-export/secrecy, operator/shared/default-port
  rejection, fixed-resource/catalog allow-lists and application-login-password versus PostgreSQL
  credential separation.
- **V1 CI:** positive exact-owner adapter tests and negative CID/nonce/label/image/digest/start-
  identity/inner-outer-system-identifier/URL/port/role/database cases, plus exact-CID-only cleanup
  and residue failures.
- **V2:** real local transient PostgreSQL 17.10 tests covering exact version/port/database/role,
  exact preserved Guard artifact verification with zero operational compilation, Guard-owned
  startup/fast-stop, true SCRAM authentication, wrong secret, foreign/dirty endpoint
  rejection without mutation, lost-port and config/HBA/auto-config/log/process/system-identifier
  substitution, artifact-producer compiler/linker hangs and operational initdb hangs, startup
  failure before/after spawn/readiness,
  already-exited child, early initdb-leader exit with a lingering member, non-reaping leader
  observation through final initdb-group signal, post-reap PID/PGID churn without destructive
  signaling, unsupported non-reaping primitive failure before trust, PostgreSQL timeout residue,
  runner/pool close ordering and outer PTY/SIGINT/SIGTERM/SIGHUP/failure cleanup. Exercise the
  accepted root-owned and exact-same-EUID PostgreSQL ancestor/binary chains, including the exact
  decision-time-anchored admin-group/Cellar-`0775` case, including exact two-direct/zero-nested
  counts and all three V1 digests, plus safe negative later-current capture, group substitution,
  member-set/count/group-record/digest change, foreign group, binary group/world-write, world-
  writable path, owner/mode/ACL, symlink/swap and bound-identity cases without changing any
  account, group, membership, ownership, permission, Homebrew or system state. Run the real
  Runtime Guard no-replace/deletion success plus available cross-mount and synchronized race
  integration; deterministic fault tests remain
  mandatory where the host cannot create a mount/race fixture. Require a fresh cluster per serial
  case where isolation matters, no resource fallback, and prove zero owned process/listener/root
  residue on every claimed successful cleanup.
- **V2 integration:** run migrations `001`–`013`, replay/ledger checks and the complete Synthetic
  suite through the capability-only runner boundary; run the exact
  `postgres:17.10-alpine` CI-owner adapter contract and negative owner tests. Its step-local
  test-only URL must never reach the operational DA5-V5 entry or count as V5 Evidence.
- **V3:** complete repository test, tests-inclusive typecheck, build, security and migration
  matrix required by the current AVS; explicit default/DA4 unchanged-profile regression; final
  workflow, allowed-file, protected-path and process/listener/root/container residue checks.
  Produce exactly one final read-only Guard binary/manifest from the exact implementation SHA,
  rerun its focused/integration tests against that binary and bind path/size/SHA/mode/architecture/
  load dependencies/source/toolchain/SDK/OS.
- **V4:** focused publication, exact-head CI with all required jobs green, then independent
  read-only Exact-SHA implementation/artifact review with zero open P0–P3. A later runbook handoff
  may reference only that reviewed Guard artifact and must not compile it.
- **V5:** not authorized; stop before USB, ADB, installation, device or Tag interaction.

Every confirmed R3 correction repeats affected V1/V2 and one final V3/V4 before re-review.

## 11. Approval and stop boundary

The reviewed extra-round candidate `43567d256e8f633f16866448e1fb5abbd8022733`, tree
`feecced92abe9fc536a2db052b5a616d3e0f1cf7`, exact parent
`bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, passed exact-head CI `30186846379`, attempt 1,
12/12. Its Exact-Delta review is `CHANGES REQUIRED` with exactly one P1 and zero P0/P2/P3; initdb
P1-B is closed. It does not activate implementation. The Human Architect has selected exact
Option A in Section 4, confirmed that the second local administrator and exact complete decision-
time local macOS admin-group membership snapshot are trusted: exactly
two direct members, zero nested groups, full-record digest
`b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`, membership digest
`70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064` and combined snapshot
digest `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`. The Human Architect
authorized exactly one last focused ADO correction/review round limited to the remaining P1.
Neither that selection nor the last-round authority approves this unbound working-tree draft or
activates implementation.

The next required gate is the authorized focused seven-file last-round ADO publication bound to
exact commit/tree and successful exact-head CI, followed by independent Exact-Delta review of the
remaining P1 correction and all retained bindings. Only an `APPROVED` verdict with zero open P0–
P3 may activate the `AGENTS.md` standing rule for the exact R3 scope in Section 8. It authorizes
no omitted file or design choice. Any proposed departure from exact Option A—including a
different group/member snapshot, Option B system/environment isolation or Option C manual
retention—returns to the Human Architect.

After implementation V0–V4 and independent Exact-SHA approval, the Technical Lead must stop and
report the exact hardware preflight still required. Hardware may begin only under a separate,
fresh, exact Human authorization. Production, production data, deployment and distribution
always require separate express authorization.

## 12. Copy-ready independent candidate review

```text
Act as the independent read-only TapTim.e Review Agent.

Review exactly this complete seven-file candidate delta:
1. ADO/02_Development/Development_Assignment_05_V5_Isolated_PostgreSQL_Correction_Authorization.md
2. ADO/00_Core/Project_Status.md
3. ADO/02_Development/Development_Assignment_05_V5_Enablement_Authorization.md
4. ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md
5. ADO/00_Core/Decision_Log.md
6. ADO/00_Core/Risk_Register.md
7. ADO/README.md

Preserve the historical round-2 binding:
7739757a4855ee7bac34408941e94c25516d75f5, tree
0398066e92fef65562526f61c9515b0ef3be0114, exact parent
72fbd3c20329dfbf3e8a1509025bd630b1bb130a, exact-head CI
30177897059 attempt 1 (12/12).

Bind the reviewed round-3 candidate to commit
bbcb1b59703ee866539b2bc384ec9db8c2643fe4, tree
dfb5abbca1f2ddf603d191ae3303d1336f5440c7, exact parent
7739757a4855ee7bac34408941e94c25516d75f5, exact-head CI
30185670176 attempt 1 (12/12).

Bind the reviewed extra-round candidate to commit
43567d256e8f633f16866448e1fb5abbd8022733, tree
feecced92abe9fc536a2db052b5a616d3e0f1cf7, exact parent
bbcb1b59703ee866539b2bc384ec9db8c2643fe4, exact-head CI
30186846379 attempt 1 (12/12), and bind the future authorized last-round correction publication:
- commit: <LAST_ROUND_CORRECTION_COMMIT>
- tree: <LAST_ROUND_CORRECTION_TREE>
- exact-head CI run/attempt/result: <LAST_ROUND_EXACT_HEAD_CI>

Reject the package as incomplete if any last-round placeholder is unresolved when this prompt is
executed. The Human Architect confirms the second local administrator and the exact complete
decision-time local macOS admin-group membership snapshot are trusted under Option A: exactly two
direct members, zero nested groups, full-record SHA-256
b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5, membership SHA-256
70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064 and combined snapshot
SHA-256 2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217. The Human Architect
authorized exactly one last focused ADO correction/review round limited to the remaining P1. No
group name, numeric GID, group GUID, username, numeric UID, member GUID or secret may be recorded
in ADO/Evidence. That decision grants no implementation or hardware authority.

The pre-existing local Shared-Cluster WIP is uncommitted, BLOCKED and not Candidate Evidence. Its
180/180 Synthetic result is not the current path. Do not review it as an implementation candidate
and do not modify any file. Do not access research/ or the repository-root app.json.

The technically enforced read-only round-2 Ultra re-review returned CHANGES REQUIRED with exactly:
1. P1 detached=false allowed terminal/process-group SIGINT to bypass PostgreSQL supervision.
2. P1 compiler/helper/initdb lacked a bounded terminal cleanup/hang path.
3. P1 compiler/toolchain/environment trust was incomplete.
4. P1 renameat did not bind the source inode and lacked a no-replace destination.
5. P1 fstatat-to-unlinkat remained a destructive same-UID TOCTOU.
6. P2 the review prompt named only one candidate file.
7. P3 Decision Log and ADO README navigation/status were stale/incomplete.

The independent round-3 review returned CHANGES REQUIRED with exactly two P1 and zero P0/P2/P3:
1. P1 the existing PostgreSQL 17.10 Homebrew trust contract rejected same-EUID ownership allowed
   by Option A and did not fully bind/revalidate the canonical ancestor chain.
2. P1 initdb used a potentially reaping leader-status observation before its final possible
   negative-PGID signal.

The independent extra-round Exact-Delta review returned CHANGES REQUIRED with exactly one P1 and
zero P0/P2/P3:
1. P1-A the current same-EUID-owned Homebrew Cellar ancestor is observed at mode 0775, so blanket
   group-write rejection is unusable and the trusted group plus complete current membership set
   were not bound.

The extra-round review explicitly closed P1-B: initdb's leader remains unreaped through every
possible negative-PGID signal under waitid(..., WNOWAIT) or its exactly proven equivalent.

Verify every historical round-2 disposition, both round-3 dispositions, the single remaining
extra-round P1 correction and all seven cross-file status bindings. In particular verify:
- Section 4 records the Human Architect's exact Option A selection: one exclusive trusted
  single-user operator session whose exact decision-time local macOS admin-group identity and
  complete membership snapshot are trusted only under the three exact digests and two exact counts
  above. Hostile/malicious same-UID and exact-bound trusted-member processes plus mount/unmount
  churn remain outside the threat model. No similar group, later member, membership churn or
  later-current snapshot is trusted. Missing, ambiguous or broader wording requires CHANGES
  REQUIRED.
- Product, Business and NFC semantics remain unchanged. The only new Human decision is the exact
  decision-time local admin-group/member snapshot trust boundary and one last focused ADO round.
- The directory-service derivation requires one numeric GID, one group GUID, zero nested groups,
  exactly two complete direct members and exact equality between `GroupMembers` GUIDs and GUIDs
  obtained by resolving every `GroupMembership` account to exactly one numeric UID/user GUID.
  Duplicate, unresolved, ambiguous, cyclic, nested, partial or unequal state fails closed.
- Full-record canonical bytes use the exact
  `DA5-V5-TRUSTED-MACOS-ADMIN-FULL-GROUP-RECORD-V1\n` prefix, compact UTF-8 JSON of all returned
  group-record attributes with lexicographically sorted keys and lexicographically sorted string
  values, then LF. Membership bytes use
  `DA5-V5-TRUSTED-MACOS-ADMIN-MEMBERSHIP-V1\n`, then decimal-UID/uppercase-user-GUID pairs sorted
  by numeric UID and GUID bytes. Combined bytes use
  `DA5-V5-TRUSTED-MACOS-ADMIN-SNAPSHOT-V1\n`, followed in exact order by the protected decimal GID
  after `gid:`, protected uppercase group GUID after `guid:`, anchored full-record digest after
  `group-record:`, anchored membership digest after `members:` and `nested-groups:0`; every line is
  LF-terminated. Their SHA-256 values must equal the three exact decision-time anchors above.
- A task-private immutable manifest may carry the protected identities. ADO/Evidence/status/
  ordinary output disclose only the three digests, `direct-members:2`, `nested-groups:0` and
  match/mismatch. Later R3 must recompute and match all three anchors and both counts before
  capability/task-root creation and every trust use. Any mismatch returns to the Human Architect;
  dynamic acceptance, anchor update and rebinding to later-current state are forbidden.
- One locally compiled source, native/da5_v5_runtime_guard.c, is the sole Runtime Guard. It is
  compiled/tested exactly once during R3, fixed with a disclosure-safe read-only external
  binary/manifest, bound by path/size/SHA/mode/architecture/load dependencies/source/toolchain/
  SDK/OS and independently Exact-SHA reviewed. Operational/hardware start verifies that artifact
  and invokes no compiler/linker/SDK.
- The reviewed Guard is direct parent/supervisor of initdb/postgres, launched by Node with
  detached:true, held handle, no TTY/no unref and private pipes in a separate POSIX session/group.
- HELLO/START_MANIFEST/ACK and one-shot capability complete before any child; EOF/POLLHUP,
  malformed/duplicate frames and heartbeat lease expiry fail-stop.
- Catchable outer signals latch one private STOP_FAST command; Guard/PG are isolated from
  foreground-TTY/process-group signals; Node uses no PID/signal control; Guard sends at most one
  SIGINT to its unreaped postgres direct child; PID reuse cannot become control.
- Artifact-producer compiler/linker and operational initdb have exact bounded termination/reap/
  no-grandchild-or-process-group-empty paths; their SIGKILL/SIGTERM permissions cannot target
  PostgreSQL.
- Every initdb leader-status observation before the final possible group signal uses
  waitid(P_PID, leader, ..., WEXITED|WNOHANG|WNOWAIT) or an exactly proven non-reaping
  equivalent. The leader remains unreaped through all TERM/KILL decisions; after the final
  allowed signal it is terminally reaped and only bounded non-destructive group-absence probes
  remain. Early leader exit with a lingering member, unsupported primitives and PID/PGID churn
  fail safely; no post-reap destructive group signal or unrelated-group signal is possible.
  Treat this P1-B as closed unless the last-round delta regresses the retained contract.
- The canonical PostgreSQL 17.10 pg_config/bindir/initdb/postgres binaries and every canonical
  ancestor accept only root or the exact captured effective UID and no world-writable path.
  Same-EUID-owned ancestor group writability is accepted only for the exact bound trusted admin
  group, all three exact decision-time snapshot digests and both counts, and exact initially
  observed manifest-bound mode. Root-owned group-writable, foreign-owner/group-writable and all
  other group-writable ancestors fail. The three canonical binaries are exact observed 0555 and
  never group/world writable. Every component has exact manifest-bound mode and ACL.
- The complete canonical chain and binaries bind stable descriptors plus path/device/inode/owner/
  group/mode/ACL/chain-manifest digest/binary digest/version/platform identity. Only canonical
  resolved binaries execute. Group substitution, member-set or group-record change, foreign
  group, binary group/world-write, world-writable path, ACL/mode change, symlink/swap or any
  binding mismatch fails before capability/task-root creation and immediately before every use.
  No account/group/membership/chmod/chown/Homebrew/system repair or mutation is permitted.
- pg_config/compiler/xcrun/SDK/sysroot/includes/linker inputs/initdb/postgres/Guard identities,
  digests, versions, modes, ownership, signatures and closed allow-listed environments are exact;
  inherited compiler/loader/PG/PQ/locale poisoning fails closed.
- Secrets/FDs close and buffers zeroize on every success/failure/timeout/signal path.
- Linux renameat2(RENAME_NOREPLACE) and macOS renameatx_np(RENAME_EXCL) are exact, unsupported
  platforms fail closed, descriptor/mount walks and pre/post identity checks preserve observable
  mismatches, and no atomic safety against malicious same-UID or exact-bound trusted-member
  namespace mutation is claimed.
- Verification includes PTY/process-group, hang/timeout/termination, environment poisoning,
  positive root/same-EUID PostgreSQL ownership and exact decision-time-admin/Cellar-0775
  acceptance; negative later-current rebinding, any of the three anchor/count mismatches, group
  substitution, member-set/group-record change, foreign group, binary group/world-write, world-
  write, exact-mode/ACL/symlink/swap/bound-identity cases; early-leader-exit/lingering-member,
  unsupported non-reaping primitive, PID/PGID reuse, rename no-replace and synchronized last-stat-
  before-unlink race tests whose expected behavior matches the selected threat model.
- Uncatchable SIGKILL residue, CI owner adapter, default/DA4 preservation, exact allowed files,
  Shared-Cluster BLOCKED/not-Evidence status, exclusions, R3 V0-V4 and the stop before hardware
  remain truthful.

Return exactly APPROVED or CHANGES REQUIRED. Report every finding as P0–P3 with file/line
evidence, impact and the smallest safe correction. APPROVED is allowed only with zero open
P0–P3 findings, resolved exact last-round placeholders, successful exact-head CI, consistent
Option A/group-snapshot wording and exact last-round Human authority. The Human selection and
last-round exception alone are not implementation authority.
```
