# Block B3 Independent Architecture and Security Review

Status: Approved — No Blocking Findings
Review Date: 2026-07-13
Reviewer: Independent Claude review supplied by the Human Architect
Reviewed Branch: `main`
Reviewed Commit: `9dd98d6`
Implementation Commit: `903917c`
Approval Authorities: Independent Security Reviewer and Technical Lead

## 1. Scope and Provenance

The independent reviewer confirmed that `9dd98d6` changes only four governance/status documents relative to `903917c`; no code or SQL changed. The implementation under review was therefore unambiguously `903917c`.

The review covered `AGENTS.md`, `ADO/README.md`, ADR-0008, the Block B architecture assessment, the B3 plan and evidence, all `apps/backend-schema` migrations/source/tests/configuration, the CI workflow, relevant Core TimeEntry/BusinessEngine/port contracts and B1 as comparison evidence.

The review environment could not independently run PostgreSQL or the 124 B3 tests. This limitation is compensated by Technical Lead execution on PostgreSQL 17.10 and successful GitHub Actions runs `29243934150` and `29244042186`, both including the isolated B3 PostgreSQL 17 job.

## 2. Independent Verdict

Verdict: **APPROVED**.

The reviewer found no blocking P0/P1 defect outside the explicitly documented later gates. Block B3 may be closed. This approval does not itself authorize B4; B4 remains a separate Technical Lead/Human Architect scope decision.

## 3. Confirmed Security Claims

The independent review confirmed from repository source that:

- all five CanonicalDecision result shapes are discriminated and constrained;
- reciprocal deferred TimeEntry/Decision foreign keys make Start and Stop relationships atomic and bidirectional;
- Start/Stop timestamps are bound exactly to the corresponding WorkEvent `occurred_at` instant;
- all four `SECURITY DEFINER` functions use a fixed trusted search path and have PUBLIC execution revoked;
- all twelve logical tables enable and force RLS;
- the revocation path preserves WorkEvent/Audit evidence without granting ordinary access or fabricating a Decision/Receipt/TimeEntry mutation;
- Organization/User/AssignmentTarget-qualified references, exact grants and runtime-role separation match the evidence claims.

## 4. Non-Blocking Findings and Dispositions

### P2-1 — B4 server Decision trust boundary

Observation: the database validates the shape of `escalation_required`, not whether the Core reason is factually true.

Disposition: **Accepted as mandatory B4/B6 acceptance gate.** Every CanonicalDecision must be derived exclusively from a genuine server-side `BusinessEngine.evaluate()` result. No client-supplied Decision type, reason, TimeEntry mapping, actor, role or Organization value may become authoritative.

### P2-2 — Optional synchronized Receipt TimeEntry mapping

Observation: `server_time_entry_id` remains nullable for a synchronized Start/Stop Decision.

Disposition: **Accepted, non-blocking for B3.** The row is incomplete but not false because the CanonicalDecision remains mandatory and authoritative. The typed ingestion/reconciliation contract in B6 must decide whether Start/Stop success requires the explicit server TimeEntry ID.

### P2-3 — Trigger-function direct execution tests

Observation: direct Runtime execution is tested explicitly for two of four trigger functions, while the SQL revokes PUBLIC execution for all four.

Disposition: **Accepted as defense-in-depth test hardening, not a B3 defect.** The common grant pattern and catalog evidence are sufficient for B3. A future security-regression slice may add explicit negative calls for `enforce_time_entry_stop_transition` and `enforce_administrator_update_shape`.

### P2-4 — Administrative audit fail-closed behavior

Observation: the administrative audit trigger returns without writing an AuditEvent when the effective role is not `taptime_administrator`.

Disposition: **Accepted as a B4/B5 production-boundary gate.** Current grants/RLS expose no exploitable Runtime mutation path. Productive administrative commands must select the exact restricted role and prove that every allowed mutation either writes its AuditEvent atomically or fails; no productive bypass/owner credential may be used for ordinary administration.

## 5. Confirmed Open Gates

Supavisor modes, production API/adapters, Supabase Auth/provisioning, privacy retention/deletion/backups, clock/offline/revocation product thresholds, retry terminality, NFC payload security, production data, monitoring, load and performance evidence remain explicitly open and are not reclassified as B3 defects.

## 6. Closure Recommendation

Close B3. Authorize B4 only as the narrow identity-binding and authoritative Membership-resolution server slice defined by the approved Block B sequence. Carry P2-1 as an explicit trust-boundary acceptance gate and keep B5/B6 behavior outside B4.
