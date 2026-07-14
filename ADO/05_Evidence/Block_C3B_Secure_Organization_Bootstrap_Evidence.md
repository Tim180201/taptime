# Block C3B — Secure Organization Bootstrap Evidence

Status: Completed — Technical Lead, exact-head GitHub CI and independent security approved

Date: 2026-07-14

Implementation baseline: `f7d38558e9a1e6d5f7c2cfd1f4a1ec6eed3ebd44`

Authorization: `ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Authorization.md`

## 1. Scope and start gate

The authorized baseline was local `main` and `origin/main` at `f7d3855`. C3B adds only the private
operator bootstrap plane: migration `006`, isolated `@taptime/backend-bootstrap`, the exact
operator/executor/function-owner boundary, receipt/audit evidence, regression fixtures and a ninth
CI job. It exposes no HTTP route and adds no dependency from Mobile, the normal API, lifecycle,
read-model or identity production code to the bootstrap workspace.

No C3C–C3E behavior, Customer/Tag setup, Membership administration, Admin Web, cloud resource,
production credential/data or product Business Rule is included. The pre-existing untracked
`research/` directory was not read, changed or staged.

## 2. Delivered database boundary

Migration `006` requires PostgreSQL major 17, UTF8 and internal Unicode 15.1. It revokes database
`CREATE` and `TEMPORARY` from `PUBLIC`, normalizes two fixed non-login roles and fails if either role
already has a current-database or shared-object dependency. Ordinary cross-database ownership/ACL
absence cannot be proven from one database's catalogs and remains a dedicated-cluster/platform-IAM
deployment gate.

`taptime_bootstrap_executor` owns nothing and receives only schema USAGE plus EXECUTE on one
function. `taptime_bootstrap_function_owner` is non-assumable, owns only that SECURITY DEFINER
function, has exact SELECT/INSERT rights and uses fixed `search_path = pg_catalog`. `PUBLIC` cannot
execute it. An individual short-lived operator LOGIN must have exact role attributes, exact
non-admin executor membership and exact direct database CONNECT without broader ACL, ownership,
role-setting or TEMP capability. The function revalidates these properties and immutable
`session_user` attribution during every call.

One transaction validates canonical request/name/digest input, serializes request and identity
creation, safely creates or narrowly reuses User/IdentityBinding, inserts the first Organization
and Administrator Membership, appends exactly three attributed AuditEvents and inserts the
BootstrapReceipt last. Server-generated IDs, relational constraints, deterministic request/user/
identity advisory locks and rollback coverage preserve atomicity under retries and races. Existing
receipt ownership is checked before content comparison, so cross-operator replay is ID-free and
adds only its fixed safe rejection audit.

## 3. Delivered operator CLI boundary

The Node 24 CLI accepts only request ID, display name and a non-secret profile path. Exact JSON
keysets, canonical UUID/name validation, symlink-free same-handle bounded reads, ownership/mode
checks and stable metadata reject unsafe profile or CA substitution. Remote mode requires an exact
DNS host plus X.509 CA and `verify-full` TLS semantics; explicit numeric-loopback plaintext mode is
test-only. Ambient PostgreSQL settings, connection URLs and custom TLS callbacks are rejected.

The genuine issuer-bound B4 asymmetric verifier runs before database password input. The access
token and password are never accepted in argv, environment, profile, URL or output. Protected input
is a bounded exact two-line channel; terminal input is hidden and history-free, while stdin is
accepted only as an explicit non-TTY channel. Only verified issuer/subject cross the database
gateway. No B4 Membership resolver, email or client-supplied domain identifier participates.

The built `taptime-bootstrap` executable retains its shebang and executable mode. An isolated
binary-contract check runs it with no arguments and a minimal PATH-only environment, then proves
exact safe output and exit code.
Every CLI result is one bounded JSON line with fixed vocabulary; secrets and database/provider
errors are never printed.

## 4. Security and implementation-review dispositions

Pre-implementation findings and feasibility corrections are preserved in
`ADO/05_Evidence/Block_C3B_Independent_Architecture_Security_Review.md`. The complete candidate diff
then received independent security, code-quality and governance/CI review. All reported blocking
findings were corrected before publication; the final review records their exact chronology and
disposition. No open P0, P1, P2 or P3 remains in the candidate.

## 5. Local verification

All commands used Node `24.17.0`, npm `11.13.0` and local PostgreSQL `17.10` with UTF8, internal
Unicode `15.1` and synthetic credentials/data.

| Verification | Observed result |
|---|---|
| Fresh lockfile install | `npm ci` passed; 599 packages installed, 610 audited; existing 11 moderate dependency findings remain a pre-production maintenance gate |
| All workspace typechecks | Passed, including production and test sources |
| All workspace builds | Passed |
| C3B direct PostgreSQL/security tests | 188 passed in 4 files |
| C3B built executable contract | Passed: executable/shebang plus exact no-argument/minimal-environment rejection |
| B3 schema/RLS regression | 125 passed; clean and repeat ledger `001`–`006` |
| B4 identity regression | 55 passed |
| B5 read-model regression | 42 passed |
| B6 lifecycle regression | 88 passed |
| C1/C2 API regression | 139 passed |
| Core regression | 288 passed in 43 files |
| Mobile regression | 310 passed in 19 files |
| B1 PostgreSQL spike | 39 passed; 2 permitted Supavisor modes skipped |
| Synthetic Android/server harness | 6 passed |
| Android production export | Passed; Metro bundled 784 modules |
| Workflow and repository hygiene | CI YAML parsed; nine jobs; `git diff --check` passed |
| Migration immutability | `001`–`005` byte-for-byte unchanged from baseline |
| Independent leakage/isolation scan | No high-confidence secret, sensitive output sink, raw error disclosure or external product-code import of the bootstrap workspace |

Migration SHA-256 inventory:

| Migration | SHA-256 |
|---|---|
| `001_foundation.sql` | `82e749096e5031687a187caa6743f3c57ac7cff61ba3fb22a6a2c58b8a87ca5d` |
| `002_domain_and_lifecycle.sql` | `4549a0b56157fb7e775e83140c03dbe014bc4f33a156770ca26e27954e049b08` |
| `003_grants_and_rls.sql` | `8285127d87c207e0750844247ef8d5ca6d706fb6b53754a3eb21eab3cb5558dc` |
| `004_identity_membership_resolver.sql` | `c2dc0b6c1934fd8f3bb49e9b5a58a1b1a9cda938eed4872b077193fa160a2522` |
| `005_locked_identity_membership_resolver.sql` | `b3abfdd8648250f7360ae1bb9659d0cc0a147673b79ef8a5b8b2d37b476c0d47` |
| `006_secure_organization_bootstrap.sql` | `02c5ef3054fbb7fadeea71c0f627a66af9e96eeb30ce3b0bbaf6f0594b5a4660` |

## 6. Publication and exact-head CI

Implementation commit `e10fcaf8358261fff283d39eca1c79748122dcab` passed all nine jobs in GitHub
Actions run `29363513529`. The run's `headSha` exactly matches the implementation commit. It covers
Core/Mobile and Android export, B1, B3, B4, B5, B6, C1/C2, synthetic Android E2E and the new isolated
C3B PostgreSQL/security job. The C3B job also builds and genuinely executes the packaged CLI binary.

## 7. Remaining operational gates

- a provider-supported direct PostgreSQL 17 endpoint and dedicated-database/cluster role audit;
- platform-owned root-controlled profile and CA distribution, DNS/TLS/`pg_hba` policy and secret
  delivery;
- one-human/one-short-lived-principal IAM inventory, issuance, revocation and controlled-execution
  evidence;
- deployment compatibility approval for database-wide `PUBLIC CREATE/TEMPORARY` revocation;
- dependency maintenance, monitoring, retention/privacy, backup/recovery and production change
  controls.

These limits make C3B a production-shaped repository capability, not production-operational
deployment approval. C3C–C3E remain unauthorized and require a separate Human authorization.

Repository implementation status: **Completed — Technical Lead, exact-head nine-job GitHub CI and
independent security approved**.
