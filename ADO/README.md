# TapTim.e ADO

Status: Draft Navigation Entry Point  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect

## Purpose

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
| Architecture Decision Records (through Human-accepted ADR-0015; DA4 correction publication/V4 green, independent implementation review pending) | `ADO/01_Architecture/ADR/` |
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
| Development Assignment 4 Professional Admin Web Productization — ADR-0015/DA4-P01–P12 Human-accepted; Workstreams A–D and AVS V0–V4 published and independently approved with zero open P0–P3; Human V5 required before closure and separately unauthorized | `ADO/02_Development/Development_Assignment_04_Professional_Admin_Web_Productization_Authorization.md` |
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
| Development Assignment 4 Independent Pre-Implementation Review — ADO-only candidate `APPROVED`, zero open P0–P3; Human acceptance and implementation authority remain pending | `ADO/05_Evidence/Development_Assignment_04_Independent_Pre_Implementation_Review.md` |
| Development Assignment 4 Independent Implementation Review — exact-SHA `APPROVED`, `MERGE_READY`, zero open P0–P3; Human V5 required before closure and separately unauthorized | `ADO/05_Evidence/Development_Assignment_04_Independent_Implementation_Review.md` |
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
