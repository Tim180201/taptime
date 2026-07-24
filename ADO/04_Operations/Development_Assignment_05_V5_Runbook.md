# Development Assignment 5 — V5 Human Android Gate Runbook

- Status: **PRE-HARDWARE SHELL — NOT RUN — HUMAN V5 UNAUTHORIZED**
- Date: 2026-07-24
- Owner: Technical Lead
- Approval authority for any run: Human Architect

## 1. Purpose and authority boundary

This runbook defines one fresh Human Android observation for ADR-0016 DA5-P12 and ADR-0017
DA5-T15. It minimizes repetition through staged gates, but every listed boundary remains
mandatory.

The carried software closure is:

- product correction `452d8fd93aeec66560b3fa73065850d4584490d1`, tree
  `699349b0a65360da9fa63288c384b2e287d0012b`, exact-head V4 `30115776918`,
  attempt 1, 12/12; and
- R0 truth synchronization `b777f7027f436caf785f657ae9fc29795fd60bcb`, tree
  `54b257f50eb4d565a60ee6f6171921033695a1c7`, independently Exact-Delta
  `APPROVED`, `MERGE_READY`, with zero open P0–P3.

Those facts close the DA5 V0–V4 software scope only. **This document does not authorize V5,
installation, ADB, device or Tag interaction.** One future fresh run requires a separate exact
Human-Architect authorization after this runbook/evidence candidate has been independently
reviewed. The authorization must quote every binding in Section 3.

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

Every `UNBOUND` field below must be filled by the future authorization and independently verified
before any installation, device/Tag interaction or Gate A action. This shell requires no self-SHA.

| Binding | Required exact value |
|---|---|
| One-run Human authorization and date | `UNBOUND — DO NOT START` |
| Product commit/tree and required V4 | `UNBOUND — DO NOT START` |
| Product implementation-review binding/verdict | `UNBOUND — DO NOT START` |
| Runbook/evidence commit/tree and independent-review verdict | `UNBOUND — DO NOT START` |
| Read-only APK path, byte size, SHA-256 and exact mode | `UNBOUND — DO NOT START` |
| Read-only artifact manifest path, byte size, SHA-256 and exact mode | `UNBOUND — DO NOT START` |
| Package, version, signature scheme, signer digest and packaged manifest/runtime values | `UNBOUND — DO NOT START` |
| Device model, OS/build and approved screen-unlocked mode | `UNBOUND — DO NOT START` |
| Approved assigned, unassigned and unrelated Tag labels/safe fingerprints | `UNBOUND — DO NOT START` |
| Exact synthetic services, status boundary and controlled-offline switch | `UNBOUND — DO NOT START` |
| Exact dedupe interval and lifecycle-cancellation checkpoint | `UNBOUND — DO NOT START` |
| Exact large-text setting and TalkBack version | `UNBOUND — DO NOT START` |

At preflight, recompute both read-only file sizes, SHA-256 digests and modes from the preserved APK
and manifest. Independently verify package/version, signature/signer and packaged
manifest/runtime values from the APK. Require exact equality with the authorization. Any changed
source, review, CI, file, mode, dependency, configuration, device, OS, Tag or synthetic
environment invalidates the binding and consumes the run authority.

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

## 5. Staged Human gate

### Gate A — Authentication, enrollment and setup exclusion

1. Exercise the authorized fresh synthetic authentication/enrollment path. Verify signed-out,
   Employee and Administrator navigation disclose only role-appropriate screens and actions.
2. In Administrator setup, present only the approved assigned Tag and complete its authorized
   synthetic Customer assignment. Require setup UI success and setup aggregates, with zero
   lifecycle action.
3. While setup capture remains active, present the assigned Tag once more. Require setup-only
   handling: no Start/Stop, no queued lifecycle evidence and no later replay after leaving setup.
4. Verify Administrator setup state remains visible and correct after refresh/relaunch.
5. Sign out and present the assigned Tag. Require signed-out rejection with zero lifecycle or
   queue mutation.
6. After Employee authentication, present the separately approved unassigned Tag and unrelated
   Tag. Require safe rejection and zero lifecycle or queue mutation for each.

Checkpoint: auth/enrollment, role boundary, setup preservation, setup-capture exclusion and all
three rejection paths are unambiguous.

### Gate B — Cold launch, background resume and same-Tag dedupe

1. From a cold, non-running app with unlocked screen and authenticated synthetic Employee
   authority, present the approved assigned Customer Tag. Require one cold launch and exactly one
   NFC lifecycle result.
2. Present that same Tag again within the exact bound dedupe interval. Require no second lifecycle
   result, no duplicate queue item and truthful unchanged own-time state.
3. After the exact dedupe boundary, put the app in the background and present the same Tag.
   Require one background/resume dispatch and exactly one next lifecycle result.
4. Verify active/history truth and immutable NFC provenance for both accepted results.

Checkpoint: cold launch, warm/background resume, consume-once ownership and same-Tag dedupe pass
without duplicate mutation.

### Gate C — Online targets, mixed provenance and own-time truth

Use only valid server-decided toggles; never select Start or Stop manually.

1. Exercise the online Customer path with one NFC action and the matching manual Customer action
   so the resulting pair proves mixed NFC/manual provenance.
2. Exercise one online manual Project Start/Stop pair.
3. Exercise one online manual General Work Start/Stop pair.
4. After each pair, require the current active state, ordered own-time active/history projection,
   exact Customer/Project/General target label and immutable trigger provenance to agree.

NFC remains Customer-assignment-based; this gate does not invent NFC assignment to Project or
General Work.

Checkpoint: applicable NFC/manual Customer plus manual Project/General online coverage and
own-time truth are complete.

### Gate D — Controlled offline, sync/protected truth, restart and cancellation

1. Activate only the exact authorized controlled-offline switch and prove loss of the bound
   server path without changing authentication, device or app state.
2. Exercise the applicable offline matrix once: assigned Customer NFC with matching manual
   Customer action, one manual Project pair and one manual General Work pair. Require FIFO order,
   target/provenance truth and explicit pending/protected UI; no server success may be claimed.
3. Restart the app once while evidence is pending. Require durable restoration, unchanged order
   and no false ready/cleared state.
4. Restore only the authorized server path. Require one ordered synchronization, no duplicate
   result, truthful protected/review state and eventual own-time active/history agreement.
5. At the exact lifecycle-cancellation checkpoint bound in Section 3, begin only the named
   cancellable action and perform the named background/restart transition. Require the stale or
   cancelled result to produce zero later mutation or replay. Do not repeat the action.

Checkpoint: controlled-offline parity, mixed provenance, queue/sync/protected truth, process
restart and lifecycle cancellation are unambiguous.

### Gate E — TalkBack, text scaling and layout

At the exact large-text setting, enable the bound TalkBack version and inspect the authentication,
setup, scan/manual-target, own-time, sync/protected and error/rejection surfaces already reached.
Require logical focus order, meaningful labels/roles, announced state changes, visible focus,
non-color-only meaning, readable controls and no clipped, overlapping, unreachable or
horizontally overflowing essential content. Do not repeat lifecycle writes for accessibility.

Checkpoint: accessibility and layout pass on the exact bound device/settings.

### Gate F — Final truth and complete cleanup

1. Require the disclosure-safe final status to match only the staged actions, with no duplicate,
   foreign or unexplained setup/lifecycle/sync evidence.
2. Sign out every Mobile/Admin session and clear clipboard, downloads and temporary screenshots.
3. Stop synthetic services normally; remove only scoped mappings/listeners and the exact synthetic
   package. Never use blanket device cleanup.
4. Remove the task-owned synthetic database/schema/ledger and generated runtime roles through the
   reviewed scoped procedure.
5. Require zero authorized package, mapping, listener and disposable database/role residue.
6. Reverify the tracked repository against the authorized head using both protected exclusions
   and leave unrelated repository, device and PostgreSQL state untouched.

Cleanup is mandatory after pass, failure or abort. Cleanup success does not convert a failed or
ambiguous run into a pass.

## 6. Result authority

Record only in
`ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`. Only the Human Architect or an
explicitly delegated Human tester may mark a separately authorized fresh V5 `PASSED`. Automated
tests, V4, software review, this shell or a clean preflight do not pass V5 or authorize production,
signing, deployment or distribution.
