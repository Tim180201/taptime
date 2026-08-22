# Development Assignment 5 — V5 Fresh Artifact Rebinding Authorization

- Status: **FULFILLED / SUPERSEDED BY EXACT M PRE-HARDWARE CLOSURE / NO HARDWARE AUTHORITY**
- Date: 2026-08-13
- Owner: Technical Lead
- Approval authority: Human Architect
- Exact ADO candidate baseline: `e408820bf25e48f9cf5977f70f79d2cbccb135dc`
- Exact ADO candidate baseline tree: `98e323f90eb7ea1694e8dc0678f07486e66408a2`
- Current ADO risk: AVS-001 **R0**; authorized future artifact/hardbinding work: **R3**
- Governing architecture and verification: ADR-0019; AVS-001
- Amends: `Development_Assignment_05_V5_Employee_Readiness_and_Accessibility_Abort_Correction_Authorization.md`
- Related operational risk: R-026; R-034

## Fulfilment record

Marker: `DA5-V5-PRE-HARDWARE-CLOSURE-M-2026-08-13`. This authorization was executed through
source `A` `03e0e48ad53ff91b24ee1182abf782473317988d` / tree
`4465f8ee5be41f82cdaed5f31f2da92b839c952d` and hardbinding `B`
`489a853e1af45e60bab0b94bcce05d674f6af700` / tree
`841727f8228f85ab91f5f7e9e9a052608e105152`. The exact four-path A→B ordinary
`git diff --binary A B` is 10,441 bytes / SHA-256
`d430d51edf2459f37b96f6634611ad6092d9aa23330ec923da15e7dc2fc55127`; canonical
`git diff --full-index --binary A B` is 10,705 bytes / SHA-256
`b875bc186f2e218f608c69d2ebe579fc580e363664fd5efb6135c7961931610a`.
The final executable is merge `M`
`9380758f3e149718c8c0b8d34a1818de64c0d8d1` / tree
`3c3b566124cf8c7ccd7727faf3a8aa76231f20f7`, parents `B` and sequencing publication `D`
`cc6767d118a66e7926b2a5c2a457684695d05d45`; `M` versus `B` is exactly five ADO paths.

The Source-A APK is 95,526,563 bytes / `0444` / SHA-256
`b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234` and its 59-LF-field
manifest is 1,968 bytes / `0444` / SHA-256
`91725bb6f14306eb40d0e4414f38511fc829250799af91bacf840ac622efc577`. Corrected V3, exact-head
CI `31695047997` attempt 1 at 12/12, and final Round-4 runtime/artifact review are all `APPROVED`
with zero findings. The independently approved R4 runtime is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/9380758f-f06a1b50-r4`;
its 16,492-byte / `0444` manifest and entry/map SHA-256 values are respectively
`8a179bf8ef7dd206f6095d4d1248780062fe3a7d8db78d45276dbf356b95609d`,
`f06a1b508369fc525e562485f7a08bd5b1174034d0554cdb5174b3bbf3ef70d5` and
`aba65ced7deb7aa6a44809cc2fef33e202c0157b3056cd00324911e7890dc30a`. R1 was rejected for
npm-hash transcription; r2 closed that P2 but exposed the A→B recipe label; r3 fixed A→B but
exposed B→M/D→M labels. R4 binds both recipes for all three pairs without rebuild and is final
`APPROVED` with zero open P0–P3.

Sections below are the historical authorization contract, not pending work. Current authority is
only an R0/V0 ten-file ADO closure candidate followed by exact-head review of still-unknown `C`;
no V3/V4 rerun, ADB, installation, Hardware or Product-Human action is authorized.

## 1. Purpose and current truth

The published correction authorization requires a fresh Product APK because its exact Mobile
Product sources change, but its executable allowlist does not include the Android artifact
hardbinding source, declaration and focused test that still bind the older APK. Publishing the
fourteen-path correction without first creating the new APK would therefore leave the future
Operator bound to stale Product artifact bytes; building the APK first necessarily creates a
source commit that the artifact must name. This amendment closes only that sequencing and scope
gap.

This candidate changes no executable, test, dependency, lockfile, schema, workflow, runtime or
artifact input. It grants no present implementation, build, artifact, publication, CI, ADB,
installation or Hardware claim.

## 2. Activation and precedence

Future work below activates only after this exact five-path R0 candidate receives independent
read-only `APPROVED` with zero open P0–P3 and is focusedly published with no intervening path or
reference drift. The publication commit/tree is intentionally not predicted.

This amendment supersedes only the sequencing in Section 7 of the prior correction authorization:
instead of publishing the fourteen-path source candidate before its required fresh APK exists, it
creates local source commit A, builds and independently verifies that APK, then creates the final
hardbinding commit B. Exactly one final complete V3 is run on combined B, and B is published once
for exactly one exact-head V4 CI. Every original Product, security, tenant-isolation, disclosure,
review, artifact and separate-Human-Hardware gate remains controlling. Sections 3–6 and 8 of the
prior authorization remain unchanged except for the additive path authority in Section 5 below.

Any Product, Business, authentication, tenant-isolation, architecture, scope or authorization
ambiguity stops and returns to the Human Architect. Production, production data, production
signing, deployment and distribution remain excluded.

## 3. Exact approved source candidate bound for commit A

The source candidate is the independently `APPROVED` fourteen-path working-tree candidate based on
exact commit `e408820bf25e48f9cf5977f70f79d2cbccb135dc` / tree
`98e323f90eb7ea1694e8dc0678f07486e66408a2`, with zero open P0–P3 at delegation. Its twelve
tracked-file ordinary patch (`git diff --binary`, repository order, against that exact baseline)
has SHA-256:

`9cfee2460c5d545d2424ef52543a3151e9edfe568a83a953c17c36e1881a79d4`

Its two new files are bound separately by exact bytes:

| New path | SHA-256 |
|---|---|
| `apps/mobile/tests/runtime/ProductMobileRuntimeEmployeeReadiness.test.ts` | `67ce794a99e34aed69f46297d87d0acce9ebc41951fc763c45bb173c55f2880a` |
| `apps/mobile/tests/support/MemoryOfflinePlatform.ts` | `50da21e2b6c96b96e4f271f29f055a6ddb31728dd53354aa933c1b1d08034f9d` |

The complete commit-A allowlist is exactly:

- `apps/mobile/src/scan/contracts.ts`
- `apps/mobile/src/offline/OfflineCaptureCoordinator.ts`
- `apps/mobile/src/screens/ScanScreen.tsx`
- `apps/mobile/tests/offline/MobileOfflinePrimitives.test.ts`
- `apps/mobile/tests/offline/OfflineCaptureDatabase.test.ts`
- `apps/mobile/tests/offline/OfflineCaptureCoordinator.test.ts`
- `apps/mobile/tests/runtime/ProductMobileRuntimeEmployeeReadiness.test.ts`
- `apps/mobile/tests/screens/ScanScreen.test.ts`
- `apps/mobile/tests/support/MemoryOfflinePlatform.ts`
- `apps/synthetic-android-e2e/src/Da5V5AdbController.ts`
- `apps/synthetic-android-e2e/src/da5V5Main.ts`
- `apps/synthetic-android-e2e/tests/Da5V5AdbController.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5Profile.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts`

After activation, those exact bytes may be materialized unchanged on the actual focused ADO
publication head and committed once as local source commit A. A must have that publication head as
its direct parent, contain no path outside this allowlist and remain local and unpushed. The actual
commit and tree are recorded only after creation; they are not guessed here. Any byte, path,
baseline or review mismatch stops before commit or build.

## 4. Fresh detached-A Product APK and immutable manifest

From a fresh detached checkout of exact local A, Development may use the established local Product
artifact root
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/` to create exactly one fresh
task-owned staged Product APK and its manifest. Publication into a new uniquely named child of
that root must be atomic; the final APK and manifest must be regular, canonical, non-symlink,
read-only immutable local files. Existing artifacts remain untouched and become historical
**DO NOT INSTALL** inputs for this correction.

The manifest must retain the existing exact 59-field contract and bind its complete current field
set, including exact source-A commit/tree, APK path/name, bytes, mode, SHA-256,
package/version, signature schemes, signer count/certificate, native security/backup/NFC/runtime
facts, build/toolchain inputs and the explicit `NOT_RUN`/`UNAUTHORIZED` execution fields. It may
truthfully carry the already completed source-candidate review; generation-time artifact review
remains `PENDING` and is not rewritten later. Existing contract separation is preserved:
manifest build metadata remains Android Build Tools `36.0.0`, while read-only APK inspection
authority remains exactly the separately bound `35.0.0` inspection tools; neither value may be
silently normalized to the other.

Independent read-only artifact verification must then prove byte-for-byte and parsed 59-field
manifest equality, exact source A, package `com.tim180201.mobile.synthetic`, local synthetic
signer identity, signature schemes, native security/backup/NFC/runtime constraints, APK contents
and stable file identity before any hardbinding work. It must return `APPROVED` with zero open
P0–P3. This stage authorizes no ADB, install, emulator, device or Hardware action.

## 5. Exact minimal commit-B boundary

After the detached-A APK and manifest are independently approved, commit B may change only:

- `apps/mobile/scripts/da5V5AndroidArtifact.mjs`
- `apps/mobile/scripts/da5V5AndroidArtifact.d.mts`
- `apps/mobile/tests/runtime/da5V5AndroidArtifact.test.ts`
- `apps/synthetic-android-e2e/tests/Da5V5ProductStartBundle.test.ts` **only if** its expected
  Product-artifact or final Operator bundle/map binding must change.

B must be based directly on A and bind the exact approved APK/manifest canonical paths, bytes,
modes, SHA-256 values and source-A commit/tree. The declaration and focused tests must match that
binding exactly and preserve strict 59-field parsing, immutable-file revalidation, package,
signature, native security/backup/NFC/runtime and fail-closed behavior. The conditional
ProductStart test may change only when needed to bind the new APK's exact entry count, embedded
Hermes bundle bytes/SHA-256, bytecode-dump bytes/SHA-256, and the final B Operator bundle/map
bytes/SHA-256 plus existing source-map invariants. Test-only expected-value changes must not
create a Product rule or broaden runtime authority.

No other source, test, native Android, prebuild, app/build/signing/packaging configuration,
dependency, lockfile, schema, migration, workflow or tracked generated input may change. The
actual B commit/tree and final artifact/runtime values are recorded only after they exist.

## 6. Verification and one-publication sequence

1. **A formation:** prove the activated ADO head, exact fourteen paths, tracked patch digest and
   both new-file digests; create local unpushed A.
2. **Detached-A artifact:** build, atomically publish and independently approve the exact fresh
   APK plus immutable 59-field manifest under Section 4. Do not run a complete repository V3 or
   publish A separately.
3. **B development:** apply only Section 5, running AVS V0/V1 and the complete affected V2
   boundary, including artifact hardbinding, manifest, ProductStart APK-entry/Hermes/bytecode
   evidence, final Operator bundle/map and tests-inclusive typechecks. Produce all final exact
   expectations before freezing B.
4. **Final local candidate:** once every B source/test byte is final, create local unpushed B and
   run exactly one successful complete AVS V3 on combined B, with exact counts and disclosed
   skips. A failed check is investigated; any valid In-Scope correction forms a new final B
   identity and only that final identity receives the one successful complete V3.
5. **Prepublication:** independent review binds exact A and B, both trees, A-to-B delta, APK and
   manifest, V0–V3, protected-neighbor results and the no-extra-path result. Required verdict is
   `APPROVED` with zero open P0–P3.
6. **One publication / one CI:** after an exact remote/ref and clean-scope check, publish B once;
   A travels only in B's ancestry during that single push and is never pushed as a separate
   operation. Run exactly one
   complete V4 CI on exact published B. Do not create an A-only CI or a documentation-triggered
   duplicate V3/V4.
7. **Fresh B runtime:** from exact published B, atomically create the fresh read-only Product
   Operator runtime plus immutable manifest in the established
   `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/` root. Bind
   exact B commit/tree, manifest, entrypoint bundle, adjacent map, bytes, modes, SHA-256 and
   existing map/entrypoint invariants; verify them independently.
8. **Final closure:** independent exact-head/artifact review binds published B/tree, exact delta,
   exact-head V4, source-A APK/59-field manifest and B runtime/manifest/bundle/map. Required
   verdict is `APPROVED` with zero open P0–P3 before any later Hardware request.

This sequence concentrates, but does not remove, the prior authorization's V0–V4, independent
review, artifact, protected-boundary and publication gates.

## 7. Failure, cleanup and preservation

- Baseline, digest, path, source/artifact identity, review, remote or cleanup ambiguity fails
  closed before the next mutation.
- A or B stays local and unpushed until its explicit publication gate. No failed or intermediate
  candidate is published.
- A failed artifact/runtime generation removes only exact task-owned staging created by that
  operation when its identity is unambiguous. Existing immutable artifacts and foreign paths are
  never modified. Ambiguous or diagnostically required task evidence is preserved read-only and
  reported rather than broadly cleaned.
- Atomic publication may target only the two established local artifact roots named above. No
  production, deployment, release, distribution or external service is involved.
- An unchanged failed check is not rerun to seek green. A source, artifact, manifest, runtime or
  review change invalidates only the evidence whose inputs changed and triggers the governing
  affected/final gate.
- No ADB, package mutation, installation, emulator, Product Operator device run, Human
  observation, Tag/NFC action or Hardware V5 occurs. Those require a later separate exact Human
  authorization binding final approved B and both fresh artifact packages.

## 8. Current R0 Change-Impact Record

- Baseline: `e408820bf25e48f9cf5977f70f79d2cbccb135dc` / tree
  `98e323f90eb7ea1694e8dc0678f07486e66408a2`.
- Current delta: exactly this new authorization plus compact current-truth/index entries in
  `ADO/00_Core/Project_Status.md`, `ADO/00_Core/Risk_Register.md`,
  `ADO/00_Core/Decision_Log.md` and `ADO/README.md`.
- Current affected runtime boundary: none; ADO-only candidate.
- Current risk: R0. Future artifact/hardbinding sequence: R3.
- Current V0: exact five-path scope, diff/whitespace/reference and tracked-tree preservation.
- V1–V5, build, install, npm, ADB and Hardware: not run and not authorized for this candidate.
- Carried evidence: only the exact independently reviewed fourteen-path source bytes and their
  digests in Section 3; no new Product, artifact, CI or Hardware evidence is inferred.
- Remaining gates: independent R0 review, focused ADO publication, then Sections 3–7.
- Current next gate: independent read-only review of this exact ADO-only candidate.
