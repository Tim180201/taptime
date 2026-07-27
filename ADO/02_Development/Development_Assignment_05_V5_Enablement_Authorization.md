# Development Assignment 5 — V5 Operational Enablement Authorization Candidate

- Status: **FINAL VALIDATION QUERY-VISIBILITY CORRECTION PUBLISHED/CI-GREEN AND REPLACEMENT ARTIFACT VERIFIED; INDEPENDENT EXACT-SHA RE-REVIEW PENDING; TWO PHASE-0 AUTHORITIES CONSUMED FAIL-CLOSED BEFORE ANY TAG SCAN; NO CURRENT PHASE-0/HARDWARE/ADB/INSTALLATION OR HUMAN-V5 AUTHORITY**
- Date: 2026-07-27
- Candidate baseline commit: `7fe725360935a5d9587e3dfbdb2789d8309342df`
- Candidate baseline tree: `0abaa77443a2abf81fd815ec138776155188bfc0`
- Reviewed Product source/lock commit: `a323834f51607841d0cd5f11aafdbfd3dd93ed5f`
- Reviewed Product source/lock tree: `65c669b0a941c21d23ffca5e79fa03285323a7cf`
- Product Exact-Head CI: `30149165373`, attempt 1, 12/12 successful
- Reviewed artifact/evidence commit: `e6a06e2ec8f580d6314bfe5a51378f949d524b16`
- Reviewed artifact/evidence tree: `6dcdce405feb2eccb1462c373ab6be891152715c`
- Artifact/evidence Exact-Head CI: `30150095109`, attempt 1, 12/12 successful
- Validation correction review baseline: `be32840`; round-1 Exact-SHA review
  `CHANGES REQUIRED` for P1 package visibility and P3 stale Runtime-Guard navigation
- Validation intermediate correction: `0f7e131`; real build stopped before publication on the
  over-strict HTTPS-query verifier; no artifact published
- Validation final correction source: `5c239b1c30c6263a036077460e23373b767f66df`,
  tree `53e8d4ed012ccc662f1005f895a3b6e685cf560e`
- Validation final correction Exact-Head CI: `30276804017`, attempt 1, 12/12 successful
- Validation final correction independent Exact-SHA re-review: **PENDING**
- Isolated-PostgreSQL round-2 candidate: `7739757a4855ee7bac34408941e94c25516d75f5`
- Isolated-PostgreSQL round-2 tree/parent: `0398066e92fef65562526f61c9515b0ef3be0114` /
  `72fbd3c20329dfbf3e8a1509025bd630b1bb130a`
- Isolated-PostgreSQL round-2 Exact-Head CI: `30177897059`, attempt 1, 12/12
- Isolated-PostgreSQL round-3 candidate: `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`
- Isolated-PostgreSQL round-3 tree/parent: `dfb5abbca1f2ddf603d191ae3303d1336f5440c7` /
  `7739757a4855ee7bac34408941e94c25516d75f5`
- Isolated-PostgreSQL round-3 Exact-Head CI: `30185670176`, attempt 1, 12/12
- Isolated-PostgreSQL round-3 review: `CHANGES REQUIRED`, exactly two P1 and zero P0/P2/P3
- Human extra-round authority: exactly one additional focused ADO correction/review round beyond
  the three-round limit, limited to those two P1; no implementation/hardware authority
- Isolated-PostgreSQL extra-round candidate: `43567d256e8f633f16866448e1fb5abbd8022733`
- Isolated-PostgreSQL extra-round tree/parent: `feecced92abe9fc536a2db052b5a616d3e0f1cf7` /
  `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`
- Isolated-PostgreSQL extra-round Exact-Head CI: `30186846379`, attempt 1, 12/12
- Isolated-PostgreSQL extra-round review: `CHANGES REQUIRED`, exactly one P1 and zero P0/P2/P3;
  initdb P1-B closed
- Human last-round authority: the second local administrator and exact complete decision-time
  local macOS admin-group membership snapshot are trusted under Option A; exactly one last focused ADO
  correction/review round limited to the remaining P1; no implementation/hardware authority
- Human-approved decision-time group snapshot: exactly two direct members, zero nested groups;
  full-record SHA-256 `b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`;
  membership SHA-256 `70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064`;
  combined snapshot SHA-256 `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`
- Human Option-A cleanup-threat selection: **OPTION A — exclusive trusted single-user operator
  session with the exact decision-time admin-group membership snapshot trusted; hostile/malicious
  same-UID or exact-bound trusted-member processes and mount/unmount churn outside the threat model**
- Owner: Technical Lead
- Decision authority: Human Architect
- Risk class: current truth synchronization **R0**; completed executable preparation **R3**

## 0. Current closure and stop boundary

The detailed sections below preserve the pre-implementation design and review history. Current
repository truth is later and stopped before any further hardware action:

- Runtime Guard source `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867`, tree
  `980b6c57fdd71c12820f2890b640946db0d883c6`, CI `30255104609`, attempt 2,
  12/12. Attempt 1 was only a B5 Docker-Hub pull timeout before checkout. Its immutable binary
  and manifest plus focused evidence received independent Exact-SHA `APPROVED` with zero open
  P0–P3.
- Round-1 Exact-SHA review of `be32840` returned `CHANGES REQUIRED`: P1 required Samsung
  package visibility and P3 required the stale Runtime-Guard navigation row to be corrected.
  Intermediate `0f7e131` added the exact Google/Samsung source manifest and verifier and corrected
  P3. Its real build then stopped before publication because the verifier rejected Expo's
  existing HTTPS query intent; no artifact from that stopped publication exists. Final correction
  `5c239b1c30c6263a036077460e23373b767f66df`, tree
  `53e8d4ed012ccc662f1005f895a3b6e685cf560e`, binds exactly one queries block, the two
  TalkBack package queries, one exact `VIEW` + `BROWSABLE` + `https` intent and zero providers.
  Exact-head CI `30276804017`, attempt 1, passed 12/12. The replacement 65,734,361-byte `0444`
  APK (`c87b2e2b804a3db7…24af95db`) and 6,700-byte `0444` manifest
  (`5c6ea1bc5d0f6d7d…d8fd74fb`) passed the official verifier. Exactly one provider must be
  installed and active from the Google/Samsung allowlist; none or both fail closed. Independent
  Exact-SHA re-review remains pending and no approval is claimed.

Two earlier one-time Phase-0 authorities are consumed. Run 1 stopped before Product action because
a Validation package was already installed. Run 2 stopped before installation or NFC because the
then-current build supported only Google while Samsung TalkBack `15.1.01.1` was active. Cleanup
confirmed package zero and zero reverse mappings after each run; no Tag was scanned. No further
hardware, ADB or installation action is authorized or run on the corrected artifact. Another
Phase 0 requires a fresh explicit one-time Human authorization limited to the exact replacement
Validation APK, Galaxy A33, read-only A/B/X Tag binding, device/accessibility binding and complete
uninstall/cleanup. Product APK installation and Human V5 remain later separate gates. Production,
production data, system changes, deployment and distribution remain unauthorized.

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

## 2. Historical enablement scope and current implementation block

This section preserves the already reviewed enablement boundary. It is not current implementation
authority. The PostgreSQL ownership/process/cleanup correction is narrowed by
`ADO/02_Development/Development_Assignment_05_V5_Isolated_PostgreSQL_Correction_Authorization.md`,
including exactly one native Runtime Guard source and exact TS wrapper/tests. The Human Architect
selected Option A: one exclusive trusted single-user operator session, with hostile or malicious
same-UID processes and mount/unmount churn outside the threat model. The Human Architect now also
confirms that the second local administrator and exact complete decision-time local macOS admin-
group membership snapshot are trusted for that local Option-A Harness; hostile/malicious processes of
an exact-bound trusted member are likewise outside the threat model. That trust is frozen to the
decision-time counts and three V1 digests above, not to a later-current directory-service state.
Future R3/preflight must recompute all three and both counts before capability/task-root creation
and every trust use. Any mismatch returns to the Human Architect; dynamic re-acceptance, anchor
update or rebinding is forbidden.

That selection resolves only the policy question and grants no implementation authority. The
Human Architect authorized exactly one last focused ADO correction/review round limited to the
single P1 left by the extra-round review; initdb P1-B is closed. That exception also grants no
implementation or hardware authority. Only after the seven-file last-round synchronization is
focused-published, bound to exact commit/tree and successful exact-head CI, and receives
independent Exact-Delta `APPROVED` with zero open P0–P3 may the `AGENTS.md` standing rule apply to
the exact later correction scope. The broader historical enablement boundary remains:

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
   model/OS/build, supported Tag technology, distinct safe fingerprints, font scale and the exact
   installed/active TalkBack provider package plus version. The only allowed provider packages are
   `com.google.android.marvin.talkback` and
   `com.samsung.android.accessibility.talkback`; exactly one must be active, while none or both
   fail closed. It performs no Product action, database write or gate observation and ends with
   zero package/mapping/listener residue. Failure or ambiguity consumes only that preflight
   authority; no result except the exact binding values is reusable;
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
    installed/active allowlisted TalkBack package name and version and DA5-P09's exact
    `font_scale=2.0`/200-percent setting. Device values are learned only during the separately
    authorized read-only preflight; the Human must still inspect every DA5-P09 surface at the
    exact final-run setting;
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

### Current ADO-only last-round draft

- Risk: AVS-001 R0.
- Baseline: extra-round `43567d256e8f633f16866448e1fb5abbd8022733`, tree
  `feecced92abe9fc536a2db052b5a616d3e0f1cf7`, parent `bbcb1b5`, exact-head CI
  `30186846379`, attempt 1, 12/12; Exact-Delta review verdict `CHANGES REQUIRED` with exactly one
  P1 and zero P0/P2/P3; initdb P1-B closed. Round-3 `bbcb1b5`/tree `dfb5abb`/CI `30185670176`
  and round-2 `7739757`/tree `0398066`/CI `30177897059` remain historical truth.
- Changed boundary: exactly the seven ADO files enumerated by the isolated-PostgreSQL correction
  authorization; no executable/artifact input.
- Required: V0 exact diff/file list, whitespace, references, authority/status and protected-path
  checks plus exact Option A truth: one exclusive trusted operator session with the exact complete
  decision-time local macOS admin-group snapshot trusted, and hostile/malicious same-UID or exact-bound
  trusted-member processes plus mount/unmount churn outside the threat model; exact Human
  authority for one last focused correction/review round; disclosure-safe immutable sorted UID/
  GUID/group-record and complete-membership manifest binding to exactly two direct members, zero
  nested groups and exact decision-time full-record
  `b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`, membership
  `70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064` and combined snapshot
  `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217` SHA-256 anchors;
  exact-decision-time-admin/Cellar-`0775` positive and later-current rebind, anchor/count mismatch,
  group substitution/member-change/foreign-group/binary-write/world-write/mode/ACL/symlink/swap
  negative future R3 cases; retained non-reaping initdb leader handling; no system, account, group,
  membership, permission or Homebrew mutation.
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
  signal/failure and cleanup regressions plus tests-inclusive typecheck; isolated-PostgreSQL
  correction additionally requires one-time Guard artifact-production/toolchain poisoning,
  Exact-SHA manifest, no-operational-compiler, PTY/session/protocol/initdb-group and cleanup-race
  tests from its governing authorization.
- V2: complete synthetic-harness suite/typecheck/build; focused Backend API, Backend Mobile Work,
  administration, lifecycle, offline and Mobile composition/install-disconnect boundary
  regressions where the final diff proves transitive impact.
- V3: one final complete locally executable repository regression, all applicable tests-inclusive
  typechecks/builds, clean PostgreSQL migration/replay/ledger, Android export and immutable
  APK revalidation, plus one final read-only Guard binary/manifest produced from the exact
  implementation SHA and bound by size/SHA/mode/architecture/load dependencies/toolchain/source/
  SDK/OS.
- V4: one focused publication, complete exact-head GitHub Actions matrix and independent exact-SHA
  implementation/Guard-artifact review with zero open P0–P3.
- V5: not run and not authorized; stop immediately before USB/device/Tag interaction.

Any R3 correction repeats the affected V1/V2 and one final V3/V4 before re-review. Verification
depth may not be reduced to save time or quota.

## 7. Required independent reviews and stop condition

Required sequence:

```text
extra-round CHANGES REQUIRED truth (one P1; initdb P1-B closed)
  + Human-selected exact Option A/group snapshot + Human-authorized one last ADO round
  + remaining-P1 last-round ADO synchronization + V0
  -> focused publication / exact candidate commit and tree binding
  -> successful exact-head CI
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

Option A with the exact current local admin-group membership snapshot is selected and exactly one
last focused ADO correction/review round is Human-authorized, but the current unbound
synchronization has no independent approval and no implementation authority. Focused publication,
successful exact-head CI and independent
Exact-Delta `APPROVED` with zero open P0–P3 remain mandatory before only the exact R3 scope can
activate under the `AGENTS.md` standing rule. No Human/hardware action is authorized by this
candidate. The Technical Lead must tell the Human Architect explicitly **“Jetzt Handy
anschließen”** only after every preceding arrow is complete and must provide one copy-ready
exact-bound one-run authorization. Production, production data, deployment and distribution
remain unauthorized.

Before that handoff, the DA5 runbook/evidence must be synchronized to the exact reviewed Guard
binary/manifest path, size, SHA-256, mode, architecture, load dependencies, toolchain/source/SDK/OS
provenance and review verdict. The runbook may verify and execute that artifact only; it must not
compile, relink, replace or repair it.

## 8. Candidate review history

The independent read-only review of candidate commit
`6112e10b49ea1f66004dc515234be8d38d12575c`, tree
`e7622553c148f587a48b8fabe68830472e405d29`, exact-head CI `30159661549`, attempt 1,
12/12 successful, returned `CHANGES REQUIRED` with only P2 `DA5-V5-REV-01`. The corrected
candidate `cddb66d82047284c72688cc90a7491af761b8791`, tree
`8cda19f8df42febb34a03a4db4911d5ea8acae79`, passed exact-head CI `30159987539`,
attempt 1, 12/12; independent exact-delta re-review returned `APPROVED` with zero open P0–P3.
The correction replaces persisted-WorkEvent-age readiness with the memory-only
fresh-server-clock baseline above and removes the unreachable elapsed check before Tag B's first
action.

The enablement implementation was published as
`15f43b1b05e136e0d6643b1f10c1fc8310cfa838`, tree
`ed1e55c08dd13392f6f72bcf9265cdfaf547fa72`, and passed exact-head CI `30165425892`,
attempt 1, 12/12. Formal Exact-SHA review round 1 returned `CHANGES REQUIRED` with four P1, two
P2 and one P3. Subsequent specialist audits additionally found sticky reverse-cleanup uncertainty
(P2), productive artifact/FD, binary-digest, stdin-runner-close and installed-package-path
verification gaps (P2), and legacy PostgreSQL provisioner preflight/scoped-removal/password-state
defects (P1/P2). The then-current round-1 correction candidate passed Mobile focus 77/77 and
complete Mobile 542/542; real-PostgreSQL preservation passed 4/4, the normal success path passed 3/3 and
complete Synthetic passed 161/161. Both
tests-inclusive typechecks, the Synthetic build, changed-MJS syntax checks,
immutable-artifact/no-install preflight, scoped diff-check and final PostgreSQL null-state proof
passed. The first attempted complete invocation remained incomplete only because its operator
environment pointed `backend-mobile-work` at the fresh empty task-owned `taptime_da3`. After
correcting only that invocation environment and making no code change, a full fresh invocation
completed green: 21/21 workspace suites passed with 2,063 tests and exactly two optional B1
Supavisor skips, 21/21 tests-inclusive typechecks and 20/20 applicable builds passed, migrations
001–013 passed clean apply/replay/ledger verification on PostgreSQL 17.10, C3B `verify-bin`
passed, Mobile test sources were included 39/39 by `tsc --listFilesOnly`, Android export completed
with 861 modules and the immutable-artifact/no-install preflight matched. Cleanup removed
task-owned `taptime_da3` and temporary export data; the DA5 Harness end state was
`0|false|false|false` for generated roles, schema, ledger and Legacy Guard DB, with no listeners
on ports 3000/54321. The incomplete invocation was an operator-environment issue, not a Product
defect.

The round-1 correction was then published as
`a73173a0abe893c80f97b151262b18aa92b5bff5`, tree
`028e48247620c3d271f1dec04dbdcc83ab28c251`, and passed exact-head CI
`30169277329`, attempt 1, 12/12. Formal review round 2 returned `CHANGES REQUIRED` with exactly
two P1 findings against the Legacy PostgreSQL provisioner quarantine/session barrier and
dependency-safe cleanup boundary, plus one P3 finding against stale ADO navigation/status truth.
The uncommitted Shared-Cluster follow-up then specified the exact `NOLOGIN`/password-null
quarantine before any destructive transaction, failed closed on a fresh exact-role-OID activity
and granted-`virtualxid` census before every destructive step, and used namespace-wide dependency
proofs with `RESTRICT` cleanup. Focused red regressions reproduced both P1 defects 2/2; the
corrected Legacy preservation/concurrency boundary passed 7/7, the DA5 least-privilege success
boundary passed 3/3 and complete Synthetic passed 164/164. The tests-inclusive Synthetic
typecheck, explicit test-source inclusion proof and Synthetic build passed. Full V3,
Technical-Lead acceptance, a committed SHA/tree and Exact-Head CI binding, and formal review
round 3 remain pending; no follow-up approval is claimed here.

A subsequent precommit PostgreSQL safety audit found additional Role-OID ABA, DA5 preparation
TOCTOU/adoption, cleanup ownership/fingerprint/atomicity and real-PostgreSQL proof gaps in that
uncommitted follow-up. That later Shared-Cluster WIP revalidated exact role OID/state while holding
a fixed PostgreSQL-17 catalog-lock set before quarantine and destructive mutation; performed DA5
preparation by explicit creation only inside one migration-locked/catalog-locked transaction
after exact absence proofs; and permitted cleanup only for the immutable prepared profile and
matching catalog-derived ownership fingerprint inside one rollback-safe transaction. A safe new
red regression reproduced the cleanup profile mismatch 1/1 before correction. Corrected focused
Legacy preservation/concurrency passed 14/14, ownership-bound cleanup passed 9/9, the DA5
least-privilege success boundary passed 3/3 and complete Synthetic passed 180/180. The
tests-inclusive Synthetic typecheck, explicit 9/9 test-source inclusion proof, Synthetic build,
scoped diff-check and final PostgreSQL `0|false|false|false` null-state proof passed. Local
PostgreSQL 17 uses host `trust`, so the raw-protocol authentication-boundary regression exercised
its authenticated-role branch; the implemented SASL/hidden-startup-VXID branch was not locally
exercised. Full workspace V3, Technical-Lead acceptance, a committed SHA/tree and Exact-Head CI
binding, and formal review round 3 remain pending; no follow-up approval is claimed here.

The entire Shared-Cluster follow-up above is now `BLOCKED`, is not Candidate Evidence and is not
the current green path. Its focused 180/180 Synthetic result remains a historical WIP observation
only.

The first isolated-PostgreSQL authorization candidate was published at
`72fbd3c20329dfbf3e8a1509025bd630b1bb130a`, tree
`dda615edd2e91c6b4d50bf979386937a9f3d249f`. CI `30176432929`, attempt 2, passed 12/12; attempt 1
timed out while pulling the Docker Hub image before checkout and tested no repository source.
Independent candidate review returned `CHANGES REQUIRED` with five P1, one P2 and one P3.

Round-2 correction candidate `7739757a4855ee7bac34408941e94c25516d75f5`, tree
`0398066e92fef65562526f61c9515b0ef3be0114`, exact parent `72fbd3c`, passed exact-head CI
`30177897059`, attempt 1, 12/12. Its technically enforced read-only Ultra re-review returned
`CHANGES REQUIRED` with exactly five P1, one P2 and one P3: `detached=false` terminal/process-group
signal bypass; non-terminal compiler/helper/initdb hang cleanup; incomplete
compiler/toolchain/environment trust; source-inode/no-replace rename weakness; destructive
same-UID stat-to-unlink TOCTOU; incomplete one-file review prompt; and stale Decision Log/ADO
navigation.

The round-3 ADO draft replaces the helper/process model with one native Runtime Guard compiled and
tested once during the future R3 software phase, fixed read-only with an Exact-SHA manifest and
only verified—not compiled—by later operational/hardware runs. It defines a separate POSIX
session/process group, private-pipe-only Node control, bounded artifact-producer/initdb
termination, closed trusted toolchain/runtime environments and strongest-platform no-replace plus
descriptor/mount checks. It truthfully records that POSIX has no portable inode-conditional
unlink. The Human Architect selected Option A: one exclusive trusted single-user operator
session, with hostile/malicious same-UID processes and mount/unmount churn outside the threat
model. The selection grants no independent `APPROVED` or implementation authority. Focused
publication, successful exact-head CI and independent zero-finding approval remain pending; no
installation, ADB, device/Tag or Human/hardware authority exists.

Focused round-3 candidate `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, tree
`dfb5abbca1f2ddf603d191ae3303d1336f5440c7`, exact parent
`7739757a4855ee7bac34408941e94c25516d75f5`, passed exact-head CI `30185670176`, attempt 1,
12/12. Independent read-only review returned `CHANGES REQUIRED` with exactly two P1 and zero
P0/P2/P3: PostgreSQL 17.10 Homebrew binaries and their complete canonical ancestor chains must
accept root or exact captured same-EUID ownership under Option A while rejecting writable/ACL-
unsafe/unstable identities, and initdb must retain its leader unreaped through every possible
negative-PGID signal. The Human Architect authorized exactly one additional focused ADO
correction/review round beyond the three-round limit, limited to those two findings. Focused
extra-round candidate `43567d256e8f633f16866448e1fb5abbd8022733`, tree
`feecced92abe9fc536a2db052b5a616d3e0f1cf7`, exact parent
`bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, passed exact-head CI `30186846379`, attempt 1,
12/12. Its Exact-Delta review returned `CHANGES REQUIRED` with exactly one P1 and zero P0/P2/P3:
the current same-EUID-owned Homebrew Cellar ancestor is observed at `0775`, so blanket group-write
rejection is unusable and the exact trusted group plus complete membership snapshot were not
bound. The review explicitly closed initdb P1-B.

The Human Architect confirms that the second local administrator and exact complete current local
macOS admin-group membership snapshot are trusted under Option A and authorizes exactly one last
focused ADO correction/review round limited to the remaining P1. The last-round draft binds that
group and membership disclosure-safely to the decision-time V1 snapshot: exactly two direct
members, zero nested groups, full-record digest
`b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`, membership digest
`70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064` and combined snapshot
digest `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`. It accepts only exact
same-EUID/exact-group/exact-mode ancestor group writability, preserves canonical binary mode
`0555`, rejects later-current rebinding and all other group/world write or group/member/mode/ACL/
symlink/swap drift, and performs no account/group/membership/ownership/permission/Homebrew/system
mutation. It remains R0, unbound and not independently approved; no implementation, installation,
ADB, device/Tag or Human/hardware authority exists.
