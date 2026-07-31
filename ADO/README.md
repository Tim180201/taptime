# TapTim.e ADO

Status: Draft Navigation Entry Point  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect

## Purpose

### Current DA5 V5 run-18 fingerprint-transfer success and Product boundary

Separately authorized Phase-0 run 18 successfully established the disclosure-safe fingerprint
transfer binding on ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30`, tree
`e2970d1851ab55f99ff7a027e6268ec4b7622643`. It reverified Validation Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c`, tree
`b32af38c8ac769965ab062762004312d96d0de25`, and Validation Execution
`be76ce4a69c8a971ad73b5232082a9e500d8d471`, tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`, then confirmed the authorized device/UI,
10×A+10×B+10×X with 10/10 for every role, `NfcA`, final UI `PASS`, terminal cleanup and exit 0.
The transferred 12-uppercase-hex fingerprints are A `B55E8B6AEB30`, B `32A54C8F2F29` and X
`F61C9F702CFE`; format and pairwise distinctness were validated. The exact run-18 authority is
consumed successfully and R-035 is locally mitigated with the transfer binding established.
Product Human V5 did not run, the Product App was not installed, and R-034 plus DA5 remain open.
The next safe step requires separate exact Product-Human-V5 authorization; no Product correctness,
authentication, network, database, timekeeping, production, deployment or distribution claim or
authority follows from run 18.

Run 16 remains historical: it matched the offline artifact/preflight/install-launch/waiting path
and Human-confirmed device binding, then failed closed on the first physical Tag-A scan at
`technology_evidence`. No B/X, Human PASS or retry occurred; `abort`, `cleanup:match` and
`failed:mismatch` closed the run. No raw technologies, UID or fingerprint were recorded and no
hardware defect is proven.

The predecessor Product/Validation/Operator artifacts are historical
**DO NOT INSTALL/DO NOT START**. The NfcA-only Product candidate from source
`814cb9013be7da98e46a4c36c5d4e716eef4cf46`, tree
`0181c50faf6936ea1236f4454d536bf734334c91`, is published read-only and its compiled dispatch
resolves to the unique exact-NfcA resource. The Validation artifact from source
`5675297dab94258e50d7371a95e07fe7a77fc51c`, tree
`b32af38c8ac769965ab062762004312d96d0de25`, is also published read-only. Its publisher initial,
staged and final checks passed; after one retained-build-checkout readiness stop caused by ignored
module-build residue before artifact inspection, the authorized corrected standalone verifier ran
from a fresh clean execution checkout and returned
`da5_v5_validation_artifact_verified`. Its ordered 33-record source closure has compact-JSON
SHA-256 `62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763`.
Artifact Binding Review R1 returned `CHANGES REQUIRED` with one P1 and three P2 findings. The
corrected superseding NfcA-only Product/Validation/current-Operator candidate is committed as
`be76ce4a69c8a971ad73b5232082a9e500d8d471`, tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`, on parent `cda51c8`/tree `e2ee3bc`.
Binding-correction source/prepublication reviews and the focused stale-bundle re-review returned
`APPROVED` with zero open P0–P3. The one complete final V3 passed 20/20 builds, 21/21
tests-inclusive typechecks, 21/21 suites across 151 files and 2,821 tests with exactly two optional
B1 skips, Mobile 54/54 files and 1,169/1,169 tests, both exact read-only preflights and the
861-module Android export. No ADB command ran. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176`, tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c`, passed exact-head CI `30612797541`, attempt 1,
12/12. Correction `9c6eec7`/tree `0aaa6de` closed the two docs-only P3 findings, and both
independent Exact-Delta re-reviews returned `APPROVED` with zero open P0–P3. Later R0 `[skip ci]`
closure head `3b544c731d15428334bbadc8e70a3492ef60b886`, tree
`52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02`, carries that V3/V4 evidence only and is not the
Exact-Head-CI SHA. This is carried evidence bound to the stated `f45f49a` head/tree, not exact-head
CI for ADO baseline `5a0d59c` or this R0 synchronization. The pre-run preparation was technically
`APPROVED`/`MERGE_READY`; runs 17 and 18 later passed under separate exact authorities and consumed
them. Post-run, both artifacts remain **DO NOT INSTALL** and the operator **DO NOT START** for every
new action. DA5 and R-034 remain open; R-035 is locally mitigated by the run-18 transfer binding.
No new installation, hardware, Product, production or distribution authority is claimed. Current
details are in ADR-0017, `Project_Status.md`, R-034/R-035, the DA5 V5 Runbook and DA5 V5 Evidence.

The Human Architect explicitly made the NfcA-only Product decision. The Technical Lead delegated
only its focused R3 implementation on baseline commit
`17f4b47b8429d3862789b7e13a23f8da9d28c449`, tree
`4bbfe9e3fdcdf474f1f506135560e4e111122fb5`; Tag Assignment, tenant/lifecycle/manual-trigger
Business rules, production and distribution are outside that scope.

Completed C3D implementation/physical evidence:
`ADO/05_Evidence/Block_C3D_Implementation_Evidence.md` and
`ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md`.
Independent review and Technical-Lead correction disposition:
`ADO/05_Evidence/Block_C3D_Independent_Architecture_Security_Review.md`.
Completed and independently closed C3E1 implementation, Human physical-gate and closure evidence:
`ADO/05_Evidence/Block_C3E1_Implementation_Evidence.md` and
`ADO/05_Evidence/Block_C3E1_Physical_Validation_Evidence.md`; independent final closure review:
`ADO/05_Evidence/Block_C3E1_Independent_Final_Closure_Review.md`.
C3E2 architecture/authorization, implementation, Human physical gate and governance closure are
independently complete for the authorized local repository/device scope:
`ADO/02_Development/Block_C3E2_Explicit_Tag_Reassignment_Authorization.md` and
`ADO/05_Evidence/Block_C3E2_Implementation_Evidence.md`; implementation review and physical
evidence: `ADO/05_Evidence/Block_C3E2_Independent_Implementation_Review.md` and
`ADO/05_Evidence/Block_C3E2_Physical_Validation_Evidence.md`; independent final closure review:
`ADO/05_Evidence/Block_C3E2_Independent_Final_Closure_Review.md`. Closure commit `a2fdebc`, tree
`1872f9f`, passed exact-head ten-of-ten run `29652072268`; independent final review returned
`APPROVED` with zero open P0–P3 after accepting the complete fresh Galaxy-A33/NTAG213 Human gate,
active-work rejection, post-stop A→B reassignment, exact historical attribution and cleanup.
Production resources/data and deployment/distribution remain unauthorized.

Development Assignment 1 repository Workstreams A–E were published and Technical-Lead approved
from exact authorized baseline `1800930`, tree `73e77b6`. Implementation commit `4f51918`, tree
`617081f`, passed exact-head GitHub Actions run `29675842388`, attempt 1, ten of ten jobs. The
independent implementation review of publication head `de89521` returned `CHANGES REQUIRED` with
one P2, `DA1-IMPL-01`, and no other P0–P3. The byte-identical B6/Offline Organization/User advisory
lock and real cross-route PostgreSQL serialization test were published as correction `c71399a`,
tree `7a159ce`, and passed exact-head GitHub Actions run `29692113159`, attempt 1, ten of ten jobs.
The complete corrected local regression passes 1,626 tests. Independent exact-delta re-review
bound final reviewed head `767043d`, tree `19c434a`, and final-head run `29692304824` and returned
`APPROVED` with zero open P0/P1/P2/P3; `DA1-IMPL-01` is closed. The Human Architect subsequently
authorized the complete fresh Physical Gate against ADO head `72dc39e` and exact-head run
`29692785824`. Gate A failed before lease activation: on the approved Galaxy A33/Android-15 device,
the exact hash-verified APK reproduced SQLCipher page-1 HMAC/decryption failure on clean first start
before authentication after package-scoped backup cleanup, app-data clear and a probe with Android
Backup Manager disabled. Focused correction `04399fa`, tree `ecf5e6f`, now keeps SQLCipher
keying, first-page creation and exclusive transactions on one runtime-owned connection, adds an
explicit Android backup/transfer exclusion boundary, passes 1,628 local tests, all 15 typechecks
and all available builds, and passed exact-head run `29695449737` ten of ten. Native Galaxy-A33
evidence passes clean first start, cold encrypted reopen and wrong/missing-key fail-closed checks.
Independent exact-delta review of head `76be116`, tree `d320db3`, and ten-of-ten run
`29695605706` returned `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-PHYS-01`.
The Human Architect then authorized a complete fresh restart on product `04399fa`, ADO head
`fb4a4e4` and exact-head run `29696026676`. Gate A obtained a complete two-item Employee lease,
then failed at step 4 after airplane-mode force-stop/relaunch without Auth/API reachability: the
app showed `TapTim.e ist derzeit nicht verfügbar` instead of the mandatory explicit offline state.
No tag was scanned, lifecycle mutation counts remained zero and Gates B–E were not started.
Focused correction `e17fcb3`, tree `44320bc`, and its cross-identity hardening
`869e10f`, tree `325fdd5`, are published; exact-head runs `29696949408` and
`29697397146` each passed ten of ten jobs. The correction adds the suspended/retryable
provider-restoration state, the narrowly gated offline-capture shell and foreground/network
restoration ordering. The hardening additionally proves that only stored-session restoration or
a previously resolved authenticated context may consult a local lease; an explicit new login
whose backend context is unavailable cannot open an old local lease. Storage failure, logout,
rejection, owner/install mismatch and invalid/expired lease remain fail-closed. Independent
exact-delta review of head `8d1a0d8`, tree `3464697`, all four exact-head ten-job runs and the
complete 17-file delta returned `APPROVED` with zero open P0/P1/P2/P3 and closed the
`DA1-PHYS-02` repository finding. The separately authorized third complete fresh gate then passed
Gates A–C and Gate-D server safety, but failed mandatory Mobile review-state truth: after durable
review acknowledgements removed their exact FIFO rows, session/lease restoration replaced
`Sichere Prüfung erforderlich` with `Bereit zum Scannen` while an unresolved review predecessor
remained. `DA1-PHYS-03` is P1; Gate E was not started and complete cleanup passed. Focused
correction `7dbda3b`, tree `e6abc9e`, persists the earliest review sequence atomically in encrypted
owner-bound schema version 2 and makes it dominate later ready states. Mobile passes 409/409,
required local/native verification passes, and exact-head run `29700339367` passed ten of ten.
Independent exact-delta review of head `798bada`, tree `d181370`, the exact 14-file +557/-63
delta and exact-head runs `29700339367` and `29700546787` returned `APPROVED` with zero open
P0/P1/P2/P3 and closed `DA1-PHYS-03` as a repository finding. The Human Architect then separately
authorized the fourth complete fresh Gate A–E run on exact product `7dbda3b`, reviewed ADO
`798bada`, review synchronization `73b5105`, exact-head run `29714165784` and the
95,422,571-byte APK SHA-256
`e634f03a0eedf43a3c1d2d7d94213c223ea13c627556e641e39c9d08c4f93623`.
After a fully discarded and verified-clean technical preflight, real setup, Employee lease and cold
true-offline entry passed Gate A steps 1–4. Gate A step 5 failed: three independently verified
native NFC deliveries left the encrypted queue at zero. Read-only diagnosis opens
`DA1-PHYS-04` (P1): the NFC foreground transition republishes a semantically unchanged suspended
session, advances the capture generation and invalidates the delivered result before durable
append. The failure remained closed with no false persistence claim or server mutation. Gates B–E
were not started, no observation may be reused and complete abort cleanup passed. Independent
review of failure-synchronization head `3dd7983`, tree `e78b526`, and exact-head run
`29716007657` returned `APPROVED` with no P0–P3 finding against the synchronization while
`DA1-PHYS-04` remained open. The Human Architect then separately authorized only the focused
repository correction on that exact baseline. Technical-Lead-approved correction
`48a21a7ed75c3ab3b15fec93669b5ca2d87d5a30`, tree
`7c053beeb0c9ef550216bd1dad0a59fc226866a6`, parent
`3dd798376180051c0dbd8d9e4ee058acff89b43f`, publishes the private
restoration-continuity snapshot, exact active-context revalidation and durable disclosure-safe
Gate-C helper/runbook in an exact 24-file `+3027/-37` delta. Exact-head GitHub Actions run
`29743923158`, attempt 1, push to `main`, passed ten of ten jobs. ADO publication head
`2f6035b1da9e7946cfca8d10c3d406a8c0b852ec`, tree
`d5513a6ec2fe99c4f2b6fae9b3452004453b965b`, passed exact-head run `29744637928` ten of ten.
Independent exact-delta correction review returned `APPROVED` with zero open P0–P3 and closed
`DA1-PHYS-04` as a repository finding. No corrected physical result exists. The Human Architect
later authorized a fifth complete fresh gate, but strict pre-install verification found its exact
hash-bound APK was no longer retained. No APK was installed and Gate A did not start.
`DA1-ARTIFACT-01` synchronization `e0fd175`, tree `fed47cf`, passed exact-head run
`29747561139`; independent rebinding review returned `APPROVED` with zero open P0–P3 and the Human
Architect separately authorized the exact 95,425,607-byte replacement SHA-256
`4239f6c6…6b7c`. Immediate host/device binding passed, but the exact APK failed Gate A during
step 1 before login: its Hermes bytecode omitted both required loopback URLs and the required
publishable key. The failure remained closed with zero administration/lifecycle mutation and full
cleanup. `DA1-ARTIFACT-02` is an open operational P1; Gates B–E were not started.
Independent review approved failure-synchronization head `d6cc071`, tree `765b8a2`, and the
focused correction boundary. The Human Architect separately authorized only that correction.
Technical-Lead-approved correction `0fdddbc`, tree `62b5efc`, passed exact-head run
`29751390803` ten of ten. It centralizes the exact synthetic runtime contract, forces a clean
single-use Gradle release and rejects build/install before ADB unless deterministic Hermes
inspection proves both loopback URLs and the publishable key. The exact-source result is preserved
read-only at 95,425,695 bytes, SHA-256 `aa081fca…5ffbf`; runtime completeness, APK-v2 signature,
package/version and backup/transfer boundaries pass. It remains uninstalled. Independent
exact-delta/artifact final review of head `1527855`, tree `1bc2511`, correction `0fdddbc` and the
two exact-head CI bindings returned `APPROVED` with zero open P0/P1/P2/P3 and closed
`DA1-ARTIFACT-02` as an artifact-pipeline finding. The reviewer transparently could not mount the
two external APKs; the Technical Lead subsequently reverified both exact immutable files, the new
APK's Hermes/runtime, v2 signature, signer, package/version and manifest bindings, and the old
APK's three-value rejection. The Human Architect then separately authorized the sixth complete
fresh Gate A–E run on review-synchronization head `0e2590b`, tree `23fc9d3`, exact-head run
`29830332699` and the exact runtime-complete APK. All five gates passed afresh on the approved
Galaxy A33/Android-15/two-NTAG213 set, including cold true-offline A→B→A capture, automatic FIFO,
lost-response idempotency, stale-cutover review truth after restart, native background single-flight,
both sign-outs and complete cleanup. Physical-evidence publication, exact-head CI and independent
final closure review then completed: publication `8d5b2bb`, tree `592f9da`, passed exact-head run
`29836085810`, attempt 1, ten of ten; independent review returned `APPROVED` with zero open
P0/P1/P2/P3. Development Assignment 1 and DT-060–DT-062 are independently approved for closure
for the exact authorized local Android/repository/synthetic-server scope. Closure publication
`715889e`, tree `b9fc3ac`, passed exact-head run `29837556200`, attempt 1, ten of ten. DA1 and
DT-060–DT-062 are closed for that scope. Production resources/data, deployment/distribution,
iOS/Web NFC, review adjudication and Assignments 2–8 remain outside it.
Implementation, review and physical evidence:
`ADO/05_Evidence/Development_Assignment_01_Implementation_Evidence.md` and
`ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md` and
`ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md` and
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md` and
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_02_Independent_Exact_Delta_Review.md` and
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_03_Independent_Exact_Delta_Review.md` and
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Failure_Synchronization_Independent_Exact_Delta_Review.md`
and
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Independent_Exact_Delta_Review.md` and
`ADO/05_Evidence/Development_Assignment_01_DA1_ARTIFACT_02_Independent_Exact_Delta_Artifact_Review.md`
and `ADO/05_Evidence/Development_Assignment_01_Independent_Final_Closure_Review.md` and
`ADO/05_Evidence/Development_Assignment_01_Closure_Evidence.md`.
Production, production data, deployment and distribution remain unauthorized.

Development Assignment 2 Workstreams A–D were published at executable implementation `f385814`,
tree `48b5ba8`, and passed exact-head eleven-of-eleven run `29847593708`. Reviewed evidence head
`1e4dee2`, tree `d6c3adf`, passed exact-head run `29847934091` eleven of eleven. Independent
exact-SHA implementation review returned `APPROVED` with zero open P0/P1/P2/P3. Exact-scope ADO
closure `fa171a5`, tree `be13e0c`, passed exact-head run `29848853594`, attempt 1, eleven of eleven.
DA2 and DT-063–DT-068 are closed for the exact local setup-integration/export-backend scopes.
Production resources/data, pilot-operational
onboarding, UI productization, legal/privacy approval, deployment, distribution and Physical Gate
remain unauthorized or separately gated.

The Human Architect accepted ADR-0014 and DA3-P01–DA3-P16 and separately authorized DA3
Workstreams A–D plus AVS V0–V4 on exact baseline
`ff68f7a7d0ce69a65e88846ae1cca9abd5951f5d`, tree
`09ef169a68bb53420e07b6f3fcbbdc74e0c01d57`. Implementation `0f71aca`, tree `e3e2ed7`, passes AVS
V0–V4 with 1,757 local tests, all workspace typechecks/builds, migration clean/replay verification,
Android export and exact-head run `29859522776` 12/12. Independent exact-SHA implementation review
returned `APPROVED` with zero open P0–P3. The Human Architect subsequently authorized focused local
V5 enablement preparation and DA3-V5-F01 on exact baseline `0b0d040`, tree `eee2650`, including
harness, runbook, AVS V0–V4 and independent review. Product candidate `6eb68a3`, tree `bb8564f`,
passed exact-head run `29927309720` 12/12 and has a bound read-only synthetic APK. Evidence
`f4e2eeb`, tree `20e5715`, passed run `29928717227` 12/12; independent exact-SHA V5 review returned
`APPROVED` with zero open P0–P3. One later exact-bound Human physical run passed prerequisite setup
but failed closed at Gate A with `DA3-PHYS-01` (P1), zero server lifecycle mutation and complete
cleanup. Gates B/C did not start; DA3 and DT-069–DT-074 remain open. Independent
failure-synchronization review of `a66788e`, tree `5524215`, and exact-head run `29933136031`
returned `APPROVED FOR FAILURE SYNCHRONIZATION` with zero P0–P3 review findings while keeping
`DA3-PHYS-01` open. On exact baseline `f0c9db3`, tree `27cabe6`, the Human Architect then selected
and authorized the operational clean exact-artifact reinstall correction. Local AVS V0–V3 passed
1,758 tests plus two optional B1 skips, all typechecks/builds and artifact revalidation.
Publication `f7a2b1e`, tree `a8caed6`, passed V4 exact-head run `29935693909` 12/12; independent
review returned `APPROVED FOR DA3-PHYS-01 OPERATIONAL CORRECTION` with zero P0–P3. Any replacement
run required separate authorization. The Human Architect later authorized one complete fresh
replacement run. It passed exact preflight and first installation but failed closed during setup
with `DA3-PHYS-02` (P1): the harness's two seeded Customers contradicted the instruction to create
two Customers and the exact two-receipt/four-audit assertion. Tag B, clean reinstall and Gates A–C
did not start; lifecycle/DA3 rows stayed zero and cleanup passed. `DA3-PHYS-01` and
`DA3-PHYS-02` remain open. Failure synchronization, focused ADO-only correction, independent
review and new exact-bound Human authorization are required. Production, production data,
deployment and distribution remain unauthorized.

Independent review of failure synchronization `abd58be3`, tree `b2cb210`, and exact-head run
`29939539390` returned `APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-02 CORRECTION CANDIDATE`
with zero open P0–P3. The Human Architect accepted the review and authorized the focused ADO-only
correction. Runbook step 7 now uses exactly the two seeded Customers, prohibits additional Customer
creation and leaves the exact two-receipt/four-audit invariant unchanged. Focused publication
`4d54dc2`, tree `ad9b6ba`, passed exact-head run `29941019865`, attempt 1, 12/12. Independent
exact-delta re-review of correction plus Evidence sync `53ec139`/tree `9963960` and run
`29941415806` returned `APPROVED FOR DA3-PHYS-02 ADO CORRECTION` with no open P0–P3 review
findings. Review archive `030dbf6`, tree `8695708`, passed exact-head run `29942397982`, attempt 1,
12/12; final Evidence sync `22ee463`, tree `3d70d5d`, passed run `29942786556` 12/12. The Human
Architect accepted both exact records as the binding review basis and explicitly granted no
Physical Gate. A new separate exact-bound Human authorization remains required before any run.

Human-acceptance publication `acf79ab`, tree `f80bec9`, then passed exact-head run `29946654825`
12/12 and the Human Architect separately authorized one complete fresh V5 run. Exact preflight,
seed-only setup, clean exact-artifact reinstall and Gate-A actions reached the expected sanitized
aggregate, but the run failed closed before Gate B with `DA3-PHYS-03` P1: mandatory CSV content
assertions were omitted on incorrect Technical-Lead instruction and the later Employee login used
a mutable clipboard value whose hash did not match the harness password. No Gate-B tag was
presented, Gate C did not start and complete cleanup passed. A cleanup-time path-scoped
`git status -- research` probe also violated the protected-path boundary without emitting protected
names/content or changing state. Failed-run observations close neither `DA3-PHYS-01/02` nor any
DA3 task. Independent review of failure synchronization `a8b18d6`, tree `dae80d8`, exact-head run
`29984028528` returned
`APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-03 OPERATOR-CONTROL CORRECTION CANDIDATE` with
zero open P0–P3. The Human Architect accepted that exact basis and authorized only the focused
ADO-only correction plus review archival/truth synchronization, AVS R0/V0, publication/CI and
independent exact-delta re-review. The runbook now makes all required CSV proofs explicit stop
points, binds every password injection to a live-session-only SHA-256 digest with output limited
to `match/mismatch`, keeps fixed emails off the credential clipboard, fails before authentication
on mismatch and explicitly excludes `research/` from worktree checks. Correction/review-archive
publication `9424a588`, tree `f2d9a875`, passed exact-head run `29985219725`, attempt 1, 12/12;
Evidence sync `e025a2f`, tree `4485a43`, passed exact-head run `29985663622`, attempt 1, 12/12.
Independent exact-delta re-review returned
`APPROVED FOR DA3-PHYS-03 ADO OPERATOR-CONTROL CORRECTION` with zero open P0–P3 review findings.
Review archive `8545e08`, tree `3440e78`, passed exact-head run `29986601053`, attempt 1, 12/12.
Final Evidence sync `f726e16`, tree `6421aa5`, passed exact-head run `29986934600`, attempt 1,
12/12. The Human Architect accepted both exact records as the binding review basis and explicitly
granted no Physical Gate. A new separate exact-bound Human authorization remains required before
any run. No retry, production, production data, deployment or distribution is authorized.

Human-acceptance publication `d2dba78`, tree `ea67729`, then passed exact-head run `29987351521`,
attempt 1, 12/12. The Human Architect separately authorized a later complete fresh V5 on the
unchanged full chain/artifact/device/Tag boundary. That final counted run passed seed-only setup,
clean exact-artifact reinstall and Gates A–C, including all four CSV stop points, ordered offline
review evidence, partial-retain/complete-clear Mobile behavior across cold relaunch and complete
cleanup. `DA3-PHYS-01/02/03` are physical-closure candidates; DA3 and DT-069–DT-074 remain open
pending focused publication, exact-head CI and independent final review. The authority is
consumed; no retry/new run, production, production data, deployment or distribution is
authorized.

Physical evidence publication `7cb510a`, tree `ba28d74`, passed exact-head run `29996799069`,
attempt 1, 12/12. Independent final read-only review verified the complete chain, artifact,
Gates A–C, aggregate arithmetic, disclosure boundary and cleanup and returned
`APPROVED FOR DA3-V5 PHYSICAL CLOSURE` with zero open P0–P3. The Human Architect accepted that
review and authorized focused ADO-only closure synchronization. `DA3-PHYS-01/02/03`, DA3 and
DT-069–DT-074 are closed for the exact authorized local repository/Admin-Web/Android/
synthetic-server scope when this publication's required Exact-Head-CI succeeds. No new Physical
Gate, production resource/data, deployment, distribution, legal/privacy approval, pilot
onboarding or DA4 productization is authorized.

Development Assignment 4 Product `f0f1e177`, tree `5259887`, passed exact-head run `30009111061`
12/12 and independent zero-finding review. V5 enablement `e731a77`, tree `6c2b34d`, passed run
`30022981656` 12/12 and independent implementation review; review archive `24ae57a`, tree
`40dd1a3`, passed run `30024662862` 12/12. The first authorized start attempt did not reach
Harness readiness because its startup wrapper failed. The attempted start was therefore
ambiguous, so its authority was treated fail-closed as consumed. A separately authorized fully
fresh replacement passed preflight and extensive Safari observations plus its first two write
checkpoints, then failed closed at the Tag-reassignment checkpoint after the operator advanced on
`passt` before word-for-word confirmation of `NFC-Tag wurde sicher neu zugeordnet.` The mismatch
automatically aborted the Harness; Chromium/Chrome, Firefox, later writes and CSV/export did not
run. Cleanup passed, the exact database mismatch dimension is not reconstructable and no Product
defect is proven. `DA4-V5-H01` is P2 operational/gate reliability. Its R0/V0 checkpoint-handshake
correction was independently reviewed as candidate `cd5d1e17`/tree `c251f72` with exact-head CI
`30078462282` 12/12. Verdict `APPROVED`, zero open P0–P3 review findings. `DA4-V5-H01` remains
historical P2 until a completely fresh authorized gate passes and receives final review. A
copy-ready new exact-bound Human authorization candidate may be prepared, but no run, reuse,
retry, production, production data, deployment or distribution is authorized.

Development Assignment 5 Product V0–V4 and its read-only artifact/evidence bindings remain
independently approved for their exact local scopes. Every Shared-Cluster follow-up, including the
uncommitted 180/180 observation, is `BLOCKED` and not Evidence. Historical Isolated-PostgreSQL
round-2 candidate `7739757a4855ee7bac34408941e94c25516d75f5`, tree
`0398066e92fef65562526f61c9515b0ef3be0114`, passed exact-head CI `30177897059`, attempt 1,
12/12. Round-3 candidate `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, tree
`dfb5abbca1f2ddf603d191ae3303d1336f5440c7`, exact parent
`7739757a4855ee7bac34408941e94c25516d75f5`, passed exact-head CI `30185670176`, attempt 1,
12/12, but independent read-only review returned `CHANGES REQUIRED` with exactly two P1 and zero
P0/P2/P3: the existing PostgreSQL 17.10 Homebrew canonical trust chain must accept root or exact
same-EUID ownership under Option A with complete stable binding/revalidation, and initdb must
retain its leader unreaped through its final possible group signal.
The Human Architect preserved exact Option A—one exclusive trusted single-user operator session,
with hostile/malicious same-UID processes and mount/unmount churn outside the threat model—and
authorized exactly one additional focused ADO correction/review round beyond the three-round
limit, limited to those findings. Extra-round candidate
`43567d256e8f633f16866448e1fb5abbd8022733`, tree
`feecced92abe9fc536a2db052b5a616d3e0f1cf7`, exact parent
`bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, passed exact-head CI `30186846379`, attempt 1,
12/12. Independent Exact-Delta review returned `CHANGES REQUIRED` with exactly one P1 and zero
P0/P2/P3 because the current same-EUID-owned Homebrew Cellar `0775` ancestor makes blanket group-
write rejection unusable and the trusted group plus complete membership were not bound; initdb
P1-B is explicitly closed.

The Human Architect confirms the second local administrator and exact complete decision-time
local macOS admin-group membership snapshot are trusted under Option A and authorizes exactly one last
focused ADO correction/review round limited to the remaining P1. The current last-round R0 draft
binds group identity and sorted UID/GUID membership disclosure-safely, accepts only exact-group/
exact-members/exact-observed-mode same-EUID ancestor group write, keeps canonical binaries exact
observed `0555` and non-group/world-writable, rejects every mismatch, and performs no system
or account/group/membership/ownership/permission/Homebrew mutation. It grants no implementation
or Human/hardware authority. Focused publication, successful exact-head CI and independent Exact-
Delta `APPROVED` with zero open P0–P3 remain required before only the exact R3 scope may activate
through the `AGENTS.md` standing rule.

The trusted Option-A state is frozen to the Human decision-time V1 anchor: exactly two direct
members, zero nested groups, full-record digest
`b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`, membership digest
`70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064` and combined snapshot
digest `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`.
Future R3 must recompute and match all three digests plus both counts before capability/task-root
work and before every trust use. Any mismatch stops and returns to the Human Architect; dynamic
acceptance, anchor update or rebinding to later-current state is forbidden. Only these digests,
counts and match result may enter repository/CI/log output; raw group names, GIDs, group GUIDs,
usernames, UIDs and member GUIDs remain disclosure-prohibited.

Current DA5-V5 truth supersedes the pre-implementation state above without deleting its history.
Runtime Guard source `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867`, tree
`980b6c57fdd71c12820f2890b640946db0d883c6`, passed CI `30255104609`, attempt 2,
12/12; its binary/manifest and focused evidence received independent Exact-SHA `APPROVED` with
zero open P0–P3. Historical Validation App query-visibility correction
`5c239b1c30c6263a036077460e23373b767f66df`, tree
`53e8d4ed012ccc662f1005f895a3b6e685cf560e`, binds the exact real queries structure and passed
exact-head CI `30276804017`, attempt 1, 12/12. Its replacement read-only APK/manifest passed the
official verifier. Independent Exact-SHA re-review of review base
`11a8269de145ad33c230f55a064bd18f9bb59731`, tree
`2292010e43d2620fbdbba6eeb6a9d77c36674144`, and CI `30277641127`, attempt 1, 12/12,
returned `APPROVED` with zero open P0–P3; P1 and P3 are closed.
Exactly one installed and active Google or Samsung TalkBack provider is allowed; none or both
fail closed.

The follow-up Runtime correction started from
`dbf8cfe643b56bdb3c6c371a95bfc463bbf8042f`, tree
`80e17f54d62d386a02af3aa7e71b152cc3edb7b5`. First source
`86c55fb17f64325046f2b25b45b84550c5a4b2bd`, tree
`3a771945bc34852e4de098464c6c5bb82e74540b`, failed CI `30282537778`, attempt 1,
only on the five-second test timeout. Timeout candidate
`534b6d23e9391431fb4527c76347c16821ce3e18`, tree
`a07429424184b4cd0b10841ea3e57c872afc4c8d`, passed CI `30282863442`, attempt 1,
12/12; independent review returned `CHANGES REQUIRED` for exactly one P1 fail-open syntax graph.
Final correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree
`3e4d1356b859fecf70d365fecbb563e2088100f3`, passed CI `30284566289`, attempt 1,
12/12, and independent re-review returned `APPROVED` with zero open P0–P3. The exact executable
Metro bundle/source closure, ExpoAsset absence, Validation package, local synthetic signer,
required native modules and zero forbidden modules/extra permissions are bound. The historical
`7e8c0f7` APK/manifest passed the official verifier and independent Artifact Exact-SHA review
with zero open P0–P3 for that exact source, but DA5-V5-VAL-UI-01 changes its Controller/UI:
**HISTORICAL — DO NOT INSTALL**.

DA5-V5-VAL-UI-01 source `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`, tree
`2958f456875e8dab3f10834df280e10a8438efce`, passed exact-head CI `30370977809`,
attempt 1, 12/12. Round-2 and Round-3 source reviews and the formal independent Source/Artifact
Exact-SHA review returned `APPROVED` with zero open P0–P3. Its read-only artifact directory is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-e97bbe9e2a28-810b856ff7113b4f`:
the 65,629,505-byte `0444` APK has SHA-256
`810b856ff7113b4f2a454007595e1b6c1ae5dc69c601a2120b577f124e213e28`; the
6,700-byte `0444` manifest has SHA-256
`af53d646558449a7a5c907fbdf59e3366c6ffd2755f6049141db8e567549e051`. The official verifier
and independent package/signing/runtime/native/source-closure review passed. This closes the
repository/source/artifact finding only. Because the native-capture diagnostics correction changes
the Validation source, the `e97bbe9` APK/manifest is now **HISTORICAL — DO NOT INSTALL**.

Runs 1–16 are historical consumed Phase-0 attempts without a successful attributable Tag result.
Run 17 later passed as the current record above; the historical runs 1–16 chronology follows:
preinstalled
package; unsupported Samsung provider in the then-prior build; generic launcher/package resolver
without a unique explicit-Activity start; and explicit `.MainActivity` cold start failing on
missing ExpoAsset (`DA5-V5-VAL-RUNTIME-01`). Run 5 on baseline `55070aa` installed and verified
the then-current exact `7e8c0f7` Validation APK, passed the Human-confirmed device checkpoint and then reached only
the generic fail-closed scan path without a distinguishable cause. No successful or attributable
Tag result is Evidence and no hardware defect is proven. Cleanup ended with package, process and
reverse mappings at zero. Run 6 on ADO baseline
`96daac0b3cf1cfe98249a8c94fe927f34ee33af1`, tree
`4e7ccd41a4fda0608a7e9deab7fbc258e1cf94bf`, installed and verified the then-current
`e97bbe9` artifact and passed the Human-confirmed device checkpoint. Its first required A-scan
showed only `Prüfung sicher gestoppt` /
`Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden`. No cause or Tag result is
attributable and no hardware defect is proven; cleanup again confirmed package, process and
reverse mappings at zero. Run 7 used ADO baseline
`aebffbec7c72c028ace6365ecdcc413e314526dd`, tree
`9e0104229756fe223753916ace8247ee2626f4d5`, and the exact `effc57a` source/artifact. It stopped
at the first required A-scan with safe stage `technology_evidence`. Its authority is consumed;
there is no fingerprint or Tag result. Concrete physical `techTypes` were intentionally not
exposed and remain unknown, no hardware defect is proven, and cleanup again confirmed package,
process and reverse mappings at zero.

Run 8 used ADO/code baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree
`10cdf16421fe564e1961a39d79e20775c0269fc4`, and the exact `03694f2` artifact. Installation
succeeded, but an ad-hoc host pathname regex rejected the legitimate Android-15 installed path
solely because it contained `~`. `.MainActivity` was not started, the Validation process was
absent, and no checkpoint, scan, fingerprint or Tag result was reached. Its authority is consumed;
uninstall succeeded and final package, process and global reverse state were zero. This is an
operator-boundary failure, not a Product, NFC or hardware result.

Run 9 used baseline `2f057cb4e5d096e34785c72c51340f589c711dd2`, tree
`6f65f44e53574921f1e8e9fdfde94f7a9a9ade2c`, and emitted exactly `artifact:match`,
`preflight:match`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It reached no
scan or Validation UI handoff; the exact install-/launch cause is not reconstructable, no Product,
NFC or hardware defect is proven, its authority is consumed and terminal cleanup restored
package, process and global reverse state to zero.

Run 10 used baseline `b63641953536bb36625fcd42d850e429ddab8db3`, tree
`dc1b9a11e0391074b35139f5948ef6b2c45f1d26`, and emitted exactly `artifact:match`,
`preflight:match`, `stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. Because the then
current `installation` category also summarized verification mismatches before the PackageManager
call, the exact cause is not further reconstructable and `operation_mismatch` does not prove that
the install call ran. No Product, APK, NFC or hardware finding is established. The authority is
consumed, terminal cleanup matched, and another run remains **DO NOT START** without a fresh exact
Human authorization.

Run 11 used baseline `d8549c3f1d14c15846d4f81dbe7669a598626633`, tree
`04ea2d0571a2e030fe99fbba27b622e68604644e`, and emitted exactly `artifact:match`,
`preflight:match`, `stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. The category proves
entry into the existing PackageManager-call boundary but cannot distinguish a rejected ADB/child
transport from a resolved PackageManager operation with a non-accepted exact `Success` receipt.
No Product, APK, NFC or hardware finding is established; the authority is consumed and terminal
cleanup matched.

The authorized focused local correction maps those two outcomes to the fixed disclosure-safe
categories `adb_child_transport_mismatch` and `package_manager_receipt_mismatch` while preserving
the exact streaming install, APK/package/user-0 binding, timeouts, fail-closed behavior,
zeroization and cleanup. Focused Operator tests pass 139/139 and the tests-inclusive Mobile
typecheck passes with the changed test source included. The one complete safe-root V3 used Node
`24.17.0`, npm `11.13.0` and PostgreSQL `17.10`; it passed 20/20 builds, 21/21 tests-inclusive
typechecks and 21/21 workspace suites with 2,516 passed tests and exactly two optional B1 skips.
Migrations 001–013 apply/replay/ledger, C3B `verify-bin`, the unchanged official `03694f2`
artifact verifier and an 861-module Android export passed; candidate bytes matched, and ports
`55439`/`55435` plus process state ended at zero. Published candidate
`9549da9cda578c60ca11144221e8030fb95697d3`, tree
`ced33c8d9d9cdef7d628a47147427ed6147b898a`, parent
`d8549c3f1d14c15846d4f81dbe7669a598626633`, passed exact-head CI `30471511446`,
attempt 1, 12/12. Prepublication review round 1 found exactly one P3 ADO-truth gap and no
code/test finding; round 2 approved and closed it. Final independent Exact-Head review returned
`APPROVED` with zero open P0–P3. The correction is technically final; the operator remains
**DO NOT START**.

Run 12 used ADO baseline `3fcbcdec79dada8d43041a241127e52f4775e8d8`, tree
`74cac3e8611e39938e2c52c25df8cde38be254d2`, and exact candidate `9549da9`/tree
`ced33c8`. It emitted exactly `artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_child_transport_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It reached no
`installed_provenance`, Validation UI, NFC or Tag step. The authority is consumed, terminal
cleanup matched, and no Product, APK, NFC or hardware finding is established.

The focused local Run-12 correction binds only the PackageManager streaming call to ADB
`shell -T -x`. Per the ADB shell contract, `-x` disables propagation of the remote exit code, so
a remote PackageManager rejection reaches a strict single-line parser. Only exact `Success`
succeeds. Fixed allowlisted forms map to disclosure-safe policy/user, artifact/parse/signature,
installed-state/version/signature-conflict, storage or command-contract/usage categories;
unknown, malformed or multiline output remains generic `package_manager_receipt_mismatch`.
Real spawn, stream, timeout, abort or ADB-child failures still reject and remain
`adb_child_transport_mismatch`; no raw output, code or detail is emitted or persisted. The shared
ADB runner, streaming snapshot, APK/package/user-0 binding, timeouts, zeroization, provenance,
fail-closed behavior and cleanup are unchanged. Focused Operator regression passes 150/150 and the tests-inclusive Mobile
typecheck passes with the changed test source included. One complete Mobile attempt passed
51/52 files and 866/867 tests; only the known existing generated native-output contamination
exceeded the locked Validation native-source closure. No retry, deletion or cleanup of that
unrelated state occurred. The Run-12 install candidate remains V1/V2-focused green. A later
isolated V3 attempt is not recognized as V3: after all 288/288 Synthetic assertions passed, two
post-test PostgreSQL `57P01` events exposed that the local Guard stopped PostgreSQL before closing
its still-live pools. Preceding wrapper setup stops likewise provide no V3 evidence. The Human
Architect replaced that contradictory order with successful capability/DB reattestation, closure
of all owned Runtime pools and the active Installer pool, unchanged binary/lifecycle
reattestation and only then `STOP_FAST`. The focused Guard suite passes 78/78 and the Synthetic
workspace tests-inclusive typecheck passes. Final combined candidate
`3a77603825db573bdabb2d4202fe7cca5383c1ed`, tree
`3996b4c27d2970b99e1b407217dd269e62be72ce`, parent
`3fcbcdec79dada8d43041a241127e52f4775e8d8`, passed V3 with 20/20 builds, 21/21
tests-inclusive typechecks and 21/21 suites / 2,529 passed tests / two expected skips, plus
migration, binary, artifact, export and cleanup verification. Exact-head CI `30479752844`,
attempt 1, passed 12/12 without retry. Independent prepublication and final Exact-SHA reviews
each returned `APPROVED` with zero open P0–P3. The Run-12 diagnostic and local Guard cleanup
correction is technically closed; the operator remains **DO NOT START**.

Run 13 used baseline `63feaf48a98e656dcceb395098bea8b260420e16`, tree
`1d635956eb22c9bba99834ca831159741889e83f`. Its complete disclosure-safe receipt sequence was
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_child_transport_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. The read-only device binding
matched before installation. It emitted no `installed_provenance` or `waiting` receipt and
reached no Validation UI, NFC or Tag step. Its authority is consumed, terminal cleanup matched,
and no Product, APK, NFC or hardware finding is established.

The focused Run-13 correction adds a Validation-only streaming-install runner and leaves the
shared ADB runner unchanged. It separates disclosure-safe child start/transport, timeout,
stdin-pipe abort and nonzero/signal exit evidence. `EPIPE`/`ECONNRESET` is provisional until
actual child close and complete stdout under the same absolute timeout. Only then may the existing
strict single-line PackageManager parser run, and exact `Success` still requires the unchanged
installed-artifact provenance proof. Missing or ambiguous terminal evidence fails closed without
stderr, raw errors, device paths, serials or PackageManager details. Focused V1/V2 passes 161/161
tests and the tests-inclusive Mobile typecheck. The final complete Mobile run passed 52/53 files
and 887/888 tests; only the known unrelated generated native-output contamination exceeded the
locked Validation native-source closure, and it was not retried or removed. V3, Exact-Head CI and
independent review were not inferred from that contaminated workspace. The pre-sync ten-file V3
patch SHA-256
`265bdc5b6c5c31897743fdbcc1160deccc2a9c152bb3cca85c7f598ad08899b4` passed fresh,
research-free sparse-safe-root V3 with Node `24.17.0`, npm `11.13.0` and task-owned PostgreSQL
`17.10`: 20/20 builds, 21/21 tests-inclusive typechecks including the changed Mobile tests,
migrations 001–013 apply/replay/ledger, 21/21 suites / 150 files / 2,540 passed tests / exactly
two optional B1 Supavisor skips, C3B `verify-bin`, unchanged Validation APK/manifest verifier,
861-module Android export and final ports `55439`/`55435` plus task cleanup all matched. Wrapper
setup first lacked `rg` in `PATH` after the green builds/typechecks and later omitted the already
bound artifact-verifier environment after all suites; both stopped outside Product verification.
The same safe root continued without code change or retry of green gates, and the final exact
bindings passed. This V3 patch was captured while the four ADO files still said `V3 pending`.
The following R0 synchronization changed only those four documents; all six code/test files
remained byte-identical, so AVS evidence transfers to round-1 candidate
`a03811011eed2d3ebde1c94e60c42f806bde7ecf`, tree
`b21d39887ea613294ed2d9612fd3fa0ff5025a0e`, parent `63feaf48…`, with six-file
code/test diff SHA-256 `ad34c36fbfc5088252a6bd961c426ccae4fdc3b7b8e212bc25481eb17a390452`
and full ten-file candidate diff SHA-256
`ed0047c1311bc83f664cf67702d8150bc2575d9d88f31449704a480b2ddaa4b8`.
Independent round 1 returned `CHANGES REQUIRED` for exactly this one P3 ADO binding error and
reported no code, security or test finding. The focused ADO-only correction was published as
commit `ac51dfd338c75c4bbc0c73345e4d045924022423`, tree
`3d1f3ddfec3d0f07a1ceea7f5ab87029b18d69a5`, parent
`a03811011eed2d3ebde1c94e60c42f806bde7ecf`, and `origin/main` matched that commit exactly.
V3 evidence transferred under the documented R0 byte-identity boundary and was not rerun.
Exact-head CI `30485438652`, attempt 1, event `push`, completed successfully with 12/12 and zero
failed checks. The independent pre-V4 Exact-Delta review and final independent Exact-Head/V4
review both returned `APPROVED` with zero open P0–P3, closing the P3 and the Run-13 correction
scope technically. This following closure synchronization is R0; its own `[skip ci]` commit and
tree remain pending and are not claimed. No ADB, hardware or installation occurred and no run
authority exists. The operator remains **DO NOT START**.

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
`EPIPE`/`ECONNRESET` reaches only the existing strict parser after terminal child/stdout evidence;
partial success, empty, malformed or multiline evidence remains fail-closed. Focused V1/V2 passes
179/179. On exact baseline `887801943064d686da40785d64cd1105431c44ac`, tree
`5c15f0fae9c14844b604addf1c38b3bd5203647e`, the uncommitted nine-path candidate had original
pre-sync diff SHA-256
`1ca772260b64d402b19af6012c15074d2c801c3a63c52790319db056977dc084`. Fresh research-free
safe-root V3 passed `npm ci`, 20/20 builds, 21/21 tests-inclusive typechecks, Mobile test-source
inclusion 53/53, migrations 001–013 apply/replay/ledger and 21/21 workspace suites across 150
test files with 2,558 passed and exactly two expected optional B1 Supavisor skips. Mobile passed
53/53 files and 906 tests. C3B `verify-bin`, the unchanged Validation APK/manifest verifier and
an Expo Android export of 861 modules passed; ports `55439`/`55435` were absent and Guard/task
cleanup matched. Prepublication review returned `CHANGES REQUIRED` with exactly one P3 against
the stale ADO V3 binding and no code, test, security, tenant-isolation, install-session or cleanup
finding. That four-file R0 synchronization and the candidate were published as
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
neither required nor authorized. The closure-sync commit/tree remain pending and unclaimed. The
Operator remains **DO NOT START**; no new Phase-0, Human-run, ADB, installation or hardware
authority exists.

The focused local Run-10 diagnostic correction keeps every stage, aggregate receipt, mutation,
cleanup and terminal boundary unchanged. A pre-install device re-attestation mismatch now remains
`installation` + `verification_mismatch`; the category switches to `operation_mismatch` only
immediately before the existing PackageManager install call. The new regression proves no install
mutation or install runner call, exact aggregate/terminal ordering and no synthetic-secret
disclosure; the existing true install-failure matrix remains `installation` +
`operation_mismatch`.

Combined V2/V3 evidence on the unchanged 950-file tracked candidate used Node `24.17.0`, npm
`11.13.0` and task-owned PostgreSQL `17.10`. Carried isolated evidence supplied 20/20 builds,
21/21 tests-inclusive typechecks, Mobile 52/52 test-source inclusion, suites 1–8 and migration
001–013 apply/replay/ledger. Fresh authorized continuation supplied suites 9–21, C3B `verify-bin`,
the official unchanged `03694f2` artifact verifier and one isolated Android export. The complete
result is 21/21 suites, 149 test files, 2,515 passed tests and exactly two optional B1 Supavisor
skips; the export bundled 861 modules into one 2,927,682-byte Hermes bundle plus 150-byte metadata.
No V4 was executed locally, and no ADB, installation or hardware action occurred.

The install-category correction is technically final and published as
`12d1ace89494851025555d1d06d45570c4fcc4cb`, tree
`b747b4306637d90765b33f273ad89291bd4ea9a7`, on exact parent
`b63641953536bb36625fcd42d850e429ddab8db3`. Its exact code/test delta is limited to
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`; the same published six-file
delta contains only the four synchronized ADO truth files in addition. V2/V3 above are green.
Exact-head V4 CI `30466798295`, attempt 1, completed successfully 12/12. The prior round-2 delta
review and final independent Exact-Head/V4 review returned `APPROVED` with zero open P0–P3,
closing the round-1 P2. At that historical checkpoint, all ten Phase-0 authorities were consumed;
the operator remains
**DO NOT START**, with no new Phase-0, hardware, ADB, installation or Product Human-V5 authority.

Non-code preparation stops were retained as evidence rather than hidden: contaminated
main-workspace native dependency outputs exceeded the fail-closed source-closure bound; the first
clean safe-root ran Mobile before its required contract entrypoints; B1 first lacked its required
synthetic runtime password; the first artifact-verifier binding supplied paths instead of 32
`{path, sha256}` records; and the first Expo invocation supplied an unsupported positional project
path. Each stopped fail-fast without an unchanged retry. A new exact Technical-Lead authorization
corrected only the runner environment or invocation, all subsequently required gates passed, and
every task-owned database, port and temporary root was cleaned.

The focused native-capture diagnostics correction is source
`effc57a6780ff86784de0519a34abd6c5b7b8cd6`, tree
`758dbfaa04d0968fb25122352055fbcb80f8f022`, with exactly seven authorized changed files.
It adds six closed, typed and disclosure-safe allowlisted failure stages for Technology evidence,
UID readability, listener/registration, digest, concurrency and cleanup. No raw UID, payload,
Technology list, provider diagnostic, exception text or Logcat is exposed; NFC acceptance,
timeouts and Controller fail-closed behavior remain unchanged. V3 passed 20/20 builds, 21/21
tests-inclusive typechecks, 21 workspace suites / 147 test files / 2,373 tests and exactly two
documented optional B1 skips, plus migrations 001–013 apply/replay/ledger, C3B CLI and Android
export. The initial Synthetic stop was solely a Technical-Lead runner database-name configuration;
the previously unexecuted unchanged suite passed 288/288 on a fresh exact database, with no port
or temporary residue. Exact-head CI `30377569479`, attempt 1, passed 12/12. Independent source
review and final prepublication review returned `APPROVED` with zero open P0–P3.

The now-historical `effc57a` read-only artifact directory is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-effc57a6780f-e423073e51f72a68`:
the 65,631,681-byte `0444` `app-release-e423073e51f72a68.apk` has SHA-256
`e423073e51f72a68421c8e4afd17a9b86c397ca83628deaf4b174543d817330f`; the 6,700-byte `0444`
`manifest-effc57a6780f.json` has SHA-256
`9d1238e821d92b26ed9bc9b9ee8ccd48607280ff0d0e752ec6965827c68ccc22`. Independent Artifact
Exact-SHA review returned `APPROVED` with zero open P0–P3 after exact verification of all 32
manifest source files, package/signing/security boundaries, DEX required/forbidden modules and
Hermes Validation-only markers. The unchanged native closure remains 123 directories / 587
entries / 464 files / 1,176,224 bytes / SHA-256
`9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259`. After run 7 it is no
longer installed and is **HISTORICAL — DO NOT INSTALL**. Both `e97bbe9` and `7e8c0f7` artifacts
remain historical/DO NOT INSTALL.

`DA5-V5-VAL-TECH-01` confirms that the `effc57a` helper used an over-strict closed Technology
list, maximum length and duplicate rejection. The focused correction source is
`03694f2d877bc323791e93473ad01ceb82af70df`, tree
`6c6039683e067ef29f1f917a60c2628d26e38784`; exact-head CI `30386552118`, attempt 1,
passed 12/12, and prepublication review round 2 returned `APPROVED` with zero open P0–P3.
That historical source required both fully qualified `NfcA` and `MifareUltralight`, while every
additional or duplicated entry was ignored. It is superseded by the Human-decided NfcA-only
correction above and is not an active or future install/run requirement.

One fresh research-free build published the read-only candidate directory
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd`.
Its 65,631,433-byte `0444` `app-release-d2084486b07f27bd.apk` has SHA-256
`d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; its 6,700-byte
`0444` `manifest-03694f2d877b.json` has SHA-256
`aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`. All 32 manifest
source-closure entries matched the exact source, and the official verifier returned `PASS`.
Package/version, one local-only v2 signer, NFC-only permission boundary, denied network/
cleartext/backup boundary, required/forbidden native modules and Validation-only runtime markers
matched. Independent Source/Artifact Exact-SHA review returned `APPROVED` with zero open P0–P3.
The candidate remains **DO NOT INSTALL** because no separate Phase-0, installation, ADB or
hardware authority exists. The safe run-7 stage, run-8 operator failure and repository diagnosis
prove no physical Technology list, fingerprint, Tag result or hardware defect and grant no new
Phase-0, hardware, ADB, installation or Product Human-V5 authority.

The focused Validation-specific Phase-0 operator correction is published as
`083fdfb259089d976e48f824e0862f10637d3290`, tree
`24bd130500934c6a48fd9314fa06387d6ebdedcd`, on baseline `39a6ef0`:
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs`, its `.d.mts`, the thin direct CLI
`apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs`, one focused runtime test and the minimal
shared Android ADB-runner correction/test. It fixes the
exact `03694f2` APK/manifest/source closure, accepts legitimate bounded Android installed paths,
streams only a stable verified host snapshot to the package manager, proves installed bytes and
identity, launches only `.MainActivity`, and owns fail-closed cleanup without reverse mutation.
Formal review R1 returned `CHANGES REQUIRED` with exactly two P1 findings: fail-open Android
user/package provenance and a non-hard cleanup/runner deadline. The local R1 correction now
requires the exact non-headless single running Owner User 0 topology, complete user-0 package-null
proof, `-R`, explicit user-0 package actions, a post-proof ownership token re-attested before each
destructive action, residue preservation on ambiguity, one absolute finish/cleanup deadline and
forced text/binary runner settlement after SIGKILL grace. Its final post-correction safe-root V3
passed 20/20 builds, 21/21 tests-inclusive typechecks and 21/21 suites covering 148 test files,
2,484 passed tests and exactly two documented optional skips, plus migration, C3B, 52/52 Mobile
test-source, unchanged artifact-verifier and 861-module Android-export gates. Exact-head CI
`30402655381`, attempt 1, passed 12/12. Independent Exact-SHA re-review round 2 returned
`APPROVED` with zero open P0–P3 and closed both round-1 P1 findings. The operator remains
**DO NOT START** and grants no Phase-0, installation, ADB, hardware or Product Human-V5
authority.

The published eight-file Phase-0 readiness candidate
`496ca59f0965670b29a210b8aa2443b99bb4a386`, tree
`b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`, starts from exact baseline
`fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree
`da69081517d2b0b9631eaef393b0a6022735061e`. It adds strict Android-Toybox
`ps -A -w -o NAME:4` process parsing, a separate one-time `human-pass` state/receipt before
cleanup success, persistent `SIGHUP`/`SIGINT`/`SIGQUIT`/`SIGTERM` handling and terminal receipt
ordering. The Runbook now binds the future Human checkpoint to exact 200 % text scale, exactly one
authorized TalkBack provider/version, 10 A then 10 B then 10 X successful physical presentations,
three distinct safe fingerprints, the unchanged `03694f2` final UI and immediate abort on every
failure/ambiguity/reset request. Fresh detached sparse safe-root V3 bound executable-patch
SHA-256 `5dea48121b62fe7ebb4894f72425aa5ef5f759e113c3dd349f9fd48bb29fe9b4`,
Node `24.17.0`, npm `11.13.0` and task-owned PostgreSQL `17.10`; it passed 20/20 unique builds,
21/21 tests-inclusive typechecks and 21/21 suites across 148 test files, 2,505 tests and exactly
two optional B1 skips, plus migration/C3B/52-of-52-Mobile-source/artifact-verifier/861-module
Android-export gates and complete task cleanup. The safe-root V3/eight-file candidate itself has
no code finding. Exact-candidate CI `30427205223`, attempt 1, completed failure with 11/12 jobs:
job `90496143535` was red after 3/3 files and 121/121 assertions passed because a subsequent
unhandled PostgreSQL `57P01` occurred on `taptime_c3e1_dirty_*`. The unchanged C3E1 test blob is
identical to green `083fdfb` and five previous green CI runs; its backend and workflow are also
unchanged. The cause is the `dirtyPool.end()` to immediate
`DROP DATABASE ... WITH (FORCE)` sequence racing asynchronous client-end handling in
`pg-pool@3.14.0`. Independent formal review returned `CHANGES REQUIRED` with exactly one P2
outside the candidate scope for CI/test reliability and no Product or Security finding. No retry
was authorized or executed; at that historical checkpoint a focused harness correction and new
CI required new Human authority. The candidate remains **DO NOT START**, changes no Validation
App or artifact input and grants no hardware authority.

The subsequently authorized focused test-only cleanup correction is
`21e518151a3f4727ebf4ce90cd1557660960ff21`, tree
`8f764f9260378b631b4b026355852c324d6dc06b`, on exact parent
`d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree
`753feedcae6724e711557e6492bbe26fa0b02083`. Its seven-file +192/-12 delta removes the known
post-`Pool.end()` dirty-database finalizer race in B3, C3B, C3C and C3E1 by boundedly proving
zero sessions of the exact test database before a non-`FORCE` drop. Focused V1/V2 and three
tests-inclusive typechecks passed; unchanged green V3 from `496ca59` was carried forward.
Exact-head CI `30429746848`, attempt 1, passed 12/12 without retry. Independent source/delta and
final Exact-SHA/V4 reviews returned `APPROVED` with zero open P0–P3, closing the historical P2.
The operator remains **DO NOT START**, and no Phase-0 or hardware authority follows.

Historical install-/launch-diagnostic predecessor
`8ce03852e782d541319bb852f216cf596ab1787f`, tree
`f5b914c1b8f1243244733808beaef54f0351a563`, on parent
`2f057cb4e5d096e34785c72c51340f589c711dd2` binds the exact eight-file +488/-132 delta and patch
SHA-256 `c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`. V1/V2 executed green;
unchanged V3 from `496ca59`/tree `b398b89` was carried. Exact-head CI `30459539801`, attempt 1,
passed 12/12, and independent Exact-Delta/Commit/Tree/CI review returned `APPROVED` with zero open
P0–P3. The operator remains **DO NOT START**; any Phase-0/hardware execution requires separate
fresh exact Human authorization.

Production, production data, system changes, deployment and distribution remain unauthorized.

Current navigation:
`ADO/02_Development/Development_Assignment_05_V5_Enablement_Authorization.md`,
`ADO/02_Development/Development_Assignment_05_V5_Isolated_PostgreSQL_Correction_Authorization.md`,
`ADO/04_Operations/Development_Assignment_05_V5_Runbook.md` and
`ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`; Runtime, DA5-V5-VAL-UI-01 and
native-capture diagnostics review archives:
`ADO/05_Evidence/Development_Assignment_05_V5_Validation_Runtime_Correction_Independent_Exact_SHA_Review.md`
and
`ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_UI_01_Independent_Source_Artifact_Exact_SHA_Review.md`
and
`ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_NATIVE_CAPTURE_DIAGNOSTICS_Independent_Source_Artifact_Exact_SHA_Review.md`
and the approved TECH-01 review archive
`ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_TECH_01_Independent_Source_Artifact_Exact_SHA_Review.md`
and the approved Validation Phase-0 operator review archive
`ADO/05_Evidence/Development_Assignment_05_V5_Validation_Phase_0_Operator_Correction_Independent_Exact_SHA_Review.md`.

This file is the official navigation entry point for the TapTim.e ADO.

Every Human and AI Agent shall locate this document through repository evidence before executing ABS-001 and shall read it before AOS-001 begins.

FDOS Rule:

> Every engineering document required for agent initialization shall be reachable through one official ADO entry point.

FDOS Rule:

> Agents shall perform Repository Discovery and locate the official ADO navigation entry point before executing the bootstrap sequence.

## Startup Sequence Authority

`ADO/README.md` is the normative source for the official TapTim.e agent startup sequence.

Other EP-006 artifacts may include operational overviews, lifecycle models or prompt requirements. Those supporting diagrams shall not redefine the official startup sequence.

If an apparent conflict exists between this file and an overview or lifecycle diagram, this file is authoritative.

## Official Startup Sequence (Normative)

```text
GitHub Connector Verification
  -> Repository Discovery
  -> Locate the official ADO Navigation Entry Point
  -> Read ADO/README.md
  -> ABS-001 Agent Bootstrap Standard
  -> AOS-001 Agent Onboarding Standard
  -> ADS-001 Agent Discovery Standard
  -> RHS-001 Repository Health Standard
  -> AIR-001 Agent Inventory Report
  -> READY FOR WORK
  -> EOM-001 Engineering Operating Model
  -> AGR-001 Agent Registry
  -> Role Execution
```

## Discovery Compatibility Rule

The initial Repository Discovery before ABS-001 is limited to locating the official ADO navigation entry point and verifying that repository evidence supports the startup sequence.

ADS-001 remains the full Repository Discovery standard after AOS-001.

This preserves backward compatibility while removing the assumption that `ADO/README.md` is known before repository evidence has been inspected.

## Mandatory Agent Startup Documents

| ID | Document | Location |
|---|---|---|
| ABS-001 | Agent Bootstrap Standard | `ADO/01_Architecture/Agent_Bootstrap_Standard.md` |
| AOS-001 | Agent Onboarding Standard | `ADO/01_Architecture/Agent_Onboarding_Standard.md` |
| ADS-001 | Agent Discovery Standard | `ADO/01_Architecture/Agent_Discovery_Standard.md` |
| RHS-001 | Repository Health Standard | `ADO/01_Architecture/Repository_Health_Standard.md` |
| AIR-001 | Agent Inventory Report | `ADO/01_Architecture/Agent_Inventory_Report.md` |
| EOM-001 | Engineering Operating Model | `ADO/01_Architecture/Engineering_Operating_Model.md` |
| AGR-001 | Agent Registry | `ADO/01_Architecture/Agent_Registry.md` |

## Governance

| ID | Document | Location |
|---|---|---|
| Decision Log | Decision Log | `ADO/00_Core/Decision_Log.md` |
| AVR-001 | Artifact Validation Register | `ADO/00_Governance/AVR-001_Artifact_Validation_Register.md` |

## EP-006 Agent Operations Framework

| ID | Document | Location |
|---|---|---|
| AOF-001 | Agent Operations Framework | `ADO/01_Architecture/Agent_Operations_Framework.md` |
| ABS-001 | Agent Bootstrap Standard | `ADO/01_Architecture/Agent_Bootstrap_Standard.md` |
| AOS-001 | Agent Onboarding Standard | `ADO/01_Architecture/Agent_Onboarding_Standard.md` |
| ADS-001 | Agent Discovery Standard | `ADO/01_Architecture/Agent_Discovery_Standard.md` |
| AIR-001 | Agent Inventory Report | `ADO/01_Architecture/Agent_Inventory_Report.md` |
| OAP-001 | Official Agent Prompt Standard | `ADO/01_Architecture/Official_Agent_Prompt_Standard.md` |
| TLP-001 | Official Technical Lead Start Prompt | `ADO/01_Architecture/Technical_Lead_Start_Prompt.md` |
| ALF-001 | Agent Lifecycle | `ADO/01_Architecture/Agent_Lifecycle.md` |
| RHS-001 | Repository Health Standard | `ADO/01_Architecture/Repository_Health_Standard.md` |
| AOG-001 | Agent Operational Guidelines | `ADO/01_Architecture/Agent_Operational_Guidelines.md` |

## Engineering Core

| Document | Location |
|---|---|
| Decision Log | `ADO/00_Core/Decision_Log.md` |
| Product Vision | `ADO/01_Architecture/Product_Vision.md` |
| Engineering Operating Model | `ADO/01_Architecture/Engineering_Operating_Model.md` |
| Adaptive Verification and CI Efficiency Standard (AVS-001) | `ADO/03_Testing/Adaptive_Verification_Standard.md` |
| Agent Registry | `ADO/01_Architecture/Agent_Registry.md` |

## Architecture

| Document | Location |
|---|---|
| Product Vision | `ADO/01_Architecture/Product_Vision.md` |
| Feature Blueprint Standard | `ADO/01_Architecture/Feature_Blueprint_Standard.md` |
| Technical Architecture Profile (TTAP-001) | `ADO/01_Architecture/Technical_Architecture_Profile.md` |
| Development Task Profile | `ADO/01_Architecture/Development_Task_Profile.md` |
| Official Technical Lead Start Prompt (TLP-001) | `ADO/01_Architecture/Technical_Lead_Start_Prompt.md` |
| Architecture Decision Records (through Human-accepted ADR-0015; DA4 implementation and exact-SHA review approved, first Human V5 failed closed) | `ADO/01_Architecture/ADR/` |
| Feature Blueprints (incl. FB-001, FB-002) | `ADO/01_Architecture/Feature_Blueprints/` |
| Technical Specifications (incl. TS-001, TS-002) | `ADO/01_Architecture/Technical_Specifications/` |
| Developer Implementation Manual (EP-008) | `ADO/01_Architecture/Developer_Implementation_Manual/` |

## Development

| Document | Location |
|---|---|
| EP-006 Validation Sprint | `ADO/02_Development/EP-006_Validation_Sprint.md` |
| EP-007 Development Tasks (DT-001–DT-026) | `ADO/02_Development/EP-007_Development_Tasks.md` |
| EP-009 Product Readiness Framework | `ADO/02_Development/EP-009_Product_Readiness_Framework.md` |
| EP-008 Post-Sprint-019 Block-Boundary Synchronization Plan | `ADO/02_Development/EP-008_Post_Sprint_019_Block_Boundary_Synchronization_Plan.md` |
| EP-008 Post-Sprint-019 Block-Boundary Synchronization Closure | `ADO/02_Development/EP-008_Post_Sprint_019_Block_Boundary_Synchronization_Closure.md` |
| EP-008 Post-Sprint-019 and EP-009 Reassessment Human Acceptance | `ADO/02_Development/EP-008_Post_Sprint_019_Human_Acceptance.md` |
| Block C3A Organization Administration Architecture Authorization | `ADO/02_Development/Block_C3A_Organization_Administration_Architecture_Authorization.md` |
| Block C3B Secure Organization Bootstrap Authorization | `ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Authorization.md` |
| Block C3B Secure Organization Bootstrap Closure | `ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Closure.md` |
| Block C3C Normal Administration Backend/API Authorization | `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Authorization.md` |
| Block C3C Normal Administration Backend/API Closure | `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Closure.md` |
| Block C3D Admin Web and Protected Android Capture Authorization | `ADO/02_Development/Block_C3D_Admin_Web_Android_Capture_Authorization.md` |
| Block C3E1 Identity-First Employee Membership Authorization Package | `ADO/02_Development/Block_C3E1_Identity_First_Employee_Membership_Authorization.md` |
| Block C3E2 Explicit Tag Reassignment Authorization Candidate | `ADO/02_Development/Block_C3E2_Explicit_Tag_Reassignment_Authorization.md` |
| Development Assignment 1 Human-Accepted Complete Offline Synchronization Contract and Repository Authorization | `ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md` |
| Development Assignment 1 Complete Offline Synchronization Implementation Plan | `ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Implementation_Plan.md` |
| Development Assignment 2 Setup and Export Backend Authorization — DA2 and DT-063–DT-068 closed for authorized local scopes after independent zero-finding review and closure-publication CI 11/11 | `ADO/02_Development/Development_Assignment_02_Setup_And_Export_Backend_Authorization.md` |
| Development Assignment 3 Correction and Append-only Audit Authorization — DA3, DT-069–DT-074 and DA3-PHYS-01/02/03 closed for authorized local scope after complete fresh Human V5 and independent zero-finding final review | `ADO/02_Development/Development_Assignment_03_Correction_And_Append_Only_Audit_Authorization.md` |
| Development Assignment 4 Professional Admin Web Productization — ADR-0015/DA4-P01–P12 Human-accepted; Workstreams A–D, AVS V0–V4 and H01 procedural correction independently approved; first Human V5 failed closed and no closure/new run is authorized | `ADO/02_Development/Development_Assignment_04_Professional_Admin_Web_Productization_Authorization.md` |
| Development Assignment 4 V5 Enablement — local R3 V0–V4, exact-SHA implementation review and H01 ADO correction approved; new Human V5 remains separately exact-bound and unauthorized | `ADO/02_Development/Development_Assignment_04_V5_Enablement_Authorization.md` |
| Development Assignment 5 Professional Mobile Productization — Workstreams A–F and AVS V0–V4 technically closed for the exact authorized local scope | `ADO/02_Development/Development_Assignment_05_Professional_Mobile_Productization_Authorization.md` |
| Development Assignment 5 V5 Enablement — Validation Phase-0 run 18 established the exact safe transfer binding A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; format and pairwise distinctness passed, its authority is consumed, and R-035 is locally mitigated. Product Human V5 is `NOT RUN`; DA5 and R-034 remain open. CI `30612797541` attempt 1 passed 12/12 only on ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176` / tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`; it is carried evidence, not exact-head CI for run-18 ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` or this synchronization. **DO NOT INSTALL/DO NOT START for every new action** | `ADO/02_Development/Development_Assignment_05_V5_Enablement_Authorization.md` |
| Development Assignment 5 V5 Isolated PostgreSQL Correction — Runtime Guard source `ba1b6e9`, CI `30255104609` attempt 2 12/12, immutable binary/manifest and independent Exact-SHA `APPROVED`; historical correction rounds retained; hardware authority not granted | `ADO/02_Development/Development_Assignment_05_V5_Isolated_PostgreSQL_Correction_Authorization.md` |
| Development Assignment 6 Production-like Platform and Operational Readiness — ADO-only candidate; Human acceptance and separate implementation/provisioning authority required | `ADO/02_Development/Development_Assignment_06_Production_Like_Platform_Authorization.md` |
| Legal, Privacy and Commercial Readiness Start Package — internal Block-H/DT-079–DT-084 working draft; not legal advice, approved legal text or publication authority | `ADO/02_Development/Legal_Privacy_Commercial_Readiness_Start_Package.md` |
| Block C3 Organization Administration Implementation Plan | `ADO/02_Development/Block_C3_Organization_Administration_Implementation_Plan.md` |
| Repository Health Sprint 001 | `ADO/02_Development/Repository_Health_Sprint_001.md` |
| Repository Maintenance Sprint 002 | `ADO/02_Development/Repository_Maintenance_Sprint_002.md` |
| Repository Freeze Sprint | `ADO/02_Development/Repository_Freeze_Sprint.md` |
| Development Sprint 001-010 Plans and Closures | `ADO/02_Development/Development_Sprint_001_Plan.md` through `Development_Sprint_010_Closure.md` |
| Development Area | `ADO/02_Development/` |

## Testing

| Document | Location |
|---|---|
| AVS-001 Adaptive Verification and CI Efficiency Standard — Human-accepted manual operating rules active; automatic selective CI remains a separately gated future Infrastructure Task | `ADO/03_Testing/Adaptive_Verification_Standard.md` |

## Operations

| Document | Location |
|---|---|
| Development Assignment 1 Gate-C Response-Drop Runbook | `ADO/04_Operations/Development_Assignment_01_Gate_C_Response_Drop_Runbook.md` |
| Development Assignment 3 V5 Human Functional/Physical Gate Runbook — complete fresh run passed and final closure approved; permanently non-executable without new separate authority | `ADO/04_Operations/Development_Assignment_03_V5_Runbook.md` |
| Development Assignment 4 V5 Human Browser Gate Runbook — first gate failed closed and authority is consumed; corrected checkpoint handshake independently approved, but execution requires new exact-bound Human authority | `ADO/04_Operations/Development_Assignment_04_V5_Runbook.md` |
| Development Assignment 5 V5 Human Android Runbook — Validation Phase-0 run 18 established the exact safe transfer binding A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; its authority is consumed and R-035 is locally mitigated. Product Human V5 is `NOT RUN`. CI `30612797541` attempt 1 passed 12/12 only on ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176` / tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`; it is carried evidence, not exact-head CI for run-18 ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` or this synchronization. **DO NOT INSTALL/DO NOT START for every new action** | `ADO/04_Operations/Development_Assignment_05_V5_Runbook.md` |

## Evidence

| Document | Location |
|---|---|
| Repository Readiness Assessment | `ADO/05_Evidence/Repository_Readiness_Assessment.md` |
| MVP Readiness Assessment | `ADO/05_Evidence/MVP_Readiness_Assessment.md` |
| Product Readiness Assessment (EP-009 baseline) | `ADO/05_Evidence/Product_Readiness_Assessment.md` |
| Product Readiness Roadmap (EP-009 baseline) | `ADO/05_Evidence/Product_Readiness_Roadmap.md` |
| Product Readiness Reassessment (2026-07-15) | `ADO/05_Evidence/Product_Readiness_Reassessment_2026-07-15.md` |
| EP-008 Post-Sprint-019 Block-Boundary Synchronization Evidence | `ADO/05_Evidence/EP-008/EP-008_Post_Sprint_019_Block_Boundary_Synchronization_Evidence.md` |
| EP-008 Post-Sprint-019 Independent Final Review | `ADO/05_Evidence/EP-008/EP-008_Post_Sprint_019_Independent_Final_Review.md` |
| Block C3A Independent Architecture/Security Review | `ADO/05_Evidence/Block_C3A_Independent_Architecture_Security_Review.md` |
| Block C3B Independent Architecture/Security Review | `ADO/05_Evidence/Block_C3B_Independent_Architecture_Security_Review.md` |
| Block C3B Secure Organization Bootstrap Evidence | `ADO/05_Evidence/Block_C3B_Secure_Organization_Bootstrap_Evidence.md` |
| Block C3C Independent Architecture/Security Review (exact-SHA final approved) | `ADO/05_Evidence/Block_C3C_Independent_Architecture_Security_Review.md` |
| Block C3C Normal Administration Backend/API Implementation and Closure Evidence | `ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md` |
| Block C3D Independent Architecture/Security Review and Correction Disposition | `ADO/05_Evidence/Block_C3D_Independent_Architecture_Security_Review.md` |
| Block C3D Physical Validation Evidence | `ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md` |
| Block C3D Closure Synchronization Evidence | `ADO/05_Evidence/Block_C3D_Closure_Synchronization_Evidence.md` |
| C3D Closure Sync / C3E1 Independent Architecture-Security Review | `ADO/05_Evidence/Block_C3D_C3E1_Independent_Architecture_Security_Review.md` |
| Block C3E1 Implementation Evidence | `ADO/05_Evidence/Block_C3E1_Implementation_Evidence.md` |
| Block C3E1 Physical Validation Evidence | `ADO/05_Evidence/Block_C3E1_Physical_Validation_Evidence.md` |
| Block C3E1 Independent Final Closure Review | `ADO/05_Evidence/Block_C3E1_Independent_Final_Closure_Review.md` |
| Block C3E2 Independent Pre-Implementation Architecture/Security Review | `ADO/05_Evidence/Block_C3E2_Independent_Architecture_Security_Review.md` |
| Block C3E2 Independent Final Implementation Review | `ADO/05_Evidence/Block_C3E2_Independent_Implementation_Review.md` |
| Block C3E2 Local Implementation Evidence | `ADO/05_Evidence/Block_C3E2_Implementation_Evidence.md` |
| Block C3E2 Physical Validation Evidence | `ADO/05_Evidence/Block_C3E2_Physical_Validation_Evidence.md` |
| Block C3E2 Independent Final Closure Review | `ADO/05_Evidence/Block_C3E2_Independent_Final_Closure_Review.md` |
| Development Assignment 1 Independent Pre-Implementation Review | `ADO/05_Evidence/Development_Assignment_01_Independent_Pre_Implementation_Review.md` |
| Development Assignment 1 Implementation Evidence | `ADO/05_Evidence/Development_Assignment_01_Implementation_Evidence.md` |
| Development Assignment 1 Independent Implementation Review and Correction Disposition | `ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md` |
| Development Assignment 1 Human Physical Validation Evidence — five prior complete runs failed historically; sixth complete fresh Gate A–E passed on the exact authorized runtime-complete artifact | `ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md` |
| Development Assignment 1 Independent Final Closure Review — approved, zero open P0–P3; DA1 and DT-060–DT-062 closure eligible for the authorized local scope | `ADO/05_Evidence/Development_Assignment_01_Independent_Final_Closure_Review.md` |
| Development Assignment 1 Closure Evidence and Permanent Artifact Manifest | `ADO/05_Evidence/Development_Assignment_01_Closure_Evidence.md` |
| Development Assignment 2 Independent Pre-Implementation Review — final re-review `APPROVED FOR CANDIDATE PUBLICATION`, DA2-REV-01 closed, zero open P0–P3 | `ADO/05_Evidence/Development_Assignment_02_Independent_Pre_Implementation_Review.md` |
| Development Assignment 2 Implementation Evidence — `f385814`/tree `48b5ba8`, 1,681 local tests and exact-head CI 11/11 green; independent exact-SHA review approved | `ADO/05_Evidence/Development_Assignment_02_Implementation_Evidence.md` |
| Development Assignment 2 Independent Implementation Review — `APPROVED`, zero open P0–P3; exact-scope closure subsequently completed | `ADO/05_Evidence/Development_Assignment_02_Independent_Implementation_Review.md` |
| Development Assignment 2 Closure Evidence — DA2 and DT-063–DT-068 completed for local setup-integration/export-backend scopes; closure-publication CI 11/11 | `ADO/05_Evidence/Development_Assignment_02_Closure_Evidence.md` |
| Development Assignment 3 Independent Pre-Implementation Review — ADO-only candidate approved for publication, zero open P0–P3; subsequently Human-accepted/authorized on exact published baseline | `ADO/05_Evidence/Development_Assignment_03_Independent_Pre_Implementation_Review.md` |
| Development Assignment 3 Implementation Evidence — `0f71aca`/tree `e3e2ed7`, 1,757 local tests and exact-head CI 12/12 green; independent review approved | `ADO/05_Evidence/Development_Assignment_03_Implementation_Evidence.md` |
| Development Assignment 3 Independent Implementation Review — historical implementation `APPROVED`, zero open P0–P3; later Human V5 and final closure completed | `ADO/05_Evidence/Development_Assignment_03_Independent_Implementation_Review.md` |
| Development Assignment 3 V5 Enablement Evidence — historical enablement/correction chain independently approved; later complete fresh Human V5 passed under separate evidence | `ADO/05_Evidence/Development_Assignment_03_V5_Enablement_Evidence.md` |
| Development Assignment 3 Independent V5 Enablement Review — historical enablement `APPROVED`, zero open P0–P3; three later runs failed under separate records | `ADO/05_Evidence/Development_Assignment_03_Independent_V5_Enablement_Review.md` |
| Development Assignment 3 Physical Validation Evidence — three historical failures followed by one complete fresh Gates A–C pass with complete cleanup and independent zero-finding final approval | `ADO/05_Evidence/Development_Assignment_03_Physical_Validation_Evidence.md` |
| Development Assignment 3 Independent Final Closure Review — `APPROVED FOR DA3-V5 PHYSICAL CLOSURE`, zero open P0–P3; Human accepted | `ADO/05_Evidence/Development_Assignment_03_Independent_Final_Closure_Review.md` |
| Development Assignment 3 Closure Evidence and Permanent Artifact Manifest — DA3, DT-069–DT-074 and DA3-PHYS-01/02/03 completed for authorized local scope subject to closure-publication Exact-Head-CI | `ADO/05_Evidence/Development_Assignment_03_Closure_Evidence.md` |
| Development Assignment 3 DA3-PHYS-01 Failure-Synchronization Independent Review — approved with zero review findings; `DA3-PHYS-01` P1 remains open and correction architecture remains Human-gated | `ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_01_Failure_Synchronization_Independent_Review.md` |
| Development Assignment 3 DA3-PHYS-01 Operational Reinstall Correction Evidence — Human-selected ADO-only R3 correction independently approved; later replacement failed before reaching it | `ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_01_Operational_Reinstall_Correction_Evidence.md` |
| Development Assignment 3 DA3-PHYS-01 Operational Reinstall Independent Review — historical correction `APPROVED`, zero P0–P3; later replacement failed at `DA3-PHYS-02` before corrected boundary | `ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_01_Operational_Reinstall_Independent_Review.md` |
| Development Assignment 3 DA3-PHYS-02 Replacement-Failure Independent Review — `APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-02 CORRECTION CANDIDATE`, zero open P0–P3 | `ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_02_Replacement_Failure_Independent_Review.md` |
| Development Assignment 3 DA3-PHYS-02 Correction Independent Exact-Delta Review — `APPROVED FOR DA3-PHYS-02 ADO CORRECTION`, zero open P0–P3 and Human-accepted; new run remains Human-gated | `ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_02_Correction_Independent_Exact_Delta_Review.md` |
| Development Assignment 3 DA3-PHYS-03 Operator-Control Independent Review — failure synchronization/candidate `APPROVED`, zero open P0–P3; focused ADO correction Human-authorized; new run remains Human-gated | `ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_03_Operator_Control_Independent_Review.md` |
| Development Assignment 3 DA3-PHYS-03 Correction Independent Exact-Delta Review — `APPROVED`, zero open P0–P3 and Human-accepted; archive/CI green, new run remains Human-gated | `ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_03_Correction_Independent_Exact_Delta_Review.md` |
| Development Assignment 4 Independent Pre-Implementation Review — historical ADO-only candidate `APPROVED`, zero open P0–P3; Human acceptance/implementation later granted and product implementation approved | `ADO/05_Evidence/Development_Assignment_04_Independent_Pre_Implementation_Review.md` |
| Development Assignment 4 Independent Implementation Review — exact-SHA `APPROVED`, `MERGE_READY`, zero open P0–P3; Human V5 required before closure and separately unauthorized | `ADO/05_Evidence/Development_Assignment_04_Independent_Implementation_Review.md` |
| Development Assignment 4 V5 Enablement Evidence — final corrected V3 passed 1,825 tests; exact-head CI 12/12 and independent implementation review approved; first Human V5 later failed closed and its authority is consumed | `ADO/05_Evidence/Development_Assignment_04_V5_Enablement_Evidence.md` |
| Development Assignment 4 V5 Enablement Independent Pre-Implementation Review — historical exact-SHA `APPROVED`, `MERGE_READY`, zero open P0–P3; Human acceptance and separate R3 implementation authority later granted | `ADO/05_Evidence/Development_Assignment_04_V5_Enablement_Independent_Pre_Implementation_Review.md` |
| Development Assignment 4 V5 Enablement Independent Implementation Review — round 1 had one P2 signal-lifecycle finding; correction `e731a77` passed exact-head CI 12/12 and round 2 returned `APPROVED`, `MERGE_READY`, zero open P0–P3 | `ADO/05_Evidence/Development_Assignment_04_V5_Enablement_Independent_Implementation_Review.md` |
| Development Assignment 4 DA4-V5-H01 Human Browser Failure Evidence — first gate failed closed at the premature Tag-reassignment checkpoint; P2 operational/gate reliability, complete cleanup, authority consumed and new run unauthorized | `ADO/05_Evidence/Development_Assignment_04_DA4_V5_H01_Human_Browser_Failure_Evidence.md` |
| Development Assignment 4 DA4-V5-H01 Correction Independent Exact-SHA Review — `APPROVED`, zero open P0–P3 review findings; historical P2 remains until a fresh successful gate/final review and no new run is authorized | `ADO/05_Evidence/Development_Assignment_04_DA4_V5_H01_Correction_Independent_Exact_SHA_Review.md` |
| Development Assignment 5 Local Implementation Evidence — Workstreams A–F and AVS V0–V4 technically closed for the exact authorized local scope | `ADO/05_Evidence/Development_Assignment_05_Local_Implementation_Evidence.md` |
| Development Assignment 5 V5 Evidence — Validation Phase-0 run 18 established the exact safe transfer binding A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; its authority is consumed and R-035 is locally mitigated. Product Human V5 is `NOT RUN`; DA5 and R-034 remain open. CI `30612797541` attempt 1 passed 12/12 only on ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176` / tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`; it is carried evidence, not exact-head CI for run-18 ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` or this synchronization. **DO NOT INSTALL/DO NOT START for every new action** | `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md` |
| Development Assignment 5 V5 Validation Query-Visibility Correction Independent Exact-SHA Review — review base `11a8269`, CI `30277641127` 12/12, `APPROVED`, zero open P0–P3; Hardware remains unauthorized | `ADO/05_Evidence/Development_Assignment_05_V5_Validation_Query_Visibility_Correction_Independent_Exact_SHA_Review.md` |
| Development Assignment 5 V5 Validation Runtime Correction Independent Exact-SHA Review — initial candidate `534b6d2` had one P1 fail-open graph; source `7e8c0f7`, CI `30284566289` 12/12 and its artifact independently `APPROVED` with zero open P0–P3 for that exact source; artifact is now historical/DO NOT INSTALL after DA5-V5-VAL-UI-01 source correction and Hardware authority remains separately gated | `ADO/05_Evidence/Development_Assignment_05_V5_Validation_Runtime_Correction_Independent_Exact_SHA_Review.md` |
| Development Assignment 5 DA5-V5-VAL-UI-01 Independent Source/Artifact Exact-SHA Review — source `e97bbe9`, tree `2958f45`, CI `30370977809` attempt 1 12/12 and exact replacement APK/manifest `APPROVED`, zero open P0–P3; artifact is now historical/DO NOT INSTALL | `ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_UI_01_Independent_Source_Artifact_Exact_SHA_Review.md` |
| Development Assignment 5 DA5-V5-VAL-NATIVE-CAPTURE-DIAGNOSTICS Independent Source/Artifact Exact-SHA Review — source `effc57a`, tree `758dbfa`, CI `30377569479` attempt 1 12/12 and exact replacement APK/manifest `APPROVED`, zero open P0–P3 for that exact historical source; artifact is now DO NOT INSTALL after confirmed `DA5-V5-VAL-TECH-01` | `ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_NATIVE_CAPTURE_DIAGNOSTICS_Independent_Source_Artifact_Exact_SHA_Review.md` |
| Development Assignment 5 DA5-V5-VAL-TECH-01 Independent Source/Artifact Exact-SHA Review — source `03694f2`, tree `6c60396`, CI `30386552118` attempt 1 12/12 and exact APK/manifest `APPROVED`, zero open P0–P3; artifact remains DO NOT INSTALL and review grants no hardware authority | `ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_TECH_01_Independent_Source_Artifact_Exact_SHA_Review.md` |
| Development Assignment 5 V5 Validation Phase-0 Operator Correction Independent Exact-SHA Review — historical candidate `083fdfb`, tree `24bd130`, CI `30402655381` attempt 1 12/12 remains round-2 `APPROVED`, zero open P0–P3; separate readiness candidate `496ca59`, tree `b398b89`, and failed exact-candidate CI `30427205223` remain historical; focused test-only correction `21e5181`, tree `8f764f9`, exact-head CI `30429746848` attempt 1 12/12 and independent source/delta plus final Exact-SHA/V4 reviews are `APPROVED` with zero open P0–P3, closing the historical P2; no hardware authority | `ADO/05_Evidence/Development_Assignment_05_V5_Validation_Phase_0_Operator_Correction_Independent_Exact_SHA_Review.md` |
| Development Assignment 6 Independent Pre-Implementation Review — ADO-only candidate publication `APPROVED`, initial EOF-whitespace P3 closed, zero open P0–P3; no implementation, legal, provider, cost or production authority | `ADO/05_Evidence/Development_Assignment_06_Independent_Pre_Implementation_Review.md` |
| Development Assignment 1 DA1-PHYS-01 Independent Exact-Delta Review — approved, finding closed | `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md` |
| Development Assignment 1 DA1-PHYS-02 Independent Exact-Delta Review — approved, repository finding closed | `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_02_Independent_Exact_Delta_Review.md` |
| Development Assignment 1 DA1-PHYS-03 Independent Exact-Delta Review — approved, repository finding closed | `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_03_Independent_Exact_Delta_Review.md` |
| Development Assignment 1 DA1-PHYS-04 Failure-Synchronization Independent Exact-Delta Review — approved for failure truth/diagnosis/correction boundary; P1 remains open | `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Failure_Synchronization_Independent_Exact_Delta_Review.md` |
| Development Assignment 1 DA1-PHYS-04 Independent Exact-Delta Review — approved, repository finding closed; later artifact retention and runtime-completeness failures do not reopen the product finding | `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Independent_Exact_Delta_Review.md` |
| Development Assignment 1 DA1-ARTIFACT-02 Independent Exact-Delta and Artifact Final Review — approved, zero open P0–P3, artifact-pipeline finding closed; subsequent sixth complete fresh gate passed | `ADO/05_Evidence/Development_Assignment_01_DA1_ARTIFACT_02_Independent_Exact_Delta_Artifact_Review.md` |
| Product Readiness Reassessment — C3D Closure Delta | `ADO/05_Evidence/Product_Readiness_Reassessment_2026-07-15_C3D_Closure_Delta.md` |
| EP-008 Evidence (incl. Repository Health Follow-up) | `ADO/05_Evidence/EP-008/` |
| Evidence Area | `ADO/05_Evidence/` |

## Navigation Rule

Agents shall not guess mandatory startup document paths. Agents shall locate this ADO navigation entry point through repository evidence, read it and then follow the documented startup sequence.
