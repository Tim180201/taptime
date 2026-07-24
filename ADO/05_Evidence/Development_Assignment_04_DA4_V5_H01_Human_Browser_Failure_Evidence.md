# Development Assignment 4 — DA4-V5-H01 Human Browser Failure Evidence

- Status: **FAILED CLOSED — AUTHORITY CONSUMED; NEW HUMAN V5 UNAUTHORIZED**
- Date: 2026-07-24
- Owner: Technical Lead
- Finding: `DA4-V5-H01`, P2, operational/gate reliability

## 1. Exact binding and authority

The counted Human Browser Gate was bound to:

- reviewed Product `f0f1e177628bd763c894a1d9c9c50a70168ffe1f`, tree
  `5259887894a0b97394c748a4556707c6582c93f8`, exact-head CI `30009111061`, attempt 1,
  12/12;
- V5 enablement `e731a7796e0b0710f9df4647c13f03f2862e44c0`, tree
  `6c2b34d303d94957e98f39198e77e2bac1153cd9`, exact-head CI `30022981656`, attempt 1,
  12/12; and
- review archive `24ae57adbd6a1877b7080112cf6940864a2e3fe1`, tree
  `40dd1a328c48676b46934a0095680556d08ef224`, exact-head CI `30024662862`, attempt 1,
  12/12.

The first authorized start attempt did not reach Harness readiness because its startup wrapper
failed. The attempted start was therefore ambiguous, so its authority was treated fail-closed as
consumed. The Human Architect then explicitly authorized one fully fresh replacement run with the
same exact bindings, scope and exclusions. That replacement is the counted run below.

## 2. Passed observations before failure

Fresh preflight passed. Safari then completed the following Human observations against the real
Admin Web and API:

- all five views at 320×800 CSS pixels, with no page-level horizontal overflow; table scrollers
  were intentional section-local controls;
- 768 CSS pixels at 200% zoom and the desktop keyboard pass;
- setup and Employee pagination at `20/1`, and TimeRecord and review pagination at `100/1`;
- invalid fragment handling, back/forward navigation, heading focus and visible keyboard focus;
- one setup read failure followed by successful visible retry;
- visibly declared `Europe/Berlin` timezone behavior;
- one Customer creation and one invitation creation, including one-time invitation-secret
  destruction; and
- the first two irreversible write checkpoints returned `da4_v5_write_checkpoint=match`.

## 3. Fail-closed stop

The Tag reassignment UI displayed exactly:

`NFC-Tag wurde sicher neu zugeordnet.`

Before that exact text was confirmed word for word, the operator/Technical Lead interpreted the
ambiguous Human response `passt` as permission and sent the irreversible Harness checkpoint. The
checkpoint returned only `da4_v5_write_checkpoint=mismatch`; the Harness then automatically
aborted fail-closed and began cleanup.

Therefore:

- the complete Human Browser Gate is **FAILED** and its replacement-run authority is consumed;
- no Chromium/Chrome or Firefox phase, further write, CSV assertion or export occurred;
- no observation from this run may be reused for a later gate;
- no retry, repair or resume is authorized; and
- the mismatch does not prove a Product defect. Because fail-closed cleanup removed the
  disposable state, the exact database dimension that differed cannot be reconstructed.

`DA4-V5-H01` is a P2 operational/gate-reliability finding. It is not evidence of a Security,
Product or data-integrity defect.

## 4. Cleanup and disclosure

Cleanup proved:

- ports `3000`, `5173` and `54321` free;
- zero disposable schema, migration-ledger rows and generated runtime roles;
- no Harness process;
- the private browser session fully closed; and
- clipboard length zero after final cleanup.

After browser closure and before final clipboard deletion, the clipboard contained 36 bytes. Its
content was not read. The length equals the exact 36-byte UI success message above and does not
match the approximately 48-character generated password. The value was deleted during cleanup.
This observation is recorded for disclosure completeness and is not classified as a credential
leak.

## 5. Procedural correction and remaining gate

The runbook now requires, before every irreversible checkpoint: word-for-word Human confirmation
of the required UI success message; read-only Harness status; operator disclosure of the expected
and current result followed by the exact question `Checkpoint ausführen?`; and an explicit Human
`Ja` before sending the checkpoint. Missing or ambiguous confirmation forbids the command. An
already returned mismatch remains an automatic, non-queryable fail-closed abort.

This synchronization and correction are ADO-only AVS R0/V0. Because the correction protects a
closure-significant Human gate, independent review is required before any new exact-bound Human
authorization is prepared.

## 6. Change-Impact and verification record

- Baseline: review archive `24ae57adbd6a1877b7080112cf6940864a2e3fe1`, tree
  `40dd1a328c48676b46934a0095680556d08ef224`, CI `30024662862`.
- Changed boundary: ADO Markdown only; no Product code, schema, dependency, workflow, helper,
  Harness, build or artifact input.
- Risk class: AVS R0; gate significance requires independent review.
- V0: exact owned-file diff/scope, whitespace, reference, authority, disclosure and status checks.
- V1–V4: not run; no executable input changed.
- V5: failed closed as recorded above; authority consumed.
- Carried evidence: the three exact Product/enablement/review bindings in Section 1; none is
  represented as freshly executed by this documentation change.
- Remaining risk: a future operator could prematurely commit a checkpoint until the corrected
  procedure is independently approved and used under a new exact-bound Human authorization.

Production, production data, deployment and distribution remain unauthorized.
