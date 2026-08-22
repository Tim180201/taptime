# Block C3B — Independent Architecture and Security Review

Status: Completed — Pre-implementation/final reviews and exact-head nine-job CI passed
Date: 2026-07-14
Reviewed Baseline: `f7d38558e9a1e6d5f7c2cfd1f4a1ec6eed3ebd44`
Review Type: Independent read-only pre-implementation and final architecture/security review
Owner: Technical Lead
Closure Authority: Technical Lead after independent final review, within the Human Architect's
explicit C3B authorization; this grants no production-deployment authority

## 1. Scope and independence

Three independent read-only review tracks inspected the accepted C3A contract, migrations
`001`–`005`, B4 verifier, existing CLI/runtime patterns, CI/governance and the proposed C3B role,
receipt, transaction and test boundary. The reviewers changed no file. The pre-existing untracked
`research/` directory was neither read nor modified.

This section records the pre-implementation verdict. Final source/diff/test/CI review will be added
after Technical-Lead verification; this artifact does not yet approve or close C3B.

## 2. Findings and disposition before implementation

| ID | Severity | Finding | Disposition |
|---|---:|---|---|
| C3B-PRE-01 | P1 | PostgreSQL 17's authoritative normalizer uses Unicode 15.1, not C3A's proposed Unicode 17; Node 24 uses Unicode 17. | Accepted. `taptime-name-v1` is corrected to Unicode 15.1 with a PostgreSQL-version/encoding/Unicode gate and pinned Node UCD-15.1 properties. Future upgrade is v2. |
| C3B-PRE-02 | P1 | A named operator holding the DB credential can call the capability directly with claimed issuer/subject, so the DB cannot prove that the CLI performed JWT verification. | Accepted and truthfully bounded. The named operator is an explicit privileged identity-attestation authority for this one operation. Individual expiry, least privilege and immutable attribution are the control; ordinary runtime roles remain unable to invoke. An independent signed-proof service is outside C3B. |
| C3B-PRE-03 | P2 | Result precedence and CLI exit behavior were incomplete for invalid input/token, role drift, revoked identity, conflict, races and cross-operator plus different content. | Accepted. Authorization Section 6 fixes one exhaustive outcome/precedence/exit contract. Operator mismatch precedes content comparison and is always ID-free. |
| C3B-PRE-04 | P2 | Shared-human use, production host/TLS enforcement and one-human identity cannot be proven solely from PostgreSQL role metadata or repository code. | Accepted. Closure may claim production-shaped repository implementation only. IAM inventory, secret delivery, `pg_hba`/endpoint/CA and execution evidence remain deployment gates. |
| C3B-PRE-05 | P2 | `BYPASSRLS` role creation and ownership require a real superuser installer; the existing generic schema/role wording was insufficient. | Accepted. Migration `006` is an out-of-band superuser operation, never app startup, and production platform support remains a gate. |
| C3B-PRE-06 | P2 | `SELECT ... FOR UPDATE` would require a broader owner privilege than the accepted exact SELECT/INSERT grant. | Accepted. The bootstrap plane uses deterministic transaction advisory locks and unique/foreign-key constraints; it does not grant UPDATE merely to lock. No ordinary identity-revocation writer exists in this slice. |
| C3B-PRE-07 | P2 | Migration `006` changes the repository-wide current ledger and every hard-coded `001`–`005` assertion/fixture/CI label must advance deliberately. | Accepted. Current runtime tests, migration verifier, fixtures, READMEs and all affected CI jobs must use `001`–`006`; historical evidence remains unchanged. |

No finding was waived.

## 3. Pre-implementation verdict

Verdict: **PASS TO IMPLEMENT C3B WITH THE AUTHORIZATION CORRECTIONS**.

Open severity after disposition: zero P0, zero P1, zero P2 and zero P3. This permits the
production-shaped repository implementation and its synthetic verification only. It does not prove
production IAM/infrastructure, approve C3C–C3E or close C3B.

## 4. Final-review gate

The final independent reviewer must inspect the complete implementation diff and reproduce at
minimum:

- exact migration checksum/ledger and `001`–`005` immutability;
- Unicode 15.1 Node/PostgreSQL equivalence and digest vector;
- operator/executor/owner ACL graph and direct-call trust wording;
- real B4 verification, no Membership resolver, protected secret/config/output behavior;
- all result precedence, exact audit/receipt and concurrency/rollback behavior;
- complete regressions and exact-head nine-job GitHub CI;
- truthful production-shaped/not-operational limitation and continued C3C–C3E gate.

Any open P0/P1/P2 blocks closure. Findings and corrections will be appended without erasing this
pre-implementation chronology.

## 5. Final implementation review scope and reproduction

Independent read-only security, code-quality and governance/CI tracks inspected the complete C3B
candidate worktree after Technical-Lead corrections. They changed no file and did not read or modify
the pre-existing untracked `research/` directory.

The final security track reproduced the C3B typecheck, all 188 tests in four files, workspace build,
real execution of the built CLI binary and `git diff --check`. The code-quality track independently
rechecked the CLI composition seams, protected secret input, secure file/TLS target handling,
`pg_shdepend` role proof and user-lock concurrency. The governance/CI track independently verified
the amended architecture chain, production/deployment limits, continued C3C–C3E gate and real
built-binary execution in the ninth CI job.

## 6. Final implementation findings and disposition

| ID | Severity | Finding | Final disposition |
|---|---:|---|---|
| C3B-IR-01 | P1 | Pre-existing bootstrap roles could retain foreign ownership or ACL dependencies. | Closed. Migration fails on current-database/shared dependencies; cross-database absence remains an explicit deployment gate. |
| C3B-IR-02 | P2 | Profile/CA access contained an `lstat`/`readFile` TOCTOU path. | Closed. `O_NOFOLLOW`, same-handle `fstat`, bounded read and stable-snapshot verification are enforced. |
| C3B-IR-03 | P2 | Profiles accepted unknown or secret-bearing fields. | Closed. Top-level and mode-specific keysets are exact and adversarially tested. |
| C3B-IR-04 | P2 | PostgreSQL did not independently enforce the opaque operator-name form. | Closed. SQL revalidates it and direct negative tests pass. |
| C3B-IR-05 | P2 | A 48-character operator suffix could exceed PostgreSQL's 63-byte identifier bound. | Closed. Node, SQL and documentation uniformly allow 12–36 lowercase ASCII characters. |
| C3B-IR-06 | P2 | `--secrets-stdin` could be used from an echoing TTY. | Closed. That mode rejects TTY stdin fail-closed. |
| C3B-IR-07 | P3 | An empty iterator chunk could be mistaken for EOF before hidden additional input. | Closed. Parsing continues to actual EOF and has a negative test. |
| C3B-IR-08 | P2 | Remote TLS tests did not reach the real hostname/CA policy. | Closed. A genuine positive CA/X.509 basis and complete host/CA negative matrix exercise the policy. |
| C3B-IR-09 | P2 | Contradictory or non-boolean `idempotent_retry` rows were accepted. | Closed. Result shape and boolean values are strict. |
| C3B-IR-10 | P2 | ACL, ownership, Membership and role-graph proof was incomplete. | Closed. Exhaustive `pg_shdepend`, role, database, RESET and owner-denial checks pass. |
| C3B-IR-11 | P2 | Programmatic callers could construct remote targets with `ssl: false` or a TLS callback override. | Closed. Discriminated targets, exact runtime revalidation and a safe immutable copy run before password access. |
| C3B-IR-12 | P3 | Malformed second-secret input mapped to infrastructure failure instead of `invalid_request`. | Closed. A dedicated invalid-request error and coordinator mapping preserve the public contract. |
| C3B-IR-13 | P2 | The real `runBootstrapCli` matrix did not prove exits 0–4, single-line output, leakage and password ordering. | Closed. A real composition matrix covers every contract. |
| C3B-IR-14 | P2 | The declared CLI binary lacked a shebang and was not genuinely executed in CI. | Closed. Build preserves the shebang/executable mode and the ninth job executes the isolated artifact. |
| C3B-IR-15 | P3 | TTY secrets could remain in Readline history. | Closed. Hidden input uses `historySize: 0`. |
| C3B-IR-16 | P3 | Concurrent active bindings for the same User could collapse to an infrastructure error. | Closed. A User advisory lock, recheck and deterministic concurrency test resolve the race. |
| C3B-IR-17 | P3 | Nil, invalid-version and invalid-variant UUIDs were not rejected in PostgreSQL. | Closed. Node and SQL both enforce the canonical UUID contract with direct tests. |
| C3B-IR-18 | P3 | `[::1]` was accepted but passed unusably to `node-postgres`. | Closed. Profile loading normalizes it to `::1`; bracketed programmatic IPv6 is rejected. |
| C3B-IR-19 | P2 | The SQL operator regular expression was collation-dependent. | Closed. It uses explicit `"C"` collation and a non-ASCII direct test. |
| C3B-IR-20 | P2 | Dedicated-database, cross-database and database-wide `PUBLIC CREATE/TEMPORARY` limits were under-documented. | Closed. Authorization, CLI README and production gates now state each boundary. |
| C3B-IR-21 | P3 | Invalid programmatic operator names were rejected only after password access. | Closed. The gateway validates them before password or client creation. |
| C3B-IR-22 | P3 | An oversized stdin chunk could be unnecessarily retained before per-line validation. | Closed. The total byte cap is checked before retain/concatenate. |
| C3B-IR-23 | P2 | Extra direct operator privileges could remain despite an otherwise valid role. | Closed. The operator requires exact direct CONNECT without grant option, no other current/shared dependency, no table ACL and no TEMP drift. |
| C3B-GOV-01 | P2 | Final C3B closure authority was ambiguous. | Closed. Independent review plus Technical-Lead closure is explicit and grants no production authority. |
| C3B-GOV-02 | P2 | AVR overstated the C3A verdict and invented an ADR version. | Closed. Exact review/acceptance chronology and correct versioning are recorded. |
| C3B-GOV-03 | P2 | The Unicode-15.1 amendment and TS version were not traceable enough. | Closed. TS-002 v1.2 and the C3B feasibility amendment are fully linked. |
| C3B-GOV-04 | P3 | Two governance artifacts retained stale current-truth statements. | Closed. C3A authorization and Project Status are synchronized. |

No finding was waived. Every finding above was corrected and independently re-reviewed.

## 7. Final verdict and publication gate

Final implementation-review verdict: **PASS**.

Open severity: zero P0, zero P1, zero P2 and zero P3. The approved implementation was published as
`e10fcaf8358261fff283d39eca1c79748122dcab` and passed all nine jobs in GitHub Actions run
`29363513529`. C3B may close as repository implementation. This review does not approve production
deployment or C3C–C3E.
