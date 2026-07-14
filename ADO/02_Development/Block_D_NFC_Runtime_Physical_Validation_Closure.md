# Block D — NFC Runtime and Physical Validation Closure

Status: Completed — Technical Lead, GitHub CI, Independent Security Review and Human Physical Validation Approved

Date: 2026-07-14

Post-C2 baseline: `4f540ca648b9ef98c5ad4ccf3798e0279fc8bb6c`

Reviewed Block-D head: `ac5eeba116f6405e61ee26651eb9026799f2a712`

Authority: Human Architect; ADR-0009; Block-D runtime, validation-app and synthetic-E2E
authorizations

Scope: DT-053–DT-059 and DT-016's carried physical-device gate

## 1. Closure outcome

Block D is complete for its authorized Android-v1 scope. The actual physical NFC adapter now drives
the authenticated product path through the ADR-0009 canonical payload, private C2 transport,
authoritative B4 Membership resolution, B5 assignment resolution, B6 transaction boundary,
PostgreSQL RLS/audit and the unchanged Core `BusinessEngine`. Mobile presents the server result and
never decides Start or Stop.

Automated software, device-local NFC and strictly local server-connected physical product evidence
all passed. The independent final review returned `APPROVED WITH NON-BLOCKING FINDINGS`, with no P0,
P1 or P2 and one accepted/corrected documentation-only P3. No blocking finding remains.

## 2. Completed evidence chain

| Gate | Result | Evidence |
|---|---|---|
| Android NFC runtime and ADR-0009 codec | Passed | Commit `fac778d`; CI run `29319811973` |
| Device-local NFC stability and cleanup | Passed | Galaxy A33 5G / Android 15; two NTAG213; ten stable/distinct reads each; disabled, timeout, cancel, cleanup and duplicate cases |
| Validation fingerprint UX correction | Passed | Commit `56790c2`; CI run `29324366418`; EAS Android build 2 |
| Synthetic server-connected implementation | Passed | Commits `3fe76ed`, `b584568`, `d32702b`, `59c4ac7`; six Technical-Lead corrections |
| Synthetic automated harness | Passed | Five automated tests: three direct PostgreSQL integration cases and two non-database safety/source guards |
| Final implementation CI | Passed | Run `29333578360`, all eight jobs |
| Physical product E2E | Passed | Real login; Tag B unassigned; Tag A provisioned without lifecycle evidence; server-confirmed Start then Stop |
| Final physical database trace | Passed | 1 Tag, 1 Assignment, 4 AuditEvents, 2 WorkEvents, 2 Decisions, 2 Receipts, 1 stopped TimeEntry |
| Sensitive-disclosure check | Passed | No raw UID, token, database/provider error or real person data displayed |
| Normal shutdown and USB cleanup | Passed | `synthetic_e2e_stopped`; scoped reverse removal; empty final `adb reverse --list` |
| Governance evidence commit CI | Passed | Commit `ac5eeba`; run `29335248482`, all eight jobs |
| Independent final architecture/security review | Passed | `APPROVED WITH NON-BLOCKING FINDINGS`; no P0/P1/P2; D-FINAL-01 P3 accepted and corrected |

## 3. Independent finding disposition

D-FINAL-01 correctly observed that the synthetic test file has five total tests but only three
direct PostgreSQL integration cases; the other two are database-URL and source-authority guards.
Every affected current claim was corrected to state the exact composition. This is a closed,
non-blocking documentation correction and changes no code, test behavior or physical result.

## 4. Closed Development Task gates

- DT-053: Android UID payload strategy is approved in ADR-0009.
- DT-054: canonical normalization is shared and adversarially tested.
- DT-055: the actual `RnNfcScanAdapter.scan()` is the product port.
- DT-056: native capture is single-flight and duplicate-safe.
- DT-057: timeout, cancellation, cleanup and race handling are implemented and physically tested.
- DT-058 and DT-016's carried caveat: physical NFC and server-connected product behavior passed on
  the approved Galaxy A33/Android 15/two-NTAG213 set.
- DT-059: automated, CI, device, physical product, cleanup and independent review evidence is
  recorded and traceable.

## 5. Residual limitations

Closure is limited to the authorized Android-v1 Block-D scope and recorded device/tag set. It does
not establish broad Android fleet coverage, iOS/NDEF behavior, production Auth/cloud/deployment,
store distribution, production personal-data processing, durable offline synchronization or pilot
operations. UID cloning/emulation risk, volatile ambiguous evidence, two unverified Supavisor modes,
eleven moderate dependency findings and production/legal/operations gates remain separately
tracked.

## 6. Explicit non-authorization

This closure does not authorize C3 Administration, Block E synchronization/setup/export, cloud
resources, production credentials/data, a new Business Rule or the next candidate Development
Task. Only a separate Human Architect decision may open the next roadmap slice.

## 7. Final verdict

Block D: **COMPLETED** for the authorized scope.

Next responsible role: Human Architect to select and explicitly authorize the next roadmap slice;
Technical Lead then defines its narrow implementation plan and required Codex effort.
