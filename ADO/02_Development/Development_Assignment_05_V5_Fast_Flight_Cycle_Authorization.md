# Development Assignment 05 — V5 Fast Flight Cycle Authorization Candidate

## 2026-08-21 automatic memory-only password Fast-Recovery candidate — R3 round-2 corrected / round-3 review pending / Hardware STOP

The Human authorized this bounded Fast-Lane process correction on exact baseline
`2885739d9679c7be16ea518c640636bd2f3b6753`, tree
`1e437b7ebfa80aaa353a8ebbe8aa2f9e074d98dd`. It replaces only prospective manual Supervisor
password capture: after same-TTY ownership, the outcome-neutral pending envelope and the initial
quarantine drain, the Supervisor obtains exactly 32 bytes from Node CSPRNG once and nibble-encodes
them into one mutable 64-byte lowercase-hex ASCII `Buffer`. Entropy is immediately overwritten;
the password Buffer is overwritten on construction error, signal, transfer, Controller return or
throw, and final Supervisor closure. It is never a JavaScript password string and never enters
stdin, terminal output, clipboard, environment, argv, file, log, Evidence or AppleScript.

`FLIGHT_INPUT`, the hidden password prompt and `requestCredential` are removed. The Supervisor
retains the sole raw stdin owner with only `QUARANTINED`, `HUMAN_INPUT`, `ACK` and `CLOSED`; early
or unprompted bytes still fail closed. The existing plan, plan order, prompts, response tokens,
schema, fixed public Synthetic e-mails and Product behavior are unchanged. The Human still types
only the explicitly prompted e-mail and confirms the empty active password field. Machine
injection remains automatic. The next existing combined button/destination prompt is the only
post-injection prompt; no button is clicked automatically. Human report `Passwort nicht sichtbar`
maps to `FAIL` without clicking, and uncertainty maps to `AMBIGUOUS`; neither phrase becomes a
new protocol token.

FD3 now proves one exact 64-byte write followed by EOF under the existing 30-second machine bound.
Write/end throw or callback failure, pipe/child error or close, timeout, abort and late callbacks
settle once, overwrite the password, close/destroy FD3 and enter existing child-termination and
cleanup policy. Write success and end/finish success are intermediate only: transfer succeeds
exactly once after terminal FD3 `close` is observed with no preceding error. Deadline and abort
ownership remain active through that close. A late error after successful end therefore fails
closed, and child close before successful FD3 closure remains failure. One bounded pipe-error
owner remains until terminal FD3 close or its bounded failure release; late callbacks cannot
resettle and no listener/timer remains after release. The centralized abort mapping is preserved:
input-order maps to `NONCE_OR_ORDER_MISMATCH`, stdin EOF to `IPC_EOF`, and OS signal or unknown
reason conservatively to `SIGNAL`; timeout maps to `MACHINE_STEP_TIMEOUT_OR_HANG`, and pipe/child
failure to `CHILD_NONZERO_OR_EARLY_EXIT`. The Child's already-existing transient password string
boundary is unchanged and is not reclassified as zeroizable.

The preceding one-shot launcher request is consumed
`FAIL_CLOSED / START_VISIBILITY_OR_EXECUTION_UNOBSERVED / HUMAN_STOP / AUTHORITY_CONSUMED`.
Immutable root basename `flight-2885739d-start-visibility-unobserved-20260821` is `0555` with
receipt 2,460 bytes / `0444` / SHA-256
`40d39c9b15bb2b2612a96fccc7c5c4587f99fb8974ffc377e7f36fe5cb3dea5d` and manifest 318 bytes /
`0444` / SHA-256 `bb98592a702b450ffb307e0ea0e4d51aa09913f7d37a57913fbabdbb4dfff0e2`.
It proves only the reported accepted start request, no Human-visible window/prompt and the later
null state; actual launcher execution/exit, immediate cleanup, Supervisor/Controller/ADB/install,
Product and Hardware are unobserved. No retry or resume exists.

Formal round 1 returned `CHANGES REQUIRED`, P0/P1/P2/P3 `0/1/1/0`, solely for the paired FD3
callback-error lifecycle and the overbroad transfer-abort mapping. Formal round 2 then returned
`CHANGES REQUIRED`, P0/P1/P2/P3 `0/1/0/0`, because successful end callback still released the
error owner before terminal FD3 close. This same ten-path R3 candidate contains all bounded
corrections and now requires independent round-3 review. It grants no current launcher, TTY, ADB,
install, Product-Human or Hardware authority. After approval/publication, new exact artifacts and
binding Evidence must be prepared, followed by **STOP for one fresh Human Hardware authorization**.

## 2026-08-14 invitation-secret source/transfer scope amendment — top candidate

Status: **B36 R3 PREFLIGHT STOP / R0-V0 SCOPE-AMENDMENT CANDIDATE / REVIEW PENDING / NOT
ACTIVE / NO HARDWARE AUTHORITY**. Exact clean preparation baseline is `HEAD == main ==
origin/main == b36d2795afd9d0a6bd8e597203ae05c2c8a8aeb6`, tree
`eb4e1e1872f017ec377fb48a7fb31b5a67bbb5e0`. The activated b36 R3 cycle performed only its
mandatory read-only invitation-source preflight. Repository truth exposed no bound DA5 invitation
source, seed or Operator transfer procedure, so it stopped before every executable/test edit,
test, build and run. This candidate supersedes only conflicting prospective invitation and R3
scope wording below; it does not authorize execution until the activation sequence at the end of
this addendum completes.

Exactly one task-owned invitation is created after the successful Administrator result and before
Enrollment. The child uses only the already-running loopback Synthetic services: first `POST
/auth/v1/token?grant_type=password` with fixed public e-mail
`administrator-e2e@example.invalid`, fixed public key
`sb_publishable_taptime_synthetic_android_e2e` and the existing memory-only password master; then
`POST /v1/administration/employee-invitations` with the returned Administrator bearer token,
`expectedMembershipId = 12000000-0000-4000-8000-000000000702`, one fresh random canonical UUID
as `commandId`, and fixed `displayName = "DA5 V5 Synthetic Employee"`. Both origins must be the
exact environment-provided `http://127.0.0.1:<bound-port>` origins. Redirect, non-loopback,
unexpected origin/port, non-200, missing exact `Cache-Control: no-store`, timeout or ambiguous
response fails closed.

The Auth response must exactly match the local Synthetic password-session contract and bind the
Administrator identity. The invitation response must have exactly `status`, `invitationSecret`
and `expiresAt`; `status` is `succeeded`, expiry is canonical and strictly future, and the secret
is exactly 43 canonical unpadded base64url characters decoding to exactly 32 bytes with canonical
pad bits. Immediately before creation the enrollment counters must prove zero active/consumed
task invitations and zero invitation/redemption receipts. Immediately after the sole creation
they must prove exactly one active invitation, zero consumed, exactly one creation receipt and
zero redemption receipts. Any drift, second invocation or idempotent/ambiguous outcome is `STOP`.

A new one-shot invitation-secret owner is completely separate from the password owner and accepts
only the canonical 32-byte/43-character invitation. It owns the parsed secret Buffer, direct
non-PTY ADB stdin frame and every candidate copy; each Operator-owned Buffer/frame is overwritten
on success, rejection, abort, exception and cleanup. It is consumed exactly once and cannot be
reset or reused. The 64-lowercase-hex password master is rejected by the invitation owner before
any ADB call. The invitation never enters clipboard, environment, argv, file, log, terminal,
Evidence, artifact manifest or IPC; only the password keeps the existing supervisor-to-child FD3
frame. The local Auth access token and JSON invitation secret necessarily exist briefly as
JavaScript strings while strict JSON/HTTP contracts are parsed or an Authorization header is
formed. Those strings are nonloggable, never persisted or copied into evidence, their references
are dropped immediately, and byte-zeroization is explicitly not claimed; owned Buffer copies are
still zeroized.

The exact Human/machine order is:

1. Administrator combined result `PASS` on its expected destination.
2. Machine authenticates locally, creates exactly one invitation and proves the post-create
   counters.
3. Human enters `employee-enrollment-e2e@example.invalid`, activates `Passwort`, answers retained
   `EMPTY_ACTIVE`; machine injects the password; the next result action presses `Mit Einladung
   beitreten` and accepts `PASS` only on `Als Beschäftigter beitreten`.
4. Human activates `Einladungsgeheimnis` and answers a separate retained `EMPTY_ACTIVE`; machine
   injects the one-shot invitation secret directly without a standalone `VISIBLE` answer.
5. The existing `employee-install-transition` Human action presses the redemption button, accepts
   `PASS` only after `Bereit zum Scannen`, signs out once and confirms the `TapTim.e — Anmeldung`
   surface. Machine then proves exactly one consumed invitation, zero active, one creation receipt,
   one redemption receipt and the exact single enrollment deltas before the existing Employee
   installation transition proceeds.

Every wrong surface, empty/not-filled-looking field, rejected action, counter mismatch, `FAIL`,
`AMBIGUOUS` or `ABORT` fails closed. There is no automatic button tap and no positive standalone
`VISIBLE` step.

The b36 seven-path executable/test allowlist remains exact and is extended by only:

- `apps/synthetic-android-e2e/src/Da5V5InvitationSecret.ts` (new)
- `apps/synthetic-android-e2e/tests/Da5V5InvitationSecret.test.ts` (new)

`apps/synthetic-android-e2e/src/constants.ts` and
`apps/synthetic-android-e2e/src/SyntheticAndroidE2eEnvironment.ts` remain read-only. The unchanged
full Synthetic suite is a verification input for the real Auth/invitation/redemption endpoints;
the new focused unit suite must cover strict HTTP/JSON parsing, loopback/no-store/expiry binding,
one-shot state, sentinel non-disclosure, abort/error cleanup and zeroing, invalid alphabet/length/
pad bits, and rejection of the wrong 64-hex password master before ADB. The prior focused tests,
tests-inclusive Synthetic typecheck, full required-APK-reachability boundary, build/bundle/Node
checks, exactly one final V3, independent R3 review, focused publication, one exact-head CI, fresh
runtime/artifact generation and independent review remain mandatory. Then **STOP before ADB,
installation, Product-Human and Hardware** for fresh explicit authority.

Activation is only: independent R0 review `APPROVED` -> focused two-document `[skip ci]`
publication -> independent exact-head review -> extended R3 cycle. This candidate itself is V0:
exactly these two ADO paths, no executable delta, and no test, build, npm, CI, commit, push, ADB or
Hardware action.

## 2026-08-14 Human e-mail entry / compact credential prompts — top addendum candidate

Status: **HUMAN DIRECTION RECORDED / R0-V0 CANDIDATE / REVIEW PENDING / NOT ACTIVE / NO
HARDWARE AUTHORITY**. Exact preparation baseline is `HEAD == main == origin/main ==
3edae6bc5e91da1c286d32f3fe577b25154717fe`, tree
`25971097144a0d043d1656108da7045469bd36e5`. This addendum supersedes only conflicting future
prompt/credential-procedure wording below; historical outcomes and consumed authorities remain
unchanged. It authorizes no executable change or run before the activation sequence below.

The Human enters each public Synthetic e-mail address manually. Every affected prompt must name
the exact screen, e-mail field, address, credential field and button:

| Flow | Screen / fields / button | Exact public Synthetic e-mail |
|---|---|---|
| Administrator and Accessibility Administrator | `TapTim.e — Anmeldung` / `E-Mail-Adresse` / `Passwort` / `Anmelden` | `administrator-e2e@example.invalid` |
| Enrollment login | `TapTim.e — Anmeldung` / `E-Mail-Adresse` / `Passwort` / `Mit Einladung beitreten` | `employee-enrollment-e2e@example.invalid` |
| Employee and Accessibility Employee | `TapTim.e — Anmeldung` / `E-Mail-Adresse` / `Passwort` / `Anmelden` | `android-e2e@example.invalid` |

Only the three fixed public Synthetic addresses above may appear in the compiled plan, Human
prompt and terminal prompt output. A personal/free-form e-mail is forbidden, and no e-mail enters
the credential/ADB/clipboard channel, child environment, argv, evidence receipt or artifact
manifest. The credential remains captured exactly once, hidden at run start, memory-only and
FD3-bound, then machine-injected; it never enters clipboard, environment, argv, file or log.
`EMPTY_ACTIVE` before injection remains mandatory. The separate positive `VISIBLE` checkpoint is
removed. After successful machine-bound transfer, the next already-required Human result/surface
action also instructs the Human to press the named button. `PASS` is allowed only when the expected
destination surface is visible. An empty/not-filled-looking credential field, invisible or
otherwise doubtful injection, rejected login, wrong surface or any uncertainty is immediately
`FAIL`, `AMBIGUOUS` or `ABORT` and remains fail-closed. There is no automatic button tap.
Accessibility restoration is unchanged.

The `enrollment` credential phase is strictly the password field on `TapTim.e — Anmeldung`; its
successful destination is `Als Beschäftigter beitreten`. The 64-hex password master must never be
sent to `Einladungsgeheimnis`. The separate existing invitation-redemption step is not redefined;
if its exact safe source/procedure cannot be bound from current repository truth, R3 stops before
implementation and requests a scope amendment instead of guessing.

Only after this R0 candidate receives independent review `APPROVED`, one focused `[skip ci]`
publication and independent exact-head review may the standing rule activate one R3 cycle on the
resulting exact head. Its executable/test allowlist is exactly:

- `apps/synthetic-android-e2e/src/Da5V5FlightController.ts`
- `apps/synthetic-android-e2e/src/da5V5Main.ts`
- `apps/synthetic-android-e2e/src/Da5V5CredentialTransfer.ts`
- `apps/synthetic-android-e2e/tests/Da5V5FlightController.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5CredentialTransfer.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts`

`apps/synthetic-android-e2e/src/constants.ts` remains read-only and supplies the exact e-mail
literals. The Event Ledger may change only as the terminal truth synchronization after the R3
result. Any other path or semantic expansion stops for new authority.

The activated R3 cycle requires focused tests, a tests-inclusive Synthetic typecheck, the full
Synthetic required-APK-reachability boundary, build/bundle/Node checks, exactly one final V3,
independent R3 review, focused publication, one exact-head CI, fresh runtime/artifact generation
and independent review. Focused acceptance includes exact prompt/e-mail mapping, absence of every
standalone `VISIBLE` step/command, combined result-gate failures, and proof that the password master
cannot enter the invitation-secret field. It then **STOPS before ADB, installation, Human
interaction and Hardware** for a fresh explicit authority. This R0 preparation runs only V0; no
test, build, npm, CI, commit, push, ADB or Hardware action is claimed.

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
