# Development Assignment 4 — DA4-V5-H01 Human Browser Failure Evidence

- Status: **H01 CORRECTION APPROVED; H02 FAILED BEFORE AUTHENTICATION — NEW HUMAN V5 UNAUTHORIZED**
- Date: 2026-07-24
- Owner: Technical Lead
- Findings: `DA4-V5-H01`, P2, operational/gate reliability; `DA4-V5-H02`, P2,
  operator credential-disclosure containment

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

This synchronization and correction are ADO-only AVS R0/V0. Independent exact-SHA review returned
`APPROVED` with zero open P0–P3 review findings. A copy-ready new exact-bound Human authorization
candidate may now be prepared, but no run is authorized.

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
- Remaining risk: the corrected procedure remains operator-dependent; `DA4-V5-H01` remains
  historical P2 until a completely fresh authorized gate passes and receives final review.

Production, production data, deployment and distribution remain unauthorized.

## 7. Independent correction review

Independent review bound candidate `cd5d1e17ed9158592fc40960f9c2b343d0505350`, tree
`c251f7217424d02d9ead8b09033f43c4cc2eccb4`, parent
`24ae57adbd6a1877b7080112cf6940864a2e3fe1`, parent tree
`40dd1a328c48676b46934a0095680556d08ef224`, exact seven-file `+252/-42` ADO delta and
exact-head CI `30078462282`, attempt 1, 12/12.

Verdict: `APPROVED`, zero open P0–P3 review findings. The archived review is
`ADO/05_Evidence/Development_Assignment_04_DA4_V5_H01_Correction_Independent_Exact_SHA_Review.md`.
It authorizes no Human run, production, production data, deployment or distribution.

## 8. Subsequent fresh run: pre-authentication disclosure stop

A later one-time fresh run was additionally bound to H01 final synchronization
`87e617781e5f309751a1fb1fccf5d5cdc29eca3f`, tree
`84e76180d031e85fcf8a7c109f78e82df9670779`, exact-head CI `30079489896`, attempt 1,
12/12. Preflight, Harness readiness and the expected initial safe aggregate passed. At the first
credential check the Harness returned `synthetic_password_binding=match`, but the external
operator PTY wrapper echoed the memory-only synthetic password into operator output. The run
stopped immediately before clipboard transfer, browser submission, authentication or Product
write. No Chrome/Firefox, CSV or export phase ran. The credential is invalid after cleanup and is
not reproduced here.

Cleanup proved zero Harness listeners, disposable schema, migration-ledger rows, generated runtime
roles and credential-clipboard bytes; the private Safari window must be confirmed closed before a
new run. The authority is consumed. This is `DA4-V5-H02`, P2 operational disclosure containment,
not evidence of a Product or Harness defect.

A replacement operator-wrapper pattern was validated outside tracked runtime inputs with PTY output
suppressed from the input-ready marker through the digest result. Five harmless dummy match runs
and one mismatch run showed no dummy-value disclosure; the credential result exposed only the
permitted match/mismatch value. This two-file ADO-only synchronization is AVS R0/V0: no Product,
Harness, runbook, schema, dependency, workflow, helper or artifact input changed; V1–V4 and another
independent review are not required. No new Human V5 is authorized.

## 9. Subsequent fresh stops and DA4-V5-F06

A later separately authorized fresh run stopped at `operator_command_rejected` before any Product
write. Stop and cleanup completed cleanly, no observation is reusable and that run's authority is
consumed.

The next separately authorized fresh run passed two Safari write checkpoints. The reassignment UI
then displayed exactly `NFC-Tag wurde sicher neu zugeordnet.`, and the read-only status showed the
correct general AuditEvent count `105` while the stale Harness invariant expected `104`. No third
checkpoint was sent. The run stopped and completed cleanup cleanly without recording a secret.
The Human gate is failed and its authority is consumed.

`DA4-V5-F06` is the open R3 Harness/accepted-invariant correction: the unchanged secure
reassignment deactivates the prior Assignment and inserts the replacement, producing
`NfcAssignmentDeactivated` plus `NfcTagAssigned`. The Harness and runbook must therefore require
reassignment `+2` and final `initial + 7`; the export subset remains one already-counted general
AuditEvent. The focused candidate passed V1 with 31/31 focused DA4 and 19/19 authoritative C3E2
PostgreSQL tests, V2 with 80/80 complete Synthetic PostgreSQL tests and V3 with 1,827 tests, two
optional B1 Supavisor skips, all 19 typechecks and all 18 builds, followed by complete disposable
cleanup. V4 publication and independent exact-SHA review remain pending. No Product, Business-rule
or schema change, no retry or new Human V5, and no production, production-data, deployment or
distribution authority follows.
