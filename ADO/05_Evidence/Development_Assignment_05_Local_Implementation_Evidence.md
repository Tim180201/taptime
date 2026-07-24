# Development Assignment 5 — Local Implementation Evidence

- Date: 2026-07-24
- Baseline commit: `fb32a2796e78c78ce12f856c908545de7ce7bf99`
- Baseline tree: `53d6b5d6c2c86a8a3245539d821a12fae6850673`
- Candidate phase: the Development Agent completed the local working-tree delta without committing
  or publishing it; the subsequent Technical-Lead publication establishes the exact candidate
  commit and tree used for V4 and independent review
- Risk: AVS-001 R3
- Authority: Human-accepted ADR-0016/ADR-0017 Workstreams A–F through local V0–V3, followed by
  Technical-Lead acceptance, focused publication, exact-head V4 and independent exact-SHA review
- Development-Agent exclusions: commit, push, publication, V4, independent review, installation,
  ADB/device/Tag use, Human V5, signing, production, production data, deployment and distribution

## Change-Impact Record

The candidate changes the following connected boundaries:

- Core WorkTarget and NFC/manual trigger unions while retaining server-only Start/Stop decisions;
- migration `013`, tenant-qualified Customer/Project/General Work identity, Project administration,
  immutable trigger provenance and least-privilege roles/functions;
- additive manual lifecycle, Mobile own-time/manual-target and Project administration coordinators;
- additive offline lease/manifest/provenance v2 plus Mobile encrypted SQLite schema v3 while
  retaining v1 evidence and exact FIFO ordering;
- additive Admin time/review and CSV v2 target/provenance truth while retaining Customer-only CSV
  v1 bytes and failing non-Customer v1 ranges closed;
- strict Backend API routes, composition, parsers and safe diagnostic handling;
- narrow Android `ACTION_TECH_DISCOVERED` configuration, consume-once native NFC ingress, atomic
  native clock sampling and exclusive capture ownership;
- role-safe Mobile product navigation, manual capture, own time and synchronization screens;
- Admin Web Project administration and generalized time/review presentation; and
- workspace metadata, the root lockfile and the minimum CI dependency/test steps for the new
  internal workspaces.

The confirmed R3 correction round narrows native ingress to lifecycle ownership and exact
NTAG213-v1 technologies, strips all Android NFC references on every technology-intent exit,
exposes only leased Manual plus Scan/Sync in the offline shell, adds deterministic safe own-time
load-more/timezone truth, and correlates pending manual events with exact scheduler decisions
before refreshing own-time.

The authoritative exact file inventory is the tracked `git diff --name-only` plus the scoped
untracked inventory from:

```text
git ls-files --others --exclude-standard -- apps packages ADO
```

No `research/` access occurred. The protected root untracked `app.json` was not read or changed.
No existing migration `001`–`012`, production configuration or unrelated user file was modified.
The CI workflow changed only to build/typecheck/test the new Mobile-work workspaces in the
existing applicable jobs and to name the dynamically applied migration range truthfully as
`001`–`013`.

## Implemented truth

- Every Organization has one immutable built-in General Work target; Customer IDs remain stable;
  Projects are independent Organization targets with bounded create/list/deactivate authority and
  active-TimeEntry deactivation protection.
- NFC and manual triggers share the unchanged server Business Engine and five-second
  per-User/WorkTarget dedupe. The caller never selects Start or Stop.
- WorkEvents and canonical TimeEntries retain exact NFC/manual provenance, including mixed
  lifecycle truth; recovered records retain null trigger provenance.
- Online manual capture uses the first database transaction timestamp. Offline manual and NFC
  evidence share one durable owner-bound FIFO and device sequence.
- V1 protected offline evidence remains readable and routable through v1. Additive v2 leases and
  commands use the accepted discriminated item/trigger unions and manifest/content-hash versions.
- Mobile own-time is self-only and effective; manual targets contain only safe active target
  identity/type/display data. Admin time/review and CSV v2 expose generalized target/provenance
  truth without broadening correction authority.
- The Android ingress is UID-only, consume-once and exclusive. It does not claim locked-screen,
  force-stop bypass, universal dispatch, NDEF identity or background-service behavior.

## Verification Summary

### V0

- `HEAD` and `origin/main` both resolved to the exact baseline commit; `HEAD^{tree}` resolved to the
  exact baseline tree.
- `git diff --check`: passed.
- Tracked and scoped untracked inventories were inspected with protected untracked paths excluded.
- Dependency inventory: `npm ls --all --depth=0` passed.
- `.github/workflows/ci.yml` parsed successfully as YAML after the focused dependency-step change.
- Disposable DA5 PostgreSQL databases were explicitly named, checked before creation and removed;
  a final catalog query returned none of them.

### V1 and V2

Focused contract, Core, migration, PostgreSQL, API, offline, lifecycle, export, review, Admin Web,
Mobile coordinator/runtime/native-ingress/plugin and presenter tests passed during implementation.
Notable complete affected results included:

- Core: 43 files, 290 tests.
- Backend schema/security: 1 file, 128 tests.
- Backend lifecycle: 1 file, 90 tests.
- Backend administration: 3 files, 121 tests.
- Backend offline synchronization: 2 files, 14 tests.
- Backend API: 9 files, 234 tests.
- Backend TimeEntry export: 2 files, 15 tests.
- Backend time/review: 1 file, 11 tests, including real PostgreSQL Project/manual provenance.
- Admin Web: 7 files, 87 tests.
- Mobile: 36 files, 453 tests.

### V3

Environment:

- Node.js `v24.17.0`
- npm `11.13.0`
- PostgreSQL `17.10` on numeric loopback

Complete local candidate result:

- all 21 workspace test suites executed;
- 1,896 tests passed;
- two B1 Supavisor integration tests skipped by their existing optional environment gate;
- all 21 workspace typechecks passed;
- all 20 applicable workspace builds passed;
- the changed test workspaces use test-inclusive TypeScript configurations; Mobile
  `tsc --listFilesOnly` proved inclusion of all 36 Mobile test files;
- migrations `001`–`013` applied to clean PostgreSQL, replayed with no new application and passed
  migration-ledger verification;
- the C3B built CLI passed `verify-bin`;
- `npx expo export --platform android` passed and bundled 861 modules into an isolated temporary
  export; no APK was built, installed, signed or distributed; and
- all task-owned disposable PostgreSQL databases were removed.

After the confirmed R3 corrections, exactly one fresh complete V3 was executed with the counts and
all-green result above. Its initial workspace aggregate reached B1 without the required local
environment variables, and the first focused continuation still omitted `B1_RUNTIME_PASSWORD`;
neither attempt collected a test. The exact B1 suite then continued with all three required local
variables and passed 39 tests with its two existing optional Supavisor skips. Previously completed
workspaces were not redundantly rerun. The final ADO synchronization is R0 over that unchanged
executable/workflow candidate.

## Failures and retries

- The first Backend API v2 typecheck exposed a TypeScript generic inference ambiguity between v1
  and v2 read projections. The handler branches were made explicit; the final typecheck passed.
- Early focused generalized time/review PostgreSQL fixture attempts exposed, in order, the absent
  default `taptime_da3` database, the existing deferred Decision/TimeEntry foreign-key lifecycle,
  a missing explicit `started` status and an active-entry conflict in test setup. The regression
  was corrected to use a disposable database, two canonical lifecycle transactions and a separate
  seeded User; the complete final suite passed 11/11.
- The first repository build exposed an unhandled additive `mobile_work_failed` diagnostic in the
  synthetic Android harness. The exhaustive safe-event mapping was added; the final repository
  typecheck and all 20 applicable builds passed.
- The first Synthetic Android E2E attempt used a disposable database name rejected by the harness'
  exact safety validator. It produced 77 passing tests, 13 gated skips and two setup-suite
  failures before Product execution. The unchanged source was rerun against the mandated existing
  `taptime_synthetic_android_e2e` test database and passed 90/90.
- The first combined final artifact-validation command invoked the root-relative CI path while its
  working directory was `apps/mobile`; C3B `verify-bin` had already passed, while YAML validation
  failed with `ENOENT` and Android export did not start. Repeating the two unexecuted checks with
  the correct `../../.github/workflows/ci.yml` path passed YAML validation and Android export.

No failed assertion remains open.

## Remaining gates and risks

- V4 was not run in the Development-Agent phase. The Human-authorized Technical-Lead sequence
  permits focused publication and exact-head V4 after local inspection and acceptance.
- Independent implementation review has not occurred.
- Human Android V5, real-device NFC/Tag dispatch, accessibility observation, process restart and
  controlled offline/online physical paths were not run and remain separately authorized gates.
- Exact Android vendor/Tag routing remains a Human-qualified best-effort matrix as specified by
  ADR-0017; automated source tests and Android export do not replace it.
- Production, production data, legal/privacy approval, signing, deployment and distribution remain
  unauthorized.

The next required action is Technical-Lead inspection of the exact local delta, followed by a
focused publication, complete exact-head V4 and independent exact-SHA implementation review.
