# Project Status

Status: CORE ROADMAP V2 BLOCK A, B1–B6, C1/C2, C3B, C3C, C3D, C3E1, C3E2, BLOCK D, E1 AND NARROW E2A COMPLETE FOR THEIR RECORDED SCOPES — DEVELOPMENT ASSIGNMENT 1 AND DT-060–DT-062 CLOSED FOR THE AUTHORIZED LOCAL ANDROID/REPOSITORY/SYNTHETIC-SERVER SCOPE — DEVELOPMENT ASSIGNMENT 2 WORKSTREAMS A–D PUBLISHED AT `f385814`/TREE `48b5ba8`, TECHNICAL-LEAD/AVS V0–V4 APPROVED, EXACT-HEAD RUN `29847593708` 11/11 AND INDEPENDENT EXACT-SHA REVIEW `APPROVED` WITH ZERO OPEN P0–P3; EXACT-SCOPE ADO CLOSURE PUBLICATION PREPARED, EXACT-HEAD CI PENDING — PRODUCTION, PRODUCTION DATA, PHYSICAL GATE, DEPLOYMENT AND DISTRIBUTION REMAIN UNAUTHORIZED — DT-063–DT-068 CLOSE ONLY AFTER CLOSURE-PUBLICATION CI
Date: 2026-07-21
Owner: Human Architect + Technical Lead

## Product

TapTim.e is a professional time tracking product with NFC chip scan as its primary differentiating capability, and — per `Product_Vision.md`'s long-term vision — the first application of a broader Business Event Platform.

## Current State

- **Development Assignment 2 is Human-accepted and repository implementation is authorized on
  published baseline `30c4f5d1d8e6fedeb4b6c1f168d6e1f70a4fef76`, tree
  `242331b6a34cd19a16fd8a9bea993b2349cbb6dc`.** Exact-head run `29843878706` passed 10/10 and the
  independent pre-implementation re-review has zero open P0–P3. Repository/code reconciliation shows that the
  independently closed C3B/C3C/C3D/C3E1/C3E2 boundaries already provide the local/synthetic setup
  implementation and must not be duplicated. Human-accepted ADR-0013 therefore combines setup
  integration/evidence with one new Administrator-only, tenant-safe, bounded and audited TimeEntry
  CSV backend. The initial independent review returned `CHANGES REQUIRED` with exactly DA2-REV-01
  (P2), no P0/P1/P3, alleging ambiguous TimeEntry attribution across multiple historical
  same-Organization/User Memberships. Technical-Lead verification rejects that premise: migration
  `001` permanently enforces `UNIQUE (organization_id, user_id)`, migrations `002`–`010` retain it,
  and accepted C3E1 forbids any historical re-onboarding or Organization transfer. The clarity part
  is accepted with adjustment: DA2-P07 now fixes the exact join, retained stable Membership,
  nullable-name output and fail-closed missing-row integrity. The renewed independent review
  explicitly withdrew the original premise, approved the complete candidate, closed DA2-REV-01
  and reported zero open P0–P3. DA2-P01–DA2-P12 are now binding. Workstreams A–D and AVS V0–V4 are
  released. The local candidate now implements migration `011`, the neutral CSV contract, isolated
  role/pool/coordinator/API, a fully disposable Setup-to-Export journey and an eleventh CI job.
  AVS V0–V3 passes 1,681 tests plus all applicable checks/builds and Android export. Implementation
  `f385814`, tree `48b5ba8`, passed V4 exact-head run `29847593708` 11/11. Independent exact-SHA
  review bound reviewed evidence head `1e4dee2`, tree `d6c3adf`, and exact-head run `29847934091`
  11/11, returned `APPROVED` and reported zero open P0/P1/P2/P3. Exact-scope ADO closure is prepared
  and awaits only its own exact-head CI; Physical, production,
  production-data, deployment, distribution and UI productization remain unauthorized.
- Dedicated GitHub repository exists, connected through Git remote `origin`.
- **AVS-001 Adaptive Verification and CI Efficiency is Human-accepted and active as a manual
  operating standard from 2026-07-20.** Implementation work now uses focused feedback during
  iteration, complete affected-boundary verification before Technical-Lead approval, one complete
  local candidate regression before independent review and complete exact-head CI at
  product/security/artifact/Physical/release decision points. Documentation-only evidence may be
  carried only across a proven non-executable delta. Unknown impact fails closed to broader
  verification. Existing accepted gates, including the current DA1-ARTIFACT-02 chain, remain
  unchanged. Published DA2 extends the workflow from ten to eleven jobs on every push/PR to `main`;
  exact-head run `29847593708` passed all eleven.
  automatic selective CI is a separately authorized, implemented and independently reviewed
  future Infrastructure Task, not a capability already present.
- Product Vision and Product Principles are Approved.
- ADR-0001 through ADR-0006 are accepted; ADR-0007 (Technology Platform Baseline) is Approved. Its original backend/cloud provider deferral was subsequently resolved for the repository architecture by accepted ADR-0008: Supabase-managed PostgreSQL/Auth with managed Node as the primary transactional lifecycle runtime. No production project/resource or production-data authority follows from that architecture decision.
- FB-001 (NFC Scan Creates Work Event), TS-001 (its Technical Specification) and TTAP-001 (Technical Architecture Profile) are Approved — the first Feature Blueprint/Technical Specification pair has a complete, validated chain.
- EP-007 Product Architecture Foundation is closed; see AVR-001 for validation evidence.
- EP-007 Development Tasks (`ADO/02_Development/EP-007_Development_Tasks.md`) now span DT-001–DT-026 across Development Sprints 001–019, all Completed (DEV-SPRINT-001 through DEV-SPRINT-019 in the Decision Log), except Development Sprint 002 (DT-004/005/006) and Development Sprint 004 (DT-008), which remain implemented but not yet Review-Agent-verified or Human-Architect-approved. DT-016's original no-device caveat is now closed for the approved Galaxy A33/Android 15/two-NTAG213 set by device-local stability evidence and authenticated product-server unassigned/Start/Stop evidence. **DT-017–DT-026 (the full TS-002 Organization Management Foundation Development Task sequence) are now all Completed** — no DT-027 or later task exists anywhere in FB-002, TS-002, or `EP-007_Development_Tasks.md`.
- EP-008 Developer Implementation Manual Chapters 00–03 preserve their Development Sprint 001–019 history and include the Human-accepted post-Sprint-019 Block-boundary reconciliation through Blocks A, B1–B6, C1/C2, D, E1/E2A and C3A–C3C on baseline `fda5e5b9e878311b0caa647c6b49ab14943b706e`. Synchronization `d9060fe96bcb9d2e3282d5cb08a455d113b86307` passed ten-job run `29394356224`; closure `9c9144fa468cbaa6d1195a172f92e746ad3eb265` passed ten-job run `29394550988`; independent final review returned `APPROVED` with no open repository finding after disposition. The Human Architect accepted Chapters 00–03 and later accepted the additive C3D closure sections on 2026-07-15 without altering the accepted C3C/E2A snapshot; planned Chapters 04–10 remain a separate documentation backlog.
- **C3D is completed for its authorized repository and Human physical scope.** Loopback correction `ad64cec` passed independent zero-finding review and ten-of-ten run `29402429508`. Browser-runtime correction `e686578`, tree `f80e700`, passed independent zero-finding review and ten-of-ten exact-head run `29405184995`; current evidence is Admin Web 27/27, Core 290/290, Mobile 338/338, contract 3/3 and PostgreSQL-backed harness 9/9 plus relevant typechecks/builds. The fresh Galaxy A33/NTAG213 sequence passed Employee setup denial, Administrator Web Customer creation, safe Web/Android projection agreement, force-stop non-mutation, real C3C provisioning and same-Administrator Start/Stop. Final sanitized counts were Customers 2, Tags 1, Assignments 1, admin receipts 2, WorkEvents 2, Decisions 2, lifecycle Receipts 2, one stopped TimeEntry and AuditEvents 5. One initial Start attempt failed closed with zero mutation; controlled read-only diagnosis and retry proved exactly one Start and one Stop. Sign-out, schema/listener shutdown and scoped reverse removal passed. No Mobile/backend/C3C/schema/Core rule, production authority or personal data changed. ADO closure commit `a041986` passed exact-head ten-of-ten run `29407078949`. C3E1 later completed its separately governed repository/Human scope; C3E2 later received its own bounded repository release. Web/iOS NFC and production remain unauthorized.
- **C3E1 is closed for its authorized repository and Human physical scope.** Corrected authorization `70d163f` closed all six contract findings and passed independent zero-finding re-review plus exact-head run `29410078768`; product correction `450d767`, tree `a60d306`, passed zero-finding delta re-review and exact-head ten-of-ten run `29416554531`. First harness `ee522a5` required four corrections; focused correction `4338910`, tree `0657f4b`, passed independent zero-finding delta re-review and exact-head ten-of-ten run `29420832927`. Harness 16/16 retains the 1,534-test matrix plus two approved Supavisor skips. The complete fresh Galaxy A33/NTAG213 sequence passed real C3C prerequisite setup, manual secret-only handling, authority-free pre-Membership state, wrong-secret zero mutation, force-stop rollback, exact one-grant redemption, Employee Start/Stop, consumed-secret denial to the second identity, safe one-Employee Admin projection, exact final counts, both sign-outs and complete schema/login/listener/reverse cleanup. Three prior attempts were reset and contribute no observation: invitation expiry, unauthorized clipboard transfer and an automatic rollback before the required physical force-stop sequence. ADO-only closure commit `fe0781b`, tree `76284e5`, passed exact-head ten-of-ten run `29645336694`; independent final review returned `APPROVED` with zero open P0/P1/P2/P3 and accepted the documented Force-Stop timing disposition. C3E2 later received its own bounded repository release; production resources/data and deployment/distribution remain unauthorized. Evidence: `ADO/05_Evidence/Block_C3E1_Implementation_Evidence.md`, `ADO/05_Evidence/Block_C3E1_Physical_Validation_Evidence.md` and `ADO/05_Evidence/Block_C3E1_Independent_Final_Closure_Review.md`.
- **C3E2 is independently closed for its authorized local repository/device scope.** The contract reviewed at `dbefc1c`, tree `3bcc153`, received zero-finding independent approval, exact-head run `29646684981` and Human acceptance of Sections 3–13. After the distinct repository release on baseline `5bc4951`, implementation `b783733` plus CI correction `672b7ac` delivered migration `009`, the separate least-privilege reassignment boundary, exact API route, safe Web confirmation and Android parser compatibility. Final head `7050df4`, tree `587ef8f`, passed ten-of-ten run `29649683173`; independent implementation review returned `APPROVED` with zero open P0/P1/P2/P3. The Human Architect then passed the complete fresh Galaxy-A33/Android-15/NTAG213 sequence: C3C assignment to Customer A, C3E1 Employee enrollment, A Start, active-work rejection with zero mutation, A Stop, explicit A→B reassignment, matching Web/Android projections and B Start/Stop. Final sanitized state was two Customers, one Tag, two Assignments, two administration receipts, four WorkEvents/Decisions/lifecycle Receipts, two stopped TimeEntries and ten AuditEvents; read-only evidence proved one shared cutover timestamp and immutable A-before/B-after attribution. Sign-out and complete schema/login/listener/reverse cleanup passed. ADO-only closure commit `a2fdebc`, tree `1872f9f`, passed exact-head ten-of-ten run `29652072268`; independent final review returned `APPROVED` with zero open P0/P1/P2/P3 and accepted all documented attempt-separation and safe-boundary evidence. No production resource/data or deployment/distribution authority follows. Evidence: `ADO/05_Evidence/Block_C3E2_Implementation_Evidence.md`, `ADO/05_Evidence/Block_C3E2_Physical_Validation_Evidence.md` and `ADO/05_Evidence/Block_C3E2_Independent_Final_Closure_Review.md`.
- **Development Assignment 1 has a Human-accepted complete offline/synchronization architecture and
  authorization contract; repository Workstreams A–E and the `DA1-PHYS-01/02/03/04` and
  `DA1-ARTIFACT-02` corrections are independently approved with their findings closed. Five prior
  complete Human gates remain failed historical runs. The separately authorized sixth complete
  fresh Gate A–E run passed on the exact runtime-complete APK and approved Galaxy-A33/Android-15/
  two-NTAG213 set. Cold true-offline A→B→A capture, automatic FIFO, lost-response idempotency,
  stale-cutover review-pending truth across restart, native background single-flight, both sign-outs
  and complete disposable cleanup all passed. Evidence publication `8d5b2bb`, tree `592f9da`,
  passed exact-head run `29836085810`, attempt 1, ten of ten. Independent final closure review
  returned `APPROVED` with zero open P0/P1/P2/P3 and authorized DA1 plus DT-060–DT-062 closure for
  the exact local Android/repository/synthetic-server scope. Closure publication `715889e`, tree
  `b9fc3ac`, passed exact-head run `29837556200`, attempt 1, ten of ten. DA1 is closed.**
  On exact clean baseline
  `1bb2d7d7b38928643cfd5c86b36c500c35f73276`, tree
  `c5c20f67155cdc0b4197908b4d1283cb7e619597`, Human-accepted ADR-0012 and the comprehensive
  assignment contract reconcile E1/E2A, the one-record Mobile outbox, volatile scan-context slot, server
  defer-only evidence, C3E2 Assignment history and the legacy Core demo queue. The accepted contract
  defines a 12-hour server lease, five-minute clock tolerance, 72-hour automatic-evaluation window,
  Android same-boot monotonic proof, SQLCipher-backed Expo SQLite, a 256-event persist-first FIFO,
  exact retry/backoff, best-effort platform background sync, an isolated least-privilege offline
  ingestion/reconciliation route and
  a complete fresh multi-event/cold-start Human gate. Independent read-only review bound candidate
  commit `592334160655cde2f4189712eaf327c8a7edcb0e`, tree
  `96fffb5bb5e2793041c36b8f793c38ab1c2e5428` and exact-head run `29653357355`, attempt 1,
  10/10, and returned `APPROVED` with zero open P0/P1/P2/P3. The Human Architect subsequently
  accepted ADR-0012 and Sections 3–13 on reviewed commit `5923341`, including every numeric policy.
  The Human Architect subsequently released repository implementation of Workstreams A–E from
  exact baseline `180093091c47a926b5871a27ea8b00fb21b9b4ac`, tree
  `73e77b6ca5dfd7671cdd3d77a344168fddff3627`. The Technical Lead froze the implementation names
  and verification matrix in the assignment implementation plan. The local candidate adds the
  neutral contract, migration `010`, three isolated least-privilege backend capabilities, four exact
  API routes, SQLCipher/SecureStore Mobile persistence, native Android monotonic proof, persist-first
  FIFO scheduling and best-effort background synchronization. The original local verification passed
  1,625 tests, all 15 workspace typechecks/builds, Android export and a current 690-task Android release
  build. Focused implementation commit `4f51918993e02b7bf51a1194f8d4d750abfae7c4`,
  tree `617081f34e34cbf5e314a26f4cc634c846c2e319`, passed exact-head GitHub Actions run
  `29675842388`, attempt 1, ten of ten jobs. Independent implementation review of publication head
  `de895215b28110b8fe7129863df17795351b5795`, tree
  `443a697cb3e5d2f6339884ba504aa9103634fcf4`, returned `CHANGES REQUIRED` with exactly one P2:
  `DA1-IMPL-01`. The Offline advisory-lock framing is now byte-identical to B6's U+001F boundary,
  and a real canonical-versus-Offline PostgreSQL test observes the Offline transaction waiting on
  that lock before deterministic duplicate suppression. The corrected complete local matrix passes
  1,626 tests, all 15 Workspace TypeScript checks and all available builds. Correction
  `c71399a349ec5615acee5abc13eda726bcdaa84f`, tree
  `7a159ce6e21548c69dd2a77fed3e17f3e7865212`, passed exact-head run `29692113159`, attempt 1,
  ten of ten jobs. Renewed independent exact-delta review bound final reviewed head
  `767043d8f91bc2806cb1bd111989cf9b741b858c`, tree
  `19c434a8ba4586aeb1344778cbe483504ce46a34`, and final-head run `29692304824`, attempt 1,
  ten of ten jobs. It returned `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-IMPL-01`.
  The Human Architect subsequently authorized the complete fresh Physical Gate bound to product
  head `767043d`, ADO head `72dc39e` and exact-head run `29692785824`. The exact APK reproduced
  SQLCipher page-1 HMAC/decryption failure on clean first start of the approved
  Galaxy-A33/Android-15 device before authentication after package-scoped backup cleanup, app-data
  clear and a probe with Android Backup Manager disabled. Gate A failed at step 2 before lease
  activation; no Gate-A tag scan occurred and Gates B–E were not started. `DA1-PHYS-01` was opened
  as P1. The run failed closed with zero
  lease/WorkEvent/Receipt/Decision/TimeEntry mutation and completed full local cleanup.
  Focused correction `04399fa7ef8b3e58e44e82a81c0b0757acae1adc`, tree
  `ecf5e6f9f5dbe83d9100deb98ab6126ef7473ead`, removes Expo's second-connection transaction
  boundary for the encrypted store and uses `BEGIN EXCLUSIVE` on one non-cached runtime-owned
  actor connection. It also disables Android application backup and explicitly excludes
  SecureStore, Expo SQLite and Android database domains from legacy backup, cloud backup and
  device transfer. The corrected release APK passes native clean first start and force-stop/cold
  encrypted reopen on the same Galaxy A33; a controlled native diagnostic proves wrong and
  missing keys fail protected without deletion or rebinding. Local verification passes 1,628
  tests, all 15 Workspace typechecks/builds and a 690-task Android release build; exact-head run
  `29695449737` passed ten of ten jobs. Independent exact-delta review bound ADO head
  `76be116a5b3d62298bff5d784213a6da9a446c66`, tree
  `d320db3d77c9352422c73aaff378a4a18ff1396e`, and ten-of-ten run `29695605706`; it returned
  `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-PHYS-01`. The Human Architect then
  authorized a complete fresh restart on product `04399fa`, ADO head `fb4a4e4` and exact-head run
  `29696026676`. Fresh setup and a clean Employee install produced one complete Employee lease
  with two declared and two stored items. After airplane mode, removal of both Auth/API reverse
  mappings and force-stop/relaunch, the app showed `TapTim.e ist derzeit nicht verfügbar` instead
  of the mandatory explicit offline-capture state. Gate A failed at step 4 without a tag scan or
  lifecycle mutation; Gates B–E were not started and no observation from either failed attempt may
  be reused. Focused correction `e17fcb3f1286095c345e6a4ce965790361901099`, tree
  `44320bc8bb5a25b71300c03d8d50c5a8561ebf0a`, suspends access authority while retaining only
  the stored refresh path, retries that path through the existing single-flight boundary, exposes
  the scan shell only for `context_unavailable` plus an independently validated eligible offline
  capture state, and retries session restoration before foreground/network scheduling. Follow-up
  hardening `869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`, tree
  `325fdd5b003e1bccaee15eeac6b0b82826316554`, binds local-lease consultation to restoration from
  stored credentials or a previously resolved session; explicit new login plus unavailable
  backend context remains closed. Local verification passes Mobile 406/406 in 29 files, focused
  regressions 93/93, all required typechecks/builds, Android export, `git diff --check` and a
  690-task native release build. The uninstalled candidate APK is 95,418,203 bytes with SHA-256
  `0f2e0ea9385dd34ecd3f24da4970d11ab50df77f44debf82d5b0009e7dfa44c5`. Exact-head runs
  `29696949408` and `29697397146`, each attempt 1, passed ten of ten jobs. Independent exact-delta
  review bound final reviewed head `8d1a0d86539790028526e8d62c1f867c1b68fe57`, tree
  `3464697130900ed55e68acc02e5fb5af41db90a5`, the complete 17-file +515/-75 delta and all four
  exact-head runs. It returned `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-PHYS-02` as
  a repository finding. The Human Architect then authorized the third complete fresh Gate A–E run
  against product `869e10f`, reviewed ADO head `8d1a0d8`, synchronization head `bc89c70`,
  exact-head run `29697976617` and the exact hash-bound APK. Gates A–C passed. Gate D's server
  evidence passed, including `historical_configuration_not_valid` and
  `predecessor_requires_review` without unauthorized canonical mutation, but Mobile later replaced
  `Sichere Prüfung erforderlich` with `Bereit zum Scannen` after exact queue acknowledgement.
  Gate D therefore failed with `DA1-PHYS-03` (P1); Gate E was not started and abort cleanup passed.
  Focused correction `7dbda3bc0a56009c7e6931e3ad8320514f64f4a8`, tree
  `e6abc9ebaadc70cf4b2f78caa46f332b3fb21309`, persists the earliest review sequence atomically in
  encrypted owner-bound schema version 2 and makes it dominate later scheduler/coordinator ready
  states. Mobile passes 409/409; required verification and the native release build pass; exact-head
  run `29700339367` passed ten of ten jobs. Independent exact-delta review bound final reviewed ADO
  head `798bada77a4fbc7ba235bc692afcf3bd9ffc760b`, tree
  `d181370ca6e2199ca76d46313ad57113c52cd100`, the exact 14-file +557/-63 delta and exact-head
  runs `29700339367` and `29700546787`, each ten of ten green. It returned `APPROVED` with zero
  open P0/P1/P2/P3 and closed `DA1-PHYS-03` as a repository finding.

  The Human Architect then separately authorized the fourth complete fresh Gate A–E run bound to
  product `7dbda3bc0a56009c7e6931e3ad8320514f64f4a8`, reviewed ADO head
  `798bada77a4fbc7ba235bc692afcf3bd9ffc760b`, review-synchronization head
  `73b5105ba23f667c2a6ee0f12fce171da85bb036`, exact-head run `29714165784` and the exact
  95,422,571-byte APK SHA-256
  `e634f03a0eedf43a3c1d2d7d94213c223ea13c627556e641e39c9d08c4f93623`.
  A technical preflight that had unnecessarily armed a legacy fixture control was fully destroyed
  and verified clean before the counted run began. Fresh setup, Employee lease and
  cold true-offline entry passed Gate A steps 1–4. At step 5, three separate physical captures each
  completed native registration, Android `TECH_DISCOVERED` delivery through `onNewIntent`, resume
  and unregistration, but the encrypted queue remained zero. Read-only diagnosis shows that the NFC
  foreground transition triggers an offline context retry; publication of the semantically
  unchanged suspended session advances the coordinator generation and invalidates the delivered
  capture before lookup/append. This is `DA1-PHYS-04` (P1). Gate A failed, Gates B–E were not
  started, no observation may be reused and complete abort cleanup passed. The failure remained
  closed with no persistence claim, server mutation, authority escalation or sensitive disclosure.
  Production resources/data, deployment and distribution remain unauthorized. DT-060–DT-062
  remain open until every later gate passes.

  Independent read-only review subsequently bound failure-synchronization head
  `3dd798376180051c0dbd8d9e4ee058acff89b43f`, tree
  `e78b5268eb53fd5659461ee290778f7bf3bb70a0`, its seven-ADO-file delta and exact-head run
  `29716007657`, attempt 1, ten of ten jobs successful. Verdict `APPROVED` with no P0–P3 against
  the failure truth, diagnosis, P1 classification or focused boundary; `DA1-PHYS-04` remained open.
  The Human Architect then separately authorized that correction on the exact reviewed baseline.

  The Technical-Lead-approved correction adds a private credential-free restoration
  snapshot of session generation, restoration revision and trusted failure source. An unchanged
  retry publication preserves that snapshot; credential acceptance, authority/context source
  change, storage failure, logout or identity invalidation rotates it. The offline coordinator
  preserves one active offline scan only while the private snapshot remains current, retains the
  complete expected owner/install/lease context and revalidates both before durable append.
  Public `context_unavailable` equality cannot preserve a capture. Cross-identity, owner/install,
  storage and genuinely stale asynchronous paths remain fail-closed.

  The final Technical-Lead Mobile run passes 415/415 in 30 files. Focused Mobile tests pass 63/63
  and the hardened four-test lifecycle subset passed 4/4 in twenty consecutive runs. Core
  290/290, Admin Web 44/44, Offline Contract 7/7,
  Administration Contract 4/4, Backend Offline 13/13 and Backend API 208/208 pass. The fixed
  loopback-only Gate-C helper passes 27/27 focused tests; a fresh PostgreSQL-17 Harness run passes
  45/45 in four files. The helper tests-inclusive typecheck/build and all applicable Workspace
  checks/builds,
  migrations 001–010 apply/rerun/ledger verification, Android export, a 656-task synthetic release
  and backup-boundary verification pass. The uninstalled 95,425,607-byte APK has SHA-256
  `b34572b9813c4fb8013b09a4a530e5bc88ed4730ceacda46f6fe682bca88c6c0`. The dependency audit
  still reports the existing 11 moderate transitive `uuid@7.0.3` toolchain occurrences. None of
  this is a corrected physical observation.

  The correction is published as commit
  `48a21a7ed75c3ab3b15fec93669b5ca2d87d5a30`, tree
  `7c053beeb0c9ef550216bd1dad0a59fc226866a6`, exact parent
  `3dd798376180051c0dbd8d9e4ee058acff89b43f`, with an exact 24-file `+3027/-37` delta.
  GitHub Actions run `29743923158`, attempt 1, push to `main`, is bound to that exact head and
  passed ten of ten jobs. ADO publication head
  `2f6035b1da9e7946cfca8d10c3d406a8c0b852ec`, tree
  `d5513a6ec2fe99c4f2b6fae9b3452004453b965b`, passed exact-head run `29744637928`, attempt 1,
  ten of ten.

  Independent exact-delta correction review verified both exact deltas and CI runs, reproduced
  Mobile 415/415, the lifecycle regression and Gate-C helper, and returned `APPROVED` with zero
  open P0/P1/P2/P3. `DA1-PHYS-04` is closed as a repository finding. The fourth failed physical
  run remains historical and no corrected physical result exists.

  The first fifth-gate authorization failed closed before installation because its exact binary was
  no longer retained. The replacement synchronization `e0fd175`, tree `fed47cf`, passed exact-head
  run `29747561139` ten of ten; independent review returned `APPROVED` with zero open P0–P3 and
  closed `DA1-ARTIFACT-01` for its rebinding scope. The Human Architect separately authorized the
  exact-size 95,425,607-byte replacement SHA-256 `4239f6c6…6b7c`.

  Immediate host/device size and hash, APK-v2 signature, package/version, backup boundary, USB and
  loopback checks passed. On first launch before login, the exact APK displayed the disclosure-safe
  runtime-configuration unavailable state. Hermes inspection proved both required numeric-loopback
  URLs and the required publishable key absent from the binary while the unchanged repository build
  script still declares them. All mutable server counts remained zero; the app, Harness, roles,
  schema, database, mappings, listeners and clipboard were completely cleaned.

  At that point `DA1-ARTIFACT-02` was an operational P1. It did not reopen the closed product
  finding `DA1-PHYS-04`, but it blocked every later DA1 gate until a runtime-complete exact-source
  artifact received deterministic binary verification, publication/CI, independent review and new
  Human authorization.

  Independent review approved failure synchronization `d6cc071`, tree `765b8a2`, and its exact-head
  run `29749902585` without closing the operational P1. The Human Architect then authorized only
  the focused correction. Technical-Lead-approved commit
  `0fdddbce53369e3c73f345eee1c077226a40797f`, tree
  `62b5efc4efd36da1fbd0e6f2058a448aabd1ab1a`, centralizes the exact synthetic runtime contract,
  forces a clean release through a single-use Gradle process and makes both build and install reject
  an APK unless exactly one Hermes bundle contains the required Auth URL, API URL and publishable
  key. Install verification runs before any ADB action. The correction changes exactly nine Mobile
  build/script/test files (`+240/-10`) and no product-runtime, backend, migration, UI or policy
  source. Core 290/290, Mobile 419/419, Admin Web 44/44, Offline Contract 7/7, applicable
  tests-inclusive typechecks/builds and two clean native releases pass; exact-head run
  `29751390803`, attempt 1, passed ten of ten jobs.

  A final clean build from exact commit `0fdddbc` is preserved read-only outside the repository:
  95,425,695 bytes, SHA-256
  `aa081fca431174cf90698b4afaaa5c1f5f28ed976c54cda7a74df72a49d5ffbf`,
  package `com.tim180201.mobile.synthetic`, version 1/1.0.0, valid APK-v2 signature and verified
  offline backup/transfer boundaries. Deterministic Hermes inspection proves all three required
  values. The prior failed APK remains separately immutable and is rejected by the new verifier for
  all three missing values. At that point the replacement was not installed.

  Independent exact-delta/artifact final review bound correction `0fdddbc`, tree `62b5efc`, ADO
  head `1527855b3db4bf387e4efc9e09691a15d588408b`, tree
  `1bc2511a540944901e10566fca914f1fab70ee13`, and exact-head runs `29751390803` plus
  `29752205717` attempt 2. It returned `APPROVED` with zero open P0/P1/P2/P3 and closed
  `DA1-ARTIFACT-02` as an artifact-pipeline finding. The reviewer independently reproduced Mobile
  419/419 but transparently could not mount either external APK. The Technical Lead subsequently
  reverified both immutable files locally: exact size/hash/mode, rejection of the failed APK for all
  three values, complete Hermes contract in the new APK, v2 signature/signer, package/version and
  manifest backup bindings. The Human Architect subsequently authorized the sixth complete fresh
  Gate A–E run on exact review-synchronization `0e2590b`, tree `23fc9d3`, run `29830332699` and
  the exact corrected APK. All Gates A–E passed afresh and full safe cleanup passed. Physical
  publication `8d5b2bb`, tree `592f9da`, passed exact-head run `29836085810` ten of ten. The
  independent final closure review verified the exact seven-file `+297/-75` delta, all Gates A–E,
  counts, disclosure boundary and cleanup, and returned `APPROVED` with zero open P0/P1/P2/P3.
  Closure publication `715889e`, tree `b9fc3ac`, passed exact-head run `29837556200`, attempt 1,
  ten of ten. Development Assignment 1 and DT-060–DT-062 are therefore completed for the
  authorized local Android/repository/synthetic-server scope.
  Evidence: `ADO/01_Architecture/ADR/ADR-0012-complete-offline-synchronization-platform.md`,
  `ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md`;
  `ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Implementation_Plan.md`;
  `ADO/05_Evidence/Development_Assignment_01_Independent_Pre_Implementation_Review.md`;
  `ADO/05_Evidence/Development_Assignment_01_Implementation_Evidence.md`;
  `ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md`;
  `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_03_Independent_Exact_Delta_Review.md`;
  `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Failure_Synchronization_Independent_Exact_Delta_Review.md`;
  `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Independent_Exact_Delta_Review.md`;
  `ADO/05_Evidence/Development_Assignment_01_DA1_ARTIFACT_02_Independent_Exact_Delta_Artifact_Review.md`;
  `ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md`;
  `ADO/05_Evidence/Development_Assignment_01_Independent_Final_Closure_Review.md`;
  `ADO/05_Evidence/Development_Assignment_01_Closure_Evidence.md`;
  `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_02_Independent_Exact_Delta_Review.md`; and
  `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md`.
- The Business Core (NFC scan through Assignment Resolution, Assignment Validation, WorkEvent creation, Business Engine decision, TimeEntry lifecycle, offline queue, durable local persistence and error classification) is implemented and tested: 290 `packages/core` tests pass (262 existing plus 26 ADR-0009 codec cases and two explicit required-display-name contract/persistence cases); the expanded Mobile suite passes 419 tests in 31 files, including physical-validation, synthetic-E2E product-composition, E1/E2A compatibility, the complete offline lease/database/queue/scheduler/reconciliation boundaries, the SQLCipher actor-connection regression, durable review-marker dominance, fail-closed cold-start restoration/shell/cross-identity boundaries and build-enforced runtime-artifact completeness; tests are included in the TypeScript check; the Core and workspace builds succeed.
- **Core Roadmap v2 Block A is complete.** The Human Architect approved F-01's engine-driven lifecycle rule; `TimeEntry` now has typed started/stopped states and WorkEvent traceability; repositories support user-aware active lookup and updates; the Business Engine handles start, stop, duplicate suppression (`< 5 seconds`), other-target rejection and inconsistent-state escalation; GitHub Actions runs install/typecheck/test/build on pushes and pull requests to `main`. Implementation commits: `f5a0027`, `d8d3833`, `72eb03d`; enabling commits: `2493f17`, `b2004ea`. Closure evidence: `ADO/02_Development/Block_A_Core_Truth_and_Reliability_Closure.md`.
- **ADR-0008 is approved after independent security review and renewed Technical Lead verification; phased Block B implementation is authorized.** The approved baseline is Supabase-managed PostgreSQL/Auth, managed Node as primary transactional lifecycle runtime, pooled-schema RLS/composite tenant constraints, one active Membership per User, email/password-only v1 authentication, audited operator bootstrap and identity-first pilot provisioning. Conflict, device-time and pre-revocation evidence use explicit deferred/review paths rather than silent mutation. Central EU (Frankfurt) is the intended initial region. No production personal data is authorized until legal retention/erasure/anonymization and backup requirements are approved. No production backend or cloud resource exists; the disposable B1 result is recorded below.
- **Block B1 is completed and Technical-Lead approved.** Two review rounds corrected broad mutation rights, Organization-only visibility, privileged runtime use and cross-User referential manipulation. WorkEvent/TimeEntry unique keys and every TimeEntry/Decision/Receipt/Audit foreign key are User- and Organization-qualified; immutable evidence has operation-specific grants; runtime uses a separate non-owner/non-superuser login. Direct PostgreSQL 17.10 passes 39 tests locally and in GitHub Actions run `29220424071`, including cross-User `23503` rejection; two Supavisor modes remain explicitly unverified and are a pre-production gate. No production backend adapter, HTTP API, Auth integration or cloud resource exists.
- **Block B2 Async-Port Migration is completed and Technical-Lead approved; B3 is authorized.** All twelve effectful Core ports now expose exact Promise contracts; in-memory/file/fake/CLI/Mobile adapters, Application Services, repository-dependent resolvers/validators, composition roots and tests await their effects explicitly. A Technical Lead follow-up replaced the native adapter's buffered `scan()` with a real awaited NFC capture. `BusinessEngine`, `WorkEventFactory`, `MembershipAuthorizationValidator`, Domain objects, classifiers and presenters remain synchronous. Core retains 262 tests, Mobile retains 10 tests and the B1 direct-PostgreSQL regression retains 39 passing tests with 2 unverified Supavisor modes locally and in GitHub Actions run `29221790966`. No productive backend adapter, API, cloud integration, dependency or Business Rule was added. Evidence: `ADO/05_Evidence/Block_B2_Async_Port_Migration_Evidence.md`.
- **Block B3 Versioned Server Schema, Constraints and RLS is completed after Technical Lead, CI and independent security approval; B4 identity binding plus Membership resolution is authorized next.** A separate `@taptime/backend-schema` workspace contains three deterministic PostgreSQL 17 migrations, a checksum/version ledger, twelve logical server tables, Organization/User/AssignmentTarget-qualified integrity, exact five-way Core Decision shapes, reciprocal deferred TimeEntry/Decision traceability, exact Start/Stop WorkEvent timestamps, hardened SyncReceipt shapes, active-Membership gates, least-privilege grants, atomic administrative AuditEvents, append-only attempts, forced RLS with 45 policies and a current 125-test two-tenant matrix. Three Technical-Lead attack rounds closed all blocking findings; implementation commit `903917c` passed GitHub Actions runs `29243934150` and `29244042186`; the independent Claude review returned `APPROVED` with no blockers. Its P2 findings are dispositioned in the B3 closure, including the mandatory future rule that canonical Decisions are derived only from server-side `BusinessEngine.evaluate()`. No production adapter/API/Auth/cloud resource, real data, retention rule, clock/grace threshold or Business Rule was added. Evidence: `ADO/02_Development/Block_B3_Versioned_Server_Schema_Closure.md` and `ADO/05_Evidence/Block_B3_Independent_Architecture_Security_Review.md`.
- **Block B4 Identity Binding and Authoritative Membership Resolution is completed after Technical Lead, GitHub CI and independent security approval; B5 was authorized as its next slice.** Additive migration `004` normalizes even an existing resolver role to least privilege, removes all resolver parent roles and preserves its execute-only grant surface. Synthetic B3/B4 logins are reset to exact intended `pg_auth_members` graphs. The isolated Node 24 verifier binds JWKS exactly to `<issuer>/.well-known/jwks.json`, requires HTTPS outside numeric loopback test infrastructure, passes only issuer/subject to PostgreSQL, derives User/Organization/Membership/current role exclusively from active server records and rejects requested-Organization mismatch. Fifty-five B4 and 125 B3 local adversarial tests pass; implementation commit `570fc0b` passed GitHub Actions run `29261459523`; the independent Claude review returned `APPROVED` with no P0/P1 findings. The Context helper is explicitly propagation-only. The Human Architect authorized B5 only as the narrow read-only Organization/config adapter slice; it must enforce active Membership and restricted role/RLS in its tenant transaction and may not add writes, HTTP or B6 ingestion. Evidence: `ADO/02_Development/Block_B4_Identity_Binding_Membership_Resolution_Closure.md` and `ADO/05_Evidence/Block_B4_Independent_Architecture_Security_Review.md`.
- **Block B5 Tenant-safe Read-only Organization/Config Adapter is completed after Technical Lead, GitHub CI and independent security approval; B6 is separately authorized next.** The isolated `@taptime/backend-read-model` Node 24 workspace accepts only a raw access token plus requested Organization, uses the existing concrete B4 asymmetric verifier, resolves current IdentityBinding/Membership in the same `READ COMMITTED READ ONLY` transaction, selects only a fixed Employee/Administrator role and exposes exactly five tenant-qualified `Pick` readers under existing B3 RLS. The callback receives no Actor authority, role selector, Pool/Client, raw query, list or write method; reader capabilities expire when the callback settles. The Technical Lead closed one pre-publication pool-capability lifetime defect. Forty-two direct PostgreSQL/JWT tests prove Employee/Admin reads, same-Organization and cross-tenant denial, forged-claim irrelevance, downgrade/revocation visibility, injection safety, capability expiry and commit/rejection/rollback cleanup. Implementation commit `68b7f44` passed all five jobs in GitHub Actions run `29264083804`; the independent Claude review returned `APPROVED` with no P0/P1 findings. The Human Architect subsequently authorized B6 only as the server-canonical lifecycle-ingestion slice recorded in `ADO/02_Development/Block_B6_Server_Canonical_Lifecycle_Ingestion_Authorization.md`. Migrations `001`–`004` and Core Domain/Business/ports remain unchanged.
- **Block B6 Server-canonical Lifecycle Ingestion is completed after Technical Lead, GitHub CI and independent security approval; C1 is now separately authorized.** The isolated `@taptime/backend-lifecycle` Node 24 workspace takes only raw token, requested Organization, WorkEvent NFC evidence and Receipt metadata. One cohesive transaction uses the concrete B4 verifier, migration `005` authority/configuration row locks, transaction-local context, fixed lifecycle role, per-Organization/User xact advisory lock, active-TimeEntry row lock and the unchanged Core `BusinessEngine.evaluate()`. It atomically persists the exact five-way WorkEvent/TimeEntry/CanonicalDecision/SyncReceipt/Audit mapping, or a truthful deferred/conflict/rejection result. Sixty-eight direct PostgreSQL/JWT tests pass locally, including five result branches, Start/Stop/Start, retries, fixed event-time validity starts, historical-deferred retry, every write-stage rollback, cross-tenant/User guessing, authority/config races and pooled cleanup. Implementation commit `9531672` passed all six jobs in GitHub Actions run `29269282536`; the independent review returned `APPROVED`. Migrations `001`–`004` and Core/Mobile product code remain byte-for-byte unchanged. Evidence: `ADO/02_Development/Block_B6_Server_Canonical_Lifecycle_Ingestion_Closure.md` and `ADO/05_Evidence/Block_B6_Independent_Architecture_Security_Review.md`.
- **Blocks C1 and C2 are completed after Technical Lead, GitHub CI and independent security approval.** The private Node 24 workspace is `@taptime/backend-api` and exposes exactly session, B5-backed scan-context resolution and B6-backed lifecycle ingestion. Three distinct least-privilege pools/logins, one B4 issuer, strict bounded transport and disclosure-safe outcomes preserve B6/Core as the only lifecycle Decision path. Private Mobile clients keep tokens outside React, share at most one refresh/session re-resolution and retry once. Independent review found no P0/P1; its sole P2 was corrected with Expo native response streaming, incremental 16-KiB enforcement and cancellation evidence. Implementation commit `9f5b127` passed all seven jobs in run `29314305059`; direct C2 evidence remains 127 API, 154 Mobile, B4/B5/B6 55/42/68 and Core 262. Evidence: `ADO/02_Development/Block_C2_Authenticated_Server_Transport_Foundation_Closure.md` and `ADO/05_Evidence/Block_C2_Independent_Architecture_Security_Review.md`.
- **Block D is completed after Technical-Lead, GitHub-CI, Human physical-device and independent architecture/security approval.** The actual Android `RnNfcScanAdapter.scan()` drives the authenticated product path through one shared ADR-0009 codec, private C2 resolution/lifecycle clients and the server-owned Business Engine result. Capture is single-flight with a 20-second timeout, explicit cancellation, native-discovery timestamp binding, session/User/Organization/Membership-generation invalidation and race-safe cleanup. Block D originally retained ambiguous evidence in volatile identity-bound memory; E1 now supersedes only that storage limitation. The functional `ScanScreen` receives only a frozen state/action facade. Technical Lead review corrected the native registration/cancel race, post-cleanup timestamping and cross-identity evidence loss. Independent review of `4f540ca..ac5eeba` returned `APPROVED WITH NON-BLOCKING FINDINGS`, no P0/P1/P2 and one corrected documentation-only P3. Evidence: `ADO/02_Development/Block_D_NFC_Runtime_Physical_Validation_Closure.md`, `ADO/05_Evidence/Block_D_NFC_Runtime_Physical_Validation_Evidence.md` and `ADO/05_Evidence/Block_D_Independent_Architecture_Security_Review.md`.
- **Block E1 Durable Lifecycle Evidence Outbox is completed after Technical-Lead, GitHub-CI and independent security approval.** The product Mobile path persists one exact server-ready `LifecycleEventCommand` in a private platform-secure native record before first lifecycle submission, restores it after process restart, binds replay to the originating User/Organization and clears only the matching record after a definitive server result. Storage failure blocks new scans; no token, raw UID or client decision is persisted. Independent review returned `APPROVED WITH NON-BLOCKING FINDINGS`: five P3 observations, no P0/P1/P2. Corrections add start-generation and owning-runtime race safety, process-local cross-adapter serialization, a 2-KiB cap, accurate iOS/Android storage semantics, truthful persistent-failure support guidance and final-HEAD CI evidence. E1's implementation/governance/correction runs passed, and closure-publication commit `9f2f922` passed all eight jobs in run `29344464075`. E1 advanced but did not complete DT-060–DT-062. Offline scan-context fallback/cache remained open after E1; E2A now adds only one volatile same-session context, while durable multi-context caching, a multi-event queue, scheduler/backoff, supported reconciliation and background synchronization remain open. Evidence: `ADO/02_Development/Block_E1_Durable_Lifecycle_Evidence_Outbox_Closure.md`, `ADO/05_Evidence/Block_E1_Durable_Lifecycle_Evidence_Outbox_Security_Review.md` and `ADO/05_Evidence/Block_E1_Independent_Architecture_Security_Review.md`.
- **Block E2A Warm-Session Deferred Offline Capture is completed after Technical-Lead, GitHub CI, Human physical Android and independent security approval.** Every scan still attempts live C2 resolution first. Only a transient failure may use one exact volatile context from the same session generation, Membership, role and payload. Cached-context evidence is persisted before send and reaches a dedicated defer-only endpoint whose durable branch revalidates current locked Membership and exact active configuration, then writes WorkEvent, `received` Receipt and Audit without BusinessEngine, CanonicalDecision or TimeEntry mutation. Version-1 Membership-unknown evidence remains protected. Core 288, Mobile 310, lifecycle 88, API 139 and synthetic E2E 6 passed; implementation commit `4b5ecdc` passed all eight jobs in run `29348512506`. On Galaxy A33 / Android 15, removing only C2 reverse `tcp:3000` after an online Start produced truthful pending copy, survived force-stop/restart and ended after exact explicit retry with 2 WorkEvents/2 Receipts/4 Audits but only 1 Decision, 1 still-started TimeEntry and 0 stops. Cleanup removed the schema, roles and reverse mappings. Independent final review returned `APPROVED`; E2A-FINAL-01's publication-sync P3 was corrected during review and no P0/P1/P2/P3 remains open. This is controlled warm-session C2 transport-loss evidence, not airplane mode or full offline. DT-060–DT-062 and Block E stay open. Evidence: ADR-0010, authorization/plan, closure, implementation and final reviews, physical evidence and Technical-Lead security review.
- **E2A closure publication is CI-verified.** Governance commit `de03a71` passed all eight jobs in
  GitHub Actions run `29351043179`; this publication fact changes no scope and leaves DT-060–DT-062
  plus Block E open.
- **C3A Organization Administration Architecture is accepted; C3B and C3C repository implementation
  are completed.** FB-002 v1.2 and TS-002 v1.3 reconcile
  DT-017–DT-026 with B3–C2. ADR-0011 establishes a private
  operator-only first Organization/Admin bootstrap, a distinct least-privilege normal Admin write
  session, durable command receipts, `assignment_target_unavailable`, Organization-scoped canonical
  payload uniqueness, append-only Assignment history and required Customer/Tag display names with
  safe fingerprint presentation. The first independent pass rejected 3 P1/6 P2/2 P3, the second
  required changes for 2 P2/3 P3, and the governance scan added 1 P2/1 P3. Every finding was corrected;
  final independent re-review passed with zero open P0/P1/P2/P3 and the Human Architect accepted the
  direction. C3B was separately authorized on baseline `f7d3855`; implementation commit `e10fcaf`
  passed its 188-test matrix, independent final review and all nine exact-head GitHub CI jobs in run
  `29363513529`. C3C was explicitly authorized on baseline `c1148d57`; migration `007`,
  least-privilege setup coordinator/pool, exact three-route API and safe projection pass the full
  1,394-test Node-24/PostgreSQL-17 regression plus workspace typechecks/builds and Android export.
  Every implementation/precommit finding reported so far was corrected, including receipt/resource
  binding, race, fail-closed normalization and C3B-owner compatibility. Implementation commit
  `b90729a0a4b325f523cd98ea5a741defb00155f6`, tree
  `671be72784f68b9437a9f53e251acbbb22ce3e97`, passed three independent exact-SHA final-review tracks
  with zero open P0/P1/P2/P3 and all ten jobs in exact-head GitHub Actions run `29375259275`. C3C is
  therefore closed for its repository scope. Its distinct ADO-only closure-publication commit
  `9c79c6d2f2166d22cc61bfbc03ba79c434bbbfe0` passed all ten jobs in exact-head run `29376668158`.
  C3D was subsequently authorized and implemented; its original correction passed independent
  delta review and exact-head ten-job CI at `293a0f4`, and C3D-LOOPBACK-01 did so at `ad64cec`.
  C3D-CORS-01/C3D-FETCH-01 correction `e686578` subsequently passed independent zero-finding
  review and exact-head ten-job CI, and the complete Human physical gate passed. C3E1 correction
  `450d767` passed zero-finding independent delta re-review and exact-head ten-job run `29416554531`.
  Harness correction `4338910` passed zero-finding independent delta re-review and exact-head run
  `29420832927`; the complete fresh Human physical gate then passed. Closure commit `fe0781b` passed
  exact-head run `29645336694` and independent final review with zero open P0/P1/P2/P3. The C3E2
  authorization contract at `dbefc1c` passed independent zero-finding review and exact-head ten-job
  run `29646684981`; Sections 3–13 are Human-accepted, and a later separate repository release on
  baseline `5bc4951` produced the locally verified candidate. Its commit/CI/review/physical gates
  remain pending. Production deployment remains unauthorized.
  Evidence: `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Closure.md`,
  `ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md` and
  `ADO/05_Evidence/Block_C3C_Independent_Architecture_Security_Review.md`.
  Its feasibility review corrected `taptime-name-v1` to PostgreSQL-17-authoritative Unicode 15.1
  and made the privileged operator-attestation trust plus external IAM/TLS gates explicit.
- **The internal physical-validation APK passed its device-local physical checklist on a Samsung Galaxy A33 5G running Android 15 with two NTAG213 tags.** Both tags produced ten stable and distinct shortened fingerprints; disabled NFC, timeout without counter mutation, explicit cancel, scan-after-cleanup and rapid duplicate coalescing behaved as designed. A tag presented outside an explicit capture produced Android's external `Aktion wählen` prompt and no TapTim.e counter change. No raw UID, token or provider error was disclosed; the tester's initial uncertainty about the unlabeled 12-character hash produced a real UX correction that now labels it explicitly as a shortened SHA-256 validation fingerprint. Follow-up commit `56790c2` passed all seven jobs in run `29324366418`; EAS build `6969b72b-8f01-496e-95ff-4e481019bdf8` produced integrity-verified Android build 2. This is device evidence, not Block-G distribution, broad pilot-fleet coverage or production deployment.
- **The synthetic server-connected Android E2E harness and physical product run passed after six blocking Technical-Lead corrections.** USB `adb reverse` kept the distinct synthetic APK's Auth and C2 access on numeric loopback without LAN/tunnel/cloud. A per-run scrypt password plus ephemeral RS256/JWKS drove the real Mobile auth adapter; real C2/B4/B5/B6/Core and PostgreSQL migrations `001`–`005` remained authoritative. Five automated tests comprise exactly three direct PostgreSQL integration cases and two non-database safety/source guards. Correction commit `59c4ac7` passed all eight jobs in run `29333578360`. The 66-MB APK installed on `SM_A336B`; physical Tag B showed `Tag nicht zugeordnet`, fingerprint-bound Tag-A provisioning produced 1 Tag/Assignment and 2 AuditEvents with zero lifecycle evidence, and the next scans showed `Arbeitszeit gestartet` then `Arbeitszeit gestoppt`. Final state was 2 WorkEvents/Decisions/Receipts, 1 stopped TimeEntry and 4 AuditEvents. Normal shutdown and scoped disconnect left an empty reverse table. No raw UID, token, database/provider error or real person data was displayed. Independent D-FINAL-01 corrected only the previous test-count wording; no code/security blocker remains.
- Development Sprint 011 was the first Development Sprint planned directly against EP-009 Product Readiness priorities: it evaluated and deliberately did not target Organization Management (the higher-ranked priority per Product Readiness Assessment Section 11.1) because no Feature Blueprint exists for it, implementing Real NFC Hardware Integration (DT-016) instead — see `Development_Sprint_011_Plan.md` Section 3 and `Development_Sprint_011_Closure.md`.
- **FB-002 v1.2, TS-002 v1.3 and ADR-0011 are accepted after C3A reconciliation, C3B and the exact C3C amendment.** DT-017–DT-026 remain complete as the Core/test foundation. ADR-0008/B3–C2 supply the real identity, tenant, persistence and transport context that the 2026-07-07 drafts intentionally lacked. C3B's isolated bootstrap CLI/migration passed Technical-Lead verification, independent final review and exact-head nine-job CI. The normal Admin setup backend/API is closed as repository implementation after exact-SHA review and exact-head ten-job CI. C3D supplies the first setup UI and protected Android capture; all corrections passed independent review/exact-head CI and the controlled operational Human setup-flow proof passed.
- **EP-009 has an accepted additive evidence-triggered reassessment on the 2026-07-15 C3C baseline.** The 2026-07-07 Assessment/Roadmap remain immutable chronology. K1–K5 and K7–K9 are closed for their approved repository/device scopes; K6, K10 and K12 remain open, while K11 has advanced to internal EAS/APK evidence but not pilot/store distribution. Engineering remains Established; Product, Deployment, Technical Operations, Customer and Scaling are Developing; Business, Commercial, Legal/Compliance and Support remain Emerging. Independent final review approved the complete reassessment and the Human Architect accepted it on 2026-07-15. No production or market validation is claimed.
- The Product Readiness Assessment and Product Readiness Roadmap (2026-07-07) have completed Technical Lead review, including a seven-change follow-up revision. **EP-009 – Product Readiness Framework** is now Active, formally establishing Product Readiness as a permanent, continuously-reassessed governance activity alongside Development Sprints and EP-008 — see `ADO/02_Development/EP-009_Product_Readiness_Framework.md`.
- **Historical external CTO snapshot (2026-07-10).** At review time, the repository was correctly
  classified as a Core Prototype with K1–K12 covering demo composition, bypassed native capture,
  missing Stop, fake Auth, absent backend/tenant/sync, synchronous ports, absent CI/typechecked tests,
  non-crash-safe legacy file persistence, distribution and legal readiness. The review recommended no
  rewrite and produced Core Roadmap v2 plus the calendar-based readiness ranges. See
  `ADO/05_Evidence/External_CTO_Review_Triage_2026-07-10.md`; these statements are provenance, not the
  current implementation baseline.
- **Current disposition (2026-07-18).** Blocks A, B1–B6, C1/C2 and D closed the recorded K1–K5 and
  K7–K9 engineering gaps for their approved scopes. E1/E2A advance but do not complete K6/full
  synchronization; legacy persistence/recovery risk, product distribution and K12 legal/privacy work
  remain open. C3C repository implementation and its exact-head CI-verified ADO closure publication
  are complete. C3D's reviewed/CI-verified browser-runtime correction and complete fresh physical
  closure passed; C3E1's product/harness/physical/ADO closure is independently approved and
  exact-head CI-green. C3E2 final implementation head `7050df4`, tree `587ef8f`, passed exact-head
  ten-job run `29649683173` and independent implementation review with zero open P0–P3. Its complete
  fresh Human gate passed with exact A→B historical attribution and full cleanup. ADO closure commit
  `a2fdebc`, tree `1872f9f`, passed exact-head ten-job run `29652072268`; independent final review
  returned `APPROVED` with zero open P0–P3. C3E2 is independently closed for its authorized local
  repository/device scope. Blocks E–I remain governed by Core Roadmap v2 and their outstanding
  review/CI/authorization gates.
- Repository Health Sprint 001 and Repository Maintenance Sprint 002 are completed; known repository consistency findings from that era have been closed or explicitly logged as remaining findings for Technical Lead disposition.
- `frogs-zeiterfassung` remains technical reference evidence, not a source code baseline.
- Root `README.md`, `CHANGELOG.md`, and `Roadmap.md` still describe a pre-Sprint-001 repository state and have not yet been refreshed — this is a known, already-tracked finding (Product Readiness Roadmap, "Now" milestone, Engineering Track), not an oversight of this update.

## Current Epics

Two Epics are concurrently Active, per EP-009's own stated relationship to the rest of the repository (`EP-009_Product_Readiness_Framework.md` Section 2):

- **EP-008 – Developer Implementation Manual** (guidance track, historical Sprint-001–019 narrative plus Human-accepted Block-boundary reconciliation through C3D/E2A; Chapters 04–10 not yet written) and the **Roadmap v2 implementation track** — Development Sprints 001–019 and Core Roadmap v2 Blocks A, B1–B6, C1/C2, C3B, C3C, C3D, C3E1, C3E2 and D are complete for their recorded repository/Human-gate scopes. E1 and the narrow E2A slice are complete after Technical-Lead, eight-job CI, Human physical Android and independent final-review approval. C3A passed independent re-review and Human acceptance; C3B passed Technical-Lead, exact-head nine-job CI and independent security. C3C passed Technical-Lead verification, three independent exact-SHA reviews and exact-head ten-job CI; its ADO closure-publication commit also passed exact-head ten-job CI. Every C3D correction passed independent zero-finding review and exact-head ten-job CI; its complete fresh Human physical gate passed on Galaxy A33/NTAG213. C3E1 product correction `450d767`, harness correction `4338910` and closure commit `fe0781b` each passed independent zero-finding review and exact-head ten-job CI; its complete fresh Galaxy A33/NTAG213 Human Gate passed. C3E2 final implementation head `7050df4` and closure commit `a2fdebc` passed zero-finding independent reviews and exact-head ten-job CI; its complete fresh Galaxy-A33/NTAG213 Human Gate passed. DA1 later completed DT-060–DT-062 for its authorized local Android/repository/synthetic-server scope; DA2 implementation `f385814`/tree `48b5ba8` passed exact-head run `29847593708` 11/11 while independent closure review remains open. Block D software, CI, device-local NFC, synthetic server-connected physical Android validation and independent final review are approved/passed for the recorded Galaxy A33/NTAG213 set. The DT-017–DT-026 Core sequence remains complete; its accepted C3 baseline is FB-002 v1.2/TS-002 v1.3/ADR-0011. F-01 is resolved and implemented. DT-016/DT-058's physical Android gate is closed for the approved set; ADR-0008 through ADR-0013 are accepted/approved; DA2 closure remains pending.
- **EP-009 – Product Readiness Framework** (continuous, parallel governance track) — governs Product Readiness domains outside implementation: Technical Operations, Product, Commercial, Legal & Compliance, Deployment, Go-To-Market, Customer, Support and Scaling Readiness (Business Readiness evaluated and deliberately not yet adopted as an official domain, per Product Readiness Assessment Section 13).

### Goals

- Preserve the approved Block D/C3 boundaries and DA1's completed local offline/synchronization
  contract without reopening or duplicating their NFC, identity, setup, lifecycle or tenant
  authority.
- Implement only the Human-accepted DA2 Workstreams A–D on the exact authorized baseline and retain
  every independent review, AVS R3 and scope-exclusion gate.
- Maintain EP-009's Product Readiness Assessment/Roadmap as a continuously-extended baseline (not recreated) as further Development Sprints, architecture decisions, pilot customers or commercial milestones occur.
- Preserve traceability from source code, and from Product Readiness Decisions, back to approved engineering and governance decisions.

### Non-Goals

- No new product strategy, architecture, feature behavior or governance rules from EP-008 or EP-009 (per `ADO/01_Architecture/Developer_Implementation_Manual/00_Introduction.md` and `EP-009_Product_Readiness_Framework.md` Section 8).
- EP-009 does not create implementation work, Feature Blueprints, or Development Tasks.

## Immediate Next Steps

1. Preserve Development Assignment 1 and DT-060–DT-062 as completed only for the exact
   independently approved local Android/repository/synthetic-server scope.
2. Obtain independent exact-SHA implementation review of `f385814`/tree `48b5ba8`; close no DA2/DT
   label before every P0–P3 finding is dispositioned.
3. Keep the real production endpoint/CA, one-human operator IAM inventory, short-lived credential
   delivery/revocation and controlled execution evidence as explicit later deployment gates.
4. Preserve every closed C3B/C3C/C3D/C3E1/C3E2/DA1 boundary and keep implementation,
   production/deployment, DT-063–DT-068 closure and the remaining Block-E setup/export scope behind
   the candidate's independent review and subsequent explicit Human gates.

## Agreed comprehensive Development-assignment sequence

The Human Architect and Technical Lead agreed to group the remaining engineering path into eight
larger Development assignments instead of many micro-sprints. This is planning, not advance
implementation authority. Every assignment retains its own exact scope/baseline, tests and
tests-inclusive typechecks, builds, Technical-Lead audit, focused publication, exact-head CI,
independent review and applicable Human/physical gate:

1. complete offline/synchronization platform;
2. setup and export backend;
3. correction and append-only audit workflow;
4. professional Admin Web productization;
5. professional Mobile productization;
6. production-like platform, security, observability, backup/recovery and operations;
7. app build, signing and distribution; and
8. public website plus final cross-surface hardening.

The grouping reduces coordination overhead only. It does not combine privileged boundaries without
review, lower test depth, bypass security gates or turn production/deployment/personal-data work
into implicit authority.
