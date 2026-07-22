# Development Assignment 3 — V5 Enablement Evidence

- Status: **LOCAL ENABLEMENT CANDIDATE — AVS V0–V3 GREEN; V4/INDEPENDENT REVIEW PENDING; PHYSICAL GATE NOT AUTHORIZED**
- Date: 2026-07-22
- Authorized enablement baseline commit: `0b0d04034c88829fdc5c548b057e74554d4ee197`
- Authorized enablement baseline tree: `eee26501fd714738aa3ca106d93d5088261206e3`
- Risk class: AVS-001 **R3**
- Owner: Technical Lead
- Authorized: focused local DA3 V5 harness/runbook enablement, DA3-V5-F01 correction, regression
  tests, AVS V0–V4 and independent review
- Unauthorized: the Human Physical Gate itself, production, production data, deployment and
  distribution

## 1. Authority and inherited evidence

The Human Architect separately authorized the focused local V5 enablement on the exact baseline
above, including harness, runbook, AVS V0–V4 and independent review. The Human Architect then
explicitly authorized focused finding `DA3-V5-F01` on the same exact baseline: correct the Backend
API export adapter to pass only the three canonical export fields and add regression coverage.

This scope inherits, but does not replace, the independently approved DA3 implementation evidence:
implementation `0f71aca270969866037f2e31cc05ef8730e0ecd1`, tree
`e3e2ed780c217a520d382b98971991510bb99973`, exact-head run `29859522776` 12/12 and independent
review `APPROVED` with zero open P0–P3. The enablement starts from later review-synchronized head
`0b0d040`, tree `eee2650`; `main == origin/main` and the tracked worktree was clean at start.

Untracked user-owned `app.json` and `research/` were preserved. `research/` was not read, listed,
searched or changed.

## 2. Enablement implementation

The candidate:

1. replaces the synthetic harness's DA3 unavailable stubs with the real time-export and time-review
   coordinators on three isolated runtime pools;
2. adds exact identity-resolution plus least-privilege export/read/write role graphs and complete
   cleanup coverage for the generated logins;
3. exposes only safe aggregate counts for revisions, adjudications, export audits and DA3 command
   receipts through the existing loopback operator `status` command;
4. adds a real disposable-PostgreSQL journey covering Employee denial, Administrator correction,
   legacy adjudication, effective CSV and append-only ledger/audit increments;
5. updates the harness documentation to migrations `001`–`012` and the real DA1/DA2/DA3 graph; and
6. adds the candidate-only V5 runbook with exact binding, retain/clear, abort, disclosure and cleanup
   requirements while keeping the physical run closed.

No production configuration, endpoint, credential, personal data, deployment, distribution or
Physical Gate action is introduced.

## 3. DA3-V5-F01 — export adapter exact-shape failure

### Finding

The first real DA3 harness run reached the existing Admin export route but returned disclosure-safe
HTTP 400 `invalid_request`. Direct tracing proved the API validator produces an internal validated
object containing five fields (`expectedMembershipId`, the two canonical timestamps and two epoch
helpers), while `BackendHttpServer` forwarded that full internal object to
`TimeEntryExportCoordinator`. The coordinator correctly revalidates the exact public three-field
shape and therefore rejected every real request. Mock-based API tests asserted only a partial
object and did not detect the extra fields.

Classification: **P1 before correction** because the real Admin Web/API export path was unusable.
The boundary failed closed and disclosed no tenant or row data.

### Authorized correction

`BackendHttpServer` now constructs and freezes a fresh coordinator request containing exactly:

- `expectedMembershipId`;
- `fromInclusive`; and
- `toExclusive`.

The focused API regression now requires deep equality rather than partial matching, and the real
PostgreSQL journey requires a successful CSV over the corrected record. No contract, product rule,
CSV shape, role, pool or export range semantics changed.

## 4. Verification ledger

### Observed feedback before final candidate

- Focused Backend API export regression after correction: **12/12 passed**.
- Synthetic harness tests without the documented database environment variable: **35 passed,
  11 skipped**; explicitly rejected as V1 evidence.
- First database-backed rerun before rebuilding the local workspace package output: **45/46 passed**; the
  stale built Backend API still returned the original 400 and the run was rejected.
- Local `esbuild` initially resolved to a Linux ARM binary on macOS and failed with exit 126.
  `npm rebuild esbuild` repaired only ignored local dependencies; no tracked source or lockfile
  changed for that repair.
- Backend API rebuild plus the exact database-backed rerun: **46/46 passed, zero skips**.
- Synthetic harness tests-inclusive typecheck: passed.
- Synthetic harness build: passed.

### AVS completion state

| Level | State | Evidence |
|---|---|---|
| V0 | Passed | exact baseline/status/authority inventory; changed-file and dependency inventory; `git diff --check`; migrations `001`–`012` unchanged; ADO references resolve |
| V1 | Passed | focused API 12/12; real PostgreSQL harness 46/46 with zero skips; affected tests-inclusive typechecks and builds |
| V2 | Passed | complete schema 128, review 10, export 14, API 224, offline 13, Admin Web 52 and Mobile 421 suites plus affected contracts/harness |
| V3 | Passed | 1,758 tests across all 19 workspaces, two explicit optional B1 skips, all 19 typechecks/builds, migration clean/replay/ledger, Admin Web build, Android export, audit and cleanup |
| V4 | Pending | focused committed head, complete exact-head CI and independent exact-SHA review |
| V5 | **Not authorized** | a later separate exact-artifact-bound Human authorization is mandatory |

No failed or skipped run is counted as successful candidate evidence. This ledger must be updated
with exact final totals, commits, trees, CI and artifact bindings before independent review.

The V3 total is the sum of the independently reported workspace results: administration contract
4; Core 290; offline contract 7; export contract 10; review contract 5; Admin Web 52; backend
administration 121; backend API 224; B1 39; bootstrap 189; identity 55; lifecycle 88; offline
synchronization 13; read model 42; schema 128; time export 14; time review 10; Mobile 421; synthetic
harness 46. B1 alone reports two optional Supavisor-mode skips.

PostgreSQL 17 evidence includes migrations `001`–`012` clean apply, no-op replay and exact ledger,
the full 128-test schema security matrix, all affected DA1/DA2/DA3 suites, and disposal of both
Technical-Lead-created V3 databases. The retained synthetic database has zero `taptime_server`
schemas, zero migration tables, zero generated synthetic runtime roles and zero active connections.
`npm audit` reports the unchanged 11 moderate Expo/Xcode toolchain advisories and zero high or
critical advisories. The lockfile change adds only the four existing local workspace links required
by the harness.

## 5. Current risks and stop condition

- The new physical procedure remains unexecuted; automated evidence cannot substitute for Human
  Web/Android/NFC observations.
- Exact APK/Web/harness artifacts must be generated from and bound to the eventual committed,
  CI-green candidate before any later gate authorization.
- Eleven existing moderate Expo/Xcode toolchain advisories remain separately disclosed; no known
  high or critical advisory is accepted silently.
- DA3 and DT-069–DT-074 remain open. This candidate does not close a roadmap item.

The enablement stops after V4 and independent review. Even an `APPROVED` review does not authorize
the Physical Gate. The next step after approval is a new Human decision quoting the exact approved
source/ADO/CI/artifact bindings and explicitly authorizing one fresh run of the V5 runbook.
