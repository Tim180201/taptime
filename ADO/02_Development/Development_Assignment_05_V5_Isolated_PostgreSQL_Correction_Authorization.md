# Development Assignment 5 — V5 Isolated PostgreSQL Correction Authorization

- Status: **CORRECTION CANDIDATE — INDEPENDENT EXACT-DELTA RE-REVIEW REQUIRED; NO IMPLEMENTATION/HARDWARE AUTHORITY**
- Date: 2026-07-26
- Owner: Technical Lead
- Decision authority: Human Architect
- Exact reviewed candidate publication commit: `72fbd3c20329dfbf3e8a1509025bd630b1bb130a`
- Exact reviewed candidate publication tree: `dda615edd2e91c6b4d50bf979386937a9f3d249f`
- Reviewed candidate CI: `30176432929`, attempt 2, 12/12
- CI attempt 1: Docker Hub timeout before checkout; no repository source was checked out or tested
- Independent candidate review: `CHANGES REQUIRED` — five P1, one P2 and one P3
- Current correction risk: AVS `R0` documentation only
- Proposed implementation risk after an independent approval: AVS `R3`

## 1. Authority and repository truth

This file is an ADO-only correction candidate against the exact reviewed publication above. It
changes no Product, schema, migration, runtime, dependency, workflow, database, device or artifact
state and grants no implementation or Human/hardware authority.

The local Shared-Cluster follow-up in the working tree is uncommitted, `BLOCKED` and explicitly
**not Candidate Evidence**. Its focused 180/180 Synthetic result and all earlier focused results
remain historical WIP observations only; they establish no acceptance, closure, current green
path or authority. A later implementation must selectively replace only that obsolete
Shared-Cluster delta while preserving unrelated user changes. Reset, checkout, blanket
restoration or treating the dirty worktree as a baseline is forbidden.

Publication `72fbd3c20329dfbf3e8a1509025bd630b1bb130a`, tree
`dda615edd2e91c6b4d50bf979386937a9f3d249f`, passed CI `30176432929`, attempt 2, 12/12. Attempt 1
timed out while pulling the Docker Hub image before checkout and therefore tested no repository
source. Independent review returned `CHANGES REQUIRED` for:

1. P1: the same-process implementation scope omitted the actual entry/composition/lifecycle files;
2. P1: partial-startup cleanup contradicted the stated process-control prohibition;
3. P1: configuration, HBA, auto-configuration and log objects were not lifecycle-bound;
4. P1: `pg_ctl` retained a PID-reuse signal race;
5. P1: recursive deletion could cross mounts and was not fully descriptor-relative;
6. P2: the CI exception lacked an exact outer-owner contract; and
7. P3: official status artifacts still presented Shared-Cluster WIP as the current green path.

This correction closes those design gaps only as an ADO-only correction candidate. It requires
an independent read-only Exact-Delta/Exact-SHA re-review with zero open P0–P3
findings before the standing rule in `AGENTS.md` may authorize the proposed R3 implementation.
No Human acceptance is claimed. The boundary stops immediately before USB, ADB, installation,
device or Tag interaction.

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
exact removal of the probe root.

This is `DISCOVERED`, not implementation, V1–V3 or Candidate Evidence. The implementation may not
turn that versioned path into a permanent Product promise. It must independently bind the
currently existing PostgreSQL 17.10 `pg_config`, require its absolute `--bindir`, and verify all
required executables from that one exact directory plus `server_version_num=170010` for every
operational run. `pg_ctl` is neither required nor permitted. A later PostgreSQL security-minor
upgrade requires its own reviewed rebind.

### 3.1 Outer lifecycle owner

One opt-in Node process is the sole outer lifecycle owner and the same-process DA5 runner
composition root. Before it creates any DA5 database capability it must:

1. bind an existing absolute PostgreSQL 17.10 `pg_config`, require an absolute canonical
   `pg_config --bindir` result, and resolve `initdb` and `postgres` only inside that exact
   directory;
2. pin every regular-file identity, including canonical path, common bindir, device, inode,
   owner, executable mode, SHA-256 and PostgreSQL version 17.10;
3. reject a missing, replaced, writable-by-other, wrong-version or identity-changing binary;
4. never fall back to `PATH`, another PostgreSQL installation, a service manager or an existing
   server;
5. create one OS-random temporary root outside the repository with mode `0700`, then bind its
   canonical path, parent, device, inode, platform mount identity and current-user ownership;
6. create private data, socket and log locations under that root without following symlinks and
   with no access for group or other users; and
7. compile and bind the native deletion helper in Section 3.5 before `initdb` and PostgreSQL
   startup, without installing a package or changing the system toolchain.

The launcher initializes exactly that data directory with bootstrap superuser
`taptime_da5_v5_installer`, host authentication `scram-sha-256`, local authentication `reject`,
password encryption `scram-sha-256`, numeric loopback `127.0.0.1`, a private Unix-socket
directory and exact TCP port `55435`. It prechecks that fixed resource once before startup.
Unavailable port, listener appearance during startup or any bind race fails the run; retry,
alternative port and fallback are forbidden. Port `5432`, `localhost`, wildcard, LAN and
externally supplied endpoints are forbidden for the operational DA5-V5 entry.

Plaintext PostgreSQL bootstrap/runtime secrets, URLs and capabilities are generated and retained
only in process memory. The bootstrap plaintext reaches `initdb` only through anonymous FD 3 and
`--pwfile=/dev/fd/3`; runtime-role plaintext may reach the already bound server only as a
parameterized in-memory database-protocol value during DA5 preparation. No plaintext PostgreSQL
secret may appear in argv, environment, repository, filesystem configuration, logs, status
output, exceptions or Evidence. PostgreSQL may persist only its standard SCRAM verifier inside
the bound `0700` transient data directory. Buffers are zeroized and descriptors closed on success
and every failure path.

### 3.2 Immutable provisional record and direct-child supervisor

Helper compilation and `initdb` are individually awaited no-shell children and must reach terminal
close before the next phase begins. After helper compilation the owner freezes a root/helper phase
record. After `initdb` and exact owner configuration, but before the PostgreSQL spawn, it creates
one immutable provisional owner/process-capability record. It contains:

- one OS-random, single-use, process-local owner capability and spawn generation;
- parent/root/data/socket/helper-directory identities and platform mount identities;
- the bound `pg_config`, `initdb`, `postgres`, compiler, helper source and helper binary identities
  and SHA-256 digests;
- the exact canonical path, device, inode, owner, mode and SHA-256 digest of
  `postgresql.conf`, `pg_hba.conf` and `postgresql.auto.conf`;
- the fixed `127.0.0.1:55435` endpoint, data/socket paths, exact no-shell `postgres` argv and
  allow-listed secret-free child environment; and
- the pre-created log object binding described below.

The provisional record is never rewritten. A later final lifecycle record references its digest
and adds post-spawn attestations; it does not retroactively mutate the provisional record.
Likewise, the earlier root/helper phase record remains immutable and is the only deletion basis
available if `initdb` fails before the complete provisional record exists.

Before spawn, the owner creates the exact log with
`O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW|O_CLOEXEC`, mode `0600`, verifies canonical path, device,
inode, owner and mode by `fstat`, and retains its own descriptor. It starts the pinned `postgres`
binary directly with `shell=false`, `detached=false`, no stdin and the same explicitly inherited
bound log descriptor for both stdout and stderr. The log descriptor remains open and
identity-bound in the owner until the direct child emits its terminal close after exit. No pipe,
shell, wrapper, daemonizer, service manager or `pg_ctl` may become process owner.

The resulting Node `ChildProcess`/OS process handle is bound exactly once to the provisional
capability on the successful `spawn` event and remains private to the owner. The DA5 runner,
database layer and operator commands receive no ChildProcess, PID or signal function. Process
control has only these states:

1. `not-spawned`: no child spawn was attempted or the spawn failed definitively before a child
   existed;
2. `live-unreaped-direct-child`: the exact direct-child handle is live and its terminal
   `exit`/`error` has not been observed;
3. `exit-observed/reaped`: terminal child state has been observed and awaited; and
4. `ambiguous`: spawn, handle, identity or terminal state cannot be proved.

Startup abort and normal PostgreSQL fast shutdown both use exactly one
`ChildProcess.kill('SIGINT')` call, synchronously from state
`live-unreaped-direct-child`, and only after the applicable provisional/final bindings revalidate.
PostgreSQL defines SIGINT as fast shutdown. There is no PID lookup, PID-only API,
`postmaster.pid` control, `pg_ctl`, retry, SIGTERM, SIGKILL or alternate shutdown mode. No await or
user callback may occur between the private live-state check and that one handle operation. If
the child has already exited or been reaped, no signal is sent. A signalled child has one fixed
30-second budget to reach terminal `exit` and `close`; failure or ambiguity preserves the root.

PID, OS start identity, executable identity and `postmaster.pid` remain mandatory attestations,
but never become control capabilities. Keeping signal authority on the unreaped direct-child
handle closes the reviewed PID-reuse race.

### 3.3 Final lifecycle and configuration binding

Before any migration/runner capability is issued, the owner binds one immutable final lifecycle
record containing:

- the complete provisional-record digest and owner capability;
- temporary-root, data-directory, socket-directory and log canonical paths plus
  device/inode/owner/mode and platform mount identity where applicable;
- canonical binary, compiler, source and helper identities and digests;
- canonical path, device, inode, owner, mode and content digest for `postgresql.conf`,
  `pg_hba.conf` and `postgresql.auto.conf`;
- the private log descriptor's device/inode/owner/mode identity;
- direct-child PID, OS process-start identity and executable identity;
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

- immediately before direct-child spawn and after readiness;
- before issuing the installer capability or running migrations;
- before creating generated runtime roles or least-privilege capabilities;
- before opening Auth/API/Product listeners;
- before every privileged attestation, fixture/preparation or cleanup transition;
- after every requested PostgreSQL reload/readiness transition;
- before any direct-child SIGINT; and
- before tombstone rename and deletion-helper execution.

Any configuration/HBA/auto-configuration/log, root, binary, process, postmaster, socket, listener,
system-identifier, mount or capability mismatch fails closed. A mismatching or ambiguous process
is not signalled, and a mismatching or ambiguous filesystem object is not renamed or deleted.
The root or tombstone remains for explicit safe diagnosis.

### 3.4 Capability-only same-process runner composition

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
`Da5V5OperatorLifecycle.ts` orders Product/pool closure before owner stop/deletion.

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

### 3.5 Locally compiled native POSIX deletion helper

The later R3 implementation adds exactly one small auditable source file at
`apps/synthetic-android-e2e/native/da5_v5_owned_tree.c`. Every operational run compiles it from
that source into a private location beneath the bound temporary root. It installs nothing and
adds no dependency.

Before compilation, the owner resolves one existing compiler to an absolute canonical regular
file and binds compiler path/device/inode/owner/executable mode/digest. It likewise binds the
helper source canonical path/device/inode/owner/mode/digest. Compilation uses a fixed no-shell
argv, fixed warning/error flags and no operator-provided flags. After compilation, the owner
binds the helper binary canonical path/device/inode/owner/executable mode/digest and revalidates
compiler, source and binary before helper execution. Any identity or digest change preserves the
root.

For deletion the owner opens the bound parent and exact root with
`O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC`, verifies both by `fstat`, and explicitly inherits
duplicate descriptors plus a length-delimited capability/manifest pipe into the helper. Paths,
capabilities and deletion targets are never accepted from helper argv or environment.

The helper must:

1. compare the parent/root descriptors with the immutable lifecycle manifest;
2. use `renameat` on the bound parent descriptor to atomically move only the exact root inode to
   one OS-random tombstone name under that same parent, then reopen it with
   `openat(..., O_DIRECTORY|O_NOFOLLOW)` and revalidate the same inode;
3. perform a complete no-follow preflight and a second convergent descriptor-relative walk before
   the first unlink, using only `openat`, `fstatat(..., AT_SYMLINK_NOFOLLOW)`, `fstat` and
   directory descriptors;
4. accept only regular files and directories, retain directory descriptors during the destructive
   phase, and require every descendant to match the root's `st_dev` **and** platform mount
   identity;
5. use Linux `statx(fd, "", AT_EMPTY_PATH|AT_NO_AUTOMOUNT, STATX_MNT_ID, ...)` or macOS
   `fstatfs(fd)` with the exact `(f_fsid, f_mntonname)` pair as mount identity; an unsupported
   platform, unavailable mount identity or inconsistent result fails before the first `unlinkat`;
6. reject every symlink, socket, device, FIFO, unexpected type, cross-device entry, nested mount,
   inode/type/name substitution or non-convergent enumeration;
7. remove only revalidated descendants bottom-up with `unlinkat` relative to retained directory
   descriptors, then remove the exact tombstone; and
8. return a bounded proof to the parent, which independently proves original and tombstone names
   absent.

A symlink, mount, unknown platform, injected inode swap or detected race causes zero recursive
unlink work and preserves the complete root/tombstone. Test-only synchronization/syscall hooks
may exist only in a separately compiled test build; the production helper must reject test
options. Production helper and test helper identities are distinct. Any failure after the
destructive phase begins for a non-identity I/O reason is reported truthfully as incomplete
cleanup, never broadened to another path, and the remaining tombstone is preserved. The running
POSIX helper may unlink its own bound binary only as part of the verified tombstone walk; no later
generic recursive remover is allowed.

## 4. Mandatory fresh-cluster attestation

The owner must complete both attestations below before migrations `001`–`013` or any other DA5
Product DDL runs.

### 4.1 Untouched-cluster attestation

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

### 4.2 Empty DA5 database attestation

Only after Section 4.1 passes may the owner explicitly create the fixed fresh database
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
lifecycle cleanup in Section 6.

## 5. Runtime and CI invariants

- The outer lifecycle owner retains cluster authority for the complete run. Only the
  migration/fixture/attestation/cleanup layer can use the installer capability; Product services
  hold only their existing least-privilege runtime capabilities.
- Migrations `001`–`013`, fixture preparation and the existing DA5 gate semantics run unchanged
  only after the fresh-cluster attestations pass.
- The owner treats runner failure, timeout, signal, pool-close failure and its own termination as
  mandatory cleanup paths. First error wins; cleanup errors are appended without hiding it.
- Outer-process SIGINT, SIGTERM and SIGHUP where supported, uncaught failure and unhandled
  rejection latch one cleanup. None is forwarded as SIGTERM/SIGHUP to PostgreSQL; the only
  permitted PostgreSQL shutdown signal remains the one direct-child SIGINT in Sections 3.2 and 6.
  A second outer signal never causes a second child signal or broader cleanup.
- The direct-child handle, installer capability, deletion capability and CI adapter capability
  are distinct, non-exported and non-serializable.
- No Product listener or safe-ready output may appear before final lifecycle/configuration
  attestation and least-privilege capability verification.
- Default and `da4-v5` profiles must remain unchanged and pass explicit source/behavior
  regressions in addition to the DA5 tests.

### 5.1 Exact CI test-only outer-owner contract

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

## 6. Mandatory cleanup

Cleanup runs once after success, failure, timeout, outer signal or partial startup. First error
wins; later cleanup failures are appended without replacing it:

1. latch failure/stop, reject new operator/Product work, close command and credential input, and
   require Product HTTP listeners, Product resources and every least-privilege client/pool to
   settle first;
2. close fixture/migration/attestation installer clients and prove no application connection
   remains;
3. when final readiness existed, use one exact short-lived owner capability to revalidate the
   complete lifecycle/configuration record, close that client and prove zero database clients;
4. prove every compiler/helper/`initdb` child reached terminal close, then apply exactly one of
   the partial-startup/direct-child cases below;
5. after proven terminal child `exit` and `close`, close the retained owner log descriptor and
   prove the bound process was not replaced, `postmaster.pid` and the private socket are absent,
   `127.0.0.1:55435` has no listener and no runner/pool connection remains; and
6. only then invoke the exact native helper procedure in Section 3.5 and independently prove
   original root and tombstone absent.

The process cases are mutually exclusive:

- **No spawn attempted:** no child signal is possible. Revalidate the available provisional
  filesystem record (root/helper phase record before completed `initdb`, complete provisional
  record afterward) and prove zero compiler/`initdb`/PostgreSQL process, listener and socket
  state. Helper deletion may proceed only if the helper reached its complete bound-binary state;
  an earlier compiler/helper failure preserves the root.
- **Definitive pre-child spawn failure:** only a spawn `error` that proves no child PID/handle ever
  existed enters this case. No signal is sent; after zero process/listener/socket proof, the
  already bound helper may delete the root.
- **Spawned live direct child, final record incomplete:** revalidate the complete provisional
  record, bound ChildProcess object, executable/PID/start identity as soon as observable,
  configurations and log descriptor. If all match, send the single direct-child SIGINT and wait
  at most 30 seconds for terminal `exit` and `close`.
- **Spawned live direct child, final record complete:** revalidate every provisional and final
  binding, send the same single direct-child SIGINT and wait at most 30 seconds.
- **Child exit/reap already observed:** send no signal. Await/confirm terminal close and continue
  only if process, log, listener, socket and filesystem proofs match.
- **Ambiguous or mismatching spawn/child/binding:** send no signal, perform no rename/deletion,
  preserve the root and report cleanup failure.

The 30-second budget starts with the one SIGINT call and is fixed. Timeout, failed/ambiguous
signal delivery, missing `exit`/`close`, remaining listener/socket/process state, PID/start/
executable mismatch, configuration/log/root mismatch or deletion-helper ambiguity permits no
retry, other signal, kill, PID lookup, `pg_ctl`, fallback port or generic removal. The root or
tombstone remains for explicit safe diagnosis.

An outer SIGINT/SIGTERM/SIGHUP during `initdb`, helper compilation, spawn, readiness, migrations
or Product startup enters this same state machine. A signal before PostgreSQL spawn can delete
only after every compiler/`initdb` child naturally settles and the no-child proof passes; it does
not start PostgreSQL or signal an arbitrary pre-PostgreSQL PID. Failure to prove that settlement
preserves the root. A signal after successful spawn may target only the matching live direct-child
handle. Uncatchable process termination such as SIGKILL cannot be represented as completed
cleanup and may leave only the task-owned root; no later run may adopt it.

Cleanup never inspects, alters or removes another PostgreSQL cluster, database, role, service,
process, container or filesystem path.

## 7. Authorized implementation delta after approval

After focused publication and independent `APPROVED` review with zero open P0–P3, the standing
rule may authorize only:

- `apps/synthetic-android-e2e/src/database.ts`;
- `apps/synthetic-android-e2e/src/da5V5Main.ts`;
- `apps/synthetic-android-e2e/src/SyntheticAndroidE2eEnvironment.ts`;
- `apps/synthetic-android-e2e/src/Da5V5OperatorLifecycle.ts`;
- new private modules:
  - `apps/synthetic-android-e2e/src/Da5V5PostgresLifecycle.ts`;
  - `apps/synthetic-android-e2e/src/Da5V5PostgresCapability.ts`;
  - `apps/synthetic-android-e2e/src/Da5V5OwnedTreeDeletion.ts`; and
  - `apps/synthetic-android-e2e/src/Da5V5CiPostgresAdapter.ts`;
- `apps/synthetic-android-e2e/tests/SyntheticAndroidE2e.test.ts`;
- `apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts`;
- new focused tests:
  - `apps/synthetic-android-e2e/tests/Da5V5PostgresLifecycle.test.ts`;
  - `apps/synthetic-android-e2e/tests/Da5V5PostgresCapability.test.ts`;
  - `apps/synthetic-android-e2e/tests/Da5V5OwnedTreeDeletion.test.ts`; and
  - `apps/synthetic-android-e2e/tests/Da5V5CiPostgresAdapter.test.ts`;
- `apps/synthetic-android-e2e/native/da5_v5_owned_tree.c`;
- `apps/synthetic-android-e2e/README.md`;
- script/build-entry changes only in `apps/synthetic-android-e2e/package.json`, with no
  dependency or version change;
- the minimal exact `synthetic-android-e2e` PostgreSQL owner/adapter/cleanup delta in
  `.github/workflows/ci.yml` defined by Section 5.1, with every other workflow byte
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

The default and `da4-v5` paths may receive no behavior change. Their current PostgreSQL URL-based
test/development composition is not converted into DA5 owner authority, and their complete
existing profile/isolation regressions are mandatory. No existing DA5 Product/gate semantics,
application-login-password behavior or Mobile/ADB logic may be redesigned in this correction.

## 8. Explicit exclusions

This candidate does not authorize:

- Product rules, Business rules, migrations, schema semantics, NFC semantics or production code
  outside the synthetic operational boundary;
- any legacy adoption, quarantine, rename, repair or drop path;
- external dependencies, `package-lock.json`, root scripts or workflow changes outside the exact
  Section 5.1 `synthetic-android-e2e` job delta;
- system installation, package-manager mutation or PostgreSQL service-manager changes;
- `pg_ctl`, PID lookup or any process signal other than the one bound direct-child SIGINT;
- APK rebuild/change/signing, artifact replacement, installation, ADB, USB, device or Tag access;
- Human-/Hardware-V5, production, production data, deployment or distribution;
- access to or disclosure from `research/` or the repository-root `app.json`;
- commits, pushes or merges merely because this unreviewed candidate exists.

A required dependency, lockfile, other workflow, Product, architecture or broader ADO change is a
new finding and requires separate exact authorization.

## 9. Adaptive Verification Standard

### Candidate now — R0/V0 only

- bind the starting commit/tree to `72fbd3c20329dfbf3e8a1509025bd630b1bb130a` /
  `dda615edd2e91c6b4d50bf979386937a9f3d249f`;
- validate Markdown structure, whitespace, exact status/CI/review wording and every internal path;
- prove the correction changes only this authorization plus
  `ADO/00_Core/Project_Status.md`,
  `ADO/02_Development/Development_Assignment_05_V5_Enablement_Authorization.md` and
  `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`;
- report all pre-existing Shared-Cluster WIP separately as `BLOCKED` and not Evidence;
- carry CI `30176432929`, attempt 2, 12/12 only as the reviewed publication result and preserve
  attempt 1's Docker Hub timeout-before-checkout truth; and
- review the authority, independent re-review requirement, implementation stop and
  hardware/production exclusions without reading protected content.

### Proposed R3 implementation — V0–V4

- **V0:** authority, exact baseline, allowed-file diff, WIP separation and protected-path checks.
- **V1:** focused deterministic tests for binary/compiler/source/helper/root/configuration/log
  binding; private capability non-export/secrecy; operator/shared/default-port rejection; exact
  fixed-resource rejection; catalog allow-lists; direct-child spawn/error/exit/reap states; exactly
  one SIGINT, exact 30-second timeout, no PID lookup/retry/SIGKILL; simulated PID reuse;
  application-login-password versus PostgreSQL-credential separation; and every cleanup guard.
- **V1 configuration/helper:** replace/reload/truncate `postgresql.conf`, `pg_hba.conf` and
  `postgresql.auto.conf`; log inode substitution; native-helper symlink, inode-swap,
  cross-device, same-device nested-mount, unknown-platform and synchronized race cases. Every
  pre-delete mismatch must prove zero unlink and retained root/tombstone.
- **V1 CI:** positive exact-owner adapter tests and negative CID/nonce/label/image/digest/start-
  identity/inner-outer-system-identifier/URL/port/role/database cases, plus exact-CID-only cleanup
  and residue failures.
- **V2:** real local transient PostgreSQL 17.10 tests covering exact version/port/database/role,
  direct-child startup/fast-stop, true SCRAM authentication, wrong secret, foreign/dirty endpoint
  rejection without mutation, lost-port and config/HBA/auto-config/log/process/system-identifier
  substitution, startup failure before/after spawn/readiness, already-exited child, 30-second
  timeout, runner/pool close ordering and outer SIGINT/SIGTERM/SIGHUP/failure cleanup. Run real
  native-helper success plus available cross-mount and race integration; deterministic fault tests
  remain mandatory where the host cannot create a mount. Require a fresh cluster per serial case
  where isolation matters, no resource fallback, and prove zero owned process/listener/root
  residue on every successful cleanup.
- **V2 integration:** run migrations `001`–`013`, replay/ledger checks and the complete Synthetic
  suite through the capability-only runner boundary; run the exact
  `postgres:17.10-alpine` CI-owner adapter contract and negative owner tests. Its step-local
  test-only URL must never reach the operational DA5-V5 entry or count as V5 Evidence.
- **V3:** complete repository test, tests-inclusive typecheck, build, security and migration
  matrix required by the current AVS; explicit default/DA4 unchanged-profile regression; final
  workflow, allowed-file, protected-path and process/listener/root/container residue checks.
- **V4:** focused publication, exact-head CI with all required jobs green, then independent
  read-only Exact-SHA implementation review with zero open P0–P3.
- **V5:** not authorized; stop before USB, ADB, installation, device or Tag interaction.

Every confirmed R3 correction repeats affected V1/V2 and one final V3/V4 before re-review.

## 10. Approval and stop boundary

The reviewed publication `72fbd3c20329dfbf3e8a1509025bd630b1bb130a` is `CHANGES REQUIRED` and
does not activate implementation. Only an independent `APPROVED` verdict with zero open P0–P3
against this focused correction publication, bound to its exact commit/tree/CI,
may activate the `AGENTS.md` standing rule for the exact R3 scope in Section 7. It does not
authorize any omitted file or design choice. Ambiguity returns to the Human Architect.

After implementation V0–V4 and independent Exact-SHA approval, the Technical Lead must stop and
report the exact hardware preflight still required. Hardware may begin only under a separate,
fresh, exact Human authorization. Production, production data, deployment and distribution
always require separate express authorization.

## 11. Copy-ready independent candidate review

```text
Act as the independent read-only TapTim.e Review Agent.

Review only:
ADO/02_Development/Development_Assignment_05_V5_Isolated_PostgreSQL_Correction_Authorization.md

Bind the review to source baseline commit
72fbd3c20329dfbf3e8a1509025bd630b1bb130a and tree
dda615edd2e91c6b4d50bf979386937a9f3d249f, reviewed-candidate CI
30176432929 attempt 2 (12/12; attempt 1 timed out at Docker Hub before checkout), plus the exact
focused correction publication commit/tree/CI supplied by the Technical Lead.

The pre-existing local Shared-Cluster WIP is uncommitted, BLOCKED and not Candidate Evidence. Its
180/180 Synthetic result is not the current path. Do not review it as an implementation candidate
and do not modify any file. Do not access research/ or the repository-root app.json.

Verify that the prior five P1, one P2 and one P3 findings are fully closed. Verify authority and
baseline truth; exact expanded file scope; outer-owner and DA5 runner same-process composition;
PostgreSQL 17.10 pg_config/exact-bindir; immutable provisional record; exclusive direct-child
handle and one SIGINT fast-stop without PID lookup/pg_ctl/retry/SIGKILL; contradiction-free
partial-startup cleanup; root/PID/start/executable/system_identifier/data-directory/inode binding;
postgresql.conf/pg_hba.conf/postgresql.auto.conf digest binding; O_EXCL/O_NOFOLLOW log-FD
inheritance; exact 127.0.0.1:55435 SCRAM; fixed taptime_synthetic_android_e2e database and
taptime_da5_v5_installer role; anonymous-FD initdb secret handling; application-login-password
separation; installer/Product least privilege; exhaustive fresh-cluster attestation; zero legacy
adoption/mutation; locally compiled bound native POSIX helper; device-plus-mount-identity and
FD-relative renameat/openat/fstatat/unlinkat deletion; exact test-only
postgres:17.10-alpine CI owner/nonce/CID/image/start/system_identifier contract and exact-CID
cleanup; default/DA4 preservation; allowed files/exclusions; R3 V0–V4; and the mandatory stop
before hardware.

Return exactly APPROVED or CHANGES REQUIRED. Report every finding as P0–P3 with file/line
evidence, impact and the smallest safe correction. APPROVED is allowed only with zero open
P0–P3 findings and no missing implementation decision.
```
