# Block C3A — Independent Architecture and Security Review

Status: Validated by final independent re-review — Human Architect acceptance pending
Date: 2026-07-14
Reviewed Baseline: `220c55f72ffb0ba73c73c748af9701898529725a` plus the uncommitted C3A documentation diff
Review Type: Independent read-only architecture/security review
Owner: Technical Lead
Final Approval Authority: Human Architect

## 1. Scope

The reviewer inspected ADR-0011, FB-002 v1.2, TS-002 v1.1, the C3A authorization, proposed C3
implementation plan and their governance/status updates against the implemented Core, migrations
`001`–`005`, B4/B5/B6, C1/C2 and Android NFC boundaries. No product code, SQL, dependency, cloud
state or production data was changed. The pre-existing untracked `research/` directory was excluded
from review and modification.

## 2. Initial verdict

Initial verdict: **REJECTED — C3B blocked**.

Severity count: zero P0, three P1, six P2 and two P3. C3A's own rule treats every open P0/P1/P2 as
blocking. The Technical Lead accepted all findings; none was waived.

## 3. Findings and corrective disposition

| ID | Severity | Finding | Corrective disposition |
|---|---:|---|---|
| C3A-REV-01 | P1 | Optional expected-Membership narrowing could let a stale client write in a replacement Membership's Organization. | `expectedMembershipId` is mandatory for every command and projection, checked against the locked current Membership before receipts/resources; missing/malformed is `invalid_request`, mismatch is `forbidden`. |
| C3A-REV-02 | P1 | The NOLOGIN bootstrap executor did not identify the actual human database operator or persist truthful attribution. | ADR-0011 now fixes individual short-lived `LOGIN NOINHERIT` principals, database CONNECT plus executor membership only, explicit `SET LOCAL ROLE`, TLS/host/secret ownership rules, exact executor/function-owner grants, controlled BYPASSRLS, immutable `session_user` receipt/audit attribution and separately audited cross-operator replay denial. |
| C3A-REV-03 | P1 | Documents claimed approval/closure before the independent evidence existed. | All C3A/FB/TS/ADR/status entries remain Review Ready pending explicit Human Architect acceptance. Independent validation is recorded without being misrepresented as approval, and this evidence preserves the rejected first pass. |
| C3A-REV-04 | P2 | Normal command receipts lacked a tenant/actor/Membership/type/hash namespace and raw-payload exclusion. | Receipt key is `(organization_id, command_id)` and stores actor, expected Membership, command type, hash version, canonical digest, safe result and applicable result IDs only. Divergent authority/type/content is `command_id_conflict`; request bodies and raw payload never persist. |
| C3A-REV-05 | P2 | FB/ADR/TS public result vocabularies conflicted and did not map a verified identity without an active binding/Membership. | One normative table maps invalid identity/binding/no active Membership to `unauthorized`, Employee/stale Membership to `forbidden`, inaccessible target to `assignment_target_unavailable`, and removes PascalCase rejection events. |
| C3A-REV-06 | P2 | `tag_payload_already_registered` overlapped `assignment_conflict` in initial provisioning. | Fixed precedence is authority → exact receipt → divergent receipt → resources. A payload under another command is always `tag_payload_already_registered`; `assignment_conflict` is reserved for a later explicit assign/reassign capability. |
| C3A-REV-07 | P2 | Name normalization and idempotency hashing were not deterministic across Node/PostgreSQL. | `taptime-name-v1` pins Unicode 17.0, operation order, White_Space/categories, scalar/byte bounds and database authority. Hashing uses a versioned domain-separated, four-byte-length-prefixed UTF-8 tuple with shared Node/SQL golden vectors. |
| C3A-REV-08 | P2 | The Admin-Web/Android raw-payload handoff had no implementable pairing contract and overstated capture proof. | V1 uses no Web pairing. Android owns Customer selection, label, capture and direct submission; payload is ephemeral only inside a non-React coordinator. "Protected" means authenticated supported-client gating, not attestation or physical-origin proof. |
| C3A-REV-09 | P2 | C3D required an Employee scan although Employee provisioning is not authorized until C3E. | The C3D gate uses the bootstrap Administrator for product Start/Stop. Employee provisioning stays C3E; direct SQL seeding is not permitted. |
| C3A-REV-10 | P3 | C3D wanted Organization name but the safe projection did not provide it. | Added tenant-bound `AdminOrganizationSummary { id, name }` to the setup projection. |
| C3A-REV-11 | P3 | Several current-looking FB/TS statements still described old Draft/open/unchanged-shape reality. | Current In Scope, flows, edge cases, cross-blueprint references, Domain/responsibility tables and implementation order were reconciled; provenance remains only under explicitly Historical headings. |

## 4. Second-pass verdict

Second-pass verdict: **CHANGES REQUIRED — C3B remains blocked**.

Severity count: zero P0, zero P1, two P2 and three P3. The reviewer confirmed that the original
P0/P1/P2 findings were substantively closed and identified five remaining or newly exposed contract
gaps. The Technical Lead accepted and corrected all five; none was waived.

| ID | Severity | Finding | Corrective disposition |
|---|---:|---|---|
| C3A-REV-12 | P2 | The proposed `BootstrapReplayRejected` audit row could not satisfy the current required audit schema without inventing an unavailable Organization. | A rejected cross-operator replay now uses the receipt's existing `organization_id`, `entity_type = 'BootstrapRequest'`, `entity_id = request_id`, the request ID as correlation, the current operator principal and a safe reason-only payload. The typed rejection commits this audit row instead of raising and rolling it back. Generated result IDs remain absent from payload and output. |
| C3A-REV-13 | P2 | C3C could run under `taptime_admin_setup` without the current audit trigger accepting that role, and exact audit behavior lacked a mandatory test contract. | C3C must explicitly allowlist `taptime_admin_setup` in the audit trigger. `createCustomer` emits exactly `CustomerCreated`; `provisionNfcTag` emits exactly `NfcTagRegistered` and `NfcTagAssigned`. Actor, operator-principal, correlation, replay, rollback and raw-payload exclusion assertions are mandatory. |
| C3A-REV-14 | P3 | A few FB/TS passages still presented 2026-07-07 Draft-era statements as current truth. | Draft-era business/readiness material is now explicitly Historical, while implemented schema/repository facts and proposed C3 invariants are distinguished in current sections. |
| C3A-REV-15 | P3 | FB-002 used a generic resource-unavailable outcome that conflicted with the normative result table. | The flow now uses only the exact normative unauthorized/forbidden outcomes for authority failures and the exact target-result table for resource failures. |
| C3A-REV-16 | P3 | Two administrators could race on the same Organization/command ID before either receipt existed. | Every normal setup command now takes a transaction-scoped advisory lock over the versioned `(organization_id, command_id)` namespace after authority validation and before receipt lookup. A waiter rereads the receipt; a two-actor parallel test and unique-violation remapping are mandatory. |

### Pre-final governance consistency check

A separate read-only governance scan found one P2 and one P3 before the final re-review. Both were
accepted and corrected; neither was waived.

| ID | Severity | Finding | Corrective disposition |
|---|---:|---|---|
| C3A-GOV-01 | P2 | Project Status still presented the external CTO review's 2026-07-10 creation baseline as current after later Blocks had closed several findings. | The CTO state is now explicitly a Historical snapshot, followed by a dated current disposition. Core Roadmap v2 Section 2 is likewise labelled as its historical creation baseline. |
| C3A-GOV-02 | P3 | Canonical status, roadmap and traceability lists named C3B–C3D but omitted the separately defined C3E slice. | Project Status, Decision Log, FB/TS traceability, EP-007, C3A scope and both roadmaps now consistently identify C3B–C3E as separately gated and unauthorized. |

## 5. Final re-review verdict

Final verdict: **PASS — technically ready for the Human Architect decision**.

Remaining severity count: zero P0, zero P1, zero P2 and zero P3. The same independent reviewer
confirmed C3A-REV-01 through C3A-REV-16 and C3A-GOV-01/02 closed, including the schema-valid bootstrap
rejection audit, setup-role audit contract, cross-actor command lock, historical/current separation,
normative results and C3B–C3E governance gates. No finding was waived.

This passing technical review does not promote FB-002, TS-002 or ADR-0011 to Approved and does not
authorize C3B–C3E. That transition requires explicit Human Architect acceptance after the reviewed
commit is published, followed by a separate authorization for each implementation slice.

## 6. Current truth

C3A is a no-code architecture/security package. C3B, C3C, C3D, C3E and every product implementation
remain unauthorized. The repository still has no Organization bootstrap CLI, normal Admin setup API,
display-name migration, Admin Web or Android Administrator provisioning screen.
