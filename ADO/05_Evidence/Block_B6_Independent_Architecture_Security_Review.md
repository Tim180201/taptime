# Block B6 Independent Architecture and Security Review

Status: Approved — Technical Lead Disposition Complete
Review Date: 2026-07-13
Reviewer: Independent Claude review supplied by the Human Architect
Reviewed Branch: `main`
Reviewed Base Commit: `3e83a52`
Implementation Commit: `9531672`
Approval Authorities: Independent Security Reviewer and Technical Lead

## 1. Scope and provenance

The independent reviewer verified a clean worktree at implementation commit `9531672`, exactly one
commit ahead of base `3e83a52`. The complete B6 diff, governing authorization, implementation plan,
evidence, migration `005`, coordinator, tests, relevant B3/B4/B5 boundaries, CI workflow and
unchanged Core `BusinessEngine` were inspected. No file was changed by the reviewer.

The review environment could not execute PostgreSQL, Docker or GitHub Actions. It independently
counted all then-existing 66 B6 cases and performed static adversarial analysis. Technical Lead
execution on PostgreSQL 17.10 and successful GitHub Actions run `29269282536` provide the runtime
evidence unavailable in that sandbox.

## 2. Independent verdict

Verdict: **APPROVED**.

No P0 or security-relevant P1 defect was found. The reviewer explicitly approved the migration,
authorization provenance, tenant isolation, genuine Core decision source, transactional
atomicity, concurrency controls, capability boundary and scope compliance. Block B6 may be closed
after disposition of one functional P1 observation and two P2 observations.

## 3. Confirmed security claims

The independent review confirmed that:

- both migration `005` functions are `SECURITY DEFINER`, fixed-search-path, revoked from `PUBLIC`
  and executable only by their exact resolver or lifecycle role;
- current IdentityBinding and Membership authority plus Assignment, Tag and Customer configuration
  are locked, tenant-bound and never selected by client claims or structurally supplied context;
- the existing concrete B4 JWT verifier and unchanged Core `BusinessEngine.evaluate()` remain the
  only identity-verification and lifecycle-decision implementations;
- the five Decision mappings contain no alternative Business Rule;
- canonical-hash and Receipt idempotency are disclosure-safe and preserve existing truth;
- advisory locks are transaction-scoped, active TimeEntries use `FOR UPDATE`, configuration and
  authority use `FOR SHARE`, and race tests exercise revocation/deactivation/deletion;
- test/evidence controls expose no Actor, Pool, PoolClient, query or role capability;
- transaction-local roles/GUCs and rollback behavior preserve pooled-connection hygiene;
- migrations `001`–`004` are byte-identical to the authorized baseline;
- no HTTP, cloud, Mobile, production-data or Block C scope entered the implementation.

## 4. Finding dispositions

### P1 — Retry of previously deferred evidence

Observation: an existing WorkEvent without CanonicalDecision remains deferred on every retry.

Disposition: **Accepted as authorized behavior, clarified and tested.** The observed temporal case
cannot become valid through passage of server time: WorkEvent `occurredAt` and
`Assignment.valid_from`, `Tag.created_at` and `Customer.activated_at` are fixed timestamps. B3
administrative triggers also permit active-to-inactive transitions only; they prohibit reactivation
of inactive Customers and Assignments. Automatically evaluating the same historical event later
would therefore invent the historical-configuration interpretation explicitly excluded by the B6
authorization. A dedicated 67th PostgreSQL/JWT case now proves that an identical retry remains one
WorkEvent plus one AuditEvent with no engine call, Decision, Receipt or TimeEntry.

### P2-1 — Stale Project Status counts

Observation: the Project Status header and Immediate Next Steps still said 63 although the reviewed
suite contained 66 cases.

Disposition: **Corrected.** Closure records the final 67-case matrix after adding the explicit
deferred-retry test.

### P2-2 — Tag lifecycle model gap

Observation: B3 has no Tag active/deactivated state; B6 treats locked Tag existence as the current
Tag fact.

Disposition: **Accepted remaining model boundary.** It was already disclosed in B6 evidence and is
not changed or hidden by closure. Any Tag revocation/history behavior requires a separately
authorized schema and product rule.

## 5. Closure recommendation

Close B6 after recording CI run `29269282536`, the final 67-test correction gate and the
dispositions above. The approval does not authorize Block C, historical reconciliation, Tag
lifecycle policy, production deployment or production personal data.
