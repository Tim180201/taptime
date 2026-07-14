# Block C3B — Secure Organization Bootstrap Closure

Status: Completed — Technical Lead, exact-head GitHub CI and independent security approved
Date: 2026-07-14
Owner: Technical Lead
Authorized baseline: `f7d38558e9a1e6d5f7c2cfd1f4a1ec6eed3ebd44`
Implementation commit: `e10fcaf8358261fff283d39eca1c79748122dcab`
GitHub Actions run: `29363513529` — nine of nine jobs passed
Production authority: Not granted
Next-slice authority: C3C–C3E remain unauthorized

## 1. Closed scope

C3B delivers one private operator-only first Organization/Administrator bootstrap plane. Additive
migration `006` supplies the receipt, operator attribution and exact hardened PostgreSQL capability;
isolated Node 24 workspace `@taptime/backend-bootstrap` supplies genuine B4 token verification,
protected secret/configuration handling and the executable CLI.

The slice exposes no HTTP route and is not imported by Mobile, API, lifecycle, identity or
read-model product code. It adds no normal Membership administration, Customer/Tag setup, Admin
Web, C3C–C3E behavior, cloud resource, production credential/data or Business Rule. The pre-existing
untracked `research/` directory was neither read nor included.

## 2. Closed security contracts

- PostgreSQL 17/UTF8/internal-Unicode-15.1 is mandatory; `taptime-name-v1` and the length-framed
  bootstrap digest have matching Node/SQL golden vectors.
- An out-of-band superuser migration revokes database `CREATE`/`TEMPORARY` from `PUBLIC`; the fixed
  executor owns nothing and may execute only one function, while the non-assumable function owner
  has only the exact SELECT/INSERT plus BYPASSRLS bridge required by that function.
- Every human operator uses an opaque short-lived `LOGIN NOINHERIT`; SQL and the CLI independently
  enforce exact flags, expiry, membership, database CONNECT and absence of direct ACL/TEMP drift.
- The remote profile/CA path is same-handle, bounded, symlink-free and metadata-stable. Remote mode
  requires a DNS hostname and verified CA/TLS target; numeric-loopback plaintext is test-only.
- Access token and password never enter argv, environment, profile, URL or output. Genuine B4
  verification precedes password input; only verified issuer/subject cross the gateway.
- One transaction serializes request, identity and User races; creates/reuses only the permitted
  identity state; appends exactly three first-run audits; inserts the receipt last; and rolls back at
  every tested write stage.
- Exact replay is idempotent; request conflict, unavailable identity and cross-operator replay follow
  the fixed precedence and disclose no stored result IDs. Cross-operator rejection records only the
  allowlisted safe audit.

## 3. Verification and review

Local verification passed the complete Node 24.17/PostgreSQL 17.10 matrix: C3B 188, B3 125, B4 55,
B5 42, B6 88, API 139, Core 288, Mobile 310, synthetic E2E 6 and B1 39 tests with its two permitted
Supavisor skips. Every workspace typecheck/build, the real built-CLI execution, Android production
export, clean lockfile install, migration ledger/immutability, YAML parse, leakage/isolation scan and
`git diff --check` passed.

Independent security, code-quality and governance tracks returned PASS after every recorded
C3B-PRE, C3B-IR and C3B-GOV finding was corrected and rechecked. Final open severity is zero P0,
zero P1, zero P2 and zero P3. No finding was waived.

Implementation commit `e10fcaf8358261fff283d39eca1c79748122dcab` then passed all nine jobs in
GitHub Actions run `29363513529`, including the isolated C3B PostgreSQL security job and real
execution of its built CLI binary.

## 4. Published evidence

- Authorization: `ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Authorization.md`
- Independent review: `ADO/05_Evidence/Block_C3B_Independent_Architecture_Security_Review.md`
- Implementation evidence: `ADO/05_Evidence/Block_C3B_Secure_Organization_Bootstrap_Evidence.md`
- Implementation commit: `e10fcaf8358261fff283d39eca1c79748122dcab`
- Exact-head CI: run `29363513529`, nine of nine jobs passed
- Migration inventory: `001`–`006`; `001`–`005` remain byte-for-byte unchanged

## 5. Remaining production gates

C3B is production-shaped repository implementation, not production-operational approval. A real
deployment still requires a provider-supported direct PostgreSQL 17 target, dedicated-database/
cluster cross-database role audit, platform-owned profile/CA and DNS/TLS/`pg_hba` policy,
one-human/one-short-lived-principal IAM inventory, issuance/revocation and controlled-execution
evidence, compatibility approval for the database-wide `PUBLIC CREATE/TEMPORARY` revocation,
monitoring, dependency maintenance, privacy/retention, backup/recovery and production change control.

No production personal data or production credential is authorized.

## 6. Next block

This closure authorizes nothing automatically. The recommended next slice is C3C's narrow
tenant-safe normal setup backend/API, but it requires a separate Human authorization on a new exact
baseline before any code change. C3D UI/capture and C3E Membership/reassignment remain separately
gated behind C3C and their own decisions.
