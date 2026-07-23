# Development Assignment 3 — Independent Final Closure Review

Date: 2026-07-23
Reviewer role: Independent Senior Software Architect, Security Engineer and QA/Release Reviewer
Review mode: Read-only
Final verdict: **APPROVED FOR DA3-V5 PHYSICAL CLOSURE — ZERO OPEN P0/P1/P2/P3**

## 1. Exact binding and scope

The independent reviewer verified:

- baseline `d2dba78344bf5b8234d62a905d69de315d5d4e4c`, tree
  `ea6772944c3fd71c1e0f1d40d71a04e441b449fd`, and exact-head run `29987351521`, attempt 1,
  12/12;
- reviewed evidence commit `7cb510aae4a6656e39f563c1d948746a319da0bc`, tree
  `ba28d74ac5870e5278d1351b6bf183e7958bcd12`, with exact parent `d2dba78344bf5b8234d62a905d69de315d5d4e4c`;
- `main == origin/main` at the reviewed commit;
- exact seven-ADO-Markdown-file delta `+295/-27`;
- no Product, schema, migration, dependency, lockfile, workflow, helper, harness, configuration,
  runtime-input or artifact change;
- clean `git diff --check` and clean tracked tree under the mandatory `research/`-excluding
  pathspec; and
- GitHub Actions run `29996799069`, attempt 1, push to `main`, exact head `7cb510a`, 12/12 jobs
  successful.

The complete 18-head predecessor chain and all 18 associated exact-head CI runs were independently
verified. The executable Product surface remained unchanged from Product commit `6eb68a3`.

## 2. Artifact binding

The reviewer independently reproduced the unchanged artifact manifest:

- APK: 95,437,611 bytes, mode `0444`, SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`;
- package `com.tim180201.mobile.synthetic`, version name `1.0.0`, version code `1`, minSdk 24,
  targetSdk 36;
- exactly one APK-v2 signer, certificate SHA-256
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; and
- 2,206-byte mode-`0444` manifest, SHA-256
  `07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`.

The Android Debug signer remains unsuitable for distribution.

## 3. AVS, authority and evidence assessment

The reviewer independently reproduced AVS V0 and confirmed R0. V1–V3 were correctly omitted. V4
is exact-head run `29996799069`, 12/12. V5 is correctly carried as Human-observed physical
evidence, not represented as independently reproduced physical evidence.

The one-time complete-run authority is truthfully recorded as consumed. No retry, production,
production-data, deployment, distribution or premature closure authority was inferred. Earlier
abandoned operator sessions are explicitly separated and contribute no observation. The final
counted run began under a new one-time Human authorization from a newly proved package, mapping,
listener, database and mutable-row zero state.

The Human acceptance record is sufficient: the Human confirmed every required UI checkpoint and
directed formal synchronization after the complete pass and cleanup report. The Web/Harness stop
timeout was an orchestration-response artifact; subsequent process/listener proofs showed both
processes stopped and all cleanup states unambiguous. No finding results.

## 4. Gate assessment

### Setup and reinstall boundary

**PASSED.** Exactly the two seeded Customers were used, with two Tags/Assignments, two
Administration Receipts, four setup AuditEvents and zero lifecycle/DA3 rows. No additional
Customer was created. Scoped disconnect, exact-package uninstall, package/mapping zero proof and
same-APK reinstall passed. Employee sign-in reached `Bereit zum Scannen` without
`protected_pending`.

### Gate A

**PASSED.** Start/Stop produced two WorkEvents, Decisions and Sync Receipts, one stopped TimeEntry
and six AuditEvents. One append-only correction produced exactly one revision, one correction
receipt and one correction AuditEvent without mutating base lifecycle rows. The 523-byte CSV,
SHA-256 `c97d871dbf00d4277fc398cf7d5013e75c37a6a2b5eff0a0760cb627d9214608`, passed all four mandatory
CSV-v1, formula-safety, exactly-once and effective-timestamp stop points before deletion.

### Gate B

**PASSED.** The online Tag-B event, Tag-A cutover and three ordered offline events produced the
exact durable outcomes `active_entry_for_other_target_rejected`,
`review_pending/historical_configuration_not_valid` and
`review_pending/predecessor_requires_review`. Only the first received a Decision. Mobile retained
`Sichere Prüfung erforderlich` across cold relaunch with zero local items.

### Gate C

**PASSED.** Ordered partial no-change adjudication retained the marker and remaining predecessor.
Complete no-change adjudication cleared the marker only after server proof. Final aggregates were
three Administration Receipts, 16 AuditEvents, six WorkEvents, four Decisions, six Sync Receipts,
two TimeEntries with one stopped, one revision, one export audit, two adjudications, zero
unresolved predecessors and three time-review command receipts. The original six reconciliation
rows remained byte-stable.

### Cleanup

**PASSED.** Package, approved mappings, four scoped listeners, disposable database/schema/ledger,
generated roles, credential clipboard and task-created worktree were removed. The user-owned
untracked `app.json` remained untouched. The protected `research/` path was not entered.

## 5. Findings

- No open P0 finding.
- No open P1 finding.
- No open P2 finding.
- No open P3 finding.

## 6. Closure decision

`DA3-PHYS-01`, `DA3-PHYS-02` and `DA3-PHYS-03` are eligible for closure. Development Assignment 3
and DT-069–DT-074 are eligible for a focused ADO-only closure publication for the exact authorized
local repository/Admin-Web/Android/synthetic-server scope.

The approval does not authorize another Physical Gate, production resources/data, deployment,
distribution, legal/privacy approval, pilot onboarding or DA4 productization.

## 7. Known limitations

The reviewer did not independently reproduce Human NFC/UI observations, device/Tag state, the
deleted CSV body, password/digest, abandoned operator sessions or protected `research/` content.
Those limitations were transparent and do not create a finding. Eleven moderate transitive
toolchain advisories remain open and the debug signer remains distribution-ineligible.

## 8. Reviewer integrity statement

The independent reviewer changed no repository file. Every worktree query excluded `research/`;
the pre-existing user-owned `app.json` remained untouched.
