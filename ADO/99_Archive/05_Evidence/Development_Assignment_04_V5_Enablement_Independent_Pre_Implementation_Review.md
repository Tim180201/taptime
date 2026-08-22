# Development Assignment 4 — V5 Enablement Independent Pre-Implementation Review

- Date: 2026-07-23
- Review mode: independent, read-only, exact SHA
- Verdict: **APPROVED — ZERO OPEN P0–P3**
- Publication readiness: **MERGE_READY / EXACT-SHA APPROVED**
- Implementation authority: **NOT GRANTED**

## 1. Exact binding

The reviewer independently verified:

- parent/baseline commit `4594529667fe1570045eea03fd7132bc27e2e479`, tree
  `72338ec9b65dabdd71ab9011604817f61c13c288`;
- candidate commit `5774ab7971f1c5df6834be44ab556c8138cfcf54`, tree
  `062ded6af067967a3019a7d5abe42428ca58af0e`;
- `main` and `origin/main` at the exact candidate;
- GitHub Actions run `30012402185`, attempt 1, successful with 12/12 jobs; and
- exact parent-to-candidate delta: seven ADO Markdown files, `+520/-6`, with no executable,
  schema, dependency, configuration, workflow or artifact-input change.

The reviewed files were:

1. `ADO/README.md`;
2. `ADO/00_Core/Decision_Log.md`;
3. `ADO/00_Core/Project_Status.md`;
4. `ADO/00_Core/Risk_Register.md`;
5. `ADO/02_Development/Development_Assignment_04_V5_Enablement_Authorization.md`;
6. `ADO/04_Operations/Development_Assignment_04_V5_Runbook.md`; and
7. `ADO/05_Evidence/Development_Assignment_04_V5_Enablement_Evidence.md`.

## 2. Independently confirmed repository gap

The review confirmed the candidate's gap against tracked source:

- `apps/synthetic-android-e2e/src/database.ts:498`–`504` seeds exactly the two Customers
  `Synthetic Android Customer` and `Synthetic Reassignment Target`;
- `apps/synthetic-android-e2e/src/main.ts:8`–`30` accepts the current database/password and
  Auth/API ports and exposes the existing operator commands, but no DA4-V5 profile or built
  Admin-Web listener;
- `apps/synthetic-android-e2e/src/SyntheticAndroidE2eEnvironment.ts:66`–`90` exposes only the
  existing environment options and safe aggregate interfaces, while lines `234`–`280` bind the
  current API and existing counters without a DA4 browser fixture;
- `apps/synthetic-android-e2e/README.md:62`–`71` starts Admin Web separately through the Vite
  development server on loopback rather than serving an exact manifest-bound production build;
- `apps/admin-web/src/AdminWebApiClient.ts:107`–`109` and `121`–`128` request setup and Employee
  pages at limit 20, while lines `169`–`195` request TimeRecord and review pages at limit 100;
- `apps/backend-administration/src/AdminWriteSessionCoordinator.ts:406`–`448` builds the shared
  setup cursor with Customers at `kind_order = 0`, Tags at `kind_order = 1`, and orders by
  `kind_order, id`, proving Customer-before-Tag pagination; and
- `apps/admin-web/src/App.tsx:166`–`181`, `237`–`264`, `333`–`336`, `353`–`386`,
  `450`–`455` and `575`–`585` render loaded-versus-complete truth and the real load-more controls.

Consequently, the default two-Customer harness cannot produce all four required initial cursor
boundaries or the complete DA4 Human browser state without a separately reviewed opt-in fixture.
The candidate correctly proposes preparation only; it does not claim that the gap is already
implemented.

## 3. Authorization and architecture review

The reviewer confirmed that the candidate:

- remains subordinate to Human-accepted ADR-0015 and the independently approved DA4 product;
- limits a later implementation to the existing synthetic harness, its focused tests/README and
  truthful ADO evidence;
- keeps Admin Web, backend/API product code, contracts, schema/migrations, dependencies, lockfile,
  CI workflow, Mobile, Android, NFC and ADB unchanged;
- requires an explicit fail-closed opt-in and preserves the default harness profile;
- keeps the fixture authority unreachable from the browser and refuses to count fixture writes as
  Human UI evidence; and
- classifies this ADO delta as R0 while correctly reserving R3 V0–V4 and independent exact-SHA
  review for any later executable enablement.

No Human acceptance, implementation, Human V5, production, production-data, deployment or
distribution authority is implied.

## 4. Runbook and arithmetic review

The reviewer independently checked the complete non-executable runbook and found its measurable
invariants internally consistent:

- shared setup pagination is exactly 20 Customers/zero Tags, followed by one Customer/one Tag;
- Employee and TimeRecord/review pagination are exactly 20/1 and 100/1;
- Assignment history moves from total/active `1/1` to `2/1`, with the first row inactive and one
  exact target cutover;
- the review contemporaneously accepted the then-stated six-row invariant; DA4-V5-F06 later
  established that the six real Admin-Web operations add seven general `audit_events` rows because
  reassignment adds both `NfcAssignmentDeactivated` and `NfcTagAssigned`;
- the single `TimeEntryExportGenerated` row is the export-audit subset and is not double-counted;
- Safari performs Customer/invitation/reassignment, Chromium performs correction/export/
  adjudication, each exactly once and strictly serially, while Firefox and responsive passes remain
  read-only;
- every write has a refresh plus disclosure-safe aggregate stop point;
- fixed public labels/reasons, an isolated Correction target, the one-minute inward adjustment,
  uniquely oldest review target and visible IANA-timezone/DST failure rules prevent operator
  guessing; and
- initial/final aggregate dimensions, loaded-versus-complete truth, section recovery,
  invitation destruction, reload/sign-out and CSV assertions are explicit stop conditions.

The arithmetic produces final projections of 22 Customers, 21 projected Employees, 101
TimeRecords, 100 unresolved reviews, one Tag, two total Assignment rows and one active Assignment,
with the exact named receipt/revision/adjudication/export deltas.

## 5. Security, disclosure and cleanup review

The reviewer confirmed:

- numeric-loopback-only Auth/API/Admin Web ports `54321`/`3000`/`5173`;
- disposable synthetic database and reserved `.invalid` identity boundaries;
- memory-only per-run password digest comparison before every injection, emitting only
  `match`/`mismatch`;
- no password, digest, token, invitation secret, internal ID, NFC payload, CSV body, provider/
  database diagnostic or real-person data in evidence;
- exact production-build manifest binding and same-origin `/v1` forwarding;
- single-use read-only section-failure injection that cannot intercept a write;
- failure/interrupt/ambiguity consumes later run authority without retry, repair or resume; and
- mandatory browser-download/site-data, listener, schema/ledger, generated-role, credential and
  protected-worktree cleanup after success or failure.

## 6. AVS R0/V0 and findings

The reviewer confirmed the seven-file documentation-only classification as AVS-001 R0 and the
reported V0 evidence:

- exact scope and parent/candidate diff;
- no executable or generated-runtime input change;
- clean whitespace/diff check;
- valid ADO references and consistent status/authority language;
- carried product evidence explicitly distinguished from fresh candidate verification; and
- protected `research/` plus untracked `app.json` excluded from inspection and mutation.

Findings:

- P0: 0
- P1: 0
- P2: 0
- P3: 0

No repository modification, staging, commit, push, installation, browser gate or external-state
change occurred during the independent review.

## 7. Verdict and remaining gates

**APPROVED — MERGE_READY / EXACT-SHA APPROVED — ZERO OPEN P0–P3.**

The exact ADO-only candidate is independently approved and publication-ready. This review is not
Human acceptance and grants no executable authority. Before any harness change, the Human
Architect must accept the candidate and separately authorize the R3 implementation on an exact
baseline. That implementation must then pass V0–V4 and independent exact-SHA review before a
separately exact-bound Human V5 may be authorized.

Executable R3 enablement, Human V5, production, production data, deployment and distribution remain
unauthorized.
