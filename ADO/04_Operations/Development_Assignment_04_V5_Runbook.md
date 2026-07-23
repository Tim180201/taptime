# Development Assignment 4 — V5 Human Browser Gate Runbook

- Status: **TECHNICALLY READY — HUMAN V5 NOT AUTHORIZED**
- Date: 2026-07-23
- Owner: Technical Lead
- Approval authority for any run: Human Architect

## 1. Purpose and authority

This runbook prepares one fresh Human functional, visual and browser observation of the
independently approved DA4 Admin Web. It is browser-only. It requires no Android device, NFC Tag,
APK, ADB or physical setup.

Fixture implementation completed R3 V0–V4. Correction `e731a77`, tree `6c2b34d`, passed
exact-head CI `30022981656`, attempt 1, 12/12, and independent review round 2 returned `APPROVED`,
`MERGE_READY / EXACT-SHA APPROVED` with zero open P0–P3. This document does not authorize a Human
run. A later run requires a separate Human authorization binding the exact product, enablement,
evidence, review, Admin-Web build and browser environment.

## 2. Fixed local boundary

- Use only numeric loopback: Auth `127.0.0.1:54321`, API `127.0.0.1:3000`, Admin Web
  `127.0.0.1:5173`.
- Use only the disposable `taptime_synthetic_android_e2e` database, reserved `.invalid`
  Administrator email and freshly chosen synthetic per-run password.
- Use the exact manifest-bound production build of the reviewed Admin Web. Do not substitute a dev
  server, another build, remote asset, LAN host, tunnel, cloud service or production resource.
- Record only exact source/build/browser bindings, public synthetic labels, safe UI states,
  aggregate counts and `match`/`mismatch` results.
- Do not record passwords, digests, access/refresh tokens, invitation secrets, internal IDs,
  database/provider diagnostics, CSV bodies or real-person data.
- Do not access `research/`. Every worktree command must explicitly exclude it, for example
  `git status --short --untracked-files=normal -- . ':!research'`.
- A failed, interrupted or ambiguous run consumes its authority. No retry, repair, resume or
  evidence reuse is allowed.

## 3. Mandatory exact binding and credential control

Before a later run, record and independently verify:

1. reviewed product commit/tree and product exact-head CI;
2. enablement, evidence and independent-review commits/trees plus every required exact-head CI;
3. exact built Admin-Web artifact inventory, byte sizes and SHA-256 manifest;
4. Node/PostgreSQL versions and current stable Safari, Chromium and Firefox versions; and
5. a separate Human authorization quoting those exact bindings and authorizing one fresh run.

The per-run password remains memory-only. At harness start, bind the supplied byte sequence to a
SHA-256 digest held only in the live operator-session state. Before every password injection:

1. hash the proposed input in memory;
2. compare it to the live digest;
3. output only `synthetic_password_binding=match` or
   `synthetic_password_binding=mismatch`; and
4. inject or submit only after exact `match`.

A missing state or mismatch fails before authentication. Fixed `.invalid` emails are entered
directly and must never mutate the credential clipboard. Field length or visual appearance is not
credential evidence.

## 4. Fresh preflight and exact fixture

1. Verify exact repository/build bindings and a clean tracked worktree with the protected-path
   exclusion.
2. Require ports `54321`, `3000` and `5173` free; no browser session may contain retained DA4 local
   data or download.
3. Start the reviewed opt-in `da4-v5` profile. Require readiness for exactly the three loopback
   listeners and no other interface.
4. Require the disclosure-safe fixture invariant:
   - 21 Customer summaries, one safely labelled Tag, total Assignments `1` and active Assignments
     `1`;
   - 21 projected Employee Memberships;
   - 101 stopped effective TimeRecords inside the current 31-day window;
   - 101 unresolved ordered review items;
   - zero active invitation; and
   - zero V5-operator receipts/audits for Customer, invitation, reassignment, correction,
     adjudication and export.
5. Require the exact public test manifest:
   - new Customer: `DA4 V5 Browser Customer`;
   - invitation display name: `DA4 V5 Browser Employee`;
   - reassignment Tag: `DA4 V5 Reassignment Tag`, initially assigned to
     `Synthetic Android Customer`, with `Synthetic Reassignment Target` as its only V5 target;
   - Correction target employee label: `DA4 V5 Correction Target`, with one stopped interval of at
     least ten minutes and no other TimeRecord in the reserved half-open interval from 15 minutes
     before its start through 15 minutes after its stop;
   - Correction transformation: original start plus exactly one minute and original stop minus
     exactly one minute; reason `DA4 V5 correction observation`;
   - oldest unresolved review label: `DA4 V5 Oldest Review Target`; and
   - adjudication resolution `Keine Arbeitszeit ändern` with reason
     `DA4 V5 adjudication observation`.
6. Require Safari and Chromium to expose the same valid IANA timezone. In each engine the
   Correction target's original and transformed millisecond timestamps must render and round-trip
   in that visibly declared timezone without DST normalization. Any disagreement, invalid,
   non-existent or ambiguous local time fails before a write.
7. Open only `http://127.0.0.1:5173/` and authenticate as the synthetic Administrator after the
   credential match.

Any other aggregate, listener, origin, build or initial browser state fails the run.

## 5. Human observation matrix

Use current stable Safari and Chromium at representative 320 CSS-pixel narrow, 768 CSS-pixel
tablet and 1440 CSS-pixel desktop viewports. At least one complete keyboard pass and one complete
200% zoom pass are mandatory in each engine; distribute them across the representative widths
without omitting any width. These responsive passes are read-only. The six write actions occur
only once at 1440 CSS pixels and 100% zoom using the fixed serial allocation in Section 6B.
Run a focused current-stable Firefox read-only smoke at narrow and desktop. Record exact browser
versions and actual viewport dimensions.

At every observation require:

- no horizontal page overflow at 320 CSS pixels or 200% zoom;
- visible focus, logical focus order/return, semantic labels and keyboard-only operation;
- readable status/error/empty/loading/completeness copy without color-only meaning;
- no console warning/error, raw identifier, token, secret, provider/database diagnostic or real
  data; and
- the same real Admin Web/API result, never fixture/helper output, as the Human evidence.

## 6. Functional sequence and mandatory stop points

### A. Shell, navigation and completeness

1. Visit all five views: Übersicht, Einrichtung, Beschäftigte, Arbeitszeiten and Prüfungen.
2. Verify invalid fragments resolve to Übersicht without privileged URL values. Verify safe
   back/forward navigation and heading focus.
3. On Einrichtung require the shared sorted setup page 1 to contain exactly 20 Customers and zero
   Tags while reporting incomplete. Use load-more once; page 2 must add exactly one Customer and
   one Tag, after which the view has 21 Customers, one Tag and reports complete. On Beschäftigte
   require 20 projected Employees, then load exactly one more and require 21 complete.
4. On Arbeitszeiten and Prüfungen require `100 bisher geladen`, use load-more and require exactly
   101 complete. The initial overview must never claim tenant totals.
5. Arm the reviewed single-use read-only section-unavailable control for exactly one allow-listed
   projection request. Require one section's unavailable/retry state not to erase other safe
   sections, require the control to be consumed once, then recover through the visible retry. This
   control may affect transport only; it must not fabricate a product result or intercept a write.

Each loaded-versus-complete assertion is a stop point. Missing, duplicated, reordered or
non-advancing pages fail the run.

### B. Existing privileged actions — fixed serial allocation

All six writes occur exactly once in the order below and never in both engines. Before the next
write, wait for the real result, refresh the affected view and require the disclosure-safe
aggregate delta for only that action. A duplicate, repeated, concurrent or ambiguous submission
fails the run.

After each write, the operator must run the matching Harness checkpoint in this exact order and
receive only `da4_v5_write_checkpoint=match`: `checkpoint safari create-customer`,
`checkpoint safari create-invitation`, `checkpoint safari reassign-tag`,
`checkpoint chromium correct-time-record`, `checkpoint chromium export-time-entries`, then
`checkpoint chromium adjudicate-review`. `mismatch` stops the run without advancing.

**Safari write phase**

1. Create exactly one Customer named `DA4 V5 Browser Customer`; require server-confirmed success,
   refresh Einrichtung and stop on Customers `+1`, setup receipt `+1`, general AuditEvents `+1`.
2. Create exactly one invitation for `DA4 V5 Browser Employee`; observe its secret only in the
   one-time intended view, navigate away, require destruction, refresh and stop on active
   invitations `+1`, invitation receipt `+1`, general AuditEvents `+1`.
3. Select `DA4 V5 Reassignment Tag`, verify safe fingerprint and the exact
   `Synthetic Android Customer` to `Synthetic Reassignment Target` change, then use the explicit
   second confirmation. Refresh and stop on Assignment-history total `+1`, active Assignments
   unchanged at `1`, old row inactive, reassignment receipt `+1`, general AuditEvents `+1`.
4. Sign out Safari. Do not perform any Chromium-assigned write in Safari.

**Chromium write phase**

5. Authenticate after a fresh credential `match`, refresh all sections and require the complete
   Safari-phase aggregate before proceeding.
6. Select only the stopped record labelled `DA4 V5 Correction Target`. From the UI-prefilled local
   millisecond values, set start to exactly one minute later and stop to exactly one minute earlier,
   enter `DA4 V5 correction observation`, inspect exact before/after/reason, explicitly confirm,
   refresh and stop on revision `+1`, time-review command receipt `+1`, general AuditEvents `+1`.
7. Export the effective 31-day window exactly once. Complete all CSV stop points below, then stop
   on export-audit aggregate `+1` and general AuditEvents `+1`; these two counts refer to the same
   `TimeEntryExportGenerated` row and must not be added as two audit rows.
8. Select only the oldest item labelled `DA4 V5 Oldest Review Target`, choose
   `Keine Arbeitszeit ändern`, enter `DA4 V5 adjudication observation`, inspect the evidence and
   verbatim reason, explicitly confirm, refresh and stop on unresolved reviews `-1`, adjudication
   `+1`, time-review command receipt `+1`, general AuditEvents `+1`.
9. Sign out Chromium. Do not repeat any Safari-assigned write.

Firefox remains read-only for the whole run. After both write phases, perform its smoke only
against refreshed final state and sign out.

For the CSV, before progress or deletion, locally require four separate disclosure-safe results:

```text
csv_v1_columns=match
csv_formula_safety=match
csv_exactly_once_rows=match
csv_effective_timestamps=match
```

Do not print, paste, screenshot or persist its body. UI/HTTP success or an export audit alone does
not satisfy this stop point.

### C. Invitation, session and reload truth

Perform steps 1–4 in Safari immediately after Section 6B step 2 and before its reassignment step:

1. Return to Beschäftigte after navigation and require that the invitation secret cannot reappear.
2. Refresh and require no secret restoration.
3. Reload the application and require signed-out state with no privileged data or token restored.
4. Reauthenticate only after a fresh credential `match`; verify the committed server state remains
   available without the invitation plaintext, then continue with Safari's reassignment.

After each browser's final explicit sign-out, browser back/forward must not restore privileged
state. Firefox performs only the final read-only smoke and signs out.

## 7. Final invariant

Run disclosure-safe status and require the exact delta from Section 4:

- 22 Customers, 21 projected Employees, 101 TimeRecords, 100 unresolved review items;
- one Tag, total Assignment-history rows `2`, active Assignments `1`, the initial row inactive and
  exactly one target cutover;
- one active invitation and one invitation receipt;
- one Customer setup receipt and one reassignment receipt;
- one TimeRecord revision, one review adjudication, two time-review command receipts and one
  export audit;
- final general `audit_events` count exactly equal to the recorded numeric initial count plus six;
  exactly one of those six new rows is `TimeEntryExportGenerated` and is the same row counted by
  the export-audit aggregate, never a seventh AuditEvent; and
- no other lifecycle, receipt, revision, adjudication, export or authority delta.

Every required UI success, cursor transition, confirmation, secret destruction, session boundary,
CSV assertion and aggregate must agree. Any mismatch fails the whole run.

The status output must name the initial and final numeric dimensions for Customers, projected
Employees, TimeRecords, unresolved reviews, Tags, total/active Assignments, active invitations,
each named receipt, revisions, adjudications, time-review command receipts, general AuditEvents and
the `TimeEntryExportGenerated` subset. It emits no CSV content, secret, digest or internal ID.

## 8. Evidence and cleanup

Screenshots are optional and must be disclosure-safe. Record only pass/fail per named stop point,
exact bindings, versions, dimensions and safe aggregates.

Cleanup is mandatory after pass or failure:

1. sign out, clear password fields and clear the credential clipboard;
2. delete the synthetic CSV, screenshots and profile-owned temporary Admin-Web build/download data;
3. clear the profile's browser site data for `127.0.0.1:5173`;
4. stop Admin Web and harness normally; require `da4_v5_stopped` only after successful complete
   cleanup, while `da4_v5_cleanup_failed` fails the run and forbids retry/resume;
5. require zero listeners on `3000`, `5173` and `54321`;
6. require zero synthetic schema, migration-ledger rows and generated runtime roles;
7. verify the tracked worktree with explicit `research/` exclusion and disclose unrelated user
   files only by path/status; and
8. preserve the local PostgreSQL service and all unrelated browser/repository state.

Only the Human Architect or an explicitly delegated Human tester may mark V5 passed. A pass still
requires focused evidence publication, independent final review and a separate DA4 closure
decision. Production, production data, deployment and distribution remain unauthorized.
