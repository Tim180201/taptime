# Development Assignment 5 — V5 Operational Enablement Authorization Candidate

- Status: **HUMAN-DIRECTED PREPARATION CANDIDATE — EXECUTABLE ENABLEMENT REQUIRES INDEPENDENT APPROVAL; HUMAN V5 UNAUTHORIZED**
- Date: 2026-07-25
- Candidate baseline commit: `7fe725360935a5d9587e3dfbdb2789d8309342df`
- Candidate baseline tree: `0abaa77443a2abf81fd815ec138776155188bfc0`
- Reviewed Product source/lock commit: `a323834f51607841d0cd5f11aafdbfd3dd93ed5f`
- Reviewed Product source/lock tree: `65c669b0a941c21d23ffca5e79fa03285323a7cf`
- Product Exact-Head CI: `30149165373`, attempt 1, 12/12 successful
- Reviewed artifact/evidence commit: `e6a06e2ec8f580d6314bfe5a51378f949d524b16`
- Reviewed artifact/evidence tree: `6dcdce405feb2eccb1462c373ab6be891152715c`
- Artifact/evidence Exact-Head CI: `30150095109`, attempt 1, 12/12 successful
- Owner: Technical Lead
- Decision authority: Human Architect
- Risk class: current ADO-only candidate **R0**; proposed executable enablement **R3**

## 1. Objective and verified gap

The Human Architect directed the Technical Lead to prepare every currently required DA5 Human
Android test in one coherent pass and to stop immediately before hardware interaction.

DA5 Workstreams A–F, AVS V0–V4, the immutable synthetic APK/manifest and their independent reviews
are complete on the exact bindings above. The Product implementation and artifact are not changed
by this candidate.

The remaining gate cannot start safely with the current harness:

- `apps/synthetic-android-e2e` has only the default profile and the opt-in `da4-v5` browser profile;
- its database profile union and executable entry points contain no `da5-v5` profile;
- no reviewed DA5 disclosure-safe status vector, controlled API-offline switch, Tag-role binding,
  five-second readiness check, cancellation checkpoint or historical Protected/Review fixture
  exists; and
- the corresponding rows in the DA5 V5 runbook and evidence remain `UNBOUND`.

The smallest safe preparation is one opt-in, local, disposable DA5-V5 operational profile around
the unchanged real Auth/API/Mobile Product paths. It prepares and measures the future Human gate;
it does not replace any Human observation or authorize device use.

## 2. Exact executable scope after independent candidate approval

Under the standing Human instruction recorded in `AGENTS.md`, an independently `APPROVED`
technical authorization candidate with zero open P0–P3 may proceed without another confirmation
prompt until the Human/hardware stop. On that condition, the later sole Development writer may
change only:

- `apps/synthetic-android-e2e/src/**` for an explicit `da5-v5` profile, deterministic synthetic
  fixture, safe operator state machine, aggregate/status readers, bounded API-offline ownership,
  Tag-role preparation, timing checkpoint and strict cleanup;
- `apps/synthetic-android-e2e/tests/**` for profile isolation, state-machine, database-invariant,
  disclosure, ADB-runner fake, interruption and cleanup regressions;
- `apps/synthetic-android-e2e/package.json` for the focused build/start entry point and only the
  existing internal workspace dependencies needed to compose the accepted DA5 runtime;
- new opt-in DA5-V5 modules under `apps/mobile/scripts/**`, focused tests under
  `apps/mobile/tests/runtime/**` and script-only entries in `apps/mobile/package.json` for exact
  external-artifact verification, package-zero installation and package/mapping cleanup. Existing
  install/disconnect commands and Product/native build inputs remain unchanged;
- root `package-lock.json` only for the mechanically corresponding internal workspace links, with
  no external package or version change;
- `apps/synthetic-android-e2e/README.md`;
- the minimum existing synthetic Android install/disconnect script tests only if objective
  integration evidence proves they are required; their historical behavior may not be broadened;
  and
- concise truthful DA5 runbook/evidence/status/decision/risk synchronization.

No Mobile Product source, native module/config plugin, backend Product source, neutral contract,
schema/migration, external dependency/version, unrelated lockfile, workflow, APK, manifest or
signer change is authorized.

## 3. Required `da5-v5` profile contract

The executable enablement SHALL:

1. require the exact explicit `TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5` opt-in before reading database,
   credential, artifact or device-related configuration; missing and unknown values fail closed;
2. preserve the default and `da4-v5` profiles byte-semantically and keep all Product ports fixed to
   numeric loopback: Auth `127.0.0.1:54321` and API `127.0.0.1:3000`;
3. use only the disposable `taptime_synthetic_android_e2e` database, migrations `001`–`013`,
   generated least-privilege runtime roles, reserved `.invalid` identities and fixed public
   synthetic labels;
4. seed only the minimum DA5 state that cannot be created safely during the observed Product flow:
   two active Customers, one active Project, the built-in General Work target and the exact
   Employee/Administrator identities; initial lifecycle, FIFO/reconciliation and protected/review
   evidence remains zero;
5. compose the unchanged real DA5 server capabilities that the current older harness omits:
   `ManualLifecycleIngestionCoordinator`, `MobileWorkReadCoordinator`,
   `ProjectAdministrationCoordinator`, v2 offline lease/ingestion/reconciliation and their exact
   least-privilege runtime pools/roles. The own-time cursor HMAC key must be a fresh strictly
   validated 32-byte process-local value and must never be emitted;
6. expose a fixed public manifest containing only labels and operation names for:
   `DA5 V5 Customer A`, `DA5 V5 Customer B`, `DA5 V5 Project`,
   `Allgemeine Arbeitszeit`, `DA5 V5 Tag A`, `DA5 V5 Tag B` and `DA5 V5 Tag X`;
7. keep Tag A, Tag B and Tag X as three distinct physical roles:
   Tag A is assigned through the real Administrator setup flow, Tag B is first observed as
   registered-but-unassigned and is later used only by the reviewed historical fixture, and Tag X
   remains unrelated/unknown for the whole run;
8. never emit or retain raw UID/payload outside the existing protected resolver/transport/database
   boundary. Only the existing uppercase 12-hex SHA-256 safe fingerprint may be reported or
   compared, and the three fingerprints must be distinct;
9. provide a single-use preflight role-binding state machine. Because an unknown third Tag cannot
   be fingerprint-bound without physical observation, the Technical Lead explicitly selects two
   authorization stages: first, a separate read-only/non-mutating device-and-Tag identification
   preflight for the physically labelled A/B/X set; second, only after its exact values and cleanup
   are known, a fresh exact-bound one-run Human V5 authorization. The preflight may produce only
   model/OS/build, supported Tag technology, distinct safe fingerprints, font scale and TalkBack
   version. It performs no Product action, installation, database write or gate observation and
   ends with zero package/mapping/listener residue. Failure or ambiguity consumes only that
   preflight authority; no result except the exact binding values is reusable;
10. retain the synthetic password only in memory and bind it to a process-local SHA-256 digest.
   Before every password injection, a hidden comparison must emit only `match` or `mismatch`;
11. expose one safe `status` command whose closed JSON schema contains only profile/operator state,
    aggregate counts and named invariant results. It must contain no credential, digest, token,
    secret, raw NFC, provider subject, device serial, internal identifier, timestamp or personal
    data;
12. reject concurrent, repeated, out-of-order or unknown operator commands without advancing the
    state machine. A latched failure must prevent later preparation or gate progress;
13. own only the exact API reverse mapping for the controlled-offline interval. Entering offline
    removes `tcp:3000 -> tcp:3000` only after proving the unchanged exact Auth mapping
    `tcp:54321 -> tcp:54321`; restoration recreates only the exact API mapping. Unexpected devices,
    network/emulator transports or mappings fail closed. No serial is emitted;
14. restore the exact direct mapping during normal, failure, signal and startup-abort cleanup.
    Cleanup must never use `adb reverse --remove-all` or touch an unrelated mapping;
15. provide fixed allow-listed, phase/target-bound `dedupe-window-baseline` slots and matching
    single-use `dedupe-window-check` commands. A baseline may be captured only immediately after
    the Human has confirmed the preceding Product action for that exact phase, User and target. It
    queries a fresh PostgreSQL server clock once, retains that value only in process memory and
    emits only `dedupe_window_baseline=match|mismatch`; no timestamp is emitted or persisted. The
    matching check queries the server clock again and emits only
    `dedupe_window_elapsed=match|mismatch`, returning `match` only when strictly more than five
    seconds have elapsed. It then destroys that slot. Missing, wrong-phase, wrong-target, reused,
    equal-to-five-seconds, ambiguous or unexpected state returns only `mismatch` and latches the
    run failed. Readiness must never be derived from persisted WorkEvent age, so an action still
    held only in the encrypted offline FIFO is covered conservatively;
16. provide serial read-only checkpoints that compare the current aggregate against the exact
    expected delta for setup/rejection, cold/background dispatch, duplicate evidence, online mixed
    provenance, Project/General work, ordinary offline FIFO, synchronization, cancellation and
    Protected/Review terminal state;
17. never use a checkpoint as Product authority. Every lifecycle result, own-time/provenance state,
    queue/protection state and accessibility result still requires the exact Human-visible Product
    observation named by the runbook;
18. bind lifecycle cancellation to the existing Product action only: start one foreground
    `NFC-Tag scannen` capture, press `Scan abbrechen` before presenting any Tag, require the exact
    `Scan abgebrochen` UI, put the app in the background, use only
    `adb shell am kill com.tim180201.mobile.synthetic`, then cold relaunch and require normal ready
    state with unchanged server/status plus device queue zero and no replay. Android
    `force-stop` is not used for this checkpoint, and no artificial Product request delay or
    mutation is introduced;
19. bind **Admin Setup Preview 2** to a new real setup capture after Tag A assignment: select the
    named Customer, enter the exact label `DA5 V5 Preview 2`, scan already assigned Tag A, require
    `Tag bereits registriert`, then navigate to `Erfassen`. Require unchanged assignment/setup
    totals, zero lifecycle/queue mutation and no replay after refresh/cold relaunch;
20. prepare Tag B as a registered unassigned synthetic Tag only through the explicitly armed
    single-use fixture boundary after its safe role is known. The first Employee rejection must use
    the real scan path and show `Tag nicht zugeordnet`; Tag X must reach the same safe Product copy
    while remaining absent from database state. All three Tags must expose a technology matched by
    the packaged `ACTION_TECH_DISCOVERED` filter;
21. make every fixture write distinguishable from Human Product evidence, unreachable through the
    app/API and included in the safe expected baseline before the next observed action;
22. provide one separately armed, single-use Protected/Review fixture with fixed labels and exact
    start-state validation. It may:
    - activate the already registered Tag B for `DA5 V5 Customer B` before its online Start;
    - cut over Tag A from `DA5 V5 Customer A` to `DA5 V5 Customer B` while the approved device is
      offline and the pre-cutover evidence remains queued; and
    - expose only safe fixture state and aggregate results;
23. require the exact terminal sequence:

```text
clean FIFO and no review marker
-> active_entry_for_other_target_rejected
-> review_pending/historical_configuration_not_valid
-> review_pending/predecessor_requires_review
-> FIFO drained and protected/review-required UI
-> protected/review-required UI retained after one cold relaunch
```

24. latch the fixture at `protected_review_fixture_checkpoint=match`; repair, retry, adjudication,
    queue clearing or continued Product action is impossible through the operator state machine;
25. tear down the protected fixture only by the profile-owned disposable database cleanup. It must
    not perform Product repair/adjudication or delete/rewrite individual append-only Product rows;
26. expose an accessibility binding checkpoint for the exact device-reported Android build,
    installed TalkBack package version and DA5-P09's exact `font_scale=2.0`/200-percent setting.
    Device values are learned only during the separately authorized read-only preflight; the Human
    must still inspect every DA5-P09 surface at the exact final-run setting;
27. validate the preserved read-only APK and adjacent manifest by exact path, size, mode and
    SHA-256 before permitting an installation command. The enablement may read but never rebuild,
    modify, sign or copy over either file; and
28. on every exit prove zero task-owned listeners, reverse mappings, installed synthetic package,
    disposable database/schema/ledger, generated runtime roles, credential/clipboard material and
    temporary files while preserving unrelated state and both protected repository exclusions.

## 4. Human sequence prepared by this enablement

After the separate binding-only preflight and its cleanup, the reviewed Human V5 remains one fresh
staged Gate A → B → C → E → D → F:

- **Fresh run preflight:** reverify the already exact-bound artifact/device/build, A/B/X
  fingerprints and accessibility values, then require package/database/mapping/listener zero state.
- **Gate A:** role-safe auth/enrollment, real Tag-A setup, Admin Setup Preview 2, signed-out,
  unassigned and unrelated rejection.
- **Gate B:** screen-unlocked cold Tag Dispatch, within-window duplicate evidence, strictly
  after-window background/resume opposite result. Cold non-running preparation must use the exact
  reviewed sequence: put the app in the background, run only
  `adb shell am kill com.tim180201.mobile.synthetic`, prove its process absent and then present
  Tag A without manually launching the app. Android `force-stop` is prohibited for this step.
- **Gate C:** Customer mixed NFC/manual provenance and manual Project/General Start/Stop with
  effective own-time truth.
- **Gate E:** TalkBack and exact font scaling over already reached DA5 surfaces; no repeated writes.
- **Gate D:** controlled offline Customer/Project/General parity, restart/sync, exact capture
  cancellation and the terminal Protected/Review fixture.
- **Gate F:** final aggregate truth, sign-out and complete scoped cleanup.

The runbook may reduce operator prose and repeated evidence, but it may not omit any ADR-0016
DA5-P12 or ADR-0017 DA5-T15 observation.

## 5. Explicitly unchanged and prohibited

The enablement SHALL NOT change or authorize:

- Business Engine decisions, five-second semantics, target/provenance rules, own-time truth,
  setup/reassignment authority, offline/review semantics or any Human-accepted product value;
- Mobile UI/Product behavior, APK bytes, native configuration, Android manifest, external
  dependency versions, schema/migrations, backend/API behavior, contracts, CI selection or release
  configuration;
- raw NFC, credentials, secrets, internal identifiers, device serials or personal data in output,
  screenshots, evidence or repository files;
- blanket ADB cleanup, LAN/tunnel/cloud access, an emulator or an unnamed device/Tag;
- installation, ADB, device/Tag interaction or Human V5 before the final independent enablement
  review and a new exact Human authorization; or
- production, production data, production/distribution signing, deployment or distribution.

The repository-root untracked `app.json` and `research/` remain protected and excluded from every
inspection, diff, status, test-discovery and mutation command.

## 6. Change-Impact Record and Adaptive Verification Plan

### Current ADO-only candidate

- Risk: AVS-001 R0.
- Changed boundary: this authorization candidate only.
- Required: V0 exact diff/file list, whitespace, references, authority/status and protected-path
  checks.
- Carried evidence: exact Product/artifact/CI/review bindings listed above; no Product test is
  claimed as freshly run.
- V1–V5: not applicable/not authorized.

### Proposed executable enablement

- Risk: AVS-001 R3 because it owns memory-only credentials, privileged disposable fixture state,
  ADB reverse mapping, Human-gate measurement, failure latching and cleanup.
- Affected workspace: `@taptime/synthetic-android-e2e`; neighboring unchanged boundaries are the
  real Backend API, administration/lifecycle/offline coordinators and Mobile install/disconnect
  contract.
- V1: focused profile/parser/operator-state, timing, fixture, disclosure, reverse-controller fake,
  signal/failure and cleanup regressions plus tests-inclusive typecheck.
- V2: complete synthetic-harness suite/typecheck/build; focused Backend API, Backend Mobile Work,
  administration, lifecycle, offline and Mobile composition/install-disconnect boundary
  regressions where the final diff proves transitive impact.
- V3: one final complete locally executable repository regression, all applicable tests-inclusive
  typechecks/builds, clean PostgreSQL migration/replay/ledger, Android export and immutable
  artifact revalidation.
- V4: one focused publication, complete exact-head GitHub Actions matrix and independent exact-SHA
  implementation review with zero open P0–P3.
- V5: not run and not authorized; stop immediately before USB/device/Tag interaction.

Any R3 correction repeats the affected V1/V2 and one final V3/V4 before re-review. Verification
depth may not be reduced to save time or quota.

## 7. Required independent reviews and stop condition

Required sequence:

```text
ADO-only candidate + V0
  -> focused publication / exact candidate binding
  -> independent read-only pre-implementation review
  -> if APPROVED with zero P0–P3: sole Development writer implements exact R3 scope
  -> Technical-Lead V0–V3 acceptance
  -> focused publication + exact-head V4
  -> independent read-only Exact-SHA implementation review
  -> concise binding-preflight authorization package
  -> STOP before USB, ADB or Tag interaction
  -> separate read-only/non-mutating binding preflight and complete cleanup
  -> exact one-run Human V5 authorization package
  -> one fresh install and staged Human gate
```

No Human/hardware action is authorized by this candidate. The Technical Lead must tell the Human
Architect explicitly **“Jetzt Handy anschließen”** only after every preceding arrow is complete
and must provide one copy-ready exact-bound one-run authorization. Production, production data,
deployment and distribution remain unauthorized.

## 8. Candidate review history

The independent read-only review of candidate commit
`6112e10b49ea1f66004dc515234be8d38d12575c`, tree
`e7622553c148f587a48b8fabe68830472e405d29`, exact-head CI `30159661549`, attempt 1,
12/12 successful, returned `CHANGES REQUIRED` with only P2 `DA5-V5-REV-01`. This correction
replaces persisted-WorkEvent-age readiness with the memory-only fresh-server-clock baseline above
and removes the unreachable elapsed check before Tag B's first action. Independent exact-delta
re-review remains required before implementation.

Change impact is AVS-001 R0: only this candidate and the Human runbook change; no executable,
schema, dependency, lockfile, configuration, workflow, script or artifact input changes. V0
integrity checks apply, and all Product/artifact evidence above remains carried from its exact
named source state rather than newly executed.
