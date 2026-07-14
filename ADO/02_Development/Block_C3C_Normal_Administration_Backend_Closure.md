# Block C3C — Normal Administration Backend/API Closure

Status: Completed — Technical Lead, exact-SHA independent reviews and exact-head ten-job GitHub CI
approved
Closure Date: 2026-07-15
Owner: Technical Lead
Authorized baseline and implementation parent: `c1148d57edb12312a102f090715c4b28308f6347`
Implementation commit: `b90729a0a4b325f523cd98ea5a741defb00155f6`
Implementation tree: `671be72784f68b9437a9f53e251acbbb22ce3e97`
GitHub Actions run: `29375259275` — exact `push` to `main`, exact implementation SHA, ten of ten
jobs passed
Production authority: Not granted
Next-slice authority: C3D and C3E remain separately unauthorized
Closure-publication state: This ADO-only publication has no commit or CI identifier yet; its real
commit and exact-head CI remain pending and must not be inferred from the implementation identifiers

## 1. Closed repository scope

C3C closes the repository implementation of the narrow tenant-safe normal setup backend/API that
was authorized on the exact baseline above. The closed slice contains:

- additive migration `007` and unchanged migrations `001`–`006`;
- required Customer and NFC Tag display names plus the neutral Unicode-15.1 name/digest contract;
- a fourth distinct least-privilege administration login/pool and the isolated
  `@taptime/backend-administration` coordinator;
- current server-derived Administrator authority with exact expected-Membership narrowing;
- atomic create-Customer and register-plus-first-assign Tag commands with success-only,
  resource-bound receipts and trigger-enforced audit provenance;
- a bounded safe setup projection and the exact three authenticated administration routes;
- raw canonical NFC payload confinement and safe stored fingerprint presentation; and
- the isolated tenth PostgreSQL-17/Node-24 GitHub CI job.

This closure is limited to repository implementation. It adds no Admin Web, Android Administrator
capture UI, Membership CRUD, invitation, role change, reassignment, delete/update, production
infrastructure, cloud resource, production credential/data or C3D/C3E behavior.

## 2. Closed authority and integrity contracts

- The setup login may assume only the identity-resolver and narrow setup roles; it never receives
  the broad Administrator, bootstrap, lifecycle, Membership-mutation or generic SQL authority.
- Current locked IdentityBinding/Membership/role and exact expected Membership are evaluated before
  receipt or resource visibility.
- Command IDs and canonical payloads are Organization-scoped, with deterministic exact/divergent
  replay and race handling and no raw PostgreSQL uniqueness error crossing the public boundary.
- Customer creation, Tag insertion and active-Customer locking use only the fixed capabilities
  required by the contract. The setup role has no raw-payload `SELECT` right.
- Success receipts bind Organization, actor, expected Membership, command type, digest, exact safe
  result resources and exact audits. Receipt integrity is trigger-enforced under minimal grants.
- Exact success replay survives later Customer deactivation or later deactivation of a provisioned
  Tag's Assignment and target Customer without creating new resources, receipts or audits.
- Every administration transaction carries bounded lock, statement and transaction deadlines;
  failure and timeout paths roll back and release or destroy the client safely.
- C3B compatibility is preserved through exactly one normalizer capability grant to its isolated
  function owner, with exact ACL/dependency regression proof.

## 3. Exact verification matrix

The final Node.js 24/PostgreSQL 17 local matrix passed 1,394 executed tests:

| Verification target | Result |
|---|---:|
| `@taptime/administration-contract` | 3 passed |
| `@taptime/core` | 290 passed |
| `@taptime/mobile` | 310 passed |
| B1 managed-Node PostgreSQL matrix | 39 passed; 2 external Supavisor modes skipped |
| `@taptime/backend-schema` | 125 passed |
| `@taptime/backend-identity` | 55 passed |
| `@taptime/backend-read-model` | 42 passed |
| `@taptime/backend-lifecycle` | 88 passed |
| `@taptime/backend-bootstrap` | 189 passed |
| `@taptime/backend-administration` | 75 passed |
| `@taptime/backend-api` | 172 passed |
| `@taptime/synthetic-android-e2e` | 6 passed |
| **Total executed tests** | **1,394 passed** |

The two B1 Supavisor modes remain an external pre-production validation gate and are not counted as
passes. All workspace typechecks and builds, Android export, clean package-graph validation with
`npm ls`, built C3B CLI `verify-bin`, migration apply/repeat/ledger verification, exactly-ten-job
workflow YAML validation and `git diff --check` passed.

## 4. Exact implementation, CI and independent approval

Implementation commit `b90729a0a4b325f523cd98ea5a741defb00155f6`, with parent
`c1148d57edb12312a102f090715c4b28308f6347` and tree
`671be72784f68b9437a9f53e251acbbb22ce3e97`, is the exact reviewed implementation.

GitHub Actions run `29375259275` is a completed successful `push` run on `main` whose `headSha` is
exactly that implementation commit. The workflow defines ten jobs and all ten completed
successfully, including the isolated C3C administration-security job, C3B compatibility job,
schema-security job and C2/C3C API/Mobile transport job.

Three independent read-only exact-SHA tracks completed after the implementation was published:

- database and security final review;
- governance and CI claim final review; and
- complete implementation-diff architecture/security/code/governance final review.

Every track returned **APPROVED** with zero open P0, P1, P2 and P3 findings. No finding was waived.

## 5. Migration identity

Migrations `001`–`006` are byte-identical to the authorized baseline. The exact implementation
SHA-256 inventory is:

| Migration | SHA-256 |
|---|---|
| `001_foundation.sql` | `82e749096e5031687a187caa6743f3c57ac7cff61ba3fb22a6a2c58b8a87ca5d` |
| `002_domain_and_lifecycle.sql` | `4549a0b56157fb7e775e83140c03dbe014bc4f33a156770ca26e27954e049b08` |
| `003_grants_and_rls.sql` | `8285127d87c207e0750844247ef8d5ca6d706fb6b53754a3eb21eab3cb5558dc` |
| `004_identity_membership_resolver.sql` | `c2dc0b6c1934fd8f3bb49e9b5a58a1b1a9cda938eed4872b077193fa160a2522` |
| `005_locked_identity_membership_resolver.sql` | `b3abfdd8648250f7360ae1bb9659d0cc0a147673b79ef8a5b8b2d37b476c0d47` |
| `006_secure_organization_bootstrap.sql` | `02c5ef3054fbb7fadeea71c0f627a66af9e96eeb30ce3b0bbaf6f0594b5a4660` |
| `007_normal_administration.sql` | `c64c22ac915f5bc29857a8fac1a316586af47d70e8eb34926b8ce6ad8063f595` |

## 6. Closure evidence

- Authorization:
  `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Authorization.md`
- Independent review:
  `ADO/05_Evidence/Block_C3C_Independent_Architecture_Security_Review.md`
- Implementation evidence:
  `ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md`
- Implementation commit: `b90729a0a4b325f523cd98ea5a741defb00155f6`
- Implementation tree: `671be72784f68b9437a9f53e251acbbb22ce3e97`
- Exact-head implementation CI: run `29375259275`, ten of ten jobs passed

## 7. Remaining gates

C3C is closed only as repository implementation. Production operation still requires real cloud and
database provisioning, supported pooling validation including the two external Supavisor modes,
secret/IAM/change control, monitoring, rate and abuse policy, dependency maintenance,
backup/recovery, retention/privacy/legal approval and production-data authorization.

C3D Admin Web and protected Android Administrator capture, C3E identity-first Employee Membership
setup and explicit reassignment, and DT-063–DT-066 remain open and separately unauthorized. This
closure authorizes none of them automatically and records no physical or human setup-flow proof.

## 8. Closure-publication checkpoint

This document and its synchronized ADO status changes are an uncommitted governance publication at
creation time. They do not reuse implementation commit `b90729a0a4b325f523cd98ea5a741defb00155f6`
or run `29375259275` as evidence for their own publication. A later real closure-publication commit
and its exact-head GitHub CI may be recorded only after they exist and pass.

`research/` remains outside this closure and this publication scope.
