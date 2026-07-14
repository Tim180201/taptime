# Block C3B — Secure Organization Bootstrap Authorization

Status: Authorized — Implementation and independent final review passed; exact-head CI pending
Authorization Date: 2026-07-14
Authorized Baseline: `f7d38558e9a1e6d5f7c2cfd1f4a1ec6eed3ebd44`
Human Architect Authorization: Explicit C3A acceptance and continuation under the delegated
professional direction ("Weiter gehts nach deiner Vorstellung chef")
Owner: Technical Lead
Architecture Authority: Accepted ADR-0011, FB-002 v1.2 and TS-002 v1.2
Roadmap Scope: C3B only; C3C–C3E remain unauthorized
Codex Effort: High

## 1. Authorized objective

Implement one private, operator-only, production-shaped repository capability that creates the first
Organization and its first Administrator in one idempotent, audited PostgreSQL transaction. The
slice consists of additive migration `006`, isolated `@taptime/backend-bootstrap`, the exact role and
receipt boundary, genuine issuer-bound B4 token verification and an adversarial PostgreSQL 17/Node
24 test/CI matrix.

No HTTP route, Mobile/Admin-Web capability, normal Membership administration, Customer/Tag setup,
cloud resource, production credential/data or C3C–C3E behavior is authorized.

## 2. Implementation-feasibility corrections accepted with this authorization

### Unicode contract

`taptime-name-v1` is pinned to Unicode **15.1**, not the C3A draft's Unicode 17.0. PostgreSQL 17.10
reports `unicode_version() = 15.1` and its built-in NFC normalizer is not backed by the separately
installed ICU-17 data. Pretending that PostgreSQL 17 is an authoritative Unicode-17 normalizer would
make accepted names and digests runtime-dependent.

Migration `006` therefore fails unless PostgreSQL major 17, UTF8 server encoding and internal
Unicode 15.1 are all present. Node uses pinned UCD-15.1 White_Space/category data and rejects
post-15.1 assignments before applying Node 24's newer NFC implementation. A future Unicode upgrade
is a separately versioned `taptime-name-v2` plus migration, never a silent v1 change.

### Operator trust boundary

The named bootstrap operator is an explicit privileged identity-attestation authority for this one
operation. The official CLI verifies the target's provider token and sends only verified exact
issuer/subject to PostgreSQL. Because the operator also owns the database credential capable of
invoking the function, PostgreSQL cannot cryptographically distinguish official-CLI use from a
direct call by that same authorized operator. The security boundary is individual short-lived
authority, least privilege, durable `session_user` attribution and review — not a false claim that
the database re-verifies JWTs.

An independently signed proof whose signing authority is unavailable to the operator would be a new
service/KMS trust plane and is outside C3B. Ordinary API, Mobile, Admin, lifecycle and identity
credentials still cannot reach the bootstrap capability.

### Operational proof boundary

The repository can enforce/test role shape, expiry, executor membership, protected CLI input,
hostname/TLS configuration and exact attribution. It cannot prove that two humans did not share a
credential or that production `pg_hba`, CA, DNS, IAM inventory and secret delivery are configured.
C3B may close as production-shaped repository implementation only. Production-operational status
requires separate infrastructure/IAM evidence.

## 3. Fixed authority and role graph

- Migration `006` runs only through an out-of-band PostgreSQL superuser installer against a
  dedicated TapTim.e target database and never during application startup. It revokes database
  `CREATE` and `TEMPORARY` from `PUBLIC` before provisioning the bootstrap boundary.
- Operations creates one opaque `LOGIN NOINHERIT` per human. It has no privileged role attribute,
  expires in at most 24 hours and has exactly database CONNECT plus a non-inheritable, settable,
  non-admin membership in `taptime_bootstrap_executor`.
- `taptime_bootstrap_executor` is `NOLOGIN NOINHERIT NOBYPASSRLS`, owns nothing and has only schema
  USAGE plus EXECUTE on one function.
- `taptime_bootstrap_function_owner` is `NOLOGIN NOINHERIT BYPASSRLS`, cannot be assumed, owns only
  the single SECURITY DEFINER function and has exact SELECT/INSERT rights on User, IdentityBinding,
  Organization, Membership, BootstrapReceipt and AuditEvent storage.
- The function fixes `search_path = pg_catalog`; all SQL object names are qualified and PUBLIC has
  no execution right.
- Both fixed bootstrap roles must have no pre-existing current-database/shared-object dependency;
  the migration fails rather than inheriting an ACL, ownership, policy, default ACL or role setting.
  Because ordinary PostgreSQL object catalogs are database-local while roles are cluster-wide,
  absence of ownership/ACLs in other databases remains a dedicated-cluster/platform-IAM gate.
- The CLI verifies exact `session_user`, executes literal `SET LOCAL ROLE
  taptime_bootstrap_executor`, then verifies that only `current_user` changed.
- The function rechecks operator role flags, exact membership options and expiry so an already-open
  session cannot outlive its authorization.

## 4. Inputs, secrets and identity

The command accepts only a canonical lowercase UUID request ID, Organization display name and access
token. The profile pins the exact issuer, direct database DNS host/port/name and CA; it contains no
secret. Remote mode requires a root-owned/symlink-free/non-writable profile and CA plus TLS hostname
and CA verification. Numeric loopback without TLS exists only as explicit test mode.

Access token and database password are read without echo or from an explicit bounded two-line stdin
channel. Neither is accepted in argv, environment variables, PostgreSQL ambient configuration,
connection URL, repository content or output. The password is requested only after successful B4
verification. No Supabase service-role key is accepted.

The concrete `SupabaseJwtAccessTokenVerifier` is used directly. No B4 Membership resolver participates.
Only exact verified issuer/subject enter the internal database gateway; email and client-selected
domain IDs are never linking authority.

## 5. Database transaction and immutable evidence

The function takes a versioned request advisory lock and, for new requests, a separate versioned
issuer/subject lock. It computes the authoritative length-framed SHA-256 digest, safely establishes
or reuses a User/IdentityBinding, creates the Organization and fixed Administrator Membership with
`created_by_user_id = NULL`, appends exactly three operator-attributed audits, inserts the receipt
last and returns only generated IDs.

An active exact IdentityBinding is reusable only when its User has no active or historical
Membership. Revoked binding, any Membership or concurrent provisioning fails closed. All IDs are
server-generated. The receipt contains request key/hash/version, operator and relationally bound
result IDs only — no token, issuer, subject, email or name.

First execution appends exactly:

1. `IdentityBindingEstablished` or `IdentityBindingReused`;
2. `OrganizationBootstrapped`;
3. `FirstAdministratorMembershipGranted` with only `{ "role": "administrator" }`.

All use `actor_user_id = NULL`, exact `session_user` as `operator_principal` and request UUID as
correlation. No test/failure parameter exists in production SQL; rollback tests use installer-owned
test triggers only.

## 6. Normative result and precedence contract

Official CLI precedence:

1. malformed/duplicate/secret-bearing args, unsafe profile/ambient configuration, malformed UUID or
   invalid name → `invalid_request`, exit 2, no database password request;
2. invalid/expired/wrong-issuer/wrong-signature token → `access_token_rejected`, exit 3, no database
   password request;
3. verifier/database infrastructure failure → `service_unavailable`, exit 1;
4. database policy rejection → one of the fixed reasons below, exit 4;
5. success/exact replay → `succeeded`, exit 0.

Database precedence after operator-role validation and request lock:

1. existing receipt owned by another operator → `operator_replay_forbidden` before name, digest or
   identity comparison; no IDs; commit exactly one safe `BootstrapReplayRejected` audit;
2. malformed direct database input → `invalid_request`;
3. same operator and exact canonical digest → original IDs with `idempotentRetry = true`, no writes;
4. same operator and different digest → `request_id_conflict`, no IDs/writes;
5. new request with revoked/conflicting/already-provisioned identity → `identity_unavailable`;
6. new valid identity → `succeeded`, `idempotentRetry = false`.

An invalid/drifted/expired operator is always `operator_not_authorized` before receipt disclosure.
Every rejection is ID-free. Unknown/contradictory database rows are infrastructure failures.

## 7. Mandatory verification

- clean and repeat migration ledger `001`–`006`; `001`–`005` byte-for-byte unchanged;
- PostgreSQL-17/UTF8/Unicode-15.1 and Node/SQL name/digest golden vectors;
- exact executor/owner/operator graph, ACLs, function ownership/search path, PUBLIC revoke, pre-role
  denial, RESET/expiry/drift denial and no normal-runtime reachability;
- real asymmetric B4 verifier, no Membership resolver, secret/argv/env/output/host/TLS negative
  matrix and one-shot connection cleanup;
- success, safe binding reuse, exact audits/receipt, exact replay, conflict, cross-operator rejection,
  revoked binding and active/historical Membership denial;
- same-request, same-identity and cross-operator concurrency;
- rollback after User, Binding, Organization, Membership, each of three audit events and receipt;
- token/issuer/subject/email/name/password leakage scan and all existing Core/Mobile/backend/synthetic
  regressions;
- isolated Node 24.17/PostgreSQL 17.10 GitHub CI job, raising the workflow to nine jobs;
- independent final architecture/security re-review with no open P0/P1/P2 before closure.

## 8. Stop conditions and remaining gates

Stop if implementation requires a public route, provider service-role key, shared product pool,
generic SQL/CRUD, operator-supplied domain IDs/role, Membership CRUD, production data, C3C setup
semantics or a broader function/table grant. C3C–C3E remain unauthorized even if C3B passes.

Production use remains blocked on a real direct PostgreSQL endpoint supporting the role model,
platform-owned profile/CA, server-side TLS/host policy, one-human/one-principal IAM inventory,
short-lived credential issuance/revocation, cross-database role-dependency audit/dedicated-cluster
evidence and controlled execution evidence. The database-wide `PUBLIC CREATE/TEMPORARY` revocation
must be included in deployment compatibility review.
