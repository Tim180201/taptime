# Block C3E1 Implementation Evidence

**Date:** 2026-07-15

**Status:** INITIAL IMPLEMENTATION PUBLISHED AND EXACT-HEAD CI GREEN, BUT FINAL REVIEW RETURNED
`CHANGES REQUIRED` — six-finding correction locally verified; independent delta re-review and
external exact-head CI confirmation remain mandatory before the Human Physical Gate

**Authorization baseline:** `70d163fa0473692f61555f1580f25382e1e807af`

**Authorization/governance checkpoint:** `1cad21d` (`docs: authorize C3E1 implementation`)

**Initial implementation:** commit `42b7c7a81d5a36bdce2842863f4cfdf637ea5e49`, tree
`22c47b6c8a36f22787dd50c86b89b03d8008a6a2`; exact-head GitHub Actions run `29414515751`, attempt 1,
passed all ten jobs

**Independent final-review disposition:** `CHANGES REQUIRED` with three P2 and three P3 findings;
no P0/P1. The correction described below is not an approval or closure claim.

## Delivered boundary

- Additive migration `008_employee_membership_enrollment.sql` adds immutable nullable legacy
  `Membership.display_name`, Organization-bound invitations, create/redemption receipts, forced
  RLS, append-only guards and six isolated NOLOGIN capability/owner roles. Runtime entry roles have
  no effective table privilege and can execute only the two invitation/projection entry points or
  the one redemption entry point assigned to them.
- Invitation creation uses 32 server-generated random bytes, the accepted domain-separated SHA-256
  digest, exact 43-character unpadded base64url disclosure, a 15-minute lifetime and a five-active-
  invitation Organization cap. Plaintext is never stored, audited, logged or replay-disclosed.
- Redemption verifies provider identity before the separate redemption pool, then atomically locks
  invitation, creator authority, the migration-006 issuer/subject namespace, Binding/User and every
  historical Membership. It creates at most one User, Binding and Employee Membership, consumes the
  invitation and writes receipt/audit provenance in one transaction.
- The normal backend runtime now requires six distinct database users. Three exact C3E1 routes add
  invitation creation, bounded Employee projection and pre-Membership redemption with strict JSON,
  canonical UUID/secret checks, `no-store`, safe allowlisted outcomes and no expected-Membership
  header on these body-narrowed operations.
- Admin Web adds bounded Employee projection plus deliberate one-time secret display. The secret is
  volatile and is cleared on expiry, dismissal, sign-in/out, session replacement, refresh, a new
  generation and every unavailable state. Generation tombstones prevent stale asynchronous
  pagination or command completions from restoring a dismissed disclosure. Every Employee page is
  independently checked for canonical safe names, strict UUID ordering, uniqueness, cursor
  continuity and exact full-page continuation before it can enter coordinator state.
- Android adds an explicit enrollment-intent sign-in path and authority-free `enrollment_only`
  shell. Normal sign-in 401 behavior remains unchanged. Provider tokens stay behind attempt-scoped
  readers; no Organization/User/Membership/role context exists until successful redemption is
  followed by the unchanged normal `/v1/session` resolution.
- The older synthetic C3D physical harness remains deliberately C3E1-disabled and fails its new
  routes closed; its source-aliased build nevertheless verifies the expanded API dependency graph.

## Adversarial and concurrency evidence

- Exact create/redeem replay, divergent command reuse, canonical unknown/expired secrets, decoded-
  byte digest, plaintext absence, Unicode normalization, exact lifetime, cap-at-five and expiry-
  freeing-cap behavior are covered against PostgreSQL 17.10.
- Current Administrator, Employee, stale/wrong Membership and historical same-/cross-Organization
  Membership paths are exercised without invitation or authority disclosure.
- Two distinct invitations for one provider identity serialize to one grant. C3B bootstrap and C3E1
  redemption for the same issuer/subject/User serialize on the shared migration-006 namespaces and
  produce exactly one Membership grant.
- A paused real redemption holds the existing Binding `FOR SHARE`; concurrent revocation blocks and
  commits only after the grant transaction. Creator revocation before first redemption produces
  zero partial state, while later revocation preserves the committed Employee and exact replay.
- PostgreSQL failure triggers after User insert, Binding insert, Membership insert, invitation
  update, redemption-receipt insert and grant-audit insert each prove complete rollback. A separate
  pre-commit interruption and a real PostgreSQL transaction-timeout regression prove rollback,
  error-aware client retirement and replacement-pool usability without partial state.
- Effective ACL catalog checks prove both runtime entry roles have no table privilege and no
  unexpected function execution. Migration contamination, cross-role `SET ROLE` and direct-table
  access fail closed.

## Local verification

Freshly reproduced after `npm ci` from the committed lockfile:

| Workspace / check | Result |
|---|---:|
| Administration contract | 3/3 |
| Core | 290/290 |
| Admin Web | 39/39 |
| Backend administration (C3C + C3E1) | 102/102 |
| Backend API | 190/190 |
| Backend B1 | 39 passed, 2 approved Supavisor-mode skips |
| Backend C3B bootstrap | 189/189 |
| Backend B4 identity | 55/55 |
| Backend B6 lifecycle | 88/88 |
| Backend B5 read model | 42/42 |
| Backend schema | 125/125 |
| Mobile | 356/356 in 23 files |
| Synthetic Android E2E harness | 9/9 |
| **Total** | **1,527 passed, 2 approved skips** |

Additional checks:

- every declared workspace TypeScript check passed;
- every declared production/package build passed, including the source-aliased synthetic harness;
- Admin Web production build passed with Vite 8.1.3;
- Android Expo export passed with 790 modules;
- migrations `001`–`008` applied/replayed and their ledger verified; `001`–`007` are unchanged;
- the built isolated C3B CLI verification passed;
- `npm ls --all` passed after the clean install;
- `npm audit --omit=dev --audit-level=high` reported no high/critical finding. The existing moderate
  Expo/config-plugin `uuid` advisory remains; the proposed forced Expo downgrade is breaking and is
  not a valid scoped C3E1 correction.

## Independent implementation review and correction

The initial implementation was published as `42b7c7a` and its exact-head ten-job CI passed. The
subsequent independent final review nevertheless returned `CHANGES REQUIRED`. The current
correction closes the six reported findings without expanding C3E1:

1. checked-out PostgreSQL clients now receive an error listener, active-connection checks and
   `release(error)` retirement; a real transaction-timeout regression proves rollback and pool
   recovery;
2. Admin Web invitation-disclosure generations are tombstoned so stale async completions cannot
   restore a dismissed secret;
3. Admin Web Employee projections fail closed on unsafe names, duplicates, non-monotonic IDs,
   cursor regression or invalid continuation shape;
4. JSON response parsing accepts only the exact `application/json` media type plus parameters, not
   prefix lookalikes such as `application/jsonp`;
5. the backend operation-timeout default is the normative ten seconds and the API regression binds
   the propagated deadline; and
6. this evidence and the current ADO status surfaces distinguish the already published initial
   commit/CI from the still-unapproved correction head and remove the earlier pool-cleanup and
   one-time-secret overclaims.

## Remaining gates and authority

This evidence claims neither correction approval nor Human validation. The next valid sequence is:

1. publish the focused correction after final diff/claim audit;
2. externally confirm green exact-head GitHub Actions for that correction SHA;
3. obtain independent delta architecture/security/code re-review of `42b7c7a...<correction-sha>`;
   and
4. only after both gates pass, separately start the fresh Human identity/device checklist.

C3E2, generic Membership CRUD/revocation/reassignment, provider-account creation, production
resources/data, deployment/distribution, Web/iOS NFC and broader Block-E work remain unauthorized.
