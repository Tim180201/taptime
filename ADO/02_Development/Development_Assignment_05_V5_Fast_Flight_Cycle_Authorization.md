# Development Assignment 05 — V5 Fast Flight Cycle Authorization Candidate

Status: **HUMAN PROCESS-OPTIMIZATION DIRECTION RECEIVED / R0 CANDIDATE / REVIEW PENDING /
NOT ACTIVE / NO HARDWARE AUTHORITY**
Owner: Technical Lead
Approval Authority: Human Architect
Risk class of this candidate: R0 / V0 documentation only
Date: 2026-08-13

## 1. Boundary and binding

This candidate is bound to the clean tracked baseline:

- commit / `HEAD` / `main` / `origin/main`:
  `187ba562b6197e1c589b0b23f36cf3dfd662f32f`;
- tree: `174d2e80333c227338f788ac2dd85f0fbbcef972`.

The Human process-optimization direction is received, but this document is not active until the
review and publication sequence in section 8 completes. It grants no source change, test, build,
CI, ADB, device, hardware, Physical V5, retry, resume, relogin, deployment or distribution
authority.

The current terminal truth remains **`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2;
LATER CURRENT STATE CLEAN`**. Authority `E` remains consumed. This candidate neither reclassifies
that attempt nor supplies a replacement authorization. The current
[Project Status](../00_Core/Project_Status.md), evidence and immutable external receipts remain
controlling for that historical event.

## 2. Measured optimization case

The Technical-Lead-supplied optimization inventory records:

- nine DA5 ADO publications after `3a0469ac`, with 64 aggregate file touches and
  `+3330/-271` lines;
- publication `187ba562b6197e1c589b0b23f36cf3dfd662f32f`: eight files and `+918/-2` lines;
- the eight current DA5 publication surfaces — README, Project Status, Decision Log, Risk
  Register, Runbook, Lean Flight Card, V5 Evidence and Publication Closure — total exactly
  13,395 lines and 1,457,014 bytes (about 1.46 MB);
- at least 36.6% of the longer added-line corpus is made of normalized exact duplicates.

The target is therefore zero immediate repository paths for a routine qualifying abort instead
of eight, and one or two paths at terminal synchronization. Abort-to-next-authorization latency
targets minutes. The 89 manual submissions are expected to fall substantially; no unsupported
exact final count is claimed.

These metrics justify process optimization only. They are not Product, safety or verification
evidence.

## 3. Single-source Event Ledger

The future append-only event source is:

`ADO/05_Evidence/Development_Assignment_05_Event_Ledger.md`

Each claim is appended once and includes at least:

| Field | Required meaning |
|---|---|
| `binding_set_id` | Digest-bound Flight Package and applicable artifact/evidence set |
| `claim_id` | Stable unique claim identity |
| `supersedes_claim_ids` | Earlier claims corrected by this claim; never silent mutation |
| provenance | `Human`, `Machine` or `TL`, with the responsible source |
| time scope | `immediate`, `later` or `unproved` |
| observation | `observed` or `unobserved`, never inferred from absence |
| authority | Explicit before/after authority and consumption state |
| evidence | Algorithms, hashes and immutable receipt/artifact bindings |
| verification | AVS class/level, omissions and reason |
| terminal state | Terminal category, cleanup state and Product-finding state separately |

The Ledger does not copy narrative history. Git and immutable evidence retain history; a
correction appends a new claim and uses `supersedes_claim_ids`. README and Project Status contain
only a stable pointer, with Project Status changing only for material state. Decision Log, Risk
Register, Runbook, Flight Card, Evidence and Publication Closure retain only their own material
decision, risk, procedure, evidence or closure concern.

## 4. Routine clean non-Product abort fast lane

A routine qualifying abort first creates one immutable, disclosure-safe external terminal
receipt. It creates no immediate ADO commit and triggers no Product test, build, CI or full
semantic review. The receipt is valid only after cleanup completes and keeps attempted outcome,
cleanup outcome, accessibility restoration and authority transition as separate fields.

A `campaign` is at most three separately Human-authorized fresh runs on one unchanged
`binding_set_id` within at most 24 hours from its first event. It ends immediately at the first
`PASS`, first non-fast-lane result or cleanup risk, binding drift, Human stop, before release
or DA6, or the run/time limit — whichever occurs first.

During an active campaign, immutable external receipts are the operational source. The Ledger is
the published source after synchronization. Synchronization is required at campaign end, before
any binding change, release or DA6, and no later than 24 hours after the first event. A material
terminal change may also update Project Status; a nonmaterial event does not.

Every later run still requires a fresh, separate Human authorization. Without an intermediate
repository publication, that authorization may immediately cite the same exact-reviewed Flight
Package plus the new terminal receipt only when every fast-lane predicate in section 5 is
`MATCH`. Thus a next fast-lane run may precede synchronization only after receipt, predicate and
fresh separate Human authorization. It begins at fresh step one; no prior or Product observation
is reused, and there is no resume, retry or automatic restart.

## 5. Closed fast-lane predicate

The predicate is `MATCH` only when all of the following are proven:

1. Executable, procedure, closure, CI, final V3, APK, runtime, toolchain, device, tag,
   environment and security inputs are unchanged against the exact-reviewed binding set.
2. The category is either `human_order_deviation` under the mutation boundary below, or the
   separate pre-Product non-Product operator/environment category ending before Product mutation.
3. No Product, Security or Tenant assertion is `FAIL` or `AMBIGUOUS`; there is no Product,
   security or tenant finding, classification ambiguity or unknown state.
4. Required accessibility restoration is `MATCH`.
5. One atomic post-cleanup receipt matches the exact scoped binding and records cleanup
   independently from attempted outcome.

After any synthetic mutation, `human_order_deviation` qualifies only if every mutation was
exclusively task-owned and disposable synthetic scope, enumerated in the cleanup inventory bound
before start. No non-disposable, production, foreign or tenant resource may have been touched.
The atomic receipt must prove complete equality to the preflight baseline for every affected:

- Product assignment, setup-receipt, work-event, NFC, manual, time and queue record/state when
  its schema or explicit checkpoint made it observable;
- package, process, mapping, port, DB, role, task-root and session state; and
- standard profile state.

An unavailable record or field is explicitly `unobserved` and cannot support a claim. If it is
required by the affected scope, that alone disqualifies the fast lane. Any irreversible or
unenumerated mutation, residual non-null state, not-restored mismatch, or unobserved required
field also disqualifies it. No Product observation carries into a later run.

Any `FAIL`, `AMBIGUOUS`, missing evidence, changed input or unknown state yields `STOP` and the
normal publication/review/authorization path.

Stable immutable evidence is carried only by digest. Device state, environment, ports, mappings,
package/process/task state and credentials are volatile and are checked or captured fresh for
every run; their earlier observations never carry forward.

## 6. Documentation and review routing

The Ledger is evidence, not a duplicate Decision Log. The Decision Log changes only for an actual
architecture or authorization decision.

| Change | Repository publication | Required treatment |
|---|---|---|
| Routine nonmaterial qualifying event | None immediately; external receipt only | Predicate and terminal receipt |
| Campaign synchronization | Ledger; Project Status only if material | Batch precedence below |
| Purely non-Physical, non-authority, non-safety Ledger maintenance | Ledger | R0/V0, `[skip ci]`, TL check |
| Actual architecture/authorization decision | Decision Log; Ledger only for its evidence | Applicable AVS and review |
| Material risk change | Risk Register | Applicable AVS and review |
| Procedure change | Runbook and/or Flight Card | Applicable AVS and review |
| Policy change | ADR and/or AVS | Applicable AVS and review |
| Physical result, authority consumption/transition, safety/cleanup/terminal classification | Own evidence/closure concern plus Ledger | One independent semantic delta review |

Batch precedence is strict: if any entry contains a Physical result, authority consumption or
transition, or safety, cleanup or terminal classification, the batch receives one independent
semantic delta review even when the publication is R0/V0 and runs no Product CI. TL-only handling
applies solely to purely non-Physical, non-authority and non-safety Ledger maintenance.

After the reviewed semantic delta is published, an exact-binding attestation replaces a duplicate
full semantic review; it may not conceal a semantic change. R1–R3 AVS requirements remain
unchanged. The activated implementation receives one final V3 and one V4, not repeated
publication-driven copies.

## 7. Future R3 implementation authorization envelope

This exact allowlist is a future authorization candidate only:

- `ADO/01_Architecture/ADR/ADR-0019-lean-v5-verification-profile.md`
- `ADO/03_Testing/Adaptive_Verification_Standard.md`
- `ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`
- `ADO/04_Operations/Development_Assignment_05_V5_Lean_Hardware_Flight_Card.md`
- `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`
- `ADO/05_Evidence/Development_Assignment_05_V5_Lean_Hardware_Publication_Closure.md`
- `ADO/05_Evidence/Development_Assignment_05_Event_Ledger.md` (new)
- `apps/synthetic-android-e2e/package.json`
- `apps/synthetic-android-e2e/src/Da5V5FlightController.ts` (new)
- `apps/synthetic-android-e2e/src/Da5V5CleanStateAttestation.ts` (new)
- `apps/synthetic-android-e2e/src/da5V5FlightMain.ts` (new)
- `apps/synthetic-android-e2e/src/da5V5Main.ts`
- `apps/synthetic-android-e2e/src/Da5V5OperatorLifecycle.ts`
- `apps/synthetic-android-e2e/src/Da5V5SecretInput.ts`
- `apps/synthetic-android-e2e/tests/Da5V5FlightController.test.ts` (new)
- `apps/synthetic-android-e2e/tests/Da5V5CleanStateAttestation.test.ts` (new)
- `apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts`

Focused unchanged-neighbor verification remains
`apps/synthetic-android-e2e/tests/Da5V5CredentialTransfer.test.ts`,
`apps/synthetic-android-e2e/tests/Da5V5AdbController.test.ts` and
`apps/mobile/tests/runtime/da5V5AndroidDevice.test.ts`. These tests are verification inputs, not
change authority. If implementation needs any path outside the allowlist, it stops for an
explicit scope amendment.

The activated R3 design supplies a precompiled supervisor bound to a hashed plan. It runs machine
gates automatically to each Human prompt. The operator channel admits only `PASS`, `FAIL`,
`AMBIGUOUS`, the required queue number and `ABORT`; all else fails closed. Each prompt binds
`screen -> field -> button -> action -> do-not -> allowed answer`. Human prompts need no unsafe
short timeout; only machine operations have bounded timeouts. There is no mid-flight source or
Runbook lookup.

The supervisor owns secret input. Before creating the child, its parent captures the credential
exactly once. One dedicated anonymous pipe is mapped only to fixed child FD 3; the parent writes
exactly 64 lowercase hexadecimal bytes plus EOF, zeroizes every Buffer copy, and closes the write
end on success or error. The secret is never in environment, argv, files, clipboard or logs.

Before any DB, network, ADB or subprocess action, the child reads that exact frame with a bounded
timeout, rejects extra, missing or nonhex input, and immediately closes FD 3. An explicit `stdio`
allowlist prevents every descendant from inheriting FD 3. The unavoidable JavaScript string used
by the existing synthetic-environment constructor is transient, nonloggable and reference-cleared;
byte-zeroization is not claimed for it. Every master, transfer and framed Buffer copy is zeroized
on normal, failure, abort, signal, exception, timeout and child-exit paths. The master exists only
through the last credential gate/cleanup. If this cannot be met without an out-of-allowlist API
change, implementation `STOP`s for a scope amendment.

Every invocation uses a fresh nonce and has no persisted resume. The closed failure-reason enum
includes exactly `SIGNAL`, `IPC_EOF`, `UNEXPECTED_OUTPUT`, `NONCE_OR_ORDER_MISMATCH`,
`CHILD_NONZERO_OR_EARLY_EXIT`, `MACHINE_STEP_TIMEOUT_OR_HANG`,
`CLEANUP_OR_CHECKER_FAILURE` and `RECEIPT_SEAL_FAILURE`. Each path requests, then if needed
forces, bounded child termination; awaits Operator cleanup; and runs a fresh read-only clean-state
attestation. Existing `EMPTY_ACTIVE`/`VISIBLE`, device and profile gates remain.

No terminal receipt is emitted before child exit, cleanup and attestation. The atomic seal starts
as a task-owned `0600` draft outside the repository, validates schema and claims, fsyncs, and
atomically renames into a fresh evidence root; sealed files are `0444` and the root `0555`.
Attempted outcome and cleanup remain separate. Cleanup, checker or seal mismatch yields
`FAIL_CLOSED_WITH_CLEANUP_RISK`, never PASS or fast lane; a seal failure leaves no PASS/fast-lane
claim.

## 8. Activation and stop sequence

1. Complete an independent R0 review of this candidate.
2. Publish only this focused R0 delta with `[skip ci]`.
3. Perform exact-head review of the published candidate.
4. Only then execute the allowlisted R3 implementation with V1/V2 and one final V3.
5. Complete independent implementation review and focused publication.
6. Execute one V4, then exact runtime/artifact review.
7. `STOP` before every Human, hardware or Physical V5 gate for separate explicit authority.

This sequence never reopens consumed authority and never converts a receipt or binding
attestation into Human or hardware authorization.

## 9. V0 acceptance boundary

This R0 publication candidate changes exactly this new authorization file plus compact stable
pointers in `ADO/README.md` and `ADO/00_Core/Project_Status.md`. Acceptance requires exact-path
scope, clean Markdown diff, reference checks, confirmation of no executable delta, per-file
SHA-256 hashes, and byte counts plus SHA-256 for ordinary and full-index patches.

Product tests, builds, npm, CI, ADB and hardware are intentionally omitted because this candidate
contains no executable delta and grants no execution authority.
