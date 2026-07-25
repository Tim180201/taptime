# Development Assignment 5 — V5 Isolated PostgreSQL Correction Authorization

- Status: **ADO-ONLY TECHNICAL CANDIDATE — INDEPENDENT REVIEW REQUIRED; NOT IMPLEMENTATION/HARDWARE AUTHORITY**
- Date: 2026-07-25
- Owner: Technical Lead
- Decision authority: Human Architect
- Exact source baseline commit: `a73173a0abe893c80f97b151262b18aa92b5bff5`
- Exact source baseline tree: `028e48247620c3d271f1dec04dbdcc83ab28c251`
- Carried baseline CI: `30169277329`, attempt 1, 12/12
- Candidate risk: AVS `R0` documentation only
- Proposed implementation risk: AVS `R3`

## 1. Authority and repository truth

This file is one ADO-only technical candidate. It changes no Product, schema, migration, runtime,
dependency, workflow, database, device or artifact state and grants no implementation or Human/
hardware authority.

The exact tracked baseline is the commit and tree above. The local Shared-Cluster follow-up in the
working tree is uncommitted, `BLOCKED` and explicitly **not Candidate Evidence**. Its passing
focused checks do not establish acceptance, closure or authority. An implementation must
selectively replace only that obsolete Shared-Cluster delta while preserving unrelated user
changes; reset, checkout, blanket restoration or treating the dirty worktree as a baseline is
forbidden.

This candidate requires focused publication and an independent read-only Exact-SHA review with
zero open P0–P3 findings before the standing rule in `AGENTS.md` may authorize the proposed R3
implementation. It stops immediately before USB, ADB, installation, device or Tag interaction.

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
executables from that one exact directory plus `server_version_num=170010` for every operational
run. A later PostgreSQL security-minor upgrade requires its own reviewed rebind.

### 3.1 Outer lifecycle owner

One opt-in operational launcher is the sole outer lifecycle owner. Before invoking the DA5 runner
it must:

1. bind an existing absolute PostgreSQL 17.10 `pg_config`, require an absolute canonical
   `pg_config --bindir` result, and resolve `initdb`, `pg_ctl` and `postgres` only inside that
   exact directory;
2. pin every regular-file identity, including canonical path, common bindir, device, inode,
   owner, executable mode, SHA-256 and PostgreSQL version 17.10;
3. reject a missing, replaced, writable-by-other, wrong-version or identity-changing binary;
4. never fall back to `PATH`, another PostgreSQL installation, a service manager or an existing
   server;
5. create one OS-random temporary root outside the repository with mode `0700`, then bind its
   canonical path, parent, device, inode and current-user ownership;
6. create private data, socket and log locations under that root without following symlinks and
   with no access for group or other users.

The launcher initializes exactly that data directory with bootstrap superuser
`taptime_da5_v5_installer`, host authentication `scram-sha-256`, local authentication `reject`,
password encryption `scram-sha-256`, numeric loopback `127.0.0.1`, a private Unix-socket
directory and exact TCP port `55435`. It prechecks that fixed resource once before startup.
Unavailable port, listener appearance during startup or any bind race fails the run; retry,
alternative port and fallback are forbidden. Port `5432`, `localhost`, wildcard, LAN and
externally supplied endpoints are forbidden for the operational DA5-V5 entry.

Plaintext bootstrap/runtime secrets, URLs and capabilities are generated and retained only in
process memory. The bootstrap plaintext reaches `initdb` only through anonymous FD 3 and
`--pwfile=/dev/fd/3`; runtime-role plaintext may reach the already bound server only as a
parameterized in-memory database-protocol value during DA5 preparation. No plaintext secret may
appear in argv, environment, repository, filesystem configuration, logs, status output,
exceptions or Evidence. PostgreSQL may persist only its standard SCRAM verifier inside the bound
`0700` transient data directory. Buffers are zeroized and descriptors closed on success and every
failure path.

### 3.2 Exact lifecycle binding

Before any runner capability is issued, the owner must bind one immutable lifecycle record:

- temporary-root, data-directory and socket-directory canonical paths plus device/inode/owner;
- canonical binary identities and digests;
- postmaster PID, OS process-start identity and executable identity;
- PostgreSQL `system_identifier`;
- server-reported `server_version_num=170010`;
- server-reported `data_directory`, numeric address `127.0.0.1` and port `55435`;
- exact `postmaster.pid` identity and private-socket identity;
- one random, single-use, process-local owner capability.

Every later start, attestation, runner composition, stop and deletion check must match this
record. PID equality alone is insufficient. Any mismatch, PID reuse, symlink substitution, path
escape, binary replacement, system-identifier change or listener ambiguity fails closed and may
not target the mismatching process or path.

### 3.3 Capability-only same-process runner composition

The outer lifecycle owner and existing DA5 runner must remain in one process. The owner composes
the migration/preparation layer with one non-exported, in-memory bootstrap-superuser capability
for `taptime_da5_v5_installer` and the exact database
`taptime_synthetic_android_e2e`. Migrations and DA5 preparation then create the existing
generated runtime roles. Installer-superuser access is confined to migrations, fixture
preparation, attestation and cleanup; Product services receive only their existing
least-privilege runtime capabilities.

No URL or credential is transferred through IPC, argv or environment. The operational DA5-V5
entry must reject operator-supplied URLs, command-line URLs, inherited database URLs, shared
endpoints, default ports and all URL handoff through environment variables. The DA5 runner may
not discover, select, start, stop or clean PostgreSQL. No layer may log or persist a URL,
password or capability.

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
- SIGINT, SIGTERM, SIGHUP where supported and uncaught failure must be deterministic, bounded and
  tested. Signal handlers may not target a process outside the exact lifecycle binding.
- The existing workflow-owned CI `docker run postgres:17.10` container remains the outer job
  owner and real integration boundary. Its current workflow-owned environment URL is allowed
  only inside a test-only container adapter that attests the isolated CI container and
  constructs the non-exported same-process capability. That environment URL is neither an
  operational DA5-V5 capability nor Human/hardware Evidence; the operational entry never
  accepts it.
- No CI workflow change is authorized unless implementation proves the existing job-owned
  boundary cannot exercise the contract and a separate finding and authorization approve the
  exact workflow delta.

## 6. Mandatory cleanup

Cleanup runs after success, failure, timeout, signal or partial startup:

1. stop new Product work and require Product HTTP listeners, Product resources and every
   least-privilege PostgreSQL client/pool to close first;
2. close the fixture/migration/attestation installer pool and prove no application connection
   remains;
3. use one exact short-lived outer-owner control connection to revalidate the complete lifecycle
   record, close it, prove zero database clients, then invoke only the pinned
   `pg_ctl -D <bound-data-directory> -m fast -w -t 30 stop` and only while postmaster PID,
   process-start identity, executable, `system_identifier`, data-directory and inode bindings
   still match;
4. prove the bound postmaster exited and was not replaced, the numeric loopback port has no
   listener, the private socket is gone and no runner/pool connection remains;
5. only after Step 4, revalidate the bound parent and root canonical path, device, inode, owner,
   mode and every path component without following symlinks; atomically rename that exact root
   under the same bound parent to a new OS-random, unguessable tombstone name;
6. revalidate the tombstone's device, inode, owner and mode against the former root, then
   recursively delete only that tombstone through a directory-bound walker that never follows a
   symlink; prove both original and tombstone paths absent.

The 30-second stop timeout is fixed. If `pg_ctl -m fast -w` cannot prove exit, or if process,
listener or socket state remains non-zero or ambiguous, the owner must not retry with another
stop mode, signal or kill and must not delete the root. A path, inode, ownership, symlink, rename
or listener ambiguity likewise preserves the root/tombstone for explicit safe diagnosis and
reports cleanup failure. Cleanup never broadens deletion or inspects, alters or removes another
PostgreSQL cluster, database, role, service, process or filesystem path.

If initialization or startup fails before a postmaster receives the complete lifecycle binding,
the owner must not invoke `pg_ctl` or signal a PID. It first proves that no process, listener or
socket is bound to the owned root/port, then may apply only the exact revalidate, atomic-tombstone
rename and directory-bound deletion procedure above.

## 7. Authorized implementation delta after approval

After focused publication and independent `APPROVED` review with zero open P0–P3, the standing
rule may authorize only:

- `apps/synthetic-android-e2e/src/database.ts`;
- new focused lifecycle-owner/capability modules below `apps/synthetic-android-e2e/src/`;
- `apps/synthetic-android-e2e/tests/SyntheticAndroidE2e.test.ts`;
- new focused tests below `apps/synthetic-android-e2e/tests/`;
- scripts only in `apps/synthetic-android-e2e/package.json`, with no dependency changes;
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
uncommitted WIP must be reconstructed as an exact reviewed delta from the source baseline, not
carried forward wholesale or represented as prior Evidence.

## 8. Explicit exclusions

This candidate does not authorize:

- Product rules, Business rules, migrations, schema semantics, NFC semantics or production code
  outside the synthetic operational boundary;
- any legacy adoption, quarantine, rename, repair or drop path;
- external dependencies, `package-lock.json`, root scripts or workflow changes;
- system installation, package-manager mutation or PostgreSQL service-manager changes;
- APK rebuild/change/signing, artifact replacement, installation, ADB, USB, device or Tag access;
- Human-/Hardware-V5, production, production data, deployment or distribution;
- access to or disclosure from `research/` or the repository-root `app.json`;
- commits, pushes or merges merely because this unreviewed candidate exists.

A required dependency, lockfile, workflow, Product, architecture or broader ADO change is a new
finding and requires separate exact authorization.

## 9. Adaptive Verification Standard

### Candidate now — R0/V0 only

- validate Markdown structure, exact baseline/status wording and internal paths;
- prove the tracked baseline commit/tree;
- prove the delta contains only this new file while reporting the pre-existing seven-file WIP
  separately and without reading protected content;
- review the authority, implementation stop and hardware/production exclusions.

### Proposed R3 implementation — V0–V4

- **V0:** authority, exact baseline, allowed-file diff, WIP separation and protected-path checks.
- **V1:** focused deterministic tests for binary/root/inode binding, in-memory capability
  non-export/secrecy, operator/shared/default-port rejection, exact fixed-resource rejection,
  catalog allow-lists and every cleanup guard.
- **V2:** real local transient PostgreSQL 17.10 tests covering exact version/port/database/role,
  successful V1/V2 startup, true SCRAM authentication, wrong secret, foreign/dirty endpoint
  rejection without mutation, lost-port and symlink/inode/PID/system-identifier races,
  runner/pool close ordering, partial-init failures and SIGINT/SIGTERM/failure cleanup. Require a
  fresh cluster per serial test case where isolation matters, no resource fallback, and prove
  zero owned process/listener/root residue.
- **V2 integration:** run migrations `001`–`013`, replay/ledger checks and the complete Synthetic
  suite through the capability-only runner boundary; verify the existing CI PostgreSQL 17.10
  container remains a real isolated outer-owner integration. Its test-only workflow URL must
  never reach the operational DA5-V5 entry or count as V5 Evidence.
- **V3:** complete repository test, tests-inclusive typecheck, build, security and migration
  matrix required by the current AVS, plus final protected-path and residue checks.
- **V4:** focused publication, exact-head CI with all required jobs green, then independent
  read-only Exact-SHA implementation review with zero open P0–P3.
- **V5:** not authorized; stop before USB, ADB, installation, device or Tag interaction.

Every confirmed R3 correction repeats affected V1/V2 and one final V3/V4 before re-review.

## 10. Approval and stop boundary

An independent approval of a focused publication of this candidate, bound to its exact commit,
tree and CI and containing zero open P0–P3 findings, may activate the `AGENTS.md` standing rule
for the exact R3 scope in Section 7. It does not authorize any omitted file or design choice.
Ambiguity returns to the Human Architect.

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
a73173a0abe893c80f97b151262b18aa92b5bff5 and tree
028e48247620c3d271f1dec04dbdcc83ab28c251, plus the exact focused candidate
publication commit/tree/CI supplied by the Technical Lead.

The pre-existing seven-file local Shared-Cluster WIP is uncommitted, BLOCKED and not Candidate
Evidence. Do not review it as an implementation candidate and do not modify any file. Do not
access research/ or the repository-root app.json.

Verify authority and baseline truth; outer-lifecycle-owner isolation; PostgreSQL 17.10
pg_config/exact-bindir and root/PID/system_identifier/data-directory/inode binding; exact
127.0.0.1:55435 SCRAM; fixed taptime_synthetic_android_e2e database and
taptime_da5_v5_installer bootstrap role; anonymous-FD initdb secret handling; mandatory
same-process capability composition; installer/Product least-privilege separation; exhaustive
fresh-cluster attestation; zero legacy adoption/mutation; failure/signal cleanup; race-safe
exact-root deletion; test-only CI postgres:17.10 outer-owner boundary; allowed files/exclusions;
R3 V0–V4; and the mandatory stop before hardware.

Return exactly APPROVED or CHANGES REQUIRED. Report every finding as P0–P3 with file/line
evidence, impact and the smallest safe correction. APPROVED is allowed only with zero open
P0–P3 findings and no missing implementation decision.
```
