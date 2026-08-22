# Independent Architecture/Security Review — C3D Closure Sync and C3E1 Package

Date: 2026-07-15
Status: **CORRECTED DELTA RE-REVIEW APPROVED — zero open P0/P1/P2/P3; Human acceptance and C3E1 implementation authorization recorded**
Review Parent: `a0419866c2b992ae8fc5474144064bc0652d215a`
Review Commit: `4e3ae76f4fdfad751e31b546aa4b1a63e04a67ee`
Review Tree: `101eee3cb51ce43c3e2f4cf3debe937ffd5b29ef`
Exact-head CI: GitHub Actions `29408264969`, attempt 1, push to `main`, ten of ten jobs passed
Review mode: independent, read-only; no repository file changed
Owner of disposition: Technical Lead

## 1. Verdict and component disposition

The independent final verdict was `CHANGES REQUIRED`. There were no P0, P1 or P3 findings. Six P2
contract gaps blocked C3E1 Human acceptance.

The reviewer separately found both of these components acceptable without a finding:

- the C3D closure synchronization, including the four review-candidate EP-008 addenda; and
- the additive EP-009 C3D closure readiness delta and its unchanged maturity ratings.

C3E1 repository implementation remained unauthorized before, during and after this review.

## 2. Findings and accepted disposition

### C3E1-REV-01 — historical Membership policy

The original package rejected only an active Membership even though the real schema has permanent
Organization/User uniqueness plus only partial global active-User uniqueness. This silently left
re-onboarding/Organization transfer undecided.

Disposition: accepted. The corrected contract rejects any Membership row ever — active or revoked,
same or different Organization. Re-onboarding and Organization transfer are explicit non-goals and
receive adversarial tests.

### C3E1-REV-02 — pre-Membership Mobile state

The original package did not reconcile its enrollment shell with the executed C1 behavior where
`/v1/session` 401 clears tokens, SecureStore and local provider state.

Disposition: accepted. The corrected package preserves normal 401 behavior and permits an
authority-free shell only under an explicit volatile enrollment intent selected before provider
sign-in. It fixes refresh, 401/404/503, provider-event, generation, restart, sign-out and
post-redemption session transitions without constructing product context.

### C3E1-REV-03 — token and active-invitation bound

The original package left canonical token syntax and the numeric Organization cap open.

Disposition: accepted. The corrected contract fixes 32 random bytes, 43-character unpadded
base64url with canonical re-encoding/trailing-bit rejection, a domain-separated decoded-byte
SHA-256 digest, exactly 15 minutes and at most five active invitations per Organization. Active
state, expiry boundary, replay precedence and atomic Organization advisory-lock serialization are
explicit.

### C3E1-REV-04 — HTTP/result contract

The original result vocabulary lacked normative HTTP mapping, `unauthorized` completeness and exact
response shapes.

Disposition: accepted. The corrected package freezes every success/error HTTP code and JSON shape,
strict malformed-versus-canonical-unavailable behavior, processing precedence and `no-store` for all
responses including the one-time secret.

### C3E1-REV-05 — IdentityBinding/User race

The original transaction locked invitation/creator but only described Binding resolution. It did
not deterministically cover concurrent Binding revocation or two invitations redeemed by one
identity.

Disposition: accepted. The corrected package fixes first-redemption and exact-replay lock orders:
digest, invitation, creator Membership, migration-006-compatible issuer/subject and User advisory
namespaces, Binding/User row locks and all historical Membership rows. Required revocation,
secure-bootstrap and dual-invitation race tests prove at most one grant.

### C3E1-REV-06 — audit actor and trigger integration

The original package required `MembershipGranted` without choosing whether creator or redeemer was
the actor, while the real audit trigger recognizes only the broad Administrator and C3C setup roles.

Disposition: accepted. The corrected contract makes the creator Administrator the grant/audit
actor, records the redeeming IdentityBinding as invitation/receipt provenance and defines two new
least-privilege role/function-owner allowlists. Invitation creation produces one safe invitation
audit; redemption produces one creator-attributed `MembershipGranted`; retries/rejections/rollback
produce none.

## 3. Verification recorded by the independent review

The reviewer confirmed:

- Parent, commit and tree exactly as listed above;
- local `HEAD`, remote `main` and `origin/main` equal to the review commit;
- exact-head run `29408264969`, attempt 1, push to `main`, ten defined and ten successful jobs;
- fifteen modified plus three new ADO Markdown files and no code, SQL, package, workflow, dependency
  or test change;
- all extracted `ADO/*.md` references resolve and `git diff --check` passes; and
- tracked worktree/index were clean and no file was changed by the review.

## 4. Historical gate after the first review

The corrections above are Technical-Lead dispositions, not an independent approval. A renewed
read-only delta review must verify the correction commit and return no open P0–P3 finding. Only then
may the Human Architect consider accepting the corrected C3E1 product/policy contract. Even after
that acceptance, repository implementation requires a separate authorization bound to the then
current exact baseline.

## 5. Corrected delta re-review and Human disposition

Independent read-only re-review of commit
`70d163fa0473692f61555f1580f25382e1e807af`, tree
`33e5f7a94d49fadcab4f8f14b6fa842a55aad928`, against parent
`4e3ae76f4fdfad751e31b546aa4b1a63e04a67ee` returned **APPROVED** with no open P0, P1, P2 or P3
finding. It independently confirmed all six C3E1-REV-01 through -06 dispositions, all 143 ADO
references, the exact 18-file documentation-only delta and GitHub Actions run `29410078768`, attempt
1, with ten of ten successful jobs. The reviewer changed no repository file and explicitly permitted
Human-Architect consideration of the corrected package.

The Human Architect then explicitly accepted the C3D closure synchronization, EP-009 delta and all
Section-12 C3E1 product/policy decisions, followed by a separate instruction that C3E1 is released
and implementation shall begin. C3E1 repository implementation is therefore authorized on exact
baseline `70d163fa0473692f61555f1580f25382e1e807af`. This does not authorize C3E2, production
resources/data, deployment/distribution or the later Human Physical Gate. Independent final review
and exact-head CI remain mandatory before that gate.
