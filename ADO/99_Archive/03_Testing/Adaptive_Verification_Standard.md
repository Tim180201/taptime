# AVS-001 – Adaptive Verification and CI Efficiency Standard

## DA5 run 459dd ADB-server Fast Recovery (`2026-08-22`) — CONSUMED / REPAIRED HOST PREREQUISITE / REVIEW STOP

Binding set `4dd436a970db0bd57be26a2c7fb0f4eb7133c88b3073e6ac3bd4216c7ddb70c0`
was invoked exactly once on published head/tree
`31736a6e388a190148204009a2a11b6f4b1df799` /
`5b569d4f6c679a4ff39fb71f5bd7f6b42ec69e17` in Codex foreground PTY session `75431`.
Before the terminal outcome there was no output or Human prompt/input. The Supervisor published
`CONTROLLER_RETURNED_INNER_RECEIPT_SEALED`, accepted exactly one `CLOSE`, and then returned exit
`1`; source and receipt truth make that exit the expected terminal settlement for this sealed
non-PASS outcome, not a retry signal. Authority is `CONSUMED_NONREUSABLE`.

The sealed inner outcome is `FAIL_CLOSED / CHILD_NONZERO_OR_EARLY_EXIT / cleanup MISMATCH`, with
the Android cleanup-attestation domain `mismatch`. That is an attestation result, not proof that
residue existed. The Product-Human field/button, install/mutation, Tag/NFC and Hardware path was
`NOT_REACHED`, and the Product finding is `NONE`. Cleanup-attestation product equality did observe
aggregates, invariants and tag roles as `MATCH`; queue equality remains `UNOBSERVED / UNPROVED`
because the Operator schema has no queue field.

After the run was closed, exact absolute `adb -H 127.0.0.1 -P 5037 devices -l` returned status
`1`, classified as `LOCAL_SERVER_UNREACHABLE`, with zero stdout bytes and 300 stderr bytes; raw
stderr is neither retained nor disclosed. Exact argv
`["/Users/timbartz/Library/Android/sdk/platform-tools/adb","start-server"]` then returned `0` and
mutated only local host ADB-daemon/transport availability. A later, separate sanitized read-only
preflight returned `MATCH` for device count, authorization, USB, model, build, Android release,
API, font, accessibility status/services, device listeners, Product package/process and reverse
mappings. This later result neither rewrites the run's cleanup `MISMATCH` nor proves its atomic
cleanup. Since `device-preflight` is statically the first Controller plan step, the post-close
finding identifies the focused recovery prerequisite; the original hidden child leaf remains
unsealed.

Immutable recovery Evidence root basename
`flight-459dd223-adb-server-recovery-r1-20260822` is `0555` with exactly two `0444` files: receipt
6,972 bytes / SHA-256
`3c8a3bba8276f71d08bdedc8c376610a1eb0e23a1a02674e361c98a8e101e3b2` and manifest 668 bytes /
SHA-256 `319d7cd5867c9f6fe7b0adc0492ff523134eaf025ebd1cad99e0dd2cc0d1c0c9`.
It separately inventories the immutable outer terminal root and inner Controller root, exact PTY
transcript, post-close diagnosis, host-only repair and later reattestation without credential,
e-mail, USB serial, raw fingerprint or raw tag UID values.

Every future DA5 pre-Hardware package must freshly establish local ADB-server reachability and a
sanitized full preinstall `OVERALL=MATCH` immediately before Evidence sealing and before fresh
Human authority or start; daemon persistence must never be assumed. It must then create a fresh
binding and pre-Hardware receipt. Current Fast-Lane scope is only this recovery Evidence plus AVS,
Runbook and Event Ledger. Verification is R0/V0: exact-three diff/index/ref/live-remote checks,
canonical Evidence/hash/mode/inventory checks, Closed-claim schema and identity checks, plus static
first-step and exit-after-`CLOSE` source proof. No build, test, Typecheck, V3, CI, new TTY,
Supervisor, install, Product, ADB or Hardware execution is part of this candidate. Independent
review is next; no current Human or Hardware authority exists.

## DA5 Codex-PTY session 46561 BINDING supersession (`2026-08-22`) — CONSUMED / R0-V0 CANDIDATE / REVIEW STOP

On published head/tree `867d61f8396a9fdee81e9f06681ff445d965a34c` /
`02af1914dfac7b4b70e46986bac4369ecd907136`, the exact command
`exec /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-visible-tty-launcher/867d61f8-ee2ff587-codex-pty-r1/launch-codex-pty`
ran once in Codex foreground PTY session `46561`. Initial one-second output was empty; the next
empty poll returned exit `1` and exactly `da5_v5_flight_start_failed stage=BINDING`. No Human
prompt, input, token or password occurred. Authority is consumed and non-reusable; retry and resume
remain forbidden. Immutable failure Evidence root basename
`flight-867d61f8-ee2ff587-s46561-binding-failed-20260822` is `0555`: receipt 3,852 bytes / `0444` /
SHA-256 `c922685efc7e474cb363cce8fb0992b70e6060b61f76723f4a3a9b0a2210ed5e`; manifest 754 bytes /
`0444` / SHA-256 `923138150831c71dfa1833ca871d4b5e0e56cb8cdd61f66b5209b4b62e93ec3b`.

Static source ordering proves the launcher's sixth binding value, a 62-character Toolchain value,
failed the lowercase-hex-64 predicate before `runDa5V5FlightSupervisor`. Supervisor and Product
execution were therefore not reached through this invocation; external Product, ADB, Hardware and
cleanup state remain unobserved. Sealed e10d receipt/manifest SHA-256
`9dfbdd3abcf794cebf5957124cd04fcee62bbf5a584f9ff04864a76d401a6c7d` /
`517be573c54c77c563143af7f2822e39de2a9e9aa131d9a3506a4ef9a0b4a50f` retain the historical
contradiction: `noncausal_rebinding_drift.launcher_toolchain_binding_sha256` is the old 64-character
`34425ef206527fc65c6b6f5bfe1b4ea9aaa48a32fba491441d5a5b52b40b45d4`, while both
`noncausal_rebinding_drift.canonical_operator_toolchain_binding_sha256` and
`future_rebinding_required.canonical_toolchain_binding_sha256` are the invalid 62-character
`34425ef206527fc65c6b5bfe1b4ea9aaa48a32fba491441d5a5b52b40b45d4`. Both old candidates are
superseded and neither is canonical.

The immutable `0555` Toolchain Evidence root basename `toolchain-host-identity-v1-20260822`
contains exactly payload 2,960 bytes / `0444` / SHA-256
`0609497e4cf36e408f441a8f5f9eb821e8f4aa2b54a46f1525f2ccbf5c7ce657` and manifest 661 bytes /
`0444` / SHA-256 `4d60c9317df44ff4abdf5287c78e097970f7263a343af218847bde0dd53c3a76`.
The exact future environment value is
`TAPTIME_DA5_V5_TOOLCHAIN_SHA256=0609497e4cf36e408f441a8f5f9eb821e8f4aa2b54a46f1525f2ccbf5c7ce657`,
defined as SHA-256 of the canonical self-hash-free payload. A future separately reviewed external
rebind must preserve Product/runtime executable bundle and map bytes, regenerate the Operator
manifest, bind this payload and manifest, and create a new binding-set ID. The consumed
Operator/launcher/binding are never reused.

Fast-Lane correction scope is this immutable Evidence root plus exactly AVS, Runbook and Event
Ledger; carried CI, APK and Guard are unchanged. Verification is V0 plus focused payload
canonicalization, full host-identity equality, lowercase-hex-64 positive, old-62 negative and
pre-Supervisor ordering checks. No build, test, V3, CI, positive TTY, ADB, Product or Hardware run
is allowed. Independent prepublication review is next; no current execution or Human/Hardware
authority exists.

## DA5 automatic password Fast-Recovery candidate (`2026-08-21`) — R3 round-2 corrected / round-3 review pending / Hardware STOP

Human-authorized scope is exactly two Supervisor/Controller sources, four directly affected tests
and the four compact ADO addenda on baseline `2885739d9679c7be16ea518c640636bd2f3b6753` /
`1e437b7ebfa80aaa353a8ebbe8aa2f9e074d98dd`. Risk is R3 because password generation, terminal
ownership and FD3 transfer are security boundaries. The active Fast Recovery Lane limits proof to
the four focused suites, tests-inclusive Synthetic Typecheck, one final Synthetic build, Child and
Flight Node syntax, exact bundle/map bindings, V0 integrity and one independent review.

Round 0's bounded development runs passed two files / 90 tests, then three files / 151 and 152,
and finally four files / 157; tests-inclusive Synthetic Typecheck passed twice. Formal round 1
returned `CHANGES REQUIRED`, P0/P1/P2/P3 `0/1/1/0`. Correction development first passed the
Controller file 33/33. The first Supervisor-only attempt observed 72 passes and one 30-second
test-harness timeout because the new input-order case did not yet drive `CLOSE`; after that
test-only correction the file passed 73/73. The first four-file PREBUILT attempt returned RC 1
only because one Profile static-source assertion still named the replaced close handler; after
updating that assertion, the final run passed four files / 162 tests. The correction tests prove a
write- or end-callback error followed after rejection/cleanup start by stream `error` and `close`
without uncaught error, resettlement, listener/timer residue, lost child termination, lost
attestation/seal or password residue. Stalled FD3 OS-signal/input-order/EOF/unknown aborts map to
`SIGNAL`/`NONCE_OR_ORDER_MISMATCH`/`IPC_EOF`/`SIGNAL`, and Supervisor tests deliver the exact
input-order/EOF reasons without outputting the password.

Formal round 2 returned `CHANGES REQUIRED`, P0/P1/P2/P3 `0/1/0/0`, because successful end
callback still resolved transfer and removed its error owner before terminal FD3 close. The final
allowed correction makes write and end success intermediate states, retains timeout/AbortSignal
through close, fails child-close-before-FD3-close and treats only an error-free terminal FD3 close
as success. Controller development passed 35/35 before and after adding an explicit fake-timer
residue assertion; the final PREBUILT run passed four files / 164 tests without an intermediate
failure. Deterministic tests prove normal `end-success -> close` exactly once and
`end-success -> late error -> close` as `CHILD_NONZERO_OR_EARLY_EXIT`, with no uncaught error,
false success/resettlement, residual listener/timer, password residue, lost child termination or
lost attestation/seal.

Each correction round had one tests-inclusive Synthetic Typecheck and separate `--listFilesOnly`
proof of all four focused tests. Exactly one build ran after source stabilization in each
correction round; correction 2 did not invoke a nested build. `node --check` passed separately for
Child and Flight. Current final exact outputs are:
Child JS 981,784 bytes /
`d2bd86d3a4229022014c5fc6d7ede1493b81feb50a9b72d4ad5f1a8b8b76e633`; Child map 1,912,587 /
`36b8e5a6aa4b78a80523980802fb050e88b8e9feae3272d12cb6135ccbaf57e8`; Flight JS 205,118 /
`6c1921eda081116af0c9c101262f08956282c80a950c0c485a181b3f67d3af49`; Flight map 527,127 /
`eeeac060997fbf0986864826586693d743eac3aeb3aaad2e0a384c07f30b740b`.
The exact final test environment was
`TAPTIME_DA5_V5_PREBUILT_BUNDLE_VERIFICATION=required`; argv was
`npm run test --workspace=@taptime/synthetic-android-e2e -- --run tests/Da5V5FlightSupervisor.test.ts tests/Da5V5FlightController.test.ts tests/Da5V5Profile.test.ts tests/Da5V5ProductStartBundle.test.ts`.
This test-only mode rejects every other value, requires Node `v24.17.0`, four present regular
bundle/map artifacts, their exact byte/hash assertions and current relevant source-map
`sourcesContent` hashes, then exercises the existing PTY bindings. With the variable absent the
test's default remains its original self-build. The built-bundle PTY advanced without password
input, observed zero hidden-password prompts, reached Controller classification, preserved one
`CLOSE` acknowledgement and found zero unknown 64-lowerhex output candidates.

No broad suite, standalone `Da5V5SecretInput`/`Da5V5CredentialTransfer` neighbor run, V3, CI,
PostgreSQL, APK reachability execution, ADB, install or Hardware ran: the focused suites directly
cover the removed Supervisor capture, retained Human/CLOSE ownership, generator and zeroization
faults, FD3 write/end/error/close/timeout/abort/late-callback races, static boundaries and real
built-bundle PTY progression. Final V0 integrity is bound outside this non-self-hashing document
in the Development handover; independent R3 round-3 review remains required before publication,
which still stops before every Human/Hardware gate.

## DA5 Fast Recovery e10d fulfillment (`2026-08-21`) — FAIL_CLOSED / ROUND 1 CHANGES REQUIRED / CORRECTION 1 / ROUND 2 PENDING / HARDWARE STOP

This append-only top block fulfills the active Fast Recovery Lane only for consumed run
`e10d22d0697b994c9e35bbbc2ae90efa` on baseline head/tree
`365d94c5b8bee0e63eba277f64008eda330ff8a3` /
`0a8786bfb52aeb3341543b1b8c7d2de6db8d2125`. Authority is consumed; terminal truth is
`FAIL_CLOSED / pre_product_non_product / cleanup MISMATCH / fast lane STOP`. Product equality
was not observed. The child Guard rejects before ready/bind/device-preflight because the launcher
passed implementation head/tree `365d94c5` / `0a8786bf`, while guard manifest SHA-256
`957d6e99c271663763945026995e7463cf2f20b385eb942fd16a152d3de5f709` requires
`ba1b6e922ceb7902ecedd9dc2df01d6b22d90867` /
`980b6c57fdd71c12820f2890b640946db0d883c6`. Therefore Child ready/bind and the Child plan
`device-preflight` step were unreachable. After Child failure the Controller necessarily invoked
cleanup attestation; its production Android preflight attempted at least read-only
`adb devices -l` enumeration and, depending on that result, may have attempted further read-only
preinstall/profile queries. Exact success, extent, output and result are unsealed and unobserved.
The Child reached no Product install/mutation, Tag or Human step; Hardware absence/state is not
claimed. No exact hidden leaf/error text is claimed.

Immutable external Evidence root basename
`flight-e10d22d0-fast-recovery-failure-20260821` is `0555` with exactly two `0444` files:
receipt 4,450 bytes / SHA-256
`9dfbdd3abcf794cebf5957124cd04fcee62bbf5a584f9ff04864a76d401a6c7d`; manifest 288 bytes /
SHA-256 `517be573c54c77c563143af7f2822e39de2a9e9aa131d9a3506a4ef9a0b4a50f`.
It binds outer terminal receipt/manifest SHA-256
`6e32b0e608f40066a2c936de712c1713948e43e3658905d39e7007e84a1d1149` /
`24250b5c7e9fc5d5c99bb51f88b47effa6c948c48b436dd2c8ef6d03fc5f3036` and inner
receipt/manifest/commitment SHA-256
`3423e6506e668d98c28f08e35d55a597391951a1ee8cffe345bad94df4f2d69e` /
`a506728af7409be64715a70b86a7ad983953db6a4f6fe1fd947ea5004941db37` /
`6350f90788038f163e3837191a1e570123a85a0193e82fbec98d2b7c1fd92ba9`.
The later 91,595-byte `ps` reproduction exceeded the former shared 65,536-byte cap and is strong
current-only proof, not exact historical proof; later-free ports 3000/54321/55435 and zero bound
roots/processes likewise do not prove atomic cleanup.

Formal review `/root/review_e10d_fast_recovery` returned `CHANGES REQUIRED` with
P0/P1/P2/P3 = `0/1/0/0` because the original receipt's `adb_reached=false` and equivalent
top-block wording conflated the unreachable Child checkpoint with cleanup attestation. The
original root remains byte-exact and is superseded only for that no-ADB assertion. New immutable
external root basename `flight-e10d22d0-fast-recovery-failure-20260821-correction1` is `0555`
with exactly two `0444` files: correction receipt 3,408 bytes / SHA-256
`b894827448b24e943ed17915f2a8055c60ffa413a4244a3110199a40b350212f`; manifest 299 bytes /
SHA-256 `b5e54a94c532897a8339e6ce7036493638ebeb4709a0466305db45c427e524df`.

The focused correction gives `ps` its own finite 4 MiB raw-chunk cap, retains 64 KiB per
`lsof`, never truncates, and attributes checker failure only to the owned process, task-root,
Android or listener domain. Controller cleanup is latched independently; child-cleanup,
attestation mismatch or attestation exception sets `cleanup=MISMATCH`, while
`failureReason ??= CLEANUP_OR_CHECKER_FAILURE` preserves an earlier primary reason. Receipt
schema, Flight plan and Product semantics are unchanged; no false cleanup `MATCH` or Product
`PASS` is introduced.

Fast-Lane verification ran only the two affected test files: 2/2 files and 26/26 tests passed in
both the initial and final correction cycles. The tests-inclusive Synthetic Typecheck passed in
both cycles and its config includes `src` plus `tests`. One intermediate build passed before
the final primary-reason return-path and raw-byte accounting adjustments; the required
final-candidate build then
passed, so two builds actually ran and no one-build claim is made. Final Node syntax checks passed
for Child and Flight bundles. Baseline Child JS/map were 981,727 / 1,905,775 bytes with SHA-256
`1809c1b52aaad0980b5b204197a58029567925f4f1f77c06aca4611d65bfbce8` /
`34aa20276ac9e4a74f8a7c4978389721294276bc39bf391d23031789ce920516`; final Child JS/map are
981,784 / 1,909,095 bytes with SHA-256
`d2bd86d3a4229022014c5fc6d7ede1493b81feb50a9b72d4ad5f1a8b8b76e633` /
`94b22f07fbc6195c4247a2d18b381c96f21913f80906df2e1525ec24fc514b3e`: not byte-identical,
because `da5V5Main.ts` imports the changed shared FlightController module, which imports the
changed CleanStateAttestation module. Final Flight JS/map are 203,990 / 533,550 bytes with
SHA-256 `f906611b93a7bee09b9c91bafd5765bd0f621025c89f99f58b5d6dbc6f456642` /
`54f252830d666fd3cf4579aabeda647139d7eca6465a9d97c04a9ca13fb4a61e`.
No ProductStartBundle test, broad suite, V3 or CI ran. Correction 1 changed only Evidence/ADO;
all four source/test blobs and the verification facts above remain exact, so the active Fast
Recovery Lane required and performed no test, Typecheck or build rerun. Correction 1 itself ran no
ADB, install or Hardware action; the consumed run's cleanup-attestation ADB scope is exactly the
limited unobserved truth above.

Round 1 is `CHANGES REQUIRED`; Correction 1 is `PENDING` independent Round-2 review. Any future artifact must use Guard
implementation env `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867` /
`980b6c57fdd71c12820f2890b640946db0d883c6`, canonical toolchain digest
`34425ef206527fc65c6b5bfe1b4ea9aaa48a32fba491441d5a5b52b40b45d4`, a new binding-set ID,
and a future published correction head/tree for closure/execution checkout. The current launcher
typo digest ending `c6b6f...` is noncausal but non-reusable. **STOP before fresh explicit
one-shot Human/Hardware authority.**

## DA5 Fast Recovery Lane (`2026-08-19`) — HUMAN-DIRECTED / ACTIVE UNTIL EXPLICIT REVOCATION

This top addendum expressly supersedes and cancels for this recovery candidate both every broader
DA5 recovery rerun and the still-outstanding **first full terminal-envelope V3 plus subsequent CI**
mandated below, for as long as the Human's explicit `OK – maximal schnelle Fast Recovery Lane`
direction remains active. No full technical V3 or CI precedes the next Human gate under this lane.
This changes verification routing only; it does not change Product behavior, prior Evidence truth,
the Human/Hardware boundary or the one-shot rule.
For this recovery candidate, the current `8900a827` authority also supersedes the older
`ADO/README.md` and `ADO/00_Core/Project_Status.md` pointers `187ba562` / `174d2e80`; those pointer
statements are non-operative here until a later synchronization.

Every failed attempt gets one compact disclosure-safe failure receipt plus manifest. If executable
bytes are unchanged, do not rerun tests: perform only required cleanup/current-state checks and
exact binding reattestation, carrying forward already valid unchanged-input Evidence. For changes
limited to runner, launcher or Evidence-control code, run syntax, the exact concern regressions and
validate-only. For Product-code changes, run only directly impacted tests, typecheck and build;
broader suites are required only when a shared boundary materially changed or the Human asks for
them. The exact V1/V2 Evidence recorded below carries for this candidate because all nine approved
Product source/test overlay blobs remain byte-identical; exact V0 rebinding must prove that equality.

Targeted runner verification, one focused independent review of the combined recovery delta and
Evidence, and exact rebinding route **directly** to a stop for one fresh, exact, single-run
Human/Product-Hardware authority; the cancelled full terminal-envelope V3/CI does not intervene.
Do not create a separate repeated documentation truth-sync cycle. Any started Human/Hardware run remains
fail-closed on failure, ambiguity or interruption, with no retry, resume or replacement unless the
Human separately authorizes a new run. This lane remains active until the Human explicitly revokes
or replaces it.

## DA5 terminal-envelope final technical V3 activation (`2026-08-19`) — ROUND 2 APPROVED / R0-V0 ADDENDUM / CONDITIONAL ONE-SHOT

This append-only addendum supersedes only the round-1 statements that the correction is still
awaiting V1/V2/review and that no final V3 is authorized in that correction step. It does not
rewrite the consumed Human run, its immutable external Evidence, the `FAIL_CLOSED /
POST_HIDDEN_INPUT_TERMINAL_OUTCOME_UNPROVEN` truth, Product finding `NONE`, fast-lane `STOP`, or
any existing Human/Hardware boundary.

Formal independent review `/root/review_precontroller_terminal_envelope_r3_round2` returned
`APPROVED` with zero open P0–P3 on baseline head
`8900a827be1edde2d7626c59b08ce48878934380`, tree
`012640bbe837cc35479abc78461faaf207041518`, and the exact 12-path pre-activation candidate: tree
`f692df082e4abb8812adc4d65c8c825c93063c84`; canonical full-index binary patch 185,418 bytes,
SHA-256 `db2560174b2b1781935bf01ee1247861e157bf326ae0a3bffe7a7eff436743ad`.
V1 passed the tests-inclusive typecheck with all five required test files present, seven focused/
neighbor files with 273 passing tests, and ten of ten consecutive PTY runs. V2 passed required-APK
Synthetic with 19 files, 523 passes, 19 expected skips and zero failures; Mobile passed 120 of 120
plus tests-inclusive typecheck membership; fresh build and Node checks passed. The reviewed Flight
bundle is 201,416 bytes, SHA-256
`c5b43839601073f706c0c34e394085a3fda1ad34c8462f5ac486769ff3be7d1f`; its map is 528,673
bytes, SHA-256 `61e7c2974d757f977fa7a2bbd9c5492cf54fc1707d00e847215bd3741cfd1039`.

The nine approved source/test overlay blobs are immutable for this activation:
`apps/synthetic-android-e2e/src/Da5V5SecretInput.ts`
`98b95a131ee90e9d01220fcc624e8280214d5279`,
`apps/synthetic-android-e2e/src/Da5V5FlightController.ts`
`c7740868aa1579ae3c9eaa8c509c63817c00141b`,
`apps/synthetic-android-e2e/src/da5V5FlightMain.ts`
`a4f62e504ab5133bf414908c0dfd2180951a209a`,
`apps/synthetic-android-e2e/src/Da5V5FlightSupervisor.ts`
`2521503edd0a78453d62a2be2496c6fb46e0b31f`,
`apps/synthetic-android-e2e/tests/Da5V5SecretInput.test.ts`
`76efd85f2ec1ea7e1f38c6923e0c5e5ab3d71793`,
`apps/synthetic-android-e2e/tests/Da5V5FlightSupervisor.test.ts`
`9fe55eb64835d0e636109e470da9efae1af09be6`,
`apps/synthetic-android-e2e/tests/Da5V5FlightController.test.ts`
`23fb1933c27ca024d187ea6bd4918204ab103096`,
`apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts`
`542e92ed2ab32d7f32e8b7ffd6d36c71751b9a77`, and
`apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts`
`1a78a44155e9ad3fe627e0fdfc5f2c724a163899`.

Exactly one fully fresh final technical V3 becomes active only after an independent semantic
review returns `APPROVED` for these exact three activation addenda and independently binds the
resulting combined 12-path tree and canonical full-index binary patch while proving all nine blob
IDs above unchanged. The addenda deliberately contain no circular self-hash; their final tree and
patch bindings are computed and handed to that reviewer externally. The Human's `Dann leg los!`,
the independently approved architecture, the round-2 `APPROVED` verdict and the standing
`AGENTS.md` rule supply the technical authority after those gates; no new Human prompt is required
for this V3.

V3 starts at D01 in a fresh normal complete detached baseline worktree with the exact externally
bound 12-blob overlay and fresh task, cache, log, Evidence and PostgreSQL roots. It executes the
established exact complete V3 sequence without reusing any prior result, path, process, dependency
or database state. Any nonzero result, signal, ambiguity, runner/Evidence/configuration fault or
other deviation consumes this sole V3 as `FAIL_CLOSED`; there is no retry, resume or replacement.
A green V3 proceeds only to independent execution/Evidence review, focused publication and one V4.
There is no pre-V3 commit, push or CI action. This documentation activation itself is R0/V0 only.
**STOP before ADB, installation, Product-Human, Hardware, Tag or Physical-V5 activity.**

## DA5 terminal-envelope R3 correction round 1 (`2026-08-19`) — CHANGES REQUIRED ADDENDUM / TECHNICAL CANDIDATE / HARDWARE STOP

This append-only addendum supersedes only conflicting technical details in the `2026-08-18`
post-hidden-input correction candidate. It does not change the consumed invocation or its immutable
external Evidence: terminal truth remains **`FAIL_CLOSED /
POST_HIDDEN_INPUT_TERMINAL_OUTCOME_UNPROVEN`**, Product finding `NONE`, fast lane `STOP`, and the
run-scoped credential remains permanently non-reusable. The Human's `Dann leg los!`, the approved
R3 architecture and the formal round-1 `CHANGES REQUIRED` verdict authorize correction of the three
confirmed P1 findings inside the same exact 12-path allowlist only. They authorize no invocation,
ADB, installation, Product-Human, Hardware, Tag, CI, publication, deployment or distribution.

The closed outer classification mapping now has exactly seven paths. In addition to the six
previously listed classes it contains
`PRE_CONTROLLER_TERMINAL_IO_FAILURE_NO_CHILD_PROVEN`, used only when owned terminal output fails
before the Controller boundary. Signal/EOF cancellation of a pending output operation retains its
original signal/input classification; after the Controller boundary every output failure remains
Controller-managed or affects only the non-authoritative terminal acknowledgement.

One stdout owner is installed before pending-envelope preparation and remains installed through
terminal-status publication and the `CLOSE` prompt. It owns persistent `error`/`close` events and
allows one bounded, abortable, settled-once flush at a time. Timeout, callback failure, stream
error/close, signal or stdin EOF cannot hang the process; timers and abort listeners are removed on
settlement, and raw input/output listeners are restored on close. The exact disclosure-safe
terminal-status write must complete successfully before the acknowledgement gate is armed.
`terminal_outcome_published` is explicit process-local proof of that flush and is required for
exit 0. A failed status write never offers `CLOSE` and cannot undo already committed Evidence.
Any raw-mode or flow restoration failure is latched and forbids exit 0 while cleanup remains
non-throwing and best effort.

The pending-envelope proof is no-follow and identity bound. Preparation captures the canonical
evidence parent and its `dev`/`ino`/`uid`/mode, binds the stage root before and after sealing, and
requires the renamed pending root to retain that node identity. Every payload is created with
exclusive no-follow open, fully written with positive progress, fsynced, sealed through its open
descriptor, and bound by `dev`/`ino`/`uid`/mode/link-count/byte-count/SHA-256. Reread uses
`lstat`, no-follow fd open and `fstat`, requires regular single-link files with unique inodes and
exact bytes/hash, and revalidates parent/root identities before and after inventory validation.
Dangling symlinks are occupied collisions. Immediately before the one selected-final rename, the
Supervisor synchronously revalidates parent, pending root, files and every final collision, then
reads the final latches and renames with no await or required/fallible Evidence operation after it.

Round-1 verification must materially exercise status-flush false success; async stdout
error/close during credential, Controller, status and acknowledgement phases; stalled writes
cancelled by signal/EOF and timeout; late callbacks; raw/listener/timer restoration; stage/pending
symlink or inode substitution; hardlinks; parent/root replacement; and dangling final symlinks.
The existing R3 V1/V2 route remains mandatory: tests-inclusive five-file membership, focused five
tests plus CredentialTransfer/AdbController neighbors, repeated PTY closure, whole Synthetic with
required APK reachability, unchanged Mobile neighbor/typecheck membership, and fresh build/Node/
map/bundle bindings. No final V3 is authorized in this correction round. **STOP before every Human,
Hardware, ADB, installation or Physical-V5 gate.**

## DA5 Product-Human post-input terminal-outcome closure and R3 Supervisor correction (`2026-08-18`) — FAIL_CLOSED / AUTHORITY CONSUMED / R3 CANDIDATE / HARDWARE STOP

This block supersedes only the prior visible-TTY block's prospective replacement state and every
conflicting claim about the second invocation. The published closure head is
`8900a827be1edde2d7626c59b08ce48878934380`, tree
`012640bbe837cc35479abc78461faaf207041518`, sole parent/executable
`c2151a833043801440d20127cbf096b418d8e324`, executable tree
`6d4ffdc0b74016632dfb59b2f6b10ca30d7bd9cf`. The exact second one-time authority was used once.
The Human observed the exact Supervisor prompt, submitted the hidden credential once and reported
that the same terminal then closed. No terminal result marker, exit status or Flight root was
retained. Therefore the only truthful classification is **`FAIL_CLOSED /
POST_HIDDEN_INPUT_TERMINAL_OUTCOME_UNPROVEN`**; Product finding `NONE`; fast lane `STOP`;
authority consumed. This does not identify the trigger and does not prove Controller construction,
Controller-run entry, child spawn, device preflight, immediate cleanup, device/package/profile/
queue state, or the presence or absence of Product/install mutation. The run-scoped credential is
permanently non-reusable, but is not classified as compromised.

Immutable disclosure-safe Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-8900a827-post-hidden-input-terminal-unproven-20260818`
is `0555` and contains exactly two `0444` files: `receipt.txt`, 3,300 bytes, SHA-256
`d1d1f8a390715e3db1e2c70df9a34bf2c3477ece66b027194af7efea9716d3f9`; and
`evidence-manifest.txt`, 822 bytes, SHA-256
`ae645f4516390de2da1fccaa0208b5a08cdb2646471f3d99ca97bcca889c2450`. It binds CI
`31812974037` attempt 1 / 12 of 12, APK SHA-256
`b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234`, Operator manifest
SHA-256 `9a7224fcf459095dc5cb69de08780ce797a113464762ddf5c3d5cdb4d0a90ec3`, consumed binding
set `1297fcc5c3ec2fffe60193fd0686f034ee3ded5206fa97ce5081ffde13aa2b8d`, launcher SHA-256
`f93e95ae8b678908412dbf94d39f33c07d167108be3cbf42685da9f8524b193f`, execution binding
SHA-256 `0f353d93020d8d9efdfa89d15f62caf07a61bed53d0c0ac6a6d837382ab48513`, launcher review
SHA-256 `f40424fece7f420b738c8a8f2e3882252f2e8480e09c0236be0ae503c252dd57` and external final
inventory SHA-256 `eaa620be061f1997ed6f0d114af73f0c852662b189137dde26ff67b5537e6f72`.
Its later-only audit observed no matching process, no owned listener on 3000/54321/55435, no
`/private/tmp/.t5-*` name and no new Flight stage/receipt/root. That later state never proves
immediate cleanup or any device/Product state.

The Human's subsequent `Dann leg los!` plus the independently `APPROVED` corrected architecture
candidate authorizes one focused **R3 technical correction**, not a run. Exact repository scope is
the three ADO paths in this publication plus `Da5V5SecretInput.ts`,
`Da5V5FlightController.ts`, `da5V5FlightMain.ts`, new `Da5V5FlightSupervisor.ts`, new focused
SecretInput/Supervisor tests and the existing FlightController/ProductStartBundle/Profile tests.
Package, lockfile, workflow, Mobile/Product code, database/schema, runtime guard, APK, ADB and
Hardware remain outside scope.

The corrected Flight entry keeps compiled `da5V5FlightMain` as the sole process start. One raw
Buffer stdin owner is attached before the outcome-neutral pending envelope is prepared and remains
the sole owner through the final nonsecret `CLOSE` acknowledgement. Stdin and stdout must both be
TTYs bound to the same character device; an existing readable/data/flowing consumer rejects the
start before raw mode. Its closed state order is
`DETACHED -> QUARANTINED -> FLIGHT_INPUT|HUMAN_INPUT -> QUARANTINED -> ACK -> CLOSED`.
The Flight credential path creates no secret JavaScript String; fixed mutable Buffers are wiped on
success, rejection, abort, signal, close, end and error. This guarantee is scoped only to the new
Flight credential/Supervisor TTY path. Legacy `readDa5V5HiddenCredential`,
`Da5V5InputOwnership` and the already documented transient child constructor String remain
unchanged and outside that guarantee.

Input gates open only after the exact prompt plus response hint reaches the stdout flush callback.
Any byte in quarantine, before a visible prompt, after one response, during a machine step or
between prompts is never retained for a future prompt and aborts the inner signal with
`NONCE_OR_ORDER_MISMATCH`; OS signals map to `SIGNAL`; EOF maps to `IPC_EOF`; unknown abort
reasons remain conservative `SIGNAL`. The Controller requires the precomputed validated run nonce
and one combined `humanInput.request(prompt, signal)` port, checks an already-aborted signal
immediately before spawn, and retains fresh nonce creation only for machine-step frames.

Before the first prompt, the Supervisor prepares and fully rereads one immutable, outcome-neutral
`NON_AUTHORITATIVE` pending root with a closed mapping to exactly six final classifications:
`PRE_CONTROLLER_INPUT_FAILURE_NO_CHILD_PROVEN`,
`PRE_CONTROLLER_SIGNAL_NO_CHILD_PROVEN`,
`PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN`,
`CONTROLLER_RETURNED_INNER_RECEIPT_SEALED`,
`CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED` and
`CONTROLLER_MANAGED_OR_UNPROVEN`. The same precomputed run identity binds the expected inner
Controller receipt root. A returned result reaches a sealed-return classification only when its
plan, run identity and exact receipt root match; identity drift is managed/unproved and any other
receipt path is inner-unsealed. The outer envelope contains no Product/cleanup claim and no dynamic inner
digest; only the Controller receipt can authorize those facts. After a drain barrier and final
signal/input-state check, one synchronous pending-to-selected-final rename is the only outer
classification commit. No required or fallible Evidence operation follows it. Rename failure
leaves final absent and pending nonauthoritative as `EVIDENCE_UNSEALED`; there is no retry.
Uncatchable process loss remains explicitly outside the proof.

After the commit, the zeroized-credential process prints only fixed disclosure-safe terminal JSON
and holds the same TTY for exact nonsecret `CLOSE`. Credential, `PASS`, commands, retry, resume or
start are not accepted at that gate. EOF or a new signal after commit may end the process but
cannot change committed Evidence. Raw/cooked mode, listener ownership and stream pause/flow state
are restored on close.

This R3 candidate requires V1 focused adversarial coverage, a tests-inclusive Synthetic
Typecheck with exact membership of all five changed test files, V2 whole Synthetic with
`TAPTIME_DA5_V5_PRODUCT_APK_REACHABILITY=required`, the unchanged Mobile Android-device neighbor,
fresh build/Node/map/bundle binding, one final V3 only after stable independent review, focused
publication, V4 exact-head CI, fresh runtime/operator and launcher artifacts and independent
reviews. The old CI/Operator/binding set/launcher/Supervisor are non-reusable. APK, Guard and
toolchain may carry only under exact equality; child and plan may carry only if the fresh build
proves byte equality. Any future launcher must persist a disclosure-safe
`final-inventory-manifest` that lists every other final file path/mode/byte count/SHA-256 and must
externally bind and independently review that manifest's digest. **STOP before every Human,
Hardware, ADB, installation or Physical-V5 gate for a new exact authority.**

## DA5 Product-Human visible-TTY routing closure and conditional replacement (`2026-08-18`) — FAIL_CLOSED / R0 REVIEW PENDING / NOT ACTIVE / STOP

The exact Product-Human/Hardware authority on head
`c2151a833043801440d20127cbf096b418d8e324`, tree
`6d4ffdc0b74016632dfb59b2f6b10ca30d7bd9cf`, CI `31812974037` attempt 1 / 12 of 12,
APK SHA-256 `b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234`
and Operator manifest SHA-256
`9a7224fcf459095dc5cb69de08780ce797a113464762ddf5c3d5cdb4d0a90ec3` was invoked
exactly once. The name-only environment preflight matched binding set
`ef9149d7a76aee1185cf01fe1c30f14c8cbef08a37ac639b0ae9c8f6f68236e8`, and the
Supervisor emitted the exact hidden-credential prompt. Codex UI then exposed an unrelated ordinary
zsh terminal; the Human entered a candidate there and received `zsh: command not found`. That
candidate is compromised and permanently non-reusable; neither its value nor a digest is retained.

The real Supervisor remained at its first input read. The Technical Lead sent SIGINT exactly once;
the Supervisor emitted only `da5_v5_flight_start_failed`, exited 1, emitted no
`da5_v5_flight_terminal` and created no Flight root. Exact source ordering awaits
`readDa5V5FlightCredential` before Controller construction and `controller.run()`; the child spawn
exists only inside `run()`. Therefore no Controller, child, ADB, installation, Product, NFC, Tag or
Hardware step occurred. Terminal truth is **`FAIL_CLOSED / PRE-CONTROLLER VISIBLE-TTY ROUTING
FAILURE`**, Product finding `NONE`, fast lane `STOP`; the authority and old binding set are consumed.

Immutable disclosure-safe Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-c2151a8-pre-controller-visible-tty-routing-failure-20260818`
is `0555`: `receipt.txt` is 3,989 bytes / `0444` / SHA-256
`cdb92889be81a710ed817fb0983faaf41e8e54e71503b0ea3b0530daf8755cec`; manifest is 1,309
bytes / `0444` / SHA-256
`90609a7b4f0c85d8d907063fb6f11aa9fb94f1915da3ed83ed7dcfa0abed1c59`. Its later
`2026-08-18T16:29:01Z` audit observed no DA5 Supervisor/child/Guard process, zero owned listeners,
zero `/private/tmp/.t5-*` names and no new Flight root. That is later current state only, never proof
of immediate complete cleanup, device/profile/package state, queue state or absence of transient
state.

Exactly one fully fresh replacement may become eligible only in this order: independent R0
semantic `APPROVED` of this exact three-document delta; one focused exact-three-document `[skip ci]`
publication; independent exact-head review; post-publication creation of a private immutable
visible-terminal launcher/execution-binding artifact bound to the final new Runbook/Ledger SHA-256
values and a new binding set; independent `APPROVED` review of that artifact; then **STOP** for a
fresh explicit Human authority. No replacement is active before that final authority. There is no
retry, resume or second replacement.

The replacement may carry unchanged only executable head/tree
`c2151a833043801440d20127cbf096b418d8e324` /
`6d4ffdc0b74016632dfb59b2f6b10ca30d7bd9cf`, the CI/APK/Operator bindings above, Supervisor
SHA-256 `eda3a6e407a07f6d923c62c3c7591a1bb79a2232e87a5b265ab77a7c419fe023`, child
SHA-256 `f480968a588e15bf974c172615edc0778fc4679088f6ccc86a5cdafecb5b00c1` and plan
SHA-256 `bd6d8f9614d9e86b46a0ca49cc431ce95130f99e35b4d1458238eb019bed08bf`.
The consumed binding-set ID above and old Runbook/Ledger file SHA-256 values
`3c5f3d89d9e519510647173490ac876f8d537f4f10a94aac383e64cdcdb1186b` /
`bfacfd30e2d40661c197ffe05eb413f8012672672ee5c23869df24f54cc60f2b` are non-reusable
because this amendment changes those files. Scope is R0/V0 and exactly these three ADO paths; no
Product test, Typecheck, build, V3, CI rerun, ADB or Hardware action follows.

## DA5 Compact-Login/Invitation R2 terminal PASS and publication gate (`2026-08-14`) — INDEPENDENT R3 APPROVED / R2 CONSUMED / HARDWARE STOP

The one-shot `DA5-CLIS-V3-R2` authority was activated on published head
`eb3c2d006934fe64031153834426864ffb9a5ce5`, tree
`9b024e5de558bf6be72348d9a88aa573bf37ab16`, parent
`caa4fb55c227de137d16ce4d7a39e67faafa38f0`. Immutable pre-D01 binding root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r2-pre-d01-binding-3de9b87baafb00cc6f29d44e93fdf14d`
is `0555`; its 7,490-byte receipt SHA-256 is
`c679dbfb767f5fa4bc88c1dd5699177578a8e1ddf293b3400a68b9c66e2e164a` and its 87-byte
manifest SHA-256 is `4dea8b66ce831f77df27422252670da460439d1f66c82118bfffb8064f7b3513`.
It binds the unchanged nine overlay blobs, resulting tree
`b61e3ec4ef2b84d36d1fb88f3c5bcc16e9042379`, and the 95,701-byte canonical full-index
patch SHA-256 `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`.
The authoritative frozen bundle is bound by manifest SHA-256
`db5c8a895eb7900271d35d0c68606c7e8c6f4399b8a43fd1f3a673c5173fccf2`, independent review
receipt SHA-256 `511095747c30ef9af20b7cff7048dc1ccdeab125983358271a067927626a72e3`
and review-subject SHA-256 `6f8fda9686c5fa8f8275037c4c52f7c72b67f3b75acdb9b49b9ccfc115d55e3f`.

The receipt-bound terminal supervisor ran exactly once. Supervisor, orchestrator and final-root
validator each terminated with `exit`/`0`, and the prebound final terminal envelope committed
`PASS`. Immutable inner root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r1-20260814T094123Z-3de9b87baafb00cc6f29d44e93fdf14d`
is `0555` and contains 883 manifested payloads plus its manifest = 884 regular files and 217
command sets / 868 command records. Its 2,524-byte receipt SHA-256 is
`b6124d02eecf961ad0cae1b883e2169476d955551c4a02ca932401f93a0224e5`; its 102,706-byte
manifest SHA-256 is `d63ebdef1f03c5c715ea3d87bc0c16a187b067114aada333610290a4923920e0`.
The literal `v3r1` inner path is the reviewed R2 recipe value and does not restore R1 authority.

Authoritative terminal root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r2-terminal-20260814T094123Z-3de9b87baafb00cc6f29d44e93fdf14d`
is `0555` and contains two manifested payloads plus its manifest = three regular files. Its
839-byte terminal receipt SHA-256 is
`ca48e2a7935e42906d09fd38694ab11ceebb67d5015df7f1a711fdd96adb4fc3`; its 192-byte manifest
SHA-256 is `a96119329668328e0a2a4d2f9a0f76d0f3499f46744a3fa013a06882e2c718d9`.
D01/D02, PostgreSQL 17 with eleven databases and 27 migrations, 20 builds, all 21
tests-inclusive-Typecheck memberships/commands, and all 21 suites passed. The suites covered 156
files, 3,071 passed tests, exactly three expected skips and zero failures. Artifact, C3B,
no-install, Node/JavaScript/map, Expo, final V0, inventory/sealing and cleanup gates all passed;
Product finding is `NONE`. No ADB, installation, Product-Human or Hardware action ran.

Independent R3 execution/Evidence review `/root/review_clis_v3r2_execution` returned `APPROVED`
with zero open P0–P3 findings. R2 is consumed `PASS`; there is no rerun. This top block supersedes
only the prospective R2 authority/current-state wording below and preserves all R1 history.
Next is exactly: independent R0/V0 review of these three ADO additions within the final 12-path
candidate → one intentional commit/push of the unchanged nine code/test blobs plus these three ADO
blobs → one exact-head CI/V4 → fresh runtime/Operator artifact generation and independent review
→ **STOP** for fresh explicit Human/Hardware authority. No local V3 rerun occurs because only
documentation was added after the independently reviewed, byte-unchanged nine blobs.

## DA5 Compact-Login/Invitation R1 correction and conditional R2 authority (`2026-08-14`) — REVIEW PENDING / NOT ACTIVE

Formal independent execution review returned `CHANGES REQUIRED` for `DA5-CLIS-V3-R1`. Its
terminal truth is **`FAIL_CLOSED / EVIDENCE INVALID / RUNNER-VALIDATOR DEVIATION`**, never
`PASS`: the outer D01 digest matcher exited `125` at the first decision-path deviation, and the
first pre-seal inventory validator exited `91` at the second. Technical gates observed after the
first deviation are diagnostic history only and are not reusable execution Evidence. Product
finding is `NONE`; cleanup is `PASS`; no ADB, installation, Product-Human or Hardware action ran.

The immutable historical root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r1-20260814T082337Z-2a40cfb8fa0d45e9b4de8362177a368b`
remains byte-unchanged with 787 payloads plus `evidence-manifest.txt` and 196 command sets.
`receipt.txt` is 4,511 bytes / `0444` / SHA-256
`05c6d91cd34e7c325e1378e7649b2a50d81f1ba4b92c9bc394e3527f955efc16`; the manifest is
91,302 bytes / `0444` / SHA-256
`c9ca075e0ebbf4d3cd81ea07a20224c8370613796e655f9610dbac2cda6af02c`. Its recorded `PASS`
classification is superseded; sealing does not make deviating execution valid. The following R1
authority block remains history and grants no run.

At this amendment baseline, `HEAD == main == origin/main ==
caa4fb55c227de137d16ce4d7a39e67faafa38f0`, tree
`28546aeab6c54f367f1f7ac312bc3a23b57eee1f`. The byte-identical nine-path executable/test
overlay produces tree `ea785f3f2b0eb23ee8c031a325ba5cac79da78c7`; its canonical full-index
patch remains 95,701 bytes / SHA-256
`948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`. These are
prepublication preparation facts, not substitutes for the future exact-head receipt.

This AVS block is the sole prospective authority for exactly one new, complete and fully fresh
`DA5-CLIS-V3-R2`. It remains inactive until, in order: independent `APPROVED` of this exact
three-document R0/V0 amendment; one focused three-document `[skip ci]` publication; independent
`APPROVED` of an immutable frozen runner bundle; and independent exact-head review issuing an
immutable receipt. That receipt must bind the published ADO head and tree, each of the three ADO
blob IDs, each unchanged overlay blob ID, the resulting combined tree, the canonical nine-path
patch bytes/SHA above, and every runner-bundle path, byte count, mode and SHA-256 together with
its manifest, validator/self-test receipts, terminal-supervisor/fault-test receipt and independent
review receipt. It also prebinds the run ID, canonical final inner-Evidence root and absent
canonical same-filesystem terminal-envelope stage, nonauthoritative pending and final paths; all
three must initially be absent. Missing, ambiguous or drifting binding is `STOP`; no value is
inferred.

R2 starts at D01 in fresh roots and may reuse no R1 gate, result, process, database, file, root or
observation; it is neither retry nor resume. Correction Round 1 found that the sealed inner root
cannot non-circularly record either its post-rename validator result or the orchestrator's eventual
terminal state. Therefore only receipt-bound absolute Node may invoke frozen
`terminal-supervisor.mjs` as the sole entrypoint. The supervisor directly spawns and awaits the
receipt-bound orchestrator with `shell: false`, requires terminal kind `exit`/code `0`, and then
separately directly spawns and awaits the receipt-bound validator against the immutable final
inner root with the same terminal requirement. The inner receipt is always
`TECHNICAL_GATES_COMPLETE_PENDING_TERMINAL_ENVELOPE`, never `PASS`.

The supervisor alone prepares a separate sealed terminal envelope after verifying the run ID,
canonical final-root path, exact manifest bytes/mode/SHA-256 and complete root/directory/file
mode/path inventory. It seals and validates stage, atomically renames stage to the prebound
nonauthoritative pending path while final remains absent, then fully rereads and validates pending
including its receipt and exact path/byte/mode/SHA inventory. Only after that success may it
atomically rename pending to the prebound final path. This second rename is the single terminal
authority, commit point and final operation affecting authority or Evidence; reviewed
same-filesystem rename semantics plus the prevalidated pending bytes make final authoritative on
successful rename. No required reread, fallible validation, cleanup or classification operation
follows it, and the supervisor's later process return is informational rather than a second
authority.

Stage and pending are explicitly nonauthoritative even if a complete `PASS` receipt is visible;
consumers accept only the exact prebound final path together with its referenced exact inner root.
Every fault before the second rename is `FAIL_CLOSED` and must leave final absent. Successful
commit leaves stage/pending absent and final present. This finite outer commit replaces any
self-recording requirement without permitting an external/ad-hoc wrapper. The Runbook top
addendum is the sole operative R2 recipe and leaves the existing exact run matrix otherwise
unchanged. Green R2 proceeds only to independent R3 execution/Evidence review and then **STOPS
before Supervisor, ADB, installation, Product-Human and Hardware**.

## DA5 Compact-Login/Invitation replacement V3 authority (`2026-08-14`) — REVIEW PENDING / NOT ACTIVE

The first final V3 for the unchanged nine-path Compact-Login/Invitation candidate tree
`534b1bfed4696833d2e6994af7e2eb2590b37388` and canonical full-index patch 95,701 bytes /
SHA-256 `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0` is consumed
`FAIL_CLOSED`. D01 and D02 passed exactly once; PostgreSQL 17.10 started and all eleven databases
were created, but the first migration stopped before migration 001 with SQLSTATE `42501`
(`permission denied to create role`). The runner had created separate installer LOGIN roles
without the required CI-equivalent superuser/role-creation semantics. This is a runner-bootstrap
failure, not a code or Product finding. Zero of 27 migrations and no build, Typecheck, suite,
additional gate, ADB, installation, Product-Human or Hardware action followed. Cleanup passed.

Immutable Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-534b1bfe-20260814T063909Z`
is `0555`, with 102 manifested payloads plus `evidence-manifest.txt` = 103 regular files. Receipt:
2,355 bytes / `0444` / SHA-256
`ed7d7972d385cbb2262df90e19ae490884c3a7a1a9c934f2bc600a943d29c96c`; manifest: 11,651
bytes / `0444` / SHA-256
`30cfdb6747dc0814cf3db1e487b1a578df8726578e56d8d7302d125ed7d8a68c`. Initial preflight
stdout was retained, but the four individual port return codes were not immutably bound; that
preflight Evidence remains incomplete. Post-cleanup Evidence fully binds separate successful
checks for ports 3000, 54321, 55435 and 55436, stopped PostgreSQL and absent worktree/task root.

Independent Review Round 1 inspected the combined 12-path input tree
`468ae43e2bf18914bef9a08c6b65c8ff7b9ff932` and its canonical full-index patch 109,107 bytes /
SHA-256 `aafe63a4bc156c5204820d9784cd7cba9e483e2353e7bde88b9cc76016c0f509`, and returned
`CHANGES REQUIRED` for non-deterministic runner detail and self-referential activation binding.
Those values remain Round-1 review input only; this three-document correction necessarily changes
them and must never be substituted for the final Pre-D01 target.

Only the byte-identical V2 result and pre-V3 independent R3 `APPROVED` with zero open P0–P3 may
be carried. No failed-V3 gate, result, process, database, task root, file or observation may count
as replacement-run execution or be reused. Only after independent `APPROVED` of this exact
three-document R0/V0 amendment, one focused documentation-only `[skip ci]` publication and
independent exact-head review may exactly one **new, fully fresh** replacement V3
(`DA5-CLIS-V3-R1`) start. That exact-head review must issue an immutable receipt binding the
published ADO commit/tree, each of the exact three published ADO blob IDs, each of the unchanged
nine executable/test overlay blob IDs, the resulting final combined candidate tree, and the
canonical nine-path overlay patch byte count and SHA-256 relative to the published ADO head.
Those externally exact-reviewed values—not the Round-1 input and not an in-document placeholder—
are the sole Pre-D01 target. A missing/ambiguous receipt or value is `STOP`; no hash is inferred or
invented. The run is expressly not a retry or resume and starts again at D01 in a fresh normal
detached worktree and task root. The Runbook top addendum is the sole operative database,
environment, command, port-Evidence and cleanup contract.

There is no separate candidate/run-plan input: suite fixtures, Expo values, final artifact gates
and final V0 are fixed only by that Runbook and the mandatory exact-head receipt. Replacement-run
Evidence is valid only as the fully reread, sealed final root below the Runbook-bound external
Evidence parent; deleting the disposable task root cannot delete it, and any staging,
inventory, manifest, permission, atomic-publication or reread failure makes the Evidence invalid
and can never yield `PASS`.

Any deviation, interruption, ambiguity or failed gate consumes `DA5-CLIS-V3-R1` fail-closed;
there is no retry, resume or further replacement. Green routes only to independent R3 execution/
Evidence review. **STOP** before ADB, installation, Product-Human and Hardware; those gates still
require fresh explicit Human authority.

## DA5 V3-D fulfillment and publication gate (`2026-08-14`)

V3-D ran exactly once on candidate tree `d8a7c272a41738e95b9bb5b6043312443bdfd7e5` and passed
the complete local R3 regression. Event-Ledger claim
`d1b1d67ef28081e25900e6b1367e3585a7846547960af47969b68c5aca341a5b` binds the immutable
Evidence; independent R3 review returned `APPROVED` with zero open P0–P3. V3-D authority is
consumed `PASS`; the prospective instructions below are historical and grant no further run.

Authorized next is only independent R0/V0 review of this focused three-ADO-file truth sync, then
one intentional commit/push of the exact 18-path candidate after Technical-Lead approval and
remote-state verification, followed by one exact-head CI/V4 and fresh runtime/artifact generation
and independent review. No local V3 rerun follows because these three documentation blobs change
no executable, test, package, dependency, workflow or artifact input and the other 15 candidate
blobs remain exact. **STOP** before ADB, installation, Product-Human and Hardware; fresh explicit
Human authority remains mandatory.

Historical consumed rule: only after independent ADO review returned `APPROVED` for the exact
three-document correction could
exactly one **new, fully fresh V3-D** start. It reruns the complete established sequence from D01;
no V3-A/B/C result, process, database, task root, file or observation is reused, resumed or called
a retry. The successful immutable runner record
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-9380758-corrected-4r21J4/runner-record.txt`
(2,839 bytes / `0444` / SHA-256
`5b23c0308ff5ca3cde791538b60a2092dafcf2b52878bf416ea6511339907921`) supplies command order
only, never prior results. The Runbook is the sole operative execution/environment contract.

The consumed V3-D used direct sequential process invocations in a full normal tracked detached worktree; sparse
checkout, monolithic/ad-hoc runners and inherited/global phase environments are forbidden. Raw
D01 and D02 npm debug logs and exact `/usr/sbin/lsof` port Evidence are hard gates. Any mismatch
or failure consumes V3-D; there is no retry or replacement. Green routes only to independent R3
review and stops before ADB, installation, Product-Human and Hardware. V3-D is a local technical
verification attempt, not a Human fast-flight event; the maximum three runs/24 hours applies only
to separately Human-authorized Product-Hardware flight events.

## DA5 fast-flight addendum (`2026-08-13`)

The exact-head approved DA5 fast-flight authorization at
`9032581b1cb13b4a44f575aaface8a87989f4932` activates one R3 implementation cycle with focused
V1, one affected-boundary V2 and exactly one final complete V3. Routine qualifying aborts do not
rerun Product verification: they require a sealed external receipt and every closed fast-lane
predicate to match. Campaign limits (at most three separately authorized runs in 24 hours) are
governance/Event-Ledger rules; executable code never starts another run. Any Product/security/
tenant failure or ambiguity, binding drift, cleanup/checker/seal risk, missing observation or
non-disposable mutation is `STOP`. V4, exact runtime/artifact review and every Human/Hardware gate
remain separately required.

### Current DA5 verification and one-new-run rule (`2026-08-14`)

Candidate tree `b775c248bb268e91b141c62361b47614f38934a5` / 212,896-byte full patch SHA-256
`155bb35851508e30bed6c3b2908c8b410845ddd6fabc3bd795016bd0ed744cc1` has fresh V2 PASS:
Synthetic 16 files / 384 passed / 19 expected DB skips, Mobile 1 file / 120 passed, both
tests-inclusive typechecks (579/870 listed files), fresh Synthetic build and exact child/flight
bundle checks. This R0 amendment carries those results and reruns no Product test.

V3-A is consumed `FAIL_CLOSED`. It passed D01/D02, 11 DB, 27 migrations, 20 builds, all 21
memberships/typechecks/suites (155 files; 3,040 passed, zero failed, three expected skips) and C3B,
then stopped at the read-only no-install preflight because the runner omitted
`TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5`. The Mobile package script calls
`da5V5AndroidNoInstallPreflight.mjs`, which reads that environment variable; the artifact helper
rejects every value except exact `da5-v5`. This is no code/Product finding. No ADB/install/Product/
Hardware action occurred and cleanup passed.

After independent ADO review `APPROVED`, one new fresh V3-B—and no retry/resume—is authorized on
the resulting exact amendment tree/patch. It repeats the complete established V3 from D01 using
absolute Node 24/npm CLI where npm is required; no V3-A result counts as V3-B execution. From exact
candidate-checkout CWD `/Users/timbartz/Dokumente/GitHub/taptime` and the unchanged minimal
sanitized V3 environment, the established gate directly runs the helper exactly once:
`/usr/bin/env TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5 /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`.
The helper is the direct child of D01-bound absolute Node `24.17.0`, not npm. Gate evidence retains
exact CWD/argv, environment-name proof, raw stdout/stderr and return code; conflicting profile,
DB-credential and secret variables remain excluded. No package lifecycle, bare
`node`/`npm`/`npx`, ADB or installation is allowed. Failure consumes V3-B without retry; green
V3-B proceeds to independent review, and no Hardware gate opens.

Status: Active — Human Architect Accepted; Manual Operating Rules Effective; CI Automation Pending
Document ID: AVS-001
Version: 1.0
Date: 2026-07-20
Owner: Technical Lead
Approval Authority: Human Architect
Related Standards: EOM-001, DTP-001, OAP-001, RHS-001

## Purpose

AVS-001 defines how TapTim.e preserves professional verification quality while avoiding repeated
execution of unrelated tests, builds and CI jobs.

The standard replaces the informal practice of repeating the complete repository matrix after
nearly every intermediate action with an evidence-based, risk-adaptive verification model.

It does not lower the Definition of Done. It changes when and why each verification layer runs.

## Human Decision

The Human Architect accepted the following operating decision on 2026-07-20:

> TapTim.e shall use focused verification during implementation, complete affected-boundary
> verification before Technical-Lead acceptance, one complete candidate regression before
> independent review, and a complete exact-head CI gate for product/release candidates. Existing
> security, independent-review, artifact and Human physical gates remain intact.

## Current Repository Truth

At adoption time, `.github/workflows/ci.yml` starts the complete ten-job matrix for every push and
pull request targeting `main`:

1. Core, Mobile, Admin Web and neutral-contract quality;
2. B1 PostgreSQL spike;
3. B3 schema security;
4. B4 identity and Membership security;
5. B5 tenant-safe read model;
6. B6 server-canonical lifecycle;
7. C2/C3C/C3E1/C3E2/offline API and Mobile transport;
8. C3B secure Organization bootstrap;
9. C3C/C3E1/C3E2 administration security; and
10. synthetic server-connected Android E2E harness.

The workflow already cancels an older in-progress run when a newer run for the same reference
starts. It does not yet contain a reviewed change-impact classifier or documentation-only path.

Therefore:

- the manual verification rules in this standard take effect immediately;
- fewer intermediate pushes and fewer redundant local full-suite runs may be used immediately;
- automatic CI job selection requires a separate authorized implementation task;
- this document does not claim that the current GitHub Actions behavior has changed; and
- until that implementation is independently approved, every push to `main` still consumes the
  current complete CI matrix.

## Scope

AVS-001 applies to:

- implementation work;
- bug and security corrections;
- refactoring;
- tests and test infrastructure;
- database schema and migration work;
- build, packaging and artifact work;
- ADO and other documentation-only work;
- Technical-Lead verification;
- independent-review preparation;
- exact-head CI;
- physical-gate preparation; and
- future deployment and release verification.

It applies to Humans and Agents performing Technical Lead, Development, Review and Implementation
Support responsibilities.

## Non-Goals

AVS-001 does not:

- authorize implementation, production, production data, deployment or distribution;
- relax an existing authorization package or gate;
- make a focused test equivalent to a complete regression;
- allow a green source-only typecheck to be described as tests-inclusive;
- allow a failed test to be ignored because it appears unrelated or expensive;
- allow skipped jobs to be reported as executed;
- replace independent review;
- replace Human physical validation where required;
- permit evidence from one commit, tree, artifact or environment to be silently attributed to
  another; or
- optimize CI by weakening tenant isolation, authentication, durability, migration or artifact
  checks.

## Normative Language

`MUST`, `MUST NOT`, `SHALL`, `SHALL NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT` and `MAY` are used
normatively.

Where AVS-001 conflicts with a concrete Human authorization, accepted ADR, security boundary,
release gate or Physical-Gate runbook, the stricter requirement applies.

## Core Principles

### 1. Verify the Changed Risk

Verification SHALL follow the changed behavior, its transitive dependencies and its failure
impact, not merely the directory containing the edited file.

### 2. Fast Feedback First

During implementation, the smallest regression-effective test set SHALL run first. This shortens
the feedback loop without converting focused evidence into final evidence.

### 3. Full Confidence at Decision Points

Complete regression and exact-head CI SHALL be concentrated at the points where a candidate is
accepted, independently reviewed, physically tested, deployed or released.

### 4. Evidence Is Bound

Every verification claim SHALL identify the source state, command or job, result and relevant
environment. Artifact claims SHALL additionally identify artifact size, digest and required
identity/signature metadata.

### 5. Uncertainty Expands the Test Set

If impact cannot be determined confidently, the verifier SHALL select the broader boundary or the
complete matrix. Cost or elapsed time is not a reason to guess.

### 6. Quality Is Not a Run Count

Repeated execution of unchanged tests against unchanged inputs does not create new product
confidence. New evidence is required when code, configuration, dependencies, environment,
artifact or risk changes.

## Change-Impact Record

Before selecting verification, the responsible Agent SHALL create a concise Change-Impact Record
in the task notes, implementation evidence or final handover.

The record contains:

- exact baseline commit and tree when available;
- changed files and intended behavior;
- affected workspaces and transitive consumers;
- affected security, data and runtime boundaries;
- risk class;
- selected verification levels;
- checks intentionally not run and the evidence-based reason;
- evidence carried forward, including its exact binding; and
- any uncertainty that forced broader verification.

The record may be concise for a small task. It may not be omitted.

## Risk Classes

### R0 — Non-Executable Documentation

All changed files are human-readable documentation and do not affect:

- source code;
- schemas or migrations;
- dependencies or lockfiles;
- compiler, bundler, native or release configuration;
- CI workflows or verification scripts;
- generated runtime inputs;
- security policy enforcement; or
- an artifact used for installation, deployment or release.

R0 classification requires an exact diff proving those conditions.

### R1 — Isolated Low-Risk Implementation

The change is contained within one well-understood component or workspace, has no privileged or
durable-data effect and has an explicit regression test.

Examples include a pure presenter correction or a local non-security UI rendering change.

### R2 — Boundary or Cross-Component Change

The change affects a public contract, shared package, API parser, Mobile/Web coordination,
repository adapter, build boundary or multiple workspaces.

### R3 — Security, Durability or Release-Critical Change

R3 includes any change involving:

- authentication, authorization, Membership or identity binding;
- Organization isolation, RLS or least-privilege roles;
- NFC capture ownership, concurrency, session generation or tag reassignment;
- offline persistence, queue ordering, idempotency, retry or reconciliation;
- encryption, SecureStore, SQLCipher, backup or transfer boundaries;
- schema migrations, transaction isolation or canonical lifecycle decisions;
- secrets, runtime configuration, CORS or disclosure boundaries;
- build, signing, packaging, artifact verification or installer behavior;
- CI selection logic, test runners or verification tools; or
- production, deployment, rollback, backup or recovery.

R3 SHALL fail closed and receives the broadest relevant verification.

## Verification Levels

### V0 — Integrity and Scope Check

Purpose: prove what changed and that the repository remains structurally valid.

Minimum:

- exact tracked diff and scope review;
- clean whitespace/error check;
- reference/link or formatting validation where available;
- no unsupported status, approval, CI or closure claim; and
- tracked working-tree preservation.

V0 is required for every task.

### V1 — Focused Feedback

Purpose: catch defects quickly while work is in progress.

Minimum:

- directly changed tests;
- a regression test that fails against the previous defect where applicable;
- nearest contract/parser/behavior tests; and
- a focused typecheck or static check for the changed source.

V1 MAY run repeatedly during implementation.

V1 alone is never final Technical-Lead evidence for R2 or R3.

### V2 — Affected-Boundary Verification

Purpose: prove the complete impacted dependency boundary before technical acceptance.

Minimum:

- complete tests for every affected workspace;
- tests-inclusive typechecks for changed test sources;
- relevant builds, bundles or declarations;
- direct database/migration verification if a persistence boundary is affected;
- direct adversarial or failure-path checks for changed security behavior; and
- unchanged-boundary confirmation for explicitly protected neighboring components.

V2 is required before Technical-Lead `APPROVED` for executable changes.

### V3 — Complete Candidate Regression

Purpose: establish one complete local candidate baseline before independent review or another
high-consequence gate.

Minimum:

- all locally executable repository suites;
- all applicable tests-inclusive typechecks;
- all applicable builds and bundles;
- migration-ledger verification against clean PostgreSQL where relevant;
- native release or artifact verification where relevant;
- exact test counts and disclosed skips; and
- final diff/scope inspection.

V3 is required:

- once for the final implementation candidate before its independent review;
- after any R3 correction;
- after dependency, lockfile, toolchain, root configuration or CI-verifier changes;
- when accumulated changes cross multiple architectural boundaries;
- when affected scope is uncertain;
- when V1 or V2 exposes an unexplained failure; and
- before a release or Physical-Gate candidate is published if the governing package requires it.

V3 SHOULD NOT be repeated after an unchanged documentation-only synchronization unless a stricter
existing gate explicitly requires it.

### V4 — Complete Exact-Head CI

Purpose: prove the published candidate on an independent clean runner.

The complete required GitHub Actions matrix SHALL pass on the exact commit selected as the
product, correction, artifact, deployment or release candidate.

V4 is required:

- for every final product implementation candidate;
- for every published security or R3 correction;
- before independent review where the review package requires exact-head CI;
- before a Human Physical Gate;
- before deployment or release; and
- whenever an explicit authorization package requires complete exact-head CI.

Intermediate implementation checkpoints SHOULD NOT be pushed only to obtain additional complete
CI runs when V1/V2 can provide equivalent development feedback.

### V5 — Human, Physical and Operational Validation

Purpose: verify behavior that automated source and CI evidence cannot establish.

V5 includes:

- real-device NFC;
- airplane-mode and process-restart behavior;
- Human-visible disclosure and interaction checks;
- exact APK/artifact binding;
- deployment rehearsal;
- backup/restore and recovery exercises; and
- production-readiness gates.

V5 requires separate Human authorization when the governing artifact says so. No observation from
an aborted or failed fresh gate may be reused unless the governing authorization explicitly
allows it.

## Required Verification by Risk

| Risk | During implementation | Before Technical-Lead approval | Before independent review/publication | Before Physical/Release gate |
|---|---|---|---|---|
| R0 | V0 | V0 | V0 plus any explicit document-review check | Stricter existing gate wins |
| R1 | V1 | V0 + V2 | One V3 candidate run, unless the accepted task explicitly narrows it | V4 and V5 if applicable |
| R2 | V1 | V0 + V2 | V3 + V4 on the selected candidate | V4 exact binding + applicable V5 |
| R3 | V1 plus adversarial checks | V0 + V2 | V3 + V4; independent review mandatory | Fresh V4 binding + separately authorized V5 |

## Documentation-Only and ADO-Only Changes

A documentation-only change MAY omit product test suites only when the Change-Impact Record proves
R0.

Required evidence:

- exact changed-file list;
- proof that no executable, schema, dependency, configuration, workflow, script or artifact input
  changed;
- V0 integrity checks;
- truthful references to existing test/CI evidence; and
- no new product correctness claim derived solely from documentation.

An ADO-only synchronization MAY carry forward a complete product CI result when:

- the exact product commit/tree remains named;
- the synchronization delta is R0;
- no generated artifact or runtime value changes;
- the carried evidence is identified as carried, not freshly executed; and
- no accepted authorization package explicitly requires a second complete exact-head run on the
  ADO head.

This rule is prospective. It does not retroactively weaken Development Assignment 1 or any other
existing exact-head binding.

## Test-Inclusive Typecheck Rule

A typecheck SHALL be described as tests-inclusive only when objective evidence proves that the
executed configuration includes the relevant test files.

Vitest or another transpile-and-run test result is not, by itself, a TypeScript typecheck.

If the standard workspace configuration excludes tests, the task SHALL run a supplementary
tests-inclusive configuration or report the gap. A source-only typecheck may still be reported,
but only by its accurate name.

## Complete Regression Cadence

During active development:

- V1 runs as needed;
- V2 runs once the affected implementation boundary is coherent;
- V3 runs once on the final review candidate rather than after every intermediate edit;
- V4 runs once on the final published candidate rather than on disposable checkpoints; and
- after CI automation exists, one scheduled complete matrix SHOULD run at least weekly during
  active repository development to detect dependency/environment drift.

No scheduled run is required during a period with no repository or dependency change unless a
release, compliance or operational rule requires it.

## Push and Publication Discipline

Agents SHALL avoid pushing transient or known-incomplete candidates to `main`.

The preferred sequence is:

1. implement locally with V1;
2. complete the affected boundary with V2;
3. run one V3 candidate regression;
4. obtain Technical-Lead approval;
5. publish the focused candidate once;
6. obtain one V4 exact-head result;
7. prepare the independent-review prompt; and
8. synchronize review/closure documentation without repeating product verification unless a
   stricter gate requires it.

Fewer pushes MUST NOT be achieved by creating an oversized, mixed-scope or unreviewable delta.

## Failure and Retry Policy

A failed check SHALL be investigated.

It may not be excluded merely because:

- it is slow;
- it passed previously;
- the changed file appears unrelated; or
- a rerun might turn green.

An unchanged CI attempt MAY be rerun when evidence identifies an infrastructure or teardown
failure after the tested assertions completed. The report SHALL preserve:

- the failed attempt;
- the exact failure;
- the reason it is classified as infrastructure/teardown;
- the unchanged source binding; and
- the successful retry, if any.

A repeated or unexplained failure is a repository finding and expands verification scope.

## Evidence Reuse

Evidence MAY be carried forward only when all relevant inputs are unchanged.

Required binding:

- source commit and tree;
- changed range proving the affected input stayed unchanged;
- dependency and lockfile state;
- toolchain/configuration state;
- command or CI job;
- environment relevant to the result; and
- result, count, skip and attempt information.

Artifact evidence additionally requires:

- byte size;
- cryptographic digest;
- package/version identity where applicable;
- signature identity where applicable;
- runtime-configuration verification where applicable; and
- preservation location and mutability state.

Evidence reuse SHALL be rejected if any relevant input changed or cannot be proven unchanged.

## Independent Review Requirements

Whenever an independent review is due, the Technical Lead SHALL provide the Human Architect with a
complete copy-ready Review Agent prompt.

The review package SHALL contain:

- exact baseline, candidate commit, tree and delta;
- exact changed-file scope;
- authorization and exclusions;
- Change-Impact Record and risk class;
- V0–V4 results that actually occurred;
- omitted checks and rationale;
- carried-forward evidence and its binding;
- open findings and known limitations;
- explicit prohibition on repository changes by the reviewer unless separately authorized; and
- the exact verdict format, including P0–P3 findings.

The independent reviewer MAY reproduce focused or adversarial checks. It SHALL not be told to
accept the Technical Lead's risk classification without verification.

## Human Physical Gate Requirements

AVS-001 does not shorten a Physical Gate.

Before a Physical Gate:

- the product/correction must have independent `APPROVED` review with no open blocking finding;
- the exact required V4 run must be green;
- the Human Architect must separately authorize the run;
- source, ADO head, artifact, size, digest, signature, package and runtime configuration must be
  bound as required;
- device and local infrastructure preflight must pass; and
- the run starts fresh at its first mandatory step.

## Future CI Automation Requirements

Automatic selective CI is not authorized by this document alone. A separate Infrastructure Task
shall implement it.

That task MUST provide:

- a version-controlled dependency and path-to-job map;
- a fail-closed classifier where unknown or ambiguous paths select the complete matrix;
- explicit full-matrix override for candidate, security, release and manual runs;
- a lightweight always-run integrity/governance job;
- a required aggregate result that distinguishes authorized skips from executed passes;
- tests proving every path class and transitive dependency;
- lockfile, root configuration, workflow and classifier self-change rules that select all jobs;
- one scheduled complete-matrix workflow during active development;
- preserved concurrency cancellation;
- auditable output listing selected and omitted jobs with reasons;
- no use of production secrets or production data; and
- independent review before the classifier controls a required gate.

No job-selection implementation may infer safety from folder names alone where a shared contract,
schema, build script or transitive consumer exists.

## Roles

### Human Architect

- accepts or rejects changes to verification policy;
- separately authorizes Physical, deployment and release gates; and
- decides whether a stricter product-specific gate may be relaxed prospectively.

### Technical Lead

- owns Change-Impact classification;
- selects and justifies verification levels;
- expands scope when uncertainty exists;
- approves technical evidence;
- produces the independent-review prompt whenever review is due; and
- prevents optimization from reducing security or product truth.

### Development and Implementation Support Agents

- run V1 and V2 as instructed;
- add regression-effective tests;
- report every failure and omitted check truthfully; and
- do not redefine risk or gate requirements.

### Review Agent

- independently verifies scope, risk and evidence;
- challenges unsafe omissions;
- distinguishes carried evidence from freshly reproduced evidence; and
- returns an evidence-based verdict without implementing changes.

## Standard Completion Report

Every implementation or correction handover SHALL include:

```text
Verification Summary

Baseline commit/tree:
Candidate commit/tree:
Risk class:
Changed boundaries:
V0:
V1:
V2:
V3:
V4:
V5:
Carried evidence:
Checks not run and reason:
Failures/retries:
Remaining risks:
Next required gate:
```

Fields that do not apply remain present as `Not applicable` or `Not authorized`.

## Metrics

The Technical Lead SHOULD periodically record:

- complete local regression runs per Development Assignment;
- complete CI runs per published candidate;
- duplicate runs caused only by documentation synchronization;
- cancelled superseded runs;
- failed attempts and root causes;
- average feedback time for V1/V2; and
- defects found after a narrower verification level.

Metrics guide improvement. They SHALL NOT become quotas that pressure an Agent to skip required
verification.

## Adoption and Precedence

AVS-001 applies prospectively from 2026-07-20.

For work already governed by an accepted authorization, implementation plan, Physical-Gate
runbook or exact-head requirement, the existing stricter text remains authoritative until the
Human Architect explicitly amends it.

In particular, AVS-001 does not alter the current Development Assignment 1
`DA1-ARTIFACT-02` review, artifact rebinding or future Human Physical Gate requirements.

## Revision History

| Version | Date | Change | Approval |
|---|---|---|---|
| 1.0 | 2026-07-20 | Established risk-adaptive local verification, concentrated complete candidate regression, exact-head CI requirements, evidence-reuse rules and the separately gated selective-CI target | Human Architect accepted |
