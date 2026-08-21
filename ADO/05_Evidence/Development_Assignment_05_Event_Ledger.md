# Development Assignment 5 — Append-Only Event Ledger

## Automatic password Fast-Recovery candidate and consumed invisible start (`2026-08-21`)

- `claim_id`: `DA5-V5-2885739D-INVISIBLE-START-CONSUMED-20260821`; provenance Human/TL;
  authority changed from one fresh run to `CONSUMED`; terminal is
  `FAIL_CLOSED / START_VISIBILITY_OR_EXECUTION_UNOBSERVED / HUMAN_STOP`. The start boundary
  reported acceptance, the Human observed no retained window/prompt and entered no password.
  A later check found Terminal windows/process absent, scoped DA5 processes/task roots zero, ports
  3000/54321/55435 free and no new Flight root. Only later null state is proved; actual command
  execution/exit, immediate cleanup, Supervisor/Controller/ADB/install/Product/Hardware and
  Product equality remain unobserved. No retry/resume is authorized.
- `evidence`: immutable external root basename
  `flight-2885739d-start-visibility-unobserved-20260821`, root `0555`, exactly receipt 2,460 bytes /
  `0444` / SHA-256 `40d39c9b15bb2b2612a96fccc7c5c4587f99fb8974ffc377e7f36fe5cb3dea5d`
  and manifest 318 bytes / `0444` / SHA-256
  `bb98592a702b450ffb307e0ea0e4d51aa09913f7d37a57913fbabdbb4dfff0e2`.
- `claim_id`: `DA5-V5-AUTOMATIC-PASSWORD-R3-CANDIDATE-20260821`; provenance Human/Development;
  supersedes only prospective manual Supervisor password entry. On exact baseline
  `2885739d9679c7be16ea518c640636bd2f3b6753` /
  `1e437b7ebfa80aaa353a8ebbe8aa2f9e074d98dd`, the uncommitted ten-path candidate generates one
  CSPRNG-backed mutable 64-byte lowercase-hex Buffer after TTY/pending-Evidence/quarantine,
  removes hidden terminal capture, retains one fail-closed stdin owner and hardens exact FD3
  write-plus-EOF settlement. Existing plan/order/prompts/tokens/schema/Product semantics and
  manual fixed Synthetic e-mail entry remain unchanged. `Passwort nicht sichtbar` maps externally
  to existing `FAIL`; uncertainty maps to `AMBIGUOUS`; no button is automated.
- `round_1_correction`: formal review returned `CHANGES REQUIRED`, P0/P1/P2/P3 `0/1/1/0`.
  Callback-error settlement now retains one bounded pipe-error owner through paired
  callback-to-`error`/`close`, then releases without listener/timer residue; the first failure,
  child termination, attestation and seal remain authoritative. FD3 abort now calls the existing
  centralized mapper: input-order `NONCE_OR_ORDER_MISMATCH`, EOF `IPC_EOF`, OS signal and unknown
  reason `SIGNAL`. Supervisor input-order/EOF reach those exact reasons without password output.
- `round_1_verification`: correction development passed Controller 33/33; the first Supervisor run was
  RC 1 with 72 passes and one test-harness timeout, then passed 73/73 after driving `CLOSE`. The
  first four-file PREBUILT run was RC 1 only at one stale Profile static assertion; the final run
  passed 4/4 files and 162/162. Correction tests-inclusive Synthetic Typecheck passed and exact
  file-list output proved all four test members. The sole correction build argv was
  `npm run build --workspace=@taptime/synthetic-android-e2e`. The exact added final-test environment
  binding was `TAPTIME_DA5_V5_PREBUILT_BUNDLE_VERIFICATION=required`; test argv was
  `npm run test --workspace=@taptime/synthetic-android-e2e -- --run tests/Da5V5FlightSupervisor.test.ts tests/Da5V5FlightController.test.ts tests/Da5V5Profile.test.ts tests/Da5V5ProductStartBundle.test.ts`.
  PREBUILT fails closed unless Node is `v24.17.0`, all four bundle/map files are regular and their
  exact byte/hash plus relevant current `sourcesContent` bindings match; absent the variable,
  default test behavior still self-builds. Child/Flight Node syntax passed; built PTY used zero
  password input, showed zero hidden prompt and emitted no unknown 64-lowerhex candidate. Round-1
  Child JS/map are 981,784 / 1,912,537 bytes with SHA-256
  `d2bd86d3a4229022014c5fc6d7ede1493b81feb50a9b72d4ad5f1a8b8b76e633` /
  `5db54bdf7860112e5534f927b6bdb8d7d313e50e1d4810efc7fec9228d669525`; Flight JS/map are
  205,090 / 527,068 bytes with SHA-256
  `fca6ce9a95ba899c2d6b22105e06588995373b1814cb31036b9131a99e7d67f7` /
  `cf351992919e26d9f0fece4a1b0a0c0b5e5008769e2f345e885536caa282edee`. Round-0 focused
  development results remain 90/90, 151/151, 152/152 and final 157/157. No broad suite, neighbor
  secret/transfer suite, V3, CI, PostgreSQL, APK reachability execution, ADB, install or Hardware
  ran.
- `round_2_correction`: formal review returned `CHANGES REQUIRED`, P0/P1/P2/P3 `0/1/0/0`, because
  successful end callback still resolved transfer before terminal FD3 close and could leave a
  later error unowned. Write/end success are now intermediate; deadline and AbortSignal remain
  through close; only an error-free FD3 close succeeds. Late error and child-close-before-FD3-close
  fail without resettlement, while the error owner remains to FD3 close or bounded release.
- `round_2_verification`: Controller passed 35/35 both before and after adding exact fake-timer
  residue proof. Exactly one correction-2 build ran with argv
  `npm run build --workspace=@taptime/synthetic-android-e2e`; no nested build ran. With exact added
  environment `TAPTIME_DA5_V5_PREBUILT_BUNDLE_VERIFICATION=required`, the unchanged four-test argv
  passed 4/4 files and 164/164. Tests-inclusive Synthetic Typecheck and exact four-member file list
  passed; Child/Flight Node syntax passed. Built PTY again used zero password input, showed zero
  hidden prompt and emitted no unknown 64-lowerhex candidate. Current Child JS/map are 981,784 /
  1,912,587 bytes with SHA-256
  `d2bd86d3a4229022014c5fc6d7ede1493b81feb50a9b72d4ad5f1a8b8b76e633` /
  `36b8e5a6aa4b78a80523980802fb050e88b8e9feae3272d12cb6135ccbaf57e8`; Flight JS/map are
  205,118 / 527,127 bytes with SHA-256
  `6c1921eda081116af0c9c101262f08956282c80a950c0c485a181b3f67d3af49` /
  `eeeac060997fbf0986864826586693d743eac3aeb3aaad2e0a384c07f30b740b`. No broad or neighbor
  suite, V3, CI, PostgreSQL, APK reachability execution, ADB, install or Hardware ran.
- `authority`: candidate is `R3 ROUND-2 CORRECTED / ROUND-3 REVIEW PENDING / UNPUBLISHED / NO
  HARDWARE AUTHORITY`. Independent round-3 review, publication, exact artifact rebinding and a
  fresh one-shot Human Hardware authorization remain mandatory.

## Fast-Recovery fulfillment — e10d pre-Product failure and focused correction (`2026-08-21`)

- `authority`: the exact one-shot run `e10d22d0697b994c9e35bbbc2ae90efa` is consumed
  `FAIL_CLOSED / pre_product_non_product / cleanup MISMATCH / fast lane STOP`; no retry/resume is
  created. Product equality was unobserved. Child ready/bind and the Child plan
  `device-preflight` step were unreachable; cleanup-attestation ADB truth is separately corrected
  below. No Child Product result exists.
- `evidence`: immutable external root basename
  `flight-e10d22d0-fast-recovery-failure-20260821`, mode `0555`, contains exactly receipt
  4,450 bytes / `0444` /
  `9dfbdd3abcf794cebf5957124cd04fcee62bbf5a584f9ff04864a76d401a6c7d` and manifest 288 bytes /
  `0444` / `517be573c54c77c563143af7f2822e39de2a9e9aa131d9a3506a4ef9a0b4a50f`.
  Outer receipt/manifest SHA-256 are
  `6e32b0e608f40066a2c936de712c1713948e43e3658905d39e7007e84a1d1149` /
  `24250b5c7e9fc5d5c99bb51f88b47effa6c948c48b436dd2c8ef6d03fc5f3036`; inner
  receipt/manifest/commitment SHA-256 are
  `3423e6506e668d98c28f08e35d55a597391951a1ee8cffe345bad94df4f2d69e` /
  `a506728af7409be64715a70b86a7ad983953db6a4f6fe1fd947ea5004941db37` /
  `6350f90788038f163e3837191a1e570123a85a0193e82fbec98d2b7c1fd92ba9`.
- `round_1_and_supersession`: formal `/root/review_e10d_fast_recovery` returned
  `CHANGES REQUIRED`, P0/P1/P2/P3 `0/1/0/0`, because the original receipt's
  `adb_reached=false` overclaimed the cleanup-attestation domain. That root remains byte-exact and
  is superseded only for this assertion by immutable external `0555` root basename
  `flight-e10d22d0-fast-recovery-failure-20260821-correction1`, containing exactly correction
  receipt 3,408 bytes / `0444` /
  `b894827448b24e943ed17915f2a8055c60ffa413a4244a3110199a40b350212f` and manifest 299 bytes /
  `0444` / `b5e54a94c532897a8339e6ce7036493638ebeb4709a0466305db45c427e524df`.
- `cause_and_limits`: launcher implementation `365d94c5` / `0a8786bf` mismatched Guard-required
  `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867` /
  `980b6c57fdd71c12820f2890b640946db0d883c6` under manifest
  `957d6e99c271663763945026995e7463cf2f20b385eb942fd16a152d3de5f709`; Guard ordering
  guarantees rejection before Child ready/bind and its plan `device-preflight`. Controller
  cleanup attestation necessarily followed; production Android preflight attempted at least
  read-only `adb devices -l` and may conditionally have attempted further read-only
  preinstall/profile queries. Exact success, extent, output and result are unsealed/unobserved.
  No Product install/mutation, Tag or Human step was reached by the Child; Hardware absence/state
  is unclaimed. Exact hidden leaf/error text is unsealed and unclaimed. Later `ps` was 91,595 bytes versus the old 65,536-byte shared cap;
  this and the later free ports/zero roots/processes are current-only, never historical exact or
  atomic-cleanup proof.
- `correction`: `ps` now has a finite 4 MiB raw-byte cap, `lsof` remains 64 KiB, output is
  never truncated, and checker failures affect only owned domains. Cleanup mismatch is an
  independent Controller latch; an existing primary reason survives cleanup failure via `??=`.
  Receipt schema, plan and Product semantics are unchanged.
- `verification`: the two directly affected test files passed 26/26 in both initial/final
  cycles; tests-inclusive Synthetic Typecheck passed both cycles. One intermediate and one final
  build passed because post-build self-review added the final primary-reason return-path and
  raw-byte accounting adjustments; final Child and Flight Node checks passed. Baseline Child JS/map
  981,727 / 1,905,775 bytes and
  `1809c1b52aaad0980b5b204197a58029567925f4f1f77c06aca4611d65bfbce8` /
  `34aa20276ac9e4a74f8a7c4978389721294276bc39bf391d23031789ce920516` changed to final
  981,784 / 1,909,095 bytes and
  `d2bd86d3a4229022014c5fc6d7ede1493b81feb50a9b72d4ad5f1a8b8b76e633` /
  `94b22f07fbc6195c4247a2d18b381c96f21913f80906df2e1525ec24fc514b3e`; final Flight JS/map
  are 203,990 / 533,550 bytes and
  `f906611b93a7bee09b9c91bafd5765bd0f621025c89f99f58b5d6dbc6f456642` /
  `54f252830d666fd3cf4579aabeda647139d7eca6465a9d97c04a9ca13fb4a61e`. No
  ProductStartBundle, broad suite, V3 or CI ran. Correction 1 is Evidence/ADO-only; the four
  source/test blobs and all verification facts remain exact, so no test, Typecheck or build was
  rerun. Correction 1 itself ran no ADB/install/Hardware action; consumed-run cleanup ADB is
  limited to the corrected unsealed/unobserved truth above.
- `next_and_stop`: Round 1 is `CHANGES REQUIRED`; Correction 1 is `PENDING` independent
  Round-2 review. Future rebinding
  requires Guard env `ba1b6e...` / `980b6c...`, canonical toolchain SHA-256
  `34425ef206527fc65c6b5bfe1b4ea9aaa48a32fba491441d5a5b52b40b45d4`, a new binding-set ID
  and the future published correction head/tree for closure/execution checkout. The current
  launcher typo ending `c6b6f...` is noncausal and non-reusable. **STOP before fresh explicit
  one-shot Human/Hardware authority.**

## Human direction — DA5 Fast Recovery Lane (`2026-08-19`)

- `state`: **ACTIVE UNTIL EXPLICIT HUMAN REVOCATION** under
  `OK – maximal schnelle Fast Recovery Lane`.
- `supersedes`: for this recovery candidate, broader mandatory recovery reruns and the still-unrun
  **first full terminal-envelope V3 plus subsequent CI** required below, as well as repeated
  documentation truth-sync. The older V3 sequence does not execute before the next Human gate;
  prior event truth and Human/Hardware gates remain.
- `pointer_precedence`: for this recovery candidate, the current `8900a827` authority supersedes
  the older `ADO/README.md` and `ADO/00_Core/Project_Status.md` pointers `187ba562` / `174d2e80`;
  those pointer statements are non-operative here until a later synchronization.
- `failure_evidence`: one compact disclosure-safe failure receipt plus manifest per failed attempt.
- `unchanged_executable`: no test rerun; only cleanup/current-state and exact binding reattestation,
  with unchanged-input Evidence carried forward.
- `runner_or_launcher_delta`: syntax, exact concern regressions and validate-only only.
- `carried_v1_v2`: existing exact V1/V2 Evidence carries because all nine approved Product
  source/test overlay blobs remain byte-identical; exact V0 rebinding must prove the equality.
- `product_delta`: directly impacted tests/typecheck/build only; broad suites only for a materially
  changed shared boundary or when the Human asks.
- `review_route`: targeted runner verification, one focused independent review of the combined
  recovery delta and Evidence, and exact rebinding route directly to the Human gate without the
  cancelled full V3/CI; no separate repeated documentation truth-sync cycle.
- `human_gate`: after that review and rebinding, stop for one fresh exact one-shot
  Human/Product-Hardware authorization. Failure, ambiguity, interruption or binding drift remains
  fail-closed with no retry, resume or replacement absent a new explicit Human authority. This
  direction grants no present ADB, installation, Product-Human, Hardware or Tag execution.

## Technical activation addendum — terminal-envelope final V3 (`2026-08-19`)

- `supersedes`: only the round-1 correction-step statements that V1/V2/review remain pending and
  that no final V3 is authorized. The consumed Human run, immutable external Evidence,
  `FAIL_CLOSED / POST_HIDDEN_INPUT_TERMINAL_OUTCOME_UNPROVEN` truth, Product finding `NONE`,
  fast-lane `STOP` and all Human/Hardware exclusions remain unchanged.
- `round_2_review`: formal independent
  `/root/review_precontroller_terminal_envelope_r3_round2` returned `APPROVED` with zero open
  P0–P3 on baseline head/tree `8900a827be1edde2d7626c59b08ce48878934380` /
  `012640bbe837cc35479abc78461faaf207041518`, exact 12-path pre-activation candidate tree
  `f692df082e4abb8812adc4d65c8c825c93063c84`, and canonical full-index binary patch 185,418 bytes /
  SHA-256 `db2560174b2b1781935bf01ee1247861e157bf326ae0a3bffe7a7eff436743ad`.
- `verification`: V1 tests-inclusive five-file membership passed; seven focused/neighbor files had
  273 passes; PTY was 10/10. V2 required-APK Synthetic had 19 files, 523 passes, 19 expected skips
  and zero failures; Mobile had 120/120 plus tests-inclusive membership; fresh build/Node checks
  passed. Flight bundle/map: 201,416 bytes /
  `c5b43839601073f706c0c34e394085a3fda1ad34c8462f5ac486769ff3be7d1f`; 528,673 bytes /
  `61e7c2974d757f977fa7a2bbd9c5492cf54fc1707d00e847215bd3741cfd1039`.
- `immutable_code_test_overlay`: the nine source/test blob IDs listed exactly in the AVS activation
  block must remain byte-identical across this three-document delta and be independently proven
  again before V3.
- `activation_gate`: exactly one fully fresh final technical V3 becomes active only after an
  independent semantic `APPROVED` of these exact three addenda and external review/binding of the
  resulting combined 12-path tree and canonical full-index binary patch. No circular self-hash is
  recorded or inferred. Human `Dann leg los!` plus the approved architecture, round-2 `APPROVED`
  and `AGENTS.md` provide technical authority after those gates; no new Human prompt is required.
- `one_shot_execution`: begin at D01 in a fresh normal complete detached baseline worktree with the
  exact bound 12-blob overlay and fresh task/cache/log/Evidence/PostgreSQL roots. Run the established
  exact complete V3 sequence; reuse no earlier result, path, process, dependency or database state.
  Any nonzero, signal, ambiguity, runner/Evidence/configuration fault or deviation consumes V3
  `FAIL_CLOSED`; no retry, resume or replacement exists.
- `next_and_stop`: green V3 routes only to independent execution/Evidence review, focused
  publication and one V4. No pre-V3 commit, push or CI action is authorized; this addendum is
  R0/V0 only. **STOP before ADB, installation, Product-Human, Hardware, Tag or Physical-V5.**

## Technical correction addendum — terminal-envelope R3 round 1 (`2026-08-19`)

- `supersedes`: only the conflicting six-class/output-publication/link-validation mechanics in
  claim `d1d1f8a390715e3db1e2c70df9a34bf2c3477ece66b027194af7efea9716d3f9`; every consumed-run
  fact, mode/byte/hash binding and limitation in that claim remains unchanged.
- `authority`: Human `Dann leg los!`, the independently approved R3 architecture and formal
  correction-round-1 `CHANGES REQUIRED` authorize the three confirmed P1 corrections inside the
  same exact 12-path allowlist. There is no new Human, Hardware, ADB, CI, V3, publication,
  production, deployment or distribution authority.
- `terminal_truth`: **`FAIL_CLOSED / POST_HIDDEN_INPUT_TERMINAL_OUTCOME_UNPROVEN`**; Product
  finding `NONE`; fast lane `STOP`; authority consumed; credential permanently non-reusable. The
  external two-file Evidence root is final and was not edited.
- `p1_terminal_status`: terminal-status flush is now explicit proof
  `terminal_outcome_published`; `CLOSE` is neither armed nor offered before that exact bounded
  write succeeds, and exit 0 requires it. Status or acknowledgement output failure cannot undo an
  authoritative outer rename and always returns non-success.
- `p1_link_identity`: evidence parent, stage and pending roots bind canonical path plus
  `dev`/`ino`/`uid`/mode identity. Payloads are exclusive/no-follow, descriptor-sealed and
  revalidated through `lstat` + no-follow open + `fstat` as regular, single-link, unique-inode,
  exact-mode/bytes/SHA-256 files. Dangling links count as collisions. A final synchronous
  parent/root/file/collision validation immediately precedes latch selection and the only rename.
- `p1_stdout_owner`: one persistent stdout error/close owner exists before pending preparation
  through status and `CLOSE`. Every output flush is fixed-bounded, abortable and settled once;
  callback failure, error/close, timeout, signal and stdin EOF cannot hang, late callbacks are
  inert, and raw/flow/listener/timer cleanup is non-throwing. A raw/flow restoration failure is
  latched and forbids exit 0.
- `classification_mapping`: exactly seven final paths:
  `PRE_CONTROLLER_INPUT_FAILURE_NO_CHILD_PROVEN`,
  `PRE_CONTROLLER_SIGNAL_NO_CHILD_PROVEN`,
  `PRE_CONTROLLER_TERMINAL_IO_FAILURE_NO_CHILD_PROVEN`,
  `PRE_CONTROLLER_CONSTRUCTION_FAILURE_NO_CHILD_PROVEN`,
  `CONTROLLER_RETURNED_INNER_RECEIPT_SEALED`,
  `CONTROLLER_RETURNED_INNER_RECEIPT_UNSEALED`, and
  `CONTROLLER_MANAGED_OR_UNPROVEN`. Signal/EOF cancellation retains its original pre-Controller
  classification; terminal I/O cannot create a Product/cleanup claim.
- `verification_route`: rerun tests-inclusive five-file membership; focused five tests and
  CredentialTransfer/AdbController neighbors; ten consecutive PTY closures; whole Synthetic with
  required APK reachability; unchanged Mobile Android-device neighbor and tests-inclusive
  membership; fresh build, Node syntax, source-map reachability and exact bundle/hash bindings;
  then independent review. No final V3 is run before a stable approved candidate.
- `stop`: old CI/Operator/binding/launcher/Supervisor remain non-reusable. APK/Guard/tool carry
  only under exact equality and child/plan only after fresh byte equality. Future inventory rules
  remain unchanged. **STOP before every Human, Hardware, ADB, install, Tag or Physical-V5 gate.**

## Claim `d1d1f8a390715e3db1e2c70df9a34bf2c3477ece66b027194af7efea9716d3f9` — Product-Human post-hidden-input terminal outcome unproved and technical correction (`2026-08-18`)

- `binding_set_id`:
  `1297fcc5c3ec2fffe60193fd0686f034ee3ded5206fa97ce5081ffde13aa2b8d`; binds closure
  head/tree `8900a827be1edde2d7626c59b08ce48878934380` /
  `012640bbe837cc35479abc78461faaf207041518`, sole parent/executable
  `c2151a833043801440d20127cbf096b418d8e324`, executable tree
  `6d4ffdc0b74016632dfb59b2f6b10ca30d7bd9cf`, CI `31812974037` attempt 1 / 12 of 12,
  APK SHA-256 `b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234` and Operator
  manifest SHA-256 `9a7224fcf459095dc5cb69de08780ce797a113464762ddf5c3d5cdb4d0a90ec3`.
- `supersedes_claim_ids`:
  [`923076835dfec0e294390dc795756269c3c4fae94e714b7a3a337d80c1fc5b22`] only for that
  claim's prospective replacement/current-authority state. Its first invocation's visible-TTY
  routing facts remain historical and unchanged.
- `provenance`: Human observed the exact Supervisor hidden-input surface, reported one hidden
  credential submission and reported that the same terminal then closed. No terminal transcript,
  terminal result marker, exit status or Flight root was retained. TL later performed the bounded
  read-only audit and source trace; neither reconstructs the immediate terminal outcome.
- `authority_before`: exactly one fully fresh replacement invocation; `authority_after`:
  `CONSUMED / FAIL_CLOSED`, with no retry, resume, restart, relogin or replacement authorized.
- `observation` / `time_scope`: exact trigger, credential-validation result, Controller construction,
  Controller-run entry, child spawn, device preflight, immediate cleanup, device/package/profile/
  queue state and Product/install mutation are `UNOBSERVED`. There is no affirmative absence or
  presence claim. The run-scoped credential is permanently non-reusable but not classified as
  compromised; no credential value, derivative or metadata is retained.
- `later_only_audit`: no matching Supervisor/child/launcher process, no owned listener on
  3000/54321/55435, no `/private/tmp/.t5-*` name and no new Flight stage/receipt/root was observed.
  This is later current state only, never immediate-cleanup, device or Product proof.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-8900a827-post-hidden-input-terminal-unproven-20260818`
  is `0555` with exactly `receipt.txt` 3,300 bytes / `0444` / SHA-256
  `d1d1f8a390715e3db1e2c70df9a34bf2c3477ece66b027194af7efea9716d3f9` and
  `evidence-manifest.txt` 822 bytes / `0444` / SHA-256
  `ae645f4516390de2da1fccaa0208b5a08cdb2646471f3d99ca97bcca889c2450`. It also binds
  launcher `f93e95ae8b678908412dbf94d39f33c07d167108be3cbf42685da9f8524b193f`, execution
  binding `0f353d93020d8d9efdfa89d15f62caf07a61bed53d0c0ac6a6d837382ab48513`, launcher review
  `f40424fece7f420b738c8a8f2e3882252f2e8480e09c0236be0ae503c252dd57` and external final
  inventory `eaa620be061f1997ed6f0d114af73f0c852662b189137dde26ff67b5537e6f72` SHA-256 values.
- `terminal_state`: **`FAIL_CLOSED / POST_HIDDEN_INPUT_TERMINAL_OUTCOME_UNPROVEN`**; Product
  finding `NONE`; fast lane `STOP`; no Product, install, device, NFC, Tag, cleanup or Hardware
  result.
- `technical_correction_authority`: Human `Dann leg los!` plus independent corrected-architecture
  `APPROVED` activates one R3 code/test/three-document cycle on exact baseline `8900a827` and the
  exact 12-path allowlist recorded by the AVS top block. It authorizes no execution beyond V1/V2,
  independent review/correction and later one final V3 under the prescribed sequence; it stops
  before every Human/Hardware gate.
- `correction_contract`: sole compiled `da5V5FlightMain`; imported Supervisor coordinator; one
  whole-run raw Buffer stdin owner; byte-only Flight credential path; combined prompt/read port;
  precomputed run/plan/exact-receipt identity shared with Controller; verified same stdin/stdout
  TTY character device; persistent signal latch; outcome-neutral nonauthoritative pending
  envelope; closed six-path final classification; one final synchronous
  rename; inner receipt as sole Product/cleanup authority; disclosure-safe terminal JSON; exact
  same-TTY nonsecret `CLOSE`; no retry/resume/start.
- `verification_route`: R3 V1 focused adversarial tests plus tests-inclusive membership; V2 whole
  Synthetic required-APK boundary, unchanged Mobile neighbor, build/Node/map/bundle; independent
  review and correction; exactly one final V3; publication; V4; fresh artifacts and reviews; then
  **STOP** for new exact Human authority. Old CI/Operator/binding/launcher/Supervisor are
  non-reusable. APK/Guard/toolchain carry only by equality; child/plan only after fresh build proves
  equality. The future launcher persists and externally binds/reviews a final inventory manifest
  for every other final file.

## Claim `923076835dfec0e294390dc795756269c3c4fae94e714b7a3a337d80c1fc5b22` — Product-Human pre-Controller visible-TTY routing failure (`2026-08-18`)

- `binding_set_id`:
  `ef9149d7a76aee1185cf01fe1c30f14c8cbef08a37ac639b0ae9c8f6f68236e8`; binds head/tree
  `c2151a833043801440d20127cbf096b418d8e324` /
  `6d4ffdc0b74016632dfb59b2f6b10ca30d7bd9cf`, CI `31812974037` attempt 1 / 12 of 12,
  APK SHA-256 `b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234`,
  Operator manifest SHA-256
  `9a7224fcf459095dc5cb69de08780ce797a113464762ddf5c3d5cdb4d0a90ec3`, Supervisor
  SHA-256 `eda3a6e407a07f6d923c62c3c7591a1bb79a2232e87a5b265ab77a7c419fe023`, child
  SHA-256 `f480968a588e15bf974c172615edc0778fc4679088f6ccc86a5cdafecb5b00c1` and plan
  SHA-256 `bd6d8f9614d9e86b46a0ca49cc431ce95130f99e35b4d1458238eb019bed08bf`.
- `supersedes_claim_ids`: `[]`; this is the sole claim for this invocation and does not rewrite
  earlier flight history.
- `provenance`: Human reported the unrelated ordinary-zsh interaction and `command not found`;
  Machine emitted name-only preflight `MATCH`, the exact hidden-input prompt and later only
  `da5_v5_flight_start_failed` / exit 1; TL invoked the bound Supervisor, sent SIGINT exactly once,
  audited exact source ordering and performed the later read-only current-state check.
- `authority_before`: exactly one Product-Human/Hardware invocation; `authority_after`: consumed
  `FAIL_CLOSED`, with no retry, resume or replacement currently active.
- `execution`: the Supervisor stayed at its first credential read. The Human's ordinary-zsh
  candidate is compromised and permanently non-reusable; its value and digest are not retained.
  Source ordering awaits credential input before Controller construction/run, and child spawn is
  only inside `run()`. There was no Controller, child, ADB, installation, Product, NFC, Tag or
  Hardware step and therefore no such result.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-c2151a8-pre-controller-visible-tty-routing-failure-20260818`
  is `0555` with exactly two files. Receipt: 3,989 bytes / `0444` / SHA-256
  `cdb92889be81a710ed817fb0983faaf41e8e54e71503b0ea3b0530daf8755cec`; manifest: 1,309
  bytes / `0444` / SHA-256
  `90609a7b4f0c85d8d907063fb6f11aa9fb94f1915da3ed83ed7dcfa0abed1c59`.
- `time_scope` / `observation`: invocation/prompt/SIGINT/failure are immediate and attributed above.
  At `2026-08-18T16:29:01Z`, the read-only audit observed no DA5 Supervisor/child/Guard process,
  zero listeners on ports 3000/54321/55435, zero `/private/tmp/.t5-*` names and no new Flight root.
  This is later current state only; immediate complete cleanup, device/package/profile and queue
  state are unobserved and unclaimed.
- `verification`: AVS R0/V0 for exactly the three ADO paths; source-order inspection, evidence
  inventory/mode/size/SHA verification, repository/ref/index/diff checks and canonical patch
  binding only. No Product test, Typecheck, build, V3, CI rerun, ADB or Hardware action.
- `terminal_state`: **`FAIL_CLOSED / PRE-CONTROLLER VISIBLE-TTY ROUTING FAILURE`**; Product finding
  `NONE`; fast lane `STOP`; no Product/device/NFC/Tag/Hardware result.
- `conditional_replacement`: independent semantic `APPROVED` of the exact three-document delta →
  focused exact-three-document `[skip ci]` publication → independent exact-head review → only then
  private immutable visible-terminal launcher/execution-binding creation using the final new
  Runbook/Ledger SHA-256 values and a new binding set → independent artifact `APPROVED` → **STOP**
  for fresh explicit Human authority. The old binding set and pre-amendment Runbook/Ledger SHA-256
  values `3c5f3d89d9e519510647173490ac876f8d537f4f10a94aac383e64cdcdb1186b` /
  `bfacfd30e2d40661c197ffe05eb413f8012672672ee5c23869df24f54cc60f2b` are non-reusable.
  There is no retry, resume or second replacement.

## Claim `195fae95e31b39a6ae9878ae79d3076641dd075d4f2d1da463ca15ae20f432a6` — Compact-Login/Invitation R2 terminal PASS and final publication route (`2026-08-14`)

- `binding_set_id`: `9757a7f4f265cdf7fda97706cb18023bf635e1b732358becbbfdab9adce91b39`;
  binds published authority head `eb3c2d006934fe64031153834426864ffb9a5ce5`, tree
  `9b024e5de558bf6be72348d9a88aa573bf37ab16`, parent
  `caa4fb55c227de137d16ce4d7a39e67faafa38f0`, the unchanged nine overlay blobs, resulting tree
  `b61e3ec4ef2b84d36d1fb88f3c5bcc16e9042379`, and their canonical 95,701-byte full-index patch
  SHA-256 `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`.
- `supersedes_claim_ids`:
  [`5898f40b130c82a5bdaf540d1f59861cd3775a638749b00040a0bb45bdffaaf9`] only for that
  claim's prospective R2 authority and conflicting current R2 state. Its R1 invalid-Evidence
  facts and all earlier history remain unchanged.
- `pre_d01_binding`: immutable `0555` root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r2-pre-d01-binding-3de9b87baafb00cc6f29d44e93fdf14d`;
  receipt 7,490 bytes / `0444` / SHA-256
  `c679dbfb767f5fa4bc88c1dd5699177578a8e1ddf293b3400a68b9c66e2e164a`; manifest 87 bytes /
  `0444` / SHA-256 `4dea8b66ce831f77df27422252670da460439d1f66c82118bfffb8064f7b3513`.
- `runner_bundle`: authoritative manifest SHA-256
  `db5c8a895eb7900271d35d0c68606c7e8c6f4399b8a43fd1f3a673c5173fccf2`; independent review
  receipt SHA-256 `511095747c30ef9af20b7cff7048dc1ccdeab125983358271a067927626a72e3`;
  review-subject SHA-256 `6f8fda9686c5fa8f8275037c4c52f7c72b67f3b75acdb9b49b9ccfc115d55e3f`.
- `authority`: the frozen terminal supervisor was invoked exactly once. Supervisor, orchestrator
  and final-root validator each terminated `exit`/`0`; the terminal commit produced authoritative
  `PASS`. R2 is consumed `PASS` with no rerun.
- `inner_evidence`: immutable `0555` root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r1-20260814T094123Z-3de9b87baafb00cc6f29d44e93fdf14d`
  contains 883 manifested payloads plus `evidence-manifest.txt` = 884 regular files, 217 command
  sets and 868 command records. Receipt: 2,524 bytes / `0444` / SHA-256
  `b6124d02eecf961ad0cae1b883e2169476d955551c4a02ca932401f93a0224e5`; manifest: 102,706
  bytes / `0444` / SHA-256
  `d63ebdef1f03c5c715ea3d87bc0c16a187b067114aada333610290a4923920e0`. The literal `v3r1`
  path is the reviewed R2 recipe value and does not restore R1 authority.
- `terminal_evidence`: authoritative immutable `0555` root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r2-terminal-20260814T094123Z-3de9b87baafb00cc6f29d44e93fdf14d`
  contains two manifested payloads plus `evidence-manifest.txt` = three regular files. Terminal
  receipt: 839 bytes / `0444` / SHA-256
  `ca48e2a7935e42906d09fd38694ab11ceebb67d5015df7f1a711fdd96adb4fc3`; manifest: 192 bytes /
  `0444` / SHA-256 `a96119329668328e0a2a4d2f9a0f76d0f3499f46744a3fa013a06882e2c718d9`.
- `verification`: D01/D02; PostgreSQL 17 with eleven databases and 27 migrations; 20 builds; all
  21 tests-inclusive-Typecheck memberships/commands; and all 21 suites passed. Suites covered 156
  files / 3,071 passed / exactly three expected skips / zero failures. C3B, no-install,
  Node/JavaScript/map and artifact, Expo, final V0, inventory/sealing and cleanup gates passed.
  Product finding is `NONE`; no ADB, installation, Product-Human or Hardware action ran.
- `independent_review`: `/root/review_clis_v3r2_execution` returned `APPROVED` with zero open
  P0–P3 findings.
- `next_route`: independent R0/V0 review of these exact three ADO additions within the final
  12-path candidate → one intentional commit/push of the unchanged nine code/test blobs plus these
  three ADO blobs → one exact-head CI/V4 → fresh runtime/Operator artifact generation and independent
  review → **STOP** for fresh explicit Human/Hardware authority. No local V3 rerun occurs because
  only documentation was added after review of the byte-unchanged nine blobs.

## Claim `5898f40b130c82a5bdaf540d1f59861cd3775a638749b00040a0bb45bdffaaf9` — Compact-Login/Invitation R1 invalid Evidence and conditional R2 authority (`2026-08-14`)

- `binding_set_id`: `14a4dd1effdb145bfd7c1f8069172a6dffea12f02cbdd30d156f59da65f03c17`;
  binds the unchanged nine-path overlay tree at this amendment baseline
  `ea785f3f2b0eb23ee8c031a325ba5cac79da78c7`, canonical full-index patch 95,701 bytes /
  SHA-256 `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`, and the immutable
  R1 receipt/manifest below.
- `supersedes_claim_ids`:
  [`3d04c462b0f5e1303683e6b11ab21424b7c556b27b94204e8c1845173ed86897`] only for that
  claim's prospective R1 authority and any conflicting current R1 truth. Its first final-V3
  failure, SQLSTATE `42501`, cleanup and other historical facts remain unchanged.
- `provenance`: formal independent execution review `CHANGES REQUIRED` plus the immutable R1
  Evidence root below. This three-document amendment is R0/V0 and review-pending.
- `time_scope` / `observation`: the two named decision-path deviations and later diagnostic gates
  are observed in the immutable run; no later gate is reusable execution Evidence.
- `authority_before`: exactly one `DA5-CLIS-V3-R1`; `authority_after`: R1 is consumed
  `FAIL_CLOSED` with no retry or resume. Prospective R2 remains inactive behind the AVS gates.
- `evidence`: immutable, unchanged root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/da5-clis-v3r1-20260814T082337Z-2a40cfb8fa0d45e9b4de8362177a368b`
  contains 787 payloads plus `evidence-manifest.txt` and 196 command sets. `receipt.txt` is 4,511
  bytes / `0444` / SHA-256
  `05c6d91cd34e7c325e1378e7649b2a50d81f1ba4b92c9bc394e3527f955efc16`; the manifest is
  91,302 bytes / `0444` / SHA-256
  `c9ca075e0ebbf4d3cd81ea07a20224c8370613796e655f9610dbac2cda6af02c`. The receipt's `PASS`
  classification is superseded without changing the root.
- `verification`: outer D01 digest matcher return code `125` was the first decision-path
  deviation; first pre-seal inventory-validator return code `91` was the second. Technical gates
  observed afterward are diagnostic only. Product finding is `NONE`; no ADB, installation,
  Product-Human or Hardware action ran.
- `cleanup`: `PASS`; it does not repair invalid Evidence or authorize reuse.
- `prospective_r2`: the AVS top addendum alone conditionally authorizes exactly one fully fresh
  `DA5-CLIS-V3-R2` after independent ADO `APPROVED`, focused exact-three-document `[skip ci]`
  publication, independent immutable frozen-runner-bundle `APPROVED`, and independent exact-head
  receipt binding the published ADO head/tree/three blobs, unchanged nine overlay blobs,
  resulting combined tree, canonical patch bytes/SHA, exact runner bundle including
  `terminal-supervisor.mjs` and its fault-test receipt, prebound run ID/final inner root and absent
  canonical same-filesystem terminal-envelope stage, nonauthoritative pending and final paths. The
  Runbook top addendum alone is the operative recipe. R2 starts at D01 with no reuse/retry/resume;
  failure consumes it with no replacement.
- `prospective_terminal_commit`: only receipt-bound absolute Node invokes the frozen terminal
  supervisor. It awaits exact orchestrator `exit`/`0`, independently awaits final-root validator
  `exit`/`0`, verifies run/root/manifest/mode/path bindings, and then seals and atomically publishes
  a separate terminal envelope. The inner receipt is
  `TECHNICAL_GATES_COMPLETE_PENDING_TERMINAL_ENVELOPE`, never `PASS`. It seals/validates stage,
  atomically renames stage to nonauthoritative pending while final stays absent, and fully
  rereads/validates pending. Only the second atomic pending-to-final rename is the commit and final
  Evidence/authority operation; exact reviewed same-filesystem semantics plus prevalidated
  pending bytes make final authoritative without a post-final reread. Stage/pending remain
  nonauthoritative even with a visible complete `PASS` receipt, and consumers accept only the
  prebound final path jointly with its referenced exact inner root. Every precommit fault leaves
  final absent; successful commit leaves stage/pending absent and final present. No cleanup or
  classification operation follows; supervisor return is informational, not recursive authority.
  External/ad-hoc wrappers remain forbidden.
- `terminal_state`: **`FAIL_CLOSED / EVIDENCE INVALID / RUNNER-VALIDATOR DEVIATION`**; recorded
  R1 `PASS` is invalid and superseded; Product finding `NONE`; cleanup `PASS`; fast lane `NOT
  APPLICABLE`. R2 green can proceed only to independent R3 execution/Evidence review and then
  **STOPS before Supervisor, ADB, installation, Product-Human and Hardware**.

## Claim `3d04c462b0f5e1303683e6b11ab21424b7c556b27b94204e8c1845173ed86897` — Compact-Login/Invitation V3 terminal failure and conditional replacement authority (`2026-08-14`)

- `binding_set_id`: `50e58860f132131257f487cc5c1bc571b3ab27d1e45027c166e59f6ac0e8a40f`;
  binds candidate tree `534b1bfed4696833d2e6994af7e2eb2590b37388`, canonical nine-path
  full-index patch 95,701 bytes / SHA-256
  `948362e5b82cc599181976c9e55966979b75f5b25b0e5ec2cb2990004c9635d0`, receipt digest and
  manifest digest below.
- `round_1_review_input`: exact combined 12-path tree
  `468ae43e2bf18914bef9a08c6b65c8ff7b9ff932`; canonical full-index patch 109,107 bytes /
  SHA-256 `aafe63a4bc156c5204820d9784cd7cba9e483e2353e7bde88b9cc76016c0f509`.
  Independent Review Round 1 returned `CHANGES REQUIRED` for P1-A deterministic execution detail
  and P1-B activation binding. These values are historical review input, never a final Pre-D01
  target after this three-document correction.
- `supersedes_claim_ids`: `[]`; this is the sole result/Evidence claim for this Compact-Login/
  Invitation final-V3 attempt and does not rewrite prior fast-flight V3-A/B/C/D history.
- `provenance`: machine execution and cleanup facts supplied by the Technical Lead and the
  immutable Evidence below. This three-document amendment is R0/V0 review-pending; it claims no
  independent ADO approval or replacement execution.
- `time_scope` / `observation`: named execution gates and final cleanup are immediate / observed.
  Initial port stdout is observed, but the four individual preflight return codes are unproved /
  unobserved; complete post-cleanup port Evidence does not repair that limitation.
- `authority_before`: exactly one final V3; `authority_after`: that attempt is consumed
  `FAIL_CLOSED`, with no retry or resume. Exactly one new fresh `DA5-CLIS-V3-R1` becomes active
  only after independent ADO `APPROVED`, focused three-document `[skip ci]` publication and
  independent exact-head review. Its immutable receipt must bind the published ADO commit/tree,
  exact three ADO blobs, unchanged nine executable/test overlay blobs, resulting final candidate
  tree, and canonical nine-path overlay-patch bytes/SHA relative to that published head. Those
  externally reviewed values alone are the Pre-D01 target; missing/ambiguous values are `STOP`,
  and no placeholder or hash may be inferred. Failure then consumes the run with no replacement.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-534b1bfe-20260814T063909Z`
  is `0555`, with 102 manifested payloads plus `evidence-manifest.txt` = 103 regular files;
  receipt 2,355 bytes / `0444` / SHA-256
  `ed7d7972d385cbb2262df90e19ae490884c3a7a1a9c934f2bc600a943d29c96c`; manifest 11,651
  bytes / `0444` / SHA-256
  `30cfdb6747dc0814cf3db1e487b1a578df8726578e56d8d7302d125ed7d8a68c`.
- `verification`: unchanged V2 remains carried `PASS`; pre-V3 independent R3 review remains
  carried `APPROVED` with zero open P0–P3. In the consumed V3, D01 and D02 passed exactly once;
  PostgreSQL 17.10 and exactly eleven fresh databases passed. The first migration stopped before
  migration 001 with SQLSTATE `42501` because a separate installer LOGIN role lacked
  CI-equivalent role-creation privilege. Zero of 27 migrations completed; no build, Typecheck,
  suite, later/final gate, ADB, installation, Product-Human or Hardware action ran.
- `cleanup`: `PASS`; PostgreSQL stopped, worktree/task root were absent, and separate retained
  `/usr/sbin/lsof` checks fully proved ports 3000, 54321, 55435 and 55436 free after cleanup.
- `replacement_execution_contract`: there is no separate candidate/run-plan input. The Runbook
  fixes every suite fixture, all six Expo values, all four exact artifact gates and final V0 from
  the mandatory exact-head receipt. Every command writes directly to a fresh external Evidence
  stage; only its inventory/manifest/mode-complete, atomically published and fully reread sealed
  final root is authority. Task-root deletion cannot delete that Evidence; any sealing failure is
  invalid and can never yield `PASS`.
- `terminal_state`: `FAIL_CLOSED`; Product finding `NONE`; fast lane `NOT APPLICABLE`. No failed-
  V3 gate, result, process, database, root, file or observation may be reused. The AVS top
  addendum alone governs the conditional one-shot replacement authority; the Runbook top addendum
  alone governs its fresh execution, including its byte-bound tool and immutable command/
  environment/order recipe inputs. Green replacement V3 routes only to independent R3 review and
  **STOPS before ADB, installation, Product-Human and Hardware**.

## Claim `d1b1d67ef28081e25900e6b1367e3585a7846547960af47969b68c5aca341a5b` — V3-D terminal PASS (`2026-08-14`)

- `binding_set_id`: `7d799b1c2e4ad86bdfe3df0f25b5af081dc881213f8e8a87c0e3ef1e5e71bdb4`;
  binds candidate tree `d8a7c272a41738e95b9bb5b6043312443bdfd7e5` and its canonical 18-path
  baseline patch (237,564 bytes / SHA-256
  `4c21064c2c6cec03029f130df3b885c486739ef6180e8d1e647564d2327cfb73`) to the immutable
  receipt/manifest below.
- `supersedes_claim_ids`:
  [`d01c6ffe997b0e9a1bf4ed1e7a7115ad0e5380fa21e4b04e7b5b45281ebaa476`] only for that
  claim's prospective V3-D authority and conflicting current V3-D result; its V3-C terminal facts
  remain historical and unchanged.
- `provenance`: Machine execution/cleanup facts supplied by the Technical Lead, immutable Evidence
  below, and independent R3 review `APPROVED` with zero open P0–P3.
- `time_scope` / `observation`: immediate / observed for all named gates and final cleanup.
- `authority_before`: exactly one fresh V3-D; `authority_after`: V3-D consumed `PASS`; no ADB,
  installation, Product-Human or Hardware authority was created.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-fast-d8a7-v3d-OCGEwA2H`
  is `0555`, with 381 manifested payloads plus `evidence-manifest.txt` = 382 regular files;
  receipt 2,623 bytes / `0444` / SHA-256
  `5daa9e3b279eac6feabc51fdcad2fae1ec7306f77d984b10bb49f14cfdce5377`; manifest 69,979
  bytes / `0444` / SHA-256
  `40a8053ec1abc436e5f9fdf2c8917f73c67dff1ff8a2560ddd24153bf1b1a4e2`.
- `verification`: D01/D02 ran once with retained raw logs and zero D02 problems; PostgreSQL
  17.10/11 databases/27 migrations, 20 builds, 21 membership/tests-inclusive Typechecks and 21
  suites passed. The suites covered 155 files / 3,043 tests: 3,040 passed, three expected skips,
  zero failures. C3B, direct-Node no-install preflight, Node checks, Expo,
  bundle/map/APK/tool/V0 and cleanup passed; cleanup stopped PostgreSQL, removed the task root and
  proved ports 3000/54321/55435/55439 absent via `/usr/sbin/lsof`.
- `terminal_state`: `PASS`; cleanup `PASS`; Product finding `NONE`; fast lane `NOT APPLICABLE`.
  No ADB, installation, Product-Human or Hardware action occurred; independent review found no
  open code, security, tenant-isolation, FD3, protocol or receipt-sealing finding.

## Claim `d01c6ffe997b0e9a1bf4ed1e7a7115ad0e5380fa21e4b04e7b5b45281ebaa476` — V3-C terminal correction (`2026-08-14`)

- `binding_set_id`: `418aa03701ea5ff5f104092b9e2aac2e2820ac38e3134f03778fe035f7c307f2`;
  binds unchanged candidate tree `5b50f0c2b0f1a6635ea73808911d42d8a3f6f653`, its canonical
  18-path baseline patch (236,475 bytes / SHA-256
  `405efc2b2b03ecd19f41500f3dc362077c371da99f6b2095d4dac3c8fe434c42`) and the immutable
  Evidence manifest below.
- `supersedes_claim_ids`:
  [`a475acb21a8458c447a74c1c344719c8806ab85777156e1a64a644327b73c791`] only for that
  claim's prospective V3-C authority and every conflicting current V3-C result/cleanup wording;
  its V3-B terminal facts remain historical and unchanged.
- `provenance`: Machine execution/cleanup facts supplied by the Technical Lead, immutable Evidence
  below, and independent read-only review `CHANGES REQUIRED` findings.
- `time_scope` / `observation`: execution and gate facts are immediate / observed; immediate
  owned-port cleanup is immediate / unproved and unobserved; the later `/usr/sbin/lsof` state is
  later / observed and cannot repair the unproved immediate state.
- `authority_before`: exactly one V3-C; `authority_after`: V3-C consumed `FAIL_CLOSED`. No V3-D
  may start until the exact three-document correction receives independent ADO `APPROVED`.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-fast-5b50-v3c-failed-sparse-checkout-20260814T0039Z`
  is `0555`, with 43 manifested payloads plus `evidence-manifest.txt`; receipt 1,668 bytes /
  `0444` / SHA-256 `b6a58f5316cf54939465f0d3336cbae1cf8000c44655ee54cd3c3d5680d08a44`;
  manifest 4,057 bytes / `0444` / SHA-256
  `2a3ad07572901c4c6d4ad2f206aedf2dd72c65a08c213440a1e976bee12d7307`.
- `verification`: carried V2 remains `PASS`. D01 and D02 ran once each and their PASS results are
  supported by JSON/stderr/return-code/digest Evidence, but the raw D02 npm debug log was not
  retained; the mandatory retention gate was therefore `MISMATCH` and should have stopped before
  PostgreSQL. PostgreSQL 17.10, 11 databases and 27 migrations later passed. The first build then
  failed with TS5083 solely because the ad-hoc sparse checkout omitted tracked root
  `tsconfig.base.json`; this is a runner failure, not a code or Product finding.
- `cleanup`: immediate owned-port cleanup is `UNVERIFIED`: four sealed checks used missing
  `/usr/bin/lsof`. A later `/usr/sbin/lsof` free observation proves only later state and cannot
  repair the immediate claim. No ADB, install, Product-Human or Hardware action occurred.
- `terminal_state`: `FAIL_CLOSED`; Product finding `NONE`; no result, process, path or observation
  is reusable. AVS-001 alone governs the prospective one-shot V3-D; the Runbook alone governs it.

## Claim `a475acb21a8458c447a74c1c344719c8806ab85777156e1a64a644327b73c791` — V3-B terminal (`2026-08-14`)

- `binding_set_id`: `a07cde46aec06d28446addb18e9c4918fc1f517c3e28e67201de8066349a505c`;
  binds candidate tree `a89127a8dd6c8706ade531065fd65207797da0a0`, canonical baseline diff
  225,713 bytes / SHA-256 `cc8ac2b4b394d925eda71fce65ad88113196aa23e82a9adcf9dfec30ab4adac4`
  and the immutable Evidence manifest below.
- `supersedes_claim_ids`: `[]`; this is the sole current V3-B result/Evidence claim.
- `provenance`: Machine result and cleanup facts supplied by the Technical Lead; independent
  result review `APPROVED`, zero open P0–P3.
- `time_scope` / `observation`: point-in-time / observed for the named gates and cleanup only.
- `authority_before`: exactly one fresh V3-B; `authority_after`: V3-B consumed `FAIL_CLOSED`.
  No V3-C authority exists until the exact three-document amendment receives independent ADO
  `APPROVED` under AVS-001.
- `evidence`: immutable root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-fast-a891-v3b-failed-pg-locale-20260814T0153Z`
  is `0555`, with 43 manifested payloads plus `evidence-manifest.txt` = 44 regular files;
  receipt 1,189 bytes / `0444` / SHA-256
  `cd1805dbcc5e297d861cf9f1150522017e55725066c86732928089d99941b131`;
  manifest 4,102 bytes / `0444` / SHA-256
  `a3059e57162e7a8ace1dda31f907908acd3e3465e9f68187f23d0cb6db0120a7`.
- `verification`: carried V2 remains `PASS`. V3-B ran D01 and D02 exactly once and both passed;
  `initdb` passed with locale `C`. The first and only `pg_ctl` start then failed before any
  database existed with `postmaster became multithreaded during startup` and the valid
  `LC_ALL` hint. No database, migration, build, Typecheck, suite or final gate ran; no ADB,
  install, Product, Human or Hardware action occurred. Cleanup passed and the candidate remained
  unchanged. This is solely a runner-locale failure, not a code or Product finding.
- `terminal_state`: `FAIL_CLOSED`; cleanup `PASS`; Product finding `NONE`; fast lane `NOT
  APPLICABLE`; V3-B results are never reusable.

For current precedence, this claim alone is V3-B result/Evidence truth, AVS-001 alone governs the
prospective one-time V3-C authority, and the Runbook alone defines its operative commands and
phase environments. Conflicting V3-B runner/authority text in unchanged ADR-0019, the Lean
Hardware Flight Card, V5 Evidence and Publication Closure is superseded and remains historical
point-in-time content only.

Status: **ACTIVE SCHEMA / R3 IMPLEMENTATION CANDIDATE / NO RUN AUTHORITY**

Governing activation: exact-head approved authorization commit
`9032581b1cb13b4a44f575aaface8a87989f4932`, tree
`03c06109a622e666d693ad9f28785ad834f4e663`.

This is the single published append-only source for prospective DA5 fast-flight events. Git and
immutable external evidence retain detail; this Ledger does not copy the 13,000-line historical
narrative. Corrections append a new claim and name `supersedes_claim_ids`; existing entries are
never silently mutated. Operational receipts are authoritative until required synchronization.

## Current technical verification / no operational event (`2026-08-14`)

Pre-amendment candidate tree `b775c248bb268e91b141c62361b47614f38934a5`, full 18-path patch
212,896 bytes / SHA-256 `155bb35851508e30bed6c3b2908c8b410845ddd6fabc3bd795016bd0ed744cc1`,
has fresh V2 PASS: Synthetic 16 files / 384 passed / 19 expected DB skips; Mobile 1 file / 120
passed; both tests-inclusive typechecks, fresh build and bundle checks.

Technical V3-A is consumed `FAIL_CLOSED`. It passed D01/D02, 11 DB, 27 migrations, 20 builds,
21 memberships/typechecks/suites (155 files; 3,043 tests: 3,040 passed, zero failed, three expected
skips) and C3B, then stopped at the no-install preflight because exact
`TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5` was missing. Repository source requires that exact profile;
this is a runner-configuration failure, not a code/Product finding. No ADB, install, Product or
Hardware action occurred; cleanup passed. Evidence root
`v3-fast-b775c248-failed-profile-20260814T0049Z` is `0555` / 78 manifest-bound payload files plus
`evidence-manifest.txt` = 79 regular files total; receipt SHA-256
`d13dae77c997167962ac31c843e8ee22f904001957c25db0143dceb88c61fb75`; manifest SHA-256
`36d1172e26f330d12d3990a29e0e0bd31e42adc0fd80b71c09be373773fb79f1`.

After independent ADO review `APPROVED`, exactly one **new** fresh V3-B is authorized on the
amendment's resulting bound tree/patch. It reruns full V3 from D01; V3-A is context only. Before
D01 the runner proves the exact unchanged minimal sanitized profile environment. The read-only
gate binds candidate-checkout CWD exactly as
`/Users/timbartz/Dokumente/GitHub/taptime`, directly invokes exactly once
`/usr/bin/env TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5 /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`,
and retains exact CWD/argv, the environment-name proof, raw output and return code. The helper is
the direct child of D01-bound Node `24.17.0`; no package lifecycle, bare `node`/`npm`/`npx`,
profile/DB-credential/secret leakage, ADB or install is permitted. Failure consumes V3-B with no
retry; green goes to independent review only. No fast-flight/Physical event or Hardware authority
is created.

## Closed entry schema

Each appended event supplies exactly:

- `binding_set_id`: lowercase SHA-256 of the reviewed Flight Package and applicable evidence set;
- `claim_id`: stable unique lowercase digest identity;
- `supersedes_claim_ids`: zero or more earlier claim IDs;
- `provenance`: `Human`, `Machine` or `TL`, plus responsible source;
- `time_scope`: `immediate`, `later` or `unproved`;
- `observation`: `observed` or `unobserved`;
- `authority_before` and `authority_after`, including consumption state;
- `evidence`: algorithms, digests and immutable receipt/artifact bindings only;
- `verification`: AVS risk/level, commands/results, omissions and reasons;
- `terminal_state`: attempted outcome, cleanup, Product-finding and fast-lane state separately.

No entry contains a Credential, secret/digest, raw serial/UID/NFC payload, personal data, PID,
raw Product record or transcript. A routine nonmaterial qualifying receipt may wait until campaign
end, binding change, release/DA6 boundary or 24 hours, whichever is first. A batch containing a
Physical result, authority transition, safety, cleanup or terminal classification receives one
independent semantic delta review.

## Governing pointers

| Claim | Current value |
|---|---|
| `ledger-schema-activation-20260813` | Schema and fast-flight policy activated by the governing commit/tree above; implementation review/publication/V4 remain pending; no run authority |
| `latest-historical-terminal-pointer` | See the correction-2 sections in V5 Evidence and Publication Closure: `FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2; LATER CURRENT STATE CLEAN`; authority consumed; queue unobserved; no retry/resume/relogin/replacement |

No prospective physical or fast-flight run event exists at creation of this Ledger.
