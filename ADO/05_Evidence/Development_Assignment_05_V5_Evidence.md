# Development Assignment 5 — V5 Human Android Evidence

- Status: **READ-ONLY ARTIFACT/EVIDENCE APPROVED — HUMAN V5 NOT RUN/UNAUTHORIZED**
- Date: `NOT RUN`
- Artifact preparation date: 2026-07-25
- Owner: Technical Lead
- Human run authority: `NOT BOUND`

## 1. Authority and exact binding

This record mirrors
`ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`. It records a read-only local
synthetic artifact candidate, but no installation, ADB, device/Tag interaction or Human result
and grants no Human-run authority.

| Binding | Evidence |
|---|---|
| One-run Human authorization/date | `NOT BOUND` |
| Product commit/tree and required V4 | `a323834f51607841d0cd5f11aafdbfd3dd93ed5f` / `65c669b0a941c21d23ffca5e79fa03285323a7cf`; CI `30149165373`, attempt 1, 12/12 |
| Product implementation-review binding/verdict | Round 2 `APPROVED`; zero open P0–P3 |
| Runbook/evidence commit/tree and independent-review verdict | `e6a06e2ec8f580d6314bfe5a51378f949d524b16` / `6dcdce405feb2eccb1462c373ab6be891152715c`; CI `30150095109`, attempt 1, 12/12; final independent Artifact/Evidence Exact-SHA review `APPROVED`, zero open P0–P3 |
| Read-only APK path/size/SHA-256/mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/app-release-385c0c46f22dcac5.apk`; 95,522,787 bytes; `385c0c46f22dcac5b935bfdc6f574558f4e74748ed4a367ef399ddbd4299c547`; `0444` |
| Read-only artifact manifest path/size/SHA-256/mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/artifact-manifest.txt`; 1,647 bytes; `1c1f1b7a5b92fab5510cde35a439fc6f0742b7bf2666d6319cd89b9a7d4dcadb`; `0444` |
| Package/version/signature/signer/packaged runtime values | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 `true`, v1/v3/v3.1/v4 `false`; one local synthetic non-production signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; packaged boundary/runtime `match` |
| Device model/OS/build/screen-unlocked mode | `NOT BOUND` |
| Approved Tag labels/safe fingerprints by assigned/unassigned/unrelated role | `NOT BOUND` |
| Synthetic services/status/offline controls | `NOT BOUND` |
| Admin Setup Preview 2 entry/result/safe-exit procedure | `NOT BOUND` |
| DA5-T06 five-second dedupe boundary/lifecycle-cancellation checkpoint | `NOT BOUND` |
| Reviewed Protected/Review fixture, labels, start state, cutover, expected sequence and scoped teardown | `NOT BOUND` |
| Large-text setting/TalkBack version | `NOT BOUND` |

The APK and manifest were independently re-hashed and inspected at their final paths. Packaged
checks confirmed `allowBackup=false`, base cleartext denial with only the synthetic
`127.0.0.1` exception, both offline-storage rule references and exclusions, NFC
`TECH_DISCOVERED` with NfcA/MifareUltralight, exactly one Hermes Android bundle and a matching
synthetic runtime contract. Independent artifact review and Evidence exact-head CI are complete
on the exact binding above with verdict `APPROVED` and zero open P0–P3. This remains
artifact/evidence approval, not Human preflight evidence or Human-run authority.

### 1.1 Local enablement preparation — no Human result

Corrected ADO authorization candidate `cddb66d82047284c72688cc90a7491af761b8791`, tree
`8cda19f8df42febb34a03a4db4911d5ea8acae79`, passed exact-head CI `30159987539`,
attempt 1, 12/12; independent exact-delta re-review returned `APPROVED` with zero open P0–P3.
On exactly that baseline, the R3 enablement implementation remains local and uncommitted.
Implementation V4 and formal Exact-SHA review remain pending.

Final local V3 passed all 21 workspace suites with 2,013 tests and exactly two optional B1
Supavisor skips, 21/21 tests-inclusive typechecks, 20/20 applicable builds, migrations 001–013
clean apply/replay/ledger verification on PostgreSQL 17.10, C3B binary verification, Android
export of 861 modules, immutable-artifact/no-install preflight and complete cleanup of task-owned
temporary database/export data. Focused Mobile device tests passed 21/21, Harness
credential/profile tests passed 34/34 and both independent read-only Technical-Lead delta audits
returned `APPROVED` with zero open P0–P3.

No installation, ADB, device/Tag interaction or Human V5 occurred. The Harness can accept A/B/X
values only from the operator and cannot independently prove their origin. Before any hardware
action, a separate independently reviewed Validation-App/Binding-Preflight architecture and
explicit Human authorization are required; this record selects no architecture.

Do not add credentials, credential/password/identity digests, tokens, secrets, raw UID/payload,
provider subjects, device serials, encryption keys, internal identifiers, CSV bodies or personal
data.

## 2. Preflight

| Check | Result | Safe observation |
|---|---|---|
| Separate exact Human authorization | `NOT RUN` | — |
| Repository/product/review/CI binding | `NOT RUN` | — |
| APK and manifest size/SHA-256/mode | `NOT RUN` | — |
| Package/version/signature/signer/runtime verification | `NOT RUN` | — |
| Named device/OS and approved Tags | `NOT RUN` | — |
| Fresh synthetic services/accounts/data and zero state | `NOT RUN` | — |
| Admin Setup Preview 2 and Protected/Review fixture review bindings | `NOT RUN` | — |
| Scoped install, NFC enabled and screen unlocked | `NOT RUN` | — |

## 3. Staged Human results

| Gate | Mandatory coverage | Result | Human checkpoint |
|---|---|---|---|
| A | Auth/enrollment, completed first assignment capture, separate Admin Setup Preview 2, zero lifecycle/queue/replay, setup preservation and rejection paths | `NOT RUN` | — |
| B | Cold/background Tag Dispatch; duplicate WorkEvent/Decision/Receipt/Audit with `duplicate_scan_ignored`; zero second TimeEntry mutation | `NOT RUN` | — |
| C | Online target/provenance/own-time truth with every opposite toggle strictly after five seconds | `NOT RUN` | — |
| E | TalkBack, text scaling, focus/labels/announcements and layout | `NOT RUN` | — |
| D | Ordinary offline/restart/cancellation, reviewed historical cutover, ordered `review_pending`, protected-state stop and no reuse | `NOT RUN` | — |
| F | Final safe truth and complete cleanup | `NOT RUN` | — |

## 4. Disclosure-safe result record

Populate only after a separately authorized run. Keep values aggregate and synthetic.

| Observation | Result |
|---|---|
| Initial safe aggregate | `NOT RUN` |
| Accepted/rejected action sequence matched the runbook | `NOT RUN` |
| Target and immutable provenance truth | `NOT RUN` |
| Own-time active/history truth | `NOT RUN` |
| Every intended opposite toggle had `dedupe_window_elapsed=match` | `NOT RUN` |
| Duplicate persisted four evidence records and zero second TimeEntry mutation | `NOT RUN` |
| Queue, synchronization and protected-state truth | `NOT RUN` |
| Protected/Review fixture reached the exact ordered outcomes and mandatory stop | `NOT RUN` |
| No duplicate, foreign or unexplained mutation | `NOT RUN` |
| Sensitive-data disclosure check | `NOT RUN` |

## 5. Failure, interruption or ambiguity

- Disposition: `NOT RUN`
- Gate/step: —
- Disclosure-safe symptom: —
- Later gates not started: —
- Authority consumed: `NOT RUN`
- Retry/repair/resume performed: `NOT RUN`

Any `FAIL` or `AMBIGUOUS` result consumes the complete one-run authority. Preserve only safe
diagnostics, mark all later gates not started and perform cleanup. No observation is reusable.

## 6. Cleanup

| Check | Result |
|---|---|
| Mobile/Admin sign-out and clipboard/download/screenshot cleanup | `NOT RUN` |
| Scoped service shutdown and mapping/listener cleanup | `NOT RUN` |
| Exact synthetic package removed | `NOT RUN` |
| Protected/Review fixture scoped teardown, without product repair/adjudication | `NOT RUN` |
| Disposable database/schema/ledger/runtime roles removed | `NOT RUN` |
| Repository binding reverified with protected exclusions | `NOT RUN` |
| Unrelated device/repository/PostgreSQL state preserved | `NOT RUN` |

## 7. Final Human disposition

- Overall result: `NOT RUN`
- Human checkpoint authority: `NOT BOUND`
- DA5 V5 closure decision: `NOT RUN`

This shell, automated evidence, software `MERGE_READY` status or cleanup alone cannot pass V5.
Production, production data, signing, deployment and distribution remain unauthorized.
