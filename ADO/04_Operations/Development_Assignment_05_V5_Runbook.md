# Development Assignment 5 — V5 Human Android Gate Runbook

- Status: **READ-ONLY ARTIFACT/EVIDENCE APPROVED — HUMAN V5 UNAUTHORIZED**
- Date: 2026-07-25
- Owner: Technical Lead
- Approval authority for any run: Human Architect

## 1. Purpose and authority boundary

This runbook defines one fresh Human Android observation for ADR-0016 DA5-P12 and ADR-0017
DA5-T15. It minimizes repetition through staged gates, but every listed boundary remains
mandatory.

The carried software closure is current Source+Lock baseline
`a323834f51607841d0cd5f11aafdbfd3dd93ed5f`, tree
`65c669b0a941c21d23ffca5e79fa03285323a7cf`, exact-head CI `30149165373`,
attempt 1, 12/12. Independent implementation review round 2 returned `APPROVED` with zero open
P0–P3. Exact Evidence commit `e6a06e2ec8f580d6314bfe5a51378f949d524b16`, tree
`6dcdce405feb2eccb1462c373ab6be891152715c`, passed exact-head CI `30150095109`,
attempt 1, 12/12; final independent Artifact/Evidence Exact-SHA review returned `APPROVED` with
zero open P0–P3.

Those facts close the DA5 V0–V4 software scope only. **This document does not authorize V5,
installation, ADB, device or Tag interaction.** One future fresh run requires a separate exact
Human-Architect authorization despite the completed artifact/evidence review and CI. The
authorization must quote every binding in Section 3.

A failed, interrupted or ambiguous preflight, action, observation or checkpoint consumes that
one-run authority. Stop, mark the entire run failed and clean up. No retry, repair, resume,
replacement action or evidence reuse is allowed.

## 2. Fixed safety and disclosure boundary

- Use only fresh synthetic accounts and synthetic data on the exact local environment named by
  the future authorization.
- Use only the separately named, screen-unlocked Samsung/reference Android device and separately
  named approved Tags. An unnamed device or Tag must not be connected, presented or observed.
- Keep every endpoint local and exactly bound. LAN, tunnel, cloud and production resources are
  prohibited.
- Record only exact source/artifact bindings, public synthetic labels, safe UI states, Human
  pass/fail checkpoints and disclosure-safe aggregate results.
- Never record credentials, password digests, tokens, invitation/enrollment secrets, raw NFC UID
  or payload, provider subjects, device serials, encryption keys, internal identifiers or personal
  data. A screenshot is optional and prohibited while any such value is visible.
- Do not build, modify, sign, deploy or distribute an artifact during the run.
- Do not access `research/`. Repository checks must use an explicit protected-path exclusion and
  must also exclude the repository-root `app.json`.
- Production, production data, signing, deployment, distribution, pilot operation and
  legal/privacy approval remain unauthorized.

## 3. Mandatory exact binding — fill and verify before start

Every still-`UNBOUND` field below must be filled by the future authorization and independently
verified before any installation, device/Tag interaction or Gate A action. This runbook requires
no self-SHA.

| Binding | Required exact value |
|---|---|
| One-run Human authorization and date | `UNBOUND — DO NOT START` |
| Product commit/tree and required V4 | `a323834f51607841d0cd5f11aafdbfd3dd93ed5f` / `65c669b0a941c21d23ffca5e79fa03285323a7cf`; CI `30149165373`, attempt 1, 12/12 |
| Product implementation-review binding/verdict | Round 2 `APPROVED`; zero open P0–P3 |
| Runbook/evidence commit/tree and independent-review verdict | `e6a06e2ec8f580d6314bfe5a51378f949d524b16` / `6dcdce405feb2eccb1462c373ab6be891152715c`; CI `30150095109`, attempt 1, 12/12; final independent Artifact/Evidence Exact-SHA review `APPROVED`, zero open P0–P3 |
| Read-only APK path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/app-release-385c0c46f22dcac5.apk`; 95,522,787 bytes; `385c0c46f22dcac5b935bfdc6f574558f4e74748ed4a367ef399ddbd4299c547`; `0444` |
| Read-only artifact manifest path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/artifact-manifest.txt`; 1,647 bytes; `1c1f1b7a5b92fab5510cde35a439fc6f0742b7bf2666d6319cd89b9a7d4dcadb`; `0444` |
| Package, version, signature scheme, signer digest and packaged manifest/runtime values | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 `true`, v1/v3/v3.1/v4 `false`; one local synthetic non-production signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; packaged boundary/runtime `match` per adjacent manifest |
| Device model, OS/build and approved screen-unlocked mode | `UNBOUND — DO NOT START` |
| Approved assigned, unassigned and unrelated Tag labels/safe fingerprints | `UNBOUND — DO NOT START` |
| Exact synthetic services, status boundary and controlled-offline switch | `UNBOUND — DO NOT START` |
| Admin Setup Preview 2 entry, preview/validation result and safe exit procedure | `UNBOUND — DO NOT START` |
| DA5-T06 exact five-second dedupe boundary and lifecycle-cancellation checkpoint | `UNBOUND — DO NOT START` |
| Separately reviewed Protected/Review induction fixture, synthetic labels, exact start state, cutover procedure, expected state sequence and scoped teardown | `UNBOUND — DO NOT START` |
| Exact large-text setting and TalkBack version | `UNBOUND — DO NOT START` |

The populated product and artifact/evidence rows are independently approved. They are not a
Human-run authorization. Every remaining operational binding and a separate exact Human
authorization are still mandatory.

At preflight, recompute both read-only file sizes, SHA-256 digests and modes from the preserved APK
and manifest. Independently verify package/version, signature/signer and packaged
manifest/runtime values from the APK. Require exact equality with the authorization. Any changed
source, review, CI, file, mode, dependency, configuration, device, OS, Tag or synthetic
environment invalidates the binding and consumes the run authority.

The Protected/Review fixture must bind one exact DA5-compatible historical cutover procedure. Its
reviewed expected sequence is:

```text
clean FIFO and no review marker
-> active_entry_for_other_target_rejected
-> review_pending/historical_configuration_not_valid
-> review_pending/predecessor_requires_review
-> FIFO drained and protected/review-required UI
-> protected/review-required UI retained after one cold relaunch
```

The fixture uses only named synthetic Customer assignments and approved Tags, never device-clock
tampering. If its exact source/procedure, starting aggregate, cutover action, expected safe
aggregate or fixture-scoped teardown is absent or differs, do not start.

## 4. Preflight and short Human checkpoints

Before Gate A:

1. Verify the exact repository heads and a clean tracked worktree with both protected exclusions.
2. Verify the Section 3 bindings without rebuilding or changing the read-only files.
3. Require only the authorized USB device, no unexpected mapping/listener, no retained package
   state and fresh synthetic database/accounts/data.
4. Install only the exact bound APK through the separately reviewed scoped procedure. Enable NFC
   and keep the device screen unlocked.
5. Require the authorized disclosure-safe status boundary to report fresh zero DA5 setup,
   lifecycle, queue, sync and protected-state evidence before the first action.

After each staged gate, the operator states only the expected and observed safe result. The Human
answers `PASS`, `FAIL` or `AMBIGUOUS`. Only `PASS` permits the next gate. Short acknowledgement
never replaces a listed observation.

Immediately after the Human confirms each first action that will later have an intended opposite
Start/Stop for the same User/WorkTarget, the operator captures the exact named
`dedupe-window-baseline`. The harness queries a fresh PostgreSQL server clock only after that
action, keeps the allow-listed phase/target baseline only in process memory and records only
`dedupe_window_baseline=match`. It must not derive this baseline from WorkEvent persistence; this
conservatively covers an action still held only in the encrypted offline FIFO.

Before the matching opposite action, the operator consumes that exact single-use baseline through
`dedupe-window-check` and must prove that strictly more than the five-second DA5-T06 window has
elapsed. Record only `dedupe_window_elapsed=match`; do not record wall-clock or monotonic
timestamps. A missing, wrong-phase, wrong-target, reused, equal-to-five-seconds or ambiguous
baseline fails before the action. No elapsed check is required before a first action.

## 5. Staged Human gate

### Gate A — Authentication, enrollment and setup exclusion

1. Exercise the authorized fresh synthetic authentication/enrollment path. Verify signed-out,
   Employee and Administrator navigation disclose only role-appropriate screens and actions.
2. In Administrator setup, present only the approved assigned Tag and complete its authorized
   synthetic Customer assignment. Require setup UI success and setup aggregates, with zero
   lifecycle action. Require that first assignment capture to finish and release capture
   ownership.
3. Start the separately bound second operation named **Admin Setup Preview 2**. Within only that
   new setup capture/preview, present the already assigned Tag. Require setup-side
   preview/validation only, with zero lifecycle WorkEvent/Decision/Receipt/Audit, zero queue item
   and no navigation into lifecycle handling.
4. Safely cancel/leave Admin Setup Preview 2 through its bound exit. After returning to the normal
   shell and again after refresh/relaunch, require zero replay and unchanged lifecycle/queue
   aggregates. Verify Administrator setup state remains visible and correct.
5. Sign out and present the assigned Tag. Require signed-out rejection with zero lifecycle or
   queue mutation.
6. After Employee authentication, present the separately approved unassigned Tag and unrelated
   Tag. Require safe rejection and zero lifecycle or queue mutation for each.

Checkpoint: auth/enrollment, role boundary, completed first assignment capture, separately started
and safely exited Admin Setup Preview 2, zero setup-to-lifecycle replay, setup preservation and all
three rejection paths are unambiguous.

### Gate B — Cold launch, background resume and same-Tag dedupe

1. From a cold, non-running app with unlocked screen and authenticated synthetic Employee
   authority, present the approved assigned Customer Tag. Require one cold launch and exactly one
   NFC lifecycle result.
2. Present that same Tag again within the exact bound dedupe interval. Require no second lifecycle
   mutation, but exactly one additional persisted WorkEvent, Decision, Receipt and Audit with
   Decision `duplicate_scan_ignored`. Own-time and the current TimeEntry remain unchanged.
   After the Human confirms that duplicate result, capture the named Gate-B Customer baseline.
3. Before the intended opposite lifecycle result, consume that same baseline and require
   `dedupe_window_elapsed=match`. Then put the app in the background and present the same Tag.
   Require one background/resume dispatch and exactly one next lifecycle result.
4. Verify active/history truth and immutable NFC provenance for both accepted results.

Checkpoint: cold launch, warm/background resume, consume-once ownership and same-Tag dedupe pass
with exact duplicate evidence and without a second TimeEntry mutation.

### Gate C — Online targets, mixed provenance and own-time truth

Use only valid server-decided toggles; never select Start or Stop manually.

1. Exercise the online Customer path with one NFC action and the matching manual Customer action
   so the resulting pair proves mixed NFC/manual provenance. After Human confirmation of the
   first action, capture the named Gate-C Customer baseline; consume it and require
   `dedupe_window_elapsed=match` before the intended opposite action.
2. Exercise one online manual Project Start/Stop pair. After Human confirmation of Start, capture
   the named Gate-C Project baseline; consume it and require
   `dedupe_window_elapsed=match` before Stop.
3. Exercise one online manual General Work Start/Stop pair. After Human confirmation of Start,
   capture the named Gate-C General Work baseline; consume it and require
   `dedupe_window_elapsed=match` before Stop.
4. After each pair, require the current active state, ordered own-time active/history projection,
   exact Customer/Project/General target label and immutable trigger provenance to agree.

NFC remains Customer-assignment-based; this gate does not invent NFC assignment to Project or
General Work.

Checkpoint: applicable NFC/manual Customer plus manual Project/General online coverage and
own-time truth are complete.

### Gate E — TalkBack, text scaling and layout

At the exact large-text setting, enable the bound TalkBack version and inspect the authentication,
setup, scan/manual-target, own-time, sync/pending and error/rejection surfaces already reached.
Require logical focus order, meaningful labels/roles, announced state changes, visible focus,
non-color-only meaning, readable controls and no clipped, overlapping, unreachable or
horizontally overflowing essential content. Do not repeat lifecycle writes for accessibility.

Checkpoint: accessibility and layout pass on the exact bound device/settings.

Gate E must pass before Gate D starts because Gate D ends at the mandatory protected-state stop.

### Gate D — Controlled offline, reviewed Protected/Review fixture and final stop

1. Activate only the exact authorized controlled-offline switch and prove loss of the bound
   server path without changing authentication, device or app state.
2. Exercise the applicable ordinary offline matrix once: assigned Customer NFC with matching
   manual Customer action, one manual Project pair and one manual General Work pair. Immediately
   after Human confirmation of each first pending action, capture its named Gate-D ordinary
   target baseline; consume that same baseline and require `dedupe_window_elapsed=match` before
   its intended opposite action. Require FIFO order, target/provenance truth and explicit pending
   UI; no server success may be claimed.
3. Restart the app once while ordinary evidence is pending. Require durable restoration,
   unchanged order and no false ready/cleared state. Restore only the authorized server path and
   require one ordered synchronization, no duplicate result and eventual own-time active/history
   agreement.
4. At the exact lifecycle-cancellation checkpoint bound in Section 3, begin only the named
   cancellable action and perform the named background/restart transition. Require the stale or
   cancelled result to produce zero later mutation or replay. Do not repeat the action.
5. Require the ordinary FIFO to be clean and no review marker to exist. Start only the separately
   reviewed Protected/Review fixture. Require Tag A to have no active TimeEntry; after
   that clean checkpoint, start approved Tag B online so its other target is active. This is Tag
   B's first action and has no preceding elapsed check. After Human confirmation of Start, capture
   the named Gate-D Tag-B/Customer-B baseline.
6. Enter the bound cold offline state and capture approved Tag A once before cutover. While the
   device remains offline, require its pending UI and capture the named Gate-D Tag-A baseline.
   Then execute only the fixture's reviewed synthetic reassignment of Tag A from its named
   Customer A to named Customer B. Do not alter device clocks.
7. Consume the Gate-D Tag-A baseline and require `dedupe_window_elapsed=match`, then capture stale
   Tag A once after cutover. Consume the independently retained Gate-D Tag-B/Customer-B baseline
   and require `dedupe_window_elapsed=match` before capturing Tag B as its intended successor
   action.
8. Restore only the approved path and allow automatic FIFO reconciliation without per-event retry.
   Require, in order:
   `active_entry_for_other_target_rejected`,
   `review_pending/historical_configuration_not_valid`, then
   `review_pending/predecessor_requires_review`. Require zero TimeEntry mutation for both
   review-pending outcomes, a drained FIFO and the protected/review-required UI.
9. Force-stop and cold relaunch exactly once as part of the fixture. Require the same protected/
   review-required state to persist.
10. Stop at `protected_review_fixture_checkpoint=match`. Do not repair, retry, adjudicate, clear,
    resume, continue to another gate or reuse any fixture state or observation. Proceed directly
    to Gate F cleanup.

Checkpoint: ordinary offline parity/restart/cancellation and the separately reviewed historical
cutover sequence are exact; `review_pending` and protected state persist at the final mandatory
stop.

### Gate F — Final truth and complete cleanup

1. Require the disclosure-safe final status to match only the staged actions, with no duplicate,
   foreign or unexplained setup/lifecycle/sync evidence.
2. Sign out every Mobile/Admin session and clear clipboard, downloads and temporary screenshots.
3. Stop synthetic services normally; remove only scoped mappings/listeners and the exact synthetic
   package. Never use blanket device cleanup.
4. Invoke only the Protected/Review fixture's separately reviewed scoped teardown. Do not
   adjudicate, repair, retry or clear fixture records through product actions.
5. Remove the task-owned synthetic database/schema/ledger and generated runtime roles through the
   reviewed scoped procedure.
6. Require zero authorized package, mapping, listener, fixture and disposable database/role
   residue.
7. Reverify the tracked repository against the authorized head using both protected exclusions
   and leave unrelated repository, device and PostgreSQL state untouched.

Cleanup is mandatory after pass, failure or abort. Cleanup success does not convert a failed or
ambiguous run into a pass.

## 6. Result authority

Record only in
`ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`. Only the Human Architect or an
explicitly delegated Human tester may mark a separately authorized fresh V5 `PASSED`. Automated
tests, V4, software review, this shell or a clean preflight do not pass V5 or authorize production,
signing, deployment or distribution.
