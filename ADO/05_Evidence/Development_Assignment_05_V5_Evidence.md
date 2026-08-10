# Development Assignment 5 — V5 Human Android Evidence

## Current clean-identity installation-boundary correction — local R3 candidate

| Evidence | Exact result |
|---|---|
| Development baseline | `HEAD == main == origin/main == 55f4d4984175dd544fd4f27f6a97d9507dcf14a2`; tree `cbc27ac9cac93dee674bdb07d81c15c226218575`; tracked baseline clean |
| Consumed Product Human/Hardware R4 | Administrator Tag-A assignment and enrollment-only sign-out completed; Employee stayed at `NFC wird geprüft`; cold reopen showed `Ausstehender Vorgang geschützt` without an intervening scan; authority consumed and non-reusable |
| Product mutation boundary | Tag B was not presented in the Employee phase; no scan, lifecycle, queue, time or review mutation occurred |
| Terminal cleanup | Product package/process, owned reverse mappings, listener, PostgreSQL, Guard, Credential and task state matched null |
| Confirmed cause | Same installation retained the permanent encrypted Administrator offline-store owner, so the different Employee identity failed closed; DA5-scoped R-026 recurrence of accepted `DA3-PHYS-01`, not NFC/Tag/Human failure |
| Installer ownership correction | The active runner is released only by identity-matched, fully successful `markCleanupComplete()`; before cleanup or after cleanup mismatch a second transaction remains rejected |
| Employee transition correction | Exact once and monotone: Human `PASS` after enrollment sign-out; exact pre-state; old offline close; exact-package plus owned-mapping cleanup/zero proof; new transaction; same immutable APK reinstall; fresh offline arm; exact unchanged post-state and distinct match receipt before Employee readiness |
| Fail-closed boundary | Early/late/repeated/concurrent invocation, `FAIL`, `AMBIGUOUS`, every stage failure or pre/post mismatch prevents all following mutation and cannot be resumed or retried; cleanup follows the exact current old/new transaction |
| Independent Review Round 1 | `CHANGES REQUIRED`; exactly one P2: the replacement-install callback let a typed install failure reach the transition's generic mismatch fold before emitting its closed install category and cleanup evidence |
| Round-1 P2 correction | Initial and replacement install failures now use one tested disclosure-safe formatter; a typed `timeout` replacement failure with cleanup `mismatch` / `package_uninstall` binds exactly `da5_v5_android_install=mismatch category=timeout cleanup_status=mismatch cleanup_substage=package_uninstall`; the receipt precedes the monotone transition stop and final cleanup retains the replacement transaction |
| Independent Review Round 2 | `CHANGES REQUIRED`; exactly one P3 and no other finding: carried pre-Round-1 Mobile evidence and fresh post-Round-1 Synthetic evidence were presented together without explicit provenance |
| Round-2 P3 correction | ADO-only provenance correction; no npm, test, Typecheck, build, ProductStart, Hardware, ADB or installation rerun. Independent re-review remains pending |
| Forbidden mechanisms | No `pm clear`, broad `--remove-all`, backup/restore, Product/Mobile runtime-semantic change, Product APK build, dependency/lockfile, schema or workflow change |
| Toolchain / dependency preflight | Node `24.17.0`; npm `11.13.0`; installed `js-yaml@4.3.1`; installed `nanoid@3.3.18`; `npm ls --all` exit 0 |
| Fresh focused regression after Round 1 | Mobile installer: 1/1 file, 103/103 tests, receipt `734cdc`, exit 0. Synthetic transition/Profile: 2/2 files, 86/86 tests, receipt `da0c45`, exit 0. The 3/3 and 189/189 total is their explicit composition, not one process |
| Carried Full Mobile workspace | Pre-Round-1 receipt `8f392d`, exit 0: Node `24.17.0`, npm `11.13.0`, 54/54 files and 1,247/1,247 tests. Mobile runner/test paths and every relevant configuration/package/dependency input remained byte-identical through the Round-1 P2 correction; the current 103/103 focus above is fresh |
| Fresh Full Synthetic workspace after Round 1 | Receipt `00267f`, authoritative terminal exit 0 from unchanged child session `80890`: 14/14 files; 324 passed and 19 expected skips, 343 total; `TAPTIME_DA5_V5_PRODUCT_APK_REACHABILITY=required` |
| Carried Mobile tests-inclusive Typecheck | Pre-Round-1 receipt `108def`, exit 0; `npm run typecheck --workspace @taptime/mobile`. Changed Mobile test membership was separately proved by receipt `bf24e7`, exit 0. All relevant Mobile TypeScript/configuration/source/test/package/dependency inputs remained byte-identical through Round 1 |
| Fresh Synthetic tests-inclusive Typecheck after Round 1 | Receipt `7d3c10`, exit 0; workspace Typecheck plus `--listFilesOnly` membership included both changed Synthetic sources and all three changed Synthetic tests |
| Fresh Synthetic build after Round 1 | Receipt `43f3d6`, exit 0; build, bundle syntax and map invariants completed under the exact toolchain |
| Fresh ProductStart regression after Round 1 | Receipt `2b5744`, exit 0; 5/5 passed with mandatory Product-APK reachability; final bundle syntax and byte/digest readback completed |
| Local Product-start bundle | Fresh post-Round-1 `da5V5Main.js`; 920,552 bytes; SHA-256 `8d4981e591820ed6a62bd3b6ca139a7f4b8da90156f858ed0c71a1018a0a0d22`; final `node --check` passed |
| Local Product-start source map | `da5V5Main.js.map`; 1,712,456 bytes; SHA-256 `7286e001e1b55c65aa31e2bbb6a5ec65059d68295fc579037c892c4111e67afa`; version 3; `sourceRoot` absent; 90 sources, 90 unique sources and 90 `sourcesContent` entries |
| Carried evidence | Unchanged dependency/security, backend, PostgreSQL/migration, Expo, Product APK and unrelated workspace evidence remains carried exactly as previously bound; it was not rerun or relabeled by this focused correction |
| Current status / authority | Local uncommitted Round-1 code candidate plus Round-2 ADO-only provenance correction; independent re-review, publication, Exact-Head CI, fresh runtime/artifact review and new exact Human Hardware authorization pending; **not Hardware-ready — DO NOT INSTALL / DO NOT START** |

## Current dependency-security / test-TMPDIR technical closure — final artifact review APPROVED

| Evidence | Exact result |
|---|---|
| Development baseline | Direct parent `627e8512631c53bc2c6882aed80b163ab81051fd`; tree `dfaf1d32574e4253aad07d99d84e3489cc5634aa` |
| Pre-ADO candidate delta | Exactly four tracked paths; Full-Index/Binary diff 45,981 bytes; SHA-256 `7d76ebb9d717ca7b2578b3e50e192b1abf1140c24b2895e5a1c4ff5ee870b37e`; staged empty |
| Lockfile | `package-lock.json`; SHA-256 `902286a30377eef08ce7613eff44d5af5bdd47bb09f7d3cc0741c69685bad491`; selects `js-yaml@4.3.1` and `nanoid@3.3.18` |
| Runtime-Guard source | `apps/synthetic-android-e2e/src/Da5V5RuntimeGuardArtifact.ts`; SHA-256 `267f41bcb978604849a5feac177dc88edc98e514a230413d8f2994f8595b567e` |
| Runtime-Guard regression | `apps/synthetic-android-e2e/tests/Da5V5RuntimeGuardArtifact.test.ts`; SHA-256 `a86a6afc4198e0b2a0113fa83db5c7b363cbb7f8e5418d596de15afa66165c6e` |
| Product-start binding regression | `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts`; SHA-256 `40c14eda526739a9dc6ae09fdf22828cb4119dee4b646dbcb1dc3dde6fc13806` |
| Test-only TMPDIR trust correction | Reads `os.tmpdir()` once; canonical root and binary; strict nonempty component descendant; bound same-EUID-private root and binary; unsafe in-bound root fails without fallback; outside remains root-system; root, binary and codesign revalidated immediately before and after process verification; production verifier/artifact semantics unchanged |
| Product-start bundle | `da5V5Main.js`; 912,627 bytes; SHA-256 `97448febd21887fa29a08e26ed9e2ac5737736502d6241e6053a3f241aac01ce` |
| Product-start source map | `da5V5Main.js.map`; 1,697,795 bytes; SHA-256 `c8cd0e8aa5bb19945946ef9ba4d157075e7cd3ac3e888c6645f31bd6a50854f5`; version 3; `sourceRoot` absent; 90 sources, 90 unique sources, 90 `sourcesContent` entries |
| Independent Exact-Delta review | `APPROVED`; zero open P0–P3 |
| Carried V3r3 evidence | Limited to byte-identical bound inputs: dependency install/graph, both audits, validator each/pair, 19 non-Synthetic builds, 20 non-Synthetic tests-inclusive Typechecks, C3B `verify-bin`, migration apply/replay/ledger, Expo export and the first 20 non-Synthetic workspace suites. No V3r3 Synthetic build, Typecheck or workspace result carries after the RuntimeGuard source/test and ProductStart test changed; the historical failed Synthetic workspace result remains historical and is not relabeled |
| Fresh Synthetic binding build | `PASS` under exact Node `24.17.0`, npm `11.13.0`, installed `js-yaml@4.3.1` and installed `nanoid@3.3.18` |
| Fresh tests-inclusive Synthetic Typecheck | `PASS`; 573 listed files; membership includes `apps/synthetic-android-e2e/src/Da5V5RuntimeGuardArtifact.ts`, `apps/synthetic-android-e2e/tests/Da5V5RuntimeGuardArtifact.test.ts` and `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts` |
| Fresh macOS RuntimeGuard slice | 17 passed; one expected skip |
| Fresh macOS PostgresGuard slice | 78/78 passed |
| Fresh macOS SyntheticDB slice | 21/21 passed |
| Final ProductStart slice | 5/5 passed under exact Node `24.17.0`, npm `11.13.0`, installed `js-yaml@4.3.1`, installed `nanoid@3.3.18` and `TAPTIME_DA5_V5_PRODUCT_APK_REACHABILITY=required` |
| Composite-evidence disposition | Explicitly accepted by the Human on `2026-08-10` in lieu of another local full Synthetic rerun; components retain their individual carried/fresh labels and are not a single monolithic rerun |
| Accepted temporary security exception | Only `image-size@1.2.1` High advisories `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`; accepted through `2026-09-09` under R-038; all other dependency/security expectations remain unchanged |
| Unchanged Product artifact | APK `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8`; same-directory manifest 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| Later pre-test orchestration stop | Intended `initdb --pwfile=-` invocation failed before PostgreSQL server start and before any full Synthetic test start; no Product, database-content or test-quality finding; task-owned execution/runtime cleanup completed and only the named immutable Evidence was intentionally retained |
| Immutable orchestration evidence | `/private/tmp/taptime-da5-full-final-evidence.6krwCf/final-evidence.txt`; 4,260 bytes; mode `0444`; containing root mode `0555`; SHA-256 `479758b48825ef3dee311255824a53c9a890953792104f4e54e9057977e29af7` |
| Executable publication | `e2f4f6c777d4dc89531394609e44b3471537b2d7`; tree `0850d2f254877580773f62174d4c85e10cfff165`. A later ADO-only closure commit remains distinct and does not change the executable/CI source |
| Exact-Head CI | GitHub Actions run `31384903728`, attempt 1, 12/12 successful |
| Fresh read-only Product Operator Runtime | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/e2f4f6c7-97448feb`; checkout detached, sparse and tracked-clean at the executable commit/tree |
| Runtime bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 912,627 bytes; mode `0444`; SHA-256 `97448febd21887fa29a08e26ed9e2ac5737736502d6241e6053a3f241aac01ce` |
| Runtime source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,697,795 bytes; mode `0444`; SHA-256 `c8cd0e8aa5bb19945946ef9ba4d157075e7cd3ac3e888c6645f31bd6a50854f5`; version 3; `sourceRoot` absent; 90 sources, 90 unique sources and 90 `sourcesContent` entries |
| Runtime manifest | `operator-runtime-manifest.json`; 8,640 bytes; mode `0444`; SHA-256 `4cf1d4589028707c3328826d3148d34f2ae1e4e6226d75566c4ff3d0476e2790`; generation-time `candidate_status=exact_head_ci_passed_pending_final_artifact_review` remains historical and the manifest was not rewritten after review |
| Final Artifact Review Round 1 | `CHANGES REQUIRED` only for one formal P2: reviewer write-deny sandbox enforcement was not technically proved. No material Candidate/Artifact finding and no candidate mutation |
| Final Artifact Review Round 2 | Fully sandboxed; `APPROVED`; zero open P0–P3 |
| R0 closure synchronization | ADO-only; changes no source, test, lockfile, risk entry, workflow, artifact or runtime input; claims no new test, build, npm, audit, network, CI or Hardware evidence |
| Current status / authority | Technical closure complete and ready for one separately authorized exact one-time Human Hardware gate. No Hardware, ADB, installation or Product Human V5 occurred. Production, production data, deployment and distribution remain unauthorized; **DO NOT INSTALL / DO NOT START without new Human authorization** |

## Historical snapshot — superseded by 2026-08-10 final closure above — Credential PTY consumed-run/correction

| Evidence | Exact result |
|---|---|
| Development baseline | `aca2fcfb794adf9bd44786459a7dbd35448172d2` / tree `124cce6f4b80eca3562fe50fe219d0c2517ee99a`; local `HEAD` and `origin/main` matched before Development |
| Consumed run | Active empty password field reached; protection filter detected the memory-only Credential in child PTY output and stopped fail-closed; authority consumed; later Product gates not authorized |
| Terminal cleanup | Product/Validation packages and processes, owned reverse mappings, listeners, disposable database and task runtime matched null; no raw Credential or Credential digest is Evidence |
| Confirmed predecessor cause | Exact Node PTY path removed all Command-readline listeners, closed it, published `synthetic_password_input_ready` and created the muted Secret readline afterward; deterministic synthetic dummy appeared exactly once despite ECHO/ECHONL off |
| Initial focused correction | One synchronous Command-to-Secret factory transfer; no `removeAllListeners`; muted output plus active question before the sole Ready receipt; exact 64-lowercase-hex validation; retained Buffer zeroization; closed Secret ownership retained until release |
| Independent Review Round 1 | `CHANGES REQUIRED`: one P1 for valid line plus same-write EOF/Close and valid line plus unterminated foreign rest crossing settlement; one P2 because only the bounded PTY wrapper/process group—not Credential capture—had timeout evidence; one P2 because complete Synthetic V2 was missing; one P3 because `ADO/README.md` still presented ADB reverse as current truth |
| Round-1 correction | The exclusively owned raw input is audited from before Ready through final settlement; Close and Error always reject until that boundary; any byte after the first line terminator rejects in the same input event; mutable raw copies/chunks, muted writes and retained Credential Buffers are zeroized; immutable strings are discarded; no timer/delay or new Credential timeout |
| Duplicate/foreign/terminal behavior | Complete and unterminated same-turn foreign input reject; valid line plus Ctrl-D/Close rejects; empty Ctrl-D and explicit Error reject; Command ownership cannot restart before Secret release |
| Exact transfer/receipt positions | Standard Administrator, Enrollment and Employee: `synthetic_password_binding=match`; Gate-E Administrator at `administrator-setup` and Employee at `employee-navigation`: `da5_v5_accessibility_password_binding=match`; exactly five transfers |
| V0 predecessor/correction | Real PTY with fixed synthetic dummy: predecessor one occurrence / corrected built helper zero occurrences; corrected capture 64 bytes and exit 0 |
| Focused V1/V2 | `Da5V5CredentialTransfer.test.ts`, `Da5V5Profile.test.ts` and `Da5V5ProductStartBundle.test.ts`: 3/3 files, 63/63 tests passed |
| Real PTY capture matrix | Success; complete foreign line reject; unterminated foreign rest reject; valid line plus Ctrl-D/Close reject; empty Ctrl-D reject; explicit Error reject; uppercase-format reject; exactly one Ready receipt and zero Secret occurrences in every capture case |
| PTY wrapper/process-group evidence | Separate bounded wrapper expiry; final unterminated-output remainder scanned before result; negative-PGID TERM/KILL cleanup removed the Node leader and deliberately live descendant. This is not Credential-capture timeout evidence |
| Complete Synthetic V2 first changed-input run | 13/14 files passed; 302 tests passed and 18 skipped. Sole failure was the stale static `captureCredential(secretInput)` signature assertion after the raw-input parameter was added; no runtime/Product assertion failed |
| Complete Synthetic V2 final | After that test correction, 14/14 files passed; 303 tests passed and 18 unchanged expected skips, 321 total |
| Tests-inclusive Typecheck | `tsc -p tsconfig.json --noEmit` passed. Final exact `--listFilesOnly` membership reported 572 files and included `Da5V5SecretInput.ts`, `Da5V5OperatorLifecycle.ts`, `da5V5Main.ts`, the Synthetic `index.ts` and all three focused test sources exactly once. The first helper matcher counted three cross-workspace `src/index.ts` files; the exact workspace-relative matcher then passed with no source/test change between the two list invocations |
| Build/syntax | Synthetic workspace build passed; `node --check apps/synthetic-android-e2e/dist/da5V5Main.js` passed |
| Independent Review Round 2 | `APPROVED`; zero open P0–P3 |
| First final Synthetic V3 quality phases | Exactly once on 09.08.2026: 14/14 files, 303 passed and 18 expected skips, 321 total; tests-inclusive Typecheck passed; exact `--listFilesOnly` membership contained 572 files and every changed input exactly once; Synthetic build and final bundle syntax passed |
| First final Synthetic V3 formal result | `FAIL`, exit 98. After every quality phase passed, the terminal cleanup check found Node-24 `node-compile-cache/**` under the task-owned basename `taptime-da5-credential-v3.nSz7lx` and therefore failed closed |
| First post-failure bounded cleanup | Only that exact task-owned root was removed; the following absence check passed. The cleanup does not convert the first run into V3 `PASS`; it remains non-reusable `FAIL` evidence |
| Corrected V3 authority / unchanged input | Separately and exactly Human-authorized; ran once after confirming the old root absent. `HEAD`/`origin/main` remained `aca2fcfb794adf9bd44786459a7dbd35448172d2`, tree `124cce6f4b80eca3562fe50fe219d0c2517ee99a`; exact six-path input-manifest SHA-256 remained `6f7c0f11c1db4dc52b8f7742f356a3dec629aac5b3ca01609bc457ee98cba8f3` before and after |
| Corrected V3 root / environment | Fresh basename `taptime-da5-credential-v3-corrected.aKLa2n`; root mode `0700`, UID `501`, device `16777232`, inode `26198550`; parent device/inode `16777232:31941`. Fixed `tmp` and `node-compile-cache` children were passed through `env -i` to every Node/npm/Vitest/TypeScript/Vite invocation. Node `24.17.0`, npm `11.13.0`; ADB not resolvable and database environment absent |
| Corrected final Synthetic V3 | `PASS`, exactly once: 14/14 files, 303 passed and 18 expected skips, 321 total; tests-inclusive Typecheck passed; `--listFilesOnly` ran exactly once with 572 files, all seven required source/test inputs exactly once and SHA-256 `c91ba74dbf6a834f620cc9971048f22700f3e03eceb15368a133d1c5ed949a3b`; Synthetic build and final bundle syntax passed |
| Corrected V3 post-children / cleanup | Root/Parent/UID/Inode reattested unchanged; symlinks, mounts and open handles absent. Only the exactly bound root was removed with `find -xdev -depth -delete`; root absence and unchanged parent binding passed |
| Boundaries | Product/Validation Apps and APKs, Product rules, NFC, schema, dependencies, package manifests/lockfile and workflow unchanged; no ADB, install, APK build/publication, Product/production database, Hardware or production action |
| Candidate status | Uncommitted/unpublished; corrected final V3 `PASS`; prepublication review and V4/CI remain pending; every published predecessor runtime is superseded for every future start; **DO NOT INSTALL / DO NOT START** |

## Historical snapshot — superseded by 2026-08-10 final closure above — Credential / Lean-Accessibility V4 runtime

| Evidence | Exact result |
|---|---|
| Baseline | `aab04442721d57d53def25e45e5e3ce1d6ea3f77` / tree `e96fee7f3fa0f9783693c9f2c84605bae4c63920` |
| Consumed run | Administrator authentication, Tag-A assignment, assigned-Tag setup preview rejection and signed-out Tag-A rejection succeeded. Enrollment credential injection left the focused field empty; the authority was then explicitly terminated and is non-reusable |
| Mutation boundary | No lifecycle, queue, time, export or protected-fixture mutation occurred. Enrollment/Employee authentication and Gates B–F were not started |
| Terminal cleanup | Product/Validation packages and processes, owned reverse mappings, listeners, disposable database and task runtime all matched the confirmed null state; the memory-only Credential was discarded |
| Confirmed correction boundary | One mobile path for Administrator, Enrollment and Employee; same exact bound Android runner for reattestation and non-PTY stdin; exact 64 lowercase hex plus one line/EOF; exact child exit; Credential-only proof that both stdout and stderr are empty; phase advances only after Human `VISIBLE` confirmation |
| Short preflight | The first Administrator transfer immediately after installation is both the one short Credential preflight and the real Gate-A entry; no duplicate Credential action |
| Lean accessibility sequence | Functional Gates A–D at exact standard profile; exact order then `accessibility-prepare` -> Human profile change -> `accessibility-check` -> final Gate E at exact `font_scale=2.0` plus bound TalkBack; exact ordered surfaces `protected-review-error`, `auth-login`, `administrator-setup`, `employee-navigation`, `employee-scan`, `employee-manual-target`, `employee-own-time`, `employee-sync-pending`; no repeated business mutation |
| Accessibility reauthentication | Exactly one Administrator and one Employee mobile transfer, each only at its named surface boundary and under the same empty-active, hidden digest, non-PTY stdin, both-streams-empty and Human `VISIBLE` contract; no setup/lifecycle/queue/sync/fixture action is authorized |
| Gate-E preparation / restore closure | At the exact pre-Gate-E standard-profile boundary, only `accessibility-prepare` may emit `da5_v5_accessibility_prepare=match restore_required=armed`; only that receipt authorizes the Human profile change. It first makes restore duty monotone in session/device state. From that receipt, Gate-E-entry mismatch, failed `accessibility-check`, pre-check Cancel, PASS, FAIL, AMBIGUOUS or any later mismatch requires Human restoration followed by the sole accepted `standard-profile-check`. Only exact `font_scale=1.0`, accessibility disabled and empty/null active services proves restore. PASS then permits Gate F; failed routes terminate after proof. No Gate-E resume/retry/mutation exists and cleanup cannot complete without proof |
| Independent Review Round 1 | `CHANGES REQUIRED`: one P1 for missing real child stderr+0 rejection proof, one P1 for non-executable essential-surface reachability and one P2 for missing terminal restore-proof path. The first focused correction addressed those three findings |
| Independent Re-Review Round 2 | `CHANGES REQUIRED`: the sole remaining P2 found that restore duty began only inside `accessibility-check`, after the runbook had already instructed the Human to change TalkBack/text scale. The Round-2 correction added the explicit pre-change preparation/arm boundary and deterministic entry-mismatch/pre-check-Cancel regressions; independent Round-3 re-review was required |
| Focused correction V1 | `node --check apps/mobile/scripts/da5V5AndroidDevice.mjs` passed. Mobile focused run first passed 100/101; the sole failure was a new test-helper default that accidentally retained the strict policy for the explicit backward-compatibility case. After changing that test input, the same file passed 101/101, including real stdin child success, stderr+0, stdout+0, nonzero, timeout, abort and ordinary-stderr cases |
| Focused correction V2 | Synthetic controller/Credential/Profile first passed 3/3 files and 85/85 tests. Hardware-free Product-start bundle first failed only because the new test expected the runtime-joined plan as one source literal; after correcting that assertion input, it passed 1/1 file and 2/2 tests. The final combined four-file run rebuilt the bundle and passed 4/4 files and 88/88 tests; final bundle `node --check` passed |
| Tests-inclusive Typechecks and inclusion | Final Mobile and Synthetic workspace Typechecks passed. Mobile `--listFilesOnly`: 868 entries and changed Mobile test included. Synthetic: 571 entries and all four changed Synthetic tests included |
| Round-2 focused V1/V2 | `Da5V5AdbController.test.ts`, `Da5V5Profile.test.ts` and the hardware-free `Da5V5ProductStartBundle.test.ts` passed together: 3/3 files and 76/76 tests. The run rebuilt the Synthetic bundle. The tests-inclusive Synthetic Typecheck passed; `--listFilesOnly` reported 571 entries and included all three Round-2 test files. Final `node --check apps/synthetic-android-e2e/dist/da5V5Main.js` passed |
| Round-2 carried Evidence | Round 2 did not change Mobile, its runner/test, Credential transfer, package/dependency/lockfile/schema/workflow inputs or the fourth Synthetic Credential test. Their immediately preceding green V1/V2 and tests-inclusive Typecheck evidence above is carried unchanged, not relabeled as freshly executed. No V3 was run or authorized for this correction round |
| Independent Re-Review Round 3 | `APPROVED`; zero open P0–P3. The explicit pre-change prepare/arm boundary, monotone restore obligation, restore-only Entry-Mismatch/pre-check-Cancel paths and cleanup proof gate close the Round-2 P2 without retry, resume or Product mutation |
| Final Lean-V3 binding | Exactly once, `PASS`; before and after the final run `HEAD` = local `origin/main` = `aab04442721d57d53def25e45e5e3ce1d6ea3f77`, tree `e96fee7f3fa0f9783693c9f2c84605bae4c63920`. Pre-sync exact 14-file Full-Index/Binary delta: 144,817 bytes, SHA-256 `4cfab7b09377c59f25f88af2caf3d0238824325a285baf6ee16d04bc01c13f70` |
| Final V3 toolchain / ADB boundary | Node `24.17.0`; npm `11.13.0`; Vitest `4.1.9`; TypeScript `6.0.3`; esbuild `0.28.1`. ADB boundary `match` with `adb` not resolvable; no ADB command ran |
| Final V3 Mobile | MJS syntax `PASS`; 54/54 files and 1,245/1,245 tests `PASS`; tests-inclusive Typecheck `PASS`; normalized `--listFilesOnly` 868 entries, SHA-256 `11d72c73fe9c420a4c7b4aaadbdcad91187ec78500b5f7c8b68c9dd07f2f82e6`, including the changed Mobile test |
| Final V3 Synthetic | 14/14 files, 303 passed and 18 expected skips, 321 total `PASS`; tests-inclusive Typecheck `PASS`; normalized `--listFilesOnly` 571 entries, SHA-256 `45ac1d63ca5f619fcb432594b8495ec08968af1aed99edb8c336d357dcb74e5b`, including all four changed Synthetic tests; build and final bundle `node --check` `PASS` |
| Final V3 carried Evidence / cleanup | Dependency, backend, PostgreSQL, migration, APK and security evidence is carried unchanged under the Lean profile, not freshly executed or relabeled. Both temporary membership lists were unlinked. During V3 no Hardware, ADB, installation, database, CI/V4 or runtime-publication action occurred |
| Executable publication | `0f7ea912d861ecc0bfbf760bfd170496c37220b2` / tree `86f742536b2439955eb8291d53931487b15fff83`; direct parent `aab04442721d57d53def25e45e5e3ce1d6ea3f77` / tree `e96fee7f3fa0f9783693c9f2c84605bae4c63920` |
| Publication delta | Exactly 14 files; Full-Index/Binary delta 148,041 bytes; SHA-256 `0f9384c67a04edeaff62d8174462c41df5d315a55162c5299f8a03995303ec92` |
| Exact-Head V4 CI | GitHub Actions `31039633334`, attempt 1, 12/12 successful; no retry |
| Fresh read-only Product Operator Runtime | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/0f7ea912-af5cde8b`; checkout detached and tracked-clean with exact sparse patterns `/*` and `!/research/` |
| Runtime bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 907,171 bytes; mode `0444`; SHA-256 `af5cde8b304ebb8c5fe623c604addd5d2d40727fcb69f713d524f715771ac7ac` |
| Runtime source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,688,780 bytes; mode `0444`; SHA-256 `55ab8eebd277b551042b0766a3c1781857d8b0f1714fc42d6f1d759b5ad1df15` |
| Runtime manifest | `operator-runtime-manifest.json`; 9,219 bytes; mode `0444`; SHA-256 `7c5931035446faa1d0fc90fe31de8ef123ecba43f6de1c5a0b7a1da47f4b91e4`; generation-time status `exact_head_ci_passed_pending_final_artifact_review` is preserved because it records artifact generation before final review, and this status synchronization does not mutate the manifest |
| Runtime dependency closure | Fresh `npm ci` ran exactly once: 695 packages added, 717 audited. All 20/20 applicable workspace builds passed once in dependency-derived topological order; audit 12 moderate, zero high and zero critical findings |
| Runtime cleanup | Task cache absent; staging root removed; final checkout retained detached and tracked-clean |
| Unchanged Product artifact | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Unchanged Product manifest | Same directory, `artifact-manifest.txt`; 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| Final independent Exact-Head/Artifact Re-Review | `APPROVED`; zero open P0–P3. Bound to executable `0f7ea912d861ecc0bfbf760bfd170496c37220b2` / tree `86f742536b2439955eb8291d53931487b15fff83`, Exact-Head CI `31039633334` attempt 1 at 12/12, corrected 9,219-byte mode-`0444` manifest SHA-256 `7c5931035446faa1d0fc90fe31de8ef123ecba43f6de1c5a0b7a1da47f4b91e4` with 14/14 entries exact, unchanged Bundle/Map/Product APK/Product manifest and the pre-status-synchronization exact three-file R0 Full-Index/Binary diff of 13,485 bytes / SHA-256 `576334a65612239ff8d73caaab122eb6320877b7c901dd6a17c6127e1d47f445` |
| R0 closure synchronization | Documentation only; no source, test, artifact or runtime input changed. No new test, build, CI or artifact generation is claimed for this documentation head; existing Lean-V3, prepublication review, V4 and runtime evidence remains bound as stated above |
| Candidate status / authority | Executable published, V4 green, runtime generated and final Exact-Head/Artifact Re-Review `APPROVED` with zero open P0–P3. Publication of this ADO closure remains pending until commit/push; no future commit is claimed. Product/Validation APKs are unchanged; **DO NOT START** Hardware, ADB, installation or Human V5 without a separate exact one-time Human authorization |

## Historical snapshot — superseded by 2026-08-10 final closure above — PRODUCT-ADB-REVERSE-01

| Evidence | Exact result |
|---|---|
| Correction baseline | `6b7f60ba483a65f1723cbf29e87f8a439f0804c9` / tree `fbe43ebce13fdc0d7851ca8384043b948c9ca898`; local `HEAD` and `origin/main` matched before Development |
| Consumed run | Both owned mappings were created; the operator then stopped before `install-create` with fallback `child_start_transport`; cleanup stopped at `reverse_list`; authority is consumed/non-reusable |
| Exact cause | On the bound USB device, ADB 37 returned `UsbFfs <device-endpoint> <host-endpoint>` from `adb -s <bound-serial> reverse --list`. Mobile `parseDa5V5ReverseMappings` and Synthetic `readMappings` treated column one as a serial and rejected the real transport identifier |
| Product result | No Product package installation, authentication, NFC, Product or time action occurred. Terminal recovery/observation established final null package/process/owned-mapping state |
| P2 process finding | A diagnostic post-failure mapping mutation crossed the authorized operator boundary. It is not authorized run Evidence, cannot be reused and proves neither correction behavior nor a Product/Hardware result |
| Authorized correction | `DA5-V5-PRODUCT-ADB-REVERSE-01`: accept exactly transport token `UsbFfs`; retain identity only through `-s <bound-serial>`, exactly one USB device, exact model/build and continuity; keep exact columns/endpoints/duplicates/mapping sets fail-closed |
| Source scope | `apps/mobile/scripts/da5V5AndroidDevice.mjs`; `apps/synthetic-android-e2e/src/Da5V5AdbController.ts` |
| Focused tests | `apps/mobile/tests/runtime/da5V5AndroidDevice.test.ts`; `apps/synthetic-android-e2e/tests/Da5V5AdbController.test.ts`; hardware-free bundle smoke in `Da5V5ProductStartBundle.test.ts`; separately confirmed scope extension changed only two reverse-list fake rows in `Da5V5CredentialTransfer.test.ts` |
| MJS/focused V1 | `node --check` passed; parser/controller run passed 2/2 files and 128/128 tests; corrected Credential-transfer file passed 13/13 |
| Hardware-free bundle smoke | 1/1 file and 2/2 tests passed; it rebuilt the Synthetic bundle, verified the exact `UsbFfs` boundary is present and reached the existing no-ADB startup guards |
| Mobile V2 | 54/54 files and 1,243/1,243 tests passed |
| Synthetic V2 first run | 13/14 files; 290 passed, one failed and 18 expected skips. Sole failure was the old Credential fake emitting its serial as reverse transport; no Product/source failure |
| Synthetic V2 corrected run | Changed-input rerun after the exact authorized two-line fixture correction: 14/14 files, 291 passed and 18 expected skips, 309 total |
| Tests-inclusive Typechecks | Mobile and Synthetic workspace Typechecks passed. `--listFilesOnly` reported 868 Mobile entries including `da5V5AndroidDevice.test.ts`, and 571 Synthetic entries including `Da5V5AdbController.test.ts`, `Da5V5CredentialTransfer.test.ts` and `Da5V5ProductStartBundle.test.ts` |
| Toolchain | Node `24.17.0`; npm `11.13.0`; Vitest `4.1.9`; TypeScript `6.0.3` |
| Final V3 binding | Exactly once, `PASS`; `HEAD` = `origin/main` = `6b7f60ba483a65f1723cbf29e87f8a439f0804c9`, tree `fbe43ebce13fdc0d7851ca8384043b948c9ca898`, before and after all V3 checks. Pre-ADO-sync exact 11-file Full-Index/Binary patch SHA-256 `a2baca0159e1c64c8b552a2d95b9b29aad5b5196be6aa11c205572df510bf1d6` |
| Final V3 Mobile | MJS syntax `PASS`; 54/54 files and 1,243/1,243 tests `PASS`; tests-inclusive Typecheck `PASS`; captured `--listFilesOnly` 868 entries, SHA-256 `6d29af79968b01bb14f14b0ec3b0b280b4c6fd8dd4e9be04bab3b8cc7f34f3fe`, including the changed Mobile test |
| Final V3 Synthetic | 14/14 files, 291 passed and 18 expected skips `PASS`; tests-inclusive Typecheck `PASS`; captured `--listFilesOnly` 571 entries, SHA-256 `c79f5c314c1bc3df8002bc7ba53d975d4f671c8e49575f12e83b1134dacd84ae`, including all three changed Synthetic tests; build and `node --check dist/da5V5Main.js` `PASS` |
| Post-V3 membership helper / cleanup | After every V3 test, Typecheck, build and syntax check had completed, an `rg` membership invocation under a minimized `PATH` exited 127 because `rg` was unavailable. `/usr/bin/grep` immediately verified the already-created Mobile/Synthetic lists without repeating a gate; both `/tmp` lists were then unlinked |
| Prepublication R0 ADO synchronization | Only the five authorized ADO files changed after V3. The exact six-path executable/test Full-Index/Binary diff SHA-256 remained `551254d0e8a5c0b2f06f309f5cde7b4af30e4bca90b938fd3846977ea05d5da9` before and after this synchronization; no product input or V3 result changed |
| Executable publication | `f8d68c541056cb19e0f222b8a2c04cd3db2b734f` / tree `ddb4a69a2db0167b7a57c4f708f2cc64553f4799`; direct parent `6b7f60ba483a65f1723cbf29e87f8a439f0804c9` / tree `fbe43ebce13fdc0d7851ca8384043b948c9ca898` |
| Publication delta | Exactly 11 files; Full-Index/Binary delta 38,897 bytes; SHA-256 `abec3ca7acbe4619c724fa7dba9422db4dc987d48844f0d39a31043b9d32fdc9` |
| Exact-Head V4 CI | GitHub Actions `30943224381`, attempt 1, 12/12 successful; no retry |
| Fresh read-only Operator Runtime | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/f8d68c54-1406581c`; top level contains exactly `checkout/` plus `operator-runtime-manifest.json`; checkout is exact-head detached/sparse/tracked-clean, `research/` is absent and task cache removed |
| Runtime bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 895,276 bytes; mode `0444`; SHA-256 `1406581cf5974f899cd512511289cbdae47a3f05875ebea5cfbcabc2538701dd` |
| Runtime source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,659,973 bytes; mode `0444`; SHA-256 `3c8d2b1b9e69ede819708c82934b0be45b10f317079bc6d6453ed6cd4d59fc13` |
| Runtime manifest | `operator-runtime-manifest.json`; 7,554 bytes; mode `0444`; SHA-256 `2e20e4b028294527e52fca621467997e2805db28c365b22db7f6d3eba05acd31` |
| Runtime dependency closure | Fresh `npm ci` 695/717; audits report 12 moderate, zero high and zero critical findings; 18/18 builds passed |
| Unchanged Product artifact | Existing Product APK binding is unchanged: 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Unchanged Product manifest | Existing binding is unchanged: 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| Final independent Exact-Head/Artifact Review | Technically enforced sandbox read-only; adversarial write blocked; repository and artifacts identical before/after; final `APPROVED`, zero open P0–P3 |
| Preserved boundaries | Product/Validation APKs, Product rules, NFC, dependencies, lockfile, schema, workflows and ADB routing/device-binding rules unchanged |
| R0 closure synchronization | Documentation only; no source, test, artifact or runtime input changed. No test, build, CI, review or artifact generation is claimed for this future documentation head; the carried evidence remains bound to executable publication `f8d68c541056cb19e0f222b8a2c04cd3db2b734f` |
| Hardware / operational authority | No new ADB, installation, Hardware or Human V5 action occurred or is authorized. Production, production data, deployment and distribution remain separately unauthorized |
| Current disposition | Executable correction technically closed and artifact-bound; final independent Review `APPROVED`, zero open P0–P3. Product/Validation APKs remain unchanged; **DO NOT INSTALL / DO NOT START** |

The first failed Synthetic V2 was investigated and corrected by changing the exact stale fixture
input; it was not an unchanged retry. Existing prior green evidence is not relabeled as fresh
candidate Evidence.

## Prior CI-CLIPBOARD-CLEANUP-01 executable technical-closure evidence

| Evidence | Exact result |
|---|---|
| Published predecessor | `c92744bc35a2c2fca27dd5ff7c54b39a93692fde` / tree `60ef4d73916370367e5259e6557014e0364139b8`; independent INSTALL-02 Review Round 3 `APPROVED`, zero open P0–P3 |
| Predecessor Exact-Head CI | `30926820054`, attempt 1, 11/12; no retry. All INSTALL-02 regressions passed; only Synthetic hardware-free Product-start bundle smoke failed |
| Confirmed finding | `DA5-V5-CI-CLIPBOARD-CLEANUP-01`: pristine startup cleanup invoked macOS-only `pbcopy`/`pbpaste` on Linux before any credential/clipboard action and emitted `da5_v5_cleanup_failed`; Product, installation, database, Hardware and NFC were not involved |
| Regression before correction | Focused 2-file run reproduced exactly three failures: pristine close made two platform calls, zero-confirmed close made two additional platform calls and empty-`PATH` bundle start emitted `da5_v5_cleanup_failed` |
| Correction | Explicit clipboard-zero duty is set before every possible mutation and cleared only after empty-write plus zero-byte readback. Pristine/already-zero-proven close uses no platform process; outstanding duty remains fail-closed; close is idempotent and rejects later injection |
| Independent review / P1 correction | `CHANGES REQUIRED`, exactly one P1: inject could resume from its initial clear after close began and still perform one non-empty write. The correction rechecks the closing latch immediately after the clear and returns `mismatch` before that write; repeated close remains idempotent |
| Prepublication correction re-review | `APPROVED`; zero open P0–P3 |
| Focused V1/V2 | `Da5V5CredentialTransfer.test.ts` plus `Da5V5ProductStartBundle.test.ts`: 2/2 files, 15/15 tests passed. The built-bundle smoke uses empty `PATH`, keeps stdout empty and returns exact stderr `da5_v5_start_failed` |
| Final Synthetic V3 | Exactly once: 14/14 files, 291 passed, 18 expected skips, 309 total; tests-inclusive Synthetic Typecheck `PASS`; normalized `--listFilesOnly` 571 entries, SHA-256 `45ac1d63ca5f619fcb432594b8495ec08968af1aed99edb8c336d357dcb74e5b`, including both changed tests; build and `node --check dist/da5V5Main.js` `PASS` |
| V3 toolchain | Node `24.17.0`; npm `11.13.0`; Vitest `4.1.9` |
| Carried evidence | Unchanged Mobile, backend and dependency evidence carries under Lean V5/ADR-0019 |
| Preserved boundaries | Product/Validation APKs, Product rules, NFC semantics, Dependencies, lockfile, Product/database schema and workflow unchanged |
| Executable publication | `7eead7560b075763a8ef5076d499b621d63dc3c7` / tree `a832bcd574af169fd9600a2a0940f5f5d962914f`; direct parent `c92744bc35a2c2fca27dd5ff7c54b39a93692fde` / tree `60ef4d73916370367e5259e6557014e0364139b8` |
| Publication delta | Exactly eight changed files; Full-Index/Binary delta 32,916 bytes; SHA-256 `c763bee4b070ec56ffbe799485df34e6e003665e39bd9fd0c0fa705b941d3bd8` |
| Publication-delta review | `APPROVED`; zero open P0–P3 |
| Exact-Head V4 CI | GitHub Actions `30930590588`, attempt 1, 12/12 successful; no retry |
| Fresh read-only Operator Runtime | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/7eead756-dbacb6b9`; root contains exactly `checkout/` plus `operator-runtime-manifest.json`; detached exact checkout is tracked-clean, `research/` is absent and task cache removed |
| Runtime bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 894,993 bytes; mode `0444`; SHA-256 `dbacb6b9c5c1a5e1a0960441331580acc6acf8e6f3c99e34985d99d504c80e3f` |
| Runtime source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,659,518 bytes; mode `0444`; SHA-256 `c2e6eeb28be5dc6d0bfcb9ee19804e4ae61ba17143ad59c8d4d152988bdcc6dd` |
| Runtime manifest | `operator-runtime-manifest.json`; 6,815 bytes; mode `0444`; SHA-256 `320efc48f083d9b42bad043eac2e9c81cd0b8c21ea2f04487841666a41f36c32` |
| Runtime dependency closure | Node `24.17.0`; npm `11.13.0`; fresh `npm ci` 695/717; 18/18 runtime dependency-closure builds. Unchanged `package-lock.json` is 356,795 bytes / SHA-256 `b905263b7b303938f8e0a5381f82bb151073588a3176fb14fd84fdd79caf9f1e` |
| Unchanged Product artifact | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Unchanged Product manifest | Same directory, `artifact-manifest.txt`; 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| First final substantive review | No Code, Artifact or CI finding. Formal result nevertheless `CHANGES REQUIRED` with exactly one P2 because the reviewer runtime's read-only boundary was not technically enforced |
| Final independent re-review / P2 closure | Ran wholly under `/usr/bin/sandbox-exec` with `(version 1) (allow default) (deny file-write*)`; adversarial write attempt was blocked with `Operation not permitted`, absence afterward was proved, and repository/artifacts were identical before/after. Final `APPROVED`; zero open P0–P3 |
| Hardware / operational authority | No Hardware, ADB or installation occurred. Product APK is **DO NOT INSTALL** and Operator/Hardware is **DO NOT START** until a separate exact Human authorization. Production, production data, deployment and distribution remain separately unauthorized |
| ADO-only closure synchronization | R0 documentation only. It claims no own test, CI or Artifact execution and does not move reviewed executable head `7eead7560b075763a8ef5076d499b621d63dc3c7`. A later Hardware prompt must separately bind that executable head plus the exact published ADO-closure head |

The executable clipboard correction is technically closed and artifact-bound. This documentation
closure grants no Hardware or operational authority.

## Historical prepublication PRODUCT-INSTALL-02 consumed-run and local-candidate evidence

This section preserves the candidate state before Review Round 3 approval and publication and is
superseded by the current CI-CLIPBOARD-CLEANUP-01 evidence above.

| Evidence | Exact result |
|---|---|
| Consumed baseline | `8723221aba847f778f97febc13f4dd8c1447cac4` / tree `fcb6249a5ccdb402a39f7a0dd7beefb4930651d7` |
| Consumed run | Operator and synthetic runtime start, device preflight, Human tag confirmation and complete Product-APK runtime verification succeeded; installation then disclosed `category=cleanup` and operator cleanup failed |
| Final scoped recovery | Only `tcp:3000` and `tcp:54321` were removed; Product/Validation package/process, reverse/listener and task-runtime state was null; memory-only credential destroyed; no authentication, NFC, Product or time action |
| Confirmed finding | `DA5-V5-PRODUCT-INSTALL-02`: primary cause overwrite; non-durable per-run session/abandon/cleanup state; no closed cleanup failure substage; no distinct install-stream signal category |
| Review Round 1 | `CHANGES REQUIRED`; exactly two P1, four P2 and one P3. Required correction: resource-specific acquisition after proven zero; terminal signal/EOF settlement; closed typed-transient retry classification; one persistent package-removal flight; closed stronger-uncertainty escalation; one absolute uncertain-cleanup deadline; five-file ADO synchronization |
| Local implementation after R1 | One exact control/stream/device/serial transaction; persistent coalesced abandon/cleanup; at most one abandon and one package-removal flight per bound transaction; package/`tcp:3000`/`tcp:54321` each mutable only after proven zero plus its own started/proven mutation; final package observation only; `uncertainty_escalation`; one absolute 60-second deadline; only explicitly typed transient command failures retry once at reattestation/reverse-list/exact reverse-remove; terminal non-rejecting background settlement; primary category plus closed cleanup evidence; distinct `signal_abort` |
| Review Round 2 | `CHANGES REQUIRED`; exactly one P1 and no P0, P2 or P3. A pre-readiness signal could complete null-resource cleanup while Guard, PostgreSQL capability or Environment acquisition remained pending, so a later successful assignment could escape the persistent cleanup flight |
| Local implementation after R2 | Immediate failure, mutation-abort and input-close latching is unchanged. The one persistent cleanup flight now waits for a separate monotone, non-rejecting startup-acquisition settlement. Normal startup settles directly after lifecycle binding; catch settles before its own cleanup. Settlement does not depend on `handleSignal()`, and late Guard/capability/Environment ownership reaches exactly one coalesced cleanup |
| Changed executable/test scope | Mobile `da5V5AndroidDevice.mjs`, its declaration and focused test; Synthetic `Da5V5OperatorLifecycle.ts`, `da5V5Main.ts`, Product-start bundle test and profile test |
| Changed ADO scope | `ADO/README.md`, Project Status, Risk Register, DA5 V5 Runbook and DA5 V5 Evidence only |
| Current executable/test input | Compared with composite carry-source snapshot `bcddf757c7ef64e82c167b39f20d763fdb159ceb` / tree `ee00e3246f2cd5498cc67eabf9b2f7e2fc19205b`, exactly the seven executable/test paths named above differ. Round 2 changes only the three existing Synthetic paths `Da5V5OperatorLifecycle.ts`, `da5V5Main.ts` and `Da5V5Profile.test.ts`; their pre-Round-2 V3 bytes are historical |
| Historical V3-start candidate receipt | Against baseline `8723221aba847f778f97febc13f4dd8c1447cac4` / tree `fcb6249a5ccdb402a39f7a0dd7beefb4930651d7`, exactly 12 tracked paths; full-index/binary delta 136,943 bytes; SHA-256 `3f599910da2629ed47185bd4cf9bebc63345ddb029bcebb50551ff9c5cee8f66`. This binds only the pre-Round-2 V3 code plus old-ADO snapshot and is not current decision evidence |
| Historical pre-Round-2 V1/V2 | MJS syntax pass; focused Mobile device 99/99 and ADB-child boundary 22/22; focused Synthetic profile 33/33 and Product-start bundle/build hardware-free smoke 2/2; full Mobile 54/54 files and 1,243/1,243 tests; full Synthetic 14/14 files, 283 passed and 18 expected skips; both tests-inclusive Typechecks with required changed-test membership |
| Round-2 Development V1 | Focused Synthetic profile 36/36 passed, including deterministic deferred signal races during Guard, PostgreSQL capability and Environment acquisition plus repeated terminal cleanup-rejection settlement. Synthetic workspace Typecheck passed and includes the changed profile test. No Full Synthetic or final composite Lean-V3 was run in Development |
| Final Lean-V3 pre-ADO-sync receipt | `PASS`; unchanged HEAD/origin `8723221aba847f778f97febc13f4dd8c1447cac4` / tree `fcb6249a5ccdb402a39f7a0dd7beefb4930651d7`; exactly 12 tracked paths; full-index/binary delta 158,738 bytes; SHA-256 `ef86b48ad5882b1020b593a8a82139ff618a5b0dd0ef7d2eff2e1433493b557a` |
| Final Lean-V3 fresh Synthetic tests | Full Synthetic 14/14 files; 286 passed, 18 expected skips, 304 total |
| Final Lean-V3 fresh Synthetic Typecheck | Workspace Typecheck `PASS`; normalized `--listFilesOnly` 571 entries, SHA-256 `45ac1d63ca5f619fcb432594b8495ec08968af1aed99edb8c336d357dcb74e5b`; includes `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts` and `apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts` |
| Final Lean-V3 fresh Synthetic build/syntax | Synthetic build `PASS`; final `node --check apps/synthetic-android-e2e/dist/da5V5Main.js` `PASS` |
| Final Lean-V3 fresh local bundle | `apps/synthetic-android-e2e/dist/da5V5Main.js`; 894,145 bytes; mode `0644`; SHA-256 `6612aca547727e1b77b2e0deb88bd029f80fba0eb30ca39c962fe84fbb9a5f19` |
| Final Lean-V3 fresh local source map | `apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,658,075 bytes; mode `0644`; SHA-256 `a010852ceebe55878e7b211b183ea785a86a812336ab73f0eff246e6da992779` |
| Final Lean-V3 carried Mobile evidence | No Mobile byte changed after the immediately preceding pre-Round-2 Lean-V3. Carried, not freshly repeated: MJS syntax `PASS`; Mobile 54/54 files and 1,243/1,243 tests; Mobile Typecheck `PASS`; normalized `--listFilesOnly` 868 entries, SHA-256 `11d72c73fe9c420a4c7b4aaadbdcad91187ec78500b5f7c8b68c9dd07f2f82e6`, including `apps/mobile/tests/runtime/da5V5AndroidDevice.test.ts` |
| Historical V3 environment | Darwin `25.5.0` / macOS `26.5.1` / arm64; Node `24.17.0` at `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`, 120,591,840 bytes, SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`; npm `11.13.0`, CLI `/Users/timbartz/.nvm/versions/node/v24.17.0/lib/node_modules/npm/bin/npm-cli.js`, SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7`; Vitest `4.1.9`; TypeScript `6.0.3`; esbuild `0.28.1`, native binary `node_modules/@esbuild/darwin-arm64/bin/esbuild`, 10,573,778 bytes, SHA-256 `e2dc9a52440a2a34f09434a2f4843cb1e30f84e40dcf238976ec61ef8cd7f36a` |
| Carry-forward source | Composite `bcddf757c7ef64e82c167b39f20d763fdb159ceb` / tree `ee00e3246f2cd5498cc67eabf9b2f7e2fc19205b`; underlying full source `613feb8d4bfa71e48c75cf933f6aea422404096c` / tree `b1a73234abfbd19623a96c7ba330da731d7320ea` |
| Carried unchanged workspace evidence | Only the remaining 19 workspace test suites, 19 workspace Typechecks and 19 workspace builds; Guard 89/89; unchanged privileged database and migration evidence; C3B and Android export/APK verification; complete cleanup |
| Carried dependency/security evidence | `npm ci`, `npm ls --all`, runtime/full audits with zero high and zero critical findings, bound to unchanged `package-lock.json`, 356,795 bytes, SHA-256 `b905263b7b303938f8e0a5381f82bb151073588a3176fb14fd84fdd79caf9f1e` |
| Evidence replacement/carry boundary | Fresh Synthetic results replace the pre-Round-2 Synthetic checks and bundle/map. Only the byte-identical Mobile evidence is carried as stated above; all other documented unchanged AVS evidence carries from the bound composite source. No runtime manifest or publication is claimed |
| Cleanup after V3 | Temporary normalized-membership receipt roots are absent; carried task cleanup remains complete |
| Preserved boundaries | Product/Validation APKs, dependencies, lockfile, schema, workflow, Product rules, NFC semantics and existing create/write/commit, User-0, byte/SHA, timeout, provenance, zeroization and security rules unchanged |
| Not performed | No fresh Mobile rerun, ADB, installation, Hardware, Product-Human rerun, CI, V4, artifact/runtime publication, production, deployment or distribution. No fresh rerun of carried `npm ci`/`npm ls`/audit, remaining workspace, Guard, privileged database/migration, C3B, Android export/APK or cleanup evidence |
| Remaining gates | Independent final Review Round 3, V4, exact publication/runtime binding, final approval and a new exact one-time Human authorization |

This historical evidence described an uncommitted local candidate on the consumed baseline.
Rounds 1 and 2 remain historically `CHANGES REQUIRED`; the Round-2 correction had final Lean-V3
`PASS` but was not yet independently approved at this recorded point. It claimed no publication,
CI, V4, Hardware or Product result. Independent final Review Round 3 was pending at that time.

## Historical snapshot — superseded by 2026-08-10 final closure above — PRODUCT-INSTALL-01

| Evidence | Exact result |
|---|---|
| Baseline | `7b971070c7fc108fea4ae92db30b87f340b24e91` / tree `a053d34581687b541fc0fe67a477250bb24319c3`; `HEAD`, `main` and local `origin/main` matched before correction |
| Consumed run | Artifact verification and scoped `tcp:3000` / `tcp:54321` reverse creation completed; then `operator_command_failed` and automatic `da5_v5_cleanup_failed`; exact install subcause not retained |
| Final recovery | Only those mappings were removed; terminal cleanup matched; Product package/process, owned listeners and task database null; no Product action |
| Confirmed finding/correction | `DA5-V5-PRODUCT-INSTALL-01`; Product-only exact create/write/commit, memory-only session, exact byte/receipt/provenance and mandatory pre-commit abandon |
| Disclosure | Only `artifact_reverify`, `child_start_transport`, `stdin_pipe`, `timeout`, `child_exit`, `package_manager_receipt`, `installed_provenance` or `cleanup`; no raw error/stderr/path/serial/PackageManager detail |
| Review Round 1 / correction | `CHANGES REQUIRED`, exactly two P2: central typed timeout/child-exit classification was incomplete at reattestation/provenance, and the default stream runner was not dependency-bound to control ADB. Both are corrected; six boundary/type regressions, exact dependency integration and incomplete-custom-pair fail-closed coverage are green; Round 2 followed as recorded below |
| Review Round 2 / Development Round 3 | `CHANGES REQUIRED`, exactly one P2: `runAdbBinaryDigest` handled nonzero or signaled child close as a generic error, so actual installed-APK digest provenance retained `installed_provenance` instead of `child_exit`. Round 3 rejects both terminal forms with `Da5V5AndroidCommandExitError`, without raw output/signal/exit detail and without changing timeout, transport, provenance or cleanup behavior. The actual System binary-digest provenance path is covered for both nonzero and signal exit |
| Round 3 focused V0–V2 | MJS syntax green; affected Mobile Installer suite 75/75; tests-inclusive Mobile Typecheck green with `da5V5AndroidDevice.test.ts` membership proven |
| `DA5-V5-SECURITY-BRACE-01` | Separately Human-authorized lock correction: only `node_modules/brace-expansion` changes `5.0.8` to patched `5.0.9` through version/resolved/integrity; `minimatch@10.2.5` and its `brace-expansion` range `^5.0.5`, `balanced-match`, every package manifest and all other lock data are unchanged. A 64-MiB/5-second/output-bounded child regression covers `GHSA-rgw5-rvv9-x895` without exposing the parent test process to the OOM path |
| Fresh V1/V2 | Changed Mobile installer/stream files 86/86 tests; Product bundle/security test 2/2; both tests-inclusive Typechecks with changed-source membership and Synthetic build green; `npm ls --all` exit 0. The unchanged MJS syntax pass is carried from the immediately preceding focused round |
| Security audit | Runtime and full audit each exit 0 with 12 moderate, zero high and zero critical findings; `brace-expansion` advisory absent |
| Final post-correction V3 binding | `PASS` on snapshot `bcddf757c7ef64e82c167b39f20d763fdb159ceb` / tree `ee00e3246f2cd5498cc67eabf9b2f7e2fc19205b` |
| Final V3 changed-input checks | MJS syntax pass; Mobile 54/54 files and 1,219/1,219 tests; tests-inclusive Mobile Typecheck pass; exactly Synthetic `Da5V5ProductStartBundle` plus `Da5V5Profile` at 2/2 files and 33/33 tests; tests-inclusive Synthetic Typecheck pass; Synthetic build pass |
| Immediate prior full-V3 carry-forward source | Snapshot `613feb8d4bfa71e48c75cf933f6aea422404096c` / tree `b1a73234abfbd19623a96c7ba330da731d7320ea`; package lock and carried verification inputs unchanged |
| Carried V3 builds / Typechecks | Under AVS risk-adaptive carry-forward, all 20 workspace builds and 21/21 workspace Typechecks remain green; Mobile and Synthetic Typechecks were additionally rerun on the final snapshot as recorded above |
| Carried V3 Product tests / Guard | All remaining unchanged locally applicable tests carry forward. The first six Guard failures under `/private/tmp` were producer-owner/mode environment mismatches; exactly the two affected unchanged Guard files passed 89/89 from a user-owned Safe Root |
| Carried V3 privileged boundaries | Unchanged privileged B1, Mobile-Work and Time-Review database boundaries stopped locally because `B1_DATABASE_URL` or `taptime_da3` was unavailable; their already bound green CI evidence carries under ADR-0019 and no test was repeated |
| Carried V3 dependency/security | `npm ls --all` green; runtime and full audit each 12 moderate, zero high and zero critical findings |
| Carried V3 cleanup | Isolated PostgreSQL/Guard process, port `55435`, task `t5` temporary roots, worktree, cache and TMP fully removed; pre-existing untracked `app.json` untouched |
| Independent Review Round 3 | `APPROVED`; zero open P0–P3. `DA5-V5-PRODUCT-INSTALL-01` and `DA5-V5-SECURITY-BRACE-01` are technically prepublication approved |
| Execution publication | Commit `354e2dff2877ee1681f222f2616b4ad318296023` / tree `84542b4a9efd499f1f6ae43610cb93bf89c8e299`; direct parent `7b971070c7fc108fea4ae92db30b87f340b24e91` / tree `a053d34581687b541fc0fe67a477250bb24319c3`; exactly 12 changed files; full-index/binary delta 71,761 bytes / SHA-256 `7d69b8055c752a2afe4f6644b5e9b463d3b256a4eb171a19ae535e43497aa84f` |
| Exact-Head CI | GitHub Actions `30848391390`, attempt 1, 12/12 successful |
| Operator Runtime | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/354e2dff-ced93b4b`; exact clean detached checkout at the execution commit/tree; root contains only `checkout/` and `operator-runtime-manifest.json` |
| Runtime Bundle | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 867,317 bytes; mode `0444`; SHA-256 `ced93b4b6ce7a82538bedbde301b2cf49615936dee275ce15ebb0dee993aae12` |
| Runtime Map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,613,470 bytes; mode `0444`; SHA-256 `82add1a869444e2d3e6f63005e1fa2f3bb73eb536045ccbd37e35205134347a6` |
| Runtime Manifest | `operator-runtime-manifest.json`; 7,545 bytes; mode `0444`; SHA-256 `cb44082adfdcfeeef673f51ee14f302a8002b0e1bd465e322a52dd50ec322dd9` |
| Artifact toolchain | Only Node `24.17.0` / npm `11.13.0` evidence is valid. The initial Node-26 setup was explicitly discarded and fully replaced before all 20/20 artifact builds, syntax and hardware-free profile-gate start smoke passed |
| Lock / audit | `package-lock.json` 356,795 bytes / SHA-256 `b905263b7b303938f8e0a5381f82bb151073588a3176fb14fd84fdd79caf9f1e`; runtime/full audits zero high and zero critical findings |
| Unchanged Product artifact | APK 95,522,751 bytes / mode `0444` / SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8`; artifact manifest 1,968 bytes / mode `0444` / SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| Final Exact-Head/Artifact review | `APPROVED`; zero open P0–P3. Execution head, CI, clean checkout, runtime files, manifest bindings and unchanged Product artifact are accepted; `DA5-V5-PRODUCT-INSTALL-01` and `DA5-V5-SECURITY-BRACE-01` are technically closed |
| Hardware / remaining authority | No Hardware, ADB or installation action occurred during correction publication or artifact generation. The failed run remains consumed and cleaned. A new Human/Hardware V5 requires separate one-time exact authority; production/deployment/distribution remain unauthorized |

This final ADO-only closure synchronization claims no test, CI, Artifact or Human run for its own
documentation head and grants no new Product/Human V5, production, deployment or distribution
authority.

## Historical snapshot — superseded by 2026-08-10 final closure above — PRODUCT-START-BUNDLE-01

The Product-Hardware authority on `4dff147031e2d8ebbd95b9451705f66b35fbacd3` / tree
`be05ca8e893a00dbd95f84e7133e73f080f96547` is consumed. Starting the bound standard operator
stopped before database, device preflight and installation with `Synthetic E2E release APK is
missing`. The direct-CLI predicate in `verifySyntheticE2eAndroidRuntime.mjs` compared its
importing `import.meta.url` to `argv[1]`; after bundling, both referred to `da5V5Main.js`, causing
the imported verifier to use its unintended default build-directory APK path.

Authorized read-only post-failure inspection established Product and Validation package/process
absence, zero ADB reverse mappings, zero synthetic listeners, no new task PostgreSQL/runtime
instance and unchanged repository/remote state. No Product, database, installation, NFC or Human
result was produced.

| Binding | Exact value |
|---|---|
| Product correction | `e939d8c40e7994c72ab1cd2e68e47f189ed8abc1` / tree `dfd5e160c6c14d09daadcc192afaf81daf1ad060` / parent `4dff147031e2d8ebbd95b9451705f66b35fbacd3` |
| Scope | `apps/mobile/scripts/verifySyntheticE2eAndroidRuntime.mjs`; `apps/mobile/tests/runtime/syntheticE2eAndroidRuntimeVerifier.test.ts`; `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts` |
| Full-index binary delta | 7,545 bytes; SHA-256 `96fb2b3110fbffce95143000601cc8f451766f3cb88655844730f3ff136e7235` |
| Prepublication review | `APPROVED`; zero open P0–P3 |

The correction compares the current module URL to the verifier's own sibling URL before allowing
direct CLI execution. Unbundled direct CLI remains fail-closed for missing/wrong artifacts;
library import and bundled Product-operator start are side-effect-free until the operator's
existing exact external Product-APK boundary runs.

Fresh Node `24.17.0` / npm `11.13.0` local evidence:

- `npm ci` installed 695 packages from the unchanged lockfile;
- all 20 applicable builds completed after dependency-order continuation;
- 21/21 workspace typechecks passed, including Mobile and Synthetic test sources;
- focused verifier tests passed 12/12 and the actual built-bundle start regression passed 1/1;
- Mobile passed 54 files / 1,198 tests; Synthetic passed 280 with 18 unchanged PostgreSQL-gated
  skips; every other non-database workspace suite passed;
- unchanged database evidence was carried from exact parent CI `30829321321` under ADR-0019 and
  rerun by Exact-Head CI `30834192270`, attempt 1, which passed 12/12 without retry;
- isolated Runtime-Guard artifact verification, PostgreSQL capability, migrations, Auth/API
  environment creation and initial DA5 status matched; listeners and task PostgreSQL state were
  zero after cleanup; and
- full and runtime audit reported zero High/Critical vulnerabilities.

The exact read-only operator runtime candidate is:

| Runtime entry | Exact binding |
|---|---|
| Root | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/e939d8c4-379b2d9b` |
| Checkout | `e939d8c40e7994c72ab1cd2e68e47f189ed8abc1` / tree `dfd5e160c6c14d09daadcc192afaf81daf1ad060`; `research/` excluded; tracked clean |
| Entrypoint | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 846,602 bytes; mode `0444`; SHA-256 `379b2d9b32a26f3fb120b4247431644ae65c4eebe257893948a8e252989dd66b` |
| Source map | same directory, `da5V5Main.js.map`; 1,579,813 bytes; mode `0444`; SHA-256 `4c61abcfc81b77afa223e207c56a4fef05e249a2659129d32f2f2992b2468ed8` |
| Runtime manifest | root `operator-runtime-manifest.json`; 4,977 bytes; mode `0444`; SHA-256 `2b041dee0e945b680da15764b7584eced36c19d3860f6b4067cfc400988c627b` |

The Product and Validation APK/manifest pairs remain byte-exact under the prior Lean bindings.
Publication `e5a566bc60be7dc7647183bbbcfb9947ac3a6fb7` / tree
`05a0f4c2ff4006a73ec18b2d19c74cb903d064f0` passed Exact-Head CI `30834192270`, attempt 1,
12/12 without retry. Final independent Exact-Head/Artifact review returned `APPROVED` with zero
open P0–P3 and confirmed the Runtime/Map/Manifest bindings and the byte-exact unchanged Product
and Validation artifacts. The corrected candidate is hardware-gate ready. No Hardware, ADB,
installation, production, production-data, production/distribution-signing, deployment or
distribution authority or evidence is claimed. This R0 Evidence sync carries exact CI/review
evidence from the executable publication and claims no CI for its documentation-only head.

## Historical snapshot — superseded by 2026-08-10 final closure above — PRODUCT-PREINSTALL-01

The matched read-only inspection on `304ddb159f3def2b50d059678086e02aacbd51c9` / tree
`97940b61ce76017c9c295b1cb43fe007727f2ca9` did not start the Product operator or perform any
installation/Product/database action. Its Human authority was unconsumed but is superseded.

Confirmed finding `DA5-V5-PRODUCT-PREINSTALL-01` was limited to the Product operator treating
Android-15 `pm path` exit 1 with empty output as a package-null mismatch. Executable correction:

| Binding | Exact value |
|---|---|
| Product correction | `e525a9ad2b937356002928028fddaaa3e1dca301` / tree `11aa7fdf526c9b149af5dc60ef5567fb727a24fe` / parent `304ddb159f3def2b50d059678086e02aacbd51c9` |
| Scope | `apps/mobile/scripts/da5V5AndroidDevice.mjs`; `apps/mobile/tests/runtime/da5V5AndroidDevice.test.ts` |
| Canonical delta | 18,520 bytes; SHA-256 `0e22a480f3fca20183e3d38780f886e41338b8e61fae1673e51a9ea884ae8c17` |
| Fixture correction | `4329fec6783907b3549322a344085b96e7d00d16` / tree `4165f9d88d07f80f0b3a4772764c53aa2f515e0f` / parent `e525a9ad2b937356002928028fddaaa3e1dca301`; only `apps/synthetic-android-e2e/tests/Da5V5CredentialTransfer.test.ts`, +13/-1 |
| Replacement V4 | Exact-Head CI `30829321321`, attempt 1, 12/12; no unchanged retry |

Exact empty User-0 package-list output proves absence; only the canonical package line proves
presence and permits strict `base.apk` inspection. All other responses fail closed. Strict
main/secondary process parsing and joint package/process/reverse-null proof are unchanged.

Actual local verification on a fresh task-owned dependency state:

- `npm ci` completed; 20/20 applicable builds ran in dependency order;
- Mobile and Synthetic tests-inclusive typechecks passed;
- Mobile passed 54/54 files and 1,193/1,193 tests;
- focused Product-operator verification passed 3/3 files and 71/71 tests;
- built operator bundle syntax passed; and
- Product no-install artifact preflight returned `match`.

Initial pre-build typecheck and incorrect `/private/tmp` Runtime-Guard context were orchestration
stops; continuation changed build/TMPDIR state and was not an unchanged retry. CI `30828750551`
was 11/12 only for the historical Credential-ADB fake. Its focused correction is independently
`APPROVED`; replacement CI passed 12/12. Both implementation reviews have zero open P0–P3.

The exact read-only operator runtime is:

| Runtime entry | Exact binding |
|---|---|
| Root | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/e525a9ad-00932e6a` |
| Checkout | `e525a9ad2b937356002928028fddaaa3e1dca301` / tree `11aa7fdf526c9b149af5dc60ef5567fb727a24fe`; tracked clean |
| Entrypoint | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 846,453 bytes; mode `0444`; SHA-256 `00932e6a1f8ba8d6ff95ff92ec8437b99c48a3f7e97e6b679f205b8f254b66c6` |
| Source map | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js.map`; 1,579,577 bytes; mode `0444`; SHA-256 `2d4064af3424779f05cabab6d8e6f8bd66ad2d33fa08f4ffe0a654abec29eb1b` |
| Runtime manifest | root `operator-runtime-manifest.json`; 4,475 bytes; mode `0444`; SHA-256 `6ef434d2c1a5684b19bb9a349edc6fd3eefa3aa4d6f8846ba1e5f932de14708b` |

Final independent Exact-Head/Artifact review verified code, CI and runtime technically and
returned `CHANGES REQUIRED` solely for P3 missing ADO synchronization. This exact five-file R0
candidate is that synchronization; it claims no CI for its future documentation-only head and
requires an independent Exact-Delta re-review before any new Hardware authority. Existing Product
APK/manifest and Validation artifacts remain byte-exact under the Lean bindings below. No ADB,
Hardware, installation, production, production-data, signing, deployment or distribution action
is authorized or evidenced here. DA5 and R-034 remain open only for the future fresh Product
Human/Hardware V5 gate.

## Historical snapshot — superseded by 2026-08-10 final closure above — Lean V0–V4 closure

The Human Architect accepted ADR-0019 and the Lean authorization at
`83635335aa4f547dc8994243c604dacf9797f593` / tree
`40b7655a94e607b8afe19f90f42a95f42ee6d582`; independent architecture/authorization review
returned `APPROVED` with zero open P0–P3. Lean stages 1–5 completed on executable candidate
`1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree
`2db756832a81f07cdb1a927ff3076320cc253960`. The exact delta is limited to these six executable
files:

- `apps/mobile/scripts/da5V5AndroidArtifact.d.mts`
- `apps/mobile/scripts/da5V5AndroidArtifact.mjs`
- `apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.d.mts`
- `apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs`
- `apps/mobile/tests/runtime/da5V5AndroidArtifact.test.ts`
- `apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`

There is no dependency, lockfile, schema, workflow or Product-rule change. Prepublication binding
review returned `APPROVED` with zero open P0–P3.

Fresh isolated V3 established `npm ci` with 695 packages, every applicable build and every
workspace typecheck passing. All suites completed with 2,835 passed tests plus exactly two
expected/disclosed B1 skips and no final failure. Reported suite counts include Core 290, Mobile
1,176, Admin 87, Synthetic 297, B1 39 plus two skips, MobileWork 10 and TimeReview 11. The initial
convenience-command stops were
orchestration mismatches: non-topological build order, a nonexistent generic Mobile build and
missing suite-specific database environment. Continuation changed environment/dependency state;
it was not an unchanged retry. PostgreSQL is stopped, its port is closed and the task worktree,
cache and cluster are absent.

V4 CI `30786622180`, attempt 1, ran on the exact executable head and passed 12/12 without retry.
Final independent Exact-Head/Artifact review returned `APPROVED` with zero open P0–P3.

| Fresh artifact | Exact binding |
|---|---|
| Product source | `83635335aa4f547dc8994243c604dacf9797f593` / tree `40b7655a94e607b8afe19f90f42a95f42ee6d582` |
| Product APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Product manifest | Same directory, `artifact-manifest.txt`; 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| Validation source | `83635335aa4f547dc8994243c604dacf9797f593` / tree `40b7655a94e607b8afe19f90f42a95f42ee6d582` |
| Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-83635335aa4f-9908d76ea97a1ae9/app-release-9908d76ea97a1ae9.apk`; 65,634,553 bytes; mode `0444`; SHA-256 `9908d76ea97a1ae95ad4a08b24f626d72e8cfc6ddb20d3d1629fa822686c9d29` |
| Validation manifest/closure | Same directory, `manifest-83635335aa4f.json`; 6,855 bytes; mode `0444`; SHA-256 `ab6a02980058259ae719bc597cfa4e7ba25ef0da28d2de4f0ee039884f373298`; 33-record sourceClosure digest `a50ec386e87217eb9a02fede94fd37a97fefb0734fa5a9791b7ff142a9c44c2f` |

These bindings supersede later historical rows labelled `Current`. Automated Lean V0–V4 is
complete and the candidate is hardware-gate ready. DA5 and R-034 remain open only pending a
separately authorized Product Human/Hardware V5; the Product App is not installed. No
Hardware/ADB/install action and no production, production-data, production-signing, deployment or
distribution action is authorized. Attempt 15 remains consumed with no retry. This R0 Evidence
sync carries CI/review evidence from the exact executable candidate and claims no CI for a future
documentation-only synchronization head. It introduces no Product, Business or architecture
decision.

## Attempt-15 terminal evidence and Lean V5 candidate boundary

Attempt 15 executed once on publication commit
`456da51150f8748a647ab46aa10fd0e1f25b54bf`, tree
`a4ba688a55e6302f1588cc3ceda48d9a63c4933b`, and is consumed fail-closed. Its immutable
mode-`0555` Evidence root contains exactly these mode-`0444` entries:

| Entry | Bytes | SHA-256 |
|---|---:|---|
| Receipt | 151,401 | `b27b17620aa659cec5c820ff0fdb97c2b33adc40adc4e68bce6a043daad5ac3f` |
| Precleanup snapshot | 2,503 | `3fdf644461cbd3bc96576d9cf36d2b6292be8101bdd4af74c739a7810021b5a1` |
| Evidence manifest | 1,160 | `d50c50a4b8dae5fcb356dc790e1eb8ebe69b0612c853119bc7e44748b53ceacb` |

All 45 records exist: 30 passed, two failed and 13 `not_run_hard_stop`. Gate 28
`MOBILE_FOCUS_TEST` failed with `unexpected_output_root`; the mapped child exited 0, stdout was
322 bytes, stderr was zero bytes and quality-failure count was zero. Gate 45 records
`hard_stop_recorded`. Cleanup and Postcleanup completed, artifact is `null`, and
`raw_output_preserved` is false. Attempt 15 has no retry, repair or resume path.

Independent failure review returned `CHANGES REQUIRED`: Gate 28's output allowlist is statically
incomplete because `apps/mobile/vitest.config.ts` has no `cacheDir` and Vite 8.1.3 resolves the
nearest package cache to `apps/mobile/node_modules/.vite`. Because raw run paths were deliberately
not preserved, that concrete run path is an inference, not observed Evidence. No Product defect
is proven. The accompanying P3 requires this current-truth synchronization.

The Human Architect chose the prospective ADR-0019 Lean V5 profile instead of an Attempt-16
cache-allowlist correction. Historical Evidence remains immutable. The new ADO-only candidate has
not received independent approval or focused publication and creates no Product, CI, artifact,
R3, Hardware/Human V5, production, deployment or distribution evidence.

## Historical superseded Attempt-14 terminal evidence and prospective Attempt-15 output-binding candidate

Attempt 14 executed once on publication `7f6c94886b4dff263e364ea8860b5de1b98b3b53` / tree
`c6df9d7b05374f2baba369d3ca163ea83048b68a` and is consumed fail-closed. The immutable mode-`0555`
root `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt14-4dad93bd-3cc91245`
contains exactly:

| File | Mode | Bytes | SHA-256 |
|---|---:|---:|---|
| `attempt14-command-receipt.jsonl` | `0444` | 110,812 | `6001c9786038acc8d76e08f9842ccd3b84dc714017134f3aad8df1e5ac779f88` |
| `attempt14-precleanup-snapshot.json` | `0444` | 2,490 | `b75dd8ae0f973171f3806c03f963a4f500901e968ef8b2b99ab3cda60b0219bb` |
| `attempt14-evidence-manifest.json` | `0444` | 1,147 | `53987c9676748016e7e1d16cfac8306266622d6e9a25102e86bb5c834cf5588c` |

All 45 records exist: six passed, two failed and 37 `not_run_hard_stop`. Gate 4 `NPM_CI` failed
with `unexpected_output_root` after its mapped process exited 0 with stdout 0 bytes and stderr 0
bytes. Quality-failure count is zero. Cleanup and Postcleanup completed, artifact is `null`, and
`raw_output_preserved` is false. Attempt 14 has no retry, repair, resume or execution path; this
evidence proves no Product, test, Hardware or Human-V5 cause or result.

The fresh prospective candidate root is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-executor-4dad93bd-cfea2c8a-r1-outputbind`:

| Entry | Mode | Bytes | SHA-256 |
|---|---:|---:|---|
| root | `0555` | — | — |
| `attempt15-executor.mjs` | `0444` | 410,449 | `19fe8fe403c230ea0bd914d7e7beb54552954b161bf92033483d92c9a17b6769` |
| `attempt15-executor-manifest.json` | `0444` | 4,782 | `ecc5c2ced55db323bc02af9cf225161171b3bc59f0ed96c95da821422ef2c440` |

The manifest byte-binds the consumed Attempt-14 Evidence and unchanged readonly Attempt-14
candidate. Source remains `4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / tree
`d44bc534c16866dbc16cd889098e6ca33d75d1f5`; Synthetic and Node remain exact. The original
Attempt-12 command map remains 222,596 bytes / SHA-256
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`. Only its adapted
Attempt-15 copy adds the bounded NPM_CI root derivation.

Source-lock evidence is exact commit `4dad93bdbc3ccd3e09e2bcfba3680130a90e2799`, blob
`77555096088f864860f2b6c75f51d364a7349d65`, 356,795 bytes and SHA-256
`62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470`. Parsing that exact blob
against the exact 21-workspace boundary yields exactly 34 direct workspace install nodes and 17
workspace `node_modules` roots. The sorted compact root list has SHA-256
`13457aaa6dbfe55870b5dcc813eb3fd602d9bf0c3939378b89282c0ac087131f`. Adding only unchanged root
`node_modules` yields exactly 18 internal roots and SHA-256
`8f2294960bc1db56e066acc987705918f914a5dd628ee3ff2f60c371ce4ce856`; the exact cache remains the
sole external root. Fixtures prove every individual workspace root and root/cache acceptance,
unknown `node_modules` and adjacent dist/source rejection, absolute/traversal rejection,
missing/malformed/oversize/identity drift, workspace/count/digest drift, unchanged gate order,
hard stop before later gates and terminal zero-state cleanup.

Development verification actually executed:

- V0 baseline check: `HEAD` and local `origin/main` both
  `7f6c94886b4dff263e364ea8860b5de1b98b3b53`, tree
  `c6df9d7b05374f2baba369d3ca163ea83048b68a`;
- V1 `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check`: passed with no output;
- V2 bounded no-mutation self-test: `PASS`, 387/387 fixtures, zero failures, 45 gates and 25
  collectable gates;
- fixture-name-set SHA-256:
  `7e77005f392e87a93937e823d4452b99f24538593dec55add66b6d9d135743a5`;
- empty failure-set and empty quality-ledger SHA-256:
  `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`;
- maximum quality-ledger SHA-256:
  `4c082e9cf0d48396804087281624303efaa441b855dbfad71f94250a81edc9b3`;
- exact Node identity, Attempt-14 Evidence identity, superseded-candidate identity and source
  lockfile identity all matched; and
- fresh Attempt-15 checkout/cache/log/config/evidence/artifact/registration state was absent
  before and after self-test.

No development fixture failed and no correction retry was needed. No Attempt-15 receipt,
snapshot, Evidence root, execution artifact, checkout, dependency install, build, test suite, CI,
ADB, installation, Hardware or Product state was created.

Attempt 15 remains **PROSPECTIVE / READ-ONLY / NOT EXECUTED / DO NOT EXECUTE WITHOUT A FUTURE
SEPARATE EXACT RUN AUTHORIZATION**. This Evidence entry is Development-reported and does not claim
independent review, publication, CI, final review or run completion. The future publication must
be one caller-bound child of `7f6c948…` / tree `c6df9d7…`; the complete external review,
publication, local R3, V4, final independent approval and Human one-run chain remains pending.

## Historical superseded Attempt-13 terminal evidence and Attempt-14 candidate evidence

Attempt 13 is consumed fail-closed. Its mode-`0555` evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt13-a0359a87-483fcf40`
contains exactly:

| File | Mode | Bytes | SHA-256 |
|---|---:|---:|---|
| `attempt13-command-receipt.jsonl` | `0444` | 108,071 | `6dacaad7db7bcec61f591724b3bcf6ce30aad88ecd2d60e05e301c3ca79285ae` |
| `attempt13-precleanup-snapshot.json` | `0444` | 2,503 | `ea6b71d50122aefce343055cdef00422331c05247191beef1042ab6a6a39d74e` |
| `attempt13-evidence-manifest.json` | `0444` | 1,160 | `2a2a19965a0708051dff7a7eda86eb4416c60b3f4dacb162d7590b2e9bd0a474` |

The 45 records are five passed, two failed and 38 hard-stop omissions. Gate 3
`SOURCE_TOOL_BINDING` failed with `identity_byte_limit`; quality-failure count is zero,
Cleanup/Postcleanup completed, artifact is `null` and raw output was not preserved. Independent
review reported the accepted P2/P3 correction findings. No retry, repair, resume, Product result,
test cause, Hardware result or Human-V5 result follows.

The unchanged R6 executor root remains mode `0555` with exactly its two original mode-`0444`
entries and hashes. It is superseded by the read-only Attempt-14 execution/publication candidate
root
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind`:

| Entry | Mode | Bytes | SHA-256 |
|---|---:|---:|---|
| `attempt14-executor.mjs` | `0444` | 388,219 | `89c283b211456a1cf7ae20ee4ae551d7ef8a6a17dd443f541dd0cd2e314cfbb9` |
| `attempt14-executor-manifest.json` | `0444` | 3,729 | `c118bd24fe455f944bf81ccf10faeef7dea89f41f2b3490ee9470ad2228f69f1` |

The new manifest binds the consumed evidence, R6 supersession, immutable original
candidate/closure history, corrected source/tree, 94,403-byte Synthetic blob and exact inherited
222,596-byte map SHA-256
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`. Its adapted map binds
Node path `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`, version `v24.17.0`, size
120,591,840 and SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`;
generic missing-size verification remains limited to exactly 32,000,000 bytes.

Development verification actually executed:

- `node --check`: passed;
- final bounded no-mutation self-test: passed 354/354, zero failures, 45 gates, 25 collectable;
- fixture-name-set SHA-256:
  `17e6b685be359459916b7970f58857eab7f14996017ec07f22164a65a12a3c7d`;
- empty failure-set and empty-ledger SHA-256:
  `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`;
- maximum-ledger SHA-256:
  `9601865b662409aade696f02c60ed59dced26cbc5b6acdcc8608de06b217f005`;
- real Node read-only integration attestation: exact path, mode `0755`, 120,591,840 bytes and
  authorized SHA-256 matched;
- consumed Attempt-13 evidence and superseded R6 identities matched;
- all fresh Attempt-14 execution paths and exact registration were absent before and after.

The nine focused tool fixtures prove explicit metadata above 32 MB is accepted only under exact
size, missing size retains the generic limit, size minus/plus one and SHA drift reject, Gate-3
tool order remains Node→npm→git, and mismatch hard-stops before later tools/gates. Existing
cleanup/null-state and carry-forward fixtures remain in the final green set. One earlier bounded
development self-test returned `FAIL_CLOSED` solely because the newly added Gate-3 sequence
fixture initialized at Gate 3 while exercising the full sequence; it reported one
`gate_sequence_invalid` fixture failure. The fixture setup was corrected to begin at Gate 1 and
the final run passed. No Attempt path, receipt, artifact, install or Harness execution occurred.

Attempt 14 remains **NOT EXECUTED / DO NOT EXECUTE WITHOUT SEPARATE EXACT RUN AUTHORIZATION**.
Any execution publication presented to the executor must be a caller-bound direct child of
`da64ae31648166184739b056a917ea2762bc9f23` / tree
`a20721ad15c5c824f3bf32987449ffa08569bede`; independent review, exact publication, one local AVS
R3, one V4 exact-head CI, final independent zero-finding approval and separate Human one-run
authority remain the normative chain. This embedded evidence document does not itself establish
completion of those external gates; the separate exact run authorization must bind their
evidence. This section supersedes older current Attempt-13 preparation
claims below without changing historical evidence. Hardware/Human/Product V5 and production,
deployment or distribution remain unauthorized.

- Status: **PHASE-0 RUN 18 ESTABLISHED SAFE TRANSFER BINDING A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; FORMAT/DISTINCTNESS AND DEVICE/UI/10×A+10×B+10×X/NFCA/FINAL PASS/TERMINAL CLEANUP MATCHED WITH EXIT 0; VALIDATION APP REMOVED; AUTHORITY CONSUMED; R-035 LOCALLY MITIGATED; PRODUCT HUMAN V5 NOT RUN; PRODUCT APP NOT INSTALLED; R-034/DA5 OPEN**
- Date: 2026-07-31
- Artifact preparation date: 2026-07-30 through 2026-07-31
- Owner: Technical Lead
- Human run authority: `PHASE-0 RUNS 17 AND 18 CONSUMED SUCCESSFULLY; PRODUCT HUMAN V5 NOT BOUND`

Current execution-binding evidence boundary: the independently reviewed read-only publication
candidate is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind`.
Its root mode is `0555`; its only entries are the mode-`0444` 376,105-byte executor with SHA-256
`810090e78b247820a2ffb24a97846d74c76768db22c2e3d5f77c68084c7e50b6` and 2,648-byte manifest
with SHA-256 `b60ecb41200c4cbc5010fba22af63ab919ee373ae0b6f80fa1cc5628a7778717`. The manifest supersedes
the unchanged Round-5 root and its exact two entries. Independent prepublication
exact-delta/artifact review Round 1 returned exactly one P3 for stale historic labels; Round 2
closure returned `APPROVED` with zero open P0–P3. This is candidate-artifact and prepublication
review identity, not Attempt evidence or run authority. External publication, V4 and final-review
evidence are not asserted by this embedded document.

The candidate independently separates these bindings: immutable candidate
`387421b3caeed988b159c93ff217fb78a0bee60c` / tree
`ace680660468e0374004869f205e6a1e0af0ac7f`, parent `db1fc8891d03753b2266957d45137e1817e46156`
/ tree `4fa39b6261e5f856d8f982bedee1ec843b371ed6`, six-path canonical delta SHA-256
`301e74d813cff2648c0009a575df703ce886d21de8d23d18b8a8badb9a917024`; closure chain
`4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` →
`2a5f32b2d29d03f26e53eee07dfe3d0658192b49`; corrected source
`4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / tree
`d44bc534c16866dbc16cd889098e6ca33d75d1f5`, Synthetic blob
`183b82674ed92e51375fad41e9efb034976ff5e3`, 94,403 bytes, file SHA-256
`f47409fa4135e45c04ac63b00dc02cd636375cd7728b6a5d1d9b67f6ad6cc198`; and an exact
execution-publication commit directly after `2a5f32b2d29d03f26e53eee07dfe3d0658192b49` / tree
`29a8485f2a19e20ae0c483e701b4a0e36a1ad4a7`. The inherited command-map SHA-256 remains
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`. The execution-publication
commit, tree and canonical delta are intentionally not embedded or self-referentially asserted by
this document or the manifest; a caller must bind them exactly for executor verification at an
authorized execution. The normative gate order is the approved prepublication exact-delta/artifact
review, focused exact publication, one local AVS R3 verification of the publication, one V4
exact-head CI, final independent exact-head/artifact review `APPROVED` with zero open P0–P3, and
only then a separate exact Human authorization for one Attempt-13 run. This embedded document
makes no claim that the external V4 or final-review evidence occurred. Attempt 13 is **NOT EXECUTED
/ DO NOT EXECUTE**; the executor requires its six paths and matching registration to be absent
before any separately authorized run.

Historical Harness evidence context (2026-08-02): Attempt 12 is consumed fail-closed with immutable
evidence and no artifact or retry. Attempt-13 Round-5 review returned `APPROVED` with zero open
P0–P3; the candidate was published as `387421b3caeed988b159c93ff217fb78a0bee60c` / tree
`ace680660468e0374004869f205e6a1e0af0ac7f`, and its one authorized local AVS R3 verification
passed. V4 exact-head CI `30745607263`, attempt 1, passed 11/12 jobs and failed closed only in
`Synthetic server-connected Android E2E harness` job `91490562435`. The confirmed cause is the
DA3 test's fixed `[2026-07-01T00:00:00.000Z, 2026-08-01T00:00:00.000Z)` query/export window,
which excluded the lifecycle record generated from current time. An unchanged retry is forbidden.

The correction was published and remote-bound as exact head
`4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / tree
`d44bc534c16866dbc16cd889098e6ca33d75d1f5`, parent
`387421b3caeed988b159c93ff217fb78a0bee60c`. Exactly one replacement V4 exact-head CI,
`30748749632`, attempt 1, passed 12/12. Synthetic job `91498873248` passed 13/13 files with 283
passed and 14 platform-dependent skips; its tests-inclusive Typecheck, Build and Cleanup passed.
Final independent Exact-Head review returned `APPROVED` with zero open P0–P3.

`DA5-V5-CI-TIMEWINDOW-01` locally binds the exact server-verified lifecycle TimeEntry ID and its
original start/stop timestamps, selects the stopped row by exact ID plus status, derives correction
timestamps only from those originals, and reuses one canonical UTC `[fromInclusive,
toExclusive)` window for query and export. Local Development verification passed `git diff
--check`; the Synthetic tests-inclusive Typecheck with the test source listed exactly once; and an
isolated PostgreSQL 17.10 loopback run of the required stateful sequence with 3/3 passed and 18
filtered tests. A subsequent single fresh PostgreSQL 17.10 loopback run executed the complete
Synthetic workspace on the unchanged candidate, whose Synthetic test working blob is
`183b82674ed92e51375fad41e9efb034976ff5e3`. The exact wrapper environment had
`TAPTIME_SYNTHETIC_E2E_DATABASE_URL` set to the dedicated numeric-loopback database,
`TAPTIME_DA5_V5_CI_OWNER_RECORD` absent, and Node `24.17.0` on `darwin`/`arm64`. The one test
process exited 0; its fail-closed wrapper admitted the build only after that exit. The terminal
Vitest summary was not retained. The current Vitest 4.1.9 result cache instead binds all 13
test-file entries with `failed:false`, and a post-run collection-only `vitest list --json` under
the same input/environment bindings enumerated 297 tests across those 13 files without executing
them. A complete source audit covered every `.skip`, `.todo`, `.skipIf`, `.runIf` and
`describeWithPostgres` boundary: the set database URL activated every PostgreSQL describe, the
absent owner record plus `darwin`/`arm64` activated every conditional `runIf`, and no other
skip/todo boundary remained. The candidate-exact composed result is therefore 297 passed, zero
failed and zero skipped. This is explicitly a composite count from test-process exit, cache,
collection and source audit, not a retained terminal summary and not a test repetition.
The subsequent exact Synthetic build refreshed all 80 expected outputs: 33 declarations, 33
declaration maps, seven JavaScript bundles and seven source maps; `node --check` passed for all
seven bundles. PostgreSQL stopped, port 55439 had no listener and the temporary `/private/tmp`
source root was absent after its recoverable Trash move.

Before the successful replacement V4, AVS carry-forward was limited to the eleven unchanged green
jobs from exact-head CI
`30745607263`, attempt 1, on commit `387421b3caeed988b159c93ff217fb78a0bee60c` / tree
`ace680660468e0374004869f205e6a1e0af0ac7f`. Every listed job result is `success`:

| Boundary | Job | Vitest evidence | Other successful gates |
|---|---:|---|---|
| B1 | `91490562321` | 1 file; 39 passed; 2 skipped; 41 total | Typecheck; Build |
| B4 | `91490562358` | 1/55; skip `n/a` | Migration; replay; tests-inclusive Typecheck; Build |
| B5 | `91490562376` | 1/42; skip `n/a` | Dependencies; migration; replay; Typecheck; Build |
| Standard | `91490562378` | Mobile-work 1/3; Offline 1/9; Export 1/12; Review 1/5; Core 43/290; Mobile 54/1176; Admin 7/87; skip `n/a` | All Typechecks; Core/Admin builds; Android bundle, 861 modules |
| C3B | `91490562408` | 4/189; skip `n/a` | Dependencies; migration; replay; Typecheck; CLI build and verification |
| C3C/E1/E2 | `91490562410` | Contract 1/4; Backend 3/121; skip `n/a` | Dependencies; migration; replay; Typechecks; Build |
| API/Mobile | `91490562412` | Offline 2/14; Mobile-work 2/10; API 9/236; Mobile 54/1176; skip `n/a` | Dependencies; migration; replay; Typechecks; Backend build |
| B6 | `91490562425` | 1/90; skip `n/a` | Dependencies; migration; replay; Typecheck; Build |
| B3 | `91490562436` | 2/130; skip `n/a` | Typecheck; migration; replay; Build |
| DA2 | `91490562448` | Export/Journey 2/15; HTTP 1/14; skip `n/a` | Dependencies; Typechecks; Build |
| DA3 | `91490562453` | Contract 1/5; Correction/Review 1/11; Export/Journey 2/15; HTTP 1/7; skip `n/a` | Dependencies; migration; replay; Typechecks; runtime builds |

Here `<files>/<passed tests>` records the printed green Vitest summary. `n/a` means that summary
printed no numeric skip field; it is not a claim of zero skips.

The carried commands and environments remain bound by unchanged `.github/workflows/ci.yml` blob
`40b4b2edaa6246f1ea77f65fe98f4ffca450e399`: GitHub `ubuntu-latest`, Node `24.17.0` and each
job's PostgreSQL/container boundary. The unchanged root/package inputs are `package.json` blob
`d0b6c3203ad01953756f066bd31c22b4028054ec`, `package-lock.json` blob
`77555096088f864860f2b6c75f51d364a7349d65` and `tsconfig.base.json` blob
`3a18e61ebab26bfdfad9e886144f8e9e5d779da6`. Unchanged Synthetic inputs are `package.json`
`8e39fac2c05bb99bad78668246031c4d2ddf8e7a`, `tsconfig.json`
`ba5a6a848faf2a21bdec74ac8251ab737d759e41`, `tsconfig.build.json`
`fb0a3deb294c9508858fbe3bd7c7ee9c0748e752` and `vitest.config.ts`
`db05963d4d164781b43b8c801d65b5b298939992`. All non-Synthetic source/test inputs are
blob-identical; the changed executable/test scope is only the current Synthetic test, which none
of these eleven jobs consumes. This remains carried baseline evidence from the failed run, not the
fresh candidate execution supplied by replacement V4 `30748749632`. The correction publication,
remote binding, replacement V4 and final independent Exact-Head review are bound above. They are
not execution evidence or run authority for Attempt 13. Attempt 13 is **NOT EXECUTED / DO NOT
EXECUTE**; Hardware and Human V5 remain unauthorized and separately gated.

## 0A. Run-18 fingerprint-transfer evidence and Product boundary

Run 18 used exact ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` / tree
`e2970d1851ab55f99ff7a027e6268ec4b7622643`, Validation Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c` / tree
`b32af38c8ac769965ab062762004312d96d0de25`, and Validation Execution
`be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`. APK SHA-256
`3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144` and manifest SHA-256
`1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a` matched.

The exact disclosure-safe sequence was `artifact:match`, `preflight:match`,
`install_launch:match`, `waiting:match`, `human_pass:match`, `cleanup:match`, `complete:match`;
exit was 0. Device/UI, 10×A then 10×B then 10×X with 10/10 per role, `NfcA`, final UI `PASS` and
complete cleanup matched. The transferred 12-uppercase-hex fingerprints are A `B55E8B6AEB30`, B
`32A54C8F2F29` and X `F61C9F702CFE`; format and pairwise distinctness were validated. The exact
authority was consumed successfully and R-035 is locally mitigated with the transfer binding
established. No raw UID, payload, Technology list, device serial or secret is Evidence.

The Product-Human-V5 Harness technical pre-run closure is exact head
`a0359a87fd1738c8493929a1661cbbc7adb3c07c`, tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`, parent
`3f8eb8f582a2458e628ab8c76240a291aaba27f5`. The exact seven-file TalkBack delta is +294/-5,
SHA-256 `30a7b90bd59de29af0c6bd97b4a809df933b230baa69508cea0ca189a78e27fb`;
exact-head CI `30638926835`, attempt 1, passed 12/12 and independent Exact-Head review returned
`APPROVED` with zero open P0–P3. Reproduced local evidence is Mobile 38/38, Synthetic 60/60, both
tests-inclusive typechecks and Guard closure 4/4 files with 123 passed and 18 expected skips. The
Harness now binds exactly one authorized Google or Samsung TalkBack package at its exact version
at Product preinstall and Gate E, failing closed for none, inactive, both, foreign or version
drift. This is technical evidence only; the Human one-run, device, services, preview, fixture and
exact accessibility bindings remain unbound and no Human or hardware action occurred.

Product Human V5 did not run and the Product App was not installed. Run 18 proves no Product
correctness. R-034 and DA5 remain open. The R3 Harness-artifact closure and independent
source/artifact Exact-SHA review must pass with zero open P0–P3 before any later separate exact
Product-Human-V5 authorization. R3 attempt 1 matched exact source/tree and all five input hashes,
then failed closed at locked-dependency reconstruction when the isolated worktree selected
unauthorized Node `26.3.1` / npm `11.16.0` instead of Node `24.17.0` / npm `11.13.0`.
`npm ci` exited 0 and installed the locked 695-package dependency tree only into the isolated
task-owned `node_modules`. `package-lock.json` remained exact, `dist/` remained absent and no
build, typecheck, test, bundle, manifest, Product/APK installation, system installation, ADB,
hardware or Product action occurred. Cleanup completely removed the task-owned worktree,
`node_modules` and every dependency output; no worktree registration remained. No retry was
performed under the attempt-1 record. The exact attempt-2 authorization then received independent
`APPROVED` review with zero open P0–P3. Fresh paths, source/tree, five hashes, Node/npm
paths/hashes, `process.execPath` and lifecycle proof matched, TypeScript `6.0.3` and esbuild
`0.28.1` resolved exactly, and bound `npm ci` exited 0. Dependency closure then failed closed
before V1/V2/build/test/artifact because `npm ls --all --json` returned `ELSPROBLEMS` for
extraneous `@expo/expo-modules-macros-plugin@0.3.0`, extraneous `expo-modules-jsi@57.0.0` and
invalid `expo-modules-core`; one debug log was written outside the bound cache. Cleanup removed
checkout, cache, `node_modules`, dependency output, debug log and worktree registration
completely. The attempt-3 authorization then received independent `APPROVED` review with zero open
P0–P3; its execution was not independently verified. Exact path/source/hash/tool binding, npm
exits, gate order, omitted steps and external-log-set equality are
**Development-reported/unverified** because no disclosure-safe raw/receipt artifact was preserved
and task logs were cleaned. Development reported a predicate-1 fail-closed stop and cleanup; the
failure-evidence gap remains open. Independent Evidence is limited to current state: four bound
paths and worktree registration absent, exact current package-lock hash, and six ADO-only changed
files with no executable delta. Attempt 4 received independent authorization review `APPROVED`
with zero open P0–P3. Its preserved receipt records that fresh-path/source/tool binding, bound
`npm ci`, globally recursive clean exit-0 npm closure, dependency/workspace/lifecycle/
external-log predicates and V0 passed. Mobile focused tests passed 38/38. V1 failed closed before
any Synthetic test executed because `@taptime/backend-schema` could not resolve from its package
entry. Receipt and manifest explicitly prove only `V2`, `BUILD`, `NODE_CHECK`,
`METAFILE_RUNTIME` and `ARTIFACT_PRESERVE` omitted. They contain no Mobile/Synthetic typecheck command IDs or omission
decisions; Development reported both tests-inclusive typechecks omitted, but that claim is
unverified and remains a separate fail-closed evidence gap. No output artifact exists. Cleanup removed checkout/cache/logs/`node_modules`/worktree
registration and proved external npm logs unchanged plus no protected executable delta. Preserved
`0444` evidence is the 10,003-byte receipt SHA-256
`ae6e9181a83187a8affa358649437f37104f359581b137fca07be036b41d8cf6`, 7,747-byte snapshot
SHA-256 `bc3d60818b6e20cfe4eecbe26917857ce9c7d9a5bf4f39c0323d351197f12077`, and 1,589-byte
manifest SHA-256 `61e30ff4e81f301873607b8f5978f0b1e675d73bb3f2b757f0d1937dbe3562c9` under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87`.
Independent review identified this P2 evidence-claim gap; correction re-review is pending and
Attempt 4 grants no retry. Attempt-5 candidate review returned `APPROVED` with zero open P0–P3.
The immutable receipt proves fresh evidence-first initialization, worktree and bound `npm ci`,
global plus affected-workspace npm-ls exit 0/recursive clean, exact dependency-file/tool/source
predicates and unchanged external npm logs. Lifecycle-binding verification exited 2, so
`DEPENDENCY_BINDINGS` failed closed before V0, all 16 prerequisite builds and every test,
Typecheck, V2, Node, metafile or artifact action; every one is explicitly omitted. Cleanup passed
and no artifact output exists. The mode-`0444` 18,204-byte receipt SHA-256 is
`4e08e3765ba2ee2813ab0a7f44463986abf0fc0a3c592c4fda40e40d34f2ee45`; the 15,887-byte snapshot
is `efb4f2b649b94d1707a759dab870e13ef0de6316b8e4f601382ca756cd3a6114`; the 1,921-byte manifest
is `558111bfdc8ffc5acdabd6c56fe76324a1b87ce6a9e0c0329854237428d0fc4b`. Attempt 5 is
`NOT_VERIFIED`; independent execution/evidence review is pending. No retry or Product action is authorized;
Hardware/Human/Product V5 remains **DO NOT START**.

Attempt-6 candidate review returned `APPROVED` with zero open P0–P3. Attempt 6 started, emitted
only sequence 1 `EVIDENCE_INIT` pass and sequence 2 `SOURCE_BINDING` pass, was interrupted and is
consumed. No terminal records may be inferred. Its only evidence is
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt6-a0359a87/attempt6-command-receipt.jsonl`,
2,716 bytes, mode `0444`, SHA-256
`6a5b23db67bbe1ff6715f377e3f0f041942d8e8b447b5e3e45cb7aa224ad5402`. All Attempt-6 checkout,
cache, log, output and worktree-registration paths are absent; no install/build/test/Typecheck or
artifact occurred.

No exact Attempt-7 candidate, digest or independent review was bound before execution; its
authorization is therefore **UNVERIFIED**. The immutable receipt uses aggregate
`DEPENDENCY_LIFECYCLE_BINDINGS`, `PREREQUISITE_BUILDS`, `V1` and `V2` records. It has no V0,
no 16 individual build IDs and no separate Mobile/Synthetic Typecheck IDs. The reported source/
tool/dependency/build/test/Typecheck results are therefore **Development-reported/unverified** and
do not satisfy the binding per-command evidence architecture.

Verified facts remain the exact immutable receipt contents and bindings, `METAFILE_RUNTIME`
exit 2, completed cleanup and current absence of checkout/cache/log/output/worktree registration.
No corrected parser, TalkBack-closure gate or artifact preservation ran; no artifact exists.
Attempt 7 is consumed fail-closed. Preserved mode-`0444` evidence is:

| Evidence file | Size | SHA-256 |
|---|---:|---|
| `attempt7-command-receipt.jsonl` | 8,686 bytes | `5d940416b1dd4e26432e462f41144cced33950d9501ff3bd9017278bf354e6a4` |
| `attempt7-precleanup-receipt.jsonl` | 6,685 bytes | `ba56a79ea65d859ddc19475788417917eebafaeddbcbc118b6e82a0285ebfb23` |
| `attempt7-evidence-manifest.json` | 1,440 bytes | `a6c2cf280ec9dcc598c489060816b6cd6c1d0085e3ef3eb6b200b94a6cb89500` |

All three are under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt7-a0359a87-9b7c4e2f`.
Checkout/generated output/worktree registration are absent; cache/logs were moved to exact
recoverable Trash paths. No artifact output exists.

Attempt-8 candidate review Round 3 returned `APPROVED` with zero open P0–P3. The single execution
produced all 45 records in order and is consumed fail-closed. Records 1–7 preserve their stated
decisions and npm exit/count evidence, but the normative per-command external-log isolation is
insufficient/unverified: `NPM_CI`/`GLOBAL_NPM_LS` have only before hashes and
`WORKSPACE_NPM_LS` has neither side. Record 8 detected cumulative drift that cannot be attributed;
records 9–41 are individually omitted and records 42–45 completed cleanup/finalization. No
external npm log was mutated or raw name/content preserved. No lifecycle/V0/build/test/Typecheck/
artifact gate ran and no Harness artifact exists. Preserved mode-`0444` evidence under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt8-a0359a87-f3c81d6a`
is:

| Evidence file | Size | SHA-256 |
|---|---:|---|
| `attempt8-command-receipt.jsonl` | 16,424 bytes | `81105a0ebf66324aee55507e7970dafe3e58c5540178e0a071757a301ce53b06` |
| `attempt8-precleanup-receipt.jsonl` | 14,335 bytes | `1362d4b31eabac446c7422ada510f17442f0bea5215cff1e567e2d7c018a5958` |
| `attempt8-evidence-manifest.json` | 1,827 bytes | `98081ea10da768f93f4c08790406259049e331f5e02d8c30f831b12247a3dc30` |

The evidence directory is mode `0555`. Attempt-8 failure/evidence review returned `CHANGES
REQUIRED` with exactly one P2, corrected by this truth sync. Attempt 9 was independently
`APPROVED` with zero open P0–P3 on published `9d9aa10242231d85afd5a9b018c0652f60b90de2` / tree
`7aa1bcd0026372b196b0fc7d39cd6fbf8b2233ee`; its one execution is consumed fail-closed.
`EVIDENCE_INIT` passed and bound the external log set only as count `11` / SHA-256
`90605c91ec4f0a3ab96ddaa2eb12af41e30b35bb3c1688c9945a11ca65746599`. The first no-checkout
worktree process exited 0, then literal `/tmp` versus canonical `/private/tmp` caused
`WORKTREE_ADD` `noncanonical_cwd`; records 3–41 are omitted. No npm, dependency, build, test,
Typecheck, Metafile or artifact gate ran. Snapshot passed. Immutable `CLEANUP` failed with
`Cannot read properties of undefined (reading 'root')`, `POSTCLEANUP` failed with
`worktree_registration_residue`, and `FINALIZE` failed closed. A later separate
Development-reported cleanup operation cannot change or supersede those records. Independent
review verified only current absence of literal/canonical checkout, cache, logs, config and
artifact roots and of the exact registration/list mapping. The mode-`0555` evidence
directory contains only mode-`0444` receipt 15,065 bytes/SHA-256
`8b1b6669e7f55df2d93773e1c8d8446ee7c4ea4a552ba261d39679ee958de5ba`, snapshot 13,688 bytes/
`55398e75e02544df79be62b8ac72be739ff5a725d159847fa49e4d1a0cf49b6b` and manifest 1,369 bytes/
`1653d957e6af823388792e049a0b87356dc2ac1fe14b4f8219aaed4a946ad677`. No retry is authorized.
Exact Attempt 10 was independently `APPROVED` with zero open P0–P3 on published
`a08e2e89a2aa3962b1bc4ddeb0f77e480f1f4f85` / tree
`dbec8fb277b1a915153c765cad4c5a060e0626b4`; its single R3 execution is consumed fail-closed.
Records 1–30 passed, including all dependency/lifecycle/V0/prerequisite-build/focused-test gates
and Mobile Typecheck. Record 31 `SYNTHETIC_TYPECHECK` failed with predicate code
`synthetic_typecheck_test_not_listed` after both exact mapped processes exited 0. The raw
`--listFilesOnly` output was not preserved by contract, and the immutable record contains no result
object, normalized list count/digest, required path, observed match or membership boolean.
Independent review cannot determine whether config exclusion or matcher/path normalization caused
the failure. Config exclusion is unproved and statically unlikely because the tracked Synthetic
tsconfig includes `tests` and the expected tracked test exists; a Harness defect is likewise
unproved. The tests-inclusive Gate-31 evidence remains open, and no TypeScript or Product defect is
inferred. Records 32–41 are individually omitted; no V2,
Node, Metafile, TalkBack closure or artifact gate ran, and no Harness artifact exists.

Records 42–44 passed. Final cleanup state is `cleanup_complete`; checkout, cache, logs, config,
artifact root, registration and exact worktree-list mapping are absent, all ten cleanup manifest
flags are true, and the external npm-log set remained count `11` / SHA-256
`80a1dc655812427ae4541df6e2bd9ece4834efa17bfa9d5e2dec2370a74f79af` without preserving a name
or content. `FINALIZE` is `FAIL_CLOSED` because record 31 failed. The mode-`0555` evidence
directory contains only mode-`0444` receipt 111,980 bytes / SHA-256
`d4bd5c9566a213abfcd1872bce92cb745414f8f6c682a52ed00f278e74f6f99f`, snapshot 64,793 bytes /
`c323f3d6c59936f6c489497e4689d1b44562a26e979717323417d35ebacd914d` and manifest 3,980 bytes /
`081d3c77fa5b044eefd4fa8c0fb1d623af1fb14fcf5ac0c585d28223cbc1b64e`. Independent
failure/evidence review returned `CHANGES REQUIRED` with exactly one P2. This six-file R0 candidate
corrects the overclaim and defines an exact Attempt-11 membership receipt; it remains **REVIEW
PENDING / NOT EXECUTED / DO NOT EXECUTE**. No retry, resume or later-gate authority exists.

No Attempt-11 evidence exists. The exact R0 candidate is **REVIEW PENDING / NOT EXECUTED / DO NOT
EXECUTE** and binds fresh token `fdf09c30`, wholly new checkout/cache/log/config/artifact/evidence/
registration paths and unchanged executable source/tree `a0359a87fd1738c8493929a1661cbbc7adb3c07c` /
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`. Candidate descriptor/npmrc/map hashes are
`ac819b20cbc26ebb650216012c81a8c9ed76e5468e883e37c8bbd25926e9c9f4`,
`459d76447f1fbd04d46628f7a97e1f69281e3e38eb9b970bfddb480b6c0379c0` and
`9bc2cb1c4bac854126a16b2047cd875537eb32399322cd2212de8587f4236168`. Its Round-2 closed schema
requires both Typecheck records to retain final-set count, normalized-set SHA-256, exact required
path, observed match, membership boolean and `raw_list_preserved:false`, or a deterministic
parser-failure result with safe null/false fields. The byte and logical-line counters follow the
closed saturation rules; the latter is memory-only, while `listed_file_count` counts only the final
deduplicated canonical set. Raw file lists and raw/split/pre-deduplication line/path counts are
forbidden; only the bounded `stdout_bytes` and final-set `listed_file_count` evidence fields persist.
Candidate review returned `CHANGES REQUIRED` with exactly two P2 corrected here; re-review and
publication must precede
execution.

Run 17 remains the historical successful stability/UI/cleanup record:

Run 17 used exact authorized Validation Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c` / tree
`b32af38c8ac769965ab062762004312d96d0de25` and Execution Repository
`be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176` / tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c` passed exact-head CI `30612797541`,
attempt 1, 12/12. Later R0 `[skip ci]` closure head
`3b544c731d15428334bbadc8e70a3492ef60b886` / tree
`52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries that evidence only and is not the
Exact-Head-CI SHA.

The disclosure-safe operator sequence was exactly `artifact:match`, `preflight:match`,
`install_launch:match`, `waiting:match`, `human_pass:match`, `cleanup:match`,
`complete:match`; exit was 0. The displayed binding matched `SM-A336B`, Android 15/API 35,
build `samsung/a33xnseea/a33x:15/AP3A.240905.015.A2/A336BXXUDFYE3:user/release-keys`, Owner
User 0, 200 % text scale and Samsung TalkBack `15.1.01.1`. Package, process and reverse null state
matched. The Human confirmed exactly 10 A, then 10 B, then 10 X presentations, every role 10/10,
`NfcA`, three pairwise-distinct 12-uppercase-hex safe fingerprints, exact title
`Alle drei Rollen stabil gebunden`, exact text
`A, B und X sind stabil, eindeutig und voneinander verschieden.` and `PASS`. Terminal operator
evidence confirms the Validation App was removed.

The three concrete values were not transferred before run-17 cleanup. That historical operational
transfer gap, not a Product, Validation or hardware defect, is now locally mitigated by run 18.

Run 16 remains historical: it produced `artifact:match`, `preflight:match`,
`install_launch:match`, `waiting:match`, then stopped on first Tag-A at
`technology_evidence`; `abort`, `cleanup:match` and `failed:mismatch` closed it without B/X,
Human PASS, retry or a hardware-defect finding.

V0 classifies the correction as R3 because it changes Product NFC dispatch, Validation evidence
arbitration/UI, immutable artifact inspection and the mutation-capable Phase-0 operator. Tenant,
database, Business Engine and production boundaries are unchanged. The code candidate makes NfcA
the sole Product dispatch tech and closed Validation label; accepts NfcA plus harmless
extra/duplicate Android-reported technologies; rejects Mifare-only evidence; claims the first
native event synchronously; settles cancellation before signaling unregister/bounded-cleanup
failure and gives `cleanup_failed` precedence over cancel/order outcomes; removes settled UI
offers so only the exact same active offer coalesces and replay fails closed; removes reset/retry;
and binds visible and accessibility action text. Product manifest generation rejects
duplicate/broader/TAG/NDEF or foreign activity/alias NFC state, while compiled inspection binds the
sole exact MainActivity TECH+DEFAULT metadata resource ID to the unique resolved exact-NfcA XML
tree. Explicit SDK/ADB authority, operator abort, install-session settlement and scoped cleanup
fail closed. One read-only no-hardware readiness path binds Node/ADB/SDK/repository/artifact without
ADB execution.

The Human Architect is the explicit source of the NfcA-only Product decision. The Technical Lead
delegated this focused R3 implementation on baseline commit
`17f4b47b8429d3862789b7e13a23f8da9d28c449`, tree
`4bbfe9e3fdcdf474f1f506135560e4e111122fb5`; no wider Product, Business, production or
distribution decision is Evidence.

Fresh artifact preparation used independently approved source
`814cb9013be7da98e46a4c36c5d4e716eef4cf46`, tree
`0181c50faf6936ea1236f4454d536bf734334c91`. One task-owned atomic publication produced
the local read-only Product candidate under `taptime-local-artifacts/da5-v5/814cb90`: APK
`app-release-fd0886dc1c393d3b.apk`, 95,522,751 bytes, mode `0444`, SHA-256
`fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96`; manifest
`artifact-manifest.txt`, 1,964 bytes, mode `0444`, SHA-256
`c0645dda543394cba9d6029b41a23aff5bcb5d0d805e3e944d9f8f880d1d5639`. The current source and
prepublication reviews returned `APPROVED` with zero open P0–P3, and the candidate remains
**DO NOT INSTALL**. Its package is
`com.tim180201.mobile.synthetic`, versionCode `1`, versionName `1.0.0`; it has one v2 signer with
certificate SHA-256
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, v1/v3/v3.1/v4 are
false, and the compiled dispatch/resource and runtime checks match exact NfcA. The first official
Validation build completed, but the official
publisher failed closed before staging/publication because Number-based `lstat` could not safely
represent the APFS System-volume inode of `/usr/bin/unzip`. Publication and verification markers
were zero; no Validation APK/manifest was published or retained and no retry occurred.

The separately approved minimal correction obtains BigInt system stats, represents `dev`/`ino` as
exact canonical decimal strings and retains fail-closed path/realpath/symlink/mode/size/SHA and
stable identity checks. Its one authorized rebuild used source and execution commit
`5675297dab94258e50d7371a95e07fe7a77fc51c`, tree
`b32af38c8ac769965ab062762004312d96d0de25`, and published directory
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-5675297dab94-3d5450f257eda716`.
The `0444` APK `app-release-3d5450f257eda716.apk` is 65,634,553 bytes with SHA-256
`3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144`; the `0444`
manifest `manifest-5675297dab94.json` is 6,855 bytes with SHA-256
`1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a`.
Its ordered 33-record source closure has compact-JSON SHA-256
`62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763`.
Publisher initial, staged and final checks passed. The first standalone-verifier invocation from
the retained build checkout stopped at readiness because ignored module-build residue was present,
before artifact inspection. The authorized corrected invocation from a fresh clean execution
checkout installed 695 offline dependencies, observed 35 positive scopes with zero ordinary or
ignored-matching residue and returned `da5_v5_validation_artifact_verified`. The first stop is an
operational wrong-location record, not a Contract or Artifact finding. The candidate package is
`com.tim180201.mobile.validation`, versionCode `1`, versionName `1.0.0`, with the same single v2
signer certificate; the NfcA and Validation-only runtime marker checks matched.
The first hardbinding bound both exact artifact tuples and the 33-record Validation Artifact Source
closure. Artifact Binding Review R1 returned `CHANGES REQUIRED` with one P1 and three P2:
circular Execution provenance, missing Product-manifest semantic cross-checks, incomplete Product
inspection-tool authority/reattestation and stale current ADO bindings. The published correction
removes the Execution literals, derives the repository root from the loaded readiness module,
parses all 59 Product-manifest fields and attests aapt, apksigner, unzip and hermesc before and
after use. Artifact Source stays `5675297dab94258e50d7371a95e07fe7a77fc51c` /
`b32af38c8ac769965ab062762004312d96d0de25`; current Execution is
`be76ce4a69c8a971ad73b5232082a9e500d8d471` /
`56abec5e7f2752f5004fe3e8667f47a917429c52`, with parent
`cda51c81255dfd7b8944e7d19efb7d209eae7001` / tree
`e2ee3bc6cef96c33e9cce692309891577767f1a7`. Source/prepublication reviews returned
`APPROVED` with zero open P0–P3.
The pre-R1 hardbinding candidate passed 5/5 Mobile test files and 480/480 tests, Mobile
tests-inclusive `tsc --noEmit`, focused-source inclusion, three changed-MJS syntax checks and both
read-only V2 preflights. The Product preflight returned
`synthetic_e2e_android_runtime_complete_verified` plus
`da5_v5_android_no_install_preflight=match`; the Validation standalone verifier returned
`da5_v5_validation_artifact_verified`. Artifact Binding Review R1 later rejected that binding, so
these checks are historical candidate Evidence, not review approval of the correction.

The first final V3 found one real stale Validation bundle binding: Mobile covered only 53/54 test
sources and 1,168/1,169 tests. The focused two-file correction updated the executable bundle to
2,044,686 bytes / SHA-256
`f33e4ecdf0e0d34e39220be9a96d952f3f9718692e766a6e57bdddd28b3b2a88` and the
555-entry / 2,679,201-source-byte closure to SHA-256
`93224940aeab41a86bef9bf3fc959d85f8d7cbdc69876cf94c900abd5d9c6bdd`; focused
verification passed 8/8 and independent bundle re-review returned `APPROVED` with zero open
P0–P3. The corrected candidate was committed as the Execution binding above.

The only complete final V3 on that commit/tree used a research-free sparse safe root and narrow
ADB-free `PATH`; Node 24.17.0, npm 11.13.0 and PostgreSQL 17.10. It passed `npm ci`, 20/20 builds,
21/21 tests-inclusive typechecks, all 54 Mobile test sources including the changed test, migrations
001–013 apply/replay/ledger for nine databases, 21/21 suites with 151 test files and 2,821 passed
tests plus exactly two documented optional B1 skips, Mobile 54/54 and 1,169/1,169, Synthetic 13/13
and 290/290, C3B verify-bin, Product no-install preflight, the existing exact Validation artifact
standalone verifier from a fresh clean execution checkout, and an 861-module Expo Android export.
The verifier preserved the Artifact Source and exact 33-record closure above. Ports 55439/55435
and the tracked safe root were clean after cleanup.

Before that complete successful run, the setup wrapper stopped because `npm ci` first ran in the
main checkout rather than the safe root; no gate had started. A later premature Admin-Web build
stopped before its dependency build; no green build was claimed or selectively repeated, and the
complete CI dependency ordering produced the final green run. No ADB command was executed; the
Validation verifier only checked the bound ADB file identity read-only. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176`/tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c` passed exact-head CI `30612797541`, attempt 1,
12/12. Correction
`9c6eec7`/tree `0aaa6de` closed the two docs-only P3 findings, and both independent Exact-Delta
re-reviews returned `APPROVED` with zero open P0–P3. At that historical pre-run checkpoint, this
R0 synchronization carried V3/V4 without a second V3 or CI; the non-hardware preparation was
technically `APPROVED`/`MERGE_READY`, both artifacts were **DO NOT INSTALL**, the operator was
**DO NOT START** and Human Phase 0/hardware was unauthorized. Run 17 later passed under its
separate exact authorization; run 18 then established the transfer binding under another exact
authorization. Both authorities are consumed. The carried CI remains bound only to the stated
`f45f49a` head/tree and is not exact-head CI for run-18 ADO baseline `5a0d59c` or this R0
synchronization. Post-run, both artifacts are again **DO NOT INSTALL** and the operator **DO NOT
START** for every new action; DA5 and R-034 remain open while R-035 is locally mitigated.

The corrected readiness contract keeps two explicit provenance axes: Execution Repository
`DA5_V5_VALIDATION_EXECUTION_COMMIT`/`_TREE` plus
`DA5_V5_VALIDATION_REPOSITORY_ROOT`, and Artifact Source
`DA5_V5_VALIDATION_SOURCE_COMMIT`/`_TREE` plus the artifact source closure. They may differ and
are compared only with their own authorities. Artifact Source remains
`5675297dab94258e50d7371a95e07fe7a77fc51c` /
`b32af38c8ac769965ab062762004312d96d0de25`; Execution commit/tree are
`be76ce4a69c8a971ad73b5232082a9e500d8d471` /
`56abec5e7f2752f5004fe3e8667f47a917429c52` and matched the actual HEAD/tree of the canonical
loaded-module root in final V3. Node, Git, ADB, aapt, apksigner, hermesc and unzip
each require explicit `_PATH`, `_BYTES`, `_MODE` and `_SHA256` inputs under their
`DA5_V5_VALIDATION_<TOOL>` prefix; `ANDROID_HOME`/`ANDROID_SDK_ROOT` bind the SDK-derived Android
tools, hermesc must equal the repository-resolved compiler and unzip must equal `/usr/bin/unzip`.
The Product and Validation candidate bindings above were this historical snapshot's artifact Evidence and are
superseded by the 2026-08-10 final closure at document top. Ordinary scoped Git status
includes staged, unstaged and untracked state under the root `app.json` and `research/**`
exclusions. A separate `status --ignored=matching` receives only the positive deduplicated
Validation source scopes plus the exact 13-file transitive local execution closure, detects ignored
`.env*` and module-build residue and does not traverse or list the protected paths. The operator
invokes the same boundary before session creation or any ADB-capable object. The two ADB runners
and APK inspector reattest their full bound identities and use those exact paths; terminal success
rechecks stable dev/inode/path metadata. After operator-abort arbitration every winning typed ADB
timeout maps to `adb_child_timeout_mismatch`, including reattestation, installed provenance,
prelaunch, activity start and postlaunch.

The prior Product NfcA/MifareUltralight artifact and its then-current Validation/Operator bindings
are historical **DO NOT INSTALL/DO NOT START**. R-035 is locally mitigated only by the current
run-18 transfer binding above.

## Historical snapshot — superseded by 2026-08-10 final closure above — Validation Runtime truth with no Product Human result

The local Runtime Guard remains independently `APPROVED` with zero open P0–P3. Round-1 Exact-SHA
review of Validation App baseline `be32840` returned `CHANGES REQUIRED` for P1 Samsung package
visibility and P3 stale Runtime-Guard navigation. Intermediate `0f7e131` corrected both, but its
real build stopped before publication because the verifier rejected Expo's existing HTTPS query;
no artifact was published. Historical query-visibility correction
`5c239b1c30c6263a036077460e23373b767f66df`, tree
`53e8d4ed012ccc662f1005f895a3b6e685cf560e`, passed exact-head CI `30276804017`,
attempt 1, 12/12. Independent Exact-SHA re-review of review base
`11a8269de145ad33c230f55a064bd18f9bb59731`, tree
`2292010e43d2620fbdbba6eeb6a9d77c36674144`, and CI `30277641127`, attempt 1, 12/12,
returned `APPROVED` with zero open P0–P3; P1 and P3 are closed.

The exact Runtime correction/review sequence is recorded in Section 1 and
`ADO/05_Evidence/Development_Assignment_05_V5_Validation_Runtime_Correction_Independent_Exact_SHA_Review.md`.
Final correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree
`3e4d1356b859fecf70d365fecbb563e2088100f3`, passed CI `30284566289`, attempt 1,
12/12; independent re-review returned `APPROVED` with zero open P0–P3. Its exact executable Metro
bundle/source closure, ExpoAsset absence, Validation package, local synthetic signer, exact
required native modules and zero forbidden modules or extra permissions are bound. The
`7e8c0f7` read-only APK/manifest passed the official verifier and independent Artifact Exact-SHA
review with zero open P0–P3 for that exact source. It is now **HISTORICAL — DO NOT INSTALL**
because DA5-V5-VAL-UI-01 changes the Validation Controller/UI.

Correction source `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`, tree
`2958f456875e8dab3f10834df280e10a8438efce`, passed exact-head CI `30370977809`,
attempt 1, 12/12. Round-2 and Round-3 source reviews and the formal independent Source/Artifact
Exact-SHA review returned `APPROVED` with zero open P0–P3. The new read-only 65,629,505-byte APK
(`810b856f…13e28`) and 6,700-byte manifest (`af53d646…9e051`) passed the official verifier and
the exact package, signer, permission, runtime, native and source-closure review. The review is
archived in
`ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_UI_01_Independent_Source_Artifact_Exact_SHA_Review.md`.
This closes the exact repository/source/artifact finding only. Because the native-capture
diagnostics correction changes the Validation source, the `e97bbe9` artifact is now
**HISTORICAL — DO NOT INSTALL**.

Runs 1–16 are consumed fail-closed without a successful attributable Tag result. Separately
authorized run 17 later passed the complete Validation Phase-0 protocol recorded in Section 0A.
Run 5 used repository baseline
`55070aa9a74c2606668caba9dc113ae8d689bd8d`, installed and verified the then-current exact
`7e8c0f7` Validation APK and passed the Human-confirmed device checkpoint. Its first required
validation scan path then
failed closed generically without a distinguishable cause. No successful or attributable Tag
result can be claimed, and no hardware defect is proven. Final cleanup ended with package,
process and reverse mappings at zero. Run 6 used ADO baseline
`96daac0b3cf1cfe98249a8c94fe927f34ee33af1`, tree
`4e7ccd41a4fda0608a7e9deab7fbc258e1cf94bf`, installed and verified the then-current exact
`e97bbe9` artifact and passed the Human-confirmed device checkpoint. At the first required A-scan
it showed only `Prüfung sicher gestoppt` /
`Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden`. No cause or Tag result is
attributable and no hardware defect is proven. Cleanup again confirmed package, process and
reverse mappings at zero. Run 7 used ADO baseline
`aebffbec7c72c028ace6365ecdcc413e314526dd`, tree
`9e0104229756fe223753916ace8247ee2626f4d5`, and exact `effc57a` source/artifact. It stopped at
the first required A-scan with fixed safe failure stage `technology_evidence`. The authority is
consumed; there is no fingerprint or Tag result. Concrete physical `techTypes` were intentionally
not exposed and remain unknown, no hardware defect is proven, and cleanup again confirmed
package, process and reverse mappings at zero.

Run 8 used ADO/code baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree
`10cdf16421fe564e1961a39d79e20775c0269fc4`, and the exact `03694f2` artifact. Installation
succeeded, but an ad-hoc host pathname regex rejected the legitimate Android-15 installed path
solely because it contained `~`. `.MainActivity` was not started, the Validation process was
absent, and no checkpoint, scan, fingerprint or Tag result was reached. Its authority is consumed;
uninstall succeeded and final package, process and global reverse state were zero. This is an
operator-boundary failure, not a Product, NFC or hardware result.

Run 9 used baseline `2f057cb4e5d096e34785c72c51340f589c711dd2`, tree
`6f65f44e53574921f1e8e9fdfde94f7a9a9ade2c`. Its complete safe receipt sequence was
`artifact:match`, `preflight:match`, `install_launch:mismatch`, `cleanup:match`,
`failed:mismatch`. No scan or Validation UI handoff occurred. That aggregate output cannot
reconstruct whether installation, installed provenance, prelaunch, explicit Activity start or
postlaunch verification failed. It proves no Product, NFC or hardware defect. The authority is
consumed, and terminal cleanup restored package, process and global reverse state to zero.

Run 10 used baseline `b63641953536bb36625fcd42d850e429ddab8db3`, tree
`dc1b9a11e0391074b35139f5948ef6b2c45f1d26`. Its complete safe receipt sequence was
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. Because the then
current `installation` category also summarized verification mismatches before the PackageManager
call, the exact cause is not further reconstructable and the category does not prove that the
install call ran. It establishes no Product, APK, NFC or hardware finding. The authority is
consumed, terminal cleanup matched, and another run remains **DO NOT START** without fresh exact
Human authorization.

Run 11 used baseline `d8549c3f1d14c15846d4f81dbe7669a598626633`, tree
`04ea2d0571a2e030fe99fbba27b622e68604644e`. Its complete safe receipt sequence was
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. On that exact
operator, the category proves entry into the existing PackageManager-call boundary but cannot
distinguish a rejected ADB/child transport from a resolved PackageManager operation with a
non-accepted exact `Success` receipt. No Product, APK, NFC or hardware finding is established.
The authority is consumed and terminal cleanup matched.

The authorized focused local correction preserves the FD-/snapshot-bound streaming install,
exact APK/package/user-0 binding, timeouts, fail-closed behavior, zeroization and cleanup. A
rejected install runner maps only to fixed `adb_child_transport_mismatch`; only after the runner
resolves does a non-exact `Success` receipt map to fixed
`package_manager_receipt_mismatch`. Pre-install verification and later Activity categories stay
unchanged. Receipts cannot contain raw errors/stderr, PackageManager output, paths or serials.
Focused verification passes the complete Operator test file 139/139 and the Mobile
tests-inclusive typecheck, with the changed test source proven included. The one complete
safe-root V3 used Node `24.17.0`, npm `11.13.0` and PostgreSQL `17.10`; it passed 20/20 builds,
21/21 tests-inclusive typechecks and 21/21 workspace suites with 2,516 passed tests and exactly
two optional B1 skips. Migrations 001–013 apply/replay/ledger, C3B `verify-bin`, the unchanged
official `03694f2` artifact verifier and an 861-module Android export passed; candidate bytes
matched, and ports `55439`/`55435` plus process state ended at zero. Published candidate
`9549da9cda578c60ca11144221e8030fb95697d3`, tree
`ced33c8d9d9cdef7d628a47147427ed6147b898a`, parent
`d8549c3f1d14c15846d4f81dbe7669a598626633`, passed exact-head CI `30471511446`,
attempt 1, 12/12. Prepublication review round 1 found exactly one P3 ADO-truth gap and no
code/test finding; round 2 approved and closed it. Final independent Exact-Head review returned
`APPROVED` with zero open P0–P3. The correction is technically final; no new Phase-0 authority
exists.

Run 12 used ADO baseline `3fcbcdec79dada8d43041a241127e52f4775e8d8`, tree
`74cac3e8611e39938e2c52c25df8cde38be254d2`, and exact candidate `9549da9`/tree
`ced33c8`. Its complete safe receipt sequence was `artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_child_transport_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. The authority is
consumed, terminal cleanup matched, and no Product, APK, NFC or hardware finding is established.

Static diagnosis against the official ADB shell contract identifies the remaining operator
classification defect: without `shell -x`, a remote PackageManager nonzero exit is propagated as
the ADB child exit and is rejected before the strict receipt parser. The focused local correction
adds only `-x` to the existing PackageManager streaming shell invocation. A remote rejection now
settles the child and reaches a strict single-line parser. Only exact `Success` succeeds. Fixed
allowlisted forms map to disclosure-safe policy/user, artifact/parse/signature,
installed-state/version/signature-conflict, storage or command-contract/usage categories.
Unknown, malformed or multiline output remains generic `package_manager_receipt_mismatch`; true
spawn, stream, timeout, abort and ADB-child failures remain rejecting
`adb_child_transport_mismatch`. No raw output, code or detail is emitted or persisted. The shared
runner, streaming snapshot, exact artifact/package/user-0 binding, timeouts, zeroization,
provenance, fail-closed behavior and cleanup are unchanged. Focused Operator regression passes
150/150. Mobile tests-inclusive
typecheck passes and objectively includes the changed test source. One complete Mobile attempt
passed 51/52 files and 866/867 tests; only the known generated native-output contamination
exceeded the locked Validation native-source closure. No retry or unrelated cleanup occurred. The
Run-12 install candidate remains V1/V2-focused green. A later isolated V3 attempt is not
recognized as V3: after all 288/288 Synthetic assertions passed, two post-test PostgreSQL
`57P01` events exposed that the local Guard stopped PostgreSQL before closing its still-live
pools. Preceding wrapper setup stops likewise provide no V3 evidence. The Human Architect
replaced that contradictory order with successful capability/DB reattestation, closure of all
owned Runtime pools and the active Installer pool, unchanged binary/lifecycle reattestation and
only then `STOP_FAST`. The focused Guard suite passes 78/78 and the Synthetic workspace
tests-inclusive typecheck passes. Final combined candidate
`3a77603825db573bdabb2d4202fe7cca5383c1ed`, tree
`3996b4c27d2970b99e1b407217dd269e62be72ce`, parent
`3fcbcdec79dada8d43041a241127e52f4775e8d8`, passed V3 with 20/20 builds, 21/21
tests-inclusive typechecks and 21/21 suites / 2,529 passed tests / two expected skips, plus
migration, binary, artifact, export and cleanup verification. Exact-head CI `30479752844`,
attempt 1, passed 12/12 without retry. Independent prepublication and final Exact-SHA reviews
each returned `APPROVED` with zero open P0–P3. The Run-12 diagnostic and local Guard cleanup
correction is technically closed; no new Phase-0 authority exists.

Run 13 used baseline `63feaf48a98e656dcceb395098bea8b260420e16`, tree
`1d635956eb22c9bba99834ca831159741889e83f`. Its complete disclosure-safe receipt sequence was
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_child_transport_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. The read-only device binding
matched before installation. It emitted no `installed_provenance` or `waiting` receipt and
reached no Validation UI, NFC or Tag step. Its authority is consumed, terminal cleanup matched,
and no Product, APK, NFC or hardware finding is established.

The focused Run-13 correction adds a Validation-only streaming-install runner and leaves the
shared ADB runner unchanged. Child start/transport, timeout, stdin-pipe abort and nonzero/signal
exit map to fixed disclosure-safe categories. `EPIPE`/`ECONNRESET` stays provisional until actual
child close and complete stdout under the same absolute timeout. The existing strict single-line
PackageManager parser is reachable only after a clean child exit and complete stdout; exact
`Success` still requires the unchanged installed-artifact provenance proof. Every missing or
ambiguous terminal proof fails closed, and no stderr, raw error, device path, serial or
PackageManager detail is emitted or persisted. Focused V1/V2 passes 161/161 tests and the
tests-inclusive Mobile typecheck. The final complete Mobile run passed 52/53 files and 887/888 tests;
only the known unrelated generated native-output contamination exceeded the locked Validation
native-source closure, and it was not retried or removed. Pre-sync ten-file V3 patch SHA-256
`265bdc5b6c5c31897743fdbcc1160deccc2a9c152bb3cca85c7f598ad08899b4` passed fresh,
research-free sparse-safe-root V3 using Node `24.17.0`, npm `11.13.0` and task-owned PostgreSQL
`17.10`. Evidence is 20/20 builds, 21/21 tests-inclusive typechecks with changed Mobile tests
included, migrations 001–013 apply/replay/ledger match, 21/21 suites / 150 files / 2,540 passed
tests / exactly two optional B1 Supavisor skips, C3B `verify-bin` match, unchanged Validation
APK/manifest verifier match, an 861-module Android export and final ports `55439`/`55435` plus
task cleanup match. Wrapper setup first lacked `rg` in `PATH` after green builds/typechecks and
later omitted the already bound artifact-verifier environment after all suites; both stopped
outside Product verification. The same safe root continued without code change or retry of green
gates, and final exact bindings passed. That patch was captured while the four ADO files still
said `V3 pending`. R0 then changed only those four documents; the six code/test files remained
byte-identical. This is the explicit AVS basis for transferring V3 evidence to round-1 candidate
`a03811011eed2d3ebde1c94e60c42f806bde7ecf`, tree
`b21d39887ea613294ed2d9612fd3fa0ff5025a0e`, parent `63feaf48…`. Its code/test
six-file diff SHA-256 is
`ad34c36fbfc5088252a6bd961c426ccae4fdc3b7b8e212bc25481eb17a390452`; its full
ten-file candidate diff SHA-256 is
`ed0047c1311bc83f664cf67702d8150bc2575d9d88f31449704a480b2ddaa4b8`.
Independent round 1 returned `CHANGES REQUIRED` with exactly this one P3 ADO finding and null
code, security and test findings. The focused ADO-only correction was published as commit
`ac51dfd338c75c4bbc0c73345e4d045924022423`, tree
`3d1f3ddfec3d0f07a1ceea7f5ab87029b18d69a5`, parent
`a03811011eed2d3ebde1c94e60c42f806bde7ecf`, and `origin/main` matched that commit exactly.
V3 evidence transferred under the documented R0 byte-identity boundary and was not rerun.
Exact-head CI `30485438652`, attempt 1, event `push`, completed successfully with 12/12 and zero
failed checks. The independent pre-V4 Exact-Delta review and final independent Exact-Head/V4
review both returned `APPROVED` with zero open P0–P3, closing the P3 and the Run-13 correction
scope technically. This following closure synchronization is R0; its own `[skip ci]` commit and
tree remain pending and are not claimed. No ADB, hardware or installation occurred and no run
authority exists.

Run 14 used baseline `887801943064d686da40785d64cd1105431c44ac`, tree
`5c15f0fae9c14844b604addf1c38b3bd5203647e`. The Operator session started and emitted exactly
`artifact:mismatch`, `cleanup:match`, `failed:mismatch`. It stopped internally at artifact
verification before preflight, ADB or installation because the cleaned Operator environment did
not retain the exact Android SDK binding. No device/install mutation occurred and the authority is
consumed.

Run 15 used the same exact baseline after binding `ANDROID_HOME` and `ANDROID_SDK_ROOT` to the
already authorized SDK. Offline artifact verification matched, then the Operator emitted
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_stdin_pipe_abort_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` or `waiting` receipt and reached no Validation UI, NFC or Tag step. The
authority is consumed, cleanup matched and no Product, APK, NFC or hardware finding is established.

Confirmed `DA5-V5-INSTALL-SESSION-01` is addressed by a focused non-executable candidate that
replaces the combined one-shot stream with exact `install-create`, `install-write` and
`install-commit` stages under one install deadline. The exact canonical session ID remains
memory-only; the sealed snapshot, `-R`, package/User-0/size binding, exact write-byte and
PackageManager receipts, and installed SHA/provenance proof remain mandatory. Every known
uncommitted session failure triggers one bounded idempotent `install-abandon` before ordinary
cleanup, and cleanup cannot match without proven session absence or settlement. A partial
`EPIPE`/`ECONNRESET` reaches only the strict existing parser after terminal child/stdout evidence;
partial success, empty, malformed or multiline evidence remains fail-closed. On exact baseline
`887801943064d686da40785d64cd1105431c44ac`, tree
`5c15f0fae9c14844b604addf1c38b3bd5203647e`, the uncommitted nine-path candidate had original
pre-sync diff SHA-256
`1ca772260b64d402b19af6012c15074d2c801c3a63c52790319db056977dc084`. Focused scope passed
179/179. Fresh research-free safe-root V3 passed `npm ci`, 20/20 builds, 21/21 tests-inclusive
typechecks, Mobile test-source inclusion 53/53, migrations 001–013 apply/replay/ledger and 21/21
workspace suites across 150 test files with 2,558 passed and exactly two expected optional B1
Supavisor skips. Mobile passed 53/53 files and 906 tests. C3B `verify-bin`, the unchanged
Validation APK/manifest verifier and an Expo Android export of 861 modules passed; ports
`55439`/`55435` were absent and Guard/task cleanup matched. Prepublication review returned
`CHANGES REQUIRED` with exactly one P3 against the stale ADO V3 binding and no code, test,
security, tenant-isolation, install-session or cleanup finding. This four-file R0 sync is the
historical correction. It and the candidate were published as
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`, tree
`d27432bc6c934a83842c8ca661723f4dd15aaf5b`. Exact-head CI `30547584412`,
attempt 1, passed 12/12 and remains historical green evidence for that exact source. Final
Exact-Head review nevertheless returned `CHANGES REQUIRED` with exactly one P3: after a
successful `install-create` or `install-write`, device re-attestation drift still inherited
`adb_child_transport_mismatch` before the next PackageManager mutation. The published candidate
is not closed, and that CI remains predecessor-only evidence. This authorized focused additional
round keeps both re-attestation boundaries at `verification_mismatch` and switches to
`adb_child_transport_mismatch` only immediately before `install-write` or `install-commit`.
Focused V1/V2 passes the changed MJS syntax check, the complete Operator file at 171/171 and the
tests-inclusive Mobile typecheck with the changed test source included. The only new final V3 is
complete for the uncommitted six-path candidate on baseline
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`, tree
`d27432bc6c934a83842c8ca661723f4dd15aaf5b`; its pre-sync diff SHA-256
`d5c99d072415198e28c6fd2bf97d4b81869ed6fcff5a759606ba6bd56b415683` remained exact
throughout V3. A research-free sparse Safe Root with a narrow ADB-free `PATH` passed `npm ci`,
20/20 builds, 21/21 tests-inclusive typechecks, Mobile source inclusion 53/53, migrations 001–013
apply/replay/ledger and 21/21 workspace suites across 150 test files with 2,560 passed and exactly
two expected B1 skips; Mobile passed 53/53 files and 908 tests. The protection check first stopped
before `npm ci` because global `adb` was visible; narrowing `PATH` meant no V3 gate had started or
was repeated. The artifact-verifier wrapper stopped before the verifier because it named the
wrong absolute `jq` path; with `/usr/bin/jq`, the first actual verifier run passed and no green
stage was repeated. C3B `verify-bin`, unchanged Validation APK/manifest verification and an Expo
Android export of 861 modules passed. Ports `55439`/`55435` were clear, task/Guard cleanup matched
and the Safe Root was recoverably moved to Trash. The exact six-path implementation diff SHA-256
`e11b9a0a7aaad54c7416d680feffdbdefce793d298e320a70dd5868c96d99927` was published as
`4067f629f12ee0fa2994de0e4b64946924dc5e6f`, tree
`10629b848a7ad6435a2f9683d6f700d327d28f8d`, on parent
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`. Exact-head push V4 `30552233999`, attempt 1,
passed 12/12 without retry. Final independent Exact-Head/V4 review returned `APPROVED` with zero
P0–P3; the correction is technically closed and `MERGE_READY`, but not Human-run-ready.
Historical CI `30547584412` remains predecessor history. This four-document closure sync is R0:
executable/test blobs remain byte-identical to `4067f62`, V3/V4 carry forward, and a second CI is
neither required nor authorized. The closure-sync commit/tree remain pending and unclaimed. No
new Phase-0, Human-run, ADB, installation or hardware action occurred or is authorized; the
candidate remains **DO NOT START**.

The focused local Run-10 diagnostic correction preserves every stage, aggregate receipt,
mutation, cleanup and terminal boundary. A pre-install device re-attestation mismatch remains
`installation` + `verification_mismatch`; the category changes to `operation_mismatch` only
immediately before the PackageManager install call. The new regression proves no install mutation
or runner call, exact aggregate/terminal ordering and no synthetic-secret disclosure; the existing
true install-failure matrix remains `installation` + `operation_mismatch`.

Combined V2/V3 evidence on the unchanged 950-file tracked candidate used Node `24.17.0`, npm
`11.13.0` and task-owned PostgreSQL `17.10`. Carried isolated evidence supplied 20/20 builds,
21/21 tests-inclusive typechecks, Mobile 52/52 test-source inclusion, suites 1–8 covering 107 test
files and 1,275 passed tests, and migrations 001–013 apply/replay/ledger. Fresh authorized
continuation supplied suites 9–21 covering 42 test files and 1,240 passed tests with exactly two
optional B1 Supavisor skips, C3B `verify-bin`, the official unchanged `03694f2` artifact verifier
and one isolated Android export. Overall, 21/21 suites passed across 149 test files and 2,515
tests; Android bundled 861 modules into one 2,927,682-byte Hermes bundle plus 150-byte metadata.
No V4 was executed locally, and no ADB, installation or hardware action occurred. The final
tracked comparison matched 950/950 before the four-file ADO-only synchronization; that
synchronization changed no executable/test bytes. PostgreSQL stopped cleanly, ports `55439` and
`55435` were absent, and all task roots were removed.

The install-category correction is technically final and published as
`12d1ace89494851025555d1d06d45570c4fcc4cb`, tree
`b747b4306637d90765b33f273ad89291bd4ea9a7`, on exact parent
`b63641953536bb36625fcd42d850e429ddab8db3`. Its exact code/test delta is limited to
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`; the published six-file delta
contains only the four synchronized ADO truth files in addition. V2/V3 above are green.
Exact-head V4 CI `30466798295`, attempt 1, completed successfully 12/12. The prior round-2 delta
review and final independent Exact-Head/V4 review returned `APPROVED` with zero open P0–P3,
closing the round-1 P2. At that historical checkpoint, all ten Phase-0 authorities were consumed;
the operator remains
**DO NOT START**, with no new Phase-0, hardware, ADB, installation or Product Human-V5 authority.

Non-code preparation stops were retained rather than hidden: contaminated main-workspace native
dependency outputs exceeded the fail-closed source-closure bound; the first clean safe-root ran
Mobile before required contract entrypoints; B1 first lacked `B1_RUNTIME_PASSWORD`; the first
artifact-verifier binding supplied 32 paths instead of 32 `{path, sha256}` records; and the first
Expo invocation supplied an unsupported positional project path. Each stopped fail-fast without
an unchanged retry. Each continuation required a new exact Technical-Lead authorization and
changed only runner environment or invocation; the subsequently required checks passed and all
task-owned state was cleaned.

The now-historical diagnostics correction source is
`effc57a6780ff86784de0519a34abd6c5b7b8cd6`, tree
`758dbfaa04d0968fb25122352055fbcb80f8f022`, with exactly seven authorized changed files.
It adds six closed, typed, fixed-allowlist and disclosure-safe stages for Technology evidence,
UID readability, listener/registration, digest, concurrency and cleanup. It emits no raw UID,
payload, Technology list, provider diagnostic, exception text or Logcat. NFC acceptance,
timeouts and Controller fail-closed behavior are unchanged.

V3 passed 20/20 builds, 21/21 tests-inclusive typechecks and 21 workspace suites covering 147
test files and 2,373 tests, with exactly two documented optional B1 skips. Migrations 001–013
apply/replay/ledger, C3B CLI and Android export passed. The initial Synthetic stop was solely a
Technical-Lead runner database-name configuration; the previously unexecuted unchanged suite
then passed 288/288 on a fresh exact database. No ports or temporary residue remained. Exact-head
CI `30377569479`, attempt 1, passed 12/12. Independent source review and final prepublication
review returned `APPROVED` with zero open P0–P3.

The now-historical read-only 65,631,681-byte `effc57a` APK (`e423073e…7330f`) and 6,700-byte manifest
(`9d1238e8…ccc22`) passed independent Artifact Exact-SHA review with zero open P0–P3. That review
verified all 32 manifest source-closure files byte-exact, package/signature/version and security
boundaries, DEX 4 required present / 14 forbidden absent, and Hermes Validation markers present
with Product/network/database/storage markers absent. It is archived in
`ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_NATIVE_CAPTURE_DIAGNOSTICS_Independent_Source_Artifact_Exact_SHA_Review.md`.
After run 7 the artifact is no longer installed and is **HISTORICAL — DO NOT INSTALL**.

`DA5-V5-VAL-TECH-01` confirms a repository defect in that exact source: its helper required a
closed Technology allowlist, rejected duplicate entries and imposed the allowlist length as a
maximum. Focused correction source `03694f2d877bc323791e93473ad01ceb82af70df`, tree
`6c6039683e067ef29f1f917a60c2628d26e38784`, passed exact-head CI `30386552118`,
attempt 1, 12/12; prepublication review round 2 returned `APPROVED` with zero open P0–P3.
That historical array contract required both fully qualified `android.nfc.tech.NfcA` and
`android.nfc.tech.MifareUltralight`; additional or duplicated entries were ignored. It is
superseded by the Human-decided NfcA-only correction and is not active future evidence.

One fresh research-free build published the read-only candidate directory
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd`.
Its 65,631,433-byte `0444` APK has SHA-256
`d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; its 6,700-byte
`0444` manifest has SHA-256
`aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`. All 32 source-closure
entries matched the exact source. Package/version, local-only v2 signer, NFC-only/no-network/
cleartext/backup boundary, required/forbidden native modules and Validation-only runtime markers
matched, and the official verifier returned `PASS`. Independent Source/Artifact Exact-SHA review
returned `APPROVED` with zero open P0–P3. The candidate remains **DO NOT INSTALL** because no
separate Phase-0, installation, ADB or hardware authority exists.
The safe run-7 stage and repository diagnosis expose no concrete physical Technology list,
fingerprint or Tag result and prove no hardware defect.

Runs 17 and 18 succeeded and consumed their exact authorities; run 18 established the safe A/B/X
transfer binding. No new Phase-0/hardware/ADB/installation authority exists, and Product Human V5
is `NOT RUN`. No production, production-data,
system-change, deployment or distribution result is claimed. Historical candidate and review
details remain preserved below.

## 1. Historical authority/exact-binding snapshot — superseded and non-normative

This historical record mirrors the correspondingly superseded Runbook table. Every `Current`
label below is snapshot-local and must not be used as current operational truth. The only current
path is the top 2026-08-10 closure plus a future, separately issued exact one-time Human
authorization; until then: **UNBOUND — DO NOT START**. This snapshot records the then-read-only
Product/Validation artifacts plus operator Execution candidate, its final V3, ADO/V4 and both
independent zero-finding Exact-Delta re-reviews, the historical Validation artifacts and exact
TECH-01 source/CI/source-review bindings, failed runs 1–16, successful Validation Phase-0 run 17
and successful transfer run 18. It records no Product Human result and grants no new Human-run or
installation authority.

| Binding | Evidence |
|---|---|
| Validation Phase-0 run-17 Human authorization/date | Explicit exact-bound Human authorization on `2026-07-31`; consumed successfully |
| Validation Phase-0 run-18 fingerprint-transfer authorization/date | Explicit exact-bound Human authorization on `2026-07-31`; ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` / tree `e2970d1851ab55f99ff7a027e6268ec4b7622643`; consumed successfully |
| Product Human V5 authorization/date | `NOT BOUND — DO NOT START`; may not be bound before the R3 Harness-artifact closure and independent source/artifact Exact-SHA review pass with zero open P0–P3 |
| Current Product source/review state — DO NOT INSTALL | `814cb9013be7da98e46a4c36c5d4e716eef4cf46` / tree `0181c50faf6936ea1236f4454d536bf734334c91`; source/prepublication reviews `APPROVED`, zero open P0–P3; current operator candidate final V3 passed |
| Current Product APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90`; APK `app-release-fd0886dc1c393d3b.apk`, 95,522,751 bytes, mode `0444`, SHA-256 `fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96`; manifest `artifact-manifest.txt`, 1,964 bytes, mode `0444`, SHA-256 `c0645dda543394cba9d6029b41a23aff5bcb5d0d805e3e944d9f8f880d1d5639` |
| Current Product package/runtime | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 true and v1/v3/v3.1/v4 false; one signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; compiled unique exact-NfcA binding and packaged runtime matched |
| Current Validation Artifact Source — DO NOT INSTALL | `5675297dab94258e50d7371a95e07fe7a77fc51c`; tree `b32af38c8ac769965ab062762004312d96d0de25`; exact 33-record closure |
| Current Validation Execution/review state — DO NOT START | `be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree `56abec5e7f2752f5004fe3e8667f47a917429c52`; parent `cda51c81255dfd7b8944e7d19efb7d209eae7001` / tree `e2ee3bc6cef96c33e9cce692309891577767f1a7`; canonical loaded-module root and actual HEAD/tree matched in final V3 |
| Pre-run ADO/V4/re-review closure | ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176`/tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`; exact-head CI `30612797541`, attempt 1, 12/12; docs-only correction `9c6eec7`/tree `0aaa6de`; both Exact-Delta re-reviews `APPROVED`, zero open P0–P3; later R0 `[skip ci]` closure `3b544c731d15428334bbadc8e70a3492ef60b886`/tree `52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries the evidence only and is not exact-head CI for run-18 ADO baseline `5a0d59c` or this synchronization; non-hardware preparation `APPROVED`/`MERGE_READY`; runs 17 and 18 later passed under separate exact authorizations, now consumed |
| Current Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-5675297dab94-3d5450f257eda716`; APK `app-release-3d5450f257eda716.apk`, 65,634,553 bytes, mode `0444`, SHA-256 `3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144`; manifest `manifest-5675297dab94.json`, 6,855 bytes, mode `0444`, SHA-256 `1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a` |
| Current Validation bundle/source closure | Executable Metro bundle 2,044,686 bytes / SHA-256 `f33e4ecdf0e0d34e39220be9a96d952f3f9718692e766a6e57bdddd28b3b2a88`; 555 entries / 2,679,201 source bytes / SHA-256 `93224940aeab41a86bef9bf3fc959d85f8d7cbdc69876cf94c900abd5d9c6bdd`; focused 8/8 verification and independent bundle re-review `APPROVED`, zero open P0–P3 |
| Current Validation closure/publication/verification | 33 ordered Artifact Source records; compact-JSON SHA-256 `62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763`; publisher initial/staged/final `PASS`; fresh-clean-execution-checkout marker `da5_v5_validation_artifact_verified` on `be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree `56abec5e7f2752f5004fe3e8667f47a917429c52`; Artifact Source remained `5675297dab94258e50d7371a95e07fe7a77fc51c` / tree `b32af38c8ac769965ab062762004312d96d0de25`; no ADB command was executed; prior retained-build-checkout readiness stop was before artifact inspection and is not an Artifact finding |
| Historical Product commit/tree and required V4 | `a323834f51607841d0cd5f11aafdbfd3dd93ed5f` / `65c669b0a941c21d23ffca5e79fa03285323a7cf`; CI `30149165373`, attempt 1, 12/12 |
| Historical Product implementation-review binding/verdict | Round 2 `APPROVED`; zero open P0–P3 |
| Prior runbook/evidence commit/tree and independent-review verdict | `e6a06e2ec8f580d6314bfe5a51378f949d524b16` / `6dcdce405feb2eccb1462c373ab6be891152715c`; CI `30150095109`, attempt 1, 12/12; final independent Artifact/Evidence Exact-SHA review `APPROVED`, zero open P0–P3 |
| Runtime Guard source/CI | `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867` / tree `980b6c57fdd71c12820f2890b640946db0d883c6`; CI `30255104609`, attempt 2, 12/12; attempt 1 was one B5 Docker-Hub pull timeout before checkout |
| Isolated-PostgreSQL enablement correction | Historical round-2 `7739757a4855ee7bac34408941e94c25516d75f5` / tree `0398066e92fef65562526f61c9515b0ef3be0114` / CI `30177897059`, attempt 1, 12/12. Round-3 `bbcb1b59703ee866539b2bc384ec9db8c2643fe4` / tree `dfb5abbca1f2ddf603d191ae3303d1336f5440c7` / parent `7739757a4855ee7bac34408941e94c25516d75f5`; exact-head CI `30185670176`, attempt 1, 12/12; independent review `CHANGES REQUIRED`, exactly two P1 and zero P0/P2/P3. Extra-round `43567d256e8f633f16866448e1fb5abbd8022733` / tree `feecced92abe9fc536a2db052b5a616d3e0f1cf7` / parent `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`; exact-head CI `30186846379`, attempt 1, 12/12; Exact-Delta review `CHANGES REQUIRED`, exactly one P1 and zero P0/P2/P3; initdb P1-B closed. Human confirms the second local administrator and exact complete decision-time local macOS admin-group membership snapshot are trusted under Option A and authorized exactly one last focused ADO correction/review round limited to the remaining P1. Decision-time V1 anchor: exactly two direct members, zero nested groups; full-record SHA-256 `b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`; membership SHA-256 `70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064`; combined snapshot SHA-256 `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`. At that extra-round checkpoint, future R3 still had to reproduce all three digests and both counts before capability/task-root creation and every trust use; mismatch returned to the Human Architect without dynamic acceptance or rebinding. The then-current last-round draft was R0/unbound, and focused publication, exact-head CI, independent approval and implementation authority were still pending. The later Runtime Guard is independently approved; the corrected Validation App has the separate approved source/CI/artifact binding below. |
| Runtime Guard artifact/review | Binary `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-runtime-guard/ba1b6e922ceb7902ecedd9dc2df01d6b22d90867/da5_v5_runtime_guard`; 74,336 bytes; mode `0555`; SHA-256 `4b2a7e6b15d3348dffda94f9125c20a4db82bb8eb08a03aabd35932ad0d5853c`. Same-directory `guard-manifest.txt`; 19,971 bytes; mode `0444`; SHA-256 `957d6e99c271663763945026995e7463cf2f20b385eb942fd16a152d3de5f709`. Focused evidence SHA-256 `440928371f7acc48272eff2e819c37a851d66cae4a908ffa330228982328d708`; independent Exact-SHA `APPROVED`, zero open P0–P3 |
| Historical query-visibility correction source/review/CI | Round-1 baseline `be32840`, verdict `CHANGES REQUIRED` for P1/P3; intermediate `0f7e131` stopped before publication with no artifact; final source `5c239b1c30c6263a036077460e23373b767f66df` / tree `53e8d4ed012ccc662f1005f895a3b6e685cf560e`; CI `30276804017`, attempt 1, 12/12; review base `11a8269de145ad33c230f55a064bd18f9bb59731` / tree `2292010e43d2620fbdbba6eeb6a9d77c36674144`; CI `30277641127`, attempt 1, 12/12; independent Exact-SHA re-review `APPROVED`, zero open P0–P3; P1/P3 closed |
| Validation provider/query policy | Exactly one installed and active provider from `com.google.android.marvin.talkback` or `com.samsung.android.accessibility.talkback`; none or both fail closed; exact package name and safe version are bound. Packaged visibility is exactly one queries block, both TalkBack package queries, one exact `VIEW` + `BROWSABLE` + `https` intent and zero providers |
| Historical DA5-V5-VAL-NATIVE-CAPTURE-DIAGNOSTICS source/review/CI | Source `effc57a6780ff86784de0519a34abd6c5b7b8cd6`; tree `758dbfaa04d0968fb25122352055fbcb80f8f022`; exactly seven authorized changed files; exact-head CI `30377569479`, attempt 1, 12/12; independent source review and final prepublication review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation V3 | 20/20 builds; 21/21 tests-inclusive typechecks; 21 workspace suites / 147 test files / 2,373 tests; exactly two documented optional B1 skips; migrations 001–013 apply/replay/ledger, C3B CLI and Android export passed. Initial Synthetic stop solely from Technical-Lead runner database-name configuration; previously unexecuted unchanged suite passed 288/288 on a fresh exact database; no port or temporary residue |
| Historical `effc57a` Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-effc57a6780f-e423073e51f72a68`; APK `app-release-e423073e51f72a68.apk`, 65,631,681 bytes, mode `0444`, SHA-256 `e423073e51f72a68421c8e4afd17a9b86c397ca83628deaf4b174543d817330f`; manifest `manifest-effc57a6780f.json`, 6,700 bytes, mode `0444`, SHA-256 `9d1238e821d92b26ed9bc9b9ee8ccd48607280ff0d0e752ec6965827c68ccc22`; independent Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation package/security boundary | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; signing scope `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup disabled; no Product deep links or Tag dispatch |
| Historical `effc57a` Validation source/native closure | Metro source closure 555 entries / 2,675,576 bytes / SHA-256 `e9fee0629af81357e4563836f9f5ef2b404c1ef97bc135d1cb3ed410f713b593`; executable 2,040,604 bytes / SHA-256 `c24457514436a63878107e1593dc90c6de17ad2424a6b625a6f18a14f66b8cfe`; unchanged native source 123 directories / 587 entries / 464 files / 1,176,224 bytes / SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |
| Historical `effc57a` Artifact Exact-SHA review | `APPROVED`, zero open P0–P3; all 32 manifest source-closure files byte-exact; package/signature/version, NFC-only permission, backup/transfer disabled, cleartext/network blocked and no Product dispatch/deep link; DEX 4 required present / 14 forbidden absent; Hermes Validation markers present and Product/network/database/storage markers absent |
| Historical `DA5-V5-VAL-TECH-01` source/review/CI | `03694f2d877bc323791e93473ad01ceb82af70df`; tree `6c6039683e067ef29f1f917a60c2628d26e38784`; exact-head CI `30386552118`, attempt 1, 12/12; prepublication review round 2 `APPROVED`, zero open P0–P3 |
| Validation Phase-0 operator source/review/CI — DO NOT START | Baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree `10cdf16421fe564e1961a39d79e20775c0269fc4`; candidate `083fdfb259089d976e48f824e0862f10637d3290`, tree `24bd130500934c6a48fd9314fa06387d6ebdedcd`; exact-head CI `30402655381`, attempt 1, 12/12; independent Exact-SHA re-review round 2 `APPROVED`, zero open P0–P3; both round-1 P1 findings closed; no Phase-0, installation, ADB or hardware authority |
| Run-13 install-stream terminal correction — TECHNICALLY CLOSED/DO NOT START | Baseline `63feaf48a98e656dcceb395098bea8b260420e16`, tree `1d635956eb22c9bba99834ca831159741889e83f`; pre-sync ten-file V3 patch SHA-256 `265bdc5b6c5c31897743fdbcc1160deccc2a9c152bb3cca85c7f598ad08899b4` passed complete V3; R0 changed only four ADO files and six code/test files remained byte-identical, so V3 transferred without rerun; round-1 candidate `a03811011eed2d3ebde1c94e60c42f806bde7ecf`, tree `b21d39887ea613294ed2d9612fd3fa0ff5025a0e`, parent `63feaf48…`; code/test six-file diff SHA-256 `ad34c36fbfc5088252a6bd961c426ccae4fdc3b7b8e212bc25481eb17a390452`; full ten-file candidate diff SHA-256 `ed0047c1311bc83f664cf67702d8150bc2575d9d88f31449704a480b2ddaa4b8`; historical round-1 review had exactly one P3 ADO finding and null code/security/test findings; correction `ac51dfd338c75c4bbc0c73345e4d045924022423`, tree `3d1f3ddfec3d0f07a1ceea7f5ab87029b18d69a5`, parent `a038110…`, matched `origin/main`; exact-head CI `30485438652`, attempt 1, push, completed success 12/12 with zero failed checks; independent pre-V4 Exact-Delta and final Exact-Head/V4 reviews `APPROVED`, zero open P0–P3; following R0 closure-sync commit/tree pending; no run authority |
| Final install-category correction/review — DO NOT START | Candidate `12d1ace89494851025555d1d06d45570c4fcc4cb`; tree `b747b4306637d90765b33f273ad89291bd4ea9a7`; parent `b63641953536bb36625fcd42d850e429ddab8db3`; exact code/test delta limited to the Operator core and focused runtime test, plus four synchronized ADO truth files; V2/V3 green; exact-head V4 CI `30466798295`, attempt 1, 12/12; prior round-2 delta review and final independent Exact-Head/V4 review `APPROVED`, zero open P0–P3; round-1 P2 closed; no Phase-0, installation, ADB or hardware authority |
| Historical install-/launch-diagnostic predecessor/review — DO NOT START | Candidate `8ce03852e782d541319bb852f216cf596ab1787f`; tree `f5b914c1b8f1243244733808beaef54f0351a563`; parent `2f057cb4e5d096e34785c72c51340f589c711dd2`; exact eight-file +488/-132 delta; patch SHA-256 `c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`; V1/V2 executed green; unchanged V3 carried from `496ca59`/tree `b398b89`; exact-head CI `30459539801`, attempt 1, 12/12; independent Exact-Delta/Commit/Tree/CI review `APPROVED`, zero open P0–P3; no Phase-0, installation, ADB or hardware authority |
| Historical published Phase-0 readiness candidate/review — DO NOT START | Candidate `496ca59f0965670b29a210b8aa2443b99bb4a386`, tree `b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`; baseline `fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree `da69081517d2b0b9631eaef393b0a6022735061e`; safe-root V3/eight-file candidate has no code finding; exact-candidate CI `30427205223`, attempt 1, completed failure 11/12; job `90496143535` passed 3/3 files and 121/121 assertions before later unhandled PostgreSQL `57P01` on `taptime_c3e1_dirty_*`; formal review `CHANGES REQUIRED`, exactly one P2 CI/test-reliability finding, no Product/Security finding; no retry |
| PostgreSQL test-cleanup correction — technically closed/DO NOT START | Candidate `21e518151a3f4727ebf4ce90cd1557660960ff21`, tree `8f764f9260378b631b4b026355852c324d6dc06b`; parent `d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree `753feedcae6724e711557e6492bbe26fa0b02083`; seven test-only files, +192/-12, delta SHA-256 `b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`; V1 2/2, V2 B3 128/128 + C3B 60/60 + C3C/C3E1 102/102 and three tests-inclusive typechecks passed; unchanged green V3 carried from `496ca59`; exact-head CI `30429746848`, attempt 1, 12/12 without retry; independent source/delta and final Exact-SHA/V4 reviews `APPROVED`, zero open P0–P3; historical P2 closed; no hardware authority |
| Historical `DA5-V5-VAL-TECH-01` candidate APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd`; APK `app-release-d2084486b07f27bd.apk`, 65,631,433 bytes, mode `0444`, SHA-256 `d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; manifest `manifest-03694f2d877b.json`, 6,700 bytes, mode `0444`, SHA-256 `aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`; official verifier `PASS`; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `DA5-V5-VAL-TECH-01` candidate package/security/source boundary — DO NOT INSTALL | All 32 manifest source-closure entries byte-exact; `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; `local-validation-only`; one v2 signer, certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup/transfer denied; no Product deep links or Tag dispatch; required native modules present, forbidden modules absent; Validation marker present and Product runtime marker absent |
| Historical DA5-V5-VAL-UI-01 source/review/CI — DO NOT INSTALL | Source `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`; tree `2958f456875e8dab3f10834df280e10a8438efce`; exact-head CI `30370977809`, attempt 1, 12/12; Round-2 and Round-3 source reviews and independent formal Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `e97bbe9` Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-e97bbe9e2a28-810b856ff7113b4f`; APK `app-release-810b856ff7113b4f.apk`, 65,629,505 bytes, mode `0444`, SHA-256 `810b856ff7113b4f2a454007595e1b6c1ae5dc69c601a2120b577f124e213e28`; manifest `manifest-e97bbe9e2a28.json`, 6,700 bytes, mode `0444`, SHA-256 `af53d646558449a7a5c907fbdf59e3366c6ffd2755f6049141db8e567549e051`; official verifier `PASS` |
| Historical Validation Runtime correction source/review/CI | Baseline `dbf8cfe643b56bdb3c6c371a95bfc463bbf8042f` / tree `80e17f54d62d386a02af3aa7e71b152cc3edb7b5`; first source `86c55fb17f64325046f2b25b45b84550c5a4b2bd` / tree `3a771945bc34852e4de098464c6c5bb82e74540b`, CI `30282537778` attempt 1 failed only on five-second timeout; timeout candidate `534b6d23e9391431fb4527c76347c16821ce3e18` / tree `a07429424184b4cd0b10841ea3e57c872afc4c8d`, CI `30282863442` attempt 1 12/12, initial independent review `CHANGES REQUIRED` exactly one P1; source `7e8c0f7742e6407b8917205fd337a552f7dec714` / tree `3e4d1356b859fecf70d365fecbb563e2088100f3`, CI `30284566289` attempt 1 12/12, independent re-review `APPROVED`, zero open P0–P3; superseded for installation by DA5-V5-VAL-UI-01 source correction |
| Historical Validation Runtime closure — DO NOT INSTALL | Exact 2,032,807-byte executable Metro bundle SHA-256 `e4caf2db73cfbcdaf779f337bf3a3f99e95d182950522323052bc31ae10c93d3`; exact 555-source/2,667,064-source-byte closure SHA-256 `29691fc137c63906e5cf0c5cd47e2df0643064ab6dbddc00e0d3ec467d492ed3`; ExpoAsset absent; package `com.tim180201.mobile.validation`; local synthetic signer; exact required native modules; zero forbidden modules or extra permissions |
| Historical Validation APK/manifest — DO NOT INSTALL | APK `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-7e8c0f7742e6-303bfd33cf7fa000/app-release-303bfd33cf7fa000.apk`; 65,626,753 bytes; mode `0444`; SHA-256 `303bfd33cf7fa000ee808a048f91883c18dbfe85c1ba359d3f0764ac7ae7f2f8`. Same-directory `manifest-7e8c0f7742e6.json`; 6,700 bytes; mode `0444`; SHA-256 `11c1664cee37caa8b093a9023f571e3b8733e8bb078bf7f78b6f20d8f39388a7`; official verifier `PASS`; independent Artifact Exact-SHA review `APPROVED`, zero open P0–P3 for historical source only |
| Historical Product APK path/size/SHA-256/mode — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/app-release-385c0c46f22dcac5.apk`; 95,522,787 bytes; `385c0c46f22dcac5b935bfdc6f574558f4e74748ed4a367ef399ddbd4299c547`; `0444` |
| Historical Product manifest path/size/SHA-256/mode — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/artifact-manifest.txt`; 1,647 bytes; `1c1f1b7a5b92fab5510cde35a439fc6f0742b7bf2666d6319cd89b9a7d4dcadb`; `0444` |
| Historical Product package/version/signature/signer/runtime | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 `true`, v1/v3/v3.1/v4 `false`; one local synthetic non-production signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; packaged boundary/runtime `match` |
| Product Human V5 device model/OS/build/screen-unlocked mode | `NOT BOUND` |
| Product Human V5 approved Tag labels/safe fingerprints by assigned/unassigned/unrelated role | `NOT BOUND` |
| Product Human V5 synthetic services/status/offline controls | `NOT BOUND` |
| Product Human V5 Admin Setup Preview 2 entry/result/safe-exit procedure | `NOT BOUND` |
| Product Human V5 DA5-T06 five-second dedupe boundary/lifecycle-cancellation checkpoint | `NOT BOUND` |
| Product Human V5 reviewed Protected/Review fixture, labels, start state, cutover, expected sequence and scoped teardown | `NOT BOUND` |
| Product Human V5 large-text setting/active allowlisted TalkBack package and version | `NOT BOUND` |

Historical query correction exact-head CI `30276804017`, attempt 1, and review-base CI
`30277641127`, attempt 1, each passed 12/12 and its independent Exact-SHA re-review closed P1/P3.
Final Runtime correction exact-head CI `30284566289`, attempt 1, passed 12/12; its independent
re-review and Artifact Exact-SHA review each returned `APPROVED` with zero open P0–P3, and the
official artifact verifier returned `PASS` for the exact final binding above. These automated and
review results are not Human preflight evidence or Human-run authority. The `effc57a`, `e97bbe9`
and `7e8c0f7` APK/manifest artifacts are historical/DO NOT INSTALL. No complete Phase-0 retry is
currently authorized. Run 18 established the exact safe A/B/X transfer binding; the historical
`effc57a`, `e97bbe9` and `7e8c0f7` artifacts remain **DO NOT INSTALL** and must not be future
bindings. Product Human V5 remains separately unauthorized and may not be authorized before the
R3 Harness-artifact closure plus independent source/artifact Exact-SHA review pass.

### 1.1 Historical enablement and isolated-PostgreSQL correction sequence — no Human result

Corrected ADO authorization candidate `cddb66d82047284c72688cc90a7491af761b8791`, tree
`8cda19f8df42febb34a03a4db4911d5ea8acae79`, passed exact-head CI `30159987539`,
attempt 1, 12/12; independent exact-delta re-review returned `APPROVED` with zero open P0–P3.
On exactly that baseline, the R3 enablement implementation was published as
`15f43b1b05e136e0d6643b1f10c1fc8310cfa838`, tree
`ed1e55c08dd13392f6f72bcf9265cdfaf547fa72`, and passed exact-head CI `30165425892`,
attempt 1, 12/12. Formal Exact-SHA review round 1 returned `CHANGES REQUIRED` with exactly four
P1, two P2 and one P3. Subsequent specialist audits additionally found sticky reverse-cleanup
uncertainty (P2), productive artifact/FD, binary-digest, stdin-runner-close and
installed-package-path verification gaps (P2), and legacy PostgreSQL provisioner
preflight/scoped-removal/password-state defects (P1/P2). The then-current
focused correction candidate kept an aborted/error reverse-mutation outcome sticky `uncertain`
through compensating close and the final Android-cleanup handoff; it performs full stable-FD
digest/lifecycle and buffer-zeroization verification, settles binary digest and stdin-runner
failures only after child close while retaining the first error, enforces the
installed-package-path parser boundary, and performs all legacy role/session/membership-option/setting/dependency
checks plus authoritative password-state verification behind an installer-superuser proof before
any exact scoped mutation. Focused Mobile passed 77/77 and complete Mobile passed 542/542;
real-PostgreSQL preservation passed 4/4, the normal success path passed 3/3 and complete Synthetic
passed 161/161. Both tests-inclusive typechecks, the Synthetic build, all
changed-MJS syntax checks, immutable-artifact/no-install preflight, scoped diff-check and final
PostgreSQL null-state proof passed.
The first attempted complete invocation remained incomplete only because its operator environment
pointed `backend-mobile-work` at the fresh empty task-owned `taptime_da3`. After correcting only
that invocation environment and making no code change, a full fresh invocation completed green:
21/21 workspace suites passed with 2,063 tests and exactly two optional B1 Supavisor skips, 21/21
tests-inclusive typechecks and 20/20 applicable builds passed, migrations 001–013 passed clean
apply/replay/ledger verification on PostgreSQL 17.10, C3B `verify-bin` passed, Mobile test sources
were included 39/39 by `tsc --listFilesOnly`, Android export completed with 861 modules and the
immutable-artifact/no-install preflight matched. Cleanup removed task-owned `taptime_da3` and
temporary export data; the DA5 Harness end state was `0|false|false|false` for generated roles,
schema, ledger and Legacy Guard DB, with no listeners on ports 3000/54321. The incomplete
invocation was an operator-environment issue, not a Product defect.

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
uncommitted follow-up. That later Shared-Cluster WIP revalidated exact role OID/state under a fixed
PostgreSQL-17 catalog-lock order before quarantine and destructive mutation; kept DA5 preparation
in one migration-locked/catalog-locked transaction with exact absence proofs and explicit
creation only; and bound cleanup to the immutable prepared profile plus a catalog-derived
ownership fingerprint before one rollback-safe destructive transaction. A safe new red
regression reproduced the cleanup profile mismatch 1/1 before correction. Corrected focused
Legacy preservation/concurrency passed 14/14, ownership-bound cleanup passed 9/9, the DA5
least-privilege success boundary passed 3/3 and complete Synthetic passed 180/180. The
tests-inclusive Synthetic typecheck, explicit 9/9 test-source inclusion proof, Synthetic build,
scoped diff-check and final PostgreSQL `0|false|false|false` null-state proof passed. The
raw-protocol authentication-boundary regression is deterministic, but local PostgreSQL 17 uses
host `trust`: its authenticated-role branch ran, while the implemented SASL/hidden-startup-VXID
branch was not locally exercised. Full workspace V3, Technical-Lead acceptance, a committed
SHA/tree and Exact-Head CI binding, and formal review round 3 remain pending; no follow-up
approval is claimed here.

The entire Shared-Cluster follow-up above is now `BLOCKED`, is not Candidate Evidence and is not
the current green path. Its focused 180/180 Synthetic result remains a historical WIP observation
only and is not Human/hardware Evidence.

The first isolated-PostgreSQL authorization candidate was published at
`72fbd3c20329dfbf3e8a1509025bd630b1bb130a`, tree
`dda615edd2e91c6b4d50bf979386937a9f3d249f`. CI `30176432929`, attempt 2, passed 12/12; attempt 1
timed out while pulling the Docker Hub image before checkout and tested no repository source.
Independent candidate review returned `CHANGES REQUIRED` with five P1, one P2 and one P3.

Round-2 correction candidate `7739757a4855ee7bac34408941e94c25516d75f5`, tree
`0398066e92fef65562526f61c9515b0ef3be0114`, exact parent `72fbd3c`, passed exact-head CI
`30177897059`, attempt 1, 12/12. Its technically enforced read-only Ultra re-review returned
`CHANGES REQUIRED` with exactly five P1, one P2 and one P3: terminal/process-group signals could
bypass PostgreSQL supervision under `detached=false`; compiler/helper/initdb lacked bounded
terminal hang cleanup; compiler/toolchain/environment trust was incomplete; rename lacked
source-inode/no-replace safety; final stat-to-unlink retained a destructive same-UID TOCTOU; the
copy-ready prompt named only one candidate file; and Decision Log/ADO navigation was stale.

The round-3 ADO draft specifies one native Runtime Guard compiled/tested once during the future R3
software phase, retained read-only with an Exact-SHA manifest and only verified—not compiled—by
later operational/hardware runs. It is the direct initdb/PostgreSQL parent in its own POSIX
session/process group with private-pipe-only Node control, bounded artifact-producer/initdb
termination, closed trusted toolchain/runtime environments and
platform-no-replace/descriptor/mount checks. It does not claim atomic same-UID cleanup: POSIX has
no portable inode-conditional unlink. The Human Architect selected Option A: one exclusive
trusted single-user operator session, with hostile/malicious same-UID processes and mount/unmount
churn outside the threat model. That selection is not implementation approval. The seven-file
correction still requires focused publication, successful exact-head CI and independent
`APPROVED` with zero open P0–P3 before only the exact R3 scope may activate through the
`AGENTS.md` standing rule. No implementation, installation, ADB, device/Tag or Human/hardware
authority exists.

Focused round-3 candidate `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, tree
`dfb5abbca1f2ddf603d191ae3303d1336f5440c7`, exact parent
`7739757a4855ee7bac34408941e94c25516d75f5`, passed exact-head CI `30185670176`, attempt 1,
12/12. Independent read-only review returned `CHANGES REQUIRED` with exactly two P1 and zero
P0/P2/P3: the PostgreSQL 17.10 Homebrew trust boundary needed root-or-exact-same-EUID ownership
plus complete canonical-chain/ACL/stable-identity binding and revalidation under Option A, and
initdb leader observation had to remain non-reaping until after its final possible negative-PGID
signal. The Human Architect authorized exactly one additional focused ADO correction/review round
beyond the three-round limit, limited to those findings. Focused extra-round candidate
`43567d256e8f633f16866448e1fb5abbd8022733`, tree
`feecced92abe9fc536a2db052b5a616d3e0f1cf7`, exact parent
`bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, passed exact-head CI `30186846379`, attempt 1,
12/12. Its independent Exact-Delta review returned `CHANGES REQUIRED` with exactly one P1 and zero
P0/P2/P3: the current same-EUID-owned Homebrew Cellar ancestor is observed at mode `0775`, so
blanket group-write rejection cannot run and the exact trusted group plus complete current
membership snapshot were not bound. The review explicitly closed initdb P1-B.

The Human Architect confirms the second local administrator and exact complete decision-time
local macOS admin-group membership snapshot are trusted under Option A and authorizes exactly one last
focused ADO correction/review round limited to the remaining P1. The current last-round R0 draft
requires disclosure-safe immutable group-record and sorted UID/GUID membership binding to exactly
two decision-time direct members, zero nested groups, full-record digest
`b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`, membership digest
`70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064` and combined snapshot
digest `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`. Later R3 must
recompute all three and both counts; mismatch returns to the Human Architect, never a later-
current rebind. Exact-group/exact-member/exact-mode revalidation, the canonical binaries' exact
observed `0555`, and fail-closed rejection of all other group/world write, group/member/mode/ACL/
symlink/swap drift remain mandatory. It changes no Product code or system/Homebrew/account/group/
membership/ownership/permission state and preserves Shared-Cluster `BLOCKED`/not-Evidence truth.
This paragraph is governance history, not Candidate Evidence, implementation approval or Human/
hardware authority; focused publication, exact-head CI and independent Exact-Delta `APPROVED`
with zero open P0–P3 remain required.

Runs 1–16 occurred as recorded below without a successful attributable Tag result. Run 17
subsequently passed the Validation Phase-0 protocol but did not reach Product Human V5. Run 18 then
established the exact disclosure-safe transfer binding under separate authority. The Harness still
cannot independently prove operator-supplied origin beyond this recorded Human/run binding.

Do not add credentials, credential/password/identity digests, tokens, secrets, raw UID/payload,
provider subjects, device serials, encryption keys, internal identifiers, CSV bodies or personal
data.

## Historical snapshot — superseded by 2026-08-10 final closure above — consumed Phase-0 attempts and then-current preflight stop

| Attempt | Fail-closed stop | Cleanup/result |
|---|---|---|
| Phase 0 run 1 | Before Product action: Validation package already installed | Authority consumed; package zero and zero reverse mappings confirmed; no Tag scanned |
| Phase 0 run 2 | Before installation/NFC: active Samsung TalkBack `15.1.01.1` unsupported by the prior Google-only app | Authority consumed; package zero and zero reverse mappings confirmed; no Tag scanned |
| Phase 0 run 3 | Before Tag scan: generic launcher/package resolver did not uniquely start the explicit Activity | Authority consumed; cleaned; no Tag scanned |
| Phase 0 run 4 | Explicit `.MainActivity` reached cold start, then failed on missing ExpoAsset (`DA5-V5-VAL-RUNTIME-01`) | Authority consumed; package/process/reverse zero; no Tag scanned |
| Phase 0 run 5 | Then-current exact `7e8c0f7` Validation APK installed/verified and device checkpoint Human-confirmed; first required validation scan path then showed only generic fail-closed state with no distinguishable cause | Authority consumed; no attributable Tag result and no hardware defect proven; package/process/reverse zero; artifact now historical/DO NOT INSTALL |
| Phase 0 run 6 | On ADO baseline `96daac0b3cf1cfe98249a8c94fe927f34ee33af1` / tree `4e7ccd41a4fda0608a7e9deab7fbc258e1cf94bf`, the then-current exact `e97bbe9` artifact was installed/verified and the device checkpoint Human-confirmed; the first required A-scan showed only `Prüfung sicher gestoppt` / `Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden` | Authority consumed; no cause or Tag result attributable and no hardware defect proven; package/process/reverse zero; artifact now historical/DO NOT INSTALL |
| Phase 0 run 7 | On ADO baseline `aebffbec7c72c028ace6365ecdcc413e314526dd` / tree `9e0104229756fe223753916ace8247ee2626f4d5`, the exact `effc57a` artifact was installed/verified and the authorized checkpoint passed; the first required A-scan stopped at fixed safe stage `technology_evidence` | Authority consumed; no fingerprint or Tag result; concrete physical `techTypes` intentionally not exposed and unknown; no hardware defect proven; package/process/reverse zero; artifact now historical/DO NOT INSTALL |
| Phase 0 run 8 | On ADO/code baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964` / tree `10cdf16421fe564e1961a39d79e20775c0269fc4`, the exact `03694f2` artifact installed successfully; an ad-hoc host regex then rejected its legitimate Android-15 installed path solely because it contained `~`, before `.MainActivity` launch | Authority consumed; Validation process absent; no checkpoint, scan, fingerprint or Tag result and no hardware defect proven; uninstall succeeded; package/process/global reverse zero |
| Phase 0 run 9 | On baseline `2f057cb4e5d096e34785c72c51340f589c711dd2` / tree `6f65f44e53574921f1e8e9fdfde94f7a9a9ade2c`, the operator emitted exactly `artifact:match`, `preflight:match`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`; no scan or UI handoff was reached and the exact install-/launch cause is not reconstructable | Authority consumed; no Product, NFC or hardware defect proven; terminal cleanup restored package/process/global reverse zero |
| Phase 0 run 10 | On baseline `b63641953536bb36625fcd42d850e429ddab8db3` / tree `dc1b9a11e0391074b35139f5948ef6b2c45f1d26`, the operator emitted exactly `artifact:match`, `preflight:match`, `stage=installation status=mismatch category=operation_mismatch`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`; no `installed_provenance` receipt or UI/NFC/Tag step was reached, and the exact cause is not reconstructable because the then-current category also summarized pre-install verification mismatches | Authority consumed; terminal cleanup matched; no Product, APK, NFC or hardware finding proven; another run remains DO NOT START without fresh exact Human authorization |
| Phase 0 run 11 | On baseline `d8549c3f1d14c15846d4f81dbe7669a598626633` / tree `04ea2d0571a2e030fe99fbba27b622e68604644e`, the operator emitted exactly `artifact:match`, `preflight:match`, `stage=installation status=mismatch category=operation_mismatch`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`; no `installed_provenance` receipt or UI/NFC/Tag step was reached | Authority consumed; terminal cleanup matched; no Product, APK, NFC or hardware finding proven; another run remains DO NOT START without fresh exact Human authorization |
| Phase 0 run 12 | On ADO baseline `3fcbcdec79dada8d43041a241127e52f4775e8d8` / tree `74cac3e8611e39938e2c52c25df8cde38be254d2` and exact candidate `9549da9` / tree `ced33c8`, the operator emitted exactly `artifact:match`, `preflight:match`, `stage=installation status=mismatch category=adb_child_transport_mismatch`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`; no `installed_provenance` receipt or UI/NFC/Tag step was reached | Authority consumed; terminal cleanup matched; no Product, APK, NFC or hardware finding proven; another run remains DO NOT START without fresh exact Human authorization |
| Phase 0 run 13 | On baseline `63feaf48a98e656dcceb395098bea8b260420e16` / tree `1d635956eb22c9bba99834ca831159741889e83f`, the read-only device binding matched and the operator emitted exactly `artifact:match`, `preflight:match`, `stage=installation status=mismatch category=adb_child_transport_mismatch`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`; no `installed_provenance`, `waiting`, UI/NFC or Tag step was reached | Authority consumed; terminal cleanup matched; no Product, APK, NFC or hardware finding proven; another run remains DO NOT START without fresh exact Human authorization |
| Phase 0 run 14 | On baseline `887801943064d686da40785d64cd1105431c44ac` / tree `5c15f0fae9c14844b604addf1c38b3bd5203647e`, the Operator session emitted exactly `artifact:mismatch`, `cleanup:match`, `failed:mismatch` and stopped internally at artifact verification because the cleaned environment did not retain the exact Android SDK binding; no preflight, ADB or installation occurred | Authority consumed; terminal cleanup matched; no device/install mutation, Product, APK, NFC or hardware finding proven |
| Phase 0 run 15 | On the same exact baseline after binding `ANDROID_HOME` and `ANDROID_SDK_ROOT` to the authorized SDK, offline artifact verification matched and the Operator emitted exactly `artifact:match`, `preflight:match`, `stage=installation status=mismatch category=adb_stdin_pipe_abort_mismatch`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`; no `installed_provenance`, `waiting`, UI/NFC or Tag step was reached | Authority consumed; terminal cleanup matched; no Product, APK, NFC or hardware finding proven; another run remains DO NOT START without fresh exact Human authorization |

| Phase 0 run 16 | The offline Operator emitted `artifact:match`, `preflight:match`, `install_launch:match`, `waiting:match`; the Human confirmed the displayed device binding; the first physical Tag-A scan stopped at `technology_evidence`; accepted `abort` then produced `cleanup:match`, `failed:mismatch` | Authority consumed; no accepted fingerprint, B/X, Human PASS or retry; no raw technology list, UID or fingerprint; no hardware defect proven; Product/Validation/Operator bindings require independently reviewed supersession |
| Phase 0 run 17 | Exact source `5675297` / tree `b32af38`, execution `be76ce4` / tree `56abec5`; exact-head CI `30612797541`, attempt 1, 12/12 ran on ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176` / tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`; later R0 `[skip ci]` closure `3b544c731d15428334bbadc8e70a3492ef60b886` / tree `52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries that evidence only and is not the Exact-Head-CI SHA; exact receipts `artifact:match`, `preflight:match`, `install_launch:match`, `waiting:match`, `human_pass:match`, `cleanup:match`, `complete:match`; Human confirmed exact device/accessibility binding, 10×A then 10×B then 10×X, every role 10/10, `NfcA`, three distinct safe fingerprints, final title/text and `PASS` | Authority consumed successfully; exit 0; Validation App removed and package/process/reverse null state matched. At the run-17 checkpoint concrete safe A/B/X values had not been transferred and R-035 remained open; run 18 later established the binding. No Product Human V5 authority |
| Phase 0 run 18 | ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` / tree `e2970d1851ab55f99ff7a027e6268ec4b7622643`; source `5675297` / tree `b32af38`, execution `be76ce4` / tree `56abec5`; APK SHA `3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144`; manifest SHA `1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a`; exact receipts `artifact:match`, `preflight:match`, `install_launch:match`, `waiting:match`, `human_pass:match`, `cleanup:match`, `complete:match`; device/UI, 10×A then 10×B then 10×X, every role 10/10, `NfcA`, final UI `PASS` and cleanup matched; A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; format and pairwise distinctness validated | Authority consumed successfully; exit 0; Validation App removed; R-035 locally mitigated and transfer binding established. Product App not installed; Product Human V5 `NOT RUN`; no Product correctness claim. CI `30612797541` is carried only from `f45f49a` / tree `714300d`, not exact-head CI for run 18 or this sync |

Runs 10 through 18 ended with terminal cleanup matched. The run-7 through run-9 artifacts are no
longer installed; runs 10–15 reached no attributable installation provenance; run 16 reached only
the first rejected Tag-A evidence boundary; run 17 passed the complete Validation protocol and
removed the Validation App; run 18 established the exact safe A/B/X transfer binding and again
removed the Validation App. At this historical checkpoint Product Human V5 remained separately
unauthorized and `NOT RUN`, and the R3 Harness-artifact closure plus independent source/artifact
Exact-SHA review still had to pass. The top 2026-08-10 closure records that later pass but grants
no Human-run authority.

### 2.1 Validation Phase-0 operator R1 correction — independently approved, non-executable

On baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree
`10cdf16421fe564e1961a39d79e20775c0269fc4`, the focused correction is published as
`083fdfb259089d976e48f824e0862f10637d3290`, tree
`24bd130500934c6a48fd9314fa06387d6ebdedcd`. It adds only a Core, thin direct CLI, `.d.mts` and
one focused runtime test, with no package script. The candidate binds the exact `03694f2`
APK/manifest and all 32 source-closure records, accepts bounded legitimate
Android installed paths including `~`, streams only a stable verified host snapshot into the exact
package install, proves the installed bytes and identity, launches only
`com.tim180201.mobile.validation/.MainActivity`, and owns fail-closed cleanup without reverse
mutation.

Formal review R1 returned `CHANGES REQUIRED` with exactly two P1 findings: implicit User-0 package
inspection combined with global/default install/uninstall made package provenance fail-open, and
cleanup/finish used only a loop-entry bound while ADB calls, active-operation settlement and
post-SIGKILL runner completion could exceed it. The local R1 correction now accepts only the exact
non-headless single running Owner User 0 topology, proves package null with the user-0
known/hidden/uninstalled PackageManager view, uses `-R` and explicit user-0 package actions, and
latches ownership only after exact install success plus path/canonical/stat/version/digest proof.
It re-attests that token before force-stop and before version-conditional uninstall; any unproved,
ambiguous or replaced package is preserved with mismatch. One absolute deadline now begins at the
first finish/abort request, caps every cleanup wait/ADB call and forbids a match at expiry. Both
shared text and binary ADB paths force terminal rejection after TERM/KILL grace without depending
on child close. Android exposes a version-conditional uninstall but no atomic
digest/signature-conditional uninstall; the remaining same-version final race is therefore
bounded by the existing trusted exclusive Option-A operator/session assumption and is not claimed
as protection against a hostile same-user concurrent package actor.

Focused R1-correction V1/V2 on 2026-07-28 used no ADB or hardware: all three changed operator/
shared-runner MJS entry points passed `node --check`; the exact operator and shared child-runner
test files passed 128/128 together; Mobile `tsc --noEmit` passed; and
`tsc --noEmit --listFilesOnly` explicitly included both changed test sources. No V3, artifact
verification, Android export, exact-head CI, installation or hardware action was run for this R1
correction.

The initial focused regression proof failed exactly one test because the deliberately narrow
parser rejected the legitimate Android-15 `~` path. After correction, both operator files passed
`node --check`, the focused suite passed 92/92, Mobile `tsc --noEmit` passed, and
`tsc --noEmit --listFilesOnly` confirmed the focused test is included. All 32 source-closure files
matched the immutable manifest byte-exactly, and the official read-only Validation artifact
verifier was run exactly once and passed. These checks used no ADB or hardware.

The complete Mobile suite was run once in the existing workspace: 51/52 test files and 792/793
tests passed. Only `da5V5ValidationNativeSourceBinding.test.ts` failed because existing generated
native `.cxx`/`build` residue expanded the enumerated native closure beyond its fixed source bound;
the new operator paths are not members of that closure. Per Technical-Lead direction nothing was
deleted or moved and the suite was not repeated in the contaminated workspace.

The final fresh safe-root V3 used Node `24.17.0`, npm `11.13.0` and a task-owned isolated
PostgreSQL `17.10` cluster. It passed 20/20 builds, 21/21 tests-inclusive typechecks and 21/21
workspace suites covering 148 test files, 2,467 passed tests and exactly two documented optional
B1 skips. Migrations 001–013 applied, replayed idempotently and passed ledger verification; the
C3B binary check, 52/52 Mobile test-file inclusion, the unchanged official Validation artifact
verifier and Android export of 861 modules passed. The first Backend API invocation stopped only
because the Technical-Lead runner had bound four C2 runtime URLs to the installer identity; after
correcting that environment binding, Backend API and the then-unexecuted remaining workspaces
passed. The first Synthetic invocation later stopped only because its task-owned database used an
alternate safe name while the suite requires exact `taptime_synthetic_android_e2e`; renaming that
same isolated database and rerunning only Synthetic produced 288/288. Neither runner correction
changed candidate bytes. The isolated server, port, worktree and export were cleaned; the three
task-owned directories were moved recoverably to the macOS Trash. No ADB or hardware was used.

The final post-R1-correction fresh safe-root V3 used the same exact toolchain and a new task-owned
isolated PostgreSQL `17.10` cluster. It passed 20/20 builds, 21/21 tests-inclusive typechecks and
21/21 workspace suites covering 148 test files, 2,484 passed tests and exactly two documented
optional B1 skips. Migrations 001–013 applied, replayed idempotently and passed ledger
verification; the C3B binary check, 52/52 Mobile test-file inclusion, the unchanged official
Validation artifact verifier and Android export of 861 modules passed. The first Synthetic
invocation passed 12/13 files and 285/288 tests; its three failures were exact
`Da5V5CiPostgresAdapter` `ENOENT` results because the Technical-Lead sparse-worktree definition
had omitted the tracked `.github/workflows/ci.yml`. Materializing only tracked `.github` and
executing only that affected file passed 31/31; candidate bytes were unchanged and the combined
unique Synthetic matrix is 13/13 files and 288/288 tests. The final exact 11-file candidate
matched the source workspace byte-for-byte and passed scoped diff inspection. Task PostgreSQL,
ports, worktree and export were cleaned, the existing local PostgreSQL listener remained
untouched, and the three task-owned directories were moved recoverably to the macOS Trash. No ADB,
installation or hardware was used.

Exact-head CI `30402655381`, attempt 1, passed 12/12 on
`083fdfb259089d976e48f824e0862f10637d3290`. Independent Exact-SHA re-review round 2 returned
`APPROVED` with zero open P0–P3 and closed both round-1 P1 findings. The review archive is
`ADO/05_Evidence/Development_Assignment_05_V5_Validation_Phase_0_Operator_Correction_Independent_Exact_SHA_Review.md`.
The candidate remains **DO NOT START** and grants no Phase-0, installation, ADB, hardware or
Product Human-V5 authority.

### 2.2 Historical published Phase-0 readiness candidate — V3 passed; V4 failed; review changes required; Product Human V5 not run

The published eight-file candidate
`496ca59f0965670b29a210b8aa2443b99bb4a386`, tree
`b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`, starts from exact baseline
`fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree
`da69081517d2b0b9631eaef393b0a6022735061e`. It replaces only the incompatible process-query
boundary with strict Android-Toybox `ps -A -w -o NAME:4` parsing, adds the one-time
`human-pass`/separate Human-passed state, extends the persistent idempotent signal set to exactly
`SIGHUP`, `SIGINT`, `SIGQUIT` and `SIGTERM`, and makes terminal receipt/deadline ordering
deterministic. It changes no Validation App or artifact input and remains **DO NOT START**.

The final fresh detached sparse safe-root V3 bound executable-patch SHA-256
`5dea48121b62fe7ebb4894f72425aa5ef5f759e113c3dd349f9fd48bb29fe9b4`, Node
`24.17.0`, npm `11.13.0` and task-owned PostgreSQL `17.10`. Its unique build evidence is
20/20: the first alphabetical invocation passed 15/20, then only the five dependency-sensitive
not-yet-successful builds ran topologically and passed 5/5 without candidate-byte changes.
Typechecks passed 21/21. All 21/21 workspace suites passed across 148 test files and 2,505 tests
with exactly two optional B1 Supavisor skips; Mobile passed 52/52 files and 857/857 tests, and
Synthetic passed 13/13 files and 288/288 tests. Migrations 001–013 applied, replayed with
`applied=none` and passed ledger verification. C3B `verify-bin`, 52/52 Mobile test-source
inclusion, the unchanged official `03694f2` artifact verifier and one isolated Android export of
861 modules passed. One pre-mutation migration-runner assertion stopped only on the macOS
`/tmp`/`/private/tmp` lexical alias before the canonical-path continuation passed; the Mobile
inclusion `tsc --listFilesOnly` succeeded before two comparison-only PATH corrections and its
single final comparison matched 52/52. No product assertion was retried. PostgreSQL was
reattested and stopped, ports 55437/55435 were absent, and the complete task root containing the
safe clone, npm cache, PGDATA and export was moved recoverably to Trash. The candidate's four-file
ADO synchronization was R0 over unchanged executable/test bytes. The safe-root V3/eight-file
candidate itself has no code finding.

Exact-candidate CI `30427205223`, attempt 1, completed failure with 11/12 jobs. Job
`90496143535` became red after its 3/3 files and 121/121 assertions passed because a subsequent
unhandled PostgreSQL `57P01` occurred on `taptime_c3e1_dirty_*`. The C3E1 test, backend and
workflow are unchanged; the test blob is identical to green `083fdfb` and five previous green CI
runs. The cause is the `dirtyPool.end()` to immediate `DROP DATABASE ... WITH (FORCE)` sequence
racing asynchronous client-end handling in `pg-pool@3.14.0`. Independent formal review returned
`CHANGES REQUIRED` with exactly one P2 outside the candidate scope for CI/test reliability and no
Product or Security finding. No retry was authorized or executed. At that historical checkpoint,
a focused harness correction and new CI required new Human authority; no Phase-0, installation,
ADB or hardware authority existed.

### 2.3 Historical PostgreSQL test-cleanup correction — V4/review approved; Product Human V5 not run

The subsequently authorized focused test-only correction is
`21e518151a3f4727ebf4ce90cd1557660960ff21`, tree
`8f764f9260378b631b4b026355852c324d6dc06b`, on exact parent
`d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree
`753feedcae6724e711557e6492bbe26fa0b02083`. Its exact seven-file test-only delta is
+192/-12 with SHA-256
`b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`. It removes the
equivalent post-`Pool.end()`/drop race from the known B3, C3B, C3C and C3E1 dirty-database
finalizers: each waits boundedly for zero sessions of the exact bound test database, then drops
without `FORCE`. The separate pre-test cleanup and C3E2 remain unchanged.

Focused V1 passed 2/2. V2 passed B3 128/128, C3B 60/60 and C3C+C3E1 102/102; tests-inclusive
typechecks for schema, bootstrap and administration passed. The unchanged safe-root V3 evidence
from `496ca59`/tree `b398b89` was carried forward under unchanged product, operator, Validation
App/artifact, workflow, dependencies and lockfile. Exactly one new full exact-head CI,
`30429746848`, attempt 1, passed 12/12; no retry occurred. Independent source/delta and final
Exact-SHA/V4 reviews returned `APPROVED` with zero open P0–P3. The historical P2 is closed; no
Product or Security finding remains.

This correction and its evidence grant no Phase-0, installation, ADB, hardware, device/Tag or
Product Human-V5 authority. The operator remains **DO NOT START**, and Product Human V5 remains
`NOT RUN`.

### 2.4 Historical install-/launch-diagnostic predecessor — exact candidate/review approved; Product Human V5 not run

Candidate `8ce03852e782d541319bb852f216cf596ab1787f`, tree
`f5b914c1b8f1243244733808beaef54f0351a563`, on exact parent
`2f057cb4e5d096e34785c72c51340f589c711dd2` contains the exact eight-file +488/-132 delta with
patch SHA-256 `c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`.
It preserves the aggregate `install_launch`, fail-closed cleanup, ownership, absolute deadline,
Human-PASS and terminal semantics. A failure emits exactly one matching fixed stage from
`installation`, `installed_provenance`, `prelaunch`, `activity_start` and `postlaunch`, plus
exactly one category from `operation_mismatch` and `verification_mismatch`, immediately before
`install_launch:mismatch`. The mapping is selected only by local closed control flow. No
`Error.message`, raw command output, installed path, device serial or PackageManager output is
emitted.

V1/V2 executed green: both changed MJS files passed `node --check`; the complete affected Mobile
Operator test file passed 137/137; Mobile `tsc --noEmit` passed and its `--listFilesOnly` result
included the changed test source. The first typecheck exposed only a new test-callback
implicit-`any` (`TS7006`); that test typing was corrected and the repeated focused
test/typecheck sequence passed. Unchanged green V3 from `496ca59`/tree `b398b89` was carried.
Exact-head CI `30459539801`, attempt 1, passed 12/12. Independent
Exact-Delta/Commit/Tree/CI review returned `APPROVED` with zero open P0–P3.

No ADB, installation, App launch, hardware or network action was performed. The candidate remains
**DO NOT START**; this approval grants no Phase-0, installation, ADB, hardware or Product Human-V5
authority. Any run requires separate fresh exact Human authorization.

### 2.5 Historical final install-category correction — V2/V3/V4 and reviews approved; Product Human V5 not run

Published candidate `12d1ace89494851025555d1d06d45570c4fcc4cb`, tree
`b747b4306637d90765b33f273ad89291bd4ea9a7`, has exact parent
`b63641953536bb36625fcd42d850e429ddab8db3`. Its exact code/test delta is limited to
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`; the complete published
six-file delta adds only the four synchronized ADO truth files. The correction keeps pre-install
device re-attestation mismatches in `verification_mismatch` and switches to
`operation_mismatch` immediately before the PackageManager install call.

V2/V3 passed as recorded above. Exact-head V4 CI `30466798295`, attempt 1, completed
successfully 12/12. The prior round-2 delta review and final independent Exact-Head/V4 review
returned `APPROVED` with zero open P0–P3; the round-1 P2 is closed. This is the technically final
install-category correction. At that historical checkpoint, all ten Phase-0 authorities were
consumed, the operator remains
**DO NOT START**, and no fresh Phase-0, hardware, ADB, installation or Product Human-V5 authority
exists.

Run 17 populated every historical UI/result row below through the trusted Human handoff. The
automated operator did not independently attest UI truth. Run 18 separately transferred the exact
safe values recorded in the following transfer table.

| Run-17 Phase-0 Human observation | Result |
|---|---|
| Exact displayed model, Android release/API/build and **200 %** font scale match the authorization | `MATCH` — `SM-A336B`; Android 15/API 35; exact expected build matched; Owner User 0 |
| Exactly one installed and active authorized Google-or-Samsung TalkBack package/version | `MATCH` — Samsung TalkBack `15.1.01.1` |
| Role A: ten separate successful stable presentations using only physical Tag A | `MATCH` — 10/10 |
| Role B: ten separate successful stable presentations using only physical Tag B, after A | `MATCH` — 10/10 |
| Role X: ten separate successful stable presentations using only physical Tag X, after B | `MATCH` — 10/10 |
| Three pairwise-distinct disclosure-safe 12-uppercase-hex fingerprints | `MATCH` by Human observation; concrete safe values were not transferred or recorded before cleanup |
| Every role displays `NfcA`; fully qualified NfcA is required, harmless extra/duplicate Android technologies are ignored, and MifareUltralight alone is insufficient | `MATCH` |
| Final title `Alle drei Rollen stabil gebunden` | `MATCH` |
| Final text `A, B und X sind stabil, eindeutig und voneinander verschieden.` | `MATCH` |
| Explicit trusted Human `PASS`, then unique operator receipt `human_pass:match` | `MATCH` |
| Cleanup after Human-passed state | `MATCH` |
| Terminal `complete:match` with no later `failed:mismatch` | `MATCH`; exit 0 |

| Run-18 disclosure-safe transfer | Result |
|---|---|
| Role A fingerprint | `B55E8B6AEB30` |
| Role B fingerprint | `32A54C8F2F29` |
| Role X fingerprint | `F61C9F702CFE` |
| Each value matches 12-uppercase-hex format | `MATCH` |
| A/B/X pairwise distinctness | `MATCH` |
| Exact authority and terminal cleanup | `CONSUMED SUCCESSFULLY`; `cleanup:match`; `complete:match`; exit 0 |
| Product boundary | Product App not installed; Product Human V5 `NOT RUN`; no Product correctness claim |

Cancel, timeout, any safe failure stage/text, ambiguity, wrong Tag/role/order, reset desire or any
early, duplicate, late or foreign command consumes a future authority and requires immediate
`abort`/cleanup without reset, retry, resume or evidence reuse. `complete:match` would prove only
the combined Human-PASS handshake plus operator/cleanup success, never APK approval or Product
Human V5.

### 2.5 Historical closed findings and confirmed TECH-01 correction — Human Phase 0 was still gated at that checkpoint

`DA5-V5-VAL-UI-01` records a repository-visible accessibility/UI reliability gap capable of
reaching the strict Controller concurrency rejection when TalkBack repeats an otherwise identical
device-confirmation or active-scan activation. This code-level gap does not retrospectively prove
the indistinguishable run-5 cause or a hardware defect. The focused local correction adds a
separate UI-only explicit offer/revision boundary for identical repeated activations, keeps true
concurrent/out-of-order/foreign Controller calls fail-closed, restricts UI failure reasons to a
fixed disclosure-safe allowlist and removes Reset while capture owns the native operation while
retaining explicit Cancel/cleanup. It supplies no new Phase-0 authority. Source
`e97bbe9e2a281099899e2ecb3aad2588ef20f22d`, tree
`2958f456875e8dab3f10834df280e10a8438efce`, exact-head CI `30370977809`, attempt 1,
12/12, its Round-2/Round-3 source reviews and formal Source/Artifact Exact-SHA review are
`APPROVED` with zero open P0–P3. The exact replacement APK/manifest passed the official verifier.
That `e97bbe9` artifact and the earlier `7e8c0f7` values are now **HISTORICAL — DO NOT INSTALL**.

The native-capture diagnostics correction is source
`effc57a6780ff86784de0519a34abd6c5b7b8cd6`, tree
`758dbfaa04d0968fb25122352055fbcb80f8f022`, exact-head CI `30377569479`, attempt 1,
12/12. It maps Technology evidence, UID readability, listener/registration, digest, concurrency
and cleanup to six closed, typed, fixed allowlisted disclosure-safe stages without raw UID,
payload, Technology list, provider diagnostic, exception text or Logcat. NFC acceptance, timeouts
and Controller fail-closed behavior remain unchanged. Independent source review, final
prepublication review and Artifact Exact-SHA review are `APPROVED` with zero open P0–P3. The
`effc57a` APK/manifest is now historical/DO NOT INSTALL.

`DA5-V5-VAL-TECH-01` is confirmed as an over-strict closed-list repository check. Source
`03694f2d877bc323791e93473ad01ceb82af70df`, tree
`6c6039683e067ef29f1f917a60c2628d26e38784`, exact-head CI `30386552118`, attempt 1,
12/12, and prepublication review round 2 are `APPROVED` with zero open P0–P3. Historically,
`NfcA` and `MifareUltralight` were mandatory as a required subset while additional or duplicated
entries were ignored. That historical contract and its exact APK/manifest passed the official
verifier and independent Source/Artifact Exact-SHA review with zero open P0–P3, but are now
superseded and remain **DO NOT INSTALL**. The run-7
`technology_evidence` stage does not disclose the physical list and proves no fingerprint, Tag
result or hardware defect. Any future Phase-0 use requires a superseding independently reviewed
NfcA-only source/artifact/operator set and a fresh separate exact Human authorization binding it.

### 2.6 Product Human-V5 preflight

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

## 3. Product Human V5 staged results

| Gate | Mandatory coverage | Result | Human checkpoint |
|---|---|---|---|
| A | Auth/enrollment, completed first assignment capture, separate Admin Setup Preview 2, zero lifecycle/queue/replay, setup preservation and rejection paths | `PARTIAL — RUN CONSUMED` | Administrator auth, Tag-A assignment, assigned-Tag preview rejection and signed-out Tag-A rejection observed; Enrollment field remained empty after transfer, so no Gate-A PASS |
| B | Cold/background Tag Dispatch; duplicate WorkEvent/Decision/Receipt/Audit with `duplicate_scan_ignored`; zero second TimeEntry mutation | `NOT RUN` | — |
| C | Online target/provenance/own-time truth with every opposite toggle strictly after five seconds | `NOT RUN` | — |
| D | Ordinary offline/restart/cancellation, reviewed historical cutover, ordered `review_pending`, protected-state stop and no reuse | `NOT RUN` | — |
| E | Final read-only TalkBack, text scaling, focus/labels/announcements and layout without repeated business mutation | `NOT RUN` | — |
| F | Final safe truth and complete cleanup | `NOT RUN` | — |

## 4. Product Human V5 disclosure-safe result record

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

## 5. Product Human V5 failure, interruption or ambiguity

- Disposition: `FAIL_CLOSED`
- Gate/step: `Gate A / Enrollment Credential transfer`
- Disclosure-safe symptom: focused password field remained empty after transfer attempts
- Later gates not started: remaining Gate A and Gates B–F
- Authority consumed: `YES`
- Retry/repair/resume performed: `NO after terminal consumption`; earlier individually authorized
  in-run transfer attempts produced no visible field mutation

Any `FAIL` or `AMBIGUOUS` result consumes the complete one-run authority. Preserve only safe
diagnostics, mark all later gates not started and perform cleanup. No observation is reusable.

## 6. Product Human V5 cleanup

| Check | Result |
|---|---|
| Mobile/Admin sign-out and clipboard/download/screenshot cleanup | `MATCH` — no Mac clipboard Credential mutation in the consumed path |
| Scoped service shutdown and mapping/listener cleanup | `MATCH` |
| Exact synthetic package removed | `MATCH` |
| Protected/Review fixture scoped teardown, without product repair/adjudication | `NOT REQUIRED` — fixture not started |
| Disposable database/schema/ledger/runtime roles removed | `MATCH` |
| Repository binding reverified with protected exclusions | `MATCH` |
| Unrelated device/repository/PostgreSQL state preserved | `MATCH` |

## 7. Final Product Human V5 disposition

- Overall result: `FAIL_CLOSED — CONSUMED AND CLEANED`
- Product Human V5 checkpoint authority: `NOT BOUND`
- DA5 V5 closure decision: `OPEN — superseding reviewed Hardware candidate required`

This shell, automated evidence, software `MERGE_READY` status or cleanup alone cannot pass V5.
Production, production data, signing, deployment and distribution remain unauthorized.

## 8. Attempt-11 Harness-artifact closure evidence — terminal fail-closed

- Publication: `32272ca8e1155839380797cadb64fbc454bf2133` / tree
  `4f11d9a86f7a060a3a2cfccda4eb7520c2145aa1`
- Executable source: `a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
  `102c913e264bd0ccce1d085db1c50bd407f7d4a4`
- Receipt schema/map: `DA5-V5-HARNESS-ATTEMPT11-RECEIPT-1` /
  `DA5_V5_ATTEMPT11_COMMAND_MAP_V1`
- Terminal result: `FAIL_CLOSED`; single R3 authority consumed; independent failure/evidence
  review `CHANGES REQUIRED` with exactly one P2

The immutable 45-record receipt reports records 1–31 `PASS`. In particular, Mobile Typecheck
process exits are `[0,0]` and its exact result is complete, 103,561 stdout bytes, 868 unique final
normalized paths, set SHA-256
`800bde4fdcec0b449da50e9cffd430f7215f4c4f40f0897a3cfca0447b25c8bf`, required/observed path
`apps/mobile/tests/runtime/da5V5AndroidDevice.test.ts`, inclusion true and raw-list preservation
false. Synthetic Typecheck exits are `[0,0]` and its result is complete, 68,700 stdout bytes, 569
unique final paths, set SHA-256
`0a88003f7aa7dd34d1cb6dd058f25444c35e0621f8b6ef4f0a976df413f7ec99`, required/observed path
`apps/synthetic-android-e2e/tests/Da5V5AdbController.test.ts`, inclusion true and raw-list
preservation false. Both failure codes are null.

Record 32 `V2_SYNTHETIC_TEST` is `FAIL`; its one exact mapped process exited 1. No raw stdout or
stderr is Evidence, so no failure cause and no Product/Harness/test defect are claimed. Records
33–41 are individually `omitted`. Therefore V2 Synthetic build, the carried V2 gates, aggregate
build, Node check, Metafile/TalkBack closure and artifact preservation did not run; the Artifact
output is absent. Record 42 snapshot, record 43 cleanup and record 44 postcleanup are `PASS`.
Record 45 and the manifest are `FAIL_CLOSED` because record 32 failed.

Final cleanup state is `cleanup_complete`. All ten flags—checkout/cache/logs/config absent,
artifact absent-or-preserved, registration absent, worktree mapping absent, evidence preserved,
cleanup complete and postcleanup complete—are true. The external npm-log set remained count 11 /
SHA-256 `80a1dc655812427ae4541df6e2bd9ece4834efa17bfa9d5e2dec2370a74f79af`; no name or content is
preserved. The checkout, cache, logs, config, artifact and exact registration paths are absent.

The evidence directory
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt11-a0359a87-fdf09c30`
is mode `0555` and contains exactly:

| Evidence file | Mode | Size | SHA-256 |
|---|---:|---:|---|
| `attempt11-command-receipt.jsonl` | `0444` | 187,477 bytes | `9b555534c18ca90fb1a4c18f377bb5f488d04f8805db3692564ff4d08f9916ef` |
| `attempt11-precleanup-receipt.jsonl` | `0444` | 158,811 bytes | `6f0a840d22a17fcc6b77a1f447bf6e1f23ef6f15fecf96b77a7dde491da58abc` |
| `attempt11-evidence-manifest.json` | `0444` | 2,790 bytes | `b1e198bd18e3c5eb71e4374f4114e3620f79929732bc87083dc834275cad5653` |

Independent review confirms that the immutable Gate-32 evidence establishes only the exact mapped
Vitest run exit 1, `raw_output_preserved:false` and `mapped_process_exit_nonzero`. Assertion,
collection, transform, hook, configuration, worker/process and infrastructure causes remain
indistinguishable. No Product, Harness or test defect is proven. The fail-closed stop, ordered
omissions and cleanup remain safe.

The two Typecheck result objects each contain exactly the required nine fields with
`raw_list_preserved:false`. Mobile records 103,561 stdout bytes, 868 final normalized set members
and inclusion of its exact expected member. Synthetic records 68,700 bytes, 569 members and
inclusion of its exact expected member. No raw list is Evidence.

The sole future-facing statement is a non-authorizing open evidence need. Any possible later
candidate would require a bounded closed Vitest result schema for pass and failure; a
source-allowlisted expected-test set with normalized repository-relative count/digest/membership;
test and file counts; and a closed failure category plus stable canonical signature. Messages,
stacks, raw stdout/stderr, arbitrary paths and secrets must remain excluded. If JSON output were
later selected, its output root would need exact command mapping, bounds, schema and cleanup.
That Attempt-11 terminal evidence section itself binds no Attempt-12 candidate, token, digest,
command map or path or authorizes its implementation/execution. Attempt 11 remains consumed with
no retry or resume. No Hardware,
Human/Product V5, production, production-data, deployment or distribution authority follows.
Product Human V5 remains `NOT RUN / NOT BOUND / DO NOT START`.

## Historical snapshot — superseded by 2026-08-10 final closure above — Attempt-12 prospective evidence contract

Attempt 11 remains consumed. Its independent review returned `CHANGES REQUIRED` with exactly one
P2 because the immutable Gate-32 evidence can establish only exact mapped Vitest exit 1 and cannot
decide a narrower failure cause. It proves no Product, Harness or test defect. Attempt 12 is only
an R0 ADO candidate with status `REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE`; there is no
Attempt-12 receipt, snapshot, manifest, artifact, path or execution state.

Independent review of Attempt-12 Round 1 returned `CHANGES REQUIRED` with exactly one P2: the
29-field result and 13-field binding evidence objects were not closed for every type/null/default,
lifecycle tuple, exclusive category and signature state. Round 2 corrected that prospective
evidence contract. Round-2 review returned `CHANGES REQUIRED` with exactly two P2 and one P3 for
incomplete simultaneous-fault precedence, missing disclosure-safe signal termination and stale
document-head truth. Round 3 corrected those findings. Round-3 review returned `CHANGES REQUIRED`
with exactly one P2 in signal-terminated `WORKTREE_ADD[0]` Cleanup-V2 binding. The first focused
correction closed that coupling. Its re-review returned `CHANGES REQUIRED` with exactly one P2:
terminal `cleanup_residue` lacked schema-legal absorbing evidence for all 56 mismatch/ambiguity
tuples. This correction closes only that point; independent re-review remains pending.

The candidate binds future evidence to token `710d46dc`, exact unchanged source
`a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`, inherited 45-gate direct no-shell ordering, all
three npm groups, Membership Receipt Schema V1, and Cleanup Receipt Schema/Contract V2. Its exact
descriptor/npmrc/map hashes are
`dffb1647781084f9e81ff34447d603ebbfaad1c2b1d595109b1eebc6cbd9210a`,
`7308ea83d13da67fa75178f530444db9649f371cd79266363d1f2d7f49f64c82`, and
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`.
The exact command map is 222,596 compact UTF-8 bytes. Cleanup Receipt Schema V2 is 84,102 compact
UTF-8 bytes / SHA-256 `4caa1b43e2b99b22400ce16213bff4b890dd855b13e4caafae8829fe7ff82d94`.
The embedded reporter schema remains 73,538 compact UTF-8 bytes / SHA-256
`c78b307bb5003e1d81a97dd909b9ddaeeabda4c98d1475f1a185e680cfb304a7`.

Gate 32 retains its prospective evidence: the locked Vitest 4.1.9 reporter file is bounded to 16
MiB, identity-/containment-checked and parsed under the closed embedded schema. Its reported file
membership must equal the exact 13 tracked source-allowlisted test paths; the canonical compact
set is 883 bytes / SHA-256
`6d3d0d28585a65d8e1357716285896176549416262b3fdba5e5a88ff4966716f`. The receipt may preserve
only sanitized reporter byte count/success, expected/observed membership counts and digests,
missing/unexpected and file/suite/test counters, process exit, closed failure code/category, stable
canonical failure signature, and reporter cleanup/identity facts.

The prospective 31-result/13-binding evidence is now an exact-key, no-`undefined`, no-extra
contract. Five normalization statuses and twelve lifecycle states determine every
null/boolean/identity and terminal cleanup tuple. Forty-six unique ranks choose one deterministic
pre-normalized failure, with `unknown_field` before `schema_type_mismatch`; 12 multi-fault
fixtures bind exact outputs. Every started child is exactly exit/integer/null or
signal/null/closed-category, while raw signals never persist. Categories are first-match,
mutually exclusive and exhaustive. The legacy-named signature is required for every fully
normalized tuple including PASS, signal termination and contradiction, null before normalization,
and recomputed with the exact cleanup override if normalized cleanup leaves residue.

The prospective Cleanup-V2 timing evidence for `WORKTREE_ADD[0]` contains 13 exact fields and
deep-equals outer/inner termination tuples. On signal, the 64 checkout/registration/mapping
observation tuples are classified exactly once as unbound, partial, bound or cleanup residue.
Eight signal fixtures cover no materialization, checkout only, registration/mapping only, fully
bound, identity mismatch, mapping mismatch, ambiguity and invalid removal; six termination
fixtures cover not-started, exit-zero, exit-nonzero, signal and invalid collisions. Only fully
exact bound evidence may enter unchanged revalidated Cleanup-V2 removal; all other signal paths
authorize no deletion and end cleanup/POSTCLEANUP as cleanup residue.

All 56 mismatch/ambiguity tuples now have exact prospective gate fixtures. Binding persists
`cleanup_residue`; `CLEANUP` and `POSTCLEANUP` retain it only at their named evidence boundaries,
each with sequence +1, immutable state facts and no root/registration removal. `FINALIZE` copies
the named immutable records, retains residue, records both completion flags false and remains
`FAIL_CLOSED`. There is no general residue transition, repair, rebind, resume or promotion path.

Raw JSON, stdout/stderr, names, titles, messages, failure messages, stacks, timestamps, durations,
metadata, tags, arbitrary paths and secrets are never Evidence and never enter receipt, snapshot,
manifest or artifact. The raw reporter is never copied. It must be identity-safely removed before
receipt, or its exact cleanup is deferred only to bound checkout removal and all success claims
fail closed. Ambiguous categories are intentional evidence boundaries, not diagnoses.

Independent `APPROVED` review and exact publication are prerequisites before the standing Human
authorization can activate exactly one future R3 Attempt-12 run. Until both occur, nothing in
this section is executable evidence authority. No Hardware, Human/Product V5, production,
production-data, deployment or distribution authority follows.

## Attempt-12 immutable terminal evidence and review result

Evidence root:
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt12-a0359a87-710d46dc`.

| File | Bytes | SHA-256 | Mode |
|---|---:|---|---:|
| `attempt12-command-receipt.jsonl` | 73,329 | `eae30ed497d64392c26dbd670b2118b5396bfbf6d63da4e7fffea59b45f26f21` | `0444` |
| `attempt12-precleanup-receipt.jsonl` | 45,249 | `e6c040d2db7943b3f8782b0734bdcacc836b2a28d610ce6dde1ee54e4926b864` | `0444` |
| `attempt12-evidence-manifest.json` | 966 | `7acc9cd3848e80a760edc77f2aa005b38329b62136a92ebb1bd29153374707d8` | `0444` |

The directory is mode `0555`. The receipt has exactly 45 ordered records: 34 passed, two failed
and nine omitted. Failed records are Gate 32 `V2_SYNTHETIC_TEST` and Gate 45 `FINALIZE`.
Gate 32 records exact exit 1, reporter size 118,443 bytes, expected/observed file-set digest
`6d3d0d28585a65d8e1357716285896176549416262b3fdba5e5a88ff4966716f`, 13/13 membership,
13 total/11 passed/two failed files, 42 total/38 passed/four failed suites, and 297 total/273
passed/six failed/18 skipped tests. Its category/code are
`assertion_result_or_test_hook_failure_ambiguous` / `vitest_reported_failure`. Raw report and raw
streams were not preserved. This is an intentional ambiguity boundary and proves no cause.

Independent review is `CHANGES REQUIRED` with three P2 and one P3 synchronization item: missing
mapped Cleanup/Postcleanup child evidence; no prepublished exact executor artifact; missing
persisted canonical per-file signature inputs; and correction of the prior 35/1/9 statement to
34/2/9. Cleanup/path absence is verified but cannot cure those immutable evidence gaps. Attempt 12
is consumed and grants no retry.

## Attempt-13 prospective evidence contract — no execution evidence yet

The retained Round-3 and Round-4 pre-execution artifacts remain immutable and are superseded. At
the historical Round-5 candidate state, the only Attempt-13 material was this now-superseded
read-only pre-execution executor artifact:

- executor root:
  `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-a0359a87-483fcf40-r5-plcym5sw`,
  mode `0555`, exactly two entries;
- executor: 352,258 bytes, mode `0444`, SHA-256
  `f5cad177fc8efaefcb0d8d1b52f626c809be9cb3f46e9446a62cd6b60a74b4ec`;
- executor manifest: 1,111 bytes, mode `0444`, SHA-256
  `8d6416d99717efe8929d3f6dcb639fa10a9dd8ab14dd452eabc6d23ca9d23fab`; its closed
  `supersedes` object binds the Round-4 root and both Round-4 entry digests;
- development-bound Node syntax check: passed;
- bounded collect-all handler-driven no-mutation self-test: passed 314/314 fixtures, zero
  failure tuples, 45 gates, 25
  collectable slots, fixture-name-set SHA-256
  `8d69314f7a703cfe5c44011033e3325e505667c33f9d631618172ff72e9262c4`, empty failure-set
  and empty-ledger digest `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`,
  max-ledger digest `8b3f59e179040dcb3d30611abb1ef55fc679b4fe807ac9ce721d678fc122055d`,
  `raw_output_preserved:false`, `mutation_performed:false`.

Round-2 independent review returned `CHANGES REQUIRED` with three P1 and four P2 findings. Round 3
closes exact Gate-42 null/partial-state finalization, full-write/sync/readback receipt transaction,
parent/creation-bound artifact rollback or residue, fresh Postcleanup identity, immutable
committed-record quality linkage, complete Gate-32 preflight/failing-file closure and exact
lstat/fstat source size/digest. Focused Round 4 additionally closes the snapshot-residue,
null/ambiguous artifact-transaction, prejournal rollback-failure and stale authorization-header
findings without changing Product code, schema, dependencies, lockfile or workflow. Intermediate
development checks failed closed once at the legacy
fail-fast first matrix fixture, once at an over-restrictive pre-fixture name guard, and then with
all nine diagnostic matrix reds / failure-set SHA-256
`5d7b102b667868672313e0fec026be5e4d496e1b182e1f076de46d9eef8327ee`; their common correction is
derived from the loaded map.

Formal Round-4 review returned `CHANGES REQUIRED` with exactly two P1 findings. Focused Round 5
persists the descriptor/lstat-bound receipt creation identity and stage before fallible initial
realpath/readback, retaining the handle and binding on either failure. It also validates artifact
state, transaction, parent, creation and root identities as strict exact schemas before equality,
absence or removal. Only exact `{exists:false,stat:null}` proves absence; malformed, falsy or
partial values retain truthful residue with zero removal, and empty identities never compare
equal or establish `creation_identity_bound`. The current final 314-fixture category counts are
artifact-transaction 37,
carry-handler 1, cleanup-handler 6, cleanup-residue-matrix 56, contract 2, dependency 2,
executor-root 6, finalize-derivation 4, finalize-transaction 6, gate32-handler 11, gate42-handler 1,
gate42-transaction 20, journal-transaction 21, postcleanup-handler 5, quality-handler-link 29,
quality-ledger 19, receipt-transaction 7, sequence-handler 1, signal 36, vitest-contract 29,
vitest-preflight-matrix 9 and vitest-source-identity 6. Independent exact-delta/artifact re-review remains pending. The prior V3 claim
remains revoked; V3 is `PENDING` until the Technical Lead independently repeats the final exact
checks. Product source is unchanged. No Product or Attempt execution occurred, no Product
correctness is proved and no Attempt-13 checkout, cache, log, config, receipt/evidence or
success-artifact path was created.

A future valid receipt has exactly 45 records. Every record binds its entire sanitized object by
`gate_result_signature`. The quality ledger contains at most 25 unique gate-number-sorted entries
and exactly one or zero entries per collectable gate. It preserves count and compact-list digest,
never raw output. At most one hard-stop object is permitted. Every omission has a distinct
`dependency_omitted` or `not_run_hard_stop` reason and a digest-bound direct-dependency list.

Gate-32 normalized failure evidence additionally preserves `failing_files` with exact allowlisted
path, failed assertion count and identifier-multiset SHA. This makes its normalized-result
signature independently recomputable without raw reporter content. The loaded adapted map binds
the exact signature schema `DA5_V5_ATTEMPT13_VITEST_FAILURE_SIGNATURE_V1`. The executor validates
the complete 31-field result, 13-field binding and all cross-field partitions. Legal preflight and
process-not-started paths remain schema-valid; the latter has an empty process array and explicit
gate termination. Its inventory contains exactly `node_modules` and the reporter root.

CLEANUP and POSTCLEANUP each preserve their mapped child and exact named cleanup objects. Cleanup
state, identity and mapping shapes have respectively 8, 4 and 6 fields; the fixed-order five root
results have 9 fields each and the registration result 13. Missing, partial, mismatched or
ambiguous binding performs zero removal. All 56 such tuples retain absorbing `cleanup_residue`
through CLEANUP and POSTCLEANUP; FINALIZE copies the frozen committed records, makes no transition,
sets both completion flags false and remains `FAIL_CLOSED`. POSTCLEANUP observations are fresh; no
extra Git probe child is evidence. Source size/digest drift maps to the existing closed
`unexpected_file_path` code.

On an ordinary failed future run, the evidence manifest must be `FAIL_CLOSED`, artifact must be
`null`, and the success-artifact path must be absent. If a caught Finalize publication fault leaves
a root whose exact parent/creation binding cannot be revalidated, removal is forbidden and the
manifest instead binds the closed artifact-residue descriptor with no success claim. Null or
partial transaction state and thrown state observation are likewise ambiguous, authorize zero
removal and retain truthful residue; a creation-bound descriptor requires a proved object with
nonnull creation identity. Only an entirely green/carried run with empty failure
ledger, no hard stop and complete Cleanup/Postcleanup may publish the two built files plus
success-artifact manifest during Finalize. A failed Gate-42 snapshot transaction rolls back only
by exact identity. `snapshot:null` requires proved absence; a fully bound snapshot retains the
existing `{name,bytes,sha256}` shape; a present unbound or ambiguous fixed-name snapshot records
only `{name,status,removal_attempted:false}` with status
`present_unbound|present_ambiguous`. The residue discloses no bytes, digest, content, raw path or
identity detail, remains in the exact three-entry Evidence set, authorizes zero removal and forces
`evidence_preserved:false` plus `FAIL_CLOSED`. Prejournal rollback failures are surfaced rather
than swallowed and retain the exact root/receipt bindings required for terminal recovery; an
ambiguous closed outcome performs zero removal. The common transaction commits the receipt last
and rolls back staged artifacts/evidence/modes for each caught write/chmod failure; it makes no
crash-atomic claim. None of this prospective schema proves an execution.

No Attempt-13 run is authorized. The normative gate order for the superseding execution-binding
candidate is independent prepublication exact-delta/artifact review `APPROVED` with zero P0–P3,
exact publication, exactly one
local AVS R3 verification of the published execution-binding candidate, one new V4 exact-head CI,
final independent exact-head/artifact review `APPROVED`
with zero P0–P3, and a separate exact Human authorization for one Attempt-13 run. The local R3
verification is not an Attempt execution. No earlier verification or standing rule activates a
run automatically.
